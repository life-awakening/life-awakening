import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { REQUIRE_STUDENT_PASSWORD_CHANGE } from './config/authConfig';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

export default function PortalSelector() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!token || !storedUser) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      // If student hasn't completed mandatory first-time password reset, redirect to /reset-password
      if (REQUIRE_STUDENT_PASSWORD_CHANGE && user.role === 'student' && !user.password_changed) {
        navigate('/reset-password', { replace: true });
        return;
      }
      // In Life Awakening, students always use the LTC portal
      navigate('/student', { replace: true });
      return;
    } catch {
      navigate('/login', { replace: true });
      return;
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="portal-selector-loading">
        <div className="portal-spinner" />
        <style>{`
          .portal-selector-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
          }
          .portal-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="portal-selector-container">
      {/* Top MIT-WPU Logo (Positioned at the top in both Desktop & Mobile) */}
      <div className="portal-logo-container">
        <img
          src="/mit.png"
          alt="MIT World Peace University"
          className="portal-mit-logo"
        />
      </div>

      {/* Central Portal Action Buttons Wrapper */}
      <div className="portal-buttons-wrapper">
        <div className="portal-buttons-grid">
          {/* Rural Immersion Button */}
          <button
            onClick={() => navigate('/ri-student')}
            className="portal-button-item portal-button-ri"
            aria-label="Open Rural Immersion"
          >
            <img
              src="/ri-button.png"
              alt="Open Rural Immersion"
              className="portal-button-img"
            />
          </button>

          {/* LTC Portal Button */}
          <button
            onClick={() => navigate('/student')}
            className="portal-button-item portal-button-ltc"
            aria-label="Open LTC Portal"
          >
            <img
              src="/ltc-button.png"
              alt="Open LTC Portal"
              className="portal-button-img"
            />
          </button>
        </div>
      </div>

      <style>{`
        .portal-selector-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 24px 32px 24px;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', Helvetica, Arial, sans-serif;
          position: relative;
          background-image: url('/desk.png');
          background-size: cover;
          background-position: center center;
          background-repeat: no-repeat;
        }

        .portal-logo-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          margin-top: 80px;
          z-index: 2;
        }

        .portal-mit-logo {
          width: 100%;
          max-width: 360px;
          height: auto;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.04));
        }

        .portal-buttons-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          max-width: 860px;
          z-index: 2;
          transform: translateY(50px);
        }

        .portal-buttons-grid {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 28px;
          width: 100%;
        }

        .portal-button-item {
          background: transparent;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          outline: none;
          width: 100%;
          max-width: 380px;
          display: block;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), filter 0.22s ease;
          border-radius: 24px;
          user-select: none;
        }

        .portal-button-img {
          width: 100%;
          height: auto;
          display: block;
          border-radius: 24px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
          transition: box-shadow 0.22s ease;
        }

        .portal-button-item:hover {
          transform: translateY(-3px) scale(1.02);
          filter: brightness(1.02);
        }

        .portal-button-item:hover .portal-button-img {
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.14);
        }

        .portal-button-item:active {
          transform: scale(0.98);
        }

        /* ── Mobile View: Logo 30px Upwards from Center, Buttons at Bottom ── */
        @media (max-width: 768px) {
          .portal-selector-container {
            background-image: url('/mobi.png');
            padding: calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 36px) 20px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            position: relative;
          }

          .portal-logo-container {
            position: absolute;
            top: calc(50% - 90px);
            left: 50%;
            transform: translate(-50%, -50%);
            margin-top: 0;
            width: 100%;
            max-width: 290px;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2;
          }

          .portal-mit-logo {
            width: 100%;
            max-width: 290px;
          }

          .portal-buttons-wrapper {
            flex: none;
            width: 100%;
            margin-top: auto;
            transform: none;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3;
          }

          .portal-buttons-grid {
            flex-direction: column;
            gap: 12px;
            width: 100%;
            max-width: 268px;
            align-items: center;
          }

          .portal-button-item {
            width: 100%;
            max-width: 268px;
          }

          .portal-button-img {
            width: 100%;
            border-radius: 18px;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
          }
        }
      `}</style>
    </div>
  );
}
