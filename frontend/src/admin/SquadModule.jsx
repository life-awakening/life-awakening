import React, { useMemo } from 'react'
import { RefreshCw, Lock, Unlock, Shield, Search, Users, GraduationCap, MoreHorizontal } from 'lucide-react'
import { formatStudentEmail } from '../utils/studentEmailHelper'

const SQUAD_COLORS = {
  Surya:     '#0C54A4',
  Aditya:    '#FCCC04',
  Ravi:      '#04A4E4',
  Divakar:   '#AC4C84',
  Mitra:     '#EC7C1C',
  Martand:   '#64A474',
  Dinkar:    '#047C44',
  Prabhakar: '#E40C84',
  Bhaskar:   '#A45C3C',
  Tejonidhi: '#E41C24',
}

export default function SquadModule({
  squadData,
  isShuffling,
  selectedSquad,
  setSelectedSquad,
  squadViewTab,
  setSquadViewTab,
  squadStudentSearch,
  setSquadStudentSearch,
  squadStudents,
  squadFaculties,
  squadStats,
  handleShuffleSquads,
  handleToggleSquadLock,
  fetchSquadState,
  SQUAD_NAMES
}) {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Squad Allocation (Legacy)</h2>
          <p className="page-subtitle">Allocate in_current_batch students into 10 squads. Use Batch Management for per-batch squads.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-outline btn-sm" onClick={fetchSquadState}>
            <RefreshCw size={14} />
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleToggleSquadLock} disabled={isShuffling}>
            {squadData.locked ? <><Unlock size={14} /> Unlock</> : <><Lock size={14} /> Lock</>}
          </button>
          <button className="btn btn-sm" onClick={handleShuffleSquads} disabled={isShuffling || squadData.locked}>
            {isShuffling ? (
              <><div className="spinner spinner-sm" /> Shuffling…</>
            ) : (
              <><RefreshCw size={14} /> Auto Allocate</>
            )}
          </button>
        </div>
      </div>

      {squadData.locked && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <Lock size={16} /> Squad allocation is locked.
        </div>
      )}

      <div className="squads-grid">
        {SQUAD_NAMES.map(sq => (
          <div key={sq} className={`squad-card ${selectedSquad === sq ? 'selected' : ''}`}
            style={{ '--squad-color': SQUAD_COLORS[sq] || 'var(--primary)' }}
            onClick={() => setSelectedSquad(sq)}>
            <div className="squad-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="squad-badge">{sq.substring(0, 2)}</div>
                <div className="squad-card-title">{sq}</div>
              </div>
              <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <MoreHorizontal size={16} />
              </button>
            </div>
            <div className="squad-stats-row">
              <div className="squad-stat-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                  <span className="squad-stat-value">{squadStats[sq]?.students || 0}</span>
                  <span className="squad-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Students</span>
                </div>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: `${SQUAD_COLORS[sq]}12` || 'rgba(37, 99, 235, 0.08)',
                  color: SQUAD_COLORS[sq] || '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Users size={14} />
                </div>
              </div>
              <div className="squad-stat-item">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                  <span className="squad-stat-value">{squadStats[sq]?.faculties || squadStats[sq]?.faculty || 0}</span>
                  <span className="squad-stat-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Faculty</span>
                </div>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: `${SQUAD_COLORS[sq]}12` || 'rgba(37, 99, 235, 0.08)',
                  color: SQUAD_COLORS[sq] || '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <GraduationCap size={14} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Squad detail */}
      <div className="squad-detail-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {['master', 'faculty'].map(t => (
            <button
              key={t}
              className={`tab-btn ${squadViewTab === t ? 'active' : ''}`}
              onClick={() => setSquadViewTab(t)}
            >
              {t === 'master' ? 'Students' : 'Faculty'}
            </button>
          ))}
        </div>
        <div className="search-wrapper" style={{ margin: 0, marginLeft: 'auto', maxWidth: 260 }}>
          <Search className="search-icon" size={14} />
          <input
            className="input-field"
            placeholder="Search…"
            value={squadStudentSearch}
            onChange={e => setSquadStudentSearch(e.target.value)}
            style={{ marginBottom: 0, paddingLeft: 40 }}
          />
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>{selectedSquad} Squad</h3>
        {squadViewTab === 'master' ? (
          <div className="table-wrapper">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>PRN / LTC ID</th>
                  <th>Email</th>
                  <th>Gender</th>
                  <th>Panel</th>
                </tr>
              </thead>
              <tbody>
                {squadStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '24px 0', fontStyle: 'italic' }}>
                      No students in {selectedSquad} squad
                    </td>
                  </tr>
                ) : (
                  squadStudents.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <code style={{ fontSize: 11 }}>{s.prn || '—'}</code>
                          {s.prn && (
                            <span className="badge badge-blue" style={{ fontSize: 9, padding: '2px 6px' }}>
                              LTC ID: {String(s.prn).slice(-4)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{formatStudentEmail(s.email, 'Not provided')}</td>
                      <td>{s.gender || '—'}</td>
                      <td>{s.panel ? <span className="badge badge-blue">{s.panel}</span> : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Panel</th>
                </tr>
              </thead>
              <tbody>
                {squadFaculties.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-4)', padding: '24px 0', fontStyle: 'italic' }}>
                      No faculty in {selectedSquad} squad
                    </td>
                  </tr>
                ) : (
                  squadFaculties.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{f.name}</td>
                      <td style={{ fontSize: 12 }}>{f.email}</td>
                      <td style={{ fontSize: 12 }}>{f.department}</td>
                      <td>{f.panel ? <span className="badge badge-blue">{f.panel}</span> : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
