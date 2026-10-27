import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Search, Trash2, RefreshCw, GraduationCap, X, Eye, Edit2,
  User, Mail, Phone, MapPin, Shield, CheckCircle2, XCircle, FileCheck,
  School, ChevronLeft, ChevronRight, Users, ExternalLink, Layers, Check
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
          maxHeight: '90vh',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          maxWidth: size === 'lg' ? '780px' : '540px',
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
        student_id: `LA-${String(u.id).padStart(5, '0')}`,
        name: u.name,
        class_grade: u.class_grade || '—',
        school: u.school || null,
        school_branch: u.school_branch || null,
        roll_number: u.roll_number || null,
        division: u.division || null,
        guardian_name: u.nominee_name || null,
        guardian_relationship: u.nominee_relationship || null,
        parent1_email: u.parent_email || null,
        parent2_email: null,
        parents_linked: u.parent_email ? 1 : 0,
        parents: u.parent_email ? [{ email: u.parent_email, name: u.nominee_name || 'Parent', relationship: u.nominee_relationship || 'Parent' }] : [],
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

  // View Student Profile
  const handleViewProfile = async (studentId) => {
    setIsLoadingProfile(true)
    setIsProfileModalOpen(true)
    setSelectedStudentProfile(null)
    setIsEditing(false)
    try {
      const res = await apiFetch(`/api/admin/users/${studentId}/profile`)
      if (res && res.ok) {
        const data = await res.json()
        const p1Email = data.user.parent1_email || (data.user.parents && data.user.parents[0]?.email) || data.user.parent_email || ''
        const p2Email = data.user.parent2_email || (data.user.parents && data.user.parents[1]?.email) || ''
        setSelectedStudentProfile(data.user)
        setEditForm({
          name: data.user.name || '',
          class_grade: data.user.class_grade || '',
          school: data.user.school || '',
          school_branch: data.user.school_branch || '',
          roll_number: data.user.roll_number || '',
          division: data.user.division || '',
          phone: data.user.phone || '',
          parent_mobile: data.user.parent_mobile || '',
          emergency_contact_alt_mobile: data.user.emergency_contact_alt_mobile || '',
          nominee_name: data.user.nominee_name || '',
          nominee_relationship: data.user.nominee_relationship || '',
          parent_email: p1Email,
          parent1_email: p1Email,
          parent2_email: p2Email,
          address: data.user.address || '',
          dob: data.user.dob ? String(data.user.dob).slice(0, 10) : '',
          gender: data.user.gender || '',
          blood_group: data.user.blood_group || '',
          payment_status: data.user.payment_status || 'pending',
          parent_consent_confirmed: data.user.parent_consent_confirmed || false
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

    setIsSavingAccount(true)
    try {
      const payload = {
        ...editForm,
        parent_email: p1 || null,
        parent1_email: p1 || null,
        parent2_email: p2 || null
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
        const errData = await res.json()
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
          <option value="6th">Class 6th</option>
          <option value="7th">Class 7th</option>
          <option value="8th">Class 8th</option>
          <option value="9th">Class 9th</option>
          <option value="10th">Class 10th</option>
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
                          {st.student_id || `LA-${String(st.id).padStart(5, '0')}`}
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
      <Modal open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="Student Profile & Parent Information" size="lg">
        {isLoadingProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
            <div className="spinner spinner-sm" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Fetching profile information…</p>
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
              flexWrap: 'wrap'
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
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
              }}>
                {getInitials(selectedStudentProfile.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '200px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>
                  {selectedStudentProfile.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '750', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                    Student ID: {selectedStudentProfile.student_display_id || `LA-${String(selectedStudentProfile.id).padStart(5, '0')}`}
                  </span>
                  {selectedStudentProfile.class_grade && (
                    <span style={{ fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                      Class {selectedStudentProfile.class_grade}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  background: isEditing ? '#ef4444' : '#ffffff',
                  color: isEditing ? '#ffffff' : '#154388',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {isEditing ? 'Cancel Edit' : 'Edit Details'}
              </button>
            </div>

            {/* Profile Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
              
              {/* School Information Block */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <School size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> School Information
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>School Name</div>
                    {isEditing ? (
                      <input type="text" value={editForm.school || ''} onChange={e => setEditForm({ ...editForm, school: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>{selectedStudentProfile.school || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>School Branch</div>
                    {isEditing ? (
                      <input type="text" value={editForm.school_branch || ''} onChange={e => setEditForm({ ...editForm, school_branch: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.school_branch || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Class / Standard</div>
                    {isEditing ? (
                      <select value={editForm.class_grade || ''} onChange={e => setEditForm({ ...editForm, class_grade: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}>
                        <option value="">Select Class</option>
                        <option value="6th">6th</option>
                        <option value="7th">7th</option>
                        <option value="8th">8th</option>
                        <option value="9th">9th</option>
                        <option value="10th">10th</option>
                      </select>
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.class_grade || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Roll Number</div>
                    {isEditing ? (
                      <input type="text" value={editForm.roll_number || ''} onChange={e => setEditForm({ ...editForm, roll_number: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.roll_number || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Division</div>
                    {isEditing ? (
                      <input type="text" value={editForm.division || ''} onChange={e => setEditForm({ ...editForm, division: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.division || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Parent Accounts Block */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Shield size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Linked Parent Accounts
                  </h5>
                  {isEditing && (
                    <span style={{ fontSize: '11px', color: '#ea580c', fontWeight: '700' }}>Editing Emails</span>
                  )}
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: '#0f172a', fontWeight: '750', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                        Parent 1 Email (Primary) <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={editForm.parent1_email || ''}
                        onChange={e => setEditForm({ ...editForm, parent1_email: e.target.value })}
                        placeholder="e.g. parent1@example.com"
                        style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', boxSizing: 'border-box' }}
                      />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Primary parent login and notification email.</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '10px', color: '#0f172a', fontWeight: '750', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                        Parent 2 Email (Secondary / Optional)
                      </label>
                      <input
                        type="email"
                        value={editForm.parent2_email || ''}
                        onChange={e => setEditForm({ ...editForm, parent2_email: e.target.value })}
                        placeholder="e.g. parent2@example.com (optional)"
                        style={{ width: '100%', padding: '6px 10px', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '12.5px', boxSizing: 'border-box' }}
                      />
                      <span style={{ fontSize: '10px', color: '#64748b' }}>Secondary parent login. Leave empty if only one parent.</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Parent 1 Display */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '750', fontSize: '12px', color: '#0f172a' }}>
                          Parent 1 (Primary)
                        </span>
                        <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          Primary
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#0f172a', fontFamily: 'monospace', marginTop: '3px', fontWeight: '600' }}>
                        {selectedStudentProfile.parent1_email || (selectedStudentProfile.parents && selectedStudentProfile.parents[0]?.email) || selectedStudentProfile.parent_email || '—'}
                      </div>
                      {selectedStudentProfile.parents && selectedStudentProfile.parents[0]?.phone && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Phone: {selectedStudentProfile.parents[0].phone}
                        </div>
                      )}
                    </div>

                    {/* Parent 2 Display */}
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '750', fontSize: '12px', color: '#0f172a' }}>
                          Parent 2 (Secondary)
                        </span>
                        <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                          Secondary
                        </span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: (selectedStudentProfile.parent2_email || (selectedStudentProfile.parents && selectedStudentProfile.parents[1]?.email)) ? '#0f172a' : '#94a3b8', fontFamily: 'monospace', marginTop: '3px', fontWeight: '600' }}>
                        {selectedStudentProfile.parent2_email || (selectedStudentProfile.parents && selectedStudentProfile.parents[1]?.email) || '—'}
                      </div>
                      {selectedStudentProfile.parents && selectedStudentProfile.parents[1]?.phone && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Phone: {selectedStudentProfile.parents[1].phone}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Personal & Contact Information */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <User size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Student Details & Contacts
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>WhatsApp Number</div>
                    {isEditing ? (
                      <input type="text" value={editForm.parent_mobile || ''} onChange={e => setEditForm({ ...editForm, parent_mobile: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.parent_mobile || selectedStudentProfile.phone || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Alternate Contact</div>
                    {isEditing ? (
                      <input type="text" value={editForm.emergency_contact_alt_mobile || ''} onChange={e => setEditForm({ ...editForm, emergency_contact_alt_mobile: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.emergency_contact_alt_mobile || '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Date of Birth</div>
                    {isEditing ? (
                      <input type="date" value={editForm.dob || ''} onChange={e => setEditForm({ ...editForm, dob: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.dob ? String(selectedStudentProfile.dob).slice(0, 10) : '—'}</div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Gender</div>
                    {isEditing ? (
                      <select value={editForm.gender || ''} onChange={e => setEditForm({ ...editForm, gender: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedStudentProfile.gender || '—'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status, Payment & Consent */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <FileCheck size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} /> Payment & Consent
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Payment Status</div>
                    {isEditing ? (
                      <select value={editForm.payment_status || 'pending'} onChange={e => setEditForm({ ...editForm, payment_status: e.target.value })} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', marginTop: '2px', boxSizing: 'border-box' }}>
                        <option value="pending">Pending</option>
                        <option value="submitted">Submitted</option>
                        <option value="verified">Verified</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ fontWeight: '750', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize', background: selectedStudentProfile.payment_status === 'verified' ? '#dcfce7' : '#fef3c7', color: selectedStudentProfile.payment_status === 'verified' ? '#166534' : '#92400e' }}>
                          {selectedStudentProfile.payment_status || 'Pending'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Parent Consent</div>
                    {isEditing ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editForm.parent_consent_confirmed} onChange={e => setEditForm({ ...editForm, parent_consent_confirmed: e.target.checked })} />
                        <span>Consent Confirmed</span>
                      </label>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <span style={{ fontWeight: '750', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize', background: selectedStudentProfile.parent_consent_confirmed ? '#eff6ff' : '#f1f5f9', color: selectedStudentProfile.parent_consent_confirmed ? '#1d4ed8' : '#64748b' }}>
                          {selectedStudentProfile.parent_consent_confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedStudentProfile.payment_screenshot_url && (
                    <div>
                      <a href={selectedStudentProfile.payment_screenshot_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ExternalLink size={12} /> View Payment Receipt
                      </a>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            {isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: '#ffffff', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAccount}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    background: primaryOrange,
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '700',
                    cursor: isSavingAccount ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSavingAccount ? 'Saving…' : 'Save Changes'}
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
