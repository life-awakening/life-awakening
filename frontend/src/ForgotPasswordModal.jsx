import React, { useState, useEffect } from 'react';
import { Mail, Lock, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Check, ArrowLeft, X } from 'lucide-react';
import PasswordOtpModal from './PasswordOtpModal';
import API_BASE_URL from '@/config/apiConfig';

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '', onPasswordResetSuccess }) {
  const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [emailMasked, setEmailMasked] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const apiBase = API_BASE_URL;

  // Sync initial email when modal opens
  useEffect(() => {
    if (isOpen) {
      setForgotEmail(initialEmail || '');
      setResetStep(1);
      setError('');
      setSuccessMsg('');
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  // Real-time password requirement checks
  const passChecks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const isPasswordValid =
    passChecks.length &&
    passChecks.upper &&
    passChecks.lower &&
    passChecks.number &&
    passChecks.special &&
    passChecks.match;

  // Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!forgotEmail || !forgotEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.replace(/\s+/g, '') }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send verification code.');
      }

      setEmailMasked(data.emailMasked || forgotEmail);
      setExpiresAt(data.expiresAt || '');
      setResetStep(2); // Advance to OTP verification
    } catch (err) {
      setError(err.message || 'An error occurred while requesting OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 OTP Verification Handlers (passed into PasswordOtpModal)
  const handleVerifyOtp = async (otpCode) => {
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), otp: otpCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.message || 'Invalid verification code.' };
      }

      setResetToken(data.resetToken);
      setResetStep(3); // Advance to New Password creation
      return { success: true, message: 'OTP verified successfully!' };
    } catch (err) {
      return { success: false, message: 'Network error verifying code.' };
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await fetch(`${apiBase}/api/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, message: data.message || 'Failed to resend code.' };
      }
      return {
        success: true,
        message: 'A new 6-digit code has been sent to your email.',
        cooldownSeconds: data.cooldownSeconds || 60,
        expiresAt: data.expiresAt,
      };
    } catch (err) {
      return { success: false, message: 'Network error resending code.' };
    }
  };

  // Step 3: Submit New Password
  const handleResetPasswordSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!isPasswordValid) {
      setError('Please satisfy all password complexity requirements.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/forgot-password/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      setSuccessMsg(data.message || 'Password reset successfully!');
      setResetStep(4); // Success screen

      setTimeout(() => {
        if (onPasswordResetSuccess) {
          onPasswordResetSuccess(forgotEmail);
        }
        onClose();
      }, 2200);
    } catch (err) {
      setError(err.message || 'An error occurred while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Step 2: Render Production-Grade PasswordOtpModal */}
      {resetStep === 2 && (
        <PasswordOtpModal
          isOpen={resetStep === 2}
          onClose={() => setResetStep(1)}
          emailMasked={emailMasked}
          expiresAt={expiresAt}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          loading={loading}
          error={error}
        />
      )}

      {/* Steps 1, 3 & 4 Modal */}
      {resetStep !== 2 && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 9999,
            backgroundColor: '#ffffff',
            backdropFilter: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'fixed',
            inset: 0,
            padding: '16px',
            boxSizing: 'border-box',
            overflowY: 'auto'
          }}
          onClick={(e) => e.target === e.currentTarget && resetStep !== 4 && onClose()}
        >
          <style>{`
            .forgot-modal-box {
              max-width: 450px;
              width: 100%;
              border-radius: 20px;
              padding: 0;
              box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
              background: #ffffff;
              animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
              box-sizing: border-box;
              max-height: 90vh;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }

            .pass-req-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 6px;
              font-size: 12px;
            }

            .forgot-btn-row {
              display: flex;
              gap: 10px;
            }

            @media (max-width: 480px) {
              .forgot-modal-box {
                border-radius: 16px !important;
              }
              .pass-req-grid {
                grid-template-columns: 1fr !important;
                gap: 8px !important;
              }
              .forgot-btn-row {
                flex-direction: column !important;
                gap: 10px !important;
              }
              .forgot-btn-row button {
                width: 100% !important;
                flex: none !important;
              }
            }
          `}</style>

          <div className="modal forgot-modal-box">
            {/* Blue Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0052cc 0%, #003da5 100%)',
              padding: '24px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxSizing: 'border-box',
              color: '#ffffff'
            }}>
              <div>
                <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  Password Recovery
                </span>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '850', color: '#ffffff', letterSpacing: '-0.3px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {resetStep === 1 ? 'Forgot Password?' : resetStep === 3 ? 'Choose New Password' : 'Reset Complete'}
                </h3>
              </div>
              {resetStep !== 4 && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.16)',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Step 1: Request Password Reset */}
            {resetStep === 1 && (
              <form onSubmit={handleRequestOtp}>
                <div style={{ padding: '28px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#eff6ff', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', flexShrink: 0 }}>
                      <KeyRound size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: '750', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Verification Required
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Enter email to receive security code
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '13px' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}

                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '14px', border: '1.5px solid #cbd5e1', transition: 'all 0.2s', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Registered Email Address
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Mail size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value.replace(/\s+/g, ''))}
                        placeholder="e.g. user@mitwpu.edu.in"
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          padding: 0,
                          margin: 0,
                          fontSize: '14.5px',
                          fontWeight: '600',
                          color: '#0f172a',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div style={{ background: '#f8fafc', padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', boxSizing: 'border-box' }} className="forgot-btn-row">
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '10px 20px', background: '#ffffff', color: '#475569', fontWeight: '700', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '13.5px', transition: 'all 0.15s', fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !forgotEmail}
                    style={{
                      padding: '10px 24px',
                      background: loading || !forgotEmail ? '#94a3b8' : '#1d4ed8',
                      color: '#ffffff',
                      fontWeight: '750',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: loading || !forgotEmail ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: loading || !forgotEmail ? 'none' : '0 4px 10px rgba(29, 78, 216, 0.2)',
                      transition: 'all 0.15s',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        Sending...
                      </>
                    ) : (
                      'Send Code'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Create New Password */}
            {resetStep === 3 && (
              <form onSubmit={handleResetPasswordSubmit}>
                <div style={{ padding: '28px', boxSizing: 'border-box', maxHeight: '55vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#eff6ff', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', flexShrink: 0 }}>
                      <Lock size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15.5px', fontWeight: '750', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Set New Password
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Choose a strong security password
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '13px' }}>
                      <AlertCircle size={18} style={{ flexShrink: 0 }} />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* New Password Input Box */}
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', marginBottom: '14px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      New Password
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Lock size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          padding: 0,
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#0f172a',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Input Box */}
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: confirmPassword && !passChecks.match ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1', marginBottom: '16px', display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Confirm New Password
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Lock size={15} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          padding: 0,
                          margin: 0,
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#0f172a',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                      >
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Password requirements block */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Password Requirements:
                    </p>
                    <div className="pass-req-grid">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.length ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.length ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>8+ Characters</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.upper ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.upper ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>Uppercase (A-Z)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.lower ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.lower ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>Lowercase (a-z)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.number ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.number ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>Number (0-9)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.special ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.special ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>Special Symbol</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passChecks.match ? '#166534' : '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {passChecks.match ? <Check size={14} color="#166534" /> : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #cbd5e1' }} />}
                        <span>Passwords Match</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Section */}
                <div style={{ background: '#f8fafc', padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', boxSizing: 'border-box' }} className="forgot-btn-row">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    style={{ padding: '10px 20px', background: '#ffffff', color: '#475569', fontWeight: '700', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '13.5px', transition: 'all 0.15s', fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !isPasswordValid}
                    style={{
                      padding: '10px 24px',
                      background: loading || !isPasswordValid ? '#94a3b8' : '#1d4ed8',
                      color: '#ffffff',
                      fontWeight: '750',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: loading || !isPasswordValid ? 'not-allowed' : 'pointer',
                      fontSize: '13.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: loading || !isPasswordValid ? 'none' : '0 4px 10px rgba(29, 78, 216, 0.2)',
                      transition: 'all 0.15s',
                      fontFamily: 'system-ui, -apple-system, sans-serif'
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        Saving...
                      </>
                    ) : (
                      'Save Password'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Success Badge */}
            {resetStep === 4 && (
              <div>
                <div style={{ padding: '28px', boxSizing: 'border-box', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#166534' }}>
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Success!
                  </h3>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: '1.5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {successMsg || 'Your password has been successfully updated.'}
                  </p>
                </div>
                {/* Footer Section */}
                <div style={{ background: '#f8fafc', padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', boxSizing: 'border-box' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '10px 24px', background: '#1d4ed8', color: '#ffffff', fontWeight: '750', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13.5px', boxShadow: '0 4px 10px rgba(29, 78, 216, 0.2)', transition: 'all 0.15s', fontFamily: 'system-ui, -apple-system, sans-serif' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
