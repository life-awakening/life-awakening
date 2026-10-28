import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, KeyRound, CheckCircle, RefreshCw, X, Lock } from 'lucide-react';

export default function DatabaseResetFlowModal({ isOpen, onClose, onSuccess, apiBase, token }) {
  // Modal flow phases: 1: 'request', 2: 'verify_otp', 3: 'confirm_reset', 4: 'success'
  const [phase, setPhase] = useState(1);

  // Form states
  const [otp, setOtp] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [resetSessionToken, setResetSessionToken] = useState(null);
  const [sentToEmail, setSentToEmail] = useState('ahsanimamkhan06@gmail.com');

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
    setOtp('');
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


  // Request Single OTP
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
        throw new Error(data.message || 'Failed to request verification code.');
      }

      if (data.targetEmail || data.maskedEmail) {
        setSentToEmail(data.targetEmail || data.maskedEmail);
      }

      // Transition to Phase 2 (Enter OTP interface)
      setPhase(2);
      setCountdown(data.expiresInSeconds || 600);
      setResendCooldown(data.resendCooldownSeconds || 60);
      setAttemptsLeft(5);
      setOtp('');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify Single OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit Security Verification Code.');
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
        body: JSON.stringify({ otp: otp.trim(), otp1: otp.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.attemptsLeft !== undefined) {
          setAttemptsLeft(data.attemptsLeft);
        }
        throw new Error(data.message || 'Invalid verification code.');
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
                  Resetting the database will permanently delete all batch and student application data.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '11.5px',
                      color: '#991b1b'
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#b91c1c' }}>✕ Permanently Deleted:</strong>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.5 }}>
                      <li>All Batches and Squad assignments</li>
                      <li>All Student accounts and Parent links</li>
                      <li>Attendance records, sessions, and activity logs</li>
                      <li>Parent / Guardian Consent & Medical Undertakings</li>
                      <li>Evaluations, grades, feedback, and certificates</li>
                    </ul>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '11.5px',
                      color: '#166534'
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#15803d' }}>✓ Strictly Preserved:</strong>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.5 }}>
                      <li><strong>LAP Timetable Schedules</strong> (Preserved master timetable)</li>
                      <li>Administrator & Super Administrator accounts</li>
                      <li>Faculty member accounts</li>
                      <li>System configuration & registration settings</li>
                      <li>Email communication templates & Audit logs</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                To authorize this action, a security verification code will be dispatched to:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontWeight: '600', color: '#1e293b' }}>
                  <li>{sentToEmail}</li>
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
                {loading ? 'Sending Security Code...' : 'Send Security Verification Code'}
              </button>
            </div>
          )}

          {/* PHASE 2: Single OTP Verification */}
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
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Verification Code Sent</span>
                  <span style={{ color: countdown < 60 ? '#dc2626' : '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                    Expires in: {formatTime(countdown)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                  Please enter the 6-digit code sent to authorized administrator ({sentToEmail}).
                </p>
                {attemptsLeft < 5 && (
                  <div style={{ marginTop: '8px', color: '#dc2626', fontWeight: '700', fontSize: '11.5px' }}>
                    Warning: {attemptsLeft} attempts remaining before session invalidation.
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Security Verification Code (Sent to {sentToEmail})
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
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
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || countdown === 0}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: otp.length === 6 && countdown > 0 ? '#154388' : '#94a3b8',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: otp.length === 6 && countdown > 0 && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                  {loading ? 'Verifying Code...' : 'Verify Code & Proceed'}
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
                <p style={{ margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  This action will permanently delete all batches, attendance, undertakings, evaluations, and <strong>all student accounts</strong> from the database.
                </p>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 12px', fontSize: '11.5px', color: '#7f1d1d', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '700' }}>Will be deleted:</span> Batches, Student accounts, Parent links, Attendance, Undertakings, Evaluations, Feedback, Tickets.
                  <br />
                  <span style={{ fontWeight: '700', color: '#166534' }}>Will be preserved:</span> <strong>LAP Timetable Schedules</strong>, Administrators, Faculty accounts, App Settings, and Templates.
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#991b1b' }}>
                  To permanently execute the database reset, type the confirmation phrase below:
                </p>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px', color: '#7f1d1d', background: '#fee2e2', padding: '6px 10px', borderRadius: '6px', textAlign: 'center', letterSpacing: '1px' }}>
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
