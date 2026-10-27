import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  HeartPulse,
  ShieldAlert,
  HelpCircle,
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
  FileSpreadsheet
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function RiRedFlagsModule({ token, userRole = '' }) {
  const [redFlags, setRedFlags] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    medical: 0,
    disciplinary: 0,
    others: 0,
    active: 0,
    reviewed: 0,
    resolved: 0
  });
  const [batches, setBatches] = useState([]);
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedPanel, setSelectedPanel] = useState('all');
  const [selectedReason, setSelectedReason] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Selected Flag for Modal
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [editStatus, setEditStatus] = useState('active');
  const [editNotes, setEditNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  const activeToken = token || localStorage.getItem('ri_token') || localStorage.getItem('token');
  const isReadOnly = (userRole || '').toLowerCase().includes('readonly');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchRedFlags = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBatch !== 'all') params.append('batch_id', selectedBatch);
      if (selectedPanel !== 'all') params.append('panel_id', selectedPanel);
      if (selectedReason !== 'all') params.append('reason', selectedReason);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`${API}/api/ri/red-flags/admin/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setRedFlags(data.redFlags || []);
        if (data.stats) setStats(data.stats);
        if (data.batches) setBatches(data.batches);
        if (data.panels) setPanels(data.panels);
      } else {
        showToast('Failed to fetch red flags.', 'error');
      }
    } catch (err) {
      console.error('Error fetching red flags:', err);
      showToast('Server error loading red flag list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedFlags();
  }, [selectedBatch, selectedPanel, selectedReason, selectedStatus]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRedFlags();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBatch !== 'all') params.append('batch_id', selectedBatch);
      if (selectedPanel !== 'all') params.append('panel_id', selectedPanel);
      if (selectedReason !== 'all') params.append('reason', selectedReason);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`${API}/api/ri/red-flags/admin/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `RI_Red_Flags_Report_${dateStr}.xlsx`;
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

  const openFlagModal = (flag) => {
    setSelectedFlag(flag);
    setEditStatus(flag.status || 'active');
    setEditNotes(flag.admin_notes || '');
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedFlag) return;
    if (isReadOnly) {
      showToast('Read-only super admins cannot modify red flags.', 'error');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`${API}/api/ri/red-flags/admin/${selectedFlag.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          status: editStatus,
          admin_notes: editNotes
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Red flag status updated to ${editStatus}.`, 'success');
        setSelectedFlag(null);
        fetchRedFlags();
      } else {
        showToast(data.message || 'Failed to update red flag status.', 'error');
      }
    } catch (err) {
      console.error('Update status error:', err);
      showToast('Server error updating status.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const getReasonConfig = (rName) => {
    switch ((rName || '').toLowerCase()) {
      case 'medical':
        return {
          label: 'Medical',
          icon: HeartPulse,
          color: '#e11d48',
          bgColor: '#ffe4e6',
          borderColor: '#fecdd3'
        };
      case 'disciplinary':
      case 'discipline':
      case 'badmashi':
        return {
          label: 'Disciplinary',
          icon: ShieldAlert,
          color: '#d97706',
          bgColor: '#fef3c7',
          borderColor: '#fde68a'
        };
      default:
        return {
          label: 'Others',
          icon: HelpCircle,
          color: '#4f46e5',
          bgColor: '#e0e7ff',
          borderColor: '#c7d2fe'
        };
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'active').toLowerCase();
    if (s === 'resolved') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0'
        }}>
          <CheckCircle2 size={12} /> Resolved
        </span>
      );
    }
    if (s === 'reviewed') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe'
        }}>
          <Clock size={12} /> Under Review
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
        fontSize: '12px',
        fontWeight: '600',
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca'
      }}>
        <AlertTriangle size={12} /> Active
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#059669',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: '500',
          fontSize: '14px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}

      {/* Scoped CSS for responsive 2-column mobile stat grid */}
      <style>{`
        .ri-flags-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 20px;
        }
        @media (min-width: 640px) {
          .ri-flags-stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
        }
        @media (min-width: 1024px) {
          .ri-flags-stat-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 14px;
          }
        }
        .ri-action-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
      `}</style>

      {/* Top Action Header */}
      <div className="ri-action-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626'
          }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Red Flag Alerts
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadExcel}
            disabled={downloading || redFlags.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#047857',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: (downloading || redFlags.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (downloading || redFlags.length === 0) ? 0.6 : 1,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={15} />
            {downloading ? 'Exporting...' : 'Download Excel'}
          </button>

          <button
            onClick={fetchRedFlags}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Overview page card style with bottom-right dot halftone pattern) */}
      <div className="ri-flags-stat-grid">
        {/* Total */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(4,120,87,0.15)', boxShadow: '0 2px 6px -1px rgba(4,120,87,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={14} color="#047857" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '6px', zIndex: 2 }}>
            {stats.total || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(4,120,87,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(4,120,87,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Active */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #fecdd3',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Active</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(225,29,72,0.18)', boxShadow: '0 2px 6px -1px rgba(225,29,72,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={14} color="#e11d48" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#e11d48', marginTop: '6px', zIndex: 2 }}>
            {stats.active || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(225,29,72,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(225,29,72,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Medical */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Medical</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(225,29,72,0.18)', boxShadow: '0 2px 6px -1px rgba(225,29,72,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HeartPulse size={14} color="#e11d48" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#e11d48', marginTop: '6px', zIndex: 2 }}>
            {stats.medical || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(225,29,72,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(225,29,72,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Disciplinary */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Disciplinary</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(217,119,6,0.18)', boxShadow: '0 2px 6px -1px rgba(217,119,6,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={14} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#d97706', marginTop: '6px', zIndex: 2 }}>
            {stats.disciplinary || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(217,119,6,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(217,119,6,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Others */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Others</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(79,70,229,0.18)', boxShadow: '0 2px 6px -1px rgba(79,70,229,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={14} color="#4f46e5" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#4f46e5', marginTop: '6px', zIndex: 2 }}>
            {stats.others || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(79,70,229,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(79,70,229,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Resolved */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '12px 14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '82px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Resolved</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(22,163,74,0.18)', boxShadow: '0 2px 6px -1px rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={14} color="#16a34a" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#16a34a', marginTop: '6px', zIndex: 2 }}>
            {stats.resolved || 0}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(22,163,74,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(22,163,74,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
      }}>
        
        {/* Filters & Search Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by student name, PRN, email, or faculty..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {/* Batch Filter */}
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              style={{
                padding: '9px 12px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                outline: 'none'
              }}
            >
              <option value="all">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name || b.batch_code}</option>
              ))}
            </select>

            {/* Panel Filter */}
            <select
              value={selectedPanel}
              onChange={e => setSelectedPanel(e.target.value)}
              style={{
                padding: '9px 12px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                outline: 'none'
              }}
            >
              <option value="all">All Panels</option>
              {panels.map(p => (
                <option key={p.id} value={p.id}>{p.name || `Panel ${p.panel_number}`}</option>
              ))}
            </select>

            {/* Reason Filter */}
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              style={{
                padding: '9px 12px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                outline: 'none'
              }}
            >
              <option value="all">All Categories</option>
              <option value="Medical">Medical</option>
              <option value="Disciplinary">Disciplinary</option>
              <option value="Others">Others</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{
                padding: '9px 12px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                background: '#ffffff',
                outline: 'none'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="reviewed">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Loading red flag records...</div>
          </div>
        ) : redFlags.length === 0 ? (
          <div style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: '#f8fafc',
            border: '1px dashed #e2e8f0',
            borderRadius: '12px',
            color: '#64748b'
          }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>No Red Flags Found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              No student red flags match the current filters or query.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                  <th style={{ padding: '12px 14px' }}>Student Info</th>
                  <th style={{ padding: '12px 14px' }}>Panel & Batch</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Problem / Incident</th>
                  <th style={{ padding: '12px 14px' }}>Raised By (Faculty)</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {redFlags.map(rf => {
                  const rConfig = getReasonConfig(rf.reason);
                  const Icon = rConfig.icon;

                  return (
                    <tr
                      key={rf.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Student Info */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{rf.student_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          PRN: {rf.student_prn || 'N/A'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{rf.student_email || ''}</div>
                      </td>

                      {/* Panel & Batch */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: '600', color: '#334155' }}>{rf.panel_name || 'Panel'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{rf.batch_name || 'Batch'}</div>
                        {rf.village_name && (
                          <div style={{ fontSize: '11px', color: '#059669', fontWeight: '500' }}>
                            Village: {rf.village_name}
                          </div>
                        )}
                      </td>

                      {/* Reason Badge */}
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: rConfig.bgColor,
                          color: rConfig.color,
                          border: `1px solid ${rConfig.borderColor}`
                        }}>
                          <Icon size={12} /> {rConfig.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td style={{ padding: '14px', maxWidth: '300px' }}>
                        <div style={{
                          color: '#334155',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: '1.4'
                        }}>
                          {rf.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                          {rf.created_at ? new Date(rf.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* Raised By */}
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{rf.faculty_name || 'Faculty'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{rf.faculty_email || ''}</div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px' }}>
                        {getStatusBadge(rf.status)}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button
                          onClick={() => openFlagModal(rf)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#0f172a',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                        >
                          <Eye size={13} /> View & Action
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: VIEW & MANAGE RED FLAG ── */}
      {selectedFlag && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Student Red Flag #{selectedFlag.id}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Reported on {new Date(selectedFlag.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedFlag(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Student Metadata Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedFlag.student_name}
                  </div>
                  {getStatusBadge(selectedFlag.status)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#334155' }}>
                  <div><strong>PRN:</strong> {selectedFlag.student_prn || 'N/A'}</div>
                  <div><strong>Email:</strong> {selectedFlag.student_email || 'N/A'}</div>
                  <div><strong>Phone:</strong> {selectedFlag.student_phone || 'N/A'}</div>
                  <div><strong>Batch:</strong> {selectedFlag.batch_name || 'N/A'}</div>
                  <div><strong>Panel:</strong> {selectedFlag.panel_name || 'N/A'}</div>
                  <div><strong>Village:</strong> {selectedFlag.village_name || 'N/A'}</div>
                  <div><strong>Department:</strong> {selectedFlag.department || 'N/A'}</div>
                  <div><strong>School:</strong> {selectedFlag.school || 'N/A'}</div>
                </div>
              </div>

              {/* Red Flag Reason & Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Reason Category
                </label>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#ffe4e6',
                    color: '#e11d48',
                    border: '1px solid #fecdd3'
                  }}>
                    <HeartPulse size={14} /> {selectedFlag.reason}
                  </span>
                </div>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Faculty Description & Incident Details
                </label>
                <div style={{
                  padding: '14px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#1e293b',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedFlag.description}
                </div>
              </div>

              {/* Faculty Info Box */}
              <div style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <strong>Reported By:</strong> {selectedFlag.faculty_name} ({selectedFlag.faculty_email || 'N/A'})
                </div>
                <div>
                  <strong>Date:</strong> {new Date(selectedFlag.created_at).toLocaleString('en-IN')}
                </div>
              </div>

              {/* Admin Action Form */}
              <form onSubmit={handleUpdateStatus} style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Administrative Review & Actions
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { id: 'active', label: 'Active', color: '#e11d48' },
                    { id: 'reviewed', label: 'Under Review', color: '#1d4ed8' },
                    { id: 'resolved', label: 'Mark Resolved', color: '#15803d' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setEditStatus(st.id)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: editStatus === st.id ? `2px solid ${st.color}` : '1px solid #cbd5e1',
                        background: editStatus === st.id ? '#f8fafc' : '#ffffff',
                        color: editStatus === st.id ? st.color : '#64748b',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: isReadOnly ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Admin Notes / Action Taken
                  </label>
                  <textarea
                    rows={3}
                    disabled={isReadOnly}
                    placeholder="Enter notes on actions taken (e.g. contacted student, medical team deployed, mentor briefed)..."
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {isReadOnly && (
                  <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '8px', borderRadius: '6px' }}>
                    🔒 You have read-only permissions and cannot update red flag records.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedFlag(null)}
                    style={{
                      padding: '8px 16px',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  {!isReadOnly && (
                    <button
                      type="submit"
                      disabled={updating}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        background: '#047857',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: updating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {updating ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                      Save Updates
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
