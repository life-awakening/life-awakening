import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Award, Calendar, Check, AlertCircle, Lock, RefreshCw, Trophy, Save, ShieldCheck } from 'lucide-react';

const SQUAD_CANONICAL_NAMES = [
  'Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra',
  'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'
];

// Helper to parse Fall-In positions mapping from JSON, key-value, string, or array
const parseFallInPositions = (raw) => {
  const result = {};
  if (!raw) return result;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([sq, pos]) => {
      const p = parseInt(pos, 10);
      if (sq && !isNaN(p) && p >= 1 && p <= 10) {
        result[sq] = p;
      }
    });
    return result;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return result;
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([sq, pos]) => {
            const p = parseInt(pos, 10);
            if (sq && !isNaN(p) && p >= 1 && p <= 10) {
              result[sq] = p;
            }
          });
          return result;
        }
      } catch (e) {}
    }
    if (trimmed.includes(':')) {
      trimmed.split(',').forEach(part => {
        const [sqRaw, posRaw] = part.split(':');
        if (sqRaw && posRaw) {
          const p = parseInt(posRaw.trim(), 10);
          if (!isNaN(p) && p >= 1 && p <= 10) {
            result[sqRaw.trim()] = p;
          }
        }
      });
      return result;
    }
    const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    items.forEach((sq, idx) => {
      if (idx < 10) {
        result[sq] = idx + 1;
      }
    });
    return result;
  }
  return result;
};

export default function PerformanceAdminMarkingTab({ API, token, user, assignedRoles = [], showToast }) {
  const [loading, setLoading] = useState(true);
  const [activeBatch, setActiveBatch] = useState(null);
  const [userRoles, setUserRoles] = useState(assignedRoles || []);
  const [allowedActivities, setAllowedActivities] = useState([]);
  const [dayActivities, setDayActivities] = useState({});
  const [selections, setSelections] = useState([]);
  const [demographics, setDemographics] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Day 2');

  // Form state: draft selections per activityTitle
  // { [activityTitle]: { first: '', second: '', third: '' } }
  const [draftRankings, setDraftRankings] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  // Load activities permitted for this Performance Admin
  const loadActivities = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/faculty/performance-admin/activities`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveBatch(data.batch);
        setUserRoles(data.userRoles || []);
        setAllowedActivities(data.allowedActivities || []);
        setDayActivities(data.dayActivities || {});
        setSelections(data.selections || []);
        if (data.demographics) setDemographics(data.demographics);

        // Populate initial draft rankings from saved selections
        const initialDraft = {};
        (data.selections || []).forEach(s => {
          initialDraft[s.activity_title] = {
            first: s.first_squad || '',
            second: s.second_squad || '',
            third: s.third_squad || ''
          };
        });
        setDraftRankings(initialDraft);
      } else {
        if (showToast) showToast(data.message || 'Failed to load assigned activities', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error loading assigned activities', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API, token, showToast]);

  useEffect(() => {
    loadActivities(false);
  }, [loadActivities]);

  // Current day's activities permitted for this user
  const currentDayActivities = useMemo(() => {
    return dayActivities[selectedDay] || [];
  }, [dayActivities, selectedDay]);

  // Find saved selection for an activity
  const getSavedSelection = useCallback((activityTitle) => {
    return selections.find(s => s.activity_title === activityTitle);
  }, [selections]);

  // Handle squad selection in draft
  const handleSelectSquad = (activityTitle, position, squadValue) => {
    setDraftRankings(prev => {
      const current = prev[activityTitle] || { first: '', second: '', third: '' };
      return {
        ...prev,
        [activityTitle]: {
          ...current,
          [position]: squadValue
        }
      };
    });
  };

  // Fall-In Boys / Girls Squad Rank Change (1..10 or unassigned)
  const handleFallInRankChange = async (activity, gender, squadName, newRankStr) => {
    const savedSel = getSavedSelection(activity.title);
    if (savedSel?.is_locked) {
      if (showToast) showToast('Activity is locked by Super Admin.', 'error');
      return;
    }

    const boysPositions = parseFallInPositions(savedSel?.first_squad !== undefined ? savedSel.first_squad : savedSel?.squad_name);
    const girlsPositions = parseFallInPositions(savedSel?.second_squad);

    const targetPositions = gender === 'boys' ? { ...boysPositions } : { ...girlsPositions };
    const newRank = newRankStr ? parseInt(newRankStr, 10) : null;

    if (newRank && newRank >= 1 && newRank <= 10) {
      targetPositions[squadName] = newRank;
    } else {
      delete targetPositions[squadName];
    }

    const boysUpdated = gender === 'boys' ? targetPositions : boysPositions;
    const girlsUpdated = gender === 'girls' ? targetPositions : girlsPositions;

    const boysPayload = Object.keys(boysUpdated).length > 0 ? JSON.stringify(boysUpdated) : null;
    const girlsPayload = Object.keys(girlsUpdated).length > 0 ? JSON.stringify(girlsUpdated) : null;

    setSavingKey(activity.title);
    try {
      const res = await fetch(`${API}/api/faculty/performance-admin/save-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: activeBatch?.id,
          day: selectedDay,
          activityTitle: activity.title,
          firstSquad: boysPayload,
          secondSquad: girlsPayload,
          thirdSquad: null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save Fall-In ranking');
      }
      if (data.success && data.allSelections) {
        setSelections(data.allSelections);
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast(err.message || 'Failed to save selection', 'error');
      loadActivities(true);
    } finally {
      setSavingKey(null);
    }
  };

  // Save activity selection
  const handleSaveActivity = async (activity) => {
    if (!activeBatch || !activeBatch.id) {
      if (showToast) showToast('No active batch found.', 'error');
      return;
    }

    const isPillar = activity.selectionRule && activity.selectionRule.requiredCount === 1;
    const isFallIn = String(activity.title).trim().toLowerCase() === 'punctuality - fall in';
    const savedSel = getSavedSelection(activity.title);

    if (isFallIn) {
      return;
    }

    const draft = draftRankings[activity.title] || {
      first: savedSel?.first_squad || '',
      second: savedSel?.second_squad || '',
      third: savedSel?.third_squad || ''
    };

    // Standard activity validation
    if (!isPillar) {
      const selected = [draft.first, draft.second, draft.third].filter(Boolean);
      const unique = new Set(selected);
      if (unique.size !== selected.length) {
        if (showToast) showToast('The same squad cannot occupy two positions in the same activity.', 'error');
        return;
      }
    }

    setSavingKey(activity.title);
    try {
      const res = await fetch(`${API}/api/faculty/performance-admin/save-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: activeBatch.id,
          day: selectedDay,
          activityTitle: activity.title,
          firstSquad: draft.first || null,
          secondSquad: isPillar ? null : (draft.second || null),
          thirdSquad: isPillar ? null : (draft.third || null)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || `${activity.displayName || activity.title} saved successfully!`, 'success');
        await loadActivities(true);
      } else {
        if (showToast) showToast(data.message || 'Failed to save activity ranking', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error saving activity', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const availableDays = ['Day 2', 'Day 3', 'Day 4', 'Day 5'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1050px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '20px 24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px',
              background: '#eff6ff', color: '#154388',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Award size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                Performance Admin Marking Panel
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Assigned Activities:</span>
                {userRoles.map(r => (
                  <span
                    key={r}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      background: '#dbeafe',
                      color: '#154388'
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => loadActivities(false)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {activeBatch ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: '#f8fafc', borderRadius: '8px',
            border: '1px solid #f1f5f9', fontSize: '13px', flexWrap: 'wrap', gap: '8px'
          }}>
            <div>
              <span style={{ color: '#64748b' }}>Active Batch: </span>
              <strong style={{ color: '#0f172a' }}>{activeBatch.name}</strong>
            </div>
            <span style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '750',
              textTransform: 'uppercase',
              background: '#dcfce7',
              color: '#15803d'
            }}>
              {activeBatch.status || 'Active'}
            </span>
          </div>
        ) : (
          <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', color: '#92400e', fontSize: '13px' }}>
            No active immersion batch found in system.
          </div>
        )}
      </div>

      {/* Day Selector Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#ffffff',
        padding: '8px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        overflowX: 'auto'
      }}>
        {availableDays.map(day => {
          const actsForDay = dayActivities[day] || [];
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isSelected ? '#154388' : '#f8fafc',
                color: isSelected ? '#ffffff' : '#475569',
                fontWeight: isSelected ? '750' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Calendar size={14} />
              {day}
              <span style={{
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '800',
                background: isSelected ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                color: isSelected ? '#ffffff' : '#64748b'
              }}>
                {actsForDay.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Activities List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Loading assigned activity markings...</span>
          </div>
        ) : currentDayActivities.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <AlertCircle size={32} style={{ color: '#94a3b8', margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px', fontWeight: '700', color: '#334155', margin: 0 }}>
              No assigned activities for {selectedDay}
            </p>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Your assigned roles ({userRoles.join(', ')}) do not have activities scheduled on this day.
            </p>
          </div>
        ) : (
          currentDayActivities.map(activity => {
            const savedSel = getSavedSelection(activity.title);
            const draft = draftRankings[activity.title] || {
              first: savedSel?.first_squad || '',
              second: savedSel?.second_squad || '',
              third: savedSel?.third_squad || ''
            };
            const isSaving = savingKey === activity.title;
            const isLocked = Boolean(savedSel?.is_locked);
            const isPillar = activity.selectionRule && activity.selectionRule.requiredCount === 1;

            return (
              <div
                key={activity.id || activity.title}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: isLocked ? '1px solid #fef3c7' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  overflow: 'hidden'
                }}
              >
                {/* Activity Card Header */}
                <div style={{
                  padding: '14px 20px',
                  background: isLocked ? '#fffbeb' : '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      {activity.displayName || activity.title}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#eff6ff',
                      color: '#1e40af'
                    }}>
                      {activity.category || 'Punctuality'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isLocked ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11.5px',
                        fontWeight: '750',
                        color: '#b45309',
                        background: '#fef3c7',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        <Lock size={12} />
                        Locked by Super Admin
                      </span>
                    ) : savedSel ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        <Check size={12} />
                        Saved
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '11.5px',
                        fontWeight: '600',
                        color: '#94a3b8',
                        background: '#f1f5f9',
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        Pending Marking
                      </span>
                    )}
                  </div>
                </div>

                {/* Squad Selection Controls */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {isFallIn ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '16px',
                      alignItems: 'start'
                    }}>
                      {/* LEFT: 👦 Boys Fall-In (10 Squads) */}
                      <div style={{
                        background: '#eff6ff',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1.5px solid #bfdbfe'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '8px',
                          marginBottom: '10px',
                          borderBottom: '1px solid #e2e8f0',
                          flexWrap: 'wrap',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e3a8a', textTransform: 'uppercase' }}>
                            👦 BOYS FALL-IN
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {SQUAD_CANONICAL_NAMES.map(sq => {
                            const boysPositions = parseFallInPositions(savedSel?.first_squad !== undefined ? savedSel.first_squad : savedSel?.squad_name);
                            const rank = boysPositions[sq] || '';
                            const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));
                            const sqBoys = demographics?.squads?.[sq]?.boys ?? 0;
                            const sqGirls = demographics?.squads?.[sq]?.girls ?? 0;
                            const sqTotal = sqBoys + sqGirls;
                            const boysSharePct = sqTotal > 0 ? ((sqBoys / sqTotal) * 100).toFixed(2) : '50.00';
                            const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5;
                            const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0;
                            const sqPts = rank ? Number((boysShare * multiplier).toFixed(2)) : null;

                            return (
                              <div
                                key={`boys_${sq}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  background: rank ? '#eff6ff' : '#ffffff',
                                  border: rank ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                                }}
                              >
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
                                <select
                                  value={rank}
                                  disabled={isLocked || isSaving}
                                  onChange={(e) => handleFallInRankChange(activity, 'boys', sq, e.target.value)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    border: rank ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: rank ? '#1e40af' : '#475569',
                                    fontSize: '12px',
                                    fontWeight: rank ? '700' : '500',
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                    minWidth: '55px',
                                    height: '28px'
                                  }}
                                >
                                  <option value="">—</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* RIGHT: 👧 Girls Fall-In (10 Squads) */}
                      <div style={{
                        background: '#fdf4ff',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1.5px solid #f0abfc'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '8px',
                          marginBottom: '10px',
                          borderBottom: '1px solid #f5d0fe',
                          flexWrap: 'wrap',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#86198f', textTransform: 'uppercase' }}>
                            👧 GIRLS FALL-IN
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {SQUAD_CANONICAL_NAMES.map(sq => {
                            const girlsPositions = parseFallInPositions(savedSel?.second_squad);
                            const rank = girlsPositions[sq] || '';
                            const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));
                            const sqBoys = demographics?.squads?.[sq]?.boys ?? 0;
                            const sqGirls = demographics?.squads?.[sq]?.girls ?? 0;
                            const sqTotal = sqBoys + sqGirls;
                            const girlsSharePct = sqTotal > 0 ? ((sqGirls / sqTotal) * 100).toFixed(2) : '50.00';
                            const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5;
                            const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0;
                            const sqPts = rank ? Number((girlsShare * multiplier).toFixed(2)) : null;

                            return (
                              <div
                                key={`girls_${sq}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  background: rank ? '#fae8ff' : '#ffffff',
                                  border: rank ? '1px solid #f0abfc' : '1px solid #e2e8f0'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <span style={{
                                    fontSize: '12.5px',
                                    fontWeight: rank ? '700' : '600',
                                    color: rank ? '#86198f' : '#1e293b',
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
                                <select
                                  value={rank}
                                  disabled={isLocked || isSaving}
                                  onChange={(e) => handleFallInRankChange(activity, 'girls', sq, e.target.value)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    border: rank ? '1.5px solid #a855f7' : '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: rank ? '#86198f' : '#475569',
                                    fontSize: '12px',
                                    fontWeight: rank ? '700' : '500',
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                    minWidth: '55px',
                                    height: '28px'
                                  }}
                                >
                                  <option value="">—</option>
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                              </div>
                            );
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
                          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: '10px'
                        }}>
                          {SQUAD_CANONICAL_NAMES.map(sq => {
                            const boysPositions = parseFallInPositions(savedSel?.first_squad !== undefined ? savedSel.first_squad : savedSel?.squad_name);
                            const girlsPositions = parseFallInPositions(savedSel?.second_squad);
                            const bRank = boysPositions[sq];
                            const gRank = girlsPositions[sq];
                            const sqBoys = demographics?.squads?.[sq]?.boys ?? 0;
                            const sqGirls = demographics?.squads?.[sq]?.girls ?? 0;
                            const sqTotal = sqBoys + sqGirls;

                            const boysSharePct = sqTotal > 0 ? ((sqBoys / sqTotal) * 100).toFixed(2) : '50.00';
                            const girlsSharePct = sqTotal > 0 ? ((sqGirls / sqTotal) * 100).toFixed(2) : '50.00';

                            const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5;
                            const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5;

                            const bMult = bRank >= 1 && bRank <= 10 ? (11 - bRank) : 0;
                            const gMult = gRank >= 1 && gRank <= 10 ? (11 - gRank) : 0;

                            const bScore = bRank ? (boysShare * bMult) : 0;
                            const gScore = gRank ? (girlsShare * gMult) : 0;
                            const totalScore = Number((bScore + gScore).toFixed(2));
                            const hasAny = Boolean(bRank || gRank);

                            return (
                              <div
                                key={`fallin_summary_marking_${sq}`}
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
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : isPillar ? (
                    /* Single Squad Winner for Day 5 Agriculture Pillar */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '360px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '750', color: '#b45309' }}>
                        🥇 1st Place Winner (2 Points):
                      </label>
                      <select
                        value={draft.first || ''}
                        disabled={isLocked || isSaving}
                        onChange={(e) => handleSelectSquad(activity.title, 'first', e.target.value)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          color: draft.first ? '#0f172a' : '#94a3b8',
                          background: isLocked ? '#f8fafc' : '#ffffff',
                          outline: 'none',
                          cursor: isLocked ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="">-- Select Winning Squad --</option>
                        {SQUAD_CANONICAL_NAMES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    /* Standard 1st, 2nd, 3rd Position Dropdowns */
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      
                      {/* 1st (Gold) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🥇 1st Place (Gold)
                        </label>
                        <select
                          value={draft.first || ''}
                          disabled={isLocked || isSaving}
                          onChange={(e) => handleSelectSquad(activity.title, 'first', e.target.value)}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #fde68a',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: draft.first ? '#92400e' : '#94a3b8',
                            background: isLocked ? '#f8fafc' : (draft.first ? '#fffbeb' : '#ffffff'),
                            outline: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="">-- Select 1st Squad --</option>
                          {SQUAD_CANONICAL_NAMES.map(s => (
                            <option key={s} value={s} disabled={draft.second === s || draft.third === s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2nd (Silver) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🥈 2nd Place (Silver)
                        </label>
                        <select
                          value={draft.second || ''}
                          disabled={isLocked || isSaving}
                          onChange={(e) => handleSelectSquad(activity.title, 'second', e.target.value)}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #e2e8f0',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: draft.second ? '#334155' : '#94a3b8',
                            background: isLocked ? '#f8fafc' : (draft.second ? '#f8fafc' : '#ffffff'),
                            outline: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="">-- Select 2nd Squad --</option>
                          {SQUAD_CANONICAL_NAMES.map(s => (
                            <option key={s} value={s} disabled={draft.first === s || draft.third === s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* 3rd (Bronze) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '800', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🥉 3rd Place (Bronze)
                        </label>
                        <select
                          value={draft.third || ''}
                          disabled={isLocked || isSaving}
                          onChange={(e) => handleSelectSquad(activity.title, 'third', e.target.value)}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #fed7aa',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: draft.third ? '#c2410c' : '#94a3b8',
                            background: isLocked ? '#f8fafc' : (draft.third ? '#fff7ed' : '#ffffff'),
                            outline: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="">-- Select 3rd Squad --</option>
                          {SQUAD_CANONICAL_NAMES.map(s => (
                            <option key={s} value={s} disabled={draft.first === s || draft.second === s}>{s}</option>
                          ))}
                        </select>
                      </div>

                    </div>
                  )}

                  {/* Card Bottom: Save Action & Audit details */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {savedSel?.selected_by_name && (
                        <span>Last marked by <strong style={{ color: '#0f172a' }}>{savedSel.selected_by_name}</strong></span>
                      )}
                    </div>

                    {!isLocked && (
                      <button
                        onClick={() => handleSaveActivity(activity)}
                        disabled={isSaving}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#154388',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: '750',
                          cursor: isSaving ? 'wait' : 'pointer',
                          boxShadow: '0 2px 4px rgba(21, 67, 136, 0.2)'
                        }}
                      >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Marking'}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
