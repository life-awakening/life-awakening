import React, { useState, useEffect } from 'react'
import { 
  Users, Shield, Search, RefreshCw, UserPlus, Lock, Unlock, 
  ToggleRight, ToggleLeft, Edit, Key, Trash2, ShieldCheck, Save, X 
} from 'lucide-react'

const ALL_SYSTEM_PERMISSIONS = [
  { key: 'attendance:view', label: 'View Attendance Logs', category: 'Attendance' },
  { key: 'attendance:mark', label: 'Mark/Edit Attendance', category: 'Attendance' },
  { key: 'undertakings:view', label: 'View Undertakings', category: 'Compliance' },
  { key: 'undertakings:sign', label: 'Sign Undertaking', category: 'Compliance' },
  { key: 'insurance:view', label: 'View Insurance Policies', category: 'Compliance' },
  { key: 'insurance:edit', label: 'Edit Insurance Coverage', category: 'Compliance' },
  { key: 'rooms:view', label: 'View Rooms Allotment', category: 'Logistics' },
  { key: 'rooms:assign', label: 'Assign/Edit Rooms', category: 'Logistics' },
  { key: 'red_flags:view', label: 'View Warnings/Red Flags', category: 'Safety' },
  { key: 'red_flags:create', label: 'Raise Warning/Red Flags', category: 'Safety' },
  { key: 'email:view', label: 'View Email Logs', category: 'Communication' },
  { key: 'email:send', label: 'Send/Queue Broadcasts', category: 'Communication' },
  { key: 'users:view', label: 'View Users Directory', category: 'IAM' },
  { key: 'users:manage', label: 'Create/Edit/Delete/Lock Users', category: 'IAM' },
  { key: 'batches:view', label: 'View Batches & Schedules', category: 'Operations' },
  { key: 'batches:manage', label: 'Manage Batches & Timetables', category: 'Operations' },
  { key: 'config:view', label: 'View Config Settings', category: 'System Settings' },
  { key: 'config:edit', label: 'Edit Config Settings', category: 'System Settings' },
  { key: 'maintenance:view', label: 'View Snapshots & Backups', category: 'Database Maintenance' },
  { key: 'maintenance:run', label: 'Backup/Restore/Purge DB', category: 'Database Maintenance' }
];

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

export default function IamTab({ token, apiBase, user, isMobile, showToast, readonly }) {
  const [iamSubTab, setIamSubTab] = useState('directory') // 'directory' or 'matrix'
  const [usersList, setUsersList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  
  const [rolePermissions, setRolePermissions] = useState(null)
  const [isSavingMatrix, setIsSavingMatrix] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Reset pagination to page 1 on query/filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter])

  // Pagination indices
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedUsers = usersList.slice(startIndex, startIndex + itemsPerPage)

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('student')
  const [formDepartment, setFormDepartment] = useState('')
  const [formSchool, setFormSchool] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formPermissions, setFormPermissions] = useState([])

  const [selectedUser, setSelectedUser] = useState(null)
  const [newPasswordReset, setNewPasswordReset] = useState('')
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)

  // Fetch IAM user list
  const fetchUsers = async () => {
    if (!token) return
    try {
      let url = `${apiBase}/api/superadmin/users?search=${encodeURIComponent(searchQuery)}`
      if (roleFilter) url += `&role=${roleFilter}`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsersList(data.users || [])
      }
    } catch (err) {
      showToast('Failed to load user roster', 'error')
    }
  }

  const fetchRolePermissions = async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/role-permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setRolePermissions(data.permissions)
      }
    } catch (err) {
      console.error('Error loading role permissions baseline:', err)
    }
  }

  useEffect(() => {
    if (iamSubTab === 'directory') {
      fetchUsers()
    }
  }, [searchQuery, roleFilter, iamSubTab])

  useEffect(() => {
    fetchRolePermissions()
  }, [])

  // Promoting / Demoting user role via API
  const handleUpdateRole = async (userId, userObj, newRole) => {
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: userObj.name,
          email: userObj.email,
          role: newRole,
          department: userObj.department,
          school: userObj.school,
          status: userObj.status
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update role')

      showToast('Role updated successfully!')
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Deleting user account
  const handleDeleteUser = async (userId, userRole, userName) => {
    if (parseInt(userId) === user.id) {
      showToast('You cannot delete your own account', 'error')
      return
    }
    if (!window.confirm(`Are you absolutely sure you want to permanently delete user ${userName}?`)) {
      return
    }

    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to delete user')

      showToast(`User ${userName} deleted successfully.`)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Creating a new user
  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!formName || !formEmail || !formPassword || !formRole) {
      showToast('Please fill out all required fields', 'error')
      return
    }
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          department: formDepartment,
          school: formSchool,
          status: formStatus,
          permissions: formPermissions
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to create user')

      showToast('User created successfully!')
      setShowCreateModal(false)
      // Reset form fields
      setFormName('')
      setFormEmail('')
      setFormPassword('')
      setFormRole('student')
      setFormDepartment('')
      setFormSchool('')
      setFormStatus('active')
      setFormPermissions([])
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Updating user details
  const handleEditUser = async (e) => {
    e.preventDefault()
    if (!formName || !formEmail || !formRole) {
      showToast('Name, email, and role are required', 'error')
      return
    }
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          role: formRole,
          department: formDepartment,
          school: formSchool,
          status: formStatus
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update user')

      showToast('User updated successfully!')
      setShowEditModal(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Lock or unlock a user
  const handleToggleLock = async (u) => {
    if (u.id === user?.id) {
      showToast('You cannot lock your own account', 'error')
      return
    }
    const newLockState = !u.is_locked
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${u.id}/lock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isLocked: newLockState })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to toggle lock status')

      showToast(data.message)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Toggle user status
  const handleToggleStatus = async (u) => {
    if (u.id === user?.id) {
      showToast('You cannot deactivate your own account', 'error')
      return
    }
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${u.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to toggle account status')

      showToast(data.message)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!newPasswordReset || newPasswordReset.trim() === '') {
      showToast('Password cannot be empty', 'error')
      return
    }
    try {
      const res = await fetch(`${apiBase}/api/superadmin/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPasswordReset })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to reset password')

      showToast('Password reset successfully!')
      setShowResetModal(false)
      setSelectedUser(null)
      setNewPasswordReset('')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // Update permissions
  const handleUpdatePermissions = async (e) => {
    e.preventDefault()
    try {
      setIsSavingPermissions(true)
      const res = await fetch(`${apiBase}/api/superadmin/users/${selectedUser.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: formPermissions })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to update user permissions')

      showToast('User custom permissions updated successfully!')
      setShowPermissionsModal(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsSavingPermissions(false)
    }
  }

  // Save role matrix
  const handleSaveRoleMatrix = async () => {
    try {
      setIsSavingMatrix(true)
      const res = await fetch(`${apiBase}/api/superadmin/role-permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ permissions: rolePermissions })
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Baseline permissions matrix saved successfully!', 'success')
      } else {
        showToast(data.message || 'Failed to save baseline matrix', 'error')
      }
    } catch (err) {
      showToast('Error saving baseline permissions matrix', 'error')
    } finally {
      setIsSavingMatrix(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .iam-tooltip-btn {
          position: relative;
        }
        .iam-tooltip-btn::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          background: #0f172a;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          font-family: system-ui, -apple-system, sans-serif;
          padding: 5px 9px;
          border-radius: 6px;
          white-space: nowrap;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 9999;
        }
        .iam-tooltip-btn::before {
          content: '';
          position: absolute;
          bottom: 115%;
          left: 50%;
          transform: translateX(-50%) translateY(4px);
          border-width: 5px;
          border-style: solid;
          border-color: #0f172a transparent transparent transparent;
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms cubic-bezier(0.4, 0, 0.2, 1), transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 9999;
        }
        .iam-tooltip-btn:hover::after,
        .iam-tooltip-btn:focus-visible::after,
        .iam-tooltip-btn:active::after {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .iam-tooltip-btn:hover::before,
        .iam-tooltip-btn:focus-visible::before,
        .iam-tooltip-btn:active::before {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        
        /* Rightmost button tooltips to prevent viewport overflow */
        .iam-tooltip-btn-right::after {
          left: auto !important;
          right: 0 !important;
          transform: translateY(4px) !important;
        }
        .iam-tooltip-btn-right::before {
          left: auto !important;
          right: 12px !important;
          transform: translateY(4px) !important;
        }
        .iam-tooltip-btn-right:hover::after,
        .iam-tooltip-btn-right:focus-visible::after,
        .iam-tooltip-btn-right:active::after {
          transform: translateY(0) !important;
        }
        .iam-tooltip-btn-right:hover::before,
        .iam-tooltip-btn-right:focus-visible::before,
        .iam-tooltip-btn-right:active::before {
          transform: translateY(0) !important;
        }
      `}</style>
      
      {/* IAM Sub-navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: '9999px', padding: '4px', border: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setIamSubTab('directory')}
            style={{
              borderRadius: '9999px',
              padding: '6px 20px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: iamSubTab === 'directory' ? '#ffffff' : 'transparent',
              color: iamSubTab === 'directory' ? '#0f172a' : '#64748b',
              boxShadow: iamSubTab === 'directory' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Users size={14} /> Directory
          </button>
          <button 
            onClick={() => setIamSubTab('matrix')}
            style={{
              borderRadius: '9999px',
              padding: '6px 20px',
              fontSize: '13px',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              background: iamSubTab === 'matrix' ? '#ffffff' : 'transparent',
              color: iamSubTab === 'matrix' ? '#0f172a' : '#64748b',
              boxShadow: iamSubTab === 'matrix' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease-in-out',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Shield size={14} /> Permission Matrix
          </button>
        </div>
      </div>

      {iamSubTab === 'directory' ? (
        <>
          {/* Filter & Action card */}
          <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '9999px', padding: '0 16px', minWidth: '280px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <Search size={16} style={{ color: '#94a3b8', marginRight: '8px' }} />
                <input 
                  type="text" 
                  placeholder="Search users by name, email, or PRN number..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ border: 'none', background: 'none', width: '100%', height: '40px', outline: 'none', fontSize: '13.5px', color: '#0f172a' }}
                />
              </div>
              <select 
                value={roleFilter} 
                onChange={e => setRoleFilter(e.target.value)}
                style={{ 
                  width: '180px', 
                  height: '42px',
                  padding: '0 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0f172a',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="faculty">Faculty</option>
                <option value="ltc_member">LTC Members</option>
                <option value="admin">Administrators</option>
                <option value="superadmin">Superadmins</option>
              </select>
              <button 
                onClick={fetchUsers} 
                style={{ 
                  borderRadius: '9999px', 
                  height: '42px', 
                  padding: '0 20px', 
                  fontSize: '13px', 
                  fontWeight: '600',
                  color: '#334155',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              {!readonly && (
                <button 
                  onClick={() => {
                    setFormName('');
                    setFormEmail('');
                    setFormPassword('');
                    setFormRole('student');
                    setFormDepartment('');
                    setFormSchool('');
                    setFormStatus('active');
                    if (rolePermissions && rolePermissions['student']) {
                      setFormPermissions(rolePermissions['student']);
                    } else {
                      setFormPermissions([]);
                    }
                    setShowCreateModal(true);
                  }} 
                  style={{ 
                    borderRadius: '9999px', 
                    height: '42px', 
                    padding: '0 20px', 
                    fontSize: '13px', 
                    fontWeight: '600',
                    color: '#ffffff',
                    background: '#2563eb',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                  }}
                >
                  <UserPlus size={16} /> Create User
                </button>
              )}
            </div>
          </div>

          {/* IAM User Matrix Table */}
          <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account ID</th>
                    <th>User Name & Email</th>
                    <th>Dept & School</th>
                    <th>Role & Status</th>
                    <th>Custom Rules</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => {
                    const hasCustomRules = u.permissions && Array.isArray(u.permissions) && u.permissions.length > 0;
                    return (
                      <tr key={u.id} style={{ opacity: u.status === 'inactive' ? 0.6 : 1 }}>
                        <td style={{ color: 'var(--text-4)', fontWeight: '700' }}>#{u.id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap' }}>{u.name}</div>
                            {u.role === 'superadmin_readonly' && (
                              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', border: '1px solid #fde68a' }}>
                                Read-Only Super Admin
                              </span>
                            )}
                            {u.status === 'inactive' && (
                              <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>Deactivated</span>
                            )}
                            {u.is_locked && (
                              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Lock size={8} /> Locked</span>
                            )}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '2px' }}>{u.email}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '12.5px' }}>{u.department || 'General'}</div>
                          {u.school && <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px' }}>{u.school}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <select 
                              value={u.role}
                              onChange={e => handleUpdateRole(u.id, u, e.target.value)}
                              disabled={u.id === user?.id}
                              style={{
                                background: u.role === 'superadmin' ? '#fef2f2' : (u.role === 'admin' ? '#eff6ff' : '#f8fafc'),
                                color: u.role === 'superadmin' ? '#b91c1c' : (u.role === 'admin' ? '#1e40af' : 'var(--text)'),
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              <option value="student">Student</option>
                              <option value="faculty">Faculty</option>
                              <option value="ltc_member">LTC Member</option>
                              <option value="admin">Admin</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </div>
                        </td>
                        <td>
                          {hasCustomRules ? (
                            <span style={{ fontSize: '11.5px', background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: '50px', fontWeight: '800' }}>
                              {u.permissions.length} Custom Overrides
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--text-4)' }}>Standard Role</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {readonly && u.id !== user?.id ? (
                              <span style={{ fontSize: '11.5px', color: 'var(--text-4)', fontStyle: 'italic', paddingRight: '8px' }}>View-Only</span>
                            ) : u.id !== user?.id ? (
                              <>
                                {/* Lock / Unlock */}
                                <button 
                                  onClick={() => handleToggleLock(u)}
                                  className="iam-tooltip-btn"
                                  data-tooltip={u.is_locked ? "Unlock Account" : "Lock Account"}
                                  style={{
                                    border: 'none',
                                    background: u.is_locked ? '#fffbeb' : '#f1f5f9',
                                    color: u.is_locked ? '#b45309' : 'var(--text-2)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {u.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                                </button>

                                {/* Activate / Deactivate Toggle */}
                                <button 
                                  onClick={() => handleToggleStatus(u)}
                                  className="iam-tooltip-btn"
                                  data-tooltip={u.status === 'active' ? "Deactivate User" : "Activate User"}
                                  style={{
                                    border: 'none',
                                    background: u.status === 'active' ? '#ecfdf5' : '#fee2e2',
                                    color: u.status === 'active' ? '#047857' : '#b91c1c',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {u.status === 'active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>

                                {/* Custom Permissions */}
                                <button 
                                  onClick={() => {
                                    setSelectedUser(u);
                                    if (u.permissions && u.permissions.length > 0) {
                                      setFormPermissions(u.permissions);
                                    } else if (rolePermissions && rolePermissions[u.role]) {
                                      setFormPermissions(rolePermissions[u.role]);
                                    } else {
                                      setFormPermissions([]);
                                    }
                                    setShowPermissionsModal(true);
                                  }}
                                  className="iam-tooltip-btn"
                                  data-tooltip="Permissions"
                                  style={{
                                    border: 'none',
                                    background: hasCustomRules ? '#fef3c7' : '#f1f5f9',
                                    color: hasCustomRules ? '#b45309' : 'var(--text-2)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <Shield size={14} />
                                </button>

                                {/* Edit Details */}
                                <button 
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setFormName(u.name);
                                    setFormEmail(u.email);
                                    setFormRole(u.role);
                                    setFormDepartment(u.department || '');
                                    setFormSchool(u.school || '');
                                    setFormStatus(u.status || 'active');
                                    setShowEditModal(true);
                                  }}
                                  className="iam-tooltip-btn"
                                  data-tooltip="Edit User"
                                  style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    color: 'var(--text-2)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit size={14} />
                                </button>

                                {/* Password Reset */}
                                <button 
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setNewPasswordReset('');
                                    setShowResetModal(true);
                                  }}
                                  className="iam-tooltip-btn iam-tooltip-btn-right"
                                  data-tooltip="Reset Password"
                                  style={{
                                    border: 'none',
                                    background: '#f1f5f9',
                                    color: 'var(--text-2)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Key size={14} />
                                </button>

                                {/* Delete User */}
                                <button 
                                  onClick={() => handleDeleteUser(u.id, u.role, u.name)}
                                  className="iam-tooltip-btn iam-tooltip-btn-right"
                                  data-tooltip="Delete User"
                                  style={{
                                    border: 'none',
                                    background: '#fef2f2',
                                    color: '#cbd5e1',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span style={{ color: '#000000', fontWeight: '800', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#d1fae5', padding: '4px 10px', borderRadius: '50px' }}>
                                <ShieldCheck size={13} /> Active Session
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>No users found matching query.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {usersList.length > itemsPerPage && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginTop: '20px', 
                paddingTop: '16px', 
                borderTop: '1px solid var(--border)' 
              }}>
                <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>
                  Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + itemsPerPage, usersList.length)}</strong> of <strong>{usersList.length}</strong> users
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="btn btn-outline"
                    style={{ 
                      borderRadius: '50px', 
                      padding: '6px 16px', 
                      fontSize: '12.5px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage * itemsPerPage >= usersList.length}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="btn btn-outline"
                    style={{ 
                      borderRadius: '50px', 
                      padding: '6px 16px', 
                      fontSize: '12.5px',
                      cursor: currentPage * itemsPerPage >= usersList.length ? 'not-allowed' : 'pointer',
                      opacity: currentPage * itemsPerPage >= usersList.length ? 0.5 : 1
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Matrix Subtab: Role baseline permissions matrix */
        <div style={{ background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a', fontFamily: 'system-ui' }}>Baseline Permissions Matrix</h4>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b', fontFamily: 'system-ui' }}>Define standard permissions for each user role.</p>
            </div>
            <button 
              onClick={handleSaveRoleMatrix} 
              disabled={isSavingMatrix || !rolePermissions}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px', 
                borderRadius: '9999px',
                height: '40px',
                padding: '0 20px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#ffffff',
                background: '#2563eb',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
              }}
            >
              {isSavingMatrix ? <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> : <Save size={14} />}
              Save Baseline Matrix
            </button>
          </div>

          <div className="table-wrapper">
            <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12.5px', fontWeight: '800' }}>Permission Scope & Key</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12.5px', fontWeight: '800' }}>Student</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12.5px', fontWeight: '800' }}>Faculty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12.5px', fontWeight: '800' }}>LTC Member</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12.5px', fontWeight: '800' }}>Admin</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12.5px', fontWeight: '800' }}>Super Admin</th>
                </tr>
              </thead>
              <tbody>
                {ALL_SYSTEM_PERMISSIONS.map((perm, idx) => (
                  <tr key={perm.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontWeight: '750', textTransform: 'uppercase', marginRight: '8px' }}>
                        {perm.category}
                      </span>
                      <div style={{ fontWeight: '750', color: 'var(--text)', display: 'inline-block' }}>{perm.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-4)', fontFamily: 'monospace', marginTop: '2px' }}>{perm.key}</div>
                    </td>
                    {['student', 'faculty', 'ltc_member', 'admin', 'superadmin'].map(roleKey => {
                      const isChecked = rolePermissions && rolePermissions[roleKey] && rolePermissions[roleKey].includes(perm.key);
                      const isSuperAdminCol = roleKey === 'superadmin';
                      return (
                        <td key={roleKey} style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <input 
                            type="checkbox"
                            checked={isSuperAdminCol ? true : (isChecked || false)}
                            disabled={isSuperAdminCol || isSavingMatrix}
                            onChange={(e) => {
                              const updated = { ...rolePermissions };
                              if (!updated[roleKey]) updated[roleKey] = [];
                              if (e.target.checked) {
                                updated[roleKey] = [...updated[roleKey], perm.key];
                              } else {
                                updated[roleKey] = updated[roleKey].filter(k => k !== perm.key);
                              }
                              setRolePermissions(updated);
                            }}
                            style={{
                              width: '16px',
                              height: '16px',
                              cursor: isSuperAdminCol ? 'default' : 'pointer',
                              accentColor: 'var(--primary)'
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Create User */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create User">
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Full Name *</label>
                <input type="text" className="input-field" required value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Email Address *</label>
                <input type="email" className="input-field" required value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="name@domain.com" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Role *</label>
                <select 
                  value={formRole} 
                  onChange={e => {
                    const newRole = e.target.value;
                    setFormRole(newRole);
                    if (rolePermissions && rolePermissions[newRole]) {
                      setFormPermissions(rolePermissions[newRole]);
                    } else {
                      setFormPermissions([]);
                    }
                  }} 
                  className="input-field"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty Advisor</option>
                  <option value="ltc_member">LTC Member</option>
                  <option value="admin">Administrator</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Temporary Password *</label>
                <input type="password" className="input-field" required value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="At least 6 chars" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Department / Branch</label>
                <input type="text" className="input-field" value={formDepartment} onChange={e => setFormDepartment(e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>School / Institute</label>
                <input type="text" className="input-field" value={formSchool} onChange={e => setFormSchool(e.target.value)} placeholder="e.g. MIT Pune" />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Account Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="input-field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Custom overrides checklist */}
            <div style={{ marginTop: '8px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800' }}>Custom Permissions</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: 'var(--text-3)' }}>Customize permissions for this user, or keep default settings.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px' }}>
                {ALL_SYSTEM_PERMISSIONS.map(perm => {
                  const isChecked = formPermissions.includes(perm.key);
                  return (
                    <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormPermissions([...formPermissions, perm.key]);
                          } else {
                            setFormPermissions(formPermissions.filter(k => k !== perm.key));
                          }
                        }}
                      />
                      <span>{perm.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0 0 0', borderTop: '1px solid var(--border)', marginTop: '20px' }}>
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" className="btn btn-primary">Create User Account</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit User */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User">
        <form onSubmit={handleEditUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Full Name *</label>
              <input type="text" className="input-field" required value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Email Address *</label>
              <input type="email" className="input-field" required value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Role *</label>
                <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-field">
                  <option value="student">Student</option>
                  <option value="faculty">Faculty Advisor</option>
                  <option value="ltc_member">LTC Member</option>
                  <option value="admin">Administrator</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Lifecycle Status</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className="input-field">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Deactivated</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>Department / Branch</label>
                <input type="text" className="input-field" value={formDepartment} onChange={e => setFormDepartment(e.target.value)} />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>School / Institute</label>
                <input type="text" className="input-field" value={formSchool} onChange={e => setFormSchool(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0 0 0', borderTop: '1px solid var(--border)', marginTop: '20px' }}>
            <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Reset Password */}
      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Reset Password" size="sm">
        <form onSubmit={handleResetPassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-3)' }}>
              Force password reset for <strong>{selectedUser?.name}</strong> ({selectedUser?.email}).
            </p>
            <div>
              <label className="form-label" style={{ fontWeight: '700', fontSize: '12px' }}>New Account Password *</label>
              <input 
                type="password" 
                className="input-field" 
                required 
                placeholder="At least 6 characters"
                value={newPasswordReset} 
                onChange={e => setNewPasswordReset(e.target.value)} 
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0 0 0', borderTop: '1px solid var(--border)', marginTop: '20px' }}>
            <button type="button" onClick={() => setShowResetModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" className="btn btn-primary">Reset Password</button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Custom User Permissions Override */}
      <Modal open={showPermissionsModal} onClose={() => setShowPermissionsModal(false)} title="Permissions Override">
        <form onSubmit={handleUpdatePermissions}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>Customize permissions for <strong>{selectedUser?.name}</strong> (Role: <strong>{selectedUser?.role}</strong>)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', border: '1px solid var(--border)', padding: '16px', borderRadius: '16px' }}>
              {ALL_SYSTEM_PERMISSIONS.map(perm => {
                const isChecked = formPermissions.includes(perm.key);
                return (
                  <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', padding: '4px' }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormPermissions([...formPermissions, perm.key]);
                        } else {
                          setFormPermissions(formPermissions.filter(k => k !== perm.key));
                        }
                      }}
                    />
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--primary)', background: '#eff6ff', padding: '1px 4px', borderRadius: '2px', textTransform: 'uppercase', marginRight: '4px' }}>{perm.category}</span>
                      <strong>{perm.label}</strong>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0 0 0', borderTop: '1px solid var(--border)', marginTop: '20px' }}>
            <button type="button" onClick={() => setShowPermissionsModal(false)} className="btn btn-outline">Cancel</button>
            <button type="submit" disabled={isSavingPermissions} className="btn btn-primary">
              {isSavingPermissions ? <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} /> : 'Save Custom Rules'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
