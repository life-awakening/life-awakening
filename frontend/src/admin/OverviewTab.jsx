import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  Users, GraduationCap, Layers, Calendar, Activity, FileText,
  ShieldAlert, Home, AlertOctagon, Mail, AlertTriangle, ShieldCheck,
  Check, RefreshCw, Sparkles, TrendingUp, Award, Search, BookOpen, Shield, Download, X, UserX, MessageSquare,
  Star, CheckCircle2, Compass, Heart, Coffee, FileSpreadsheet, Table
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LabelList,
  CartesianGrid
} from 'recharts'

function DonutProgressRing({
  submitted = 0,
  total = 0,
  color = '#2563eb',
  label = 'Submitted',
  size = 94,
  strokeWidth = 8.5,
  title = ''
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeSubmitted = Math.max(0, Math.min(Number(submitted) || 0, safeTotal > 0 ? safeTotal : Number(submitted) || 0));
  const pct = safeTotal > 0 ? Math.round((safeSubmitted / safeTotal) * 100) : (safeSubmitted > 0 ? 100 : 0);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div
      style={{ position: 'relative', width: `${size}px`, height: `${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      title={`${title ? title + ': ' : ''}${safeSubmitted} / ${safeTotal} (${pct}%)`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        lineHeight: 1
      }}>
        <div style={{ fontSize: '18px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          {pct}%
        </div>
        <div style={{ fontSize: '8.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', marginTop: '3px', fontFamily: 'system-ui' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

const SQUAD_ORDER = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']
const getSquadRank = (sq) => {
  const clean = String(sq || '').trim()
  const idx = SQUAD_ORDER.findIndex(s => s.toLowerCase() === clean.toLowerCase())
  return idx !== -1 ? idx : 999
}

const sizeMapNumToLetter = {
  '36': 'S',
  '38': 'M',
  '40': 'L',
  '42': 'XL',
  '44': 'XXL',
  '46': 'XXXL'
}

const sizeMapLetterToNum = {
  'S': '36',
  'M': '38',
  'L': '40',
  'XL': '42',
  'XXL': '44',
  '2XL': '44',
  'XXXL': '46',
  '3XL': '46'
}

function parseTshirtSize(raw) {
  if (!raw || typeof raw !== 'string') {
    return { letterSize: '—', numericSize: '—' }
  }
  const str = raw.trim()
  if (!str || str === '—' || str === 'Not Specified') {
    return { letterSize: '—', numericSize: '—' }
  }

  let numericSize = null
  let letterSize = null

  const numMatch = str.match(/\b(36|38|40|42|44|46)\b/)
  if (numMatch) {
    numericSize = numMatch[1]
  }

  const letterMatch = str.match(/\b(XXXL|3XL|XXL|2XL|XL|L|M|S)\b/i)
  if (letterMatch) {
    letterSize = letterMatch[1].toUpperCase()
    if (letterSize === '2XL') letterSize = 'XXL'
    if (letterSize === '3XL') letterSize = 'XXXL'
  }

  if (numericSize && !letterSize) {
    letterSize = sizeMapNumToLetter[numericSize] || '—'
  } else if (letterSize && !numericSize) {
    numericSize = sizeMapLetterToNum[letterSize] || '—'
  }

  return {
    letterSize: letterSize || '—',
    numericSize: numericSize || '—'
  }
}

export default function OverviewTab({ token, apiBase, user, isMobile: propIsMobile, showToast, batches, selectedBatchId, setSelectedBatchId }) {
  const [overviewMode, setOverviewMode] = useState('executive') // 'executive' or 'cohort'

  const [isMobileWindow, setIsMobileWindow] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  useEffect(() => {
    const handleResize = () => setIsMobileWindow(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = propIsMobile !== undefined ? propIsMobile : isMobileWindow;
  const isReadonly = user?.role === 'superadmin_readonly';
  const graphColors = [
    { primary: '#2563eb', light: '#eff6ff', border: '#bfdbfe' }
  ];
  const [execStats, setExecStats] = useState(null)
  const [execGraphs, setExecGraphs] = useState(null)
  const [loadingExec, setLoadingExec] = useState(true)
  const [overviewStudentSearch, setOverviewStudentSearch] = useState('')
  const [overviewFacultySearch, setOverviewFacultySearch] = useState('')
  const [overviewLtcSearch, setOverviewLtcSearch] = useState('')
  const [overviewAbsenteeSearch, setOverviewAbsenteeSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [absenteePage, setAbsenteePage] = useState(1)
  const itemsPerPage = 15

  const [absenteesData, setAbsenteesData] = useState([])
  const [loadingAbsentees, setLoadingAbsentees] = useState(false)
  const [batchSummary, setBatchSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [downloadingOption, setDownloadingOption] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [selectedDownloadOption, setSelectedDownloadOption] = useState('attendance')
  const [modalSelectedBatchId, setModalSelectedBatchId] = useState('')
  const [attendanceFormat, setAttendanceFormat] = useState('squad')
  const [studentListFormat, setStudentListFormat] = useState('all')
  const [activityFilter, setActivityFilter] = useState('all') // 'all', 'onboarding', 'activities'
  const [showSquadSummaryCard, setShowSquadSummaryCard] = useState(false)
  const [squadSummaryData, setSquadSummaryData] = useState(null)
  const [loadingSquadSummary, setLoadingSquadSummary] = useState(false)
  const [downloadingBatchSummaryPdf, setDownloadingBatchSummaryPdf] = useState(false)
  const [selectedLeaderDetails, setSelectedLeaderDetails] = useState(null)
  const [summaryViewMode, setSummaryViewMode] = useState('activity') // 'activity' (default) or 'squad'

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
  };

  const serviceFeedbackData = useMemo(() => {
    if (batchSummary?.graphs?.serviceFeedbackAnalytics && batchSummary.graphs.serviceFeedbackAnalytics.totalSubmissions > 0) {
      return batchSummary.graphs.serviceFeedbackAnalytics;
    }

    // Frontend fallback calculation from students array
    const students = batchSummary?.students || [];
    let totalServiceSubmissions = 0;
    const pillarScores = {
      agriculture: { name: 'Agriculture & Nature', sum: 0, count: 0, color: '#16a34a' },
      sports_physical: { name: 'Sports & Fitness', sum: 0, count: 0, color: '#0284c7' },
      team_leadership: { name: 'Team & Leadership', sum: 0, count: 0, color: '#d97706' },
      patriotism_nation: { name: 'Patriotism & Nation', sum: 0, count: 0, color: '#dc2626' },
      spirituality_peace: { name: 'Spirituality & Peace', sum: 0, count: 0, color: '#7c3aed' }
    };
    const trainerDimensions = {
      knowledge_expertise: { name: 'Subject Knowledge', sum: 0, count: 0 },
      communication_clarity: { name: 'Communication Clarity', sum: 0, count: 0 },
      interaction_involvement: { name: 'Student Interaction', sum: 0, count: 0 },
      discipline_punctuality: { name: 'Discipline & Punctuality', sum: 0, count: 0 },
      training_methods: { name: 'Training Methods', sum: 0, count: 0 }
    };
    const facilitiesScores = {
      boarding_lodging: { name: 'Boarding & Lodging', sum: 0, count: 0 },
      food_dining: { name: 'Food & Dining', sum: 0, count: 0 },
      medical_support: { name: 'Medical Support', sum: 0, count: 0 },
      ltc_team_coordinator: { name: 'Squad Coordinator Support', sum: 0, count: 0 },
      overall_support_service: { name: 'Overall Staff Support', sum: 0, count: 0 }
    };
    const arrivalScores = {
      welcome_reception: { name: 'Welcome & Reception', sum: 0, count: 0 },
      security_bag_checking: { name: 'Security & Bag Check', sum: 0, count: 0 },
      mobile_deposit_combat_dress: { name: 'Uniform & Mobile Deposit', sum: 0, count: 0 },
      briefing_orientation: { name: 'Orientation & Briefing', sum: 0, count: 0 }
    };
    const activityScores = {
      guest_lecture: { name: 'Guest Lecture', sum: 0, count: 0 },
      debate: { name: 'Debate', sum: 0, count: 0 },
      quiz: { name: 'Quiz', sum: 0, count: 0 },
      movie_reflection: { name: 'Movie Reflection', sum: 0, count: 0 },
      cultural_program: { name: 'Cultural Night', sum: 0, count: 0 }
    };
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let allRatingsSum = 0;
    let allRatingsCount = 0;

    students.forEach(s => {
      if (!s.service_feedback_text) return;
      try {
        const parsed = typeof s.service_feedback_text === 'string' ? JSON.parse(s.service_feedback_text) : s.service_feedback_text;
        if (!parsed) return;
        totalServiceSubmissions++;

        const tally = (val, targetObj, key) => {
          const num = Number(val);
          if (num >= 1 && num <= 5) {
            targetObj[key].sum += num;
            targetObj[key].count++;
            ratingDistribution[num] = (ratingDistribution[num] || 0) + 1;
            allRatingsSum += num;
            allRatingsCount++;
          }
        };

        if (parsed.arrival_orientation) {
          Object.keys(arrivalScores).forEach(k => {
            if (parsed.arrival_orientation[k]) tally(parsed.arrival_orientation[k], arrivalScores, k);
          });
        }
        if (parsed.activity_based) {
          Object.keys(activityScores).forEach(k => {
            if (parsed.activity_based[k]) tally(parsed.activity_based[k], activityScores, k);
          });
        }
        if (parsed.facilities_admin) {
          Object.keys(facilitiesScores).forEach(k => {
            if (parsed.facilities_admin[k]) tally(parsed.facilities_admin[k], facilitiesScores, k);
          });
        }
        if (parsed.trainers) {
          Object.keys(pillarScores).forEach(pk => {
            const pData = parsed.trainers[pk];
            if (pData) {
              Object.keys(trainerDimensions).forEach(dk => {
                if (pData[dk]) {
                  const num = Number(pData[dk]);
                  if (num >= 1 && num <= 5) {
                    pillarScores[pk].sum += num;
                    pillarScores[pk].count++;
                    trainerDimensions[dk].sum += num;
                    trainerDimensions[dk].count++;
                    ratingDistribution[num] = (ratingDistribution[num] || 0) + 1;
                    allRatingsSum += num;
                    allRatingsCount++;
                  }
                }
              });
            }
          });
        }
      } catch (e) { }
    });

    const formatAvgList = (obj) => Object.entries(obj).map(([k, v]) => ({
      key: k,
      name: v.name,
      avg: v.count > 0 ? parseFloat((v.sum / v.count).toFixed(2)) : 0,
      count: v.count,
      color: v.color
    }));

    return {
      totalSubmissions: totalServiceSubmissions,
      overallAverage: allRatingsCount > 0 ? parseFloat((allRatingsSum / allRatingsCount).toFixed(2)) : 0,
      pillars: formatAvgList(pillarScores),
      trainerDimensions: formatAvgList(trainerDimensions),
      facilities: formatAvgList(facilitiesScores),
      arrival: formatAvgList(arrivalScores),
      activities: formatAvgList(activityScores),
      ratingDistribution: [
        { name: '5-Star (Excellent)', rating: 5, value: ratingDistribution[5], color: '#16a34a' },
        { name: '4-Star (Very Good)', rating: 4, value: ratingDistribution[4], color: '#2563eb' },
        { name: '3-Star (Good)', rating: 3, value: ratingDistribution[3], color: '#d97706' },
        { name: '2-Star (Fair)', rating: 2, value: ratingDistribution[2], color: '#ea580c' },
        { name: '1-Star (Poor)', rating: 1, value: ratingDistribution[1], color: '#dc2626' }
      ]
    };
  }, [batchSummary]);

  const handleDownloadBatchSummaryPdf = async (targetBatchId) => {
    const batchIdToUse = targetBatchId || selectedBatchId || modalSelectedBatchId;
    if (!batchIdToUse) {
      if (showToast) showToast('Please select a batch first.', 'warning');
      return;
    }
    const targetBatch = (batches || []).find(b => String(b.id) === String(batchIdToUse));
    const rawBatchName = targetBatch ? (targetBatch.name || `Batch_${targetBatch.id}`) : (batchSummary?.batch?.name || `Batch_${batchIdToUse}`);
    const cleanBatchName = rawBatchName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

    setDownloadingBatchSummaryPdf(true);
    console.log('%c[SUPERADMIN OVERVIEW DEBUG] Downloading batch summary PDF for batchId:', 'color: #002B73; font-weight: bold;', batchIdToUse, {
      batchName: rawBatchName
    });
    try {
      if (showToast) showToast('Generating Overall Batch Summary PDF report...', 'info');
      const rolePrefix = user?.role === 'admin' ? 'admin' : 'superadmin';
      const response = await fetch(`${apiBase}/api/${rolePrefix}/batch-summary-pdf/${batchIdToUse}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('%c[SUPERADMIN OVERVIEW DEBUG] Batch Summary PDF response status:', 'color: #16a34a; font-weight: bold;', response.status);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to generate Batch Summary PDF');
      }

      const blob = await response.blob();
      console.log('%c[SUPERADMIN OVERVIEW DEBUG] Batch Summary PDF size in bytes:', 'color: #16a34a; font-weight: bold;', blob.size);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LTC_Overall_Batch_Summary_${cleanBatchName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      if (showToast) showToast('Overall Batch Summary PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('%c[SUPERADMIN OVERVIEW ERROR] Error downloading batch summary PDF:', 'color: #dc2626; font-weight: bold;', err);
      if (showToast) showToast(err.message || 'Failed to generate Batch Summary PDF', 'error');
    } finally {
      setDownloadingBatchSummaryPdf(false);
    }
  };

  const handleOpenDownloadModal = () => {
    const active = (batches || []).find(b => b.status === 'active') || (batches || [])[0]
    setModalSelectedBatchId(active ? String(active.id) : '')
    setSelectedDownloadOption('attendance')
    setAttendanceFormat('squad')
    setStudentListFormat('all')
    setShowDownloadModal(true)
  }

  const handleExecuteUnifiedDownload = async () => {
    if (downloadingOption) return

    const requiresBatch = ['attendance', 'students', 'ltc', 'tshirt', 'rooms', 'food_preferences', 'service_feedback', 'batch_summary_pdf'].includes(selectedDownloadOption)
    if (requiresBatch && !modalSelectedBatchId) {
      if (showToast) showToast('Please select a batch first.', 'warning')
      return
    }

    const targetBatch = (batches || []).find(b => String(b.id) === String(modalSelectedBatchId))
    const batchName = targetBatch ? (targetBatch.name || `Batch_${targetBatch.id}`) : (batchSummary?.batch?.name || 'Active_Batch')
    const sanitizedBatchName = batchName.replace(/\s+/g, '_')

    setDownloadingOption(true)
    try {
      if (selectedDownloadOption === 'batch_summary_pdf') {
        await handleDownloadBatchSummaryPdf(modalSelectedBatchId)
      } else if (selectedDownloadOption === 'attendance') {
        // 1. Download Attendance (Squad-wise or Panel-wise ERP attendance)
        const response = await fetch(`${apiBase}/api/admin/batches/${targetBatch.id}/attendance-erp-excel?format=${attendanceFormat}`, {
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
          const sanitizeName = (targetBatch.name || 'Batch').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
          const formatLabel = attendanceFormat === 'panel' ? 'Panel_Wise' : 'Squad_Wise'
          filename = `Attendance_${formatLabel}_${sanitizeName}_${dateStr}.xlsx`
        }

        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        if (showToast) showToast(`Attendance (${attendanceFormat === 'panel' ? 'Panel-wise' : 'Squad-wise'}) Excel downloaded successfully.`, 'success')
      } else {
        // Always fetch fresh batch data so exports reflect latest edits made across tabs
        let batchData = batchSummary
        if (requiresBatch && targetBatch) {
          try {
            const res = await fetch(`${apiBase}/api/superadmin/analytics/batch-summary?batchId=${targetBatch.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            if (res.ok) {
              batchData = await res.json()
            }
          } catch (e) {
            console.warn('Could not fetch fresh batch-summary, falling back to local state', e)
          }
        }

        if (selectedDownloadOption === 'students') {
          // 2. Download Student List (Support Full Roster, Squad-wise Ascending, Panel-wise Ascending)
          const rawList = batchData?.students || []
          if (rawList.length === 0) {
            if (showToast) showToast('No students found in the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }

          let studentList = [...rawList]
          let formatLabel = 'Full_Roster'

          if (studentListFormat === 'squad') {
            formatLabel = 'Squad_Wise'
            studentList.sort((a, b) => {
              const rankA = getSquadRank(a.squad)
              const rankB = getSquadRank(b.squad)
              if (rankA !== rankB) return rankA - rankB
              const squadCmp = String(a.squad || '').localeCompare(String(b.squad || ''), undefined, { numeric: true, sensitivity: 'base' })
              if (squadCmp !== 0) return squadCmp
              return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
            })
          } else if (studentListFormat === 'panel') {
            formatLabel = 'Panel_Wise'
            studentList.sort((a, b) => {
              const panelA = String(a.panel || 'Unassigned').trim()
              const panelB = String(b.panel || 'Unassigned').trim()
              const panelCmp = panelA.localeCompare(panelB, undefined, { numeric: true, sensitivity: 'base' })
              if (panelCmp !== 0) return panelCmp
              return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
            })
          } else {
            studentList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }))
          }

          const exportData = studentList.map((s, idx) => ({
            'S.No.': idx + 1,
            'PRN': s.prn || '—',
            'Student Name': s.name || '—',
            'Email Address': s.email || '—',
            'Contact Phone': s.phone || '—',
            'Gender': s.gender || '—',
            'Division': s.division || '—',
            'School': s.school || '—',
            'Faculty / Department': s.faculty || s.department || '—',
            'Panel': s.panel || 'Unassigned',
            'Squads': s.squad || 'Unassigned',
            'Room No.': s.room || 'Unassigned',
            'Undertaking Status': s.undertaking_submitted ? 'Submitted' : 'Pending'
          }))
          const ws = XLSX.utils.json_to_sheet(exportData)
          ws['!cols'] = [
            { wch: 6 }, { wch: 16 }, { wch: 25 }, { wch: 28 }, { wch: 15 },
            { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 25 }, { wch: 12 }, { wch: 18 },
            { wch: 14 }, { wch: 18 }
          ]
          const wb = XLSX.utils.book_new()
          const sheetName = studentListFormat === 'squad' ? 'Squad-wise Roster' : (studentListFormat === 'panel' ? 'Panel-wise Roster' : 'Student Roster')
          XLSX.utils.book_append_sheet(wb, ws, sheetName)
          XLSX.writeFile(wb, `Student_List_${formatLabel}_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast(`Student list (${studentListFormat === 'panel' ? 'Panel-wise' : (studentListFormat === 'squad' ? 'Squad-wise' : 'All Students')}) downloaded successfully!`, 'success')

        } else if (selectedDownloadOption === 'ltc') {
          // 3. Download LTC Coordinators for selected batch (exports squad-assigned LTC coordinators)
          const ltcList = (batchData?.faculty || []).filter(f =>
            (f.role === 'ltc_member' || f.role === 'faculty') && Boolean(f.squad && f.squad.trim() !== '' && f.squad !== 'Unassigned' && f.squad !== 'All Squads' && f.squad !== 'Spare')
          ).sort((a, b) => {
            const rankA = getSquadRank(a.squad)
            const rankB = getSquadRank(b.squad)
            if (rankA !== rankB) return rankA - rankB
            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
          })
          if (ltcList.length === 0) {
            if (showToast) showToast('No LTC coordinators with assigned squads found in the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }
          const exportData = ltcList.map((f, idx) => ({
            'S.No.': idx + 1,
            'LTC Coordinator Name': f.name || '—',
            'Email Address': f.email || '—',
            'Contact Phone': f.phone || '—',
            'Assigned Squad': f.squad || '—',
            'Batch Name': targetBatch?.name || batchData?.batch?.name || 'Active Batch'
          }))
          const ws = XLSX.utils.json_to_sheet(exportData)
          ws['!cols'] = [
            { wch: 6 }, { wch: 25 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 20 }
          ]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'LTC Coordinators')
          XLSX.writeFile(wb, `LTC_Coordinators_Squad_List_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast('LTC Coordinators squad list downloaded successfully!', 'success')

        } else if (selectedDownloadOption === 'tshirt') {
          // 4. Download T-Shirt Sizes (Headers: Sr. No | Squad Name | PRN | Student Name | Size | Application T-Shirt Size)
          const studentList = batchData?.students || []
          if (studentList.length === 0) {
            if (showToast) showToast('No student T-shirt records found for the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }

          // Parse each student's T-shirt size into distinct letterSize and numericSize
          const parsedStudents = studentList.map(s => {
            const parsed = parseTshirtSize(s.tshirt_size)
            return {
              ...s,
              letterSize: parsed.letterSize,
              numericSize: parsed.numericSize
            }
          })

          // Compute size summary breakdown based on letter sizes
          const sizeCounts = {}
          let totalCount = 0
          parsedStudents.forEach(s => {
            const sz = s.letterSize !== '—' ? s.letterSize : 'Not Specified'
            sizeCounts[sz] = (sizeCounts[sz] || 0) + 1
            totalCount++
          })

          // Sort size summary logically: standard letter sizes (S, M, L, XL, XXL, XXXL) first
          const standardOrder = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']
          const sortedSizeKeys = Object.keys(sizeCounts).sort((a, b) => {
            const idxA = standardOrder.indexOf(a.toUpperCase())
            const idxB = standardOrder.indexOf(b.toUpperCase())
            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            if (a === 'Not Specified') return 1
            if (b === 'Not Specified') return -1
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          })

          // Sort students squad-wise (Mitra before Martand per SQUAD_ORDER) then name-wise
          const sortedStudents = [...parsedStudents].sort((a, b) => {
            const rankA = getSquadRank(a.squad)
            const rankB = getSquadRank(b.squad)
            if (rankA !== rankB) return rankA - rankB
            const sqA = String(a.squad || '').trim()
            const sqB = String(b.squad || '').trim()
            const sqCmp = sqA.localeCompare(sqB, undefined, { numeric: true, sensitivity: 'base' })
            if (sqCmp !== 0) return sqCmp
            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
          })

          // Build clean two-column summary table followed by exact student roster columns
          const aoa = [
            ['T-Shirt Size Summary'],
            ['Size', 'Quantity']
          ]

          sortedSizeKeys.forEach(sz => {
            aoa.push([sz, Number(sizeCounts[sz])])
          })

          aoa.push(['Total', totalCount])
          aoa.push([]) // Blank row separator
          aoa.push(['Sr. No', 'Squad Name', 'PRN', 'Student Name', 'Size', 'Application T-Shirt Size'])

          sortedStudents.forEach((s, idx) => {
            aoa.push([
              idx + 1,
              s.squad || 'Unassigned',
              s.prn || '—',
              s.name || '—',
              s.letterSize,
              s.numericSize
            ])
          })

          const ws = XLSX.utils.aoa_to_sheet(aoa)
          ws['!cols'] = [
            { wch: 8 },
            { wch: 20 },
            { wch: 18 },
            { wch: 30 },
            { wch: 10 },
            { wch: 26 }
          ]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'T-Shirt Sizes')
          XLSX.writeFile(wb, `TShirt_Sizes_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast('T-Shirt size distribution report downloaded successfully!', 'success')

        } else if (selectedDownloadOption === 'rooms') {
          // 5. Download Room Allocation (Clean simple export: S.No. | Squad | Student Name | Room No.)
          const studentList = batchData?.students || []
          if (studentList.length === 0) {
            if (showToast) showToast('No room allocation records found for the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }

          // Sort students squad-wise (Mitra before Martand per SQUAD_ORDER), then room-wise, then name-wise
          const sortedStudents = [...studentList].sort((a, b) => {
            const rankA = getSquadRank(a.squad)
            const rankB = getSquadRank(b.squad)
            if (rankA !== rankB) return rankA - rankB
            const sqA = String(a.squad || '').trim()
            const sqB = String(b.squad || '').trim()
            const sqCmp = sqA.localeCompare(sqB, undefined, { numeric: true, sensitivity: 'base' })
            if (sqCmp !== 0) return sqCmp

            const rmA = String(a.room || '').trim()
            const rmB = String(b.room || '').trim()
            const rmCmp = rmA.localeCompare(rmB, undefined, { numeric: true, sensitivity: 'base' })
            if (rmCmp !== 0) return rmCmp

            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
          })

          const exportData = sortedStudents.map((s, idx) => ({
            'S.No.': idx + 1,
            'Squad': s.squad || 'Unassigned',
            'PRN': s.prn || '—',
            'Student Name': s.name || '—',
            'Room No.': s.room || 'Unassigned'
          }))

          const ws = XLSX.utils.json_to_sheet(exportData)
          ws['!cols'] = [
            { wch: 8 },
            { wch: 22 },
            { wch: 16 },
            { wch: 28 },
            { wch: 18 }
          ]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Room Allocation')
          XLSX.writeFile(wb, `Room_Allocation_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast('Room allocation report downloaded successfully!', 'success')

        } else if (selectedDownloadOption === 'food_preferences') {
          // 6. Download Food Preferences (Clean squad-grouped dietary preferences)
          const studentList = batchData?.students || []
          if (studentList.length === 0) {
            if (showToast) showToast('No student food preference records found for the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }

          // Sort students squad-wise (per standard SQUAD_ORDER), then name-wise
          const sortedStudents = [...studentList].sort((a, b) => {
            const rankA = getSquadRank(a.squad)
            const rankB = getSquadRank(b.squad)
            if (rankA !== rankB) return rankA - rankB
            const sqA = String(a.squad || '').trim()
            const sqB = String(b.squad || '').trim()
            const sqCmp = sqA.localeCompare(sqB, undefined, { numeric: true, sensitivity: 'base' })
            if (sqCmp !== 0) return sqCmp

            return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
          })

          const formatVal = (val, undertakingSubmitted) => {
            if (val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== '—') {
              const str = String(val).trim().toLowerCase()
              if (str === 'yes' || str === 'true' || val === true) return 'Yes'
              if (str === 'no' || str === 'false' || val === false) return 'No'
              return String(val).trim()
            }
            return undertakingSubmitted ? 'No' : 'Not Provided'
          }

          let totalJainCount = 0
          let totalMondayFastCount = 0

          const studentRows = sortedStudents.map((s, idx) => {
            const jainVal = formatVal(s.jain_food, s.undertaking_submitted)
            const fastVal = formatVal(s.monday_fast, s.undertaking_submitted)

            if (jainVal === 'Yes') totalJainCount++
            if (fastVal === 'Yes') totalMondayFastCount++

            return [
              idx + 1,
              s.name || '—',
              s.prn || '—',
              s.squad || 'Unassigned',
              s.panel || 'Unassigned',
              jainVal,
              fastVal
            ]
          })

          const aoa = [
            ['FOOD PREFERENCES REPORT'],
            [`• Total Jain Food Students: ${totalJainCount}`],
            [`• Total Monday Fast Students: ${totalMondayFastCount}`],
            [],
            ['S.No.', 'Student Name', 'PRN', 'Squad', 'Panel', 'Jain Food Required', 'Monday Fast'],
            ...studentRows
          ]

          const ws = XLSX.utils.aoa_to_sheet(aoa)
          ws['!cols'] = [
            { wch: 8 },
            { wch: 28 },
            { wch: 18 },
            { wch: 18 },
            { wch: 16 },
            { wch: 22 },
            { wch: 18 }
          ]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Food Preferences')
          XLSX.writeFile(wb, `Food_Preferences_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast('Food preferences report downloaded successfully!', 'success')

        } else if (selectedDownloadOption === 'service_feedback') {
          // 7. Download Service & Trainers Feedback
          const rolePrefix = user?.role === 'admin' ? 'admin' : 'superadmin'
          const batchIdToFetch = modalSelectedBatchId || targetBatch?.id || selectedBatchId
          const res = await fetch(`${apiBase}/api/${rolePrefix}/reports/service-feedback?batch_id=${batchIdToFetch}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (!res.ok) throw new Error('Failed to fetch service feedback data.')
          const reportJson = await res.json()
          const columns = reportJson.columns || []
          const rows = reportJson.data || []

          if (rows.length === 0) {
            if (showToast) showToast('No student records found for the selected batch.', 'warning')
            setDownloadingOption(false)
            return
          }

          const squadColIdx = columns.findIndex(c => String(c).toLowerCase() === 'squad' || String(c).toLowerCase().includes('squad'))
          let sortedFeedbackRows = [...rows]
          if (squadColIdx !== -1) {
            sortedFeedbackRows.sort((a, b) => {
              const sqA = a[squadColIdx]
              const sqB = b[squadColIdx]
              const rankA = getSquadRank(sqA)
              const rankB = getSquadRank(sqB)
              if (rankA !== rankB) return rankA - rankB
              const squadCmp = String(sqA || '').localeCompare(String(sqB || ''), undefined, { numeric: true, sensitivity: 'base' })
              if (squadCmp !== 0) return squadCmp
              return String(a[0] || '').localeCompare(String(b[0] || ''), undefined, { numeric: true, sensitivity: 'base' })
            })
          }

          const exportData = sortedFeedbackRows.map((r, idx) => {
            const rowObj = { 'S.No.': idx + 1 }
            columns.forEach((col, cIdx) => {
              rowObj[col] = r[cIdx] !== undefined && r[cIdx] !== null && String(r[cIdx]).trim() !== '' ? r[cIdx] : '—'
            })
            return rowObj
          })

          const ws = XLSX.utils.json_to_sheet(exportData)
          ws['!cols'] = [
            { wch: 8 },
            ...columns.map(c => ({ wch: Math.min(Math.max(String(c).length + 4, 14), 45) }))
          ]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Service Feedback')
          XLSX.writeFile(wb, `Service_Feedback_${sanitizedBatchName}.xlsx`)
          if (showToast) showToast('Service feedback report downloaded successfully!', 'success')
        }
      }
    } catch (err) {
      console.error(err)
      if (showToast) showToast(err.message || 'Failed to download report.', 'error')
    } finally {
      setDownloadingOption(false)
    }
  }

  const fetchExecutiveDashboard = async () => {
    if (!token) return
    try {
      setLoadingExec(true)
      const res = await fetch(`${apiBase}/api/superadmin/analytics/executive-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setExecStats(data.stats)
        setExecGraphs(data.graphs)
      }
    } catch (err) {
      console.error('Error loading executive dashboard:', err)
    } finally {
      setLoadingExec(false)
    }
  }

  const fetchBatchSummary = async () => {
    if (!token || !selectedBatchId) return
    try {
      setLoadingSummary(true)
      const res = await fetch(`${apiBase}/api/superadmin/analytics/batch-summary?batchId=${selectedBatchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setBatchSummary(data)
      }
    } catch (err) {
      showToast('Failed to load batch summary data', 'error')
    } finally {
      setLoadingSummary(false)
    }
  }

  const fetchAbsentees = async (batchId) => {
    if (!token || !batchId) return
    try {
      setLoadingAbsentees(true)
      const res = await fetch(`${apiBase}/api/admin/batches/${batchId}/absentees-snapshot`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const snapData = await res.json()
        if (snapData.exists && snapData.snapshot && Array.isArray(snapData.snapshot.students)) {
          const absentStudents = snapData.snapshot.students.filter(s => s.is_absent || String(s.status).toLowerCase() === 'absent')
          setAbsenteesData(absentStudents)
        } else if (Array.isArray(snapData.liveAbsentees)) {
          setAbsenteesData(snapData.liveAbsentees)
        } else {
          setAbsenteesData([])
        }
      } else {
        setAbsenteesData([])
      }
    } catch (err) {
      console.error('Error fetching absentees data:', err)
      setAbsenteesData([])
    } finally {
      setLoadingAbsentees(false)
    }
  }

  const fetchSquadAttendanceSummary = async (batchId) => {
    const bId = batchId || selectedBatchId
    if (!token || !bId) return
    try {
      setLoadingSquadSummary(true)
      const res = await fetch(`${apiBase}/api/superadmin/analytics/squad-attendance-summary?batchId=${bId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSquadSummaryData(data)
      } else {
        if (showToast) showToast(data.message || 'Failed to load squad attendance summary', 'error')
      }
    } catch (err) {
      console.error('Error fetching squad summary:', err)
      if (showToast) showToast('Error connecting to server', 'error')
    } finally {
      setLoadingSquadSummary(false)
    }
  }

  const handleDownloadSquadSummaryExcel = () => {
    if (!squadSummaryData || ((!squadSummaryData.activities || squadSummaryData.activities.length === 0) && (!squadSummaryData.squads || squadSummaryData.squads.length === 0))) {
      if (showToast) showToast('No summary data available to export', 'warning')
      return
    }

    const batchName = squadSummaryData.batch?.name || `Batch_${selectedBatchId}`
    const wb = XLSX.utils.book_new()

    // 1. Activity-Wise Day Summary Sheet (Primary)
    if (squadSummaryData.activities && squadSummaryData.activities.length > 0) {
      const actRows = squadSummaryData.activities.map(a => ({
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
        'Day 4 Absent': a.day4?.is_recorded ? a.day4.not_attended : '—'
      }))

      if (squadSummaryData.totals) {
        const t = squadSummaryData.totals
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
          'Day 4 Absent': t.day4?.is_recorded ? t.day4.not_attended : '—'
        })
      }

      const wsAct = XLSX.utils.json_to_sheet(actRows)
      XLSX.utils.book_append_sheet(wb, wsAct, 'Activity Attendance Summary')
    }

    XLSX.writeFile(wb, `Activity_DayWise_Attendance_Summary_${batchName.replace(/\s+/g, '_')}.xlsx`)
    if (showToast) showToast('Day-wise activity attendance summary downloaded successfully', 'success')
  }

  useEffect(() => {
    if (overviewMode === 'executive') {
      fetchExecutiveDashboard()
    }
  }, [overviewMode])

  useEffect(() => {
    if (overviewMode === 'cohort' && selectedBatchId) {
      setBatchSummary(null)   // clear stale data so UI resets cleanly
      setAbsenteesData([])
      fetchBatchSummary()
      fetchAbsentees(selectedBatchId)
      if (showSquadSummaryCard) {
        fetchSquadAttendanceSummary(selectedBatchId)
      }
    }
  }, [overviewMode, selectedBatchId, showSquadSummaryCard])

  useEffect(() => {
    setCurrentPage(1)
    setAbsenteePage(1)
  }, [selectedBatchId, overviewMode])

  useEffect(() => {
    if (showDownloadModal) {
      document.body.classList.add('download-modal-active')
    } else {
      document.body.classList.remove('download-modal-active')
    }
    return () => {
      document.body.classList.remove('download-modal-active')
    }
  }, [showDownloadModal])

  const enrichedAbsentee = (s) => {
    const match = (batchSummary?.students || []).find(st =>
      (s.student_id && String(st.id) === String(s.student_id)) ||
      (s.id && String(st.id) === String(s.id)) ||
      (s.prn && String(st.prn).trim() === String(s.prn).trim()) ||
      (s.email && String(st.email).toLowerCase() === String(s.email).toLowerCase())
    );
    const isDnrVal = s.is_dnr !== undefined ? !!s.is_dnr : (match?.is_dnr !== undefined ? !!match.is_dnr : String(s.absentee_type || '').includes('DNR'));
    return {
      ...match,
      ...s,
      gender: s.gender && s.gender !== '—' ? s.gender : (match?.gender || '—'),
      name: s.name || match?.name || '—',
      prn: s.prn || match?.prn || '—',
      division: s.division || match?.division || '—',
      school: s.school || match?.school || '—',
      faculty: s.faculty || match?.faculty || s.department || match?.department || '—',
      panel: s.panel || match?.panel || '—',
      squad: s.squad || match?.squad || '—',
      phone: s.phone || match?.phone || match?.emergency_contact_mobile || match?.parent_mobile || '—',
      email: s.email || match?.email || '—',
      is_dnr: isDnrVal,
      absentee_type: isDnrVal ? 'DNR (Did Not Report)' : (s.absentee_type || 'Low Attendance (<30%)'),
      dnr_marked_by_name: s.dnr_marked_by_name || match?.dnr_marked_by_name || null,
      dnr_reason: s.dnr_reason || match?.dnr_reason || null,
      attendance_percentage: s.attendance_percentage !== undefined ? s.attendance_percentage : match?.attendance_percentage
    };
  };

  const absGenderCounts = useMemo(() => {
    let male = 0;
    let female = 0;
    let other = 0;
    (absenteesData || []).forEach(s => {
      const student = enrichedAbsentee(s);
      const g = String(student.gender || '').trim().toLowerCase();
      if (g === 'male' || g === 'm') male++;
      else if (g === 'female' || g === 'f') female++;
      else if (g && g !== '—' && g !== 'unspecified' && g !== '-' && g !== '') other++;
    });
    return { male, female, other, total: (absenteesData || []).length };
  }, [absenteesData, batchSummary]);

  const filteredAbsentees = useMemo(() => {
    return absenteesData.filter(s => {
      const student = enrichedAbsentee(s)
      const q = overviewAbsenteeSearch.toLowerCase()
      return (student.name || '').toLowerCase().includes(q) ||
        (student.prn || '').toLowerCase().includes(q) ||
        (student.gender || '').toLowerCase().includes(q) ||
        (student.division || '').toLowerCase().includes(q) ||
        (student.school || '').toLowerCase().includes(q) ||
        (student.faculty || '').toLowerCase().includes(q) ||
        (student.panel || '').toLowerCase().includes(q) ||
        (student.squad || '').toLowerCase().includes(q) ||
        (student.phone || '').toLowerCase().includes(q) ||
        (student.email || '').toLowerCase().includes(q)
    })
  }, [absenteesData, overviewAbsenteeSearch, batchSummary])

  const filteredAbsGenderCounts = useMemo(() => {
    let male = 0;
    let female = 0;
    let other = 0;
    filteredAbsentees.forEach(s => {
      const student = enrichedAbsentee(s);
      const g = String(student.gender || '').trim().toLowerCase();
      if (g === 'male' || g === 'm') male++;
      else if (g === 'female' || g === 'f') female++;
      else if (g && g !== '—' && g !== 'unspecified' && g !== '-' && g !== '') other++;
    });
    return { male, female, other, total: filteredAbsentees.length };
  }, [filteredAbsentees, batchSummary]);

  const handleDownloadAbsenteesExcel = () => {
    if (!filteredAbsentees || filteredAbsentees.length === 0) {
      if (showToast) showToast('No absentee records available to export.', 'warning')
      return
    }
    const sortedList = [...filteredAbsentees].sort((a, b) => {
      const stA = enrichedAbsentee(a);
      const stB = enrichedAbsentee(b);
      const rankA = getSquadRank(stA.squad);
      const rankB = getSquadRank(stB.squad);
      if (rankA !== rankB) return rankA - rankB;
      const sqA = String(stA.squad || '').trim();
      const sqB = String(stB.squad || '').trim();
      const sqCmp = sqA.localeCompare(sqB, undefined, { numeric: true, sensitivity: 'base' });
      if (sqCmp !== 0) return sqCmp;
      return String(stA.name || '').localeCompare(String(stB.name || ''), undefined, { numeric: true, sensitivity: 'base' });
    });

    const exportData = sortedList.map((s) => {
      const student = enrichedAbsentee(s);
      return {
        'Name': student.name,
        'PRN': student.prn,
        'Gender': student.gender || '—',
        'Absentee Category': student.is_dnr || String(student.absentee_type || '').includes('DNR') ? 'DNR (Did Not Report)' : 'Low Attendance (<30%)',
        'Attendance %': student.attendance_percentage !== undefined && student.attendance_percentage !== null ? `${student.attendance_percentage}%` : '—',
        'DNR Marked By': student.dnr_marked_by_name || '—',
        'Division': student.division,
        'School': student.school,
        'Faculty': student.faculty,
        'Panel': student.panel,
        'Squad': student.squad,
        'Phone No.': student.phone,
        'Email': student.email
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Absentees');
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 18 },
      { wch: 12 },
      { wch: 25 },
      { wch: 16 },
      { wch: 22 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 30 }
    ];
    const batchName = (batchSummary?.batch?.name || 'Active_Batch').replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `Absentees_${batchName}.xlsx`);
    if (showToast) showToast('Absentees Excel downloaded successfully!', 'success');
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .chart-card, .glass-card {
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          padding: 20px 22px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.025), 0 1px 3px rgba(0, 0, 0, 0.015);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chart-card:hover, .glass-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 28px -4px rgba(37, 99, 235, 0.09), 0 4px 8px -2px rgba(0, 0, 0, 0.02);
          border-color: rgba(37, 99, 235, 0.22);
        }
        .progress-bar-fill {
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .chart-marker circle {
          transition: r 0.2s ease, stroke-width 0.2s ease;
        }
        .chart-marker:hover circle {
          r: 7;
          stroke-width: 3.5px;
        }
      `}</style>
      {/* Switch tabs between Executive Dashboard and Cohort/Batch Roster */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '9999px', padding: '4px', border: '1px solid #e2e8f0', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => setOverviewMode('executive')}
            style={{
              flex: isMobile ? 1 : 'none',
              textAlign: 'center',
              borderRadius: '9999px',
              padding: '6px 20px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: overviewMode === 'executive' ? '#ffffff' : 'transparent',
              color: overviewMode === 'executive' ? '#0f172a' : '#64748b',
              boxShadow: overviewMode === 'executive' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Overview
          </button>
          <button
            onClick={() => setOverviewMode('cohort')}
            style={{
              flex: isMobile ? 1 : 'none',
              textAlign: 'center',
              borderRadius: '9999px',
              padding: '6px 20px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: overviewMode === 'cohort' ? '#ffffff' : 'transparent',
              color: overviewMode === 'cohort' ? '#0f172a' : '#64748b',
              boxShadow: overviewMode === 'cohort' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            All Batch Statistics
          </button>
        </div>
        {overviewMode === 'executive' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
            <button
              onClick={handleOpenDownloadModal}
              style={{
                flex: isMobile ? 1 : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                borderRadius: '9999px',
                padding: isMobile ? '8px 14px' : '8px 18px',
                fontSize: isMobile ? '12px' : '12.5px',
                fontWeight: '750',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                whiteSpace: 'nowrap'
              }}
              className="hover:opacity-95 hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
              title="Download Reports & Data"
            >
              <Download size={14} color="#ffffff" strokeWidth={2.5} />
              <span>Download</span>
            </button>
            <button
              onClick={fetchExecutiveDashboard}
              style={{
                flex: isMobile ? 1 : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderRadius: '9999px',
                padding: isMobile ? '8px 12px' : '7px 16px',
                fontSize: isMobile ? '12px' : '12.5px',
                fontWeight: '600',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              className="hover:bg-slate-50 active:scale-95"
            >
              <RefreshCw size={13} className={loadingExec ? 'spin' : ''} />
              {isMobile ? 'Refresh Stats' : 'Refresh Executive Stats'}
            </button>
          </div>
        )}
      </div>

      {overviewMode === 'executive' ? (
        loadingExec && !execStats ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Live statistics Grid */}
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>System Stats</h3>
              <p style={{ margin: '0 0 14px 0', fontSize: isMobile ? '12px' : '13px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {isMobile ? 'Real-time status of users, compliance & email pipeline.' : 'Real-time status of users, compliance, rooms, and email pipeline.'}
              </p>

              <style>{`
                @media (min-width: 641px) {
                  .system-stats-grid {
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                  }
                }
                @media (max-width: 640px) {
                  .system-stats-grid {
                    grid-template-columns: repeat(2, 1fr) !important;
                  }
                }
                @media (max-width: 340px) {
                  .system-stats-grid {
                    grid-template-columns: 1fr !important;
                  }
                }
              `}</style>
              <div className="system-stats-grid" style={{ display: 'grid', gap: isMobile ? '10px' : '16px' }}>
                {[
                  { title: isMobile ? 'Students' : 'Total Students', value: execStats?.totalStudents, icon: <GraduationCap size={isMobile ? 15 : 18} color="#1e3a8a" strokeWidth={2.4} />, color: '#1e3a8a', shadowColor: 'rgba(30, 58, 138, 0.15)' },
                  { title: isMobile ? 'MIT Faculty' : 'Total MIT Faculty', value: execStats?.totalFaculty, icon: <BookOpen size={isMobile ? 15 : 18} color="#1d4ed8" strokeWidth={2.4} />, color: '#1d4ed8', shadowColor: 'rgba(59, 130, 246, 0.15)' },
                  { title: isMobile ? 'LTC Members' : 'Total LTC Members', value: execStats?.totalLtc, icon: <Shield size={isMobile ? 15 : 18} color="#16a34a" strokeWidth={2.4} />, color: '#16a34a', shadowColor: 'rgba(34, 197, 94, 0.15)' },
                  ...(!isReadonly ? [
                    { title: 'Active Batches', value: execStats?.activeBatches, icon: <Layers size={isMobile ? 15 : 18} color="#ea580c" strokeWidth={2.4} />, color: '#ea580c', shadowColor: 'rgba(249, 115, 22, 0.15)' }
                  ] : []),
                  { title: 'Upcoming Batches', value: execStats?.upcomingBatches, icon: <Calendar size={isMobile ? 15 : 18} color="#2563eb" strokeWidth={2.4} />, color: '#2563eb', shadowColor: 'rgba(37, 99, 235, 0.15)' },
                  { title: 'Completed Batches', value: execStats?.completedBatches, icon: <Check size={isMobile ? 15 : 18} color="#475569" strokeWidth={2.4} />, color: '#475569', shadowColor: 'rgba(71, 85, 105, 0.15)' },
                  { title: isMobile ? 'Attendance %' : "Today's Attendance %", value: execStats?.todayAttendancePct !== undefined ? `${execStats.todayAttendancePct}%` : undefined, icon: <Activity size={isMobile ? 15 : 18} color="#0d9488" strokeWidth={2.4} />, color: '#0d9488', shadowColor: 'rgba(13, 148, 136, 0.15)' },
                  { title: isMobile ? 'Pending Forms' : 'Pending Undertakings', value: execStats?.pendingUndertakings, icon: <FileText size={isMobile ? 15 : 18} color="#d97706" strokeWidth={2.4} />, color: '#d97706', shadowColor: 'rgba(217, 119, 6, 0.15)' },
                  { title: 'Rooms Occupied', value: execStats?.totalRoomsOccupied, icon: <Home size={isMobile ? 15 : 18} color="#0891b2" strokeWidth={2.4} />, color: '#0891b2', shadowColor: 'rgba(8, 145, 178, 0.15)' },
                  { title: isMobile ? 'Red Flags Today' : 'Red Flags Raised Today', value: execStats?.redFlagsToday, icon: <AlertOctagon size={isMobile ? 15 : 18} color="#e11d48" strokeWidth={2.4} />, color: '#e11d48', shadowColor: 'rgba(225, 29, 72, 0.15)' },
                  ...(!isReadonly ? [
                    { title: isMobile ? 'Emails Sent' : 'Emails Sent Today', value: execStats?.emailsSentToday, icon: <Mail size={isMobile ? 15 : 18} color="#2563eb" strokeWidth={2.4} />, color: '#2563eb', shadowColor: 'rgba(37, 99, 235, 0.15)' }
                  ] : []),
                  { title: 'Active Users', value: execStats?.activeUsers, icon: <ShieldCheck size={isMobile ? 15 : 18} color="#16a34a" strokeWidth={2.4} />, color: '#16a34a', shadowColor: 'rgba(22, 163, 74, 0.15)' }
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#ffffff',
                      borderRadius: isMobile ? '12px' : '16px',
                      border: '1px solid #e2e8f0',
                      padding: isMobile ? '10px 12px' : '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: isMobile ? '72px' : '88px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                      cursor: 'default',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="hover:shadow-md transition-all duration-200"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, minWidth: 0 }}>
                      <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '4px' }}>
                        {c.title}
                      </span>
                      <div style={{
                        width: isMobile ? '26px' : '34px',
                        height: isMobile ? '26px' : '34px',
                        background: '#ffffff',
                        borderRadius: isMobile ? '7px' : '10px',
                        boxShadow: `0 4px 10px -2px ${c.shadowColor}`,
                        border: `1px solid rgba(59, 130, 246, 0.08)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {c.icon}
                      </div>
                    </div>
                    <div style={{ zIndex: 2, marginTop: isMobile ? '2px' : '4px' }}>
                      <h3 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {c.value !== undefined ? c.value.toLocaleString() : '—'}
                      </h3>
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: isMobile ? '60px' : '90px',
                      height: isMobile ? '50px' : '70px',
                      background: `radial-gradient(circle at bottom right, ${c.color}11, transparent 70%)`,
                      pointerEvents: 'none',
                      zIndex: 1
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `radial-gradient(${c.color}25 1.5px, transparent 1.5px)`,
                        backgroundSize: '8px 8px',
                        WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                        maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Executive Graphs Section */}
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>System Charts</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Visual charts for enrollment, safety warnings, email queue, and batches.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                {/* 1. Students per Batch */}
                <div className="chart-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '270px', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <Layers size={15} style={{ color: '#2563eb' }} /> Enrollment (Students per Batch)
                    </h4>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Registration metrics across batch cohorts</p>
                  </div>
                  <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    {execGraphs?.studentsPerBatch && execGraphs.studentsPerBatch.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={execGraphs.studentsPerBatch} margin={{ left: -22, right: 10, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="batch_name"
                            stroke="#94a3b8"
                            fontSize={10.5}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            fontSize={10.5}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(37, 99, 235, 0.04)' }}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div style={{
                                    background: '#0f172a',
                                    color: '#ffffff',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                  }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                                      {payload[0].value} Students
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="student_count" fill="url(#enrollGrad)" radius={[5, 5, 0, 0]} barSize={26} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui' }}>No batch data found</div>
                    )}
                  </div>
                </div>

                {/* 2. Attendance Trend */}
                <div className="chart-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '270px', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <Activity size={15} style={{ color: '#2563eb' }} /> Attendance Compliance Trend
                    </h4>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Average student compliance logs over time</p>
                  </div>
                  <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    {execGraphs?.attendanceTrend && execGraphs.attendanceTrend.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={execGraphs.attendanceTrend} margin={{ left: -22, right: 10, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            stroke="#94a3b8"
                            fontSize={10.5}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={{ stroke: '#e2e8f0' }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            stroke="#94a3b8"
                            fontSize={10.5}
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            unit="%"
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div style={{
                                    background: '#0f172a',
                                    color: '#ffffff',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                  }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label}</div>
                                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                                      {payload[0].value}% Compliance
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="pct"
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorAttendance)"
                            dot={{ r: 3.5, stroke: '#2563eb', strokeWidth: 1.5, fill: '#ffffff' }}
                            activeDot={{ r: 5.5, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui' }}>No attendance trend logs available</div>
                    )}
                  </div>
                </div>

                {/* 3. Gender Distribution */}
                <div className="chart-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '270px', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <Users size={15} style={{ color: '#2563eb' }} /> Gender Distribution
                    </h4>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Demographic profile of enrolled students</p>
                  </div>
                  <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px' }}>
                    {execGraphs?.genderDistribution && execGraphs.genderDistribution.length > 0 ? (
                      (() => {
                        // Normalize case variants → canonical labels, then merge duplicates
                        const normalizeGender = (g) => {
                          if (!g) return 'Unspecified'
                          const l = g.toLowerCase()
                          if (l === 'male') return 'Male'
                          if (l === 'female') return 'Female'
                          return g
                        }
                        const mergedGender = {}
                        execGraphs.genderDistribution.forEach(x => {
                          const key = normalizeGender(x.gender)
                          mergedGender[key] = (mergedGender[key] || 0) + Number(x.count)
                        })
                        const genderData = Object.entries(mergedGender).map(([name, value]) => ({ name, value }));
                        const totalGender = genderData.reduce((sum, item) => sum + item.value, 0) || 1;
                        const maxGenderItem = genderData.reduce((prev, current) => (prev.value > current.value) ? prev : current, { name: 'Unspecified', value: 0 });
                        const primaryPct = Math.round((maxGenderItem.value / totalGender) * 100);
                        const primaryLabel = maxGenderItem.name;

                        return (
                          <>
                            <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={genderData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={52}
                                    paddingAngle={4}
                                    cornerRadius={4}
                                    dataKey="value"
                                  >
                                    {genderData.map((entry, index) => {
                                      const colors = {
                                        'Male': '#2563eb',
                                        'Female': '#ec4899',
                                        'Unspecified': '#cbd5e1',
                                        'Other': '#8b5cf6'
                                      };
                                      return <Cell key={`cell-${index}`} fill={colors[entry.name] || '#cbd5e1'} />;
                                    })}
                                  </Pie>
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const d = payload[0];
                                        const pct = Math.round((d.value / totalGender) * 100);
                                        return (
                                          <div style={{
                                            background: '#0f172a',
                                            color: '#ffffff',
                                            padding: '5px 10px',
                                            borderRadius: '7px',
                                            fontSize: '11.5px',
                                            fontWeight: '600',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                          }}>
                                            {d.name}: <strong>{d.value} ({pct}%)</strong>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                lineHeight: 1.1
                              }}>
                                <div style={{ fontSize: '19px', fontWeight: '900', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                  {primaryPct}%
                                </div>
                                <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: '2px', fontFamily: 'system-ui' }}>
                                  {primaryLabel}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
                              {genderData.map((item, idx) => {
                                const percentage = Math.round((item.value / totalGender) * 100);
                                const colors = { 'Male': '#2563eb', 'Female': '#ec4899', 'Unspecified': '#94a3b8', 'Other': '#8b5cf6' };
                                const bgColors = { 'Male': '#eff6ff', 'Female': '#fdf2f8', 'Unspecified': '#f8fafc', 'Other': '#f5f3ff' };
                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: bgColors[item.name] || '#f8fafc',
                                      fontSize: '12px',
                                      fontFamily: 'system-ui, -apple-system, sans-serif'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[item.name] || '#cbd5e1', flexShrink: 0 }} />
                                      <span style={{ color: '#334155', fontWeight: '650', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                      </span>
                                    </div>
                                    <span style={{ color: '#0f172a', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
                                      {item.value} <span style={{ color: '#64748b', fontWeight: '500', fontSize: '11px' }}>({percentage}%)</span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui' }}>No gender distribution metrics found</div>
                    )}
                  </div>
                </div>

                {!isReadonly && (
                  <>
                    {/* 4. Branch Distribution */}
                    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '260px', padding: '16px 20px', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <Award size={15} style={{ color: '#2563eb' }} /> Branch Distribution
                        </h4>
                        <p style={{ margin: '2px 0 8px 0', fontSize: '11px', color: '#64748b', fontFamily: 'system-ui' }}>Student concentration by department (Top 5)</p>
                      </div>
                      <div style={{ height: '180px', width: '100%', paddingRight: '4px' }}>
                        {execGraphs?.branchDistribution && execGraphs.branchDistribution.length > 0 ? (
                          (() => {
                            const sortedBranches = [...execGraphs.branchDistribution]
                              .sort((a, b) => b.count - a.count)
                              .slice(0, 5);

                            const formatBranchLabel = (tick) => {
                              if (typeof tick !== 'string') return tick;
                              return tick.length > 16 ? `${tick.substring(0, 13)}...` : tick;
                            };

                            return (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sortedBranches} layout="vertical" margin={{ left: 0, right: 35, top: 0, bottom: 0 }}>
                                  <XAxis type="number" hide />
                                  <YAxis
                                    dataKey="branch"
                                    type="category"
                                    stroke="#64748b"
                                    fontSize={10}
                                    fontWeight={600}
                                    width={95}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={formatBranchLabel}
                                  />
                                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                                    <LabelList dataKey="count" position="right" style={{ fill: '#0f172a', fontSize: '10px', fontWeight: '750', fontFamily: 'system-ui' }} />
                                    {sortedBranches.map((entry, index) => {
                                      const colors = ['#2563eb', '#3b82f6', '#4f46e5', '#1d4ed8', '#1e3a8a'];
                                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                    })}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            );
                          })()
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>No branch statistics available</div>
                        )}
                      </div>
                    </div>

                    {/* 5. Daily Login Activity */}
                    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '260px', padding: '16px 20px', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <TrendingUp size={15} style={{ color: '#2563eb' }} /> Daily Login Activity
                        </h4>
                        <p style={{ margin: '2px 0 8px 0', fontSize: '11px', color: '#64748b', fontFamily: 'system-ui' }}>System authentication logins tracker</p>
                      </div>
                      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {execGraphs?.dailyLoginActivity && execGraphs.dailyLoginActivity.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={execGraphs.dailyLoginActivity} margin={{ left: -20, right: 10, top: 5, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" stroke="#64748b" fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" fontSize={10} fontWeight={600} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontFamily: 'system-ui' }} />
                              <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLogins)" dot={{ r: 3, stroke: '#4f46e5', strokeWidth: 1.5, fill: '#ffffff' }} activeDot={{ r: 5 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui' }}>No login activity registered</div>
                        )}
                      </div>
                    </div>

                    {/* 6. Email Delivery Success */}
                    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', height: '260px', padding: '16px 20px', justifyContent: 'space-between' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <Mail size={15} style={{ color: '#2563eb' }} /> Email Queue Status
                        </h4>
                        <p style={{ margin: '2px 0 8px 0', fontSize: '11px', color: '#64748b', fontFamily: 'system-ui' }}>SMTP delivery pipeline performance</p>
                      </div>
                      <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                        {(() => {
                          const statusData = execGraphs?.emailDeliverySuccess || [];
                          const total = statusData.reduce((acc, curr) => acc + curr.count, 0) || 1;
                          const sent = statusData.filter(s => String(s.status).toLowerCase() === 'sent').reduce((acc, curr) => acc + curr.count, 0);
                          const failed = statusData.filter(s => ['failed', 'permanent_fail'].includes(String(s.status).toLowerCase())).reduce((acc, curr) => acc + curr.count, 0);
                          const pending = statusData.filter(s => !['sent', 'failed', 'permanent_fail'].includes(String(s.status).toLowerCase())).reduce((acc, curr) => acc + curr.count, 0);
                          const sentPct = Math.round((sent / total) * 100);
                          const chartData = [
                            { name: 'Sent Success', value: sent, color: '#2563eb' },
                            { name: 'Pending Queued', value: pending, color: '#64748b' },
                            { name: 'Failed Pipeline', value: failed, color: '#e11d48' }
                          ].filter(x => x.value > 0);

                          if (chartData.length === 0) {
                            return <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: 'system-ui', textAlign: 'center' }}>No email pipeline records found</div>;
                          }

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '12px', flexWrap: 'wrap', width: '100%' }}>
                              <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={chartData}
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={36}
                                      outerRadius={46}
                                      paddingAngle={3}
                                      dataKey="value"
                                    >
                                      {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                                  </PieChart>
                                </ResponsiveContainer>
                                <div style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  textAlign: 'center',
                                  pointerEvents: 'none'
                                }}>
                                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: '1', fontFamily: 'system-ui' }}>{sentPct}%</div>
                                  <div style={{ fontSize: '8px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginTop: '1px', fontFamily: 'system-ui' }}>Sent</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
                                  <span style={{ color: '#475569' }}>Sent:</span>
                                  <span style={{ color: '#0f172a', fontWeight: '750' }}>{sent}</span>
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#64748b' }} />
                                  <span style={{ color: '#475569' }}>Pending:</span>
                                  <span style={{ color: '#0f172a', fontWeight: '750' }}>{pending}</span>
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e11d48' }} />
                                  <span style={{ color: '#475569' }}>Failed:</span>
                                  <span style={{ color: '#0f172a', fontWeight: '750' }}>{failed}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}

                {/* 7. Batch Completion Status */}
                <div className="chart-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', padding: '16px 20px', display: 'flex', flexDirection: 'column', height: '270px', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <Layers size={15} style={{ color: '#2563eb' }} /> Batch Completion Status
                    </h4>
                    <p style={{ margin: '2px 0 8px 0', fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Distribution of cohort completion stages</p>
                  </div>
                  <div style={{ height: '185px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px' }}>
                    {(() => {
                      const statusData = execGraphs?.batchCompletionStatus || [];
                      let active = 0, completed = 0, upcoming = 0;
                      if (statusData.length > 0) {
                        active = statusData.filter(s => ['active', 'immersion', 'orientation'].includes(String(s.status).toLowerCase())).reduce((acc, curr) => acc + curr.count, 0);
                        completed = statusData.filter(s => ['completed', 'archived'].includes(String(s.status).toLowerCase())).reduce((acc, curr) => acc + curr.count, 0);
                        upcoming = statusData.filter(s => ['upcoming', 'planning', 'created'].includes(String(s.status).toLowerCase())).reduce((acc, curr) => acc + curr.count, 0);
                      } else if (batches && batches.length > 0) {
                        active = batches.filter(b => ['active', 'immersion', 'orientation'].includes(String(b.status).toLowerCase())).length;
                        completed = batches.filter(b => ['completed', 'archived'].includes(String(b.status).toLowerCase())).length;
                        upcoming = batches.filter(b => ['upcoming', 'planning', 'created'].includes(String(b.status).toLowerCase())).length;
                      }
                      const total = (active + completed + upcoming) || 1;
                      const completedPct = Math.round((completed / total) * 100);
                      const chartData = [
                        { name: 'Active', value: active, color: '#2563eb' },
                        { name: 'Completed', value: completed, color: '#10b981' },
                        { name: 'Upcoming', value: upcoming, color: '#f59e0b' }
                      ].filter(x => x.value > 0);

                      return (
                        <>
                          <div style={{ position: 'relative', width: '112px', height: '112px', flexShrink: 0 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData.length > 0 ? chartData : [{ name: 'None', value: 1, color: '#f1f5f9' }]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={52}
                                  paddingAngle={chartData.length > 0 ? 4 : 0}
                                  cornerRadius={4}
                                  dataKey="value"
                                >
                                  {(chartData.length > 0 ? chartData : [{ name: 'None', value: 1, color: '#f1f5f9' }]).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                {chartData.length > 0 && (
                                  <Tooltip
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const d = payload[0];
                                        const pct = Math.round((d.value / total) * 100);
                                        return (
                                          <div style={{
                                            background: '#0f172a',
                                            color: '#ffffff',
                                            padding: '5px 10px',
                                            borderRadius: '7px',
                                            fontSize: '11.5px',
                                            fontWeight: '600',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                          }}>
                                            {d.name}: <strong>{d.value} ({pct}%)</strong>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                )}
                              </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              textAlign: 'center',
                              pointerEvents: 'none',
                              lineHeight: 1.1
                            }}>
                              <div style={{ fontSize: '19px', fontWeight: '900', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                {completedPct}%
                              </div>
                              <div style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: '2px', fontFamily: 'system-ui' }}>
                                DONE
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                            {[
                              { label: 'Active', count: active, color: '#2563eb', bg: '#eff6ff' },
                              { label: 'Completed', count: completed, color: '#10b981', bg: '#ecfdf5' },
                              { label: 'Upcoming', count: upcoming, color: '#f59e0b', bg: '#fffbeb' }
                            ].map((item, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  background: item.bg,
                                  fontSize: '12px',
                                  fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                  <span style={{ color: '#334155', fontWeight: '650' }}>{item.label}</span>
                                </div>
                                <span style={{ color: '#0f172a', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
                                  {item.count}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )
      ) : (
        /* Cohort & Batch Roster View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          {/* Batch Select and High level System Metrics */}
          <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Active Batch Roster & Metadata</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Manage registered users, cohorts, and active batch rosters.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', fontFamily: 'system-ui' }}>Select Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(e.target.value)}
                  style={{
                    padding: '8px 36px 8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  className="hover:border-slate-350"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const willShow = !showSquadSummaryCard;
                    setShowSquadSummaryCard(willShow);
                    if (willShow && (!squadSummaryData || String(squadSummaryData.batch?.id) !== String(selectedBatchId))) {
                      fetchSquadAttendanceSummary(selectedBatchId);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    borderRadius: '9999px',
                    padding: isMobile ? '8px 14px' : '8px 18px',
                    fontSize: isMobile ? '12px' : '12.5px',
                    fontWeight: '750',
                    background: 'linear-gradient(135deg, #0057b8 0%, #1d4ed8 100%)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(0, 87, 184, 0.35)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap'
                  }}
                  className="hover:opacity-95 active:scale-95"
                  title="Show Day-Wise Activity Attendance Summary Card"
                >
                  <FileSpreadsheet size={14} color="#ffffff" strokeWidth={2.4} />
                  <span>Attendance Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadBatchSummaryPdf(selectedBatchId)}
                  disabled={downloadingBatchSummaryPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    borderRadius: '9999px',
                    padding: isMobile ? '8px 14px' : '8px 18px',
                    fontSize: isMobile ? '12px' : '12.5px',
                    fontWeight: '750',
                    background: 'linear-gradient(135deg, #7c2d12 0%, #991b1b 100%)',
                    border: 'none',
                    color: '#ffffff',
                    cursor: downloadingBatchSummaryPdf ? 'wait' : 'pointer',
                    opacity: downloadingBatchSummaryPdf ? 0.75 : 1,
                    boxShadow: '0 4px 14px rgba(153, 27, 27, 0.35)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap'
                  }}
                  className="hover:opacity-95 active:scale-95"
                  title="Download Official LTC Batch Report PDF (Format: LTC_template.docx)"
                >
                  <FileText size={14} color="#ffffff" strokeWidth={2.4} />
                  <span>{downloadingBatchSummaryPdf ? 'Generating Report...' : 'LTC Batch Report (PDF)'}</span>
                </button>
              </div>
            </div>

            {/* System Metrics row (5 cards in one row on desktop) */}
            {batchSummary && batchSummary.systemMetrics && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))', gap: isMobile ? '10px' : '14px', marginTop: '16px' }}>
                {[
                  { title: 'Total Users', value: batchSummary.systemMetrics.totalUsers, icon: <Users size={isMobile ? 15 : 16} color="#2563eb" strokeWidth={2.4} />, color: '#2563eb', shadowColor: 'rgba(37, 99, 235, 0.15)' },
                  { title: 'Students Onboard', value: batchSummary.metrics?.totalStudents !== undefined ? Math.max(0, batchSummary.metrics.totalStudents - (Array.isArray(absenteesData) ? absenteesData.length : 0)) : undefined, icon: <GraduationCap size={isMobile ? 15 : 16} color="#4f46e5" strokeWidth={2.4} />, color: '#4f46e5', shadowColor: 'rgba(79, 70, 229, 0.15)' },
                  { 
                    title: 'Absentees', 
                    value: Array.isArray(absenteesData) ? absenteesData.length : 0, 
                    genderBreakdown: absGenderCounts,
                    icon: <UserX size={isMobile ? 15 : 16} color="#e11d48" strokeWidth={2.4} />, 
                    color: '#e11d48', 
                    shadowColor: 'rgba(225, 29, 72, 0.15)' 
                  },
                  { title: 'Faculty', value: batchSummary.systemMetrics.totalFaculty, icon: <BookOpen size={isMobile ? 15 : 16} color="#dc2626" strokeWidth={2.4} />, color: '#dc2626', shadowColor: 'rgba(220, 38, 38, 0.15)' },
                  { title: isMobile ? 'LTC Squad' : 'LTC Members', value: batchSummary.systemMetrics.totalLtc, icon: <Shield size={isMobile ? 15 : 16} color="#d97706" strokeWidth={2.4} />, color: '#d97706', shadowColor: 'rgba(217, 119, 6, 0.15)' }
                ].map((c, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#ffffff',
                      borderRadius: isMobile ? '12px' : '16px',
                      border: '1px solid #e2e8f0',
                      padding: isMobile ? '10px 12px' : '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      minHeight: isMobile ? '76px' : '92px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                      cursor: 'default',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="hover:shadow-md transition-all duration-200"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2, minWidth: 0 }}>
                      <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: '4px' }}>
                        {c.title}
                      </span>
                      <div style={{
                        width: isMobile ? '26px' : '32px',
                        height: isMobile ? '26px' : '32px',
                        background: '#ffffff',
                        borderRadius: isMobile ? '7px' : '8px',
                        boxShadow: `0 4px 10px -2px ${c.shadowColor}`,
                        border: `1px solid rgba(59, 130, 246, 0.08)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {c.icon}
                      </div>
                    </div>
                    <div style={{ zIndex: 2, marginTop: isMobile ? '2px' : '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <h3 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.1, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          {c.value !== undefined ? c.value.toLocaleString() : '0'}
                        </h3>
                      </div>
                      {c.genderBreakdown ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#1d4ed8', background: '#eff6ff', padding: '1px 5px', borderRadius: '4px', border: '1px solid #dbeafe', lineHeight: 1.2 }}>
                            M: {c.genderBreakdown.male}
                          </span>
                          <span style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#be185d', background: '#fdf2f8', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fce7f3', lineHeight: 1.2 }}>
                            F: {c.genderBreakdown.female}
                          </span>
                          {c.genderBreakdown.other > 0 && (
                            <span style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', border: '1px solid #e2e8f0', lineHeight: 1.2 }}>
                              O: {c.genderBreakdown.other}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '70px',
                      height: '50px',
                      background: `radial-gradient(circle at bottom right, ${c.color}11, transparent 70%)`,
                      pointerEvents: 'none',
                      zIndex: 1
                    }}>
                      <div style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `radial-gradient(${c.color}25 1.5px, transparent 1.5px)`,
                        backgroundSize: '8px 8px',
                        WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                        maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Day-Wise Activity Attendance Summary Modal Card (Matching Screenshot Layout) */}
            {showSquadSummaryCard && (
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
                  padding: isMobile ? '12px' : '20px'
                }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowSquadSummaryCard(false);
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
                  {/* Header: Solid blue background matching reference card */}
                  <div style={{
                    background: '#0057b8',
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
                        ATTENDANCE SUMMARY {squadSummaryData?.batch ? `· ${squadSummaryData.batch.name}` : ''}
                      </span>
                      <h3 style={{ fontSize: isMobile ? '16px' : '19px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.3px' }}>
                        Day-Wise Activity Attendance Summary
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dbeafe' }}>
                        Day 1 to Day 4 activity &amp; pillar count of students who attended (present) vs not attended (absent / DNR).
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleDownloadSquadSummaryExcel}
                        disabled={loadingSquadSummary || (!squadSummaryData?.activities?.length && !squadSummaryData?.squads?.length)}
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
                          cursor: (loadingSquadSummary || (!squadSummaryData?.activities?.length && !squadSummaryData?.squads?.length)) ? 'not-allowed' : 'pointer',
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
                        onClick={() => fetchSquadAttendanceSummary(selectedBatchId)}
                        disabled={loadingSquadSummary}
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
                          cursor: loadingSquadSummary ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Refresh summary data"
                      >
                        <RefreshCw size={13} className={loadingSquadSummary ? 'spin' : ''} />
                        <span>Refresh</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setShowSquadSummaryCard(false)} 
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
                  <div style={{ padding: isMobile ? '16px' : '22px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
                    {/* 4 Overview Cards inside Squad Summary */}
                    {squadSummaryData?.totals && (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
                        {/* ALL STUDENTS */}
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>ALL STUDENTS</span>
                            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>{squadSummaryData.totals.total_students}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>In {squadSummaryData.squads?.length || 10} Squads</div>
                          </div>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={18} />
                          </div>
                        </div>

                        {/* Squad Coordinators */}
                        <div 
                          onClick={() => {
                            const firstCoord = squadSummaryData.leaders && squadSummaryData.leaders.length > 0 ? squadSummaryData.leaders[0] : null;
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
                              {squadSummaryData.leaders?.[0]?.name || `${squadSummaryData.leaders?.length || 0} Assigned`}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: '700' }}>Click to view details</div>
                          </div>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', flexShrink: 0, border: '1.5px solid #bfdbfe' }}>
                            {squadSummaryData.leaders?.[0]?.name ? squadSummaryData.leaders[0].name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'SC'}
                          </div>
                        </div>

                        {/* Squads / Activities */}
                        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Activities</span>
                            <div style={{ fontSize: '22px', fontWeight: '900', color: '#d97706', marginTop: '2px' }}>6 Core</div>
                            <div style={{ fontSize: '11px', color: '#dc2626' }}>{squadSummaryData.totals.dnr_count} Total DNR</div>
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
                                const recDays = [1,2,3,4].filter(d => squadSummaryData.recordedDays?.includes(d));
                                if (recDays.length === 0 || !squadSummaryData.totals.total_students) return '—';
                                const sumPct = recDays.reduce((acc, d) => acc + (squadSummaryData.totals[`day${d}`]?.attendance_pct || 0), 0);
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

                    {loadingSquadSummary ? (
                      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>Loading day-wise attendance summary...</div>
                      </div>
                    ) : (!squadSummaryData?.activities?.length && !squadSummaryData?.squads?.length) ? (
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
                              {[1, 2, 3, 4].map(d => (
                                <th key={d} colSpan={2} style={{ padding: '8px 10px', borderRight: d < 4 ? '1px solid #e2e8f0' : 'none', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                  DAY {d} {squadSummaryData?.recordedDays?.includes(d) ? '' : '(UNMARKED)'}
                                </th>
                              ))}
                            </tr>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', fontSize: '10.5px', fontWeight: '700', color: '#64748b' }}>
                              {[1, 2, 3, 4].map(d => (
                                <React.Fragment key={`sub-${d}`}>
                                  <th style={{ padding: '6px 8px', color: '#16a34a', width: '70px' }}>Attended</th>
                                  <th style={{ padding: '6px 8px', color: '#dc2626', width: '70px', borderRight: d < 4 ? '1px solid #e2e8f0' : 'none' }}>Absent</th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(squadSummaryData.activities || []).map((a, idx) => (
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
                                {[1, 2, 3, 4].map(d => {
                                  const dayObj = a[`day${d}`] || {};
                                  const isRec = dayObj.is_recorded;
                                  const isValid = dayObj.is_valid_day !== false;
                                  return (
                                    <React.Fragment key={`day-cell-${d}`}>
                                      <td style={{ padding: '10px 6px', fontWeight: '750', color: isRec ? '#16a34a' : '#94a3b8', background: isRec && dayObj.attended > 0 ? '#f0fdf4' : 'transparent' }}>
                                        {!isValid ? '—' : (isRec ? dayObj.attended : '—')}
                                      </td>
                                      <td style={{ padding: '10px 6px', fontWeight: '750', color: isRec ? (dayObj.not_attended > 0 ? '#dc2626' : '#64748b') : '#94a3b8', borderRight: d < 4 ? '1px solid #e2e8f0' : 'none', background: isRec && dayObj.not_attended > 0 ? '#fef2f2' : 'transparent' }}>
                                        {!isValid ? '—' : (isRec ? dayObj.not_attended : '—')}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                          {squadSummaryData.totals && (
                            <tfoot>
                              <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: '850', color: '#0f172a' }}>
                                <td style={{ padding: '12px 14px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>
                                  TOTAL (Batch Aggregate)
                                </td>
                                <td style={{ padding: '12px 10px', borderRight: '1px solid #cbd5e1', fontSize: '13px' }}>
                                  {squadSummaryData.totals.total_students}
                                </td>
                                <td style={{ padding: '12px 10px', borderRight: '1.5px solid #cbd5e1', color: squadSummaryData.totals.dnr_count > 0 ? '#dc2626' : '#64748b', fontSize: '13px' }}>
                                  {squadSummaryData.totals.dnr_count}
                                </td>
                                {[1, 2, 3, 4].map(d => {
                                  const tObj = squadSummaryData.totals[`day${d}`] || {};
                                  const isRec = tObj.is_recorded;
                                  return (
                                    <React.Fragment key={`tot-${d}`}>
                                      <td style={{ padding: '12px 6px', color: isRec ? '#15803d' : '#94a3b8', fontSize: '13px' }}>
                                        {isRec ? tObj.attended : '—'}
                                      </td>
                                      <td style={{ padding: '12px 6px', color: isRec ? '#b91c1c' : '#94a3b8', borderRight: d < 4 ? '1px solid #e2e8f0' : 'none', fontSize: '13px' }}>
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
                      onClick={handleDownloadSquadSummaryExcel}
                      disabled={loadingSquadSummary || (!squadSummaryData?.activities?.length && !squadSummaryData?.squads?.length)}
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
                        cursor: (loadingSquadSummary || (!squadSummaryData?.activities?.length && !squadSummaryData?.squads?.length)) ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Download size={14} color="#ffffff" strokeWidth={2.4} />
                      <span>Download Excel</span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setShowSquadSummaryCard(false)} 
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

          {loadingSummary ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
              <div className="spinner" />
            </div>
          ) : batchSummary && batchSummary.batch ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Active Batch Details Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: isMobile ? '14px' : '18px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Layers size={15} style={{ color: '#2563eb' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui' }}>Active Batch Metadata</h4>
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Batch details, location, schedule, and roster counts.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: '750',
                        background: '#f1f5f9',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '3px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: '1.2',
                        fontFamily: 'system-ui'
                      }}
                    >
                      {batchSummary.batch.year || '2026'}
                    </span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: '750',
                        background: batchSummary.batch.status === 'active' ? '#dcfce7' : '#f1f5f9',
                        color: batchSummary.batch.status === 'active' ? '#15803d' : '#475569',
                        border: batchSummary.batch.status === 'active' ? '1px solid #86efac' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '3px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        lineHeight: '1.2',
                        fontFamily: 'system-ui',
                        textTransform: 'capitalize'
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: batchSummary.batch.status === 'active' ? '#16a34a' : '#64748b'
                        }}
                      />
                      {batchSummary.batch.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '9px 11px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
                      Name
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: 'system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {batchSummary.batch.name}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '9px 11px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
                      Code
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: 'system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {batchSummary.batch.batch_code || '—'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '9px 11px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
                      Venue
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: 'system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {batchSummary.batch.location || 'Main Campus'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '9px 11px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
                      Dates
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: 'system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {batchSummary.batch.start_date ? new Date(batchSummary.batch.start_date).toLocaleDateString() : '—'} – {batchSummary.batch.end_date ? new Date(batchSummary.batch.end_date).toLocaleDateString() : '—'}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '9px 11px', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>
                      Roster Counts
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', marginTop: '3px', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#2563eb' }}>{batchSummary.metrics.totalStudents} Students</span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ color: '#d97706' }}>{batchSummary.metrics.totalFaculty} LTC Members</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Batch-Specific Graphs Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 0 14px 0', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui' }}>Batch Analytics</h3>
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', fontFamily: 'system-ui' }}>Squad distribution, compliance rings, logins, and operational status.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(310px, 1fr))', gap: isMobile ? '12px' : '16px', marginBottom: '20px' }}>
                  {/* 1. Undertaking – Students */}
                  {(() => {
                    const undertakingTotal = batchSummary?.metrics?.undertaking?.total || batchSummary?.metrics?.totalStudents || (batchSummary?.students || []).length || 0;
                    const undertakingSub = batchSummary?.metrics?.undertaking?.submitted !== undefined
                      ? batchSummary.metrics.undertaking.submitted
                      : (batchSummary?.students || []).filter(s => s.undertaking_submitted).length;
                    const undertakingPend = Math.max(0, undertakingTotal - undertakingSub);
                    const undertakingPct = undertakingTotal > 0 ? Math.round((undertakingSub / undertakingTotal) * 100) : 0;

                    return (
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                            <ShieldCheck size={15} style={{ color: '#16a34a' }} /> Undertaking – Students
                          </h4>
                          <span style={{ fontSize: '11px', fontWeight: '750', color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                            {undertakingSub} / {undertakingTotal} Signed
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '2px 0' }}>
                          <DonutProgressRing
                            submitted={undertakingSub}
                            total={undertakingTotal}
                            color="#16a34a"
                            label="Signed"
                            size={isMobile ? 88 : 94}
                            strokeWidth={8.5}
                            title="Undertaking Compliance"
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '135px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Submitted:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{undertakingSub} ({undertakingPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Pending:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{undertakingPend} ({100 - undertakingPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Total Batch:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{undertakingTotal}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. Pre-Feedback */}
                  {(() => {
                    const preFeedbackTotal = batchSummary?.metrics?.preFeedback?.total || batchSummary?.metrics?.totalStudents || (batchSummary?.students || []).length || 0;
                    const preFeedbackSub = batchSummary?.metrics?.preFeedback?.submitted !== undefined
                      ? batchSummary.metrics.preFeedback.submitted
                      : (batchSummary?.students || []).filter(s => s.pre_feedback_submitted).length;
                    const preFeedbackPend = Math.max(0, preFeedbackTotal - preFeedbackSub);
                    const preFeedbackPct = preFeedbackTotal > 0 ? Math.round((preFeedbackSub / preFeedbackTotal) * 100) : 0;

                    return (
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                            <MessageSquare size={15} style={{ color: '#2563eb' }} /> Pre-Feedback
                          </h4>
                          <span style={{ fontSize: '11px', fontWeight: '750', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                            {preFeedbackSub} / {preFeedbackTotal} Submitted
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '2px 0' }}>
                          <DonutProgressRing
                            submitted={preFeedbackSub}
                            total={preFeedbackTotal}
                            color="#2563eb"
                            label="Pre-LTC"
                            size={isMobile ? 88 : 94}
                            strokeWidth={8.5}
                            title="Pre-Feedback Compliance"
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '135px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Submitted:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{preFeedbackSub} ({preFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Pending:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{preFeedbackPend} ({100 - preFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Total Batch:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{preFeedbackTotal}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 3. Post-Feedback */}
                  {(() => {
                    const postFeedbackTotal = batchSummary?.metrics?.postFeedback?.total || batchSummary?.metrics?.totalStudents || (batchSummary?.students || []).length || 0;
                    const postFeedbackSub = batchSummary?.metrics?.postFeedback?.submitted !== undefined
                      ? batchSummary.metrics.postFeedback.submitted
                      : (batchSummary?.students || []).filter(s => s.post_feedback_submitted).length;
                    const postFeedbackPend = Math.max(0, postFeedbackTotal - postFeedbackSub);
                    const postFeedbackPct = postFeedbackTotal > 0 ? Math.round((postFeedbackSub / postFeedbackTotal) * 100) : 0;

                    return (
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                            <MessageSquare size={15} style={{ color: '#8b5cf6' }} /> Post-Feedback
                          </h4>
                          <span style={{ fontSize: '11px', fontWeight: '750', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                            {postFeedbackSub} / {postFeedbackTotal} Submitted
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '2px 0' }}>
                          <DonutProgressRing
                            submitted={postFeedbackSub}
                            total={postFeedbackTotal}
                            color="#8b5cf6"
                            label="Post-LTC"
                            size={isMobile ? 88 : 94}
                            strokeWidth={8.5}
                            title="Post-Feedback Compliance"
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '135px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Submitted:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{postFeedbackSub} ({postFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Pending:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{postFeedbackPend} ({100 - postFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Total Batch:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{postFeedbackTotal}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. Service Feedback */}
                  {(() => {
                    const serviceFeedbackTotal = batchSummary?.metrics?.serviceFeedback?.total || batchSummary?.metrics?.totalStudents || (batchSummary?.students || []).length || 0;
                    const serviceFeedbackSub = batchSummary?.metrics?.serviceFeedback?.submitted !== undefined
                      ? batchSummary.metrics.serviceFeedback.submitted
                      : (batchSummary?.students || []).filter(s => s.service_feedback_submitted).length;
                    const serviceFeedbackPend = Math.max(0, serviceFeedbackTotal - serviceFeedbackSub);
                    const serviceFeedbackPct = serviceFeedbackTotal > 0 ? Math.round((serviceFeedbackSub / serviceFeedbackTotal) * 100) : 0;

                    return (
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                            <Sparkles size={15} style={{ color: '#ea580c' }} /> Service Feedback
                          </h4>
                          <span style={{ fontSize: '11px', fontWeight: '750', color: '#c2410c', background: '#ffedd5', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                            {serviceFeedbackSub} / {serviceFeedbackTotal} Submitted
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '2px 0' }}>
                          <DonutProgressRing
                            submitted={serviceFeedbackSub}
                            total={serviceFeedbackTotal}
                            color="#ea580c"
                            label="Service"
                            size={isMobile ? 88 : 94}
                            strokeWidth={8.5}
                            title="Service Feedback Compliance"
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '135px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Submitted:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{serviceFeedbackSub} ({serviceFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Pending:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{serviceFeedbackPend} ({100 - serviceFeedbackPct}%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                              <span style={{ color: '#475569' }}>Total Batch:</span>
                              <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{serviceFeedbackTotal}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 5. Squads Distribution */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                        <Layers size={15} style={{ color: '#2563eb' }} /> Squads Distribution
                      </h4>
                      <span style={{ fontSize: '11px', fontWeight: '750', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                        {(batchSummary.graphs?.squadDistribution || []).length} Squads
                      </span>
                    </div>

                    <div style={{ maxHeight: '140px', overflowY: 'auto', paddingRight: '4px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '6px', flex: 1, alignContent: 'start' }}>
                      {(() => {
                        const rawSquads = batchSummary.graphs?.squadDistribution || [];
                        const sortedSquads = [...rawSquads].sort((a, b) => {
                          const nameA = String(a.squad_name || '').replace(/^squad\s+/i, '').trim();
                          const nameB = String(b.squad_name || '').replace(/^squad\s+/i, '').trim();
                          const rankA = getSquadRank(nameA);
                          const rankB = getSquadRank(nameB);
                          if (rankA !== rankB) return rankA - rankB;
                          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                        });

                        return sortedSquads.map((s, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #f1f5f9'
                            }}
                          >
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '6px' }}>
                              {String(s.squad_name || '').replace(/^squad\s+/i, '')}
                            </span>
                            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#2563eb', background: '#eff6ff', border: '1px solid #dbeafe', padding: '1px 7px', borderRadius: '5px', whiteSpace: 'nowrap', fontFamily: 'system-ui' }}>
                              {s.student_count}
                            </span>
                          </div>
                        ));
                      })()}
                      {(!batchSummary.graphs?.squadDistribution || batchSummary.graphs.squadDistribution.length === 0) && (
                        <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2', textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '32px' }}>
                          No squad enrollment data found
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. Gender Distribution */}
                  <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '14px' : '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '210px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '7px', color: '#0f172a', fontFamily: 'system-ui' }}>
                        <Users size={15} style={{ color: '#2563eb' }} /> Gender Distribution
                      </h4>
                      <span style={{ fontSize: '11px', fontWeight: '750', color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '9999px', fontFamily: 'system-ui' }}>
                        {batchSummary.metrics?.totalStudents || 0} Total
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px', flex: 1, padding: '2px 0' }}>
                      {(() => {
                        const normalizeGender2 = (g) => {
                          if (!g) return 'Unspecified'
                          const l = g.toLowerCase()
                          if (l === 'male') return 'Male'
                          if (l === 'female') return 'Female'
                          return g
                        }
                        const mergedRaw = {}
                          ; (batchSummary.graphs?.genderDistribution || []).forEach(x => {
                            const key = normalizeGender2(x.gender)
                            mergedRaw[key] = (mergedRaw[key] || 0) + Number(x.count)
                          })
                        const data = Object.entries(mergedRaw).map(([gender, count]) => ({ gender, count }));
                        const total = data.reduce((acc, curr) => acc + curr.count, 0) || 1;
                        let accumulatedPercent = 0;

                        const colors = {
                          'Male': '#2563eb',
                          'Female': '#ec4899',
                          'Unspecified': '#cbd5e1',
                          'Other': '#8b5cf6'
                        };

                        const ringSize = isMobile ? 88 : 94;
                        const strokeWidth = 8.5;
                        const radius = (ringSize - strokeWidth * 2) / 2;
                        const circumference = 2 * Math.PI * radius;

                        return (
                          <>
                            <div style={{ position: 'relative', width: `${ringSize}px`, height: `${ringSize}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                                <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
                                {data.map((item, idx) => {
                                  const percentage = (item.count / total) * 100;
                                  const strokeDash = (percentage / 100) * circumference;
                                  const strokeOffset = circumference - (accumulatedPercent / 100) * circumference;
                                  accumulatedPercent += percentage;
                                  const itemColor = colors[item.gender] || colors['Unspecified'];

                                  return (
                                    <circle
                                      key={idx}
                                      cx={ringSize / 2}
                                      cy={ringSize / 2}
                                      r={radius}
                                      fill="none"
                                      stroke={itemColor}
                                      strokeWidth={strokeWidth}
                                      strokeDasharray={`${strokeDash} ${circumference}`}
                                      strokeDashoffset={-((circumference - strokeOffset))}
                                      strokeLinecap="butt"
                                      style={{ transition: 'all 0.6s ease' }}
                                    />
                                  );
                                })}
                              </svg>
                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', lineHeight: 1 }}>
                                <div style={{ fontSize: '18px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui' }}>
                                  {total}
                                </div>
                                <div style={{ fontSize: '8.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', marginTop: '3px', fontFamily: 'system-ui' }}>
                                  Students
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '135px' }}>
                              {data.map((item, idx) => {
                                const percentage = Math.round((item.count / total) * 100);
                                const itemColor = colors[item.gender] || colors['Unspecified'];
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: '650', fontFamily: 'system-ui' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: itemColor, flexShrink: 0 }} />
                                    <span style={{ color: '#475569' }}>{item.gender}:</span>
                                    <span style={{ color: '#0f172a', fontWeight: '800', marginLeft: 'auto' }}>{item.count} ({percentage}%)</span>
                                  </div>
                                );
                              })}
                              {data.length === 0 && (
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>No records</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Services & Pillar-wise Trainers Feedback Analytics Section */}
              <div style={{
                background: '#ffffff',
                borderRadius: isMobile ? '14px' : '18px',
                border: '1px solid #e2e8f0',
                padding: isMobile ? '14px 12px' : '24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: isMobile ? '14px' : '15.5px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui', lineHeight: 1.3 }}>
                      Services &amp; Pillar-wise Trainers Feedback Analytics
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: isMobile ? '11px' : '12px', color: '#64748b', fontFamily: 'system-ui', lineHeight: 1.35 }}>
                      Deterministic statistical aggregation of MCQ &amp; Likert-scale ratings (1–5 scale) across all camp dimensions.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: isMobile ? '10.5px' : '11.5px',
                      fontWeight: '750',
                      color: serviceFeedbackData.totalSubmissions > 0 ? '#15803d' : '#64748b',
                      background: serviceFeedbackData.totalSubmissions > 0 ? '#dcfce7' : '#f1f5f9',
                      border: serviceFeedbackData.totalSubmissions > 0 ? '1px solid #86efac' : '1px solid #e2e8f0',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontFamily: 'system-ui',
                      display: 'inline-flex',
                      alignItems: 'center',
                      whiteSpace: 'nowrap'
                    }}>
                      {serviceFeedbackData.totalSubmissions} Form{serviceFeedbackData.totalSubmissions === 1 ? '' : 's'} Submitted
                    </span>
                  </div>
                </div>

                {serviceFeedbackData.totalSubmissions === 0 ? (
                  <div style={{
                    padding: isMobile ? '24px 14px' : '36px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>No Service &amp; Trainers Feedback Submissions Found</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      As students in this batch submit their <strong>Services &amp; Trainers Feedback Form</strong> from their student portal, interactive rating graphs and pillar comparisons will update in real-time.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', width: '100%', boxSizing: 'border-box' }}>
                    {/* Top KPI Metrics Strip */}
                    {(() => {
                      const totalRatingsCount = serviceFeedbackData.ratingDistribution.reduce((acc, r) => acc + r.value, 0) || 1;
                      const positiveCount = (serviceFeedbackData.ratingDistribution.find(r => r.rating === 5)?.value || 0) +
                        (serviceFeedbackData.ratingDistribution.find(r => r.rating === 4)?.value || 0);
                      const positivePct = Math.round((positiveCount / totalRatingsCount) * 100);

                      const sortedPillars = [...serviceFeedbackData.pillars].filter(p => p.avg > 0).sort((a, b) => b.avg - a.avg);
                      const topPillar = sortedPillars[0];

                      const sortedFacilities = [...serviceFeedbackData.facilities].filter(f => f.avg > 0).sort((a, b) => b.avg - a.avg);
                      const topFacility = sortedFacilities[0];

                      return (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                          gap: isMobile ? '8px' : '14px',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}>
                          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '10px 10px' : '14px 16px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '750', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <Star size={isMobile ? 11 : 13} style={{ color: '#d97706', flexShrink: 0 }} /> Overall Rating
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: isMobile ? '19px' : '24px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui', lineHeight: 1 }}>
                                {serviceFeedbackData.overallAverage.toFixed(2)}
                              </span>
                              <span style={{ fontSize: isMobile ? '11px' : '13px', fontWeight: '700', color: '#64748b' }}>/ 5.0</span>
                            </div>
                            <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '9999px', height: '5px', overflow: 'hidden', marginTop: '8px' }}>
                              <div style={{ width: `${(serviceFeedbackData.overallAverage / 5) * 100}%`, background: '#16a34a', height: '100%', borderRadius: '9999px' }} />
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '10px 10px' : '14px 16px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '750', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Positive Ratio
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: isMobile ? '19px' : '24px', fontWeight: '850', color: '#16a34a', fontFamily: 'system-ui', lineHeight: 1 }}>
                                {positivePct}%
                              </span>
                              <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '600', color: '#64748b', lineHeight: 1.2 }}>4★ &amp; 5★</span>
                            </div>
                            <div style={{ fontSize: isMobile ? '9.5px' : '11px', color: '#64748b', marginTop: isMobile ? '6px' : '8px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${positiveCount} of ${totalRatingsCount} rating marks`}>
                              {positiveCount} / {totalRatingsCount} marks
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '10px 10px' : '14px 16px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '750', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Top Rated Pillar
                            </div>
                            <div style={{ fontSize: isMobile ? '12px' : '14.5px', fontWeight: '800', color: '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={topPillar ? topPillar.name : '—'}>
                              {topPillar ? topPillar.name : '—'}
                            </div>
                            <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#2563eb', fontWeight: '750', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {topPillar ? `${topPillar.avg.toFixed(2)} / 5.0 ★` : '—'}
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '10px 10px' : '14px 16px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '750', letterSpacing: '0.4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Top Facility
                            </div>
                            <div style={{ fontSize: isMobile ? '12px' : '14.5px', fontWeight: '800', color: '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={topFacility ? topFacility.name : '—'}>
                              {topFacility ? topFacility.name : '—'}
                            </div>
                            <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#7c3aed', fontWeight: '750', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {topFacility ? `${topFacility.avg.toFixed(2)} / 5.0 ★` : '—'}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Chart Grid (2-column layout) */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: isMobile ? '12px' : '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

                      {/* 1. Pillar-wise Trainer Satisfaction */}
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '270px' : '280px', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '800', color: '#0f172a' }}>
                            Pillar-wise Trainer Performance (out of 5.0)
                          </h5>
                          <p style={{ margin: '2px 0 6px 0', fontSize: isMobile ? '10.5px' : '11px', color: '#64748b' }}>Average student rating for trainers across the 5 pillars</p>
                        </div>
                        <div style={{ height: '200px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={serviceFeedbackData.pillars} layout="vertical" margin={{ left: isMobile ? -5 : 5, right: isMobile ? 28 : 35, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                              <YAxis dataKey="name" type="category" width={isMobile ? 95 : 115} tick={{ fontSize: isMobile ? 9.5 : 11, fill: '#334155', fontWeight: 600 }} />
                              <Tooltip
                                formatter={(val) => [`${val} / 5.0 ★`, 'Rating']}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                              />
                              <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                                {serviceFeedbackData.pillars.map((entry, index) => (
                                  <Cell key={`cell-pillar-${index}`} fill={entry.color || '#2563eb'} />
                                ))}
                                <LabelList dataKey="avg" position="right" formatter={(v) => v ? `${Number(v).toFixed(2)}★` : ''} style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '750', fill: '#0f172a' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 2. Rating Breakdown Distribution */}
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '270px' : '280px', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Star size={14} style={{ color: '#d97706', flexShrink: 0 }} /> Rating Scale Breakdown (1–5 Stars)
                          </h5>
                          <p style={{ margin: '2px 0 6px 0', fontSize: isMobile ? '10.5px' : '11px', color: '#64748b' }}>Frequency distribution across all answered questions</p>
                        </div>
                        <div style={{ height: isMobile ? 'auto' : '200px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: isMobile ? 'center' : 'space-around', gap: isMobile ? '12px' : '12px', minWidth: 0, width: '100%', boxSizing: 'border-box', padding: isMobile ? '6px 0' : 0 }}>
                          {(() => {
                            const validDist = serviceFeedbackData.ratingDistribution.filter(r => r.value > 0);
                            const totalDistCount = validDist.reduce((acc, r) => acc + r.value, 0) || 1;

                            return (
                              <>
                                <div style={{ position: 'relative', width: isMobile ? '96px' : '120px', height: isMobile ? '96px' : '120px', flexShrink: 0 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={validDist.length > 0 ? validDist : [{ name: 'No data', value: 1, color: '#f1f5f9' }]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={isMobile ? 30 : 38}
                                        outerRadius={isMobile ? 44 : 54}
                                        paddingAngle={validDist.length > 0 ? 3 : 0}
                                        dataKey="value"
                                      >
                                        {(validDist.length > 0 ? validDist : [{ name: 'No data', value: 1, color: '#f1f5f9' }]).map((entry, idx) => (
                                          <Cell key={`cell-dist-${idx}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        formatter={(val, name) => [`${val} responses (${Math.round((val / totalDistCount) * 100)}%)`, name]}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', lineHeight: 1 }}>
                                    <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui' }}>
                                      {serviceFeedbackData.overallAverage.toFixed(1)}★
                                    </div>
                                    <div style={{ fontSize: '8px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', marginTop: '2px' }}>
                                      Avg Score
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '3px' : '4px', flex: 1, minWidth: 0, width: '100%' }}>
                                  {serviceFeedbackData.ratingDistribution.map((item, idx) => {
                                    const pct = Math.round((item.value / totalDistCount) * 100);
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: isMobile ? '11px' : '11.5px', fontFamily: 'system-ui' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                          <span style={{ color: '#475569', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                        </div>
                                        <span style={{ fontWeight: '800', color: '#0f172a', flexShrink: 0, marginLeft: '6px' }}>
                                          {item.value} <span style={{ color: '#94a3b8', fontWeight: '500', fontSize: '10px' }}>({pct}%)</span>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 3. Campus Facilities & Administrative Support */}
                      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', minHeight: isMobile ? '270px' : '280px', justifyContent: 'space-between', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <div>
                          <h5 style={{ margin: 0, fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '800', color: '#0f172a' }}>
                            Facilities &amp; Administrative Support (out of 5.0)
                          </h5>
                          <p style={{ margin: '2px 0 6px 0', fontSize: isMobile ? '10.5px' : '11px', color: '#64748b' }}>Lodging, dining, medical, and LTC coordination quality</p>
                        </div>
                        <div style={{ height: '200px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={serviceFeedbackData.facilities} layout="vertical" margin={{ left: isMobile ? -5 : 5, right: isMobile ? 28 : 35, top: 5, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                              <YAxis dataKey="name" type="category" width={isMobile ? 100 : 125} tick={{ fontSize: isMobile ? 9 : 10.5, fill: '#334155', fontWeight: 600 }} />
                              <Tooltip
                                formatter={(val) => [`${val} / 5.0 ★`, 'Rating']}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                              />
                              <Bar dataKey="avg" fill="#0284c7" radius={[0, 6, 6, 0]}>
                                <LabelList dataKey="avg" position="right" formatter={(v) => v ? `${Number(v).toFixed(2)}★` : ''} style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '750', fill: '#0f172a' }} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* 4. Orientation & Activity Effectiveness */}
                      {(() => {
                        const allItems = [...(serviceFeedbackData.arrival || []), ...(serviceFeedbackData.activities || [])];
                        const displayedData = activityFilter === 'onboarding'
                          ? (serviceFeedbackData.arrival || [])
                          : activityFilter === 'activities'
                            ? (serviceFeedbackData.activities || [])
                            : allItems;
                        const chartHeight = displayedData.length > 5 ? (isMobile ? 310 : 290) : 200;

                        return (
                          <div style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            padding: isMobile ? '12px' : '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: isMobile ? (displayedData.length > 5 ? '380px' : '270px') : (displayedData.length > 5 ? '360px' : '280px'),
                            justifyContent: 'space-between',
                            minWidth: 0,
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <h5 style={{ margin: 0, fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '800', color: '#0f172a' }}>
                                  Program Activities &amp; Onboarding Experience
                                </h5>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '2px 4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                  {[
                                    { key: 'all', label: `All (${allItems.length})` },
                                    { key: 'onboarding', label: `Onboarding (${serviceFeedbackData.arrival?.length || 0})` },
                                    { key: 'activities', label: `Activities (${serviceFeedbackData.activities?.length || 0})` }
                                  ].map(pill => (
                                    <button
                                      key={pill.key}
                                      type="button"
                                      onClick={() => setActivityFilter(pill.key)}
                                      style={{
                                        border: 'none',
                                        background: activityFilter === pill.key ? '#7c3aed' : 'transparent',
                                        color: activityFilter === pill.key ? '#ffffff' : '#64748b',
                                        padding: '2px 7px',
                                        borderRadius: '6px',
                                        fontSize: isMobile ? '9.5px' : '10.5px',
                                        fontWeight: '750',
                                        cursor: 'pointer',
                                        fontFamily: 'system-ui',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {pill.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <p style={{ margin: '2px 0 6px 0', fontSize: isMobile ? '10.5px' : '11px', color: '#64748b' }}>
                                Scores for arrival reception, guest lecture, debate, quiz &amp; cultural night
                              </p>
                            </div>
                            <div style={{ height: `${chartHeight}px`, width: '100%', minWidth: 0, boxSizing: 'border-box', marginTop: '6px' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={displayedData} layout="vertical" margin={{ left: isMobile ? -5 : 5, right: isMobile ? 32 : 38, top: 5, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                  <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
                                  <YAxis dataKey="name" type="category" width={isMobile ? 115 : 135} tick={{ fontSize: isMobile ? 9 : 10.5, fill: '#334155', fontWeight: 600 }} />
                                  <Tooltip
                                    formatter={(val) => [`${val} / 5.0 ★`, 'Rating']}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                  />
                                  <Bar dataKey="avg" fill="#7c3aed" radius={[0, 6, 6, 0]}>
                                    <LabelList dataKey="avg" position="right" formatter={(v) => v ? `${Number(v).toFixed(2)}★` : ''} style={{ fontSize: isMobile ? '9.5px' : '10.5px', fontWeight: '750', fill: '#0f172a' }} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })()}

                    </div>

                    {/* 5. Trainer Core Dimensions Breakdown (Full Width) */}
                    <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: isMobile ? '12px' : '16px', display: 'flex', flexDirection: 'column', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div style={{ marginBottom: '10px' }}>
                        <h5 style={{ margin: 0, fontSize: isMobile ? '12.5px' : '13.5px', fontWeight: '800', color: '#0f172a' }}>
                          Trainer Pedagogical Competencies (Cross-Pillar Averages)
                        </h5>
                        <p style={{ margin: '2px 0 0 0', fontSize: isMobile ? '10.5px' : '11px', color: '#64748b' }}>
                          Evaluation across subject knowledge, communication, student interaction, punctuality, and training methodologies
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: isMobile ? '8px' : '12px', marginTop: '6px', width: '100%', boxSizing: 'border-box' }}>
                        {serviceFeedbackData.trainerDimensions.map((dim, idx) => (
                          <div key={idx} style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: isMobile ? '10px 10px' : '12px 14px', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}>
                            <div style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#475569', minHeight: isMobile ? '24px' : '30px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dim.name}>
                              {dim.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '850', color: '#0f172a', fontFamily: 'system-ui', lineHeight: 1 }}>
                                {dim.avg > 0 ? dim.avg.toFixed(2) : '—'}
                              </span>
                              {dim.avg > 0 && <span style={{ fontSize: isMobile ? '10px' : '11.5px', color: '#64748b', fontWeight: '600' }}>/ 5★</span>}
                            </div>
                            <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '9999px', height: '4px', overflow: 'hidden', marginTop: '6px' }}>
                              <div style={{ width: `${(dim.avg / 5) * 100}%`, background: '#2563eb', height: '100%', borderRadius: '9999px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Active Batch Enrolled Students List */}
              <div style={{
                background: '#ffffff',
                borderRadius: isMobile ? '14px' : '18px',
                border: '1px solid #e2e8f0',
                padding: isMobile ? '14px 12px' : '24px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} style={{ color: '#2563eb' }} />
                    <h4 style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui' }}>
                      Students Enrolled ({(batchSummary.students || []).filter(s => {
                        const q = overviewStudentSearch.toLowerCase()
                        return (s.name || '').toLowerCase().includes(q) ||
                          (s.email || '').toLowerCase().includes(q) ||
                          (s.prn || '').toLowerCase().includes(q)
                      }).length} / {batchSummary.students ? batchSummary.students.length : 0})
                    </h4>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0 14px', width: isMobile ? '100%' : '280px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', boxSizing: 'border-box' }}>
                    <Search size={14} style={{ color: '#94a3b8', marginRight: '6px', flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search enrolled students..."
                      value={overviewStudentSearch}
                      onChange={e => {
                        setOverviewStudentSearch(e.target.value)
                        setCurrentPage(1)
                      }}
                      style={{ border: 'none', background: 'none', width: '100%', height: '34px', outline: 'none', fontSize: '12.5px', color: '#0f172a' }}
                    />
                  </div>
                </div>

                {(() => {
                  const filteredStudents = (batchSummary.students || []).filter(s => {
                    const q = overviewStudentSearch.toLowerCase()
                    return (s.name || '').toLowerCase().includes(q) ||
                      (s.email || '').toLowerCase().includes(q) ||
                      (s.prn || '').toLowerCase().includes(q)
                  });
                  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
                  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                  return (
                    <>
                      <div className="table-wrapper" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>PRN</th>
                              <th>Student Name & Email</th>
                              <th>School & Branch</th>
                              <th>Room Allotment</th>
                              <th>Squads</th>
                              {!isReadonly && <th>Undertaking</th>}
                              {!isReadonly && <th>Insurance Status</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedStudents.map((s, idx) => (
                              <tr key={s.id || idx}>
                                <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#2563eb', fontSize: '12.5px' }}>{s.prn || '—'}</td>
                                <td>
                                  <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{s.name}</div>
                                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>{s.email}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: '600', fontSize: '12px', color: '#334155' }}>{s.department || '—'}</div>
                                  {s.school && <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{s.school}</div>}
                                </td>
                                <td style={{ fontWeight: '700', color: '#0f172a' }}>{s.room || '—'}</td>
                                <td>
                                  <span className="badge badge-blue" style={{ fontSize: '10px', fontWeight: '600', borderRadius: '9999px', background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', padding: '2px 8px' }}>{s.squad || 'Unassigned'}</span>
                                </td>
                                {!isReadonly && (
                                  <td>
                                    {s.undertaking_submitted ? (
                                      <span style={{ color: '#059669', fontWeight: '700', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Check size={12} /> Submitted
                                      </span>
                                    ) : (
                                      <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '12px' }}>Pending</span>
                                    )}
                                  </td>
                                )}
                                {!isReadonly && (
                                  <td>
                                    <div style={{ fontWeight: '600', fontSize: '12px', color: s.policy_number ? '#334155' : '#dc2626' }}>
                                      {s.policy_number || 'Missing'}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                              <tr>
                                <td colSpan={isReadonly ? 5 : 7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No students enrolled in this batch.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {filteredStudents.length > itemsPerPage && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: 'system-ui' }}>
                            Showing <span style={{ fontWeight: '700', color: '#0f172a' }}>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredStudents.length)}</span> to{' '}
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of{' '}
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>{filteredStudents.length}</span> students
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPage === 1}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                color: currentPage === 1 ? '#cbd5e1' : '#334155',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                outline: 'none'
                              }}
                            >
                              Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                              .map((page, idx, arr) => {
                                const elements = [];
                                if (idx > 0 && page - arr[idx - 1] > 1) {
                                  elements.push(<span key={`ellipsis-${page}`} style={{ color: '#94a3b8', fontSize: '12px', padding: '0 4px' }}>...</span>);
                                }
                                elements.push(
                                  <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      borderRadius: '6px',
                                      border: '1px solid',
                                      borderColor: currentPage === page ? '#2563eb' : '#e2e8f0',
                                      background: currentPage === page ? '#2563eb' : '#ffffff',
                                      color: currentPage === page ? '#ffffff' : '#0f172a',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      outline: 'none'
                                    }}
                                  >
                                    {page}
                                  </button>
                                );
                                return elements;
                              })}
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              disabled={currentPage === totalPages}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                color: currentPage === totalPages ? '#cbd5e1' : '#334155',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all 0.15s ease',
                                outline: 'none'
                              }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Active Batch Absentees Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: isMobile ? '16px' : '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        Absentees
                      </h3>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        • {filteredAbsentees.length} absent
                      </span>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Male: {filteredAbsGenderCounts.male}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#be185d', background: '#fdf2f8', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #fbcfe8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Female: {filteredAbsGenderCounts.female}
                        </span>
                        {filteredAbsGenderCounts.other > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: '9999px', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            Other: {filteredAbsGenderCounts.other}
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      Display-only roster of students marked absent for this batch.
                    </p>
                  </div>

                  {/* Actions: Search & Download */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Search absentees..."
                      value={overviewAbsenteeSearch}
                      onChange={e => {
                        setOverviewAbsenteeSearch(e.target.value)
                        setAbsenteePage(1)
                      }}
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        width: isMobile ? '100%' : '220px',
                        outline: 'none',
                        background: '#ffffff',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                    />

                    <button
                      type="button"
                      onClick={handleDownloadAbsenteesExcel}
                      disabled={filteredAbsentees.length === 0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        color: filteredAbsentees.length === 0 ? '#94a3b8' : '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: filteredAbsentees.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        outline: 'none',
                        flexShrink: 0,
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                    >
                      Download Excel
                    </button>
                  </div>
                </div>

                {/* Table */}
                {(() => {
                  const itemsPerPageAbs = 15;
                  const totalAbsPages = Math.ceil(filteredAbsentees.length / itemsPerPageAbs) || 1;
                  const paginatedAbsentees = filteredAbsentees.slice((absenteePage - 1) * itemsPerPageAbs, absenteePage * itemsPerPageAbs);

                  return (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '480px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              {['Name', 'PRN', 'Gender', 'Category', 'Division', 'School', 'Faculty', 'Panel', 'Squad', 'Phone No.', 'Email'].map((h, i) => (
                                <th key={i} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedAbsentees.map((s, idx) => {
                              const student = enrichedAbsentee(s);
                              const isDnr = student.is_dnr || String(student.absentee_type || '').includes('DNR');
                              const isMale = (student.gender || '').toLowerCase() === 'male' || (student.gender || '').toLowerCase() === 'm';
                              const isFemale = (student.gender || '').toLowerCase() === 'female' || (student.gender || '').toLowerCase() === 'f';
                              return (
                                <tr key={s.id || s.student_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                    {student.name}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: '600', color: '#334155', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {student.prn}
                                  </td>
                                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      padding: '2px 7px',
                                      background: isMale ? '#eff6ff' : (isFemale ? '#fdf2f8' : '#f1f5f9'),
                                      color: isMale ? '#1d4ed8' : (isFemale ? '#be185d' : '#475569'),
                                      border: `1px solid ${isMale ? '#bfdbfe' : (isFemale ? '#fbcfe8' : '#e2e8f0')}`
                                    }}>
                                      {student.gender || '—'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                    {isDnr ? (
                                      <div>
                                        <span style={{ fontSize: '11px', fontWeight: '800', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          DNR (Did Not Report)
                                        </span>
                                        {student.dnr_marked_by_name && (
                                          <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                            by {student.dnr_marked_by_name}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <span style={{ fontSize: '11px', fontWeight: '700', borderRadius: '6px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          &lt;30% Att. ({student.attendance_percentage !== undefined && student.attendance_percentage !== null ? `${student.attendance_percentage}%` : 'Low'})
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.division}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.school}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.faculty}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.panel}
                                  </td>
                                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '500', borderRadius: '4px', background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '2px 6px' }}>
                                      {student.squad}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#475569', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.phone}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                                    {student.email}
                                  </td>
                                </tr>
                              );
                            })}
                            {filteredAbsentees.length === 0 && (
                              <tr>
                                <td colSpan="11" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                  {loadingAbsentees ? 'Loading absentee student data...' : 'No absent students found for this batch.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {filteredAbsentees.length > itemsPerPageAbs && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', marginTop: '12px', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ fontSize: '12.5px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                            Showing <span style={{ fontWeight: '600', color: '#0f172a' }}>{Math.min((absenteePage - 1) * itemsPerPageAbs + 1, filteredAbsentees.length)}</span> to{' '}
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{Math.min(absenteePage * itemsPerPageAbs, filteredAbsentees.length)}</span> of{' '}
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{filteredAbsentees.length}</span> absentees
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setAbsenteePage(prev => Math.max(prev - 1, 1))}
                              disabled={absenteePage === 1}
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                fontWeight: '500',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                color: absenteePage === 1 ? '#94a3b8' : '#334155',
                                cursor: absenteePage === 1 ? 'not-allowed' : 'pointer',
                                outline: 'none'
                              }}
                            >
                              Previous
                            </button>
                            {Array.from({ length: totalAbsPages }, (_, idx) => idx + 1)
                              .filter(page => page === 1 || page === totalAbsPages || Math.abs(page - absenteePage) <= 1)
                              .map((page, idx, arr) => {
                                const elements = [];
                                if (idx > 0 && page - arr[idx - 1] > 1) {
                                  elements.push(<span key={`ellipsis-abs-${page}`} style={{ color: '#94a3b8', fontSize: '12px', padding: '0 4px' }}>...</span>);
                                }
                                elements.push(
                                  <button
                                    key={page}
                                    onClick={() => setAbsenteePage(page)}
                                    style={{
                                      padding: '5px 10px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      borderRadius: '6px',
                                      border: '1px solid',
                                      borderColor: absenteePage === page ? '#0f172a' : '#cbd5e1',
                                      background: absenteePage === page ? '#0f172a' : '#ffffff',
                                      color: absenteePage === page ? '#ffffff' : '#334155',
                                      cursor: 'pointer',
                                      outline: 'none'
                                    }}
                                  >
                                    {page}
                                  </button>
                                );
                                return elements;
                              })}
                            <button
                              onClick={() => setAbsenteePage(prev => Math.min(prev + 1, totalAbsPages))}
                              disabled={absenteePage === totalAbsPages}
                              style={{
                                padding: '5px 10px',
                                fontSize: '12px',
                                fontWeight: '500',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                color: absenteePage === totalAbsPages ? '#94a3b8' : '#334155',
                                cursor: absenteePage === totalAbsPages ? 'not-allowed' : 'pointer',
                                outline: 'none'
                              }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Active Batch Faculty Advisors List */}
              {!isReadonly && (
                <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={16} style={{ color: '#2563eb' }} />
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui' }}>
                        Faculty Advisers assigned ({(batchSummary.faculty || []).filter(f => f.role !== 'ltc_member').filter(f => {
                          const q = overviewFacultySearch.toLowerCase()
                          return (f.name || '').toLowerCase().includes(q) ||
                            (f.email || '').toLowerCase().includes(q) ||
                            (f.department || '').toLowerCase().includes(q)
                        }).length} / {(batchSummary.faculty || []).filter(f => f.role !== 'ltc_member').length})
                      </h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0 14px', width: '280px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                      <Search size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
                      <input
                        type="text"
                        placeholder="Search faculty members..."
                        value={overviewFacultySearch}
                        onChange={e => setOverviewFacultySearch(e.target.value)}
                        style={{ border: 'none', background: 'none', width: '100%', height: '34px', outline: 'none', fontSize: '12.5px', color: '#0f172a' }}
                      />
                    </div>
                  </div>

                  <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Faculty Advisor Name</th>
                          <th>Email Address</th>
                          <th>Contact Phone</th>
                          <th>Department & School</th>
                          <th>Assigned Squad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(batchSummary.faculty || [])
                          .filter(f => f.role !== 'ltc_member')
                          .filter(f => {
                            const q = overviewFacultySearch.toLowerCase()
                            return (f.name || '').toLowerCase().includes(q) ||
                              (f.email || '').toLowerCase().includes(q) ||
                              (f.department || '').toLowerCase().includes(q)
                          })
                          .map((f, idx) => (
                            <tr key={f.id || idx}>
                              <td style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{f.name}</td>
                              <td style={{ color: '#334155' }}>{f.email}</td>
                              <td style={{ color: '#334155' }}>{f.phone || '—'}</td>
                              <td>
                                <div style={{ fontWeight: '600', fontSize: '12px', color: '#334155' }}>{f.department || '—'}</div>
                                {f.school && <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{f.school}</div>}
                              </td>
                              <td>
                                <span className="badge badge-purple" style={{ fontSize: '10px', fontWeight: '600', borderRadius: '9999px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 8px' }}>{f.squad || 'All Squads'}</span>
                              </td>
                            </tr>
                          ))}
                        {((batchSummary.faculty || []).filter(f => f.role !== 'ltc_member').length === 0) && (
                          <tr>
                            <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No faculty advisors assigned to this batch.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Active Batch LTC Members List */}
              {(() => {
                const rawSquadAssignedLtcMembers = (batchSummary?.faculty || []).filter(f =>
                  (f.role === 'ltc_member' || f.role === 'faculty') && Boolean(f.squad && f.squad.trim() !== '' && f.squad !== 'Unassigned' && f.squad !== 'All Squads' && f.squad !== 'Spare')
                );
                const squadAssignedLtcMembers = [...rawSquadAssignedLtcMembers].sort((a, b) => {
                  const rankA = getSquadRank(a.squad);
                  const rankB = getSquadRank(b.squad);
                  if (rankA !== rankB) return rankA - rankB;
                  const sqA = String(a.squad || '').trim();
                  const sqB = String(b.squad || '').trim();
                  const sqCmp = sqA.localeCompare(sqB, undefined, { numeric: true, sensitivity: 'base' });
                  if (sqCmp !== 0) return sqCmp;
                  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' });
                });
                const filteredLtcMembers = squadAssignedLtcMembers.filter(f => {
                  const q = overviewLtcSearch.toLowerCase()
                  return (f.name || '').toLowerCase().includes(q) ||
                    (f.email || '').toLowerCase().includes(q) ||
                    (f.department || '').toLowerCase().includes(q) ||
                    (f.squad || '').toLowerCase().includes(q)
                });
                const handleDownloadLtcExcel = () => {
                  if (!squadAssignedLtcMembers || squadAssignedLtcMembers.length === 0) {
                    if (showToast) showToast('No LTC coordinators with assigned squads to export.', 'warning')
                    return
                  }
                  const exportData = squadAssignedLtcMembers.map((f, idx) => ({
                    'S.No.': idx + 1,
                    'LTC Coordinator Name': f.name || '—',
                    'Email Address': f.email || '—',
                    'Contact Phone': f.phone || '—',
                    'Assigned Squad': f.squad || '—',
                    'Batch Name': batchSummary?.batch?.name || 'Active Batch'
                  }));
                  const worksheet = XLSX.utils.json_to_sheet(exportData);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, 'LTC Coordinators');
                  worksheet['!cols'] = [
                    { wch: 6 },
                    { wch: 25 },
                    { wch: 30 },
                    { wch: 16 },
                    { wch: 22 },
                    { wch: 20 }
                  ];
                  const batchName = (batchSummary?.batch?.name || 'Active_Batch').replace(/\s+/g, '_');
                  XLSX.writeFile(workbook, `LTC_Coordinators_Squad_List_${batchName}.xlsx`);
                  if (showToast) showToast('LTC Coordinators squad list downloaded successfully!', 'success');
                };

                return (
                  <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={16} style={{ color: '#4f46e5' }} />
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a', fontFamily: 'system-ui' }}>
                          LTC Members assigned ({filteredLtcMembers.length} / {squadAssignedLtcMembers.length})
                        </h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0 14px', width: '240px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                          <Search size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
                          <input
                            type="text"
                            placeholder="Search LTC members..."
                            value={overviewLtcSearch}
                            onChange={e => setOverviewLtcSearch(e.target.value)}
                            style={{ border: 'none', background: 'none', width: '100%', height: '34px', outline: 'none', fontSize: '12.5px', color: '#0f172a' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadLtcExcel}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '0 16px',
                            height: '34px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                            transition: 'all 0.2s ease',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}
                          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                          title="Download LTC Members list with assigned squads as Excel"
                        >
                          <Download size={14} />
                          <span>Download Excel</span>
                        </button>
                      </div>
                    </div>

                    <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>LTC Member Name</th>
                            <th>Email Address</th>
                            <th>Contact Phone</th>
                            <th>Assigned Squad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLtcMembers.map((f, idx) => (
                            <tr key={f.id || idx}>
                              <td style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{f.name}</td>
                              <td style={{ color: '#334155' }}>{f.email}</td>
                              <td style={{ color: '#334155' }}>{f.phone || '—'}</td>
                              <td>
                                <span className="badge badge-purple" style={{ fontSize: '10px', fontWeight: '600', borderRadius: '9999px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '2px 8px' }}>{f.squad}</span>
                              </td>
                            </tr>
                          ))}
                          {(squadAssignedLtcMembers.length === 0) && (
                            <tr>
                              <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No LTC members with assigned squads in this batch.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No current active batch data found.</div>
          )}
        </div>
      )}
      {/* Unified Download Center Modal - Responsive & Minimal */}
      {showDownloadModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '12px' : '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            width: '100%',
            maxWidth: '460px',
            maxHeight: isMobile ? 'calc(100vh - 32px)' : '85vh',
            overflow: 'hidden',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            margin: '0 auto'
          }}>
            {/* Fixed Solid Blue Header */}
            <div style={{
              background: '#154388',
              color: '#ffffff',
              padding: isMobile ? '12px 16px' : '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: isMobile ? '15px' : '16px', fontWeight: '700', color: '#ffffff', fontFamily: 'system-ui' }}>
                  Download Reports
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#bfdbfe', fontFamily: 'system-ui' }}>
                  Select a report type and batch to download Excel records.
                </p>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', opacity: 0.85, padding: '4px', display: 'flex' }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div style={{ padding: isMobile ? '12px 14px' : '14px 18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', minHeight: 0 }}>
              {[
                {
                  id: 'attendance',
                  title: 'Download Attendance',
                  desc: 'Session-wise ERP attendance Excel for selected batch',
                  requiresBatch: true
                },
                {
                  id: 'students',
                  title: 'Download Student List',
                  desc: 'Full student roster with PRN, squad, panel, and room allocation (supports squad-wise and panel-wise ascending export)',
                  requiresBatch: true
                },
                {
                  id: 'ltc',
                  title: 'Download LTC Coordinators',
                  desc: 'Squad-assigned LTC coordinators list with contact details',
                  requiresBatch: true
                },
                {
                  id: 'tshirt',
                  title: 'Download T-Shirt Sizes',
                  desc: 'T-shirt size distribution list for selected batch',
                  requiresBatch: true
                },
                {
                  id: 'rooms',
                  title: 'Download Room Allocation',
                  desc: 'Hostel room allotment records for selected batch',
                  requiresBatch: true
                },
                {
                  id: 'food_preferences',
                  title: 'Download Food Preferences',
                  desc: 'Squad-wise list of student Jain Food & Monday Fast dietary requirements',
                  requiresBatch: true
                },
                {
                  id: 'service_feedback',
                  title: 'Download Service Feedback',
                  desc: 'Complete Services & Trainers feedback with pillar ratings, activity evaluations & suggestions',
                  requiresBatch: true
                },
                {
                  id: 'batch_summary_pdf',
                  title: 'Download Official LTC Batch Report (PDF)',
                  desc: 'Official 6-page institutional program report matching LTC_template format with orientation, departure attendance & activity records',
                  requiresBatch: true
                }
              ].map(opt => {
                const isSelected = selectedDownloadOption === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedDownloadOption(opt.id)}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: isSelected ? '#f1f5f9' : '#ffffff',
                      borderRadius: '8px',
                      padding: isMobile ? '8px 12px' : '10px 14px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '600', color: '#0f172a' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px', lineHeight: 1.3 }}>
                          {opt.desc}
                        </div>
                      </div>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        minWidth: '14px',
                        borderRadius: '50%',
                        border: isSelected ? '4px solid #1d4ed8' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }} />
                    </div>

                    {/* Inline Compact Batch Dropdown if required and selected */}
                    {isSelected && opt.requiresBatch && (
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }} onClick={e => e.stopPropagation()}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '3px' }}>
                          Select Batch <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        {(!batches || batches.length === 0) ? (
                          <div style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#64748b', fontSize: '11.5px' }}>
                            No batches available.
                          </div>
                        ) : (
                          <select
                            value={modalSelectedBatchId}
                            onChange={(e) => setModalSelectedBatchId(e.target.value)}
                            style={{
                              width: '100%',
                              padding: isMobile ? '6px 8px' : '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-- Select Batch --</option>
                            {batches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name || `Batch #${b.id}`} {b.status ? `(${b.status.toUpperCase()})` : ''}
                              </option>
                            ))}
                          </select>
                        )}

                        {opt.id === 'attendance' && (
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                              Attendance Format <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0f172a', cursor: 'pointer', fontWeight: attendanceFormat === 'squad' ? '600' : '400' }}>
                                <input
                                  type="radio"
                                  name="attendanceFormat"
                                  value="squad"
                                  checked={attendanceFormat === 'squad'}
                                  onChange={() => setAttendanceFormat('squad')}
                                  style={{ accentColor: '#154388', cursor: 'pointer' }}
                                />
                                Squad-wise
                              </label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0f172a', cursor: 'pointer', fontWeight: attendanceFormat === 'panel' ? '600' : '400' }}>
                                <input
                                  type="radio"
                                  name="attendanceFormat"
                                  value="panel"
                                  checked={attendanceFormat === 'panel'}
                                  onChange={() => setAttendanceFormat('panel')}
                                  style={{ accentColor: '#154388', cursor: 'pointer' }}
                                />
                                Panel-wise
                              </label>
                            </div>
                          </div>
                        )}

                        {opt.id === 'students' && (
                          <div style={{ marginTop: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                              Roster Format <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0f172a', cursor: 'pointer', fontWeight: studentListFormat === 'all' ? '600' : '400' }}>
                                <input
                                  type="radio"
                                  name="studentListFormat"
                                  value="all"
                                  checked={studentListFormat === 'all'}
                                  onChange={() => setStudentListFormat('all')}
                                  style={{ accentColor: '#154388', cursor: 'pointer' }}
                                />
                                All Students
                              </label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0f172a', cursor: 'pointer', fontWeight: studentListFormat === 'squad' ? '600' : '400' }}>
                                <input
                                  type="radio"
                                  name="studentListFormat"
                                  value="squad"
                                  checked={studentListFormat === 'squad'}
                                  onChange={() => setStudentListFormat('squad')}
                                  style={{ accentColor: '#154388', cursor: 'pointer' }}
                                />
                                Squad-wise (Ascending)
                              </label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#0f172a', cursor: 'pointer', fontWeight: studentListFormat === 'panel' ? '600' : '400' }}>
                                <input
                                  type="radio"
                                  name="studentListFormat"
                                  value="panel"
                                  checked={studentListFormat === 'panel'}
                                  onChange={() => setStudentListFormat('panel')}
                                  style={{ accentColor: '#154388', cursor: 'pointer' }}
                                />
                                Panel-wise (Ascending)
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Fixed Footer Actions */}
            <div style={{
              padding: isMobile ? '10px 14px' : '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '8px',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowDownloadModal(false)}
                disabled={downloadingOption}
                style={{
                  padding: isMobile ? '8px 14px' : '7px 16px',
                  minHeight: '36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              {(() => {
                const isDisabled = downloadingOption || !modalSelectedBatchId || !batches || batches.length === 0
                return (
                  <button
                    onClick={handleExecuteUnifiedDownload}
                    disabled={isDisabled}
                    style={{
                      padding: isMobile ? '8px 18px' : '7px 20px',
                      minHeight: '36px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isDisabled ? '#cbd5e1' : '#16a34a',
                      color: '#ffffff',
                      fontWeight: '600',
                      fontSize: '12.5px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={13} color="#ffffff" strokeWidth={2.5} className={downloadingOption ? 'spin' : ''} />
                    {downloadingOption ? 'Downloading...' : 'Download'}
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

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
            {/* Header: Beautiful blue background */}
            <div style={{
              background: '#0057b8',
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
    </div>
  )
}
