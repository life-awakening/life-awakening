import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, Filter, Download, ShieldCheck, User, Calendar,
  ChevronLeft, ChevronRight, FileSpreadsheet, Eye, X, CheckCircle2,
  Clock, Info, Layers, Building, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

export default function RiAuditLogsModule({ isMobile = false }) {
  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }), [token]);

  // Data state
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [batchesList, setBatchesList] = useState([]);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch batches for filter dropdown
  useEffect(() => {
    const loadBatches = async () => {
      try {
        const res = await fetch(`${API}/api/ri/batches`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setBatchesList(data.batches || []);
        }
      } catch (e) {
        console.error('Failed to load batches list:', e);
      }
    };
    loadBatches();
  }, [authHeaders]);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter) params.append('user_role', roleFilter);
      if (actionFilter) params.append('action', actionFilter);
      if (batchFilter) params.append('batch_id', batchFilter);

      const res = await fetch(`${API}/api/ri/reports/audit-logs?${params.toString()}`, {
        headers: authHeaders
      });

      if (!res.ok) {
        throw new Error(`Failed to load audit logs: ${res.statusText}`);
      }

      const data = await res.json();
      setLogs(data.logs || []);
      if (data.pagination) {
        setTotalCount(data.pagination.total || 0);
        setTotalPages(data.pagination.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching RI audit logs:', err);
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, actionFilter, batchFilter, authHeaders]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!logs || logs.length === 0) return;
    const rows = logs.map(l => {
      let detailsStr = '';
      if (l.details) {
        if (typeof l.details === 'string') {
          detailsStr = l.details;
        } else {
          detailsStr = l.details.description || JSON.stringify(l.details);
        }
      }
      return {
        'Log ID': l.id,
        'Timestamp': l.created_at ? new Date(l.created_at).toLocaleString() : '',
        'User Name': l.user_name || 'System',
        'User Email': l.user_email || '',
        'User Role': l.user_role || '',
        'Action': l.action || '',
        'Batch': l.batch_name || (l.ri_batch_id ? `Batch #${l.ri_batch_id}` : ''),
        'Panel': l.panel_name || (l.ri_panel_id ? `Panel #${l.ri_panel_id}` : ''),
        'Record ID': l.record_id || '',
        'IP Address': l.ip_address || '',
        'Details': detailsStr
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RI Audit Logs');
    XLSX.writeFile(wb, `RI_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Helper: Role badge styling (Distinct styling for Admin, Faculty, Student, Nodal)
  const renderRoleBadge = (role) => {
    const r = (role || '').toLowerCase();
    const isAdmin = r.includes('admin');
    const isFaculty = r.includes('faculty');
    const isNodal = r.includes('nodal');

    let bg = '#f1f5f9';
    let border = '#cbd5e1';
    let text = '#334155';

    if (isAdmin) {
      bg = '#ecfdf5';
      border = '#a7f3d0';
      text = '#047857';
    } else if (isFaculty) {
      bg = '#eff6ff';
      border = '#bfdbfe';
      text = '#1d4ed8';
    } else if (isNodal) {
      bg = '#faf5ff';
      border = '#e9d5ff';
      text = '#7e22ce';
    }

    let label = role || 'System';
    if (r.includes('superadmin')) label = 'RI Super Admin';
    else if (r.includes('admin')) label = 'RI Admin';
    else if (r.includes('faculty')) label = 'RI Faculty';
    else if (r.includes('nodal')) label = 'Nodal Officer';
    else if (r.includes('student')) label = 'RI Student';

    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '700',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {label}
      </span>
    );
  };

  // Helper: Format Action names
  const formatActionName = (action) => {
    if (!action) return 'Activity';
    return action.replace(/_/g, ' ');
  };

  // Action badge styling (Strict 2-Color: Emerald & Slate)
  const renderActionBadge = (action) => {
    const act = action || '';
    const isPrimary = act.includes('CREATE') || act.includes('IMPORT') || act.includes('ASSIGN') || act.includes('SUBMIT');

    const bg = isPrimary ? '#ecfdf5' : '#f8fafc';
    const border = isPrimary ? '#a7f3d0' : '#cbd5e1';
    const text = isPrimary ? '#047857' : '#0f172a';

    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11.5px',
        fontWeight: '600',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        fontFamily: 'monospace'
      }}>
        {act}
      </span>
    );
  };

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    let adminCount = 0;
    let facultyCount = 0;
    let studentCount = 0;
    logs.forEach(l => {
      const r = (l.user_role || '').toLowerCase();
      if (r.includes('admin')) adminCount++;
      else if (r.includes('faculty')) facultyCount++;
      else if (r.includes('student')) studentCount++;
    });
    return {
      adminCount,
      facultyCount,
      studentCount,
      pageCount: logs.length
    };
  }, [logs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* Top Banner / Heading */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div>
          <h1 style={{
            fontSize: isMobile ? '20px' : '23px',
            fontWeight: '800',
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.3px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldCheck size={24} style={{ color: '#047857' }} />
            Rural Immersion Audit Logs
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Dedicated immutable activity trail strictly for RI modules, administrators, faculty, and student submissions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchAuditLogs}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-slate-50"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={logs.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#047857',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: logs.length === 0 ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
            className="hover:bg-emerald-800"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Total Audit Records
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {totalCount}
          </div>
          <span style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>
            Pure RI Telemetry
          </span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Admin / Super Admin
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>
            {metrics.adminCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            In current page view
          </span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Faculty Activity
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {metrics.facultyCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Reviews & Evaluations
          </span>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '14px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
            Student Submissions
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {metrics.studentCount}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
            Drafts & Final Submissions
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '14px 16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '6px 12px',
          flex: '1 1 240px',
          minWidth: '200px'
        }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search by user, email, action, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '13px',
              color: '#0f172a',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">All Roles</option>
          <option value="ri_admin">RI Admin</option>
          <option value="superadmin-ri">RI Super Admin</option>
          <option value="faculty">Faculty</option>
          <option value="student">Student</option>
          <option value="nodal_officer">Nodal Officer</option>
        </select>

        {/* Batch Filter */}
        <select
          value={batchFilter}
          onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">All Batches</option>
          {batchesList.map(b => (
            <option key={b.id} value={b.id}>{b.name || b.batch_code}</option>
          ))}
        </select>

        {/* Action Filter */}
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            color: '#334155',
            fontWeight: '500',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">All Actions</option>
          <option value="SAVE_DRAFT_FORM">SAVE_DRAFT_FORM</option>
          <option value="SUBMIT_FINAL_FORM">SUBMIT_FINAL_FORM</option>
          <option value="VIEW_STUDENT_SUBMISSION">VIEW_STUDENT_SUBMISSION</option>
          <option value="SUPERADMIN_MODIFY_ATTENDANCE">SUPERADMIN_MODIFY_ATTENDANCE</option>
          <option value="LOCK_PANEL_ATTENDANCE">LOCK_PANEL_ATTENDANCE</option>
          <option value="UNLOCK_PANEL_ATTENDANCE">UNLOCK_PANEL_ATTENDANCE</option>
          <option value="IMPORT_VILLAGE_FACULTY">IMPORT_VILLAGE_FACULTY</option>
          <option value="RI_STUDENT_UPDATED">RI_STUDENT_UPDATED</option>
          <option value="CREATE_RI_STUDENT">CREATE_RI_STUDENT</option>
          <option value="RI_COMMUNICATION_EMAIL_SENT">RI_COMMUNICATION_EMAIL_SENT</option>
        </select>

        {(roleFilter || actionFilter || batchFilter || searchTerm) && (
          <button
            onClick={() => {
              setRoleFilter('');
              setActionFilter('');
              setBatchFilter('');
              setSearchTerm('');
              setPage(1);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            className="hover:bg-slate-200"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table Container */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={28} className="animate-spin text-emerald-600" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Loading RI audit logs...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#0f172a' }}>
            <AlertCircle size={32} style={{ margin: '0 auto 8px auto', color: '#64748b' }} />
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <Info size={36} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
            <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#475569' }}>No audit records found</p>
            <p style={{ margin: 0, fontSize: '13px' }}>Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Timestamp</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>User & Role</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Action</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Batch / Panel</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Details</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  let desc = '';
                  if (log.details) {
                    if (typeof log.details === 'string') {
                      desc = log.details;
                    } else if (log.details.description) {
                      desc = log.details.description;
                    } else {
                      desc = JSON.stringify(log.details);
                    }
                  }

                  const dt = log.created_at ? new Date(log.created_at) : null;
                  const dateStr = dt ? dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                  const timeStr = dt ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}
                      className="hover:bg-slate-50"
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{dateStr}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{timeStr}</div>
                      </td>

                      {/* User & Role */}
                      <td style={{ padding: '12px 14px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: '600', color: '#0f172a' }}>
                            {log.user_name || 'System'}
                          </span>
                          {log.user_email && (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {log.user_email}
                            </span>
                          )}
                          <div style={{ marginTop: '2px' }}>
                            {renderRoleBadge(log.user_role)}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {renderActionBadge(log.action)}
                      </td>

                      {/* Batch / Panel */}
                      <td style={{ padding: '12px 14px', minWidth: '160px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {log.batch_name ? (
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>
                              {log.batch_name}
                            </span>
                          ) : log.ri_batch_id ? (
                            <span style={{ color: '#64748b' }}>Batch #{log.ri_batch_id}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Global</span>
                          )}

                          {log.panel_name || log.panel_number ? (
                            <span style={{ fontSize: '11px', color: '#047857', fontWeight: '600' }}>
                              Panel: {log.panel_name || `Panel ${log.panel_number}`}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Details summary */}
                      <td style={{ padding: '12px 14px', maxWidth: '300px' }}>
                        <p style={{
                          margin: 0,
                          fontSize: '12.5px',
                          color: '#334155',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }} title={desc}>
                          {desc || '-'}
                        </p>
                      </td>

                      {/* View Details Button */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          className="hover:bg-slate-100"
                        >
                          <Eye size={13} />
                          <span>View</span>
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
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12.5px', color: '#64748b' }}>
            Showing {logs.length > 0 ? ((page - 1) * limit + 1) : 0} to {Math.min(page * limit, totalCount)} of {totalCount} entries
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', padding: '0 4px' }}>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1
              }}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Log Inspection Details */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '650px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  RI Audit Log Inspection #{selectedLog.id}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Recorded on {new Date(selectedLog.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px'
                }}
                className="hover:text-slate-900"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Meta Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: '12px',
                backgroundColor: '#f8fafc',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>User</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedLog.user_name || 'System'}
                  </div>
                  {selectedLog.user_email && (
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>{selectedLog.user_email}</div>
                  )}
                  <div style={{ marginTop: '4px' }}>{renderRoleBadge(selectedLog.user_role)}</div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Action</span>
                  <div style={{ marginTop: '4px' }}>{renderActionBadge(selectedLog.action)}</div>
                  {selectedLog.ip_address && (
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                      IP: {selectedLog.ip_address}
                    </div>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Target Batch</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedLog.batch_name || (selectedLog.ri_batch_id ? `Batch #${selectedLog.ri_batch_id}` : 'N/A')}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Target Panel</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedLog.panel_name || (selectedLog.ri_panel_id ? `Panel #${selectedLog.ri_panel_id}` : 'N/A')}
                  </div>
                </div>
              </div>

              {/* JSON Payload Details */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: '750', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Event Payload & Details
                </span>
                <pre style={{
                  backgroundColor: '#0f172a',
                  color: '#e2e8f0',
                  padding: '14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  maxHeight: '260px',
                  margin: 0
                }}>
                  {JSON.stringify(typeof selectedLog.details === 'string' ? JSON.parse(selectedLog.details || '{}') : selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
