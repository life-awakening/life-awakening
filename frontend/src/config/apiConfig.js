/**
 * Life Awakening Centralized API Base URL Configuration
 *
 * In production:
 *   Always uses relative URLs ('') so that endpoints like `${API_BASE_URL}/api/login`
 *   or `${API_BASE_URL}/api/translations` resolve to `/api/login` and `/api/translations`
 *   on the current window.location.origin. This routes requests seamlessly through
 *   the Nginx reverse proxy to the backend without CORS or localhost issues.
 *
 * In development:
 *   Uses `import.meta.env.VITE_API_URL` (configured as http://localhost:5181 in frontend/.env)
 *   or falls back to http://localhost:5181.
 */

export const getApiBaseUrl = () => {
  // In production builds, enforce relative path ('') unless a dedicated external URL is explicitly provided
  if (import.meta.env.PROD) {
    const prodEnvUrl = (import.meta.env.VITE_API_URL || '').trim();
    if (prodEnvUrl && !prodEnvUrl.includes('localhost') && !prodEnvUrl.includes('127.0.0.1')) {
      return prodEnvUrl.replace(/\/+$/, '');
    }
    return '';
  }

  // Development mode:
  const devEnvUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (devEnvUrl) {
    return devEnvUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:5181';
};

export const API_BASE_URL = getApiBaseUrl();
export const API = API_BASE_URL;
export default API_BASE_URL;
