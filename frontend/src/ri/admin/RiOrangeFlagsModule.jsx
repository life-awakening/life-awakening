import React, { useState, useEffect, useMemo } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  Flag,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  User,
  Building,
  GraduationCap,
  Calendar,
  X,
  Send,
  SlidersHorizontal,
  ChevronRight,
  FileSpreadsheet,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  MapPin,
  Phone,
  Paperclip,
  FileText,
  ExternalLink
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

export default function RiOrangeFlagsModule({ token, userRole = '' }) {
  const [orangeFlags, setOrangeFlags] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    under_follow_up: 0,
    resolved: 0,
    minor_injury: 0,
    physical_discomfort: 0,
    health_concern: 0,
    safety_concern: 0,
    other: 0
  });
  const [batches, setBatches] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedPanel, setSelectedPanel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal & Management state
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [flagHistory, setFlagHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  const activeToken = token || localStorage.getItem('ri_token') || localStorage.getItem('token');
  const isReadOnly = (userRole || '').toLowerCase().includes('readonly');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchOrangeFlags = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBatch !== 'all') params.append('batch_id', selectedBatch);
      if (selectedPanel !== 'all') params.append('panel_id', selectedPanel);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`${API}/api/ri/orange-flags/admin/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setOrangeFlags(data.orangeFlags || []);
        if (data.stats) setStats(data.stats);
        if (data.batches) setBatches(data.batches);
        if (data.panels) setPanels(data.panels);
      } else {
        showToast('Failed to fetch orange flags.', 'error');
      }
    } catch (err) {
      console.error('Error fetching orange flags:', err);
      showToast('Server error loading orange flag list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrangeFlags();
  }, [selectedBatch, selectedPanel, selectedCategory, selectedStatus]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrangeFlags();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Download Excel Report
  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBatch !== 'all') params.append('batch_id', selectedBatch);
      if (selectedPanel !== 'all') params.append('panel_id', selectedPanel);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`${API}/api/ri/orange-flags/admin/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `RI_Orange_Flags_Report_${dateStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToast('Excel report downloaded successfully!', 'success');
      } else {
        showToast('Failed to generate Excel report.', 'error');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast('Error exporting Excel.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Open flag details & fetch history
  const handleOpenDetails = async (flag) => {
    setSelectedFlag(flag);
    setEditStatus(flag.status || 'open');
    setAdminNote('');
    setResolutionNotes(flag.resolution_notes || '');
    setLoadingHistory(true);

    try {
      const res = await fetch(`${API}/api/ri/orange-flags/${flag.id}/details`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedFlag(data.orangeFlag || flag);
        setFlagHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching flag history:', err);
      setFlagHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Update Status / Add Admin Follow-up Note
  const handleSaveManagement = async (e) => {
    e.preventDefault();
    if (isReadOnly) {
      showToast('Read-only accounts cannot modify incidents.', 'error');
      return;
    }

    if (!adminNote.trim() && editStatus === selectedFlag.status) {
      showToast('No changes detected to save.', 'info');
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        notes: adminNote.trim(),
        status: editStatus !== selectedFlag.status ? editStatus : undefined,
        resolution_notes: editStatus === 'resolved' ? (resolutionNotes.trim() || adminNote.trim()) : undefined
      };

      const res = await fetch(`${API}/api/ri/orange-flags/admin/${selectedFlag.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update incident.');
      }

      showToast(data.message || 'Incident updated successfully!', 'success');
      setSelectedFlag(data.orangeFlag);
      setFlagHistory(data.history || []);
      setAdminNote('');
      fetchOrangeFlags();
    } catch (err) {
      console.error('Error updating orange flag:', err);
      showToast(err.message || 'Failed to update incident.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // Category badge
  const getCategoryBadge = (cat) => (
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
      border: '1px solid #fdba74',
      whiteSpace: 'nowrap'
    }}>
      <Flag size={11} color="#ea580c" />
      {cat}
    </span>
  );

  // Status badge
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
          border: '1px solid #bbf7d0',
          whiteSpace: 'nowrap'
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
          border: '1px solid #bfdbfe',
          whiteSpace: 'nowrap'
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
        border: '1px solid #fed7aa',
        whiteSpace: 'nowrap'
      }}>
        <AlertCircle size={12} /> Open
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '50px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : (toast.type === 'info' ? '#2563eb' : '#ea580c'),
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

      {/* Top Banner / Heading */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#fff7ed',
            color: '#ea580c',
            padding: '9px',
            borderRadius: '10px',
            border: '1px solid #fed7aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Flag size={24} color="#ea580c" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
              Rural Immersion Orange Flag Management
            </h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Centralized monitoring for non-critical incidents (minor injuries, discomfort, health concerns) and follow-up trails.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchOrangeFlags}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-600' : ''} />
            Refresh
          </button>

          <button
            onClick={handleDownloadExcel}
            disabled={downloading || orangeFlags.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#ea580c',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: (downloading || orangeFlags.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (downloading || orangeFlags.length === 0) ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
            }}
          >
            <FileSpreadsheet size={15} />
            {downloading ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Total Incidents
          </span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {stats.total || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '600' }}>
            Across all RI cohorts
          </span>
        </div>

        <div style={{
          backgroundColor: '#fffdfa',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #fed7aa',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#c2410c', letterSpacing: '0.5px' }}>
            Open Incidents
          </span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#ea580c', marginTop: '4px' }}>
            {stats.open || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Pending review or follow-up
          </span>
        </div>

        <div style={{
          backgroundColor: '#fbfdff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #bfdbfe',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#1d4ed8', letterSpacing: '0.5px' }}>
            Under Follow-up
          </span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '4px' }}>
            {stats.under_follow_up || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Active faculty monitoring
          </span>
        </div>

        <div style={{
          backgroundColor: '#fbfdfb',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #bbf7d0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.5px' }}>
            Resolved
          </span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>
            {stats.resolved || 0}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Addressed & closed
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '14px 16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Search Input */}
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
            placeholder="Search student, PRN, email, panel, description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '13px',
              color: '#0f172a',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Batch Filter */}
        <select
          value={selectedBatch}
          onChange={(e) => setSelectedBatch(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Batches</option>
          {batches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Panel Filter */}
        <select
          value={selectedPanel}
          onChange={(e) => setSelectedPanel(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="all">All Panels</option>
          {panels.map(p => (
            <option key={p.id} value={p.id}>{p.name || `Panel ${p.panel_number}`}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
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

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
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
      </div>

      {/* Table view */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin text-orange-600" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Loading orange flag incidents...</p>
          </div>
        ) : orangeFlags.length === 0 ? (
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
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              There are no non-critical incidents matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th style={{ padding: '12px 16px' }}>Panel & Batch</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Incident Description</th>
                  <th style={{ padding: '12px 16px' }}>Reported By</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orangeFlags.map((flag) => (
                  <tr
                    key={flag.id}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}
                    className="hover:bg-orange-50/20"
                  >
                    {/* Student */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>
                        {flag.student_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        PRN: {flag.student_prn || 'N/A'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {flag.department || flag.school || ''}
                      </div>
                    </td>

                    {/* Panel & Batch */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '600', color: '#334155' }}>
                        {flag.panel_name || 'N/A'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {flag.batch_name || 'N/A'}
                      </div>
                      {flag.village_name && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={10} /> {flag.village_name}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      {getCategoryBadge(flag.category)}
                    </td>

                    {/* Description & Date */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '300px' }}>
                      <div style={{ color: '#1e293b', fontWeight: '500', lineHeight: '1.4', marginBottom: '4px' }}>
                        {flag.description}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} color="#94a3b8" />
                        {flag.incident_date_time ? new Date(flag.incident_date_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                      </div>
                      {flag.action_taken && (
                        <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                          <em>Action: {flag.action_taken}</em>
                        </div>
                      )}
                      {flag.history_count > 0 && (
                        <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', marginTop: '3px' }}>
                          {flag.history_count} follow-up note(s)
                        </div>
                      )}
                      {flag.medical_report_url && (
                        <div style={{ marginTop: '4px' }}>
                          <a
                            href={resolveFileUrl(flag.medical_report_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              textDecoration: 'none'
                            }}
                            title={flag.medical_report_name || 'Medical report attachment'}
                          >
                            <Paperclip size={11} /> Medical Doc
                          </a>
                        </div>
                      )}
                    </td>

                    {/* Reported By */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: '600', color: '#334155' }}>
                        {flag.faculty_name || 'Faculty'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {flag.faculty_email || ''}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                      {getStatusBadge(flag.status)}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenDetails(flag)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                        className="hover:border-orange-500 hover:text-orange-600"
                      >
                        <Eye size={13} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DETAIL & MANAGEMENT MODAL ── */}
      {selectedFlag && (
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
            maxWidth: '720px',
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
                      Incident #{selectedFlag.id} - {selectedFlag.student_name}
                    </h3>
                    {getStatusBadge(selectedFlag.status)}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    PRN: {selectedFlag.student_prn || 'N/A'} • {selectedFlag.panel_name || 'Panel'} • {selectedFlag.batch_name || 'Batch'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFlag(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Summary Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {getCategoryBadge(selectedFlag.category)}
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Incident Time: {selectedFlag.incident_date_time ? new Date(selectedFlag.incident_date_time).toLocaleString('en-IN') : 'N/A'}
                  </span>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: '#1e293b', fontWeight: '500', lineHeight: '1.45' }}>
                  {selectedFlag.description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '12px', color: '#475569' }}>
                  <div><strong>Student Phone:</strong> {selectedFlag.student_phone || 'N/A'}</div>
                  <div><strong>Student Email:</strong> {selectedFlag.student_email || 'N/A'}</div>
                  <div><strong>Immediate Action:</strong> {selectedFlag.action_taken || 'None recorded'}</div>
                  <div><strong>Reported By:</strong> {selectedFlag.faculty_name} ({selectedFlag.faculty_email || 'N/A'})</div>
                  <div><strong>Village:</strong> {selectedFlag.village_name || 'N/A'}</div>
                  <div><strong>Follow-up Required:</strong> {selectedFlag.follow_up_required ? 'Yes' : 'No'}</div>
                  {selectedFlag.resolution_notes && (
                    <div style={{ gridColumn: '1 / -1', background: '#ecfdf5', padding: '8px 12px', borderRadius: '6px', border: '1px solid #a7f3d0', color: '#065f46' }}>
                      <strong>Resolution Notes:</strong> {selectedFlag.resolution_notes} (Resolved by {selectedFlag.resolved_by_name || 'Admin'} on {selectedFlag.resolved_at ? new Date(selectedFlag.resolved_at).toLocaleString('en-IN') : ''})
                    </div>
                  )}
                </div>

                {selectedFlag.medical_report_url && (
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
                          {selectedFlag.medical_report_name || 'Prescription / Medical Report'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#60a5fa' }}>
                          {selectedFlag.medical_report_size
                            ? `${(selectedFlag.medical_report_size / 1024).toFixed(1)} KB • Attached document`
                            : 'Attached document'}
                        </div>
                      </div>
                    </div>
                    <a
                      href={resolveFileUrl(selectedFlag.medical_report_url)}
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

              {/* History Timeline */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '750', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={15} color="#ea580c" />
                  Follow-up Notes & Status Trail ({flagHistory.length})
                </h4>

                {loadingHistory ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                    <RefreshCw size={16} className="animate-spin text-orange-600" />
                  </div>
                ) : flagHistory.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>No history records found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
                            {h.user_name || 'User'} <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>({h.user_role || 'staff'})</span>
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#334155' }}>
                          {h.notes}
                        </p>
                        {h.new_status && h.previous_status && h.new_status !== h.previous_status && (
                          <div style={{ marginTop: '3px', fontSize: '11px', color: '#ea580c', fontWeight: '600' }}>
                            Status transition: {h.previous_status} → {h.new_status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Administrative Action Form (if not read-only) */}
              {!isReadOnly && (
                <form onSubmit={handleSaveManagement} style={{
                  background: '#fffdfa',
                  border: '1px solid #fed7aa',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '750', color: '#9a3412' }}>
                    Update Incident Status / Add Administration Note
                  </span>

                  <textarea
                    rows={2}
                    placeholder="Enter review notes, follow-up progress, or resolution instructions..."
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                        Change Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
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
                        <option value="open">Open (Requires Attention)</option>
                        <option value="under_follow_up">Under Follow-up (Monitoring)</option>
                        <option value="resolved">Resolved (Close Incident)</option>
                      </select>
                    </div>

                    {editStatus === 'resolved' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#15803d', marginBottom: '4px' }}>
                          Resolution Summary Notes
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Student recovered, attended evening debriefing"
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
                      disabled={updating}
                      style={{
                        padding: '7px 18px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#ea580c',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: updating ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {updating ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                      {updating ? 'Saving...' : 'Save Updates'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
