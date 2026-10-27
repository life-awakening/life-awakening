import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, GraduationCap, Calendar, CheckSquare, FileText, Activity, LayoutDashboard, ClipboardList, PenTool, Search, LogOut, MessageSquare, Users, Bell, Menu, Clock, RefreshCw, X, Compass, Award, MapPin, BookOpen, User, UserCheck, ChevronLeft, ChevronRight, Shield, ShieldCheck, Lock, HelpCircle, ChevronDown, ChevronUp, Download, CheckCircle, Phone, Mail, Heart, Briefcase, Globe, Check, Upload, Image, Image as ImageIcon, Video, Trash2, Eye, Folder, Percent, UserX, AlertOctagon } from 'lucide-react'
import * as XLSX from 'xlsx'
import html2pdf from 'html2pdf.js'
import ScrollToTop from './ScrollToTop'
import TimetablePanel from './TimetablePanel'
import { generateCertificate } from './utils/generateCertificate'
import { exportLtcExcel } from './utils/exportLtcExcel'
import { useLanguage } from './context/LanguageContext'
import UserCertificatesTab from './UserCertificatesTab'
import PasswordOtpModal from './PasswordOtpModal'
import FacultyJourneyTab from './FacultyJourneyTab'
import ConfettiPopper from './ConfettiPopper'
import PerformanceAdminMarkingTab from './PerformanceAdminMarkingTab'
import PreLtcFeedbackForm from './components/PreLtcFeedbackForm'
import PostLtcFeedbackForm from './components/PostLtcFeedbackForm'
import API_BASE_URL from '@/config/apiConfig';

const SQUAD_COLORS = {
  Surya:     '#0C54A4',
  Aditya:    '#FCCC04',
  Ravi:      '#04A4E4',
  Divakar:   '#AC4C84',
  Mitra:     '#EC7C1C',
  Martand:   '#64A474',
  Dinkar:    '#047C44',
  Prabhakar: '#E40C84',
  Bhaskar:   '#A45C3C',
  Tejonidhi: '#E41C24',
}

// ─── Profile Tab Component ─────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)' }}>
    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
      {Icon && <Icon size={18} className="text-primary" />}
      {title}
    </h3>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>{children}</div>
  </div>
)

const Field = ({ label, value }) => (
  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9', transition: 'all 0.2s ease' }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.5px' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: value ? '#0f172a' : '#94a3b8' }}>{value || '—'}</div>
  </div>
)

function FacultyProfileTab({ token, isLtcMember }) {
  const { t } = useLanguage()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg, setPassMsg] = useState({ type: '', text: '' })

  // OTP Modal states
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false)
  const [otpEmailMasked, setOtpEmailMasked] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState('')

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/faculty/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.profile) setProfile(d.profile); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  const handlePasswordChange = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!passForm.currentPassword || !passForm.newPassword || !passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: t('All fields are required.') })
      return
    }
    if (passForm.newPassword.length < 6) {
      setPassMsg({ type: 'error', text: t('New password must be at least 6 characters.') })
      return
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: t('New passwords do not match.') })
      return
    }
    setPassLoading(true); setPassMsg({ type: '', text: '' })
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/request-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword })
      })
      const data = await res.json()
      if (res.ok) {
        setOtpEmailMasked(data.email || profile?.email || '')
        setOtpExpiresAt(data.expiresAt)
        setIsOtpModalOpen(true)
      } else {
        setPassMsg({ type: 'error', text: t(data.message) })
      }
    } catch {
      setPassMsg({ type: 'error', text: t('Network error.') })
    } finally { setPassLoading(false) }
  }

  const handleVerifyOtp = async (otpCode) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/verify-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otpCode })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsOtpModalOpen(false)
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setPassMsg({ type: 'success', text: t('Password changed successfully!') })
        return { success: true, message: data.message }
      } else {
        return { success: false, message: data.message }
      }
    } catch {
      return { success: false, message: t('Network error while verifying OTP.') }
    }
  }

  const handleResendOtp = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/resend-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        return { success: true, message: data.message, expiresAt: data.expiresAt, cooldownSeconds: data.cooldownSeconds }
      } else {
        return { success: false, message: data.message }
      }
    } catch {
      return { success: false, message: t('Network error while resending OTP.') }
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
  if (!profile) return <div style={{ padding: 40, textAlign: 'center' }}>{t("Failed to load profile.")}</div>

  const fullName = profile.name || '—'
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'F'

  // Header Gradient based on user's role
  const headerGradient = 'linear-gradient(135deg, #1e3a8a, #0d1e4c)'
  const shadowColor = 'rgba(13, 30, 76, 0.2)'
  const roleText = isLtcMember 
    ? t('LTC Member Profile') 
    : t('Faculty Advisor Profile')

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Profile Card */}
      <div style={{
        background: headerGradient,
        borderRadius: 16,
        padding: 32,
        marginBottom: 32,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        boxShadow: `0 10px 15px -3px ${shadowColor}, 0 4px 6px -2px ${shadowColor}`
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          border: '4px solid rgba(255, 255, 255, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 800,
          textShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          {initials}
        </div>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>{fullName}</h2>
          <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', margin: '4px 0 12px 0', fontWeight: 550 }}>
            {t(profile.school)} • {t(profile.department)}
          </p>
          <span style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 50,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.75px'
          }}>
            {roleText}
          </span>
        </div>
      </div>

      <Section title={t("Basic Information")} icon={User}>
        <Field label={t("Full Name")} value={fullName} />
        <Field label={t("Employee ID")} value={profile.emp_id} />
        <Field label={t("Role")} value={t(profile.role === 'ltc_member' ? 'LTC Member' : 'Faculty')} />
      </Section>

      <Section title={t("Academic Designation")} icon={BookOpen}>
        <Field label={t("Division")} value={t(profile.division)} />
        <Field label={t("Faculty")} value={t(profile.faculty)} />
        <Field label={t("School")} value={t(profile.school)} />
        <Field label={t("Department")} value={t(profile.department)} />
        <Field label={t("Panel")} value={t(profile.panel)} />
      </Section>

      <Section title={t("Contact Information")} icon={Phone}>
        <Field label={t("Email")} value={profile.email} />
        <Field label={t("Phone")} value={profile.phone} />
      </Section>

      <Section title={t("Security Settings")} icon={Lock}>
        <div style={{ gridColumn: '1 / -1', maxWidth: 400 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t("Current Password")}</label>
            <input type="password" required className="input-field" value={passForm.currentPassword} onChange={e => setPassForm({...passForm, currentPassword: e.target.value})} style={{ marginBottom: 0 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t("New Password")}</label>
            <input type="password" required minLength={6} className="input-field" value={passForm.newPassword} onChange={e => setPassForm({...passForm, newPassword: e.target.value})} style={{ marginBottom: 0 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{t("Confirm New Password")}</label>
            <input type="password" required minLength={6} className="input-field" value={passForm.confirmPassword} onChange={e => setPassForm({...passForm, confirmPassword: e.target.value})} style={{ marginBottom: 0 }} />
          </div>
          {passMsg.text && (
            <div style={{ padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16, background: passMsg.type === 'error' ? '#fef2f2' : '#f0fdf4', color: passMsg.type === 'error' ? '#dc2626' : '#16a34a' }}>
              {passMsg.text}
            </div>
          )}
          <button type="button" onClick={handlePasswordChange} disabled={passLoading} className="btn" style={{ background: '#0f172a', color: '#fff', width: '100%', padding: '12px', fontWeight: '700' }}>
            {passLoading ? t('Sending OTP...') : <><Lock size={14} style={{ marginRight: 6 }} /> {t("Send Verification OTP")}</>}
          </button>
        </div>
      </Section>

      <PasswordOtpModal
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        emailMasked={otpEmailMasked}
        expiresAt={otpExpiresAt}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
      />
    </div>
  )
}


function FacultyTicketsTab({ token, API }) {
  const { t } = useLanguage()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [subject, setSubject] = useState('')
  const [customSubject, setCustomSubject] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Problem')
  const [priority, setPriority] = useState('Medium')
  const [ticketByRequest, setTicketByRequest] = useState(false)
  const [onBehalfOf, setOnBehalfOf] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotName, setScreenshotName] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/tickets/my-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    } catch (e) {
      console.error('Error fetching tickets', e)
    } finally {
      setLoading(false)
    }
  }, [token, API])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert(t("Screenshot size should be less than 2MB."))
        return
      }
      setScreenshotName(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        setScreenshot(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const finalSubject = subject === 'Other' ? customSubject : subject
    if (!finalSubject || !finalSubject.trim() || !description.trim()) {
      setMessage({ type: 'error', text: t('Please select or specify the incorrect field, and enter a description.') })
      return
    }
    setSubmitting(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`${API}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: finalSubject,
          description,
          category,
          priority,
          on_behalf_of: ticketByRequest ? onBehalfOf : null,
          screenshot: screenshot || null
        })
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: t('Support ticket raised successfully!') })
        setSubject('')
        setCustomSubject('')
        setDescription('')
        setCategory('Problem')
        setPriority('Medium')
        setTicketByRequest(false)
        setOnBehalfOf('')
        setScreenshot(null)
        setScreenshotName('')
        fetchTickets()
      } else {
        setMessage({ type: 'error', text: t(data.message) || t('Failed to raise ticket.') })
      }
    } catch {
      setMessage({ type: 'error', text: t('Network error submitting ticket.') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .hover-card-shadow {
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-card-shadow:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.06), 0 4px 12px -5px rgba(0, 0, 0, 0.02) !important;
          border-color: #cbd5e1 !important;
        }
        .student-ticket-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          white-space: nowrap;
          border: 1px solid transparent;
        }
        .st-badge-pending {
          background: rgba(245, 158, 11, 0.08);
          color: #b45309;
          border-color: rgba(245, 158, 11, 0.16);
        }
        .st-badge-resolved {
          background: rgba(16, 185, 129, 0.08);
          color: #047857;
          border-color: rgba(16, 185, 129, 0.16);
        }
        .st-badge-urgent {
          background: rgba(239, 68, 68, 0.08);
          color: #b91c1c;
          border-color: rgba(239, 68, 68, 0.16);
        }
        .st-badge-high {
          background: rgba(249, 115, 22, 0.08);
          color: #c2410c;
          border-color: rgba(249, 115, 22, 0.16);
        }
        .st-badge-medium {
          background: rgba(59, 130, 246, 0.08);
          color: #1d4ed8;
          border-color: rgba(59, 130, 246, 0.16);
        }
      `}</style>

      <div 
        style={{ 
          maxWidth: '800px', 
          margin: '0 auto', 
          width: '100%',
          padding: '24px',
          background: '#ffffff',
          border: '1px solid #edf2f7',
          borderRadius: '16px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: '#0f172a', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <HelpCircle size={18} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '650', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
            {t("Raise a ticket")}
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
          {t("Please select the incorrect personal detail field below, describe the required change, and upload a screenshot if necessary.")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Subject Field */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t("Incorrect Personal Detail (Subject)")}
            </label>
            <select
              value={subject}
              onChange={e => {
                setSubject(e.target.value)
                if (e.target.value !== 'Other') setCustomSubject('')
              }}
              required
              style={{ 
                width: '100%', 
                height: '38px', 
                fontSize: '13.5px', 
                padding: '0 12px', 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="">{t("-- Select incorrect field --")}</option>
              <option value="Incorrect Full Name">{t("Full Name is incorrect")}</option>
              <option value="Incorrect Email Address">{t("Email Address is incorrect")}</option>
              <option value="Incorrect Personal Email">{t("Personal Email is incorrect")}</option>
              <option value="Incorrect Phone Number">{t("Phone Number is incorrect")}</option>
              <option value="Incorrect Gender">{t("Gender is incorrect")}</option>
              <option value="Incorrect PRN / Employee ID">{t("PRN / Employee ID is incorrect")}</option>
              <option value="Incorrect Semester / Designation">{t("Semester / Designation is incorrect")}</option>
              <option value="Incorrect Program / School">{t("Program / School is incorrect")}</option>
              <option value="Incorrect Department / Squad">{t("Department / Squad is incorrect")}</option>
              <option value="Incorrect Room Number">{t("Room Number is incorrect")}</option>
              <option value="Incorrect Nominee Details">{t("Nominee Details are incorrect")}</option>
              <option value="Other">{t("Other (Specify below)")}</option>
            </select>
          </div>

          {subject === 'Other' && (
            <div className="animate-fade-in">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t("Specify Subject")}
              </label>
              <input
                type="text"
                placeholder={t("e.g. Profile photo not updating / Batch details mismatch")}
                value={customSubject}
                onChange={e => setCustomSubject(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  height: '38px', 
                  fontSize: '13.5px', 
                  padding: '0 12px', 
                  backgroundColor: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '8px', 
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Description Field */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t("Description / Required Change")}
            </label>
            <textarea
              placeholder={t("Explain what is wrong and what the correct values should be...")}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              style={{ 
                width: '100%', 
                minHeight: '120px', 
                fontSize: '13.5px', 
                padding: '12px', 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {message.text && (
            <div style={{
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              background: message.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: message.type === 'error' ? '#dc2626' : '#16a34a',
              border: message.type === 'error' ? '1px solid #fee2e2' : '1px solid #dcfce7'
            }}>
              {message.text}
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id="screenshot-upload-faculty"
                onChange={handleFileChange}
              />
              <label
                htmlFor="screenshot-upload-faculty"
                style={{
                  padding: '8px 16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  transition: 'all 0.15s'
                }}
                className="hover:bg-slate-50"
              >
                {t("Attach screenshot")}
              </label>

              {screenshotName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '600', color: '#334155', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{screenshotName}</span>
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', padding: '0 4px' }}
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
                background: '#0f172a',
                color: '#ffffff',
                padding: '10px 24px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13.5px',
                transition: 'opacity 0.15s'
              }}
            >
              {submitting ? t('Submitting...') : t('Submit a ticket')}
            </button>
          </div>
        </form>
      </div>

      <div 
        style={{ 
          maxWidth: '800px', 
          margin: '0 auto', 
          width: '100%',
          padding: '24px',
          background: '#ffffff',
          border: '1px solid #edf2f7',
          borderRadius: '16px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#f1f5f9', color: '#475569',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Clock size={18} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '650', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
              {t("Past Raised Tickets")}
            </h2>
          </div>
          <button
            onClick={fetchTickets}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '550',
              transition: 'all 0.15s'
            }}
            className="hover:bg-slate-50"
          >
            <RefreshCw size={13} /> {t("Refresh")}
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner" /></div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13.5px', fontStyle: 'italic' }}>
            {t("No tickets raised yet.")}
          </div>
        ) : (
          <div className="ticket-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {tickets.map(tk => {
              const isResolved = tk.status === 'resolved';
              const priorityClass = tk.priority === 'Urgent' ? 'st-badge-urgent' : tk.priority === 'High' ? 'st-badge-high' : 'st-badge-medium';
              
              return (
                <div 
                  key={tk.id} 
                  style={{
                    background: '#ffffff',
                    border: '1px solid #edf2f7',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)',
                  }}
                  className="hover-card-shadow"
                >
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', fontFamily: 'monospace' }}>#{tk.id}</span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(tk.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`student-ticket-badge ${isResolved ? 'st-badge-resolved' : 'st-badge-pending'}`}>
                        {t(tk.status)}
                      </span>
                    </div>
                  </div>

                  {/* On Behalf Of */}
                  {tk.on_behalf_of && (
                    <div style={{ fontSize: '12.5px', color: '#475569', fontWeight: '600', marginBottom: '10px' }}>
                      {t("On Behalf Of:")} <span style={{ color: '#2563eb' }}>{tk.on_behalf_of}</span>
                    </div>
                  )}

                  {/* Subject & Description */}
                  <div style={{ marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', margin: '0 0 6px 0' }}>{t(tk.subject)}</h4>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>{t(tk.description)}</p>
                  </div>

                  {/* Screenshot */}
                  {tk.screenshot && (
                    <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                      <button
                        onClick={() => {
                          const w = window.open()
                          w.document.write(`<img src="${tk.screenshot}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`)
                        }}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          color: '#334155',
                          fontSize: '11px',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: '600',
                          transition: 'all 0.15s'
                        }}
                      >
                        <ImageIcon size={12} /> {t("View Screenshot")}
                      </button>
                    </div>
                  )}

                  {/* Footer Resolution Info */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
                    {isResolved ? (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                          <strong style={{ color: '#047857', fontSize: '12.5px' }}>{t("Resolved by")} {tk.resolver_name || t('Admin')}</strong>
                          {tk.resolved_at && (
                            <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '500' }}>
                              {new Date(tk.resolved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#475569', fontStyle: 'italic', fontSize: '13px' }}>
                          "{tk.resolution}"
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>{t("Pending resolution")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  )
}


const pillarsList = [
  { key: 'agriculture', name: 'Agriculture & Nature' },
  { key: 'physical', name: 'Physical Fitness & Sports' },
  { key: 'leadership', name: 'Team Building & Leadership' },
  { key: 'patriotism', name: 'Patriotism & Nation Building' },
  { key: 'spirituality', name: 'Spirituality & Peace' }
];

export default function FacultyDashboard({ isLtcMember = false }) {
  const { t, currentLanguage, changeLanguage } = useLanguage()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [students, setStudents] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [customCertificates, setCustomCertificates] = useState([])
  const [assignedPerformanceRoles, setAssignedPerformanceRoles] = useState([])
  const [schedules, setSchedules] = useState([])
  const [documents, setDocuments] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [facultyInfo, setFacultyInfo] = useState(null)
  const [squadLeader, setSquadLeader] = useState(null)
  const [squadStudents, setSquadStudents] = useState([])
  const [batchFaculty, setBatchFaculty] = useState([])
  const [coFaculty, setCoFaculty] = useState(null) // LTC member co-assigned to same squad
  const [batchDetails, setBatchDetails] = useState(null)
  const [certLoading, setCertLoading] = useState(false)
  const [selectedLeaderId, setSelectedLeaderId] = useState('')

  const [scheduleForm, setScheduleForm] = useState({ title: '', date: '', time: '', panel: 'A' })
  const [evalForm, setEvalForm] = useState({ student_id: '', schedule_id: '', marks: '', remarks: '', marking_scheme: '' })
  const [evalSubmitting, setEvalSubmitting] = useState(false)
  const [submittingStudentId, setSubmittingStudentId] = useState(null)
  const [selectedMarkings, setSelectedMarkings] = useState({}) // pending selection per studentId
  const [selectedAttendance, setSelectedAttendance] = useState({}) // pending attendance selection per studentId
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false)
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, onCancel: null })
  const [savedEvals, setSavedEvals] = useState({})             // confirmed saved per studentId
  const [allEvaluations, setAllEvaluations] = useState([])     // all fetched evaluations
  const [allSummaries, setAllSummaries] = useState([])         // all fetched summaries
  const [selectedPillar, setSelectedPillar] = useState('')     // active pillar selected
  const [selectedDay, setSelectedDay] = useState(null)         // active day selected (1-5)
  const [selectedAttPillar, setSelectedAttPillar] = useState('') // active attendance pillar selected
  const [selectedAttDay, setSelectedAttDay] = useState(null)     // active attendance day selected (1-5)
  const [studentSearch, setStudentSearch] = useState('')
  const [activeCardModal, setActiveCardModal] = useState(null)
  const [dnrSubmittingId, setDnrSubmittingId] = useState(null)
  const [showDnrModal, setShowDnrModal] = useState(false)
  const [undertakingFilter, setUndertakingFilter] = useState('all')
  const [preFeedbackFilter, setPreFeedbackFilter] = useState('all')
  const [postFeedbackFilter, setPostFeedbackFilter] = useState('all')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState('General')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [undertakingForm, setUndertakingForm] = useState({
    signedName: '',
    signedDate: new Date().toISOString().split('T')[0],
    tshirtSize: '',
    photoVideoConsent: false,
    tshirtConsent: false,
    dataConsent: false,
    bagCheckConsent: false,
    dosDontsConsent: false
  })
  const [submittingUndertaking, setSubmittingUndertaking] = useState(false)

  const [readDocumentIds, setReadDocumentIds] = useState(() => {
    return JSON.parse(localStorage.getItem('readDocumentIds') || '[]')
  })
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [selectedEvalScheduleId, setSelectedEvalScheduleId] = useState('')
  const [selectedEvalStudent, setSelectedEvalStudent] = useState(null)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false)
  const [dbNotifications, setDbNotifications] = useState([])
  const [dbUnreadCount, setDbUnreadCount] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true')

  const toggleSidebarCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

  const renderSidebarItem = (tab, iconElement, label, badge) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => {
          if (tab === 'superadmin-panel') {
            navigate('/superadmin');
            return;
          }
          setActiveTab(tab);
          if (isMobile) setIsSidebarOpen(false);
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
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
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '200px',
            marginLeft: (isCollapsed && !isMobile) ? '0px' : '10px',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, margin 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>{label}</span>
        </div>
        {badge && (
          <span style={{
            fontSize: '10px', fontWeight: '700',
            padding: (isCollapsed && !isMobile) ? '0px' : '2px 6px',
            borderRadius: '4px',
            background: badge.bg || (isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9'),
            color: badge.color || (isActive ? '#ffffff' : '#0f172a'),
            lineHeight: 1,
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '80px',
            overflow: 'hidden',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease, padding 0.3s cubic-bezier(0.4,0,0.2,1), visibility 0.3s'
          }}>
            {badge.text}
          </span>
        )}
      </button>
    );
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
      if (window.innerWidth > 768) setIsSidebarOpen(false)
    }
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
  }, [isSidebarOpen, isMobile])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-notif-trigger]')) {
        return;
      }
      if (isNotifOpen && !e.target.closest('[data-notif-dropdown-mobile]') && !e.target.closest('[data-notif-dropdown]')) {
        setIsNotifOpen(false);
      }
      if (isMobileLangOpen && !e.target.closest('[data-mobile-lang-dropdown]')) {
        setIsMobileLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen, isMobileLangOpen])

  const unreadDocuments = useMemo(() => documents.filter(d => !readDocumentIds.includes(d.id)), [documents, readDocumentIds])
  const unreadCount = useMemo(() => unreadDocuments.length + dbUnreadCount, [unreadDocuments, dbUnreadCount])

  const markAsRead = (id) => {
    const updated = [...readDocumentIds, id]
    setReadDocumentIds(updated)
    localStorage.setItem('readDocumentIds', JSON.stringify(updated))
  }

  const markAllAsRead = async () => {
    const allIds = documents.map(d => d.id)
    setReadDocumentIds(allIds)
    localStorage.setItem('readDocumentIds', JSON.stringify(allIds))

    try {
      await apiFetch(`${API_BASE_URL}/api/superadmin/notifications/read`, {
        method: 'POST'
      });
      setDbUnreadCount(0);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  }

  const renderNotifications = () => (
    <div style={{ position: 'relative' }} data-notif-dropdown>
      <button 
        data-notif-trigger
        className="text-white/80 hover:text-white transition-all w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 active:scale-90"
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        onClick={() => setIsNotifOpen(o => !o)}
        title={t("Notifications")}
      >
        <Bell 
          size={18} 
          style={{ 
            color: '#fbbf24', 
            filter: 'drop-shadow(0 0 5px rgba(251, 191, 36, 0.6))',
            transition: 'all 0.2s ease'
          }} 
        />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '1px 4px', fontSize: '8px', fontWeight: 700, lineHeight: 1 }}>
            {unreadCount}
          </span>
        )}
      </button>
      <div style={{ 
        position: 'absolute', 
        top: '40px', 
        right: isMobile ? '-40px' : '0', 
        background: 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 0, 0, 0.08)', 
        borderRadius: '16px', 
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)', 
        width: isMobile ? '280px' : '340px', 
        zIndex: 9999, 
        overflow: 'hidden',
        pointerEvents: isNotifOpen ? 'auto' : 'none',
        transform: isNotifOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
        opacity: isNotifOpen ? 1 : 0,
        visibility: isNotifOpen ? 'visible' : 'hidden',
        transformOrigin: 'top right',
        transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(248, 250, 252, 0.6)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Notifications</h3>
          {unreadCount > 0 && (
            <button
              style={{ background: 'none', border: 'none', color: '#0f172a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              onClick={markAllAsRead}
            >
              Mark all as read
            </button>
          )}
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {documents.length === 0 && dbNotifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No notifications.
            </div>
          ) : (
            <>
              {/* 1. Render Database Notifications */}
              {dbNotifications.slice(0, 6).map(n => {
                const isRead = !!n.read_at;
                return (
                  <div key={'db-' + n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', display: 'flex', gap: '12px', alignItems: 'flex-start', background: isRead ? 'transparent' : 'rgba(59, 130, 246, 0.06)', position: 'relative' }}>
                    {!isRead && (
                      <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }}></div>
                    )}
                    <div style={{ flex: 1, paddingLeft: isRead ? '20px' : '0' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', margin: '0 0 4px 0' }}>{n.title || 'Notification'}</p>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{n.message}</p>
                      <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                        {new Date(n.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!isRead && (
                      <button 
                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }} 
                        onClick={async () => {
                          try {
                            await apiFetch(`${API_BASE_URL}/api/superadmin/notifications/read`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ ids: [n.id] })
                            });
                            fetchDashboardData();
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      >
                        Read
                      </button>
                    )}
                  </div>
                );
              })}

              {/* 2. Render Document Notifications */}
              {documents.map(d => {
                const isRead = readDocumentIds.includes(d.id)
                return (
                  <div key={d.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', display: 'flex', gap: '12px', alignItems: 'flex-start', background: isRead ? 'transparent' : 'rgba(15, 23, 42, 0.06)', position: 'relative' }}>
                    {!isRead && (
                      <div style={{ width: '8px', height: '8px', background: '#0f172a', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }}></div>
                    )}
                    <div style={{ flex: 1, paddingLeft: isRead ? '20px' : '0' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', margin: '0 0 4px 0' }}>{d.name}</p>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0f172a', textDecoration: 'none' }}>View Document</a>
                    </div>
                    {!isRead && (
                      <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }} onClick={() => markAsRead(d.id)}>
                        Read
                      </button>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.panel && s.panel.toLowerCase().includes(studentSearch.toLowerCase()));
      
      if (!matchesSearch) return false;
      
      if (undertakingFilter === 'submitted' && s.undertaking_submitted !== true) return false;
      if (undertakingFilter === 'pending' && s.undertaking_submitted === true) return false;
      
      if (preFeedbackFilter === 'submitted' && s.pre_ltc_submitted !== true) return false;
      if (preFeedbackFilter === 'pending' && s.pre_ltc_submitted === true) return false;
      
      if (postFeedbackFilter === 'submitted' && s.post_ltc_submitted !== true) return false;
      if (postFeedbackFilter === 'pending' && s.post_ltc_submitted === true) return false;
      
      return true;
    }).sort((a, b) => {
      const roomA = a.room || '';
      const roomB = b.room || '';
      
      if (!roomA && roomB) return 1;
      if (roomA && !roomB) return -1;
      if (!roomA && !roomB) return (a.name || '').localeCompare(b.name || '');
      
      if (roomA !== roomB) {
        return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [students, studentSearch, undertakingFilter, preFeedbackFilter, postFeedbackFilter])

  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isPrimary = currentUser.is_primary === true || currentUser.is_primary === 'true'
  const isPerfAdmin = currentUser.is_performance_admin || (Array.isArray(currentUser.performance_roles) && currentUser.performance_roles.length > 0)

  useEffect(() => {
    if (isPerfAdmin) {
      navigate('/performance-admin', { replace: true })
    }
  }, [isPerfAdmin, navigate])

  if (isPerfAdmin) {
    return null
  }

  // ── Mandatory password change gate state ──
  const [gatePassForm, setGatePassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [gatePassLoading, setGatePassLoading] = useState(false)
  const [gatePassMsg, setGatePassMsg] = useState({ type: '', text: '' })
  const [gateOtpOpen, setGateOtpOpen] = useState(false)
  const [gateOtpEmail, setGateOtpEmail] = useState('')
  const [gateOtpExpiresAt, setGateOtpExpiresAt] = useState(null)

  const handleGatePasswordChange = async () => {
    if (!gatePassForm.currentPassword || !gatePassForm.newPassword || !gatePassForm.confirmPassword) {
      setGatePassMsg({ type: 'error', text: t('All fields are required.') }); return;
    }
    if (gatePassForm.newPassword.length < 6) {
      setGatePassMsg({ type: 'error', text: t('New password must be at least 6 characters.') }); return;
    }
    if (gatePassForm.newPassword !== gatePassForm.confirmPassword) {
      setGatePassMsg({ type: 'error', text: t('New passwords do not match.') }); return;
    }
    setGatePassLoading(true); setGatePassMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/request-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: gatePassForm.currentPassword, newPassword: gatePassForm.newPassword })
      })
      const data = await res.json()
      if (res.ok) { setGateOtpEmail(data.email || ''); setGateOtpExpiresAt(data.expiresAt); setGateOtpOpen(true); }
      else { setGatePassMsg({ type: 'error', text: t(data.message) }); }
    } catch { setGatePassMsg({ type: 'error', text: t('Network error.') }); }
    finally { setGatePassLoading(false); }
  }

  const handleGateVerifyOtp = async (otpCode) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/verify-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otpCode })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setGateOtpOpen(false)
        setGatePassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setGatePassMsg({ type: 'success', text: t('Password changed successfully!') })
        // Clear the gate immediately
        setFacultyInfo(prev => prev ? { ...prev, password_changed: true } : prev)
        return { success: true, message: data.message }
      } else { return { success: false, message: data.message }; }
    } catch { return { success: false, message: t('Network error while verifying OTP.') }; }
  }

  const handleGateResendOtp = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/resend-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) return { success: true, message: data.message, expiresAt: data.expiresAt, cooldownSeconds: data.cooldownSeconds }
      return { success: false, message: data.message }
    } catch { return { success: false, message: t('Network error while resending OTP.') }; }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  const handleSubmitFeedback = async (e) => {
    e.preventDefault()
    if (!feedbackText.trim()) return alert('Please enter feedback.')
    try {
      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          feedback_text: feedbackText,
          category: 'Post-LTC',
          additional_notes: additionalNotes
        })
      })
      if (res.ok) {
        alert('Post-LTC Feedback submitted successfully!')
        setFeedbackText('')
        setAdditionalNotes('')
      }
    } catch (err) {
      alert('Failed to submit feedback.')
    }
  }

  useEffect(() => {
    const expectedRole = isLtcMember ? 'ltc_member' : 'faculty'
    if (!currentUser || currentUser.role !== expectedRole) {
      navigate('/login')
      return
    }
    fetchDashboardData()

    // Lightweight notification badge polling only (30 seconds)
    const interval = setInterval(async () => {
      try {
        const notifRes = await apiFetch(`${API_BASE_URL}/api/superadmin/notifications/me`)
        if (notifRes && notifRes.ok) {
          const notifData = await notifRes.json()
          setDbNotifications((notifData.notifications || []).slice(0, 6))
          setDbUnreadCount(notifData.unread || 0)
        }
      } catch (e) {
        // silent
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Refresh lightweight notifications on window focus
  useEffect(() => {
    const onFocus = async () => {
      try {
        const notifRes = await apiFetch(`${API_BASE_URL}/api/superadmin/notifications/me`)
        if (notifRes && notifRes.ok) {
          const notifData = await notifRes.json()
          setDbNotifications((notifData.notifications || []).slice(0, 6))
          setDbUnreadCount(notifData.unread || 0)
        }
      } catch (e) {
        // silent
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // ── Browser back button logic ──
  useEffect(() => {
    window.history.pushState({ type: 'dashboard_state' }, '')

    const handlePopState = (event) => {
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard')
        window.history.pushState({ type: 'dashboard_state' }, '')
      } else {
        handleLogout()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [activeTab])

  useEffect(() => {
    if (selectedEvalScheduleId && allEvaluations.length > 0) {
      const currentSchedEvals = allEvaluations.filter(e => String(e.schedule_id) === String(selectedEvalScheduleId));
      const newSaved = {};
      currentSchedEvals.forEach(e => {
        newSaved[e.student_id] = {
          marking_scheme: e.marking_scheme,
          is_locked: e.is_locked || false
        };
      });
      setSavedEvals(newSaved);
    } else {
      setSavedEvals({});
    }
  }, [selectedEvalScheduleId, allEvaluations]);

  const apiFetch = async (url, options = {}, retries = 1) => {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'Authorization': `Bearer ${token}`, ...(options.headers || {}) }
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/')
        return null
      }
      return res
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 500))
        return apiFetch(url, options, retries - 1)
      }
      console.warn(`apiFetch notice for ${url}:`, err.message || err)
      return null
    }
  }

  const fetchDashboardData = async () => {
    try {
      // Fetch assigned students
      const res = await apiFetch(`${API_BASE_URL}/api/faculty/dashboard`)
      if (!res) return
      if (res.ok) {
        const data = await res.json()
        setStudents(data.data || [])
        setFacultyInfo(data.facultyInfo || null)
        setSquadLeader(data.squadLeader || null)
        setSquadStudents(data.squadStudents || [])
        setBatchFaculty(data.batchFaculty || [])
        setCoFaculty(data.coFaculty || null)
        setBatchDetails(data.batchDetails || null)
      }

      // Fetch Schedules
      const schedRes = await apiFetch(`${API_BASE_URL}/api/schedules`)
      if (!schedRes) return
      const schedData = await schedRes.json()
      if (schedRes.ok) setSchedules(schedData.schedules || [])

      // Fetch docs
      const docRes = await apiFetch(`${API_BASE_URL}/api/documents`)
      if (!docRes) return
      const docData = await docRes.json()
      if (docRes.ok) setDocuments(docData.documents || [])

      // Fetch attendance
      const attRes = await apiFetch(`${API_BASE_URL}/api/faculty/attendance_records`)
      if (!attRes) return
      const attData = await attRes.json()
      if (attRes.ok) setAttendanceRecords(attData.records || [])

      // Fetch evaluations
      const evalRes = await apiFetch(`${API_BASE_URL}/api/faculty/evaluations`)
      if (!evalRes) return
      const evalData = await evalRes.json()
      if (evalRes.ok) {
        setAllEvaluations(evalData.evaluations || [])
        setAllSummaries(evalData.summaries || [])
      }

      // Fetch dashboard stats
      const statsRes = await apiFetch(`${API_BASE_URL}/api/dashboard-stats`)
      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json()
        setDashboardStats(statsData)
      }

      // Fetch user notifications
      const notifRes = await apiFetch(`${API_BASE_URL}/api/superadmin/notifications/me`)
      if (notifRes && notifRes.ok) {
        const notifData = await notifRes.json()
        setDbNotifications((notifData.notifications || []).slice(0, 6))
        setDbUnreadCount(notifData.unread || 0)
      }

      // Fetch custom certificates
      const certsRes = await apiFetch(`${API_BASE_URL}/api/certificates/my-certificates`)
      if (certsRes && certsRes.ok) {
        const certsData = await certsRes.json()
        setCustomCertificates(certsData.certificates || [])
      }

      // Fetch Performance Admin roles
      try {
        const perfRoleRes = await apiFetch(`${API_BASE_URL}/api/faculty/performance-admin/my-roles`)
        if (perfRoleRes && perfRoleRes.ok) {
          const perfRoleData = await perfRoleRes.json()
          setAssignedPerformanceRoles(perfRoleData.roles || [])
        }
      } catch (perfErr) {
        console.warn('Failed to fetch performance roles:', perfErr)
      }

    } catch (err) {
      console.error('Failed to fetch faculty data', err)
    }
  }

  const downloadTshirtSizes = () => {
    try {
      if (students.length === 0) {
        alert('No students found to export.')
        return
      }

      const rows = students.map(st => {
        const row = {};
        if (!isLtcMember) {
          row['PRN'] = st.prn || '—';
        }
        row['Student Name'] = st.name;
        row['Squad'] = st.squad || 'Unassigned';
        row['Gender'] = st.gender || '—';
        if (!isLtcMember) {
          row['Email'] = st.email || '—';
        }
        row['Phone'] = st.phone || '—';
        row['T-Shirt Size'] = st.tshirt_size || 'Not Selected';
        return row;
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Student Shirt Sizes")
      
      const fileName = isLtcMember 
        ? `LTC_${facultyInfo?.squad || 'Squad'}_Shirt_Sizes.xlsx` 
        : `Faculty_${facultyInfo?.squad || 'Squad'}_Shirt_Sizes.xlsx`
        
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error(err)
      alert('Failed to download T-Shirt sizes.')
    }
  }

  const downloadSquadAttendance = () => {
    try {
      if (students.length === 0) {
        alert('No students found to export.')
        return
      }

      // Sort students panel-wise
      const sortedStudents = [...students].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      const pillarsList = [
        { key: 'bag_checking', name: 'Orientation' },
        { key: 'agriculture', name: 'Agriculture & Nature' },
        { key: 'physical', name: 'Physical Fitness & Sports' },
        { key: 'leadership', name: 'Team Building & Leadership' },
        { key: 'patriotism', name: 'Patriotism & Nation Building' },
        { key: 'spirituality', name: 'Spirituality & Peace' }
      ];

      const rows = sortedStudents.map(st => {
        const studentRecords = attendanceRecords.filter(r => String(r.student_id) === String(st.id))
        const presentCount = studentRecords.filter(r => r.status === 'Present').length
        const absentCount = studentRecords.filter(r => r.status === 'Absent').length
        const lateCount = studentRecords.filter(r => r.status === 'Late').length
        const totalMarked = presentCount + absentCount + lateCount
        const rate = totalMarked > 0 ? Math.round((presentCount * 34 + lateCount * 33) / (totalMarked * 34) * 100) : 0

        const row = {};
        if (!isLtcMember) {
          row['PRN'] = st.prn || '—';
        }
        row['Student Name'] = st.name;
        row['Squad'] = st.squad || 'Unassigned';
        row['Panel'] = st.panel || 'Unassigned';
        row['Present Count'] = presentCount;
        row['Late Count'] = lateCount;
        row['Absent Count'] = absentCount;
        row['Attendance Rate (%)'] = `${rate}%`;

        pillarsList.forEach(p => {
          if (p.key === 'bag_checking') {
            const rec = studentRecords.find(r => r.pillar === p.key && Number(r.day) === 1);
            row[`${p.name} - Day 1`] = rec ? rec.status : '—';
          } else {
            for (let d = 2; d <= 5; d++) {
              const rec = studentRecords.find(r => r.pillar === p.key && Number(r.day) === d);
              row[`${p.name} - Day ${d}`] = rec ? rec.status : '—';
            }
          }
        });

        return row
      })

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Squad Attendance")
      
      const fileName = isLtcMember 
        ? `LTC_${facultyInfo?.squad || 'Squad'}_Attendance_Report.xlsx` 
        : `Faculty_${facultyInfo?.squad || 'Squad'}_Attendance_Report.xlsx`
        
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error(err)
      alert('Failed to download squad attendance report.')
    }
  }

  const downloadSquadMarks = () => {
    try {
      if (students.length === 0) {
        alert('No students found to export.')
        return
      }

      // Sort students panel-wise
      const sortedStudents = [...students].sort((a, b) => {
        const pA = a.panel || ''
        const pB = b.panel || ''
        if (pA !== pB) return pA.localeCompare(pB)
        return (a.name || '').localeCompare(b.name || '')
      })

      const fileName = isLtcMember 
        ? `LTC_${facultyInfo?.squad || 'Squad'}_Marks_Report.xlsx` 
        : `Faculty_${facultyInfo?.squad || 'Squad'}_Marks_Report.xlsx`

      exportLtcExcel({
        title: `Life Awakening Program (LTC) - Student Evaluation Report (${facultyInfo?.squad || 'Squad'} Squad)`,
        batchName: batchDetails?.name || 'LAP-01-1026',
        students: sortedStudents,
        schedules: schedules,
        attendanceData: attendanceRecords,
        evaluationData: allEvaluations,
        summaryData: allSummaries,
        filename: fileName,
        isLtcMember: isLtcMember
      })
    } catch (err) {
      console.error(err)
      alert('Failed to download squad marks report.')
    }
  }

  // Primary Actions
  const handleAssignPanel = async (student_id, panel) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/assign-panel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id, panel })
      })
      if (res.ok) {
        alert('Panel updated successfully')
        fetchDashboardData()
      }
    } catch (err) { }
  }

  const handleAssignSquadLeader = async (studentId) => {
    if (!studentId) return alert('Please select a student.');
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/squad-leader`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Squad Leader updated successfully!');
        fetchDashboardData();
        setSelectedLeaderId('');
      } else {
        alert(data.message || 'Failed to update squad leader.');
      }
    } catch (err) {
      alert('Error updating squad leader.');
    }
  }

  const handleUpdateSquadDesignation = async (studentId, squad_designation) => {
    if (!studentId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/squad-designation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ studentId, squad_designation })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Squad role updated successfully!');
        setStudents(prev => prev.map(st => {
          const targetStudent = prev.find(s => s.id === studentId);
          if (!targetStudent || st.squad !== targetStudent.squad) return st;
          let newDesig = st.squad_designation;
          if (st.id === studentId) {
            newDesig = squad_designation || null;
          } else if (squad_designation && st.squad_designation === squad_designation) {
            newDesig = null;
          }
          return {
            ...st,
            squad_designation: newDesig,
            is_squad_leader: newDesig === 'Captain'
          };
        }));
      } else {
        alert(data.message || 'Failed to update squad role.');
      }
    } catch (err) {
      alert('Error updating squad role: ' + err.message);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(scheduleForm)
      })
      if (res.ok) {
        alert('Schedule created')
        setScheduleForm({ title: '', date: '', time: '', panel: 'A' })
        fetchDashboardData()
      }
    } catch (err) { }
  }

  const handleGenerate7DaySchedule = async () => {
    if (!scheduleForm.date || !scheduleForm.time) {
      alert("Please select a start date and time first.");
      return;
    }

    const startDate = new Date(scheduleForm.date);

    try {
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dateString = currentDate.toISOString().split('T')[0];

        let title = '';
        if (i < 3) {
          title = `RUIP - Day ${i + 1}`;
        } else {
          title = `LTC - Day ${i - 2}`;
        }

        await fetch(`${API_BASE_URL}/api/faculty/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            title,
            date: dateString,
            time: scheduleForm.time,
            panel: scheduleForm.panel
          })
        });
      }

      alert('7-Day Schedule successfully generated.');
      setScheduleForm({ title: '', date: '', time: '', panel: 'A' });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Error generating 7-day schedule');
    }
  }

  const handleMarkAttendance = (student_id, status) => {
    // Find if the student record is already locked
    const hasRec = attendanceRecords.find(a => 
      String(a.student_id) === String(student_id) && 
      a.pillar === selectedAttPillar && 
      Number(a.day) === Number(selectedAttDay)
    );
    if (hasRec?.is_locked) return;

    setSelectedAttendance(prev => {
      // If they click the already active option, we toggle it off (set to undefined)
      const currentMark = prev[student_id] !== undefined ? prev[student_id] : hasRec?.status;
      const isAlreadyActive = String(currentMark || '').toLowerCase() === String(status || '').toLowerCase();
      return {
        ...prev,
        [student_id]: isAlreadyActive ? undefined : status
      };
    });
  };

  const handleToggleDnr = async (student) => {
    const isCurrentlyDnr = !!student.is_dnr;
    const confirmMsg = isCurrentlyDnr
      ? `Remove DNR status for ${student.name}? They will be restored as an active student.`
      : `Mark ${student.name} as DNR (Did Not Report)?\n\nThis marks them as a permanent absentee who did not report to LTC camp on Day 1. Their attendance records will be set to Absent.`;
    
    if (!window.confirm(confirmMsg)) return;

    try {
      setDnrSubmittingId(student.id);
      const res = await fetch(`${API_BASE_URL}/api/faculty/students/${student.id}/dnr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: batchDetails?.batch_id || batchDetails?.id,
          is_dnr: !isCurrentlyDnr,
          reason: !isCurrentlyDnr ? 'Did Not Report on Day 1' : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ? `${data.message} (${data.error})` : (data.message || 'Failed to update DNR status'));
      }

      alert(data.message || 'DNR status updated successfully.');
      await fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setDnrSubmittingId(null);
    }
  };

  const handleMarkAllPresent = () => {
    if (!selectedAttPillar || !selectedAttDay) {
      alert('Please select a pillar and day first.')
      return
    }

    const updated = { ...selectedAttendance };
    let markedCount = 0;

    students.forEach(st => {
      // Do not mark DNR students as present
      if (st.is_dnr) return;

      const hasRec = attendanceRecords.find(a => 
        String(a.student_id) === String(st.id) && 
        a.pillar === selectedAttPillar && 
        Number(a.day) === Number(selectedAttDay)
      );
      if (!hasRec?.is_locked) {
        const currentMark = selectedAttendance[st.id] !== undefined ? selectedAttendance[st.id] : hasRec?.status;
        if (currentMark !== 'Present') {
          updated[st.id] = 'Present';
          markedCount++;
        }
      }
    });

    if (markedCount === 0) {
      alert('All editable students are already marked as Present.');
      return;
    }

    setSelectedAttendance(updated);
  };

  const handleMarkAllDone = () => {
    if (!selectedEvalScheduleId) {
      alert('Please select an activity first.');
      return;
    }

    const updated = { ...selectedMarkings };
    let markedCount = 0;

    students.forEach(st => {
      const isLocked = savedEvals[st.id]?.is_locked;
      if (!isLocked) {
        const currentMark = selectedMarkings[st.id] !== undefined ? selectedMarkings[st.id] : savedEvals[st.id]?.marking_scheme;
        if (currentMark !== 'fully_done') {
          updated[st.id] = 'fully_done';
          markedCount++;
        }
      }
    });

    if (markedCount === 0) {
      alert('All editable students are already marked as Done.');
      return;
    }

    setSelectedMarkings(updated);
  };

  const executeAttendanceSave = async (studentIdsToSave, isLocked) => {
    setAttendanceSubmitting(true);
    try {
      for (const studentId of studentIdsToSave) {
        const status = selectedAttendance[studentId] !== undefined
          ? selectedAttendance[studentId]
          : attendanceRecords.find(a => 
              String(a.student_id) === String(studentId) && 
              a.pillar === selectedAttPillar && 
              Number(a.day) === Number(selectedAttDay)
            )?.status;
        const res = await fetch(`${API_BASE_URL}/api/faculty/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ 
            batch_id: batchDetails?.batch_id || batchDetails?.id, 
            pillar: selectedAttPillar, 
            day: selectedAttDay, 
            student_id: studentId, 
            status, 
            is_locked: isLocked 
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `HTTP error ${res.status}`);
        }
      }
      setSelectedAttendance({}); // Clear pending
      alert('Attendance saved successfully!');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert(`Failed to save attendance: ${err.message}`);
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  const handleSaveAttendance = async (isLocked = false) => {
    if (!selectedAttPillar || !selectedAttDay) return;

    const unmarkedStudents = students.filter(st => {
      const pendingStatus = selectedAttendance[st.id];
      const savedRec = attendanceRecords.find(a => 
        String(a.student_id) === String(st.id) && 
        a.pillar === selectedAttPillar && 
        Number(a.day) === Number(selectedAttDay)
      );
      const statusVal = pendingStatus !== undefined ? pendingStatus : savedRec?.status;
      return !['present', 'absent', 'late'].includes(String(statusVal || '').toLowerCase());
    });

    if (isLocked && unmarkedStudents.length > 0) {
      alert(`Attendance incomplete.\n${unmarkedStudents.length} students are not marked yet.\nPlease mark all students before submitting.`);
      return;
    }

    const pendingStudentIds = Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined);
    const lockedRecords = attendanceRecords.filter(a => 
      a.pillar === selectedAttPillar && 
      Number(a.day) === Number(selectedAttDay) && 
      a.is_locked
    );
    const lockedStudentIds = new Set(lockedRecords.map(r => String(r.student_id)));

    const pendingToSave = pendingStudentIds.filter(id => !lockedStudentIds.has(String(id)));
    const unlockedSaved = attendanceRecords.filter(a => 
      a.pillar === selectedAttPillar && 
      Number(a.day) === Number(selectedAttDay) && 
      !a.is_locked
    ).map(a => String(a.student_id));

    const studentIdsToSave = isLocked
      ? Array.from(new Set([...pendingToSave, ...unlockedSaved]))
      : pendingToSave;

    if (studentIdsToSave.length === 0) return;

    const proceedSave = () => executeAttendanceSave(studentIdsToSave, isLocked);

    if (isLocked) {
      setConfirmModal({
        open: true,
        title: 'Lock Attendance Records?',
        message: 'Warning: Once locked, these attendance records cannot be modified or reopened. Do you want to proceed and lock now?',
        onConfirm: proceedSave
      });
    } else if (unmarkedStudents.length > 0) {
      setConfirmModal({
        open: true,
        title: 'Unmarked Student Attendance',
        message: `Warning: You have left ${unmarkedStudents.length} student(s) unmarked. Would you like to skip them and proceed with saving, or go back to mark them?`,
        onConfirm: proceedSave
      });
    } else {
      proceedSave();
    }
  };

  const handleDownloadStudentFile = async (studentId, type) => {
    try {
      let url = '';
      let filename = '';
      if (type === 'undertaking') {
        url = `${API_BASE_URL}/api/student/undertaking/pdf/${studentId}`;
        filename = `Undertaking_Student_${studentId}.pdf`;
      } else {
        url = `${API_BASE_URL}/api/student/feedback/pdf/${studentId}/${type}`;
        filename = `${type}_Feedback_Student_${studentId}.pdf`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to download file.');
      }

      const blob = await res.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const parts = disposition.split('filename=');
        filename = parts[1].replace(/['"]/g, '');
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      alert('Error downloading document: ' + err.message);
    }
  };

  const [redFlagModal, setRedFlagModal] = useState({ open: false, studentId: null, studentName: '' })
  const [redFlagForm, setRedFlagForm] = useState({ category: 'Disturbance', reason: '' })
  const [redFlagSubmitting, setRedFlagSubmitting] = useState(false)

  const handleOpenRedFlagModal = (student) => {
    setRedFlagModal({ open: true, studentId: student.id, studentName: student.name })
    setRedFlagForm({ category: 'Disturbance', reason: '' })
  }

  const handleSubmitRedFlag = async (e) => {
    e.preventDefault()
    if (!redFlagForm.reason.trim()) return alert('Please describe the incident before submitting.')
    setRedFlagSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/add-red-flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: redFlagModal.studentId, category: redFlagForm.category, reason: redFlagForm.reason })
      })
      const data = await res.json()
      if (res.ok) {
        setStudents(students.map(s => s.id === redFlagModal.studentId ? { ...s, red_flag: true } : s))
        setRedFlagModal({ open: false, studentId: null, studentName: '' })
        alert('Red flag submitted successfully. The admin will be notified.')
      } else {
        alert(data.message || 'Failed to submit red flag')
      }
    } catch (err) {
      alert('Network error. Please try again.')
    } finally { setRedFlagSubmitting(false) }
  }


  const handlePrintAttendance = async () => {
    if (!selectedAttPillar || !selectedAttDay) return;
    const pillarsList = [
      { key: 'bag_checking', name: 'Orientation' },
      { key: 'agriculture', name: 'Agriculture & Nature' },
      { key: 'physical', name: 'Physical Fitness & Sports' },
      { key: 'leadership', name: 'Team Building & Leadership' },
      { key: 'patriotism', name: 'Patriotism & Nation Building' },
      { key: 'spirituality', name: 'Spirituality & Peace' }
    ];
    const pillarName = pillarsList.find(p => p.key === selectedAttPillar)?.name || selectedAttPillar;

    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.style.padding = '30px';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

    const studentRows = students.map((st, i) => {
      const rec = attendanceRecords.find(a => 
        String(a.student_id) === String(st.id) && 
        a.pillar === selectedAttPillar && 
        Number(a.day) === Number(selectedAttDay)
      );
      const status = rec?.status || '—';
      const isP = status === 'Present';
      const isL = status === 'Late';
      const isA = status === 'Absent';

      return `
        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; text-align: center; width: 30px; white-space: nowrap;">${i + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; width: 90px; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${st.prn || '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; font-weight: 600; width: 180px; word-break: break-word;">${st.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; width: 50px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${st.panel || '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; width: 40px; font-size: 11px; font-weight: 800; color: #16a34a;">${isP ? '' : ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; width: 40px; font-size: 11px; font-weight: 800; color: #dc2626;">${isA ? '' : ''}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; width: 265px; font-size: 11px;">${rec?.is_locked ? 'Locked' : ''}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <style>
        * { box-sizing: border-box !important; }
        tr { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .info-item {
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .info-label {
          font-size: 9.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 2px;
          letter-spacing: 0.3px;
        }
        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }
      </style>

      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #1e3a8a; text-transform: uppercase;">Life Transformation Cohort (LTC)</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">MIT World Peace University</div>
        </div>
        <div style="background: #eff6ff; color: #1e40af; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px;">
          Attendance Sheet
        </div>
      </div>
      
      <div style="margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #3b82f6; letter-spacing: 0.5px; margin-bottom: 4px;">Pillar Details</div>
        <h1 style="font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1.3;">${pillarName}</h1>
        
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Day</div>
            <div class="info-value">Day ${selectedAttDay}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Batch</div>
            <div class="info-value">${batchDetails?.name || '—'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Assigned Squad</div>
            <div class="info-value">${facultyInfo?.squad || 'Unassigned'}</div>
          </div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; border: 1px solid #cbd5e1;">
        <thead>
          <tr>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 30px;">#</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 90px;">PRN</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 180px;">Student Name</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 50px;">Panel</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 40px;">P</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 40px;">A</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 265px;">Signature / Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>
      
      <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; font-weight: 600; page-break-inside: avoid;">
        <div style="width: 220px; border-top: 1.5px solid #cbd5e1; text-align: center; padding-top: 8px; margin-top: 40px;">Faculty / LTC Member Signature</div>
        <div style="width: 220px; border-top: 1.5px solid #cbd5e1; text-align: center; padding-top: 8px; margin-top: 40px;">LTC Coordinator Verification</div>
      </div>
    `;

    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `LTC_Attendance_${pillarName.replace(/\s+/g, '_')}_Day_${selectedAttDay}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().from(container).set(opt).save();
    } catch (err) {
      console.error(err);
      alert('Failed to download PDF.');
    } finally {
      document.body.removeChild(container);
    }
  };

  const handlePrintEvaluations = async () => {
    const sel = schedules.find(s => String(s.id) === String(selectedEvalScheduleId))
    if (!sel) return;

    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.style.padding = '30px';
    container.style.color = '#0f172a';
    container.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

    const studentRows = students.map((st, i) => {
      return `
        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; text-align: center; width: 30px; white-space: nowrap;">${i + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; width: 90px; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${st.prn || '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; font-weight: 600; width: 180px; word-break: break-word;">${st.name}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; width: 50px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${st.panel || '—'}</td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; width: 60px;"><span style="display: inline-block; width: 12px; height: 12px; border: 1.5px solid #64748b; border-radius: 3px;"></span></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; width: 60px;"><span style="display: inline-block; width: 12px; height: 12px; border: 1.5px solid #64748b; border-radius: 3px;"></span></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; width: 45px;"><span style="display: inline-block; width: 12px; height: 12px; border: 1.5px solid #64748b; border-radius: 3px;"></span></td>
          <td style="border: 1px solid #cbd5e1; padding: 8px 10px; width: 220px;"></td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <style>
        * { box-sizing: border-box !important; }
        tr { page-break-inside: avoid !important; }
        thead { display: table-header-group !important; }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .info-item {
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        .info-label {
          font-size: 9.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 2px;
          letter-spacing: 0.3px;
        }
        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
        }
      </style>

      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 18px; font-weight: 900; letter-spacing: 0.5px; color: #065f46; text-transform: uppercase;">Life Transformation Cohort (LTC)</div>
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">MIT World Peace University</div>
        </div>
        <div style="background: #ecfdf5; color: #065f46; font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px;">
          Evaluation Sheet
        </div>
      </div>
      
      <div style="margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #10b981; letter-spacing: 0.5px; margin-bottom: 4px;">Activity Details</div>
        <h1 style="font-size: 20px; font-weight: 800; margin: 0; color: #0f172a; line-height: 1.3;">${sel.title}</h1>
        
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Date / Day</div>
            <div class="info-value">${sel.date}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Time Slot</div>
            <div class="info-value">${sel.time || '—'}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Assigned Squad</div>
            <div class="info-value">${facultyInfo?.squad || 'Unassigned'}</div>
          </div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: fixed; border: 1px solid #cbd5e1;">
        <thead>
          <tr>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 30px;">#</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 90px;">PRN</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 180px;">Student Name</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 50px;">Panel</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 60px;">Not Done</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 60px;">Partial</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: center; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 45px;">Done</th>
            <th style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 4px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; width: 220px;">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>
      
      <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 12px; font-weight: 600; page-break-inside: avoid;">
        <div style="width: 220px; border-top: 1.5px solid #cbd5e1; text-align: center; padding-top: 8px; margin-top: 40px;">Faculty / LTC Member Signature</div>
        <div style="width: 220px; border-top: 1.5px solid #cbd5e1; text-align: center; padding-top: 8px; margin-top: 40px;">LTC Coordinator Verification</div>
      </div>
    `;

    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `LTC_Evaluation_${sel.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().from(container).set(opt).save();
    } catch (err) {
      console.error(err);
      alert('Failed to download PDF.');
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleSaveEvaluations = async (isLocked = false) => {
    const pillarsList = [
      { key: 'agriculture', name: 'Agriculture & Nature' },
      { key: 'physical', name: 'Physical Fitness & Sports' },
      { key: 'leadership', name: 'Team Building & Leadership' },
      { key: 'patriotism', name: 'Patriotism & Nation Building' },
      { key: 'spirituality', name: 'Spirituality & Peace' }
    ];

    // Find the schedule for the selected pillar & day to check for absent students
    const sched = schedules.find(s => 
      s.date === `Day ${selectedDay}` && 
      s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
    );

    // Find marked and unmarked students
    const markedStudentsList = students.filter(st => {
      const pending = selectedMarkings[st.id];
      const existing = allEvaluations.find(e => 
        String(e.student_id) === String(st.id) && 
        e.pillar === selectedPillar && 
        Number(e.day) === Number(selectedDay)
      );

      const studentAtt = sched ? attendanceRecords.find(a => 
        String(a.student_id) === String(st.id) && 
        String(a.schedule_id) === String(sched.id)
      ) : null;
      const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';

      return pending !== undefined || existing !== undefined || isAbsent;
    });

    const unmarkedCount = students.length - markedStudentsList.length;

    if (markedStudentsList.length === 0) {
      alert('Please evaluate at least one student before saving or submitting.');
      return;
    }

    setEvalSubmitting(true);
    try {
      const payload = {
        pillar: selectedPillar,
        day: selectedDay,
        evaluations: markedStudentsList.map(st => {
          const pending = selectedMarkings[st.id] || {};
          const existing = allEvaluations.find(e => 
            String(e.student_id) === String(st.id) && 
            e.pillar === selectedPillar && 
            Number(e.day) === Number(selectedDay)
          ) || {};

          const studentAtt = sched ? attendanceRecords.find(a => 
            String(a.student_id) === String(st.id) && 
            String(a.schedule_id) === String(sched.id)
          ) : null;
          const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';

          if (isAbsent) {
            return {
              student_id: st.id,
              attendance_marks: 0,
              participation_marks: 0,
              effort_marks: 0,
              learning_marks: 0,
              discipline_marks: 0,
              reflection_marks: 0,
              remarks: 'Absent',
              status: isLocked ? 'locked' : 'draft'
            };
          }

          return {
            student_id: st.id,
            attendance_marks: pending.attendance_marks !== undefined ? pending.attendance_marks : (existing.attendance_marks || 0),
            participation_marks: pending.participation_marks !== undefined ? pending.participation_marks : (existing.participation_marks || 0),
            effort_marks: pending.effort_marks !== undefined ? pending.effort_marks : (existing.effort_marks || 0),
            learning_marks: pending.learning_marks !== undefined ? pending.learning_marks : (existing.learning_marks || 0),
            discipline_marks: pending.discipline_marks !== undefined ? pending.discipline_marks : (existing.discipline_marks || 0),
            reflection_marks: pending.reflection_marks !== undefined ? pending.reflection_marks : (existing.reflection_marks || 0),
            remarks: pending.remarks !== undefined ? pending.remarks : (existing.remarks || ''),
            status: isLocked ? 'locked' : 'draft'
          };
        })
      };

      const res = await fetch(`${API_BASE_URL}/api/faculty/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Refresh evaluations
        const refRes = await apiFetch(`${API_BASE_URL}/api/faculty/evaluations`);
        if (refRes && refRes.ok) {
          const data = await refRes.json();
          setAllEvaluations(data.evaluations || []);
          setAllSummaries(data.summaries || []);
          setSelectedMarkings({}); // Clear pending
          
          if (isLocked) {
            alert('Evaluations have been locked and submitted successfully.');
          } else {
            if (unmarkedCount > 0) {
              alert(`Evaluation drafts saved successfully. Note: ${unmarkedCount} student(s) are still left unmarked (skipped). You can edit and grade them after saving also.`);
            } else {
              alert('Evaluation drafts saved successfully.');
            }
          }
        }
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Failed to save evaluations.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save evaluations.');
    } finally {
      setEvalSubmitting(false);
    }
  };

  const handleEvaluate = async (isLocked = false) => {
    const pillarsList = [
      { key: 'agriculture', name: 'Agriculture & Nature' },
      { key: 'physical', name: 'Physical Fitness & Sports' },
      { key: 'leadership', name: 'Team Building & Leadership' },
      { key: 'patriotism', name: 'Patriotism & Nation Building' },
      { key: 'spirituality', name: 'Spirituality & Peace' }
    ];
    const sched = schedules.find(s => 
      s.date === `Day ${selectedDay}` && 
      s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
    );

    if (students.length > 0) {
      const attDone = students.every(st => {
        const rec = attendanceRecords.find(a => 
          String(a.student_id) === String(st.id) && 
          a.pillar === selectedPillar && 
          Number(a.day) === Number(selectedDay)
        );
        return rec && ['present', 'absent', 'late'].includes(String(rec.status || '').toLowerCase());
      });
      if (!attDone) {
        alert('Attendance is incomplete for this session. Please complete marking student attendance before evaluating.');
        return;
      }
    }

    const markedStudentsList = students.filter(st => {
      const pending = selectedMarkings[st.id];
      const existing = allEvaluations.find(e => 
        String(e.student_id) === String(st.id) && 
        e.pillar === selectedPillar && 
        Number(e.day) === Number(selectedDay)
      );

      const studentAtt = sched ? attendanceRecords.find(a => 
        String(a.student_id) === String(st.id) && 
        String(a.schedule_id) === String(sched.id)
      ) : null;
      const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';

      return pending !== undefined || existing !== undefined || isAbsent;
    });

    const unmarkedCount = students.length - markedStudentsList.length;

    if (isLocked) {
      const warningMessage = unmarkedCount > 0
        ? `Warning: You have left ${unmarkedCount} student(s) unmarked. If you submit, the marked student evaluations will be locked and cannot be edited. Do you want to proceed?`
        : 'Warning: Once submitted, the evaluations will be locked and cannot be edited. Do you want to proceed?';

      setConfirmModal({
        open: true,
        title: 'Lock Evaluation Records?',
        message: warningMessage,
        onConfirm: () => handleSaveEvaluations(true)
      });
    } else {
      handleSaveEvaluations(false);
    }
  };

  const handleSubmitUndertaking = async (e) => {
    e.preventDefault()
    if (!undertakingForm.signedName.trim()) return alert('Please type your full name to sign the undertaking.')
    if (!undertakingForm.tshirtSize || undertakingForm.tshirtSize === '-- Select Size --') return alert('Please select a T-Shirt size before submitting.')
    if (!undertakingForm.photoVideoConsent) return alert('Please accept the Photo / Video Consent.')
    if (!undertakingForm.tshirtConsent) return alert('Please accept the T-Shirt Size Consent.')
    if (!undertakingForm.dataConsent) return alert('Please accept the Personal / Health Data Consent.')
    if (!undertakingForm.bagCheckConsent) return alert('Please accept the Bag Checking Consent.')
    if (!undertakingForm.dosDontsConsent) return alert("Please accept the Do's & Don'ts Consent.")

    setSubmittingUndertaking(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/faculty/submit-undertaking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(undertakingForm)
      })
      if (res.ok) {
        alert('Undertaking signed and submitted successfully!')
        fetchDashboardData()
      } else {
        const errData = await res.json()
        alert(errData.message || 'Failed to submit undertaking.')
      }
    } catch (err) {
      alert('Error submitting undertaking.')
    } finally {
      setSubmittingUndertaking(false)
    }
  }

  const handlePrintUndertaking = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>LTC Faculty Undertaking</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; background: #ffffff; }
            .document { border: 2px solid #0f172a; border-radius: 16px; padding: 40px; max-width: 700px; margin: 0 auto; background: #ffffff; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
            h2 { font-size: 22px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .subtitle { font-size: 13px; color: #64748b; margin-top: 6px; }
            .receipt { display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; padding: 20px; }
            .checkmark { font-size: 24px; color: #0f172a; font-weight: bold; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left; width: 100%; margin-top: 20px; border: 1px dashed #cbd5e1; padding: 20px; border-radius: 12px; background: #f8fafc; }
            .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
            .value { font-size: 14px; font-weight: 800; color: #0f172a; margin: 4px 0 0 0; }
            .sig { font-family: Georgia, serif; font-style: italic; font-size: 16px; }
            .code-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; font-size: 13.5px; color: #334155; line-height: 1.6; text-align: left; margin-bottom: 20px; }
            ol { margin: 0; padding-left: 20px; }
            li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="document">
            <div class="header">
              <h2>LTC Faculty Undertaking</h2>
              <div class="subtitle">Official Immersion Honor Code & Agreement</div>
            </div>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #0f172a;">LTC Honor Code & Conduct Policy</p>
              <p style="margin: 0 0 10px 0;">As a representative of my institution participating in the Life Awakening Program (LTC) program, I solemnly declare that:</p>
              <ol>
                <li>I will actively mentor and guide my assigned squad members, helping them achieve all project and evaluation milestones.</li>
                <li>I will attend and evaluate scheduled sessions on time and grade students fairly according to the rubric.</li>
                <li>I will maintain high standards of professionalism and follow the official guidelines set by the LTC administration.</li>
                <li>I understand that my role is crucial for the transformation of my squad students.</li>
              </ol>
            </div>

            <div class="receipt">
              <div class="checkmark">SIGNED UNDERTAKING RECORD</div>
              <div class="details-grid">
                <div>
                  <div class="label">Signed Signature</div>
                  <div class="value sig">\${facultyInfo?.undertaking_signed_name || ''}</div>
                </div>
                <div>
                  <div class="label">Department</div>
                  <div class="value">\${facultyInfo?.department || ''}</div>
                </div>
                <div>
                  <div class="label">Submission Date</div>
                  <div class="value">\${facultyInfo?.undertaking_signed_date || ''}</div>
                </div>
                <div>
                  <div class="label">Verification Status</div>
                  <div class="value" style="color: #0f172a;">Verified Record</div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  const renderDesktopSidebar = () => {
    return (
      <aside 
        className={`relative flex-shrink-0 bg-white flex flex-col transition-[width] duration-300 ease-in-out z-20 ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}`} 
        style={{
          height: '100%',
          borderRight: '1px solid #e2e8f0',
          boxShadow: '1px 0 10px rgba(0, 0, 0, 0.01)',
          overflow: 'visible'
        }}
      >
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
          <span className="material-symbols-outlined" style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
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

        {/* Logo / Brand Header — cross-fade */}
        <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0, transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)', padding: isCollapsed ? '0' : '0 24px' }}>
          <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain', position: 'absolute', left: isCollapsed ? '50%' : '24px', transform: isCollapsed ? 'translateX(-50%)' : 'none', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
          <img src="/lg.png" alt="LTC Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', opacity: isCollapsed ? 1 : 0, transform: isCollapsed ? 'scale(1)' : 'scale(0.7)', transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
        </div>

        {/* Navigation Area */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4 no-scrollbar" style={{ display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Overview")}</span>
            {renderSidebarItem('dashboard', <GraduationCap />, t("My Overview"))}
            {renderSidebarItem('students', <Users />, t("Students"))}
            {renderSidebarItem('pre-ltc-feedback', <ClipboardList />, t("Pre-LTC Feedback"))}
            {renderSidebarItem('undertaking', <FileText />, t("Undertaking Form"), !facultyInfo?.undertaking_submitted ? { text: t("Pending"), bg: '#ef4444', color: '#ffffff' } : null)}
            {renderSidebarItem('attendance', <ClipboardList />, t("My Attendance"))}
            {assignedPerformanceRoles.length > 0 && renderSidebarItem('performance-admin', <Award />, t("Performance Admin"), { text: `${assignedPerformanceRoles.length}`, bg: '#ea580c', color: '#ffffff' })}
            {currentUser?.is_pre_post_admin && renderSidebarItem('superadmin-panel', <ShieldCheck />, "Super Admin")}

            {renderSidebarItem('timetable', <Clock />, t("LAP Timetable"))}
            {renderSidebarItem('profile', <User />, t("My Profile"))}
            {renderSidebarItem('journey', <Compass />, t("LAP Journey Media"))}
            {renderSidebarItem('certificates', <Award />, t("My Certificates"))}

            <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Feedback & Support")}</span>
            {renderSidebarItem('guidelines', <FileText />, t("Docs & Guidelines"), unreadCount > 0 ? { text: String(unreadCount) } : null)}
            {renderSidebarItem('feedback', <MessageSquare />, t("Post-LTC Feedback"))}
            {renderSidebarItem('faq', <HelpCircle />, t("FAQs"))}
            {renderSidebarItem('tickets', <MessageSquare />, t("Raise Ticket"))}
          </nav>
        </div>

        {/* Bottom Actions - unified smooth transitions */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', transition: 'gap 0.35s cubic-bezier(0.4,0,0.2,1)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', flexShrink: 0, transition: 'all 0.3s ease' }} title={currentUser?.name || (isLtcMember ? 'LTC Member' : 'Faculty')}>
              {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (isLtcMember ? 'LT' : 'FC')}
            </div>
            <div style={{ overflow: 'hidden', maxWidth: isCollapsed ? '0px' : '180px', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.name || (isLtcMember ? t('LTC Member') : t('Faculty Member'))}</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>{isLtcMember ? t('LTC Member') : t('Faculty')}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '10px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s ease', width: '100%', outline: 'none', boxShadow: 'none', overflow: 'hidden' }}
            className="hover:bg-slate-50 hover:text-slate-900"
            title={t("Sign Out")}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <span style={{ maxWidth: isCollapsed ? '0px' : '120px', overflow: 'hidden', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>{t("Sign Out")}</span>
          </button>
        </div>
      </aside>
    )
  }

  const renderMobileSidebar = () => {
    return (
      <>
        {/* Smooth Overlay */}
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
        <div className="sidebar mobile-sidebar" style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0, zIndex: 999999, height: '100vh',
          transform: !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingTop: 'env(safe-area-inset-top)',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          width: '270px',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '10px 0 40px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain' }} />
            <button 
              className="sidebar-close-btn" 
              onClick={() => setIsSidebarOpen(false)} 
              aria-label="Close Sidebar" 
              style={{ 
                border: 'none', 
                background: '#f1f5f9', 
                borderRadius: '50%', 
                width: '28px', 
                height: '28px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#64748b', 
                cursor: 'pointer',
                padding: 0,
                boxShadow: 'none'
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }} className="no-scrollbar">
            <nav style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '12px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Overview")}</span>
              {renderSidebarItem('dashboard', <GraduationCap />, t("My Overview"))}
              {renderSidebarItem('students', <Users />, t("Students"))}
              {renderSidebarItem('pre-ltc-feedback', <ClipboardList />, t("Pre-LTC Feedback"))}
              {renderSidebarItem('undertaking', <FileText />, t("Undertaking Form"), !facultyInfo?.undertaking_submitted ? { text: t("Pending"), bg: '#ef4444', color: '#ffffff' } : null)}
              {renderSidebarItem('attendance', <ClipboardList />, t("My Attendance"))}
              {assignedPerformanceRoles.length > 0 && renderSidebarItem('performance-admin', <Award />, t("Performance Admin"), { text: `${assignedPerformanceRoles.length}`, bg: '#ea580c', color: '#ffffff' })}
              {currentUser?.is_pre_post_admin && renderSidebarItem('superadmin-panel', <ShieldCheck />, "Super Admin")}

              {renderSidebarItem('timetable', <Clock />, t("LAP Timetable"))}
              {renderSidebarItem('profile', <User />, t("My Profile"))}
              {renderSidebarItem('journey', <Compass />, t("LAP Journey Media"))}
              {renderSidebarItem('certificates', <Award />, t("My Certificates"))}

              <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Feedback & Support")}</span>
              {renderSidebarItem('guidelines', <FileText />, t("Docs & Guidelines"), unreadCount > 0 ? { text: String(unreadCount) } : null)}
              {renderSidebarItem('feedback', <MessageSquare />, t("Post-LTC Feedback"))}
              {renderSidebarItem('faq', <HelpCircle />, t("FAQs"))}
              {renderSidebarItem('tickets', <MessageSquare />, t("Raise Ticket"))}
            </nav>
          </div>

          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#ea580c',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '13px'
              }}>
                {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (isLtcMember ? 'LT' : 'FC')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.name || (isLtcMember ? t('LTC Member') : t('Faculty Member'))}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {isLtcMember ? t('LTC Member') : t('Faculty')}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.15s',
                width: '100%',
                outline: 'none',
                boxShadow: 'none'
              }}
              className="hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} />
              <span>{t("Sign Out")}</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  const renderContent = () => (
    <>
        {!facultyInfo?.undertaking_submitted && (
          <div style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Action Required: Your official LTC Faculty Undertaking is pending! Please sign it immediately.
            </span>
            <button 
              onClick={() => setActiveTab('undertaking')} 
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap'
              }}
            >
              Sign Now
            </button>
          </div>
        )}






        {activeTab === 'students' && (
          <div className="space-y-6 animate-fade-in">
            {/* Active Students Table Card */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users className="text-primary" /> Active Students
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn" 
                    onClick={downloadSquadAttendance} 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', background: '#16a34a', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                  >
                    <Download size={13} /> Download Squad Attendance
                  </button>

                  {isLtcMember && (
                    <button 
                      className="btn" 
                      onClick={downloadTshirtSizes} 
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', background: '#000000', color: '#ffffff', border: 'none', cursor: 'pointer' }}
                    >
                      <Download size={13} /> Download Shirt Size
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={fetchDashboardData}>
                    <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh Data
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
                <div className="search-wrapper" style={{ flex: 1, margin: 0 }}>
                  <Search className="search-icon" size={20} />
                  <input
                    type="text"
                    placeholder="Search students..."
                    className="input-field"
                    style={{ margin: 0 }}
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
                <div style={{ minWidth: '180px' }}>
                  <select
                    className="input-field"
                    style={{ margin: 0, height: '100%', cursor: 'pointer', outline: 'none' }}
                    value={undertakingFilter}
                    onChange={(e) => setUndertakingFilter(e.target.value)}
                  >
                    <option value="all">All Undertakings</option>
                    <option value="submitted">Submitted</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div style={{ minWidth: '180px' }}>
                  <select
                    className="input-field"
                    style={{ margin: 0, height: '100%', cursor: 'pointer', outline: 'none' }}
                    value={preFeedbackFilter}
                    onChange={(e) => setPreFeedbackFilter(e.target.value)}
                  >
                    <option value="all">All Pre-Feedback</option>
                    <option value="submitted">Pre-LTC Submitted</option>
                    <option value="pending">Pre-LTC Pending</option>
                  </select>
                </div>
                <div style={{ minWidth: '180px' }}>
                  <select
                    className="input-field"
                    style={{ margin: 0, height: '100%', cursor: 'pointer', outline: 'none' }}
                    value={postFeedbackFilter}
                    onChange={(e) => setPostFeedbackFilter(e.target.value)}
                  >
                    <option value="all">All Post-Feedback</option>
                    <option value="submitted">Post-LTC Submitted</option>
                    <option value="pending">Post-LTC Pending</option>
                  </select>
                </div>
              </div>

              {/* Gender and Total stats summary */}
              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '20px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.02)',
                border: '1px dashed rgba(15, 23, 42, 0.08)',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <div style={{ fontSize: '13.5px', color: '#64748b', fontWeight: '500' }}>
                  Total Students: <strong style={{ color: '#0f172a', fontWeight: '800' }}>{filteredStudents.length}</strong>{filteredStudents.length !== students.length && ` (of ${students.length})`}
                </div>
                <div style={{ height: '14px', width: '1px', background: 'rgba(15, 23, 42, 0.08)' }} />
                <div style={{ fontSize: '13.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                   Boys: <strong style={{ color: '#2563eb', fontWeight: '800' }}>{filteredStudents.filter(s => ['male', 'm'].includes(s.gender?.toLowerCase()?.trim())).length}</strong>
                  {filteredStudents.length !== students.length && (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                      (of {students.filter(s => ['male', 'm'].includes(s.gender?.toLowerCase()?.trim())).length})
                    </span>
                  )}
                </div>
                <div style={{ height: '14px', width: '1px', background: 'rgba(15, 23, 42, 0.08)' }} />
                <div style={{ fontSize: '13.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                   Girls: <strong style={{ color: '#db2777', fontWeight: '800' }}>{filteredStudents.filter(s => ['female', 'f'].includes(s.gender?.toLowerCase()?.trim())).length}</strong>
                  {filteredStudents.length !== students.length && (
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                      (of {students.filter(s => ['female', 'f'].includes(s.gender?.toLowerCase()?.trim())).length})
                    </span>
                  )}
                </div>
                {students.some(s => !s.gender || !['male', 'm', 'female', 'f'].includes(s.gender?.toLowerCase()?.trim())) && (
                  <>
                    <div style={{ height: '14px', width: '1px', background: 'rgba(15, 23, 42, 0.08)' }} />
                    <div style={{ fontSize: '13.5px', color: '#64748b', fontWeight: '500' }}>
                      Unspecified: <strong style={{ color: '#64748b', fontWeight: '800' }}>{filteredStudents.filter(s => !s.gender || !['male', 'm', 'female', 'f'].includes(s.gender?.toLowerCase()?.trim())).length}</strong>
                      {filteredStudents.length !== students.length && (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                          (of {students.filter(s => !s.gender || !['male', 'm', 'female', 'f'].includes(s.gender?.toLowerCase()?.trim())).length})
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div 
                style={{ 
                  overflowX: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
                  background: '#ffffff'
                }}
                className="no-scrollbar"
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', width: '60px' }}>{t("S.No.")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("LTC ID")}</th>
                      {!isLtcMember && <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("PRN")}</th>}
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Name")}</th>
                      {!isLtcMember && <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Email")}</th>}
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Feedback Status")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Room")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Designation")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Squad Role")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Undertaking")}</th>
                      <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', textAlign: 'right' }}>{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, index) => {
                      return (
                        <tr 
                          key={s.id}
                          style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                          className="hover:bg-slate-50/50"
                        >
                          {/* S.No. */}
                          <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                            {index + 1}
                          </td>

                          {/* LTC ID */}
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600', fontFamily: 'monospace' }}>
                              {s.ltc_id || '—'}
                            </span>
                          </td>

                          {/* PRN */}
                          {!isLtcMember && (
                            <td style={{ padding: '12px 20px' }}>
                              <span style={{ fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>
                                {s.prn || '—'}
                              </span>
                            </td>
                          )}

                          {/* Name */}
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>{s.name}</span>
                              {s.is_squad_leader && (
                                <span style={{ background: 'rgba(234, 88, 12, 0.08)', color: '#ea580c', fontSize: '9.5px', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', letterSpacing: '0.3px' }}>
                                  LEADER
                                </span>
                              )}
                              {s.squad_designation && (
                                <span style={{ background: '#e2f5ea', color: '#15803d', fontSize: '9.5px', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                                  {s.squad_designation}
                                </span>
                              )}
                              {s.red_flag && (
                                <span style={{ background: '#fee2e2', color: '#ef4444', fontSize: '9.5px', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', letterSpacing: '0.3px' }}>
                                  RED FLAGGED
                                </span>
                              )}
                              {s.is_dnr && (
                                <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '9.5px', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', letterSpacing: '0.3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <UserX size={10} /> DNR (DID NOT REPORT)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Email */}
                          {!isLtcMember && (
                            <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>
                              {s.email}
                            </td>
                          )}

                          {/* Feedback Status */}
                          <td style={{ padding: '12px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', minWidth: '35px' }}>Pre:</span>
                                {s.pre_ltc_submitted ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '11.5px', fontWeight: '700' }}>
                                    <CheckCircle size={13} strokeWidth={2.5} /> Submitted
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ea580c', fontSize: '11.5px', fontWeight: '700' }}>
                                    <Clock size={13} strokeWidth={2.5} /> Pending
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', minWidth: '35px' }}>Post:</span>
                                {s.post_ltc_submitted ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '11.5px', fontWeight: '700' }}>
                                    <CheckCircle size={13} strokeWidth={2.5} /> Submitted
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ea580c', fontSize: '11.5px', fontWeight: '700' }}>
                                    <Clock size={13} strokeWidth={2.5} /> Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Room */}
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                              {s.room || '—'}
                            </span>
                          </td>

                          {/* Room Designation */}
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                              {s.room_designation || '—'}
                            </span>
                          </td>

                          {/* Squad Role (Manual Captain / VC Selection) */}
                          <td style={{ padding: '12px 20px' }}>
                            <select
                              value={s.squad_designation || ''}
                              onChange={(e) => handleUpdateSquadDesignation(s.id, e.target.value)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '8px',
                                border: s.squad_designation === 'Captain' ? '1px solid #f59e0b' : s.squad_designation ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                fontSize: '11.5px',
                                fontWeight: '750',
                                background: s.squad_designation === 'Captain' ? '#fef3c7' : s.squad_designation ? '#e0f2fe' : '#ffffff',
                                color: s.squad_designation === 'Captain' ? '#b45309' : s.squad_designation ? '#0369a1' : '#475569',
                                cursor: 'pointer',
                                outline: 'none',
                                width: '145px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}
                            >
                              <option value="">{t("Member")}</option>
                              <option value="Captain">{t("Squad Captain")}</option>
                              <option value="Vice Captain (Boy)">{t("Vice Captain (Boy)")}</option>
                              <option value="Vice Captain (Girl)">{t("Vice Captain (Girl)")}</option>
                            </select>
                          </td>

                          {/* Undertaking */}
                          <td style={{ padding: '12px 20px' }}>
                            {s.undertaking_submitted ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ background: '#eff6ff', color: '#1e40af', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', alignSelf: 'flex-start' }}>
                                  Submitted
                                </span>
                                {s.undertaking_signed_date && (
                                  <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                                    {s.undertaking_signed_date}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ background: '#f8fafc', color: '#0f172a', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', alignSelf: 'flex-start' }}>
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '4px 8px', fontSize: '11px', borderColor: s.red_flag ? '#dc2626' : 'var(--border)', color: s.red_flag ? '#dc2626' : 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => handleOpenRedFlagModal(s)}
                              >
                                {s.red_flag ? 'Flagged' : 'Red Flag'}
                              </button>

                              <button
                                className="btn btn-outline"
                                style={{ 
                                  padding: '4px 8px', 
                                  fontSize: '11px', 
                                  borderColor: s.is_dnr ? '#fca5a5' : '#fecaca', 
                                  color: s.is_dnr ? '#b91c1c' : '#e11d48', 
                                  background: s.is_dnr ? '#fee2e2' : '#fff1f2',
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: 4 
                                }}
                                onClick={() => handleToggleDnr(s)}
                                disabled={dnrSubmittingId === s.id}
                                title={s.is_dnr ? 'Undo DNR status' : 'Mark as DNR (Did Not Report)'}
                              >
                                <UserX size={11} />
                                {s.is_dnr ? 'Undo DNR' : 'DNR'}
                              </button>

                              {s.undertaking_submitted && (
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1e40af', borderColor: '#1e40af' }}
                                  onClick={() => handleDownloadStudentFile(s.id, 'undertaking')}
                                >
                                  <Download size={12} /> Undertaking
                                </button>
                              )}

                              {s.pre_ltc_submitted && (
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803d', borderColor: '#15803d' }}
                                  onClick={() => handleDownloadStudentFile(s.id, 'Pre-LTC')}
                                >
                                  <Download size={12} /> Pre-FB
                                </button>
                              )}

                              {s.post_ltc_submitted && (
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#b45309', borderColor: '#b45309' }}
                                  onClick={() => handleDownloadStudentFile(s.id, 'Post-LTC')}
                                >
                                  <Download size={12} /> Post-FB
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredStudents.length === 0 && <tr><td colSpan="9" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>No students found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timetable' && (
          <TimetablePanel />
        )}

        {activeTab === 'profile' && <FacultyProfileTab token={token} isLtcMember={isLtcMember} />}

        {activeTab === 'dashboard' && (() => {
          // Compute undertaking & feedback stats
          const totalStudents = dashboardStats?.studentUndertaking?.total ?? 0
          const undertakingSubmitted = dashboardStats?.studentUndertaking?.submitted ?? 0
          const undertakingPending = dashboardStats?.studentUndertaking?.pending ?? 0
          const undertakingPct = dashboardStats?.studentUndertaking?.pct ?? 0

          const feedbackSubmitted = dashboardStats?.studentFeedback?.submitted ?? 0
          const feedbackPending = dashboardStats?.studentFeedback?.pending ?? 0
          const feedbackPct = dashboardStats?.studentFeedback?.pct ?? 0

          // greeting
          const hours = new Date().getHours()
          const facultyName = facultyInfo?.name || currentUser?.name || 'Faculty'
          const firstName = facultyName.split(' ')[0]
          let greetingText = ''
          if (hours < 12) greetingText = t("Good Morning, {{name}}!").replace("{{name}}", firstName)
          else if (hours < 18) greetingText = t("Good Afternoon, {{name}}!").replace("{{name}}", firstName)
          else greetingText = t("Good Evening, {{name}}!").replace("{{name}}", firstName)

          const FACULTY_SCHEDULE = [
            { time: '09:00 AM', event: 'Meditation Session', location: 'Hall 1', iconName: 'compass' },
            { time: '11:00 AM', event: 'Immersion Program', location: batchDetails?.name || 'LAP-01-1026', iconName: 'award' },
            { time: '02:00 PM', event: 'Faculty Meeting', location: 'Conference Room', iconName: 'users' },
            { time: '04:00 PM', event: 'Review & Feedback', location: 'Admin Office', iconName: 'activity' },
          ]

          const getIcon = (name) => {
            if (name === 'compass') return <Compass size={14} />
            if (name === 'award') return <Award size={14} />
            if (name === 'users') return <Users size={14} />
            return <Activity size={14} />
          }

          // SVG circle chart helper
          const CircleChart = ({ pct, color, label, count, subtitle }) => {
            const r = 45
            const circ = 2 * Math.PI * r
            const dash = (pct / 100) * circ
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ position: 'relative', width: 90, height: 90 }}>
                  <svg width="90" height="90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r={r} fill="none"
                      stroke={color} strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circ}`}
                      strokeDashoffset={circ / 4}
                      transform="rotate(0 50 50)"
                      style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>{totalStudents > 0 ? `${pct}%` : count}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{t(label)}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>
                </div>
              </div>
            )
          }

          const handleDownloadCertificate = async () => {
            if (!facultyInfo || !batchDetails) return
            setCertLoading(true)
            try {
              await generateCertificate(
                { fullName: facultyInfo.name },
                { startDate: batchDetails.start_date, endDate: batchDetails.end_date },
                'Faculty.pdf'
              )
            } catch (err) {
              console.error(err)
              alert(t('Failed to generate certificate. Please try again.'))
            } finally {
              setCertLoading(false)
            }
          }

          return (
          <div className="space-y-6 animate-fade-in">

            {/* Download Certificate Card */}
            {!isLtcMember && batchDetails?.batch_status === 'completed' && (
            <div className="glass-card hover:shadow-md transition-shadow group">
              <div className="card-header">
                <span className="card-title">
                  <Award size={18} style={{ color: '#d97706' }} />
                  {t("Certificate of Participation")}
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '19px', fontWeight: '600', color: '#111827' }}>{t("Download Your Certificate")}</span>
                <button
                  id="download-certificate-btn"
                  onClick={handleDownloadCertificate}
                  disabled={certLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: certLoading ? '#e2e8f0' : '#fbbf24',
                    color: certLoading ? '#94a3b8' : '#0f172a',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: certLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: certLoading ? 'none' : '0 4px 14px rgba(251,191,36,0.25)',
                    opacity: certLoading ? 0.7 : 1
                  }}
                  onMouseOver={(e) => { 
                    if (!certLoading) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.background = '#f59e0b';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(251,191,36,0.35)';
                    } 
                  }}
                  onMouseOut={(e) => { 
                    if (!certLoading) {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.background = '#fbbf24';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,191,36,0.25)';
                    }
                  }}
                >
                  {certLoading ? (
                    <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> {t("Generating...")}</>
                  ) : (
                    <><Download size={15} /> {t("Download Certificate")}</>
                  )}
                </button>
              </div>
            </div>
            )}
                              {/* ── Overview Info Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: isMobile ? '12px' : '16px', marginBottom: '24px' }}>
              {/* Faculty Profile */}
              <div 
                onClick={() => setActiveCardModal('profile')} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: isMobile ? '12px' : '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  overflow: 'hidden', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: isMobile ? '105px' : '120px'
                }}
                className="hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                  <span style={{ fontSize: isMobile ? '9.5px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {isLtcMember ? t('LTC coordinator') : t('MIT squad leader')}
                  </span>
                  <div style={{ 
                    width: isMobile ? '28px' : '36px', 
                    height: isMobile ? '28px' : '36px', 
                    borderRadius: isMobile ? '8px' : '10px', 
                    backgroundColor: 'rgba(79, 70, 229, 0.08)', 
                    boxShadow: '0 6px 15px -3px rgba(79, 70, 229, 0.15)', 
                    border: '1px solid rgba(79, 70, 229, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={isMobile ? 16 : 20} color="#4f46e5" strokeWidth={2.4} />
                  </div>
                </div>
                <div style={{ zIndex: 2, marginTop: isMobile ? '8px' : '12px' }}>
                  <h3 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.2, fontFamily: 'system-ui, -apple-system, sans-serif', wordBreak: 'break-word' }}>
                    {facultyInfo?.name || currentUser.name}
                  </h3>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#ea580c', marginTop: '4px', fontFamily: 'monospace' }}>
                    {batchDetails?.name || 'LAP-01-1026'}
                  </div>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(79, 70, 229, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(79, 70, 229, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>

              {/* Allocated Squad */}
              <div 
                onClick={() => setActiveCardModal('squad')} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: isMobile ? '12px' : '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  overflow: 'hidden', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: isMobile ? '105px' : '120px'
                }}
                className="hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                  <span style={{ fontSize: isMobile ? '9.5px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {t("Allocated Squad")}
                  </span>
                  <div style={{ 
                    width: isMobile ? '28px' : '36px', 
                    height: isMobile ? '28px' : '36px', 
                    borderRadius: isMobile ? '8px' : '10px', 
                    backgroundColor: 'rgba(5, 150, 105, 0.08)', 
                    boxShadow: '0 6px 15px -3px rgba(5, 150, 105, 0.15)', 
                    border: '1px solid rgba(5, 150, 105, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users size={isMobile ? 16 : 20} color="#059669" strokeWidth={2.4} />
                  </div>
                </div>
                <div style={{ zIndex: 2, marginTop: isMobile ? '8px' : '12px' }}>
                  <h3 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.2, fontFamily: 'system-ui, -apple-system, sans-serif', wordBreak: 'break-word' }}>
                    {t(facultyInfo?.squad || 'Not Assigned')}
                  </h3>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(5, 150, 105, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(5, 150, 105, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>

              {/* Squad Leader */}
              <div 
                onClick={() => setActiveCardModal('leader')} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: isMobile ? '12px' : '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  overflow: 'hidden', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: isMobile ? '105px' : '120px'
                }}
                className="hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                  <span style={{ fontSize: isMobile ? '9.5px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {t('Student squad leader')}
                  </span>
                  <div style={{ 
                    width: isMobile ? '28px' : '36px', 
                    height: isMobile ? '28px' : '36px', 
                    borderRadius: isMobile ? '8px' : '10px', 
                    backgroundColor: 'rgba(217, 119, 6, 0.08)', 
                    boxShadow: '0 6px 15px -3px rgba(217, 119, 6, 0.15)', 
                    border: '1px solid rgba(217, 119, 6, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <GraduationCap size={isMobile ? 16 : 20} color="#d97706" strokeWidth={2.4} />
                  </div>
                </div>
                <div style={{ zIndex: 2, marginTop: isMobile ? '8px' : '12px' }}>
                  <h3 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.2, fontFamily: 'system-ui, -apple-system, sans-serif', wordBreak: 'break-word' }}>
                    {squadLeader ? squadLeader.name : t('Not Assigned')}
                  </h3>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(217, 119, 6, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(217, 119, 6, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>

              {/* Co-LTC/MIT Faculty Card */}
              <div 
                onClick={() => setActiveCardModal('colleagues')} 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: isMobile ? '12px' : '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  position: 'relative', 
                  overflow: 'hidden', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: isMobile ? '105px' : '120px'
                }}
                className="hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                  <span style={{ fontSize: isMobile ? '9.5px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {isLtcMember ? t('Mit squad leader') : t('LTC coordinator')}
                  </span>
                  <div style={{ 
                    width: isMobile ? '28px' : '36px', 
                    height: isMobile ? '28px' : '36px', 
                    borderRadius: isMobile ? '8px' : '10px', 
                    backgroundColor: 'rgba(225, 29, 72, 0.08)', 
                    boxShadow: '0 6px 15px -3px rgba(225, 29, 72, 0.15)', 
                    border: '1px solid rgba(225, 29, 72, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <UserCheck size={isMobile ? 16 : 20} color="#e11d48" strokeWidth={2.4} />
                  </div>
                </div>
                <div style={{ zIndex: 2, marginTop: isMobile ? '8px' : '12px' }}>
                  <h3 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', margin: 0, color: '#0f172a', lineHeight: 1.2, fontFamily: 'system-ui, -apple-system, sans-serif', wordBreak: 'break-word' }}>
                    {coFaculty ? coFaculty.name : t('Not Assigned')}
                  </h3>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(225, 29, 72, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(225, 29, 72, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>
            </div>

            {/* ── Today's Sessions + Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>

              {/* Undertaking Form Submitted */}
              <div 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: '16px', 
                  position: 'relative', 
                  overflow: 'hidden', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  minHeight: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', zIndex: 2 }}>
                  <span style={{ fontSize: '12px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <span className="material-symbols-outlined text-[18px]">fact_check</span>
                    {t("Undertakings Status")}
                  </span>
                  <button onClick={() => setActiveTab('students')} style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: '600', color: '#1d4ed8', cursor: 'pointer', outline: 'none' }}>{t("View Students")} →</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2, flex: 1, padding: '12px 0' }}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-surface-container-highest" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4"></path>
                        <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1d4ed8" strokeDasharray={`${undertakingPct}, 100`} strokeWidth="4"></path>
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-on-surface">
                        <span className="text-lg font-bold" style={{ color: '#0f172a' }}>{undertakingPct}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-on-surface-variant font-medium mt-3" style={{ color: '#64748b' }}>{t("Submitted")} ({undertakingSubmitted}/{totalStudents})</span>
                  </div>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>

              {/* Feedback Form Submitted */}
              <div 
                style={{ 
                  background: '#ffffff', 
                  borderRadius: '16px', 
                  border: '1px solid #e2e8f0', 
                  padding: '16px', 
                  position: 'relative', 
                  overflow: 'hidden', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                  minHeight: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', zIndex: 2 }}>
                  <span style={{ fontSize: '12px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    <span className="material-symbols-outlined text-[18px]">feedback</span>
                    {t("Feedbacks Status")}
                  </span>
                  <button onClick={() => setActiveTab('feedback')} style={{ border: 'none', background: 'transparent', fontSize: '12px', fontWeight: '600', color: '#1d4ed8', cursor: 'pointer', outline: 'none' }}>{t("View Feedback")} →</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2, flex: 1, padding: '12px 0' }}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-surface-container-highest" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4"></path>
                        <path className="text-tertiary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#0ea5e9" strokeDasharray={`${feedbackPct}, 100`} strokeWidth="4"></path>
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-on-surface">
                        <span className="text-lg font-bold" style={{ color: '#0f172a' }}>{feedbackPct}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-on-surface-variant font-medium mt-3" style={{ color: '#64748b' }}>{t("Submitted")} ({feedbackSubmitted}/{totalStudents})</span>
                  </div>
                </div>
                {/* Dot Grid Watermark & Glow */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  width: '120px', 
                  height: '100px', 
                  background: 'radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.07), transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: 'radial-gradient(rgba(37, 99, 235, 0.16) 1.5px, transparent 1.5px)',
                    backgroundSize: '8px 8px',
                    WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                    maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                  }} />
                </div>
              </div>

            </div>



            <TimetablePanel compact={true} onViewDetail={() => setActiveTab('timetable')} />

            {/* ── Modals for Overview Cards ── */}
            {activeCardModal && (
              <div className="modal-overlay" onClick={() => setActiveCardModal(null)}>
                <div className="modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', width: '90%', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                  <div className="modal-header" style={{
                    background: '#0057b8',
                    padding: '18px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    borderTopLeftRadius: '14px',
                    borderTopRightRadius: '14px',
                    margin: 0
                  }}>
                    <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: '800', fontFamily: '"Poppins", sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {activeCardModal === 'profile' && <><User size={18} style={{ color: '#ffffff' }} /> {isLtcMember ? t('LTC coordinator') : t('MIT squad leader')}</>}
                      {activeCardModal === 'squad' && <><Users size={18} style={{ color: '#ffffff' }} /> {t("Allocated Squad")}</>}
                      {activeCardModal === 'leader' && <><GraduationCap size={18} style={{ color: '#ffffff' }} /> {isLtcMember ? t('Student squad leader') : t('Student squad leader')}</>}
                      {activeCardModal === 'colleagues' && <><Users size={18} style={{ color: '#ffffff' }} /> {isLtcMember ? t('Mit squad leader') : t('LTC coordinator')}</>}
                    </h3>
                    <button 
                      onClick={() => setActiveCardModal(null)}
                      style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="modal-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {activeCardModal === 'profile' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={20} fill="currentColor" />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Full Name")}</div>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>{facultyInfo?.name || currentUser.name}</div>
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <MessageSquare size={20} fill="currentColor" />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Email Address")}</div>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>{facultyInfo?.email || currentUser.email}</div>
                          </div>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Award size={20} fill="currentColor" />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Assigned Batch")}</div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#ea580c', fontFamily: 'monospace' }}>{batchDetails?.name || 'LAP-01-1026'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeCardModal === 'squad' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users size={20} fill="currentColor" />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Allocated Squad Name")}</div>
                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>{t(facultyInfo?.squad || 'Not Assigned')}</div>
                          </div>
                        </div>
                        {facultyInfo?.squad && (
                          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>{t("Squad Statistics")}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{t("Total Students")}</span>
                              <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{squadStudents.length}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>{t("Female")}</div>
                                <div style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>{squadStudents.filter(s => s.gender?.toLowerCase() === 'female').length}</div>
                              </div>
                              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9', textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginBottom: '4px' }}>{t("Male")}</div>
                                <div style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>{squadStudents.length - squadStudents.filter(s => s.gender?.toLowerCase() === 'female').length}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {activeCardModal === 'leader' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {squadLeader ? (
                          <>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <GraduationCap size={20} fill="currentColor" />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Leader Name")}</div>
                                <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>{squadLeader.name}</div>
                              </div>
                            </div>
                            {!isLtcMember && (
                              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <MessageSquare size={20} fill="currentColor" />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Email Address")}</div>
                                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'normal' }}>{squadLeader.email}</div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{t("No squad leader assigned.")}</div>
                          </div>
                        )}

                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
                          <h4 style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {t("Assign Student squad leader")}
                          </h4>
                          {squadStudents.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>{t("No students in your squad to assign.")}</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <select
                                className="input-field"
                                style={{ margin: 0 }}
                                value={selectedLeaderId}
                                onChange={(e) => setSelectedLeaderId(e.target.value)}
                              >
                                <option value="">{t("-- Select Student --")}</option>
                                {squadStudents.map(student => (
                                  <option key={student.id} value={student.id}>
                                    {student.name} {isLtcMember ? (student.ltc_id ? `(LTC ID: ${student.ltc_id})` : '') : `(${student.prn || student.email})`}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="btn"
                                style={{ background: '#0A082C', color: 'white', fontWeight: '700' }}
                                onClick={() => {
                                  handleAssignSquadLeader(selectedLeaderId);
                                }}
                              >
                                {t("Assign Leader")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {activeCardModal === 'colleagues' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {coFaculty ? (
                          <>
                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ 
                                width: '48px', 
                                height: '48px', 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', 
                                color: '#7c3aed', 
                                fontSize: '16px', 
                                fontWeight: '800', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                flexShrink: 0, 
                                border: '2px solid #ddd6fe' 
                              }}>
                                {coFaculty.name ? coFaculty.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : (isLtcMember ? 'FC' : 'LT')}
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                  {isLtcMember ? t('MIT Squad Leader') : t('LTC Coordinator')}
                                </div>
                                <div style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a' }}>{coFaculty.name}</div>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <MessageSquare size={20} fill="currentColor" style={{ color: '#64748b' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Email Address")}</div>
                                <div style={{ fontSize: '14.5px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-all' }}>{coFaculty.email}</div>
                              </div>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Phone size={20} fill="currentColor" style={{ color: '#64748b' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Contact Number")}</div>
                                <div style={{ fontSize: '14.5px', fontWeight: '600', color: '#0f172a' }}>{coFaculty.phone || t('Not Available')}</div>
                              </div>
                            </div>

                            {coFaculty.department && (
                              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <GraduationCap size={20} fill="currentColor" style={{ color: '#64748b' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Department")}</div>
                                  <div style={{ fontSize: '14.5px', fontWeight: '600', color: '#0f172a' }}>{t(coFaculty.department)}</div>
                                </div>
                              </div>
                            )}

                            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Users size={20} fill="currentColor" style={{ color: '#64748b' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{t("Assigned Squad")}</div>
                                <div style={{ fontSize: '14.5px', fontWeight: '700', color: SQUAD_COLORS[facultyInfo?.squad] || '#0f172a' }}>{t(facultyInfo?.squad || '—')}</div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                            <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{t("No {{role}} assigned to your squad yet.").replace("{{role}}", isLtcMember ? t('MIT Faculty') : t('LTC coordinator'))}</div>
                            <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>{t("Contact admin to assign an {{role}} to squad {{squad}}.").replace("{{role}}", isLtcMember ? t('MIT Faculty') : t('LTC coordinator')).replace("{{squad}}", t(facultyInfo?.squad || '—'))}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Certificates Section */}
            {customCertificates && customCertificates.length > 0 && (
              <div className="glass-card hover:shadow-md transition-shadow" style={{ marginTop: '24px' }}>
                <div className="card-header">
                  <span className="card-title">
                    <Award size={18} style={{ color: 'var(--primary)' }} />
                    {t("Assigned Certificates")}
                  </span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {customCertificates.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '150px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', display: 'block' }}>{c.data?.title}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {t("Issued on")}: {new Date(c.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const API = API_BASE_URL;
                          const link = document.createElement('a');
                          const rawUrl = c.data?.url;
                          const finalToken = (typeof token !== 'undefined' ? token : '') || localStorage.getItem('token') || '';
                          let downloadUrl = rawUrl;
                          if (rawUrl && rawUrl.startsWith('/api/')) {
                            downloadUrl = `${API}${rawUrl}?token=${finalToken}`;
                          } else if (rawUrl && rawUrl.startsWith('data:')) {
                            downloadUrl = rawUrl;
                          } else if (rawUrl) {
                            downloadUrl = rawUrl.includes('?') ? `${rawUrl}&token=${finalToken}` : `${rawUrl}?token=${finalToken}`;
                          }
                          link.href = downloadUrl;
                          link.download = c.data?.title || 'Certificate';
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: 'auto' }}
                      >
                        <Download size={13} /> {t("Download")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
          )
        })()}


        {activeTab === 'nri' && (
          <div className="glass-card animate-fade-in">
            <h2 style={{ fontSize: '20px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users className="text-primary" /> NRI Students
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
              Filter view — NRI students appear in all other sections (attendance, evaluation, student list) as well.
            </p>

            <div className="search-wrapper">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search NRI students..."
                className="input-field"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("S.No.")}</th>
                    <th>{isLtcMember ? t("LTC ID") : t("PRN / LTC ID")}</th>
                    <th>{t("Name")}</th>
                    {!isLtcMember && <th>{t("Email")}</th>}
                    <th>{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.filter(s => s.nri === true || s.nri === 1 || String(s.nri).toLowerCase() === 'true' || String(s.nri).toLowerCase() === 'yes').map((s, index) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: '600' }}>{index + 1}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {!isLtcMember && <code style={{ fontSize: '12px' }}>{s.prn || '—'}</code>}
                          {s.ltc_id && (
                            <span className="badge badge-blue" style={{ fontSize: '10px', alignSelf: 'flex-start', background: 'var(--primary-bg)', color: 'var(--primary)', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                              LTC ID: {s.ltc_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{s.name}{s.red_flag && <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: 'bold', fontSize: '11px' }}>(Flagged)</span>}</td>
                      {!isLtcMember && <td>{s.email}</td>}
                      <td><span style={{ background: '#f1f5f9', color: '#0f172a', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>NRI</span></td>
                    </tr>
                  ))}
                  {filteredStudents.filter(s => s.nri === true || s.nri === 1 || String(s.nri).toLowerCase() === 'true' || String(s.nri).toLowerCase() === 'yes').length === 0 && (
                    <tr><td colSpan={isLtcMember ? "3" : "4"} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No NRI students found. Upload students with <code>nri=yes</code> in the bulk upload.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="glass-card animate-fade-in">
            <h2 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar className="text-primary" /> Create Activity Schedule
            </h2>
            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '16px', marginBottom: '32px' }}>
              <input type="text" placeholder="Activity Title (Optional for 7-Day)" className="input-field" style={{ margin: 0 }} value={scheduleForm.title} onChange={e => setScheduleForm({ ...scheduleForm, title: e.target.value })} />
              <input type="date" className="input-field" style={{ margin: 0 }} required value={scheduleForm.date} onChange={e => setScheduleForm({ ...scheduleForm, date: e.target.value })} />
              <input type="time" className="input-field" style={{ margin: 0 }} required value={scheduleForm.time} onChange={e => setScheduleForm({ ...scheduleForm, time: e.target.value })} />
              <select className="input-field" style={{ margin: 0, width: isMobile ? '100%' : 'auto' }} value={scheduleForm.panel} onChange={e => setScheduleForm({ ...scheduleForm, panel: e.target.value })}>
                <option value="PA">Panel PA</option>
                <option value="PB">Panel PB</option>
                <option value="PC">Panel PC</option>
                <option value="PD">Panel PD</option>
                <option value="ALL">All Panels</option>
              </select>
              <button type="submit" className="btn" style={{ width: isMobile ? '100%' : 'auto' }}>Schedule</button>
              <button type="button" className="btn" style={{ background: 'var(--secondary)', width: isMobile ? '100%' : 'auto' }} onClick={handleGenerate7DaySchedule}>Generate 7-Days</button>
            </form>

            <h3 style={{ marginBottom: '16px' }}>Upcoming Activities</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Title</th><th>Date</th><th>Time</th><th>Target Panel</th></tr></thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id}><td>{s.title}</td><td>{s.date}</td><td>{s.time}</td><td>{s.panel}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeTab === 'attendance' && (() => {
          const pillarsList = [
            { key: 'bag_checking', name: 'Orientation' },
            { key: 'agriculture', name: 'Agriculture & Nature' },
            { key: 'physical', name: 'Physical Fitness & Sports' },
            { key: 'leadership', name: 'Team Building & Leadership' },
            { key: 'patriotism', name: 'Patriotism & Nation Building' },
            { key: 'spirituality', name: 'Spirituality & Peace' }
          ];

          const getAttCompletedCount = (pillar, day) => {
            return students.filter(st => {
              const rec = attendanceRecords.find(a => 
                String(a.student_id) === String(st.id) && 
                a.pillar === pillar && 
                Number(a.day) === Number(day)
              );
              return rec && ['present', 'absent', 'late'].includes(String(rec.status || '').toLowerCase());
            }).length;
          };

          const getAttLockedCount = (pillar, day) => {
            return students.filter(st => {
              const rec = attendanceRecords.find(a => 
                String(a.student_id) === String(st.id) && 
                a.pillar === pillar && 
                Number(a.day) === Number(day)
              );
              return rec && rec.is_locked;
            }).length;
          };

          if (selectedAttPillar && selectedAttDay) {
            /* ── DETAIL PAGE ── */
            const marked = students.filter(st => {
              const pendingStatus = selectedAttendance[st.id];
              const savedRec = attendanceRecords.find(a => 
                String(a.student_id) === String(st.id) && 
                a.pillar === selectedAttPillar && 
                Number(a.day) === Number(selectedAttDay)
              );
              const statusVal = pendingStatus !== undefined ? pendingStatus : savedRec?.status;
              return ['present', 'absent', 'late'].includes(String(statusVal || '').toLowerCase());
            }).length;

            const lockedRecord = attendanceRecords.find(a => 
              a.pillar === selectedAttPillar && 
              Number(a.day) === Number(selectedAttDay) && 
              a.is_locked && 
              a.locked_by_name
            );

            return (
              <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#fff', borderRadius: '16px' }}>
                {/* Back + header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => { setSelectedAttPillar(''); setSelectedAttDay(null); setSelectedAttendance({}); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '7px 14px', fontWeight: '700', fontSize: '12px', color: '#0f172a', cursor: 'pointer' }}>
                      ← Back
                    </button>
                    <div>
                      <div style={{ fontSize: '11px', color: '#0f172a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Attendance · Day {selectedAttDay}</div>
                      <div style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>{pillarsList.find(p => p.key === selectedAttPillar)?.name}</div>
                      {lockedRecord && (
                        <div style={{ fontSize: '11.5px', color: '#e11d48', fontWeight: '700', marginTop: '4px' }}>
                          Locked by {lockedRecord.locked_by_name} on {new Date(lockedRecord.locked_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handlePrintAttendance}
                      style={{ background: '#f8fafc', color: '#0f172a', border: '1.5px solid #cbd5e1', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap' }}
                    >
                      Download PDF
                    </button>
                    <button
                      disabled={Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length === 0 || attendanceSubmitting}
                      onClick={() => handleSaveAttendance(false)}
                      style={{ background: Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 ? '#475569' : '#e2e8f0', color: Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 ? '#fff' : '#94a3b8', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 ? 'pointer' : 'default', transition: 'all 0.18s', whiteSpace: 'nowrap' }}
                    >
                      {attendanceSubmitting ? 'Saving…' : 'Save (Editable)'}
                    </button>
                    <button
                      disabled={!(Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 || attendanceRecords.some(a => a.pillar === selectedAttPillar && Number(a.day) === Number(selectedAttDay) && !a.is_locked)) || attendanceSubmitting}
                      onClick={() => handleSaveAttendance(true)}
                      style={{ background: (Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 || attendanceRecords.some(a => a.pillar === selectedAttPillar && Number(a.day) === Number(selectedAttDay) && !a.is_locked)) ? '#ea580c' : '#e2e8f0', color: (Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 || attendanceRecords.some(a => a.pillar === selectedAttPillar && Number(a.day) === Number(selectedAttDay) && !a.is_locked)) ? '#fff' : '#94a3b8', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: (Object.keys(selectedAttendance).filter(id => selectedAttendance[id] !== undefined).length > 0 || attendanceRecords.some(a => a.pillar === selectedAttPillar && Number(a.day) === Number(selectedAttDay) && !a.is_locked)) ? 'pointer' : 'default', transition: 'all 0.18s', whiteSpace: 'nowrap' }}
                    >
                      {attendanceSubmitting ? 'Locking…' : 'Lock & Save'}
                    </button>
                  </div>
                </div>

                {/* Stats 2x2 Grid */}
                {(() => {
                  const unmarked = Math.max(0, students.length - marked);
                  const attendancePct = students.length > 0 ? Math.round((marked / students.length) * 100) : 0;

                  return (
                    <>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
                        gap: isMobile ? '10px' : '16px', 
                        marginBottom: '16px' 
                      }}>
                        {[
                          ['Total', students.length, '#1e3a8a', '#2563eb', Users, 'rgba(37, 99, 235, 0.08)'],
                          ['Marked', marked, '#047857', '#10b981', UserCheck, 'rgba(16, 185, 129, 0.08)'],
                          ['Unmarked', unmarked, '#b45309', '#f59e0b', HelpCircle, 'rgba(245, 158, 11, 0.08)'],
                          ['Attendance %', `${attendancePct}%`, '#7c3aed', '#8b5cf6', Percent, 'rgba(139, 92, 246, 0.08)']
                        ].map(([lbl, val, textClr, borderClr, Icon, iconBg]) => (
                          <div 
                            key={lbl} 
                            style={{ 
                              background: '#ffffff', 
                              borderRadius: '16px', 
                              border: '1px solid #e2e8f0', 
                              padding: isMobile ? '12px' : '16px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              justifyContent: 'space-between',
                              position: 'relative', 
                              overflow: 'hidden', 
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              minHeight: isMobile ? '95px' : '115px'
                            }}
                            className="hover:shadow-md hover:-translate-y-0.5 transition-all"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                              <span style={{ fontSize: isMobile ? '10px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                {lbl}
                              </span>
                              <div style={{ 
                                width: isMobile ? '28px' : '36px', 
                                height: isMobile ? '28px' : '36px', 
                                borderRadius: isMobile ? '8px' : '10px', 
                                backgroundColor: iconBg, 
                                boxShadow: `0 6px 15px -3px ${iconBg.replace('0.08', '0.15')}`, 
                                border: `1px solid ${iconBg}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Icon size={isMobile ? 15 : 20} color={borderClr} strokeWidth={2.4} />
                              </div>
                            </div>
                            <div style={{ zIndex: 2, marginTop: isMobile ? '6px' : '12px' }}>
                              <div style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '850', color: textClr, marginTop: '2px', lineHeight: 1 }}>
                                {val}
                              </div>
                            </div>
                            {/* Dot Grid Watermark & Glow */}
                            <div style={{ 
                              position: 'absolute', 
                              bottom: 0, 
                              right: 0, 
                              width: '100px', 
                              height: '80px', 
                              background: `radial-gradient(circle at bottom right, ${iconBg.replace('0.08', '0.07')}, transparent 70%)`,
                              pointerEvents: 'none',
                              zIndex: 1
                            }}>
                              <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundImage: `radial-gradient(${borderClr}26 1.5px, transparent 1.5px)`,
                                backgroundSize: '8px 8px',
                                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Mark All Present Action */}
                      <div style={{ marginBottom: '16px' }}>
                        <button 
                          onClick={handleMarkAllPresent} 
                          style={{ 
                            width: '100%',
                            background: '#ea580c', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '12px', 
                            padding: isMobile ? '11px 16px' : '13px 20px', 
                            fontWeight: '800', 
                            fontSize: '13px', 
                            cursor: 'pointer',
                            boxShadow: '0 4px 6px -1px rgba(234,88,12,0.15)',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#c2410c'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#ea580c'}
                        >
                          <Check size={16} strokeWidth={3} /> Mark All Present
                        </button>
                      </div>
                    </>
                  );
                })()}

                {/* Attendance Guide */}
                <div style={{ 
                  background: '#f8fafc', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '12px', 
                  padding: '12px 20px', 
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Attendance Status Guide:
                  </span>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#16a34a', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' }}>P</span>
                      <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Present</span>
                    </div>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#dc2626', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px' }}>A</span>
                      <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Absent</span>
                    </div>
                  </div>
                </div>

                {/* Student table */}
                {students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px', fontSize: '13px' }}>No students allocated to your squad yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: isMobile ? 'fixed' : 'auto' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: isMobile ? '10px 8px' : '12px 14px', textAlign: 'left', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: isMobile ? '46%' : 'auto' }}>
                            Student Name
                          </th>
                          <th style={{ padding: isMobile ? '10px 4px' : '12px 14px', textAlign: 'center', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: isMobile ? '82px' : '120px' }}>
                            Action
                          </th>
                          <th style={{ padding: isMobile ? '10px 8px' : '12px 14px', textAlign: 'left', color: '#475569', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: isMobile ? '34%' : 'auto' }}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st, i) => {
                          const rec = attendanceRecords.find(a => String(a.student_id) === String(st.id) && a.pillar === selectedAttPillar && Number(a.day) === Number(selectedAttDay))
                          const pending = selectedAttendance[st.id]
                          const currentStatus = pending !== undefined ? pending : rec?.status
                          
                          const isP = String(currentStatus || '').toLowerCase() === 'present'
                          const isL = String(currentStatus || '').toLowerCase() === 'late'
                          const isA = String(currentStatus || '').toLowerCase() === 'absent'
                          const isLocked = rec?.is_locked

                          return (
                            <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', opacity: isLocked ? 0.75 : 1 }}>
                              {/* 1. Student Name (with PRN/LTC ID) */}
                              <td style={{ padding: isMobile ? '10px 8px' : '12px 14px', verticalAlign: 'middle' }}>
                                <div style={{ fontWeight: '750', color: '#0f172a', fontSize: isMobile ? '12.5px' : '13.5px', lineHeight: '1.3', wordBreak: 'break-word' }}>
                                  {st.name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', flexWrap: 'wrap' }}>
                                  {st.is_dnr && (
                                    <span style={{ fontSize: '10px', color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <AlertOctagon size={10} /> DNR (Did Not Report)
                                    </span>
                                  )}
                                  {st.ltc_id && (
                                    <span style={{ fontSize: '10px', color: '#ea580c', fontWeight: '700', background: 'rgba(234,88,12,0.08)', padding: '1px 5px', borderRadius: '4px' }}>
                                      LTC: {st.ltc_id}
                                    </span>
                                  )}
                                  {!isLtcMember && st.prn && (
                                    <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                      {st.prn}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 2. Action (immediately beside Student Name) */}
                              <td style={{ padding: isMobile ? '10px 4px' : '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                                {st.is_dnr ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                    <span style={{ background: '#fee2e2', color: '#991b1b', border: '1.5px solid #ef4444', padding: '4px 8px', borderRadius: '8px', fontWeight: '800', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <UserX size={12} /> DNR
                                    </span>
                                    <button 
                                      type="button"
                                      title="Undo DNR status" 
                                      onClick={() => handleToggleDnr(st)} 
                                      disabled={dnrSubmittingId === st.id}
                                      style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
                                    >
                                      Undo
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'inline-flex', gap: isMobile ? '3px' : '4px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button 
                                      title="Present" 
                                      disabled={isLocked} 
                                      onClick={() => handleMarkAttendance(st.id, 'Present')} 
                                      style={{ 
                                        width: isMobile ? '28px' : '32px', 
                                        height: isMobile ? '28px' : '32px', 
                                        borderRadius: '8px', 
                                        border: `1.5px solid ${isP ? '#15803d' : '#e2e8f0'}`, 
                                        background: isP ? '#15803d' : '#fff', 
                                        color: isP ? '#fff' : '#15803d', 
                                        fontWeight: '800', 
                                        fontSize: isMobile ? '11px' : '12px', 
                                        cursor: isLocked ? 'default' : 'pointer', 
                                        transition: 'all 0.15s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        boxShadow: isP ? '0 2px 4px rgba(21,128,61,0.2)' : 'none'
                                      }}
                                    >
                                      P
                                    </button>
                                    <button 
                                      title="Absent" 
                                      disabled={isLocked} 
                                      onClick={() => handleMarkAttendance(st.id, 'Absent')} 
                                      style={{ 
                                        width: isMobile ? '28px' : '32px', 
                                        height: isMobile ? '28px' : '32px', 
                                        borderRadius: '8px', 
                                        border: `1.5px solid ${isA ? '#b91c1c' : '#e2e8f0'}`, 
                                        background: isA ? '#b91c1c' : '#fff', 
                                        color: isA ? '#fff' : '#b91c1c', 
                                        fontWeight: '800', 
                                        fontSize: isMobile ? '11px' : '12px', 
                                        cursor: isLocked ? 'default' : 'pointer', 
                                        transition: 'all 0.15s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        boxShadow: isA ? '0 2px 4px rgba(185,28,28,0.2)' : 'none'
                                      }}
                                    >
                                      A
                                    </button>
                                    <button 
                                      type="button"
                                      title="Mark as DNR (Did Not Report) - Permanent Absentee" 
                                      onClick={() => handleToggleDnr(st)} 
                                      disabled={dnrSubmittingId === st.id}
                                      style={{ 
                                        height: isMobile ? '28px' : '32px', 
                                        padding: isMobile ? '0 5px' : '0 8px', 
                                        borderRadius: '8px', 
                                        border: '1.5px solid #fecaca', 
                                        background: '#fff1f2', 
                                        color: '#e11d48', 
                                        fontWeight: '800', 
                                        fontSize: isMobile ? '10px' : '11px', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      <UserX size={11} /> DNR
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* 3. Status */}
                              <td style={{ padding: isMobile ? '10px 8px' : '12px 14px', verticalAlign: 'middle' }}>
                                {st.is_dnr ? (
                                  <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '3px 7px', borderRadius: '6px', fontSize: isMobile ? '10px' : '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block', width: 'fit-content', lineHeight: 1.2 }}>
                                    Permanent Absentee (DNR)
                                  </span>
                                ) : isLocked ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 7px', borderRadius: '6px', fontSize: isMobile ? '10px' : '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block', width: 'fit-content', lineHeight: 1.2 }}>
                                      Locked ({currentStatus})
                                    </span>
                                    {rec?.locked_by_name && (
                                      <span style={{ fontSize: '9.5px', color: '#991b1b', fontStyle: 'italic', fontWeight: '600', lineHeight: 1.2 }}>
                                        by {rec.locked_by_name}
                                      </span>
                                    )}
                                  </div>
                                ) : rec?.status && pending === undefined ? (
                                  <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 7px', borderRadius: '6px', fontSize: isMobile ? '10px' : '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block', width: 'fit-content', lineHeight: 1.2 }}>
                                    {currentStatus}
                                  </span>
                                ) : pending !== undefined ? (
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 7px', borderRadius: '6px', fontSize: isMobile ? '10px' : '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block', width: 'fit-content', lineHeight: 1.2 }}>
                                    {currentStatus}*
                                  </span>
                                ) : (
                                  <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 7px', borderRadius: '6px', fontSize: isMobile ? '10px' : '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block', width: 'fit-content', lineHeight: 1.2 }}>
                                    Not Marked
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          } else {
            /* ── DASHBOARD VIEW OF PILLARS AND DAYS ── */
            return (
              <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#fff', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
                    <ClipboardList size={20} style={{ color: '#0f172a' }} /> Mark Student Attendance
                  </h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={downloadSquadAttendance}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={13} /> Download Squad Attendance Report
                    </button>

                  </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Select a pillar day to record attendance.</p>

                {/* ── Day 1 Squad DNR (Did Not Report) Panel ── */}
                <div style={{ 
                  background: '#ffffff', 
                  border: '1.5px solid #fee2e2', 
                  borderRadius: '16px', 
                  padding: '16px 20px', 
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <UserX size={18} strokeWidth={2.4} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Day 1 Fall-in: DNR (Did Not Report) Reporting
                          <span style={{ 
                            background: students.filter(s => s.is_dnr).length > 0 ? '#ef4444' : '#f1f5f9', 
                            color: students.filter(s => s.is_dnr).length > 0 ? '#fff' : '#64748b', 
                            padding: '2px 8px', 
                            borderRadius: '20px', 
                            fontSize: '11px', 
                            fontWeight: '800' 
                          }}>
                            {students.filter(s => s.is_dnr).length} Permanent Absentee{students.filter(s => s.is_dnr).length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                          Squad coordinators must verify Day 1 reporting and mark students who did not report to camp as <strong>DNR</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDnrModal(prev => !prev)}
                      style={{
                        background: showDnrModal ? '#0f172a' : '#fff',
                        color: showDnrModal ? '#fff' : '#dc2626',
                        border: '1.5px solid #fca5a5',
                        borderRadius: '8px',
                        padding: '7px 14px',
                        fontSize: '12.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <UserX size={14} /> {showDnrModal ? 'Hide DNR Roster' : 'Manage Squad DNR'}
                    </button>
                  </div>

                  {showDnrModal && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid #fee2e2', paddingTop: '14px' }}>
                      <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800' }}>Student Name</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800' }}>PRN</th>
                              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '800' }}>Status</th>
                              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map(st => (
                              <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9', background: st.is_dnr ? '#fff5f5' : '#fff' }}>
                                <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0f172a' }}>{st.name}</td>
                                <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: '11.5px' }}>{st.prn || '—'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {st.is_dnr ? (
                                    <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
                                      DNR (Did Not Report)
                                    </span>
                                  ) : (
                                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                                      Reported to LTC
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDnr(st)}
                                    disabled={dnrSubmittingId === st.id}
                                    style={{
                                      background: st.is_dnr ? '#f1f5f9' : '#fff1f2',
                                      color: st.is_dnr ? '#475569' : '#dc2626',
                                      border: `1.5px solid ${st.is_dnr ? '#cbd5e1' : '#fca5a5'}`,
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {st.is_dnr ? 'Undo DNR' : 'Mark as DNR'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pillar Name</th>
                        {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'].map(d => (
                          <th key={d} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '130px' }}>{d}</th>
                        ))}
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>Locked Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pillarsList.map((pillar, idx) => {
                        const isBagChecking = pillar.key === 'bag_checking';
                        const daysToCheck = isBagChecking ? [1] : [2, 3, 4, 5];
                        const totalLocked = daysToCheck.reduce((acc, d) => acc + getAttLockedCount(pillar.key, d), 0);
                        const totalPossible = daysToCheck.length * students.length;
                        const progressPercent = totalPossible > 0 ? Math.round((totalLocked * 100) / totalPossible) : 0;

                        return (
                          <tr key={pillar.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                            <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0f172a' }}>{pillar.name}</td>
                            {[1, 2, 3, 4, 5].map(d => {
                              if (isBagChecking && d > 1) {
                                return (
                                  <td key={d} style={{ padding: '8px', textAlign: 'center', color: '#cbd5e1', fontWeight: '500' }}>
                                    —
                                  </td>
                                );
                              }
                              if (!isBagChecking && d === 1) {
                                return (
                                  <td key={d} style={{ padding: '8px', textAlign: 'center', color: '#cbd5e1', fontWeight: '500' }}>
                                    —
                                  </td>
                                );
                              }
                              const markedCount = getAttCompletedCount(pillar.key, d);
                              const lockedCount = getAttLockedCount(pillar.key, d);
                              const isDayCompleted = markedCount === students.length && students.length > 0;
                              const isDayLocked = lockedCount === students.length && students.length > 0;

                              return (
                                <td key={d} style={{ padding: '8px', textAlign: 'center' }}>
                                  <button
                                    onClick={() => {
                                      setSelectedAttPillar(pillar.key);
                                      setSelectedAttDay(d);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 6px',
                                      background: isDayLocked ? '#f0fdf4' : isDayCompleted ? '#eff6ff' : '#f8fafc',
                                      border: `1.5px solid ${isDayLocked ? '#bbf7d0' : isDayCompleted ? '#bfdbfe' : '#e2e8f0'}`,
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      textAlign: 'center',
                                      fontSize: '11.5px',
                                      fontWeight: '750',
                                      color: isDayLocked ? '#16a34a' : isDayCompleted ? '#2563eb' : '#64748b',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={(e) => {
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                    }}
                                    onMouseOut={(e) => {
                                      e.currentTarget.style.transform = 'none';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    <div>{markedCount} / {students.length}</div>
                                    <div style={{ fontSize: '9px', fontWeight: '800', marginTop: '2px', textTransform: 'uppercase' }}>
                                      {isDayLocked ? 'Locked' : isDayCompleted ? 'Marked' : 'Pending'}
                                    </div>
                                  </button>
                                </td>
                              );
                            })}
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <div style={{ width: '50px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent === 100 ? '#16a34a' : '#2563eb' }}></div>
                                </div>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>{progressPercent}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
        })()}






        {activeTab === 'evaluate' && (() => {
          const pillarsList = [
            { key: 'agriculture', name: 'Agriculture & Nature' },
            { key: 'physical', name: 'Physical Fitness & Sports' },
            { key: 'leadership', name: 'Team Building & Leadership' },
            { key: 'patriotism', name: 'Patriotism & Nation Building' },
            { key: 'spirituality', name: 'Spirituality & Peace' }
          ];

          const getCompletedCount = (pillar, day) => {
            return students.filter(st => {
              const ev = allEvaluations.find(e => 
                String(e.student_id) === String(st.id) && 
                e.pillar === pillar && 
                Number(e.day) === Number(day)
              );
              return ev && ev.status === 'locked';
            }).length;
          };

          const isAttendanceDone = (pillar, day) => {
            if (students.length === 0) return false;
            return students.every(st => {
              const rec = attendanceRecords.find(a => 
                String(a.student_id) === String(st.id) && 
                a.pillar === pillar && 
                Number(a.day) === Number(day)
              );
              return rec && ['present', 'absent', 'late'].includes(String(rec.status || '').toLowerCase());
            });
          };

          const getStudentLiveMarks = (studentId) => {
            const sched = schedules.find(s => 
              s.date === `Day ${selectedDay}` && 
              s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
            );
            const studentAtt = sched ? attendanceRecords.find(a => 
              String(a.student_id) === String(studentId) && 
              String(a.schedule_id) === String(sched.id)
            ) : null;
            const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';

            if (isAbsent) {
              return {
                attendance_marks: 0,
                participation_marks: 0,
                effort_marks: 0,
                learning_marks: 0,
                discipline_marks: 0,
                reflection_marks: 0,
                daily_total: 0,
                remarks: 'Absent',
                status: 'locked'
              };
            }

            const pending = selectedMarkings[studentId] || {};
            const existing = allEvaluations.find(e => 
              String(e.student_id) === String(studentId) && 
              e.pillar === selectedPillar && 
              Number(e.day) === Number(selectedDay)
            ) || {};

            const attVal = pending.attendance_marks !== undefined ? pending.attendance_marks : (existing.attendance_marks || 0);
            const partVal = pending.participation_marks !== undefined ? pending.participation_marks : (existing.participation_marks || 0);
            const effVal = pending.effort_marks !== undefined ? pending.effort_marks : (existing.effort_marks || 0);
            const lrVal = pending.learning_marks !== undefined ? pending.learning_marks : (existing.learning_marks || 0);
            const discVal = pending.discipline_marks !== undefined ? pending.discipline_marks : (existing.discipline_marks || 0);
            const refVal = pending.reflection_marks !== undefined ? pending.reflection_marks : (existing.reflection_marks || 0);

            return {
              attendance_marks: Number(attVal),
              participation_marks: Number(partVal),
              effort_marks: Number(effVal),
              learning_marks: Number(lrVal),
              discipline_marks: Number(discVal),
              reflection_marks: Number(refVal),
              daily_total: Number(attVal) + Number(partVal) + Number(effVal) + Number(lrVal) + Number(discVal) + Number(refVal),
              remarks: pending.remarks !== undefined ? pending.remarks : (existing.remarks || ''),
              status: existing.status || 'draft',
              locked_by_name: existing.locked_by_name || null,
              locked_at: existing.locked_at || null
            };
          };

          const allLocked = students.length > 0 && students.every(st => {
            const marksObj = getStudentLiveMarks(st.id);
            return marksObj.status === 'locked';
          });

          const updatePendingMark = (studentId, key, val) => {
            setSelectedMarkings(prev => {
              const studentPrev = prev[studentId] || {};
              return {
                ...prev,
                [studentId]: {
                  ...studentPrev,
                  [key]: val
                }
              };
            });
          };

          const applyPreset = (studentId, preset) => {
            let marks = {};
            if (preset === 'excellent') {
              marks = { attendance_marks: 4, participation_marks: 4, effort_marks: 4, learning_marks: 3, discipline_marks: 3, reflection_marks: 2 };
            } else if (preset === 'good') {
              marks = { attendance_marks: 3, participation_marks: 3, effort_marks: 3, learning_marks: 2.25, discipline_marks: 2.25, reflection_marks: 1.5 };
            } else if (preset === 'average') {
              marks = { attendance_marks: 2, participation_marks: 2, effort_marks: 2, learning_marks: 1.5, discipline_marks: 1.5, reflection_marks: 1 };
            } else if (preset === 'absent') {
              marks = { attendance_marks: 0, participation_marks: 0, effort_marks: 0, learning_marks: 0, discipline_marks: 0, reflection_marks: 0 };
            }
            
            setSelectedMarkings(prev => ({
              ...prev,
              [studentId]: {
                ...prev[studentId],
                ...marks
              }
            }));
          };

          const applyPresetToAll = (preset) => {
            let marks = {};
            if (preset === 'excellent') {
              marks = { attendance_marks: 4, participation_marks: 4, effort_marks: 4, learning_marks: 3, discipline_marks: 3, reflection_marks: 2 };
            } else if (preset === 'good') {
              marks = { attendance_marks: 3, participation_marks: 3, effort_marks: 3, learning_marks: 2.25, discipline_marks: 2.25, reflection_marks: 1.5 };
            } else if (preset === 'average') {
              marks = { attendance_marks: 2, participation_marks: 2, effort_marks: 2, learning_marks: 1.5, discipline_marks: 1.5, reflection_marks: 1 };
            } else if (preset === 'absent') {
              marks = { attendance_marks: 0, participation_marks: 0, effort_marks: 0, learning_marks: 0, discipline_marks: 0, reflection_marks: 0 };
            }

            const sched = schedules.find(s => 
              s.date === `Day ${selectedDay}` && 
              s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
            );

            setSelectedMarkings(prev => {
              const next = { ...prev };
              students.forEach(st => {
                const existing = allEvaluations.find(e => 
                  String(e.student_id) === String(st.id) && 
                  e.pillar === selectedPillar && 
                  Number(e.day) === Number(selectedDay)
                ) || {};
                const isLocked = existing.status === 'locked';

                const studentAtt = sched ? attendanceRecords.find(a => 
                  String(a.student_id) === String(st.id) && 
                  String(a.schedule_id) === String(sched.id)
                ) : null;
                const isAbsentInAttendance = studentAtt?.status?.toLowerCase() === 'absent';

                if (!isLocked && !isAbsentInAttendance) {
                  next[st.id] = {
                    ...next[st.id],
                    ...marks
                  };
                }
              });
              return next;
            });
          };

          const renderMarkSelector = (studentId, key, max, marksObj, isLocked) => {
            const value = marksObj[key] || 0;
            const options = [];
            for (let i = 0; i <= max; i += 0.25) {
              options.push(i);
            }

            const handleDecrement = () => {
              if (value > 0) {
                updatePendingMark(studentId, key, Math.max(0, value - 0.25));
              }
            };

            const handleIncrement = () => {
              if (value < max) {
                updatePendingMark(studentId, key, Math.min(max, value + 0.25));
              }
            };

            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <button
                  disabled={isLocked || value <= 0}
                  onClick={handleDecrement}
                  type="button"
                  style={{
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: value <= 0 || isLocked ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    color: '#334155',
                    fontSize: '12px',
                    padding: 0
                  }}
                >-</button>
                <select
                  value={value}
                  disabled={isLocked}
                  onChange={(e) => updatePendingMark(studentId, key, Number(e.target.value))}
                  style={{
                    height: '22px',
                    padding: '0 1px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    background: '#fff',
                    color: '#0f172a',
                    fontWeight: '700',
                    textAlign: 'center',
                    fontSize: '11px',
                    cursor: isLocked ? 'not-allowed' : 'pointer'
                  }}
                >
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <button
                  disabled={isLocked || value >= max}
                  onClick={handleIncrement}
                  type="button"
                  style={{
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: value >= max || isLocked ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    color: '#334155',
                    fontSize: '12px',
                    padding: 0
                  }}
                >+</button>
              </div>
            );
          };

          return (
            <div className="glass-card animate-fade-in" style={{ padding: '20px', background: '#fff', borderRadius: '16px' }}>
              {selectedPillar && selectedDay ? (
                /* ── STUDENT MARK SHEET ── */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => {
                          setSelectedPillar('');
                          setSelectedDay(null);
                          setSelectedMarkings({});
                        }} 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '13px', color: '#0f172a', cursor: 'pointer' }}
                      >
                        ← Back
                      </button>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          Assessment Pillar · Day {selectedDay}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                          {pillarsList.find(p => p.key === selectedPillar)?.name}
                        </div>
                        {(() => {
                          const lockedRecord = allEvaluations.find(e => 
                            e.pillar === selectedPillar && 
                            Number(e.day) === Number(selectedDay) && 
                            e.status === 'locked' && 
                            e.locked_by_name
                          );
                          return lockedRecord ? (
                            <div style={{ fontSize: '11.5px', color: '#e11d48', fontWeight: '700', marginTop: '4px' }}>
                              Locked by {lockedRecord.locked_by_name} on {new Date(lockedRecord.locked_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {allLocked ? (
                        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', border: '1.5px solid #a5d6a7', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          Evaluations Locked & Submitted
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEvaluate(false)}
                            disabled={evalSubmitting || students.length === 0}
                            style={{ background: '#f1f5f9', color: '#0f172a', border: '1.5px solid #cbd5e1', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.18s' }}
                          >
                            {evalSubmitting ? 'Saving...' : 'Save Draft'}
                          </button>
                          <button
                            onClick={() => handleEvaluate(true)}
                            disabled={evalSubmitting || students.length === 0}
                            style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', transition: 'all 0.18s' }}
                          >
                            {evalSubmitting ? 'Submitting...' : 'Lock & Submit'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Preset to All Bar */}
                  {students.length > 0 && (
                    <div style={{ 
                      background: '#f8fafc', 
                      border: '1.5px solid #e2e8f0', 
                      borderRadius: '12px', 
                      padding: '16px 20px', 
                      marginBottom: '20px' 
                    }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '12px' }}>
                        <button
                          type="button"
                          onClick={() => applyPresetToAll('excellent')}
                          style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Set All Exc
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetToAll('good')}
                          style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Set All Gd
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetToAll('average')}
                          style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Set All Avg
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPresetToAll('absent')}
                          style={{ background: '#b91c1c', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                        >
                          Set All Abs
                        </button>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#0f172a', borderTop: '1px dashed #cbd5e1', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Marking Scheme Guide:
                        </span>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Excellent (20/20)">
                            <span style={{ background: '#ea580c', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10.5px' }}>Exc</span>
                            <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Excellent (20/20)</span>
                          </div>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Good (15/20)">
                            <span style={{ background: '#ea580c', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10.5px' }}>Gd</span>
                            <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Good (15/20)</span>
                          </div>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Average (10/20)">
                            <span style={{ background: '#ea580c', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10.5px' }}>Avg</span>
                            <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Average (10/20)</span>
                          </div>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Absent (0/20)">
                            <span style={{ background: '#b91c1c', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10.5px' }}>Abs</span>
                            <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: '700' }}>Absent (0/20)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                      No students allocated to your squad yet.
                    </div>
                  ) : isMobile ? (
                    /* ── MOBILE CARDS VIEW ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                      {students.map((st, idx) => {
                        const marksObj = getStudentLiveMarks(st.id);
                        const sched = schedules.find(s => 
                          s.date === `Day ${selectedDay}` && 
                          s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
                        );
                        const studentAtt = sched ? attendanceRecords.find(a => 
                          String(a.student_id) === String(st.id) && 
                          String(a.schedule_id) === String(sched.id)
                        ) : null;
                        const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';
                        const isLocked = marksObj.status === 'locked' || isAbsent;

                        return (
                          <div key={st.id} style={{ background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0', padding: '16px', opacity: isLocked ? 0.8 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                              <div>
                                <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{st.name}</h4>
                                {!isLtcMember && <code style={{ fontSize: '10px', color: '#64748b' }}>PRN: {st.prn || '—'}</code>}
                              </div>
                              <div style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', color: '#0f172a' }}>
                                Total: {marksObj.daily_total}/20
                              </div>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Attendance (0-4)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'attendance_marks', 4, marksObj, isLocked)}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Participation (0-4)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'participation_marks', 4, marksObj, isLocked)}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Effort (0-4)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'effort_marks', 4, marksObj, isLocked)}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Learning (0-3)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'learning_marks', 3, marksObj, isLocked)}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Discipline (0-3)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'discipline_marks', 3, marksObj, isLocked)}</div>
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Reflection (0-2)</label>
                                <div style={{ marginTop: '2px' }}>{renderMarkSelector(st.id, 'reflection_marks', 2, marksObj, isLocked)}</div>
                              </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#64748b' }}>Remarks</label>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={marksObj.remarks}
                                onChange={(e) => updatePendingMark(st.id, 'remarks', e.target.value)}
                                placeholder="Feedback/Remarks..."
                                style={{ width: '100%', height: '32px', padding: '0 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button title="Excellent (20/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'excellent')} style={{ padding: '4px 8px', fontSize: '10px', background: '#ffffff', border: '1px solid #ea580c', borderRadius: '6px', color: '#ea580c', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Exc</button>
                                <button title="Good (15/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'good')} style={{ padding: '4px 8px', fontSize: '10px', background: '#ffffff', border: '1px solid #ea580c', borderRadius: '6px', color: '#ea580c', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Gd</button>
                                <button title="Average (10/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'average')} style={{ padding: '4px 8px', fontSize: '10px', background: '#ffffff', border: '1px solid #ea580c', borderRadius: '6px', color: '#ea580c', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Avg</button>
                                <button title="Absent (0/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'absent')} style={{ padding: '4px 8px', fontSize: '10px', background: '#ffffff', border: '1px solid #b91c1c', borderRadius: '6px', color: '#b91c1c', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Abs</button>
                              </div>
                              <div>
                                {isLocked ? (
                                  isAbsent ? (
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626' }}>Absent</span>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#dc2626' }}>Locked</span>
                                      {marksObj.locked_by_name && (
                                        <span style={{ fontSize: '9.5px', color: '#b91c1c', fontStyle: 'italic', fontWeight: '600' }}>
                                          by {marksObj.locked_by_name}
                                        </span>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a' }}>Draft</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── DESKTOP TABLE VIEW ── */
                    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1.5px solid #e2e8f0', marginBottom: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                            <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '800', fontSize: '11px' }}>#</th>
                            <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '800', fontSize: '11px' }}>Student</th>
                            {!isLtcMember && <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '800', fontSize: '11px' }}>PRN</th>}
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Attendance (0-4)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Participation (0-4)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Effort (0-4)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Learning (0-3)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Discipline (0-3)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Reflection (0-2)</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Total</th>
                            <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: '800', fontSize: '11px', minWidth: '130px' }}>Remarks</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px', minWidth: '130px' }}>Presets</th>
                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((st, i) => {
                            const marksObj = getStudentLiveMarks(st.id);
                            const sched = schedules.find(s => 
                              s.date === `Day ${selectedDay}` && 
                              s.title.toLowerCase().includes(pillarsList.find(p => p.key === selectedPillar)?.name.toLowerCase())
                            );
                            const studentAtt = sched ? attendanceRecords.find(a => 
                              String(a.student_id) === String(st.id) && 
                              String(a.schedule_id) === String(sched.id)
                            ) : null;
                            const isAbsent = studentAtt?.status?.toLowerCase() === 'absent';
                            const isLocked = marksObj.status === 'locked' || isAbsent;

                            return (
                              <tr key={st.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', opacity: isLocked ? 0.8 : 1 }}>
                                <td style={{ padding: '10px 8px', color: '#64748b', fontWeight: '700' }}>{i + 1}</td>
                                <td style={{ padding: '10px 8px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{st.name}</td>
                                {!isLtcMember && (
                                  <td style={{ padding: '10px 8px' }}>
                                    <code style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>{st.prn || '—'}</code>
                                  </td>
                                )}
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'attendance_marks', 4, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'participation_marks', 4, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'effort_marks', 4, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'learning_marks', 3, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'discipline_marks', 3, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>{renderMarkSelector(st.id, 'reflection_marks', 2, marksObj, isLocked)}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>{marksObj.daily_total}/20</td>
                                <td style={{ padding: '10px 8px' }}>
                                  <input
                                    type="text"
                                    disabled={isLocked}
                                    value={marksObj.remarks}
                                    onChange={(e) => updatePendingMark(st.id, 'remarks', e.target.value)}
                                    placeholder="Remarks..."
                                    style={{ width: '100%', height: '24px', padding: '0 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11px' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                                    <button title="Excellent (20/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'excellent')} style={{ padding: '3px 6px', fontSize: '9px', background: '#ffffff', border: '1px solid #1e3a8a', borderRadius: '4px', color: '#1e3a8a', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Exc</button>
                                    <button title="Good (15/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'good')} style={{ padding: '3px 6px', fontSize: '9px', background: '#ffffff', border: '1px solid #2563eb', borderRadius: '4px', color: '#2563eb', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Gd</button>
                                    <button title="Average (10/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'average')} style={{ padding: '3px 6px', fontSize: '9px', background: '#ffffff', border: '1px solid #64748b', borderRadius: '4px', color: '#64748b', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Avg</button>
                                    <button title="Absent (0/20)" disabled={isLocked} onClick={() => applyPreset(st.id, 'absent')} style={{ padding: '3px 6px', fontSize: '9px', background: '#ffffff', border: '1px solid #b91c1c', borderRadius: '4px', color: '#b91c1c', fontWeight: '800', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>Abs</button>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {isLocked ? (
                                    isAbsent ? (
                                      <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block' }}>Absent</span>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                        <span style={{ background: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block' }}>Locked</span>
                                        {marksObj.locked_by_name && (
                                          <span style={{ fontSize: '9px', color: '#b91c1c', fontStyle: 'italic', fontWeight: '600' }}>
                                            by {marksObj.locked_by_name}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block' }}>Draft</span>
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
              ) : (
                /* ── EVALUATION DASHBOARD ── */
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <PenTool size={22} /> LTC Pillars Evaluation
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                    Grade student squads across the 5 pillars. Directly click a day to enter grades.
                  </p>

                  {/* Dashboard Counts Row */}
                  {(() => {
                    const completedCount = students.filter(st => {
                      const studentEvals = allEvaluations.filter(e => String(e.student_id) === String(st.id));
                      const lockedCount = studentEvals.filter(e => e.status === 'locked').length;
                      return lockedCount === 25;
                    }).length;

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        {[
                          ['Total Students', students.length, '#1e3a8a', '#2563eb', Users, 'rgba(37, 99, 235, 0.08)', null],
                          ['Fully Evaluated', completedCount, '#047857', '#10b981', CheckCircle, 'rgba(16, 185, 129, 0.08)', 'Student is fully evaluated only after completing all 5 pillars \u00d7 5 days assessments.'],
                          ['Evaluation Pending', students.length - completedCount, '#b45309', '#f59e0b', HelpCircle, 'rgba(245, 158, 11, 0.08)', 'Student has at least one day or pillar draft evaluation remaining.'],
                          ['Average Score (/100)', (() => {
                            const completedStudents = students.filter(st => {
                              const studentEvals = allEvaluations.filter(e => String(e.student_id) === String(st.id));
                              const lockedCount = studentEvals.filter(e => e.status === 'locked').length;
                              return lockedCount === 25;
                            });

                            const completedSummaries = allSummaries.filter(sum => 
                              completedStudents.some(s => String(s.id) === String(sum.student_id))
                            );

                            if (completedSummaries.length === 0) return '-';
                            const sumScore = completedSummaries.reduce((acc, curr) => acc + Number(curr.final_score_out_of_100 || 0), 0);
                            return (sumScore / completedSummaries.length).toFixed(1);
                          })(), '#ea580c', '#f97316', Award, 'rgba(234, 88, 12, 0.08)', null]
                        ].map(([lbl, val, textClr, borderClr, Icon, iconBg, tooltip]) => (
                          <div 
                            key={lbl} 
                            title={tooltip}
                            style={{ 
                              background: '#ffffff', 
                              borderRadius: '16px', 
                              border: '1px solid #e2e8f0', 
                              padding: isMobile ? '12px' : '16px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              justifyContent: 'space-between',
                              position: 'relative', 
                              overflow: 'hidden', 
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              minHeight: isMobile ? '105px' : '120px',
                              cursor: tooltip ? 'help' : 'default'
                            }}
                            className="hover:shadow-md hover:-translate-y-0.5 transition-all"
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px', zIndex: 2 }}>
                              <span style={{ fontSize: isMobile ? '9.5px' : '11.5px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', lineHeight: 1.3, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                {lbl}
                              </span>
                              <div style={{ 
                                width: isMobile ? '28px' : '36px', 
                                height: isMobile ? '28px' : '36px', 
                                borderRadius: isMobile ? '8px' : '10px', 
                                backgroundColor: iconBg, 
                                boxShadow: `0 6px 15px -3px ${iconBg.replace('0.08', '0.15')}`, 
                                border: `1px solid ${iconBg}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Icon size={isMobile ? 16 : 20} color={borderClr} strokeWidth={2.4} />
                              </div>
                            </div>
                            <div style={{ zIndex: 2, marginTop: isMobile ? '8px' : '12px' }}>
                              <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '850', color: textClr, marginTop: '4px', lineHeight: 1 }}>
                                {val}
                              </div>
                            </div>
                            {/* Dot Grid Watermark & Glow */}
                            <div style={{ 
                              position: 'absolute', 
                              bottom: 0, 
                              right: 0, 
                              width: '120px', 
                              height: '100px', 
                              background: `radial-gradient(circle at bottom right, ${iconBg.replace('0.08', '0.07')}, transparent 70%)`,
                              pointerEvents: 'none',
                              zIndex: 1
                            }}>
                              <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundImage: `radial-gradient(${borderClr}26 1.5px, transparent 1.5px)`,
                                backgroundSize: '8px 8px',
                                WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
                                maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 5 Pillars list */}
                  <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pillar Name</th>
                          {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'].map(d => (
                            <th key={d} style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '140px' }}>{d}</th>
                          ))}
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', width: '120px' }}>Locked Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pillarsList.map((pillar, idx) => {
                          const totalLocked = [1, 2, 3, 4, 5].reduce((acc, d) => acc + getCompletedCount(pillar.key, d), 0);
                          const totalPossible = 5 * students.length;
                          const progressPercent = totalPossible > 0 ? Math.round((totalLocked * 100) / totalPossible) : 0;

                          return (
                            <tr key={pillar.key} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                              <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0f172a' }}>{pillar.name}</td>
                              {[1, 2, 3, 4, 5].map(d => {
                                const completedCount = getCompletedCount(pillar.key, d);
                                const isDayCompleted = completedCount === students.length && students.length > 0;
                                const isDayStarted = completedCount > 0;
                                const attDone = isAttendanceDone(pillar.key, d);

                                return (
                                  <td key={d} style={{ padding: '8px', textAlign: 'center' }}>
                                    <button
                                      disabled={!attDone}
                                      onClick={() => {
                                        setSelectedPillar(pillar.key);
                                        setSelectedDay(d);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px 6px',
                                        background: !attDone ? '#f1f5f9' : isDayCompleted ? '#f0fdf4' : isDayStarted ? '#eff6ff' : '#f8fafc',
                                        border: `1.5px ${!attDone ? 'dashed' : 'solid'} ${!attDone ? '#cbd5e1' : isDayCompleted ? '#bbf7d0' : isDayStarted ? '#bfdbfe' : '#e2e8f0'}`,
                                        borderRadius: '8px',
                                        cursor: !attDone ? 'not-allowed' : 'pointer',
                                        textAlign: 'center',
                                        fontSize: '11.5px',
                                        fontWeight: '750',
                                        color: !attDone ? '#94a3b8' : isDayCompleted ? '#16a34a' : isDayStarted ? '#2563eb' : '#64748b',
                                        transition: 'all 0.15s ease',
                                        opacity: !attDone ? 0.75 : 1
                                      }}
                                      onMouseOver={(e) => {
                                        if (attDone) {
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                                        }
                                      }}
                                      onMouseOut={(e) => {
                                        if (attDone) {
                                          e.currentTarget.style.transform = 'none';
                                          e.currentTarget.style.boxShadow = 'none';
                                        }
                                      }}
                                    >
                                      <div>{completedCount} / {students.length}</div>
                                      <div style={{ fontSize: '9px', fontWeight: '800', marginTop: '2px', textTransform: 'uppercase' }}>
                                        {!attDone ? 'Locked' : isDayCompleted ? 'Completed' : 'Draft'}
                                      </div>
                                    </button>
                                  </td>
                                );
                              })}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                  <div style={{ width: '50px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent === 100 ? '#16a34a' : '#2563eb' }}></div>
                                  </div>
                                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800' }}>{progressPercent}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}













        {activeTab === 'guidelines' && (
          <div className="glass-card animate-fade-in">
            <h2 style={{ fontSize: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText className="text-primary" /> Notifications, SOPs & Guidelines
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Document Name</th><th>Link</th></tr></thead>
                <tbody>
                  {documents.map(d => (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td><a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>View Document</a></td>
                    </tr>
                  ))}
                  {documents.length === 0 && <tr><td colSpan="2" style={{ textAlign: 'center' }}>No documents currently issued.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && <FacultyPostLtcFeedbackTab token={token} />}

        {activeTab === 'faq' && <FacultyFaqTab isLtcMember={isLtcMember} />}
        {activeTab === 'support' && <SupportTab />}

        {activeTab === 'journey' && <FacultyJourneyTab token={token} facultyInfo={facultyInfo} />}

        {activeTab === 'pre-ltc-feedback' && <FacultyPreLtcFeedbackTab token={token} />}

        {activeTab === 'tickets' && <FacultyTicketsTab token={token} API={API_BASE_URL} />}

        {activeTab === 'certificates' && <UserCertificatesTab token={token} />}
        
        {activeTab === 'performance-admin' && (
          <PerformanceAdminMarkingTab
            API={API_BASE_URL}
            token={token}
            user={facultyInfo}
            assignedRoles={assignedPerformanceRoles}
            showToast={showToast}
          />
        )}

        {activeTab === 'undertaking' && (
          <div className="glass-card animate-fade-in" style={{ maxWidth: '750px', margin: isMobile ? '0 auto 80px auto' : '0 auto', padding: isMobile ? '20px' : '40px', background: '#ffffff', borderRadius: '16px', boxShadow: 'var(--shadow-md)', border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #0f172a', paddingBottom: '20px' }}>
              <img src="/ltc.png" alt="LTC Logo" style={{ height: '60px', objectFit: 'contain', marginBottom: '12px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>LTC Faculty Undertaking</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0', fontWeight: '500' }}>Official Immersion Honor Code & Agreement</p>
            </div>

            {facultyInfo?.undertaking_submitted ? (
              // Submitted State
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: '30px 20px', textAlign: 'center' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)' }}>
                  </div>
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>Undertaking Submitted Successfully</h3>
                  <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '480px', margin: 0 }}>
                    You have digitally signed and recorded this undertaking on the LTC system. A copy has been shared with the LTC Administration.
                  </p>
                </div>

                <div style={{ width: '100%', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', textAlign: 'left', marginTop: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Signed Signature</span>
                    <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0', fontFamily: 'serif', fontStyle: 'italic' }}>{facultyInfo.undertaking_signed_name}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Department</span>
                    <p style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>{facultyInfo.department || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Submission Date</span>
                    <p style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>{facultyInfo.undertaking_signed_date}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Verification Status</span>
                    <p style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0' }}>Verified Record</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>T-Shirt Size</span>
                    <p style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', margin: '4px 0 0 0' }}>{facultyInfo.tshirt_size || '—'}</p>
                  </div>
                </div>

                <button onClick={handlePrintUndertaking} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: '600' }}>
                  Print Receipt
                </button>
              </div>
            ) : (
              // Form State
              <form onSubmit={handleSubmitUndertaking} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', color: '#334155', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#0f172a' }}>LTC Honor Code & Conduct Policy</p>
                  <p style={{ margin: 0 }}>
                    As a representative of my institution participating in the Life Awakening Program (LTC) program, I solemnly declare that:
                  </p>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>I will actively mentor and guide my assigned squad members, helping them achieve all project and evaluation milestones.</li>
                    <li>I will attend and evaluate scheduled sessions on time and grade students fairly according to the rubric.</li>
                    <li>I will maintain high standards of professionalism and follow the official guidelines set by the LTC administration.</li>
                    <li>I understand that my role is crucial for the transformation of my squad students.</li>
                  </ol>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Card 1: Read/Understand Honor Code */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      I confirm that I have read and fully understand the LTC Honor Code and Conduct Policy guidelines.
                    </div>
                  </div>

                  {/* Card 2: Rules */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      I agree to abide by the mentorship, evaluation, and mark submission rules.
                    </div>
                  </div>

                  {/* Card 3: Photo Consent */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={undertakingForm.photoVideoConsent} onChange={e => setUndertakingForm({ ...undertakingForm, photoVideoConsent: e.target.checked })} required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      <strong>Photo / Video Consent:</strong> I consent to the organisers capturing and using my photographs/videos taken during the Life Awakening Program for academic documentation, university publications, internal communication, promotional material, and official social media platforms. I understand that my personal contact details will not be shared.
                    </div>
                  </div>

                  {/* Card 4: T-Shirt Consent */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={undertakingForm.tshirtConsent} onChange={e => setUndertakingForm({ ...undertakingForm, tshirtConsent: e.target.checked })} required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      <strong>T-Shirt Size Consent:</strong> I consent to provide my T-shirt size information for arranging official LTC program apparel. I confirm that the selected size is correct and understand that changes may not be possible after final submission.
                    </div>
                  </div>

                  {/* Card 5: Health Data Consent */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={undertakingForm.dataConsent} onChange={e => setUndertakingForm({ ...undertakingForm, dataConsent: e.target.checked })} required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      <strong>Personal / Health Data Consent:</strong> I consent to the organisers collecting and processing my personal/health data solely for program delivery, safety, compliance, academic and administrative purposes.
                    </div>
                  </div>

                  {/* Card 6: Bag Check Consent */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={undertakingForm.bagCheckConsent} onChange={e => setUndertakingForm({ ...undertakingForm, bagCheckConsent: e.target.checked })} required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      <strong>Bag Checking Consent:</strong> I consent to bag checks by authorised staff members if required for safety and security reasons.
                    </div>
                  </div>

                  {/* Card 7: Do's & Don'ts Consent */}
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={undertakingForm.dosDontsConsent} onChange={e => setUndertakingForm({ ...undertakingForm, dosDontsConsent: e.target.checked })} required style={{ marginTop: '4px', transform: 'scale(1.15)', cursor: 'pointer' }} />
                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                      <strong>Do&apos;s &amp; Don&apos;ts Consent:</strong> I confirm that I have read the Do&apos;s &amp; Don&apos;ts of the LTC program and agree to abide by them throughout the duration of the program.
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Select T-Shirt Size</label>
                  <select
                    value={undertakingForm.tshirtSize}
                    onChange={(e) => setUndertakingForm({ ...undertakingForm, tshirtSize: e.target.value })}
                    required
                    className="input-field"
                    style={{ margin: 0, cursor: 'pointer', width: '100%' }}
                  >
                    <option value="">-- Select Size --</option>
                    {[
                      { value: '36 - S', label: '36 - S' },
                      { value: '38 - M', label: '38 - M' },
                      { value: '40 - L', label: '40 - L' },
                      { value: '42 - XL', label: '42 - XL' },
                      { value: '44 - XXL', label: '44 - XXL' },
                      { value: '46 - XXXL', label: '46 - XXXL' }
                    ].map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Full Name (Digital Signature)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Type your full name to sign..."
                      style={{ margin: 0 }}
                      value={undertakingForm.signedName}
                      onChange={(e) => setUndertakingForm({ ...undertakingForm, signedName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Date of Signature</label>
                    <input
                      type="date"
                      className="input-field"
                      style={{ margin: 0 }}
                      value={undertakingForm.signedDate}
                      onChange={(e) => setUndertakingForm({ ...undertakingForm, signedDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn" 
                  disabled={submittingUndertaking}
                  style={{ background: '#0f172a', color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: '700', borderRadius: '8px', alignSelf: 'flex-start', border: 'none', cursor: 'pointer' }}
                >
                  {submittingUndertaking ? 'Submitting...' : 'Sign & Submit Undertaking'}
                </button>
              </form>
            )}
          </div>
        )}

        <ScrollToTop watchDeps={[activeTab]} />
    </>
  )

  const renderDesktopTopbar = () => {
    return (
      <header 
        className="h-12 flex items-center justify-between px-8 sticky top-0 z-10 flex-shrink-0"
        style={{ 
          backgroundColor: '#ea580c', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          overflow: 'visible'
        }}
      >
        {/* Breadcrumbs / Page Title */}
        <div 
          className="flex items-center"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '15px', fontWeight: 600, lineHeight: 1.2, color: '#F8FAFC', zIndex: 1, position: 'relative' }}
        >
          <span className="text-[#F8FAFC]/70 hover:text-white cursor-pointer transition-colors" onClick={() => setActiveTab('dashboard')}>{isLtcMember ? t('LTC Member Portal') : t('Faculty Portal')}</span>
          <ChevronRight size={14} className="mx-2 text-[#F8FAFC]/40" />
          <span style={{ fontWeight: 700, color: '#F8FAFC', textTransform: 'capitalize' }}>
            {t(
              activeTab === 'dashboard' ? 'Overview' :
              activeTab === 'students' ? 'Students' :
              activeTab === 'pre-ltc-feedback' ? 'Pre-LTC Feedback' :
              activeTab === 'undertaking' ? 'Undertaking Form' :
              activeTab === 'attendance' ? 'My Attendance' :
              activeTab === 'performance-admin' ? 'Performance Admin' :
              activeTab === 'evaluate' ? 'Evaluations & Marks' :
              activeTab === 'timetable' ? 'LAP Timetable' :
              activeTab === 'profile' ? 'My Profile' :
              activeTab === 'journey' ? 'LAP Journey Media' :
              activeTab === 'guidelines' ? 'Docs & Guidelines' :
              activeTab === 'feedback' ? 'Post-LTC Feedback' :
              activeTab === 'faq' ? 'FAQs' :
              activeTab === 'tickets' ? 'Support Tickets' : activeTab
            )}
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4" style={{ zIndex: 1, position: 'relative' }}>
          {/* Language Selector */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10">
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'en' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('hi')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'hi' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              हिंदी
            </button>
            <button 
              onClick={() => changeLanguage('mr')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'mr' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              मराठी
            </button>
          </div>

          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-white/10" 
            onClick={fetchDashboardData}
          >
            <RefreshCw size={12} />
            <span>{t("Refresh")}</span>
          </button>
          {renderNotifications()}
        </div>
      </header>
    )
  }



  return (
    <>
      {!isMobile ? (
        <div className="desktop-layout" style={{ background: '#eff2f6' }}>
          {renderDesktopSidebar()}
          <div className="desktop-main-container" style={{ background: activeTab === 'journey' ? '#F5F6F8' : '#eff2f6' }}>
            {renderDesktopTopbar()}
            <div className="desktop-content" style={{ padding: activeTab === 'journey' ? '20px 24px' : activeTab === 'dashboard' ? '40px 30px' : '30px', overflowY: 'auto', background: activeTab === 'journey' ? '#F5F6F8' : '#eff2f6' }}>
              {renderContent()}
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-layout mobile-layout" style={{ background: activeTab === 'journey' ? '#F5F6F8' : '#eff2f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {renderMobileSidebar()}
          {/* Mobile topbar */}
          {!isSidebarOpen && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: 'calc(44px + env(safe-area-inset-top))',
                zIndex: 999,
                background: '#ea580c',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 'env(safe-area-inset-top)',
                paddingLeft: '12px',
                paddingRight: '12px',
                boxSizing: 'border-box',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open Sidebar"
                  style={{
                    background: 'transparent',
                    color: '#ffffff',
                    border: 'none',
                    padding: 0,
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '50%'
                  }}
                  className="hover:bg-white/10"
                >
                  <Menu size={20} />
                </button>
                <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '13.5px', fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {t(
                    activeTab === 'dashboard' ? 'Overview' :
                    activeTab === 'students' ? 'Students' :
                    activeTab === 'pre-ltc-feedback' ? 'Pre-LTC Feedback' :
                    activeTab === 'undertaking' ? 'Undertaking Form' :
                    activeTab === 'attendance' ? 'My Attendance' :
                    activeTab === 'performance-admin' ? 'Performance Admin' :
                    activeTab === 'evaluate' ? 'Evaluations & Marks' :
                    activeTab === 'timetable' ? 'LAP Timetable' :
                    activeTab === 'profile' ? 'My Profile' :
                    activeTab === 'journey' ? 'LAP Journey Media' :
                    activeTab === 'guidelines' ? 'Docs & Guidelines' :
                    activeTab === 'feedback' ? 'Post-LTC Feedback' :
                    activeTab === 'faq' ? 'FAQs' :
                    activeTab === 'tickets' ? 'Support Tickets' : activeTab
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Language Selector Dropdown (Apple Style) */}
                <div style={{ position: 'relative' }} data-mobile-lang-dropdown>
                  <button 
                    onClick={() => setIsMobileLangOpen(!isMobileLangOpen)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: 'rgba(255, 255, 255, 0.12)', 
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '30px', 
                      padding: '4px 8px',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '700',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      outline: 'none',
                      userSelect: 'none'
                    }}
                    className="active:scale-95"
                  >
                    <Globe size={13} strokeWidth={2.4} style={{ opacity: 0.9 }} />
                    <span>
                      {currentLanguage === 'en' ? 'EN' : currentLanguage === 'hi' ? 'HI' : 'MR'}
                    </span>
                    <ChevronDown size={12} strokeWidth={2.4} style={{ 
                      opacity: 0.7, 
                      transform: isMobileLangOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
                    }} />
                  </button>

                  {/* Apple Style Springy Dropdown Menu */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: '34px',
                      right: '0',
                      width: '110px',
                      background: 'rgba(255, 255, 255, 0.85)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      borderRadius: '14px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)',
                      padding: '5px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      pointerEvents: isMobileLangOpen ? 'auto' : 'none',
                      transform: isMobileLangOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
                      opacity: isMobileLangOpen ? 1 : 0,
                      visibility: isMobileLangOpen ? 'visible' : 'hidden',
                      transformOrigin: 'top right',
                      transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    {[
                      { code: 'en', label: 'EN' },
                      { code: 'hi', label: 'हिंदी' },
                      { code: 'mr', label: 'मराठी' }
                    ].map((item) => {
                      const isSelected = currentLanguage === item.code;
                      return (
                        <button
                          key={item.code}
                          onClick={() => {
                            changeLanguage(item.code);
                            setIsMobileLangOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 10px',
                            border: 'none',
                            background: isSelected ? 'rgba(234, 88, 12, 0.1)' : 'transparent',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: isSelected ? '#ea580c' : '#334155',
                            fontSize: '12px',
                            fontWeight: isSelected ? '700' : '500',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            textAlign: 'left',
                            transition: 'all 0.15s ease'
                          }}
                          className="hover:bg-black/5 active:scale-98"
                        >
                          <span>{item.label}</span>
                          {isSelected && (
                            <Check size={12} strokeWidth={3} color="#ea580c" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notifications */}
                {renderNotifications()}

                {/* Refresh Button */}
                <button 
                  style={{ 
                    padding: 0,
                    height: '32px',
                    width: '32px',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    cursor: 'pointer'
                  }} 
                  className="hover:bg-white/10 hover:text-white transition-colors"
                  onClick={fetchDashboardData} 
                  title={t("Refresh")}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
          )}
          <div className="main-content" style={{ flex: 1, padding: activeTab === 'journey' ? 'calc(56px + env(safe-area-inset-top)) 16px calc(80px + env(safe-area-inset-bottom))' : 'calc(64px + env(safe-area-inset-top)) 16px calc(90px + env(safe-area-inset-bottom))', background: activeTab === 'journey' ? '#F5F6F8' : '#eff2f6' }}>
            {renderContent()}
          </div>
          <div className="mobile-bottom-nav" style={isSidebarOpen ? { display: 'none' } : {}}>
            <button 
              className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); if (isMobile) setIsSidebarOpen(false); }}
            >
              <Home size={20} />
              <span>Dashboard</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => { setActiveTab('attendance'); if (isMobile) setIsSidebarOpen(false); }}
            >
              <ClipboardList size={20} />
              <span>Attendance</span>
            </button>
            <button 
              className={`mobile-bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => { setActiveTab('profile'); if (isMobile) setIsSidebarOpen(false); }}
            >
              <User size={20} />
              <span>Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Red Flag Modal ─── */}
      {redFlagModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxWidth: 480, width: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>Log Red Flag Incident</h3>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>{redFlagModal.studentName}</p>
                </div>
              </div>
              <button onClick={() => setRedFlagModal({ open: false, studentId: null, studentName: '' })} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>X</button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmitRedFlag} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>
                Warning: This flag will be <strong>permanently logged</strong> and sent to the Admin Panel under Miscellaneous. Please be accurate and factual.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Incident Category *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {['Disturbance', 'Health Issue', 'Others'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRedFlagForm(f => ({ ...f, category: cat }))}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: '2px solid',
                        borderColor: redFlagForm.category === cat ? '#dc2626' : '#e2e8f0',
                        background: redFlagForm.category === cat ? '#fff5f5' : '#f8fafc',
                        color: redFlagForm.category === cat ? '#dc2626' : '#64748b',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  Detailed Description *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe what happened in detail. Include time, behaviour, context, or any other relevant information..."
                  value={redFlagForm.reason}
                  onChange={e => setRedFlagForm(f => ({ ...f, reason: e.target.value }))}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setRedFlagModal({ open: false, studentId: null, studentName: '' })} style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#64748b' }}>
                  Cancel
                </button>
                <button type="submit" disabled={redFlagSubmitting} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: redFlagSubmitting ? 0.7 : 1 }}>
                  {redFlagSubmitting ? 'Submitting...' : 'Submit Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Premium Confirmation Card Modal */}
      {confirmModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <style>{`
            @keyframes modalFadeIn {
              from { opacity: 0; transform: scale(0.96); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <div style={{
            background: '#ffffff',
            maxWidth: '440px',
            width: '100%',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #f1f5f9',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            animation: 'modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
                fontSize: '22px',
                fontWeight: 'bold'
              }}>
                !
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                {confirmModal.title || 'Attention Required'}
              </h3>
            </div>
            
            <p style={{ fontSize: '14.5px', color: '#475569', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
              {confirmModal.message}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal({ open: false, title: '', message: '', onConfirm: null, onCancel: null });
                }}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: '750',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ open: false, title: '', message: '', onConfirm: null, onCancel: null });
                }}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 22px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                Skip & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FacultyFaqTab({ isLtcMember }) {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = [
    {
      q: "What is the Life Transformation Centre?",
      a: [
        t("Life Transformation Centre (LTC) is an experiential residential learning ecosystem that focuses on holistic development through five pillars: Agriculture & Nature, Physical Fitness & Sports, Team Building & Leadership, Patriotism & Nation Building, and Spirituality & Peace.")
      ]
    },
    {
      q: "Who can participate in the program?",
      a: [
        t("LTC offers various programs for different stakeholders:"),
        {
          type: "list",
          items: [
            t("Life Awakening Program for School Children"),
            t("Life Awakening Program for Higher Education"),
            t("Life Realignment Program for Corporate Leaders"),
            t("Life Excellence & Advancement Program for Public Leaders & Policy Makers"),
            t("Life Leadership Program for Global Participants")
          ]
        },
        t("Please see the website to know more about all programs.")
      ]
    },
    {
      q: "How long is the Life Awakening Program?",
      a: [
        t("The Life Awakening Program is a 5-day immersive residential program designed to provide participants with a holistic learning experience through LTC’s Five Pillars.")
      ]
    },
    {
      q: "Where is the Life Transformation Centre (LTC) located?",
      a: [
        t("LTC is located at Boribel, near Daund, Pune, Maharashtra.")
      ]
    },
    {
      q: "How can I register for the program?",
      a: [
        t("Participants can register through the official LTC website or by contacting the LTC Admissions/Contact Team.")
      ]
    },
    {
      q: "Is the program residential?",
      a: [
        t("Yes. The program is designed as an immersive residential experience where participants stay on campus throughout the duration of the program.")
      ]
    },
    {
      q: "What activities are included in the program?",
      a: [
        t("Participants engage in activities related to the Five Pillars, including:"),
        {
          type: "list",
          items: [
            t("Agriculture activities"),
            t("Nature walks"),
            t("Yoga"),
            t("Meditation"),
            t("Traditional games"),
            t("Leadership exercises"),
            t("Team challenges"),
            t("Obstacle courses"),
            t("Reflection sessions"),
            t("Community living"),
            t("Group discussions"),
            t("Service activities")
          ]
        }
      ]
    },
    {
      q: "What accommodation facilities are provided?",
      a: [
        t("LTC provides clean and comfortable residential accommodation. Participants are provided with basic bedding facilities such as:"),
        {
          type: "list",
          items: [
            t("Single bed"),
            t("Bedsheet"),
            t("Pillow"),
            t("Seasonal blanket")
          ]
        }
      ]
    },
    {
      q: "What kind of food is served? Is Jain food available?",
      a: [
        t("Participants receive nutritious vegetarian meals prepared with fresh ingredients, many of which are sourced from LTC farms."),
        t("As part of community living, participants may be expected to:"),
        {
          type: "list",
          items: [
            t("Express gratitude before meals."),
            t("Clean their plates after meals."),
            t("Respect the shared dining environment.")
          ]
        }
      ]
    },
    {
      q: "What should participants bring? Is there a dress code?",
      a: [
        t("Yes. Participants are expected to wear simple, modest, and activity-appropriate clothing in line with LTC’s values of minimalism and mindfulness. Specific attire guidelines will be shared after registration.")
      ]
    },
    {
      q: "Can participants carry mobile phones?",
      a: [
        t("Yes. Participants may bring a mobile phone, but it must be deposited after dinner on the first day of arrival. It will be safely returned after lunch on the final day of the program.")
      ]
    },
    {
      q: "Is the campus safe? What medical support is available?",
      a: [
        t("Yes. LTC has a secured campus with controlled entry and exit points and CCTV surveillance across the campus. Participant safety is a top priority.")
      ]
    },
    {
      q: "How can parents communicate with students/participants during the program?",
      a: [
        t("Yes. Parents can contact the LTC administration in case of emergencies. Since the program encourages immersion and digital detox, routine communication with participants is managed through official channels.")
      ]
    },
    {
      q: "Are participants covered by insurance during the program?",
      a: [
        t("Yes. All registered participants are covered under a comprehensive insurance policy as per the policy terms.")
      ]
    }
  ];

  const matchesAnswer = (part, query) => {
    if (!part) return false;
    if (typeof part === 'string') {
      return part.toLowerCase().includes(query);
    }
    if (part.type === 'list' && Array.isArray(part.items)) {
      return part.items.some(item => typeof item === 'string' && item.toLowerCase().includes(query));
    }
    return false;
  };

  const filteredFaqs = faqs;

  const renderAnswer = (answerData) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {answerData.map((part, index) => {
          if (typeof part === 'string') {
            return <p key={index} style={{ margin: 0, lineHeight: '1.6' }}>{part}</p>;
          }
          if (part && part.type === 'list') {
            return (
              <ul key={index} style={{ 
                margin: '4px 0', 
                paddingLeft: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px',
                listStyleType: 'disc'
              }}>
                {part.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>{item}</li>
                ))}
              </ul>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div 
      style={{ 
        padding: '24px', 
        background: '#ffffff', 
        border: '1px solid #e2e8f0', 
        borderRadius: '16px', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }} 
      className="animate-fade-in faq-tab-container"
    >
      <style>{`
        .faq-search-input:focus {
          border-color: #ea580c !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12) !important;
        }
        @media (max-width: 640px) {
          .faq-tab-container {
            padding: 16px !important;
            border-radius: 16px !important;
          }
          .faq-item-button {
            padding: 14px 16px !important;
            font-size: 13.5px !important;
          }
          .faq-item-answer {
            padding: 12px 16px 16px 16px !important;
            font-size: 12.5px !important;
          }
        }
      `}</style>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(234,88,12,0.2)'
          }}>
            <HelpCircle size={20} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
            {t("Frequently Asked Questions")}
          </h2>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
          {t("Got questions about LTC? Find answers to safety, accommodation, food, guidelines, and activities.")}
        </p>
      </div>



      {/* Accordion List */}
      {filteredFaqs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', border: '1.5px dashed #e2e8f0', borderRadius: '16px' }}>
          <HelpCircle size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
          <p style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>{t("No matching questions found")}</p>
          <p style={{ fontSize: '12px', margin: '4px 0 0 0', color: '#94a3b8' }}>{t("Try typing different keywords or clear the search.")}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div 
                key={idx}
                style={{ 
                  border: '1.5px solid #e2e8f0', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  background: isOpen ? '#f8fafc' : '#ffffff', 
                  transition: 'all 0.15s ease-in-out' 
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    background: 'none', 
                    border: 'none', 
                    textAlign: 'left', 
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '14.5px',
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                  className="faq-item-button"
                >
                  <span style={{ paddingRight: '12px' }}>{t(faq.q)}</span>
                  <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease', color: isOpen ? '#ea580c' : '#64748b', flexShrink: 0 }} />
                </button>
                
                <div 
                  style={{ 
                    maxHeight: isOpen ? '1000px' : '0', 
                    overflow: 'hidden', 
                    transition: 'max-height 0.25s ease-in-out', 
                    borderTop: isOpen ? '1px solid #e2e8f0' : 'none' 
                  }}
                >
                  <div style={{ padding: '16px 20px', fontSize: '13.5px', color: '#475569', lineHeight: '1.6' }} className="faq-item-answer">
                    {renderAnswer(faq.a)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const RATING_SCALE = ["Never", "Rarely", "Sometimes", "Often", "Always"];

function FacultyPreLtcFeedbackTab({ token }) {
  return <PreLtcFeedbackForm token={token} role="faculty" />;
}

function FacultyPostLtcFeedbackTab({ token }) {
  return <PostLtcFeedbackForm token={token} role="faculty" />;
}

function SupportTab() {
  const { t } = useLanguage();

  const supportMembers = [
    {
      role: t("Operational Manager"),
      icon: Briefcase,
      headerBg: '#1e40af',
      members: [
        {
          name: "Deepak Gaikwad",
          phone: "9655766767",
          email: "deepak.gaikwad.ve@mitwpu.edu.in"
        }
      ]
    },
    {
      role: t("Nursing Staff"),
      icon: Heart,
      headerBg: '#059669',
      members: [
        {
          name: "Nirmala Bhalekar",
          phone: "8208983209",
          email: "nirmala.bhalekar.ve@mitwpu.edu.in"
        },
        {
          name: "Devadatta Kolape",
          phone: "9766172124",
          email: "devadatta.kolape.ve@mitwpu.edu.in"
        }
      ]
    },
    {
      role: t("Doctor"),
      icon: Activity,
      headerBg: '#dc2626',
      members: [
        {
          name: "Anwar Shaikh",
          phone: "9823443537",
          email: "anwar.shaikh.ve@mitwpu.edu.in"
        }
      ]
    }
  ];

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Users className="text-primary" /> {t("Support Contacts")}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {t("Get in touch with our operations and medical teams for any assistance during the LAP Immersion Program.")}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '10px' }}>
        {supportMembers.map((group, idx) => {
          const Icon = group.icon;
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {group.members.map((member, mIdx) => (
                <div key={mIdx} style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    background: group.headerBg,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <Icon size={18} style={{ color: '#ffffff' }} />
                    <span style={{ fontSize: '13.5px', color: '#ffffff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.role}
                    </span>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Name */}
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={18} style={{ color: '#64748b' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Name</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                      </div>
                    </div>
                    {/* Phone */}
                    <a href={`tel:${member.phone}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Phone size={18} style={{ color: '#64748b' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Mobile No.</div>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0057b8' }}>{member.phone}</div>
                      </div>
                    </a>
                    {/* Email */}
                    <a href={`mailto:${member.email}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mail size={18} style={{ color: '#64748b' }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Email ID</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0057b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</div>
                      </div>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  );
}
