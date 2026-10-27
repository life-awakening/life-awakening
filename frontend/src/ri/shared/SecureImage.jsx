import React, { useState, useEffect } from 'react';
import { ImageIcon, AlertCircle } from 'lucide-react';
import { resolveCleanFileUrl, fetchSecureBlobUrl, openSecureFile } from '../utils/secureFileHelpers';

export default function SecureImage({
  src,
  alt = 'Image preview',
  className = '',
  style = {},
  onClick,
  onMouseEnter,
  onMouseLeave,
  title = 'Click to open in new tab',
  fallbackText = 'Image not available'
}) {
  const cleanUrl = resolveCleanFileUrl(src);
  const isProtectedS3Url = Boolean(
    cleanUrl &&
    !cleanUrl.startsWith('blob:') &&
    !cleanUrl.startsWith('data:') &&
    (cleanUrl.includes('/api/ri/student/files/view') || cleanUrl.includes('/api/ri/faculty/files/view') || cleanUrl.includes('/api/ri/faculty-portal/files/view'))
  );

  const [protectedBlobUrl, setProtectedBlobUrl] = useState(null);
  const [loading, setLoading] = useState(isProtectedS3Url);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isProtectedS3Url) {
      setProtectedBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    let isSubscribed = true;
    let revokeFn = null;

    setProtectedBlobUrl(null);
    setLoading(true);
    setError(false);

    fetchSecureBlobUrl(cleanUrl)
      .then(({ blobUrl, revoke }) => {
        if (!isSubscribed) {
          revoke();
          return;
        }
        revokeFn = revoke;
        setProtectedBlobUrl(blobUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        console.warn('[SecureImage] Error fetching secure blob:', err.message);
        setError(true);
        setLoading(false);
      });

    return () => {
      isSubscribed = false;
      if (revokeFn) {
        revokeFn();
      }
    };
  }, [cleanUrl, isProtectedS3Url]);

  const handleClick = (e) => {
    if (typeof onClick === 'function') {
      onClick(e);
    } else if (onClick !== false && src) {
      openSecureFile(src);
    }
  };

  if (!src) {
    return null;
  }

  const isSmallThumbnail = Boolean(
    (style?.width && parseInt(style.width, 10) <= 64) ||
    (style?.height && parseInt(style.height, 10) <= 64)
  );

  const isLightbox = Boolean(
    (typeof style?.maxHeight === 'string' && style.maxHeight.includes('vh')) ||
    (typeof style?.maxWidth === 'string' && style.maxWidth.includes('vw'))
  );

  const resolvedTitle = title !== undefined ? title : (typeof onClick === 'function' ? (alt || '') : 'Click to open in new tab');

  if (isProtectedS3Url && loading) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isLightbox ? 'rgba(15, 23, 42, 0.75)' : '#f1f5f9',
          color: isLightbox ? '#94a3b8' : '#64748b',
          width: style?.width || (isLightbox ? '320px' : '100%'),
          height: style?.height || (isSmallThumbnail ? '34px' : (isLightbox ? '240px' : '100%')),
          minHeight: isSmallThumbnail ? 'auto' : (style?.minHeight || (isLightbox ? '180px' : '60px')),
          maxHeight: style?.maxHeight,
          maxWidth: style?.maxWidth,
          borderRadius: style?.borderRadius || '8px',
          border: isSmallThumbnail ? '1px solid #e2e8f0' : (isLightbox ? '1px solid rgba(255, 255, 255, 0.15)' : '1px dashed #cbd5e1'),
          fontSize: isSmallThumbnail ? '10px' : '12px',
          boxSizing: 'border-box',
          boxShadow: isLightbox ? '0 20px 40px rgba(0,0,0,0.5)' : undefined,
          ...style
        }}
      >
        {isSmallThumbnail ? (
          <ImageIcon size={14} className="animate-pulse" />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ImageIcon size={isLightbox ? 22 : 18} className="animate-pulse" /> Loading image...
          </span>
        )}
      </div>
    );
  }

  const activeSrc = isProtectedS3Url ? protectedBlobUrl : cleanUrl;

  if (error || !activeSrc) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isLightbox ? 'rgba(69, 10, 10, 0.6)' : '#fef2f2',
          color: isLightbox ? '#fca5a5' : '#991b1b',
          width: style?.width || (isLightbox ? '320px' : '100%'),
          height: style?.height || (isSmallThumbnail ? '34px' : (isLightbox ? '240px' : '100%')),
          minHeight: isSmallThumbnail ? 'auto' : (style?.minHeight || (isLightbox ? '180px' : '60px')),
          maxWidth: style?.maxWidth,
          maxHeight: style?.maxHeight,
          borderRadius: style?.borderRadius || '8px',
          border: isLightbox ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca',
          fontSize: isSmallThumbnail ? '10px' : '12px',
          padding: isSmallThumbnail ? '2px' : '8px',
          boxSizing: 'border-box',
          boxShadow: isLightbox ? '0 20px 40px rgba(0,0,0,0.5)' : undefined,
          ...style
        }}
        title="Could not load protected image"
      >
        {isSmallThumbnail ? (
          <AlertCircle size={14} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={16} /> {fallbackText}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      style={{
        cursor: typeof onClick === 'function' ? 'pointer' : (onClick === false ? 'default' : (src ? 'pointer' : 'default')),
        ...style
      }}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={resolvedTitle}
      onError={() => setError(true)}
    />
  );
}
