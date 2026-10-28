import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Lock,
  Unlock,
  Shield,
  User,
  Users,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  LayoutGrid,
  Table,
  Filter,
  Check,
  ChevronDown,
  Edit3,
  X,
  Save,
  RotateCcw,
  CheckSquare,
  XSquare,
  AlertTriangle,
  Eye
} from 'lucide-react'

// Robust status normalizer for case-insensitive and variant status strings
const normalizeStatus = (status) => {
  if (!status) return null
  const s = String(status).toLowerCase().trim()
  if (['present', 'p'].includes(s)) return 'present'
  if (['absent', 'a'].includes(s)) return 'absent'
  if (['late', 'l'].includes(s)) return 'late'
  return null
}

export default function LockedStatusTab({ token, apiBase, showToast, batches = [], user }) {
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [loading, setLoading] = useState(false)
  const [lockedData, setLockedData] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'locked' | 'progress' | 'pending'
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  // User Role & Permissions
  const isSuperAdmin = user?.role === 'superadmin'
  const isReadonly = user?.role === 'superadmin_readonly' || !isSuperAdmin
  const [editModal, setEditModal] = useState({
    open: false,
    squadName: '',
    pillarKey: '',
    pillarName: '',
    day: 1
  })
  const [modalLoading, setModalLoading] = useState(false)
  const [modalSubmitting, setModalSubmitting] = useState(false)
  const [modalData, setModalData] = useState(null)
  const [modalEdits, setModalEdits] = useState({}) // { [studentId]: 'present' | 'absent' | 'late' }
  const [modalSearch, setModalSearch] = useState('')
  const [modalStatusFilter, setModalStatusFilter] = useState('all') // 'all' | 'present' | 'absent' | 'late' | 'unmarked'
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    isDestructive: false
  })

  // Default auto-selection: currently active batch
  useEffect(() => {
    if (batches && batches.length > 0 && !selectedBatchId) {
      const activeBatch = batches.find(b => b.status === 'active' || b.status === 'Immersion')
      if (activeBatch) {
        setSelectedBatchId(String(activeBatch.id))
      } else {
        setSelectedBatchId(String(batches[0].id))
      }
    }
  }, [batches, selectedBatchId])

  // Fetch squad-wise locked status data whenever selectedBatchId changes
  const fetchLockedStatus = useCallback(async () => {
    if (!selectedBatchId || !token) return
    try {
      setLoading(true)
      const res = await fetch(`${apiBase}/api/superadmin/locked-status?batchId=${selectedBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setLockedData(data)
      } else {
        if (showToast) showToast(data.message || 'Failed to fetch locked status', 'error')
      }
    } catch (err) {
      if (showToast) showToast('Error connecting to server', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedBatchId, token, apiBase, showToast])

  useEffect(() => {
    fetchLockedStatus()
  }, [fetchLockedStatus])

  // Open Edit/View Modal for a specific Squad Activity
  const handleOpenEditModal = async (squadName, pillarKey, pillarName, day) => {
    setEditModal({
      open: true,
      squadName,
      pillarKey,
      pillarName,
      day
    })
    setModalLoading(true)
    setModalSearch('')
    setModalStatusFilter('all')
    setModalData(null)
    setModalEdits({})

    try {
      const res = await fetch(
        `${apiBase}/api/superadmin/attendance/squad-activity?batchId=${selectedBatchId}&squad=${encodeURIComponent(squadName)}&pillar=${pillarKey}&day=${day}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (res.ok) {
        setModalData(data)
        const initialEdits = {}
        if (data.students && Array.isArray(data.students)) {
          data.students.forEach(st => {
            const norm = normalizeStatus(st.attendance_status)
            if (norm) {
              initialEdits[st.id] = norm
            }
          })
        }
        setModalEdits(initialEdits)
      } else {
        if (showToast) showToast(data.message || 'Failed to fetch squad attendance', 'error')
        setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })
      }
    } catch (err) {
      if (showToast) showToast('Error loading squad attendance data', 'error')
      setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })
    } finally {
      setModalLoading(false)
    }
  }

  // Handle setting individual student attendance status (Super Admin only)
  const handleSetStudentStatus = (studentId, status) => {
    if (!isSuperAdmin) return
    const norm = normalizeStatus(status)
    if (!norm) return
    setModalEdits(prev => ({
      ...prev,
      [studentId]: norm
    }))
  }

  // Mark all filtered/visible students with given status (Super Admin only)
  const handleMarkAll = (status) => {
    if (!isSuperAdmin || !modalData || !modalData.students) return
    const norm = normalizeStatus(status)
    if (!norm) return
    const updated = { ...modalEdits }
    modalData.students.forEach(st => {
      updated[st.id] = norm
    })
    setModalEdits(updated)
    if (showToast) showToast(`All students marked as ${norm.toUpperCase()}`, 'info')
  }

  // Reset to originally fetched statuses
  const handleResetModalEdits = () => {
    if (!modalData || !modalData.students) return
    const initialEdits = {}
    modalData.students.forEach(st => {
      const norm = normalizeStatus(st.attendance_status)
      if (norm) {
        initialEdits[st.id] = norm
      }
    })
    setModalEdits(initialEdits)
    if (showToast) showToast('Reverted all unsaved changes', 'info')
  }

  // Save Attendance (Editable or Locked) - Super Admin Only
  const handleSaveAttendance = async (isLocked = false) => {
    if (!isSuperAdmin || !modalData || !modalData.students) return

    const records = modalData.students.map(st => {
      const rawStatus = modalEdits[st.id] !== undefined ? modalEdits[st.id] : st.attendance_status
      const norm = normalizeStatus(rawStatus)
      return {
        student_id: st.id,
        status: norm
      }
    }).filter(r => r.status)

    if (isLocked) {
      const unmarkedCount = modalData.students.length - records.length
      if (unmarkedCount > 0) {
        if (showToast) showToast(`Incomplete attendance: ${unmarkedCount} student(s) remain unmarked. Please mark all students before locking.`, 'error')
        return
      }
    }

    const executeSave = async () => {
      setModalSubmitting(true)
      try {
        const res = await fetch(`${apiBase}/api/superadmin/attendance/squad-activity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            batchId: selectedBatchId,
            squad: editModal.squadName,
            pillar: editModal.pillarKey,
            day: editModal.day,
            records,
            is_locked: isLocked
          })
        })
        const data = await res.json()
        if (res.ok) {
          if (showToast) showToast(data.message || (isLocked ? 'Attendance saved and locked successfully!' : 'Attendance saved successfully!'), 'success')
          setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })
          fetchLockedStatus()
        } else {
          if (showToast) showToast(data.message || 'Failed to save attendance', 'error')
        }
      } catch (err) {
        if (showToast) showToast('Error saving attendance records', 'error')
      } finally {
        setModalSubmitting(false)
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null, isDestructive: false })
      }
    }

    if (isLocked) {
      setConfirmModal({
        open: true,
        title: 'Lock Attendance Records?',
        message: `Are you sure you want to lock attendance for Squad ${editModal.squadName} (${editModal.pillarName} · Day ${editModal.day})? Superadmin credentials will be recorded as the locker.`,
        onConfirm: executeSave,
        isDestructive: false
      })
    } else {
      executeSave()
    }
  }

  // Unlock Attendance - Super Admin Only
  const handleUnlockAttendance = () => {
    if (!isSuperAdmin || !modalData) return

    const executeUnlock = async () => {
      setModalSubmitting(true)
      try {
        const res = await fetch(`${apiBase}/api/superadmin/attendance/squad-activity/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            batchId: selectedBatchId,
            squad: editModal.squadName,
            pillar: editModal.pillarKey,
            day: editModal.day
          })
        })
        const data = await res.json()
        if (res.ok) {
          if (showToast) showToast(data.message || 'Attendance unlocked successfully!', 'success')
          setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })
          fetchLockedStatus()
        } else {
          if (showToast) showToast(data.message || 'Failed to unlock attendance', 'error')
        }
      } catch (err) {
        if (showToast) showToast('Error unlocking attendance records', 'error')
      } finally {
        setModalSubmitting(false)
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null, isDestructive: false })
      }
    }

    setConfirmModal({
      open: true,
      title: 'Unlock Attendance Records?',
      message: `Are you sure you want to unlock attendance for Squad ${editModal.squadName} (${editModal.pillarName} · Day ${editModal.day})? This will allow squad coordinators to edit or resubmit.`,
      onConfirm: executeUnlock,
      isDestructive: false
    })
  }

  // Filtered squads based on search and status filter
  const filteredSquads = useMemo(() => {
    if (!lockedData || !lockedData.squads) return []
    return lockedData.squads.filter(sq => {
      const query = searchQuery.trim().toLowerCase()
      const matchSearch = !query ||
        sq.squadName.toLowerCase().includes(query) ||
        sq.coordinatorName.toLowerCase().includes(query)

      if (!matchSearch) return false

      if (statusFilter === 'locked') return sq.overallLockedPercentage === 100
      if (statusFilter === 'progress') return sq.overallLockedPercentage > 0 && sq.overallLockedPercentage < 100
      if (statusFilter === 'pending') return sq.overallLockedPercentage === 0

      return true
    })
  }, [lockedData, searchQuery, statusFilter])

  // Filtered students inside modal
  const filteredModalStudents = useMemo(() => {
    if (!modalData || !modalData.students) return []
    return modalData.students.filter(st => {
      const query = modalSearch.trim().toLowerCase()
      const matchQuery = !query ||
        st.name?.toLowerCase().includes(query) ||
        st.prn?.toLowerCase().includes(query) ||
        st.roll_number?.toLowerCase().includes(query) ||
        st.email?.toLowerCase().includes(query) ||
        st.division?.toLowerCase().includes(query)

      if (!matchQuery) return false

      const rawStatus = modalEdits[st.id] !== undefined ? modalEdits[st.id] : st.attendance_status
      const currentStatus = normalizeStatus(rawStatus)

      if (modalStatusFilter === 'present') return currentStatus === 'present'
      if (modalStatusFilter === 'absent') return currentStatus === 'absent'
      if (modalStatusFilter === 'late') return currentStatus === 'late'
      if (modalStatusFilter === 'unmarked') return !currentStatus

      return true
    })
  }, [modalData, modalSearch, modalStatusFilter, modalEdits])

  // Modal stats calculation
  const modalStats = useMemo(() => {
    if (!modalData || !modalData.students) {
      return { total: 0, present: 0, absent: 0, late: 0, unmarked: 0 }
    }
    const total = modalData.students.length
    let present = 0, absent = 0, late = 0, unmarked = 0
    modalData.students.forEach(st => {
      const rawStatus = modalEdits[st.id] !== undefined ? modalEdits[st.id] : st.attendance_status
      const currentStatus = normalizeStatus(rawStatus)
      if (currentStatus === 'present') present++
      else if (currentStatus === 'absent') absent++
      else if (currentStatus === 'late') late++
      else unmarked++
    })
    return { total, present, absent, late, unmarked }
  }, [modalData, modalEdits])

  // Render status badge for an activity day cell
  const renderCellStatus = (cellInfo, squadName, pillarKey, pillarName, day) => {
    if (!cellInfo) {
      return (
        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>—</span>
      )
    }

    const { markedCount, totalStudents, isLocked, isCompleted, isPartial } = cellInfo

    const cellContent = (() => {
      if (isLocked) {
        return (
          <div className="locked-status-badge badge-locked badge-clickable" style={{
            background: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: '8px',
            padding: '6px 8px',
            textAlign: 'center',
            color: '#16a34a',
            position: 'relative'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <Lock size={10} strokeWidth={2.5} />
              <span>{markedCount}/{totalStudents}</span>
            </div>
            <div style={{ fontSize: '9px', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
              LOCKED
            </div>
            <div className="badge-edit-hint">
              {isSuperAdmin ? <><Edit3 size={10} /> Edit</> : <><Eye size={10} /> View</>}
            </div>
          </div>
        )
      }

      if (isCompleted) {
        return (
          <div className="locked-status-badge badge-completed badge-clickable" style={{
            background: '#eff6ff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '8px',
            padding: '6px 8px',
            textAlign: 'center',
            color: '#2563eb',
            position: 'relative'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800' }}>
              {markedCount}/{totalStudents}
            </div>
            <div style={{ fontSize: '9px', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
              NOT LOCKED
            </div>
            <div className="badge-edit-hint">
              {isSuperAdmin ? <><Edit3 size={10} /> Edit</> : <><Eye size={10} /> View</>}
            </div>
          </div>
        )
      }

      if (isPartial) {
        return (
          <div className="locked-status-badge badge-partial badge-clickable" style={{
            background: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '8px',
            padding: '6px 8px',
            textAlign: 'center',
            color: '#d97706',
            position: 'relative'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '800' }}>
              {markedCount}/{totalStudents}
            </div>
            <div style={{ fontSize: '9px', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
              PARTIAL
            </div>
            <div className="badge-edit-hint">
              {isSuperAdmin ? <><Edit3 size={10} /> Edit</> : <><Eye size={10} /> View</>}
            </div>
          </div>
        )
      }

      return (
        <div className="locked-status-badge badge-pending badge-clickable" style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: '8px',
          padding: '6px 8px',
          textAlign: 'center',
          color: '#64748b',
          position: 'relative'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '750' }}>
            0/{totalStudents}
          </div>
          <div style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
            PENDING
          </div>
          <div className="badge-edit-hint">
            {isSuperAdmin ? <><Edit3 size={10} /> Edit</> : <><Eye size={10} /> View</>}
          </div>
        </div>
      )
    })()

    return (
      <div
        onClick={() => handleOpenEditModal(squadName, pillarKey, pillarName, day)}
        title={isSuperAdmin 
          ? `Click to edit and lock attendance for Squad ${squadName} - ${pillarName} (Day ${day})`
          : `Click to view attendance details for Squad ${squadName} - ${pillarName} (Day ${day})`
        }
        style={{ cursor: 'pointer' }}
      >
        {cellContent}
      </div>
    )
  }

  const pillarsList = lockedData?.pillarsList || [
    { key: 'bag_checking', name: 'Orientation', days: [1] },
    { key: 'agriculture', name: 'Agriculture & Nature', days: [2, 3, 4, 5] },
    { key: 'physical', name: 'Physical Fitness & Sports', days: [2, 3, 4, 5] },
    { key: 'leadership', name: 'Team Building & Leadership', days: [2, 3, 4, 5] },
    { key: 'patriotism', name: 'Patriotism & Nation Building', days: [2, 3, 4, 5] },
    { key: 'spirituality', name: 'Spirituality & Peace', days: [2, 3, 4, 5] }
  ]

  const summary = lockedData?.summary || {
    totalSquads: 0,
    totalStudents: 0,
    fullyLockedSquads: 0,
    batchLockedPercentage: 0
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style>{`
        /* Locked Status Page Styles */
        .locked-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .locked-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .locked-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
        }
        .matrix-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }
        .matrix-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 800;
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 8px 6px;
          border-bottom: 2px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          text-align: center;
          white-space: nowrap;
        }
        .matrix-table th:first-child,
        .matrix-table th:nth-child(2) {
          text-align: left;
        }
        .matrix-table td {
          padding: 5px 4px;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .matrix-table tr:hover td {
          background-color: #fcfdfe !important;
        }

        .badge-clickable {
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .badge-clickable:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          border-color: #154388 !important;
        }
        .badge-edit-hint {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #154388;
          color: #ffffff;
          font-size: 7.5px;
          font-weight: 850;
          padding: 1px 3px;
          border-radius: 3px;
          display: none;
          align-items: center;
          gap: 2px;
        }
        .badge-clickable:hover .badge-edit-hint {
          display: flex;
        }

        /* Modal Overlay & Card */
        .sa-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          animation: saFadeIn 0.18s ease-out;
        }
        .sa-modal-card {
          background: #ffffff;
          border-radius: 14px;
          width: 100%;
          max-width: 760px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
          border: 1px solid #e2e8f0;
          animation: saSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .sa-modal-header {
          background: #154388;
          color: #ffffff;
          padding: 12px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .sa-modal-subheader {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .sa-modal-body {
          padding: 10px 14px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sa-modal-stats-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
        }
        .sa-modal-footer {
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        @keyframes saFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes saSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Present (Green) & Absent (Red) Toggle Buttons */
        .status-pill-btn {
          min-width: 34px;
          height: 30px;
          padding: 0 8px;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 850;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .status-pill-btn.present {
          background: #ffffff;
          color: #166534;
          border: 1.5px solid #bbf7d0;
        }
        .status-pill-btn.present:hover {
          background: #f0fdf4;
          border-color: #16a34a;
        }
        .status-pill-btn.present.active {
          background: #16a34a !important;
          color: #ffffff !important;
          border-color: #15803d !important;
          box-shadow: 0 1px 4px rgba(22, 163, 74, 0.3);
        }

        .status-pill-btn.absent {
          background: #ffffff;
          color: #991b1b;
          border: 1.5px solid #fecaca;
        }
        .status-pill-btn.absent:hover {
          background: #fef2f2;
          border-color: #dc2626;
        }
        .status-pill-btn.absent.active {
          background: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
          box-shadow: 0 1px 4px rgba(220, 38, 38, 0.3);
        }

        .status-pill-btn.readonly {
          cursor: default !important;
          pointer-events: none;
        }
        .status-pill-btn.readonly:not(.active) {
          opacity: 0.35;
          border-style: dashed;
        }
        .status-pill-btn.readonly.active {
          opacity: 1;
        }

        /* Student List Rows on Mobile */
        .student-list-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          gap: 8px;
        }
        .student-list-row:last-child {
          border-bottom: none;
        }
        .student-list-row:hover {
          background: #f8fafc;
        }

        /* Responsive Breakpoints */
        @media (max-width: 768px) {
          .locked-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .sa-modal-overlay {
            padding: 6px !important;
          }
          .sa-modal-card {
            max-height: 95vh !important;
            border-radius: 12px !important;
          }
          .sa-modal-header {
            padding: 10px 12px !important;
          }
          .sa-modal-subheader {
            padding: 8px 10px !important;
          }
          .sa-modal-body {
            padding: 8px 10px !important;
          }
          .sa-modal-footer {
            padding: 8px 10px !important;
          }
          .sa-modal-footer .footer-actions {
            width: 100% !important;
            display: flex !important;
            gap: 6px !important;
          }
          .sa-modal-footer .footer-actions button {
            flex: 1 !important;
            padding: 8px 6px !important;
            font-size: 11.5px !important;
          }
          .sa-modal-footer .unlock-btn {
            width: 100% !important;
            margin-bottom: 4px !important;
          }
        }

        @media (max-width: 480px) {
          .locked-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* Top Header Card with Title & Batch Selector */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#154388',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Lock size={15} />
          </div>
          <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '850', color: '#0f172a', letterSpacing: '-0.3px' }}>
            Locked Status
          </h1>
        </div>

        {/* Batch Selector & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', minWidth: '180px', flex: '1 1 180px', maxWidth: '280px' }}>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 28px 6px 10px',
                borderRadius: '6px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0f172a',
                cursor: 'pointer',
                appearance: 'none',
                outline: 'none',
                height: '32px'
              }}
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.status === 'active' || b.status === 'Immersion' ? '(Active)' : `(${b.status || 'Past'})`}
                </option>
              ))}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
          </div>

          <button
            onClick={fetchLockedStatus}
            disabled={loading}
            title="Refresh Locked Data"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1.5px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: '700',
              fontSize: '12px',
              cursor: loading ? 'default' : 'pointer',
              height: '32px',
              flexShrink: 0
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? '...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards - Compact 4-col on desktop, 2x2 on mobile */}
      <div className="locked-stats-grid">
        {/* Total Squads */}
        <div className="locked-stat-card">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Layers size={16} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Total Squads
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', lineHeight: 1.2 }}>
              {summary.totalSquads}
            </div>
          </div>
        </div>

        {/* Total Students */}
        <div className="locked-stat-card">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={16} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Total Students
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a', lineHeight: 1.2 }}>
              {summary.totalStudents}
            </div>
          </div>
        </div>

        {/* Fully Locked Squads */}
        <div className="locked-stat-card">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Fully Locked
            </div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#154388', lineHeight: 1.2 }}>
              {summary.fullyLockedSquads} <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>/ {summary.totalSquads}</span>
            </div>
          </div>
        </div>

        {/* Batch Locked Rate */}
        <div className="locked-stat-card">
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f1f5f9', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Lock size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Lock Rate
              </span>
              <span style={{ fontSize: '13px', fontWeight: '900', color: '#154388' }}>
                {summary.batchLockedPercentage}%
              </span>
            </div>
            <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '3px', marginTop: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${summary.batchLockedPercentage}%`, height: '100%', background: '#154388', borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar - Compact without empty spaces */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {/* Row 1: Search & Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search squad or coordinator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 28px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                height: '32px'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none',
              cursor: 'pointer',
              height: '32px',
              flex: '0 1 auto'
            }}
          >
            <option value="all">All Squads ({lockedData?.squads?.length || 0})</option>
            <option value="locked">Fully Locked (100%)</option>
            <option value="progress">In Progress (1-99%)</option>
            <option value="pending">Pending (0%)</option>
          </select>
        </div>

        {/* Row 2: Legend & View Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10.5px', fontWeight: '700', color: '#475569', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }}></span>
              <span>Locked</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb' }}></span>
              <span>Unlocked</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#d97706' }}></span>
              <span>Partial</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }}></span>
              <span>Pending</span>
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 8px',
                borderRadius: '5px',
                border: 'none',
                background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                fontWeight: '700',
                fontSize: '11px',
                cursor: 'pointer',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <LayoutGrid size={11} /> Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                padding: '4px 8px',
                borderRadius: '5px',
                border: 'none',
                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? '#0f172a' : '#64748b',
                fontWeight: '700',
                fontSize: '11px',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <Table size={11} /> Matrix Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '40px 16px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#154388' }} />
          <div style={{ fontWeight: '750', fontSize: '13px', color: '#0f172a' }}>Loading Locked Status...</div>
        </div>
      ) : filteredSquads.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '40px 16px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <AlertCircle size={24} style={{ margin: '0 auto 8px auto', color: '#94a3b8' }} />
          <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>No Squads Found</div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
            {searchQuery || statusFilter !== 'all'
              ? 'No squads match your search or filter.'
              : 'No squads or students allocated to this batch.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ─── MATRIX TABLE VIEW ─── */
        <div className="locked-table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th style={{ minWidth: '110px', position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc' }}>
                  Squad
                </th>
                <th style={{ minWidth: '140px' }}>
                  Coordinator
                </th>
                <th style={{ minWidth: '75px', background: '#eff6ff', color: '#1e40af' }}>
                  Orientation<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 1</span>
                </th>
                <th colSpan={3} style={{ background: '#f0fdf4', color: '#166534' }}>
                  Agriculture & Nature<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 2 · Day 3 · Day 4</span>
                </th>
                <th colSpan={3} style={{ background: '#fef3c7', color: '#92400e' }}>
                  Physical Fitness & Sports<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 2 · Day 3 · Day 4</span>
                </th>
                <th colSpan={3} style={{ background: '#f5f3ff', color: '#5b21b6' }}>
                  Team Building & Leadership<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 2 · Day 3 · Day 4</span>
                </th>
                <th colSpan={3} style={{ background: '#fff1f2', color: '#9f1239' }}>
                  Patriotism & Nation Building<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 2 · Day 3 · Day 4</span>
                </th>
                <th colSpan={3} style={{ background: '#ecfeff', color: '#155e75' }}>
                  Spirituality & Peace<br />
                  <span style={{ fontSize: '8.5px', fontWeight: '600' }}>Day 2 · Day 3 · Day 4</span>
                </th>
                <th style={{ minWidth: '90px', background: '#f8fafc' }}>
                  Progress
                </th>
              </tr>
              <tr style={{ background: '#f1f5f9', fontSize: '9.5px' }}>
                <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f1f5f9' }}></th>
                <th></th>
                <th>D1</th>
                <th>D2</th><th>D3</th><th>D4</th>
                <th>D2</th><th>D3</th><th>D4</th>
                <th>D2</th><th>D3</th><th>D4</th>
                <th>D2</th><th>D3</th><th>D4</th>
                <th>D2</th><th>D3</th><th>D4</th>
                <th>Total %</th>
              </tr>
            </thead>
            <tbody>
              {filteredSquads.map((sq, idx) => (
                <tr key={sq.squadName} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                  {/* Squad Name */}
                  <td style={{ position: 'sticky', left: 0, zIndex: 5, background: idx % 2 === 0 ? '#ffffff' : '#fafafa', borderRight: '1.5px solid #cbd5e1' }}>
                    <div style={{ fontWeight: '850', color: '#0f172a', fontSize: '13px' }}>
                      {sq.squadName}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                      {sq.studentCount} students
                    </div>
                  </td>

                  {/* Coordinator Name */}
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>
                    <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '11.5px' }}>
                      {sq.coordinatorName}
                    </span>
                  </td>

                  {/* Orientation Day 1 */}
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>
                    {renderCellStatus(sq.pillarStatuses?.bag_checking?.days?.day_1, sq.squadName, 'bag_checking', 'Orientation', 1)}
                  </td>

                  {/* Agriculture & Nature (Days 2,3,4) */}
                  <td>{renderCellStatus(sq.pillarStatuses?.agriculture?.days?.day_2, sq.squadName, 'agriculture', 'Agriculture & Nature', 2)}</td>
                  <td>{renderCellStatus(sq.pillarStatuses?.agriculture?.days?.day_3, sq.squadName, 'agriculture', 'Agriculture & Nature', 3)}</td>
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>{renderCellStatus(sq.pillarStatuses?.agriculture?.days?.day_4, sq.squadName, 'agriculture', 'Agriculture & Nature', 4)}</td>

                  {/* Physical Fitness & Sports (Days 2,3,4) */}
                  <td>{renderCellStatus(sq.pillarStatuses?.physical?.days?.day_2, sq.squadName, 'physical', 'Physical Fitness & Sports', 2)}</td>
                  <td>{renderCellStatus(sq.pillarStatuses?.physical?.days?.day_3, sq.squadName, 'physical', 'Physical Fitness & Sports', 3)}</td>
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>{renderCellStatus(sq.pillarStatuses?.physical?.days?.day_4, sq.squadName, 'physical', 'Physical Fitness & Sports', 4)}</td>

                  {/* Team Building & Leadership (Days 2,3,4) */}
                  <td>{renderCellStatus(sq.pillarStatuses?.leadership?.days?.day_2, sq.squadName, 'leadership', 'Team Building & Leadership', 2)}</td>
                  <td>{renderCellStatus(sq.pillarStatuses?.leadership?.days?.day_3, sq.squadName, 'leadership', 'Team Building & Leadership', 3)}</td>
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>{renderCellStatus(sq.pillarStatuses?.leadership?.days?.day_4, sq.squadName, 'leadership', 'Team Building & Leadership', 4)}</td>

                  {/* Patriotism & Nation Building (Days 2,3,4) */}
                  <td>{renderCellStatus(sq.pillarStatuses?.patriotism?.days?.day_2, sq.squadName, 'patriotism', 'Patriotism & Nation Building', 2)}</td>
                  <td>{renderCellStatus(sq.pillarStatuses?.patriotism?.days?.day_3, sq.squadName, 'patriotism', 'Patriotism & Nation Building', 3)}</td>
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>{renderCellStatus(sq.pillarStatuses?.patriotism?.days?.day_4, sq.squadName, 'patriotism', 'Patriotism & Nation Building', 4)}</td>

                  {/* Spirituality & Peace (Days 2,3,4) */}
                  <td>{renderCellStatus(sq.pillarStatuses?.spirituality?.days?.day_2, sq.squadName, 'spirituality', 'Spirituality & Peace', 2)}</td>
                  <td>{renderCellStatus(sq.pillarStatuses?.spirituality?.days?.day_3, sq.squadName, 'spirituality', 'Spirituality & Peace', 3)}</td>
                  <td style={{ borderRight: '1.5px solid #cbd5e1' }}>{renderCellStatus(sq.pillarStatuses?.spirituality?.days?.day_4, sq.squadName, 'spirituality', 'Spirituality & Peace', 4)}</td>

                  {/* Overall Locked Progress */}
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#154388' }}>
                        {sq.overallLockedPercentage}%
                      </span>
                      <div style={{ width: '45px', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${sq.overallLockedPercentage}%`,
                          height: '100%',
                          background: '#154388',
                          borderRadius: '2px'
                        }}></div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* ─── SQUAD CARDS VIEW ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredSquads.map(sq => (
            <div
              key={sq.squadName}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              {/* Squad Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'rgba(21,67,136,0.08)', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', flexShrink: 0 }}>
                    {sq.squadName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: '14.5px', fontWeight: '850', color: '#0f172a' }}>
                      Squad {sq.squadName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap' }}>
                      <span>Coordinator: <strong style={{ color: '#0f172a' }}>{sq.coordinatorName}</strong></span>
                      <span>·</span>
                      <span>{sq.studentCount} Students</span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#154388' }}>
                      {sq.overallLockedPercentage}%
                    </div>
                  </div>
                  <div style={{ width: '50px', height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${sq.overallLockedPercentage}%`, height: '100%', background: '#154388', borderRadius: '3px' }}></div>
                  </div>
                </div>
              </div>

              {/* Pillars Matrix for this Squad */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', minWidth: '400px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', color: '#475569', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '800' }}>Activity</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '800', width: '80px' }}>Day 1</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '800', width: '80px' }}>Day 2</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '800', width: '80px' }}>Day 3</th>
                      <th style={{ padding: '6px 4px', textAlign: 'center', fontWeight: '800', width: '80px' }}>Day 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pillarsList.map((pillar, pIdx) => {
                      const isOrientation = pillar.key === 'bag_checking'
                      return (
                        <tr key={pillar.key} style={{ borderBottom: '1px solid #f1f5f9', background: pIdx % 2 === 0 ? '#ffffff' : '#fcfdfe' }}>
                          <td style={{ padding: '6px 10px', fontWeight: '750', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {pillar.name}
                          </td>
                          {[1, 2, 3, 4].map(d => {
                            if (isOrientation && d > 1) {
                              return (
                                <td key={d} style={{ padding: '4px', textAlign: 'center', color: '#cbd5e1' }}>
                                  —
                                </td>
                              )
                            }
                            if (!isOrientation && d === 1) {
                              return (
                                <td key={d} style={{ padding: '4px', textAlign: 'center', color: '#cbd5e1' }}>
                                  —
                                </td>
                              )
                            }
                            const cellInfo = sq.pillarStatuses?.[pillar.key]?.days?.[ `day_${d}` ]
                            return (
                              <td key={d} style={{ padding: '4px', textAlign: 'center' }}>
                                {renderCellStatus(cellInfo, sq.squadName, pillar.key, pillar.name, d)}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── SQUAD ATTENDANCE OVERRIDE & VIEW MODAL ─── */}
      {editModal.open && (
        <div className="sa-modal-overlay" onClick={() => !modalSubmitting && setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })}>
          <div className="sa-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sa-modal-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Shield size={14} style={{ color: '#ffffff', flexShrink: 0 }} />
                  <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#e2e8f0' }}>
                    Superadmin Attendance Override
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: '#ffffff', wordBreak: 'break-word', lineHeight: 1.3 }}>
                  Squad {editModal.squadName} · {editModal.pillarName} (Day {editModal.day})
                </h2>
                {modalData?.coordinator && (
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '2px', wordBreak: 'break-word' }}>
                    Coordinator: <strong style={{ color: '#ffffff' }}>{modalData.coordinator.name}</strong> ({modalData.coordinator.email || modalData.coordinator.phone})
                  </div>
                )}
              </div>

              <button
                disabled={modalSubmitting}
                onClick={() => setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Sub-Header: Current Lock Status & Quick Action Buttons */}
            <div className="sa-modal-subheader">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  background: '#154388',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {modalData?.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0f172a' }}>
                  {modalData?.isLocked ? 'Currently Locked' : 'Unlocked / In-Progress'}
                </span>
                {modalData?.isLocked && modalData?.lockedByName && (
                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                    (by {modalData.lockedByName})
                  </span>
                )}
              </div>

              {/* Quick Actions (Super Admin Only) */}
              {isSuperAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={modalLoading || modalSubmitting}
                    onClick={() => handleMarkAll('present')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '5px',
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#166534',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      height: '28px'
                    }}
                  >
                    <CheckSquare size={11} /> Mark All Present
                  </button>
                  <button
                    type="button"
                    disabled={modalLoading || modalSubmitting}
                    onClick={() => handleMarkAll('absent')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '5px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      height: '28px'
                    }}
                  >
                    <XSquare size={11} /> Mark All Absent
                  </button>
                  <button
                    type="button"
                    disabled={modalLoading || modalSubmitting}
                    onClick={handleResetModalEdits}
                    title="Revert changes"
                    style={{
                      padding: '4px 7px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      height: '28px'
                    }}
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>
              )}
            </div>

            {/* Modal Body */}
            <div className="sa-modal-body">
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                  <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 6px auto', color: '#154388' }} />
                  <div style={{ fontWeight: '750', fontSize: '12.5px' }}>Loading Attendance...</div>
                </div>
              ) : (
                <>
                  {/* Stats Bar & Filter Controls in One Compact Unit */}
                  <div className="sa-modal-stats-bar">
                    {/* Live Stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: '800' }}>
                      <span style={{ color: '#0f172a' }}>Total: {modalStats.total}</span>
                      <span style={{ color: '#16a34a' }}>Present: {modalStats.present}</span>
                      <span style={{ color: '#dc2626' }}>Absent: {modalStats.absent}</span>
                      {modalStats.unmarked > 0 && (
                        <span style={{ color: '#991b1b', background: '#fee2e2', padding: '1px 5px', borderRadius: '4px', fontSize: '10.5px' }}>
                          Unmarked: {modalStats.unmarked}
                        </span>
                      )}
                    </div>

                    {/* Search & Status Filter side-by-side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 220px', justifyContent: 'flex-end' }}>
                      <div style={{ position: 'relative', flex: '1 1 120px' }}>
                        <Search size={11} style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search student..."
                          value={modalSearch}
                          onChange={(e) => setModalSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '4px 6px 4px 22px',
                            borderRadius: '5px',
                            border: '1px solid #cbd5e1',
                            fontSize: '11.5px',
                            outline: 'none',
                            height: '28px'
                          }}
                        />
                      </div>

                      <select
                        value={modalStatusFilter}
                        onChange={(e) => setModalStatusFilter(e.target.value)}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '5px',
                          border: '1px solid #cbd5e1',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          outline: 'none',
                          background: '#ffffff',
                          color: '#0f172a',
                          height: '28px'
                        }}
                      >
                        <option value="all">All ({modalData?.students?.length || 0})</option>
                        <option value="present">Present ({modalStats.present})</option>
                        <option value="absent">Absent ({modalStats.absent})</option>
                        <option value="unmarked">Unmarked ({modalStats.unmarked})</option>
                      </select>
                    </div>
                  </div>

                  {/* Student Attendance List - Clean, 100% visible on 360px+ with NO horizontal clipping */}
                  <div style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#ffffff'
                  }}>
                    {/* List Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #cbd5e1',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px'
                    }}>
                      <span>Student Details</span>
                      <span style={{ width: '80px', textAlign: 'center' }}>Mark</span>
                    </div>

                    {/* Scrollable Student Rows */}
                    <div style={{ maxHeight: '320px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      {filteredModalStudents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b', fontSize: '12px' }}>
                          No students match your filter.
                        </div>
                      ) : (
                        filteredModalStudents.map((st, sIdx) => {
                          const rawStatus = modalEdits[st.id] !== undefined ? modalEdits[st.id] : st.attendance_status
                          const currentStatus = normalizeStatus(rawStatus)
                          return (
                            <div key={st.id} className="student-list-row">
                              {/* Left side: Student Name, PRN, Div/Roll */}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                                  <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700' }}>
                                    {sIdx + 1}.
                                  </span>
                                  <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '12.5px', wordBreak: 'break-word' }}>
                                    {st.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: '650', color: '#334155' }}>PRN: {st.prn || '—'}</span>
                                  <span>·</span>
                                  <span>{st.division ? `Div ${st.division}` : ''} {st.roll_number ? `#${st.roll_number}` : ''}{!st.division && !st.roll_number && '—'}</span>
                                </div>
                              </div>

                              {/* Right side: Present [P] and Absent [A] controls */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  disabled={isReadonly}
                                  title={isSuperAdmin ? "Mark Present" : `Present (${currentStatus === 'present' ? 'Marked' : 'Not Marked'})`}
                                  className={`status-pill-btn present ${currentStatus === 'present' ? 'active' : ''} ${isReadonly ? 'readonly' : ''}`}
                                  onClick={() => isSuperAdmin && handleSetStudentStatus(st.id, 'present')}
                                >
                                  P
                                </button>
                                <button
                                  type="button"
                                  disabled={isReadonly}
                                  title={isSuperAdmin ? "Mark Absent" : `Absent (${currentStatus === 'absent' ? 'Marked' : 'Not Marked'})`}
                                  className={`status-pill-btn absent ${currentStatus === 'absent' ? 'active' : ''} ${isReadonly ? 'readonly' : ''}`}
                                  onClick={() => isSuperAdmin && handleSetStudentStatus(st.id, 'absent')}
                                >
                                  A
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer Controls - Compact & Clean */}
            <div className="sa-modal-footer">
              {isSuperAdmin ? (
                <>
                  {modalData?.isLocked && (
                    <button
                      type="button"
                      disabled={modalSubmitting || modalLoading}
                      onClick={handleUnlockAttendance}
                      className="unlock-btn"
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        color: '#154388',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '800',
                        fontSize: '11.5px',
                        cursor: modalSubmitting ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        height: '32px'
                      }}
                    >
                      <Unlock size={12} />
                      <span>Unlock Records</span>
                    </button>
                  )}

                  <div className="footer-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      disabled={modalSubmitting}
                      onClick={() => setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '750',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        height: '32px'
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={modalSubmitting || modalLoading}
                      onClick={() => handleSaveAttendance(false)}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #154388',
                        color: '#154388',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: '800',
                        fontSize: '11.5px',
                        cursor: modalSubmitting ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        height: '32px'
                      }}
                    >
                      <Save size={12} />
                      <span>{modalSubmitting ? 'Saving...' : 'Save (Editable)'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={modalSubmitting || modalLoading}
                      onClick={() => handleSaveAttendance(true)}
                      style={{
                        background: '#154388',
                        border: 'none',
                        color: '#ffffff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: '850',
                        fontSize: '11.5px',
                        cursor: modalSubmitting ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        height: '32px',
                        boxShadow: '0 1px 4px rgba(21, 67, 136, 0.25)'
                      }}
                    >
                      <Lock size={12} />
                      <span>{modalSubmitting ? 'Locking...' : 'Save & Lock'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setEditModal({ open: false, squadName: '', pillarKey: '', pillarName: '', day: 1 })}
                    style={{
                      background: '#154388',
                      border: 'none',
                      color: '#ffffff',
                      padding: '6px 16px',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      height: '32px'
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="sa-modal-overlay" style={{ zIndex: 10000 }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '16px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            border: '1px solid #e2e8f0',
            animation: 'saSlideUp 0.18s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                background: '#f1f5f9',
                color: '#154388',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Lock size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '850', color: '#0f172a' }}>
                {confirmModal.title}
              </h3>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#475569', lineHeight: 1.4 }}>
              {confirmModal.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null, isDestructive: false })}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '750',
                  color: '#475569',
                  cursor: 'pointer',
                  height: '30px'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm()
                }}
                style={{
                  background: '#154388',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '850',
                  color: '#ffffff',
                  cursor: 'pointer',
                  height: '30px'
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

