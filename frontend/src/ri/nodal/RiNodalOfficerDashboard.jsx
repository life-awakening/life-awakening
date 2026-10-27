import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Users, AlertCircle, CheckCircle, Search, ChevronRight, ChevronLeft,
  Menu, X, ShieldCheck, ArrowRight, ArrowLeftRight, UserCheck, Calendar, BookOpen, Settings,
  MapPin, Phone, Mail, Building, RefreshCw, LogOut, Download, FileSpreadsheet, Eye,
  ExternalLink, ChevronDown, CheckCircle2, Lock, Sparkles, UserX, AlertTriangle, Layers
} from 'lucide-react';
import { cleanPanelName } from '../shared/riUtils';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

/**
 * Format clean batch label.
 * E.g. "BATCH 1" -> "Batch 1"
 */
function formatBatchName(batchName) {
  let cleanBatch = (batchName || 'Batch 1')
    .replace(/^ri_direct_/i, '')
    .replace(/^ri_/i, '')
    .replace(/\bBATCH\b/gi, 'Batch')
    .trim();

  return cleanBatch.charAt(0).toUpperCase() + cleanBatch.slice(1);
}

const RI_ACTIVITIES = [
  { key: 'SCHOOL_ACTIVITY', label: 'School Activity', shortLabel: 'School' },
  { key: 'INSTITUTIONAL_VISIT', label: 'Institutional Visit', shortLabel: 'Inst. Visit' },
  { key: 'FAMILY_SURVEY', label: 'Family Visit', shortLabel: 'Family Visit' },
  { key: 'COMMUNITY_PROJECT', label: 'Community Project', shortLabel: 'Community' }
];

export default function RiNodalOfficerDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('ri_nodal_sidebar_collapsed') === 'true');
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Track window resize for responsive layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 480;
  const isExtraSmallMobile = windowWidth < 360;

  // Navigation tabs: 'overview' | 'village' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  // Panels data
  const [panels, setPanels] = useState([]);
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [isLoadingPanels, setIsLoadingPanels] = useState(true);

  // Active panel details & metrics
  const [panelDetails, setPanelDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Student Roster state
  const [students, setStudents] = useState([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all'); // 'all' | 'present' | 'absent'
  const [studentActivityFilter, setStudentActivityFilter] = useState('all'); // 'all' | activity key

  // Absent students state (4-Activity Attendance tracking)
  const [absentStudents, setAbsentStudents] = useState([]);
  const [isLoadingAbsent, setIsLoadingAbsent] = useState(false);
  const [absentSearch, setAbsentSearch] = useState('');
  const [absentActivityFilter, setAbsentActivityFilter] = useState('all'); // 'all' | activity key

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  // Toasts
  const [toasts, setToasts] = useState([]);
  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const token = localStorage.getItem('token');

  // Auth fetch helper
  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    const res = await fetch(`${API}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });
    if (res.status === 401) {
      localStorage.clear();
      navigate('/login');
    }
    return res;
  }, [token, navigate]);

  // Load current user
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing user JSON', e);
      }
    }
  }, []);

  // Fetch Assigned Panels
  const fetchMyPanels = useCallback(async () => {
    setIsLoadingPanels(true);
    try {
      const res = await apiFetch('/api/ri-nodal/panels');
      const data = await res.json();
      if (res.ok && data.success) {
        const loadedPanels = data.panels || [];
        setPanels(loadedPanels);
        if (loadedPanels.length > 0) {
          const urlParams = new URLSearchParams(window.location.search);
          const qPanelId = urlParams.get('panel_id');
          const qBatchId = urlParams.get('batch_id');
          let matched = null;
          if (qBatchId && qPanelId) {
            matched = loadedPanels.find(p => String(p.batch_id) === String(qBatchId) && String(p.panel_id) === String(qPanelId));
          } else if (qPanelId) {
            matched = loadedPanels.find(p => String(p.panel_id) === String(qPanelId));
          } else if (qBatchId) {
            matched = loadedPanels.find(p => String(p.batch_id) === String(qBatchId));
          }
          const chosen = matched || loadedPanels[0];
          setSelectedPanelId(chosen.panel_id);

          const newUrl = `${window.location.pathname}?batch_id=${chosen.batch_id}&panel_id=${chosen.panel_id}`;
          window.history.replaceState(null, '', newUrl);
          localStorage.setItem('ri_active_workspace', JSON.stringify({
            ...chosen,
            type: 'nodal_officer'
          }));
        }
      } else {
        addToast(data.message || 'Failed to load assigned panels', 'error');
      }
    } catch (err) {
      console.error('Error fetching assigned panels:', err);
      addToast('Network error loading assigned panels', 'error');
    } finally {
      setIsLoadingPanels(false);
    }
  }, [apiFetch]);

  // Handle workspace panel change
  const handlePanelChange = useCallback((newPanelId) => {
    const numId = Number(newPanelId);
    setSelectedPanelId(numId);
    const target = panels.find(p => p.panel_id === numId);
    if (target) {
      const newUrl = `${window.location.pathname}?batch_id=${target.batch_id}&panel_id=${numId}`;
      window.history.replaceState(null, '', newUrl);
      localStorage.setItem('ri_active_workspace', JSON.stringify({
        ...target,
        type: 'nodal_officer'
      }));
    }
  }, [panels]);

  useEffect(() => {
    fetchMyPanels();
  }, [fetchMyPanels]);

  // Fetch Panel Details & Metrics
  const fetchPanelDetails = useCallback(async (panelId) => {
    if (!panelId) return;
    setIsLoadingDetails(true);
    try {
      const res = await apiFetch(`/api/ri-nodal/panels/${panelId}/details`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPanelDetails(data.panel);
      }
    } catch (err) {
      console.error('Error fetching panel details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [apiFetch]);

  // Fetch Panel Students
  const fetchPanelStudents = useCallback(async (panelId) => {
    if (!panelId) return;
    setIsLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      if (studentSearch.trim()) params.append('search', studentSearch.trim());
      if (studentStatusFilter !== 'all') params.append('status', studentStatusFilter);
      if (studentActivityFilter !== 'all') params.append('activity', studentActivityFilter);

      const res = await apiFetch(`/api/ri-nodal/panels/${panelId}/students?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStudents(data.students || []);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error('Error fetching panel students:', err);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [apiFetch, studentSearch, studentStatusFilter, studentActivityFilter]);

  // Fetch Absent Students (4-Activity attendance tracking)
  const fetchAbsentStudents = useCallback(async (panelId) => {
    if (!panelId) return;
    setIsLoadingAbsent(true);
    try {
      const params = new URLSearchParams();
      if (absentSearch.trim()) params.append('search', absentSearch.trim());
      if (absentActivityFilter !== 'all') params.append('activity', absentActivityFilter);

      const res = await apiFetch(`/api/ri-nodal/panels/${panelId}/absent-students?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAbsentStudents(data.absent_students || []);
      } else {
        setAbsentStudents([]);
      }
    } catch (err) {
      console.error('Error fetching absent students:', err);
      setAbsentStudents([]);
    } finally {
      setIsLoadingAbsent(false);
    }
  }, [apiFetch, absentSearch, absentActivityFilter]);

  // Re-fetch data on panel switch or filter updates
  useEffect(() => {
    if (selectedPanelId) {
      fetchPanelDetails(selectedPanelId);
      fetchPanelStudents(selectedPanelId);
      fetchAbsentStudents(selectedPanelId);
    }
  }, [selectedPanelId, fetchPanelDetails, fetchPanelStudents, fetchAbsentStudents]);

  // Selected panel object
  const currentPanel = useMemo(() => {
    return panels.find(p => p.panel_id === selectedPanelId) || panelDetails || null;
  }, [panels, selectedPanelId, panelDetails]);

  // Handle Export Absent
  const handleExportAbsent = async () => {
    if (!selectedPanelId) return;
    try {
      addToast('Preparing absent students report...', 'info');
      const res = await fetch(`${API}/api/ri-nodal/panels/${selectedPanelId}/export-absent`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RI_Absent_Students_${cleanPanelName(currentPanel?.panel_name || String(selectedPanelId))}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        addToast('Absent report downloaded successfully', 'success');
      } else {
        addToast('Failed to export absent report', 'error');
      }
    } catch (err) {
      console.error('Export error:', err);
      addToast('Network error exporting report', 'error');
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ text: '', type: '' });

    if (!currentPassword || !newPassword) {
      setPasswordMsg({ text: 'Please fill out all password fields.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiFetch('/api/ri-nodal/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordMsg({ text: 'Password updated successfully!', type: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        addToast('Password updated successfully', 'success');
      } else {
        setPasswordMsg({ text: data.message || 'Failed to update password.', type: 'error' });
      }
    } catch (err) {
      setPasswordMsg({ text: 'Network error updating password.', type: 'error' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const totalAbsentCount = absentStudents.length;

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ri_nodal_sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { id: 'overview', label: 'Overview & Stats', icon: Home },
    { id: 'village', label: 'Village Logistics', icon: MapPin },
    { id: 'settings', label: 'Account Security', icon: Settings }
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      
      {/* Toast Notification Banner */}
      <div style={{
        position: 'fixed',
        top: 12,
        right: 12,
        left: isMobile ? 12 : 'auto',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: isMobile ? 'calc(100vw - 24px)' : '380px',
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            padding: '10px 14px',
            borderRadius: '8px',
            background: t.type === 'error' ? '#dc2626' : t.type === 'info' ? '#0284c7' : '#047857',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '12.5px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {t.type === 'error' ? <AlertCircle size={15} style={{ flexShrink: 0 }} /> : <CheckCircle size={15} style={{ flexShrink: 0 }} />}
            <span style={{ wordBreak: 'break-word', flex: 1 }}>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobile && isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 48,
            transition: 'opacity 0.2s ease'
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          SIDEBAR NAVIGATION (Exact match to RI Admin, Solid Green Active State)
         ────────────────────────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: isMobile ? '280px' : (isCollapsed ? '72px' : '260px'),
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 50,
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isMobile ? (isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          overflow: 'visible',
          boxShadow: isMobile && isSidebarOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none'
        }}
      >
        {/* Floating Desktop Collapse Button */}
        {!isMobile && (
          <button
            onClick={toggleSidebarCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              position: 'absolute',
              top: '24px',
              right: '-12px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              zIndex: 60,
              color: '#047857',
              outline: 'none',
              padding: 0
            }}
          >
            {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
          </button>
        )}

        {/* Sidebar Header / Brand */}
        <div
          style={{
            height: '64px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: !isMobile && isCollapsed ? '0 16px' : '0 20px',
            justifyContent: !isMobile && isCollapsed ? 'center' : 'space-between',
            backgroundColor: '#ffffff',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {(isMobile || !isCollapsed) ? (
              <img
                src="/ri11.png"
                alt="Rural Immersion Logo"
                onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
                style={{
                  height: '36px',
                  maxWidth: '160px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '17px',
                  flexShrink: 0
                }}
              >
                RI
              </div>
            )}
          </div>

          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav
          style={{
            flex: 1,
            padding: !isMobile && isCollapsed ? '16px 8px' : '16px 12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
          }}
        >
          {(isMobile || !isCollapsed) && (
            <span style={{ fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '6px 12px', display: 'block' }}>
              Navigation
            </span>
          )}

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: (!isMobile && isCollapsed) ? '0' : '10px',
                  width: '100%',
                  padding: '10px 12px',
                  justifyContent: (!isMobile && isCollapsed) ? 'center' : 'flex-start',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isActive ? '#047857' : 'transparent',
                  color: isActive ? '#ffffff' : '#475569',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#475569';
                  }
                }}
                title={!isMobile && isCollapsed ? item.label : ''}
              >
                <Icon size={18} style={{ flexShrink: 0, color: isActive ? '#ffffff' : '#047857' }} />
                {(isMobile || !isCollapsed) && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div style={{
          padding: '14px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff'
        }}>
          {(isMobile || !isCollapsed) && currentUser && (
            <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.name || 'Nodal Officer'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.email}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: (!isMobile && isCollapsed) ? 'center' : 'flex-start',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '8px',
              backgroundColor: '#fff5f5',
              border: '1px solid #fee2e2',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fff5f5'; }}
            title="Sign Out"
          >
            <LogOut size={16} color="#dc2626" />
            {(isMobile || !isCollapsed) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────────────────
          MAIN CONTENT AREA
         ────────────────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        marginLeft: isMobile ? 0 : (isCollapsed ? '72px' : '260px'),
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        maxWidth: '100%',
        overflowX: 'hidden',
        transition: 'margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        
        {/* Top Navbar Header (Clean & Fully Responsive) */}
        <header style={{
          height: isMobile ? 'calc(56px + env(safe-area-inset-top, 0px))' : '64px',
          backgroundColor: '#047857',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : '0px',
          paddingBottom: '0px',
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: isMobile ? 'max(12px, env(safe-area-inset-right, 0px))' : '24px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          boxSizing: 'border-box'
        }}>
          {/* Left: Mobile Drawer Trigger + Brand Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              onClick={() => {
                if (isMobile) {
                  setIsSidebarOpen(!isSidebarOpen);
                } else {
                  toggleSidebarCollapse();
                }
              }}
              style={{
                backgroundColor: '#065f46',
                border: '1px solid #059669',
                color: '#ffffff',
                padding: '7px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>

            <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div>
                <h1 style={{
                  margin: 0,
                  fontSize: isMobile ? '14px' : '16px',
                  fontWeight: '800',
                  color: '#ffffff',
                  letterSpacing: '-0.2px',
                  whiteSpace: 'nowrap'
                }}>
                  {isMobile ? 'Nodal Officer Portal' : 'RI Nodal Officer Portal'}
                </h1>
                {!isMobile && (
                  <div style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: '600' }}>
                    Department Immersion Supervision
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Switch Workspace + Refresh Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Switch Workspace Button */}
            <button
              onClick={() => navigate('/ri-workspaces')}
              style={{
                backgroundColor: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#ffffff',
                padding: isMobile ? '6px 10px' : '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.24)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)'}
              title="Switch to another assigned workspace"
            >
              <ArrowLeftRight size={13} />
              <span style={{ display: isMobile ? 'none' : 'inline' }}>Switch Workspace</span>
            </button>

            {/* Quick Panel Selector in Header (if multiple assigned) */}
            {panels.length > 1 && (
              <select
                value={selectedPanelId || ''}
                onChange={e => handlePanelChange(e.target.value)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  maxWidth: isMobile ? '140px' : '240px',
                  outline: 'none'
                }}
                title="Switch assigned batch or panel"
              >
                {panels.map(p => (
                  <option key={p.panel_id} value={p.panel_id} style={{ backgroundColor: '#065f46', color: '#ffffff' }}>
                    {formatBatchName(p.batch_name)} — {cleanPanelName(p.panel_name)} ({p.village_name || 'Village'})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => {
                fetchMyPanels();
                if (selectedPanelId) {
                  fetchPanelDetails(selectedPanelId);
                  fetchPanelStudents(selectedPanelId);
                  fetchAbsentStudents(selectedPanelId);
                }
                addToast('Data refreshed', 'success');
              }}
              style={{
                backgroundColor: '#065f46',
                border: '1px solid #059669',
                color: '#ffffff',
                padding: isMobile ? '6px 10px' : '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0
              }}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={isLoadingPanels || isLoadingDetails ? 'animate-spin' : ''} />
              {!isSmallMobile && <span>Refresh</span>}
            </button>
          </div>
        </header>

        {/* Dedicated Clean Mobile-First Batch & Panel Selector Bar */}
        {panels.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: isMobile ? '10px 12px' : '12px 24px',
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Layers size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Batch &amp; Panel
                </span>
                {currentPanel && (
                  <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cleanPanelName(currentPanel.panel_name)} • {formatBatchName(currentPanel.batch_name)}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Styled Select Dropdown (Full width on mobile, no squeezing) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '100%' : '260px'
            }}>
              <select
                value={selectedPanelId || ''}
                onChange={(e) => handlePanelChange(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                {panels.map(p => (
                  <option key={p.panel_id} value={p.panel_id}>
                    {formatBatchName(p.batch_name)} — {cleanPanelName(p.panel_name)} ({p.village_name || 'Village'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Content Container */}
        <main style={{
          flex: 1,
          padding: isMobile ? '12px 10px' : '16px 20px',
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
          minWidth: 0,
          overflowX: 'hidden'
        }}>
          
          {/* If No Panels Assigned */}
          {!isLoadingPanels && panels.length === 0 && (
            <div style={{
              padding: isMobile ? '32px 16px' : '48px 24px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginTop: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
              <AlertTriangle size={40} color="#d97706" style={{ margin: '0 auto 14px auto' }} />
              <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
                No Assigned Panels Found
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '500px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
                Your account ({currentUser?.email}) is not mapped as a Nodal Officer to any active panel yet. Please contact the RI Administrator to upload the allocation matrix.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              OVERVIEW & STATS (Clean Responsive Cards & Tables)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && currentPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px', width: '100%', minWidth: 0 }}>
              
              {/* 1. 4 STATS CARDS: Balanced 2-column on mobile, 4-column on desktop */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: isMobile ? '8px' : '14px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                
                {/* 1. Total Students Card */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: isMobile ? '12px 12px' : '16px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: isMobile ? '10.5px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                    Total Students
                  </span>
                  <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#0f172a', marginTop: '6px', lineHeight: 1.1 }}>
                    {currentPanel.total_students || students.length || 0}
                  </div>
                </div>

                {/* 2. 4 Activity Attendance Cards */}
                {RI_ACTIVITIES.map(act => (
                  <div
                    key={act.key}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: isMobile ? '12px 12px' : '16px 18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span style={{ fontSize: isMobile ? '10.5px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                      {act.shortLabel}
                    </span>
                    <div style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '800', color: '#0f172a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.1 }}>
                      <span style={{ color: '#15803d' }}>{currentPanel[`${act.key}_present`] ?? 0} P</span>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>/</span>
                      <span style={{ color: '#dc2626' }}>{currentPanel[`${act.key}_absent`] ?? 0} A</span>
                    </div>
                  </div>
                ))}

                {/* 4. Absentee Count Card (Clean solid white, subtle border) */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: isMobile ? '12px 12px' : '16px 18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: isMobile ? '10.5px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                    Absentee Count
                  </span>
                  <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: totalAbsentCount > 0 ? '#dc2626' : '#15803d', marginTop: '6px', lineHeight: 1.1 }}>
                    {totalAbsentCount}
                  </div>
                </div>

              </div>

              {/* 2. SECTION: ABSENT STUDENTS LIST (2-Day Attendance: Day 1, Day 2) */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '14px 12px' : '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                {/* Header with Title Badge, Subtitle and Stacked Controls on Mobile */}
                <div style={{
                  display: 'flex',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '12px',
                  marginBottom: '14px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: isMobile ? '14.5px' : '16px', fontWeight: '800', color: '#0f172a' }}>
                        Absent Students List
                      </h3>
                      <span style={{
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        border: '1px solid #fca5a5'
                      }}>
                        {absentStudents.length}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                      Live tracking for {cleanPanelName(currentPanel.panel_name)}
                    </p>
                  </div>

                  {/* Day Filter Tabs & Download Button (Proper mobile wrapping) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    width: isMobile ? '100%' : 'auto',
                    justifyContent: isMobile ? 'space-between' : 'flex-end'
                  }}>
                    {/* Clean Segmented Activity Tabs */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: '#f1f5f9',
                      padding: '2px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      flex: isMobile ? '1 1 auto' : 'none',
                      overflowX: 'auto'
                    }}>
                      {[{ key: 'all', label: 'All Activities' }, ...RI_ACTIVITIES].map(act => {
                        const isSelected = absentActivityFilter === act.key;
                        return (
                          <button
                            key={act.key}
                            onClick={() => setAbsentActivityFilter(act.key)}
                            style={{
                              flex: isMobile ? 1 : 'none',
                              padding: '5px 10px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: isSelected ? '700' : '600',
                              border: 'none',
                              backgroundColor: isSelected ? '#ffffff' : 'transparent',
                              color: isSelected ? '#0f172a' : '#64748b',
                              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {act.shortLabel || act.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Download Button */}
                    <button
                      onClick={handleExportAbsent}
                      disabled={absentStudents.length === 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        backgroundColor: absentStudents.length === 0 ? '#f1f5f9' : '#047857',
                        color: absentStudents.length === 0 ? '#94a3b8' : '#ffffff',
                        borderRadius: '6px',
                        border: absentStudents.length === 0 ? '1px solid #e2e8f0' : '1px solid #047857',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: absentStudents.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.15s ease',
                        width: isMobile ? '100%' : 'auto',
                        boxSizing: 'border-box'
                      }}
                    >
                      <Download size={13} />
                      <span>Download Excel</span>
                    </button>
                  </div>
                </div>

                {isLoadingAbsent ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#047857', fontWeight: '700' }}>
                    <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px auto' }} />
                    <span style={{ fontSize: '12.5px' }}>Loading absent students...</span>
                  </div>
                ) : absentStudents.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <CheckCircle size={24} color="#16a34a" style={{ margin: '0 auto 4px auto' }} />
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      No Absent Students Recorded
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      All students in {cleanPanelName(currentPanel.panel_name)} are marked present.
                    </div>
                  </div>
                ) : (
                  /* Horizontally Scrollable Table for Absent Students */
                  <div style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    maxWidth: '100%',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Student Name</th>
                          <th style={{ padding: '8px 10px' }}>PRN</th>
                          <th style={{ padding: '8px 10px' }}>Email &amp; Phone</th>
                          <th style={{ padding: '8px 10px' }}>Department</th>
                          <th style={{ padding: '8px 10px' }}>Absent Activities</th>
                          <th style={{ padding: '8px 10px' }}>Village</th>
                        </tr>
                      </thead>
                      <tbody>
                        {absentStudents.map((s, si) => (
                          <tr key={si} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', color: '#94a3b8', fontWeight: '600' }}>
                              {si + 1}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.student_name}</div>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>{s.gender || '—'} {s.division ? `• Div: ${s.division}` : ''}</span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '11px' }}>
                                {s.prn || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <a href={`mailto:${s.student_email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                                {s.student_email}
                              </a>
                              {s.student_phone && (
                                <div style={{ fontSize: '10px', color: '#334155', marginTop: '1px' }}>
                                  📞 {s.student_phone}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {s.department || '—'}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {Array.isArray(s.absent_activities || s.absent_days) && (s.absent_activities || s.absent_days).map((actName, di) => (
                                  <span key={di} style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '10px',
                                    fontWeight: '700',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5'
                                  }}>
                                    {actName}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#047857', fontWeight: '600' }}>
                              {s.village_name || currentPanel?.village_name || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. SECTION: COMPLETE STUDENT ROSTER */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '14px 12px' : '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '12px',
                  marginBottom: '14px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: isMobile ? '14.5px' : '16px', fontWeight: '800', color: '#0f172a' }}>
                        Student Roster
                      </h3>
                      <span style={{
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        border: '1px solid #a7f3d0'
                      }}>
                        {cleanPanelName(currentPanel.panel_name)}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                      Total <strong>{students.length}</strong> students enrolled
                    </p>
                  </div>

                  {/* Search and status filter */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    width: isMobile ? '100%' : 'auto'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      flex: isMobile ? '1 1 100%' : 'none',
                      minWidth: isMobile ? '100%' : '180px',
                      boxSizing: 'border-box'
                    }}>
                      <Search size={13} color="#64748b" style={{ flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search student or PRN..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }}
                      />
                      {studentSearch && (
                        <button onClick={() => setStudentSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <select
                      value={studentStatusFilter}
                      onChange={(e) => setStudentStatusFilter(e.target.value)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        fontWeight: '600',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                        flex: isMobile ? '1 1 auto' : 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="all">Status: All</option>
                      <option value="present">Present Only</option>
                      <option value="absent">Absent Only</option>
                    </select>
                  </div>
                </div>

                {isLoadingStudents ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#047857', fontWeight: '700' }}>
                    <RefreshCw size={16} className="animate-spin" style={{ margin: '0 auto 6px auto' }} />
                    <span style={{ fontSize: '12.5px' }}>Loading student roster...</span>
                  </div>
                ) : students.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: '#64748b', fontSize: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                    No student records found for this panel.
                  </div>
                ) : (
                  /* Horizontally Scrollable Table for Student Roster */
                  <div style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    maxWidth: '100%',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', minWidth: '750px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Student Name</th>
                          <th style={{ padding: '8px 10px' }}>PRN</th>
                          <th style={{ padding: '8px 10px' }}>Email Address</th>
                          <th style={{ padding: '8px 10px' }}>Department</th>
                          <th style={{ padding: '8px 10px' }}>Panel</th>
                          <th style={{ padding: '8px 10px' }} title="School Activity">School</th>
                          <th style={{ padding: '8px 10px' }} title="Institutional Visit">Inst. Visit</th>
                          <th style={{ padding: '8px 10px' }} title="Family Visit">Family Visit</th>
                          <th style={{ padding: '8px 10px' }} title="Community Project">Community</th>
                          <th style={{ padding: '8px 10px' }}>Undertaking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, si) => {
                          const getBadge = (st) => {
                            const isP = st === 'Present';
                            const isA = st === 'Absent';
                            return (
                              <span style={{
                                padding: '2px 5px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '700',
                                backgroundColor: isP ? '#dcfce7' : isA ? '#fee2e2' : '#f1f5f9',
                                color: isP ? '#15803d' : isA ? '#dc2626' : '#64748b'
                              }}>
                                {st || '—'}
                              </span>
                            );
                          };
                          return (
                            <tr key={si} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', color: '#94a3b8', fontWeight: '600' }}>
                                {si + 1}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.student_name}</div>
                                <span style={{ fontSize: '10px', color: '#64748b' }}>{s.gender || '—'} {s.division ? `• Div: ${s.division}` : ''}</span>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace', fontSize: '11px' }}>
                                  {s.prn || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <a href={`mailto:${s.student_email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                                  {s.student_email}
                                </a>
                                {s.phone && (
                                  <div style={{ fontSize: '10px', color: '#334155', marginTop: '1px' }}>
                                    📞 {s.phone}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#475569' }}>
                                {s.department || '—'}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  backgroundColor: '#f1f5f9',
                                  color: '#334155',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  {cleanPanelName(s.panel_name || currentPanel?.panel_name || 'Panel')}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px' }}>{getBadge(s.school_activity_status)}</td>
                              <td style={{ padding: '8px 10px' }}>{getBadge(s.institutional_visit_status)}</td>
                              <td style={{ padding: '8px 10px' }}>{getBadge(s.family_survey_status)}</td>
                              <td style={{ padding: '8px 10px' }}>{getBadge(s.community_project_status)}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  backgroundColor: s.undertaking_submitted ? '#ecfdf5' : '#fffbeb',
                                  color: s.undertaking_submitted ? '#047857' : '#b45309',
                                  border: s.undertaking_submitted ? '1px solid #a7f3d0' : '1px solid #fde68a'
                                }}>
                                  {s.undertaking_submitted ? 'Submitted' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: VILLAGE LOGISTICS DEDICATED VIEW
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'village' && currentPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>
              
              {/* Village Infrastructure & Contact Card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '16px 12px' : '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin size={18} />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: isMobile ? '15.5px' : '18px', fontWeight: '800', color: '#0f172a' }}>
                        Village Immersion Site &amp; Infrastructure
                      </h2>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        Local administration and emergency contacts
                      </p>
                    </div>
                  </div>

                  {currentPanel.google_maps_link && (
                    <a
                      href={currentPanel.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#ffffff',
                        color: '#047857',
                        borderRadius: '8px',
                        border: '1.5px solid #047857',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        textDecoration: 'none',
                        width: isMobile ? '100%' : 'auto',
                        boxSizing: 'border-box'
                      }}
                    >
                      <MapPin size={14} color="#047857" />
                      <span>Open in Google Maps ↗</span>
                    </a>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Assigned Village</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857', marginTop: '3px' }}>{currentPanel.village_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>
                      Taluka: <strong>{currentPanel.taluka || '—'}</strong> • District: <strong>{currentPanel.district || '—'}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Base School &amp; Headmaster</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{currentPanel.school_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '3px' }}>
                      📞 {currentPanel.principal_mobile || 'No contact provided'}
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Local Gram Panchayat / Sarpanch</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{currentPanel.sarpanch_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '3px' }}>
                      📞 {currentPanel.sarpanch_mobile || 'No contact provided'}
                    </div>
                  </div>

                  <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>MIT-WPU SPOC In-charge</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>{currentPanel.spoc_name || '—'}</div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '3px' }}>
                      📞 {currentPanel.spoc_mobile || 'No contact provided'}
                    </div>
                  </div>
                </div>

                {currentPanel.detailed_address && (
                  <div style={{ marginTop: '12px', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569' }}>
                    <strong>Detailed Address:</strong> {currentPanel.detailed_address}
                  </div>
                )}
              </div>

              {/* Accompany Faculty Mentors Table */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '16px 12px' : '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '15px' : '16px', fontWeight: '800', color: '#0f172a' }}>
                      Assigned Faculty Mentors
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Mentors accompanying students at {cleanPanelName(currentPanel.panel_name)}
                    </p>
                  </div>
                </div>

                {currentPanel.faculty_mentors && currentPanel.faculty_mentors.length > 0 ? (
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '550px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '9px 12px' }}>Role</th>
                          <th style={{ padding: '9px 12px' }}>Faculty Name</th>
                          <th style={{ padding: '9px 12px' }}>Email Address</th>
                          <th style={{ padding: '9px 12px' }}>Department</th>
                          <th style={{ padding: '9px 12px' }}>Contact Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPanel.faculty_mentors.map((f, fi) => (
                          <tr key={fi} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#047857' }}>
                              {f.role || `Mentor ${fi + 1}`}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                              {f.name}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#0284c7' }}>
                              {f.email ? (
                                <a href={`mailto:${f.email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                                  {f.email}
                                </a>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>
                              {f.department || '—'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#334155' }}>
                              {f.phone ? `📞 ${f.phone}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px', background: '#f8fafc', borderRadius: '8px' }}>
                    No faculty mentors currently mapped to this panel.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: ACCOUNT SECURITY & PASSWORD
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '16px 12px' : '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                boxSizing: 'border-box'
              }}>
                <h2 style={{ margin: '0 0 6px 0', fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#0f172a' }}>
                  Account Security &amp; Password
                </h2>
                <p style={{ margin: '0 0 18px 0', fontSize: '12.5px', color: '#64748b' }}>
                  Update your login credentials for the Nodal Officer portal.
                </p>

                {passwordMsg.text && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '14px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    backgroundColor: passwordMsg.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: passwordMsg.type === 'error' ? '#dc2626' : '#15803d',
                    border: passwordMsg.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0'
                  }}>
                    {passwordMsg.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password (default: nodal@123)"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    style={{
                      marginTop: '6px',
                      padding: '11px 18px',
                      backgroundColor: isChangingPassword ? '#94a3b8' : '#047857',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%'
                    }}
                  >
                    {isChangingPassword ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                    <span>Update Password</span>
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
