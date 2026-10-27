import React, { useState, useEffect } from 'react'
import { Plus, Edit, Mail, Trash2, RotateCcw, RefreshCw, Save, X } from 'lucide-react'

function Modal({ open, onClose, title, children, size = '', hideHeader = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`} style={{ maxWidth: '94vw', width: '600px', boxSizing: 'border-box' }}>
        {!hideHeader && (
          <div className="modal-header" style={{ padding: '16px 20px' }}>
            <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
            <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 4, cursor: 'pointer' }}><X size={18} /></button>
          </div>
        )}
        <div className="modal-body" style={hideHeader ? { padding: '20px' } : { padding: '16px 20px' }}>{children}</div>
      </div>
    </div>
  )
}

const safeParseJSON = (val, defaultVal = []) => {
  if (!val) return defaultVal
  if (typeof val === 'object' && val !== null) return val
  try {
    return JSON.parse(val)
  } catch (e) {
    return defaultVal
  }
}

export default function EmailsTab({ token, apiBase, showToast, batches, readonly }) {
  const [emailSubTab, setEmailSubTab] = useState('templates') // 'templates', 'schedule', 'history', 'report'
  const [emailTemplates, setEmailTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const [emailHistory, setEmailHistory] = useState([])
  const [emailHistoryCount, setEmailHistoryCount] = useState(0)
  const [emailHistoryStatus, setEmailHistoryStatus] = useState('')
  const [emailHistorySearch, setEmailHistorySearch] = useState('')
  const [emailHistoryPage, setEmailHistoryPage] = useState(1)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [deliveryReport, setDeliveryReport] = useState(null)
  const [loadingDeliveryReport, setLoadingDeliveryReport] = useState(false)

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showTemplateModal, setShowTemplateModal] = useState(null) // 'preview', 'create', 'edit'

  const [emailTemplateForm, setEmailTemplateForm] = useState({
    name: '', category: 'general', subject: '', body_html: '', variables: []
  })
  const [scheduleForm, setScheduleForm] = useState({
    batchId: '', role: '', customVariables: {}, scheduledAt: ''
  })
  const [sendingSchedule, setSendingSchedule] = useState(false)

  const fetchEmailTemplates = async () => {
    if (!token) return
    try {
      setLoadingTemplates(true)
      const res = await fetch(`${apiBase}/api/superadmin/emails/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setEmailTemplates(data.templates || [])
      } else {
        showToast(data.message || 'Failed to load templates', 'error')
      }
    } catch (err) {
      showToast('Error loading email templates', 'error')
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleCreateOrUpdateTemplate = async (e) => {
    if (e) e.preventDefault()
    if (!token) return
    try {
      const isEdit = !!selectedTemplate
      const url = isEdit
        ? `${apiBase}/api/superadmin/emails/templates/${selectedTemplate.id}`
        : `${apiBase}/api/superadmin/emails/templates`
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(emailTemplateForm)
      })
      const data = await res.json()
      if (res.ok) {
        showToast(isEdit ? 'Template updated successfully' : 'Template created successfully', 'success')
        setShowTemplateModal(null)
        fetchEmailTemplates()
      } else {
        showToast(data.message || 'Failed to save template', 'error')
      }
    } catch (err) {
      showToast('Error saving template', 'error')
    }
  }

  const handleDeleteTemplate = async (id) => {
    if (!token) return
    if (!window.confirm('Are you sure you want to delete this template?')) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/emails/templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Template deleted successfully', 'success')
        fetchEmailTemplates()
      } else {
        showToast(data.message || 'Failed to delete template', 'error')
      }
    } catch (err) {
      showToast('Error deleting template', 'error')
    }
  }

  const handleScheduleEmailsSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!token || !selectedTemplate) return
    try {
      setSendingSchedule(true)
      const res = await fetch(`${apiBase}/api/superadmin/emails/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          batchId: scheduleForm.batchId || undefined,
          role: scheduleForm.role || undefined,
          customVariables: scheduleForm.customVariables,
          scheduledAt: scheduleForm.scheduledAt || undefined
        })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Emails scheduled successfully', 'success')
        setEmailSubTab('history')
        fetchEmailHistory()
      } else {
        showToast(data.message || 'Failed to schedule emails', 'error')
      }
    } catch (err) {
      showToast('Error scheduling emails', 'error')
    } finally {
      setSendingSchedule(false)
    }
  }

  const fetchEmailHistory = async () => {
    if (!token) return
    try {
      setLoadingHistory(true)
      const statusFilter = emailHistoryStatus ? `&status=${emailHistoryStatus}` : ''
      const searchFilter = emailHistorySearch ? `&search=${encodeURIComponent(emailHistorySearch)}` : ''
      const limit = 50
      const offset = (emailHistoryPage - 1) * limit
      const res = await fetch(`${apiBase}/api/superadmin/emails/history?limit=${limit}&offset=${offset}${statusFilter}${searchFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setEmailHistory(data.emails || [])
        setEmailHistoryCount(data.total || 0)
      } else {
        showToast(data.message || 'Failed to load email history', 'error')
      }
    } catch (err) {
      showToast('Error loading email history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchDeliveryReport = async () => {
    if (!token) return
    try {
      setLoadingDeliveryReport(true)
      const res = await fetch(`${apiBase}/api/superadmin/emails/delivery-report`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setDeliveryReport(data)
      } else {
        showToast(data.message || 'Failed to load delivery report', 'error')
      }
    } catch (err) {
      showToast('Error loading delivery report', 'error')
    } finally {
      setLoadingDeliveryReport(false)
    }
  }

  const handleResendFailedEmails = async (ids = null) => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/emails/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Failed emails re-queued successfully', 'success')
        if (emailSubTab === 'history') fetchEmailHistory()
        if (emailSubTab === 'report') fetchDeliveryReport()
      } else {
        showToast(data.message || 'Failed to resend emails', 'error')
      }
    } catch (err) {
      showToast('Error resending failed emails', 'error')
    }
  }

  useEffect(() => {
    if (emailSubTab === 'templates') {
      fetchEmailTemplates()
    } else if (emailSubTab === 'history') {
      fetchEmailHistory()
    } else if (emailSubTab === 'report') {
      fetchDeliveryReport()
    }
  }, [emailSubTab, emailHistoryPage, emailHistoryStatus])

  return (
    <div className="emails-console-root">
      {/* ── Responsive Mobile CSS Rules ── */}
      <style>{`
        .emails-console-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          word-break: break-word;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .emails-subtab-bar {
          display: flex;
          gap: 6px;
          border-bottom: 2px solid var(--border);
          padding-bottom: 2px;
          overflow-x: auto;
          white-space: nowrap;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .emails-subtab-bar::-webkit-scrollbar {
          display: none;
        }

        .emails-subtab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .emails-glass-card {
          background: #ffffff;
          border-radius: 14px;
          border: 1px solid var(--border);
          padding: 20px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
          box-sizing: border-box;
          width: 100%;
          max-width: 100%;
          overflow: hidden;
        }

        .emails-header-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .emails-filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          max-width: 100%;
          box-sizing: border-box;
        }

        .emails-input-search {
          margin-bottom: 0;
          border-radius: 50px;
          font-size: 12px;
          width: 200px;
          max-width: 100%;
          box-sizing: border-box;
        }

        .emails-select-status {
          margin-bottom: 0;
          border-radius: 50px;
          font-size: 12px;
          width: 140px;
          max-width: 100%;
          box-sizing: border-box;
        }

        .emails-table-responsive {
          overflow-x: auto;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          -webkit-overflow-scrolling: touch;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .emails-grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .emails-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        /* ── Mobile Adaptation Media Queries ── */
        @media (max-width: 768px) {
          .emails-glass-card {
            padding: 16px !important;
            border-radius: 12px !important;
          }

          .emails-header-flex {
            flex-direction: column;
            align-items: flex-start;
          }

          .emails-filter-row {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .emails-input-search, .emails-select-status {
            width: 100% !important;
          }

          .emails-grid-2col {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 480px) {
          .emails-subtab-btn {
            padding: 8px 12px !important;
            font-size: 12px !important;
          }

          .emails-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* Sub-tab Bar */}
      <div className="emails-subtab-bar">
        {[
          ['templates','Templates'],
          ['schedule','Schedule'],
          ['history','Sent History'],
          ['report','Reports']
        ].map(([k,l]) => (
          <button 
            key={k} 
            className="emails-subtab-btn"
            onClick={() => setEmailSubTab(k)} 
            style={{ 
              color: emailSubTab === k ? '#2563eb' : 'var(--text-3)', 
              borderBottom: emailSubTab === k ? '2.5px solid #2563eb' : '2.5px solid transparent'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* TEMPLATES SUB-TAB */}
      {emailSubTab === 'templates' && (
        <div className="emails-glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="emails-header-flex">
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '850', color: 'var(--text)' }}>Email Templates</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>Manage reusable email layouts, categories, and custom template variables.</p>
            </div>
            {!readonly && (
              <button onClick={() => { setSelectedTemplate(null); setEmailTemplateForm({ name:'', category:'general', subject:'', body_html:'', variables:[] }); setShowTemplateModal('create'); }} className="btn btn-primary" style={{ borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14}/> Create Template</button>
            )}
          </div>
          {loadingTemplates ? <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"/></div> : (
            <div className="emails-table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '650px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Template Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Subject Line</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Variables</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: 'var(--text)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailTemplates.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
                        No templates found. Create your first template.
                      </td>
                    </tr>
                  ) : (
                    emailTemplates.map((t, idx) => {
                      const templateVars = safeParseJSON(t.variables, []);
                      return (
                        <tr key={t.id} style={{ 
                          borderBottom: '1px solid var(--border)', 
                          background: idx % 2 === 0 ? '#fff' : '#fafafa',
                          transition: 'background 0.15s ease'
                        }}>
                          <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: '750', color: 'var(--text)', fontSize: '13.5px' }}>{t.name}</div>
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ 
                                fontSize: '10px', 
                                background: '#e0e7ff', 
                                color: '#4338ca', 
                                borderRadius: '50px', 
                                padding: '2px 8px', 
                                fontWeight: '750', 
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                              }}>
                                {t.category}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', color: 'var(--text-2)', verticalAlign: 'middle', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>
                            {t.subject}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              {templateVars.length === 0 ? (
                                <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>—</span>
                              ) : (
                                templateVars.map(v => (
                                  <span key={v} style={{ 
                                    background: '#f1f5f9', 
                                    color: '#475569', 
                                    borderRadius: '4px', 
                                    padding: '1px 6px', 
                                    fontSize: '11px', 
                                    fontWeight: '650',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    {`{{${v}}}`}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{ 
                              fontSize: '10.5px', 
                              color: t.is_active ? '#16a34a' : '#dc2626', 
                              background: t.is_active ? '#e8f5e9' : '#ffebee',
                              padding: '3px 10px',
                              borderRadius: '50px',
                              fontWeight: '750',
                              letterSpacing: '0.3px'
                            }}>
                              {t.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button onClick={() => { setSelectedTemplate(t); setShowTemplateModal('preview'); }} className="btn btn-outline btn-sm" style={{ fontSize: '11px', borderRadius: '50px' }}>Preview</button>
                              {!readonly && (
                                <>
                                  <button onClick={() => { setSelectedTemplate(t); setEmailTemplateForm({ name: t.name, category: t.category, subject: t.subject, body_html: t.body_html, variables: safeParseJSON(t.variables, []) }); setShowTemplateModal('edit'); }} className="btn btn-outline btn-sm" style={{ fontSize: '11px', borderRadius: '50px' }}><Edit size={11}/> Edit</button>
                                  <button onClick={() => { 
                                    setSelectedTemplate(t); 
                                    const vars = safeParseJSON(t.variables, []);
                                    const initialVars = {};
                                    vars.forEach(v => {
                                      if (v === 'google_form_link') {
                                        initialVars[v] = 'https://docs.google.com/forms/d/1bKFvzf-sAROZJYV73c0FLGIRd3P6R3jjTsRMx6G4x-c/preview';
                                      } else {
                                        initialVars[v] = '';
                                      }
                                    });
                                    setScheduleForm({ batchId:'', role:'', customVariables: initialVars, scheduledAt:'' }); 
                                    setEmailSubTab('schedule'); 
                                  }} className="btn btn-primary btn-sm" style={{ fontSize: '11px' }}><Mail size={11}/> Send</button>
                                  <button onClick={() => handleDeleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px' }}><Trash2 size={13}/></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SCHEDULE SUB-TAB */}
      {emailSubTab === 'schedule' && (
        <div className="emails-glass-card">
          <h3 style={{ margin: '0 0 20px 0', fontSize: '15px', fontWeight: '800' }}>Schedule Emails</h3>
          <form onSubmit={handleScheduleEmailsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', width: '100%' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Select Template *</label>
              <select className="input-field" style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }} required value={selectedTemplate?.id || ''} 
                onChange={e => {
                  const t = emailTemplates.find(tmpl => tmpl.id == e.target.value) || null
                  setSelectedTemplate(t)
                  const vars = safeParseJSON(t?.variables, [])
                  const initialVars = {}
                  vars.forEach(v => {
                    if (v === 'google_form_link') {
                      initialVars[v] = 'https://docs.google.com/forms/d/1bKFvzf-sAROZJYV73c0FLGIRd3P6R3jjTsRMx6G4x-c/preview'
                    } else {
                      initialVars[v] = ''
                    }
                  })
                  setScheduleForm(p => ({ ...p, customVariables: initialVars }))
                }}>
                <option value="">-- Select a Template --</option>
                {emailTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Filter by Batch (optional)</label>
              <select className="input-field" style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }} value={scheduleForm.batchId} onChange={e => setScheduleForm(p => ({ ...p, batchId: e.target.value }))}>
                <option value="">All Batches</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Filter by Role (optional)</label>
              <select className="input-field" style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }} value={scheduleForm.role} onChange={e => setScheduleForm(p => ({ ...p, role: e.target.value }))}>
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="ltc">LTC Members</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Schedule Time (optional — blank = send now)</label>
              <input type="datetime-local" className="input-field" style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }} value={scheduleForm.scheduledAt} onChange={e => setScheduleForm(p => ({ ...p, scheduledAt: e.target.value }))} />
            </div>
            {selectedTemplate && (() => {
              const vars = safeParseJSON(selectedTemplate.variables, []).filter(v => v !== 'name')
              return vars.length > 0 ? (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '10px' }}>Template Variables</div>
                  {vars.map(v => (
                    <div key={v} style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>{`{{${v}}}`}</label>
                      <input type="text" className="input-field" style={{ marginBottom: 0, borderRadius: '50px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} placeholder={`Value for ${v}`} value={scheduleForm.customVariables[v] || ''} onChange={e => setScheduleForm(p => ({ ...p, customVariables: { ...p.customVariables, [v]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              ) : null
            })()}
            <button type="submit" disabled={sendingSchedule || !selectedTemplate || readonly} className="btn btn-primary" style={{ borderRadius: '50px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: readonly ? 'not-allowed' : 'pointer', opacity: readonly ? 0.6 : 1, width: '100%' }}>
              <Mail size={15}/> {readonly ? 'Queue & Send (Disabled)' : (sendingSchedule ? 'Queuing Emails...' : 'Queue & Send Emails')}
            </button>
          </form>
        </div>
      )}

      {/* EMAIL HISTORY SUB-TAB */}
      {emailSubTab === 'history' && (
        <div className="emails-glass-card">
          <div className="emails-header-flex" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>Email History ({emailHistoryCount})</h3>
            <div className="emails-filter-row">
              <input type="text" placeholder="Search email or subject..." className="input-field emails-input-search" value={emailHistorySearch} onChange={e => setEmailHistorySearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchEmailHistory()} />
              <select className="input-field emails-select-status" value={emailHistoryStatus} onChange={e => { setEmailHistoryStatus(e.target.value); setEmailHistoryPage(1); }}>
                <option value="">All Status</option>
                <option value="sent">Sent</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="permanent_fail">Permanent Fail</option>
              </select>
              <div style={{ display: 'flex', gap: '6px' }}>
                {!readonly && (
                  <button onClick={() => handleResendFailedEmails()} className="btn btn-outline btn-sm" style={{ borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}><RotateCcw size={12}/> Resend Failed</button>
                )}
                <button onClick={fetchEmailHistory} className="btn btn-outline btn-sm" style={{ borderRadius: '50px' }}><RefreshCw size={12}/></button>
              </div>
            </div>
          </div>
          {loadingHistory ? <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"/></div> : (
            <div className="emails-table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>To</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Subject</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Attempts</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Sent At</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Error</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: 'var(--text)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emailHistory.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>
                        No email history found.
                      </td>
                    </tr>
                  ) : (
                    emailHistory.map((e, idx) => (
                      <tr key={e.id} style={{ 
                        borderBottom: '1px solid var(--border)', 
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        transition: 'background 0.15s ease'
                      }}>
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{e.to_email}</td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-2)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.subject}>{e.subject}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            fontSize: '10.5px', 
                            fontWeight: '700', 
                            borderRadius: '50px', 
                            padding: '3px 10px', 
                            background: e.status === 'sent' ? '#dcfce7' : e.status === 'pending' ? '#fef9c3' : e.status === 'processing' ? '#dbeafe' : '#fee2e2', 
                            color: e.status === 'sent' ? '#16a34a' : e.status === 'pending' ? '#a16207' : e.status === 'processing' ? '#1d4ed8' : '#dc2626' 
                          }}>
                            {e.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-2)' }}>{e.attempts}/{e.max_attempts}</td>
                        <td style={{ padding: '12px 16px', fontSize: '11.5px', color: 'var(--text-3)' }}>{e.updated_at ? new Date(e.updated_at).toLocaleString() : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '11.5px', color: '#dc2626', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.error_message}>{e.error_message || '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          {['failed','permanent_fail'].includes(e.status) && !readonly && (
                            <button onClick={() => handleResendFailedEmails([e.id])} 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Resend Email">
                              <RotateCcw size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <button disabled={emailHistoryPage <= 1} onClick={() => setEmailHistoryPage(p => p - 1)} className="btn btn-outline btn-sm" style={{ borderRadius: '50px' }}>Prev</button>
            <span style={{ fontSize: '12px', padding: '6px 12px', fontWeight: '700' }}>Page {emailHistoryPage}</span>
            <button disabled={emailHistory.length < 50} onClick={() => setEmailHistoryPage(p => p + 1)} className="btn btn-outline btn-sm" style={{ borderRadius: '50px' }}>Next</button>
          </div>
        </div>
      )}

      {/* DELIVERY REPORT SUB-TAB */}
      {emailSubTab === 'report' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
            {!readonly && (
              <button onClick={() => handleResendFailedEmails()} className="btn btn-outline" style={{ borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}><RotateCcw size={13}/> Resend All Failed</button>
            )}
            <button onClick={fetchDeliveryReport} className="btn btn-outline" style={{ borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}><RefreshCw size={13}/> Refresh</button>
          </div>
          {loadingDeliveryReport ? <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner"/></div> : deliveryReport ? (
            <>
              <div className="emails-stats-grid">
                {[
                  { label: 'Total Emails', value: deliveryReport.summary.totalAll, color: 'var(--primary)' },
                  { label: 'Delivered', value: deliveryReport.summary.totalSent, color: '#16a34a' },
                  { label: 'Pending', value: deliveryReport.summary.totalPending, color: '#d97706' },
                  { label: 'Failed', value: deliveryReport.summary.totalFailed, color: '#dc2626' },
                  { label: 'Delivery Rate', value: deliveryReport.summary.deliveryRate + '%', color: '#16a34a' },
                  { label: 'Bounce Rate', value: deliveryReport.summary.bounceRate + '%', color: '#dc2626' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: '850', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: '700', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {deliveryReport.topBouncedAddresses?.length > 0 && (
                <div className="emails-glass-card">
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '800', color: '#dc2626' }}>Top Bounced Addresses</h4>
                  <div className="emails-table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '550px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Email Address</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Fail Count</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Last Error</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: 'var(--text)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryReport.topBouncedAddresses.map((b, i) => (
                          <tr key={i} style={{ 
                            borderBottom: '1px solid var(--border)', 
                            background: i % 2 === 0 ? '#fff' : '#fafafa',
                            transition: 'background 0.15s ease'
                          }}>
                            <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{b.to_email}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#dc2626' }}>{b.fail_count}</td>
                            <td style={{ padding: '10px 14px', fontSize: '11.5px', color: 'var(--text-3)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.last_error}>{b.last_error || '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              {!readonly ? (
                                <button onClick={() => handleResendFailedEmails()} className="btn btn-outline btn-sm" style={{ fontSize: '11px', borderRadius: '50px', padding: '3px 10px' }}>Retry</button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-4)', fontStyle: 'italic' }}>View-Only</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {deliveryReport.dailyTrend?.length > 0 && (
                <div className="emails-glass-card">
                  <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '800' }}>Daily Send Trend (Last 30 Days)</h4>
                  <div className="emails-table-responsive">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '500px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800', color: 'var(--text)' }}>Date</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Total</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Sent</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Failed</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: 'var(--text)' }}>Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryReport.dailyTrend.map((d, i) => (
                          <tr key={i} style={{ 
                            borderBottom: '1px solid var(--border)', 
                            background: i % 2 === 0 ? '#fff' : '#fafafa',
                            transition: 'background 0.15s ease'
                          }}>
                            <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{new Date(d.date).toLocaleDateString()}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text)' }}>{d.total}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{d.sent}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#dc2626', fontWeight: '700' }}>{d.failed}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#d97706', fontWeight: '700' }}>{d.pending}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>No report data available.</div>}
        </div>
      )}

      {/* MODALS */}
      {showTemplateModal === 'preview' && selectedTemplate && (
        <Modal open={true} onClose={() => setShowTemplateModal(null)} title={selectedTemplate.name}>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>Subject: <strong>{selectedTemplate.subject}</strong></div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', background: '#f8fafc', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: selectedTemplate.body_html }} />
          {safeParseJSON(selectedTemplate.variables, []).length > 0 && (
            <div style={{ marginTop: '16px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>Variables: </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {safeParseJSON(selectedTemplate.variables, []).map(v => <span key={v} style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: '50px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>{`{{${v}}}`}</span>)}
              </div>
            </div>
          )}
        </Modal>
      )}

      {(showTemplateModal === 'create' || showTemplateModal === 'edit') && (
        <Modal open={true} onClose={() => setShowTemplateModal(null)} title={showTemplateModal === 'edit' ? 'Edit Template' : 'Create Template'}>
          <form onSubmit={handleCreateOrUpdateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="emails-grid-2col">
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700' }}>Template Name *</label>
                <input required className="input-field" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }} value={emailTemplateForm.name} onChange={e => setEmailTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Welcome Email" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700' }}>Category</label>
                <select className="input-field" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }} value={emailTemplateForm.category} onChange={e => setEmailTemplateForm(p => ({ ...p, category: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="Faculty Communication">Faculty Communication</option>
                  <option value="welcome">Welcome</option>
                  <option value="orientation">Orientation</option>
                  <option value="travel">Travel</option>
                  <option value="reminder">Reminder</option>
                  <option value="certificate">Certificate</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700' }}>Subject Line *</label>
              <input required className="input-field" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }} value={emailTemplateForm.subject} onChange={e => setEmailTemplateForm(p => ({ ...p, subject: e.target.value }))} placeholder="Use {{variable}} for dynamic fields" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700' }}>HTML Body *</label>
              <textarea required className="input-field" style={{ marginBottom: 0, borderRadius: '12px', minHeight: '180px', fontFamily: 'monospace', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} value={emailTemplateForm.body_html} onChange={e => setEmailTemplateForm(p => ({ ...p, body_html: e.target.value }))} placeholder="<h2>Dear {{name}},</h2><p>Your message here...</p>" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '700' }}>Variable Names (comma-separated)</label>
              <input className="input-field" style={{ marginBottom: 0, width: '100%', boxSizing: 'border-box' }} value={(emailTemplateForm.variables || []).join(',')} onChange={e => setEmailTemplateForm(p => ({ ...p, variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} placeholder="name, batch_name, start_date" />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowTemplateModal(null)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Save size={13}/> {showTemplateModal === 'edit' ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
