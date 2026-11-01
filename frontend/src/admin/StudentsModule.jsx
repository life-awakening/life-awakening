import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Plus, Search, Trash2, RefreshCw, GraduationCap, X, Eye, Edit2,
  User, Mail, Phone, MapPin, Shield, CheckCircle2, XCircle, FileCheck,
  School, ChevronLeft, ChevronRight, Users, ExternalLink, Layers, Check,
  HeartPulse, CreditCard, FileText, AlertTriangle, UploadCloud, Lock, Calendar,
  Upload, FileImage, AlertCircle, Heart, ChevronDown, ChevronUp
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

// Local Modal helper
function Modal({ open, onClose, title, children, size = '' }) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box'
      }}
    >
      <div
        className={`modal ${size ? 'modal-' + size : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          maxWidth: size === 'xl' ? '920px' : (size === 'lg' ? '780px' : '540px'),
          background: '#ffffff'
        }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '16px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
          <h3 className="modal-title" style={{ fontSize: '17px', fontWeight: '850', color: '#0f172a', margin: 0 }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 6, background: '#e2e8f0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 50

export default function StudentsModule({
  users = [],
  students: legacyStudents = [],
  batches: externalBatches = [],
  setIsStudentModalOpen,
  handleDeleteUser,
  fetchUsers,
  hideTitle = false,
  apiFetch,
  toast
}) {
  const { t } = useLanguage()
  const primaryOrange = '#ea580c'
  const primaryOrangeDark = '#c2410c'
  const primaryOrangeLight = '#fff7ed'
  const primaryBlue = primaryOrange

  // Student list from Life Awakening endpoint
  const [laStudents, setLaStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [batchesList, setBatchesList] = useState(externalBatches || [])

  // Life Awakening Filter States
  const [search, setSearch] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState('')
  const [selectedConsent, setSelectedConsent] = useState('')
  const [page, setPage] = useState(1)

  // Profile and Edit Modal States
  const [selectedStudentProfile, setSelectedStudentProfile] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  // View Guardians modal for > 2 guardians
  const [guardiansModalStudent, setGuardiansModalStudent] = useState(null)

  // Fetch full Life Awakening students list
  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      if (apiFetch) {
        const res = await apiFetch('/api/admin/la/students')
        if (res && res.ok) {
          const data = await res.json()
          setLaStudents(data.students || [])
          return
        }
      }
    } catch (err) {
      console.error('Failed to load Life Awakening students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }, [apiFetch])

  // Fetch batches if not supplied
  const loadBatches = useCallback(async () => {
    if (externalBatches && externalBatches.length > 0) {
      setBatchesList(externalBatches)
      return
    }
    try {
      if (apiFetch) {
        const res = await apiFetch('/api/admin/batches')
        if (res && res.ok) {
          const data = await res.json()
          setBatchesList(data.batches || [])
        }
      }
    } catch (_) {}
  }, [apiFetch, externalBatches])

  useEffect(() => {
    loadStudents()
    loadBatches()
  }, [loadStudents, loadBatches])

  // Fallback if laStudents is empty: convert legacy students if available
  const activeStudents = useMemo(() => {
    if (laStudents.length > 0) return laStudents
    if (legacyStudents.length > 0) {
      return legacyStudents.map(u => ({
        id: u.id,
        student_id: u.system_student_id || u.student_id || `LA-${String(u.id).padStart(5, '0')}`,
        system_student_id: u.system_student_id || null,
        name: u.name,
        class_grade: u.class_grade || '—',
        school: u.school || null,
        school_branch: u.school_branch || null,
        roll_number: u.roll_number || null,
        division: u.division || null,
        guardian_name: u.nominee_name || null,
        guardian_relationship: u.nominee_relationship || null,
        parent1_email: u.parent1_email || u.parent_email || null,
        parent2_email: u.parent2_email || u.personal_email || null,
        parents_linked: ((u.parent1_email || u.parent_email) ? 1 : 0) + ((u.parent2_email || u.personal_email) ? 1 : 0),
        parents: [
          (u.parent1_email || u.parent_email) ? { email: u.parent1_email || u.parent_email, name: u.nominee_name || 'Primary Parent', relationship: u.nominee_relationship || 'Parent' } : null,
          (u.parent2_email || u.personal_email) ? { email: u.parent2_email || u.personal_email, name: 'Secondary Parent', relationship: 'Parent' } : null
        ].filter(Boolean),
        contact_number: u.parent_mobile || u.phone || null,
        payment_status: u.payment_status || 'pending',
        consent_status: u.parent_consent_confirmed ? 'confirmed' : 'pending',
        batches: []
      }))
    }
    return []
  }, [laStudents, legacyStudents])

  // Dynamic filter options derived from actual student data
  const availableSchools = useMemo(() => {
    const set = new Set()
    for (const s of activeStudents) {
      if (s.school && String(s.school).trim()) set.add(String(s.school).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [activeStudents])

  const availableBranches = useMemo(() => {
    const set = new Set()
    for (const s of activeStudents) {
      if (s.school_branch && String(s.school_branch).trim()) set.add(String(s.school_branch).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [activeStudents])

  const availableClasses = useMemo(() => {
    const base = ['6th', '7th', '8th', '9th', '10th', '11th', '12th', 'MSC', 'BSC', 'B.Tech']
    const set = new Set(base)
    for (const s of activeStudents) {
      if (s.class_grade && String(s.class_grade).trim() && s.class_grade !== '—') {
        set.add(String(s.class_grade).trim())
      }
    }
    return Array.from(set)
  }, [activeStudents])

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setPage(1)
  }, [search, selectedClass, selectedSchool, selectedBranch, selectedBatch, selectedPayment, selectedConsent])

  // Filter students
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeStudents.filter(s => {
      // Search by student name, Student ID, parent emails, contact number, or roll number
      if (q) {
        const matchesName = (s.name || '').toLowerCase().includes(q)
        const matchesId = (s.student_id || '').toLowerCase().includes(q) || String(s.id).includes(q)
        const matchesP1 = (s.parent1_email || s.parent_1_email || '').toLowerCase().includes(q)
        const matchesP2 = (s.parent2_email || s.parent_2_email || '').toLowerCase().includes(q)
        const matchesParentsArr = Array.isArray(s.parents) && s.parents.some(p => (p.email || '').toLowerCase().includes(q) || (p.name || '').toLowerCase().includes(q))
        const matchesPhone = (s.contact_number || '').toLowerCase().includes(q)
        const matchesRoll = (s.roll_number || '').toLowerCase().includes(q)
        const matchesSchool = (s.school || '').toLowerCase().includes(q)
        if (!matchesName && !matchesId && !matchesP1 && !matchesP2 && !matchesParentsArr && !matchesPhone && !matchesRoll && !matchesSchool) {
          return false
        }
      }

      // Class / Standard filter (6th, 7th, 8th, 9th, 10th)
      if (selectedClass) {
        const normSClass = String(s.class_grade || '').trim().toLowerCase()
        const normTarget = selectedClass.trim().toLowerCase()
        if (normSClass !== normTarget) return false
      }

      // School filter
      if (selectedSchool && (s.school || '').trim().toLowerCase() !== selectedSchool.trim().toLowerCase()) {
        return false
      }

      // School branch filter
      if (selectedBranch && (s.school_branch || '').trim().toLowerCase() !== selectedBranch.trim().toLowerCase()) {
        return false
      }

      // Batch filter
      if (selectedBatch) {
        const batchIdNum = parseInt(selectedBatch, 10)
        const inBatch = Array.isArray(s.batches) && s.batches.some(b => b.id === batchIdNum || String(b.id) === selectedBatch)
        if (!inBatch) return false
      }

      // Payment status filter (verified, submitted, pending)
      if (selectedPayment) {
        if ((s.payment_status || 'pending').toLowerCase() !== selectedPayment.toLowerCase()) {
          return false
        }
      }

      // Consent status filter (confirmed, pending)
      if (selectedConsent) {
        if ((s.consent_status || 'pending').toLowerCase() !== selectedConsent.toLowerCase()) {
          return false
        }
      }

      return true
    })
  }, [activeStudents, search, selectedClass, selectedSchool, selectedBranch, selectedBatch, selectedPayment, selectedConsent])

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredStudents.slice(start, start + PAGE_SIZE)
  }, [filteredStudents, page])

  const handleRefresh = async () => {
    await loadStudents()
    if (fetchUsers) fetchUsers()
  }

  const receiptFileInputRef = useRef(null)
  const signatureFileInputRef = useRef(null)
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false)
  const [isUploadingSignature, setIsUploadingSignature] = useState(false)
  const [showFullConsentText, setShowFullConsentText] = useState(false)

  const DEFAULT_LAP_CONSENT_TEXT = `I, parent/guardian of the above-mentioned student, hereby grant permission for my child to participate in the Life Awakening Program conducted at Life Transformation Centre (LTC), Boribel.
I understand and acknowledge that:
• The program includes outdoor, physical, sports, agricultural, nature-based, leadership, and experiential learning activities.
• While LTC shall take all reasonable precautions to ensure participant safety and provide supervision, no outdoor or physical activity can be entirely risk-free.
• Minor injuries, illness, insect bites, falls, environmental exposure, or unforeseen incidents may occur despite reasonable precautions.
• I authorize LTC and its designated representatives to arrange appropriate medical treatment, transportation, and emergency care for my child if required.
• I have truthfully disclosed all relevant medical conditions, allergies, medications, and health-related information.
• My child agrees to comply with all rules, safety instructions, and codes of conduct issued by LTC, instructors, and accompanying school staff.
• I confirm that I have read and understood the nature of the Life Awakening Program, safety protocols, and participation expectations, and voluntarily consent to my child's participation.`

  const handleFileUpload = async (file, fieldType) => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    if (fieldType === 'receipt') setIsUploadingReceipt(true)
    if (fieldType === 'signature') setIsUploadingSignature(true)

    try {
      const res = await apiFetch('/api/admin/upload-file', {
        method: 'POST',
        body: formData
      })
      if (res && res.ok) {
        const data = await res.json()
        if (fieldType === 'receipt') {
          setEditForm(prev => ({ ...prev, payment_screenshot_url: data.url }))
          if (toast) toast('Payment receipt uploaded successfully', 'success')
        } else if (fieldType === 'signature') {
          setEditForm(prev => ({ ...prev, digital_signature_url: data.url }))
          if (toast) toast('Digital signature uploaded successfully', 'success')
        }
      } else {
        const errData = await res.json().catch(() => ({}))
        if (toast) toast(errData?.message || 'Failed to upload file', 'error')
      }
    } catch (err) {
      if (toast) toast('Upload error: ' + err.message, 'error')
    } finally {
      if (fieldType === 'receipt') setIsUploadingReceipt(false)
      if (fieldType === 'signature') setIsUploadingSignature(false)
    }
  }

  // View Student Profile
  const handleViewProfile = async (studentId) => {
    setIsLoadingProfile(true)
    setIsProfileModalOpen(true)
    setSelectedStudentProfile(null)
    setIsEditing(false)
    setShowFullConsentText(false)
    try {
      const res = await apiFetch(`/api/admin/users/${studentId}/profile`)
      if (res && res.ok) {
        const data = await res.json()
        const p1Email = data.user.parent1_email || (data.user.parents && data.user.parents[0]?.email) || data.user.parent_email || ''
        const p2Email = data.user.parent2_email || (data.user.parents && data.user.parents[1]?.email) || ''
        setSelectedStudentProfile(data.user)
        setEditForm({
          name: data.user.name || '',
          email: data.user.email || '',
          dob: data.user.dob ? String(data.user.dob).slice(0, 10) : '',
          gender: data.user.gender || '',
          blood_group: data.user.blood_group || '',
          school: data.user.school || '',
          school_branch: data.user.school_branch || '',
          class_grade: data.user.class_grade || '',
          division: data.user.division || '',
          prn: data.user.prn || '',
          roll_number: data.user.roll_number || '',
          parent_name: data.user.parent_name || data.user.nominee_name || '',
          parent_relationship: data.user.parent_relationship || data.user.nominee_relationship || 'Father',
          parent1_email: p1Email,
          parent2_email: p2Email,
          parent_email: p1Email,
          parent_mobile: data.user.parent_mobile || data.user.phone || '',
          emergency_contact_alt_mobile: data.user.emergency_contact_alt_mobile || '',
          address: data.user.address || '',
          has_medical_condition: (data.user.has_medical_condition && String(data.user.has_medical_condition).trim().toLowerCase() === 'yes') ? 'Yes' : 'No',
          medical_conditions: data.user.medical_conditions || data.user.med_details || '',
          known_allergies: data.user.known_allergies || '',
          payment_status: data.user.payment_status || 'pending',
          payment_screenshot_url: data.user.payment_screenshot_url || '',
          parent_consent_confirmed: Boolean(data.user.parent_consent_confirmed),
          parent_consent_text: data.user.parent_consent_text || DEFAULT_LAP_CONSENT_TEXT,
          digital_signature_url: data.user.digital_signature_url || ''
        })
      } else {
        if (toast) toast('Failed to load student profile', 'error')
        setIsProfileModalOpen(false)
      }
    } catch (err) {
      if (toast) toast('Error loading profile: ' + err.message, 'error')
      setIsProfileModalOpen(false)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  // Save student profile edits
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault()
    if (!selectedStudentProfile) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const p1 = (editForm.parent1_email || '').trim().toLowerCase()
    const p2 = (editForm.parent2_email || '').trim().toLowerCase()
    const stEmail = (editForm.email || '').trim().toLowerCase()

    if (p1 && !emailRegex.test(p1)) {
      if (toast) toast(`Invalid Parent 1 email format: "${p1}"`, 'error')
      return
    }
    if (p2 && !emailRegex.test(p2)) {
      if (toast) toast(`Invalid Parent 2 email format: "${p2}"`, 'error')
      return
    }
    if (p1 && p2 && p1 === p2) {
      if (toast) toast('Parent 1 and Parent 2 cannot have the same email address', 'error')
      return
    }
    if (stEmail && !emailRegex.test(stEmail)) {
      if (toast) toast(`Invalid Student email format: "${stEmail}"`, 'error')
      return
    }
    if (stEmail && (stEmail === p1 || stEmail === p2)) {
      if (toast) toast('Student email cannot be the same as parent email address', 'error')
      return
    }

    setIsSavingAccount(true)
    try {
      const payload = {
        ...editForm,
        name: (editForm.name || '').trim(),
        email: stEmail || null,
        parent_name: (editForm.parent_name || '').trim(),
        nominee_name: (editForm.parent_name || '').trim(),
        parent_relationship: (editForm.parent_relationship || '').trim(),
        nominee_relationship: (editForm.parent_relationship || '').trim(),
        parent_email: p1 || null,
        parent1_email: p1 || null,
        parent2_email: p2 || null,
        parent_mobile: (editForm.parent_mobile || '').trim(),
        phone: (editForm.parent_mobile || '').trim(),
        emergency_contact_alt_mobile: (editForm.emergency_contact_alt_mobile || '').trim(),
        medical_conditions: (editForm.medical_conditions || '').trim(),
        med_details: (editForm.medical_conditions || '').trim(),
        known_allergies: (editForm.known_allergies || '').trim(),
        payment_screenshot_url: (editForm.payment_screenshot_url || '').trim(),
        digital_signature_url: (editForm.digital_signature_url || '').trim(),
        parent_consent_confirmed: Boolean(editForm.parent_consent_confirmed),
        parent_consent_text: (editForm.parent_consent_text || '').trim()
      }
      const res = await apiFetch(`/api/admin/users/${selectedStudentProfile.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res && res.ok) {
        if (toast) toast('Student details updated successfully', 'success')
        setSelectedStudentProfile(prev => ({
          ...prev,
          ...payload,
          parent1_email: p1,
          parent2_email: p2,
          parent_email: p1
        }))
        setLaStudents(prev => prev.map(s => s.id === selectedStudentProfile.id ? {
          ...s,
          ...payload,
          parent1_email: p1,
          parent_1_email: p1,
          parent2_email: p2,
          parent_2_email: p2,
          parent_email: p1
        } : s))
        setIsEditing(false)
        handleRefresh()
        if (loadStudents) loadStudents()
      } else {
        const errData = await res.json().catch(() => ({}))
        if (toast) toast(errData?.message || 'Failed to update student details', 'error')
      }
    } catch (err) {
      if (toast) toast('Error updating student: ' + err.message, 'error')
    } finally {
      setIsSavingAccount(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'S'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return name[0].toUpperCase()
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ── Top Header Bar ── */}
      {!hideTitle && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
              {t("Student Directory")}
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginTop: '4px', margin: 0 }}>
              Life Awakening School-Student Directory · {filteredStudents.length} {t("of")} {activeStudents.length} {t("students")}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn hover:bg-slate-50"
              onClick={handleRefresh}
              title="Refresh Student List"
              style={{ padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <RefreshCw size={15} className={loadingStudents ? 'animate-spin' : ''} />
            </button>
            {setIsStudentModalOpen && (
              <button
                className="btn"
                onClick={() => setIsStudentModalOpen(true)}
                style={{ background: primaryOrange, color: '#ffffff', borderRadius: '12px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13.5px', border: 'none', cursor: 'pointer' }}
              >
                <Plus size={16} /> {t("Add Student")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Life Awakening Filters Card ── */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '14px 18px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center'
        }}
      >
        {/* Search input across Student ID, Name, Parent Emails, Contact, Roll Number */}
        <div style={{ position: 'relative', flex: '2 1 240px', minWidth: '220px' }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={t("Search by Student ID, name, parent email, roll no, phone…")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#0f172a',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Class / Standard Filter (6th, 7th, 8th, 9th, 10th) */}
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '13px',
            backgroundColor: selectedClass ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${selectedClass ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '10px',
            outline: 'none',
            color: selectedClass ? '#1d4ed8' : '#475569',
            fontWeight: selectedClass ? '600' : '400',
            flex: '1 1 120px',
            cursor: 'pointer'
          }}
        >
          <option value="">All Classes</option>
          {availableClasses.map(c => (
            <option key={c} value={c}>
              {c.endsWith('th') || c.endsWith('st') || c.endsWith('nd') || c.endsWith('rd') ? `Class ${c}` : c}
            </option>
          ))}
        </select>

        {/* School Filter */}
        <select
          value={selectedSchool}
          onChange={e => setSelectedSchool(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '13px',
            backgroundColor: selectedSchool ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${selectedSchool ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '10px',
            outline: 'none',
            color: selectedSchool ? '#1d4ed8' : '#475569',
            fontWeight: selectedSchool ? '600' : '400',
            flex: '1 1 140px',
            cursor: 'pointer'
          }}
        >
          <option value="">All Schools</option>
          {availableSchools.map(sch => (
            <option key={sch} value={sch}>{sch}</option>
          ))}
        </select>

        {/* School Branch Filter */}
        {availableBranches.length > 0 && (
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            style={{
              padding: '9px 12px',
              fontSize: '13px',
              backgroundColor: selectedBranch ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${selectedBranch ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: '10px',
              outline: 'none',
              color: selectedBranch ? '#1d4ed8' : '#475569',
              fontWeight: selectedBranch ? '600' : '400',
              flex: '1 1 130px',
              cursor: 'pointer'
            }}
          >
            <option value="">All Branches</option>
            {availableBranches.map(br => (
              <option key={br} value={br}>{br}</option>
            ))}
          </select>
        )}

        {/* Batch Filter */}
        <select
          value={selectedBatch}
          onChange={e => setSelectedBatch(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '13px',
            backgroundColor: selectedBatch ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${selectedBatch ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '10px',
            outline: 'none',
            color: selectedBatch ? '#1d4ed8' : '#475569',
            fontWeight: selectedBatch ? '600' : '400',
            flex: '1 1 130px',
            cursor: 'pointer'
          }}
        >
          <option value="">All Batches</option>
          {batchesList.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Payment Status Filter */}
        <select
          value={selectedPayment}
          onChange={e => setSelectedPayment(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '13px',
            backgroundColor: selectedPayment ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${selectedPayment ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '10px',
            outline: 'none',
            color: selectedPayment ? '#1d4ed8' : '#475569',
            fontWeight: selectedPayment ? '600' : '400',
            flex: '1 1 120px',
            cursor: 'pointer'
          }}
        >
          <option value="">All Payment</option>
          <option value="verified">Verified</option>
          <option value="submitted">Submitted</option>
          <option value="pending">Pending</option>
        </select>

        {/* Consent Status Filter */}
        <select
          value={selectedConsent}
          onChange={e => setSelectedConsent(e.target.value)}
          style={{
            padding: '9px 12px',
            fontSize: '13px',
            backgroundColor: selectedConsent ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${selectedConsent ? '#3b82f6' : '#e2e8f0'}`,
            borderRadius: '10px',
            outline: 'none',
            color: selectedConsent ? '#1d4ed8' : '#475569',
            fontWeight: selectedConsent ? '600' : '400',
            flex: '1 1 120px',
            cursor: 'pointer'
          }}
        >
          <option value="">All Consent</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>

        {/* Clear Filters Button */}
        {(search || selectedClass || selectedSchool || selectedBranch || selectedBatch || selectedPayment || selectedConsent) && (
          <button
            onClick={() => {
              setSearch('')
              setSelectedClass('')
              setSelectedSchool('')
              setSelectedBranch('')
              setSelectedBatch('')
              setSelectedPayment('')
              setSelectedConsent('')
            }}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#475569',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Student Directory Table Card ── */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 10px 24px rgba(0,0,0,0.02)',
          overflow: 'hidden'
        }}
      >
        {filteredStudents.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ background: primaryOrangeLight, color: primaryOrange, width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={22} />
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', margin: 0 }}>
              {loadingStudents ? 'Loading student directory…' : 'No students found matching the selected filters.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '2200px' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', width: '60px', whiteSpace: 'nowrap' }}>S.No.</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Student ID</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Student Name</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Class / Std</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>School Name</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>School Branch</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Roll No.</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Division</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Parent / Guardian</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Parent 1 Email</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Parent 2 Email</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>WhatsApp / Contact</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Payment</th>
                  <th style={{ padding: '13px 14px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Consent</th>
                  <th style={{ padding: '13px 18px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((st, index) => {
                  const sNo = (page - 1) * PAGE_SIZE + index + 1
                  const paymentColor = st.payment_status === 'verified'
                    ? { bg: '#dcfce7', text: '#15803d', border: '#86efac' }
                    : st.payment_status === 'submitted'
                    ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
                    : { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }

                  const consentColor = st.consent_status === 'confirmed'
                    ? { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }
                    : { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }

                  const p1Email = st.parent1_email || st.parent_1_email
                  const p2Email = st.parent2_email || st.parent_2_email

                  return (
                    <tr
                      key={st.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      className="hover:bg-slate-50/70"
                    >
                      {/* 1. S. No. */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {sNo}
                      </td>

                      {/* 2. Permanent Student ID */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '750', fontSize: '12.5px', color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                          {st.system_student_id || st.student_id || st.student_display_id || `LA-${String(st.id).padStart(5, '0')}`}
                        </span>
                      </td>

                      {/* 3. Student Name */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: '750', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {st.name}
                        </div>
                      </td>

                      {/* 4. Class / Standard */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                          {st.class_grade || '—'}
                        </span>
                      </td>

                      {/* 5. School Name */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#334155', fontWeight: '500', whiteSpace: 'nowrap' }}>
                        {st.school || '—'}
                      </td>

                      {/* 6. School Branch */}
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {st.school_branch || '—'}
                      </td>

                      {/* 7. Roll Number */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {st.roll_number || '—'}
                      </td>

                      {/* 8. Division */}
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {st.division || '—'}
                      </td>

                      {/* 9. Parent / Guardian Name */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {st.guardian_name || (st.parents && st.parents[0]?.name) || '—'}
                        {st.parents && st.parents.length > 2 && (
                          <button
                            onClick={() => setGuardiansModalStudent(st)}
                            style={{ marginLeft: 6, fontSize: '10px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            +{st.parents.length - 2} more
                          </button>
                        )}
                      </td>

                      {/* 10. Parent 1 Email */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#c2410c', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {p1Email || '—'}
                      </td>

                      {/* 11. Parent 2 Email */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: p2Email ? '#c2410c' : '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {p2Email || '—'}
                      </td>

                      {/* 12. WhatsApp / Contact */}
                      <td style={{ padding: '12px 14px', fontSize: '12.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {st.contact_number || '—'}
                      </td>

                      {/* 13. Payment Status */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: paymentColor.bg,
                          color: paymentColor.text,
                          border: `1px solid ${paymentColor.border}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '750',
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap'
                        }}>
                          {st.payment_status || 'Pending'}
                        </span>
                      </td>

                      {/* 14. Consent Status */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          background: consentColor.bg,
                          color: consentColor.text,
                          border: `1px solid ${consentColor.border}`,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: '750',
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          whiteSpace: 'nowrap'
                        }}>
                          {st.consent_status || 'Pending'}
                        </span>
                      </td>

                      {/* 15. Actions */}
                      <td style={{ padding: '12px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleViewProfile(st.id)}
                            title="View student profile & parent accounts"
                            style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#c2410c', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            <Eye size={12} /> {t("View")}
                          </button>
                          <button
                            onClick={() => {
                              handleViewProfile(st.id)
                              setIsEditing(true)
                            }}
                            title="Edit student details"
                            style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            <Edit2 size={12} /> {t("Edit")}
                          </button>
                          {handleDeleteUser && (
                            <button
                              title="Delete student from database"
                              style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              onClick={() => handleDeleteUser(st.id, 'student')}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Bar ── */}
        <div style={{
          borderTop: '1px solid #f1f5f9',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#fafafa'
        }}>
          <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
            Showing {filteredStudents.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length} students
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: page <= 1 ? '#f1f5f9' : '#ffffff',
                color: page <= 1 ? '#94a3b8' : '#334155',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', padding: '0 8px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                color: page >= totalPages ? '#94a3b8' : '#334155',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── View / Edit Student Profile Modal ── */}
      <Modal open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Student Profile & Parent Information" size="xl">
        {/* Hidden File Inputs for Receipt and Signature */}
        <input
          type="file"
          ref={receiptFileInputRef}
          style={{ display: 'none' }}
          accept="image/*,application/pdf"
          onChange={e => { if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 'receipt') }}
        />
        <input
          type="file"
          ref={signatureFileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={e => { if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 'signature') }}
        />

        {isLoadingProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 0', gap: '14px' }}>
            <div className="spinner spinner-sm" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Fetching complete student registration profile…</p>
          </div>
        ) : selectedStudentProfile ? (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '13px' }}>
            
            {/* Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #154388 0%, #1e40af 100%)',
              padding: '18px 22px',
              borderRadius: '16px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 4px 16px rgba(21, 67, 136, 0.15)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: '#ffffff',
                color: '#154388',
                fontSize: '22px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                {getInitials(selectedStudentProfile.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '220px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '850', margin: 0, letterSpacing: '-0.2px' }}>
                  {selectedStudentProfile.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '3px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '750', background: 'rgba(255,255,255,0.22)', padding: '2px 8px', borderRadius: '4px' }}>
                    Student ID: {selectedStudentProfile.system_student_id || selectedStudentProfile.student_id || selectedStudentProfile.student_display_id || `LA-${String(selectedStudentProfile.id).padStart(5, '0')}`}
                  </span>
                  {selectedStudentProfile.class_grade && (
                    <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,0.22)', padding: '2px 8px', borderRadius: '4px' }}>
                      Class {selectedStudentProfile.class_grade}
                    </span>
                  )}
                  {selectedStudentProfile.school && (
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: '4px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedStudentProfile.school}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  background: isEditing ? '#fee2e2' : '#ffffff',
                  color: isEditing ? '#b91c1c' : '#154388',
                  border: isEditing ? '1px solid #f87171' : 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontWeight: '750',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                {isEditing ? <X size={14} /> : <Edit2 size={14} />}
                {isEditing ? 'Cancel Edit' : 'Edit Profile'}
              </button>
            </div>

            {/* Profile Grid: 2 columns on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
              
              {/* 1. Student Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} style={{ color: '#2563eb' }} /> 1. Student Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Student Full Name</div>
                    {isEditing ? (
                      <input type="text" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '750', color: '#0f172a', marginTop: '3px' }}>{selectedStudentProfile.name || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Date of Birth</div>
                    {isEditing ? (
                      <input type="date" value={editForm.dob || ''} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.dob ? String(selectedStudentProfile.dob).slice(0, 10) : '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Gender</div>
                    {isEditing ? (
                      <select value={editForm.gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.gender || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Blood Group</div>
                    {isEditing ? (
                      <select value={editForm.blood_group || ''} onChange={e => setEditForm({ ...editForm, blood_group: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontWeight: '750', fontSize: '11.5px' }}>
                          {selectedStudentProfile.blood_group || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>System Student ID</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px', color: '#475569' }}>
                      <Lock size={12} style={{ color: '#94a3b8' }} />
                      <span style={{ fontFamily: 'monospace', fontWeight: '750', fontSize: '12px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                        {selectedStudentProfile.system_student_id || selectedStudentProfile.student_id || selectedStudentProfile.student_display_id || `LA-${String(selectedStudentProfile.id).padStart(5, '0')}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                      Student Email Address {isEditing && <span style={{ fontWeight: '500', color: '#94a3b8' }}>(Optional for school students)</span>}
                    </div>
                    {isEditing ? (
                      <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="student@example.com (optional)" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontFamily: 'monospace', color: selectedStudentProfile.email ? '#0f172a' : '#94a3b8', marginTop: '3px', fontWeight: '600' }}>
                        {selectedStudentProfile.email || 'None (School Student)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. School Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <School size={14} style={{ color: '#059669' }} /> 2. School Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>School Name</div>
                    {isEditing ? (
                      <input type="text" value={editForm.school || ''} onChange={e => setEditForm({ ...editForm, school: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '750', color: '#0f172a', marginTop: '3px' }}>{selectedStudentProfile.school || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>School Branch</div>
                    {isEditing ? (
                      <input type="text" value={editForm.school_branch || ''} onChange={e => setEditForm({ ...editForm, school_branch: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.school_branch || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Class / Standard</div>
                    {isEditing ? (
                      <select value={editForm.class_grade || ''} onChange={e => setEditForm({ ...editForm, class_grade: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="">Select Class</option>
                        {availableClasses.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        {editForm.class_grade && !availableClasses.includes(editForm.class_grade) && (
                          <option value={editForm.class_grade}>{editForm.class_grade}</option>
                        )}
                      </select>
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.class_grade || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Division / Section</div>
                    {isEditing ? (
                      <input type="text" value={editForm.division || ''} onChange={e => setEditForm({ ...editForm, division: e.target.value })} placeholder="e.g. Griffin, Auriga" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.division || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>PRN / Roll No.</div>
                    {isEditing ? (
                      <input type="text" value={editForm.prn || ''} onChange={e => setEditForm({ ...editForm, prn: e.target.value, roll_number: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.prn || selectedStudentProfile.roll_number || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Parent / Guardian Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: '#d97706' }} /> 3. Parent / Guardian Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Parent / Guardian Name</div>
                    {isEditing ? (
                      <input type="text" value={editForm.parent_name || ''} onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })} placeholder="Parent Full Name" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '750', color: '#0f172a', marginTop: '3px' }}>{selectedStudentProfile.parent_name || selectedStudentProfile.nominee_name || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Relationship</div>
                    {isEditing ? (
                      <select value={editForm.parent_relationship || 'Father'} onChange={e => setEditForm({ ...editForm, parent_relationship: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="Father">Father</option>
                        <option value="Mother">Mother</option>
                        <option value="Guardian">Guardian</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.parent_relationship || selectedStudentProfile.nominee_relationship || '—'}</div>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Parent 1 Email (Primary Login)</span>
                      <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Primary</span>
                    </div>
                    {isEditing ? (
                      <input type="email" required value={editForm.parent1_email || ''} onChange={e => setEditForm({ ...editForm, parent1_email: e.target.value })} placeholder="parent1@example.com" style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontFamily: 'monospace', fontWeight: '650', color: '#0f172a', marginTop: '3px' }}>
                        {selectedStudentProfile.parent1_email || selectedStudentProfile.parent_email || '—'}
                      </div>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Parent 2 Email (Secondary / Optional)</span>
                      <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>Secondary</span>
                    </div>
                    {isEditing ? (
                      <input type="email" value={editForm.parent2_email || ''} onChange={e => setEditForm({ ...editForm, parent2_email: e.target.value })} placeholder="parent2@example.com (optional)" style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontFamily: 'monospace', fontWeight: '650', color: selectedStudentProfile.parent2_email ? '#0f172a' : '#94a3b8', marginTop: '3px' }}>
                        {selectedStudentProfile.parent2_email || 'None'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Contact Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={14} style={{ color: '#0284c7' }} /> 4. Contact Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>WhatsApp Number</div>
                    {isEditing ? (
                      <input type="tel" value={editForm.parent_mobile || ''} onChange={e => setEditForm({ ...editForm, parent_mobile: e.target.value, phone: e.target.value })} placeholder="10-digit mobile" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '750', color: '#0f172a', marginTop: '3px' }}>{selectedStudentProfile.parent_mobile || selectedStudentProfile.phone || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Alternate Contact</div>
                    {isEditing ? (
                      <input type="tel" value={editForm.emergency_contact_alt_mobile || ''} onChange={e => setEditForm({ ...editForm, emergency_contact_alt_mobile: e.target.value })} placeholder="Alternate number" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.emergency_contact_alt_mobile || '—'}</div>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Residential Address</div>
                    {isEditing ? (
                      <textarea rows={2} value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} placeholder="Complete residential address" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '3px', boxSizing: 'border-box', lineHeight: 1.4 }} />
                    ) : (
                      <div style={{ lineHeight: 1.4, color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.address || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Medical Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1 / -1' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartPulse size={14} style={{ color: '#e11d48' }} /> 5. Medical Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Any Medical Condition?</div>
                    {isEditing ? (
                      <select value={editForm.has_medical_condition || 'No'} onChange={e => setEditForm({ ...editForm, has_medical_condition: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ fontWeight: '750', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: selectedStudentProfile.has_medical_condition === 'Yes' ? '#fee2e2' : '#f0fdf4', color: selectedStudentProfile.has_medical_condition === 'Yes' ? '#991b1b' : '#166534' }}>
                          {selectedStudentProfile.has_medical_condition === 'Yes' ? 'Yes (Condition Reported)' : 'No Medical Condition'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Known Allergies</div>
                    {isEditing ? (
                      <input type="text" value={editForm.known_allergies || ''} onChange={e => setEditForm({ ...editForm, known_allergies: e.target.value })} placeholder="e.g. Dust, Food allergies, or 'No'" style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#334155', marginTop: '3px' }}>{selectedStudentProfile.known_allergies || 'No allergies reported'}</div>
                    )}
                  </div>

                  {/* Prominent Medical Details Box when Yes */}
                  {((isEditing && editForm.has_medical_condition === 'Yes') || (!isEditing && selectedStudentProfile.has_medical_condition === 'Yes')) && (
                    <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991b1b', fontWeight: '800', fontSize: '12.5px', marginBottom: '6px' }}>
                        <AlertTriangle size={15} style={{ color: '#dc2626' }} /> Specific Medical Condition Details & Care Instructions
                      </div>
                      {isEditing ? (
                        <textarea rows={3} value={editForm.medical_conditions || ''} onChange={e => setEditForm({ ...editForm, medical_conditions: e.target.value })} placeholder="Please provide specific details: asthma, medications, dietary restrictions, mobility needs..." style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #f87171', borderRadius: '6px', fontSize: '12.5px', boxSizing: 'border-box', background: '#ffffff', color: '#0f172a' }} />
                      ) : (
                        <div style={{ color: '#7f1d1d', lineHeight: 1.5, fontSize: '12.5px', fontWeight: '600' }}>
                          {selectedStudentProfile.medical_conditions || selectedStudentProfile.med_details || 'Reported "Yes" without specific description.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Payment Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} style={{ color: '#8b5cf6' }} /> 6. Payment Information
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Payment Status</div>
                    {isEditing ? (
                      <select value={editForm.payment_status || 'pending'} onChange={e => setEditForm({ ...editForm, payment_status: e.target.value })} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', marginTop: '3px', boxSizing: 'border-box' }}>
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{
                          fontWeight: '750',
                          fontSize: '11px',
                          padding: '3px 9px',
                          borderRadius: '4px',
                          textTransform: 'capitalize',
                          background: selectedStudentProfile.payment_status === 'verified' ? '#dcfce7' : (selectedStudentProfile.payment_status === 'submitted' ? '#eff6ff' : '#fef3c7'),
                          color: selectedStudentProfile.payment_status === 'verified' ? '#166534' : (selectedStudentProfile.payment_status === 'submitted' ? '#1d4ed8' : '#92400e')
                        }}>
                          {selectedStudentProfile.payment_status || 'Pending'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Payment Screenshot / Receipt
                    </div>
                    {(selectedStudentProfile.payment_screenshot_url || editForm.payment_screenshot_url) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <a
                          href={editForm.payment_screenshot_url || selectedStudentProfile.payment_screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '12px',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={13} /> View Existing Receipt
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>No payment receipt attached.</div>
                    )}

                    {isEditing && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => receiptFileInputRef.current?.click()}
                          disabled={isUploadingReceipt}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '650',
                            color: '#334155',
                            cursor: isUploadingReceipt ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Upload size={13} /> {isUploadingReceipt ? 'Uploading…' : 'Upload / Replace Receipt File'}
                        </button>
                        <input
                          type="text"
                          value={editForm.payment_screenshot_url || ''}
                          onChange={e => setEditForm({ ...editForm, payment_screenshot_url: e.target.value })}
                          placeholder="Or paste receipt URL / Google Drive link"
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 7. Parent Consent & Digital Signature */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={14} style={{ color: '#16a34a' }} /> 7. Consent & Digital Signature
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Consent Status</div>
                    {isEditing ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer', fontWeight: '700' }}>
                        <input type="checkbox" checked={Boolean(editForm.parent_consent_confirmed)} onChange={e => setEditForm({ ...editForm, parent_consent_confirmed: e.target.checked })} />
                        <span>Parent / Guardian Consent Confirmed</span>
                      </label>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ fontWeight: '750', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: selectedStudentProfile.parent_consent_confirmed ? '#dcfce7' : '#f1f5f9', color: selectedStudentProfile.parent_consent_confirmed ? '#166534' : '#64748b' }}>
                          {selectedStudentProfile.parent_consent_confirmed ? '✓ Confirmed by Parent' : 'Pending Confirmation'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Digital Signature
                    </div>
                    {(selectedStudentProfile.digital_signature_url || editForm.digital_signature_url) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <a
                          href={editForm.digital_signature_url || selectedStudentProfile.digital_signature_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            color: '#166534',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '12px',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={13} /> View Digital Signature
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>No digital signature attached.</div>
                    )}

                    {isEditing && (
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => signatureFileInputRef.current?.click()}
                          disabled={isUploadingSignature}
                          style={{
                            padding: '6px 12px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '650',
                            color: '#334155',
                            cursor: isUploadingSignature ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Upload size={13} /> {isUploadingSignature ? 'Uploading…' : 'Upload / Replace Signature File'}
                        </button>
                        <input
                          type="text"
                          value={editForm.digital_signature_url || ''}
                          onChange={e => setEditForm({ ...editForm, digital_signature_url: e.target.value })}
                          placeholder="Or paste signature URL / Google Drive link"
                          style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Collapsible Consent Declaration */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowFullConsentText(!showFullConsentText)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#475569',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {showFullConsentText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showFullConsentText ? 'Hide Consent Declaration' : 'View Consent Declaration Text'}
                    </button>
                    {showFullConsentText && (
                      <div style={{ marginTop: '8px' }}>
                        {isEditing ? (
                          <textarea
                            rows={4}
                            value={editForm.parent_consent_text || ''}
                            onChange={e => setEditForm({ ...editForm, parent_consent_text: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', lineHeight: 1.4, boxSizing: 'border-box', background: '#ffffff' }}
                          />
                        ) : (
                          <div style={{ maxHeight: '140px', overflowY: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', lineHeight: 1.45, color: '#475569', whiteSpace: 'pre-line' }}>
                            {selectedStudentProfile.parent_consent_text || DEFAULT_LAP_CONSENT_TEXT}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 8. Additional Registration Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1 / -1' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '7px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} style={{ color: '#475569' }} /> 8. Additional Registration & System Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Database Record ID</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: '750', color: '#0f172a', marginTop: '2px' }}>#{selectedStudentProfile.id}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Current Batch Allocation</div>
                    <div style={{ fontWeight: '700', color: selectedStudentProfile.batch_name ? '#15803d' : '#94a3b8', marginTop: '2px' }}>
                      {selectedStudentProfile.batch_name || 'Not Enrolled in Batch'}
                    </div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Squad & Room</div>
                    <div style={{ fontWeight: '700', color: '#334155', marginTop: '2px' }}>
                      Squad: {selectedStudentProfile.squad || '—'} | Room: {selectedStudentProfile.room || '—'}
                    </div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Registration Date</div>
                    <div style={{ fontWeight: '700', color: '#334155', marginTop: '2px' }}>
                      {selectedStudentProfile.created_at ? new Date(selectedStudentProfile.created_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            {isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '650', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    background: primaryOrange,
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '750',
                    fontSize: '13px',
                    cursor: isSavingAccount ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                  }}
                >
                  {isSavingAccount ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {isSavingAccount ? 'Saving Changes…' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        ) : null}
      </Modal>

      {/* ── View All Guardians Modal (when >2 guardians linked) ── */}
      <Modal open={!!guardiansModalStudent} onClose={() => setGuardiansModalStudent(null)} title={`All Linked Guardians — ${guardiansModalStudent?.name || ''}`}>
        {guardiansModalStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {guardiansModalStudent.parents && guardiansModalStudent.parents.map((p, idx) => (
              <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontWeight: '750', fontSize: '13px', color: '#0f172a' }}>
                  {p.is_primary ? 'Primary Guardian: ' : 'Guardian: '} {p.name}
                </div>
                <div style={{ fontSize: '12px', color: '#2563eb', fontFamily: 'monospace', marginTop: '2px' }}>
                  Email: {p.email}
                </div>
                {p.phone && (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    Phone: {p.phone}
                  </div>
                )}
                {p.relationship && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Relationship: {p.relationship}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

    </div>
  )
}
