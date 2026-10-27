import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  Award,
  Users,
  BookOpen,
  Calendar,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  LogOut,
  X,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  User,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Building2,
  Home,
  Lightbulb,
  Eye,
  Info,
  Lock,
  Unlock,
  LifeBuoy,
  AlertTriangle,
  Flag,
  ArrowLeft,
  ArrowLeftRight,
  CheckCheck,
  Layers,
  Camera,
  UploadCloud,
  Table2,
  Save,
  Settings,
  FileText
} from 'lucide-react';
import { DEFAULT_SCHEDULE, getRiCategoryStyles } from '../shared/riScheduleData';
import { cleanPanelName, RI_ACTIVITIES_LIST, RI_ACTIVITIES, formatRiDate } from '../shared/riUtils';
import RiStudentWorkspaceModal from './RiStudentWorkspaceModal';
import RiEvaluationTab from './RiEvaluationTab';
import RiAllEvaluationTab from './RiAllEvaluationTab';
import RiUndertakingForm from '../shared/RiUndertakingForm';
import RiFacultySupportTab from './RiFacultySupportTab';
import RiFacultyRedFlagTab from './RiFacultyRedFlagTab';
import RiFacultyOrangeFlagTab from './RiFacultyOrangeFlagTab';
import RiVillageTab from '../student/RiVillageTab';
import RiFacultyUploadsTab from './RiFacultyUploadsTab';
import RiFacultySettingsTab from './RiFacultySettingsTab';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

export default function RiFacultyDashboard() {
  const navigate = useNavigate();

  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width >= 768) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isMobile = windowWidth < 768;

  // Lock body scroll and handle Escape key when mobile nav drawer is open
  useEffect(() => {
    if (isMobile && isMobileNavOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') setIsMobileNavOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobile, isMobileNavOpen]);

  // Student Workspace Modal State
  const [workspaceStudentId, setWorkspaceStudentId] = useState(null);
  const [workspaceInitialTab, setWorkspaceInitialTab] = useState('overview');

  // User & Batch-scoped State
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeBatches, setActiveBatches] = useState([]);
  const [hasActiveAssignment, setHasActiveAssignment] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [assignedPanels, setAssignedPanels] = useState([]);
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [canSwitchWorkspace, setCanSwitchWorkspace] = useState(false);

  // Tab Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [panelData, setPanelData] = useState(null);
  const [studentsData, setStudentsData] = useState({ students: [], total: 0 });

  // Activity-Wise Attendance State
  const [attendanceOverview, setAttendanceOverview] = useState(null);
  const [activeActivityKey, setActiveActivityKey] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [isDownloadingAttendanceExcel, setIsDownloadingAttendanceExcel] = useState(false);
  const [isMarkingAllActivitiesPresent, setIsMarkingAllActivitiesPresent] = useState(false);
  const [confirmMarkAllModal, setConfirmMarkAllModal] = useState({ open: false, absentCount: 0 });
  const [facultyScheduleDay, setFacultyScheduleDay] = useState(1);

  // Search & Filter State
  const [directorySearch, setDirectorySearch] = useState('');

  // Faculty Undertaking State
  const [facultyUndertaking, setFacultyUndertaking] = useState(null);
  const [isSubmittingUndertaking, setIsSubmittingUndertaking] = useState(false);
  const [isUndertakingChecked, setIsUndertakingChecked] = useState(false);
  const [showFacultyGatePopup, setShowFacultyGatePopup] = useState(true);

  const userRole = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')?.role;
    } catch {
      return null;
    }
  }, []);
  const isAdminPreview = ['superadmin', 'ri_admin', 'superadmin-ri', 'admin'].includes(userRole);

  const isFacultyUndertakingSubmitted = Boolean(
    isAdminPreview ||
    facultyUndertaking?.submitted ||
    facultyUndertaking?.signed_name ||
    facultyUndertaking?.signedName ||
    facultyUndertaking?.status === 'Submitted' ||
    profile?.ri_undertaking_submitted ||
    profile?.undertaking_submitted ||
    currentUser?.ri_undertaking_submitted ||
    currentUser?.undertaking_submitted
  );

  // Pending Attendance / Evaluation Reminder Popup (on login / panel open)
  const [showPendingActionPopup, setShowPendingActionPopup] = useState(false);
  const [hasCheckedPendingPopup, setHasCheckedPendingPopup] = useState(false);

  // All Eval Actions Bridge (for header placement)
  const [allEvalActions, setAllEvalActions] = useState(null);

  // Loading & Toast State
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const addToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  const handleOpenStudentWorkspace = useCallback((studentId, targetTab = 'overview') => {
    setWorkspaceStudentId(studentId);
    setWorkspaceInitialTab(targetTab || 'overview');
  }, []);

  // 1. Fetch Profile & Panels
  const fetchFacultyProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/profile`, { headers: authHeaders });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (res.status === 403) {
        setAssignedPanels([]);
        setHasActiveAssignment(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.faculty || null);
        setProfile(data.profile || null);
        setActiveBatches(data.active_batches || []);
        setHasActiveAssignment(data.has_active_assignment !== false);

        const allAssigned = data.all_assigned_panels || data.assigned_panels || [];
        if (allAssigned.length > 0) {
          setAssignedPanels(allAssigned);
          // Check query params for specific workspace selection
          const urlParams = new URLSearchParams(window.location.search);
          const qBatchId = urlParams.get('batch_id');
          const qPanelId = urlParams.get('panel_id');
          let matched = null;
          if (qBatchId && qPanelId) {
            matched = allAssigned.find(p => String(p.ri_batch_id) === String(qBatchId) && String(p.ri_panel_id) === String(qPanelId));
          } else if (qPanelId) {
            matched = allAssigned.find(p => String(p.ri_panel_id) === String(qPanelId));
          } else if (qBatchId) {
            matched = allAssigned.find(p => String(p.ri_batch_id) === String(qBatchId));
          }
          const defaultPanel = matched || allAssigned[0];
          setSelectedBatchId(defaultPanel.ri_batch_id);
          setSelectedPanelId(defaultPanel.ri_panel_id);

          const newUrl = `${window.location.pathname}?batch_id=${defaultPanel.ri_batch_id}&panel_id=${defaultPanel.ri_panel_id}`;
          window.history.replaceState(null, '', newUrl);
          localStorage.setItem('ri_active_workspace', JSON.stringify({
            ...defaultPanel,
            batch_id: defaultPanel.ri_batch_id,
            panel_id: defaultPanel.ri_panel_id,
            type: 'faculty'
          }));
        }

        // Check eligibility for Switch Workspace
        try {
          const wsRes = await fetch(`${API}/api/ri/workspaces/my-assignments`, { headers: authHeaders });
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            const isAdmin = Boolean(wsData.is_admin);
            const nodalCount = wsData.nodal_assignments?.length || 0;
            const facCount = wsData.faculty_assignments?.length || 0;
            const totalCount = wsData.total_count ?? (nodalCount + facCount);

            const distinctBatches = new Set([
              ...(wsData.faculty_assignments || []).map(a => a.batch_id),
              ...(wsData.nodal_assignments || []).map(a => a.batch_id)
            ]);

            // Eligible only if admin, has nodal assignment, or has multiple panels/batches
            const isEligible = isAdmin || nodalCount > 0 || totalCount > 1 || facCount > 1 || distinctBatches.size > 1 || allAssigned.length > 1;
            setCanSwitchWorkspace(isEligible);
          } else {
            setCanSwitchWorkspace(allAssigned.length > 1);
          }
        } catch (wsErr) {
          console.warn('Could not determine workspace switching eligibility:', wsErr);
          setCanSwitchWorkspace(allAssigned.length > 1);
        }
      }
    } catch (err) {
      console.error('Error fetching faculty profile:', err);
      addToast('Failed to load faculty profile', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders, navigate]);

  // Fetch Faculty Undertaking
  const fetchFacultyUndertaking = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/undertaking`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.submitted || data.undertaking?.submitted || data.undertaking?.signed_name) {
          setFacultyUndertaking({
            ...(data.undertaking || {}),
            submitted: true
          });
        } else {
          setFacultyUndertaking(null);
        }
      }
    } catch (err) {
      console.error('Error fetching faculty undertaking:', err);
    } finally {
      setIsUndertakingChecked(true);
    }
  }, [authHeaders]);

  const handleSubmitFacultyUndertaking = async (formData) => {
    setIsSubmittingUndertaking(true);
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/undertaking`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const submittedObj = {
          ...(data.undertaking || {}),
          signed_name: formData.signedName || data.undertaking?.signed_name,
          signed_date: formData.signedDate || data.undertaking?.signed_date,
          status: 'Submitted',
          submitted: true
        };
        setFacultyUndertaking(submittedObj);
        setProfile(prev => prev ? ({ ...prev, ri_undertaking_submitted: true, undertaking_submitted: true }) : prev);
        setShowFacultyGatePopup(false);
        addToast('Faculty Undertaking submitted successfully! Full portal access unlocked.', 'success');
        
        // Refresh both profile and undertaking from backend to synchronize
        await Promise.all([
          fetchFacultyProfile(),
          fetchFacultyUndertaking()
        ]);

        // Auto-fetch dashboard and panel details now that backend gate is open
        if (selectedBatchId && selectedPanelId) {
          fetchDashboardData(selectedBatchId, selectedPanelId);
          fetchPanelData(selectedBatchId, selectedPanelId);
        }
      } else {
        throw new Error(data.message || 'Failed to submit undertaking');
      }
    } catch (err) {
      addToast(err.message || 'Failed to submit undertaking', 'error');
      throw err;
    } finally {
      setIsSubmittingUndertaking(false);
    }
  };

  useEffect(() => {
    fetchFacultyProfile();
    fetchFacultyUndertaking();
  }, [fetchFacultyProfile, fetchFacultyUndertaking]);

  // 2. Fetch Dashboard Overview
  const fetchDashboardData = useCallback(async (batchId, panelId) => {
    if (!batchId || !panelId) return;
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/dashboard?batch_id=${batchId}&panel_id=${panelId}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  }, [authHeaders]);

  // 3. Fetch My Panel Detailed Info
  const fetchPanelData = useCallback(async (batchId, panelId) => {
    if (!batchId || !panelId) return;
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/panel?batch_id=${batchId}&panel_id=${panelId}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const data = await res.json();
        setPanelData(data);
      }
    } catch (err) {
      console.error('Error fetching panel data:', err);
    }
  }, [authHeaders]);

  // 4. Fetch Students Roster
  const fetchStudentsData = useCallback(async (batchId, panelId, search = '') => {
    if (!batchId || !panelId) return;
    try {
      const q = new URLSearchParams({ batch_id: String(batchId), panel_id: String(panelId), limit: '100' });
      if (search) q.append('search', search);
      const res = await fetch(`${API}/api/ri/faculty-portal/students?${q.toString()}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setStudentsData(data);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, [authHeaders]);

  // 5. Fetch Attendance (4 Activities Overview & Detail)
  const fetchAttendanceData = useCallback(async (batchId, panelId, activityKey = null, search = '') => {
    if (!batchId || !panelId) return;
    try {
      const q = new URLSearchParams({ batch_id: String(batchId), panel_id: String(panelId) });
      if (activityKey) q.append('activity', activityKey);
      if (search) q.append('search', search);
      const res = await fetch(`${API}/api/ri/faculty-portal/attendance?${q.toString()}`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.activities) {
          const actMap = Array.isArray(data.activities)
            ? data.activities.reduce((acc, a) => ({ ...acc, [a.key]: a }), {})
            : data.activities;
          setAttendanceOverview(actMap);
        }
        if (activityKey || data.students) {
          setAttendanceData(data);
        }
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    }
  }, [authHeaders]);

  // Refetch when batch/panel changes or tab changes
  useEffect(() => {
    if (!selectedBatchId || !selectedPanelId) return;
    if (isUndertakingChecked && !isFacultyUndertakingSubmitted) return;

    // Keep dashboard statistics and deadlines updated across all tabs
    fetchDashboardData(selectedBatchId, selectedPanelId);

    if (activeTab === 'attendance') {
      fetchAttendanceData(selectedBatchId, selectedPanelId, activeActivityKey, attendanceSearch);
    } else if (activeTab === 'students') {
      fetchStudentsData(selectedBatchId, selectedPanelId, directorySearch);
    } else if (activeTab === 'evaluation') {
      fetchPanelData(selectedBatchId, selectedPanelId);
    }
  }, [activeTab, selectedBatchId, selectedPanelId, activeActivityKey, attendanceSearch, directorySearch, fetchDashboardData, fetchAttendanceData, fetchPanelData, fetchStudentsData, isUndertakingChecked, isFacultyUndertakingSubmitted]);

  // Reset check when panel changes so faculty receives the reminder for the active panel on login/open
  useEffect(() => {
    setHasCheckedPendingPopup(false);
  }, [selectedPanelId]);

  // When panel dashboard data loads, show popup if attendance or evaluation has not been completed
  useEffect(() => {
    if (!isFacultyUndertakingSubmitted) return;
    if (!dashboardData || hasCheckedPendingPopup) return;
    const dlData = dashboardData.deadlines;
    const hasPendingAtt = dlData?.show_attendance_reminder ?? (dashboardData.stats?.attendance_completion_percent < 100);
    const hasPendingEval = dlData?.show_evaluation_reminder ?? ((dashboardData.stats?.evaluations_pending || 0) > 0);

    if (hasPendingAtt || hasPendingEval) {
      setShowPendingActionPopup(true);
    }
    setHasCheckedPendingPopup(true);
  }, [dashboardData, hasCheckedPendingPopup, isFacultyUndertakingSubmitted]);

  // Attendance State & Actions
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);

  const isAttendanceLocked = attendanceData
    ? (attendanceData.is_locked === true)
    : (dashboardData?.deadlines?.is_attendance_locked === true);

  const handleOpenActivity = (actKey) => {
    setActiveActivityKey(actKey);
    setAttendanceSearch('');
    if (selectedBatchId && selectedPanelId) {
      fetchAttendanceData(selectedBatchId, selectedPanelId, actKey, '');
    }
  };

  const handleMarkAllActivitiesPresent = async (overwriteAbsent = false) => {
    if (!selectedBatchId || !selectedPanelId) return;
    setIsMarkingAllActivitiesPresent(true);
    try {
      const res = await fetch(`${API}/api/ri/faculty-portal/attendance/mark-all-present`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          batch_id: selectedBatchId,
          panel_id: selectedPanelId,
          overwrite_absent: overwriteAbsent
        })
      });
      const data = await res.json();
      if (data.require_confirmation) {
        setConfirmMarkAllModal({ open: true, absentCount: data.absent_count || 0 });
      } else if (res.ok && data.success) {
        setConfirmMarkAllModal({ open: false, absentCount: 0 });
        addToast(data.message || 'All students marked Present for unlocked activities.', 'success');
        fetchAttendanceData(selectedBatchId, selectedPanelId, activeActivityKey, attendanceSearch);
        fetchDashboardData(selectedBatchId, selectedPanelId);
      } else {
        addToast(data.message || 'Failed to mark all activities present', 'error');
      }
    } catch (err) {
      addToast('Network error while marking attendance', 'error');
    } finally {
      setIsMarkingAllActivitiesPresent(false);
    }
  };

  const handleMarkSingleAttendance = (studentId, status) => {
    if (isAttendanceLocked) {
      addToast('Attendance is locked for this activity and cannot be modified.', 'error');
      return;
    }
    setAttendanceData(prev => {
      if (!prev) return prev;
      const nextStudents = (prev.students || []).map(s => {
        if (s.student_id === studentId) {
          return {
            ...s,
            attendance_status: status,
            marked_by_name: profile?.name || 'You',
            marked_at: new Date().toISOString()
          };
        }
        return s;
      });
      const presentCount = nextStudents.filter(s => s.attendance_status === 'Present').length;
      const absentCount = nextStudents.filter(s => s.attendance_status === 'Absent').length;
      const unmarkedCount = nextStudents.length - presentCount - absentCount;
      const attendancePct = nextStudents.length > 0 ? Math.round((presentCount / nextStudents.length) * 100) : 0;
      return {
        ...prev,
        students: nextStudents,
        summary: {
          total_students: nextStudents.length,
          present_count: presentCount,
          absent_count: absentCount,
          unmarked_count: unmarkedCount,
          attendance_percentage: attendancePct
        }
      };
    });
  };

  const handleBulkMarkAttendance = (status) => {
    if (isAttendanceLocked) {
      addToast('Attendance is locked for this activity and cannot be modified.', 'error');
      return;
    }
    setAttendanceData(prev => {
      if (!prev) return prev;
      const nextStudents = (prev.students || []).map(s => ({
        ...s,
        attendance_status: status,
        marked_by_name: profile?.name || 'You',
        marked_at: new Date().toISOString()
      }));
      const presentCount = status === 'Present' ? nextStudents.length : 0;
      const absentCount = status === 'Absent' ? nextStudents.length : 0;
      const unmarkedCount = nextStudents.length - presentCount - absentCount;
      const attendancePct = status === 'Present' ? 100 : 0;
      return {
        ...prev,
        students: nextStudents,
        summary: {
          total_students: nextStudents.length,
          present_count: presentCount,
          absent_count: absentCount,
          unmarked_count: unmarkedCount,
          attendance_percentage: attendancePct
        }
      };
    });
    addToast(`All students marked as ${status}. Click "Save" or "Save & Lock" to apply.`, 'info');
  };

  const handleSaveAttendance = async (shouldLock = false) => {
    if (!selectedBatchId || !selectedPanelId || !activeActivityKey) return;
    if (isAttendanceLocked && !shouldLock) {
      addToast('Attendance is locked for this activity.', 'error');
      return;
    }
    setIsSavingAttendance(true);
    try {
      const records = (attendanceData?.students || []).map(s => ({
        student_id: s.student_id,
        status: s.attendance_status || 'Present',
        remarks: s.remarks || null
      }));

      const res = await fetch(`${API}/api/ri/faculty-portal/attendance`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          batch_id: selectedBatchId,
          panel_id: selectedPanelId,
          activity: activeActivityKey,
          records,
          action: shouldLock ? 'save_and_lock' : 'save',
          lock: shouldLock
        })
      });

      const d = await res.json();
      if (res.ok && d.success) {
        setShowLockConfirmModal(false);
        const actName = RI_ACTIVITIES_LIST.find(a => a.key === activeActivityKey)?.label || activeActivityKey;
        addToast(
          shouldLock
            ? `Attendance for ${actName} successfully saved & locked.`
            : `Attendance for ${actName} saved successfully (Editable draft).`,
          'success'
        );
        fetchAttendanceData(selectedBatchId, selectedPanelId, activeActivityKey, attendanceSearch);
        fetchDashboardData(selectedBatchId, selectedPanelId);
      } else {
        addToast(d.message || 'Failed to save attendance', 'error');
      }
    } catch (err) {
      addToast('Network error saving attendance', 'error');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const handleDownloadAttendanceExcel = async () => {
    if (!selectedBatchId || !selectedPanelId) return;
    setIsDownloadingAttendanceExcel(true);
    try {
      const q = new URLSearchParams({ batch_id: String(selectedBatchId), panel_id: String(selectedPanelId) });
      if (activeActivityKey) q.append('activity', activeActivityKey);
      const res = await fetch(`${API}/api/ri/faculty-portal/attendance/excel?${q.toString()}`, {
        headers: { Authorization: authHeaders.Authorization }
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RI_Attendance_Panel_${selectedPanelId}${activeActivityKey ? `_${activeActivityKey}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast('Attendance Excel downloaded successfully.', 'success');
    } catch (err) {
      addToast('Failed to download Attendance Excel', 'error');
    } finally {
      setIsDownloadingAttendanceExcel(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleWorkspaceChange = useCallback((compositeKey) => {
    if (!compositeKey) return;
    const [bIdStr, pIdStr] = compositeKey.split('_');
    const bId = Number(bIdStr);
    const pId = Number(pIdStr);
    const target = assignedPanels.find(p => p.ri_batch_id === bId && p.ri_panel_id === pId);
    if (!target) return;

    setSelectedBatchId(bId);
    setSelectedPanelId(pId);

    const newUrl = `${window.location.pathname}?batch_id=${bId}&panel_id=${pId}`;
    window.history.replaceState(null, '', newUrl);

    localStorage.setItem('ri_active_workspace', JSON.stringify({
      ...target,
      batch_id: bId,
      panel_id: pId,
      type: 'faculty'
    }));
  }, [assignedPanels]);

  const activePanelObj = useMemo(() => {
    return assignedPanels.find(p => p.ri_batch_id === selectedBatchId && p.ri_panel_id === selectedPanelId)
      || assignedPanels.find(p => p.ri_panel_id === selectedPanelId)
      || assignedPanels[0]
      || null;
  }, [assignedPanels, selectedBatchId, selectedPanelId]);

  const handleAllEvalUpdated = useCallback(() => {
    fetchDashboardData(selectedBatchId, selectedPanelId);
    fetchPanelData(selectedBatchId, selectedPanelId);
  }, [selectedBatchId, selectedPanelId, fetchDashboardData, fetchPanelData]);

  // Undertaking Gate: Force 'undertaking' tab when undertaking check completes and is NOT submitted
  useEffect(() => {
    if (isUndertakingChecked && !isFacultyUndertakingSubmitted) {
      if (activeTab !== 'undertaking') {
        setActiveTab('undertaking');
      }
    }
  }, [isUndertakingChecked, isFacultyUndertakingSubmitted, activeTab]);

  // Listen to URL changes/back-forward navigation and enforce gate
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (isUndertakingChecked && !isFacultyUndertakingSubmitted) {
        if (activeTab !== 'undertaking' || (tabParam && tabParam !== 'undertaking')) {
          setActiveTab('undertaking');
          setShowFacultyGatePopup(true);
        }
      } else if (tabParam && tabParam !== activeTab && isFacultyUndertakingSubmitted) {
        setActiveTab(tabParam);
      }
    } catch {}
  }, [isUndertakingChecked, isFacultyUndertakingSubmitted, activeTab]);

  // Automatically close gate popup once undertaking is confirmed submitted
  useEffect(() => {
    if (isFacultyUndertakingSubmitted) {
      setShowFacultyGatePopup(false);
    }
  }, [isFacultyUndertakingSubmitted]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#ECECF1', color: '#0f172a', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      
      {/* ── TOAST NOTIFICATION ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#047857',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── MOBILE NAV BACKDROP ── */}
      <div
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 45,
          opacity: isMobileNavOpen ? 1 : 0,
          pointerEvents: isMobileNavOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease'
        }}
      />

      {/* ── COLLAPSIBLE SIDEBAR ── */}
      <aside
        style={{
          width: isMobile ? 'min(280px, 85vw)' : (isSidebarCollapsed ? '72px' : '260px'),
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 50,
          transition: 'width 0.25s ease, transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          transform: isMobileNavOpen ? 'translateX(0)' : (isMobile ? 'translateX(-100%)' : undefined),
          boxShadow: isMobile && isMobileNavOpen ? '4px 0 25px rgba(0,0,0,0.2)' : 'none'
        }}
        className={isMobileNavOpen ? '' : '-translate-x-full md:translate-x-0'}
      >
        {/* Toggle Button — desktop only */}
        {!isMobile && (
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
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
              cursor: 'pointer',
              zIndex: 60,
              color: '#047857',
              padding: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          >
            {isSidebarCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
          </button>
        )}

        {/* Mobile Close Button — rendered only on mobile drawer */}
        {isMobile && isMobileNavOpen && (
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close sidebar navigation"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 60,
              color: '#475569',
              padding: 0,
              transition: 'all 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* Sidebar Brand Header */}
        <div style={{
          height: '60px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: (!isMobile && isSidebarCollapsed) ? 'center' : 'flex-start',
          padding: (!isMobile && isSidebarCollapsed) ? '0' : '0 18px',
          flexShrink: 0
        }}>
          <img
            src="/ri11.png"
            alt="Rural Immersion Logo"
            onError={e => { e.currentTarget.src = '/ri-logo.png'; }}
            style={{
              height: '34px',
              maxWidth: (!isMobile && isSidebarCollapsed) ? '34px' : '160px',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Faculty Profile Summary Card in Sidebar */}
        {(isMobile || !isSidebarCollapsed) && profile && (
          <div style={{ margin: '10px 12px', padding: '10px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#14532d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.name}
            </div>
            <div style={{ fontSize: '11px', color: '#166534', fontWeight: '600', marginTop: '2px' }}>
              {profile.role || 'Mentor'} • {profile.department || 'Faculty'}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
              {assignedPanels.length} Assigned Panel{assignedPanels.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto' }}>
          {(() => {
            const allNavItems = [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'undertaking', label: 'Undertaking Form', icon: ShieldCheck, badge: isFacultyUndertakingSubmitted ? { text: 'Signed', bg: '#dcfce7', color: '#15803d' } : { text: 'Pending', bg: '#fef3c7', color: '#b45309' } },
              { id: 'attendance', label: 'RI Attendance', icon: ClipboardCheck },
              { id: 'all-eval', label: 'All Eval', icon: Table2 },
              { id: 'evaluation', label: 'RI Evaluation', icon: Award },
              { id: 'uploads', label: 'Uploads', icon: UploadCloud },
              { id: 'village', label: 'My Village', icon: MapPin },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'redflags', label: 'Red Flags', icon: AlertTriangle },
              { id: 'orangeflags', label: 'Orange Flags', icon: Flag },
              { id: 'schedule', label: 'Schedule', icon: Calendar },
              { id: 'support', label: 'Support Tickets', icon: LifeBuoy },
              { id: 'settings', label: 'Settings', icon: Settings }
            ];

            const displayedNavItems = isFacultyUndertakingSubmitted
              ? allNavItems
              : allNavItems.filter(item => item.id === 'undertaking');

            return displayedNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileNavOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: (!isMobile && isSidebarCollapsed) ? '10px 0' : '9px 12px',
                    justifyContent: (!isMobile && isSidebarCollapsed) ? 'center' : 'flex-start',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isActive ? '#047857' : 'transparent',
                    color: isActive ? '#ffffff' : '#475569',
                    fontWeight: isActive ? '600' : '500',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: '1px'
                  }}
                  title={(!isMobile && isSidebarCollapsed) ? item.label : undefined}
                >
                  <Icon size={16} style={{ flexShrink: 0, color: isActive ? '#ffffff' : '#047857' }} />
                  {(isMobile || !isSidebarCollapsed) && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          backgroundColor: item.badge.bg,
                          color: item.badge.color,
                          marginLeft: '6px',
                          flexShrink: 0
                        }}>
                          {item.badge.text}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            });
          })()}
        </nav>

        {/* Sidebar Footer — Profile + Logout */}
        <div style={{ padding: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(isMobile || !isSidebarCollapsed) && profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 4px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={14} color="#ffffff" />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.name}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Faculty Mentor</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign Out"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%'
            }}
          >
            <LogOut size={13} style={{ flexShrink: 0 }} />
            {(isMobile || !isSidebarCollapsed) && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowX: 'hidden' }}
        className={isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'}
      >
        
        {/* Top Header Bar — GREEN like RI Admin */}
        <header style={{
          height: isMobile ? 'calc(60px + env(safe-area-inset-top, 0px))' : '60px',
          backgroundColor: '#047857',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : '0px',
          paddingBottom: '0px',
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: isMobile ? 'max(12px, env(safe-area-inset-right, 0px))' : '20px',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          flexShrink: 0,
          boxSizing: 'border-box'
        }}>
          {/* Header Left: Hamburger Toggle (Mobile) + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', minWidth: 0, flex: 1, marginRight: '8px' }}>
            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(prev => !prev)}
              className="md:hidden"
              style={{
                width: '38px',
                height: '38px',
                display: isMobile ? 'inline-flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.16)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: '8px',
                color: '#ffffff',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
                outline: 'none',
                transition: 'background-color 0.15s ease, transform 0.1s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.26)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)'}
              aria-label={isMobileNavOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              aria-expanded={isMobileNavOpen}
              title={isMobileNavOpen ? 'Close Menu' : 'Open Menu'}
            >
              {isMobileNavOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
            </button>

            <h1 style={{
              fontSize: isMobile ? '14px' : '15px',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
              flexShrink: 1
            }}>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'undertaking' && 'Faculty Undertaking Form'}
              {activeTab === 'attendance' && 'Panel Attendance'}
              {activeTab === 'all-eval' && 'All Students Evaluation (Bulk Table)'}
              {activeTab === 'evaluation' && 'RI Evaluation'}
              {(activeTab === 'uploads' || activeTab === 'media') && 'Field Uploads (Photos & GP Certificate)'}
              {activeTab === 'village' && 'My Village'}
              {activeTab === 'students' && 'Students Directory'}
              {activeTab === 'redflags' && 'Student Red Flags'}
              {activeTab === 'orangeflags' && 'Student Orange Flags'}
              {activeTab === 'schedule' && 'Immersion Schedule'}
              {activeTab === 'support' && 'Support Tickets'}
              {activeTab === 'settings' && 'Account Settings & Security'}
            </h1>
          </div>

          {/* Header Right: Switch Workspace + Panel Selector (on desktop) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Switch Workspace Button - Visible only if faculty is eligible and undertaking is submitted */}
            {isFacultyUndertakingSubmitted && canSwitchWorkspace && (
              <button
                type="button"
                onClick={() => navigate('/ri-workspaces')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  minHeight: '36px',
                  borderRadius: '7px',
                  border: '1px solid rgba(255,255,255,0.25)',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.24)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
                title="Switch to another assigned workspace"
                aria-label="Switch workspace"
              >
                <ArrowLeftRight size={13} style={{ flexShrink: 0 }} />
                <span>Switch<span className="hidden sm:inline"> Workspace</span></span>
              </button>
            )}

            {/* Quick selector in header — desktop only, visible when undertaking is submitted */}
            {isFacultyUndertakingSubmitted && assignedPanels.length > 1 && (
              <div className="hidden md:block">
                <select
                  value={`${selectedBatchId}_${selectedPanelId}`}
                  onChange={e => handleWorkspaceChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '7px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    maxWidth: '260px',
                    outline: 'none'
                  }}
                  title="Switch assigned batch or panel"
                >
                  {assignedPanels.map(p => (
                    <option
                      key={`${p.ri_batch_id}_${p.ri_panel_id}`}
                      value={`${p.ri_batch_id}_${p.ri_panel_id}`}
                      style={{ backgroundColor: '#065f46', color: '#ffffff' }}
                    >
                      {p.batch_name || `Batch ${p.ri_batch_id}`} — {cleanPanelName(p.panel_name || p.name)} {p.village_name ? `(${p.village_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        {/* Dedicated Batch & Panel Workspace Selector Bar */}
        {assignedPanels.length > 0 && isFacultyUndertakingSubmitted && (
          <div style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: isMobile ? '10px 14px' : '10px 20px',
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '10px' : '14px',
            boxSizing: 'border-box',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            {/* Left group: Batch & Panel Details */}
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px'
                  }}>
                    Batch &amp; Panel
                  </span>
                  {assignedPanels.length > 1 && (
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      color: '#475569'
                    }}>
                      • {assignedPanels.length} Panels
                    </span>
                  )}
                </div>
                {activePanelObj && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    minWidth: 0
                  }}>
                    <span style={{
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: '700',
                      color: '#0f172a'
                    }}>
                      {cleanPanelName(activePanelObj.panel_name || activePanelObj.name)}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '11px', userSelect: 'none' }}>•</span>
                    <span style={{
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '600',
                      color: '#334155'
                    }}>
                      {activePanelObj.batch_name || `Batch ${selectedBatchId}`}
                    </span>
                    {activePanelObj.village_name && (
                      <span style={{
                        fontSize: isMobile ? '12px' : '12.5px',
                        color: '#64748b'
                      }}>
                        ({activePanelObj.village_name})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right group: All Eval Action Buttons + Batch/Panel Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              {activeTab === 'all-eval' && allEvalActions && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (allEvalActions.refresh) allEvalActions.refresh();
                    }}
                    disabled={allEvalActions.loading}
                    title="Refresh evaluations from server"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 11px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: allEvalActions.loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={allEvalActions.loading ? 'spin' : ''} />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (allEvalActions.exportExcel) allEvalActions.exportExcel();
                    }}
                    disabled={allEvalActions.downloadingExcel}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 11px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#15803d',
                      cursor: allEvalActions.downloadingExcel ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Download size={13} />
                    {allEvalActions.downloadingExcel ? 'Exporting...' : 'Export Excel'}
                  </button>

                  {!allEvalActions.isLocked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (allEvalActions.saveAll) allEvalActions.saveAll();
                      }}
                      disabled={allEvalActions.savingAll}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        backgroundColor: allEvalActions.dirtyCount > 0 ? '#2563eb' : '#0f172a',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#ffffff',
                        cursor: allEvalActions.savingAll ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Save size={14} />
                      {allEvalActions.savingAll ? 'Saving...' : allEvalActions.dirtyCount > 0 ? `Save All (${allEvalActions.dirtyCount})` : 'Save All'}
                    </button>
                  )}
                </div>
              )}

              {/* Batch & Panel Selector Dropdown (full-width on mobile, auto/min-width on desktop) */}
              {assignedPanels.length > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: isMobile ? '100%' : 'auto',
                  minWidth: isMobile ? '100%' : '260px',
                  flexShrink: 0
                }}>
                  <select
                    value={`${selectedBatchId}_${selectedPanelId}`}
                    onChange={e => handleWorkspaceChange(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '7px 12px',
                      fontSize: isMobile ? '13px' : '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      outline: 'none',
                      boxSizing: 'border-box',
                      minHeight: '36px',
                      transition: 'border-color 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                    title="Switch assigned batch or panel"
                    onFocus={e => e.currentTarget.style.borderColor = '#047857'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    {assignedPanels.map(p => (
                      <option
                        key={`${p.ri_batch_id}_${p.ri_panel_id}`}
                        value={`${p.ri_batch_id}_${p.ri_panel_id}`}
                      >
                        {p.batch_name || `Batch ${p.ri_batch_id}`} — {cleanPanelName(p.panel_name || p.name)} {p.village_name ? `(${p.village_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <main style={{ flex: 1, padding: isMobile ? '12px' : '16px 20px', overflowY: 'auto' }}>
          
          {/* If No Faculty Panels Assigned */}
          {!isLoading && assignedPanels.length === 0 && (
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
                No Assigned Faculty Panels Found
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '500px', margin: '0 auto 16px auto', lineHeight: '1.5' }}>
                Your account ({currentUser?.email || profile?.email}) is not mapped as an accompanying faculty mentor to any active Rural Immersion panel.
              </p>
              {canSwitchWorkspace && (
                <button
                  type="button"
                  onClick={() => navigate('/ri-workspaces')}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Switch Workspace
                </button>
              )}
            </div>
          )}

          {/* Action Required: Undertaking Pending Banner */}
          {assignedPanels.length > 0 && !isFacultyUndertakingSubmitted && (
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlertCircle size={20} color="#d97706" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400e' }}>
                    Action Required: Faculty Undertaking Form Pending
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#b45309', marginTop: '2px' }}>
                    Please review and digitally sign the official Rural Immersion Faculty Undertaking &amp; Code of Conduct.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('undertaking')}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)'
                }}
              >
                <ShieldCheck size={16} />
                <span>Sign Undertaking Now</span>
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: DASHBOARD                                                 */}
          {/* ================================================================ */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 4 Stat Cards — Compact, Clean University Portal Cards with Dotted Design */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
                {[
                  {
                    label: 'TOTAL PANEL STUDENTS',
                    value: dashboardData?.stats?.total_students ?? (panelData?.students?.length || 0),
                    sub: 'Assigned panel roster',
                    icon: Users,
                    color: '#047857',
                    iconBg: '#ecfdf5',
                    iconBorder: '#a7f3d0'
                  },
                  {
                    label: 'OVERALL ATTENDANCE',
                    value: `${dashboardData?.stats?.overall_attendance_pct ?? 0}%`,
                    sub: 'Across 4 immersion activities',
                    icon: ClipboardCheck,
                    color: '#2563eb',
                    iconBg: '#eff6ff',
                    iconBorder: '#bfdbfe'
                  },
                  {
                    label: 'ACTIVITIES LOCKED',
                    value: `${Object.values(dashboardData?.activities || {}).filter(a => a.is_locked).length}/4 Locked`,
                    sub: 'Faculty locked activities',
                    icon: Lock,
                    color: '#d97706',
                    iconBg: '#fffbeb',
                    iconBorder: '#fde68a'
                  },
                  {
                    label: 'EVALUATIONS COMPLETED',
                    value: dashboardData?.stats?.evaluations_completed ?? 0,
                    sub: `${dashboardData?.stats?.total_students ?? (panelData?.students?.length || 0)} total panel students`,
                    icon: Award,
                    color: '#7c3aed',
                    iconBg: '#f5f3ff',
                    iconBorder: '#ddd6fe'
                  },
                  {
                    label: 'FIELD UPLOADS',
                    value: 'Photos & Certificate',
                    sub: 'Photos (max 5) & GP Certificate',
                    icon: UploadCloud,
                    color: '#059669',
                    iconBg: '#ecfdf5',
                    iconBorder: '#a7f3d0',
                    isClickable: true,
                    onClick: () => setActiveTab('uploads')
                  }
                ].map((card, idx) => {
                  const CardIcon = card.icon;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '102px',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                        cursor: card.onClick ? 'pointer' : 'default'
                      }}
                      onClick={card.onClick}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.06)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                        <span style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                          {card.label}
                        </span>
                        <div style={{
                          width: '30px', height: '30px', background: card.iconBg, borderRadius: '8px',
                          border: `1px solid ${card.iconBorder}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <CardIcon size={15} color={card.color} strokeWidth={2.4} />
                        </div>
                      </div>

                      {/* Value */}
                      <div style={{ margin: '6px 0 2px 0', zIndex: 2 }}>
                        <h3 style={{
                          fontSize: '24px',
                          fontWeight: '850',
                          color: '#0f172a',
                          margin: 0,
                          lineHeight: 1.15,
                          letterSpacing: '-0.3px'
                        }}>
                          {card.value}
                        </h3>
                      </div>

                      {/* Footer subtext */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px', zIndex: 2 }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                          {card.sub}
                        </span>
                      </div>

                      {/* Dot Grid Watermark & Glow */}
                      <div style={{ 
                        position: 'absolute', 
                        bottom: 0, 
                        right: 0, 
                        width: '100px', 
                        height: '80px', 
                        background: `radial-gradient(circle at bottom right, ${card.color}15, transparent 70%)`,
                        pointerEvents: 'none',
                        zIndex: 1
                      }}>
                        <div style={{
                          width: '100%',
                          height: '100%',
                          backgroundImage: `radial-gradient(${card.color}28 1.5px, transparent 1.5px)`,
                          backgroundSize: '8px 8px',
                          WebkitMaskImage: 'radial-gradient(circle at bottom right, black 25%, transparent 80%)',
                          maskImage: 'radial-gradient(circle at bottom right, black 25%, transparent 80%)'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── RI Schedule Section (Matching RI Admin & Student Panel Design) ── */}
              {(() => {
                const dayPlan = DEFAULT_SCHEDULE.find(d => d.day_number === facultyScheduleDay) || DEFAULT_SCHEDULE[0];
                const activities = dayPlan?.activities || [];
                return (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    padding: '16px 18px',
                    marginBottom: '8px'
                  }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '12px',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '10px'
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

                      <button
                        onClick={() => setActiveTab('schedule')}
                        style={{
                          background: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; }}
                      >
                        Full Schedule →
                      </button>
                    </div>

                    {/* Day Tabs + Activity Count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {DEFAULT_SCHEDULE.map((dObj, idx) => {
                          const d = dObj.day_number || idx + 1;
                          return (
                            <button
                              key={d}
                              onClick={() => setFacultyScheduleDay(d)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '7px',
                                fontSize: '12px',
                                fontWeight: 700,
                                border: '1px solid',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s',
                                background: facultyScheduleDay === d ? '#047857' : '#ffffff',
                                color: facultyScheduleDay === d ? '#ffffff' : '#475569',
                                borderColor: facultyScheduleDay === d ? '#047857' : '#e2e8f0',
                                boxShadow: facultyScheduleDay === d ? '0 1px 4px rgba(4,120,87,0.2)' : 'none'
                              }}
                            >
                              Day {d}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                        Day {facultyScheduleDay} &middot; {activities.length} activities
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
                                <span>{activity.location || activePanelObj?.village_name || 'Allocated Immersion Village'}</span>
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
          {/* TAB: RI FACULTY UNDERTAKING FORM                                */}
          {/* ================================================================ */}
          {activeTab === 'undertaking' && (
            <div style={{ maxWidth: '820px', margin: '0 auto 40px auto', width: '100%' }}>
              {!isFacultyUndertakingSubmitted && (
                <div style={{
                  marginBottom: '20px',
                  padding: '16px 20px',
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #a7f3d0',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 2px 6px rgba(4, 120, 87, 0.05)'
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ShieldCheck size={20} color="#ffffff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#064e3b', marginBottom: '2px' }}>
                      Faculty Undertaking Submission Required
                    </div>
                    <div style={{ fontSize: '13px', color: '#065f46', lineHeight: 1.5 }}>
                      Submission is mandatory to access the RI Faculty Portal. Please review the declaration below and submit your digital signature to unlock the portal dashboard, student rosters, attendance sheet, and evaluation tools.
                    </div>
                  </div>
                </div>
              )}
              <RiUndertakingForm
                role="faculty"
                userInfo={{
                  name: profile?.name || currentUser?.name,
                  department: profile?.department,
                  email: profile?.email || currentUser?.email,
                  phone: profile?.phone || currentUser?.phone,
                  designation: profile?.designation,
                  employee_id: profile?.employee_id || currentUser?.prn,
                  panel: cleanPanelName(activePanelObj?.panel_name || activePanelObj?.name),
                  village: activePanelObj?.village_name,
                  batch: activePanelObj?.batch_name
                }}
                undertakingData={facultyUndertaking}
                isSubmitted={isFacultyUndertakingSubmitted}
                onSubmit={handleSubmitFacultyUndertaking}
                isSubmitting={isSubmittingUndertaking}
                isMobile={window.innerWidth < 768}
              />
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: RI ATTENDANCE (ACTIVITY-WISE: 4 MANDATORY ACTIVITIES)     */}
          {/* ================================================================ */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ── CASE A: 4 ACTIVITIES OVERVIEW (INITIAL PAGE) ── */}
              {activeActivityKey === null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Top Bar: Title & Compact Mark All Action */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: isMobile ? '12px 14px' : '16px 20px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'stretch' : 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    <div>
                      <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {activePanelObj?.batch_name} • {cleanPanelName(activePanelObj?.panel_name || activePanelObj?.name)}
                      </div>
                      <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '800', color: '#0f172a', margin: '2px 0 0 0' }}>
                        Rural Immersion Activities
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: isMobile ? '11px' : '12px', color: '#64748b' }}>
                        Track and mark student participation across the 4 mandatory field activities.
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                      {/* Compact "Mark All Activities Present" button */}
                      <button
                        type="button"
                        onClick={() => handleMarkAllActivitiesPresent(false)}
                        disabled={isMarkingAllActivitiesPresent || isAttendanceLocked}
                        style={{
                          height: '38px',
                          flex: isMobile ? '1 1 auto' : 'initial',
                          padding: '0 14px',
                          backgroundColor: '#047857',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: isMobile ? '12px' : '12.5px',
                          fontWeight: '700',
                          cursor: isMarkingAllActivitiesPresent ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
                          opacity: isMarkingAllActivitiesPresent ? 0.7 : 1,
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <CheckCheck size={15} />
                        <span>{isMarkingAllActivitiesPresent ? 'Marking...' : 'Mark All Activities Present'}</span>
                      </button>

                      {/* Download Excel */}
                      <button
                        type="button"
                        onClick={handleDownloadAttendanceExcel}
                        disabled={isDownloadingAttendanceExcel}
                        style={{
                          height: '38px',
                          padding: '0 12px',
                          backgroundColor: '#ffffff',
                          color: '#047857',
                          border: '1.5px solid #047857',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: isDownloadingAttendanceExcel ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Download size={13} />
                        <span>{isDownloadingAttendanceExcel ? 'Exporting...' : 'Export Excel'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Activity Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: isMobile ? '12px' : '16px'
                  }}>
                    {RI_ACTIVITIES_LIST.map((act) => {
                      const actStats = (
                        attendanceOverview && typeof attendanceOverview === 'object' && !Array.isArray(attendanceOverview)
                          ? attendanceOverview[act.key]
                          : (Array.isArray(attendanceOverview) ? attendanceOverview.find(a => a.key === act.key) : null)
                      ) || {
                        present_count: 0,
                        absent_count: 0,
                        unmarked_count: 0,
                        total_students: studentsData?.students?.length || 0,
                        attendance_percentage: 0,
                        is_locked: false
                      };
                      const totalSt = actStats.total_students || studentsData?.students?.length || 0;
                      const presCount = actStats.present_count || 0;
                      const pct = totalSt > 0 ? Math.round((presCount / totalSt) * 100) : (actStats.attendance_percentage || 0);
                      const isLocked = actStats.is_locked === true;

                      return (
                        <div
                          key={act.key}
                          style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: isMobile ? '14px 16px' : '18px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '14px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div>
                            {/* Card Top Row: Title + Lock Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '14.5px' : '15.5px', fontWeight: '800', color: '#0f172a' }}>
                                {act.label}
                              </h4>
                              {isLocked ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2.5px 7px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  fontSize: '10.5px',
                                  fontWeight: '800',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <Lock size={10} /> Locked
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  padding: '2.5px 7px',
                                  borderRadius: '4px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <Unlock size={10} /> Editable
                                </span>
                              )}
                            </div>

                            {/* Stats Display */}
                            <div style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #f1f5f9',
                              borderRadius: '8px',
                              padding: '10px 12px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div>
                                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
                                    {presCount}
                                  </span>
                                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                                    {' '}/ {totalSt} Present
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '12.5px',
                                  fontWeight: '800',
                                  color: pct >= 80 ? '#047857' : (pct >= 50 ? '#d97706' : '#dc2626')
                                }}>
                                  {pct}%
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(100, pct)}%`,
                                  height: '100%',
                                  backgroundColor: pct >= 80 ? '#047857' : (pct >= 50 ? '#d97706' : '#dc2626'),
                                  borderRadius: '999px',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                                <span>Absent: <strong style={{ color: '#dc2626' }}>{actStats.absent_count || 0}</strong></span>
                                <span>Unmarked: <strong style={{ color: '#64748b' }}>{actStats.unmarked_count || Math.max(0, totalSt - presCount - (actStats.absent_count || 0))}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Open Button (Compact, ~38px) */}
                          <button
                            type="button"
                            onClick={() => handleOpenActivity(act.key)}
                            style={{
                              height: '38px',
                              width: '100%',
                              backgroundColor: '#047857',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>Open</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ) : (
                /* ── CASE B: SPECIFIC ACTIVITY ATTENDANCE DETAIL VIEW ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Top Bar with Back Button, Activity Name & Lock Status */}
                  {/* Top Bar in One Line with Small Back Button, Activity Name, and Red Locked / Editable badge */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveActivityKey(null);
                          setAttendanceSearch('');
                          if (selectedBatchId && selectedPanelId) {
                            fetchAttendanceData(selectedBatchId, selectedPanelId, null, '');
                          }
                        }}
                        style={{
                          height: '32px',
                          padding: '0 10px',
                          backgroundColor: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        <ArrowLeft size={13} />
                        <span>{isMobile ? 'Back' : 'Back to Activities'}</span>
                      </button>

                      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '800', color: '#0f172a' }}>
                          {RI_ACTIVITIES_LIST.find(a => a.key === activeActivityKey)?.label || activeActivityKey}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }} className="hidden sm:inline">
                          ({cleanPanelName(activePanelObj?.panel_name || activePanelObj?.name)})
                        </span>
                      </div>
                    </div>

                    {/* Lock / Editable Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isAttendanceLocked ? (
                        <span style={{
                          color: '#b91c1c',
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fca5a5',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          LOCKED
                        </span>
                      ) : attendanceData?.is_temp_unlocked ? (
                        <span style={{
                          color: '#0369a1',
                          backgroundColor: '#e0f2fe',
                          border: '1px solid #7dd3fc',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          TEMP UNLOCKED
                        </span>
                      ) : (
                        <span style={{
                          color: '#15803d',
                          backgroundColor: '#dcfce7',
                          border: '1px solid #86efac',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          EDITABLE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informative Banner for Temporary Unlock or Lock Reason */}
                  {attendanceData?.is_temp_unlocked && attendanceData?.unlocked_until && (
                    <div style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '9px 13px',
                      fontSize: '12px',
                      color: '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Clock size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Temporary Unlock Active:</strong> Superadmin has temporarily unlocked attendance for this activity until{' '}
                        <strong>
                          {new Date(attendanceData.unlocked_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 23:59:59
                        </strong>. You may edit and save attendance until this expiry passes.
                      </span>
                    </div>
                  )}

                  {isAttendanceLocked && attendanceData?.lock_reason && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      padding: '9px 13px',
                      fontSize: '12px',
                      color: '#991b1b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Lock size={16} color="#dc2626" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Attendance Locked:</strong> {attendanceData.lock_reason}
                      </span>
                    </div>
                  )}

                  {/* 5 Compact Statistic Cards (1 Row on Desktop, 2-Col on Mobile) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
                    gap: '10px'
                  }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>TOTAL ENROLLED</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                        {attendanceData?.summary?.total_students || 0}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.3px' }}>PRESENT (P)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>
                        {attendanceData?.summary?.present_count || 0}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.3px' }}>ABSENT (A)</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                        {attendanceData?.summary?.absent_count || 0}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>UNMARKED</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>
                        {attendanceData?.summary?.unmarked_count || 0}
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      gridColumn: isMobile ? 'span 2' : 'auto'
                    }}>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>ATTENDANCE %</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>
                        {attendanceData?.summary?.attendance_percentage || 0}%
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}>
                    {/* Search */}
                    <div style={{ position: 'relative', minWidth: '180px', flex: 1, maxWidth: '320px' }}>
                      <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Search student name, PRN..."
                        value={attendanceSearch}
                        onChange={e => setAttendanceSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 30px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          outline: 'none',
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>

                    {/* Compact Controls */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      {!isAttendanceLocked && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBulkMarkAttendance('Present')}
                            disabled={isSavingAttendance || isUpdatingAttendance}
                            style={{
                              height: '38px',
                              padding: '0 12px',
                              borderRadius: '6px',
                              border: '1px solid #bbf7d0',
                              backgroundColor: '#f0fdf4',
                              color: '#15803d',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Mark All Present
                          </button>

                          <button
                            type="button"
                            onClick={() => handleBulkMarkAttendance('Absent')}
                            disabled={isSavingAttendance || isUpdatingAttendance}
                            style={{
                              height: '38px',
                              padding: '0 12px',
                              borderRadius: '6px',
                              border: '1px solid #fecaca',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Mark All Absent
                          </button>

                          {/* Save Button (~40px) */}
                          <button
                            type="button"
                            onClick={() => handleSaveAttendance(false)}
                            disabled={isSavingAttendance}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              borderRadius: '6px',
                              border: '1.5px solid #047857',
                              backgroundColor: '#ffffff',
                              color: '#047857',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: isSavingAttendance ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              opacity: isSavingAttendance ? 0.7 : 1
                            }}
                          >
                            <CheckCircle size={14} />
                            <span>{isSavingAttendance ? 'Saving...' : 'Save'}</span>
                          </button>

                          {/* Save & Lock Button (~40px) */}
                          <button
                            type="button"
                            onClick={() => setShowLockConfirmModal(true)}
                            disabled={isSavingAttendance}
                            style={{
                              height: '38px',
                              padding: '0 16px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#d97706',
                              color: '#ffffff',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: isSavingAttendance ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(217, 119, 6, 0.2)'
                            }}
                          >
                            <Lock size={14} />
                            <span>Save & Lock</span>
                          </button>
                        </>
                      )}

                      {/* Download Activity Excel */}
                      <button
                        type="button"
                        onClick={handleDownloadAttendanceExcel}
                        disabled={isDownloadingAttendanceExcel}
                        style={{
                          height: '38px',
                          padding: '0 14px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#047857',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Download size={13} />
                        <span>{isDownloadingAttendanceExcel ? 'Exporting...' : 'Export Excel'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Student Attendance Roster Table */}
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: isMobile ? '340px' : '520px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '700' }}>
                            <th style={{ padding: '10px 12px' }}>Student Name &amp; PRN</th>
                            <th style={{ padding: '10px 8px', width: isMobile ? '76px' : '88px', textAlign: 'center' }}>Mark</th>
                            <th style={{ padding: '10px 8px', width: isMobile ? '64px' : '76px', textAlign: 'center' }}>Status</th>
                            <th style={{ padding: '10px 8px', width: '36px', textAlign: 'center' }} className="hidden sm:table-cell">#</th>
                            <th style={{ padding: '10px 10px' }} className="hidden sm:table-cell">Dept / Div</th>
                            <th style={{ padding: '10px 10px' }} className="hidden md:table-cell">Marked By</th>
                            <th style={{ padding: '10px 10px' }} className="hidden md:table-cell">At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(attendanceData?.students || []).length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                                No students found in this panel.
                              </td>
                            </tr>
                          ) : (
                            (attendanceData?.students || []).map((s, idx) => {
                              const isP = s.attendance_status === 'Present';
                              const isA = s.attendance_status === 'Absent';
                              return (
                                <tr key={s.student_id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                  {/* Col 1: Student Name & PRN */}
                                  <td style={{ padding: '9px 12px' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px' }}>{s.student_name}</div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                      {s.prn || '—'}{s.roll_number ? ` • ${s.roll_number}` : ''}
                                    </div>
                                  </td>

                                  {/* Col 2: Quick P / A Action Buttons */}
                                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleMarkSingleAttendance(s.student_id, 'Present')}
                                        disabled={isAttendanceLocked}
                                        title="Mark Present"
                                        style={{
                                          width: isMobile ? '28px' : '26px',
                                          height: isMobile ? '28px' : '26px',
                                          borderRadius: '6px',
                                          border: `1.5px solid ${isP ? '#047857' : '#cbd5e1'}`,
                                          backgroundColor: isP ? '#047857' : '#ffffff',
                                          color: isP ? '#ffffff' : '#047857',
                                          fontWeight: '800',
                                          fontSize: '11px',
                                          cursor: isAttendanceLocked ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        P
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleMarkSingleAttendance(s.student_id, 'Absent')}
                                        disabled={isAttendanceLocked}
                                        title="Mark Absent"
                                        style={{
                                          width: isMobile ? '28px' : '26px',
                                          height: isMobile ? '28px' : '26px',
                                          borderRadius: '6px',
                                          border: `1.5px solid ${isA ? '#dc2626' : '#cbd5e1'}`,
                                          backgroundColor: isA ? '#dc2626' : '#ffffff',
                                          color: isA ? '#ffffff' : '#dc2626',
                                          fontWeight: '800',
                                          fontSize: '11px',
                                          cursor: isAttendanceLocked ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        A
                                      </button>
                                    </div>
                                  </td>

                                  {/* Col 3: Status Badge */}
                                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                    <span
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: '700',
                                        padding: '2.5px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: isP ? '#dcfce7' : isA ? '#fee2e2' : '#f1f5f9',
                                        color: isP ? '#15803d' : isA ? '#dc2626' : '#64748b'
                                      }}
                                    >
                                      {s.attendance_status || '—'}
                                    </span>
                                  </td>

                                  {/* Col 4: # index (hidden on small mobile) */}
                                  <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b', fontSize: '11.5px' }} className="hidden sm:table-cell">
                                    {idx + 1}
                                  </td>

                                  {/* Col 5: Dept / Div */}
                                  <td style={{ padding: '9px 10px', color: '#475569' }} className="hidden sm:table-cell">
                                    <div style={{ fontSize: '12px' }}>{s.department || '—'}</div>
                                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>Div {s.division || 'A'}</div>
                                  </td>

                                  {/* Col 6: Marked By */}
                                  <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '11.5px' }} className="hidden md:table-cell">
                                    {s.marked_by_name || s.marked_by_email || '—'}
                                  </td>

                                  {/* Col 7: Marked At */}
                                  <td style={{ padding: '9px 10px', color: '#64748b', fontSize: '11px' }} className="hidden md:table-cell">
                                    {s.marked_at ? new Date(s.marked_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}


          {/* ================================================================ */}
          {/* TAB: ALL EVAL (BULK TABLE EVALUATION)                            */}
          {/* ================================================================ */}
          {activeTab === 'all-eval' && (
            <RiAllEvaluationTab
              batchId={selectedBatchId}
              panelId={selectedPanelId}
              deadlines={dashboardData?.deadlines}
              onEvaluationUpdated={handleAllEvalUpdated}
              onNavigateToAttendance={() => setActiveTab('attendance')}
              authHeaders={authHeaders}
              onOpenWorkspace={handleOpenStudentWorkspace}
              addToast={addToast}
              isMobile={isMobile}
              onRegisterActions={setAllEvalActions}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 4: RI EVALUATION                                             */}
          {/* ================================================================ */}
          {activeTab === 'evaluation' && (
            <RiEvaluationTab
              batchId={selectedBatchId}
              panelId={selectedPanelId}
              students={panelData?.students || studentsData?.students || []}
              deadlines={dashboardData?.deadlines}
              onEvaluationUpdated={() => {
                fetchDashboardData(selectedBatchId, selectedPanelId);
                fetchPanelData(selectedBatchId, selectedPanelId);
              }}
              onNavigateToAttendance={() => setActiveTab('attendance')}
              authHeaders={authHeaders}
              onOpenWorkspace={handleOpenStudentWorkspace}
              addToast={addToast}
            />
          )}

          {/* ================================================================ */}
          {/* TAB: FIELD UPLOADS (MAX 5 PHOTOS + GP CERTIFICATE)               */}
          {/* ================================================================ */}
          {(activeTab === 'uploads' || activeTab === 'media') && (
            <RiFacultyUploadsTab
              selectedBatchId={selectedBatchId}
              selectedPanelId={selectedPanelId}
              panelData={panelData}
              isMobile={isMobile}
              addToast={addToast}
            />
          )}

          {/* ================================================================ */}
          {/* TAB 5: MY VILLAGE                                                */}
          {/* ================================================================ */}
          {activeTab === 'village' && (
            <RiVillageTab
              profileData={{
                village: panelData?.panel || activePanelObj || {}
              }}
              apiEndpoint={`${API}/api/ri/faculty-portal/village-services?batch_id=${selectedBatchId || ''}&panel_id=${selectedPanelId || ''}`}
              isMobile={isMobile}
            />
          )}



          {/* ================================================================ */}
          {/* TAB 6: STUDENTS DIRECTORY                                        */}
          {/* ================================================================ */}
          {activeTab === 'students' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Search Bar */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '340px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search students in this panel..."
                    value={directorySearch}
                    onChange={e => setDirectorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 30px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                  {(studentsData?.students || []).length} Students
                </div>
              </div>

              {/* Table */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '480px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '700' }}>
                        <th style={{ padding: '9px 12px' }}>#</th>
                        <th style={{ padding: '9px 12px' }}>Student Name</th>
                        <th style={{ padding: '9px 12px' }}>PRN</th>
                        <th style={{ padding: '9px 12px' }} className="hidden sm:table-cell">Department</th>
                        <th style={{ padding: '9px 12px' }} className="hidden sm:table-cell">Div</th>
                        <th style={{ padding: '9px 12px' }} className="hidden md:table-cell">Gender</th>
                        <th style={{ padding: '9px 12px' }} className="hidden md:table-cell">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(studentsData?.students || []).map((s, idx) => (
                        <tr key={s.student_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{s.name || s.student_name}</td>
                          <td style={{ padding: '10px 12px', color: '#334155', fontWeight: '600' }}>{s.prn}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }} className="hidden sm:table-cell">{s.department || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }} className="hidden sm:table-cell">{s.division || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#475569' }} className="hidden md:table-cell">{s.gender || '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }} className="hidden md:table-cell">{s.phone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 8: SCHEDULE (EXACT UI MATCHING RI STUDENT PANEL)             */}
          {/* ================================================================ */}
          {activeTab === 'schedule' && (() => {
            const currentDayNum = facultyScheduleDay;
            const currentDayPlan = DEFAULT_SCHEDULE.find(d => (d.day_number || parseInt(d.day.replace(/\D/g, '')) || 1) === currentDayNum) || DEFAULT_SCHEDULE[0];
            const currentActivities = currentDayPlan?.activities || [];

            return (
              <div 
                className="animate-fade-in"
                style={{ 
                  background: '#ffffff',
                  border: '1px solid #e2e8f0', 
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '20px', 
                  padding: isMobile ? '16px' : '24px'
                }} 
              >
                {/* Header Section matching RI Student Schedule */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '850', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.5px' }}>
                      <Calendar size={20} style={{ color: '#047857' }} />
                      RI Schedule
                    </h3>
                    <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
                      Daily agenda, activities, venues &amp; details
                    </p>
                  </div>
                </div>

                {/* Day Selection Tabs & Activity Counter */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {DEFAULT_SCHEDULE.map((dObj, idx) => {
                      const d = dObj.day_number || idx + 1;
                      const isSel = currentDayNum === d;
                      return (
                        <button
                          key={d}
                          onClick={() => setFacultyScheduleDay(d)}
                          style={{
                            padding: isMobile ? '7px 14px' : '8px 20px',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: '750',
                            border: '1px solid',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s',
                            background: isSel ? '#154388' : '#ffffff',
                            color: isSel ? '#ffffff' : '#475569',
                            borderColor: isSel ? '#154388' : '#e2e8f0',
                            boxShadow: isSel ? '0 2px 6px rgba(21, 67, 136, 0.15)' : 'none'
                          }}
                        >
                          Day {d}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>
                    Day {currentDayNum} · {currentActivities.length} activities
                  </div>
                </div>

                {/* Activity Grid List: 4-Column Layout (TIME | ACTIVITY NAME | VENUE & DETAILS | CATEGORY) */}
                <div className="lrp-schedule-container" style={{ marginTop: '4px', overflowX: 'auto' }}>
                  {/* Column Headers */}
                  <div className="lrp-schedule-header">
                    <div>TIME</div>
                    <div>ACTIVITY NAME</div>
                    <div>VENUE &amp; DETAILS</div>
                    <div style={{ textAlign: 'right' }}>CATEGORY</div>
                  </div>

                  {/* Activity Rows */}
                  {currentActivities.map((activity, idx) => {
                    const styles = getRiCategoryStyles(activity.category, activity.type);
                    return (
                      <div key={idx} className="lrp-schedule-row">
                        {/* Column 1: Time Badge */}
                        <div className="lrp-time-column">
                          <span className="lrp-time-pill">
                            <Clock size={13} style={{ color: '#047857', flexShrink: 0 }} />
                            {activity.time}
                          </span>
                        </div>

                        {/* Column 2: Activity Name & Description */}
                        <div className="lrp-activity-column">
                          <span className="lrp-activity-name">{activity.title}</span>
                          {(activity.description || activity.desc) && (
                            <p className="lrp-activity-description">{activity.description || activity.desc}</p>
                          )}
                        </div>

                        {/* Column 3: Venue & Dress/Details */}
                        <div className="lrp-venue-dress-column">
                          <div className="lrp-venue-info">
                            <MapPin size={13} style={{ color: '#047857', flexShrink: 0 }} />
                            <span>{activity.location || activePanelObj?.village_name || 'Allocated Immersion Village'}</span>
                          </div>
                          {(activity.dress || activity.notes || activity.instructions) && (
                            <div className="lrp-dress-info">
                              <Info size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                              <span>{activity.dress || activity.notes || activity.instructions}</span>
                            </div>
                          )}
                        </div>

                        {/* Column 4: Category Badge */}
                        <div className="lrp-badge-column">
                          <span
                            className="lrp-category-pill"
                            style={{
                              color: styles.text,
                              background: styles.bg
                            }}
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

          {/* ================================================================ */}
          {/* TAB 8.5: STUDENT RED FLAGS                                      */}
          {/* ================================================================ */}
          {activeTab === 'redflags' && (
            <RiFacultyRedFlagTab token={localStorage.getItem('token')} isMobile={isMobile} batchId={selectedBatchId} panelId={selectedPanelId} />
          )}

          {/* ================================================================ */}
          {/* TAB 8.6: STUDENT ORANGE FLAGS                                    */}
          {/* ================================================================ */}
          {activeTab === 'orangeflags' && (
            <RiFacultyOrangeFlagTab token={localStorage.getItem('token')} isMobile={isMobile} batchId={selectedBatchId} panelId={selectedPanelId} />
          )}

          {/* ================================================================ */}
          {/* TAB 9: SUPPORT TICKETS & HELPDESK                                */}
          {/* ================================================================ */}
          {activeTab === 'support' && (
            <RiFacultySupportTab token={localStorage.getItem('token')} isMobile={isMobile} />
          )}

          {/* ================================================================ */}
          {/* TAB 10: SETTINGS & PASSWORD RESET                               */}
          {/* ================================================================ */}
          {activeTab === 'settings' && (
            <RiFacultySettingsTab
              token={localStorage.getItem('token')}
              isMobile={isMobile}
              profile={profile}
              currentUser={currentUser}
              addToast={addToast}
            />
          )}

        </main>
      </div>

      {/* ── COMPLETE STUDENT RI PROFILE & EVALUATION WORKSPACE MODAL ── */}
      {workspaceStudentId && (
        <RiStudentWorkspaceModal
          studentId={workspaceStudentId}
          initialTab={workspaceInitialTab}
          batchId={selectedBatchId}
          panelId={selectedPanelId}
          isEvaluationLocked={dashboardData?.deadlines?.is_evaluation_locked}
          authHeaders={authHeaders}
          onClose={() => {
            setWorkspaceStudentId(null);
            if (allEvalActions?.refresh) {
              allEvalActions.refresh();
            }
            if (fetchPanelData && selectedBatchId && selectedPanelId) {
              fetchPanelData(selectedBatchId, selectedPanelId);
            }
          }}
          onEvaluationSaved={() => {
            if (fetchDashboardData && selectedBatchId && selectedPanelId) {
              fetchDashboardData(selectedBatchId, selectedPanelId);
            }
            if (fetchPanelData && selectedBatchId && selectedPanelId) {
              fetchPanelData(selectedBatchId, selectedPanelId);
            }
            if (allEvalActions?.refresh) {
              allEvalActions.refresh();
            }
          }}
          addToast={addToast}
        />
      )}

      {/* ── SAVE & LOCK ATTENDANCE CONFIRMATION MODAL ── */}
      {showLockConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '460px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
                flexShrink: 0
              }}>
                <Lock size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Save & Lock {RI_ACTIVITIES_LIST.find(a => a.key === activeActivityKey)?.label || 'Activity'} Attendance?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  {activePanelObj?.batch_name} • {cleanPanelName(activePanelObj?.panel_name || activePanelObj?.name)}
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: 20 }}>
              Once you lock this activity's attendance, <strong>you will no longer be able to edit or modify it</strong>. Any future modifications will strictly require an administrative unlock from the RI Super Admin.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLockConfirmModal(false)}
                disabled={isSavingAttendance}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
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
                onClick={() => handleSaveAttendance(true)}
                disabled={isSavingAttendance}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSavingAttendance ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Lock size={14} />
                <span>{isSavingAttendance ? 'Locking...' : 'Confirm & Lock'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK ALL ACTIVITIES PRESENT CONFIRMATION MODAL ── */}
      {confirmMarkAllModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                flexShrink: 0
              }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Overwrite Existing Absent Records?
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Mark All Activities Present
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, marginBottom: 20 }}>
              There are currently <strong>{confirmMarkAllModal.absentCount}</strong> student record(s) marked as <strong>ABSENT</strong> across unlocked activities. Marking all present will overwrite these absent records to <strong>PRESENT</strong>. Are you sure you want to proceed?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmMarkAllModal({ open: false, absentCount: 0 })}
                disabled={isMarkingAllActivitiesPresent}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
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
                onClick={() => handleMarkAllActivitiesPresent(true)}
                disabled={isMarkingAllActivitiesPresent}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isMarkingAllActivitiesPresent ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <CheckCircle size={14} />
                <span>{isMarkingAllActivitiesPresent ? 'Marking All...' : 'Confirm & Overwrite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PENDING ATTENDANCE & EVALUATION REMINDER POPUP (ON LOGIN / PANEL OPEN) ── */}
      {(() => {
        const dl = dashboardData?.deadlines;
        const totalStudents = dl?.total_students ?? (dashboardData?.stats?.total_students || 0);
        const totalPossibleSlots = dl?.total_possible_slots ?? (totalStudents * 4);
        const totalMarkedSlots = dl?.total_attendance_marked ?? ((dashboardData?.stats?.total_present || 0) + (dashboardData?.stats?.total_absent || 0));
        const evaluationsCompleted = dl?.evaluations_completed ?? (dashboardData?.stats?.evaluations_completed || 0);

        const isAttendancePending = dl?.show_attendance_reminder ?? (totalStudents > 0 && totalMarkedSlots < totalPossibleSlots);
        const isEvaluationPending = dl?.show_evaluation_reminder ?? (totalStudents > 0 && evaluationsCompleted < totalStudents);
        const isAttendanceDeadLocked = dl?.is_attendance_locked === true;
        const isEvaluationDeadLocked = dl?.is_evaluation_locked === true;
        const daysLeftAttendance = dl?.days_left_attendance;
        const daysLeftEvaluation = dl?.days_left_evaluation;

        if (!showPendingActionPopup || (!isAttendancePending && !isEvaluationPending)) {
          return null;
        }

        // Safely resolve the panel title to prevent "Unassigned" fallback
        const resolvedPanelRaw =
          activePanelObj?.panel_name ||
          activePanelObj?.name ||
          assignedPanels.find(p => String(p.ri_panel_id) === String(selectedPanelId))?.panel_name ||
          assignedPanels.find(p => String(p.ri_panel_id) === String(selectedPanelId))?.name ||
          assignedPanels[0]?.panel_name ||
          assignedPanels[0]?.name ||
          panelData?.name ||
          panelData?.panel?.name ||
          dashboardData?.panel?.name;

        let panelDisplayName = 'Assigned Panel';
        if (resolvedPanelRaw) {
          const cleaned = cleanPanelName(resolvedPanelRaw);
          if (cleaned && cleaned.toLowerCase() !== 'unassigned') {
            panelDisplayName = cleaned;
          } else if (activePanelObj?.ri_panel_id || selectedPanelId) {
            panelDisplayName = `Panel ${activePanelObj?.ri_panel_id || selectedPanelId}`;
          }
        } else if (activePanelObj?.ri_panel_id || selectedPanelId) {
          panelDisplayName = `Panel ${activePanelObj?.ri_panel_id || selectedPanelId}`;
        }

        const villageName = activePanelObj?.village_name || panelData?.village_name || panelData?.panel?.village_name;
        const visitEndDate = dl?.visit_end_date || dashboardData?.deadlines?.visit_end_date;

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99998,
              padding: isMobile ? '12px' : '20px',
              overflowY: 'auto'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowPendingActionPopup(false);
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: isMobile ? '14px' : '16px',
                maxWidth: '520px',
                width: '100%',
                maxHeight: isMobile ? 'calc(100dvh - 24px)' : '90vh',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                animation: 'fadeIn 0.15s ease-out'
              }}
            >
              {/* Header */}
              <div
                style={{
                  backgroundColor: '#047857',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  width: '100%',
                  boxSizing: 'border-box',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#065f46',
                      border: '1px solid #059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Clock size={18} color="#ffffff" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: isMobile ? '15px' : '16px',
                        fontWeight: '800',
                        color: '#ffffff',
                        letterSpacing: '-0.2px',
                        lineHeight: 1.25
                      }}
                    >
                      Pending Action Required
                    </h3>
                    <p
                      style={{
                        margin: '3px 0 0 0',
                        fontSize: '11.5px',
                        color: '#d1fae5',
                        lineHeight: 1.35,
                        wordBreak: 'break-word'
                      }}
                    >
                      Rural Immersion — {panelDisplayName}{villageName ? ` (${villageName})` : ''}
                      {visitEndDate ? ` (RI Visit End: ${formatRiDate(visitEndDate)})` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPendingActionPopup(false)}
                  style={{
                    backgroundColor: '#065f46',
                    border: '1px solid #059669',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    flexShrink: 0,
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#047857'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div
                style={{
                  padding: isMobile ? '14px 16px 16px' : '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  overflowY: 'auto',
                  boxSizing: 'border-box'
                }}
              >
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
                  Rural Immersion is a 2-day field visit (Day 1 &amp; Day 2; remaining days are for LTC). Deadlines are calculated starting from Day 3 (7 days for attendance, 15 days for evaluations). Please ensure submissions are completed on time.
                </p>

                {/* Status List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* 1. Daily Attendance */}
                  <div
                    style={{
                      backgroundColor: isAttendancePending ? (isAttendanceDeadLocked ? '#fef2f2' : '#fffbeb') : '#f0fdf4',
                      border: `1.5px solid ${isAttendancePending ? (isAttendanceDeadLocked ? '#fecaca' : '#fde68a') : '#bbf7d0'}`,
                      borderRadius: '10px',
                      padding: isMobile ? '12px' : '14px 16px',
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center',
                      justifyContent: 'space-between',
                      gap: isMobile ? '10px' : '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: isAttendancePending ? (isAttendanceDeadLocked ? '#fee2e2' : '#fef3c7') : '#dcfce7',
                          color: isAttendancePending ? (isAttendanceDeadLocked ? '#dc2626' : '#d97706') : '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px'
                        }}
                      >
                        {isAttendanceDeadLocked ? <Lock size={16} /> : isAttendancePending ? <ClipboardCheck size={16} /> : <CheckCircle size={16} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '800',
                              color: isAttendancePending ? (isAttendanceDeadLocked ? '#991b1b' : '#92400e') : '#166534'
                            }}
                          >
                            Daily Attendance
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: isAttendancePending ? (isAttendanceDeadLocked ? '#fee2e2' : '#fef3c7') : '#dcfce7',
                              color: isAttendancePending ? (isAttendanceDeadLocked ? '#b91c1c' : '#b45309') : '#15803d',
                              border: `1px solid ${isAttendancePending ? (isAttendanceDeadLocked ? '#fca5a5' : '#fcd34d') : '#86efac'}`
                            }}
                          >
                            {isAttendanceDeadLocked ? 'Locked' : isAttendancePending ? 'Pending' : 'Completed'}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                          {isAttendancePending
                            ? `${totalMarkedSlots} of ${totalPossibleSlots} slots recorded${daysLeftAttendance != null ? ` • ${daysLeftAttendance} ${daysLeftAttendance === 1 ? 'day' : 'days'} left` : ''}`
                            : `All ${totalPossibleSlots} attendance slots recorded`}
                        </p>
                      </div>
                    </div>

                    {isAttendancePending && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPendingActionPopup(false);
                          setActiveTab('attendance');
                        }}
                        style={{
                          padding: isMobile ? '8px 14px' : '7px 14px',
                          minHeight: isMobile ? '38px' : '32px',
                          backgroundColor: isAttendanceDeadLocked ? '#ffffff' : '#d97706',
                          color: isAttendanceDeadLocked ? '#b91c1c' : '#ffffff',
                          border: isAttendanceDeadLocked ? '1px solid #fca5a5' : 'none',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          flexShrink: 0,
                          width: isMobile ? '100%' : 'auto',
                          boxShadow: isAttendanceDeadLocked ? 'none' : '0 1px 2px rgba(217, 119, 6, 0.25)',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <span>{isAttendanceDeadLocked ? 'View' : 'Mark'}</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>

                  {/* 2. Student Evaluation */}
                  <div
                    style={{
                      backgroundColor: isEvaluationPending ? (isEvaluationDeadLocked ? '#fef2f2' : '#eff6ff') : '#f0fdf4',
                      border: `1.5px solid ${isEvaluationPending ? (isEvaluationDeadLocked ? '#fecaca' : '#bfdbfe') : '#bbf7d0'}`,
                      borderRadius: '10px',
                      padding: isMobile ? '12px' : '14px 16px',
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'stretch' : 'center',
                      justifyContent: 'space-between',
                      gap: isMobile ? '10px' : '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: isEvaluationPending ? (isEvaluationDeadLocked ? '#fee2e2' : '#dbeafe') : '#dcfce7',
                          color: isEvaluationPending ? (isEvaluationDeadLocked ? '#dc2626' : '#2563eb') : '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px'
                        }}
                      >
                        {isEvaluationDeadLocked ? <Lock size={16} /> : isEvaluationPending ? <Award size={16} /> : <CheckCircle size={16} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '800',
                              color: isEvaluationPending ? (isEvaluationDeadLocked ? '#991b1b' : '#1e40af') : '#166534'
                            }}
                          >
                            Student Evaluation
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: isEvaluationPending ? (isEvaluationDeadLocked ? '#fee2e2' : '#dbeafe') : '#dcfce7',
                              color: isEvaluationPending ? (isEvaluationDeadLocked ? '#b91c1c' : '#1d4ed8') : '#15803d',
                              border: `1px solid ${isEvaluationPending ? (isEvaluationDeadLocked ? '#fca5a5' : '#93c5fd') : '#86efac'}`
                            }}
                          >
                            {isEvaluationDeadLocked ? 'Locked' : isEvaluationPending ? 'Pending' : 'Completed'}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                          {isEvaluationPending
                            ? `${evaluationsCompleted} of ${totalStudents} students evaluated${daysLeftEvaluation != null ? ` • ${daysLeftEvaluation} ${daysLeftEvaluation === 1 ? 'day' : 'days'} left` : ''}`
                            : `All ${totalStudents} students evaluated`}
                        </p>
                      </div>
                    </div>

                    {isEvaluationPending && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPendingActionPopup(false);
                          setActiveTab('evaluation');
                        }}
                        style={{
                          padding: isMobile ? '8px 14px' : '7px 14px',
                          minHeight: isMobile ? '38px' : '32px',
                          backgroundColor: isEvaluationDeadLocked ? '#ffffff' : '#2563eb',
                          color: isEvaluationDeadLocked ? '#b91c1c' : '#ffffff',
                          border: isEvaluationDeadLocked ? '1px solid #fca5a5' : 'none',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          flexShrink: 0,
                          width: isMobile ? '100%' : 'auto',
                          boxShadow: isEvaluationDeadLocked ? 'none' : '0 1px 2px rgba(37, 99, 235, 0.25)',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <span>{isEvaluationDeadLocked ? 'View' : 'Evaluate'}</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'stretch' : 'flex-end',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid #e2e8f0',
                    marginTop: '2px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowPendingActionPopup(false)}
                    style={{
                      width: isMobile ? '100%' : 'auto',
                      minHeight: isMobile ? '40px' : '34px',
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                  >
                    I'll complete this later
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Mandatory RI Faculty Undertaking Gate Popup ── */}
      {isUndertakingChecked && !isFacultyUndertakingSubmitted && showFacultyGatePopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: isMobile ? '16px' : '24px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '18px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.06)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Solid Green Header */}
            <div
              style={{
                backgroundColor: '#047857',
                padding: isMobile ? '16px 20px' : '18px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <ShieldCheck size={22} color="#ffffff" />
              </div>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.2px',
                    lineHeight: 1.25
                  }}
                >
                  Faculty Undertaking Form Required
                </h3>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#a7f3d0',
                    fontWeight: '500',
                    marginTop: '2px'
                  }}
                >
                  Rural Immersion Program • Mandatory Declaration
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: isMobile ? '20px 18px' : '24px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid #a7f3d0'
                  }}
                >
                  <AlertCircle size={22} color="#047857" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a', lineHeight: 1.4 }}>
                    Submission is Mandatory to Access Portal Features
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                    All faculty members assigned to Rural Immersion panels must digitally review, accept, and sign the official <strong>Faculty Undertaking Form &amp; Code of Conduct</strong> before accessing the portal dashboard, student rosters, attendance sheets, and evaluation records.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'column-reverse' : 'row',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9'
                }}
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: isMobile ? '11px 16px' : '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('undertaking');
                    setShowFacultyGatePopup(false);
                    if (isMobile) setIsMobileNavOpen(false);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: isMobile ? '12px 18px' : '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileText size={16} />
                  <span>Complete Undertaking</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
