import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Users, GraduationCap, MapPin, Calendar, ChevronRight, Edit2, Trash2, Upload, Download, Search, X, CheckCircle, AlertCircle, RefreshCw, Lock, Unlock, UserCheck, UserX, Shield, ChevronLeft, ChevronDown, FileText, ShieldAlert, Mail, Clock } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { formatStudentEmail } from './utils/studentEmailHelper'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const SQUAD_NAMES = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']
const SQUAD_COLORS = {
  Surya:     '#ea580c', // Orange
  Aditya:    '#eab308', // Yellow
  Ravi:      '#10b981', // Green
  Divakar:   '#06b6d4', // Cyan
  Mitra:     '#3b82f6', // Blue
  Martand:   '#8b5cf6', // Purple
  Dinkar:    '#ec4899', // Pink
  Prabhakar: '#f43f5e', // Rose
  Bhaskar:   '#0d9488', // Teal
  Tejonidhi: '#64748b', // Slate
}

// ─── Toast Hook ───────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])
  return { toasts, toast }
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckCircle size={18} className="toast-icon" />}
          {t.type === 'error' && <AlertCircle size={18} className="toast-icon" />}
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Pagination Component ─────────────────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages, total, limit } = pagination
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  const pageNums = []
  let lo = Math.max(1, page - 2), hi = Math.min(pages, page + 2)
  for (let i = lo; i <= hi; i++) pageNums.push(i)

  return (
    <div className="pagination">
      <button className="pagination-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft size={14} />
      </button>
      {lo > 1 && <><button className="pagination-btn" onClick={() => onPageChange(1)}>1</button>{lo > 2 && <span style={{ color: 'var(--text-4)', padding: '0 4px' }}>…</span>}</>}
      {pageNums.map(n => (
        <button key={n} className={`pagination-btn ${n === page ? 'active' : ''}`} onClick={() => onPageChange(n)}>{n}</button>
      ))}
      {hi < pages && <><span style={{ color: 'var(--text-4)', padding: '0 4px' }}>…</span><button className="pagination-btn" onClick={() => onPageChange(pages)}>{pages}</button></>}
      <button className="pagination-btn" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight size={14} />
      </button>
      <span className="pagination-info">Showing {start}–{end} of {total}</span>
    </div>
  )
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size = '' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 4 }}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function computeNextLapBatchInfo(batchList = [], dateVal = null) {
  let maxNum = 0;
  for (const b of batchList) {
    if (!b) continue;
    const lapMatch = (b.name || '').match(/^LAP-(\d+)-/i);
    const nameMatch = (b.name || '').match(/(?:LAP|LRP|LTC|BATCH)[\s-_]*(\d+)/i);
    const codeMatch = (b.batch_code || '').match(/^(\d+)/);
    let n = 0;
    if (lapMatch) {
      n = parseInt(lapMatch[1], 10);
    } else if (nameMatch) {
      n = parseInt(nameMatch[1], 10);
    } else if (codeMatch) {
      n = parseInt(codeMatch[1], 10);
    }
    if (n > maxNum && n < 1000) {
      maxNum = n;
    }
  }
  if (maxNum === 0 && batchList.length > 0) {
    maxNum = batchList.length;
  }
  let nextNum = maxNum + 1;
  const d = dateVal ? new Date(dateVal) : new Date();
  const validDate = !isNaN(d.getTime()) ? d : new Date();
  const month = String(validDate.getMonth() + 1).padStart(2, "0");
  const yearVal = String(validDate.getFullYear());
  const yearShort = yearVal.substring(2);

  let paddedNum = String(nextNum).padStart(2, "0");
  let name = `LAP-${paddedNum}-${month}${yearShort}`;
  let batch_code = `${paddedNum}-${month}${yearShort}`;

  const existingNames = new Set(batchList.map(b => (b?.name || '').trim().toUpperCase()));
  while (existingNames.has(name.toUpperCase())) {
    nextNum += 1;
    paddedNum = String(nextNum).padStart(2, "0");
    name = `LAP-${paddedNum}-${month}${yearShort}`;
    batch_code = `${paddedNum}-${month}${yearShort}`;
  }

  return { nextNum, name, batch_code, year: yearVal };
}

// ─── Batch Form Modal ─────────────────────────────────────────────────────────
function BatchFormModal({ open, onClose, onSave, initial, defaultStatus, batches = [] }) {
  const [form, setForm] = useState({ name: '', location: 'LTC Boribel', start_date: '', end_date: '', status: defaultStatus || 'upcoming', description: '', batch_code: '', year: '' })
  useEffect(() => { 
    if (initial) {
      setForm(initial);
    } else {
      const defaults = computeNextLapBatchInfo(batches, new Date());
      setForm({ 
        name: defaults.name, 
        location: 'LTC Boribel', 
        start_date: '', 
        end_date: '', 
        status: defaultStatus || 'upcoming', 
        description: '',
        batch_code: defaults.batch_code,
        year: defaults.year
      });
    }
  }, [initial, open, defaultStatus, batches]);

  useEffect(() => {
    if (!initial && open) {
      const computed = computeNextLapBatchInfo(batches, form.start_date || new Date());
      setForm(f => ({
        ...f,
        name: computed.name,
        batch_code: computed.batch_code,
        year: computed.year
      }));
    }
  }, [form.start_date, batches, initial, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Batch' : 'Create New Batch'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Batch Name *</label>
          <input className="input-field input-field-rect" placeholder="e.g. LAP-01-1026" value={form.name} onChange={e => set('name', e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Location</label>
          <input className="input-field input-field-rect" placeholder="e.g. LTC Boribel" value={form.location} onChange={e => set('location', e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Start Date</label>
            <input type="date" className="input-field input-field-rect" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>End Date</label>
            <input type="date" className="input-field input-field-rect" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Status</label>
          <select className="input-field input-field-rect" value={form.status} onChange={e => set('status', e.target.value)} style={{ marginBottom: 0, borderRadius: 12 }}>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Description</label>
          <textarea className="input-field" placeholder="Optional notes about this batch..." value={form.description} onChange={e => set('description', e.target.value)} style={{ marginBottom: 0, minHeight: 80, borderRadius: 12 }} />
        </div>
      </div>
      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 20 }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => onSave(form)} disabled={!form.name.trim()}>{initial ? 'Save Changes' : 'Create Batch'}</button>
      </div>
    </Modal>
  )
}

// ─── Batch Delete Confirmation Modal (Standard Admin Confirmation) ───────────
function BatchDeleteOtpModal({ open, batch, token, onClose, onSuccess }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setError('')
      setDeleting(false)
    }
  }, [open, batch?.id])

  if (!open || !batch) return null

  const handleDelete = async (e) => {
    if (e) e.preventDefault()
    if (deleting) return

    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.message || `Batch "${batch.name}" successfully deleted.`)
      } else {
        setError(data.message || 'Failed to delete batch.')
      }
    } catch (err) {
      setError('Network error during batch deletion.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && !deleting && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        className="modal"
        style={{
          borderRadius: '20px',
          overflow: 'hidden',
          border: '1.5px solid #fee2e2',
          boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.25)',
          maxWidth: '520px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          animation: 'fadeInScale 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                Confirm Batch Deletion
              </h3>
              <p style={{ fontSize: '12px', margin: '2px 0 0', color: 'rgba(255, 255, 255, 0.85)' }}>
                Admin Authorization Action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{
              border: 'none',
              padding: '6px',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '50%',
              cursor: deleting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Target Batch Info Badge */}
          <div
            style={{
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Target Batch
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '750',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#fee2e2',
                  color: '#b91c1c'
                }}
              >
                {batch.status ? batch.status.toUpperCase() : 'BATCH'}
              </span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '850', color: '#1e293b' }}>
              {batch.name}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {batch.batch_code && <span>Code: <strong style={{ color: '#334155' }}>{batch.batch_code}</strong></span>}
              {batch.year && <span>Year: <strong style={{ color: '#334155' }}>{batch.year}</strong></span>}
              {batch.location && <span>Location: <strong style={{ color: '#334155' }}>{batch.location}</strong></span>}
            </div>
          </div>

          {/* Warning Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#991b1b',
              background: '#fff1f2',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid #ffe4e6'
            }}
          >
            <AlertCircle size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Warning:</strong> Deleting this batch will unassign all enrolled students and faculty members, and will archive related batch records.
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
                Note: Student accounts, parent accounts, login credentials, and historical submissions will remain safe and will <em>not</em> be deleted.
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '10px 12px',
                color: '#b91c1c',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              style={{
                padding: '12px 16px',
                background: '#f1f5f9',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: '750',
                color: '#475569',
                cursor: deleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '12px 16px',
                background: deleting ? '#fca5a5' : '#dc2626',
                border: 'none',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: '800',
                color: '#ffffff',
                cursor: deleting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: deleting ? 'none' : '0 4px 12px rgba(220, 38, 38, 0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              {deleting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Deleting Batch...</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>Delete Batch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
  )
}

// ─── Batch Students Tab ───────────────────────────────────────────────────────
function BatchStudentsTab({ batchId, batchName, token, toast }) {
  const [students, setStudents] = useState([])
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [recordsToConfirm, setRecordsToConfirm] = useState([])
  const searchRef = useRef()

  const fetchStudents = useCallback(async (pg = 1, q = search) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/students?page=${pg}&limit=50&search=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { setStudents(data.students); setPagination(data.pagination) }
    } finally { setLoading(false) }
  }, [batchId, token, search])

  useEffect(() => { fetchStudents(1, '') }, [batchId])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchStudents(1, search) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const handleRemove = async (studentId) => {
    if (!window.confirm('Remove this student from the batch? Their master record will be preserved.')) return
    await fetch(`${API}/api/admin/batches/${batchId}/students/${studentId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    toast('Student removed from batch.', 'success')
    fetchStudents(page, search)
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const name = file.name.toLowerCase()
    const parse = (records) => processBulkUpload(records)

    if (name.endsWith('.csv')) {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => parse(r.data), error: () => toast('CSV parse error', 'error') })
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = evt => {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        parse(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]))
      }
      reader.readAsBinaryString(file)
    }
    e.target.value = null
  }

  const processBulkUpload = (records) => {
    if (!Array.isArray(records) || records.length === 0) {
      toast('The uploaded file is empty or invalid.', 'error')
      return
    }
    const normalized = records.map(raw => {
      const r = {}
      for (const key in raw) {
        r[key.replace(/^\uFEFF/, '').toLowerCase().trim()] = String(raw[key] || '').trim()
      }
      return {
        name: r.name || r['full name'] || r.username || '—',
        email: r.email || '—',
        prn: r.prn || r['student id'] || r.student_id || r.faculty_id || r['faculty id'] || r.id || '—',
        role: r.role || 'student',
        department: r.department || r.dept || '—'
      }
    })
    setRecordsToConfirm(normalized)
    setShowConfirmModal(true)
  }

  const handleLinkConfirm = async () => {
    setShowConfirmModal(false)
    setUploading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/enroll-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: recordsToConfirm })
      })
      const data = await res.json()
      if (!res.ok) {
        toast(data.message || 'Linking failed.', 'error')
        return
      }

      const parts = []
      if (data.enrolled > 0)       parts.push(`${data.enrolled} enrolled`)
      if (data.alreadyInBatch > 0) parts.push(`${data.alreadyInBatch} already in batch`)
      if (data.notFound > 0)       parts.push(`${data.notFound} not found in database`)

      const type = data.notFound > 0 ? 'warning' : 'success'
      toast(parts.join(' · ') || 'No changes made.', type)
      fetchStudents(1, search)
    } catch (err) {
      toast('Network error during upload.', 'error')
    } finally {
      setUploading(false)
      setRecordsToConfirm([])
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/export-students`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        toast(errData.message || 'Failed to export batch students.', 'error')
        return
      }

      const count = res.headers.get('X-Student-Count')
      const blob = await res.blob()
      
      let filename = `BATCH_${batchId}_Students.xlsx`
      const disposition = res.headers.get('Content-Disposition')
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/)
        if (match && match[1]) filename = match[1]
      } else if (batchName) {
        filename = `${batchName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Students.xlsx`
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast(`Exported ${count ? count + ' ' : ''}students successfully`, 'success')
    } catch (err) {
      console.error('Export error:', err)
      toast('Network error during export.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrapper" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <Search className="search-icon" size={16} />
          <input className="input-field" placeholder="Search by name, email, PRN…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
          <Upload size={14} /> {uploading ? 'Linking…' : 'Link to this batch'}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkUpload} style={{ display: 'none' }} />
        </label>
        <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={exporting}>
          <Download size={14} /> {exporting ? 'Exporting…' : 'Export'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={() => fetchStudents(page, search)}><RefreshCw size={14} /></button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr>
            <th>Name</th><th>PRN</th><th>Email</th><th>School / Dept</th>
            <th>Squad</th><th>NRI</th><th>Insured</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="loading-center" style={{ minHeight: 80 }}><div className="spinner spinner-sm" /></div></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={8}><div className="empty-state" style={{ padding: '40px 0' }}><GraduationCap size={36} /><p>No students found. Upload a CSV/XLSX to add students.</p></div></td></tr>
            ) : students.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{s.name}</div>
                  {s.red_flag && <span className="badge badge-black" style={{ marginTop: 3 }}>Flagged</span>}
                </td>
                <td><code style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.prn || '—'}</code></td>
                <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{formatStudentEmail(s.email, 'Not provided')}</td>
                <td style={{ fontSize: 12.5 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>{s.school || '—'}</div>
                  <div style={{ color: 'var(--text-4)', fontSize: 11.5 }}>{s.department}</div>
                </td>
                <td>
                  {s.squad
                    ? <span className="badge" style={{ background: (SQUAD_COLORS[s.squad] + '22') || 'var(--primary-bg)', color: SQUAD_COLORS[s.squad] || 'var(--primary)' }}>{s.squad}</span>
                    : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>}
                </td>
                <td>{s.nri ? <span className="badge badge-nri">NRI</span> : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>Regular</span>}</td>
                <td>{s.insured ? <span className="badge badge-blue">Yes</span> : <span className="badge badge-black">No</span>}</td>
                <td>
                  <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleRemove(s.id)}>
                    <UserX size={12} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pagination} onPageChange={p => { setPage(p); fetchStudents(p, search) }} />

      {/* Link Confirmation Modal */}
      <Modal open={showConfirmModal} onClose={() => { setShowConfirmModal(false); setRecordsToConfirm([]); }} title="Confirm Batch Linkage" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-light)', padding: 16, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Users size={20} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Ready to Link Records</h4>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                We parsed <strong>{recordsToConfirm.length}</strong> record(s) from your file. Please verify them below. Clicking <strong>Confirm & Link</strong> will associate these students/faculty with the current batch. No master database profile details will be modified.
              </p>
            </div>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            <table className="data-table data-table-compact" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>PRN / ID</th>
                  <th>Role</th>
                  <th>Department</th>
                </tr>
              </thead>
              <tbody>
                {recordsToConfirm.map((rec, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{rec.name}</td>
                    <td>{rec.role === 'student' ? formatStudentEmail(rec.email, 'Not provided') : rec.email}</td>
                    <td><code style={{ fontSize: 11 }}>{rec.prn}</code></td>
                    <td>
                      <span className={`badge ${rec.role === 'faculty' ? 'badge-blue' : 'badge-green'}`}>
                        {rec.role}
                      </span>
                    </td>
                    <td>{rec.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 12, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowConfirmModal(false);
                setRecordsToConfirm([]);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleLinkConfirm}
            >
              Confirm & Link
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Batch Faculty Tab ────────────────────────────────────────────────────────
function BatchFacultyTab({ batchId, token, toast }) {
  const [faculty, setFaculty] = useState([])
  const [allFaculty, setAllFaculty] = useState([])
  const [search, setSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchFaculty = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setFaculty(data.faculty)
    } finally { setLoading(false) }
  }, [batchId, token])

  const fetchAll = async () => {
    const res = await fetch(`${API}/api/admin/faculty-list?limit=200&search=${encodeURIComponent(addSearch)}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) setAllFaculty(data.faculty)
  }

  useEffect(() => { fetchFaculty() }, [batchId])
  useEffect(() => { if (showAddModal) fetchAll() }, [showAddModal, addSearch])

  const handleAdd = async (fid) => {
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ faculty_ids: [fid] })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.message && data.message.includes('skipped')) {
          toast(data.message, 'error')
        } else {
          toast(data.message || 'Faculty added to batch.', 'success')
        }
      } else {
        toast(data.message || 'Failed to add faculty.', 'error')
      }
      fetchFaculty()
    } catch (e) {
      toast('Network error.', 'error')
    }
  }

  const handleRemove = async (fid) => {
    if (!window.confirm('Remove this faculty from batch? Master record preserved.')) return
    await fetch(`${API}/api/admin/batches/${batchId}/faculty/${fid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    toast('Faculty removed from batch.', 'success')
    fetchFaculty()
  }

  const inBatch = useMemo(() => new Set(faculty.map(f => f.id)), [faculty])
  const filtered = useMemo(() => faculty.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.email.toLowerCase().includes(search.toLowerCase())
  ), [faculty, search])

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrapper" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <Search className="search-icon" size={16} />
          <input className="input-field" placeholder="Search faculty…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <button className="btn btn-sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Assign Faculty</button>
        <button className="btn btn-outline btn-sm" onClick={fetchFaculty}><RefreshCw size={14} /></button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Panel</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="loading-center" style={{ minHeight: 80 }}><div className="spinner spinner-sm" /></div></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state" style={{ padding: '40px 0' }}><Users size={36} /><p>No faculty assigned yet.</p></div></td></tr>
            ) : filtered.map(f => (
              <tr key={f.id}>
                <td><div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5 }}>{f.name}</div></td>
                <td style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{f.email}</td>
                <td style={{ fontSize: 12.5 }}>{f.department}</td>
                <td>{f.panel ? <span className="badge badge-blue">{f.panel}</span> : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>}</td>
                <td>{f.is_primary ? <span className="badge badge-blue">Primary</span> : <span className="badge badge-gray">Secondary</span>}</td>
                <td>
                  <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => handleRemove(f.id)}>
                    <UserX size={12} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Assign Faculty to Batch" size="lg">
        <div className="search-wrapper" style={{ maxWidth: '100%' }}>
          <Search className="search-icon" size={16} />
          <input className="input-field" placeholder="Search faculty…" value={addSearch} onChange={e => setAddSearch(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div className="table-wrapper" style={{ marginTop: 16 }}>
          <table className="data-table data-table-compact">
            <thead><tr><th>Name</th><th>Department</th><th>Panel</th><th>Action</th></tr></thead>
            <tbody>
              {allFaculty.map(f => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{f.email}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{f.department}</td>
                  <td>{f.panel ? <span className="badge badge-blue">{f.panel}</span> : '—'}</td>
                  <td>
                    {inBatch.has(f.id)
                      ? <span className="badge badge-blue"><CheckCircle size={10} /> Added</span>
                      : <button className="btn btn-sm" onClick={() => handleAdd(f.id)}><Plus size={12} /> Add</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}

// ─── Squad Allocation Tab ─────────────────────────────────────────────────────
function SquadAllocationTab({ batchId, token, toast }) {
  const [data, setData] = useState({ locked: false, students: [], faculty: [], squadNames: SQUAD_NAMES })
  const [loading, setLoading] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [selectedSquad, setSelectedSquad] = useState(SQUAD_NAMES[0])
  const [search, setSearch] = useState('')

  const fetchSquads = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/squads`, { headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      if (res.ok) setData(d)
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchSquads() }, [batchId])

  const handleAutoAllocate = async () => {
    if (!window.confirm('Auto-allocate all students into 10 squads? This will overwrite existing assignments.')) return
    setAllocating(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/auto-allocate-squads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json()
      toast(d.message, res.ok ? 'success' : 'error')
      if (res.ok) fetchSquads()
    } finally { setAllocating(false) }
  }

  const handleLockToggle = async () => {
    const locked = !data.locked
    const res = await fetch(`${API}/api/admin/batches/${batchId}/lock-squads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locked })
    })
    const d = await res.json()
    toast(d.message, res.ok ? 'success' : 'error')
    if (res.ok) fetchSquads()
  }

  const handleSquadChange = async (studentId, squad) => {
    if (data.locked) { toast('Unlock squad allocation first.', 'warning'); return }
    await fetch(`${API}/api/admin/batches/${batchId}/student-squad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_id: studentId, squad })
    })
    toast('Squad updated.', 'success')
    fetchSquads()
  }

  const squadStats = useMemo(() => {
    const stats = {}
    SQUAD_NAMES.forEach(s => { stats[s] = { students: 0, faculty: 0 } })
    data.students.forEach(s => { if (s.squad && stats[s.squad]) stats[s.squad].students++ })
    data.faculty.forEach(f => { if (f.squad && stats[f.squad]) stats[f.squad].faculty++ })
    return stats
  }, [data])

  const squadStudents = useMemo(() =>
    data.students.filter(s => s.squad === selectedSquad && (!search || s.name.toLowerCase().includes(search.toLowerCase())))
  , [data.students, selectedSquad, search])

  const unassigned = data.students.filter(s => !s.squad)

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm" onClick={handleAutoAllocate} disabled={allocating || data.locked}>
          {allocating ? <><div className="spinner spinner-sm" />Allocating…</> : <><RefreshCw size={14} />Auto Allocate 10 Squads</>}
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleLockToggle}>
          {data.locked ? <><Unlock size={14} />Unlock</> : <><Lock size={14} />Lock Allocation</>}
        </button>
        {data.locked && <span className="badge badge-blue"><Lock size={10} /> Allocation Locked</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
          {data.students.length} students · {unassigned.length} unassigned
        </span>
      </div>

      {/* Overview grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
        {SQUAD_NAMES.map(sq => (
          <div key={sq} className="squad-card" style={{ cursor: 'pointer', border: selectedSquad === sq ? `2px solid ${SQUAD_COLORS[sq] || 'var(--primary)'}` : undefined }}
            onClick={() => setSelectedSquad(sq)}>
            <div className="squad-card-header">
              <div className="squad-badge" style={{ background: SQUAD_COLORS[sq] || 'var(--primary)' }}>
                {sq.substring(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{sq}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="batch-stat" style={{ flex: 1 }}>
                <span className="batch-stat-value" style={{ fontSize: 16 }}>{squadStats[sq]?.students || 0}</span>
                <span className="batch-stat-label" style={{ fontSize: 9 }}>STUDENTS</span>
              </div>
              <div className="batch-stat" style={{ flex: 1 }}>
                <span className="batch-stat-value" style={{ fontSize: 16 }}>{squadStats[sq]?.faculty || 0}</span>
                <span className="batch-stat-label" style={{ fontSize: 9 }}>FACULTY</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected squad detail */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="squad-badge" style={{ background: SQUAD_COLORS[selectedSquad] || 'var(--primary)', width: 40, height: 40, fontSize: 14 }}>{selectedSquad.substring(0, 2)}</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{selectedSquad} Squad</h3>
          <div className="search-wrapper" style={{ margin: 0, marginLeft: 'auto', maxWidth: 260 }}>
            <Search className="search-icon" size={14} />
            <input className="input-field" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0, paddingLeft: 40 }} />
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table data-table-compact">
            <thead><tr><th>Name</th><th>PRN</th><th>Gender</th><th>Change Squad</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4}><div className="loading-center" style={{ minHeight: 60 }}><div className="spinner spinner-sm" /></div></td></tr>
                : squadStudents.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '24px 0', fontStyle: 'italic' }}>No students in this squad</td></tr>
                  : squadStudents.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><code style={{ fontSize: 11 }}>{s.prn || '—'}</code></td>
                      <td>{s.gender || '—'}</td>
                      <td>
                        <select disabled={data.locked} value={s.squad || ''} onChange={e => handleSquadChange(s.id, e.target.value)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 12, background: 'white', cursor: data.locked ? 'not-allowed' : 'pointer' }}>
                          {SQUAD_NAMES.map(sq => <option key={sq} value={sq}>{sq}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Batch Detail View ────────────────────────────────────────────────────────
function BatchDetail({ batch, token, toast, onBack, onRefresh }) {
  const [tab, setTab] = useState('students')

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const statusColor = { active: 'green', upcoming: 'blue', completed: 'gray', archived: 'gray' }[batch.status] || 'gray'

  return (
    <div className="animate-fade-in">
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}><ChevronLeft size={14} /> All Batches</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{batch.name}</h2>
            <span className={`badge badge-${statusColor} status-${batch.status}`}>{batch.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap', color: 'var(--text-3)', fontSize: 13, fontWeight: 500 }}>
            {batch.location && <span><MapPin size={12} style={{ marginRight: 4, display: 'inline' }} />{batch.location}</span>}
            {batch.start_date && <span><Calendar size={12} style={{ marginRight: 4, display: 'inline' }} />{formatDate(batch.start_date)} → {formatDate(batch.end_date)}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{batch.student_count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Students</div>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{batch.faculty_count}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Faculty</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'students', label: 'Students', icon: <GraduationCap size={13} /> },
          { key: 'faculty', label: 'Faculty', icon: <Users size={13} /> },
          { key: 'squads', label: 'Squad Allocation', icon: <Shield size={13} /> },
        ].map(t => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass-card" style={{ padding: 24 }}>
        {tab === 'students' && <BatchStudentsTab batchId={batch.id} batchName={batch.name} token={token} toast={toast} />}
        {tab === 'faculty' && <BatchFacultyTab batchId={batch.id} token={token} toast={toast} />}
        {tab === 'squads' && <SquadAllocationTab batchId={batch.id} token={token} toast={toast} />}
      </div>
    </div>
  )
}

// ─── Main BatchManagement Component ──────────────────────────────────────────
export default function BatchManagement({ token }) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editBatch, setEditBatch] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const { toasts, toast } = useToast()
  const [batchToDelete, setBatchToDelete] = useState(null)

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setBatches(data.batches)
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchBatches() }, [])

  const handleCreate = async (form) => {
    const targetStatus = form.status || 'upcoming'
    const res = await fetch(`${API}/api/admin/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    toast(data.message, res.ok ? 'success' : 'error')
    if (res.ok) { setShowCreate(false); setActiveTab(targetStatus); fetchBatches() }
  }

  const handleEdit = async (form) => {
    const res = await fetch(`${API}/api/admin/batches/${editBatch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    toast(data.message, res.ok ? 'success' : 'error')
    if (res.ok) { setEditBatch(null); fetchBatches() }
  }

  const handleDelete = (batch) => {
    setBatchToDelete(batch)
  }

  const filtered = useMemo(() => batches.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !search || b.name.toLowerCase().includes(q) || (b.location || '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || b.status === filterStatus
    return matchSearch && matchStatus
  }), [batches, search, filterStatus])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const statusBadge = (s) => ({
    active: <span className="badge badge-blue status-active">Active</span>,
    upcoming: <span className="badge badge-blue status-upcoming">Upcoming</span>,
    completed: <span className="badge badge-gray status-completed">Completed</span>,
    archived: <span className="badge badge-gray status-archived">Archived</span>,
  }[s] || <span className="badge badge-gray">{s}</span>)

  // Show batch detail
  if (selectedBatch) {
    return (
      <>
        <BatchDetail
          batch={selectedBatch}
          token={token}
          toast={toast}
          onBack={() => { setSelectedBatch(null); fetchBatches() }}
          onRefresh={fetchBatches}
        />
        <ToastContainer toasts={toasts} />
      </>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Batch Management</h2>
          <p className="page-subtitle">Create and manage LTC batches, assign students and faculty, allocate squads</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={fetchBatches}><RefreshCw size={14} /></button>
          <button className="btn" onClick={() => setShowCreate(true)}><Plus size={16} /> New Batch</button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: 'Total Batches', value: batches.length, color: 'var(--primary)' },
          { label: 'Active', value: batches.filter(b => b.status === 'active').length, color: 'var(--success)' },
          { label: 'Upcoming', value: batches.filter(b => b.status === 'upcoming').length, color: 'var(--warning)' },
          { label: 'Total Students Enrolled', value: batches.reduce((a, b) => a + parseInt(b.student_count || 0), 0), color: 'var(--primary)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-accent" style={{ background: s.color }} />
            <div className="stat-card-value" style={{ color: s.color, fontSize: 24 }}>{s.value}</div>
            <div className="stat-card-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrapper" style={{ margin: 0, flex: 1, minWidth: 200 }}>
          <Search className="search-icon" size={16} />
          <input className="input-field" placeholder="Search batches…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <select className="input-field input-field-rect" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ marginBottom: 0, width: 'auto', minWidth: 140, borderRadius: 50, fontSize: 13 }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Batch Cards */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><p>Loading batches…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <GraduationCap size={48} />
          <h3>No batches found</h3>
          <p>Create your first LTC batch to get started. Students and faculty can then be added from the master database.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}><Plus size={16} /> Create Batch</button>
        </div>
      ) : (
        <div className="batches-grid">
          {filtered.map(b => (
            <div key={b.id} className="batch-card" onClick={() => setSelectedBatch(b)}>
              <div className="batch-card-header">
                <div>
                  <div className="batch-card-title">{b.name}</div>
                  {b.location && <div className="batch-card-location"><MapPin size={11} />{b.location}</div>}
                  {b.start_date && <div className="batch-card-dates">{formatDate(b.start_date)} → {formatDate(b.end_date)}</div>}
                </div>
                <div style={{ display: 'flex', flex-direction: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {statusBadge(b.status)}
                </div>
              </div>
              <div className="batch-card-stats">
                <div className="batch-stat">
                  <span className="batch-stat-value">{b.student_count}</span>
                  <span className="batch-stat-label">Students</span>
                </div>
                <div className="batch-stat">
                  <span className="batch-stat-value">{b.faculty_count}</span>
                  <span className="batch-stat-label">Faculty</span>
                </div>
              </div>
              <div className="batch-card-actions">
                <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setSelectedBatch(b) }}>
                  <ChevronRight size={13} /> Open Batch
                </button>
                <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); setEditBatch({ ...b, start_date: b.start_date?.split('T')[0], end_date: b.end_date?.split('T')[0] }) }}>
                  <Edit2 size={13} />
                </button>
                <button className="btn btn-outline btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={e => { e.stopPropagation(); handleDelete(b) }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <BatchFormModal open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} defaultStatus={activeTab} batches={batches} />
      <BatchFormModal open={!!editBatch} onClose={() => setEditBatch(null)} onSave={handleEdit} initial={editBatch} batches={batches} />

      <BatchDeleteOtpModal
        open={!!batchToDelete}
        batch={batchToDelete}
        token={token}
        onClose={() => setBatchToDelete(null)}
        onSuccess={(msg) => {
          toast(msg || 'Batch deleted successfully', 'success')
          setBatchToDelete(null)
          fetchBatches()
        }}
      />

      <ToastContainer toasts={toasts} />
    </div>
  )
}
