import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import lottie from 'lottie-web'
import html2pdf from 'html2pdf.js'
import { generateSquadLeaderboardPdf } from '../utils/generateSquadLeaderboardPdf'
import {
  Trophy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
  RotateCcw,
  Clock,
  Award,
  FileSpreadsheet,
  ListOrdered,
  History,
  Eye,
  Crown,
  UserCheck,
  Layers,
  Download,
  FileText
} from 'lucide-react'

// Canonical Squad Names in LTC
const DEFAULT_SQUADS = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']

// 4 Immersion Days
const SQUAD_PERF_DAYS = ['Day 2', 'Day 3', 'Day 4', 'Day 5']

// All 14 Evaluated Categories with Exact Weights from Reference Excel (Total = 100%)
const SQUAD_CATEGORIES = [
  { key: 'punctuality', label: 'Punctuality', weight: '40%' },
  { key: 'discipline', label: 'Discipline', weight: '5%' },
  { key: 'room_cleaning', label: 'Room Cleaning', weight: '5%' },
  { key: 'food_serving', label: 'Food Serving', weight: '5%' },
  { key: 'coordination', label: 'Coordination, Courtesy, Maintain Discipline, Hygiene', weight: '5%' },
  { key: 'obstacles', label: 'Obstacles', weight: '5%' },
  { key: 'khokho', label: 'KhoKho', weight: '2.5%' },
  { key: 'debate', label: 'Debate', weight: '2.5%' },
  { key: 'quiz', label: 'Quiz', weight: '5%' },
  { key: 'agriculture', label: 'Agriculture', weight: '5%' },
  { key: 'sports', label: 'Sports', weight: '5%' },
  { key: 'team_building', label: 'Team Building', weight: '5%' },
  { key: 'patriotism', label: 'Patriotism', weight: '5%' },
  { key: 'spirituality', label: 'Spirituality', weight: '5%' }
]

// Special Activity Selection Rules
export const getActivityRule = (dayOrTitle, maybeTitle) => {
  const title = maybeTitle !== undefined ? maybeTitle : dayOrTitle
  const day = maybeTitle !== undefined ? dayOrTitle : null
  if (!title) return null
  const t = String(title).trim().toLowerCase()
  let rule = null
  if (t === 'quiz') rule = { requiredDay: 'Day 3', requiredCount: 2, rank: 1, points: 5, label: 'Select 2 Squads (5 pts each, max 10)' }
  else if (t === 'debate') rule = { requiredDay: 'Day 4', requiredCount: 5, rank: 1, points: 2, label: 'Select 5 Squads (2 pts each, max 10)' }
  else if (t === 'khokho' || t === 'kho kho' || t === 'kho-kho') rule = { requiredDay: 'Day 4', requiredCount: 5, rank: 1, points: 2, label: 'Select 5 Squads (2 pts each, max 10)' }
  else if (t === 'obstacle' || t === 'obstacles') rule = { requiredDay: 'Day 5', requiredCount: 10, isRanked: true, rank: 10, label: 'Rank 1–10 Squads (10 to 1 pts)' }
  else if (t === 'food serving' || t === 'food_serving' || t === 'foodserving') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 10, label: 'Select 1 Squad (Winner = 10 pts)' }
  else if (t === 'room cleaning' || t === 'room_cleaning' || t === 'room cleanliness' || t === 'roomcleaning') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 10, label: 'Select 1 Squad (Winner = 10 pts)' }
  else if (t === 'agriculture') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' }
  else if (t === 'sports') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' }
  else if (t === 'team building' || t === 'team_building') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' }
  else if (t === 'patriotism') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' }
  else if (t === 'spirituality') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' }

  if (rule && day && rule.requiredDay && String(rule.requiredDay).toLowerCase() !== String(day).toLowerCase()) {
    return null
  }
  return rule
}

// Helper to parse Fall-In positions mapping from JSON, key-value, string, or array
export const parseFallInPositions = (raw) => {
  const result = {}
  if (!raw) return result
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([sq, pos]) => {
      const p = parseInt(pos, 10)
      if (sq && !isNaN(p) && p >= 1 && p <= 10) {
        result[sq] = p
      }
    })
    return result
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return result
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([sq, pos]) => {
            const p = parseInt(pos, 10)
            if (sq && !isNaN(p) && p >= 1 && p <= 10) {
              result[sq] = p
            }
          })
          return result
        }
      } catch (e) {}
    }
    if (trimmed.includes(':')) {
      trimmed.split(',').forEach(part => {
        const [sqRaw, posRaw] = part.split(':')
        if (sqRaw && posRaw) {
          const p = parseInt(posRaw.trim(), 10)
          if (!isNaN(p) && p >= 1 && p <= 10) {
            result[sqRaw.trim()] = p
          }
        }
      })
      return result
    }
    const items = trimmed.split(',').map(s => s.trim()).filter(Boolean)
    items.forEach((sq, idx) => {
      if (idx < 10) {
        result[sq] = idx + 1
      }
    })
    return result
  }
  return result
}

// Integrated Lottie Trophy Component using public/trophy.json
function TrophyLottie({ size = 100 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    let anim = null
    if (containerRef.current) {
      try {
        anim = lottie.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/trophy.json'
        })
      } catch (err) {
        console.error('Error loading trophy lottie animation:', err)
      }
    }
    return () => {
      if (anim) anim.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        pointerEvents: 'none'
      }}
    />
  )
}

export default function SquadPerformanceTab({ token, apiBase, isMobile: propIsMobile, isReadonly: propIsReadonly, user, batches: propBatches = [] }) {
  // Local responsive mobile detector ensuring view adapts on any screen or rotation
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024))
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const isMobile = typeof propIsMobile === 'boolean' ? (propIsMobile || windowWidth < 768) : windowWidth < 768
  // Read-only super admins have full active access to Squad Performance like normal super admins
  const isReadonly = user?.role === 'superadmin_readonly' ? false : Boolean(propIsReadonly)

  // Resolve auth token with fallback to localStorage
  const getAuthToken = useCallback(() => {
    return (typeof token !== 'undefined' && token) ? token : (localStorage.getItem('token') || '');
  }, [token]);

  // Navigation view: 'activities' | 'leaderboard' | 'history'
  const [subView, setSubView] = useState('activities')

  // Leaderboard sub-filter: 'overall' | 'Day 2' | 'Day 3' | 'Day 4' | 'Day 5' | 'categories'
  const [leaderboardFilter, setLeaderboardFilter] = useState('overall')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  
  // Available batches and currently selected batch
  const [batchesList, setBatchesList] = useState(propBatches || [])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [currentBatch, setCurrentBatch] = useState(null)

  // Keep batchesList in sync if propBatches updates
  useEffect(() => {
    if (propBatches && propBatches.length > 0) {
      setBatchesList(prev => {
        if (prev.length === 0 || JSON.stringify(prev.map(b => b.id)) !== JSON.stringify(propBatches.map(b => b.id))) {
          return propBatches
        }
        return prev
      })
    }
  }, [propBatches])
  
  const [days, setDays] = useState(SQUAD_PERF_DAYS)
  const [selectedDay, setSelectedDay] = useState('Day 2')
  const [dayActivities, setDayActivities] = useState({})
  const [squadsList, setSquadsList] = useState(DEFAULT_SQUADS)
  const [selections, setSelections] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [dayLeaderboards, setDayLeaderboards] = useState({})
  const [historyBatches, setHistoryBatches] = useState([])
  const [squadCaptains, setSquadCaptains] = useState({})
  const [demographics, setDemographics] = useState(null)

  const getCaptainName = (sq) => {
    const c = squadCaptains[sq]
    if (!c) return '—'
    if (typeof c === 'string') return c
    if (typeof c === 'object') {
      return c.name || c.student_name || c.prn || '—'
    }
    return String(c)
  }
  
  // Expanded activity cards
  const [expandedActivities, setExpandedActivities] = useState({})
  
  // Expanded history batch cards
  const [expandedHistory, setExpandedHistory] = useState({})
  
  // Submitting / Saving state for a specific activity
  const [savingKey, setSavingKey] = useState(null)
  const saveVersionRef = useRef({})
  
  // Global Reset All Scores state & confirmation modal
  const [showResetAllModal, setShowResetAllModal] = useState(false)
  const [resettingAll, setResettingAll] = useState(false)
  
  // Toast notifications
  const [toast, setToast] = useState(null)
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch Squad Performance Data (defaults to active batch or requested batchId)
  const fetchData = useCallback(async (isManualRefresh = false, batchIdToFetch = null) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)
    
    const authToken = getAuthToken();
    try {
      const activeId = (batchIdToFetch !== null && batchIdToFetch !== undefined) ? batchIdToFetch : selectedBatchId;
      const queryParam = (activeId && activeId !== 'undefined' && activeId !== 'null') ? `?batchId=${encodeURIComponent(activeId)}` : '';

      const res = await fetch(`${apiBase}/api/superadmin/squad-performance${queryParam}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Failed to load data: ${res.statusText}`)
      }
      
      const data = await res.json()
      if (data.success) {
        setCurrentBatch(data.batch || null)
        if (data.batch?.id) {
          setSelectedBatchId(String(data.batch.id))
        }
        if (data.batches && data.batches.length > 0) {
          setBatchesList(data.batches)
        }
        if (data.days && data.days.length > 0) setDays(data.days)
        setDayActivities(data.dayActivities || {})
        if (data.squads && data.squads.length > 0) setSquadsList(data.squads)
        setSelections(data.selections || [])
        setLeaderboard(data.leaderboard || [])
        if (data.dayLeaderboards) setDayLeaderboards(data.dayLeaderboards)
        setHistoryBatches(data.history || [])
        if (data.captains) setSquadCaptains(data.captains)
        if (data.demographics) setDemographics(data.demographics)
      }
    } catch (err) {
      console.error('Error fetching squad performance data:', err)
      const friendlyMsg = err.message?.toLowerCase().includes('token')
        ? 'Your session has expired. Please refresh the page or log in again.'
        : (err.message || 'Error fetching squad performance data')
      showToast(friendlyMsg, 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [apiBase, getAuthToken, selectedBatchId])

  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle batch selection from dropdown
  const handleBatchChange = (newBatchId) => {
    setSelectedBatchId(newBatchId)
    fetchData(false, newBatchId)
  }

  // Download Excel
  const handleDownloadExcel = async () => {
    const authToken = getAuthToken();
    setDownloadingExcel(true)
    try {
      const batchParam = currentBatch?.id ? `?batchId=${currentBatch.id}` : ''
      const res = await fetch(`${apiBase}/api/superadmin/squad-performance/export-excel${batchParam}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || 'Failed to generate Excel export')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Squad_Performance_${(currentBatch?.name || 'Batch').replace(/\s+/g, '_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showToast('Excel workbook downloaded successfully', 'success')
    } catch (err) {
      console.error('Error downloading Excel:', err)
      showToast(err.message || 'Failed to download Excel', 'error')
    } finally {
      setDownloadingExcel(false)
    }
  }

  // Download High-Definition Leaderboard PDF
  const handleDownloadPdf = async () => {
    if (downloadingPdf) return
    if (!currentBatch) {
      showToast('No active batch selected to export PDF.', 'error')
      return
    }

    setDownloadingPdf(true)
    showToast('Generating official Leaderboard PDF...', 'info')

    try {
      await generateSquadLeaderboardPdf({
        currentBatch,
        leaderboard,
        bestCaptainLeaderboard,
        squadCaptains,
        canonicalObstacleRankings
      })
      showToast('Leaderboard PDF downloaded successfully!', 'success')
    } catch (err) {
      console.error('Error generating Leaderboard PDF:', err)
      showToast('Error generating PDF.', 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Map selections by unique key: `${day}_${activityTitle}`
  const selectionsMap = useMemo(() => {
    const map = {}
    selections.forEach(s => {
      const key = `${s.day}_${s.activity_title}`
      map[key] = s
    })
    return map
  }, [selections])

  // Current day activities list
  const currentActivities = useMemo(() => {
    return dayActivities[selectedDay] || []
  }, [dayActivities, selectedDay])

  // Separate activities into Punctuality (7) and Other (11)
  const punctualityActivities = useMemo(() => {
    return currentActivities.filter(a => a.category === 'Punctuality' || a.title.toLowerCase().includes('punctuality'))
  }, [currentActivities])

  const otherActivities = useMemo(() => {
    return currentActivities.filter(a => a.category !== 'Punctuality' && !a.title.toLowerCase().includes('punctuality'))
  }, [currentActivities])

  // Toggle activity expansion
  const toggleActivity = (activityKey) => {
    setExpandedActivities(prev => ({
      ...prev,
      [activityKey]: !prev[activityKey]
    }))
  }

  // Toggle history batch expansion
  const toggleHistoryBatch = (batchId) => {
    setExpandedHistory(prev => ({
      ...prev,
      [batchId]: !prev[batchId]
    }))
  }

  // Save activity selections (1st, 2nd, 3rd)
  const saveActivitySelection = async (day, activityTitle, firstSquad, secondSquad, thirdSquad, isLocked = false) => {
    if (isReadonly) {
      showToast('Action forbidden: You have view-only access.', 'error')
      return
    }
    const activityKey = `${day}_${activityTitle}`
    const thisVersion = Date.now()
    saveVersionRef.current[activityKey] = thisVersion

    // Optimistically update local selections immediately with zero lag
    setSelections(prev => {
      const copy = [...prev]
      const idx = copy.findIndex(s => s.day === day && s.activity_title === activityTitle)
      const entry = {
        batch_id: currentBatch?.id,
        day,
        activity_title: activityTitle,
        first_squad: firstSquad,
        second_squad: secondSquad,
        third_squad: thirdSquad,
        squad_name: firstSquad || '',
        is_locked: isLocked
      }
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], ...entry }
      } else {
        copy.push(entry)
      }
      return copy
    })

    const authToken = getAuthToken()

    try {
      const res = await fetch(`${apiBase}/api/superadmin/squad-performance/save-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          batchId: currentBatch?.id,
          day,
          activityTitle,
          firstSquad,
          secondSquad,
          thirdSquad,
          isLocked
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to save activity selection')
      }

      // Only apply backend response if no newer click occurred for this activity
      if (data.success && saveVersionRef.current[activityKey] === thisVersion) {
        if (data.allSelections) setSelections(data.allSelections)
        if (data.leaderboard) setLeaderboard(data.leaderboard)
        if (data.dayLeaderboards) setDayLeaderboards(data.dayLeaderboards)
        if (data.demographics) setDemographics(data.demographics)
      }
    } catch (err) {
      console.error('Error saving activity selection:', err)
      const friendlyMsg = err.message?.toLowerCase().includes('token')
        ? 'Your session has expired. Please refresh the page or log in again.'
        : (err.message || 'Failed to save selection')
      showToast(friendlyMsg, 'error')
      fetchData(true)
    }
  }

  // Fall-In Boys / Girls Squad Rank Change (1..10 or unassigned)
  const handleFallInRankChange = (activity, gender, squadName, newRankStr) => {
    if (isReadonly) {
      showToast('You have read-only access.', 'error')
      return
    }
    const activityKey = `${selectedDay}_${activity.title}`
    const existing = selectionsMap[activityKey]

    if (existing?.is_locked) {
      showToast('Activity is locked. Click Unlock to make changes.', 'error')
      return
    }

    const boysPositions = parseFallInPositions(existing?.first_squad !== undefined ? existing.first_squad : existing?.squad_name)
    const girlsPositions = parseFallInPositions(existing?.second_squad)

    const targetPositions = gender === 'boys' ? { ...boysPositions } : { ...girlsPositions }
    const newRank = newRankStr ? parseInt(newRankStr, 10) : null

    if (newRank && newRank >= 1 && newRank <= 10) {
      targetPositions[squadName] = newRank
    } else {
      delete targetPositions[squadName]
    }

    const boysUpdated = gender === 'boys' ? targetPositions : boysPositions
    const girlsUpdated = gender === 'girls' ? targetPositions : girlsPositions

    const boysPayload = Object.keys(boysUpdated).length > 0 ? JSON.stringify(boysUpdated) : null
    const girlsPayload = Object.keys(girlsUpdated).length > 0 ? JSON.stringify(girlsUpdated) : null

    saveActivitySelection(
      selectedDay,
      activity.title,
      boysPayload,
      girlsPayload,
      null,
      false
    )
  }

  // Reset activity selections
  const handleResetActivity = async (day, activityTitle, e) => {
    if (e) e.stopPropagation()
    if (isReadonly) {
      showToast('Action forbidden: You have view-only access.', 'error')
      return
    }
    const activityKey = `${day}_${activityTitle}`
    const existing = selectionsMap[activityKey]
    if (existing?.is_locked) {
      showToast('Activity is locked. Unlock it first before resetting.', 'error')
      return
    }

    setSavingKey(activityKey)
    const authToken = getAuthToken()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/squad-performance/reset-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          batchId: currentBatch?.id,
          day,
          activityTitle
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset activity')
      }

      if (data.success) {
        if (data.allSelections) setSelections(data.allSelections)
        if (data.leaderboard) setLeaderboard(data.leaderboard)
        if (data.dayLeaderboards) setDayLeaderboards(data.dayLeaderboards)
        showToast(`Reset ${activityTitle}`, 'success')
      }
    } catch (err) {
      console.error('Error resetting activity:', err)
      showToast(err.message || 'Failed to reset activity', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  // Global Reset All Scores across all days
  const handleResetAllScores = async () => {
    if (isReadonly) {
      showToast('Action forbidden: You have view-only access.', 'error')
      return
    }
    if (!currentBatch?.id) {
      showToast('No active batch found to reset', 'error')
      return
    }

    setResettingAll(true)
    const authToken = getAuthToken()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/squad-performance/reset-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          batchId: currentBatch.id
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset all squad performance scores')
      }

      if (data.success) {
        setSelections([])
        if (data.leaderboard) setLeaderboard(data.leaderboard)
        if (data.dayLeaderboards) setDayLeaderboards(data.dayLeaderboards)
        setShowResetAllModal(false)
        showToast('All squad performance scores and selections permanently reset', 'success')
        // Refresh to guarantee clean state across views
        await fetchData(true)
      }
    } catch (err) {
      console.error('Error resetting all scores:', err)
      showToast(err.message || 'Failed to reset all scores', 'error')
    } finally {
      setResettingAll(false)
    }
  }

  // Toggle Lock / Unlock for an activity
  const handleToggleLock = async (day, activityTitle, currentLockStatus, e) => {
    if (e) e.stopPropagation()
    if (isReadonly) {
      showToast('Action forbidden: You have view-only access.', 'error')
      return
    }
    const activityKey = `${day}_${activityTitle}`
    const existing = selectionsMap[activityKey]
    const targetLock = !currentLockStatus

    if (targetLock) {
      const isFallIn = String(activityTitle).trim().toLowerCase() === 'punctuality - fall in'
      const rule = isFallIn ? null : getActivityRule(day, activityTitle)
      if (isFallIn) {
        const boysPos = parseFallInPositions(existing?.first_squad !== undefined ? existing.first_squad : existing?.squad_name)
        const girlsPos = parseFallInPositions(existing?.second_squad)
        if (Object.keys(boysPos).length === 0 && Object.keys(girlsPos).length === 0) {
          showToast('Please make at least one selection before locking.', 'error')
          return
        }
      } else if (rule) {
        const s1 = (existing?.first_squad !== undefined ? (existing.first_squad || '') : (existing?.squad_name || '')).trim()
        const count = s1.split(',').map(s => s.trim()).filter(Boolean).length
        if (count !== rule.requiredCount) {
          showToast(`Please select exactly ${rule.requiredCount} squad(s) before locking.`, 'error')
          return
        }
      } else {
        // Validate that 1st, 2nd, and 3rd are all selected
        const s1 = (existing?.first_squad !== undefined ? (existing.first_squad || '').trim() : (existing?.squad_name || '').trim()) || null
        const s2 = (existing?.second_squad || '').trim() || null
        const s3 = (existing?.third_squad || '').trim() || null
        if (!s1 || !s2 || !s3) {
          showToast('Please select 1st, 2nd, and 3rd place before locking.', 'error')
          return
        }
      }
    }

    setSavingKey(activityKey)
    const authToken = getAuthToken()
    try {
      const res = await fetch(`${apiBase}/api/superadmin/squad-performance/toggle-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          batchId: currentBatch?.id,
          day,
          activityTitle,
          isLocked: targetLock
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update lock status')
      }

      if (data.success) {
        if (data.allSelections) setSelections(data.allSelections)
        if (data.leaderboard) setLeaderboard(data.leaderboard)
        if (data.dayLeaderboards) setDayLeaderboards(data.dayLeaderboards)
        showToast(targetLock ? 'Activity locked successfully' : 'Activity unlocked for editing', 'success')
      }
    } catch (err) {
      console.error('Error toggling lock status:', err)
      showToast(err.message || 'Failed to update lock status', 'error')
    } finally {
      setSavingKey(null)
    }
  }

  // Click-Order Selection: Click 1 = 1st, Click 2 = 2nd, Click 3 = 3rd (or multi-squad rule for Quiz, Debate, Kho Kho, Obstacle)
  const handleSquadClickOrder = (activity, squadName) => {
    if (isReadonly) {
      showToast('You have read-only access.', 'error')
      return
    }
    const activityKey = `${selectedDay}_${activity.title}`
    const existing = selectionsMap[activityKey]

    if (existing?.is_locked) {
      showToast('Activity is locked. Click Unlock to make changes.', 'error')
      return
    }

    const rule = activity.selectionRule || getActivityRule(selectedDay, activity.title)
    let s1 = (existing?.first_squad !== undefined ? (existing.first_squad || '').trim() : (existing?.squad_name || '').trim()) || null
    let s2 = (existing?.second_squad || '').trim() || null
    let s3 = (existing?.third_squad || '').trim() || null

    if (rule) {
      // Special rule: multiple squads all Rank 1
      let squadsArr = []
      if (typeof s1 === 'string') {
        squadsArr = s1.split(',').map(s => s.trim()).filter(Boolean)
      } else if (Array.isArray(s1)) {
        squadsArr = s1.map(s => s.trim()).filter(Boolean)
      }

      if (rule.requiredCount === 1) {
        if (squadsArr.includes(squadName)) {
          squadsArr = []
        } else {
          squadsArr = [squadName]
        }
      } else {
        if (squadsArr.includes(squadName)) {
          // Deselect
          squadsArr = squadsArr.filter(s => s !== squadName)
        } else {
          if (squadsArr.length >= rule.requiredCount) {
            showToast(`${rule.requiredCount} squad(s) already selected for ${activity.displayName || activity.title}. Deselect one before choosing another.`, 'error')
            return
          }
          squadsArr.push(squadName)
        }
      }

      saveActivitySelection(
        selectedDay,
        activity.title,
        squadsArr.join(', '),
        rule.isRanked ? (squadsArr[1] || null) : null,
        rule.isRanked ? (squadsArr[2] || null) : null,
        false
      )
      return
    }

    // Standard 1st -> 2nd -> 3rd selection
    // If clicking an already selected squad, deselect that squad
    if (s1 === squadName) {
      s1 = null
    } else if (s2 === squadName) {
      s2 = null
    } else if (s3 === squadName) {
      s3 = null
    } else {
      // If 3 squads are already selected, prevent selecting a 4th squad
      if (s1 && s2 && s3) {
        showToast('3 squads already selected (1st, 2nd, 3rd). Deselect one before choosing another.', 'error')
        return
      }

      // Assign to next available slot in order: 1st -> 2nd -> 3rd
      if (!s1) {
        s1 = squadName
      } else if (!s2) {
        s2 = squadName
      } else if (!s3) {
        s3 = squadName
      }
    }

    saveActivitySelection(selectedDay, activity.title, s1, s2, s3, false)
  }

  // Top 1 Champion for Leaderboard (Ranked by Overall Score)
  const top1 = leaderboard[0] || null

  // Compute Obstacle Standings for Day 5 and Obstacle tabs
  const obstSel = selectionsMap['Day 5_Obstacle'] || selectionsMap['Day 5_Obstacles']
  const rawObstSquads = (obstSel?.first_squad !== undefined ? (obstSel.first_squad || '') : (obstSel?.squad_name || '')).split(',').map(s => s.trim()).filter(Boolean)
  const obstacleRankings = squadsList
    .map(sq => {
      const lbItem = leaderboard.find(l => l.squad === sq)
      const rankIdx = rawObstSquads.indexOf(sq)
      const rank = lbItem?.obstacle_rank || (rankIdx >= 0 ? rankIdx + 1 : null)
      const points = lbItem?.obstacle_points || (rank ? 11 - rank : 0)
      const weightedScore = lbItem?.categoryScores?.obstacles ?? Number((points * 0.05).toFixed(4))
      return {
        squad: sq,
        rank,
        points,
        weightedScore,
        overallScore: lbItem?.overall_score || 0
      }
    })
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank
      if (a.rank) return -1
      if (b.rank) return 1
      return a.squad.localeCompare(b.squad)
    })

  // Best Captain: Determined ONLY by Punctuality ranking (Punctuality Rank 1 = Best Captain)
  const bestCaptainLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      const rankA = a.punctuality_rank ?? 99
      const rankB = b.punctuality_rank ?? 99
      if (rankA !== rankB) return rankA - rankB
      return (a.squad || '').localeCompare(b.squad || '')
    })
  }, [leaderboard])

  // Canonical Squad Ordering (1. Aditya, 2. Bhaskar, 3. Dinkar, 4. Divakar, 5. Mitra, 6. Martand, 7. Prabhakar, 8. Ravi, 9. Surya, 10. Tejonidhi)
  // Preserves genuine calculated ranks, medals, and scores while enforcing strict name-wise display order everywhere
  const canonicalLeaderboard = useMemo(() => {
    const hasAnyPointsOrWins = leaderboard.some(l => (l.overall_score || 0) > 0 || (l.first_count || 0) > 0 || (l.count || 0) > 0)

    const rankedLb = leaderboard.map((item, idx) => {
      const isParticipating = hasAnyPointsOrWins && ((item.overall_score || 0) > 0 || (item.first_count || 0) > 0 || (item.count || 0) > 0 || (item.total_first || 0) > 0)
      if (!isParticipating) return { ...item, assignedRank: null }
      if (idx === 0) return { ...item, assignedRank: 1 }
      const prev = leaderboard[idx - 1]
      const scoreDiff = Math.abs((item.overall_score || 0) - (prev.overall_score || 0))
      const samePunc = (item.punctuality_rank ?? 99) === (prev.punctuality_rank ?? 99)
      const sameFirst = (item.first_count || 0) === (prev.first_count || 0)
      const sameSecond = (item.second_count || 0) === (prev.second_count || 0)
      const sameThird = (item.third_count || 0) === (prev.third_count || 0)
      if (scoreDiff < 0.0001 && samePunc && sameFirst && sameSecond && sameThird) {
        const firstMatch = leaderboard.findIndex(x => 
          Math.abs((x.overall_score || 0) - (item.overall_score || 0)) < 0.0001 &&
          (x.punctuality_rank ?? 99) === (item.punctuality_rank ?? 99) &&
          (x.first_count || 0) === (item.first_count || 0)
        )
        return { ...item, assignedRank: firstMatch >= 0 ? firstMatch + 1 : 1 }
      }
      return { ...item, assignedRank: idx + 1 }
    })

    return DEFAULT_SQUADS.map(sq => {
      const found = rankedLb.find(l => l.squad === sq)
      const item = found || { squad: sq, overall_score: 0, first_count: 0, second_count: 0, third_count: 0, dayStats: {}, categoryScores: {} }
      const calculatedRank = item.assignedRank || null
      return {
        ...item,
        calculatedRank
      }
    })
  }, [leaderboard])

  // Independent Day-Wise Leaderboard for Day 2, Day 3, Day 4, Day 5
  // Scores, ranking, and highlighting are calculated strictly from that day's performance
  const canonicalDayLeaderboard = useMemo(() => {
    const activeDay = ['Day 2', 'Day 3', 'Day 4', 'Day 5'].includes(leaderboardFilter) ? leaderboardFilter : null
    if (!activeDay) return []

    const dayLb = dayLeaderboards[activeDay] || []
    const hasAnyPointsOrWins = dayLb.some(l => (l.overall_score || 0) > 0 || (l.first_count || 0) > 0 || (l.count || 0) > 0)

    // Assign rank with tie handling and 0-score exclusion
    const rankedDayLb = dayLb.map((item, idx) => {
      if (!hasAnyPointsOrWins) return { ...item, assignedRank: null }
      const isParticipating = (item.overall_score || 0) > 0 || (item.first_count || 0) > 0 || (item.count || 0) > 0
      if (!isParticipating) return { ...item, assignedRank: null }
      if (idx === 0) return { ...item, assignedRank: 1 }
      const prev = dayLb[idx - 1]
      const scoreDiff = Math.abs((item.overall_score || 0) - (prev.overall_score || 0))
      const samePunc = (item.punctuality_rank ?? 99) === (prev.punctuality_rank ?? 99)
      const sameFirst = (item.first_count || 0) === (prev.first_count || 0)
      const sameSecond = (item.second_count || 0) === (prev.second_count || 0)
      const sameThird = (item.third_count || 0) === (prev.third_count || 0)
      if (scoreDiff < 0.0001 && samePunc && sameFirst && sameSecond && sameThird) {
        const firstMatch = dayLb.findIndex(x => 
          Math.abs((x.overall_score || 0) - (item.overall_score || 0)) < 0.0001 &&
          (x.punctuality_rank ?? 99) === (item.punctuality_rank ?? 99) &&
          (x.first_count || 0) === (item.first_count || 0)
        )
        return { ...item, assignedRank: firstMatch >= 0 ? firstMatch + 1 : 1 }
      }
      return { ...item, assignedRank: idx + 1 }
    })

    return DEFAULT_SQUADS.map(sq => {
      const found = rankedDayLb.find(l => l.squad === sq)
      const item = found || { squad: sq, overall_score: 0, first_count: 0, second_count: 0, third_count: 0 }
      const calculatedRank = item.assignedRank || null
      // Squad is highlighted in yellow if it holds Rank 1 and actually performed / won on this day
      const isDayWinner = calculatedRank === 1 && hasAnyPointsOrWins && ((item.overall_score || 0) > 0 || (item.first_count || 0) > 0 || (item.count || 0) > 0)
      return {
        ...item,
        calculatedRank,
        isDayWinner
      }
    })
  }, [leaderboardFilter, dayLeaderboards])

  const canonicalObstacleRankings = useMemo(() => {
    return DEFAULT_SQUADS.map(sq => {
      const found = obstacleRankings.find(o => o.squad === sq)
      return found || { squad: sq, rank: null, points: 0, weightedScore: 0, overallScore: 0 }
    })
  }, [obstacleRankings])

  const canonicalBestCaptainList = useMemo(() => {
    return DEFAULT_SQUADS.map(sq => {
      const found = bestCaptainLeaderboard.find(b => b.squad === sq)
      const item = found || { squad: sq, punctuality_rank: null, punctuality_points: 0, overall_score: 0 }
      const captainRank = item.punctuality_rank || null
      return {
        ...item,
        captainRank
      }
    })
  }, [bestCaptainLeaderboard])

  return (
    <div style={{
      width: '100%',
      maxWidth: '100%',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '12px' : '20px',
      padding: isMobile ? '2px 0px 32px' : '6px 8px 44px',
      boxSizing: 'border-box',
      minWidth: 0,
      overflowX: 'hidden'
    }}>
      
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '18px',
          right: '18px',
          zIndex: 999999,
          background: toast.type === 'error' ? '#ef4444' : '#0f172a',
          color: '#ffffff',
          padding: '10px 16px',
          borderRadius: '8px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} color="#4ade80" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Global Reset All Scores Confirmation Modal */}
      {showResetAllModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #fecdd3',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#ffe4e6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={22} color="#e11d48" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Reset All Squad Scores?
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                  {currentBatch?.name || 'Active Batch'} · Irreversible Action
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Are you sure? This will permanently reset ALL Squad Performance scores and selections for <strong>{currentBatch?.name || 'the selected batch'}</strong>.
            </p>

            <div style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: '#9f1239',
              fontWeight: '600'
            }}>
              ⚠️ All 1st, 2nd, and 3rd selections, medal counts, category scores, and leaderboard standings across Day 2 to Day 5 will be reset to zero.
            </div>

            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column-reverse' : 'row',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '4px'
            }}>
              <button
                onClick={() => setShowResetAllModal(false)}
                disabled={resettingAll}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '650',
                  cursor: resettingAll ? 'not-allowed' : 'pointer',
                  textAlign: 'center'
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleResetAllScores}
                disabled={resettingAll}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '750',
                  cursor: resettingAll ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)'
                }}
              >
                {resettingAll ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                <span>{resettingAll ? 'Resetting All...' : 'Yes, Reset All Scores'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Header & Top Navigation Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '10px' : '14px',
        paddingBottom: isMobile ? '12px' : '16px',
        borderBottom: '1px solid #e2e8f0',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Row 1: Title + Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '8px' : '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Left: Title & Read-only indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMobile ? 'space-between' : 'flex-start',
            gap: isMobile ? '8px' : '12px',
            width: isMobile ? '100%' : 'auto'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? '18px' : '21px',
              fontWeight: '850',
              color: '#0f172a',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Trophy size={isMobile ? 18 : 22} color="#d97706" />
              <span>Squad Performance</span>
            </h2>

            {/* Read-Only Badge (if applicable) */}
            {isReadonly && (
              <span style={{
                fontSize: '10px',
                fontWeight: '750',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <Eye size={10} /> Read-Only
              </span>
            )}
          </div>

          {/* Right: Compact Action buttons (PDF, Excel, Reset All, Refresh) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: isMobile ? '100%' : 'auto',
            boxSizing: 'border-box'
          }}>
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !currentBatch}
              style={{
                flex: isMobile ? 1 : 'initial',
                padding: isMobile ? '7px 8px' : '7px 13px',
                background: '#154388',
                border: '1px solid #154388',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: isMobile ? '11.5px' : '12px',
                fontWeight: '750',
                cursor: downloadingPdf || !currentBatch ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 1px 2px rgba(21, 67, 136, 0.2)',
                whiteSpace: 'nowrap'
              }}
              title="Download High-Definition PDF Leaderboard"
            >
              <Download size={13} color="#ffffff" className={downloadingPdf ? 'animate-bounce' : ''} />
              <span>{downloadingPdf ? 'Exporting...' : 'PDF'}</span>
            </button>

            {/* Download Excel Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={downloadingExcel || !currentBatch}
              style={{
                flex: isMobile ? 1 : 'initial',
                padding: isMobile ? '7px 8px' : '7px 13px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: isMobile ? '11.5px' : '12px',
                fontWeight: '700',
                cursor: downloadingExcel || !currentBatch ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                whiteSpace: 'nowrap'
              }}
              title="Download Excel Workbook"
            >
              <FileSpreadsheet size={13} color="#15803d" />
              <span>{downloadingExcel ? 'Exporting...' : 'Excel'}</span>
            </button>

            {/* Global Reset All Scores Button (Hidden if isReadonly) */}
            {!isReadonly && (
              <button
                onClick={() => setShowResetAllModal(true)}
                disabled={loading || !currentBatch}
                style={{
                  padding: isMobile ? '7px 9px' : '7px 12px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '6px',
                  color: '#e11d48',
                  fontSize: isMobile ? '11.5px' : '12px',
                  fontWeight: '700',
                  cursor: loading || !currentBatch ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Reset all squad performance scores and selections"
              >
                <RotateCcw size={12} color="#e11d48" />
                <span>Reset</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              style={{
                padding: isMobile ? '7px 9px' : '7px 9px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#64748b',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 2: Batch Selector Capsule */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#ffffff',
          padding: isMobile ? '6px 10px' : '7px 12px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '750',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0
          }}>
            <Layers size={13} color="#154388" />
            Batch:
          </span>
          <div style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '260px' }}>
            <select
              value={selectedBatchId || (currentBatch?.id ? String(currentBatch.id) : '')}
              onChange={(e) => handleBatchChange(e.target.value)}
              disabled={loading || refreshing}
              style={{
                width: '100%',
                appearance: 'none',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '5px 26px 5px 8px',
                fontSize: isMobile ? '12px' : '12.5px',
                fontWeight: '700',
                color: '#0f172a',
                cursor: loading || refreshing ? 'wait' : 'pointer',
                outline: 'none',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
            >
              {batchesList.length === 0 && currentBatch && (
                <option value={currentBatch.id}>{currentBatch.name}</option>
              )}
              {batchesList.map(b => {
                const isActive = ['active', 'immersion'].includes(String(b.status || '').toLowerCase())
                return (
                  <option key={b.id} value={b.id}>
                    {b.name} {isActive ? '• Active' : `(${b.status ? (b.status.charAt(0).toUpperCase() + b.status.slice(1)) : 'Past'})`}
                  </option>
                )
              })}
            </select>
            <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
          </div>
        </div>

        {/* Row 3: Segmented View Switcher Tabs (Activities | Leaderboard | History) */}
        <div style={{
          width: '100%',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          background: '#f1f5f9',
          borderRadius: '8px',
          padding: '3px',
          gap: '3px'
        }}>
          {[
            { key: 'activities', label: 'Activities', icon: ListOrdered },
            { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
            { key: 'history', label: 'History', icon: History }
          ].map(tab => {
            const active = subView === tab.key
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setSubView(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isMobile ? '4px' : '6px',
                  padding: isMobile ? '7px 4px' : '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#154388' : '#64748b',
                  fontSize: isMobile ? '12px' : '12.5px',
                  fontWeight: active ? '800' : '650',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.12s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={isMobile ? 14 : 15} color={active ? '#154388' : '#94a3b8'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: ACTIVITIES (Day 2, Day 3, Day 4, Day 5 — 18 Activities each)
          ========================================================================= */}
      {subView === 'activities' && (
        !currentBatch && !loading ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '40px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Trophy size={26} color="#154388" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              No Active Batch
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Squad Performance will be enabled when a batch becomes active.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '18px' }}>
            
            {/* 4 Days Selector (Day 2, Day 3, Day 4, Day 5) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '3px',
              gap: '3px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {days.map(dayName => {
                const isCurrent = selectedDay === dayName
                const acts = dayActivities[dayName] || []
                const totalDayActs = acts.length
                const completedCount = acts.filter(a => {
                  const s = selectionsMap[`${dayName}_${a.title}`]
                  if (!s) return false
                  const rule = a.selectionRule || getActivityRule(dayName, a.title)
                  if (rule) {
                    const s1Val = (s.first_squad !== undefined ? (s.first_squad || '') : (s.squad_name || '')).trim()
                    const count = s1Val.split(',').map(x => x.trim()).filter(Boolean).length
                    return count === rule.requiredCount
                  }
                  const s1Val = (s.first_squad !== undefined ? (s.first_squad || '') : (s.squad_name || '')).trim()
                  return Boolean(s1Val && (s.second_squad || '').trim() && (s.third_squad || '').trim())
                }).length
                const lockedCount = acts.filter(a => {
                  const s = selectionsMap[`${dayName}_${a.title}`]
                  return s && s.is_locked
                }).length

                return (
                  <button
                    key={dayName}
                    onClick={() => setSelectedDay(dayName)}
                    style={{
                      padding: isMobile ? '6px 2px' : '8px 4px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isCurrent
                        ? '#154388'
                        : 'transparent',
                      color: isCurrent ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '800' }}>{dayName}</span>
                    {lockedCount > 0 && <Lock size={isMobile ? 8 : 9} color={isCurrent ? '#ffffff' : '#059669'} />}
                  </button>
                )
              })}
            </div>

            {/* Render Activity Card Groups */}
            {[
              {
                title: 'Punctuality',
                acts: punctualityActivities,
                isPunc: true
              },
              {
                title: selectedDay === 'Day 5'
                  ? 'Core & Obstacle Activities'
                  : (selectedDay === 'Day 4'
                    ? 'Debate & Kho Kho'
                    : (selectedDay === 'Day 3'
                      ? 'Quiz Competition'
                      : 'General Activities')),
                acts: otherActivities,
                isPunc: false
              }
            ].map((section, sIdx) => {
              const { title, acts, isPunc } = section
              if (acts.length === 0) return null

              return (
                <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  
                  {/* Minimal Section Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isPunc ? <Clock size={13} color="#154388" /> : <Award size={13} color="#d97706" />}
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {title}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      color: '#64748b',
                      fontWeight: '700',
                      background: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: '4px'
                    }}>
                      {acts.length}
                    </span>
                  </div>

                  {/* Activities List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {acts.map((activity, aIdx) => {
                      const activityKey = `${selectedDay}_${activity.title}`
                      const selection = selectionsMap[activityKey]
                      const s1 = (selection?.first_squad !== undefined ? (selection.first_squad || '').trim() : (selection?.squad_name || '').trim()) || null
                      const s2 = (selection?.second_squad || '').trim() || null
                      const s3 = (selection?.third_squad || '').trim() || null
                      const isLocked = Boolean(selection?.is_locked)
                      const isFallIn = String(activity.title).trim().toLowerCase() === 'punctuality - fall in'
                      const boysPositions = isFallIn ? parseFallInPositions(s1) : {}
                      const girlsPositions = isFallIn ? parseFallInPositions(s2) : {}
                      const rule = isFallIn ? null : getActivityRule(selectedDay, activity.title)
                      const ruleSquads = rule && s1 ? s1.split(',').map(s => s.trim()).filter(Boolean) : []
                      const isComplete = isFallIn
                        ? (Object.keys(boysPositions).length > 0 || Object.keys(girlsPositions).length > 0)
                        : (rule ? (ruleSquads.length === rule.requiredCount) : Boolean(s1 && s2 && s3))
                      const isExpanded = expandedActivities[activityKey] !== false
                      const isSaving = savingKey === activityKey

                      return (
                        <div
                          key={activityKey}
                          style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: isLocked
                              ? '1.5px solid #86efac'
                              : (isComplete ? '1.5px solid #cbd5e1' : '1.5px solid #e2e8f0'),
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Activity Card Header */}
                          <div
                            onClick={() => toggleActivity(activityKey)}
                            style={{
                              padding: isMobile ? '8px 10px' : '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                              cursor: 'pointer',
                              background: isLocked
                                ? '#f0fdf4'
                                : (isComplete ? '#f8fafc' : '#ffffff'),
                              userSelect: 'none'
                            }}
                          >
                            {/* Left: Index & Title & Rule Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                              <div style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '4px',
                                background: isLocked ? '#dcfce7' : (isComplete ? '#e0e7ff' : '#f1f5f9'),
                                color: isLocked ? '#15803d' : (isComplete ? '#3730a3' : '#64748b'),
                                fontSize: '9.5px',
                                fontWeight: '800',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {aIdx + (isPunc ? 1 : punctualityActivities.length + 1)}
                              </div>

                              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                <span style={{
                                  fontSize: isMobile ? '12px' : '13.5px',
                                  fontWeight: '750',
                                  color: '#0f172a',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {activity.displayName || activity.title}
                                </span>
                                {isFallIn ? (
                                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#1e40af' }}>
                                    👦 Boys ({Object.keys(boysPositions).length} selected) | 👧 Girls ({Object.keys(girlsPositions).length} selected)
                                  </span>
                                ) : rule ? (
                                  <span style={{ fontSize: '9.5px', fontWeight: '650', color: '#b45309' }}>
                                    {rule.requiredCount === 1 ? `1 Winner (${rule.points || 2} pts)` : (rule.isRanked ? 'Rank 1–10' : `${rule.requiredCount} Squads`)}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Right: Controls (Reset, Lock) + Chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              {!isReadonly && (
                                <>
                                  {/* Reset Button */}
                                  <button
                                    onClick={(e) => handleResetActivity(selectedDay, activity.title, e)}
                                    disabled={isLocked || isSaving || (!s1 && !s2 && !s3)}
                                    style={{
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: (s1 || s2 || s3) && !isLocked ? '#475569' : '#cbd5e1',
                                      fontSize: '9.5px',
                                      fontWeight: '700',
                                      cursor: (s1 || s2 || s3) && !isLocked ? 'pointer' : 'not-allowed',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '2px'
                                    }}
                                    title="Reset selections"
                                  >
                                    <RotateCcw size={9} />
                                    <span>Reset</span>
                                  </button>

                                  {/* Lock / Unlock Button */}
                                  <button
                                    onClick={(e) => handleToggleLock(selectedDay, activity.title, isLocked, e)}
                                    disabled={isSaving || (!isLocked && !isComplete)}
                                    style={{
                                      padding: isMobile ? '5px 9px' : '5px 11px',
                                      borderRadius: '6px',
                                      border: isLocked ? '1px solid #86efac' : (isComplete ? '1px solid #bfdbfe' : '1px solid #e2e8f0'),
                                      background: isLocked ? '#dcfce7' : (isComplete ? '#eff6ff' : '#f8fafc'),
                                      color: isLocked ? '#166534' : (isComplete ? '#154388' : '#94a3b8'),
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: isLocked || isComplete ? 'pointer' : 'not-allowed',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      transition: 'all 0.1s ease'
                                    }}
                                  >
                                    {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                    <span>{isLocked ? 'Locked' : 'Lock'}</span>
                                  </button>
                                </>
                              )}

                              {isReadonly && isLocked && (
                                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#166534', background: '#dcfce7', padding: '3px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Lock size={10} /> Locked
                                </span>
                              )}

                              <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Squad Click Grid */}
                          {isExpanded && (
                            <div style={{
                              padding: isMobile ? '14px 14px 16px' : '16px 20px 20px',
                              background: '#f8fafc',
                              borderTop: '1px solid #f1f5f9'
                            }}>
                              {isFallIn ? (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                  gap: '14px',
                                  alignItems: 'start'
                                }}>
                                  {/* LEFT COLUMN: 👦 Boys Fall-In */}
                                  <div style={{
                                    background: '#ffffff',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                  }}>
                                    {/* Heading & Formula */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingBottom: '10px',
                                      marginBottom: '10px',
                                      borderBottom: '1px solid #f1f5f9',
                                      flexWrap: 'wrap',
                                      gap: '6px'
                                    }}>
                                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                        👦 Boys Fall-In
                                      </span>
                                    </div>

                                    {/* 10 Squads Vertical List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {squadsList.map(sq => {
                                        const rank = boysPositions[sq] || ''
                                        const sqBoys = demographics?.squads?.[sq]?.boys ?? 0
                                        const sqGirls = demographics?.squads?.[sq]?.girls ?? 0
                                        const sqTotal = sqBoys + sqGirls
                                        const boysSharePct = sqTotal > 0 ? ((sqBoys / sqTotal) * 100).toFixed(2) : '50.00'
                                        const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5
                                        const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''))
                                        const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0
                                        const sqPts = rank ? Number((boysShare * multiplier).toFixed(2)) : null

                                        return (
                                          <div
                                            key={`boys_row_${sq}`}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '6px 10px',
                                              borderRadius: '6px',
                                              background: rank ? '#eff6ff' : '#ffffff',
                                              border: rank ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                              transition: 'all 0.12s ease'
                                            }}
                                          >
                                            {/* Left: Squad Name + Breakdown */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                              <span style={{
                                                fontSize: '12.5px',
                                                fontWeight: rank ? '700' : '600',
                                                color: rank ? '#1e40af' : '#1e293b',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {sq}
                                              </span>
                                              {rank && sqPts !== null ? (
                                                <span style={{
                                                  fontSize: '11px',
                                                  fontWeight: '700',
                                                  color: '#1e40af',
                                                  background: '#dbeafe',
                                                  padding: '1px 6px',
                                                  borderRadius: '4px',
                                                  whiteSpace: 'nowrap'
                                                }}>
                                                  {medal ? `${medal} ` : ''}{sqBoys} boys ({boysSharePct}%) → {sqPts.toFixed(2)} pts
                                                </span>
                                              ) : (
                                                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                                  {sqBoys} boys ({boysSharePct}%)
                                                </span>
                                              )}
                                            </div>

                                            {/* Right: Dropdown 1-10 */}
                                            <select
                                              value={rank}
                                              onChange={(e) => handleFallInRankChange(activity, 'boys', sq, e.target.value)}
                                              disabled={isLocked || isReadonly}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: '5px',
                                                border: rank ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                                background: rank ? '#ffffff' : '#ffffff',
                                                color: rank ? '#1e40af' : '#475569',
                                                fontSize: '12px',
                                                fontWeight: rank ? '700' : '500',
                                                cursor: (isLocked || isReadonly) ? 'not-allowed' : 'pointer',
                                                minWidth: '55px',
                                                height: '28px',
                                                boxSizing: 'border-box'
                                              }}
                                            >
                                              <option value="">—</option>
                                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* RIGHT COLUMN: 👧 Girls Fall-In */}
                                  <div style={{
                                    background: '#ffffff',
                                    padding: '14px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                  }}>
                                    {/* Heading */}
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingBottom: '10px',
                                      marginBottom: '10px',
                                      borderBottom: '1px solid #f1f5f9',
                                      flexWrap: 'wrap',
                                      gap: '6px'
                                    }}>
                                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                        👧 Girls Fall-In
                                      </span>
                                    </div>

                                    {/* 10 Squads Vertical List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {squadsList.map(sq => {
                                        const rank = girlsPositions[sq] || ''
                                        const sqBoys = demographics?.squads?.[sq]?.boys ?? 0
                                        const sqGirls = demographics?.squads?.[sq]?.girls ?? 0
                                        const sqTotal = sqBoys + sqGirls
                                        const girlsSharePct = sqTotal > 0 ? ((sqGirls / sqTotal) * 100).toFixed(2) : '50.00'
                                        const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5
                                        const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''))
                                        const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0
                                        const sqPts = rank ? Number((girlsShare * multiplier).toFixed(2)) : null

                                        return (
                                          <div
                                            key={`girls_row_${sq}`}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '6px 10px',
                                              borderRadius: '6px',
                                              background: rank ? '#fdf2f8' : '#ffffff',
                                              border: rank ? '1px solid #fbcfe8' : '1px solid #e2e8f0',
                                              transition: 'all 0.12s ease'
                                            }}
                                          >
                                            {/* Left: Squad Name + Breakdown */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                              <span style={{
                                                fontSize: '12.5px',
                                                fontWeight: rank ? '700' : '600',
                                                color: rank ? '#9d174d' : '#1e293b',
                                                whiteSpace: 'nowrap'
                                              }}>
                                                {sq}
                                              </span>
                                              {rank && sqPts !== null ? (
                                                <span style={{
                                                  fontSize: '11px',
                                                  fontWeight: '700',
                                                  color: '#be185d',
                                                  background: '#fce7f3',
                                                  padding: '1px 6px',
                                                  borderRadius: '4px',
                                                  whiteSpace: 'nowrap'
                                                }}>
                                                  {medal ? `${medal} ` : ''}{sqGirls} girls ({girlsSharePct}%) → {sqPts.toFixed(2)} pts
                                                </span>
                                              ) : (
                                                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                                  {sqGirls} girls ({girlsSharePct}%)
                                                </span>
                                              )}
                                            </div>

                                            {/* Right: Dropdown 1-10 */}
                                            <select
                                              value={rank}
                                              onChange={(e) => handleFallInRankChange(activity, 'girls', sq, e.target.value)}
                                              disabled={isLocked || isReadonly}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: '5px',
                                                border: rank ? '1.5px solid #ec4899' : '1px solid #cbd5e1',
                                                background: rank ? '#ffffff' : '#ffffff',
                                                color: rank ? '#be185d' : '#475569',
                                                fontSize: '12px',
                                                fontWeight: rank ? '700' : '500',
                                                cursor: (isLocked || isReadonly) ? 'not-allowed' : 'pointer',
                                                minWidth: '55px',
                                                height: '28px',
                                                boxSizing: 'border-box'
                                              }}
                                            >
                                              <option value="">—</option>
                                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  {/* Fall-In Squad Total Summary Breakdown */}
                                  <div style={{
                                    gridColumn: '1 / -1',
                                    background: '#ffffff',
                                    padding: '14px 16px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingBottom: '8px',
                                      marginBottom: '10px',
                                      borderBottom: '1px solid #f1f5f9',
                                      flexWrap: 'wrap',
                                      gap: '6px'
                                    }}>
                                      <span style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a' }}>
                                        📊 Squad Fall-In Score Summary
                                      </span>
                                    </div>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                      gap: '10px'
                                    }}>
                                      {squadsList.map(sq => {
                                        const bRank = boysPositions[sq]
                                        const gRank = girlsPositions[sq]
                                        const sqBoys = demographics?.squads?.[sq]?.boys ?? 0
                                        const sqGirls = demographics?.squads?.[sq]?.girls ?? 0
                                        const sqTotal = sqBoys + sqGirls

                                        const boysSharePct = sqTotal > 0 ? ((sqBoys / sqTotal) * 100).toFixed(2) : '50.00'
                                        const girlsSharePct = sqTotal > 0 ? ((sqGirls / sqTotal) * 100).toFixed(2) : '50.00'

                                        const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5
                                        const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5

                                        const bMult = bRank >= 1 && bRank <= 10 ? (11 - bRank) : 0
                                        const gMult = gRank >= 1 && gRank <= 10 ? (11 - gRank) : 0

                                        const bScore = bRank ? (boysShare * bMult) : 0
                                        const gScore = gRank ? (girlsShare * gMult) : 0
                                        const totalScore = Number((bScore + gScore).toFixed(2))
                                        const hasAny = Boolean(bRank || gRank)

                                        return (
                                          <div
                                            key={`fallin_summary_${sq}`}
                                            style={{
                                              padding: '10px 12px',
                                              borderRadius: '6px',
                                              background: hasAny ? '#f0fdf4' : '#f8fafc',
                                              border: hasAny ? '1px solid #86efac' : '1px solid #e2e8f0',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: '4px'
                                            }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>{sq}</span>
                                              <span style={{ fontSize: '13px', fontWeight: '800', color: hasAny ? '#15803d' : '#64748b' }}>
                                                Fall-In Total: {totalScore.toFixed(2)} pts
                                              </span>
                                            </div>
                                            <div style={{ fontSize: '11.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <div>
                                                👦 {sqBoys} boys ({boysSharePct}%) → {bScore.toFixed(2)} pts
                                              </div>
                                              <div>
                                                👧 {sqGirls} girls ({girlsSharePct}%) → {gScore.toFixed(2)} pts
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {rule && !rule.isRanked && (
                                    <div style={{
                                      marginBottom: '10px',
                                      padding: '7px 12px',
                                      background: '#fffbeb',
                                      border: '1px solid #fde68a',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      color: '#92400e',
                                      fontWeight: '600',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '6px'
                                    }}>
                                      <span>{rule.label}: Click to toggle squad selection.</span>
                                      <span style={{
                                        fontWeight: '800',
                                        background: ruleSquads.length === rule.requiredCount ? '#dcfce7' : '#fef3c7',
                                        color: ruleSquads.length === rule.requiredCount ? '#166534' : '#b45309',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        border: ruleSquads.length === rule.requiredCount ? '1px solid #86efac' : '1px solid #fcd34d'
                                      }}>
                                        {ruleSquads.length} / {rule.requiredCount} Selected
                                      </span>
                                    </div>
                                  )}

                                  {/* 10 Squad Buttons Grid */}
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                                    gap: isMobile ? '6px' : '7px'
                                  }}>
                                    {squadsList.map(sq => {
                                      const rankIdx = rule && rule.isRanked ? ruleSquads.indexOf(sq) : -1
                                      const sqRank = rankIdx >= 0 ? rankIdx + 1 : null
                                      const sqPts = sqRank ? (11 - sqRank) : 0
                                      const isRuleSelected = rule ? ruleSquads.includes(sq) : false
                                      const is1st = !rule && s1 === sq
                                      const is2nd = !rule && s2 === sq
                                      const is3rd = !rule && s3 === sq
                                      const isSelected = rule ? isRuleSelected : (is1st || is2nd || is3rd)

                                      // Dynamic border & background based on rank (Solid colors, zero glassmorphism)
                                      let btnBorder = '1.5px solid #cbd5e1'
                                      let btnBg = '#ffffff'
                                      let btnColor = '#1e293b'

                                      if (rule && rule.isRanked && sqRank) {
                                        if (sqRank === 1) {
                                          btnBorder = '2px solid #d97706'
                                          btnBg = '#fffbeb'
                                          btnColor = '#78350f'
                                        } else if (sqRank === 2) {
                                          btnBorder = '2px solid #64748b'
                                          btnBg = '#f1f5f9'
                                          btnColor = '#0f172a'
                                        } else if (sqRank === 3) {
                                          btnBorder = '2px solid #ea580c'
                                          btnBg = '#fff7ed'
                                          btnColor = '#7c2d12'
                                        } else {
                                          btnBorder = '2px solid #3b82f6'
                                          btnBg = '#eff6ff'
                                          btnColor = '#1e3a8a'
                                        }
                                      } else if ((rule && !rule.isRanked && isRuleSelected) || is1st) {
                                        btnBorder = '2px solid #d97706'
                                        btnBg = '#fffbeb'
                                        btnColor = '#78350f'
                                      } else if (is2nd) {
                                        btnBorder = '2px solid #64748b'
                                        btnBg = '#f1f5f9'
                                        btnColor = '#0f172a'
                                      } else if (is3rd) {
                                        btnBorder = '2px solid #ea580c'
                                        btnBg = '#fff7ed'
                                        btnColor = '#7c2d12'
                                      }

                                      return (
                                        <button
                                          key={sq}
                                          onClick={() => handleSquadClickOrder(activity, sq)}
                                          disabled={isLocked || isReadonly}
                                          style={{
                                            padding: isMobile ? '8px 10px' : '9px 12px',
                                            borderRadius: '7px',
                                            border: btnBorder,
                                            background: btnBg,
                                            color: btnColor,
                                            fontSize: isMobile ? '12px' : '12.5px',
                                            fontWeight: isSelected ? '800' : '700',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            cursor: (isLocked || isReadonly) ? 'not-allowed' : 'pointer',
                                            minHeight: isMobile ? '42px' : '42px',
                                            height: isMobile ? '42px' : '42px',
                                            boxSizing: 'border-box',
                                            opacity: (isLocked || isReadonly) ? 0.85 : 1,
                                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                            transition: 'all 0.12s ease'
                                          }}
                                        >
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {sq}
                                          </span>

                                          {/* Badges for Ranked vs Standard vs Unranked Multi-squad */}
                                          {rule && rule.isRanked && sqRank && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontWeight: '900',
                                              color: sqRank === 1 ? '#92400e' : (sqRank === 2 ? '#334155' : (sqRank === 3 ? '#9a3412' : '#1e40af')),
                                              background: sqRank === 1 ? '#fde68a' : (sqRank === 2 ? '#cbd5e1' : (sqRank === 3 ? '#fed7aa' : '#bfdbfe')),
                                              padding: '2px 5px',
                                              borderRadius: '4px',
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {sqRank === 1 && '🥇 1st'}
                                              {sqRank === 2 && '🥈 2nd'}
                                              {sqRank === 3 && '🥉 3rd'}
                                              {sqRank >= 4 && sqRank}
                                            </span>
                                          )}

                                          {rule && !rule.isRanked && isRuleSelected && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontWeight: '900',
                                              color: '#92400e',
                                              background: '#fde68a',
                                              padding: '2px 5px',
                                              borderRadius: '4px'
                                            }}>
                                              🥇 1st
                                            </span>
                                          )}

                                          {!rule && is1st && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontWeight: '900',
                                              color: '#92400e',
                                              background: '#fde68a',
                                              padding: '2px 5px',
                                              borderRadius: '4px'
                                            }}>
                                              🥇 1st
                                            </span>
                                          )}

                                          {!rule && is2nd && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontWeight: '900',
                                              color: '#334155',
                                              background: '#cbd5e1',
                                              padding: '2px 5px',
                                              borderRadius: '4px'
                                            }}>
                                              🥈 2nd
                                            </span>
                                          )}

                                          {!rule && is3rd && (
                                            <span style={{
                                              fontSize: '10px',
                                              fontWeight: '900',
                                              color: '#9a3412',
                                              background: '#fed7aa',
                                              padding: '2px 5px',
                                              borderRadius: '4px'
                                            }}>
                                              🥉 3rd
                                            </span>
                                          )}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </>
                              )}

                              {/* Obstacle Ordered Standings Ribbon for quick inspection */}
                              {rule && rule.isRanked && ruleSquads.length > 0 && (
                                <div style={{
                                  marginTop: '12px',
                                  padding: '10px 12px',
                                  background: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px'
                                }}>
                                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Current Obstacle Rankings</span>
                                    <span>{ruleSquads.length} / {rule.requiredCount} Assigned</span>
                                  </div>
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                                    gap: '6px'
                                  }}>
                                    {ruleSquads.map((sq, i) => {
                                      const rk = i + 1
                                      const pts = 11 - rk
                                      const medal = rk === 1 ? '🥇 ' : (rk === 2 ? '🥈 ' : (rk === 3 ? '🥉 ' : ''))
                                      return (
                                        <div
                                          key={sq}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 8px',
                                            borderRadius: '6px',
                                            background: rk === 1 ? '#fef3c7' : (rk === 2 ? '#f1f5f9' : (rk === 3 ? '#ffedd5' : '#eff6ff')),
                                            border: rk === 1 ? '1px solid #fde68a' : (rk === 2 ? '1px solid #e2e8f0' : (rk === 3 ? '1px solid #fed7aa' : '1px solid #bfdbfe')),
                                            fontSize: '11px',
                                            color: '#0f172a'
                                          }}
                                        >
                                          <span style={{ fontWeight: '750', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {medal ? `${medal} ` : ''}{rk} {sq}
                                          </span>
                                          <span style={{ fontWeight: '800', color: '#154388', fontSize: '10.5px', flexShrink: 0 }}>
                                            {pts} pts
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

          </div>
        )
      )}

      {/* =========================================================================
          VIEW 2: LEADERBOARD & OVERALL SQUAD PERFORMANCE (Medal Points Ranked)
          ========================================================================= */}
      {subView === 'leaderboard' && (
        !currentBatch && !loading ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '54px 20px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <Trophy size={28} color="#154388" />
            <h3 style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              No Active Batch
            </h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* #1 Champion Hero Card (Overall Standings only) */}
            {leaderboardFilter === 'overall' && (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: isMobile ? '16px 14px' : '18px 24px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                gap: isMobile ? '12px' : '20px',
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
                position: 'relative',
                width: '100%',
                maxWidth: isMobile ? '100%' : '760px',
                margin: '0 auto',
                boxSizing: 'border-box'
              }}>
                {/* Left on desktop / Top on mobile: Animated Trophy on pedestal */}
                <div style={{
                  width: isMobile ? '68px' : '78px',
                  height: isMobile ? '68px' : '78px',
                  borderRadius: '16px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <TrophyLottie size={isMobile ? 56 : 66} />
                </div>

                {/* Center on desktop / Middle on mobile: Details and Medal counts */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMobile ? 'center' : 'flex-start',
                  textAlign: isMobile ? 'center' : 'left'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '2px' }}>
                    🏆 Current Leader
                  </div>
                  <h2 style={{
                    margin: '0 0 8px',
                    fontSize: isMobile ? '24px' : '28px',
                    fontWeight: '900',
                    color: '#0f172a',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.15
                  }}>
                    {top1 ? top1.squad : '—'}
                  </h2>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: isMobile ? 'center' : 'flex-start'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      fontSize: '12px',
                      fontWeight: '750',
                      color: '#92400e'
                    }}>
                      <span>🥇</span>
                      <strong style={{ fontSize: '13px', color: '#78350f' }}>{top1?.first_count || 0}</strong>
                      <span>Gold</span>
                    </span>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: '750',
                      color: '#334155'
                    }}>
                      <span>🥈</span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{top1?.second_count || 0}</strong>
                      <span>Silver</span>
                    </span>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      fontSize: '12px',
                      fontWeight: '750',
                      color: '#9a3412'
                    }}>
                      <span>🥉</span>
                      <strong style={{ fontSize: '13px', color: '#7c2d12' }}>{top1?.third_count || 0}</strong>
                      <span>Bronze</span>
                    </span>

                    {top1?.overall_score !== undefined && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '9999px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        fontSize: '12px',
                        fontWeight: '800',
                        color: '#1e40af'
                      }}>
                        Score: {Number(top1.overall_score || 0).toFixed(2)} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Standings Filter Tabs & Dedicated PDF Action Button */}
            <div style={{
              display: 'flex',
              alignItems: isMobile ? 'stretch' : 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexDirection: isMobile ? 'column' : 'row',
              width: '100%',
              maxWidth: isMobile ? '100%' : (['categories', 'best_captain'].includes(leaderboardFilter) ? '100%' : '760px'),
              margin: '0 auto',
              boxSizing: 'border-box',
              minWidth: 0
            }}>
              <div style={{
                display: 'flex',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '3px',
                gap: '2px',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                flex: 1,
                minWidth: 0,
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                {[
                  { key: 'overall', label: 'Overall Standings' },
                  { key: 'Day 2', label: 'Day 2' },
                  { key: 'Day 3', label: 'Day 3' },
                  { key: 'Day 4', label: 'Day 4' },
                  { key: 'Day 5', label: 'Day 5' },
                  { key: 'obstacle', label: 'Obstacle (Rank 1–10)' },
                  { key: 'categories', label: 'Best Squad' },
                  { key: 'best_captain', label: 'Best Captain' }
                ].map(f => {
                  const active = leaderboardFilter === f.key
                  return (
                    <button
                      key={f.key}
                      onClick={() => setLeaderboardFilter(f.key)}
                      style={{
                        padding: isMobile ? '6px 10px' : '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: active ? '#ffffff' : 'transparent',
                        color: active ? '#154388' : '#64748b',
                        fontSize: '12px',
                        fontWeight: active ? '750' : '550',
                        cursor: 'pointer',
                        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              {/* Download Leaderboard PDF Button */}
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || !currentBatch}
                style={{
                  padding: isMobile ? '8px 12px' : '7px 14px',
                  background: '#154388',
                  border: '1px solid #154388',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '750',
                  cursor: downloadingPdf || !currentBatch ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(21, 67, 136, 0.25)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                title="Download High-Definition PDF Leaderboard"
              >
                <Download size={13} color="#ffffff" className={downloadingPdf ? 'animate-bounce' : ''} />
                <span>{downloadingPdf ? 'Exporting PDF...' : 'Download PDF'}</span>
              </button>
            </div>

            {/* Standings Container based on selected sub-filter */}
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              width: '100%',
              maxWidth: isMobile ? '100%' : (['categories', 'best_captain'].includes(leaderboardFilter) ? '100%' : '760px'),
              margin: '0 auto',
              boxSizing: 'border-box',
              minWidth: 0
            }}>
              <div style={{
                padding: isMobile ? '10px 12px' : '12px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: '6px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: isMobile ? '12px' : '13px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {leaderboardFilter === 'overall' && 'Overall Standings'}
                    {leaderboardFilter === 'categories' && 'Best Squad'}
                    {leaderboardFilter === 'best_captain' && 'Best Captain (Punctuality)'}
                    {leaderboardFilter === 'obstacle' && 'Day 5 Obstacle Competition Standings'}
                    {['Day 2', 'Day 3', 'Day 4', 'Day 5'].includes(leaderboardFilter) && `${leaderboardFilter} Contribution & Standings`}
                  </h4>
                  {['Day 2', 'Day 3', 'Day 4', 'Day 5'].includes(leaderboardFilter) && (
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                      Day contribution to Final Overall Score ({leaderboardFilter} Punctuality: 10%)
                    </div>
                  )}
                </div>
              </div>

              {/* 1. Mobile Formatted Cards View for All Filters */}
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* A. Overall Standings Mobile Cards */}
                  {leaderboardFilter === 'overall' && canonicalLeaderboard.map((item, idx) => {
                    const rank = item.calculatedRank
                    return (
                      <div
                        key={item.squad}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === canonicalLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: rank === 1 ? '#fffbeb' : (rank === 2 ? '#fafbfc' : (rank === 3 ? '#fff7ed' : '#ffffff')),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            background: rank === 1 ? '#fef3c7' : (rank === 2 ? '#e2e8f0' : (rank === 3 ? '#ffedd5' : '#f1f5f9')),
                            color: rank === 1 ? '#b45309' : (rank === 2 ? '#475569' : (rank === 3 ? '#c2410c' : '#64748b')),
                            fontSize: '11px',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {rank ? rank : '-'}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                            {rank === 1 && '🏆 '}
                            {rank === 2 && '🥈 '}
                            {rank === 3 && '🥉 '}
                            {item.squad}
                          </span>
                        </div>

                        <div style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: rank === 1 ? '#154388' : '#f1f5f9',
                          color: rank === 1 ? '#ffffff' : '#0f172a',
                          fontSize: '12.5px',
                          fontWeight: '850'
                        }}>
                          {(item.overall_score ?? 0).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}

                  {/* B. Obstacle Standings Mobile Cards */}
                  {leaderboardFilter === 'obstacle' && canonicalObstacleRankings.map((item, idx) => {
                    const rank = item.rank
                    return (
                      <div
                        key={item.squad}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === canonicalObstacleRankings.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: rank === 1 ? '#fffbeb' : (rank === 2 ? '#fafbfc' : (rank === 3 ? '#fff7ed' : '#ffffff')),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            background: rank === 1 ? '#fef3c7' : (rank === 2 ? '#e2e8f0' : (rank === 3 ? '#ffedd5' : '#eff6ff')),
                            color: rank === 1 ? '#b45309' : (rank === 2 ? '#475569' : (rank === 3 ? '#c2410c' : '#1e40af')),
                            fontSize: '11px',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {rank ? rank : '-'}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                            {rank === 1 && '🥇 '}
                            {rank === 2 && '🥈 '}
                            {rank === 3 && '🥉 '}
                            {item.squad}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* C. Days 2, 3, 4, 5 Mobile Cards (Independent Day Scores & Winners) */}
                  {['Day 2', 'Day 3', 'Day 4', 'Day 5'].includes(leaderboardFilter) && canonicalDayLeaderboard.map((item, idx) => {
                    const rank = item.calculatedRank
                    const isWinner = item.isDayWinner
                    return (
                      <div
                        key={item.squad}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === canonicalDayLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: isWinner ? '#fffbeb' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            background: isWinner ? '#fef3c7' : '#f1f5f9',
                            color: isWinner ? '#b45309' : '#64748b',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {rank ? rank : '-'}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                            {isWinner && '🏆 '}
                            {rank === 2 && '🥈 '}
                            {rank === 3 && '🥉 '}
                            {item.squad}
                          </span>
                        </div>

                        <div style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: isWinner ? '#154388' : '#f1f5f9',
                          color: isWinner ? '#ffffff' : '#0f172a',
                          fontSize: '12.5px',
                          fontWeight: '850'
                        }}>
                          {(item.overall_score ?? 0).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}

                  {/* D. Best Captain Mobile Cards */}
                  {leaderboardFilter === 'best_captain' && canonicalBestCaptainList.map((item, idx) => {
                    const isTop = item.captainRank === 1
                    const puncRank = item.punctuality_rank
                    return (
                      <div
                        key={item.squad}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === canonicalBestCaptainList.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: isTop ? '#fffbeb' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            background: isTop ? '#fef3c7' : '#f1f5f9',
                            color: isTop ? '#b45309' : '#64748b',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {item.captainRank ? item.captainRank : '-'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                              {isTop && '🎖️ '}{item.squad}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                              Captain: {getCaptainName(item.squad)}
                            </div>
                          </div>
                        </div>


                      </div>
                    )
                  })}

                  {/* E. Best Squad (Categories) Mobile Cards */}
                  {leaderboardFilter === 'categories' && canonicalLeaderboard.map((item, idx) => {
                    const isTop = item.calculatedRank === 1
                    return (
                      <div
                        key={item.squad}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === canonicalLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: isTop ? '#fffbeb' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '5px',
                            background: isTop ? '#fef3c7' : '#f1f5f9',
                            color: isTop ? '#b45309' : '#64748b',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {item.calculatedRank ? item.calculatedRank : '-'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                              {isTop && '🏆 '}{item.squad}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>
                              🥇 {item.first_count || 0} · 🥈 {item.second_count || 0} · 🥉 {item.third_count || 0}
                            </div>
                          </div>
                        </div>

                        <div style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: isTop ? '#154388' : '#f1f5f9',
                          color: isTop ? '#ffffff' : '#0f172a',
                          fontSize: '12px',
                          fontWeight: '900'
                        }}>
                          {(item.overall_score ?? 0).toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box' }}>
                  {/* 1. Overall View Desktop Table */}
                  {leaderboardFilter === 'overall' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 16px', width: '70px' }}>Rank</th>
                          <th style={{ padding: '10px 16px' }}>Squad</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', width: '140px' }}>Final Overall Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canonicalLeaderboard.map((item, idx) => {
                          const rank = item.calculatedRank
                          return (
                            <tr
                              key={item.squad}
                              style={{
                                borderBottom: idx === canonicalLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: rank === 1 ? '#fffbeb' : (rank === 2 ? '#f8fafc' : (rank === 3 ? '#fff7ed' : '#ffffff'))
                              }}
                            >
                              <td style={{ padding: '10px 16px', width: '70px' }}>
                                <span style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '5px',
                                  background: rank === 1 ? '#fef3c7' : (rank === 2 ? '#e2e8f0' : (rank === 3 ? '#ffedd5' : '#f1f5f9')),
                                  color: rank === 1 ? '#b45309' : (rank === 2 ? '#475569' : (rank === 3 ? '#c2410c' : '#64748b')),
                                  fontSize: '11.5px',
                                  fontWeight: '900',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {rank ? rank : '-'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 16px', fontWeight: '750', color: '#0f172a' }}>
                                {rank === 1 && '🏆 '}
                                {rank === 2 && '🥈 '}
                                {rank === 3 && '🥉 '}
                                {item.squad}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '850', color: '#154388', fontSize: '13.5px' }}>
                                {(item.overall_score ?? 0).toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* 2. Obstacle Standings Dedicated Desktop Table */}
                  {leaderboardFilter === 'obstacle' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 16px', width: '70px' }}>Rank</th>
                          <th style={{ padding: '10px 16px' }}>Squad Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canonicalObstacleRankings.map((item, idx) => {
                          const rank = item.rank
                          return (
                            <tr
                              key={item.squad}
                              style={{
                                borderBottom: idx === canonicalObstacleRankings.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: rank === 1 ? '#fffbeb' : (rank === 2 ? '#f8fafc' : (rank === 3 ? '#fff7ed' : '#ffffff'))
                              }}
                            >
                              <td style={{ padding: '10px 16px', width: '70px' }}>
                                <span style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '5px',
                                  background: rank === 1 ? '#fef3c7' : (rank === 2 ? '#e2e8f0' : (rank === 3 ? '#ffedd5' : '#eff6ff')),
                                  color: rank === 1 ? '#b45309' : (rank === 2 ? '#475569' : (rank === 3 ? '#c2410c' : '#1e40af')),
                                  fontSize: '11.5px',
                                  fontWeight: '900',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {rank ? rank : '-'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 16px', fontWeight: '750', color: '#0f172a' }}>
                                {rank === 1 && '🥇 '}
                                {rank === 2 && '🥈 '}
                                {rank === 3 && '🥉 '}
                                {item.squad}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* 3. Days 2, 3, 4, 5 Breakdown View (Independent Day Scores & Winners) */}
                  {['Day 2', 'Day 3', 'Day 4', 'Day 5'].includes(leaderboardFilter) && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 16px', width: '70px' }}>Rank</th>
                          <th style={{ padding: '10px 16px' }}>Squad</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', width: '140px' }}>Day Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canonicalDayLeaderboard.map((item, idx) => {
                          const rank = item.calculatedRank
                          const isWinner = item.isDayWinner
                          return (
                            <tr
                              key={item.squad}
                              style={{
                                borderBottom: idx === canonicalDayLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: isWinner ? '#fffbeb' : '#ffffff'
                              }}
                            >
                              <td style={{ padding: '10px 16px', width: '70px' }}>
                                <span style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '5px',
                                  background: isWinner ? '#fef3c7' : '#f1f5f9',
                                  color: isWinner ? '#b45309' : '#64748b',
                                  fontSize: '11.5px',
                                  fontWeight: '900',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  {rank ? rank : '-'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 16px', fontWeight: '750', color: '#0f172a' }}>
                                {isWinner && '🏆 '}
                                {rank === 2 && '🥈 '}
                                {rank === 3 && '🥉 '}
                                {item.squad}
                              </td>
                              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '850', color: '#154388', fontSize: '13.5px' }}>
                                {(item.overall_score ?? 0).toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* 5. Category Breakdown View (14 Categories) */}
                  {leaderboardFilter === 'categories' && (
                    <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 12px', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 2 }}>Squad</th>
                          {SQUAD_CATEGORIES.map(c => (
                            <th key={c.key} style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <div>{c.label}</div>
                              <div style={{ fontSize: '9.5px', color: '#154388', fontWeight: '750' }}>{c.weight}</div>
                            </th>
                          ))}
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Overall</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canonicalLeaderboard.map((item, idx) => {
                          const isTop = item.calculatedRank === 1
                          return (
                            <tr
                              key={item.squad}
                              style={{
                                borderBottom: idx === canonicalLeaderboard.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: isTop ? '#fffbeb' : '#ffffff'
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontWeight: '750', color: '#0f172a', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: isTop ? '#fffbeb' : '#ffffff', zIndex: 1 }}>
                                {item.squad}
                              </td>
                              {SQUAD_CATEGORIES.map(c => (
                                <td key={c.key} style={{ padding: '10px 8px', textAlign: 'center', color: '#334155', fontWeight: c.key === 'punctuality' ? '800' : '500' }}>
                                  {c.key === 'punctuality'
                                    ? (item.punctuality_rank ? `${11 - item.punctuality_rank}` : (item.punctuality_points ?? '-'))
                                    : (item.categoryScores?.[c.key] ?? 0).toFixed(2)}
                                </td>
                              ))}
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#154388' }}>
                                {(item.overall_score ?? 0).toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* 6. Best Captain View (Determined ONLY by Punctuality ranking) */}
                  {leaderboardFilter === 'best_captain' && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 16px' }}>Squad</th>
                          <th style={{ padding: '10px 16px' }}>Captain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {canonicalBestCaptainList.map((item, idx) => {
                          const isTop = item.captainRank === 1
                          const rank = item.captainRank
                          return (
                            <tr
                              key={item.squad}
                              style={{
                                borderBottom: idx === canonicalBestCaptainList.length - 1 ? 'none' : '1px solid #f1f5f9',
                                background: isTop ? '#fffbeb' : '#ffffff'
                              }}
                            >
                              <td style={{ padding: '10px 16px', fontWeight: '750', color: '#0f172a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '5px',
                                    background: isTop ? '#fef3c7' : '#f1f5f9',
                                    color: isTop ? '#b45309' : '#64748b',
                                    fontSize: '11.5px',
                                    fontWeight: '900',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    {rank ? rank : '-'}
                                  </span>
                                  <span>
                                    {isTop && '🎖️ '}
                                    {rank === 2 && '🥈 '}
                                    {rank === 3 && '🥉 '}
                                    {item.squad}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 16px', color: '#475569', fontSize: '12.5px', fontWeight: '500' }}>
                                {getCaptainName(item.squad)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

          </div>
        )
      )}

      {/* =========================================================================
          VIEW 3: HISTORY (Past Completed Batches Only)
          ========================================================================= */}
      {subView === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {historyBatches.length === 0 ? (
            <div style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '44px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <Trophy size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                No Previous Completed Batches
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Past batch championship records will appear here once previous batches conclude.
              </p>
            </div>
          ) : (
            historyBatches.map(item => {
              const b = item.batch
              const isExpanded = Boolean(expandedHistory[b.id])

              return (
                <div
                  key={b.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                  }}
                >
                  {/* Batch Row */}
                  <div
                    onClick={() => toggleHistoryBatch(b.id)}
                    style={{
                      padding: isMobile ? '12px 14px' : '14px 18px',
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: isMobile ? 'flex-start' : 'center',
                      justifyContent: 'space-between',
                      gap: isMobile ? '8px' : '12px',
                      cursor: 'pointer',
                      background: '#ffffff'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: '800', color: '#0f172a' }}>
                          {b.name}
                        </h3>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                          · {b.location || 'LTC Boribel'} {b.year && `(${b.year})`}
                        </span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isMobile ? 'space-between' : 'flex-end',
                      width: isMobile ? '100%' : 'auto',
                      gap: '8px'
                    }}>
                      {item.bestSquad ? (
                        <div style={{
                          fontSize: isMobile ? '11px' : '12px',
                          fontWeight: '750',
                          color: '#78350f',
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          🏆 {item.bestSquad.squad} ({item.bestSquad.medal_points || item.bestSquad.points} pts · 🥇 {item.bestSquad.count})
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>No records</span>
                      )}

                      <div style={{ color: '#94a3b8' }}>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Standings in Canonical Squad Order */}
                  {isExpanded && (
                    <div style={{ padding: isMobile ? '8px 12px 12px' : '8px 16px 14px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {DEFAULT_SQUADS.map((sq, sqIdx) => {
                          const rankIdx = (item.rankings || []).findIndex(r => r.squad === sq)
                          const r = rankIdx >= 0 ? item.rankings[rankIdx] : { squad: sq, medal_points: 0, points: 0, first_count: 0, count: 0, second_count: 0, third_count: 0, overall_score: 0 }
                          const calculatedRank = rankIdx >= 0 ? rankIdx + 1 : '-'
                          const isTop = rankIdx === 0
                          return (
                            <div
                              key={sq}
                              style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                alignItems: isMobile ? 'flex-start' : 'center',
                                justifyContent: 'space-between',
                                padding: '7px 0',
                                borderBottom: sqIdx === DEFAULT_SQUADS.length - 1 ? 'none' : '1px solid #e2e8f0',
                                gap: isMobile ? '2px' : '0'
                              }}
                            >
                              <span style={{ fontSize: isMobile ? '12px' : '12.5px', fontWeight: isTop ? '750' : '600', color: isTop ? '#78350f' : '#334155' }}>
                                {calculatedRank} {sq}
                              </span>
                              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', color: '#0f172a' }}>
                                {r.medal_points || r.points || 0} pts · 🥇 {r.first_count || r.count || 0} · 🥈 {r.second_count || 0} · 🥉 {r.third_count || 0} · Score: {(r.overall_score || 0).toFixed(2)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

    </div>
  )
}

