import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  LogOut,
  Layers,
  Calendar,
  ClipboardList
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseFeedbackForDisplay, formatFeedbackForExcel, exportSubmissionsFeedbackExcel } from '../utils/feedbackQuestions';
import API_BASE_URL from '@/config/apiConfig';

export default function PrePostLtcSuperAdminPanel({ API: propApi, token: propToken, user: propUser, showToast: propShowToast } = {}) {
  const navigate = useNavigate();
  const token = propToken || localStorage.getItem('token');
  const user = useMemo(() => {
    if (propUser && typeof propUser === 'object' && Object.keys(propUser).length > 0) {
      return propUser;
    }
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, [propUser]);

  const API = propApi || API_BASE_URL;

  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [studentData, setStudentData] = useState([]);
  const [downloadingType, setDownloadingType] = useState(null); // 'pre', 'post', 'combined'
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    if (typeof propShowToast === 'function') {
      propShowToast(message, type);
    }
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, [propShowToast]);

  // 1. Fetch Batches
  const fetchBatches = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/superadmin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.batches)) {
        const sorted = data.batches.sort((a, b) => {
          if (a.status === 'active') return -1;
          if (b.status === 'active') return 1;
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        setBatches(sorted);
        if (sorted.length > 0 && !selectedBatchId) {
          const active = sorted.find(b => b.status === 'active');
          setSelectedBatchId(active ? active.id : sorted[0].id);
        }
      } else {
        // Fallback to /api/admin/batches
        const adminRes = await fetch(`${API}/api/admin/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const adminData = await adminRes.json();
        if (adminRes.ok && Array.isArray(adminData.batches)) {
          setBatches(adminData.batches);
          if (adminData.batches.length > 0 && !selectedBatchId) {
            setSelectedBatchId(adminData.batches[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error loading batches:', err);
      showToast('Error loading batches', 'error');
    } finally {
      setLoading(false);
    }
  }, [API, token, selectedBatchId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // 2. Fetch Submission Data for the selected batch
  const fetchBatchSubmissionData = useCallback(async () => {
    if (!selectedBatchId || !token) return;
    try {
      setDataLoading(true);
      const url = `${API}/api/superadmin/reports/submissions-squad-wise?batchId=${selectedBatchId}&squad=All&roleType=student`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setStudentData(data.data || []);
      } else {
        showToast(data.message || 'Failed to fetch batch data', 'error');
      }
    } catch (err) {
      console.error('Error fetching submission data:', err);
      showToast('Error connecting to server', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [API, token, selectedBatchId]);

  useEffect(() => {
    fetchBatchSubmissionData();
  }, [fetchBatchSubmissionData]);

  const selectedBatch = useMemo(() => {
    return batches.find(b => String(b.id) === String(selectedBatchId)) || null;
  }, [batches, selectedBatchId]);

  // 3. Compute Feedback Statistics
  const stats = useMemo(() => {
    const total = studentData.length;
    if (total === 0) {
      return {
        total: 0,
        preSubmitted: 0,
        prePending: 0,
        prePct: 0,
        postSubmitted: 0,
        postPending: 0,
        postPct: 0
      };
    }

    let preSubmitted = 0;
    let postSubmitted = 0;

    studentData.forEach(r => {
      // Pre-LTC Feedback is col 26
      const preVal = r[26];
      if (preVal && String(preVal).trim() !== '—' && String(preVal).trim() !== '' && String(preVal).trim().toLowerCase() !== 'not submitted') {
        preSubmitted++;
      }

      // Post-LTC Feedback is col 27
      const postVal = r[27];
      if (postVal && String(postVal).trim() !== '—' && String(postVal).trim() !== '' && String(postVal).trim().toLowerCase() !== 'not submitted') {
        postSubmitted++;
      }
    });

    const prePending = total - preSubmitted;
    const prePct = Math.round((preSubmitted / total) * 100);

    const postPending = total - postSubmitted;
    const postPct = Math.round((postSubmitted / total) * 100);

    return {
      total,
      preSubmitted,
      prePending,
      prePct,
      postSubmitted,
      postPending,
      postPct
    };
  }, [studentData]);

  // 4. Excel Export: Pre-LTC Feedback
  const handleExportPreLtcExcel = async () => {
    if (studentData.length === 0) {
      showToast('No student records available for this batch.', 'warning');
      return;
    }

    try {
      setDownloadingType('pre');
      const batchName = selectedBatch?.name || `Batch_${selectedBatchId}`;

      const rows = studentData.map((r, idx) => {
        const rawPre = r[26];
        const isSubmitted = rawPre && String(rawPre).trim() !== '—' && String(rawPre).trim() !== '' && String(rawPre).trim().toLowerCase() !== 'not submitted';
        
        return {
          'Sr. No.': idx + 1,
          'Student Name': r[0] || '—',
          'PRN': r[1] || '—',
          'Email': r[2] || '—',
          'Squad': r[3] || 'Unassigned',
          'Status': isSubmitted ? 'Submitted' : 'Pending',
          'Pre-LTC Feedback Response': isSubmitted ? formatFeedbackForExcel(rawPre, 'Pre-LTC') : 'Not Submitted'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 18 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 72 }
      ];

      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const rowHeights = [];
        for (let R = 0; R <= range.e.r; ++R) {
          let maxLinesInRow = 1;
          let hasSubmittedFeedback = false;
          for (let C = 0; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellRef];
            if (!cell || cell.v === undefined) continue;
            if (typeof cell.v === 'string') {
              const lines = cell.v.split('\n').length;
              if (lines > maxLinesInRow) maxLinesInRow = lines;
              if (lines > 2 && cell.v !== 'Not Submitted') hasSubmittedFeedback = true;
            }
            if (!cell.s) cell.s = {};
            cell.s.alignment = { wrapText: true, vertical: 'top' };
          }
          if (R === 0 || !hasSubmittedFeedback || maxLinesInRow <= 2) {
            rowHeights.push({ hpt: 20 });
          } else {
            rowHeights.push({ hpt: Math.min(Math.max(maxLinesInRow * 11 + 10, 50), 165) });
          }
        }
        ws['!rows'] = rowHeights;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pre-LTC Feedback');
      XLSX.writeFile(wb, `${batchName}_Pre_LTC_Feedback.xlsx`);

      showToast('Pre-LTC Feedback Excel downloaded successfully.', 'success');
    } catch (err) {
      console.error('Export Error:', err);
      showToast('Failed to export Pre-LTC Feedback Excel.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  // 5. Excel Export: Post-LTC Feedback
  const handleExportPostLtcExcel = async () => {
    if (studentData.length === 0) {
      showToast('No student records available for this batch.', 'warning');
      return;
    }

    try {
      setDownloadingType('post');
      const batchName = selectedBatch?.name || `Batch_${selectedBatchId}`;

      const rows = studentData.map((r, idx) => {
        const rawPost = r[27];
        const isSubmitted = rawPost && String(rawPost).trim() !== '—' && String(rawPost).trim() !== '' && String(rawPost).trim().toLowerCase() !== 'not submitted';

        return {
          'Sr. No.': idx + 1,
          'Student Name': r[0] || '—',
          'PRN': r[1] || '—',
          'Email': r[2] || '—',
          'Squad': r[3] || 'Unassigned',
          'Status': isSubmitted ? 'Submitted' : 'Pending',
          'Post-LTC Feedback Response': isSubmitted ? formatFeedbackForExcel(rawPost, 'Post-LTC') : 'Not Submitted'
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 18 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 72 }
      ];

      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        const rowHeights = [];
        for (let R = 0; R <= range.e.r; ++R) {
          let maxLinesInRow = 1;
          let hasSubmittedFeedback = false;
          for (let C = 0; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellRef];
            if (!cell || cell.v === undefined) continue;
            if (typeof cell.v === 'string') {
              const lines = cell.v.split('\n').length;
              if (lines > maxLinesInRow) maxLinesInRow = lines;
              if (lines > 2 && cell.v !== 'Not Submitted') hasSubmittedFeedback = true;
            }
            if (!cell.s) cell.s = {};
            cell.s.alignment = { wrapText: true, vertical: 'top' };
          }
          if (R === 0 || !hasSubmittedFeedback || maxLinesInRow <= 2) {
            rowHeights.push({ hpt: 20 });
          } else {
            rowHeights.push({ hpt: Math.min(Math.max(maxLinesInRow * 11 + 10, 50), 165) });
          }
        }
        ws['!rows'] = rowHeights;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Post-LTC Feedback');
      XLSX.writeFile(wb, `${batchName}_Post_LTC_Feedback.xlsx`);

      showToast('Post-LTC Feedback Excel downloaded successfully.', 'success');
    } catch (err) {
      console.error('Export Error:', err);
      showToast('Failed to export Post-LTC Feedback Excel.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  // 6. Excel Export: Pre + Post Combined Feedback (Reuses Submission Page's Standard Feedback Export)
  const handleExportCombinedExcel = async () => {
    if (studentData.length === 0) {
      showToast('No student records available for this batch.', 'warning');
      return;
    }

    try {
      setDownloadingType('combined');
      const batchName = selectedBatch?.name || `Batch_${selectedBatchId}`;

      exportSubmissionsFeedbackExcel({
        data: studentData,
        batchName,
        selectedSquad: 'All',
        selectedRole: 'student',
        showToast
      });
    } catch (err) {
      console.error('Export Error:', err);
      showToast('Failed to export Pre + Post Feedback Excel.', 'error');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ─── Toast Alert ─── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#10b981',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* ─── Top Header Bar ─── */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: isMobile ? '12px 16px' : '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          <div style={{
            width: isMobile ? '32px' : '36px',
            height: isMobile ? '32px' : '36px',
            borderRadius: '8px',
            background: '#154388',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <ShieldCheck size={isMobile ? 18 : 22} />
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Super Admin
            </div>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '500' }}>
              Life Transformation Centre
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: isMobile ? '5px 10px' : '6px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: isMobile ? '11.5px' : '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <LogOut size={isMobile ? 12 : 13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main style={{
        flex: 1,
        maxWidth: '1100px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '16px 14px 40px 14px' : '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '14px' : '20px',
        boxSizing: 'border-box'
      }}>
        
        {/* 1. Batch Selector Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '14px 16px' : '16px 20px',
          display: 'flex',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '16px',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)'
        }}>
          <div>
            <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '750', color: '#0f172a' }}>
              Batch Selection
            </div>
            <div style={{ fontSize: isMobile ? '11.5px' : '12.5px', color: '#64748b', marginTop: '2px' }}>
              Select a batch cohort to review feedback progress and download response spreadsheets.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: isMobile ? '100%' : '280px' }}>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              disabled={loading || batches.length === 0}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 12px',
                border: '1.5px solid #154388',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#0f172a',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {batches.length === 0 ? (
                <option value="">No batches available</option>
              ) : (
                batches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.status ? `(${b.status})` : ''}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={() => {
                fetchBatches();
                fetchBatchSubmissionData();
              }}
              disabled={dataLoading || loading}
              style={{
                padding: '0 12px',
                height: '38px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                cursor: (dataLoading || loading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 2. Feedback Status Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: isMobile ? '14px' : '20px'
        }}>
          {/* Card A: Pre-LTC Feedback Status */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : '20px 24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '14px' : '18px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: isMobile ? '14.5px' : '16px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.2px' }}>
                  Pre-LTC Feedback Status
                </h3>
              </div>
              <div>
                <span style={{
                  display: 'inline-block',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  color: '#154388',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '2.5px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {selectedBatch?.name || 'Batch 1'}
                </span>
              </div>
            </div>

            {/* Slider / Progress Bar Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.max(stats.prePct, 0)}%`,
                  height: '100%',
                  background: stats.prePct === 100 ? '#16a34a' : '#154388',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: isMobile ? '11px' : '12px',
                color: '#64748b'
              }}>
                <span>{stats.preSubmitted} of {stats.total} submitted</span>
                <span style={{ fontWeight: '600', color: stats.prePending > 0 ? '#b91c1c' : '#15803d' }}>
                  {stats.prePending} pending
                </span>
              </div>
            </div>

            {/* Metrics 3-Column Grid (NO dots, clean, responsive) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: isMobile ? '8px' : '12px'
            }}>
              {/* Submitted Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Submitted
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.preSubmitted}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  {stats.prePct}% of total
                </span>
              </div>

              {/* Pending Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Pending
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.prePending}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  {stats.total > 0 ? Math.round((stats.prePending / stats.total) * 100) : 0}% of total
                </span>
              </div>

              {/* Total Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Total
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.total}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  Students
                </span>
              </div>
            </div>
          </div>

          {/* Card B: Post-LTC Feedback Status */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: isMobile ? '16px' : '20px 24px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '14px' : '18px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: isMobile ? '14.5px' : '16px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.2px' }}>
                  Post-LTC Feedback Status
                </h3>
              </div>
              <div>
                <span style={{
                  display: 'inline-block',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  color: '#154388',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '2.5px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {selectedBatch?.name || 'Batch 1'}
                </span>
              </div>
            </div>

            {/* Slider / Progress Bar Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.max(stats.postPct, 0)}%`,
                  height: '100%',
                  background: stats.postPct === 100 ? '#16a34a' : '#154388',
                  borderRadius: '4px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: isMobile ? '11px' : '12px',
                color: '#64748b'
              }}>
                <span>{stats.postSubmitted} of {stats.total} submitted</span>
                <span style={{ fontWeight: '600', color: stats.postPending > 0 ? '#b91c1c' : '#15803d' }}>
                  {stats.postPending} pending
                </span>
              </div>
            </div>

            {/* Metrics 3-Column Grid (NO dots, clean, responsive) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: isMobile ? '8px' : '12px'
            }}>
              {/* Submitted Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Submitted
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.postSubmitted}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  {stats.postPct}% of total
                </span>
              </div>

              {/* Pending Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Pending
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.postPending}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  {stats.total > 0 ? Math.round((stats.postPending / stats.total) * 100) : 0}% of total
                </span>
              </div>

              {/* Total Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: isMobile ? '10px 8px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: isMobile ? 'center' : 'left'
              }}>
                <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Total
                </span>
                <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
                  {stats.total}
                </span>
                <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '500' }}>
                  Students
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Excel Download Section */}
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px 14px' : '20px'
        }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: '#0f172a' }}>
              Excel Reports & Exports
            </div>
            <div style={{ fontSize: isMobile ? '11.5px' : '12.5px', color: '#64748b', marginTop: '2px' }}>
              Export structured Excel spreadsheets for individual surveys or the complete combined survey dataset.
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: isMobile ? '12px' : '14px'
          }}>
            {/* Download Pre-LTC Feedback */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: isMobile ? '14px' : '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileSpreadsheet size={18} color="#154388" />
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                    Pre-LTC Feedback Excel
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Complete Pre-LTC survey responses with student identification and answered questions.
                </p>
              </div>

              <button
                onClick={handleExportPreLtcExcel}
                disabled={downloadingType !== null || dataLoading || studentData.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#154388',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: (downloadingType !== null || dataLoading || studentData.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (downloadingType !== null || dataLoading || studentData.length === 0) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%'
                }}
              >
                {downloadingType === 'pre' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>{downloadingType === 'pre' ? 'Generating Excel...' : 'Download Pre-LTC Excel'}</span>
              </button>
            </div>

            {/* Download Post-LTC Feedback */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: isMobile ? '14px' : '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileSpreadsheet size={18} color="#154388" />
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                    Post-LTC Feedback Excel
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Comprehensive Post-LTC evaluations, reflections, and pillar experiences across students.
                </p>
              </div>

              <button
                onClick={handleExportPostLtcExcel}
                disabled={downloadingType !== null || dataLoading || studentData.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#154388',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: (downloadingType !== null || dataLoading || studentData.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (downloadingType !== null || dataLoading || studentData.length === 0) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%'
                }}
              >
                {downloadingType === 'post' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>{downloadingType === 'post' ? 'Generating Excel...' : 'Download Post-LTC Excel'}</span>
              </button>
            </div>

            {/* Download Pre + Post Combined Feedback */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: isMobile ? '14px' : '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '12px',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <FileSpreadsheet size={18} color="#154388" />
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                    Pre + Post Feedback Excel
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Multi-sheet workbook containing Pre-LTC, Post-LTC, and overall status comparison summary.
                </p>
              </div>

              <button
                onClick={handleExportCombinedExcel}
                disabled={downloadingType !== null || dataLoading || studentData.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#154388',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: (downloadingType !== null || dataLoading || studentData.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: (downloadingType !== null || dataLoading || studentData.length === 0) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%'
                }}
              >
                {downloadingType === 'combined' ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                <span>{downloadingType === 'combined' ? 'Generating Excel...' : 'Download Pre + Post Excel'}</span>
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* ─── Bottom Note ─── */}
      <footer style={{
        padding: isMobile ? '16px 12px' : '20px',
        textAlign: 'center',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff',
        marginTop: 'auto'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          fontWeight: '500'
        }}>
          Super Admin panel is currently under development.
        </div>
      </footer>
    </div>
  );
}
