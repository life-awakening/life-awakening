import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, CheckSquare, RefreshCw } from 'lucide-react';
import FacultyJourneyTab from './FacultyJourneyTab';
import { useLanguage } from './context/LanguageContext';

export default function GalleryDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [token] = useState(() => localStorage.getItem('token') || '');
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  // State exposed by FacultyJourneyTab for desktop navbar actions
  const [galleryActions, setGalleryActions] = useState(null);

  const handleGalleryStateChange = useCallback((actions) => {
    setGalleryActions(actions);
  }, []);

  // Security Verification: Ensure only authorized gallery/admin users can view this panel
  useEffect(() => {
    if (!token || !currentUser || (currentUser.role !== 'gallery' && currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  }, [token, currentUser, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  if (!token || !currentUser) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#09090b',
      color: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>{`
        .gallery-header-nav {
          padding: 0 24px;
          height: 60px;
        }
        .gallery-logo {
          height: 38px;
          max-width: 140px;
        }
        .gallery-nav-desktop-actions {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .gallery-logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .gallery-logout-btn:hover {
          background-color: rgba(239, 68, 68, 0.22);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }
        @keyframes gallerySpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .gallery-spin-anim {
          animation: gallerySpin 0.9s linear infinite;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .gallery-nav-desktop-actions {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .gallery-header-nav {
            padding: 0 12px;
            height: 52px;
          }
          .gallery-logo {
            height: 28px;
            max-width: 100px;
          }
          .gallery-controls-wrap {
            gap: 8px !important;
          }
          .gallery-user-avatar {
            width: 30px !important;
            height: 30px !important;
          }
          .gallery-logout-btn {
            width: 32px !important;
            height: 32px !important;
            padding: 0 !important;
            justify-content: center !important;
            border-radius: 8px !important;
          }
          .gallery-logout-text {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Top Header Navigation Bar ────────────────────────────────────────── */}
      <header className="gallery-header-nav" style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(18, 18, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Left: LTC Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/ltc.png"
            alt="LTC Logo"
            className="gallery-logo"
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }}
          />
        </div>

        {/* Right: Controls (Select & Refresh on Desktop, User Avatar, and Compact Logout) */}
        <div className="gallery-controls-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Desktop-only: Select and Refresh buttons in Navbar */}
          {galleryActions && (
            <div className="gallery-nav-desktop-actions">
              {/* Select Mode Toggle */}
              <button
                type="button"
                onClick={galleryActions.toggleSelection}
                style={{
                  height: '32px',
                  padding: '0 13px',
                  borderRadius: '50px',
                  background: galleryActions.isSelectionMode ? '#2563EB' : 'rgba(255, 255, 255, 0.08)',
                  border: galleryActions.isSelectionMode ? '1px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!galleryActions.isSelectionMode) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                }}
                onMouseLeave={(e) => {
                  if (!galleryActions.isSelectionMode) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <CheckSquare size={13} />
                <span>{galleryActions.isSelectionMode ? t("Done") : t("Select")}</span>
                {galleryActions.isSelectionMode && galleryActions.selectedCount > 0 && (
                  <span style={{
                    background: '#FFFFFF',
                    color: '#2563EB',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    borderRadius: '20px',
                    padding: '1px 6px',
                    marginLeft: '2px'
                  }}>
                    {galleryActions.selectedCount}
                  </span>
                )}
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={galleryActions.fetchMedia}
                disabled={galleryActions.loading}
                title={t("Refresh")}
                style={{
                  height: '32px',
                  width: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: '#FFFFFF',
                  cursor: galleryActions.loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!galleryActions.loading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
                }}
                onMouseLeave={(e) => {
                  if (!galleryActions.loading) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <RefreshCw size={13} className={galleryActions.loading ? 'gallery-spin-anim' : ''} />
              </button>
            </div>
          )}

          {/* User Avatar Circle */}
          <div
            title={currentUser?.email || 'gallery@ltc.edu'}
            className="gallery-user-avatar"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
            }}
          >
            <User size={15} color="#cbd5e1" />
          </div>

          {/* Logout Button (Compact Icon-Only on Mobile, Full on Desktop) */}
          <button
            type="button"
            onClick={handleLogout}
            title={t("Logout")}
            className="gallery-logout-btn"
          >
            <LogOut size={14} />
            <span className="gallery-logout-text">{t("Logout")}</span>
          </button>
        </div>
      </header>

      {/* ── Main Full-Screen Media Gallery Panel ──────────────────────────── */}
      <main style={{
        flex: 1,
        width: '100%',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden'
      }}>
        <FacultyJourneyTab
          token={token}
          isGallery={true}
          user={currentUser}
          onGalleryStateChange={handleGalleryStateChange}
        />
      </main>
    </div>
  );
}
