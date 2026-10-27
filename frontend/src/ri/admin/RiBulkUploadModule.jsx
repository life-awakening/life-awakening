import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud, CheckCircle, AlertCircle, RefreshCw, Download, FileSpreadsheet,
  Users, Layers, ArrowRight, Check, X, ShieldAlert, Info
} from 'lucide-react';
import { cleanPanelName } from '../shared/riUtils';

export default function RiBulkUploadModule({
  batches = [],
  selectedBatchId,
  setSelectedBatchId,
  onNavigateToStudents,
  API,
  toast = (msg, type) => console.log(msg, type)
}) {
  const [file, setFile] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  const fileInputRef = useRef(null);

  // Filter strictly for RI-only batches created directly in the RI Admin panel
  // Excludes LTC-synchronized batches and batches originating from LTC
  const riOnlyBatches = useMemo(() => {
    return (batches || []).filter(b => {
      const isLtcSynced = Boolean(
        b.source_batch_id ||
        b.source_program === 'LTC' ||
        b.source_program === 'LTC_SYNC' ||
        b.is_synced_to_ri
      );
      return !isLtcSynced;
    });
  }, [batches]);

  // Target RI-only batch resolution
  const currentBatch = useMemo(() => {
    if (!riOnlyBatches.length) return null;
    if (selectedBatchId) {
      const found = riOnlyBatches.find(b => String(b.id) === String(selectedBatchId));
      if (found) return found;
    }
    return riOnlyBatches[0];
  }, [riOnlyBatches, selectedBatchId]);

  const currentBatchId = currentBatch ? currentBatch.id : null;

  // Auto-sync selectedBatchId if current selection is not an eligible RI-only batch
  useEffect(() => {
    if (riOnlyBatches.length > 0) {
      const isSelectedEligible = riOnlyBatches.some(b => String(b.id) === String(selectedBatchId));
      if (!isSelectedEligible && setSelectedBatchId) {
        setSelectedBatchId(riOnlyBatches[0].id);
      }
    } else if (selectedBatchId && setSelectedBatchId) {
      setSelectedBatchId(null);
    }
  }, [riOnlyBatches, selectedBatchId, setSelectedBatchId]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
    e.target.value = null;
  };

  const processSelectedFile = async (selectedFile) => {
    const ext = selectedFile.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls') && !ext.endsWith('.csv')) {
      toast('Unsupported format. Please upload an Excel (.xlsx, .xls) or CSV file.', 'error');
      return;
    }

    if (!currentBatchId || riOnlyBatches.length === 0) {
      toast('Please select an eligible RI Direct Batch first. LTC-synchronized batches cannot receive bulk uploads here.', 'error');
      return;
    }

    setFile(selectedFile);
    setUploadResult(null);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('mode', 'batch_wise');

      const res = await fetch(`${API}/api/ri/batches/${currentBatchId}/students/validate-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Validation request failed');
      }

      setValidationResult(data);
      if (data.summary?.invalid_rows > 0) {
        toast(`Validation finished: ${data.summary.valid_rows} valid, ${data.summary.invalid_rows} with errors.`, 'warning');
      } else {
        toast(`File validated: ${data.summary.valid_rows} students ready to upload.`, 'success');
      }
    } catch (err) {
      console.error('Validation error:', err);
      toast(err.message || 'Failed to validate uploaded file', 'error');
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setValidationResult(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = async () => {
    if (!currentBatchId) {
      toast('Select a batch to download the batch-tailored template.', 'error');
      return;
    }
    setIsDownloadingTemplate(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/batches/${currentBatchId}/students/template`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanBatch = (currentBatch?.name || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `RI_Students_Bulk_Upload_Template_${cleanBatch}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Sample template downloaded successfully.', 'success');
    } catch (err) {
      console.error('Template download error:', err);
      toast(err.message || 'Failed to download template', 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleSubmitBulkUpload = async () => {
    if (!file) {
      toast('Please select a file first.', 'error');
      return;
    }
    if (!currentBatchId) {
      toast('Please select an RI Batch.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'batch_wise');

      const res = await fetch(`${API}/api/ri/batches/${currentBatchId}/students/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to complete student bulk upload');
      }

      setUploadResult(data);
      toast(data.message || 'Students imported successfully!', 'success');
    } catch (err) {
      console.error('Bulk upload submission error:', err);
      toast(err.message || 'Failed to import students', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '16px',
        padding: 'clamp(14px, 4vw, 24px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), 0 1px 3px rgba(0, 0, 0, 0.01)',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      className="animate-fade-in"
    >
      {/* Target Batch Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginBottom: '20px' }}>
        <label style={{ fontSize: '11.5px', fontWeight: '750', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Target RI Batch (RI-Only)
        </label>
        {riOnlyBatches.length === 0 ? (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px dashed #f59e0b',
              backgroundColor: '#fffbeb',
              color: '#b45309',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <strong>No RI-only batches available.</strong>
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
                Bulk upload is restricted to directly created RI batches. LTC-synchronized batches are excluded.
              </div>
            </div>
          </div>
        ) : (
          <>
            <select
              value={currentBatchId || ''}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                handleClearFile();
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              {riOnlyBatches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.batch_code ? ` (${b.batch_code})` : ''} — RI Direct
                </option>
              ))}
            </select>
            {currentBatch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#047857', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', padding: '2px 7px' }}>
                  RI Direct • Isolated (Students will not appear in LTC)
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Format Requirements Box */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={15} color="#047857" />
          Required &amp; Optional Columns:
        </span>

        <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {[
              { label: 'PRN', req: true },
              { label: 'Name', req: true },
              { label: 'Email', req: true },
              { label: 'Panel', req: true },
              { label: 'Mobile No', req: false },
              { label: 'Department', req: false },
              { label: 'School', req: false },
              { label: 'Division', req: false },
              { label: 'Roll No', req: false },
              { label: 'Gender', req: false },
              { label: 'DOB', req: false }
            ].map(col => (
              <span
                key={col.label}
                style={{
                  backgroundColor: col.req ? '#dcfce7' : '#e2e8f0',
                  color: col.req ? '#166534' : '#334155',
                  border: col.req ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  fontWeight: '700'
                }}
              >
                {col.label} {col.req && '*'}
              </span>
            ))}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#64748b' }}>
            * Panels in sheet are matched to existing batch panels or created automatically.
          </p>
        </div>
      </div>


      {/* Styled Drag & Drop Zone */}
      {!uploadResult && (
        <div
          onDragOver={riOnlyBatches.length > 0 ? handleDragOver : undefined}
          onDragLeave={riOnlyBatches.length > 0 ? handleDragLeave : undefined}
          onDrop={riOnlyBatches.length > 0 ? handleDrop : undefined}
          onClick={() => {
            if (riOnlyBatches.length === 0) {
              toast('Cannot upload: No eligible RI-only batches found. Please create an RI Direct batch first.', 'warning');
              return;
            }
            if (fileInputRef.current) fileInputRef.current.click();
          }}
          style={{
            border: riOnlyBatches.length === 0
              ? '2px dashed #e2e8f0'
              : isDragging
                ? '2px dashed #047857'
                : '2px dashed #cbd5e1',
            borderRadius: '14px',
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: riOnlyBatches.length === 0
              ? '#f8fafc'
              : isDragging
                ? '#ecfdf5'
                : '#f8fafc',
            cursor: riOnlyBatches.length === 0 ? 'not-allowed' : 'pointer',
            opacity: riOnlyBatches.length === 0 ? 0.65 : 1,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: '20px'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={riOnlyBatches.length === 0}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: isDragging ? 'rgba(4, 120, 87, 0.15)' : 'rgba(4, 120, 87, 0.08)',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
            >
              <UploadCloud size={24} />
            </div>

            <div>
              <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#047857' }}>
                Click to choose file
              </span>
              <span style={{ fontSize: '13.5px', color: '#64748b' }}> or drag &amp; drop here</span>
            </div>

            <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
              Supports CSV, XLSX, XLS (Up to 25 MB)
            </span>
          </div>
        </div>
      )}

      {/* Selected File Pill */}
      {file && !uploadResult && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={18} color="#047857" />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#14532d' }}>
                {file.name}
              </div>
              <div style={{ fontSize: '11.5px', color: '#166534' }}>
                {(file.size / 1024).toFixed(1)} KB • Target: {currentBatch?.name}
              </div>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px'
            }}
            title="Clear selected file"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Validation in Progress */}
      {isValidating && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '24px', color: '#047857' }}>
          <RefreshCw size={18} className="animate-spin" />
          <span style={{ fontSize: '13.5px', fontWeight: '700' }}>Validating student rows and resolving panel allocations…</span>
        </div>
      )}

      {/* Validation Results & Preview Table */}
      {validationResult && !uploadResult && (
        <div style={{ borderTop: '1.5px solid #f1f5f9', paddingTop: '20px' }}>
          {/* Summary Badges */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {validationResult.summary?.valid_rows || 0} Valid Students
            </span>

            {validationResult.summary?.invalid_rows > 0 && (
              <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {validationResult.summary.invalid_rows} Invalid Rows
              </span>
            )}

            {validationResult.summary?.existing_users_matched > 0 && (
              <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {validationResult.summary.existing_users_matched} Existing Users Linked
              </span>
            )}
          </div>

          {/* Validation Errors Box */}
          {validationResult.summary?.invalid_rows > 0 && (
            <div
              style={{
                marginBottom: '20px',
                background: '#fff5f5',
                border: '1.5px solid #fee2e2',
                borderRadius: '12px',
                padding: '16px',
                color: '#b91c1c'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13.5px' }}>
                <AlertCircle size={16} />
                <span>Validation Errors Found in Spreadsheet:</span>
              </div>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '12px', color: '#b91c1c', lineHeight: 1.6, margin: 0 }}>
                {validationResult.validated_rows
                  ?.filter(r => !r.is_valid)
                  .slice(0, 5)
                  .map((r, i) => (
                    <li key={i}>
                      <strong>Row {r.row_number} ({r.name || r.prn || 'Unknown'}):</strong> {r.errors.join(' • ')}
                    </li>
                  ))}
                {validationResult.summary.invalid_rows > 5 && (
                  <li>…and {validationResult.summary.invalid_rows - 5} more rows with errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Preview Validated Rows ({validationResult.validated_rows?.length || 0})
            </h4>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Row</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>PRN</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Email</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Panel Name</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>Dept / Div</th>
                  </tr>
                </thead>
                <tbody>
                  {(validationResult.validated_rows || []).slice(0, 10).map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.row_number}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {r.is_valid ? (
                          <span style={{ backgroundColor: '#ecfdf5', color: '#047857', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            Valid
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            Error
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{r.prn || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#14532d', whiteSpace: 'nowrap' }}>{r.name}</td>
                      <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{r.email}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {cleanPanelName(r.resolved_panel_name || r.raw_panel_input)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {r.department || '—'} {r.division ? `(Div ${r.division})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {validationResult.validated_rows?.length > 10 && (
                <div style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11.5px', color: '#64748b', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  Showing first 10 of {validationResult.validated_rows.length} rows
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSubmitBulkUpload}
              disabled={isUploading || validationResult.summary?.valid_rows === 0}
              style={{
                background: '#047857',
                color: '#ffffff',
                borderRadius: '10px',
                fontWeight: '700',
                padding: '11px 24px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13.5px',
                boxShadow: '0 4px 12px rgba(4, 120, 87, 0.2)',
                opacity: isUploading || validationResult.summary?.valid_rows === 0 ? 0.6 : 1,
                cursor: isUploading || validationResult.summary?.valid_rows === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isUploading ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Uploading Students…
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Upload {validationResult.summary?.valid_rows} Students to {currentBatch?.name}
                </>
              )}
            </button>

            <button
              onClick={handleClearFile}
              disabled={isUploading}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: '10px',
                fontWeight: '600',
                padding: '11px 18px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success View */}
      {uploadResult && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: '14px',
            padding: '28px',
            textAlign: 'center',
            marginTop: '12px'
          }}
          className="animate-fade-in"
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <CheckCircle size={28} />
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#14532d', margin: '0 0 8px 0' }}>
            Student Ingestion Complete!
          </h3>

          <p style={{ fontSize: '14px', color: '#166534', margin: '0 0 20px 0', lineHeight: 1.5 }}>
            {uploadResult.message}
          </p>

          <div style={{ display: 'inline-flex', gap: '16px', background: '#ffffff', padding: '12px 24px', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#047857' }}>
                {uploadResult.imported_count || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                Enrolled
              </div>
            </div>
            <div style={{ borderLeft: '1px solid #e2e8f0', height: '36px' }} />
            <div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                {uploadResult.accounts_created || 0}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>
                New Accounts
              </div>
            </div>
            {uploadResult.rejected_count > 0 && (
              <>
                <div style={{ borderLeft: '1px solid #e2e8f0', height: '36px' }} />
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
                    {uploadResult.rejected_count}
                  </div>
                  <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '750', textTransform: 'uppercase' }}>
                    Rejected / Blocked
                  </div>
                </div>
              </>
            )}
          </div>

          {/* List of Rejected Rows if any */}
          {uploadResult.rejected_rows && uploadResult.rejected_rows.length > 0 && (
            <div
              style={{
                marginBottom: '24px',
                textAlign: 'left',
                background: '#fff5f5',
                border: '1.5px solid #fecaca',
                borderRadius: '12px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px', color: '#b91c1c', marginBottom: '10px' }}>
                <AlertCircle size={16} />
                <span>Rejected Rows ({uploadResult.rejected_rows.length})</span>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #fee2e2', color: '#7f1d1d' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: '50px' }}>Row</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: '110px' }}>PRN</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: '160px' }}>Name</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.rejected_rows.map((rej, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid #fef2f2' }}>
                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#991b1b' }}>{rej.row_number}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#0f172a' }}>{rej.prn || '—'}</td>
                        <td style={{ padding: '6px 8px', color: '#334155' }}>{rej.name}</td>
                        <td style={{ padding: '6px 8px', color: '#b91c1c', fontWeight: '600' }}>{rej.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              onClick={() => onNavigateToStudents && onNavigateToStudents()}
              style={{
                backgroundColor: '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(4, 120, 87, 0.2)'
              }}
            >
              View Enrolled RI Students <ArrowRight size={15} />
            </button>

            <button
              onClick={handleClearFile}
              style={{
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1.5px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
