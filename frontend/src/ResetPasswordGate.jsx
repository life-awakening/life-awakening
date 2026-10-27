import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';
import PasswordOtpModal from './PasswordOtpModal';
import API_BASE_URL from '@/config/apiConfig';

export default function ResetPasswordGate({ onSuccess }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  let user = null;
  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }

  // If already authenticated and password changed, skip to select-portal
  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    if (user.role === 'student' && user.password_changed) {
      navigate('/student', { replace: true });
    }
  }, [token, user?.password_changed, navigate]);

  const [gatePassForm, setGatePassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [gatePassLoading, setGatePassLoading] = useState(false);
  const [gatePassMsg, setGatePassMsg] = useState({ type: '', text: '' });
  const [gateOtpOpen, setGateOtpOpen] = useState(false);
  const [gateOtpEmail, setGateOtpEmail] = useState('');
  const [gateOtpExpiresAt, setGateOtpExpiresAt] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleGatePasswordChange = async () => {
    if (!gatePassForm.currentPassword || !gatePassForm.newPassword || !gatePassForm.confirmPassword) {
      setGatePassMsg({ type: 'error', text: t('All fields are required.') });
      return;
    }
    if (gatePassForm.newPassword.length < 6) {
      setGatePassMsg({ type: 'error', text: t('New password must be at least 6 characters.') });
      return;
    }
    if (gatePassForm.newPassword !== gatePassForm.confirmPassword) {
      setGatePassMsg({ type: 'error', text: t('New passwords do not match.') });
      return;
    }
    setGatePassLoading(true);
    setGatePassMsg({ type: '', text: '' });
    try {
      const apiBase = API_BASE_URL;
      const res = await fetch(`${apiBase}/api/student/request-password-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: gatePassForm.currentPassword,
          newPassword: gatePassForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setGateOtpEmail(data.email || '');
        setGateOtpExpiresAt(data.expiresAt);
        setGateOtpOpen(true);
      } else {
        setGatePassMsg({ type: 'error', text: t(data.message || 'Failed to request OTP.') });
      }
    } catch {
      setGatePassMsg({ type: 'error', text: t('Network error.') });
    } finally {
      setGatePassLoading(false);
    }
  };

  const handleGateVerifyOtp = async (otpCode) => {
    try {
      const apiBase = API_BASE_URL;
      const res = await fetch(`${apiBase}/api/student/verify-password-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ otp: otpCode })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Update user in localStorage
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          stored.password_changed = true;
          localStorage.setItem('user', JSON.stringify(stored));
        } catch (e) {
          console.error('Error updating localStorage user:', e);
        }

        setGateOtpOpen(false);
        setGatePassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setGatePassMsg({ type: 'success', text: t('Password changed successfully! Redirecting...') });

        if (onSuccess) {
          onSuccess();
        }

        // In Life Awakening, students always redirect directly to the LTC portal
        setTimeout(() => {
          navigate('/student', { replace: true });
        }, 500);

        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message };
      }
    } catch {
      return { success: false, message: t('Network error while verifying OTP.') };
    }
  };

  const handleGateResendOtp = async () => {
    try {
      const apiBase = API_BASE_URL;
      const res = await fetch(`${apiBase}/api/student/resend-password-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          message: data.message,
          expiresAt: data.expiresAt,
          cooldownSeconds: data.cooldownSeconds
        };
      }
      return { success: false, message: data.message };
    } catch {
      return { success: false, message: t('Network error while resending OTP.') };
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '450px',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 40px -8px rgba(0,0,0,0.12)',
        overflow: 'hidden'
      }}>
        {/* Blue Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0052cc 0%, #003da5 100%)',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={20} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>
              First Login Security
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
              Mandatory Password Change
            </h2>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px' }}>
          <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            To secure your account, you must set a personal password before accessing the dashboard.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleGatePasswordChange(); }}>
            {/* Current Password */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>{t('Current Password')}</label>
              <input
                type="password" required
                value={gatePassForm.currentPassword}
                onChange={e => setGatePassForm({...gatePassForm, currentPassword: e.target.value})}
                placeholder="Enter your current password"
                style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a', width: '100%' }}
              />
            </div>

            {/* New Password */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginBottom: '12px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>{t('New Password')}</label>
              <input
                type="password" required minLength={6}
                value={gatePassForm.newPassword}
                onChange={e => setGatePassForm({...gatePassForm, newPassword: e.target.value})}
                placeholder="At least 6 characters"
                style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a', width: '100%' }}
              />
            </div>

            {/* Confirm Password */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>{t('Confirm New Password')}</label>
              <input
                type="password" required minLength={6}
                value={gatePassForm.confirmPassword}
                onChange={e => setGatePassForm({...gatePassForm, confirmPassword: e.target.value})}
                placeholder="Repeat new password"
                style={{ border: 'none', background: 'transparent', outline: 'none', padding: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a', width: '100%' }}
              />
            </div>

            {gatePassMsg.text && (
              <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16, background: gatePassMsg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: gatePassMsg.type === 'error' ? '#991b1b' : '#166534', border: gatePassMsg.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
                {gatePassMsg.text}
              </div>
            )}

            <button type="submit" disabled={gatePassLoading} style={{ background: gatePassLoading ? '#94a3b8' : '#1d4ed8', color: '#fff', width: '100%', padding: '12px', fontWeight: '700', borderRadius: '12px', border: 'none', cursor: gatePassLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', boxShadow: gatePassLoading ? 'none' : '0 4px 10px rgba(29, 78, 216, 0.2)', transition: 'all 0.15s' }}>
              <Lock size={14} /> {gatePassLoading ? t('Sending OTP...') : t('Send Verification OTP')}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ background: '#f8fafc', padding: '14px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>
            Sign out
          </button>
        </div>
      </div>

      <PasswordOtpModal
        isOpen={gateOtpOpen}
        onClose={() => setGateOtpOpen(false)}
        emailMasked={gateOtpEmail}
        expiresAt={gateOtpExpiresAt}
        onVerify={handleGateVerifyOtp}
        onResend={handleGateResendOtp}
      />
    </div>
  );
}
