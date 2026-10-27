import React, { useState, useRef, useEffect } from 'react'
import { Activity, Download, Users, BookOpen, ClipboardList, BarChart2, FileText, Home, Layers, AlertOctagon, MessageSquare, Utensils, Sparkles, Lock, Unlock, FileCheck, ExternalLink, Image, FileSpreadsheet, Eye, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseFeedbackForDisplay } from '../utils/feedbackQuestions'

const cleanReportData = (rawData) => {
  if (!rawData || !rawData.columns || !rawData.data) return rawData;
  const columns = rawData.columns;
  const data = rawData.data;
  
  // Find indices of columns to keep
  const keepIndices = [];
  for (let i = 0; i < columns.length; i++) {
    const colName = columns[i];
    
    // 1. Remove unwanted columns
    const colUpper = String(colName).toUpperCase();
    if (colUpper === 'ID' || colUpper === 'USER ID' || colUpper === 'BATCH ID') {
      continue;
    }
    
    // 2. Remove empty columns (only if there are actually rows to evaluate)
    if (data.length > 0) {
      let hasValue = false;
      for (let r = 0; r < data.length; r++) {
        const val = data[r][i];
        if (typeof val === 'object' && val !== null) {
          hasValue = true;
          break;
        }
        if (val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== '—' && String(val).trim().toUpperCase() !== 'N/A') {
          hasValue = true;
          break;
        }
      }
      if (!hasValue) {
        continue;
      }
    }
    
    keepIndices.push(i);
  }
  
  const cleanedColumns = keepIndices.map(i => columns[i]);
  const cleanedData = data.map(row => keepIndices.map(i => row[i]));
  
  return {
    ...rawData,
    columns: cleanedColumns,
    data: cleanedData,
    count: cleanedData.length
  };
};

export default function BatchReportsTab({ token, apiBase, showToast, batches }) {
  const [reportType, setReportType] = useState('')
  const [reportBatchId, setReportBatchId] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [activeCardKey, setActiveCardKey] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [downloadingOfficialPdf, setDownloadingOfficialPdf] = useState(false)
  const [detailedStudentLink, setDetailedStudentLink] = useState('')
  const [savingDetailedLink, setSavingDetailedLink] = useState(false)

  useEffect(() => {
    if (!reportBatchId) {
      setDetailedStudentLink('')
      return
    }
    fetch(`${apiBase}/api/ltc-report/batch/${reportBatchId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.report) {
          const l = data.report.page2_data?.detailed_student_report_link || data.report.locked_data?.page2?.detailed_student_report_link || data.report.page1_data?.detailed_student_report_link || data.report.detailed_student_report_link || ''
          setDetailedStudentLink(l)
        }
      })
      .catch(() => {})
  }, [reportBatchId, apiBase, token])

  const handleSaveDetailedStudentLink = async () => {
    if (!reportBatchId) return
    setSavingDetailedLink(true)
    try {
      const getRes = await fetch(`${apiBase}/api/ltc-report/batch/${reportBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const curData = await getRes.json()
      const existingReport = curData.report || {}
      const updatedPage2 = {
        ...(existingReport.page2_data || {}),
        detailed_student_report_link: detailedStudentLink
      }
      const res = await fetch(`${apiBase}/api/ltc-report/batch/${reportBatchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...existingReport,
          page2_data: updatedPage2,
          page_key: 'page2',
          action: 'save'
        })
      })
      if (res.ok) {
        showToast('Detailed student report Google Drive link saved successfully!', 'success')
      } else {
        showToast('Failed to save Detailed student report link', 'error')
      }
    } catch (e) {
      showToast('Error saving Detailed student report link', 'error')
    } finally {
      setSavingDetailedLink(false)
    }
  }

  useEffect(() => {
    if (!reportBatchId && Array.isArray(batches) && batches.length > 0) {
      const activeBatch = batches.find(b => b.status === 'active') || batches[0]
      if (activeBatch) {
        setReportBatchId(String(activeBatch.id || activeBatch.batch_id || ''))
      }
    }
  }, [batches, reportBatchId])

  const [undertakingTarget, setUndertakingTarget] = useState('student')
  const [feedbackRole, setFeedbackRole] = useState('student')
  const [feedbackCategory, setFeedbackCategory] = useState('Pre-LTC')
  const [reportSquad, setReportSquad] = useState('')

  const reportResultsRef = useRef(null)

  const scrollToResults = () => {
    setTimeout(() => {
      if (reportResultsRef.current) {
        reportResultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleDownloadOfficialPdf = async (targetBatchId) => {
    const batchIdToUse = targetBatchId || reportBatchId
    if (!batchIdToUse) {
      showToast('Please select a batch first', 'warning')
      return
    }
    const targetBatch = (batches || []).find(b => String(b.id) === String(batchIdToUse))
    const rawBatchName = targetBatch ? (targetBatch.name || `Batch_${targetBatch.id}`) : `Batch_${batchIdToUse}`
    const cleanBatchName = rawBatchName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')

    setDownloadingOfficialPdf(true)
    console.log('%c[SUPERADMIN REPORT DEBUG] Downloading official master PDF for batchId:', 'color: #002B73; font-weight: bold;', batchIdToUse, {
      batchName: rawBatchName,
      url: `${apiBase}/api/superadmin/batch-summary-pdf/${batchIdToUse}`
    })
    try {
      showToast('Compiling official locked PDF report...', 'info')
      const res = await fetch(`${apiBase}/api/superadmin/batch-summary-pdf/${batchIdToUse}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      console.log('%c[SUPERADMIN REPORT DEBUG] Master PDF Response status:', 'color: #16a34a; font-weight: bold;', res.status)

      if (!res.ok) {
        let errMsg = 'Failed to generate report PDF'
        try {
          const errData = await res.json()
          if (errData && errData.message) errMsg = errData.message
        } catch (_) {}
        throw new Error(errMsg)
      }

      const blob = await res.blob()
      console.log('%c[SUPERADMIN REPORT DEBUG] Master PDF downloaded successfully, size in bytes:', 'color: #16a34a; font-weight: bold;', blob.size)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `LTC_Official_Report_${cleanBatchName}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast('Official locked report PDF downloaded successfully!', 'success')
    } catch (e) {
      console.error('%c[SUPERADMIN REPORT ERROR] Download PDF error:', 'color: #dc2626; font-weight: bold;', e)
      showToast(e.message || 'Error downloading PDF', 'error')
    } finally {
      setDownloadingOfficialPdf(false)
    }
  }

  const handleGenerateSpecificReport = async (key) => {
    setReportType(key)
    if (!reportBatchId) { showToast('Please select a batch first', 'error'); return }
    setActiveCardKey(key)
    try {
      setReportLoading(true)
      setReportData(null)
      scrollToResults()

      let actualType = key
      const params = new URLSearchParams()
      params.append('batchId', reportBatchId)

      if (key === 'undertakings') {
        actualType = undertakingTarget === 'faculty' ? 'undertakings-faculty' : 'undertakings-student'
      } else if (key === 'feedback') {
        params.append('role', feedbackRole)
        params.append('category', feedbackCategory)
      } else if (key === 'attendance-squad-wise') {
        if (!reportSquad) { showToast('Please select a squad first', 'error'); return }
        params.append('squad', reportSquad)
      }

      let url = `${apiBase}/api/superadmin/reports/${actualType}?${params.toString()}`
      console.log('%c[SUPERADMIN REPORT DEBUG] Generating specific report:', 'color: #2563eb; font-weight: bold;', actualType, 'URL:', url)
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      console.log('%c[SUPERADMIN REPORT DEBUG] Report API response:', 'color: #16a34a; font-weight: bold;', {
        status: res.status,
        type: actualType,
        batchId: reportBatchId,
        rowCount: data?.count || data?.data?.length || 0,
        columns: data?.columns,
        dataPreview: data?.data?.slice(0, 5)
      })
      if (res.ok) {
        const cleaned = cleanReportData(data)
        setReportData(cleaned)
        showToast(`Report generated: ${cleaned.count} records`, 'success')
        scrollToResults()
      } else {
        showToast(data.message || 'Failed to generate report', 'error')
      }
    } catch (err) {
      console.error('%c[SUPERADMIN REPORT ERROR] Generate report error:', 'color: #dc2626; font-weight: bold;', err)
      showToast('Server error generating report', 'error')
    } finally {
      setReportLoading(false)
      setActiveCardKey(null)
    }
  }

  const formatCellForExport = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      if (v.type === 'file') return `${v.fileName || 'File'} (${v.fileUrl || ''})`;
      if (v.type === 'photos') return `${(v.photos || []).length} Photos (${v.driveLink || ''})`;
      if (v.type === 'link') return v.url || v.label || '';
      return JSON.stringify(v);
    }
    return String(v);
  };

  const handleExportReportCSV = () => {
    if (!reportData) return
    let csv = '\ufeff' + reportData.columns.join(',') + '\n'
    reportData.data.forEach(row => {
      csv += row.map(v => `"${formatCellForExport(v).replace(/"/g, '""')}"`).join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    showToast('CSV exported', 'success')
  }

  const handleExportReportExcel = () => {
    if (!reportData) return
    let wsData = []

    if (reportType === 'food_preferences' || reportType === 'food-preferences') {
      let totalJainCount = 0
      let totalMondayFastCount = 0
      const jainIdx = reportData.columns.indexOf('Jain Food Required') !== -1 ? reportData.columns.indexOf('Jain Food Required') : 4
      const fastIdx = reportData.columns.indexOf('Monday Fast') !== -1 ? reportData.columns.indexOf('Monday Fast') : 5

      reportData.data.forEach(row => {
        const jVal = String(row[jainIdx] || '').trim().toLowerCase()
        const fVal = String(row[fastIdx] || '').trim().toLowerCase()
        if (jVal === 'yes' || jVal === 'true') totalJainCount++
        if (fVal === 'yes' || fVal === 'true') totalMondayFastCount++
      })

      wsData.push(['FOOD PREFERENCES REPORT'])
      wsData.push([`• Total Jain Food Students: ${totalJainCount}`])
      wsData.push([`• Total Monday Fast Students: ${totalMondayFastCount}`])
      wsData.push([])
      wsData.push(reportData.columns)
      reportData.data.forEach(row => {
        wsData.push(row.map(v => formatCellForExport(v)))
      })
    } else {
      wsData = [
        reportData.columns,
        ...reportData.data.map(row => row.map(v => formatCellForExport(v)))
      ]
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, reportType)
    XLSX.writeFile(wb, `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast('Excel exported', 'success')
  }

  const handleExportReportPDF = () => {
    if (!reportData) return
    const cols = reportData.columns
    const rows = reportData.data.slice(0, 500)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${reportType} Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;color:#1e293b;padding:24px}
        h1{font-size:16px;margin-bottom:4px}p{color:#64748b;margin:0 0 16px}
        table{width:100%;border-collapse:collapse}
        th{background:#0f172a;color:#fff;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase}
        td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:9px}
        tr:nth-child(even) td{background:#f8fafc}
        @media print{body{padding:8px}}
      </style></head><body>
      <h1>${reportType.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())} Report</h1>
      <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total Records: ${reportData.count}</p>
      <table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${formatCellForExport(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>${reportData.count>500?`<p style="color:red;margin-top:8px">Note: PDF preview limited to 500 rows. Use CSV/Excel for full data.</p>`:''}
      </body></html>`
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.print()
  }

  const REPORT_TYPES = [
    { 
      key: 'official-ltc-report', 
      label: 'Official LTC Batch Report', 
      tag: 'SUPPORT & LOCKS',
      desc: 'Master 6-page institutional report edited by Support panel. Displays locked status and live published records.', 
      icon: <FileCheck size={18} color="#059669" />,
      accentGradient: 'linear-gradient(90deg, #059669, #10b981)',
      iconBg: '#ecfdf5', iconBorder: '#a7f3d0', tagBg: '#ecfdf5', tagColor: '#047857'
    },
    { 
      key: 'students', 
      label: 'Students Roster', 
      tag: 'ROSTER',
      desc: 'Full student roster with PRN, cohort batch, and squad allocations.', 
      icon: <Users size={18} color="#2563eb" />,
      accentGradient: 'linear-gradient(90deg, #2563eb, #3b82f6)',
      iconBg: '#eff6ff', iconBorder: '#bfdbfe', tagBg: '#eff6ff', tagColor: '#1d4ed8'
    },
    { 
      key: 'faculty', 
      label: 'Faculty & Members', 
      tag: 'ROSTER',
      desc: 'Faculty advisors and LTC member assignments with squad responsibilities.', 
      icon: <BookOpen size={18} color="#4f46e5" />,
      accentGradient: 'linear-gradient(90deg, #4f46e5, #6366f1)',
      iconBg: '#eef2ff', iconBorder: '#c7d2fe', tagBg: '#eef2ff', tagColor: '#4338ca'
    },
    { 
      key: 'attendance', 
      label: 'Attendance Compliance', 
      tag: 'COMPLIANCE',
      desc: 'Session-level attendance compliance tracking and historical logs.', 
      icon: <ClipboardList size={18} color="#059669" />,
      accentGradient: 'linear-gradient(90deg, #059669, #10b981)',
      iconBg: '#ecfdf5', iconBorder: '#a7f3d0', tagBg: '#ecfdf5', tagColor: '#047857'
    },
    { 
      key: 'attendance-squad-wise', 
      label: 'Squad Attendance Pivot', 
      tag: 'PIVOT',
      desc: 'Pivot matrix of attendance across 5 pillars + bag checks, filtered by squad.', 
      icon: <BarChart2 size={18} color="#0891b2" />,
      accentGradient: 'linear-gradient(90deg, #0891b2, #06b6d4)',
      iconBg: '#ecfeff', iconBorder: '#a5f3fc', tagBg: '#ecfeff', tagColor: '#0e7490'
    },
    { 
      key: 'undertakings', 
      label: 'Undertakings Log', 
      tag: 'COMPLIANCE',
      desc: 'Undertaking submission status, digital signatures, and compliance audit.', 
      icon: <FileText size={18} color="#d97706" />,
      accentGradient: 'linear-gradient(90deg, #d97706, #f59e0b)',
      iconBg: '#fffbeb', iconBorder: '#fde68a', tagBg: '#fffbeb', tagColor: '#b45309'
    },
    { 
      key: 'food_preferences', 
      label: 'Food Preferences', 
      tag: 'CATERING',
      desc: 'Student Jain food and Monday fast dietary requirements grouped by squad.', 
      icon: <Utensils size={18} color="#16a34a" />,
      accentGradient: 'linear-gradient(90deg, #16a34a, #22c55e)',
      iconBg: '#f0fdf4', iconBorder: '#bbf7d0', tagBg: '#f0fdf4', tagColor: '#15803d'
    },
    { 
      key: 'service-feedback', 
      label: 'Service & Trainers Feedback', 
      tag: 'EVALUATION',
      desc: 'Complete Services & Trainers feedback with pillar ratings, activity evaluations & suggestions.', 
      icon: <Sparkles size={18} color="#7c3aed" />,
      accentGradient: 'linear-gradient(90deg, #7c3aed, #a855f7)',
      iconBg: '#f5f3ff', iconBorder: '#ddd6fe', tagBg: '#f5f3ff', tagColor: '#6d28d9'
    },
    { 
      key: 'rooms', 
      label: 'Room Allocations', 
      tag: 'FACILITIES',
      desc: 'Student hostel room assignments, occupancy metrics, and batch distribution.', 
      icon: <Home size={18} color="#6366f1" />,
      accentGradient: 'linear-gradient(90deg, #6366f1, #818cf8)',
      iconBg: '#f5f3ff', iconBorder: '#ddd6fe', tagBg: '#f5f3ff', tagColor: '#4c1d95'
    },
    { 
      key: 'squads', 
      label: 'Squad Distribution', 
      tag: 'ORGANIZATION',
      desc: 'Squad roster composition, leader roles, and member balances.', 
      icon: <Layers size={18} color="#2563eb" />,
      accentGradient: 'linear-gradient(90deg, #2563eb, #60a5fa)',
      iconBg: '#eff6ff', iconBorder: '#bfdbfe', tagBg: '#eff6ff', tagColor: '#1d4ed8'
    },
    { 
      key: 'red-flags', 
      label: 'Red Flags & Incidents', 
      tag: 'SAFETY',
      desc: 'Behavioural incident log, safety flags, and disciplinary tracking.', 
      icon: <AlertOctagon size={18} color="#dc2626" />,
      accentGradient: 'linear-gradient(90deg, #dc2626, #ef4444)',
      iconBg: '#fef2f2', iconBorder: '#fecaca', tagBg: '#fef2f2', tagColor: '#b91c1c'
    },
    { 
      key: 'feedback', 
      label: 'Feedback Responses', 
      tag: 'SURVEYS',
      desc: 'Categorized Pre-LTC and Post-LTC survey responses and user evaluations.', 
      icon: <MessageSquare size={18} color="#7c3aed" />,
      accentGradient: 'linear-gradient(90deg, #7c3aed, #a855f7)',
      iconBg: '#faf5ff', iconBorder: '#e9d5ff', tagBg: '#faf5ff', tagColor: '#6d28d9'
    },
    { 
      key: 'program-summary', 
      label: 'Program Summary', 
      tag: 'ANALYTICS',
      desc: 'Batch-level aggregate statistical overview and executive performance metrics.', 
      icon: <Activity size={18} color="#0284c7" />,
      accentGradient: 'linear-gradient(90deg, #0284c7, #38bdf8)',
      iconBg: '#f0f9ff', iconBorder: '#bae6fd', tagBg: '#f0f9ff', tagColor: '#0369a1'
    },
  ]

  const renderFeedback = (val) => {
    if (!val || val === '—' || String(val).trim() === '') {
      return <span style={{ color: 'var(--text-3)' }}>—</span>
    }
    const pairs = parseFeedbackForDisplay(val)
    if (pairs && pairs.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', whiteSpace: 'normal', padding: '4px 0' }}>
          {pairs.map((pair, pIdx) => (
            <div key={pIdx} style={{ fontSize: '11.5px', borderBottom: pIdx < pairs.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: pIdx < pairs.length - 1 ? '6px' : '0' }}>
              <span style={{ fontWeight: '750', color: 'var(--text)', display: 'block', marginBottom: '2px' }}>Q: {pair.question}</span>
              <span style={{ color: 'var(--text-2)', display: 'block', paddingLeft: '8px', borderLeft: '2.5px solid #2563eb' }}>{pair.answer || '—'}</span>
            </div>
          ))}
        </div>
      )
    }
    const parts = String(val).split(' | ')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', whiteSpace: 'normal', padding: '4px 0' }}>
        {parts.map((part, pIdx) => {
          const splitIndex = part.indexOf(': ')
          if (splitIndex !== -1) {
            const q = part.substring(0, splitIndex)
            const a = part.substring(splitIndex + 2)
            return (
              <div key={pIdx} style={{ fontSize: '11.5px', borderBottom: pIdx < parts.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: pIdx < parts.length - 1 ? '6px' : '0' }}>
                <span style={{ fontWeight: '750', color: 'var(--text)', display: 'block', marginBottom: '2px' }}>Q: {q}</span>
                <span style={{ color: 'var(--text-2)', display: 'block', paddingLeft: '8px', borderLeft: '2.5px solid #2563eb' }}>{a}</span>
              </div>
            )
          }
          return (
            <div key={pIdx} style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
              {part}
            </div>
          )
        })}
      </div>
    )
  }

  const PREVIEW_ROWS = 100

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'22px'}}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '850', color: '#0f172a', letterSpacing: '-0.3px' }}>Choose Report</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Select a report card, configure batch cohort options, and generate instant analytics.</p>
        </div>
      </div>

      {/* Global Batch Selection Bar */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justify: 'space-between', 
          flexWrap: 'wrap', 
          gap: '16px', 
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0', 
          padding: '16px 22px', 
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.03)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '850', color: '#0f172a', letterSpacing: '-0.2px' }}>Global Target Cohort</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Select an active batch cohort to auto-populate all report parameters</div>
          </div>
        </div>
        <div style={{ width: '280px' }}>
          <select 
            value={reportBatchId} 
            onChange={e => setReportBatchId(e.target.value)}
            style={{ 
              width: '100%', 
              height: '38px', 
              padding: '0 14px', 
              border: '1.5px solid #2563eb', 
              borderRadius: '10px', 
              fontSize: '13px', 
              background: '#ffffff', 
              outline: 'none', 
              fontWeight: '700', 
              color: '#0f172a',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
            }}
          >
            <option value="">-- Choose Target Batch --</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
          </select>
        </div>
      </div>

      <style>{`
        .report-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
          gap: 18px;
        }
        .report-card-item {
          position: relative;
          overflow: hidden;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          padding: 20px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.025);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .report-card-item:hover {
          transform: translateY(-3px);
          border-color: #cbd5e1;
          box-shadow: 0 12px 24px -4px rgba(37, 99, 235, 0.12);
        }
      `}</style>

      {/* Report Cards Responsive Grid */}
      <div className="report-card-grid">
        {REPORT_TYPES.map((rt) => (
          <div key={rt.key} className="report-card-item">
            <div>
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: rt.iconBg, border: `1px solid ${rt.iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {rt.icon}
                </div>
                <span style={{ fontSize: '10px', fontWeight: '850', background: rt.tagBg, color: rt.tagColor, padding: '3px 9px', borderRadius: '50px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  {rt.tag}
                </span>
              </div>

              <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.2px' }}>
                {rt.label}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                {rt.desc}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
              <div>
                <label style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.4px' }}>
                  Target Batch Cohort
                </label>
                <select 
                  value={reportBatchId} 
                  onChange={e => setReportBatchId(e.target.value)}
                  style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', background: '#f8fafc', outline: 'none', fontWeight: '600', color: '#0f172a' }}
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
                </select>
              </div>

              {rt.key === 'undertakings' && (
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.4px' }}>Target Role</label>
                  <select 
                    value={undertakingTarget} 
                    onChange={e => setUndertakingTarget(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', background: '#f8fafc', outline: 'none', fontWeight: '600', color: '#0f172a' }}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>
              )}

              {rt.key === 'feedback' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.4px' }}>Role</label>
                    <select 
                      value={feedbackRole} 
                      onChange={e => setFeedbackRole(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', background: '#f8fafc', outline: 'none', fontWeight: '600', color: '#0f172a' }}
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.4px' }}>Category</label>
                    <select 
                      value={feedbackCategory} 
                      onChange={e => setFeedbackCategory(e.target.value)}
                      style={{ width: '100%', height: '36px', padding: '0 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', background: '#f8fafc', outline: 'none', fontWeight: '600', color: '#0f172a' }}
                    >
                      <option value="Pre-LTC">Pre-LTC</option>
                      <option value="Post-LTC">Post-LTC</option>
                    </select>
                  </div>
                </div>
              )}

              {rt.key === 'attendance-squad-wise' && (
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '5px', letterSpacing: '0.4px' }}>Squad Filter *</label>
                  <select 
                    value={reportSquad} 
                    onChange={e => setReportSquad(e.target.value)}
                    style={{ width: '100%', height: '36px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', background: '#f8fafc', outline: 'none', fontWeight: '600', color: '#0f172a' }}
                  >
                    <option value="">-- Choose Squad --</option>
                    {['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {rt.key === 'official-ltc-report' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <button 
                    onClick={() => handleDownloadOfficialPdf(reportBatchId)} 
                    disabled={!reportBatchId || downloadingOfficialPdf}
                    style={{
                      height: '40px',
                      width: '100%',
                      borderRadius: '10px',
                      fontSize: '12.5px',
                      fontWeight: '750',
                      background: !reportBatchId 
                        ? '#cbd5e1' 
                        : 'linear-gradient(135deg, #002B73 0%, #1e40af 100%)',
                      color: !reportBatchId ? '#64748b' : '#ffffff',
                      border: 'none',
                      boxShadow: !reportBatchId ? 'none' : '0 4px 14px rgba(0, 43, 115, 0.3)',
                      cursor: !reportBatchId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {downloadingOfficialPdf ? (
                      <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} /> Compiling PDF...</>
                    ) : (
                      <><Download size={14} color="#ffffff" strokeWidth={2.5} /> Download Master PDF Report</>
                    )}
                  </button>

                  <button 
                    onClick={() => handleGenerateSpecificReport(rt.key)} 
                    disabled={!reportBatchId || (reportLoading && activeCardKey === rt.key)}
                    style={{
                      height: '34px',
                      width: '100%',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      cursor: !reportBatchId ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    {reportLoading && activeCardKey === rt.key ? (
                      <><div className="spinner" style={{ width: '11px', height: '11px', borderWidth: '2px' }} /> Loading Data...</>
                    ) : (
                      <><Activity size={13} /> View Report Breakdown</>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleGenerateSpecificReport(rt.key)} 
                  disabled={!reportBatchId || (rt.key === 'attendance-squad-wise' && !reportSquad) || (reportLoading && activeCardKey === rt.key)}
                  style={{
                    height: '38px',
                    width: '100%',
                    marginTop: '4px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    background: (!reportBatchId || (rt.key === 'attendance-squad-wise' && !reportSquad)) 
                      ? '#cbd5e1' 
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: (!reportBatchId || (rt.key === 'attendance-squad-wise' && !reportSquad)) ? '#64748b' : '#ffffff',
                    border: 'none',
                    boxShadow: (!reportBatchId || (rt.key === 'attendance-squad-wise' && !reportSquad)) ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.25)',
                    cursor: (!reportBatchId || (rt.key === 'attendance-squad-wise' && !reportSquad)) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {reportLoading && activeCardKey === rt.key ? (
                    <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} /> Generating...</>
                  ) : (
                    <><Activity size={14} /> Generate Report</>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Loading State Banner */}
      {reportLoading && (
        <div 
          ref={reportResultsRef}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #dbeafe',
            padding: '36px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 20px -4px rgba(37, 99, 235, 0.08)'
          }}
        >
          <div className="spinner" style={{ width: '28px', height: '28px', borderWidth: '3px', color: '#2563eb' }} />
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e40af' }}>
            Generating Report Data...
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Please wait while records are fetched and compiled for your batch selection.
          </div>
        </div>
      )}

      {/* Results */}
      {reportData && !reportLoading && (
        <div ref={reportResultsRef} className="glass-card" style={{background:'#fff',borderRadius:'16px',border:'1.5px solid var(--border)',overflow:'hidden'}}>
          {/* Export bar */}
          <div style={{padding:'16px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px',background:'#f8fafc'}}>
            <div>
              <span style={{fontSize:'14px',fontWeight:'800',color:'var(--text)'}}>
                {reportData.type === 'undertakings-student' ? 'Student Undertakings'
                 : reportData.type === 'undertakings-faculty' ? 'Faculty Undertakings'
                 : reportData.type === 'attendance-squad-wise' ? 'Attendance (Squad Wise)'
                 : REPORT_TYPES.find(r=>r.key===reportData.type)?.label || reportData.type} Report
              </span>
              <span style={{marginLeft:'12px',background:'#eff6ff',color:'#2563eb',border:'1.5px solid #bfdbfe',padding:'3.5px 12px',borderRadius:'50px',fontSize:'11.5px',fontWeight:'850'}}>{reportData.count} records</span>
              {reportData.count > PREVIEW_ROWS && (
                <span style={{marginLeft:'8px',background:'#fef3c7',color:'#92400e',padding:'2.5px 10px',borderRadius:'50px',fontSize:'11px',fontWeight:'700'}}>Preview: first {PREVIEW_ROWS} rows</span>
              )}
            </div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
              {reportData.type === 'official-ltc-report' && (
                <button
                  onClick={() => handleDownloadOfficialPdf(reportBatchId)}
                  disabled={downloadingOfficialPdf}
                  className="btn btn-primary btn-sm"
                  style={{
                    backgroundColor: '#002B73',
                    borderColor: '#002B73',
                    color: '#ffffff',
                    borderRadius: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '700',
                    padding: '6px 14px'
                  }}
                >
                  {downloadingOfficialPdf ? (
                    <><div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> Downloading...</>
                  ) : (
                    <><Download size={13} /> Download Official Locked PDF</>
                  )}
                </button>
              )}
              <button onClick={handleExportReportCSV} className="btn btn-outline btn-sm"
                style={{borderRadius:'50px',display:'flex',alignItems:'center',gap:'6px',color:'#16a34a',borderColor:'#16a34a'}}>
                <Download size={13}/> CSV
              </button>
              <button onClick={handleExportReportExcel} className="btn btn-outline btn-sm"
                style={{borderRadius:'50px',display:'flex',alignItems:'center',gap:'6px',color:'#0284c7',borderColor:'#0284c7'}}>
                <Download size={13}/> Excel
              </button>
              <button onClick={handleExportReportPDF} className="btn btn-outline btn-sm"
                style={{borderRadius:'50px',display:'flex',alignItems:'center',gap:'6px',color:'#dc2626',borderColor:'#dc2626'}}>
                <Download size={13}/> Print View
              </button>
            </div>
          </div>
          {/* Table */}
          <div style={{overflowX:'auto',maxHeight:'520px',overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12.5px'}}>
              <thead style={{position:'sticky',top:0,zIndex:1}}>
                <tr style={{background:'#0f172a'}}>
                  {reportData.columns.map((col,i)=>(
                    <th key={i} style={{padding:'10px 14px',textAlign:'left',color:'#fff',fontWeight:'800',fontSize:'10.5px',textTransform:'uppercase',letterSpacing:'0.4px',whiteSpace:'nowrap'}}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.data.slice(0,PREVIEW_ROWS).map((row,ri)=>(
                  <tr key={ri} style={{borderBottom:'1px solid #f1f5f9',background:ri%2===0?'#fff':'#f8fafc'}}>
                    {row.map((cell,ci)=>{
                      const colName = reportData.columns[ci];
                      const isFeedbackCol = colName === 'Feedback' || colName === 'Pre-LTC Feedback' || colName === 'Post-LTC Feedback';
                      
                      const formatBytes = (bytes) => {
                        if (!bytes || isNaN(bytes)) return '';
                        if (bytes < 1024) return bytes + ' B';
                        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                      };

                      let cellContent = null;
                      if (cell === 'LOCKED') {
                        cellContent = <span style={{color:'#16a34a',fontWeight:'800',background:'#dcfce7',border:'1px solid #86efac',padding:'3px 10px',borderRadius:'12px',fontSize:'11px',display:'inline-flex',alignItems:'center',gap:'4px'}}><Lock size={11} /> LOCKED</span>;
                      } else if (cell === 'DRAFT / LIVE (SUPPORT)' || cell === 'DRAFT (PENDING LOCK)') {
                        cellContent = <span style={{color:'#b45309',fontWeight:'800',background:'#fef3c7',border:'1px solid #fde68a',padding:'3px 10px',borderRadius:'12px',fontSize:'11px',display:'inline-flex',alignItems:'center',gap:'4px'}}><Unlock size={11} /> {cell}</span>;
                      } else if (cell === 'ACTIVE') {
                        cellContent = <span style={{color:'#1d4ed8',fontWeight:'800',background:'#eff6ff',border:'1px solid #bfdbfe',padding:'3px 10px',borderRadius:'12px',fontSize:'11px'}}>ACTIVE</span>;
                      } else if (cell === 'YES (Published)' || cell === 'Yes') {
                        cellContent = <span style={{color:'#16a34a',fontWeight:'750',background:'#f0fdf4',border:'1px solid #bbf7d0',padding:'3px 8px',borderRadius:'8px',fontSize:'11px'}}>✅ Published</span>;
                      } else if (cell === 'NO (Awaiting Lock)' || cell === 'No') {
                        cellContent = <span style={{color:'#d97706',fontWeight:'700',background:'#fffbeb',border:'1px solid #fde68a',padding:'3px 8px',borderRadius:'8px',fontSize:'11px'}}>⏳ Pending</span>;
                      } else if (typeof cell === 'object' && cell !== null) {
                        if (cell.type === 'photos' || Array.isArray(cell.photos)) {
                          const photos = cell.photos || [];
                          cellContent = (
                            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                                <span style={{background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',padding:'2px 8px',borderRadius:'12px',fontSize:'11px',fontWeight:'700',display:'inline-flex',alignItems:'center',gap:'4px'}}>
                                  <Image size={12} /> {photos.length} Photos Uploaded
                                </span>
                                {cell.driveLink && (
                                  <a href={cell.driveLink} target="_blank" rel="noreferrer" style={{fontSize:'11px',color:'#2563eb',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'3px',fontWeight:'600'}}>
                                    Drive Link <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                              <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'4px'}}>
                                {photos.map((p, pIdx) => {
                                  const rawUrl = typeof p === 'object' ? (p.fileUrl || (p.storageKey ? `/uploads/journey/${p.storageKey}` : '')) : p;
                                  const imgUrl = rawUrl.startsWith('http') ? rawUrl : `${apiBase}${rawUrl}`;
                                  const pName = typeof p === 'object' ? (p.fileName || `Photo ${pIdx+1}`) : `Photo ${pIdx+1}`;
                                  return (
                                    <div
                                      key={pIdx}
                                      onClick={() => setLightboxImg({ url: imgUrl, title: pName })}
                                      title={`Click to preview: ${pName}`}
                                      style={{
                                        width:'44px',
                                        height:'44px',
                                        borderRadius:'6px',
                                        overflow:'hidden',
                                        border:'1.5px solid #cbd5e1',
                                        cursor:'pointer',
                                        flexShrink:0,
                                        boxShadow:'0 1px 3px rgba(0,0,0,0.1)',
                                        background:'#f8fafc'
                                      }}
                                    >
                                      <img src={imgUrl} alt={pName} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else if (cell.type === 'file' || cell.fileUrl) {
                          const rawUrl = cell.fileUrl || (cell.storageKey ? `/uploads/journey/${cell.storageKey}` : '');
                          const fileUrl = rawUrl.startsWith('http') ? rawUrl : `${apiBase}${rawUrl}`;
                          const fileName = cell.fileName || cell.label || 'Document';
                          const isPdf = (cell.mimeType && cell.mimeType.includes('pdf')) || fileName.toLowerCase().endsWith('.pdf');
                          const isExcel = (cell.mimeType && (cell.mimeType.includes('spreadsheet') || cell.mimeType.includes('excel') || cell.mimeType.includes('csv'))) || fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

                          cellContent = (
                            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'6px 10px',maxWidth:'340px'}}>
                              <div style={{
                                width:'30px',
                                height:'30px',
                                borderRadius:'6px',
                                background: isPdf ? '#fee2e2' : isExcel ? '#dcfce7' : '#eff6ff',
                                color: isPdf ? '#dc2626' : isExcel ? '#16a34a' : '#2563eb',
                                display:'flex',
                                alignItems:'center',
                                justifyContent:'center',
                                flexShrink:0
                              }}>
                                {isPdf ? <FileText size={16} /> : isExcel ? <FileSpreadsheet size={16} /> : <FileCheck size={16} />}
                              </div>
                              <div style={{overflow:'hidden',display:'flex',flexDirection:'column',gap:'1px',minWidth:0}}>
                                <span style={{fontSize:'12px',fontWeight:'700',color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={fileName}>
                                  {fileName}
                                </span>
                                <span style={{fontSize:'10px',color:'#64748b'}}>
                                  {isPdf ? 'PDF Document' : isExcel ? 'Excel Spreadsheet' : 'Attachment'} {cell.fileSize ? `• ${formatBytes(cell.fileSize)}` : ''}
                                </span>
                              </div>
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                download={fileName}
                                style={{
                                  marginLeft:'auto',
                                  padding:'4px 8px',
                                  borderRadius:'6px',
                                  background:'#002B73',
                                  color:'#fff',
                                  fontSize:'11px',
                                  fontWeight:'600',
                                  textDecoration:'none',
                                  display:'inline-flex',
                                  alignItems:'center',
                                  gap:'4px',
                                  flexShrink:0
                                }}
                              >
                                <Download size={11} /> View
                              </a>
                            </div>
                          );
                        } else if (cell.type === 'link' || cell.url) {
                          cellContent = (
                            <a
                              href={cell.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display:'inline-flex',
                                alignItems:'center',
                                gap:'5px',
                                color:'#2563eb',
                                fontWeight:'600',
                                textDecoration:'none',
                                background:'#eff6ff',
                                border:'1px solid #bfdbfe',
                                padding:'4px 10px',
                                borderRadius:'6px',
                                fontSize:'11.5px'
                              }}
                            >
                              <ExternalLink size={12} /> {cell.label || 'Open Link'}
                            </a>
                          );
                        } else {
                          cellContent = JSON.stringify(cell);
                        }
                      } else {
                        const cellStr = String(cell ?? '');
                        if (cellStr.startsWith('http://') || cellStr.startsWith('https://')) {
                          cellContent = (
                            <a
                              href={cellStr}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display:'inline-flex',
                                alignItems:'center',
                                gap:'4px',
                                color:'#2563eb',
                                fontWeight:'600',
                                textDecoration:'none',
                                fontSize:'11.5px'
                              }}
                            >
                              <ExternalLink size={12} /> {cellStr.length > 40 ? cellStr.substring(0, 37) + '...' : cellStr}
                            </a>
                          );
                        } else if (isFeedbackCol) {
                          cellContent = renderFeedback(cell);
                        } else {
                          cellContent = cellStr;
                        }
                      }

                      return (
                        <td key={ci} style={{
                          padding:'9px 14px',
                          color:'var(--text)',
                          verticalAlign: 'top',
                          whiteSpace: isFeedbackCol || (typeof cell === 'object' && cell !== null) ? 'normal' : 'nowrap',
                          maxWidth: isFeedbackCol ? '450px' : (typeof cell === 'object' ? '360px' : '280px'),
                          overflow: isFeedbackCol ? 'visible' : 'hidden',
                          textOverflow: isFeedbackCol ? 'clip' : 'ellipsis'
                        }}>
                          {cellContent}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo Preview */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position:'fixed',
            inset:0,
            background:'rgba(15, 23, 42, 0.85)',
            zIndex:9999,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding:'20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background:'#fff',
              borderRadius:'12px',
              overflow:'hidden',
              maxWidth:'90vw',
              maxHeight:'90vh',
              display:'flex',
              flexDirection:'column',
              boxShadow:'0 20px 25px -5px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{padding:'10px 16px',background:'#0f172a',color:'#fff',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'13px',fontWeight:'700'}}>{lightboxImg.title}</span>
              <button
                onClick={() => setLightboxImg(null)}
                style={{background:'none',border:'none',color:'#fff',cursor:'pointer',padding:'4px'}}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{padding:'12px',display:'flex',alignItems:'center',justifyContent:'center',overflow:'auto'}}>
              <img src={lightboxImg.url} alt={lightboxImg.title} style={{maxWidth:'100%',maxHeight:'75vh',objectFit:'contain',borderRadius:'6px'}} />
            </div>
          </div>
        </div>
      )}

      {!reportData && !reportLoading && reportType && (
        <div style={{textAlign:'center',padding:'48px',color:'var(--text-3)',fontSize:'13.5px'}}>
          Click <strong>Generate Report</strong> to load the {REPORT_TYPES.find(r=>r.key===reportType)?.label} data.
        </div>
      )}
    </div>
  )
}
