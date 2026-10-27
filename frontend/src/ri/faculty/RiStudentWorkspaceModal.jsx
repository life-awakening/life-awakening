import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  ClipboardCheck,
  FileText,
  Home,
  Building2,
  Users,
  Award,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  Save,
  Send,
  Star,
  RefreshCw,
  MapPin,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Phone,
  Mail,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Download,
  File,
  Image as ImageIcon,
  Eye,
  Lock
} from 'lucide-react';
import { cleanPanelName } from '../shared/riUtils';
import RiFamilySurveyView from '../shared/RiFamilySurveyView';
import RiInstitutionView from '../shared/RiInstitutionView';
import SecureImage from '../shared/SecureImage';
import { resolveCleanFileUrl, openSecureFile, downloadSecureFile } from '../utils/secureFileHelpers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Robust file URL resolution ensuring correct API domain and static access without token leaks
const resolveFileUrl = (url) => resolveCleanFileUrl(url);

const getFileDetails = (url, fallbackName = 'Document') => {
  if (!url) return null;
  const resolved = resolveFileUrl(url);
  let name = fallbackName;
  try {
    if (url.includes('key=')) {
      const keyVal = decodeURIComponent(url.split('key=')[1].split('&')[0]);
      const cleanBase = keyVal.split('/').pop() || '';
      const match = cleanBase.match(/^ri_\d+_[a-f0-9]+_(.+)$/);
      if (match && match[1]) {
        name = match[1];
      } else if (cleanBase) {
        name = cleanBase;
      }
    } else {
      const parsed = url.startsWith('http') ? new URL(url) : null;
      const pathname = parsed ? parsed.pathname : url;
      const base = pathname.split('/').pop()?.split('?')[0] || '';
      if (base) {
        name = decodeURIComponent(base);
        const cleanMatch = name.match(/^ri_\d+_(.+)$/);
        if (cleanMatch && cleanMatch[1]) {
          name = cleanMatch[1];
        }
      }
    }
  } catch {}

  const ext = (name.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isDoc = ['doc', 'docx'].includes(ext);
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
  const isExternal = !url.includes('/uploads/') && !url.includes('/api/ri/student/files/view');

  return {
    rawUrl: url,
    resolvedUrl: resolved,
    fileName: name,
    extension: ext,
    isPdf,
    isDoc,
    isImage,
    isExternal
  };
};

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

export default function RiStudentWorkspaceModal({
  studentId,
  initialTab = 'overview',
  batchId,
  panelId,
  isEvaluationLocked: propIsEvalLocked = false,
  authHeaders,
  onClose,
  onEvaluationSaved,
  addToast
}) {
  const [activeTab, setActiveTab] = useState(() => {
    if (['family', 'institution', 'problem', 'community', 'feedback', 'undertaking', 'checklist'].includes(initialTab)) {
      return 'forms';
    }
    return initialTab || 'overview';
  });
  const [inspectedForm, setInspectedForm] = useState(() => {
    if (initialTab === 'family') return 'family';
    if (initialTab === 'institution') return 'institutional';
    if (initialTab === 'problem') return 'problem';
    if (initialTab === 'community') return 'daily_activity';
    if (initialTab === 'feedback') return 'feedback';
    if (initialTab === 'undertaking') return 'undertaking';
    if (initialTab === 'checklist') return 'checklist';
    return null;
  });
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [savingEval, setSavingEval] = useState(false);
  const [requestingCorrection, setRequestingCorrection] = useState(false);
  const [correctionNote, setCorrectionNote] = useState('');
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  // Evaluation Form State
  const [evalForm, setEvalForm] = useState({
    institutional_rating: '',
    family_survey_rating: '',
    community_project_rating: '',
    problem_statement_marks: '',
    smart_solution_marks: '',
    faculty_remarks: '',
    status: 'Draft'
  });

  const isExplicitlyUnlocked = workspace?.deadlines?.is_explicitly_unlocked === true;

  const isEvaluationLocked = !isExplicitlyUnlocked && (
    propIsEvalLocked ||
    workspace?.is_evaluation_locked === true ||
    workspace?.evaluation?.is_locked === true ||
    workspace?.evaluation?.evaluation_status === 'Completed' ||
    workspace?.evaluation?.evaluation_status === 'Submitted' ||
    workspace?.deadlines?.is_evaluation_locked === true ||
    evalForm?.status === 'Completed' ||
    evalForm?.status === 'Submitted'
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toast = useCallback((msg, type = 'info') => {
    if (addToast) addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  // Fetch full student workspace data
  const fetchWorkspace = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (batchId) q.append('batch_id', String(batchId));
      if (panelId) q.append('panel_id', String(panelId));

      const res = await fetch(`${API}/api/ri/faculty-portal/students/${studentId}/workspace?${q.toString()}`, {
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error('Failed to load student workspace');
      }

      const data = await res.json();
      setWorkspace(data);

      // Pre-fill evaluation form if existing
      if (data.evaluation) {
        const ev = data.evaluation;
        setEvalForm({
          institutional_rating: ev.institutional_visit_rating || ev.institutional_visits_rating || '',
          family_survey_rating: ev.family_survey_rating || '',
          community_project_rating: ev.community_project_rating || ev.community_projects_rating || '',
          problem_statement_marks: ev.problem_statement_marks !== null && ev.problem_statement_marks !== undefined ? ev.problem_statement_marks : (ev.sdg_alignment_score ?? ''),
          smart_solution_marks: ev.smart_solution_marks !== null && ev.smart_solution_marks !== undefined ? ev.smart_solution_marks : (ev.problem_solution_marks ?? ''),
          faculty_remarks: ev.faculty_remarks || '',
          status: ev.evaluation_status || ev.status || 'Draft'
        });
      } else {
        setEvalForm({
          institutional_rating: '',
          family_survey_rating: '',
          community_project_rating: '',
          problem_statement_marks: '',
          smart_solution_marks: '',
          faculty_remarks: '',
          status: 'Draft'
        });
      }
    } catch (err) {
      console.error('Error loading student workspace:', err);
      toast('Failed to load student data', 'error');
    } finally {
      setLoading(false);
    }
  }, [studentId, batchId, panelId, authHeaders, toast]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  // Normalize attendance records
  const rawAtt = workspace?.attendance;
  const attendance = useMemo(() => {
    if (Array.isArray(rawAtt)) return rawAtt;
    if (Array.isArray(rawAtt?.records)) return rawAtt.records;
    if (rawAtt && typeof rawAtt === 'object') {
      return Object.entries(rawAtt).map(([k, v]) => {
        if (typeof v === 'object' && v !== null) return { activity: k, ...v };
        return { activity: k, status: v };
      });
    }
    return [];
  }, [rawAtt]);

  // Live Score Calculator based strictly on the NEW 100-MARK RUIP Rubric
  const calculatedMarks = useMemo(() => {
    // 1. Attendance (15% Weightage — 15 Marks Max)
    // 4/4 Present = 15 marks, 3/4 = 11.25, 2/4 = 7.50, 1/4 = 3.75, 0/4 = 0
    const activityStatuses = {};
    let presentActivitiesCount = 0;

    RI_ACTIVITIES.forEach(act => {
      const isP = attendance.some(a => (a?.activity === act.key || a?.activity_name === act.key) && (a?.status === 'Present' || a?.status === 'P'));
      activityStatuses[act.key] = isP;
      if (isP) presentActivitiesCount += 1;
    });

    const ATT_SCALE = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };
    const attScore = ATT_SCALE[presentActivitiesCount] ?? Math.round(presentActivitiesCount * 3.75 * 100) / 100;

    // Helper rating to score out of 10
    const get10Score = (r) => {
      if (r === 'Excellent') return 10;
      if (r === 'Good') return 8;
      if (r === 'Satisfactory') return 6;
      if (r === 'Unsatisfactory' || r === 'Needs Improvement') return 3;
      return 0;
    };

    // 2. Activities and Field Survey (30% Weightage — 30 Marks Max)
    // Inst (10) + Family (10) + Comm (10)
    const instScore = get10Score(evalForm.institutional_rating);
    const famScore = get10Score(evalForm.family_survey_rating);
    const commScore = get10Score(evalForm.community_project_rating);
    const activitiesTotal = instScore + famScore + commScore;

    // 3. Problem Statement Identification, Degree Relevance & SDGs Alignment (15% Weightage — 15 Marks Max)
    const rawProb = evalForm.problem_statement_marks === '' ? 0 : Number(evalForm.problem_statement_marks);
    const problemStatementScore = Math.min(15, Math.max(0, isNaN(rawProb) ? 0 : rawProb));

    // 4. Proposed Smart Solution for the Identified Problem Statements Through Report and Presentation (40% Weightage — 40 Marks Max)
    const rawSmart = evalForm.smart_solution_marks === '' ? 0 : Number(evalForm.smart_solution_marks);
    const smartSolutionScore = Math.min(40, Math.max(0, isNaN(rawSmart) ? 0 : rawSmart));

    // Grand Total (100 Marks Max)
    const grandTotal = Math.min(100, Math.round((attScore + activitiesTotal + problemStatementScore + smartSolutionScore) * 100) / 100);

    return {
      attendance: attScore,
      presentActivitiesCount,
      activityStatuses,
      activities: activitiesTotal,
      instScore,
      famScore,
      commScore,
      problemStatementScore,
      smartSolutionScore,
      grandTotal
    };
  }, [attendance, evalForm]);

  // Save / Finalize Evaluation
  const handleSaveEvaluation = async (submitStatus) => {
    if (!studentId) return;
    if (isEvaluationLocked) {
      toast('This evaluation has been locked and cannot be modified.', 'error');
      return;
    }
    setSavingEval(true);
    try {
      const payload = {
        student_id: studentId,
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
        toast(`Evaluation ${submitStatus === 'Completed' ? 'finalized & recorded' : 'saved as draft'}! Total Score: ${calculatedMarks.grandTotal}/100`, 'success');
        if (onEvaluationSaved) onEvaluationSaved();
        fetchWorkspace();
      } else {
        toast(result.message || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Error saving evaluation:', err);
      toast('Network error saving evaluation', 'error');
    } finally {
      setSavingEval(false);
    }
  };

  // Request Student Correction
  const handleRequestCorrection = async () => {
    if (isEvaluationLocked) {
      toast('This evaluation has been locked and cannot be modified.', 'error');
      return;
    }
    if (!correctionNote.trim()) {
      toast('Please enter notes explaining the required correction', 'error');
      return;
    }
    setRequestingCorrection(true);
    try {
      const payload = {
        student_id: studentId,
        batch_id: batchId,
        panel_id: panelId,
        institutional_visits_rating: evalForm.institutional_rating,
        family_survey_rating: evalForm.family_survey_rating,
        community_projects_rating: evalForm.community_project_rating,
        problem_statement_marks: evalForm.problem_statement_marks === '' ? 0 : Number(evalForm.problem_statement_marks),
        smart_solution_marks: evalForm.smart_solution_marks === '' ? 0 : Number(evalForm.smart_solution_marks),
        faculty_remarks: evalForm.faculty_remarks,
        status: 'Requires Correction',
        correction_notes: correctionNote
      };

      const res = await fetch(`${API}/api/ri/faculty-portal/evaluations`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast('Correction requested. Student notified.', 'warning');
        setShowCorrectionModal(false);
        setCorrectionNote('');
        if (onEvaluationSaved) onEvaluationSaved();
        fetchWorkspace();
      } else {
        const d = await res.json();
        toast(d.message || 'Failed to request correction', 'error');
      }
    } catch (err) {
      console.error('Correction request error:', err);
      toast('Network error', 'error');
    } finally {
      setRequestingCorrection(false);
    }
  };

  const student = workspace?.student || {};
  const formsSummary = Array.isArray(workspace?.forms_summary) ? workspace.forms_summary : [];
  const families = Array.isArray(workspace?.family_surveys) ? workspace.family_surveys : [];
  const institutions = Array.isArray(workspace?.institutional_visits) ? workspace.institutional_visits : [];
  const problem = workspace?.problem_identification || null;
  const project = workspace?.community_project || null;
  const checklist = workspace?.preparatory_checklist || null;
  const undertaking = workspace?.undertaking || null;
  const feedback = workspace?.student_feedback || null;
  const dailyActivity = workspace?.daily_activity || workspace?.daily_activity_report || null;

  const tabList = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'forms', label: 'Forms & Submissions', icon: FileText },
    { id: 'evaluation', label: 'Evaluation', icon: Award, highlight: true }
  ];

  const renderFormStatusBadge = (formStatus, isSubmitted) => {
    if (isSubmitted || formStatus === 'Submitted') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          backgroundColor: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0'
        }}>
          ✓ Submitted
        </span>
      );
    }
    if (formStatus === 'Reviewed') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          border: '1px solid #86efac'
        }}>
          ✓ Reviewed
        </span>
      );
    }
    if (formStatus === 'Requires Correction') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          backgroundColor: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fca5a5'
        }}>
          ⚠ Needs Correction
        </span>
      );
    }
    if (formStatus === 'Draft') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          backgroundColor: '#fef3c7',
          color: '#b45309',
          border: '1px solid #fde68a'
        }}>
          ● Draft / In Progress
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 9px',
        borderRadius: '9999px',
        fontSize: '11.5px',
        fontWeight: '700',
        backgroundColor: '#f1f5f9',
        color: '#64748b',
        border: '1px solid #cbd5e1'
      }}>
        ○ Not Started
      </span>
    );
  };

  const getProgressBarColor = (formStatus, isSubmitted) => {
    if (isSubmitted || formStatus === 'Submitted' || formStatus === 'Reviewed') return '#10b981';
    if (formStatus === 'Requires Correction') return '#f97316';
    if (formStatus === 'Draft') return '#f59e0b';
    return '#cbd5e1';
  };

  const getFormMeta = (formKey) => {
    switch (formKey) {
      case 'undertaking': {
        const sf = formsSummary.find(f => ['UNDERTAKING', 'FORM_IA', 'FORM_IA / ANNEX E'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status || status === 'Draft' || status === 'Not Started') {
          if (undertaking?.status === 'Submitted' || undertaking?.is_accepted || student?.undertaking_submitted) {
            status = 'Submitted';
          } else if (undertaking) {
            status = 'Draft';
          } else {
            status = sf?.status || 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        const progress = submitted ? 100 : (status === 'Draft' ? Math.min(95, Math.max(10, sf?.progress_percent || 50)) : 0);
        const date = (submitted && (undertaking?.signed_date || undertaking?.created_at || sf?.submission_timestamp))
          ? new Date(undertaking?.signed_date || undertaking?.created_at || sf?.submission_timestamp).toLocaleDateString()
          : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'daily_activity': {
        const sf = formsSummary.find(f => ['DAILY_ACTIVITY', 'DAILY_ACTIVITY_REPORT', 'COMMUNITY_PROJECT', 'FORM_IIIB', 'FORM_III_B'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          if (dailyActivity?.status === 'Submitted' || project?.status === 'Submitted') {
            status = 'Submitted';
          } else if (dailyActivity || project) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          progress = Math.min(95, Math.max(10, sf?.progress_percent || (dailyActivity ? 50 : 25)));
        }
        const ts = submitted ? (sf?.submission_timestamp || dailyActivity?.submission_timestamp || dailyActivity?.created_at || project?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'institutional': {
        const sf = formsSummary.find(f => ['INSTITUTION', 'INSTITUTIONAL_VISIT', 'INSTITUTION_VISIT', 'FORM_IV'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          const hasSubmitted = institutions.some(i => i.status === 'Submitted');
          if (hasSubmitted) {
            status = 'Submitted';
          } else if (institutions.length > 0) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          const validCount = institutions.filter(i => i.institution_name?.trim()).length;
          const draftProg = validCount >= 2 ? 85 : (validCount === 1 ? 45 : 20);
          progress = Math.min(95, Math.max(10, sf?.progress_percent || draftProg));
        }
        const ts = submitted ? (sf?.submission_timestamp || institutions.find(i => i.status === 'Submitted')?.created_at || institutions[0]?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'family': {
        const sf = formsSummary.find(f => ['FAMILY_SURVEY', 'FAMILY_VISIT', 'FORM_V'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          const hasSubmitted = families.some(f => f.status === 'Submitted');
          if (hasSubmitted) {
            status = 'Submitted';
          } else if (families.length > 0) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          if (families.length > 0) {
            let totalScore = 0;
            families.forEach(fam => {
              let famScore = 0;
              if (fam.head_of_family_name?.trim()) famScore += 20;
              if (fam.total_family_members) famScore += 15;
              if (fam.house_type || fam.a_1_type_of_house) famScore += 15;
              if (fam.electricity_available != null || fam.b_1_electricity) famScore += 10;
              if (fam.agricultural_land || fam.c_1_agricultural_land) famScore += 10;
              if (fam.primary_occupation || fam.e_1_family_business) famScore += 15;
              if (fam.drinking_water_source || fam.toilet_facility) famScore += 15;
              totalScore += (famScore / 100);
            });
            const calculatedDraft = Math.round((totalScore / 3) * 90);
            progress = Math.min(95, Math.max(10, sf?.progress_percent || calculatedDraft));
          } else {
            progress = Math.min(95, sf?.progress_percent || 0);
          }
        }
        const ts = submitted ? (sf?.submission_timestamp || families.find(f => f.status === 'Submitted')?.updated_at || families[0]?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'problem': {
        const sf = formsSummary.find(f => ['PROBLEM_IDENTIFICATION', 'SMART_SOLUTION', 'FORM_VI'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          if (problem?.status === 'Submitted') {
            status = 'Submitted';
          } else if (problem) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          let score = 20;
          if (problem?.problem_title?.trim()) score += 20;
          if (problem?.problem_description?.trim()) score += 20;
          if (problem?.smart_solution_description?.trim() || problem?.solution_description?.trim()) score += 20;
          if (problem?.assignment_link?.trim()) score += 15;
          progress = Math.min(95, Math.max(15, sf?.progress_percent || score));
        }
        const ts = submitted ? (sf?.submission_timestamp || problem?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'feedback': {
        const sf = formsSummary.find(f => ['FEEDBACK', 'STUDENT_FEEDBACK', 'FORM_VIII'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          if (feedback?.status === 'Submitted') {
            status = 'Submitted';
          } else if (feedback) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          progress = Math.min(95, Math.max(20, sf?.progress_percent || 50));
        }
        const ts = submitted ? (sf?.submission_timestamp || feedback?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      case 'checklist': {
        const sf = formsSummary.find(f => ['CHECKLIST', 'PREPARATORY_CHECKLIST', 'FORM_IB'].includes((f.form_type || f.form_code || '').toUpperCase()));
        let status = sf?.status;
        if (!status) {
          if (checklist?.status === 'Submitted') {
            status = 'Submitted';
          } else if (checklist) {
            status = 'Draft';
          } else {
            status = 'Not Started';
          }
        }
        const submitted = status === 'Submitted' || status === 'Reviewed';
        let progress = 0;
        if (submitted) {
          progress = 100;
        } else if (status === 'Draft' || status === 'Requires Correction') {
          if (checklist) {
            const items = [
              checklist.parents_informed, checklist.medical_checkup_done, checklist.signed_undertaking,
              checklist.clothing_ready, checklist.beddings_ready, checklist.toiletries_ready,
              checklist.medicines_ready, checklist.laptop_dongle_ready, checklist.blank_notebook_ready,
              checklist.college_id_card, checklist.shoes_sportswear, checklist.emergency_contacts_saved
            ];
            const checked = items.filter(Boolean).length;
            progress = Math.min(95, Math.max(10, Math.round((checked / items.length) * 90)));
          } else {
            progress = Math.min(95, sf?.progress_percent || 0);
          }
        }
        const ts = submitted ? (sf?.submission_timestamp || checklist?.created_at) : null;
        const date = ts ? new Date(ts).toLocaleDateString() : (submitted ? 'Recorded in DB' : '—');
        return { status, submitted, progress, date };
      }
      default:
        return { status: 'Not Started', submitted: false, progress: 0, date: '—' };
    }
  };

  const officialFormsList = [
    {
      id: 'undertaking',
      number: 1,
      name: 'Student Undertaking',
      fullName: 'Student Undertaking & Parent Declaration',
      code: 'Form IA / Annex E',
      shortName: '1. Undertaking',
      actionLabel: 'View Undertaking',
      description: 'Parent/Guardian undertaking, emergency contacts, medical disclosures, and electronic declaration for Rural Immersion.',
      ...getFormMeta('undertaking')
    },
    {
      id: 'daily_activity',
      number: 2,
      name: 'Daily Activity Report',
      fullName: 'Daily Activity Report & Community Project (Form III B)',
      code: 'Form III B / Annex G-5',
      shortName: '2. Form III B',
      actionLabel: 'View Activity Report',
      description: 'Immersion log, village tracking, school activity details, and community social project implementation.',
      ...getFormMeta('daily_activity')
    },
    {
      id: 'institutional',
      number: 3,
      name: 'Institutional Visits',
      fullName: 'Institutional Visits Observations (Form IV)',
      code: 'Form IV / Annex G-6',
      shortName: '3. Form IV',
      actionLabel: 'View Institutional Visits',
      description: 'Field survey observations of village organizations (GP, PHC, School, Bank/Cooperative).',
      ...getFormMeta('institutional')
    },
    {
      id: 'family',
      number: 4,
      name: 'Family Visits',
      fullName: 'Family Visits Responses (Form V)',
      code: 'Form V / Annex G-7',
      shortName: '4. Form V',
      actionLabel: 'View Family Visits',
      description: 'Household socio-economic survey questionnaire data collected across families in assigned village.',
      ...getFormMeta('family')
    },
    {
      id: 'problem',
      number: 5,
      name: 'Problem Identification & SMART Solution',
      fullName: 'Problem Identification & SMART Solution (Form VI)',
      code: 'Form VI / Annex G-8',
      shortName: '5. Form VI',
      actionLabel: 'View Problem & Solution',
      description: 'Root-cause challenge analysis, UN SDG alignment, SMART engineering solution, and uploaded report documents.',
      ...getFormMeta('problem')
    },
    {
      id: 'feedback',
      number: 6,
      name: 'RI Feedback Form',
      fullName: 'Student RI Feedback Form (Form VIII)',
      code: 'Form VIII',
      shortName: '6. Form VIII',
      actionLabel: 'View Feedback',
      description: 'Immersion activity ratings, reflection on village stay, key learnings, and feedback for future cohorts.',
      ...getFormMeta('feedback')
    },
    {
      id: 'checklist',
      number: 7,
      name: 'Preparatory Phase Checklist',
      fullName: 'Preparatory Phase Checklist (Form IB)',
      code: 'Form IB / Annex F',
      shortName: '7. Form IB',
      actionLabel: 'View Checklist',
      description: 'Medical checkup, packing readiness, clothing, bedding, dongle, medicines, and field orientation verification.',
      ...getFormMeta('checklist')
    }
  ];

  return (
    <div className="ri-workspace-modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <style>{`
        @media (max-width: 768px) {
          .ri-workspace-modal-overlay {
            padding: 0 !important;
          }
          .ri-workspace-modal-container {
            width: 100vw !important;
            height: 100% !important;
            max-height: 100vh !important;
            max-width: 100vw !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .ri-workspace-header {
            padding: 12px 14px !important;
          }
          .ri-workspace-body {
            padding: 12px 10px !important;
          }
          .ri-card-responsive {
            padding: 14px 12px !important;
          }
          .ri-tab-button {
            padding: 10px 12px !important;
            font-size: 12px !important;
          }
        }
        .ri-tabs-scroll-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .ri-tabs-scroll-container::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
      <div className="ri-workspace-modal-container" style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '1280px',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        border: '1px solid #cbd5e1',
        overflow: 'hidden'
      }}>
        
        {/* ── HEADER ── */}
        <div className="ri-workspace-header" style={{
          backgroundColor: '#047857',
          color: '#ffffff',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0
        }}>
          {/* Top Row: Name on Left, Badges & Close on Right */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '10px',
            width: '100%'
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{
                margin: 0,
                fontSize: isMobile ? '16px' : '20px',
                fontWeight: '800',
                letterSpacing: '-0.02em',
                color: '#ffffff',
                lineHeight: 1.25,
                wordBreak: 'break-word'
              }}>
                {student.student_name || 'Student Workspace'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  PRN: {student.prn || '—'}
                </span>
                {student.roll_number && (
                  <span style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.22)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    Roll: {student.roll_number}
                  </span>
                )}
              </div>
            </div>

            {/* Right Controls: Eval Status + Close Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{
                backgroundColor: workspace?.evaluation?.status === 'Completed' ? '#dcfce7' : workspace?.evaluation?.status === 'Requires Correction' ? '#fee2e2' : '#fef3c7',
                color: workspace?.evaluation?.status === 'Completed' ? '#15803d' : workspace?.evaluation?.status === 'Requires Correction' ? '#b91c1c' : '#b45309',
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                whiteSpace: 'nowrap'
              }}>
                Eval: {workspace?.evaluation?.status || 'Pending'}
              </span>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease'
                }}
                title="Close Workspace"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Secondary Meta: Batch, Panel, Village, Dept */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '4px 10px',
            fontSize: isMobile ? '11.5px' : '12.5px',
            color: '#d1fae5',
            lineHeight: 1.4
          }}>
            <span>Batch: <strong style={{ color: '#ffffff' }}>{student.batch_name || 'Active'}</strong></span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span>Panel: <strong style={{ color: '#ffffff' }}>{cleanPanelName(student.panel_name || '—')}</strong></span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span>Village: <strong style={{ color: '#ffffff' }}>{student.village_name || '—'}</strong></span>
            <span style={{ opacity: 0.6 }}>•</span>
            <span>Dept: <strong style={{ color: '#ffffff' }}>{student.department || '—'}</strong>{student.division ? ` (Div ${student.division})` : ''}</span>
          </div>
        </div>

        {/* ── WORKSPACE TABS BAR ── */}
        <div
          className="ri-tabs-scroll-container"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            overflowX: 'auto',
            padding: '0 16px',
            flexShrink: 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {tabList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="ri-tab-button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '12px 14px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid #047857' : '2.5px solid transparent',
                  color: isActive ? '#047857' : '#64748b',
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} color={isActive ? '#047857' : '#94a3b8'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── SCROLLABLE BODY CONTENT ── */}
        <div
          className="ri-workspace-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            backgroundColor: '#ECECF1',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {loading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#047857' }} />
              <p style={{ fontSize: '14px', color: '#64748b' }}>Loading student data from database...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Two Main Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '14px' }}>
                    
                    {/* Student Academic Details */}
                    <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Student Profile & Demographics
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '12px', fontSize: '13px' }}>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>FULL NAME</span><strong>{student.student_name}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>PRN</span><strong>{student.prn}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>ROLL / RI ID</span><strong>{student.roll_number || student.ri_id || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>DEPARTMENT</span><strong>{student.department || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>DIVISION</span><strong>{student.division || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>GENDER</span><strong>{student.gender || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>PHONE</span><strong>{student.phone || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>EMAIL</span><strong style={{ fontSize: '12px', wordBreak: 'break-all' }}>{student.student_email || '—'}</strong></div>
                      </div>
                    </div>

                    {/* Field Immersion & Mentorship */}
                    <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Field Immersion Assignment
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: '12px', fontSize: '13px' }}>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>BATCH</span><strong>{student.batch_name}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>PANEL</span><strong>{cleanPanelName(student.panel_name || '—')}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>VILLAGE</span><strong>{student.village_name}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>VILLAGE LOCATION</span><strong>{student.village_location || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>SARPANCH NAME</span><strong>{student.sarpanch_name || '—'}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>SARPANCH CONTACT</span><strong>{student.sarpanch_mobile || '—'}</strong></div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>ASSIGNED FACULTY MENTORS</span>
                          <strong style={{ color: '#0f172a' }}>
                            {(workspace?.mentors || []).map(m => `${m.name} (${m.role})`).join(' • ') || 'Faculty Mentor'}
                          </strong>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Quick Snapshot Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px' }}>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>ATTENDANCE (4 ACTIVITIES)</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', marginTop: '4px', color: calculatedMarks.presentActivitiesCount === 4 ? '#15803d' : calculatedMarks.presentActivitiesCount > 0 ? '#0284c7' : '#dc2626' }}>
                        {calculatedMarks.presentActivitiesCount}/4 Present ({calculatedMarks.attendance}/15 M)
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>FAMILIES VISITED</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
                        {families.length} Records
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>INSTITUTIONS VISITED</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
                        {institutions.length} Records
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>PROBLEM STATEMENT</div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: getFormMeta('problem').submitted ? '#15803d' : (getFormMeta('problem').status === 'Draft' ? '#b45309' : '#94a3b8'),
                        marginTop: '4px'
                      }}>
                        {getFormMeta('problem').submitted ? '✓ Submitted' : (getFormMeta('problem').status === 'Draft' ? '● Draft' : 'Not Started')}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>COMMUNITY PROJECT</div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: (project?.status === 'Submitted' || getFormMeta('daily_activity').submitted) ? '#15803d' : (project || getFormMeta('daily_activity').status === 'Draft' ? '#b45309' : '#94a3b8'),
                        marginTop: '4px'
                      }}>
                        {(project?.status === 'Submitted' || getFormMeta('daily_activity').submitted) ? '✓ Submitted' : (project || getFormMeta('daily_activity').status === 'Draft' ? '● Draft' : 'Not Started')}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>EVALUATION SCORE</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
                        {workspace?.evaluation?.total_score != null ? `${workspace.evaluation.total_score} / 100` : `${calculatedMarks.grandTotal} / 100 (Live)`}
                      </div>
                    </div>
                  </div>

                  {/* Quick Form Links Card */}
                  <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                        Required Student Submissions & Forms Status
                      </h4>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>Click any form to view complete details</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '10px' }}>
                      {officialFormsList.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setActiveTab('forms');
                            setInspectedForm(item.id);
                          }}
                          style={{
                            padding: '12px 14px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#fafafa',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{item.name}</div>
                            <div style={{
                              fontSize: '11.5px',
                              color: item.submitted ? '#15803d' : (item.status === 'Draft' ? '#b45309' : (item.status === 'Requires Correction' ? '#c2410c' : '#64748b')),
                              fontWeight: '600',
                              marginTop: '2px'
                            }}>
                              {item.submitted ? '✓ Submitted' : (item.status === 'Draft' ? '● Draft' : (item.status === 'Requires Correction' ? '⚠ Correction' : '○ Not Started'))} • {item.progress}%
                            </div>
                          </div>
                          <ChevronRight size={16} color="#94a3b8" />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 2: ATTENDANCE (4 ACTIVITIES) */}
              {activeTab === 'attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                          Official Attendance Records (15% Assessment Weightage)
                        </h4>
                        <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                          Auto-calculated across 4 activities: 4/4 = 15 M, 3/4 = 11.25 M, 2/4 = 7.50 M, 1/4 = 3.75 M, 0/4 = 0 M.
                        </p>
                      </div>
                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#15803d' }}>
                        Attendance Score: {calculatedMarks.attendance} / 15 Marks ({calculatedMarks.presentActivitiesCount}/4 Present)
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '14px' }}>
                      {RI_ACTIVITIES.map(act => {
                        const rec = attendance.find(a => a?.activity === act.key || a?.activity_name === act.key);
                        const isPresent = rec?.status === 'Present' || rec?.status === 'P';
                        const isAbsent = rec?.status === 'Absent' || rec?.status === 'A';
                        const displayStatus = isPresent ? 'Present' : isAbsent ? 'Absent' : (rec?.status || 'Unmarked');

                        return (
                          <div
                            key={act.key}
                            style={{
                              padding: '16px',
                              border: isPresent ? '1.5px solid #bbf7d0' : isAbsent ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
                              borderRadius: '8px',
                              backgroundColor: isPresent ? '#f0fdf4' : isAbsent ? '#fef2f2' : '#ffffff'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{act.label}</span>
                              <span style={{
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: '700',
                                backgroundColor: isPresent ? '#dcfce7' : isAbsent ? '#fee2e2' : '#f1f5f9',
                                color: isPresent ? '#15803d' : isAbsent ? '#dc2626' : '#64748b'
                              }}>
                                {displayStatus}
                              </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div>Score Awarded: <strong>{isPresent ? '5 / 5 Marks' : '0 / 5 Marks'}</strong></div>
                              <div>Recorded At: <strong>{(rec?.marked_at || rec?.updated_at || rec?.attendance_date) ? new Date(rec.marked_at || rec.updated_at || rec.attendance_date).toLocaleString() : '—'}</strong></div>
                              <div>Marked By: <strong>{rec?.marked_by_name || rec?.marked_by_email || 'Faculty Mentor'}</strong></div>
                              <div>Remarks: <em>{rec?.remarks || 'None recorded'}</em></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: OFFICIAL FORMS & SUBMISSIONS */}
              {activeTab === 'forms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {!inspectedForm ? (
                    /* Unified 7 Forms Table with Clearly Labelled Individual Action Buttons */
                    <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                            All Required Official Forms & Submissions
                          </h4>
                          <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                            Mandatory Rural Immersion documentation, survey submissions, and project records for this student.
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
                            7 Official Forms
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px' }}>
                            {officialFormsList.filter(f => f.submitted).length} of 7 Submitted
                          </span>
                        </div>
                      </div>

                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: isMobile ? '640px' : 'auto' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', fontWeight: '700' }}>
                              <th style={{ padding: '12px 14px' }}>Form Code & Title</th>
                              <th style={{ padding: '12px 14px' }}>Status</th>
                              <th style={{ padding: '12px 14px' }}>Progress</th>
                              <th style={{ padding: '12px 14px' }}>Submitted On</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Individual Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {officialFormsList.map((f) => (
                              <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                                    {f.number}. {f.name}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: '600', marginTop: '2px' }}>
                                    {f.code}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', maxWidth: '380px', lineHeight: 1.4 }}>
                                    {f.description}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  {renderFormStatusBadge(f.status, f.submitted)}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '48px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ width: `${f.progress}%`, height: '100%', backgroundColor: getProgressBarColor(f.status, f.submitted) }} />
                                    </div>
                                    <span style={{
                                      fontWeight: '700',
                                      color: f.submitted ? '#15803d' : (f.status === 'Draft' ? '#b45309' : (f.status === 'Requires Correction' ? '#c2410c' : '#64748b')),
                                      fontSize: '12px'
                                    }}>
                                      {f.progress}%
                                    </span>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>
                                  {f.date}
                                </td>
                                <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                  <button
                                    id={`btn-view-form-${f.id}`}
                                    data-form-id={f.id}
                                    onClick={() => setInspectedForm(f.id)}
                                    style={{
                                      padding: '7px 14px',
                                      borderRadius: '7px',
                                      border: f.submitted ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                                      backgroundColor: f.submitted ? '#f0fdf4' : '#f8fafc',
                                      color: f.submitted ? '#15803d' : '#334155',
                                      fontSize: '12.5px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = f.submitted ? '#dcfce7' : '#f1f5f9';
                                      e.currentTarget.style.borderColor = f.submitted ? '#86efac' : '#94a3b8';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = f.submitted ? '#f0fdf4' : '#f8fafc';
                                      e.currentTarget.style.borderColor = f.submitted ? '#bbf7d0' : '#cbd5e1';
                                    }}
                                  >
                                    <Eye size={13} /> {f.actionLabel} →
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Detailed Inspected Form View - Directly Focused Without Duplicate Pills */
                    (() => {
                      const currentForm = officialFormsList.find(f => f.id === inspectedForm) || {
                        id: inspectedForm,
                        name: 'Official Form',
                        code: 'RI Form',
                        number: '',
                        submitted: false,
                        progress: 0,
                        date: '—'
                      };

                      // Reusable Empty State Renderer
                      const renderEmptyState = (formCode, formName, message) => (
                        <div style={{ backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '48px 24px', textAlign: 'center' }}>
                          <AlertCircle size={40} color="#dc2626" style={{ margin: '0 auto 12px' }} />
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {formCode}
                          </span>
                          <h4 style={{ margin: '6px 0 6px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                            {formName} — Not Submitted
                          </h4>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '480px', marginInline: 'auto', lineHeight: 1.5 }}>
                            {message || 'This student has not submitted any responses or documents for this official form yet.'}
                          </p>
                          <div style={{ marginTop: '20px' }}>
                            <button
                              onClick={() => setInspectedForm(null)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 16px',
                                borderRadius: '7px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#f8fafc',
                                color: '#1e293b',
                                fontSize: '12.5px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <ArrowLeft size={14} /> Return to Forms List
                            </button>
                          </div>
                        </div>
                      );

                      // Reusable Document / Media Card Renderer
                      const renderAttachmentItem = (url, title, fallbackName) => {
                        const fileInfo = getFileDetails(url, fallbackName);
                        if (!fileInfo) return null;
                        return (
                          <div
                            key={url}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #dcfce7',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px' }}>
                                <div style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '8px',
                                  backgroundColor: fileInfo.isPdf ? '#fee2e2' : fileInfo.isDoc ? '#dbeafe' : fileInfo.isImage ? '#fef3c7' : '#f1f5f9',
                                  color: fileInfo.isPdf ? '#dc2626' : fileInfo.isDoc ? '#2563eb' : fileInfo.isImage ? '#d97706' : '#047857',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {fileInfo.isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
                                </div>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                    {title}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ fontWeight: '600' }}>{fileInfo.fileName}</span>
                                    <span style={{
                                      fontSize: '10.5px',
                                      fontWeight: '700',
                                      textTransform: 'uppercase',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#e2e8f0',
                                      color: '#334155'
                                    }}>
                                      {fileInfo.extension || 'FILE'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => openSecureFile(fileInfo.rawUrl || fileInfo.resolvedUrl)}
                                  style={{
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    backgroundColor: '#047857',
                                    color: '#ffffff',
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <ExternalLink size={13} /> {fileInfo.isImage ? 'View Photo' : 'View Document'}
                                </button>
                                {!fileInfo.isExternal && (
                                  <button
                                    type="button"
                                    onClick={() => downloadSecureFile(fileInfo.rawUrl || fileInfo.resolvedUrl, fileInfo.fileName)}
                                    style={{
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      backgroundColor: '#f8fafc',
                                      color: '#1e293b',
                                      fontSize: '12.5px',
                                      fontWeight: '700',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      border: '1px solid #cbd5e1',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Download size={13} /> Download
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Image Thumbnail Preview */}
                            {fileInfo.isImage && (
                              <div style={{ marginTop: '4px', maxWidth: '320px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <SecureImage
                                  src={fileInfo.rawUrl || fileInfo.resolvedUrl}
                                  alt={fileInfo.fileName}
                                  style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
                                  onClick={() => openSecureFile(fileInfo.rawUrl || fileInfo.resolvedUrl)}
                                  title="Click to view full image in new tab"
                                />
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          
                          {/* Top Bar with Clear Back Button and Form Context Header */}
                          <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <button
                                id="btn-back-to-forms-list"
                                onClick={() => setInspectedForm(null)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '7px 14px',
                                  borderRadius: '7px',
                                  border: '1px solid #cbd5e1',
                                  backgroundColor: '#f8fafc',
                                  color: '#1e293b',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                              >
                                <ArrowLeft size={15} /> Back to All Forms
                              </button>
                              
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Forms & Submissions Inspection
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                                  {currentForm.number}. {currentForm.name}
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#047857', backgroundColor: '#f0fdf4', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                {currentForm.code}
                              </span>
                              {renderFormStatusBadge(currentForm.status, currentForm.submitted)}
                              {currentForm.submitted && currentForm.date ? (
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  Submitted on: <strong>{currentForm.date}</strong>
                                </span>
                              ) : currentForm.status === 'Draft' ? (
                                <span style={{ fontSize: '12px', color: '#b45309', fontWeight: '600' }}>
                                  Draft in Progress • <strong>{currentForm.progress}% complete</strong>
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* 1. STUDENT UNDERTAKING (FORM IA / ANNEX E) */}
                          {inspectedForm === 'undertaking' && (
                            <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Form IA / Annex E
                                </span>
                                <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                                  Student Undertaking & Parent Declaration
                                </h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                  Parent/Guardian consent, emergency contact, health disclosures, and electronic declaration for Rural Immersion.
                                </p>
                              </div>

                              {!undertaking ? (
                                renderEmptyState('Form IA / Annex E', 'Student Undertaking', 'Signed student undertaking and emergency contact declaration are not on record for this student.')
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  {/* Emergency Contacts */}
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '8px' }}>
                                      Emergency Contact & Guardian Information
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '12px', fontSize: '13px' }}>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>CONTACT PERSON / PARENT</span>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{undertaking.emergency_contact_name || undertaking.parent_name || '—'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>RELATIONSHIP</span>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{undertaking.emergency_contact_relation || 'Parent / Guardian'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>PRIMARY MOBILE</span>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{undertaking.emergency_contact_mobile || undertaking.parent_contact || '—'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>ALTERNATE MOBILE / EMAIL</span>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{undertaking.emergency_contact_alt_mobile || undertaking.emergency_contact_email || '—'}</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Health & Medical Information */}
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '8px' }}>
                                      Health & Medical Disclosures
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px', fontSize: '13px' }}>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>BLOOD GROUP</span>
                                        <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{undertaking.blood_group || 'Not recorded'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>KNOWN ALLERGIES</span>
                                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{undertaking.known_allergies || 'None reported'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>MEDICAL CONDITIONS</span>
                                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{undertaking.medical_conditions || 'None reported'}</strong>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>CURRENT MEDICATION / DIET</span>
                                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                                          {undertaking.current_medication || undertaking.dietary_restrictions || 'Standard'}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Electronic Declarations & Consents */}
                                  <div>
                                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '8px' }}>
                                      Mandatory Program Consents & Undertaking Verification
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px', fontSize: '12.5px' }}>
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px' }}>
                                        <span style={{ color: '#166534', fontWeight: '700' }}>Field Work Consent:</span> {undertaking.consent_field_work !== false ? '✓ Consented' : '✗ Denied'}
                                      </div>
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px' }}>
                                        <span style={{ color: '#166534', fontWeight: '700' }}>Code of Conduct:</span> {undertaking.consent_code_of_conduct !== false ? '✓ Agreed' : '✗ Denied'}
                                      </div>
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px' }}>
                                        <span style={{ color: '#166534', fontWeight: '700' }}>Medical Authorization:</span> {undertaking.consent_medical_emergency !== false ? '✓ Authorized' : '✗ Denied'}
                                      </div>
                                      <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '6px' }}>
                                        <span style={{ color: '#166534', fontWeight: '700' }}>Photo & Video Consent:</span> {undertaking.consent_photo_video !== false ? '✓ Consented' : '✗ Denied'}
                                      </div>
                                    </div>

                                    <div style={{ marginTop: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '12.5px' }}>
                                      <div>
                                        Electronic Declaration Signed By: <strong>{undertaking.signed_name || undertaking.student_name || student.student_name || 'Student'}</strong>
                                      </div>
                                      <div style={{ color: '#64748b' }}>
                                        Submitted: <strong>{undertaking.created_at ? new Date(undertaking.created_at).toLocaleString() : (undertaking.signed_date || 'On record')}</strong>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Uploaded Documents if any */}
                                  {(undertaking.document_url || undertaking.file_url || undertaking.attachment) && (
                                    renderAttachmentItem(
                                      undertaking.document_url || undertaking.file_url || undertaking.attachment,
                                      'Signed Undertaking Document Scan',
                                      'Form_IA_Signed_Undertaking'
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2. DAILY ACTIVITY REPORT (FORM III B) */}
                          {inspectedForm === 'daily_activity' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 20px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Form III B / Annex G-5
                                </span>
                                <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                                  Daily Activity Report & Community Project
                                </h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                  Daily immersion tracking, school engagement, institutional visits log, and community social work project.
                                </p>
                              </div>

                              {!dailyActivity && !project ? (
                                renderEmptyState('Form III B / Annex G-5', 'Daily Activity Report & Community Project', 'This student has not submitted daily activity reports or community project details yet.')
                              ) : (
                                <>
                                  {dailyActivity && (
                                    <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>DAILY ACTIVITY REPORT (FORM III B)</span>
                                          <div style={{ fontSize: '17px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>
                                            Village: {dailyActivity.village_visited || 'Assigned Village'}{dailyActivity.total_days_in_village ? ` (${dailyActivity.total_days_in_village})` : ''}
                                          </div>
                                        </div>
                                        <span style={{ fontSize: '11.5px', fontWeight: '700', padding: '3px 9px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                          Submitted
                                        </span>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                                        {dailyActivity.seven_day_plan_completed && (
                                          <div><strong>7-Day Immersion Plan Done:</strong> {dailyActivity.seven_day_plan_completed}</div>
                                        )}
                                        <div><strong>Institutions Visited:</strong> {dailyActivity.institutions_visited_count ?? 2}</div>
                                        <div><strong>Homes Visited:</strong> {dailyActivity.homes_visited_count ?? 5}</div>
                                        <div><strong>Problem Study Included:</strong> {dailyActivity.study_group_included || 'Yes'}</div>
                                      </div>

                                      {dailyActivity.seven_day_plan_improvements && (
                                        <div>
                                          <strong>Improvements to 7-Day Plan:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{dailyActivity.seven_day_plan_improvements}</p>
                                        </div>
                                      )}

                                      {dailyActivity.community_project_work_done && (
                                        <div>
                                          <strong>Community Work Done:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{dailyActivity.community_project_work_done}</p>
                                        </div>
                                      )}

                                      {dailyActivity.study_problem_title && (
                                        <div>
                                          <strong>In-Depth Study Problem Title:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.study_problem_title} (Solution submitted: {dailyActivity.study_solution_submitted || 'Yes'}, Presented to committee: {dailyActivity.study_presented_to_committee || 'Yes'})</p>
                                        </div>
                                      )}

                                      {dailyActivity.study_suggestions && (
                                        <div>
                                          <strong>Study Activity Suggestions:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.study_suggestions}</p>
                                        </div>
                                      )}

                                      {dailyActivity.institutional_visits_suggestions && (
                                        <div>
                                          <strong>Institutional Visits Suggestions:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.institutional_visits_suggestions}</p>
                                        </div>
                                      )}

                                      {dailyActivity.home_visits_suggestions && (
                                        <div>
                                          <strong>Home Visits Suggestions:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.home_visits_suggestions}</p>
                                        </div>
                                      )}

                                      {dailyActivity.best_practices_observed && (
                                        <div>
                                          <strong>Best Practices Observed:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.best_practices_observed}</p>
                                        </div>
                                      )}

                                      {dailyActivity.other_activities_implemented && (
                                        <div>
                                          <strong>Other Activities Implemented:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.other_activities_implemented}</p>
                                        </div>
                                      )}

                                      {dailyActivity.issues_affecting_implementation && (
                                        <div>
                                          <strong>Issues Affecting Implementation:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.issues_affecting_implementation}</p>
                                        </div>
                                      )}

                                      {dailyActivity.suggestions_to_improve_program && (
                                        <div>
                                          <strong>Suggestions to Improve Program:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.suggestions_to_improve_program}</p>
                                        </div>
                                      )}

                                      {dailyActivity.remarks && (
                                        <div>
                                          <strong>Remarks:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{dailyActivity.remarks}</p>
                                        </div>
                                      )}

                                      {/* School Activity Engagement */}
                                      {(dailyActivity.school_name_engaged || dailyActivity.school_activity_details) && (
                                        <div style={{ marginTop: '6px', padding: '14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            School Activity Engagement
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '8px', marginBottom: '8px' }}>
                                            <div>School Engaged: <strong>{dailyActivity.school_name_engaged || 'Village School'}</strong></div>
                                            <div>Students Reached: <strong>{dailyActivity.school_students_count ? `${dailyActivity.school_students_count} Students` : '—'}</strong></div>
                                          </div>
                                          {dailyActivity.school_activity_details && (
                                            <div>
                                              <strong style={{ color: '#166534' }}>Activity Details:</strong>
                                              <p style={{ margin: '3px 0 0 0', color: '#14532d' }}>{dailyActivity.school_activity_details}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Photos & Evidence for Form III B */}
                                      {(dailyActivity.activity_photo_1 || dailyActivity.activity_photo_2) && (
                                        <div style={{ marginTop: '8px' }}>
                                          <strong style={{ display: 'block', marginBottom: '8px', color: '#0f172a' }}>Form III B Photos & Evidence:</strong>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {dailyActivity.activity_photo_1 && renderAttachmentItem(dailyActivity.activity_photo_1, 'Activity Photo 1', 'Form_IIIB_Photo_1')}
                                            {dailyActivity.activity_photo_2 && renderAttachmentItem(dailyActivity.activity_photo_2, 'Activity Photo 2', 'Form_IIIB_Photo_2')}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {project && (
                                    <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                                      <div>
                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>COMMUNITY PROJECT DETAILS</span>
                                        <div style={{ fontSize: '17px', fontWeight: '800', color: '#047857', marginTop: '2px' }}>{project.project_title}</div>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '12px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                                        <div><strong>Strategic Pillar:</strong> {project.pillar_type || project.strategic_pillar || 'Agriculture and Nature'}</div>
                                        <div><strong>Hours Spent:</strong> {project.hours_spent || 2} Hours</div>
                                        <div><strong>Beneficiaries:</strong> {project.beneficiaries_reached || project.beneficiary_description || 'Village Community'}</div>
                                        <div><strong>Village Location:</strong> {project.village_location || project.location_in_village || 'Assigned Village'}</div>
                                      </div>

                                      <div>
                                        <strong>Work Description & Implementation:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{project.work_description || project.team_role_and_work_done}</p>
                                      </div>

                                      <div>
                                        <strong>Quantifiable Outputs:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{project.quantifiable_output || project.impact_and_outcome || '—'}</p>
                                      </div>

                                      <div>
                                        <strong>Community / Sarpanch Feedback:</strong>
                                        <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{project.community_feedback || '—'}</p>
                                      </div>

                                      {project.photos_link && (
                                        <div style={{ marginTop: '8px' }}>
                                          <strong style={{ display: 'block', marginBottom: '8px', color: '#0f172a' }}>Community Project Supporting Photos:</strong>
                                          {renderAttachmentItem(project.photos_link, 'Project Evidence Photo / Link', 'Community_Project_Evidence')}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* 3. INSTITUTIONAL VISITS (FORM IV / ANNEX G-6) */}
                          {inspectedForm === 'institutional' && (
                            <RiInstitutionView
                              visits={institutions}
                              status={getFormMeta('institutional').status}
                            />
                          )}

                          {/* 4. FAMILY VISITS SURVEY (FORM V / ANNEX G-7) */}
                          {inspectedForm === 'family' && (
                            <RiFamilySurveyView
                              families={families}
                              status={getFormMeta('family').status}
                            />
                          )}

                          {/* 5. PROBLEM IDENTIFICATION & SMART SOLUTION (FORM VI) */}
                          {inspectedForm === 'problem' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Form VI / Annex G-8
                                </span>
                                <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                                  Problem Identification & SMART Solution
                                </h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                  Root-cause problem analysis, SDG alignment, engineering intervention, and uploaded reports.
                                </p>
                              </div>

                              {!problem ? (
                                renderEmptyState('Form VI / Annex G-8', 'Problem Identification & SMART Solution', 'This student has not submitted Form VI Problem Identification & Solution.')
                              ) : (
                                <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  
                                  {/* Indicators 1 to 5 */}
                                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                      General Immersion Details (Indicators 1 – 5)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                                      <div>1. School: <strong>{problem.school_name || problem.form_data?.school_name || '—'}</strong></div>
                                      <div>2. Department: <strong>{problem.department_name || problem.department || problem.form_data?.department_name || '—'}</strong></div>
                                      <div>3. Degree Program: <strong>{problem.degree_program || problem.form_data?.degree_program || '—'}</strong></div>
                                      <div>4. Village Visited: <strong>{problem.village_visited || problem.form_data?.village_visited || '—'}</strong></div>
                                      <div>5. Students Participated: <strong>{problem.students_participated || problem.form_data?.students_participated || '—'}</strong></div>
                                    </div>
                                  </div>

                                  {/* 6. Team Information */}
                                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', marginBottom: '6px' }}>
                                      6. Team Information (5-Member Team)
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                      <div>6.1 Team Leader: <strong>{problem.team_leader_name || problem.form_data?.team_leader_name || student?.student_name || '—'}</strong></div>
                                      <div>6.2 Total Members: <strong>{problem.total_team_members || problem.form_data?.total_team_members || 5}</strong></div>
                                    </div>
                                  </div>

                                  {/* 7. Problem / Issue Identified */}
                                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px 16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '6px' }}>
                                      7. Problem / Issue Identified
                                    </div>
                                    <h4 style={{ margin: '4px 0 8px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                                      7.1 Title: {problem.problem_title}
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '12.5px', marginTop: '8px' }}>
                                      <div>7.2 In line with SDGs: <strong>{problem.is_aligned_with_sdg === true || problem.is_aligned_with_sdg === 'Yes' || problem.form_data?.is_aligned_with_sdg === 'Yes' ? 'Yes' : (problem.is_aligned_with_sdg === false || problem.is_aligned_with_sdg === 'No' || problem.form_data?.is_aligned_with_sdg === 'No' ? 'No' : '—')}</strong></div>
                                      <div>7.3 Related to Degree: <strong>{problem.is_related_to_degree === true || problem.is_related_to_degree === 'Yes' || problem.form_data?.is_related_to_degree === 'Yes' ? 'Yes' : (problem.is_related_to_degree === false || problem.is_related_to_degree === 'No' || problem.form_data?.is_related_to_degree === 'No' ? 'No' : '—')}</strong></div>
                                    </div>
                                  </div>

                                  {/* 8. Solution to Problem / Issue */}
                                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', marginBottom: '6px' }}>
                                      8. Solution to Problem / Issue
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', fontSize: '12.5px' }}>
                                      <div>8.1 Solution Offered: <strong>{problem.solution_offered || problem.form_data?.solution_offered || (problem.solution_description ? 'Yes' : '—')}</strong></div>
                                      <div>8.2 Faculty Helping: <strong>{problem.helping_faculty_name || problem.form_data?.helping_faculty_name || '—'}</strong> ({problem.helping_faculty_dept || problem.form_data?.helping_faculty_dept || '—'})</div>
                                      <div>8.3 Practical & Implementable: <strong>{problem.solution_is_practical_implementable || problem.form_data?.solution_is_practical_implementable || (problem.solution_is_practical_smart ? 'Yes' : '—')}</strong></div>
                                    </div>
                                  </div>

                                  {/* 9. Presentation to Committee */}
                                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 16px', fontSize: '12.5px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                      9. Presentation to Committee
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                      <div>9.1 Chairperson: <strong>{problem.committee_chairperson || problem.form_data?.committee_chairperson || '—'}</strong></div>
                                      <div>9.2 Date: <strong>{problem.presentation_date ? new Date(problem.presentation_date).toLocaleDateString() : (problem.form_data?.presentation_date || '—')}</strong></div>
                                      <div>9.3 Remarks: <strong>{problem.committee_remarks || problem.form_data?.committee_remarks || '—'}</strong></div>
                                    </div>
                                  </div>

                                  {/* 10 & 11 Consultation & Submission Details */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '12px', fontSize: '12.5px' }}>
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                                        10. Informed to Sarpanch & Gram Panchayat:
                                      </div>
                                      <p style={{ margin: 0, color: '#1e293b' }}>
                                        {problem.sarpanch_informed_details || problem.sarpanch_informed_person || problem.form_data?.sarpanch_informed_details || '—'}
                                      </p>
                                    </div>

                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                                        11. Presentation Submitted to RI Cell:
                                      </div>
                                      <p style={{ margin: 0, color: '#1e293b' }}>
                                        {problem.ri_cell_submission_details || problem.form_data?.ri_cell_submission_details || '—'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* CRITICAL: UPLOADED DOCUMENTS & ATTACHMENTS */}
                                  {(() => {
                                    const docs = [];
                                    if (problem.assignment_link) {
                                      docs.push({
                                        url: problem.assignment_link,
                                        title: '1500-word Joint Assignment Report',
                                        fallbackName: 'Form_VI_Joint_Assignment'
                                      });
                                    }
                                    if (problem.presentation_link) {
                                      docs.push({
                                        url: problem.presentation_link,
                                        title: 'Presentation Slides & Defense Deck',
                                        fallbackName: 'Form_VI_Presentation_Slides'
                                      });
                                    }
                                    if (problem.attachment_link && !docs.some(d => d.url === problem.attachment_link)) {
                                      docs.push({
                                        url: problem.attachment_link,
                                        title: 'Supporting Project Report / Attachment',
                                        fallbackName: 'Form_VI_Supporting_Report'
                                      });
                                    }

                                    return (
                                      <div style={{
                                        marginTop: '8px',
                                        border: '1px solid #bbf7d0',
                                        backgroundColor: '#f0fdf4',
                                        borderRadius: '10px',
                                        padding: '16px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                          <div>
                                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                                              Uploaded Problem Identification Documents ({docs.length})
                                            </h4>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#15803d' }}>
                                              Original attachments uploaded by the student team for Form VI evaluation.
                                            </p>
                                          </div>
                                        </div>

                                        {docs.length === 0 ? (
                                          <div style={{ backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                                            No uploaded document attachments found for this Form VI submission.
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {docs.map(doc => renderAttachmentItem(doc.url, doc.title, doc.fallbackName))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                </div>
                              )}
                            </div>
                          )}

                          {/* 6. RI FEEDBACK FORM (FORM VIII) */}
                          {inspectedForm === 'feedback' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Form VIII
                                </span>
                                <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                                  RI Feedback Form (Immersion Experience & Reflection)
                                </h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                  Student reflection on field activities, village observations, and suggestions for improvement.
                                </p>
                              </div>

                              {!feedback ? (
                                renderEmptyState('Form VIII', 'RI Feedback Form', 'This student has not submitted the final immersion feedback form yet.')
                              ) : (
                                <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                                  
                                  {/* Overall & 4 Activities Ratings */}
                                  <div>
                                    <strong>Immersion Activities Ratings:</strong>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '10px', marginTop: '8px' }}>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ACTIVITY 1: INSTITUTIONAL VISITS</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                          {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={15} fill={s <= (feedback.rating_institutional_visits || feedback.activity_ratings?.institutional_visits || 0) ? '#eab308' : 'none'} color={s <= (feedback.rating_institutional_visits || feedback.activity_ratings?.institutional_visits || 0) ? '#eab308' : '#cbd5e1'} />
                                          ))}
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginLeft: '4px' }}>{feedback.rating_institutional_visits || feedback.activity_ratings?.institutional_visits || 0}/5</span>
                                        </div>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ACTIVITY 2: HOUSEHOLD SURVEYS</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                          {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={15} fill={s <= (feedback.rating_household_surveys || feedback.activity_ratings?.household_surveys || 0) ? '#eab308' : 'none'} color={s <= (feedback.rating_household_surveys || feedback.activity_ratings?.household_surveys || 0) ? '#eab308' : '#cbd5e1'} />
                                          ))}
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginLeft: '4px' }}>{feedback.rating_household_surveys || feedback.activity_ratings?.household_surveys || 0}/5</span>
                                        </div>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ACTIVITY 3: COMMUNITY PROJECT</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                          {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={15} fill={s <= (feedback.rating_community_project || feedback.activity_ratings?.community_project || 0) ? '#eab308' : 'none'} color={s <= (feedback.rating_community_project || feedback.activity_ratings?.community_project || 0) ? '#eab308' : '#cbd5e1'} />
                                          ))}
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginLeft: '4px' }}>{feedback.rating_community_project || feedback.activity_ratings?.community_project || 0}/5</span>
                                        </div>
                                      </div>
                                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ACTIVITY 4: DEBRIEF & SCHOOL ACTIVITY</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                          {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={15} fill={s <= (feedback.rating_debrief_school_activity || feedback.activity_ratings?.debrief_school_activity || 0) ? '#eab308' : 'none'} color={s <= (feedback.rating_debrief_school_activity || feedback.activity_ratings?.debrief_school_activity || 0) ? '#eab308' : '#cbd5e1'} />
                                          ))}
                                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginLeft: '4px' }}>{feedback.rating_debrief_school_activity || feedback.activity_ratings?.debrief_school_activity || 0}/5</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {feedback.best_practices_observed && (
                                    <div>
                                      <strong>Best practices of village observed during visit:</strong>
                                      <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{feedback.best_practices_observed}</p>
                                    </div>
                                  )}

                                  {feedback.other_activities_implemented && (
                                    <div>
                                      <strong>Any other important activity implemented:</strong>
                                      <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{feedback.other_activities_implemented}</p>
                                    </div>
                                  )}

                                  {feedback.most_meaningful_activity && (
                                    <div>
                                      <strong>Most Meaningful Immersion Activity:</strong>
                                      <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: 1.5 }}>{feedback.most_meaningful_activity}</p>
                                    </div>
                                  )}

                                  {(feedback.village_stay_feedback || feedback.ltc_daund_feedback) && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '10px' }}>
                                      {feedback.village_stay_feedback && (
                                        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                          <strong style={{ color: '#0f172a' }}>Village Stay Feedback:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{feedback.village_stay_feedback}</p>
                                        </div>
                                      )}
                                      {feedback.ltc_daund_feedback && (
                                        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                          <strong style={{ color: '#0f172a' }}>LTC Daund Feedback:</strong>
                                          <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{feedback.ltc_daund_feedback}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(feedback.issues_affecting_implementation || feedback.suggestions_to_improve_program || feedback.suggestions_for_future_batches) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <strong>Other issues / suggestions:</strong>
                                      {feedback.issues_affecting_implementation && (
                                        <div style={{ backgroundColor: '#fef2f2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                          <span style={{ fontWeight: '700', color: '#991b1b', fontSize: '12px' }}>Issues that affected implementation of the program:</span>
                                          <p style={{ margin: '3px 0 0 0', color: '#7f1d1d' }}>{feedback.issues_affecting_implementation}</p>
                                        </div>
                                      )}
                                      {(feedback.suggestions_to_improve_program || feedback.suggestions_for_future_batches) && (
                                        <div style={{ backgroundColor: '#f0fdf4', padding: '10px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                          <span style={{ fontWeight: '700', color: '#15803d', fontSize: '12px' }}>Suggestions to improve the Rural Immersion Program:</span>
                                          <p style={{ margin: '3px 0 0 0', color: '#166534' }}>{feedback.suggestions_to_improve_program || feedback.suggestions_for_future_batches}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {feedback.key_learnings && (
                                    <div>
                                      <strong>Key Learnings from Rural Immersion:</strong>
                                      <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{feedback.key_learnings}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 7. PREPARATORY PHASE CHECKLIST (FORM IB / ANNEX F) */}
                          {inspectedForm === 'checklist' && (
                            <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Form IB / Annex F
                                </span>
                                <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                                  Preparatory Phase Checklist Responses
                                </h3>
                                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                                  Medical checkup, essential clothing, beddings, toiletries, medicines, and field orientation verification.
                                </p>
                              </div>

                              {!checklist ? (
                                renderEmptyState('Form IB / Annex F', 'Preparatory Phase Checklist', 'Student has not recorded Form IB preparatory phase checklist.')
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px', fontSize: '13px' }}>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Parents Informed: <strong>{checklist.parents_informed ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Medical Checkup Done: <strong>{checklist.medical_checkup_done ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Signed Undertaking: <strong>{checklist.signed_undertaking ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Clothing Ready: <strong>{checklist.clothing_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Beddings Ready: <strong>{checklist.beddings_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Toiletries Ready: <strong>{checklist.toiletries_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Medicines Ready: <strong>{checklist.medicines_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Laptop / Dongle Ready: <strong>{checklist.laptop_dongle_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Blank Notebook & Stationery: <strong>{checklist.blank_notebook_ready ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Sports Shoes & Outdoor Wear: <strong>{checklist.shoes_sportswear ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>College ID Card: <strong>{checklist.college_id_card ? '✓ Yes' : '✗ No'}</strong></div>
                                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>Emergency Contacts Saved: <strong>{checklist.emergency_contacts_saved ? '✓ Yes' : '✗ No'}</strong></div>
                                  {checklist.additional_notes && (
                                    <div style={{ gridColumn: '1 / -1', marginTop: '6px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                      <strong>Notes:</strong> {checklist.additional_notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Bottom Navigation Bar */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
                            <button
                              id="btn-bottom-back-to-forms"
                              onClick={() => setInspectedForm(null)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '7px 14px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                            >
                              <ArrowLeft size={14} /> Back to All Forms List
                            </button>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              Rural Immersion Student Workspace • {currentForm.name} ({currentForm.code})
                            </span>
                          </div>

                        </div>
                      );
                    })()
                  )}

                </div>
              )}

              {/* TAB 4: EVALUATION RUBRIC */}
              {activeTab === 'evaluation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Top Live Rubric Score Bar */}
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        Faculty Assessment & Evaluation
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isEvaluationLocked && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          fontSize: '12px',
                          fontWeight: '700'
                        }}>
                          <Lock size={12} /> Evaluation Locked
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Calculated Total:</span>
                      <span style={{ fontSize: '24px', fontWeight: '900', color: isEvaluationLocked ? '#047857' : '#047857' }}>
                        {calculatedMarks.grandTotal} / 100
                      </span>
                    </div>
                  </div>

                  {/* Locked Notice Banner */}
                  {isEvaluationLocked && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      color: '#991b1b',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}>
                      <Lock size={16} color="#dc2626" style={{ flexShrink: 0 }} />
                      <span>This evaluation has been saved and locked. Editing is no longer permitted.</span>
                    </div>
                  )}

                  {/* Evaluation Form Sections */}
                  <div className="ri-card-responsive" style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '22px' }}>
                    
                    {/* SECTION 1: ATTENDANCE (15%) */}
                    <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>1. Attendance (15% Weightage)</strong>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#047857', whiteSpace: 'nowrap' }}>
                          {calculatedMarks.attendance} / 15 Marks
                        </span>
                      </div>
                    </div>

                    {/* SECTION 2: ACTIVITIES AND FIELD SURVEY (30%) */}
                    <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>2. Activities and Field Survey (30% Weightage)</strong>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#047857', whiteSpace: 'nowrap' }}>
                          {calculatedMarks.activities} / 30 Marks
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '4px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                            Institutional Visit — 10 Marks
                          </label>
                          <select
                            value={evalForm.institutional_rating}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              setEvalForm({ ...evalForm, institutional_rating: e.target.value });
                            }}
                            disabled={isEvaluationLocked}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="">-- Select Rating --</option>
                            {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '4px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                            Family Visit — 10 Marks
                          </label>
                          <select
                            value={evalForm.family_survey_rating}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              setEvalForm({ ...evalForm, family_survey_rating: e.target.value });
                            }}
                            disabled={isEvaluationLocked}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="">-- Select Rating --</option>
                            {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '4px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                            Community Project — 10 Marks
                          </label>
                          <select
                            value={evalForm.community_project_rating}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              setEvalForm({ ...evalForm, community_project_rating: e.target.value });
                            }}
                            disabled={isEvaluationLocked}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="">-- Select Rating --</option>
                            {RATING_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label} ({r.score10} M)</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: PROBLEM STATEMENT IDENTIFICATION, DEGREE RELEVANCE & SDGs ALIGNMENT (15%) */}
                    <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>3. Problem Statement Identification, Degree Relevance & SDGs Alignment (15% Weightage)</strong>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#047857', whiteSpace: 'nowrap' }}>
                          {calculatedMarks.problemStatementScore} / 15 Marks
                        </span>
                      </div>

                      <div style={{ width: '100%' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '4px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                          Assign Marks (0–15 Marks) *
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min="0"
                            max="15"
                            step="0.25"
                            placeholder="0–15"
                            value={evalForm.problem_statement_marks}
                            disabled={isEvaluationLocked}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              const v = e.target.value;
                              if (v === '') {
                                setEvalForm({ ...evalForm, problem_statement_marks: '' });
                              } else {
                                const num = Math.min(15, Math.max(0, parseFloat(v) || 0));
                                setEvalForm({ ...evalForm, problem_statement_marks: num });
                              }
                            }}
                            style={{
                              width: isMobile ? '100%' : '120px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              fontWeight: '700',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'text'
                            }}
                          />
                          <select
                            value={evalForm.problem_statement_marks !== '' && [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 0].includes(Number(evalForm.problem_statement_marks)) ? evalForm.problem_statement_marks : ''}
                            disabled={isEvaluationLocked}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              if (e.target.value !== '') {
                                setEvalForm({ ...evalForm, problem_statement_marks: Number(e.target.value) });
                              }
                            }}
                            style={{
                              flex: '1 1 200px',
                              width: isMobile ? '100%' : 'auto',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="">-- Preset Quick Select --</option>
                            <option value="15">15 / 15 (Outstanding / Full Marks)</option>
                            <option value="14">14 / 15 (Excellent)</option>
                            <option value="13">13 / 15 (Very Good)</option>
                            <option value="12">12 / 15 (Good)</option>
                            <option value="11">11 / 15 (Above Average)</option>
                            <option value="10">10 / 15 (Satisfactory)</option>
                            <option value="9">9 / 15 (Average)</option>
                            <option value="8">8 / 15 (Pass)</option>
                            <option value="6">6 / 15 (Needs Improvement)</option>
                            <option value="0">0 / 15 (Unsatisfactory / Incomplete)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: PROPOSED SMART SOLUTION THROUGH REPORT AND PRESENTATION (40%) */}
                    <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <strong style={{ fontSize: '14px', color: '#0f172a' }}>4. Proposed Smart Solution for the Identified Problem Statements Through Report and Presentation (40% Weightage)</strong>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#047857', whiteSpace: 'nowrap' }}>
                          {calculatedMarks.smartSolutionScore} / 40 Marks
                        </span>
                      </div>

                      <div style={{ width: '100%' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '4px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                          Assign Marks (0–40 Marks) *
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            min="0"
                            max="40"
                            step="0.5"
                            placeholder="0–40"
                            value={evalForm.smart_solution_marks}
                            disabled={isEvaluationLocked}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              const v = e.target.value;
                              if (v === '') {
                                setEvalForm({ ...evalForm, smart_solution_marks: '' });
                              } else {
                                const num = Math.min(40, Math.max(0, parseFloat(v) || 0));
                                setEvalForm({ ...evalForm, smart_solution_marks: num });
                              }
                            }}
                            style={{
                              width: isMobile ? '100%' : '120px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '14px',
                              fontWeight: '700',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'text'
                            }}
                          />
                          <select
                            value={evalForm.smart_solution_marks !== '' && [40, 38, 36, 35, 34, 32, 30, 28, 25, 20, 16, 0].includes(Number(evalForm.smart_solution_marks)) ? evalForm.smart_solution_marks : ''}
                            disabled={isEvaluationLocked}
                            onChange={(e) => {
                              if (isEvaluationLocked) return;
                              if (e.target.value !== '') {
                                setEvalForm({ ...evalForm, smart_solution_marks: Number(e.target.value) });
                              }
                            }}
                            style={{
                              flex: '1 1 200px',
                              width: isMobile ? '100%' : 'auto',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                              color: isEvaluationLocked ? '#64748b' : '#0f172a',
                              cursor: isEvaluationLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="">-- Preset Quick Select --</option>
                            <option value="40">40 / 40 (Outstanding / Full Marks)</option>
                            <option value="38">38 / 40 (Exceptional)</option>
                            <option value="36">36 / 40 (Excellent)</option>
                            <option value="35">35 / 40 (Very Good)</option>
                            <option value="32">32 / 40 (Good - 80%)</option>
                            <option value="30">30 / 40 (Above Average)</option>
                            <option value="28">28 / 40 (Satisfactory - 70%)</option>
                            <option value="25">25 / 40 (Average)</option>
                            <option value="20">20 / 40 (Pass - 50%)</option>
                            <option value="16">16 / 40 (Needs Improvement)</option>
                            <option value="0">0 / 40 (Unsatisfactory / Incomplete)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* FACULTY REMARKS */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '6px', color: isEvaluationLocked ? '#64748b' : '#0f172a' }}>
                        Faculty Remarks & Qualitative Feedback
                      </label>
                      <textarea
                        rows={3}
                        placeholder={isEvaluationLocked ? "No remarks" : "Comprehensive feedback on student's immersion, field diligence, interview conduct and problem analysis..."}
                        value={evalForm.faculty_remarks}
                        disabled={isEvaluationLocked}
                        onChange={(e) => {
                          if (isEvaluationLocked) return;
                          setEvalForm({ ...evalForm, faculty_remarks: e.target.value });
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          backgroundColor: isEvaluationLocked ? '#f8fafc' : '#ffffff',
                          color: isEvaluationLocked ? '#64748b' : '#0f172a',
                          cursor: isEvaluationLocked ? 'not-allowed' : 'text'
                        }}
                      />
                    </div>

                    {/* ACTION BUTTONS */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                      <button
                        onClick={() => {
                          if (isEvaluationLocked) return;
                          setShowCorrectionModal(true);
                        }}
                        disabled={isEvaluationLocked || requestingCorrection}
                        style={{
                          width: isMobile ? '100%' : 'auto',
                          justifyContent: 'center',
                          padding: '9px 16px',
                          borderRadius: '8px',
                          border: `1px solid ${isEvaluationLocked ? '#e2e8f0' : '#fecaca'}`,
                          backgroundColor: isEvaluationLocked ? '#f8fafc' : '#fef2f2',
                          color: isEvaluationLocked ? '#94a3b8' : '#dc2626',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: isEvaluationLocked ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: isEvaluationLocked ? 0.6 : 1
                        }}
                      >
                        <AlertTriangle size={14} /> Request Student Correction
                      </button>

                      {isEvaluationLocked && (
                        <div style={{
                          backgroundColor: '#fef2f2',
                          border: '1.5px solid #fecaca',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          width: '100%',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#991b1b',
                          fontSize: '12.5px',
                          fontWeight: '700'
                        }}>
                          <Lock size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                          <span>This evaluation has been saved and locked. Editing is no longer permitted.</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
                        <button
                          onClick={() => handleSaveEvaluation('Draft')}
                          disabled={savingEval || isEvaluationLocked}
                          title={isEvaluationLocked ? 'Evaluation is locked' : undefined}
                          style={{
                            flex: isMobile ? 1 : 'initial',
                            justifyContent: 'center',
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: isEvaluationLocked ? '#94a3b8' : '#334155',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: isEvaluationLocked ? 'not-allowed' : 'pointer',
                            opacity: isEvaluationLocked ? 0.6 : 1
                          }}
                        >
                          Save Draft
                        </button>

                        <button
                          onClick={() => handleSaveEvaluation('Completed')}
                          disabled={savingEval || isEvaluationLocked}
                          title={isEvaluationLocked ? 'Evaluation is locked' : undefined}
                          style={{
                            flex: isMobile ? 1 : 'initial',
                            justifyContent: 'center',
                            padding: '9px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isEvaluationLocked ? '#94a3b8' : '#047857',
                            color: '#ffffff',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: isEvaluationLocked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isEvaluationLocked ? 'none' : '0 2px 4px rgba(4,120,87,0.2)',
                            opacity: isEvaluationLocked ? 0.7 : 1
                          }}
                        >
                          {isEvaluationLocked ? <Lock size={15} /> : <Save size={15} />}
                          <span>{savingEval ? 'Finalizing...' : isEvaluationLocked ? 'Evaluation Locked' : 'Finalize & Submit Evaluation'}</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}



            </>
          )}
        </div>

        {/* ── CORRECTION REQUEST MODAL ── */}
        {showCorrectionModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: isMobile ? '16px' : '22px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#b91c1c' }}>
                Request Correction from Student
              </h3>
              <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b' }}>
                Please specify the exact form or section requiring revision so the student can update and resubmit.
              </p>
              <textarea
                rows={4}
                placeholder="e.g. Please add detailed observation notes in Form IV and specify measurable targets for your SMART solution in Form VI..."
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', marginBottom: '16px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowCorrectionModal(false)}
                  style={{ flex: isMobile ? 1 : 'initial', padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestCorrection}
                  disabled={requestingCorrection}
                  style={{ flex: isMobile ? 1 : 'initial', padding: '9px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#b91c1c', color: '#ffffff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                >
                  {requestingCorrection ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
