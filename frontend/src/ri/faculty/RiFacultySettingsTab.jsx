import React, { useState, useEffect, useMemo, useRef } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  KeyRound,
  Mail,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  Clock,
  Check,
  Lock
} from 'lucide-react';

const API = API_BASE_URL;

export default function RiFacultySettingsTab({
  token,
  isMobile,
  profile,
  currentUser,
  addToast
}) {
  // Wizard Step: 'request' | 'otp' | 'password' | 'success'
  const [step, setStep] = useState('request');

  // Form States
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Timers
  const [maskedEmail, setMaskedEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const otpInputRefs = useRef([]);

  const userEmail = useMemo(() => {
    return profile?.email || currentUser?.email || '';
  }, [profile, currentUser]);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || localStorage.getItem('token')}`
  }), [token]);

  // 60s Resend Cooldown Timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // 10-Minute OTP Expiry Timer
  useEffect(() => {
    if (step !== 'otp' || !expiresAt) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeRemaining(diff);
      if (diff === 0) {
        setErrorMsg('Code expired. Please request a new one.');
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [step, expiresAt]);

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: '', color: '#cbd5e1' };
    let score = 0;
    if (newPassword.length >= 6) score++;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (score <= 3) return { score: 2, label: 'Fair', color: '#f59e0b' };
    return { score: 3, label: 'Strong', color: '#10b981' };
  }, [newPassword]);

  // Step 1: Request OTP
  const handleRequestOtp = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/settings/request-password-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send verification code.');
      }

      setMaskedEmail(data.email || userEmail);
      setExpiresAt(data.expiresAt);
      setCooldown(data.cooldownSeconds || 60);
      setStep('otp');
      setSuccessMsg(data.message || 'Code sent to your email.');
      if (addToast) addToast(data.message || 'OTP sent successfully!', 'success');

      setTimeout(() => {
        if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
      }, 100);
    } catch (err) {
      setErrorMsg(err.message);
      if (addToast) addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2a: OTP Inputs
  const handleOtpDigitChange = (index, value) => {
    const rawVal = value.replace(/\D/g, '');

    // Handle full paste (e.g. 6 digits)
    if (rawVal.length > 1) {
      const digits = rawVal.slice(0, 6).split('');
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      if (otpInputRefs.current[nextIndex]) {
        otpInputRefs.current[nextIndex].focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = rawVal.slice(-1);
    setOtp(newOtp);

    if (rawVal && index < 5) {
      if (otpInputRefs.current[index + 1]) {
        otpInputRefs.current[index + 1].focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      if (otpInputRefs.current[index - 1]) {
        otpInputRefs.current[index - 1].focus();
      }
    }
  };

  // Step 2b: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/settings/resend-password-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resend code.');
      }
      setCooldown(data.cooldownSeconds || 60);
      setExpiresAt(data.expiresAt);
      setOtp(['', '', '', '', '', '']);
      setSuccessMsg('A new code has been sent.');
      if (addToast) addToast('New code sent to your email.', 'success');
      if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
    } catch (err) {
      setErrorMsg(err.message);
      if (addToast) addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2c: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join('').trim();
    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/settings/verify-password-otp`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ otp: code })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid verification code.');
      }

      setResetToken(data.resetToken || '');
      setStep('password');
      setSuccessMsg('Code verified. Set your new password.');
    } catch (err) {
      setErrorMsg(err.message);
      if (addToast) addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/settings/reset-password`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          resetToken: resetToken,
          otp: otp.join('').trim(),
          newPassword: newPassword,
          confirmPassword: confirmPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password.');
      }

      setStep('success');
      setSuccessMsg('Password updated successfully.');
      if (addToast) addToast('Password changed successfully!', 'success');
    } catch (err) {
      setErrorMsg(err.message);
      if (addToast) addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFlow = () => {
    setStep('request');
    setOtp(['', '', '', '', '', '']);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div style={{ padding: isMobile ? '12px 8px' : '20px 16px', maxWidth: '640px', margin: '0 auto' }}>
      
      {/* ── CARD: PASSWORD RESET WIZARD ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        padding: isMobile ? '16px 14px' : '24px 28px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>

        {/* Compact Stepper */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {[
            { num: 1, label: 'Request', key: 'request' },
            { num: 2, label: 'Verify', key: 'otp' },
            { num: 3, label: 'Reset', key: 'password' }
          ].map((s, idx) => {
            const isDone = (s.key === 'request' && step !== 'request') ||
                           (s.key === 'otp' && (step === 'password' || step === 'success'));
            const isCurrent = step === s.key || (step === 'success' && s.key === 'password');
            return (
              <React.Fragment key={s.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent ? '#047857' : (isDone ? '#10b981' : '#e2e8f0'),
                    color: (isCurrent || isDone) ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {isDone ? <Check size={12} /> : s.num}
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? '700' : '500',
                    color: isCurrent ? '#047857' : (isDone ? '#0f172a' : '#94a3b8')
                  }}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    margin: '0 8px',
                    backgroundColor: isDone ? '#10b981' : '#f1f5f9'
                  }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div style={{
            marginBottom: '14px',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#991b1b',
            fontSize: '12.5px'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && step !== 'success' && (
          <div style={{
            marginBottom: '14px',
            padding: '10px 12px',
            borderRadius: '8px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#065f46',
            fontSize: '12.5px'
          }}>
            <CheckCircle size={15} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── STEP 1: REQUEST ── */}
        {step === 'request' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                Reset Password
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                We'll send a 6-digit verification code to your registered email address.
              </p>
            </div>

            <div style={{
              padding: '12px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Send Code To
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px', wordBreak: 'break-all' }}>
                  {userEmail}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                ⏱️ Valid 10m
              </span>
            </div>

            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  <span>Send Verification Code</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 2: VERIFY OTP ── */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                Enter Verification Code
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                Enter the 6-digit code sent to <strong style={{ color: '#047857' }}>{maskedEmail || userEmail}</strong>
              </p>
            </div>

            {/* 6 Digit Inputs */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: isMobile ? '6px' : '10px',
              margin: '18px 0'
            }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => otpInputRefs.current[idx] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={e => handleOtpDigitChange(idx, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(idx, e)}
                  style={{
                    width: isMobile ? '38px' : '46px',
                    height: isMobile ? '46px' : '52px',
                    borderRadius: '8px',
                    border: digit ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: digit ? '#f0fdf4' : '#ffffff',
                    textAlign: 'center',
                    fontSize: isMobile ? '18px' : '22px',
                    fontWeight: '800',
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxShadow: digit ? '0 0 0 2px rgba(4, 120, 87, 0.12)' : 'none'
                  }}
                />
              ))}
            </div>

            {/* Timers & Resend */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: timeRemaining <= 60 ? '#dc2626' : '#64748b', fontWeight: '600' }}>
                <Clock size={13} />
                <span>Expires: {formatSeconds(timeRemaining)}</span>
              </div>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || loading}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: cooldown > 0 ? '#94a3b8' : '#047857',
                  fontWeight: '700',
                  cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                <span>{cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStep('request')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: (loading || otp.join('').length !== 6) ? 'not-allowed' : 'pointer',
                  opacity: (loading || otp.join('').length !== 6) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 3: RESET PASSWORD ── */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                Set New Password
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                Code verified. Choose a strong new password (minimum 6 characters).
              </p>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {newPassword && (
                <div style={{ marginTop: '5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748b', marginBottom: '2px' }}>
                    <span>Strength</span>
                    <span style={{ fontWeight: '700', color: passwordStrength.color }}>{passwordStrength.label}</span>
                  </div>
                  <div style={{ height: '3px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: passwordStrength.score === 1 ? '33%' : (passwordStrength.score === 2 ? '66%' : '100%'),
                      backgroundColor: passwordStrength.color,
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    borderRadius: '8px',
                    border: confirmPassword && newPassword === confirmPassword ? '1px solid #10b981' : '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {confirmPassword && (
                <div style={{ marginTop: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: newPassword === confirmPassword ? '#059669' : '#dc2626' }}>
                  {newPassword === confirmPassword ? (
                    <>
                      <Check size={12} />
                      <span>Passwords match</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      <span>Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setStep('otp')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: (loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Lock size={15} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 4: SUCCESS ── */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              border: '2px solid #a7f3d0'
            }}>
              <CheckCircle size={30} />
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
              Password Changed!
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 auto 18px auto', maxWidth: '340px' }}>
              Your password has been successfully updated. Use it the next time you log in.
            </p>

            <button
              type="button"
              onClick={handleResetFlow}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
