import React, { useState, useEffect } from 'react'
import { Bell, AlertTriangle, RefreshCw, History, BarChart2, Send } from 'lucide-react'

export default function NotificationsTab({ token, apiBase, showToast, batches = [] }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [notifSubTab, setNotifSubTab] = useState('compose') // 'compose', 'history', 'stats'
  
  const [notifForm, setNotifForm] = useState({
    title: '', message: '', type: 'announcement', channel: 'in-app',
    targetType: 'batch', batchId: '', squad: '', role: 'student', userId: '',
    pushAsBanner: false
  })
  const [sendingNotif, setSendingNotif] = useState(false)
  const [successBanner, setSuccessBanner] = useState(null)

  const [notifHistory, setNotifHistory] = useState([])
  const [notifHistoryTotal, setNotifHistoryTotal] = useState(0)
  const [loadingNotifHistory, setLoadingNotifHistory] = useState(false)
  const [notifTypeFilter, setNotifTypeFilter] = useState('')

  const [notifStats, setNotifStats] = useState(null)
  const [loadingNotifStats, setLoadingNotifStats] = useState(false)

  const handleSendNotification = async (e) => {
    if (e) e.preventDefault()
    if (!token) return
    try {
      setSendingNotif(true)
      const res = await fetch(`${apiBase}/api/superadmin/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: notifForm.title, message: notifForm.message,
          type: notifForm.type, channel: notifForm.channel,
          targetType: notifForm.targetType,
          batchId: notifForm.batchId || undefined,
          squad: notifForm.squad || undefined,
          role: notifForm.role || undefined,
          userId: notifForm.userId || undefined,
        })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Notification sent successfully!', 'success')
        setSuccessBanner({
          title: notifForm.title,
          message: notifForm.message,
          type: notifForm.type,
          channel: notifForm.channel,
          recipientCount: data.recipientCount || 0
        })
        if (notifForm.pushAsBanner) {
          fetch(`${apiBase}/api/superadmin/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ settings: { banner_message: `${notifForm.title}: ${notifForm.message}` } })
          }).catch(console.error)
        }
        setNotifForm(p => ({ 
          ...p, title: '', message: '', pushAsBanner: false 
        }))
        if (notifSubTab === 'history') fetchNotifHistory()
      } else {
        showToast(data.message || 'Failed to send notification', 'error')
      }
    } catch (err) {
      showToast('Error sending notification', 'error')
    } finally {
      setSendingNotif(false)
    }
  }

  const fetchNotifHistory = async () => {
    if (!token) return
    try {
      setLoadingNotifHistory(true)
      const typeQ = notifTypeFilter ? `&type=${notifTypeFilter}` : ''
      const res = await fetch(`${apiBase}/api/superadmin/notifications?limit=6${typeQ}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setNotifHistory((data.notifications || []).slice(0, 6))
        setNotifHistoryTotal(data.total || 0)
      } else {
        showToast(data.message || 'Failed to load notifications', 'error')
      }
    } catch (err) {
      showToast('Error loading notification history', 'error')
    } finally {
      setLoadingNotifHistory(false)
    }
  }

  const fetchNotifStats = async () => {
    if (!token) return
    try {
      setLoadingNotifStats(true)
      const res = await fetch(`${apiBase}/api/superadmin/notifications/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) setNotifStats(data)
    } catch (err) {
      showToast('Error loading notification stats', 'error')
    } finally {
      setLoadingNotifStats(false)
    }
  }

  useEffect(() => {
    if (notifSubTab === 'history') {
      fetchNotifHistory()
    } else if (notifSubTab === 'stats') {
      fetchNotifStats()
    }
  }, [notifSubTab, notifTypeFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Sub-tab Navigation Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #cbd5e1', paddingBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', width: isMobile ? '100%' : 'auto', background: '#f1f5f9', borderRadius: '8px', padding: '3px', border: '1px solid #cbd5e1', gap: '4px', overflowX: 'auto' }}>
          <button 
            onClick={() => setNotifSubTab('compose')}
            style={{
              flex: isMobile ? 1 : 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: notifSubTab === 'compose' ? '#224283' : 'transparent',
              color: notifSubTab === 'compose' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Send size={14} /> Send Alert
          </button>
          <button 
            onClick={() => setNotifSubTab('history')}
            style={{
              flex: isMobile ? 1 : 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: notifSubTab === 'history' ? '#224283' : 'transparent',
              color: notifSubTab === 'history' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <History size={14} /> Sent History
          </button>
          <button 
            onClick={() => setNotifSubTab('stats')}
            style={{
              flex: isMobile ? 1 : 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: notifSubTab === 'stats' ? '#224283' : 'transparent',
              color: notifSubTab === 'stats' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <BarChart2 size={14} /> Stats
          </button>
        </div>
      </div>

      {/* COMPOSE */}
      {notifSubTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
          {/* Form */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} style={{ color: '#224283' }}/> Create Notification Alert
            </h3>
            <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Title */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Title *</label>
                <input 
                  required 
                  type="text"
                  value={notifForm.title} 
                  onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))} 
                  placeholder="Enter notification headline..." 
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }} 
                />
              </div>
              {/* Message */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Message *</label>
                <textarea 
                  required 
                  value={notifForm.message} 
                  onChange={e => setNotifForm(p => ({ ...p, message: e.target.value }))} 
                  placeholder="Write your notification body message here..." 
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', minHeight: '100px', color: '#0f172a', boxSizing: 'border-box' }} 
                />
              </div>
              {/* Type & Channel row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Type</label>
                  <select 
                    value={notifForm.type} 
                    onChange={e => setNotifForm(p => ({ ...p, type: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                  >
                    <option value="announcement">Announcement</option>
                    <option value="reminder">Reminder</option>
                    <option value="alert">Alert</option>
                    <option value="emergency">Emergency</option>
                    <option value="info">Information</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Channel</label>
                  <select 
                    value={notifForm.channel} 
                    onChange={e => setNotifForm(p => ({ ...p, channel: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                  >
                    <option value="in-app">In-App Only</option>
                    <option value="email">Email Only</option>
                    <option value="both">In-App & Email Both</option>
                  </select>
                </div>
              </div>
              {/* Target */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Send To</label>
                <select 
                  value={notifForm.targetType} 
                  onChange={e => setNotifForm(p => ({ ...p, targetType: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                >
                  <option value="batch">Entire Batch</option>
                  <option value="squad">Specific Squad</option>
                  <option value="role">By Role</option>
                  <option value="individual">Individual User</option>
                </select>
              </div>
              {/* Conditional target fields */}
              {(notifForm.targetType === 'batch' || notifForm.targetType === 'squad') && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Select Batch</label>
                  <select 
                    value={notifForm.batchId} 
                    onChange={e => setNotifForm(p => ({ ...p, batchId: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                  >
                    <option value="">-- Select Batch --</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.status})</option>)}
                  </select>
                </div>
              )}
              {notifForm.targetType === 'squad' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Select Squad Name *</label>
                  <select 
                    required
                    value={notifForm.squad} 
                    onChange={e => setNotifForm(p => ({ ...p, squad: e.target.value }))} 
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                  >
                    <option value="">-- Choose Squad --</option>
                    {['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'].map(sq => (
                      <option key={sq} value={sq}>{sq}</option>
                    ))}
                  </select>
                </div>
              )}
              {notifForm.targetType === 'role' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Role</label>
                  <select 
                    value={notifForm.role} 
                    onChange={e => setNotifForm(p => ({ ...p, role: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', height: '38px', cursor: 'pointer' }}
                  >
                    <option value="student">All Students</option>
                    <option value="faculty">All Faculty</option>
                    <option value="ltc_member">All LTC Members</option>
                    <option value="admin">All Admins</option>
                  </select>
                </div>
              )}
              {notifForm.targetType === 'individual' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>User ID, PRN or Email</label>
                  <input 
                    type="text"
                    value={notifForm.userId} 
                    onChange={e => setNotifForm(p => ({ ...p, userId: e.target.value }))} 
                    placeholder="Enter user login email, PRN, or User ID..." 
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#fff', outline: 'none', color: '#0f172a', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              {/* Emergency warning banner */}
              {notifForm.type === 'emergency' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600' }}>Emergency Alert: High priority broadcast across all selected channels.</span>
                </div>
              )}
              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                <input 
                  type="checkbox" 
                  id="pushAsBanner" 
                  checked={notifForm.pushAsBanner} 
                  onChange={e => setNotifForm(p => ({ ...p, pushAsBanner: e.target.checked }))} 
                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <label htmlFor="pushAsBanner" style={{ fontSize: '12.5px', fontWeight: '500', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                  Push as System Announcement Banner
                </label>
              </div>

              <button 
                type="submit" 
                disabled={sendingNotif} 
                style={{ 
                  borderRadius: '6px', 
                  padding: '9px 18px', 
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#ffffff',
                  border: 'none',
                  cursor: sendingNotif ? 'not-allowed' : 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '6px', 
                  background: notifForm.type === 'emergency' ? '#dc2626' : '#224283'
                }}
              >
                <Bell size={15}/> {sendingNotif ? 'Sending...' : notifForm.type === 'emergency' ? 'Send Emergency Alert' : 'Send Notification'}
              </button>
            </form>
          </div>

          {/* Preview & Target side column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Preview Panel */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '14px' : '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '11.5px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Live Notification Preview</h4>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{
                  padding: '12px 14px',
                  background: notifForm.type === 'emergency' ? '#fef2f2' : notifForm.type === 'alert' ? '#fffbeb' : notifForm.type === 'reminder' ? '#f0fdf4' : '#eff6ff',
                  borderLeft: `4px solid ${notifForm.type === 'emergency' ? '#dc2626' : notifForm.type === 'alert' ? '#f59e0b' : notifForm.type === 'reminder' ? '#16a34a' : '#224283'}`
                }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: notifForm.type === 'emergency' ? '#dc2626' : notifForm.type === 'alert' ? '#b45309' : notifForm.type === 'reminder' ? '#15803d' : '#1e40af', marginBottom: '4px', textTransform: 'uppercase' }}>
                    {notifForm.type === 'emergency' ? 'Emergency Alert' : notifForm.type === 'alert' ? 'Warning Alert' : notifForm.type === 'reminder' ? 'Event Reminder' : notifForm.type === 'info' ? 'Information' : 'Announcement'}
                  </div>
                  <div style={{ fontWeight: '600', fontSize: '13.5px', marginBottom: '4px', color: '#0f172a' }}>{notifForm.title || 'Notification Title'}</div>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{notifForm.message || 'Your message will appear here...'}</div>
                </div>
                <div style={{ padding: '8px 12px', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                  <span>In-App Alert • Just now</span>
                  <span style={{ color: '#224283', fontWeight: '600', cursor: 'pointer' }}>Mark Read</span>
                </div>
              </div>
            </div>

            {/* Targeting Summary Card */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '14px' : '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '11.5px', fontWeight: '600', color: '#475569', textTransform: 'uppercase' }}>Targeting Summary</h4>
              <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#64748b', background: '#f8fafc', width: '35%' }}>Target</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>
                        {notifForm.targetType === 'batch' 
                          ? `Entire Batch ${notifForm.batchId ? `(ID: ${notifForm.batchId})` : '(select batch)'}` 
                          : notifForm.targetType === 'squad' 
                          ? `Squad: ${notifForm.squad || '(enter squad)'}` 
                          : notifForm.targetType === 'role' 
                          ? `All ${notifForm.role}s` 
                          : `Individual: ${notifForm.userId || '(enter user)'}`}
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#64748b', background: '#f8fafc' }}>Channel</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>
                        {notifForm.channel === 'in-app' ? 'In-App Only' : notifForm.channel === 'email' ? 'Email Only' : 'In-App & Email Both'}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#64748b', background: '#f8fafc' }}>Type</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>
                        {notifForm.type.charAt(0).toUpperCase() + notifForm.type.slice(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {notifSubTab === 'history' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '14px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Notification History</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Roster of sent notifications, channels, and target recipients</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
              <select 
                value={notifTypeFilter} 
                onChange={e => setNotifTypeFilter(e.target.value)}
                style={{
                  flex: isMobile ? 1 : 'none',
                  borderRadius: '6px', 
                  fontSize: '12px', 
                  padding: '6px 10px', 
                  border: '1px solid #cbd5e1', 
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: '500',
                  outline: 'none',
                  cursor: 'pointer'
                }} 
              >
                <option value="">All Types</option>
                <option value="announcement">Announcements</option>
                <option value="reminder">Reminders</option>
                <option value="alert">Alerts</option>
                <option value="emergency">Emergency</option>
                <option value="info">Info</option>
              </select>
              <button 
                onClick={fetchNotifHistory} 
                style={{ 
                  borderRadius: '6px', 
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '7px 10px'
                }}
              >
                <RefreshCw size={13}/>
              </button>
            </div>
          </div>
          {loadingNotifHistory ? <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12.5px' }}>Loading history...</div> : (
            <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Type</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Title</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Message</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Target</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Channel</th>
                    <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Recipients</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Sent By</th>
                    <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: '#475569' }}>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {notifHistory.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        No notifications sent yet.
                      </td>
                    </tr>
                  ) : (
                    notifHistory.map((n, idx) => (
                      <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', verticalAlign: 'top' }}>
                          <span style={{ 
                            fontSize: '10.5px', 
                            fontWeight: '600', 
                            borderRadius: '4px', 
                            padding: '2px 6px', 
                            background: n.type === 'emergency' ? '#fef2f2' : n.type === 'alert' ? '#fffbeb' : n.type === 'reminder' ? '#dcfce7' : '#eff6ff', 
                            color: n.type === 'emergency' ? '#dc2626' : n.type === 'alert' ? '#d97706' : n.type === 'reminder' ? '#16a34a' : '#224283',
                            border: `1px solid ${n.type === 'emergency' ? '#fecaca' : n.type === 'alert' ? '#fde68a' : n.type === 'reminder' ? '#bbf7d0' : '#bfdbfe'}`,
                            textTransform: 'uppercase'
                          }}>
                            {n.type}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: '600', color: '#0f172a', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{n.title}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'top' }} title={n.message}>{n.message}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', color: '#475569', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {n.target_type === 'batch' ? `Batch #${n.target_batch_id}` : n.target_type === 'squad' ? `Squad: ${n.target_squad}` : n.target_type === 'role' ? n.target_role : `User #${n.target_user_id}`}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', color: '#475569', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                          {n.channel === 'in-app' ? 'In-App' : n.channel === 'email' ? 'Email' : 'In-App + Email'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#224283', verticalAlign: 'top' }}>{n.recipient_count}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', color: '#475569', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{n.sent_by_name || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: '11.5px', color: '#64748b', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* STATS */}
      {notifSubTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={fetchNotifStats} 
              style={{ 
                borderRadius: '6px', 
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '6px 10px'
              }}
            >
              <RefreshCw size={13}/>
            </button>
          </div>
          {loadingNotifStats ? <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12.5px' }}>Loading stats...</div> : notifStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Total Notifications', value: notifStats.total, color: '#224283' },
                  { label: 'Total Recipients', value: notifStats.totalRecipients, color: '#166534' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value ?? 0}</div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>{s.label}</div>
                  </div>
                ))}
                {notifStats.byType?.map(t => (
                  <div key={t.type} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '22px', fontWeight: '700', color: t.type === 'emergency' ? '#dc2626' : t.type === 'alert' ? '#d97706' : '#224283' }}>{t.count}</div>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>{t.type}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>{t.recipients} recipients</div>
                  </div>
                ))}
              </div>
              {notifStats.recent?.length > 0 && (
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '14px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Recent Send Activity</h4>
                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '600px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Title</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Type</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Sent By</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Recipients</th>
                          <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: '#475569' }}>Sent At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifStats.recent.map((n, i) => (
                          <tr key={n.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '9px 12px', fontSize: '12.5px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{n.title}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                              <span style={{ 
                                fontSize: '10px', 
                                fontWeight: '600', 
                                borderRadius: '4px', 
                                padding: '2px 6px', 
                                background: n.type === 'emergency' ? '#fef2f2' : n.type === 'alert' ? '#fffbeb' : n.type === 'reminder' ? '#dcfce7' : '#eff6ff', 
                                color: n.type === 'emergency' ? '#dc2626' : n.type === 'alert' ? '#d97706' : n.type === 'reminder' ? '#16a34a' : '#224283',
                                border: `1px solid ${n.type === 'emergency' ? '#fecaca' : n.type === 'alert' ? '#fde68a' : n.type === 'reminder' ? '#bbf7d0' : '#bfdbfe'}`,
                                textTransform: 'uppercase'
                              }}>
                                {n.type}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{n.sent_by_name || '—'}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#224283' }}>{n.recipient_count}</td>
                            <td style={{ padding: '9px 12px', fontSize: '11.5px', color: '#64748b', textAlign: 'right', whiteSpace: 'nowrap' }}>{new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No data available. Click Refresh.</div>}
        </div>
      )}
    </div>
  )
}
