import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Award, RefreshCw, ChevronLeft, ChevronRight, Check, X, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

const AVAILABLE_PERFORMANCE_ROLES = ['Fall In', 'Yoga', 'Agriculture'];

const ROLE_COLORS = {
  'Fall In': { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  'Yoga': { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  'Agriculture': { bg: '#fefce8', border: '#fef08a', text: '#a16207' }
};

export default function PerformanceAdminTab({ API, token, user, showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Track active network request per user ID
  const [savingUserId, setSavingUserId] = useState(null);

  // Modal state for editing a user's roles
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

  const [prePostAdminUserIds, setPrePostAdminUserIds] = useState([]);

  // Load candidates
  const loadPerformanceAdmins = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [perfRes, prePostRes] = await Promise.all([
        fetch(`${API}/api/superadmin/performance-admins`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/superadmin/pre-post-admin`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const perfData = await perfRes.json();
      if (perfRes.ok && perfData.success) {
        setUsers(perfData.users || []);
      } else {
        if (showToast) showToast(perfData.message || 'Failed to load Performance Admin roster', 'error');
      }

      if (prePostRes.ok) {
        const prePostData = await prePostRes.json();
        if (prePostData.success && Array.isArray(prePostData.selectedUserIds)) {
          setPrePostAdminUserIds(prePostData.selectedUserIds.map(Number));
        }
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error loading Performance Admins', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API, token, showToast]);

  useEffect(() => {
    loadPerformanceAdmins(false);
  }, [loadPerformanceAdmins]);

  // Client-side search & filtering
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const assigned = Array.isArray(u.assigned_roles) ? u.assigned_roles : [];
      if (roleFilter === 'assigned' && assigned.length === 0) return false;
      if (roleFilter === 'unassigned' && assigned.length > 0) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q)) ||
        assigned.some(r => r.toLowerCase().includes(q))
      );
    });
  }, [users, searchQuery, roleFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const assignedCount = useMemo(() => {
    return users.filter(u => Array.isArray(u.assigned_roles) && u.assigned_roles.length > 0).length;
  }, [users]);

  // Direct toggle role for a user
  const handleToggleRoleDirect = async (targetUser, roleName) => {
    if (!targetUser || !targetUser.id || savingUserId) return;
    const currentRoles = Array.isArray(targetUser.assigned_roles) ? [...targetUser.assigned_roles] : [];
    const newRoles = currentRoles.includes(roleName)
      ? currentRoles.filter(r => r !== roleName)
      : [...currentRoles, roleName];

    setSavingUserId(targetUser.id);
    try {
      const res = await fetch(`${API}/api/superadmin/performance-admins/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUser.id, roles: newRoles })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Roles updated successfully', 'success');
        setUsers(prev => prev.map(u => (u.id === targetUser.id ? { ...u, assigned_roles: newRoles } : u)));
      } else {
        if (showToast) showToast(data.message || 'Failed to update roles', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error saving roles', 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setSelectedRoles(Array.isArray(targetUser.assigned_roles) ? [...targetUser.assigned_roles] : []);
  };

  // Save Edit Modal
  const handleSaveModalRoles = async () => {
    if (!editingUser || savingUserId) return;
    setSavingUserId(editingUser.id);
    try {
      const res = await fetch(`${API}/api/superadmin/performance-admins/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: editingUser.id, roles: selectedRoles })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Roles updated successfully', 'success');
        setUsers(prev => prev.map(u => (u.id === editingUser.id ? { ...u, assigned_roles: selectedRoles } : u)));
        setEditingUser(null);
      } else {
        if (showToast) showToast(data.message || 'Failed to update roles', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error saving roles', 'error');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Banner */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: '#eff6ff', color: '#154388',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Award size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Performance Admin Management
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Assign restricted activity marking roles (Fall In, Yoga, Agriculture) to Faculty & LTC Members.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => loadPerformanceAdmins(false)}
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

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'block' }}>Eligible Members</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{users.length}</span>
          </div>
          <div style={{ padding: '12px 16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe' }}>
            <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600', display: 'block' }}>Assigned Performance Admins</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#154388' }}>{assignedCount}</span>
          </div>
          <div style={{ padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #dcfce7' }}>
            <span style={{ fontSize: '12px', color: '#166534', fontWeight: '600', display: 'block' }}>Active Roles Supported</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>Fall In · Yoga · Agriculture</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by name, email, department..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13.5px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          {[
            { key: 'all', label: `All (${users.length})` },
            { key: 'assigned', label: `Assigned (${assignedCount})` },
            { key: 'unassigned', label: `Unassigned (${users.length - assignedCount})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setRoleFilter(tab.key); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: roleFilter === tab.key ? '#ffffff' : 'transparent',
                color: roleFilter === tab.key ? '#0f172a' : '#64748b',
                fontWeight: roleFilter === tab.key ? '700' : '500',
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: roleFilter === tab.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table / Cards */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={24} className="animate-spin" />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Loading candidate roster...</span>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <AlertCircle size={32} style={{ color: '#94a3b8', margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#334155', margin: 0 }}>No eligible candidates found</p>
            <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', width: '260px' }}>Person</th>
                  <th style={{ padding: '12px 16px', width: '120px' }}>Base Role</th>
                  <th style={{ padding: '12px 16px' }}>Assigned Performance Role(s)</th>
                  <th style={{ padding: '12px 16px', width: '100px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', width: '130px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u, idx) => {
                  const assigned = Array.isArray(u.assigned_roles) ? u.assigned_roles : [];
                  const isSaving = savingUserId === u.id;
                  const isPrePostAdmin = prePostAdminUserIds.includes(Number(u.id));

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: idx === paginatedUsers.length - 1 ? 'none' : '1px solid #f1f5f9',
                        background: isPrePostAdmin ? '#f8fafc' : assigned.length > 0 ? '#fafbfc' : '#ffffff',
                        opacity: isPrePostAdmin ? 0.65 : 1,
                        transition: 'opacity 0.2s ease'
                      }}
                    >
                      {/* Person info */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isPrePostAdmin ? '#cbd5e1' : assigned.length > 0 ? '#154388' : '#e2e8f0',
                            color: isPrePostAdmin ? '#475569' : assigned.length > 0 ? '#ffffff' : '#475569',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: '800', flexShrink: 0
                          }}>
                            {u.name ? u.name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: '750', color: '#0f172a', fontSize: '13.5px' }}>{u.name}</div>
                            <div style={{ color: '#64748b', fontSize: '12px' }}>{u.email}</div>
                            {isPrePostAdmin && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: '#b45309',
                                  background: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginTop: '4px'
                                }}
                                title="Currently assigned as Pre/Post Admin. Cannot be assigned Performance Admin roles simultaneously."
                              >
                                <AlertCircle size={11} />
                                <span>Unavailable: Pre/Post Admin</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Base Role */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          background: u.role === 'ltc_member' ? '#fdf4ff' : '#f0f9ff',
                          color: u.role === 'ltc_member' ? '#a21caf' : '#0369a1',
                          border: `1px solid ${u.role === 'ltc_member' ? '#f5d0fe' : '#bae6fd'}`
                        }}>
                          {u.role === 'ltc_member' ? 'LTC Member' : 'Faculty'}
                        </span>
                      </td>

                      {/* Performance Role Badges & Quick Toggles */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          {AVAILABLE_PERFORMANCE_ROLES.map(roleName => {
                            const isAssigned = assigned.includes(roleName);
                            const styleCfg = ROLE_COLORS[roleName] || { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' };
                            const isDisabled = isSaving || isPrePostAdmin;

                            return (
                              <button
                                key={roleName}
                                onClick={() => !isDisabled && handleToggleRoleDirect(u, roleName)}
                                disabled={isDisabled}
                                title={
                                  isPrePostAdmin
                                    ? 'Cannot assign: Member is currently assigned as Pre/Post Admin'
                                    : isAssigned
                                      ? `Click to remove ${roleName}`
                                      : `Click to assign ${roleName}`
                                }
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  opacity: isPrePostAdmin ? 0.5 : 1,
                                  transition: 'all 0.15s ease',
                                  border: isAssigned ? `1.5px solid ${styleCfg.border}` : '1px dashed #cbd5e1',
                                  background: isAssigned ? styleCfg.bg : '#ffffff',
                                  color: isAssigned ? styleCfg.text : '#94a3b8'
                                }}
                              >
                                {isAssigned ? <Check size={12} strokeWidth={3} /> : <span style={{ fontSize: '10px' }}>+</span>}
                                {roleName}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: u.status === 'active' && !u.is_locked ? '#dcfce7' : '#fee2e2',
                          color: u.status === 'active' && !u.is_locked ? '#15803d' : '#b91c1c'
                        }}>
                          {u.status === 'active' && !u.is_locked ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => !isPrePostAdmin && openEditModal(u)}
                          disabled={isSaving || isPrePostAdmin}
                          title={isPrePostAdmin ? 'Cannot edit roles: Member is assigned as Pre/Post Admin' : 'Edit Roles'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: isPrePostAdmin ? '#f1f5f9' : '#ffffff',
                            color: isPrePostAdmin ? '#94a3b8' : '#154388',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: isSaving || isPrePostAdmin ? 'not-allowed' : 'pointer',
                            opacity: isPrePostAdmin ? 0.6 : 1
                          }}
                        >
                          Edit Roles
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div style={{
          padding: '12px 16px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12.5px',
          color: '#64748b'
        }}>
          <span>
            Showing {filteredUsers.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} people
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                color: currentPage === 1 ? '#94a3b8' : '#334155',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Performance Roles Modal */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '480px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#154388" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Assign Performance Roles
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '750', fontSize: '14px', color: '#0f172a' }}>{editingUser.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{editingUser.email} · {editingUser.role === 'ltc_member' ? 'LTC Member' : 'Faculty'}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                Select Accessible Activities:
              </span>

              {AVAILABLE_PERFORMANCE_ROLES.map(roleName => {
                const isChecked = selectedRoles.includes(roleName);
                return (
                  <label
                    key={roleName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: isChecked ? '1.5px solid #154388' : '1px solid #cbd5e1',
                      background: isChecked ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoles(prev => [...prev, roleName]);
                          } else {
                            setSelectedRoles(prev => prev.filter(r => r !== roleName));
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#154388', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontWeight: '750', fontSize: '13.5px', color: '#0f172a' }}>{roleName}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {roleName === 'Fall In' && 'Manage Fall In punctuality rankings'}
                          {roleName === 'Yoga' && 'Manage Yoga punctuality rankings'}
                          {roleName === 'Agriculture' && 'Manage Agri Morning/Evening & Day 5 Pillar'}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: isChecked ? '#154388' : '#f1f5f9',
                      color: isChecked ? '#ffffff' : '#64748b'
                    }}>
                      {isChecked ? 'ASSIGNED' : 'UNASSIGNED'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalRoles}
                disabled={savingUserId !== null}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#154388',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: savingUserId !== null ? 'wait' : 'pointer'
                }}
              >
                {savingUserId !== null ? 'Saving...' : 'Save Roles'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
