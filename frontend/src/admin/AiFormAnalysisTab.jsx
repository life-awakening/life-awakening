import React, { useState, useEffect, useCallback, useRef } from 'react'
import lottie from 'lottie-web'
import html2pdf from 'html2pdf.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  PieChart, Pie
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Search, Award, CheckCircle2,
  AlertTriangle, Users, BarChart2, Filter, ArrowUpRight, ArrowDownRight,
  Sparkles, BookOpen, HelpCircle, Activity, FileText, Layers, ShieldCheck,
  Brain, Compass, Target, Clock, ArrowRight, UserCheck
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'

const ANALYSIS_OPTIONS = [
  { id: 'Service-Trainers', label: 'Service Trainee Feedback', desc: 'Feedback from trainees on service, hospitality & trainers' },
  { id: 'Pre-Post-Comparison', label: 'Pre-LTC vs Post-LTC', desc: 'Before and after comparison' },
  { id: 'ALL', label: 'All Data', desc: 'Complete analysis across all forms' }
]

const LANGUAGE_OPTIONS = [
  { id: 'English', label: 'English' },
  { id: 'Hindi', label: 'Hindi (\u0939\u093f\u0928\u094d\u0926\u0940)' },
  { id: 'Marathi', label: 'Marathi (\u092e\u0930\u093e\u0920\u0940)' }
]

const PILLAR_COLORS = ['#154388', '#0284c7', '#0d9488', '#7c3aed', '#b45309', '#059669', '#4f46e5', '#d97706']
const RATING_COLORS = {
  5: '#16a34a', // Excellent (Green)
  4: '#2563eb', // Good (Blue)
  3: '#d97706', // Average (Amber)
  2: '#ea580c', // Poor (Orange)
  1: '#dc2626'  // Very Poor (Red)
}

function formatFeedbackPeriod(dateRange) {
  if (!dateRange || dateRange === 'N/A') return '17 Aug 2026 – 24 Aug 2026'
  if (dateRange.includes(' to ')) {
    const [start, end] = dateRange.split(' to ')
    const formatDate = (ds) => {
      try {
        const d = new Date(ds.trim())
        if (isNaN(d.getTime())) return ds.trim()
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      } catch (e) {
        return ds.trim()
      }
    }
    const fStart = formatDate(start)
    const fEnd = formatDate(end)
    if (fStart === fEnd) return fStart
    return `${fStart} – ${fEnd}`
  }
  return dateRange
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function LoadingLottieAnimation({ size = 130 }) {
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
          path: '/loading.json'
        })
      } catch (err) {
        console.error('Error loading lottie animation:', err)
      }
    }
    return () => {
      if (anim) anim.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      className="ai-loading-animation"
    />
  )
}

function SectionHeading({ title, subtitle, rightContent }) {
  return (
    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
      <div>
        <h2 style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
          {title}
        </h2>
        {subtitle && <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0', fontWeight: '400', lineHeight: '1.35' }}>{subtitle}</p>}
      </div>
      {rightContent}
    </div>
  )
}

/* ─── COMPACT MODERN KPI CARD (NO ICONS, STREAMLINED) ─── */
function SimpleKpiCard({ label, value, note, accent = '#154388' }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '11px',
      padding: '12px 14px',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '78px',
      boxSizing: 'border-box'
    }}>
      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
        {label}
      </div>

      <div style={{ fontSize: '20px', fontWeight: '800', color: accent, lineHeight: '1.2', margin: '1px 0', letterSpacing: '-0.3px' }}>
        {value ?? '—'}
      </div>

      {note && (
        <div style={{
          fontSize: '11px',
          color: '#64748b',
          fontWeight: '500',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {note}
        </div>
      )}
    </div>
  )
}

function InsufficientData({ message = 'Not enough data to show this result.' }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: '#f8fafc',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#64748b',
      border: '1px dashed #cbd5e1',
      textAlign: 'center'
    }}>
      {message}
    </div>
  )
}

function ScoreProgressBar({ score = 0, max = 5 }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  const color = score >= 4.0 ? '#16a34a' : score >= 3.0 ? '#2563eb' : score >= 2.0 ? '#ea580c' : '#dc2626'
  return (
    <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '999px', height: '7px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '999px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

/* ─── COMPACT MODERN SCORE SLIDER ─── */
function ModernScoreSlider({ score = 0, max = 5, showTicks = true, showBubble = true }) {
  const pct = Math.min(100, Math.max(0, (score / max) * 100))
  const color = score >= 4.0 ? '#10b981' : score >= 3.0 ? '#2563eb' : score >= 2.0 ? '#f59e0b' : '#ef4444'
  const glowColor = score >= 4.0 ? 'rgba(16, 185, 129, 0.25)' : score >= 3.0 ? 'rgba(37, 99, 235, 0.25)' : 'rgba(239, 68, 68, 0.25)'

  return (
    <div style={{ width: '100%', position: 'relative', marginTop: showBubble ? '16px' : '0px' }}>
      {/* Floating Tooltip Bubble */}
      {showBubble && (
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: '-22px',
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#ffffff',
          fontSize: '10.5px',
          fontWeight: '700',
          padding: '1px 6px',
          borderRadius: '5px',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
          transition: 'left 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 2
        }}>
          {Number(score).toFixed(1)} ★
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #0f172a'
          }} />
        </div>
      )}

      {/* Slider Track & Fill */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '9px',
        background: '#e2e8f0',
        borderRadius: '999px',
        overflow: 'visible'
      }}>
        {/* Fill Bar */}
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(90deg, #154388 0%, ${color} 100%)`,
          borderRadius: '999px',
          boxShadow: `0 0 8px ${glowColor}`,
          transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />

        {/* Floating Pin / Slider Thumb */}
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 7px)`,
          top: '-3.5px',
          width: '15px',
          height: '15px',
          borderRadius: '50%',
          background: '#ffffff',
          border: `3px solid ${color}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* Scale Tick Markers */}
      {showTicks && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '5px',
          padding: '0 2px',
          fontSize: '9.5px',
          fontWeight: '600',
          color: '#94a3b8'
        }}>
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0 (Avg)</span>
          <span>4.0</span>
          <span>5.0 (Max)</span>
        </div>
      )}
    </div>
  )
}

function ScoreGuideBox() {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '11px',
      color: '#475569',
      alignItems: 'center'
    }}>
      <span style={{ fontWeight: '700', color: '#0f172a' }}>Score Guide:</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: RATING_COLORS[5] }}></span>
        <strong>5</strong> Excellent
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: RATING_COLORS[4] }}></span>
        <strong>4</strong> Good
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: RATING_COLORS[3] }}></span>
        <strong>3</strong> Average
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: RATING_COLORS[2] }}></span>
        <strong>2</strong> Poor
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: RATING_COLORS[1] }}></span>
        <strong>1</strong> Very Poor
      </span>
    </div>
  )
}

// ─── SERVICE TRAINEE REPORT (COMPACT & MODERN DASHBOARD) ────────────────────

function ServiceTraineeReport({ report, showAllQuestions = false, setShowAllQuestions }) {
  const d = report.verifiedServiceData || {}

  const overall = d.overallStats || {}
  const dimensions = d.dimensionStats || []
  const allQuestions = d.questionStats || []
  const topQuestions = d.topQuestions || []
  const lowestQuestions = d.lowestQuestions || []
  const aiSummary = report.aiSummary || []
  const topRatedAreas = report.topRatedAreas || []
  const areasNeedingImprovement = report.areasNeedingImprovement || []
  const whatTraineesSaid = report.whatTraineesSaid || {}
  const mostMentionedTopics = report.mostMentionedTopics || []
  const feedbackTone = report.feedbackTone || {}
  const nextSteps = report.recommendedNextSteps || []

  // Rating Distribution Bar Chart data (5 to 1 scale)
  const distData = [5, 4, 3, 2, 1].map(r => ({
    name: `${r} - ${r === 5 ? 'Excellent' : r === 4 ? 'Good' : r === 3 ? 'Average' : r === 2 ? 'Poor' : 'Very Poor'}`,
    label: `${r}★ ${r === 5 ? 'Excellent' : r === 4 ? 'Good' : r === 3 ? 'Average' : r === 2 ? 'Poor' : 'Very Poor'}`,
    stars: r,
    shortName: `${r}★`,
    count: overall.distribution?.[r]?.count || 0,
    pct: overall.distribution?.[r]?.pct || 0,
    fill: RATING_COLORS[r]
  }))

  // Question-wise scores sorted highest -> lowest with rank
  const validQuestionsSorted = [...allQuestions]
    .filter(q => q.responses > 0 && q.avg !== null)
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .map((q, idx) => ({ ...q, rank: idx + 1 }))

  const displayedQuestions = showAllQuestions ? validQuestionsSorted : validQuestionsSorted.slice(0, 10)

  // Group displayed questions under their respective category headings
  const groupedCategories = displayedQuestions.reduce((acc, q) => {
    const rawCategory = q.dimensionName || q.dimKey || 'General'
    const categoryName = rawCategory.replace(/^Trainers:\s*/i, '').trim()
    let group = acc.find(g => g.category === categoryName)
    if (!group) {
      group = { category: categoryName, questions: [] }
      acc.push(group)
    }
    group.questions.push(q)
    return acc
  }, [])

  // Tone Donut Chart data
  const positiveVal = feedbackTone.positivePct || overall.positivePct || 0
  const neutralVal = feedbackTone.neutralPct || overall.neutralPct || 0
  const negativeVal = feedbackTone.negativePct || overall.criticalPct || 0

  const toneData = [
    { name: 'Positive', value: positiveVal, fill: '#16a34a' },
    { name: 'Neutral', value: neutralVal, fill: '#d97706' },
    { name: 'Negative', value: negativeVal, fill: '#dc2626' }
  ].filter(t => t.value > 0)

  const topicsChartData = (mostMentionedTopics || []).map(t => ({
    name: t.topic || t.name,
    mentions: t.mentions || 0,
    percentage: t.percentage || 0
  }))

  const highestAreaTitle = d.highestDimension?.dimensionName
    ? d.highestDimension.dimensionName.replace('Trainers: ', '')
    : (topQuestions[0]?.label ? topQuestions[0].label.substring(0, 22) : '—')

  const lowestAreaTitle = d.lowestDimension?.dimensionName
    ? d.lowestDimension.dimensionName.replace('Trainers: ', '')
    : (lowestQuestions[0]?.label ? lowestQuestions[0].label.substring(0, 22) : '—')

  return (
    <div id="ai-report-printable-area" className="ai-printable-doc" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── 1. EXECUTIVE REPORT HEADER (COMPACT) ──────────────────── */}
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        {/* Top Organization Brand Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <span style={{
            fontSize: '10.5px',
            fontWeight: '700',
            color: '#154388',
            background: '#eff6ff',
            border: '1px solid #dbeafe',
            padding: '2px 8px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            LTC Evaluation & Feedback Analytics
          </span>
          <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>
            Academic Performance Analysis
          </span>
        </div>

        {/* Primary Report Title */}
        <h1 style={{
          fontSize: '20px',
          fontWeight: '800',
          margin: '0 0 12px 0',
          color: '#0f172a',
          letterSpacing: '-0.3px',
          lineHeight: '1.2'
        }}>
          Service Trainee Feedback Report
        </h1>

        {/* Clean Structured Metadata Grid Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          padding: '10px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Batch Cohort
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              {d.batchName || 'All Batches'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Feedback Period
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
              {formatFeedbackPeriod(d.dateRange)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Trainee Responses
            </div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#154388' }}>
              {d.uniqueStudents || d.totalSubmissions || 0} Submissions
            </div>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Report Generated
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI METRIC CARDS (COMPACT & CLEAN) ─────────────────── */}
      <div className="avoid-break">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
          <SimpleKpiCard
            label="Overall Score"
            value={overall.avg !== null ? `${overall.avg} / 5` : '—'}
            note="Weighted average rating"
            accent="#154388"
          />
          <SimpleKpiCard
            label="Trainee Satisfaction"
            value={overall.satisfactionPct !== null ? `${overall.satisfactionPct}%` : '—'}
            note="Rated 4 or 5 stars"
            accent="#16a34a"
          />
          <SimpleKpiCard
            label="Valid Responses"
            value={d.uniqueStudents || d.totalSubmissions || 0}
            note="Submitted feedback forms"
            accent="#0284c7"
          />
          <SimpleKpiCard
            label="Highest Rated Area"
            value={highestAreaTitle}
            note={d.highestDimension?.avg ? `${d.highestDimension.avg} / 5 score` : 'Top dimension'}
            accent="#15803d"
          />
          <SimpleKpiCard
            label="Needs Improvement"
            value={lowestAreaTitle}
            note={d.lowestDimension?.avg ? `${d.lowestDimension.avg} / 5 score` : 'Lowest dimension'}
            accent="#dc2626"
          />
        </div>
      </div>

      {/* ── 3. OVERALL SCORE & RATING DISTRIBUTION ─────────────────── */}
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading
          title="Overall Score & Rating Distribution"
        />
        
        {/* Score Top Banner with Master Slider */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '14px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          marginBottom: '14px',
          flexWrap: 'wrap'
        }}>
          {/* Average Rating Block */}
          <div style={{ minWidth: '110px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Average Rating
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#154388', lineHeight: '1.1', letterSpacing: '-0.4px' }}>
              {overall.avg !== null ? overall.avg : '—'} <span style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8' }}>/ 5.0</span>
            </div>
            <div style={{ display: 'flex', gap: '2px', marginTop: '4px', color: '#f59e0b', fontSize: '13px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <span key={star} style={{ opacity: star <= Math.round(overall.avg || 0) ? 1 : 0.25 }}>★</span>
              ))}
            </div>
          </div>

          {/* Master Progress Slider */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              <span>Overall Satisfaction Meter</span>
              <span style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                padding: '1px 6px',
                borderRadius: '5px',
                fontWeight: '700',
                fontSize: '11px'
              }}>
                {overall.satisfactionPct !== null ? `${overall.satisfactionPct}% Satisfied` : '0%'}
              </span>
            </div>
            <ModernScoreSlider score={overall.avg || 0} max={5} showTicks={true} showBubble={false} />
          </div>
        </div>

        {/* Compact Rating Breakdown Sliders */}
        <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {distData.map((d, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 12px',
              background: '#ffffff',
              border: '1px solid #f1f5f9',
              borderRadius: '8px'
            }}>
              {/* Star Badge */}
              <div style={{
                width: '105px',
                fontSize: '11.5px',
                fontWeight: '700',
                color: d.fill,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: d.fill
                }} />
                {d.label}
              </div>

              {/* Progress Slider Track */}
              <div style={{ flex: 1, position: 'relative', height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  width: `${d.pct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #154388 0%, ${d.fill} 100%)`,
                  borderRadius: '999px',
                  transition: 'width 0.4s ease'
                }} />
              </div>

              {/* Metrics on Right */}
              <div style={{ width: '100px', textAlign: 'right', fontSize: '11.5px', display: 'flex', justifyContent: 'flex-end', gap: '4px', alignItems: 'center' }}>
                <strong style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '800' }}>{d.pct}%</strong>
                <span style={{ color: '#64748b', fontSize: '10.5px' }}>({d.count})</span>
              </div>
            </div>
          ))}
        </div>

        {/* Rating Breakdown Summary Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          {distData.map((d, i) => (
            <div key={i} style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              padding: '8px 10px',
              borderRadius: '7px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10.5px', fontWeight: '700', color: d.fill }}>{d.shortName}</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '2px 0 1px' }}>{d.pct}%</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>{d.count} ratings</div>
            </div>
          ))}
        </div>

        <ScoreGuideBox />
      </div>

      {/* ── 4. AREA-WISE RATINGS (COMPACT BENCHMARK UI) ───────────── */}
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading
          title="Area-Wise Ratings"
          subtitle="Performance evaluation and satisfaction benchmark across all core service dimensions"
        />

        {dimensions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Top Benchmark Summary Banner */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Area Performance Benchmark
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                  {dimensions.length} Evaluated Areas &bull; Scale 0.0 – 5.0
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                  <span>&ge; 4.0 Excellent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb' }} />
                  <span>3.0 – 3.9 Good</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }} />
                  <span>2.0 – 2.9 Avg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#475569' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
                  <span>&lt; 2.0 Needs Attn</span>
                </div>
              </div>
            </div>

            {/* Compact Benchmark Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dimensions.map((dim, idx) => {
                const score = dim.avg || 0
                const pct = Math.min(100, Math.max(0, (score / 5) * 100))
                const barColor = score >= 4.0 ? '#10b981' : score >= 3.0 ? '#2563eb' : score >= 2.0 ? '#f59e0b' : '#ef4444'
                const barGlow = score >= 4.0 ? 'rgba(16, 185, 129, 0.2)' : score >= 3.0 ? 'rgba(37, 99, 235, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                const badgeBg = score >= 4.0 ? '#f0fdf4' : score >= 3.0 ? '#eff6ff' : score >= 2.0 ? '#fffbeb' : '#fef2f2'
                const badgeBorder = score >= 4.0 ? '#bbf7d0' : score >= 3.0 ? '#bfdbfe' : score >= 2.0 ? '#fde68a' : '#fecaca'
                const badgeColor = score >= 4.0 ? '#15803d' : score >= 3.0 ? '#1d4ed8' : score >= 2.0 ? '#b45309' : '#dc2626'

                const isRank1 = idx === 0
                const isRank2 = idx === 1
                const isRank3 = idx === 2

                return (
                  <div key={idx} style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    {/* Header Row: Rank, Title, Chips & Score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          background: isRank1 ? '#fef3c7' : isRank2 ? '#f1f5f9' : isRank3 ? '#ffedd5' : '#f8fafc',
                          color: isRank1 ? '#b45309' : isRank2 ? '#475569' : isRank3 ? '#c2410c' : '#64748b',
                          border: `1px solid ${isRank1 ? '#fde68a' : isRank2 ? '#e2e8f0' : isRank3 ? '#fed7aa' : '#e2e8f0'}`,
                          fontSize: '11px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                          {dim.dimensionName}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#15803d', background: '#f0fdf4', border: '1px solid #dcfce7', padding: '1px 6px', borderRadius: '5px', fontWeight: '600' }}>
                          {dim.positivePct}% Positive
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1px 6px', borderRadius: '5px', fontWeight: '500' }}>
                          {dim.neutralPct}% Neutral
                        </span>
                        {dim.criticalPct > 0 && (
                          <span style={{ fontSize: '11px', color: dim.criticalPct >= 15 ? '#dc2626' : '#64748b', background: dim.criticalPct >= 15 ? '#fef2f2' : '#f8fafc', border: `1px solid ${dim.criticalPct >= 15 ? '#fee2e2' : '#e2e8f0'}`, padding: '1px 6px', borderRadius: '5px', fontWeight: dim.criticalPct >= 15 ? '700' : '500' }}>
                            {dim.criticalPct}% Critical
                          </span>
                        )}

                        <span style={{
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          fontSize: '12.5px',
                          minWidth: '55px',
                          textAlign: 'center'
                        }}>
                          {dim.avg} / 5
                        </span>
                      </div>
                    </div>

                    {/* Benchmark Slider Bar */}
                    <div style={{ position: 'relative', marginTop: '14px', marginBottom: '6px' }}>
                      {/* Floating Score Pin */}
                      <div style={{
                        position: 'absolute',
                        left: `${pct}%`,
                        top: '-22px',
                        transform: 'translateX(-50%)',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '10.5px',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '5px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>
                        {Number(score).toFixed(1)} ★
                        <div style={{
                          position: 'absolute',
                          bottom: '-4px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: '4px solid #0f172a'
                        }} />
                      </div>

                      {/* Main Benchmark Track */}
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        height: '10px',
                        background: '#f1f5f9',
                        borderRadius: '999px',
                        border: '1px solid #e2e8f0',
                        overflow: 'visible'
                      }}>
                        {/* Milestone Tick Dots */}
                        {[20, 40, 60, 80].map((t, ti) => (
                          <div key={ti} style={{
                            position: 'absolute',
                            left: `${t}%`,
                            top: '2px',
                            bottom: '2px',
                            width: '1px',
                            background: '#cbd5e1',
                            zIndex: 1
                          }} />
                        ))}

                        {/* Active Bar Fill */}
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, #154388 0%, ${barColor} 100%)`,
                          borderRadius: '999px',
                          boxShadow: `0 0 8px ${barGlow}`,
                          transition: 'width 0.4s ease',
                          position: 'relative',
                          zIndex: 2
                        }} />

                        {/* Slider Handle */}
                        <div style={{
                          position: 'absolute',
                          left: `calc(${pct}% - 7px)`,
                          top: '-3.5px',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: `3px solid ${barColor}`,
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                          zIndex: 3,
                          pointerEvents: 'none'
                        }} />
                      </div>

                      {/* Scale Guidelines */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        padding: '0 2px',
                        fontSize: '9.5px',
                        fontWeight: '600',
                        color: '#94a3b8'
                      }}>
                        <span>1.0</span>
                        <span>2.0</span>
                        <span>3.0 (Avg)</span>
                        <span>4.0</span>
                        <span>5.0 (Max)</span>
                      </div>
                    </div>

                    {/* Segmented Sentiment Track */}
                    <div style={{ marginTop: '8px', display: 'flex', height: '3.5px', borderRadius: '999px', overflow: 'hidden', background: '#e2e8f0' }}>
                      <div style={{ width: `${dim.positivePct}%`, background: '#10b981' }} title={`${dim.positivePct}% Positive`} />
                      <div style={{ width: `${dim.neutralPct}%`, background: '#f59e0b' }} title={`${dim.neutralPct}% Neutral`} />
                      <div style={{ width: `${dim.criticalPct}%`, background: '#ef4444' }} title={`${dim.criticalPct}% Critical`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : <InsufficientData />}
      </div>

      {/* ── 5. QUESTION-WISE SCORES (GROUPED BY CATEGORY) ─────────── */}
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading
          title="Question-Wise Scores"
          subtitle="Specific question performance grouped by category and ranked by rating"
          rightContent={
            validQuestionsSorted.length > 10 && (
              <button
                onClick={() => setShowAllQuestions(!showAllQuestions)}
                className="no-print"
                style={{
                  fontSize: '11.5px',
                  color: '#154388',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {showAllQuestions ? 'Show Top 10 Only' : `View All (${validQuestionsSorted.length})`}
              </button>
            )
          }
        />

        {groupedCategories.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {groupedCategories.map((group, groupIdx) => {
              const groupAvg = group.questions.length > 0
                ? (group.questions.reduce((sum, item) => sum + (item.avg || 0), 0) / group.questions.length).toFixed(2)
                : '0.00'

              return (
                <div
                  key={group.category || groupIdx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '9px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Category Main Heading */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '2px',
                        background: '#154388'
                      }} />
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#1e293b',
                        letterSpacing: '0.2px'
                      }}>
                        {group.category}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '10.5px',
                        color: '#64748b',
                        fontWeight: '500',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '1px 7px',
                        borderRadius: '999px'
                      }}>
                        {group.questions.length} {group.questions.length === 1 ? 'Question' : 'Questions'}
                      </span>
                      <span style={{
                        fontSize: '10.5px',
                        color: '#154388',
                        fontWeight: '700',
                        background: '#eff6ff',
                        border: '1px solid #dbeafe',
                        padding: '1px 7px',
                        borderRadius: '999px'
                      }}>
                        Avg: {groupAvg}★
                      </span>
                    </div>
                  </div>

                  {/* Related Questions Under This Category */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {group.questions.map((q, qIdx) => {
                      const score = q.avg || 0
                      const scoreColor = score >= 4.0 ? '#15803d' : score >= 3.0 ? '#1d4ed8' : '#dc2626'
                      const scoreBg = score >= 4.0 ? '#f0fdf4' : score >= 3.0 ? '#eff6ff' : '#fef2f2'
                      const scoreBorder = score >= 4.0 ? '#bbf7d0' : score >= 3.0 ? '#bfdbfe' : '#fecaca'

                      return (
                        <div
                          key={q.id || q.key || qIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            background: qIdx % 2 === 0 ? '#ffffff' : '#fcfdfe',
                            borderBottom: qIdx === group.questions.length - 1 ? 'none' : '1px solid #f1f5f9'
                          }}
                        >
                          {/* Rank Badge */}
                          <span style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {q.rank}
                          </span>

                          {/* Question Text (without small category label) */}
                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a', lineHeight: '1.35' }}>
                              {q.label}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div style={{ width: '110px', flexShrink: 0 }} className="no-mobile-hide">
                            <ScoreProgressBar score={score} max={5} />
                          </div>

                          {/* Score Pill */}
                          <div style={{
                            minWidth: '55px',
                            textAlign: 'center',
                            fontSize: '12px',
                            fontWeight: '800',
                            color: scoreColor,
                            background: scoreBg,
                            border: `1px solid ${scoreBorder}`,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            flexShrink: 0
                          }}>
                            {score} / 5
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : <InsufficientData />}
      </div>

      {/* ── 6. TOP RATED AREAS & AREAS NEEDING IMPROVEMENT (COMPACT) ── */}
      <div className="ai-two-col-grid avoid-break">
        {/* Top Rated Areas */}
        <div className="ai-card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <SectionHeading title="Top Rated Areas" subtitle="Highest trainee satisfaction" />
          {topRatedAreas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topRatedAreas.map((item, idx) => (
                <div key={idx} style={{
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderLeft: '3.5px solid #16a34a',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        background: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.title}</strong>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', background: '#f0fdf4', padding: '2px 7px', borderRadius: '5px', border: '1px solid #bbf7d0' }}>
                      {item.score}
                    </span>
                  </div>
                  {item.explanation && (
                    <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.45' }}>
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : <InsufficientData />}
        </div>

        {/* Areas That Need Improvement */}
        <div className="ai-card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <SectionHeading title="Areas Needing Improvement" subtitle="Areas with lower ratings or concerns" />
          {areasNeedingImprovement.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {areasNeedingImprovement.map((item, idx) => (
                <div key={idx} style={{
                  background: '#ffffff',
                  border: '1px solid #fecaca',
                  borderLeft: '3.5px solid #dc2626',
                  borderRadius: '8px',
                  padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        background: '#fef2f2',
                        color: '#b91c1c',
                        border: '1px solid #fecaca',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.title}</strong>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#dc2626', background: '#fef2f2', padding: '2px 7px', borderRadius: '5px', border: '1px solid #fecaca' }}>
                      {item.score}
                    </span>
                  </div>
                  {item.explanation && (
                    <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.45' }}>
                      {item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : <InsufficientData />}
        </div>
      </div>

      {/* ── 7. FEEDBACK INSIGHTS (COMPACT) ────────────────────────── */}
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading title="Feedback Insights" subtitle="Highlights organized from actual student feedback comments" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {/* What Trainees Liked */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '9px',
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#15803d',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '2px 8px',
              borderRadius: '5px',
              textTransform: 'uppercase',
              marginBottom: '10px',
              letterSpacing: '0.4px'
            }}>
              What Trainees Liked
            </div>
            {whatTraineesSaid.whatTraineesLiked?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatTraineesSaid.whatTraineesLiked.map((item, idx) => (
                  <div key={idx} style={{
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: '1.45',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    padding: '7px 9px',
                    borderRadius: '6px'
                  }}>
                    {item.point || item.comment || item}
                  </div>
                ))}
              </div>
            ) : <InsufficientData message="No specific positive comments recorded." />}
          </div>

          {/* What Could Be Better */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '9px',
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '2px 8px',
              borderRadius: '5px',
              textTransform: 'uppercase',
              marginBottom: '10px',
              letterSpacing: '0.4px'
            }}>
              What Could Be Better
            </div>
            {whatTraineesSaid.whatCouldBeBetter?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatTraineesSaid.whatCouldBeBetter.map((item, idx) => (
                  <div key={idx} style={{
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: '1.45',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    padding: '7px 9px',
                    borderRadius: '6px'
                  }}>
                    {item.point || item.comment || item}
                  </div>
                ))}
              </div>
            ) : <InsufficientData message="No specific complaints recorded." />}
          </div>

          {/* What Trainees Suggested */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '9px',
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10.5px',
              fontWeight: '800',
              color: '#1d4ed8',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: '5px',
              textTransform: 'uppercase',
              marginBottom: '10px',
              letterSpacing: '0.4px'
            }}>
              What Trainees Suggested
            </div>
            {whatTraineesSaid.whatTraineesSuggested?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {whatTraineesSaid.whatTraineesSuggested.map((item, idx) => (
                  <div key={idx} style={{
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: '1.45',
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    padding: '7px 9px',
                    borderRadius: '6px'
                  }}>
                    {item.point || item.comment || item}
                  </div>
                ))}
              </div>
            ) : <InsufficientData message="No suggestions recorded." />}
          </div>
        </div>
      </div>

      {/* ── 8. MOST MENTIONED TOPICS & OVERALL FEEDBACK TONE ──────── */}
      <div className="ai-two-col-grid avoid-break">
        {/* Most Mentioned Topics (Compact Card List) */}
        <div className="ai-card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <SectionHeading title="Most Mentioned Topics" subtitle="Recurring topics detected in comments" />
          {topicsChartData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topicsChartData.map((t, i) => (
                <div key={i} style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '9px 12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>{t.name}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#154388',
                      background: '#eff6ff',
                      border: '1px solid #dbeafe',
                      padding: '1px 6px',
                      borderRadius: '5px'
                    }}>
                      {t.mentions} ({t.percentage}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '7px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(10, t.percentage || (t.mentions * 25)))}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, #154388 0%, ${PILLAR_COLORS[i % PILLAR_COLORS.length]} 100%)`,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <InsufficientData message="No specific recurring topics identified." />}
        </div>

        {/* Overall Feedback Tone (Compact Donut Ring) */}
        <div className="ai-card" style={{ marginBottom: 0, padding: '16px 18px' }}>
          <SectionHeading title="Overall Feedback Tone" subtitle="Tone analysis of trainee sentiment" />
          {toneData.length > 0 ? (
            <div>
              <div className="no-print-chart" style={{ display: 'flex', justifyContent: 'center', position: 'relative', height: '145px' }}>
                <ResponsiveContainer width="100%" height={145}>
                  <PieChart>
                    <Pie
                      data={toneData}
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={64}
                      paddingAngle={3}
                      cornerRadius={4}
                      dataKey="value"
                    >
                      {toneData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      formatter={(v, n) => [`${v}%`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Tone Badge in Donut Ring */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
                    {positiveVal}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '1px' }}>
                    Positive
                  </div>
                </div>
              </div>

              {/* Sentiment Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: '6px', fontSize: '11.5px', marginTop: '8px' }}>
                <span style={{ color: '#15803d', background: '#f0fdf4', border: '1px solid #dcfce7', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                  Positive: <strong>{positiveVal}%</strong>
                </span>
                <span style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fef3c7', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                  Neutral: <strong>{neutralVal}%</strong>
                </span>
                <span style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fee2e2', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                  Negative: <strong>{negativeVal}%</strong>
                </span>
              </div>
            </div>
          ) : <InsufficientData />}
        </div>
      </div>

      {/* ── 9. AI SUMMARY (COMPACT) ───────────────────────────────── */}
      {aiSummary.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
          <SectionHeading title="AI Summary" subtitle="Key findings synthesized from ratings and comments" />
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#1e293b', lineHeight: '1.55' }}>
            {aiSummary.map((point, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 10. RECOMMENDED NEXT STEPS (COMPACT) ──────────────────── */}
      {nextSteps.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
          <SectionHeading title="Recommended Next Steps" subtitle="Actionable improvements based on feedback" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {nextSteps.map((step, idx) => (
              <div key={idx} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#154388', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.4px' }}>
                    Step {step.step || idx + 1}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '4px', lineHeight: '1.35' }}>
                    {step.action}
                  </div>
                </div>
                {step.reason && (
                  <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: '1.4', marginTop: '3px' }}>
                    {step.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── PRE-LTC REPORT RENDERER (PRESERVED & POLISHED) ──────────────────────────

function PreLtcReport({ report }) {
  const d = report.verifiedData || {}
  const pillarExcitement = d.pillarExcitement || []

  const pillarChartData = pillarExcitement
    .filter(p => p.pct !== null)
    .map(p => ({ name: p.pillar.split(' & ')[0].substring(0, 14), fullName: p.pillar, value: p.pct }))

  return (
    <div id="ai-report-printable-area" className="ai-printable-doc" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a', letterSpacing: '-0.3px' }}>
          {report.reportTitle || 'Pre-LTC Feedback Report'}
        </h1>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Batch: <strong style={{ color: '#0f172a' }}>{d.batchName || 'All Batches'}</strong> &bull; Responses: <strong style={{ color: '#154388' }}>{d.studentCount || 0}</strong> &bull; Generated: <strong style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('en-GB')}</strong>
        </div>
      </div>

      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading title="Overall Summary" />
        <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5', margin: 0 }}>{report.executiveSummary}</p>
      </div>

      {pillarChartData.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
          <SectionHeading title="Pillar Excitement Scores" />
          <div className="no-print-chart">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={pillarChartData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10.5 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10.5 }} width={100} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                <Bar dataKey="value" fill="#154388" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PRE-LTC VS POST-LTC RESEARCH-GRADE COMPARISON REPORT ───────────────────

function DistributionMiniBar({ dist, labels, scaleType }) {
  const OPTION_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#10b981']
  const optionKeys = [1, 2, 3, 4, 5]
  const defaultLabels = scaleType === 'frequency'
    ? ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']
    : scaleType === 'excitement'
      ? ['Not Excited', 'Less Excited', 'Moderately', 'Very Excited', 'Extremely']
      : ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree']

  const effLabels = labels && labels.length === 5 ? labels : defaultLabels

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', background: '#f1f5f9' }}>
        {optionKeys.map((k, idx) => {
          const pct = dist?.[k]?.pct || 0
          if (pct === 0) return null
          return (
            <div
              key={k}
              title={`${effLabels[idx]}: ${dist[k].count} (${pct}%)`}
              style={{
                width: `${pct}%`,
                background: OPTION_COLORS[idx],
                transition: 'width 0.3s ease'
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#64748b' }}>
        {optionKeys.map((k, idx) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: OPTION_COLORS[idx], display: 'inline-block' }} />
            <span>{dist?.[k]?.pct || 0}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function DeltaBadge({ delta, deltaPct }) {
  if (delta === null || delta === undefined) {
    return <span style={{ fontSize: '11px', color: '#94a3b8' }}>&mdash;</span>
  }
  const isPositive = delta > 0
  const isNeutral = delta === 0
  const bg = isNeutral ? '#f1f5f9' : isPositive ? '#dcfce7' : '#fee2e2'
  const textCol = isNeutral ? '#475569' : isPositive ? '#15803d' : '#b91c1c'
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '700',
      background: bg,
      color: textCol
    }}>
      <Icon size={12} />
      <span>{delta > 0 ? `+${delta}` : delta}</span>
      {deltaPct !== undefined && deltaPct !== null && (
        <span style={{ fontSize: '10px', opacity: 0.85 }}>({deltaPct > 0 ? `+${deltaPct}` : deltaPct}%)</span>
      )}
    </span>
  )
}

function DualComparisonBar({ preScore, postScore, max = 5 }) {
  const prePct = Math.min(100, Math.max(0, Math.round(((preScore || 0) / max) * 100)))
  const postPct = Math.min(100, Math.max(0, Math.round(((postScore || 0) / max) * 100)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', width: '38px' }}>PRE</span>
        <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${prePct}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }} />
        </div>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b', width: '32px', textAlign: 'right' }}>
          {preScore !== null && preScore !== undefined ? preScore : '\u2014'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', width: '38px' }}>POST</span>
        <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${postPct}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
        </div>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b', width: '32px', textAlign: 'right' }}>
          {postScore !== null && postScore !== undefined ? postScore : '\u2014'}
        </span>
      </div>
    </div>
  )
}

function getQuestionExplanation(q, isSingle) {
  const delta = q.matched?.delta
  const subj = isSingle ? 'The student' : 'Students'

  if (delta === null || delta === undefined) {
    return {
      note: `${subj} response was recorded.`,
      suggestion: null
    }
  }

  if (delta === 0) {
    return {
      note: `${subj} gave the exact same rating before and after LTC.`,
      suggestion: 'This response stayed steady throughout the camp period.'
    }
  }

  if (delta >= 1.5) {
    return {
      note: `${subj} selected a noticeably stronger rating after LTC (+${delta}).`,
      suggestion: 'This indicates a significant gain in confidence, habit formation, or engagement.'
    }
  } else if (delta > 0) {
    return {
      note: `${subj} gave a higher rating after LTC (+${delta}).`,
      suggestion: 'This points toward positive progress in this area.'
    }
  } else if (delta <= -1.5) {
    return {
      note: `${subj} gave a noticeably lower rating after LTC (${delta}).`,
      suggestion: 'This may reflect a more realistic and self-critical assessment after camp challenges.'
    }
  } else {
    return {
      note: `${subj} gave a lower rating after LTC (${delta}).`,
      suggestion: 'This may reflect self-calibration or areas needing further attention.'
    }
  }
}

function PrePostComparisonReport({ report, generatingPdf }) {
  const d = report.verifiedPrePostData || {}
  const summary = d.summary || {}
  const domainSummaries = d.domainSummaries || []
  const questionComparisons = d.questionComparisons || []
  const rankings = d.rankings || { topPositiveShifts: [], topNegativeShifts: [], stableQuestions: [] }
  const psychometrics = d.psychometrics || {}
  const demographics = d.demographics || {}
  const qualitativePairs = d.qualitativePairs || []
  const correlations = d.correlations || []

  const nMatched = summary.matchedCohortCount || 0
  const isSingleStudent = nMatched === 1

  // UI States
  const [selectedDomain, setSelectedDomain] = useState('ALL')
  const [questionSearch, setQuestionSearch] = useState('')
  const [activeRankingTab, setActiveRankingTab] = useState('positive')
  const [showAllItems, setShowAllItems] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  // Domain Filter Categories
  const domainOptions = [
    { key: 'ALL', label: `All Questions (${questionComparisons.length})` },
    { key: 'Cognitive Thinking', label: 'Cognitive Thinking (8)' },
    { key: 'Social Interactions', label: 'Social Interactions (8)' },
    { key: 'Self-Regulation', label: 'Self-Regulation (8)' },
    { key: 'Body & Action', label: 'Body & Action (8)' },
    { key: 'Values & Judgment', label: 'Values & Judgment (8)' },
    { key: 'Creative & Imaginative', label: 'Creative (8)' },
    { key: 'Spiritual', label: 'Spiritual (8)' },
    { key: 'Agriculture & Nature', label: 'Agriculture (5)' },
    { key: 'Physical Fitness & Sports', label: 'Sports & Fitness (5)' },
    { key: 'Team Building & Leadership', label: 'Leadership (5)' },
    { key: 'Patriotism & Nation Building', label: 'Patriotism (5)' },
    { key: 'Spirituality & Peace', label: 'Peace (5)' },
    { key: 'Values & Self-Correction', label: 'Mistakes (2)' },
    { key: 'Pillar Excitement', label: 'Pillar Excitement (5)' }
  ]

  // Filtered Questions
  const filteredQuestions = questionComparisons.filter(q => {
    const matchesDomain = selectedDomain === 'ALL' || q.category === selectedDomain
    const matchesSearch = !questionSearch.trim() ||
      q.label.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.category.toLowerCase().includes(questionSearch.toLowerCase())
    return matchesDomain && matchesSearch
  })

  const displayedQuestions = showAllItems || questionSearch.trim() || generatingPdf
    ? filteredQuestions
    : filteredQuestions.slice(0, 16)

  // AI Content Fallbacks
  const keyFindings = report.keyFindings || report.executiveSummary?.keyFindings || []
  const insights = report.insights || report.researchInsights || []
  const whatLtcCanLearn = report.whatLtcCanLearn || report.researchQuestions || []
  const simpleOverview = report.simpleOverview ||
    (isSingleStudent
      ? `The matched student moved from an average response of ${summary.overallPreScore || '2.60'} before LTC to ${summary.overallPostScore || '3.59'} after LTC, representing an overall change of +${summary.overallDeltaScore || '0.99'}.`
      : `Across ${nMatched} matched students, the average response moved from ${summary.overallPreScore} before LTC to ${summary.overallPostScore} after LTC.`)

  return (
    <div id="ai-report-printable-area" className="ai-printable-doc" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── REPORT HEADER ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 24px', background: '#0f172a', color: '#fff', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: '1.25' }}>
              {report.reportTitle || 'Pre-LTC vs Post-LTC Student Response Report'}
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              {report.reportSubtitle || 'What changed in student responses before and after the LTC programme'}
            </p>
          </div>
          <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Matched Students</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>
              {nMatched} {isSingleStudent ? 'Student' : 'Students'}
            </div>
          </div>
        </div>
      </div>

      {/* ── TOP SUMMARY CARDS (SIMPLE 4-METRIC GRID) ── */}
      <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        <div className="ai-card" style={{ padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Before LTC
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.overallPreScore !== undefined ? summary.overallPreScore : '\u2014'} <span style={{ fontSize: '14px', fontWeight: '500', color: '#94a3b8' }}>/ 5</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Average response before camp
          </div>
        </div>

        <div className="ai-card" style={{ padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              After LTC
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.overallPostScore !== undefined ? summary.overallPostScore : '\u2014'} <span style={{ fontSize: '14px', fontWeight: '500', color: '#94a3b8' }}>/ 5</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Average response after camp
          </div>
        </div>

        <div className="ai-card" style={{ padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Overall Change
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: summary.overallDeltaScore >= 0 ? '#16a34a' : '#dc2626', display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: summary.overallDeltaScore >= 0 ? '#15803d' : '#b91c1c', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {summary.overallDeltaScore > 0 ? `+${summary.overallDeltaScore}` : summary.overallDeltaScore || '\u2014'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {summary.overallDeltaPct > 0 ? `+${summary.overallDeltaPct}%` : `${summary.overallDeltaPct}%`} relative change
          </div>
        </div>

        <div className="ai-card" style={{ padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Students Compared
            </span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {nMatched}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Completed both Pre and Post forms
          </div>
        </div>
      </div>

      {/* Simple Summary Sentence Under Cards */}
      <div className="ai-card avoid-break" style={{ padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
        <p style={{ fontSize: '13px', color: '#1e293b', margin: 0, lineHeight: '1.5', fontWeight: '500' }}>
          {isSingleStudent
            ? `The available matched student moved from an average response of ${summary.overallPreScore ?? '—'} before LTC to ${summary.overallPostScore ?? '—'} after LTC.`
            : `The ${nMatched} matched students moved from an average response of ${summary.overallPreScore ?? '—'} before LTC to ${summary.overallPostScore ?? '—'} after LTC.`}
        </p>
      </div>

      {/* ── STORY STEP 1: WHAT HAPPENED? (OVERVIEW OF CHANGES) ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <SectionHeading
          title="1. What happened?"
          subtitle="A simple overview of the main changes observed in student responses"
        />

        <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.55', marginTop: '10px' }}>
          {simpleOverview}
        </p>

        {keyFindings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px', marginTop: '14px' }}>
            {keyFindings.map((kf, i) => {
              const statusColor = kf.status === 'Positive' ? '#16a34a' : kf.status === 'Needs Attention' ? '#d97706' : '#64748b'
              const statusBg = kf.status === 'Positive' ? '#f0fdf4' : kf.status === 'Needs Attention' ? '#fffbeb' : '#f8fafc'
              const statusBorder = kf.status === 'Positive' ? '#dcfce7' : kf.status === 'Needs Attention' ? '#fef3c7' : '#e2e8f0'
              return (
                <div
                  key={i}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${statusBorder}`,
                    background: statusBg,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>
                      #{kf.index || i + 1}. {kf.title}
                    </span>
                    {kf.status && (
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: '#fff', color: statusColor, border: `1px solid ${statusBorder}` }}>
                        {kf.status}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
                    {kf.finding}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── STORY STEP 2: WHAT CHANGED THE MOST? ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <div>
            <SectionHeading
              title="2. What changed the most?"
              subtitle="Questions where student responses showed the largest shift"
            />
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveRankingTab('positive')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeRankingTab === 'positive' ? '#fff' : 'transparent',
                color: activeRankingTab === 'positive' ? '#15803d' : '#64748b',
                fontWeight: '700',
                fontSize: '11.5px',
                cursor: 'pointer',
                boxShadow: activeRankingTab === 'positive' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Biggest Increases
            </button>
            <button
              onClick={() => setActiveRankingTab('negative')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeRankingTab === 'negative' ? '#fff' : 'transparent',
                color: activeRankingTab === 'negative' ? '#b91c1c' : '#64748b',
                fontWeight: '700',
                fontSize: '11.5px',
                cursor: 'pointer',
                boxShadow: activeRankingTab === 'negative' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Largest Decreases / Self-Criticism
            </button>
          </div>
        </div>

        {generatingPdf ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#15803d', marginBottom: '8px', textTransform: 'uppercase' }}>
                &bull; Questions with Biggest Increases
              </div>
              {rankings.topPositiveShifts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                  {rankings.topPositiveShifts.slice(0, 8).map((item, idx) => {
                    const exp = getQuestionExplanation(item, isSingleStudent)
                    return (
                      <div key={idx} style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{item.category}</span>
                          <div style={{ marginLeft: 'auto' }}><DeltaBadge delta={item.matched.delta} deltaPct={item.matched.deltaPct} /></div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>&ldquo;{item.label}&rdquo;</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11.5px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <span>Before LTC: <strong style={{ color: '#0f172a' }}>{item.pre.avg} / 5</strong></span>
                          <span>&rarr;</span>
                          <span>After LTC: <strong style={{ color: '#0f172a' }}>{item.post.avg} / 5</strong></span>
                          <span style={{ color: '#16a34a', fontWeight: '700', marginLeft: 'auto' }}>Change: +{item.matched.delta}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          {exp.note}
                          {exp.suggestion && <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}><strong>What this may suggest:</strong> {exp.suggestion}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>
                  No questions showed a score increase.
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#b91c1c', marginBottom: '8px', textTransform: 'uppercase' }}>
                &bull; Questions with Largest Decreases / Self-Criticism
              </div>
              {rankings.topNegativeShifts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                  {rankings.topNegativeShifts.slice(0, 8).map((item, idx) => {
                    const exp = getQuestionExplanation(item, isSingleStudent)
                    return (
                      <div key={idx} style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{item.category}</span>
                          <div style={{ marginLeft: 'auto' }}><DeltaBadge delta={item.matched.delta} deltaPct={item.matched.deltaPct} /></div>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>&ldquo;{item.label}&rdquo;</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11.5px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <span>Before LTC: <strong style={{ color: '#0f172a' }}>{item.pre.avg} / 5</strong></span>
                          <span>&rarr;</span>
                          <span>After LTC: <strong style={{ color: '#0f172a' }}>{item.post.avg} / 5</strong></span>
                          <span style={{ color: '#dc2626', fontWeight: '700', marginLeft: 'auto' }}>Change: {item.matched.delta}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          {exp.note}
                          {exp.suggestion && <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}><strong>What this may suggest:</strong> {exp.suggestion}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>
                  No questions showed a score decrease (all questions improved or remained unchanged).
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {(() => {
              const list = activeRankingTab === 'positive' ? rankings.topPositiveShifts : rankings.topNegativeShifts
              if (!list || list.length === 0) {
                return (
                  <div style={{ padding: '20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                    {activeRankingTab === 'positive'
                      ? 'No questions showed a score increase.'
                      : 'No questions showed a score decrease (all questions improved or remained unchanged).'}
                  </div>
                )
              }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
                  {list.slice(0, 8).map((item, idx) => {
                    const exp = getQuestionExplanation(item, isSingleStudent)
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.category}
                          </span>
                          <div style={{ marginLeft: 'auto' }}>
                            <DeltaBadge delta={item.matched.delta} deltaPct={item.matched.deltaPct} />
                          </div>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>
                          &ldquo;{item.label}&rdquo;
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11.5px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <span>Before LTC: <strong style={{ color: '#0f172a' }}>{item.pre.avg} / 5</strong></span>
                          <span>&rarr;</span>
                          <span>After LTC: <strong style={{ color: '#0f172a' }}>{item.post.avg} / 5</strong></span>
                          <span style={{ color: item.matched.delta >= 0 ? '#16a34a' : '#dc2626', fontWeight: '700', marginLeft: 'auto' }}>
                            Change: {item.matched.delta > 0 ? `+${item.matched.delta}` : item.matched.delta}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          {exp.note}
                          {exp.suggestion && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                              <strong>What this may suggest:</strong> {exp.suggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── STORY STEP 3: WHAT STAYED THE SAME? ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <SectionHeading
          title="3. What stayed the same?"
          subtitle="Areas and habits where student responses remained steady before and after camp"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px', marginTop: '12px' }}>
          {rankings.stableQuestions.slice(0, 6).map((item, idx) => {
            const exp = getQuestionExplanation(item, isSingleStudent)
            return (
              <div
                key={idx}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    {item.category}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    <DeltaBadge delta={item.matched.delta} />
                  </div>
                </div>

                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>
                  &ldquo;{item.label}&rdquo;
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11.5px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                  <span>Before LTC: <strong style={{ color: '#0f172a' }}>{item.pre.avg} / 5</strong></span>
                  <span>&rarr;</span>
                  <span>After LTC: <strong style={{ color: '#0f172a' }}>{item.post.avg} / 5</strong></span>
                  <span style={{ color: '#475569', fontWeight: '600', marginLeft: 'auto' }}>
                    Change: {item.matched.delta > 0 ? `+${item.matched.delta}` : item.matched.delta || '0'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  {exp.note}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STORY STEP 4: WHICH OVERALL AREAS SAW THE BIGGEST SHIFTS? ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <SectionHeading
          title="Which overall areas changed the most?"
          subtitle="Comparison of all 7 Developmental Domains and 5 Core Pillars"
        />

        <div style={{ overflowX: 'auto', marginTop: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Area</th>
                <th style={{ padding: '10px 8px', fontWeight: '700', width: '55px' }}>Questions</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', width: '260px' }}>Before vs After Score</th>
                <th style={{ padding: '10px 8px', fontWeight: '700', width: '90px', textAlign: 'center' }}>Change in Score</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', width: '120px', textAlign: 'right' }}>Before &rarr; After</th>
              </tr>
            </thead>
            <tbody>
              {domainSummaries.map((ds, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a' }}>
                    {ds.name}
                  </td>
                  <td style={{ padding: '10px 8px', color: '#64748b' }}>
                    {ds.questionCount}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <DualComparisonBar preScore={ds.preAvg} postScore={ds.postAvg} max={5} />
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <DeltaBadge delta={ds.delta} deltaPct={ds.deltaPct} />
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '11.5px' }}>
                    <span>{ds.preAvg}</span> &rarr; <strong style={{ color: '#0f172a' }}>{ds.postAvg}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STORY STEP 5: HOW DID STUDENTS ANSWER? (ALL 88 QUESTIONS) ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <SectionHeading
              title="4. How did students answer?"
              subtitle="Question-by-question view of actual Before vs After responses"
            />
          </div>
          <div className="no-print" style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search any question..."
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '11.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0 14px 0' }}>
          {domainOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedDomain(opt.key)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                border: selectedDomain === opt.key ? '1px solid #154388' : '1px solid #e2e8f0',
                background: selectedDomain === opt.key ? '#154388' : '#f8fafc',
                color: selectedDomain === opt.key ? '#fff' : '#475569',
                fontSize: '11px',
                fontWeight: selectedDomain === opt.key ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Answer Scale Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '10.5px', color: '#64748b', marginBottom: '12px' }}>
          <span style={{ fontWeight: '700', color: '#0f172a' }}>Answer Choices:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#ef4444' }} /> Rating 1 (Never / Strongly Disagree)</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f97316' }} /> Rating 2 (Rarely / Disagree)</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#eab308' }} /> Rating 3 (Sometimes / Neutral)</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }} /> Rating 4 (Often / Agree)</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }} /> Rating 5 (Always / Strongly Agree)</span>
        </div>

        {/* Questions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayedQuestions.map((q, idx) => {
            const exp = getQuestionExplanation(q, isSingleStudent)
            return (
              <div
                key={q.id || idx}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#154388', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                        {q.category}
                      </span>
                      {q.isReverseCoded && (
                        <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#9333ea', background: '#f3e8ff', padding: '2px 8px', borderRadius: '4px' }}>
                          Reverse-worded item
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', lineHeight: '1.4' }}>
                      &ldquo;{q.label}&rdquo;
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>Before &rarr; After</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                        {q.pre.avg ?? '\u2014'} / 5 &rarr; {q.post.avg ?? '\u2014'} / 5
                      </div>
                    </div>
                    <DeltaBadge delta={q.matched.delta} deltaPct={q.matched.deltaPct} />
                  </div>
                </div>

                {/* Short Explanation & Suggestion */}
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px', color: '#334155' }}>
                  <div>{exp.note}</div>
                  {exp.suggestion && (
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                      <strong>What this may suggest:</strong> {exp.suggestion}
                    </div>
                  )}
                </div>

                {/* Answer Distribution Mini-Bars */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', paddingTop: '2px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', marginBottom: '3px' }}>
                      BEFORE LTC ANSWERS (n = {q.pre.count})
                    </div>
                    <DistributionMiniBar dist={q.pre.dist} labels={q.scaleLabels} scaleType={q.scaleType} />
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981', marginBottom: '3px' }}>
                      AFTER LTC ANSWERS (n = {q.post.count})
                    </div>
                    <DistributionMiniBar dist={q.post.dist} labels={q.scaleLabels} scaleType={q.scaleType} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!generatingPdf && !showAllItems && !questionSearch.trim() && filteredQuestions.length > 16 && (
          <div className="no-print" style={{ textAlign: 'center', marginTop: '14px' }}>
            <button
              onClick={() => setShowAllItems(true)}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: '1px solid #154388',
                background: '#eff6ff',
                color: '#154388',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Show All {filteredQuestions.length} Questions
            </button>
          </div>
        )}
      </div>

      {/* ── STORY STEP 6: WHAT DO THESE CHANGES MEAN? (KEY DISCOVERIES) ── */}
      {insights.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '20px 22px' }}>
          <SectionHeading
            title="5. What do these changes mean?"
            subtitle="Important observations from the data explained in simple English"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {insights.map((ri, i) => (
              <div
                key={i}
                style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                  {i + 1}. {ri.theme}
                </div>

                <div style={{ padding: '10px 12px', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>What we see</div>
                  <div style={{ fontSize: '12.5px', color: '#1e3a8a', marginTop: '3px', lineHeight: '1.45' }}>
                    {ri.whatWeSee || ri.empiricalEvidence}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>What this may suggest</div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '3px', lineHeight: '1.45' }}>
                    {ri.whatItMayMean || ri.behavioralInterpretation}
                  </div>
                </div>

                {(ri.whyItMatters || ri.actionableImplication) && (
                  <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7', fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                    Why it matters: {ri.whyItMatters || ri.actionableImplication}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STORY STEP 7: WHAT DID STUDENTS THEMSELVES SAY? ── */}
      {qualitativePairs.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '20px 22px' }}>
          <SectionHeading
            title="6. What did students themselves say?"
            subtitle="Original written responses from students before and after the camp"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {qualitativePairs.slice(0, 3).map((qp, idx) => (
              <div key={idx} style={{ padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', marginBottom: '8px' }}>
                  {isSingleStudent ? 'Student Responses' : qp.anonymousId}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {qp.lifeMeaningPre && (
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6' }}>BEFORE LTC: Meaning of Life</div>
                      <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>&ldquo;{qp.lifeMeaningPre}&rdquo;</div>
                    </div>
                  )}
                  {qp.lifeMeaningPost && (
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>AFTER LTC: Meaning of Life</div>
                      <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>&ldquo;{qp.lifeMeaningPost}&rdquo;</div>
                    </div>
                  )}
                  {qp.habitToChangePre && (
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6' }}>BEFORE LTC: Habit Targeted for Change</div>
                      <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>&ldquo;{qp.habitToChangePre}&rdquo;</div>
                    </div>
                  )}
                  {qp.habitChangedPost && (
                    <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#10b981' }}>AFTER LTC: Habit Changed or Started</div>
                      <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '2px' }}>&ldquo;{qp.habitChangedPost}&rdquo;</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HOW STUDENTS SELECTED ANSWERS (ANSWER PATTERNS) ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <SectionHeading
          title="How students responded"
          subtitle="Patterns in how answers were selected (neutral vs strong responses)"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Neutral / Middle Answers (Rating 3)</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '6px 0 4px 0', letterSpacing: '-0.3px' }}>
              {psychometrics.centralTendency?.preMiddlePct}% <span style={{ fontSize: '16px', fontWeight: '500', color: '#94a3b8' }}>&rarr;</span> {psychometrics.centralTendency?.postMiddlePct}%
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.45' }}>
              Shows whether the respondent used safe/middle options or took a clearer position.
            </p>
          </div>

          <div style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Clear / Strong Answers (Ratings 1 & 5)</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '6px 0 4px 0', letterSpacing: '-0.3px' }}>
              {psychometrics.extremeResponseBias?.preExtremePct}% <span style={{ fontSize: '16px', fontWeight: '500', color: '#94a3b8' }}>&rarr;</span> {psychometrics.extremeResponseBias?.postExtremePct}%
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.45' }}>
              Shows whether the respondent gave decisive, definite ratings (Never / Always / Strongly Agree).
            </p>
          </div>

          <div style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Positive Response Rate (Ratings 4 & 5)</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', margin: '6px 0 4px 0', letterSpacing: '-0.3px' }}>
              {psychometrics.positivityRate?.preHighPct}% <span style={{ fontSize: '16px', fontWeight: '500', color: '#94a3b8' }}>&rarr;</span> {psychometrics.positivityRate?.postHighPct}%
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.45' }}>
              Percentage of answers selected as Often, Always, Agree, or Strongly Agree.
            </p>
          </div>
        </div>
      </div>

      {/* ── COMPARISON BY GENDER, DEPARTMENT & BATCH ── */}
      <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
        <SectionHeading
          title="Comparison by Gender, Department & Batch"
          subtitle="Average responses segmented by participant background"
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '12px' }}>
          {/* Gender */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Gender</div>
            {demographics.gender && demographics.gender.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {demographics.gender.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '600' }}>{g.gender} (n={g.count})</span>
                    <span>{g.preAvg} &rarr; <strong style={{ color: '#0f172a' }}>{g.postAvg}</strong> ({g.delta > 0 ? `+${g.delta}` : g.delta})</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>No gender data recorded.</div>}
          </div>

          {/* Department */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Department / School</div>
            {demographics.department && demographics.department.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {demographics.department.slice(0, 4).map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '600', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.department}>{d.department} (n={d.count})</span>
                    <span>{d.preAvg} &rarr; <strong style={{ color: '#0f172a' }}>{d.postAvg}</strong> ({d.delta > 0 ? `+${d.delta}` : d.delta})</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>No department data recorded.</div>}
          </div>

          {/* Batch */}
          <div style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Batch</div>
            {demographics.batch && demographics.batch.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {demographics.batch.map((b, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '600' }}>{b.batchName} (n={b.count})</span>
                    <span>{b.preAvg} &rarr; <strong style={{ color: '#0f172a' }}>{b.postAvg}</strong> ({b.delta > 0 ? `+${b.delta}` : b.delta})</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>No batch data recorded.</div>}
          </div>
        </div>
      </div>

      {/* ── STORY STEP 7: WHAT SHOULD LTC LEARN FROM THIS? ── */}
      {whatLtcCanLearn.length > 0 && (
        <div className="ai-card avoid-break" style={{ padding: '20px 22px', borderRadius: '12px' }}>
          <SectionHeading
            title="7. What should LTC learn from this?"
            subtitle="Practical observations and suggestions for camp organizers and trainers"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px', marginTop: '12px' }}>
            {whatLtcCanLearn.map((item, i) => (
              <div key={i} style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#154388' }}>
                  {i + 1}. {item.point || item.researchQuestion}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.45' }}>
                  {item.observation || item.rationale}
                </div>
                {(item.suggestion || item.suggestedMethodology) && (
                  <div style={{ fontSize: '11.5px', color: '#0369a1', marginTop: '2px', fontWeight: '600', background: '#f0f9ff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e0f2fe' }}>
                    Suggestion: {item.suggestion || item.suggestedMethodology}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EXPANDABLE TECHNICAL DETAILS & METHODOLOGY (FOR RESEARCHERS) ── */}
      <div className="ai-card avoid-break" style={{ padding: '18px 22px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              Technical Details & Methodology (For Researchers)
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Detailed statistical notes, formulas, and survey structure
            </div>
          </div>
          {!generatingPdf && (
            <button
              className="no-print"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {showTechnicalDetails ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>

        {(showTechnicalDetails || generatingPdf) && (
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
            <div>
              <strong>Sample Sizes:</strong> Evaluated {summary.totalPreSubmissions || 0} Pre-LTC and {summary.totalPostSubmissions || 0} Post-LTC submissions. Matched-cohort comparison evaluates respondents who submitted both forms (n = {nMatched}).
            </div>
            <div>
              <strong>Reverse-Worded Questions:</strong> 9 questions are reverse-worded (e.g. &ldquo;I usually hide mistakes to avoid trouble&rdquo;). For these items, a score decrease represents a positive shift and is accounted for in overall positive change calculations.
            </div>
            <div>
              <strong>Answer Scales:</strong> Questions use standard 5-point scales: Frequency (Never=1 to Always=5), Agreement (Strongly Disagree=1 to Strongly Agree=5), and Excitement (Not Excited=1 to Extremely Excited=5).
            </div>
            {correlations.length > 0 && (
              <div>
                <strong>Inter-Area Relationships:</strong> {correlations.map(c => `${c.pair}: ${c.r !== null ? `r = ${c.r}` : 'n < 2'}`).join(' | ')}
              </div>
            )}
            <div style={{ padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#92400e', fontSize: '11.5px', marginTop: '6px', lineHeight: '1.5' }}>
              <strong>What this data can tell us (Observational Scope):</strong> This report is based on self-reported survey responses. Observed changes reflect descriptive before-and-after differences in student choices and cannot be interpreted as isolated causal proof without a control group.
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

// ─── GENERIC REPORT RENDERER (PRESERVED & POLISHED) ──────────────────────────


function GenericReport({ report }) {
  return (
    <div id="ai-report-printable-area" className="ai-printable-doc" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', color: '#0f172a', letterSpacing: '-0.3px' }}>
          {report.reportTitle || 'Feedback Report'}
        </h1>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Batch: <strong style={{ color: '#0f172a' }}>{report.dataSummary?.batchName || 'All Batches'}</strong> &bull; Responses: <strong style={{ color: '#154388' }}>{report.dataSummary?.totalResponses || 0}</strong>
        </div>
      </div>
      <div className="ai-card avoid-break" style={{ padding: '16px 18px' }}>
        <SectionHeading title="Summary" />
        <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5', margin: 0 }}>
          {report.reportSummary?.summaryText || report.finalConclusion || 'Report generated successfully.'}
        </p>
      </div>
    </div>
  )
}

// ─── MAIN TAB COMPONENT ──────────────────────────────────────────────────────

const LOADING_PHASES = [
  'Fetching real responses from database...',
  'Calculating score distributions...',
  'Analyzing question-level performance...',
  'Analyzing qualitative feedback...',
  'Detecting major themes...',
  'Generating AI insights...',
  'Preparing visualization...',
  'Finalizing report...'
]

export default function AiFormAnalysisTab({ token, onToast }) {
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('ALL')
  const [selectedAnalysis, setSelectedAnalysis] = useState('Service-Trainers')
  const [selectedLanguage, setSelectedLanguage] = useState('English')
  const [loading, setLoading] = useState(false)
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0)
  const [noDataMessage, setNoDataMessage] = useState(null)
  const [report, setReport] = useState(null)
  const [showAllQuestions, setShowAllQuestions] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const showToast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type)
  }, [onToast])

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await fetch(`${API}/api/admin/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok) setBatches(data.batches || [])
      } catch (err) {
        console.error('Error fetching batches:', err)
      }
    }
    fetchBatches()
  }, [token])

  // Cycle loading phase status messages
  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setLoadingPhaseIndex(prev => (prev + 1) % LOADING_PHASES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [loading])

  const handleBatchChange = (e) => {
    setSelectedBatchId(e.target.value)
    setReport(null)
    setNoDataMessage(null)
  }

  const handleAnalysisChange = (e) => {
    setSelectedAnalysis(e.target.value)
    setReport(null)
    setNoDataMessage(null)
  }

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value)
    setReport(null)
    setNoDataMessage(null)
  }

  const handleStartAnalysis = useCallback(async () => {
    if (loading) return
    setLoadingPhaseIndex(0)
    setLoading(true)
    setReport(null)
    setNoDataMessage(null)

    try {
      const res = await fetch(`${API}/api/admin/ai-form-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: selectedBatchId,
          formCategory: selectedAnalysis,
          language: selectedLanguage
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.count === 0 || !data.report) {
          setNoDataMessage('Not enough data to show this result. No submissions recorded yet.')
        } else {
          setReport(data.report)
          showToast(`Report generated from ${data.uniqueStudents} responses.`, 'success')
        }
      } else {
        showToast(data.message || 'Failed to generate report.', 'error')
      }
    } catch (err) {
      console.error('AI Analysis Error:', err)
      showToast('Error generating report. Please check backend connection.', 'error')
    } finally {
      setLoading(false)
    }
  }, [loading, token, selectedBatchId, selectedAnalysis, selectedLanguage, showToast])

  const handleDownloadPdf = async () => {
    if (generatingPdf) return

    const element = document.getElementById('ai-report-printable-area')
    if (!element) {
      window.print()
      return
    }

    setGeneratingPdf(true)
    setShowAllQuestions(true)

    // Give DOM time to ensure all 88 questions and full sections are rendered
    await new Promise(r => setTimeout(r, 600))

    const batchLabel = (
      report?.verifiedPrePostData?.summary?.batchName ||
      report?.verifiedServiceData?.batchName ||
      report?.verifiedData?.batchName ||
      'Report'
    ).replace(/\s+/g, '_')
    const filename = `LTC_Report_${batchLabel}_${new Date().toISOString().slice(0, 10)}.pdf`

    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: {
        mode: ['avoid-all', 'css', 'legacy'],
        avoid: ['.avoid-break', '.ai-card']
      }
    }

    try {
      await html2pdf().set(opt).from(element).save()
      showToast('Report PDF downloaded successfully.', 'success')
    } catch (err) {
      console.error('html2pdf generation error, falling back to browser print:', err)
      window.print()
    } finally {
      setGeneratingPdf(false)
    }
  }

  const currentAnalysisDesc = ANALYSIS_OPTIONS.find(o => o.id === selectedAnalysis)?.desc
  const isPreLtc = selectedAnalysis === 'Pre-LTC'
  const isServiceTrainers = selectedAnalysis === 'Service-Trainers'
  const isPrePost = selectedAnalysis === 'Pre-Post-Comparison'

  return (
    <div className="ai-page-container">
      <style>{`
        .ai-page-container {
          padding: 10px 14px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
          color: #0f172a;
          box-sizing: border-box;
        }

        .ai-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 18px;
          box-sizing: border-box;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
          margin-bottom: 12px;
        }

        .ai-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 10px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ai-controls-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          align-items: flex-end;
          width: 100%;
        }

        .ai-form-group {
          display: flex;
          flex-direction: column;
          min-width: 0;
          width: 100%;
        }

        .ai-form-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 4px;
          height: 15px;
          line-height: 15px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ai-form-select {
          width: 100%;
          height: 38px;
          padding: 0 10px;
          border-radius: 7px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          font-weight: 500;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .ai-form-select:focus {
          border-color: #154388;
          box-shadow: 0 0 0 2px rgba(21, 67, 136, 0.15);
        }

        .ai-submit-button {
          width: 100%;
          height: 38px;
          padding: 0 14px;
          background: #154388;
          border: 1px solid #154388;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          cursor: pointer;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }

        .ai-submit-button:hover:not(:disabled) {
          background: #0d2e61;
          border-color: #0d2e61;
        }

        .ai-submit-button:disabled {
          background: #94a3b8;
          border-color: #94a3b8;
          cursor: not-allowed;
        }

        .ai-download-button {
          padding: 6px 14px;
          background: #ffffff;
          border: 1.5px solid #154388;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 700;
          color: #154388;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease, color 0.15s ease;
        }

        .ai-download-button:hover:not(:disabled) {
          background: #eff6ff;
          border-color: #0d2e61;
          color: #0d2e61;
        }

        .ai-download-button:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .ai-two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* Loading animation */
        .ai-loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 240px;
          padding: 24px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .ai-loading-animation {
          width: 130px;
          height: 130px;
        }

        .ai-loading-text {
          margin-top: 10px;
          font-size: 14.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .ai-loading-sub {
          margin-top: 4px;
          font-size: 12px;
          color: #154388;
          font-weight: 600;
          min-height: 18px;
        }

        /* Responsive Layouts */
        @media (max-width: 900px) {
          .ai-controls-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .ai-two-col-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (max-width: 640px) {
          .ai-page-container { padding: 6px 4px; }
          .ai-card { padding: 12px 14px !important; margin-bottom: 8px !important; border-radius: 10px; }
          .ai-controls-grid { grid-template-columns: 1fr; gap: 8px; }
          .ai-form-label { margin-bottom: 3px; }
          .ai-form-select, .ai-submit-button { height: 36px; font-size: 12.5px; }
          .ai-two-col-grid { grid-template-columns: 1fr; gap: 8px; }
          .no-mobile-hide { display: none !important; }
        }

        /* Comprehensive Multi-Page PDF & Print Stylesheet */
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #root, .app-container, .admin-layout, .dashboard-container, main {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          body * {
            visibility: hidden;
          }
          .ai-printable-doc, .ai-printable-doc * {
            visibility: visible;
          }
          .ai-printable-doc {
            position: static !important;
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-sizing: border-box;
          }
          .no-print {
            display: none !important;
          }
          .avoid-break, .ai-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 12px !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            padding: 12px 14px !important;
          }
          .ai-two-col-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          h1 {
            font-size: 18px !important;
          }
          h2 {
            font-size: 13.5px !important;
          }
        }
      `}</style>

      {/* ── CONTROL PANEL ─────────────────────────────────────── */}
      <div className="ai-card no-print" style={{ marginBottom: '12px' }}>
            <div className="ai-header-row">
              <div>
                <h2 style={{ fontSize: '15.5px', fontWeight: '800', margin: 0, color: '#0f172a' }}>AI Form Analysis</h2>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Generates a real-data evaluation report from actual student form submissions in the database.
                </p>
              </div>
              {report && (
                <button
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="ai-download-button"
                >
                  {generatingPdf ? 'Generating PDF...' : 'Download Full PDF'}
                </button>
              )}
            </div>

            <div className="ai-controls-grid">
              <div className="ai-form-group">
                <label className="ai-form-label" htmlFor="ai-batch-select">Batch</label>
                <select
                  id="ai-batch-select"
                  value={selectedBatchId}
                  onChange={handleBatchChange}
                  disabled={loading}
                  className="ai-form-select"
                >
                  <option value="ALL">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.status})</option>
                  ))}
                </select>
              </div>

              <div className="ai-form-group">
                <label className="ai-form-label" htmlFor="ai-analysis-select">Analysis Type</label>
                <select
                  id="ai-analysis-select"
                  value={selectedAnalysis}
                  onChange={handleAnalysisChange}
                  disabled={loading}
                  className="ai-form-select"
                >
                  {ANALYSIS_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="ai-form-group">
                <label className="ai-form-label" style={{ opacity: 0 }} aria-hidden="true">Action</label>
                <button
                  onClick={handleStartAnalysis}
                  disabled={loading}
                  className="ai-submit-button"
                  id="ai-start-analysis-btn"
                >
                  {loading ? 'Analysing...' : 'Start AI Analysis'}
                </button>
              </div>
            </div>

            {currentAnalysisDesc && (
              <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>
                Selected: <strong style={{ color: '#334155' }}>{ANALYSIS_OPTIONS.find(o => o.id === selectedAnalysis)?.label}</strong> &mdash; {currentAnalysisDesc}
              </div>
            )}
          </div>

          {/* ── LOADING ANIMATION ─────────────────────────────────── */}
          {loading && (
            <div className="ai-loading-screen no-print">
              <LoadingLottieAnimation size={130} />
              <div className="ai-loading-text">
                {isServiceTrainers ? 'Analyzing Service Trainee Feedback' : 'Generating AI Form Analysis'}
              </div>
              <div className="ai-loading-sub">
                {LOADING_PHASES[loadingPhaseIndex]}
              </div>
            </div>
          )}

          {/* ── NO DATA STATE ─────────────────────────────────────── */}
          {noDataMessage && !loading && (
            <div className="ai-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <h3 style={{ fontSize: '14.5px', color: '#0f172a', margin: '0 0 4px 0', fontWeight: '700' }}>Not Enough Data</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{noDataMessage}</p>
            </div>
          )}

          {/* ── REPORT OUTPUT ─────────────────────────────────────── */}
          {report && !loading && (
            isServiceTrainers && report.verifiedServiceData
              ? <ServiceTraineeReport report={report} showAllQuestions={showAllQuestions} setShowAllQuestions={setShowAllQuestions} />
              : isPreLtc && report.verifiedData
                ? <PreLtcReport report={report} />
                : isPrePost && report.verifiedPrePostData
                  ? <PrePostComparisonReport report={report} generatingPdf={generatingPdf} />
                  : <GenericReport report={report} />
          )}
    </div>
  )
}
