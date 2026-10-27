import React, { useState, useEffect, useMemo } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  Flag,
  Search,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Eye,
  Info,
  X,
  PlusCircle,
  MessageSquare,
  ShieldAlert,
  Activity,
  HeartPulse,
  Send,
  AlertCircle,
  Paperclip,
  FileText,
  Upload,
  ExternalLink,
  Trash2
} from 'lucide-react';

const API = API_BASE_URL;

// Robust URL resolver (routes uploaded assets through /api/uploads for CloudFront compatibility)
const resolveFileUrl = (url) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
      return trimmed.replace('/uploads/', '/api/uploads/');
    }
    return trimmed;
  }
  let clean = trimmed;
  if (clean.startsWith('/uploads/')) {
    clean = `/api${clean}`;
  } else if (clean.startsWith('uploads/')) {
    clean = `/api/${clean}`;
  } else if (!clean.startsWith('/api/')) {
    clean = `/api/uploads/${clean.startsWith('/') ? clean.slice(1) : clean}`;
  }
  const base = API && API.trim() ? API.trim().replace(/\/+$/, '') : '';
  return base ? `${base}${clean.startsWith('/') ? '' : '/'}${clean}` : clean;
};

const CATEGORIES = [
  'Minor Injury',
  'Physical Discomfort',
  'Health Concern',
  'Safety Concern',
  'Other Non-Critical Incident'
];

export default function RiFacultyOrangeFlagTab({ token, isMobile: propIsMobile, batchId, panelId }) {
  const [internalIsMobile, setInternalIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setInternalIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;
  const activeToken = token || localStorage.getItem('ri_token') || localStorage.getItem('token');

  // Data state
  const [students, setStudents] = useState([]);
  const [myFlags, setMyFlags] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, under_follow_up: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Creation Form state
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [category, setCategory] = useState('Minor Injury');
  const [description, setDescription] = useState('');
  const [incidentDateTime, setIncidentDateTime] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(true);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [medicalReportFile, setMedicalReportFile] = useState(null);
  const [medicalReportError, setMedicalReportError] = useState('');

  const handleMedicalFileChange = (e) => {
    const file = e.target.files?.[0];
    setMedicalReportError('');
    if (!file) return;

    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isImage = file.type && file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!allowedExts.includes(ext) && !isImage && !isPdf) {
      setMedicalReportError('Invalid file type. Allowed: PDF, JPG, PNG, WEBP, DOCX.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMedicalReportError('File exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    setMedicalReportFile(file);
  };

  // Filters & Search
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  // Details Modal state
  const [selectedFlagDetails, setSelectedFlagDetails] = useState(null);
  const [flagHistory, setFlagHistory] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newFollowUpNote, setNewFollowUpNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Initialize current local datetime string for input (YYYY-MM-DDTHH:mm)
  useEffect(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
    setIncidentDateTime(localISOTime);
  }, [showCreateModal]);

  // Fetch faculty data
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${activeToken}` };
      const qParams = new URLSearchParams();
      if (batchId) qParams.append('batch_id', String(batchId));
      if (panelId) qParams.append('panel_id', String(panelId));
      const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

      const [studentsRes, flagsRes] = await Promise.all([
        fetch(`${API}/api/ri/orange-flags/faculty/students${qStr}`, { headers }),
        fetch(`${API}/api/ri/orange-flags/faculty/my-flags${qStr}`, { headers })
      ]);

      if (studentsRes.ok) {
        const sData = await studentsRes.json();
        setStudents(sData.students || []);
      }

      if (flagsRes.ok) {
        const fData = await flagsRes.json();
        setMyFlags(fData.orangeFlags || []);
        if (fData.stats) setStats(fData.stats);
      }
    } catch (err) {
      console.error('Error fetching orange flag data:', err);
      showToast('Failed to load students or incident records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batchId, panelId]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => String(s.student_id) === String(selectedStudentId));
  }, [selectedStudentId, students]);

  const filteredStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return students;
    const term = searchStudentTerm.toLowerCase();
    return students.filter(s =>
      (s.student_name || '').toLowerCase().includes(term) ||
      (s.student_prn || '').toLowerCase().includes(term) ||
      (s.department || '').toLowerCase().includes(term) ||
      (s.panel_name || '').toLowerCase().includes(term)
    );
  }, [students, searchStudentTerm]);

  const filteredMyFlags = useMemo(() => {
    return myFlags.filter(flag => {
      const matchesCategory = filterCategory === 'all' || (flag.category || '').toLowerCase() === filterCategory.toLowerCase();
      const matchesStatus = filterStatus === 'all' || (flag.status || '').toLowerCase() === filterStatus.toLowerCase();
      const term = historySearch.toLowerCase();
      const matchesSearch = !term ||
        (flag.student_name || '').toLowerCase().includes(term) ||
        (flag.student_prn || '').toLowerCase().includes(term) ||
        (flag.description || '').toLowerCase().includes(term) ||
        (flag.panel_name || '').toLowerCase().includes(term);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [myFlags, filterCategory, filterStatus, historySearch]);

  // Submit new incident
  const handleSubmitOrangeFlag = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      showToast('Please select a student from your assigned panel.', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please provide a detailed description of the incident.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('student_id', String(selectedStudentId));
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('incident_date_time', incidentDateTime || new Date().toISOString());
      if (actionTaken) formData.append('action_taken', actionTaken.trim());
      formData.append('follow_up_required', Boolean(followUpRequired));
      if (followUpNotes) formData.append('follow_up_notes', followUpNotes.trim());
      if (additionalInfo) formData.append('additional_info', additionalInfo.trim());
      if (medicalReportFile) {
        formData.append('medical_report', medicalReportFile);
      }

      const res = await fetch(`${API}/api/ri/orange-flags/faculty/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit orange flag incident.');
      }

      showToast(data.message || 'Orange flag reported successfully!', 'success');

      // Reset form
      setSelectedStudentId('');
      setDescription('');
      setActionTaken('');
      setFollowUpNotes('');
      setAdditionalInfo('');
      setFollowUpRequired(true);
      setMedicalReportFile(null);
      setMedicalReportError('');
      setShowCreateModal(false);

      // Refresh list
      fetchData();
    } catch (err) {
      console.error('Error submitting orange flag:', err);
      showToast(err.message || 'Failed to submit incident.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open flag details & load full history
  const openFlagDetails = async (flag) => {
    setSelectedFlagDetails(flag);
    setNewFollowUpNote('');
    setNewStatus('');
    setResolutionNotes('');
    setLoadingDetails(true);

    try {
      const res = await fetch(`${API}/api/ri/orange-flags/${flag.id}/details`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedFlagDetails(data.orangeFlag || flag);
        setFlagHistory(data.history || []);
      } else {
        setFlagHistory([]);
      }
    } catch (err) {
      console.error('Error loading flag details:', err);
      setFlagHistory([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Add follow-up note / update status
  const handleAddFollowUp = async (e) => {
    e.preventDefault();
    if (!newFollowUpNote.trim() && !newStatus) {
      showToast('Please enter a follow-up note or choose a status change.', 'error');
      return;
    }

    setSubmittingNote(true);
    try {
      const payload = {
        notes: newFollowUpNote.trim(),
        status: newStatus || undefined,
        resolution_notes: newStatus === 'resolved' ? (resolutionNotes.trim() || newFollowUpNote.trim()) : undefined
      };

      const res = await fetch(`${API}/api/ri/orange-flags/faculty/${selectedFlagDetails.id}/follow-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to record follow-up note.');
      }

      showToast(data.message || 'Follow-up saved successfully!', 'success');
      setSelectedFlagDetails(data.orangeFlag);
      setFlagHistory(data.history || []);
      setNewFollowUpNote('');
      setNewStatus('');
      setResolutionNotes('');

      // Refresh list & stats
      fetchData();
    } catch (err) {
      console.error('Error adding follow-up:', err);
      showToast(err.message || 'Failed to save follow-up.', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Status badge helper
  const getStatusBadge = (status) => {
    const s = (status || 'open').toLowerCase();
    if (s === 'resolved') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0'
        }}>
          <CheckCircle2 size={12} /> Resolved
        </span>
      );
    }
    if (s === 'under_follow_up') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '11.5px',
          fontWeight: '700',
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe'
        }}>
          <Clock size={12} /> Under Follow-up
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11.5px',
        fontWeight: '700',
        background: '#fff7ed',
        color: '#c2410c',
        border: '1px solid #fed7aa'
      }}>
        <AlertCircle size={12} /> Open
      </span>
    );
  };

  // Category badge helper
  const getCategoryBadge = (cat) => {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '11.5px',
        fontWeight: '600',
        background: '#ffedd5',
        color: '#9a3412',
        border: '1px solid #fdba74'
      }}>
        <Flag size={11} color="#ea580c" />
        {cat}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '50px' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : '#ea580c',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600',
          fontSize: '13.5px',
          animation: 'slideIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}

      {/* Top Banner & Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: '#fff7ed',
              color: '#ea580c',
              padding: '8px',
              borderRadius: '10px',
              border: '1px solid #fed7aa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Flag size={22} color="#ea580c" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '23px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
                Orange Flag Management
              </h1>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Report and track non-critical student incidents (minor injuries, physical discomfort, health & safety concerns) requiring follow-up.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-orange-600' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ea580c',
              border: 'none',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <PlusCircle size={15} />
            Report Orange Flag
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Total Incidents
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {stats.total || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '600' }}>
            In your authorized panel
          </span>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #fed7aa',
          backgroundColor: '#fffdfa',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#c2410c', letterSpacing: '0.5px' }}>
            Open Incidents
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#ea580c', marginTop: '4px' }}>
            {stats.open || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Requires faculty attention
          </span>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #bfdbfe',
          backgroundColor: '#fbfdff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#1d4ed8', letterSpacing: '0.5px' }}>
            Under Follow-up
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
            {stats.under_follow_up || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Monitoring in progress
          </span>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #bbf7d0',
          backgroundColor: '#fbfdfb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.5px' }}>
            Resolved
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>
            {stats.resolved || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Addressed & closed
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '14px 16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '7px 12px',
          flex: '1 1 240px',
          minWidth: '220px'
        }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            placeholder="Search by student name, PRN, incident description..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '13px',
              color: '#0f172a',
              width: '100%'
            }}
          />
          {historySearch && (
            <button
              onClick={() => setHistorySearch('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="under_follow_up">Under Follow-up</option>
          <option value="resolved">Resolved</option>
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Incident List */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin text-orange-600" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Loading orange flag incidents...</p>
          </div>
        ) : filteredMyFlags.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#fff7ed',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid #fed7aa'
            }}>
              <Flag size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              No Orange Flag incidents found.
            </h3>
            <p style={{ margin: '6px 0 16px 0', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              {myFlags.length === 0
                ? 'No non-critical incidents have been reported for your assigned panel students.'
                : 'No incidents match your current filter and search criteria.'}
            </p>
            {myFlags.length === 0 && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <PlusCircle size={15} />
                Report an Incident
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredMyFlags.map((flag, idx) => (
              <div
                key={flag.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: idx === filteredMyFlags.length - 1 ? 'none' : '1px solid #f1f5f9',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background 0.15s ease'
                }}
                className="hover:bg-orange-50/20"
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '750', color: '#0f172a' }}>
                      {flag.student_name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                      ({flag.student_prn || 'N/A'})
                    </span>
                    {getCategoryBadge(flag.category)}
                    {getStatusBadge(flag.status)}
                    {flag.medical_report_url && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        <Paperclip size={11} /> Medical Doc Attached
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      #{flag.id}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>
                    {flag.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#64748b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} color="#94a3b8" />
                      {flag.incident_date_time ? new Date(flag.incident_date_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                    </span>
                    <span>
                      <strong>Panel:</strong> {flag.panel_name || 'N/A'}
                    </span>
                    {flag.action_taken && (
                      <span>
                        <strong>Action:</strong> {flag.action_taken}
                      </span>
                    )}
                    {flag.history_count > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '6px',
                        fontWeight: '600',
                        color: '#475569'
                      }}>
                        <MessageSquare size={11} /> {flag.history_count} note(s)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => openFlagDetails(flag)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    className="hover:border-orange-500 hover:text-orange-600"
                  >
                    <Eye size={14} />
                    View & Follow-up
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODAL 1: REPORT ORANGE FLAG INCIDENT ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fff7ed', color: '#ea580c', padding: '6px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                  <Flag size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Report Orange Flag Incident
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Record a non-critical incident requiring attention or follow-up
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitOrangeFlag} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px', gap: '16px' }}>
              
              {/* Select Student */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Select Student <span style={{ color: '#ef4444' }}>*</span>
                </label>

                {students.length === 0 ? (
                  <div style={{ padding: '12px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
                    No students found in your assigned panel.
                  </div>
                ) : (
                  <>
                    <div style={{ position: 'relative', marginBottom: '6px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search student by name, PRN, or dept..."
                        value={searchStudentTerm}
                        onChange={e => setSearchStudentTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 32px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <select
                      value={selectedStudentId}
                      onChange={e => setSelectedStudentId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13px',
                        color: '#0f172a',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose Student ({filteredStudents.length} available) --</option>
                      {filteredStudents.map(s => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.student_name} ({s.student_prn || 'No PRN'}) - {s.panel_name || `Panel ${s.panel_number}`}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {selectedStudent && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#7c2d12',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <span><strong>Email:</strong> {selectedStudent.student_email || 'N/A'}</span>
                    <span><strong>Dept:</strong> {selectedStudent.department || 'N/A'}</span>
                    <span><strong>Panel:</strong> {selectedStudent.panel_name || 'N/A'}</span>
                  </div>
                )}
              </div>

              {/* Category & Date/Time Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Incident Category <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Incident Date & Time <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={incidentDateTime}
                    onChange={e => setIncidentDateTime(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Incident Description */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Incident Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what occurred, circumstances, student symptoms/condition..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Immediate Action Taken */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Immediate Action Taken (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. First-aid applied, resting in shade, hydration provided..."
                  value={actionTaken}
                  onChange={e => setActionTaken(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Follow-up Required Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="fuRequired"
                  checked={followUpRequired}
                  onChange={e => setFollowUpRequired(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ea580c' }}
                />
                <label htmlFor="fuRequired" style={{ fontSize: '13px', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>
                  Follow-up monitoring required
                </label>
              </div>

              {/* Initial Follow-up Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Initial Follow-up Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Check temperature this evening, monitor mobility tomorrow..."
                  value={followUpNotes}
                  onChange={e => setFollowUpNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Optional Medical Report or Prescription Upload */}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} color="#ea580c" />
                    Medical Report / Prescription <span style={{ color: '#64748b', fontWeight: '400', fontSize: '12px' }}>(Optional)</span>
                  </label>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Max 10MB (PDF, JPG, PNG, DOCX)</span>
                </div>

                {!medicalReportFile ? (
                  <div>
                    <label
                      htmlFor="facultyOrangeMedicalFile"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        color: '#475569',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover:border-orange-500 hover:text-orange-600"
                    >
                      <Upload size={14} />
                      Choose file or click to attach prescription / report
                    </label>
                    <input
                      id="facultyOrangeMedicalFile"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      style={{ display: 'none' }}
                      onChange={handleMedicalFileChange}
                    />
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #fed7aa',
                    padding: '8px 12px',
                    borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={16} color="#ea580c" />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>
                          {medicalReportFile.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {(medicalReportFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMedicalReportFile(null)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                      title="Remove file"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}

                {medicalReportError && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} /> {medicalReportError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
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
                  disabled={submitting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {submitting ? 'Submitting...' : 'Submit Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: INCIDENT DETAILS & FOLLOW-UP TRAIL ── */}
      {selectedFlagDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#fff7ed', color: '#ea580c', padding: '6px', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                  <Flag size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      Incident #{selectedFlagDetails.id} - {selectedFlagDetails.student_name}
                    </h3>
                    {getStatusBadge(selectedFlagDetails.status)}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    PRN: {selectedFlagDetails.student_prn || 'N/A'} • {selectedFlagDetails.panel_name || 'Panel'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFlagDetails(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Incident Summary Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {getCategoryBadge(selectedFlagDetails.category)}
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Reported on {selectedFlagDetails.created_at ? new Date(selectedFlagDetails.created_at).toLocaleString('en-IN') : 'N/A'}
                  </span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: '#1e293b', fontWeight: '500', lineHeight: '1.45' }}>
                  {selectedFlagDetails.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <div><strong>Incident Date:</strong> {selectedFlagDetails.incident_date_time ? new Date(selectedFlagDetails.incident_date_time).toLocaleString('en-IN') : 'N/A'}</div>
                  <div><strong>Immediate Action:</strong> {selectedFlagDetails.action_taken || 'None recorded'}</div>
                  <div><strong>Reported By:</strong> {selectedFlagDetails.faculty_name} ({selectedFlagDetails.faculty_email || 'N/A'})</div>
                  <div><strong>Follow-up Required:</strong> {selectedFlagDetails.follow_up_required ? 'Yes' : 'No'}</div>
                  {selectedFlagDetails.resolution_notes && (
                    <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2', background: '#ecfdf5', padding: '8px', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#065f46' }}>
                      <strong>Resolution Notes:</strong> {selectedFlagDetails.resolution_notes} (by {selectedFlagDetails.resolved_by_name || 'Admin'} on {selectedFlagDetails.resolved_at ? new Date(selectedFlagDetails.resolved_at).toLocaleDateString('en-IN') : ''})
                    </div>
                  )}
                </div>

                {selectedFlagDetails.medical_report_url && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#dbeafe', padding: '8px', borderRadius: '8px', color: '#1d4ed8' }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '750', color: '#1e40af' }}>
                          {selectedFlagDetails.medical_report_name || 'Prescription / Medical Report'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {selectedFlagDetails.medical_report_size
                            ? `${(selectedFlagDetails.medical_report_size / 1024).toFixed(1)} KB • Uploaded with incident`
                            : 'Uploaded with incident'}
                        </div>
                      </div>
                    </div>
                    <a
                      href={resolveFileUrl(selectedFlagDetails.medical_report_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#2563eb',
                        color: '#ffffff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        textDecoration: 'none'
                      }}
                    >
                      <ExternalLink size={13} /> View / Download Document
                    </a>
                  </div>
                )}
              </div>

              {/* Follow-up History Timeline */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '750', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={15} color="#ea580c" />
                  Follow-up Notes & Incident History ({flagHistory.length})
                </h4>

                {loadingDetails ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    <RefreshCw size={16} className="animate-spin text-orange-600" />
                  </div>
                ) : flagHistory.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No follow-up notes recorded yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {flagHistory.map((h, i) => (
                      <div
                        key={h.id || i}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          borderLeft: h.action === 'RESOLVED' ? '4px solid #16a34a' : '4px solid #ea580c'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                            {h.user_name || 'Faculty'} <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>({h.user_role || 'staff'})</span>
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#334155' }}>
                          {h.notes}
                        </p>
                        {h.new_status && h.previous_status && h.new_status !== h.previous_status && (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#ea580c', fontWeight: '600' }}>
                            Status changed: {h.previous_status} → {h.new_status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Follow-up Note Form */}
              <form onSubmit={handleAddFollowUp} style={{
                background: '#fffdfa',
                border: '1px solid #fed7aa',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '750', color: '#9a3412' }}>
                  Add Follow-up Note / Update Status
                </span>

                <textarea
                  rows={2}
                  placeholder="Record patient update, observation, medication, doctor visit details..."
                  value={newFollowUpNote}
                  onChange={e => setNewFollowUpNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Update Status (Optional)
                    </label>
                    <select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '12.5px',
                        color: '#0f172a'
                      }}
                    >
                      <option value="">Keep current status ({selectedFlagDetails.status})</option>
                      <option value="open">Open</option>
                      <option value="under_follow_up">Under Follow-up</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  {newStatus === 'resolved' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#15803d', marginBottom: '4px' }}>
                        Resolution Summary
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Recovered, normal activity resumed"
                        value={resolutionNotes}
                        onChange={e => setResolutionNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #a7f3d0',
                          background: '#ecfdf5',
                          fontSize: '12.5px',
                          color: '#065f46',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    disabled={submittingNote}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#ea580c',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: submittingNote ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {submittingNote ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                    {submittingNote ? 'Saving...' : 'Save Follow-up'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
