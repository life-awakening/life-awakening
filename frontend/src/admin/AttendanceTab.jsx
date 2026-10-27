import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardList, Search, Activity, User, Users, Award, RefreshCw, CheckCircle, XCircle, Download, FileSpreadsheet, X, Shield, Phone, Mail, Table } from 'lucide-react'
import * as XLSX from 'xlsx'

const SQUAD_COLORS = {
  Surya: '#f59e0b',
  Aditya: '#e11d48',
  Ravi: '#2563eb',
  Divakar: '#7c3aed',
  Mitra: '#059669',
  Martand: '#ea580c',
  Dinkar: '#0284c7',
  Prabhakar: '#4f46e5',
  Bhaskar: '#d97706',
  Tejonidhi: '#16a34a'
}

export default function AttendanceTab({ token, apiBase, showToast, batches, selectedBatchId: propBatchId, setSelectedBatchId: setPropBatchId }) {
  const [internalBatchId, setInternalBatchId] = useState('')
  const selectedBatchId = propBatchId || internalBatchId
  const setSelectedBatchId = setPropBatchId || setInternalBatchId
  const [selectedSquad, setSelectedSquad] = useState('Aditya')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDayFilter, setSelectedDayFilter] = useState('all') // 'all', '1', '2', '3', '4', '5'
  const [attendanceData, setAttendanceData] = useState([])
  const [squadLeaders, setSquadLeaders] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedLeaderDetails, setSelectedLeaderDetails] = useState(null)
  const [showActivitySummaryModal, setShowActivitySummaryModal] = useState(false)
  const [activitySummaryData, setActivitySummaryData] = useState(null)
  const [loadingActivitySummary, setLoadingActivitySummary] = useState(false)


  const fetchActivitySummary = async (bId) => {
    const targetBatchId = bId || selectedBatchId
    if (!targetBatchId) return
    try {
      setLoadingActivitySummary(true)
      const res = await fetch(`${apiBase}/api/superadmin/analytics/squad-attendance-summary?batchId=${targetBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setActivitySummaryData(data)
      } else {
        if (showToast) showToast(data.message || 'Failed to load attendance summary', 'error')
      }
    } catch (err) {
      if (showToast) showToast('Error fetching attendance summary', 'error')
    } finally {
      setLoadingActivitySummary(false)
    }
  }

  const handleDownloadActivitySummaryExcel = () => {
    if (!activitySummaryData || !activitySummaryData.activities || activitySummaryData.activities.length === 0) {
      if (showToast) showToast('No summary data available to export', 'warning')
      return
    }
    const batchName = activitySummaryData.batch?.name || `Batch_${selectedBatchId}`
    const wb = XLSX.utils.book_new()
    const actRows = activitySummaryData.activities.map(a => ({
      'Activity / Pillar Name': a.activity_name,
      'Total Students': a.total_students,
      'DNR (Day 1)': a.dnr_count,
      'Day 1 Attended': a.day1?.is_recorded ? a.day1.attended : '—',
      'Day 1 Absent': a.day1?.is_recorded ? a.day1.not_attended : '—',
      'Day 2 Attended': a.day2?.is_recorded ? a.day2.attended : '—',
      'Day 2 Absent': a.day2?.is_recorded ? a.day2.not_attended : '—',
      'Day 3 Attended': a.day3?.is_recorded ? a.day3.attended : '—',
      'Day 3 Absent': a.day3?.is_recorded ? a.day3.not_attended : '—',
      'Day 4 Attended': a.day4?.is_recorded ? a.day4.attended : '—',
      'Day 4 Absent': a.day4?.is_recorded ? a.day4.not_attended : '—',
      'Day 5 Attended': a.day5?.is_recorded ? a.day5.attended : '—',
      'Day 5 Absent': a.day5?.is_recorded ? a.day5.not_attended : '—'
    }))

    if (activitySummaryData.totals) {
      const t = activitySummaryData.totals
      actRows.push({
        'Activity / Pillar Name': 'TOTAL (Batch Aggregate)',
        'Total Students': t.total_students,
        'DNR (Day 1)': t.dnr_count,
        'Day 1 Attended': t.day1?.is_recorded ? t.day1.attended : '—',
        'Day 1 Absent': t.day1?.is_recorded ? t.day1.not_attended : '—',
        'Day 2 Attended': t.day2?.is_recorded ? t.day2.attended : '—',
        'Day 2 Absent': t.day2?.is_recorded ? t.day2.not_attended : '—',
        'Day 3 Attended': t.day3?.is_recorded ? t.day3.attended : '—',
        'Day 3 Absent': t.day3?.is_recorded ? t.day3.not_attended : '—',
        'Day 4 Attended': t.day4?.is_recorded ? t.day4.attended : '—',
        'Day 4 Absent': t.day4?.is_recorded ? t.day4.not_attended : '—',
        'Day 5 Attended': t.day5?.is_recorded ? t.day5.attended : '—',
        'Day 5 Absent': t.day5?.is_recorded ? t.day5.not_attended : '—'
      })
    }

    const wsAct = XLSX.utils.json_to_sheet(actRows)
    XLSX.utils.book_append_sheet(wb, wsAct, 'Activity Attendance Summary')
    XLSX.writeFile(wb, `Activity_DayWise_Attendance_Summary_${batchName.replace(/\s+/g, '_')}.xlsx`)
    if (showToast) showToast('Day-wise activity attendance summary downloaded successfully', 'success')
  }

  // Initialize selectedBatchId to the first active batch or first batch if not set
  useEffect(() => {
    if (batches && batches.length > 0 && !selectedBatchId) {
      const active = batches.find(b => b.status === 'active')
      if (active) {
        setSelectedBatchId(active.id)
      } else {
        setSelectedBatchId(batches[0].id)
      }
    }
  }, [batches, selectedBatchId])

  const fetchSquadAttendance = async () => {
    if (!selectedBatchId || !selectedSquad) return
    try {
      setLoading(true)
      const url = `${apiBase}/api/superadmin/reports/attendance-squad-wise?batchId=${selectedBatchId}&squad=${selectedSquad}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const resData = await res.json()
      if (res.ok) {
        setAttendanceData(resData.data || [])
        setSquadLeaders(resData.leaders || [])
      } else {
        if (showToast) showToast(resData.message || 'Failed to fetch attendance', 'error')
      }
    } catch (err) {
      if (showToast) showToast('Error connecting to server', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSquadAttendance()
  }, [selectedBatchId, selectedSquad])

  // Filtered list by search query
  const filteredData = useMemo(() => {
    return attendanceData.filter(row => {
      const name = String(row[0] || '').toLowerCase()
      const prn = String(row[1] || '').toLowerCase()
      const query = searchQuery.toLowerCase()
      return name.includes(query) || prn.includes(query)
    })
  }, [attendanceData, searchQuery])

  // Calculate statistics
  const stats = useMemo(() => {
    let totalRecords = attendanceData.length
    let totalPresentMarks = 0
    let totalPossibleMarks = 0
    let dnrCount = 0

    attendanceData.forEach(row => {
      if (String(row[0] || '').includes('[DNR]')) {
        dnrCount++
      }
      // Activity columns start from index 3 up to 8
      for (let i = 3; i <= 8; i++) {
        const val = String(row[i] || '')
        if (val && val !== '—') {
          // Count 'Present' occurrences
          const presents = (val.match(/Present/g) || []).length
          const absents = (val.match(/Absent/g) || []).length
          totalPresentMarks += presents
          totalPossibleMarks += (presents + absents)
        }
      }
    })

    const rate = totalPossibleMarks > 0 
      ? Math.round((totalPresentMarks / totalPossibleMarks) * 100) 
      : 0

    return {
      totalStudents: totalRecords,
      attendanceRate: rate,
      dnrCount
    }
  }, [attendanceData])

  // Download squad attendance as styled Excel
  const handleDownloadExcel = () => {
    if (!attendanceData || attendanceData.length === 0) {
      if (showToast) showToast('No attendance data available to download', 'warning')
      return
    }

    try {
      const batchName = batches.find(b => String(b.id) === String(selectedBatchId))?.name || 'Batch'
      const sanitizedBatchName = batchName.replace(/[^a-zA-Z0-9_-]/g, '_')
      
      const rows = filteredData.map((row, idx) => ({
        'Sr No': idx + 1,
        'Student Name': String(row[0] || '').replace(/\s*\[DNR\]\s*/g, ''),
        'DNR Status': String(row[0] || '').includes('[DNR]') ? 'DNR (Did Not Report)' : 'Reported',
        'PRN': row[1] || '—',
        'Squad': row[2] || selectedSquad,
        'Agriculture & Nature': row[3] || '—',
        'Physical Drills & Sports': row[4] || '—',
        'Team & Leadership': row[5] || '—',
        'Patriotism & Nation': row[6] || '—',
        'Spirituality & Peace': row[7] || '—',
        'Orientation': row[8] || '—'
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, `${selectedSquad} Attendance`)
      XLSX.writeFile(wb, `${selectedSquad}_Squad_Attendance_${sanitizedBatchName}.xlsx`)
      if (showToast) showToast(`Downloaded ${selectedSquad} Squad attendance Excel!`, 'success')
    } catch (err) {
      if (showToast) showToast('Failed to export Excel file', 'error')
    }
  }

  const renderBadge = (statusText) => {
    if (!statusText || statusText === '—') {
      return <span style={{ color: '#cbd5e1', fontSize: '12px' }}>—</span>
    }
    
    // Status text could contain multiple days like "Day 1: Present, Day 2: Present"
    let items = statusText.split(',').map(s => s.trim())
    if (selectedDayFilter !== 'all') {
      items = items.filter(item => item.toLowerCase().includes(`day ${selectedDayFilter}:`))
      if (items.length === 0) return <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {items.map((item, idx) => {
          const isPresent = item.toLowerCase().includes('present')
          return (
            <span key={idx} style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 7px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              background: isPresent ? '#f0fdf4' : '#fef2f2',
              color: isPresent ? '#166534' : '#991b1b',
              border: `1px solid ${isPresent ? '#bbf7d0' : '#fecaca'}`,
              width: 'fit-content',
              lineHeight: 1.25
            }}>
              {item}
            </span>
          )
        })}
      </div>
    )
  }

  // Primary squad coordinator
  const primaryCoordinator = squadLeaders.length > 0 ? squadLeaders[0] : null
  const squadColor = SQUAD_COLORS[selectedSquad] || '#2563eb'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .att-stat-tile {
          transition: all 0.15s ease;
        }
        .att-stat-tile:hover {
          border-color: #cbd5e1;
        }
      `}</style>

      {/* Page Heading & Compact Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{
            fontSize: '19px',
            fontWeight: '700',
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.3px'
          }}>
            Attendance
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
            Day 1 to Day 5 student attendance tracking, squad coordinator overview, and automated reports.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setShowActivitySummaryModal(true)
              if (!activitySummaryData || String(activitySummaryData.batch?.id) !== String(selectedBatchId)) {
                fetchActivitySummary(selectedBatchId)
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '36px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#1e3a8a',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-slate-50"
            title="Open Day-Wise Activity Attendance Summary Modal"
          >
            <FileSpreadsheet size={14} style={{ color: '#2563eb' }} />
            <span>Attendance Summary</span>
          </button>

          <button
            type="button"
            onClick={fetchSquadAttendance}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 14px',
              height: '36px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-slate-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading || !attendanceData.length}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              height: '36px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              background: (loading || !attendanceData.length) ? '#94a3b8' : '#16a34a',
              border: 'none',
              color: '#ffffff',
              cursor: (loading || !attendanceData.length) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !attendanceData.length) ? 'none' : '0 1px 2px rgba(22, 163, 74, 0.2)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} />
            <span>Download Excel</span>
          </button>
        </div>
      </div>

      {/* Clean Filters Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        alignItems: 'end'
      }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
            Choose Batch
          </label>
          <select
            value={selectedBatchId}
            onChange={e => setSelectedBatchId(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#ffffff',
              outline: 'none',
              fontWeight: '500',
              color: '#0f172a'
            }}
          >
            <option value="">-- Choose Batch --</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
            Choose Squad
          </label>
          <select
            value={selectedSquad}
            onChange={e => setSelectedSquad(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              padding: '0 10px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#ffffff',
              outline: 'none',
              fontWeight: '600',
              color: '#0f172a'
            }}
          >
            {['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'].map(s => (
              <option key={s} value={s}>{s} Squad</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
            Search Student
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by name or PRN..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 10px 0 32px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#ffffff',
                color: '#0f172a'
              }}
            />
          </div>
        </div>
      </div>

      {/* Compact Statistics Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px'
      }}>
        {/* Stat 1: Total Students */}
        <div className="att-stat-tile" style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Total Students
          </span>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginTop: '2px', lineHeight: 1.2 }}>
            {stats.totalStudents}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            in {selectedSquad} Squad
          </span>
        </div>

        {/* Stat 2: Squad */}
        <div className="att-stat-tile" style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Squad
          </span>
          <div style={{ fontSize: '18px', fontWeight: '700', color: squadColor, marginTop: '2px', lineHeight: 1.2 }}>
            {selectedSquad}
          </div>
          <span style={{ fontSize: '11px', color: stats.dnrCount > 0 ? '#dc2626' : '#94a3b8', marginTop: '2px' }}>
            {stats.dnrCount > 0 ? `${stats.dnrCount} DNR` : '0 DNR'}
          </span>
        </div>

        {/* Stat 3: Squad Coordinator */}
        <div
          className="att-stat-tile"
          onClick={() => {
            if (primaryCoordinator) {
              setSelectedLeaderDetails({
                type: primaryCoordinator.role === 'ltc_member' ? 'LTC Member' : (primaryCoordinator.designation || 'Squad Coordinator'),
                name: primaryCoordinator.name,
                squad: selectedSquad,
                role: primaryCoordinator.role === 'ltc_member' ? 'Squad Coordinator' : (primaryCoordinator.designation || 'Faculty Advisor'),
                email: primaryCoordinator.email || 'Not Available',
                phone: primaryCoordinator.phone || 'Not Available'
              })
            } else {
              setSelectedLeaderDetails({
                type: 'LTC Member',
                name: 'Squad Coordinator',
                squad: selectedSquad,
                role: 'Squad Coordinator',
                email: 'Not Available',
                phone: 'Not Available'
              })
            }
          }}
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Click to view Coordinator details"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Squad Coordinator
            </span>
            <span style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: '600' }}>View Details</span>
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {primaryCoordinator?.name || 'Assigned Coordinator'}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {primaryCoordinator?.role === 'ltc_member' ? 'LTC Member' : (primaryCoordinator?.designation || 'Squad Coordinator')}
          </span>
        </div>

        {/* Stat 4: Attendance Completion */}
        <div className="att-stat-tile" style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Attendance Rate
          </span>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a', marginTop: '2px', lineHeight: 1.2 }}>
            {stats.attendanceRate}%
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Overall Completion
          </span>
        </div>
      </div>

      {/* Attendance Table Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
      }}>
        {/* Table Toolbar: Day Filter Pills & Count */}
        <div style={{
          padding: '10px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          {/* Day Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#64748b', marginRight: '4px' }}>
              Day:
            </span>
            {[
              { id: 'all', label: 'All Days' },
              { id: '1', label: 'Day 1' },
              { id: '2', label: 'Day 2' },
              { id: '3', label: 'Day 3' },
              { id: '4', label: 'Day 4' },
              { id: '5', label: 'Day 5' }
            ].map(pill => {
              const active = selectedDayFilter === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedDayFilter(pill.id)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: active ? '600' : '500',
                    border: active ? '1px solid #224283' : '1px solid #cbd5e1',
                    background: active ? '#224283' : '#ffffff',
                    color: active ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>

          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            Showing <strong style={{ color: '#0f172a' }}>{filteredData.length}</strong> Students
          </span>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Student Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>PRN</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Agriculture &amp; Nature</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Physical Drills &amp; Sports</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Team &amp; Leadership</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Patriotism &amp; Nation</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Spirituality &amp; Peace</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Orientation</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    No student records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={index} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: index % 2 === 0 ? '#ffffff' : '#fafafa'
                  }}>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{String(row[0] || '').replace(/\s*\[DNR\]\s*/g, '')}</span>
                        {String(row[0] || '').includes('[DNR]') && (
                          <span style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            borderRadius: '3px',
                            padding: '1px 5px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}>
                            DNR
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{row[1]}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[3])}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[4])}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[5])}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[6])}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[7])}</td>
                    <td style={{ padding: '10px 14px' }}>{renderBadge(row[8])}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Exact Modal Card (from Screenshot) ────────────────────────── */}
      {selectedLeaderDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
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
            maxWidth: '450px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}>
            {/* Header: Solid LTC blue background */}
            <div style={{
              background: '#154388',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#bfdbfe', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {selectedLeaderDetails.type || 'LTC MEMBER'}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.3px' }}>
                  {selectedLeaderDetails.name}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedLeaderDetails(null)} 
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '20px',
                  border: '2px solid #bfdbfe'
                }}>
                  {selectedLeaderDetails.name ? selectedLeaderDetails.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'NK'}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{selectedLeaderDetails.role || 'Squad Coordinator'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Allocated Squad: <strong style={{ color: SQUAD_COLORS[selectedLeaderDetails.squad] || '#1e3a8a' }}>{selectedLeaderDetails.squad}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>Email Address</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedLeaderDetails.email || 'Not Available'}</div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>Contact Number</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedLeaderDetails.phone || 'Not Available'}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button 
                type="button"
                onClick={() => setSelectedLeaderDetails(null)} 
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#1d4ed8'; e.currentTarget.style.transform = 'translateY(-0.5px)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Day-Wise Activity Attendance Summary Modal Card (Matching Screenshot Layout) ── */}
      {showActivitySummaryModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowActivitySummaryModal(false);
          }}
        >
          <div 
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1180px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Solid LTC blue background */}
            <div style={{
              background: '#154388',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '10.5px', color: '#bfdbfe', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  ATTENDANCE SUMMARY {activitySummaryData?.batch ? `· ${activitySummaryData.batch.name}` : ''}
                </span>
                <h3 style={{ fontSize: '19px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.3px' }}>
                  Day-Wise Activity Attendance Summary
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dbeafe' }}>
                  Day 1 to Day 5 activity &amp; pillar count of students who attended (present) vs not attended (absent / DNR).
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDownloadActivitySummaryExcel}
                  disabled={loadingActivitySummary || (!activitySummaryData?.activities?.length && !activitySummaryData?.squads?.length)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '7px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: (loadingActivitySummary || (!activitySummaryData?.activities?.length && !activitySummaryData?.squads?.length)) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:opacity-95 active:scale-95"
                  title="Download Summary Report as Excel (.xlsx)"
                >
                  <Download size={14} color="#ffffff" strokeWidth={2.4} />
                  <span>Download Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchActivitySummary(selectedBatchId)}
                  disabled={loadingActivitySummary}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '8px',
                    padding: '7px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: loadingActivitySummary ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Refresh summary data"
                >
                  <RefreshCw size={13} className={loadingActivitySummary ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>

                <button 
                  type="button"
                  onClick={() => setShowActivitySummaryModal(false)} 
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  title="Close Modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body: Scrollable */}
            <div style={{ padding: '22px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {/* 4 Overview Cards inside Summary */}
              {activitySummaryData?.totals && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
                  {/* ALL STUDENTS */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>ALL STUDENTS</span>
                      <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>{activitySummaryData.totals.total_students}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>In {activitySummaryData.squads?.length || 10} Squads</div>
                    </div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={18} />
                    </div>
                  </div>

                  {/* Squad Coordinators */}
                  <div 
                    onClick={() => {
                      const firstCoord = activitySummaryData.leaders && activitySummaryData.leaders.length > 0 ? activitySummaryData.leaders[0] : null;
                      if (firstCoord) {
                        setSelectedLeaderDetails({
                          type: firstCoord.role === 'ltc_member' ? 'LTC Member' : (firstCoord.designation || 'Squad Coordinator'),
                          name: firstCoord.name,
                          squad: firstCoord.squad || 'Batch Coordinators',
                          role: firstCoord.role === 'ltc_member' ? 'Squad Coordinator' : (firstCoord.designation || 'Faculty Advisor'),
                          email: firstCoord.email || 'Not Available',
                          phone: firstCoord.phone || 'Not Available'
                        });
                      }
                    }}
                    style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #bfdbfe', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    className="hover:shadow-md transition-all duration-150"
                    title="Click to view Coordinator profile"
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: '8px' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#1d4ed8', textTransform: 'uppercase' }}>Squad Coordinator</span>
                      <div style={{ fontSize: '14px', fontWeight: '850', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                        {activitySummaryData.leaders?.[0]?.name || `${activitySummaryData.leaders?.length || 0} Assigned`}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: '700' }}>Click to view details</div>
                    </div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', flexShrink: 0, border: '1.5px solid #bfdbfe' }}>
                      {activitySummaryData.leaders?.[0]?.name ? activitySummaryData.leaders[0].name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'SC'}
                    </div>
                  </div>

                  {/* Activities */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Activities</span>
                      <div style={{ fontSize: '22px', fontWeight: '900', color: '#d97706', marginTop: '2px' }}>6 Core</div>
                      <div style={{ fontSize: '11px', color: '#dc2626' }}>{activitySummaryData.totals.dnr_count} Total DNR</div>
                    </div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={18} />
                    </div>
                  </div>

                  {/* ATTENDANCE */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>ATTENDANCE</span>
                      <div style={{ fontSize: '22px', fontWeight: '900', color: '#15803d', marginTop: '2px' }}>
                        {(() => {
                          const recDays = [1,2,3,4,5].filter(d => activitySummaryData.recordedDays?.includes(d));
                          if (recDays.length === 0 || !activitySummaryData.totals.total_students) return '—';
                          const sumPct = recDays.reduce((acc, d) => acc + (activitySummaryData.totals[`day${d}`]?.attendance_pct || 0), 0);
                          return `${Math.round(sumPct / recDays.length)}%`;
                        })()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#15803d' }}>Average Recorded</div>
                    </div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={18} />
                    </div>
                  </div>
                </div>
              )}

              {loadingActivitySummary ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>Loading day-wise attendance summary...</div>
                </div>
              ) : (!activitySummaryData?.activities?.length) ? (
                <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No attendance records found for this batch.
                </div>
              ) : (
                /* ── Table View: Spreadsheet Matrix Layout ── */
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.4px' }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', minWidth: '160px', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>
                          ACTIVITY / PILLAR NAME
                        </th>
                        <th style={{ padding: '12px 10px', width: '90px', borderRight: '1px solid #e2e8f0' }} rowSpan={2}>
                          TOTAL STUDENTS
                        </th>
                        <th style={{ padding: '12px 10px', width: '75px', borderRight: '1.5px solid #cbd5e1', color: '#dc2626' }} rowSpan={2}>
                          DNR (DAY 1)
                        </th>
                        {[1, 2, 3, 4, 5].map(d => (
                          <th key={d} colSpan={2} style={{ padding: '8px 10px', borderRight: d < 5 ? '1px solid #e2e8f0' : 'none', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            DAY {d} {activitySummaryData?.recordedDays?.includes(d) ? '' : '(UNMARKED)'}
                          </th>
                        ))}
                      </tr>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', fontSize: '10.5px', fontWeight: '700', color: '#64748b' }}>
                        {[1, 2, 3, 4, 5].map(d => (
                          <React.Fragment key={`sub-${d}`}>
                            <th style={{ padding: '6px 8px', color: '#16a34a', width: '70px' }}>Attended</th>
                            <th style={{ padding: '6px 8px', color: '#dc2626', width: '70px', borderRight: d < 5 ? '1px solid #e2e8f0' : 'none' }}>Absent</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(activitySummaryData.activities || []).map((a, idx) => (
                        <tr key={a.key || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                          <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '750', color: '#0f172a', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                            {a.activity_name}
                          </td>
                          <td style={{ padding: '10px', fontWeight: '800', color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                            {a.total_students}
                          </td>
                          <td style={{ padding: '10px', fontWeight: '800', color: a.dnr_count > 0 ? '#dc2626' : '#94a3b8', borderRight: '1.5px solid #cbd5e1' }}>
                            {a.dnr_count > 0 ? a.dnr_count : '0'}
                          </td>
                          {[1, 2, 3, 4, 5].map(d => {
                            const dayObj = a[`day${d}`] || {};
                            const isRec = dayObj.is_recorded;
                            const isValid = dayObj.is_valid_day !== false;
                            return (
                              <React.Fragment key={`day-cell-${d}`}>
                                <td style={{ padding: '10px 6px', fontWeight: '750', color: isRec ? '#16a34a' : '#94a3b8', background: isRec && dayObj.attended > 0 ? '#f0fdf4' : 'transparent' }}>
                                  {!isValid ? '—' : (isRec ? dayObj.attended : '—')}
                                </td>
                                <td style={{ padding: '10px 6px', fontWeight: '750', color: isRec ? (dayObj.not_attended > 0 ? '#dc2626' : '#64748b') : '#94a3b8', borderRight: d < 5 ? '1px solid #e2e8f0' : 'none', background: isRec && dayObj.not_attended > 0 ? '#fef2f2' : 'transparent' }}>
                                  {!isValid ? '—' : (isRec ? dayObj.not_attended : '—')}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {activitySummaryData.totals && (
                      <tfoot>
                        <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '850', color: '#0f172a' }}>
                          <td style={{ padding: '12px 14px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                            TOTAL (Batch Aggregate)
                          </td>
                          <td style={{ padding: '12px 10px', borderRight: '1px solid #cbd5e1', fontSize: '13px' }}>
                            {activitySummaryData.totals.total_students}
                          </td>
                          <td style={{ padding: '12px 10px', borderRight: '1.5px solid #cbd5e1', color: activitySummaryData.totals.dnr_count > 0 ? '#dc2626' : '#64748b', fontSize: '13px' }}>
                            {activitySummaryData.totals.dnr_count}
                          </td>
                          {[1, 2, 3, 4, 5].map(d => {
                            const tObj = activitySummaryData.totals[`day${d}`] || {};
                            const isRec = tObj.is_recorded;
                            return (
                              <React.Fragment key={`tot-${d}`}>
                                <td style={{ padding: '12px 6px', color: isRec ? '#15803d' : '#94a3b8', fontSize: '13px' }}>
                                  {isRec ? tObj.attended : '—'}
                                </td>
                                <td style={{ padding: '12px 6px', color: isRec ? '#b91c1c' : '#94a3b8', borderRight: d < 5 ? '1px solid #e2e8f0' : 'none', fontSize: '13px' }}>
                                  {isRec ? tObj.not_attended : '—'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Footer: Matching reference modal footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={handleDownloadActivitySummaryExcel}
                disabled={loadingActivitySummary || (!activitySummaryData?.activities?.length && !activitySummaryData?.squads?.length)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: (loadingActivitySummary || (!activitySummaryData?.activities?.length && !activitySummaryData?.squads?.length)) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Download size={14} color="#ffffff" strokeWidth={2.4} />
                <span>Download Excel</span>
              </button>

              <button 
                type="button"
                onClick={() => setShowActivitySummaryModal(false)} 
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 24px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                className="hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
