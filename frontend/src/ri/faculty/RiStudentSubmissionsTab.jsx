import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Building2,
  Home,
  Lightbulb,
  Users,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { cleanPanelName } from '../shared/riUtils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const FORM_OPTIONS = [
  { value: 'ALL', label: 'All Forms' },
  { value: 'UNDERTAKING', label: '1. Student Undertaking (Annex E)' },
  { value: 'DAILY_ACTIVITY', label: '2. Daily Activity Report (Form III B)' },
  { value: 'INSTITUTIONAL_VISIT', label: '3. Institutional Visits (Form IV)' },
  { value: 'FAMILY_SURVEY', label: '4. Family Visits (Form V)' },
  { value: 'PROBLEM_IDENTIFICATION', label: '5. Problem Identification & SMART Solution (Form VI)' },
  { value: 'STUDENT_FEEDBACK', label: '6. RI Feedback Form (Form VIII)' },
  { value: 'PREPARATORY_CHECKLIST', label: '7. Preparatory Phase Checklist (Form IB)' }
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Reviewed', label: 'Reviewed' },
  { value: 'Requires Correction', label: 'Requires Correction' },
  { value: 'Draft', label: 'Draft / In Progress' },
  { value: 'Not Started', label: 'Not Started' }
];

const getTabForFormType = (formType) => {
  const t = (formType || '').toUpperCase();
  if (t.includes('DAILY') || t.includes('IIIB') || t.includes('COMMUNITY')) return 'community';
  if (t.includes('FAMILY')) return 'family';
  if (t.includes('INSTITUTION')) return 'institution';
  if (t.includes('PROBLEM')) return 'problem';
  if (t.includes('FEEDBACK')) return 'feedback';
  if (t.includes('CHECKLIST') || t.includes('UNDERTAKING')) return 'forms';
  return 'overview';
};

export default function RiStudentSubmissionsTab({
  batchId,
  panelId,
  authHeaders,
  onOpenWorkspace,
  addToast,
  isMobile: propIsMobile
}) {
  const [internalIsMobile, setInternalIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setInternalIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedFormType, setSelectedFormType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const toast = useCallback((msg, type = 'info') => {
    if (addToast) addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  const fetchSubmissions = useCallback(async () => {
    if (!batchId || !panelId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({
        batch_id: String(batchId),
        panel_id: String(panelId)
      });
      if (selectedFormType !== 'ALL') q.append('form_type', selectedFormType);
      if (selectedStatus !== 'ALL') q.append('status', selectedStatus);
      if (search.trim()) q.append('search', search.trim());

      const res = await fetch(`${API}/api/ri/faculty-portal/submissions?${q.toString()}`, {
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error('Failed to fetch student submissions');
      }

      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      toast('Failed to load student submissions', 'error');
    } finally {
      setLoading(false);
    }
  }, [batchId, panelId, selectedFormType, selectedStatus, search, authHeaders, toast]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const filteredSubmissions = React.useMemo(() => {
    return submissions.filter(sub => {
      if (selectedFormType !== 'ALL' && sub.form_type !== selectedFormType) return false;
      if (selectedStatus !== 'ALL' && (sub.submission_status || '').toLowerCase() !== selectedStatus.toLowerCase()) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = (sub.student_name || '').toLowerCase().includes(q);
        const matchPrn = (sub.prn || '').toLowerCase().includes(q);
        const matchRiId = (sub.ri_id || '').toLowerCase().includes(q);
        const matchDept = (sub.department || '').toLowerCase().includes(q);
        if (!matchName && !matchPrn && !matchRiId && !matchDept) return false;
      }
      return true;
    });
  }, [submissions, selectedFormType, selectedStatus, search]);

  // Download Multi-Sheet Excel for Student Forms
  const handleDownloadExcel = async () => {
    if (!batchId || !panelId) return;
    setDownloadingExcel(true);
    try {
      const q = new URLSearchParams({
        batch_id: String(batchId),
        panel_id: String(panelId)
      });
      const res = await fetch(`${API}/api/ri/faculty-portal/exports/forms/excel?${q.toString()}`, {
        headers: { Authorization: authHeaders.Authorization }
      });

      if (!res.ok) {
        throw new Error('Failed to generate Forms Excel report');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RI_Student_Forms_Panel_${panelId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Multi-sheet Student Forms Excel downloaded successfully', 'success');
    } catch (err) {
      console.error('Excel download error:', err);
      toast('Failed to download Forms Excel report', 'error');
    } finally {
      setDownloadingExcel(false);
    }
  };

  const renderStatusBadge = (status) => {
    if (status === 'Submitted') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          <Clock size={12} /> Submitted
        </span>
      );
    }
    if (status === 'Reviewed') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
          <CheckCircle2 size={12} /> Reviewed
        </span>
      );
    }
    if (status === 'Requires Correction') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          <AlertTriangle size={12} /> Needs Correction
        </span>
      );
    }
    if (status === 'Draft') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
          Draft
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }}>
        Not Started
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ── TOP ACTION BAR (Search, Filters, Excel Export) ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        padding: isMobile ? '12px' : '16px 20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search & Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1, minWidth: isMobile ? '100%' : '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: isMobile ? '100%' : '300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by student name or PRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                outline: 'none',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Form Filter */}
          <select
            value={selectedFormType}
            onChange={(e) => setSelectedFormType(e.target.value)}
            style={{
              flex: isMobile ? '1 1 140px' : 'initial',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              color: '#334155',
              backgroundColor: '#ffffff'
            }}
          >
            {FORM_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{
              flex: isMobile ? '1 1 140px' : 'initial',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              color: '#334155',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {(selectedFormType !== 'ALL' || selectedStatus !== 'ALL' || search.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSelectedFormType('ALL');
                setSelectedStatus('ALL');
                setSearch('');
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'initial' }}>
          <button
            onClick={fetchSubmissions}
            style={{
              flex: isMobile ? 1 : 'initial',
              justifyContent: 'center',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Refresh submissions"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={downloadingExcel}
            style={{
              flex: isMobile ? 1 : 'initial',
              justifyContent: 'center',
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#047857',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={13} />
            <span>{downloadingExcel ? 'Generating...' : 'Export Forms Excel'}</span>
          </button>
        </div>
      </div>

      {/* ── SUBMISSIONS TABLE ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 10px', color: '#047857' }} />
            <p style={{ fontSize: '13px', color: '#64748b' }}>Loading student submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center' }}>
            <FileText size={36} style={{ margin: '0 auto 10px', color: '#cbd5e1' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#0f172a' }}>No Submissions Found</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              No student submissions match the selected filters for this panel.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  fontWeight: '700'
                }}>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Student</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Evaluation</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Actions</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>PRN</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Panel</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Form Code & Title</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Submission Status</th>
                  <th style={{ padding: isMobile ? '10px 12px' : '10px 14px', whiteSpace: 'nowrap' }}>Submitted On</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((sub, idx) => {
                  const targetTab = getTabForFormType(sub.form_type);

                  const studentCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', whiteSpace: 'nowrap' }}>
                      <span
                        onClick={() => onOpenWorkspace && onOpenWorkspace(sub.student_id, 'overview')}
                        style={{ fontWeight: '700', color: '#047857', cursor: 'pointer', textDecoration: 'underline' }}
                        title="Open full student workspace"
                      >
                        {sub.student_name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                        ({sub.department || 'Student'}{sub.division ? ` • Div ${sub.division}` : ''})
                      </span>
                    </td>
                  );

                  const prnCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
                      {sub.prn || '—'}
                    </td>
                  );

                  const panelCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {cleanPanelName(sub.panel_name || '—')}
                    </td>
                  );

                  const formCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: '700', color: '#047857' }}>{sub.form_code}</span>
                      <span style={{ color: '#475569', marginLeft: '6px' }}>— {sub.form_title}</span>
                    </td>
                  );

                  const statusCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(sub.submission_status)}
                    </td>
                  );

                  const dateCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {sub.submission_timestamp ? new Date(sub.submission_timestamp).toLocaleDateString() : '—'}
                    </td>
                  );

                  const evalCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => onOpenWorkspace && onOpenWorkspace(sub.student_id, 'evaluation')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: sub.evaluation_status === 'Completed' ? '#dcfce7' : sub.evaluation_status === 'Requires Correction' ? '#fee2e2' : '#fef3c7',
                          color: sub.evaluation_status === 'Completed' ? '#15803d' : sub.evaluation_status === 'Requires Correction' ? '#b91c1c' : '#b45309',
                          border: '1px solid ' + (sub.evaluation_status === 'Completed' ? '#86efac' : sub.evaluation_status === 'Requires Correction' ? '#fca5a5' : '#fde68a'),
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                        title="Open Evaluation for student"
                      >
                        {sub.evaluation_status || 'Pending'}
                      </button>
                    </td>
                  );

                  const actionCell = (
                    <td style={{ padding: isMobile ? '10px 12px' : '12px 14px', textAlign: isMobile ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => onOpenWorkspace && onOpenWorkspace(sub.student_id, targetTab)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title={`Inspect ${sub.form_title} submitted data`}
                      >
                        <Eye size={13} />
                        <span>View Form Data</span>
                      </button>
                    </td>
                  );

                  return (
                    <tr
                      key={sub.submission_id || `${sub.student_id}-${sub.form_type}-${idx}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}
                    >
                      {studentCell}
                      {evalCell}
                      {actionCell}
                      {prnCell}
                      {panelCell}
                      {formCell}
                      {statusCell}
                      {dateCell}
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
