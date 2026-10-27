import React, { useState, useRef } from 'react'
import { 
  UploadCloud, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  FileSpreadsheet, 
  Layers, 
  Lock,
  GraduationCap,
  Users,
  Shield,
  Check,
  X
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useLanguage } from '../context/LanguageContext'

export default function BulkUploadModule({
  isLtcUpload = false,
  setIsLtcUpload,
  bulkData = { students: [], faculty: [], errors: [] },
  isUploading,
  handleFileUpload,
  handleLtcFileUpload,
  handleStudentFileUpload,
  submitBulkUpload,
  batches = [],
  selectedBatchId,
  onSelectBatch,
  lockedBatchId,
  lockedBatchName,
  uploadedFileName,
  onClearFile,
  t
}) {
  const { t: translate } = useLanguage()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Support local fallback if setIsLtcUpload isn't provided by a parent
  const [localIsLtc, setLocalIsLtc] = useState(Boolean(isLtcUpload))
  const isLtcMode = setIsLtcUpload !== undefined ? Boolean(isLtcUpload) : localIsLtc

  const handleSelectMode = (targetIsLtc) => {
    if (isLtcMode === targetIsLtc) return
    if (onClearFile) onClearFile()
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (setIsLtcUpload) {
      setIsLtcUpload(targetIsLtc)
    } else {
      setLocalIsLtc(targetIsLtc)
    }
  }

  const currentUploadHandler = isLtcMode
    ? (handleLtcFileUpload || handleFileUpload)
    : (handleStudentFileUpload || handleFileUpload)

  const hasData = (bulkData.students && bulkData.students.length > 0) || 
                  (bulkData.faculty && bulkData.faculty.length > 0) || 
                  (bulkData.errors && bulkData.errors.length > 0)

  const effectiveBatchId = lockedBatchId || selectedBatchId || ''
  const effectiveBatchObj = batches.find(b => String(b.id) === String(effectiveBatchId))
  const effectiveBatchName = lockedBatchName || (effectiveBatchObj ? effectiveBatchObj.name : (effectiveBatchId ? `Batch #${effectiveBatchId}` : ''))

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (!isLtcMode && !effectiveBatchId) {
      alert(translate('Please select a target batch before uploading school student data.'))
      return
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const mockEvent = {
        target: {
          files: e.dataTransfer.files
        }
      }
      if (currentUploadHandler) currentUploadHandler(mockEvent)
    }
  }

  const handleContainerClick = () => {
    if (!isLtcMode && !effectiveBatchId) {
      alert(translate('Please select a target batch before uploading school student data.'))
      return
    }
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // ── Template Downloads ────────────────────────────────────────────────────────
  const handleDownloadStudentTemplate = () => {
    const headers = [
      "Timestamp",
      "Email Address1",
      "Student Full Name ",
      "Date of Birth ",
      "Gender ",
      "Blood Group",
      "Name of the School",
      "School Branch",
      "Class / Standard ",
      "Division",
      "Parent/Guardian Name ",
      "Relationship with Student ",
      "Contact Number (Valid What's App Mobile Number)",
      "Alternate Contact Number ",
      "Email Address 2",
      "Residential Address ",
      "Upload Payment Screenshot",
      "Does your child have any medical condition? ",
      "If Yes - Please specify details ",
      "Any allergies",
      "Parent/Guardian Consent Confirmation",
      "Upload digital signature as a confirmation"
    ]

    const sampleRow = [
      "2026-03-15 10:30:00",
      "mother@example.com",
      "Aarav Rajesh Sharma",
      "2012-05-14",
      "Male",
      "B+",
      "Tree House High School",
      "Kothrud",
      "7th",
      "Griffin",
      "Rajesh Sharma",
      "Father",
      "9876543210",
      "9876543211",
      "father@example.com",
      "123 Green Valley, Pune 411038",
      "https://drive.google.com/open?id=sample_payment_screenshot",
      "No",
      "",
      "None",
      "Confirmed",
      "https://drive.google.com/open?id=sample_digital_signature"
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Form Responses 1")
    XLSX.writeFile(wb, "Life_Awakening_Student_Registration_Template.xlsx")
  }

  const handleDownloadLtcTemplate = () => {
    const headers = [
      "Full Name",
      "Email (Official)",
      "Contact Number",
      "Employee ID",
      "Email (Personal)",
      "Role"
    ]

    const sampleRow = [
      "Prof. Rajesh Kulkarni",
      "rajesh.kulkarni@ltc.edu",
      "9876543210",
      "LTC-FAC-101",
      "rajesh.personal@gmail.com",
      "ltc_member"
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "LTC Coordinators")
    XLSX.writeFile(wb, "LTC_Coordinators_Upload_Template.xlsx")
  }

  return (
    <div 
      style={{ 
        background: '#ffffff', 
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '20px 24px', 
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box',
        width: '100%',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }} 
      className="animate-fade-in bulk-upload-container"
    >
      <style>{`
        @media (max-width: 640px) {
          .bulk-upload-container {
            padding: 14px !important;
            border-radius: 10px !important;
          }
          .bulk-upload-submit-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .bulk-upload-drag-zone {
            padding: 24px 14px !important;
          }
          .bulk-upload-options-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* ── Mode Selection: Student Upload vs LTC Coordinators Upload ──────── */}
      {!lockedBatchId && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Choose Upload Option
          </div>
          <div 
            className="bulk-upload-options-grid"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px' 
            }}
          >
            {/* Option 1: Student Upload */}
            <div
              onClick={() => handleSelectMode(false)}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                border: !isLtcMode ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                background: !isLtcMode ? '#fffaf5' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                transition: 'all 0.15s ease',
                boxShadow: !isLtcMode ? '0 1px 3px rgba(0, 0, 0, 0.04)' : 'none'
              }}
            >
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: !isLtcMode ? '#ea580c' : '#f1f5f9',
                color: !isLtcMode ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <GraduationCap size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '750', color: !isLtcMode ? '#9a3412' : '#0f172a' }}>
                    Bulk Student Upload (Life Awakening)
                  </span>
                  {!isLtcMode && (
                    <span style={{ fontSize: '10px', background: '#ea580c', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                  Import student registrations with all 22 official columns and assign them directly into a target batch.
                </p>
              </div>
            </div>

            {/* Option 2: LTC Coordinators Upload */}
            <div
              onClick={() => handleSelectMode(true)}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                border: isLtcMode ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                background: isLtcMode ? '#f8fafc' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                transition: 'all 0.15s ease',
                boxShadow: isLtcMode ? '0 1px 3px rgba(0, 0, 0, 0.04)' : 'none'
              }}
            >
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: isLtcMode ? '#0f172a' : '#f1f5f9',
                color: isLtcMode ? '#ffffff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Users size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '750', color: isLtcMode ? '#0f172a' : '#0f172a' }}>
                    Bulk LTC Coordinators Upload
                  </span>
                  {isLtcMode && (
                    <span style={{ fontSize: '10px', background: '#0f172a', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                  Import LTC members and faculty coordinators into the master system with official email & credentials.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header bar with title & Download Template Button ──────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15.5px', fontWeight: '750', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={18} style={{ color: isLtcMode ? '#0f172a' : '#ea580c' }} />
          {isLtcMode 
            ? 'Bulk LTC Coordinators Upload' 
            : translate('Upload Student Registrations (Life Awakening 2026)')}
        </h3>
        
        {isLtcMode ? (
          <button
            type="button"
            onClick={handleDownloadLtcTemplate}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: 'none'
            }}
            title="Download the official Excel template for LTC Coordinators / Members"
          >
            <Download size={13} />
            Download LTC Coordinator Template (.xlsx)
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDownloadStudentTemplate}
            style={{
              background: '#ffffff',
              border: '1px solid #ea580c',
              color: '#ea580c',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: 'none'
            }}
            title="Download the official Excel template with the exact 22 registration columns"
          >
            <Download size={13} />
            {translate('Download Registration Template (.xlsx)')}
          </button>
        )}
      </div>

      {/* ── Mode 1: Target Batch Selection (Mandatory for School Students) ──── */}
      {!isLtcMode && (
        <div style={{
          background: '#fffaf5',
          border: '1px solid #fed7aa',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={17} style={{ color: '#ea580c' }} />
                Target Batch for Enrollment <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <span style={{ fontSize: '11px', background: '#ea580c', color: '#ffffff', borderRadius: '4px', padding: '1px 6px', fontWeight: '700' }}>
                Required
              </span>
            </div>
            {effectiveBatchName && (
              <span style={{ fontSize: '12px', background: '#ffffff', color: '#c2410c', border: '1.5px solid #fdba74', borderRadius: '6px', padding: '3px 10px', fontWeight: '800' }}>
                Selected: {effectiveBatchName}
              </span>
            )}
          </div>

          {lockedBatchId ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1.5px solid #fdba74'
            }}>
              <Lock size={15} style={{ color: '#ea580c', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#9a3412' }}>
                Locked Target Batch:
              </span>
              <span style={{
                fontSize: '13px',
                fontWeight: '800',
                color: '#c2410c',
                background: '#ffedd5',
                padding: '3px 10px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {lockedBatchName || `Batch #${lockedBatchId}`}
              </span>
              <span style={{ fontSize: '11.5px', color: '#78350f', marginLeft: 'auto' }}>
                (Uploading directly into this batch; students will be automatically enrolled)
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedBatchId || ''}
                  onChange={(e) => onSelectBatch && onSelectBatch(e.target.value)}
                  style={{
                    flex: '1',
                    minWidth: '240px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: !selectedBatchId ? '2px solid #ea580c' : '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: !selectedBatchId ? '0 0 0 3px rgba(234, 88, 12, 0.15)' : 'none'
                  }}
                >
                  <option value="">-- Select Target Batch (Required before upload) --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status ? b.status.toUpperCase() : 'ACTIVE'} • Capacity: {b.capacity || 350})
                    </option>
                  ))}
                </select>
              </div>
              {!selectedBatchId ? (
                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                  ⚠️ Please select a target batch before uploading school-student data.
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                  ✓ Every imported student will be automatically assigned to <strong>{effectiveBatchName}</strong>. Existing Student IDs and parent logins will be retained.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mode 2: LTC Coordinators Scope Info Card ──────────────────────── */}
      {isLtcMode && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Shield size={18} style={{ color: '#0f172a', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
            <strong>Master Ingestion Scope:</strong> LTC Coordinators & Members are added to the organization-wide master database with <code>ltc_member</code> roles. Batch assignment is not required.
          </div>
        </div>
      )}
      
      {/* ── File Format Requirements Card ─────────────────────────────────── */}
      {!isLtcMode ? (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '750', color: '#0f172a' }}>
              {translate('Life Awakening 2026 Registration Spreadsheet Instructions:')}
            </span>
            <span style={{ fontSize: '10.5px', background: '#fffaf5', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '4px', padding: '2px 7px', fontWeight: '700' }}>
              Supports Google Forms Export & Excel (.xlsx) Directly
            </span>
          </div>
          
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
            Upload the school registration spreadsheet directly. Parents log in using their registered email address with initial password <code>student123</code>. Both parent emails (<strong>Email Address1</strong> and <strong>Email Address 2</strong>) are mapped and linked to the child.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
            <div>
              <strong style={{ color: '#0f172a' }}>{translate('Registration Columns Supported:')}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {[
                  "Email Address1 (Parent 1)", "Email Address 2 (Parent 2)", "Student Full Name", "Date of Birth", "Gender", "Blood Group",
                  "Name of the School", "School Branch", "Class / Standard (6th–10th)", "Division",
                  "Parent/Guardian Name", "Relationship with Student", "Contact Number (WhatsApp)",
                  "Alternate Contact Number", "Residential Address",
                  "Upload Payment Screenshot", "Medical Condition?", "Medical Details", "Any Allergies",
                  "Parent/Guardian Consent Confirmation", "Upload Digital Signature"
                ].map(c => (
                  <code key={c} style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 600 }}>{c}</code>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '750', color: '#0f172a' }}>
              LTC Coordinators Spreadsheet Instructions:
            </span>
            <span style={{ fontSize: '10.5px', background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 7px', fontWeight: '700' }}>
              Excel (.xlsx, .xls) & CSV Supported
            </span>
          </div>
          
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
            Upload coordinator and faculty records. Official email will serve as the coordinator login credential with initial password <code>faculty123</code>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: '#475569' }}>
            <div>
              <strong style={{ color: '#0f172a' }}>Columns Supported:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {[
                  "Full Name (Required)", "Email (Official) (Required)", "Contact Number",
                  "Employee ID", "Email (Personal)", "Role (ltc_member)"
                ].map(c => (
                  <code key={c} style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 600 }}>{c}</code>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Styled Drag & Drop Zone ───────────────────────────────────────── */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleContainerClick}
        className="bulk-upload-drag-zone"
        style={{
          border: isDragging 
            ? '1.5px dashed #ea580c' 
            : (!isLtcMode && !effectiveBatchId ? '1.5px dashed #fed7aa' : '1.5px dashed #cbd5e1'),
          borderRadius: '12px',
          padding: '32px 20px',
          textAlign: 'center',
          background: isDragging 
            ? '#fff7ed' 
            : (!isLtcMode && !effectiveBatchId ? '#fffaf5' : '#f8fafc'),
          cursor: !isLtcMode && !effectiveBatchId ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative'
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".csv,.xlsx,.xls" 
          onChange={currentUploadHandler} 
          style={{ display: 'none' }} 
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: isLtcMode ? '#0f172a' : '#ea580c', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <span style={{ fontSize: '13.5px', fontWeight: '750', color: isLtcMode ? '#0f172a' : '#ea580c' }}>
              {uploadedFileName ? `Selected: ${uploadedFileName}` : translate('Click to choose file')}
            </span>
            {!uploadedFileName && (
              <span style={{ fontSize: '13px', color: '#64748b' }}> {translate('or drag & drop here')}</span>
            )}
          </div>
          <span style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
            {!isLtcMode && !effectiveBatchId 
              ? '⚠️ Select target batch above first' 
              : translate('Supports Excel (.xlsx, .xls) and CSV')}
          </span>
        </div>
      </div>

      {/* ── Preview Section ───────────────────────────────────────────────── */}
      {hasData && (
        <div style={{ marginTop: '24px', borderTop: '1.5px solid #f1f5f9', paddingTop: '20px' }}>
          {/* Summary Badges */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isLtcMode && bulkData.students && bulkData.students.length > 0 && (
              <span style={{ background: '#e6f4ea', color: '#137333', border: '1px solid #c2e7c9', fontSize: '12px', fontWeight: '800', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} />
                {bulkData.students.length} Students Ready to Import
              </span>
            )}

            {isLtcMode && bulkData.faculty && bulkData.faculty.length > 0 && (
              <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '12px', fontWeight: '800', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} />
                {bulkData.faculty.length} LTC Coordinators Ready to Import
              </span>
            )}

            {!isLtcMode && bulkData.faculty && bulkData.faculty.length > 0 && (
              <span style={{ background: '#e8f0fe', color: '#1a73e8', border: '1px solid #d2e3fc', fontSize: '12px', fontWeight: '800', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {bulkData.faculty.length} {translate('Other Roles')}
              </span>
            )}
            
            {bulkData.errors && bulkData.errors.length > 0 && (
              <span style={{ background: '#fce8e6', color: '#c5221f', border: '1px solid #fad2cf', fontSize: '12px', fontWeight: '800', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={14} />
                {bulkData.errors.length} {translate('Errors')}
              </span>
            )}

            {uploadedFileName && onClearFile && (
              <button
                type="button"
                onClick={onClearFile}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <X size={13} /> Clear File
              </button>
            )}
          </div>

          {/* Target Batch Confirmation Notice (Students only) */}
          {!isLtcMode && effectiveBatchName && (
            <div style={{
              background: '#fff7ed',
              border: '1.5px solid #fdba74',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: '#ea580c' }} />
                <span style={{ fontSize: '13px', color: '#9a3412', fontWeight: '600' }}>
                  Target batch for enrollment:
                  <strong style={{ color: '#c2410c', marginLeft: '6px', fontSize: '13.5px' }}>{effectiveBatchName}</strong>
                </span>
              </div>
              <span style={{ fontSize: '11px', background: '#ea580c', color: '#ffffff', padding: '3px 8px', borderRadius: '4px', fontWeight: '700' }}>
                Batch Enrolment Ready
              </span>
            </div>
          )}

          {/* Validation Errors Notice */}
          {bulkData.errors && bulkData.errors.length > 0 && (
            <div 
              style={{ 
                marginBottom: '20px', 
                background: '#fff5f5', 
                border: '1.5px solid #fee2e2', 
                borderRadius: '12px', 
                padding: '16px',
                color: '#c5221f'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '850', fontSize: '14px' }}>
                <AlertCircle size={16} />
                <span>{translate('Validation Issues Found:')}</span>
              </div>
              <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '12.5px', color: '#c5221f', lineHeight: 1.5, margin: 0 }}>
                {bulkData.errors.slice(0, 10).map((e, i) => <li key={i}>{typeof e === 'string' ? translate(e) : `${e.row}: ${e.error}`}</li>)}
                {bulkData.errors.length > 10 && <li>…and {bulkData.errors.length - 10} more</li>}
              </ul>
            </div>
          )}

          {/* ── Table Preview 1: Student Registrations ─────────────────────── */}
          {!isLtcMode && bulkData.students && bulkData.students.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  {translate('Preview Mapped Student Records (First 10 Rows):')}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Total {bulkData.students.length} students
                </span>
              </div>
              
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>#</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Student Name</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Parent 1 Email</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Parent 2 Email</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>School & Branch</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Class / Division</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>WhatsApp Contact</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.students.slice(0, 10).map((s, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0f172a' }}>{s.name || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#c2410c', fontFamily: 'monospace' }}>{s.parent_email_1 || s.email || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#c2410c', fontFamily: 'monospace' }}>{s.parent_email_2 || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {s.school || '—'}
                          {s.school_branch ? ` (${s.school_branch})` : ''}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>
                          {s.class_grade || '—'}
                          {s.division ? ` - ${s.division}` : ''}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{s.phone || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {s.payment_screenshot_url ? (
                            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              Submitted
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>
                              None
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Table Preview 2: LTC Coordinators ─────────────────────────── */}
          {isLtcMode && bulkData.faculty && bulkData.faculty.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                  Preview Mapped LTC Coordinator Records (First 10 Rows):
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Total {bulkData.faculty.length} coordinators
                </span>
              </div>
              
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>#</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Full Name</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Official Email</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Personal Email</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Contact Number</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Employee ID</th>
                      <th style={{ padding: '8px 12px', fontWeight: '750', color: '#475569' }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.faculty.slice(0, 10).map((f, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0f172a' }}>{f.name || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#154388', fontFamily: 'monospace', fontWeight: '600' }}>{f.email || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace' }}>{f['personal email'] || f.personal_email || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{f.phone || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#334155' }}>{f['employee id'] || f.faculty_id || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            {f.role || 'ltc_member'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Submission Button ─────────────────────────────────────────── */}
          <button 
            type="button"
            onClick={() => submitBulkUpload && submitBulkUpload(effectiveBatchId)} 
            disabled={
              isUploading || 
              (isLtcMode 
                ? (!bulkData.faculty || bulkData.faculty.length === 0) 
                : (!bulkData.students || bulkData.students.length === 0 || !effectiveBatchId))
            }
            className="bulk-upload-submit-btn"
            style={{ 
              background: isLtcMode ? '#0f172a' : '#ea580c', 
              color: '#ffffff', 
              borderRadius: '8px', 
              fontWeight: '650', 
              padding: '10px 22px', 
              border: 'none', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              fontSize: '13.5px',
              boxShadow: 'none',
              opacity: (isUploading || (isLtcMode ? (!bulkData.faculty || bulkData.faculty.length === 0) : (!bulkData.students || bulkData.students.length === 0 || !effectiveBatchId))) ? 0.6 : 1,
              cursor: (isUploading || (isLtcMode ? (!bulkData.faculty || bulkData.faculty.length === 0) : (!bulkData.students || bulkData.students.length === 0 || !effectiveBatchId))) ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {isUploading ? (
              <><RefreshCw size={15} className="animate-spin" /> {translate('Processing Import…')}</>
            ) : isLtcMode ? (
              `Import ${bulkData.faculty ? bulkData.faculty.length : 0} LTC Coordinators into Master System`
            ) : !effectiveBatchId ? (
              translate('Select a Target Batch Above to Import')
            ) : (
              `${translate('Import')} ${bulkData.students ? bulkData.students.length : 0} ${translate('Student Registrations into')} ${effectiveBatchName || 'Database'}`
            )}
          </button>
        </div>
      )}
    </div>
  )
}
