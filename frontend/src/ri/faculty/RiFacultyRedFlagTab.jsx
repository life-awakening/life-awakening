import React, { useState, useEffect, useMemo } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import { 
  AlertTriangle, 
  UserX, 
  HeartPulse, 
  ShieldAlert, 
  HelpCircle, 
  Search, 
  CheckCircle2, 
  Clock, 
  Filter, 
  ChevronRight, 
  Send, 
  RefreshCw, 
  Building, 
  GraduationCap, 
  User, 
  Calendar,
  Eye,
  Info,
  X
} from 'lucide-react';

const API = API_BASE_URL;

export default function RiFacultyRedFlagTab({ token, isMobile: propIsMobile, batchId, panelId }) {
  const [internalIsMobile, setInternalIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setInternalIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = propIsMobile !== undefined ? propIsMobile : internalIsMobile;

  const [students, setStudents] = useState([]);
  const [myFlags, setMyFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reason, setReason] = useState('Disciplinary');
  const [description, setDescription] = useState('');
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [filterReason, setFilterReason] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedFlagDetails, setSelectedFlagDetails] = useState(null);
  const [toast, setToast] = useState(null);

  const activeToken = token || localStorage.getItem('ri_token') || localStorage.getItem('token');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${activeToken}` };
      const qParams = new URLSearchParams();
      if (batchId) qParams.append('batch_id', String(batchId));
      if (panelId) qParams.append('panel_id', String(panelId));
      const qStr = qParams.toString() ? `?${qParams.toString()}` : '';
      
      const [studentsRes, flagsRes] = await Promise.all([
        fetch(`${API}/api/ri/red-flags/faculty/students${qStr}`, { headers }),
        fetch(`${API}/api/ri/red-flags/faculty/my-flags${qStr}`, { headers })
      ]);

      if (studentsRes.ok) {
        const sData = await studentsRes.json();
        setStudents(sData.students || []);
      }

      if (flagsRes.ok) {
        const fData = await flagsRes.json();
        setMyFlags(fData.redFlags || []);
      }
    } catch (err) {
      console.error('Error fetching red flag data:', err);
      showToast('Failed to load student/flag records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batchId, panelId]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => String(s.student_id) === String(selectedStudentId));
  }, [selectedStudentId, students]);

  const filteredStudents = useMemo(() => {
    if (!searchStudentTerm.trim()) return students;
    const term = searchStudentTerm.toLowerCase();
    return students.filter(s => 
      (s.student_name || '').toLowerCase().includes(term) ||
      (s.student_prn || '').toLowerCase().includes(term) ||
      (s.department || '').toLowerCase().includes(term) ||
      (s.panel_name || '').toLowerCase().includes(term)
    );
  }, [students, searchStudentTerm]);

  const filteredMyFlags = useMemo(() => {
    return myFlags.filter(flag => {
      const matchesReason = filterReason === 'all' || (flag.reason || '').toLowerCase() === filterReason.toLowerCase();
      const matchesStatus = filterStatus === 'all' || (flag.status || '').toLowerCase() === filterStatus.toLowerCase();
      const term = historySearch.toLowerCase();
      const matchesSearch = !term || 
        (flag.student_name || '').toLowerCase().includes(term) ||
        (flag.student_prn || '').toLowerCase().includes(term) ||
        (flag.description || '').toLowerCase().includes(term);

      return matchesReason && matchesStatus && matchesSearch;
    });
  }, [myFlags, filterReason, filterStatus, historySearch]);

  const handleSubmitRedFlag = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      showToast('Please select a student from your panel.', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please provide a description explaining why this red flag is being raised.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/ri/red-flags/faculty/raise`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          student_id: selectedStudentId,
          reason,
          description: description.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Red flag submitted successfully!', 'success');
        setSelectedStudentId('');
        setDescription('');
        setReason('Disciplinary');
        fetchData();
      } else {
        showToast(data.message || 'Failed to submit red flag.', 'error');
      }
    } catch (err) {
      console.error('Error submitting red flag:', err);
      showToast('Server error while submitting red flag.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonConfig = (rName) => {
    switch ((rName || '').toLowerCase()) {
      case 'medical':
        return {
          label: 'Medical',
          icon: HeartPulse,
          color: '#e11d48',
          bgColor: '#ffe4e6',
          borderColor: '#fecdd3'
        };
      case 'disciplinary':
      case 'discipline':
      case 'badmashi':
        return {
          label: 'Disciplinary',
          icon: ShieldAlert,
          color: '#d97706',
          bgColor: '#fef3c7',
          borderColor: '#fde68a'
        };
      default:
        return {
          label: 'Others',
          icon: HelpCircle,
          color: '#4f46e5',
          bgColor: '#e0e7ff',
          borderColor: '#c7d2fe'
        };
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || 'active').toLowerCase();
    if (s === 'resolved') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0'
        }}>
          <CheckCircle2 size={12} /> Resolved
        </span>
      );
    }
    if (s === 'reviewed') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe'
        }}>
          <Clock size={12} /> Under Review
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '600',
        background: '#fee2e2',
        color: '#b91c1c',
        border: '1px solid #fecaca'
      }}>
        <AlertTriangle size={12} /> Active
      </span>
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#ffffff',
          padding: '10px 18px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600',
          fontSize: '13.5px',
          animation: 'slideIn 0.2s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          {toast.message}
        </div>
      )}

      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#334155',
            padding: '7px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.1fr) minmax(0, 1fr)',
        gap: isMobile ? '16px' : '20px',
        alignItems: 'start'
      }}>
        
        {/* ── LEFT COLUMN: RAISE RED FLAG FORM ── */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: isMobile ? '16px' : '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '6px', borderRadius: '6px' }}>
              <UserX size={17} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                Raise a Red Flag
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Only students in your authorized panel are selectable
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmitRedFlag} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Student Search & Select */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Select Student <span style={{ color: '#ef4444' }}>*</span>
              </label>

              {students.length === 0 && !loading ? (
                <div style={{
                  padding: '12px',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#64748b',
                  textAlign: 'center'
                }}>
                  No students assigned to your panel yet.
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Quick filter students by name, PRN, or dept..."
                      value={searchStudentTerm}
                      onChange={e => setSearchStudentTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <select
                    value={selectedStudentId}
                    onChange={e => setSelectedStudentId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      color: '#1e293b',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- Choose a Student ({filteredStudents.length} available) --</option>
                    {filteredStudents.map(st => (
                      <option key={st.student_id} value={st.student_id}>
                        {st.student_name} ({st.student_prn || 'No PRN'}) - {st.panel_name || `Panel ${st.panel_number}`}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Selected Student Information Card */}
            {selectedStudent && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '14px',
                animation: 'fadeIn 0.2s ease-in'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <User size={16} color="#059669" />
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#065f46' }}>
                    {selectedStudent.student_name}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    background: '#dcfce7',
                    color: '#166534',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {selectedStudent.student_prn || 'N/A'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px', fontSize: '12px', color: '#334155' }}>
                  <div>
                    <strong style={{ color: '#065f46' }}>Email:</strong> {selectedStudent.student_email || 'N/A'}
                  </div>
                  <div>
                    <strong style={{ color: '#065f46' }}>Panel:</strong> {selectedStudent.panel_name || `Panel ${selectedStudent.panel_number}`}
                  </div>
                  <div>
                    <strong style={{ color: '#065f46' }}>Department:</strong> {selectedStudent.department || 'N/A'}
                  </div>
                  <div>
                    <strong style={{ color: '#065f46' }}>School:</strong> {selectedStudent.school || 'N/A'}
                  </div>
                  {selectedStudent.village_name && (
                    <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                      <strong style={{ color: '#065f46' }}>Village:</strong> {selectedStudent.village_name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Select Reason */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Select Red Flag Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
                {[
                  { id: 'Disciplinary', title: 'Disciplinary', desc: 'Behavioral / misconduct', icon: ShieldAlert, color: '#d97706', bg: '#fffbeb', border: '#fbbf24' },
                  { id: 'Others', title: 'Others', desc: 'General / other concern', icon: HelpCircle, color: '#4f46e5', bg: '#eef2ff', border: '#818cf8' }
                ].map(item => {
                  const isSelected = reason === item.id;
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setReason(item.id)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '6px',
                        border: isSelected ? `2px solid ${item.color}` : '1px solid #cbd5e1',
                        background: isSelected ? item.bg : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'border-color 0.15s ease, background 0.15s ease'
                      }}
                    >
                      <IconComponent size={18} color={isSelected ? item.color : '#64748b'} style={{ margin: '0 auto 6px auto', display: 'block' }} />
                      <div style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? item.color : '#1e293b' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Informational Banner for Medical Cases */}
              <div style={{
                marginTop: '10px',
                padding: '9px 12px',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#9a3412',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Info size={15} color="#ea580c" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Note:</strong> Medical issues, injuries, and illnesses are tracked under the <strong>Orange Flag</strong> tab with optional prescription upload.
                </span>
              </div>
            </div>

            {/* Description Textarea */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Incident / Problem Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {description.length} characters
                </span>
              </div>
              <textarea
                rows={4}
                required
                placeholder="Describe the issue in detail (e.g. behavioral misconduct, safety violations, action taken, time of occurrence)..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                type="submit"
                disabled={submitting || !selectedStudentId || !description.trim()}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: (submitting || !selectedStudentId || !description.trim()) ? '#94a3b8' : '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: (submitting || !selectedStudentId || !description.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" /> Submitting Flag...
                  </>
                ) : (
                  <>
                    <Send size={15} /> Submit Red Flag
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedStudentId('');
                  setDescription('');
                  setReason('Disciplinary');
                }}
                style={{
                  padding: '10px 16px',
                  background: '#ffffff',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* ── RIGHT COLUMN: PREVIOUSLY RAISED FLAGS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Metrics summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '10px'
          }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total Raised</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>{myFlags.length}</div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '600' }}>Disciplinary</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
                {myFlags.filter(f => (f.reason || '').toLowerCase() === 'disciplinary' || (f.reason || '').toLowerCase() === 'badmashi' || (f.reason || '').toLowerCase() === 'discipline').length}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#4f46e5', fontWeight: '600' }}>Others</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#4f46e5', marginTop: '2px' }}>
                {myFlags.filter(f => (f.reason || '').toLowerCase() === 'others').length}
              </div>
            </div>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>Resolved</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                {myFlags.filter(f => (f.status || '').toLowerCase() === 'resolved').length}
              </div>
            </div>
          </div>

          {/* History List Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: isMobile ? '16px' : '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Your Raised Red Flags ({filteredMyFlags.length})
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Real-time status updates from RI Administration
                </span>
              </div>
            </div>

            {/* History Filter Bar */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '14px',
              flexDirection: isMobile ? 'column' : 'row',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: isMobile ? '100%' : '150px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search student or PRN..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    fontSize: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                <select
                  value={filterReason}
                  onChange={e => setFilterReason(e.target.value)}
                  style={{
                    flex: isMobile ? 1 : 'initial',
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Reasons</option>
                  <option value="Medical">Medical</option>
                  <option value="Disciplinary">Disciplinary</option>
                  <option value="Others">Others</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{
                    flex: isMobile ? 1 : 'initial',
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="reviewed">Under Review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                Loading red flag records...
              </div>
            ) : filteredMyFlags.length === 0 ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1px dashed #e2e8f0',
                borderRadius: '8px',
                color: '#64748b'
              }}>
                <CheckCircle2 size={30} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>No Red Flags Found</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {myFlags.length === 0 ? 'You have not raised any student red flags yet.' : 'No flags match the applied filter.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                {filteredMyFlags.map(flag => {
                  const rConfig = getReasonConfig(flag.reason);
                  const Icon = rConfig.icon;

                  return (
                    <div
                      key={flag.id}
                      onClick={() => setSelectedFlagDetails(flag)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#ffffff',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#94a3b8';
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                        <div>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: rConfig.bgColor,
                            color: rConfig.color,
                            border: `1px solid ${rConfig.borderColor}`,
                            marginRight: '6px'
                          }}>
                            <Icon size={12} /> {rConfig.label}
                          </span>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                            {flag.student_name}
                          </strong>
                        </div>
                        {getStatusBadge(flag.status)}
                      </div>

                      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '6px', lineHeight: '1.4' }}>
                        {flag.description.length > 95 ? `${flag.description.substring(0, 95)}...` : flag.description}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                        <span>PRN: {flag.student_prn || 'N/A'} • {flag.panel_name || 'Panel'}</span>
                        <span>{flag.created_at ? new Date(flag.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                      </div>

                      {flag.admin_notes && (
                        <div style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          background: '#f0fdf4',
                          borderLeft: '3px solid #059669',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#065f46'
                        }}>
                          <strong>Admin Feedback:</strong> {flag.admin_notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: DETAILED FLAG VIEW ── */}
      {selectedFlagDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '560px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#e11d48" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Red Flag Details #{selectedFlagDetails.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFlagDetails(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: isMobile ? '16px' : '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: isMobile ? '78vh' : '70vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Raised on: {new Date(selectedFlagDetails.created_at).toLocaleString('en-IN')}
                </span>
                {getStatusBadge(selectedFlagDetails.status)}
              </div>

              {/* Student info box */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                  {selectedFlagDetails.student_name}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#475569'
                }}>
                  <div><strong>PRN:</strong> {selectedFlagDetails.student_prn || 'N/A'}</div>
                  <div><strong>Email:</strong> {selectedFlagDetails.student_email || 'N/A'}</div>
                  <div><strong>Panel:</strong> {selectedFlagDetails.panel_name || 'N/A'}</div>
                  <div><strong>Batch:</strong> {selectedFlagDetails.batch_name || 'N/A'}</div>
                  <div><strong>Dept:</strong> {selectedFlagDetails.department || 'N/A'}</div>
                  <div><strong>School:</strong> {selectedFlagDetails.school || 'N/A'}</div>
                </div>
              </div>

              {/* Reason & Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Category & Details
                </label>
                <div style={{ display: 'inline-block', marginBottom: '8px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: '#ffe4e6',
                    color: '#dc2626',
                    border: '1px solid #fecdd3'
                  }}>
                    {selectedFlagDetails.reason}
                  </span>
                </div>
                <div style={{
                  padding: '12px',
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#1e293b',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedFlagDetails.description}
                </div>
              </div>

              {/* Admin Feedback */}
              {selectedFlagDetails.admin_notes && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#047857', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Admin Review & Notes
                  </label>
                  <div style={{
                    padding: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#065f46',
                    lineHeight: '1.5'
                  }}>
                    {selectedFlagDetails.admin_notes}
                    <div style={{ fontSize: '11px', color: '#047857', marginTop: '6px', fontStyle: 'italic' }}>
                      Reviewed by {selectedFlagDetails.reviewed_by_name || 'RI Admin'} on {selectedFlagDetails.reviewed_at ? new Date(selectedFlagDetails.reviewed_at).toLocaleString('en-IN') : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedFlagDetails(null)}
                style={{
                  padding: '8px 18px',
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
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
