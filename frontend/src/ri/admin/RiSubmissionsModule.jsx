import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Download,
  RefreshCw,
  FileText,
  ClipboardList,
  CheckCircle,
  Clock,
  Eye,
  X,
  Building2,
  Home,
  Lightbulb,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Users,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import RiFamilySurveyView from '../shared/RiFamilySurveyView';
import RiInstitutionView from '../shared/RiInstitutionView';

// Standardized per-student submission status extractor
export const getStudentSubmissionStatus = (student) => {
  if (!student) {
    return {
      undertakingSubmitted: false,
      iiibSubmitted: false,
      formIVSubmitted: false,
      formVSubmitted: false,
      formVISubmitted: false,
      submittedFormsCount: 0,
      hasAnySubmitted: false,
      hasAnyPending: true,
      allSubmitted: false
    };
  }

  // If backend provided normalized submission_status, use it directly
  if (student.submission_status) {
    const s = student.submission_status;
    const count = s.submittedFormsCount ?? (
      (s.undertakingSubmitted ? 1 : 0) +
      (s.iiibSubmitted ? 1 : 0) +
      (s.formIVSubmitted ? 1 : 0) +
      (s.formVSubmitted ? 1 : 0) +
      (s.formVISubmitted ? 1 : 0)
    );
    return {
      undertakingSubmitted: Boolean(s.undertakingSubmitted),
      iiibSubmitted: Boolean(s.iiibSubmitted),
      formIVSubmitted: Boolean(s.formIVSubmitted),
      formVSubmitted: Boolean(s.formVSubmitted),
      formVISubmitted: Boolean(s.formVISubmitted),
      submittedFormsCount: count,
      hasAnySubmitted: s.hasAnySubmitted ?? count > 0,
      hasAnyPending: s.hasAnyPending ?? count < 5,
      allSubmitted: s.allSubmitted ?? count === 5
    };
  }

  const forms = student.forms || {};
  const undertakingSubmitted = Boolean(forms.undertaking?.is_submitted || student.undertaking_submitted);
  const isSub = (statusVal, isSubVal) => isSubVal === true || statusVal === 'Submitted' || statusVal === 'Reviewed';

  const iiibSubmitted = isSub(forms.daily_activity?.status, forms.daily_activity?.is_submitted);
  const formIVSubmitted = isSub(forms.institutional?.status, forms.institutional?.is_submitted);
  const formVSubmitted = isSub(forms.family?.status, forms.family?.is_submitted);
  const formVISubmitted = isSub(forms.problem?.status, forms.problem?.is_submitted);

  const count = (undertakingSubmitted ? 1 : 0) +
                (iiibSubmitted ? 1 : 0) +
                (formIVSubmitted ? 1 : 0) +
                (formVSubmitted ? 1 : 0) +
                (formVISubmitted ? 1 : 0);

  return {
    undertakingSubmitted,
    iiibSubmitted,
    formIVSubmitted,
    formVSubmitted,
    formVISubmitted,
    submittedFormsCount: count,
    hasAnySubmitted: count > 0,
    hasAnyPending: count < 5,
    allSubmitted: count === 5
  };
};

export default function RiSubmissionsModule({ token, apiBase, batches = [], toast }) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedPanelId, setSelectedPanelId] = useState('All');
  const [panels, setPanels] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Submitted' | 'Pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submissionsData, setSubmissionsData] = useState([]);
  const [summary, setSummary] = useState({
    total_students: 0,
    undertakings_submitted: 0,
    undertakings_pending: 0,
    total_forms_possible: 0,
    total_forms_submitted: 0,
    total_forms_pending: 0,
    all_submitted_students: 0,
    pending_students: 0
  });

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Modals
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [studentFullDetail, setStudentFullDetail] = useState(null);

  const [viewingFormModal, setViewingFormModal] = useState(null); // { formKey, student, data }

  // Initialize selectedBatchId from batches prop
  useEffect(() => {
    if (batches && batches.length > 0 && !selectedBatchId) {
      const active = batches.find(b => b.status === 'active');
      if (active) {
        setSelectedBatchId(active.id);
      } else {
        setSelectedBatchId(batches[0].id);
      }
    }
  }, [batches, selectedBatchId]);

  // Fetch panels whenever selectedBatchId changes
  useEffect(() => {
    if (!selectedBatchId) return;
    let isMounted = true;

    const fetchPanels = async () => {
      try {
        const res = await fetch(`${apiBase}/api/ri/batches/${selectedBatchId}/panels`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPanels(data.panels || []);
            setSelectedPanelId('All');
          }
        }
      } catch (err) {
        console.error('Error fetching batch panels:', err);
      }
    };

    fetchPanels();
    return () => { isMounted = false; };
  }, [selectedBatchId, apiBase, token]);

  // Fetch student submissions list
  const fetchSubmissions = useCallback(async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const q = new URLSearchParams({
        batch_id: String(selectedBatchId)
      });
      if (selectedPanelId && selectedPanelId !== 'All') {
        q.append('panel_id', String(selectedPanelId));
      }
      if (statusFilter && statusFilter !== 'All') {
        q.append('status', statusFilter.toLowerCase());
      }
      if (searchQuery.trim()) {
        q.append('search', searchQuery.trim());
      }

      const res = await fetch(`${apiBase}/api/ri/submissions?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmissionsData(data.students || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        if (toast) toast(data.message || 'Failed to fetch student submissions', 'error');
      }
    } catch (err) {
      console.error('Error connecting to server:', err);
      if (toast) toast('Error connecting to server', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, selectedPanelId, statusFilter, searchQuery, apiBase, token, toast]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBatchId, selectedPanelId, statusFilter, searchQuery]);

  // Filtered submissions (uses normalized status object for statusFilter consistency)
  const filteredData = useMemo(() => {
    let list = submissionsData;

    if (statusFilter && statusFilter !== 'All') {
      const sf = statusFilter.toLowerCase();
      list = list.filter(student => {
        const sStatus = getStudentSubmissionStatus(student);
        if (sf === 'submitted') {
          return sStatus.hasAnySubmitted;
        } else if (sf === 'pending') {
          return sStatus.hasAnyPending;
        }
        return true;
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter(student => {
      const name = String(student.student_name || '').toLowerCase();
      const prn = String(student.prn || '').toLowerCase();
      const email = String(student.email || '').toLowerCase();
      const panel = String(student.panel_name || '').toLowerCase();
      return name.includes(query) || prn.includes(query) || email.includes(query) || panel.includes(query);
    });
  }, [submissionsData, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Fetch full student detail for the modal
  const openStudentDetailModal = async (student) => {
    setSelectedStudentForModal(student);
    setStudentFullDetail(null);
    setStudentDetailLoading(true);
    try {
      const res = await fetch(
        `${apiBase}/api/ri/submissions/student/${student.student_id}?batch_id=${student.batch_id || selectedBatchId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setStudentFullDetail(data);
      } else {
        if (toast) toast('Failed to load student submission details', 'error');
      }
    } catch (err) {
      console.error('Error loading student submission detail:', err);
      if (toast) toast('Error connecting to server', 'error');
    } finally {
      setStudentDetailLoading(false);
    }
  };

  // Open individual form submission viewer
  const handleOpenFormView = async (student, formKey) => {
    setViewingFormModal({
      formKey,
      student,
      loading: true,
      data: null
    });

    try {
      const res = await fetch(
        `${apiBase}/api/ri/submissions/student/${student.student_id}?batch_id=${student.batch_id || selectedBatchId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setViewingFormModal({
          formKey,
          student,
          loading: false,
          data
        });
      } else {
        setViewingFormModal(null);
        if (toast) toast('Failed to load form submission details', 'error');
      }
    } catch (err) {
      console.error('Error fetching form data:', err);
      setViewingFormModal(null);
      if (toast) toast('Error connecting to server', 'error');
    }
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      if (toast) toast('No data available to export', 'error');
      return;
    }

    const rows = filteredData.map((s, idx) => ({
      'Sr No.': idx + 1,
      'Student Name': s.student_name,
      'PRN': s.prn || '—',
      'Email': s.email || '—',
      'Batch': s.batch_name,
      'Panel': s.panel_name || `Panel ${s.panel_number || '—'}`,
      'Village': s.village_name || '—',
      'FORM IA (Undertaking)': s.forms?.undertaking?.status || 'Not Submitted',
      'Undertaking Signed Name': s.forms?.undertaking?.signed_name || '—',
      'FORM IIIB (Daily Activity)': s.forms?.daily_activity?.status || 'Not Submitted',
      'FORM IV (Institutional Visit)': s.forms?.institutional?.status || 'Not Submitted',
      'FORM V (Family Visit)': s.forms?.family?.status || 'Not Submitted',
      'FORM VI (Problem & Solution)': s.forms?.problem?.status || 'Not Submitted',
      'Forms Submitted Count': `${s.submitted_forms_count} / ${s.total_forms_count}`,
      'Overall Status': s.overall_status
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RI Submissions');

    const batchName = batches.find(b => String(b.id) === String(selectedBatchId))?.name || 'Batch';
    const filename = `RI_Submissions_${batchName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
    if (toast) toast('Submissions spreadsheet exported successfully', 'success');
  };

  // Badge Render Helpers
  // Badge Render Helpers - Solid, Clean, High-Contrast UI (No Glassmorphism)
  const renderSimpleStatusBadge = (status, onAction, actionLabel = 'View') => {
    const isSubmitted = status === 'Submitted' || status === 'Reviewed' || status === 'Yes';
    const isDraft = status === 'In Draft' || status === 'Draft';

    if (isSubmitted) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '5px',
            background: '#ecfdf5',
            color: '#065f46',
            fontSize: '11px',
            fontWeight: '700',
            border: '1.5px solid #059669',
            whiteSpace: 'nowrap',
            lineHeight: '1.2'
          }}>
            <CheckCircle size={11} style={{ color: '#059669', flexShrink: 0 }} /> Submitted
          </span>
          {onAction && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '1px solid #047857',
                background: '#047857',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: '1.2',
                boxShadow: '0 1px 2px rgba(4,120,87,0.25)',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#065f46'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#047857'; }}
              title="View Submission Details"
            >
              <Eye size={11} style={{ flexShrink: 0 }} /> {actionLabel}
            </button>
          )}
        </div>
      );
    }

    if (isDraft) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '5px',
            background: '#fffbeb',
            color: '#92400e',
            fontSize: '11px',
            fontWeight: '700',
            border: '1.5px solid #d97706',
            whiteSpace: 'nowrap',
            lineHeight: '1.2'
          }}>
            <Clock size={11} style={{ color: '#d97706', flexShrink: 0 }} /> In Draft
          </span>
          {onAction && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction(); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '1px solid #d97706',
                background: '#d97706',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: '1.2',
                boxShadow: '0 1px 2px rgba(217,119,6,0.25)',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#b45309'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#d97706'; }}
              title="Inspect Draft Details"
            >
              <Eye size={11} style={{ flexShrink: 0 }} /> {actionLabel === 'View' ? 'Inspect' : actionLabel}
            </button>
          )}
        </div>
      );
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: '5px',
        background: '#f1f5f9',
        color: '#475569',
        fontSize: '11px',
        fontWeight: '600',
        border: '1px solid #cbd5e1',
        whiteSpace: 'nowrap',
        lineHeight: '1.2'
      }}>
        Not Submitted
      </span>
    );
  };

  const renderOverallBadge = (submittedCount, totalCount) => {
    if (submittedCount === totalCount && totalCount > 0) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '6px',
          background: '#ecfdf5',
          color: '#065f46',
          fontSize: '11.5px',
          fontWeight: '700',
          border: '1.5px solid #059669',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(5,150,105,0.1)'
        }}>
          <CheckCircle size={12} style={{ color: '#059669', flexShrink: 0 }} /> Submitted ({submittedCount}/{totalCount})
        </span>
      );
    }
    if (submittedCount > 0) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '6px',
          background: '#fff7ed',
          color: '#9a3412',
          fontSize: '11.5px',
          fontWeight: '700',
          border: '1.5px solid #ea580c',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(234,88,12,0.1)'
        }}>
          <Clock size={12} style={{ color: '#ea580c', flexShrink: 0 }} /> Pending ({submittedCount}/{totalCount})
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '6px',
        background: '#f8fafc',
        color: '#64748b',
        fontSize: '11.5px',
        fontWeight: '600',
        border: '1px solid #cbd5e1',
        whiteSpace: 'nowrap'
      }}>
        Not Submitted (0/{totalCount})
      </span>
    );
  };

  // Total students in the currently selected Batch + Panel scope (every form uses this as the denominator)
  const totalStudents = summary.total_students || submissionsData.length || 0;

  // 1. FORM IA / ANNEX E – Undertaking
  const undertakingSubmitted = summary.undertaking?.submitted ?? submissionsData.filter(s => getStudentSubmissionStatus(s).undertakingSubmitted).length;
  const undertakingPending = Math.max(0, totalStudents - undertakingSubmitted);
  const undertakingPct = totalStudents > 0 ? Math.round((undertakingSubmitted / totalStudents) * 100) : 0;

  // 2. FORM IIIB / ANNEX G-5 – Daily Activity Report & School Activity
  const dailyActivitySubmitted = summary.daily_activity?.submitted ?? submissionsData.filter(s => getStudentSubmissionStatus(s).iiibSubmitted).length;
  const dailyActivityPending = Math.max(0, totalStudents - dailyActivitySubmitted);
  const dailyActivityPct = totalStudents > 0 ? Math.round((dailyActivitySubmitted / totalStudents) * 100) : 0;

  // 3. FORM IV / ANNEX G-6 – Institutional Visit
  const institutionalSubmitted = summary.institutional?.submitted ?? submissionsData.filter(s => getStudentSubmissionStatus(s).formIVSubmitted).length;
  const institutionalPending = Math.max(0, totalStudents - institutionalSubmitted);
  const institutionalPct = totalStudents > 0 ? Math.round((institutionalSubmitted / totalStudents) * 100) : 0;

  // 4. FORM V / ANNEX G-7 – Family Visit
  const familySubmitted = summary.family?.submitted ?? submissionsData.filter(s => getStudentSubmissionStatus(s).formVSubmitted).length;
  const familyPending = Math.max(0, totalStudents - familySubmitted);
  const familyPct = totalStudents > 0 ? Math.round((familySubmitted / totalStudents) * 100) : 0;

  // 5. FORM VI / ANNEX G-8 & H – Problem / Issue & Solution
  const problemSubmitted = summary.problem?.submitted ?? submissionsData.filter(s => getStudentSubmissionStatus(s).formVISubmitted).length;
  const problemPending = Math.max(0, totalStudents - problemSubmitted);
  const problemPct = totalStudents > 0 ? Math.round((problemSubmitted / totalStudents) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, paddingBottom: '40px' }}>
      


      {/* ── 5 Separate Form Submission Statistics Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px'
      }}>
        {/* Card 1: Student Undertaking */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                Student Undertaking
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: undertakingPct === 100 ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                {undertakingPct}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ color: '#047857' }}>{undertakingSubmitted}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {totalStudents}</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${undertakingPct}%`, height: '100%', background: '#047857', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 2: Daily Activity Report */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                Daily Activity &amp; School Activity
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: dailyActivityPct === 100 ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                {dailyActivityPct}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ color: '#047857' }}>{dailyActivitySubmitted}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {totalStudents}</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${dailyActivityPct}%`, height: '100%', background: '#047857', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 3: Institutional Visit */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                Institutional Visit
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: institutionalPct === 100 ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                {institutionalPct}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ color: '#047857' }}>{institutionalSubmitted}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {totalStudents}</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${institutionalPct}%`, height: '100%', background: '#047857', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Family Visit */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                Family Visit
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: familyPct === 100 ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                {familyPct}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ color: '#047857' }}>{familySubmitted}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {totalStudents}</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${familyPct}%`, height: '100%', background: '#047857', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>

        {/* Card 5: Problem / Issue & Solution */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', lineHeight: '1.3' }}>
                Problem / Issue &amp; Solution
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: problemPct === 100 ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>
                {problemPct}%
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '3px' }}>
              <span style={{ color: '#047857' }}>{problemSubmitted}</span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>/ {totalStudents}</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${problemPct}%`, height: '100%', background: '#047857', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: isMobile ? '12px' : '14px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'end'
        }}>
          {/* Choose Batch */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 160px', minWidth: '140px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
              Choose Batch
            </label>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
                height: '38px'
              }}
            >
              <option value="">-- Choose Batch --</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.status})
                </option>
              ))}
            </select>
          </div>

          {/* Choose Panel */}
          <div style={{ flex: isMobile ? '1 1 100%' : '1 1 160px', minWidth: '140px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
              Choose Panel
            </label>
            <select
              value={selectedPanelId}
              onChange={e => setSelectedPanelId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                outline: 'none',
                height: '38px'
              }}
            >
              <option value="All">All Panels</option>
              {panels.map(p => (
                <option key={p.id} value={p.id}>
                  Panel {p.panel_number}: {p.name || `Panel ${p.panel_number}`}
                </option>
              ))}
            </select>
          </div>

          {/* Search Student (compact) */}
          <div style={{ flex: isMobile ? '1 1 100%' : '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
              Search Student
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search PRN, name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 30px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  height: '38px'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div style={{ flex: isMobile ? '1 1 auto' : '0 1 190px', minWidth: '160px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
              Status Filter
            </label>
            <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', height: '38px' }}>
              {['All', 'Submitted', 'Pending'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: statusFilter === tab ? '#047857' : '#ffffff',
                    color: statusFilter === tab ? '#ffffff' : '#475569',
                    fontSize: '12px',
                    fontWeight: statusFilter === tab ? '600' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    padding: '0 6px'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Export Excel Button beside Status Filter */}
          <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
            <button
              onClick={handleExportExcel}
              disabled={loading || filteredData.length === 0}
              style={{
                borderRadius: '6px',
                padding: '0 14px',
                fontSize: '12.5px',
                fontWeight: '600',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: loading || filteredData.length === 0 ? 'not-allowed' : 'pointer',
                height: '38px',
                whiteSpace: 'nowrap',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Submissions Table ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>

        {/* Table scroll container - enables smooth touch scrolling across all 11 columns */}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain'
        }}>
          <table style={{
            width: '100%',
            minWidth: '1620px',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: '12.5px',
            whiteSpace: 'nowrap'
          }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{
                  padding: '12px 14px',
                  textAlign: 'left',
                  fontWeight: '700',
                  color: '#334155',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  minWidth: isMobile ? '160px' : '200px',
                  borderBottom: '2px solid #cbd5e1'
                }}>
                  Student Name
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '130px', borderBottom: '2px solid #cbd5e1' }}>
                  PRN
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '200px', borderBottom: '2px solid #cbd5e1' }}>
                  Email
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '110px', borderBottom: '2px solid #cbd5e1' }}>
                  Batch
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '120px', borderBottom: '2px solid #cbd5e1' }}>
                  Panel
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '185px', borderBottom: '2px solid #cbd5e1' }}>
                  FORM IA / ANNEX E – Undertaking
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '195px', borderBottom: '2px solid #cbd5e1' }}>
                  FORM IIIB / ANNEX G-5 – Daily Activity
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '185px', borderBottom: '2px solid #cbd5e1' }}>
                  FORM IV / ANNEX G-6 – Inst. Visit
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '185px', borderBottom: '2px solid #cbd5e1' }}>
                  FORM V / ANNEX G-7 – Family Visit
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '195px', borderBottom: '2px solid #cbd5e1' }}>
                  FORM VI / ANNEX G-8 &amp; H – Problem &amp; Solution
                </th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#334155', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', minWidth: '170px', borderBottom: '2px solid #cbd5e1' }}>
                  Overall Submission
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      Loading student submissions...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    No student submissions found matching the selected batch and filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((student, idx) => {
                  const statusObj = getStudentSubmissionStatus(student);
                  const f = student.forms || {};
                  return (
                    <tr
                      key={student.student_id || idx}
                      onClick={() => openStudentDetailModal(student)}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      className="hover:bg-slate-50"
                    >
                      {/* 1. Student Name */}
                      <td style={{
                        padding: '11px 14px',
                        fontWeight: '600',
                        color: '#047857',
                        borderBottom: '1px solid #f1f5f9',
                        minWidth: isMobile ? '160px' : '200px',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={student.student_name}>
                            {student.student_name}
                          </span>
                          <ExternalLink size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
                        </div>
                      </td>

                      {/* 2. PRN */}
                      <td style={{ padding: '11px 14px', color: '#0f172a', fontFamily: 'monospace', fontSize: '12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {student.prn || '—'}
                      </td>

                      {/* 3. Email */}
                      <td style={{ padding: '11px 14px', color: '#475569', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {student.email || '—'}
                      </td>

                      {/* 4. Batch */}
                      <td style={{ padding: '11px 14px', color: '#475569', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {student.batch_name || '—'}
                      </td>

                      {/* 5. Panel */}
                      <td style={{ padding: '11px 14px', color: '#475569', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {student.panel_name || `Panel ${student.panel_number || '—'}`}
                      </td>

                      {/* 6. Form IA / Annex E – Undertaking */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderSimpleStatusBadge(
                          statusObj.undertakingSubmitted ? 'Submitted' : 'Not Submitted',
                          () => handleOpenFormView(student, 'undertaking'),
                          'View'
                        )}
                      </td>

                      {/* 7. Form IIIB / Annex G-5 – Daily Activity */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderSimpleStatusBadge(
                          f.daily_activity?.status || (statusObj.iiibSubmitted ? 'Submitted' : 'Not Submitted'),
                          () => handleOpenFormView(student, 'daily_activity'),
                          statusObj.iiibSubmitted ? 'View' : 'Inspect'
                        )}
                      </td>

                      {/* 8. Form IV / Annex G-6 – Institutional Visit */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderSimpleStatusBadge(
                          f.institutional?.status || (statusObj.formIVSubmitted ? 'Submitted' : 'Not Submitted'),
                          () => handleOpenFormView(student, 'institutional'),
                          statusObj.formIVSubmitted ? 'View' : 'Inspect'
                        )}
                      </td>

                      {/* 9. Form V / Annex G-7 – Family Visit */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderSimpleStatusBadge(
                          f.family?.status || (statusObj.formVSubmitted ? 'Submitted' : 'Not Submitted'),
                          () => handleOpenFormView(student, 'family'),
                          statusObj.formVSubmitted ? 'View' : 'Inspect'
                        )}
                      </td>

                      {/* 10. Form VI / Annex G-8 & H – Problem & Solution */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderSimpleStatusBadge(
                          f.problem?.status || (statusObj.formVISubmitted ? 'Submitted' : 'Not Submitted'),
                          () => handleOpenFormView(student, 'problem'),
                          statusObj.formVISubmitted ? 'View' : 'Inspect'
                        )}
                      </td>

                      {/* 11. Overall Submission */}
                      <td style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        {renderOverallBadge(statusObj.submittedFormsCount, 5)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Showing <strong>{filteredData.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</strong> to{' '}
            <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</strong> of{' '}
            <strong>{filteredData.length}</strong> students
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                  color: currentPage === 1 ? '#94a3b8' : '#334155',
                  fontSize: '12px',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span style={{ fontSize: '12px', color: '#475569', padding: '0 6px', fontWeight: '600' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                  color: currentPage === totalPages ? '#94a3b8' : '#334155',
                  fontSize: '12px',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: STUDENT FULL SUBMISSION DETAIL (ALL 5 FORMS AS CARDS)      */}
      {/* =================================================================== */}
      {selectedStudentForModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '8px' : '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: isMobile ? '10px' : '12px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: isMobile ? '94vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: isMobile ? '12px 14px' : '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: '#047857',
              color: '#ffffff'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: isMobile ? '15px' : '16px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {selectedStudentForModal.student_name}
                </h3>
                <p style={{
                  margin: '2px 0 0 0',
                  fontSize: isMobile ? '11.5px' : '12px',
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  PRN: {selectedStudentForModal.prn || '—'} &bull; {selectedStudentForModal.email || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                style={{
                  background: '#065f46',
                  border: '1px solid #059669',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#022c22'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#065f46'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Metadata Sub-header - Clean Responsive Grid */}
            <div style={{
              padding: isMobile ? '8px 12px' : '12px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: isMobile ? '6px' : '10px',
              fontSize: isMobile ? '11px' : '12px',
              color: '#475569'
            }}>
              <div style={{ background: '#ffffff', padding: isMobile ? '6px 8px' : '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.3px' }}>Batch</div>
                <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudentForModal.batch_name}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: isMobile ? '6px 8px' : '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.3px' }}>Panel</div>
                <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudentForModal.panel_name || `Panel ${selectedStudentForModal.panel_number || '—'}`}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: isMobile ? '6px 8px' : '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.3px' }}>Village</div>
                <div style={{ fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedStudentForModal.village_name || 'Not Assigned'}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: isMobile ? '6px 8px' : '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: 0 }}>
                <div style={{ fontSize: '9.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.3px' }}>Overall Progress</div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(() => {
                    const mStatus = getStudentSubmissionStatus(selectedStudentForModal);
                    return mStatus.allSubmitted ? (
                      <span style={{ color: '#16a34a', fontWeight: '700' }}>Complete (5/5)</span>
                    ) : (
                      <span style={{ color: '#ea580c', fontWeight: '700' }}>Pending ({mStatus.submittedFormsCount}/5)</span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Scrollable Body: 5 Clean Form Cards */}
            <div style={{
              padding: isMobile ? '12px' : '18px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '10px' : '12px'
            }}>
              {studentDetailLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  Loading submission records...
                </div>
              ) : (
                (() => {
                  const modalStatus = getStudentSubmissionStatus(selectedStudentForModal);
                  return (
                    <>
                      {/* Card 1: Form IA / Annex E Undertaking */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: isMobile ? '12px' : '14px 16px',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: isMobile ? '10px' : '14px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                FORM IA / ANNEX E
                              </span>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                Student Undertaking
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', lineHeight: '1.4' }}>
                              Official mandatory student undertaking and emergency medical profile (Reused from LTC Undertaking).
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            paddingTop: isMobile ? '8px' : '0',
                            borderTop: isMobile ? '1px dashed #e2e8f0' : 'none',
                            flexShrink: 0
                          }}>
                            {renderSimpleStatusBadge(
                              modalStatus.undertakingSubmitted || studentFullDetail?.undertaking?.submitted ? 'Submitted' : 'Not Submitted',
                              () => handleOpenFormView(selectedStudentForModal, 'undertaking'),
                              'View Submission'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Form IIIB / Annex G-5 Daily Activity */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: isMobile ? '12px' : '14px 16px',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: isMobile ? '10px' : '14px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                FORM IIIB / ANNEX G-5
                              </span>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                FORM – IIIB: DAILY ACTIVITY REPORT and SCHOOL ACTIVITY
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', lineHeight: '1.4' }}>
                              Comprehensive daily activity report covering community projects (Shramdaan), school activities &amp; youth engagement, best practices, suggestions, and activity photos.
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            paddingTop: isMobile ? '8px' : '0',
                            borderTop: isMobile ? '1px dashed #e2e8f0' : 'none',
                            flexShrink: 0
                          }}>
                            {renderSimpleStatusBadge(
                              studentFullDetail?.daily_activity_report?.status || (modalStatus.iiibSubmitted ? 'Submitted' : 'Not Submitted'),
                              () => handleOpenFormView(selectedStudentForModal, 'daily_activity'),
                              (studentFullDetail?.daily_activity_report?.status === 'Submitted' || modalStatus.iiibSubmitted) ? 'View Submission' : 'Inspect'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Form IV / Annex G-6 Institutional Visit */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: isMobile ? '12px' : '14px 16px',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: isMobile ? '10px' : '14px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                FORM IV / ANNEX G-6
                              </span>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                Institutional Visit Observations (Form IV)
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', lineHeight: '1.4' }}>
                              Observations and structured question responses from visiting at least 2 village institutions (Gram Panchayat, PHC, School, Anganwadi, Society, etc.).
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            paddingTop: isMobile ? '8px' : '0',
                            borderTop: isMobile ? '1px dashed #e2e8f0' : 'none',
                            flexShrink: 0
                          }}>
                            {renderSimpleStatusBadge(
                              ((studentFullDetail?.institutional_visits && studentFullDetail.institutional_visits.length > 0) || modalStatus.formIVSubmitted) ? 'Submitted' : 'Not Submitted',
                              () => handleOpenFormView(selectedStudentForModal, 'institutional'),
                              'View Submission'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Form V / Annex G-7 Family Visit */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: isMobile ? '12px' : '14px 16px',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: isMobile ? '10px' : '14px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                FORM V / ANNEX G-7
                              </span>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                Family Visit Observations (Form V)
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', lineHeight: '1.4' }}>
                              Household socio-economic survey covering housing, water, sanitation, agriculture, loans, health, and government scheme benefits.
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            paddingTop: isMobile ? '8px' : '0',
                            borderTop: isMobile ? '1px dashed #e2e8f0' : 'none',
                            flexShrink: 0
                          }}>
                            {renderSimpleStatusBadge(
                              ((studentFullDetail?.family_surveys && studentFullDetail.family_surveys.length > 0) || modalStatus.formVSubmitted) ? 'Submitted' : 'Not Submitted',
                              () => handleOpenFormView(selectedStudentForModal, 'family'),
                              'View Submission'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card 5: Form VI / Annex G-8 & H Problem & Solution */}
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: isMobile ? '12px' : '14px 16px',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: isMobile ? 'column' : 'row',
                          alignItems: isMobile ? 'stretch' : 'flex-start',
                          justifyContent: 'space-between',
                          gap: isMobile ? '10px' : '14px'
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                                FORM VI / ANNEX G-8 &amp; H
                              </span>
                              <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                Problem / Issue Identification &amp; Solution (Form VI)
                              </h4>
                            </div>
                            <p style={{ margin: 0, fontSize: isMobile ? '11.5px' : '12px', color: '#64748b', lineHeight: '1.4' }}>
                              Unique village problem statement mapped to SDGs and solution development.
                            </p>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isMobile ? 'space-between' : 'flex-end',
                            paddingTop: isMobile ? '8px' : '0',
                            borderTop: isMobile ? '1px dashed #e2e8f0' : 'none',
                            flexShrink: 0
                          }}>
                            {renderSimpleStatusBadge(
                              (studentFullDetail?.problem_identification || modalStatus.formVISubmitted) ? 'Submitted' : 'Not Submitted',
                              () => handleOpenFormView(selectedStudentForModal, 'problem'),
                              'View Submission'
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: isMobile ? '10px 14px' : '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setSelectedStudentForModal(null)}
                style={{
                  padding: isMobile ? '8px 18px' : '7px 16px',
                  width: isMobile ? '100%' : 'auto',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: INDIVIDUAL FORM SUBMISSION VIEWER                         */}
      {/* =================================================================== */}
      {viewingFormModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: isMobile ? '8px' : '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: isMobile ? '10px' : '12px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: isMobile ? '94vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            {/* Viewer Header */}
            <div style={{
              padding: isMobile ? '12px 14px' : '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              backgroundColor: '#047857',
              color: '#ffffff'
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {viewingFormModal.formKey === 'undertaking' && 'Life Awakening Program – Parent/Guardian Consent & Undertaking Form'}
                  {viewingFormModal.formKey === 'daily_activity' && 'FORM – IIIB: DAILY ACTIVITY REPORT and SCHOOL ACTIVITY'}
                  {viewingFormModal.formKey === 'institutional' && 'FORM IV / ANNEX G-6 – Institutional Visit Observations'}
                  {viewingFormModal.formKey === 'family' && 'FORM V / ANNEX G-7 – Family Visit Observations'}
                  {viewingFormModal.formKey === 'problem' && 'FORM VI / ANNEX G-8 & H – Problem / Issue & Solution'}
                </h3>
                <p style={{
                  margin: '2px 0 0 0',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  Student: {viewingFormModal.student?.student_name} ({viewingFormModal.student?.prn || 'PRN N/A'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingFormModal(null)}
                style={{
                  background: '#065f46',
                  border: '1px solid #059669',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  minWidth: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#022c22'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#065f46'; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Viewer Body */}
            <div style={{ padding: isMobile ? '12px' : '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {viewingFormModal.loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  Loading form submission...
                </div>
              ) : (
                (() => {
                  const data = viewingFormModal.data;
                  const key = viewingFormModal.formKey;

                  // ── Life Awakening Program: Parent/Guardian Consent & Undertaking ──
                  if (key === 'undertaking') {
                    const u = data?.undertaking?.user_undertaking || {};
                    const isSub = data?.undertaking?.submitted;
                    if (!isSub) {
                      return (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                          <AlertCircle size={24} style={{ color: '#94a3b8', margin: '0 auto 8px auto' }} />
                          <p style={{ margin: 0, fontWeight: '600', color: '#0f172a' }}>No Undertaking Submitted</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>This student/parent has not yet completed the mandatory Consent &amp; Undertaking Form.</p>
                        </div>
                      );
                    }

                    const medList = [
                      { label: 'Allergies', checked: Boolean(u.med_allergies) },
                      { label: 'Asthma', checked: Boolean(u.med_asthma) },
                      { label: 'Epilepsy', checked: Boolean(u.med_epilepsy) },
                      { label: 'Medication Requirement', checked: Boolean(u.med_medication) },
                      { label: 'Physical Limitation', checked: Boolean(u.med_physical_limitation) },
                      { label: 'Dietary Restriction', checked: Boolean(u.med_dietary_restriction) },
                      { label: 'Other Medical Condition', checked: Boolean(u.med_other) }
                    ];

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
                        {/* Header Badge */}
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Life Awakening Program School Education</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Parent/Guardian Consent &amp; Undertaking Response</div>
                          </div>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Verified &amp; Signed
                          </span>
                        </div>

                        {/* Student Details */}
                        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student Details</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
                            <div><strong style={{ color: '#64748b' }}>Student Name:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.student_name || viewingFormModal.student?.student_name || u.signed_name || '—'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Age:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.age || '—'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>School:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.school || viewingFormModal.student?.school || '—'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Class/Grade:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.class_grade || '—'}</span></div>
                          </div>
                        </div>

                        {/* Parent / Guardian Details */}
                        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent / Guardian Details</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
                            <div><strong style={{ color: '#64748b' }}>Name:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.parent_name || u.emergency_contact_name || '—'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Relationship to Student:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.parent_relationship || u.emergency_contact_relation || 'Parent'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Mobile Number:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.parent_mobile || u.emergency_contact_mobile || '—'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Email:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.parent_email || u.emergency_contact_email || '—'}</span></div>
                            <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}><strong style={{ color: '#64748b' }}>Address:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{u.address || '—'}</span></div>
                          </div>
                        </div>

                        {/* Medical Information Checkboxes */}
                        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Medical Information Disclosed</h5>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', fontStyle: 'italic' }}>Checkboxes from undertaking.docx.pdf:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                            {medList.map(m => (
                              <div key={m.label} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: m.checked ? '1.5px solid #f97316' : '1px solid #e2e8f0',
                                background: m.checked ? '#fff7ed' : '#f8fafc',
                                fontSize: '12px',
                                fontWeight: m.checked ? '700' : '500',
                                color: m.checked ? '#c2410c' : '#64748b'
                              }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  background: m.checked ? '#ea580c' : '#ffffff',
                                  border: m.checked ? 'none' : '1.5px solid #cbd5e1',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: '800'
                                }}>
                                  {m.checked ? '✓' : ''}
                                </span>
                                <span>{m.label}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <strong style={{ color: '#475569', fontSize: '12px' }}>Medical Details / Notes:</strong>
                            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginTop: '4px', color: '#0f172a', fontWeight: '500', fontSize: '12.5px' }}>
                              {u.med_details || u.medical_other || u.medical_conditions || 'None declared'}
                            </div>
                          </div>
                        </div>

                        {/* Parent / Guardian Consent & Declaration */}
                        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1.5px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '800', color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Parent/Guardian Consent &amp; Declaration</h5>
                          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                            Permission granted for student participation in the Life Awakening Program at Life Transformation Centre (LTC), Boribel. All 9 program clauses acknowledged, including outdoor/sports activities, risk understanding, emergency care authorization, conduct compliance, and liability waiver.
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Parent/Guardian Signature</div>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'serif', fontStyle: 'italic', marginTop: '2px' }}>
                                {u.signed_name || u.parent_name || 'Signed Digitally'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Name</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                                {u.parent_name || u.signed_name || '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Signed Date</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                                {u.signed_date ? new Date(u.signed_date).toLocaleDateString('en-IN') : 'Recorded'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // ── Form IIIB: Daily Activity Report ──
                  if (key === 'daily_activity') {
                    const r = data?.daily_activity_report;
                    if (!r) {
                      return (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                          <AlertCircle size={24} style={{ color: '#94a3b8', margin: '0 auto 8px auto' }} />
                          <p style={{ margin: 0, fontWeight: '600', color: '#0f172a' }}>No Daily Activity Report on Record</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>This student has not yet drafted or submitted Form IIIB.</p>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '8px' }}>
                          <div><strong>Status:</strong> {r.status || 'Draft'}</div>
                          <div><strong>Village Visited:</strong> {r.village_visited || '—'}</div>
                          <div><strong>Total Days in Village:</strong> {r.total_days_in_village || '5 Days'}</div>
                          <div><strong>7-Day Plan Completed:</strong> {r.seven_day_plan_completed || 'Yes'}</div>
                        </div>

                        {/* Community Project Section */}
                        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#047857' }}>1. Community Project &amp; Shramdaan</h5>
                          <p style={{ margin: '0 0 4px 0' }}><strong>Work Done:</strong> {r.community_project_work_done || '—'}</p>
                          <p style={{ margin: 0 }}><strong>Suggestions:</strong> {r.community_project_suggestions || '—'}</p>
                        </div>

                        {/* School Activity Section */}
                        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#047857' }}>2. School Activity &amp; Youth Engagement</h5>
                          <p style={{ margin: '0 0 4px 0' }}><strong>School Name Engaged:</strong> {r.school_name_engaged || '—'}</p>
                          <p style={{ margin: '0 0 4px 0' }}><strong>Students Engaged:</strong> {r.school_students_count || '—'}</p>
                          <p style={{ margin: '0 0 4px 0' }}><strong>Activity Details:</strong> {r.school_activity_details || '—'}</p>
                          <p style={{ margin: 0 }}><strong>Suggestions:</strong> {r.school_activity_suggestions || '—'}</p>
                        </div>

                        {/* Best Practices & Photos */}
                        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#047857' }}>3. Best Practices &amp; Key Takeaways</h5>
                          <p style={{ margin: '0 0 4px 0' }}><strong>Best Practices Observed:</strong> {r.best_practices_observed || '—'}</p>
                          <p style={{ margin: '0 0 4px 0' }}><strong>Other Activities:</strong> {r.other_activities_implemented || '—'}</p>
                          <p style={{ margin: 0 }}><strong>Student Remarks:</strong> {r.remarks || '—'}</p>
                        </div>
                      </div>
                    );
                  }

                  // ── Form IV: Institutional Visits ──
                  if (key === 'institutional') {
                    const list = data?.institutional_visits || [];
                    return (
                      <RiInstitutionView
                        visits={list}
                        status={data?.form_status?.status || (list.length > 0 ? 'Submitted' : 'Not Started')}
                      />
                    );
                  }

                  // ── Form V: Family Visits ──
                  if (key === 'family') {
                    const list = data?.family_surveys || [];
                    return (
                      <RiFamilySurveyView
                        families={list}
                        status={data?.form_status?.status || (list.length > 0 ? 'Submitted' : 'Not Started')}
                      />
                    );
                  }

                  // ── Form VI: Problem & Solution ──
                  if (key === 'problem') {
                    const p = data?.problem_identification;
                    if (!p) {
                      return (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                          <AlertCircle size={24} style={{ color: '#94a3b8', margin: '0 auto 8px auto' }} />
                          <p style={{ margin: 0, fontWeight: '600', color: '#0f172a' }}>No Problem &amp; Solution Record on File</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>This student has not yet drafted or submitted Form VI.</p>
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                            SDG Goal #{p.sdg_goal_number}: {p.sdg_goal_title || 'SDG Alignment'}
                          </span>
                          <h4 style={{ margin: '8px 0 4px 0', fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                            {p.problem_title}
                          </h4>
                          <p style={{ margin: '6px 0 0 0', color: '#334155', lineHeight: '1.5' }}>
                            {p.problem_description}
                          </p>
                        </div>

                        <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h5 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#047857' }}>Proposed SMART Solution</h5>
                          <h6 style={{ margin: '0 0 4px 0', fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                            {p.solution_title}
                          </h6>
                          <p style={{ margin: '6px 0 0 0', color: '#334155', lineHeight: '1.5' }}>
                            {p.solution_description}
                          </p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '8px', color: '#475569' }}>
                          <div><strong>Degree Relevance:</strong> {p.degree_program_relevance || 'Relevant'}</div>
                          <div><strong>Helping Faculty:</strong> {p.helping_faculty_name || '—'} ({p.helping_faculty_dept || '—'})</div>
                          <div><strong>Sarpanch Informed:</strong> {p.sarpanch_informed_person || '—'}</div>
                          <div><strong>Informed Date:</strong> {p.sarpanch_informed_date ? new Date(p.sarpanch_informed_date).toLocaleDateString() : '—'}</div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()
              )}
            </div>

            {/* Viewer Footer */}
            <div style={{
              padding: isMobile ? '10px 14px' : '12px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setViewingFormModal(null)}
                style={{
                  padding: isMobile ? '8px 18px' : '7px 16px',
                  width: isMobile ? '100%' : 'auto',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
