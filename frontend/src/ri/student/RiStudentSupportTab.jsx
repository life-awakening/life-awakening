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
  X,
  Check,
  Tag,
  Calendar,
  UserCheck
} from 'lucide-react';

const API = API_BASE_URL;

export default function RiStudentSupportTab({ token }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  // Form State
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [category, setCategory] = useState('Problem');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Modal State for full screenshot preview
  const [viewingScreenshot, setViewingScreenshot] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      console.error('Error fetching student RI tickets:', err);
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
      setMessage({ type: 'error', text: 'Please select or specify a subject for your ticket.' });
      return;
    }

    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Please enter a description of the issue.' });
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
          priority: 'Medium',
          screenshot: screenshot || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Support ticket #RI-${data.ticketId} raised successfully! The RI team has been notified.`
        });
        setSubject('');
        setCustomSubject('');
        setDescription('');
        setCategory('Problem');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '22px', maxWidth: '880px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ── Top Creation Card ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: isMobile ? '12px' : '14px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px' : '22px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', marginBottom: '4px' }}>
          <div
            style={{
              width: isMobile ? '36px' : '42px',
              height: isMobile ? '36px' : '42px',
              borderRadius: '10px',
              background: '#047857',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 5px rgba(4, 120, 87, 0.2)'
            }}
          >
            <LifeBuoy size={isMobile ? 18 : 20} strokeWidth={2.2} />
          </div>
          <div>
            <h2 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
              Raise an RI Support Ticket
            </h2>
            <p style={{ fontSize: isMobile ? '11.5px' : '13px', color: '#64748b', margin: '2px 0 0 0', lineHeight: 1.35 }}>
              Submit queries regarding village allocation, panel teams, attendance, or student profile details.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '14px', marginTop: '16px' }}>
          {/* Category & Subject Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontWeight: '500'
                }}
              >
                <option value="Problem">General Problem / Query</option>
                <option value="Data Correction">Personal / PRN Data Correction</option>
                <option value="Panel / Village">Panel &amp; Village Allocation</option>
                <option value="Attendance Query">Day 1 / Day 2 Attendance</option>
                <option value="Evaluation / Forms">RI Forms &amp; Evaluation</option>
                <option value="Undertaking">Undertaking Form</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
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
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a',
                  fontWeight: '500'
                }}
              >
                <option value="">-- Select Subject --</option>
                <option value="Incorrect Full Name / PRN">Full Name or PRN is incorrect</option>
                <option value="Incorrect Email / Phone Number">Email Address or Phone Number is incorrect</option>
                <option value="Panel / Village Allocation Issue">Panel or Allocated Village mismatch</option>
                <option value="Day 1 Attendance Not Marked">Day 1 Attendance discrepancy</option>
                <option value="Day 2 Attendance Not Marked">Day 2 Attendance discrepancy</option>
                <option value="Form Submission Issue">Issue submitting RI Student Forms</option>
                <option value="Undertaking Form Not Verifying">Undertaking signature / submission error</option>
                <option value="Other">Other (Specify below)</option>
              </select>
            </div>
          </div>

          {subject === 'Other' && (
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Specify Custom Subject *
              </label>
              <input
                type="text"
                placeholder="e.g. Mentor allocation not visible / Village transit query"
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                required
                style={{
                  width: '100%',
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0f172a'
                }}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Detailed Description *
            </label>
            <textarea
              placeholder="Describe your issue or what needs correction clearly..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{
                width: '100%',
                minHeight: isMobile ? '90px' : '100px',
                fontSize: '13px',
                padding: '10px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '7px',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: '1.5',
                color: '#0f172a'
              }}
            />
          </div>

          {message.text && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
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
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: '10px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id="ri-student-screenshot"
                onChange={handleFileChange}
              />
              <label
                htmlFor="ri-student-screenshot"
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.15s'
                }}
              >
                <ImageIcon size={14} color="#047857" />
                <span>{screenshotName ? 'Change Screenshot' : 'Attach Screenshot'}</span>
              </label>

              {screenshotName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '5px 10px', borderRadius: '6px', fontSize: '11.5px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '600', color: '#334155', maxWidth: isMobile ? '120px' : '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {screenshotName}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 2px' }}
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
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '9px 20px',
                fontWeight: '700',
                fontSize: '13px',
                borderRadius: '7px',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(4,120,87,0.2)',
                transition: 'opacity 0.15s'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit Ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── My Raised Support Tickets Card ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: isMobile ? '12px' : '14px',
          border: '1px solid #e2e8f0',
          padding: isMobile ? '16px' : '22px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: isMobile ? '34px' : '38px',
                height: isMobile ? '34px' : '38px',
                borderRadius: '9px',
                background: '#f1f5f9',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Clock size={isMobile ? 16 : 18} />
            </div>
            <div>
              <h3 style={{ fontSize: isMobile ? '15px' : '16.5px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                My Raised Support Tickets
              </h3>
              <p style={{ fontSize: isMobile ? '11px' : '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                Track real-time status and resolutions from the RI administration.
              </p>
            </div>
          </div>

          <button
            onClick={fetchTickets}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 11px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600'
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 10px auto' }} />
            <span style={{ fontSize: '13px' }}>Loading your tickets...</span>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            No support tickets raised yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
            {tickets.map(t => {
              const isResolved = t.status === 'resolved';
              const isInProgress = t.status === 'in_progress';

              return (
                <div
                  key={t.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: isMobile ? '14px' : '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Card Top Metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#047857', fontFamily: 'monospace', background: '#ecfdf5', padding: '2px 7px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                        #RI-{t.id}
                      </span>
                      {t.category && (
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                          {t.category}
                        </span>
                      )}
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {new Date(t.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '4px',
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
                    <h4 style={{ fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 4px 0' }}>
                      {t.subject}
                    </h4>
                    <p style={{ fontSize: isMobile ? '12.5px' : '13px', color: '#334155', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
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
                          padding: '4px 9px',
                          borderRadius: '5px',
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
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '2px' }}>
                    {isResolved ? (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '7px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap', gap: '4px' }}>
                          <strong style={{ color: '#166534', fontSize: '11.5px', textTransform: 'uppercase' }}>
                            Resolved by {t.resolved_by_name || 'RI Admin'}
                          </strong>
                          {t.resolved_at && (
                            <span style={{ color: '#475569', fontSize: '11px' }}>
                              {new Date(t.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#14532d', fontSize: '12.5px', fontStyle: 'italic', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                          "{t.resolution}"
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Pending review and resolution by the Rural Immersion administration.
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
            padding: '16px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              maxWidth: '800px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Attached Screenshot</span>
              <button
                onClick={() => setViewingScreenshot(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: '14px', textAlign: 'center', maxHeight: '75vh', overflowY: 'auto' }}>
              <img
                src={viewingScreenshot}
                alt="Full Attachment"
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '5px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
