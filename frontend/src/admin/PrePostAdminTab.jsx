import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, ShieldCheck, Check, UserCheck, AlertCircle } from 'lucide-react';

export default function PrePostAdminTab({ API, token, user, showToast }) {
  const [members, setMembers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [perfAdminMap, setPerfAdminMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);

  const effectiveApi = API || import.meta.env.VITE_API_URL || 'http://localhost:5001';
  const authToken = token || localStorage.getItem('token');

  const fetchMembers = useCallback(async (isSilent = false) => {
    if (!authToken) return;
    if (!isSilent) setLoading(true);
    try {
      const [prePostRes, perfRes] = await Promise.all([
        fetch(`${effectiveApi}/api/superadmin/pre-post-admin`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${effectiveApi}/api/superadmin/performance-admins`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const data = await prePostRes.json();
      if (prePostRes.ok && data.success) {
        setMembers(data.ltcMembers || []);
        setSelectedUserIds(data.selectedUserIds || []);
      } else {
        if (showToast) showToast(data.message || 'Failed to load LTC members', 'error');
      }

      if (perfRes.ok) {
        const perfData = await perfRes.json();
        if (perfData.success && Array.isArray(perfData.users)) {
          const mapping = {};
          perfData.users.forEach(u => {
            if (Array.isArray(u.assigned_roles) && u.assigned_roles.length > 0) {
              mapping[Number(u.id)] = u.assigned_roles;
            }
          });
          setPerfAdminMap(mapping);
        }
      }
    } catch (err) {
      console.error('Error fetching Pre/Post Admin roster:', err);
      if (showToast) showToast('Network error loading LTC members', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [effectiveApi, authToken, showToast]);

  useEffect(() => {
    fetchMembers(false);
  }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(m => {
      const name = (m.name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const dept = (m.department || '').toLowerCase();
      const desig = (m.designation || '').toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q) || desig.includes(q);
    });
  }, [members, searchQuery]);

  const handleSelectMember = async (targetMember) => {
    if (!targetMember || !targetMember.id || savingUserId) return;
    const perfRoles = perfAdminMap[Number(targetMember.id)] || [];
    if (perfRoles.length > 0) {
      if (showToast) {
        showToast(
          `Cannot select ${targetMember.name}: Member is currently assigned as Performance Admin (${perfRoles.join(', ')}).`,
          'error'
        );
      }
      return;
    }

    setSavingUserId(targetMember.id);

    try {
      const isCurrentlySelected = selectedUserIds.includes(Number(targetMember.id));
      const res = await fetch(`${effectiveApi}/api/superadmin/pre-post-admin/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ userId: targetMember.id, action: isCurrentlySelected ? 'clear' : 'set' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedIds = Array.isArray(data.selectedUserIds)
          ? data.selectedUserIds.map(Number)
          : isCurrentlySelected
            ? selectedUserIds.filter(id => id !== Number(targetMember.id))
            : [...selectedUserIds, Number(targetMember.id)];

        setSelectedUserIds(updatedIds);
        setMembers(prev => prev.map(m => ({
          ...m,
          isSelected: updatedIds.includes(Number(m.id))
        })));
        if (showToast) {
          showToast(
            isCurrentlySelected
              ? `Removed Pre/Post Admin access from ${targetMember.name}.`
              : `Granted Pre/Post Admin access to ${targetMember.name}.`,
            'success'
          );
        }
      } else {
        if (showToast) showToast(data.message || 'Failed to update selection', 'error');
      }
    } catch (err) {
      console.error('Error selecting Pre/Post Admin:', err);
      if (showToast) showToast('Network error updating selection', 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  const selectedMembers = useMemo(() => {
    return members.filter(m => selectedUserIds.includes(Number(m.id)));
  }, [members, selectedUserIds]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* ─── Top Header Card ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#154388" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Pre/Post Admin
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
            Select LTC members to grant access to the Pre/Post feedback administration section. Multiple members can be selected.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '6px 12px',
            minWidth: '240px'
          }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Search LTC member..."
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
                  padding: 0
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchMembers(true)}
            disabled={loading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Current Selection Notice Banner ─── */}
      <div style={{
        background: selectedMembers.length > 0 ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${selectedMembers.length > 0 ? '#bbf7d0' : '#fde68a'}`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedMembers.length > 0 ? (
              <UserCheck size={18} color="#16a34a" />
            ) : (
              <AlertCircle size={18} color="#d97706" />
            )}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: selectedMembers.length > 0 ? '#166534' : '#92400e' }}>
                {selectedMembers.length > 0
                  ? `Active Pre/Post Admins (${selectedMembers.length} Selected)`
                  : 'No LTC Members Selected'}
              </div>
              <div style={{ fontSize: '12px', color: selectedMembers.length > 0 ? '#15803d' : '#b45309', marginTop: '1px' }}>
                {selectedMembers.length > 0
                  ? 'The selected LTC members below have active access to the Super Admin feedback section.'
                  : 'Select one or more LTC members below to enable their Super Admin feedback panel access.'}
              </div>
            </div>
          </div>
        </div>

        {selectedMembers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px', borderTop: '1px solid #dcfce7' }}>
            {selectedMembers.map(m => (
              <span
                key={m.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  border: '1px solid #86efac',
                  borderRadius: '16px',
                  padding: '3px 10px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  color: '#166534'
                }}
              >
                <span>{m.name}</span>
                <button
                  onClick={() => handleSelectMember(m)}
                  disabled={savingUserId === m.id}
                  title={`Revoke Pre/Post Admin access for ${m.name}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: savingUserId === m.id ? 'wait' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '800',
                    lineHeight: '1',
                    padding: '0 2px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── LTC Members Table ─── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <RefreshCw size={20} className="animate-spin" color="#154388" />
            <span style={{ fontSize: '13px', fontWeight: '500' }}>Loading LTC members...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '13px'
          }}>
            {searchQuery
              ? 'No matching LTC members found for your search query.'
              : 'No LTC members found in the system.'}
          </div>
        ) : (
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
                  <th style={{ padding: '10px 16px', width: '50px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 16px', width: '240px' }}>LTC Member Name</th>
                  <th style={{ padding: '10px 16px', width: '220px' }}>Email Address</th>
                  <th style={{ padding: '10px 16px' }}>Department / School</th>
                  <th style={{ padding: '10px 16px', width: '160px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const isSelected = selectedUserIds.includes(Number(member.id));
                  const isSaving = savingUserId === member.id;
                  const perfRoles = perfAdminMap[Number(member.id)] || [];
                  const isPerformanceAdmin = perfRoles.length > 0;
                  const isDisabled = isSaving || isPerformanceAdmin;

                  return (
                    <tr
                      key={member.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isPerformanceAdmin ? '#f8fafc' : isSelected ? '#f8fafc' : '#ffffff',
                        opacity: isPerformanceAdmin ? 0.65 : 1,
                        transition: 'opacity 0.2s ease'
                      }}
                      className={isPerformanceAdmin ? '' : 'hover:bg-slate-50'}
                    >
                      {/* Status / Check */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isSelected ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: '#154388',
                            color: '#ffffff'
                          }}>
                            <Check size={14} />
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: '1.5px solid #cbd5e1',
                            opacity: isPerformanceAdmin ? 0.4 : 1
                          }} />
                        )}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>
                          {member.name}
                        </div>
                        {member.designation && (
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                            {member.designation}
                          </div>
                        )}
                        {isPerformanceAdmin && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#1e40af',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              marginTop: '4px'
                            }}
                            title={`Currently assigned as Performance Admin (${perfRoles.join(', ')}). Cannot be assigned Pre/Post Admin simultaneously.`}
                          >
                            <AlertCircle size={11} />
                            <span>Unavailable: Performance Admin ({perfRoles.join(', ')})</span>
                          </div>
                        )}
                      </td>

                      {/* Email */}
                      <td style={{ padding: '12px 16px', color: '#334155' }}>
                        {member.email || '—'}
                      </td>

                      {/* Department */}
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        <div>{member.department || 'LTC Team'}</div>
                        {member.school && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{member.school}</div>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => !isDisabled && handleSelectMember(member)}
                          disabled={isDisabled}
                          title={
                            isPerformanceAdmin
                              ? `Cannot select: Member is currently assigned as Performance Admin (${perfRoles.join(', ')})`
                              : isSelected
                                ? 'Click to deselect'
                                : 'Click to select as Pre/Post Admin'
                          }
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid #cbd5e1' : isPerformanceAdmin ? '1px solid #cbd5e1' : 'none',
                            background: isPerformanceAdmin ? '#f1f5f9' : isSelected ? '#f1f5f9' : '#154388',
                            color: isPerformanceAdmin ? '#94a3b8' : isSelected ? '#334155' : '#ffffff',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isPerformanceAdmin ? 0.6 : isSaving ? 0.6 : 1,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSaving
                            ? 'Saving...'
                            : isPerformanceAdmin
                              ? 'Unavailable'
                              : isSelected
                                ? 'Deselect'
                                : 'Select Member'}
                        </button>
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
