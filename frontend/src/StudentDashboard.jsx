import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Calendar, ClipboardList, PenTool, LayoutDashboard, Flag, Search, LogOut, MessageSquare, Bell, Menu, Clock, RefreshCw, Sparkles, Rocket, ChevronLeft, ChevronRight, Sun, X, FileText, User, Lock, Award, Download, GraduationCap, Users, HelpCircle, ChevronDown, ChevronUp, CheckCircle, Briefcase, Upload, Image, Image as ImageIcon, Video, Film, Sprout, Dumbbell, MapPin, Activity, Compass, Eye, Trash2, ExternalLink, Heart, ShieldAlert, ShieldCheck, Coffee, Umbrella, Footprints, Check, Phone, Mail, Globe, Edit2, Volume2, VolumeX, Printer, AlertCircle, ArrowRight } from 'lucide-react'
import ScrollToTop from './ScrollToTop'
import TimetablePanel from './TimetablePanel'
import { generateCertificate } from './utils/generateCertificate'
import { generateJourneyReport } from './utils/generateJourneyReport'
import FivePillarsJourney from './FivePillarsJourney'
import { useLanguage } from './context/LanguageContext'
import UserCertificatesTab from './UserCertificatesTab'
import PasswordOtpModal from './PasswordOtpModal'
import FacultyJourneyTab from './FacultyJourneyTab'
import ConfettiPopper from './ConfettiPopper'
import StudentServiceFeedbackTab from './StudentServiceFeedbackTab'
import ResetPasswordGate from './ResetPasswordGate'
import { REQUIRE_STUDENT_PASSWORD_CHANGE } from './config/authConfig'
import { formatStudentEmail } from './utils/studentEmailHelper'
import StudentEmergencyContactsTab from './StudentEmergencyContactsTab'
import StudentCodeOfConductTab from './StudentCodeOfConductTab'
import FirstTimeOnboardingModal from './FirstTimeOnboardingModal'
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

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

const MUTED_SQUAD_COLORS = {
  Surya:     '#9f6e4a',
  Aditya:    '#a64f4f',
  Ravi:      '#b27a37',
  Divakar:   '#5f4b8b',
  Mitra:     '#2d6a4f',
  Martand:   '#2a7b7b',
  Dinkar:    '#2b3a67',
  Prabhakar: '#b05c7e',
  Bhaskar:   '#4a5568',
  Tejonidhi: '#a35246',
}

// Instagram Brand Icon
const InstagramIcon = ({ size = 16, color = "currentColor", style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const PACKING_CATEGORIES = [
  {
    id: 'clothing',
    category: '1. Clothing',
    icon: Dumbbell,
    notes: 'Simple, comfortable, and activity-appropriate. Full lowers/tracks are recommended for all activities.',
    items: [
      { id: 'c1', text: '2–3 sets of sportswear / tracksuits for activities' },
      { id: 'c2', text: 'Casual wear for evenings' },
      { id: 'c3', text: 'Full-sleeve T-shirts and track pants for sports activities' },
      { id: 'c4', text: 'Comfortable plain white dress/clothing for Yoga' },
      { id: 'c5', text: 'Full lowers/tracks are recommended for all activities' },
      { id: 'c6', text: 'White dress – Kurta Pajama for Boys, Kurta and Salwar / leggings / palazzo for Girls' }
    ]
  },
  {
    id: 'weather',
    category: '2. Weather Gear',
    icon: Umbrella,
    notes: 'Please carry weather-appropriate items depending on the season.',
    items: [
      { id: 'w1', text: 'For Rainy Season: Raincoat or umbrella' },
      { id: 'w2', text: 'For Rainy Season: Extra pair of shoes' },
      { id: 'w3', text: 'For Rainy Season: Plastic / zip-lock bags for wet clothes' },
      { id: 'w4', text: 'For Summer: Cap / hat' },
      { id: 'w5', text: 'For Summer: Sunglasses' },
      { id: 'w6', text: 'For Summer: Sunscreen' },
      { id: 'w7', text: 'For Winter: Jacket / sweater for cool evenings' },
      { id: 'w8', text: 'For Winter: Monkey cap' },
      { id: 'w9', text: 'For Winter: Hand gloves' },
      { id: 'w10', text: 'For Winter: Light blanket, if required' }
    ]
  },
  {
    id: 'footwear',
    category: '3. Footwear',
    icon: Footprints,
    notes: 'Comfortable footwear for sports activities, rainy conditions, and dorm room use.',
    items: [
      { id: 'f1', text: 'Comfortable sports shoes' },
      { id: 'f2', text: 'One extra pair of shoes, if possible' },
      { id: 'f3', text: 'Slippers / sandals for room use' },
      { id: 'f4', text: 'Extra pair of shoes for the rainy season' }
    ]
  },
  {
    id: 'essentials',
    category: '4. Essentials',
    icon: Briefcase,
    notes: 'School ID card is strictly mandatory for campus registration & security.',
    items: [
      { id: 'e1', text: 'Socks: 6–7 pairs' },
      { id: 'e2', text: 'Handkerchiefs / napkins' },
      { id: 'e3', text: 'Refillable 1L water bottle, preferably non-plastic' },
      { id: 'e4', text: 'School / college ID card, mandatory', isMandatory: true },
      { id: 'e5', text: 'Small backpack for daily use' },
      { id: 'e6', text: 'Pocket diary and pen' },
      { id: 'e7', text: 'Small torch' },
      { id: 'e8', text: 'Cloth bag for laundry' }
    ]
  },
  {
    id: 'toiletries',
    category: '5. Toiletries',
    icon: Sparkles,
    notes: 'Personal grooming & hygiene essentials neatly labelled in a pouch.',
    items: [
      { id: 't1', text: 'Toothbrush' },
      { id: 't2', text: 'Toothpaste' },
      { id: 't3', text: 'Soap' },
      { id: 't4', text: 'Shampoo' },
      { id: 't5', text: 'Comb' },
      { id: 't6', text: 'Hair oil' },
      { id: 't7', text: 'Deodorant' },
      { id: 't8', text: 'Moisturizer' },
      { id: 't9', text: 'Sunscreen' },
      { id: 't10', text: 'Lip balm' },
      { id: 't11', text: 'Talcum powder' },
      { id: 't12', text: 'Mosquito repellent' },
      { id: 't13', text: 'Face towel' },
      { id: 't14', text: 'Bath towel' }
    ]
  },
  {
    id: 'girls',
    category: '6. For Girls',
    icon: Heart,
    notes: 'Personal care items.',
    items: [
      { id: 'g1', text: 'Sanitary napkins, as required' }
    ]
  },
  {
    id: 'medicines',
    category: '7. Medicines and First Aid',
    icon: ShieldAlert,
    notes: 'All personal medications must be handed over to LTC medical team with parent/doctor prescription.',
    items: [
      { id: 'm1', text: 'Personal medicines, with prescription' },
      { id: 'm2', text: 'Small first-aid kit' },
      { id: 'm3', text: 'Band-aids' },
      { id: 'm4', text: 'ORS or similar hydration support' }
    ]
  },
  {
    id: 'agriculture',
    category: '8. Agriculture and Nature Activities',
    icon: Sprout,
    notes: 'Participants may carry these items for hands-on agriculture and nature-based activities.',
    items: [
      { id: 'a1', text: 'Pulses for sprouting' },
      { id: 'a2', text: 'Dhania / coriander seeds' },
      { id: 'a3', text: 'Rai / mustard seeds for microgreens' },
      { id: 'a4', text: 'Small container for growing microgreens' }
    ]
  },
  {
    id: 'stationery',
    category: '9. Stationery and Reading Material',
    icon: FileText,
    notes: 'Useful for daily journaling, creative workshops, and book exchange.',
    items: [
      { id: 's1', text: 'Notebook / writing pad' },
      { id: 's2', text: 'Pens' },
      { id: 's3', text: 'Pencils' },
      { id: 's4', text: 'Story books for exchange purpose' }
    ]
  },
  {
    id: 'food',
    category: '10. Food',
    icon: Coffee,
    notes: 'Fresh, nutritious vegetarian meals are provided. Only dry snacks as per need are advised.',
    items: [
      { id: 'fd1', text: 'Dry snacks, as per need' }
    ]
  }
];

const STUDENT_DOS = [
  "Always wear your School ID Card and squad badge at all times for safety and identification.",
  "Follow the schedule attentively and report promptly on time for all morning yoga, sessions, and outdoor activities.",
  "Listen carefully to your teachers, wardens, and LTC instructors, and follow their guidance respectfully.",
  "Wear the appropriate dress code – sportswear & sports shoes for activities, plain white for yoga, and neat casuals for evenings.",
  "Keep all your belongings neatly packed, organized, and clearly labelled with your full name and school.",
  "Stay with your assigned squad and buddy at all times during activities, meal times, and campus movements.",
  "Drink water regularly and keep your refillable 1L water bottle handy throughout the day.",
  "Keep dormitory rooms, beds, dining spaces, and campus surroundings clean and tidy at all times.",
  "Inform your warden or faculty mentor immediately if you feel unwell, injured, tired, or need help.",
  "Treat all fellow schoolmates with kindness, teamwork, and respect, and show gratitude before meals."
];

const STUDENT_DONTS = [
  "Do not use or bring mobile phones, video games, smartwatches, or electronic gadgets during the program.",
  "Do not carry cash, gold jewellery, or expensive personal valuables to the residential campus.",
  "Do not leave your squad, dorm room, or campus boundaries without permission from your faculty or warden.",
  "Do not engage in bullying, teasing, shouting, rough play, or jumping on dorm beds.",
  "Do not waste food or water – take only what you need and keep dining spaces clean.",
  "Do not bring sharp or hazardous items such as scissors, cutters, blades, matchboxes, or crackers.",
  "Do not litter on campus grounds, gardens, trails, or residential rooms.",
  "Do not disturb others during rest hours, quiet reading hours, or after night lights-out.",
  "Do not take medicines on your own – all prescribed medicines must be given to the LTC clinic with parent/doctor instructions.",
  "Do not keep wet clothes or damp shoes inside closed bags or under beds – use the laundry bag or dry them properly."
];

// ─── Profile Tab Component ─────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, children }) => (
  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '20px', padding: '24px', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
      {Icon && (
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(234,88,12,0.2)'
        }}>
          <Icon size={16} strokeWidth={2.2} />
        </div>
      )}
      <h3 style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.3px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {title}
      </h3>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>{children}</div>
  </div>
)

const Field = ({ label, value }) => (
  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', transition: 'all 0.15s ease' }}>
    <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{label}</div>
    <div style={{ fontSize: '13.5px', fontWeight: '700', color: value ? '#0f172a' : '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{value || '—'}</div>
  </div>
)

const renderRoleBadge = (squadDesignation, isSquadLeader, options = {}) => {
  const role = squadDesignation || (isSquadLeader ? 'Captain' : null);
  if (!role) return null;

  const roleLower = role.toLowerCase();
  const isCaptain = roleLower.includes('captain') && !roleLower.includes('vice');
  const isViceCaptain = roleLower.includes('vice');

  let bg = 'linear-gradient(135deg, #16a34a, #15803d)';
  let border = '#15803d';
  let icon = '';
  let label = role;

  if (isCaptain) {
    bg = 'linear-gradient(135deg, #f59e0b, #d97706)';
    border = '#b45309';
    icon = '';
    label = role === 'Captain' ? 'Squad Captain' : role;
  } else if (isViceCaptain) {
    bg = 'linear-gradient(135deg, #0284c7, #2563eb)';
    border = '#0369a1';
    icon = roleLower.includes('girl') ? '' : roleLower.includes('boy') ? '' : '';
    label = role;
  } else if (isSquadLeader) {
    bg = 'linear-gradient(135deg, #f59e0b, #d97706)';
    border = '#b45309';
    icon = '';
    label = 'Squad Leader';
  }

  const fontSize = options.fontSize || '10px';
  const padding = options.padding || '3px 9px';

  return (
    <span
      className="animate-fade-in"
      style={{
        fontSize: fontSize,
        fontWeight: '800',
        color: '#ffffff',
        background: bg,
        border: `1px solid ${border}`,
        padding: padding,
        borderRadius: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: isCaptain || isSquadLeader ? '0 2px 8px rgba(245, 158, 11, 0.35)' : isViceCaptain ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...options.style
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
};

function StudentProfileTab({ token, setMyData }) {
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
    const selectedChildId = localStorage.getItem('selectedStudentId') || localStorage.getItem('selected_student_id');
    const headers = { Authorization: `Bearer ${token}` };
    if (selectedChildId) {
      headers['x-student-id'] = selectedChildId;
    }
    fetch(`${API_BASE_URL}/api/student/profile`, { headers })
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
      const res = await fetch(`${API_BASE_URL}/api/student/request-password-otp`, {
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
      const res = await fetch(`${API_BASE_URL}/api/student/verify-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otpCode })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsOtpModalOpen(false)
        setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setPassMsg({ type: 'success', text: t('Password changed successfully!') })
        // Clear the mandatory password-change gate immediately
        setMyData(prev => ({ ...prev, password_changed: true }))
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
      const res = await fetch(`${API_BASE_URL}/api/student/resend-password-otp`, {
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

  const fullName = [profile.salutation, profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || profile.name || '—'
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'

  return (
    <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header Profile Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a, #0d1e4c)',
        borderRadius: 16,
        padding: 32,
        marginBottom: 32,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexWrap: 'wrap',
        boxShadow: '0 10px 15px -3px rgba(13, 30, 76, 0.2), 0 4px 6px -2px rgba(13, 30, 76, 0.1)'
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
            {t(profile.school)} • {t(profile.department)}{profile.panel ? ` • ${t("Panel")}: ${profile.panel}` : ''}
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
            {t("Student Dashboard")}
          </span>
        </div>
      </div>

      <Section title={t("Basic Information")} icon={User}>
        <Field label={t("Full Name")} value={fullName} />
        <Field label={t("Student ID")} value={profile.system_student_id || profile.student_id || profile.ltc_id} />
        {profile.prn && <Field label={t("PRN")} value={profile.prn} />}
        <Field label={t("Roll Number")} value={profile.roll_number} />
      </Section>

      <Section title={t("Personal Details")} icon={Award}>
        <Field label={t("Date of Birth")} value={profile.dob ? new Date(profile.dob).toLocaleDateString('en-IN') : ''} />
        <Field label={t("Gender")} value={t(profile.gender)} />
        <Field label={t("Nationality")} value={t(profile.nationality)} />
        <Field label={t("Aadhar Number")} value={profile.aadhar_no} />
        <Field label={t("Lateral Entry")} value={t(profile.lateral_entry)} />
      </Section>

      <Section title={t("Academic Details")} icon={GraduationCap}>
        {profile.class_grade && <Field label={t("Class / Grade")} value={profile.class_grade} />}
        {profile.age && <Field label={t("Age")} value={profile.age} />}
        <Field label={t("Division")} value={t(profile.division)} />
        <Field label={t("School")} value={t(profile.school)} />
        <Field label={t("Department")} value={t(profile.department)} />
        <Field label={t("Semester")} value={profile.semester} />
        <Field label={t("Panel")} value={t(profile.panel)} />
      </Section>

      <Section title={t("LAP Program & Duties")} icon={Award}>
        <Field label={t("Batch")} value={profile.batch_name || 'LAP-01-1026'} />
        <Field label={t("Squad")} value={t(profile.squad)} />
        <Field label={t("Room")} value={profile.room} />
        <Field label={t("Squad Role / Duty")} value={
            profile.squad_designation || profile.is_squad_leader ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {renderRoleBadge(profile.squad_designation, profile.is_squad_leader, { fontSize: '10px', padding: '3px 8px' })}
              </div>
            ) : t('Member')
          } />
        <Field label={t("Room Role / Duty")} value={t(profile.room_designation || 'Member')} />
      </Section>

      <Section title={t("Contact Information")} icon={Users}>
        <Field label={t("Student Email")} value={formatStudentEmail(profile.email, t("Not provided"))} />
        <Field label={t("Mobile / Phone")} value={profile.phone || t("Not provided")} />
        <div style={{ gridColumn: '1 / -1' }}><Field label={t("Complete Address")} value={profile.address || t("Not provided")} /></div>
      </Section>

      <Section title={t("Parent / Nominee Details")} icon={Briefcase}>
        {(profile.parent1_name || profile.parent_name) && <Field label={t("Parent 1 Name")} value={profile.parent1_name || profile.parent_name} />}
        {(profile.parent1_relationship || profile.parent_relationship) && <Field label={t("Parent 1 Relationship")} value={t(profile.parent1_relationship || profile.parent_relationship)} />}
        <Field label={t("Parent 1 Email")} value={profile.parent1_email || profile.parent_email || t("Not provided")} />
        <Field label={t("Parent 1 Mobile")} value={profile.parent1_phone || profile.parent_mobile || t("Not provided")} />
        {profile.parent2_name && <Field label={t("Parent 2 Name")} value={profile.parent2_name} />}
        {profile.parent2_relationship && <Field label={t("Parent 2 Relationship")} value={t(profile.parent2_relationship)} />}
        {profile.parent2_email && <Field label={t("Parent 2 Email")} value={profile.parent2_email} />}
        {profile.parent2_phone && <Field label={t("Parent 2 Mobile")} value={profile.parent2_phone} />}
        {profile.nominee_name && <Field label={t("Nominee Name")} value={profile.nominee_name} />}
        {profile.nominee_relationship && <Field label={t("Nominee Relationship")} value={t(profile.nominee_relationship)} />}
        {profile.nominee_email && <Field label={t("Nominee Email")} value={profile.nominee_email} />}
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

function StudentTicketsTab({ token }) {
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
      const selectedId = localStorage.getItem('selectedStudentId') || localStorage.getItem('selected_student_id');
      const reqHeaders = { Authorization: `Bearer ${token}` };
      if (selectedId) {
        reqHeaders['x-student-id'] = selectedId;
      }
      const res = await fetch(`${API}/api/tickets/my-tickets`, {
        headers: reqHeaders
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
  }, [token])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

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
      const selectedId = localStorage.getItem('selectedStudentId') || localStorage.getItem('selected_student_id');
      const reqHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (selectedId) {
        reqHeaders['x-student-id'] = selectedId;
      }
      const res = await fetch(`${API}/api/tickets`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          subject: finalSubject,
          description,
          category,
          priority,
          on_behalf_of: ticketByRequest ? onBehalfOf : null,
          screenshot: screenshot || null,
          student_id: selectedId ? parseInt(selectedId, 10) : undefined
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
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .st-badge-resolved {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
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
                id="screenshot-upload"
                onChange={handleFileChange}
              />
              <label
                htmlFor="screenshot-upload"
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

const PILLARS_DATA = [
  {
    id: 1,
    image: '/agri.png',
    title: 'Agriculture & Nature',
    description: 'Growth begins by connecting with nature.',
  },
  {
    id: 2,
    image: '/phy.png',
    title: 'Physical Fitness & Sports',
    description: 'Strengthen the body to strengthen the mind.',
  },
  {
    id: 3,
    image: '/team.png',
    title: 'Team Building & Leadership',
    description: 'Learn to collaborate, lead and inspire.',
  },
  {
    id: 4,
    image: '/patri.png',
    title: 'Patriotism & Nation Building',
    description: 'Serve society with responsibility and integrity.',
  },
  {
    id: 5,
    image: '/spri.png',
    title: 'Spirituality & Peace',
    description: 'Discover inner peace and lifelong purpose.',
  }
];

const getSquadSplashColor = (squadName) => {
  if (!squadName) return '#E49B36';
  const cleanName = squadName.trim().toLowerCase();
  if (cleanName === 'surya') return '#0C54A4';
  if (cleanName === 'aditya') return '#FCCC04';
  if (cleanName === 'ravi') return '#04A4E4';
  if (cleanName === 'divakar') return '#AC4C84';
  if (cleanName === 'mitra') return '#EC7C1C';
  if (cleanName === 'martand') return '#64A474';
  if (cleanName === 'dinkar') return '#047C44';
  if (cleanName === 'prabhakar') return '#E40C84';
  if (cleanName === 'bhaskar') return '#A45C3C';
  if (cleanName === 'tejonidhi') return '#E41C24';
  return '#E49B36';
};

const VisionMissionTypewriter = ({ onComplete, isSmallScreen }) => {
  const segments = [
    { type: 'label', text: 'OUR VISION', speed: 45 },
    { type: 'en', text: '“Transforming students to empower Bharat and the World”', speed: 20 },
    { type: 'hi', text: 'सशक्त भारत और विश्व के निर्माण के लिए हर युवा का परिवर्तन', speed: 20 },
    { type: 'label', text: 'OUR MISSION', speed: 45 },
    { type: 'en', text: 'Transforming lives by shaping experiences', speed: 20 }
  ];

  const [activeSegment, setActiveSegment] = useState(0);

  useEffect(() => {
    if (activeSegment >= segments.length) {
      onComplete();
      return;
    }
    // Set duration based on number of items (words for Hindi, chars for others)
    const count = segments[activeSegment].type === 'hi' 
      ? segments[activeSegment].text.split(' ').length 
      : segments[activeSegment].text.length;
      
    const duration = count * (segments[activeSegment].type === 'hi' ? 180 : segments[activeSegment].speed) + 600;
    const timer = setTimeout(() => {
      setActiveSegment(prev => prev + 1);
    }, duration);
    return () => clearTimeout(timer);
  }, [activeSegment]);

  const containerVariants = (speed) => ({
    hidden: {},
    visible: {
      transition: {
        staggerChildren: speed / 1000,
      }
    }
  });

  const charVariants = {
    hidden: { opacity: 0, y: 3 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' }
    }
  };

  const wordContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.18, // 180ms per word for smooth Hindi reading
      }
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '22px', padding: '0 10px' }}>
      {segments.map((segment, index) => {
        const isVisible = activeSegment >= index;
        if (!isVisible) return null;

        const isLabel = segment.type === 'label';
        const isHindi = segment.type === 'hi';

        if (isHindi) {
          // Split Hindi text by space-separated words to prevent Unicode dotted circle rendering errors
          const words = segment.text.split(' ');
          return (
            <motion.div
              key={index}
              variants={wordContainerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                lineHeight: '1.4',
                textAlign: 'center',
                fontSize: '18px',
                fontWeight: '600',
                color: 'rgba(255, 255, 255, 0.85)',
                fontStyle: 'italic',
                maxWidth: '580px',
                margin: '0 auto',
                gap: '6px'
              }}
            >
              {words.map((word, wordIdx) => (
                <motion.span
                  key={wordIdx}
                  variants={charVariants}
                  style={{ display: 'inline-block' }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          );
        }

        if (isLabel) {
          return (
            <motion.div
              key={index}
              variants={containerVariants(segment.speed)}
              initial="hidden"
              animate="visible"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                lineHeight: '1.4',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '900',
                color: '#ffd700',
                letterSpacing: '2px',
                marginTop: index === 3 ? '16px' : '0'
              }}
            >
              {segment.text.split('').map((char, charIdx) => (
                <motion.span
                  key={charIdx}
                  variants={charVariants}
                  style={{ display: 'inline-block' }}
                >
                  {char === ' ' ? '\u00A0' : char}
                </motion.span>
              ))}
            </motion.div>
          );
        }

        // English text: split by words, then split words by characters to prevent character-level wrapping
        const words = segment.text.split(' ');
        return (
          <motion.div
            key={index}
            variants={containerVariants(segment.speed)}
            initial="hidden"
            animate="visible"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              lineHeight: '1.4',
              textAlign: 'center',
              fontSize: isSmallScreen ? '20px' : '26px', // Big font on mobile, clean on desktop
              fontWeight: '900',
              color: '#ffffff',
              letterSpacing: '-0.5px',
              maxWidth: isSmallScreen ? '310px' : '100%', // Limit width on mobile to force exactly 2 lines!
              whiteSpace: isSmallScreen ? 'normal' : 'nowrap',
              marginTop: index === 3 ? '16px' : '0'
            }}
          >
            {words.map((word, wordIdx) => (
              <span key={wordIdx} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                {word.split('').map((char, charIdx) => (
                  <motion.span
                    key={charIdx}
                    variants={charVariants}
                    style={{ display: 'inline-block' }}
                  >
                    {char}
                  </motion.span>
                ))}
                {/* Space between words */}
                {wordIdx < words.length - 1 && '\u00A0'}
              </span>
            ))}
          </motion.div>
        );
      })}
    </div>
  );
};

export default function StudentDashboard() {
  const { t, currentLanguage, changeLanguage } = useLanguage()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  })

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const [myData, setMyData] = useState({})
  const [serviceFeedbackSubmitted, setServiceFeedbackSubmitted] = useState(false)
  const hasSubmittedServiceFeedback = !!(myData?.service_feedback_submitted || serviceFeedbackSubmitted)

  const [squadFaculty, setSquadFaculty] = useState([])
  const [squadLeader, setSquadLeader] = useState(null)
  const [selectedLeaderDetails, setSelectedLeaderDetails] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [attendance, setAttendance] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [evalSummaries, setEvalSummaries] = useState([])
  const [customCertificates, setCustomCertificates] = useState([])

  const hasExistingCertificate = (customCertificates && customCertificates.length > 0)

  const canAccessCertificates = hasSubmittedServiceFeedback || hasExistingCertificate
  const isPostFeedbackDay = () => {
    if (!myData || (!myData.batch_start_date && !myData.batch_end_date)) {
      return true;
    }
    const now = new Date();
    let unlockDate = null;

    if (myData.batch_end_date) {
      const endDate = new Date(myData.batch_end_date);
      unlockDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
    } else if (myData.batch_start_date) {
      const startDate = new Date(myData.batch_start_date);
      unlockDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 4, 0, 0, 0, 0);
    }

    if (!unlockDate) return true;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return today >= unlockDate;
  };
  const [expandedPillars, setExpandedPillars] = useState({ agriculture: true, physical: false, leadership: false, patriotism: false, spirituality: false })
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [showReveal, setShowReveal] = useState(false)
  const [revealStep, setRevealStep] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef(null)
  const lastLoadedStudentIdRef = useRef(null)

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  };
  const [undertakingForm, setUndertakingForm] = useState({
    studentName: '',
    studentAge: '',
    studentSchool: '',
    studentClassGrade: '',
    parentName: '',
    parentRelationship: 'Father',
    parentMobile: '',
    parentEmail: '',
    parentAddress: '',
    medAllergies: false,
    medAsthma: false,
    medEpilepsy: false,
    medMedication: false,
    medPhysicalLimitation: false,
    medDietaryRestriction: false,
    medOther: false,
    medDetails: '',
    signedName: '',
    signedDate: new Date().toISOString().split('T')[0],
    consentAgreed: false,
    bloodGroup: '',
    knownAllergies: '',
    medicalConditions: '',
    currentMedication: '',
    dietaryRestrictions: '',
    medicalOther: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactMobile: '',
    emergencyContactAltMobile: '',
    emergencyContactEmail: '',
    consentMedia: true,
    consentData: true,
    consentChecks: true,
    consentMedical: true,
    consentDosDonts: true
  })
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)
  const [tshirtSize, setTshirtSize] = useState('')
  const [jainFood, setJainFood] = useState('No')
  const [mondayFast, setMondayFast] = useState('No')
  const [photoVideoConsent, setPhotoVideoConsent] = useState(false)
  const [tshirtConsent, setTshirtConsent] = useState(false)
  const [dataConsent, setDataConsent] = useState(false)
  const [bagCheckConsent, setBagCheckConsent] = useState(false)
  const [blockedScrollDone, setBlockedScrollDone] = useState(false)
  const [blockedTshirtSize, setBlockedTshirtSize] = useState('')
  const [blockedJainFood, setBlockedJainFood] = useState('No')
  const [blockedMondayFast, setBlockedMondayFast] = useState('No')
  const [submittingUndertaking, setSubmittingUndertaking] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [journeyLoading, setJourneyLoading] = useState(false)
  const [dbNotifications, setDbNotifications] = useState([])
  const [dbUnreadCount, setDbUnreadCount] = useState(0)
  const [carrySubTab, setCarrySubTab] = useState('packing')
  const [showGatePopup, setShowGatePopup] = useState(true)

  // Room Edit State for Overfilled rooms
  const [isEditRoomModalOpen, setIsEditRoomModalOpen] = useState(false)
  const [studentNewRoom, setStudentNewRoom] = useState('')
  const [isSavingRoom, setIsSavingRoom] = useState(false)


  const handleSaveStudentRoom = async (e) => {
    if (e) e.preventDefault()
    if (!studentNewRoom || !studentNewRoom.trim()) {
      alert(t('Please select or enter a valid room number.'))
      return
    }
    const cleanRoom = studentNewRoom.trim()
    if (cleanRoom.toLowerCase().includes('overfilled')) {
      alert(t('Please select a valid room number, not Overfilled.'))
      return
    }
    try {
      setIsSavingRoom(true)
      const res = await fetch(`${API}/api/student/room`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ room: cleanRoom })
      })
      const data = await res.json()
      if (res.ok) {
        alert(t('Room updated successfully!'))
        setIsEditRoomModalOpen(false)
        setStudentNewRoom('')
        if (typeof fetchDashboardData === 'function') fetchDashboardData()
        if (typeof fetchProfile === 'function') fetchProfile()
      } else {
        alert(data.message || t('Failed to update room.'))
      }
    } catch (err) {
      alert(t('Error connecting to server.'))
    } finally {
      setIsSavingRoom(false)
    }
  }

  const [pillarStep, setPillarStep] = useState(1)
  const [isFinalRow, setIsFinalRow] = useState(false)
  const [showFinalMessage, setShowFinalMessage] = useState(false)
  const [showContinueButton, setShowContinueButton] = useState(false)
  const [showVisionMissionNext, setShowVisionMissionNext] = useState(false)

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isSmallScreen = windowWidth < 600

  const handleReplayReveal = () => {
    setPillarStep(1)
    setIsFinalRow(false)
    setShowFinalMessage(false)
    setShowContinueButton(false)
    setShowVisionMissionNext(false)
    setRevealStep(1)
    setShowReveal(true)
  }

  useEffect(() => {
    const passwordChangeDone = REQUIRE_STUDENT_PASSWORD_CHANGE ? (myData.id ? myData.password_changed : true) : true;
    if (showReveal && passwordChangeDone) {
      if (!audioRef.current) {
        audioRef.current = new Audio('/onboarding.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(err => {
        console.log('Autoplay prevented by browser:', err);
      });
    } else {
      stopAudio();
    }
    return () => {
      stopAudio();
    };
  }, [showReveal, myData.id, myData.password_changed, isMuted, stopAudio]);



  useEffect(() => {
    if (isFinalRow && revealStep === 3) {
      const timer = setTimeout(() => {
        setShowContinueButton(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isFinalRow, revealStep])
  
  const filteredSchedules = schedules.filter(s => 
    s.title.toLowerCase().includes(scheduleSearch.toLowerCase()) || 
    s.date.toLowerCase().includes(scheduleSearch.toLowerCase()) ||
    s.time.toLowerCase().includes(scheduleSearch.toLowerCase())
  )

  const [readScheduleIds, setReadScheduleIds] = useState(() => {
    return JSON.parse(localStorage.getItem('readScheduleIds') || '[]')
  })
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true')

  const toggleSidebarCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', String(newState))
  }

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
    if (myData && myData.id) {
      const isNewStudent = lastLoadedStudentIdRef.current !== myData.id;
      if (isNewStudent) {
        lastLoadedStudentIdRef.current = myData.id;
        setUndertakingForm(prev => ({
          ...prev,
          studentName: myData.name || prev.studentName || '',
          studentAge: myData.age || prev.studentAge || '',
          studentSchool: myData.school || prev.studentSchool || '',
          studentClassGrade: myData.class_grade || prev.studentClassGrade || '',
          parentName: myData.parent_name || prev.parentName || '',
          parentRelationship: myData.parent_relationship || prev.parentRelationship || 'Father',
          parentMobile: myData.parent_mobile || prev.parentMobile || '',
          parentEmail: myData.parent_email || prev.parentEmail || '',
          parentAddress: myData.address || prev.parentAddress || '',
          signedName: myData.undertaking_signed_name || myData.parent_name || myData.name || prev.signedName || '',
          signedDate: myData.undertaking_signed_date || prev.signedDate || new Date().toISOString().split('T')[0],
          consentAgreed: Boolean(myData.undertaking_submitted),
          medAllergies: Boolean(myData.med_allergies),
          medAsthma: Boolean(myData.med_asthma),
          medEpilepsy: Boolean(myData.med_epilepsy),
          medMedication: Boolean(myData.med_medication),
          medPhysicalLimitation: Boolean(myData.med_physical_limitation),
          medDietaryRestriction: Boolean(myData.med_dietary_restriction),
          medOther: Boolean(myData.med_other),
          medDetails: myData.med_details || ''
        }));
      }
    }
  }, [myData?.id])

  useEffect(() => {
    if (activeTab === 'undertaking' && !myData.undertaking_submitted) {
      setIsScrolledToBottom(true);
    }
  }, [activeTab, myData.undertaking_submitted]);

  // Undertaking Gate: lock activeTab to 'undertaking' if undertaking is incomplete
  useEffect(() => {
    if (myData?.id && !myData.undertaking_submitted) {
      if (activeTab !== 'undertaking') {
        setActiveTab('undertaking');
      }
    }
  }, [myData?.id, myData?.undertaking_submitted, activeTab]);

  const unreadCount = dbUnreadCount

  const markAsRead = (id) => {
    const updated = [...readScheduleIds, id]
    setReadScheduleIds(updated)
    localStorage.setItem('readScheduleIds', JSON.stringify(updated))
  }

  const markAllAsRead = async () => {

    try {
      await fetch(`${API_BASE_URL}/api/superadmin/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      setDbUnreadCount(0);
      fetchDashboardData();
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  }

  const getCountdown = (dateStr, timeStr) => {
    try {
      const eventDate = new Date(`${dateStr}T${timeStr}`)
      const now = new Date()
      const diff = eventDate - now
      
      if (diff <= 0) return 'Started'
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      if (days > 0) return `${days}d ${hours}h`
      if (hours > 0) return `${hours}h ${minutes}m`
      return `${minutes}m`
    } catch (e) {
      return 'N/A'
    }
  }

  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const isCombined = false
  const isParent = currentUser.role === 'parent'
  const selectedStudent = JSON.parse(localStorage.getItem('selectedStudent') || '{}')
  const parentChildren = (() => {
    try {
      return JSON.parse(localStorage.getItem('parent_children') || '[]');
    } catch (e) {
      return [];
    }
  })();
  const hasMultipleChildren = isParent && Array.isArray(parentChildren) && parentChildren.length > 1;
  const studentDisplayName = (isParent && selectedStudent?.name) ? selectedStudent.name : (myData?.name || currentUser?.name || 'Student');

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config = {}] = args;
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const selectedId = localStorage.getItem('selectedStudentId');
        if (user.role === 'parent' && selectedId) {
          config = { ...config };
          config.headers = {
            ...(config.headers || {}),
            'x-student-id': selectedId
          };
        }
      } catch (e) {
        console.error('Error attaching x-student-id header:', e);
      }
      return originalFetch(resource, config);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const handleLogout = () => {
    lastLoadedStudentIdRef.current = null;
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('selectedStudentId')
    localStorage.removeItem('selectedStudent')
    localStorage.removeItem('parent_children')
    navigate('/')
  }

  const handleDownloadCertificate = async () => {
    if (certLoading) return
    setCertLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/student/certificate-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) {
        alert(data.message || 'Certificate cannot be generated because your batch information is incomplete.')
        return
      }
      await generateCertificate(
        { fullName: data.fullName, ltcId: data.ltcId },
        { startDate: data.startDate, endDate: data.endDate }
      )
      if (typeof window !== 'undefined' && (myData?.id || data?.ltcId)) {
        localStorage.setItem(`cert_downloaded_${myData?.id || data?.ltcId}`, 'true')
      }
    } catch (err) {
      console.error(err)
      alert('Error: ' + err.message)
    } finally {
      setCertLoading(false)
    }
  }

  const handleDownloadJourneySummary = async () => {
    if (journeyLoading) return
    setJourneyLoading(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/student/ltc-summary/${currentUser.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      if (!res.ok) {
        const errData = await res.json()
        alert(errData.message || 'Failed to download LTC Journey Summary Report.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const nameSlug = (studentDisplayName || 'Student').trim().replace(/\s+/g, '_')
      a.download = `LTC_Journey_Summary_${nameSlug}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Error downloading report: ' + err.message)
    } finally {
      setJourneyLoading(false)
    }
  }



  const handleSubmitUndertaking = async (e) => {
    e.preventDefault()
    if (!undertakingForm.signedName || !undertakingForm.signedName.trim()) {
      return alert('Please enter parent/guardian full name as digital signature.')
    }
    if (!undertakingForm.consentAgreed) {
      return alert('Please agree to the Parent/Guardian Consent & Undertaking declaration before submitting.')
    }

    setSubmittingUndertaking(true)
    try {
      const targetStudentId = myData?.id || selectedStudent?.id || localStorage.getItem('selectedStudentId');
      const reqHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
      if (targetStudentId) {
        reqHeaders['x-student-id'] = targetStudentId.toString();
      }
      const res = await fetch(`${API_BASE_URL}/api/student/submit-undertaking`, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ 
          ...undertakingForm, 
          student_id: targetStudentId,
          studentName: undertakingForm.studentName || myData.name,
          studentAge: undertakingForm.studentAge || myData.age,
          studentSchool: undertakingForm.studentSchool || myData.school,
          studentClassGrade: undertakingForm.studentClassGrade || myData.class_grade,
          name: undertakingForm.studentName || myData.name,
          age: undertakingForm.studentAge || myData.age,
          school: undertakingForm.studentSchool || myData.school,
          class_grade: undertakingForm.studentClassGrade || myData.class_grade,
          signedName: undertakingForm.signedName,
          signedDate: undertakingForm.signedDate || new Date().toISOString().split('T')[0],
          parentName: undertakingForm.parentName,
          parentRelationship: undertakingForm.parentRelationship,
          parentMobile: undertakingForm.parentMobile,
          parentEmail: undertakingForm.parentEmail,
          parentAddress: undertakingForm.parentAddress,
          medAllergies: undertakingForm.medAllergies,
          medAsthma: undertakingForm.medAsthma,
          medEpilepsy: undertakingForm.medEpilepsy,
          medMedication: undertakingForm.medMedication,
          medPhysicalLimitation: undertakingForm.medPhysicalLimitation,
          medDietaryRestriction: undertakingForm.medDietaryRestriction,
          medOther: undertakingForm.medOther,
          medDetails: undertakingForm.medDetails,
          consentAgreed: undertakingForm.consentAgreed,
          tshirtSize: tshirtSize || '38 - M',
          jainFood,
          mondayFast,
          consentMedia: true,
          consentData: true,
          consentChecks: true,
          consentMedical: true,
          consentDosDonts: true
        })
      })
      if (res.ok) {
        alert('Parent/Guardian Consent & Undertaking Form submitted successfully!')
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          storedUser.undertaking_submitted = true;
          localStorage.setItem('user', JSON.stringify(storedUser));
        } catch (e) {}
        setMyData(prev => ({ 
          ...prev, 
          name: undertakingForm.studentName || prev.name,
          age: undertakingForm.studentAge || prev.age,
          school: undertakingForm.studentSchool || prev.school,
          class_grade: undertakingForm.studentClassGrade || prev.class_grade,
          undertaking_submitted: true,
          undertaking_signed_name: undertakingForm.signedName,
          undertaking_signed_date: undertakingForm.signedDate,
          parent_name: undertakingForm.parentName,
          parent_relationship: undertakingForm.parentRelationship,
          parent_mobile: undertakingForm.parentMobile,
          parent_email: undertakingForm.parentEmail,
          address: undertakingForm.parentAddress,
          med_allergies: undertakingForm.medAllergies,
          med_asthma: undertakingForm.medAsthma,
          med_epilepsy: undertakingForm.medEpilepsy,
          med_medication: undertakingForm.medMedication,
          med_physical_limitation: undertakingForm.medPhysicalLimitation,
          med_dietary_restriction: undertakingForm.medDietaryRestriction,
          med_other: undertakingForm.medOther,
          med_details: undertakingForm.medDetails
        }));
        fetchDashboardData()
      } else {
        const errData = await res.json();
        alert(errData.message || 'Failed to submit undertaking.')
      }
    } catch (err) {
      alert('Error submitting undertaking.')
    } finally {
      setSubmittingUndertaking(false)
    }
  }

  const handlePrintUndertaking = () => {
    if (myData?.id) {
      const url = `${API_BASE_URL}/api/student/undertaking/pdf/${myData.id}?token=${token}`;
      window.open(url, '_blank');
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
        top: '45px', 
        right: '0', 
        background: 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 0, 0, 0.08)', 
        borderRadius: '16px', 
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)', 
        width: isMobile ? 'min(300px, calc(100vw - 20px))' : '340px', 
        maxWidth: 'calc(100vw - 20px)',
        zIndex: 100, 
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
          {currentUser.red_flag && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(239, 68, 68, 0.08)', position: 'relative' }}>
              <div style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', marginTop: '5px', flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', margin: '0 0 4px 0' }}>Alert</p>
                <p style={{ fontSize: '12px', color: '#7f1d1d', margin: 0 }}>You are red flagged by faculty.</p>
              </div>
            </div>
          )}
          {dbNotifications.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              No notifications.
            </div>
          ) : (
            <>
              {/* Render Database Notifications (Ticket Resolutions & Announcements) */}
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
                            await fetch(`${API_BASE_URL}/api/superadmin/notifications/read`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
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
            </>
          )}
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'student' && currentUser.role !== 'parent')) {
      navigate('/login')
      return
    }
    if (currentUser.role === 'parent' && !localStorage.getItem('selectedStudentId')) {
      navigate('/select-child')
      return
    }
    fetchDashboardData()

    // Real-time synchronization interval (every 5 seconds)
    const interval = setInterval(fetchDashboardData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Close notification / language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-notif-trigger]') || e.target.closest('[data-notif-trigger-mobile]')) {
        return;
      }
      if (isNotifOpen && !e.target.closest('[data-notif-dropdown]') && !e.target.closest('[data-notif-dropdown-mobile]')) {
        setIsNotifOpen(false);
      }
      if (isMobileLangOpen && !e.target.closest('[data-mobile-lang-dropdown]')) {
        setIsMobileLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen, isMobileLangOpen])

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
    if (currentUser && (currentUser.role === 'student' || currentUser.role === 'parent') && activeTab !== 'dashboard') {
      fetchDashboardData()
    }
  }, [activeTab])

  const fetchDashboardData = async () => {
    try {
      const selectedId = localStorage.getItem('selectedStudentId');
      const reqHeaders = { 'Authorization': `Bearer ${token}` };
      if (isParent && selectedId) {
        reqHeaders['x-student-id'] = selectedId;
      }
      const res = await fetch(`${API_BASE_URL}/api/student/dashboard`, { headers: reqHeaders })
      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
        return
      }
      if (res.status === 403) {
        // If parent context is invalid or denied, go back to child selector
        if (isParent) {
          navigate('/select-child', { replace: true })
          return
        }
        setFetchError('Access denied: You are not enrolled in an active cohort.')
        return
      }
      const data = await res.json()
      if (data.has_ltc === false) {
        setFetchError('Access denied: You are not enrolled in an active cohort.')
        return
      }
      if (res.ok) {
        setMyData(data.data || {})
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (storedUser && storedUser.id && data.data) {
            storedUser.undertaking_submitted = Boolean(data.data.undertaking_submitted);
            localStorage.setItem('user', JSON.stringify(storedUser));
          }
        } catch (e) {}
        setSquadFaculty(data.squadFaculty || [])
        setSquadLeader(data.squadLeader || null)
        
        const mySquad = data.data?.squad;
        const studentId = currentUser?.id;
        if (mySquad && mySquad !== 'Not Assigned Yet' && studentId) {
          const key = `ltc_squad_revealed_${studentId}`;
          const alreadyRevealed = localStorage.getItem(key);
          if (alreadyRevealed !== 'true') {
            setShowReveal(true);
          }
        }
      }

      // If undertaking is incomplete, skip calling endpoints requiring completed undertaking
      if (!data.data?.undertaking_submitted) {
        return;
      }

      const schedRes = await fetch(`${API_BASE_URL}/api/student/schedules`, { headers: reqHeaders })
      const schedData = await schedRes.json()
      if (schedRes.ok) setSchedules(schedData.schedules || [])

      const attRes = await fetch(`${API_BASE_URL}/api/student/attendance`, { headers: reqHeaders })
      const attData = await attRes.json()
      if (attRes.ok) setAttendance(attData.attendance || [])

      const evalRes = await fetch(`${API_BASE_URL}/api/student/evaluations`, { headers: reqHeaders })
      const evalData = await evalRes.json()
      if (evalRes.ok) {
        setEvaluations(evalData.evaluations || [])
        setEvalSummaries(evalData.summaries || [])
      }

      const notifRes = await fetch(`${API_BASE_URL}/api/superadmin/notifications/me`, { headers: reqHeaders })
      const notifData = await notifRes.json()
      if (notifRes.ok) {
        setDbNotifications((notifData.notifications || []).slice(0, 6))
        setDbUnreadCount(notifData.unread || 0)
      }

      const certsRes = await fetch(`${API_BASE_URL}/api/certificates/my-certificates`, { headers: reqHeaders })
      const certsData = await certsRes.json()
      if (certsRes.ok) {
        setCustomCertificates(certsData.certificates || [])
      }

      const fbRes = await fetch(`${API_BASE_URL}/api/feedback/my-submissions`, { headers: reqHeaders })
      if (fbRes.ok) {
        const fbData = await fbRes.json()
        if (fbData.submissions && Array.isArray(fbData.submissions)) {
          const hasServiceFb = fbData.submissions.some(s => s.category === 'Service-Trainers')
          setServiceFeedbackSubmitted(hasServiceFb)
        }
        if (typeof fbData.post_service_feedback_locked === 'boolean') {
          setMyData(prev => ({ ...prev, post_service_feedback_locked: fbData.post_service_feedback_locked }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch student data', err)
    }
  }

  const isFirstTimeOnboarding = Boolean(
    myData?.id &&
    !myData.onboarding_completed &&
    !myData.undertaking_submitted &&
    !isParent
  );
  const needsPasswordChange = REQUIRE_STUDENT_PASSWORD_CHANGE && myData.id && !myData.password_changed && !isParent;

  if (needsPasswordChange) {
    return (
      <ResetPasswordGate
        onSuccess={() => {
          setMyData(prev => ({ ...prev, password_changed: true }));
        }}
      />
    );
  }

  if (isFirstTimeOnboarding) {
    return (
      <FirstTimeOnboardingModal
        myData={myData}
        token={token}
        API_BASE_URL={API_BASE_URL}
        isMobile={isMobile}
        onComplete={(updatedData) => {
          setMyData(prev => ({
            ...prev,
            ...updatedData,
            onboarding_completed: true,
            undertaking_submitted: true
          }));
          try {
            const rawUser = localStorage.getItem('user');
            if (rawUser) {
              const u = JSON.parse(rawUser);
              u.onboarding_completed = true;
              u.undertaking_submitted = true;
              localStorage.setItem('user', JSON.stringify(u));
            }
          } catch (_) {}
          fetchDashboardData();
        }}
        onLogout={handleLogout}
      />
    );
  }

  const renderSidebarItem = (tab, iconElement, label, badge, customClick) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={customClick || (() => { setActiveTab(tab); if (isMobile) setIsSidebarOpen(false); })}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: (isCollapsed && !isMobile) ? 'center' : 'space-between',
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
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, marginRight: badge ? '6px' : '0px' }}>
          <div style={{ color: isActive ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {React.cloneElement(iconElement, { size: 16, strokeWidth: isActive ? 2.2 : 2 })}
          </div>
          <span style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '200px',
            marginLeft: (isCollapsed && !isMobile) ? '0px' : '10px',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out, margin 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s'
          }}>
            {label}
          </span>
        </div>
        {badge && (
          <span style={{
            fontSize: '10px',
            fontWeight: '700',
            padding: (isCollapsed && !isMobile) ? '0px' : '2px 6px',
            borderRadius: '4px',
            background: badge.bg || (isActive ? 'rgba(255,255,255,0.2)' : '#f1f5f9'),
            color: badge.color || (isActive ? '#ffffff' : '#0f172a'),
            lineHeight: 1,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            opacity: (isCollapsed && !isMobile) ? 0 : 1,
            maxWidth: (isCollapsed && !isMobile) ? '0px' : '80px',
            overflow: 'hidden',
            visibility: (isCollapsed && !isMobile) ? 'hidden' : 'visible',
            transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in-out, padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s'
          }}>
            {badge.text}
          </span>
        )}
      </button>
    );
  };

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

        {/* Logo / Brand Header — cross-fade between full and icon logos */}
        <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0, transition: 'padding 0.35s cubic-bezier(0.4,0,0.2,1)', padding: isCollapsed ? '0' : '0 24px' }}>
          <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain', position: 'absolute', left: isCollapsed ? '50%' : '24px', transform: isCollapsed ? 'translateX(-50%)' : 'none', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.3s ease, left 0.35s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
          <img src="/lg.png" alt="LTC Logo" style={{ height: '36px', width: '36px', objectFit: 'contain', opacity: isCollapsed ? 1 : 0, transform: isCollapsed ? 'scale(1)' : 'scale(0.7)', transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)', pointerEvents: 'none' }} />
        </div>

        {/* Navigation Area */}
        <div className="flex-1 overflow-y-auto py-4 px-3 no-scrollbar" style={{ display: 'flex', flexDirection: 'column', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {!myData.undertaking_submitted ? (
              <>
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Undertaking")}</span>
                {renderSidebarItem(
                  'undertaking', 
                  <FileText />, 
                  t("Undertaking Form"), 
                  { text: t("Pending"), bg: '#fce8e6', color: '#c5221f' }
                )}
              </>
            ) : (
              <>
                {/* Section: MAIN */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '12px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Main")}</span>
                {renderSidebarItem('dashboard', <Home />, t("Dashboard"))}

                {/* Section: PRE-LTC */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Pre-LTC")}</span>
                
                {renderSidebarItem(
                  'undertaking', 
                  <FileText />, 
                  t("Undertaking Form"), 
                  !myData.undertaking_submitted ? { text: t("Pending"), bg: '#fce8e6', color: '#c5221f' } : null
                )}

                {/* Things to Carry drop-down block */}
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                  {renderSidebarItem('things-to-carry', <Briefcase />, t("Things to carry"), null, () => {
                    setActiveTab('things-to-carry');
                    setCarrySubTab('packing');
                  })}
                  
                  {!isCollapsed && activeTab === 'things-to-carry' && (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '8px' }}>
                      <button
                        onClick={() => setCarrySubTab('packing')}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          paddingLeft: '24px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: carrySubTab === 'packing' ? '600' : '500',
                          color: carrySubTab === 'packing' ? '#ea580c' : '#475569',
                          background: carrySubTab === 'packing' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>— {t("Items to Carry")}</span>
                      </button>
                      <button
                        onClick={() => setCarrySubTab('guidelines')}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          paddingLeft: '24px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: carrySubTab === 'guidelines' ? '600' : '500',
                          color: carrySubTab === 'guidelines' ? '#ea580c' : '#475569',
                          background: carrySubTab === 'guidelines' ? '#fff7ed' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          width: '100%',
                          outline: 'none',
                          marginBottom: '2px',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>— {t("Do's & Don'ts")}</span>
                      </button>
                    </div>
                  )}
                </div>

                {renderSidebarItem('code-of-conduct', <ShieldCheck />, t("Code of Conduct"))}

                {/* Section: LTC PROGRAM */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("LTC Program")}</span>
                {renderSidebarItem('timetable', <Clock />, t("LAP Timetable"))}
                {renderSidebarItem('attendance', <ClipboardList />, t("My Attendance"))}
                {renderSidebarItem('journey', <Compass />, t("LAP Journey"))}
                {renderSidebarItem(
                  'service-feedback',
                  <Sparkles />,
                  t("Service & Trainee Feedback Form"),
                  myData.post_service_feedback_locked ? { text: <Lock size={12} />, bg: '#fef2f2', color: '#dc2626' } : !isPostFeedbackDay() ? { text: <Lock size={12} />, bg: '#f1f5f9', color: '#64748b' } : !hasSubmittedServiceFeedback ? { text: t("Pending"), bg: '#fef3c7', color: '#b45309' } : { text: t("Submitted"), bg: '#dcfce7', color: '#15803d' }
                )}
                {canAccessCertificates && renderSidebarItem('certificates', <Award />, t("My Certificates"))}

                {/* Section: SUPPORT & INFO */}
                <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'block', overflow: 'hidden', maxHeight: isCollapsed ? '0px' : '32px', opacity: isCollapsed ? 0 : 1, padding: isCollapsed ? '0 12px' : '16px 12px 6px 12px', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.35s cubic-bezier(0.4,0,0.2,1)' }}>{t("Support & Info")}</span>
                {renderSidebarItem('emergency-contacts', <Phone />, t("Emergency Contacts"))}
                {renderSidebarItem('tickets', <MessageSquare />, t("Raise Ticket"))}
                {renderSidebarItem('faq', <HelpCircle />, t("FAQs"))}
                {renderSidebarItem('profile', <User />, t("My Profile"))}
              </>
            )}

          </nav>
        </div>

        {/* Bottom Profile Section - unified layout with smooth transitions */}
        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          {/* Instagram Follow Link */}
          <a
            href="https://www.instagram.com/lifetransformationcentre/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '8px',
              padding: isCollapsed ? '8px' : '8px 12px',
              borderRadius: '8px',
              border: '1px solid #fbcfe8',
              background: 'linear-gradient(135deg, #fdf2f8 0%, #fff1f2 100%)',
              color: '#be185d',
              textDecoration: 'none',
              fontSize: '11.5px',
              fontWeight: '750',
              transition: 'all 0.2s ease',
              width: '100%',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#f472b6';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(225, 48, 108, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#fbcfe8';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title={t("Follow for updates on Instagram") || "Follow for updates"}
          >
            <InstagramIcon size={15} color="#e1306c" />
            <span style={{
              maxWidth: isCollapsed ? '0px' : '180px',
              overflow: 'hidden',
              opacity: isCollapsed ? 0 : 1,
              visibility: isCollapsed ? 'hidden' : 'visible',
              whiteSpace: 'nowrap',
              transition: 'max-width 0.3s ease, opacity 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {t("Follow for updates") || "Follow for updates"}
            </span>
          </a>

          {/* Profile row - always mounted, text fades */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0px' : '12px', padding: '4px 8px', overflow: 'hidden', transition: 'gap 0.35s cubic-bezier(0.4,0,0.2,1)', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
            <div 
              className="rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', width: '32px', height: '32px', fontSize: '11px', transition: 'all 0.3s ease' }}
              title={studentDisplayName}
            >
              {studentDisplayName ? studentDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
            </div>
            <div style={{ overflow: 'hidden', maxWidth: isCollapsed ? '0px' : '180px', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s', whiteSpace: 'nowrap' }}>
              <p style={{ fontWeight: '600', fontSize: '12px', color: '#0f172a', lineHeight: '1.2', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{studentDisplayName}</p>
              <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Student")}</p>
            </div>
          </div>
          
          {/* Action Buttons - unified row with smooth transitions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: isCollapsed ? 'center' : 'stretch' }}>
            {myData.undertaking_submitted && (
              <button
                onClick={() => setActiveTab('profile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: isCollapsed ? '0px' : '6px',
                  padding: isCollapsed ? '8px' : '8px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  flex: isCollapsed ? 'none' : 1,
                  width: isCollapsed ? '36px' : 'auto',
                  height: isCollapsed ? '36px' : 'auto',
                  overflow: 'hidden'
                }}
                className="hover:bg-slate-50"
                title={t("My Profile")}
              >
                <User size={13} style={{ flexShrink: 0 }} />
                <span style={{ maxWidth: isCollapsed ? '0px' : '80px', overflow: 'hidden', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>{t("Profile")}</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isCollapsed ? '0px' : '6px',
                padding: isCollapsed ? '8px' : '8px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '11.5px',
                fontWeight: '600',
                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                flex: isCollapsed ? 'none' : 1,
                width: isCollapsed ? '36px' : 'auto',
                height: isCollapsed ? '36px' : 'auto',
                overflow: 'hidden'
              }}
              className="hover:bg-slate-50"
              title={t("Sign Out")}
            >
              <LogOut size={13} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: isCollapsed ? '0px' : '80px', overflow: 'hidden', opacity: isCollapsed ? 0 : 1, visibility: isCollapsed ? 'hidden' : 'visible', whiteSpace: 'nowrap', transition: 'max-width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, visibility 0.35s' }}>{t("Sign Out")}</span>
            </button>
          </div>

          {isParent && hasMultipleChildren && (
            <div style={{ marginTop: '8px' }}>
              <button
                onClick={() => navigate('/select-child')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ea580c',
                  backgroundColor: '#ffffff',
                  color: '#ea580c',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '750',
                  width: '100%',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(234,88,12,0.08)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ea580c'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#ea580c'; }}
                title="Switch Child"
              >
                <Users size={12} />
                {!isCollapsed && <span>Switch Child</span>}
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  };

  const renderDesktopTopbar = () => {
    return (
      <header 
        className="h-12 flex items-center justify-between px-8 sticky top-0 z-10 flex-shrink-0"
        style={{ backgroundColor: '#ea580c', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Breadcrumbs / Page Title */}
        <div 
          className="flex items-center"
          style={{ fontFamily: '"Poppins", sans-serif', fontSize: '18px', fontWeight: 600, lineHeight: 1.2, color: '#ffffff' }}
        >
          <span>{t("Student Portal")}</span>
          <span className="mx-2" style={{ color: 'rgba(216,217,229,0.4)' }}>/</span>
          <span style={{ fontWeight: 400 }}>
            {activeTab === 'dashboard' && t('My Overview')}
            {activeTab === 'schedules' && t('Activity Schedule')}
            {activeTab === 'timetable' && t('LAP Timetable')}
            {activeTab === 'undertaking' && t('Undertaking Form')}
            {activeTab === 'attendance' && t('My Attendance')}
            {activeTab === 'service-feedback' && t('Service & Trainee Feedback Form')}
            {activeTab === 'profile' && t('My Profile')}
            {activeTab === 'faq' && t('Frequently Asked Questions')}
            {activeTab === 'tickets' && t('Raise Support Ticket')}
            {activeTab === 'journey' && t('LAP Journey')}
            {activeTab === 'certificates' && t('My Certificates')}
            {activeTab === 'emergency-contacts' && t('Emergency Contacts')}
          </span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10 mr-1">
            <button 
              onClick={() => changeLanguage('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'en' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              EN
            </button>
            <button 
              onClick={() => changeLanguage('hi')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'hi' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              हिंदी
            </button>
            <button 
              onClick={() => changeLanguage('mr')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${currentLanguage === 'mr' ? 'bg-white text-[#ea580c] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
            >
              मराठी
            </button>
          </div>

          {renderNotifications()}
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors border border-white/10" 
            onClick={fetchDashboardData}
          >
            <RefreshCw size={12} />
            <span>{t("Refresh")}</span>
          </button>
        </div>
      </header>
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
            transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }} 
          onClick={() => setIsSidebarOpen(false)} 
        />

        {/* ── Sidebar ── */}
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
          {/* Logo Header */}
          <div style={{ height: '80px', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <img src="/ltc.png" alt="LTC Logo" style={{ height: '40px', objectFit: 'contain' }} />
            <button 
              className="sidebar-close-btn" 
              onClick={() => setIsSidebarOpen(false)} 
              aria-label="Close Sidebar" 
              style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', padding: 0, boxShadow: 'none' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Nav */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }} className="no-scrollbar">
            <nav style={{ display: 'flex', flexDirection: 'column' }}>
              {!myData.undertaking_submitted ? (
                <>
                  <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '12px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Undertaking")}</span>
                  {renderSidebarItem(
                    'undertaking', 
                    <FileText />, 
                    t("Undertaking Form"), 
                    { text: t("Pending"), bg: '#fce8e6', color: '#c5221f' }
                  )}
                  {renderSidebarItem('logout', <LogOut />, t("Sign Out"), null, handleLogout)}
                </>
              ) : (
                <>
                  {/* MAIN */}
                  <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '12px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Main")}</span>
                  {renderSidebarItem('dashboard', <Home />, t("Dashboard"))}

                  {/* PRE-LTC */}
                  <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Pre-LTC")}</span>
                  {renderSidebarItem(
                    'undertaking', 
                    <FileText />, 
                    t("Undertaking Form"), 
                    !myData.undertaking_submitted ? { text: t("Pending"), bg: '#fce8e6', color: '#c5221f' } : null
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    {renderSidebarItem('things-to-carry', <Briefcase />, t("Things to carry"), null, () => {
                      setActiveTab('things-to-carry');
                      setCarrySubTab('packing');
                      if (isMobile) setIsSidebarOpen(false);
                    })}
                    {activeTab === 'things-to-carry' && (
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '8px' }}>
                        <button onClick={() => { setCarrySubTab('packing'); setIsSidebarOpen(false); }}
                          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', paddingLeft: '24px', borderRadius: '8px', fontSize: '13px', fontWeight: carrySubTab === 'packing' ? '600' : '500', color: carrySubTab === 'packing' ? '#ea580c' : '#475569', background: carrySubTab === 'packing' ? '#fff7ed' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.15s', width: '100%', outline: 'none', marginBottom: '2px', textAlign: 'left' }}>
                          <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>— {t("Items to Carry")}</span>
                        </button>
                        <button onClick={() => { setCarrySubTab('guidelines'); setIsSidebarOpen(false); }}
                          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', paddingLeft: '24px', borderRadius: '8px', fontSize: '13px', fontWeight: carrySubTab === 'guidelines' ? '600' : '500', color: carrySubTab === 'guidelines' ? '#ea580c' : '#475569', background: carrySubTab === 'guidelines' ? '#fff7ed' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.15s', width: '100%', outline: 'none', marginBottom: '2px', textAlign: 'left' }}>
                          <span style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>— {t("Do's & Don'ts")}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {renderSidebarItem('code-of-conduct', <ShieldCheck />, t("Code of Conduct"))}

                  {/* LTC PROGRAM */}
                  <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("LTC Program")}</span>
                  {renderSidebarItem('timetable', <Clock />, t("LAP Timetable"))}
                  {renderSidebarItem('attendance', <ClipboardList />, t("My Attendance"))}
                  {renderSidebarItem('journey', <Compass />, t("LAP Journey"))}
                  {renderSidebarItem(
                    'service-feedback',
                    <Sparkles />,
                    t("Service & Trainee Feedback Form"),
                    myData.post_service_feedback_locked ? { text: <Lock size={12} />, bg: '#fef2f2', color: '#dc2626' } : !isPostFeedbackDay() ? { text: <Lock size={12} />, bg: '#f1f5f9', color: '#64748b' } : !hasSubmittedServiceFeedback ? { text: t("Pending"), bg: '#fef3c7', color: '#b45309' } : { text: t("Submitted"), bg: '#dcfce7', color: '#15803d' }
                  )}
                  {canAccessCertificates && renderSidebarItem('certificates', <Award />, t("My Certificates"))}

                  {/* SUPPORT & INFO */}
                  <span style={{ fontSize: '10px', fontWeight: '750', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 6px 12px', display: 'block', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Support & Info")}</span>
                  {renderSidebarItem('emergency-contacts', <Phone />, t("Emergency Contacts"))}
                  {renderSidebarItem('tickets', <MessageSquare />, t("Raise Ticket"))}
                  {renderSidebarItem('faq', <HelpCircle />, t("FAQs"))}
                  {renderSidebarItem('profile', <User />, t("My Profile"))}
                  {renderSidebarItem('logout', <LogOut />, t("Sign Out"), null, handleLogout)}
                </>
              )}

            </nav>
          </div>

          {/* Bottom Profile Section */}
          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
            {/* Instagram Follow Link */}
            <a
              href="https://www.instagram.com/lifetransformationcentre/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #fbcfe8',
                background: 'linear-gradient(135deg, #fdf2f8 0%, #fff1f2 100%)',
                color: '#be185d',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: '750',
                transition: 'all 0.2s ease',
                width: '100%',
                boxSizing: 'border-box'
              }}
              title="Follow for updates on Instagram"
            >
              <InstagramIcon size={16} color="#e1306c" />
              <span>{t("Follow for updates") || "Follow for updates"}</span>
            </a>

            {isParent && hasMultipleChildren && (
              <button
                onClick={() => { setIsSidebarOpen(false); navigate('/select-child'); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ea580c',
                  backgroundColor: '#ffffff',
                  color: '#ea580c',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '750',
                  width: '100%',
                  marginTop: '8px',
                  boxShadow: '0 1px 2px rgba(234,88,12,0.08)'
                }}
              >
                <Users size={14} />
                <span>Switch Child</span>
              </button>
            )}

            <div className="flex items-center gap-3 px-2 py-1 mb-1">
              <div 
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs"
                style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}
              >
                {studentDisplayName ? studentDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }} className="font-semibold text-xs text-[#0f172a] leading-tight">{studentDisplayName}</p>
                <p style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }} className="text-[10px] text-slate-500">{t("Student")}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', transition: 'all 0.15s', boxShadow: 'none' }}
              className="hover:bg-slate-50"
            >
              <LogOut size={13} />
              <span>{t("Sign Out")}</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  const renderContent = () => (
    <>
        {!myData.undertaking_submitted && (
          <div style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: isMobile ? '6px 12px' : '12px 24px',
            borderRadius: isMobile ? '8px' : '12px',
            fontWeight: '700',
            fontSize: isMobile ? '11px' : '14px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: isMobile ? '12px' : '20px',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isMobile ? 'Undertaking Pending! Please sign immediately.' : 'Action Required: Your official LTC Participant Undertaking is pending! Please sign it immediately.'}
            </span>
            <button 
              onClick={() => setActiveTab('undertaking')} 
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: 'none',
                padding: isMobile ? '4px 10px' : '6px 16px',
                borderRadius: '20px',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: isMobile ? '10px' : '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap'
              }}
            >
              {t("Sign Now")} &rarr;
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-fade-in">
            {/* ── Service & Trainee Feedback Required Action Banner ── */}
            {!myData.post_service_feedback_locked && isPostFeedbackDay() && !hasSubmittedServiceFeedback && (
              <div 
                style={{
                  background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                  borderRadius: isMobile ? '14px' : '18px',
                  padding: isMobile ? '16px 16px' : '20px 24px',
                  color: '#ffffff',
                  boxShadow: '0 8px 20px rgba(234, 88, 12, 0.2)',
                  display: 'flex',
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }} 
                className="animate-fade-in"
              >
                {/* Decorative background glow circle */}
                <div style={{
                  position: 'absolute',
                  right: '-25px',
                  top: '-25px',
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  pointerEvents: 'none'
                }} />

                <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: '14px', zIndex: 1 }}>
                  <div style={{
                    width: isMobile ? '42px' : '48px',
                    height: isMobile ? '42px' : '48px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: '1px solid rgba(255, 255, 255, 0.25)'
                  }}>
                    <Award size={isMobile ? 22 : 26} color="#fcd34d" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: isMobile ? '15px' : '17.5px', fontWeight: '850', margin: '0 0 4px 0', color: '#ffffff', letterSpacing: '-0.3px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Complete Service & Trainee Feedback to Get Your Certificate")}
                    </h3>
                    <p style={{ fontSize: isMobile ? '12.5px' : '13.5px', color: 'rgba(255, 255, 255, 0.92)', margin: 0, lineHeight: 1.45, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("The LTC Program has ended! Please complete your Service & Trainee Feedback questionnaire so your official certificate and completion documents can be issued.")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('service-feedback');
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  style={{
                    background: '#ffffff',
                    color: '#ea580c',
                    border: 'none',
                    padding: isMobile ? '12px 18px' : '11px 22px',
                    borderRadius: '10px',
                    fontWeight: '800',
                    fontSize: isMobile ? '13px' : '14px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    width: isMobile ? '100%' : 'auto',
                    zIndex: 1,
                    transition: 'all 0.2s ease',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  <span>{t("Complete Feedback Now")}</span>
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Overview Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              
              {/* ── Your Profile Card ─────────────────────── */}
              <div 
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                  padding: isMobile ? '14px 16px' : '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  minHeight: isMobile ? 'auto' : '160px',
                  position: 'relative',
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 30px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)'; }}
              >
                {isMobile ? (
                  /* ── Mobile: clean horizontal layout ── */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 2 }}>
                    {/* Avatar circle */}
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #1d4ed8, #60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '800', color: '#ffffff', flexShrink: 0, border: '2px solid rgba(29,78,216,0.15)' }}>
                      {studentDisplayName ? studentDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST'}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px 0', lineHeight: 1.2, fontFamily: 'system-ui,-apple-system,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {studentDisplayName}
                      </h3>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 5px 0', fontFamily: 'system-ui,-apple-system,sans-serif', fontWeight: '500' }}>
                        ID: <span style={{ fontWeight: '750', color: '#154388', fontFamily: 'monospace' }}>{myData.system_student_id || currentUser.system_student_id || currentUser.student_id || myData.student_id || myData.prn || 'N/A'}</span>
                        <span style={{ marginLeft: '6px', color: '#ea580c', fontWeight: '800', fontFamily: 'monospace' }}>· {myData.batch_name || 'LAP-01-1026'}</span>
                      </p>
                    </div>
                    {/* Icon */}
                    <div style={{ width: '32px', height: '32px', background: '#fff7ed', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={16} color="#ea580c" strokeWidth={2.4} />
                    </div>
                  </div>
                ) : (
                  /* ── Desktop: vertical layout ── */
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', zIndex: 2 }}>
                      <span style={{ fontSize:'12.5px', fontWeight:'700', color:'#475569', fontFamily:'system-ui,-apple-system,sans-serif' }}>{t("Your Profile")}</span>
                      <div style={{ width:'34px', height:'34px', background:'#ffffff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.12)', border: '1px solid rgba(234, 88, 12, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GraduationCap size={17} color="#ea580c" strokeWidth={2.4} />
                      </div>
                    </div>
                    <div style={{ zIndex: 2, marginTop: '8px', flex: 1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                      <h3 style={{ fontSize:'15px', fontWeight:'800', color:'#0f172a', margin:'0 0 3px 0', lineHeight:1.2, fontFamily:'system-ui,-apple-system,sans-serif' }}>{studentDisplayName}</h3>
                      <p style={{ fontSize:'11.5px', color:'#475569', margin:0, fontFamily:'system-ui,-apple-system,sans-serif', fontWeight:'500' }}>
                        {t("Student ID:")} <span style={{ fontWeight:'800', color:'#154388', fontFamily: 'monospace' }}>{myData.system_student_id || currentUser.system_student_id || currentUser.student_id || myData.student_id || myData.prn || 'N/A'}</span>
                      </p>
                      <p style={{ fontSize:'11px', color:'#334155', fontWeight:'700', margin:'2px 0 0 0', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                        {t("Batch:")} <span style={{ fontFamily:'monospace', color:'#ea580c', fontWeight:'800' }}>{myData.batch_name || 'LAP-01-1026'}</span>
                      </p>
                    </div>
                    {myData.squad && myData.squad !== 'Not Assigned Yet' && (
                      <div style={{ zIndex:2, marginTop:'6px' }}>
                        <button onClick={handleReplayReveal} title={t("Replay reveal animation")}
                          style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, fontSize:'11px', fontWeight:'700', color:'#ea580c', display:'flex', alignItems:'center', gap:'3px' }}>
                          <RefreshCw size={10} /> {t("Replay")}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Bottom-right dot overlay */}
                <div style={{ position:'absolute', bottom:0, right:0, width:'90px', height:'70px', background:'radial-gradient(circle at bottom right, rgba(37,99,235,0.07), transparent 70%)', pointerEvents:'none', zIndex:1 }}>
                  <div style={{ width:'100%', height:'100%', backgroundImage:'radial-gradient(rgba(37,99,235,0.16) 1.5px, transparent 1.5px)', backgroundSize:'8px 8px', WebkitMaskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                </div>
              </div>

              {/* Squad Faculty Card */}
              <div 
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                  padding: isMobile ? '12px 14px' : '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  minHeight: isMobile ? 'auto' : '160px',
                  position: 'relative',
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 30px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)'; }}
              >
                {/* Header row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:2 }}>
                  <span style={{ fontSize:'12.5px', fontWeight:'700', color:'#475569', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                    {t("Squad Faculty")}
                  </span>
                  <div style={{ width:'34px', height:'34px', background:'#ffffff', borderRadius:'10px', boxShadow:'0 6px 15px -3px rgba(37,99,235,0.18)', border:'1px solid rgba(37,99,235,0.09)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Users size={17} color="#2563eb" strokeWidth={2.4} />
                  </div>
                </div>

                {/* Content - centered vertically */}
                <div style={{ zIndex:2, flex:1, display:'flex', flexDirection: 'column', justifyContent: 'center', marginTop: isMobile ? '6px' : '8px', minWidth: 0 }}>
                  {/* Faculty list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1, maxHeight: '90px', overflowY: 'auto' }}>
                    {squadFaculty.length > 0 ? (
                      squadFaculty.map((f, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedLeaderDetails({
                            type: t(f.role === 'ltc_member' ? 'LTC Member' : 'Squad Faculty'),
                            name: f.name,
                            squad: myData.squad && myData.squad !== 'Not Assigned Yet' ? myData.squad : 'Surya',
                            role: t(f.designation || (f.role === 'ltc_member' ? 'LTC Member' : 'Faculty Advisor')),
                            email: f.email || f.personal_email || 'Not Available',
                            phone: f.phone || 'Not Available',
                            responsibilities: f.role === 'ltc_member'
                              ? t('LTC Member assigned to guide students in self-realization, life transformation modules, and overall squad leadership.')
                              : t('MIT Faculty Advisor assigned to support squad academic alignment, evaluations, tasks, and mentoring.')
                          })}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '6px 10px', 
                            background: 'rgba(37, 99, 235, 0.04)', 
                            borderRadius: '8px', 
                            border: '1px solid rgba(37, 99, 235, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            zIndex: 2
                          }}
                          className="hover:bg-blue-50"
                        >
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#2563eb', color: '#ffffff', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {f.name ? f.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'FC'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '11px', fontWeight: '750', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{f.name}</span>
                            <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '600', marginTop: '1px' }}>{f.role === 'ltc_member' ? t('LTC Coordinator') : t('Faculty Advisor')}</span>
                          </div>
                          <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: '800', opacity: 0.8 }} className="group-hover:opacity-100">{t("View")} &rarr;</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '6px' }}>
                        {t("No Faculty assigned")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom-right dot overlay */}
                <div style={{ position:'absolute', bottom:0, right:0, width:'90px', height:'70px', background:'radial-gradient(circle at bottom right, rgba(37,99,235,0.07), transparent 70%)', pointerEvents:'none', zIndex:1 }}>
                  <div style={{ width:'100%', height:'100%', backgroundImage:'radial-gradient(rgba(37,99,235,0.16) 1.5px, transparent 1.5px)', backgroundSize:'8px 8px', WebkitMaskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                </div>
              </div>

              {/* ── Room Assigned Card ──────────────────────── */}
              <div 
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  minHeight: '160px',
                  position: 'relative',
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 30px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)'; }}
              >
                {/* Header row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:2 }}>
                  <span style={{ fontSize:'12.5px', fontWeight:'700', color:'#475569', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                    {t("Room Assigned")}
                  </span>
                  <div style={{ width:'34px', height:'34px', background:'#ffffff', borderRadius:'10px', boxShadow:'0 6px 15px -3px rgba(244,63,94,0.18)', border:'1px solid rgba(244,63,94,0.09)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Home size={17} color="#e11d48" strokeWidth={2.4} />
                  </div>
                </div>

                {/* Value — centered vertically */}
                  <div style={{ zIndex:2, flex:1, display:'flex', alignItems:'center', marginTop: isMobile ? '4px' : '6px' }}>
                    {(() => {
                      const isOverfilled = myData.room && String(myData.room).toLowerCase().includes('overfilled')
                      if (isOverfilled) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                              {t("Room Overfilled")}
                            </div>
                            <div>
                              <button
                                onClick={() => { setStudentNewRoom(''); setIsEditRoomModalOpen(true); }}
                                style={{
                                  background: '#ea580c',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  boxShadow: '0 1px 3px rgba(234,88,12,0.2)'
                                }}
                              >
                                <Edit2 size={12} /> {t("Edit Room")}
                              </button>
                            </div>
                          </div>
                        )
                      }
                      return myData.room ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <h3 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight:'900', color:'#0f172a', margin:0, letterSpacing:'-0.6px', fontFamily:'system-ui,-apple-system,sans-serif', lineHeight:1.1 }}>
                            {myData.room}
                          </h3>
                          <span style={{ fontSize:'9.5px', fontWeight:'800', color:'#ea580c', background:'#fff7ed', border:'1px solid #fed7aa', padding:'2px 8px', borderRadius:'4px', width:'fit-content', whiteSpace:'nowrap', textTransform:'uppercase', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                            {t(myData.room_designation || 'Member')}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: isMobile ? '11px' : '13px', color:'#94a3b8', fontStyle:'italic', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                          {t("Not Allocated")}
                        </span>
                      )
                    })()}
                  </div>

                  {/* Bottom-right dot overlay */}
                  <div style={{ position:'absolute', bottom:0, right:0, width:'90px', height:'70px', background:'radial-gradient(circle at bottom right, rgba(244,63,94,0.07), transparent 70%)', pointerEvents:'none', zIndex:1 }}>
                    <div style={{ width:'100%', height:'100%', backgroundImage:'radial-gradient(rgba(225,29,72,0.16) 1.5px, transparent 1.5px)', backgroundSize:'8px 8px', WebkitMaskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                  </div>
                </div>

                {/* Your Squad Card */}
                <div 
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                    padding: isMobile ? '12px 14px' : '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                    minHeight: isMobile ? '110px' : '160px',
                    position: 'relative',
                    cursor: 'default'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 30px rgba(0,0,0,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)'; }}
                >
                  {/* Header row */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:2 }}>
                    <span style={{ fontSize: isMobile ? '11.5px' : '12.5px', fontWeight:'700', color:'#475569', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                      {t("Your Squad")}
                    </span>
                    <div style={{ width: isMobile ? '28px' : '34px', height: isMobile ? '28px' : '34px', background:'#ffffff', borderRadius: isMobile ? '8px' : '10px', boxShadow:'0 6px 15px -3px rgba(234,179,8,0.2)', border:'1px solid rgba(234,179,8,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Flag size={isMobile ? 14 : 17} color="#ca8a04" strokeWidth={2.4} />
                    </div>
                  </div>

                  {/* Squad name + badge */}
                  <div style={{ zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', marginTop: isMobile ? '4px' : '6px' }}>
                    {myData.squad ? (
                      <div style={{ display:'flex', flexDirection:'column', gap: isMobile ? '2px' : '5px' }}>
                        <h3 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight:'900', color: SQUAD_COLORS[myData.squad] || '#0f172a', margin:0, letterSpacing:'-0.4px', fontFamily:'system-ui,-apple-system,sans-serif', lineHeight:1.1 }}>
                          {t(myData.squad)}
                        </h3>
                        {(myData.squad_designation || myData.is_squad_leader) && (
                          <div style={{ marginTop: '4px' }}>
                            {renderRoleBadge(myData.squad_designation, myData.is_squad_leader, { fontSize: isMobile ? '8.5px' : '10px', padding: '2px 8px' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: isMobile ? '11px' : '13px', color:'#94a3b8', fontStyle:'italic', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                        {t("Not Allocated")}
                      </span>
                    )}
                  </div>

                  {/* Leader footer */}
                  {myData.squad && squadLeader && !isMobile && (
                    <div style={{ zIndex:2, borderTop:'1px solid #f1f5f9', paddingTop:'6px', display:'flex', alignItems:'center', gap:'4px', marginTop:'6px' }}>
                      <span style={{ fontSize:'10px', color:'#64748b', fontWeight:'600', fontFamily:'system-ui,-apple-system,sans-serif' }}>{t("Leader:")}</span>
                      <span style={{ fontSize:'11px', fontWeight:'750', color:'#334155', fontFamily:'system-ui,-apple-system,sans-serif' }}>{squadLeader.name}</span>
                    </div>
                  )}
                  {/* Bottom-right dot overlay */}
                  <div style={{ position:'absolute', bottom:0, right:0, width:'90px', height:'70px', background:'radial-gradient(circle at bottom right, rgba(234,179,8,0.07), transparent 70%)', pointerEvents:'none', zIndex:1 }}>
                    <div style={{ width:'100%', height:'100%', backgroundImage:'radial-gradient(rgba(202,138,4,0.16) 1.5px, transparent 1.5px)', backgroundSize:'8px 8px', WebkitMaskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                  </div>
                </div>

              {/* ── Attendance Card ──────────────────────────── */}
              <div 
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.015)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  minHeight: '160px',
                  position: 'relative',
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 16px 30px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.015)'; }}
              >
                {/* Header row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:2 }}>
                  <span style={{ fontSize:'12.5px', fontWeight:'700', color:'#475569', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                    {t("Attendance")}
                  </span>
                  <div style={{ width:'34px', height:'34px', background:'#ffffff', borderRadius:'10px', boxShadow:'0 6px 15px -3px rgba(16,185,129,0.18)', border:'1px solid rgba(16,185,129,0.09)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <ClipboardList size={17} color="#059669" strokeWidth={2.4} />
                  </div>
                </div>

                {/* Attendance value */}
                <div style={{ zIndex:2, flex:1, display:'flex', flexDirection:'column', justifyContent:'center', marginTop:'6px' }}>
                  {schedules.length > 0 && evaluations.length >= schedules.length ? (
                    (() => {
                      let totalPercent = 0;
                      schedules.forEach(s => {
                        const ev = evaluations.find(e => e.schedule_id === s.id);
                        if (ev) {
                          if (ev.marking_scheme === 'fully_done') totalPercent += 100;
                          else if (ev.marking_scheme === 'partially_done') totalPercent += 66;
                          else if (ev.marking_scheme === 'not_done') totalPercent += 33;
                          else if (ev.marks != null) totalPercent += ev.marks;
                        }
                      });
                      const rate = Math.round(totalPercent / schedules.length);
                      return (
                        <div>
                          <h3 style={{ fontSize:'26px', fontWeight:'900', color:'#10b981', margin:'0 0 2px 0', fontFamily:'system-ui,-apple-system,sans-serif', lineHeight:1.1 }}>{rate}%</h3>
                          <span style={{ fontSize:'10.5px', color:'#64748b', fontWeight:'600', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                            {t("All")} {schedules.length} {t("activities completed")}
                          </span>
                        </div>
                      );
                    })()
                  ) : schedules.length > 0 ? (
                    (() => {
                      const formattedEndDate = (() => {
                        if (!myData.batch_end_date) return 'end of batch';
                        try { return new Date(myData.batch_end_date).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' }); }
                        catch { return myData.batch_end_date; }
                      })();
                      return (
                        <p style={{ fontSize:'12px', color:'#475569', fontWeight:'600', margin:0, lineHeight:1.4, fontFamily:'system-ui,-apple-system,sans-serif' }}>
                          {t("Attendance will show after {{endDate}} of the batch").replace("{{endDate}}", formattedEndDate)}
                        </p>
                      );
                    })()
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                      <Calendar size={16} style={{ color:'#94a3b8' }} />
                      <span style={{ fontSize:'11px', color:'#64748b', fontWeight:'700', textAlign:'center', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                        {t("Commencing")} {myData.batch_start_date ? new Date(myData.batch_start_date).toLocaleDateString('en-US', { day:'numeric', month:'short' }) : t('soon')}
                      </span>
                    </div>
                  )}
                </div>

                {/* View link */}
                <div style={{ zIndex:2, borderTop:'1px solid #f1f5f9', paddingTop:'6px', marginTop:'6px' }}>
                  <button onClick={() => setActiveTab('attendance')}
                    style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, fontSize:'11.5px', fontWeight:'800', color:'#2563eb', display:'flex', alignItems:'center', gap:'2px', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                    <span>{t("View Records")} &rarr;</span>
                  </button>
                </div>

                {/* Bottom-right dot overlay */}
                <div style={{ position:'absolute', bottom:0, right:0, width:'90px', height:'70px', background:'radial-gradient(circle at bottom right, rgba(16,185,129,0.07), transparent 70%)', pointerEvents:'none', zIndex:1 }}>
                  <div style={{ width:'100%', height:'100%', backgroundImage:'radial-gradient(rgba(5,150,105,0.16) 1.5px, transparent 1.5px)', backgroundSize:'8px 8px', WebkitMaskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)', maskImage:'radial-gradient(circle at bottom right, black 20%, transparent 80%)' }} />
                </div>
              </div>
            </div>

            {/* Download Certificate Card */}
            {canAccessCertificates && (
              <div 
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  width: '100%'
                }}
              >
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(217,119,6,0.15)'
                  }}>
                    <Award size={18} strokeWidth={2.2} />
                  </div>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.2px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Certificate of Participation")}</span>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '750', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Download Your Certificate")}</span>
                      <span style={{ fontSize: '13px', color: '#64748b', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Get your official Life Awakening Program Certificate of Participation.")}</span>
                    </div>
                    <button
                      id="download-certificate-btn"
                      onClick={handleDownloadCertificate}
                      disabled={certLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: certLoading ? '#f1f5f9' : '#ea580c',
                        color: certLoading ? '#94a3b8' : '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '13px',
                        cursor: certLoading ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: certLoading ? 'none' : '0 2px 8px rgba(234,88,12,0.15)'
                      }}
                      onMouseOver={(e) => { 
                        if (!certLoading) {
                          e.currentTarget.style.background = '#c2410c';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(234,88,12,0.25)';
                        } 
                      }}
                      onMouseOut={(e) => { 
                        if (!certLoading) {
                          e.currentTarget.style.background = '#ea580c';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(234,88,12,0.15)';
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
              </div>
            )}

            {/* Custom Certificates Section */}
            {(canAccessCertificates || (customCertificates && customCertificates.length > 0)) && customCertificates && customCertificates.length > 0 && (
              <div className="glass-card hover:shadow-md transition-shadow" style={{ gridColumn: isMobile ? '1' : '1 / -1', marginTop: '16px' }}>
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
                          const finalToken = token || localStorage.getItem('token') || '';
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
            
            <TimetablePanel compact={true} onViewDetail={() => setActiveTab('timetable')} />

          </div>
      )}

        {activeTab === 'undertaking' && (
          <div style={{ 
            maxWidth: '860px', 
            margin: '0 auto 40px auto', 
            background: '#ffffff', 
            borderRadius: isMobile ? '12px' : '16px', 
            boxShadow: 'none', 
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Form Header */}
            <div style={{ 
              padding: isMobile ? '20px 16px' : '28px 36px', 
              borderBottom: '1px solid #e2e8f0', 
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <h2 style={{ 
                fontSize: isMobile ? '18px' : '22px', 
                fontWeight: '800', 
                color: '#0f172a', 
                margin: '2px 0 0 0', 
                letterSpacing: '-0.02em',
                lineHeight: '1.25'
              }}>
                Life Awakening Program - School Education
              </h2>
              <p style={{ 
                fontSize: '13px', 
                color: '#64748b', 
                margin: 0, 
                fontWeight: '600' 
              }}>
                Parent / Guardian Consent &amp; Undertaking Form
              </p>
            </div>

            {/* Form Content */}
            <div 
              id="undertaking-form-scrollable"
              style={{ 
                padding: isMobile ? '20px 16px' : '32px 36px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '28px' 
              }}
            >
              {myData.undertaking_submitted ? (
                /* ==============================================================
                   SUBMITTED STATE / RECEIPT VIEW
                   ============================================================== */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Verified Banner (Clean, Flat, Non-Glassmorphic, No One-Sided Border) */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: isMobile ? '12px' : '16px', 
                    padding: isMobile ? '16px' : '18px 22px', 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '12px',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                    width: '100%'
                  }}>
                    <div style={{ 
                      width: isMobile ? '38px' : '42px', 
                      height: isMobile ? '38px' : '42px', 
                      borderRadius: '50%', 
                      background: '#047857', 
                      color: '#ffffff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)',
                      marginTop: '2px'
                    }}>
                      <Check size={isMobile ? 18 : 20} strokeWidth={2.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <h3 style={{ fontSize: isMobile ? '15.5px' : '17px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                          Consent &amp; Undertaking Form Verified
                        </h3>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          padding: '2px 8px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Check size={11} strokeWidth={3} /> Submitted
                        </span>
                      </div>
                      <p style={{ fontSize: isMobile ? '12.5px' : '13.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        The parent/guardian consent and medical undertaking for <strong>{myData.name}</strong> is recorded on file for the Life Awakening Program.
                      </p>
                    </div>
                  </div>

                  {/* Submission Summary Card */}
                  <div style={{ 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    background: '#ffffff'
                  }}>
                    <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                        Official Submission Record
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                        Date: {myData.undertaking_signed_date || 'Recorded'}
                      </span>
                    </div>

                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Student Details */}
                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          1. Student Information
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                          <div><span style={{ color: '#64748b' }}>Student Name:</span> <strong style={{ color: '#0f172a' }}>{myData.name || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Age:</span> <strong style={{ color: '#0f172a' }}>{myData.age || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>School:</span> <strong style={{ color: '#0f172a' }}>{myData.school || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Class / Grade:</span> <strong style={{ color: '#0f172a' }}>{myData.class_grade || '—'}</strong></div>
                        </div>
                      </div>

                      {/* Parent / Guardian Details */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          2. Parent / Guardian Details
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                          <div><span style={{ color: '#64748b' }}>Parent/Guardian Name:</span> <strong style={{ color: '#0f172a' }}>{myData.parent_name || myData.emergency_contact_name || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Relationship:</span> <strong style={{ color: '#0f172a' }}>{myData.parent_relationship || myData.emergency_contact_relation || 'Parent/Guardian'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Mobile Number:</span> <strong style={{ color: '#0f172a' }}>{myData.parent_mobile || myData.emergency_contact_mobile || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Email Address:</span> <strong style={{ color: '#0f172a' }}>{myData.parent_email || myData.emergency_contact_email || '—'}</strong></div>
                          <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                            <span style={{ color: '#64748b' }}>Residential Address:</span> <strong style={{ color: '#0f172a' }}>{myData.address || '—'}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Medical Information */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          3. Medical Information
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          {[
                            { label: 'Allergies', val: myData.med_allergies },
                            { label: 'Asthma / Respiratory', val: myData.med_asthma },
                            { label: 'Epilepsy / Seizure', val: myData.med_epilepsy },
                            { label: 'Medication Requirement', val: myData.med_medication },
                            { label: 'Physical Limitation', val: myData.med_physical_limitation },
                            { label: 'Dietary Restriction', val: myData.med_dietary_restriction },
                            { label: 'Other Medical Condition', val: myData.med_other }
                          ].map((item, idx) => (
                            <span 
                              key={idx} 
                              style={{ 
                                padding: '4px 10px', 
                                borderRadius: '16px', 
                                fontSize: '11.5px', 
                                fontWeight: '700',
                                backgroundColor: item.val ? '#fee2e2' : '#f1f5f9',
                                color: item.val ? '#b91c1c' : '#475569',
                                border: item.val ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {item.val ? '⚠️' : '✓'} {item.label}: {item.val ? 'Yes' : 'No'}
                            </span>
                          ))}
                        </div>
                        {myData.med_details && (
                          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                            <span style={{ fontWeight: '700', color: '#475569' }}>Medical Details: </span>
                            <span style={{ color: '#0f172a' }}>{myData.med_details}</span>
                          </div>
                        )}
                      </div>

                      {/* Declaration & Signature */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '800', color: '#ea580c', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          4. Declaration &amp; Digital Signature
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px', fontSize: '13px' }}>
                          <div>
                            <span style={{ color: '#64748b' }}>Parent / Guardian Signature:</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '800', color: '#0f172a', fontFamily: 'serif', fontStyle: 'italic' }}>
                              {myData.undertaking_signed_name || myData.parent_name || myData.name}
                            </p>
                          </div>
                          <div>
                            <span style={{ color: '#64748b' }}>Date of Submission:</span>
                            <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                              {myData.undertaking_signed_date || 'Recorded'}
                            </p>
                          </div>
                        </div>
                        <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                          ✓ Confirmed: All 9 Program &amp; Safety Clauses, Medical Disclosure, and Liability Waiver accepted.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button 
                      onClick={handlePrintUndertaking} 
                      className="btn" 
                      style={{ 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '11px 22px', 
                        fontWeight: '700', 
                        fontSize: '13.5px',
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                      }}
                    >
                      <Printer size={15} />
                      Download Official Undertaking PDF
                    </button>
                  </div>
                </div>
              ) : (
                /* ==============================================================
                   EDITABLE UNDERTAKING FORM (undertaking.docx.pdf)
                   ============================================================== */
                <form onSubmit={handleSubmitUndertaking} style={{ display: 'flex', flexDirection: 'column', gap: '28px', margin: 0 }}>
                  
                  {/* Section 1: Student Information */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        1
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Student Information
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '20px' 
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Student Full Name *
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Student Full Name"
                            required
                            value={undertakingForm.studentName !== undefined ? undertakingForm.studentName : (myData.name || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, studentName: val }));
                            }}
                            style={{ margin: 0, color: '#0f172a', fontWeight: '600' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Age
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Student Age (e.g. 14)"
                            value={undertakingForm.studentAge !== undefined ? undertakingForm.studentAge : (myData.age || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, studentAge: val }));
                            }}
                            style={{ margin: 0, color: '#0f172a', fontWeight: '600' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            School
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="School Name"
                            value={undertakingForm.studentSchool !== undefined ? undertakingForm.studentSchool : (myData.school || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, studentSchool: val }));
                            }}
                            style={{ margin: 0, color: '#0f172a', fontWeight: '600' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Class / Grade
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Class / Grade (e.g. 9th Grade)"
                            value={undertakingForm.studentClassGrade !== undefined ? undertakingForm.studentClassGrade : (myData.class_grade || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, studentClassGrade: val }));
                            }}
                            style={{ margin: 0, color: '#0f172a', fontWeight: '600' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Parent / Guardian Information */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        2
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Parent / Guardian Information
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '20px' 
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Parent / Guardian Name *
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Full Name of Parent / Guardian"
                            required
                            value={undertakingForm.parentName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, parentName: val }));
                            }}
                            style={{ margin: 0 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Relationship to Student *
                          </label>
                          <select
                            className="input-field"
                            required
                            value={undertakingForm.parentRelationship}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, parentRelationship: val }));
                            }}
                            style={{ margin: 0, cursor: 'pointer' }}
                          >
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Legal Guardian">Legal Guardian</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Mobile Number *
                          </label>
                          <input
                            type="tel"
                            className="input-field"
                            placeholder="10-digit Mobile Number"
                            required
                            value={undertakingForm.parentMobile}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setUndertakingForm(prev => ({ ...prev, parentMobile: val }));
                            }}
                            style={{ margin: 0 }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Email Address *
                          </label>
                          <input
                            type="email"
                            className="input-field"
                            placeholder="parent@example.com"
                            required
                            value={undertakingForm.parentEmail}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, parentEmail: val }));
                            }}
                            style={{ margin: 0 }}
                          />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Residential Address *
                          </label>
                          <textarea
                            className="input-field"
                            placeholder="Full Residential Address with City and PIN Code"
                            required
                            rows={2}
                            value={undertakingForm.parentAddress}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, parentAddress: val }));
                            }}
                            style={{ margin: 0, resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Medical Information */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        3
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Medical Information
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                        Please specify if the student has any of the following conditions (check all that apply):
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '10px' }}>
                        {[
                          { key: 'medAllergies', label: 'Allergies (Food, Medication, Insect bites, etc.)' },
                          { key: 'medAsthma', label: 'Asthma or Respiratory Issues' },
                          { key: 'medEpilepsy', label: 'Epilepsy or Seizure Disorder' },
                          { key: 'medMedication', label: 'Ongoing Medication Requirement' },
                          { key: 'medPhysicalLimitation', label: 'Physical Limitation / Recent Injury' },
                          { key: 'medDietaryRestriction', label: 'Dietary Restriction / Special Diet' },
                          { key: 'medOther', label: 'Other Medical Condition' }
                        ].map(item => (
                          <label 
                            key={item.key}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '10px 14px', 
                              borderRadius: '8px',
                              background: undertakingForm[item.key] ? '#fff7ed' : '#f8fafc',
                              border: undertakingForm[item.key] ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              fontWeight: undertakingForm[item.key] ? '700' : '500',
                              color: undertakingForm[item.key] ? '#9a3412' : '#334155',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={Boolean(undertakingForm[item.key])}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setUndertakingForm(prev => ({ ...prev, [item.key]: checked }));
                              }}
                              style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Please provide specific details if any checked above (or write &apos;None&apos;):
                        </label>
                        <textarea
                          className="input-field"
                          placeholder="Provide dosage, triggers, special instructions, or medical emergency details..."
                          rows={2}
                          value={undertakingForm.medDetails || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setUndertakingForm(prev => ({ ...prev, medDetails: val }));
                          }}
                          style={{ margin: 0, resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Parent / Guardian Consent (9 Clauses) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        4
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Parent / Guardian Consent Clauses
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '22px'
                    }}>
                      <ol style={{ 
                        margin: 0, 
                        paddingLeft: '20px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '10px', 
                        fontSize: '13px', 
                        color: '#334155', 
                        lineHeight: '1.6' 
                      }}>
                        <li><strong>Voluntary Participation:</strong> I give consent for my child to participate in the Life Awakening Program (School Education) including travel, outdoor, sports, agricultural/nature-based, and experiential learning activities.</li>
                        <li><strong>Rules &amp; Discipline:</strong> I understand that my child is expected to abide by all program rules, discipline, schedules, and safety instructions given by organizers and school coordinators.</li>
                        <li><strong>Medical Disclosure:</strong> I have truthfully disclosed all known medical conditions, allergies, and special requirements of my child above.</li>
                        <li><strong>Emergency Medical Care:</strong> In the event of a medical emergency or illness, I authorize program organizers/instructors to administer first aid and, if necessary, arrange professional medical treatment or hospitalization at my expense.</li>
                        <li><strong>Supervised Activity:</strong> I acknowledge that organizers will take all reasonable precautions for child safety and provide responsible adult supervision throughout the program.</li>
                        <li><strong>Digital Detox &amp; Personal Items:</strong> I understand that the program may operate in a device-free / digital-detox environment to encourage active learning and peer engagement.</li>
                        <li><strong>Photography &amp; Media:</strong> I consent to official photographs and video recordings of my child being taken during the program for educational documentation, school reports, and official program archival.</li>
                        <li><strong>Travel &amp; Logistics:</strong> I give permission for my child to travel via official organized transportation between school/pickup points and program venues.</li>
                        <li><strong>Respect &amp; Conduct:</strong> I understand that participants are expected to demonstrate mutual respect, courtesy, and good sportsmanship with peers, instructors, and local community members.</li>
                      </ol>
                    </div>
                  </div>

                  {/* Section 5: Liability Waiver Clause */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        5
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Liability Waiver &amp; Release
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#fff7ed', 
                      border: '1.5px solid #fed7aa', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '20px',
                      fontSize: '13px',
                      color: '#7c2d12',
                      lineHeight: '1.65'
                    }}>
                      <p style={{ margin: 0 }}>
                        I hereby confirm that I have read, understood, and agreed to all the above clauses. I release and hold harmless the Life Awakening Program, its trustees, instructors, organizers, and affiliated partners from any claim, liability, or loss arising from unforeseen accidents, natural events, or actions contrary to program instructions, provided standard care and supervision were exercised.
                      </p>
                    </div>
                  </div>

                  {/* Section 6: Digital Signature & Final Declaration */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '6px', 
                        background: '#ea580c', 
                        color: '#ffffff', 
                        fontSize: '11px', 
                        fontWeight: '700' 
                      }}>
                        6
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                        Declaration &amp; Digital Signature
                      </h3>
                    </div>

                    <div style={{ 
                      background: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '10px', 
                      padding: isMobile ? '16px' : '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Parent / Guardian Signature (Type Full Name) *
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Type parent/guardian full name..."
                            required
                            value={undertakingForm.signedName || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, signedName: val }));
                            }}
                            style={{ margin: 0, fontWeight: '700' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Date of Signature *
                          </label>
                          <input
                            type="date"
                            className="input-field"
                            required
                            value={undertakingForm.signedDate || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setUndertakingForm(prev => ({ ...prev, signedDate: val }));
                            }}
                            style={{ margin: 0 }}
                          />
                        </div>
                      </div>

                      <div style={{ 
                        background: undertakingForm.consentAgreed ? '#ecfdf5' : '#f8fafc', 
                        border: undertakingForm.consentAgreed ? '1.5px solid #10b981' : '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        padding: '12px 14px',
                        transition: 'all 0.15s ease'
                      }}>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: '#334155', fontWeight: '600', lineHeight: '1.5' }}>
                          <input 
                            type="checkbox" 
                            required 
                            checked={Boolean(undertakingForm.consentAgreed)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUndertakingForm(prev => ({ ...prev, consentAgreed: checked }));
                            }}
                            style={{ marginTop: '3px', accentColor: '#ea580c', width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }} 
                          />
                          <span>I, as the parent / legal guardian of the student, declare that all the information provided above is true and complete, and I hereby provide my full consent and undertaking for my child&apos;s participation in the Life Awakening Program. *</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Submit Action */}
                  <div style={{ paddingTop: '8px' }}>
                    <button 
                      type="submit" 
                      className="btn" 
                      disabled={submittingUndertaking || !undertakingForm.consentAgreed || !undertakingForm.signedName.trim()}
                      style={{ 
                        background: (submittingUndertaking || !undertakingForm.consentAgreed || !undertakingForm.signedName.trim()) ? '#cbd5e1' : '#ea580c', 
                        color: '#ffffff', 
                        padding: '14px 36px', 
                        fontSize: '14px', 
                        fontWeight: '700', 
                        borderRadius: '8px', 
                        alignSelf: isMobile ? 'stretch' : 'flex-start', 
                        width: isMobile ? '100%' : 'auto',
                        border: 'none', 
                        cursor: (submittingUndertaking || !undertakingForm.consentAgreed || !undertakingForm.signedName.trim()) ? 'not-allowed' : 'pointer',
                        boxShadow: (submittingUndertaking || !undertakingForm.consentAgreed || !undertakingForm.signedName.trim()) ? 'none' : '0 2px 10px rgba(234,88,12,0.3)',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {submittingUndertaking ? 'Submitting Undertaking...' : 'Sign & Submit Undertaking Form'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTab === 'things-to-carry' && (
          <div 
            style={{ 
              width: '100%', 
              maxWidth: '1000px', 
              margin: '0 auto', 
              padding: isMobile ? '8px 0' : '16px 0' 
            }} 
            className="animate-fade-in"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '8px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Items to Carry & Guidelines")}
                </h2>
                <p style={{ color: '#64748b', fontSize: '13.5px', margin: '3px 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.4 }}>
                  {t("Official checklist of items to carry, season-wise weather gear, and school student residential guidelines.")}
                </p>
              </div>

              {/* Download Brochure Button */}
              <a
                href="/awakening-brouchre.pdf"
                download="awakening-brouchre.pdf"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ea580c',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '13px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#c2410c'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ea580c'; }}
                title="Download Awakening Brochure PDF"
              >
                <Download size={15} strokeWidth={2.4} />
                <span>{t("Download Brochure")}</span>
              </a>
            </div>

            {/* Subtab navigation toggle */}
            <div style={{ 
              display: 'inline-flex', 
              background: '#f1f5f9', 
              padding: '4px', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0', 
              margin: isMobile ? '16px 0 16px 0' : '20px 0 16px 0', 
              gap: '4px',
              width: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box'
            }}>
              <button
                onClick={() => setCarrySubTab('packing')}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: isMobile ? '8px 12px' : '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: carrySubTab === 'packing' ? '#ffffff' : 'transparent',
                  color: carrySubTab === 'packing' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: carrySubTab === 'packing' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                {t("Items to Carry")}
              </button>
              <button
                onClick={() => setCarrySubTab('guidelines')}
                style={{
                  flex: isMobile ? 1 : 'none',
                  padding: isMobile ? '8px 12px' : '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: carrySubTab === 'guidelines' ? '#ffffff' : 'transparent',
                  color: carrySubTab === 'guidelines' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '13px',
                  boxShadow: carrySubTab === 'guidelines' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                {t("Do's & Don'ts")}
              </button>
            </div>

            {carrySubTab === 'packing' ? (
              <>
                {/* Advisory Top Banner (Clean, Flat, Non-Glassmorphic) */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  boxShadow: 'none'
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Briefcase size={18} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '850', color: '#1e3a8a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Items to Carry")}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Participants are advised to carry simple, comfortable, and activity-appropriate items for the residential program. Please ensure that all belongings are packed neatly and labelled wherever possible.")}
                    </p>
                  </div>
                </div>

                {/* Grid of Category Cards */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: isMobile ? '14px' : '20px',
                  marginTop: '8px'
                }}>
                  {PACKING_CATEGORIES.map((cat) => {
                    const CatIcon = cat.icon || Briefcase;
                    return (
                      <div 
                        key={cat.id} 
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '16px',
                          padding: isMobile ? '16px' : '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
                          transition: 'all 0.2s ease-in-out',
                          position: 'relative'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      >
                        <div>
                          {/* Card Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <CatIcon size={17} />
                              </div>
                              <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '14.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                {t(cat.category)}
                              </span>
                            </div>
                            <span style={{ padding: '2px 8px', background: '#f1f5f9', color: '#64748b', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                              {cat.items.length} {t("items")}
                            </span>
                          </div>

                          {/* Items List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            {cat.items.map((item, itemIdx) => (
                              <div 
                                key={itemIdx} 
                                style={{ 
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                  fontSize: '13px', 
                                  color: '#334155',
                                  lineHeight: '1.4',
                                  fontFamily: 'system-ui, -apple-system, sans-serif'
                                }}
                              >
                                <span style={{ 
                                  color: '#2563eb', 
                                  width: '16px', 
                                  height: '16px', 
                                  borderRadius: '50%', 
                                  backgroundColor: '#eff6ff', 
                                  border: '1px solid #bfdbfe', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  flexShrink: 0, 
                                  marginTop: '2px' 
                                }}>
                                  <Check size={10} strokeWidth={2.8} />
                                </span>
                                <span style={{ flex: 1, textAlign: 'left' }}>
                                  {item.text}
                                  {item.isMandatory && (
                                    <span style={{ marginLeft: '6px', padding: '1px 5px', background: '#fee2e2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '4px', fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'inline-block' }}>
                                      {t("Required")}
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Notes */}
                        {cat.notes && (
                          <div style={{ marginTop: 'auto', background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #f1f5f9', fontSize: '11.5px', color: '#64748b', lineHeight: '1.4', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'left' }}>
                            <span style={{ fontWeight: '700', color: '#475569' }}>{t("Note: ")}</span>
                            {cat.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Items to Carry Advisory Footer Card (Clean, Flat, Non-Glassmorphic) */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  marginTop: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: 'none'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#f59e0b',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <AlertCircle size={20} strokeWidth={2.2} />
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#92400e', fontWeight: '650', lineHeight: '1.5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {t("Participants are encouraged to carry only necessary items and avoid bringing expensive valuables, jewellery, or unnecessary electronic items.")}
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Guidelines Header Banner (Clean, Flat, Non-Glassmorphic) */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: isMobile ? '14px 16px' : '16px 20px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: 'none'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#ea580c',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <GraduationCap size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '14.5px', fontWeight: '800', color: '#0f172a' }}>
                      {t("Life Awakening Program — School Student Guidelines")}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: '1.4' }}>
                      {t("These guidelines ensure safety, mutual respect, discipline, and an enriching residential learning experience for all school students.")}
                    </p>
                  </div>
                </div>

                {/* Grid comparative view */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
                  gap: isMobile ? '16px' : '24px' 
                }}>
                  {/* Do's Panel */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: isMobile ? '16px' : '24px',
                    boxShadow: 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '15.5px', fontWeight: '850', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.3px' }}>
                          {t("Do's (Guidelines to Follow)")}
                        </h3>
                      </div>
                      <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {STUDENT_DOS.length} {t("rules")}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {STUDENT_DOS.map((doItem, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: '12px', 
                            padding: '12px 14px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            boxShadow: 'none',
                            transition: 'all 0.15s ease',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ color: '#10b981', fontWeight: '900', fontSize: '12px', marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: '#dcfce7', borderRadius: '50%', flexShrink: 0 }}>
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600', lineHeight: '1.4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                            {doItem}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Don'ts Panel */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: isMobile ? '16px' : '24px',
                    boxShadow: 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h3 style={{ fontSize: '15.5px', fontWeight: '850', color: '#0f172a', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.3px' }}>
                          {t("Don'ts (Prohibited Actions)")}
                        </h3>
                      </div>
                      <span style={{ padding: '2px 8px', background: '#fee2e2', color: '#c53030', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {STUDENT_DONTS.length} {t("warnings")}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {STUDENT_DONTS.map((dontItem, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: '12px', 
                            padding: '12px 14px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            boxShadow: 'none',
                            transition: 'all 0.15s ease',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ color: '#ef4444', fontWeight: '900', fontSize: '11px', marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: '#fee2e2', borderRadius: '50%', flexShrink: 0 }}>
                            <X size={11} strokeWidth={3} />
                          </span>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600', lineHeight: '1.4', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                            {dontItem}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'code-of-conduct' && (
          <StudentCodeOfConductTab myData={myData} />
        )}

        {activeTab === 'timetable' && (
          <TimetablePanel />
        )}

        {activeTab === 'schedules' && (
          <div 
            style={{ 
              padding: '24px', 
              background: '#ffffff', 
              border: '1.5px solid #e2e8f0', 
              borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }} 
            className="animate-fade-in"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(234,88,12,0.15)'
              }}>
                <Calendar size={20} strokeWidth={2.2} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {t("My Activity Schedule")}
              </h2>
            </div>
            
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Title")}</th>
                    <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Date")}</th>
                    <th style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-slate-50/50">
                      <td style={{ padding: '16px', fontSize: '13.5px', color: '#0f172a', fontWeight: '700', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{s.title}</td>
                      <td style={{ padding: '16px', fontSize: '13.5px', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{s.date}</td>
                      <td style={{ padding: '16px', fontSize: '13.5px', color: '#475569', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{s.time}</td>
                    </tr>
                  ))}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '13.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        {t("No activities scheduled.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div 
            style={{ 
              padding: '24px', 
              background: '#ffffff', 
              border: '1.5px solid #e2e8f0', 
              borderRadius: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)' 
            }} 
            className="animate-fade-in"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(16,185,129,0.15)'
                }}>
                  <ClipboardList size={20} strokeWidth={2.2} />
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.4px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {t("Attendance Records")}
                </h2>
              </div>
              <button 
                onClick={fetchDashboardData} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.15s'
                }}
                className="hover:bg-slate-50"
              >
                <RefreshCw size={13} /> {t("Refresh")}
              </button>
            </div>

            {(() => {
              const summary = evalSummaries[0] || null;
              const attendancePillarsList = [
                { key: 'bag_checking', name: 'Orientation' },
                { key: 'agriculture', name: 'Agriculture & Nature' },
                { key: 'physical', name: 'Physical Fitness & Sports' },
                { key: 'leadership', name: 'Team Building & Leadership' },
                { key: 'patriotism', name: 'Patriotism & Nation Building' },
                { key: 'spirituality', name: 'Spirituality & Peace' }
              ];
              const pillarsList = [
                { key: 'agriculture', name: 'Agriculture & Nature', sumKey: 'agriculture_marks' },
                { key: 'physical', name: 'Physical Fitness & Sports', sumKey: 'physical_marks' },
                { key: 'leadership', name: 'Team Building & Leadership', sumKey: 'leadership_marks' },
                { key: 'patriotism', name: 'Patriotism & Nation Building', sumKey: 'patriotism_marks' },
                { key: 'spirituality', name: 'Spirituality & Peace', sumKey: 'spirituality_marks' }
              ];

              let presentCount = 0;
              let absentCount = 0;
              let totalTracked = 0;

              attendance.forEach(rec => {
                if (rec.pillar && rec.day) {
                  if (Number(rec.day) > 4) return;
                  if (rec.pillar === 'bag_checking' && Number(rec.day) > 1) return;
                  if (rec.pillar !== 'bag_checking' && Number(rec.day) === 1) return;
                  totalTracked++;
                  const statusLower = String(rec.status || '').toLowerCase();
                  if (statusLower === 'present' || statusLower === 'late') {
                    presentCount++;
                  } else if (statusLower === 'absent') {
                    absentCount++;
                  }
                }
              });

              if (totalTracked === 0) {
                attendance.forEach(rec => {
                  if (rec.day && Number(rec.day) > 4) return;
                  totalTracked++;
                  const statusLower = String(rec.status || '').toLowerCase();
                  if (statusLower === 'present' || statusLower === 'late') {
                    presentCount++;
                  } else if (statusLower === 'absent') {
                    absentCount++;
                  }
                });
              }

              const totalPossible = totalTracked > 0 ? totalTracked : 16;
              const attPercentage = totalPossible > 0 ? Math.round((presentCount / totalPossible) * 100) : 0;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Attendance Card - Full Width and Premium Refined */}
                  <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '24px', padding: '28px', boxShadow: '0 8px 30px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.3px' }}>
                      <ClipboardList size={18} style={{ color: '#ea580c' }} /> {t("LTC Attendance Status")}
                    </h3>
                    
                    {/* Premium Stats Blocks */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                      <div style={{ flex: 1, background: '#ffffff', padding: '16px 24px', borderRadius: '14px', textAlign: 'left', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Average Attendance")}</span>
                          <span style={{ fontSize: '24px', fontWeight: '850', color: '#ea580c', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{attPercentage}%</span>
                        </div>
                        <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CheckCircle size={24} />
                        </div>
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '800', color: '#475569', borderRight: '1px solid #e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Pillar Name")}</th>
                            {['D1', 'D2', 'D3', 'D4'].map(d => (
                              <th key={d} style={{ padding: '12px 6px', textAlign: 'center', fontWeight: '800', color: '#475569', borderRight: '1px solid #e2e8f0', width: '60px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{d}</th>
                            ))}
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: '#475569', width: '110px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t("Attendance")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendancePillarsList.map((pillar, idx) => {
                            const pillarRecords = attendance.filter(r => r.pillar === pillar.key);
                            const presentInPillar = pillarRecords.filter(r => String(r.status || '').toLowerCase() === 'present' || String(r.status || '').toLowerCase() === 'late').length;

                            const totalDaysForPillar = pillar.key === 'bag_checking' ? 1 : 3;

                            return (
                              <tr key={pillar.key} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155', borderRight: '1px solid #e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{t(pillar.name)}</td>
                                {[1, 2, 3, 4].map(d => {
                                  if (pillar.key === 'bag_checking' && d > 1) {
                                    return (
                                      <td 
                                        key={d} 
                                        style={{ 
                                          padding: '10px 4px', 
                                          textAlign: 'center', 
                                          borderRight: '1px solid #e2e8f0',
                                          background: '#f8fafc',
                                          color: '#cbd5e1'
                                        }}
                                      >
                                        —
                                      </td>
                                    );
                                  }
                                  if (pillar.key !== 'bag_checking' && d === 1) {
                                    return (
                                      <td 
                                        key={d} 
                                        style={{ 
                                          padding: '10px 4px', 
                                          textAlign: 'center', 
                                          borderRight: '1px solid #e2e8f0',
                                          background: '#f8fafc',
                                          color: '#cbd5e1'
                                        }}
                                      >
                                        —
                                      </td>
                                    );
                                  }
                                  const rec = pillarRecords.find(r => Number(r.day) === d);
                                  const status = rec ? rec.status : null;
                                  const isPresent = status === 'Present' || status === 'Late';
                                  const isAbsent = status === 'Absent';

                                  let bg = '#f1f5f9';
                                  let textClr = '#64748b';
                                  let label = '-';

                                  if (isPresent) {
                                    bg = '#dcfce7';
                                    textClr = '#15803d';
                                    label = status === 'Present' ? 'P' : 'L';
                                  } else if (isAbsent) {
                                    bg = '#fee2e2';
                                    textClr = '#b91c1c';
                                    label = 'A';
                                  }

                                  return (
                                    <td 
                                      key={d} 
                                      style={{ 
                                        padding: '10px 4px', 
                                        textAlign: 'center', 
                                        borderRight: '1px solid #e2e8f0' 
                                      }}
                                    >
                                      <span 
                                        style={{ 
                                          display: 'inline-block',
                                          width: '24px',
                                          height: '24px',
                                          lineHeight: '24px',
                                          background: bg, 
                                          borderRadius: '6px', 
                                          fontWeight: '800',
                                          color: textClr,
                                          fontSize: '11px',
                                          fontFamily: 'system-ui, -apple-system, sans-serif'
                                        }}
                                        title={status ? `Day ${d}: ${status}` : `Day ${d}: Not Marked`}
                                      >
                                        {label}
                                      </span>
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: '#ea580c', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                  {presentInPillar} / {totalDaysForPillar} {t("Days")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}


        {activeTab === 'profile' && <StudentProfileTab token={token} setMyData={setMyData} />}

        {activeTab === 'faq' && <StudentFaqTab />}
        {activeTab === 'support' && <SupportTab />}

        {activeTab === 'service-feedback' && (
          <StudentServiceFeedbackTab
            token={token}
            apiBase={API}
            myData={myData}
            onFeedbackSubmitted={() => {
              setMyData(prev => ({ ...prev, service_feedback_submitted: true }));
              setServiceFeedbackSubmitted(true);
              setActiveTab('certificates');
            }}
          />
        )}

        {activeTab === 'tickets' && <StudentTicketsTab token={token} />}
        {activeTab === 'emergency-contacts' && <StudentEmergencyContactsTab />}

        {activeTab === 'journey' && <StudentJourneyTab token={token} myData={myData} isMobile={isMobile} />}

        {activeTab === 'certificates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {!myData.post_service_feedback_locked && isPostFeedbackDay() && !hasSubmittedServiceFeedback && (
              <div style={{
                background: '#f5f3ff',
                border: '1.5px solid #8b5cf6',
                borderRadius: isMobile ? '14px' : '16px',
                padding: isMobile ? '14px 16px' : '18px 20px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: '14px',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.12)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #ddd6fe' }}>
                    <Sparkles size={22} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: '850', color: '#5b21b6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Service & Trainee Feedback Required")}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#6d28d9', fontWeight: '550', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Please submit the Service & Trainee Feedback Form to complete evaluation and download your certificate.")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('service-feedback')}
                  style={{
                    background: '#6d28d9',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '9px',
                    fontWeight: '750',
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    width: isMobile ? '100%' : 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {t("Open Service Feedback")} <ChevronRight size={15} />
                </button>
              </div>
            )}

            <UserCertificatesTab 
              token={token} 
              myData={myData} 
              canAccessCertificates={canAccessCertificates} 
              onOpenFeedback={() => setActiveTab('service-feedback')} 
            />
          </div>
        )}


      {showReveal && myData.squad && myData.squad !== 'Not Assigned Yet' && (
        <div 
          className="squad-reveal-overlay" 
          style={{ 
            backgroundColor: revealStep === 1 ? '#ea580c' : ((revealStep === 2 || revealStep === 3) ? '#000000' : getSquadSplashColor(myData.squad)),
            backgroundImage: revealStep === 1 ? 'none' : 'none',
            overflowY: 'auto',
            padding: revealStep === 3 ? '0' : '20px 0',
            transition: 'background-color 1.4s cubic-bezier(0.4, 0, 0.2, 1), background-image 1.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Top-Right Controls: Volume Mute/Unmute & Skip */}
          <div style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000
          }}>
            <button
              onClick={toggleMute}
              title={isMuted ? t("Unmute Sound") : t("Mute Sound")}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={() => {
                stopAudio();
                setShowReveal(false);
                localStorage.setItem(`ltc_squad_revealed_${currentUser.id}`, 'true');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '20px',
                padding: '6px 16px',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.5px',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              {t("Skip")}
            </button>
          </div>

          {/* Top spacer for justify-content space-between */}
          <div style={{ height: '10px' }} />

          {revealStep === 1 ? (
            /* Slide 1: Welcome & Intro */
            <div className="squad-reveal-content-wrapper" key="step-1">
              <div className="squad-reveal-icon-container" style={{ background: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none' }}>
                <img src="/lg.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              <h1 className="squad-reveal-title" style={{ whiteSpace: 'nowrap' }}>
                Welcome, {(() => {
                  if (!studentDisplayName) return '';
                  const parts = studentDisplayName.trim().split(/\s+/);
                  const salutations = ['mr', 'mr.', 'ms', 'ms.', 'mrs', 'mrs.', 'dr', 'dr.', 'prof', 'prof.'];
                  for (const part of parts) {
                    if (!salutations.includes(part.toLowerCase())) {
                      return part;
                    }
                  }
                  return parts[0] || '';
                })()}
              </h1>

              <p className="squad-reveal-description">
                Onboarding complete.<br />
                Look within to discover your true potential.
              </p>

              <button 
                className="squad-reveal-btn-pill" 
                onClick={() => {
                  setShowVisionMissionNext(false);
                  setRevealStep(2);
                }}
              >
                FIND MY SQUAD <ChevronRight size={18} />
              </button>
            </div>
          ) : revealStep === 2 ? (
            /* Slide 1.75: Vision & Mission Screen */
            <div className="squad-reveal-content-wrapper" key="step-vision-mission" style={{ maxWidth: '850px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="squad-reveal-icon-container" style={{ background: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', marginBottom: '16px' }}>
                <img src="/lg.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              <VisionMissionTypewriter onComplete={() => setShowVisionMissionNext(true)} isSmallScreen={isSmallScreen} />

              <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '20px' }}>
                <AnimatePresence>
                  {showVisionMissionNext && (
                    <motion.button 
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="squad-reveal-btn-pill" 
                      onClick={() => setRevealStep(3)}
                    >
                      LET'S SEE THE 5 PILLARS <ChevronRight size={18} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : revealStep === 3 ? (
            <FivePillarsJourney
              onComplete={() => setRevealStep(4)}
              pillarStep={pillarStep}
              setPillarStep={setPillarStep}
              isFinalRow={isFinalRow}
              setIsFinalRow={setIsFinalRow}
              showFinalMessage={showFinalMessage}
              setShowFinalMessage={setShowFinalMessage}
              showContinueButton={showContinueButton}
              setShowContinueButton={setShowContinueButton}
            />
          ) : (
            /* Slide 2: Squad Reveal */
            <div className="squad-reveal-content-wrapper" key="step-2">
              <div className="squad-reveal-icon-container">
                <Sun size={40} color="#ffffff" />
              </div>
              
              <h1 className="squad-reveal-title" style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.3 }}>
                Your squad is {myData.squad}
              </h1>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '16px', marginBottom: '20px', alignSelf: 'center' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '14px',
                  padding: '12px 24px',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: '750', color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {t("Room Designation")}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: '850', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t(myData.room_designation || 'Member')}
                  </span>
                </div>
                {(myData.squad_designation || myData.is_squad_leader) && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '14px',
                    padding: '12px 24px',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: '750', color: 'rgba(255, 255, 255, 0.75)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {t("Squad Role")}
                    </span>
                    {renderRoleBadge(myData.squad_designation, myData.is_squad_leader, { fontSize: '15px', padding: '5px 14px' })}
                  </div>
                )}
              </div>

              <p className="squad-reveal-description" style={{ marginTop: '0px' }}>
                More than a team, this is where your inner potential meets collective synergy. Dig deep, inspire others, and conquer the journey ahead!
              </p>

              <button 
                className="squad-reveal-btn-pill" 
                onClick={() => {
                  stopAudio();
                  setShowReveal(false);
                  localStorage.setItem(`ltc_squad_revealed_${currentUser.id}`, 'true');
                }}
              >
                ENTER DASHBOARD <ChevronRight size={18} />
              </button>
            </div>
          )}

        </div>
      )}

        <ScrollToTop watchDeps={[activeTab]} />
    </>
  )

  return (
    <>
      {!isMobile ? (
        <div className="desktop-layout">
          {renderDesktopSidebar()}
          <div className="desktop-main-container">
            {renderDesktopTopbar()}
            <div className="desktop-content" style={{ padding: activeTab === 'dashboard' ? '40px 30px' : '30px', overflowY: 'auto', backgroundColor: '#ececf2' }}>
              {renderContent()}
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard-layout mobile-layout" style={{ backgroundColor: '#ececf2' }}>
          <ScrollToTop watchDeps={[activeTab]} />
          {renderMobileSidebar()}

          {/* ── Fixed Orange Topbar (matching desktop theme) ── */}
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
              {/* Left: hamburger + current tab title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open Sidebar"
                  style={{ background: 'transparent', color: '#ffffff', border: 'none', padding: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: '50%' }}
                  className="hover:bg-white/10"
                >
                  <Menu size={20} />
                </button>
                <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '13.5px', fontFamily: 'system-ui, -apple-system, sans-serif', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {t(
                    activeTab === 'dashboard' ? 'Dashboard' :
                    activeTab === 'timetable' ? 'LAP Timetable' :
                    activeTab === 'attendance' ? 'My Attendance' :
                    activeTab === 'profile' ? 'My Profile' :
                    activeTab === 'undertaking' ? 'Undertaking Form' :
                    activeTab === 'things-to-carry' ? 'Things to Carry' :
                    activeTab === 'code-of-conduct' ? 'Student Code of Conduct' :
                    activeTab === 'service-feedback' ? 'Service & Trainee Feedback' :
                    activeTab === 'journey' ? 'LAP Journey' :
                    activeTab === 'tickets' ? 'Raise Ticket' :
                    activeTab === 'faq' ? 'FAQs' : activeTab
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Bell / Notifications */}
                <div style={{ position: 'relative' }} data-notif-dropdown-mobile>
                  <button 
                    data-notif-trigger-mobile
                    style={{ padding: 0, position: 'relative', height: '32px', width: '32px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', cursor: 'pointer' }} 
                    className="hover:bg-white/10 hover:text-white transition-all active:scale-90"
                    title="Notifications"
                    onClick={() => setIsNotifOpen(o => !o)}
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
                      <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '1px 4px', fontSize: '8px', fontWeight: 700, lineHeight: 1 }}>{unreadCount}</span>
                    )}
                  </button>
                    <div style={{ 
                      position: 'absolute', 
                      top: '38px', 
                      right: '-4px', 
                      background: 'rgba(255, 255, 255, 0.85)', 
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0, 0, 0, 0.08)', 
                      borderRadius: '16px', 
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.02)', 
                      width: 'min(300px, calc(100vw - 20px))', 
                      maxWidth: 'calc(100vw - 20px)',
                      zIndex: 9999, 
                      overflow: 'hidden',
                      pointerEvents: isNotifOpen ? 'auto' : 'none',
                      transform: isNotifOpen ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(-6px)',
                      opacity: isNotifOpen ? 1 : 0,
                      visibility: isNotifOpen ? 'visible' : 'hidden',
                      transformOrigin: 'top right',
                      transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(248, 250, 252, 0.6)' }}>
                        <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Notifications</h3>
                        {unreadCount > 0 && (
                          <button style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }} onClick={markAllAsRead}>Mark all as read</button>
                        )}
                      </div>
                      <div style={{ maxHeight: 'min(320px, 60vh)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {dbNotifications.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No notifications.</div>
                        ) : (
                          <>
                            {dbNotifications.map(n => {
                              const isRead = !!n.read_at;
                              return (
                                <div key={'mob-notif-' + n.id} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', display: 'flex', gap: '8px', alignItems: 'flex-start', background: isRead ? 'transparent' : 'rgba(59, 130, 246, 0.06)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                  {!isRead && <div style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', marginTop: '4px', flexShrink: 0 }} />}
                                  <div style={{ flex: 1, minWidth: 0, paddingLeft: isRead ? '14px' : '0' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', margin: '0 0 2px 0', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.35' }}>{n.title || 'Notification'}</p>
                                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0, wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.35' }}>{n.message}</p>
                                    <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{new Date(n.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Main Content ── */}
          <div className="main-content" style={{ paddingTop: 'calc(44px + env(safe-area-inset-top) + 12px)', paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 12px)', padding: `calc(44px + env(safe-area-inset-top) + 12px) 12px calc(64px + env(safe-area-inset-bottom) + 12px)`, backgroundColor: '#ececf2' }}>
            {renderContent()}
          </div>

          {/* ── Bottom Navigation ── */}
          {myData.undertaking_submitted && (
            <div className="mobile-bottom-nav" style={isSidebarOpen ? { display: 'none' } : {}}>
              <button 
                className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
              >
                <Home size={20} />
                <span>Home</span>
              </button>
              <button 
                className={`mobile-bottom-nav-item ${activeTab === 'timetable' ? 'active' : ''}`}
                onClick={() => { setActiveTab('timetable'); setIsSidebarOpen(false); }}
              >
                <Clock size={20} />
                <span>LAP Table</span>
              </button>
              <button 
                className={`mobile-bottom-nav-item ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => { setActiveTab('attendance'); setIsSidebarOpen(false); }}
              >
                <ClipboardList size={20} />
                <span>Attendance</span>
              </button>
              <button 
                className={`mobile-bottom-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
              >
                <User size={20} />
                <span>Profile</span>
              </button>
            </div>
          )}
        </div>
      )}

      {selectedLeaderDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} className="animate-fade-in">
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            animation: 'modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both'
          }}>
            {/* Header: Beautiful blue background */}
            <div style={{
              background: '#0057b8',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div>
                <span style={{ fontSize: '10px', color: '#bfdbfe', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {selectedLeaderDetails.type}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.3px' }}>
                  {selectedLeaderDetails.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLeaderDetails(null)} 
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '20px',
                  border: '2px solid #fed7aa'
                }}>
                  {selectedLeaderDetails.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{selectedLeaderDetails.role}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Allocated Squad: <strong style={{ color: SQUAD_COLORS[selectedLeaderDetails.squad] || '#c2410c' }}>{selectedLeaderDetails.squad}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>Email Address</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{formatStudentEmail(selectedLeaderDetails.email, 'Not provided')}</div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', letterSpacing: '0.5px' }}>Contact Number</div>
                  <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedLeaderDetails.phone}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button 
                onClick={() => setSelectedLeaderDetails(null)} 
                style={{
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(234,88,12,0.2)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#c2410c'; e.currentTarget.style.transform = 'translateY(-0.5px)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.transform = 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undertaking Completion Gate Explanatory Popup ── */}
      {myData?.id && !myData.undertaking_submitted && !showReveal && showGatePopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: isMobile ? '14px' : '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGatePopup(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '18px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div
              style={{
                backgroundColor: '#ea580c',
                padding: isMobile ? '14px 16px' : '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
                <FileText size={isMobile ? 18 : 20} color="#ffffff" style={{ flexShrink: 0 }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: isMobile ? '15px' : '16.5px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.2px',
                    lineHeight: 1.2
                  }}
                >
                  Undertaking Required
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGatePopup(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: isMobile ? '28px' : '30px',
                  height: isMobile ? '28px' : '30px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
                aria-label="Close"
              >
                <X size={isMobile ? 14 : 16} />
              </button>
            </div>

            <div style={{ padding: isMobile ? '18px 16px' : '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#fff7ed',
                  color: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <AlertCircle size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#334155', lineHeight: 1.55, fontWeight: '500' }}>
                    {t("Please complete your undertaking first to access the Student Portal.")}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowGatePopup(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGatePopup(false);
                    setActiveTab('undertaking');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  <span>Fill Undertaking Form</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function StudentFaqTab() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = [
    {
      q: "Who will take care of my child during the program?",
      a: [
        t("Your child's safety, well-being, and overall development are our highest priorities."),
        t("Throughout the program, students will be under the continuous supervision of trained faculty members, instructors, wardens, coordinators, and support staff from the Life Transformation Centre (LTC)."),
        t("Every activity, meal, and residential arrangement is closely monitored. Separate accommodation is provided for boys and girls, and the campus has round-the-clock supervision and medical support, ensuring a safe, caring, and nurturing environment for every child.")
      ]
    },
    {
      q: "What is the student-to-faculty ratio?",
      a: [
        t("LTC maintains a 15:1 student-to-faculty ratio, ensuring that every group of 15 students is guided by a dedicated faculty member or warden."),
        t("This allows every child to receive individual attention, close supervision, and continuous guidance throughout the program.")
      ]
    },
    {
      q: "What should I do if my child has a medical condition, allergies, or requires regular medication?",
      a: [
        t("Parents are requested to provide complete medical information, including allergies, existing health conditions, dietary restrictions, and regular medications, during the registration process."),
        t("The LTC team will take the necessary precautions to ensure your child's health and comfort. Any prescribed medication should be handed over to the designated LTC staff with clear written instructions.")
      ]
    },
    {
      q: "What happens if my child falls ill or gets injured during the program?",
      a: [
        t("If a child becomes unwell or sustains an injury, immediate first aid will be provided by the LTC medical team."),
        t("The campus has a 24×7 First Aid Medical Clinic supported by a dedicated doctor and nurse. If additional medical care is required, the child will be taken to the nearest healthcare facility, and parents or guardians will be informed immediately."),
        t("A faculty member will remain with the child until the situation is fully resolved.")
      ]
    },
    {
      q: "How will parents be informed in case of an emergency?",
      a: [
        t("In any medical or other emergency, parents or guardians will be contacted immediately via telephone and WhatsApp using the emergency contact details provided during registration."),
        t("The LTC team will keep parents informed about the child's condition, the care being provided, and any further action required.")
      ]
    },
    {
      q: "Can I speak with my child during the program?",
      a: [
        t("Yes. Before the program begins, parents will receive the emergency contact numbers of the LTC team."),
        t("To help children fully engage in the program and develop confidence and independence, mobile phones are generally not permitted during program activities."),
        t("However, if there is an emergency or an important need, parents may contact the LTC team, who will promptly facilitate communication with their child.")
      ]
    },
    {
      q: "Are mobile phones allowed?",
      a: [
        t("Students are generally not permitted to use mobile phones during the residential program."),
        t("This encourages meaningful participation, stronger peer interaction, self-discipline, and a distraction-free learning environment. Mobile phones, if carried, will be safely collected and returned at the end of the program, as per LTC guidelines.")
      ]
    },
    {
      q: "What safety measures are in place?",
      a: [
        t("The safety of every participant is ensured through:"),
        {
          type: "list",
          items: [
            t("Dedicated faculty supervision (15:1 ratio)"),
            t("Trained instructors for all activities"),
            t("Safety briefing before every activity"),
            t("Separate accommodation for boys and girls"),
            t("24×7 residential supervision"),
            t("Safe transportation with faculty escorts"),
            t("Travel insurance for all participants"),
            t("24×7 First Aid Medical Clinic with a doctor and nurse"),
            t("Immediate emergency response and parent communication")
          ]
        },
        t("These measures ensure that every child enjoys a safe and secure residential experience.")
      ]
    },
    {
      q: "What should my child bring to the program?",
      a: [
        t("Parents will receive a detailed list of recommended items before the program begins."),
        t("Children are advised to carry comfortable clothing, sports shoes, personal toiletries, prescribed medicines (if any), a water bottle, and other essential personal items."),
        t("Expensive jewellery, electronic gadgets, valuables, and unnecessary cash should not be brought to the campus.")
      ]
    },
    {
      q: "What kind of food will be provided?",
      a: [
        t("Children will be served fresh, nutritious, and hygienically prepared vegetarian meals along with healthy snacks and drinking water throughout the program."),
        t("Parents should inform the LTC team in advance about any food allergies or medical dietary requirements.")
      ]
    },
    {
      q: "Where will the children stay?",
      a: [
        t("Students will stay in safe, clean, and comfortable residential accommodation within the LTC campus."),
        t("Separate accommodation is provided for boys and girls, with dedicated wardens and faculty members available round the clock to ensure their comfort and safety.")
      ]
    },
    {
      q: "Can a parent accompany their child?",
      a: [
        t("Yes. One parent may accompany the child by enrolling in the Parent Program, which runs separately alongside the children's program."),
        t("Parents will participate in dedicated sessions designed specifically for them while children attend the Life Awakening Program independently. Separate accommodation will be provided, and parents will not participate in or interfere with their child's daily activities, allowing every child to experience the full benefits of the residential program.")
      ]
    },
    {
      q: "Will my child be safe throughout the program?",
      a: [
        t("Absolutely. Every aspect of the program has been carefully designed with children's safety as the highest priority. From trained faculty and instructors to medical support, secure accommodation, supervised activities, emergency response systems, and regular communication with parents, every measure is in place to provide a safe, secure, and enriching experience."),
        t("Our goal is to ensure that every child returns home healthier, happier, more confident, and inspired.")
      ]
    }
  ];

  // Helper function to check if query matches parts of answer
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

  const filteredFaqs = searchQuery.trim() === ""
    ? faqs
    : faqs.filter(faq => {
        const qMatch = faq.q.toLowerCase().includes(searchQuery.toLowerCase());
        const aMatch = faq.a.some(part => matchesAnswer(part, searchQuery.toLowerCase()));
        return qMatch || aMatch;
      });

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
        border: '1.5px solid #e2e8f0', 
        borderRadius: '20px', 
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(234, 88, 12, 0.15)'
            }}>
              <HelpCircle size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.4px' }}>
                {t("FAQs Commonly Asked by Parents")}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>
                {t("Life Awakening Program (School Education) — Supervision, Safety, Health, Meals & Stay Policies")}
              </p>
            </div>
          </div>
          <span style={{ padding: '4px 12px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '20px', fontSize: '12px', fontWeight: '750' }}>
            {faqs.length} {t("Questions")}
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="text"
          placeholder={t("Search questions (e.g. safety, medical, food, mobile phones, accommodation)...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="faq-search-input"
          style={{
            width: '100%',
            padding: '12px 14px 12px 40px',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: '13.5px',
            color: '#0f172a',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'all 0.2s ease'
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        )}
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

function StudentJourneyTab({ token, myData, isMobile }) {
  return <FacultyJourneyTab token={token} isStudent={true} user={myData} />;
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
