import React, { useState, useEffect } from 'react'
import { Plus, Search, Trash2, RefreshCw, BookOpen, Eye, Edit2, X, Bell, User, Mail, Phone, Award } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

// Local Modal helper
function Modal({ open, onClose, title, children, size = '' }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxWidth: size === 'lg' ? '720px' : '540px' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #f1f5f9', padding: '20px 24px', flexShrink: 0 }}>
          <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: '850', color: '#0f172a' }}>{title}</h3>
          <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 6, background: '#f1f5f9', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

const LTC_DESIGNATION_OPTIONS = [
  "Senior Director",
  "Director",
  "Senior Manager (Agri)",
  "Associate Director Academics",
  "Manager -Academics",
  "Manager -Operations",
  "Assit. Manager Agri.",
  "Senior Instructor Patriotism",
  "Back Office Executive",
  "Instructor Patriotism",
  "Security Supervisor",
  "Nursing staff",
  "Senior Instructor Yoga",
  "Instructor Yoga",
  "Senior Instructor Sports",
  "Squad Coordinator",
  "IT Engineer",
  "Agri-Supervisor",
  "Doctor",
  "Head Golf & Adventure",
  "Stores Executive"
];

export default function LtcMembersModule({
  ltcMembers,
  ltcMemberPg,
  ltcMemberSearch,
  setLtcMemberSearch,
  setIsLtcMemberModalOpen,
  handleDeleteUser,
  fetchUsers,
  PaginationBar,
  apiFetch,
  toast,
  hideTitle = false
}) {
  const { t } = useLanguage()
  const [activeDropdownId, setActiveDropdownId] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedMemberForView, setSelectedMemberForView] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedMemberForEdit, setSelectedMemberForEdit] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    personal_email: '',
    faculty_id: '',
    phone: '',
    gender: '',
    designation: '',
    status: 'Active',
    password: ''
  })
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Quick filters
  const [genderFilter, setGenderFilter] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')

  const primaryBlue = '#154388'

  useEffect(() => {
    const closeAll = () => setActiveDropdownId(null)
    document.addEventListener('click', closeAll)
    return () => document.removeEventListener('click', closeAll)
  }, [])

  const handleEditClick = (u) => {
    setSelectedMemberForEdit(u)
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      personal_email: u.personal_email || '',
      faculty_id: u.faculty_id || '',
      phone: u.phone || '',
      gender: u.gender || '',
      designation: u.designation || '',
      status: u.status || 'Active',
      password: ''
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!selectedMemberForEdit) return
    
    try {
      const resProfile = await apiFetch(`/api/admin/users/${selectedMemberForEdit.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (resProfile?.ok) {
        toast('LTC Member details updated successfully.', 'success')
        setIsEditModalOpen(false)
        if (fetchUsers) fetchUsers()
      } else {
        const errData = await resProfile.json()
        toast(errData.message || 'Failed to update LTC Member details.', 'error')
      }
    } catch (err) {
      toast('Error updating LTC Member: ' + err.message, 'error')
    }
  }

  const handleViewClick = async (u) => {
    setIsLoadingProfile(true)
    setIsViewModalOpen(true)
    setSelectedMemberForView(null)
    try {
      if (!apiFetch) throw new Error("API Fetch service is not initialized")
      const res = await apiFetch(`/api/admin/users/${u.id}/profile`)
      if (res?.ok) {
        const data = await res.json()
        setSelectedMemberForView(data.user)
      } else {
        toast('Failed to fetch LTC Member profile.', 'error')
        setIsViewModalOpen(false)
      }
    } catch (err) {
      toast('Error loading profile: ' + err.message, 'error')
      setIsViewModalOpen(false)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'L'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    }
    return name.charAt(0).toUpperCase()
  }

  // Get unique designations for filter
  const designationsList = [...new Set(ltcMembers.map(m => m.designation).filter(Boolean))].sort()

  // Apply designation and gender filters locally
  const filteredPaginated = ltcMemberPg.paginated.filter(u => {
    if (genderFilter && u.gender !== genderFilter) return false
    if (designationFilter && u.designation !== designationFilter) return false
    return true
  })

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Block */}
      {!hideTitle && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>{t("LTC Coordinators")}</h2>
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginTop: '4px', margin: 0 }}>
              {ltcMembers.length} {t("LTC administration team members")}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              className="btn hover:bg-slate-50" 
              onClick={fetchUsers} 
              style={{ padding: '9px 12px', background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={15} />
            </button>
            <button className="btn" onClick={() => setIsLtcMemberModalOpen(true)} style={{ background: primaryBlue, color: '#ffffff', borderRadius: '12px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13.5px' }}>
              <Plus size={16} /> {t("Add LTC Member")}
            </button>
          </div>
        </div>
      )}

      {/* Filter Card */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.01)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center'
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder={t("Search name, email or employee ID...")}
            value={ltcMemberSearch}
            onChange={e => setLtcMemberSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#0f172a'
            }}
            className="focus:border-[#154388] focus:bg-white"
          />
        </div>

        {/* Designation filter */}
        <select 
          value={designationFilter} 
          onChange={e => setDesignationFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            outline: 'none',
            color: '#475569',
            flex: '1 1 140px',
            cursor: 'pointer'
          }}
        >
          <option value="">{t("All Designations")}</option>
          {designationsList.map(desg => (
            <option key={desg} value={desg}>{desg}</option>
          ))}
        </select>

        {/* Gender filter */}
        <select 
          value={genderFilter} 
          onChange={e => setGenderFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            outline: 'none',
            color: '#475569',
            flex: '1 1 120px',
            cursor: 'pointer'
          }}
        >
          <option value="">{t("All Genders")}</option>
          <option value="Male">{t("Male")}</option>
          <option value="Female">{t("Female")}</option>
          <option value="Other">{t("Other")}</option>
        </select>

        {/* Reset filter */}
        <button 
          onClick={() => {
            setGenderFilter('')
            setDesignationFilter('')
            setLtcMemberSearch('')
          }}
          title={t("Reset Filters")}
          style={{ padding: '8px', border: '1px solid #e2e8f0', background: '#ffffff', color: '#64748b', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          className="hover:bg-slate-50 hover:text-slate-800"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Directory Table Card */}
      <div 
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01), 0 10px 30px rgba(0,0,0,0.02)',
          overflow: 'hidden'
        }}
      >
        {filteredPaginated.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ background: '#f0f7ff', color: primaryBlue, width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', margin: 0 }}>{t("No LTC members found matching the criteria.")}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }} className="no-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <tr>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', width: '60px' }}>{t("S.No.")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Name")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Employee ID")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Official Email")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Contact")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Designation")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Gender")}</th>
                  <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', textAlign: 'right' }}>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPaginated.map((u, index) => (
                  <tr 
                    key={u.id} 
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                    className="hover:bg-slate-50/50"
                  >
                    {/* S.No. */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                      {((ltcMemberPg?.page || 1) - 1) * 50 + index + 1}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ fontWeight: '750', fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{u.name}</span>
                        {u.role === 'superadmin_readonly' && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            whiteSpace: 'nowrap',
                            letterSpacing: '0.2px'
                          }}>
                            Read-Only Super Admin
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Emp ID */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{u.faculty_id || '—'}</td>

                    {/* Email */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{u.email}</td>

                    {/* Mobile */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{u.phone || '—'}</td>

                    {/* Designation */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: '#334155' }}>{t(u.designation) || '—'}</td>

                    {/* Gender */}
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{t(u.gender) || '—'}</td>

                    {/* Actions */}
                    <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn hover:bg-slate-50" 
                          onClick={() => handleViewClick(u)} 
                          style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                        >
                          <Eye size={12} /> {t("View")}
                        </button>
                        <button 
                          className="btn hover:bg-slate-50" 
                          onClick={() => handleEditClick(u)} 
                          style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#475569', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}
                        >
                          <Edit2 size={12} /> {t("Edit")}
                        </button>
                        <button
                          className="btn hover:bg-red-50"
                          style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                          onClick={() => handleDeleteUser(u.id, 'LTC Member')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination container */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px' }}>
          <PaginationBar
            page={ltcMemberPg.page}
            totalPages={ltcMemberPg.totalPages}
            total={ltcMemberPg.total}
            setPage={p => ltcMemberPg.setPage(p)}
          />
        </div>
      </div>

      {/* View Modal */}
      <Modal open={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="LTC Member Profile Details" size="lg">
        {isLoadingProfile ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
            <div className="spinner spinner-sm" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Fetching profile information...</p>
          </div>
        ) : selectedMemberForView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '13px' }}>
            {/* Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #154388 0%, #1e40af 100%)',
              padding: '20px 24px',
              borderRadius: '16px',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#ffffff',
                color: '#154388',
                fontSize: '24px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                {getInitials(selectedMemberForView.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                <h4 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>
                  {selectedMemberForView.name}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', fontWeight: '750', fontSize: '9px', padding: '2px 8px', borderRadius: '4px' }}>
                    LTC MEMBER
                  </span>
                  {selectedMemberForView.faculty_id && (
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
                      ID: {selectedMemberForView.faculty_id}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Professional Details */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <Award size={13} style={{ display: 'inline', marginRight: '4px' }} /> Professional Details
                </h5>
                <div className="grid grid-cols-2 gap-2" style={{ fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Designation")}</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedMemberForView.designation) || t('LTC Member')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Gender")}</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedMemberForView.gender) || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Status")}</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedMemberForView.status || 'Active')}</div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <Mail size={13} style={{ display: 'inline', marginRight: '4px' }} /> Contact Details
                </h5>
                <div className="space-y-2" style={{ fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Official Email</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px', wordBreak: 'break-all' }}>{selectedMemberForView.email || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Personal Email</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px', wordBreak: 'break-all' }}>{selectedMemberForView.personal_email || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Contact Number</div>
                    <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedMemberForView.phone || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '8px' }}>
              <button className="btn hover:bg-slate-50" onClick={() => setIsViewModalOpen(false)} style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                {t("Close Details")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Edit Modal */}
      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit LTC Member Profile" size="md">
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Full Name</label>
            <input
              type="text"
              required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Employee ID</label>
              <input
                type="text"
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                value={editForm.faculty_id}
                onChange={e => setEditForm({ ...editForm, faculty_id: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Designation</label>
              {(() => {
                const isCustom = editForm.isCustomDesignation || (editForm.designation && !LTC_DESIGNATION_OPTIONS.includes(editForm.designation));
                const selectValue = isCustom ? "Other" : (editForm.designation || "");

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select
                      value={selectValue}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'Other') {
                          setEditForm(f => ({ ...f, designation: '', isCustomDesignation: true }));
                        } else {
                          setEditForm(f => ({ ...f, designation: val, isCustomDesignation: false }));
                        }
                      }}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white', cursor: 'pointer' }}
                    >
                      <option value="">Select Designation</option>
                      {LTC_DESIGNATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="Other">Other (Type custom designation...)</option>
                    </select>

                    {isCustom && (
                      <input
                        type="text"
                        placeholder="Enter custom designation"
                        value={editForm.designation || ''}
                        onChange={e => setEditForm(f => ({ ...f, designation: e.target.value, isCustomDesignation: true }))}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '13px' }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Official Email</label>
              <input
                type="email"
                required
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                value={editForm.email}
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Personal Email</label>
              <input
                type="email"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                value={editForm.personal_email}
                onChange={e => setEditForm({ ...editForm, personal_email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Contact Number</label>
              <input
                type="text"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                value={editForm.phone}
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Gender</label>
              <select
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white' }}
                value={editForm.gender}
                onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Status</label>
              <select
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white' }}
                value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Change Password (optional)</label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                value={editForm.password}
                onChange={e => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '10px' }}>
            <button type="button" className="btn hover:bg-slate-50" onClick={() => setIsEditModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" className="btn" style={{ padding: '8px 16px', background: primaryBlue, color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
