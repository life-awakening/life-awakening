import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Users,
  Database,
  Activity,
  RefreshCw,
  Save,
  Trash2,
  ShieldCheck,
  LogOut,
  Search,
  Settings,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  TrendingUp,
  AlertOctagon,
  AlertTriangle,
  ChevronRight,
  Menu,
  X,
  Bell,
  Home,
  Layers,
  FileText,
  BarChart2,
  Mail,
  Lock,
  Unlock,
  Download,
  ClipboardList,
  Trophy,
  Sparkles,
  Compass,
  Flag,
  Award
} from 'lucide-react'

// Tab Subcomponents
import OverviewTab from './admin/OverviewTab'
import IamTab from './admin/IamTab'
import BatchesTab from './admin/BatchesTab'
import BatchReportsTab from './admin/BatchReportsTab'
import AttendanceTab from './admin/AttendanceTab'
import LockedStatusTab from './admin/LockedStatusTab'
import FeedbackTab from './admin/FeedbackTab'
import EmailsTab from './admin/EmailsTab'
import NotificationsTab from './admin/NotificationsTab'
import MaintenanceTab from './admin/MaintenanceTab'
import ReadOnlySuperAdminsModule from './admin/ReadOnlySuperAdminsModule'
import PerformanceAdminTab from './admin/PerformanceAdminTab'
import PasswordOtpModal from './PasswordOtpModal'
import DatabaseResetFlowModal from './admin/DatabaseResetFlowModal'

import ReportsModule from './admin/ReportsModule'
import AiFormAnalysisTab from './admin/AiFormAnalysisTab'
import FacultyJourneyTab from './FacultyJourneyTab'
import SquadPerformanceTab from './admin/SquadPerformanceTab'
import BestSquadCoordinatorsTab from './admin/BestSquadCoordinatorsTab'
import PrePostAdminTab from './admin/PrePostAdminTab'
import PrePostLtcSuperAdminPanel from './admin/PrePostLtcSuperAdminPanel'
import MiscellaneousModule from './admin/MiscellaneousModule'
import ScrollToTop from './ScrollToTop'

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size = '', hideHeader = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`}>
        {!hideHeader && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 4 }}><X size={18} /></button>
          </div>
        )}
        <div className="modal-body" style={hideHeader ? { padding: '28px' } : {}}>{children}</div>
      </div>
    </div>
  )
}

import TicketsModule from './admin/TicketsModule'
import API_BASE_URL from '@/config/apiConfig';

// ─── Superadmin Ticket Management Component ───────────────────────────────────
function SuperadminTicketsTab({ token, apiBase, API, isReadonly }) {
  return <TicketsModule token={token} apiBase={apiBase} API={API} isReadonly={isReadonly} />
}


export default function SuperadminDashboard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Navigation state
  const [activeTab, setActiveTab] = useState('overview')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024)
  const isMobile = !isDesktop
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') !== 'false')

  // Shared Data States
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [usersList, setUsersList] = useState([])


  // System Configuration Settings
  const [configSettings, setConfigSettings] = useState({
    portal_registration_open: 'true',
    maintenance_mode: 'false',
    site_title: 'Life Awakening Program',
    banner_message: 'Welcome to LTC Portal'
  })
  const [savingConfig, setSavingConfig] = useState(false)

  // Alerts, Banners, and Toasts
  const [toasts, setToasts] = useState([])
  const [successBanner, setSuccessBanner] = useState(null)

  const [isResetFlowModalOpen, setIsResetFlowModalOpen] = useState(false)

  const apiBase = API_BASE_URL;
  const isReadonly = user?.role === 'superadmin_readonly'

  // Change Password state & handlers
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passMsg, setPassMsg] = useState({ type: '', text: '' })
  const [passLoading, setPassLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState('')

  const handlePasswordChange = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!passForm.currentPassword || !passForm.newPassword || !passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'All password fields are required.' })
      return
    }
    if (passForm.newPassword.length < 6) {
      setPassMsg({ type: 'error', text: 'New password must be at least 6 characters.' })
      return
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }

    setPassLoading(true)
    setPassMsg({ type: '', text: '' })
    try {
      const res = await fetch(`${apiBase}/api/faculty/request-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        if (data.bypassed) {
          // TEMPORARY BYPASS: Password updated directly without OTP verification
          setOtpOpen(false)
          setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
          setPassMsg({ type: 'success', text: data.message || 'Password changed successfully!' })
          showToast(data.message || 'Password updated successfully!', 'success')
          return
        }
        setOtpEmail(data.emailMasked || data.email)
        setOtpExpiresAt(data.expiresAt)
        setOtpOpen(true)
      } else {
        setPassMsg({ type: 'error', text: data.message || 'Failed to request OTP' })
      }
    } catch (err) {
      setPassMsg({ type: 'error', text: 'Network error requesting password OTP.' })
    } finally {
      setPassLoading(false)
    }
  }

  const handleVerifyOtp = async (otpCode) => {
    try {
      const res = await fetch(`${apiBase}/api/faculty/verify-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otpCode })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setOtpOpen(false)
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setPassMsg({ type: 'success', text: 'Password changed successfully!' })
        showToast('Password updated successfully!', 'success')
        return { success: true, message: data.message }
      } else {
        return { success: false, message: data.message }
      }
    } catch {
      return { success: false, message: 'Network error verifying OTP.' }
    }
  }

  const handleResendOtp = async () => {
    try {
      const res = await fetch(`${apiBase}/api/faculty/resend-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) return { success: true, message: data.message, expiresAt: data.expiresAt, cooldownSeconds: data.cooldownSeconds }
      return { success: false, message: data.message }
    } catch {
      return { success: false, message: 'Network error resending OTP.' }
    }
  }

  // Security Check
  useEffect(() => {
    if (!token || !user || (user.role !== 'superadmin' && user.role !== 'superadmin_readonly' && !user.is_pre_post_admin)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/login')
    }
  }, [token, user, navigate])

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen, isDesktop])

  const toggleSidebarCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }



  // Fetch users directory for red flag assignees
  const fetchUsers = async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsersList(data.users || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Initial dashboard load
  const initializeDashboard = async () => {
    if (!token) return
    try {
      // Fetch active batches
      const batchRes = await fetch(`${apiBase}/api/admin/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (batchRes.ok) {
        const batchData = await batchRes.json()
        setBatches(batchData.batches || [])
        const activeBatch = batchData.batches.find(b => b.status === 'active')
        if (activeBatch) {
          setSelectedBatchId(activeBatch.id)
        } else if (batchData.batches && batchData.batches.length > 0) {
          setSelectedBatchId(batchData.batches[0].id)
        }
      }

      // Fetch config settings
      const configRes = await fetch(`${apiBase}/api/superadmin/config`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (configRes.ok) {
        const configData = await configRes.json()
        if (configData.settings) {
          setConfigSettings(prev => ({ ...prev, ...configData.settings }))
        }
      }

      // Fetch all users
      fetchUsers()
    } catch (err) {
      console.error('Error initializing dashboard:', err)
    }
  }

  useEffect(() => {
    initializeDashboard()
  }, [])

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault()
    if (isReadonly) {
      showToast('Action forbidden: You have read-only access.', 'error')
      return
    }
    try {
      setSavingConfig(true)
      const res = await fetch(`${apiBase}/api/superadmin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings: configSettings })
      })
      const data = await res.json()
      if (res.ok) {
        showToast('System configuration saved.', 'success')
      } else {
        showToast(data.message || 'Failed to save configuration', 'error')
      }
    } catch (err) {
      showToast('Error saving settings', 'error')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // Helper inside Render
  const renderSidebarItem = (tab, iconElement, label, badge, isMobile) => {
    const isActive = activeTab === tab;
    const collapsed = isMobile ? false : isCollapsed;
    return (
      <button
        onClick={() => {
          setActiveTab(tab);
          if (isMobile) setIsSidebarOpen(false);
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: '9px 12px',
          borderRadius: '8px',
          fontSize: '13.5px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? '#ffffff' : '#475569',
          background: isActive ? '#ea580c' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out',
          textAlign: 'left',
          width: '100%',
          outline: 'none',
          marginBottom: '2px',
          boxShadow: 'none',
          overflow: 'hidden'
        }}
        className={isActive ? '' : 'hover:bg-slate-50 hover:text-slate-900'}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%' }}>
          <div style={{ color: isActive ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {React.cloneElement(iconElement, { size: 16, strokeWidth: isActive ? 2.2 : 2 })}
          </div>
          <span style={{
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? '0px' : '200px',
            marginLeft: collapsed ? '0px' : '10px',
            visibility: collapsed ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>{label}</span>
        </div>
        {badge && (
          <span style={{
            fontSize: '10px', fontWeight: '700',
            padding: collapsed ? '0px' : '2px 6px',
            borderRadius: '4px',
            background: badge.bg || (isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9'),
            color: badge.color || (isActive ? '#ffffff' : '#0f172a'),
            lineHeight: 1,
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? '0px' : '80px',
            overflow: 'hidden',
            visibility: collapsed ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, padding 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>
            {badge.text}
          </span>
        )}
      </button>
    );
  };

  const renderSidebar = (isMobile) => {
    const collapsed = isMobile ? false : isCollapsed;
    
    return (
      <aside 
        className={isMobile ? "mobile-sidebar" : `relative flex-shrink-0 bg-white flex flex-col transition-[width] duration-300 ease-in-out z-20 ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`}
        style={isMobile ? {
          position: 'fixed',
          top: 0, left: 0, bottom: 0, zIndex: 999999,
          height: '100%',
          maxHeight: '100dvh',
          transform: !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          width: '270px',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '10px 0 40px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        } : {
          height: '100%',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '1px 0 10px rgba(0, 0, 0, 0.01)',
          overflow: 'visible'
        }}
      >
        {/* Toggle Buttons (Desktop only) */}
        {!isMobile && (
          <>
            {/* Sleek circular floating Toggle Button (Top) */}
            <button
              style={{
                position: 'absolute',
                top: '24px',
                right: '-12px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                zIndex: 30,
                color: '#64748b',
                outline: 'none',
                padding: 0
              }}
              onClick={toggleSidebarCollapse}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              <ChevronRight size={14} style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
            </button>

            {/* Sleek circular floating Toggle Button (Middle) */}
            <button
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: '-24px',
                width: '24px',
                height: '48px',
                borderTopRightRadius: '24px',
                borderBottomRightRadius: '24px',
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                backgroundColor: '#dbeafe',
                border: '1px solid #cbd5e1',
                borderLeft: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '2px 2px 6px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                zIndex: 30,
                outline: 'none',
                padding: 0
              }}
              onClick={toggleSidebarCollapse}
              aria-label={isCollapsed ? "Expand/Collapse Sidebar" : "Collapse/Expand Sidebar"}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#475569' }}></span>
              </div>
            </button>
          </>
        )}

        {/* Logo / Brand Header — cross-fade */}
        <div style={{
          height: '80px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          position: 'relative', overflow: 'hidden', flexShrink: 0,
          transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)',
          padding: collapsed ? '0' : '0 24px'
        }}>
          <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain', position: 'absolute', left: collapsed ? '50%' : '24px', transform: collapsed ? 'translateX(-50%)' : 'none', opacity: collapsed ? 0 : 1, transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
          <img src="/logoo.png" alt="LTC Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', opacity: collapsed ? 1 : 0, transform: collapsed ? 'scale(1)' : 'scale(0.7)', transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />

          {isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              aria-label="Close Sidebar" 
              style={{ 
                position: 'absolute', right: '12px',
                border: 'none', background: '#f1f5f9', borderRadius: '50%', 
                width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: '#64748b', cursor: 'pointer', padding: 0, boxShadow: 'none'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Navigation Area */}
        <div style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }} className="no-scrollbar">
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            
            {/* Section: OVERVIEW */}
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: collapsed ? '0px' : '32px', opacity: collapsed ? 0 : 1, padding: collapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>Overview</span>
            {renderSidebarItem('overview', <Home />, 'Overview', null, isMobile)}
            {!isReadonly && renderSidebarItem('iam', <Users />, 'User Access', null, isMobile)}
            {!isReadonly && renderSidebarItem('readonly-admins', <ShieldCheck />, 'Read Only Super Admins', null, isMobile)}
            {!isReadonly && renderSidebarItem('performance-admin', <Award />, 'Performance Admin', null, isMobile)}
            {!isReadonly && renderSidebarItem('pre-post-admin', <ShieldCheck />, 'Pre/Post Admin', null, isMobile)}
            {renderSidebarItem('batches', <Layers />, 'Batches', null, isMobile)}
            {renderSidebarItem('attendance', <ClipboardList />, 'Attendance', null, isMobile)}
            {renderSidebarItem('locked-status', <Lock />, 'Locked Status', null, isMobile)}
            {renderSidebarItem('squad-performance', <Trophy />, 'Squad Performance', null, isMobile)}
            {renderSidebarItem('best-squad-coordinator', <Award />, 'Best Squad Coordinators', null, isMobile)}
            {renderSidebarItem('batch-reports', <BarChart2 />, 'Batch Reports', null, isMobile)}
            {renderSidebarItem('reports', <FileText />, 'Logs & Certs', null, isMobile)}
            {renderSidebarItem('feedback', <MessageSquare />, 'Submissions', null, isMobile)}
            {renderSidebarItem('ai-form-analysis', <Sparkles />, 'AI Form Analysis', null, isMobile)}
            {renderSidebarItem('journey', <Compass />, 'Journey Media', null, isMobile)}
            {renderSidebarItem('misc', <Flag />, 'Miscellaneous', null, isMobile)}

            {/* Section: COMMUNICATIONS */}
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: collapsed ? '0px' : '32px', opacity: collapsed ? 0 : 1, padding: collapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>Communications</span>
            {!isReadonly && renderSidebarItem('emails', <Mail />, 'Emails', null, isMobile)}
            {renderSidebarItem('notifications', <Bell />, 'Notifications', null, isMobile)}
            {renderSidebarItem('tickets', <ShieldCheck />, 'Support Tickets', null, isMobile)}

            {/* Section: SYSTEM */}
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: collapsed ? '0px' : '32px', opacity: collapsed ? 0 : 1, padding: collapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>System</span>
            {renderSidebarItem('config', <Settings />, 'Settings', null, isMobile)}
            {!isReadonly && renderSidebarItem('maintenance', <ShieldAlert />, 'Maintenance', null, isMobile)}

          </nav>
        </div>

        {/* Bottom Profile & Actions - unified smooth transitions */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', transition: 'gap 0.35s cubic-bezier(0.4,0,0.2,1)', justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0, transition: 'all 0.3s ease' }} title="Super Admin">SA</div>
            <div style={{ overflow: 'hidden', maxWidth: collapsed ? '0px' : '180px', opacity: collapsed ? 0 : 1, visibility: collapsed ? 'hidden' : 'visible', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Super Admin'}</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Platform Owner</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: collapsed ? 'center' : 'stretch' }}>
            <button
              onClick={() => {
                if (isReadonly) {
                  showToast('Read-only access: Database reset is disabled.', 'error')
                } else {
                  setIsResetFlowModalOpen(true)
                }
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: collapsed ? '0px' : '6px', padding: '8px', borderRadius: '8px', border: '1px solid #fee2e2', backgroundColor: '#ffffff', color: '#ef4444', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', flex: collapsed ? 'none' : 1, width: collapsed ? '36px' : 'auto', height: collapsed ? '36px' : 'auto', overflow: 'hidden' }}
              className="hover:bg-red-50"
              title="Reset Database"
            >
              <Trash2 size={13} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: collapsed ? '0px' : '80px', overflow: 'hidden', opacity: collapsed ? 0 : 1, visibility: collapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>Reset</span>
            </button>
            <button
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: collapsed ? '0px' : '6px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', flex: collapsed ? 'none' : 1, width: collapsed ? '36px' : 'auto', height: collapsed ? '36px' : 'auto', overflow: 'hidden' }}
              className="hover:bg-slate-50"
              title="Sign Out"
            >
              <LogOut size={13} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: collapsed ? '0px' : '80px', overflow: 'hidden', opacity: collapsed ? 0 : 1, visibility: collapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    );
  };

  if (user?.is_pre_post_admin && user?.role !== 'superadmin' && user?.role !== 'superadmin_readonly') {
    return <PrePostLtcSuperAdminPanel API={apiBase} token={token} user={user} showToast={showToast} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden antialiased text-sm" style={{ backgroundColor: '#f8fafc' }}>
      <ScrollToTop watchDeps={[activeTab]} />
      {/* Toast Notification Stream */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#ef4444' : (t.type === 'warning' ? '#f59e0b' : '#0f172a'),
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
            fontWeight: '600',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'toastIn 0.3s ease'
          }}>
            {t.type === 'error' && <AlertOctagon size={16} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Mobile view Overlay & Slide Sidebar */}
      {!isDesktop && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0, 0, 0, 0.4)', 
            zIndex: 999998,
            opacity: isSidebarOpen ? 1 : 0,
            visibility: isSidebarOpen ? 'visible' : 'hidden',
            backdropFilter: isSidebarOpen ? 'blur(4px)' : 'blur(0px)',
            WebkitBackdropFilter: isSidebarOpen ? 'blur(4px)' : 'blur(0px)',
            transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.4s cubic-bezier(0.16, 1, 0.3, 1), -webkit-backdrop-filter 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      {!isDesktop && renderSidebar(true)}

      {/* Main Left Sidebar (for desktop) */}
      {isDesktop && renderSidebar(false)}

      {/* Right Content Space */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden" style={{ backgroundColor: '#f8fafc' }}>
        {/* Top Header Navbar */}
        <header 
          className="h-11 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10 flex-shrink-0"
          style={{ 
            backgroundColor: '#ea580c', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {!isDesktop && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0
                }}
              >
                <Menu size={14} />
              </button>
            )}
            <div 
              className="flex items-center"
              style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '14px', fontWeight: 700, lineHeight: 1.2, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              <span style={{ textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeTab === 'journey' ? 'LAP Journey Media' : (activeTab === 'iam' ? 'User Access' : (activeTab === 'readonly-admins' ? 'Read Only Super Admins' : (activeTab === 'performance-admin' ? 'Performance Admin' : (activeTab === 'pre-post-admin' ? 'Pre/Post Admin' : (activeTab === 'config' ? 'Settings' : (activeTab === 'reports' ? 'Logs and Certificate' : (activeTab === 'locked-status' ? 'Locked Status' : (activeTab === 'squad-performance' ? 'Squad Performance' : (activeTab === 'misc' ? 'Miscellaneous & Flags' : activeTab)))))))))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
          </div>
        </header>

        {/* Content Body Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-8" style={{ ...(isMobile ? { padding: '12px 10px 90px' } : {}), width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="max-w-7xl mx-auto space-y-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
          
          {successBanner && (
            <div style={{
              background: '#000000',
              color: '#ffffff',
              padding: '16px 24px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
              border: '1px solid #ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}></span>
                <div>
                  <div style={{ fontWeight: '850', fontSize: '13.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notification Dispatched Successfully</div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                    <strong>Headline:</strong> {successBanner.title} | <strong>Recipients:</strong> {successBanner.recipientCount} members via {successBanner.channel === 'both' ? 'In-App + Email' : successBanner.channel.toUpperCase()}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSuccessBanner(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Dismiss
              </button>
            </div>
          )}
          
          {/* TAB CONTENT Rendering */}
          {activeTab === 'overview' && (
            <OverviewTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              user={user} 
              batches={batches} 
              selectedBatchId={selectedBatchId} 
              setSelectedBatchId={setSelectedBatchId} 
              isMobile={isMobile}
            />
          )}

          {activeTab === 'iam' && (
            <IamTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              user={user}
              readonly={isReadonly}
            />
          )}

          {activeTab === 'readonly-admins' && !isReadonly && (
            <ReadOnlySuperAdminsModule
              API={apiBase}
              token={token}
              user={user}
              showToast={showToast}
            />
          )}

          {activeTab === 'performance-admin' && !isReadonly && (
            <PerformanceAdminTab
              API={apiBase}
              token={token}
              user={user}
              showToast={showToast}
            />
          )}

          {activeTab === 'pre-post-admin' && !isReadonly && (
            <PrePostAdminTab
              API={apiBase}
              token={token}
              user={user}
              showToast={showToast}
            />
          )}

          {activeTab === 'batches' && (
            <BatchesTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              onRefresh={initializeDashboard} 
              readonly={isReadonly}
            />
          )}

          {activeTab === 'batch-reports' && (
            <BatchReportsTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
              selectedBatchId={selectedBatchId}
              setSelectedBatchId={setSelectedBatchId}
            />
          )}

          {activeTab === 'locked-status' && (
            <LockedStatusTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
              user={user}
            />
          )}

          {activeTab === 'squad-performance' && (
            <SquadPerformanceTab
              token={token}
              apiBase={apiBase}
              user={user}
              isReadonly={isReadonly}
              isMobile={isMobile}
              batches={batches}
            />
          )}

          {activeTab === 'best-squad-coordinator' && (
            <BestSquadCoordinatorsTab
              token={token}
              apiBase={apiBase}
              showToast={showToast}
              isReadonly={false}
              isMobile={isMobile}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsModule 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
            />
          )}

          {activeTab === 'feedback' && (
            <FeedbackTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
            />
          )}

          {activeTab === 'ai-form-analysis' && (
            <AiFormAnalysisTab 
              token={token} 
              isReadOnly={isReadonly} 
              onToast={showToast} 
            />
          )}

          {activeTab === 'journey' && (
            <FacultyJourneyTab 
              token={token} 
              isSuperAdmin={true} 
              isReadOnly={isReadonly}
              user={user}
              batches={batches}
            />
          )}

          {activeTab === 'misc' && (
            <MiscellaneousModule 
              token={token} 
              toast={showToast} 
            />
          )}

          {activeTab === 'emails' && (
            <EmailsTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
              readonly={isReadonly}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              batches={batches} 
              readonly={isReadonly}
            />
          )}

          {activeTab === 'tickets' && (
            <SuperadminTicketsTab 
              token={token} 
              apiBase={apiBase} 
              isReadonly={isReadonly}
            />
          )}

          {activeTab === 'config' && (
            <div className="glass-card" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', padding: isMobile ? '16px' : '24px', width: '100%', boxSizing: 'border-box' }}>
              {!isReadonly && (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Portal & Banner Settings</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>Update site title, announcement banner, and registration settings.</p>
                  </div>

                  <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', width: '100%', boxSizing: 'border-box', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>Allow Registration</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>Allow new students and faculty to register.</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfigSettings(prev => ({ ...prev, portal_registration_open: prev.portal_registration_open === 'true' ? 'false' : 'true' }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: configSettings.portal_registration_open === 'true' ? 'var(--primary)' : 'var(--text-4)', padding: 0 }}
                      >
                        {configSettings.portal_registration_open === 'true' ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px' }}>Emergency Maintenance Lockout</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>Prevent non-admin users from signing in. Displays lock screen.</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setConfigSettings(prev => ({ ...prev, maintenance_mode: prev.maintenance_mode === 'true' ? 'false' : 'true' }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: configSettings.maintenance_mode === 'true' ? '#ef4444' : 'var(--text-4)', padding: 0 }}
                      >
                        {configSettings.maintenance_mode === 'true' ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                      </button>
                    </div>

                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Portal Site Branding Title</label>
                      <input 
                        type="text"
                        className="input-field"
                        value={configSettings.site_title || ''}
                        onChange={e => setConfigSettings(prev => ({ ...prev, site_title: e.target.value }))}
                        style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }}
                        required
                      />
                    </div>

                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '700' }}>Platform Alert Banner Message</label>
                      <input 
                        type="text"
                        className="input-field"
                        value={configSettings.banner_message || ''}
                        onChange={e => setConfigSettings(prev => ({ ...prev, banner_message: e.target.value }))}
                        style={{ width: '100%', borderRadius: '50px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={savingConfig} 
                      className="btn btn-primary"
                      style={{ width: '100%', borderRadius: '50px', padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      <Save size={16} /> {savingConfig ? 'Saving Settings...' : 'Save Configuration'}
                    </button>
                  </form>
                </>
              )}

              {/* Account Security: Change Password */}
              <div style={{ marginTop: !isReadonly ? '32px' : '0px', paddingTop: !isReadonly ? '24px' : '0px', borderTop: !isReadonly ? '1px solid var(--border)' : 'none', width: '100%', boxSizing: 'border-box' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Lock size={16} style={{ color: '#2563eb' }} /> Account Security — Change Password
                    <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                      ⚡ OTP Temporarily Bypassed
                    </span>
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Update your account password directly. (Email OTP requirement is temporarily bypassed for Superadmin).</p>
                </div>

                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '500px', width: '100%', boxSizing: 'border-box' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Current Password</label>
                    <input type="password" required className="input-field" value={passForm.currentPassword || ''} onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} style={{ width: '100%', borderRadius: '10px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>New Password</label>
                    <input type="password" required minLength={6} className="input-field" value={passForm.newPassword || ''} onChange={e => setPassForm({...passForm, newPassword: e.target.value})} style={{ width: '100%', borderRadius: '10px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Confirm New Password</label>
                    <input type="password" required minLength={6} className="input-field" value={passForm.confirmPassword || ''} onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} style={{ width: '100%', borderRadius: '10px', boxSizing: 'border-box' }} />
                  </div>
                  {passMsg.text && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: passMsg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: passMsg.type === 'error' ? '#991b1b' : '#166534' }}>
                      {passMsg.text}
                    </div>
                  )}
                  <button type="submit" disabled={passLoading} className="btn" style={{ background: '#0f172a', color: '#fff', width: '100%', padding: '12px', fontWeight: '700', borderRadius: '10px', cursor: 'pointer' }}>
                    {passLoading ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Danger Zone — Secure Database Reset (Strict Full Superadmin Only) */}
              {!isReadonly && user?.role === 'superadmin' && (
                <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #fee2e2', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} style={{ color: '#dc2626' }} /> Danger Zone — Database Reset
                    </h4>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                      Permanently wipes application data (batches, schedules, attendance, evaluations, media, student accounts). Preserves Administrator and Super Administrator accounts.
                    </p>
                  </div>

                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        Reset Application Database
                        <span style={{ fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                          ⚡ Dual-OTP Temporarily Bypassed
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px', lineHeight: 1.4 }}>
                        Dual-party security OTP verification is temporarily bypassed for Super Admin.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsResetFlowModalOpen(true)}
                      style={{
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                      }}
                      title="Reset Database"
                    >
                      <Trash2 size={15} /> Reset Database
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <PasswordOtpModal
            isOpen={otpOpen}
            onClose={() => setOtpOpen(false)}
            emailMasked={otpEmail}
            expiresAt={otpExpiresAt}
            onVerify={handleVerifyOtp}
            onResend={handleResendOtp}
          />

          {activeTab === 'maintenance' && (
            <MaintenanceTab 
              token={token} 
              apiBase={apiBase} 
              showToast={showToast} 
              readonly={isReadonly}
            />
          )}

          </div>
        </div>
      </div>

      {/* Secure Database Reset Flow Modal */}
      <DatabaseResetFlowModal
        isOpen={isResetFlowModalOpen}
        onClose={() => setIsResetFlowModalOpen(false)}
        onSuccess={() => {
          fetchUsers();
          showToast('Database reset successfully. Application data reset.', 'success');
        }}
        apiBase={apiBase}
        token={token}
      />

      {/* Mobile Bottom Navigation Bar */}
      {isMobile && (
        <div className="mobile-bottom-nav" style={isSidebarOpen ? { display: 'none' } : {}}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`mobile-bottom-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Home size={20} />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`mobile-bottom-nav-item ${['feedback', 'batch-reports', 'reports'].includes(activeTab) ? 'active' : ''}`}
          >
            <MessageSquare size={20} />
            <span>Submissions</span>
          </button>

          <button
            onClick={() => setActiveTab('batches')}
            className={`mobile-bottom-nav-item ${activeTab === 'batches' ? 'active' : ''}`}
          >
            <Layers size={20} />
            <span>Batches</span>
          </button>

          <button
            onClick={() => setActiveTab('squad-performance')}
            className={`mobile-bottom-nav-item ${activeTab === 'squad-performance' ? 'active' : ''}`}
          >
            <Trophy size={20} />
            <span>Performance</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

