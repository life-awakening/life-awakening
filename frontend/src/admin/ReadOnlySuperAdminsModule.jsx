import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const ReadOnlySuperAdminsModule = ({ API, token, user, showToast }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Track button action loading per row ID
  const [actionId, setActionId] = useState(null);

  // Fetch candidates strictly on mount or manual refresh
  const loadCandidates = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/superadmin/eligible-readonly-candidates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setCandidates(data.candidates || []);
      } else {
        if (showToast) showToast(data.message || 'Failed to load user roster', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error loading user roster', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API, token, showToast]);

  useEffect(() => {
    loadCandidates(false);
  }, [loadCandidates]);

  // Client-side search filtering
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    const q = searchQuery.toLowerCase().trim();
    return candidates.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.department && c.department.toLowerCase().includes(q)) ||
      (c.role && c.role.toLowerCase().includes(q))
    );
  }, [candidates, searchQuery]);

  // Handle Search Input Change (resets to page 1 on active search)
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Assign Read-Only Super Admin
  const handleAssign = async (candidate) => {
    if (!candidate || !candidate.id || actionId) return;
    setActionId(candidate.id);
    try {
      const res = await fetch(`${API}/api/superadmin/assign-readonly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: candidate.id })
      });
      const data = await res.json();
      if (res.ok) {
        if (showToast) showToast(data.message || `${candidate.name} assigned as Read-Only Super Admin`, 'success');
        // Update local state ONLY for this candidate without page reset or scroll jump
        setCandidates(prev => prev.map(c => 
          c.id === candidate.id 
            ? { ...c, role: 'superadmin_readonly', base_role: c.role !== 'superadmin_readonly' ? c.role : c.base_role } 
            : c
        ));
      } else {
        if (showToast) showToast(data.message || 'Failed to assign Read-Only Super Admin', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error during assignment', 'error');
    } finally {
      setActionId(null);
    }
  };

  // Remove Read-Only Super Admin
  const handleRemove = async (candidate) => {
    if (!candidate || !candidate.id || actionId) return;
    setActionId(candidate.id);
    try {
      const res = await fetch(`${API}/api/superadmin/remove-readonly/${candidate.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetRole: candidate.base_role || 'faculty' })
      });
      const data = await res.json();
      if (res.ok) {
        if (showToast) showToast(data.message || `${candidate.name} reverted to normal user role`, 'success');
        // Update local state ONLY for this candidate without page reset or scroll jump
        setCandidates(prev => prev.map(c => 
          c.id === candidate.id 
            ? { ...c, role: c.base_role || 'faculty' } 
            : c
        ));
      } else {
        if (showToast) showToast(data.message || 'Failed to remove access', 'error');
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Network error removing access', 'error');
    } finally {
      setActionId(null);
    }
  };

  // Stable Pagination Calculations
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage) || 1;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, startIndex + itemsPerPage);

  const formatRoleLabel = (role) => {
    if (role === 'superadmin_readonly') return 'Read-Only Super Admin';
    if (role === 'ltc_member') return 'LTC Member';
    if (role === 'faculty') return 'Faculty';
    return role || 'Faculty';
  };

  return (
    <div style={{ padding: '16px 0', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Main Single Card Container */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
        minHeight: '480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          {/* Header Row: Title & Search + Refresh */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                <ShieldCheck size={20} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.2px' }}>
                Assign Read-Only Super Admin
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Search Bar */}
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '50px',
                padding: '0 14px',
                width: '280px',
                height: '38px'
              }}>
                <Search size={15} style={{ color: '#64748b', marginRight: '8px', flexShrink: 0 }} />
                <input 
                  type="text" 
                  placeholder="Search name, email, or dept..." 
                  value={searchQuery}
                  onChange={handleSearchChange}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '12.5px',
                    width: '100%',
                    color: '#0f172a'
                  }}
                />
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => loadCandidates(true)}
                title="Refresh List"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '8px 12px',
                  borderRadius: '50px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {/* User List Table */}
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>Loading Faculty & LTC Member directory...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600' }}>No users match your criteria.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: '700', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 14px' }}>Name</th>
                    <th style={{ padding: '12px 14px' }}>Email</th>
                    <th style={{ padding: '12px 14px' }}>Department</th>
                    <th style={{ padding: '12px 14px' }}>Role</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCandidates.map(c => {
                    const isReadonly = c.role === 'superadmin_readonly';
                    const isProcessing = actionId === c.id;

                    return (
                      <tr 
                        key={c.id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          background: isReadonly ? '#fffbeb' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Name */}
                        <td style={{ padding: '14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </td>

                        {/* Email */}
                        <td style={{ padding: '14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {c.email}
                        </td>

                        {/* Department */}
                        <td style={{ padding: '14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {c.department || 'General'}
                        </td>

                        {/* Role */}
                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: isReadonly ? '#fef3c7' : (c.role === 'ltc_member' ? '#f3e8ff' : '#eff6ff'),
                            color: isReadonly ? '#b45309' : (c.role === 'ltc_member' ? '#6b21a8' : '#1d4ed8'),
                            border: isReadonly ? '1px solid #fde68a' : (c.role === 'ltc_member' ? '1px solid #e9d5ff' : '1px solid #bfdbfe')
                          }}>
                            {formatRoleLabel(c.role)}
                          </span>
                        </td>

                        {/* Action Button */}
                        <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {isReadonly ? (
                            <button
                              onClick={() => handleRemove(c)}
                              disabled={isProcessing}
                              style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.7 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              {isProcessing ? 'Removing...' : 'Remove Access'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAssign(c)}
                              disabled={isProcessing}
                              style={{
                                background: '#2563eb',
                                border: 'none',
                                color: '#ffffff',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.7 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(37,99,235,0.2)'
                              }}
                            >
                              {isProcessing ? 'Assigning...' : 'Assign Access'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stable Pagination Footer */}
        {!loading && filteredCandidates.length > 0 && (
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            marginTop: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
              Showing <strong style={{ color: '#0f172a' }}>{startIndex + 1}</strong> to <strong style={{ color: '#0f172a' }}>{Math.min(startIndex + itemsPerPage, filteredCandidates.length)}</strong> of <strong style={{ color: '#0f172a' }}>{filteredCandidates.length}</strong> entries
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safePage === 1}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: safePage === 1 ? '#cbd5e1' : '#334155',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', padding: '0 8px' }}>
                Page {safePage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: safePage === totalPages ? '#cbd5e1' : '#334155',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadOnlySuperAdminsModule;
