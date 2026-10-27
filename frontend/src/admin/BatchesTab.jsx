import React, { useState, useEffect } from 'react'
import { 
  RefreshCw, Merge, Copy, Plus, Search, Edit, Lock, Unlock, 
  ChevronRight, Archive, RotateCcw, Download, FileText, X 
} from 'lucide-react'
import { formatStudentEmail } from '../utils/studentEmailHelper'

function Modal({ open, onClose, title, children, size = '', hideHeader = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`}>
        {!hideHeader && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 4 }}><X size={18} /></button>
          </div>
        )}
        <div className="modal-body" style={hideHeader ? { padding: '28px' } : {}}>{children}</div>
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

export default function BatchesTab({ token, apiBase, showToast, onRefresh, readonly }) {
  const [superAdminBatches, setSuperAdminBatches] = useState([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [downloadingHardCopyId, setDownloadingHardCopyId] = useState(null)
  const [batchSearch, setBatchSearch] = useState('')
  const [batchStatusFilter, setBatchStatusFilter] = useState('')

  // Modal visibility states
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false)
  const [showEditBatchModal, setShowEditBatchModal] = useState(false)
  const [showCloneBatchModal, setShowCloneBatchModal] = useState(false)
  const [showMergeBatchModal, setShowMergeBatchModal] = useState(false)
  const [feedbackLockModal, setFeedbackLockModal] = useState({ open: false, batch: null, loading: false })

  const [selectedBatchForAction, setSelectedBatchForAction] = useState(null)

  // Form states
  const [batchForm, setBatchForm] = useState({
    name: '', location: '', start_date: '', end_date: '', description: '', capacity: '', batch_code: '', year: '', status: 'Created'
  })
  const [cloneForm, setCloneForm] = useState({
    sourceBatchId: '', name: '', start_date: '', end_date: '', cloneFaculty: false, cloneSchedules: false
  })
  const [mergeForm, setMergeForm] = useState({
    sourceBatchId: '', targetBatchId: '', deleteSource: false
  })

  const fetchSuperAdminBatches = async () => {
    if (!token) return
    try {
      setLoadingBatches(true)
      const res = await fetch(`${apiBase}/api/superadmin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSuperAdminBatches(data.batches || [])
        if (onRefresh) onRefresh()
      } else {
        showToast('Failed to retrieve batches', 'error')
      }
    } catch (err) {
      showToast('Error connecting to server', 'error')
    } finally {
      setLoadingBatches(false)
    }
  }

  useEffect(() => {
    fetchSuperAdminBatches()
  }, [])

  const handleCreateBatch = async (e) => {
    if (e) e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchForm)
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Batch created successfully', 'success')
        setShowCreateBatchModal(false)
        setBatchForm({
          name: '', location: '', start_date: '', end_date: '', description: '', capacity: '', batch_code: '', year: '', status: 'Created'
        })
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to create batch', 'error')
      }
    } catch (err) {
      showToast('Server error creating batch', 'error')
    }
  }

  const handleUpdateBatch = async (e) => {
    if (e) e.preventDefault()
    if (!selectedBatchForAction) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/${selectedBatchForAction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchForm)
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Batch updated successfully', 'success')
        setShowEditBatchModal(false)
        setSelectedBatchForAction(null)
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to update batch', 'error')
      }
    } catch (err) {
      showToast('Server error updating batch', 'error')
    }
  }

  const handleTransitionStatus = async (batchId, status) => {
    let endpoint = 'reopen'
    let body = { status }
    if (status === 'Archived') endpoint = 'archive'
    if (status === 'Completed') endpoint = 'close'
    
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/${batchId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Batch transitioned to ${status}`, 'success')
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to change status', 'error')
      }
    } catch (err) {
      showToast('Server error transitioning status', 'error')
    }
  }

  const handleToggleLockBatch = async (batch) => {
    const action = batch.is_locked ? 'unlock' : 'lock'
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/${batch.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showToast(`Batch ${batch.is_locked ? 'unlocked' : 'locked'} successfully`, 'success')
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to toggle lock status', 'error')
      }
    } catch (err) {
      showToast('Server error toggling lock status', 'error')
    }
  }

  const handleOpenFeedbackLockModal = (batch) => {
    setFeedbackLockModal({
      open: true,
      batch,
      loading: false
    })
  }

  const handleConfirmToggleFeedbackLock = async () => {
    if (!feedbackLockModal.batch) return
    const batch = feedbackLockModal.batch
    const targetLocked = !batch.post_service_feedback_locked
    try {
      setFeedbackLockModal(prev => ({ ...prev, loading: true }))
      const res = await fetch(`${apiBase}/api/superadmin/batches/${batch.id}/toggle-feedback-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ locked: targetLocked })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(
          data.message || `Post-LTC and Service Trainer forms ${targetLocked ? 'locked' : 'unlocked'} successfully.`,
          'success'
        )
        setFeedbackLockModal({ open: false, batch: null, loading: false })
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to update feedback form lock status', 'error')
        setFeedbackLockModal(prev => ({ ...prev, loading: false }))
      }
    } catch (err) {
      showToast('Server error updating feedback form lock status', 'error')
      setFeedbackLockModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleCloneBatch = async (e) => {
    if (e) e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(cloneForm)
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Batch cloned successfully', 'success')
        setShowCloneBatchModal(false)
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to clone batch', 'error')
      }
    } catch (err) {
      showToast('Server error cloning batch', 'error')
    }
  }

  const handleMergeBatches = async (e) => {
    if (e) e.preventDefault()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(mergeForm)
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Batches merged successfully', 'success')
        setShowMergeBatchModal(false)
        fetchSuperAdminBatches()
      } else {
        showToast(data.message || 'Failed to merge batches', 'error')
      }
    } catch (err) {
      showToast('Server error merging batches', 'error')
    }
  }

  const handleExportBatch = async (batch) => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/batches/${batch.id}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to export')
      const data = await res.json()
      
      let csvContent = "\ufeff"
      csvContent += `Batch Name,${data.batch.name}\n`
      csvContent += `Batch Code,${data.batch.batch_code || ''}\n`
      csvContent += `Year,${data.batch.year || ''}\n`
      csvContent += `Status,${data.batch.status}\n`
      csvContent += `Capacity,${data.batch.capacity || ''}\n\n`
      
      csvContent += "STUDENT ROSTER\n"
      csvContent += "ID,Name,Email,PRN,Department,School,Squad,Room,Is Squad Leader\n"
      data.students.forEach(s => {
        csvContent += `"${s.id}","${s.name}","${formatStudentEmail(s.email, 'Not provided')}","${s.prn || ''}","${s.department || ''}","${s.school || ''}","${s.squad || ''}","${s.room || ''}","${s.is_squad_leader ? 'Yes' : 'No'}"\n`
      })
      
      csvContent += "\nFACULTY ROSTER\n"
      csvContent += "ID,Name,Email,Faculty ID,Department,School,Squad\n"
      data.faculty.forEach(f => {
        csvContent += `"${f.id}","${f.name}","${f.email}","${f.faculty_id || ''}","${f.department || ''}","${f.school || ''}","${f.squad || ''}"\n`
      })
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `batch_export_${batch.name.replace(/\s+/g, '_')}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Batch roster exported successfully', 'success')
    } catch (err) {
      showToast('Failed to export batch data', 'error')
    }
  }

  const handleDownloadHardCopy = async (batch) => {
    if (!batch || !token) return
    setDownloadingHardCopyId(batch.id)
    try {
      const response = await fetch(`${apiBase}/api/admin/batches/${batch.id}/hard-copy-pdf`, {
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
      showToast('Batch Attendance Hard Copy PDF downloaded successfully.', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Failed to download Hard Copy PDF.', 'error')
    } finally {
      setDownloadingHardCopyId(null)
    }
  }

  const BATCH_TIMELINE = ['Created','Planning','Orientation','Immersion','Completed','Archived']
  const statusColor = { Created:'#6366f1', Planning:'#f59e0b', Orientation:'#3b82f6', Immersion:'#10b981', Completed:'#4b5563', Archived:'#94a3b8', active:'#10b981', upcoming:'#3b82f6', completed:'#4b5563' }
  const filteredBatches = superAdminBatches.filter(b => {
    const q = batchSearch.toLowerCase()
    const matchName = !batchSearch || b.name.toLowerCase().includes(q) || (b.batch_code||'').toLowerCase().includes(q)
    const matchStatus = !batchStatusFilter || (b.status||'').toLowerCase() === batchStatusFilter.toLowerCase()
    return matchName && matchStatus
  })
  const STATUSES = ['Created','Planning','Orientation','Immersion','Completed','Archived']
  
  const renderBatchForm = (onSubmit, title, submitLabel) => (
    <Modal open={showCreateBatchModal || showEditBatchModal} onClose={() => { setShowCreateBatchModal(false); setShowEditBatchModal(false); }} title={title}>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Batch Name *</label><input className="input-field" style={{ marginBottom: 0 }} value={batchForm.name} onChange={e => setBatchForm(f => ({ ...f, name: e.target.value }))} required /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Batch Code</label><input className="input-field" style={{ marginBottom: 0 }} value={batchForm.batch_code} onChange={e => setBatchForm(f => ({ ...f, batch_code: e.target.value }))} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Location</label><input className="input-field" style={{ marginBottom: 0 }} value={batchForm.location} onChange={e => setBatchForm(f => ({ ...f, location: e.target.value }))} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Year</label><input className="input-field" style={{ marginBottom: 0 }} value={batchForm.year} onChange={e => setBatchForm(f => ({ ...f, year: e.target.value }))} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Start Date</label><input type="date" className="input-field" style={{ marginBottom: 0 }} value={batchForm.start_date} onChange={e => {
            const newDate = e.target.value;
            setBatchForm(f => {
              if (showCreateBatchModal) {
                const computed = computeNextLapBatchInfo(superAdminBatches || [], newDate || new Date());
                return { ...f, start_date: newDate, name: computed.name, batch_code: computed.batch_code, year: computed.year };
              }
              return { ...f, start_date: newDate };
            });
          }} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>End Date</label><input type="date" className="input-field" style={{ marginBottom: 0 }} value={batchForm.end_date} onChange={e => setBatchForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Capacity</label><input type="number" className="input-field" style={{ marginBottom: 0 }} value={batchForm.capacity} onChange={e => setBatchForm(f => ({ ...f, capacity: e.target.value }))} /></div>
          <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Timeline Stage</label>
            <select className="input-field" style={{ marginBottom: 0 }} value={batchForm.status} onChange={e => setBatchForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div><label style={{ fontSize: '11px', fontWeight: '850', textTransform: 'uppercase', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Description</label><textarea className="input-field" style={{ marginBottom: 0, height: '70px', resize: 'vertical' }} value={batchForm.description} onChange={e => setBatchForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
          <button type="button" onClick={() => { setShowCreateBatchModal(false); setShowEditBatchModal(false); }} className="btn btn-outline">Cancel</button>
          <button type="submit" className="btn btn-primary">{submitLabel}</button>
        </div>
      </form>
    </Modal>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>
      {/* Create Modal */}
      {showCreateBatchModal && renderBatchForm(handleCreateBatch,'Create New Batch','Create Batch')}
      {/* Edit Modal */}
      {showEditBatchModal && renderBatchForm(handleUpdateBatch,`Edit: ${selectedBatchForAction?.name||'Batch'}`,'Save Changes')}

      {/* Feedback Forms Lock Confirmation Modal */}
      {feedbackLockModal.open && feedbackLockModal.batch && (
        <Modal 
          open={feedbackLockModal.open} 
          onClose={() => !feedbackLockModal.loading && setFeedbackLockModal({ open: false, batch: null, loading: false })} 
          title={feedbackLockModal.batch.post_service_feedback_locked ? "Unlock Service & Trainer Feedback Form" : "Lock Service & Trainer Feedback Form"}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: feedbackLockModal.batch.post_service_feedback_locked ? '#f0fdf4' : '#fef2f2',
                color: feedbackLockModal.batch.post_service_feedback_locked ? '#16a34a' : '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {feedbackLockModal.batch.post_service_feedback_locked ? <Unlock size={22} /> : <Lock size={22} />}
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {feedbackLockModal.batch.post_service_feedback_locked 
                    ? `Unlock Service & Trainer Feedback for ${feedbackLockModal.batch.name}?` 
                    : `Lock Service & Trainer Feedback for ${feedbackLockModal.batch.name}?`}
                </h4>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                  Batch Code: <strong style={{ color: '#334155' }}>{feedbackLockModal.batch.batch_code || '—'}</strong>
                </p>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              {feedbackLockModal.batch.post_service_feedback_locked
                ? `Unlocking will allow enrolled students belonging to "${feedbackLockModal.batch.name}" to view, fill in, and submit the Service & Trainer Feedback Form in their Student Panel.`
                : `Locking will immediately block students belonging to "${feedbackLockModal.batch.name}" from filling in or submitting the Service & Trainer Feedback Form. This restriction applies across frontend forms and backend APIs.`}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button 
                type="button" 
                disabled={feedbackLockModal.loading} 
                onClick={() => setFeedbackLockModal({ open: false, batch: null, loading: false })} 
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={feedbackLockModal.loading} 
                onClick={handleConfirmToggleFeedbackLock} 
                style={{
                  background: feedbackLockModal.batch.post_service_feedback_locked ? '#16a34a' : '#dc2626',
                  borderColor: feedbackLockModal.batch.post_service_feedback_locked ? '#15803d' : '#b91c1c',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '700',
                  cursor: feedbackLockModal.loading ? 'not-allowed' : 'pointer'
                }}
              >
                {feedbackLockModal.loading ? (
                  <div className="spinner spinner-sm" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                ) : (
                  feedbackLockModal.batch.post_service_feedback_locked ? <Unlock size={14} /> : <Lock size={14} />
                )}
                {feedbackLockModal.batch.post_service_feedback_locked ? 'Confirm Unlock' : 'Confirm Lock'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Header Row */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h3 style={{margin:'0 0 4px',fontSize:'18px',fontWeight:'850',color:'#0f172a'}}>Manage Batches</h3>
          <p style={{margin:0,fontSize:'12.5px',color:'#64748b'}}>Create, lock, and export batch cohorts.</p>
        </div>
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
          <button onClick={fetchSuperAdminBatches} className="btn btn-outline btn-sm" style={{borderRadius:'50px',display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px'}}>
            <RefreshCw size={13} className={loadingBatches?'spin':''}/> Refresh
          </button>
          {!readonly && (
            <button onClick={() => {
              const defaults = computeNextLapBatchInfo(superAdminBatches || [], new Date());
              setBatchForm({
                name: defaults.name,
                location: 'LTC Boribel',
                start_date: '',
                end_date: '',
                description: '',
                capacity: '350',
                batch_code: defaults.batch_code,
                year: defaults.year,
                status: 'Created'
              });
              setShowCreateBatchModal(true);
            }} className="btn btn-primary" style={{borderRadius:'50px',display:'flex',alignItems:'center',gap:'6px',padding:'8px 16px'}}>
              <Plus size={13}/> Create Batch
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:'10px',padding:'9px 14px',flex:'1',minWidth:'180px'}}>
          <Search size={14} style={{color:'#64748b',flexShrink:0}}/>
          <input placeholder="Search batches..." value={batchSearch} onChange={e=>setBatchSearch(e.target.value)} style={{border:'none',outline:'none',fontSize:'13px',width:'100%',background:'transparent',color:'#0f172a'}}/>
        </div>
        <select value={batchStatusFilter} onChange={e=>setBatchStatusFilter(e.target.value)} style={{padding:'9px 14px',border:'1.5px solid #e2e8f0',borderRadius:'10px',fontSize:'13px',fontWeight:'600',background:'#fff',outline:'none',minWidth:'140px',color:'#0f172a'}}>
          <option value="">All Stages</option>
          {BATCH_TIMELINE.map(s=><option key={s} value={s}>{s}</option>)}
          <option value="active">Active (legacy)</option>
          <option value="upcoming">Upcoming (legacy)</option>
        </select>
      </div>

      {/* Batch Content */}
      {loadingBatches ? (
        <div className="glass-card" style={{background:'#fff',borderRadius:'16px',border:'1.5px solid #e2e8f0',display:'flex',justifyContent:'center',padding:'48px'}}><div className="spinner"/></div>
      ) : filteredBatches.length===0 ? (
        <div className="glass-card" style={{background:'#fff',borderRadius:'16px',border:'1.5px solid #e2e8f0',textAlign:'center',padding:'48px',color:'#64748b',fontSize:'13.5px'}}>No batches found. Create your first batch to get started.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <style>{`
            @media (max-width: 700px) {
              .batch-desktop-table { display: none !important; }
              .batch-mobile-cards { display: flex !important; }
            }
            @media (min-width: 701px) {
              .batch-desktop-table { display: block !important; }
              .batch-mobile-cards { display: none !important; }
            }
          `}</style>

          {/* ── Desktop Table View ── */}
          <div className="batch-desktop-table" style={{background:'#fff',borderRadius:'16px',border:'1.5px solid #e2e8f0',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                <thead>
                  <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                    {['Batch','Code','Location','Dates','Students','Faculty','Stage', ...(readonly ? [] : ['Batch Lock', 'Forms Lock']),'Actions'].map(h=>(
                      <th key={h} style={{padding:'13px 18px',textAlign:'left',fontWeight:'700',fontSize:'11px',textTransform:'uppercase',color:'#475569',whiteSpace:'nowrap',letterSpacing:'0.5px'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b, idx)=>{
                    const stColor = statusColor[b.status] || '#94a3b8'
                    return (
                      <tr key={`desktop-batch-${b.id || idx}`} style={{borderBottom:'1px solid #f1f5f9',transition:'background 0.12s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'16px 18px',maxWidth:'200px'}}>
                          <div style={{fontWeight:'700',color:'#0f172a',fontSize:'13.5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</div>
                          {b.year && <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>Year {b.year}</div>}
                        </td>
                        <td style={{padding:'16px 18px'}}>
                          <span style={{fontFamily:'monospace',fontSize:'12px',color:'#334155',background:'#f1f5f9',padding:'2px 8px',borderRadius:'6px'}}>{b.batch_code||'—'}</span>
                        </td>
                        <td style={{padding:'16px 18px',color:'#334155',whiteSpace:'nowrap',fontSize:'13px'}}>{b.location||'—'}</td>
                        <td style={{padding:'16px 18px',fontSize:'12px',color:'#334155',whiteSpace:'nowrap'}}>
                          {b.start_date ? new Date(b.start_date).toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'}) : '—'}
                          {b.end_date ? <span style={{color:'#94a3b8',margin:'0 4px'}}>→</span> : null}
                          {b.end_date ? new Date(b.end_date).toLocaleDateString([],{month:'short',day:'numeric',year:'2-digit'}) : null}
                        </td>
                        <td style={{padding:'16px 18px'}}>
                          <span style={{fontWeight:'700',color:'#1d4ed8',fontSize:'14px'}}>{b.student_count||0}</span>
                        </td>
                        <td style={{padding:'16px 18px'}}>
                          <span style={{fontWeight:'700',color:'#059669',fontSize:'14px'}}>{b.faculty_count||0}</span>
                        </td>
                        <td style={{padding:'16px 18px'}}>
                          <span style={{background:stColor+'18',color:stColor,padding:'4px 12px',borderRadius:'50px',fontSize:'11.5px',fontWeight:'700',whiteSpace:'nowrap',border:`1px solid ${stColor}30`}}>{b.status||'—'}</span>
                        </td>
                        {!readonly && (
                          <>
                            <td style={{padding:'16px 18px'}}>
                              <span style={{
                                background: b.is_locked ? '#fef2f2' : '#f0fdf4',
                                color: b.is_locked ? '#dc2626' : '#16a34a',
                                padding:'4px 12px',borderRadius:'50px',fontSize:'11.5px',fontWeight:'700',whiteSpace:'nowrap',
                                border:`1px solid ${b.is_locked ? '#fecaca' : '#bbf7d0'}`
                              }}>{b.is_locked ? 'Locked' : 'Unlocked'}</span>
                            </td>
                            <td style={{padding:'16px 18px'}}>
                              <span style={{
                                background: b.post_service_feedback_locked ? '#fef2f2' : '#f0fdf4',
                                color: b.post_service_feedback_locked ? '#dc2626' : '#16a34a',
                                padding:'4px 12px',borderRadius:'50px',fontSize:'11.5px',fontWeight:'700',whiteSpace:'nowrap',
                                border:`1px solid ${b.post_service_feedback_locked ? '#fecaca' : '#bbf7d0'}`,
                                display:'inline-flex',alignItems:'center',gap:'4px'
                              }}>
                                {b.post_service_feedback_locked ? <Lock size={11}/> : <Unlock size={11}/>}
                                {b.post_service_feedback_locked ? 'Forms Locked' : 'Forms Open'}
                              </span>
                            </td>
                          </>
                        )}
                        <td style={{padding:'16px 18px'}}>
                          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                            {!readonly && (
                              <>
                                <button title="Edit"
                                  onClick={()=>{setSelectedBatchForAction(b);setBatchForm({name:b.name,location:b.location||'',start_date:b.start_date?b.start_date.split('T')[0]:'',end_date:b.end_date?b.end_date.split('T')[0]:'',description:b.description||'',capacity:b.capacity||'',batch_code:b.batch_code||'',year:b.year||'',status:b.status||'Created'});setShowEditBatchModal(true)}}
                                  style={{background:'#2563eb',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600'}}>
                                  <Edit size={13}/>
                                </button>
                                <button title={b.is_locked?'Unlock Batch':'Lock Batch'} onClick={()=>handleToggleLockBatch(b)}
                                  style={{background:b.is_locked?'#dc2626':'#16a34a',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600'}}>
                                  {b.is_locked?<Unlock size={13}/>:<Lock size={13}/>}
                                </button>
                                <button 
                                  title={b.post_service_feedback_locked ? "Unlock Service & Trainer Feedback" : "Lock Service & Trainer Feedback"}
                                  onClick={() => handleOpenFeedbackLockModal(b)}
                                  style={{
                                    background: b.post_service_feedback_locked ? '#dc2626' : '#ea580c',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '6px 11px',
                                    cursor: 'pointer',
                                    color: '#ffffff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontWeight: '700',
                                    fontSize: '11.5px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {b.post_service_feedback_locked ? <Unlock size={13}/> : <Lock size={13}/>}
                                  <span>{b.post_service_feedback_locked ? "Unlock Service & Trainer Feedback" : "Lock Service & Trainer Feedback"}</span>
                                </button>
                                {b.status==='Completed'&&(
                                  <button title="Archive" onClick={()=>handleTransitionStatus(b.id,'Archived')}
                                    style={{background:'#475569',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600'}}>
                                    <Archive size={13}/>
                                  </button>
                                )}
                                {(b.status==='Completed'||b.status==='Archived')&&(
                                  <button title="Reopen to Planning" onClick={()=>handleTransitionStatus(b.id,'Planning')}
                                    style={{background:'#d97706',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600'}}>
                                    <RotateCcw size={13}/>
                                  </button>
                                )}
                              </>
                            )}
                            <button title="Export CSV" onClick={()=>handleExportBatch(b)}
                              style={{background:'#059669',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600'}}>
                              <Download size={13}/>
                            </button>
                            <button title="Hard Copy (PDF)" onClick={()=>handleDownloadHardCopy(b)} disabled={downloadingHardCopyId===b.id}
                              style={{background:'#4f46e5',border:'none',borderRadius:'8px',padding:'6px 10px',cursor:downloadingHardCopyId===b.id?'not-allowed':'pointer',color:'#ffffff',display:'flex',alignItems:'center',fontWeight:'600',opacity:downloadingHardCopyId===b.id?0.7:1}}>
                              {downloadingHardCopyId===b.id ? <div className="spinner spinner-sm" style={{width:13,height:13,borderColor:'rgba(255,255,255,0.3)',borderTopColor:'#fff'}}/> : <FileText size={13}/>}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Independent Cards (Clear gap between each batch) ── */}
          <div className="batch-mobile-cards" style={{flexDirection:'column',gap:'16px',display:'none'}}>
            {filteredBatches.map((b, idx)=>{
              const stColor = statusColor[b.status] || '#94a3b8'
              return (
                <div key={`mobile-batch-${b.id || idx}`} style={{
                  padding:'20px',
                  background:'#fff',
                  borderRadius:'16px',
                  border:'1.5px solid #e2e8f0',
                  boxShadow:'0 2px 6px rgba(0,0,0,0.03)'
                }}>
                  {/* Card Top: Name + Status */}
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px',marginBottom:'12px'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:'800',fontSize:'15px',color:'#0f172a',marginBottom:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</div>
                      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                        {b.batch_code && <span style={{fontFamily:'monospace',fontSize:'11px',color:'#475569',background:'#f1f5f9',padding:'1px 7px',borderRadius:'5px'}}>{b.batch_code}</span>}
                        {b.year && <span style={{fontSize:'11px',color:'#64748b'}}>Year {b.year}</span>}
                        {!readonly && (
                          <span style={{
                            background: b.post_service_feedback_locked ? '#fef2f2' : '#f0fdf4',
                            color: b.post_service_feedback_locked ? '#dc2626' : '#16a34a',
                            padding: '2px 8px',
                            borderRadius: '50px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: `1px solid ${b.post_service_feedback_locked ? '#fecaca' : '#bbf7d0'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            {b.post_service_feedback_locked ? <Lock size={10} /> : <Unlock size={10} />}
                            {b.post_service_feedback_locked ? 'Forms Locked' : 'Forms Open'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{background:stColor+'18',color:stColor,padding:'4px 12px',borderRadius:'50px',fontSize:'11.5px',fontWeight:'700',whiteSpace:'nowrap',border:`1px solid ${stColor}30`,flexShrink:0}}>{b.status||'—'}</span>
                  </div>

                  {/* Card Meta Grid */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 16px',marginBottom:'14px',padding:'12px 14px',background:'#f8fafc',borderRadius:'10px',border:'1px solid #f1f5f9'}}>
                    {b.location && (
                      <div style={{gridColumn:'span 2'}}>
                        <div style={{fontSize:'10px',fontWeight:'700',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:'2px'}}>Location</div>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'#334155'}}>{b.location}</div>
                      </div>
                    )}
                    {(b.start_date||b.end_date) && (
                      <div style={{gridColumn:'span 2'}}>
                        <div style={{fontSize:'10px',fontWeight:'700',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:'2px'}}>Dates</div>
                        <div style={{fontSize:'13px',fontWeight:'600',color:'#334155'}}>
                          {b.start_date ? new Date(b.start_date).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) : '—'}
                          {b.end_date ? <span style={{color:'#94a3b8',margin:'0 6px'}}>→</span> : null}
                          {b.end_date ? new Date(b.end_date).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}) : null}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{fontSize:'10px',fontWeight:'700',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:'2px'}}>Students</div>
                      <div style={{fontSize:'20px',fontWeight:'800',color:'#1d4ed8'}}>{b.student_count||0}</div>
                    </div>
                    <div>
                      <div style={{fontSize:'10px',fontWeight:'700',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:'2px'}}>Faculty</div>
                      <div style={{fontSize:'20px',fontWeight:'800',color:'#059669'}}>{b.faculty_count||0}</div>
                    </div>
                  </div>

                  {/* Card Actions - Solid Buttons */}
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {!readonly && (
                      <>
                        <button title="Edit"
                          onClick={()=>{setSelectedBatchForAction(b);setBatchForm({name:b.name,location:b.location||'',start_date:b.start_date?b.start_date.split('T')[0]:'',end_date:b.end_date?b.end_date.split('T')[0]:'',description:b.description||'',capacity:b.capacity||'',batch_code:b.batch_code||'',year:b.year||'',status:b.status||'Created'});setShowEditBatchModal(true)}}
                          style={{background:'#2563eb',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700'}}>
                          <Edit size={13}/> Edit
                        </button>
                        <button title={b.is_locked?'Unlock Batch':'Lock Batch'} onClick={()=>handleToggleLockBatch(b)}
                          style={{background:b.is_locked?'#dc2626':'#16a34a',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700'}}>
                          {b.is_locked?<Unlock size={13}/>:<Lock size={13}/>} {b.is_locked?'Unlock Batch':'Lock Batch'}
                        </button>
                        <button title={b.post_service_feedback_locked ? "Unlock Service & Trainer Feedback" : "Lock Service & Trainer Feedback"}
                          onClick={() => handleOpenFeedbackLockModal(b)}
                          style={{
                            background: b.post_service_feedback_locked ? '#dc2626' : '#ea580c',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            cursor: 'pointer',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12.5px',
                            fontWeight: '700'
                          }}
                        >
                          {b.post_service_feedback_locked ? <Unlock size={13} /> : <Lock size={13} />}
                          {b.post_service_feedback_locked ? "Unlock Service & Trainer Feedback" : "Lock Service & Trainer Feedback"}
                        </button>
                        {b.status==='Completed'&&(
                          <button title="Archive" onClick={()=>handleTransitionStatus(b.id,'Archived')}
                            style={{background:'#475569',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700'}}>
                            <Archive size={13}/> Archive
                          </button>
                        )}
                        {(b.status==='Completed'||b.status==='Archived')&&(
                          <button title="Reopen" onClick={()=>handleTransitionStatus(b.id,'Planning')}
                            style={{background:'#d97706',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700'}}>
                            <RotateCcw size={13}/> Reopen
                          </button>
                        )}
                      </>
                    )}
                    <button title="Export CSV" onClick={()=>handleExportBatch(b)}
                      style={{background:'#059669',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700'}}>
                      <Download size={13}/> Export
                    </button>
                    <button title="Hard Copy (PDF)" onClick={()=>handleDownloadHardCopy(b)} disabled={downloadingHardCopyId===b.id}
                      style={{background:'#4f46e5',border:'none',borderRadius:'8px',padding:'8px 14px',cursor:downloadingHardCopyId===b.id?'not-allowed':'pointer',color:'#ffffff',display:'flex',alignItems:'center',gap:'5px',fontSize:'12.5px',fontWeight:'700',opacity:downloadingHardCopyId===b.id?0.7:1}}>
                      {downloadingHardCopyId===b.id ? <div className="spinner spinner-sm" style={{width:13,height:13,borderColor:'rgba(255,255,255,0.3)',borderTopColor:'#fff'}}/> : <FileText size={13}/>} Hard Copy
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

