import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { 
  Sparkles, CheckCircle, AlertCircle, Send, Star, User, Mail, 
  Phone, GraduationCap, Building2, Layers, Calendar, MessageSquare, 
  Shield, Activity, Coffee, Award, Compass, Heart, Check, Clock, Save, Lock
} from 'lucide-react'
import ConfettiPopper from './ConfettiPopper'
import { useLanguage } from './context/LanguageContext'
import { formatStudentEmail } from './utils/studentEmailHelper'

const RATING_OPTIONS = [
  { value: 5, label: 'Excellent', solidBg: '#16a34a', solidColor: '#ffffff', solidBorder: '#15803d', lightBg: '#f0fdf4', lightColor: '#15803d', lightBorder: '#86efac' },
  { value: 4, label: 'Very Good', solidBg: '#2563eb', solidColor: '#ffffff', solidBorder: '#1d4ed8', lightBg: '#eff6ff', lightColor: '#1d4ed8', lightBorder: '#93c5fd' },
  { value: 3, label: 'Good', solidBg: '#d97706', solidColor: '#ffffff', solidBorder: '#b45309', lightBg: '#fffbeb', lightColor: '#b45309', lightBorder: '#fde047' },
  { value: 2, label: 'Fair', solidBg: '#ea580c', solidColor: '#ffffff', solidBorder: '#c2410c', lightBg: '#fff7ed', lightColor: '#c2410c', lightBorder: '#fdba74' },
  { value: 1, label: 'Poor', solidBg: '#dc2626', solidColor: '#ffffff', solidBorder: '#b91c1c', lightBg: '#fef2f2', lightColor: '#b91c1c', lightBorder: '#fca5a5' }
]

const ARRIVAL_QUESTIONS = [
  { key: 'welcome_reception', label: 'Welcome & reception experience' },
  { key: 'security_bag_checking', label: 'Security & bag-checking process' },
  { key: 'mobile_deposit_combat_dress', label: 'Mobile deposit & combat dress distribution' },
  { key: 'briefing_orientation', label: 'Initial briefing and orientation by Director & Pillar Heads' }
]

const ACTIVITY_QUESTIONS = [
  { key: 'guest_lecture', label: 'Guest Lecture – relevance, delivery and learning value' },
  { key: 'debate', label: 'Debate' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'movie_reflection', label: 'Patriotic Movie / Documentary & Reflection – relevance and reflection experience' },
  { key: 'cultural_program', label: 'Cultural Program / Evening Sessions – participation, enjoyment and learning' }
]

const FACILITIES_QUESTIONS = [
  { key: 'boarding_lodging', label: 'Boarding and Lodging' },
  { key: 'food_dining', label: 'Food & Dining Arrangement' },
  { key: 'medical_support', label: 'Medical Support' },
  { key: 'ltc_team_coordinator', label: 'LTC Team & Squad Coordinator Support' },
  { key: 'overall_support_service', label: 'Overall support and service provided by LTC staff' }
]

const TRAINER_PILLARS = [
  {
    key: 'agriculture',
    name: 'Agriculture and Nature Pillar',
    icon: <Compass size={17} color="#16a34a" />,
    badgeBg: '#f0fdf4',
    badgeColor: '#15803d',
    borderColor: '#bbf7d0'
  },
  {
    key: 'sports_physical',
    name: 'Sports and Physical Fitness Pillar',
    icon: <Activity size={17} color="#0284c7" />,
    badgeBg: '#f0f9ff',
    badgeColor: '#0369a1',
    borderColor: '#bae6fd'
  },
  {
    key: 'team_leadership',
    name: 'Team Building and Leadership Pillar',
    icon: <Award size={17} color="#d97706" />,
    badgeBg: '#fffbeb',
    badgeColor: '#b45309',
    borderColor: '#fde68a'
  },
  {
    key: 'patriotism_nation',
    name: 'Patriotism and Nation Building Pillar',
    icon: <Shield size={17} color="#dc2626" />,
    badgeBg: '#fef2f2',
    badgeColor: '#b91c1c',
    borderColor: '#fecaca'
  },
  {
    key: 'spirituality_peace',
    name: 'Spirituality and Peace Pillar',
    icon: <Heart size={17} color="#7c3aed" />,
    badgeBg: '#f5f3ff',
    badgeColor: '#6d28d9',
    borderColor: '#ddd6fe'
  }
]

const TRAINER_QUESTIONS = [
  { key: 'knowledge_expertise', label: 'Trainers’ knowledge, preparation and subject expertise' },
  { key: 'communication_clarity', label: 'Trainers’ communication and ability to explain concepts clearly' },
  { key: 'interaction_involvement', label: 'Trainers’ interaction, encouragement and involvement with students' },
  { key: 'discipline_punctuality', label: 'Trainers’ discipline, punctuality and professionalism' },
  { key: 'training_methods', label: 'Usefulness of training methods and activities used by trainers' }
]

function getInitialDraft(myData) {
  if (typeof window === 'undefined') return null
  try {
    const keys = [
      myData?.id ? `service_feedback_draft_${myData.id}` : null,
      myData?.prn ? `service_feedback_draft_${myData.prn}` : null,
      'service_feedback_draft_latest',
      'service_feedback_draft_active_user',
      'service_feedback_draft_current'
    ].filter(Boolean)

    for (const k of keys) {
      const raw = localStorage.getItem(k)
      if (raw) {
        const d = JSON.parse(raw)
        if (d && (d.arrivalRatings || d.activityRatings || d.facilitiesRatings || d.trainerRatings || d.overallSuggestions)) {
          return d
        }
      }
    }
  } catch (e) {
    console.error('Error reading initial draft:', e)
  }
  return null
}

export default function StudentServiceFeedbackTab({ token, apiBase, myData, onFeedbackSubmitted, isMobile: propIsMobile }) {
  const { t } = useLanguage()
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof propIsMobile === 'boolean') return propIsMobile
    return typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittedData, setSubmittedData] = useState(null)
  const [validationError, setValidationError] = useState('')
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const [isLockedByBatchAdmin, setIsLockedByBatchAdmin] = useState(() => Boolean(myData?.post_service_feedback_locked))

  useEffect(() => {
    if (typeof myData?.post_service_feedback_locked === 'boolean') {
      setIsLockedByBatchAdmin(myData.post_service_feedback_locked)
    }
  }, [myData?.post_service_feedback_locked])

  // Unlock check for students based on batch dates
  const getUnlockInfo = () => {
    if (!myData || (!myData.batch_start_date && !myData.batch_end_date)) {
      return { isUnlocked: true, unlockDate: null }
    }
    const now = new Date()
    let unlockDate = null
    if (myData.batch_end_date) {
      const endDate = new Date(myData.batch_end_date)
      unlockDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0)
    } else if (myData.batch_start_date) {
      const startDate = new Date(myData.batch_start_date)
      unlockDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 4, 0, 0, 0, 0)
    }
    if (!unlockDate) return { isUnlocked: true, unlockDate: null }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return {
      isUnlocked: today >= unlockDate,
      unlockDate
    }
  }

  const unlockInfo = getUnlockInfo()

  // Initialize from saved draft if available
  const initialDraft = useMemo(() => getInitialDraft(myData), [myData])

  // Form State
  const [arrivalRatings, setArrivalRatings] = useState(() => initialDraft?.arrivalRatings || {})
  const [activityRatings, setActivityRatings] = useState(() => initialDraft?.activityRatings || {})
  const [facilitiesRatings, setFacilitiesRatings] = useState(() => initialDraft?.facilitiesRatings || {})
  const [trainerRatings, setTrainerRatings] = useState(() => initialDraft?.trainerRatings || {
    agriculture: {},
    sports_physical: {},
    team_leadership: {},
    patriotism_nation: {},
    spirituality_peace: {}
  })
  const [overallSuggestions, setOverallSuggestions] = useState(() => initialDraft?.overallSuggestions || '')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const myDataRef = useRef(myData)
  useEffect(() => {
    myDataRef.current = myData
  }, [myData])

  const saveDraft = useCallback((newArrival, newActivity, newFacilities, newTrainers, newSuggestions) => {
    if (typeof window === 'undefined') return
    try {
      const draft = {
        arrivalRatings: newArrival,
        activityRatings: newActivity,
        facilitiesRatings: newFacilities,
        trainerRatings: newTrainers,
        overallSuggestions: newSuggestions,
        saved_at: Date.now()
      }
      const serialized = JSON.stringify(draft)
      const curData = myDataRef.current
      if (curData?.id) localStorage.setItem(`service_feedback_draft_${curData.id}`, serialized)
      if (curData?.prn) localStorage.setItem(`service_feedback_draft_${curData.prn}`, serialized)
      localStorage.setItem('service_feedback_draft_latest', serialized)
      localStorage.setItem('service_feedback_draft_active_user', serialized)
    } catch (e) {
      console.error('Error saving draft:', e)
    }
  }, [])

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const curData = myDataRef.current
      const keys = [
        curData?.id ? `service_feedback_draft_${curData.id}` : null,
        curData?.prn ? `service_feedback_draft_${curData.prn}` : null,
        'service_feedback_draft_latest',
        'service_feedback_draft_active_user',
        'service_feedback_draft_current'
      ].filter(Boolean)
      keys.forEach(k => localStorage.removeItem(k))
    } catch (e) {
      console.error('Error clearing draft:', e)
    }
  }, [])

  // Check if existing submission exists (runs ONLY ONCE on mount)
  const isCheckedRef = useRef(false)
  useEffect(() => {
    if (isCheckedRef.current) return
    isCheckedRef.current = true

    const checkSubmission = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${apiBase}/api/feedback/my-submissions`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          if (typeof data.post_service_feedback_locked === 'boolean') {
            setIsLockedByBatchAdmin(data.post_service_feedback_locked)
          }
          const existing = (data.submissions || []).find(s => s.category === 'Service-Trainers')
          if (existing) {
            let parsed = null
            try {
              parsed = typeof existing.feedback_text === 'string' ? JSON.parse(existing.feedback_text) : existing.feedback_text
            } catch {
              parsed = null
            }
            setSubmittedData(parsed || { raw: existing.feedback_text, created_at: existing.created_at })
            clearDraft()
          } else {
            // If not submitted, restore draft
            const draft = getInitialDraft(myDataRef.current)
            if (draft) {
              if (draft.arrivalRatings && Object.keys(draft.arrivalRatings).length > 0) setArrivalRatings(draft.arrivalRatings)
              if (draft.activityRatings && Object.keys(draft.activityRatings).length > 0) setActivityRatings(draft.activityRatings)
              if (draft.facilitiesRatings && Object.keys(draft.facilitiesRatings).length > 0) setFacilitiesRatings(draft.facilitiesRatings)
              if (draft.trainerRatings && Object.keys(draft.trainerRatings).length > 0) setTrainerRatings(draft.trainerRatings)
              if (draft.overallSuggestions) setOverallSuggestions(draft.overallSuggestions)
            }
          }
        }
      } catch (err) {
        console.error('Failed to check service feedback submissions:', err)
      } finally {
        setLoading(false)
      }
    }
    checkSubmission()
  }, [apiBase, token, clearDraft])

  // Count progress
  const totalRequiredQuestions = 4 + 5 + 5 + (5 * 5) + 1 // 40 questions (including mandatory overall suggestions)
  const answeredCount = useMemo(() => {
    let count = 0
    ARRIVAL_QUESTIONS.forEach(q => { if (arrivalRatings[q.key]) count++ })
    ACTIVITY_QUESTIONS.forEach(q => { if (activityRatings[q.key]) count++ })
    FACILITIES_QUESTIONS.forEach(q => { if (facilitiesRatings[q.key]) count++ })
    TRAINER_PILLARS.forEach(p => {
      TRAINER_QUESTIONS.forEach(q => {
        if (trainerRatings[p.key]?.[q.key]) count++
      })
    })
    if (overallSuggestions && overallSuggestions.trim().length > 0) count++
    return count
  }, [arrivalRatings, activityRatings, facilitiesRatings, trainerRatings, overallSuggestions])

  const completionPercentage = Math.round((answeredCount / totalRequiredQuestions) * 100)

  const handleRatingChange = (section, key, value, pillarKey = null) => {
    setValidationError('')
    let newArrival = { ...arrivalRatings }
    let newActivity = { ...activityRatings }
    let newFacilities = { ...facilitiesRatings }
    let newTrainers = { ...trainerRatings }

    if (section === 'arrival') {
      newArrival = { ...newArrival, [key]: value }
      setArrivalRatings(newArrival)
    } else if (section === 'activity') {
      newActivity = { ...newActivity, [key]: value }
      setActivityRatings(newActivity)
    } else if (section === 'facilities') {
      newFacilities = { ...newFacilities, [key]: value }
      setFacilitiesRatings(newFacilities)
    } else if (section === 'trainer' && pillarKey) {
      newTrainers = {
        ...newTrainers,
        [pillarKey]: {
          ...(newTrainers[pillarKey] || {}),
          [key]: value
        }
      }
      setTrainerRatings(newTrainers)
    }

    // Immediately persist updated draft
    saveDraft(newArrival, newActivity, newFacilities, newTrainers, overallSuggestions)
  }

  const handleSuggestionChange = (e) => {
    setValidationError('')
    const newText = e.target.value
    setOverallSuggestions(newText)
    saveDraft(arrivalRatings, activityRatings, facilitiesRatings, trainerRatings, newText)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!unlockInfo.isUnlocked) {
      setValidationError('Service & Trainee Feedback form is locked until your batch end date.')
      return
    }

    // Validate completeness
    const missing = []
    ARRIVAL_QUESTIONS.forEach(q => {
      if (!arrivalRatings[q.key]) missing.push(`Arrival: ${q.label}`)
    })
    ACTIVITY_QUESTIONS.forEach(q => {
      if (!activityRatings[q.key]) missing.push(`Activity: ${q.label}`)
    })
    FACILITIES_QUESTIONS.forEach(q => {
      if (!facilitiesRatings[q.key]) missing.push(`Facilities: ${q.label}`)
    })
    TRAINER_PILLARS.forEach(p => {
      TRAINER_QUESTIONS.forEach(q => {
        if (!trainerRatings[p.key]?.[q.key]) {
          missing.push(`${p.name}: ${q.label}`)
        }
      })
    })
    if (!overallSuggestions || !overallSuggestions.trim()) {
      missing.push('Overall Experience & Suggestions')
    }

    if (isLockedByBatchAdmin || myData?.post_service_feedback_locked) {
      setValidationError(t('The Service & Trainer Feedback Form is locked by the administrator for your batch. Submissions are no longer accepted.'))
      return
    }

    if (missing.length > 0) {
      setValidationError(`Please answer all questions before submitting. (${missing.length} ${missing.length === 1 ? 'question' : 'questions'} remaining)`)
      window.scrollTo({ top: 300, behavior: 'smooth' })
      return
    }

    try {
      setSubmitting(true)
      setValidationError('')

      const payload = {
        category: 'Service-Trainers',
        feedback_text: JSON.stringify({
          arrival_orientation: arrivalRatings,
          activity_based: activityRatings,
          facilities_admin: facilitiesRatings,
          trainers: trainerRatings,
          overall_suggestions: overallSuggestions.trim()
        }),
        additional_notes: `Batch: ${myData?.batch_name || myData?.batch_id || 'Active'} | Squad: ${myData?.squad || 'Unassigned'}`
      }

      const res = await fetch(`${apiBase}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit feedback.')
      }

      // Clear draft on successful submission
      clearDraft()

      setSubmittedData({
        arrival_orientation: arrivalRatings,
        activity_based: activityRatings,
        facilities_admin: facilitiesRatings,
        trainers: trainerRatings,
        overall_suggestions: overallSuggestions.trim(),
        created_at: new Date().toISOString()
      })

      setConfettiTrigger(prev => prev + 1)
      if (onFeedbackSubmitted) onFeedbackSubmitted()
    } catch (err) {
      setValidationError(err.message || 'An error occurred while submitting.')
    } finally {
      setSubmitting(false)
    }
  }

  // Pre-filled dates formatting
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return '—'
    }
  }

  const renderRatingGroup = (section, itemKey, currentValue, pillarKey = null) => {
    return (
      <div style={{
        display: isMobile ? 'grid' : 'flex',
        gridTemplateColumns: isMobile ? 'repeat(5, 1fr)' : 'none',
        gap: isMobile ? '4px' : '6px',
        alignItems: 'center',
        width: isMobile ? '100%' : 'auto',
        flexShrink: 0
      }}>
        {RATING_OPTIONS.map(opt => {
          const isSelected = currentValue === opt.value
          return (
            <button
              type="button"
              key={opt.value}
              onClick={(e) => {
                e.preventDefault()
                handleRatingChange(section, itemKey, opt.value, pillarKey)
              }}
              style={{
                width: isMobile ? '100%' : 'auto',
                minWidth: isMobile ? '0' : '62px',
                padding: isMobile ? '6px 2px' : '7px 8px',
                borderRadius: '7px',
                border: isSelected ? `1.5px solid ${opt.solidBorder}` : '1.5px solid #cbd5e1',
                background: isSelected ? opt.solidBg : '#f8fafc',
                color: isSelected ? opt.solidColor : '#334155',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                boxSizing: 'border-box',
                outline: 'none'
              }}
              title={`${opt.value} - ${opt.label}`}
            >
              <span style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '800', lineHeight: 1 }}>{opt.value}</span>
              <span style={{
                fontSize: isMobile ? '8.5px' : '9.5px',
                fontWeight: isSelected ? '750' : '600',
                color: isSelected ? '#ffffff' : '#64748b',
                whiteSpace: isMobile ? 'normal' : 'nowrap',
                textAlign: 'center',
                lineHeight: 1.1,
                wordBreak: 'break-word'
              }}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  if (loading && !submittedData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '12px', color: '#64748b' }}>
        <Clock className="animate-spin" size={28} style={{ color: '#ea580c' }} />
        <span style={{ fontSize: '13.5px', fontWeight: '600' }}>{t("Loading Service & Trainers Feedback Form...")}</span>
      </div>
    )
  }

  // Locked by Administrator View
  if (!submittedData && (isLockedByBatchAdmin || myData?.post_service_feedback_locked)) {
    return (
      <div style={{
        padding: '36px 24px',
        maxWidth: '700px',
        margin: '20px auto',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1.5px solid #fecaca',
        textAlign: 'center',
        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.06)'
      }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px 0' }}>
          {t("Service & Trainee Feedback Form is Locked")}
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 16px auto', maxWidth: '500px', lineHeight: 1.5 }}>
          {t("The Service & Trainer Feedback Form has been locked by the administrator for your batch. Submissions are no longer accepted.")}
        </p>
      </div>
    )
  }

  // Locked View (Schedule-based)
  if (!submittedData && !unlockInfo.isUnlocked) {
    return (
      <div style={{
        padding: '36px 24px',
        maxWidth: '700px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
          {t("Service & Trainee Feedback is Currently Locked")}
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 16px auto', maxWidth: '480px', lineHeight: 1.5 }}>
          {t("The Service & Trainee feedback form unlocks upon conclusion of your Life Awakening Program on:")}{" "}
          <strong style={{ color: '#0f172a' }}>
            {unlockInfo.unlockDate ? unlockInfo.unlockDate.toLocaleDateString() : t("the final program day")}
          </strong>.
        </p>
      </div>
    )
  }

  // If already submitted, display complete confirmation receipt
  if (submittedData) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto 40px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ConfettiPopper trigger={confettiTrigger} />
        
        {/* Verified Status Banner */}
        <div style={{
          background: '#ffffff',
          borderRadius: isMobile ? '12px' : '14px',
          border: '1.5px solid #86efac',
          padding: isMobile ? '16px 14px' : '22px 28px',
          boxShadow: '0 4px 16px rgba(22, 163, 74, 0.08)',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '14px',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle size={24} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: isMobile ? '15.5px' : '17.5px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Service &amp; Trainers Feedback Submitted
                </h3>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '750', border: '1px solid #bbf7d0' }}>
                  VERIFIED
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Thank you! Your feedback has been recorded successfully.
              </p>
            </div>
          </div>
        </div>

        {/* Read-Only Summary of Responses */}
        <div style={{
          background: '#ffffff',
          borderRadius: isMobile ? '12px' : '14px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px 14px' : '22px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Header */}
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#ea580c' }}>
              Submission Summary
            </span>
            <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '3px 0 0 0' }}>
              Life Awakening Program — Service &amp; Trainers Evaluation
            </h4>
          </div>

          {/* Student Info Grid */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '14px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: '10px'
          }}>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Student Name</div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{myData?.name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>PRN</div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{myData?.prn || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Squad</div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{myData?.squad || 'Unassigned'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Batch</div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{myData?.batch_name || myData?.batch_id || 'Active'}</div>
            </div>
          </div>

          {/* Overall Suggestions */}
          {submittedData.overall_suggestions && (
            <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: '750', color: '#0f172a', marginBottom: '6px' }}>
                Overall Experience &amp; Suggestions
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {submittedData.overall_suggestions}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto 40px auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ConfettiPopper trigger={confettiTrigger} />

      {/* Main Container Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: isMobile ? '12px' : '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 6px 20px -4px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden'
      }}>
        {/* Form Header */}
        <div style={{
          padding: isMobile ? '16px 14px' : '22px 30px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', minHeight: '28px' }}>
            <h2 style={{
              fontSize: isMobile ? '17px' : '21px',
              fontWeight: '800',
              color: '#0f172a',
              margin: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.2px'
            }}>
              Services &amp; Trainers Feedback Form
            </h2>

            {/* Badges Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {answeredCount > 0 && !submittedData && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#15803d',
                  background: '#f0fdf4',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0'
                }}>
                  <Check size={12} /> Auto-saved draft
                </span>
              )}

              {/* Progress Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: completionPercentage === 100 ? '#dcfce7' : '#f1f5f9',
                color: completionPercentage === 100 ? '#15803d' : '#475569',
                padding: '3px 9px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: '700',
                border: completionPercentage === 100 ? '1px solid #86efac' : '1px solid #cbd5e1'
              }}>
                <span>{answeredCount} of {totalRequiredQuestions} answered ({completionPercentage}%)</span>
              </div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: isMobile ? '12px' : '13px', color: '#64748b', lineHeight: '1.45' }}>
            Life Awakening Program (LTC) — Your responses are auto-saved as you fill them. You can complete and submit the form anytime.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: isMobile ? '14px 12px' : '24px 30px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Section: Basic Details (Read-Only & Pre-filled) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                i
              </span>
              <h3 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: 0 }}>
                Participant &amp; Program Details <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>(Auto-filled)</span>
              </h3>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: isMobile ? '12px' : '14px 16px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: isMobile ? '10px' : '14px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Full Name</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.name || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>PRN Number</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.prn || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Email Address</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-all' }}>{formatStudentEmail(myData?.email, 'Not provided')}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Contact Number</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.phone || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>School Name</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.school || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Department Name</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.department || '—'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Squad Name</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.squad || 'Unassigned'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Batch Number</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>{myData?.batch_name || myData?.batch_id || 'Active'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>Program Dates</label>
                <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>
                  {formatDate(myData?.batch_start_date)} to {formatDate(myData?.batch_end_date)}
                </div>
              </div>
            </div>
          </div>

          {/* Rating Scale Legend (5 to 1 Order) */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '10px',
            padding: isMobile ? '10px 12px' : '12px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
              Rating Scale Standard (5 = Excellent to 1 = Poor)
            </div>
            <div style={{ display: 'flex', gap: isMobile ? '4px' : '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {RATING_OPTIONS.map(opt => (
                <div key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: isMobile ? '10.5px' : '11.5px', color: '#334155' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    background: opt.solidBg,
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '10.5px'
                  }}>
                    {opt.value}
                  </span>
                  <span style={{ fontWeight: '600' }}>{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Banner */}
          {validationError && (
            <div style={{
              background: '#fef2f2',
              border: '1.5px solid #fca5a5',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#b91c1c',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{validationError}</span>
            </div>
          )}

          {/* SECTION 1: Arrival & Orientation Experience */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                1
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Arrival &amp; Orientation Experience
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ARRIVAL_QUESTIONS.map((q, idx) => (
                <div key={q.key} style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9px',
                  padding: isMobile ? '10px 12px' : '10px 16px',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '8px' : '14px'
                }}>
                  <div style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '600', color: '#1e293b', lineHeight: 1.35, flex: 1 }}>
                    <span style={{ color: '#64748b', marginRight: '6px' }}>{idx + 1}.</span>
                    {q.label}
                  </div>
                  {renderRatingGroup('arrival', q.key, arrivalRatings[q.key])}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: Activity-Based Feedback */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                2
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Activity-Based Feedback
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ACTIVITY_QUESTIONS.map((q, idx) => (
                <div key={q.key} style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9px',
                  padding: isMobile ? '10px 12px' : '10px 16px',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '8px' : '14px'
                }}>
                  <div style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '600', color: '#1e293b', lineHeight: 1.35, flex: 1 }}>
                    <span style={{ color: '#64748b', marginRight: '6px' }}>{idx + 1}.</span>
                    {q.label}
                  </div>
                  {renderRatingGroup('activity', q.key, activityRatings[q.key])}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: Facilities & Administration Feedback */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                3
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Facilities &amp; Administration Feedback
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FACILITIES_QUESTIONS.map((q, idx) => (
                <div key={q.key} style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9px',
                  padding: isMobile ? '10px 12px' : '10px 16px',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '8px' : '14px'
                }}>
                  <div style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '600', color: '#1e293b', lineHeight: 1.35, flex: 1 }}>
                    <span style={{ color: '#64748b', marginRight: '6px' }}>{idx + 1}.</span>
                    {q.label}
                  </div>
                  {renderRatingGroup('facilities', q.key, facilitiesRatings[q.key])}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: Trainer’s Feedback (5 Separate Pillar Sections) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                4
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Trainer’s Feedback (Pillar-wise Evaluation)
              </h3>
            </div>

            {TRAINER_PILLARS.map((pillar) => {
              const currentPillarRatings = trainerRatings[pillar.key] || {}
              const pillarAnsweredCount = Object.keys(currentPillarRatings).length

              return (
                <div key={pillar.key} style={{
                  background: '#ffffff',
                  border: `1.5px solid ${pillar.borderColor}`,
                  borderRadius: '10px',
                  padding: isMobile ? '12px 10px' : '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  {/* Pillar Subheader */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      {pillar.icon}
                      <h4 style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                        {pillar.name}
                      </h4>
                    </div>
                    <span style={{ background: pillar.badgeBg, color: pillar.badgeColor, padding: '2px 7px', borderRadius: '5px', fontSize: '10.5px', fontWeight: '750' }}>
                      {pillarAnsweredCount} / 5 Answered
                    </span>
                  </div>

                  {/* 5 Questions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {TRAINER_QUESTIONS.map((q, qIdx) => (
                      <div key={q.key} style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '9px',
                        padding: isMobile ? '10px 12px' : '10px 16px',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'flex-start' : 'center',
                        justifyContent: 'space-between',
                        gap: isMobile ? '8px' : '14px'
                      }}>
                        <div style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '600', color: '#1e293b', lineHeight: 1.35, flex: 1 }}>
                          <span style={{ color: '#64748b', marginRight: '6px' }}>{qIdx + 1}.</span>
                          {q.label}
                        </div>
                        {renderRatingGroup('trainer', q.key, currentPillarRatings[q.key], pillar.key)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* SECTION 5: Overall Experience & Suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ width: '22px', height: '22px', borderRadius: '5px', background: '#0f172a', color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10.5px', fontWeight: '800' }}>
                5
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Overall Experience &amp; Suggestions
              </h3>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: isMobile ? '12px' : '16px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Please share any additional feedback, overall reflections, or recommendations for improvement: <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                required
                value={overallSuggestions}
                onChange={handleSuggestionChange}
                placeholder="Write your comments and suggestions here..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '7px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  lineHeight: 1.45,
                  outline: 'none',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Submit Action Bar */}
          <div style={{
            paddingTop: '14px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              {answeredCount < totalRequiredQuestions ? (
                <span style={{ color: '#d97706', fontWeight: '600' }}>
                  * {totalRequiredQuestions - answeredCount} {totalRequiredQuestions - answeredCount === 1 ? 'question' : 'questions'} remaining to complete
                </span>
              ) : (
                <span style={{ color: '#16a34a', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={15} /> All {totalRequiredQuestions} questions completed! Ready to submit.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || answeredCount < totalRequiredQuestions || !overallSuggestions.trim()}
              style={{
                background: (submitting || answeredCount < totalRequiredQuestions || !overallSuggestions.trim()) ? '#94a3b8' : '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: isMobile ? '12px 18px' : '11px 26px',
                fontSize: '13.5px',
                fontWeight: '750',
                cursor: (submitting || answeredCount < totalRequiredQuestions || !overallSuggestions.trim()) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                boxShadow: (submitting || answeredCount < totalRequiredQuestions || !overallSuggestions.trim()) ? 'none' : '0 4px 12px rgba(15,23,42,0.18)',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={14} />
              <span>{submitting ? 'Submitting Feedback...' : 'Submit Feedback Form'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
