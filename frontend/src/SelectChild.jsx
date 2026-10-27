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
    if (child.student_id) return child.student_id;
    return `LA-${String(child.id).padStart(5, '0')}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#0f172a'
    }}>
      {/* ── Top Header Bar ── */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: isMobile ? '12px 16px' : '16px 24px',
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
              height: isMobile ? '36px' : '44px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#475569',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.color = '#0f172a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.color = '#475569';
          }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </header>

      {/* ── Main Content Area ── */}
      <main style={{
        flex: 1,
        maxWidth: '920px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '20px 14px 40px' : '36px 20px 60px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Page Title & Subtitle */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '20px' : '32px' }}>
          <h2 style={{
            fontSize: isMobile ? '21px' : '26px',
            fontWeight: '800',
            color: '#0f172a',
            margin: '0 0 6px 0',
            letterSpacing: '-0.5px'
          }}>
            Select Student
          </h2>
          <p style={{
            fontSize: isMobile ? '13px' : '15px',
            color: '#64748b',
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
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              border: '3px solid #fed7aa',
              borderTopColor: '#ea580c',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 0.9s linear infinite'
            }} />
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500', margin: 0 }}>
              Loading student accounts...
            </p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error && children.length === 0 ? (
          /* Error State */
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fecaca',
            borderRadius: '14px',
            padding: '32px 24px',
            textAlign: 'center',
            maxWidth: '480px',
            margin: '0 auto',
            width: '100%'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}>
              <AlertCircle size={22} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#991b1b', margin: '0 0 6px 0' }}>
              Unable to load students
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 18px 0' }}>{error}</p>
            <button
              onClick={fetchChildren}
              style={{
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <RefreshCw size={15} />
              <span>Retry</span>
            </button>
          </div>
        ) : children.length === 0 ? (
          /* Empty State */
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            padding: '50px 24px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            maxWidth: '480px',
            margin: '0 auto',
            width: '100%'
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#fff7ed',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <User size={26} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              No Registered Students Found
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              There are currently no student records linked to your account ({currentUser?.email || 'this email'}). If newly enrolled, please check back shortly or contact the academy administration.
            </p>
            <button
              onClick={fetchChildren}
              style={{
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>
        ) : (
          /* Student Cards Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : (children.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(290px, 1fr))'),
            gap: isMobile ? '16px' : '20px',
            maxWidth: children.length === 1 ? '460px' : '100%',
            margin: '0 auto',
            width: '100%'
          }}>
            {children.map((child) => {
              const displayId = formatStudentId(child);

              return (
                <div
                  key={child.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: isMobile ? '18px 16px' : '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ea580c';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(234, 88, 12, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                  }}
                >
                  <div>
                    {/* Top Identity Row (No profile icon) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          fontSize: isMobile ? '16px' : '17px',
                          fontWeight: '800',
                          color: '#0f172a',
                          margin: '0 0 4px 0',
                          letterSpacing: '-0.2px'
                        }}>
                          {child.name}
                        </h3>
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: '700',
                          fontFamily: 'monospace',
                          color: '#ea580c',
                          backgroundColor: '#fff7ed',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fed7aa',
                          display: 'inline-block'
                        }}>
                          {displayId}
                        </span>
                      </div>
                    </div>

                    {/* Student Info Details */}
                    <div style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      marginBottom: '18px',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      fontSize: '13px'
                    }}>
                      {/* Class & Division */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <BookOpen size={14} color="#94a3b8" />
                          <span>Class / Grade</span>
                        </span>
                        <span style={{ color: '#0f172a', fontWeight: '700' }}>
                          {child.class_grade || 'Not Specified'}
                          {child.division ? ` (Div ${child.division})` : ''}
                        </span>
                      </div>

                      {/* School */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <School size={14} color="#94a3b8" />
                          <span>School</span>
                        </span>
                        <span style={{
                          color: '#0f172a',
                          fontWeight: '600',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '200px'
                        }}>
                          {child.school || 'Life Awakening'}
                        </span>
                      </div>

                      {/* Branch (if available) */}
                      {child.school_branch && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} color="#94a3b8" />
                            <span>Branch</span>
                          </span>
                          <span style={{ color: '#0f172a', fontWeight: '600', textAlign: 'right' }}>
                            {child.school_branch}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Button */}
                  <button
                    onClick={() => handleSelectChild(child)}
                    style={{
                      width: '100%',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 18px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background-color 0.15s ease',
                      boxShadow: '0 2px 6px rgba(234, 88, 12, 0.15)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#c2410c';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ea580c';
                    }}
                  >
                    <span>Open Dashboard</span>
                    <ArrowRight size={16} />
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
