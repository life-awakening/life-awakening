import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Users, GraduationCap, MapPin, Calendar, ChevronRight, Edit2, Trash2, Upload, UploadCloud, Download, Search, X, CheckCircle, AlertCircle, RefreshCw, Lock, Unlock, UserCheck, UserX, Shield, ChevronLeft, ChevronDown, FileText, FileSpreadsheet, Layers, Bell, ClipboardList, MoreHorizontal, Ban, ShieldAlert, Mail, Clock, UserPlus, AlertTriangle, Shuffle, School, Bed, Check, Info, Shirt } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { OFFICIAL_HIERARCHY } from './hierarchy'
import { exportLtcExcel } from '../utils/exportLtcExcel'
import BulkUploadModule from './BulkUploadModule'
import { formatStudentEmail } from '../utils/studentEmailHelper'
import BatchStudentsBreakdownTab from './BatchStudentsBreakdownTab'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'
const SQUAD_NAMES = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']
const SQUAD_COLORS = {
  Surya:     '#0C54A4',
  Aditya:    '#FCCC04',
  Ravi:      '#04A4E4',
  Divakar:   '#AC4C84',
  Mitra:     '#EC7C1C',
  Martand:   '#64A474',
  Dinkar:    '#047C44',
  Prabhakar: '#E40C84',
  Bhaskar:   '#A45C3C',
  Tejonidhi: '#E41C24',
}

const BATCH_IMAGES = [
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a91?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527891751199-7225231a68dd?w=600&auto=format&fit=crop&q=80'
]
const getBatchImage = (id) => BATCH_IMAGES[(id || 0) % BATCH_IMAGES.length]

const normalizeStatus = (status) => {
  if (!status) return 'upcoming';
  const s = status.toLowerCase();
  if (['immersion', 'active'].includes(s)) return 'active';
  if (['completed'].includes(s)) return 'completed';
  if (['archived'].includes(s)) return 'archived';
  return 'upcoming';
};


const getNumForScheme = (scheme, marks) => {
  if (scheme === 'fully_done') return 100
  if (scheme === 'partially_done') return 66
  if (scheme === 'not_done') return 33
  if (marks === 100) return 100
  if (marks === 50 || marks === 66) return 66
  if (marks === 0 || marks === 33) return 33
  return marks || 0
}
const SQUAD_ORDER_CANONICAL = [
  'Aditya',
  'Bhaskar',
  'Dinkar',
  'Divakar',
  'Mitra',
  'Martand',
  'Prabhakar',
  'Ravi',
  'Surya',
  'Tejonidhi'
]

const ADMIN_PILLAR_COLUMNS = [
  { header: 'Orientation - Day 1', pillarKeys: ['orientation', 'bag_checking', 'bag checking', 'bag_check', 'bag check'], day: 1 },
  
  { header: 'Agriculture & Nature - Day 2', pillarKeys: ['agriculture', 'agriculture & nature'], day: 2 },
  { header: 'Agriculture & Nature - Day 3', pillarKeys: ['agriculture', 'agriculture & nature'], day: 3 },
  { header: 'Agriculture & Nature - Day 4', pillarKeys: ['agriculture', 'agriculture & nature'], day: 4 },
  { header: 'Agriculture & Nature - Day 5', pillarKeys: ['agriculture', 'agriculture & nature'], day: 5 },

  { header: 'Physical Fitness & Sports - Day 2', pillarKeys: ['physical', 'fitness', 'sports', 'physical fitness & sports'], day: 2 },
  { header: 'Physical Fitness & Sports - Day 3', pillarKeys: ['physical', 'fitness', 'sports', 'physical fitness & sports'], day: 3 },
  { header: 'Physical Fitness & Sports - Day 4', pillarKeys: ['physical', 'fitness', 'sports', 'physical fitness & sports'], day: 4 },
  { header: 'Physical Fitness & Sports - Day 5', pillarKeys: ['physical', 'fitness', 'sports', 'physical fitness & sports'], day: 5 },

  { header: 'Team Building & Leadership - Day 2', pillarKeys: ['leadership', 'team building', 'team building & leadership'], day: 2 },
  { header: 'Team Building & Leadership - Day 3', pillarKeys: ['leadership', 'team building', 'team building & leadership'], day: 3 },
  { header: 'Team Building & Leadership - Day 4', pillarKeys: ['leadership', 'team building', 'team building & leadership'], day: 4 },
  { header: 'Team Building & Leadership - Day 5', pillarKeys: ['leadership', 'team building', 'team building & leadership'], day: 5 },

  { header: 'Patriotism & Nation Building - Day 2', pillarKeys: ['patriotism', 'nation building', 'patriotism & nation building'], day: 2 },
  { header: 'Patriotism & Nation Building - Day 3', pillarKeys: ['patriotism', 'nation building', 'patriotism & nation building'], day: 3 },
  { header: 'Patriotism & Nation Building - Day 4', pillarKeys: ['patriotism', 'nation building', 'patriotism & nation building'], day: 4 },
  { header: 'Patriotism & Nation Building - Day 5', pillarKeys: ['patriotism', 'nation building', 'patriotism & nation building'], day: 5 },

  { header: 'Spirituality & Inner Peace - Day 2', pillarKeys: ['spirituality', 'inner peace', 'spirituality & peace', 'spirituality & inner peace'], day: 2 },
  { header: 'Spirituality & Inner Peace - Day 3', pillarKeys: ['spirituality', 'inner peace', 'spirituality & peace', 'spirituality & inner peace'], day: 3 },
  { header: 'Spirituality & Inner Peace - Day 4', pillarKeys: ['spirituality', 'inner peace', 'spirituality & peace', 'spirituality & inner peace'], day: 4 },
  { header: 'Spirituality & Inner Peace - Day 5', pillarKeys: ['spirituality', 'inner peace', 'spirituality & peace', 'spirituality & inner peace'], day: 5 }
]

function buildAdminAttendanceExportRows(studentsList, recordsList, schedulesList = []) {
  // Sort Panel-wise (Panel A, Panel B, Panel C...), then Squad-wise (SQUAD_ORDER_CANONICAL), then Student Name (A-Z)
  const sortedStudents = [...studentsList].sort((a, b) => {
    const pA = String(a.panel || a.student_panel || '').trim()
    const pB = String(b.panel || b.student_panel || '').trim()
    if (pA !== pB) {
      if (!pA || pA === '—' || pA === 'Unassigned') return 1
      if (!pB || pB === '—' || pB === 'Unassigned') return -1
      return pA.localeCompare(pB, undefined, { numeric: true, sensitivity: 'base' })
    }

    const sqA = String(a.squad || '').trim()
    const sqB = String(b.squad || '').trim()
    const idxA = SQUAD_ORDER_CANONICAL.indexOf(sqA)
    const idxB = SQUAD_ORDER_CANONICAL.indexOf(sqB)

    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
      return idxA - idxB
    }
    if (idxA !== -1 && idxB === -1) return -1
    if (idxA === -1 && idxB !== -1) return 1
    if (sqA !== sqB) {
      return sqA.localeCompare(sqB)
    }

    return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  })

  return sortedStudents.map(st => {
    const studentRecords = recordsList.filter(r => String(r.student_id) === String(st.id))

    let presentCount = 0
    let lateCount = 0
    let absentCount = 0
    const pillarStatusMap = {}

    ADMIN_PILLAR_COLUMNS.forEach((col, colIdx) => {
      const isOrientationCol = col.header.startsWith('Orientation')

      // 1. Check direct pillar & day match
      let rec = studentRecords.find(r => {
        const p = (r.pillar || '').toLowerCase().trim()
        const d = Number(r.day)
        const matchesPillar = col.pillarKeys.some(k => p.includes(k) || k.includes(p))
        if (isOrientationCol) {
          return matchesPillar && (d === 1 || d === 0 || !r.day)
        }
        return matchesPillar && d === col.day
      })

      // 2. Fallback to schedule_id match if present
      if (!rec && schedulesList && schedulesList.length > 0) {
        rec = studentRecords.find(r => {
          if (!r.schedule_id) return false
          const s = schedulesList.find(sched => String(sched.id) === String(r.schedule_id))
          if (!s) return false
          const stitle = (s.title || '').toLowerCase()
          const matchesPillar = col.pillarKeys.some(k => stitle.includes(k))
          if (isOrientationCol) {
            return matchesPillar || stitle.includes('orientation') || stitle.includes('bag check')
          }
          const matchesDay = stitle.includes(`day ${col.day}`) || stitle.includes(`day${col.day}`) || Number(s.day) === col.day
          return matchesPillar && matchesDay
        })
      }

      // 3. Fallback to positional schedule if schedules array is ordered
      if (!rec && schedulesList && schedulesList[colIdx]) {
        const s = schedulesList[colIdx]
        rec = studentRecords.find(r => String(r.schedule_id) === String(s.id))
      }

      let statusVal = '—'
      if (rec && rec.status) {
        const sLower = String(rec.status).toLowerCase().trim()
        if (sLower === 'present') {
          statusVal = 'Present'
          presentCount++
        } else if (sLower === 'late') {
          statusVal = 'Late'
          lateCount++
        } else if (sLower === 'absent') {
          statusVal = 'Absent'
          absentCount++
        } else {
          statusVal = rec.status
        }
      }

      pillarStatusMap[col.header] = statusVal
    })

    const totalMarked = presentCount + lateCount + absentCount
    const ratePct = totalMarked > 0 ? Math.round(((presentCount + lateCount) / totalMarked) * 100) : 0

    const rawPanel = String(st.panel || st.student_panel || st.user_panel || '').trim()
    let formattedPanel = 'Unassigned'
    if (rawPanel && rawPanel !== '—' && rawPanel !== 'null' && rawPanel !== 'undefined') {
      formattedPanel = rawPanel
    }

    return {
      'PRN / LTC ID': st.prn || '—',
      'Student Name': st.name || '—',
      'Squad': st.squad || 'Unassigned',
      'Panel': formattedPanel,
      'Division': st.division || '—',
      'Faculty': st.faculty || '—',
      'School': st.school || '—',
      'Department': st.department || '—',
      'Present Count': presentCount,
      'Late Count': lateCount,
      'Absent Count': absentCount,
      'Attendance Rate (%)': `${ratePct}%`,
      ...pillarStatusMap
    }
  })
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
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className={`modal modal-${size}`} style={{
        borderRadius: '24px',
        overflow: 'hidden',
        border: 'none',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff'
      }}>
        <div className="modal-header" style={{
          background: '#154388',
          borderBottom: 'none',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <h3 className="modal-title" style={{ fontSize: '17px', fontWeight: '850', color: '#ffffff', margin: 0 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} style={{
            border: 'none',
            padding: 6,
            background: 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          ><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
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

function BatchFormModal({ open, onClose, onSave, initial, token, batchesCount, defaultStatus, batches = [] }) {
  const [form, setForm] = useState({ name: "", location: "LTC Boribel", start_date: "", end_date: "", status: defaultStatus || "upcoming", description: "", batch_code: "", year: String(new Date().getFullYear()), capacity: "", class_grade: "" })

  useEffect(() => { 
    if (initial) {
      setForm({
        name: initial.name || "",
        location: initial.location || "LTC Boribel",
        start_date: initial.start_date || "",
        end_date: initial.end_date || "",
        status: initial.status || "upcoming",
        description: initial.description || "",
        batch_code: initial.batch_code || "",
        year: initial.year || String(new Date().getFullYear()),
        capacity: initial.capacity || "",
        class_grade: initial.class_grade || ""
      })
    } else { 
      const defaults = computeNextLapBatchInfo(batches, new Date());
      setForm({
        name: defaults.name,
        location: "LTC Boribel",
        start_date: "",
        end_date: "",
        status: defaultStatus || "upcoming",
        description: "",
        batch_code: defaults.batch_code,
        year: defaults.year,
        capacity: 350,
        class_grade: ""
      })
    } 
  }, [initial, open, batches, batchesCount, defaultStatus])

  // Automatically calculate LAP-BB-MMYY batch name, code and year based on start date
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

  const handleSaveClick = () => {
    onSave({ ...form })
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Batch' : 'Create New Batch'} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '48vh', overflowY: 'auto', paddingRight: '6px', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Batch Name *</label>
            <input className="input-field input-field-rect" placeholder="e.g. LAP-01-1026" value={form.name} disabled style={{ marginBottom: 0, background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Year *</label>
            <input type="number" className="input-field input-field-rect" placeholder="e.g. 2026" value={form.year} onChange={e => set('year', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Batch Code</label>
            <input className="input-field input-field-rect" placeholder="Auto-generated from date (e.g. 01-0726)" value={form.batch_code} disabled style={{ marginBottom: 0, background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Capacity (Max Students)</label>
            <input type="number" className="input-field input-field-rect" placeholder="Default: 350" value={form.capacity} onChange={e => set('capacity', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Start Date *</label>
            <input type="date" className="input-field input-field-rect" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>End Date *</label>
            <input type="date" className="input-field input-field-rect" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={{ marginBottom: 0 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Class / Standard</label>
            <select className="input-field input-field-rect" value={form.class_grade || ''} onChange={e => set('class_grade', e.target.value)} style={{ marginBottom: 0, borderRadius: 12 }}>
              <option value="">All / Any Class</option>
              <option value="6th">6th</option>
              <option value="7th">7th</option>
              <option value="8th">8th</option>
              <option value="9th">9th</option>
              <option value="10th">10th</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Status</label>
            <select className="input-field input-field-rect" value={normalizeStatus(form.status)} onChange={e => set('status', e.target.value)} style={{ marginBottom: 0, borderRadius: 12 }}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Description</label>
          <textarea className="input-field" placeholder="Optional notes about this batch..." value={form.description} onChange={e => set('description', e.target.value)} style={{ marginBottom: 0, minHeight: 60, borderRadius: 12 }} />
        </div>
      </div>
      <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, background: '#ffffff' }}>
        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={handleSaveClick} disabled={!form.name.trim() || !form.start_date || !form.end_date}>{initial ? 'Save Changes' : 'Create Batch'}</button>
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

// ─── Batch Students Tab ───────────────────────────────────────────────────────
function BatchStudentsTab({ batchId, batchName, token, toast, onRefresh }) {
  const [students, setStudents] = useState([])
  const [pagination, setPagination] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [jobProgress, setJobProgress] = useState(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [recordsToConfirm, setRecordsToConfirm] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [addSearch, setAddSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Life Awakening Filter States
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [roomViewFilter, setRoomViewFilter] = useState('')
  const [selectedSquadFilter, setSelectedSquadFilter] = useState('')

  // Inline Room Edit States for Overfilled Rooms
  const [editingRoomStudentId, setEditingRoomStudentId] = useState(null)
  const [editingRoomValue, setEditingRoomValue] = useState('')
  const [savingRoomStudentId, setSavingRoomStudentId] = useState(null)



  const handleSaveStudentRoom = async (studentId) => {
    if (!editingRoomValue || !editingRoomValue.trim()) {
      toast('Please enter a valid room number.', 'error')
      return
    }
    const cleanRoom = editingRoomValue.trim()
    if (cleanRoom.toLowerCase().includes('overfilled')) {
      toast('Please enter a valid room number, not Overfilled.', 'error')
      return
    }
    try {
      setSavingRoomStudentId(studentId)
      const res = await fetch(`${API}/api/admin/batches/${batchId}/students/${studentId}/room`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ room: cleanRoom })
      })
      const data = await res.json()
      if (res.ok) {
        toast('Room updated successfully.', 'success')
        setEditingRoomStudentId(null)
        fetchStudents(pagination.page || 1, search)
      } else {
        toast(data.message || 'Failed to update room.', 'error')
      }
    } catch (err) {
      toast('Error connecting to server.', 'error')
    } finally {
      setSavingRoomStudentId(null)
    }
  }

  // Dynamic school list from batch students
  const availableSchools = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      if (s.school && String(s.school).trim()) set.add(String(s.school).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students])

  const fetchStudents = useCallback(async (pg = 1, q = search) => {
    setLoading(true)
    try {
      let url = `${API}/api/admin/batches/${batchId}/students?page=${pg}&limit=50&search=${encodeURIComponent(q)}`
      if (selectedClass) url += `&class_grade=${encodeURIComponent(selectedClass)}`
      if (selectedSchool) url += `&school=${encodeURIComponent(selectedSchool)}`
      if (selectedSquadFilter) url += `&squad=${encodeURIComponent(selectedSquadFilter)}`
      if (roomViewFilter === 'boys') {
        url += `&gender=male&sortByRoom=true`
      } else if (roomViewFilter === 'girls') {
        url += `&gender=female&sortByRoom=true`
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) { setStudents(data.students); setPagination(data.pagination) }
    } finally { setLoading(false) }
  }, [batchId, token, search, selectedClass, selectedSchool, roomViewFilter, selectedSquadFilter])

  useEffect(() => { 
    fetchStudents(1, search) 
  }, [batchId, selectedClass, selectedSchool, roomViewFilter, selectedSquadFilter])

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
    if (onRefresh) onRefresh()
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
      toast('The uploaded file is empty or invalid.', 'error');
      return;
    }
    const normalized = records.map(raw => {
      const r = {};
      for (const key in raw) {
        r[key.replace(/^\uFEFF/, '').toLowerCase().trim()] = String(raw[key] || '').trim();
      }
      return {
        name: r.name || r['full name'] || r.username || '—',
        email: r.email || '—',
        prn: r.prn || r['student id'] || r.student_id || r.faculty_id || r['faculty id'] || r.id || '—',
        role: r.role || 'student',
        department: r.department || r.dept || '—'
      };
    });
    setRecordsToConfirm(normalized);
    setShowConfirmModal(true);
  };

  const handleLinkConfirm = async () => {
    setShowConfirmModal(false);
    setUploading(true);
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/enroll-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records: recordsToConfirm })
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.message || 'Linking failed.', 'error');
        return;
      }

      const parts = [];
      if (data.enrolled > 0)       parts.push(`${data.enrolled} enrolled`);
      if (data.alreadyInBatch > 0) parts.push(`${data.alreadyInBatch} already in batch`);
      if (data.notFound > 0)       parts.push(`${data.notFound} not found in database`);

      const type = data.notFound > 0 ? 'warning' : 'success';
      toast(parts.join(' · ') || 'No changes made.', type);
      fetchStudents(1, search);
      if (onRefresh) onRefresh()
    } catch (err) {
      toast('Network error during upload.', 'error');
    } finally {
      setUploading(false);
      setRecordsToConfirm([]);
    }
  };

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
      <style>{`
        .bs-search-input:focus {
          border-color: #154388 !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(21,67,136,0.08) !important;
          outline: none;
        }
        .bs-filter-select {
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px !important;
        }
        .bs-filter-select:focus {
          border-color: #154388 !important;
          background-color: #fff !important;
          box-shadow: 0 0 0 3px rgba(21,67,136,0.08) !important;
          outline: none;
        }
        .bs-filter-select:disabled { opacity: 0.45; cursor: not-allowed; }
        .bs-row:hover { background: #f8fafc !important; }
        .bs-remove-btn { opacity: 0; transition: opacity 0.15s; }
        .bs-row:hover .bs-remove-btn { opacity: 1; }
        /* Responsive column hiding */
        @media (max-width: 900px) {
          .bs-col-email { display: none !important; }
          .bs-col-school { display: none !important; }
        }
        @media (max-width: 640px) {
          .bs-col-ltcid { display: none !important; }
          .bs-col-nri { display: none !important; }
        }
      `}</style>

      {/* ── Filters Toolbar ── */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          marginBottom: '18px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '2 1 220px', minWidth: '180px' }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search by name, email or PRN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bs-search-input"
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '10px',
              color: '#0f172a',
              transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Class Filter */}
        <select
          className="bs-filter-select"
          style={{
            padding: '9px 28px 9px 12px',
            fontSize: '13px',
            backgroundColor: selectedClass ? '#fff7ed' : '#f8fafc',
            border: `1.5px solid ${selectedClass ? '#ea580c' : '#e2e8f0'}`,
            borderRadius: '10px',
            color: selectedClass ? '#c2410c' : '#64748b',
            fontWeight: selectedClass ? '600' : '400',
            flex: '1 1 120px',
            minWidth: '110px',
            cursor: 'pointer'
          }}
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="">All Classes</option>
          <option value="6th">Class 6th</option>
          <option value="7th">Class 7th</option>
          <option value="8th">Class 8th</option>
          <option value="9th">Class 9th</option>
          <option value="10th">Class 10th</option>
        </select>

        {/* School Filter */}
        <select
          className="bs-filter-select"
          style={{
            padding: '9px 28px 9px 12px',
            fontSize: '13px',
            backgroundColor: selectedSchool ? '#fff7ed' : '#f8fafc',
            border: `1.5px solid ${selectedSchool ? '#ea580c' : '#e2e8f0'}`,
            borderRadius: '10px',
            color: selectedSchool ? '#c2410c' : '#64748b',
            fontWeight: selectedSchool ? '600' : '400',
            flex: '1 1 130px',
            minWidth: '120px',
            cursor: 'pointer'
          }}
          value={selectedSchool}
          onChange={e => setSelectedSchool(e.target.value)}
        >
          <option value="">All Schools</option>
          {availableSchools.map(sch => (
            <option key={sch} value={sch}>{sch}</option>
          ))}
        </select>

        {/* Squad Filter */}
        <select
          className="bs-filter-select"
          style={{
            padding: '9px 28px 9px 12px',
            fontSize: '13px',
            backgroundColor: '#f8fafc',
            border: `1.5px solid ${selectedSquadFilter ? '#154388' : '#e2e8f0'}`,
            borderRadius: '10px',
            color: selectedSquadFilter ? '#154388' : '#64748b',
            fontWeight: selectedSquadFilter ? '600' : '400',
            flex: '1 1 110px',
            minWidth: '100px',
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          value={selectedSquadFilter}
          onChange={e => setSelectedSquadFilter(e.target.value)}
        >
          <option value="">All Squads</option>
          {SQUAD_NAMES.map(sq => (
            <option key={sq} value={sq}>{sq}</option>
          ))}
        </select>

        {/* Room View Filter */}
        <select
          className="bs-filter-select"
          style={{
            padding: '9px 28px 9px 12px',
            fontSize: '13px',
            backgroundColor: '#f8fafc',
            border: `1.5px solid ${roomViewFilter ? '#154388' : '#e2e8f0'}`,
            borderRadius: '10px',
            color: roomViewFilter ? '#154388' : '#64748b',
            fontWeight: roomViewFilter ? '700' : '500',
            flex: '1 1 140px',
            minWidth: '130px',
            cursor: 'pointer',
            transition: 'border-color 0.2s'
          }}
          value={roomViewFilter}
          onChange={e => setRoomViewFilter(e.target.value)}
        >
          <option value="">Default View</option>
          <option value="boys">Boys Rooms</option>
          <option value="girls">Girls Rooms</option>
        </select>

        <button 
          className="btn" 
          onClick={() => setShowAddModal(true)}
          style={{ background: '#154388', color: '#ffffff', borderRadius: '10px', fontWeight: '600', padding: '8px 14px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
        >
          <Plus size={14} /> Assign Student
        </button>
        <label 
          className="btn btn-outline" 
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', fontWeight: '600' }}
        >
          <Upload size={14} /> {uploading ? 'Linking…' : 'Link to this batch'}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkUpload} style={{ display: 'none' }} />
        </label>
        <button 
          className="btn btn-outline" 
          onClick={handleExport}
          disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', fontWeight: '600', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1 }}
        >
          {exporting ? <><div className="spinner spinner-sm" style={{ width: 14, height: 14 }} /> Exporting…</> : <><Download size={14} /> Export</>}
        </button>
        <button 
          className="btn btn-outline" 
          onClick={() => fetchStudents(page, search)}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Student List ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '480px' }}>
            {/* ── Header ── */}
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {/* # */}
                <th style={{ padding: '11px 12px 11px 20px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', width: '40px' }}>#</th>
                {/* Name */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Student</th>
                {/* Student ID */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Student ID</th>
                {/* Class */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Class</th>
                {/* School & Branch */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>School & Branch</th>
                {/* Roll No */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Roll No.</th>
                {/* Parent Contact */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Parent Contact</th>
                {/* Squad */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Squad</th>
                {/* Room */}
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Room</th>
                {/* Actions */}
                <th style={{ padding: '11px 20px 11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', textAlign: 'right', width: '80px' }}></th>
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10}>
                    <div style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="spinner spinner-sm" />
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div style={{ padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#f0f7ff', color: '#154388', width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <GraduationCap size={20} />
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: '500', margin: 0 }}>No students match your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((s, idx) => (
                  <tr
                    key={s.id}
                    className="bs-row"
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                  >
                    {/* Row number */}
                    <td style={{ padding: '10px 12px 10px 20px', fontSize: '12px', color: '#cbd5e1', fontWeight: '500', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {((page - 1) * 50) + idx + 1}
                    </td>

                    {/* Name + flag */}
                    <td style={{ padding: '10px 12px', minWidth: '140px', maxWidth: '210px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name}
                      </div>
                      {s.red_flag && (
                        <span style={{ display: 'inline-block', marginTop: '2px', fontSize: '9px', fontWeight: '700', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Flagged
                        </span>
                      )}
                    </td>

                    {/* Student ID */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: '750', fontSize: '12px', color: '#154388', background: '#f0f7ff', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '5px' }}>
                        {s.student_id || `LA-${String(s.id).padStart(5, '0')}`}
                      </span>
                    </td>

                    {/* Class */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
                      {s.class_grade || '—'}
                    </td>

                    {/* School & Branch */}
                    <td style={{ padding: '10px 12px', maxWidth: '200px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.school || '—'}</div>
                      {s.school_branch && <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.school_branch}</div>}
                    </td>

                    {/* Roll No */}
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                      {s.roll_number || s.prn || '—'}
                    </td>

                    {/* Parent Contact */}
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {s.parent_mobile || s.phone || s.parent_email || '—'}
                    </td>

                    {/* Squad */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {s.squad ? (
                        <span style={{
                          display: 'inline-block',
                          background: (SQUAD_COLORS[s.squad] ? SQUAD_COLORS[s.squad] + '1a' : '#eff6ff'),
                          color: SQUAD_COLORS[s.squad] || '#2563eb',
                          border: `1px solid ${SQUAD_COLORS[s.squad] ? SQUAD_COLORS[s.squad] + '44' : '#bfdbfe'}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '11px',
                          letterSpacing: '0.2px'
                        }}>
                          {s.squad}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>
                      )}
                    </td>

                    {/* Room */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', fontWeight: 600, color: s.room ? '#334155' : '#cbd5e1', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const isOverfilled = s.room && String(s.room).toLowerCase().includes('overfilled')
                        const userObj = JSON.parse(localStorage.getItem('user') || '{}')
                        const isReadOnly = userObj.role === 'superadmin_readonly' || userObj.role === 'read_only_superadmin'

                        if (editingRoomStudentId === s.id && !isReadOnly) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                placeholder="e.g. Sinhgad-015"
                                value={editingRoomValue}
                                onChange={e => setEditingRoomValue(e.target.value)}
                                style={{
                                  width: '130px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  border: '1.5px solid #224283',
                                  borderRadius: '6px',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveStudentRoom(s.id)
                                  if (e.key === 'Escape') setEditingRoomStudentId(null)
                                }}
                              />
                              <button
                                onClick={() => handleSaveStudentRoom(s.id)}
                                disabled={savingRoomStudentId === s.id}
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                {savingRoomStudentId === s.id ? '...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingRoomStudentId(null)}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          )
                        }

                        if (isOverfilled) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fee2e2',
                                color: '#991b1b',
                                border: '1px solid #fca5a5',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}>
                                Overfilled
                              </span>
                              {!isReadOnly && (
                                <button
                                  onClick={() => {
                                    setEditingRoomStudentId(s.id)
                                    setEditingRoomValue('')
                                  }}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    color: '#224283',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '3px 8px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                  }}
                                  title="Edit Room"
                                >
                                  <Edit2 size={11} /> Edit
                                </button>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{s.room || '—'}</span>
                            {!isReadOnly && (
                              <button
                                onClick={() => {
                                  setEditingRoomStudentId(s.id)
                                  setEditingRoomValue(s.room || '')
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#64748b',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '2px 4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  borderRadius: '4px'
                                }}
                                className="hover:bg-slate-100 hover:text-slate-900"
                                title="Edit Room Assignment"
                              >
                                <Edit2 size={11} />
                              </button>
                            )}
                          </div>
                        )
                      })()}
                    </td>



                    {/* Actions */}
                    <td style={{ padding: '10px 20px 10px 12px', textAlign: 'right' }}>
                      <button
                        className="bs-remove-btn"
                        style={{
                          background: 'transparent',
                          border: '1px solid #fecaca',
                          borderRadius: '7px',
                          color: '#f87171',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s, color 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f87171'; }}
                        onClick={() => handleRemove(s.id)}
                      >
                        <UserX size={11} /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        {!loading && students.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              Showing <strong style={{ color: '#475569' }}>{students.length}</strong> students on this page
            </span>
            {pagination && (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Page <strong style={{ color: '#475569' }}>{pagination.page}</strong> of <strong style={{ color: '#475569' }}>{pagination.totalPages}</strong>
              </span>
            )}
          </div>
        )}
      </div>
      <Pagination pagination={pagination} onPageChange={p => { setPage(p); fetchStudents(p, search) }} />

      <Modal open={showProgressModal} onClose={() => {
        if (jobProgress && (jobProgress.status === 'completed' || jobProgress.status === 'failed')) {
          setShowProgressModal(false);
          setJobProgress(null);
        }
      }} title="Bulk Upload Progress" size="lg">
        {jobProgress ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                {jobProgress.status === 'processing' ? 'Processing records...' :
                 jobProgress.status === 'completed' ? 'Upload Completed!' :
                 jobProgress.status === 'failed' ? 'Upload Failed' : 'Initializing...'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {jobProgress.processed_records} / {jobProgress.total_records}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${jobProgress.total_records > 0 ? (jobProgress.processed_records / jobProgress.total_records) * 100 : 0}%`,
                height: '100%',
                background: jobProgress.status === 'failed' ? 'var(--danger)' : 'var(--primary)',
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Stats Counter */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#f1f5f9', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{jobProgress.success_count}</div>
                <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>Success</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #f1f5f9', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{jobProgress.failed_count}</div>
                <div style={{ fontSize: 12, color: '#000000', fontWeight: 600 }}>Failed</div>
              </div>
            </div>

            {/* Errors List */}
            {jobProgress.errors && jobProgress.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Row-level Errors / Warnings ({jobProgress.errors.length})</h4>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                  <table className="data-table data-table-compact" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Row Target</th>
                        <th>Error Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobProgress.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, fontSize: 12 }}><code style={{ background: '#e2e8f0', padding: '2px 4px', borderRadius: 4 }}>{err.row}</code></td>
                          <td style={{ color: 'var(--danger)', fontSize: 12 }}>{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Controls */}
            {(jobProgress.status === 'completed' || jobProgress.status === 'failed') && (
              <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => {
                  setShowProgressModal(false);
                  setJobProgress(null);
                  fetchStudents(1, search);
                }}>Done</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 12 }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-3)', fontSize: 14, fontWeight: 600 }}>Uploading & parsing file...</span>
          </div>
        )}
      </Modal>

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

      <AssignStudentsModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        batchId={batchId}
        batchName={batchName}
        token={token}
        toast={toast}
        onDone={() => {
          fetchStudents(page, search)
          if (onRefresh) onRefresh()
        }}
      />

    </div>
  )
}

// ─── Batch Faculty Sub-Tab (role-specific) ───────────────────────────────────
function BatchFacultySubTab({ batchId, token, toast, roleFilter, onRefresh, compact = false }) {
  const [faculty, setFaculty] = useState([])
  const [allFaculty, setAllFaculty] = useState([])
  const [search, setSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedSquadFilter, setSelectedSquadFilter] = useState('')

  // Bulk Upload States
  const fileInputRef = useRef(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkData, setBulkData] = useState({ matched: [], unmatched: [] })
  const [assigningBulk, setAssigningBulk] = useState(false)

  const roleLabel = roleFilter === 'faculty' ? 'MIT Faculty' : 'LTC Faculty'
  const roleColor = roleFilter === 'faculty' ? '#16a34a' : '#7c3aed'
  const roleBg = roleFilter === 'faculty' ? '#f0fdf4' : '#f5f3ff'
  // Cascading Selector States
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const availableDivisions = useMemo(() => Object.keys(OFFICIAL_HIERARCHY), [])
  const availableFaculties = useMemo(() => {
    if (!selectedDivision) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision] || {})
  }, [selectedDivision])
  const availableSchools = useMemo(() => {
    if (!selectedDivision || !selectedFaculty) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty] || {})
  }, [selectedDivision, selectedFaculty])
  const availableDepartments = useMemo(() => {
    if (!selectedDivision || !selectedFaculty || !selectedSchool) return []
    return OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty]?.[selectedSchool] || []
  }, [selectedDivision, selectedFaculty, selectedSchool])

  const fetchFaculty = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty?role=${roleFilter}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setFaculty(data.faculty)
    } finally { setLoading(false) }
  }, [batchId, token, roleFilter])

  const fetchAll = async () => {
    let url = `${API}/api/admin/faculty-list?role=${roleFilter}&limit=200&search=${encodeURIComponent(addSearch)}`
    if (selectedDivision) url += `&division=${encodeURIComponent(selectedDivision)}`
    if (selectedFaculty) url += `&faculty=${encodeURIComponent(selectedFaculty)}`
    if (selectedSchool) url += `&school=${encodeURIComponent(selectedSchool)}`
    if (selectedDepartment) url += `&department=${encodeURIComponent(selectedDepartment)}`

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) setAllFaculty(data.faculty)
  }

  useEffect(() => { fetchFaculty() }, [batchId, roleFilter])
  useEffect(() => { if (showAddModal) fetchAll() }, [showAddModal, addSearch, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment])
  useEffect(() => { 
    if (showAddModal) fetchAll() 
  }, [showAddModal, addSearch, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment])

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
          toast(data.message || `${roleLabel} added to batch.`, 'success')
        }
      } else {
        toast(data.message || `Failed to add ${roleLabel}.`, 'error')
      }
      fetchFaculty()
      if (onRefresh) onRefresh()
    } catch (e) {
      toast('Network error.', 'error')
    }
  }

  const handleRemove = async (fid) => {
    if (!window.confirm(`Remove this ${roleLabel} from batch? Master record preserved.`)) return
    await fetch(`${API}/api/admin/batches/${batchId}/faculty/${fid}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    toast(`${roleLabel} removed from batch.`, 'success')
    fetchFaculty()
    if (onRefresh) onRefresh()
  }

  const handleAddAll = async () => {
    if (roleFilter !== 'ltc_member') return
    if (!window.confirm('Add ALL LTC Members from the system to this batch? Members already in batch will be skipped.')) return
    try {
      console.log('handleAddAll: Fetching LTC Members list...');
      const res = await fetch(`${API}/api/admin/faculty-list?role=ltc_member&limit=500`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) {
        console.error('handleAddAll: Fetching failed:', data)
        toast(data.message || 'Failed to fetch LTC Members.', 'error')
        return
      }
      
      const allIds = (data.faculty || []).map(f => f.id)
      console.log('handleAddAll: Found LTC Member IDs:', allIds)
      if (allIds.length === 0) {
        toast('No LTC Members found in the system.', 'warning')
        return
      }

      console.log(`handleAddAll: Assigning ${allIds.length} LTC Members to batch ${batchId}...`)
      const addRes = await fetch(`${API}/api/admin/batches/${batchId}/faculty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ faculty_ids: allIds })
      })
      const addData = await addRes.json()
      
      if (!addRes.ok) {
        console.error('handleAddAll: Assignment failed:', addData)
        toast(addData.message || 'Failed to add LTC Members to batch.', 'error')
        return
      }

      console.log('handleAddAll: Assignment successful:', addData)
      toast(addData.message || `${allIds.length} LTC Members added to batch.`, 'success')
      fetchFaculty()
      if (onRefresh) onRefresh()
    } catch (e) {
      console.error('handleAddAll: Exception occurred:', e)
      toast('Error adding LTC Members.', 'error')
    }
  }

  const handleBulkFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const parse = (data) => {
      const emails = data.map(raw => {
        for (const key in raw) {
          const cleanKey = key.replace(/^\uFEFF/, '').toLowerCase().trim()
          if (
            cleanKey === 'email' ||
            cleanKey.includes('email') ||
            cleanKey.includes('e-mail') ||
            cleanKey === 'mail' ||
            cleanKey === 'mail id' ||
            cleanKey === 'username'
          ) {
            const val = String(raw[key] || '').trim()
            if (val) return val
          }
        }
        return ''
      }).filter(Boolean)

      if (emails.length === 0) {
        toast('No emails found in the file.', 'error')
        return
      }

      verifyEmails(emails)
    }

    const { name } = file
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

  const verifyEmails = async (emails) => {
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty/bulk-verify?role=${roleFilter}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emails })
      })
      const d = await res.json()
      if (res.ok) {
        setBulkData(d)
        setShowBulkModal(true)
      } else {
        toast(d.message || 'Verification failed.', 'error')
      }
    } catch {
      toast('Network error during verification.', 'error')
    }
  }

  const handleConfirmBulkAssign = async () => {
    if (bulkData.matched.length === 0) return
    setAssigningBulk(true)
    try {
      const facultyIds = bulkData.matched.map(f => f.id)
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ faculty_ids: facultyIds })
      })
      const data = await res.json()
      if (res.ok) {
        toast(data.message || 'Faculty assigned successfully.', 'success')
        fetchFaculty()
        setShowBulkModal(false)
        if (onRefresh) onRefresh()
      } else {
        toast(data.message || 'Bulk assignment failed.', 'error')
      }
    } catch {
      toast('Network error during assignment.', 'error')
    } finally {
      setAssigningBulk(false)
    }
  }

  const inBatch = useMemo(() => new Set(faculty.map(f => f.id)), [faculty])
  // For the popup: map id → squad so we can show squad status
  const batchSquadMap = useMemo(() => {
    const m = new Map()
    faculty.forEach(f => m.set(f.id, f.squad || null))
    return m
  }, [faculty])
  const filtered = useMemo(() => faculty.filter(f => {
    const matchesSearch = !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.email.toLowerCase().includes(search.toLowerCase())
    const matchesSquad = !selectedSquadFilter || f.squad === selectedSquadFilter
    return matchesSearch && matchesSquad
  }), [faculty, search, selectedSquadFilter])

  /* ── Controls: search + squad filter + action buttons ── */
  const controlBar = (
    <div
      className="fac-ctrl-bar"
      style={{
        background: compact ? 'transparent' : '#ffffff',
        borderRadius: compact ? 0 : '16px',
        padding: compact ? '12px 16px' : '16px 20px',
        border: compact ? 'none' : '1px solid #e2e8f0',
        borderBottom: compact ? '1px solid #f1f5f9' : undefined,
        boxShadow: compact ? 'none' : '0 1px 3px rgba(0,0,0,0.01)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={`Search ${roleLabel}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#0f172a'
            }}
          />
        </div>
        <select
          className="filter-select"
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            outline: 'none',
            color: '#475569',
            flex: '1 1 120px',
            cursor: 'pointer'
          }}
          value={selectedSquadFilter}
          onChange={e => setSelectedSquadFilter(e.target.value)}
        >
          <option value="">All Squads</option>
          {SQUAD_NAMES.map(sq => (
            <option key={sq} value={sq}>{sq}</option>
          ))}
        </select>
        {roleFilter === 'ltc_member' && (
          <button
            className="btn"
            style={{ background: '#5b21b6', color: '#ffffff', borderRadius: '10px', fontWeight: '600', padding: '8px 14px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
            onClick={handleAddAll}
          >
            <UserCheck size={14} /> Add All LTC Members
          </button>
        )}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept=".csv,.xlsx,.xls" 
          onChange={handleBulkFileChange} 
        />
        <button 
          className="btn btn-outline" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
          onClick={() => fileInputRef.current.click()}
        >
          <Upload size={14} /> Bulk Upload Faculty
        </button>
        <button 
          className="btn" 
          style={{ background: roleColor, color: '#ffffff', borderRadius: '10px', fontWeight: '600', padding: '8px 14px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} /> Assign {roleLabel}
        </button>
        <button 
          className="btn btn-outline" 
          onClick={fetchFaculty}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', color: '#475569', cursor: 'pointer' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>
  )


  /* ── Faculty / LTC Members list table ── */
  const tableSection = (
    <div style={{
      background: '#ffffff',
      borderRadius: compact ? 0 : '16px',
      border: compact ? 'none' : '1px solid #e2e8f0',
      boxShadow: compact ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      flex: compact ? '1 1 0' : undefined,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      marginBottom: compact ? 0 : '20px',
    }}>
        <div style={{ overflowX: 'auto', overflowY: compact ? 'auto' : 'visible', flex: compact ? '1 1 0' : undefined, minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '440px' }}>
            {/* ── Header ── */}
            <thead style={{ position: compact ? 'sticky' : undefined, top: compact ? 0 : undefined, zIndex: compact ? 1 : undefined }}>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '11px 12px 11px 20px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#94a3b8', width: '40px' }}>#</th>
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Name</th>
                <th className="fac-col-email" style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Email</th>
                <th className="fac-col-dept" style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Department</th>
                <th className="fac-col-panel" style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Panel</th>
                <th style={{ padding: '11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>Squad</th>
                <th style={{ padding: '11px 20px 11px 12px', fontSize: '10.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b', textAlign: 'right', width: '80px' }}></th>
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="spinner spinner-sm" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div style={{ padding: '56px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#f0f7ff', color: roleColor, width: '46px', height: '46px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} />
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: '500', margin: 0 }}>No {roleLabel} assigned to this batch yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((f, idx) => (
                  <tr
                    key={f.id}
                    className="fac-row"
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                  >
                    {/* Row number */}
                    <td style={{ padding: '10px 12px 10px 20px', fontSize: '12px', color: '#cbd5e1', fontWeight: '500', userSelect: 'none', whiteSpace: 'nowrap' }}>
                      {idx + 1}
                    </td>

                    {/* Name + role badge */}
                    <td style={{ padding: '10px 12px', minWidth: '140px', maxWidth: '220px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                        <span>{f.name}</span>
                        {f.role === 'superadmin_readonly' && (
                          <span style={{ fontSize: '9.5px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '4px', fontWeight: '800', border: '1px solid #fde68a' }}>
                            Read-Only Super Admin
                          </span>
                        )}
                      </div>
                      {f.designation && (
                        <span style={{ display: 'inline-block', marginTop: '2px', fontSize: '9.5px', fontWeight: '700', background: roleBg, color: roleColor, padding: '0px 5px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          {f.designation}
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="fac-col-email" style={{ padding: '10px 12px', fontSize: '12.5px', color: '#64748b', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.email || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>

                    {/* Department */}
                    <td className="fac-col-dept" style={{ padding: '10px 12px', fontSize: '12.5px', color: '#475569', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.department || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>

                    {/* Panel */}
                    <td className="fac-col-panel" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {f.panel ? (
                        <span style={{ display: 'inline-block', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          {f.panel}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '13px' }}>—</span>
                      )}
                    </td>

                    {/* Squad */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {f.squad ? (
                        <span style={{
                          display: 'inline-block',
                          background: SQUAD_COLORS[f.squad] ? SQUAD_COLORS[f.squad] + '1a' : '#eff6ff',
                          color: SQUAD_COLORS[f.squad] || '#2563eb',
                          border: `1px solid ${SQUAD_COLORS[f.squad] ? SQUAD_COLORS[f.squad] + '44' : '#bfdbfe'}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '11px',
                          letterSpacing: '0.2px'
                        }}>
                          {f.squad}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#94a3b8', padding: '2px 7px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '500' }}>Spare</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 20px 10px 12px', textAlign: 'right' }}>
                      <button
                        className="fac-remove-btn"
                        style={{
                          background: 'transparent',
                          border: '1px solid #fecaca',
                          borderRadius: '7px',
                          color: '#f87171',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s, color 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f87171'; }}
                        onClick={() => handleRemove(f.id)}
                      >
                        <UserX size={11} /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              <strong style={{ color: '#475569' }}>{filtered.length}</strong> {roleLabel}{filtered.length === 1 ? '' : 's'} assigned
            </span>
            <span style={{ display: 'inline-block', background: roleBg, color: roleColor, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              {roleLabel}
            </span>
          </div>
        )}
      </div>
  )


  return (
    <>
      <style>{`
        .fac-row:hover { background: #f8fafc !important; }
        .fac-remove-btn { opacity: 0; transition: opacity 0.15s; }
        .fac-row:hover .fac-remove-btn { opacity: 1; }
        @media (max-width: 900px) {
          .fac-col-email { display: none !important; }
          .fac-col-dept { display: none !important; }
        }
        @media (max-width: 640px) {
          .fac-col-panel { display: none !important; }
        }
      `}</style>

      {compact ? (
        /* In compact/card mode: controls are a sticky header, table fills remaining height */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>
          {controlBar}
          {tableSection}
        </div>
      ) : (
        /* Standalone mode: both sections are independent boxed cards */
        <>
          {controlBar}
          {tableSection}
        </>
      )}

      <Modal open={showAddModal} onClose={() => {
        setShowAddModal(false)
        setAddSearch('')
        setSelectedDivision('')
        setSelectedFaculty('')
        setSelectedSchool('')
        setSelectedDepartment('')
      }} title={`Assign ${roleLabel} to Batch`} size="lg">
        {/* Search bar — always shown */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-wrapper" style={{ margin: 0, flex: '1 1 260px' }}>
            <Search className="search-icon" size={16} />
            <input className="input-field" placeholder={`Search by name or email…`} value={addSearch} onChange={e => setAddSearch(e.target.value)} style={{ marginBottom: 0 }} />
          </div>

          {/* Academic hierarchy filters — only for MIT Faculty */}
          {roleFilter !== 'ltc_member' && (<>
            <select
              className="input-field filter-select"
              style={{ flex: '1 1 120px', marginBottom: 0, padding: '6px 12px', fontSize: 13 }}
              value={selectedDivision}
              onChange={e => {
                setSelectedDivision(e.target.value)
                setSelectedFaculty('')
                setSelectedSchool('')
                setSelectedDepartment('')
              }}
            >
              <option value="">All Divisions</option>
              {availableDivisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
            <select
              className="input-field filter-select"
              style={{ flex: '1 1 120px', marginBottom: 0, padding: '6px 12px', fontSize: 13 }}
              value={selectedFaculty}
              onChange={e => {
                setSelectedFaculty(e.target.value)
                setSelectedSchool('')
                setSelectedDepartment('')
              }}
              disabled={!selectedDivision}
            >
              <option value="">All Faculties</option>
              {availableFaculties.map(fac => (
                <option key={fac} value={fac}>{fac}</option>
              ))}
            </select>
            <select
              className="input-field filter-select"
              style={{ flex: '1 1 120px', marginBottom: 0, padding: '6px 12px', fontSize: 13 }}
              value={selectedSchool}
              onChange={e => {
                setSelectedSchool(e.target.value)
                setSelectedDepartment('')
              }}
              disabled={!selectedFaculty}
            >
              <option value="">All Schools</option>
              {availableSchools.map(sch => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>
            <select
              className="input-field filter-select"
              style={{ flex: '1 1 120px', marginBottom: 0, padding: '6px 12px', fontSize: 13 }}
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              disabled={!selectedSchool}
            >
              <option value="">All Depts</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </>)}
        </div>

        <div className="table-wrapper" style={{ marginTop: 8, maxHeight: '420px', overflowY: 'auto' }}>
          {roleFilter === 'ltc_member' ? (
            /* ── LTC Member view: Name / Designation / Batch Status / Action ── */
            <table className="data-table data-table-compact">
              <thead><tr><th>Name</th><th>Designation</th><th>Status in Batch</th><th>Action</th></tr></thead>
              <tbody>
                {allFaculty.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '24px 0' }}>No LTC Members found.</td></tr>
                ) : allFaculty.map(f => {
                  const inB = inBatch.has(f.id)
                  const sq = batchSquadMap.get(f.id)
                  return (
                    <tr key={f.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{f.email}</div>
                      </td>
                      <td>
                        {f.designation
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '2px 7px', borderRadius: 5 }}>{f.designation}</span>
                          : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {inB
                          ? sq
                            ? <span className="badge" style={{ background: (SQUAD_COLORS[sq] + '22'), color: SQUAD_COLORS[sq] || '#154388', fontSize: 11 }}>{sq}</span>
                            : <span className="badge badge-gray" style={{ fontSize: 11 }}>Spare</span>
                          : <span style={{ color: 'var(--text-4)', fontSize: 12 }}>Not Added</span>}
                      </td>
                      <td>
                        {inB
                          ? <span className="badge badge-blue"><CheckCircle size={10} /> Added</span>
                          : <button className="btn btn-sm" style={{ background: roleColor, borderColor: roleColor }} onClick={() => handleAdd(f.id)}><Plus size={12} /> Add</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            /* ── MIT Faculty view: Name / Department / Panel / Action ── */
            <table className="data-table data-table-compact">
              <thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Panel</th><th>Action</th></tr></thead>
              <tbody>
                {allFaculty.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '24px 0' }}>No {roleLabel} found in master database.</td></tr>
                ) : allFaculty.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{f.email}</div>
                    </td>
                    <td style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{f.designation || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{f.department || '—'}</td>
                    <td>{f.panel ? <span className="badge badge-blue">{f.panel}</span> : '—'}</td>
                    <td>
                      {inBatch.has(f.id)
                        ? <span className="badge badge-blue"><CheckCircle size={10} /> Added</span>
                        : <button className="btn btn-sm" style={{ background: roleColor, borderColor: roleColor }} onClick={() => handleAdd(f.id)}><Plus size={12} /> Add</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      <Modal open={showBulkModal} onClose={() => setShowBulkModal(false)} title="Confirm Bulk Assignment" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13.5, color: '#334155', margin: 0 }}>
            Found the faculty in the faculty bulk list. Do you want to add them to this batch?
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 14, borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a' }}>{bulkData.matched.length}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#14532d', marginTop: 4 }}>Matched (To Assign)</div>
            </div>
            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: 14, borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>{bulkData.unmatched.length}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7f1d1d', marginTop: 4 }}>Unmatched (To Skip)</div>
            </div>
          </div>

          {bulkData.matched.length > 0 && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>Matched Faculty Details</h4>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table className="data-table data-table-compact" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.matched.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 700 }}>{f.name}</td>
                        <td>{f.email}</td>
                        <td>{f.department || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bulkData.unmatched.length > 0 && (
            <div>
              <h4 style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', marginBottom: 8 }}>Unmatched Emails (Will be Skipped)</h4>
              <div style={{ maxHeight: 120, overflowY: 'auto', background: '#fff1f1', border: '1px solid #fee2e2', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {bulkData.unmatched.map((e, idx) => (
                    <span key={idx} style={{ background: '#ffffff', color: '#991b1b', padding: '3px 8px', borderRadius: 6, fontSize: 11, border: '1px solid #fecaca', fontWeight: 600 }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setShowBulkModal(false)}>Cancel</button>
            <button 
              className="btn" 
              onClick={handleConfirmBulkAssign} 
              disabled={assigningBulk || bulkData.matched.length === 0}
              style={{ background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {assigningBulk ? <div className="spinner spinner-sm" /> : <CheckCircle size={14} />} Yes, Add to Batch
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

// ─── Batch Faculty Tab (MIT + LTC side-by-side) ──────────────────────────────
function BatchFacultyTab({ batchId, token, toast, onRefresh }) {
  const [mobileTab, setMobileTab] = useState('faculty')

  return (
    <div>
      <style>{`
        /* ── Faculty Tab responsive layout ─────────────────────────── */

        /* Shared card chrome */
        .fac-card {
          display: flex;
          flex-direction: column;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          min-height: 0;
        }

        /* Card inner: fills flex height, makes sub-tab scroll */
        .fac-card-inner {
          display: flex;
          flex-direction: column;
          flex: 1 1 0;
          min-height: 0;
          overflow: hidden;
        }

        /* Desktop (≥1024px): equal-height side-by-side, cards capped at viewport-safe height */
        @media (min-width: 1024px) {
          .faculty-split-row {
            display: flex;
            gap: 20px;
            align-items: stretch;
          }
          .faculty-col-wrap {
            flex: 1 1 0;
            min-width: 0;
            display: flex;
            flex-direction: column;
            height: calc(100vh - 220px);
            min-height: 450px;
          }
          .fac-mobile-tabs { display: none !important; }
          .fac-section-header { display: flex !important; }
        }

        /* Tablet (768px – 1023px): 2-col if space, else stack */
        @media (min-width: 768px) and (max-width: 1023px) {
          .faculty-split-row {
            display: flex;
            gap: 16px;
            align-items: stretch;
            flex-wrap: wrap;
          }
          .faculty-col-wrap {
            flex: 1 1 320px;
            min-width: 280px;
            display: flex;
            flex-direction: column;
            height: 70vh;
            min-height: 400px;
          }
          .fac-mobile-tabs { display: none !important; }
          .fac-section-header { display: flex !important; }
        }

        /* Mobile (<768px): tab-switch UI, single panel visible */
        @media (max-width: 767px) {
          .faculty-split-row {
            display: block;
          }
          .faculty-col-wrap {
            display: flex;
            flex-direction: column;
            height: 75vh;
            min-height: 350px;
          }
          .faculty-col-wrap.fac-hidden {
            display: none !important;
          }
          .fac-section-header { display: none !important; }
          .fac-mobile-tabs {
            display: flex !important;
            gap: 0;
            margin-bottom: 16px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
          }
          .fac-mobile-tab-btn {
            flex: 1;
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            background: transparent;
            color: #64748b;
            transition: background 0.15s, color 0.15s;
            min-height: 48px;
          }
          .fac-mobile-tab-btn.active-mit {
            background: #f0fdf4;
            color: #15803d;
          }
          .fac-mobile-tab-btn.active-ltc {
            background: #f5f3ff;
            color: #6d28d9;
          }
          .fac-mobile-tab-btn:not(:last-child) {
            border-right: 1px solid #e2e8f0;
          }
        }

        /* Table horizontal scroll inside card, NOT full page */
        .fac-table-scroll {
          overflow-x: auto;
          overflow-y: auto;
          flex: 1 1 0;
          min-height: 0;
        }

        /* Mobile: control bar buttons go full-width */
        @media (max-width: 767px) {
          .fac-ctrl-bar {
            flex-direction: column !important;
          }
          .fac-ctrl-bar > * {
            width: 100% !important;
            flex: 0 0 auto !important;
            min-width: 0 !important;
            box-sizing: border-box;
          }
          .fac-ctrl-bar button {
            width: 100% !important;
            justify-content: center !important;
            min-height: 44px;
          }
        }
      `}</style>

      {/* Desktop/Tablet section header (hidden on mobile) */}
      <div className="fac-section-header" style={{ alignItems: 'center', gap: 10, marginBottom: 20, borderBottom: '2px solid #f1f5f9', paddingBottom: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: 13 }}>
          <Users size={13} /> MIT Faculty
        </div>
        <div style={{ flex: 1, borderTop: '1px dashed #e2e8f0', margin: '0 4px' }} />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 50, background: '#f5f3ff', color: '#7c3aed', fontWeight: 700, fontSize: 13 }}>
          <Shield size={13} /> LTC Faculty
        </div>
      </div>

      {/* Mobile tab switcher (hidden on desktop/tablet) */}
      <div className="fac-mobile-tabs" style={{ display: 'none' }}>
        <button
          className={`fac-mobile-tab-btn${mobileTab === 'faculty' ? ' active-mit' : ''}`}
          onClick={() => setMobileTab('faculty')}
        >
          <Users size={14} /> MIT Faculty
        </button>
        <button
          className={`fac-mobile-tab-btn${mobileTab === 'ltc_member' ? ' active-ltc' : ''}`}
          onClick={() => setMobileTab('ltc_member')}
        >
          <Shield size={14} /> LTC Faculty
        </button>
      </div>

      {/* Side-by-side columns — on mobile only the active tab is shown */}
      <div className="faculty-split-row">

        {/* MIT Faculty column */}
        <div className={`faculty-col-wrap fac-card${mobileTab !== 'faculty' ? ' fac-hidden' : ''}`}>
          {/* Card header */}
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>MIT Faculty</span>
          </div>
          {/* Compact sub-tab fills card height with internal scroll */}
          <div className="fac-card-inner">
            <BatchFacultySubTab batchId={batchId} token={token} toast={toast} roleFilter="faculty" onRefresh={onRefresh} compact={true} />
          </div>
        </div>

        {/* LTC Faculty column */}
        <div className={`faculty-col-wrap fac-card${mobileTab !== 'ltc_member' ? ' fac-hidden' : ''}`}>
          {/* Card header */}
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f5f3ff',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#6d28d9' }}>LTC Faculty</span>
          </div>
          {/* Compact sub-tab fills card height with internal scroll */}
          <div className="fac-card-inner">
            <BatchFacultySubTab batchId={batchId} token={token} toast={toast} roleFilter="ltc_member" onRefresh={onRefresh} compact={true} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Squad Allocation Tab ─────────────────────────────────────────────────────
function SquadAllocationTab({ batchId, batchName, token, toast }) {
  const [data, setData] = useState({ locked: false, students: [], faculty: [], squadNames: SQUAD_NAMES })
  const [loading, setLoading] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [selectedSquad, setSelectedSquad] = useState(SQUAD_NAMES[0])
  const [search, setSearch] = useState('')
  const [notifying, setNotifying] = useState(null)
  const [squadGenderFilter, setSquadGenderFilter] = useState('')

  useEffect(() => {
    setSquadGenderFilter('')
  }, [selectedSquad])

  const handleNotifySquads = async (type) => {
    if (!window.confirm(`Are you sure you want to send ${type} notifications to all students and faculty about their squad assignments?`)) return
    setNotifying(type)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/notify-squads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type })
      })
      const d = await res.json()
      toast(d.message, res.ok ? 'success' : 'error')
    } catch (e) {
      toast('Failed to send notifications.', 'error')
    } finally {
      setNotifying(null)
    }
  }

  const downloadSquadAttendanceFromAllocation = async (squadName) => {
    try {
      const squadStudents = (data.students || []).filter(st => st.squad === squadName)
      if (squadStudents.length === 0) {
        toast(`No students assigned to ${squadName} to export.`, 'warning')
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []
      schedulesList.sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')))

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      const rows = buildAdminAttendanceExportRows(squadStudents, recordsList, schedulesList)

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['Bus Detail: __________'],
        ['Faculty Name: __________'],
        ['Total Present: ______'],
        ['Total Absent: ______']
      ], { origin: -1 })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${squadName} Attendance`)
      XLSX.writeFile(wb, `${squadName}_Attendance_Report.xlsx`)
      toast(`${squadName} attendance report downloaded.`, 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download squad attendance.', 'error')
    }
  }

  const downloadSquadMarksFromAllocation = async (squadName) => {
    try {
      const squadStudents = (data.students || []).filter(st => st.squad === squadName)
      if (squadStudents.length === 0) {
        toast(`No students assigned to ${squadName} to export.`, 'warning')
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []

      const evalsRes = await fetch(`${API}/api/faculty/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const evalsData = evalsRes.ok ? await evalsRes.json() : {}
      const evaluationsList = evalsData.evaluations || []
      const summariesList = evalsData.summaries || []

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      // Sort students panel-wise
      const sortedStudents = [...squadStudents].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      exportLtcExcel({
        title: `Life Awakening Program (LTC) - Student Evaluation Report (${squadName} Squad)`,
        batchName: batchName || 'LTC Batch',
        students: sortedStudents,
        schedules: schedulesList,
        attendanceData: recordsList,
        evaluationData: evaluationsList,
        summaryData: summariesList,
        filename: `${squadName}_Marks_Report.xlsx`
      })

      toast(`${squadName} marks report downloaded.`, 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download squad marks.', 'error')
    }
  }

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

  const [unavailableRooms, setUnavailableRooms] = useState([])
  const [showUnavailableModal, setShowUnavailableModal] = useState(false)
  const [allBatchRooms, setAllBatchRooms] = useState([])
  const [loadingUnavailable, setLoadingUnavailable] = useState(false)
  const [savingUnavailable, setSavingUnavailable] = useState(false)
  const [tempUnavailable, setTempUnavailable] = useState([])
  const [roomFilterText, setRoomFilterText] = useState('')

  const fetchUnavailableRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/unavailable-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const d = await res.json()
        const unavail = Array.isArray(d.unavailable_rooms) ? d.unavailable_rooms : []
        setUnavailableRooms(unavail)
        if (Array.isArray(d.all_rooms) && d.all_rooms.length > 0) {
          setAllBatchRooms(d.all_rooms)
        }
      }
    } catch (err) {
      console.error('Error fetching unavailable rooms:', err)
    }
  }, [batchId, token])

  useEffect(() => {
    fetchUnavailableRooms()
  }, [fetchUnavailableRooms])

  const handleOpenUnavailableModal = async () => {
    setShowUnavailableModal(true)
    setRoomFilterText('')
    setLoadingUnavailable(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/unavailable-rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const d = await res.json()
        const unavail = Array.isArray(d.unavailable_rooms) ? d.unavailable_rooms : []
        setUnavailableRooms(unavail)
        setTempUnavailable([...unavail])

        let roomsList = Array.isArray(d.all_rooms) ? [...d.all_rooms] : []
        const existingStudentRooms = (data?.students || []).map(s => s.room).filter(Boolean)
        const existingFacultyRooms = (data?.faculty || []).map(f => f.room).filter(Boolean)
        const combinedRoomSet = new Set(roomsList.map(r => r.room || `${r.building}-${r.roomNo}`))

        ;[...existingStudentRooms, ...existingFacultyRooms].forEach(r => {
          if (r && r !== 'Overfilled' && !combinedRoomSet.has(r)) {
            roomsList.push({
              building: r.includes('-') ? r.split('-')[0] : 'General',
              floor: '',
              roomNo: r.includes('-') ? r.split('-')[1] : r,
              room: r,
              capacity: 4,
              allottedTo: 'Students'
            })
            combinedRoomSet.add(r)
          }
        })
        setAllBatchRooms(roomsList)
      } else {
        setTempUnavailable([...unavailableRooms])
      }
    } catch (err) {
      console.error(err)
      setTempUnavailable([...unavailableRooms])
    } finally {
      setLoadingUnavailable(false)
    }
  }

  const handleToggleTempRoom = (roomIdentifier) => {
    const trimmed = String(roomIdentifier).trim()
    setTempUnavailable(prev => {
      const exists = prev.some(r => r.toLowerCase() === trimmed.toLowerCase())
      if (exists) {
        return prev.filter(r => r.toLowerCase() !== trimmed.toLowerCase())
      } else {
        return [...prev, trimmed]
      }
    })
  }

  const handleSaveUnavailableRooms = async () => {
    setSavingUnavailable(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/unavailable-rooms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ unavailable_rooms: tempUnavailable })
      })
      const d = await res.json()
      if (res.ok) {
        setUnavailableRooms(d.unavailable_rooms || tempUnavailable)
        toast(d.message || 'Unavailable rooms saved successfully', 'success')
        setShowUnavailableModal(false)
      } else {
        toast(d.message || 'Failed to save unavailable rooms', 'error')
      }
    } catch (err) {
      console.error(err)
      toast('Failed to save unavailable rooms', 'error')
    } finally {
      setSavingUnavailable(false)
    }
  }

  const displayedRooms = useMemo(() => {
    let list = allBatchRooms || []
    if (roomFilterText.trim()) {
      const q = roomFilterText.trim().toLowerCase()
      list = list.filter(r => {
        const iden = r.room || `${r.building ? `${r.building}-` : ''}${r.roomNo || ''}`
        return (
          iden.toLowerCase().includes(q) ||
          (r.roomNo && String(r.roomNo).toLowerCase().includes(q)) ||
          (r.building && String(r.building).toLowerCase().includes(q)) ||
          (r.floor && String(r.floor).toLowerCase().includes(q))
        )
      })
    }
    return list
  }, [allBatchRooms, roomFilterText])

  const [allocatingRooms, setAllocatingRooms] = useState(false)
  const [showAutoAllocateModal, setShowAutoAllocateModal] = useState(false)
  const [allocMode, setAllocMode] = useState('class-wise') // 'class-wise' | 'random'

  const handleOpenAutoAllocateRoomsModal = () => {
    if (data.locked) {
      toast('Unlock squad allocation first.', 'warning')
      return
    }
    setShowAutoAllocateModal(true)
  }

  const handleApplyAllocation = async () => {
    setAllocatingRooms(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/auto-allocate-rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode: allocMode, preview: false })
      })
      const d = await res.json()
      if (res.ok && d.success) {
        toast(d.message || 'Room allocation applied successfully!', 'success')
        setShowAutoAllocateModal(false)
        fetchSquads()
      } else {
        toast(d.message || d.error || 'Failed to apply room allocation.', 'error')
      }
    } catch (err) {
      console.error(err)
      toast('Error applying room allocation.', 'error')
    } finally {
      setAllocatingRooms(false)
    }
  }

  const getDesignationBadge = (desig) => {
    if (!desig) return null
    let bg = '#eff6ff', color = '#1d4ed8', border = '#bfdbfe'
    if (desig === 'Room Leader') {
      bg = '#fef3c7'; color = '#b45309'; border = '#fde68a'
    } else if (desig === 'Room Handover Incharge') {
      bg = '#f3e8ff'; color = '#7e22ce'; border = '#e9d5ff'
    } else if (desig === 'Cleanliness Incharge') {
      bg = '#ecfdf5'; color = '#047857'; border = '#a7f3d0'
    } else if (desig === 'Punctuality Incharge') {
      bg = '#e0f2fe'; color = '#0369a1'; border = '#bae6fd'
    } else if (desig === 'Wake up Incharge') {
      bg = '#fff7ed'; color = '#c2410c'; border = '#ffedd5'
    } else if (desig === 'Light Off Incharge') {
      bg = '#f1f5f9'; color = '#475569'; border = '#cbd5e1'
    }
    return (
      <span style={{
        fontSize: '9.5px',
        fontWeight: '700',
        padding: '1px 6px',
        borderRadius: '4px',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap'
      }}>
        {desig}
      </span>
    )
  }

  const handleDownloadRoomsSerial = () => {
    const studentsWithRooms = (data.students || []).filter(s => s.room)
    if (studentsWithRooms.length === 0) {
      toast('No rooms allocated yet.', 'warning')
      return
    }
    const sorted = [...studentsWithRooms].sort((a, b) => {
      return (a.room || '').localeCompare(b.room || '', undefined, { numeric: true, sensitivity: 'base' })
    })

    let csvContent = "\ufeff"
    csvContent += "PRN,Name,Email,Gender,Squad,Allocated Room\n"
    sorted.forEach(s => {
      const prn = s.prn || '—'
      const name = s.name || ''
      const email = s.email || ''
      const gender = s.gender || '—'
      const squad = s.squad || '—'
      const room = s.room || ''
      csvContent += `"${prn.replace(/"/g, '""')}","${name.replace(/"/g, '""')}","${email.replace(/"/g, '""')}","${gender.replace(/"/g, '""')}","${squad.replace(/"/g, '""')}","${room.replace(/"/g, '""')}"\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `Batch_${batchId}_Room_Allocations.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast('Room allocations downloaded successfully.', 'success')
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

  const downloadRoomListExcel = () => {
    if (!data.students || data.students.length === 0) {
      toast('No students found in this batch.', 'warning')
      return
    }

    const sorted = [...data.students].sort((a, b) => {
      const rA = a.room || '';
      const rB = b.room || '';
      if (!rA && rB) return 1;
      if (rA && !rB) return -1;
      if (!rA && !rB) return (a.name || '').localeCompare(b.name || '');
      if (rA !== rB) return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
      return (a.name || '').localeCompare(b.name || '');
    });

    const exportData = sorted.map((s, index) => ({
      'S.No': index + 1,
      'Room': s.room || 'Unassigned',
      'Student Name': s.name || '—',
      'PRN': s.prn || '—',
      'Email': formatStudentEmail(s.email, 'Not provided'),
      'Gender': s.gender || '—',
      'Squad': s.squad || 'Unassigned',
      'Room Designation': s.room_designation || '—'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Room Allocation')
    
    worksheet['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Room
      { wch: 25 }, // Student Name
      { wch: 15 }, // PRN
      { wch: 25 }, // Email
      { wch: 10 }, // Gender
      { wch: 15 }, // Squad
      { wch: 18 }  // Room Designation
    ]

    XLSX.writeFile(workbook, `Batch_${batchId}_Room_Allocation_List.xlsx`)
    toast('Room list downloaded successfully.', 'success')
  }

  const handleSquadChange = async (studentId, squad) => {
    if (data.locked) { toast('Unlock squad allocation first.', 'warning'); return }
    const targetSquad = squad === '' ? null : squad;
    await fetch(`${API}/api/admin/batches/${batchId}/student-squad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_id: studentId, squad: targetSquad })
    })
    toast('Squad updated.', 'success')
    fetchSquads()
  }

  const handleFacultySquadChange = async (facultyId, squad) => {
    if (data.locked) { toast('Unlock squad allocation first.', 'warning'); return }
    const targetSquad = squad === '' ? null : squad;
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/faculty-squad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ faculty_id: facultyId, squad: targetSquad })
      })
      const d = await res.json()
      if (res.ok) {
        toast('Faculty squad updated.', 'success')
        fetchSquads()
      } else {
        toast(d.message || 'Failed to update faculty squad.', 'error')
      }
    } catch (e) {
      toast('Error updating faculty squad.', 'error')
    }
  }

  const squadStats = useMemo(() => {
    const stats = {}
    SQUAD_NAMES.forEach(s => { stats[s] = { students: 0, normalFaculty: 0, ltcFaculty: 0 } })
    data.students.forEach(s => { if (s.squad && stats[s.squad]) stats[s.squad].students++ })
    data.faculty.forEach(f => {
      if (f.squad && stats[f.squad]) {
        if (f.role === 'ltc_member') stats[f.squad].ltcFaculty++
        else stats[f.squad].normalFaculty++
      }
    })
    return stats
  }, [data])

  const squadStudents = useMemo(() => {
    const list = data.students.filter(s => {
      const matchSquad = (selectedSquad === 'MIT Spare' || selectedSquad === 'LTC Spare')
        ? (!s.squad || s.squad === 'Spare')
        : (s.squad === selectedSquad);
      let matchGender = true;
      if (squadGenderFilter === 'male') {
        matchGender = s.gender && ['male', 'm'].includes(s.gender.toLowerCase().trim());
      } else if (squadGenderFilter === 'female') {
        matchGender = s.gender && ['female', 'f'].includes(s.gender.toLowerCase().trim());
      }
      return matchSquad && matchGender && (!search || s.name.toLowerCase().includes(search.toLowerCase()));
    });
    return list.sort((a, b) => {
      const rA = a.room || '';
      const rB = b.room || '';
      if (!rA && rB) return 1;
      if (rA && !rB) return -1;
      if (!rA && !rB) return (a.name || '').localeCompare(b.name || '');
      if (rA !== rB) return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [data.students, selectedSquad, search, squadGenderFilter])

  const groupedStudents = useMemo(() => {
    const groups = {};
    squadStudents.forEach(s => {
      const r = s.room || 'Unassigned';
      if (!groups[r]) groups[r] = [];
      groups[r].push(s);
    });
    return groups;
  }, [squadStudents]);

  const sortedRoomKeys = useMemo(() => {
    return Object.keys(groupedStudents).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [groupedStudents]);

  const squadFaculty = useMemo(() => {
    if (selectedSquad === 'MIT Spare') {
      return data.faculty.filter(f => (!f.squad || f.squad === 'Spare') && f.role !== 'ltc_member')
    }
    if (selectedSquad === 'LTC Spare') {
      return data.faculty.filter(f => (!f.squad || f.squad === 'Spare') && f.role === 'ltc_member')
    }
    return data.faculty.filter(f => f.squad === selectedSquad)
  }, [data.faculty, selectedSquad])

  const squadGenderCounts = useMemo(() => {
    const studentsInSelectedSquad = data.students.filter(s => {
      return (selectedSquad === 'MIT Spare' || selectedSquad === 'LTC Spare')
        ? (!s.squad || s.squad === 'Spare')
        : (s.squad === selectedSquad);
    });
    let boys = 0;
    let girls = 0;
    studentsInSelectedSquad.forEach(s => {
      if (s.gender) {
        const g = s.gender.toLowerCase().trim();
        if (g === 'male' || g === 'm') boys++;
        else if (g === 'female' || g === 'f') girls++;
      }
    });
    return { boys, girls, total: studentsInSelectedSquad.length };
  }, [data.students, selectedSquad]);

  const unassigned = data.students.filter(s => !s.squad)
  const mitSpareCount = data.faculty.filter(f => (!f.squad || f.squad === 'Spare') && f.role !== 'ltc_member').length
  const ltcSpareCount = data.faculty.filter(f => (!f.squad || f.squad === 'Spare') && f.role === 'ltc_member').length

  return (
    <div>
      <style>{`
        .squad-actions-header {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 20px;
        }
        .squad-detail-header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .squad-detail-stats {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .squad-detail-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .squad-detail-search-filter {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .squad-actions-header {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            width: 100% !important;
          }
          .squad-actions-header .btn {
            width: 100% !important;
            justify-content: center !important;
            font-size: 11.5px !important;
            padding: 10px 8px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          .squad-actions-header .unassigned-text {
            grid-column: span 2 !important;
            text-align: center !important;
            margin: 8px 0 0 0 !important;
          }
          .squad-detail-header {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .squad-detail-header-title-row {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
          }
          .squad-detail-stats {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .squad-detail-stats span {
            text-align: center !important;
            width: 100% !important;
            padding: 8px 4px !important;
            font-size: 11.5px !important;
            border-radius: 8px !important;
            margin: 0 !important;
          }
          .squad-detail-actions {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .squad-detail-actions .btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 10px !important;
            font-size: 12px !important;
            margin: 0 !important;
          }
          .squad-detail-search-filter {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .squad-detail-search-filter .search-wrapper {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .squad-detail-search-filter select {
            width: 100% !important;
            margin: 0 !important;
            height: 38px !important;
          }
        }
        @media (max-width: 480px) {
          .squad-actions-header {
            grid-template-columns: 1fr !important;
          }
          .squad-actions-header .unassigned-text {
            grid-column: span 1 !important;
          }
          .squad-detail-search-filter {
            grid-template-columns: 1fr !important;
          }
          .squads-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div className="squad-actions-header">
        <button className="btn btn-sm btn-auto-allocate" onClick={handleAutoAllocate} disabled={allocating || data.locked}>
          {allocating ? <><div className="spinner spinner-sm" />Allocating…</> : <><RefreshCw size={14} />Auto Allocate 10 Squads</>}
        </button>
        <button className="btn btn-sm btn-auto-allocate" style={{ background: '#0f172a', borderColor: '#0f172a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleOpenAutoAllocateRoomsModal} disabled={allocatingRooms || data.locked} title="Auto Allocate Rooms (Random or Class-Wise)">
          {allocatingRooms ? <><div className="spinner spinner-sm" />Allocating…</> : <><MapPin size={14} />Auto Allocate Rooms</>}
        </button>
        <button className={`btn btn-sm ${data.locked ? 'btn-unlock-allocation' : 'btn-lock-allocation'}`} onClick={handleLockToggle}>
          {data.locked ? <><Unlock size={14} />Unlock</> : <><Lock size={14} />Lock Allocation</>}
        </button>
        {data.locked && <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Lock size={10} /> Allocation Locked</span>}
        
        <button 
          className="btn btn-sm" 
          onClick={handleOpenUnavailableModal} 
          style={{ 
            background: '#b91c1c', 
            color: '#ffffff', 
            borderColor: '#b91c1c',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '700',
            borderRadius: '6px',
            boxShadow: '0 1px 2px rgba(185, 28, 28, 0.2)'
          }}
          title="Mark rooms as unavailable to exclude them from Auto Room Allocation"
        >
          <Ban size={14} /> Add Unavailable Rooms
          {unavailableRooms.length > 0 && (
            <span style={{ 
              background: '#ffffff', 
              color: '#b91c1c', 
              fontSize: '11px', 
              fontWeight: '800', 
              borderRadius: '9999px', 
              padding: '1px 7px',
              marginLeft: '2px'
            }}>
              {unavailableRooms.length}
            </span>
          )}
        </button>

        <span className="unassigned-text" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
          {data.students.length} students · {unassigned.length} unassigned
        </span>
      </div>

      <div className="squads-grid">
        {SQUAD_NAMES.map(sq => (
          <div key={sq} className={`squad-card ${selectedSquad === sq ? 'selected' : ''}`}
            style={{ '--squad-color': SQUAD_COLORS[sq] || 'var(--primary)' }}
            onClick={() => setSelectedSquad(sq)}>
            <div className="squad-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="squad-badge">{sq.substring(0, 2)}</div>
                <div className="squad-card-title">{sq}</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <MoreHorizontal size={16} />
              </button>
            </div>
            <div className="squad-stats-row">
              <div className="squad-stat-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                  <span className="squad-stat-value">{squadStats[sq]?.students || 0}</span>
                  <span className="squad-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Students</span>
                </div>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: `${SQUAD_COLORS[sq]}12` || 'rgba(37, 99, 235, 0.08)',
                  color: SQUAD_COLORS[sq] || '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Users size={14} />
                </div>
              </div>
              <div className="squad-stat-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left', minWidth: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2, display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#16a34a' }}>MIT {squadStats[sq]?.normalFaculty || 0}</span>
                    <span style={{ color: '#94a3b8' }}>·</span>
                    <span style={{ color: '#7c3aed' }}>LTC {squadStats[sq]?.ltcFaculty || 0}</span>
                  </span>
                  <span className="squad-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>Faculty</span>
                </div>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: `${SQUAD_COLORS[sq]}12` || 'rgba(37, 99, 235, 0.08)',
                  color: SQUAD_COLORS[sq] || '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <GraduationCap size={14} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {/* MIT Spare card */}
        <div className={`squad-card ${selectedSquad === 'MIT Spare' ? 'selected' : ''}`}
          style={{ '--squad-color': '#16a34a' }}
          onClick={() => setSelectedSquad('MIT Spare')}>
          <div className="squad-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="squad-badge" style={{ background: '#16a34a', fontSize: 10 }}>MIT</div>
              <div className="squad-card-title">MIT Spare</div>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', marginTop: 'auto' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', lineHeight: 1.1 }}>{data.students.filter(s => !s.squad || s.squad === 'Spare').length}</span>
                <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>Students</span>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#16a34a12', color: '#16a34a', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={12} />
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', lineHeight: 1.1 }}>{mitSpareCount}</span>
                <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>Faculty</span>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#16a34a12', color: '#16a34a', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GraduationCap size={12} />
              </div>
            </div>
          </div>
        </div>
        {/* LTC Spare card */}
        <div className={`squad-card ${selectedSquad === 'LTC Spare' ? 'selected' : ''}`}
          style={{ '--squad-color': '#7c3aed' }}
          onClick={() => setSelectedSquad('LTC Spare')}>
          <div className="squad-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="squad-badge" style={{ background: '#7c3aed', fontSize: 10 }}>LTC</div>
              <div className="squad-card-title">LTC Spare</div>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
              <MoreHorizontal size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', marginTop: 'auto' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#7c3aed', lineHeight: 1.1 }}>—</span>
                <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>Students</span>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed12', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={12} />
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#7c3aed', lineHeight: 1.1 }}>{ltcSpareCount}</span>
                <span style={{ fontSize: '9.5px', color: '#64748b', fontWeight: '600' }}>Faculty</span>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed12', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GraduationCap size={12} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <div className="squad-detail-header">
          <div className="squad-detail-header-title-row">
            <div className="squad-badge" style={{
              background: selectedSquad === 'MIT Spare' ? '#16a34a' : selectedSquad === 'LTC Spare' ? '#7c3aed' : SQUAD_COLORS[selectedSquad] || 'var(--primary)',
              width: 40, height: 40, fontSize: 12
            }}>
              {selectedSquad === 'MIT Spare' ? 'MIT' : selectedSquad === 'LTC Spare' ? 'LTC' : selectedSquad.substring(0, 2)}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {selectedSquad === 'MIT Spare' || selectedSquad === 'LTC Spare' ? selectedSquad : `${selectedSquad} Squad`}
            </h3>
          </div>

          <div className="squad-detail-stats">
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
              Boys: {squadGenderCounts.boys}
            </span>
            <span style={{ background: '#fdf2f8', color: '#be185d', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
              Girls: {squadGenderCounts.girls}
            </span>
            <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '11px' }}>
              Total: {squadGenderCounts.total}
            </span>
          </div>

          {selectedSquad !== 'MIT Spare' && selectedSquad !== 'LTC Spare' && (
            <div className="squad-detail-actions">
              <button 
                onClick={() => downloadSquadAttendanceFromAllocation(selectedSquad)}
                className="btn btn-sm" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 10px', background: '#000000', color: '#ffffff', border: 'none', cursor: 'pointer' }}
              >
                <Download size={12} /> Download Attendance of {selectedSquad}
              </button>

            </div>
          )}

          <div className="squad-detail-search-filter">
            <div className="search-wrapper" style={{ margin: 0, maxWidth: 260 }}>
              <Search className="search-icon" size={14} />
              <input className="input-field" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 0, paddingLeft: 40 }} />
            </div>
            <select
              className="input-field filter-select"
              style={{ width: 120, marginBottom: 0, padding: '4px 8px', fontSize: 13, fontWeight: '600' }}
              value={squadGenderFilter}
              onChange={e => setSquadGenderFilter(e.target.value)}
            >
              <option value="">All Genders</option>
              <option value="male">Boys</option>
              <option value="female">Girls</option>
            </select>
          </div>
        </div>

        {/* Allocated Faculty Section — split into MIT and LTC */}
        {(() => {
          const normalFac = squadFaculty.filter(f => f.role !== 'ltc_member')
          const ltcFac    = squadFaculty.filter(f => f.role === 'ltc_member')
          const isSpare   = selectedSquad === 'MIT Spare' || selectedSquad === 'LTC Spare'

          const FacultyCard = ({ f }) => {
            const isLtc = f.role === 'ltc_member'
            const roleColor = isLtc ? '#7c3aed' : '#16a34a'
            const initials = f.name ? f.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'F'
            return (
              <div 
                key={f.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  gap: '12px', 
                  background: '#ffffff', 
                  padding: '14px 16px', 
                  borderRadius: '12px', 
                  border: '1.5px solid #e2e8f0', 
                  borderLeft: `4.5px solid ${roleColor}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
                  position: 'relative',
                  minWidth: 0,
                  height: '100%',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
                  {/* Left Avatar */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: `${roleColor}12`,
                    color: roleColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '12px',
                    flexShrink: 0
                  }}>
                    {initials}
                  </div>

                  {/* Middle Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{f.name}</span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {isLtc ? (
                          <span style={{ fontSize: '9px', padding: '2px 6px', background: '#ede9fe', color: '#5b21b6', fontWeight: '800', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>LTC</span>
                        ) : (
                          <span style={{ fontSize: '9px', padding: '2px 6px', background: '#dcfce7', color: '#166534', fontWeight: '800', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>MIT</span>
                        )}
                        {f.undertaking_submitted ? (
                          <span style={{ fontSize: '9px', padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', fontWeight: '800', borderRadius: '4px', textTransform: 'uppercase' }}>Signed</span>
                        ) : (
                          <span style={{ fontSize: '9px', padding: '2px 6px', background: '#f1f5f9', color: '#475569', fontWeight: '800', borderRadius: '4px', textTransform: 'uppercase' }}>Pending</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all', marginBottom: '4px' }}>{f.email}</div>
                    {f.department && (
                      <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <span>Dept:</span> <span style={{ color: '#475569', fontWeight: '500' }}>{f.department}</span>
                      </div>
                    )}
                    {isLtc && f.designation && (
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block', border: '1px solid #ddd6fe' }}>
                        {f.designation}
                      </div>
                    )}
                  </div>
                </div>

                {/* Squad Selector Bottom Block */}
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '700' }}>Squad Assignment:</span>
                  <select
                    disabled={data.locked}
                    value={f.squad || ''}
                    onChange={e => handleFacultySquadChange(f.id, e.target.value)}
                    style={{ 
                      flex: 1, 
                      minWidth: '120px',
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      border: '1.5px solid #e2e8f0', 
                      fontSize: '11.5px', 
                      fontWeight: '600',
                      color: '#0f172a',
                      background: '#ffffff', 
                      outline: 'none',
                      cursor: data.locked ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.2s ease'
                    }}
                  >
                    <option value="">Spare (No Squad)</option>
                    {SQUAD_NAMES.map(sq => <option key={sq} value={sq}>{sq}</option>)}
                  </select>
                </div>
              </div>
            )
          }

          const FacultySection = ({ title, color, list }) => (
            <div style={{ marginBottom: 16, padding: '16px 12px', background: '#f8fafc', border: `1px solid ${color}22`, borderRadius: 12, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
              <h4 style={{ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                {title} ({list.length})
              </h4>
              {list.length > 0
                ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12, flex: 1 }}>{list.map(f => <FacultyCard key={f.id} f={f} />)}</div>
                : <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: 0, flex: 1, display: 'flex', alignItems: 'center' }}>No {title.toLowerCase()} in this squad yet.</p>}
            </div>
          )

          return (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 0, flexWrap: 'wrap', alignItems: 'stretch' }}>
                {(selectedSquad === 'MIT Spare' || (!isSpare && normalFac.length >= 0)) &&
                  !selectedSquad.startsWith('LTC') &&
                  <div style={{ flex: '1 1 min(100%, 300px)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <FacultySection title="MIT Faculty" color="#16a34a" list={isSpare ? squadFaculty : normalFac} />
                  </div>}
                {(selectedSquad === 'LTC Spare' || (!isSpare && ltcFac.length >= 0)) &&
                  !selectedSquad.startsWith('MIT') &&
                  <div style={{ flex: '1 1 min(100%, 300px)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <FacultySection title="LTC Faculty" color="#7c3aed" list={isSpare ? squadFaculty : ltcFac} />
                  </div>}
              </div>
              {!isSpare && normalFac.length === 0 && ltcFac.length === 0 && (
                <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                  <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No faculty allocated to this squad yet.</p>
                </div>
              )}
            </>
          )
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading ? (
            <div className="loading-center" style={{ minHeight: 120 }}>
              <div className="spinner spinner-md" />
            </div>
          ) : squadStudents.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '40px 0', fontStyle: 'italic', background: '#f8fafc', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
              No students in this squad
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: '16px' }}>
              {sortedRoomKeys.map(roomKey => {
                const list = groupedStudents[roomKey] || [];
                const isUnassigned = roomKey === 'Unassigned';
                return (
                  <div key={roomKey} style={{
                    background: '#ffffff',
                    border: isUnassigned ? '1.5px dashed #cbd5e1' : '1.5px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #f1f5f9',
                      paddingBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: isUnassigned ? '#475569' : '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isUnassigned ? 'Unassigned Students' : `Room: ${roomKey}`}
                      </span>
                      <span style={{ fontSize: '11px', background: isUnassigned ? '#f1f5f9' : '#eff6ff', color: isUnassigned ? '#475569' : '#2563eb', padding: '2px 8px', borderRadius: '50px', fontWeight: '750' }}>
                        {list.length} Students
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {list.map(s => (
                        <div key={s.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1px solid #f1f5f9',
                          gap: '10px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 170px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isUnassigned ? '#94a3b8' : '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', flexShrink: 0 }}>
                              {s.name ? s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {s.name}
                                {s.squad_designation && (
                                  <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#16a34a', background: 'rgba(22, 163, 74, 0.08)', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }} title={s.squad_designation}>
                                    {s.squad_designation.startsWith('Vice') ? 'V. Capt' : 'Capt'}
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>PRN: {s.prn || '—'} · {s.gender || '—'}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: 'auto' }}>
                            {s.undertaking_submitted ? (
                              <span className="badge badge-blue" style={{ fontSize: '9.5px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center' }}>Signed</span>
                            ) : (
                              <span className="badge badge-black" style={{ fontSize: '9.5px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center' }}>Pending</span>
                            )}

                            <select disabled={data.locked} value={s.squad || ''} onChange={e => handleSquadChange(s.id, e.target.value)}
                              style={{ padding: '2px 6px', borderRadius: 6, border: '1.5px solid var(--border)', fontSize: 11, background: 'white', cursor: data.locked ? 'not-allowed' : 'pointer', width: '80px' }}>
                              <option value="">Spare</option>
                              {SQUAD_NAMES.map(sq => <option key={sq} value={sq}>{sq}</option>)}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Unavailable Rooms Modal */}
      {showUnavailableModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '12px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingUnavailable) setShowUnavailableModal(false)
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                background: '#f8fafc',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Add Unavailable Rooms
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      background: tempUnavailable.length > 0 ? '#fee2e2' : '#f1f5f9',
                      color: tempUnavailable.length > 0 ? '#b91c1c' : '#64748b',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${tempUnavailable.length > 0 ? '#fca5a5' : '#e2e8f0'}`
                    }}
                  >
                    {tempUnavailable.length} room{tempUnavailable.length === 1 ? '' : 's'} marked unavailable
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  Selected rooms are excluded from Auto Room Allocation for this batch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUnavailableModal(false)}
                disabled={savingUnavailable}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  flexShrink: 0
                }}
              >
                Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              {/* Search & Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <input
                    type="text"
                    placeholder="Search rooms (e.g. 101, Sinhgad)..."
                    value={roomFilterText}
                    onChange={e => setRoomFilterText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#ffffff'
                    }}
                  />
                </div>
                {tempUnavailable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTempUnavailable([])}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#b91c1c',
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Clear All ({tempUnavailable.length})
                  </button>
                )}
              </div>

              {/* Currently Selected Unavailable Rooms */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Unavailable Rooms List:
                </div>
                <div
                  style={{
                    minHeight: '40px',
                    maxHeight: '85px',
                    overflowY: 'auto',
                    padding: '8px',
                    borderRadius: '6px',
                    background: tempUnavailable.length > 0 ? '#fff5f5' : '#f8fafc',
                    border: `1px solid ${tempUnavailable.length > 0 ? '#fecaca' : '#e2e8f0'}`,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center'
                  }}
                >
                  {tempUnavailable.length === 0 ? (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      No rooms marked unavailable. All batch rooms will be available for auto allocation.
                    </span>
                  ) : (
                    tempUnavailable.map(roomName => (
                      <span
                        key={roomName}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #f87171',
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {roomName}
                        <button
                          type="button"
                          onClick={() => handleToggleTempRoom(roomName)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #fca5a5',
                            color: '#b91c1c',
                            cursor: 'pointer',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}
                          title={`Remove ${roomName}`}
                        >
                          Remove
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Room Selection Grid */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Click a room to toggle unavailable status:
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {displayedRooms.length} room{displayedRooms.length === 1 ? '' : 's'} shown
                  </span>
                </div>

                {loadingUnavailable ? (
                  <div style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                    Loading rooms...
                  </div>
                ) : displayedRooms.length === 0 ? (
                  <div
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: '12px',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px dashed #cbd5e1'
                    }}
                  >
                    No rooms found matching "{roomFilterText}".
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                      gap: '6px',
                      maxHeight: '230px',
                      overflowY: 'auto',
                      padding: '2px'
                    }}
                  >
                    {displayedRooms.map(r => {
                      const rIdentifier = r.room || `${r.building ? `${r.building}-` : ''}${r.roomNo || r.name || ''}`
                      const isUnavail = tempUnavailable.some(u =>
                        u.toLowerCase() === rIdentifier.toLowerCase() ||
                        (r.roomNo && u.toLowerCase() === String(r.roomNo).toLowerCase())
                      )
                      return (
                        <button
                          key={rIdentifier}
                          type="button"
                          onClick={() => handleToggleTempRoom(rIdentifier)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: `1.5px solid ${isUnavail ? '#dc2626' : '#cbd5e1'}`,
                            background: isUnavail ? '#fef2f2' : '#ffffff',
                            color: isUnavail ? '#991b1b' : '#0f172a',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            transition: 'background 0.15s ease, border-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800' }}>
                              {r.roomNo || rIdentifier}
                            </span>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: '700',
                                color: isUnavail ? '#b91c1c' : '#475569',
                                background: isUnavail ? '#fee2e2' : '#f1f5f9',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                border: `1px solid ${isUnavail ? '#fca5a5' : '#e2e8f0'}`
                              }}
                            >
                              {isUnavail ? 'Blocked' : 'Available'}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: isUnavail ? '#b91c1c' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.building ? `${r.building}` : 'Room'} {r.floor ? `· ${r.floor}` : ''} {r.capacity ? `(${r.capacity}p)` : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                background: '#f8fafc'
              }}
            >
              <button
                type="button"
                onClick={() => setShowUnavailableModal(false)}
                disabled={savingUnavailable}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: savingUnavailable ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUnavailableRooms}
                disabled={savingUnavailable}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: savingUnavailable ? 'not-allowed' : 'pointer'
                }}
              >
                {savingUnavailable ? 'Saving...' : 'Save Unavailable Rooms'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auto Allocate Rooms Modal (Simple, Clean, Responsive) ────────── */}
      {showAutoAllocateModal && (
        <div 
          className="modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget && !allocatingRooms) setShowAutoAllocateModal(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
        >
          <div 
            className="modal-card" 
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              width: '100%',
              maxWidth: '500px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a'
                }}>
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Auto Allocate Rooms</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Choose allocation mode</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutoAllocateModal(false)}
                disabled={allocatingRooms}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px',
                  borderRadius: '8px',
                  cursor: allocatingRooms ? 'not-allowed' : 'pointer',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '2px' }}>
                Choose Allocation Mode
              </div>

              {/* Option 1: Class-Wise Allocation */}
              <div
                onClick={() => setAllocMode('class-wise')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: allocMode === 'class-wise' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                  background: allocMode === 'class-wise' ? '#fff7ed' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="allocMode"
                  checked={allocMode === 'class-wise'}
                  onChange={() => setAllocMode('class-wise')}
                  style={{ marginTop: '3px', accentColor: '#ea580c', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: allocMode === 'class-wise' ? '#9a3412' : '#0f172a' }}>
                      Class-Wise Allocation
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '2px 8px',
                      borderRadius: '50px',
                      border: '1px solid #bbf7d0'
                    }}>
                      Recommended
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                    Groups classes 6–8 together and classes 9–10 together. Classes 6–8 never share rooms with classes 9–10. Respects room capacity (6) and boys/girls building separation.
                  </p>
                </div>
              </div>

              {/* Option 2: Random Allocation */}
              <div
                onClick={() => setAllocMode('random')}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: allocMode === 'random' ? '2px solid #ea580c' : '1.5px solid #e2e8f0',
                  background: allocMode === 'random' ? '#fff7ed' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="radio"
                  name="allocMode"
                  checked={allocMode === 'random'}
                  onChange={() => setAllocMode('random')}
                  style={{ marginTop: '3px', accentColor: '#ea580c', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: allocMode === 'random' ? '#9a3412' : '#0f172a' }}>
                      Random Allocation
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      background: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '50px',
                      border: '1px solid #e2e8f0'
                    }}>
                      Existing Logic
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                    Allocates students across consecutive rooms according to squad adjacency and boys/girls building separation. Standards are not isolated.
                  </p>
                </div>
              </div>

              {/* Simple note */}
              <div style={{
                marginTop: '4px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#64748b'
              }}>
                <AlertTriangle size={14} style={{ color: '#ea580c', flexShrink: 0 }} />
                <span>Existing room assignments in this batch will be replaced.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowAutoAllocateModal(false)}
                disabled={allocatingRooms}
                style={{
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: allocatingRooms ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyAllocation}
                disabled={allocatingRooms}
                style={{
                  border: 'none',
                  background: allocatingRooms ? '#cbd5e1' : '#ea580c',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: allocatingRooms ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: allocatingRooms ? 'none' : '0 2px 6px rgba(234, 88, 12, 0.25)'
                }}
              >
                {allocatingRooms ? (
                  <>
                    <div className="spinner spinner-sm" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                    Allocating Rooms…
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Allocate Rooms
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Batch Attendance Tab ──────────────────────────────────────────────────────
function BatchAttendanceTab({ batchId, token, toast }) {
  const [students, setStudents] = useState([])
  const [schedules, setSchedules] = useState([])
  const [records, setRecords] = useState([])
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [selectedSquad, setSelectedSquad] = useState(SQUAD_NAMES[0])
  const [loading, setLoading] = useState(false)

  // Cascading Selector States
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const availableDivisions = useMemo(() => Object.keys(OFFICIAL_HIERARCHY), [])
  const availableFaculties = useMemo(() => {
    if (!selectedDivision) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision] || {})
  }, [selectedDivision])
  const availableSchools = useMemo(() => {
    if (!selectedDivision || !selectedFaculty) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty] || {})
  }, [selectedDivision, selectedFaculty])
  const availableDepartments = useMemo(() => {
    if (!selectedDivision || !selectedFaculty || !selectedSchool) return []
    return OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty]?.[selectedSchool] || []
  }, [selectedDivision, selectedFaculty, selectedSchool])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batchId}/squads`, { headers: { Authorization: `Bearer ${token}` } })
      const squadData = studentsRes.ok ? await studentsRes.json() : {}
      if (squadData.students) {
        setStudents(squadData.students)
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batchId}`, { headers: { Authorization: `Bearer ${token}` } })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      if (schedData.schedules) {
        setSchedules(schedData.schedules)
      }

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batchId}`, { headers: { Authorization: `Bearer ${token}` } })
      const attData = attRes.ok ? await attRes.json() : {}
      if (attData.records) {
        setRecords(attData.records)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [batchId, token])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const downloadSquadAttendance = (squadName) => {
    try {
      const squadStudents = students.filter(st => st.squad === squadName)
      if (squadStudents.length === 0) {
        toast(`No students assigned to ${squadName} to export.`, 'warning')
        return
      }

      const rows = buildAdminAttendanceExportRows(squadStudents, records, [])

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['Bus Detail: __________'],
        ['Faculty Name: __________'],
        ['Total Present: ______'],
        ['Total Absent: ______']
      ], { origin: -1 })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${squadName} Attendance`)
      XLSX.writeFile(wb, `${squadName}_Attendance_Report.xlsx`)
      toast(`${squadName} attendance report downloaded.`, 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download squad attendance.', 'error')
    }
  }

  const downloadSquadMarks = async (squadName) => {
    try {
      const squadStudents = students.filter(st => st.squad === squadName)
      if (squadStudents.length === 0) {
        toast(`No students assigned to ${squadName} to export.`, 'warning')
        return
      }

      const evalsRes = await fetch(`${API}/api/faculty/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const evalsData = evalsRes.ok ? await evalsRes.json() : {}
      const evaluationsList = evalsData.evaluations || []
      const summariesList = evalsData.summaries || []
      const batchId = squadStudents[0]?.batch_id

      // Sort students panel-wise
      const sortedStudents = [...squadStudents].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      const rows = sortedStudents.map(st => {
        const summary = summariesList.find(s => String(s.student_id) === String(st.id)) || {};
        const studentEvals = evaluationsList.filter(e => String(e.student_id) === String(st.id) && String(e.batch_id) === String(batchId));
        
        const allLocked = studentEvals.length > 0 && studentEvals.every(e => e.status === 'locked');
        const statusText = studentEvals.length === 25 && allLocked ? 'Locked' : studentEvals.length > 0 ? 'Draft' : 'Pending';

        return {
          'PRN': st.prn || '—',
          'Student Name': st.name,
          'School': st.school || '—',
          'Batch': batchId,
          'Division': st.division || '—',
          'Squad': st.squad || 'Unassigned',
          'Agriculture /20': summary.agriculture_marks !== undefined ? Number(summary.agriculture_marks).toFixed(2) : '0.00',
          'Physical Fitness /20': summary.physical_marks !== undefined ? Number(summary.physical_marks).toFixed(2) : '0.00',
          'Team Leadership /20': summary.leadership_marks !== undefined ? Number(summary.leadership_marks).toFixed(2) : '0.00',
          'Patriotism /20': summary.patriotism_marks !== undefined ? Number(summary.patriotism_marks).toFixed(2) : '0.00',
          'Spirituality /20': summary.spirituality_marks !== undefined ? Number(summary.spirituality_marks).toFixed(2) : '0.00',
          'Final LTC Score /100': summary.final_score_out_of_100 !== undefined ? Number(summary.final_score_out_of_100).toFixed(2) : '0.00',
          'Status': statusText
        };
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${squadName} Marks`)
      XLSX.writeFile(wb, `${squadName}_Marks_Report.xlsx`)
      toast(`${squadName} marks report downloaded.`, 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download squad marks.', 'error')
    }
  }

  const activeSchedule = (selectedScheduleId && !selectedScheduleId.startsWith('pillar:'))
    ? schedules.find(s => s.id === parseInt(selectedScheduleId))
    : null;

  // Filter students based on hierarchy
  const hierarchyFilteredStudents = useMemo(() => {
    return students.filter(st => {
      if (selectedDivision && st.division !== selectedDivision) return false
      if (selectedFaculty && st.faculty !== selectedFaculty) return false
      if (selectedSchool && st.school !== selectedSchool) return false
      if (selectedDepartment && st.department !== selectedDepartment) return false
      return true
    })
  }, [students, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment])

  const filteredStudents = hierarchyFilteredStudents.filter(st => st.squad === selectedSquad)

  // Calculate selected squad statistics for the summary cards
  const squadStatsSummary = useMemo(() => {
    let presentTotal = 0;
    let absentTotal = 0;
    let lateTotal = 0;
    let rateSum = 0;
    let ratedStudentsCount = 0;

    filteredStudents.forEach(st => {
      const studentRecords = records.filter(r => r.student_id === st.id);
      const present = studentRecords.filter(r => r.status === 'Present').length;
      const absent = studentRecords.filter(r => r.status === 'Absent').length;
      const late = studentRecords.filter(r => r.status === 'Late').length;
      presentTotal += present;
      absentTotal += absent;
      lateTotal += late;

      const totalMarked = present + absent + late;
      if (totalMarked > 0) {
        const rate = Math.round((present * 34 + late * 33) / (totalMarked * 34) * 100);
        rateSum += rate;
        ratedStudentsCount++;
      }
    });

    const averageRate = ratedStudentsCount > 0 ? Math.round(rateSum / ratedStudentsCount) : 0;
    return {
      studentsCount: filteredStudents.length,
      presentTotal,
      absentTotal,
      lateTotal,
      averageRate
    };
  }, [filteredStudents, records]);

  return (
    <div>
      <style>{`
        .att-filters-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-bottom: 24px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01);
        }
        .att-filters-grid select {
          width: 100%;
          padding: 8px 12px;
          font-size: 13px !important;
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          outline: none;
          color: #475569;
          height: auto !important;
          cursor: pointer;
        }
        .desktop-table-view {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .att-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .att-stat-item-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .att-stat-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 12px 24px rgba(0,0,0,0.04);
          border-color: #cbd5e1;
        }
        .att-student-card-mobile {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.015);
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }
        .att-student-card-mobile:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 8px 16px rgba(0,0,0,0.03);
        }
        .att-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #ffffff;
        }
        .att-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.08);
        }
        .mobile-only-cards {
          display: none;
        }
        @media (max-width: 1024px) {
          .att-filters-grid {
            grid-template-columns: repeat(3, 1fr);
            padding: 14px 16px;
          }
          .att-stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 768px) {
          .att-filters-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .att-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .att-filters-grid {
            grid-template-columns: 1fr;
            padding: 12px 14px;
          }
          .att-stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .desktop-table-view {
            display: none !important;
          }
          .mobile-only-cards {
            display: block !important;
          }
          .att-controls-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .att-actions-container {
            width: 100% !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .att-actions-container button {
            width: 100% !important;
            justify-content: center;
          }
        }
      `}</style>

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Batch Attendance Tracking</h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Real-time student attendance status for timetable activities.</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading} 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            background: '#475569',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#334155'}
          onMouseOut={e => e.currentTarget.style.background = '#475569'}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh Records
        </button>
      </div>

      {/* Cascading Filter Controls Grid */}
      <div className="att-filters-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity / Session</label>
          <select value={selectedScheduleId} onChange={e => setSelectedScheduleId(e.target.value)}>
            <option value="">-- All Students Summary --</option>
            <optgroup label="Orientation">
              <option value="pillar:bag_checking:1">Orientation - Day 1</option>
            </optgroup>
            <optgroup label="Agriculture & Nature">
              <option value="pillar:agriculture:2">Agriculture & Nature - Day 2</option>
              <option value="pillar:agriculture:3">Agriculture & Nature - Day 3</option>
              <option value="pillar:agriculture:4">Agriculture & Nature - Day 4</option>
              <option value="pillar:agriculture:5">Agriculture & Nature - Day 5</option>
            </optgroup>
            <optgroup label="Physical Fitness & Sports">
              <option value="pillar:physical:2">Physical Fitness & Sports - Day 2</option>
              <option value="pillar:physical:3">Physical Fitness & Sports - Day 3</option>
              <option value="pillar:physical:4">Physical Fitness & Sports - Day 4</option>
              <option value="pillar:physical:5">Physical Fitness & Sports - Day 5</option>
            </optgroup>
            <optgroup label="Team Building & Leadership">
              <option value="pillar:leadership:2">Team Building & Leadership - Day 2</option>
              <option value="pillar:leadership:3">Team Building & Leadership - Day 3</option>
              <option value="pillar:leadership:4">Team Building & Leadership - Day 4</option>
              <option value="pillar:leadership:5">Team Building & Leadership - Day 5</option>
            </optgroup>
            <optgroup label="Patriotism & Nation Building">
              <option value="pillar:patriotism:2">Patriotism & Nation Building - Day 2</option>
              <option value="pillar:patriotism:3">Patriotism & Nation Building - Day 3</option>
              <option value="pillar:patriotism:4">Patriotism & Nation Building - Day 4</option>
              <option value="pillar:patriotism:5">Patriotism & Nation Building - Day 5</option>
            </optgroup>
            <optgroup label="Spirituality & Peace">
              <option value="pillar:spirituality:2">Spirituality & Peace - Day 2</option>
              <option value="pillar:spirituality:3">Spirituality & Peace - Day 3</option>
              <option value="pillar:spirituality:4">Spirituality & Peace - Day 4</option>
              <option value="pillar:spirituality:5">Spirituality & Peace - Day 5</option>
            </optgroup>
            {schedules.length > 0 && (
              <optgroup label="Legacy Activities">
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>{s.title} ({s.date})</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Division</label>
          <select
            value={selectedDivision}
            onChange={e => {
              setSelectedDivision(e.target.value)
              setSelectedFaculty('')
              setSelectedSchool('')
              setSelectedDepartment('')
            }}
          >
            <option value="">All Divisions</option>
            {availableDivisions.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Faculty</label>
          <select
            value={selectedFaculty}
            onChange={e => {
              setSelectedFaculty(e.target.value)
              setSelectedSchool('')
              setSelectedDepartment('')
            }}
            disabled={!selectedDivision}
          >
            <option value="">All Faculties</option>
            {availableFaculties.map(fac => (
              <option key={fac} value={fac}>{fac}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>School</label>
          <select
            value={selectedSchool}
            onChange={e => {
              setSelectedSchool(e.target.value)
              setSelectedDepartment('')
            }}
            disabled={!selectedFaculty}
          >
            <option value="">All Schools</option>
            {availableSchools.map(sch => (
              <option key={sch} value={sch}>{sch}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dept</label>
          <select
            value={selectedDepartment}
            onChange={e => setSelectedDepartment(e.target.value)}
            disabled={!selectedSchool}
          >
            <option value="">All Depts</option>
            {availableDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Squad Horizontal Scroll Bar tabs */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Select Squad
        </label>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1.5px solid #e2e8f0' }}>
          {SQUAD_NAMES.map(sq => (
            <button
              key={sq}
              onClick={() => setSelectedSquad(sq)}
              style={{
                padding: '6px 14px',
                borderRadius: '50px',
                border: '1.5px solid',
                borderColor: selectedSquad === sq ? 'var(--primary)' : '#e2e8f0',
                background: selectedSquad === sq ? 'var(--primary)' : '#ffffff',
                color: selectedSquad === sq ? '#ffffff' : '#64748b',
                fontSize: '12.5px',
                fontWeight: '750',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Squad Statistics Cards Summary Row */}
      <div className="att-stats-grid">
        <div className="att-stat-item-card">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Enrolled</span>
            <span style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', marginTop: '2px' }}>{squadStatsSummary.studentsCount}</span>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#15438812', color: '#154388', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={16} />
          </div>
        </div>
        <div className="att-stat-item-card">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Present</span>
            <span style={{ fontSize: '20px', fontWeight: '850', color: '#16a34a', marginTop: '2px' }}>{squadStatsSummary.presentTotal}</span>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#16a34a12', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={16} />
          </div>
        </div>
        <div className="att-stat-item-card">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Late</span>
            <span style={{ fontSize: '20px', fontWeight: '850', color: '#ea580c', marginTop: '2px' }}>{squadStatsSummary.lateTotal}</span>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ea580c12', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={16} />
          </div>
        </div>
        <div className="att-stat-item-card">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Absent</span>
            <span style={{ fontSize: '20px', fontWeight: '850', color: '#dc2626', marginTop: '2px' }}>{squadStatsSummary.absentTotal}</span>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dc262612', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </div>
        </div>
        <div className="att-stat-item-card">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Avg Rate</span>
            <span style={{ fontSize: '20px', fontWeight: '850', color: '#0d9488', marginTop: '2px' }}>{squadStatsSummary.averageRate}%</span>
          </div>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0d948812', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={16} />
          </div>
        </div>
      </div>

      {/* Controls: Selected Squad Title and Downloads Button row */}
      <div className="att-controls-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
            Squad: <span style={{ color: 'var(--primary)' }}>{selectedSquad}</span>
          </span>
        </div>
        <div className="att-actions-container" style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => downloadSquadAttendance(selectedSquad)}
            className="att-action-btn" 
            style={{ background: '#154388' }}
          >
            <Download size={14} /> Download Attendance Report
          </button>

        </div>
      </div>

      {loading ? (
        <div className="loading-center" style={{ minHeight: '120px' }}><div className="spinner" /></div>
      ) : !selectedScheduleId ? (
        <div>
          {/* Table Wrapper (Desktop View) */}
          <div className="table-wrapper desktop-table-view">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>PRN / LTC ID</th>
                  <th>Student Name</th>
                  <th>Squad</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Attendance Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => {
                  const studentRecords = records.filter(r => r.student_id === st.id)
                  const presentCount = studentRecords.filter(r => r.status === 'Present').length
                  const absentCount = studentRecords.filter(r => r.status === 'Absent').length
                  const lateCount = studentRecords.filter(r => r.status === 'Late').length
                  const totalMarked = presentCount + absentCount + lateCount
                  const rate = totalMarked > 0 ? Math.round((presentCount * 34 + lateCount * 33) / (totalMarked * 34) * 100) : 0

                  return (
                    <tr key={st.id}>
                      <td style={{ fontWeight: '600' }}>{idx + 1}</td>
                      <td>
                        <code style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569' }}>{st.prn || '—'}</code>
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>{st.name}</td>
                      <td>
                        {st.squad ? (
                          <span className="badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase' }}>{st.squad}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ color: '#16a34a', fontWeight: '750' }}>{presentCount}</td>
                      <td style={{ color: '#ea580c', fontWeight: '750' }}>{lateCount}</td>
                      <td style={{ color: '#dc2626', fontWeight: '750' }}>{absentCount}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ea580c' : '#dc2626' }} />
                          </div>
                          <span style={{ fontWeight: '750', fontSize: '12.5px', color: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ea580c' : '#dc2626' }}>
                            {rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>No students in this squad.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards Wrapper (Mobile View) */}
          <div className="mobile-only-cards">
            {filteredStudents.map(st => {
              const studentRecords = records.filter(r => r.student_id === st.id)
              const presentCount = studentRecords.filter(r => r.status === 'Present').length
              const absentCount = studentRecords.filter(r => r.status === 'Absent').length
              const lateCount = studentRecords.filter(r => r.status === 'Late').length
              const totalMarked = presentCount + absentCount + lateCount
              const rate = totalMarked > 0 ? Math.round((presentCount * 34 + lateCount * 33) / (totalMarked * 34) * 100) : 0
              const initials = st.name ? st.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'S'

              return (
                <div key={st.id} className="att-student-card-mobile">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                      <code style={{ fontSize: '10.5px', color: '#64748b' }}>{st.prn || '—'}</code>
                    </div>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase' }}>{st.squad || 'Unassigned'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#16a34a' }}>{presentCount}</div>
                      <div style={{ fontSize: '8.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>Present</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#ea580c' }}>{lateCount}</div>
                      <div style={{ fontSize: '8.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>Late</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626' }}>{absentCount}</div>
                      <div style={{ fontSize: '8.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>Absent</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>Attendance Rate:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '60px', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ea580c' : '#dc2626' }} />
                      </div>
                      <span style={{ fontWeight: '800', fontSize: '12px', color: rate >= 75 ? '#16a34a' : rate >= 50 ? '#ea580c' : '#dc2626' }}>{rate}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>No students in this squad.</div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {/* Table Wrapper for specific session (Desktop View) */}
          <div className="table-wrapper desktop-table-view">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>PRN / LTC ID</th>
                  <th>Student Name</th>
                  <th>Squad</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st, idx) => {
                  let rec;
                  if (selectedScheduleId && selectedScheduleId.startsWith('pillar:')) {
                    const parts = selectedScheduleId.split(':');
                    const pKey = parts[1];
                    const dNum = Number(parts[2]);
                    rec = records.find(r => r.student_id === st.id && r.pillar === pKey && Number(r.day) === dNum);
                  } else if (activeSchedule) {
                    rec = records.find(r => r.student_id === st.id && r.schedule_id === activeSchedule.id);
                  }
                  return (
                    <tr key={st.id}>
                      <td style={{ fontWeight: '600' }}>{idx + 1}</td>
                      <td>
                        <code style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569' }}>{st.prn || '—'}</code>
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>{st.name}</td>
                      <td>
                        {st.squad ? (
                          <span className="badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase' }}>{st.squad}</span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        {rec ? (
                          <span className="badge" style={{
                            background: rec.status === 'Present' ? '#d1fae5' : rec.status === 'Late' ? '#fef3c7' : '#fee2e2',
                            color: rec.status === 'Present' ? '#065f46' : rec.status === 'Late' ? '#b45309' : '#991b1b',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}>
                            {rec.status}
                          </span>
                        ) : (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', fontWeight: '700', padding: '3px 8px', borderRadius: '6px' }}>
                            Not Marked
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0' }}>No students in this squad.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cards Wrapper for specific session (Mobile View) */}
          <div className="mobile-only-cards">
            {filteredStudents.map(st => {
              let rec;
              if (selectedScheduleId && selectedScheduleId.startsWith('pillar:')) {
                const parts = selectedScheduleId.split(':');
                const pKey = parts[1];
                const dNum = Number(parts[2]);
                rec = records.find(r => r.student_id === st.id && r.pillar === pKey && Number(r.day) === dNum);
              } else if (activeSchedule) {
                rec = records.find(r => r.student_id === st.id && r.schedule_id === activeSchedule.id);
              }
              const initials = st.name ? st.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'S'

              return (
                <div key={st.id} className="att-student-card-mobile" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</div>
                      <code style={{ fontSize: '10.5px', color: '#64748b' }}>{st.prn || '—'}</code>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className="badge" style={{ background: '#eff6ff', color: '#1e40af', fontWeight: '800', fontSize: '9px', textTransform: 'uppercase', marginBottom: '2px' }}>{st.squad || 'Unassigned'}</span>
                    {rec ? (
                      <span className="badge" style={{
                        background: rec.status === 'Present' ? '#d1fae5' : rec.status === 'Late' ? '#fef3c7' : '#fee2e2',
                        color: rec.status === 'Present' ? '#065f46' : rec.status === 'Late' ? '#b45309' : '#991b1b',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px'
                      }}>
                        {rec.status}
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        Not Marked
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredStudents.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>No students in this squad.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BatchUndertakingsTab({ batchId, token, toast }) {
  const [allStudents, setAllStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/students?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAllStudents(data.students || [])
      } else {
        toast('Failed to load batch students.', 'error')
      }
    } catch (err) {
      toast('Network error loading students.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [batchId])

  const analytics = useMemo(() => {
    const counts = { S: 0, M: 0, L: 0, XL: 0, XXL: 0, XXXL: 0, Pending: 0 }
    allStudents.forEach(s => {
      if (!s.undertaking_submitted) {
        counts.Pending++
      } else {
        const size = s.tshirt_size || ''
        if (size.endsWith('XXXL')) counts.XXXL++
        else if (size.endsWith('XXL')) counts.XXL++
        else if (size.endsWith('XL')) counts.XL++
        else if (size.endsWith('L')) counts.L++
        else if (size.endsWith('M')) counts.M++
        else if (size.endsWith('S')) counts.S++
        else counts.Pending++
      }
    })
    return counts
  }, [allStudents])

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return allStudents
    return allStudents.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.prn || '').toLowerCase().includes(q)
    )
  }, [allStudents, search])

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage)
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredStudents.slice(start, start + itemsPerPage)
  }, [filteredStudents, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const downloadUndertakingsExcel = () => {
    const data = allStudents.map(s => ({
      'Student Name': s.name || '—',
      'PRN': s.prn || '—',
      'Undertaking Status': s.undertaking_submitted ? 'Submitted' : 'Pending',
      'Photo Consent': s.photo_video_consent ? 'Accepted' : 'Declined',
      'T-Shirt Size': s.tshirt_size || '—',
      'T-Shirt Consent': s.tshirt_consent ? 'Accepted' : 'Declined',
      'Data Consent': s.data_consent ? 'Accepted' : 'Declined',
      'Bag Check Consent': s.bag_check_consent ? 'Accepted' : 'Declined',
      'Submitted Date': s.undertaking_signed_date || '—'
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Undertakings')
    XLSX.writeFile(workbook, `Batch_Undertakings_Report_${batchId}.xlsx`)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <style>{`
        .tshirt-analytics-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .tshirt-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px 12px;
          text-align: center;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .tshirt-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 12px 24px rgba(0,0,0,0.04);
          border-color: #cbd5e1;
        }
        .tshirt-student-card-mobile {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.015);
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }
        .tshirt-student-card-mobile:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 6px rgba(0,0,0,0.02), 0 8px 16px rgba(0,0,0,0.03);
        }
        .tshirt-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          flex-wrap: wrap;
          gap: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01);
        }
        .tshirt-toolbar input {
          width: 100%;
          padding: 8px 12px 8px 36px !important;
          font-size: 13px !important;
          background-color: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          outline: none;
          color: #0f172a;
          height: auto !important;
        }
        .tshirt-desktop-table {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02);
          overflow: hidden;
          margin-bottom: 20px;
        }
        .tshirt-search-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 300px;
        }
        .tshirt-download-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: #154388;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tshirt-download-btn:hover {
          background: #0f3366;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0,0,0,0.08);
        }
        .tshirt-mobile-cards {
          display: none;
        }
        @media (max-width: 1024px) {
          .tshirt-analytics-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 768px) {
          .tshirt-analytics-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 640px) {
          .tshirt-analytics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .tshirt-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 12px 14px;
          }
          .tshirt-search-wrapper {
            width: 100% !important;
          }
          .tshirt-download-btn {
            width: 100% !important;
            justify-content: center;
          }
          .tshirt-desktop-table {
            display: none !important;
          }
          .tshirt-mobile-cards {
            display: block !important;
          }
        }
        @media (min-width: 641px) {
          .tshirt-desktop-table {
            display: table !important;
          }
          .tshirt-mobile-cards {
            display: none !important;
          }
        }
      `}</style>

      {/* T-Shirt Analytics */}
      <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        T-Shirt Size Analytics & Ordering Info
      </h4>
      
      <div className="tshirt-analytics-grid">
        {[
          { label: 'Total S (36)', count: analytics.S, color: '#2563eb', border: '#bfdbfe' },
          { label: 'Total M (38)', count: analytics.M, color: '#059669', border: '#bbf7d0' },
          { label: 'Total L (40)', count: analytics.L, color: '#d97706', border: '#fef3c7' },
          { label: 'Total XL (42)', count: analytics.XL, color: '#7c3aed', border: '#ddd6fe' },
          { label: 'Total XXL (44)', count: analytics.XXL, color: '#db2777', border: '#fbcfe8' },
          { label: 'Total XXXL (46)', count: analytics.XXXL, color: '#dc2626', border: '#fecaca' },
          { label: 'Pending/None', count: analytics.Pending, color: '#475569', border: '#cbd5e1' }
        ].map((item, idx) => (
          <div key={idx} className="tshirt-stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              {item.label}
            </div>
            <div style={{ fontSize: '24px', fontWeight: '850', color: item.color, marginTop: '2px' }}>{item.count}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="tshirt-toolbar">
        <div className="tshirt-search-wrapper">
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search by student name or PRN..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={downloadUndertakingsExcel}
          className="tshirt-download-btn"
        >
          <Download size={14} /> Download Undertakings Excel Report
        </button>
      </div>

      {/* Grid Table */}
      {filteredStudents.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px' }}>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>No students match your search criteria.</p>
        </div>
      ) : (
        <div>
          {/* Table View (Desktop) */}
          <div className="table-wrapper tshirt-desktop-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>Student Name</th>
                  <th>PRN</th>
                  <th>Undertaking Status</th>
                  <th>Photo Consent</th>
                  <th>T-Shirt Size</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((s, idx) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: '600' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>{s.name}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{s.prn || '—'}</code>
                    </td>
                    <td>
                      {s.undertaking_submitted ? (
                        <span className="badge" style={{ fontSize: '10px', padding: '2px 8px', fontWeight: '800', background: '#e0f2fe', color: '#0369a1', textTransform: 'uppercase' }}>Submitted</span>
                      ) : (
                        <span className="badge" style={{ fontSize: '10px', padding: '2px 8px', fontWeight: '800', background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      {s.undertaking_submitted ? (
                        s.photo_video_consent ? (
                          <span style={{ color: '#16a34a', fontSize: '12.5px', fontWeight: '800' }}>Accepted</span>
                        ) : (
                          <span style={{ color: '#dc2626', fontSize: '12.5px', fontWeight: '800' }}>Declined</span>
                        )
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ 
                        fontWeight: '800', 
                        fontSize: '11px',
                        background: s.tshirt_size ? '#f1f5f9' : 'transparent',
                        color: s.tshirt_size ? '#0f172a' : '#cbd5e1',
                        border: s.tshirt_size ? '1px solid #cbd5e1' : 'none',
                        padding: s.tshirt_size ? '2px 8px' : 0
                      }}>
                        {s.tshirt_size || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                      {s.undertaking_signed_date || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards View (Mobile) */}
          <div className="tshirt-mobile-cards">
            {paginatedStudents.map(s => {
              const initials = s.name ? s.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'S'
              return (
                <div key={s.id} className="tshirt-student-card-mobile">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <code style={{ fontSize: '10.5px', color: '#64748b' }}>{s.prn || '—'}</code>
                    </div>
                    {s.tshirt_size && (
                      <span className="badge" style={{ fontWeight: '800', fontSize: '10px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '2px 6px' }}>{s.tshirt_size}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {s.undertaking_submitted ? (
                        <span className="badge" style={{ fontSize: '9px', padding: '2px 6px', fontWeight: '800', background: '#e0f2fe', color: '#0369a1', textTransform: 'uppercase' }}>Undertaking</span>
                      ) : (
                        <span className="badge" style={{ fontSize: '9px', padding: '2px 6px', fontWeight: '800', background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase' }}>Undertaking</span>
                      )}
                      
                      {s.undertaking_submitted && (
                        s.photo_video_consent ? (
                          <span className="badge" style={{ fontSize: '9px', padding: '2px 6px', fontWeight: '800', background: '#dcfce7', color: '#166534', textTransform: 'uppercase' }}>Photo Consent</span>
                        ) : (
                          <span className="badge" style={{ fontSize: '9px', padding: '2px 6px', fontWeight: '800', background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase' }}>Photo Consent</span>
                        )
                      )}
                    </div>

                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {s.undertaking_signed_date ? s.undertaking_signed_date.split('T')[0] : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Local Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '16px' }}>
              <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Batch Absentees Tab Component ──────────────────────────────────────────────
function BatchAbsenteesTab({ batchId, batchName, token, toast }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [students, setStudents] = useState([])
  const [absentMap, setAbsentMap] = useState({})
  const [search, setSearch] = useState('')
  const [squadFilter, setSquadFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ABSENT')
  const [currentPage, setCurrentPage] = useState(1)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [lockTargetStudent, setLockTargetStudent] = useState(null)
  const [isLockingAccount, setIsLockingAccount] = useState(false)
  const itemsPerPage = 25

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const snapRes = await fetch(`${API}/api/admin/batches/${batchId}/absentees-snapshot`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      let snapData = null
      if (snapRes.ok) {
        snapData = await snapRes.json()
        if (snapData.exists && snapData.snapshot) {
          setSnapshot(snapData.snapshot)
          setHasSnapshot(true)
          const snapStudents = snapData.snapshot.students || []
          setStudents(snapStudents)
          const initialMap = {}
          snapStudents.forEach(s => {
            const idKey = s.student_id || s.id || s.prn || s.email
            if (s.is_absent || s.is_dnr) initialMap[idKey] = true
          })
          setAbsentMap(initialMap)
          setLoading(false)
          return
        }
      }

      setHasSnapshot(false)
      setSnapshot(null)
      const stRes = await fetch(`${API}/api/admin/batches/${batchId}/students?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (stRes.ok) {
        const stData = await stRes.json()
        const stList = stData.students || []

        const liveAbsMap = {}
        const liveAbsList = snapData?.liveAbsentees || []
        liveAbsList.forEach(a => {
          const key = a.student_id || a.id || a.prn || a.email
          if (key) liveAbsMap[key] = true
          if (a.id) liveAbsMap[a.id] = true
          if (a.prn) liveAbsMap[a.prn] = true
        })

        const attMap = snapData?.attendanceMap || {}
        const initialMap = {}
        const enrichedStudents = stList.map(s => {
          const idKey = s.student_id || s.id || s.prn || s.email
          const attInfo = attMap[s.id] || attMap[s.student_id]
          const liveAbsObj = liveAbsList.find(a => 
            String(a.student_id) === String(s.id) || 
            String(a.id) === String(s.id) || 
            (s.prn && String(a.prn) === String(s.prn))
          )
          const isDnr = Boolean(s.is_dnr || liveAbsObj?.is_dnr || attInfo?.is_dnr)
          const pct = attInfo ? attInfo.attendance_percentage : null
          const isEligibleAbsentee = !!(
            isDnr ||
            liveAbsMap[idKey] ||
            liveAbsMap[s.id] ||
            (s.prn && liveAbsMap[s.prn]) ||
            (attInfo && attInfo.total_count > 0 && attInfo.attendance_percentage < 30.0)
          )
          if (isEligibleAbsentee) {
            initialMap[idKey] = true
          }
          return {
            ...s,
            attendance_percentage: pct,
            present_count: attInfo ? attInfo.present_count : 0,
            total_count: attInfo ? attInfo.total_count : 0,
            is_absent: isEligibleAbsentee,
            is_dnr: isDnr,
            dnr_marked_at: liveAbsObj?.dnr_marked_at || s.dnr_marked_at,
            dnr_marked_by_name: liveAbsObj?.dnr_marked_by_name || s.dnr_marked_by_name,
            dnr_reason: liveAbsObj?.dnr_reason || s.dnr_reason,
            absentee_type: isDnr ? 'DNR (Did Not Report)' : (liveAbsObj?.absentee_type || (attInfo?.attendance_percentage < 30 ? 'Low Attendance (<30%)' : 'Absentee')),
            is_locked: s.is_locked !== undefined ? !!s.is_locked : (attInfo ? !!attInfo.is_locked : false)
          }
        })

        setStudents(enrichedStudents)
        setAbsentMap(initialMap)
      } else {
        toast('Failed to load batch students.', 'error')
      }
    } catch (err) {
      toast('Error loading absentees data.', 'error')
    } finally {
      setLoading(false)
    }
  }, [batchId, token, toast])

  const handleConfirmLockAccount = async () => {
    if (!lockTargetStudent) return
    setIsLockingAccount(true)
    const studentId = lockTargetStudent.id || lockTargetStudent.student_id
    try {
      const res = await fetch(`${API}/api/admin/students/${studentId}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to lock student account')
      }
      toast(data.message || `Account for ${lockTargetStudent.name} locked successfully.`, 'success')

      // Update local student records so UI immediately reflects locked state
      setStudents(prev => prev.map(st => {
        const idKey = st.student_id || st.id || st.prn || st.email
        const targetKey = lockTargetStudent.student_id || lockTargetStudent.id || lockTargetStudent.prn || lockTargetStudent.email
        const isMatch = (idKey === targetKey) ||
                        (st.id && String(st.id) === String(studentId)) ||
                        (st.student_id && String(st.student_id) === String(studentId)) ||
                        (st.prn && lockTargetStudent.prn && st.prn === lockTargetStudent.prn)
        return isMatch ? { ...st, is_locked: true } : st
      }))
      setLockTargetStudent(null)
    } catch (err) {
      toast(err.message || 'Error locking student account', 'error')
    } finally {
      setIsLockingAccount(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleAbsent = (idKey) => {
    if (hasSnapshot && !isEditing) return
    setAbsentMap(prev => ({
      ...prev,
      [idKey]: !prev[idKey]
    }))
  }

  const markAllFilteredAbsent = (flag = true) => {
    if (hasSnapshot && !isEditing) return
    setAbsentMap(prev => {
      const nextMap = { ...prev }
      filteredStudents.forEach(s => {
        const key = s.student_id || s.id || s.prn || s.email
        if (flag) {
          nextMap[key] = true
        } else {
          delete nextMap[key]
        }
      })
      return nextMap
    })
  }

  const handleSaveSnapshot = async () => {
    setSaving(true)
    try {
      const payloadStudents = students.map(s => {
        const idKey = s.student_id || s.id || s.prn || s.email
        return {
          id: s.id || s.student_id || null,
          prn: s.prn || '',
          name: s.name || '',
          email: s.email || '',
          squad: s.squad || '—',
          panel: s.panel || '—',
          department: s.department || '—',
          semester: s.semester || '—',
          program: s.program || '—',
          gender: s.gender || '—',
          roll_number: s.roll_number || '—',
          is_absent: !!absentMap[idKey]
        }
      })

      const res = await fetch(`${API}/api/admin/batches/${batchId}/absentees-snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          students: payloadStudents,
          allow_overwrite: isEditing
        })
      })

      const data = await res.json()
      if (res.ok) {
        toast('Absentees Snapshot saved permanently!', 'success')
        setShowSaveModal(false)
        setIsEditing(false)
        loadData()
      } else {
        toast(data.message || 'Failed to save snapshot.', 'error')
      }
    } catch (err) {
      toast('Network error saving snapshot.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const downloadExcelReport = () => {
    if (!students || students.length === 0) return
    const exportData = students.map((s, idx) => {
      const idKey = s.student_id || s.id || s.prn || s.email
      const isAbs = !!absentMap[idKey]
      const isDnr = !!(s.is_dnr || absentMap[idKey]?.is_dnr)
      const absenteeType = isDnr ? 'DNR (Did Not Report)' : (isAbs ? 'Attendance < 30%' : 'PRESENT')
      return {
        '#': idx + 1,
        'PRN / Student ID': s.prn || '—',
        'Student Name': s.name || '—',
        'Email': formatStudentEmail(s.email, 'Not provided'),
        'Squad': s.squad || '—',
        'Panel': s.panel || '—',
        'Department': s.department || '—',
        'Program': s.program || '—',
        'Gender': s.gender || '—',
        'Attendance %': s.attendance_percentage !== null && s.attendance_percentage !== undefined ? `${s.attendance_percentage}%` : '—',
        'Attendance Status': isAbs ? 'ABSENT' : 'PRESENT',
        'Absentee Category': isAbs ? absenteeType : 'PRESENT',
        'DNR Marked By': s.dnr_marked_by_name || '—',
        'Snapshot Date': snapshot?.created_at ? new Date(snapshot.created_at).toLocaleDateString() : new Date().toLocaleDateString()
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Absentees Snapshot')
    XLSX.writeFile(workbook, `Batch_Absentees_Snapshot_${batchName || batchId}.xlsx`)
  }

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const idKey = s.student_id || s.id || s.prn || s.email
      const isAbs = !!absentMap[idKey]

      if (statusFilter === 'ABSENT' && !isAbs) return false
      if (statusFilter === 'DNR' && (!isAbs || !s.is_dnr)) return false
      if (statusFilter === 'PRESENT' && isAbs) return false

      if (squadFilter !== 'ALL' && (s.squad || '').toLowerCase() !== squadFilter.toLowerCase()) {
        return false
      }

      if (search) {
        const q = search.toLowerCase()
        const nameMatch = (s.name || '').toLowerCase().includes(q)
        const prnMatch = (s.prn || '').toLowerCase().includes(q)
        const emailMatch = (s.email || '').toLowerCase().includes(q)
        const squadMatch = (s.squad || '').toLowerCase().includes(q)
        if (!nameMatch && !prnMatch && !emailMatch && !squadMatch) return false
      }
      return true
    })
  }, [students, absentMap, statusFilter, squadFilter, search])

  const totalAbsentCount = useMemo(() => {
    return students.filter(s => {
      const idKey = s.student_id || s.id || s.prn || s.email
      return !!absentMap[idKey]
    }).length
  }, [students, absentMap])

  const totalPresentCount = students.length - totalAbsentCount

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredStudents.slice(start, start + itemsPerPage)
  }, [filteredStudents, currentPage, itemsPerPage])

  return (
    <div className="batch-absentees-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Absentees Management
              </h3>
              {hasSnapshot && !isEditing ? (
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} /> Permanent Snapshot Saved
                </span>
              ) : isEditing ? (
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Unlock size={12} /> Editing Mode
                </span>
              ) : (
                <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  Draft
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', marginBottom: 0 }}>
              {hasSnapshot && snapshot
                ? `Saved on ${new Date(snapshot.created_at).toLocaleDateString()} by ${snapshot.created_by_name || 'Admin'}`
                : 'Select absent students for this batch and click Save Snapshot.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {hasSnapshot && !isEditing && (
              <button
                className="btn"
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                onClick={() => setShowUnlockModal(true)}
              >
                <Unlock size={13} /> Edit Snapshot
              </button>
            )}

            <button
              className="btn"
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
              onClick={downloadExcelReport}
            >
              <Download size={13} /> Download Excel
            </button>

            {(!hasSnapshot || isEditing) && (
              <button
                className="btn"
                style={{ background: '#154388', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '12.5px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                onClick={() => setShowSaveModal(true)}
              >
                <Shield size={13} /> Save Snapshot
              </button>
            )}
          </div>
        </div>

        {/* Minimal Counters */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Total Students</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{students.length}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Absentees</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>{totalAbsentCount}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Present</span>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{totalPresentCount}</div>
          </div>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div className="search-box" style={{ minWidth: '200px', maxWidth: '280px' }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search Name, PRN, Email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 'auto', minWidth: '120px', height: '36px', borderRadius: '8px', fontSize: '12px' }}
            value={squadFilter}
            onChange={e => { setSquadFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Squads</option>
            {SQUAD_NAMES.map(sq => (
              <option key={sq} value={sq}>{sq}</option>
            ))}
          </select>

          <select
            className="input-field"
            style={{ width: 'auto', minWidth: '120px', height: '36px', borderRadius: '8px', fontSize: '12px' }}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ABSENT">Absentees Only</option>
            <option value="DNR">DNR Only (Did Not Report)</option>
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present Only</option>
          </select>
        </div>

        {(!hasSnapshot || isEditing) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn"
              style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              onClick={() => markAllFilteredAbsent(true)}
            >
              Mark Filtered Absent
            </button>
            <button
              className="btn"
              style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              onClick={() => markAllFilteredAbsent(false)}
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
            <div style={{ fontSize: '13px' }}>Loading absentees records...</div>
          </div>
        ) : paginatedStudents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No student records found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
                  <th style={{ padding: '10px 14px', width: '50px' }}>Mark</th>
                  <th style={{ padding: '10px 14px' }}>Student Name</th>
                  <th style={{ padding: '10px 14px' }}>PRN</th>
                  <th style={{ padding: '10px 14px' }}>Squad / Panel</th>
                  <th style={{ padding: '10px 14px' }}>Department</th>
                  <th style={{ padding: '10px 14px' }}>Attendance</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Account Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map(s => {
                  const idKey = s.student_id || s.id || s.prn || s.email
                  const isAbs = !!absentMap[idKey]
                  const isDnr = !!(s.is_dnr || (absentMap[idKey] && absentMap[idKey].is_dnr))
                  return (
                    <tr
                      key={idKey}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isAbs ? '#fff5f5' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="checkbox"
                          disabled={hasSnapshot && !isEditing}
                          checked={isAbs}
                          onChange={() => toggleAbsent(idKey)}
                          style={{ width: '16px', height: '16px', cursor: (hasSnapshot && !isEditing) ? 'not-allowed' : 'pointer', accentColor: '#dc2626' }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{formatStudentEmail(s.email, 'Not provided')}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <code style={{ fontSize: '12px', color: '#475569' }}>{s.prn || '—'}</code>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155' }}>
                        <div>{s.squad || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{s.panel || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155' }}>
                        <div>{s.department || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{s.program || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                        {s.attendance_percentage !== null && s.attendance_percentage !== undefined ? (
                          <span style={{
                            fontWeight: '700',
                            fontSize: '11.5px',
                            color: s.attendance_percentage < 30 ? '#dc2626' : '#16a34a',
                            background: s.attendance_percentage < 30 ? '#fee2e2' : '#dcfce7',
                            border: `1px solid ${s.attendance_percentage < 30 ? '#fca5a5' : '#86efac'}`,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'inline-block'
                          }}>
                            {s.attendance_percentage}%
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Unmarked</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {isAbs ? (
                          isDnr ? (
                            <div>
                              <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                DNR
                              </span>
                              {s.dnr_marked_by_name && (
                                <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px', whiteSpace: 'nowrap' }} title={`Marked by ${s.dnr_marked_by_name}`}>
                                  by {s.dnr_marked_by_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                ABSENT
                              </span>
                              <div style={{ fontSize: '10px', color: '#b45309', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                &lt;30% Att.
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                            PRESENT
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {s.is_locked ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#64748b',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            cursor: 'default'
                          }}>
                            <Lock size={12} /> Locked
                          </span>
                        ) : isAbs ? (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#dc2626',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }}
                            onClick={() => setLockTargetStudent(s)}
                            title={`Lock account for ${s.name}`}
                          >
                            <Lock size={12} /> Lock Account
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
            <div className="pagination" style={{ margin: 0 }}>
              <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  className={`pagination-btn ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="pagination-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clean Save Confirmation Modal */}
      {showSaveModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', maxWidth: '440px', width: '90%', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Save Absentees Snapshot?
            </h4>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px 0' }}>
              This will record <strong>{totalAbsentCount}</strong> absent students and <strong>{totalPresentCount}</strong> present students for Batch {batchName || batchId}.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
              Note: This historical snapshot will remain saved even if user accounts are removed in the future.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn"
                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => setShowSaveModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#154388', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 16px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
                onClick={handleSaveSnapshot}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Lock Confirmation Modal */}
      {lockTargetStudent && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <Lock size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Lock Student Account?
                </h4>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Confirm direct account locking</span>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                {lockTargetStudent.name}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>PRN:</span>
                <code style={{ fontFamily: 'monospace' }}>{lockTargetStudent.prn || '—'}</code>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Email:</span>
                <span style={{ wordBreak: 'break-all' }}>{formatStudentEmail(lockTargetStudent.email, 'Not provided')}</span>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Squad/Panel:</span>
                <span>{lockTargetStudent.squad || '—'} / {lockTargetStudent.panel || '—'}</span>
              </div>
            </div>

            <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#9f1239', marginBottom: '20px', lineHeight: '1.4' }}>
              <strong>Important:</strong> Locking this account will immediately revoke portal access for this student. They will no longer be able to log in to the student portal.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 16px', fontSize: '12.5px', fontWeight: '600', cursor: isLockingAccount ? 'not-allowed' : 'pointer' }}
                onClick={() => setLockTargetStudent(null)}
                disabled={isLockingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12.5px', fontWeight: '600', cursor: isLockingAccount ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handleConfirmLockAccount}
                disabled={isLockingAccount}
              >
                {isLockingAccount ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Locking...
                  </>
                ) : (
                  <>
                    <Lock size={14} /> Lock Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Unlock Confirmation Modal */}
      {showUnlockModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '12px', padding: '20px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              Unlock Snapshot for Editing?
            </h4>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 16px 0' }}>
              Unlock this snapshot to modify marked absentees and save an updated historical record.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn"
                style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => setShowUnlockModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#154388', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => {
                  setIsEditing(true)
                  setShowUnlockModal(false)
                  toast('Snapshot unlocked for editing.', 'info')
                }}
              >
                Unlock Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Batch Detail View ────────────────────────────────────────────────────────
// ─── Hierarchy Assign Modal (post-creation) ───────────────────────────────────
// ─── Hierarchy Assign Modal (post-creation) ───────────────────────────────────
function AssignStudentsModal({ open, onClose, batchId, batchName, token, toast, onDone, batchCapacity = 350 }) {
  const [students, setStudents] = useState([])
  const [alreadyAssignedIds, setAlreadyAssignedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Load students & current batch members on modal open
  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelectedClass('')
      setSelectedSchool('')
      setSelectedIds(new Set())
      return
    }

    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [allRes, batchRes] = await Promise.all([
          fetch(`${API}/api/admin/la/students`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API}/api/admin/la/batches/${batchId}/students`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ])

        if (!isMounted) return

        if (allRes.ok) {
          const allData = await allRes.json()
          setStudents(allData.students || [])
        }

        if (batchRes.ok) {
          const batchData = await batchRes.json()
          const assigned = new Set((batchData.students || []).map(s => s.id))
          setAlreadyAssignedIds(assigned)
        }
      } catch (err) {
        console.error('Error fetching students for assignment:', err)
        toast('Failed to load students list.', 'error')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => { isMounted = false }
  }, [open, batchId, token])

  // Dynamic school list from students
  const availableSchools = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      if (s.school && String(s.school).trim()) set.add(String(s.school).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students])

  // Filter students based on search and dropdowns
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter(s => {
      if (q) {
        const matchesName = (s.name || '').toLowerCase().includes(q)
        const matchesId = (s.student_id || '').toLowerCase().includes(q) || String(s.id).includes(q)
        const matchesP1 = (s.parent1_email || '').toLowerCase().includes(q)
        const matchesP2 = (s.parent2_email || '').toLowerCase().includes(q)
        const matchesRoll = (s.roll_number || '').toLowerCase().includes(q)
        const matchesSchool = (s.school || '').toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesP1 && !matchesP2 && !matchesRoll && !matchesSchool) {
          return false
        }
      }

      if (selectedClass) {
        const normSClass = String(s.class_grade || '').trim().toLowerCase()
        const normTarget = selectedClass.trim().toLowerCase()
        if (normSClass !== normTarget) return false
      }

      if (selectedSchool && (s.school || '').trim().toLowerCase() !== selectedSchool.trim().toLowerCase()) {
        return false
      }

      return true
    })
  }, [students, search, selectedClass, selectedSchool])

  // Selectable students: unassigned students only (not in this batch AND not in any other batch)
  const selectableFiltered = useMemo(() => {
    return filteredStudents.filter(s => {
      const inCurrent = alreadyAssignedIds.has(s.id) || (s.batches && s.batches.some(b => b.id === batchId))
      const inOther = (s.batches || []).some(b => b.id !== batchId)
      return !inCurrent && !inOther
    })
  }, [filteredStudents, alreadyAssignedIds, batchId])

  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every(s => selectedIds.has(s.id))

  const handleToggleSelectAll = () => {
    const next = new Set(selectedIds)
    if (allFilteredSelected) {
      for (const s of selectableFiltered) next.delete(s.id)
    } else {
      for (const s of selectableFiltered) next.add(s.id)
    }
    setSelectedIds(next)
  }

  const handleToggleStudent = (s) => {
    const inCurrent = alreadyAssignedIds.has(s.id) || (s.batches && s.batches.some(b => b.id === batchId))
    const inOther = (s.batches || []).some(b => b.id !== batchId)
    if (inCurrent || inOther) return
    const next = new Set(selectedIds)
    if (next.has(s.id)) next.delete(s.id)
    else next.add(s.id)
    setSelectedIds(next)
  }

  const handleAssign = async () => {
    if (selectedIds.size === 0) {
      toast('Please select at least one student to assign.', 'error')
      return
    }

    setAssigning(true)
    try {
      const res = await fetch(`${API}/api/admin/la/batches/${batchId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ student_ids: Array.from(selectedIds) })
      })

      const data = await res.json()
      if (res.ok) {
        toast(data.message || `${data.added || selectedIds.size} students assigned successfully.`, 'success')
        if (onDone) onDone()
        onClose()
      } else {
        const errorMsg = data.conflicts && data.conflicts.length > 0
          ? `${data.message || 'Conflicting assignments'}: ${data.conflicts.map(c => `${c.name} (${c.batch})`).join(', ')}`
          : (data.message || 'Failed to assign students to batch.')
        toast(errorMsg, 'error')
      }
    } catch (err) {
      toast('Error connecting to server.', 'error')
    } finally {
      setAssigning(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="modal"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          width: '100%',
          maxWidth: '860px',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 45px rgba(0,0,0,0.18)',
          background: '#ffffff'
        }}
      >
        {/* Header */}
        <div style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '850', color: '#0f172a', margin: 0 }}>
              Assign Students to Batch
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0' }}>
              Target Batch: <strong style={{ color: '#154388' }}>{batchName || `Batch #${batchId}`}</strong> · Students from different classes (6th–10th) & schools can be assigned together
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', padding: 6, background: '#e2e8f0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#ffffff' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '2 1 220px', minWidth: '200px' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '11px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search by student name, ID, parent email, roll no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '12.5px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                color: '#0f172a',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Class Filter */}
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '12.5px',
              backgroundColor: selectedClass ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${selectedClass ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: '8px',
              outline: 'none',
              color: selectedClass ? '#1d4ed8' : '#475569',
              fontWeight: selectedClass ? '600' : '400',
              flex: '1 1 120px',
              cursor: 'pointer'
            }}
          >
            <option value="">All Classes</option>
            <option value="6th">Class 6th</option>
            <option value="7th">Class 7th</option>
            <option value="8th">Class 8th</option>
            <option value="9th">Class 9th</option>
            <option value="10th">Class 10th</option>
          </select>

          {/* School Filter */}
          <select
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '12.5px',
              backgroundColor: selectedSchool ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${selectedSchool ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: '8px',
              outline: 'none',
              color: selectedSchool ? '#1d4ed8' : '#475569',
              fontWeight: selectedSchool ? '600' : '400',
              flex: '1 1 140px',
              cursor: 'pointer'
            }}
          >
            <option value="">All Schools</option>
            {availableSchools.map(sch => (
              <option key={sch} value={sch}>{sch}</option>
            ))}
          </select>
        </div>

        {/* Selection Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0', maxHeight: '420px' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div className="spinner spinner-sm" />
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Loading student directory…</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No students found matching your search.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '10px 14px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleSelectAll}
                      disabled={selectableFiltered.length === 0}
                      title="Select all filtered students"
                      style={{ cursor: selectableFiltered.length === 0 ? 'not-allowed' : 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b' }}>Student ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b' }}>Student Name</th>
                  <th style={{ padding: '10px 12px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b' }}>Class</th>
                  <th style={{ padding: '10px 12px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b' }}>School & Branch</th>
                  <th style={{ padding: '10px 12px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b' }}>Parent Email</th>
                  <th style={{ padding: '10px 14px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10.5px', color: '#64748b', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => {
                  const isAssigned = alreadyAssignedIds.has(s.id) || (s.batches && s.batches.some(b => b.id === batchId))
                  const otherBatch = (s.batches || []).find(b => b.id !== batchId)
                  const isSelectable = !isAssigned && !otherBatch
                  const isChecked = selectedIds.has(s.id)
                  return (
                    <tr
                      key={s.id}
                      onClick={() => isSelectable && handleToggleStudent(s)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isChecked ? '#eff6ff' : isAssigned ? '#fafafa' : otherBatch ? '#fff5f5' : '#ffffff',
                        cursor: isSelectable ? 'pointer' : 'not-allowed',
                        transition: 'background 0.12s'
                      }}
                      className={isSelectable ? "hover:bg-slate-50" : ""}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isSelectable}
                          onChange={() => handleToggleStudent(s)}
                          style={{ cursor: isSelectable ? 'pointer' : 'not-allowed' }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '750', color: '#154388' }}>
                        {s.student_id || `LA-${String(s.id).padStart(5, '0')}`}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155' }}>
                        {s.class_grade || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        <div>{s.school || '—'}</div>
                        {s.school_branch && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Branch: {s.school_branch}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#2563eb', fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {s.parent1_email || s.parent2_email || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {isAssigned ? (
                          <span style={{ fontSize: '10.5px', fontWeight: '750', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '4px' }}>
                            Already in batch
                          </span>
                        ) : otherBatch ? (
                          <span
                            title={`Already assigned to ${otherBatch.name}. A student can belong to only one batch.`}
                            style={{ fontSize: '10.5px', fontWeight: '750', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}
                          >
                            In {otherBatch.name}
                          </span>
                        ) : isChecked ? (
                          <span style={{ fontSize: '10.5px', fontWeight: '750', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px' }}>
                            Selected
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '600' }}>Available</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '13px', color: '#334155', fontWeight: '600' }}>
            <span style={{ color: '#154388', fontWeight: '800' }}>{selectedIds.size}</span> student{selectedIds.size === 1 ? '' : 's'} selected
            {selectableFiltered.length > 0 && (
              <span style={{ color: '#64748b', fontWeight: '400', marginLeft: '6px' }}>
                ({selectableFiltered.length} available in filter)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-outline"
              onClick={onClose}
              disabled={assigning}
              style={{ borderRadius: '10px', padding: '8px 16px', fontSize: '13px', background: '#ffffff' }}
            >
              Cancel
            </button>
            <button
              className="btn"
              onClick={handleAssign}
              disabled={assigning || selectedIds.size === 0}
              style={{
                borderRadius: '10px',
                padding: '8px 20px',
                fontSize: '13px',
                background: '#154388',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: (assigning || selectedIds.size === 0) ? 'not-allowed' : 'pointer'
              }}
            >
              {assigning ? (
                <><div className="spinner spinner-sm" /> Assigning…</>
              ) : (
                <><CheckCircle size={14} /> Assign to Batch ({selectedIds.size})</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function BatchDetail({ batch, token, toast, onBack, onRefresh }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('students')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [batchBulkFile, setBatchBulkFile] = useState(null)
  const [batchBulkData, setBatchBulkData] = useState({ students: [], errors: [] })
  const [batchIsUploading, setBatchIsUploading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentBatch, setCurrentBatch] = useState(batch)
  const [downloadingAtt, setDownloadingAtt] = useState(false)
  const [downloadingMarks, setDownloadingMarks] = useState(false)
  const [downloadingStudentShirts, setDownloadingStudentShirts] = useState(false)
  const [downloadingFacultyShirts, setDownloadingFacultyShirts] = useState(false)

  const downloadAttendanceExcel = async () => {
    setDownloadingAtt(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batch.id}/squads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const squadData = studentsRes.ok ? await studentsRes.json() : {}
      const studentsList = squadData.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export.', 'warning')
        setDownloadingAtt(false)
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []

      schedulesList.sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')))

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      const rows = buildAdminAttendanceExportRows(studentsList, recordsList, schedulesList)

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['Bus Detail: __________'],
        ['Faculty Name: __________'],
        ['Total Present: ______'],
        ['Total Absent: ______']
      ], { origin: -1 })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Report")
      XLSX.writeFile(wb, `${currentBatch?.name || 'Batch'}_Attendance_Report.xlsx`)
      toast('Attendance report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download attendance report.', 'error')
    } finally {
      setDownloadingAtt(false)
    }
  }

  const downloadMarksExcel = async () => {
    setDownloadingMarks(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batch.id}/squads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const squadData = studentsRes.ok ? await studentsRes.json() : {}
      const studentsList = squadData.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export.', 'warning')
        setDownloadingMarks(false)
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []

      const evalsRes = await fetch(`${API}/api/faculty/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const evalsData = evalsRes.ok ? await evalsRes.json() : {}
      const evaluationsList = evalsData.evaluations || []
      const summariesList = evalsData.summaries || []

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      // Sort students panel-wise
      const sortedStudents = [...studentsList].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      exportLtcExcel({
        title: 'Life Awakening Program (LTC) - Student Evaluation Report',
        batchName: currentBatch?.name || batch?.name || 'LTC Batch',
        students: sortedStudents,
        schedules: schedulesList,
        attendanceData: recordsList,
        evaluationData: evaluationsList,
        summaryData: summariesList,
        filename: `${currentBatch?.name || batch?.name || 'LTC'}_Marks_Report.xlsx`
      })

      toast('Marks report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download marks report.', 'error')
    } finally {
      setDownloadingMarks(false)
    }
  }

  const downloadStudentShirtSizes = async () => {
    setDownloadingStudentShirts(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}/students?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.ok ? await res.json() : {}
      const studentsList = data.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export shirt sizes.', 'warning')
        setDownloadingStudentShirts(false)
        return
      }

      // Sort students panel-wise then name-wise
      const sortedStudents = [...studentsList].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      const rows = sortedStudents.map(s => ({
        'Name': s.name || '—',
        'PRN': s.prn || '—',
        'Undertaking Status': s.undertaking_submitted ? 'Submitted' : 'Pending',
        'Photo Consent': s.photo_video_consent ? 'Accepted' : 'Declined',
        'T-Shirt Size': s.tshirt_size || 'Pending Submission',
        'T-Shirt Consent': s.tshirt_consent ? 'Accepted' : 'Declined',
        'Data Consent': s.data_consent ? 'Accepted' : 'Declined',
        'Bag Check Consent': s.bag_check_consent ? 'Accepted' : 'Declined'
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Student Shirt Sizes")
      XLSX.writeFile(wb, `${currentBatch.name || 'Batch'}_Student_Shirt_Sizes.xlsx`)
      toast('Student shirt sizes report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download student shirt sizes.', 'error')
    } finally {
      setDownloadingStudentShirts(false)
    }
  }

  const downloadFacultyShirtSizes = async () => {
    setDownloadingFacultyShirts(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}/faculty`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.ok ? await res.json() : {}
      const facultyList = data.faculty || []

      if (facultyList.length === 0) {
        toast('No faculty found in this batch to export shirt sizes.', 'warning')
        setDownloadingFacultyShirts(false)
        return
      }

      const rows = facultyList.map(f => ({
        'Name': f.name,
        'T-Shirt Size': f.tshirt_size || 'Pending Submission'
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Faculty Shirt Sizes")
      XLSX.writeFile(wb, `${currentBatch.name || 'Batch'}_Faculty_Shirt_Sizes.xlsx`)
      toast('Faculty shirt sizes report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download faculty shirt sizes.', 'error')
    } finally {
      setDownloadingFacultyShirts(false)
    }
  }

  const handleBatchFileUpload = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setBatchBulkFile(file)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' })
        
        const students = []
        const errors = []

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2
          const name = row['Student Full Name '] || row['Student Full Name'] || row['Name'] || row['Full Name'] || row['name']
          const classGrade = row['Class / Standard '] || row['Class / Standard'] || row['Class'] || row['class_grade']
          const p1 = row['Email Address1'] || row['Parent Email 1'] || row['Parent 1 Email'] || row['parent_email_1'] || row['Email']
          const p2 = row['Email Address 2'] || row['Parent Email 2'] || row['Parent 2 Email'] || row['parent_email_2']
          const school = row['Name of the School'] || row['School'] || row['school']
          const schoolBranch = row['School Branch'] || row['Branch'] || row['school_branch']
          const division = row['Division'] || row['division']
          const phone = row["Contact Number (Valid What's App Mobile Number)"] || row['Contact Number'] || row['phone']
          const paymentUrl = row['Upload Payment Screenshot'] || row['payment_screenshot_url']

          if (!name) {
            errors.push({ row: `Row ${rowNum}`, error: 'Missing Student Full Name' })
            return
          }
          students.push({
            name,
            class_grade: classGrade,
            parent_email_1: p1,
            parent_email_2: p2,
            school,
            school_branch: schoolBranch,
            division,
            phone,
            payment_screenshot_url: paymentUrl
          })
        })

        setBatchBulkData({ students, errors })
      } catch (err) {
        toast('Failed to read file: ' + err.message, 'error')
      }
    }
    reader.readAsBinaryString(file)
  }

  const submitBatchBulkUpload = async () => {
    if (!batchBulkFile) {
      toast('Please select an Excel or CSV file first.', 'warning')
      return
    }
    setBatchIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', batchBulkFile)
      formData.append('duplicateAction', 'replace')
      formData.append('batchId', batch.id)

      const res = await fetch(`${API}/api/admin/bulk-upload?batchId=${batch.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Bulk upload failed')
      }

      const data = await res.json()
      const jobId = data.jobId

      const pollTimer = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API}/api/admin/upload-jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (!pollRes.ok) {
            clearInterval(pollTimer)
            setBatchIsUploading(false)
            toast('Failed checking upload progress', 'error')
            return
          }
          const pollData = await pollRes.json()
          const job = pollData.job
          if (job && (job.status === 'completed' || job.status === 'failed')) {
            clearInterval(pollTimer)
            setBatchIsUploading(false)
            if (job.status === 'completed') {
              toast(`Successfully uploaded & enrolled ${job.success_count || 0} students into ${currentBatch?.name || 'batch'}!`, 'success')
              setRefreshKey(k => k + 1)
              if (tab !== 'students') setTab('students')
              if (onRefresh) onRefresh()
              fetchCurrentBatchDetails()
              setTimeout(() => setShowBulkModal(false), 800)
            } else {
              toast(`Upload job failed: ${job.error_message || 'Unknown error'}`, 'error')
            }
          }
        } catch (pollErr) {
          clearInterval(pollTimer)
          setBatchIsUploading(false)
        }
      }, 1500)
    } catch (err) {
      setBatchIsUploading(false)
      toast(err.message || 'Upload failed', 'error')
    }
  }

  const fetchCurrentBatchDetails = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentBatch(data.batch)
      }
    } catch (err) {
      console.error("Error fetching batch details:", err)
    }
  }, [batch.id, token])

  useEffect(() => {
    fetchCurrentBatchDetails()
  }, [refreshKey, fetchCurrentBatchDetails])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const statusColor = { active: 'green', upcoming: 'blue', completed: 'gray', archived: 'gray' }[currentBatch.status] || 'gray'

  return (
    <div className="batch-management-page animate-fade-in">
      <style>{`
        .batch-detail-header-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .batch-details-tab-container {
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
          padding: 0;
          margin-bottom: 30px;
        }
        @media (max-width: 768px) {
          .batch-detail-header-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .batch-detail-header-back-btn {
            width: fit-content !important;
          }
          .batch-detail-header-title {
            font-size: 20px !important;
            margin: 0 !important;
          }
          .batch-detail-header-counts {
            display: flex !important;
            gap: 8px !important;
            margin-left: 0 !important;
            width: 100% !important;
          }
          .batch-detail-header-counts span {
            flex: 1 !important;
            justify-content: center !important;
          }
          .batch-detail-header-actions {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            width: 100% !important;
            margin-left: 0 !important;
          }
          .batch-detail-header-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          #batch-detail-tabs-section {
            width: 100% !important;
            overflow-x: auto !important;
          }
          #batch-detail-tabs-section .tabs {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            width: 100% !important;
            padding-bottom: 6px !important;
          }
          #batch-detail-tabs-section .tabs button {
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
        }
        @media (max-width: 640px) {
          .batch-details-tab-container {
            padding: 0 !important;
          }
        }
      `}</style>
      <div className="batch-detail-header-container">
        <button 
          className="btn btn-outline batch-detail-header-back-btn" 
          onClick={onBack}
          style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
        >
          <ChevronLeft size={15} /> All Batches
        </button>
        <h2 className="batch-detail-header-title" style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{currentBatch.name}</h2>
        <span className={`badge badge-${statusColor} status-${currentBatch.status} batch-detail-header-status`}>{t(currentBatch.status)}</span>

        <div className="batch-detail-header-counts" style={{ display: 'flex', gap: '8px', marginLeft: '12px', alignItems: 'center' }}>
          <span className="badge" style={{ background: '#154388', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '50px', fontSize: '12.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            Boys: {currentBatch.boys_count || 0}
          </span>
          <span className="badge" style={{ background: '#db2777', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '50px', fontSize: '12.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
            Girls: {currentBatch.girls_count || 0}
          </span>
        </div>
        <div className="batch-detail-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn batch-detail-header-bulk-btn"
            style={{
              background: '#ea580c',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '9px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '700',
              fontSize: '13.5px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              transition: 'all 0.15s ease'
            }}
            onClick={() => {
              setBatchBulkFile(null)
              setBatchBulkData({ students: [], errors: [] })
              setShowBulkModal(true)
            }}
          >
            <UploadCloud size={15} /> Bulk Upload Students
          </button>
          <button
            type="button"
            className="btn batch-detail-header-assign-btn"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              padding: '9px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '600',
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
            onClick={() => setShowAssignModal(true)}
          >
            <UserPlus size={15} /> Assign Students
          </button>
        </div>
      </div>

      <div id="batch-detail-tabs-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: '12px' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {[
            { key: 'students', label: 'Students', icon: <GraduationCap size={13} /> },
            { key: 'faculty', label: 'MIT & LTC Faculty', icon: <Users size={13} /> },
            { key: 'squads', label: 'Squad Allocation', icon: <Shield size={13} /> },
            { key: 'attendance', label: 'Attendance', icon: <ClipboardList size={13} /> },
            { key: 'undertakings', label: 'Undertakings', icon: <FileText size={13} /> },
            { key: 'absentees', label: 'Absentees', icon: <UserX size={13} /> },
            { key: 'breakdown', label: 'Students Breakdown', icon: null },
          ].map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="batch-details-tab-container">
        {tab === 'students' && <BatchStudentsTab batchId={batch.id} batchName={currentBatch?.name || batch?.name} token={token} toast={toast} key={`students-${refreshKey}`} onRefresh={onRefresh} />}
        {tab === 'faculty' && <BatchFacultyTab batchId={batch.id} token={token} toast={toast} key={`faculty-${refreshKey}`} onRefresh={onRefresh} />}
        {tab === 'squads' && <SquadAllocationTab batchId={batch.id} batchName={batch.name || currentBatch?.name} token={token} toast={toast} key={`squads-${refreshKey}`} />}
        {tab === 'attendance' && <BatchAttendanceTab batchId={batch.id} token={token} toast={toast} key={`attendance-${refreshKey}`} />}
        {tab === 'undertakings' && <BatchUndertakingsTab batchId={batch.id} token={token} toast={toast} key={`undertakings-${refreshKey}`} />}
        {tab === 'absentees' && <BatchAbsenteesTab batchId={batch.id} batchName={batch.name || currentBatch?.name} token={token} toast={toast} key={`absentees-${refreshKey}`} />}
        {tab === 'breakdown' && <BatchStudentsBreakdownTab batchId={batch.id} batchName={batch.name || currentBatch?.name} token={token} toast={toast} key={`breakdown-${refreshKey}`} />}
      </div>

      <AssignStudentsModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        batchId={batch.id}
        batchName={currentBatch?.name || batch?.name}
        token={token}
        toast={toast}
        batchCapacity={currentBatch?.capacity || 350}
        onDone={() => {
          setRefreshKey(k => k + 1)
          if (tab !== 'students') setTab('students')
          if (onRefresh) onRefresh()
        }}
      />

      {showBulkModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Bulk Upload Students into {currentBatch?.name || `Batch #${batch.id}`}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Mixed-class enrollment: Students from 6th to 10th standard and all schools are supported.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            <BulkUploadModule
              isLtcUpload={false}
              bulkData={batchBulkData}
              isUploading={batchIsUploading}
              handleFileUpload={handleBatchFileUpload}
              submitBulkUpload={submitBatchBulkUpload}
              lockedBatchId={batch.id}
              lockedBatchName={currentBatch?.name || batch?.name}
              uploadedFileName={batchBulkFile?.name}
              onClearFile={() => {
                setBatchBulkFile(null)
                setBatchBulkData({ students: [], errors: [] })
              }}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main BatchManagement Component ──────────────────────────────────────────
export default function BatchManagementModule({ token, onBatchesChange, initialSelectedBatch = null, onClearInitialBatch }) {
  const { t } = useLanguage()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editBatch, setEditBatch] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming')
  const { toasts, toast } = useToast()
  const [batchToDelete, setBatchToDelete] = useState(null)

  const [downloadingAtt, setDownloadingAtt] = useState(false)
  const [downloadingMarks, setDownloadingMarks] = useState(false)
  const [downloadingStudentShirts, setDownloadingStudentShirts] = useState(false)
  const [downloadingFacultyShirts, setDownloadingFacultyShirts] = useState(false)
  const [downloadingHardCopy, setDownloadingHardCopy] = useState(false)
  const [downloadingErpAttendance, setDownloadingErpAttendance] = useState(false)

  useEffect(() => {
    if (initialSelectedBatch) {
      const found = batches.find(b => b.id === initialSelectedBatch.id)
      setSelectedBatch(found || initialSelectedBatch)
      if (onClearInitialBatch) onClearInitialBatch()
    }
  }, [initialSelectedBatch, batches, onClearInitialBatch])

  const hasInitializedTab = useRef(false)
  useEffect(() => {
    if (batches.length > 0 && !hasInitializedTab.current) {
      hasInitializedTab.current = true
      const order = ['active', 'upcoming', 'completed', 'archived']
      for (const s of order) {
        if (batches.some(b => normalizeStatus(b.status) === s)) {
          setActiveTab(s)
          break
        }
      }
    }
  }, [batches])

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
    const targetStatus = normalizeStatus(form.status || activeTab)
    const res = await fetch(`${API}/api/admin/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    toast(data.message, res.ok ? 'success' : 'error')
    if (res.ok) {
      setShowCreate(false)
      setActiveTab(targetStatus)
      fetchBatches()
      if (onBatchesChange) onBatchesChange()
    }
  }

  const handleEdit = async (form) => {
    const res = await fetch(`${API}/api/admin/batches/${editBatch.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    toast(data.message, res.ok ? 'success' : 'error')
    if (res.ok) {
      setEditBatch(null)
      fetchBatches()
      if (onBatchesChange) onBatchesChange()
    }
  }

  const handleDelete = (batch) => {
    setBatchToDelete(batch)
  }

  const downloadActiveAttendance = async (batch) => {
    if (!batch) return
    setDownloadingAtt(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batch.id}/squads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const squadData = studentsRes.ok ? await studentsRes.json() : {}
      const studentsList = squadData.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export.', 'warning')
        setDownloadingAtt(false)
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []

      schedulesList.sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')))

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      const rows = buildAdminAttendanceExportRows(studentsList, recordsList, schedulesList)

      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.sheet_add_aoa(ws, [
        [],
        ['Bus Detail: __________'],
        ['Faculty Name: __________'],
        ['Total Present: ______'],
        ['Total Absent: ______']
      ], { origin: -1 })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Attendance Report")
      XLSX.writeFile(wb, `${batch.name}_Attendance_Report.xlsx`)
      toast('Attendance report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download attendance report.', 'error')
    } finally {
      setDownloadingAtt(false)
    }
  }

  const downloadActiveMarks = async (batch) => {
    if (!batch) return
    setDownloadingMarks(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batch.id}/squads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const squadData = studentsRes.ok ? await studentsRes.json() : {}
      const studentsList = squadData.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export.', 'warning')
        setDownloadingMarks(false)
        return
      }

      const schedRes = await fetch(`${API}/api/schedules?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const schedData = schedRes.ok ? await schedRes.json() : {}
      const schedulesList = schedData.schedules || []

      const evalsRes = await fetch(`${API}/api/faculty/evaluations`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const evalsData = evalsRes.ok ? await evalsRes.json() : {}
      const evaluationsList = evalsData.evaluations || []
      const summariesList = evalsData.summaries || []

      const attRes = await fetch(`${API}/api/faculty/attendance_records?batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const attData = attRes.ok ? await attRes.json() : {}
      const recordsList = attData.records || []

      const sortedStudents = [...studentsList].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      exportLtcExcel({
        title: 'Life Awakening Program (LTC) - Student Evaluation Report',
        batchName: batch.name || 'LTC Batch',
        students: sortedStudents,
        schedules: schedulesList,
        attendanceData: recordsList,
        evaluationData: evaluationsList,
        summaryData: summariesList,
        filename: `${batch.name}_Marks_Report.xlsx`
      })

      toast('Marks report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download marks report.', 'error')
    } finally {
      setDownloadingMarks(false)
    }
  }

  const downloadActiveStudentShirts = async (batch) => {
    if (!batch) return
    setDownloadingStudentShirts(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}/students?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.ok ? await res.json() : {}
      const studentsList = data.students || []

      if (studentsList.length === 0) {
        toast('No students found in this batch to export shirt sizes.', 'warning')
        setDownloadingStudentShirts(false)
        return
      }

      const sortedStudents = [...studentsList].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      const rows = sortedStudents.map(s => ({
        'Name': s.name || '—',
        'PRN': s.prn || '—',
        'Undertaking Status': s.undertaking_submitted ? 'Submitted' : 'Pending',
        'Photo Consent': s.photo_video_consent ? 'Accepted' : 'Declined',
        'T-Shirt Size': s.tshirt_size || 'Pending Submission',
        'T-Shirt Consent': s.tshirt_consent ? 'Accepted' : 'Declined',
        'Data Consent': s.data_consent ? 'Accepted' : 'Declined',
        'Bag Check Consent': s.bag_check_consent ? 'Accepted' : 'Declined'
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Student Shirt Sizes")
      XLSX.writeFile(wb, `${batch.name || 'Batch'}_Student_Shirt_Sizes.xlsx`)
      toast('Student shirt sizes report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download student shirt sizes.', 'error')
    } finally {
      setDownloadingStudentShirts(false)
    }
  }

  const downloadActiveFacultyShirts = async (batch) => {
    if (!batch) return
    setDownloadingFacultyShirts(true)
    try {
      const res = await fetch(`${API}/api/admin/batches/${batch.id}/faculty`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = res.ok ? await res.json() : {}
      const facultyList = data.faculty || []

      if (facultyList.length === 0) {
        toast('No faculty found in this batch to export shirt sizes.', 'warning')
        setDownloadingFacultyShirts(false)
        return
      }

      const rows = facultyList.map(f => ({
        'Name': f.name,
        'T-Shirt Size': f.tshirt_size || 'Pending Submission'
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Faculty Shirt Sizes")
      XLSX.writeFile(wb, `${batch.name || 'Batch'}_Faculty_Shirt_Sizes.xlsx`)
      toast('Faculty shirt sizes report downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to download faculty shirt sizes.', 'error')
    } finally {
      setDownloadingFacultyShirts(false)
    }
  }

  const downloadActiveBatchHardCopyPdf = async (batch) => {
    if (!batch) return
    setDownloadingHardCopy(true)
    try {
      const response = await fetch(`${API}/api/admin/batches/${batch.id}/hard-copy-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to download attendance hard copy PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(batch.name || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_')}_PanelWise_Attendance_HardCopy.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast('Batch Attendance Hard Copy PDF downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast(err.message || 'Failed to download Hard Copy PDF.', 'error')
    } finally {
      setDownloadingHardCopy(false)
    }
  }

  const downloadActiveBatchAttendanceErpExcel = async (batch) => {
    if (!batch || downloadingErpAttendance) return
    setDownloadingErpAttendance(true)
    try {
      const response = await fetch(`${API}/api/admin/batches/${batch.id}/attendance-erp-excel`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to download attendance for ERP Excel')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const contentDisposition = response.headers.get('content-disposition')
      let filename = ''
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/["']/g, '')
      }
      if (!filename) {
        const now = new Date()
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yyyy = now.getFullYear()
        const dateStr = `${dd}-${mm}-${yyyy}`
        const sanitizeName = (batch.name || 'Batch').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
        filename = `Attendance_for_ERP_${sanitizeName}_${dateStr}.xlsx`
      }

      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast('Attendance for ERP Excel downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      toast(err.message || 'Failed to download Attendance for ERP Excel.', 'error')
    } finally {
      setDownloadingErpAttendance(false)
    }
  }


  const filtered = useMemo(() => batches.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !search || b.name.toLowerCase().includes(q) || (b.location || '').toLowerCase().includes(q) || (b.batch_code || '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || normalizeStatus(b.status) === normalizeStatus(filterStatus)
    return matchSearch && matchStatus
  }), [batches, search, filterStatus])

  const activeBatch = useMemo(() => {
    return batches.find(b => normalizeStatus(b.status) === 'active')
  }, [batches])

  const tabBatches = useMemo(() => {
    return filtered.filter(b => normalizeStatus(b.status) === activeTab)
  }, [filtered, activeTab])


  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const statusBadge = (s) => ({
    active: <span className="badge badge-blue status-active">{t("Active")}</span>,
    upcoming: <span className="badge badge-blue status-upcoming">{t("Upcoming")}</span>,
    completed: <span className="badge badge-gray status-completed">{t("Completed")}</span>,
    archived: <span className="badge badge-gray status-archived">{t("Archived")}</span>,
  }[s] || <span className="badge badge-gray">{t(s)}</span>)

  return (
    <div className="batch-management-page animate-fade-in">
      <style>{`
        .premium-batch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .premium-batch-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          cursor: pointer;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .premium-batch-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
          border-color: #cbd5e1;
        }

        .premium-batch-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .premium-batch-icon-container {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          transition: transform 0.3s ease;
        }

        .premium-batch-card:hover .premium-batch-icon-container {
          transform: scale(1.08);
        }

        .premium-batch-icon-container.active {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
        }

        .premium-batch-icon-container.upcoming {
          background: linear-gradient(135deg, #0f172a, #0f172a);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }

        .premium-batch-icon-container.completed {
          background: linear-gradient(135deg, #94a3b8, #475569);
          box-shadow: 0 4px 12px rgba(148, 163, 184, 0.25);
        }

        .premium-batch-icon-container.archived {
          background: linear-gradient(135deg, #f43f5e, #be123c);
          box-shadow: 0 4px 12px rgba(244, 63, 94, 0.25);
        }

        .premium-batch-badge-pill {
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .premium-batch-badge-pill.active {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .premium-batch-badge-pill.upcoming {
          background: #f1f5f9;
          color: #0f172a;
          border: 1px solid #bfdbfe;
        }

        .premium-batch-badge-pill.completed {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .premium-batch-badge-pill.archived {
          background: #fff1f2;
          color: #e11d48;
          border: 1px solid #fecdd3;
        }

        .premium-batch-title {
          font-size: 20px;
          font-weight: 850;
          color: #0f172a;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
        }

        .premium-batch-subtitle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .premium-batch-code {
          font-family: monospace;
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          color: #475569;
          font-weight: 700;
          border: 1px solid #e2e8f0;
        }

        .premium-batch-location-text {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }

        .premium-batch-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .premium-batch-detail-box {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #334155;
          font-weight: 500;
        }

        .premium-batch-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .premium-batch-icon-box.blue {
          background: #f1f5f9;
          color: #0f172a;
        }

        .premium-batch-icon-box.green {
          background: #f0fdf4;
          color: #16a34a;
        }

        .premium-batch-icon-box.orange {
          background: #fff7ed;
          color: #ea580c;
        }

        .premium-batch-btn-open {
          flex: 1;
          background: #0f172a;
          color: #ffffff;
          border: none;
          border-radius: 50px;
          height: 44px;
          font-size: 14px;
          font-weight: 750;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        }

        .premium-batch-btn-open:hover {
          background: #1e293b;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
        }

        .premium-batch-btn-open:active {
          transform: translateY(0);
        }

        .premium-batch-btn-action {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .premium-batch-btn-action:hover {
          border-color: #cbd5e1;
          color: #0f172a;
          background: #f8fafc;
        }

        .premium-batch-btn-action.btn-del:hover {
          border-color: #e2e8f0;
          color: #ef4444;
          background: #fef2f2;
        }

        .premium-detail-cards-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 20px;
          margin-bottom: 24px;
        }

        .premium-detail-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          flex: 1;
          max-width: 320px;
          min-width: 260px;
        }

        .premium-detail-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
          border-color: #cbd5e1;
        }

        .premium-detail-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .premium-detail-icon-container {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b !important;
          background: none !important;
          box-shadow: none !important;
          width: auto;
          height: auto;
          border-radius: 0;
        }

        .premium-detail-card:hover .premium-detail-icon-container {
          transform: none;
        }

        .premium-detail-card-badge-pill {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #f1f5f9 !important;
          color: #475569 !important;
          border: 1px solid #e2e8f0 !important;
        }

        .premium-detail-title {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .premium-detail-subtitle {
          font-size: 12px;
          font-weight: 550;
          color: #64748b;
          margin: 0 0 16px 0;
        }

        .premium-detail-details-grid {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .premium-detail-detail-box {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #475569;
          font-weight: 600;
          background: #f8fafc;
          padding: 4px 8px 4px 4px;
          border-radius: 8px;
          border: 1px solid #f1f5f9;
          flex: 1;
          min-width: 110px;
        }

        .premium-detail-icon-box {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: #f1f5f9 !important;
          color: #475569 !important;
        }

        .premium-detail-btn-open {
          flex: 1;
          background: var(--primary) !important;
          color: #ffffff !important;
          border: none;
          border-radius: 12px;
          height: 36px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: none !important;
        }

        .premium-detail-btn-open:hover {
          background: var(--primary-dark) !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.20);
        }

        .premium-detail-btn-open:active {
          transform: translateY(0);
        }

        .premium-detail-btn-action {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .premium-detail-btn-action:hover {
          border-color: #cbd5e1;
          color: #0f172a;
          background: #f8fafc;
        }

        .squad-card.selected {
          border-color: var(--squad-color) !important;
          box-shadow: 0 0 0 1.5px var(--squad-color), 0 4px 12px rgba(0, 0, 0, 0.05) !important;
          background: rgba(37, 99, 235, 0.005);
        }
      `}</style>

      {selectedBatch ? (
        <BatchDetail
          batch={selectedBatch}
          token={token}
          toast={toast}
          onBack={() => {
            setSelectedBatch(null)
            fetchBatches()
            if (onBatchesChange) onBatchesChange()
          }}
          onRefresh={() => {
            fetchBatches()
            if (onBatchesChange) onBatchesChange()
          }}
        />
      ) : (
        <>
          <div className="page-header">
            <div className="page-header-left">
              <h2 className="page-title" style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a' }}>{t("Batch Management")}</h2>
              <p className="page-subtitle" style={{ fontSize: '13.5px', color: '#64748b', margin: 0, fontWeight: '500' }}>{t("Create and manage LTC batches, assign students and faculty")}</p>
            </div>
             <div className="page-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                className="btn btn-outline" 
                onClick={fetchBatches}
                style={{ padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <RefreshCw size={15} />
              </button>
              <button 
                className="btn" 
                onClick={() => setShowCreate(true)}
                style={{ background: '#ea580c', color: '#ffffff', borderRadius: '12px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13.5px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.2)' }}
              >
                <Plus size={16} /> {t("New Batch")}
              </button>
            </div>
          </div>


          <style>{`
            @media (max-width: 640px) {
              .page-header {
                flex-direction: column !important;
                align-items: stretch !important;
                gap: 12px !important;
              }
              .page-header-left {
                display: block !important;
              }
              .page-header-right {
                width: 100% !important;
                justify-content: flex-start !important;
              }
              .batch-stats-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 10px !important;
              }
              .batch-list-grid {
                grid-template-columns: 1fr !important;
              }
              .batch-category-tabs-container {
                display: flex !important;
                flex-wrap: nowrap !important;
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch !important;
                max-width: 100% !important;
                width: 100% !important;
                padding-bottom: 6px !important;
              }
              .batch-category-tabs-container button {
                white-space: nowrap !important;
                flex-shrink: 0 !important;
              }
            }
            @media (max-width: 480px) {
              .batch-stats-grid {
                grid-template-columns: 1fr !important;
              }
            }
              
              /* Active Batch Card Desktop Base Formatting */
              .active-batch-wide-card {
                padding: 14px 18px !important;
                border-radius: 12px !important;
                border: 1px solid #e2e8f0 !important;
                border-left: 4px solid #ea580c !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03) !important;
                background: #ffffff !important;
                margin-bottom: 16px !important;
                gap: 12px !important;
              }
              .active-batch-header-row {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 14px !important;
                width: 100% !important;
              }
              .active-batch-info-block {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                min-width: 0 !important;
                flex: 1 1 auto !important;
              }
              .active-batch-icon-container {
                width: 38px !important;
                height: 38px !important;
                border-radius: 10px !important;
                box-shadow: none !important;
              }
              .active-batch-metrics-capsule {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                background: #f8fafc !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 8px !important;
                padding: 5px 14px !important;
                flex-shrink: 0 !important;
              }
              .active-batch-actions-bar {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                flex-wrap: wrap !important;
                gap: 8px !important;
                border-top: 1px solid #f1f5f9 !important;
                padding-top: 10px !important;
                width: 100% !important;
              }
              .active-batch-action-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 5px !important;
                padding: 5px 11px !important;
                border-radius: 6px !important;
                font-size: 11.5px !important;
                font-weight: 650 !important;
                color: #334155 !important;
                background: #ffffff !important;
                border: 1px solid #e2e8f0 !important;
                cursor: pointer !important;
                width: auto !important;
                box-shadow: none !important;
                transition: all 0.15s ease !important;
              }
              .active-batch-action-btn:hover:not(:disabled) {
                background: #fff7ed !important;
                border-color: #fdba74 !important;
                color: #c2410c !important;
              }
              .active-batch-action-btn .btn-text-content {
                display: flex !important;
                align-items: center !important;
                gap: 5px !important;
              }

              /* Active Batch Card Mobile View Responsive Overrides */
              @media (max-width: 768px) {
                .active-batch-wide-card {
                  padding: 12px 14px !important;
                  border-radius: 10px !important;
                }
                .active-batch-header-row {
                  flex-direction: column !important;
                  align-items: flex-start !important;
                  gap: 10px !important;
                  width: 100% !important;
                }
                .active-batch-info-block {
                  width: 100% !important;
                }
                .active-batch-metrics-capsule {
                  width: 100% !important;
                  justify-content: space-around !important;
                  box-sizing: border-box !important;
                  padding: 6px 10px !important;
                }
                .active-batch-actions-bar {
                  flex-direction: column !important;
                  align-items: stretch !important;
                  gap: 8px !important;
                }
                .active-batch-actions-bar > div:first-child {
                  display: grid !important;
                  grid-template-columns: repeat(2, 1fr) !important;
                  gap: 6px !important;
                  width: 100% !important;
                }
                .active-batch-action-btn {
                  width: 100% !important;
                  justify-content: center !important;
                  padding: 7px 10px !important;
                  font-size: 11px !important;
                }
              }

              @media (max-width: 480px) {
                .active-batch-actions-bar > div:first-child {
                  grid-template-columns: 1fr !important;
                }
              }

              @keyframes dot-pulse {
                0% { transform: scale(0.9); opacity: 0.4; }
                50% { transform: scale(1.15); opacity: 1; }
                100% { transform: scale(0.9); opacity: 0.4; }
              }
              .active-dot {
                animation: dot-pulse 1.6s infinite ease-in-out;
              }
            `}</style>
            <div className="batch-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
            {[
              { 
                label: t('Total Batches'), 
                value: batches.length, 
                icon: <Layers size={18} color="#ea580c" strokeWidth={2.4} />, 
                shadowColor: 'rgba(234, 88, 12, 0.15)', 
                borderColor: 'rgba(234, 88, 12, 0.08)',
                radialColor: 'rgba(234, 88, 12, 0.07)',
                dotColor: 'rgba(234, 88, 12, 0.16)'
              },
              { 
                label: t('Active'), 
                value: batches.filter(b => normalizeStatus(b.status) === 'active').length, 
                icon: <CheckCircle size={18} color="#10b981" strokeWidth={2.4} />, 
                shadowColor: 'rgba(16, 185, 129, 0.15)', 
                borderColor: 'rgba(16, 185, 129, 0.08)',
                radialColor: 'rgba(16, 185, 129, 0.07)',
                dotColor: 'rgba(16, 185, 129, 0.16)'
              },
              { 
                label: t('Upcoming'), 
                value: batches.filter(b => normalizeStatus(b.status) === 'upcoming').length, 
                icon: <Calendar size={18} color="#ea580c" strokeWidth={2.4} />, 
                shadowColor: 'rgba(234, 88, 12, 0.15)', 
                borderColor: 'rgba(234, 88, 12, 0.08)',
                radialColor: 'rgba(234, 88, 12, 0.07)',
                dotColor: 'rgba(234, 88, 12, 0.16)'
              },
              { 
                label: t('Total Students Enrolled'), 
                value: batches.reduce((a, b) => a + parseInt(b.student_count || 0), 0), 
                icon: <GraduationCap size={18} color="#8b5cf6" strokeWidth={2.4} />, 
                shadowColor: 'rgba(139, 92, 246, 0.15)', 
                borderColor: 'rgba(139, 92, 246, 0.08)',
                radialColor: 'rgba(139, 92, 246, 0.07)',
                dotColor: 'rgba(139, 92, 246, 0.16)'
              },
            ].map(s => (
              <div 
                key={s.label} 
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '16px', 
                  padding: '14px 16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  overflow: 'hidden', 
                  minHeight: '110px', 
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.015)',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
                  <span style={{ fontSize: '10px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>
                    {s.label}
                  </span>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    background: '#ffffff', 
                    borderRadius: '10px', 
                    boxShadow: `0 6px 15px -3px ${s.shadowColor}`, 
                    border: `1px solid ${s.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {s.icon}
                  </div>
                </div>
                <div style={{ zIndex: 2, marginTop: '8px' }}>
                  <h3 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1 }}>
                    {s.value.toLocaleString()}
                  </h3>
                </div>
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '90px', 
                  height: '70px', 
                  background: `radial-gradient(circle at bottom right, ${s.radialColor}, transparent 70%)`,
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `radial-gradient(${s.dotColor} 1.5px, transparent 1.5px)`,
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>
            ))}
          </div>


          {/* Active Batch Wide Card */}
          {activeBatch ? (
            <div
              className="active-batch-wide-card"
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '16px',
                position: 'relative',
                border: '1px solid #e2e8f0',
                borderLeft: '4px solid #ea580c',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Top Row: Batch Info + Metrics Capsule */}
              <div className="active-batch-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                
                {/* Left side: Icon + Batch Info */}
                <div className="active-batch-info-block" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
                  <div 
                    className="active-batch-icon-container"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#ea580c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <GraduationCap size={18} />
                  </div>

                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Title + Badges in a clean horizontal flow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                        {activeBatch.name}
                      </h3>
                      
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        background: '#ecfdf5',
                        color: '#059669',
                        letterSpacing: '0.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid #a7f3d0'
                      }}>
                        <span className="active-dot" style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: '#059669',
                          display: 'inline-block'
                        }}></span>
                        {t("Active Batch")}
                      </span>

                      {activeBatch.batch_code && (
                        <span style={{ fontSize: '10px', color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 7px', borderRadius: '6px', fontWeight: '700' }}>
                          {activeBatch.batch_code}
                        </span>
                      )}
                      {activeBatch.class_grade && (
                        <span style={{ fontSize: '10px', color: '#c2410c', background: '#fff7ed', padding: '2px 7px', borderRadius: '6px', fontWeight: '750', border: '1px solid #fed7aa' }}>
                          Class {activeBatch.class_grade}
                        </span>
                      )}
                    </div>

                    {/* Metadata: Dates and Location */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', color: '#64748b' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                        <Calendar size={12} style={{ color: '#ea580c' }} />
                        {formatDate(activeBatch.start_date)} — {formatDate(activeBatch.end_date)}
                      </span>
                      {activeBatch.location && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                            <MapPin size={12} style={{ color: '#94a3b8' }} /> {activeBatch.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Unified Metrics Capsule */}
                <div 
                  className="active-batch-metrics-capsule"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '5px 14px',
                    flexShrink: 0
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Boys</span>
                    <strong style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{activeBatch.boys_count || 0}</strong>
                  </div>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Girls</span>
                    <strong style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{activeBatch.girls_count || 0}</strong>
                  </div>
                  <span style={{ color: '#cbd5e1' }}>|</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#ea580c', textTransform: 'uppercase' }}>Total</span>
                    <strong style={{ fontSize: '13.5px', fontWeight: '850', color: '#ea580c' }}>{activeBatch.student_count || 0}</strong>
                  </div>
                </div>

              </div>

              {/* Bottom Row: Actions Bar */}
              <div 
                className="active-batch-actions-bar"
                style={{ 
                  borderTop: '1px solid #f1f5f9', 
                  paddingTop: '10px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  flexWrap: 'wrap', 
                  gap: '8px' 
                }}
              >
                {/* Left: Export Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadActiveAttendance(activeBatch); }}
                    disabled={downloadingAtt}
                    className="active-batch-action-btn"
                    title="Download Excel Attendance"
                  >
                    <div className="btn-text-content">
                      {downloadingAtt ? <div className="spinner spinner-sm" /> : <ClipboardList size={13} style={{ color: '#ea580c' }} />}
                      <span>{t("Attendance")}</span>
                    </div>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); downloadActiveStudentShirts(activeBatch); }}
                    disabled={downloadingStudentShirts}
                    className="active-batch-action-btn"
                    title="Download Student T-Shirt Sizes"
                  >
                    <div className="btn-text-content">
                      {downloadingStudentShirts ? <div className="spinner spinner-sm" /> : <Shirt size={13} style={{ color: '#ea580c' }} />}
                      <span>{t("Student Shirts")}</span>
                    </div>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); downloadActiveFacultyShirts(activeBatch); }}
                    disabled={downloadingFacultyShirts}
                    className="active-batch-action-btn"
                    title="Download Faculty T-Shirt Sizes"
                  >
                    <div className="btn-text-content">
                      {downloadingFacultyShirts ? <div className="spinner spinner-sm" /> : <Shirt size={13} style={{ color: '#ea580c' }} />}
                      <span>{t("Faculty Shirts")}</span>
                    </div>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); downloadActiveBatchHardCopyPdf(activeBatch); }}
                    disabled={downloadingHardCopy}
                    className="active-batch-action-btn"
                    title="Download Hard Copy PDF"
                  >
                    <div className="btn-text-content">
                      {downloadingHardCopy ? <div className="spinner spinner-sm" /> : <FileText size={13} style={{ color: '#ea580c' }} />}
                      <span>{t("Hard Copy (PDF)")}</span>
                    </div>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); downloadActiveBatchAttendanceErpExcel(activeBatch); }}
                    disabled={downloadingErpAttendance}
                    className="active-batch-action-btn"
                    title="Download Attendance formatted for ERP upload"
                  >
                    <div className="btn-text-content">
                      {downloadingErpAttendance ? <div className="spinner spinner-sm" /> : <FileSpreadsheet size={13} style={{ color: '#16a34a' }} />}
                      <span>{t("ERP Format")}</span>
                    </div>
                  </button>
                </div>

                {/* Right: Manage Batch link */}
                <button
                  onClick={() => setSelectedBatch(activeBatch)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ea580c',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'opacity 0.15s'
                  }}
                  className="hover:underline"
                >
                  <span>{t("Manage Batch")}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: '14px', padding: '16px 20px', textAlign: 'center', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
              <GraduationCap size={24} style={{ color: '#94a3b8' }} />
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#475569', margin: '0 0 2px 0' }}>No Active Batch</h4>
                <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0 }}>Start or update a batch to activate it.</p>
              </div>
            </div>
          )}

          {/* Categorized Batch List Section */}

          <div>
            <div className="batch-category-tabs-container" style={{
              display: 'inline-flex',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '4px',
              gap: '4px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: 'fit-content'
            }}>
              {[
                { key: 'upcoming', label: t('Upcoming'), count: batches.filter(b => normalizeStatus(b.status) === 'upcoming').length },
                { key: 'active', label: t('Active'), count: batches.filter(b => normalizeStatus(b.status) === 'active').length },
                { key: 'completed', label: t('Completed'), count: batches.filter(b => normalizeStatus(b.status) === 'completed').length },
                { key: 'archived', label: t('Archived'), count: batches.filter(b => normalizeStatus(b.status) === 'archived').length },
              ].map(tabItem => {
                const isActive = activeTab === tabItem.key
                return (
                  <button
                    key={tabItem.key}
                    type="button"
                    onClick={() => setActiveTab(tabItem.key)}
                    style={{
                      padding: '8px 16px',
                      background: isActive ? '#ea580c' : 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      color: isActive ? '#ffffff' : '#64748b',
                      fontWeight: '750',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      boxShadow: isActive ? '0 2px 6px rgba(234, 88, 12, 0.2)' : 'none',
                    }}
                  >
                    {tabItem.label}
                    <span style={{
                      background: isActive ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0',
                      color: isActive ? '#ffffff' : '#475569',
                      borderRadius: '50px',
                      padding: '1px 8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      minWidth: '18px',
                      textAlign: 'center'
                    }}>{tabItem.count}</span>
                  </button>
                )
              })}
            </div>

            {tabBatches.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                <Layers size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No batches found in this category.</p>
              </div>
            ) : (
              <div className="batch-list-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
                {tabBatches.map(b => {
                  const sc = {
                    active: { 
                      iconBg: 'linear-gradient(135deg, #10b981, #059669)', 
                      iconColor: '#ffffff',
                      iconShadow: '0 6px 14px rgba(16, 185, 129, 0.15)',
                      badgeBg: '#ecfdf5', 
                      badgeColor: '#047857', 
                      badgeBorder: '#a7f3d0', 
                      accent: '#10b981' 
                    },
                    upcoming: { 
                      iconBg: '#f1f5f9', 
                      iconColor: '#475569',
                      iconShadow: 'none',
                      badgeBg: '#f8fafc', 
                      badgeColor: '#475569', 
                      badgeBorder: '#e2e8f0', 
                      accent: '#e2e8f0' 
                    },
                    completed: { 
                      iconBg: '#f1f5f9', 
                      iconColor: '#64748b',
                      iconShadow: 'none',
                      badgeBg: '#f8fafc', 
                      badgeColor: '#64748b', 
                      badgeBorder: '#e2e8f0', 
                      accent: '#cbd5e1' 
                    },
                    archived: { 
                      iconBg: '#f1f5f9', 
                      iconColor: '#94a3b8',
                      iconShadow: 'none',
                      badgeBg: '#f8fafc', 
                      badgeColor: '#94a3b8', 
                      badgeBorder: '#e2e8f0', 
                      accent: '#e2e8f0' 
                    },
                  }[normalizeStatus(b.status)] || { 
                    iconBg: '#f1f5f9', 
                    iconColor: '#64748b',
                    iconShadow: 'none',
                    badgeBg: '#f8fafc', 
                    badgeColor: '#64748b', 
                    badgeBorder: '#e2e8f0', 
                    accent: '#cbd5e1' 
                  }

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBatch(b)}
                      style={{
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '20px',
                        background: '#ffffff',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        transition: 'all 0.22s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.08)'
                        e.currentTarget.style.borderColor = '#c7d2e0'
                        const badges = e.currentTarget.querySelector('.enrollment-badges-container')
                        if (badges) badges.style.opacity = '1'
                        const buttons = e.currentTarget.querySelector('.card-action-buttons-container')
                        if (buttons) buttons.style.opacity = '1'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        if (normalizeStatus(b.status) !== 'active') {
                          const badges = e.currentTarget.querySelector('.enrollment-badges-container')
                          if (badges) badges.style.opacity = '0.6'
                          const buttons = e.currentTarget.querySelector('.card-action-buttons-container')
                          if (buttons) buttons.style.opacity = '0.7'
                        }
                      }}
                    >
                      {/* Accent bar */}
                      <div style={{ height: '4px', background: sc.accent }} />

                      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                            <div style={{
                              width: '44px', height: '44px', borderRadius: '14px',
                              background: sc.iconBg, color: sc.iconColor || '#ffffff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, boxShadow: sc.iconShadow || 'none'
                            }}>
                              <GraduationCap size={22} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.3px', lineHeight: 1.2 }}>{b.name}</h3>
                                {b.class_grade && (
                                  <span style={{ fontSize: '10px', color: '#1d4ed8', background: '#dbeafe', padding: '1px 7px', borderRadius: '6px', fontWeight: '800' }}>
                                    {b.class_grade}
                                  </span>
                                )}
                              </div>
                              {b.batch_code && <code style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '3px', display: 'block' }}>#{b.batch_code}</code>}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '9.5px', fontWeight: '800', padding: '3px 9px', borderRadius: '20px',
                            textTransform: 'uppercase', background: sc.badgeBg, color: sc.badgeColor,
                            border: `1px solid ${sc.badgeBorder}`, whiteSpace: 'nowrap', letterSpacing: '0.5px', flexShrink: 0
                          }}>{t(b.status)}</span>
                        </div>

                        {/* Location & Dates */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {b.location && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#475569' }}>
                              <MapPin size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                              <span style={{ fontWeight: '600' }}>{b.location}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#475569' }}>
                            <Calendar size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ fontWeight: '550' }}>{formatDate(b.start_date)} — {formatDate(b.end_date)}</span>
                          </div>
                        </div>

                        {/* Enrollment solid-color badges */}
                        <div 
                          className="enrollment-badges-container"
                          style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', opacity: normalizeStatus(b.status) === 'active' ? 1 : 0.6, transition: 'opacity 0.22s ease' }}
                        >
                          <span style={{ 
                            background: normalizeStatus(b.status) === 'active' ? '#334155' : '#f1f5f9', 
                            color: normalizeStatus(b.status) === 'active' ? '#ffffff' : '#475569', 
                            border: normalizeStatus(b.status) === 'active' ? 'none' : '1px solid #e2e8f0',
                            padding: '4px 10px', 
                            borderRadius: '8px', 
                            fontSize: '10.5px', 
                            fontWeight: '700' 
                          }}>
                            {b.student_count || 0} Enrolled
                          </span>
                          <span style={{ 
                            background: normalizeStatus(b.status) === 'active' ? '#154388' : '#f1f5f9', 
                            color: normalizeStatus(b.status) === 'active' ? '#ffffff' : '#475569', 
                            border: normalizeStatus(b.status) === 'active' ? 'none' : '1px solid #e2e8f0',
                            padding: '4px 10px', 
                            borderRadius: '8px', 
                            fontSize: '10.5px', 
                            fontWeight: '700' 
                          }}>
                            Boys: {b.boys_count || 0}
                          </span>
                          <span style={{ 
                            background: normalizeStatus(b.status) === 'active' ? '#be185d' : '#f1f5f9', 
                            color: normalizeStatus(b.status) === 'active' ? '#ffffff' : '#475569', 
                            border: normalizeStatus(b.status) === 'active' ? 'none' : '1px solid #e2e8f0',
                            padding: '4px 10px', 
                            borderRadius: '8px', 
                            fontSize: '10.5px', 
                            fontWeight: '700' 
                          }}>
                            Girls: {b.girls_count || 0}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div 
                          className="card-action-buttons-container"
                          style={{ display: 'flex', gap: '6px', marginTop: 'auto', opacity: normalizeStatus(b.status) === 'active' ? 1 : 0.7, transition: 'opacity 0.22s ease' }} 
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setSelectedBatch(b)}
                            style={{ 
                              flex: 1, 
                              padding: '9px 0', 
                              background: normalizeStatus(b.status) === 'active' ? '#0f172a' : '#f1f5f9', 
                              color: normalizeStatus(b.status) === 'active' ? '#ffffff' : '#475569', 
                              border: normalizeStatus(b.status) === 'active' ? 'none' : '1.5px solid #e2e8f0', 
                              borderRadius: '10px', 
                              fontSize: '12.5px', 
                              fontWeight: '700', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              gap: '4px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <ChevronRight size={13} /> Open
                          </button>
                          <button
                            onClick={() => setEditBatch({ ...b, start_date: b.start_date?.split('T')[0], end_date: b.end_date?.split('T')[0] })}
                            style={{ padding: '9px 12px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', color: '#475569', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(b)}
                            style={{ padding: '9px 12px', background: '#fff5f5', border: '1.5px solid #fee2e2', borderRadius: '10px', color: '#ef4444', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <BatchFormModal open={showCreate} onClose={() => setShowCreate(false)} onSave={handleCreate} token={token} batches={batches} batchesCount={batches.length} defaultStatus={activeTab} />
      <BatchFormModal open={!!editBatch} onClose={() => setEditBatch(null)} onSave={handleEdit} initial={editBatch} token={token} batches={batches} batchesCount={batches.length} />

      <BatchDeleteOtpModal
        open={!!batchToDelete}
        batch={batchToDelete}
        token={token}
        onClose={() => setBatchToDelete(null)}
        onSuccess={(msg) => {
          toast(msg || 'Batch deleted successfully', 'success')
          setBatchToDelete(null)
          fetchBatches()
          if (onBatchesChange) onBatchesChange()
        }}
      />

      <ToastContainer toasts={toasts} />
    </div>
  )
}
