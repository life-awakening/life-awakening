import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '@/config/apiConfig';
import {
  Briefcase,
  UserCheck,
  Search,
  ArrowRight,
  LogOut,
  Layers,
  MapPin,
  RefreshCw,
  Building2
} from 'lucide-react';

const API = API_BASE_URL;

function normalizeAssignmentType(assignment) {
  if (!assignment) return null;
  const raw = String(assignment.type || assignment.workspace_type || assignment.role || '').trim().toLowerCase();
  if (raw === 'faculty' || raw === 'ri_faculty' || raw.includes('faculty') || raw.includes('mentor')) {
    return 'faculty';
  }
  if (raw === 'nodal_officer' || raw === 'ri_nodal_officer' || raw.includes('nodal')) {
    return 'nodal_officer';
  }
  return null;
}

export default function RiWorkspaceSelector() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  const [workspaces, setWorkspaces] = useState({
    faculty_assignments: [],
    nodal_assignments: [],
    user: null,
    total_count: 0
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Handle mobile resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch authorized workspaces
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchWorkspaces = async () => {
      try {
        const res = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
          return;
        }

        const data = await res.json();
        if (data.success) {
          setWorkspaces(data);

          // Rule: If user has only ONE authorized assignment, route directly to the dashboard!
          if (data.total_count === 1) {
            const onlyFaculty = (data.faculty_assignments || [])[0];
            const onlyNodal = (data.nodal_assignments || [])[0];

            if (onlyFaculty) {
              const roleType = normalizeAssignmentType(onlyFaculty) || 'faculty';
              localStorage.setItem('ri_active_workspace', JSON.stringify({ ...onlyFaculty, type: roleType }));
              navigate(`/ri-faculty?batch_id=${onlyFaculty.batch_id}&panel_id=${onlyFaculty.panel_id}`, { replace: true });
              return;
            }
            if (onlyNodal) {
              const roleType = normalizeAssignmentType(onlyNodal) || 'nodal_officer';
              localStorage.setItem('ri_active_workspace', JSON.stringify({ ...onlyNodal, type: roleType }));
              navigate(`/ri-nodal-officer?batch_id=${onlyNodal.batch_id}&panel_id=${onlyNodal.panel_id}`, { replace: true });
              return;
            }
          }
        } else {
          setError(data.message || 'Unable to retrieve workspace allocations.');
        }
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Network error while connecting to university workspace server.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, [navigate]);

  const handleOpenWorkspace = (assignment, explicitType) => {
    setError('');
    const roleType = explicitType || normalizeAssignmentType(assignment);

    if (!roleType) {
      setError(`Cannot open workspace: unrecognized assignment role "${assignment?.role || assignment?.type || 'unknown'}".`);
      return;
    }

    if (!assignment.batch_id || !assignment.panel_id) {
      setError('Cannot open workspace: assignment is missing required batch or panel ID.');
      return;
    }

    // Persist active workspace
    localStorage.setItem('ri_active_workspace', JSON.stringify({
      ...assignment,
      type: roleType
    }));

    if (roleType === 'faculty') {
      navigate(`/ri-faculty?batch_id=${assignment.batch_id}&panel_id=${assignment.panel_id}`);
    } else if (roleType === 'nodal_officer') {
      navigate(`/ri-nodal-officer?batch_id=${assignment.batch_id}&panel_id=${assignment.panel_id}`);
    } else {
      setError(`Cannot route to unsupported workspace type: ${roleType}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('ri_active_workspace');
    navigate('/login');
  };

  // Filter assignments based on search term
  const filteredFaculty = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces.faculty_assignments || [];
    return (workspaces.faculty_assignments || []).filter(item =>
      (item.batch_name && item.batch_name.toLowerCase().includes(q)) ||
      (item.panel_name && item.panel_name.toLowerCase().includes(q)) ||
      (item.village_name && item.village_name.toLowerCase().includes(q)) ||
      (item.role && item.role.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q))
    );
  }, [workspaces.faculty_assignments, search]);

  const filteredNodal = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces.nodal_assignments || [];
    return (workspaces.nodal_assignments || []).filter(item =>
      (item.batch_name && item.batch_name.toLowerCase().includes(q)) ||
      (item.panel_name && item.panel_name.toLowerCase().includes(q)) ||
      (item.village_name && item.village_name.toLowerCase().includes(q)) ||
      (item.role && item.role.toLowerCase().includes(q)) ||
      (item.department && item.department.toLowerCase().includes(q))
    );
  }, [workspaces.nodal_assignments, search]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#475569'
      }}>
        <RefreshCw size={26} className="animate-spin" color="#1d4ed8" />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Loading authorized workspaces...</span>
      </div>
    );
  }

  const showSearch = (workspaces.total_count || 0) > 3;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      {/* Top Header Bar */}
      <header style={{
        height: '60px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 32px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/mit.png"
            alt="MIT World Peace University"
            style={{ height: '32px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Rural Immersion Portal
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {workspaces.user && (
            <div style={{ textAlign: 'right', display: isMobile ? 'none' : 'block' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                {workspaces.user.name || workspaces.user.email}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                {workspaces.user.email}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        maxWidth: isMobile ? '100%' : '1100px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '20px 16px 40px 16px' : '36px 32px 48px 32px',
        boxSizing: 'border-box'
      }}>
        {/* Header Section */}
        <div style={{ marginBottom: isMobile ? '20px' : '28px', textAlign: 'left' }}>
          <h1 style={{
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: '850',
            color: '#0f172a',
            margin: '0 0 6px 0',
            letterSpacing: '-0.4px'
          }}>
            Welcome Back
          </h1>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#475569',
            margin: 0,
            fontWeight: '500'
          }}>
            Choose a workspace to continue.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* Search Field (if more than 3 assignments) */}
        {showSearch && (
          <div style={{ position: 'relative', marginBottom: '22px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search batch or panel..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* ── GROUP 1: FACULTY ── */}
        {filteredFaculty.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <Briefcase size={16} color="#1d4ed8" />
              <h2 style={{
                fontSize: '12.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: '#1e3a8a',
                margin: 0
              }}>
                FACULTY
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                padding: '1px 8px',
                borderRadius: '10px'
              }}>
                {filteredFaculty.length}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: isMobile ? '12px' : '16px'
            }}>
              {filteredFaculty.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: isMobile ? '16px' : '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    {/* Role badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#1d4ed8',
                        backgroundColor: '#eff6ff',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #bfdbfe'
                      }}>
                        {item.role || 'Faculty Mentor'}
                      </span>
                    </div>

                    {/* Batch Name */}
                    <div style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', marginBottom: '4px' }}>
                      {item.batch_name}
                    </div>

                    {/* Panel & Village */}
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>
                      Panel {item.panel_number || ''} {item.panel_name ? `(${item.panel_name})` : ''}
                    </div>

                    {item.village_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        <MapPin size={12} color="#64748b" />
                        <span>Village: {item.village_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Open Workspace Action */}
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(item, 'faculty')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#1d4ed8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1e40af'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                  >
                    <span>Open Workspace</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── GROUP 2: NODAL OFFICER ── */}
        {filteredNodal.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <UserCheck size={16} color="#047857" />
              <h2 style={{
                fontSize: '12.5px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: '#065f46',
                margin: 0
              }}>
                NODAL OFFICER
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                padding: '1px 8px',
                borderRadius: '10px'
              }}>
                {filteredNodal.length}
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: isMobile ? '12px' : '16px'
            }}>
              {filteredNodal.map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: isMobile ? '16px' : '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#6ee7b7';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(5,150,105,0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div>
                    {/* Role badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#047857',
                        backgroundColor: '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #a7f3d0'
                      }}>
                        Nodal Officer
                      </span>
                    </div>

                    {/* Batch Name */}
                    <div style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', marginBottom: '4px' }}>
                      {item.batch_name}
                    </div>

                    {/* Panel & Village */}
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>
                      Panel {item.panel_number || ''} {item.panel_name ? `(${item.panel_name})` : ''}
                    </div>

                    {item.village_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        <MapPin size={12} color="#64748b" />
                        <span>Village: {item.village_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Open Workspace Action */}
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace(item, 'nodal_officer')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#1d4ed8',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1e40af'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                  >
                    <span>Open Workspace</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {workspaces.total_count === 0 && !error && (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <Layers size={36} color="#94a3b8" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
              No Workspaces Assigned
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Your account has not been mapped to any active Rural Immersion panels yet. Please contact the administrator.
            </p>
          </div>
        )}

        {/* No Results from Search */}
        {workspaces.total_count > 0 && filteredFaculty.length === 0 && filteredNodal.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            fontSize: '13px'
          }}>
            No workspaces matched &ldquo;<strong>{search}</strong>&rdquo;. Try another search term.
          </div>
        )}
      </main>
    </div>
  );
}
