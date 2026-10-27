import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Plus, Search, Edit, Lock, Unlock, 
  Archive, RotateCcw, Download, FileText, X, Layers, FileSpreadsheet, Eye
} from 'lucide-react';

function Modal({ open, onClose, title, children, size = '', hideHeader = false }) {
  if (!open) return null;
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: size === 'lg' ? '700px' : '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {!hideHeader && (
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{title}</h3>
            <button 
              onClick={onClose} 
              style={{
                border: 'none',
                background: 'transparent',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ padding: '22px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

export default function RiBatchesTab({ token, apiBase, addToast, readonly }) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [downloadingHardCopyId, setDownloadingHardCopyId] = useState(null);
  const [downloadingCsvId, setDownloadingCsvId] = useState(null);
  const [downloadingExcelId, setDownloadingExcelId] = useState(null);

  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState('');
  const [batchSourceFilter, setBatchSourceFilter] = useState('all');

  // Modals
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [selectedBatchForAction, setSelectedBatchForAction] = useState(null);

  // Form states
  const [batchForm, setBatchForm] = useState({
    name: '',
    batch_code: '',
    location: '',
    year: '',
    start_date: '',
    end_date: '',
    capacity: 60,
    status: 'Created',
    description: ''
  });

  const BATCH_TIMELINE = ['Created', 'Planning', 'Orientation', 'Immersion', 'Completed', 'Archived'];
  const STATUSES = ['Created', 'Planning', 'Orientation', 'Immersion', 'Completed', 'Archived', 'active', 'upcoming'];

  const statusColor = {
    Created: '#6366f1',
    Planning: '#f59e0b',
    Orientation: '#0284c7',
    Immersion: '#059669',
    Completed: '#475569',
    Archived: '#94a3b8',
    active: '#059669',
    upcoming: '#0284c7',
    completed: '#475569'
  };

  const fetchRiBatches = async () => {
    if (!token) return;
    try {
      setLoadingBatches(true);
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      } else {
        addToast?.('Failed to retrieve RI batches', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast?.('Error connecting to server', 'error');
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchRiBatches();
  }, []);

  const handleCreateBatch = async (e) => {
    if (e) e.preventDefault();
    if (!batchForm.name.trim()) {
      addToast?.('Batch Name is required', 'error');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchForm)
      });
      const data = await res.json();
      if (res.ok) {
        addToast?.('RI Batch created successfully', 'success');
        setShowCreateBatchModal(false);
        setBatchForm({
          name: '',
          batch_code: '',
          location: '',
          year: '',
          start_date: '',
          end_date: '',
          capacity: 60,
          status: 'Created',
          description: ''
        });
        fetchRiBatches();
      } else {
        addToast?.(data.message || 'Failed to create RI batch', 'error');
      }
    } catch (err) {
      addToast?.('Server error creating RI batch', 'error');
    }
  };

  const handleUpdateBatch = async (e) => {
    if (e) e.preventDefault();
    if (!selectedBatchForAction) return;
    try {
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches/${selectedBatchForAction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(batchForm)
      });
      const data = await res.json();
      if (res.ok) {
        addToast?.('RI Batch updated successfully', 'success');
        setShowEditBatchModal(false);
        setSelectedBatchForAction(null);
        fetchRiBatches();
      } else {
        addToast?.(data.message || 'Failed to update RI batch', 'error');
      }
    } catch (err) {
      addToast?.('Server error updating RI batch', 'error');
    }
  };

  const handleToggleLockBatch = async (batch) => {
    const action = batch.is_locked ? 'unlock' : 'lock';
    try {
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches/${batch.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast?.(`RI Batch ${batch.is_locked ? 'unlocked' : 'locked'} successfully`, 'success');
        fetchRiBatches();
      } else {
        addToast?.(data.message || 'Failed to toggle lock status', 'error');
      }
    } catch (err) {
      addToast?.('Server error toggling lock status', 'error');
    }
  };

  const handleTransitionStatus = async (batchId, status) => {
    let endpoint = 'reopen';
    let body = { status };
    if (status === 'Archived') endpoint = 'archive';
    if (status === 'Completed') endpoint = 'close';

    try {
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches/${batchId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        addToast?.(`RI Batch transitioned to ${status}`, 'success');
        fetchRiBatches();
      } else {
        addToast?.(data.message || 'Failed to change status', 'error');
      }
    } catch (err) {
      addToast?.('Server error transitioning status', 'error');
    }
  };

  const handleExportCsv = async (batch) => {
    if (!token || !batch) return;
    setDownloadingCsvId(batch.id);
    try {
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches/${batch.id}/export-csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export RI batch');
      const data = await res.json();

      let csvContent = "\ufeff";
      csvContent += `Rural Immersion Batch,${data.batch.name}\n`;
      csvContent += `Batch Code,${data.batch.batch_code || ''}\n`;
      csvContent += `Year,${data.batch.year || ''}\n`;
      csvContent += `Location,${data.batch.location || ''}\n`;
      csvContent += `Status,${data.batch.status}\n`;
      csvContent += `Capacity,${data.batch.capacity || ''}\n\n`;

      csvContent += "RI STUDENTS ROSTER (RURAL IMMERSION ENROLLED ONLY)\n";
      csvContent += "ID,PRN,Name,Email,Gender,Department,School,Panel Name,Village,Undertaking Status\n";
      (data.students || []).forEach(s => {
        csvContent += `"${s.id}","${s.prn || ''}","${s.name}","${s.email}","${s.gender || ''}","${s.department || ''}","${s.school || ''}","${s.panel || 'Unassigned'}","${s.village || 'Unassigned'}","${s.undertaking_status}"\n`;
      });

      csvContent += "\nRI FACULTY MENTORS & NODAL OFFICERS\n";
      csvContent += "ID,Name,Email,Department,Designation,Phone,Panel,Village\n";
      (data.faculty || []).forEach(f => {
        csvContent += `"${f.id || ''}","${f.name}","${f.email}","${f.department || ''}","${f.designation || ''}","${f.phone || ''}","${f.panel || 'Unassigned'}","${f.village || 'Unassigned'}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `RI_Batch_${batch.name.replace(/\s+/g, '_')}_Roster.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast?.('RI Student Roster exported successfully', 'success');
    } catch (err) {
      console.error(err);
      addToast?.('Failed to export RI batch data', 'error');
    } finally {
      setDownloadingCsvId(null);
    }
  };

  const handleDownloadHardCopy = async (batch) => {
    if (!batch || !token) return;
    setDownloadingHardCopyId(batch.id);
    try {
      addToast?.('Generating RI Panel Attendance Hard Copy PDF...', 'info');
      const response = await fetch(`${apiBase}/api/ri/superadmin/batches/${batch.id}/hard-copy-pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to download RI attendance hard copy PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RI_${(batch.name || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_')}_PanelWise_Attendance_HardCopy.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      addToast?.('RI Attendance Hard Copy PDF downloaded successfully.', 'success');
    } catch (err) {
      console.error(err);
      addToast?.(err.message || 'Failed to download RI Hard Copy PDF.', 'error');
    } finally {
      setDownloadingHardCopyId(null);
    }
  };

  const handleDownloadMasterExcel = async (batch) => {
    if (!batch || !token) return;
    setDownloadingExcelId(batch.id);
    try {
      addToast?.('Preparing multi-sheet master Excel workbook...', 'info');
      const res = await fetch(`${apiBase}/api/ri/superadmin/batches/${batch.id}/export-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = (batch.name || `Batch_${batch.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        a.download = `RI_Batch_${batch.id}_${cleanName}_Master_Summary.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        addToast?.('Master Excel report downloaded successfully!', 'success');
      } else {
        addToast?.('Failed to export batch summary', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast?.('Export failed due to network error', 'error');
    } finally {
      setDownloadingExcelId(null);
    }
  };

  const filteredBatches = batches.filter(b => {
    const q = batchSearch.toLowerCase();
    const matchName = !batchSearch || b.name.toLowerCase().includes(q) || (b.batch_code || '').toLowerCase().includes(q) || (b.location || '').toLowerCase().includes(q);
    const matchStatus = !batchStatusFilter || (b.status || '').toLowerCase() === batchStatusFilter.toLowerCase();
    const matchSource = batchSourceFilter === 'all' || b.source_program === batchSourceFilter;
    return matchName && matchStatus && matchSource;
  });

  const renderBatchForm = (onSubmit, title, submitLabel) => (
    <Modal open={true} onClose={() => { setShowCreateBatchModal(false); setShowEditBatchModal(false); }} title={title} size="lg">
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Batch Name *</label>
            <input 
              required 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.name} 
              onChange={e => setBatchForm(f => ({ ...f, name: e.target.value }))} 
              placeholder="e.g. BATCH 1 - Rural Immersion"
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Batch Code (optional)</label>
            <input 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.batch_code} 
              onChange={e => setBatchForm(f => ({ ...f, batch_code: e.target.value }))} 
              placeholder="e.g. RI-01-1026"
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Location / Cluster</label>
            <input 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.location} 
              onChange={e => setBatchForm(f => ({ ...f, location: e.target.value }))} 
              placeholder="e.g. Bhor / Velhe Cluster"
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Academic Year</label>
            <input 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.year} 
              onChange={e => setBatchForm(f => ({ ...f, year: e.target.value }))} 
              placeholder="e.g. 2026"
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Start Date</label>
            <input 
              type="date" 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.start_date ? batchForm.start_date.split('T')[0] : ''} 
              onChange={e => setBatchForm(f => ({ ...f, start_date: e.target.value }))} 
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>End Date</label>
            <input 
              type="date" 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.end_date ? batchForm.end_date.split('T')[0] : ''} 
              onChange={e => setBatchForm(f => ({ ...f, end_date: e.target.value }))} 
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Target Panel Capacity</label>
            <input 
              type="number" 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              value={batchForm.capacity} 
              onChange={e => setBatchForm(f => ({ ...f, capacity: e.target.value }))} 
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Timeline Stage</label>
            <select 
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', background: '#fff', boxSizing: 'border-box' }}
              value={batchForm.status} 
              onChange={e => setBatchForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '5px' }}>Description</label>
          <textarea 
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', height: '65px', resize: 'vertical', boxSizing: 'border-box' }}
            value={batchForm.description} 
            onChange={e => setBatchForm(f => ({ ...f, description: e.target.value }))} 
            placeholder="Optional remarks or notes about this Rural Immersion cohort..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <button 
            type="button" 
            onClick={() => { setShowCreateBatchModal(false); setShowEditBatchModal(false); }} 
            style={{ padding: '9px 18px', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', color: '#475569', cursor: 'pointer', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            style={{ padding: '9px 20px', background: '#059669', border: 'none', borderRadius: '8px', fontWeight: '700', color: '#ffffff', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 6px rgba(5,150,105,0.2)' }}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Create Modal */}
      {showCreateBatchModal && renderBatchForm(handleCreateBatch, 'Create New RI Batch', 'Create RI Batch')}
      {/* Edit Modal */}
      {showEditBatchModal && renderBatchForm(handleUpdateBatch, `Edit: ${selectedBatchForAction?.name || 'RI Batch'}`, 'Save Changes')}

      {/* Responsive Toolbar */}
      <div 
        className="ri-batch-toolbar" 
        style={{ 
          display: 'flex', 
          gap: '12px', 
          flexWrap: 'wrap', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: '14px',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        {/* Filters Group */}
        <div className="ri-batch-toolbar-filters" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 320px', minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '8px 12px', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={15} style={{ color: '#059669', flexShrink: 0 }} />
            <input 
              placeholder="Search batches by name, code, cluster..." 
              value={batchSearch} 
              onChange={e => setBatchSearch(e.target.value)} 
              style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent', color: '#0f172a' }}
            />
          </div>

          <div className="ri-batch-select-group" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select 
              value={batchStatusFilter} 
              onChange={e => setBatchStatusFilter(e.target.value)} 
              style={{ padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: '600', background: '#fff', outline: 'none', minWidth: '130px', color: '#0f172a' }}
            >
              <option value="">All Stages</option>
              {BATCH_TIMELINE.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="active">Active (Legacy)</option>
              <option value="upcoming">Upcoming (Legacy)</option>
            </select>

            <select 
              value={batchSourceFilter} 
              onChange={e => setBatchSourceFilter(e.target.value)} 
              style={{ padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: '600', background: '#fff', outline: 'none', minWidth: '130px', color: '#0f172a' }}
            >
              <option value="all">All Sources</option>
              <option value="RI_DIRECT">RI Direct Only</option>
              <option value="LTC_SYNC">LTC Synced Only</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ri-batch-toolbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchRiBatches} 
            title="Refresh Batches"
            style={{
              borderRadius: '9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 15px',
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              color: '#334155',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={14} className={loadingBatches ? 'spin' : ''} /> Refresh
          </button>
          {!readonly && (
            <button 
              onClick={() => {
                setBatchForm({
                  name: '',
                  batch_code: '',
                  location: '',
                  year: new Date().getFullYear(),
                  start_date: '',
                  end_date: '',
                  capacity: 60,
                  status: 'Created',
                  description: ''
                });
                setShowCreateBatchModal(true);
              }} 
              style={{
                borderRadius: '9px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                background: '#047857',
                border: 'none',
                color: '#ffffff',
                fontWeight: '750',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(4,120,87,0.22)',
                transition: 'all 0.15s ease'
              }}
            >
              <Plus size={15} /> Create RI Batch
            </button>
          )}
        </div>
      </div>

      {/* Batch Content Table / Cards */}
      {loadingBatches ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'center', padding: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: '700', fontSize: '14px' }}>
            <RefreshCw size={18} className="spin" /> Loading Rural Immersion Batches...
          </div>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', textAlign: 'center', padding: '56px 20px', color: '#64748b', fontSize: '14px' }}>
          <Layers size={32} style={{ color: '#94a3b8', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px', marginBottom: '4px' }}>No Batches Found</div>
          <div>No RI batches match your filter criteria. Create an RI batch to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <style>{`
            .spin { animation: spin 1s linear infinite; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
            @media (max-width: 900px) {
              .ri-batch-desktop-table { display: none !important; }
              .ri-batch-mobile-cards { display: flex !important; }
            }
            @media (min-width: 901px) {
              .ri-batch-desktop-table { display: block !important; }
              .ri-batch-mobile-cards { display: none !important; }
            }
            @media (max-width: 768px) {
              .ri-batch-toolbar {
                padding: 12px !important;
                gap: 10px !important;
              }
              .ri-batch-toolbar-filters {
                width: 100% !important;
              }
              .ri-batch-toolbar-actions {
                width: 100% !important;
                display: flex !important;
              }
              .ri-batch-toolbar-actions button {
                flex: 1 !important;
                justify-content: center !important;
              }
            }
            @media (max-width: 520px) {
              .ri-batch-select-group {
                width: 100% !important;
                display: flex !important;
                gap: 8px !important;
              }
              .ri-batch-select-group select {
                flex: 1 !important;
                min-width: 0 !important;
              }
            }
            .ri-act-btn:hover {
              filter: brightness(1.1);
              transform: translateY(-1px);
            }
          `}</style>

          {/* ── Desktop Table View ── */}
          <div className="ri-batch-desktop-table" style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Batch', 'Code', 'Location', 'Dates', 'RI Students', 'Mentors', 'Panels', 'Stage', ...(readonly ? [] : ['Locked'])].map(h => (
                      <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', color: '#475569', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                    <th style={{ padding: '13px 16px', textAlign: 'right', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', color: '#475569', whiteSpace: 'nowrap', letterSpacing: '0.5px', minWidth: '220px', width: '230px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((b, idx) => {
                    const stColor = statusColor[b.status] || '#94a3b8';
                    const isLocked = Boolean(b.is_locked);
                    const studentCount = Number(b.student_count ?? b.total_students ?? 0);
                    const facultyCount = Number(b.faculty_count ?? b.total_faculty ?? 0);
                    const panelsCount = Number(b.total_panels ?? 0);

                    return (
                      <tr 
                        key={`desktop-ri-batch-${b.id || idx}`} 
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fcfdfd'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px', maxWidth: '220px' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.name}>
                            {b.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            {b.year && <span style={{ fontSize: '11px', color: '#64748b' }}>Year {b.year}</span>}
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: b.source_program === 'LTC_SYNC' ? '#e0e7ff' : '#ecfdf5',
                              color: b.source_program === 'LTC_SYNC' ? '#4338ca' : '#047857'
                            }}>
                              {b.source_program === 'LTC_SYNC' ? 'LTC Synced' : 'RI Direct'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '6px' }}>
                            {b.batch_code || `RI-${b.id}`}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#334155', whiteSpace: 'nowrap', fontSize: '13px' }}>
                          {b.location || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#334155', whiteSpace: 'nowrap' }}>
                          {b.start_date ? new Date(b.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                          {b.end_date ? <span style={{ color: '#94a3b8', margin: '0 4px' }}>→</span> : null}
                          {b.end_date ? new Date(b.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : null}
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '850', color: '#059669', fontSize: '14.5px' }}>
                            {studentCount}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '14px' }}>
                            {facultyCount}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '700', color: '#475569', fontSize: '13px' }}>
                            {panelsCount}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: stColor + '18', color: stColor, padding: '4px 12px', borderRadius: '50px', fontSize: '11.5px', fontWeight: '750', whiteSpace: 'nowrap', border: `1px solid ${stColor}35` }}>
                            {b.status || '—'}
                          </span>
                        </td>
                        {!readonly && (
                          <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              background: isLocked ? '#fef2f2' : '#f0fdf4',
                              color: isLocked ? '#dc2626' : '#15803d',
                              padding: '4px 12px',
                              borderRadius: '50px',
                              fontSize: '11.5px',
                              fontWeight: '750',
                              whiteSpace: 'nowrap',
                              border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}`
                            }}>
                              {isLocked ? 'Locked' : 'Unlocked'}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '220px', width: '230px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'nowrap' }}>
                            {!readonly && (
                              <>
                                <button 
                                  className="ri-act-btn"
                                  title="Edit RI Batch"
                                  onClick={() => {
                                    setSelectedBatchForAction(b);
                                    setBatchForm({
                                      name: b.name,
                                      location: b.location || '',
                                      start_date: b.start_date ? b.start_date.split('T')[0] : '',
                                      end_date: b.end_date ? b.end_date.split('T')[0] : '',
                                      description: b.description || '',
                                      capacity: b.panel_capacity || 60,
                                      batch_code: b.batch_code || '',
                                      year: b.year || '',
                                      status: b.status || 'Created'
                                    });
                                    setShowEditBatchModal(true);
                                  }}
                                  style={{ width: '32px', height: '32px', background: '#0284c7', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(2,132,199,0.2)' }}
                                >
                                  <Edit size={14} />
                                </button>
                                <button 
                                  className="ri-act-btn"
                                  title={isLocked ? 'Unlock RI Batch' : 'Lock RI Batch'} 
                                  onClick={() => handleToggleLockBatch(b)}
                                  style={{ width: '32px', height: '32px', background: isLocked ? '#dc2626' : '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', boxShadow: isLocked ? '0 1px 3px rgba(220,38,38,0.2)' : '0 1px 3px rgba(5,150,105,0.2)' }}
                                >
                                  {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                                </button>
                                {b.status === 'Completed' && (
                                  <button 
                                    className="ri-act-btn"
                                    title="Archive RI Batch" 
                                    onClick={() => handleTransitionStatus(b.id, 'Archived')}
                                    style={{ width: '32px', height: '32px', background: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                                  >
                                    <Archive size={14} />
                                  </button>
                                )}
                                {(b.status === 'Completed' || b.status === 'Archived') && (
                                  <button 
                                    className="ri-act-btn"
                                    title="Reopen to Planning" 
                                    onClick={() => handleTransitionStatus(b.id, 'Planning')}
                                    style={{ width: '32px', height: '32px', background: '#d97706', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                              </>
                            )}

                            {/* Export CSV (RI Students only) */}
                            <button 
                              className="ri-act-btn"
                              title="Export RI Students Roster (CSV)" 
                              onClick={() => handleExportCsv(b)}
                              disabled={downloadingCsvId === b.id}
                              style={{ width: '32px', height: '32px', background: '#047857', border: 'none', borderRadius: '8px', cursor: downloadingCsvId === b.id ? 'not-allowed' : 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', opacity: downloadingCsvId === b.id ? 0.7 : 1, boxShadow: '0 1px 3px rgba(4,120,87,0.2)' }}
                            >
                              {downloadingCsvId === b.id ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
                            </button>

                            {/* Attendance Hard Copy PDF with Undertaking Status */}
                            <button 
                              className="ri-act-btn"
                              title="RI Panel Attendance Hard Copy (PDF with Undertaking Status)" 
                              onClick={() => handleDownloadHardCopy(b)} 
                              disabled={downloadingHardCopyId === b.id}
                              style={{ width: '32px', height: '32px', background: '#4f46e5', border: 'none', borderRadius: '8px', cursor: downloadingHardCopyId === b.id ? 'not-allowed' : 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: downloadingHardCopyId === b.id ? 0.7 : 1, transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(79,70,229,0.2)' }}
                            >
                              {downloadingHardCopyId === b.id ? <RefreshCw size={14} className="spin" /> : <FileText size={14} />}
                            </button>

                            {/* Master Summary Multi-Sheet Excel */}
                            <button 
                              className="ri-act-btn"
                              title="Download Master Summary Excel" 
                              onClick={() => handleDownloadMasterExcel(b)}
                              disabled={downloadingExcelId === b.id}
                              style={{ width: '32px', height: '32px', background: '#0d9488', border: 'none', borderRadius: '8px', cursor: downloadingExcelId === b.id ? 'not-allowed' : 'pointer', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: downloadingExcelId === b.id ? 0.7 : 1, transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(13,148,136,0.2)' }}
                            >
                              {downloadingExcelId === b.id ? <RefreshCw size={14} className="spin" /> : <FileSpreadsheet size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Mobile Cards View ── */}
          <div className="ri-batch-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '14px' }}>
            {filteredBatches.map(b => {
              const stColor = statusColor[b.status] || '#94a3b8';
              const isLocked = Boolean(b.is_locked);
              const studentCount = Number(b.student_count ?? b.total_students ?? 0);
              const facultyCount = Number(b.faculty_count ?? b.total_faculty ?? 0);
              const panelsCount = Number(b.total_panels ?? 0);

              return (
                <div 
                  key={`mobile-ri-batch-${b.id}`} 
                  style={{ 
                    background: '#ffffff', 
                    border: '1.5px solid #e2e8f0', 
                    borderRadius: '16px', 
                    padding: '16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Header & Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: '850', fontSize: '15px', color: '#0f172a', wordBreak: 'break-word' }}>
                        {b.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: '700', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px' }}>
                          {b.batch_code || `RI-${b.id}`}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: b.source_program === 'LTC_SYNC' ? '#e0e7ff' : '#ecfdf5',
                          color: b.source_program === 'LTC_SYNC' ? '#4338ca' : '#047857'
                        }}>
                          {b.source_program === 'LTC_SYNC' ? 'LTC Synced' : 'RI Direct'}
                        </span>
                        {b.year && <span style={{ fontSize: '11px', color: '#64748b' }}>Year {b.year}</span>}
                      </div>
                    </div>
                    <span style={{ background: stColor + '18', color: stColor, padding: '3px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: '800', border: `1px solid ${stColor}35`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {b.status || 'Active'}
                    </span>
                  </div>

                  {/* Location & Dates */}
                  <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#64748b' }}>Location:</span>
                      <span>{b.location || '—'}</span>
                    </div>
                    {(b.start_date || b.end_date) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#64748b' }}>Dates:</span>
                        <span>
                          {b.start_date ? new Date(b.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                          {b.end_date ? ' → ' + new Date(b.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' }) : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4-Stat Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', background: '#f1f5f9', padding: '10px 8px', borderRadius: '12px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Students</div>
                      <div style={{ fontSize: '14px', fontWeight: '850', color: '#059669', marginTop: '2px' }}>{studentCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Mentors</div>
                      <div style={{ fontSize: '14px', fontWeight: '850', color: '#0284c7', marginTop: '2px' }}>{facultyCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Panels</div>
                      <div style={{ fontSize: '14px', fontWeight: '850', color: '#475569', marginTop: '2px' }}>{panelsCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Status</div>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: isLocked ? '#dc2626' : '#15803d', marginTop: '4px' }}>
                        {isLocked ? 'Locked' : 'Unlocked'}
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                    {!readonly && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => {
                            setSelectedBatchForAction(b);
                            setBatchForm({
                              name: b.name,
                              location: b.location || '',
                              start_date: b.start_date ? b.start_date.split('T')[0] : '',
                              end_date: b.end_date ? b.end_date.split('T')[0] : '',
                              description: b.description || '',
                              capacity: b.panel_capacity || 60,
                              batch_code: b.batch_code || '',
                              year: b.year || '',
                              status: b.status || 'Created'
                            });
                            setShowEditBatchModal(true);
                          }}
                          style={{ flex: 1, padding: '9px 12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <Edit size={13} /> Edit
                        </button>
                        <button 
                          onClick={() => handleToggleLockBatch(b)}
                          style={{ flex: 1, padding: '9px 12px', background: isLocked ? '#dc2626' : '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          {isLocked ? <Unlock size={13} /> : <Lock size={13} />} {isLocked ? 'Unlock' : 'Lock'}
                        </button>
                        {b.status === 'Completed' && (
                          <button 
                            title="Archive RI Batch" 
                            onClick={() => handleTransitionStatus(b.id, 'Archived')}
                            style={{ padding: '9px 12px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Archive size={13} />
                          </button>
                        )}
                        {(b.status === 'Completed' || b.status === 'Archived') && (
                          <button 
                            title="Reopen to Planning" 
                            onClick={() => handleTransitionStatus(b.id, 'Planning')}
                            style={{ padding: '9px 12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Export Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <button 
                        onClick={() => handleExportCsv(b)}
                        disabled={downloadingCsvId === b.id}
                        style={{ padding: '8px 4px', background: '#047857', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: downloadingCsvId === b.id ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        title="Export RI Students Roster CSV"
                      >
                        {downloadingCsvId === b.id ? <RefreshCw size={12} className="spin" /> : <Download size={12} />} CSV
                      </button>
                      <button 
                        onClick={() => handleDownloadHardCopy(b)}
                        disabled={downloadingHardCopyId === b.id}
                        style={{ padding: '8px 4px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: downloadingHardCopyId === b.id ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        title="Hard Copy PDF"
                      >
                        {downloadingHardCopyId === b.id ? <RefreshCw size={12} className="spin" /> : <FileText size={12} />} Attendance
                      </button>
                      <button 
                        onClick={() => handleDownloadMasterExcel(b)}
                        disabled={downloadingExcelId === b.id}
                        style={{ padding: '8px 4px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: downloadingExcelId === b.id ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        title="Master Excel"
                      >
                        {downloadingExcelId === b.id ? <RefreshCw size={12} className="spin" /> : <FileSpreadsheet size={12} />} Master Excel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
