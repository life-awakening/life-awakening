import React, { useState, useEffect } from 'react'
import { 
  Search, Users, BookOpen, Shield, Mail, Phone, AlertCircle
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { formatStudentEmail } from '../utils/studentEmailHelper'

export default function GlobalSearchModule({ token, toast }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [results, setResults] = useState({
    students: [],
    faculty: [],
    ltcMembers: [],
    batches: [],
    squadDetails: null
  })

  // Debounced Search Effect
  useEffect(() => {
    if (!query.trim()) {
      setResults({ students: [], faculty: [], ltcMembers: [], batches: [], squadDetails: null })
      setLoading(false)
      return
    }

    setLoading(true)
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/admin/global-search?query=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        )
        const data = await response.json()
        if (data.success) {
          setResults({
            students: data.students || [],
            faculty: data.faculty || [],
            ltcMembers: data.ltcMembers || [],
            batches: data.batches || [],
            squadDetails: data.squadDetails || null
          })
        } else {
          toast?.('Failed to fetch search results', 'error')
        }
      } catch (err) {
        console.error(err)
        toast?.('Connection error during search', 'error')
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [query, token])

  const totalResultsCount = 
    results.students.length + 
    results.faculty.length + 
    results.ltcMembers.length + 
    results.batches.length

  // Filter selection helper
  const filteredData = () => {
    switch (activeFilter) {
      case 'students': return { students: results.students, faculty: [], ltcMembers: [], batches: [], squadDetails: results.squadDetails }
      case 'faculty': return { students: [], faculty: results.faculty, ltcMembers: [], batches: [], squadDetails: results.squadDetails }
      case 'ltc': return { students: [], faculty: [], ltcMembers: results.ltcMembers, batches: [], squadDetails: results.squadDetails }
      case 'batches': return { students: [], faculty: [], ltcMembers: [], batches: results.batches, squadDetails: results.squadDetails }
      default: return results
    }
  }

  const currentResults = filteredData()

  // Custom styling tokens
  const primaryBlue = '#154388'

  return (
    <div className="space-y-6 animate-fade-in" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── SEARCH INPUT CONTAINER ── */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '32px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Subtle decorative color circles */}
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(21, 67, 136, 0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(21, 67, 136, 0.02)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '600px', width: '100%', textAlign: 'center', zIndex: 2 }}>
          <h2 style={{ fontSize: '22px', fontWeight: '850', color: '#0f172a', letterSpacing: '-0.5px', margin: '0 0 6px 0' }}>
            {t("Global Search Engine")}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            {t("Search the LTC database instantly. Query student credentials, assigned faculty, dome details, coordinates, or batches.")}
          </p>

          <div style={{ position: 'relative', maxWidth: '480px', margin: '0 auto' }}>
            <span style={{ position: 'absolute', top: '0', bottom: '0', left: '0', paddingLeft: '16px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: primaryBlue }}>
              <Search size={18} className={loading ? "animate-pulse" : ""} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Type name, email, PRN, ID, squad, batch...")}
              style={{
                width: '100%',
                padding: '12px 16px 12px 46px',
                fontSize: '14px',
                color: '#0f172a',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}
              className="focus:border-[#154388] focus:bg-white focus:ring-4 focus:ring-blue-50"
              autoFocus
            />
            {loading && (
              <span style={{ position: 'absolute', top: '0', bottom: '0', right: '0', paddingRight: '16px', display: 'flex', alignItems: 'center' }}>
                <span className="w-4 h-4 border-2 border-[#154388] border-t-transparent rounded-full animate-spin"></span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      {query.trim() !== '' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          {[
            { id: 'all', label: t("All Results"), count: totalResultsCount },
            { id: 'students', label: t("Students"), count: results.students.length },
            { id: 'faculty', label: t("Faculty"), count: results.faculty.length },
            { id: 'ltc', label: t("LTC Coordinators"), count: results.ltcMembers.length },
            { id: 'batches', label: t("Batches"), count: results.batches.length }
          ].map((tab) => {
            const isSel = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: isSel ? '1px solid #154388' : '1px solid #e2e8f0',
                  background: isSel ? '#154388' : '#ffffff',
                  color: isSel ? '#ffffff' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: isSel ? '0 2px 4px rgba(21, 67, 136, 0.15)' : 'none',
                  transition: 'all 0.15s ease-in-out',
                  outline: 'none'
                }}
                className={isSel ? '' : 'hover:bg-slate-50 hover:text-slate-800'}
              >
                {tab.label} <span style={{ opacity: 0.8, marginLeft: '2px', fontWeight: '500' }}>({tab.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── SEARCH RESULTS PANEL ── */}
      {query.trim() === '' ? (
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            gap: '12px'
          }}
        >
          <div style={{ background: '#f0f7ff', color: '#154388', width: '54px', height: '54px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
            <Search size={24} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{t("Begin Searching")}</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
            {t("Enter terms in the search bar above to pull real-time database details.")}
          </p>
        </div>
      ) : totalResultsCount === 0 && !results.squadDetails && !loading ? (
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 24px',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
            gap: '12px'
          }}
        >
          <div style={{ background: '#fff1f2', color: '#ef4444', width: '54px', height: '54px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
            <AlertCircle size={24} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>{t("No Results Found")}</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '280px', margin: 0, lineHeight: 1.5 }}>
            {t("No matches found. Try entering a different name, email, PRN, or squad name.")}
          </p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── DETAILED SQUAD OVERVIEW CARD (IF SQUAD NAME SEARCHED) ── */}
          {results.squadDetails && (
            <div 
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
              className="animate-slide-up"
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#154388' }}></span>
                    {t("Squad Overview")}: <span style={{ fontWeight: '900' }}>{results.squadDetails.squadName}</span>
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                    {t("Batch")}: <span style={{ fontWeight: '600', color: '#0f172a' }}>{results.squadDetails.batchName}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { label: t("Students"), value: results.squadDetails.students.length },
                    { label: t("Faculty"), value: results.squadDetails.faculty.length },
                    { label: t("LTC Co-ord"), value: results.squadDetails.ltcMembers.length }
                  ].map((stat, idx) => (
                    <div key={idx} style={{ padding: '8px 16px', textAlign: 'center', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Students Column */}
                <div className="space-y-3">
                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', margin: 0 }}>
                    <Users size={13} color="#64748b" />
                    {t("Students")} ({results.squadDetails.students.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar-thin">
                    {results.squadDetails.students.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>{t("No Students Allocated")}</div>
                    ) : (
                      results.squadDetails.students.map(st => (
                        <div key={st.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#f8fafc' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }} className="truncate">{st.name}</div>
                          {st.prn && <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>PRN: {st.prn}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                            <span className="truncate" style={{ maxWidth: '120px' }}>{t(st.department) || '—'}</span>
                            <span style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', fontSize: '9px' }}>Div {t(st.division) || '—'} / Pnl {t(st.panel) || '—'}{st.room ? ` · Rm ${st.room}` : ''}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Faculty Column */}
                <div className="space-y-3">
                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', margin: 0 }}>
                    <BookOpen size={13} color="#64748b" />
                    {t("Assigned Faculty")} ({results.squadDetails.faculty.length})
                  </h4>
                  <div className="space-y-2">
                    {results.squadDetails.faculty.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>{t("No Faculty Assigned")}</div>
                    ) : (
                      results.squadDetails.faculty.map(fc => (
                        <div key={fc.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#f8fafc' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fc.name}</div>
                          {fc.faculty_id && <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>ID: {fc.faculty_id}</div>}
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} color="#94a3b8" />
                            <span className="truncate">{fc.email}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* LTC Coordinators Column */}
                <div className="space-y-3">
                  <h4 style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', margin: 0 }}>
                    <Shield size={13} color="#64748b" />
                    {t("LTC Coordinators")} ({results.squadDetails.ltcMembers.length})
                  </h4>
                  <div className="space-y-2">
                    {results.squadDetails.ltcMembers.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>{t("No LTC Coordinators Assigned")}</div>
                    ) : (
                      results.squadDetails.ltcMembers.map(ltc => (
                        <div key={ltc.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#f8fafc' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ltc.name}</div>
                          {ltc.faculty_id && <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>Emp ID: {ltc.faculty_id}</div>}
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontWeight: '500', textTransform: 'capitalize' }}>{t(ltc.designation) || 'Coordinator'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
          
          {/* STUDENTS RESULTS GROUP */}
          {currentResults.students.length > 0 && (
            <div className="space-y-4 animate-slide-up">
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: `3px solid ${primaryBlue}`, paddingLeft: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                  {t("Students")} ({currentResults.students.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentResults.students.map((st) => (
                  <div 
                    key={st.id} 
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    className="hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '9px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: primaryBlue, border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '4px', padding: '2px 8px' }}>
                          Student
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          {st.prn && <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', color: '#475569' }}>{st.prn}</span>}
                          {st.ltc_id && <span style={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#94a3b8' }}>ID: {st.ltc_id}</span>}
                        </div>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }} className="truncate">
                          {st.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          <Mail size={12} color="#94a3b8" />
                          <span className="truncate">{formatStudentEmail(st.email, 'Not provided')}</span>
                        </div>
                        {st.parent1_email && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', marginBottom: '4px' }}>
                            <span style={{ fontSize: '9px', fontWeight: '750', color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>Parent</span>
                            <span className="truncate">{st.parent1_email}</span>
                          </div>
                        )}
                        {st.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                            <Phone size={12} color="#94a3b8" />
                            <span>{st.phone}</span>
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

                      <div className="grid grid-cols-2 gap-2" style={{ fontSize: '11.5px' }}>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Squad</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(st.squad) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Batch</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">
                            {st.batch_name ? `${t(st.batch_name)}` : '—'}
                          </div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Department</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(st.department) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Div / Panel</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(st.division) || '—'} / {t(st.panel) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', gridColumn: 'span 2' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Room Allocation</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }}>{st.room ? `Room ${st.room}` : '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FACULTY RESULTS GROUP */}
          {currentResults.faculty.length > 0 && (
            <div className="space-y-4 animate-slide-up">
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: `3px solid ${primaryBlue}`, paddingLeft: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                  {t("Faculty coordinators")} ({currentResults.faculty.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentResults.faculty.map((fc) => (
                  <div 
                    key={fc.id} 
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    className="hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '9px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#047857', border: '1px solid #a7f3d0', background: '#ecfdf5', borderRadius: '4px', padding: '2px 8px' }}>
                          Faculty
                        </span>
                        {fc.faculty_id && (
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', color: '#475569' }}>
                            {fc.faculty_id}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }} className="truncate">
                          {fc.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          <Mail size={12} color="#94a3b8" />
                          <span className="truncate">{fc.email}</span>
                        </div>
                        {fc.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                            <Phone size={12} color="#94a3b8" />
                            <span>{fc.phone}</span>
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

                      <div className="grid grid-cols-2 gap-2" style={{ fontSize: '11.5px' }}>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Squad</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(fc.squad) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Batch</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">
                            {fc.batch_name ? `${t(fc.batch_name)}` : '—'}
                          </div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Division</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(fc.division) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Department</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(fc.department) || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LTC MEMBERS RESULTS GROUP */}
          {currentResults.ltcMembers.length > 0 && (
            <div className="space-y-4 animate-slide-up">
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: `3px solid ${primaryBlue}`, paddingLeft: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                  {t("LTC Coordinators")} ({currentResults.ltcMembers.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentResults.ltcMembers.map((ltc) => (
                  <div 
                    key={ltc.id} 
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    className="hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '9px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#d97706', border: '1px solid #fde68a', background: '#fef3c7', borderRadius: '4px', padding: '2px 8px' }}>
                          LTC Member
                        </span>
                        {ltc.faculty_id && (
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '600', color: '#475569' }}>
                            {ltc.faculty_id}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }} className="truncate">
                          {ltc.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                          <Mail size={12} color="#94a3b8" />
                          <span className="truncate">{ltc.email}</span>
                        </div>
                        {ltc.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                            <Phone size={12} color="#94a3b8" />
                            <span>{ltc.phone}</span>
                          </div>
                        )}
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

                      <div className="grid grid-cols-2 gap-2" style={{ fontSize: '11.5px' }}>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Squad</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(ltc.squad) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Batch</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">
                            {ltc.batch_name ? `${t(ltc.batch_name)}` : '—'}
                          </div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Division</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(ltc.division) || '—'}</div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Designation</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">{t(ltc.designation) || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BATCHES RESULTS GROUP */}
          {currentResults.batches.length > 0 && (
            <div className="space-y-4 animate-slide-up">
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: `3px solid ${primaryBlue}`, paddingLeft: '8px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
                  {t("Batches")} ({currentResults.batches.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentResults.batches.map((bt) => (
                  <div 
                    key={bt.id} 
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 4px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    className="hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between' }}>
                        <span style={{ fontSize: '9px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4f46e5', border: '1px solid #e0e7ff', background: '#e0e7ff', borderRadius: '4px', padding: '2px 8px' }}>
                          Batch
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '0.5px', color: bt.status === 'active' ? '#047857' : '#64748b', border: bt.status === 'active' ? '1px solid #a7f3d0' : '1px solid #e2e8f0', background: bt.status === 'active' ? '#ecfdf5' : '#f8fafc', borderRadius: '4px', padding: '2px 8px' }}>
                          {t(bt.status)}
                        </span>
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: '750', color: '#0f172a', margin: 0 }} className="truncate">
                          {bt.name} {bt.batch_code && <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '400', color: '#64748b' }}>({bt.batch_code})</span>}
                        </h4>
                      </div>

                      <hr style={{ border: 0, borderTop: '1px solid #f1f5f9', margin: 0 }} />

                      <div className="grid grid-cols-2 gap-2" style={{ fontSize: '11.5px' }}>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>Start Date</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">
                            {bt.start_date ? new Date(bt.start_date).toLocaleDateString() : '—'}
                          </div>
                        </div>
                        <div style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                          <div style={{ fontSize: '8.5px', fontWeight: '750', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.3px' }}>End Date</div>
                          <div style={{ fontWeight: '600', color: '#475569', marginTop: '2px' }} className="truncate">
                            {bt.end_date ? new Date(bt.end_date).toLocaleDateString() : '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
