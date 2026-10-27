import React, { useState, useEffect, useRef } from 'react';
import { Mail, Clock, RefreshCw, Lock, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

export default function PasswordOtpModal({
  isOpen,
  onClose,
  emailMasked,
  expiresAt,
  onVerify,
  onResend,
  loading = false,
  error = '',
}) {
  const { t } = useLanguage();
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState('');
  const [resendSuccessMsg, setResendSuccessMsg] = useState('');
  const [verifySuccessMsg, setVerifySuccessMsg] = useState('');
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [timeLeft, setTimeLeft] = useState(600); // 10 mins default (600s)

  const inputRef = useRef(null);

  // Initialize and tick expiration timer
  useEffect(() => {
    if (!isOpen) return;

    // Reset fields on open
    setOtp('');
    setLocalError('');
    setResendSuccessMsg('');
    setVerifySuccessMsg('');
    setIsVerifiedSuccess(false);
    setResendCooldown(60);

    if (expiresAt) {
      const expMs = new Date(expiresAt).getTime();
      const diffSecs = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setTimeLeft(diffSecs);
    } else {
      setTimeLeft(600);
    }

    // Auto-focus input
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 150);
  }, [isOpen, expiresAt]);

  // Expiration countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, resendCooldown]);

  // Auto-close ONLY when verification succeeds
  useEffect(() => {
    if (!isOpen || !isVerifiedSuccess) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, 1600);
    return () => clearTimeout(timer);
  }, [isOpen, isVerifiedSuccess, onClose]);

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    setLocalError('');
    setResendSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (otp.length !== 6) {
      setLocalError(t('Please enter the complete 6-digit verification code.'));
      return;
    }
    if (timeLeft <= 0) {
      setLocalError(t('OTP has expired. Please click Resend OTP to get a new code.'));
      return;
    }

    setIsVerifying(true);
    setLocalError('');
    setResendSuccessMsg('');
    setVerifySuccessMsg('');
    try {
      const res = await onVerify(otp);
      if (res && res.success) {
        setVerifySuccessMsg(t(res.message || 'Password verified and updated successfully!'));
        setIsVerifiedSuccess(true);
      } else if (res && res.message) {
        setLocalError(t(res.message));
      }
    } catch (err) {
      setLocalError(t('Failed to verify OTP. Please try again.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendClick = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setLocalError('');
    setResendSuccessMsg('');
    try {
      const res = await onResend();
      if (res && res.success) {
        setResendSuccessMsg(t(res.message || 'A new verification code has been sent to your email.'));
        setResendCooldown(res.cooldownSeconds || 60);
        if (res.expiresAt) {
          const expMs = new Date(res.expiresAt).getTime();
          setTimeLeft(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
        } else {
          setTimeLeft(600);
        }
        setOtp('');
      } else if (res && res.message) {
        setLocalError(t(res.message));
      }
    } catch (err) {
      setLocalError(t('Failed to resend OTP. Please try again.'));
    } finally {
      setIsResending(false);
    }
  };

  const activeError = error || localError;

  const handleCancelClick = () => {
    if (isVerifying) return;
    if (otp.length > 0 && timeLeft > 0) {
      if (window.confirm(t('Are you sure you want to cancel email verification?'))) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay otp-modal-overlay"
      style={{
        zIndex: 9999,
        backgroundColor: '#ffffff',
        backdropFilter: 'none',
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        .otp-modal-box {
          max-width: 450px;
          width: 100%;
          border-radius: 20px;
          padding: 0;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
          background: #ffffff;
          animation: modalFadeIn 0.2s ease-out;
          box-sizing: border-box;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .otp-input-control {
          width: 100%;
          border: none;
          background: transparent;
          outline: none;
          padding: 0;
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 8px;
          text-align: center;
          font-family: monospace;
          box-sizing: border-box;
          color: #0f172a;
          caret-color: #1d4ed8;
        }

        .otp-input-control::placeholder {
          color: #cbd5e1;
          letter-spacing: 6px;
        }

        .otp-action-row {
          display: flex;
          gap: 10px;
        }

        @media (max-width: 480px) {
          .otp-modal-box {
            border-radius: 16px !important;
          }
          .otp-input-control {
            font-size: 20px !important;
            letter-spacing: 6px !important;
          }
          .otp-action-row {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .otp-action-row button {
            width: 100% !important;
            flex: none !important;
          }
        }
      `}</style>

      <div
        className="modal otp-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
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
              {t('Email Verification')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancelClick}
            disabled={isVerifying}
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
              cursor: isVerifying ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: '24px 28px 20px', boxSizing: 'border-box' }}>
            {/* OTP Input Card Field */}
            <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: '14px', border: activeError ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1', marginBottom: '16px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
                {t('Enter 6-Digit OTP')}
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                disabled={isVerifying || isVerifiedSuccess}
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                className="otp-input-control"
              />
            </div>

            {/* Timers & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '13px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: timeLeft > 60 ? '#64748b' : '#dc2626', fontWeight: '600', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <Clock size={15} />
                <span>{timeLeft > 0 ? `${t('Expires in')} ${formatTime(timeLeft)}` : t('OTP Expired')}</span>
              </div>

              <button
                type="button"
                onClick={handleResendClick}
                disabled={resendCooldown > 0 || isResending || isVerifying}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCooldown > 0 || isResending ? '#94a3b8' : '#2563eb',
                  padding: '4px 0',
                  fontWeight: '700',
                  cursor: resendCooldown > 0 || isResending || isVerifying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <RefreshCw size={14} className={isResending ? 'spin' : ''} />
                {resendCooldown > 0 ? `${t('Resend in')} ${resendCooldown}s` : t('Resend OTP')}
              </button>
            </div>

            {/* Feedback Messages */}
            {activeError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{activeError}</span>
              </div>
            )}

            {resendSuccessMsg && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{resendSuccessMsg}</span>
              </div>
            )}

            {verifySuccessMsg && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>{verifySuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div style={{ background: '#f8fafc', padding: '16px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', boxSizing: 'border-box' }} className="otp-action-row">
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isVerifying}
              style={{ padding: '10px 20px', background: '#ffffff', color: '#475569', fontWeight: '700', borderRadius: '12px', border: '1px solid #cbd5e1', cursor: isVerifying ? 'not-allowed' : 'pointer', fontSize: '13.5px', transition: 'all 0.15s', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={isVerifying || loading || otp.length !== 6 || timeLeft <= 0 || isVerifiedSuccess}
              style={{
                padding: '10px 24px',
                background: otp.length === 6 && timeLeft > 0 && !isVerifying && !isVerifiedSuccess ? '#1d4ed8' : '#94a3b8',
                color: '#ffffff',
                fontWeight: '750',
                borderRadius: '12px',
                border: 'none',
                cursor: otp.length === 6 && timeLeft > 0 && !isVerifying && !isVerifiedSuccess ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '13.5px',
                boxShadow: otp.length === 6 && timeLeft > 0 && !isVerifying && !isVerifiedSuccess ? '0 4px 10px rgba(29, 78, 216, 0.2)' : 'none',
                transition: 'all 0.15s',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}
            >
              {isVerifying ? (
                <>
                  <div className="spinner spinner-sm" style={{ borderTopColor: '#ffffff' }} />
                  {t('Verifying...')}
                </>
              ) : (
                t('Verify & Update')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
