import React, { useState, useEffect } from 'react';
import {
  Camera,
  Eye,
  X,
  Download,
  Calendar,
  User,
  Trash2,
  Loader2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles
} from 'lucide-react';
import SecureImage from './SecureImage';
import { downloadSecureFile } from '../utils/secureFileHelpers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

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

export default function RiPanelMediaViewer({
  media = [],
  isLoading = false,
  title = 'Rural Immersion Visit Photos',
  subtitle = 'Field visit documentation uploaded by Faculty Mentors',
  emptyMessage = 'No visit photos have been uploaded by your faculty mentor yet.',
  canDelete = false,
  onDelete = null,
  isMobile = false
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight' && media.length > 0) {
        setLightboxIndex((prev) => (prev + 1) % media.length);
      }
      if (e.key === 'ArrowLeft' && media.length > 0) {
        setLightboxIndex((prev) => (prev - 1 + media.length) % media.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, media.length]);

  const handleDeleteClick = async (item) => {
    if (!onDelete || !window.confirm('Are you sure you want to delete this visit photo?')) return;
    setDeletingId(item.id);
    try {
      await onDelete(item.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header Bar */}
      {(title || subtitle) ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Camera size={18} />
            </div>
            <div>
              {title && (
                <h4 style={{ margin: 0, fontSize: isMobile ? '14px' : '15.5px', fontWeight: '800', color: '#0f172a' }}>
                  {title}
                </h4>
              )}
              {subtitle && (
                <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: '#f1f5f9',
            color: '#334155',
            fontSize: '11.5px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: '20px',
            border: '1px solid #e2e8f0'
          }}>
            {media.length} / 5 Photos
          </div>
        </div>
      ) : (
        media.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
            <div style={{
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontSize: '11.5px',
              fontWeight: '700',
              padding: '4px 10px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0'
            }}>
              {media.length} / 5 Photos
            </div>
          </div>
        )
      )}

      {/* Loading state */}
      {isLoading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#059669' }} />
          <div style={{ fontSize: '13px' }}>Loading visit pictures...</div>
        </div>
      ) : media.length === 0 ? (
        /* Empty State */
        <div style={{
          textAlign: 'center',
          padding: '36px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '1px dashed #cbd5e1'
        }}>
          <Camera size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155' }}>
            {emptyMessage}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
            When faculty mentors upload immersion visit pictures (max 5), they will appear here.
          </div>
        </div>
      ) : (
        /* Photos Grid */
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '14px'
        }}>
          {media.map((item, idx) => {
            const fullUrl = resolveImageUrl(item.file_url);
            return (
              <div
                key={item.id}
                style={{
                  borderRadius: '10px',
                  border: '1.5px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '4/3',
                    backgroundColor: '#0f172a',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <SecureImage
                    src={item.file_url}
                    alt={item.caption || item.file_name || `Photo ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'transform 0.25s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />

                  {/* Slot pill */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(5, 150, 105, 0.9)',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 7px',
                    borderRadius: '5px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    Photo {idx + 1}
                  </div>

                  {/* View hint */}
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    padding: '4px 7px',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10.5px'
                  }}>
                    <Maximize2 size={11} />
                    <span>View</span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {item.caption ? (
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0f172a',
                        marginBottom: '6px',
                        lineHeight: 1.35,
                        wordBreak: 'break-word'
                      }}>
                        {item.caption}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#94a3b8', marginBottom: '6px' }}>
                        Visit Photo
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10.5px', color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={11} color="#94a3b8" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                      {item.uploaded_by_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={11} color="#94a3b8" />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.uploaded_by_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: 'none',
                        borderRadius: '5px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={12} />
                      <span>Zoom</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item)}
                        disabled={deletingId === item.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: '5px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: deletingId === item.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {deletingId === item.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && media[lightboxIndex] && (() => {
        const currentItem = media[lightboxIndex];
        const fullUrl = resolveImageUrl(currentItem.file_url);
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              zIndex: 99999,
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
              <div style={{ fontSize: '13px', fontWeight: '700' }}>
                Photo {lightboxIndex + 1} of {media.length}
                {currentItem.caption && (
                  <span style={{ fontWeight: '400', color: '#cbd5e1', marginLeft: '10px' }}>
                    — {currentItem.caption}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => downloadSecureFile(currentItem.file_url, currentItem.file_name || 'visit-photo.jpg')}
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
                    cursor: 'pointer'
                  }}
                  title="Download photo"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
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

            {/* Main Image View */}
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
              {media.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev - 1 + media.length) % media.length)}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              <SecureImage
                src={currentItem.file_url}
                alt={currentItem.caption || 'Visit Photo'}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}
                title=""
                onClick={(e) => e.stopPropagation()}
              />

              {media.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex((prev) => (prev + 1) % media.length)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 2
                  }}
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Bottom Details Bar */}
            <div
              style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: '#ffffff',
                fontSize: '11.5px',
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
                Use Left/Right arrow keys to navigate
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
