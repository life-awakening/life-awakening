import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import { 
  TrendingUp, BarChart2, Users, BookOpen, FileText, AlertTriangle, 
  CheckCircle, RefreshCw, Download, Trash2, Plus, Search, Filter, 
  Calendar, Clock, ArrowUpRight, Tag, ChevronRight, ChevronDown, 
  File, Image, MessageSquare, FileCode, Check, AlertOctagon, Eye, UploadCloud
} from 'lucide-react';

export default function TrendsAnalyticsModule({ token, showToast, batches, users }) {
  const [activeSubTab, setActiveSubTab] = useState('attendance');

  const apiBase = API_BASE_URL;

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers
    });
  }, [token, apiBase]);

  // Attendance states
  const [attendanceData, setAttendanceData] = useState({
    overallAttendance: 0,
    byDay: [],
    bySquad: [],
    byFaculty: [],
    lateArrivals: [],
    missedSessions: [],
    topAttendance: [],
    lowestAttendance: []
  });
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Feedback states
  const [feedbackData, setFeedbackData] = useState({
    summary: { overall_avg: 5, faculty_avg: 5, accommodation_avg: 5, food_avg: 5, travel_avg: 5 },
    categoryRatings: [],
    comments: [],
    wordCloud: []
  });
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackFilterCategory, setFeedbackFilterCategory] = useState('');
  const [feedbackSearchText, setFeedbackSearchText] = useState('');

  // Red Flag states
  const [redFlags, setRedFlags] = useState([]);
  const [selectedFlagId, setSelectedFlagId] = useState(null);
  const [flagDetails, setFlagDetails] = useState(null);
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // File Management states
  const [files, setFiles] = useState([]);
  const [fileFilterType, setFileFilterType] = useState('all');
  const [fileSearch, setFileSearch] = useState('');
  const [uploadForm, setUploadForm] = useState({ name: '', url: 'https://example.com/mock-file.pdf', file_type: 'Document', description: '', target_role: 'all' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFileForVersions, setSelectedFileForVersions] = useState(null);
  const [fileVersions, setFileVersions] = useState([]);
  const [newVersionUrl, setNewVersionUrl] = useState('https://example.com/mock-file-v2.pdf');
  const [previewFile, setPreviewFile] = useState(null);

  // Loaders
  const fetchAttendanceAnalytics = useCallback(async () => {
    setLoadingAttendance(true);
    try {
      const res = await apiFetch('/api/superadmin/attendance-analytics');
      if (res?.ok) {
        const data = await res.json();
        setAttendanceData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAttendance(false);
    }
  }, [apiFetch]);

  const fetchFeedbackAnalytics = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await apiFetch('/api/superadmin/feedback-analytics');
      if (res?.ok) {
        const data = await res.json();
        setFeedbackData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeedback(false);
    }
  }, [apiFetch]);

  const fetchRedFlags = useCallback(async () => {
    setLoadingFlags(true);
    try {
      const res = await apiFetch('/api/superadmin/red-flags-control');
      if (res?.ok) {
        const data = await res.json();
        setRedFlags(data.flags || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFlags(false);
    }
  }, [apiFetch]);

  const fetchFilesList = useCallback(async () => {
    try {
      const res = await apiFetch('/api/superadmin/files');
      if (res?.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (activeSubTab === 'attendance') fetchAttendanceAnalytics();
    if (activeSubTab === 'feedback') fetchFeedbackAnalytics();
    if (activeSubTab === 'redflags') fetchRedFlags();
    if (activeSubTab === 'files') fetchFilesList();
  }, [activeSubTab, fetchAttendanceAnalytics, fetchFeedbackAnalytics, fetchRedFlags, fetchFilesList]);

  // Red Flag detail drawer loader
  const loadRedFlagDetails = async (id) => {
    try {
      const res = await apiFetch(`/api/superadmin/red-flags/${id}`);
      if (res?.ok) {
        const data = await res.json();
        setFlagDetails(data);
        setSelectedFlagId(id);
        setAssigneeId(data.flag.assigned_to || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignFlag = async (id, assignee) => {
    try {
      const res = await apiFetch(`/api/superadmin/red-flags/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedTo: assignee })
      });
      if (res?.ok) {
        showToast('Red flag assigned successfully', 'success');
        loadRedFlagDetails(id);
        fetchRedFlags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveFlag = async (id) => {
    try {
      const res = await apiFetch(`/api/superadmin/red-flags/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ notes: resolutionNotes })
      });
      if (res?.ok) {
        showToast('Red flag status marked as resolved', 'success');
        setResolutionNotes('');
        loadRedFlagDetails(id);
        fetchRedFlags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReopenFlag = async (id) => {
    try {
      const res = await apiFetch(`/api/superadmin/red-flags/${id}/reopen`, {
        method: 'POST'
      });
      if (res?.ok) {
        showToast('Red flag status marked as Open', 'success');
        loadRedFlagDetails(id);
        fetchRedFlags();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await apiFetch(`/api/superadmin/red-flags/${selectedFlagId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ commentText: newComment })
      });
      if (res?.ok) {
        setNewComment('');
        loadRedFlagDetails(selectedFlagId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Files management actions
  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadForm.name.trim() || !uploadForm.url.trim()) {
      showToast('Name and URL are required', 'error');
      return;
    }
    try {
      const activeBatch = batches.find(b => b.status === 'active');
      const payload = {
        name: uploadForm.name,
        url: uploadForm.url,
        file_type: uploadForm.file_type,
        target_role: uploadForm.target_role,
        description: uploadForm.description,
        batch_id: activeBatch ? activeBatch.id : null
      };

      // We will reuse the general upload document route
      const res = await apiFetch('/api/general/documents', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res?.ok) {
        showToast('File uploaded successfully', 'success');
        setShowUploadModal(false);
        setUploadForm({ name: '', url: 'https://example.com/mock-file.pdf', file_type: 'Document', description: '', target_role: 'all' });
        fetchFilesList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFile = async (id) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      const res = await apiFetch(`/api/superadmin/files/${id}`, { method: 'DELETE' });
      if (res?.ok) {
        showToast('File and all its versions deleted', 'success');
        fetchFilesList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadVersions = async (fileObj) => {
    setSelectedFileForVersions(fileObj);
    try {
      const res = await apiFetch(`/api/superadmin/files/${fileObj.id}/versions`);
      if (res?.ok) {
        const data = await res.json();
        setFileVersions(data.versions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadNewVersion = async (e) => {
    e.preventDefault();
    if (!newVersionUrl.trim()) return;
    try {
      const res = await apiFetch(`/api/superadmin/files/${selectedFileForVersions.id}/new-version`, {
        method: 'POST',
        body: JSON.stringify({ url: newVersionUrl })
      });
      if (res?.ok) {
        showToast('New version uploaded successfully', 'success');
        loadVersions(selectedFileForVersions);
        fetchFilesList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="trends-analytics-module animate-fade-in" style={{ padding: '8px' }}>
      
      {/* Module Title / Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Trends & Analytics Control Panel</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-3)' }}>
            System-wide metric visualization, student evaluation trends, red flag control, and versioned file vault.
          </p>
        </div>
        
        {/* Sub-tab navigation */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '4px', gap: '4px' }}>
          <button 
            className={`admin-sub-tab-btn ${activeSubTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('attendance')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', 
              background: activeSubTab === 'attendance' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'attendance' ? '#fff' : 'var(--text-3)',
              cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={15} /> Attendance
          </button>
          <button 
            className={`admin-sub-tab-btn ${activeSubTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('feedback')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', 
              background: activeSubTab === 'feedback' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'feedback' ? '#fff' : 'var(--text-3)',
              cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={15} /> Feedback
          </button>
          <button 
            className={`admin-sub-tab-btn ${activeSubTab === 'redflags' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('redflags')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', 
              background: activeSubTab === 'redflags' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'redflags' ? '#fff' : 'var(--text-3)',
              cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <AlertOctagon size={15} /> Red Flags
          </button>
          <button 
            className={`admin-sub-tab-btn ${activeSubTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('files')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', 
              background: activeSubTab === 'files' ? 'var(--primary)' : 'transparent',
              color: activeSubTab === 'files' ? '#fff' : 'var(--text-3)',
              cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={15} /> File Store
          </button>
        </div>
      </div>

      <hr style={{ border: '0', borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' }} />

      {/* SUB TAB CONTENT */}

      {/* 1. ATTENDANCE ANALYTICS */}
      {activeSubTab === 'attendance' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loadingAttendance ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
              <RefreshCw className="animate-spin" style={{ marginBottom: '12px' }} />
              <div>Aggregating attendance records...</div>
            </div>
          ) : (
            <>
              {/* Stat Overview and Top Dial */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
                <div className="white-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Overall Attendance</span>
                  <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="65" cy="65" r="55" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="transparent" />
                      <circle 
                        cx="65" cy="65" r="55" 
                        stroke="var(--primary)" 
                        strokeWidth="12" 
                        fill="transparent" 
                        strokeDasharray={345.5}
                        strokeDashoffset={345.5 - (345.5 * (attendanceData.overallAttendance || 0)) / 100}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>
                      {attendanceData.overallAttendance}%
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '16px' }}>Active batch average compliance rate</span>
                </div>

                <div className="white-card" style={{ padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700 }}>Attendance By Day Trend</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Daily aggregate compliance</span>
                  </div>
                  
                  {/* SVG Line / Area Chart for Attendance by Day */}
                  <div style={{ height: '140px', position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {attendanceData.byDay.length > 0 ? (
                      <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                        {/* Area Gradient */}
                        <defs>
                          <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        {/* Area path */}
                        <path
                          d={`M 0 100 ${attendanceData.byDay.map((d, i) => {
                            const x = (i / (attendanceData.byDay.length - 1)) * 500;
                            const y = 100 - (d.percentage || 0); // scale 0-100 to height 100
                            return `L ${x} ${y}`;
                          }).join(' ')} L 500 100 Z`}
                          fill="url(#attendanceGrad)"
                        />
                        {/* Line path */}
                        <path
                          d={attendanceData.byDay.map((d, i) => {
                            const x = (i / (attendanceData.byDay.length - 1)) * 500;
                            const y = 100 - (d.percentage || 0);
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                          }).join(' ')}
                          fill="transparent"
                          stroke="var(--primary)"
                          strokeWidth="2.5"
                        />
                      </svg>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
                        No session data logged yet.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-3)' }}>
                    <span>{attendanceData.byDay[0]?.date ? new Date(attendanceData.byDay[0].date).toLocaleDateString() : 'Start'}</span>
                    <span>Timeline of sessions</span>
                    <span>{attendanceData.byDay[attendanceData.byDay.length - 1]?.date ? new Date(attendanceData.byDay[attendanceData.byDay.length - 1].date).toLocaleDateString() : 'End'}</span>
                  </div>
                </div>
              </div>

              {/* Squad & Faculty comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text)' }}>Attendance By Squad</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {attendanceData.bySquad.slice(0, 5).map((sq, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Squad {sq.squad}</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{sq.percentage}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--primary)', width: `${sq.percentage}%`, borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))}
                    {attendanceData.bySquad.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>No squad allocation data found.</div>}
                  </div>
                </div>

                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text)' }}>Attendance By Faculty Advisor</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {attendanceData.byFaculty.slice(0, 5).map((fac, i) => (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fac.faculty}</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{fac.percentage}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--primary)', width: `${fac.percentage}%`, borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))}
                    {attendanceData.byFaculty.length === 0 && <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>No faculty advisor logs found.</div>}
                  </div>
                </div>
              </div>

              {/* Lists of top & lowest, late & missed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} style={{ color: '#10B981' }} /> Top Performing Attendance
                  </h3>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-3)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-3)' }}>PRN</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-3)' }}>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.topAttendance.map((st, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 0', color: 'var(--text)' }}>{st.name}</td>
                          <td style={{ padding: '8px 0', color: 'var(--text-3)' }}>{st.prn}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', color: '#10B981', fontWeight: 600 }}>{st.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} style={{ color: '#EF4444' }} /> Action Required (Lowest Attendance)
                  </h3>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-3)' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-3)' }}>PRN</th>
                        <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-3)' }}>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.lowestAttendance.map((st, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 0', color: 'var(--text)' }}>{st.name}</td>
                          <td style={{ padding: '8px 0', color: 'var(--text-3)' }}>{st.prn}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', color: '#EF4444', fontWeight: 600 }}>{st.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Late arrivals and missed sessions lists */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text)' }}>Recent Late Arrivals</h3>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '12px' }}>
                      <tbody>
                        {attendanceData.lateArrivals.map((l, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px 0', color: 'var(--text)' }}>{l.name}</td>
                            <td style={{ padding: '6px 0', color: 'var(--text-3)' }}>{l.session_title}</td>
                            <td style={{ padding: '6px 0', color: 'var(--text-3)', textAlign: 'right' }}>{new Date(l.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {attendanceData.lateArrivals.length === 0 && (
                          <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>No late arrivals logged.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text)' }}>Recent Missed Sessions</h3>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '12px' }}>
                      <tbody>
                        {attendanceData.missedSessions.map((l, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px 0', color: 'var(--text)' }}>{l.name}</td>
                            <td style={{ padding: '6px 0', color: 'var(--text-3)' }}>{l.session_title}</td>
                            <td style={{ padding: '6px 0', color: 'var(--text-3)', textAlign: 'right' }}>{new Date(l.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {attendanceData.missedSessions.length === 0 && (
                          <tr><td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)' }}>No missed sessions logged.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. FEEDBACK ANALYTICS */}
      {activeSubTab === 'feedback' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {loadingFeedback ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>
              <RefreshCw className="animate-spin" style={{ marginBottom: '12px' }} />
              <div>Loading feedback analytics...</div>
            </div>
          ) : (
            <>
              {/* Overall Ratings Card Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                {[
                  { label: 'Overall Rating', val: feedbackData.summary.overall_avg },
                  { label: 'Faculty Rating', val: feedbackData.summary.faculty_avg },
                  { label: 'Accommodation', val: feedbackData.summary.accommodation_avg },
                  { label: 'Food & Meals', val: feedbackData.summary.food_avg },
                  { label: 'Travel & Transport', val: feedbackData.summary.travel_avg }
                ].map((item, i) => (
                  <div key={i} className="white-card" style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>{item.label}</span>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)' }}>{item.val || 5.0}</span>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                      {[1,2,3,4,5].map(star => (
                        <span key={star} style={{ color: star <= Math.round(item.val || 5) ? '#F59E0B' : 'rgba(255,255,255,0.1)', fontSize: '14px' }}>★</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Word Cloud and Suggestions Category Ratings */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                {/* Custom Word Cloud visualization */}
                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text)' }}>Interactive Feedback Word Cloud</h3>
                  <div style={{ 
                    display: 'flex', flexWrap: 'wrap', gap: '10px 14px', padding: '16px', 
                    background: 'rgba(0,0,0,0.15)', borderRadius: '12px', minHeight: '140px',
                    alignContent: 'center', justifyContent: 'center', alignItems: 'center'
                  }}>
                    {feedbackData.wordCloud.map((w, i) => {
                      const size = 11 + Math.min(w.value * 2, 22);
                      const opacity = 0.4 + Math.min(w.value * 0.1, 0.6);
                      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#E11D48'];
                      return (
                        <span 
                          key={i} 
                          style={{ 
                            fontSize: `${size}px`, 
                            opacity: opacity, 
                            color: colors[i % colors.length],
                            fontWeight: w.value > 3 ? 'bold' : 'normal',
                            cursor: 'default',
                            transition: 'scale 0.2s',
                            display: 'inline-block'
                          }}
                          className="word-cloud-item"
                          title={`Occurs ${w.value} times`}
                        >
                          {w.text}
                        </span>
                      );
                    })}
                    {feedbackData.wordCloud.length === 0 && <span style={{ color: 'var(--text-3)' }}>No words generated yet.</span>}
                  </div>
                </div>

                <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text)' }}>Average Rating By Category</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {feedbackData.categoryRatings.map((cat, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{cat.category}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: 'var(--text-3)' }}>({cat.count} submissions)</span>
                          <span style={{ background: 'var(--primary)', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {cat.rating_avg}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feedback Comments Wall */}
              <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>Student Submissions & Suggestions</h3>
                  
                  {/* Search and category filters */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select 
                      value={feedbackFilterCategory} 
                      onChange={(e) => setFeedbackFilterCategory(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}
                    >
                      <option value="">All Categories</option>
                      <option value="General">General</option>
                      <option value="Food">Food</option>
                      <option value="Accommodation">Accommodation</option>
                      <option value="Travel">Travel</option>
                      <option value="Faculty">Faculty</option>
                    </select>

                    <input 
                      type="text" 
                      placeholder="Search feedback text..."
                      value={feedbackSearchText}
                      onChange={(e) => setFeedbackSearchText(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', width: '220px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                  {feedbackData.comments
                    .filter(c => !feedbackFilterCategory || c.category === feedbackFilterCategory)
                    .filter(c => !feedbackSearchText || (c.feedback_text || '').toLowerCase().includes(feedbackSearchText.toLowerCase()))
                    .map((c, i) => (
                      <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: '3px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '13px' }}>{c.name || 'Anonymous Student'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{c.category}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ margin: 0, fontSize: '13px', color: 'var(--text)' }}>
                            {(() => {
                              const text = c.feedback_text;
                              if (text && text.startsWith('{')) {
                                try {
                                  const data = JSON.parse(text);
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-sm)', marginTop: 4 }}>
                                      {Object.entries(data).map(([key, val]) => {
                                        let displayKey = key
                                          .replace(/([A-Z])/g, ' $1')
                                          .replace(/^./, str => str.toUpperCase());
                                        let displayVal = Array.isArray(val) ? val.join(', ') : String(val);
                                        if (key === 'confidence') {
                                          displayVal = '★'.repeat(val) + '☆'.repeat(5 - val);
                                        }
                                        return (
                                          <div key={key} style={{ fontSize: 12, lineHeight: 1.4 }}>
                                            <strong style={{ color: 'var(--text-2)' }}>{displayKey}: </strong>
                                            <span style={{ color: 'var(--text)' }}>{displayVal}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                } catch {
                                  // fallback
                                }
                              }
                              return text;
                            })()}
                          </div>
                        </div>

                        {/* Display item rating if exists */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '12px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Rating:</span>
                          <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '14px' }}>{c.average_rating || 5}/5</span>
                        </div>
                      </div>
                    ))}
                  {feedbackData.comments.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>No feedback comments found matching filter criteria.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. RED FLAG CONTROL CENTER */}
      {activeSubTab === 'redflags' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selectedFlagId ? '1.5fr 1fr' : '1fr', gap: '20px' }}>
          
          {/* Main List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Overview cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {[
                { label: 'Critical Severity', count: redFlags.filter(f => f.severity === 'Critical' && f.status !== 'Resolved').length, color: '#EF4444' },
                { label: 'High Severity', count: redFlags.filter(f => f.severity === 'High' && f.status !== 'Resolved').length, color: '#F59E0B' },
                { label: 'Medium/Low', count: redFlags.filter(f => (f.severity === 'Medium' || f.severity === 'Low') && f.status !== 'Resolved').length, color: '#3B82F6' },
                { label: 'Total Resolved', count: redFlags.filter(f => f.status === 'Resolved').length, color: '#10B981' }
              ].map((c, i) => (
                <div key={i} className="white-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</span>
                    <h4 style={{ margin: '4px 0 0 0', fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>{c.count}</h4>
                  </div>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.color }} />
                </div>
              ))}
            </div>

            {/* List and filter filters */}
            <div className="white-card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>Active Red Flag Incident Logs</h3>
                
                {/* Search / Filters */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={filterSeverity} 
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>

                  <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              {loadingFlags ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <RefreshCw className="animate-spin" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {redFlags
                    .filter(f => !filterSeverity || f.severity === filterSeverity)
                    .filter(f => !filterStatus || f.status === filterStatus)
                    .map((flag) => {
                      const severityColors = { Critical: '#EF4444', High: '#F59E0B', Medium: '#3B82F6', Low: '#10B981' };
                      return (
                        <div 
                          key={flag.id} 
                          onClick={() => loadRedFlagDetails(flag.id)}
                          style={{ 
                            padding: '16px', background: selectedFlagId === flag.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                            borderRadius: '12px', borderLeft: `4px solid ${severityColors[flag.severity] || '#ccc'}`,
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                          className="red-flag-row"
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '14px' }}>{flag.student_name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>PRN: {flag.student_prn}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-3)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>{flag.category}</span>
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text)' }}>{flag.reason.substring(0, 80)}...</span>
                            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                              <span>Raised by: {flag.faculty_name}</span>
                              <span>•</span>
                              <span>Assignee: {flag.assignee_name || 'Unassigned'}</span>
                              <span>•</span>
                              <span>{new Date(flag.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Comments Count */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-3)' }}>
                              <MessageSquare size={14} />
                              <span>{flag.comments_count || 0}</span>
                            </div>
                            
                            <span style={{ 
                              background: flag.status === 'Resolved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              color: flag.status === 'Resolved' ? '#10B981' : '#EF4444',
                              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700
                            }}>
                              {flag.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {redFlags.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>No red flag incidents logged.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Details Side Panel/Drawer */}
          {selectedFlagId && flagDetails && (
            <div className="white-card animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ 
                      background: flagDetails.flag.severity === 'Critical' ? '#EF4444' : flagDetails.flag.severity === 'High' ? '#F59E0B' : '#3B82F6',
                      color: '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase'
                    }}>
                      {flagDetails.flag.severity}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>ID: #{flagDetails.flag.id}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text)', fontWeight: 700 }}>{flagDetails.flag.student_name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>Dept: {flagDetails.flag.student_department}</span>
                </div>
                <button 
                  onClick={() => setSelectedFlagId(null)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px' }}
                >
                  &times;
                </button>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: 0 }} />

              {/* Action Board */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Assign to faculty/admin */}
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>Assign Action Owner</label>
                  <select 
                    value={assigneeId} 
                    onChange={(e) => handleAssignFlag(flagDetails.flag.id, e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <option value="">Unassigned</option>
                    {users.filter(u => u.role === 'admin' || u.role === 'faculty').map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                {/* Status Toggle buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  {flagDetails.flag.status === 'Resolved' ? (
                    <button 
                      onClick={() => handleReopenFlag(flagDetails.flag.id)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#3B82F6', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                    >
                      Reopen Incident
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                      <input 
                        type="text" 
                        placeholder="Resolution notes..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                      <button 
                        onClick={() => handleResolveFlag(flagDetails.flag.id)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#10B981', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                      >
                        Mark as Resolved
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: 0 }} />

              {/* Description */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Reason / Incident Description</label>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text)', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', lineHeight: '1.4' }}>
                  {flagDetails.flag.reason}
                </p>
              </div>

              {/* Comments Board */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '8px' }}>Incident Comments</label>
                
                {/* List comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', marginBottom: '10px' }}>
                  {flagDetails.comments.map((comment, idx) => (
                    <div key={idx} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: 'var(--text-3)' }}>
                        <span style={{ fontWeight: 700 }}>{comment.user_name} ({comment.user_role})</span>
                        <span>{new Date(comment.created_at).toLocaleTimeString()}</span>
                      </div>
                      <span style={{ color: 'var(--text)' }}>{comment.comment_text}</span>
                    </div>
                  ))}
                  {flagDetails.comments.length === 0 && (
                    <span style={{ color: 'var(--text-3)', fontSize: '12px', textAlign: 'center', display: 'block', padding: '10px' }}>No comments posted yet.</span>
                  )}
                </div>

                {/* Post comment form */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <button type="submit" style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                    Send
                  </button>
                </form>
              </div>

              {/* History Timeline */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '8px' }}>Incident History Logs</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '140px', overflowY: 'auto' }}>
                  {flagDetails.history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>[{h.action_taken}]</span>
                      <span style={{ color: 'var(--text)' }}>{h.details}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. FILE STORE MANAGEMENT */}
      {activeSubTab === 'files' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Toolbar and filter actions */}
          <div className="white-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Category selector */}
              {['all', 'CSV', 'Insurance', 'Certificate', 'Document', 'Photo'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFileFilterType(type)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: fileFilterType === type ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: fileFilterType === type ? '#fff' : 'var(--text-3)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                placeholder="Search file store..."
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', width: '200px' }}
              />

              <button 
                onClick={() => setShowUploadModal(true)}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
              >
                <Plus size={15} /> Upload File
              </button>
            </div>
          </div>

          {/* Files Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {files
              .filter(f => fileFilterType === 'all' || f.file_type === fileFilterType)
              .filter(f => !fileSearch || f.name.toLowerCase().includes(fileSearch.toLowerCase()))
              .map((file) => {
                const getIcon = (type) => {
                  if (type === 'Photo') return <Image size={24} style={{ color: '#EC4899' }} />;
                  if (type === 'CSV') return <FileCode size={24} style={{ color: '#10B981' }} />;
                  if (type === 'Insurance') return <CheckCircle size={24} style={{ color: '#3B82F6' }} />;
                  return <FileText size={24} style={{ color: '#F59E0B' }} />;
                };

                return (
                  <div key={file.id} className="white-card file-card animate-fade-in" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                        {getIcon(file.file_type)}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={() => setPreviewFile(file)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '4px' }}
                          title="Preview File"
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          onClick={() => loadVersions(file)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: '4px' }}
                          title="Version History"
                        >
                          <Clock size={15} />
                        </button>
                        <button 
                          onClick={() => handleDeleteFile(file.id)}
                          style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                          title="Delete File"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-3)' }}>
                        Type: {file.file_type} | Version: v{file.current_version || 1}
                      </p>
                    </div>

                    <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: 0 }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-3)' }}>
                      <span>By: {file.uploaded_by_name || 'Admin'}</span>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                        Download <Download size={11} />
                      </a>
                    </div>
                  </div>
                );
              })}
            {files.length === 0 && (
              <div style={{ gridColumn: 'span 4', padding: '60px', textAlign: 'center', color: 'var(--text-3)' }}>No files uploaded yet. Click Upload File to start.</div>
            )}
          </div>

          {/* Upload File Modal */}
          {showUploadModal && (
            <div className="admin-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="white-card animate-fade-in" style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>Upload New Document</h3>
                  <button onClick={() => setShowUploadModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>

                <form onSubmit={handleUploadFile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Document Name</label>
                    <input 
                      type="text" 
                      required
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                      placeholder="e.g. Batch 7 Insurance Coverage"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Document URL (Mock File Path)</label>
                    <input 
                      type="text" 
                      required
                      value={uploadForm.url}
                      onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>File Storage Type</label>
                    <select 
                      value={uploadForm.file_type}
                      onChange={(e) => setUploadForm({ ...uploadForm, file_type: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                    >
                      <option value="Document">General Document</option>
                      <option value="CSV">Uploaded CSV</option>
                      <option value="Insurance">Insurance File</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Photo">Photo/Media Asset</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Description</label>
                    <textarea 
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      placeholder="Optional details..."
                      rows="2"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', resize: 'none' }}
                    />
                  </div>

                  <button type="submit" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginTop: '6px' }}>
                    Upload File to Vault
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Version History Modal */}
          {selectedFileForVersions && (
            <div className="admin-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="white-card animate-fade-in" style={{ padding: '24px', width: '450px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>Version Vault History</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{selectedFileForVersions.name}</span>
                  </div>
                  <button onClick={() => setSelectedFileForVersions(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>

                <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: 0 }} />

                {/* Upload new version form */}
                <form onSubmit={handleUploadNewVersion} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-3)' }}>Upload New File Version</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      required
                      placeholder="Enter new version file URL..."
                      value={newVersionUrl}
                      onChange={(e) => setNewVersionUrl(e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <button type="submit" style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UploadCloud size={14} /> Push
                    </button>
                  </div>
                </form>

                <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.06)', margin: 0 }} />

                {/* Versions timeline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {fileVersions.map((ver, idx) => (
                    <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '12px' }}>Version v{ver.version}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-3)' }}>Uploaded on {new Date(ver.created_at).toLocaleString()}</span>
                      </div>
                      <a href={ver.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                        Download
                      </a>
                    </div>
                  ))}
                  {fileVersions.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-3)' }}>No version history log exists.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Simple Preview Modal */}
          {previewFile && (
            <div className="admin-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="white-card animate-fade-in" style={{ padding: '24px', width: '500px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>File Document Preview</h3>
                  <button onClick={() => setPreviewFile(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minHeight: '200px', justifyContent: 'center', textAlign: 'center' }}>
                  {previewFile.file_type === 'Photo' || previewFile.url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                    <img src={previewFile.url} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <FileText size={48} style={{ color: 'var(--primary)' }} />
                  )}
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>{previewFile.name}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{previewFile.description || 'No description provided.'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    File Type: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{previewFile.file_type}</span> | Active Version: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>v{previewFile.current_version || 1}</span>
                  </div>
                  <a href={previewFile.url} target="_blank" rel="noopener noreferrer" style={{ background: 'var(--primary)', color: '#fff', textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginTop: '10px' }}>
                    Open Original File
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
