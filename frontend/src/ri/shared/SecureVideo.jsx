import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { resolveCleanFileUrl, fetchSecureBlobUrl } from '../utils/secureFileHelpers';

export default function SecureVideo({
  src,
  poster,
  controls = true,
  autoPlay = false,
  playsInline = true,
  preload = 'metadata',
  style = {},
  className = ''
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
        console.warn('[SecureVideo] Error loading video blob:', err);
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

  if (isProtectedS3Url && loading) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#090d16',
          color: '#94a3b8',
          width: style?.width || '100%',
          height: style?.height || '220px',
          borderRadius: style?.borderRadius || '8px',
          fontSize: '12px',
          gap: '8px',
          ...style
        }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: '#059669' }} />
        <span>Loading protected video...</span>
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#090d16',
          color: '#f87171',
          width: style?.width || '100%',
          height: style?.height || '220px',
          borderRadius: style?.borderRadius || '8px',
          fontSize: '12px',
          gap: '8px',
          ...style
        }}
      >
        <AlertCircle size={20} />
        <span>Could not load protected video</span>
      </div>
    );
  }

  return (
    <video
      src={activeSrc}
      poster={poster}
      controls={controls}
      autoPlay={autoPlay}
      playsInline={playsInline}
      preload={preload}
      className={className}
      style={style}
    />
  );
}
