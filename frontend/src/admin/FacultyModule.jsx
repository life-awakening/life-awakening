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

export default function FacultyModule({
  faculties,
  facultyPg,
  facultySearch,
  setFacultySearch,
  setIsFacultyModalOpen,
  handleUpdatePanel,
  handleViewFeedback,
  handleDeleteUser,
  fetchUsers,
  PaginationBar,
  isDesktop = false,
  facultyDivFilter = '',
  setFacultyDivFilter,
  facultyFacFilter = '',
  setFacultyFacFilter,
  facultySchoolFilter = '',
  setFacultySchoolFilter,
  facultyDeptFilter = '',
  setFacultyDeptFilter,
  facultyTypeFilter = '',
  setFacultyTypeFilter,
  availableFacultyDivisions = [],
  availableFacultyFaculties = [],
  availableFacultySchools = [],
  availableFacultyDepartments = [],
  apiFetch,
  toast,
  hideTitle = false
}) {
  const { t } = useLanguage()
  const [activeDropdownId, setActiveDropdownId] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedFacultyForView, setSelectedFacultyForView] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedFacultyForEdit, setSelectedFacultyForEdit] = useState(null)
  const [editForm, setEditForm] = useState({ division: '', panel: '' })
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  const primaryBlue = '#154388'

  useEffect(() => {
    const closeAll = () => setActiveDropdownId(null)
    document.addEventListener('click', closeAll)
    return () => document.removeEventListener('click', closeAll)
  }, [])

  const handleEditClick = (u) => {
    setSelectedFacultyForEdit(u)
    setEditForm({
      name: u.name || '',
      first_name: u.first_name || '',
      middle_name: u.middle_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      personal_email: u.personal_email || '',
      faculty_id: u.faculty_id || '',
      phone: u.phone || '',
      gender: u.gender || '',
      designation: u.designation || '',
      department: u.department || '',
      school: u.school || '',
      division: u.division || '',
      panel: u.panel || '',
      status: u.status || 'Active',
      password: ''
    })
    setIsEditModalOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!selectedFacultyForEdit) return
    
    try {
      const resProfile = await apiFetch(`/api/admin/users/${selectedFacultyForEdit.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (resProfile?.ok) {
        toast('Faculty details updated successfully.', 'success')
        setIsEditModalOpen(false)
        if (fetchUsers) fetchUsers()
      } else {
        const errData = await resProfile.json()
        toast(errData.message || 'Failed to update faculty details.', 'error')
      }
    } catch (err) {
      toast('Error updating faculty: ' + err.message, 'error')
    }
  }

  const handleViewClick = async (u) => {
    setIsLoadingProfile(true)
    setIsViewModalOpen(true)
    setSelectedFacultyForView(null)
    try {
      if (!apiFetch) {
        throw new Error("API Fetch service is not initialized")
      }
      const res = await apiFetch(`/api/admin/users/${u.id}/profile`)
      if (res?.ok) {
        const data = await res.json()
        setSelectedFacultyForView(data.user)
      } else {
        if (toast) toast('Failed to fetch faculty profile.', 'error')
        setIsViewModalOpen(false)
      }
    } catch (err) {
      if (toast) toast('Error loading profile: ' + err.message, 'error')
      setIsViewModalOpen(false)
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const getInitials = (name) => {
    if (!name) return 'F'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    }
    return name.charAt(0).toUpperCase()
  }

  const renderModuleView = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        
        {/* Header Block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '850', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>{t("Faculty Directory")}</h2>
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', marginTop: '4px', margin: 0 }}>
              {faculties.length} {t("faculty members registered in the database")}
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
            <button className="btn" onClick={() => setIsFacultyModalOpen(true)} style={{ background: primaryBlue, color: '#ffffff', borderRadius: '12px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13.5px' }}>
              <Plus size={16} /> {t("Add Faculty")}
            </button>
          </div>
        </div>

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
          {/* Search box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '180px' }}>
            <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, paddingLeft: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: '#94a3b8' }}>
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder={t("Search by name, email, department...")}
              value={facultySearch}
              onChange={e => setFacultySearch(e.target.value)}
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

          {/* Division select */}
          <select
            value={facultyDivFilter}
            onChange={e => {
              setFacultyDivFilter(e.target.value)
              setFacultyFacFilter('')
              setFacultySchoolFilter('')
              setFacultyDeptFilter('')
            }}
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
            <option value="">{t("All Divisions")}</option>
            <option value="UNASSIGNED">{t("Unassigned / No Division")}</option>
            {availableFacultyDivisions.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          {/* Faculty select */}
          <select
            value={facultyFacFilter}
            onChange={e => {
              setFacultyFacFilter(e.target.value)
              setFacultySchoolFilter('')
              setFacultyDeptFilter('')
            }}
            disabled={!facultyDivFilter}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#475569',
              flex: '1 1 120px',
              cursor: 'pointer',
              opacity: !facultyDivFilter ? 0.6 : 1
            }}
          >
            <option value="">{t("All Faculties")}</option>
            {availableFacultyFaculties.map(fac => (
              <option key={fac} value={fac}>{fac}</option>
            ))}
          </select>

          {/* School select */}
          <select
            value={facultySchoolFilter}
            onChange={e => {
              setFacultySchoolFilter(e.target.value)
              setFacultyDeptFilter('')
            }}
            disabled={!facultyFacFilter}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#475569',
              flex: '1 1 120px',
              cursor: 'pointer',
              opacity: !facultyFacFilter ? 0.6 : 1
            }}
          >
            <option value="">{t("All Schools")}</option>
            {availableFacultySchools.map(sch => (
              <option key={sch} value={sch}>{sch}</option>
            ))}
          </select>

          {/* Dept select */}
          <select
            value={facultyDeptFilter}
            onChange={e => setFacultyDeptFilter(e.target.value)}
            disabled={!facultySchoolFilter}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#475569',
              flex: '1 1 120px',
              cursor: 'pointer',
              opacity: !facultySchoolFilter ? 0.6 : 1
            }}
          >
            <option value="">{t("All Departments")}</option>
            {availableFacultyDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Type select */}
          <select
            value={facultyTypeFilter}
            onChange={e => setFacultyTypeFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              outline: 'none',
              color: '#475569',
              flex: '1 1 100px',
              cursor: 'pointer'
            }}
          >
            <option value="">{t("All Types")}</option>
            <option value="primary">{t("Primary")}</option>
            <option value="secondary">{t("Secondary")}</option>
          </select>

          {/* Reset Filters */}
          <button 
            onClick={() => {
              setFacultyDivFilter('')
              setFacultyFacFilter('')
              setFacultySchoolFilter('')
              setFacultyDeptFilter('')
              setFacultyTypeFilter('')
              setFacultySearch('')
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
          {facultyPg.paginated.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ background: '#f0f7ff', color: primaryBlue, width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={20} />
              </div>
              <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', margin: 0 }}>{t("No faculty found matching the criteria.")}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }} className="no-scrollbar">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', width: '60px' }}>{t("S.No.")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Faculty")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Official Email")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Mobile")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Affiliation")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Div / Panel")}</th>
                    <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', textAlign: 'right' }}>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {facultyPg.paginated.map((u, index) => (
                    <tr 
                      key={u.id} 
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      className="hover:bg-slate-50/50"
                    >
                      {/* S.No. */}
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                        {((facultyPg?.page || 1) - 1) * 50 + index + 1}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '12px 20px' }}>
                        <div>
                          <div style={{ fontWeight: '750', fontSize: '13.5px', color: '#0f172a', whiteSpace: 'nowrap' }}>{u.name}</div>
                          {u.faculty_id && <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '1.5px' }}>ID: {u.faculty_id}</div>}
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{u.email}</td>

                      {/* Mobile */}
                      <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569' }}>{u.phone || '—'}</td>

                      {/* Affiliation */}
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>{t(u.school) || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{t(u.department) || '—'}</div>
                      </td>

                      {/* Div / Panel */}
                      <td style={{ padding: '12px 20px' }}>
                        {u.division ? (
                          <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                              {t(u.division).replace(/Division\s+/i, '')}
                            </span>
                            {u.panel && (
                              <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: '4px', fontWeight: '750', fontSize: '11px', color: primaryBlue }}>
                                {t(u.panel)}
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </td>



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
                            className="btn hover:bg-slate-50" 
                            onClick={() => handleViewFeedback(u.id, u.name)} 
                            style={{ padding: '6px 10px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11.5px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                          >
                            {t("Feedback")}
                          </button>
                          <button
                            className="btn hover:bg-red-50"
                            style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #fee2e2', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                            onClick={() => handleDeleteUser(u.id, 'faculty')}
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

          {/* Pagination bar integration */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px' }}>
            <PaginationBar
              page={facultyPg.page}
              totalPages={facultyPg.totalPages}
              total={facultyPg.total}
              setPage={p => facultyPg.setPage(p)}
            />
          </div>
        </div>

        {/* View Modal */}
        <Modal open={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={t("Faculty Profile Details")} size="lg">
          {isLoadingProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '12px' }}>
              <div className="spinner spinner-sm" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>{t("Fetching profile information...")}</p>
            </div>
          ) : selectedFacultyForView ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  {getInitials(selectedFacultyForView.name)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: '850', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedFacultyForView.salutation ? `${selectedFacultyForView.salutation} ` : ''}
                    {selectedFacultyForView.first_name ? `${selectedFacultyForView.first_name} ${selectedFacultyForView.middle_name ? selectedFacultyForView.middle_name + ' ' : ''}${selectedFacultyForView.last_name || ''}` : selectedFacultyForView.name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', fontWeight: '750', fontSize: '9px', padding: '2px 8px', borderRadius: '4px' }}>
                      {t("FACULTY MEMBER")}
                    </span>
                    {selectedFacultyForView.faculty_id && (
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)' }}>
                        ID: {selectedFacultyForView.faculty_id}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Professional Info */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                    {t("Professional Info")}
                  </h5>
                  <div className="grid grid-cols-2 gap-2" style={{ fontSize: '12.5px' }}>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Designation")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedFacultyForView.designation) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("School")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedFacultyForView.school) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Department")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedFacultyForView.department) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Division")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{t(selectedFacultyForView.division) || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                    {t("Contact Info")}
                  </h5>
                  <div className="space-y-2" style={{ fontSize: '12.5px' }}>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Email Address")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px', wordBreak: 'break-all' }}>{selectedFacultyForView.email || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{t("Mobile Number")}</div>
                      <div style={{ fontWeight: '700', color: '#475569', marginTop: '2px' }}>{selectedFacultyForView.phone || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button className="btn hover:bg-slate-50" onClick={() => setIsViewModalOpen(false)} style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                  {t("Close Details")}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t("Failed to load profile. Please try again.")}
            </div>
          )}
        </Modal>

        {/* Edit Modal */}
        <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={t("Edit Faculty Profile")} size="lg">
          {selectedFacultyForEdit && (
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("First Name")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.first_name || ''}
                    onChange={e => {
                      const fn = e.target.value;
                      const computedName = [fn, editForm.middle_name, editForm.last_name].filter(Boolean).join(' ');
                      setEditForm({ ...editForm, first_name: fn, name: computedName });
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Middle Name")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.middle_name || ''}
                    onChange={e => {
                      const mn = e.target.value;
                      const computedName = [editForm.first_name, mn, editForm.last_name].filter(Boolean).join(' ');
                      setEditForm({ ...editForm, middle_name: mn, name: computedName });
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Last Name")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.last_name || ''}
                    onChange={e => {
                      const ln = e.target.value;
                      const computedName = [editForm.first_name, editForm.middle_name, ln].filter(Boolean).join(' ');
                      setEditForm({ ...editForm, last_name: ln, name: computedName });
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Full Name")}</label>
                <input
                  type="text"
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                  value={editForm.name || ''}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Employee ID")}</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.faculty_id}
                    onChange={e => setEditForm({ ...editForm, faculty_id: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Designation")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.designation}
                    onChange={e => setEditForm({ ...editForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Official Email")}</label>
                  <input
                    type="email"
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Personal Email")}</label>
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
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Contact Number")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Gender")}</label>
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
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("School")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.school}
                    onChange={e => setEditForm({ ...editForm, school: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Department")}</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.department}
                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Division")}</label>
                  <input
                    type="text"
                    placeholder="e.g. Division A"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.division}
                    onChange={e => setEditForm({ ...editForm, division: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Assigned Panel")}</label>
                  {(() => {
                    const optionsSet = new Set();
                    (faculties || []).forEach(f => { if (f.panel && f.panel.trim()) optionsSet.add(f.panel.trim()); });
                    if (editForm?.panel && editForm.panel.trim()) optionsSet.add(editForm.panel.trim());
                    const dynamicPanelsList = Array.from(optionsSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                    return (
                      <>
                        <input
                          type="text"
                          list="faculty-panel-list-options"
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white' }}
                          value={editForm.panel || ''}
                          onChange={e => setEditForm({ ...editForm, panel: e.target.value })}
                          placeholder="Select or enter panel..."
                        />
                        <datalist id="faculty-panel-list-options">
                          {dynamicPanelsList.map(p => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Account Status")}</label>
                  <select
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: 'white', cursor: 'pointer' }}
                    value={editForm.status}
                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="Active">{t("Active")}</option>
                    <option value="Inactive">{t("Inactive")}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '750', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{t("Change Password")}</label>
                  <input
                    type="password"
                    placeholder={t("Leave blank to keep current")}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none' }}
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '10px' }}>
                <button type="button" className="btn hover:bg-slate-50" onClick={() => setIsEditModalOpen(false)} style={{ padding: '8px 14px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>{t("Cancel")}</button>
                <button type="submit" className="btn" style={{ padding: '8px 16px', background: primaryBlue, color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>{t("Save Changes")}</button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    )
  }

  return renderModuleView()
}
