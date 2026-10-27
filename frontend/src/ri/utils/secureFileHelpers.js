/**
 * Secure File Helpers for RI Hybrid S3 Storage
 * 
 * Enforces zero session JWT exposure in query parameters:
 * - Previews use authenticated fetch with Bearer token & Blob URLs
 * - Component unmount cleanly revokes Blob URLs to prevent memory leaks
 * - New tab & direct downloads use single-use, object-bound, short-lived file access tickets
 */

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');

export const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
};

/**
 * Cleanly resolves an image/document URL without appending session JWTs in query params
 */
export const resolveCleanFileUrl = (url) => {
  if (!url) return '';
  let trimmed = String(url).trim();

  // Strip any accidental session token from query strings
  if (trimmed.includes('token=')) {
    trimmed = trimmed.replace(/([?&])token=[^&]+(&|$)/, (m, p1, p2) => (p2 ? p1 : ''));
    if (trimmed.endsWith('?') || trimmed.endsWith('&')) {
      trimmed = trimmed.slice(0, -1);
    }
  }

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Handle mixed-content HTTPS upgrades in production
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
    trimmed = trimmed.replace('http://', 'https://');
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
      return trimmed.replace('/uploads/', '/api/uploads/');
    }
    return trimmed;
  }

  // Relative path resolution
  let clean = trimmed;
  if (clean.startsWith('/uploads/')) {
    clean = `/api${clean}`;
  } else if (clean.startsWith('uploads/')) {
    clean = `/api/${clean}`;
  } else if (clean.startsWith('ri_faculty_uploads/')) {
    clean = `/api/ri/faculty/files/view?key=${encodeURIComponent(clean)}`;
  } else if (!clean.startsWith('/api/')) {
    clean = `/api/uploads/${clean.startsWith('/') ? clean.slice(1) : clean}`;
  }

  const base = API && API.trim() ? API.trim().replace(/\/+$/, '') : '';
  return base ? `${base}${clean.startsWith('/') ? '' : '/'}${clean}` : clean;
};

/**
 * Fetches a protected file via Authorization: Bearer and converts to a local Blob URL
 */
export const fetchSecureBlobUrl = async (url, customToken = null) => {
  const token = customToken || getAuthToken();
  let cleanUrl = resolveCleanFileUrl(url);

  // If we have an authenticated Bearer session token, strip any existing ticket param
  // so the in-page request authenticates via Bearer header without consuming or colliding with single-use tickets
  if (token && cleanUrl.includes('ticket=')) {
    cleanUrl = cleanUrl.replace(/([?&])ticket=[^&]+(&|$)/, (m, p1, p2) => (p2 ? p1 : ''));
    if (cleanUrl.endsWith('?') || cleanUrl.endsWith('&')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
  }

  const res = await fetch(cleanUrl, {
    method: 'GET',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to load file (${res.status} ${res.statusText})`);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  return {
    blobUrl,
    revoke: () => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
    }
  };
};

/**
 * Requests a short-lived (60s), single-use file access ticket for opening files in new tabs
 */
export const getFileTicketUrl = async (url, customToken = null) => {
  const cleanUrl = resolveCleanFileUrl(url);
  const token = customToken || getAuthToken();

  const isStudentView = cleanUrl.includes('/api/ri/student/files/view');
  const isFacultyView = cleanUrl.includes('/api/ri/faculty/files/view') || cleanUrl.includes('/api/ri/faculty-portal/files/view');

  // If not a protected RI S3/proxy file, return clean URL as is
  if (!isStudentView && !isFacultyView) {
    return cleanUrl;
  }

  try {
    const parsed = new URL(cleanUrl, API || window.location.origin);
    const key = parsed.searchParams.get('key');
    if (!key) return cleanUrl;

    const ticketEndpoint = isFacultyView
      ? `${API}/api/ri/faculty/files/ticket`
      : `${API}/api/ri/student/files/ticket`;

    const res = await fetch(ticketEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ key })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ticket) {
        parsed.searchParams.set('ticket', data.ticket);
        return parsed.toString();
      }
    }
  } catch (err) {
    console.warn('[getFileTicketUrl] Ticket generation fallback:', err);
  }

  return cleanUrl;
};

/**
 * Safely opens a file in a new tab without exposing session JWT in access logs
 */
export const openSecureFile = async (url, isDownload = false) => {
  if (!url) return;
  try {
    const ticketUrl = await getFileTicketUrl(url);
    const finalUrl = isDownload ? `${ticketUrl}${ticketUrl.includes('?') ? '&' : '?'}download=true` : ticketUrl;
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Direct file download using authenticated Blob stream
 */
export const downloadSecureFile = async (url, filename = 'document') => {
  if (!url) return;
  try {
    const { blobUrl, revoke } = await fetchSecureBlobUrl(url);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(revoke, 1000);
  } catch (err) {
    console.warn('[downloadSecureFile] Falling back to ticket download:', err);
    openSecureFile(url, true);
  }
};
