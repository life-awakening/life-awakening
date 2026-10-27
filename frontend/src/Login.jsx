import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff, ShieldCheck, Mail, ArrowRight } from 'lucide-react'
import lottie from 'lottie-web'
import ForgotPasswordModal from './ForgotPasswordModal'
import independenceDayAnimation from './assets/Happy Independence Day.json'
import { REQUIRE_STUDENT_PASSWORD_CHANGE } from './config/authConfig'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function IndependenceDaySplash({ onComplete }) {
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleDone = () => {
    if (animRef.current) {
      animRef.current.destroy();
      animRef.current = null;
    }
    if (onCompleteRef.current) onCompleteRef.current();
  };

  useEffect(() => {
    let completed = false;

    const onAnimDone = () => {
      if (!completed) {
        completed = true;
        handleDone();
      }
    };

    if (containerRef.current) {
      try {
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          animationData: independenceDayAnimation
        });

        if (animRef.current) {
          animRef.current.addEventListener('complete', onAnimDone);
        }
      } catch (e) {
        console.error('Lottie animation load error:', e);
        onAnimDone();
      }
    }

    const timer = setTimeout(onAnimDone, 4500);

    return () => {
      clearTimeout(timer);
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#ffffff',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      {/* Top Right Skip Button */}
      <button
        type="button"
        onClick={handleDone}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 1000000,
          background: '#f8fafc',
          color: '#475569',
          border: '1.5px solid #e2e8f0',
          borderRadius: '50px',
          padding: '8px 18px',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f1f5f9';
          e.currentTarget.style.color = '#0f172a';
          e.currentTarget.style.borderColor = '#cbd5e1';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#f8fafc';
          e.currentTarget.style.color = '#475569';
          e.currentTarget.style.borderColor = '#e2e8f0';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span>Skip</span>
        <span style={{ fontSize: '15px', lineHeight: '1', fontWeight: '800' }}>›</span>
      </button>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '520px',
          maxHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
}

function isIndependenceDay2026IST() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date()) === '2026-08-15';
  } catch {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (5.5 * 3600000));
    return (
      ist.getFullYear() === 2026 &&
      ist.getMonth() === 7 &&
      ist.getDate() === 15
    );
  }
}

function isEligibleIndependenceDayRole(role) {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  if (r === 'student') return false;
  return [
    'superadmin',
    'superadmin_readonly',
    'admin',
    'admin_readonly',
    'ltc_member',
    'ltc_coordinator',
    'faculty',
    'support',
    'jeeten'
  ].includes(r);
}

function RobotCheckbox({ verified, onChange }) {
  const [checking, setChecking] = useState(false);

  const handleClick = () => {
    if (verified) {
      onChange(false);
      return;
    }
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      onChange(true);
    }, 800);
  };

  return (
    <div 
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        border: '1.5px solid #d1d5db',
        borderRadius: '12px',
        padding: '11px 18px',
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={e => e.currentTarget.style.borderColor = '#94a3b8'}
      onMouseOut={e => e.currentTarget.style.borderColor = '#d1d5db'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div 
          style={{
            width: '22px',
            height: '22px',
            border: '2px solid',
            borderColor: verified ? '#10b981' : '#94a3b8',
            borderRadius: '4px',
            background: verified ? '#10b981' : '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.2s ease',
            boxSizing: 'border-box'
          }}
        >
          {checking && (
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #0048ba',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spinCheck 0.6s linear infinite'
            }} />
          )}
          {verified && !checking && (
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'bounceCheck 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b' }}>I'm not a robot</span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', opacity: 0.9 }}>
        <ShieldCheck size={20} color="#0048ba" />
        <span style={{ fontSize: '8px', color: '#0048ba', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security</span>
      </div>

      <style>{`
        @keyframes spinCheck {
          to { transform: rotate(360deg); }
        }
        @keyframes bounceCheck {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(false)
  const [pendingTargetRoute, setPendingTargetRoute] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!captchaVerified) {
      setError("Please check the 'I'm not a robot' box.")
      return
    }

    setLoading(true)

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res = await fetch(`${apiBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.replace(/\s+/g, ''), password })
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Clear previous user session cache to prevent program state leakage between users
      try {
        const prevUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (prevUser.id && prevUser.id !== data.user.id) {
          localStorage.removeItem('readScheduleIds');
        }
      } catch (e) {}

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      const isPerfAdmin = data.user.is_performance_admin || (Array.isArray(data.user.performance_roles) && data.user.performance_roles.length > 0);
      const isPrePostAdmin = data.user.is_pre_post_admin;

      // Calculate student destination: Life Awakening students always route directly to LTC student portal
      let studentTargetRoute = '/student';
      if (data.user.role === 'student' || data.user.role === 'ri_student') {
        if (REQUIRE_STUDENT_PASSWORD_CHANGE && !data.user.password_changed) {
          studentTargetRoute = '/reset-password';
        } else {
          studentTargetRoute = '/student';
        }
      }

      // RI Eligible Roles: faculty, ri_faculty, ri_nodal_officer, nodal_officer
      const isRiEligibleRole = ['ri_faculty', 'ri_nodal_officer', 'nodal_officer', 'faculty'].includes(data.user.role);
      let riTargetRoute = null;

      if (isRiEligibleRole) {
        try {
          const wsRes = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`
            }
          });

          if (!wsRes.ok) {
            throw new Error(`Failed to check RI workspaces (HTTP ${wsRes.status})`);
          }

          const wsData = await wsRes.json();
          const facAssignments = wsData.faculty_assignments || [];
          const nodAssignments = wsData.nodal_assignments || [];
          const totalCount = wsData.total_count ?? (facAssignments.length + nodAssignments.length);

          if (totalCount > 1) {
            // Case 1: Faculty + Nodal Officer assignments
            // Case 2: Multiple Faculty assignments
            // Case 3: Multiple Nodal Officer assignments
            riTargetRoute = '/ri-workspaces';
          } else if (totalCount === 1) {
            // Case 4: Exactly one RI assignment -> directly open corresponding dashboard
            const onlyFac = facAssignments[0];
            const onlyNod = nodAssignments[0];
            if (onlyFac) {
              localStorage.setItem('ri_active_workspace', JSON.stringify({ ...onlyFac, type: 'faculty' }));
              riTargetRoute = `/ri-faculty?batch_id=${onlyFac.batch_id}&panel_id=${onlyFac.panel_id}`;
            } else if (onlyNod) {
              localStorage.setItem('ri_active_workspace', JSON.stringify({ ...onlyNod, type: 'nodal_officer' }));
              riTargetRoute = `/ri-nodal-officer?batch_id=${onlyNod.batch_id}&panel_id=${onlyNod.panel_id}`;
            } else {
              riTargetRoute = '/ri-workspaces';
            }
          } else {
            // Case 5: 0 RI assignments
            if (data.user.role === 'faculty') {
              // Pure LTC Faculty
              riTargetRoute = '/faculty';
            } else {
              // Account has an RI role assigned in users table, but 0 panel assignments in matrix
              riTargetRoute = '/ri-workspaces';
            }
          }
        } catch (wsErr) {
          console.error('[Login] Error fetching authorized RI workspaces:', wsErr);
          if (data.user.role === 'faculty') {
            riTargetRoute = '/faculty';
          } else {
            riTargetRoute = '/ri-workspaces';
          }
        }
      }

      if (data.user.role === 'parent') {
        const childrenList = Array.isArray(data.children) ? data.children : [];
        localStorage.setItem('parent_children', JSON.stringify(childrenList));
        if (childrenList.length === 1) {
          localStorage.setItem('selectedStudentId', String(childrenList[0].id));
          localStorage.setItem('selectedStudent', JSON.stringify(childrenList[0]));
        }
      }

      const isSingleChildParent = data.user.role === 'parent' && Array.isArray(data.children) && data.children.length === 1;

      const targetRoute = isPerfAdmin
        ? '/performance-admin'
        : (data.user.role === 'superadmin' || data.user.role === 'superadmin_readonly' || isPrePostAdmin)
          ? '/superadmin'
          : (data.user.role === 'superadmin-ri' || data.user.role === 'superadmin_ri_readonly' || data.user.role === 'superadmin-ri-readonly')
            ? '/ri-superadmin'
            : (data.user.role === 'gallery')
              ? '/gallery'
              : (data.user.role === 'ri_admin')
                ? '/ri-admin'
                : (data.user.role === 'parent')
                  ? (isSingleChildParent ? '/student' : '/select-child')
                  : isRiEligibleRole
                    ? riTargetRoute
                    : (data.user.role === 'student')
                      ? studentTargetRoute
                      : `/${data.user.role}`;

      if (isIndependenceDay2026IST() && isEligibleIndependenceDayRole(data.user.role)) {
        setPendingTargetRoute(targetRoute)
        setShowSplash(true)
      } else {
        navigate(targetRoute)
      }

    } catch (err) {
      setError(err.message)
      setCaptchaVerified(false)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setEmail('')
    setPassword('')
    setError('')
    setCaptchaVerified(false)
  }

  if (showSplash) {
    return (
      <IndependenceDaySplash
        onComplete={() => {
          if (pendingTargetRoute) {
            navigate(pendingTargetRoute, { replace: true })
          }
        }}
      />
    )
  }

  return (
    <div className="login-page-container">
      <style>{`
        .login-page-container {
          min-height: 100vh;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #eef5fc 0%, #d8e6f5 100%);
          padding: 30px 16px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          position: relative;
        }
        
        .login-card {
          display: flex;
          width: 90%;
          max-width: 1040px;
          min-height: 590px;
          background: #ffffff;
          border-radius: 28px;
          box-shadow: 0 20px 60px rgba(15, 45, 90, 0.12), 0 4px 20px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          box-sizing: border-box;
        }
        
        .login-left {
          flex: 1.34;
          background: url('/log-awak.jpeg') center center / cover no-repeat;
          padding: 38px 46px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: flex-start;
          position: relative;
          box-sizing: border-box;
        }
        
        .login-right {
          flex: 1;
          background: #ffffff;
          padding: 38px 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        
        .login-form-wrapper {
          width: 100%;
          max-width: 350px;
        }
        
        .solid-logo-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 12px 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          align-self: flex-start;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        }

        .login-logo-img {
          height: 80px;
          width: auto;
          max-width: 100%;
          object-fit: contain;
          display: block;
        }
        
        .branding-text-container {
          margin: auto 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .login-brand-title {
          font-size: 36px;
          font-weight: 850;
          line-height: 1.15;
          color: #ffffff;
          letter-spacing: -0.6px;
          margin: 0;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
        }

        .login-brand-and {
          font-size: 26px;
          font-weight: 400;
          color: #ffffff;
          margin: 3px 0 5px 0;
          line-height: 1.1;
        }

        .login-brand-accent-bar {
          width: 90px;
          height: 6px;
          background: #ea580c;
          border-radius: 4px;
          margin-top: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        
        .login-pill-input-group {
          margin-bottom: 16px;
        }
        
        .login-field-label {
          display: block;
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 750;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .login-pill-input-container {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 50px;
          padding: 0 18px;
          height: 48px;
          transition: all 0.2s ease;
        }
        
        .login-pill-input-container:focus-within {
          border-color: #ea580c;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12);
        }
        
        .login-pill-icon {
          color: #94a3b8;
          margin-right: 12px;
          flex-shrink: 0;
          transition: color 0.2s ease;
        }
        
        .login-pill-input-container:focus-within .login-pill-icon {
          color: #ea580c;
        }
        
        .login-pill-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          height: 100%;
          font-size: 14px;
          color: #0f172a;
          font-weight: 500;
        }
        
        .login-pill-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        
        .login-btn-primary {
          background: #ea580c;
          color: #ffffff;
          border: none;
          border-radius: 50px;
          height: 48px;
          font-size: 14.5px;
          font-weight: 750;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(234, 88, 12, 0.22);
        }
        
        .login-btn-primary:hover {
          background: #c2410c;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(234, 88, 12, 0.32);
        }
        
        .login-btn-primary:active {
          transform: translateY(0);
        }
        
        .login-btn-secondary {
          background: #ffffff;
          color: #0048ba;
          border: 1.5px solid #0048ba;
          border-radius: 50px;
          height: 48px;
          font-size: 14.5px;
          font-weight: 750;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        
        .login-btn-secondary:hover {
          background: rgba(0, 72, 186, 0.05);
        }
        
        .login-btn-secondary:active {
          background: rgba(0, 72, 186, 0.1);
        }

        .login-btn-row {
          display: flex;
          gap: 14px;
          margin-top: 8px;
        }
        
        .login-forgot-link {
          color: #0048ba;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          display: inline-block;
          transition: color 0.2s ease;
        }
        
        .login-forgot-link:hover {
          color: #002d80;
          text-decoration: underline;
        }
        
        @media (max-width: 1024px) {
          .login-card {
            max-width: 860px;
            min-height: 540px;
          }
          .login-left {
            padding: 32px 34px;
          }
          .login-right {
            padding: 32px 34px;
          }
          .login-brand-title {
            font-size: 28px;
          }
          .login-brand-and {
            font-size: 22px;
          }
          .login-logo-img {
            height: 72px;
          }
        }
        
        @media (max-width: 768px) {
          .login-back-btn {
            display: none;
          }
          .login-page-container {
            min-height: 100vh;
            overflow-y: auto;
            padding: 24px 12px;
            padding-top: max(24px, env(safe-area-inset-top, 24px));
            padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
          }
          .login-card {
            flex-direction: column;
            border-radius: 24px;
            height: auto;
            width: 94%;
            max-width: 440px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .login-left {
            width: 100%;
            min-height: 220px;
            padding: 24px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            justify-content: center;
            gap: 12px;
          }
          .solid-logo-card {
            padding: 8px 16px !important;
            align-self: center !important;
            display: flex !important;
            justify-content: center !important;
            border-radius: 12px !important;
          }
          .login-logo-img {
            height: 42px !important;
            max-width: 160px !important;
          }
          .branding-text-container {
            margin: 0 !important;
            text-align: center !important;
            align-items: center !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .login-brand-title {
            font-size: 19px !important;
            text-align: center !important;
            letter-spacing: -0.3px !important;
            line-height: 1.25 !important;
            margin: 0 !important;
            font-weight: 750 !important;
          }
          .login-brand-and {
            font-size: 15px !important;
            margin: 1px 0 !important;
          }
          .login-brand-accent-bar {
            width: 60px !important;
            height: 4px !important;
            margin: 8px auto 0 auto !important;
          }
          .login-right {
            width: 100%;
            padding: 28px 20px !important;
          }
          .login-form-wrapper {
            max-width: 100%;
          }
          .login-pill-input-group {
            margin-bottom: 14px !important;
          }
          .login-pill-input-container {
            height: 44px !important;
          }
          .login-btn-primary, .login-btn-secondary {
            height: 44px !important;
            font-size: 14px !important;
          }
        }

        @media (max-width: 480px) {
          .login-btn-row {
            flex-direction: column;
            gap: 10px;
          }
          .login-btn-primary, .login-btn-secondary {
            width: 100%;
            flex: none !important;
          }
        }
      `}</style>

      <div className="login-card">
        {/* Left Side: Branding */}
        <div className="login-left">
          <div className="solid-logo-card">
            <img src="/ltc.png" alt="Life Transformation Center Logo" className="login-logo-img" />
          </div>

          <div className="branding-text-container">
            <h1 className="login-brand-title">
              Life Awakening Program
            </h1>
            <div className="login-brand-accent-bar" />
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="login-right">
          <div className="login-form-wrapper">
            <div style={{ marginBottom: '26px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                Login
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '6px 0 0 0' }}>
                Please login to your account
              </p>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '10px 14px', borderRadius: '12px', color: '#dc2626', marginBottom: '18px', fontSize: '13px', textAlign: 'center', fontWeight: '600' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="login-pill-input-group">
                <label className="login-field-label">Email Address</label>
                <div className="login-pill-input-container">
                  <User className="login-pill-icon" size={18} />
                  <input 
                    type="email" 
                    className="login-pill-input" 
                    placeholder="Enter email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                    required
                  />
                </div>
              </div>

              <div className="login-pill-input-group" style={{ marginBottom: '18px' }}>
                <label className="login-field-label">Password</label>
                <div className="login-pill-input-container">
                  <Lock className="login-pill-icon" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="login-pill-input" 
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', padding: '0 4px', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="login-pill-input-group" style={{ marginBottom: '22px' }}>
                <RobotCheckbox verified={captchaVerified} onChange={setCaptchaVerified} />
              </div>

              <div className="login-btn-row">
                <button type="submit" className="login-btn-primary" style={{ flex: 1.7 }} disabled={loading}>
                  <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                  {!loading && <ArrowRight size={18} style={{ marginLeft: '4px' }} />}
                </button>
                <button type="button" className="login-btn-secondary" style={{ flex: 1 }} onClick={handleReset}>
                  Reset
                </button>
              </div>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <a
                href="#forgot-password"
                className="login-forgot-link"
                onClick={(e) => {
                  e.preventDefault();
                  setIsForgotPasswordOpen(true);
                }}
              >
                Forgot Password?
              </a>
            </div>

            <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: '500', color: '#64748b', marginBottom: '8px' }}>
                Need Help? Contact Support
              </span>
              <a
                href="mailto:ltcmitwpu@gmail.com"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0048ba',
                  textDecoration: 'none',
                  background: '#eef6ff',
                  padding: '9px 20px',
                  borderRadius: '50px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#e2efff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#eef6ff';
                }}
              >
                <Mail size={16} color="#0048ba" fill="#0048ba" />
                <span>ltcmitwpu@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
        onPasswordResetSuccess={(newEmail) => {
          setEmail(newEmail);
          setPassword('');
          setError('');
        }}
      />
    </div>
  )
}
