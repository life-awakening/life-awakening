import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Download, RefreshCw, FileText, ClipboardList, BookOpen, MessageSquare, Award, CheckSquare, Home, GraduationCap, CheckCircle, Clock, Eye, X, Sparkles, Edit2, Check } from 'lucide-react'
import * as XLSX from 'xlsx'
import { parseFeedbackForDisplay, formatFeedbackForExcel } from '../utils/feedbackQuestions'

export default function FeedbackTab({ token, apiBase, showToast, batches }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [selectedSquad, setSelectedSquad] = useState('Aditya')
  const [selectedRole, setSelectedRole] = useState('student') // 'student' or 'faculty'
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [studentData, setStudentData] = useState([])
  const [subView, setSubView] = useState('undertaking') // 'undertaking', 'marks', 'feedback', 'attendance'
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingFeedbackModal, setViewingFeedbackModal] = useState(null)
  const [updatingTshirtId, setUpdatingTshirtId] = useState(null)
  const [updatingFieldKey, setUpdatingFieldKey] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const ITEMS_PER_PAGE = 15

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch (e) {
      return {}
    }
  }, [])

  const canEditField = ['admin', 'superadmin', 'superadmin_readonly', 'support', 'dean_ltc', 'jeeten'].includes(currentUser.role)
  const canEditTshirt = canEditField

  // Dismiss cell edit on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (editingCell && !e.target.closest('.editable-contact-cell-container')) {
        setEditingCell(null)
        setEditingValue('')
      }
    }
    if (editingCell) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingCell])

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedBatchId, selectedSquad, selectedRole, searchQuery, subView])

  // Reset subView to 'undertaking' if role is faculty and current view isn't available for faculty
  useEffect(() => {
    if (selectedRole === 'faculty' && subView !== 'undertaking' && subView !== 'tshirts' && subView !== 'feedback' && subView !== 'rooms') {
      setSubView('undertaking')
    }
  }, [selectedRole, subView])

  // Reset selectedRole to 'student' if subView is marks or attendance (not supported for faculty)
  useEffect(() => {
    if ((subView === 'marks' || subView === 'attendance') && selectedRole !== 'student') {
      setSelectedRole('student')
    }
  }, [subView, selectedRole])

  // Initialize selectedBatchId
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

  const fetchSubmissionData = async () => {
    if (!selectedBatchId || !selectedSquad) return
    try {
      setLoading(true)
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const endpointPrefix = user.role === 'superadmin' ? 'superadmin' : 'admin'
      const url = `${apiBase}/api/${endpointPrefix}/reports/submissions-squad-wise?batchId=${selectedBatchId}&squad=${selectedSquad}&roleType=${selectedRole}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        setStudentData(data.data || [])
      } else {
        showToast(data.message || 'Failed to fetch submission data', 'error')
      }
    } catch (err) {
      showToast('Error connecting to server', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadFeedbackPdf = async (studentId, category) => {
    if (!studentId) {
      showToast('No user ID associated with this feedback.', 'error');
      return;
    }
    try {
      const url = `${apiBase}/api/student/feedback/pdf/${studentId}/${category}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to download feedback PDF.');
      }
      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;

      let filename = `Feedback_${category}_Student_${studentId}.pdf`;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const parts = disposition.split('filename=');
        filename = parts[1].replace(/['"]/g, '');
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    fetchSubmissionData()
  }, [selectedBatchId, selectedSquad, selectedRole])

  // Filtered by Search query and sorted by Room if active view is rooms
  const filteredData = useMemo(() => {
    let result = studentData.filter(row => {
      const name = String(row[0] || '').toLowerCase()
      const prn = String(row[1] || '').toLowerCase()
      const squad = String(row[3] || '').toLowerCase()
      const parentName = String(row[39] || row[15] || '').toLowerCase()
      const parentEmail = String(row[42] || row[2] || '').toLowerCase()
      const query = searchQuery.toLowerCase()
      return name.includes(query) || prn.includes(query) || squad.includes(query) || parentName.includes(query) || parentEmail.includes(query)
    })

    if (subView === 'rooms') {
      result = [...result].sort((a, b) => {
        // Room allotted is mapped as index 28
        const roomA = String(a[28] || '—')
        const roomB = String(b[28] || '—')

        if (roomA === '—') return 1
        if (roomB === '—') return -1

        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' })
      })
    }

    return result
  }, [studentData, searchQuery, subView])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredData, currentPage])

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE)

  // Calculate statistics
  const stats = useMemo(() => {
    let total = studentData.length
    let submittedUndertaking = studentData.filter(r => r[4] === 'Yes').length
    let submittedPreLtc = studentData.filter(r => r[26] && String(r[26]).trim() !== '—' && String(r[26]).trim() !== '' && String(r[26]).trim().toLowerCase() !== 'not submitted').length
    let submittedPostLtc = studentData.filter(r => r[27] && String(r[27]).trim() !== '—' && String(r[27]).trim() !== '' && String(r[27]).trim().toLowerCase() !== 'not submitted').length

    let sumRates = 0
    let rateCount = 0
    studentData.forEach(r => {
      const rateStr = String(r[25]).replace('%', '')
      if (rateStr && rateStr !== '—') {
        sumRates += parseFloat(rateStr)
        rateCount++
      }
    })
    const avgAttendance = rateCount > 0 ? Math.round(sumRates / rateCount) : 0

    return {
      total,
      submittedUndertaking,
      submittedPreLtc,
      submittedPostLtc,
      avgAttendance
    }
  }, [studentData])

  const COLUMNS = [
    selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
    selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
    'Email', 'Squad',
    'Undertaking Submitted', 'Signed Name', 'Signed Date', 'T-Shirt Size', 'Jain Food Required?', 'Monday Fast?',
    'Photo/Video Consent', 'T-Shirt Consent', 'Data Consent', 'Bag Check Consent', 'Medical Consent',
    'Emergency Contact Name', 'Emergency Contact Mobile', 'Emergency Contact Relation',
    'Blood Group', 'Medical Conditions',
    'Agriculture Marks (/20)', 'Physical Marks (/20)', 'Leadership Marks (/20)', 'Patriotism/Nation Marks (/20)', 'Spirituality/Peace Marks (/20)',
    'Attendance Rate (%)', 'Pre-LTC Feedback', 'Post-LTC Feedback',
    'Room Allotted'
  ]

  // Get active columns and map cells based on current sub-tab
  const activeViewConfig = useMemo(() => {
    if (subView === 'undertaking') {
      if (selectedRole === 'faculty') {
        return {
          columns: [
            'Faculty Name', 'Faculty ID', 'Email', 'Squad',
            'Undertaking Submitted', 'Signed By', 'Signed Date',
            'Emergency Contact Name', 'Emergency Contact Mobile', 'Emergency Contact Relation',
            'Blood Group', 'Medical Conditions'
          ],
          mapRow: (r) => [
            r[0], r[1], r[2], r[3],
            r[4], r[5], r[6],
            r[15] || '—', r[16] || '—', r[17] || '—',
            r[18] || '—', r[19] || 'None'
          ]
        }
      }
      return {
        columns: [
          'Student Name',
          'PRN',
          'Class / Grade',
          'School',
          'Age',
          'Squad',
          'Undertaking Submitted',
          'Signed By',
          'Signed Date',
          'Parent Consent',
          'Parent / Guardian Name',
          'Relationship',
          'Parent Mobile',
          'Parent Email',
          'Residential Address',
          'Medical Conditions',
          'Medical Details'
        ],
        mapRow: (r) => [
          r[0] || '—', // Student Name
          r[1] || '—', // PRN
          r[36] || '—', // Class / Grade
          r[37] || '—', // School
          r[38] || '—', // Age
          r[3] || '—', // Squad
          r[4] === 'Yes' ? 'Yes' : 'No', // Undertaking Submitted
          r[5] || 'Not Signed', // Signed By
          r[6] || 'Not Signed', // Signed Date
          (r[46] === 'Yes' || r[4] === 'Yes') ? 'Yes' : 'No', // Parent Consent
          r[39] || r[15] || '—', // Parent / Guardian Name
          r[40] || r[17] || '—', // Relationship
          r[41] || r[16] || '—', // Parent Mobile
          r[42] || r[2] || '—', // Parent Email
          r[43] || '—', // Residential Address
          r[44] || r[19] || 'None', // Medical Conditions
          r[45] || 'None' // Medical Details
        ]
      }
    }
    if (subView === 'tshirts') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[7]],
        mapRow: (r) => [r[0], r[1], r[7]]
      }
    }
    if (subView === 'rooms') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[2], COLUMNS[3], COLUMNS[28]],
        mapRow: (r) => [r[0], r[1], r[2], r[3], r[28]]
      }
    }
    if (subView === 'marks') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[3], ...COLUMNS.slice(20, 25)],
        mapRow: (r) => [r[0], r[1], r[3], ...r.slice(20, 25)]
      }
    }
    if (subView === 'feedback') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[3], COLUMNS[26], COLUMNS[27]],
        mapRow: (r) => [r[0], r[1], r[3], r[26], r[27]]
      }
    }
    if (subView === 'attendance') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[3], COLUMNS[25]],
        mapRow: (r) => [r[0], r[1], r[3], r[25]]
      }
    }
    if (subView === 'service_feedback') {
      return {
        columns: [COLUMNS[0], COLUMNS[1], COLUMNS[3], 'Service & Trainers Feedback'],
        mapRow: (r) => [r[0], r[1], r[3], r[32] || '—']
      }
    }
    return {
      columns: COLUMNS,
      mapRow: (r) => r
    }
  }, [subView, selectedRole])

  // Compute T-Shirt Size Counts Summary from filteredData
  const tshirtSizeCounts = useMemo(() => {
    const counts = {}
    filteredData.forEach(r => {
      let rawSize = String(r[7] || 'Unspecified').trim()
      const upper = rawSize.toUpperCase()
      if (!rawSize || upper === '—' || upper === 'N/A' || upper === 'NULL' || upper === 'UNDEFINED' || upper === 'NOT SIGNED' || upper === '-- SELECT SIZE --' || upper === '') {
        rawSize = 'Unspecified'
      }
      counts[rawSize] = (counts[rawSize] || 0) + 1
    })
    return counts
  }, [filteredData])

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      showToast('No data available to export.', 'error')
      return
    }

    // ── Dedicated Room Allotment Excel Export ──
    if (subView === 'rooms') {
      const squadOrder = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

      const roomSortedData = [...filteredData].sort((a, b) => {
        const squadA = String(a[3] || '').trim()
        const squadB = String(b[3] || '').trim()
        const idxA = squadOrder.indexOf(squadA)
        const idxB = squadOrder.indexOf(squadB)

        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
        if (idxA !== -1 && idxB === -1) return -1
        if (idxA === -1 && idxB !== -1) return 1
        if (squadA !== squadB) return squadA.localeCompare(squadB)

        const roomA = String(a[28] || '—').trim()
        const roomB = String(b[28] || '—').trim()
        if (roomA === '—' && roomB !== '—') return 1
        if (roomA !== '—' && roomB === '—') return -1
        if (roomA !== roomB) return roomA.localeCompare(roomB, undefined, { numeric: true })

        return String(a[0] || '').localeCompare(String(b[0] || ''))
      })

      let allottedCount = 0
      let unallottedCount = 0

      roomSortedData.forEach(r => {
        const room = String(r[28] || '—').trim()
        if (room !== '—' && room !== 'N/A' && room !== 'UNASSIGNED' && room !== '') {
          allottedCount++
        } else {
          unallottedCount++
        }
      })

      const roomColumns = ['Sr. No.', 'Squad', 'Room Allotted', 'Room Designation', selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name', selectedRole === 'faculty' ? 'Faculty ID' : 'PRN', 'Email']

      const wsData = []
      wsData.push(['ROOM ALLOTMENT REPORT (SQUAD-WISE)'])
      wsData.push([`• Total ${selectedRole === 'faculty' ? 'Faculty' : 'Students'}: ${roomSortedData.length}`])
      wsData.push([`• Rooms Allotted: ${allottedCount}`])
      wsData.push([`• Pending Allotment: ${unallottedCount}`])
      wsData.push([])

      wsData.push(roomColumns)
      roomSortedData.forEach((r, i) => {
        wsData.push([
          i + 1,
          r[3] || '—',
          r[28] || '—',
          r[31] || '—',
          r[0] || '—',
          r[1] || '—',
          r[2] || '—'
        ])
      })

      const ws = XLSX.utils.aoa_to_sheet(wsData)

      ws['!cols'] = [
        { wch: 8 },  // Sr. No.
        { wch: 14 }, // Squad
        { wch: 18 }, // Room Allotted
        { wch: 24 }, // Room Designation
        { wch: 28 }, // Name
        { wch: 16 }, // PRN / ID
        { wch: 32 }  // Email
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `Rooms_${selectedSquad}`)
      XLSX.writeFile(wb, `Room_Allotment_${selectedSquad}_report.xlsx`)
      showToast(`Room allotment report (Squad-wise, Sr. No. order) exported successfully!`, 'success')
      return
    }

    // ── Dedicated T-Shirt Size Excel Export ──
    if (subView === 'tshirts') {
      const squadOrder = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

      const tshirtSortedData = [...filteredData].sort((a, b) => {
        const squadA = String(a[3] || '').trim()
        const squadB = String(b[3] || '').trim()
        const idxA = squadOrder.indexOf(squadA)
        const idxB = squadOrder.indexOf(squadB)

        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
        if (idxA !== -1 && idxB === -1) return -1
        if (idxA === -1 && idxB !== -1) return 1
        if (squadA !== squadB) return squadA.localeCompare(squadB, undefined, { sensitivity: 'base' })

        const nameA = String(a[0] || '').trim()
        const nameB = String(b[0] || '').trim()
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      })

      const tshirtCounts = {}
      let grandTotal = 0

      filteredData.forEach(r => {
        let rawSize = String(r[7] || 'Unspecified').trim()
        const upper = rawSize.toUpperCase()
        if (!rawSize || upper === '—' || upper === 'N/A' || upper === 'NULL' || upper === 'UNDEFINED' || upper === 'NOT SIGNED' || upper === '-- SELECT SIZE --' || upper === '') {
          rawSize = 'Unspecified'
        }
        tshirtCounts[rawSize] = (tshirtCounts[rawSize] || 0) + 1
        grandTotal++
      })

      const standardOrder = ['36 - S', '38 - M', '40 - L', '42 - XL', '44 - XXL', '46 - XXXL', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'Unspecified']
      const sortedSizes = Object.keys(tshirtCounts).sort((a, b) => {
        const idxA = standardOrder.indexOf(a)
        const idxB = standardOrder.indexOf(b)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return a.localeCompare(b)
      })

      const tshirtColumns = [
        'Sr. No.',
        'Squad Name',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'T-Shirt Size'
      ]

      const wsData = []
      wsData.push(['T-SHIRT SIZE REPORT (SQUAD-WISE)'])
      wsData.push([`• Total T-Shirts Required: ${grandTotal}`])
      wsData.push([`• Total ${selectedRole === 'faculty' ? 'Faculty' : 'Students'}: ${tshirtSortedData.length}`])
      wsData.push([])
      wsData.push(['Size-wise Count Summary:'])

      sortedSizes.forEach(sizeKey => {
        const count = tshirtCounts[sizeKey]
        const label = sizeKey === 'Unspecified' ? 'Size Unspecified' : (sizeKey.startsWith('Size ') ? sizeKey : `Size ${sizeKey}`)
        wsData.push([`• ${label}: ${count}`])
      })

      wsData.push([])

      wsData.push(tshirtColumns)

      tshirtSortedData.forEach((r, i) => {
        let sizeVal = String(r[7] || '—').trim()
        if (!sizeVal || sizeVal === 'N/A' || sizeVal.toUpperCase() === 'NULL' || sizeVal.toUpperCase() === 'UNDEFINED' || sizeVal === '-- Select Size --') {
          sizeVal = '—'
        }
        wsData.push([
          i + 1,
          r[3] || '—',
          r[0] || '—',
          r[1] || '—',
          sizeVal
        ])
      })

      const ws = XLSX.utils.aoa_to_sheet(wsData)

      const colWidths = tshirtColumns.map((col, idx) => {
        let maxLen = String(col).length
        tshirtSortedData.forEach((r, i) => {
          const val = idx === 0 ? String(i + 1) : idx === 1 ? String(r[3] || '—') : idx === 2 ? String(r[0] || '—') : idx === 3 ? String(r[1] || '—') : String(r[7] || '—')
          if (val.length > maxLen) maxLen = val.length
        })
        return { wch: Math.min(Math.max(maxLen + 5, 12), 45) }
      })
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `TShirt_Sizes_${selectedSquad}`)
      XLSX.writeFile(wb, `TShirt_Sizes_${selectedSquad}_report.xlsx`)
      showToast(`T-Shirt Size report (Squad-wise, Sr. No. order) exported successfully!`, 'success')
      return
    }

    let { columns, mapRow } = activeViewConfig

    const squadOrder = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']
    const exportSourceData = subView === 'undertaking'
      ? [...filteredData].sort((a, b) => {
        const squadA = String(a[3] || '').trim()
        const squadB = String(b[3] || '').trim()
        const idxA = squadOrder.indexOf(squadA)
        const idxB = squadOrder.indexOf(squadB)

        if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
        if (idxA !== -1 && idxB === -1) return -1
        if (idxA === -1 && idxB !== -1) return 1
        if (squadA !== squadB) return squadA.localeCompare(squadB, undefined, { sensitivity: 'base' })

        return String(a[0] || '').localeCompare(String(b[0] || ''), undefined, { sensitivity: 'base' })
      })
      : filteredData

    if (subView === 'undertaking') {
      const origMapRow = activeViewConfig.mapRow
      if (selectedRole === 'faculty') {
        columns = [...columns.slice(0, 4), 'Panel', ...columns.slice(4)]
        mapRow = (r) => {
          const base = origMapRow(r)
          const panelVal = (() => {
            const p = r[30]
            if (!p || String(p).trim() === '' || String(p).trim() === '—') return '—'
            return String(p).trim()
          })()
          return [...base.slice(0, 4), panelVal, ...base.slice(4)]
        }
      } else {
        columns = [...columns.slice(0, 6), 'Panel', ...columns.slice(6)]
        mapRow = (r) => {
          const base = origMapRow(r)
          const panelVal = (() => {
            const p = r[30]
            if (!p || String(p).trim() === '' || String(p).trim() === '—') return '—'
            return String(p).trim()
          })()
          return [...base.slice(0, 6), panelVal, ...base.slice(6)]
        }
      }
    }

    const rows = exportSourceData.map((row, idx) => {
      const mapped = mapRow(row)
      return mapped.map((cell, colIdx) => {
        const colHeader = columns[colIdx]
        if (colHeader === 'Pre-LTC Feedback') {
          const rawVal = row[34] || cell
          return formatFeedbackForExcel(rawVal, 'Pre-LTC')
        }
        if (colHeader === 'Post-LTC Feedback') {
          const rawVal = row[35] || cell
          return formatFeedbackForExcel(rawVal, 'Post-LTC')
        }
        if (colHeader === 'Service & Trainers Feedback') {
          const rawVal = row[33] || cell
          return formatFeedbackForExcel(rawVal, 'Service-Trainers')
        }
        return (cell === null || cell === undefined || String(cell).trim() === '' ? '—' : cell)
      })
    })

    const wsData = [columns, ...rows]

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    const colWidths = columns.map((col, idx) => {
      const isFeedback = col === 'Pre-LTC Feedback' || col === 'Post-LTC Feedback' || col === 'Service & Trainers Feedback'
      if (isFeedback) {
        return { wch: 72 } // Wide feedback column for comfortable horizontal reading
      }
      let maxLen = String(col).length
      rows.forEach(r => {
        const valLen = String(r[idx] || '').length
        if (valLen > maxLen) maxLen = valLen
      })
      return { wch: Math.min(Math.max(maxLen + 4, 14), 45) }
    })
    ws['!cols'] = colWidths

    // Set wrapText and top vertical alignment, with compact heights (max 160–180, never 400)
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref'])
      const rowHeights = []

      for (let R = 0; R <= range.e.r; ++R) {
        let maxLinesInRow = 1
        let hasSubmittedFeedback = false

        for (let C = 0; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[cellRef]
          if (!cell || cell.v === undefined) continue

          if (typeof cell.v === 'string') {
            const lines = cell.v.split('\n').length
            if (lines > maxLinesInRow) maxLinesInRow = lines
            if (lines > 2 && cell.v !== 'Not Submitted') {
              hasSubmittedFeedback = true
            }
          }

          if (!cell.s) cell.s = {}
          cell.s.alignment = {
            wrapText: true,
            vertical: 'top'
          }
        }

        // Keep headers and unsubmitted/empty rows compact
        if (R === 0 || !hasSubmittedFeedback || maxLinesInRow <= 2) {
          rowHeights.push({ hpt: 20 })
        } else {
          // For long submitted feedback, cap comfortably between 60 and 165 hpt to prevent tall 400pt scrolling
          const computedHeight = Math.min(Math.max(maxLinesInRow * 11 + 10, 50), 165)
          rowHeights.push({ hpt: computedHeight })
        }
      }
      ws['!rows'] = rowHeights
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${selectedSquad}_${subView}`)
    XLSX.writeFile(wb, `${selectedSquad}_${subView}_report.xlsx`)
    showToast(`Excel exported with clean, readable feedback formatting!`, 'success')
  }

  const handleExportPendingExcel = () => {
    if (filteredData.length === 0) {
      showToast('No data available to export.', 'error')
      return
    }

    const squadOrder = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

    const isPendingRow = (r) => {
      if (subView === 'undertaking') {
        return r[4] !== 'Yes'
      }
      if (subView === 'tshirts') {
        const raw = String(r[7] || '').trim().toLowerCase()
        return !raw || raw === '—' || raw === 'n/a' || raw === 'null' || raw === 'undefined' || raw === 'not signed' || raw === 'unspecified' || raw === '-- select size --'
      }
      if (subView === 'rooms') {
        const room = String(r[28] || '').trim().toUpperCase()
        return !room || room === '—' || room === 'N/A' || room === 'UNASSIGNED' || room === 'NULL'
      }
      if (subView === 'feedback') {
        const isPreSubmitted = r[26] && String(r[26]).trim() !== '—' && String(r[26]).trim() !== '' && String(r[26]).trim().toLowerCase() !== 'not submitted'
        const isPostSubmitted = r[27] && String(r[27]).trim() !== '—' && String(r[27]).trim() !== '' && String(r[27]).trim().toLowerCase() !== 'not submitted'
        return !isPreSubmitted || !isPostSubmitted
      }
      if (subView === 'attendance') {
        const rateStr = String(r[25] || '').replace('%', '').trim()
        return !rateStr || rateStr === '—' || parseFloat(rateStr) === 0
      }
      if (subView === 'service_feedback') {
        const isSubmitted = r[32] && String(r[32]).trim() !== '—' && String(r[32]).trim() !== '' && String(r[32]).trim().toLowerCase() !== 'not submitted'
        return !isSubmitted
      }
      if (subView === 'marks') {
        const pillars = [r[20], r[21], r[22], r[23], r[24]]
        return pillars.some(p => !p || String(p).trim() === '—' || String(p).trim() === '')
      }

      // Default fallback
      const isUndertakingSubmitted = r[4] === 'Yes'
      const isPreSubmitted = r[26] && String(r[26]).trim() !== '—' && String(r[26]).trim() !== '' && String(r[26]).trim().toLowerCase() !== 'not submitted'
      const isPostSubmitted = r[27] && String(r[27]).trim() !== '—' && String(r[27]).trim() !== '' && String(r[27]).trim().toLowerCase() !== 'not submitted'
      return !isUndertakingSubmitted || !isPreSubmitted || !isPostSubmitted
    }

    const pendingList = filteredData.filter(isPendingRow).sort((a, b) => {
      const squadA = String(a[3] || '').trim()
      const squadB = String(b[3] || '').trim()
      const idxA = squadOrder.indexOf(squadA)
      const idxB = squadOrder.indexOf(squadB)

      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
      if (idxA !== -1 && idxB === -1) return -1
      if (idxA === -1 && idxB !== -1) return 1
      if (squadA !== squadB) return squadA.localeCompare(squadB, undefined, { sensitivity: 'base' })

      return String(a[0] || '').localeCompare(String(b[0] || ''), undefined, { sensitivity: 'base' })
    })

    if (pendingList.length === 0) {
      const labelMap = {
        undertaking: 'Undertaking submission',
        tshirts: 'T-Shirt size selection',
        rooms: 'Room allotment',
        feedback: 'Pre/Post Feedback submission',
        attendance: 'Attendance recording',
        marks: 'Activity marks evaluation'
      }
      showToast(`All users in this selection have completed ${labelMap[subView] || 'their submissions'}!`, 'info')
      return
    }

    const selectedBatchObj = (batches || []).find(b => String(b.id) === String(selectedBatchId))
    const batchName = selectedBatchObj ? selectedBatchObj.name : selectedBatchId

    let columns = []
    let getRowData = null
    let reportTitle = ''
    let filenameSuffix = ''

    if (subView === 'undertaking') {
      reportTitle = 'PENDING UNDERTAKINGS REPORT'
      filenameSuffix = 'Pending_Undertakings'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'Undertaking Status'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        'Pending (Not Signed)'
      ]
    } else if (subView === 'tshirts') {
      reportTitle = 'PENDING T-SHIRT SIZES REPORT'
      filenameSuffix = 'Pending_TShirt_Sizes'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'T-Shirt Size Status'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        'Size Unspecified / Pending'
      ]
    } else if (subView === 'rooms') {
      reportTitle = 'PENDING ROOM ALLOTMENT REPORT'
      filenameSuffix = 'Pending_Room_Allotments'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'Room Allotment Status'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        'Unallotted / Pending'
      ]
    } else if (subView === 'feedback') {
      reportTitle = 'PENDING FEEDBACK REPORT'
      filenameSuffix = 'Pending_Feedback'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'Pre-LTC Feedback',
        'Post-LTC Feedback',
        'Pending Status'
      ]
      getRowData = (r, i) => {
        const isPreSubmitted = r[26] && String(r[26]).trim() !== '—' && String(r[26]).trim() !== '' && String(r[26]).trim().toLowerCase() !== 'not submitted'
        const isPostSubmitted = r[27] && String(r[27]).trim() !== '—' && String(r[27]).trim() !== '' && String(r[27]).trim().toLowerCase() !== 'not submitted'
        const pendingItems = []
        if (!isPreSubmitted) pendingItems.push('Pre-LTC Feedback')
        if (!isPostSubmitted) pendingItems.push('Post-LTC Feedback')

        return [
          i + 1,
          r[0] || '—',
          r[1] || '—',
          r[2] || '—',
          r[3] || '—',
          r[30] || '—',
          isPreSubmitted ? 'Submitted ' : 'Pending ',
          isPostSubmitted ? 'Submitted ' : 'Pending ',
          pendingItems.join(', ')
        ]
      }
    } else if (subView === 'marks') {
      reportTitle = 'PENDING ACTIVITY MARKS REPORT'
      filenameSuffix = 'Pending_Activity_Marks'
      columns = [
        'Sr. No.',
        'Student Name',
        'PRN',
        'Email',
        'Squad',
        'Panel',
        'Missing Pillars'
      ]
      getRowData = (r, i) => {
        const pillarNames = ['Agriculture', 'Physical', 'Leadership', 'Patriotism', 'Spirituality']
        const missing = []
          ;[r[20], r[21], r[22], r[23], r[24]].forEach((val, idx) => {
            if (!val || String(val).trim() === '—' || String(val).trim() === '') {
              missing.push(pillarNames[idx])
            }
          })
        return [
          i + 1,
          r[0] || '—',
          r[1] || '—',
          r[2] || '—',
          r[3] || '—',
          r[30] || '—',
          missing.length > 0 ? missing.join(', ') : 'Evaluation Pending'
        ]
      }
    } else if (subView === 'attendance') {
      reportTitle = 'PENDING ATTENDANCE REPORT'
      filenameSuffix = 'Pending_Attendance'
      columns = [
        'Sr. No.',
        'Student Name',
        'PRN',
        'Email',
        'Squad',
        'Panel',
        'Attendance Rate'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        r[25] || '0%'
      ]
    } else if (subView === 'service_feedback') {
      reportTitle = 'PENDING SERVICE & TRAINERS FEEDBACK REPORT'
      filenameSuffix = 'Pending_Service_Feedback'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'Service Feedback Status'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        'Pending (Not Submitted)'
      ]
    } else {
      reportTitle = 'PENDING SUBMISSIONS REPORT'
      filenameSuffix = 'Pending_Submissions'
      columns = [
        'Sr. No.',
        selectedRole === 'faculty' ? 'Faculty Name' : 'Student Name',
        selectedRole === 'faculty' ? 'Faculty ID' : 'PRN',
        'Email',
        'Squad',
        'Panel',
        'Pending Details'
      ]
      getRowData = (r, i) => [
        i + 1,
        r[0] || '—',
        r[1] || '—',
        r[2] || '—',
        r[3] || '—',
        r[30] || '—',
        'Pending'
      ]
    }

    const wsData = []
    wsData.push([reportTitle])
    wsData.push([`• Batch: ${batchName}`])
    wsData.push([`• Squad: ${selectedSquad}`])
    wsData.push([`• Role: ${selectedRole === 'faculty' ? 'Faculty' : 'Student'}`])
    wsData.push([`• Total Pending Count: ${pendingList.length}`])
    wsData.push([])
    wsData.push(columns)

    pendingList.forEach((r, i) => {
      wsData.push(getRowData(r, i))
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    const colWidths = columns.map((col, idx) => {
      let maxLen = String(col).length
      wsData.forEach(rowArr => {
        const valLen = String(rowArr[idx] || '').length
        if (valLen > maxLen) maxLen = valLen
      })
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) }
    })
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${filenameSuffix}_${selectedSquad}`)
    XLSX.writeFile(wb, `${filenameSuffix}_${selectedSquad}_report.xlsx`)
    showToast(`Pending list for ${subView} exported successfully! (${pendingList.length} users)`, 'success')
  }

  const handleFieldChange = async (userId, fieldName, colIdx, newValue, fieldLabel) => {
    if (!userId) {
      showToast('Invalid user record ID', 'error')
      return
    }

    const targetRow = studentData.find(r => r[29] === userId)
    const oldValue = targetRow ? targetRow[colIdx] : '—'
    const cleanNewVal = newValue && newValue !== '-- Select --' && newValue !== '-- Select Size --' ? String(newValue).trim() : ''

    // Optimistically update local state so table, counts, and exports reflect instantly
    setStudentData(prev => prev.map(r => {
      if (r[29] === userId) {
        const copy = [...r]
        copy[colIdx] = cleanNewVal || '—'
        return copy
      }
      return r
    }))

    const opKey = `${userId}_${fieldName}`
    try {
      setUpdatingFieldKey(opKey)
      if (fieldName === 'tshirt_size') setUpdatingTshirtId(userId)

      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const endpointPrefix = user.role === 'superadmin' ? 'superadmin' : 'admin'
      const res = await fetch(`${apiBase}/api/${endpointPrefix}/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [fieldName]: cleanNewVal || null })
      })

      const data = await res.json()
      if (res.ok) {
        showToast(`${fieldLabel} updated to ${cleanNewVal || 'Unspecified'}`, 'success')
      } else {
        // Revert on failure
        setStudentData(prev => prev.map(r => {
          if (r[29] === userId) {
            const copy = [...r]
            copy[colIdx] = oldValue
            return copy
          }
          return r
        }))
        showToast(data.message || `Failed to update ${fieldLabel}`, 'error')
      }
    } catch (err) {
      // Revert on error
      setStudentData(prev => prev.map(r => {
        if (r[29] === userId) {
          const copy = [...r]
          copy[colIdx] = oldValue
          return copy
        }
        return r
      }))
      showToast(`Error connecting to server to update ${fieldLabel}`, 'error')
    } finally {
      setUpdatingFieldKey(null)
      if (fieldName === 'tshirt_size') setUpdatingTshirtId(null)
    }
  }

  const handleSaveEditableCell = (userId, fieldName, colIdx, fieldLabel) => {
    handleFieldChange(userId, fieldName, colIdx, editingValue, fieldLabel)
    setEditingCell(null)
    setEditingValue('')
  }

  const handleCancelEditableCell = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const handleTshirtSizeChange = (userId, newSize) => {
    handleFieldChange(userId, 'tshirt_size', 7, newSize, 'T-Shirt size')
  }

  const TSHIRT_OPTIONS = [
    { value: '36 - S', label: '36 - S' },
    { value: '38 - M', label: '38 - M' },
    { value: '40 - L', label: '40 - L' },
    { value: '42 - XL', label: '42 - XL' },
    { value: '44 - XXL', label: '44 - XXL' },
    { value: '46 - XXXL', label: '46 - XXXL' },
  ]

  const YES_NO_OPTIONS = [
    { value: 'Yes', label: 'Yes' },
    { value: 'No', label: 'No' },
  ]

  const renderTshirtDropdown = (val, row) => {
    const userId = row?.[29]
    const rawVal = String(val || '').trim()
    const isUnset = !rawVal || rawVal === '—' || rawVal === 'N/A' || rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'undefined' || rawVal.toLowerCase() === 'not signed' || rawVal.toLowerCase() === 'unspecified' || rawVal === '-- Select Size --'
    const currentVal = isUnset ? '' : rawVal
    const isUpdating = updatingFieldKey === `${userId}_tshirt_size` || updatingTshirtId === userId

    if (!canEditField) {
      return isUnset ? (
        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Unspecified</span>
      ) : (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 8px',
          borderRadius: '4px',
          background: '#eff6ff',
          color: '#1e40af',
          fontSize: '12px',
          fontWeight: '600',
          border: '1px solid #bfdbfe'
        }}>
          {rawVal}
        </span>
      )
    }

    const hasCustomOption = currentVal && !TSHIRT_OPTIONS.some(o => o.value === currentVal)

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
        <select
          value={currentVal}
          disabled={isUpdating}
          onChange={(e) => handleTshirtSizeChange(userId, e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: '6px',
            border: currentVal ? '1px solid #93c5fd' : '1px solid #cbd5e1',
            background: currentVal ? '#eff6ff' : '#ffffff',
            color: currentVal ? '#1e40af' : '#64748b',
            outline: 'none',
            cursor: isUpdating ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            maxWidth: '135px'
          }}
        >
          <option value="" style={{ background: '#ffffff', color: '#64748b' }}>-- Select Size --</option>
          {TSHIRT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: '#ffffff', color: '#0f172a' }}>
              {opt.label}
            </option>
          ))}
          {hasCustomOption && (
            <option value={currentVal} style={{ background: '#ffffff', color: '#0f172a' }}>
              {currentVal}
            </option>
          )}
        </select>
        {isUpdating && <RefreshCw size={12} className="spinner-modern" style={{ color: '#224283' }} />}
      </div>
    )
  }

  const renderYesNoDropdown = (val, row, fieldName, colIdx, fieldLabel) => {
    const userId = row?.[29]
    const rawVal = String(val || '').trim()
    const isUnset = !rawVal || rawVal === '—' || rawVal === 'N/A' || rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'undefined' || rawVal.toLowerCase() === 'not provided' || rawVal.toLowerCase() === 'unspecified' || rawVal === '-- Select --'
    
    let currentVal = ''
    if (!isUnset) {
      const lower = rawVal.toLowerCase()
      if (lower === 'yes' || lower === 'true') currentVal = 'Yes'
      else if (lower === 'no' || lower === 'false') currentVal = 'No'
      else currentVal = rawVal
    }

    const isUpdating = updatingFieldKey === `${userId}_${fieldName}`

    if (!canEditField) {
      return isUnset ? (
        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Not Provided</span>
      ) : (
        renderBadge(currentVal)
      )
    }

    const isYes = currentVal === 'Yes'
    const isNo = currentVal === 'No'

    const hasCustomOption = currentVal && !YES_NO_OPTIONS.some(o => o.value === currentVal)

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
        <select
          value={currentVal}
          disabled={isUpdating}
          onChange={(e) => handleFieldChange(userId, fieldName, colIdx, e.target.value, fieldLabel)}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: '6px',
            border: isYes ? '1px solid #86efac' : isNo ? '1px solid #cbd5e1' : '1px solid #cbd5e1',
            background: isYes ? '#f0fdf4' : isNo ? '#f8fafc' : '#ffffff',
            color: isYes ? '#15803d' : isNo ? '#475569' : '#64748b',
            outline: 'none',
            cursor: isUpdating ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            minWidth: '95px'
          }}
        >
          <option value="" style={{ background: '#ffffff', color: '#64748b' }}>-- Select --</option>
          {YES_NO_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: '#ffffff', color: '#0f172a' }}>
              {opt.label}
            </option>
          ))}
          {hasCustomOption && (
            <option value={currentVal} style={{ background: '#ffffff', color: '#0f172a' }}>
              {currentVal}
            </option>
          )}
        </select>
        {isUpdating && <RefreshCw size={12} className="spinner-modern" style={{ color: '#224283' }} />}
      </div>
    )
  }

  const renderEditableTextCell = (val, row, fieldName, colIdx, fieldLabel, inputType = 'text', placeholder = '') => {
    const userId = row?.[29]
    const rawVal = String(val || '').trim()
    const isUnset = !rawVal || rawVal === '—' || rawVal === 'N/A' || rawVal.toLowerCase() === 'null' || rawVal.toLowerCase() === 'undefined'
    const isUpdating = updatingFieldKey === `${userId}_${fieldName}`
    const isEditing = editingCell && editingCell.userId === userId && editingCell.fieldName === fieldName

    if (!canEditField) {
      return (
        <span style={{ color: isUnset ? '#94a3b8' : '#475569', fontStyle: isUnset ? 'italic' : 'normal' }}>
          {isUnset ? '—' : rawVal}
        </span>
      )
    }

    if (isUpdating) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#224283', fontSize: '12px', fontWeight: '500' }}>
          <RefreshCw size={12} className="spinner-modern" />
          <span>Saving...</span>
        </div>
      )
    }

    if (isEditing) {
      return (
        <div
          className="editable-contact-cell-container"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', width: '100%', minWidth: '165px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            type={inputType}
            value={editingValue}
            placeholder={placeholder || `Enter ${fieldLabel}`}
            list={fieldName === 'emergency_contact_relation' ? 'relation-suggestions-list' : undefined}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSaveEditableCell(userId, fieldName, colIdx, fieldLabel)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                handleCancelEditableCell()
              }
            }}
            style={{
              flex: 1,
              minWidth: '100px',
              padding: '4px 8px',
              fontSize: '12px',
              borderRadius: '5px',
              border: '1.5px solid #224283',
              background: '#ffffff',
              color: '#0f172a',
              outline: 'none',
              boxShadow: '0 0 0 2px rgba(34, 66, 131, 0.1)'
            }}
          />
          <button
            type="button"
            title="Save (Enter)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSaveEditableCell(userId, fieldName, colIdx, fieldLabel)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              borderRadius: '5px',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            title="Cancel (Esc)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleCancelEditableCell}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              padding: 0,
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <X size={13} />
          </button>
        </div>
      )
    }

    return (
      <div
        onClick={(e) => {
          e.stopPropagation()
          setEditingCell({ userId, fieldName, colIdx, fieldLabel })
          setEditingValue(isUnset ? '' : rawVal)
        }}
        className="editable-contact-cell"
        title={`Click to edit ${fieldLabel}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '3px 6px',
          borderRadius: '5px',
          transition: 'all 0.15s ease',
          maxWidth: '100%',
          border: '1px dashed transparent'
        }}
      >
        <span style={{
          color: isUnset ? '#94a3b8' : '#0f172a',
          fontStyle: isUnset ? 'italic' : 'normal',
          fontSize: '12px',
          fontWeight: isUnset ? '400' : '500'
        }}>
          {isUnset ? 'Not provided' : rawVal}
        </span>
        <Edit2 size={11} className="contact-edit-icon" style={{ color: '#94a3b8', flexShrink: 0, opacity: isUnset ? 0.8 : 0.6 }} />
      </div>
    )
  }

  const renderBadge = (val) => {
    if (val === 'Yes') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 8px',
          borderRadius: '4px',
          background: '#f1f5f9',
          color: '#0f172a',
          fontSize: '11.5px',
          fontWeight: '600',
          border: '1px solid #cbd5e1'
        }}>
          Yes
        </span>
      )
    }
    if (val === 'No') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '3px 8px',
          borderRadius: '4px',
          background: '#f8fafc',
          color: '#64748b',
          fontSize: '11.5px',
          fontWeight: '600',
          border: '1px solid #cbd5e1'
        }}>
          No
        </span>
      )
    }
    return <span style={{ color: '#64748b', fontWeight: '500' }}>{val || '—'}</span>
  }

  const parseFeedbackPairs = useCallback((raw, category) => {
    return parseFeedbackForDisplay(raw, category)
  }, [])

  const renderFeedback = (val, studentId, category, row) => {
    if (!val || val === '—' || String(val).trim() === '') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: '600', border: '1px solid #cbd5e1' }}>
          Not Submitted
        </span>
      )
    }

    const rawVal = category === 'Service-Trainers' ? (row?.[33] || val) : val

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: '600', border: '1px solid #bbf7d0' }}>
          <CheckCircle size={11} style={{ color: '#16a34a' }} /> Submitted </span>
        <button
          type="button"
          onClick={() => setViewingFeedbackModal({
            studentName: row ? row[0] : 'Student',
            prn: row ? row[1] : '',
            squad: row ? row[3] : '',
            category,
            studentId,
            rawContent: rawVal
          })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid #224283',
            background: '#eff6ff',
            color: '#224283',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Eye size={12} /> View
        </button>
      </div>
    )
  }

  const undertakingPct = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.submittedUndertaking / stats.total) * 100);
  }, [stats]);

  const preLtcPct = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.submittedPreLtc / stats.total) * 100);
  }, [stats]);

  const postLtcPct = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.submittedPostLtc / stats.total) * 100);
  }, [stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        .modern-segmented-control {
          display: flex;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 3px;
          gap: 4px;
          border: 1px solid #cbd5e1;
          overflow-x: auto;
          white-space: nowrap;
          scrollbar-width: none;
        }
        .modern-segmented-control::-webkit-scrollbar {
          display: none;
        }
        .modern-segment-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: none;
          background: transparent;
          color: #475569;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .modern-segment-btn:hover {
          color: #0f172a;
          background: rgba(15, 23, 42, 0.04);
        }
        .modern-segment-btn.active {
          color: #ffffff;
          background: #224283;
        }

        .filter-input-modern {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 500;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          height: 36px;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .filter-input-modern:focus {
          border-color: #224283;
          box-shadow: 0 0 0 2px rgba(34, 66, 131, 0.12);
        }

        .modern-table-row {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.15s ease;
        }
        .modern-table-row:hover {
          background-color: #f8fafc !important;
        }

        .editable-contact-cell {
          cursor: pointer;
        }
        .editable-contact-cell:hover {
          background: #eff6ff !important;
          border-color: #bfdbfe !important;
        }
        .editable-contact-cell:hover .contact-edit-icon {
          color: #224283 !important;
          opacity: 1 !important;
        }

        .modern-stat-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          padding: 14px 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .spinner-modern {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .submission-table-wrapper {
          overflow-x: auto;
          max-width: 100%;
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 768px) {
          .submission-table th,
          .submission-table td {
            position: static !important;
            left: auto !important;
            box-shadow: none !important;
            z-index: auto !important;
          }
          .submission-table th:first-child {
            background: #f8fafc !important;
          }
          .submission-table td:first-child {
            background: inherit !important;
          }
        }
      `}</style>

      {/* Title & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: isMobile ? '17px' : '19px', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={isMobile ? 18 : 20} style={{ color: '#224283' }} /> {isMobile ? 'Submission' : 'Student Submission Dashboard'}
          </h2>
          {!isMobile && (
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
              Track and download undertaking forms, activity marks, Pre/Post feedback responses, and attendance.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={handleExportExcel}
            disabled={loading || studentData.length === 0}
            style={{
              flex: isMobile ? 1 : 'none',
              background: loading || studentData.length === 0 ? '#cbd5e1' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: loading || studentData.length === 0 ? 'not-allowed' : 'pointer',
              height: '36px',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={14} /> {
              subView === 'undertaking' ? 'Export Undertakings' :
                subView === 'tshirts' ? 'Export T-Shirt Sizes' :
                  subView === 'rooms' ? 'Export Room Allotments' :
                    subView === 'feedback' ? 'Export Feedback' :
                      subView === 'marks' ? 'Export Marks' :
                        subView === 'attendance' ? 'Export Attendance' :
                          'Export View'
            }
          </button>
          <button
            onClick={handleExportPendingExcel}
            disabled={loading || studentData.length === 0}
            style={{
              flex: isMobile ? 1 : 'none',
              background: loading || studentData.length === 0 ? '#cbd5e1' : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: loading || studentData.length === 0 ? 'not-allowed' : 'pointer',
              height: '36px',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={14} /> {
              subView === 'undertaking' ? 'Export Pending Undertakings' :
                subView === 'tshirts' ? 'Export Pending T-Shirt Sizes' :
                  subView === 'rooms' ? 'Export Pending Room Allotments' :
                    subView === 'feedback' ? 'Export Pending Feedback' :
                      subView === 'marks' ? 'Export Pending Marks' :
                        subView === 'attendance' ? 'Export Pending Attendance' :
                          'Export Pending List'
            }
          </button>
          <button
            onClick={fetchSubmissionData}
            style={{
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#224283',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              height: '36px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spinner-modern' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Selectors Card & Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Filter Card */}
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '12px' : '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>Choose Batch</label>
              <select value={selectedBatchId} onChange={e => setSelectedBatchId(e.target.value)} className="filter-input-modern">
                <option value="">-- Choose Batch --</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>Choose Squad</label>
              <select value={selectedSquad} onChange={e => setSelectedSquad(e.target.value)} className="filter-input-modern">
                <option value="All">All Squads</option>
                {['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'].map(s => <option key={s} value={s}>{s} Squad</option>)}
              </select>
            </div>
            {(subView === 'undertaking' || subView === 'tshirts' || subView === 'feedback' || subView === 'rooms') && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>User Type</label>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="filter-input-modern">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>
            )}
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '4px' }}>
                {selectedRole === 'faculty' ? 'Search Faculty' : 'Search Student'}
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input type="text" placeholder={selectedRole === 'faculty' ? 'Search faculty name/ID...' : 'Search student name/PRN...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="filter-input-modern" style={{ paddingLeft: '32px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          {/* Card 1: Total Enrolled */}
          <div className="modern-stat-card">
            <div>
              <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                {selectedRole === 'faculty' ? 'Total Faculty' : 'Total Students'}
              </span>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{stats.total}</div>
            </div>
          </div>

          {/* Card 2: Undertakings Completed */}
          <div className="modern-stat-card">
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Undertakings</span>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                {stats.submittedUndertaking} <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>/ {stats.total} ({undertakingPct}%)</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${undertakingPct}%`, height: '100%', background: '#224283', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
          </div>

          {/* Card 3: Pre-LTC Feedback Submitted */}
          <div className="modern-stat-card">
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Pre-LTC Feedback</span>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                {stats.submittedPreLtc} <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>/ {stats.total} ({preLtcPct}%)</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${preLtcPct}%`, height: '100%', background: '#0284c7', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
          </div>

          {/* Card 4: Post-LTC Feedback Submitted */}
          <div className="modern-stat-card">
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Post-LTC Feedback</span>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginTop: '2px', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                {stats.submittedPostLtc} <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>/ {stats.total} ({postLtcPct}%)</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', marginTop: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${postLtcPct}%`, height: '100%', background: '#64748b', transition: 'width 0.4s ease' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tab segmented switcher */}
      <div className="modern-segmented-control">
        <button className={`modern-segment-btn ${subView === 'undertaking' ? 'active' : ''}`} onClick={() => setSubView('undertaking')}>
          <ClipboardList size={14} /> Undertaking Data
        </button>
        <button className={`modern-segment-btn ${subView === 'tshirts' ? 'active' : ''}`} onClick={() => setSubView('tshirts')}>
          <CheckSquare size={14} /> T-Shirt Sizes
        </button>
        <button className={`modern-segment-btn ${subView === 'rooms' ? 'active' : ''}`} onClick={() => setSubView('rooms')}>
          <Home size={14} /> Room Allotment
        </button>
        <button className={`modern-segment-btn ${subView === 'feedback' ? 'active' : ''}`} onClick={() => setSubView('feedback')}>
          <MessageSquare size={14} /> Pre & Post Feedback
        </button>

        <button className={`modern-segment-btn ${subView === 'attendance' ? 'active' : ''}`}
          onClick={() => {
            setSubView('attendance')
            setSelectedRole('student')
          }}>
          <BookOpen size={14} /> Attendance Rate
        </button>

        <button className={`modern-segment-btn ${subView === 'service_feedback' ? 'active' : ''}`}
          onClick={() => {
            setSubView('service_feedback')
            setSelectedRole('student')
          }}>
          <Sparkles size={14} /> Service &amp; Trainee Feedback
        </button>
      </div>

      {/* T-Shirt Size Summary Banner */}
      {subView === 'tshirts' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#224283', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            T-Shirt Size Counts ({selectedRole === 'faculty' ? 'Faculty' : 'Students'})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(tshirtSizeCounts).map(([sz, count]) => (
              <div key={sz} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569' }}>Size {sz}:</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-view table rendering */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div className="submission-table-wrapper">
          <table className="submission-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                {activeViewConfig.columns.map((c, i) => (
                  <th key={i} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#475569',
                    position: i === 0 ? 'sticky' : 'static',
                    left: 0,
                    background: i === 0 ? '#f8fafc' : 'transparent',
                    zIndex: i === 0 ? 10 : 1,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeViewConfig.columns.length} style={{ padding: '30px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: '#64748b', fontWeight: '500', fontSize: '12.5px' }}>
                      <RefreshCw className="spinner-modern" size={16} />
                      Loading records, please wait...
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={activeViewConfig.columns.length} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontWeight: '500', fontSize: '12.5px' }}>
                    No matching records found for this squad/batch filters.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const mappedRow = activeViewConfig.mapRow(row)
                  return (
                    <tr key={index} className="modern-table-row" style={{
                      background: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                    }}>
                      {mappedRow.map((cell, cellIdx) => {
                        const colName = activeViewConfig.columns[cellIdx]
                        const isTshirtColumn = colName === 'T-Shirt Size'
                        const isJainFoodColumn = colName === 'Jain Food Required?'
                        const isMondayFastColumn = colName === 'Monday Fast?'
                        const isEmergencyNameColumn = colName === 'Emergency Contact Name'
                        const isEmergencyMobileColumn = colName === 'Emergency Contact Mobile'
                        const isEmergencyRelationColumn = colName === 'Emergency Contact Relation'
                        const isFeedbackColumn = colName === 'Pre-LTC Feedback' || colName === 'Post-LTC Feedback' || colName === 'Service & Trainers Feedback'
                        const isBadgeColumn = (subView === 'undertaking' && (colName === 'Undertaking Submitted' || colName === 'Parent Consent' || cell === 'Yes' || cell === 'No'))

                        return (
                          <td key={cellIdx} style={{
                            padding: '9px 14px',
                            fontWeight: cellIdx === 0 ? '600' : 'normal',
                            color: cellIdx === 0 ? '#0f172a' : '#475569',
                            position: cellIdx === 0 ? 'sticky' : 'static',
                            left: 0,
                            background: cellIdx === 0 ? (index % 2 === 0 ? '#ffffff' : '#fafbfc') : 'transparent',
                            zIndex: cellIdx === 0 ? 5 : 1,
                            verticalAlign: 'middle',
                            whiteSpace: isFeedbackColumn ? 'normal' : 'nowrap',
                            minWidth: isFeedbackColumn ? '320px' : isTshirtColumn ? '150px' : (isJainFoodColumn || isMondayFastColumn) ? '110px' : (isEmergencyNameColumn || isEmergencyMobileColumn || isEmergencyRelationColumn) ? '175px' : 'auto'
                          }}>
                            {isBadgeColumn ? (
                              renderBadge(cell)
                            ) : isTshirtColumn ? (
                              renderTshirtDropdown(cell, row)
                            ) : isJainFoodColumn ? (
                              renderYesNoDropdown(cell, row, 'jain_food', 8, 'Jain Food preference')
                            ) : isMondayFastColumn ? (
                              renderYesNoDropdown(cell, row, 'monday_fast', 9, 'Monday Fast preference')
                            ) : isEmergencyNameColumn ? (
                              renderEditableTextCell(cell, row, 'emergency_contact_name', 15, 'Emergency Contact Name', 'text', 'Contact Name')
                            ) : isEmergencyMobileColumn ? (
                              renderEditableTextCell(cell, row, 'emergency_contact_mobile', 16, 'Emergency Contact Mobile', 'tel', 'Mobile Number')
                            ) : isEmergencyRelationColumn ? (
                              renderEditableTextCell(cell, row, 'emergency_contact_relation', 17, 'Emergency Contact Relation', 'text', 'Relationship')
                            ) : isFeedbackColumn ? (
                              renderFeedback(
                                cell,
                                row[29],
                                colName === 'Pre-LTC Feedback' ? 'Pre-LTC' : (colName === 'Post-LTC Feedback' ? 'Post-LTC' : 'Service-Trainers'),
                                row
                              )
                            ) : (
                              cell === null || cell === undefined || String(cell).trim() === '' ? '—' : String(cell)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          <datalist id="relation-suggestions-list">
            <option value="Father" />
            <option value="Mother" />
            <option value="Parent" />
            <option value="Brother" />
            <option value="Sister" />
            <option value="Guardian" />
            <option value="Spouse" />
            <option value="Uncle" />
            <option value="Aunt" />
            <option value="Friend" />
          </datalist>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '10px 16px', flexWrap: 'wrap', gap: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
            Showing <strong style={{ color: '#0f172a' }}>{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</strong> to <strong style={{ color: '#0f172a' }}>{Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)}</strong> of <strong style={{ color: '#0f172a' }}>{filteredData.length}</strong> records
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, pageIdx) => {
              const pageNum = pageIdx + 1
              if (totalPages > 6 && Math.abs(pageNum - currentPage) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                if (pageNum === 2 || pageNum === totalPages - 1) {
                  return <span key={pageNum} style={{ padding: '2px 6px', color: '#94a3b8', fontWeight: '600', fontSize: '11px' }}>...</span>
                }
                return null
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    background: currentPage === pageNum ? '#224283' : '#ffffff',
                    color: currentPage === pageNum ? '#ffffff' : '#475569',
                    border: '1px solid ' + (currentPage === pageNum ? '#224283' : '#cbd5e1'),
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View Feedback Responses Modal */}
      {viewingFeedbackModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', background: '#224283', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} /> {viewingFeedbackModal.category} Feedback Responses
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
                  {viewingFeedbackModal.studentName} {viewingFeedbackModal.prn ? `(${viewingFeedbackModal.prn})` : ''} {viewingFeedbackModal.squad ? `• ${viewingFeedbackModal.squad} Squad` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingFeedbackModal(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#ffffff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', background: '#fafafa' }}>
              {parseFeedbackPairs(viewingFeedbackModal.rawContent, viewingFeedbackModal.category).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                  No response data recorded.
                </div>
              ) : (
                parseFeedbackPairs(viewingFeedbackModal.rawContent, viewingFeedbackModal.category).map((pair, pIdx) => (
                  <div key={pIdx} style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ background: '#eff6ff', color: '#1e40af', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', flexShrink: 0 }}>Q{pIdx + 1}</span>
                      <span>{pair.question}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #224283', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {pair.answer || '—'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleDownloadFeedbackPdf(viewingFeedbackModal.studentId, viewingFeedbackModal.category)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                <Download size={13} /> Download PDF
              </button>

              <button
                type="button"
                onClick={() => setViewingFeedbackModal(null)}
                style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: '#0f172a', color: '#ffffff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
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
