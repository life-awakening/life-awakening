import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Search,
  X,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Check,
  Send,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building,
  Users,
  ArrowRight,
  LifeBuoy
} from 'lucide-react';

const QUICK_REPLY_TEMPLATES = [
  'Your issue has been verified and resolved by the Rural Immersion administration. Thank you for your patience.',
  'We have reviewed and updated your RI panel / village records accordingly.',
  'The details have been updated. Please refresh your RI dashboard to view the changes.',
  'Your attendance record has been reviewed and corrected.',
  'Thank you for reporting this. Necessary corrections have been applied by the RI Team.',
  'Please log out and log back in to see the updated changes on your portal.'
];

// Helper to format timestamps with date, time, and relative indicators
export const formatTimestamp = (val) => {
  if (!val) return { dateStr: '—', timeStr: '', full: '—', relative: '' };
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '', full: '—', relative: '' };

    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays < 7) relative = `${diffDays}d ago`;

    return {
      dateStr,
      timeStr,
      full: `${dateStr}, ${timeStr}`,
      relative,
      iso: d.toISOString()
    };
  } catch {
    return { dateStr: '—', timeStr: '', full: '—', relative: '' };
  }
};

function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const maxWidth = size === 'xl' ? '820px' : size === 'lg' ? '640px' : '480px';

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          maxWidth,
          width: '100%',
          maxHeight: '90vh',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            flexShrink: 0
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              border: '1px solid #cbd5e1',
              padding: '5px',
              background: '#ffffff',
              color: '#64748b',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, wordBreak: 'break-word' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function RiTicketsModule({
  token,
  apiBase,
  isReadonly = false,
  onTicketCountChange,
  onNavigateTab,
  activeRedFlagCount: propActiveRedFlagCount
}) {
  const activeApiBase = apiBase || import.meta.env.VITE_API_URL || 'http://localhost:5001';

  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0 });
  const [internalRedFlagCount, setInternalRedFlagCount] = useState(propActiveRedFlagCount || 0);

  useEffect(() => {
    if (propActiveRedFlagCount !== undefined) {
      setInternalRedFlagCount(propActiveRedFlagCount);
    }
  }, [propActiveRedFlagCount]);

  useEffect(() => {
    if (propActiveRedFlagCount === undefined && token) {
      fetch(`${activeApiBase}/api/ri/red-flags/admin/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const active = data.stats?.active ?? (data.redFlags || []).filter(f => f.status === 'active').length ?? 0;
            setInternalRedFlagCount(active);
          }
        })
        .catch(() => {});
    }
  }, [activeApiBase, token, propActiveRedFlagCount]);

  const activeRedFlagCount = propActiveRedFlagCount !== undefined ? propActiveRedFlagCount : internalRedFlagCount;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Modals
  const [viewingTicket, setViewingTicket] = useState(null);
  const [viewingScreenshot, setViewingScreenshot] = useState(null);
  const [ticketToResolve, setTicketToResolve] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchTickets = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      if (isSilent) setRefreshing(true);

      const res = await fetch(`${activeApiBase}/api/ri/support/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.tickets || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setTickets(sorted);
        if (data.stats) {
          setStats(data.stats);
        }
        if (onTicketCountChange) {
          onTicketCountChange(data.stats?.pending || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch RI tickets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeApiBase, token, onTicketCountChange]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterStatus, filterRole, filterCategory]);

  const handleMarkInProgress = async (ticketId, e) => {
    e?.stopPropagation();
    if (isReadonly) return alert('Read-only access: modifications are disabled.');
    setSubmitting(true);
    try {
      const res = await fetch(`${activeApiBase}/api/ri/support/admin/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in_progress' })
      });
      if (res.ok) {
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'in_progress' } : t));
        if (viewingTicket?.id === ticketId) {
          setViewingTicket(prev => prev ? { ...prev, status: 'in_progress' } : null);
        }
        fetchTickets(true);
      } else {
        const d = await res.json();
        alert(d.message || 'Failed to update status.');
      }
    } catch {
      alert('Network error updating status.');
    } finally {
      setSubmitting(false);
    }
  };

  const openResolveModal = (ticket, e) => {
    e?.stopPropagation();
    setTicketToResolve(ticket);
    setResolveNote(ticket.resolution || '');
  };

  const handleConfirmResolve = async () => {
    if (!ticketToResolve) return;
    if (isReadonly) return alert('Read-only access: modifications are disabled.');
    const note = resolveNote.trim();
    if (!note) return alert('Please enter a resolution note before resolving.');

    setSubmitting(true);
    try {
      const res = await fetch(`${activeApiBase}/api/ri/support/admin/tickets/${ticketToResolve.id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolution: note })
      });
      if (res.ok) {
        const data = await res.json();
        const resolvedAt = data.resolved_at || new Date().toISOString();
        const resolvedByName = data.resolved_by_name || 'RI Admin';

        setTickets(prev => prev.map(t =>
          t.id === ticketToResolve.id
            ? { ...t, status: 'resolved', resolution: note, resolved_by_name: resolvedByName, resolved_at: resolvedAt }
            : t
        ));

        if (viewingTicket?.id === ticketToResolve.id) {
          setViewingTicket(prev => prev ? {
            ...prev,
            status: 'resolved',
            resolution: note,
            resolved_by_name: resolvedByName,
            resolved_at: resolvedAt
          } : null);
        }

        setTicketToResolve(null);
        setResolveNote('');
        fetchTickets(true);
      } else {
        const d = await res.json();
        alert(d.message || 'Failed to resolve ticket.');
      }
    } catch {
      alert('Network error resolving ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const categoriesList = useMemo(() => {
    const set = new Set();
    tickets.forEach(item => { if (item.category) set.add(item.category); });
    return Array.from(set);
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(item => {
      const matchStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchRole = filterRole === 'all' || (item.user_role || '').toLowerCase() === filterRole.toLowerCase();
      const matchCategory = filterCategory === 'all' || (item.category || '').toLowerCase() === filterCategory.toLowerCase();

      const q = searchText.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(item.id).includes(q) ||
        `ri-${item.id}`.includes(q) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.user_name && item.user_name.toLowerCase().includes(q)) ||
        (item.user_email && item.user_email.toLowerCase().includes(q)) ||
        (item.user_prn && item.user_prn.toLowerCase().includes(q)) ||
        (item.batch_name && item.batch_name.toLowerCase().includes(q)) ||
        (item.panel_name && item.panel_name.toLowerCase().includes(q)) ||
        (item.resolution && item.resolution.toLowerCase().includes(q));

      return matchStatus && matchRole && matchCategory && matchSearch;
    });
  }, [tickets, filterStatus, filterRole, filterCategory, searchText]);

  // Pagination
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTickets, startIndex]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Scoped CSS for responsive layout, filters, and cards */}
      <style>{`
        .ri-tickets-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        @media (min-width: 768px) {
          .ri-tickets-stat-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
          }
        }
        .ri-filter-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        @media (min-width: 992px) {
          .ri-filter-card {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
        }
        .ri-filter-left-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }
        @media (min-width: 640px) {
          .ri-filter-left-group {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
            gap: 10px;
          }
        }
        .ri-search-wrap {
          position: relative;
          width: 100%;
        }
        @media (min-width: 640px) {
          .ri-search-wrap {
            flex: 1;
            min-width: 200px;
            max-width: 280px;
          }
        }
        .ri-dropdown-group {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 640px) {
          .ri-dropdown-group {
            display: flex;
            align-items: center;
            gap: 8px;
            width: auto;
          }
        }
        .ri-filter-select {
          height: 38px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 12.5px;
          font-weight: 500;
          background-color: #ffffff;
          color: #334155;
          outline: none;
          cursor: pointer;
          padding: 0 10px;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          width: 100%;
        }
        .ri-filter-select:focus {
          border-color: #047857;
          box-shadow: 0 0 0 2px rgba(4,120,87,0.1);
        }
        @media (min-width: 640px) {
          .ri-filter-select.status-select { width: 130px; }
          .ri-filter-select.role-select { width: 120px; }
          .ri-filter-select.category-select { width: 150px; }
        }
        .ri-filter-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 992px) {
          .ri-filter-actions {
            width: auto;
            flex-shrink: 0;
          }
        }
        .ri-ticket-item {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          background-color: #ffffff;
          cursor: pointer;
          transition: background-color 0.15s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ri-ticket-item:last-child {
          border-bottom: none;
        }
        .ri-ticket-item:hover {
          background-color: #f8fafc;
        }
        .ri-ticket-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (min-width: 768px) {
          .ri-ticket-body {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }
        .ri-ticket-user-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 12px;
          flex-shrink: 0;
        }
        @media (min-width: 768px) {
          .ri-ticket-user-box {
            background: transparent;
            border: none;
            padding: 0;
            text-align: right;
            align-items: flex-end;
          }
        }
      `}</style>

      {/* Sub-header Tabs & Red Flags Bridge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '-4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#047857',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'default',
              boxShadow: '0 2px 4px rgba(4,120,87,0.18)'
            }}
          >
            <MessageSquare size={14} />
            <span>Support Tickets</span>
            <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>
              {stats.total || tickets.length}
            </span>
          </button>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('redflags')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                backgroundColor: '#ffffff',
                color: '#be123c',
                border: '1.5px solid #fecdd3',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff1f2'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              title="View student disciplinary, medical, and attendance issues reported by faculty"
            >
              <AlertTriangle size={14} style={{ color: '#e11d48' }} />
              <span>Student Red Flags</span>
              {activeRedFlagCount > 0 && (
                <span style={{ backgroundColor: '#ffe4e6', color: '#be123c', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>
                  {activeRedFlagCount}
                </span>
              )}
            </button>
          )}
        </div>

        {activeRedFlagCount > 0 && onNavigateTab && (
          <div
            onClick={() => onNavigateTab('redflags')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#9f1239',
              fontWeight: '600',
              transition: 'background-color 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ffe4e6'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff1f2'}
          >
            <AlertTriangle size={13} style={{ color: '#e11d48', flexShrink: 0 }} />
            <span><strong>{activeRedFlagCount}</strong> faculty red flag{activeRedFlagCount !== 1 ? 's' : ''} reported</span>
            <ArrowRight size={12} style={{ color: '#e11d48' }} />
          </div>
        )}
      </div>

      {/* Top Metric Summary Bar (Overview page card style with bottom-right dot halftone pattern) */}
      <div className="ri-tickets-stat-grid">
        {/* Total */}
        <div
          onClick={() => setFilterStatus('all')}
          style={{
            background: '#ffffff',
            border: filterStatus === 'all' ? '1.5px solid #047857' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '82px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: filterStatus === 'all' ? '0 4px 12px rgba(4,120,87,0.1)' : '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: filterStatus === 'all' ? '#047857' : '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(4,120,87,0.15)', boxShadow: '0 2px 6px -1px rgba(4,120,87,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={14} color="#047857" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '6px', zIndex: 2 }}>
            {stats.total || tickets.length}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(4,120,87,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(4,120,87,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Pending */}
        <div
          onClick={() => setFilterStatus('pending')}
          style={{
            background: '#ffffff',
            border: filterStatus === 'pending' ? '1.5px solid #d97706' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '82px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: filterStatus === 'pending' ? '0 4px 12px rgba(217,119,6,0.1)' : '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(217,119,6,0.18)', boxShadow: '0 2px 6px -1px rgba(217,119,6,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={14} color="#b45309" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#b45309', marginTop: '6px', zIndex: 2 }}>
            {stats.pending || tickets.filter(t => t.status === 'pending').length}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(217,119,6,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(217,119,6,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => setFilterStatus('in_progress')}
          style={{
            background: '#ffffff',
            border: filterStatus === 'in_progress' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '82px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: filterStatus === 'in_progress' ? '0 4px 12px rgba(37,99,235,0.1)' : '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>In Progress</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(37,99,235,0.18)', boxShadow: '0 2px 6px -1px rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={14} color="#1d4ed8" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#1d4ed8', marginTop: '6px', zIndex: 2 }}>
            {stats.in_progress || tickets.filter(t => t.status === 'in_progress').length}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(37,99,235,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(37,99,235,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => setFilterStatus('resolved')}
          style={{
            background: '#ffffff',
            border: filterStatus === 'resolved' ? '1.5px solid #059669' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '82px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: filterStatus === 'resolved' ? '0 4px 12px rgba(5,150,105,0.1)' : '0 2px 6px rgba(0,0,0,0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Resolved</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ffffff', border: '1px solid rgba(5,150,105,0.18)', boxShadow: '0 2px 6px -1px rgba(5,150,105,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={14} color="#047857" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#047857', marginTop: '6px', zIndex: 2 }}>
            {stats.resolved || tickets.filter(t => t.status === 'resolved').length}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '65px', height: '50px', background: 'radial-gradient(circle at bottom right, rgba(5,150,105,0.07), transparent 70%)', pointerEvents: 'none', zIndex: 1 }}>
            <div style={{ width: '100%', height: '100%', backgroundImage: 'radial-gradient(rgba(5,150,105,0.18) 1.5px, transparent 1.5px)', backgroundSize: '7px 7px', WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
          </div>
        </div>
      </div>

      {/* Main Filter & Search Control Panel */}
      <div className="ri-filter-card">
        <div className="ri-filter-left-group">
          {/* Search Box */}
          <div className="ri-search-wrap">
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search ID, student, PRN, batch..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 30px 0 32px',
                fontSize: '13px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                backgroundColor: '#f8fafc',
                boxSizing: 'border-box'
              }}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="ri-dropdown-group">
            {/* Status Dropdown */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="ri-filter-select status-select"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* User Role Dropdown */}
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="ri-filter-select role-select"
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="faculty">Faculty</option>
            </select>

            {/* Category Dropdown */}
            {categoriesList.length > 0 && (
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="ri-filter-select category-select"
              >
                <option value="all">All Categories</option>
                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Right Actions: Clear Filters & Refresh */}
        <div className="ri-filter-actions">
          {(filterStatus !== 'all' || filterRole !== 'all' || filterCategory !== 'all' || searchText) && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterRole('all');
                setFilterCategory('all');
                setSearchText('');
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                border: '1px solid #e2e8f0',
                background: '#f1f5f9',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}
            >
              Clear
            </button>
          )}

          <button
            onClick={() => fetchTickets()}
            disabled={refreshing}
            style={{
              height: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} style={{ color: '#047857' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Ticket List View */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px auto' }} />
            <span style={{ fontSize: '13.5px' }}>Loading support tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <MessageSquare size={36} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#475569', margin: '0 0 4px 0' }}>No support tickets found</h4>
            <p style={{ fontSize: '13px', margin: '0 0 16px 0', color: '#64748b' }}>
              {searchText || filterStatus !== 'all' || filterRole !== 'all' ? 'Try adjusting your search filters.' : 'No general support tickets raised by RI Students or Faculty yet.'}
            </p>
            {activeRedFlagCount > 0 && onNavigateTab && (
              <div style={{ maxWidth: '440px', margin: '0 auto', padding: '14px 18px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <AlertTriangle size={15} style={{ color: '#e11d48' }} />
                  <span style={{ fontSize: '13px', fontWeight: '750', color: '#9f1239' }}>
                    Looking for student issues reported by faculty?
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#be123c', lineHeight: '1.45', marginBottom: '10px' }}>
                  Faculty mentors report student medical, disciplinary, and attendance concerns as <strong>Student Red Flags</strong>. There are currently <strong>{activeRedFlagCount}</strong> active report(s).
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('redflags')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>Go to Student Red Flags ({activeRedFlagCount})</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            {paginatedTickets.map((t) => {
              const isResolved = t.status === 'resolved';
              const isInProgress = t.status === 'in_progress';
              const timeMeta = formatTimestamp(t.created_at);
              const isStudent = (t.user_role || '').toLowerCase() === 'student';

              return (
                <div
                  key={t.id}
                  onClick={() => setViewingTicket(t)}
                  className="ri-ticket-item"
                >
                  {/* Top Row: Meta Badges & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Ticket ID Tag - Clean Slate Neutral */}
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a', fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        #RI-{t.id}
                      </span>

                      {/* Role Tag */}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: isStudent ? '#f0f9ff' : '#fffbeb',
                        color: isStudent ? '#0369a1' : '#92400e',
                        border: isStudent ? '1px solid #bae6fd' : '1px solid #fde68a'
                      }}>
                        {isStudent ? 'Student' : 'Faculty'}
                      </span>

                      {/* Category Tag */}
                      {t.category && (
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', background: '#f8fafc', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          {t.category}
                        </span>
                      )}

                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {timeMeta.full} ({timeMeta.relative})
                      </span>
                    </div>

                    <div>
                      {/* Status Badge */}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        backgroundColor: isResolved ? '#f0fdf4' : isInProgress ? '#eff6ff' : '#fffbeb',
                        color: isResolved ? '#15803d' : isInProgress ? '#1d4ed8' : '#b45309',
                        border: isResolved ? '1px solid #bbf7d0' : isInProgress ? '1px solid #bfdbfe' : '1px solid #fde68a'
                      }}>
                        {isResolved ? 'Resolved' : isInProgress ? 'In Progress' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Middle Area: Subject, Description & User Info */}
                  <div className="ri-ticket-body">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>
                        {t.subject}
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.45', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.description}
                      </div>
                    </div>

                    {/* User Metadata */}
                    <div className="ri-ticket-user-box">
                      <strong style={{ color: '#0f172a', fontSize: '12px' }}>{t.user_name || '—'}</strong>
                      <span style={{ color: '#64748b', fontSize: '11.5px' }}>{t.user_email || '—'}</span>
                      {(t.user_prn || t.batch_name || t.panel_name) && (
                        <span style={{ color: '#334155', fontWeight: '600', fontSize: '11px', marginTop: '1px' }}>
                          {t.user_prn ? `PRN: ${t.user_prn} • ` : ''}{t.batch_name || ''} {t.panel_name ? `(${t.panel_name})` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Actions & Resolution Preview (Subtle neutral buttons, not bright green) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {t.screenshot && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingScreenshot(t.screenshot);
                          }}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '11.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <ImageIcon size={13} color="#475569" />
                          <span>View Screenshot</span>
                        </button>
                      )}

                      {isResolved && (
                        <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={13} color="#15803d" />
                          Resolved by {t.resolved_by_name || 'Admin'}
                        </span>
                      )}
                    </div>

                    {!isReadonly && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {!isResolved && !isInProgress && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkInProgress(t.id, e)}
                            disabled={submitting}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Mark In Progress
                          </button>
                        )}

                        {!isResolved ? (
                          <button
                            type="button"
                            onClick={(e) => openResolveModal(t, e)}
                            disabled={submitting}
                            style={{
                              padding: '5px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#0f172a',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            <Check size={13} />
                            <span>Resolve</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => openResolveModal(t, e)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Edit Resolution
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing <strong>{startIndex + 1}</strong> - <strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredTickets.length)}</strong> of <strong>{filteredTickets.length}</strong> tickets
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={validCurrentPage === 1}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: validCurrentPage === 1 ? '#cbd5e1' : '#334155', cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', padding: '0 8px' }}>
                Page {validCurrentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage === totalPages}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: validCurrentPage === totalPages ? '#cbd5e1' : '#334155', cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details View Modal */}
      {viewingTicket && (
        <Modal
          open={Boolean(viewingTicket)}
          onClose={() => setViewingTicket(null)}
          title={`Ticket #RI-${viewingTicket.id}: ${viewingTicket.subject}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Status Strip */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Current Status: </span>
                <strong style={{
                  color: viewingTicket.status === 'resolved' ? '#15803d' : viewingTicket.status === 'in_progress' ? '#1d4ed8' : '#b45309',
                  textTransform: 'uppercase',
                  fontSize: '13px',
                  marginLeft: '4px'
                }}>
                  {viewingTicket.status}
                </strong>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Submitted: {formatTimestamp(viewingTicket.created_at).full}
              </span>
            </div>

            {/* User Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Raised By</div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{viewingTicket.user_name || '—'}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>{viewingTicket.user_email || '—'}</div>
              </div>

              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Role &amp; Context</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                  {(viewingTicket.user_role || 'Student').toUpperCase()} {viewingTicket.user_prn ? `• PRN: ${viewingTicket.user_prn}` : ''}
                </div>
                {(viewingTicket.batch_name || viewingTicket.panel_name) && (
                  <div style={{ fontSize: '12px', color: '#047857', fontWeight: '600' }}>
                    {viewingTicket.batch_name || ''} {viewingTicket.panel_name ? `• ${viewingTicket.panel_name}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                Description
              </label>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', fontSize: '13.5px', color: '#1e293b', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {viewingTicket.description}
              </div>
            </div>

            {/* Attached Screenshot */}
            {viewingTicket.screenshot && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                  Attached Screenshot
                </label>
                <div style={{ position: 'relative', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', maxHeight: '240px', background: '#0f172a' }}>
                  <img
                    src={viewingTicket.screenshot}
                    alt="Ticket attachment"
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', cursor: 'pointer' }}
                    onClick={() => setViewingScreenshot(viewingTicket.screenshot)}
                  />
                </div>
              </div>
            )}

            {/* Resolution Information */}
            {viewingTicket.status === 'resolved' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderLeft: '4px solid #16a34a', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>
                    Official Resolution Note
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>
                    Resolved on {formatTimestamp(viewingTicket.resolved_at).full} by <strong>{viewingTicket.resolved_by_name || 'Admin'}</strong>
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', color: '#14532d', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {viewingTicket.resolution}
                </div>
              </div>
            )}

            {/* Action Bar */}
            {!isReadonly && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                {viewingTicket.status !== 'resolved' && viewingTicket.status !== 'in_progress' && (
                  <button
                    onClick={() => handleMarkInProgress(viewingTicket.id)}
                    disabled={submitting}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Mark In Progress
                  </button>
                )}
                <button
                  onClick={() => openResolveModal(viewingTicket)}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} />
                  <span>{viewingTicket.status === 'resolved' ? 'Update Resolution' : 'Resolve Ticket'}</span>
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Resolve Ticket Modal */}
      {ticketToResolve && (
        <Modal
          open={Boolean(ticketToResolve)}
          onClose={() => setTicketToResolve(null)}
          title={`Resolve Ticket #RI-${ticketToResolve.id}`}
          size="lg"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13.5px', color: '#334155' }}>
              Resolving ticket for <strong>{ticketToResolve.user_name}</strong> ({ticketToResolve.user_email}).
              An automated confirmation email with your resolution notes will be dispatched to the user.
            </div>

            {/* Quick Reply Templates */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                Quick Templates
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {QUICK_REPLY_TEMPLATES.map((tmpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setResolveNote(tmpl)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: resolveNote === tmpl ? '#ecfdf5' : '#f8fafc',
                      color: resolveNote === tmpl ? '#047857' : '#475569',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: resolveNote === tmpl ? '700' : '500'
                    }}
                  >
                    {tmpl.length > 50 ? `${tmpl.slice(0, 50)}...` : tmpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Textarea */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                Resolution Note (Sent to Student / Faculty) *
              </label>
              <textarea
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
                placeholder="Explain how the issue was resolved or corrected..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setTicketToResolve(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={submitting}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#047857',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(4,120,87,0.25)'
                }}
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{submitting ? 'Saving & Notifying...' : 'Confirm Resolution'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Full Screenshot Modal */}
      {viewingScreenshot && (
        <Modal
          open={Boolean(viewingScreenshot)}
          onClose={() => setViewingScreenshot(null)}
          title="Attached Screenshot"
          size="xl"
        >
          <div style={{ textAlign: 'center' }}>
            <img
              src={viewingScreenshot}
              alt="Screenshot Full View"
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '6px' }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
