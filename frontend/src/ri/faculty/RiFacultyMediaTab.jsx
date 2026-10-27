import React, { useState, useEffect, useRef, useCallback } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  Camera,
  Upload,
  Trash2,
  Eye,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
  Info,
  Calendar,
  User,
  Image as ImageIcon,
  Sparkles,
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const API = API_BASE_URL;

// Helper to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper to format date
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// Robust URL resolver for image files
// Robust URL resolver (routes uploaded assets through /api/uploads for CloudFront compatibility)
const resolveImageUrl = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
      return trimmed.replace('/uploads/', '/api/uploads/');
    }
    return trimmed;
  }
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

export default function RiFacultyMediaTab({
  selectedBatchId,
  selectedPanelId,
  panelData,
  isMobile = false
}) {
  const [mediaList, setMediaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Lightbox Modal State
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const maxAllowed = 5;
  const currentCount = mediaList.length;
  const isLimitReached = currentCount >= maxAllowed;

  // Fetch Media List
  const fetchMedia = useCallback(async () => {
    if (!selectedBatchId || !selectedPanelId) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-portal/media?batch_id=${selectedBatchId}&panel_id=${selectedPanelId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMediaList(data.media || []);
      } else {
        setError(data.message || 'Failed to load panel media.');
      }
    } catch (err) {
      console.error('Error fetching media:', err);
      setError('Network error while loading media. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBatchId, selectedPanelId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Handle File Selection
  const handleFileChange = (file) => {
    setError(null);
    if (!file) return;

    // Check MIME type / extension
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Please select a valid image file (JPG, JPEG, PNG, or WEBP).');
      return;
    }

    // Check size limit (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB limit. Please choose a smaller image.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLimitReached) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isLimitReached) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const clearSelectedFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload Handler
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a photo to upload.');
      return;
    }
    if (isLimitReached) {
      setError('Maximum 5 pictures limit reached for this panel.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('batch_id', selectedBatchId);
      formData.append('panel_id', selectedPanelId);
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      const res = await fetch(`${API}/api/ri/faculty-portal/media`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Photo uploaded successfully!');
        clearSelectedFile();
        fetchMedia();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data.message || 'Failed to upload photo.');
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Network error while uploading photo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Handler
  const handleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/faculty-portal/media/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Photo deleted successfully.');
        setItemToDelete(null);
        fetchMedia();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(data.message || 'Failed to delete photo.');
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError('Network error while deleting photo.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev + 1) % mediaList.length);
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, mediaList.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        padding: isMobile ? '16px' : '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Camera size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#0f172a' }}>
              Rural Immersion Visit Media
            </h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
              Upload up to <strong>5 pictures</strong> of your rural immersion visit. These photos will be visible to your assigned students, RI Admin, and SuperAdmin.
            </div>
          </div>
        </div>

        {/* Counter Widget */}
        <div style={{
          backgroundColor: isLimitReached ? '#fef2f2' : '#f0fdf4',
          border: `1.5px solid ${isLimitReached ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: '10px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          alignSelf: isMobile ? 'stretch' : 'auto',
          justifyContent: isMobile ? 'space-between' : 'flex-start'
        }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: isLimitReached ? '#991b1b' : '#166534' }}>
              Upload Limit
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: isLimitReached ? '#dc2626' : '#059669', marginTop: '1px' }}>
              {currentCount} <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>/ {maxAllowed} Photos</span>
            </div>
          </div>
          {/* Visual slot indicators */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {Array.from({ length: maxAllowed }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  width: '10px',
                  height: '24px',
                  borderRadius: '3px',
                  backgroundColor: idx < currentCount ? '#059669' : '#e2e8f0',
                  transition: 'background-color 0.2s ease'
                }}
                title={idx < currentCount ? `Slot ${idx + 1} filled` : `Slot ${idx + 1} empty`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#991b1b',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{error}</div>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '12px 16px',
          color: '#166534',
          fontSize: '13.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>{successMsg}</div>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Limit Reached Notice */}
      {isLimitReached && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Info size={20} color="#b45309" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.5 }}>
            <strong>Maximum Limit of 5 Photos Reached:</strong> All 5 slots for this panel have been used. To upload a different picture of the rural immersion visit, delete one of the existing photos below.
          </div>
        </div>
      )}

      {/* Upload Box (Only enabled when < 5 photos) */}
      {!isLimitReached && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          padding: isMobile ? '16px' : '22px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={17} color="#059669" />
            <span>Upload New Visit Photo (Slot {currentCount + 1} of 5)</span>
          </div>

          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile || !previewUrl ? '1fr' : '260px 1fr', gap: '16px', alignItems: 'start' }}>
              {/* Dropzone Area */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                />

                {previewUrl ? (
                  <div style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1.5px solid #059669',
                    backgroundColor: '#0f172a',
                    aspectRatio: '4/3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Remove preview"
                    >
                      <X size={15} />
                    </button>
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: '#ffffff',
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {formatFileSize(selectedFile?.size)}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                      border: `2px dashed ${isDragging ? '#059669' : '#cbd5e1'}`,
                      backgroundColor: isDragging ? '#ecfdf5' : '#f8fafc',
                      borderRadius: '12px',
                      padding: '32px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#e2e8f0',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}>
                      <ImageIcon size={22} />
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>
                      Click to choose photo or drag & drop here
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                      JPG, PNG, or WEBP up to 10MB
                    </div>
                  </div>
                )}
              </div>

              {/* Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Photo Caption / Activity Description <span style={{ color: '#94a3b8', fontWeight: '500' }}>(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={300}
                    placeholder="e.g., Gram Panchayat Sarpanch meeting, Family visit survey, School session..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', textAlign: 'right' }}>
                    {caption.length} / 300 characters
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: !selectedFile || isUploading ? '#94a3b8' : '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Uploading Photo...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Upload Photo to Visit Gallery</span>
                      </>
                    )}
                  </button>

                  {selectedFile && !isUploading && (
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Uploaded Photos Gallery Section */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        padding: isMobile ? '16px' : '22px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              Uploaded Visit Pictures ({currentCount} / {maxAllowed})
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Field visit documentation for Panel {panelData?.panel_number || ''}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px', color: '#059669' }} />
            <div style={{ fontSize: '13.5px' }}>Loading panel visit photos...</div>
          </div>
        ) : mediaList.length === 0 ? (
          /* Empty State */
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Camera size={26} />
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              No Visit Photos Uploaded Yet
            </h4>
            <p style={{ margin: '0 auto', maxWidth: '440px', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Use the upload section above to document your panel's rural immersion experience (up to 5 photos). Recommended photos include the Gram Panchayat visit, Sarpanch interaction, school activities, household survey visits, or group team photos.
            </p>
          </div>
        ) : (
          /* Photo Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '18px'
          }}>
            {mediaList.map((item, index) => {
              const fullUrl = resolveImageUrl(item.file_url);
              return (
                <div
                  key={item.id}
                  style={{
                    borderRadius: '12px',
                    border: '1.5px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  {/* Image Container */}
                  <div
                    style={{
                      position: 'relative',
                      aspectRatio: '4/3',
                      backgroundColor: '#0f172a',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img
                      src={fullUrl}
                      alt={item.caption || item.file_name || `Visit Photo ${index + 1}`}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.3s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />

                    {/* Slot badge */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      backgroundColor: 'rgba(5, 150, 105, 0.9)',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      Photo {index + 1} of {currentCount}
                    </div>

                    {/* Hover Overlay Hint */}
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <Maximize2 size={12} />
                      <span>View</span>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {item.caption ? (
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#0f172a',
                          marginBottom: '8px',
                          lineHeight: 1.4,
                          wordBreak: 'break-word'
                        }}>
                          {item.caption}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#94a3b8', marginBottom: '8px' }}>
                          No caption provided
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={12} color="#94a3b8" />
                          <span>{formatDate(item.created_at)}</span>
                        </div>
                        {item.uploaded_by_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <User size={12} color="#94a3b8" />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              By: {item.uploaded_by_name}
                            </span>
                          </div>
                        )}
                        {item.file_size && (
                          <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                            Size: {formatFileSize(item.file_size)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        title="Delete photo"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && mediaList[lightboxIndex] && (() => {
        const currentItem = mediaList[lightboxIndex];
        const fullUrl = resolveImageUrl(currentItem.file_url);
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.88)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: isMobile ? '12px' : '20px'
            }}
            onClick={() => setLightboxIndex(null)}
          >
            {/* Top Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                paddingBottom: '10px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '13.5px', fontWeight: '700' }}>
                Photo {lightboxIndex + 1} of {mediaList.length}
                {currentItem.caption && (
                  <span style={{ fontWeight: '400', color: '#cbd5e1', marginLeft: '10px' }}>
                    — {currentItem.caption}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={currentItem.file_name || 'visit-photo.jpg'}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Image with Navigation Arrows */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {mediaList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length)}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <img
                src={fullUrl}
                alt={currentItem.caption || 'Visit Photo'}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
              />

              {mediaList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % mediaList.length)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>

            {/* Bottom Caption Bar */}
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: '8px',
                padding: '10px 16px',
                color: '#ffffff',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '10px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                Uploaded by: <strong>{currentItem.uploaded_by_name || 'Faculty Mentor'}</strong> • {formatDate(currentItem.created_at)}
              </div>
              <div style={{ color: '#94a3b8' }}>
                Use Left/Right keys to navigate • Esc to close
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
              Delete Visit Photo?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to delete this photo{itemToDelete.caption ? ` ("${itemToDelete.caption}")` : ''}? This action cannot be undone. Deleting this will free up 1 slot in your maximum limit of 5 visit photos.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Delete Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
