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
  MessageSquare
} from 'lucide-react';
import { formatRiDate } from '../shared/riUtils';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

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

export default function RiAllEvaluationTab({
  batchId,
  panelId,
  deadlines,
  onEvaluationUpdated,
  onNavigateToAttendance,
  authHeaders,
  onOpenWorkspace,
  addToast,
  isMobile = false,
  onRegisterActions
}) {
  const isEvaluationLocked = deadlines?.is_evaluation_locked === true;
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [savingRowStatus, setSavingRowStatus] = useState(null);
  const [confirmLockModalOpen, setConfirmLockModalOpen] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Panel Attendance lock gating state
  const [attendanceLock, setAttendanceLock] = useState({
    is_locked: false,
    locked_activities_count: 0,
    total_activities_count: 4,
    activities: []
  });

  // Explicit panel locking state
  const [isPanelLocked, setIsPanelLocked] = useState(false);
  const [panelLock, setPanelLock] = useState({ is_locked: false, is_explicitly_unlocked: false, lock_reason: '' });
  const isExplicitlyUnlocked = panelLock.is_explicitly_unlocked === true;

  // Raw server records
  const [studentsData, setStudentsData] = useState([]);
  // Working local state keyed by student_id
  const [evalRows, setEvalRows] = useState({});
  // Baseline snapshot for dirty checking
  const [initialRows, setInitialRows] = useState({});

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, DRAFT, NOT_EVALUATED, UNSAVED

  // Active remarks popup state
  const [activeRemarksStudentId, setActiveRemarksStudentId] = useState(null);

  const toastRef = useRef(addToast);
  useEffect(() => {
    toastRef.current = addToast;
  }, [addToast]);

  const toast = useCallback((msg, type = 'info') => {
    if (toastRef.current) toastRef.current(msg, type);
    else alert(msg);
  }, []);

  // Check if a specific row is locked from editing (permanent once completed or locked, unless Super Admin explicitly unlocked)
  const isRowLocked = useCallback((row) => {
    if (isEvaluationLocked) return true;
    if (isPanelLocked) return true;
    if (isExplicitlyUnlocked) return false;
    if (row?.is_locked === true) return true;
    if (row?.evaluation_status === 'Completed' || row?.evaluation_status === 'Submitted') return true;
    return false;
  }, [isEvaluationLocked, isPanelLocked, isExplicitlyUnlocked]);

  // Fetch all students with attendance and evaluation status
  const fetchPanelEvaluations = useCallback(async () => {
    if (!batchId || !panelId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ batch_id: String(batchId), panel_id: String(panelId) });
      const res = await fetch(`${API}/api/ri/faculty-portal/evaluations?${q.toString()}`, {
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error('Failed to load panel evaluations');
      }

      const data = await res.json();
      if (data.attendance_lock) {
        setAttendanceLock(data.attendance_lock);
      }
      const students = data.students || [];
      setStudentsData(students);

      const rowsMap = {};
      students.forEach(st => {
        const id = st.student_id;
        const presentCount = st.present_activities_count ?? 0;
        const autoAtt = ATT_MAP[presentCount] ?? Number((presentCount * 3.75).toFixed(2));
        const attMarks = st.attendance_marks !== null && st.attendance_marks !== undefined
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
          evaluation_status: (st.evaluation_status === 'Completed' || st.evaluation_status === 'Submitted' || st.evaluation_status === 'Draft') ? st.evaluation_status : (st.has_existing_evaluation ? 'Draft' : 'Pending'),
          has_existing_evaluation: !!st.has_existing_evaluation,
          is_locked: !!st.is_locked,
          forms_completed: st.forms_completed !== false,
          missing_forms: st.missing_forms || [],
          last_saved_status: (st.evaluation_status === 'Completed' || st.evaluation_status === 'Submitted' || st.evaluation_status === 'Draft') ? st.evaluation_status : (st.has_existing_evaluation ? 'Draft' : 'Pending')
        };
      });

      setEvalRows(rowsMap);
      setInitialRows(JSON.parse(JSON.stringify(rowsMap)));

      // CRITICAL FIX: Use the authoritative panel-level lock state from the backend.
      // The backend now returns `panel_lock.is_locked` and `panel_lock.is_explicitly_unlocked`
      // which reflect the true state from ri_evaluation_locks (Super Admin overrides).
      //
      // DO NOT derive panel lock state from student evaluation_status counts — that caused the
      // mismatch where Faculty showed "All Evaluations Locked" while SuperAdmin showed "Open".
      //
      // `data.is_locked` is the panel-level admin lock (NOT student-level Completed status).
      // `data.panel_lock.is_explicitly_unlocked === true` means SA has explicitly opened the panel.
      const fetchedLock = data.panel_lock || {};
      setPanelLock(fetchedLock);
      const isExplicitlyUnlockedNow = fetchedLock.is_explicitly_unlocked === true;
      const isAdminPanelLocked = data.is_locked === true;

      if (isExplicitlyUnlockedNow) {
        // Super Admin has explicitly unlocked this panel — it is open regardless of student statuses
        setIsPanelLocked(false);
      } else if (isAdminPanelLocked || deadlines?.is_evaluation_locked) {
        // Panel is administratively locked (deadline or SA lock)
        setIsPanelLocked(true);
      } else if (data.all_evaluations_locked) {
        // All students individually locked by faculty (no SA override)
        setIsPanelLocked(true);
      } else {
        setIsPanelLocked(false);
      }
    } catch (err) {
      console.error('Error fetching panel evaluations:', err);
      toast('Failed to load evaluation records', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, panelId, authHeaders, deadlines?.is_evaluation_locked, toast]);

  useEffect(() => {
    fetchPanelEvaluations();
  }, [batchId, panelId]);

  // Helper to compute a single row's live score breakdown
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
      if (isRowLocked(current)) {
        return prev;
      }
      return {
        ...prev,
        [studentId]: {
          ...current,
          [field]: value
        }
      };
    });
  }, [isRowLocked]);

  // Determine if a specific student row has unsaved modifications
  const isRowDirty = useCallback((studentId) => {
    const cur = evalRows[studentId];
    const init = initialRows[studentId];
    if (!cur || !init) return false;
    return (
      cur.institutional_visit_rating !== init.institutional_visit_rating ||
      cur.family_survey_rating !== init.family_survey_rating ||
      cur.community_project_rating !== init.community_project_rating ||
      String(cur.problem_statement_marks ?? '') !== String(init.problem_statement_marks ?? '') ||
      String(cur.smart_solution_marks ?? '') !== String(init.smart_solution_marks ?? '') ||
      (cur.faculty_remarks || '') !== (init.faculty_remarks || '') ||
      cur.evaluation_status !== init.evaluation_status
    );
  }, [evalRows, initialRows]);

  // List of all dirty student IDs
  const dirtyStudentIds = useMemo(() => {
    return Object.keys(evalRows).filter(id => isRowDirty(id));
  }, [evalRows, isRowDirty]);

  // Row validation check (returns error string or null)
  const validateRow = useCallback((row) => {
    if (!row) return null;
    if (row.problem_statement_marks !== '' && row.problem_statement_marks !== null) {
      const num = Number(row.problem_statement_marks);
      if (isNaN(num) || num < 0 || num > 15) {
        return 'Problem Statement marks must be between 0 and 15';
      }
    }
    if (row.smart_solution_marks !== '' && row.smart_solution_marks !== null) {
      const num = Number(row.smart_solution_marks);
      if (isNaN(num) || num < 0 || num > 40) {
        return 'SMART Solution marks must be between 0 and 40';
      }
    }
    return null;
  }, []);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return studentsData.filter(st => {
      const id = st.student_id;
      const row = evalRows[id];
      const initial = initialRows[id];

      // Search match
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const nameMatch = (st.student_name || '').toLowerCase().includes(term);
        const prnMatch = (st.prn || '').toLowerCase().includes(term);
        const rollMatch = (st.roll_number || '').toLowerCase().includes(term);
        const deptMatch = (st.department || '').toLowerCase().includes(term);
        if (!nameMatch && !prnMatch && !rollMatch && !deptMatch) {
          return false;
        }
      }

      // Status filter
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'UNSAVED') return isRowDirty(id);
      if (statusFilter === 'COMPLETED') return row?.evaluation_status === 'Completed';
      if (statusFilter === 'DRAFT') return row?.evaluation_status === 'Draft';
      if (statusFilter === 'NOT_EVALUATED') return !row?.evaluation_status || row?.evaluation_status === 'Pending' || row?.evaluation_status === 'Not Evaluated';

      return true;
    });
  }, [studentsData, evalRows, initialRows, search, statusFilter, isRowDirty]);

  // Aggregate panel statistics
  const panelStats = useMemo(() => {
    const total = studentsData.length;
    let completed = 0;
    let draft = 0;
    let notEvaluated = 0;
    let totalScoreSum = 0;

    studentsData.forEach(st => {
      const row = evalRows[st.student_id];
      const status = row?.evaluation_status;
      if (status === 'Completed') {
        completed++;
      } else if (status === 'Draft') {
        draft++;
      } else {
        notEvaluated++;
      }

      const scores = computeRowScores(row);
      totalScoreSum += scores.total;
    });

    const avgScore = total > 0 ? (totalScoreSum / total).toFixed(1) : 0;

    return {
      total,
      completed,
      draft,
      notEvaluated,
      avgScore
    };
  }, [studentsData, evalRows, computeRowScores]);

  // Save single student evaluation
  const handleSaveSingleRow = async (studentId, forcedStatus = null) => {
    const row = evalRows[studentId];
    if (isEvaluationLocked || isPanelLocked || (row && isRowLocked(row))) {
      toast('This evaluation has been locked and cannot be modified.', 'error');
      return;
    }

    if (!attendanceLock.is_locked) {
      toast(`Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding. (${attendanceLock.locked_activities_count} of ${attendanceLock.total_activities_count} activities locked).`, 'error');
      return;
    }

    const studentObj = studentsData.find(s => s.student_id === Number(studentId));
    if (studentObj && !studentObj.forms_completed) {
      const missing = (studentObj.missing_forms || []).join(', ') || 'Mandatory forms pending';
      toast(`Evaluation blocked for this student: The following mandatory forms have not been submitted: ${missing}.`, 'error');
      return;
    }

    if (!row) return;

    const validationErr = validateRow(row);
    if (validationErr) {
      toast(validationErr, 'error');
      return;
    }

    const targetStatus = forcedStatus || (row.evaluation_status === 'Completed' ? 'Completed' : 'Draft');
    setSavingRowId(studentId);
    setSavingRowStatus(targetStatus);

    try {
      const payload = {
        student_id: studentId,
        batch_id: batchId,
        panel_id: panelId,
        institutional_visit_rating: row.institutional_visit_rating || '',
        institutional_visits_rating: row.institutional_visit_rating || '',
        family_survey_rating: row.family_survey_rating || '',
        community_project_rating: row.community_project_rating || '',
        community_projects_rating: row.community_project_rating || '',
        problem_statement_marks: row.problem_statement_marks === '' ? 0 : Number(row.problem_statement_marks),
        smart_solution_marks: row.smart_solution_marks === '' ? 0 : Number(row.smart_solution_marks),
        faculty_remarks: row.faculty_remarks || '',
        evaluation_status: targetStatus,
        status: targetStatus
      };

      const res = await fetch(`${API}/api/ri/faculty-portal/evaluations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok) {
        const studentObj = studentsData.find(s => s.student_id === Number(studentId));
        const sName = studentObj?.student_name || 'student';
        toast(`Evaluation for ${sName} saved as ${targetStatus}!`, 'success');

        const updatedRow = {
          ...row,
          evaluation_status: targetStatus,
          has_existing_evaluation: true,
          is_locked: targetStatus === 'Completed',
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
        setStudentsData(prev => prev.map(s => s.student_id === Number(studentId) ? { ...s, evaluation_status: targetStatus, is_locked: targetStatus === 'Completed', has_existing_evaluation: true } : s));

        if (onEvaluationUpdated) onEvaluationUpdated();
      } else {
        toast(result.message || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Error saving evaluation:', err);
      toast('Network error saving evaluation', 'error');
    } finally {
      setSavingRowId(null);
      setSavingRowStatus(null);
    }
  };

  // Bulk save all evaluations
  const handleSaveAll = async (forcedStatus = null) => {
    if (isEvaluationLocked || isPanelLocked) {
      toast('Evaluation is locked. Changes cannot be saved.', 'error');
      return;
    }

    if (!attendanceLock.is_locked) {
      toast(`Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding. (${attendanceLock.locked_activities_count} of ${attendanceLock.total_activities_count} activities locked).`, 'error');
      return;
    }

    // Filter out rows that are already locked
    const candidateIds = (forcedStatus === 'Completed'
      ? Object.keys(evalRows).filter(id => !isRowLocked(evalRows[id]))
      : (dirtyStudentIds.length > 0
          ? dirtyStudentIds.filter(id => !isRowLocked(evalRows[id]))
          : Object.keys(evalRows).filter(id => !isRowLocked(evalRows[id]))
        )
    );

    // Only students who have completed all 6 mandatory forms are eligible for evaluation
    const targetIds = candidateIds.filter(id => {
      const st = studentsData.find(s => s.student_id === Number(id));
      return st && st.forms_completed;
    });

    const ineligibleCount = candidateIds.length - targetIds.length;
    if (ineligibleCount > 0 && forcedStatus === 'Completed') {
      toast(`Cannot finalize all evaluations: ${ineligibleCount} student(s) have pending mandatory forms.`, 'error');
      return;
    }

    if (targetIds.length === 0) {
      if (candidateIds.length > 0 && ineligibleCount > 0) {
        toast('Cannot save evaluations: Selected students have pending mandatory forms.', 'error');
      } else if (forcedStatus === 'Completed') {
        toast('All evaluations are already locked.', 'info');
      } else {
        toast('No evaluations to save.', 'info');
      }
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
          institutional_visits_rating: row.institutional_visit_rating || '',
          family_survey_rating: row.family_survey_rating || '',
          community_project_rating: row.community_project_rating || '',
          community_projects_rating: row.community_project_rating || '',
          problem_statement_marks: row.problem_statement_marks === '' ? 0 : Number(row.problem_statement_marks),
          smart_solution_marks: row.smart_solution_marks === '' ? 0 : Number(row.smart_solution_marks),
          faculty_remarks: row.faculty_remarks || '',
          evaluation_status: status,
          status
        };
      });

      const res = await fetch(`${API}/api/ri/faculty-portal/evaluations/bulk`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          batch_id: batchId,
          panel_id: panelId,
          evaluations: evaluationsPayload
        })
      });

      const result = await res.json();
      if (res.ok) {
        const successMsg = forcedStatus === 'Completed'
          ? `All ${result.count || targetIds.length} evaluations saved and locked as Completed!`
          : `Successfully saved ${result.count || targetIds.length} evaluations!`;
        toast(successMsg, 'success');

        // Update initialRows snapshot
        setInitialRows(prev => {
          const next = { ...prev };
          targetIds.forEach(id => {
            const status = forcedStatus || (evalRows[id]?.evaluation_status === 'Completed' ? 'Completed' : 'Draft');
            next[id] = {
              ...evalRows[id],
              evaluation_status: status,
              has_existing_evaluation: true,
              last_saved_status: status
            };
          });
          return next;
        });

        // Update evalRows
        setEvalRows(prev => {
          const next = { ...prev };
          targetIds.forEach(id => {
            const status = forcedStatus || (prev[id]?.evaluation_status === 'Completed' ? 'Completed' : 'Draft');
            if (next[id]) {
              next[id] = {
                ...next[id],
                evaluation_status: status,
                has_existing_evaluation: true,
                last_saved_status: status
              };
            }
          });
          return next;
        });

        // Update studentsData so filters and stats update immediately
        setStudentsData(prev => {
          return prev.map(s => {
            if (targetIds.includes(String(s.student_id))) {
              const status = forcedStatus || (evalRows[s.student_id]?.evaluation_status === 'Completed' ? 'Completed' : 'Draft');
              return {
                ...s,
                evaluation_status: status,
                has_existing_evaluation: true
              };
            }
            return s;
          });
        });

        if (forcedStatus === 'Completed') {
          setIsPanelLocked(true);
        }

        if (onEvaluationUpdated) onEvaluationUpdated();
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

  // Download Evaluation Excel
  const handleDownloadExcel = async () => {
    if (!batchId || !panelId) return;
    setDownloadingExcel(true);
    try {
      const q = new URLSearchParams({ batch_id: String(batchId), panel_id: String(panelId) });
      const res = await fetch(`${API}/api/ri/faculty-portal/exports/evaluation?${q.toString()}`, {
        headers: { Authorization: authHeaders.Authorization }
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RI_Evaluation_Panel_${panelId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast('Evaluation sheet exported successfully', 'success');
    } catch (err) {
      console.error('Export error:', err);
      toast('Failed to download evaluation sheet', 'error');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const isAllLocked = isEvaluationLocked || isPanelLocked || (!isExplicitlyUnlocked && panelStats.total > 0 && panelStats.completed === panelStats.total);

  // Keep a mutable ref of current actions to avoid infinite re-render loops with parent
  const actionsRef = useRef({});
  actionsRef.current = {
    refresh: fetchPanelEvaluations,
    exportExcel: handleDownloadExcel,
    saveAll: () => handleSaveAll(),
    dirtyCount: dirtyStudentIds.length,
    savingAll,
    loading,
    downloadingExcel,
    isLocked: isAllLocked
  };

  useEffect(() => {
    if (typeof onRegisterActions === 'function') {
      onRegisterActions({
        refresh: () => actionsRef.current.refresh?.(),
        exportExcel: () => actionsRef.current.exportExcel?.(),
        saveAll: (forcedStatus = null) => {
          const status = typeof forcedStatus === 'string' ? forcedStatus : null;
          return actionsRef.current.saveAll?.(status);
        },
        dirtyCount: dirtyStudentIds.length,
        savingAll,
        loading,
        downloadingExcel,
        isLocked: isAllLocked
      });
    }
  }, [
    onRegisterActions,
    dirtyStudentIds.length,
    savingAll,
    loading,
    downloadingExcel,
    isAllLocked
  ]);

  useEffect(() => {
    return () => {
      if (typeof onRegisterActions === 'function') {
        onRegisterActions(null);
      }
    };
  }, [onRegisterActions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Attendance Incomplete / Unlocked Banner */}
      {!loading && !attendanceLock.is_locked && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#fffbeb',
          border: '1.5px solid #fde68a',
          borderRadius: '10px',
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              flexShrink: 0
            }}>
              <Lock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding.
              </div>
              <div style={{ fontSize: '12.5px', color: '#b45309', marginTop: '3px' }}>
                Progress: <strong>{attendanceLock.locked_activities_count || 0} of {attendanceLock.total_activities_count || 4}</strong> mandatory activities locked.
              </div>
            </div>
          </div>
          {onNavigateToAttendance && (
            <button
              type="button"
              onClick={onNavigateToAttendance}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#d97706',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <span>Go to RI Attendance</span>
            </button>
          )}
        </div>
      )}

      {/* Unsaved Changes Floating / Top Warning */}
      {dirtyStudentIds.length > 0 && !isEvaluationLocked && (
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '13px', fontWeight: 600 }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#f59e0b',
              display: 'inline-block',
              animation: 'pulse 1.5s infinite'
            }} />
            You have unsaved evaluation changes for {dirtyStudentIds.length} student{dirtyStudentIds.length !== 1 ? 's' : ''}.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSaveAll('Draft');
              }}
              disabled={savingAll}
              style={{
                padding: '6px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #d97706',
                color: '#b45309',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: savingAll ? 'not-allowed' : 'pointer'
              }}
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleSaveAll('Completed');
              }}
              disabled={savingAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                backgroundColor: '#d97706',
                border: 'none',
                color: '#ffffff',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: savingAll ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 3px rgba(217, 119, 6, 0.25)'
              }}
            >
              <Save size={14} />
              {savingAll ? 'Saving All...' : 'Save & Finalize All'}
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '340px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search student by name, PRN, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {search && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSearch('');
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status Filter Pills & Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `All (${studentsData.length})` },
              { id: 'COMPLETED', label: `Completed (${panelStats.completed})` },
              { id: 'DRAFT', label: `Draft (${panelStats.draft})` },
              { id: 'NOT_EVALUATED', label: `Pending (${panelStats.notEvaluated})` },
              ...(dirtyStudentIds.length > 0 ? [{ id: 'UNSAVED', label: `Unsaved (${dirtyStudentIds.length})` }] : [])
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setStatusFilter(pill.id);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === pill.id ? 700 : 500,
                  border: '1px solid',
                  borderColor: statusFilter === pill.id ? (pill.id === 'UNSAVED' ? '#d97706' : '#2563eb') : '#e2e8f0',
                  backgroundColor: statusFilter === pill.id ? (pill.id === 'UNSAVED' ? '#fef3c7' : '#eff6ff') : '#ffffff',
                  color: statusFilter === pill.id ? (pill.id === 'UNSAVED' ? '#b45309' : '#1d4ed8') : '#64748b',
                  cursor: 'pointer'
                }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', height: '22px', backgroundColor: '#e2e8f0', display: 'inline-block' }} />

          {/* Save and Save & Lock Buttons or Locked Badge */}
          {!isAllLocked ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isExplicitlyUnlocked && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 9px',
                  borderRadius: '6px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  <Unlock size={11} />
                  <span>Evaluation Open (Unlocked by Super Admin)</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSaveAll('Draft')}
                disabled={!attendanceLock.is_locked || savingAll || loading}
                title={!attendanceLock.is_locked ? "Evaluation Locked: Attendance must be completed and locked across all activities" : "Save evaluations as Draft"}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d97706',
                  backgroundColor: !attendanceLock.is_locked ? '#f8fafc' : '#fffbeb',
                  color: !attendanceLock.is_locked ? '#94a3b8' : '#b45309',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: (!attendanceLock.is_locked || savingAll || loading) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Save size={13} />
                {savingAll ? 'Saving...' : dirtyStudentIds.length > 0 ? `Save (${dirtyStudentIds.length})` : 'Save'}
              </button>

              <button
                type="button"
                onClick={() => setConfirmLockModalOpen(true)}
                disabled={!attendanceLock.is_locked || savingAll || loading}
                title={!attendanceLock.is_locked ? "Evaluation Locked: Attendance must be completed and locked across all activities" : "Save and lock all evaluations as Completed"}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #16a34a',
                  backgroundColor: !attendanceLock.is_locked ? '#f1f5f9' : '#16a34a',
                  color: !attendanceLock.is_locked ? '#94a3b8' : '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: (!attendanceLock.is_locked || savingAll || loading) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Lock size={13} />
                Save and Lock
              </button>
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '6px',
              backgroundColor: isEvaluationLocked ? '#fee2e2' : '#ecfdf5',
              border: `1px solid ${isEvaluationLocked ? '#fecaca' : '#a7f3d0'}`,
              color: isEvaluationLocked ? '#991b1b' : '#065f46',
              fontSize: '12px',
              fontWeight: 600
            }}>
              <Lock size={12} />
              {isEvaluationLocked ? 'Evaluation Deadline Ended (Locked)' : (panelLock.is_explicitly_locked ? 'Evaluation Locked by Super Admin' : `All Evaluations Locked (${panelStats.completed}/${panelStats.total})`)}
            </div>
          )}
        </div>
      </div>

      {/* Save and Lock Confirmation Modal */}
      {confirmLockModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
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
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
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
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Save and Lock All Evaluations?
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  This will finalize marks and mark all panel evaluations as Completed.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '12.5px',
              color: '#334155',
              lineHeight: '1.5'
            }}>
              <div><strong>Students to finalize:</strong> {studentsData.length} students</div>
              <div><strong>Current Completed:</strong> {panelStats.completed}</div>
              <div><strong>Current Draft:</strong> {panelStats.draft}</div>
              <div><strong>Pending:</strong> {panelStats.notEvaluated}</div>
              <p style={{ margin: '8px 0 0 0', color: '#b45309', fontSize: '11.5px', fontWeight: 500 }}>
                ⚠️ Once finalized, all marks will be committed with <strong>Completed</strong> status.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmLockModalOpen(false)}
                disabled={savingAll}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAll}
                onClick={async () => {
                  setConfirmLockModalOpen(false);
                  await handleSaveAll('Completed');
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: savingAll ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {savingAll ? <RefreshCw size={13} className="spin" /> : <Lock size={13} />}
                Confirm & Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={28} className="spin" style={{ margin: '0 auto 12px auto', color: '#2563eb' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Loading Panel Evaluation Roster...</div>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>Fetching students, attendance, and scoring records.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
            <Users size={32} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>No Students Found</div>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>
              {search ? 'Try adjusting your search criteria.' : 'No students enrolled for this panel in the selected batch.'}
            </p>
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            position: 'relative'
          }}>
            <table style={{
              width: '100%',
              minWidth: '1000px',
              borderCollapse: 'separate',
              borderSpacing: 0,
              textAlign: 'left',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10
                }}>
                  {/* Sticky Col 1: Student Name & PRN */}
                  <th style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 12,
                    backgroundColor: '#f8fafc',
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '210px',
                    minWidth: '210px',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Student Name & PRN
                  </th>

                  {/* Col 2: Attendance (15%) - Narrow, Marks only */}
                  <th style={{
                    padding: '10px 12px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '95px',
                    minWidth: '95px',
                    textAlign: 'center',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Attendance (15%)
                  </th>

                  {/* Col 3: Activities & Field Survey (30%) - Clean single header */}
                  <th style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '360px',
                    minWidth: '360px',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Activities & Field Survey (30%)
                  </th>

                  {/* Col 4: Problem Statement & SDGs (15%) */}
                  <th style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '140px',
                    minWidth: '140px',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Problem & SDGs (15%)
                  </th>

                  {/* Col 5: Proposed SMART Solution (40%) */}
                  <th style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '145px',
                    minWidth: '145px',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    SMART Solution (40%)
                  </th>

                  {/* Col 6: Total Marks (100%) */}
                  <th style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '120px',
                    minWidth: '120px',
                    borderBottom: '2px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    Total (100%)
                  </th>

                  {/* Col 7: Actions & Status */}
                  <th style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    color: '#0f172a',
                    width: '150px',
                    minWidth: '150px',
                    borderBottom: '2px solid #e2e8f0'
                  }}>
                    Status & Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.map((st, idx) => {
                  const id = st.student_id;
                  const row = evalRows[id] || {};
                  const isDirty = isRowDirty(id);
                  const isSavingThisRow = savingRowId === id;
                  const scores = computeRowScores(row);
                  const gradeInfo = getGradeInfo(scores.total, row.evaluation_status);
                  // Dynamic row styling: yellowish if Draft, greenish if Completed, orange if Forms Pending
                  const isCompleted = row.evaluation_status === 'Completed' || row.evaluation_status === 'Submitted';
                  const isDraft = row.evaluation_status === 'Draft';
                  const isFormsPending = !st.forms_completed && !isCompleted;
                  const isEvalDisabled = isRowLocked(row) || !attendanceLock.is_locked || isFormsPending;

                  let rowBg = idx % 2 === 0 ? '#ffffff' : '#fcfdfe';
                  let rowHoverBg = '#f8fafc';
                  let rowBorderColor = '#f1f5f9';

                  if (isCompleted) {
                    rowBg = '#f0fdf4'; // Light soft greenish tint
                    rowHoverBg = '#dcfce7'; // Deeper soft green on hover
                    rowBorderColor = '#bbf7d0';
                  } else if (isFormsPending) {
                    rowBg = '#fff7ed'; // Light soft orange/amber tint
                    rowHoverBg = '#ffedd5'; // Deeper soft orange on hover
                    rowBorderColor = '#fed7aa';
                  } else if (isDraft) {
                    rowBg = '#fefce8'; // Light soft yellowish tint
                    rowHoverBg = '#fef9c3'; // Deeper soft yellow on hover
                    rowBorderColor = '#fde047';
                  }

                  // Validation flags
                  const isProblemInvalid = row.problem_statement_marks !== '' && (Number(row.problem_statement_marks) < 0 || Number(row.problem_statement_marks) > 15 || isNaN(Number(row.problem_statement_marks)));
                  const isSmartInvalid = row.smart_solution_marks !== '' && (Number(row.smart_solution_marks) < 0 || Number(row.smart_solution_marks) > 40 || isNaN(Number(row.smart_solution_marks)));

                  return (
                    <tr
                      key={id}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: `1px solid ${rowBorderColor}`,
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = rowHoverBg;
                        const stickyCell = e.currentTarget.querySelector('.sticky-cell');
                        if (stickyCell) stickyCell.style.backgroundColor = rowHoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = rowBg;
                        const stickyCell = e.currentTarget.querySelector('.sticky-cell');
                        if (stickyCell) stickyCell.style.backgroundColor = rowBg;
                      }}
                    >
                      {/* Sticky Col 1: Student Name & PRN (Clean, no department) */}
                      <td
                        className="sticky-cell"
                        style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 5,
                          backgroundColor: rowBg,
                          padding: '10px 14px',
                          borderBottom: `1px solid ${rowBorderColor}`,
                          borderRight: '1px solid #e2e8f0',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isDirty && (
                              <span
                                title="Unsaved changes in this row"
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
                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                              {st.student_name}
                            </span>
                          </div>

                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {st.prn || 'No PRN'}
                          </div>

                          {/* Quick Workspace inspect trigger */}
                          <div style={{ marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={() => onOpenWorkspace && onOpenWorkspace(id, 'evaluation')}
                              title="Open full student workspace modal"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10.5px',
                                color: '#2563eb',
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                fontWeight: 500
                              }}
                            >
                              <ExternalLink size={10} />
                              Workspace
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Attendance (15%) - Only the marks shown, clean */}
                      <td style={{
                        padding: '10px 12px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        borderRight: '1px solid #e2e8f0',
                        textAlign: 'center',
                        verticalAlign: 'middle'
                      }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e3a8a' }}>
                          {scores.attendance.toFixed(2)}
                        </span>
                      </td>

                      {/* Col 3: Activities & Field Survey (30%) */}
                      <td style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        borderRight: '1px solid #e2e8f0',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '6px'
                          }}>
                            {/* 1. Institutional Visit Dropdown */}
                            <div>
                              <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                Inst. (10)
                              </div>
                              <select
                                disabled={isEvalDisabled}
                                value={row.institutional_visit_rating || ''}
                                onChange={(e) => handleFieldChange(id, 'institutional_visit_rating', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 3px',
                                  fontSize: '11px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: isEvalDisabled ? '#f8fafc' : (row.institutional_visit_rating ? '#ffffff' : '#fffbeb'),
                                  outline: 'none',
                                  color: isEvalDisabled ? '#64748b' : '#0f172a',
                                  cursor: isEvalDisabled ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {RATING_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* 2. Family Visit Dropdown */}
                            <div>
                              <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                Family (10)
                              </div>
                              <select
                                disabled={isEvalDisabled}
                                value={row.family_survey_rating || ''}
                                onChange={(e) => handleFieldChange(id, 'family_survey_rating', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 3px',
                                  fontSize: '11px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: isEvalDisabled ? '#f8fafc' : (row.family_survey_rating ? '#ffffff' : '#fffbeb'),
                                  outline: 'none',
                                  color: isEvalDisabled ? '#64748b' : '#0f172a',
                                  cursor: isEvalDisabled ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {RATING_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>

                            {/* 3. Community Project Dropdown */}
                            <div>
                              <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                Comm. (10)
                              </div>
                              <select
                                disabled={isEvalDisabled}
                                value={row.community_project_rating || ''}
                                onChange={(e) => handleFieldChange(id, 'community_project_rating', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 3px',
                                  fontSize: '11px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: isEvalDisabled ? '#f8fafc' : (row.community_project_rating ? '#ffffff' : '#fffbeb'),
                                  outline: 'none',
                                  color: isEvalDisabled ? '#64748b' : '#0f172a',
                                  cursor: isEvalDisabled ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {RATING_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Subtotal */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: scores.activities >= 24 ? '#15803d' : '#475569'
                            }}>
                              {scores.activities} / 30
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Col 4: Problem Statement & SDGs (15%) */}
                      <td style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        borderRight: '1px solid #e2e8f0',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <input
                            type="number"
                            min="0"
                            max="15"
                            step="0.5"
                            placeholder="0–15"
                            disabled={isEvalDisabled}
                            value={row.problem_statement_marks ?? ''}
                            onChange={(e) => handleFieldChange(id, 'problem_statement_marks', e.target.value)}
                            style={{
                              width: '70px',
                              padding: '5px 7px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              borderRadius: '5px',
                              border: isProblemInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                              backgroundColor: isEvalDisabled ? '#f8fafc' : (isProblemInvalid ? '#fef2f2' : '#ffffff'),
                              color: isEvalDisabled ? '#64748b' : '#0f172a',
                              cursor: isEvalDisabled ? 'not-allowed' : 'text',
                              outline: 'none'
                            }}
                          />
                          {isProblemInvalid && (
                            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>
                              0–15 only
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 5: Proposed SMART Solution (40%) */}
                      <td style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        borderRight: '1px solid #e2e8f0',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            placeholder="0–40"
                            disabled={isEvalDisabled}
                            value={row.smart_solution_marks ?? ''}
                            onChange={(e) => handleFieldChange(id, 'smart_solution_marks', e.target.value)}
                            style={{
                              width: '75px',
                              padding: '5px 7px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              borderRadius: '5px',
                              border: isSmartInvalid ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                              backgroundColor: isEvalDisabled ? '#f8fafc' : (isSmartInvalid ? '#fef2f2' : '#ffffff'),
                              color: isEvalDisabled ? '#64748b' : '#0f172a',
                              cursor: isEvalDisabled ? 'not-allowed' : 'text',
                              outline: 'none'
                            }}
                          />
                          {isSmartInvalid && (
                            <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>
                              0–40 only
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 6: Total Marks (100%) */}
                      <td style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        borderRight: '1px solid #e2e8f0',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {scores.total.toFixed(2)}
                          </span>
                          <span style={{
                            display: 'inline-block',
                            width: 'fit-content',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            backgroundColor: gradeInfo.bg,
                            color: gradeInfo.color,
                            border: `1px solid ${gradeInfo.border}`
                          }}>
                            {gradeInfo.grade}
                          </span>
                        </div>
                      </td>

                      {/* Col 7: Status & Actions */}
                      <td style={{
                        padding: '10px 14px',
                        borderBottom: `1px solid ${rowBorderColor}`,
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            {/* Current Status Pill */}
                            {row.evaluation_status === 'Completed' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0'
                              }}>
                                <CheckCircle2 size={11} /> Completed
                              </span>
                            ) : isFormsPending ? (
                              <span
                                title={`Pending mandatory forms:\n• ${(st.missing_forms || []).join('\n• ')}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  backgroundColor: '#ffedd5',
                                  color: '#c2410c',
                                  border: '1px solid #fed7aa',
                                  cursor: 'help'
                                }}
                              >
                                <AlertTriangle size={11} /> Forms Pending
                              </span>
                            ) : row.evaluation_status === 'Draft' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a'
                              }}>
                                <Clock size={11} /> Draft
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #e2e8f0'
                              }}>
                                Pending
                              </span>
                            )}

                            {/* Remarks Button */}
                            <button
                              type="button"
                              onClick={() => setActiveRemarksStudentId(activeRemarksStudentId === id ? null : id)}
                              title={row.faculty_remarks ? `Remarks: ${row.faculty_remarks}` : 'Add faculty remarks'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: row.faculty_remarks ? '#eff6ff' : '#ffffff',
                                color: row.faculty_remarks ? '#2563eb' : '#64748b',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              <MessageSquare size={12} />
                            </button>
                          </div>

                          {/* Missing forms indicator subtitle if pending */}
                          {isFormsPending && st.missing_forms && st.missing_forms.length > 0 && (
                            <div
                              style={{ fontSize: '10px', color: '#b45309', lineHeight: '1.2' }}
                              title={`Missing: ${st.missing_forms.join(', ')}`}
                            >
                              {st.missing_forms.length} form{st.missing_forms.length !== 1 ? 's' : ''} missing
                            </div>
                          )}

                          {/* Quick Row Action Buttons: Draft & Save or Gated Status */}
                          {!isRowLocked(row) ? (
                            !attendanceLock.is_locked ? (
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '3px 0' }}>
                                Attendance Unlocked
                              </div>
                            ) : isFormsPending ? (
                              <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 600, padding: '3px 0' }} title={`Missing forms: ${(st.missing_forms || []).join(', ')}`}>
                                Forms Incomplete
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {/* Draft Button */}
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleRow(id, 'Draft')}
                                  disabled={isSavingThisRow || savingAll}
                                  title="Save student evaluation as Draft"
                                  style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #d97706',
                                    backgroundColor: (isSavingThisRow && savingRowStatus === 'Draft') ? '#fef3c7' : '#ffffff',
                                    color: '#b45309',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: (isSavingThisRow || savingAll) ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Clock size={11} />
                                  {isSavingThisRow && savingRowStatus === 'Draft' ? 'Saving...' : 'Draft'}
                                </button>

                                {/* Save (Complete) Button */}
                                <button
                                  type="button"
                                  onClick={() => handleSaveSingleRow(id, 'Completed')}
                                  disabled={isSavingThisRow || savingAll}
                                  title="Save student evaluation as Completed"
                                  style={{
                                    flex: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '3px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid #16a34a',
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: (isSavingThisRow || savingAll) ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <Check size={11} />
                                  {isSavingThisRow && savingRowStatus === 'Completed' ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            )
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #e2e8f0'
                              }}>
                                <Lock size={11} /> Locked
                              </span>
                            </div>
                          )}

                          {/* Inline Remarks Input Modal / Drawer if active */}
                          {activeRemarksStudentId === id && (
                            <div style={{
                              marginTop: '4px',
                              padding: '6px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>Faculty Remarks:</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveRemarksStudentId(null)}
                                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                                >
                                  <X size={11} />
                                </button>
                              </div>
                              <textarea
                                rows={2}
                                placeholder={isRowLocked(row) ? "No remarks" : "Add remarks..."}
                                disabled={isRowLocked(row)}
                                value={row.faculty_remarks || ''}
                                onChange={(e) => handleFieldChange(id, 'faculty_remarks', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  fontSize: '11px',
                                  borderRadius: '3px',
                                  border: '1px solid #cbd5e1',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                  fontFamily: 'inherit',
                                  resize: 'vertical',
                                  backgroundColor: isRowLocked(row) ? '#f1f5f9' : '#ffffff',
                                  color: isRowLocked(row) ? '#64748b' : '#0f172a',
                                  cursor: isRowLocked(row) ? 'not-allowed' : 'text'
                                }}
                              />
                              {isRowLocked(row) && (
                                <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                                  Evaluation is locked and cannot be edited.
                                </span>
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
        )}
      </div>

    </div>
  );
}
