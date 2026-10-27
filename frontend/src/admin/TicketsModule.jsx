import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  MessageSquare, 
  RefreshCw, 
  Search, 
  X, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  Image as ImageIcon, 
  Check, 
  Copy, 
  Send, 
  Shield, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const QUICK_REPLY_TEMPLATES = [
  'Your ticket has been resolved. Thank you for your patience.',
  'We have reviewed and updated your records accordingly.',
  'The issue has been fixed. Please verify on your dashboard and let us know if you need further assistance.',
  'Thank you for reporting this. Necessary corrections have been applied.',
  'Please refresh your dashboard to view the updated details.',
  'Please reply if you need any further assistance.'
];

// Helper to format timestamps with date, time, and relative indicators
export const formatTimestamp = (val) => {
  if (!val) return { dateStr: '—', timeStr: '', full: '—', relative: '' }
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '', full: '—', relative: '' }

    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })

    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    let relative = ''
    if (diffMins < 1) relative = 'Just now'
    else if (diffMins < 60) relative = `${diffMins}m ago`
    else if (diffHours < 24) relative = `${diffHours}h ago`
    else if (diffDays === 1) relative = 'Yesterday'
    else if (diffDays < 7) relative = `${diffDays}d ago`

    return {
      dateStr,
      timeStr,
      full: `${dateStr}, ${timeStr}`,
      relative,
      iso: d.toISOString()
    }
  } catch {
    return { dateStr: '—', timeStr: '', full: '—', relative: '' }
  }
}

// Enterprise Modal with Responsive Mobile Sheet Layout
function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const maxWidth = size === 'xl' ? '820px' : size === 'lg' ? '640px' : '480px';

  return (
    <div 
      className="modal-overlay" 
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="modal"
        style={{ 
          maxWidth, 
          width: '100%',
          maxHeight: '90vh',
          borderRadius: '12px', 
          overflow: 'hidden', 
          border: '1px solid #cbd5e1', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {/* Modal Header */}
        <div style={{ 
          padding: '14px 18px', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: '#f8fafc',
          flexShrink: 0
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0, wordBreak: 'break-word', paddingRight: '8px' }}>
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
              justifyContent: 'center',
              flexShrink: 0
            }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body with smooth internal vertical scroll */}
        <div style={{ 
          padding: '16px 18px', 
          overflowY: 'auto', 
          flex: 1, 
          WebkitOverflowScrolling: 'touch',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

let ticketsModuleCache = null
const ticketsModuleProfileCache = new Map()

export default function TicketsModule({ token, apiBase, API, isReadonly = false }) {
  const activeApiBase = apiBase || API || ''
  const { t } = useLanguage()

  const [tickets, setTickets] = useState(() => ticketsModuleCache || [])
  const [loading, setLoading] = useState(() => !ticketsModuleCache)
  const [refreshing, setRefreshing] = useState(false)
  const [resolutionText, setResolutionText] = useState({})
  const [modalResolutionText, setModalResolutionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ticketToResolve, setTicketToResolve] = useState(null)
  const [confirmResolutionText, setConfirmResolutionText] = useState('')
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchText, setSearchText] = useState('')
  
  // Modals & Profile
  const [viewingProfile, setViewingProfile] = useState(null)
  const [viewingTicket, setViewingTicket] = useState(null)
  const [fetchingProfile, setFetchingProfile] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 8

  const fetchTickets = useCallback(async (options = {}) => {
    try {
      if (!options.silent && !ticketsModuleCache) setLoading(true)
      if (options.silent) setRefreshing(true)
      
      const res = await fetch(`${activeApiBase}/api/tickets/all`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const sorted = (data.tickets || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        setTickets(sorted)
        ticketsModuleCache = sorted
      }
    } catch {
      // Keep cached state silently
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeApiBase, token])

  useEffect(() => { 
    fetchTickets() 
  }, [fetchTickets])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, filterStatus, filterPriority, filterCategory])

  const openResolveModal = (ticket, defaultText = '') => {
    setTicketToResolve(ticket)
    setConfirmResolutionText(defaultText || resolutionText[ticket.id] || modalResolutionText || '')
  }

  const handleConfirmResolve = async () => {
    if (!ticketToResolve) return
    const resolution = confirmResolutionText.trim()
    if (!resolution) return alert('Please enter a resolution note before resolving.')
    await handleResolve(ticketToResolve.id, resolution)
  }

  const handleResolve = async (ticketId, customResolution) => {
    if (isReadonly) return alert('You have view-only access.')
    const resolution = (customResolution !== undefined ? customResolution : (resolutionText[ticketId] || '')).trim()
    if (!resolution) return alert('Please enter a resolution note before resolving.')
    
    setSubmitting(true)
    try {
      const res = await fetch(`${activeApiBase}/api/tickets/${ticketId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resolution })
      })
      if (res.ok) {
        const resolvedTimestamp = new Date().toISOString()
        setResolutionText(prev => { const n = { ...prev }; delete n[ticketId]; return n })
        setModalResolutionText('')
        setTicketToResolve(null)
        setConfirmResolutionText('')
        
        setTickets(prev => {
          const updated = prev.map(item =>
            item.id === ticketId
              ? { ...item, status: 'resolved', resolution, resolver_name: 'Admin', resolved_at: resolvedTimestamp }
              : item
          )
          ticketsModuleCache = updated
          return updated
        })

        if (viewingTicket?.id === ticketId) {
          setViewingTicket(prev => prev ? { 
            ...prev, 
            status: 'resolved', 
            resolution, 
            resolver_name: 'Admin', 
            resolved_at: resolvedTimestamp 
          } : null)
        }
        
        fetchTickets({ silent: true })
      } else {
        const d = await res.json()
        alert(d.message || 'Failed to resolve ticket.')
      }
    } catch {
      alert('Network error resolving ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewRaiser = async (userId, e) => {
    e?.stopPropagation()
    if (!userId) return
    if (ticketsModuleProfileCache.has(userId)) {
      setViewingProfile(ticketsModuleProfileCache.get(userId))
      return
    }
    setFetchingProfile(true)
    try {
      const res = await fetch(`${activeApiBase}/api/admin/users/${userId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        ticketsModuleProfileCache.set(userId, data.user)
        setViewingProfile(data.user)
      } else {
        alert('Failed to load user profile.')
      }
    } catch (e) {
      console.error(e)
      alert('Error fetching user profile.')
    } finally {
      setFetchingProfile(false)
    }
  }

  const categoriesList = useMemo(() => {
    const set = new Set()
    tickets.forEach(item => { if (item.category) set.add(item.category) })
    return Array.from(set)
  }, [tickets])

  const filtered = useMemo(() => {
    return tickets.filter(item => {
      const matchStatus = filterStatus === 'all' || item.status === filterStatus
      const matchPriority = filterPriority === 'all' || (item.priority || '').toLowerCase() === filterPriority.toLowerCase()
      const matchCategory = filterCategory === 'all' || (item.category || '').toLowerCase() === filterCategory.toLowerCase()
      
      const q = searchText.toLowerCase().trim()
      const matchSearch =
        !q ||
        String(item.id).includes(q) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.creator_name && item.creator_name.toLowerCase().includes(q)) ||
        (item.creator_email && item.creator_email.toLowerCase().includes(q)) ||
        (item.creator_prn && item.creator_prn.toLowerCase().includes(q)) ||
        (item.creator_faculty_id && item.creator_faculty_id.toLowerCase().includes(q)) ||
        (item.batch_name && item.batch_name.toLowerCase().includes(q)) ||
        (item.squad_name && item.squad_name.toLowerCase().includes(q)) ||
        (item.on_behalf_of && item.on_behalf_of.toLowerCase().includes(q)) ||
        (item.resolution && item.resolution.toLowerCase().includes(q))
      
      return matchStatus && matchPriority && matchCategory && matchSearch
    })
  }, [tickets, filterStatus, filterPriority, filterCategory, searchText])

  // Summary Metrics
  const totalCount = tickets.length
  const pendingCount = tickets.filter(item => item.status === 'pending').length
  const resolvedCount = tickets.filter(item => item.status === 'resolved').length
  const urgentCount = tickets.filter(item => (item.priority === 'Urgent' || item.priority === 'High') && item.status === 'pending').length

  // Pagination calculations
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedTickets = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  const hasActiveFilters = searchText || filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all'

  const resetFilters = () => {
    setSearchText('')
    setFilterStatus('all')
    setFilterPriority('all')
    setFilterCategory('all')
  }

  return (
    <div className="ent-tickets-root">
      <style>{`
        .ent-tickets-root {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
        }

        /* Top Summary Strip - 4 cols on desktop, strictly 2x2 grid on mobile */
        .ent-summary-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 18px;
        }

        .ent-stat-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 16px;
          cursor: pointer;
          transition: border-color 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 48px;
          box-sizing: border-box;
        }
        .ent-stat-box:hover {
          border-color: #cbd5e1;
        }
        .ent-stat-box.active {
          border-color: #154388;
          background: #f8fafc;
        }

        .ent-stat-val {
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.2;
        }
        .ent-stat-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Main Enterprise Card */
        .ent-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        /* Card Header */
        .ent-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          flex-wrap: wrap;
          gap: 12px;
        }

        /* Card Toolbar */
        .ent-toolbar {
          padding: 12px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ent-search-wrapper {
          position: relative;
          flex: 1;
          min-width: 220px;
        }
        .ent-search-input {
          width: 100%;
          height: 36px;
          padding: 0 28px 0 34px;
          font-size: 13px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          outline: none;
          background: #ffffff;
          box-sizing: border-box;
          color: #0f172a;
        }
        .ent-search-input:focus {
          border-color: #154388;
          outline: none;
        }

        .ent-select {
          height: 36px;
          padding: 0 26px 0 10px;
          font-size: 12.5px;
          font-weight: 500;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background-color: #ffffff;
          color: #334155;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 12px;
        }

        .ent-btn-sm {
          height: 34px;
          padding: 0 12px;
          font-size: 12.5px;
          font-weight: 600;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #ffffff;
          color: #334155;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ent-btn-sm:hover {
          background: #f1f5f9;
        }

        .ent-btn-primary-sm {
          height: 32px;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #154388;
          border-radius: 6px;
          background: #154388;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .ent-btn-primary-sm:hover {
          background: #0f3266;
          border-color: #0f3266;
        }

        .ent-btn-danger-sm {
          height: 32px;
          padding: 0 10px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid #dc2626;
          border-radius: 6px;
          background: #ffffff;
          color: #dc2626;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ent-btn-danger-sm:hover {
          background: #fef2f2;
        }

        /* Desktop Table with Horizontal Scroll */
        .ent-table-container {
          overflow-x: auto;
          background: #ffffff;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .ent-table-container::-webkit-scrollbar {
          height: 6px;
        }
        .ent-table-container::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 3px;
        }

        .ent-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1020px;
          text-align: left;
        }

        .ent-th {
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.4px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .ent-td {
          padding: 14px 16px;
          font-size: 13px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .ent-tr:hover {
          background-color: #fcfdfe;
        }

        /* Badges */
        .ent-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .badge-pending {
          background: #fef3c7;
          color: #92400e;
          border-color: #fde68a;
        }

        .badge-resolved {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }

        .badge-role-student {
          background: #eff6ff;
          color: #1e40af;
          border-color: #dbeafe;
        }
        .badge-role-faculty {
          background: #f5f3ff;
          color: #6b21a8;
          border-color: #e9d5ff;
        }
        .badge-role-ltc {
          background: #f0fdfa;
          color: #0f766e;
          border-color: #ccfbf1;
        }

        .badge-p-urgent {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }
        .badge-p-high {
          background: #fff7ed;
          color: #9a3412;
          border-color: #fed7aa;
        }
        .badge-p-med {
          background: #f8fafc;
          color: #334155;
          border-color: #cbd5e1;
        }
        .badge-p-low {
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
        }

        /* Mobile Card View */
        .ent-mobile-list {
          display: none;
          padding: 12px;
        }

        .ent-mobile-item {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          margin-bottom: 12px;
          box-sizing: border-box;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .ent-summary-strip {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }
          .ent-stat-box {
            padding: 12px 14px !important;
          }
          .ent-stat-val {
            font-size: 18px !important;
          }
          .ent-stat-label {
            font-size: 11px !important;
          }
          .ent-table-container { display: none !important; }
          .ent-mobile-list { display: block !important; }
          .ent-card-header { padding: 12px 14px !important; }
          .ent-toolbar { padding: 10px 14px !important; flex-direction: column !important; align-items: stretch !important; }
          .ent-search-wrapper { min-width: 100% !important; }
          .ent-select { width: 100% !important; }
        }

        @media (max-width: 480px) {
          .modal {
            max-height: 85vh !important;
            border-radius: 8px !important;
          }
          .modal-overlay {
            padding: 8px !important;
          }
        }
      `}</style>

      {/* Top Statistics Strip (2x2 Grid on Mobile, 4 Cols on Desktop) */}
      <div className="ent-summary-strip">
        {/* Row 1: Total Tickets */}
        <div 
          className={`ent-stat-box ${filterStatus === 'all' && filterPriority === 'all' ? 'active' : ''}`}
          onClick={() => { setFilterStatus('all'); setFilterPriority('all'); }}
        >
          <div>
            <div className="ent-stat-val">{totalCount}</div>
            <div className="ent-stat-label">{t('Total Tickets')}</div>
          </div>
          <MessageSquare size={16} color="#64748b" style={{ flexShrink: 0 }} />
        </div>

        {/* Row 1: Pending Action */}
        <div 
          className={`ent-stat-box ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => { setFilterStatus('pending'); setFilterPriority('all'); }}
        >
          <div>
            <div className="ent-stat-val" style={{ color: pendingCount > 0 ? '#b45309' : '#0f172a' }}>
              {pendingCount}
            </div>
            <div className="ent-stat-label">{t('Pending Action')}</div>
          </div>
          <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
        </div>

        {/* Row 2: Resolved */}
        <div 
          className={`ent-stat-box ${filterStatus === 'resolved' ? 'active' : ''}`}
          onClick={() => { setFilterStatus('resolved'); setFilterPriority('all'); }}
        >
          <div>
            <div className="ent-stat-val" style={{ color: '#047857' }}>{resolvedCount}</div>
            <div className="ent-stat-label">{t('Resolved')}</div>
          </div>
          <CheckCircle size={16} color="#059669" style={{ flexShrink: 0 }} />
        </div>

        {/* Row 2: Urgent / High */}
        <div 
          className={`ent-stat-box ${filterPriority === 'Urgent' ? 'active' : ''}`}
          onClick={() => { setFilterStatus('pending'); setFilterPriority('Urgent'); }}
        >
          <div>
            <div className="ent-stat-val" style={{ color: urgentCount > 0 ? '#dc2626' : '#64748b' }}>
              {urgentCount}
            </div>
            <div className="ent-stat-label">{t('Urgent / High')}</div>
          </div>
          <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
        </div>
      </div>

      {/* Main Enterprise Tickets Table Card */}
      <div className="ent-card">
        {/* Header Bar */}
        <div className="ent-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              {t('Support Tickets')}
            </h2>
            {pendingCount > 0 && (
              <span className="ent-badge badge-pending">
                {pendingCount} {t('Pending')}
              </span>
            )}
          </div>

          <button 
            onClick={() => fetchTickets({ silent: true })} 
            className="ent-btn-sm"
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? t('Refreshing...') : t('Refresh')}</span>
          </button>
        </div>

        {/* Toolbar: Search and Filters */}
        <div className="ent-toolbar">
          <div className="ent-search-wrapper">
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              className="ent-search-input"
              placeholder={t('Search by ticket #, raiser name, PRN, subject...')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select
              className="ent-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">{t('All Status')}</option>
              <option value="pending">{t('Pending')}</option>
              <option value="resolved">{t('Resolved')}</option>
            </select>

            <select
              className="ent-select"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="all">{t('All Priorities')}</option>
              <option value="Urgent">{t('Urgent')}</option>
              <option value="High">{t('High')}</option>
              <option value="Medium">{t('Medium')}</option>
              <option value="Low">{t('Low')}</option>
            </select>

            {categoriesList.length > 0 && (
              <select
                className="ent-select"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all">{t('All Categories')}</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button onClick={resetFilters} className="ent-btn-sm" style={{ color: '#dc2626' }}>
                <X size={12} /> {t('Clear')}
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
            <div className="spinner spinner-sm" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px' }}>{t('Loading tickets...')}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
            <MessageSquare size={28} style={{ color: '#94a3b8', margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
              {hasActiveFilters ? t('No matching tickets found') : t('No support tickets')}
            </div>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 12px' }}>
              {hasActiveFilters ? t('Try clearing your search or filters.') : t('Tickets raised by users will appear here.')}
            </p>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="ent-btn-sm" style={{ margin: '0 auto' }}>
                {t('Reset Filters')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table - Clean, single-line horizontal alignment, spacious enterprise view */}
            <div className="ent-table-container">
              <table className="ent-table">
                <thead>
                  <tr>
                    <th className="ent-th" style={{ width: '65px' }}>#ID</th>
                    <th className="ent-th" style={{ width: '160px' }}>{t('Raised At')}</th>
                    <th className="ent-th" style={{ width: '220px' }}>{t('Raised By')}</th>
                    <th className="ent-th" style={{ minWidth: '280px' }}>{t('Subject')}</th>
                    <th className="ent-th" style={{ width: '95px' }}>{t('Status')}</th>
                    <th className="ent-th" style={{ width: '260px' }}>{t('Resolution & Reply Time')}</th>
                    <th className="ent-th" style={{ width: '95px', textAlign: 'right' }}>{t('Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTickets.map(ticket => {
                    const isResolved = ticket.status === 'resolved';
                    const isPending = ticket.status === 'pending';
                    const createdTs = formatTimestamp(ticket.created_at);
                    const resolvedTs = formatTimestamp(ticket.resolved_at);

                    const roleClass = ticket.creator_role === 'student' ? 'badge-role-student' : ticket.creator_role === 'faculty' ? 'badge-role-faculty' : 'badge-role-ltc';

                    return (
                      <React.Fragment key={ticket.id}>
                        <tr className="ent-tr">
                          {/* 1. Ticket ID */}
                          <td className="ent-td" style={{ fontFamily: 'monospace', fontWeight: '700', color: '#154388', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => setViewingTicket(ticket)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#154388',
                                cursor: 'pointer',
                                fontWeight: '700',
                                padding: 0,
                                fontFamily: 'inherit',
                                textDecoration: 'underline'
                              }}
                              title="View details"
                            >
                              #{ticket.id}
                            </button>
                          </td>

                          {/* 2. Raised At Timestamp (Single Line) */}
                          <td className="ent-td" style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px' }}>
                              {createdTs.dateStr}
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#64748b', marginLeft: '6px' }}>
                              {createdTs.timeStr}
                            </span>
                          </td>

                          {/* 3. Raised By (Single Line) */}
                          <td className="ent-td" style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                                {ticket.creator_name || '—'}
                              </strong>
                              <span className={`ent-badge ${roleClass}`} style={{ fontSize: '9.5px', padding: '1px 5px' }}>
                                {ticket.creator_role || 'User'}
                              </span>
                              <button
                                onClick={(e) => handleViewRaiser(ticket.user_id, e)}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  color: '#475569',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  padding: '1px 5px'
                                }}
                                disabled={fetchingProfile}
                                title="View profile"
                              >
                                {t('Profile')}
                              </button>
                            </div>
                          </td>

                          {/* 4. Subject (Single Line Ellipsis, Clickable) */}
                          <td className="ent-td">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                onClick={() => setViewingTicket(ticket)}
                                style={{
                                  fontWeight: '600',
                                  color: '#0f172a',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '380px'
                                }}
                                title={ticket.subject}
                              >
                                {ticket.subject || 'No Subject'}
                              </span>
                              {(ticket.has_screenshot || ticket.screenshot) && (
                                <span style={{ fontSize: '10px', color: '#047857', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }} title="Screenshot attached">
                                  <ImageIcon size={10} />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. Status (Single Line) */}
                          <td className="ent-td" style={{ whiteSpace: 'nowrap' }}>
                            <span className={`ent-badge ${isResolved ? 'badge-resolved' : 'badge-pending'}`}>
                              {isResolved ? t('Resolved') : t('Pending')}
                            </span>
                          </td>

                          {/* 6. Resolution & Reply Time (Single Line) */}
                          <td className="ent-td">
                            {isResolved ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px' }}>
                                <span style={{ color: '#334155', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }} title={ticket.resolution}>
                                  "{ticket.resolution}"
                                </span>
                                {ticket.resolved_at && (
                                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: '500', flexShrink: 0 }}>
                                    • {resolvedTs.full}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                {t('Awaiting resolution')}
                              </span>
                            )}
                          </td>

                          {/* 7. Action Button (Aligned on the Same Row) */}
                          <td className="ent-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isPending && !isReadonly && (
                              <button
                                onClick={() => openResolveModal(ticket)}
                                className="ent-btn-primary-sm"
                              >
                                {t('Resolve')}
                              </button>
                            )}
                            {isResolved && (
                              <button
                                onClick={() => setViewingTicket(ticket)}
                                className="ent-btn-sm"
                                style={{ height: '30px', padding: '0 10px', fontSize: '11.5px' }}
                              >
                                {t('View')}
                              </button>
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards List (Responsive Single-Card Layout) */}
            <div className="ent-mobile-list">
              {paginatedTickets.map(ticket => {
                const isResolved = ticket.status === 'resolved';
                const isPending = ticket.status === 'pending';
                const createdTs = formatTimestamp(ticket.created_at);
                const resolvedTs = formatTimestamp(ticket.resolved_at);

                const roleClass = ticket.creator_role === 'student' ? 'badge-role-student' : ticket.creator_role === 'faculty' ? 'badge-role-faculty' : 'badge-role-ltc';
                const priorityClass = ticket.priority === 'Urgent' ? 'badge-p-urgent' : ticket.priority === 'High' ? 'badge-p-high' : ticket.priority === 'Low' ? 'badge-p-low' : 'badge-p-med';

                return (
                  <div key={'mobile-' + ticket.id} className="ent-mobile-item">
                    {/* Header: ID, Role, Priority & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#154388', fontSize: '13px' }}>
                          #{ticket.id}
                        </span>
                        <span className={`ent-badge ${roleClass}`} style={{ fontSize: '10px' }}>
                          {ticket.creator_role}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span className={`ent-badge ${priorityClass}`} style={{ fontSize: '10px' }}>
                          {ticket.priority || 'Medium'}
                        </span>
                        <span className={`ent-badge ${isResolved ? 'badge-resolved' : 'badge-pending'}`}>
                          {isResolved ? t('Resolved') : t('Pending')}
                        </span>
                      </div>
                    </div>

                    {/* Subject */}
                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', marginBottom: '4px', lineHeight: '1.35' }}>
                      {ticket.subject || 'No Subject'}
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.4', marginBottom: '8px' }}>
                      {ticket.description || 'No description.'}
                    </div>

                    {/* Metadata Summary */}
                    <div style={{ fontSize: '11.5px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <div>
                        {t('By')}: <strong style={{ color: '#0f172a' }}>{ticket.creator_name || '—'}</strong>
                      </div>
                      <div>
                        {t('Raised')}: <strong>{createdTs.full}</strong>
                      </div>
                    </div>

                    {/* Resolution Section if Resolved */}
                    {isResolved && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', marginBottom: '8px', fontSize: '11.5px' }}>
                        <div style={{ fontWeight: '600', color: '#047857' }}>
                          {t('Resolved by')} {ticket.resolver_name || 'Admin'}
                        </div>
                        <div style={{ color: '#334155', fontStyle: 'italic', marginTop: '2px' }}>
                          "{ticket.resolution}"
                        </div>
                        {ticket.resolved_at && (
                          <div style={{ color: '#047857', marginTop: '3px', fontSize: '10.5px' }}>
                            {t('Replied')}: {resolvedTs.full}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={() => setViewingTicket(ticket)}
                        className="ent-btn-sm"
                        style={{ flex: 1, justifyContent: 'center', height: '36px' }}
                      >
                        {t('View Details')}
                      </button>
                      {isPending && !isReadonly && (
                        <button
                          onClick={() => openResolveModal(ticket)}
                          className="ent-btn-primary-sm"
                          style={{ flex: 1, justifyContent: 'center', height: '36px' }}
                        >
                          {t('Resolve')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {t('Showing')} <strong>{startIndex + 1}</strong>–<strong>{Math.min(endIndex, filtered.length)}</strong> {t('of')} <strong>{filtered.length}</strong>
                </div>

                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage === 1}
                    className="ent-btn-sm"
                    style={{ height: '30px', padding: '0 8px', fontSize: '11.5px' }}
                  >
                    <ChevronLeft size={13} /> {t('Prev')}
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        height: '30px',
                        minWidth: '30px',
                        padding: '0 6px',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        border: '1px solid',
                        background: validCurrentPage === page ? '#154388' : '#ffffff',
                        color: validCurrentPage === page ? '#ffffff' : '#334155',
                        borderColor: validCurrentPage === page ? '#154388' : '#cbd5e1'
                      }}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage === totalPages}
                    className="ent-btn-sm"
                    style={{ height: '30px', padding: '0 8px', fontSize: '11.5px' }}
                  >
                    {t('Next')} <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ticket Details Modal - Fully Responsive & Non-overflowing on Mobile */}
      <Modal open={!!viewingTicket} onClose={() => setViewingTicket(null)} title={`Ticket #${viewingTicket?.id || ''} Details`} size="lg">
        {viewingTicket && (() => {
          const createdTs = formatTimestamp(viewingTicket.created_at);
          const resolvedTs = formatTimestamp(viewingTicket.resolved_at);
          const isResolved = viewingTicket.status === 'resolved';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: '#1e293b' }}>
              {/* Meta Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
                gap: '10px', 
                background: '#f8fafc', 
                padding: '12px 14px', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0' 
              }}>
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Raised By</div>
                  <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px', wordBreak: 'break-word' }}>
                    {viewingTicket.creator_name || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Role</div>
                  <div style={{ color: '#0f172a', fontWeight: '500', marginTop: '2px', textTransform: 'capitalize' }}>
                    {viewingTicket.creator_role || '—'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Category / Priority</div>
                  <div style={{ color: '#0f172a', fontWeight: '500', marginTop: '2px' }}>
                    {viewingTicket.category || 'Problem'} • {viewingTicket.priority || 'Medium'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Status</div>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`ent-badge ${isResolved ? 'badge-resolved' : 'badge-pending'}`}>
                      {isResolved ? t('Resolved') : t('Pending')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timestamps (Responsive Single-col on small screen, 2-col on larger) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                    {t('Raised Timestamp')}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {createdTs.full}
                  </div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                    {t('Reply / Resolution Timestamp')}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: isResolved ? '#047857' : '#94a3b8', marginTop: '2px' }}>
                    {isResolved ? resolvedTs.full : t('Unresolved')}
                  </div>
                </div>
              </div>

              {/* Batch & Squad Info */}
              {(viewingTicket.batch_name || viewingTicket.squad_name || viewingTicket.on_behalf_of) && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '12px' }}>
                  {viewingTicket.batch_name && (
                    <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                      Batch: {viewingTicket.batch_name}
                    </span>
                  )}
                  {viewingTicket.squad_name && (
                    <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                      Squad: {viewingTicket.squad_name}
                    </span>
                  )}
                  {viewingTicket.on_behalf_of && (
                    <span style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                      On Behalf Of: {viewingTicket.on_behalf_of}
                    </span>
                  )}
                </div>
              )}

              {/* Subject & Description */}
              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Subject</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', wordBreak: 'break-word' }}>
                  {viewingTicket.subject || 'No Subject'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Description</div>
                <div style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  fontSize: '13px', 
                  lineHeight: '1.5', 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  maxHeight: '180px',
                  overflowY: 'auto'
                }}>
                  {viewingTicket.description || 'No description provided.'}
                </div>
              </div>

              {/* Screenshot */}
              {viewingTicket.screenshot && (
                <div>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Screenshot</div>
                  <img 
                    src={viewingTicket.screenshot} 
                    alt="Screenshot" 
                    style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', objectFit: 'contain' }}
                    onClick={() => {
                      const w = window.open()
                      w.document.write(`<img src="${viewingTicket.screenshot}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`)
                    }}
                  />
                </div>
              )}

              {/* Resolution if Resolved */}
              {isResolved && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', wordBreak: 'break-word' }}>
                  <div style={{ fontWeight: '700', color: '#15803d', fontSize: '13px', marginBottom: '2px' }}>
                    {t('Resolved by')} {viewingTicket.resolver_name || 'Admin'} {t('on')} {resolvedTs.full}
                  </div>
                  <div style={{ color: '#334155', fontStyle: 'italic', fontSize: '12.5px' }}>
                    "{viewingTicket.resolution}"
                  </div>
                </div>
              )}

              {/* Modal Resolve Action if Pending */}
              {!isResolved && !isReadonly && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                  <button
                    onClick={() => openResolveModal(viewingTicket, modalResolutionText)}
                    className="ent-btn-primary-sm"
                    style={{ width: '100%', justifyContent: 'center', height: '36px' }}
                  >
                    <Check size={13} /> {t('Resolve Ticket...')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Confirmation Modal for Resolving Ticket */}
      <Modal
        open={!!ticketToResolve}
        onClose={() => !submitting && setTicketToResolve(null)}
        title={t(`Resolve Ticket #${ticketToResolve?.id}`)}
        size="md"
      >
        {ticketToResolve && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                {ticketToResolve.subject}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px', color: '#475569' }}>
                <span style={{ fontWeight: '600', color: '#64748b' }}>Raised By:</span>
                <span>{ticketToResolve.user_name || 'User'} ({ticketToResolve.user_email || '—'})</span>
                {(ticketToResolve.creator_role === 'student' || ticketToResolve.user_role === 'student') ? (
                  <>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Category:</span>
                    <span>{ticketToResolve.category || 'General'}</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: '600', color: '#64748b' }}>Category / Priority:</span>
                    <span>{ticketToResolve.category || 'General'} • {ticketToResolve.priority || 'Medium'}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                {t('Quick Reply Templates')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {QUICK_REPLY_TEMPLATES.map((reply, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setConfirmResolutionText(reply)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '5px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    + {reply}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                Resolution Message <span style={{ color: '#dc2626' }}>* (Mandatory)</span>
              </label>
              <textarea
                placeholder="Explain how the issue was resolved or the action taken..."
                value={confirmResolutionText}
                onChange={e => setConfirmResolutionText(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '85px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  background: '#ffffff',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#166534', lineHeight: '1.4' }}>
              ✉️ An official resolution email will be sent to <strong>{ticketToResolve.user_email || 'the user'}</strong> from <code>Life Awakening Support</code>. Admin personal contact details will never be exposed.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setTicketToResolve(null)}
                disabled={submitting}
                className="ent-btn-sm"
                style={{ height: '36px', padding: '0 14px' }}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={submitting || !confirmResolutionText.trim()}
                className="ent-btn-primary-sm"
                style={{ height: '36px', padding: '0 16px' }}
              >
                <Check size={13} /> {submitting ? t('Resolving...') : t('Confirm & Resolve')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* User Profile Modal - Non-overflowing on mobile */}
      <Modal open={!!viewingProfile} onClose={() => setViewingProfile(null)} title={t("User Profile Details")} size="md">
        {viewingProfile && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px 14px', fontSize: '13px', color: '#334155', wordBreak: 'break-word' }}>
            <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '2px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>{viewingProfile.name}</h3>
              <span className={`ent-badge ${viewingProfile.role === 'student' ? 'badge-role-student' : 'badge-role-faculty'}`} style={{ marginTop: '4px' }}>
                {viewingProfile.role}
              </span>
            </div>

            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Email</div>
              <div style={{ color: '#0f172a', fontWeight: '500', wordBreak: 'break-all' }}>{viewingProfile.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Phone</div>
              <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.phone || '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>School</div>
              <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.school || '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Department</div>
              <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.department || '—'}</div>
            </div>

            {viewingProfile.role === 'student' ? (
              <>
                <div>
                  <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>PRN</div>
                  <div style={{ color: '#0f172a', fontWeight: '500', fontFamily: 'monospace' }}>{viewingProfile.prn || '—'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Semester / Program</div>
                  <div style={{ color: '#0f172a', fontWeight: '500' }}>
                    {viewingProfile.semester ? `Semester ${viewingProfile.semester}` : '—'} {viewingProfile.program ? `(${viewingProfile.program})` : ''}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Employee ID</div>
                  <div style={{ color: '#0f172a', fontWeight: '500', fontFamily: 'monospace' }}>{viewingProfile.faculty_id || '—'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Designation</div>
                  <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.designation || '—'}</div>
                </div>
              </>
            )}

            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Squad</div>
              <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.squad || '—'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>Room</div>
              <div style={{ color: '#0f172a', fontWeight: '500' }}>{viewingProfile.room || '—'}</div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                className="ent-btn-sm" 
                onClick={() => setViewingProfile(null)}
              >
                {t('Close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
