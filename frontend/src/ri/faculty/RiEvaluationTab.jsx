import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Award,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Save,
  Download,
  ExternalLink,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  X,
  Users,
  Check,
  Info,
  FileText,
  Lock
} from 'lucide-react';
import { cleanPanelName, formatRiDate } from '../shared/riUtils';
import RiStudentWorkspaceModal from './RiStudentWorkspaceModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const RATING_OPTIONS = [
  { value: 'Excellent', label: 'Excellent', score10: 10, score15: 15, score30: 30 },
  { value: 'Good', label: 'Good', score10: 8, score15: 12, score30: 24 },
  { value: 'Satisfactory', label: 'Satisfactory', score10: 6, score15: 9, score30: 18 },
  { value: 'Unsatisfactory', label: 'Unsatisfactory', score10: 3, score15: 5, score30: 10 }
];

const RI_ACTIVITIES = [
  { key: 'SCHOOL_ACTIVITY', label: 'School Activity', shortLabel: 'School' },
  { key: 'INSTITUTIONAL_VISIT', label: 'Institutional Visit', shortLabel: 'Inst. Visit' },
  { key: 'FAMILY_SURVEY', label: 'Family Visit', shortLabel: 'Family Visit' },
  { key: 'COMMUNITY_PROJECT', label: 'Community Project', shortLabel: 'Community Project' }
];

export default function RiEvaluationTab({
  batchId,
  panelId,
  students = [],
  deadlines,
  onEvaluationUpdated,
  authHeaders,
  onOpenWorkspace,
  addToast,
  onNavigateToAttendance
}) {
  const isEvaluationLocked = deadlines?.is_evaluation_locked === true;
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [search, setSearch] = useState('');
  
  // Attendance lock state
  const [attendanceLock, setAttendanceLock] = useState({
    is_locked: false,
    locked_activities_count: 0,
    total_activities_count: 4,
    reason: 'Checking attendance status...'
  });

  // Workspace Modal Popup state
  const [workspaceModalStudentId, setWorkspaceModalStudentId] = useState(null);

  // Mobile specific UI states
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  const EMPTY_EVAL_FORM = {
    institutional_rating: '',
    family_survey_rating: '',
    community_project_rating: '',
    problem_statement_marks: '',
    smart_solution_marks: '',
    faculty_remarks: '',
    status: 'Draft'
  };

  const [evalForm, setEvalForm] = useState(EMPTY_EVAL_FORM);
  const [savedFormState, setSavedFormState] = useState(EMPTY_EVAL_FORM);

  const isDirty = useMemo(() => {
    return JSON.stringify(evalForm) !== JSON.stringify(savedFormState);
  }, [evalForm, savedFormState]);

  const toast = useCallback((msg, type = 'info') => {
    if (addToast) addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  const [fetchedStudents, setFetchedStudents] = useState([]);

  // Fetch panel evaluations to get authoritative attendance_lock status and student forms statuses
  useEffect(() => {
    if (batchId && panelId) {
      fetch(`${API}/api/ri/faculty-portal/evaluations?batch_id=${batchId}&panel_id=${panelId}`, {
        headers: authHeaders
      })
        .then(r => r.json())
        .then(data => {
          if (data && data.attendance_lock) {
            setAttendanceLock(data.attendance_lock);
          }
        })
        .catch(err => console.error('Error fetching attendance lock status:', err));
    }
  }, [batchId, panelId, authHeaders]);

  useEffect(() => {
    if (batchId && panelId && (!students || students.length === 0)) {
      fetch(`${API}/api/ri/faculty-portal/students?batch_id=${batchId}&panel_id=${panelId}&limit=200`, {
        headers: authHeaders
      })
        .then(r => r.json())
        .then(d => {
          if (d && Array.isArray(d.students)) {
            setFetchedStudents(d.students);
          }
        })
        .catch(err => console.error('Error fetching students in evaluation tab:', err));
    }
  }, [batchId, panelId, students, authHeaders]);

  const allStudents = (students && students.length > 0) ? students : fetchedStudents;

  // Set default selected student
  useEffect(() => {
    if (!selectedStudentId && allStudents.length > 0) {
      setSelectedStudentId(allStudents[0].student_id || allStudents[0].id);
    }
  }, [allStudents, selectedStudentId]);

  // Close more menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch full student submission detail & existing evaluation
  const fetchStudentData = useCallback(async (stId) => {
    if (!stId) return;
    setLoadingStudent(true);
    try {
      const q = new URLSearchParams();
      if (batchId) q.append('batch_id', String(batchId));
      if (panelId) q.append('panel_id', String(panelId));

      const res = await fetch(`${API}/api/ri/faculty-portal/students/${stId}/workspace?${q.toString()}`, {
        headers: authHeaders
      });

      if (res.ok) {
        const data = await res.json();
        setStudentDetail(data);

        if (data.attendance_lock) {
          setAttendanceLock(data.attendance_lock);
        }

        if (data.evaluation) {
          const ev = data.evaluation;
          const loaded = {
            institutional_rating: ev.institutional_visit_rating || ev.institutional_visits_rating || '',
            family_survey_rating: ev.family_survey_rating || '',
            community_project_rating: ev.community_project_rating || ev.community_projects_rating || '',
            problem_statement_marks: ev.problem_statement_marks !== null && ev.problem_statement_marks !== undefined ? ev.problem_statement_marks : (ev.sdg_alignment_score ?? ''),
            smart_solution_marks: ev.smart_solution_marks !== null && ev.smart_solution_marks !== undefined ? ev.smart_solution_marks : (ev.problem_solution_marks ?? ''),
            faculty_remarks: ev.faculty_remarks || '',
            status: ev.evaluation_status || ev.status || 'Draft'
          };
          setEvalForm(loaded);
          setSavedFormState(loaded);
        } else {
          setEvalForm(EMPTY_EVAL_FORM);
          setSavedFormState(EMPTY_EVAL_FORM);
        }
      }
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoadingStudent(false);
    }
  }, [batchId, panelId, authHeaders]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentData(selectedStudentId);
    }
  }, [selectedStudentId, fetchStudentData]);

  // Current student navigation indices
  const currentIndex = useMemo(() => {
    return allStudents.findIndex(s => String(s.student_id || s.id) === String(selectedStudentId));
  }, [allStudents, selectedStudentId]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allStudents.length - 1;

  const handlePrevStudent = () => {
    if (hasPrev) {
      setSelectedStudentId(allStudents[currentIndex - 1].student_id || allStudents[currentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (hasNext) {
      setSelectedStudentId(allStudents[currentIndex + 1].student_id || allStudents[currentIndex + 1].id);
    }
  };

  // Open student workspace modal
  const handleOpenWorkspaceModal = (stId) => {
    const targetId = stId || selectedStudentId;
    if (!targetId) return;
    setWorkspaceModalStudentId(targetId);
  };

  // Live Score Calculator based strictly on NEW 100-MARK RUIP Rubric
  const scoreBreakdown = useMemo(() => {
    const rawAtt = studentDetail?.attendance;
    const att = Array.isArray(rawAtt)
      ? rawAtt
      : Array.isArray(rawAtt?.records)
      ? rawAtt.records
      : rawAtt && typeof rawAtt === 'object'
      ? Object.entries(rawAtt).map(([k, v]) => ({ activity: k, status: typeof v === 'object' ? v?.status : v }))
      : [];

    let presentActivitiesCount = 0;
    const activityStatuses = {};
    RI_ACTIVITIES.forEach(act => {
      const isP = att.some(a => (a?.activity === act.key || a?.activity_name === act.key) && (a?.status === 'Present' || a?.status === 'P'));
      activityStatuses[act.key] = isP;
      if (isP) presentActivitiesCount += 1;
    });

    // 1. Attendance (15% Weightage - 15 Marks Max)
    const ATT_MAP = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };
    const attScore = ATT_MAP[presentActivitiesCount] ?? Math.round(presentActivitiesCount * 3.75 * 100) / 100;

    const get10Score = (r) => {
      if (r === 'Excellent') return 10;
      if (r === 'Good') return 8;
      if (r === 'Satisfactory') return 6;
      if (r === 'Unsatisfactory' || r === 'Needs Improvement') return 3;
      return 0;
    };

    // 2. Activities and Field Survey (30% Weightage - 30 Marks Max)
    const instScore = get10Score(evalForm.institutional_rating);
    const famScore = get10Score(evalForm.family_survey_rating);
    const commScore = get10Score(evalForm.community_project_rating);
    const activitiesScore = instScore + famScore + commScore;

    // 3. Problem Statement Identification, Degree Relevance & SDGs Alignment (15% Weightage - 15 Marks Max)
    const rawProb = evalForm.problem_statement_marks === '' ? 0 : Number(evalForm.problem_statement_marks);
    const problemStatementScore = Math.min(15, Math.max(0, isNaN(rawProb) ? 0 : rawProb));

    // 4. Proposed Smart Solution for the Identified Problem Statements Through Report and Presentation (40% Weightage - 40 Marks Max)
    const rawSmart = evalForm.smart_solution_marks === '' ? 0 : Number(evalForm.smart_solution_marks);
    const smartSolutionScore = Math.min(40, Math.max(0, isNaN(rawSmart) ? 0 : rawSmart));

    // Grand Total (100 Marks Max)
    const grandTotal = Math.min(100, Math.round((attScore + activitiesScore + problemStatementScore + smartSolutionScore) * 100) / 100);

    return {
      attendance: attScore,
      presentActivitiesCount,
      activityStatuses,
      activities: activitiesScore,
      instScore,
      famScore,
      commScore,
      problemStatementScore,
      smartSolutionScore,
      grandTotal
    };
  }, [studentDetail, evalForm]);

  const currentStudentObj = useMemo(() => {
    return allStudents.find(s => String(s.student_id || s.id) === String(selectedStudentId)) || studentDetail?.student || studentDetail || {};
  }, [allStudents, selectedStudentId, studentDetail]);

  const isExplicitlyUnlocked = deadlines?.is_explicitly_unlocked === true || studentDetail?.deadlines?.is_explicitly_unlocked === true;

  const isPanelCompleted = useMemo(() => {
    return allStudents.length > 0 && allStudents.every(s => s.evaluation_status === 'Completed');
  }, [allStudents]);

  const isAttendanceLocked = attendanceLock?.is_locked === true;

  const isExistingCompleted = useMemo(() => {
    const currentStatus = studentDetail?.evaluation?.evaluation_status ||
      studentDetail?.evaluation?.status ||
      currentStudentObj?.evaluation_status ||
      currentStudentObj?.status;
    return currentStatus === 'Completed' ||
      currentStatus === 'Submitted' ||
      studentDetail?.evaluation?.is_locked === true ||
      studentDetail?.is_evaluation_locked === true ||
      currentStudentObj?.is_locked === true;
  }, [studentDetail, currentStudentObj]);

  const isFormsCompleted = useMemo(() => {
    if (studentDetail?.forms_completed !== undefined) {
      return studentDetail.forms_completed === true;
    }
    if (currentStudentObj?.forms_completed !== undefined) {
      return currentStudentObj.forms_completed === true;
    }
    return false;
  }, [studentDetail, currentStudentObj]);

  const missingForms = useMemo(() => {
    if (Array.isArray(studentDetail?.missing_forms) && studentDetail.missing_forms.length > 0) {
      return studentDetail.missing_forms;
    }
    if (Array.isArray(currentStudentObj?.missing_forms) && currentStudentObj.missing_forms.length > 0) {
      return currentStudentObj.missing_forms;
    }
    return [];
  }, [studentDetail, currentStudentObj]);

  const isStudentLocked = useMemo(() => {
    if (deadlines?.is_explicitly_locked === true) return true;
    if (isExplicitlyUnlocked) return false;
    if (isEvaluationLocked) return true;
    if (isPanelCompleted) return true;

    // Existing completed evaluations are locked from modifications to preserve historical data
    if (isExistingCompleted) return true;

    // Attendance Lock requirement: panel attendance must be completely locked
    if (!isAttendanceLocked) return true;

    // 6 Mandatory Forms requirement: student must have submitted all 6 forms
    if (!isFormsCompleted) return true;

    return false;
  }, [deadlines, isExplicitlyUnlocked, isEvaluationLocked, isPanelCompleted, isExistingCompleted, isAttendanceLocked, isFormsCompleted]);

  // Save / Finalize Evaluation
  const handleSaveEvaluation = async (submitStatus) => {
    if (!selectedStudentId) return;
    if (!isAttendanceLocked) {
      toast('Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding.', 'error');
      return;
    }
    if (!isFormsCompleted && !isExistingCompleted) {
      toast(`Evaluation Blocked — Student has missing required forms (${missingForms.join(', ') || 'pending'}).`, 'error');
      return;
    }
    if (isStudentLocked) {
      toast('Evaluation is locked and cannot be modified.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        student_id: selectedStudentId,
        batch_id: batchId,
        panel_id: panelId,
        institutional_visits_rating: evalForm.institutional_rating,
        family_survey_rating: evalForm.family_survey_rating,
        community_projects_rating: evalForm.community_project_rating,
        problem_statement_marks: evalForm.problem_statement_marks === '' ? 0 : Number(evalForm.problem_statement_marks),
        smart_solution_marks: evalForm.smart_solution_marks === '' ? 0 : Number(evalForm.smart_solution_marks),
        faculty_remarks: evalForm.faculty_remarks,
        status: submitStatus
      };

      const res = await fetch(`${API}/api/ri/faculty-portal/evaluations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.ok) {
        toast(`Evaluation ${submitStatus === 'Completed' ? 'finalized' : 'saved as draft'}! Score: ${scoreBreakdown.grandTotal}/100`, 'success');
        setEvalForm(prev => ({ ...prev, status: submitStatus }));
        setSavedFormState({ ...evalForm, status: submitStatus });
        fetchStudentData(selectedStudentId);
        if (onEvaluationUpdated) onEvaluationUpdated();
      } else {
        toast(result.message || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      toast('Network error saving evaluation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Download Evaluation Excel
  const handleDownloadExcel = async () => {
    if (!batchId || !panelId) return;
    setDownloadingExcel(true);
    setShowMoreMenu(false);
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
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Evaluation Excel downloaded', 'success');
    } catch (err) {
      toast('Failed to download evaluation Excel', 'error');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const problem = studentDetail?.problem_identification;
  const families = Array.isArray(studentDetail?.family_surveys) ? studentDetail.family_surveys : [];
  const institutions = Array.isArray(studentDetail?.institutional_visits) ? studentDetail.institutional_visits : [];

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return allStudents;
    const q = search.toLowerCase();
    return allStudents.filter(s =>
      (s.name || s.student_name || '').toLowerCase().includes(q) ||
      (s.prn || '').toLowerCase().includes(q) ||
      (s.roll_number || '').toLowerCase().includes(q)
    );
  }, [allStudents, search]);

  return (
    <div className="ri-eval-root" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '70px' }}>
      
      {/* Scoped CSS for Mobile-First Styling & Clean Responsiveness */}
      <style>{`
        .ri-eval-root {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #0f172a;
        }
        .ri-eval-header {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ri-eval-layout {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ri-eval-desktop-sidebar {
          display: none;
        }
        .ri-eval-mobile-selector {
          display: flex;
        }
        .ri-eval-rubric-section {
          padding: 12px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .ri-eval-rubric-section:last-child {
          border-bottom: none;
        }
        .ri-eval-touch-select {
          width: 100%;
          height: 40px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 13.5px;
          background-color: #ffffff;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
        }
        .ri-eval-touch-input {
          width: 100%;
          height: 40px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 13.5px;
          background-color: #ffffff;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
        }
        .ri-eval-sticky-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 50;
          box-shadow: 0 -4px 12px rgba(0,0,0,0.06);
        }

        @media (min-width: 900px) {
          .ri-eval-root {
            padding-bottom: 0;
          }
          .ri-eval-layout {
            display: grid;
            grid-template-columns: 320px 1fr;
            align-items: start;
            gap: 16px;
          }
          .ri-eval-desktop-sidebar {
            display: block;
          }
          .ri-eval-mobile-selector {
            display: none;
          }
          .ri-eval-sticky-footer {
            position: static;
            box-shadow: none;
            border-top: 1px solid #e2e8f0;
            padding: 14px 0 0 0;
            margin-top: 10px;
            background: transparent;
          }
        }
      `}</style>

      {/* ── 1. HEADER ── */}
      <div className="ri-eval-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#047857'
          }}>
            <Award size={16} />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a', lineHeight: 1.2 }}>
              RI Evaluation
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {cleanPanelName(currentStudentObj.panel_name || currentStudentObj.panelName) || `Panel ${panelId || ''}`}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }} ref={moreMenuRef}>
          {/* Desktop Direct Export Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            className="hidden md:flex"
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={13} style={{ color: '#047857' }} />
            <span>{downloadingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {/* More (⋮) Options Menu */}
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="More Options"
          >
            <MoreVertical size={16} />
          </button>

          {showMoreMenu && (
            <div style={{
              position: 'absolute',
              top: '38px',
              right: 0,
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              width: '210px',
              zIndex: 60,
              padding: '4px 0'
            }}>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  handleOpenWorkspaceModal(selectedStudentId);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12.5px',
                  color: '#047857',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <ExternalLink size={14} style={{ color: '#047857' }} />
                <span>Open Student Workspace</span>
              </button>

              <button
                onClick={handleDownloadExcel}
                disabled={downloadingExcel}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12.5px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} style={{ color: '#047857' }} />
                <span>{downloadingExcel ? 'Exporting...' : 'Export Evaluation Excel'}</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  fetchStudentData(selectedStudentId);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '9px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12.5px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} style={{ color: '#64748b' }} />
                <span>Refresh Student Data</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. MOBILE COMPACT STUDENT SELECTOR + PREV/NEXT ── */}
      <div className="ri-eval-mobile-selector" style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '6px 8px',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px'
      }}>
        <button
          onClick={handlePrevStudent}
          disabled={!hasPrev}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            backgroundColor: hasPrev ? '#f8fafc' : '#f1f5f9',
            color: hasPrev ? '#0f172a' : '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasPrev ? 'pointer' : 'default',
            flexShrink: 0
          }}
          title="Previous Student"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={() => setShowStudentPicker(true)}
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
            Student {currentIndex >= 0 ? currentIndex + 1 : '—'} of {allStudents.length} (Tap to change)
          </div>
          <div style={{
            fontWeight: '800',
            fontSize: '13.5px',
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {currentStudentObj.name || currentStudentObj.student_name || 'Select Student'}
          </div>
        </button>

        <button
          onClick={handleNextStudent}
          disabled={!hasNext}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            backgroundColor: hasNext ? '#f8fafc' : '#f1f5f9',
            color: hasNext ? '#0f172a' : '#cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: hasNext ? 'pointer' : 'default',
            flexShrink: 0
          }}
          title="Next Student"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── MOBILE STUDENT PICKER MODAL / DRAWER ── */}
      {showStudentPicker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  Select Student ({allStudents.length})
                </h3>
                <p style={{ margin: '1px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  Tap a student to open rubric or workspace
                </p>
              </div>
              <button
                onClick={() => setShowStudentPicker(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  padding: '4px',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by name, PRN, or roll..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Student List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No matching students
                </div>
              ) : (
                filteredStudents.map(st => {
                  const sId = st.student_id || st.id;
                  const isSel = String(sId) === String(selectedStudentId);
                  const isEvaluated = !!st.evaluation_status && st.evaluation_status !== 'Draft';

                  return (
                    <div
                      key={sId}
                      onClick={() => {
                        setSelectedStudentId(sId);
                        setShowStudentPicker(false); // Auto-collapse
                      }}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #f8fafc',
                        backgroundColor: isSel ? '#f0fdf4' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                        <div style={{ fontWeight: isSel ? '800' : '600', fontSize: '13.5px', color: '#0f172a' }}>
                          {st.name || st.student_name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                          PRN: {st.prn || 'N/A'}{st.roll_number ? ` • Roll: ${st.roll_number}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentId(sId);
                            setShowStudentPicker(false);
                            handleOpenWorkspaceModal(sId);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #10b981',
                            backgroundColor: '#ecfdf5',
                            color: '#047857',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <ExternalLink size={11} />
                          <span>Workspace</span>
                        </button>

                        {st.total_score !== undefined && st.total_score !== null ? (
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857' }}>
                            {st.total_score}M
                          </span>
                        ) : isEvaluated ? (
                          <CheckCircle2 size={15} style={{ color: '#047857' }} />
                        ) : st.forms_completed === false ? (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '700',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            border: '1px solid #fdba74'
                          }}>
                            Forms Pending
                          </span>
                        ) : null}
                        {isSel && <Check size={16} style={{ color: '#047857' }} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN TWO-COLUMN / SINGLE-COLUMN LAYOUT ── */}
      <div className="ri-eval-layout">
        
        {/* Desktop Sidebar Student List (Hidden on Mobile) */}
        <div className="ri-eval-desktop-sidebar" style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div style={{ fontWeight: '800', fontSize: '12.5px', color: '#0f172a', marginBottom: '8px' }}>
              Panel Students ({allStudents.length})
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {filteredStudents.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No students found
              </div>
            ) : (
              filteredStudents.map(st => {
                const sId = st.student_id || st.id;
                const isSel = String(sId) === String(selectedStudentId);
                const isEvaluated = !!st.evaluation_status && st.evaluation_status !== 'Draft';

                return (
                  <div
                    key={sId}
                    onClick={() => setSelectedStudentId(sId)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      backgroundColor: isSel ? '#f0fdf4' : '#ffffff',
                      borderLeft: isSel ? '4px solid #047857' : '4px solid transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '4px' }}>
                      <div style={{ fontWeight: isSel ? '800' : '600', fontSize: '12.5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {st.name || st.student_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                        PRN: {st.prn || 'N/A'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(sId);
                          handleOpenWorkspaceModal(sId);
                        }}
                        style={{
                          padding: '3px 6px',
                          borderRadius: '4px',
                          border: '1px solid #10b981',
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}
                        title="Open Student Workspace Modal"
                      >
                        <ExternalLink size={10} />
                        <span>Workspace</span>
                      </button>

                      {st.total_score !== undefined && st.total_score !== null ? (
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#047857' }}>
                          {st.total_score}M
                        </span>
                      ) : isEvaluated ? (
                        <CheckCircle2 size={14} style={{ color: '#047857' }} />
                      ) : st.forms_completed === false ? (
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: '700',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: '#fff7ed',
                          color: '#c2410c',
                          border: '1px solid #fdba74'
                        }}>
                          Forms Pending
                        </span>
                      ) : (
                        <Clock size={13} style={{ color: '#94a3b8' }} />
                      )}
                      <ChevronRight size={13} style={{ color: isSel ? '#047857' : '#cbd5e1' }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right / Main Content: Student Info, Evidence Summary, Rubric Scoring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isEvaluationLocked ? (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#991b1b',
              fontSize: '12.5px',
              fontWeight: '700'
            }}>
              <Lock size={16} color="#dc2626" style={{ flexShrink: 0 }} />
              <span>Evaluation is locked. The 15-day deadline following the RI field visit ended on {formatRiDate(deadlines?.evaluation_deadline)}. Submissions and changes are disabled.</span>
            </div>
          ) : !isAttendanceLocked ? (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1.5px solid #fcd34d',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Lock size={18} color="#b45309" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#92400e' }}>
                    Evaluation Locked — Complete and lock attendance for all students in your assigned panel before proceeding.
                  </div>
                  <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                    Progress: <strong>{attendanceLock?.locked_activities_count || 0} of {attendanceLock?.total_activities_count || 4} activities locked</strong>
                    {attendanceLock?.reason ? ` (${attendanceLock.reason})` : ''}
                  </div>
                </div>
              </div>
              {onNavigateToAttendance && (
                <button
                  onClick={onNavigateToAttendance}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d97706',
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Clock size={14} />
                  <span>Go to RI Attendance</span>
                </button>
              )}
            </div>
          ) : !isFormsCompleted && !isExistingCompleted ? (
            <div style={{
              backgroundColor: '#fff7ed',
              border: '1.5px solid #fdba74',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <AlertTriangle size={18} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#c2410c' }}>
                  Evaluation Blocked — Student has not submitted all 6 mandatory RI forms.
                </div>
                <div style={{ fontSize: '12px', color: '#9a3412', marginTop: '2px' }}>
                  Evaluation rubric inputs are disabled for this student. Other students in the panel with completed forms remain eligible.
                </div>
                {missingForms.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#9a3412' }}>Missing Forms ({missingForms.length}):</span>
                    {missingForms.map((f, i) => (
                      <span key={i} style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#ffedd5',
                        color: '#9a3412',
                        border: '1px solid #fed7aa'
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : isExistingCompleted ? (
            <div style={{
              backgroundColor: '#ecfdf5',
              border: '1.5px solid #a7f3d0',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#065f46',
              fontSize: '12.5px',
              fontWeight: '700'
            }}>
              <Lock size={16} color="#059669" style={{ flexShrink: 0 }} />
              <span>Evaluation is finalized as Completed and cannot be edited.</span>
            </div>
          ) : null}

          {loadingStudent ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Loading student data...</div>
            </div>
          ) : !studentDetail ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '32px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>Select a student to start evaluation.</div>
            </div>
          ) : (
            <>
              {/* ── 3. STUDENT ESSENTIAL INFO (With prominent "Open Workspace" button) ── */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a', lineHeight: 1.2 }}>
                    {studentDetail?.student?.name || studentDetail?.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    PRN: <strong>{studentDetail?.student?.prn || studentDetail?.prn || 'N/A'}</strong> • {cleanPanelName(studentDetail?.student?.panel_name || studentDetail?.panel_name || `Panel ${panelId}`)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Prominent Open Workspace Button */}
                  <button
                    onClick={() => handleOpenWorkspaceModal(selectedStudentId)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 1px 2px rgba(4,120,87,0.08)'
                    }}
                    title="Open Student Submission Workspace (Overview, Attendance, Forms, Problem, Project, etc.)"
                  >
                    <ExternalLink size={13} />
                    <span>Open Workspace</span>
                  </button>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: studentDetail?.evaluation?.evaluation_status === 'Completed' ? '#dcfce7' : '#fef3c7',
                    color: studentDetail?.evaluation?.evaluation_status === 'Completed' ? '#15803d' : '#b45309'
                  }}>
                    {studentDetail?.evaluation?.evaluation_status || 'Pending'}
                  </span>
                </div>
              </div>

              {/* ── 4. SUBMITTED EVIDENCE SUMMARY (Compact List) ── */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '10px 14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Submitted Evidence
                  </div>
                  <button
                    onClick={() => handleOpenWorkspaceModal(selectedStudentId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#047857',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <span>View All Forms</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    <div style={{ color: '#64748b', fontSize: '10.5px', fontWeight: '700' }}>ATTENDANCE</div>
                    <div style={{ fontWeight: '800', color: scoreBreakdown.attendance === 15 ? '#15803d' : '#b45309', marginTop: '1px' }}>
                      {scoreBreakdown.presentActivitiesCount}/4 Present
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    <div style={{ color: '#64748b', fontSize: '10.5px', fontWeight: '700' }}>INSTITUTIONAL</div>
                    <div style={{ fontWeight: '800', color: institutions.length > 0 ? '#15803d' : '#dc2626', marginTop: '1px' }}>
                      {institutions.length > 0 ? `${institutions.length} Recorded` : 'Not Submitted'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    <div style={{ color: '#64748b', fontSize: '10.5px', fontWeight: '700' }}>FAMILY VISIT</div>
                    <div style={{ fontWeight: '800', color: families.length > 0 ? '#15803d' : '#dc2626', marginTop: '1px' }}>
                      {families.length > 0 ? `${families.length} Families` : 'Not Submitted'}
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                    <div style={{ color: '#64748b', fontSize: '10.5px', fontWeight: '700' }}>PROBLEM STATEMENT</div>
                    <div style={{ fontWeight: '800', color: problem ? '#15803d' : '#dc2626', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {problem ? 'Submitted' : 'Not Submitted'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 5. RUBRIC SCORING (Main Focus) ── */}
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                padding: '14px 16px'
              }}>
                
                {/* 1. ATTENDANCE (15% Weightage) */}
                <div className="ri-eval-rubric-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                      1. Attendance (15%)
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                      {scoreBreakdown.attendance} / 15 M
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Auto-calculated from 4 activities ({scoreBreakdown.presentActivitiesCount}/4 Present)
                  </div>
                </div>

                {/* 2. ACTIVITIES AND FIELD SURVEY (30% Weightage) */}
                <div className="ri-eval-rubric-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                      2. Activities & Field Survey (30%)
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                      {scoreBreakdown.activities} / 30 M
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Institutional Visit (10 M)
                      </div>
                      <select
                        disabled={isStudentLocked}
                        className="ri-eval-touch-select"
                        value={evalForm.institutional_rating}
                        onChange={e => setEvalForm({ ...evalForm, institutional_rating: e.target.value })}
                        style={{
                          backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                          cursor: isStudentLocked ? 'not-allowed' : 'pointer',
                          color: isStudentLocked ? '#64748b' : '#0f172a'
                        }}
                      >
                        <option value="">-- Select Rating --</option>
                        {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Family Visit (10 M)
                      </div>
                      <select
                        disabled={isStudentLocked}
                        className="ri-eval-touch-select"
                        value={evalForm.family_survey_rating}
                        onChange={e => setEvalForm({ ...evalForm, family_survey_rating: e.target.value })}
                        style={{
                          backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                          cursor: isStudentLocked ? 'not-allowed' : 'pointer',
                          color: isStudentLocked ? '#64748b' : '#0f172a'
                        }}
                      >
                        <option value="">-- Select Rating --</option>
                        {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                        Community Project (10 M)
                      </div>
                      <select
                        disabled={isStudentLocked}
                        className="ri-eval-touch-select"
                        value={evalForm.community_project_rating}
                        onChange={e => setEvalForm({ ...evalForm, community_project_rating: e.target.value })}
                        style={{
                          backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                          cursor: isStudentLocked ? 'not-allowed' : 'pointer',
                          color: isStudentLocked ? '#64748b' : '#0f172a'
                        }}
                      >
                        <option value="">-- Select Rating --</option>
                        {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. PROBLEM STATEMENT IDENTIFICATION & SDGs (15% Weightage) */}
                <div className="ri-eval-rubric-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                        3. Problem Statement & SDGs (15%)
                      </span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                      {scoreBreakdown.problemStatementScore} / 15 M
                    </span>
                  </div>

                  <div>
                    <select
                      disabled={isStudentLocked}
                      className="ri-eval-touch-select"
                      value={evalForm.problem_statement_marks}
                      onChange={e => setEvalForm({ ...evalForm, problem_statement_marks: e.target.value })}
                      style={{
                        backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                        cursor: isStudentLocked ? 'not-allowed' : 'pointer',
                        color: isStudentLocked ? '#64748b' : '#0f172a'
                      }}
                    >
                      <option value="">-- Select Marks (0 – 15 M) --</option>
                      <option value="15">Excellent (15 Marks)</option>
                      <option value="13.5">Very Good (13.5 Marks)</option>
                      <option value="12">Good (12 Marks)</option>
                      <option value="9">Satisfactory (9 Marks)</option>
                      <option value="5">Needs Improvement (5 Marks)</option>
                      <option value="0">Unsatisfactory (0 Marks)</option>
                    </select>
                  </div>
                </div>

                {/* 4. PROPOSED SMART SOLUTION (40% Weightage) */}
                <div className="ri-eval-rubric-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                        4. Proposed SMART Solution (40%)
                      </span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>
                      {scoreBreakdown.smartSolutionScore} / 40 M
                    </span>
                  </div>

                  <div>
                    <select
                      disabled={isStudentLocked}
                      className="ri-eval-touch-select"
                      value={evalForm.smart_solution_marks}
                      onChange={e => setEvalForm({ ...evalForm, smart_solution_marks: e.target.value })}
                      style={{
                        backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                        cursor: isStudentLocked ? 'not-allowed' : 'pointer',
                        color: isStudentLocked ? '#64748b' : '#0f172a'
                      }}
                    >
                      <option value="">-- Select Marks (0 – 40 M) --</option>
                      <option value="40">Exceptional (40 Marks)</option>
                      <option value="36">Excellent (36 Marks)</option>
                      <option value="32">Good (32 Marks)</option>
                      <option value="28">Above Average (28 Marks)</option>
                      <option value="24">Satisfactory (24 Marks)</option>
                      <option value="15">Needs Improvement (15 Marks)</option>
                      <option value="0">Unsatisfactory (0 Marks)</option>
                    </select>
                  </div>
                </div>

                {/* ── 7. REMARKS ── */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                    Faculty Remarks
                  </div>
                  <textarea
                    rows={2}
                    placeholder={isStudentLocked ? "No remarks" : "Enter assessment remarks..."}
                    disabled={isStudentLocked}
                    value={evalForm.faculty_remarks}
                    onChange={e => setEvalForm({ ...evalForm, faculty_remarks: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: isStudentLocked ? '#f8fafc' : '#ffffff',
                      cursor: isStudentLocked ? 'not-allowed' : 'text',
                      color: isStudentLocked ? '#64748b' : '#0f172a'
                    }}
                  />
                </div>

                {/* ── 8. STICKY SCORE + SAVE BAR (Desktop & Mobile) ── */}
                <div className="ri-eval-sticky-footer">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>TOTAL:</span>
                      <span style={{ fontSize: '18px', fontWeight: '900', color: '#047857' }}>
                        {scoreBreakdown.grandTotal} / 100
                      </span>
                    </div>
                    {isDirty && !isStudentLocked && (
                      <span style={{ fontSize: '10.5px', color: '#d97706', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }} />
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!isStudentLocked ? (
                      <>
                        <button
                          onClick={() => handleSaveEvaluation('Draft')}
                          disabled={saving}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            cursor: saving ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Draft
                        </button>

                        <button
                          onClick={() => handleSaveEvaluation('Completed')}
                          disabled={saving}
                          style={{
                            padding: '7px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#047857',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Save size={14} />
                          <span>{saving ? 'Saving...' : 'Finalize & Lock'}</span>
                        </button>
                      </>
                    ) : (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        backgroundColor: !isAttendanceLocked ? '#fffbeb' : !isFormsCompleted && !isExistingCompleted ? '#fff7ed' : '#f1f5f9',
                        border: !isAttendanceLocked ? '1px solid #fcd34d' : !isFormsCompleted && !isExistingCompleted ? '1px solid #fdba74' : '1px solid #e2e8f0',
                        color: !isAttendanceLocked ? '#b45309' : !isFormsCompleted && !isExistingCompleted ? '#c2410c' : '#475569',
                        fontSize: '12.5px',
                        fontWeight: '700'
                      }}>
                        <Lock size={14} />
                        <span>
                          {!isAttendanceLocked
                            ? 'Attendance Not Locked'
                            : !isFormsCompleted && !isExistingCompleted
                            ? 'Forms Pending'
                            : isExistingCompleted
                            ? 'Evaluation Finalized'
                            : 'Evaluation Locked'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

      </div>

      {/* ── 9. STUDENT WORKSPACE POPUP MODAL (Reusing RiStudentWorkspaceModal) ── */}
      {workspaceModalStudentId && (
        <RiStudentWorkspaceModal
          studentId={workspaceModalStudentId}
          initialTab="overview"
          batchId={batchId}
          panelId={panelId}
          isEvaluationLocked={isEvaluationLocked}
          authHeaders={authHeaders}
          onClose={() => setWorkspaceModalStudentId(null)}
          onEvaluationSaved={() => {
            fetchStudentData(workspaceModalStudentId);
            if (onEvaluationUpdated) onEvaluationUpdated();
          }}
          addToast={addToast}
        />
      )}

    </div>
  );
}
