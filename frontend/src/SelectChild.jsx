import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ArrowRight, School, BookOpen, MapPin, User, AlertCircle, RefreshCw } from 'lucide-react';
import API_BASE_URL from '@/config/apiConfig';

const API_BASE = API_BASE_URL;

export default function SelectChild() {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectChild = (child) => {
    localStorage.setItem('selectedStudentId', String(child.id));
    localStorage.setItem('selectedStudent', JSON.stringify(child));
    navigate('/student');
  };

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      // Cached list fallback - if single child, redirect immediately
      const cached = JSON.parse(localStorage.getItem('parent_children') || '[]');
      if (Array.isArray(cached) && cached.length === 1) {
        handleSelectChild(cached[0]);
        return;
      }
      if (Array.isArray(cached) && cached.length > 0) {
        setChildren(cached);
      }
    } catch (e) {
      console.error('Error loading user or cached students:', e);
    }

    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/parent/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          navigate('/login', { replace: true });
          return;
        }
        throw new Error(`Failed to retrieve linked students (Status ${res.status})`);
      }

      const data = await res.json();
      const childList = data.children || [];
      setChildren(childList);
      localStorage.setItem('parent_children', JSON.stringify(childList));

      // If associated with only one child, bypass child selector page directly
      if (childList.length === 1) {
        handleSelectChild(childList[0]);
        return;
      }
    } catch (err) {
      console.error('Error fetching authorized students:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedStudentId');
    localStorage.removeItem('selectedStudent');
    localStorage.removeItem('parent_children');
    navigate('/login', { replace: true });
  };

  const formatStudentId = (child) => {
    if (child.system_student_id) return child.system_student_id;
    if (child.student_id) return child.student_id;
    return `LAP-${String(child.id).padStart(5, '0')}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#05070B',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0f172a',
      boxSizing: 'border-box'
    }}>
      <style>{`
        .select-child-card {
          background-color: #faf7f2;
          border: 1px solid #e8e2d8;
          border-radius: 14px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
          min-width: 0;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28);
          transition: border-color 0.18s ease, transform 0.18s ease;
        }
        .select-child-card:hover {
          border-color: #d1c7b7;
          transform: translateY(-2px);
        }
        .select-child-btn {
          width: 100%;
          background-color: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.15s ease;
        }
        .select-child-btn:hover {
          background-color: #1d4ed8;
        }
        .select-child-signout-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background-color: #0b0f17;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 500;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .select-child-signout-btn:hover {
          background-color: #1e293b;
          border-color: #334155;
          color: #f8fafc;
        }
        @keyframes spinSlow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Top Header Bar ── */}
      <header style={{
        backgroundColor: '#05070B',
        borderBottom: '1px solid #1e293b',
        padding: isMobile ? '12px 16px' : '14px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img
            src="/ltc.png"
            alt="Life Transformation Center"
            style={{
              height: isMobile ? '34px' : '40px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        <button
          onClick={handleLogout}
          className="select-child-signout-btn"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{
        flex: 1,
        maxWidth: children.length > 2 ? '1100px' : '820px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '28px 16px 40px' : '44px 24px 60px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Page Title & Subtitle */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '32px' }}>
          <h1 style={{
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: '700',
            color: '#ffffff',
            margin: '0 0 8px 0',
            letterSpacing: '-0.3px',
            lineHeight: 1.25
          }}>
            Select <span style={{ color: '#ea580c' }}>Student</span>
          </h1>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#94a3b8',
            margin: 0,
            maxWidth: '520px',
            marginInline: 'auto',
            lineHeight: 1.5
          }}>
            Choose a student to view their dashboard, active schedules, attendance records, and learning journey.
          </p>
        </div>

        {/* Loading State */}
        {loading && children.length === 0 ? (
          <div style={{
            backgroundColor: '#faf7f2',
            borderRadius: '14px',
            padding: '50px 20px',
            textAlign: 'center',
            border: '1px solid #e8e2d8',
            maxWidth: '440px',
            margin: '0 auto',
            width: '100%',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '2px solid #e2dacd',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              margin: '0 auto 14px',
              animation: 'spinSlow 0.8s linear infinite'
            }} />
            <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
              Loading student accounts...
            </p>
          </div>
        ) : error && children.length === 0 ? (
          /* Error State */
          <div style={{
            backgroundColor: '#faf7f2',
            border: '1px solid #fecaca',
            borderRadius: '14px',
            padding: '32px 24px',
            textAlign: 'center',
            maxWidth: '440px',
            margin: '0 auto',
            width: '100%',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <AlertCircle size={20} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#991b1b', margin: '0 0 6px 0' }}>
              Unable to load students
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.45 }}>
              {error}
            </p>
            <button
              onClick={fetchChildren}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px'
              }}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        ) : children.length === 0 ? (
          /* Empty State */
          <div style={{
            backgroundColor: '#faf7f2',
            borderRadius: '14px',
            padding: '44px 24px',
            textAlign: 'center',
            border: '1px solid #e8e2d8',
            maxWidth: '460px',
            margin: '0 auto',
            width: '100%',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.28)'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <User size={22} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', margin: '0 0 6px 0' }}>
              No Registered Students Found
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px 0', lineHeight: 1.5 }}>
              There are currently no student records linked to your account ({currentUser?.email || 'this email'}). If newly enrolled, please check back shortly or contact academy administration.
            </p>
            <button
              onClick={fetchChildren}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>
        ) : (
          /* Student Cards Responsive Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : (children.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))'),
            gap: '18px',
            maxWidth: children.length === 1 ? '400px' : '100%',
            margin: '0 auto',
            width: '100%'
          }}>
            {children.map((child) => {
              const displayId = formatStudentId(child);

              return (
                <div
                  key={child.id}
                  className="select-child-card"
                >
                  <div>
                    {/* Header: Student Name + ID Badge */}
                    <div style={{ marginBottom: '16px' }}>
                      <h2 style={{
                        fontSize: '18px',
                        fontWeight: '750',
                        color: '#0f172a',
                        margin: '0 0 6px 0',
                        letterSpacing: '-0.2px',
                        lineHeight: 1.3,
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word'
                      }}>
                        {child.name}
                      </h2>

                      <span style={{
                        fontSize: '11.5px',
                        fontWeight: '600',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: '#475569',
                        backgroundColor: '#efe9df',
                        border: '1px solid #ded5c6',
                        padding: '2.5px 8px',
                        borderRadius: '5px',
                        display: 'inline-block'
                      }}>
                        {displayId}
                      </span>
                    </div>

                    {/* Information List */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '9px',
                      padding: '12px 0',
                      borderTop: '1px solid #ede7dc',
                      borderBottom: '1px solid #ede7dc',
                      marginBottom: '18px',
                      fontSize: '13px'
                    }}>
                      {/* Class & Division */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <BookOpen size={14} color="#64748b" />
                          <span>Class / Grade</span>
                        </span>
                        <span style={{
                          color: '#0f172a',
                          fontWeight: '600',
                          textAlign: 'right',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {child.class_grade || 'Not Specified'}
                          {child.division ? ` (Div ${child.division})` : ''}
                        </span>
                      </div>

                      {/* School */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <School size={14} color="#64748b" />
                          <span>School</span>
                        </span>
                        <span style={{
                          color: '#0f172a',
                          fontWeight: '600',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: isMobile ? '160px' : '190px'
                        }} title={child.school || 'Life Awakening'}>
                          {child.school || 'Life Awakening'}
                        </span>
                      </div>

                      {/* Branch (if specified) */}
                      {child.school_branch && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} color="#64748b" />
                            <span>Branch</span>
                          </span>
                          <span style={{
                            color: '#0f172a',
                            fontWeight: '600',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: isMobile ? '160px' : '190px'
                          }} title={child.school_branch}>
                            {child.school_branch}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Open Dashboard Button */}
                  <button
                    onClick={() => handleSelectChild(child)}
                    className="select-child-btn"
                    aria-label={`Open dashboard for ${child.name}`}
                  >
                    <span>Open Dashboard</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
