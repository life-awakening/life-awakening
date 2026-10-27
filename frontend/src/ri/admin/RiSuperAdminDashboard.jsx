import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Layers, Grid, RefreshCw, LogOut, Search, ChevronRight, ChevronLeft,
  Download, Eye, EyeOff, AlertCircle, CheckCircle, Clock, Sparkles, Filter,
  Menu, X, ShieldCheck, ArrowRight, UserCheck, Calendar, BookOpen, Settings,
  Compass, Award, Building, User, MapPin, Plus, Trash2, Edit3, Phone, Info, Check, ArrowLeft,
  FileSpreadsheet, UserPlus, Upload, Mail, Briefcase, FileText, ClipboardCheck, ClipboardList, CheckCircle2,
  BarChart2, PieChart, TrendingUp, Activity, Shield, ShieldAlert, Star, GraduationCap, Home,
  UserX, CheckSquare, Lock, Key, CalendarCheck, Unlock, Bell, MessageSquare, LifeBuoy, AlertTriangle,
  Camera,
  UploadCloud,
  Flag
} from 'lucide-react';
import RiTicketsModule from './RiTicketsModule';
import RiRedFlagsModule from './RiRedFlagsModule';
import RiOrangeFlagsModule from './RiOrangeFlagsModule';
import RiSubmissionsModule from './RiSubmissionsModule';
import RiPanelMediaViewer from '../shared/RiPanelMediaViewer';
import RiFacultyUploadsModule from './RiFacultyUploadsModule';
import RiSuperAdminManageEvaluationTab from './RiSuperAdminManageEvaluationTab';
import RiBatchesTab from './RiBatchesTab';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend,
  CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

// Professional RI Theme Palette (Clean MIT-WPU Admin Design Language)
const THEME = {
  primary: '#059669',        // Emerald 600
  primaryHover: '#047857',   // Emerald 700
  primaryDark: '#064e3b',    // Emerald 900
  primaryLight: '#ecfdf5',   // Emerald 50
  primaryBorder: '#a7f3d0',  // Emerald 200
  secondary: '#0284c7',      // Sky 600
  secondaryLight: '#f0f9ff', // Sky 50
  accent: '#10b981',         // Emerald 500
  dark: '#0f172a',           // Slate 900
  textMain: '#0f172a',       // Slate 900
  textMuted: '#64748b',      // Slate 500
  cardBg: '#ffffff',
  pageBg: '#f8fafc',
  border: '#e2e8f0',
  borderLight: '#f1f5f9'
};

const RI_ACTIVITIES = [
  { key: 'SCHOOL_ACTIVITY', label: 'School Activity', shortLabel: 'School' },
  { key: 'INSTITUTIONAL_VISIT', label: 'Institutional Visit', shortLabel: 'Inst. Visit' },
  { key: 'FAMILY_SURVEY', label: 'Family Visit', shortLabel: 'Family Visit' },
  { key: 'COMMUNITY_PROJECT', label: 'Community Project', shortLabel: 'Community' }
];

// Donut Progress Indicator for Overview cards
function DonutProgressRing({
  submitted = 0,
  total = 0,
  color = '#059669',
  label = 'Submitted',
  size = 80,
  strokeWidth = 7,
  title = ''
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeSubmitted = Math.max(0, Math.min(Number(submitted) || 0, safeTotal > 0 ? safeTotal : Number(submitted) || 0));
  const pct = safeTotal > 0 ? Math.round((safeSubmitted / safeTotal) * 100) : (safeSubmitted > 0 ? 100 : 0);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      style={{ position: 'relative', width: `${size}px`, height: `${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      title={`${title ? title + ': ' : ''}${safeSubmitted} / ${safeTotal} (${pct}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        lineHeight: 1
      }}>
        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {pct}%
        </div>
        <div style={{ fontSize: '8px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export default function RiSuperAdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Top-level Navigation: 'overview' | 'batches' | 'mapping' | 'faculty' | 'undertakings' | 'attendance' | 'evaluations' | 'reports' | 'readonly-admins' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');

  // Overview Sub-mode Switch: 'overview' (System-wide Executive) vs. 'cohort' (All Batch Statistics)
  const [overviewMode, setOverviewMode] = useState('overview');

  // Sidebar Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('ri_superadmin_sidebar_collapsed') === 'true';
  });
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

  // Auto-close mobile drawer if resized to desktop
  useEffect(() => {
    if (!isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, isSidebarOpen]);

  // Global Batches
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Executive Analytics
  const [analytics, setAnalytics] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Single Selected Batch Statistics / Details
  const [batchDetailData, setBatchDetailData] = useState(null);
  const [isLoadingBatchDetail, setIsLoadingBatchDetail] = useState(false);
  const [cohortSearch, setCohortSearch] = useState('');

  // Panel & Faculty Mapping State
  const [mappingData, setMappingData] = useState([]);
  const [isLoadingMapping, setIsLoadingMapping] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');
  const [selectedPanelDetail, setSelectedPanelDetail] = useState(null);
  const [panelDetailTab, setPanelDetailTab] = useState('students'); // 'students' | 'media'
  const [superAdminPanelMedia, setSuperAdminPanelMedia] = useState([]);
  const [isLoadingPanelMedia, setIsLoadingPanelMedia] = useState(false);

  const fetchSuperAdminPanelMedia = useCallback(async (panelId) => {
    if (!panelId) return;
    setIsLoadingPanelMedia(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/panels/${panelId}/media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuperAdminPanelMedia(data.media || []);
      } else {
        setSuperAdminPanelMedia([]);
      }
    } catch (err) {
      console.error('Error fetching superadmin panel media:', err);
      setSuperAdminPanelMedia([]);
    } finally {
      setIsLoadingPanelMedia(false);
    }
  }, []);

  const handleDeleteSuperAdminMedia = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/media/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuperAdminPanelMedia(prev => prev.filter(m => m.id !== mediaId));
      }
    } catch (err) {
      console.error('Error deleting superadmin media:', err);
    }
  };

  // Faculty Management State
  const [facultyList, setFacultyList] = useState([]);
  const [facultyDeptList, setFacultyDeptList] = useState([]);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyDeptFilter, setFacultyDeptFilter] = useState('all');
  const [facultyBatchFilter, setFacultyBatchFilter] = useState('');
  const [facultyUndertakingFilter, setFacultyUndertakingFilter] = useState('all');
  const [selectedFacultyDetail, setSelectedFacultyDetail] = useState(null);

  // Global Search State
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState(null);

  // Batches Filter State
  const [batchSearch, setBatchSearch] = useState('');
  const [batchSourceFilter, setBatchSourceFilter] = useState('all');
  const [batchStatusFilter, setBatchStatusFilter] = useState('all');

  // Tab-specific Batch Dropdown Filters (default to active batch)
  const [mappingBatchFilter, setMappingBatchFilter] = useState('');
  const [attendanceBatchFilter, setAttendanceBatchFilter] = useState('');
  const [evaluationsBatchFilter, setEvaluationsBatchFilter] = useState('');
  const [undertakingsBatchFilter, setUndertakingsBatchFilter] = useState('');

  // Manage Attendance (Superadmin Panel Attendance & Lock Control)
  const [manageAttBatchId, setManageAttBatchId] = useState('');
  const [manageAttPanels, setManageAttPanels] = useState([]);
  const [isLoadingManageAttPanels, setIsLoadingManageAttPanels] = useState(false);
  const [selectedManagePanel, setSelectedManagePanel] = useState(null);
  const [managePanelDetail, setManagePanelDetail] = useState(null);
  const [isLoadingManagePanelDetail, setIsLoadingManagePanelDetail] = useState(false);
  const [manageAttSearch, setManageAttSearch] = useState('');
  const [manageAttActiveActivity, setManageAttActiveActivity] = useState('SCHOOL_ACTIVITY');
  const [manageAttEditedAttendance, setManageAttEditedAttendance] = useState({});
  const [isSavingManageAtt, setIsSavingManageAtt] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);
  const [showTempUnlockModal, setShowTempUnlockModal] = useState(false);
  const [tempUnlockActivity, setTempUnlockActivity] = useState('SCHOOL_ACTIVITY');
  const [tempUnlockDate, setTempUnlockDate] = useState('');
  const [tempUnlockReason, setTempUnlockReason] = useState('');
  const [tempUnlockAllActivities, setTempUnlockAllActivities] = useState(false);
  const [isSubmittingTempUnlock, setIsSubmittingTempUnlock] = useState(false);

  // Account Security — Change Password State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Read-Only Super Admins Management State
  const [readonlyAdmins, setReadonlyAdmins] = useState([]);
  const [isLoadingReadonlyAdmins, setIsLoadingReadonlyAdmins] = useState(false);
  const [readonlySearch, setReadonlySearch] = useState('');
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', employee_id: '' });
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [actionAdminId, setActionAdminId] = useState(null);
  const [readonlyPage, setReadonlyPage] = useState(1);
  const readonlyItemsPerPage = 8;

  // Toast Notifications
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ri_superadmin_sidebar_collapsed', String(next));
      return next;
    });
  };

  // ─── Fetch Read-Only Super Admins ─────────────────────────────────────────
  const fetchReadonlyAdmins = useCallback(async (silent = false) => {
    if (!silent) setIsLoadingReadonlyAdmins(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/readonly-admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReadonlyAdmins(data.readonly_admins || []);
      } else {
        if (!silent) addToast('Failed to load super admins list', 'error');
      }
    } catch (err) {
      console.error('Error fetching read-only super admins:', err);
      if (!silent) addToast('Network error loading super admins', 'error');
    } finally {
      if (!silent) setIsLoadingReadonlyAdmins(false);
    }
  }, [token, addToast]);

  // ─── Handle Add Read-Only Super Admin ─────────────────────────────────────
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name.trim()) {
      addToast('Name is required', 'error');
      return;
    }
    if (!adminForm.email.trim()) {
      addToast('Email is required', 'error');
      return;
    }
    if (!adminForm.employee_id.trim()) {
      addToast('Employee ID is required', 'error');
      return;
    }

    setIsSubmittingAdmin(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/readonly-admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: adminForm.name.trim(),
          email: adminForm.email.trim(),
          employee_id: adminForm.employee_id.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Super Admin added successfully', 'success');
        setShowAddAdminModal(false);
        setAdminForm({ name: '', email: '', employee_id: '' });
        fetchReadonlyAdmins(true);
      } else {
        addToast(data.message || 'Failed to add super admin', 'error');
      }
    } catch (err) {
      console.error('Error creating super admin:', err);
      addToast('Network error creating super admin', 'error');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  // ─── Handle Revoke Read-Only Super Admin ──────────────────────────────────
  const handleRevokeAdmin = async (adminId, adminName) => {
    if (!window.confirm(`Are you sure you want to revoke Super Admin access for ${adminName || 'this user'}?`)) {
      return;
    }
    setActionAdminId(adminId);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/readonly-admins/${adminId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Super Admin access revoked', 'success');
        setReadonlyAdmins(prev => prev.filter(a => a.id !== adminId));
      } else {
        addToast(data.message || 'Failed to revoke access', 'error');
      }
    } catch (err) {
      console.error('Error revoking admin access:', err);
      addToast('Network error revoking access', 'error');
    } finally {
      setActionAdminId(null);
    }
  };

  // ─── Fetch Batches ────────────────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const batchList = data.batches || [];
        setBatches(batchList);
        if (batchList.length > 0) {
          const activeBatch = batchList.find(b => (b.status || '').toLowerCase() === 'active') || batchList[0];
          const activeId = String(activeBatch.id);
          setSelectedBatchId(prev => prev || activeId);
          setMappingBatchFilter(prev => (!prev || prev === 'all') ? activeId : prev);
          setAttendanceBatchFilter(prev => (!prev || prev === 'all') ? activeId : prev);
          setManageAttBatchId(prev => (!prev || prev === 'all') ? activeId : prev);
          setEvaluationsBatchFilter(prev => (!prev || prev === 'all') ? activeId : prev);
          setUndertakingsBatchFilter(prev => (!prev || prev === 'all') ? activeId : prev);
          setFacultyBatchFilter(prev => (!prev || prev === 'all') ? activeId : prev);
        }
      }
    } catch (err) {
      console.error('Error fetching RI batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [token]);

  // ─── Handle Change Password ───────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      addToast('Please enter your current password', 'error');
      return;
    }
    if (!passwordForm.newPassword) {
      addToast('Please enter a new password', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      addToast('New password must be at least 6 characters', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addToast('New password and confirmation do not match', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Password changed successfully', 'success');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        addToast(data.message || 'Failed to change password', 'error');
      }
    } catch (err) {
      console.error('Password change error:', err);
      addToast('Network error updating password', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ─── Fetch Executive Analytics ───────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error loading RI Super Admin analytics:', err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [token]);

  // ─── Fetch Single Batch Detail (Cohort Mode) ─────────────────────────────
  const fetchBatchDetail = useCallback(async (batchId) => {
    if (!batchId) return;
    setIsLoadingBatchDetail(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/batches/${batchId}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatchDetailData(data);
      } else {
        addToast('Failed to load batch statistics', 'error');
      }
    } catch (err) {
      console.error('Error loading batch detail:', err);
      addToast('Network error loading batch statistics', 'error');
    } finally {
      setIsLoadingBatchDetail(false);
    }
  }, [token, addToast]);

  // ─── Fetch Panel & Faculty Mapping ────────────────────────────────────────
  const fetchMapping = useCallback(async () => {
    setIsLoadingMapping(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/panel-faculty-mapping`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMappingData(data.mapping || []);
      }
    } catch (err) {
      console.error('Error loading mapping:', err);
    } finally {
      setIsLoadingMapping(false);
    }
  }, [token]);

  // ─── Fetch Faculty Directory ──────────────────────────────────────────────
  const fetchFaculty = useCallback(async () => {
    setIsLoadingFaculty(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/faculty-management`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFacultyList(data.faculty || []);
        setFacultyDeptList(data.departments || []);
      }
    } catch (err) {
      console.error('Error loading faculty:', err);
    } finally {
      setIsLoadingFaculty(false);
    }
  }, [token]);

  const handleDownloadFacultyUndertakingPdf = async (faculty) => {
    try {
      const targetId = faculty.user_id || faculty.faculty_id || faculty.id;
      const res = await fetch(`${API}/api/ri/faculty/${targetId}/undertaking-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to download PDF');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RI_Faculty_Undertaking_${(faculty.name || 'Faculty').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      addToast(err.message || 'Could not download undertaking PDF', 'error');
    }
  };

  // ─── Manage Attendance API Handlers ─────────────────────────────────────────
  const fetchManageAttendancePanels = useCallback(async (batchId) => {
    const targetBatchId = batchId || manageAttBatchId || selectedBatchId;
    if (!targetBatchId || targetBatchId === 'all') return;
    setIsLoadingManageAttPanels(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/attendance/panels?batch_id=${targetBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const batchName = data.batch?.name || batches.find(b => String(b.id) === String(targetBatchId))?.name || '';
        const normalized = (data.panels || []).map(p => {
          let facultyNames = '';
          if (p.faculty_names && typeof p.faculty_names === 'string' && p.faculty_names.trim()) {
            facultyNames = p.faculty_names.trim();
          } else if (p.faculty_name && typeof p.faculty_name === 'string' && p.faculty_name.trim()) {
            facultyNames = p.faculty_name.trim();
          } else if (Array.isArray(p.assigned_faculty) && p.assigned_faculty.length > 0) {
            facultyNames = p.assigned_faculty
              .map(f => (typeof f === 'string' ? f : (f.name || f.faculty_name || f.email)))
              .filter(Boolean)
              .join(', ');
          }

          const actMap = {};
          RI_ACTIVITIES.forEach(act => {
            const actStats = p.activities?.[act.key] || p[act.key.toLowerCase()] || p[act.key] || {};
            const marked = actStats.marked ?? p[`${act.key}_marked_count`] ?? p[`${act.key.toLowerCase()}_marked`] ?? 0;
            const present = actStats.present ?? p[`${act.key}_present`] ?? p[`${act.key.toLowerCase()}_present`] ?? 0;
            const absent = actStats.absent ?? p[`${act.key}_absent`] ?? p[`${act.key.toLowerCase()}_absent`] ?? 0;
            const unmarked = actStats.unmarked ?? Math.max(0, (p.student_count || 0) - marked);
            const isLocked = Boolean(actStats.is_locked ?? p[`${act.key}_locked`] ?? p[`${act.key.toLowerCase()}_locked`]);
            const lockedAt = actStats.locked_at ?? p[`${act.key}_locked_at`] ?? p[`${act.key.toLowerCase()}_locked_at`] ?? null;

            actMap[act.key] = {
              marked,
              present,
              absent,
              unmarked,
              is_locked: isLocked,
              locked_at: lockedAt
            };
          });

          return {
            ...p,
            panel_name: p.panel_name || p.name || `Panel #${p.panel_number || ''}`,
            batch_name: p.batch_name || batchName,
            faculty_names: facultyNames || 'Unassigned',
            activities: {
              ...(p.activities || {}),
              ...actMap
            },
            ...Object.keys(actMap).reduce((acc, k) => {
              acc[`${k}_locked`] = actMap[k].is_locked;
              acc[`${k}_marked_count`] = actMap[k].marked;
              acc[`${k}_present`] = actMap[k].present;
              acc[`${k}_absent`] = actMap[k].absent;
              return acc;
            }, {})
          };
        });
        setManageAttPanels(normalized);
      } else {
        addToast('Failed to load batch attendance panels', 'error');
      }
    } catch (err) {
      console.error('Error fetching manage attendance panels:', err);
      addToast('Error loading attendance panels', 'error');
    } finally {
      setIsLoadingManageAttPanels(false);
    }
  }, [token, manageAttBatchId, selectedBatchId, batches, addToast]);

  const fetchManagePanelDetail = useCallback(async (panelId, batchId) => {
    const targetBatchId = batchId || manageAttBatchId || selectedBatchId;
    if (!panelId || !targetBatchId) return;
    setIsLoadingManagePanelDetail(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/attendance/panel-detail?panel_id=${panelId}&batch_id=${targetBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setManagePanelDetail(data);

        // Initialize editable state
        const initialMap = {};
        (data.students || []).forEach(st => {
          const getStStatus = (actKey) => {
            return st[actKey] || st[actKey.toLowerCase()] || st.activities?.[actKey]?.code || (st.activities?.[actKey]?.status === 'Present' ? 'P' : (st.activities?.[actKey]?.status === 'Absent' ? 'A' : 'Unmarked')) || 'Unmarked';
          };
          initialMap[st.student_id] = {
            SCHOOL_ACTIVITY: getStStatus('SCHOOL_ACTIVITY'),
            INSTITUTIONAL_VISIT: getStStatus('INSTITUTIONAL_VISIT'),
            FAMILY_SURVEY: getStStatus('FAMILY_SURVEY'),
            COMMUNITY_PROJECT: getStStatus('COMMUNITY_PROJECT'),
            remarks: st.remarks || ''
          };
        });
        setManageAttEditedAttendance(initialMap);
      } else {
        addToast('Failed to load panel attendance details', 'error');
      }
    } catch (err) {
      console.error('Error loading panel detail:', err);
      addToast('Error loading panel detail', 'error');
    } finally {
      setIsLoadingManagePanelDetail(false);
    }
  }, [token, manageAttBatchId, selectedBatchId, addToast]);

  const handleSuperadminMarkStudent = (studentId, activity, status) => {
    if (isReadOnly) {
      addToast('Read-only Super Admins cannot modify attendance', 'warning');
      return;
    }
    setManageAttEditedAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [activity]: status
      }
    }));
  };

  const handleSuperadminBulkMark = (activity, status) => {
    if (isReadOnly) {
      addToast('Read-only Super Admins cannot modify attendance', 'warning');
      return;
    }
    setManageAttEditedAttendance(prev => {
      const updated = { ...prev };
      (managePanelDetail?.students || []).forEach(st => {
        updated[st.student_id] = {
          ...(updated[st.student_id] || {}),
          [activity]: status
        };
      });
      return updated;
    });
  };

  const handleSuperadminSaveAttendance = async (activity) => {
    if (isReadOnly) {
      addToast('Read-only Super Admins cannot save attendance changes', 'error');
      return;
    }
    if (!selectedManagePanel || !managePanelDetail) return;
    const targetBatchId = manageAttBatchId || selectedBatchId;

    const records = (managePanelDetail.students || []).map(st => {
      const state = manageAttEditedAttendance[st.student_id] || {};
      const rawStatus = state[activity] || st[activity] || st[activity.toLowerCase()] || st.activities?.[activity]?.code || 'Unmarked';
      const status = (rawStatus === 'P' || rawStatus === 'Present') ? 'Present' : ((rawStatus === 'A' || rawStatus === 'Absent') ? 'Absent' : 'Unmarked');
      return {
        student_id: st.student_id,
        status: status,
        remarks: state.remarks || ''
      };
    });

    setIsSavingManageAtt(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/attendance/panel-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: targetBatchId,
          panel_id: selectedManagePanel.id,
          activity: activity,
          attendance: records
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const actLabel = RI_ACTIVITIES.find(a => a.key === activity)?.label || 'Activity';
        addToast(`${actLabel} attendance saved successfully!`);
        await fetchManagePanelDetail(selectedManagePanel.id, targetBatchId);
        fetchManageAttendancePanels(targetBatchId);
      } else {
        addToast(data.message || 'Failed to save attendance', 'error');
      }
    } catch (err) {
      console.error('Superadmin save attendance error:', err);
      addToast('Network error while saving attendance', 'error');
    } finally {
      setIsSavingManageAtt(false);
    }
  };

  const handleSuperadminToggleLock = async (activity, shouldLock) => {
    if (isReadOnly) {
      addToast('Read-only Super Admins cannot modify lock status', 'error');
      return;
    }
    if (!selectedManagePanel) return;
    const targetBatchId = manageAttBatchId || selectedBatchId;
    setIsTogglingLock(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/attendance/toggle-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: targetBatchId,
          panel_id: selectedManagePanel.id,
          activity: activity,
          lock: shouldLock
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const actLabel = RI_ACTIVITIES.find(a => a.key === activity)?.label || 'Activity';
        addToast(data.message || `${actLabel} lock status updated`);
        await fetchManagePanelDetail(selectedManagePanel.id, targetBatchId);
        fetchManageAttendancePanels(targetBatchId);
      } else {
        addToast(data.message || 'Failed to update lock status', 'error');
      }
    } catch (err) {
      console.error('Superadmin lock toggle error:', err);
      addToast('Network error while toggling lock status', 'error');
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleOpenTempUnlockModal = (activityKey) => {
    setTempUnlockActivity(activityKey || manageAttActiveActivity || 'SCHOOL_ACTIVITY');
    // Default unlock date: 2 days in the future
    const defDate = new Date();
    defDate.setDate(defDate.getDate() + 2);
    const yyyy = defDate.getFullYear();
    const mm = String(defDate.getMonth() + 1).padStart(2, '0');
    const dd = String(defDate.getDate()).padStart(2, '0');
    setTempUnlockDate(`${yyyy}-${mm}-${dd}`);
    setTempUnlockReason('');
    setTempUnlockAllActivities(false);
    setShowTempUnlockModal(true);
  };

  const handleSuperadminTemporaryUnlock = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) {
      addToast('Read-only Super Admins cannot modify lock status', 'error');
      return;
    }
    if (!selectedManagePanel) return;
    if (!tempUnlockDate) {
      addToast('Please select a valid unlock until date', 'error');
      return;
    }

    const targetBatchId = manageAttBatchId || selectedBatchId;
    setIsSubmittingTempUnlock(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/attendance/toggle-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: targetBatchId,
          panel_id: selectedManagePanel.id,
          activity: tempUnlockAllActivities ? 'ALL' : tempUnlockActivity,
          all_activities: tempUnlockAllActivities,
          action: 'temp_unlock',
          unlocked_until: tempUnlockDate,
          reason: tempUnlockReason.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Attendance temporarily unlocked successfully');
        setShowTempUnlockModal(false);
        await fetchManagePanelDetail(selectedManagePanel.id, targetBatchId);
        fetchManageAttendancePanels(targetBatchId);
      } else {
        addToast(data.message || 'Failed to temporarily unlock attendance', 'error');
      }
    } catch (err) {
      console.error('Superadmin temporary unlock error:', err);
      addToast('Network error while applying temporary unlock', 'error');
    } finally {
      setIsSubmittingTempUnlock(false);
    }
  };

  // ─── Global Search ────────────────────────────────────────────────────────
  const performGlobalSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setGlobalSearchResults(null);
      return;
    }
    try {
      const res = await fetch(`${API}/api/ri/superadmin/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalSearchResults(data.results);
      }
    } catch (err) {
      console.error('Global search error:', err);
    }
  }, [token]);

  // Initial Load
  useEffect(() => {
    fetchBatches();
    fetchAnalytics();
  }, [fetchBatches, fetchAnalytics]);

  // Load batch details when in cohort mode or when selectedBatchId changes
  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchDetail(selectedBatchId);
    }
  }, [selectedBatchId, fetchBatchDetail]);

  useEffect(() => {
    if (activeTab === 'mapping') fetchMapping();
    if (activeTab === 'faculty') fetchFaculty();
    if (activeTab === 'manage-attendance') {
      const bId = manageAttBatchId || selectedBatchId;
      if (bId) fetchManageAttendancePanels(bId);
    }
  }, [activeTab, fetchMapping, fetchFaculty, manageAttBatchId, selectedBatchId, fetchManageAttendancePanels]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Helper: Download Batch Multi-Sheet Excel
  const downloadBatchSummaryExcel = async (batchId, batchName) => {
    const targetId = batchId || selectedBatchId;
    if (!targetId) {
      addToast('Please select a batch first', 'warning');
      return;
    }
    try {
      addToast('Preparing multi-sheet master Excel workbook...', 'info');
      const res = await fetch(`${API}/api/ri/superadmin/batches/${targetId}/export-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const targetBatch = batches.find(b => String(b.id) === String(targetId));
        const cleanName = (batchName || targetBatch?.name || `Batch_${targetId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `RI_Batch_${targetId}_${cleanName}_Master_Summary.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast('Master Excel report downloaded successfully!');
      } else {
        addToast('Failed to export batch summary', 'error');
      }
    } catch (err) {
      console.error('Download export error:', err);
      addToast('Export failed due to network error', 'error');
    }
  };

  // Helper: Download Generic Report (Attendance, Evaluation, Forms, etc.)
  const downloadGenericReport = async (reportType, format = 'excel') => {
    try {
      addToast(`Generating ${reportType} report...`, 'info');
      const url = `${API}/api/ri/reports/${reportType}?format=${format}${selectedBatchId ? `&batch_id=${selectedBatchId}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `RI_${reportType.toUpperCase()}_Report_${Date.now()}.${format === 'excel' ? 'xlsx' : 'csv'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        addToast(`${reportType} report downloaded!`);
      } else {
        addToast('Failed to generate report', 'error');
      }
    } catch (err) {
      console.error('Report export error:', err);
      addToast('Error downloading report', 'error');
    }
  };

  const isReadOnly = (currentUser?.role || '').toLowerCase().includes('readonly');

  // Sidebar navigation menu
  const navItems = [
    { id: 'overview', label: 'Overview & Statistics', icon: Home },
    { id: 'batches', label: 'Batches', icon: Layers },
    { id: 'mapping', label: 'Panels & Villages', icon: Grid },
    { id: 'faculty', label: 'Faculty Management', icon: UserCheck },
    { id: 'submissions', label: 'Submissions', icon: ClipboardList },
    { id: 'faculty_uploads', label: 'Faculty Uploads', icon: UploadCloud },
    { id: 'undertakings', label: 'Undertaking Analytics', icon: ShieldCheck },
    { id: 'manage-attendance', label: 'Manage Attendance', icon: CalendarCheck },
    { id: 'manage-evaluations', label: 'Manage Evaluation', icon: CheckSquare },
    { id: 'evaluations', label: 'Evaluations & Grading', icon: Award },
    { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet },
    { id: 'tickets', label: 'Support Tickets', icon: MessageSquare },
    { id: 'redflags', label: 'Red Flags', icon: AlertTriangle },
    { id: 'orangeflags', label: 'Orange Flags', icon: Flag },
    ...(!isReadOnly ? [{ id: 'readonly-admins', label: 'Read Only Super Admins', icon: UserPlus, badge: readonlyAdmins.length > 0 ? readonlyAdmins.length : undefined }] : []),
    ...(isReadOnly ? [{ id: 'settings', label: 'Settings', icon: Settings }] : [])
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: THEME.pageBg, fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Toast Notification Banner */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: t.type === 'error' ? '#ef4444' : t.type === 'info' ? '#0284c7' : '#059669',
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '13px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {t.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{t.message}</span>
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
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 49,
            transition: 'opacity 0.25s ease'
          }}
        />
      )}

      {/* ─── SIDEBAR NAVIGATION (CLEAN WHITE ADMIN LAYOUT) ─── */}
      <aside style={{
        width: isMobile ? '280px' : (isCollapsed ? '72px' : '260px'),
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        bottom: isMobile ? 0 : 'auto',
        left: isMobile ? 0 : 'auto',
        height: '100vh',
        zIndex: 50,
        boxShadow: isMobile
          ? (isSidebarOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none')
          : '1px 0 6px rgba(0,0,0,0.02)',
        transform: isMobile
          ? (isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)')
          : 'none',
        transition: isMobile
          ? 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none'
      }}>
        {/* Floating circular toggle button (Desktop only) */}
        {!isMobile && (
          <button
            onClick={toggleSidebarCollapse}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              position: 'absolute',
              top: '26px',
              right: '-12px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              zIndex: 60,
              color: '#475569',
              outline: 'none',
              padding: 0
            }}
          >
            <ChevronRight size={13} style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
          </button>
        )}

        {/* Brand Header */}
        <div style={{
          height: '74px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          padding: (!isMobile && isCollapsed) ? '0' : '0 20px',
          justifyContent: (!isMobile && isCollapsed) ? 'center' : 'flex-start',
          gap: 12,
          overflow: 'hidden'
        }}>
          {(!isCollapsed || isMobile) ? (
            <img
              src="/ri11.png"
              alt="Rural Immersion Logo"
              onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
              style={{
                height: '38px',
                maxWidth: '175px',
                objectFit: 'contain'
              }}
            />
          ) : (
            <img
              src="/ri-logo-mob.png"
              alt="Rural Immersion Logo"
              style={{
                height: '34px',
                width: '34px',
                objectFit: 'contain'
              }}
            />
          )}
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close Sidebar"
              style={{
                marginLeft: 'auto',
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
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
        <div style={{ flex: 1, padding: '16px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobile) setIsSidebarOpen(false);
                  if (item.id === 'batches') fetchBatches();
                  if (item.id === 'mapping') fetchMapping();
                  if (item.id === 'faculty') fetchFaculty();
                  if (item.id === 'submissions') fetchBatches();
                  if (item.id === 'readonly-admins') fetchReadonlyAdmins();
                }}
                title={(!isMobile && isCollapsed) ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: (!isMobile && isCollapsed) ? '10px 0' : '10px 14px',
                  justifyContent: (!isMobile && isCollapsed) ? 'center' : 'flex-start',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? '#047857' : 'transparent',
                  color: isActive ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '13.5px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#475569';
                  }
                }}
              >
                <Icon size={18} color={isActive ? '#ffffff' : '#047857'} />
                {(!isCollapsed || isMobile) && <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>{item.label}</span>}
                {(!isCollapsed || isMobile) && item.badge !== undefined && (
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: isActive ? 'rgba(255,255,255,0.2)' : '#ecfdf5',
                    color: isActive ? '#ffffff' : '#047857',
                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid #a7f3d0'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer / User Profile */}
        <div style={{
          padding: (!isMobile && isCollapsed) ? '12px 6px' : '12px 14px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          {(!isCollapsed || isMobile) && (
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.name || 'RI Super Admin'}
              </div>
              <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700', marginTop: 1 }}>
                superadmin-ri
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (isMobile) setIsSidebarOpen(false);
              handleLogout();
            }}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #fee2e2',
              backgroundColor: '#fff5f5',
              color: '#dc2626',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#fff5f5';
              e.currentTarget.style.borderColor = '#fee2e2';
            }}
          >
            <LogOut size={15} />
            {(!isCollapsed || isMobile) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%', overflowX: 'hidden' }}>
        
        {/* Top Header Bar (Consistent RI Green Design) */}
        <header style={{
          height: isMobile ? 'calc(56px + env(safe-area-inset-top, 0px))' : '56px',
          backgroundColor: '#047857',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
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
          gap: 10,
          boxSizing: 'border-box'
        }}>
          {/* Left: Mobile Drawer Trigger + Title / Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isSmallMobile ? '8px' : '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {isMobile && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label="Toggle Navigation Menu"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '6px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Menu size={18} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: isSmallMobile ? '4px' : '8px', fontSize: isSmallMobile ? '13px' : '15px', fontWeight: '600', color: '#ffffff', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ whiteSpace: 'nowrap' }}>{isSmallMobile ? 'RI' : 'RI Super Admin'}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 2px' }}>/</span>
              <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeTab === 'overview' && 'Overview & Statistics'}
                {activeTab === 'batches' && 'Batches Overview'}
                {activeTab === 'mapping' && 'Panels & Villages'}
                {activeTab === 'faculty' && 'Faculty Management'}
                {activeTab === 'submissions' && 'Student Submissions'}
                {activeTab === 'faculty_uploads' && 'Faculty Uploads'}
                {activeTab === 'undertakings' && 'Undertaking Analytics'}
                {activeTab === 'manage-attendance' && 'Manage Attendance'}
                {activeTab === 'manage-evaluations' && 'Manage Evaluation'}
                {activeTab === 'evaluations' && 'Evaluations & Grading'}
                {activeTab === 'reports' && 'Reports & Exports'}
                {activeTab === 'tickets' && 'Support Tickets'}
                {activeTab === 'redflags' && 'Student Red Flags'}
                {activeTab === 'orangeflags' && 'Student Orange Flags'}
                {activeTab === 'readonly-admins' && 'Read Only Super Admins'}
                {activeTab === 'settings' && 'Account Settings & Security'}
              </span>
            </div>
          </div>

          {/* Right: Quick actions (Refresh) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => {
                fetchAnalytics();
                fetchBatches();
                if (selectedBatchId) fetchBatchDetail(selectedBatchId);
                if (activeTab === 'mapping') fetchMapping();
                if (activeTab === 'faculty') fetchFaculty();
                if (activeTab === 'readonly-admins') fetchReadonlyAdmins();
                addToast('Statistics refreshed');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: isSmallMobile ? '6px 10px' : '6px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <RefreshCw size={13} className={isLoadingAnalytics ? 'spin' : ''} />
              {!isSmallMobile && <span>Refresh</span>}
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div style={{ padding: isMobile ? (isSmallMobile ? '12px 10px' : '16px 14px') : '24px 28px', flex: 1, minWidth: 0, overflowX: 'hidden' }}>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: OVERVIEW & SYSTEM STATISTICS (WITH 2 SUB-TABS)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Top Sub-Tab Switcher (Overview vs All Batch Statistics) */}
              <div style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '14px',
                gap: '12px'
              }}>
                <div style={{
                  display: 'inline-flex',
                  width: isMobile ? '100%' : 'auto',
                  background: '#f1f5f9',
                  borderRadius: '9999px',
                  padding: '4px',
                  border: '1px solid #e2e8f0'
                }}>
                  <button
                    onClick={() => setOverviewMode('overview')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      borderRadius: '9999px',
                      padding: isSmallMobile ? '6px 10px' : '6px 20px',
                      fontSize: isSmallMobile ? '12px' : '13px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: overviewMode === 'overview' ? '#ffffff' : 'transparent',
                      color: overviewMode === 'overview' ? '#0f172a' : '#64748b',
                      boxShadow: overviewMode === 'overview' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Overview
                  </button>

                  <button
                    onClick={() => setOverviewMode('cohort')}
                    style={{
                      flex: isMobile ? 1 : 'none',
                      borderRadius: '9999px',
                      padding: isSmallMobile ? '6px 10px' : '6px 20px',
                      fontSize: isSmallMobile ? '12px' : '13px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer',
                      background: overviewMode === 'cohort' ? '#ffffff' : 'transparent',
                      color: overviewMode === 'cohort' ? '#0f172a' : '#64748b',
                      boxShadow: overviewMode === 'cohort' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    All Batch Statistics
                  </button>
                </div>

                {/* Right: Select Batch dropdown placed on the right side in the line of Overview / All Batch Statistics */}
                {overviewMode === 'cohort' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : 'flex-end',
                    width: isMobile ? '100%' : 'auto',
                    gap: 10
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>
                      Select Batch:
                    </span>
                    <select
                      value={selectedBatchId}
                      onChange={e => setSelectedBatchId(e.target.value)}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        maxWidth: isMobile ? '100%' : '320px',
                        padding: '7px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
                {/* ─────────────────────────────────────────────────────────────
                  MODE 1: OVERVIEW (SYSTEM-WIDE RI STATISTICS)
                 ───────────────────────────────────────────────────────────── */}
              {overviewMode === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* 1. 8 Overview Statistic Cards with Dotted Design */}
                  <div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile
                        ? 'repeat(2, minmax(0, 1fr))'
                        : 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: isMobile ? '10px' : '16px'
                    }}>
                      {[
                        { title: 'Total RI Students', value: analytics?.overview?.total_ri_students || 0, icon: <GraduationCap size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'Total RI Batches', value: analytics?.overview?.total_ri_batches || 0, icon: <Layers size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'RI-Only Batches', value: analytics?.overview?.ri_direct_batches || 0, icon: <Compass size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'LTC + RI Batches', value: analytics?.overview?.ltc_synced_batches || 0, icon: <RefreshCw size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'Completed Batches', value: analytics?.overview?.completed_batches || 0, icon: <CheckCircle2 size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'Total RI Panels', value: analytics?.overview?.total_ri_panels || 0, icon: <Grid size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'Total Villages', value: analytics?.overview?.total_ri_villages || 0, icon: <MapPin size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> },
                        { title: 'Emails Sent', value: analytics?.overview?.emails_sent || 0, icon: <Mail size={isMobile ? 15 : 18} color="#047857" strokeWidth={2.4} /> }
                      ].map((card, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                            padding: isMobile ? '12px 14px' : '18px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: isMobile ? '92px' : '115px',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.25s ease',
                            cursor: 'default'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.05)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.015)';
                          }}
                        >
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, gap: 4 }}>
                            <span style={{
                              fontSize: isMobile ? '11px' : '12.5px',
                              fontWeight: '700',
                              color: '#475569',
                              letterSpacing: '-0.2px',
                              lineHeight: 1.25,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {card.title}
                            </span>
                            <div style={{
                              width: isMobile ? '28px' : '34px',
                              height: isMobile ? '28px' : '34px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              boxShadow: '0 6px 15px -3px rgba(4,120,87,0.18)',
                              border: '1px solid rgba(4,120,87,0.09)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {card.icon}
                            </div>
                          </div>

                          {/* Value */}
                          <div style={{ zIndex: 2, marginTop: '6px' }}>
                            <h3 style={{
                              fontSize: isMobile ? '22px' : '28px',
                              fontWeight: '900',
                              color: '#0f172a',
                              margin: 0,
                              letterSpacing: '-0.5px',
                              lineHeight: 1.1
                            }}>
                              {isLoadingAnalytics ? '—' : card.value}
                            </h3>
                          </div>

                          {/* Bottom-right dotted overlay design */}
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '90px',
                            height: '70px',
                            background: 'radial-gradient(circle at bottom right, rgba(5,150,105,0.07), transparent 70%)',
                            pointerEvents: 'none',
                            zIndex: 1
                          }}>
                            <div style={{
                              width: '100%',
                              height: '100%',
                              backgroundImage: 'radial-gradient(rgba(5,150,105,0.18) 1.5px, transparent 1.5px)',
                              backgroundSize: '8px 8px',
                              WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                              maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. System Charts (Enrollment Bar, Attendance Trend, Gender Demographics) */}
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      System Charts
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
                      Visual charts for cohort enrollment, student demographics, and village attendance presence.
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: isMobile ? '16px' : '20px'
                    }}>
                      
                      {/* 1. Students per Batch */}
                      <div style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: isMobile ? '270px' : '280px',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={16} color="#047857" /> Enrollment (Students per Batch)
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>Registration metrics across batch cohorts</p>
                        </div>
                        <div style={{ height: '195px', width: '100%' }}>
                          {analytics?.students_per_batch && analytics.students_per_batch.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analytics.students_per_batch} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="riEnrollGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#047857" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.7} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="batch_name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                  cursor={{ fill: 'rgba(4, 120, 87, 0.04)' }}
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div style={{ background: '#0f172a', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#34d399', marginTop: '2px' }}>
                                            {payload[0].value} Students
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="student_count" fill="url(#riEnrollGrad)" radius={[6, 6, 0, 0]} barSize={32} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '12px' }}>No batch data available</div>
                          )}
                        </div>
                      </div>

                      {/* 2. Attendance Immersion Trend */}
                      <div style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: isMobile ? '270px' : '280px',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} color="#0284c7" /> Immersion Attendance Trend
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>Activity-wise village attendance presence</p>
                        </div>
                        <div style={{ height: '195px', width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={RI_ACTIVITIES.map(act => ({
                                label: act.shortLabel,
                                fullName: act.label,
                                present: analytics?.attendance_overview?.[act.key]?.present || 0,
                                absent: analytics?.attendance_overview?.[act.key]?.absent || 0
                              }))}
                              margin={{ left: -20, right: 10, top: 10, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="riAttendGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.01} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                              <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div style={{ background: '#0f172a', color: '#ffffff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{data.fullName}</div>
                                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                                          {data.present} Present Students
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                ;}}
                              />
                              <Area type="monotone" dataKey="present" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#riAttendGrad)" dot={{ r: 4, stroke: '#0284c7', strokeWidth: 2, fill: '#ffffff' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 3. Gender Distribution */}
                      <div style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: isMobile ? 'auto' : '280px',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={16} color="#7c3aed" /> Gender Demographics
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>Cohort gender breakdown profile</p>
                        </div>
                        <div style={{
                          height: isMobile ? 'auto' : '195px',
                          display: 'flex',
                          flexDirection: isSmallMobile ? 'column' : 'row',
                          alignItems: 'center',
                          justifyContent: 'space-around',
                          gap: 12,
                          padding: isMobile ? '8px 0' : 0
                        }}>
                          {(() => {
                            const rawData = analytics?.gender_distribution || [];
                            const normalizeGender = (g) => {
                              if (!g) return 'Unspecified';
                              const l = String(g).toLowerCase().trim();
                              if (l === 'male' || l === 'm' || l === 'boy') return 'Male';
                              if (l === 'female' || l === 'f' || l === 'girl') return 'Female';
                              if (l.includes('m') && !l.includes('f')) return 'Male';
                              if (l.includes('f')) return 'Female';
                              return 'Unspecified';
                            };

                            let maleCount = 0;
                            let femaleCount = 0;
                            let unspecifiedCount = 0;

                            rawData.forEach(r => {
                              const k = normalizeGender(r.gender);
                              const cnt = Number(r.count || 0);
                              if (k === 'Male') maleCount += cnt;
                              else if (k === 'Female') femaleCount += cnt;
                              else unspecifiedCount += cnt;
                            });

                            const total = maleCount + femaleCount + unspecifiedCount;
                            const malePct = total > 0 ? Math.round((maleCount / total) * 100) : 0;
                            const femalePct = total > 0 ? Math.round((femaleCount / total) * 100) : 0;
                            const unspecifiedPct = total > 0 ? Math.round((unspecifiedCount / total) * 100) : 0;

                            const colorMap = { 'Male': '#0284c7', 'Female': '#ec4899', 'Unspecified': '#94a3b8' };

                            const chartData = [
                              { name: 'Male', value: maleCount },
                              { name: 'Female', value: femaleCount },
                              ...(unspecifiedCount > 0 ? [{ name: 'Unspecified', value: unspecifiedCount }] : [])
                            ].filter(d => d.value > 0);

                            if (total === 0) {
                              return (
                                <>
                                  <div style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    border: '10px solid #f1f5f9',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxSizing: 'border-box'
                                  }}>
                                    <Users size={22} color="#94a3b8" />
                                    <span style={{ fontSize: '10px', fontWeight: '750', color: '#94a3b8', marginTop: '3px' }}>0 Students</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: isSmallMobile ? '100%' : '120px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorMap['Male'] }}></span>
                                        <span style={{ color: '#475569', fontWeight: '600' }}>Male</span>
                                      </div>
                                      <span style={{ fontWeight: '800', color: '#0f172a' }}>0 (0%)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorMap['Female'] }}></span>
                                        <span style={{ color: '#475569', fontWeight: '600' }}>Female</span>
                                      </div>
                                      <span style={{ fontWeight: '800', color: '#0f172a' }}>0 (0%)</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                                      No RI student records available
                                    </div>
                                  </div>
                                </>
                              );
                            }

                            return (
                              <>
                                <div style={{ width: '120px', height: '120px', flexShrink: 0 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RechartsPieChart>
                                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={36} outerRadius={52} paddingAngle={4} cornerRadius={4} dataKey="value">
                                        {chartData.map((e, idx) => (
                                          <Cell key={idx} fill={colorMap[e.name] || '#059669'} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                            const item = payload[0];
                                            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                                            return (
                                              <div style={{ background: '#0f172a', color: '#ffffff', padding: '5px 10px', borderRadius: '7px', fontSize: '11.5px', fontWeight: '600' }}>
                                                {item.name}: <strong>{item.value} ({pct}%)</strong>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                    </RechartsPieChart>
                                  </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: isSmallMobile ? '100%' : '120px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorMap['Male'] }}></span>
                                      <span style={{ color: '#475569', fontWeight: '600' }}>Male</span>
                                    </div>
                                    <span style={{ fontWeight: '800', color: '#0f172a' }}>{maleCount} ({malePct}%)</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorMap['Female'] }}></span>
                                      <span style={{ color: '#475569', fontWeight: '600' }}>Female</span>
                                    </div>
                                    <span style={{ fontWeight: '800', color: '#0f172a' }}>{femaleCount} ({femalePct}%)</span>
                                  </div>
                                  {unspecifiedCount > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorMap['Unspecified'] }}></span>
                                        <span style={{ color: '#475569', fontWeight: '600' }}>Unspecified</span>
                                      </div>
                                      <span style={{ fontWeight: '800', color: '#0f172a' }}>{unspecifiedCount} ({unspecifiedPct}%)</span>
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* 3. Batch Breakdown Table */}
                  <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{
                      padding: isMobile ? '12px 14px' : '16px 20px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: isSmallMobile ? 'column' : 'row',
                      justifyContent: 'space-between',
                      alignItems: isSmallMobile ? 'flex-start' : 'center',
                      gap: 10
                    }}>
                      <h4 style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#0f172a', margin: 0, whiteSpace: 'nowrap' }}>
                        Batch Performance & Compliance Summary
                      </h4>
                      <button
                        onClick={() => setOverviewMode('cohort')}
                        style={{
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#047857',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          alignSelf: isSmallMobile ? 'flex-end' : 'auto',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Inspect Batch Statistics →
                      </button>
                    </div>

                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                      <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left' }}>
                            <th style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>Batch</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Source</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Students</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Panels / Villages</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Faculty Mentors</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Undertakings</th>
                            <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Status</th>
                            <th style={{ padding: '12px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics?.batch_breakdown?.map(b => (
                            <tr key={b.batch_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{b.batch_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Code: {b.batch_code}</div>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: b.source_program === 'LTC_SYNC' ? '#e0e7ff' : '#ecfdf5',
                                  color: b.source_program === 'LTC_SYNC' ? '#3730a3' : '#065f46',
                                  border: b.source_program === 'LTC_SYNC' ? '1px solid #c7d2fe' : '1px solid #a7f3d0',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {b.source_program === 'LTC_SYNC' ? 'LTC Synced' : 'RI Direct'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {b.total_students}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                                {b.total_panels} Panels • {b.total_villages} Villages
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {b.total_faculty} Mentors
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: '700', color: '#059669', whiteSpace: 'nowrap' }}>
                                  {b.undertaking_rate}% ({b.undertaking_completed}/{b.total_students})
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: (b.status || 'Active').toLowerCase() === 'active' ? '#dcfce7' : '#f1f5f9',
                                  color: (b.status || 'Active').toLowerCase() === 'active' ? '#15803d' : '#475569',
                                  border: (b.status || 'Active').toLowerCase() === 'active' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {b.status || 'Active'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <button
                                  onClick={() => {
                                    setSelectedBatchId(String(b.batch_id));
                                    setOverviewMode('cohort');
                                  }}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    background: '#047857',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  View Batch Stats
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  MODE 2: ALL BATCH STATISTICS (WITH BATCH SELECTOR)
                 ───────────────────────────────────────────────────────────── */}
              {overviewMode === 'cohort' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Batch Detail Statistics Display */}
                  {isLoadingBatchDetail && !batchDetailData ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                      <RefreshCw size={24} className="spin" color="#047857" />
                    </div>
                  ) : batchDetailData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      
                      {/* 5-Card Batch KPI Grid (Strictly 2 cards per row on mobile) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? 'repeat(2, minmax(0, 1fr))'
                          : 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: isMobile ? '10px' : '12px'
                      }}>
                        {[
                          { title: 'Total Students', value: batchDetailData.stats.total_students, icon: <GraduationCap size={16} color="#047857" /> },
                          { title: 'Faculty Assigned', value: batchDetailData.stats.total_faculty, icon: <UserCheck size={16} color="#0284c7" /> },
                          { title: 'Total Panels', value: batchDetailData.stats.total_panels, icon: <Grid size={16} color="#4f46e5" /> },
                          { title: 'Total Villages', value: batchDetailData.stats.total_villages, icon: <MapPin size={16} color="#ea580c" /> },
                          { title: 'Undertaking Signed', value: `${batchDetailData.stats.undertaking_percentage}% (${batchDetailData.stats.undertakings_submitted}/${batchDetailData.stats.total_students})`, icon: <ShieldCheck size={16} color="#16a34a" /> }
                        ].map((c, i) => (
                          <div key={i} style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: isMobile ? '12px 14px' : '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            gridColumn: (i === 4 && isMobile) ? 'span 2' : 'auto'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                              <span style={{ fontSize: isMobile ? '11px' : '11.5px', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>{c.title}</span>
                              {c.icon}
                            </div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{c.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Panel & Faculty Allocation Table for this Batch with Distinct Mentor Columns */}
                      <div
                        className="no-scrollbar"
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none'
                        }}
                      >
                        <style>{`
                          .no-scrollbar::-webkit-scrollbar {
                            display: none;
                            width: 0px;
                            height: 0px;
                          }
                        `}</style>
                        <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left' }}>
                              <th style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>Panel</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Assigned Village</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Students</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Assigned Mentor 1</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Mentor 1 Email</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Assigned Mentor 2</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Mentor 2 Email</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Assigned Mentor 3</th>
                              <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Mentor 3 Email</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchDetailData.panels.map(p => {
                              const mentor1 = p.faculty_list?.[0];
                              const mentor2 = p.faculty_list?.[1];
                              const mentor3 = p.faculty_list?.[2];
                              const cleanPanel = p.name ? p.name.replace(/#\d+\s*•?\s*/g, '') : `Panel ${p.panel_number}`;

                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '12px 18px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    {cleanPanel}
                                  </td>

                                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                    <div style={{ fontWeight: '700', color: '#0284c7' }}>{p.village_name || 'Not Allocated'}</div>
                                    {p.sarpanch_name && (
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>Sarpanch: {p.sarpanch_name}</div>
                                    )}
                                  </td>

                                  <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                    {p.student_count} Students
                                  </td>

                                  <td style={{ padding: '12px 14px', fontWeight: '600', color: mentor1 ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {mentor1 ? mentor1.name : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: mentor1 ? '#047857' : '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {mentor1 ? mentor1.email : '—'}
                                  </td>

                                  <td style={{ padding: '12px 14px', fontWeight: '600', color: mentor2 ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {mentor2 ? mentor2.name : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: mentor2 ? '#047857' : '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {mentor2 ? mentor2.email : '—'}
                                  </td>

                                  <td style={{ padding: '12px 14px', fontWeight: '600', color: mentor3 ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                    {mentor3 ? mentor3.name : '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: mentor3 ? '#047857' : '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {mentor3 ? mentor3.email : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Students List in Batch */}
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{
                          padding: isMobile ? '12px 14px' : '14px 18px',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          justifyContent: 'space-between',
                          alignItems: isMobile ? 'stretch' : 'center',
                          gap: 10
                        }}>
                          <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                            Enrolled Students Roster ({batchDetailData.students.length})
                          </h4>
                          <input
                            type="text"
                            placeholder="Filter by name, PRN, or department..."
                            value={cohortSearch}
                            onChange={e => setCohortSearch(e.target.value)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              width: isMobile ? '100%' : '240px'
                            }}
                          />
                        </div>

                        <div style={{ maxHeight: '420px', overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '10px 16px' }}>Student Name</th>
                                <th style={{ padding: '10px 12px' }}>PRN / Roll</th>
                                <th style={{ padding: '10px 12px' }}>Department</th>
                                <th style={{ padding: '10px 12px' }}>Panel</th>
                                <th style={{ padding: '10px 12px' }}>Village</th>
                                <th style={{ padding: '10px 12px' }}>Undertaking</th>
                                <th style={{ padding: '10px 12px' }}>Attendance</th>
                                <th style={{ padding: '10px 16px' }}>Evaluation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchDetailData.students
                                .filter(s => !cohortSearch || s.student_name.toLowerCase().includes(cohortSearch.toLowerCase()) || (s.prn || '').toLowerCase().includes(cohortSearch.toLowerCase()) || (s.department || '').toLowerCase().includes(cohortSearch.toLowerCase()))
                                .map(s => (
                                  <tr key={s.enrollment_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 16px', fontWeight: '700', color: '#0f172a' }}>{s.student_name}</td>
                                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.prn || s.roll_number || 'N/A'}</td>
                                    <td style={{ padding: '10px 12px', color: '#475569' }}>{s.department || 'N/A'}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>{s.panel_name || `Panel ${s.panel_number}`}</td>
                                    <td style={{ padding: '10px 12px', color: '#0284c7', fontWeight: '600' }}>{s.village_name || '—'}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{
                                        padding: '2px 7px',
                                        borderRadius: '9999px',
                                        fontSize: '10.5px',
                                        fontWeight: '700',
                                        background: s.undertaking_status === 'Submitted' ? '#dcfce7' : '#fee2e2',
                                        color: s.undertaking_status === 'Submitted' ? '#15803d' : '#b91c1c'
                                      }}>
                                        {s.undertaking_status || 'Pending'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', fontSize: '11.5px', fontWeight: '700' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: (s.present_activities_count || 0) === 4 ? '#dcfce7' : (s.present_activities_count || 0) > 0 ? '#f0f9ff' : '#f8fafc',
                                        color: (s.present_activities_count || 0) === 4 ? '#15803d' : (s.present_activities_count || 0) > 0 ? '#0284c7' : '#64748b',
                                        border: `1px solid ${(s.present_activities_count || 0) === 4 ? '#bbf7d0' : (s.present_activities_count || 0) > 0 ? '#bae6fd' : '#e2e8f0'}`
                                      }}>
                                        {s.present_activities_count || 0}/4 Present
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                      {s.evaluation_marks !== null && s.evaluation_marks !== undefined ? (
                                        <span style={{ fontWeight: '700', color: '#059669' }}>{s.evaluation_marks}/100</span>
                                      ) : (
                                        <span style={{ color: '#94a3b8' }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  ) : null}

                </div>
              )}

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: BATCHES MANAGEMENT (MATCHING LTC SUPERADMIN IN RI THEME)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'batches' && (
            <RiBatchesTab 
              token={token} 
              apiBase={API} 
              addToast={addToast} 
              readonly={isReadOnly} 
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: PANELS & VILLAGES (HIERARCHY MAPPING)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'mapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Filter mapping by panel or village..."
                    value={mappingSearch}
                    onChange={e => setMappingSearch(e.target.value)}
                    style={{
                      padding: isMobile ? '8px 10px' : '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: isMobile ? '12.5px' : '13px',
                      flex: isMobile ? 1 : 'none',
                      width: isMobile ? 'auto' : '220px',
                      minWidth: 0
                    }}
                  />
                  <select
                    value={mappingBatchFilter}
                    onChange={e => setMappingBatchFilter(e.target.value)}
                    style={{
                      padding: isMobile ? '8px 10px' : '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: isMobile ? '12px' : '13px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flexShrink: 0,
                      maxWidth: isMobile ? '150px' : '220px'
                    }}
                  >
                    <option value="all">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(() => {
                const filteredMapping = mappingData.filter(m => {
                  const matchSearch = !mappingSearch || m.panel_name.toLowerCase().includes(mappingSearch.toLowerCase()) || (m.village_name || '').toLowerCase().includes(mappingSearch.toLowerCase());
                  const matchBatch = mappingBatchFilter === 'all' || String(m.batch_id) === String(mappingBatchFilter);
                  return matchSearch && matchBatch;
                });

                const isFiltered = Boolean(mappingSearch || mappingBatchFilter !== 'all');

                if (filteredMapping.length === 0) {
                  return (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '56px 20px',
                      textAlign: 'center',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        maxWidth: '360px',
                        margin: '0 auto'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                          marginBottom: '4px'
                        }}>
                          {isFiltered ? <Search size={22} /> : <Grid size={22} />}
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                          {isFiltered ? 'No results found' : 'No Data Available'}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                          {isFiltered
                            ? 'No panels or villages match your search or filter.'
                            : 'No panels or village allocations found yet.'}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {filteredMapping.map(m => (
                      <div key={m.panel_id} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Panel {m.panel_number} • {m.batch_name}
                              </span>
                              <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '2px 0' }}>
                                {m.panel_name.replace(/#\d+\s*•?\s*/g, '')}
                              </h4>
                            </div>
                            <span style={{ padding: '3px 9px', borderRadius: '9999px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: '700' }}>
                              {m.student_count || 0} Students
                            </span>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: 12 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0284c7' }}>
                              Village: {m.village_name || 'Not Allocated'}
                            </div>
                            {m.sarpanch_name && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: 3 }}>
                                Sarpanch: {m.sarpanch_name} ({m.sarpanch_mobile || 'No mobile'})
                              </div>
                            )}
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                              Assigned Faculty Mentors ({m.faculty?.length || 0}):
                            </div>
                            {m.faculty && m.faculty.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {m.faculty.map((f, fi) => (
                                  <div key={fi} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: '8px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>{f.name}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{f.email} • {f.department || 'Faculty'}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>No faculty assigned</div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedPanelDetail(m);
                            setPanelDetailTab('students');
                            fetchSuperAdminPanelMedia(m.panel_id || m.id);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#1e293b',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                        >
                          View Enrolled Students ({m.students?.length || 0})
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Panel Students Drawer */}
              {selectedPanelDetail && (
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.45)',
                  zIndex: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}>
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    width: '100%',
                    maxWidth: '640px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {selectedPanelDetail.panel_name.replace(/#\d+\s*•?\s*/g, '')} - Enrolled Students
                        </h4>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Village: {selectedPanelDetail.village_name || 'N/A'} • {selectedPanelDetail.students?.length || 0} Students
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPanelDetail(null)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Subtab Toggle Buttons */}
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <button
                        type="button"
                        onClick={() => setPanelDetailTab('students')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: panelDetailTab === 'students' ? '700' : '600',
                          background: panelDetailTab === 'students' ? '#059669' : '#ffffff',
                          color: panelDetailTab === 'students' ? '#ffffff' : '#475569',
                          border: panelDetailTab === 'students' ? '1px solid #059669' : '1px solid #e2e8f0',
                          cursor: 'pointer'
                        }}
                      >
                        Enrolled Students ({selectedPanelDetail.students?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPanelDetailTab('media');
                          fetchSuperAdminPanelMedia(selectedPanelDetail.panel_id || selectedPanelDetail.id);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: panelDetailTab === 'media' ? '700' : '600',
                          background: panelDetailTab === 'media' ? '#059669' : '#ffffff',
                          color: panelDetailTab === 'media' ? '#ffffff' : '#475569',
                          border: panelDetailTab === 'media' ? '1px solid #059669' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Camera size={13} />
                        <span>Visit Media ({superAdminPanelMedia.length}/5)</span>
                      </button>
                    </div>

                    {panelDetailTab === 'media' ? (
                      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, maxHeight: '60vh' }}>
                        <RiPanelMediaViewer
                          media={superAdminPanelMedia}
                          isLoading={isLoadingPanelMedia}
                          title={`Field Visit Photos for ${selectedPanelDetail.panel_name.replace(/#\d+\s*•?\s*/g, '')}`}
                          subtitle={`Uploaded by panel faculty mentors • Village: ${selectedPanelDetail.village_name || 'N/A'}`}
                          emptyMessage="Faculty mentors have not uploaded visit photos for this panel yet."
                          canDelete={true}
                          onDelete={handleDeleteSuperAdminMedia}
                          isMobile={isMobile}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                              <th style={{ padding: '6px' }}>#</th>
                              <th style={{ padding: '6px' }}>Name</th>
                              <th style={{ padding: '6px' }}>PRN</th>
                              <th style={{ padding: '6px' }}>Department</th>
                              <th style={{ padding: '6px' }}>Undertaking</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPanelDetail.students?.map((s, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 6px', color: '#94a3b8' }}>{idx + 1}</td>
                                <td style={{ padding: '8px 6px', fontWeight: '700', color: '#0f172a' }}>{s.name}</td>
                                <td style={{ padding: '8px 6px', color: '#64748b' }}>{s.prn || s.ri_id || '—'}</td>
                                <td style={{ padding: '8px 6px', color: '#475569' }}>{s.department || '—'}</td>
                                <td style={{ padding: '8px 6px' }}>
                                  <span style={{
                                    padding: '2px 7px',
                                    borderRadius: '9999px',
                                    fontSize: '10.5px',
                                    fontWeight: '700',
                                    background: s.undertaking_status === 'Submitted' ? '#dcfce7' : '#fee2e2',
                                    color: s.undertaking_status === 'Submitted' ? '#15803d' : '#b91c1c'
                                  }}>
                                    {s.undertaking_status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: FACULTY MANAGEMENT DIRECTORY
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'faculty' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    Total Faculty: <strong style={{ color: '#0f172a' }}>{facultyList.length}</strong>
                  </span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    {facultyList.filter(f => f.undertaking_submitted).length} Submitted
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    {facultyList.filter(f => !f.undertaking_submitted).length} Pending
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                  <input
                    type="text"
                    placeholder="Search name, email, ID..."
                    value={facultySearch}
                    onChange={e => setFacultySearch(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      flex: isMobile ? '1 1 100%' : 'none',
                      width: isMobile ? '100%' : '180px'
                    }}
                  />
                  <select
                    value={facultyBatchFilter}
                    onChange={e => setFacultyBatchFilter(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: isMobile ? '1 1 calc(50% - 4px)' : 'none'
                    }}
                  >
                    <option value="all">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={facultyDeptFilter}
                    onChange={e => setFacultyDeptFilter(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      background: '#ffffff',
                      color: '#0f172a',
                      cursor: 'pointer',
                      flex: isMobile ? '1 1 calc(50% - 4px)' : 'none'
                    }}
                  >
                    <option value="all">All Departments</option>
                    {facultyDeptList.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={facultyUndertakingFilter}
                    onChange={e => setFacultyUndertakingFilter(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: isMobile ? '1 1 100%' : 'none'
                    }}
                  >
                    <option value="all">All Undertakings</option>
                    <option value="submitted">Submitted Only</option>
                    <option value="pending">Pending Only</option>
                  </select>
                </div>
              </div>

              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                width: '100%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <th style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>Faculty Name</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Email & ID</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Department</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Batches & Panels</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Supervised Students</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>Undertaking</th>
                      <th style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredFaculty = facultyList.filter(f => {
                        const matchSearch = !facultySearch || f.name.toLowerCase().includes(facultySearch.toLowerCase()) || f.email.toLowerCase().includes(facultySearch.toLowerCase());
                        const matchDept = facultyDeptFilter === 'all' || (f.department || '').toLowerCase() === facultyDeptFilter.toLowerCase();
                        const matchBatch = !facultyBatchFilter || facultyBatchFilter === 'all' || f.assignments?.some(a => String(a.batch_id) === String(facultyBatchFilter));
                        const matchUndertaking = facultyUndertakingFilter === 'all' || (facultyUndertakingFilter === 'submitted' ? Boolean(f.undertaking_submitted) : !f.undertaking_submitted);
                        return matchSearch && matchDept && matchBatch && matchUndertaking;
                      });

                      const isFiltered = Boolean(facultySearch || facultyDeptFilter !== 'all' || (facultyBatchFilter && facultyBatchFilter !== 'all') || facultyUndertakingFilter !== 'all');

                      if (filteredFaculty.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} style={{ padding: '56px 20px', textAlign: 'center' }}>
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                maxWidth: '360px',
                                margin: '0 auto'
                              }}>
                                <div style={{
                                  width: '48px',
                                  height: '48px',
                                  borderRadius: '12px',
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#64748b',
                                  marginBottom: '4px'
                                }}>
                                  {isFiltered ? <Search size={22} /> : <UserCheck size={22} />}
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                                  {isFiltered ? 'No results found' : 'No Data Available'}
                                </div>
                                <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                                  {isFiltered
                                    ? 'No faculty mentors match your search or filter criteria.'
                                    : 'No faculty mentors found yet.'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return filteredFaculty.map((f, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s ease',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => setSelectedFacultyDetail(f)}
                        >
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{f.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{f.designation || 'Faculty'}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                            <div>{f.email}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {f.employee_id || '—'}</div>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {f.department || 'General'}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '700', color: '#059669' }}>
                              {f.total_batches_count || 1} Batch • {f.total_panels_count || 1} Panels
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {f.total_students_count || 0}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                width: 'fit-content',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: '700',
                                background: f.undertaking_submitted ? '#dcfce7' : '#fee2e2',
                                color: f.undertaking_submitted ? '#15803d' : '#b91c1c'
                              }}>
                                {f.undertaking_submitted ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                                {f.undertaking_submitted ? 'Submitted' : 'Pending'}
                              </span>
                              {f.undertaking_submitted && f.undertaking_signed_date && (
                                <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                  {f.undertaking_signed_date}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedFacultyDetail(f)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                border: '1px solid #e2e8f0',
                                background: '#ffffff',
                                color: '#475569',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              <Eye size={12} />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Faculty Detail Modal */}
              {selectedFacultyDetail && (
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.45)',
                  zIndex: 100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}>
                  <div style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    width: '100%',
                    maxWidth: '560px',
                    padding: '20px 24px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {selectedFacultyDetail.name}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {selectedFacultyDetail.email} • ID: {selectedFacultyDetail.employee_id || '—'} • {selectedFacultyDetail.designation || 'Faculty'}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFacultyDetail(null)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Undertaking Compliance Banner */}
                    <div style={{
                      background: selectedFacultyDetail.undertaking_submitted ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${selectedFacultyDetail.undertaking_submitted ? '#bbf7d0' : '#fecaca'}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          color: selectedFacultyDetail.undertaking_submitted ? '#166534' : '#991b1b',
                          letterSpacing: '0.4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}>
                          {selectedFacultyDetail.undertaking_submitted ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                          Rural Immersion Undertaking
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginTop: 2 }}>
                          {selectedFacultyDetail.undertaking_submitted ? 'Submitted & Digitally Signed' : 'Submission Pending'}
                        </div>
                        {selectedFacultyDetail.undertaking_submitted ? (
                          <div style={{ fontSize: '11.5px', color: '#475569', marginTop: 3 }}>
                            Signed: <strong>{selectedFacultyDetail.undertaking_signed_name || selectedFacultyDetail.name}</strong> • Date: <strong>{selectedFacultyDetail.undertaking_signed_date || 'Recorded'}</strong>
                            {selectedFacultyDetail.tshirt_size ? ` • T-Shirt: ${selectedFacultyDetail.tshirt_size}` : ''}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#991b1b', marginTop: 2 }}>
                            Faculty has not submitted the digital undertaking form yet.
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: selectedFacultyDetail.undertaking_submitted ? '#dcfce7' : '#fee2e2',
                          color: selectedFacultyDetail.undertaking_submitted ? '#15803d' : '#b91c1c'
                        }}>
                          {selectedFacultyDetail.undertaking_submitted ? 'Submitted' : 'Pending'}
                        </span>
                        {selectedFacultyDetail.undertaking_submitted && (
                          <button
                            onClick={() => handleDownloadFacultyUndertakingPdf(selectedFacultyDetail)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            <Download size={11} />
                            <span>PDF</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#059669', marginBottom: 10 }}>
                      Assigned Batches & Panels ({selectedFacultyDetail.assignments?.length || 0}):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '240px', overflowY: 'auto' }}>
                      {selectedFacultyDetail.assignments?.map((a, i) => (
                        <div key={i} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{a.batch_name}</div>
                          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600' }}>
                            {a.panel_name || `Panel ${a.panel_number}`} • Village: {a.village_name || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: STUDENT SUBMISSIONS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'submissions' && (
            <RiSubmissionsModule
              token={token}
              apiBase={API}
              batches={batches}
              toast={addToast}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5: UNDERTAKING ANALYTICS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'undertakings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                  <select
                    value={undertakingsBatchFilter}
                    onChange={e => setUndertakingsBatchFilter(e.target.value)}
                    style={{
                      padding: isMobile ? '6px 8px' : '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: isMobile ? '11.5px' : '13px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: isMobile ? 1 : 'none',
                      minWidth: 0
                    }}
                  >
                    <option value="all">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => downloadGenericReport('overall-assessment', 'excel')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: isMobile ? '6px 10px' : '7px 12px',
                      borderRadius: '8px',
                      background: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: isMobile ? '11px' : '12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Download size={12} />
                    <span>Download Undertakings</span>
                  </button>
                </div>
              </div>

              {(() => {
                const filteredBatches = (!undertakingsBatchFilter || undertakingsBatchFilter === 'all')
                  ? (analytics?.batch_breakdown || [])
                  : (analytics?.batch_breakdown?.filter(b => String(b.batch_id) === String(undertakingsBatchFilter)) || []);

                const totalReq = filteredBatches.reduce((acc, b) => acc + Number(b.total_students || 0), 0);
                const totalSub = filteredBatches.reduce((acc, b) => acc + Number(b.undertaking_completed || 0), 0);
                const totalPend = Math.max(0, totalReq - totalSub);
                const rawRate = totalReq > 0 ? (totalSub / totalReq) * 100 : 0;
                const compRate = rawRate > 0 && rawRate < 1 ? Number(rawRate.toFixed(1)) : Math.round(rawRate);

                return (
                  <>
                    {/* 4 Dotted Design KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: isMobile ? '10px' : '14px' }}>
                      <div style={{
                        background: '#ffffff',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        borderRadius: '14px',
                        border: '1.5px dashed #cbd5e1',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: isMobile ? '90px' : '105px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Required</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }}></span>
                        </div>
                        <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0' }}>
                          {totalReq}
                        </div>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        borderRadius: '14px',
                        border: '1.5px dashed #a7f3d0',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: isMobile ? '90px' : '105px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Submitted & Signed</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                        </div>
                        <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#047857', margin: '4px 0 0' }}>
                          {totalSub}
                        </div>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        borderRadius: '14px',
                        border: '1.5px dashed #fecaca',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: isMobile ? '90px' : '105px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
                        </div>
                        <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#ef4444', margin: '4px 0 0' }}>
                          {totalPend}
                        </div>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        padding: isMobile ? '14px 14px' : '18px 20px',
                        borderRadius: '14px',
                        border: '1.5px dashed #bae6fd',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: isMobile ? '90px' : '105px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Compliance Rate</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7' }}></span>
                        </div>
                        <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#0284c7', margin: '4px 0 0' }}>
                          {compRate}%
                        </div>
                      </div>
                    </div>

                    {/* Batch-wise Undertakings Status slider/progress */}
                    <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: isMobile ? '16px 14px' : '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                          <h4 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                            Batch-wise Undertaking Compliance Status
                          </h4>
                          <p style={{ margin: '3px 0 0', fontSize: isMobile ? '11.5px' : '12px', color: '#64748b' }}>
                            Real-time submission progress and cohort compliance tracking
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredBatches.map(b => {
                          const pct = Number(b.undertaking_rate || 0);
                          return (
                            <div key={b.batch_id} style={{
                              background: '#f8fafc',
                              padding: isMobile ? '12px 14px' : '16px 18px',
                              borderRadius: '10px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: isMobile ? 'flex-start' : 'center',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? 8 : 12
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '800', fontSize: isMobile ? '13px' : '14px', color: '#0f172a' }}>{b.batch_name}</span>
                                  <span style={{
                                    fontSize: '10.5px',
                                    fontWeight: '700',
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    background: b.source_program === 'LTC_SYNC' ? '#e0e7ff' : '#ecfdf5',
                                    color: b.source_program === 'LTC_SYNC' ? '#4338ca' : '#065f46',
                                    border: b.source_program === 'LTC_SYNC' ? '1px solid #c7d2fe' : '1px solid #a7f3d0'
                                  }}>
                                    {b.source_program === 'LTC_SYNC' ? 'LTC Synced' : 'RI Direct'}
                                  </span>
                                </div>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: isMobile ? 'space-between' : 'flex-end',
                                  width: isMobile ? '100%' : 'auto',
                                  gap: 8
                                }}>
                                  <span style={{ fontSize: isMobile ? '11.5px' : '12px', fontWeight: '600', color: '#64748b' }}>
                                    {b.undertaking_completed} of {b.total_students} submitted
                                  </span>
                                  <span style={{
                                    fontSize: isMobile ? '11.5px' : '12.5px',
                                    fontWeight: '800',
                                    color: pct === 100 ? '#15803d' : '#047857',
                                    background: '#ecfdf5',
                                    border: '1px solid #a7f3d0',
                                    padding: '2px 8px',
                                    borderRadius: '6px'
                                  }}>
                                    {pct}%
                                  </span>
                                </div>
                              </div>

                              <div style={{
                                height: '8px',
                                background: '#e2e8f0',
                                borderRadius: '9999px',
                                overflow: 'hidden',
                                position: 'relative'
                              }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.max(0, Math.min(100, pct > 0 ? Math.max(pct, 1) : 0))}%`,
                                  background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                                  borderRadius: '9999px',
                                  transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 5.5: MANAGE ATTENDANCE (SUPERADMIN PANEL & LOCK MANAGEMENT)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'manage-attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isReadOnly && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 18px',
                  background: '#fffbeb',
                  borderRadius: '10px',
                  border: '1.5px solid #fde68a',
                  color: '#92400e',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  <AlertCircle size={17} color="#d97706" />
                  <span><strong>Read-Only Mode:</strong> You can view panel attendance records and lock statuses. Modifying student attendance and toggling locks is restricted to full RI Super Admins.</span>
                </div>
              )}
              {!selectedManagePanel ? (
                /* VIEW A: Batch Panels Grid & Lock Overview */
                <>
                  {/* Top Bar: Batch Filter & Panel Search */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    flexDirection: isMobile ? 'column' : 'row',
                    flexWrap: 'wrap',
                    gap: 12,
                    background: '#ffffff',
                    padding: isMobile ? '14px 14px' : '16px 20px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: isMobile ? '15px' : '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarCheck size={18} color="#059669" />
                        Manage Panel Attendance & Lock Controls
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: isMobile ? '1 1 100%' : 'none' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Batch:</label>
                        <select
                          value={manageAttBatchId || selectedBatchId}
                          onChange={e => {
                            const newId = e.target.value;
                            setManageAttBatchId(newId);
                            fetchManageAttendancePanels(newId);
                          }}
                          style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            background: '#ffffff',
                            color: '#0f172a',
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          {batches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ position: 'relative', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : '220px', minWidth: 0 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search panel, village..."
                          value={manageAttSearch}
                          onChange={e => setManageAttSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px 7px 30px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <button
                        onClick={() => fetchManageAttendancePanels(manageAttBatchId || selectedBatchId)}
                        disabled={isLoadingManageAttPanels}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '7px 12px',
                          borderRadius: '8px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <RefreshCw size={12} className={isLoadingManageAttPanels ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  {(() => {
                    const filteredPanels = manageAttPanels.filter(p => {
                      if (!manageAttSearch) return true;
                      const q = manageAttSearch.toLowerCase();
                      return (
                        (p.panel_name || '').toLowerCase().includes(q) ||
                        (p.village_name || '').toLowerCase().includes(q) ||
                        (p.faculty_names || '').toLowerCase().includes(q)
                      );
                    });
                    const totalStudents = filteredPanels.reduce((acc, p) => acc + (p.student_count || 0), 0);

                    return (
                      <>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: isMobile ? '10px' : '12px'
                        }}>
                          <div style={{
                            background: '#ffffff',
                            padding: isMobile ? '12px 14px' : '16px 18px',
                            borderRadius: '14px',
                            border: '1.5px dashed #cbd5e1',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: isMobile ? '80px' : '95px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: isMobile ? '10.5px' : '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Panels</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }}></span>
                            </div>
                            <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0' }}>{filteredPanels.length}</div>
                          </div>
                          <div style={{
                            background: '#ffffff',
                            padding: isMobile ? '12px 14px' : '16px 18px',
                            borderRadius: '14px',
                            border: '1.5px dashed #cbd5e1',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            minHeight: isMobile ? '80px' : '95px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: isMobile ? '10.5px' : '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Enrolled Students</span>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0284c7' }}></span>
                            </div>
                            <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0' }}>{totalStudents}</div>
                          </div>
                          {RI_ACTIVITIES.slice(0, 2).map(act => {
                            const lockedCount = filteredPanels.filter(p => {
                              const actStats = p.activities?.[act.key] || p[act.key.toLowerCase()] || {};
                              return Boolean(actStats.is_locked ?? p[`${act.key}_locked`]);
                            }).length;
                            const isFullyLocked = lockedCount === filteredPanels.length && filteredPanels.length > 0;
                            return (
                              <div key={act.key} style={{
                                background: '#ffffff',
                                padding: isMobile ? '12px 14px' : '16px 18px',
                                borderRadius: '14px',
                                border: `1.5px dashed ${isFullyLocked ? '#a7f3d0' : '#cbd5e1'}`,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                minHeight: isMobile ? '80px' : '95px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: isMobile ? '10.5px' : '11.5px', fontWeight: '700', color: isFullyLocked ? '#047857' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{act.shortLabel} Locked</span>
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: isFullyLocked ? '#10b981' : '#f59e0b' }}></span>
                                </div>
                                <div style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '800', color: isFullyLocked ? '#059669' : '#d97706', margin: '4px 0 0' }}>
                                  {lockedCount} / {filteredPanels.length} Panels
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Panels Grid */}
                        {isLoadingManageAttPanels ? (
                          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#059669' }} />
                            <div>Loading panels and activity attendance locks...</div>
                          </div>
                        ) : filteredPanels.length === 0 ? (
                          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <AlertCircle size={28} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
                            <div style={{ fontWeight: '700', fontSize: '15px' }}>No panels found for this batch</div>
                            <div style={{ fontSize: '12.5px', marginTop: 4 }}>Select another batch or ensure panels are created.</div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                            {filteredPanels.map(p => {
                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    padding: '16px 18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: 14,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                  }}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          color: p.village_name ? '#15803d' : '#64748b',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.4px',
                                          marginBottom: '3px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          <span>{p.village_name ? `Village: ${p.village_name}` : 'No Village Assigned'}</span>
                                        </div>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                                          {p.panel_name}
                                        </h4>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>
                                          {p.batch_name}
                                        </div>
                                      </div>
                                      <span style={{
                                        fontSize: '11.5px',
                                        padding: '4px 9px',
                                        borderRadius: '6px',
                                        fontWeight: '700',
                                        background: '#f8fafc',
                                        color: '#334155',
                                        border: '1px solid #e2e8f0',
                                        flexShrink: 0
                                      }}>
                                        {p.student_count || 0} Students
                                      </span>
                                    </div>

                                    {/* Faculty Info */}
                                    <div style={{ marginTop: 10, fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <UserCheck size={13} color="#059669" />
                                      <span style={{ fontWeight: '600' }}>Faculty:</span>
                                      <span style={{ color: '#0f172a', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.faculty_names || 'Unassigned'}
                                      </span>
                                    </div>

                                    <div style={{ marginTop: 6, fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <Users size={13} color="#0284c7" />
                                      <span style={{ fontWeight: '600' }}>Students:</span>
                                      <span style={{ color: '#0f172a', fontWeight: '800' }}>
                                        {p.student_count || 0}
                                      </span>
                                    </div>

                                    {/* Activity Attendance Pills */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                                      {RI_ACTIVITIES.map(act => {
                                        const actStats = p.activities?.[act.key] || p[act.key.toLowerCase()] || p[act.key] || {};
                                        const isLocked = Boolean(actStats.is_locked ?? p[`${act.key}_locked`]);
                                        const isTempUnlocked = Boolean(actStats.is_temp_unlocked);
                                        const markedCount = actStats.marked ?? p[`${act.key}_marked_count`] ?? 0;
                                        const presentCount = actStats.present ?? p[`${act.key}_present`] ?? 0;
                                        const totalCount = p.student_count || markedCount || 0;

                                        return (
                                          <div
                                            key={act.key}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '5px 8px',
                                              borderRadius: '6px',
                                              background: isTempUnlocked ? '#f0f9ff' : isLocked ? '#fef2f2' : markedCount > 0 ? '#f0fdf4' : '#f8fafc',
                                              border: `1px solid ${isTempUnlocked ? '#bae6fd' : isLocked ? '#fecaca' : markedCount > 0 ? '#bbf7d0' : '#e2e8f0'}`,
                                              fontSize: '11.5px'
                                            }}
                                          >
                                            <span style={{ fontWeight: '700', color: '#334155' }}>{act.shortLabel}:</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <span style={{ fontWeight: '800', color: presentCount > 0 ? '#059669' : '#64748b' }}>
                                                {markedCount > 0 ? `${presentCount}/${totalCount} P` : 'Not Marked'}
                                              </span>
                                              {isTempUnlocked ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#0284c7', fontWeight: '800', fontSize: '10.5px', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>
                                                  <Clock size={9} /> Temp Unlocked
                                                </span>
                                              ) : isLocked ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#b91c1c', fontWeight: '800', fontSize: '10.5px', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>
                                                  <Lock size={9} /> Locked
                                                </span>
                                              ) : (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#15803d', fontWeight: '700', fontSize: '10.5px', background: '#dcfce7', padding: '1px 5px', borderRadius: '4px' }}>
                                                  <Unlock size={9} /> Draft
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Manage Panel Button */}
                                  <button
                                    onClick={() => {
                                      setSelectedManagePanel(p);
                                      fetchManagePanelDetail(p.id, manageAttBatchId || selectedBatchId);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '9px 14px',
                                      borderRadius: '8px',
                                      background: '#059669',
                                      color: '#ffffff',
                                      border: 'none',
                                      fontWeight: '700',
                                      fontSize: '12.5px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 6
                                    }}
                                  >
                                    <span>Manage Panel Attendance</span>
                                    <ArrowRight size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                /* VIEW B: Panel Detailed Attendance & Lock Control */
                <>
                  {(() => {
                    const curAct = RI_ACTIVITIES.find(a => a.key === manageAttActiveActivity) || RI_ACTIVITIES[0];
                    const lockInfo = managePanelDetail?.locks?.[curAct.key];
                    const isLocked = !!lockInfo?.is_locked;
                    const isTempUnlocked = !!lockInfo?.is_temp_unlocked;
                    const summary = managePanelDetail?.summary?.[curAct.key] || {
                      total: managePanelDetail?.students?.length || 0,
                      present: 0,
                      absent: 0,
                      unmarked: managePanelDetail?.students?.length || 0,
                      attendance_percentage: 0
                    };

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* ── Single Clean Header Row ── */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          padding: isMobile ? '12px 14px' : '12px 16px',
                          display: 'flex',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          justifyContent: 'space-between',
                          flexDirection: isMobile ? 'column' : 'row',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedManagePanel(null);
                                setManagePanelDetail(null);
                                fetchManageAttendancePanels(manageAttBatchId || selectedBatchId);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <ArrowLeft size={13} />
                              <span>Back</span>
                            </button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <h3 style={{ margin: 0, fontSize: isMobile ? '14px' : '15.5px', fontWeight: '800', color: '#0f172a' }}>
                                {curAct.label}
                              </h3>
                              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '600', color: '#64748b' }}>
                                ({selectedManagePanel.panel_name || selectedManagePanel.name || `Panel #${selectedManagePanel.panel_number}`} • {selectedManagePanel.batch_name || batches.find(b => String(b.id) === String(manageAttBatchId || selectedBatchId))?.name || ''})
                              </span>
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            width: isMobile ? '100%' : 'auto',
                            gap: '8px',
                            flexWrap: 'wrap'
                          }}>
                            {/* Status Badge */}
                            {isTempUnlocked ? (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '800',
                                letterSpacing: '0.4px',
                                textTransform: 'uppercase',
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                border: '1px solid #7dd3fc',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Clock size={11} /> TEMP UNLOCKED
                              </span>
                            ) : (
                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '800',
                                letterSpacing: '0.4px',
                                textTransform: 'uppercase',
                                backgroundColor: isLocked ? '#fee2e2' : '#ecfdf5',
                                color: isLocked ? '#dc2626' : '#15803d',
                                border: `1px solid ${isLocked ? '#fca5a5' : '#86efac'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                {isLocked ? 'LOCKED' : 'UNLOCKED'}
                              </span>
                            )}

                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTempUnlockModal(curAct.key)}
                                  disabled={isTogglingLock || isSubmittingTempUnlock}
                                  style={{
                                    height: '32px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    border: '1px solid #7dd3fc',
                                    backgroundColor: '#f0f9ff',
                                    color: '#0284c7',
                                    cursor: (isTogglingLock || isSubmittingTempUnlock) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <Clock size={13} />
                                  <span>Temporary Unlock...</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSuperadminToggleLock(curAct.key, !isLocked)}
                                  disabled={isTogglingLock}
                                  style={{
                                    height: '32px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: isLocked ? '#eff6ff' : '#fff1f2',
                                    color: isLocked ? '#1d4ed8' : '#be123c',
                                    cursor: isTogglingLock ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  {isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                                  <span>{isLocked ? 'Permanent Unlock' : 'Lock Activity'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Lock / Expiry / Reason Status Bar */}
                        {(isTempUnlocked || isLocked || lockInfo?.lock_reason) && (
                          <div style={{
                            backgroundColor: isTempUnlocked ? '#f0f9ff' : isLocked ? '#fef2f2' : '#f8fafc',
                            border: `1px solid ${isTempUnlocked ? '#bae6fd' : isLocked ? '#fecaca' : '#e2e8f0'}`,
                            borderRadius: '8px',
                            padding: '9px 13px',
                            fontSize: '12px',
                            color: isTempUnlocked ? '#0369a1' : isLocked ? '#991b1b' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isTempUnlocked ? <Clock size={15} color="#0284c7" /> : <Lock size={15} color={isLocked ? '#dc2626' : '#64748b'} />}
                              <span>
                                <strong>{isTempUnlocked ? 'Temporary Unlock Active:' : isLocked ? 'Lock Status:' : 'Status:'}</strong>{' '}
                                {lockInfo?.lock_reason || (isLocked ? 'Attendance is currently locked' : 'Open for attendance editing')}
                              </span>
                            </div>
                            {lockInfo?.unlocked_until && (
                              <span style={{ fontSize: '11.5px', fontWeight: '700', color: isTempUnlocked ? '#0284c7' : '#991b1b', backgroundColor: isTempUnlocked ? '#e0f2fe' : '#fee2e2', padding: '2px 8px', borderRadius: '4px' }}>
                                Expiry: {new Date(lockInfo.unlocked_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 23:59:59
                              </span>
                            )}
                          </div>
                        )}

                        {/* ── 4 Activity Tabs ── */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          overflowX: 'auto',
                          WebkitOverflowScrolling: 'touch',
                          paddingBottom: '2px'
                        }}>
                          {RI_ACTIVITIES.map(act => {
                            const isActive = manageAttActiveActivity === act.key;
                            const isActLocked = !!managePanelDetail?.locks?.[act.key]?.is_locked;
                            const isActTempUnlocked = !!managePanelDetail?.locks?.[act.key]?.is_temp_unlocked;
                            const actSummary = managePanelDetail?.summary?.[act.key] || { present: 0, total: 0 };
                            return (
                              <button
                                key={act.key}
                                type="button"
                                onClick={() => setManageAttActiveActivity(act.key)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: isMobile ? '7px 10px' : '8px 14px',
                                  borderRadius: '8px',
                                  border: isActive ? '2px solid #047857' : '1px solid #e2e8f0',
                                  backgroundColor: isActive ? '#ecfdf5' : '#ffffff',
                                  color: isActive ? '#065f46' : '#475569',
                                  fontWeight: isActive ? '800' : '600',
                                  fontSize: isMobile ? '11.5px' : '12.5px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <span>{act.label}</span>
                                <span style={{
                                  fontSize: '10.5px',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: isActive ? '#047857' : '#f1f5f9',
                                  color: isActive ? '#ffffff' : '#64748b',
                                  fontWeight: '700'
                                }}>
                                  {actSummary.present}/{actSummary.total || managePanelDetail?.students?.length || 0} P
                                </span>
                                {isActTempUnlocked ? (
                                  <Clock size={12} color="#0284c7" />
                                ) : isActLocked ? (
                                  <Lock size={12} color={isActive ? '#b91c1c' : '#dc2626'} />
                                ) : (
                                  <Unlock size={12} color={isActive ? '#059669' : '#cbd5e1'} />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* ── 5 Statistics Cards ── */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: isMobile ? '8px' : '10px'
                        }}>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
                            <div style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>TOTAL ENROLLED</div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{summary.total}</div>
                          </div>
                          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
                            <div style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase' }}>PRESENT (P)</div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>{summary.present}</div>
                          </div>
                          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
                            <div style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase' }}>ABSENT (A)</div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>{summary.absent}</div>
                          </div>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: isMobile ? '10px 12px' : '12px 14px' }}>
                            <div style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>UNMARKED</div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>{summary.unmarked}</div>
                          </div>
                          <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: isMobile ? '10px 12px' : '12px 14px',
                            gridColumn: isMobile ? 'span 2' : 'auto'
                          }}>
                            <div style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>ATTENDANCE %</div>
                            <div style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>{summary.attendance_percentage}%</div>
                          </div>
                        </div>

                        {/* ── Student Roster Action & Table Card ── */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          padding: isMobile ? '12px 14px' : '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          {/* Search & Bulk Actions Bar */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'stretch' : 'center',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: '10px'
                          }}>
                            <div style={{ position: 'relative', width: '100%', maxWidth: isMobile ? '100%' : '280px' }}>
                              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                              <input
                                type="text"
                                placeholder="Search student name, PRN..."
                                value={manageAttSearch}
                                onChange={e => setManageAttSearch(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px 7px 30px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12.5px',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            {!isReadOnly ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSuperadminBulkMark(curAct.key, 'P')}
                                  style={{
                                    height: '34px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    backgroundColor: '#f0fdf4',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    cursor: 'pointer',
                                    flex: isMobile ? 1 : 'none',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Mark All Present
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSuperadminBulkMark(curAct.key, 'A')}
                                  style={{
                                    height: '34px',
                                    padding: '0 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    backgroundColor: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    cursor: 'pointer',
                                    flex: isMobile ? 1 : 'none',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Mark All Absent
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleSuperadminSaveAttendance(curAct.key)}
                                  disabled={isSavingManageAtt}
                                  style={{
                                    height: '34px',
                                    padding: '0 16px',
                                    borderRadius: '6px',
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    backgroundColor: '#047857',
                                    color: '#ffffff',
                                    border: 'none',
                                    cursor: isSavingManageAtt ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    flex: isMobile ? '1 1 100%' : 'none',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <CheckCircle2 size={14} />
                                  <span>{isSavingManageAtt ? 'Saving...' : 'Save Attendance'}</span>
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', fontWeight: '700' }}>
                                <AlertCircle size={14} color="#d97706" />
                                <span>Read-Only Mode: Attendance is view-only</span>
                              </div>
                            )}
                          </div>

                          {/* Responsive Students Table */}
                          {isLoadingManagePanelDetail ? (
                            <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#059669' }} />
                              <div>Loading student roster and attendance marks...</div>
                            </div>
                          ) : (
                            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '8px', width: '100%' }}>
                              <table style={{ width: '100%', minWidth: '550px', borderCollapse: 'collapse', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                    <th style={{ padding: '10px 14px', width: '220px', whiteSpace: 'nowrap' }}>STUDENT NAME & PRN</th>
                                    <th style={{ padding: '10px 14px', width: '110px', textAlign: 'center', whiteSpace: 'nowrap' }}>MARK</th>
                                    <th style={{ padding: '10px 14px', width: '100px', textAlign: 'center', whiteSpace: 'nowrap' }}>STATUS</th>
                                    <th style={{ padding: '10px 14px', width: '50px', whiteSpace: 'nowrap' }}>#</th>
                                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>DEPT / DIV</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(managePanelDetail?.students || [])
                                    .filter(st => {
                                      if (!manageAttSearch) return true;
                                      const q = manageAttSearch.toLowerCase();
                                      return (
                                        (st.name || '').toLowerCase().includes(q) ||
                                        (st.prn || '').toLowerCase().includes(q) ||
                                        (st.roll_number || '').toLowerCase().includes(q) ||
                                        (st.department || '').toLowerCase().includes(q)
                                      );
                                    })
                                    .map((st, idx) => {
                                      const curStatus = manageAttEditedAttendance[st.student_id]?.[curAct.key] 
                                        || st[curAct.key] 
                                        || st[curAct.key.toLowerCase()] 
                                        || st.activities?.[curAct.key]?.code 
                                        || (st.activities?.[curAct.key]?.status === 'Present' ? 'P' : (st.activities?.[curAct.key]?.status === 'Absent' ? 'A' : 'Unmarked')) 
                                        || 'Unmarked';
                                      const isPresent = curStatus === 'P' || curStatus === 'Present';
                                      const isAbsent = curStatus === 'A' || curStatus === 'Absent';

                                      return (
                                        <tr key={st.student_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          {/* Student Name & PRN */}
                                          <td style={{ padding: '10px 14px' }}>
                                            <div style={{ fontWeight: '700', color: '#0f172a' }}>
                                              {st.name}
                                            </div>
                                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                              {st.prn || st.roll_number || '—'}
                                            </div>
                                          </td>

                                          {/* Mark (P / A) */}
                                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                            {!isReadOnly ? (
                                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSuperadminMarkStudent(st.student_id, curAct.key, 'P')}
                                                  style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '4px',
                                                    fontSize: '11.5px',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    backgroundColor: isPresent ? '#047857' : '#ffffff',
                                                    color: isPresent ? '#ffffff' : '#64748b',
                                                    border: `1px solid ${isPresent ? '#047857' : '#cbd5e1'}`
                                                  }}
                                                >
                                                  P
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSuperadminMarkStudent(st.student_id, curAct.key, 'A')}
                                                  style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '4px',
                                                    fontSize: '11.5px',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    backgroundColor: isAbsent ? '#dc2626' : '#ffffff',
                                                    color: isAbsent ? '#ffffff' : '#64748b',
                                                    border: `1px solid ${isAbsent ? '#dc2626' : '#cbd5e1'}`
                                                  }}
                                                >
                                                  A
                                                </button>
                                              </div>
                                            ) : (
                                              <span style={{ fontSize: '12px', fontWeight: '700', color: isPresent ? '#15803d' : (isAbsent ? '#dc2626' : '#64748b') }}>
                                                {isPresent ? 'P' : (isAbsent ? 'A' : '—')}
                                              </span>
                                            )}
                                          </td>

                                          {/* Status Badge */}
                                          <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                                            <span style={{
                                              padding: '3px 8px',
                                              borderRadius: '4px',
                                              fontSize: '11px',
                                              fontWeight: '700',
                                              backgroundColor: isPresent ? '#f0fdf4' : (isAbsent ? '#fef2f2' : '#f8fafc'),
                                              color: isPresent ? '#15803d' : (isAbsent ? '#dc2626' : '#64748b'),
                                              border: `1px solid ${isPresent ? '#bbf7d0' : (isAbsent ? '#fecaca' : '#e2e8f0')}`
                                            }}>
                                              {isPresent ? 'Present' : (isAbsent ? 'Absent' : 'Unmarked')}
                                            </span>
                                          </td>

                                          {/* # */}
                                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                            {idx + 1}
                                          </td>

                                          {/* Dept / Div */}
                                          <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                            <div>{st.department || '—'}</div>
                                            {st.division && <div style={{ color: '#94a3b8', fontSize: '11px' }}>Div {st.division}</div>}
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
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 6.5: MANAGE EVALUATION (SUPER ADMIN BULK EVALUATION & UNLOCK)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'manage-evaluations' && (
            <RiSuperAdminManageEvaluationTab
              selectedBatchId={selectedBatchId}
              onSelectBatch={setSelectedBatchId}
              batches={batches}
              token={token}
              isMobile={isMobile}
              isReadOnly={isReadOnly}
              addToast={addToast}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 7: EVALUATIONS & GRADING
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'evaluations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                  <select
                    value={evaluationsBatchFilter}
                    onChange={e => setEvaluationsBatchFilter(e.target.value)}
                    style={{
                      padding: isMobile ? '6px 8px' : '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: isMobile ? '11.5px' : '13px',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: isMobile ? 1 : 'none',
                      minWidth: 0
                    }}
                  >
                    <option value="all">All Batches</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}{(b.status || '').toLowerCase() === 'active' ? ' • Active' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => downloadGenericReport('evaluation', 'excel')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: isMobile ? '6px 10px' : '7px 14px',
                      borderRadius: '8px',
                      background: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: isMobile ? '11px' : '12px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Download size={12} />
                    <span>Download Evaluations Excel</span>
                  </button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: isMobile ? '10px' : '14px'
              }}>
                <div style={{
                  background: '#ffffff',
                  padding: isMobile ? '14px 14px' : '18px 20px',
                  borderRadius: '14px',
                  border: '1.5px dashed #cbd5e1',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: isMobile ? '90px' : '105px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Required</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }}></span>
                  </div>
                  <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0' }}>
                    {analytics?.evaluation_overview?.total_evaluations || 0}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  padding: isMobile ? '14px 14px' : '18px 20px',
                  borderRadius: '14px',
                  border: '1.5px dashed #a7f3d0',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: isMobile ? '90px' : '105px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Completed Evaluations</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                  </div>
                  <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#047857', margin: '4px 0 0' }}>
                    {analytics?.evaluation_overview?.completed || 0}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  padding: isMobile ? '14px 14px' : '18px 20px',
                  borderRadius: '14px',
                  border: '1.5px dashed #fecaca',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: isMobile ? '90px' : '105px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending Evaluations</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }}></span>
                  </div>
                  <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#ef4444', margin: '4px 0 0' }}>
                    {analytics?.evaluation_overview?.pending || 0}
                  </div>
                </div>

                <div style={{
                  background: '#ffffff',
                  padding: isMobile ? '14px 14px' : '18px 20px',
                  borderRadius: '14px',
                  border: '1.5px dashed #ddd6fe',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.015)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: isMobile ? '90px' : '105px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: isMobile ? '10.5px' : '12px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cohort Avg Marks</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }}></span>
                  </div>
                  <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#7c3aed', margin: '4px 0 0' }}>
                    {analytics?.evaluation_overview?.average_marks || 0} / 100
                  </div>
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginBottom: 14 }}>
                  Rubric Criteria Weightage
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  {[
                    { title: 'Attendance (Auto-calculated)', weight: '15 Marks (15%)' },
                    { title: 'Activities & Field Survey', weight: '30 Marks (30%)' },
                    { title: 'Problem Statement & SDGs Alignment', weight: '15 Marks (15%)' },
                    { title: 'Proposed SMART Solution & Report/Viva', weight: '40 Marks (40%)' }
                  ].map((r, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{r.title}</div>
                      <div style={{ color: '#059669', fontWeight: '800', fontSize: '12px', marginTop: 3 }}>{r.weight}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 8: REPORTS & EXPORTS HUB
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Reports & Master Exports
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {[
                  { title: 'Student Roster Report', desc: 'Full student list with PRN, department, division, panel, and village.', type: 'overall-assessment', icon: GraduationCap },
                  { title: 'Faculty & Mentors Directory', desc: 'Faculty list with employee IDs, panel allocations, and village.', type: 'overall-assessment', icon: UserCheck },
                  { title: 'Panel & Village Allocation Matrix', desc: 'Complete mapping of panels, villages, and all assigned faculty.', type: 'overall-assessment', icon: Grid },
                  { title: 'Multi-Day Attendance Report', desc: 'Attendance status logs with marking timestamps for each day.', type: 'attendance', icon: Calendar },
                  { title: 'Evaluations & Grading Ledger', desc: 'Rubric criteria marks, total scores, grades, and faculty remarks.', type: 'evaluation', icon: Award },
                  { title: 'Family Visit Socio-Economic Data', desc: 'Consolidated multi-family socio-economic visit records.', type: 'family-survey', icon: Building }
                ].map((rep, idx) => {
                  const Icon = rep.icon;
                  return (
                    <div key={idx} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '6px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={18} />
                          </div>
                          <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                            {rep.title}
                          </h4>
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4 }}>
                          {rep.desc}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => downloadGenericReport(rep.type, 'excel')}
                          style={{
                            flex: 1,
                            padding: '7px 12px',
                            borderRadius: '6px',
                            background: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                        >
                          <Download size={13} />
                          <span>Excel Workbook</span>
                        </button>
                        <button
                          onClick={() => downloadGenericReport(rep.type, 'json')}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '6px',
                            background: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          JSON
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: SUPPORT TICKETS & RESOLUTIONS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'tickets' && (
            <RiTicketsModule
              token={token}
              apiBase={API}
              isReadonly={isReadOnly}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: FACULTY UPLOADS (CENTRAL REPOSITORY)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'faculty_uploads' && (
            <RiFacultyUploadsModule isMobile={isMobile} />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: STUDENT RED FLAGS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'redflags' && (
            <RiRedFlagsModule
              token={token}
              userRole={currentUser?.role || 'superadmin-ri'}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: STUDENT ORANGE FLAGS
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'orangeflags' && (
            <RiOrangeFlagsModule
              token={token}
              userRole={currentUser?.role || 'superadmin-ri'}
            />
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 9: READ ONLY SUPER ADMINS (IAM MANAGEMENT)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'readonly-admins' && !isReadOnly && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Actions Header */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                  {/* Search Bar */}
                  <div style={{ position: 'relative', width: '240px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search name, email, or ID..."
                      value={readonlySearch}
                      onChange={e => {
                        setReadonlySearch(e.target.value);
                        setReadonlyPage(1);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 12px 7px 32px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Refresh Button */}
                  <button
                    onClick={() => fetchReadonlyAdmins(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={isLoadingReadonlyAdmins ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  {/* Add Super Admin Button */}
                  <button
                    onClick={() => {
                      setAdminForm({ name: '', email: '', employee_id: '' });
                      setShowAddAdminModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: '6px',
                      background: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#065f46'}
                    onMouseLeave={e => e.currentTarget.style.background = '#047857'}
                  >
                    <Plus size={15} />
                    <span>Add Super Admin</span>
                  </button>
                </div>
              </div>

              {/* Table Container */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                {isLoadingReadonlyAdmins ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', color: '#047857' }} />
                    <p style={{ fontSize: '13px', margin: 0, fontWeight: '600' }}>Loading Super Administrators...</p>
                  </div>
                ) : (() => {
                  const filtered = readonlyAdmins.filter(a => {
                    if (!readonlySearch) return true;
                    const q = readonlySearch.toLowerCase();
                    return (
                      (a.name || '').toLowerCase().includes(q) ||
                      (a.email || '').toLowerCase().includes(q) ||
                      (a.employee_id || '').toLowerCase().includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                        <ShieldCheck size={32} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                          {readonlySearch ? 'No matching super admins found' : 'No Read Only Super Admins added yet'}
                        </h4>
                        <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px 0', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                          {readonlySearch ? 'Try a different search query.' : 'Click "Add Super Admin" to grant a user complete visibility and navigation across the RI portal.'}
                        </p>
                        {!readonlySearch && (
                          <button
                            onClick={() => {
                              setAdminForm({ name: '', email: '', employee_id: '' });
                              setShowAddAdminModal(true);
                            }}
                            style={{
                              padding: '7px 16px',
                              borderRadius: '6px',
                              background: '#047857',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            + Add First Super Admin
                          </button>
                        )}
                      </div>
                    );
                  }

                  const totalPages = Math.ceil(filtered.length / readonlyItemsPerPage) || 1;
                  const safePage = Math.min(Math.max(1, readonlyPage), totalPages);
                  const startIndex = (safePage - 1) * readonlyItemsPerPage;
                  const paginated = filtered.slice(startIndex, startIndex + readonlyItemsPerPage);

                  return (
                    <>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', textAlign: 'left' }}>
                            <th style={{ padding: '12px 18px' }}>User Name</th>
                            <th style={{ padding: '12px 14px' }}>Email Address</th>
                            <th style={{ padding: '12px 14px' }}>Employee ID</th>
                            <th style={{ padding: '12px 14px' }}>Scope & Access</th>
                            <th style={{ padding: '12px 14px' }}>Status</th>
                            <th style={{ padding: '12px 14px' }}>Added On</th>
                            <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginated.map(admin => {
                            const isActioning = actionAdminId === admin.id;
                            const formattedDate = admin.created_at ? new Date(admin.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

                            return (
                              <tr key={admin.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 18px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      background: '#ecfdf5',
                                      color: '#047857',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: '800',
                                      border: '1px solid #a7f3d0'
                                    }}>
                                      {(admin.name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ fontWeight: '800', color: '#0f172a' }}>{admin.name}</div>
                                  </div>
                                </td>

                                <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '500' }}>
                                  {admin.email}
                                </td>

                                <td style={{ padding: '12px 14px', color: '#047857', fontWeight: '700' }}>
                                  {admin.employee_id || '—'}
                                </td>

                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    border: '1px solid #a7f3d0'
                                  }}>
                                    Full Portal View
                                  </span>
                                </td>

                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0'
                                  }}>
                                    Active
                                  </span>
                                </td>

                                <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>
                                  {formattedDate}
                                </td>

                                <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleRevokeAdmin(admin.id, admin.name)}
                                    disabled={isActioning}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '6px',
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: isActioning ? 'not-allowed' : 'pointer',
                                      opacity: isActioning ? 0.6 : 1
                                    }}
                                  >
                                    {isActioning ? 'Revoking...' : 'Revoke Access'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Pagination Footer */}
                      {totalPages > 1 && (
                        <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Showing {startIndex + 1} to {Math.min(startIndex + readonlyItemsPerPage, filtered.length)} of {filtered.length} Super Admins
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setReadonlyPage(p => Math.max(1, p - 1))}
                              disabled={safePage === 1}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                                opacity: safePage === 1 ? 0.5 : 1
                              }}
                            >
                              Previous
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', padding: '5px 10px' }}>
                              Page {safePage} of {totalPages}
                            </span>
                            <button
                              onClick={() => setReadonlyPage(p => Math.min(totalPages, p + 1))}
                              disabled={safePage === totalPages}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                                opacity: safePage === totalPages ? 0.5 : 1
                              }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Add Super Admin Modal */}
              {showAddAdminModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(2px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 9999,
                  padding: '20px'
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    width: '100%',
                    maxWidth: '480px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    overflow: 'hidden'
                  }}>
                    {/* Modal Header */}
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserPlus size={18} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                            Add Super Admin
                          </h3>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                            Configure full dashboard viewing access
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowAddAdminModal(false)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Modal Form */}
                    <form onSubmit={handleAddAdmin} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Name */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                          Full Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Rajesh Sharma"
                          value={adminForm.name}
                          onChange={e => setAdminForm(prev => ({ ...prev, name: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13.5px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                          Email Address <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. rajesh.sharma@mitwpu.edu.in"
                          value={adminForm.email}
                          onChange={e => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13.5px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Employee ID */}
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                          Employee ID <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. EMP10294"
                          value={adminForm.employee_id}
                          onChange={e => setAdminForm(prev => ({ ...prev, employee_id: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '9px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13.5px',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Notice Banner */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        fontSize: '12px',
                        color: '#475569',
                        lineHeight: 1.45
                      }}>
                        <strong style={{ color: '#047857' }}>Access Notice:</strong> This user will receive complete visibility across all RI dashboards, batches, students, faculty, and reports with administrative actions disabled.
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setShowAddAdminModal(false)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#475569',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={isSubmittingAdmin}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            background: '#047857',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: isSubmittingAdmin ? 'not-allowed' : 'pointer',
                            opacity: isSubmittingAdmin ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          {isSubmittingAdmin ? (
                            <>
                              <RefreshCw size={14} className="spin" />
                              <span>Adding Super Admin...</span>
                            </>
                          ) : (
                            <span>Add Super Admin</span>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 10: ACCOUNT SETTINGS & SECURITY (CHANGE PASSWORD)
             ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'settings' && isReadOnly && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Account Settings & Security
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Manage your credentials, authentication profile, and security preferences.
                </p>
              </div>

              {/* Profile Summary Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#047857',
                    fontWeight: '800',
                    fontSize: '18px'
                  }}>
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      {currentUser?.name || 'RI Super Admin'}
                    </h4>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: 2 }}>
                      {currentUser?.email || 'superadmin@ri.edu'}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  paddingTop: 14,
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Assigned Role</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#047857', marginTop: 2 }}>
                      superadmin-ri
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Employee ID</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginTop: 2 }}>
                      {currentUser?.employee_id || 'RI-ADM-01'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Account Status</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#16a34a', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 size={13} />
                      <span>Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Security — Change Password Form */}
              <div style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lock size={17} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      Account Security — Change Password
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Update your login password to ensure ongoing account security.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Current Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Current Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        required
                        placeholder="Enter your current password"
                        value={passwordForm.currentPassword}
                        onChange={e => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(p => !p)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      New Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        required
                        placeholder="Enter new password (min. 6 characters)"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(p => !p)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        required
                        placeholder="Re-enter new password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 40px 10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(p => !p)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Requirements note */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#475569',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>Password Requirements:</div>
                    <div>• Minimum 6 characters</div>
                    <div>• Must match confirmation password</div>
                  </div>

                  {/* Submit Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 6 }}>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        background: '#047857',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                        opacity: isChangingPassword ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 2px 6px rgba(4,120,87,0.2)'
                      }}
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Key size={14} />
                          <span>Update Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Superadmin Temporary Unlock Modal */}
          {showTempUnlockModal && selectedManagePanel && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #cbd5e1',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Clock size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                        Temporary Attendance Unlock
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {selectedManagePanel.panel_name || selectedManagePanel.name || `Panel #${selectedManagePanel.panel_number}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTempUnlockModal(false)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSuperadminTemporaryUnlock} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Scope selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Unlock Scope
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <label style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: !tempUnlockAllActivities ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: !tempUnlockAllActivities ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: !tempUnlockAllActivities ? '700' : '500',
                        color: !tempUnlockAllActivities ? '#0369a1' : '#475569'
                      }}>
                        <input
                          type="radio"
                          name="unlockScope"
                          checked={!tempUnlockAllActivities}
                          onChange={() => setTempUnlockAllActivities(false)}
                          style={{ accentColor: '#0284c7' }}
                        />
                        <span>{RI_ACTIVITIES.find(a => a.key === tempUnlockActivity)?.label || tempUnlockActivity} only</span>
                      </label>

                      <label style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: tempUnlockAllActivities ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: tempUnlockAllActivities ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        fontWeight: tempUnlockAllActivities ? '700' : '500',
                        color: tempUnlockAllActivities ? '#0369a1' : '#475569'
                      }}>
                        <input
                          type="radio"
                          name="unlockScope"
                          checked={tempUnlockAllActivities}
                          onChange={() => setTempUnlockAllActivities(true)}
                          style={{ accentColor: '#0284c7' }}
                        />
                        <span>All 4 Activities</span>
                      </label>
                    </div>
                  </div>

                  {/* Date picker */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Unlock Until (End of Date) *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={tempUnlockDate}
                      onChange={e => setTempUnlockDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: 5 }}>
                      Faculty will be permitted to record/edit attendance until <strong>23:59:59</strong> on the selected date. Once the expiry passes, attendance automatically locks again.
                    </div>
                  </div>

                  {/* Reason note */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                      Lock / Extension Reason (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2-day faculty extension approved by Dean"
                      value={tempUnlockReason}
                      onChange={e => setTempUnlockReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowTempUnlockModal(false)}
                      disabled={isSubmittingTempUnlock}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#475569',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTempUnlock}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isSubmittingTempUnlock ? 'not-allowed' : 'pointer',
                        opacity: isSubmittingTempUnlock ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      {isSubmittingTempUnlock ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Applying Unlock...</span>
                        </>
                      ) : (
                        <>
                          <Clock size={14} />
                          <span>Confirm Temporary Unlock</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
