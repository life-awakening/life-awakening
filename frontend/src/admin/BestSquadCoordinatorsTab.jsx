import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { generateBestSquadCoordinatorsPdf } from '../utils/generateBestSquadCoordinatorsPdf';

const CANONICAL_SQUADS = [
  'Aditya',
  'Bhaskar',
  'Dinkar',
  'Divakar',
  'Mitra',
  'Martand',
  'Prabhakar',
  'Ravi',
  'Surya',
  'Tejonidhi'
];

export default function BestSquadCoordinatorsTab({
  token,
  apiBase,
  API,
  showToast,
  isReadonly = false,
  isMobile: isMobileProp
}) {
  const effectiveApi = apiBase || API || import.meta.env.VITE_API_URL || 'http://localhost:5001';
  const authToken = token || localStorage.getItem('token');

  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = isMobileProp !== undefined ? isMobileProp : windowWidth < 768;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingBatchId, setSavingBatchId] = useState(null);

  const [batches, setBatches] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  // Local state for row squad selections: { [batchId]: selectedSquadName }
  const [selectedSquads, setSelectedSquads] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Best Squad Coordinators and Batches Data
  const fetchData = useCallback(async (isSilent = false) => {
    if (!authToken) return;
    if (isSilent) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`${effectiveApi}/api/superadmin/best-squad-coordinators`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Guarantee strict deduplication: exactly 1 entry per batch name
        const seenNames = new Set();
        const batchList = [];
        (data.batches || []).forEach(b => {
          const nKey = (b.batchName || `Batch ${b.batchId}`).trim().toLowerCase();
          if (!seenNames.has(nKey)) {
            seenNames.add(nKey);
            batchList.push(b);
          }
        });

        setBatches(batchList);
        setLeaderboard(data.leaderboard || []);

        // Initialize local selections from server
        const initialSelections = {};
        batchList.forEach(b => {
          initialSelections[b.batchId] = b.assignedSquad || '';
        });
        setSelectedSquads(initialSelections);
      } else {
        if (showToast) showToast(data.message || 'Failed to fetch Best Squad Coordinators data', 'error');
      }
    } catch (err) {
      console.error('Error fetching best squad coordinators:', err);
      if (showToast) showToast('Network error loading Best Squad Coordinators data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, effectiveApi, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 2. Handle Squad Dropdown Change (Live preview of coordinator)
  const handleSquadChange = (batchId, squadValue) => {
    if (isReadonly) return;
    setSelectedSquads(prev => ({
      ...prev,
      [batchId]: squadValue
    }));
  };

  // 3. Save / Update Best Squad Winner for a specific Batch
  const handleSaveBatchWinner = async (batchId) => {
    if (isReadonly || !authToken) return;
    const squadToSave = selectedSquads[batchId] || '';
    const targetBatch = batches.find(b => b.batchId === batchId);
    const coordInfo = squadToSave && targetBatch?.squadCoordinatorsMap?.[squadToSave]?.coordinator;

    try {
      setSavingBatchId(batchId);
      const res = await fetch(`${effectiveApi}/api/superadmin/best-squad-coordinators/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchId: batchId,
          squad: squadToSave,
          coordinatorId: coordInfo?.id || null,
          coordinatorName: coordInfo?.name || targetBatch?.squadCoordinatorsMap?.[squadToSave]?.displayName || null,
          coordinatorEmail: coordInfo?.email || null
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) {
          showToast(
            squadToSave
              ? `Best Squad set to ${squadToSave} for this batch.`
              : 'Best Squad selection cleared.',
            'success'
          );
        }
        await fetchData(true);
      } else {
        if (showToast) showToast(data.message || 'Failed to save Best Squad selection.', 'error');
      }
    } catch (err) {
      console.error('Error saving Best Squad selection:', err);
      if (showToast) showToast('Network error saving Best Squad selection.', 'error');
    } finally {
      setSavingBatchId(null);
    }
  };

  // 4. Clear Selection for a Batch
  const handleClearBatchWinner = async (batchId) => {
    if (isReadonly || !authToken) return;
    setSelectedSquads(prev => ({
      ...prev,
      [batchId]: ''
    }));

    try {
      setSavingBatchId(batchId);
      const res = await fetch(`${effectiveApi}/api/superadmin/best-squad-coordinators/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          batchId: batchId,
          squad: ''
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) showToast('Best Squad winner cleared for this batch.', 'info');
        await fetchData(true);
      } else {
        if (showToast) showToast(data.message || 'Failed to clear selection.', 'error');
      }
    } catch (err) {
      console.error('Error clearing Best Squad selection:', err);
      if (showToast) showToast('Network error clearing selection.', 'error');
    } finally {
      setSavingBatchId(null);
    }
  };

  // 5. Filter Batches and Leaderboard by search query
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase().trim();
    return batches.filter(b => {
      const nameMatch = (b.batchName || '').toLowerCase().includes(q);
      const squadMatch = (selectedSquads[b.batchId] || b.assignedSquad || '').toLowerCase().includes(q);
      const coordMatch = (b.assignedCoordinatorDisplay || '').toLowerCase().includes(q);
      return nameMatch || squadMatch || coordMatch;
    });
  }, [batches, searchQuery, selectedSquads]);

  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase().trim();
    return leaderboard.filter(c => {
      const nameMatch = (c.coordinatorName || '').toLowerCase().includes(q);
      const emailMatch = (c.coordinatorEmail || '').toLowerCase().includes(q);
      const batchMatch = (c.batches || []).some(b => (b || '').toLowerCase().includes(q)) ||
        (c.winningBatches || []).some(wb =>
          (wb.batchName || '').toLowerCase().includes(q) || (wb.squad || '').toLowerCase().includes(q)
        );
      return nameMatch || emailMatch || batchMatch;
    });
  }, [leaderboard, searchQuery]);

  // 6. Download PDF Leaderboard
  const handleDownloadPdf = async () => {
    if (leaderboard.length === 0) {
      if (showToast) showToast('No leaderboard data available to download.', 'warning');
      return;
    }

    try {
      setDownloadingPdf(true);
      await generateBestSquadCoordinatorsPdf({
        leaderboard: filteredLeaderboard.length > 0 ? filteredLeaderboard : leaderboard
      });
      if (showToast) showToast('Best Squad Coordinators PDF downloaded successfully.', 'success');
    } catch (err) {
      console.error('PDF Generation Error:', err);
      if (showToast) showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Helper to get coordinator display for current selection in a row
  const getRowCoordinator = (batch) => {
    const curSquad = selectedSquads[batch.batchId];
    if (!curSquad) {
      return '—';
    }
    const squadInfo = batch.squadCoordinatorsMap?.[curSquad];
    if (squadInfo && squadInfo.displayName && squadInfo.displayName !== 'Unassigned' && squadInfo.displayName !== '—') {
      return squadInfo.displayName;
    }
    return 'Unassigned';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>

      {/* ─── Simple Page Header with Actions ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        padding: isMobile ? '12px 14px' : '14px 18px',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: '700', color: '#0f172a' }}>
            Best Squad Coordinators
          </h2>
          {isReadonly && (
            <span style={{
              background: '#f1f5f9',
              color: '#475569',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              border: '1px solid #cbd5e1'
            }}>
              Read-Only
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 10px',
            flex: isMobile ? '1 1 100%' : 'none',
            minWidth: isMobile ? '100%' : '220px'
          }}>
            <input
              type="text"
              placeholder="Search batch or coordinator..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '12.5px',
                color: '#0f172a',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '0 0 0 6px',
                  fontWeight: '600'
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading || downloadingPdf}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: (refreshing || loading || downloadingPdf) ? 'not-allowed' : 'pointer',
              flex: isMobile ? 1 : 'none',
              textAlign: 'center',
              height: '32px'
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={leaderboard.length === 0 || downloadingPdf}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#154388',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: (leaderboard.length === 0 || downloadingPdf) ? 'not-allowed' : 'pointer',
              opacity: (leaderboard.length === 0 || downloadingPdf) ? 0.6 : 1,
              flex: isMobile ? 1 : 'none',
              textAlign: 'center',
              height: '32px'
            }}
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ─── Section 1: Batch-Wise Best Squad Assignment ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
            Batch-Wise Best Squad Assignment
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading assignments...
          </div>
        ) : filteredBatches.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            {searchQuery ? 'No matching batches found.' : 'No batches available.'}
          </div>
        ) : isMobile ? (
          /* Mobile Stacked Rows */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredBatches.map((batch, idx) => {
              const currentSelection = selectedSquads[batch.batchId] || '';
              const originalSelection = batch.assignedSquad || '';
              const isDirty = currentSelection !== originalSelection;
              const isSavingThis = savingBatchId === batch.batchId;
              const coordDisplay = getRowCoordinator(batch);

              return (
                <div
                  key={batch.batchId}
                  style={{
                    padding: '14px 16px',
                    borderBottom: idx === filteredBatches.length - 1 ? 'none' : '1px solid #e2e8f0',
                    background: isDirty ? '#fefce8' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                      {batch.batchName}
                    </span>
                    {!isReadonly && isDirty && (
                      <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>
                        Unsaved
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Best Squad Winner
                    </label>
                    {isReadonly ? (
                      <div style={{ fontSize: '13px', fontWeight: '600', color: originalSelection ? '#0f172a' : '#94a3b8' }}>
                        {originalSelection ? `${originalSelection} Squad` : 'Not Selected'}
                      </div>
                    ) : (
                      <select
                        value={currentSelection}
                        onChange={(e) => handleSquadChange(batch.batchId, e.target.value)}
                        disabled={isSavingThis}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: isDirty ? '1.5px solid #eab308' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '13px',
                          color: currentSelection ? '#0f172a' : '#64748b',
                          outline: 'none'
                        }}
                      >
                        <option value="">-- Select Best Squad --</option>
                        {CANONICAL_SQUADS.map(sq => (
                          <option key={sq} value={sq}>{sq} Squad</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>
                      Assigned Squad Coordinator
                    </label>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: coordDisplay !== '—' && coordDisplay !== 'Unassigned' ? '600' : '400',
                      color: coordDisplay !== '—' && coordDisplay !== 'Unassigned' ? '#0f172a' : '#64748b'
                    }}>
                      {coordDisplay}
                    </div>
                  </div>

                  {!isReadonly && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      {isDirty ? (
                        <button
                          onClick={() => handleSaveBatchWinner(batch.batchId)}
                          disabled={isSavingThis}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#154388',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isSavingThis ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isSavingThis ? 'Saving...' : 'Save'}
                        </button>
                      ) : originalSelection ? (
                        <button
                          onClick={() => handleClearBatchWinner(batch.batchId)}
                          disabled={isSavingThis}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#dc2626',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isSavingThis ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Clean Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}>
                  <th style={{ padding: '10px 16px', width: '220px' }}>Batch Name</th>
                  <th style={{ padding: '10px 16px', width: '200px' }}>Best Squad Winner</th>
                  <th style={{ padding: '10px 16px' }}>Assigned Squad Coordinator</th>
                  {!isReadonly && (
                    <th style={{ padding: '10px 16px', width: '110px', textAlign: 'right' }}>Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch) => {
                  const currentSelection = selectedSquads[batch.batchId] || '';
                  const originalSelection = batch.assignedSquad || '';
                  const isDirty = currentSelection !== originalSelection;
                  const isSavingThis = savingBatchId === batch.batchId;
                  const coordDisplay = getRowCoordinator(batch);

                  return (
                    <tr
                      key={batch.batchId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isDirty ? '#fefce8' : '#ffffff'
                      }}
                    >
                      {/* Batch Name */}
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {batch.batchName}
                      </td>

                      {/* Best Squad Winner Dropdown */}
                      <td style={{ padding: '10px 16px' }}>
                        {isReadonly ? (
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: originalSelection ? '#0f172a' : '#94a3b8'
                          }}>
                            {originalSelection ? `${originalSelection} Squad` : '—'}
                          </div>
                        ) : (
                          <select
                            value={currentSelection}
                            onChange={(e) => handleSquadChange(batch.batchId, e.target.value)}
                            disabled={isSavingThis}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              borderRadius: '5px',
                              border: isDirty ? '1.5px solid #eab308' : '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: '12.5px',
                              color: currentSelection ? '#0f172a' : '#64748b',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="">-- Select Best Squad --</option>
                            {CANONICAL_SQUADS.map(sq => (
                              <option key={sq} value={sq}>{sq} Squad</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Assigned Squad Coordinator */}
                      <td style={{
                        padding: '10px 16px',
                        fontWeight: coordDisplay !== '—' && coordDisplay !== 'Unassigned' ? '600' : '400',
                        color: coordDisplay !== '—' && coordDisplay !== 'Unassigned' ? '#0f172a' : '#64748b'
                      }}>
                        {coordDisplay}
                      </td>

                      {/* Action */}
                      {!isReadonly && (
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {isDirty ? (
                              <button
                                onClick={() => handleSaveBatchWinner(batch.batchId)}
                                disabled={isSavingThis}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: '#154388',
                                  color: '#ffffff',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  cursor: isSavingThis ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {isSavingThis ? 'Saving...' : 'Save'}
                              </button>
                            ) : originalSelection ? (
                              <button
                                onClick={() => handleClearBatchWinner(batch.batchId)}
                                disabled={isSavingThis}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#dc2626',
                                  fontSize: '11.5px',
                                  fontWeight: '500',
                                  cursor: isSavingThis ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Clear
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Section 2: Coordinator Championship Leaderboard ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
            Coordinator Championship Leaderboard
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            Loading leaderboard...
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            {searchQuery
              ? 'No matching coordinators found.'
              : 'No Best Squad selections saved yet.'}
          </div>
        ) : isMobile ? (
          /* Mobile Stacked Leaderboard Rows */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLeaderboard.map((coord, idx) => {
              const rank = coord.rank !== undefined ? coord.rank : (idx + 1);
              const batchesList = (coord.batches && coord.batches.length > 0)
                ? coord.batches
                : (coord.winningBatches || []).map(wb => wb.batchName);
              const batchesDisplay = batchesList.join(', ');

              return (
                <div
                  key={coord.coordinatorId || `coord_${idx}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx === filteredLeaderboard.length - 1 ? 'none' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: rank <= 3 ? '#0f172a' : '#64748b'
                      }}>
                        #{rank}
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>
                        {coord.coordinatorName}
                      </span>
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                      {coord.winsCount} {coord.winsCount === 1 ? 'Win' : 'Wins'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {batchesDisplay || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop Clean Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}>
                  <th style={{ padding: '10px 16px', width: '70px' }}>Rank</th>
                  <th style={{ padding: '10px 16px', width: '280px' }}>Squad Coordinator</th>
                  <th style={{ padding: '10px 16px', width: '150px', textAlign: 'center' }}>Best Squad Wins</th>
                  <th style={{ padding: '10px 16px' }}>Batches Won</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaderboard.map((coord, idx) => {
                  const rank = coord.rank !== undefined ? coord.rank : (idx + 1);
                  const batchesList = (coord.batches && coord.batches.length > 0)
                    ? coord.batches
                    : (coord.winningBatches || []).map(wb => wb.batchName);
                  const batchesDisplay = batchesList.join(', ');

                  return (
                    <tr
                      key={coord.coordinatorId || `coord_${idx}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: '#ffffff'
                      }}
                    >
                      {/* Rank */}
                      <td style={{
                        padding: '10px 16px',
                        fontWeight: '700',
                        color: rank <= 3 ? '#0f172a' : '#64748b'
                      }}>
                        {rank}
                      </td>

                      {/* Coordinator Name */}
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {coord.coordinatorName}
                      </td>

                      {/* Best Squad Wins */}
                      <td style={{
                        padding: '10px 10px',
                        textAlign: 'center',
                        fontWeight: '700',
                        color: '#0f172a'
                      }}>
                        {coord.winsCount}
                      </td>

                      {/* Batches Won */}
                      <td style={{ padding: '10px 16px', color: '#334155' }}>
                        {batchesDisplay || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
