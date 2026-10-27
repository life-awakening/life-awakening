import React, { useState, useEffect, useCallback } from 'react';
import API_BASE_URL from '@/config/apiConfig';
import {
  LifeBuoy,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  RefreshCw,
  Send,
  HelpCircle,
  X,
  ShieldCheck,
  Building,
  Users,
  Briefcase
} from 'lucide-react';

const API = API_BASE_URL;

export default function RiFacultySupportTab({ token, isMobile: propIsMobile }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(() => propIsMobile ?? (typeof window !== 'undefined' && window.innerWidth <= 768));

  useEffect(() => {
    if (propIsMobile !== undefined) {
      setIsMobile(propIsMobile);
    } else {
      const handleResize = () => setIsMobile(window.innerWidth <= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [propIsMobile]);

  // Form State
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [category, setCategory] = useState('Problem');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal State for full screenshot preview
  const [viewingScreenshot, setViewingScreenshot] = useState(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/ri/support/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (err) {
      console.error('Error fetching faculty RI tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Screenshot size should be less than 2MB.');
        return;
      }
      setScreenshotName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalSubject = subject === 'Other' ? customSubject.trim() : subject;

    if (!finalSubject) {
      setMessage({ type: 'error', text: 'Please select or enter a subject for your ticket.' });
      return;
    }

    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Please provide a detailed description of the issue.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API}/api/ri/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: finalSubject,
          description: description.trim(),
          category,
          priority,
          screenshot: screenshot || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Support ticket #RI-${data.ticketId} submitted successfully! The RI Admin team has been notified.`
        });
        setSubject('');
        setCustomSubject('');
        setDescription('');
        setCategory('Problem');
        setPriority('Medium');
        setScreenshot(null);
        setScreenshotName('');
        fetchTickets();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit ticket.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error submitting support ticket. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', maxWidth: '840px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Creation Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#047857',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <LifeBuoy size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: isMobile ? '16.5px' : '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Faculty Mentor Support &amp; Helpdesk
            </h2>
            <p style={{ fontSize: isMobile ? '12px' : '13px', color: '#64748b', margin: '2px 0 0 0', lineHeight: 1.4 }}>
              Report operational queries regarding panel attendance lock, village nodal coordination, student evaluations, or logistics.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
          {/* Priority, Category & Subject Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13.5px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontWeight: '500'
                }}
              >
                <option value="Problem">General Operational Issue</option>
                <option value="Attendance Lock">Attendance / Lock Correction</option>
                <option value="Village Coordination">Village / Nodal Officer Query</option>
                <option value="Evaluation / Grading">Student Evaluation &amp; Grading</option>
                <option value="Transit & Logistics">Bus Transit &amp; Field Logistics</option>
                <option value="Faculty Undertaking">Undertaking Form</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Priority *
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13.5px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontWeight: '500'
                }}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Subject / Issue *
              </label>
              <select
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  if (e.target.value !== 'Other') setCustomSubject('');
                }}
                required
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13.5px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontWeight: '500'
                }}
              >
                <option value="">-- Select Subject --</option>
                <option value="Panel Attendance Lock Unlock Request">Request to unlock Day 1 / Day 2 Attendance for Panel</option>
                <option value="Student Roster / Panel Mismatch">Student missing or allocated to incorrect panel</option>
                <option value="Village Sarpanch / Nodal Officer Contact Query">Village nodal contact update</option>
                <option value="Student Evaluation Correction">Request to update submitted evaluation marks</option>
                <option value="Bus Transit & Village Arrival Delay">Transit delay / schedule timing issue</option>
                <option value="Other">Other (Specify below)</option>
              </select>
            </div>
          </div>

          {subject === 'Other' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Specify Custom Subject *
              </label>
              <input
                type="text"
                placeholder="e.g. Base camp accommodation query / Emergency contact issue"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13.5px',
                  padding: '0 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Detailed Description *
            </label>
            <textarea
              placeholder="Provide specific details including Panel Number, Student PRNs, or Village name if applicable..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{
                width: '100%',
                minHeight: '110px',
                fontSize: '13.5px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: '1.5'
              }}
            />
          </div>

          {message.text && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
                color: message.type === 'error' ? '#dc2626' : '#15803d',
                border: message.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0'
              }}
            >
              {message.text}
            </div>
          )}

          {/* Footer Bar: Screenshot Attachment & Submit */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id="ri-faculty-screenshot"
                onChange={handleFileChange}
              />
              <label
                htmlFor="ri-faculty-screenshot"
                style={{
                  width: isMobile ? '100%' : 'auto',
                  boxSizing: 'border-box',
                  justifyContent: 'center',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s'
                }}
              >
                <ImageIcon size={15} color="#047857" />
                <span>{screenshotName ? 'Change Screenshot' : 'Attach Screenshot'}</span>
              </label>

              {screenshotName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '600', color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {screenshotName}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', padding: '0 4px' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: isMobile ? '100%' : 'auto',
                justifyContent: 'center',
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '11px 24px',
                fontWeight: '750',
                fontSize: '13.5px',
                borderRadius: '8px',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                boxShadow: '0 2px 4px rgba(4,120,87,0.25)',
                transition: 'opacity 0.15s'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Previously Raised Tickets */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#f1f5f9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '750', color: '#0f172a', margin: 0 }}>
                My Raised Support Requests
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Track status and administrative responses to your requests.
              </p>
            </div>
          </div>

          <button
            onClick={fetchTickets}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '600'
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
            <span style={{ fontSize: '13px' }}>Loading your tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13.5px' }}>
            No support requests raised yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {tickets.map(t => {
              const isResolved = t.status === 'resolved';
              const isInProgress = t.status === 'in_progress';

              return (
                <div
                  key={t.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#047857', fontFamily: 'monospace', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                        #RI-{t.id}
                      </span>
                      {t.category && (
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          {t.category}
                        </span>
                      )}
                      {t.priority && t.priority !== 'Medium' && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: t.priority === 'Urgent' ? '#fee2e2' : '#ffedd5',
                          color: t.priority === 'Urgent' ? '#991b1b' : '#9a3412'
                        }}>
                          {t.priority}
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(t.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      textTransform: 'uppercase',
                      backgroundColor: isResolved ? '#dcfce7' : isInProgress ? '#dbeafe' : '#fef3c7',
                      color: isResolved ? '#15803d' : isInProgress ? '#1d4ed8' : '#b45309',
                      border: isResolved ? '1px solid #86efac' : isInProgress ? '1px solid #93c5fd' : '1px solid #fde047'
                    }}>
                      {isResolved ? 'Resolved' : isInProgress ? 'In Progress' : 'Pending'}
                    </span>
                  </div>

                  {/* Subject & Description */}
                  <div>
                    <h4 style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
                      {t.subject}
                    </h4>
                    <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {t.description}
                    </p>
                  </div>

                  {/* Screenshot button */}
                  {t.screenshot && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setViewingScreenshot(t.screenshot)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <ImageIcon size={13} color="#047857" />
                        <span>View Attached Screenshot</span>
                      </button>
                    </div>
                  )}

                  {/* Resolution Box */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '2px' }}>
                    {isResolved ? (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                          <strong style={{ color: '#166534', fontSize: '12px', textTransform: 'uppercase' }}>
                            Resolved by {t.resolved_by_name || 'RI Admin'}
                          </strong>
                          {t.resolved_at && (
                            <span style={{ color: '#475569', fontSize: '11px' }}>
                              {new Date(t.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#14532d', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                          "{t.resolution}"
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Pending review and action by the Rural Immersion administration.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Viewer Modal */}
      {viewingScreenshot && (
        <div
          onClick={() => setViewingScreenshot(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>Attached Screenshot</span>
              <button
                onClick={() => setViewingScreenshot(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px', textAlign: 'center', maxHeight: '75vh', overflowY: 'auto' }}>
              <img
                src={viewingScreenshot}
                alt="Full Attachment"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
