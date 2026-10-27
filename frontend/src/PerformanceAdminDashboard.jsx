import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '@/config/apiConfig';
import {
  Trophy,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RotateCcw,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';

// Canonical 10 Squad Names in LTC
const DEFAULT_SQUADS = [
  'Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra',
  'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'
];

// 4 Immersion Days
const SQUAD_PERF_DAYS = ['Day 2', 'Day 3', 'Day 4', 'Day 5'];

// Special Activity Selection Rules
const getActivityRule = (dayOrTitle, maybeTitle) => {
  const title = maybeTitle !== undefined ? maybeTitle : dayOrTitle;
  const day = maybeTitle !== undefined ? dayOrTitle : null;
  if (!title) return null;
  const t = String(title).trim().toLowerCase();
  let rule = null;
  if (t === 'quiz') rule = { requiredDay: 'Day 3', requiredCount: 2, rank: 1, points: 5, label: 'Select 2 Squads (5 pts each, max 10)' };
  else if (t === 'debate') rule = { requiredDay: 'Day 4', requiredCount: 5, rank: 1, points: 2, label: 'Select 5 Squads (2 pts each, max 10)' };
  else if (t === 'khokho' || t === 'kho kho' || t === 'kho-kho') rule = { requiredDay: 'Day 4', requiredCount: 5, rank: 1, points: 2, label: 'Select 5 Squads (2 pts each, max 10)' };
  else if (t === 'obstacle' || t === 'obstacles') rule = { requiredDay: 'Day 5', requiredCount: 10, isRanked: true, rank: 10, label: 'Rank 1–10 Squads (10 to 1 pts)' };
  else if (t === 'agriculture') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' };
  else if (t === 'sports') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' };
  else if (t === 'team building' || t === 'team_building') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' };
  else if (t === 'patriotism') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' };
  else if (t === 'spirituality') rule = { requiredDay: 'Day 5', requiredCount: 1, points: 2, label: 'Select 1 Squad (Winner = 2 pts)' };

  if (rule && day && rule.requiredDay && String(rule.requiredDay).toLowerCase() !== String(day).toLowerCase()) {
    return null;
  }
  return rule;
};

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

export default function PerformanceAdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const API = API_BASE_URL;

  // Responsive state
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isMobile = windowWidth < 768;
  const isSmallMobile = windowWidth < 420;

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBatch, setActiveBatch] = useState(null);
  const [batchesList, setBatchesList] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [userRoles, setUserRoles] = useState(user.performance_roles || []);
  const [allowedActivities, setAllowedActivities] = useState([]);
  const [dayActivities, setDayActivities] = useState({});
  const [selections, setSelections] = useState([]);
  const [demographics, setDemographics] = useState(null);
  const [squadsList, setSquadsList] = useState(DEFAULT_SQUADS);
  const [selectedDay, setSelectedDay] = useState('Day 2');
  const [expandedActivities, setExpandedActivities] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const saveVersionRef = useRef({});

  // Toast feedback
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // Map selections by unique day-wise key: `${day}_${activityTitle}`
  const selectionsMap = useMemo(() => {
    const map = {};
    (selections || []).forEach(s => {
      const key = `${s.day}_${s.activity_title}`;
      map[key] = s;
    });
    return map;
  }, [selections]);

  // Fetch performance activities and active batch
  const loadData = useCallback(async (isSilent = false, targetBatchId = null) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const batchParam = targetBatchId || selectedBatchId;
      const url = `${API}/api/faculty/performance-admin/activities${batchParam ? `?batchId=${batchParam}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveBatch(data.batch || null);
        if (data.batch?.id && !selectedBatchId) {
          setSelectedBatchId(String(data.batch.id));
        }
        if (data.batches && data.batches.length > 0) {
          setBatchesList(data.batches);
        }
        setUserRoles(data.userRoles || []);
        setAllowedActivities(data.allowedActivities || []);
        setDayActivities(data.dayActivities || {});
        setSelections(data.selections || []);
        if (data.demographics) {
          setDemographics(data.demographics);
        }
        if (data.squads && data.squads.length > 0) {
          setSquadsList(data.squads);
        }
      } else {
        showToast(data.message || 'Failed to load assigned activities', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error loading activities', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API, token, selectedBatchId]);

  useEffect(() => {
    loadData(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle batch selection from dropdown
  const handleBatchChange = (newBatchId) => {
    setSelectedBatchId(newBatchId);
    loadData(false, newBatchId);
  };

  // Current day's activities permitted for this user
  const currentActivities = useMemo(() => {
    return dayActivities[selectedDay] || [];
  }, [dayActivities, selectedDay]);

  // Separate activities into Punctuality and Core/Other
  const punctualityActivities = useMemo(() => {
    return currentActivities.filter(a => a.category === 'Punctuality' || a.title.toLowerCase().includes('punctuality'));
  }, [currentActivities]);

  const otherActivities = useMemo(() => {
    return currentActivities.filter(a => a.category !== 'Punctuality' && !a.title.toLowerCase().includes('punctuality'));
  }, [currentActivities]);

  // Toggle activity expansion
  const toggleActivity = (activityKey) => {
    setExpandedActivities(prev => ({
      ...prev,
      [activityKey]: prev[activityKey] === false ? true : false
    }));
  };

  // Save activity selections (1st, 2nd, 3rd)
  const saveActivitySelection = async (day, activityTitle, firstSquad, secondSquad, thirdSquad) => {
    if (!activeBatch?.id) {
      showToast('No active batch found.', 'error');
      return;
    }

    const activityKey = `${day}_${activityTitle}`;
    const thisVersion = Date.now();
    saveVersionRef.current[activityKey] = thisVersion;
    setSavingKey(activityKey);

    // Optimistic local update
    setSelections(prev => {
      const copy = [...prev];
      const idx = copy.findIndex(s => s.day === day && s.activity_title === activityTitle);
      const entry = {
        batch_id: activeBatch.id,
        day,
        activity_title: activityTitle,
        first_squad: firstSquad,
        second_squad: secondSquad,
        third_squad: thirdSquad,
        squad_name: firstSquad || '',
        is_locked: false
      };
      if (idx >= 0) {
        copy[idx] = { ...copy[idx], ...entry };
      } else {
        copy.push(entry);
      }
      return copy;
    });

    try {
      const res = await fetch(`${API}/api/faculty/performance-admin/save-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: activeBatch.id,
          day,
          activityTitle,
          firstSquad,
          secondSquad,
          thirdSquad,
          isLocked: false
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to save selection');
      }

      if (data.success && saveVersionRef.current[activityKey] === thisVersion) {
        if (data.allSelections) setSelections(data.allSelections);
        if (data.demographics) setDemographics(data.demographics);
      }
    } catch (err) {
      console.error('Error saving activity selection:', err);
      showToast(err.message || 'Failed to save selection', 'error');
      loadData(true);
    } finally {
      setSavingKey(null);
    }
  };

  // Fall-In Boys / Girls Squad Rank Change (1..10 or unassigned)
  const handleFallInRankChange = (activity, gender, squadName, newRankStr) => {
    const activityKey = `${selectedDay}_${activity.title}`;
    const existing = selectionsMap[activityKey];

    if (existing?.is_locked) {
      showToast('Activity is locked by Super Admin.', 'error');
      return;
    }

    const boysPositions = parseFallInPositions(existing?.first_squad !== undefined ? existing.first_squad : existing?.squad_name);
    const girlsPositions = parseFallInPositions(existing?.second_squad);

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

    saveActivitySelection(
      selectedDay,
      activity.title,
      boysPayload,
      girlsPayload,
      null
    );
  };

  // Reset activity selections
  const handleResetActivity = async (day, activityTitle, e) => {
    if (e) e.stopPropagation();
    const activityKey = `${day}_${activityTitle}`;
    const existing = selectionsMap[activityKey];
    if (existing?.is_locked) {
      showToast('Activity is locked by Super Admin.', 'error');
      return;
    }

    setSavingKey(activityKey);
    try {
      const res = await fetch(`${API}/api/faculty/performance-admin/reset-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batchId: activeBatch?.id,
          day,
          activityTitle
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset activity');
      }

      if (data.success) {
        if (data.allSelections) setSelections(data.allSelections);
        showToast(`Reset ${activityTitle}`, 'success');
      }
    } catch (err) {
      console.error('Error resetting activity:', err);
      showToast(err.message || 'Failed to reset activity', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  // Click-Order Selection matching Super Admin Squad Performance
  const handleSquadClickOrder = (activity, squadName) => {
    const activityKey = `${selectedDay}_${activity.title}`;
    const existing = selectionsMap[activityKey];

    if (existing?.is_locked) {
      showToast('Activity is locked by Super Admin.', 'error');
      return;
    }

    const rule = activity.selectionRule || getActivityRule(selectedDay, activity.title);
    let s1 = (existing?.first_squad !== undefined ? (existing.first_squad || '').trim() : (existing?.squad_name || '').trim()) || null;
    let s2 = (existing?.second_squad || '').trim() || null;
    let s3 = (existing?.third_squad || '').trim() || null;

    if (rule) {
      let squadsArr = [];
      if (typeof s1 === 'string') {
        squadsArr = s1.split(',').map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(s1)) {
        squadsArr = s1.map(s => s.trim()).filter(Boolean);
      }

      if (rule.requiredCount === 1) {
        if (squadsArr.includes(squadName)) {
          squadsArr = [];
        } else {
          squadsArr = [squadName];
        }
      } else {
        if (squadsArr.includes(squadName)) {
          squadsArr = squadsArr.filter(s => s !== squadName);
        } else {
          if (squadsArr.length >= rule.requiredCount) {
            showToast(`${rule.requiredCount} squad(s) already selected. Deselect one before choosing another.`, 'error');
            return;
          }
          squadsArr.push(squadName);
        }
      }

      saveActivitySelection(
        selectedDay,
        activity.title,
        squadsArr.join(', '),
        rule.isRanked ? (squadsArr[1] || null) : null,
        rule.isRanked ? (squadsArr[2] || null) : null
      );
      return;
    }

    // Standard 1st -> 2nd -> 3rd selection
    if (s1 === squadName) {
      s1 = null;
    } else if (s2 === squadName) {
      s2 = null;
    } else if (s3 === squadName) {
      s3 = null;
    } else {
      if (s1 && s2 && s3) {
        showToast('3 squads already selected (1st, 2nd, 3rd). Deselect one before choosing another.', 'error');
        return;
      }

      if (!s1) {
        s1 = squadName;
      } else if (!s2) {
        s2 = squadName;
      } else if (!s3) {
        s3 = squadName;
      }
    }

    saveActivitySelection(selectedDay, activity.title, s1, s2, s3);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }}>
      
      {/* Global Embedded Styles for Polished Mobile Touch & Responsive Grid */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pa-fade-in {
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pa-squad-btn:active {
          transform: scale(0.97);
        }
        .pa-day-btn:active {
          transform: scale(0.98);
        }
        .pa-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .pa-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
      `}</style>

      {/* Toast Alert Banner */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: isMobile ? '12px' : '20px',
          left: isMobile ? '12px' : 'auto',
          zIndex: 9999999,
          background: toast.type === 'error' ? '#ef4444' : '#15803d',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)',
          fontSize: '13.5px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
        </div>
      )}      {/* Top Header Bar */}
      <header style={{
        background: '#ea580c',
        color: '#ffffff',
        padding: isMobile ? '10px 14px' : '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          fontSize: isMobile ? '15px' : '16px',
          fontWeight: '800',
          letterSpacing: '0.2px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Trophy size={isMobile ? 16 : 18} color="#fef08a" />
          <span>Squad Performance</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          {/* User profile capsule */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(0, 0, 0, 0.15)',
            padding: isMobile ? '4px 8px' : '5px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{
              width: isMobile ? '20px' : '24px',
              height: isMobile ? '20px' : '24px',
              borderRadius: '50%',
              background: '#ffffff',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: isMobile ? '10px' : '11px'
            }}>
              {user.name ? user.name.substring(0, 2).toUpperCase() : 'PA'}
            </div>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '700',
              color: '#ffffff',
              display: isMobile ? 'none' : 'inline'
            }}>
              {user.name || 'Performance Admin'}
            </span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: '#0d2d5e',
              border: '1px solid #1e4d8c',
              color: '#ffffff',
              padding: isMobile ? '6px 9px' : '7px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            title="Sign Out"
          >
            <LogOut size={13} />
            <span style={{ display: isSmallMobile ? 'none' : 'inline' }}>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        padding: isMobile ? '10px 8px 60px' : '18px 20px 60px',
        maxWidth: '960px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        
        {/* COMPACT BATCH & ROLE BAR */}
        <div style={{
          background: '#ffffff',
          borderRadius: '10px',
          padding: isMobile ? '8px 10px' : '10px 14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: isMobile ? '8px' : '12px'
        }}>
          {/* Batch Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: isMobile ? '190px' : '240px' }}>
              <select
                value={selectedBatchId || (activeBatch?.id ? String(activeBatch.id) : '')}
                onChange={(e) => handleBatchChange(e.target.value)}
                disabled={loading || refreshing}
                style={{
                  width: '100%',
                  appearance: 'none',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 24px 5px 8px',
                  fontSize: isMobile ? '11.5px' : '12.5px',
                  fontWeight: '750',
                  color: '#0f172a',
                  cursor: loading || refreshing ? 'wait' : 'pointer',
                  outline: 'none',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}
              >
                {batchesList.length === 0 && activeBatch && (
                  <option value={activeBatch.id}>{activeBatch.name}</option>
                )}
                {batchesList.map(b => {
                  const isActive = ['active', 'immersion'].includes(String(b.status || '').toLowerCase());
                  return (
                    <option key={b.id} value={b.id}>
                      {b.name} {isActive ? '• Active' : ''}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>
          </div>

          {/* Role Pill & Refresh Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {userRoles.map(r => (
              <span
                key={r}
                style={{
                  padding: isMobile ? '3px 7px' : '4px 9px',
                  borderRadius: '5px',
                  fontSize: isMobile ? '10.5px' : '11.5px',
                  fontWeight: '800',
                  background: '#ea580c',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.2px'
                }}
              >
                {r}
              </span>
            ))}

            <button
              onClick={() => loadData(true, selectedBatchId)}
              disabled={loading || refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '5px 8px' : '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '11px',
                fontWeight: '650',
                cursor: loading || refreshing ? 'wait' : 'pointer',
                gap: '4px'
              }}
              title="Refresh"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {!isMobile && <span>Refresh</span>}
            </button>
          </div>
        </div>

        {/* 4 DAYS SELECTOR TABS (Segmented Control) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '3px',
          gap: '3px',
          marginBottom: isMobile ? '8px' : '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          {SQUAD_PERF_DAYS.map(dayName => {
            const isCurrent = selectedDay === dayName;
            const acts = dayActivities[dayName] || [];
            const totalDayActs = acts.length;
            const completedCount = acts.filter(a => {
              const s = selectionsMap[`${dayName}_${a.title}`];
              if (!s) return false;
              const isFallIn = String(a.title).trim().toLowerCase() === 'punctuality - fall in';
              if (isFallIn) {
                const bCount = (s.first_squad || '').split(',').map(x => x.trim()).filter(Boolean).length;
                const gCount = (s.second_squad || '').split(',').map(x => x.trim()).filter(Boolean).length;
                return bCount === 10 && gCount === 10;
              }
              const rule = a.selectionRule || getActivityRule(dayName, a.title);
              if (rule) {
                const s1Val = (s.first_squad !== undefined ? (s.first_squad || '') : (s.squad_name || '')).trim();
                const count = s1Val.split(',').map(x => x.trim()).filter(Boolean).length;
                return count === rule.requiredCount;
              }
              const s1Val = (s.first_squad !== undefined ? (s.first_squad || '') : (s.squad_name || '')).trim();
              return Boolean(s1Val && (s.second_squad || '').trim() && (s.third_squad || '').trim());
            }).length;
            const lockedCount = acts.filter(a => {
              const s = selectionsMap[`${dayName}_${a.title}`];
              return s && s.is_locked;
            }).length;

            return (
              <button
                key={dayName}
                onClick={() => setSelectedDay(dayName)}
                className="pa-day-btn"
                style={{
                  padding: isMobile ? '7px 4px' : '8px 6px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isCurrent
                    ? '#ea580c'
                    : 'transparent',
                  color: isCurrent ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s ease'
                }}
              >
                <span style={{ fontSize: isMobile ? '12.5px' : '13px', fontWeight: '800' }}>{dayName}</span>
              </button>
            );
          })}
        </div>

        {/* DAY-WISE ASSIGNED ACTIVITIES ONLY */}
        {loading ? (
          <div style={{
            padding: '30px 16px',
            textAlign: 'center',
            color: '#64748b',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 6px auto', color: '#ea580c' }} />
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>Loading activities...</div>
          </div>
        ) : currentActivities.length === 0 ? (
          <div style={{
            padding: '30px 16px',
            textAlign: 'center',
            color: '#64748b',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <Calendar size={24} style={{ color: '#94a3b8', margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
              No activities for {selectedDay}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
              Your role ({userRoles.join(', ')}) has no scheduled activity on {selectedDay}.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px' }} className="pa-fade-in">
            {[
              {
                title: 'Punctuality',
                acts: punctualityActivities,
                isPunc: true
              },
              {
                title: 'Activities',
                acts: otherActivities,
                isPunc: false
              }
            ].map((section) => {
              const { title, acts, isPunc } = section;
              if (acts.length === 0) return null;

              return (
                <div key={title} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  
                  {/* Minimal Section Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {isPunc ? <Clock size={12} color="#ea580c" /> : <Award size={12} color="#d97706" />}
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {title}
                      </span>
                    </div>
                  </div>

                  {/* Activities Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {acts.map((activity, aIdx) => {
                      const activityKey = `${selectedDay}_${activity.title}`;
                      const selection = selectionsMap[activityKey];
                      const s1 = (selection?.first_squad !== undefined ? (selection.first_squad || '').trim() : (selection?.squad_name || '').trim()) || null;
                      const s2 = (selection?.second_squad || '').trim() || null;
                      const s3 = (selection?.third_squad || '').trim() || null;
                      const isLocked = Boolean(selection?.is_locked);
                      const isFallIn = String(activity.title).trim().toLowerCase() === 'punctuality - fall in';
                      const boysPositions = isFallIn ? parseFallInPositions(s1) : {};
                      const girlsPositions = isFallIn ? parseFallInPositions(s2) : {};
                      const rule = isFallIn ? null : getActivityRule(selectedDay, activity.title);
                      const ruleSquads = rule && s1 ? s1.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const isComplete = isFallIn
                        ? (Object.keys(boysPositions).length > 0 || Object.keys(girlsPositions).length > 0)
                        : (rule ? (ruleSquads.length === rule.requiredCount) : Boolean(s1 && s2 && s3));
                      const isExpanded = expandedActivities[activityKey] !== false;
                      const isSaving = savingKey === activityKey;

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
                              padding: isMobile ? '8px 10px' : '9px 12px',
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
                            {/* Left: Number & Title */}
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
                                {aIdx + 1}
                              </div>

                              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                <span style={{
                                  fontSize: isMobile ? '12px' : '13px',
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
                                    {rule.requiredCount === 1 ? '1 Winner (2 pts)' : `${rule.requiredCount} Squads`}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Right: Controls (Reset, Status) + Chevron */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              {/* Reset Button */}
                              {(s1 || s2 || s3) && !isLocked && (
                                <button
                                  onClick={(e) => handleResetActivity(selectedDay, activity.title, e)}
                                  disabled={isSaving}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#64748b',
                                    fontSize: '9.5px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                  title="Reset selection"
                                >
                                  <RotateCcw size={9} />
                                  <span>Reset</span>
                                </button>
                              )}

                              {isLocked ? (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  color: '#166534',
                                  background: '#dcfce7',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  <Lock size={8} /> Locked
                                </span>
                              ) : isComplete ? (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  color: '#15803d',
                                  background: '#dcfce7',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  <CheckCircle2 size={9} /> Done
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '700',
                                  color: '#64748b',
                                  background: '#f1f5f9',
                                  padding: '2px 5px',
                                  borderRadius: '4px'
                                }}>
                                  Pending
                                </span>
                              )}

                              <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>
                            </div>
                          </div>

                          {/* Expanded 10 Squad Selection Grid / Fall-In Section */}
                          {isExpanded && (
                            <div style={{
                              padding: isMobile ? '12px 10px 14px' : '14px 16px 16px',
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
                                        👦 Boys Fall-In
                                      </span>
                                    </div>

                                    {/* 10 Squads Vertical List */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                      {squadsList.map(sq => {
                                        const rank = boysPositions[sq] || '';
                                        const sqBoys = demographics?.squads?.[sq]?.boys ?? 0;
                                        const sqGirls = demographics?.squads?.[sq]?.girls ?? 0;
                                        const sqTotal = sqBoys + sqGirls;
                                        const boysSharePct = sqTotal > 0 ? ((sqBoys / sqTotal) * 100).toFixed(2) : '50.00';
                                        const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5;
                                        const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));
                                        const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0;
                                        const sqPts = rank ? Number((boysShare * multiplier).toFixed(2)) : null;

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
                                              disabled={isLocked || isSaving}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: '5px',
                                                border: rank ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                                                background: rank ? '#ffffff' : '#ffffff',
                                                color: rank ? '#1e40af' : '#475569',
                                                fontSize: '12px',
                                                fontWeight: rank ? '700' : '500',
                                                cursor: (isLocked || isSaving) ? 'not-allowed' : 'pointer',
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
                                        );
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
                                        const rank = girlsPositions[sq] || '';
                                        const sqBoys = demographics?.squads?.[sq]?.boys ?? 0;
                                        const sqGirls = demographics?.squads?.[sq]?.girls ?? 0;
                                        const sqTotal = sqBoys + sqGirls;
                                        const girlsSharePct = sqTotal > 0 ? ((sqGirls / sqTotal) * 100).toFixed(2) : '50.00';
                                        const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5;
                                        const medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : ''));
                                        const multiplier = rank >= 1 && rank <= 10 ? (11 - rank) : 0;
                                        const sqPts = rank ? Number((girlsShare * multiplier).toFixed(2)) : null;

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
                                              disabled={isLocked || isSaving}
                                              style={{
                                                padding: '4px 8px',
                                                borderRadius: '5px',
                                                border: rank ? '1.5px solid #ec4899' : '1px solid #cbd5e1',
                                                background: rank ? '#ffffff' : '#ffffff',
                                                color: rank ? '#be185d' : '#475569',
                                                fontSize: '12px',
                                                fontWeight: rank ? '700' : '500',
                                                cursor: (isLocked || isSaving) ? 'not-allowed' : 'pointer',
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
                                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                      gap: '10px'
                                    }}>
                                      {squadsList.map(sq => {
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
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* Standard 10 Squad Buttons Grid (2 cols mobile, 5 cols desktop) */
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                                  gap: isMobile ? '6px' : '7px'
                                }}>
                                  {squadsList.map(sq => {
                                    const rankIdx = rule && rule.isRanked ? ruleSquads.indexOf(sq) : -1;
                                    const sqRank = rankIdx >= 0 ? rankIdx + 1 : null;
                                    const isRuleSelected = rule ? ruleSquads.includes(sq) : false;
                                    const is1st = !rule && s1 === sq;
                                    const is2nd = !rule && s2 === sq;
                                    const is3rd = !rule && s3 === sq;
                                    const isSelected = rule ? isRuleSelected : (is1st || is2nd || is3rd);

                                    // Dynamic border & background based on rank
                                    let btnBorder = '1.5px solid #cbd5e1';
                                    let btnBg = '#ffffff';
                                    let btnColor = '#1e293b';

                                    if (rule && rule.isRanked && sqRank) {
                                      if (sqRank === 1) {
                                        btnBorder = '2px solid #d97706';
                                        btnBg = '#fffbeb';
                                        btnColor = '#78350f';
                                      } else if (sqRank === 2) {
                                        btnBorder = '2px solid #64748b';
                                        btnBg = '#f1f5f9';
                                        btnColor = '#0f172a';
                                      } else if (sqRank === 3) {
                                        btnBorder = '2px solid #ea580c';
                                        btnBg = '#fff7ed';
                                        btnColor = '#7c2d12';
                                      } else {
                                        btnBorder = '2px solid #3b82f6';
                                        btnBg = '#eff6ff';
                                        btnColor = '#1e3a8a';
                                      }
                                    } else if ((rule && !rule.isRanked && isRuleSelected) || is1st) {
                                      btnBorder = '2px solid #d97706';
                                      btnBg = '#fffbeb';
                                      btnColor = '#78350f';
                                    } else if (is2nd) {
                                      btnBorder = '2px solid #64748b';
                                      btnBg = '#f1f5f9';
                                      btnColor = '#0f172a';
                                    } else if (is3rd) {
                                      btnBorder = '2px solid #ea580c';
                                      btnBg = '#fff7ed';
                                      btnColor = '#7c2d12';
                                    }

                                    return (
                                      <button
                                        key={sq}
                                        onClick={() => handleSquadClickOrder(activity, sq)}
                                        disabled={isLocked || isSaving}
                                        className="pa-squad-btn"
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
                                          cursor: isLocked ? 'not-allowed' : 'pointer',
                                          minHeight: isMobile ? '42px' : '42px',
                                          height: isMobile ? '42px' : '42px',
                                          boxSizing: 'border-box',
                                          opacity: isLocked ? 0.85 : 1,
                                          boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                                          transition: 'all 0.12s ease'
                                        }}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {sq}
                                        </span>

                                        {/* Badges */}
                                        {((rule && !rule.isRanked && isRuleSelected) || is1st) && (
                                          <span style={{
                                            fontSize: '10px',
                                            fontWeight: '900',
                                            color: '#92400e',
                                            background: '#fde68a',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
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
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
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
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}>
                                            🥉 3rd
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

    </div>
  );
}


