import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table2,
  Search,
  Save,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  ExternalLink,
  Users,
  Check,
  X,
  Lock,
  Unlock,
  Filter,
  FileText,
  Award,
  ChevronDown,
  Info,
  HelpCircle,
  Edit3,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  CheckSquare,
  Table,
  LayoutGrid
} from 'lucide-react';
import { formatRiDate } from '../shared/riUtils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const RATING_OPTIONS = [
  { value: '', label: 'Select Rating', marks: 0 },
  { value: 'Excellent', label: 'Excellent (10M)', marks: 10 },
  { value: 'Good', label: 'Good (8M)', marks: 8 },
  { value: 'Satisfactory', label: 'Satisfactory (6M)', marks: 6 },
  { value: 'Unsatisfactory', label: 'Unsatisfactory (3M)', marks: 3 }
];

const RATING_MARKS = {
  'Excellent': 10,
  'Good': 8,
  'Satisfactory': 6,
  'Satisfactory / Fair': 6,
  'Unsatisfactory': 3,
  'Needs Improvement': 3
};

const ATT_MAP = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };

function getGradeInfo(totalMarks, status) {
  if (status !== 'Completed' && totalMarks === 0) {
    return { grade: 'Pending', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' };
  }
  if (totalMarks >= 90) return { grade: 'O', color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' };
  if (totalMarks >= 80) return { grade: 'A+', color: '#15803d', bg: '#dcfce7', border: '#86efac' };
  if (totalMarks >= 70) return { grade: 'A', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' };
  if (totalMarks >= 60) return { grade: 'B+', color: '#4338ca', bg: '#e0e7ff', border: '#a5b4fc' };
  if (totalMarks >= 50) return { grade: 'B', color: '#b45309', bg: '#fef3c7', border: '#fde68a' };
  if (totalMarks >= 40) return { grade: 'C', color: '#c2410c', bg: '#ffedd5', border: '#fed7aa' };
  return { grade: 'F', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' };
}

export default function RiSuperAdminManageEvaluationTab({
  selectedBatchId: propBatchId,
  onSelectBatch,
  batches = [],
  token,
  authHeaders,
  isMobile = false,
  isReadOnly = false,
  addToast,
  onOpenWorkspace
}) {
  // Batch & Panel Selection State
  const [activeBatchId, setActiveBatchId] = useState(propBatchId || (batches[0]?.id ? String(batches[0].id) : ''));
  const [panels, setPanels] = useState([]);
  const [selectedPanelId, setSelectedPanelId] = useState('');
  const [loadingPanels, setLoadingPanels] = useState(false);

  // Request sequence refs to prevent race conditions and stale overwrites
  const latestPanelsReqRef = useRef(0);
  const latestDetailReqRef = useRef(0);
  const prevPropBatchIdRef = useRef(propBatchId);

  // Panel Detail & Evaluation State
  const [panelDetail, setPanelDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Lock Confirmation Modals
  const [confirmLockModal, setConfirmLockModal] = useState({ open: false, targetLock: true });
  const [togglingLock, setTogglingLock] = useState(false);

  // Raw server records & working rows
  const [studentsData, setStudentsData] = useState([]);
  const [evalRows, setEvalRows] = useState({});
  const [initialRows, setInitialRows] = useState({});

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, DRAFT, NOT_EVALUATED, UNSAVED

  // Active remarks popup
  const [activeRemarksStudentId, setActiveRemarksStudentId] = useState(null);

  // Responsive View Mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState(isMobile ? 'cards' : 'table');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleResize = () => {
        if (window.innerWidth < 768) setViewMode('cards');
      };
      if (window.innerWidth < 768) setViewMode('cards');
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const toast = useCallback((msg, type = 'info') => {
    if (typeof addToast === 'function') addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  // Ensure stable authentication headers
  const effectiveAuthHeaders = useMemo(() => {
    const effectiveToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
    const base = {
      'Content-Type': 'application/json',
      ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {})
    };
    if (authHeaders && typeof authHeaders === 'object' && authHeaders.Authorization) {
      base.Authorization = authHeaders.Authorization;
    }
    return base;
  }, [token, authHeaders?.Authorization]);

  // Default to first batch if activeBatchId is empty and batches load asynchronously
  useEffect(() => {
    if (!activeBatchId && batches.length > 0) {
      const firstBId = String(propBatchId || batches[0].id);
      setActiveBatchId(firstBId);
      onSelectBatch?.(firstBId);
    }
  }, [batches, propBatchId, activeBatchId, onSelectBatch]);

  // Sync batch ONLY when propBatchId changes externally from parent (not from local selection)
  useEffect(() => {
    if (propBatchId && propBatchId !== prevPropBatchIdRef.current) {
      prevPropBatchIdRef.current = propBatchId;
      if (String(propBatchId) !== String(activeBatchId)) {
        setActiveBatchId(String(propBatchId));
      }
    }
  }, [propBatchId, activeBatchId]);

  // 2. Fetch Panel Evaluation Detail & Student Evaluations
  const fetchPanelEvaluationDetail = useCallback(async (bId, pId) => {
    if (!bId || !pId) return;
    const reqId = ++latestDetailReqRef.current;
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/evaluations/panel-detail?batch_id=${bId}&panel_id=${pId}`, {
        headers: effectiveAuthHeaders
      });
      const data = await res.json();
      if (reqId !== latestDetailReqRef.current) return; // Stale request, discard

      if (res.ok && data.success) {
        setPanelDetail(data);
        const students = Array.isArray(data.students) ? data.students : [];
        setStudentsData(students);

        const rowsMap = {};
        students.forEach(st => {
          const id = String(st.student_id);
          const hasExisting = Boolean(st.has_existing_evaluation);

          let presentCount = 0;
          if (st.school_status === 'Present') presentCount++;
          if (st.inst_status === 'Present') presentCount++;
          if (st.fam_status === 'Present') presentCount++;
          if (st.comm_status === 'Present') presentCount++;

          const autoAtt = ATT_MAP[presentCount] ?? Number((presentCount * 3.75).toFixed(2));
          const attMarks = hasExisting && st.attendance_marks !== null && st.attendance_marks !== undefined
            ? Number(st.attendance_marks)
            : autoAtt;

          rowsMap[id] = {
            student_id: id,
            attendance_marks: attMarks,
            present_activities_count: presentCount,
            school_status: st.school_status || 'Absent',
            inst_status: st.inst_status || 'Absent',
            fam_status: st.fam_status || 'Absent',
            comm_status: st.comm_status || 'Absent',
            institutional_visit_rating: st.institutional_visit_rating || '',
            family_survey_rating: st.family_survey_rating || '',
            community_project_rating: st.community_project_rating || '',
            problem_statement_marks: st.problem_statement_marks !== null && st.problem_statement_marks !== undefined ? String(st.problem_statement_marks) : '',
            smart_solution_marks: st.smart_solution_marks !== null && st.smart_solution_marks !== undefined ? String(st.smart_solution_marks) : '',
            faculty_remarks: st.faculty_remarks || '',
            evaluation_status: (st.evaluation_status === 'Completed' || st.evaluation_status === 'Draft') ? st.evaluation_status : (hasExisting ? 'Draft' : 'Pending'),
            has_existing_evaluation: hasExisting,
            last_saved_status: (st.evaluation_status === 'Completed' || st.evaluation_status === 'Draft') ? st.evaluation_status : (hasExisting ? 'Draft' : 'Pending')
          };
        });

        setEvalRows(rowsMap);
        setInitialRows(JSON.parse(JSON.stringify(rowsMap)));
      } else {
        toast(data.message || 'Failed to load panel evaluations', 'error');
      }
    } catch (err) {
      if (reqId !== latestDetailReqRef.current) return;
      console.error('Error fetching panel evaluations detail:', err);
      toast('Network error loading evaluations detail', 'error');
    } finally {
      if (reqId === latestDetailReqRef.current) {
        setLoadingDetail(false);
      }
    }
  }, [effectiveAuthHeaders, toast]);

  // 1. Fetch Panels when activeBatchId changes
  const fetchPanels = useCallback(async (bId, preferredPanelId = null) => {
    if (!bId) return;
    const reqId = ++latestPanelsReqRef.current;
    setLoadingPanels(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/evaluations/panels?batch_id=${bId}`, {
        headers: effectiveAuthHeaders
      });
      const data = await res.json();
      if (reqId !== latestPanelsReqRef.current) return; // Stale request, discard

      if (res.ok && data.success) {
        const panelsList = data.panels || [];
        setPanels(panelsList);
        // Auto-select preferred panel or first panel if list is non-empty
        if (panelsList.length > 0) {
          const matchExisting = preferredPanelId ? panelsList.find(p => String(p.id) === String(preferredPanelId)) : null;
          const targetPId = matchExisting ? String(matchExisting.id) : String(panelsList[0].id);
          setSelectedPanelId(targetPId);
          fetchPanelEvaluationDetail(bId, targetPId);
        } else {
          setSelectedPanelId('');
          setStudentsData([]);
          setEvalRows({});
          setPanelDetail(null);
        }
      } else {
        toast(data.message || 'Failed to fetch panels for this batch', 'error');
      }
    } catch (err) {
      if (reqId !== latestPanelsReqRef.current) return;
      console.error('Error fetching batch panels:', err);
      toast('Network error loading batch panels', 'error');
    } finally {
      if (reqId === latestPanelsReqRef.current) {
        setLoadingPanels(false);
      }
    }
  }, [effectiveAuthHeaders, fetchPanelEvaluationDetail, toast]);

  useEffect(() => {
    if (activeBatchId) {
      fetchPanels(activeBatchId);
    }
  }, [activeBatchId, fetchPanels]);



  // Single row live score calculation
  const computeRowScores = useCallback((row) => {
    if (!row) {
      return { attendance: 0, activities: 0, inst: 0, fam: 0, comm: 0, problem: 0, smart: 0, total: 0 };
    }
    const att = Number(row.attendance_marks || 0);
    const inst = RATING_MARKS[row.institutional_visit_rating] || 0;
    const fam = RATING_MARKS[row.family_survey_rating] || 0;
    const comm = RATING_MARKS[row.community_project_rating] || 0;
    const activities = inst + fam + comm;

    const rawProb = row.problem_statement_marks === '' ? 0 : Number(row.problem_statement_marks);
    const problem = Math.min(15, Math.max(0, isNaN(rawProb) ? 0 : rawProb));

    const rawSmart = row.smart_solution_marks === '' ? 0 : Number(row.smart_solution_marks);
    const smart = Math.min(40, Math.max(0, isNaN(rawSmart) ? 0 : rawSmart));

    const total = Math.min(100, Math.round((att + activities + problem + smart) * 100) / 100);

    return {
      attendance: att,
      activities,
      inst,
      fam,
      comm,
      problem,
      smart,
      total
    };
  }, []);

  // Update specific field for a student row
  const handleFieldChange = useCallback((studentId, field, value) => {
    setEvalRows(prev => {
      const current = prev[studentId] || {};
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: value
        }
      };
    });
  }, []);

  // Dirty check: find all student IDs with unsaved changes
  const dirtyStudentIds = useMemo(() => {
    const list = [];
    Object.keys(evalRows).forEach(id => {
      const curr = evalRows[id];
      const init = initialRows[id];
      if (!init) return;
      const isDiff =
        curr.institutional_visit_rating !== init.institutional_visit_rating ||
        curr.family_survey_rating !== init.family_survey_rating ||
        curr.community_project_rating !== init.community_project_rating ||
        curr.problem_statement_marks !== init.problem_statement_marks ||
        curr.smart_solution_marks !== init.smart_solution_marks ||
        curr.faculty_remarks !== init.faculty_remarks;
      if (isDiff) list.push(id);
    });
    return list;
  }, [evalRows, initialRows]);

  // Validation
  const validateRow = useCallback((row) => {
    if (!row) return 'Row missing';
    if (row.problem_statement_marks !== '') {
      const p = Number(row.problem_statement_marks);
      if (isNaN(p) || p < 0 || p > 15) return 'Problem statement marks must be between 0 and 15';
    }
    if (row.smart_solution_marks !== '') {
      const s = Number(row.smart_solution_marks);
      if (isNaN(s) || s < 0 || s > 40) return 'SMART solution marks must be between 0 and 40';
    }
    return null;
  }, []);

  // Save single student evaluation (Super Admin)
  const handleSaveSingleRow = async (studentId, targetStatus) => {
    const row = evalRows[studentId];
    if (!row) return;

    const validationErr = validateRow(row);
    if (validationErr) {
      toast(validationErr, 'error');
      return;
    }

    setSavingRowId(studentId);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/evaluations/panel-save`, {
        method: 'POST',
        headers: effectiveAuthHeaders,
        body: JSON.stringify({
          batch_id: activeBatchId,
          panel_id: selectedPanelId,
          evaluations: [{
            student_id: Number(studentId),
            institutional_visit_rating: row.institutional_visit_rating || '',
            family_survey_rating: row.family_survey_rating || '',
            community_project_rating: row.community_project_rating || '',
            problem_statement_marks: row.problem_statement_marks === '' ? 0 : Number(row.problem_statement_marks),
            smart_solution_marks: row.smart_solution_marks === '' ? 0 : Number(row.smart_solution_marks),
            faculty_remarks: row.faculty_remarks || '',
            evaluation_status: targetStatus
          }]
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        const studentObj = studentsData.find(s => s.student_id === Number(studentId));
        const sName = studentObj?.student_name || 'Student';
        toast(`Evaluation for ${sName} saved as ${targetStatus}!`, 'success');

        const updatedRow = {
          ...row,
          evaluation_status: targetStatus,
          has_existing_evaluation: true,
          last_saved_status: targetStatus
        };

        setInitialRows(prev => ({
          ...prev,
          [studentId]: { ...updatedRow }
        }));
        setEvalRows(prev => ({
          ...prev,
          [studentId]: { ...updatedRow }
        }));
        setStudentsData(prev => prev.map(s => s.student_id === Number(studentId) ? { ...s, evaluation_status: targetStatus, has_existing_evaluation: true } : s));

        fetchPanels(activeBatchId);
      } else {
        toast(result.message || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Error saving evaluation:', err);
      toast('Network error saving evaluation', 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  // Bulk save evaluations (Super Admin)
  const handleSaveAll = async (forcedStatus = null) => {
    const targetIds = forcedStatus
      ? Object.keys(evalRows)
      : (dirtyStudentIds.length > 0 ? dirtyStudentIds : Object.keys(evalRows));

    if (targetIds.length === 0) {
      toast('No evaluations to save.', 'info');
      return;
    }

    // Validate all target rows
    for (const id of targetIds) {
      const err = validateRow(evalRows[id]);
      if (err) {
        const st = studentsData.find(s => s.student_id === Number(id));
        toast(`Validation error for ${st?.student_name || 'student'}: ${err}`, 'error');
        return;
      }
    }

    setSavingAll(true);
    try {
      const evaluationsPayload = targetIds.map(id => {
        const row = evalRows[id];
        const status = forcedStatus || (row.evaluation_status === 'Completed' ? 'Completed' : 'Draft');
        return {
          student_id: Number(id),
          institutional_visit_rating: row.institutional_visit_rating || '',
          family_survey_rating: row.family_survey_rating || '',
          community_project_rating: row.community_project_rating || '',
          problem_statement_marks: row.problem_statement_marks === '' ? 0 : Number(row.problem_statement_marks),
          smart_solution_marks: row.smart_solution_marks === '' ? 0 : Number(row.smart_solution_marks),
          faculty_remarks: row.faculty_remarks || '',
          evaluation_status: status
        };
      });

      const res = await fetch(`${API}/api/ri/superadmin/evaluations/panel-save`, {
        method: 'POST',
        headers: effectiveAuthHeaders,
        body: JSON.stringify({
          batch_id: activeBatchId,
          panel_id: selectedPanelId,
          evaluations: evaluationsPayload,
          lock_action: forcedStatus === 'Completed' ? 'lock' : null
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        const successMsg = forcedStatus === 'Completed'
          ? `All ${result.updated_count || targetIds.length} evaluations saved and locked as Completed!`
          : `Successfully saved ${result.updated_count || targetIds.length} evaluations!`;
        toast(successMsg, 'success');

        fetchPanelEvaluationDetail(activeBatchId, selectedPanelId);
        fetchPanels(activeBatchId);
      } else {
        toast(result.message || 'Failed to bulk save evaluations', 'error');
      }
    } catch (err) {
      console.error('Error saving all evaluations:', err);
      toast('Network error during bulk save', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  // Toggle Panel Evaluation Lock / Unlock (Super Admin)
  const handleTogglePanelLock = async (targetLockState) => {
    if (!activeBatchId || !selectedPanelId || togglingLock) return;
    setTogglingLock(true);
    try {
      const res = await fetch(`${API}/api/ri/superadmin/evaluations/toggle-lock`, {
        method: 'POST',
        headers: effectiveAuthHeaders,
        body: JSON.stringify({
          batch_id: activeBatchId,
          panel_id: selectedPanelId,
          is_locked: targetLockState
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast(data.message || `Panel evaluation ${targetLockState ? 'locked' : 'unlocked'} successfully!`, 'success');
        setConfirmLockModal({ open: false, targetLock: true });
        // Refresh detail & panels using the exact current panel ID
        await fetchPanelEvaluationDetail(activeBatchId, selectedPanelId);
        await fetchPanels(activeBatchId, selectedPanelId);
      } else {
        toast(data.message || 'Failed to toggle evaluation lock', 'error');
      }
    } catch (err) {
      console.error('Error toggling evaluation lock:', err);
      toast('Network error toggling lock', 'error');
    } finally {
      setTogglingLock(false);
    }
  };

  // Unlock single student evaluation (Super Admin)
  const handleUnlockSingleStudent = async (studentId) => {
    if (!activeBatchId || !selectedPanelId || !studentId) return;
    try {
      const res = await fetch(`${API}/api/ri/superadmin/evaluations/unlock-single`, {
        method: 'POST',
        headers: effectiveAuthHeaders,
        body: JSON.stringify({
          batch_id: activeBatchId,
          panel_id: selectedPanelId,
          student_id: Number(studentId)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('Student evaluation unlocked for editing', 'success');
        await fetchPanelEvaluationDetail(activeBatchId, selectedPanelId);
        await fetchPanels(activeBatchId, selectedPanelId);
      } else {
        toast(data.message || 'Failed to unlock student evaluation', 'error');
      }
    } catch (err) {
      console.error('Error unlocking student:', err);
      toast('Network error unlocking student', 'error');
    }
  };

  // Download Evaluation Excel
  const handleDownloadExcel = async () => {
    if (!activeBatchId || !selectedPanelId) return;
    setDownloadingExcel(true);
    try {
      const q = new URLSearchParams({ batch_id: String(activeBatchId), panel_id: String(selectedPanelId) });
      const res = await fetch(`${API}/api/ri/faculty-portal/exports/evaluation?${q.toString()}`, {
        headers: { Authorization: effectiveAuthHeaders.Authorization }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RI_Evaluation_Batch${activeBatchId}_Panel${selectedPanelId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast('Evaluation Excel downloaded successfully', 'success');
      } else {
        toast('Failed to download evaluation sheet', 'error');
      }
    } catch (err) {
      console.error('Error downloading evaluation excel:', err);
      toast('Network error downloading file', 'error');
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return studentsData.filter(st => {
      const id = String(st.student_id);
      const row = evalRows[id];
      if (!row) return false;

      // Status filter
      if (statusFilter === 'COMPLETED' && row.evaluation_status !== 'Completed') return false;
      if (statusFilter === 'DRAFT' && row.evaluation_status !== 'Draft') return false;
      if (statusFilter === 'NOT_EVALUATED' && row.has_existing_evaluation) return false;
      if (statusFilter === 'UNSAVED' && !dirtyStudentIds.includes(id)) return false;

      // Search filter
      if (search.trim()) {
        const s = search.toLowerCase().trim();
        const nameMatch = (st.student_name || '').toLowerCase().includes(s);
        const prnMatch = (st.prn || '').toLowerCase().includes(s);
        const rollMatch = (st.roll_number || '').toLowerCase().includes(s);
        if (!nameMatch && !prnMatch && !rollMatch) return false;
      }
      return true;
    });
  }, [studentsData, evalRows, statusFilter, dirtyStudentIds, search]);

  // Statistics
  const stats = useMemo(() => {
    const total = studentsData.length;
    let completed = 0;
    let draft = 0;
    let notEvaluated = 0;

    studentsData.forEach(st => {
      const row = evalRows[String(st.student_id)];
      if (row?.evaluation_status === 'Completed') completed++;
      else if (row?.evaluation_status === 'Draft') draft++;
      else notEvaluated++;
    });

    return {
      total,
      completed,
      draft,
      notEvaluated,
      unsaved: dirtyStudentIds.length
    };
  }, [studentsData, evalRows, dirtyStudentIds]);

  const activePanelObj = useMemo(() => {
    return panels.find(p => String(p.id) === String(selectedPanelId)) || panelDetail?.panel || null;
  }, [panels, selectedPanelId, panelDetail]);

  const isPanelLocked = Boolean(panelDetail?.lock?.is_locked);
  const lockReason = panelDetail?.lock?.lock_reason || (isPanelLocked ? 'Locked' : 'Open for Evaluation');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── TOP CONTROL BAR: TITLE, SELECTORS & LOCK STATUS ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        padding: isMobile ? '12px 14px' : '14px 18px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        {/* Row 1: Title & Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0
            }}>
              <CheckSquare size={17} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: isMobile ? '15px' : '17px', fontWeight: 750, color: '#0f172a' }}>
                Manage Panel Evaluations
              </h2>
              {activePanelObj && (
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Panel {activePanelObj.panel_number || activePanelObj.id}</span>
                  {activePanelObj.village_name && (
                    <span>• Village: <strong style={{ color: '#334155', fontWeight: 600 }}>{activePanelObj.village_name}</strong></span>
                  )}
                  {activePanelObj.assigned_faculty && activePanelObj.assigned_faculty.length > 0 && (
                    <span>• Mentor: <strong style={{ color: '#334155', fontWeight: 600 }}>{activePanelObj.assigned_faculty.map(f => f.name).join(', ')}</strong></span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selectors and Lock Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto'
          }}>
            {/* Batch Select */}
            <select
              value={activeBatchId}
              onChange={(e) => {
                const nextBId = e.target.value;
                if (!nextBId || nextBId === activeBatchId) return;
                setActiveBatchId(nextBId);
                onSelectBatch?.(nextBId);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                flex: isMobile ? '1 1 auto' : 'none'
              }}
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Panel Select */}
            <select
              value={selectedPanelId}
              onChange={(e) => {
                const nextPId = e.target.value;
                setSelectedPanelId(nextPId);
                if (activeBatchId && nextPId) {
                  fetchPanelEvaluationDetail(activeBatchId, nextPId);
                }
              }}
              disabled={loadingPanels || panels.length === 0}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: loadingPanels ? '#f8fafc' : '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: loadingPanels ? 'not-allowed' : 'pointer',
                minWidth: isMobile ? 'auto' : '170px',
                flex: isMobile ? '1 1 auto' : 'none'
              }}
            >
              {panels.length === 0 ? (
                <option value="">{loadingPanels ? 'Loading...' : 'No panels'}</option>
              ) : (
                panels.map(p => (
                  <option key={p.id} value={p.id}>
                    Panel {p.panel_number}: {p.name}
                  </option>
                ))
              )}
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                if (activeBatchId && selectedPanelId) {
                  fetchPanelEvaluationDetail(activeBatchId, selectedPanelId);
                  fetchPanels(activeBatchId, selectedPanelId);
                }
              }}
              disabled={loadingDetail || loadingPanels}
              title="Refresh"
              style={{
                padding: '6px 9px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RefreshCw size={13} className={loadingDetail ? 'animate-spin' : ''} />
            </button>

            {/* Lock / Unlock Status & Button */}
            {activePanelObj && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: isMobile ? '0' : '4px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isPanelLocked ? '#fee2e2' : '#ecfdf5',
                  color: isPanelLocked ? '#991b1b' : '#065f46',
                  border: `1px solid ${isPanelLocked ? '#fca5a5' : '#a7f3d0'}`
                }}>
                  {isPanelLocked ? <Lock size={11} /> : <Unlock size={11} />}
                  <span>{isPanelLocked ? 'Evaluation Locked' : 'Evaluation Open'}</span>
                  {lockReason && (
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: isPanelLocked ? '#991b1b' : '#047857' }}>
                      ({lockReason})
                    </span>
                  )}
                </span>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setConfirmLockModal({ open: true, targetLock: !isPanelLocked })}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isPanelLocked ? '#059669' : '#dc2626',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {isPanelLocked ? <Unlock size={12} /> : <Lock size={12} />}
                    <span>{isPanelLocked ? 'Unlock Panel' : 'Lock Panel'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR: FILTER TABS, SEARCH, VIEW TOGGLE & ACTIONS ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        padding: '10px 14px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        {/* Left: Filter Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          overflowX: 'auto',
          maxWidth: '100%',
          paddingBottom: isMobile ? '2px' : '0'
        }}>
          {[
            { id: 'ALL', label: `All (${stats.total})` },
            { id: 'COMPLETED', label: `Done (${stats.completed})`, color: '#059669' },
            { id: 'DRAFT', label: `Draft (${stats.draft})`, color: '#d97706' },
            { id: 'NOT_EVALUATED', label: `Pending (${stats.notEvaluated})`, color: '#64748b' },
            ...(stats.unsaved > 0 ? [{ id: 'UNSAVED', label: `Unsaved (${stats.unsaved})`, color: '#dc2626' }] : [])
          ].map(tab => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 600,
                  backgroundColor: isActive ? '#0f172a' : '#f8fafc',
                  color: isActive ? '#ffffff' : (tab.color || '#475569'),
                  border: isActive ? '1px solid #0f172a' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Search, View Switcher & Action Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          width: isMobile ? '100%' : 'auto'
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: isMobile ? '1' : 'none', minWidth: isMobile ? '120px' : '170px' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px 5px 26px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* View Mode Toggle (Table vs Cards) */}
          <div style={{
            display: 'inline-flex',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            padding: '2px'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table view"
              style={{
                padding: '3px 7px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Table size={13} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Cards view"
              style={{
                padding: '3px 7px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <LayoutGrid size={13} />
            </button>
          </div>

          {/* Download Excel */}
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={downloadingExcel || studentsData.length === 0}
            title="Download Excel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Download size={13} />
            <span>Excel</span>
          </button>

          {!isReadOnly && (
            <>
              {dirtyStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSaveAll(null)}
                  disabled={savingAll}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: savingAll ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Save size={13} />
                  <span>Save ({dirtyStudentIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSaveAll('Completed')}
                disabled={savingAll || studentsData.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: savingAll ? 'not-allowed' : 'pointer'
                }}
              >
                <CheckCircle2 size={13} />
                <span>Finalize All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER (TABLE OR CARDS) ── */}
      {loadingDetail ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#059669' }} />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading evaluations...</div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
          <Award size={28} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>No students found</div>
          <div style={{ fontSize: '12px', marginTop: '2px' }}>
            {search ? 'No matching records for your search' : 'No students enrolled in this panel.'}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* ════ MOBILE / RESPONSIVE CARDS VIEW ════ */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '12px'
        }}>
          {filteredStudents.map((st) => {
            const id = String(st.student_id);
            const row = evalRows[id] || {};
            const scores = computeRowScores(row);
            const isCompleted = row.evaluation_status === 'Completed';
            const isDraft = row.evaluation_status === 'Draft';
            const isDirty = dirtyStudentIds.includes(id);
            const isSavingThisRow = savingRowId === id;
            const gradeInfo = getGradeInfo(scores.total, row.evaluation_status);

            const isProblemInvalid = row.problem_statement_marks !== '' && (Number(row.problem_statement_marks) < 0 || Number(row.problem_statement_marks) > 15 || isNaN(Number(row.problem_statement_marks)));
            const isSmartInvalid = row.smart_solution_marks !== '' && (Number(row.smart_solution_marks) < 0 || Number(row.smart_solution_marks) > 40 || isNaN(Number(row.smart_solution_marks)));

            return (
              <div
                key={id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: isDirty ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
              >
                {/* Card Top: Student Info & Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isDirty && (
                        <span
                          title="Unsaved changes"
                          style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }}
                        />
                      )}
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
                        {st.student_name}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                      {st.prn || 'No PRN'} • {st.department || '—'}
                    </div>
                  </div>

                  {/* Status & Grade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: gradeInfo.bg,
                      color: gradeInfo.color,
                      border: `1px solid ${gradeInfo.border}`
                    }}>
                      {gradeInfo.grade}
                    </span>
                    <span style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: isCompleted ? '#dcfce7' : isDraft ? '#fef3c7' : '#f1f5f9',
                      color: isCompleted ? '#15803d' : isDraft ? '#b45309' : '#64748b',
                      border: `1px solid ${isCompleted ? '#bbf7d0' : isDraft ? '#fde68a' : '#e2e8f0'}`
                    }}>
                      {isCompleted ? 'Done' : isDraft ? 'Draft' : 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Score Tiles (Attendance, Problem, Solution, Total) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  backgroundColor: '#f8fafc',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #f1f5f9'
                }}>
                  {/* Attendance */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Att. (15)</div>
                    <div style={{ fontSize: '13px', fontWeight: 750, color: '#1e3a8a', marginTop: '2px' }}>
                      {scores.attendance.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>{row.present_activities_count || 0}/4</div>
                  </div>

                  {/* Problem */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Prob. (15)</div>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.5"
                      placeholder="0–15"
                      value={row.problem_statement_marks ?? ''}
                      onChange={(e) => handleFieldChange(id, 'problem_statement_marks', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '52px',
                        padding: '3px 2px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: isProblemInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                        backgroundColor: isProblemInvalid ? '#fef2f2' : '#ffffff',
                        textAlign: 'center',
                        marginTop: '2px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Solution */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Sol. (40)</div>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      step="0.5"
                      placeholder="0–40"
                      value={row.smart_solution_marks ?? ''}
                      onChange={(e) => handleFieldChange(id, 'smart_solution_marks', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '52px',
                        padding: '3px 2px',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '4px',
                        border: isSmartInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                        backgroundColor: isSmartInvalid ? '#fef2f2' : '#ffffff',
                        textAlign: 'center',
                        marginTop: '2px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Total */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Total</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                      {scores.total.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8' }}>/100</div>
                  </div>
                </div>

                {/* Field Activities Row (Inst, Family, Comm) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569' }}>Activities (30M)</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: scores.activities >= 24 ? '#059669' : '#64748b' }}>
                      {scores.activities} / 30
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                    <select
                      value={row.institutional_visit_rating || ''}
                      onChange={(e) => handleFieldChange(id, 'institutional_visit_rating', e.target.value)}
                      style={{
                        padding: '4px 2px',
                        fontSize: '10.5px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: row.institutional_visit_rating ? '#ffffff' : '#fffbeb',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Inst (10)</option>
                      <option value="Excellent">Ex (10)</option>
                      <option value="Good">Gd (8)</option>
                      <option value="Satisfactory">Sat (6)</option>
                      <option value="Unsatisfactory">Unsat (3)</option>
                    </select>

                    <select
                      value={row.family_survey_rating || ''}
                      onChange={(e) => handleFieldChange(id, 'family_survey_rating', e.target.value)}
                      style={{
                        padding: '4px 2px',
                        fontSize: '10.5px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: row.family_survey_rating ? '#ffffff' : '#fffbeb',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Fam (10)</option>
                      <option value="Excellent">Ex (10)</option>
                      <option value="Good">Gd (8)</option>
                      <option value="Satisfactory">Sat (6)</option>
                      <option value="Unsatisfactory">Unsat (3)</option>
                    </select>

                    <select
                      value={row.community_project_rating || ''}
                      onChange={(e) => handleFieldChange(id, 'community_project_rating', e.target.value)}
                      style={{
                        padding: '4px 2px',
                        fontSize: '10.5px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: row.community_project_rating ? '#ffffff' : '#fffbeb',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">Comm (10)</option>
                      <option value="Excellent">Ex (10)</option>
                      <option value="Good">Gd (8)</option>
                      <option value="Satisfactory">Sat (6)</option>
                      <option value="Unsatisfactory">Unsat (3)</option>
                    </select>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <button
                    type="button"
                    onClick={() => setActiveRemarksStudentId(activeRemarksStudentId === id ? null : id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: row.faculty_remarks ? '#eff6ff' : '#ffffff',
                      color: row.faculty_remarks ? '#2563eb' : '#64748b',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <MessageSquare size={12} />
                    <span>{row.faculty_remarks ? 'Remarks ✓' : 'Add Note'}</span>
                  </button>

                  {!isReadOnly && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={() => handleUnlockSingleStudent(id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#059669',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Unlock size={11} /> Unlock
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleRow(id, 'Draft')}
                            disabled={isSavingThisRow || savingAll}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#475569',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSingleRow(id, 'Completed')}
                            disabled={isSavingThisRow || savingAll}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '5px',
                              border: 'none',
                              backgroundColor: '#059669',
                              color: '#ffffff',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Save
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ════ DESKTOP TABLE VIEW ════ */
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '980px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', fontSize: '11px', color: '#475569', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 12px', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 6, width: '200px' }}>
                    Student
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>
                    Att. (15)
                  </th>
                  <th style={{ padding: '10px 12px', width: '280px' }}>
                    Activities (30M)
                  </th>
                  <th style={{ padding: '10px 8px', width: '90px', textAlign: 'center' }}>
                    Problem (15)
                  </th>
                  <th style={{ padding: '10px 8px', width: '95px', textAlign: 'center' }}>
                    Solution (40)
                  </th>
                  <th style={{ padding: '10px 10px', width: '90px', textAlign: 'center' }}>
                    Total (100)
                  </th>
                  <th style={{ padding: '10px 12px', width: '150px', textAlign: 'right' }}>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((st, idx) => {
                  const id = String(st.student_id);
                  const row = evalRows[id] || {};
                  const scores = computeRowScores(row);
                  const isCompleted = row.evaluation_status === 'Completed';
                  const isDraft = row.evaluation_status === 'Draft';
                  const isDirty = dirtyStudentIds.includes(id);
                  const isSavingThisRow = savingRowId === id;
                  const gradeInfo = getGradeInfo(scores.total, row.evaluation_status);

                  let rowBg = idx % 2 === 0 ? '#ffffff' : '#fcfdfe';
                  if (isCompleted) rowBg = '#f0fdf4';
                  else if (isDraft) rowBg = '#fefce8';

                  const isProblemInvalid = row.problem_statement_marks !== '' && (Number(row.problem_statement_marks) < 0 || Number(row.problem_statement_marks) > 15 || isNaN(Number(row.problem_statement_marks)));
                  const isSmartInvalid = row.smart_solution_marks !== '' && (Number(row.smart_solution_marks) < 0 || Number(row.smart_solution_marks) > 40 || isNaN(Number(row.smart_solution_marks)));

                  return (
                    <tr
                      key={id}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Student Info */}
                      <td style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: rowBg,
                        zIndex: 5,
                        padding: '9px 12px',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {isDirty && (
                              <span
                                title="Unsaved changes"
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f59e0b',
                                  display: 'inline-block',
                                  flexShrink: 0
                                }}
                              />
                            )}
                            <span style={{ fontWeight: 650, color: '#0f172a', fontSize: '12.5px' }}>
                              {st.student_name}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {st.prn || 'No PRN'} • {st.department || '—'}
                          </div>
                        </div>
                      </td>

                      {/* Attendance (15M) */}
                      <td style={{
                        padding: '9px 8px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                          {scores.attendance.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                          ({row.present_activities_count || 0}/4)
                        </div>
                      </td>

                      {/* Field Activities (30M) */}
                      <td style={{
                        padding: '9px 12px',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            <select
                              value={row.institutional_visit_rating || ''}
                              onChange={(e) => handleFieldChange(id, 'institutional_visit_rating', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '3px 2px',
                                fontSize: '10.5px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: row.institutional_visit_rating ? '#ffffff' : '#fffbeb',
                                outline: 'none',
                                color: '#0f172a',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">Inst (10)</option>
                              {RATING_OPTIONS.slice(1).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>

                            <select
                              value={row.family_survey_rating || ''}
                              onChange={(e) => handleFieldChange(id, 'family_survey_rating', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '3px 2px',
                                fontSize: '10.5px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: row.family_survey_rating ? '#ffffff' : '#fffbeb',
                                outline: 'none',
                                color: '#0f172a',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">Fam (10)</option>
                              {RATING_OPTIONS.slice(1).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>

                            <select
                              value={row.community_project_rating || ''}
                              onChange={(e) => handleFieldChange(id, 'community_project_rating', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '3px 2px',
                                fontSize: '10.5px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: row.community_project_rating ? '#ffffff' : '#fffbeb',
                                outline: 'none',
                                color: '#0f172a',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="">Comm (10)</option>
                              {RATING_OPTIONS.slice(1).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: scores.activities >= 24 ? '#059669' : '#64748b' }}>
                              {scores.activities} / 30
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Problem Marks (15M) */}
                      <td style={{
                        padding: '9px 8px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.5"
                          placeholder="0–15"
                          value={row.problem_statement_marks ?? ''}
                          onChange={(e) => handleFieldChange(id, 'problem_statement_marks', e.target.value)}
                          style={{
                            width: '58px',
                            padding: '3px 4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: isProblemInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                            backgroundColor: isProblemInvalid ? '#fef2f2' : '#ffffff',
                            color: '#0f172a',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                      </td>

                      {/* Solution Marks (40M) */}
                      <td style={{
                        padding: '9px 8px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <input
                          type="number"
                          min="0"
                          max="40"
                          step="0.5"
                          placeholder="0–40"
                          value={row.smart_solution_marks ?? ''}
                          onChange={(e) => handleFieldChange(id, 'smart_solution_marks', e.target.value)}
                          style={{
                            width: '58px',
                            padding: '3px 4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '4px',
                            border: isSmartInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                            backgroundColor: isSmartInvalid ? '#fef2f2' : '#ffffff',
                            color: '#0f172a',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                      </td>

                      {/* Total & Grade */}
                      <td style={{
                        padding: '9px 10px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            {scores.total.toFixed(1)}
                          </span>
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            backgroundColor: gradeInfo.bg,
                            color: gradeInfo.color,
                            border: `1px solid ${gradeInfo.border}`
                          }}>
                            {gradeInfo.grade}
                          </span>
                        </div>
                      </td>

                      {/* Status & Quick Actions */}
                      <td style={{
                        padding: '9px 12px',
                        textAlign: 'right',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: isCompleted ? '#dcfce7' : isDraft ? '#fef3c7' : '#f1f5f9',
                              color: isCompleted ? '#15803d' : isDraft ? '#b45309' : '#64748b',
                              border: `1px solid ${isCompleted ? '#bbf7d0' : isDraft ? '#fde68a' : '#e2e8f0'}`
                            }}>
                              {isCompleted ? 'Done' : isDraft ? 'Draft' : 'Pending'}
                            </span>

                            <button
                              type="button"
                              onClick={() => setActiveRemarksStudentId(activeRemarksStudentId === id ? null : id)}
                              title={row.faculty_remarks ? `Remarks: ${row.faculty_remarks}` : 'Add note'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '22px',
                                height: '22px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: row.faculty_remarks ? '#eff6ff' : '#ffffff',
                                color: row.faculty_remarks ? '#2563eb' : '#64748b',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              <MessageSquare size={11} />
                            </button>
                          </div>

                          {!isReadOnly && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnlockSingleStudent(id)}
                                  title="Unlock evaluation"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    backgroundColor: '#ffffff',
                                    color: '#059669',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Unlock size={10} />
                                  Unlock
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSingleRow(id, 'Draft')}
                                    disabled={isSavingThisRow || savingAll}
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #cbd5e1',
                                      backgroundColor: '#ffffff',
                                      color: '#475569',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Draft
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSingleRow(id, 'Completed')}
                                    disabled={isSavingThisRow || savingAll}
                                    style={{
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      border: 'none',
                                      backgroundColor: '#059669',
                                      color: '#ffffff',
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Save
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REMARKS POPUP MODAL (CLEAN & NON-GLASSMORPHIC) ── */}
      {activeRemarksStudentId && (() => {
        const row = evalRows[activeRemarksStudentId];
        const st = studentsData.find(s => String(s.student_id) === String(activeRemarksStudentId));
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
            onClick={() => setActiveRemarksStudentId(null)}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                width: '100%',
                maxWidth: '440px',
                padding: '18px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Remarks: {st?.student_name}
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>PRN: {st?.prn || '—'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRemarksStudentId(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={16} />
                </button>
              </div>

              <textarea
                rows={4}
                value={row?.faculty_remarks || ''}
                onChange={e => handleFieldChange(activeRemarksStudentId, 'faculty_remarks', e.target.value)}
                placeholder="Enter evaluation remarks or feedback..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveRemarksStudentId(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveSingleRow(activeRemarksStudentId, row?.evaluation_status || 'Draft');
                      setActiveRemarksStudentId(null);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Save Remarks
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CONFIRMATION MODAL: UNLOCK / LOCK PANEL (CLEAN & NON-GLASSMORPHIC) ── */}
      {confirmLockModal.open && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
          onClick={() => setConfirmLockModal({ open: false, targetLock: true })}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '420px',
              padding: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: confirmLockModal.targetLock ? '#fee2e2' : '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {confirmLockModal.targetLock ? (
                  <Lock size={18} color="#dc2626" />
                ) : (
                  <Unlock size={18} color="#059669" />
                )}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 750, color: '#0f172a' }}>
                  {confirmLockModal.targetLock ? 'Lock Panel Evaluation?' : 'Unlock Panel Evaluation?'}
                </h3>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                  {activePanelObj?.name || 'Selected Panel'}
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              {confirmLockModal.targetLock
                ? 'Locking this panel will finalize all draft evaluations as Completed and prevent further edits.'
                : 'Unlocking will allow assigned faculty mentors to edit and submit evaluations for this panel.'}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setConfirmLockModal({ open: false, targetLock: true })}
                disabled={togglingLock}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleTogglePanelLock(confirmLockModal.targetLock)}
                disabled={togglingLock}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: confirmLockModal.targetLock ? '#dc2626' : '#059669',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: togglingLock ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                {togglingLock ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : confirmLockModal.targetLock ? (
                  <Lock size={13} />
                ) : (
                  <Unlock size={13} />
                )}
                <span>
                  {togglingLock
                    ? 'Processing...'
                    : confirmLockModal.targetLock
                    ? 'Confirm Lock'
                    : 'Confirm Unlock'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
