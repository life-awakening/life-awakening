import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, KeyRound, CheckCircle, RefreshCw, X, Lock } from 'lucide-react';

export default function DatabaseResetFlowModal({ isOpen, onClose, onSuccess, apiBase, token }) {
  // Modal flow phases: 1: 'request', 2: 'verify_otp', 3: 'confirm_reset', 4: 'success'
  const [phase, setPhase] = useState(1);

  // Form states
  const [otp1, setOtp1] = useState('');
  const [otp2, setOtp2] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [resetSessionToken, setResetSessionToken] = useState(null);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // Timers
  const [countdown, setCountdown] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(0); // 60s cooldown


  // Reset local state when modal closes
  const handleClose = () => {
    if (loading) return;
    setPhase(1);
    setOtp1('');
    setOtp2('');
    setConfirmationInput('');
    setResetSessionToken(null);
    setErrorMessage('');
    setAttemptsLeft(5);
    setCountdown(600);
    setResendCooldown(0);
    onClose();
  };

  // Timer interval for OTP expiration & resend cooldown
  useEffect(() => {
    let timer;
    if (isOpen && phase === 2) {
      timer = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : 0));
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, phase]);


  // Request Dual OTPs
  const handleRequestOtp = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${apiBase}/api/superadmin/reset-database/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to request verification codes.');
      }

      // TEMPORARY BYPASS: If Dual-OTP is bypassed, skip directly to confirmation phase
      if (data.bypassed && data.resetSessionToken) {
        setResetSessionToken(data.resetSessionToken);
        setPhase(3);
        return;
      }

      setPhase(2);
      setCountdown(data.expiresInSeconds || 600);
      setResendCooldown(data.resendCooldownSeconds || 60);
      setAttemptsLeft(5);
      setOtp1('');
      setOtp2('');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify Both OTPs
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otp1 || !otp2) {
      setErrorMessage('Both Verification Code #1 and Verification Code #2 are required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${apiBase}/api/superadmin/reset-database/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ otp1: otp1.trim(), otp2: otp2.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.attemptsLeft !== undefined) {
          setAttemptsLeft(data.attemptsLeft);
        }
        throw new Error(data.message || 'Invalid verification codes.');
      }

      // Store raw token strictly in component memory
      setResetSessionToken(data.resetSessionToken);
      setPhase(3);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute Destructive Reset
  const handleExecuteReset = async () => {
    if (confirmationInput !== 'RESET DATABASE') {
      setErrorMessage('You must type exactly "RESET DATABASE" to confirm.');
      return;
    }
    if (!resetSessionToken) {
      setErrorMessage('Missing security session token. Please re-verify codes.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`${apiBase}/api/superadmin/reset-database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          resetSessionToken,
          confirmation: 'RESET DATABASE'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Database reset execution failed.');
      }

      setPhase(4);
      setTimeout(() => {
        handleClose();
        if (onSuccess) onSuccess();
      }, 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #fecaca',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#991b1b' }}>
                Danger Zone: Secure Database Reset
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#b91c1c' }}>
                Multi-Party Authorization & Zero-Trust Verification
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#991b1b',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMessage && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PHASE 1: Initial Warning & Request OTPs */}
          {phase === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '13px',
                  color: '#881337',
                  lineHeight: 1.5
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} style={{ color: '#e11d48' }} /> IRREVERSIBLE DESTRUCTIVE OPERATION
                </div>
                <p style={{ margin: '0 0 10px 0' }}>
                  Resetting the database will permanently delete all student accounts, batches, timetable schedules, attendance records, evaluations, tickets, and submitted media files.
                </p>
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fda4af',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: '#0f172a'
                  }}
                >
                  <strong style={{ color: '#166534' }}>✓ Preserved:</strong> Administrator, Super Administrator, and Support Panel accounts, audit logs, and core system settings will remain intact.
                </div>
              </div>

              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                To authorize this action, two independent verification codes will be dispatched to:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontWeight: '600', color: '#1e293b' }}>
                  <li>ahsanimamkhan06@gmail.com</li>
                  <li>nk120104@gmail.com</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                style={{
                  marginTop: '8px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                }}
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                {loading ? 'Sending Security Codes...' : 'Send Security Verification Codes'}
              </button>
            </div>
          )}

          {/* PHASE 2: Dual OTP Verification */}
          {phase === 2 && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '12.5px',
                  color: '#334155'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Verification Codes Sent</span>
                  <span style={{ color: countdown < 60 ? '#dc2626' : '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                    Expires in: {formatTime(countdown)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                  Please enter the 6-digit codes sent to both authorized administrators.
                </p>
                {attemptsLeft < 5 && (
                  <div style={{ marginTop: '8px', color: '#dc2626', fontWeight: '700', fontSize: '11.5px' }}>
                    Warning: {attemptsLeft} attempts remaining before session invalidation.
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Code #1 (Sent to ahsanimamkhan06@gmail.com)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp1}
                  onChange={(e) => setOtp1(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Code #2 (Sent to nk120104@gmail.com)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp2}
                  onChange={(e) => setOtp2(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading || resendCooldown > 0}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: resendCooldown > 0 ? '#94a3b8' : '#334155',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: resendCooldown > 0 || loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Codes'}
                </button>
                <button
                  type="submit"
                  disabled={loading || otp1.length !== 6 || otp2.length !== 6 || countdown === 0}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: otp1.length === 6 && otp2.length === 6 && countdown > 0 ? '#154388' : '#94a3b8',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: otp1.length === 6 && otp2.length === 6 && countdown > 0 && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                  {loading ? 'Verifying Codes...' : 'Verify Both Codes'}
                </button>
              </div>
            </form>
          )}

          {/* PHASE 3: Final Destructive Confirmation */}
          {phase === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '10px',
                  padding: '16px',
                  color: '#991b1b',
                  fontSize: '13px'
                }}
              >
                <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={18} style={{ color: '#dc2626' }} /> FINAL DESTRUCTIVE CONFIRMATION
                </div>
                <p style={{ margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  Dual-party verification successful. To permanently execute the database reset, type the confirmation phrase below:
                </p>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px', color: '#7f1d1d' }}>
                  RESET DATABASE
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                  Type "RESET DATABASE" to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="RESET DATABASE"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={confirmationInput !== 'RESET DATABASE' || loading}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: confirmationInput === 'RESET DATABASE' && !loading ? '#dc2626' : '#fca5a5',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: confirmationInput === 'RESET DATABASE' && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                  {loading ? 'Executing Reset...' : 'Permanently Reset Database'}
                </button>
              </div>
            </div>
          )}

          {/* PHASE 4: Success Message */}
          {phase === 4 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 12px',
                textAlign: 'center',
                gap: '12px'
              }}
            >
              <CheckCircle size={48} style={{ color: '#16a34a' }} />
              <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#166534' }}>
                Database Reset Completed
              </h4>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                Application data has been wiped. Administrator, Super Administrator, and Support Panel accounts remain preserved.
              </p>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                Redirecting and refreshing dashboard...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
