import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Home, Layers, Users, Grid, RefreshCw, LogOut, Search, ChevronDown, ChevronUp,
  Download, Eye, AlertCircle, CheckCircle, Clock, Sparkles, Filter, ChevronRight, ChevronLeft,
  Menu, X, ShieldCheck, ArrowRight, UserCheck, Calendar, BookOpen, Settings,
  UploadCloud, Compass, Award, Building, User, MapPin, Plus, Trash2, Edit3, Phone, Info, Check, ArrowLeft,
  FileSpreadsheet, UserPlus, Upload, Mail, Briefcase, FileText, ClipboardCheck, CheckCircle2,
  Bell, MessageSquare, LifeBuoy, AlertTriangle, Database, Loader2, ClipboardList,
  Send, History, Camera, Flag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DEFAULT_SCHEDULE, getRiCategoryStyles } from '../shared/riScheduleData';
import { cleanPanelName } from '../shared/riUtils';
import ScrollToTop from '../../ScrollToTop';
import { OFFICIAL_HIERARCHY } from '../../admin/hierarchy';
import RiBulkUploadModule from './RiBulkUploadModule';
import RiTicketsModule from './RiTicketsModule';
import RiRedFlagsModule from './RiRedFlagsModule';
import RiOrangeFlagsModule from './RiOrangeFlagsModule';
import RiSubmissionsModule from './RiSubmissionsModule';
import RiCommunicationModule from './RiCommunicationModule';
import RiPanelMediaViewer from '../shared/RiPanelMediaViewer';
import RiFacultyUploadsModule from './RiFacultyUploadsModule';
import RiAuditLogsModule from './RiAuditLogsModule';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function RiAdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab); // 'dashboard' | 'batches' | 'batch_detail' | 'all_students' | 'submissions' | 'bulk_upload'
  const [batchSubTab, setBatchSubTab] = useState('panels'); // 'panels' | 'villages' | 'faculty' | 'students'
  const [adminScheduleDay, setAdminScheduleDay] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('ri_sidebar_collapsed') === 'true';
  });
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const [currentUser, setCurrentUser] = useState(null);
  const [isCommunicationDropdownOpen, setIsCommunicationDropdownOpen] = useState(() => {
    return initialTab === 'communication_sender' || initialTab === 'communication_logs';
  });
  const mainScrollRef = useRef(null);

  useEffect(() => {
    if (['communication_sender', 'communication_logs'].includes(activeTab)) {
      setIsCommunicationDropdownOpen(true);
    }
  }, [activeTab]);

  // 1. Mobile initial scroll position & navigation behavior fix
  // Prevents mobile browsers from opening pages scrolled down and resets scroll on tab change
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const resetScrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0;
    };

    // Immediate execution
    resetScrollToTop();

    // Ensure layout shifts/async renders do not scroll down
    const rafId = requestAnimationFrame(() => resetScrollToTop());
    const timer = setTimeout(resetScrollToTop, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [activeTab, batchSubTab]);

  // 2. iOS PWA Status Bar & Android Theme Color Management
  // Matches status bar with RI Admin green (#047857) while on /ri-admin and cleanly restores on unmount
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    const originalThemeColor = themeMeta ? themeMeta.getAttribute('content') : '#ffffff';
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', '#047857');

    let appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    const originalAppleStatus = appleStatusMeta ? appleStatusMeta.getAttribute('content') : 'default';
    if (!appleStatusMeta) {
      appleStatusMeta = document.createElement('meta');
      appleStatusMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(appleStatusMeta);
    }
    appleStatusMeta.setAttribute('content', 'black-translucent');

    return () => {
      if (themeMeta) {
        themeMeta.setAttribute('content', originalThemeColor || '#ffffff');
      }
      if (appleStatusMeta) {
        appleStatusMeta.setAttribute('content', originalAppleStatus || 'default');
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Lock body scroll when mobile sidebar is open to prevent underlying page interaction
  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen, isMobile]);

  // RI Support & Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  const [activeRedFlagCount, setActiveRedFlagCount] = useState(0);

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/ri/support/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching RI admin notifications:', err);
    }
  }, []);

  const fetchTicketStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/ri/support/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const pending = data.stats?.pending ?? (data.tickets || []).filter(t => t.status === 'pending').length ?? 0;
        setPendingTicketCount(pending);
      }
    } catch (err) {
      console.error('Error fetching ticket stats:', err);
    }
  }, []);

  const fetchRedFlagStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/ri/red-flags/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const active = data.stats?.active ?? (data.redFlags || []).filter(f => f.status === 'active').length ?? 0;
        setActiveRedFlagCount(active);
      }
    } catch (err) {
      console.error('Error fetching red flag stats:', err);
    }
  }, []);

  const unreadTicketNotifCount = useMemo(() => {
    return (notifications || []).filter(n => !n.is_read && n.type === 'ticket').length;
  }, [notifications]);

  const unreadRedFlagNotifCount = useMemo(() => {
    return (notifications || []).filter(n => !n.is_read && n.type === 'red_flag').length;
  }, [notifications]);

  const markNotificationsAsRead = async (notifId = null) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`${API}/api/ri/support/admin/notifications/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notificationId: notifId })
      });
      fetchAdminNotifications();
      fetchTicketStats();
      fetchRedFlagStats();
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  useEffect(() => {
    fetchAdminNotifications();
    fetchTicketStats();
    fetchRedFlagStats();
    const interval = setInterval(() => {
      fetchAdminNotifications();
      fetchTicketStats();
      fetchRedFlagStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchAdminNotifications, fetchTicketStats, fetchRedFlagStats]);

  // Batches Page state & filters
  const [batchViewMode, setBatchViewMode] = useState('ri'); // 'ri' | 'ltc'
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [batchSourceFilter, setBatchSourceFilter] = useState('all');
  const [batchStatusFilter, setBatchStatusFilter] = useState('all');
  const [ltcSyncFilter, setLtcSyncFilter] = useState('all'); // 'all' | 'synced' | 'unsynced'
  const [syncingLtcBatchId, setSyncingLtcBatchId] = useState(null);
  const [confirmSyncModal, setConfirmSyncModal] = useState(null); // { batch, isResync?: boolean }
  const [isLoadingRiBatches, setIsLoadingRiBatches] = useState(false);

  // Helpers for batch formatting
  const formatDateRange = (start, end) => {
    if (!start && !end) return 'Schedule not set';
    if (start && !end) {
      try {
        return `Starts: ${new Date(start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } catch {
        return `Starts: ${start}`;
      }
    }
    try {
      const s = new Date(start).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      const e = new Date(end).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      return `${s} → ${e}`;
    } catch {
      return `${start} → ${end}`;
    }
  };

  const getBatchStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active' || s === 'immersion') {
      return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', label: status || 'Active' };
    }
    if (s === 'planning' || s === 'orientation') {
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', label: status || 'Planning' };
    }
    if (s === 'completed' || s === 'archived') {
      return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0', label: status || 'Completed' };
    }
    return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', label: status || 'Created' };
  };

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ri_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleToggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(prev => !prev);
    } else {
      toggleSidebarCollapse();
    }
  };

  // Stats state
  const [stats, setStats] = useState({
    total_ri_batches: 0,
    total_ri_students: 0,
    total_ri_panels: 0,
    ltc_ri_students: 0,
    ri_only_students: 0
  });
  const [activeBatches, setActiveBatches] = useState([]);

  // LTC Batches state
  const [ltcBatches, setLtcBatches] = useState([]);
  const [isLoadingLtcBatches, setIsLoadingLtcBatches] = useState(false);

  // RI Batches & Active Batch Detail Workspace
  const [riBatches, setRiBatches] = useState([]);
  const [selectedRiBatchId, setSelectedRiBatchId] = useState(null);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [isLoadingBatchDetails, setIsLoadingBatchDetails] = useState(false);

  // Create RI Direct Batch Modal state (Automatic batch code)
  const [isCreateBatchModalOpen, setIsCreateBatchModalOpen] = useState(false);
  const getNextRiBatchName = useCallback((batchesList = riBatches) => {
    let maxNum = 0;
    (batchesList || []).forEach(b => {
      const match = (b.name || '').match(/BATCH\s+(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : ((batchesList && batchesList.length > 0) ? batchesList.length + 1 : 1);
    return `BATCH ${nextNum} (ONLY RI)`;
  }, [riBatches]);

  const [createBatchFormData, setCreateBatchFormData] = useState({
    name: 'BATCH 1 (ONLY RI)',
    start_date: '',
    end_date: '',
    description: '',
    panel_capacity: 60
  });

  const handleOpenCreateBatchModal = useCallback(() => {
    setCreateBatchFormData({
      name: getNextRiBatchName(riBatches),
      start_date: '',
      end_date: '',
      description: '',
      panel_capacity: 60
    });
    setIsCreateBatchModalOpen(true);
  }, [getNextRiBatchName, riBatches]);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Edit RI Direct Batch Modal state
  const [editBatchModal, setEditBatchModal] = useState(null); // { batch, name, start_date, end_date, description, status, panel_capacity }
  const [isUpdatingBatch, setIsUpdatingBatch] = useState(false);

  // Delete RI Direct Batch Confirmation Modal state
  const [deleteBatchModal, setDeleteBatchModal] = useState(null); // { batch }
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Delete RI Panel Confirmation Modal state
  const [deletePanelModal, setDeletePanelModal] = useState(null); // { panel, isDeleting: boolean, error: string | null }

  // Edit Student Modal state
  const [editStudentModal, setEditStudentModal] = useState(null);
  const [studentModalPanels, setStudentModalPanels] = useState([]);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  // Batch-scoped Villages state
  const [villages, setVillages] = useState([]);
  const [isLoadingVillages, setIsLoadingVillages] = useState(false);
  const [villageModal, setVillageModal] = useState(null); // { mode: 'create' | 'edit' | 'view', village: null }
  const [villageForm, setVillageForm] = useState({
    name: '',
    location: '',
    sarpanch_name: '',
    sarpanch_mobile: '',
    panchayat: '',
    district: '',
    emergency_contact: '',
    notes: ''
  });
  const [isSavingVillage, setIsSavingVillage] = useState(false);
  const [deleteConfirmVillage, setDeleteConfirmVillage] = useState(null);
  const [isDeletingVillage, setIsDeletingVillage] = useState(false);
  const [villageSearch, setVillageSearch] = useState('');

  // Batch-scoped Faculty Mentors state
  const [batchFaculty, setBatchFaculty] = useState([]);
  const [isLoadingBatchFaculty, setIsLoadingBatchFaculty] = useState(false);
  const [batchFacultySearch, setBatchFacultySearch] = useState('');
  const [batchFacultyPanelFilter, setBatchFacultyPanelFilter] = useState('');
  const [facultyModal, setFacultyModal] = useState(null); // { mode: 'create' | 'edit', faculty: null, defaultPanelId: null }
  const [facultyForm, setFacultyForm] = useState({
    name: '',
    email: '',
    mobile: '',
    department: '',
    designation: '',
    employee_id: '',
    role: 'Mentor',
    ri_panel_id: ''
  });
  const [isSavingFaculty, setIsSavingFaculty] = useState(false);
  const [deleteConfirmFaculty, setDeleteConfirmFaculty] = useState(null);
  const [isDeletingFaculty, setIsDeletingFaculty] = useState(false);

  // Faculty Bulk Upload Modal state
  const [facultyUploadModal, setFacultyUploadModal] = useState(false);
  const [facultyUploadMode, setFacultyUploadMode] = useState('batch_wise'); // 'batch_wise' | 'panel_wise'
  const [facultyUploadPanelId, setFacultyUploadPanelId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [isValidatingFaculty, setIsValidatingFaculty] = useState(false);
  const [validationResult, setValidationResult] = useState(null); // { summary: {}, validated_rows: [], errors: [] }
  const [isUploadingFaculty, setIsUploadingFaculty] = useState(false);
  const [filterValidationRows, setFilterValidationRows] = useState('all'); // 'all' | 'valid' | 'errors'

  // Village & Faculty Upload Modal State
  const [villageFacultyModalOpen, setVillageFacultyModalOpen] = useState(false);
  const [villageFacultyTargetBatch, setVillageFacultyTargetBatch] = useState(null);
  const [villageFacultyFile, setVillageFacultyFile] = useState(null);
  const [villageFacultyValidating, setVillageFacultyValidating] = useState(false);
  const [villageFacultyImporting, setVillageFacultyImporting] = useState(false);
  const [villageFacultyValidation, setVillageFacultyValidation] = useState(null);
  const [villageFacultyImportResult, setVillageFacultyImportResult] = useState(null);
  const [villageFacultyError, setVillageFacultyError] = useState('');

  // Nodal Officers Modal State
  const [nodalOfficerModalOpen, setNodalOfficerModalOpen] = useState(false);
  const [nodalOfficerTargetBatch, setNodalOfficerTargetBatch] = useState(null);
  const [nodalOfficersList, setNodalOfficersList] = useState([]);
  const [nodalOfficerLoading, setNodalOfficerLoading] = useState(false);
  const [nodalOfficerSearch, setNodalOfficerSearch] = useState('');
  const [editingNodalOfficer, setEditingNodalOfficer] = useState(null);
  const [savingNodalOfficer, setSavingNodalOfficer] = useState(false);

  // Batch Attendance Download Modal State
  const [attendanceModalBatch, setAttendanceModalBatch] = useState(null);
  const [attendanceFilterType, setAttendanceFilterType] = useState('complete'); // 'complete' | 'panel' | 'village'
  const [selectedAttendancePanelId, setSelectedAttendancePanelId] = useState('');
  const [selectedAttendanceVillageId, setSelectedAttendanceVillageId] = useState('');
  const [attendanceBatchPanels, setAttendanceBatchPanels] = useState([]);
  const [attendanceBatchVillages, setAttendanceBatchVillages] = useState([]);
  const [isLoadingAttendanceMeta, setIsLoadingAttendanceMeta] = useState(false);
  const [isDownloadingAttendance, setIsDownloadingAttendance] = useState(false);

  // Panel Allocation State
  const [savingPanelId, setSavingPanelId] = useState(null);
  const [panelSearchQuery, setPanelSearchQuery] = useState('');

  // Panel Students Modal / View state
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [selectedPanelInfo, setSelectedPanelInfo] = useState(null);
  const [panelStudents, setPanelStudents] = useState([]);
  const [panelStudentSearch, setPanelStudentSearch] = useState('');
  const [panelStudentPage, setPanelStudentPage] = useState(1);
  const [panelStudentTotalPages, setPanelStudentTotalPages] = useState(1);
  const [panelStudentTotalCount, setPanelStudentTotalCount] = useState(0);
  const [isLoadingPanelStudents, setIsLoadingPanelStudents] = useState(false);
  const [isExportingPanelCsv, setIsExportingPanelCsv] = useState(false);
  const [panelModalTab, setPanelModalTab] = useState('students'); // 'students' | 'media'
  const [panelMediaList, setPanelMediaList] = useState([]);
  const [isLoadingPanelMedia, setIsLoadingPanelMedia] = useState(false);

  const fetchPanelMedia = useCallback(async (panelId) => {
    if (!panelId) return;
    setIsLoadingPanelMedia(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/panels/${panelId}/media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPanelMediaList(data.media || []);
      } else {
        setPanelMediaList([]);
      }
    } catch (err) {
      console.error('Error fetching admin panel media:', err);
      setPanelMediaList([]);
    } finally {
      setIsLoadingPanelMedia(false);
    }
  }, []);

  const handleDeletePanelMediaAdmin = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/media/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setPanelMediaList(prev => prev.filter(m => m.id !== mediaId));
      }
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  };

  // Batch Students (Inside Batch Detail) state
  const [batchStudents, setBatchStudents] = useState([]);
  const [batchStudentSearch, setBatchStudentSearch] = useState('');
  const [batchStudentPanelFilter, setBatchStudentPanelFilter] = useState('');
  const [batchStudentPage, setBatchStudentPage] = useState(1);
  const [batchStudentTotalPages, setBatchStudentTotalPages] = useState(1);
  const [batchStudentTotalCount, setBatchStudentTotalCount] = useState(0);
  const [isLoadingBatchStudents, setIsLoadingBatchStudents] = useState(false);

  // RI-Only Individual Student Creation state
  const initialStudentFormData = {
    name: '',
    email: '',
    prn: '',
    roll_number: '',
    gender: '',
    division: '',
    faculty: '',
    school: '',
    department: '',
    semester: '',
    program: '',
    year: '',
    panel: '',
    phone: '',
    personal_email: '',
    dob: '',
    age: '',
    nationality: 'Indian',
    aadhar_no: '',
    lateral_entry: false,
    parent_mobile: '',
    parent_email: '',
    nominee_name: '',
    nominee_relationship: '',
    nominee_email: '',
    address: ''
  };
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentFormData, setStudentFormData] = useState(initialStudentFormData);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);

  // Global All RI Students state
  const [allStudents, setAllStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBatchFilter, setStudentBatchFilter] = useState('');
  const [studentPanelFilter, setStudentPanelFilter] = useState('');
  const [studentSourceFilter, setStudentSourceFilter] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);
  const [studentTotalCount, setStudentTotalCount] = useState(0);
  const [isLoadingAllStudents, setIsLoadingAllStudents] = useState(false);
  const [isExportingAllStudents, setIsExportingAllStudents] = useState(false);
  const [isExportingBatchStudents, setIsExportingBatchStudents] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      navigate('/login');
      return;
    }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'ri_admin' && user.role !== 'admin' && user.role !== 'superadmin') {
        navigate('/login');
        return;
      }
      setCurrentUser(user);
    } catch {
      navigate('/login');
    }
  }, [navigate]);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ri/stats`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || {});
        setActiveBatches(data.active_batches || []);
      }
    } catch (err) {
      console.error('Failed to load RI dashboard stats:', err);
    }
  }, [authHeaders]);

  // Fetch LTC Batches
  const fetchLtcBatches = useCallback(async () => {
    setIsLoadingLtcBatches(true);
    try {
      const res = await fetch(`${API}/api/ri/ltc-batches`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setLtcBatches(data.batches || []);
      } else {
        addToast('Failed to load LTC batches', 'error');
      }
    } catch (err) {
      console.error('Error fetching LTC batches:', err);
      addToast('Error connecting to server', 'error');
    } finally {
      setIsLoadingLtcBatches(false);
    }
  }, [authHeaders]);

  // Fetch RI Batches list
  const fetchRiBatches = useCallback(async () => {
    setIsLoadingRiBatches(true);
    try {
      const res = await fetch(`${API}/api/ri/batches`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        const batches = data.batches || [];
        setRiBatches(batches);
        if (batches.length > 0) {
          setSelectedRiBatchId(prev => {
            if (prev) {
              const matched = batches.find(b => String(b.id) === String(prev) || (b.source_batch_id && String(b.source_batch_id) === String(prev)));
              if (matched) return matched.id;
              return prev;
            }
            return null;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching RI batches:', err);
    } finally {
      setIsLoadingRiBatches(false);
    }
  }, [authHeaders]);

  // Filtered RI Batches for Batches Page
  const filteredRiBatches = useMemo(() => {
    return riBatches.filter(b => {
      const q = (batchSearchQuery || '').toLowerCase().trim();
      const matchesQuery = !q || 
        (b.name && b.name.toLowerCase().includes(q)) || 
        (b.batch_code && b.batch_code.toLowerCase().includes(q)) ||
        (b.source_batch_name && b.source_batch_name.toLowerCase().includes(q));
      
      const isLtc = Boolean(b.source_batch_id || b.source_program === 'LTC' || b.source_program === 'LTC_SYNC');
      const matchesSource = batchSourceFilter === 'all' || 
        ((batchSourceFilter === 'LTC_SYNC' || batchSourceFilter === 'LTC') && isLtc) || 
        ((batchSourceFilter === 'RI_DIRECT' || batchSourceFilter === 'RI') && !isLtc);

      const status = (b.status || '').toLowerCase();
      const matchesStatus = batchStatusFilter === 'all' || status === batchStatusFilter.toLowerCase();

      return matchesQuery && matchesSource && matchesStatus;
    });
  }, [riBatches, batchSearchQuery, batchSourceFilter, batchStatusFilter]);

  // Filtered LTC Batches for Available LTC Batches Tab
  const filteredLtcBatches = useMemo(() => {
    return ltcBatches.filter(b => {
      const q = (batchSearchQuery || '').toLowerCase().trim();
      const matchesQuery = !q || 
        (b.name && b.name.toLowerCase().includes(q)) || 
        (b.batch_code && b.batch_code.toLowerCase().includes(q));
      
      const isSynced = Boolean(b.is_synced_to_ri);
      const matchesSync = ltcSyncFilter === 'all' || 
        (ltcSyncFilter === 'synced' && isSynced) || 
        (ltcSyncFilter === 'unsynced' && !isSynced);

      return matchesQuery && matchesSync;
    });
  }, [ltcBatches, batchSearchQuery, ltcSyncFilter]);

  // Handle explicit Sync of an LTC Batch to RI
  const handleSyncLtcBatch = async (batch) => {
    if (!batch || !batch.id) return;
    setSyncingLtcBatchId(batch.id);
    try {
      const res = await fetch(`${API}/api/ri/batches/${batch.id}/sync`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || `Batch "${batch.name}" synchronized to RI successfully!`, 'success');
        setConfirmSyncModal(null);
        await Promise.all([
          fetchLtcBatches(),
          fetchRiBatches(),
          fetchDashboardStats()
        ]);
      } else {
        addToast(data.message || 'Failed to synchronize batch to RI', 'error');
      }
    } catch (err) {
      console.error('Error syncing LTC batch to RI:', err);
      addToast('Network error while syncing batch to RI', 'error');
    } finally {
      setSyncingLtcBatchId(null);
    }
  };

  // Fetch specific RI Batch Details with Panels
  const fetchRiBatchDetails = useCallback(async (batchId) => {
    if (!batchId) return;
    setIsLoadingBatchDetails(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${batchId}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSelectedBatchDetails(data);
        if (data.batch?.id && String(data.batch.id) !== String(batchId)) {
          setSelectedRiBatchId(data.batch.id);
        }
        if (data.villages && Array.isArray(data.villages)) {
          setVillages(data.villages);
        }
      }
    } catch (err) {
      console.error('Error fetching batch details:', err);
    } finally {
      setIsLoadingBatchDetails(false);
    }
  }, [authHeaders]);

  // Fetch Villages for current batch
  const fetchBatchVillages = useCallback(async (batchId) => {
    if (!batchId) return;
    setIsLoadingVillages(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${batchId}/villages`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setVillages(data.villages || []);
      }
    } catch (err) {
      console.error('Failed to load batch villages:', err);
    } finally {
      setIsLoadingVillages(false);
    }
  }, [authHeaders]);

  // Derived currently active/selected batch object
  const currentBatch = useMemo(() => {
    if (selectedBatchDetails?.batch && (String(selectedBatchDetails.batch.id) === String(selectedRiBatchId) || (selectedBatchDetails.batch.source_batch_id && String(selectedBatchDetails.batch.source_batch_id) === String(selectedRiBatchId)))) {
      return selectedBatchDetails.batch;
    }
    const fromRi = riBatches.find(b => String(b.id) === String(selectedRiBatchId) || (b.source_batch_id && String(b.source_batch_id) === String(selectedRiBatchId)));
    if (fromRi) return fromRi;
    const fromLtc = ltcBatches.find(b => String(b.id) === String(selectedRiBatchId) || (b.ri_batch_id && String(b.ri_batch_id) === String(selectedRiBatchId)));
    if (fromLtc) return fromLtc;
    if (selectedBatchDetails?.batch) return selectedBatchDetails.batch;
    return null;
  }, [selectedBatchDetails?.batch, selectedRiBatchId, riBatches, ltcBatches]);

  // Derived Unique Entities and Metrics for Selected Batch
  const uniquePanels = useMemo(() => {
    const panels = selectedBatchDetails?.panels || [];
    const seen = new Set();
    return panels.filter(p => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [selectedBatchDetails?.panels]);

  const uniqueVillages = useMemo(() => {
    const vList = villages || [];
    const seen = new Set();
    return vList.filter(v => {
      if (!v || seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [villages]);

  const totalBatchStudents = useMemo(() => {
    if (currentBatch?.total_students != null && Number(currentBatch.total_students) > 0) {
      return Number(currentBatch.total_students);
    }
    return uniquePanels.reduce((acc, p) => acc + (Number(p.student_count) || 0), 0);
  }, [currentBatch?.total_students, uniquePanels]);

  const totalPanelsCount = uniquePanels.length;
  const villagesCreatedCount = uniqueVillages.length;
  const allocatedPanelsCount = useMemo(() => uniquePanels.filter(p => p.ri_village_id).length, [uniquePanels]);
  const unallocatedPanelsCount = useMemo(() => uniquePanels.filter(p => !p.ri_village_id).length, [uniquePanels]);

  // Fetch Students for current Batch
  const fetchBatchStudents = useCallback(async (batchId, page = 1, search = '', panelId = '') => {
    if (!batchId) return;
    setIsLoadingBatchStudents(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: search.trim(),
        batch_id: String(batchId),
        panel_id: panelId
      });
      const res = await fetch(`${API}/api/ri/students?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setBatchStudents(data.students || []);
        setBatchStudentPage(data.page || 1);
        setBatchStudentTotalPages(data.total_pages || 1);
        setBatchStudentTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching batch students:', err);
    } finally {
      setIsLoadingBatchStudents(false);
    }
  }, [authHeaders]);

  // Fetch Faculty Mentors for current Batch
  const fetchBatchFaculty = useCallback(async (batchId, panelId = '', search = '') => {
    if (!batchId) return;
    setIsLoadingBatchFaculty(true);
    try {
      const queryParams = new URLSearchParams({
        panel_id: panelId || '',
        search: (search || '').trim()
      });
      const res = await fetch(`${API}/api/ri/batches/${batchId}/faculty?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setBatchFaculty(data.faculty || []);
      }
    } catch (err) {
      console.error('Error fetching batch faculty:', err);
    } finally {
      setIsLoadingBatchFaculty(false);
    }
  }, [authHeaders]);

  // Fetch Nodal Officers for a Batch
  const fetchBatchNodalOfficers = useCallback(async (batchId) => {
    if (!batchId) return;
    setNodalOfficerLoading(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${batchId}/nodal-officers`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setNodalOfficersList(data.nodal_officers || []);
      } else {
        setNodalOfficersList([]);
      }
    } catch (err) {
      console.error('Error fetching batch nodal officers:', err);
      setNodalOfficersList([]);
    } finally {
      setNodalOfficerLoading(false);
    }
  }, [authHeaders]);

  // Download RI Faculty Undertaking PDF
  const handleDownloadFacultyUndertaking = async (faculty) => {
    if (!faculty || !faculty.undertaking_submitted) {
      addToast('No undertaking has been submitted by this faculty member.', 'error');
      return;
    }
    const facultyId = faculty.id || faculty.faculty_id;
    addToast(`Preparing signed undertaking PDF for ${faculty.name || 'faculty'}...`, 'info');
    try {
      const res = await fetch(`${API}/api/ri/faculty/${facultyId}/undertaking-pdf`, {
        headers: authHeaders
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to download undertaking PDF.');
      }
      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      const safeName = (faculty.name || 'Mentor').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `RI_Faculty_Undertaking_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
      addToast('Faculty undertaking PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('Download undertaking error:', err);
      addToast(err.message || 'Failed to download faculty undertaking PDF', 'error');
    }
  };

  // Fetch Panel Students
  const fetchPanelStudents = useCallback(async (panelId, page = 1, search = '') => {
    if (!panelId) return;
    setIsLoadingPanelStudents(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: search.trim()
      });
      const res = await fetch(`${API}/api/ri/panels/${panelId}/students?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setPanelStudents(data.students || []);
        setPanelStudentPage(data.page || 1);
        setPanelStudentTotalPages(data.total_pages || 1);
        setPanelStudentTotalCount(data.total || 0);
        if (data.panel) {
          setSelectedPanelInfo(data.panel);
        }
      }
    } catch (err) {
      console.error('Error fetching panel students:', err);
    } finally {
      setIsLoadingPanelStudents(false);
    }
  }, [authHeaders]);

  // Fetch Global All RI Students
  const fetchAllStudents = useCallback(async (page = 1, search = '', batchId = '', panelId = '', source = '') => {
    setIsLoadingAllStudents(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: search.trim(),
        batch_id: batchId,
        panel_id: panelId,
        source: source
      });
      const res = await fetch(`${API}/api/ri/students?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setAllStudents(data.students || []);
        setStudentPage(data.page || 1);
        setStudentTotalPages(data.total_pages || 1);
        setStudentTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching all RI students:', err);
    } finally {
      setIsLoadingAllStudents(false);
    }
  }, [authHeaders]);

  // Open a specific Batch Workspace
  const openBatchWorkspace = (batchIdOrObj, targetSubTab = 'panels', explicitBatchData = null) => {
    let batchId = batchIdOrObj;
    let batchData = explicitBatchData;
    if (batchIdOrObj && typeof batchIdOrObj === 'object') {
      batchId = batchIdOrObj.id || batchIdOrObj.ri_batch_id;
      batchData = batchIdOrObj;
    }

    if (!batchData && batchId != null) {
      batchData = riBatches.find(b => String(b.id) === String(batchId) || (b.source_batch_id && String(b.source_batch_id) === String(batchId)))
        || ltcBatches.find(b => String(b.id) === String(batchId) || (b.ri_batch_id && String(b.ri_batch_id) === String(batchId)))
        || null;
    }

    setSelectedRiBatchId(batchId);
    setBatchSubTab(targetSubTab);
    setActiveTab('batch_detail');

    if (batchData) {
      setSelectedBatchDetails(prev => ({
        batch: { ...(prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.batch : {}), ...batchData },
        panels: (prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.panels : []) || [],
        villages: (prev?.batch && String(prev.batch.id) === String(batchData.id) ? prev.villages : []) || []
      }));
    } else {
      setSelectedBatchDetails(null);
    }

    if (batchId != null) {
      fetchRiBatchDetails(batchId);
      fetchBatchVillages(batchId);
      fetchBatchFaculty(batchId);
      if (targetSubTab === 'nodal_officers') {
        fetchBatchNodalOfficers(batchId);
      }
    }
  };

  // Initial tab loading effects
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    if (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'dashboard') {
      fetchRiBatches();
      fetchLtcBatches();
    }
  }, [activeTab, fetchLtcBatches, fetchRiBatches]);

  useEffect(() => {
    if (activeTab === 'batch_detail' && selectedRiBatchId) {
      fetchRiBatchDetails(selectedRiBatchId);
      fetchBatchVillages(selectedRiBatchId);
      fetchBatchFaculty(selectedRiBatchId, batchFacultyPanelFilter, batchFacultySearch);
      if (batchSubTab === 'students') {
        fetchBatchStudents(selectedRiBatchId, batchStudentPage, batchStudentSearch, batchStudentPanelFilter);
      }
      if (batchSubTab === 'nodal_officers') {
        fetchBatchNodalOfficers(selectedRiBatchId);
      }
    }
  }, [activeTab, selectedRiBatchId, batchSubTab, batchStudentPage, batchStudentSearch, batchStudentPanelFilter, batchFacultyPanelFilter, batchFacultySearch, fetchRiBatchDetails, fetchBatchVillages, fetchBatchFaculty, fetchBatchStudents, fetchBatchNodalOfficers]);

  useEffect(() => {
    if (activeTab === 'all_students') {
      fetchAllStudents(studentPage, studentSearch, studentBatchFilter, studentPanelFilter, studentSourceFilter);
    }
  }, [activeTab, studentPage, studentSearch, studentBatchFilter, studentPanelFilter, studentSourceFilter, fetchAllStudents]);

  // Handle Create RI Direct Batch
  const handleCreateRiBatch = async (e) => {
    if (e) e.preventDefault();
    if (!createBatchFormData.name?.trim()) {
      addToast('Batch Name is required.', 'error');
      return;
    }
    if (!createBatchFormData.start_date) {
      addToast('Start Date is required.', 'error');
      return;
    }
    if (!createBatchFormData.end_date) {
      addToast('End Date is required.', 'error');
      return;
    }
    if (new Date(createBatchFormData.end_date) < new Date(createBatchFormData.start_date)) {
      addToast('End Date cannot be before Start Date.', 'error');
      return;
    }

    setIsCreatingBatch(true);
    try {
      const res = await fetch(`${API}/api/ri/batches`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createBatchFormData.name.trim(),
          start_date: createBatchFormData.start_date,
          end_date: createBatchFormData.end_date,
          description: createBatchFormData.description.trim(),
          panel_capacity: parseInt(createBatchFormData.panel_capacity, 10) || 60
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create RI batch.');
      }

      addToast(`Batch "${data.batch?.name}" (${data.batch?.batch_code}) created successfully.`, 'success');
      setIsCreateBatchModalOpen(false);
      setCreateBatchFormData({
        name: getNextRiBatchName(),
        start_date: '',
        end_date: '',
        description: '',
        panel_capacity: 60
      });
      await fetchRiBatches();
      await fetchDashboardStats();
      if (data.batch?.id) {
        setSelectedRiBatchId(data.batch.id);
      }
    } catch (err) {
      console.error('Error creating RI Direct batch:', err);
      addToast(err.message || 'Failed to create batch', 'error');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Handle Edit RI Direct Batch
  const handleUpdateBatch = async (e) => {
    e.preventDefault();
    if (!editBatchModal?.batch) return;
    setIsUpdatingBatch(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${editBatchModal.batch.id}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editBatchModal.name.trim(),
          start_date: editBatchModal.start_date,
          end_date: editBatchModal.end_date,
          description: editBatchModal.description.trim(),
          status: editBatchModal.status
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update batch.');

      addToast(`Batch "${data.batch?.name}" updated successfully.`, 'success');
      setEditBatchModal(null);
      await fetchRiBatches();
      if (selectedRiBatchId === editBatchModal.batch.id) {
        await fetchRiBatchDetails(selectedRiBatchId);
      }
    } catch (err) {
      console.error('Error updating batch:', err);
      addToast(err.message || 'Failed to update batch', 'error');
    } finally {
      setIsUpdatingBatch(false);
    }
  };

  // Handle Delete RI Direct Batch
  const handleDeleteBatch = async () => {
    if (!deleteBatchModal?.batch) return;
    setIsDeletingBatch(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${deleteBatchModal.batch.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete batch.');

      addToast(data.message || 'Batch deleted successfully.', 'success');
      const deletedId = deleteBatchModal.batch.id;
      setDeleteBatchModal(null);
      if (selectedRiBatchId === deletedId) {
        setSelectedRiBatchId(null);
        setSelectedBatchDetails(null);
        setActiveTab('batches');
      }
      await fetchRiBatches();
      await fetchDashboardStats();
    } catch (err) {
      console.error('Error deleting batch:', err);
      addToast(err.message || 'Failed to delete batch', 'error');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Handle Delete RI Panel
  const handleDeletePanel = async () => {
    if (!deletePanelModal?.panel) return;
    const panel = deletePanelModal.panel;
    setDeletePanelModal(prev => ({ ...prev, isDeleting: true, error: null }));
    try {
      const res = await fetch(`${API}/api/ri/panels/${panel.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete panel.');
      }

      addToast(data.message || `Panel "${cleanPanelName(panel.name)}" deleted successfully.`, 'success');
      setDeletePanelModal(null);

      // Refresh panel list and batch details
      if (selectedRiBatchId) {
        await fetchRiBatchDetails(selectedRiBatchId);
      }
      await fetchDashboardStats();
    } catch (err) {
      console.error('Error deleting panel:', err);
      setDeletePanelModal(prev => ({ ...prev, isDeleting: false, error: err.message }));
      addToast(err.message || 'Failed to delete panel.', 'error');
    }
  };

  // Open Edit Student Modal
  const openEditStudent = async (student) => {
    setEditStudentModal({
      student,
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || student.mobile || '',
      gender: student.gender || 'Other',
      school: student.school || '',
      department: student.department || '',
      division: student.division || '',
      prn: student.prn || '',
      ri_panel_id: student.panel_id || '',
      batch_id: student.batch_id,
      ri_id: student.ri_id || ''
    });

    if (student.batch_id) {
      try {
        const res = await fetch(`${API}/api/ri/batches/${student.batch_id}/panels`, {
          headers: authHeaders
        });
        if (res.ok) {
          const data = await res.json();
          setStudentModalPanels(data.panels || []);
        }
      } catch (e) {
        console.error('Error fetching student panels:', e);
      }
    }
  };

  // Handle Save Student Edit
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editStudentModal?.student) return;
    setIsUpdatingStudent(true);
    try {
      const studentId = editStudentModal.student.student_id;
      const res = await fetch(`${API}/api/ri/students/${studentId}`, {
        method: 'PUT',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editStudentModal.name?.trim(),
          email: editStudentModal.email?.trim(),
          phone: editStudentModal.phone?.trim(),
          gender: editStudentModal.gender,
          school: editStudentModal.school?.trim(),
          department: editStudentModal.department?.trim(),
          division: editStudentModal.division?.trim(),
          prn: editStudentModal.prn?.trim(),
          ri_panel_id: editStudentModal.ri_panel_id ? parseInt(editStudentModal.ri_panel_id, 10) : null,
          batch_id: editStudentModal.student.batch_id,
          ri_id: editStudentModal.ri_id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update student.');

      addToast('Student details updated successfully.', 'success');
      setEditStudentModal(null);
      // Refresh current students view
      if (activeTab === 'all_students') {
        await fetchAllStudents(studentPage, studentSearch, studentBatchFilter, '', studentSourceFilter);
      }
      if (selectedRiBatchId) {
        await fetchBatchStudents(selectedRiBatchId, batchStudentPage, batchStudentSearch);
      }
    } catch (err) {
      console.error('Error updating student:', err);
      addToast(err.message || 'Failed to update student', 'error');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  // Handle Village Save (Create / Edit)
  const handleSaveVillage = async (e) => {
    e.preventDefault();
    if (!villageForm.name.trim()) {
      addToast('Village name is required', 'error');
      return;
    }
    if (!selectedRiBatchId) {
      addToast('No active batch selected', 'error');
      return;
    }

    setIsSavingVillage(true);
    try {
      if (villageModal?.mode === 'edit' && villageModal.village) {
        const res = await fetch(`${API}/api/ri/villages/${villageModal.village.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(villageForm)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update village');
        addToast(`Village "${villageForm.name}" updated successfully!`, 'success');
        if (data.village) {
          setVillages(prev => prev.map(v => v.id === data.village.id ? { ...v, ...data.village } : v));
        }
      } else {
        const res = await fetch(`${API}/api/ri/batches/${selectedRiBatchId}/villages`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(villageForm)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to create village');
        addToast(`Village "${villageForm.name}" created successfully!`, 'success');
        if (data.village) {
          setVillages(prev => [data.village, ...prev.filter(v => v.id !== data.village.id)]);
        }
      }
      setVillageModal(null);
      fetchBatchVillages(selectedRiBatchId);
      fetchRiBatchDetails(selectedRiBatchId);
      fetchDashboardStats();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSavingVillage(false);
    }
  };

  // Handle Village Delete
  const handleDeleteVillage = async (village, force = false) => {
    setIsDeletingVillage(true);
    try {
      const res = await fetch(`${API}/api/ri/villages/${village.id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.has_assigned_panels) {
          setDeleteConfirmVillage({
            ...village,
            has_assigned_panels: true,
            assigned_panels_count: data.assigned_panels_count,
            assigned_panels: data.assigned_panels
          });
          return;
        }
        throw new Error(data.message || 'Failed to delete village');
      }
      addToast(data.message || 'Village deleted', 'success');
      setDeleteConfirmVillage(null);
      setVillages(prev => prev.filter(v => v.id !== village.id));
      if (selectedRiBatchId) {
        fetchBatchVillages(selectedRiBatchId);
        fetchRiBatchDetails(selectedRiBatchId);
      }
      fetchDashboardStats();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsDeletingVillage(false);
    }
  };

  // Handle Create Single Student in RI-Only Batch
  const handleCreateRiStudent = async (e) => {
    e.preventDefault();
    if (!currentBatch || currentBatch.source_program !== 'RI_DIRECT') {
      addToast('Student creation is only available for RI-only batches.', 'error');
      return;
    }

    if (!studentFormData.name.trim()) {
      addToast('Full Name is required.', 'error');
      return;
    }
    if (!studentFormData.email.trim()) {
      addToast('Official Email is required.', 'error');
      return;
    }
    if (!studentFormData.prn.trim()) {
      addToast('PRN (LTC ID) is required.', 'error');
      return;
    }
    if (!studentFormData.gender) {
      addToast('Gender is required.', 'error');
      return;
    }
    if (!studentFormData.semester.trim()) {
      addToast('Semester is required.', 'error');
      return;
    }

    setIsSubmittingStudent(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${currentBatch.id}/students`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(studentFormData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add student');
      }

      addToast(data.message || 'Student added successfully!', 'success');
      setIsAddStudentModalOpen(false);
      setStudentFormData(initialStudentFormData);

      // Refresh student lists and stats
      fetchBatchStudents(currentBatch.id, 1, '');
      fetchRiBatchDetails(currentBatch.id);
      fetchDashboardStats();
    } catch (err) {
      console.error('Error adding RI student:', err);
      addToast(err.message, 'error');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  // Handle Panel -> Village Assign
  const handleAssignPanelVillage = async (panelId, riVillageId) => {
    setSavingPanelId(panelId);
    try {
      const res = await fetch(`${API}/api/ri/panels/${panelId}/village`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ ri_village_id: riVillageId || null })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to assign village to panel');
      addToast(data.message || 'Panel village updated', 'success');
      if (selectedRiBatchId) {
        fetchRiBatchDetails(selectedRiBatchId);
        fetchBatchVillages(selectedRiBatchId);
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSavingPanelId(null);
    }
  };

  // Handle Single Faculty Save (Create / Edit)
  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    if (!facultyForm.name.trim() || !facultyForm.email.trim() || !facultyForm.ri_panel_id) {
      addToast('Faculty Name, Email, and Panel are required.', 'warning');
      return;
    }
    setIsSavingFaculty(true);
    try {
      const payload = {
        ...facultyForm,
        panel_id: facultyForm.ri_panel_id,
        ri_panel_id: facultyForm.ri_panel_id,
        batch_id: selectedRiBatchId,
        ri_batch_id: selectedRiBatchId
      };
      if (facultyModal?.mode === 'edit' && facultyModal.faculty) {
        const res = await fetch(`${API}/api/ri/faculty/${facultyModal.faculty.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to update faculty');
        addToast(data.message || 'Faculty mentor updated successfully!', 'success');
      } else {
        const res = await fetch(`${API}/api/ri/batches/${selectedRiBatchId}/faculty`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to add faculty');
        addToast(data.message || 'Faculty mentor assigned successfully!', 'success');
      }
      setFacultyModal(null);
      fetchBatchFaculty(selectedRiBatchId, batchFacultyPanelFilter, batchFacultySearch);
      fetchRiBatchDetails(selectedRiBatchId);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSavingFaculty(false);
    }
  };

  // Handle Single Faculty Delete
  const handleDeleteFaculty = async (faculty) => {
    if (!faculty) return;
    setIsDeletingFaculty(true);
    try {
      const res = await fetch(`${API}/api/ri/faculty/${faculty.id}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to remove faculty');
      addToast(data.message || 'Faculty mentor removed successfully.', 'success');
      setDeleteConfirmFaculty(null);
      fetchBatchFaculty(selectedRiBatchId, batchFacultyPanelFilter, batchFacultySearch);
      fetchRiBatchDetails(selectedRiBatchId);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsDeletingFaculty(false);
    }
  };

  // Download Faculty Excel Template
  const handleDownloadFacultyTemplate = async (mode = 'batch_wise', panelId = '') => {
    try {
      const queryParams = new URLSearchParams({ mode });
      if (mode === 'panel_wise' && panelId) {
        queryParams.append('panel_id', String(panelId));
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/batches/${selectedRiBatchId}/faculty/template?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to generate template from server');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'panel_wise'
        ? `ri_faculty_template_panel_wise_${currentBatch?.name || 'batch'}.xlsx`
        : `ri_faculty_template_batch_wise_${currentBatch?.name || 'batch'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast(`Downloaded ${mode === 'panel_wise' ? 'Panel-wise' : 'Batch-wise'} template!`, 'success');
    } catch (err) {
      console.error('Error downloading template:', err);
      addToast(err.message || 'Error downloading template', 'error');
    }
  };

  // Safe helper to parse JSON without throwing "Unexpected token" errors on HTML/non-JSON responses
  const parseSafeJson = async (res) => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        const cleanText = text.replace(/<[^>]+>/g, '').substring(0, 150).trim();
        throw new Error(`Server returned error (${res.status}): ${cleanText || res.statusText}`);
      }
      throw new Error('Received unexpected non-JSON response from server.');
    }
  };

  // Handle Faculty File Select and Pre-Validation
  const handleFacultyFileSelect = async (file) => {
    if (!file) return;
    setUploadFile(file);
    setIsValidatingFaculty(true);
    setValidationResult(null);
    setFilterValidationRows('all');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_mode', facultyUploadMode);
      formData.append('mode', facultyUploadMode);
      if (facultyUploadMode === 'panel_wise' && facultyUploadPanelId) {
        formData.append('ri_panel_id', String(facultyUploadPanelId));
      }

      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/batches/${selectedRiBatchId}/faculty/validate-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await parseSafeJson(res);
      if (!res.ok) {
        throw new Error(data?.message || 'Validation failed');
      }
      setValidationResult(data);
      if (data.summary?.invalid_rows > 0) {
        addToast(`Found ${data.summary.invalid_rows} row(s) with errors. Review row-level details before importing.`, 'warning');
      } else {
        addToast(`Validation passed! All ${data.summary?.valid_rows || 0} rows are valid and ready.`, 'success');
      }
    } catch (err) {
      console.error('Faculty file validation error:', err);
      addToast(err.message || 'Error validating file', 'error');
    } finally {
      setIsValidatingFaculty(false);
    }
  };

  // Execute Bulk Faculty Import
  const handleExecuteFacultyImport = async () => {
    if (!validationResult || !validationResult.validated_rows) return;
    const validRows = validationResult.validated_rows.filter(r => r.is_valid);
    if (validRows.length === 0) {
      addToast('No valid faculty records to import.', 'warning');
      return;
    }

    setIsUploadingFaculty(true);
    try {
      const res = await fetch(`${API}/api/ri/batches/${selectedRiBatchId}/faculty/bulk-upload`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          upload_mode: facultyUploadMode,
          mode: facultyUploadMode,
          ri_panel_id: facultyUploadMode === 'panel_wise' ? facultyUploadPanelId : null,
          rows: validRows
        })
      });
      const data = await parseSafeJson(res);
      if (!res.ok) throw new Error(data?.message || 'Failed to bulk import faculty');

      addToast(data.message || `Successfully imported ${data.imported_count || validRows.length} faculty mentors!`, 'success');
      setFacultyUploadModal(false);
      setUploadFile(null);
      setValidationResult(null);
      fetchBatchFaculty(selectedRiBatchId, batchFacultyPanelFilter, batchFacultySearch);
      fetchRiBatchDetails(selectedRiBatchId);
      setBatchSubTab('faculty');
    } catch (err) {
      addToast(err.message || 'Error during import', 'error');
    } finally {
      setIsUploadingFaculty(false);
    }
  };

  // Village & Faculty Upload Handlers (Smart Tolerant College Format)
  const handleValidateVillageFacultyFile = async (fileToValidate) => {
    const file = fileToValidate || villageFacultyFile;
    if (!file || !villageFacultyTargetBatch?.id) return;
    setVillageFacultyValidating(true);
    setVillageFacultyError('');
    setVillageFacultyValidation(null);
    setVillageFacultyImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API}/api/ri/batches/${villageFacultyTargetBatch.id}/village-faculty/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVillageFacultyValidation(data);
        if (data.preview?.unmatched_faculty_count > 0) {
          addToast(`Validated! ${data.preview.total_panels} panels, ${data.preview.total_villages} villages, and ${data.preview.unmatched_faculty_count} unmatched faculty names.`, 'warning');
        } else {
          addToast(`Validated successfully! ${data.preview?.total_panels || 0} panels & ${data.preview?.total_villages || 0} villages ready for import.`, 'success');
        }
      } else {
        if (data && data.preview) {
          setVillageFacultyValidation(data);
        }
        setVillageFacultyError(data.message || 'Validation failed. Please verify Excel format.');
        addToast(data.message || 'Validation failed', 'error');
      }
    } catch (err) {
      console.error('Error validating village & faculty file:', err);
      setVillageFacultyError('Network error while validating Excel file.');
      addToast('Network error while validating Excel file', 'error');
    } finally {
      setVillageFacultyValidating(false);
    }
  };

  const handleImportVillageFacultyFile = async () => {
    if (!villageFacultyFile || !villageFacultyTargetBatch?.id) return;
    setVillageFacultyImporting(true);
    setVillageFacultyError('');

    const formData = new FormData();
    formData.append('file', villageFacultyFile);

    try {
      const res = await fetch(`${API}/api/ri/batches/${villageFacultyTargetBatch.id}/village-faculty/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVillageFacultyImportResult(data);
        addToast('Village and Faculty data imported successfully!', 'success');
        fetchRiBatches();
        const targetBId = villageFacultyTargetBatch.id;
        fetchRiBatchDetails(targetBId);
        fetchBatchVillages(targetBId);
        fetchBatchFaculty(targetBId);
      } else {
        setVillageFacultyError(data.message || 'Failed to import village & faculty data.');
        addToast(data.message || 'Failed to import', 'error');
      }
    } catch (err) {
      console.error('Error importing village & faculty file:', err);
      setVillageFacultyError('Network error while importing Excel data.');
      addToast('Network error while importing Excel data', 'error');
    } finally {
      setVillageFacultyImporting(false);
    }
  };

  // Download Village & Faculty Excel Template matching batch 9 -village.xlsx layout
  const handleDownloadVillageFacultyTemplate = async () => {
    if (!villageFacultyTargetBatch?.id) return;
    try {
      const res = await fetch(`${API}/api/ri/batches/${villageFacultyTargetBatch.id}/village-faculty/template`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to generate Village & Faculty template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Village_Faculty_Template_${villageFacultyTargetBatch.name || 'Batch'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast('Village & Faculty Excel template downloaded successfully!', 'success');
    } catch (err) {
      console.error('Error downloading village faculty template:', err);
      addToast(err.message || 'Error downloading template', 'error');
    }
  };

  // Open Nodal Officers in Batch Workspace
  const openNodalOfficerModal = (batch) => {
    if (!batch) return;
    openBatchWorkspace(batch.id, 'nodal_officers', batch);
  };

  // Open Edit Nodal Officer Modal
  const openEditNodalOfficer = (officer) => {
    setEditingNodalOfficer({
      panel_id: officer.panel_id,
      panel_name: officer.panel_name || `Panel ${officer.panel_number}`,
      nodal_officer_name: officer.nodal_officer_name || '',
      nodal_officer_email: officer.nodal_officer_email || '',
      department: officer.department || '',
      village_name: officer.village_name || ''
    });
  };

  // Save Nodal Officer Details
  const handleSaveNodalOfficer = async (e) => {
    if (e) e.preventDefault();
    if (!editingNodalOfficer) return;

    setSavingNodalOfficer(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/panels/${editingNodalOfficer.panel_id}/nodal-officer`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nodal_officer_name: editingNodalOfficer.nodal_officer_name,
          nodal_officer_email: editingNodalOfficer.nodal_officer_email,
          department: editingNodalOfficer.department
        })
      });

      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Nodal officer details updated successfully!', 'success');
        // Update local list
        setNodalOfficersList(prev => prev.map(item => {
          if (item.panel_id === editingNodalOfficer.panel_id) {
            return {
              ...item,
              nodal_officer_name: editingNodalOfficer.nodal_officer_name.trim(),
              nodal_officer_email: editingNodalOfficer.nodal_officer_email.trim().toLowerCase(),
              department: editingNodalOfficer.department.trim()
            };
          }
          return item;
        }));
        setEditingNodalOfficer(null);
      } else {
        addToast(data.message || 'Failed to update Nodal Officer', 'error');
      }
    } catch (err) {
      console.error('Error saving nodal officer:', err);
      addToast(err.message || 'Network error while saving Nodal Officer', 'error');
    } finally {
      setSavingNodalOfficer(false);
    }
  };

  // Open Attendance Download Modal for a Batch
  const openBatchAttendanceModal = async (batch) => {
    setAttendanceModalBatch(batch);
    setAttendanceFilterType('complete');
    setSelectedAttendancePanelId('');
    setSelectedAttendanceVillageId('');
    setIsLoadingAttendanceMeta(true);

    try {
      const token = localStorage.getItem('token');
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const [pRes, vRes] = await Promise.all([
        fetch(`${API}/api/ri/batches/${batch.id}/panels`, { headers: authHeaders }),
        fetch(`${API}/api/ri/batches/${batch.id}/villages`, { headers: authHeaders })
      ]);

      const pData = pRes.ok ? await pRes.json() : [];
      const vData = vRes.ok ? await vRes.json() : [];

      const panelsList = Array.isArray(pData) ? pData : (pData?.panels || []);
      const villagesList = Array.isArray(vData) ? vData : (vData?.villages || []);

      setAttendanceBatchPanels(panelsList);
      setAttendanceBatchVillages(villagesList);

      if (panelsList.length > 0) {
        setSelectedAttendancePanelId(String(panelsList[0].id));
      }
      if (villagesList.length > 0) {
        setSelectedAttendanceVillageId(String(villagesList[0].id));
      }
    } catch (err) {
      console.error('Error loading attendance metadata:', err);
    } finally {
      setIsLoadingAttendanceMeta(false);
    }
  };

  // Download Attendance Excel for Batch / Panel / Village
  const handleDownloadAttendanceExcel = async () => {
    if (!attendanceModalBatch) return;
    setIsDownloadingAttendance(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        batch_id: String(attendanceModalBatch.id),
        format: 'excel'
      });

      if (attendanceFilterType === 'panel') {
        if (!selectedAttendancePanelId) {
          addToast('Please select a panel to download attendance', 'warning');
          setIsDownloadingAttendance(false);
          return;
        }
        queryParams.append('panel_id', String(selectedAttendancePanelId));
      } else if (attendanceFilterType === 'village') {
        if (!selectedAttendanceVillageId) {
          addToast('Please select a village to download attendance', 'warning');
          setIsDownloadingAttendance(false);
          return;
        }
        queryParams.append('village_id', String(selectedAttendanceVillageId));
      }

      const res = await fetch(`${API}/api/ri/reports/attendance?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to download attendance excel');
      }

      // Extract filename from Content-Disposition header if present
      const disposition = res.headers.get('Content-Disposition');
      let filename = `RI_Attendance_${attendanceModalBatch.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addToast(`Attendance report downloaded successfully!`, 'success');
      setAttendanceModalBatch(null);
    } catch (err) {
      console.error('Attendance download error:', err);
      addToast(err.message || 'Error downloading attendance report', 'error');
    } finally {
      setIsDownloadingAttendance(false);
    }
  };

  // Export Faculty to CSV
  const exportFacultyToCSV = (facultyList, filename = 'ri_faculty.csv') => {
    if (!facultyList || facultyList.length === 0) {
      addToast('No faculty records to export.', 'warning');
      return;
    }
    const headers = ['Name', 'Email', 'Role', 'Department', 'Designation', 'Employee ID', 'Mobile', 'Panel Number', 'Panel Name', 'Assigned Village', 'LTC User Synced'];
    const rows = facultyList.map(f => [
      `"${(f.name || '').replace(/"/g, '""')}"`,
      f.email || '',
      `"${(f.role || '').replace(/"/g, '""')}"`,
      `"${(f.department || '').replace(/"/g, '""')}"`,
      `"${(f.designation || '').replace(/"/g, '""')}"`,
      f.employee_id || '',
      f.mobile || '',
      f.panel_number ? `P${f.panel_number}` : '',
      `"${cleanPanelName(f.panel_name).replace(/"/g, '""')}"`,
      `"${(f.village_name || '').replace(/"/g, '""')}"`,
      f.user_id ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Faculty records exported successfully.', 'success');
  };

  // Export Table Data to CSV with dynamic Student ID and Panel
  const exportStudentsToCSV = (students, filename = 'ri_students.csv') => {
    if (!students || students.length === 0) {
      addToast('No student records to export.', 'warning');
      return;
    }
    const headers = ['Student ID', 'PRN', 'Name', 'Email', 'School', 'Department', 'Division', 'Semester/Year', 'Batch', 'Panel', 'Source'];
    const rows = students.map(s => {
      const isRiDirect = s.source_program === 'RI_DIRECT' || s.batch_source === 'RI_DIRECT';
      const studentId = isRiDirect ? (s.ri_id || '') : (s.ltc_id || '');
      return [
        `"${String(studentId).replace(/"/g, '""')}"`,
        `"${(s.prn || '').replace(/"/g, '""')}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.email || '').replace(/"/g, '""')}"`,
        `"${(s.school || '').replace(/"/g, '""')}"`,
        `"${(s.department || '').replace(/"/g, '""')}"`,
        `"${(s.division || '').replace(/"/g, '""')}"`,
        `"${(s.semester || s.year || '').replace(/"/g, '""')}"`,
        `"${(s.batch_name || currentBatch?.name || '').replace(/"/g, '""')}"`,
        `"${cleanPanelName(s.panel_name || selectedPanel?.name || '').replace(/"/g, '""')}"`,
        `"${(s.source_program || (isRiDirect ? 'RI_DIRECT' : 'LTC_SYNC')).replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Exported ${students.length} student records successfully.`, 'success');
  };

  // Full Unpaginated Export for All Students Tab
  const handleExportAllStudents = async () => {
    setIsExportingAllStudents(true);
    try {
      addToast('Preparing full student records export...', 'info');
      const queryParams = new URLSearchParams({
        export: 'true',
        search: studentSearch.trim(),
        batch_id: studentBatchFilter,
        panel_id: studentPanelFilter,
        source: studentSourceFilter
      });
      const res = await fetch(`${API}/api/ri/students?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (!res.ok) {
        throw new Error('Failed to fetch full student records for export');
      }
      const data = await res.json();
      const studentsToExport = data.students || [];
      if (studentsToExport.length === 0) {
        addToast('No student records found to export.', 'warning');
        return;
      }
      exportStudentsToCSV(studentsToExport, 'all_ri_students.csv');
    } catch (err) {
      console.error('Error exporting all students:', err);
      addToast('Failed to export students: ' + err.message, 'error');
    } finally {
      setIsExportingAllStudents(false);
    }
  };

  // Full Unpaginated Export for Current Batch Students Subtab
  const handleExportBatchStudents = async () => {
    if (!currentBatch || !currentBatch.id) {
      addToast('No active batch selected for export.', 'warning');
      return;
    }
    setIsExportingBatchStudents(true);
    try {
      addToast('Preparing batch student export...', 'info');
      const queryParams = new URLSearchParams({
        export: 'true',
        batch_id: String(currentBatch.id),
        search: batchStudentSearch.trim(),
        panel_id: batchStudentPanelFilter
      });
      const res = await fetch(`${API}/api/ri/students?${queryParams.toString()}`, {
        headers: authHeaders
      });
      if (!res.ok) {
        throw new Error('Failed to fetch batch students for export');
      }
      const data = await res.json();
      const studentsToExport = data.students || [];
      if (studentsToExport.length === 0) {
        addToast('No students in this batch to export.', 'warning');
        return;
      }
      exportStudentsToCSV(studentsToExport, `${currentBatch.name || 'batch'}_students.csv`);
    } catch (err) {
      console.error('Error exporting batch students:', err);
      addToast('Failed to export batch students: ' + err.message, 'error');
    } finally {
      setIsExportingBatchStudents(false);
    }
  };

  // Export Panel CSV with batch-source detection, correct student identifier, and actual assigned Panel column
  const exportPanelCSV = async (panel) => {
    if (!panel || !panel.id) {
      addToast('No panel selected for export.', 'warning');
      return;
    }
    setIsExportingPanelCsv(true);
    try {
      addToast('Preparing panel export...', 'info');
      const res = await fetch(`${API}/api/ri/panels/${panel.id}/students?export=true`, {
        headers: authHeaders
      });
      if (!res.ok) {
        throw new Error('Failed to fetch panel students for export');
      }
      const data = await res.json();
      const students = data.students || [];
      if (students.length === 0) {
        addToast('No student records in this panel to export.', 'warning');
        return;
      }

      // Detect batch source type via actual database metadata
      const sourceProgram = data.panel?.source_program || panel.source_program || currentBatch?.source_program || 'LTC_SYNC';
      const isRiDirect = sourceProgram === 'RI_DIRECT';

      // Header naming based on selected batch type, with actual assigned Panel column
      const idHeader = isRiDirect ? 'RI ID' : 'LTC ID';
      const headers = [idHeader, 'Name', 'School', 'Department', 'Division', 'Panel', 'Source'];

      const rows = students.map(s => {
        // For RI-only batches, export RI ID. For LTC+RI synced batches, export existing LTC_ID without generating new ID or using RI ID as fallback.
        const studentId = isRiDirect ? (s.ri_id || '') : (s.ltc_id || '');
        const panelName = cleanPanelName(s.panel_name || data.panel?.panel_name || data.panel?.name || panel.name || '');
        return [
          `"${String(studentId).replace(/"/g, '""')}"`,
          `"${(s.name || '').replace(/"/g, '""')}"`,
          `"${(s.school || '').replace(/"/g, '""')}"`,
          `"${(s.department || '').replace(/"/g, '""')}"`,
          `"${(s.division || '').replace(/"/g, '""')}"`,
          `"${String(panelName).replace(/"/g, '""')}"`,
          `"${(s.source_program || (isRiDirect ? 'RI_DIRECT' : 'LTC_SYNC')).replace(/"/g, '""')}"`
        ];
      });

      const csvString = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${panel.name}_students.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast(`Exported ${students.length} students to ${panel.name}_students.csv`, 'success');
    } catch (err) {
      console.error('Error exporting panel CSV:', err);
      addToast('Failed to export panel CSV: ' + err.message, 'error');
    } finally {
      setIsExportingPanelCsv(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        backgroundColor: '#f8fafc',
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* ── Toast Notifications ── */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 18px',
              borderRadius: '8px',
              backgroundColor: t.type === 'error' ? '#ef4444' : t.type === 'warning' ? '#f59e0b' : '#15803d',
              color: '#ffffff',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {t.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Mobile Sidebar Backdrop (Clean tint, no blur) ── */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            zIndex: 40,
            cursor: 'pointer'
          }}
        />
      )}

      {/* ── Collapsible Sidebar ── */}
      {(() => {
        const showCollapsed = !isMobile && isCollapsed;
        return (
          <aside
            className={`fixed md:sticky top-0 left-0 transition-[transform,width] duration-300 ease-in-out md:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
            style={{
              width: showCollapsed ? '72px' : '260px',
              maxWidth: '85vw',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              top: 0,
              height: '100dvh',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              boxShadow: isSidebarOpen ? '0 20px 25px -5px rgba(0, 0, 0, 0.2)' : '1px 0 10px rgba(0, 0, 0, 0.01)',
              zIndex: 50
            }}
          >
            {/* Sleek Floating Collapse/Expand Toggle Button on Sidebar Right Edge (Desktop only) */}
            {!isMobile && (
              <button
                onClick={toggleSidebarCollapse}
                title={showCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                aria-label={showCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
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
                  color: '#15803d',
                  outline: 'none',
                  padding: 0,
                  transition: 'transform 0.2s ease, background-color 0.2s ease'
                }}
              >
                {showCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
              </button>
            )}

            {/* Sidebar Header / Brand */}
            <div
              style={{
                height: '74px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isMobile ? 'space-between' : (showCollapsed ? 'center' : 'flex-start'),
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                boxSizing: 'border-box',
                transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)',
                padding: isMobile ? '0 16px' : (showCollapsed ? '0' : '0 18px')
              }}
            >
              {isMobile ? (
                <>
                  <img
                    src="/ri11.png"
                    alt="Rural Immersion Logo"
                    onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
                    style={{
                      height: '40px',
                      maxWidth: '175px',
                      objectFit: 'contain'
                    }}
                  />
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    aria-label="Close Sidebar"
                    style={{
                      border: 'none',
                      background: '#f1f5f9',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                  >
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <img
                    src="/ri11.png"
                    alt="Rural Immersion Logo"
                    onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
                    style={{
                      height: '42px',
                      maxWidth: '185px',
                      objectFit: 'contain',
                      position: 'absolute',
                      left: showCollapsed ? '50%' : '18px',
                      transform: showCollapsed ? 'translateX(-50%) scale(0.8)' : 'none',
                      opacity: showCollapsed ? 0 : 1,
                      transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: 'none'
                    }}
                  />
                  <img
                    src="/ri-logo-mob.png"
                    alt="Rural Immersion Logo"
                    style={{
                      height: '38px',
                      width: '38px',
                      objectFit: 'contain',
                      opacity: showCollapsed ? 1 : 0,
                      transform: showCollapsed ? 'scale(1)' : 'scale(0.7)',
                      transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
                      pointerEvents: 'none'
                    }}
                  />
                </>
              )}
            </div>

            {/* Sidebar Navigation */}
            <nav
              style={{
                flex: 1,
                padding: showCollapsed ? '16px 8px' : '16px 12px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                overflowX: 'hidden'
              }}
            >
              {/* Section Label */}
              {!showCollapsed && (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Navigation</span>
              )}
              <button
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'RI Dashboard' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'space-between',
                  gap: showCollapsed ? '0px' : '12px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'dashboard' ? '600' : '500',
                  color: activeTab === 'dashboard' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'dashboard' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'dashboard' ? '' : 'hover:bg-slate-50'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0' : '10px', minWidth: 0 }}>
                  <Home size={16} style={{ flexShrink: 0, color: activeTab === 'dashboard' ? '#ffffff' : '#047857' }} />
                  {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>RI Dashboard</span>}
                </div>
              </button>

              {/* Section Heading: Batches */}
              {!showCollapsed ? (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 4px 12px', display: 'block' }}>Batch Management</span>
              ) : (
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 4px' }} />
              )}

              <button
                onClick={() => { setActiveTab('batches'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Batches' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'space-between',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '600' : '500',
                  color: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '#ffffff' : '#475569',
                  backgroundColor: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={(activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '' : 'hover:bg-slate-50'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0' : '10px', minWidth: 0 }}>
                  <Layers size={16} style={{ flexShrink: 0, color: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '#ffffff' : '#047857' }} />
                  {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Batches</span>}
                </div>
                {!showCollapsed && riBatches.length > 0 && (
                  <span style={{
                    fontSize: '10px',
                    backgroundColor: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? 'rgba(255,255,255,0.2)' : '#ecfdf5',
                    color: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '#ffffff' : '#047857',
                    border: (activeTab === 'batches' || activeTab === 'ltc_batches' || activeTab === 'batch_detail') ? '1px solid rgba(255,255,255,0.3)' : '1px solid #a7f3d0',
                    padding: '2px 7px',
                    borderRadius: '12px',
                    fontWeight: '700'
                  }}>
                    {riBatches.length}
                  </span>
                )}
              </button>

              {/* Section Heading: Directory */}
              {!showCollapsed ? (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 4px 12px', display: 'block' }}>Directory</span>
              ) : (
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 4px' }} />
              )}

              <button
                onClick={() => { setActiveTab('all_students'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'All RI Students' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'all_students' ? '600' : '500',
                  color: activeTab === 'all_students' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'all_students' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'all_students' ? '' : 'hover:bg-slate-50'}
              >
                <Users size={16} style={{ flexShrink: 0, color: activeTab === 'all_students' ? '#ffffff' : '#047857' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>All RI Students</span>}
              </button>

              <button
                onClick={() => { setActiveTab('submissions'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Submissions' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'submissions' ? '600' : '500',
                  color: activeTab === 'submissions' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'submissions' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'submissions' ? '' : 'hover:bg-slate-50'}
              >
                <ClipboardList size={16} style={{ flexShrink: 0, color: activeTab === 'submissions' ? '#ffffff' : '#047857' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Submissions</span>}
              </button>

              <button
                onClick={() => { setActiveTab('bulk_upload'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'RI Bulk Upload' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'bulk_upload' ? '600' : '500',
                  color: activeTab === 'bulk_upload' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'bulk_upload' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'bulk_upload' ? '' : 'hover:bg-slate-50'}
              >
                <UploadCloud size={16} style={{ flexShrink: 0, color: activeTab === 'bulk_upload' ? '#ffffff' : '#047857' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>RI Bulk Upload</span>}
              </button>

              {/* Faculty Uploads */}
              <button
                onClick={() => {
                  setActiveTab('faculty_uploads');
                  if (isMobile) setIsSidebarOpen(false);
                }}
                title={showCollapsed ? 'Faculty Uploads' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'faculty_uploads' ? '600' : '500',
                  color: activeTab === 'faculty_uploads' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'faculty_uploads' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'faculty_uploads' ? '' : 'hover:bg-slate-50'}
              >
                <UploadCloud size={16} style={{ flexShrink: 0, color: activeTab === 'faculty_uploads' ? '#ffffff' : '#047857' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Faculty Uploads</span>}
              </button>

              {/* Section Heading: Communication */}
              {!showCollapsed ? (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 4px 12px', display: 'block' }}>Communication</span>
              ) : (
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 4px' }} />
              )}

              {/* Collapsible Communication Menu */}
              <button
                onClick={() => {
                  if (showCollapsed) setIsCollapsed(false);
                  setIsCommunicationDropdownOpen(prev => !prev);
                }}
                title={showCollapsed ? 'Communication' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: ['communication_sender', 'communication_logs'].includes(activeTab) ? '600' : '500',
                  color: ['communication_sender', 'communication_logs'].includes(activeTab) ? '#ffffff' : '#475569',
                  backgroundColor: ['communication_sender', 'communication_logs'].includes(activeTab) ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={['communication_sender', 'communication_logs'].includes(activeTab) ? '' : 'hover:bg-slate-50'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0' : '10px', minWidth: 0 }}>
                  <Mail size={16} style={{ flexShrink: 0, color: ['communication_sender', 'communication_logs'].includes(activeTab) ? '#ffffff' : '#047857' }} />
                  {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Communication</span>}
                </div>
                {!showCollapsed && (
                  <ChevronDown
                    size={14}
                    style={{
                      transition: 'transform 0.2s ease',
                      transform: isCommunicationDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: ['communication_sender', 'communication_logs'].includes(activeTab) ? '#ffffff' : '#64748b'
                    }}
                  />
                )}
              </button>

              {isCommunicationDropdownOpen && !showCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '14px', gap: '2px', marginBottom: '4px' }}>
                  <button
                    onClick={() => { setActiveTab('communication_sender'); setIsSidebarOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: activeTab === 'communication_sender' ? '700' : '500',
                      color: activeTab === 'communication_sender' ? '#047857' : '#475569',
                      backgroundColor: activeTab === 'communication_sender' ? '#ecfdf5' : 'transparent',
                      border: activeTab === 'communication_sender' ? '1px solid #a7f3d0' : 'none',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    className={activeTab === 'communication_sender' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <Send size={13} style={{ color: activeTab === 'communication_sender' ? '#047857' : '#64748b' }} />
                    <span>Sender Console</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('communication_logs'); setIsSidebarOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: activeTab === 'communication_logs' ? '700' : '500',
                      color: activeTab === 'communication_logs' ? '#047857' : '#475569',
                      backgroundColor: activeTab === 'communication_logs' ? '#ecfdf5' : 'transparent',
                      border: activeTab === 'communication_logs' ? '1px solid #a7f3d0' : 'none',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    className={activeTab === 'communication_logs' ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
                  >
                    <History size={13} style={{ color: activeTab === 'communication_logs' ? '#047857' : '#64748b' }} />
                    <span>Email Audit Logs</span>
                  </button>
                </div>
              )}

              {/* Section Heading: Helpdesk */}
              {!showCollapsed ? (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 4px 12px', display: 'block' }}>Helpdesk</span>
              ) : (
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 4px' }} />
              )}

              <button
                onClick={() => { setActiveTab('tickets'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Support Tickets' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'space-between',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'tickets' ? '600' : '500',
                  color: activeTab === 'tickets' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'tickets' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'tickets' ? '' : 'hover:bg-slate-50'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0' : '10px', minWidth: 0 }}>
                  <MessageSquare size={16} style={{ flexShrink: 0, color: activeTab === 'tickets' ? '#ffffff' : '#047857' }} />
                  {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Support Tickets</span>}
                </div>
                {!showCollapsed && (pendingTicketCount > 0 || unreadTicketNotifCount > 0) && (
                  <span style={{
                    fontSize: '10.5px',
                    backgroundColor: activeTab === 'tickets' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
                    color: activeTab === 'tickets' ? '#ffffff' : '#dc2626',
                    border: activeTab === 'tickets' ? '1px solid rgba(255,255,255,0.4)' : '1px solid #fca5a5',
                    padding: '2px 7px',
                    borderRadius: '12px',
                    fontWeight: '750'
                  }}>
                    {pendingTicketCount > 0 ? pendingTicketCount : unreadTicketNotifCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('redflags'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Red Flags' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'redflags' ? '600' : '500',
                  color: activeTab === 'redflags' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'redflags' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'redflags' ? '' : 'hover:bg-slate-50'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0' : '10px', minWidth: 0, flex: 1 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, color: activeTab === 'redflags' ? '#ffffff' : '#e11d48' }} />
                  {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Red Flags</span>}
                </div>
                {!showCollapsed && (activeRedFlagCount > 0 || unreadRedFlagNotifCount > 0) && (
                  <span style={{
                    fontSize: '10.5px',
                    backgroundColor: activeTab === 'redflags' ? 'rgba(255,255,255,0.25)' : '#fff1f2',
                    color: activeTab === 'redflags' ? '#ffffff' : '#e11d48',
                    border: activeTab === 'redflags' ? '1px solid rgba(255,255,255,0.4)' : '1px solid #fecdd3',
                    padding: '2px 7px',
                    borderRadius: '12px',
                    fontWeight: '750'
                  }}>
                    {activeRedFlagCount > 0 ? activeRedFlagCount : unreadRedFlagNotifCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setActiveTab('orangeflags'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Orange Flags' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'orangeflags' ? '600' : '500',
                  color: activeTab === 'orangeflags' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'orangeflags' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'orangeflags' ? '' : 'hover:bg-slate-50'}
              >
                <Flag size={16} style={{ flexShrink: 0, color: activeTab === 'orangeflags' ? '#ffffff' : '#ea580c' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Orange Flags</span>}
              </button>

              {/* Section Heading: Governance */}
              {!showCollapsed ? (
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '10px 12px 4px 12px', display: 'block' }}>Governance</span>
              ) : (
                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '8px 4px' }} />
              )}

              <button
                onClick={() => { setActiveTab('audit_logs'); setIsSidebarOpen(false); }}
                title={showCollapsed ? 'Audit Logs' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: showCollapsed ? 'center' : 'flex-start',
                  gap: showCollapsed ? '0px' : '10px',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'audit_logs' ? '600' : '500',
                  color: activeTab === 'audit_logs' ? '#ffffff' : '#475569',
                  backgroundColor: activeTab === 'audit_logs' ? '#047857' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  marginBottom: '2px'
                }}
                className={activeTab === 'audit_logs' ? '' : 'hover:bg-slate-50'}
              >
                <ShieldCheck size={16} style={{ flexShrink: 0, color: activeTab === 'audit_logs' ? '#ffffff' : '#047857' }} />
                {!showCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Audit Logs</span>}
              </button>
            </nav>

            {/* Sidebar Footer / User Profile */}
            <div
              style={{
                padding: '16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flexShrink: 0,
                backgroundColor: '#ffffff'
              }}
            >
              {/* Profile Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: showCollapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', justifyContent: showCollapsed ? 'center' : 'flex-start' }}>
                <div
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: '#047857',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title={showCollapsed ? (currentUser?.name || 'RI Admin') : undefined}
                >
                  <ShieldCheck size={16} color="#ffffff" />
                </div>
                {!showCollapsed && (
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                    <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: '600', fontSize: '12px', color: '#0f172a', lineHeight: '1.2', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {currentUser?.name || 'RI Admin'}
                    </p>
                    <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '10px', color: '#64748b' }}>Administrator</p>
                  </div>
                )}
              </div>
              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: showCollapsed ? 'center' : 'center',
                  gap: '6px', padding: '8px',
                  borderRadius: '8px', border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff', color: '#475569',
                  cursor: 'pointer', fontSize: '11.5px', fontWeight: '600',
                  transition: 'all 0.15s ease',
                  width: showCollapsed ? '36px' : '100%', height: '36px',
                  overflow: 'hidden'
                }}
                className="hover:bg-slate-50"
              >
                <LogOut size={13} style={{ flexShrink: 0 }} />
                <span style={{ maxWidth: showCollapsed ? '0px' : '80px', overflow: 'hidden', opacity: showCollapsed ? 0 : 1, visibility: showCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>Sign Out</span>
              </button>
            </div>
          </aside>
        );
      })()}

      {/* ── Main Content Area ── */}
      <main
        ref={mainScrollRef}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowY: 'auto',
          minHeight: '100dvh',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Top Header - Seamless iOS status-bar extension and safe-area spacing */}
        <header
          className="sticky top-0 z-30 flex-shrink-0"
          style={{
            backgroundColor: '#047857',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              height: '48px',
              width: '100%'
            }}
          >
            {/* Left: Mobile Hamburger Toggle + Breadcrumb */}
            <div className="flex items-center min-w-0">
              <button
                onClick={() => setIsSidebarOpen(prev => !prev)}
                className="md:hidden flex items-center justify-center p-1.5 mr-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                aria-label={isSidebarOpen ? "Close Navigation" : "Open Navigation"}
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            <div
              className="flex items-center truncate"
              style={{ fontFamily: '"Poppins", sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.2, color: '#ffffff' }}
            >
              {activeTab === 'batch_detail' && (
                <button
                  onClick={() => setActiveTab('batches')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#ffffff', borderRadius: '6px', padding: '4px 8px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginRight: '8px'
                  }}
                >
                  <ArrowLeft size={12} />
                </button>
              )}
              <span className="hidden sm:inline">RI Admin</span>
              <span className="hidden sm:inline mx-2" style={{ color: 'rgba(216,217,229,0.4)' }}>/</span>
              <span className="truncate" style={{ fontWeight: 400 }}>
                {activeTab === 'dashboard' && 'Overview'}
                {(activeTab === 'batches' || activeTab === 'ltc_batches') && 'RI Batches'}
                {activeTab === 'batch_detail' && (currentBatch?.name || 'Batch Workspace')}
                {activeTab === 'all_students' && 'All Students'}
                {activeTab === 'submissions' && 'Student Submissions'}
                {activeTab === 'bulk_upload' && 'Bulk Upload'}
                {activeTab === 'faculty_uploads' && 'Faculty Uploads'}
                {activeTab === 'communication_sender' && 'Sender Console'}
                {activeTab === 'communication_logs' && 'Email Audit Logs'}
                {activeTab === 'tickets' && 'Support Tickets'}
                {activeTab === 'redflags' && 'Red Flags'}
                {activeTab === 'orangeflags' && 'Orange Flags'}
                {activeTab === 'audit_logs' && 'Audit Logs'}
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNotifDropdownOpen(prev => !prev)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: isNotifDropdownOpen ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                title="Notifications"
              >
                <Bell size={15} />
                {unreadNotifCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #047857'
                  }}>
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown & Mobile Bottom Sheet */}
              {isNotifDropdownOpen && (
                <>
                  {/* Backdrop Overlay for closing on outside click */}
                  <div
                    onClick={() => setIsNotifDropdownOpen(false)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 9998,
                      backgroundColor: isMobile ? 'rgba(15, 23, 42, 0.55)' : 'transparent',
                      backdropFilter: isMobile ? 'blur(3px)' : 'none'
                    }}
                  />

                  <div
                    style={isMobile ? {
                      position: 'fixed',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      width: '100%',
                      maxWidth: '100vw',
                      maxHeight: '84vh',
                      backgroundColor: '#ffffff',
                      borderRadius: '20px 20px 0 0',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
                      zIndex: 9999,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    } : {
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '360px',
                      maxWidth: 'calc(100vw - 24px)',
                      maxHeight: '490px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 12px 28px -4px rgba(0,0,0,0.18)',
                      zIndex: 9999,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {isMobile && (
                      <div style={{ width: '36px', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '2px', margin: '8px auto 2px auto', flexShrink: 0 }} />
                    )}

                    <div style={{
                      padding: isMobile ? '12px 16px' : '13px 18px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#047857'
                        }}>
                          <Bell size={14} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>RI Notifications</span>
                        {unreadNotifCount > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 7px', background: '#fee2e2', color: '#dc2626', borderRadius: '12px' }}>
                            {unreadNotifCount} new
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {unreadNotifCount > 0 && (
                          <button
                            onClick={() => markNotificationsAsRead()}
                            style={{
                              background: '#f0fdf4',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              color: '#047857',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              padding: '4px 8px'
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setIsNotifDropdownOpen(false)}
                          title="Close Notifications"
                          style={{
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b'
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      maxHeight: isMobile ? '56vh' : '320px',
                      overflowY: 'auto',
                      WebkitOverflowScrolling: 'touch'
                    }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                          <Bell size={32} style={{ color: '#cbd5e1', margin: '0 auto 10px auto' }} />
                          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155' }}>You're all caught up!</div>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>No notifications on record.</p>
                        </div>
                      ) : (
                        notifications.map(n => {
                          const isRedFlag = n.type === 'red_flag';
                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (!n.is_read) markNotificationsAsRead(n.id);
                                setIsNotifDropdownOpen(false);
                                if (isRedFlag) {
                                  setActiveTab('redflags');
                                } else {
                                  setActiveTab('tickets');
                                }
                              }}
                              style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                backgroundColor: n.is_read ? '#ffffff' : (isRedFlag ? '#fff1f2' : '#f0fdf4'),
                                borderLeft: n.is_read ? '3px solid transparent' : (isRedFlag ? '3px solid #e11d48' : '3px solid #059669'),
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.backgroundColor = isRedFlag ? '#ffe4e6' : '#ecfdf5'; }}
                              onMouseLeave={e => { e.currentTarget.style.backgroundColor = n.is_read ? '#ffffff' : (isRedFlag ? '#fff1f2' : '#f0fdf4'); }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                  {isRedFlag ? (
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '750',
                                      color: '#be123c',
                                      backgroundColor: '#ffe4e6',
                                      border: '1px solid #fecdd3',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      flexShrink: 0
                                    }}>
                                      <AlertTriangle size={10} style={{ color: '#e11d48' }} />
                                      RED FLAG
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '9.5px',
                                      fontWeight: '750',
                                      color: '#047857',
                                      backgroundColor: '#dcfce7',
                                      border: '1px solid #bbf7d0',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      flexShrink: 0
                                    }}>
                                      <MessageSquare size={10} style={{ color: '#047857' }} />
                                      TICKET
                                    </span>
                                  )}
                                  <span style={{ fontSize: '13px', fontWeight: n.is_read ? '600' : '750', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {n.title}
                                  </span>
                                </div>
                                {!n.is_read && (
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isRedFlag ? '#e11d48' : '#059669', flexShrink: 0 }} />
                                )}
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.45', wordBreak: 'break-word' }}>
                                {n.message}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', fontWeight: '500' }}>
                                {new Date(n.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{
                      padding: '10px 14px',
                      borderTop: '1px solid #f1f5f9',
                      backgroundColor: '#f8fafc',
                      flexShrink: 0,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifDropdownOpen(false);
                          setActiveTab('tickets');
                        }}
                        style={{
                          background: '#047857',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>Support Tickets</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsNotifDropdownOpen(false);
                          setActiveTab('redflags');
                        }}
                        style={{
                          background: '#be123c',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px'
                        }}
                      >
                        <AlertTriangle size={13} />
                        <span>Red Flags</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                fetchDashboardStats();
                if (activeTab === 'batches' || activeTab === 'ltc_batches') fetchRiBatches();
                if (activeTab === 'batch_detail' && selectedRiBatchId) {
                  fetchRiBatchDetails(selectedRiBatchId);
                  fetchBatchVillages(selectedRiBatchId);
                }
                if (activeTab === 'all_students') {
                  fetchAllStudents(studentPage, studentSearch, studentBatchFilter, studentPanelFilter, studentSourceFilter);
                }
                fetchAdminNotifications();
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-white/10 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '6px 10px', fontSize: '12px', fontWeight: 600,
                color: '#ffffff', background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.35)', borderRadius: '6px',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
              title="Sign Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 md:p-7" style={{ flex: 1 }}>
          {/* ================================================================ */}
          {/* TAB 1: DASHBOARD                                                 */}
          {/* ================================================================ */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* KPI Cards Grid — Compact 2-column grid on mobile, responsive multi-column on desktop */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: isMobile ? '10px' : '16px'
              }}>
                {[
                  {
                    label: 'Total RI Batches',
                    value: stats.total_ri_batches || 0,
                    icon: Layers
                  },
                  {
                    label: 'Total RI Students',
                    value: stats.total_ri_students || 0,
                    icon: Users
                  },
                  {
                    label: 'Total RI Panels',
                    value: stats.total_ri_panels || 0,
                    icon: Grid
                  },
                  {
                    label: 'LTC Reused Identities',
                    value: stats.ltc_ri_students || 0,
                    icon: UserCheck
                  }
                ].map((card, idx) => {
                  const CardIcon = card.icon;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: isMobile ? '12px' : '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                        padding: isMobile ? '12px 14px' : '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: isMobile ? '86px' : '106px',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                        cursor: 'default'
                      }}
                      onMouseEnter={e => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.06)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isMobile) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.015)';
                        }
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2, gap: '6px' }}>
                        <span style={{
                          fontSize: isMobile ? '11px' : '12.5px',
                          fontWeight: '700',
                          color: '#475569',
                          letterSpacing: '-0.2px',
                          lineHeight: '1.25'
                        }}>
                          {card.label}
                        </span>
                        <div style={{
                          width: isMobile ? '28px' : '32px',
                          height: isMobile ? '28px' : '32px',
                          background: '#ffffff',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px -2px rgba(4,120,87,0.18)',
                          border: '1px solid rgba(4,120,87,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <CardIcon size={isMobile ? 14 : 16} color="#047857" strokeWidth={2.4} />
                        </div>
                      </div>

                      {/* Value */}
                      <div style={{ zIndex: 2, marginTop: isMobile ? '6px' : '8px' }}>
                        <h3 style={{
                          fontSize: isMobile ? '22px' : '28px',
                          fontWeight: '900',
                          color: '#0f172a',
                          margin: 0,
                          letterSpacing: '-0.5px',
                          lineHeight: 1
                        }}>
                          {card.value}
                        </h3>
                      </div>

                      {/* Bottom-right subtle dot overlay */}
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: isMobile ? '60px' : '80px', height: isMobile ? '50px' : '60px', background: 'radial-gradient(circle at bottom right, rgba(5,150,105,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
                        <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(5,150,105,0.16) 1.5px, transparent 1.5px)', backgroundSize: '8px 8px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── RI Schedule Section (Matching RI Student Panel Design) ── */}
              {(() => {
                const dayPlan = DEFAULT_SCHEDULE.find(d => d.day_number === adminScheduleDay) || DEFAULT_SCHEDULE[0];
                const activities = dayPlan?.activities || [];
                return (
                  <div style={{
                    background: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '20px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    padding: '24px',
                    marginBottom: '8px'
                  }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '16px',
                      marginBottom: '16px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #065f46, #059669)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 10px rgba(6,95,70,0.2)'
                        }}>
                          <Calendar size={18} strokeWidth={2.2} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            RI Schedule
                          </h3>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                            Daily agenda, activities, venues &amp; details
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Day Tabs + Activity Count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {DEFAULT_SCHEDULE.map((dObj, idx) => {
                          const d = dObj.day_number || idx + 1;
                          return (
                            <button
                              key={d}
                              onClick={() => setAdminScheduleDay(d)}
                              style={{
                                padding: '8px 20px',
                                borderRadius: '10px',
                                fontSize: '13px',
                                fontWeight: 750,
                                border: '1px solid',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                background: adminScheduleDay === d ? '#154388' : '#ffffff',
                                color: adminScheduleDay === d ? '#ffffff' : '#475569',
                                borderColor: adminScheduleDay === d ? '#154388' : '#e2e8f0',
                                boxShadow: adminScheduleDay === d ? '0 2px 6px rgba(21,67,136,0.15)' : 'none'
                              }}
                            >
                              Day {d}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                        Day {adminScheduleDay} &middot; {activities.length} activities
                      </div>
                    </div>

                    {/* 4-Column Schedule Table */}
                    <div className="lrp-schedule-container" style={{ marginTop: '4px' }}>
                      <div className="lrp-schedule-header">
                        <div>TIME</div>
                        <div>ACTIVITY NAME</div>
                        <div>VENUE &amp; DETAILS</div>
                        <div style={{ textAlign: 'right' }}>CATEGORY</div>
                      </div>
                      {activities.map((activity, idx) => {
                        const styles = getRiCategoryStyles(activity.category, activity.type);
                        return (
                          <div key={idx} className="lrp-schedule-row">
                            <div className="lrp-time-column">
                              <span className="lrp-time-pill">
                                <Clock size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                {activity.time}
                              </span>
                            </div>
                            <div className="lrp-activity-column">
                              <span className="lrp-activity-name">{activity.title}</span>
                              {(activity.description || activity.desc) && (
                                <p className="lrp-activity-description">{activity.description || activity.desc}</p>
                              )}
                            </div>
                            <div className="lrp-venue-dress-column">
                              <div className="lrp-venue-info">
                                <MapPin size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                <span>{activity.location || 'Allocated Immersion Village'}</span>
                              </div>
                              {(activity.dress || activity.notes || activity.instructions) && (
                                <div className="lrp-dress-info">
                                  <Info size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                                  <span>{activity.dress || activity.notes || activity.instructions}</span>
                                </div>
                              )}
                            </div>
                            <div className="lrp-badge-column">
                              <span
                                className="lrp-category-pill"
                                style={{ color: styles.text, background: styles.bg }}
                              >
                                {styles.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: BATCHES PAGE (CLEAN, PROFESSIONAL BATCH CARDS)            */}
          {/* ================================================================ */}
          {(activeTab === 'batches' || activeTab === 'ltc_batches') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '24px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                {/* 4 Navigation & Action Buttons Aligned in One Line */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  gap: isMobile ? '8px' : '10px',
                  borderBottom: '1.5px solid #e2e8f0',
                  paddingBottom: '14px',
                  marginBottom: isMobile ? '16px' : '20px',
                  width: '100%',
                  overflowX: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}>
                  <button
                    onClick={handleOpenCreateBatchModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: isMobile ? '7px 12px' : '8px 16px',
                      backgroundColor: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Plus size={15} />
                    <span>Create RI Batch</span>
                  </button>

                  <button
                    onClick={() => {
                      fetchRiBatches();
                      fetchLtcBatches();
                      fetchDashboardStats();
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: isMobile ? '7px 12px' : '8px 16px',
                      backgroundColor: '#f0fdf4',
                      color: '#047857',
                      border: '1.5px solid #a7f3d0',
                      borderRadius: '8px',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <RefreshCw size={14} className={(isLoadingRiBatches || isLoadingLtcBatches) ? 'animate-spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchViewMode('ri')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: isMobile ? '7px 12px' : '8px 16px',
                      borderRadius: '8px',
                      fontSize: isMobile ? '12.5px' : '13.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: batchViewMode === 'ri' ? '#047857' : '#f1f5f9',
                      color: batchViewMode === 'ri' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Layers size={14} />
                    <span>RI Batches</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      backgroundColor: batchViewMode === 'ri' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: batchViewMode === 'ri' ? '#ffffff' : '#334155',
                      fontWeight: '800'
                    }}>
                      {riBatches.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchViewMode('ltc')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: isMobile ? '7px 12px' : '8px 16px',
                      borderRadius: '8px',
                      fontSize: isMobile ? '12.5px' : '13.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: batchViewMode === 'ltc' ? '#047857' : '#f1f5f9',
                      color: batchViewMode === 'ltc' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Database size={14} />
                    <span>Available LTC Batches</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      backgroundColor: batchViewMode === 'ltc' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: batchViewMode === 'ltc' ? '#ffffff' : '#334155',
                      fontWeight: '800'
                    }}>
                      {ltcBatches.length}
                    </span>
                    {ltcBatches.filter(b => !b.is_synced_to_ri).length > 0 && (
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        backgroundColor: batchViewMode === 'ltc' ? '#fef08a' : '#fef9c3',
                        color: '#854d0e',
                        fontWeight: '800',
                        border: '1px solid #fde047'
                      }}>
                        {ltcBatches.filter(b => !b.is_synced_to_ri).length} Not Synced
                      </span>
                    )}
                  </button>
                </div>

                {/* ==================== VIEW 1: RI BATCHES ==================== */}
                {batchViewMode === 'ri' && (
                  <>
                    {/* Search & Filters */}
                    <div style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      gap: '10px',
                      alignItems: isMobile ? 'stretch' : 'center',
                      marginBottom: isMobile ? '16px' : '24px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        flex: isMobile ? 'none' : '1',
                        width: isMobile ? '100%' : 'auto',
                        minWidth: isMobile ? '100%' : '220px',
                        boxSizing: 'border-box'
                      }}>
                        <Search size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                        <input
                          placeholder="Search batches by name or code..."
                          value={batchSearchQuery}
                          onChange={e => setBatchSearchQuery(e.target.value)}
                          style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#0f172a' }}
                        />
                        {batchSearchQuery && (
                          <button onClick={() => setBatchSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Filter Row: side-by-side on mobile, inline on desktop */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: isMobile ? '100%' : 'auto'
                      }}>
                        {/* Source Filter */}
                        <select
                          value={batchSourceFilter}
                          onChange={e => setBatchSourceFilter(e.target.value)}
                          style={{
                            flex: isMobile ? 1 : 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: isMobile ? 0 : '130px'
                          }}
                        >
                          <option value="all">All Sources</option>
                          <option value="LTC_SYNC">LTC Synced</option>
                          <option value="RI_DIRECT">RI Direct</option>
                        </select>

                        {/* Status Filter */}
                        <select
                          value={batchStatusFilter}
                          onChange={e => setBatchStatusFilter(e.target.value)}
                          style={{
                            flex: isMobile ? 1 : 'none',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: isMobile ? 0 : '130px'
                          }}
                        >
                          <option value="all">All Statuses</option>
                          <option value="active">Active</option>
                          <option value="created">Created</option>
                          <option value="planning">Planning</option>
                          <option value="orientation">Orientation</option>
                          <option value="immersion">Immersion</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      <div style={{
                        fontSize: '11.5px',
                        color: '#64748b',
                        fontWeight: '600',
                        marginLeft: isMobile ? '0' : 'auto',
                        textAlign: isMobile ? 'right' : 'left'
                      }}>
                        Showing {filteredRiBatches.length} of {riBatches.length} {riBatches.length === 1 ? 'batch' : 'batches'}
                      </div>
                    </div>

                {/* Batch Cards Grid */}
                {isLoadingRiBatches ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #bbf7d0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Loading RI batches...</div>
                  </div>
                ) : filteredRiBatches.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                      <Layers size={24} />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', margin: '0 0 4px 0' }}>No batches found</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      {batchSearchQuery || batchSourceFilter !== 'all' || batchStatusFilter !== 'all'
                        ? 'Try adjusting your search query or filter options.'
                        : 'No Rural Immersion batches are currently available.'}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}>
                    {filteredRiBatches.map(b => {
                      const st = getBatchStatusBadge(b.status);
                      const isLtc = Boolean(b.source_batch_id || b.source_program === 'LTC' || b.source_program === 'LTC_SYNC');
                      return (
                        <div
                          key={b.id}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.03)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Top solid accent bar */}
                          <div style={{
                            height: '3px',
                            backgroundColor: isLtc ? '#047857' : '#1d4ed8'
                          }} />

                          <div style={{
                            padding: isMobile ? '14px 16px' : '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? '12px' : '16px',
                            flex: 1,
                            justifyContent: 'space-between'
                          }}>
                            {/* Card Top: Title + Badges */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <h3 style={{
                                    fontSize: isMobile ? '15.5px' : '16.5px',
                                    fontWeight: '800',
                                    color: '#0f172a',
                                    margin: '0 0 4px 0',
                                    letterSpacing: '-0.3px',
                                    lineHeight: 1.3
                                  }}>
                                    {b.name}
                                  </h3>
                                  {b.batch_code && (
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', display: 'inline-block' }}>
                                      {b.batch_code}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: '700',
                                    backgroundColor: isLtc ? '#eff6ff' : '#f0fdf4',
                                    color: isLtc ? '#1d4ed8' : '#047857',
                                    border: `1px solid ${isLtc ? '#bfdbfe' : '#a7f3d0'}`,
                                    padding: '2px 7px', borderRadius: '6px'
                                  }}>
                                    {isLtc ? 'LTC Synced' : 'RI Direct'}
                                  </span>
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: '700',
                                    backgroundColor: st.bg, color: st.text,
                                    border: `1px solid ${st.border}`,
                                    padding: '2px 7px', borderRadius: '6px'
                                  }}>
                                    {st.label}
                                  </span>
                                </div>
                              </div>

                              {/* Date */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                                <Calendar size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                <span>{formatDateRange(b.start_date, b.end_date)}</span>
                              </div>

                              {b.description && (
                                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '8px 0 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  {b.description}
                                </p>
                              )}
                            </div>

                            {/* Metrics Grid — Solid, responsive 2 cols on small screens, 4 on larger */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { label: 'Students', value: b.total_students || 0, icon: Users },
                                { label: 'Panels', value: b.total_panels || 0, icon: Grid },
                                { label: 'Villages', value: b.total_villages || 0, icon: MapPin },
                                { label: 'Faculty', value: b.total_faculty || 0, icon: UserCheck }
                              ].map((m, mi) => {
                                const MIcon = m.icon;
                                return (
                                  <div key={mi} style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '10px 6px',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', color: '#64748b' }}>
                                      <MIcon size={12} />
                                      <span style={{ fontSize: '10.5px', fontWeight: '600' }}>{m.label}</span>
                                    </div>
                                    <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                                      {m.value}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Action Buttons — Responsive 2-tier layout */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
                              {/* Row 1: Primary Open Workspace Action + Edit/Delete */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openBatchWorkspace(b.id, 'panels', b)}
                                  style={{
                                    flex: 1,
                                    background: '#047857',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '9px 14px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'background-color 0.15s ease',
                                    boxShadow: '0 1px 3px rgba(4,120,87,0.2)'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                                >
                                  <span>{isLtc ? 'Open Batch Workspace' : 'Open Workspace'}</span>
                                  <ArrowRight size={14} />
                                </button>

                                {!isLtc && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setEditBatchModal({
                                        batch: b,
                                        name: b.name || '',
                                        start_date: b.start_date ? b.start_date.split('T')[0] : '',
                                        end_date: b.end_date ? b.end_date.split('T')[0] : '',
                                        description: b.description || '',
                                        status: b.status || 'active',
                                        panel_capacity: b.panel_capacity || 60
                                      })}
                                      title="Edit RI Direct Batch"
                                      style={{
                                        padding: '9px 10px',
                                        backgroundColor: '#f8fafc',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteBatchModal({ batch: b })}
                                      title="Delete RI Direct Batch"
                                      style={{
                                        padding: '9px 10px',
                                        backgroundColor: '#fef2f2',
                                        color: '#dc2626',
                                        border: '1px solid #fecaca',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Row 2: Secondary Quick Actions Grid (2x2) */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBatchWorkspace(b.id, 'students', b);
                                  }}
                                  title="View Batch Students"
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#f8fafc',
                                    color: '#1e293b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                  <Users size={13} color="#047857" />
                                  <span>Students</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBatchWorkspace(b.id, 'nodal_officers', b);
                                  }}
                                  title="View Department Coordinators / Nodal Officers"
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#f8fafc',
                                    color: '#1e293b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ecfdf5'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                  <UserCheck size={13} color="#059669" />
                                  <span>Nodal Officers</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVillageFacultyTargetBatch(b);
                                    setVillageFacultyFile(null);
                                    setVillageFacultyValidation(null);
                                    setVillageFacultyImportResult(null);
                                    setVillageFacultyError('');
                                    setVillageFacultyModalOpen(true);
                                  }}
                                  title="Upload Village & Faculty Allocations"
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#f8fafc',
                                    color: '#1e293b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                  <Upload size={13} color="#475569" />
                                  <span>Upload Data</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBatchAttendanceModal(b);
                                  }}
                                  title="Download Batch Attendance Report"
                                  style={{
                                    padding: '8px 10px',
                                    backgroundColor: '#f8fafc',
                                    color: '#1e293b',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                  <ClipboardCheck size={13} color="#2563eb" />
                                  <span>Attendance</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ==================== VIEW 2: AVAILABLE LTC BATCHES ==================== */}
            {batchViewMode === 'ltc' && (
              <>
                {/* Search & LTC Filters */}
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: '10px',
                  alignItems: isMobile ? 'stretch' : 'center',
                  marginBottom: isMobile ? '16px' : '24px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    flex: isMobile ? 'none' : '1',
                    width: isMobile ? '100%' : 'auto',
                    minWidth: isMobile ? '100%' : '220px',
                    boxSizing: 'border-box'
                  }}>
                    <Search size={15} style={{ color: '#64748b', flexShrink: 0 }} />
                    <input
                      placeholder="Search LTC batches by name or code..."
                      value={batchSearchQuery}
                      onChange={e => setBatchSearchQuery(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#0f172a' }}
                    />
                    {batchSearchQuery && (
                      <button onClick={() => setBatchSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Sync Status Filter */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: isMobile ? '100%' : 'auto'
                  }}>
                    <select
                      value={ltcSyncFilter}
                      onChange={e => setLtcSyncFilter(e.target.value)}
                      style={{
                        flex: isMobile ? 1 : 'none',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#0f172a',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer',
                        minWidth: isMobile ? 0 : '160px'
                      }}
                    >
                      <option value="all">All Sync Statuses</option>
                      <option value="unsynced">Not Synced ({ltcBatches.filter(b => !b.is_synced_to_ri).length})</option>
                      <option value="synced">Synced to RI ({ltcBatches.filter(b => b.is_synced_to_ri).length})</option>
                    </select>
                  </div>

                  <div style={{
                    fontSize: '11.5px',
                    color: '#64748b',
                    fontWeight: '600',
                    marginLeft: isMobile ? '0' : 'auto',
                    textAlign: isMobile ? 'right' : 'left'
                  }}>
                    Showing {filteredLtcBatches.length} of {ltcBatches.length} {ltcBatches.length === 1 ? 'LTC batch' : 'LTC batches'}
                  </div>
                </div>

                {/* LTC Batch Cards Grid */}
                {isLoadingLtcBatches ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #bbf7d0', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>Loading available LTC batches...</div>
                  </div>
                ) : filteredLtcBatches.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                      <Database size={24} />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', margin: '0 0 4px 0' }}>No LTC batches found</h3>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      {batchSearchQuery || ltcSyncFilter !== 'all'
                        ? 'Try adjusting your search query or sync filter options.'
                        : 'No LTC batches are currently available in the database.'}
                    </p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}>
                    {filteredLtcBatches.map(b => {
                      const isSynced = Boolean(b.is_synced_to_ri);
                      const isCurrentlySyncing = syncingLtcBatchId === b.id;
                      return (
                        <div
                          key={b.id}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: isSynced ? '1px solid #e2e8f0' : '1.5px solid #fed7aa',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSynced ? '0 2px 6px rgba(0,0,0,0.03)' : '0 2px 8px rgba(249,115,22,0.05)',
                            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = isSynced ? '#cbd5e1' : '#f97316';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = isSynced ? '#e2e8f0' : '#fed7aa';
                            e.currentTarget.style.boxShadow = isSynced ? '0 2px 6px rgba(0,0,0,0.03)' : '0 2px 8px rgba(249,115,22,0.05)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Top solid accent bar */}
                          <div style={{
                            height: '3px',
                            backgroundColor: isSynced ? '#047857' : '#f59e0b'
                          }} />

                          <div style={{
                            padding: isMobile ? '14px 16px' : '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? '12px' : '16px',
                            flex: 1,
                            justifyContent: 'space-between'
                          }}>
                            {/* Card Top: Title + Badges */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <h3 style={{
                                    fontSize: isMobile ? '15.5px' : '16.5px',
                                    fontWeight: '800',
                                    color: '#0f172a',
                                    margin: '0 0 4px 0',
                                    letterSpacing: '-0.3px',
                                    lineHeight: 1.3
                                  }}>
                                    {b.name}
                                  </h3>
                                  {b.batch_code && (
                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', display: 'inline-block' }}>
                                      {b.batch_code}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                  <span style={{
                                    fontSize: '10.5px', fontWeight: '700',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    padding: '2px 7px', borderRadius: '6px'
                                  }}>
                                    LTC Master
                                  </span>
                                  {isSynced ? (
                                    <span style={{
                                      fontSize: '10.5px', fontWeight: '700',
                                      backgroundColor: '#ecfdf5', color: '#047857',
                                      border: '1px solid #a7f3d0',
                                      padding: '2px 7px', borderRadius: '6px',
                                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}>
                                      <CheckCircle2 size={12} />
                                      <span>Synced to RI</span>
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '10.5px', fontWeight: '700',
                                      backgroundColor: '#fefce8', color: '#854d0e',
                                      border: '1px solid #fef08a',
                                      padding: '2px 7px', borderRadius: '6px',
                                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}>
                                      <Clock size={12} />
                                      <span>Not Synced</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Date */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                                <Calendar size={13} style={{ color: '#047857', flexShrink: 0 }} />
                                <span>{formatDateRange(b.start_date, b.end_date)}</span>
                              </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { label: 'LTC Students', value: b.ltc_student_count || 0, icon: Users },
                                { label: 'LTC Status', value: (b.status || 'Active').toUpperCase(), icon: Award },
                                { label: 'RI Panels', value: isSynced ? (b.ri_panel_count || 0) : '—', icon: Grid },
                                { label: 'RI Students', value: isSynced ? (b.ri_student_count || 0) : '—', icon: UserCheck }
                              ].map((m, mi) => {
                                const MIcon = m.icon;
                                return (
                                  <div key={mi} style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    padding: '10px 6px',
                                    textAlign: 'center',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', color: '#64748b' }}>
                                      <MIcon size={12} />
                                      <span style={{ fontSize: '10.5px', fontWeight: '600' }}>{m.label}</span>
                                    </div>
                                    <div style={{ fontSize: typeof m.value === 'string' && m.value.length > 6 ? '12px' : '17px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                                      {m.value}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Action Button */}
                            <div style={{ marginTop: '4px' }}>
                              {!isSynced ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmSyncModal({ batch: b })}
                                  disabled={isCurrentlySyncing}
                                  style={{
                                    width: '100%',
                                    background: '#047857',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: isCurrentlySyncing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '7px',
                                    boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)',
                                    transition: 'all 0.15s ease',
                                    opacity: isCurrentlySyncing ? 0.75 : 1
                                  }}
                                  onMouseEnter={e => { if (!isCurrentlySyncing) e.currentTarget.style.backgroundColor = '#065f46'; }}
                                  onMouseLeave={e => { if (!isCurrentlySyncing) e.currentTarget.style.backgroundColor = '#047857'; }}
                                >
                                  {isCurrentlySyncing ? (
                                    <>
                                      <Loader2 size={15} className="animate-spin" />
                                      <span>Synchronizing to RI...</span>
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw size={15} />
                                      <span>Sync to RI</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    onClick={() => openBatchWorkspace(b.ri_batch_id || b.id, 'panels', b)}
                                    style={{
                                      flex: 1,
                                      background: '#047857',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '9px 14px',
                                      borderRadius: '8px',
                                      fontSize: '13px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 3px rgba(4,120,87,0.2)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                                  >
                                    <span>Open Workspace</span>
                                    <ArrowRight size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmSyncModal({ batch: b, isResync: true })}
                                    disabled={isCurrentlySyncing}
                                    title="Re-sync latest LTC data to RI"
                                    style={{
                                      padding: '9px 12px',
                                      backgroundColor: '#f8fafc',
                                      color: '#475569',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '8px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: isCurrentlySyncing ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <RefreshCw size={13} className={isCurrentlySyncing ? 'animate-spin' : ''} />
                                    <span>Re-sync</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}


          {/* ================================================================ */}
          {/* TAB 3: UNIFIED BATCH DETAIL WORKSPACE                            */}
          {/* ================================================================ */}
          {activeTab === 'batch_detail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
              {/* Batch Overview Header Card */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: isMobile ? '12px' : '10px',
                padding: isMobile ? '14px 16px' : '20px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                {/* Back to Batches button */}
                <button
                  onClick={() => setActiveTab('batches')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'transparent',
                    color: '#15803d',
                    border: 'none',
                    padding: '0',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Batches</span>
                </button>

                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '12px' : '16px',
                  marginBottom: '14px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                        {currentBatch?.name || (isLoadingBatchDetails ? 'Loading Batch...' : (selectedRiBatchId ? `Batch #${selectedRiBatchId}` : 'Batch Workspace'))}
                      </h2>
                      {currentBatch?.batch_code && (
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', display: 'inline-block' }}>
                          {currentBatch.batch_code}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px' }}>
                        Source: {currentBatch?.source_program === 'LTC_SYNC' ? 'LTC Synced' : currentBatch?.source_program === 'RI_DIRECT' ? 'RI Direct' : (currentBatch?.source_program || 'RI')}
                      </span>
                    </div>
                    <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                      Manage panels, villages, faculty and students for this batch.
                    </p>
                  </div>

                  {/* Batch Switcher & Action Buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                    width: isMobile ? '100%' : 'auto'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: isMobile ? '1 1 0' : 'none'
                    }}>
                      <label style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>Batch:</label>
                      <select
                        value={selectedRiBatchId ? String(selectedRiBatchId) : ''}
                        onChange={e => {
                          const val = e.target.value;
                          const targetBatch = riBatches.find(b => String(b.id) === String(val) || (b.source_batch_id && String(b.source_batch_id) === String(val)));
                          openBatchWorkspace(targetBatch ? targetBatch.id : val, batchSubTab, targetBatch);
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          outline: 'none',
                          cursor: 'pointer',
                          flex: isMobile ? 1 : 'none',
                          width: isMobile ? '100%' : 'auto'
                        }}
                      >
                        {!selectedRiBatchId && <option value="">Select a Batch</option>}
                        {riBatches.map(b => (
                          <option key={b.id} value={String(b.id)}>
                            {b.name}{b.batch_code ? ` (${b.batch_code})` : ''}
                          </option>
                        ))}
                        {currentBatch && !riBatches.some(b => String(b.id) === String(currentBatch.id)) && (
                          <option key={currentBatch.id} value={String(currentBatch.id)}>
                            {currentBatch.name}{currentBatch.batch_code ? ` (${currentBatch.batch_code})` : ''}
                          </option>
                        )}
                      </select>
                    </div>

                    {currentBatch && (
                      <button
                        type="button"
                        onClick={() => openBatchAttendanceModal(currentBatch)}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                        title="Download Attendance for this Batch"
                      >
                        <ClipboardCheck size={14} />
                        <span>Attendance</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Minimal Summary Row (Formatted chips on mobile) */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '14px',
                  padding: '10px 0 14px 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: isMobile ? '12px' : '13px',
                  color: '#475569'
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '4px 8px' : '0',
                    backgroundColor: isMobile ? '#f8fafc' : 'transparent',
                    border: isMobile ? '1px solid #e2e8f0' : 'none',
                    borderRadius: '6px'
                  }}>
                    <strong style={{ color: '#0f172a' }}>{totalBatchStudents}</strong> Students
                  </span>
                  {!isMobile && <span style={{ color: '#cbd5e1' }}>•</span>}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '4px 8px' : '0',
                    backgroundColor: isMobile ? '#f8fafc' : 'transparent',
                    border: isMobile ? '1px solid #e2e8f0' : 'none',
                    borderRadius: '6px'
                  }}>
                    <strong style={{ color: '#0f172a' }}>{totalPanelsCount}</strong> Panels
                  </span>
                  {!isMobile && <span style={{ color: '#cbd5e1' }}>•</span>}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '4px 8px' : '0',
                    backgroundColor: isMobile ? '#f8fafc' : 'transparent',
                    border: isMobile ? '1px solid #e2e8f0' : 'none',
                    borderRadius: '6px'
                  }}>
                    <strong style={{ color: '#0f172a' }}>{villagesCreatedCount}</strong> Villages
                  </span>
                  {!isMobile && <span style={{ color: '#cbd5e1' }}>•</span>}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '4px 8px' : '0',
                    backgroundColor: isMobile ? '#f0fdf4' : 'transparent',
                    border: isMobile ? '1px solid #bbf7d0' : 'none',
                    borderRadius: '6px'
                  }}>
                    <span style={{ color: '#15803d', fontWeight: '700' }}>{allocatedPanelsCount}</span> Allocated
                  </span>
                  {!isMobile && <span style={{ color: '#cbd5e1' }}>•</span>}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isMobile ? '4px 8px' : '0',
                    backgroundColor: isMobile ? (unallocatedPanelsCount > 0 ? '#fffbeb' : '#f8fafc') : 'transparent',
                    border: isMobile ? (unallocatedPanelsCount > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0') : 'none',
                    borderRadius: '6px'
                  }}>
                    <span style={{ color: unallocatedPanelsCount > 0 ? '#b45309' : '#64748b', fontWeight: '700' }}>{unallocatedPanelsCount}</span> Unallocated
                  </span>
                </div>

                {/* Sub-Navigation Buttons inside Batch Workspace (Smooth scrollable pills on mobile) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflowX: 'auto',
                  marginTop: '14px',
                  flexWrap: isMobile ? 'nowrap' : 'wrap',
                  paddingBottom: isMobile ? '4px' : '0',
                  WebkitOverflowScrolling: 'touch',
                  msOverflowStyle: 'none',
                  scrollbarWidth: 'none'
                }}>
                  <button
                    onClick={() => setBatchSubTab('panels')}
                    style={{
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      fontSize: '13px',
                      fontWeight: batchSubTab === 'panels' ? '700' : '600',
                      color: batchSubTab === 'panels' ? '#ffffff' : '#475569',
                      backgroundColor: batchSubTab === 'panels' ? '#059669' : '#f8fafc',
                      border: batchSubTab === 'panels' ? '1px solid #047857' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: batchSubTab === 'panels' ? '0 2px 4px rgba(5,150,105,0.25)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => {
                      if (batchSubTab !== 'panels') {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={e => {
                      if (batchSubTab !== 'panels') {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <Grid size={15} color={batchSubTab === 'panels' ? '#ffffff' : '#64748b'} />
                    <span>Panels &amp; Village Allocation</span>
                  </button>

                  <button
                    onClick={() => setBatchSubTab('villages')}
                    style={{
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      fontSize: '13px',
                      fontWeight: batchSubTab === 'villages' ? '700' : '600',
                      color: batchSubTab === 'villages' ? '#ffffff' : '#475569',
                      backgroundColor: batchSubTab === 'villages' ? '#059669' : '#f8fafc',
                      border: batchSubTab === 'villages' ? '1px solid #047857' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: batchSubTab === 'villages' ? '0 2px 4px rgba(5,150,105,0.25)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => {
                      if (batchSubTab !== 'villages') {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={e => {
                      if (batchSubTab !== 'villages') {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <MapPin size={15} color={batchSubTab === 'villages' ? '#ffffff' : '#64748b'} />
                    <span>Batch Villages</span>
                  </button>

                  <button
                    onClick={() => setBatchSubTab('faculty')}
                    style={{
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      fontSize: '13px',
                      fontWeight: batchSubTab === 'faculty' ? '700' : '600',
                      color: batchSubTab === 'faculty' ? '#ffffff' : '#475569',
                      backgroundColor: batchSubTab === 'faculty' ? '#059669' : '#f8fafc',
                      border: batchSubTab === 'faculty' ? '1px solid #047857' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: batchSubTab === 'faculty' ? '0 2px 4px rgba(5,150,105,0.25)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => {
                      if (batchSubTab !== 'faculty') {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={e => {
                      if (batchSubTab !== 'faculty') {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <Briefcase size={15} color={batchSubTab === 'faculty' ? '#ffffff' : '#64748b'} />
                    <span>Faculty &amp; Mentors</span>
                  </button>

                  <button
                    onClick={() => setBatchSubTab('students')}
                    style={{
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      fontSize: '13px',
                      fontWeight: batchSubTab === 'students' ? '700' : '600',
                      color: batchSubTab === 'students' ? '#ffffff' : '#475569',
                      backgroundColor: batchSubTab === 'students' ? '#059669' : '#f8fafc',
                      border: batchSubTab === 'students' ? '1px solid #047857' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: batchSubTab === 'students' ? '0 2px 4px rgba(5,150,105,0.25)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => {
                      if (batchSubTab !== 'students') {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={e => {
                      if (batchSubTab !== 'students') {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <Users size={15} color={batchSubTab === 'students' ? '#ffffff' : '#64748b'} />
                    <span>Batch Students</span>
                  </button>

                  <button
                    onClick={() => {
                      setBatchSubTab('nodal_officers');
                      fetchBatchNodalOfficers(selectedRiBatchId);
                    }}
                    style={{
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      fontSize: '13px',
                      fontWeight: batchSubTab === 'nodal_officers' ? '700' : '600',
                      color: batchSubTab === 'nodal_officers' ? '#ffffff' : '#475569',
                      backgroundColor: batchSubTab === 'nodal_officers' ? '#059669' : '#f8fafc',
                      border: batchSubTab === 'nodal_officers' ? '1px solid #047857' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: batchSubTab === 'nodal_officers' ? '0 2px 4px rgba(5,150,105,0.25)' : 'none',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => {
                      if (batchSubTab !== 'nodal_officers') {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }
                    }}
                    onMouseLeave={e => {
                      if (batchSubTab !== 'nodal_officers') {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                  >
                    <UserCheck size={15} color={batchSubTab === 'nodal_officers' ? '#ffffff' : '#64748b'} />
                    <span>Nodal Officers</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const targetB = currentBatch || { id: selectedRiBatchId, name: 'Current Batch' };
                      setVillageFacultyTargetBatch(targetB);
                      setVillageFacultyFile(null);
                      setVillageFacultyValidation(null);
                      setVillageFacultyImportResult(null);
                      setVillageFacultyError('');
                      setVillageFacultyModalOpen(true);
                    }}
                    style={{
                      marginLeft: isMobile ? '0' : 'auto',
                      padding: '8px 16px',
                      minHeight: '38px',
                      flexShrink: 0,
                      backgroundColor: '#047857',
                      color: '#ffffff',
                      border: '1px solid #065f46',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 4px rgba(4,120,87,0.25)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
                  >
                    <Upload size={14} style={{ color: '#ffffff' }} />
                    <span>Village &amp; Faculty Upload</span>
                  </button>
                </div>
              </div>

              {/* ── SUBSECTION 1: PANELS & ALLOCATION ── */}
              {batchSubTab === 'panels' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: isMobile ? '16px 14px' : '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ position: 'relative', maxWidth: isMobile ? '100%' : '320px', width: '100%' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search panel or village name..."
                        value={panelSearchQuery}
                        onChange={e => setPanelSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto',
                      flexWrap: isMobile ? 'wrap' : 'nowrap'
                    }}>
                      <button
                        onClick={() => {
                          setFacultyUploadMode('batch_wise');
                          setFacultyUploadPanelId('');
                          setUploadFile(null);
                          setValidationResult(null);
                          setFacultyUploadModal(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          minHeight: '38px',
                          backgroundColor: '#15803d',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Upload size={14} />
                        <span>Bulk Upload Faculty</span>
                      </button>

                      <button
                        onClick={() => {
                          setVillageForm({
                            name: '',
                            location: '',
                            sarpanch_name: '',
                            sarpanch_mobile: '',
                            panchayat: '',
                            district: '',
                            emergency_contact: '',
                            notes: ''
                          });
                          setVillageModal({ mode: 'create', village: null });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          minHeight: '38px',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Plus size={15} />
                        <span>Add Village</span>
                      </button>
                    </div>
                  </div>

                  {isLoadingBatchDetails ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading panels...</div>
                  ) : selectedBatchDetails?.panels?.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No panels found for this batch.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569' }}>Panel</th>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569' }}>Students</th>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', minWidth: '220px' }}>Assigned Mentors</th>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', minWidth: '220px' }}>Village Allocation</th>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569' }}>Allocation Status</th>
                            <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', textAlign: 'right', minWidth: '220px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBatchDetails?.panels
                            ?.filter(p => {
                              if (!panelSearchQuery.trim()) return true;
                              const q = panelSearchQuery.toLowerCase();
                              return (
                                (p.name || '').toLowerCase().includes(q) ||
                                (p.village_name || '').toLowerCase().includes(q)
                              );
                            })
                            .map(p => {
                              const isAllocated = Boolean(p.ri_village_id);
                              const panelMentors = (p.assigned_faculty && p.assigned_faculty.length > 0)
                                ? p.assigned_faculty
                                : batchFaculty.filter(f => f.ri_panel_id === p.id);
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s' }}>
                                  {/* Panel Name */}
                                  <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{cleanPanelName(p.name)}</span>
                                    </div>
                                  </td>

                                  {/* Students Count */}
                                  <td style={{ padding: '14px 16px' }}>
                                    <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                                      {p.student_count || 0} Students
                                    </span>
                                  </td>

                                  {/* Assigned Mentors */}
                                  <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {panelMentors.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                          {panelMentors.map(m => (
                                            <span
                                              key={m.id}
                                              style={{
                                                fontSize: '12px',
                                                fontWeight: '500',
                                                backgroundColor: '#f1f5f9',
                                                color: '#334155',
                                                border: '1px solid #e2e8f0',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px'
                                              }}
                                              title={`${m.name} (${m.email})`}
                                            >
                                              <User size={11} color="#64748b" />
                                              <span>{m.name}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No mentors</span>
                                          <button
                                            onClick={() => {
                                              setFacultyUploadMode('panel_wise');
                                              setFacultyUploadPanelId(String(p.id));
                                              setUploadFile(null);
                                              setValidationResult(null);
                                              setFacultyUploadModal(true);
                                            }}
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '600',
                                              color: '#475569',
                                              backgroundColor: '#ffffff',
                                              border: '1px solid #cbd5e1',
                                              borderRadius: '6px',
                                              padding: '3px 8px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            + Upload
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Village Dropdown */}
                                  <td style={{ padding: '14px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <select
                                        value={p.ri_village_id || ''}
                                        disabled={savingPanelId === p.id}
                                        onChange={e => handleAssignPanelVillage(p.id, e.target.value)}
                                        style={{
                                          padding: '7px 12px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: '#ffffff',
                                          color: p.ri_village_id ? '#0f172a' : '#64748b',
                                          fontSize: '13px',
                                          fontWeight: '500',
                                          outline: 'none',
                                          cursor: 'pointer',
                                          minWidth: '200px',
                                          width: '100%'
                                        }}
                                      >
                                        <option value="">-- Select Village --</option>
                                        {villages.map(v => (
                                          <option key={v.id} value={v.id}>
                                            {v.name}{v.district ? ` (${v.district})` : ''}
                                          </option>
                                        ))}
                                      </select>
                                      {savingPanelId === p.id && (
                                        <RefreshCw size={14} className="animate-spin text-slate-500" />
                                      )}
                                    </div>
                                  </td>

                                  {/* Allocation Status Badge */}
                                  <td style={{ padding: '14px 16px' }}>
                                    {isAllocated ? (
                                      <span
                                        style={{
                                          backgroundColor: '#f1f5f9',
                                          color: '#0f172a',
                                          border: '1px solid #e2e8f0',
                                          padding: '4px 10px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px'
                                        }}
                                      >
                                        <CheckCircle size={13} color="#475569" />
                                        <span>Assigned: {p.village_name}</span>
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          backgroundColor: '#f8fafc',
                                          color: '#94a3b8',
                                          border: '1px dashed #cbd5e1',
                                          padding: '4px 10px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '500',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px'
                                        }}
                                      >
                                        <AlertCircle size={13} color="#94a3b8" />
                                        <span>Not Assigned</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Action */}
                                  <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedPanel(p);
                                          setSelectedPanelInfo(p);
                                          setPanelModalTab('students');
                                          setPanelStudentSearch('');
                                          fetchPanelStudents(p.id, 1, '');
                                          fetchPanelMedia(p.id);
                                        }}
                                        style={{
                                          backgroundColor: '#ffffff',
                                          color: '#334155',
                                          border: '1px solid #cbd5e1',
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          transition: 'all 0.15s ease',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.backgroundColor = '#f8fafc';
                                          e.currentTarget.style.borderColor = '#94a3b8';
                                          e.currentTarget.style.color = '#0f172a';
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.backgroundColor = '#ffffff';
                                          e.currentTarget.style.borderColor = '#cbd5e1';
                                          e.currentTarget.style.color = '#334155';
                                        }}
                                      >
                                        <Eye size={14} color="#64748b" />
                                        <span>View Students</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setDeletePanelModal({ panel: p, isDeleting: false, error: null })}
                                        style={{
                                          backgroundColor: '#ffffff',
                                          color: '#dc2626',
                                          border: '1px solid #fecdd3',
                                          padding: '6px 12px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          transition: 'all 0.15s ease',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.backgroundColor = '#fef2f2';
                                          e.currentTarget.style.borderColor = '#fca5a5';
                                          e.currentTarget.style.color = '#b91c1c';
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.backgroundColor = '#ffffff';
                                          e.currentTarget.style.borderColor = '#fecdd3';
                                          e.currentTarget.style.color = '#dc2626';
                                        }}
                                        title={`Delete panel ${cleanPanelName(p.name)}`}
                                      >
                                        <Trash2 size={13} color="#dc2626" />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBSECTION 2: VILLAGES MANAGEMENT ── */}
              {batchSubTab === 'villages' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: isMobile ? '16px 14px' : '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ position: 'relative', maxWidth: isMobile ? '100%' : '320px', width: '100%' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search village, sarpanch, district..."
                        value={villageSearch}
                        onChange={e => setVillageSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setVillageForm({
                          name: '',
                          location: '',
                          sarpanch_name: '',
                          sarpanch_mobile: '',
                          panchayat: '',
                          district: '',
                          emergency_contact: '',
                          notes: ''
                        });
                        setVillageModal({ mode: 'create', village: null });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        minHeight: '38px',
                        backgroundColor: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(22,101,52,0.2)',
                        width: isMobile ? '100%' : 'auto',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={16} />
                      <span>Add Village</span>
                    </button>
                  </div>

                  {isLoadingVillages ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading villages...</div>
                  ) : villages.length === 0 ? (
                    <div style={{ padding: '50px 20px', textAlign: 'center', border: '1.5px dashed #cbd5e1', borderRadius: '10px', backgroundColor: '#f8fafc' }}>
                      <MapPin size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                      <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#334155', margin: '0 0 6px 0' }}>No Villages Created For This Batch Yet</h4>
                      <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                        Create villages for {currentBatch?.name || 'this batch'}. Once added, you can allocate panels to them in the Panels tab.
                      </p>
                      <button
                        onClick={() => {
                          setVillageForm({
                            name: '',
                            location: '',
                            sarpanch_name: '',
                            sarpanch_mobile: '',
                            panchayat: '',
                            district: '',
                            emergency_contact: '',
                            notes: ''
                          });
                          setVillageModal({ mode: 'create', village: null });
                        }}
                        style={{
                          padding: '8px 18px',
                          backgroundColor: '#15803d',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        + Create First Village
                      </button>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Village Name</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>District / Panchayat</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Sarpanch Details</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Emergency Contact</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Assigned Panels</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {villages
                            .filter(v => {
                              if (!villageSearch.trim()) return true;
                              const q = villageSearch.toLowerCase();
                              return (
                                (v.name || '').toLowerCase().includes(q) ||
                                (v.district || '').toLowerCase().includes(q) ||
                                (v.sarpanch_name || '').toLowerCase().includes(q) ||
                                (v.panchayat || '').toLowerCase().includes(q)
                              );
                            })
                            .map(v => (
                              <tr key={v.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ fontWeight: '700', color: '#14532d', fontSize: '14px' }}>{v.name}</div>
                                  {v.location && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{v.location}</div>}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#334155' }}>
                                  <div>{v.district || '—'}</div>
                                  {v.panchayat && <div style={{ fontSize: '11px', color: '#64748b' }}>Panchayat: {v.panchayat}</div>}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#334155' }}>
                                  <div style={{ fontWeight: '600' }}>{v.sarpanch_name || '—'}</div>
                                  {v.sarpanch_mobile && (
                                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>
                                      📞 {v.sarpanch_mobile}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#64748b' }}>
                                  {v.emergency_contact || '—'}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  {(() => {
                                    const rawList = Array.isArray(v.assigned_panels) ? v.assigned_panels : [];
                                    const uniqueAssigned = Array.from(
                                      new Map(rawList.filter(ap => ap && ap.id).map(ap => [ap.id, ap])).values()
                                    );
                                    if (uniqueAssigned.length === 0) {
                                      return <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>None</span>;
                                    }
                                    return (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {uniqueAssigned.map(ap => (
                                          <span
                                            key={ap.id}
                                            style={{
                                              backgroundColor: '#f1f5f9',
                                              color: '#334155',
                                              padding: '4px 9px',
                                              borderRadius: '6px',
                                              fontSize: '12px',
                                              fontWeight: '600',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '5px',
                                              border: 'none'
                                            }}
                                          >
                                            <span style={{ color: '#0f172a', fontWeight: '600' }}>{cleanPanelName(ap.name)}</span>
                                            {ap.student_count != null && (
                                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>({ap.student_count} studs)</span>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      onClick={() => setVillageModal({ mode: 'view', village: v })}
                                      title="View Details"
                                      style={{
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: '#ffffff',
                                        color: '#475569',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Eye size={14} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setVillageForm({
                                          name: v.name || '',
                                          location: v.location || '',
                                          sarpanch_name: v.sarpanch_name || '',
                                          sarpanch_mobile: v.sarpanch_mobile || '',
                                          panchayat: v.panchayat || '',
                                          district: v.district || '',
                                          emergency_contact: v.emergency_contact || '',
                                          notes: v.notes || ''
                                        });
                                        setVillageModal({ mode: 'edit', village: v });
                                      }}
                                      title="Edit Village"
                                      style={{
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #bbf7d0',
                                        backgroundColor: '#f0fdf4',
                                        color: '#15803d',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteVillage(v, false)}
                                      title="Delete Village"
                                      style={{
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #fee2e2',
                                        backgroundColor: '#fef2f2',
                                        color: '#dc2626',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBSECTION 3: FACULTY & MENTORS DIRECTORY ── */}
              {batchSubTab === 'faculty' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: isMobile ? '16px 14px' : '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '14px' : '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                        {currentBatch?.name || 'Batch'} — Faculty &amp; Mentors
                      </h3>
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
                        Manage faculty and mentors assigned to panels.
                      </p>
                      <p style={{ fontSize: '12.5px', color: '#334155', margin: '4px 0 0 0', fontWeight: '500' }}>
                        {batchFaculty.length} assigned mentors across {totalPanelsCount} panels
                      </p>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto'
                    }}>
                      <button
                        onClick={() => {
                          setFacultyUploadMode('batch_wise');
                          setFacultyUploadPanelId('');
                          setUploadFile(null);
                          setValidationResult(null);
                          setFacultyUploadModal(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          minHeight: '38px',
                          backgroundColor: '#15803d',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Upload size={14} />
                        <span>Bulk Upload</span>
                      </button>

                      <button
                        onClick={() => {
                          setFacultyForm({
                            name: '',
                            email: '',
                            mobile: '',
                            department: '',
                            designation: '',
                            employee_id: '',
                            role: 'Mentor',
                            ri_panel_id: batchFacultyPanelFilter || selectedBatchDetails?.panels?.[0]?.id || ''
                          });
                          setFacultyModal({ mode: 'create', faculty: null });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          minHeight: '38px',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flex: isMobile ? '1 1 calc(50% - 4px)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <UserPlus size={14} />
                        <span>Add Mentor</span>
                      </button>

                      <button
                        onClick={() => exportFacultyToCSV(batchFaculty, `${currentBatch?.name || 'batch'}_faculty.csv`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          minHeight: '38px',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          width: isMobile ? '100%' : 'auto',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Download size={14} />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '10px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search mentor name, email, department..."
                        value={batchFacultySearch}
                        onChange={e => setBatchFacultySearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <select
                      value={batchFacultyPanelFilter}
                      onChange={e => setBatchFacultyPanelFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="">All Panels ({totalPanelsCount})</option>
                      {selectedBatchDetails?.panels?.map(p => (
                        <option key={p.id} value={p.id}>
                          {cleanPanelName(p.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isLoadingBatchFaculty ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw size={24} className="animate-spin text-green-600 mx-auto mb-2" />
                      Loading faculty mentors...
                    </div>
                  ) : batchFaculty.length === 0 ? (
                    <div style={{ padding: '48px 20px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <Briefcase size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>No faculty mentors assigned yet</div>
                      <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '6px auto 16px auto' }}>
                        Assign faculty and mentors to RI panels using batch-wide Excel upload, panel-wise upload, or add them individually.
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                          onClick={() => {
                            setFacultyUploadMode('batch_wise');
                            setFacultyUploadPanelId('');
                            setUploadFile(null);
                            setValidationResult(null);
                            setFacultyUploadModal(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#15803d',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          <Upload size={14} />
                          <span>Bulk Upload Faculty</span>
                        </button>
                        <button
                          onClick={() => {
                            setFacultyForm({
                              name: '',
                              email: '',
                              mobile: '',
                              department: '',
                              designation: '',
                              employee_id: '',
                              role: 'Mentor',
                              ri_panel_id: batchFacultyPanelFilter || selectedBatchDetails?.panels?.[0]?.id || ''
                            });
                            setFacultyModal({ mode: 'create', faculty: null });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#ffffff',
                            color: '#15803d',
                            border: '1.5px solid #86efac',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          <UserPlus size={14} />
                          <span>Add Single Mentor</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Faculty / Mentor</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Department & Role</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Assigned Panel</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Village</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Contact</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Undertaking</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Identity</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchFaculty
                            .filter(f => {
                              if (batchFacultyPanelFilter && String(f.ri_panel_id) !== String(batchFacultyPanelFilter)) {
                                return false;
                              }
                              if (!batchFacultySearch.trim()) return true;
                              const q = batchFacultySearch.toLowerCase();
                              return (
                                (f.name || '').toLowerCase().includes(q) ||
                                (f.email || '').toLowerCase().includes(q) ||
                                (f.department || '').toLowerCase().includes(q) ||
                                (f.designation || '').toLowerCase().includes(q) ||
                                (f.employee_id || '').toLowerCase().includes(q) ||
                                (f.panel_name || '').toLowerCase().includes(q)
                              );
                            })
                            .map(f => (
                              <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s' }}>
                                {/* Faculty Member Info */}
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        fontWeight: '800',
                                        fontSize: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}
                                    >
                                      {(f.name || 'F').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{f.name}</div>
                                      {f.employee_id && (
                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Emp ID: {f.employee_id}</div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Department & Role */}
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ fontWeight: '600', color: '#334155' }}>
                                    {f.designation || f.role || 'Faculty Mentor'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    {f.department || 'General'}
                                  </div>
                                </td>

                                {/* Assigned Panel */}
                                <td style={{ padding: '12px 14px' }}>
                                  {f.panel_name ? (
                                    <span
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        backgroundColor: '#f1f5f9',
                                        color: '#334155',
                                        padding: '4px 9px',
                                        borderRadius: '6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <Grid size={12} color="#64748b" />
                                      <span>{cleanPanelName(f.panel_name)}</span>
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                                  )}
                                </td>

                                {/* Village */}
                                <td style={{ padding: '12px 14px' }}>
                                  {f.village_name ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#0f172a', fontSize: '13px', fontWeight: '500' }}>
                                      <MapPin size={13} color="#64748b" />
                                      <span>{f.village_name}</span>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                                  )}
                                </td>

                                {/* Contact */}
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: '500' }}>{f.email}</div>
                                  {f.mobile && (
                                    <div style={{ fontSize: '11px', color: '#166534', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                      <Phone size={10} />
                                      <span>{f.mobile}</span>
                                    </div>
                                  )}
                                </td>

                                {/* Undertaking Status & Download */}
                                <td style={{ padding: '12px 14px' }}>
                                  {f.undertaking_submitted ? (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          backgroundColor: '#ecfdf5',
                                          color: '#065f46',
                                          border: '1px solid #a7f3d0',
                                          padding: '2px 8px',
                                          borderRadius: '12px',
                                          fontSize: '11px',
                                          fontWeight: '700'
                                        }}
                                      >
                                        <CheckCircle2 size={11} color="#059669" />
                                        Yes
                                      </span>
                                      <button
                                        onClick={() => handleDownloadFacultyUndertaking(f)}
                                        title="Download Signed Undertaking PDF"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          border: '1px solid #cbd5e1',
                                          backgroundColor: '#ffffff',
                                          color: '#047857',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.backgroundColor = '#f0fdf4';
                                          e.currentTarget.style.borderColor = '#86efac';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.backgroundColor = '#ffffff';
                                          e.currentTarget.style.borderColor = '#cbd5e1';
                                        }}
                                      >
                                        <Download size={11} />
                                        <span>Download</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        backgroundColor: '#f8fafc',
                                        color: '#64748b',
                                        border: '1px solid #e2e8f0',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      No
                                    </span>
                                  )}
                                </td>

                                {/* Identity / Source */}
                                <td style={{ padding: '12px 14px' }}>
                                  {f.user_id ? (
                                    <span
                                      style={{
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: '700'
                                      }}
                                    >
                                      Linked LTC User
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        padding: '2px 7px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}
                                    >
                                      RI Direct
                                    </span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                      onClick={() => {
                                        setFacultyForm({
                                          name: f.name || '',
                                          email: f.email || '',
                                          mobile: f.mobile || '',
                                          department: f.department || '',
                                          designation: f.designation || '',
                                          employee_id: f.employee_id || '',
                                          role: f.role || 'Mentor',
                                          ri_panel_id: f.ri_panel_id || ''
                                        });
                                        setFacultyModal({ mode: 'edit', faculty: f });
                                      }}
                                      title="Edit Faculty"
                                      style={{
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        backgroundColor: '#ffffff',
                                        color: '#475569',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirmFaculty(f)}
                                      title="Remove Faculty"
                                      style={{
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #fee2e2',
                                        backgroundColor: '#fef2f2',
                                        color: '#dc2626',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBSECTION 4: BATCH STUDENTS DIRECTORY ── */}
              {batchSubTab === 'students' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: isMobile ? '16px 14px' : '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '14px' : '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <h3 style={{ fontSize: isMobile ? '16px' : '17px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                        {currentBatch?.name || 'Batch'} — Enrolled Students
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                        Showing {batchStudentTotalCount} students in this batch.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
                      {currentBatch?.source_program === 'RI_DIRECT' && (
                        <button
                          type="button"
                          onClick={() => {
                            setStudentFormData(initialStudentFormData);
                            setIsAddStudentModalOpen(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            minHeight: '38px',
                            backgroundColor: '#15803d',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            width: isMobile ? '100%' : 'auto',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        >
                          <UserPlus size={15} />
                          <span>Add Student</span>
                        </button>
                      )}
                      <button
                        onClick={handleExportBatchStudents}
                        disabled={isExportingBatchStudents}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          minHeight: '38px',
                          backgroundColor: currentBatch?.source_program === 'RI_DIRECT' ? '#f1f5f9' : '#15803d',
                          color: currentBatch?.source_program === 'RI_DIRECT' ? '#0f172a' : '#ffffff',
                          border: currentBatch?.source_program === 'RI_DIRECT' ? '1px solid #cbd5e1' : 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: isExportingBatchStudents ? 'not-allowed' : 'pointer',
                          width: isMobile ? '100%' : 'auto',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isExportingBatchStudents ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>{isExportingBatchStudents ? 'Exporting...' : 'Export CSV'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter bar */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '10px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search student name, PRN..."
                        value={batchStudentSearch}
                        onChange={e => {
                          setBatchStudentSearch(e.target.value);
                          setBatchStudentPage(1);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <select
                      value={batchStudentPanelFilter}
                      onChange={e => {
                        setBatchStudentPanelFilter(e.target.value);
                        setBatchStudentPage(1);
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <option value="">All Panels</option>
                      {selectedBatchDetails?.panels?.map(p => (
                        <option key={p.id} value={p.id}>
                          {cleanPanelName(p.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Students Table */}
                  {isLoadingBatchStudents ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading students...</div>
                  ) : batchStudents.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No students match the criteria.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>
                              {currentBatch?.source_program === 'RI_DIRECT' ? 'RI ID' : 'LTC ID'}
                            </th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>PRN</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Name & Email</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Panel</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>School / Dept</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Division</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569' }}>Source</th>
                            <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchStudents.map(s => {
                            const isRiDirect = currentBatch?.source_program === 'RI_DIRECT' || s.source_program === 'RI_DIRECT';
                            const studentId = isRiDirect ? (s.ri_id || '—') : (s.ltc_id || '—');
                            return (
                              <tr key={s.student_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    backgroundColor: isRiDirect ? '#f0fdf4' : '#eff6ff',
                                    color: isRiDirect ? '#15803d' : '#1d4ed8',
                                    border: `1px solid ${isRiDirect ? '#bbf7d0' : '#bfdbfe'}`,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    fontFamily: 'monospace'
                                  }}>
                                    {studentId}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>{s.prn || '—'}</td>
                                <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: '600', color: '#14532d' }}>{s.name}</div>
                                {s.email && <div style={{ fontSize: '11.5px', color: '#64748b' }}>{s.email}</div>}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <span style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                                  {cleanPanelName(s.panel_name)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#64748b' }}>
                                <div>{s.school || '—'}</div>
                                {s.department && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.department}</div>}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#64748b' }}>{s.division || '—'}</td>
                              <td style={{ padding: '12px 14px' }}>
                                <span
                                  style={{
                                    backgroundColor: s.source_program === 'RI_DIRECT' ? '#0f766e' : '#1d4ed8',
                                    color: '#ffffff',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    display: 'inline-block'
                                  }}
                                >
                                  {s.source_program === 'RI_DIRECT' ? 'RI Direct' : (s.source_program || 'LTC_SYNC')}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => openEditStudent({ ...s, batch_id: selectedRiBatchId })}
                                  title="Edit Student"
                                  style={{
                                    padding: '6px',
                                    borderRadius: '6px',
                                    border: '1px solid #bbf7d0',
                                    backgroundColor: '#f0fdf4',
                                    color: '#15803d',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <Edit3 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>

                      {/* Pagination Bar */}
                      <div style={{
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center',
                        justifyContent: 'space-between',
                        gap: isMobile ? '12px' : '0',
                        marginTop: '20px',
                        paddingTop: '16px',
                        borderTop: '1px solid #e2e8f0'
                      }}>
                        <span style={{ fontSize: '13px', color: '#64748b', textAlign: isMobile ? 'center' : 'left' }}>
                          Page {batchStudentPage} of {batchStudentTotalPages}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: isMobile ? 'center' : 'flex-end' }}>
                          <button
                            disabled={batchStudentPage <= 1}
                            onClick={() => setBatchStudentPage(p => Math.max(1, p - 1))}
                            style={{
                              padding: '8px 16px',
                              minHeight: '38px',
                              flex: isMobile ? 1 : 'none',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: batchStudentPage <= 1 ? '#f1f5f9' : '#ffffff',
                              color: batchStudentPage <= 1 ? '#94a3b8' : '#334155',
                              cursor: batchStudentPage <= 1 ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            Previous
                          </button>
                          <button
                            disabled={batchStudentPage >= batchStudentTotalPages}
                            onClick={() => setBatchStudentPage(p => Math.min(batchStudentTotalPages, p + 1))}
                            style={{
                              padding: '8px 16px',
                              minHeight: '38px',
                              flex: isMobile ? 1 : 'none',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: batchStudentPage >= batchStudentTotalPages ? '#f1f5f9' : '#ffffff',
                              color: batchStudentPage >= batchStudentTotalPages ? '#94a3b8' : '#334155',
                              cursor: batchStudentPage >= batchStudentTotalPages ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUBSECTION 5: DEPARTMENT COORDINATORS & NODAL OFFICERS ── */}
              {batchSubTab === 'nodal_officers' && (
                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: isMobile ? '16px 14px' : '24px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? '14px' : '16px',
                    marginBottom: '20px'
                  }}>
                    <div>
                      <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                        {currentBatch?.name || 'Batch'} — Department Coordinators &amp; Nodal Officers
                      </h3>
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
                        Manage department coordinators and nodal officers assigned to panels.
                      </p>
                      <p style={{ fontSize: '12.5px', color: '#334155', margin: '4px 0 0 0', fontWeight: '500' }}>
                        {nodalOfficersList.filter(p => Boolean((p.nodal_officer_name && p.nodal_officer_name.trim()) || (p.nodal_officer_email && p.nodal_officer_email.trim()))).length} assigned nodal officers across {nodalOfficersList.length || totalPanelsCount} panels
                      </p>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto'
                    }}>
                      <button
                        onClick={() => {
                          const targetB = currentBatch || { id: selectedRiBatchId, name: 'Current Batch' };
                          setVillageFacultyTargetBatch(targetB);
                          setVillageFacultyFile(null);
                          setVillageFacultyValidation(null);
                          setVillageFacultyImportResult(null);
                          setVillageFacultyError('');
                          setVillageFacultyModalOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          minHeight: '38px',
                          backgroundColor: '#15803d',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flex: isMobile ? '1 1 100%' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Upload size={14} />
                        <span>Upload Village &amp; Faculty Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter & Stats Strip */}
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', flex: '1', minWidth: isMobile ? '100%' : '260px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Filter by Panel, Coordinator Name, Email, or Village..."
                        value={nodalOfficerSearch}
                        onChange={(e) => setNodalOfficerSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 36px',
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

                    {/* Stats Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ecfdf5',
                        color: '#047857',
                        fontWeight: '700',
                        border: '1px solid #a7f3d0'
                      }}>
                        {nodalOfficersList.filter(p => p.nodal_officer_email || p.nodal_officer_name).length} Assigned
                      </span>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        fontWeight: '700',
                        border: '1px solid #fecaca'
                      }}>
                        {nodalOfficersList.filter(p => !p.nodal_officer_email && !p.nodal_officer_name).length} Unassigned
                      </span>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontWeight: '700',
                        border: '1px solid #e2e8f0'
                      }}>
                        {nodalOfficersList.length} Total Panels
                      </span>
                      <button
                        type="button"
                        onClick={() => fetchBatchNodalOfficers(selectedRiBatchId)}
                        disabled={nodalOfficerLoading}
                        title="Refresh list"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <RefreshCw size={13} className={nodalOfficerLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  {nodalOfficerLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
                      <RefreshCw size={28} className="animate-spin" color="#047857" />
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Loading Nodal Officer allocations...</p>
                    </div>
                  ) : nodalOfficersList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <UserCheck size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                      <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: '#334155' }}>No Panels Found</h4>
                      <p style={{ margin: 0, fontSize: '13px' }}>Upload Village &amp; Faculty data to map Department Coordinators / Nodal Officers to panels.</p>
                    </div>
                  ) : (
                    <div style={{
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '780px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <th style={{ padding: '10px 14px' }}>Panel</th>
                            <th style={{ padding: '10px 14px' }}>Department Coordinator / Nodal Officer</th>
                            <th style={{ padding: '10px 14px' }}>Assigned Village</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Students</th>
                            <th style={{ padding: '10px 14px' }}>Portal Login</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nodalOfficersList
                            .filter(p => {
                              if (!nodalOfficerSearch.trim()) return true;
                              const q = nodalOfficerSearch.toLowerCase();
                              return (
                                (p.panel_name && p.panel_name.toLowerCase().includes(q)) ||
                                (p.nodal_officer_name && p.nodal_officer_name.toLowerCase().includes(q)) ||
                                (p.nodal_officer_email && p.nodal_officer_email.toLowerCase().includes(q)) ||
                                (p.village_name && p.village_name.toLowerCase().includes(q)) ||
                                (p.department && p.department.toLowerCase().includes(q))
                              );
                            })
                            .map((p, idx) => {
                              const hasName = Boolean(p.nodal_officer_name && p.nodal_officer_name.trim());
                              const hasEmail = Boolean(p.nodal_officer_email && p.nodal_officer_email.trim() && p.nodal_officer_email.includes('@'));
                              const hasOfficer = hasName || hasEmail;
                              return (
                                <tr key={p.panel_id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                  {/* Panel Column */}
                                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '13.5px' }}>
                                      {p.panel_name}
                                    </div>
                                    {p.department && (
                                      <span style={{
                                        display: 'inline-block',
                                        marginTop: '3px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#475569',
                                        backgroundColor: '#e2e8f0',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                      }}>
                                        {p.department}
                                      </span>
                                    )}
                                  </td>

                                  {/* Nodal Officer Details */}
                                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                    {hasOfficer ? (
                                      <div>
                                        <div style={{ fontWeight: '700', color: '#065f46', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <UserCheck size={14} color="#059669" />
                                          <span>{p.nodal_officer_name || 'Nodal Officer'}</span>
                                        </div>
                                        {hasEmail ? (
                                          <div style={{ marginTop: '3px', fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Mail size={12} color="#64748b" />
                                            <a href={`mailto:${p.nodal_officer_email}`} style={{ color: '#047857', textDecoration: 'none', fontWeight: '500' }}>
                                              {p.nodal_officer_email}
                                            </a>
                                          </div>
                                        ) : (
                                          <div style={{ marginTop: '2px', fontSize: '11.5px', color: '#94a3b8' }}>
                                            No Email Uploaded
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '12px', fontWeight: '600', border: '1px solid #e2e8f0' }}>
                                        <span style={{ color: '#94a3b8' }}>Not Assigned</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Village Column */}
                                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>
                                      {p.village_name || '—'}
                                    </div>
                                    {(p.taluka || p.district) && (
                                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                        {[p.taluka, p.district].filter(Boolean).join(', ')}
                                      </div>
                                    )}
                                    {p.google_maps_link && (
                                      <a
                                        href={p.google_maps_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '3px',
                                          marginTop: '4px',
                                          fontSize: '11px',
                                          fontWeight: '600',
                                          color: '#047857',
                                          textDecoration: 'underline'
                                        }}
                                      >
                                        <MapPin size={11} />
                                        <span>Map Link ↗</span>
                                      </a>
                                    )}
                                  </td>

                                  {/* Students Count */}
                                  <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'top' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      backgroundColor: '#f1f5f9',
                                      fontWeight: '800',
                                      fontSize: '13px',
                                      color: '#0f172a',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      {p.student_count || 0}
                                    </span>
                                  </td>

                                  {/* Portal Login Credentials */}
                                  <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                                    {hasEmail ? (
                                      <div>
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '3px 8px',
                                          borderRadius: '6px',
                                          backgroundColor: '#ecfdf5',
                                          color: '#047857',
                                          fontSize: '11.5px',
                                          fontWeight: '700',
                                          border: '1px solid #a7f3d0'
                                        }}>
                                          <CheckCircle size={12} />
                                          Role: RI Nodal Officer
                                        </span>
                                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                                          Default Pass: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', color: '#0f172a', fontWeight: '700' }}>nodal@123</code>
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>Not Assigned</span>
                                    )}
                                  </td>

                                  {/* Action: Edit Nodal Officer */}
                                  <td style={{ padding: '12px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => openEditNodalOfficer(p)}
                                      title="Edit Nodal Officer Details"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        backgroundColor: '#f0fdf4',
                                        color: '#047857',
                                        border: '1px solid #bbf7d0',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#dcfce7';
                                        e.currentTarget.style.borderColor = '#86efac';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                                        e.currentTarget.style.borderColor = '#bbf7d0';
                                      }}
                                    >
                                      <Edit3 size={13} />
                                      <span>Edit</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Info Footer */}
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Nodal Officers log in via the regular portal using their Excel Email ID &amp; default password <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', color: '#0f172a', fontWeight: '700' }}>nodal@123</code>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ================================================================ */}
          {/* TAB 5: GLOBAL ALL RI STUDENTS                                    */}
          {/* ================================================================ */}
          {activeTab === 'all_students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: isMobile ? '16px' : '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                {/* Single-Line Controls Bar: Search PRN, All RI Batches, All Sources, Export CSV */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: isMobile ? '12px' : '16px',
                  width: '100%',
                  overflowX: isMobile ? 'auto' : 'visible',
                  WebkitOverflowScrolling: 'touch',
                  flexWrap: 'nowrap',
                  paddingBottom: isMobile ? '4px' : '0'
                }}>
                  {/* Search PRN / Name Box */}
                  <div style={{ position: 'relative', flex: '1 1 240px', minWidth: isMobile ? '180px' : '200px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search PRN, Name, Email..."
                      value={studentSearch}
                      onChange={e => {
                        setStudentSearch(e.target.value);
                        setStudentPage(1);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 32px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '12.5px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        height: '36px'
                      }}
                    />
                  </div>

                  {/* All RI Batches Dropdown */}
                  <select
                    value={studentBatchFilter}
                    onChange={e => {
                      setStudentBatchFilter(e.target.value);
                      setStudentPage(1);
                    }}
                    style={{
                      flex: isMobile ? '0 0 auto' : '0 1 180px',
                      width: isMobile ? '145px' : 'auto',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      height: '36px',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <option value="">All RI Batches</option>
                    {riBatches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                  {/* All Sources Dropdown */}
                  <select
                    value={studentSourceFilter}
                    onChange={e => {
                      setStudentSourceFilter(e.target.value);
                      setStudentPage(1);
                    }}
                    style={{
                      flex: isMobile ? '0 0 auto' : '0 1 140px',
                      width: isMobile ? '125px' : 'auto',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      height: '36px',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <option value="">All Sources</option>
                    <option value="LTC">LTC Synchronized</option>
                    <option value="RI_DIRECT">RI Direct</option>
                  </select>

                  {/* Export CSV Button (Unpaginated Full Export) */}
                  <button
                    onClick={handleExportAllStudents}
                    disabled={isExportingAllStudents}
                    style={{
                      flex: '0 0 auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      height: '36px',
                      backgroundColor: isExportingAllStudents ? '#94a3b8' : '#15803d',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: isExportingAllStudents ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box'
                    }}
                  >
                    {isExportingAllStudents ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>{isExportingAllStudents ? 'Exporting...' : 'Export CSV'}</span>
                  </button>
                </div>

                {/* Table */}
                {isLoadingAllStudents ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading students...</div>
                ) : allStudents.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No students match the criteria.</div>
                ) : (
                  <div style={{
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}>
                    <table style={{ width: '100%', minWidth: '960px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Student ID</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>PRN</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Name &amp; Email</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Batch</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>RI Panel</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>School &amp; Dept</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Division</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Source</th>
                          <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allStudents.map(s => {
                          const isRiDirect = s.source_program === 'RI_DIRECT' || s.batch_source === 'RI_DIRECT';
                          const studentId = isRiDirect ? (s.ri_id || '—') : (s.ltc_id || '—');
                          return (
                            <tr key={s.student_id || s.enrollment_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  backgroundColor: isRiDirect ? '#f0fdf4' : '#eff6ff',
                                  color: isRiDirect ? '#15803d' : '#1d4ed8',
                                  border: `1px solid ${isRiDirect ? '#bbf7d0' : '#bfdbfe'}`,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  fontFamily: 'monospace'
                                }}>
                                  {studentId}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {s.prn || '—'}
                              </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: '600', color: '#14532d' }}>{s.name}</span>
                                {s.email && (
                                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>
                                    • {s.email}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '500', whiteSpace: 'nowrap' }}>
                              {s.batch_name || '—'}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {cleanPanelName(s.panel_name)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: '500', color: '#334155' }}>{s.school || '—'}</span>
                                {s.department && (
                                  <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                    ({s.department})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {s.division || '—'}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  backgroundColor: s.source_program === 'RI_DIRECT' ? '#0f766e' : '#1d4ed8',
                                  color: '#ffffff',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {s.source_program === 'RI_DIRECT' ? 'RI Direct' : (s.source_program || 'LTC_SYNC')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => openEditStudent(s)}
                                title="Edit Student Details"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #bbf7d0',
                                  backgroundColor: '#f0fdf4',
                                  color: '#15803d',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Edit3 size={13} />
                                <span style={{ whiteSpace: 'nowrap' }}>Edit</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      </tbody>
                    </table>

                    {/* Pagination Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Page {studentPage} of {studentTotalPages}
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          disabled={studentPage <= 1}
                          onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: studentPage <= 1 ? '#f1f5f9' : '#ffffff',
                            color: studentPage <= 1 ? '#94a3b8' : '#334155',
                            cursor: studentPage <= 1 ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}
                        >
                          Previous
                        </button>
                        <button
                          disabled={studentPage >= studentTotalPages}
                          onClick={() => setStudentPage(p => Math.min(studentTotalPages, p + 1))}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: studentPage >= studentTotalPages ? '#f1f5f9' : '#ffffff',
                            color: studentPage >= studentTotalPages ? '#94a3b8' : '#334155',
                            cursor: studentPage >= studentTotalPages ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '600'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB: RI SUBMISSIONS                                              */}
          {/* ================================================================ */}
          {activeTab === 'submissions' && (
            <RiSubmissionsModule
              token={localStorage.getItem('token')}
              apiBase={API}
              batches={riBatches}
              toast={addToast}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 6: RI BULK UPLOAD                                            */}
          {/* ================================================================ */}
          {activeTab === 'bulk_upload' && (
            <RiBulkUploadModule
              batches={riBatches}
              selectedBatchId={selectedRiBatchId}
              setSelectedBatchId={setSelectedRiBatchId}
              onNavigateToStudents={() => {
                setActiveTab('all_students');
                fetchAllStudents();
              }}
              API={API}
              toast={addToast}
            />
          )}

          {/* ================================================================ */}
          {/* TAB: FACULTY UPLOADS                                              */}
          {/* ================================================================ */}
          {activeTab === 'faculty_uploads' && (
            <RiFacultyUploadsModule isMobile={isMobile} />
          )}

          {/* ================================================================ */}
          {/* TAB 7: RI SUPPORT TICKETS                                         */}
          {/* ================================================================ */}
          {activeTab === 'tickets' && (
            <RiTicketsModule
              token={localStorage.getItem('token')}
              apiBase={API}
              onTicketCountChange={setPendingTicketCount}
              onNavigateTab={setActiveTab}
              activeRedFlagCount={activeRedFlagCount}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 8: RI RED FLAGS                                              */}
          {/* ================================================================ */}
          {activeTab === 'redflags' && (
            <RiRedFlagsModule
              token={localStorage.getItem('token')}
              userRole={currentUser?.role || 'ri_admin'}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 8.5: RI ORANGE FLAGS                                         */}
          {/* ================================================================ */}
          {activeTab === 'orangeflags' && (
            <RiOrangeFlagsModule
              token={localStorage.getItem('token')}
              userRole={currentUser?.role || 'ri_admin'}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 9: RI COMMUNICATION (SENDER CONSOLE & AUDIT LOGS)             */}
          {/* ================================================================ */}
          {(activeTab === 'communication_sender' || activeTab === 'communication_logs') && (
            <RiCommunicationModule
              initialView={activeTab === 'communication_logs' ? 'logs' : 'sender'}
              isMobile={isMobile}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 10: RI AUDIT LOGS (DEDICATED RI ACTIVITY TELEMETRY)          */}
          {/* ================================================================ */}
          {activeTab === 'audit_logs' && (
            <RiAuditLogsModule
              isMobile={isMobile}
            />
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* MODAL: CONFIRM SYNC LTC BATCH TO RI                                 */}
      {/* =================================================================== */}
      {confirmSyncModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #e2e8f0',
              borderTop: '5px solid #047857'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    {confirmSyncModal.isResync ? 'Re-sync LTC Batch to RI' : 'Sync LTC Batch to RI'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Rural Immersion Batch & Panel Provisioning
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmSyncModal(null)}
                disabled={Boolean(syncingLtcBatchId)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Batch Summary Card */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a' }}>
                  {confirmSyncModal.batch.name}
                </div>
                {confirmSyncModal.batch.batch_code && (
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                    {confirmSyncModal.batch.batch_code}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '12.5px', color: '#64748b' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>LTC Students: </span>
                  <strong style={{ color: '#0f172a' }}>{confirmSyncModal.batch.ltc_student_count || 0}</strong>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>LTC Status: </span>
                  <strong style={{ color: '#0f172a' }}>{confirmSyncModal.batch.status || 'Active'}</strong>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#94a3b8' }}>Dates: </span>
                  <strong style={{ color: '#0f172a' }}>{formatDateRange(confirmSyncModal.batch.start_date, confirmSyncModal.batch.end_date)}</strong>
                </div>
              </div>
            </div>

            {/* Explanatory Notice */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px', marginBottom: '20px', fontSize: '12.5px', color: '#166534', lineHeight: 1.5 }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <ShieldCheck size={16} style={{ color: '#15803d', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Read-Only Safety Guarantee:</strong>
                  <p style={{ margin: '4px 0 0 0' }}>
                    Synchronizing creates division-wise RI panels and RI student memberships. Original production LTC tables, attendance, rubrics, and evaluations remain 100% untouched.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirmSyncModal(null)}
                disabled={Boolean(syncingLtcBatchId)}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: syncingLtcBatchId ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSyncLtcBatch(confirmSyncModal.batch)}
                disabled={Boolean(syncingLtcBatchId)}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: syncingLtcBatchId ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)'
                }}
              >
                {syncingLtcBatchId === confirmSyncModal.batch.id ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Synchronizing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    <span>{confirmSyncModal.isResync ? 'Confirm Re-sync' : 'Confirm & Sync to RI'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 0: CREATE RI DIRECT BATCH                                     */}
      {/* =================================================================== */}
      {isCreateBatchModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #e2e8f0',
              borderTop: '5px solid #047857'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                      Create RI Batch
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px' }}>
                      RI Direct
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Directly create an independent Rural Immersion cohort.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateBatchModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateRiBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Batch Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Batch Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BATCH 1 (ONLY RI)"
                  value={createBatchFormData.name}
                  onChange={e => setCreateBatchFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Dates Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Start Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createBatchFormData.start_date}
                    onChange={e => setCreateBatchFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    End Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={createBatchFormData.end_date}
                    onChange={e => setCreateBatchFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Source (Automatically RI Direct) */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Source
                </label>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#047857', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                    RI Direct
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Automatically set to RI Direct — no LTC batch linkage required.
                  </span>
                </div>
              </div>

              {/* Description (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes or description for this immersion cohort..."
                  value={createBatchFormData.description}
                  onChange={e => setCreateBatchFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateBatchModalOpen(false)}
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
                  disabled={isCreatingBatch}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isCreatingBatch ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)'
                  }}
                >
                  {isCreatingBatch && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isCreatingBatch ? 'Creating...' : 'Create RI Batch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 0B: EDIT RI DIRECT BATCH                                      */}
      {/* =================================================================== */}
      {editBatchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #e2e8f0',
              borderTop: '5px solid #047857'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                      Edit RI Batch
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                      {editBatchModal.batch_code || 'RI Batch'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Update details for this RI Direct cohort.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditBatchModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Batch Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Batch Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBatchModal.name}
                  onChange={e => setEditBatchModal(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Batch Code (Read Only) */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Batch Code (Auto-Generated)
                </label>
                <div style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#047857',
                  fontFamily: 'monospace'
                }}>
                  {editBatchModal.batch_code}
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Batch code is locked and cannot be changed after creation.
                </span>
              </div>

              {/* Start Date & End Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Start Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editBatchModal.start_date}
                    onChange={e => setEditBatchModal(prev => ({ ...prev, start_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    End Date <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editBatchModal.end_date}
                    onChange={e => setEditBatchModal(prev => ({ ...prev, end_date: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Status
                </label>
                <select
                  value={editBatchModal.status}
                  onChange={e => setEditBatchModal(prev => ({ ...prev, status: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editBatchModal.description}
                  onChange={e => setEditBatchModal(prev => ({ ...prev, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setEditBatchModal(null)}
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
                  disabled={isUpdatingBatch}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isUpdatingBatch ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(4, 120, 87, 0.2)'
                  }}
                >
                  {isUpdatingBatch && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isUpdatingBatch ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 0C: DELETE RI DIRECT BATCH CONFIRMATION                       */}
      {/* =================================================================== */}
      {deleteBatchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #fee2e2'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                  Delete RI Direct Batch
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete batch <strong style={{ color: '#0f172a' }}>{deleteBatchModal.batch?.name}</strong> (<span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#047857' }}>{deleteBatchModal.batch?.batch_code}</span>)?
                </p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#9f1239', marginBottom: '20px', lineHeight: 1.4 }}>
              <strong>Warning:</strong> This will delete all student enrollments, panels, and immersion records associated specifically with this RI cohort. This action cannot be reversed.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteBatchModal(null)}
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
                type="button"
                onClick={handleDeleteBatch}
                disabled={isDeletingBatch}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isDeletingBatch ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeletingBatch && <RefreshCw size={14} className="animate-spin" />}
                <span>{isDeletingBatch ? 'Deleting...' : 'Delete Batch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DELETE RI PANEL CONFIRMATION                                 */}
      {/* =================================================================== */}
      {deletePanelModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #fee2e2'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
                  Delete Panel
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Panel Name: <strong style={{ color: '#0f172a', fontWeight: '800' }}>{cleanPanelName(deletePanelModal.panel?.name)}</strong>
                  {deletePanelModal.panel?.village_name ? (
                    <> • Village: <span style={{ color: '#047857', fontWeight: '600' }}>{deletePanelModal.panel.village_name}</span></>
                  ) : null}
                </p>
              </div>
            </div>

            {/* Student Count Condition Alert */}
            {Number(deletePanelModal.panel?.student_count || 0) > 0 ? (
              <div style={{
                backgroundColor: '#fff1f2',
                border: '1.5px solid #fecdd3',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '13px',
                color: '#9f1239',
                marginBottom: '18px',
                lineHeight: 1.5
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#e11d48' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#881337', fontSize: '13px' }}>
                      Cannot delete this panel because students are assigned to it. Please reassign the students before deleting.
                    </strong>
                    <span style={{ fontSize: '12px', color: '#9f1239' }}>
                      Current enrollment: <strong>{deletePanelModal.panel?.student_count} student(s)</strong>. Panels can only be deleted when 0 students are assigned.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '12.5px',
                color: '#475569',
                marginBottom: '18px',
                lineHeight: 1.5
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#16a34a' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '3px', color: '#0f172a' }}>
                      0 Students Assigned — Safe to Delete
                    </strong>
                    <span>
                      Are you sure you want to delete panel <strong>{cleanPanelName(deletePanelModal.panel?.name)}</strong>? Any linked village allocation or faculty mentor assignments will be safely unlinked.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Alert if Deletion Blocked */}
            {deletePanelModal.error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1.5px solid #f87171',
                borderRadius: '10px',
                padding: '14px',
                fontSize: '12.5px',
                color: '#991b1b',
                marginBottom: '18px',
                lineHeight: 1.5
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '3px', color: '#7f1d1d' }}>
                      Deletion Prevented
                    </strong>
                    {deletePanelModal.error}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={deletePanelModal.isDeleting}
                onClick={() => setDeletePanelModal(null)}
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
                {Number(deletePanelModal.panel?.student_count || 0) > 0 ? 'Close' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleDeletePanel}
                disabled={deletePanelModal.isDeleting || Number(deletePanelModal.panel?.student_count || 0) > 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: Number(deletePanelModal.panel?.student_count || 0) > 0 ? '#94a3b8' : '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: (deletePanelModal.isDeleting || Number(deletePanelModal.panel?.student_count || 0) > 0) ? 'not-allowed' : 'pointer',
                  opacity: deletePanelModal.isDeleting ? 0.7 : 1,
                  boxShadow: Number(deletePanelModal.panel?.student_count || 0) > 0 ? 'none' : '0 2px 4px rgba(220,38,38,0.25)'
                }}
                title={Number(deletePanelModal.panel?.student_count || 0) > 0 ? 'Cannot delete panel because students are assigned to it' : 'Delete Panel'}
              >
                {deletePanelModal.isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>{Number(deletePanelModal.panel?.student_count || 0) > 0 ? 'Cannot Delete (Has Students)' : 'Delete Panel'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 0D: EDIT RI STUDENT DETAILS                                   */}
      {/* =================================================================== */}
      {editStudentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isMobile ? '12px' : '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: isMobile ? '16px' : '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid #e2e8f0',
              borderTop: '5px solid #047857',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: isMobile ? '12px' : '16px', borderBottom: '1px solid #f1f5f9', marginBottom: isMobile ? '14px' : '16px', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', minWidth: 0 }}>
                <div style={{ width: isMobile ? '34px' : '38px', height: isMobile ? '34px' : '38px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={isMobile ? 18 : 20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: isMobile ? '15.5px' : '17px', fontWeight: '800', color: '#0f172a', margin: 0, lineHeight: 1.25 }}>
                      Edit Student Details
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: editStudentModal.student?.source_program === 'RI_DIRECT' ? '#ecfdf5' : '#eff6ff',
                      color: editStudentModal.student?.source_program === 'RI_DIRECT' ? '#047857' : '#1d4ed8',
                      border: editStudentModal.student?.source_program === 'RI_DIRECT' ? '1px solid #a7f3d0' : '1px solid #bfdbfe',
                      whiteSpace: 'nowrap'
                    }}>
                      {editStudentModal.student?.source_program === 'RI_DIRECT' ? 'RI Direct' : 'LTC Synced'}
                    </span>
                  </div>
                  <p style={{ fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', margin: '3px 0 0 0', lineHeight: 1.35 }}>
                    Batch: <strong>{editStudentModal.student?.batch_name || editStudentModal.student?.batch_code || '—'}</strong>
                    {editStudentModal.student?.ri_id && (
                      <span style={{ marginLeft: '8px', color: '#047857', fontWeight: '700', fontFamily: 'monospace' }}>
                        RI ID: {editStudentModal.student.ri_id}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditStudentModal(null)}
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', cursor: 'pointer', padding: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '14px' }}>
              {/* Row 1: Name and Email */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentModal.name}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editStudentModal.email}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, email: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Email note */}
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', fontSize: isMobile ? '11px' : '11.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.35 }}>
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                <span>If the email address is updated, the student will immediately log in using the new email address.</span>
              </div>

              {/* Row 2: Phone, PRN, Gender */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.phone}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, phone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    PRN
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.prn}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, prn: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Gender
                  </label>
                  <select
                    value={editStudentModal.gender || 'Other'}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, gender: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 3: School, Department, Division */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '10px' : '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    School
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.school}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, school: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.department}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, department: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Division
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.division}
                    onChange={e => setEditStudentModal(prev => ({ ...prev, division: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: isMobile ? '10px 12px' : '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Row 4: RI Panel Assignment */}
              <div>
                <label style={{ display: 'block', fontSize: isMobile ? '12px' : '12.5px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                  Assigned Panel
                </label>
                <select
                  value={editStudentModal.ri_panel_id || ''}
                  onChange={e => setEditStudentModal(prev => ({ ...prev, ri_panel_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">-- No Panel Assigned --</option>
                  {studentModalPanels.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.village_name ? `(${p.village_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column-reverse' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'flex-end',
                gap: isMobile ? '8px' : '10px',
                paddingTop: isMobile ? '14px' : '16px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  type="button"
                  onClick={() => setEditStudentModal(null)}
                  style={{
                    padding: isMobile ? '11px 16px' : '9px 18px',
                    width: isMobile ? '100%' : 'auto',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStudent}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: isMobile ? '11px 20px' : '9px 22px',
                    width: isMobile ? '100%' : 'auto',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isUpdatingStudent ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
                    textAlign: 'center'
                  }}
                >
                  {isUpdatingStudent && <RefreshCw size={14} className="animate-spin" />}
                  <span>{isUpdatingStudent ? 'Saving...' : 'Save Student Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CREATE / EDIT VILLAGE                                      */}
      {/* =================================================================== */}
      {villageModal && (villageModal.mode === 'create' || villageModal.mode === 'edit') && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                    {villageModal.mode === 'create' ? 'Add New Village' : 'Edit Village'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Batch: {currentBatch?.name || 'Current RI Batch'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVillageModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVillage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Village Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ralegan Siddhi"
                  value={villageForm.name}
                  onChange={e => setVillageForm(f => ({ ...f, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    District
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ahmednagar"
                    value={villageForm.district}
                    onChange={e => setVillageForm(f => ({ ...f, district: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Panchayat / Taluka
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parner"
                    value={villageForm.panchayat}
                    onChange={e => setVillageForm(f => ({ ...f, panchayat: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Location / Address / Landmarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Zilla Parishad School, Highway 27"
                  value={villageForm.location}
                  onChange={e => setVillageForm(f => ({ ...f, location: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Sarpanch Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Patil"
                    value={villageForm.sarpanch_name}
                    onChange={e => setVillageForm(f => ({ ...f, sarpanch_name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Sarpanch Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={villageForm.sarpanch_mobile}
                    onChange={e => setVillageForm(f => ({ ...f, sarpanch_mobile: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Emergency Contact / Local Support
                </label>
                <input
                  type="text"
                  placeholder="e.g. Primary Health Center (02488-223344)"
                  value={villageForm.emergency_contact}
                  onChange={e => setVillageForm(f => ({ ...f, emergency_contact: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Notes / Orientation Info
                </label>
                <textarea
                  rows={3}
                  placeholder="Logistics and community guidelines..."
                  value={villageForm.notes}
                  onChange={e => setVillageForm(f => ({ ...f, notes: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setVillageModal(null)}
                  style={{
                    padding: '8px 18px',
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
                  disabled={isSavingVillage}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSavingVillage ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{villageModal.mode === 'create' ? 'Create Village' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: VIEW VILLAGE DETAILS                                       */}
      {/* =================================================================== */}
      {villageModal && villageModal.mode === 'view' && villageModal.village && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                    {villageModal.village.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Village Profile & Allocation Status
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVillageModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>District</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{villageModal.village.district || '—'}</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Panchayat</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{villageModal.village.panchayat || '—'}</div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Location / Address</div>
                <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>{villageModal.village.location || '—'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Sarpanch Name</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{villageModal.village.sarpanch_name || '—'}</div>
                </div>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Sarpanch Mobile</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#166534', marginTop: '2px' }}>{villageModal.village.sarpanch_mobile || '—'}</div>
                </div>
              </div>

              <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Emergency Contact</div>
                <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>{villageModal.village.emergency_contact || '—'}</div>
              </div>

              {villageModal.village.notes && (
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Notes</div>
                  <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>{villageModal.village.notes}</div>
                </div>
              )}

              {/* Assigned Panels in View Modal */}
              <div style={{ marginTop: '8px', padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Allocated Panels ({villageModal.village.assigned_panels?.length || 0})
                </div>
                {villageModal.village.assigned_panels && villageModal.village.assigned_panels.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {villageModal.village.assigned_panels.map(ap => (
                      <div key={ap.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                        <span style={{ fontWeight: '700', color: '#14532d' }}>{cleanPanelName(ap.name)}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{ap.student_count || 0} Students</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: '#64748b', fontSize: '13px' }}>No panels currently allocated to this village.</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setVillageModal(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: DELETE VILLAGE CONFIRMATION                                */}
      {/* =================================================================== */}
      {deleteConfirmVillage && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#991b1b', margin: 0 }}>Delete Village</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>{deleteConfirmVillage.name}</p>
              </div>
            </div>

            {deleteConfirmVillage.has_assigned_panels ? (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>
                  ⚠️ Notice: This village is currently assigned to {deleteConfirmVillage.assigned_panels_count} panel(s):
                </div>
                <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
                  {deleteConfirmVillage.assigned_panels?.map(p => (
                    <li key={p.id}><strong>{p.name}</strong> ({p.student_count || 0} students)</li>
                  ))}
                </ul>
                <div>Deleting will remove these panel assignments and set them back to <strong>Not Assigned</strong>. Proceed?</div>
              </div>
            ) : (
              <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
                Are you sure you want to permanently delete village <strong>"{deleteConfirmVillage.name}"</strong>?
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmVillage(null)}
                style={{
                  padding: '8px 18px',
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
                type="button"
                disabled={isDeletingVillage}
                onClick={() => handleDeleteVillage(deleteConfirmVillage, true)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDeletingVillage ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{deleteConfirmVillage.has_assigned_panels ? 'Unassign & Delete' : 'Delete Village'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT SINGLE FACULTY MENTOR                             */}
      {/* =================================================================== */}
      {facultyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                    {facultyModal.mode === 'create' ? 'Add Faculty Mentor' : 'Edit Faculty Mentor'}
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Batch: {currentBatch?.name || 'Current RI Batch'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFacultyModal(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Faculty Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={facultyForm.name}
                  onChange={e => setFacultyForm(f => ({ ...f, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rajesh.sharma@mitwpu.edu.in"
                    value={facultyForm.email}
                    onChange={e => setFacultyForm(f => ({ ...f, email: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={facultyForm.mobile}
                    onChange={e => setFacultyForm(f => ({ ...f, mobile: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assign to RI Panel <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  value={facultyForm.ri_panel_id}
                  onChange={e => setFacultyForm(f => ({ ...f, ri_panel_id: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">-- Select Panel --</option>
                  {selectedBatchDetails?.panels?.map(p => (
                    <option key={p.id} value={p.id}>
                      {cleanPanelName(p.name)} ({p.student_count || 0} students) {p.village_name ? `→ ${p.village_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Department / School
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={facultyForm.department}
                    onChange={e => setFacultyForm(f => ({ ...f, department: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Assistant Professor"
                    value={facultyForm.designation}
                    onChange={e => setFacultyForm(f => ({ ...f, designation: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EMP-1049"
                    value={facultyForm.employee_id}
                    onChange={e => setFacultyForm(f => ({ ...f, employee_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Role
                  </label>
                  <select
                    value={facultyForm.role}
                    onChange={e => setFacultyForm(f => ({ ...f, role: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Mentor">Mentor</option>
                    <option value="Faculty Coordinator">Faculty Coordinator</option>
                    <option value="Lead Mentor">Lead Mentor</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setFacultyModal(null)}
                  style={{
                    padding: '8px 18px',
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
                  disabled={isSavingFaculty}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isSavingFaculty ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{facultyModal.mode === 'create' ? 'Assign Mentor' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: DELETE FACULTY CONFIRMATION                                  */}
      {/* =================================================================== */}
      {deleteConfirmFaculty && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#991b1b', margin: 0 }}>Remove Faculty Mentor</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>{cleanPanelName(deleteConfirmFaculty.panel_name)}</p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Are you sure you want to remove <strong>{deleteConfirmFaculty.name}</strong> ({deleteConfirmFaculty.email}) from this RI panel?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmFaculty(null)}
                style={{
                  padding: '8px 18px',
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
                type="button"
                disabled={isDeletingFaculty}
                onClick={() => handleDeleteFaculty(deleteConfirmFaculty)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isDeletingFaculty ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Remove Mentor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD STUDENT MEMBER (RI-DIRECT ONLY)                          */}
      {/* =================================================================== */}
      {isAddStudentModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: isMobile ? '12px' : '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              borderTop: '4px solid #15803d'
            }}
          >
            <form onSubmit={handleCreateRiStudent} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Solid Green Header */}
              <div
                style={{
                  background: '#15803d',
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <UserPlus size={18} /> Add Student Member
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#bbf7d0' }}>
                    Batch: {currentBatch?.name || 'RI Direct Batch'} ({currentBatch?.batch_code || 'RI-DIRECT'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div
                style={{
                  overflowY: 'auto',
                  padding: isMobile ? '16px' : '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  flex: 1
                }}
              >
                {/* Section 1: Basic Information */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Basic Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Full Name <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={studentFormData.name}
                          onChange={e => setStudentFormData(f => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Official Email <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          required
                          type="email"
                          placeholder="e.g. rahul@mitwpu.edu.in"
                          value={studentFormData.email}
                          onChange={e => setStudentFormData(f => ({ ...f, email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        PRN (LTC ID) <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          required
                          placeholder="e.g. 2019CS001"
                          value={studentFormData.prn}
                          onChange={e => setStudentFormData(f => ({ ...f, prn: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Roll Number
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. 101"
                          value={studentFormData.roll_number}
                          onChange={e => setStudentFormData(f => ({ ...f, roll_number: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Gender <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          required
                          value={studentFormData.gender}
                          onChange={e => setStudentFormData(f => ({ ...f, gender: e.target.value }))}
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Academic & Hierarchy Details */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Academic & Hierarchy Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Division
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          value={studentFormData.division}
                          onChange={e => setStudentFormData(f => ({ ...f, division: e.target.value, faculty: '', school: '', department: '' }))}
                        >
                          <option value="">Select Division</option>
                          {Object.keys(OFFICIAL_HIERARCHY).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Faculty
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          value={studentFormData.faculty}
                          onChange={e => setStudentFormData(f => ({ ...f, faculty: e.target.value, school: '', department: '' }))}
                          disabled={!studentFormData.division}
                        >
                          <option value="">Select Faculty</option>
                          {(studentFormData.division ? Object.keys(OFFICIAL_HIERARCHY[studentFormData.division] || {}) : []).map(fac => (
                            <option key={fac} value={fac}>{fac}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        School
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          value={studentFormData.school}
                          onChange={e => setStudentFormData(f => ({ ...f, school: e.target.value, department: '' }))}
                          disabled={!studentFormData.faculty}
                        >
                          <option value="">Select School</option>
                          {(studentFormData.division && studentFormData.faculty ? Object.keys(OFFICIAL_HIERARCHY[studentFormData.division]?.[studentFormData.faculty] || {}) : []).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Department
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          value={studentFormData.department}
                          onChange={e => setStudentFormData(f => ({ ...f, department: e.target.value }))}
                          disabled={!studentFormData.school}
                        >
                          <option value="">Select Department</option>
                          {(studentFormData.division && studentFormData.faculty && studentFormData.school ? (OFFICIAL_HIERARCHY[studentFormData.division]?.[studentFormData.faculty]?.[studentFormData.school] || []) : []).map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Semester <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          required
                          placeholder="e.g. 5"
                          value={studentFormData.semester}
                          onChange={e => setStudentFormData(f => ({ ...f, semester: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Program
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. B.Tech"
                          value={studentFormData.program}
                          onChange={e => setStudentFormData(f => ({ ...f, program: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Year
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. 3"
                          value={studentFormData.year}
                          onChange={e => setStudentFormData(f => ({ ...f, year: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Panel
                      </label>
                      <div className="modal-input-wrapper">
                        <select
                          value={studentFormData.panel}
                          onChange={e => setStudentFormData(f => ({ ...f, panel: e.target.value }))}
                        >
                          <option value="">None</option>
                          {uniquePanels.length > 0 ? (
                            uniquePanels.map(p => (
                              <option key={p.id} value={p.name}>
                                {cleanPanelName(p.name)} ({p.student_count || 0})
                              </option>
                            ))
                          ) : (
                            ['A','B','C','D','E','F','G','H','I','J','K'].map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))
                          )}
                        </select>
                        <ChevronDown size={16} style={{ color: '#64748b', pointerEvents: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contact & Personal Details */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Contact & Personal Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Contact Number
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. 9876543210"
                          value={studentFormData.phone}
                          onChange={e => setStudentFormData(f => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Personal Email
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          type="email"
                          placeholder="e.g. rahul@gmail.com"
                          value={studentFormData.personal_email}
                          onChange={e => setStudentFormData(f => ({ ...f, personal_email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Date of Birth
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          type="date"
                          value={studentFormData.dob}
                          onChange={e => setStudentFormData(f => ({ ...f, dob: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Age
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          type="number"
                          placeholder="e.g. 20"
                          value={studentFormData.age}
                          onChange={e => setStudentFormData(f => ({ ...f, age: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Nationality
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. Indian"
                          value={studentFormData.nationality}
                          onChange={e => setStudentFormData(f => ({ ...f, nationality: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Aadhar Number
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. 123456789012"
                          value={studentFormData.aadhar_no}
                          onChange={e => setStudentFormData(f => ({ ...f, aadhar_no: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: isMobile ? '0' : '22px' }}>
                      <input
                        type="checkbox"
                        id="ri_stu_lateral_entry"
                        checked={studentFormData.lateral_entry}
                        onChange={e => setStudentFormData(f => ({ ...f, lateral_entry: e.target.checked }))}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: '1.5px solid #d1d5db',
                          accentColor: '#15803d',
                          cursor: 'pointer'
                        }}
                      />
                      <label htmlFor="ri_stu_lateral_entry" style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Lateral Entry</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Student admitted via lateral entry</div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 4: Parent & Guardian Details */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Parent & Guardian Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Parent Mobile Number
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. 9876543210"
                          value={studentFormData.parent_mobile}
                          onChange={e => setStudentFormData(f => ({ ...f, parent_mobile: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Parent Email Address
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          type="email"
                          placeholder="e.g. parent@gmail.com"
                          value={studentFormData.parent_email}
                          onChange={e => setStudentFormData(f => ({ ...f, parent_email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Nominee Details */}
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Nominee Details
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Nominee Name
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="Guardian / Nominee Name"
                          value={studentFormData.nominee_name}
                          onChange={e => setStudentFormData(f => ({ ...f, nominee_name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Nominee Relationship
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          placeholder="e.g. Father"
                          value={studentFormData.nominee_relationship}
                          onChange={e => setStudentFormData(f => ({ ...f, nominee_relationship: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '6px' }}>
                        Nominee Email
                      </label>
                      <div className="modal-input-wrapper">
                        <input
                          type="email"
                          placeholder="nominee@gmail.com"
                          value={studentFormData.nominee_email}
                          onChange={e => setStudentFormData(f => ({ ...f, nominee_email: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 6: Residential Address */}
                <div>
                  <h4
                    style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#15803d',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      margin: '0 0 12px 0'
                    }}
                  >
                    Residential Address
                  </h4>
                  <div
                    style={{
                      border: '1px solid #d1d5db',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      background: '#ffffff'
                    }}
                  >
                    <textarea
                      placeholder="Street, City, State, Zip Code..."
                      value={studentFormData.address}
                      onChange={e => setStudentFormData(f => ({ ...f, address: e.target.value }))}
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        minHeight: '60px',
                        fontSize: '14px',
                        color: '#0f172a',
                        fontFamily: 'inherit',
                        background: 'transparent'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Footer Action Buttons */}
              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  background: '#f8fafc',
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStudent}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#15803d',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: isSubmittingStudent ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: isSubmittingStudent ? 0.7 : 1
                  }}
                >
                  {isSubmittingStudent ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Adding Student...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Add Student</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: VILLAGE & FACULTY BULK UPLOAD (CLEAN & COMPACT)             */}
      {/* =================================================================== */}
      {villageFacultyModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #cbd5e1',
              borderTop: '4px solid #047857',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#047857' }}>
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                      Village &amp; Faculty Bulk Upload
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f0fdf4', color: '#047857', border: '1px solid #bbf7d0' }}>
                      {villageFacultyTargetBatch?.name} {villageFacultyTargetBatch?.batch_code ? `(${villageFacultyTargetBatch.batch_code})` : ''}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setVillageFacultyModalOpen(false);
                  setVillageFacultyFile(null);
                  setVillageFacultyValidation(null);
                  setVillageFacultyImportResult(null);
                  setVillageFacultyError('');
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#ffffff' }}>
              
              {/* Essential Instructions & Download Template */}
              <div style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '10px',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <Info size={15} color="#047857" style={{ flexShrink: 0 }} />
                  <span>Upload official Excel file (.xlsx, .xls) containing panel allocations, village locations, and assigned faculty with emails.</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadVillageFacultyTemplate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    color: '#047857',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  <Download size={13} />
                  <span>Download Excel Template</span>
                </button>
              </div>

              {villageFacultyError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '12.5px', fontWeight: '600' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{villageFacultyError}</span>
                </div>
              )}

              {/* Success Result */}
              {villageFacultyImportResult && (
                <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: '800', fontSize: '14px' }}>
                    <CheckCircle size={18} />
                    <span>{villageFacultyImportResult.message || 'Import completed successfully!'}</span>
                  </div>
                  {villageFacultyImportResult.summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '10px' }}>
                      <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>PANELS UPDATED</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{villageFacultyImportResult.summary.panels_upserted || villageFacultyImportResult.summary.panels_updated || 0}</div>
                      </div>
                      <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>VILLAGES MAPPED</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{villageFacultyImportResult.summary.villages_upserted || (villageFacultyImportResult.summary.villages_created || 0) + (villageFacultyImportResult.summary.villages_updated || 0)}</div>
                      </div>
                      <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>FACULTY ASSIGNED</div>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#047857' }}>{villageFacultyImportResult.summary.faculty_assigned || 0}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* File Dropzone */}
              {!villageFacultyImportResult && (
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const f = e.dataTransfer.files[0];
                      setVillageFacultyFile(f);
                      handleValidateVillageFacultyFile(f);
                    }
                  }}
                  onClick={() => document.getElementById('ri-village-faculty-input')?.click()}
                  style={{
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    id="ri-village-faculty-input"
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const f = e.target.files[0];
                        setVillageFacultyFile(f);
                        handleValidateVillageFacultyFile(f);
                      }
                    }}
                  />
                  <Upload size={22} color="#047857" style={{ margin: '0 auto 6px auto' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    {villageFacultyFile ? villageFacultyFile.name : 'Select or drag & drop Excel spreadsheet (.xlsx, .xls)'}
                  </div>
                  {villageFacultyFile && (
                    <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px', fontWeight: '600' }}>
                      Click to choose a different file
                    </div>
                  )}
                </div>
              )}

              {/* Validating Spinner */}
              {villageFacultyValidating && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', color: '#047857', fontWeight: '700', fontSize: '13px' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Validating spreadsheet structure and matching faculty accounts...</span>
                </div>
              )}

              {/* Validation Summary & Preview */}
              {villageFacultyValidation?.preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Metric Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>PANELS</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{villageFacultyValidation.preview.total_panels}</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700' }}>VILLAGES</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{villageFacultyValidation.preview.total_villages}</div>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '6px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                      <div style={{ fontSize: '10.5px', color: '#15803d', fontWeight: '700' }}>MATCHED FACULTY</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#047857' }}>{villageFacultyValidation.preview.matched_faculty_count}</div>
                    </div>
                    <div style={{ backgroundColor: villageFacultyValidation.preview.unmatched_faculty_count > 0 ? '#fffbeb' : '#f8fafc', padding: '8px', borderRadius: '6px', border: villageFacultyValidation.preview.unmatched_faculty_count > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: '10.5px', color: villageFacultyValidation.preview.unmatched_faculty_count > 0 ? '#b45309' : '#64748b', fontWeight: '700' }}>UNMATCHED FACULTY</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: villageFacultyValidation.preview.unmatched_faculty_count > 0 ? '#d97706' : '#64748b' }}>{villageFacultyValidation.preview.unmatched_faculty_count}</div>
                    </div>
                  </div>

                  {/* Missing Faculty Email Error Card */}
                  {villageFacultyValidation.preview.missing_faculty_emails?.length > 0 && (
                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#991b1b' }}>
                      <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertCircle size={14} color="#dc2626" />
                        Validation Error: {villageFacultyValidation.preview.missing_faculty_emails.length} faculty assignment(s) missing required email
                      </div>
                      <div style={{ fontSize: '11px', color: '#b91c1c', marginBottom: '6px' }}>
                        The database requires a non-null email address for all faculty assignments. Please provide email addresses in the Excel file or ensure matching faculty accounts exist:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {villageFacultyValidation.preview.missing_faculty_emails.map((m, mi) => (
                          <span
                            key={mi}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #fca5a5',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#991b1b'
                            }}
                          >
                            {m.name} <span style={{ color: '#b91c1c', fontWeight: '400' }}>({m.role} • {m.panel})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unmatched Warning Card */}
                  {villageFacultyValidation.preview.unmatched_faculty_count > 0 && !villageFacultyValidation.preview.missing_faculty_emails?.length && (
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#92400e' }}>
                      <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertCircle size={14} color="#d97706" />
                        Notice: {villageFacultyValidation.preview.unmatched_faculty_count} faculty assignment(s) not linked to existing user accounts
                      </div>
                      <div style={{ fontSize: '11px', color: '#b45309', marginBottom: '6px' }}>
                        Unmatched faculty with valid emails will be saved in panel allocations:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {(villageFacultyValidation.preview.unique_unmatched_faculty || villageFacultyValidation.preview.unmatched_faculty).map((uf, ufi) => (
                          <span
                            key={ufi}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #fde68a',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#78350f'
                            }}
                          >
                            {uf.name} <span style={{ color: '#92400e', fontWeight: '400' }}>({uf.role} • {uf.panel_name})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compact Preview Table */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '700', fontSize: '12px', color: '#334155' }}>
                      Allocation Preview ({villageFacultyValidation.preview.panels.length} Panels)
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '6px 10px' }}>Panel</th>
                            <th style={{ padding: '6px 10px' }}>Village</th>
                            <th style={{ padding: '6px 10px' }}>Nodal Officer</th>
                            <th style={{ padding: '6px 10px' }}>Assigned Faculty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {villageFacultyValidation.preview.panels.map((p, pi) => (
                            <tr key={pi} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {p.panel_name}
                                {p.class_teacher_name && (
                                  <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: '500', display: 'block' }}>
                                    CT: {p.class_teacher_name}
                                  </span>
                                )}
                                {p.student_count && <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{p.student_count} Students</span>}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#047857', fontWeight: '600' }}>
                                {p.village_name}
                                {p.taluka && <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{p.taluka}, {p.district}</span>}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#334155' }}>
                                {p.nodal_officer_name || p.nodal_officer_email ? (
                                  <div>
                                    <span style={{ fontWeight: '600', color: '#0f172a', display: 'block' }}>{p.nodal_officer_name || 'Nodal Officer'}</span>
                                    {p.nodal_officer_email && <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>{p.nodal_officer_email}</span>}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {p.faculty && p.faculty.length > 0 ? (
                                    p.faculty.map((f, fi) => {
                                      const hasEmail = Boolean(f.email || f.matched_email);
                                      const isClassTeacher = f.role === 'Class Teacher';
                                      
                                      let badgeBg = '#fee2e2';
                                      let badgeColor = '#b91c1c';
                                      let badgeBorder = '1px solid #fca5a5';
                                      let badgeText = 'MISSING EMAIL';

                                      if (f.matched) {
                                        badgeBg = '#dcfce7';
                                        badgeColor = '#15803d';
                                        badgeBorder = '1px solid #bbf7d0';
                                        badgeText = 'MATCHED';
                                      } else if (hasEmail) {
                                        badgeBg = '#e0f2fe';
                                        badgeColor = '#0369a1';
                                        badgeBorder = '1px solid #bae6fd';
                                        badgeText = 'NEW ACCOUNT';
                                      } else if (isClassTeacher) {
                                        badgeBg = '#f1f5f9';
                                        badgeColor = '#475569';
                                        badgeBorder = '1px solid #cbd5e1';
                                        badgeText = 'PANEL CT';
                                      }

                                      return (
                                        <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span style={{
                                            fontSize: '9.5px',
                                            padding: '1px 4px',
                                            borderRadius: '3px',
                                            fontWeight: '700',
                                            backgroundColor: badgeBg,
                                            color: badgeColor,
                                            border: badgeBorder
                                          }}>
                                            {badgeText}
                                          </span>
                                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{f.name}</span>
                                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>({f.role})</span>
                                          {hasEmail ? (
                                            <span style={{ fontSize: '10px', color: '#047857', fontWeight: '500' }}>
                                              • {f.email || f.matched_email}
                                            </span>
                                          ) : isClassTeacher ? (
                                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '500' }}>
                                              • Name recorded on panel
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: '600' }}>
                                              • Email Required
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>None</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => {
                  setVillageFacultyModalOpen(false);
                  setVillageFacultyFile(null);
                  setVillageFacultyValidation(null);
                  setVillageFacultyImportResult(null);
                  setVillageFacultyError('');
                }}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {villageFacultyImportResult ? 'Close' : 'Cancel'}
              </button>

              {!villageFacultyImportResult && (
                <button
                  type="button"
                  onClick={handleImportVillageFacultyFile}
                  disabled={!villageFacultyValidation?.preview || !villageFacultyValidation?.success || villageFacultyValidation?.preview?.has_errors || villageFacultyImporting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    backgroundColor: (!villageFacultyValidation?.preview || !villageFacultyValidation?.success || villageFacultyValidation?.preview?.has_errors || villageFacultyImporting) ? '#94a3b8' : '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: (!villageFacultyValidation?.preview || !villageFacultyValidation?.success || villageFacultyValidation?.preview?.has_errors || villageFacultyImporting) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {villageFacultyImporting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Import Village &amp; Faculty Data</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: FACULTY / MENTOR BULK UPLOAD (DUAL MODE + PRE-VALIDATION)   */}
      {/* =================================================================== */}
      {facultyUploadModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '960px',
              width: '100%',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                    Faculty & Mentor Bulk Upload
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                    Batch: <strong>{currentBatch?.name || 'Batch'}</strong> • Total Panels: {totalPanelsCount}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFacultyUploadModal(false);
                  setUploadFile(null);
                  setValidationResult(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
              {/* Dual Mode Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                  Select Upload Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* Option 1: Batch-wise */}
                  <div
                    onClick={() => {
                      setFacultyUploadMode('batch_wise');
                      setUploadFile(null);
                      setValidationResult(null);
                    }}
                    style={{
                      border: facultyUploadMode === 'batch_wise' ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                      backgroundColor: facultyUploadMode === 'batch_wise' ? '#f0fdf4' : '#ffffff',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: facultyUploadMode === 'batch_wise' ? '#14532d' : '#0f172a' }}>
                        Option 1: Batch-wise Upload
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px' }}>
                        All Panels
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                      One Excel file containing mentors for the whole batch. Requires a mandatory <strong>Panel</strong> column to automatically route each faculty member.
                    </p>
                  </div>

                  {/* Option 2: Panel-wise */}
                  <div
                    onClick={() => {
                      setFacultyUploadMode('panel_wise');
                      if (!facultyUploadPanelId && selectedBatchDetails?.panels?.[0]) {
                        setFacultyUploadPanelId(String(selectedBatchDetails.panels[0].id));
                      }
                      setUploadFile(null);
                      setValidationResult(null);
                    }}
                    style={{
                      border: facultyUploadMode === 'panel_wise' ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
                      backgroundColor: facultyUploadMode === 'panel_wise' ? '#f0fdf4' : '#ffffff',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ fontWeight: '800', fontSize: '14px', color: facultyUploadMode === 'panel_wise' ? '#14532d' : '#0f172a' }}>
                        Option 2: Panel-wise Upload
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '10px' }}>
                        Single Panel
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                      Upload faculty specifically for a chosen panel. The selected panel is automatically assigned to all faculty rows in the sheet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Panel Selector (if Panel-wise Mode) */}
              {facultyUploadMode === 'panel_wise' && (
                <div style={{ marginBottom: '20px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Select Target Panel for Upload <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={facultyUploadPanelId}
                    onChange={e => {
                      setFacultyUploadPanelId(e.target.value);
                      if (uploadFile) {
                        handleFacultyFileSelect(uploadFile);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">-- Choose Panel --</option>
                    {selectedBatchDetails?.panels?.map(p => (
                      <option key={p.id} value={p.id}>
                        {cleanPanelName(p.name)} ({p.student_count || 0} students) {p.village_name ? `→ ${p.village_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Template Download & Instructions Box */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={18} color="#15803d" />
                  <div style={{ fontSize: '12px', color: '#166534' }}>
                    {facultyUploadMode === 'batch_wise'
                      ? 'Download the Batch-wise Excel template pre-loaded with sample data & a list of valid batch panels.'
                      : 'Download the Panel-wise Excel template tailored for single panel imports.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadFacultyTemplate(facultyUploadMode, facultyUploadPanelId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Download size={13} />
                  <span>Download Excel Template</span>
                </button>
              </div>

              {/* File Upload Zone */}
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  marginBottom: '20px'
                }}
              >
                <UploadCloud size={36} color="#94a3b8" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                  {uploadFile ? uploadFile.name : 'Upload Faculty Excel / CSV File'}
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 14px 0' }}>
                  Supports .xlsx, .xls, .csv. File is instantly validated before importing.
                </p>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    backgroundColor: '#15803d',
                    color: '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <Upload size={14} />
                  <span>{uploadFile ? 'Change File' : 'Browse File'}</span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleFacultyFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Validation Progress Spinner */}
              {isValidatingFaculty && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#15803d', backgroundColor: '#f0fdf4', borderRadius: '10px', marginBottom: '20px' }}>
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                  <div style={{ fontSize: '14px', fontWeight: '700' }}>Validating faculty rows & panel assignments...</div>
                </div>
              )}

              {/* Live Pre-Validation Results */}
              {validationResult && (
                <div style={{ marginTop: '10px' }}>
                  {/* Summary Metric Ribbon */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Rows</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{validationResult.summary?.total_rows || 0}</div>
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Valid Rows</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#15803d' }}>{validationResult.summary?.valid_rows || 0}</div>
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: validationResult.summary?.invalid_rows > 0 ? '#fef2f2' : '#f8fafc', borderRadius: '8px', border: validationResult.summary?.invalid_rows > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: validationResult.summary?.invalid_rows > 0 ? '#991b1b' : '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Errors / Issues</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: validationResult.summary?.invalid_rows > 0 ? '#dc2626' : '#64748b' }}>{validationResult.summary?.invalid_rows || 0}</div>
                    </div>
                    <div style={{ padding: '10px 14px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '700', textTransform: 'uppercase' }}>LTC User Matches</div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb' }}>{validationResult.summary?.existing_users_matched || 0}</div>
                    </div>
                  </div>

                  {/* Filter View Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                      Row-Level Validation Preview
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setFilterValidationRows('all')}
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: filterValidationRows === 'all' ? '#334155' : '#f1f5f9',
                          color: filterValidationRows === 'all' ? '#ffffff' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        All Rows ({validationResult.validated_rows?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterValidationRows('valid')}
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: filterValidationRows === 'valid' ? '#15803d' : '#f1f5f9',
                          color: filterValidationRows === 'valid' ? '#ffffff' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        Valid Only ({validationResult.summary?.valid_rows || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterValidationRows('errors')}
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: filterValidationRows === 'errors' ? '#dc2626' : '#f1f5f9',
                          color: filterValidationRows === 'errors' ? '#ffffff' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        Errors Only ({validationResult.summary?.invalid_rows || 0})
                      </button>
                    </div>
                  </div>

                  {/* Row Preview Table */}
                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1.5px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '50px' }}>Row</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '90px' }}>Status</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569' }}>Name</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569' }}>Email</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569' }}>Target Panel</th>
                          <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569' }}>Validation Notes / Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResult.validated_rows
                          ?.filter(r => {
                            if (filterValidationRows === 'valid') return r.is_valid;
                            if (filterValidationRows === 'errors') return !r.is_valid;
                            return true;
                          })
                          .map((r, idx) => (
                            <tr
                              key={idx}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: r.is_valid ? '#ffffff' : '#fef2f2'
                              }}
                            >
                              <td style={{ padding: '8px 10px', fontWeight: '600', color: '#64748b' }}>#{r.row_index}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {r.is_valid ? (
                                  <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCircle size={10} /> Valid
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertCircle size={10} /> Error
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>{r.name || '—'}</td>
                              <td style={{ padding: '8px 10px', color: '#334155' }}>{r.email || '—'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                {r.resolved_panel_name ? (
                                  <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '6px' }}>
                                    {cleanPanelName(r.resolved_panel_name)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                                    {r.raw_panel_input ? `"${r.raw_panel_input}" (Not matched)` : 'Missing Panel'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {r.errors && r.errors.length > 0 ? (
                                  <div style={{ color: '#dc2626', fontSize: '11px', fontWeight: '600' }}>
                                    {r.errors.join(' • ')}
                                  </div>
                                ) : (
                                  <div style={{ color: '#15803d', fontSize: '11px' }}>
                                    Ready to import {r.matched_user_id ? '(LTC User linked)' : ''}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {validationResult ? (
                  <div>
                    <span>Ready to import <strong>{validationResult.summary?.valid_rows || 0}</strong> of {validationResult.summary?.total_rows || 0} rows.</span>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600', marginTop: '2px' }}>
                      🔑 Newly provisioned faculty can immediately log in with password: <strong>faculty123</strong>
                    </div>
                  </div>
                ) : (
                  <span>Select an Excel file to begin live validation.</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFacultyUploadModal(false);
                    setUploadFile(null);
                    setValidationResult(null);
                  }}
                  style={{
                    padding: '8px 18px',
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
                  type="button"
                  disabled={!validationResult || !validationResult.summary?.valid_rows || isUploadingFaculty}
                  onClick={handleExecuteFacultyImport}
                  style={{
                    padding: '8px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: (!validationResult || !validationResult.summary?.valid_rows || isUploadingFaculty) ? '#94a3b8' : '#15803d',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: (!validationResult || !validationResult.summary?.valid_rows || isUploadingFaculty) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isUploadingFaculty ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>
                    {isUploadingFaculty
                      ? 'Importing...'
                      : `Import ${validationResult?.summary?.valid_rows || 0} Valid Faculty`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: PANEL STUDENTS LIST                                        */}
      {/* =================================================================== */}
      {selectedPanel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: isMobile ? '10px' : '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '12px' : '16px',
              maxWidth: '960px',
              width: '100%',
              maxHeight: isMobile ? '94vh' : '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: isMobile ? '16px 14px' : '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#14532d', margin: 0 }}>
                    {cleanPanelName(selectedPanel.name)} — Student List
                  </h3>
                  <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px' }}>
                    {panelStudentTotalCount} Students
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Batch: {currentBatch?.name || 'Batch'} • Panel Capacity: {selectedPanel.capacity || 60}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPanel(null);
                  setSelectedPanelInfo(null);
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Subtab Toggle Buttons */}
            <div style={{ display: 'flex', gap: '8px', margin: '10px 0 14px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setPanelModalTab('students')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  fontWeight: panelModalTab === 'students' ? '700' : '600',
                  background: panelModalTab === 'students' ? '#047857' : '#f8fafc',
                  color: panelModalTab === 'students' ? '#ffffff' : '#475569',
                  border: panelModalTab === 'students' ? '1px solid #047857' : '1px solid #e2e8f0',
                  cursor: 'pointer'
                }}
              >
                Enrolled Students ({panelStudentTotalCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanelModalTab('media');
                  fetchPanelMedia(selectedPanel.id);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  fontWeight: panelModalTab === 'media' ? '700' : '600',
                  background: panelModalTab === 'media' ? '#047857' : '#f8fafc',
                  color: panelModalTab === 'media' ? '#ffffff' : '#475569',
                  border: panelModalTab === 'media' ? '1px solid #047857' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Camera size={14} />
                <span>Visit Media ({panelMediaList.length}/5)</span>
              </button>
            </div>

            {panelModalTab === 'media' ? (
              <div style={{ padding: '8px 0', overflowY: 'auto', maxHeight: '60vh' }}>
                <RiPanelMediaViewer
                  media={panelMediaList}
                  isLoading={isLoadingPanelMedia}
                  title={`Field Visit Photos for ${cleanPanelName(selectedPanel.name)}`}
                  subtitle={`Uploaded by panel faculty mentors • Village: ${selectedPanel.village_name || selectedPanelInfo?.village_name || 'N/A'}`}
                  emptyMessage="Faculty mentors have not uploaded any visit photos for this panel yet."
                  canDelete={true}
                  onDelete={handleDeletePanelMediaAdmin}
                  isMobile={isMobile}
                />
              </div>
            ) : (
              <>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: '10px',
              margin: '14px 0'
            }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? '100%' : '360px', width: '100%' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search student name, PRN..."
                  value={panelStudentSearch}
                  onChange={e => {
                    setPanelStudentSearch(e.target.value);
                    fetchPanelStudents(selectedPanel.id, 1, e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 34px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                onClick={() => exportPanelCSV(selectedPanel)}
                disabled={isExportingPanelCsv}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  minHeight: '38px',
                  backgroundColor: isExportingPanelCsv ? '#f1f5f9' : '#f0fdf4',
                  color: isExportingPanelCsv ? '#94a3b8' : '#15803d',
                  border: `1px solid ${isExportingPanelCsv ? '#cbd5e1' : '#bbf7d0'}`,
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isExportingPanelCsv ? 'not-allowed' : 'pointer',
                  width: isMobile ? '100%' : 'auto',
                  whiteSpace: 'nowrap'
                }}
              >
                <Download size={14} />
                <span>{isExportingPanelCsv ? 'Exporting...' : 'Export Panel CSV'}</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              {isLoadingPanelStudents ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading students...</div>
              ) : panelStudents.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No students in this panel.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>
                        {(selectedPanelInfo?.source_program || selectedPanel?.source_program || currentBatch?.source_program) === 'RI_DIRECT' ? 'RI ID' : 'LTC ID'}
                      </th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Name</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>School</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Department</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Division</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Panel</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#475569' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelStudents.map(s => {
                      const isRiDirect = (s.source_program || selectedPanelInfo?.source_program || selectedPanel?.source_program || currentBatch?.source_program) === 'RI_DIRECT';
                      const studentId = isRiDirect ? (s.ri_id || '—') : (s.ltc_id || '—');
                      return (
                        <tr key={s.student_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{studentId}</td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#14532d' }}>{s.name}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.school || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.department || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.division || '—'}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                              {cleanPanelName(s.panel_name || selectedPanelInfo?.panel_name || selectedPanel?.name)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                              {s.source_program || (isRiDirect ? 'RI_DIRECT' : 'LTC_SYNC')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Page {panelStudentPage} of {panelStudentTotalPages}
              </span>
            </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #e2e8f0', marginTop: '12px' }}>
              <button
                onClick={() => {
                  setSelectedPanel(null);
                  setSelectedPanelInfo(null);
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Batch Attendance Download Modal ─── */}
      {attendanceModalBatch && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAttendanceModalBatch(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '12px' : '16px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '14px' : '12px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              border: '1px solid #e2e8f0',
              padding: isMobile ? '18px 16px' : '24px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0f172a'
                  }}
                >
                  <ClipboardCheck size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Download RI Attendance
                  </h4>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Batch: {attendanceModalBatch.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttendanceModalBatch(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scope / Filter Options */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Attendance Scope
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'complete', label: 'Complete Batch' },
                  { id: 'panel', label: 'Panel-wise' },
                  { id: 'village', label: 'Village-wise' }
                ].map(opt => {
                  const isSelected = attendanceFilterType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttendanceFilterType(opt.id)}
                      style={{
                        padding: '9px 8px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#0f172a' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#334155',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional dropdown for Panel-wise */}
            {attendanceFilterType === 'panel' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Select Panel
                </label>
                {isLoadingAttendanceMeta ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>Loading panels...</div>
                ) : attendanceBatchPanels.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>No panels found for this batch.</div>
                ) : (
                  <select
                    value={selectedAttendancePanelId}
                    onChange={e => setSelectedAttendancePanelId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {attendanceBatchPanels.map(p => (
                      <option key={p.id} value={p.id}>
                        P{p.panel_number}: {cleanPanelName(p.name)}{p.village_name ? ` (${p.village_name})` : ''} {p.student_count ? `— ${p.student_count} Students` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Conditional dropdown for Village-wise */}
            {attendanceFilterType === 'village' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Select Village
                </label>
                {isLoadingAttendanceMeta ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>Loading villages...</div>
                ) : attendanceBatchVillages.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>No villages found for this batch.</div>
                ) : (
                  <select
                    value={selectedAttendanceVillageId}
                    onChange={e => setSelectedAttendanceVillageId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {attendanceBatchVillages.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.district ? ` (${v.district})` : ''} {v.panel_count ? `— ${v.panel_count} Panels` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Summary info strip */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Total Batch Students</span>
              <strong style={{ color: '#0f172a' }}>{attendanceModalBatch.total_students || 0}</strong>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setAttendanceModalBatch(null)}
                style={{
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDownloadingAttendance || isLoadingAttendanceMeta}
                onClick={handleDownloadAttendanceExcel}
                style={{
                  background: (isDownloadingAttendance || isLoadingAttendanceMeta) ? '#94a3b8' : '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 18px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: (isDownloadingAttendance || isLoadingAttendanceMeta) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isDownloadingAttendance ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={15} />
                    <span>Download Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Nodal Officer Sub-Modal */}
      {editingNodalOfficer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Edit Nodal Officer
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    {editingNodalOfficer.panel_name} {editingNodalOfficer.village_name ? `• ${editingNodalOfficer.village_name}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingNodalOfficer(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveNodalOfficer} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Nodal Officer / Coordinator Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prof. Rajesh Sharma"
                  value={editingNodalOfficer.nodal_officer_name}
                  onChange={(e) => setEditingNodalOfficer(prev => ({ ...prev, nodal_officer_name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Official Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. rajesh.sharma@mitwpu.edu.in"
                  value={editingNodalOfficer.nodal_officer_email}
                  onChange={(e) => setEditingNodalOfficer(prev => ({ ...prev, nodal_officer_email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
                <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  If a new user account is created, default login password will be set to <code style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: '700', color: '#047857' }}>nodal@123</code>.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Department / School
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Science & Engineering"
                  value={editingNodalOfficer.department}
                  onChange={(e) => setEditingNodalOfficer(prev => ({ ...prev, department: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingNodalOfficer(null)}
                  disabled={savingNodalOfficer}
                  style={{
                    padding: '9px 18px',
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
                  disabled={savingNodalOfficer}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: savingNodalOfficer ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {savingNodalOfficer ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent & Responsive Scroll-To-Top for tab navigations & high scroll offsets */}
      <ScrollToTop watchDeps={[activeTab, batchSubTab]} />
    </div>
  );
}
