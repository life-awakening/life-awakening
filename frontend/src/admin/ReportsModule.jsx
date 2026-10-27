import React, { useState, useEffect, useMemo } from 'react'
import { Shield, RefreshCw, Search, Award, Folder, ChevronRight, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { OFFICIAL_HIERARCHY } from './hierarchy'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001'

export default function ReportsModule({ token, toast, user, isReadOnly = false }) {
  const { t } = useLanguage()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  const effectiveReadOnly = isReadOnly || user?.role === 'readonly_superadmin' || user?.role === 'read_only_super_admin'

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [subTab, setSubTab] = useState('certificates')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)

  // Certificates states
  const [certsList, setCertsList] = useState([])
  const [loadingCerts, setLoadingCerts] = useState(false)

  // Category Certificates states
  const [allocMethod, setAllocMethod] = useState('list') // 'list' or 'manual'
  const [selectedSquad, setSelectedSquad] = useState('')
  const [manualIdentifier, setManualIdentifier] = useState('')

  const [allBatches, setAllBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [allocatingCategory, setAllocatingCategory] = useState(false)
  const [selectedBatchFolder, setSelectedBatchFolder] = useState(null)

  const fetchCertificates = async () => {
    setLoadingCerts(true)
    try {
      const res = await fetch(`${API}/api/superadmin/certificates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setCertsList(data.certificates || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingCerts(false)
    }
  }

  const fetchStudentsForBatch = async (batchId) => {
    if (!batchId) {
      setStudents([])
      return
    }
    setLoadingStudents(true)
    try {
      const studentsRes = await fetch(`${API}/api/admin/batches/${batchId}/students?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const studentsData = await studentsRes.json()
      if (studentsRes.ok) {
        setStudents(studentsData.students || [])
      }
    } catch (e) {
      console.error('Error fetching students for batch:', e)
    } finally {
      setLoadingStudents(false)
    }
  }

  const fetchActiveBatchAndStudents = async () => {
    try {
      let fetchedBatches = []
      try {
        const batchesRes = await fetch(`${API}/api/superadmin/batches`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (batchesRes.ok) {
          const batchesData = await batchesRes.json()
          if (batchesData.batches && Array.isArray(batchesData.batches)) {
            fetchedBatches = batchesData.batches
          }
        }
      } catch (err) {
        console.warn('Superadmin batches fetch failed, trying admin route:', err)
      }

      if (fetchedBatches.length === 0) {
        try {
          const adminBatchesRes = await fetch(`${API}/api/admin/batches`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (adminBatchesRes.ok) {
            const adminBatchesData = await adminBatchesRes.json()
            if (adminBatchesData.batches && Array.isArray(adminBatchesData.batches)) {
              fetchedBatches = adminBatchesData.batches
            }
          }
        } catch (err) {
          console.warn('Admin batches fetch failed:', err)
        }
      }

      if (fetchedBatches.length > 0) {
        setAllBatches(fetchedBatches)
      }

      const batchRes = await fetch(`${API}/api/active-batch`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const batchData = await batchRes.json()
      if (batchRes.ok && batchData.activeBatch) {
        setSelectedBatchId(batchData.activeBatch.id)
        fetchStudentsForBatch(batchData.activeBatch.id)
      } else if (fetchedBatches.length > 0) {
        setSelectedBatchId(fetchedBatches[0].id)
        fetchStudentsForBatch(fetchedBatches[0].id)
      }
    } catch (e) {
      console.error('Error fetching batches and students:', e)
    }
  }

  const filteredStudents = useMemo(() => {
    let list = students
    if (selectedSquad) {
      list = list.filter(s => s.squad === selectedSquad)
    }
    if (!studentSearch) return list.slice(0, 100)
    const query = studentSearch.toLowerCase()
    return list.filter(s => 
      s.name?.toLowerCase().includes(query) || 
      s.prn?.toLowerCase().includes(query) ||
      s.ltc_id?.toLowerCase().includes(query) ||
      s.email?.toLowerCase().includes(query)
    ).slice(0, 100)
  }, [students, studentSearch, selectedSquad])

  const uniqueSquads = useMemo(() => {
    const squads = students.map(s => s.squad).filter(Boolean)
    const SQUAD_ORDER = ['Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi']
    return Array.from(new Set(squads)).sort((a, b) => {
      const idxA = SQUAD_ORDER.indexOf(a)
      const idxB = SQUAD_ORDER.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })
  }, [students])

  const groupedCertificatesByBatch = useMemo(() => {
    const groups = {}
    certsList.forEach(cert => {
      const bName = cert.batch_name || (cert.batch_id ? `Batch ${cert.batch_id}` : 'General / Unassigned')
      if (!groups[bName]) {
        groups[bName] = {
          batchName: bName,
          batchId: cert.batch_id,
          certs: []
        }
      }
      groups[bName].certs.push(cert)
    })
    return groups
  }, [certsList])

  const CATEGORY_OPTIONS = [
    { value: 'winner-team-army-obstacle', label: 'Winner Team Army Obstacles (Limit: 4)', limit: 4 },
    { value: 'runnerup-team-army-obstacles', label: 'Runner up Team Army Obstacles (Limit: 4)', limit: 4 },
    { value: 'second-runnerup-team-army-obstacle', label: 'Second runner up Team Army Obstacles (Limit: 4)', limit: 4 },
    { value: 'kho-kho', label: 'Kho Kho (Limit: 15)', limit: 15 },
    { value: 'best-in-patriotism-and-nation-building', label: 'Best in Patriotism and Nation Building (Limit: 1)', limit: 1 },
    { value: 'best-squad-captain', label: 'Best Squad Captain (Limit: 1)', limit: 1 },
    { value: 'best-squad', label: 'Best Squad (Limit: 1)', limit: 1 },
    { value: 'best-in-yoga-activities', label: 'Best in Yoga (Limit: 1)', limit: 1 },
    { value: 'best-in-sports-activities', label: 'Best in Sports (Limit: 1)', limit: 1 },
    { value: 'best-in-agriculture-activities', label: 'Best in Agriculture (Limit: 1)', limit: 1 },
    { value: 'best-in-team-building-activities', label: 'Best in Team Building (Limit: 1)', limit: 1 }
  ]

  const handleAllocateCategoryCertificate = async (e) => {
    if (e) e.preventDefault()
    if (effectiveReadOnly) {
      return alert('Read-Only Mode: Certificate allocation is disabled.')
    }
    if (!selectedBatchId) {
      return alert('Please select a batch.')
    }
    if (!selectedCategory) {
      return alert('Please select a certificate category.')
    }

    const currentCatObj = CATEGORY_OPTIONS.find(c => c.value === selectedCategory)
    const catLimit = currentCatObj?.limit || 1

    if (selectedCategory === 'best-squad') {
      if (!selectedSquad) {
        return alert('Please select a squad for the Best Squad certificate.')
      }
    } else if (catLimit > 1) {
      if (selectedStudentIds.length === 0) {
        return alert(`Please select at least 1 student for "${currentCatObj?.label || 'this category'}".`)
      }
      if (selectedStudentIds.length > catLimit) {
        return alert(`Please select a maximum of ${catLimit} students. Currently selected: ${selectedStudentIds.length}`)
      }
    } else {
      if (allocMethod === 'list' && !selectedStudent) {
        return alert('Please select a student from the list.')
      }
      if (allocMethod === 'manual' && !manualIdentifier) {
        return alert('Please enter student ID, PRN or email.')
      }
    }

    setAllocatingCategory(true)
    try {
      const body = {
        batchId: selectedBatchId,
        category: selectedCategory
      }

      if (selectedCategory === 'best-squad') {
        body.squad = selectedSquad
      } else if (catLimit > 1) {
        body.studentIds = selectedStudentIds
      } else if (allocMethod === 'list') {
        body.studentId = selectedStudent.id
      } else {
        body.studentIdentifier = manualIdentifier
      }

      const res = await fetch(`${API}/api/superadmin/certificates/allocate-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Certificates allocated successfully!')
        setSelectedStudent(null)
        setSelectedStudentIds([])
        setStudentSearch('')
        setManualIdentifier('')
        setSelectedCategory('')
        fetchCertificates()
      } else {
        alert(data.message || 'Failed to allocate certificate.')
      }
    } catch (err) {
      console.error(err)
      alert('Error allocating category certificate.')
    } finally {
      setAllocatingCategory(false)
    }
  }

  const handleDeleteCertificate = async (id) => {
    if (effectiveReadOnly) {
      return alert('Read-Only Mode: Certificate deletion is disabled.')
    }
    if (!window.confirm('Are you sure you want to delete this certificate?')) return
    try {
      const res = await fetch(`${API}/api/superadmin/certificates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        alert('Certificate deleted successfully.')
        fetchCertificates()
      } else {
        alert(data.message || 'Failed to delete certificate.')
      }
    } catch (err) {
      alert('Error deleting certificate.')
    }
  }

  // Cascading Selector States
  const [selectedDivision, setSelectedDivision] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')
  const [selectedSchool, setSelectedSchool] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const availableDivisions = useMemo(() => Object.keys(OFFICIAL_HIERARCHY), [])
  const availableFaculties = useMemo(() => {
    if (!selectedDivision) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision] || {})
  }, [selectedDivision])
  const availableSchools = useMemo(() => {
    if (!selectedDivision || !selectedFaculty) return []
    return Object.keys(OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty] || {})
  }, [selectedDivision, selectedFaculty])
  const availableDepartments = useMemo(() => {
    if (!selectedDivision || !selectedFaculty || !selectedSchool) return []
    return OFFICIAL_HIERARCHY[selectedDivision]?.[selectedFaculty]?.[selectedSchool] || []
  }, [selectedDivision, selectedFaculty, selectedSchool])

  const formatAction = (act) => {
    if (!act) return ''
    const mapping = {
      BATCH_CREATED: 'Batch Created',
      BATCH_UPDATED: 'Batch Updated',
      BATCH_ARCHIVED: 'Batch Archived',
      BATCH_RESTORED: 'Batch Restored',
      STUDENT_AUTO_CREATED: 'Student Registered',
      SQUAD_LEADER_UPDATED: 'Squad Leader Appointed',
      FACULTY_ASSIGNED: 'Faculty Appointed',
      FACULTY_REMOVED: 'Faculty Removed',
      BULK_UPLOAD_COMPLETED: 'Bulk Ingestion Completed'
    }
    if (mapping[act]) return mapping[act]
    return act.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  }

  const formatDetails = (details) => {
    if (!details) return '—'
    let obj = details
    if (typeof details === 'string') {
      try {
        obj = JSON.parse(details)
      } catch {
        return details
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj).map(([key, val]) => {
        const readableKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()
        const cleanKey = readableKey.charAt(0).toUpperCase() + readableKey.slice(1).toLowerCase()
        const readableVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)
        return `${cleanKey}: ${readableVal}`
      }).join(', ')
    }
    return String(details)
  }

  const fetchLogs = async (pg = 1) => {
    setLoading(true)
    try {
      let url = `${API}/api/admin/audit-logs?page=${pg}&limit=20&action=${actionFilter}&search=${encodeURIComponent(search)}`
      if (selectedDivision) url += `&division=${encodeURIComponent(selectedDivision)}`
      if (selectedFaculty) url += `&faculty=${encodeURIComponent(selectedFaculty)}`
      if (selectedSchool) url += `&school=${encodeURIComponent(selectedSchool)}`
      if (selectedDepartment) url += `&department=${encodeURIComponent(selectedDepartment)}`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setTotalLogs(data.pagination?.total || 0)
        setTotalPages(data.pagination?.pages || 1)
        setPage(data.pagination?.page || 1)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (subTab === 'audit') {
      fetchLogs(1)
    }
  }, [subTab, actionFilter, selectedDivision, selectedFaculty, selectedSchool, selectedDepartment])

  // Debounced search trigger
  useEffect(() => {
    if (subTab === 'audit') {
      const t = setTimeout(() => fetchLogs(1), 350)
      return () => clearTimeout(t)
    }
  }, [search])

  useEffect(() => {
    if (subTab === 'certificates') {
      fetchCertificates()
      fetchActiveBatchAndStudents()
    }
  }, [subTab])

  return (
    <div style={{ paddingBottom: '30px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>
          {t("Logs and Certificate")}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          {t("Track system activity, view student attendance performance, and manage custom member certificates")}
        </p>
      </div>

      {/* Clean Segmented Tab Switcher */}
      <div style={{
        display: 'inline-flex',
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '3px',
        gap: '4px',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => {
            setSubTab('audit')
            setSelectedDivision('')
            setSelectedFaculty('')
            setSelectedSchool('')
            setSelectedDepartment('')
          }}
          style={{
            padding: '7px 16px',
            background: subTab === 'audit' ? '#224283' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: subTab === 'audit' ? '#ffffff' : '#475569',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Shield size={14} /> {t("Activity Log")}
        </button>
        <button
          onClick={() => setSubTab('certificates')}
          style={{
            padding: '7px 16px',
            background: subTab === 'certificates' ? '#224283' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: subTab === 'certificates' ? '#ffffff' : '#475569',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Award size={14} /> {t("Certificates")}
        </button>
      </div>

      {/* Activity Log Section */}
      {subTab === 'audit' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          padding: isMobile ? '14px' : '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          {/* Cascading Filter Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '10px',
            marginBottom: '16px',
            width: '100%',
            alignItems: 'center'
          }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder={t("Search user or details...")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '6px 10px 6px 32px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
            
            <select
              style={{ height: '36px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              value={selectedDivision}
              onChange={e => {
                setSelectedDivision(e.target.value)
                setSelectedFaculty('')
                setSelectedSchool('')
                setSelectedDepartment('')
              }}
            >
              <option value="">{t("All Divisions")}</option>
              <option value="UNASSIGNED">{t("Unassigned")}</option>
              {availableDivisions.map(div => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>

            <select
              style={{ height: '36px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              value={selectedFaculty}
              onChange={e => {
                setSelectedFaculty(e.target.value)
                setSelectedSchool('')
                setSelectedDepartment('')
              }}
              disabled={!selectedDivision}
            >
              <option value="">{t("All Faculties")}</option>
              {availableFaculties.map(fac => (
                <option key={fac} value={fac}>{fac}</option>
              ))}
            </select>

            <select
              style={{ height: '36px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              value={selectedSchool}
              onChange={e => {
                setSelectedSchool(e.target.value)
                setSelectedDepartment('')
              }}
              disabled={!selectedFaculty}
            >
              <option value="">{t("All Schools")}</option>
              {availableSchools.map(sch => (
                <option key={sch} value={sch}>{sch}</option>
              ))}
            </select>

            <select
              style={{ height: '36px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              disabled={!selectedSchool}
            >
              <option value="">{t("All Depts")}</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{ height: '36px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">{t("All Actions")}</option>
              <option value="BATCH_CREATED">{t("Batch Creation")}</option>
              <option value="BATCH_UPDATED">{t("Batch Update")}</option>
              <option value="BATCH_ARCHIVED">{t("Batch Archive")}</option>
              <option value="BATCH_RESTORED">{t("Batch Restore")}</option>
              <option value="STUDENT_AUTO_CREATED">{t("Student Registered")}</option>
              <option value="SQUAD_LEADER_UPDATED">{t("Squad Leader Update")}</option>
              <option value="BULK_UPLOAD_COMPLETED">{t("Bulk Ingestion")}</option>
            </select>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                style={{ flex: 1, height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', color: '#475569', cursor: 'pointer' }} 
                onClick={() => fetchLogs(page)} 
                title={t("Refresh Logs")}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Activity Log Table */}
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Date & Time</th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Action Taken</th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Done By</th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Item Affected</th>
                    <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Changes Made</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                          Loading logs...
                        </div>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
                          <Shield size={28} style={{ marginBottom: '6px', color: '#cbd5e1' }} />
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>No activity logs match your filters.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const isCreate = log.action.includes('CREATED') || log.action.includes('REGISTERED');
                      const isDelete = log.action.includes('DELETED') || log.action.includes('ARCHIVED');
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontSize: '12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{ 
                                fontSize: '10.5px', 
                                fontWeight: '600',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                background: isCreate ? '#eef2ff' : '#f8fafc',
                                color: isCreate ? '#224283' : '#334155',
                                border: `1px solid ${isCreate ? '#c7d2fe' : '#cbd5e1'}`
                              }}
                            >
                              {formatAction(log.action)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>{log.user_name || 'System'}</td>
                          <td style={{ padding: '10px 14px', color: '#475569' }}>
                            {log.entity_type ? (
                              <span style={{ textTransform: 'capitalize' }}>
                                {log.entity_type.replace(/_/g, ' ')} (ID: {log.entity_id})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatDetails(log.details)}>
                            {formatDetails(log.details)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Page <strong style={{ color: '#0f172a' }}>{page}</strong> of <strong>{totalPages}</strong> (Total: {totalLogs})
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => fetchLogs(page - 1)}
                  style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.6 : 1 }}
                >
                  Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchLogs(page + 1)}
                  style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.6 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Certificates Section */}
      {subTab === 'certificates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Certificate Console Form */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} style={{ color: '#224283' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Certificate Console
                </h3>
              </div>
              {effectiveReadOnly && (
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  Read-Only Mode
                </span>
              )}
            </div>

            {effectiveReadOnly && (
              <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', color: '#475569', marginBottom: '16px', fontWeight: '500' }}>
                Certificate allocation is disabled in Read-Only mode.
              </div>
            )}

            <form onSubmit={handleAllocateCategoryCertificate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 1. Select Batch */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>
                  Select Batch <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  disabled={effectiveReadOnly}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: effectiveReadOnly ? '#f8fafc' : '#ffffff', color: '#0f172a', outline: 'none', cursor: effectiveReadOnly ? 'not-allowed' : 'pointer' }}
                  value={selectedBatchId}
                  onChange={e => {
                    const newBatchId = e.target.value;
                    setSelectedBatchId(newBatchId);
                    setSelectedStudent(null);
                    setSelectedStudentIds([]);
                    setSelectedSquad('');
                    setStudentSearch('');
                    setManualIdentifier('');
                    fetchStudentsForBatch(newBatchId);
                  }}
                >
                  <option value="">-- Choose Batch --</option>
                  {allBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status ? b.status.toUpperCase() : 'BATCH'}{b.is_active ? ' • ACTIVE' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Certificate Category */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>
                  Certificate Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  required 
                  disabled={effectiveReadOnly}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: effectiveReadOnly ? '#f8fafc' : '#ffffff', color: '#0f172a', outline: 'none', cursor: effectiveReadOnly ? 'not-allowed' : 'pointer' }} 
                  value={selectedCategory} 
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedCategory(val);
                    setSelectedStudent(null);
                    setSelectedStudentIds([]);
                    setStudentSearch('');
                    setManualIdentifier('');
                  }}
                >
                  <option value="">-- Choose Category --</option>
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 3. Squad Selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>
                  {selectedCategory === 'best-squad' ? 'Select Squad *' : 'Filter by Squad (Optional)'}
                </label>
                <select
                  disabled={effectiveReadOnly}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: effectiveReadOnly ? '#f8fafc' : '#ffffff', color: '#0f172a', outline: 'none', cursor: effectiveReadOnly ? 'not-allowed' : 'pointer' }}
                  value={selectedSquad}
                  required={selectedCategory === 'best-squad'}
                  onChange={e => {
                    setSelectedSquad(e.target.value);
                    setSelectedStudent(null);
                    setSelectedStudentIds([]);
                    setStudentSearch('');
                  }}
                >
                  <option value="">{selectedCategory === 'best-squad' ? '-- Choose Squad --' : '-- All Squads --'}</option>
                  {uniqueSquads.map(sq => (
                    <option key={sq} value={sq}>{sq}</option>
                  ))}
                </select>
              </div>

              {/* 4. Student Selection Section */}
              {!effectiveReadOnly && selectedCategory !== 'best-squad' && selectedCategory && (
                (() => {
                  const currentCat = CATEGORY_OPTIONS.find(c => c.value === selectedCategory);
                  const catLimit = currentCat?.limit || 1;

                  if (catLimit > 1) {
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>
                            Select Team Members (Limit: {catLimit}) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: selectedStudentIds.length === catLimit ? '#dcfce7' : '#eff6ff',
                            color: selectedStudentIds.length === catLimit ? '#166534' : '#1d4ed8',
                            border: selectedStudentIds.length === catLimit ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
                          }}>
                            Selected: {selectedStudentIds.length} / {catLimit}
                          </span>
                        </div>

                        {/* Search Filter */}
                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                          <input
                            type="text"
                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', background: '#ffffff', color: '#0f172a', outline: 'none' }}
                            placeholder="Search by name, PRN or email..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                          />
                        </div>

                        {/* Checklist Container */}
                        <div style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          {filteredStudents.length === 0 ? (
                            <div style={{ padding: '14px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                              No students found matching search.
                            </div>
                          ) : (
                            filteredStudents.map(s => {
                              const isSelected = selectedStudentIds.includes(s.id);
                              const isDisabled = !isSelected && selectedStudentIds.length >= catLimit;
                              return (
                                <label
                                  key={s.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    background: isSelected ? '#eff6ff' : '#ffffff',
                                    opacity: isDisabled ? 0.6 : 1,
                                    transition: 'background-color 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isDisabled}
                                      onChange={() => {
                                        if (isSelected) {
                                          setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                                        } else {
                                          if (selectedStudentIds.length < catLimit) {
                                            setSelectedStudentIds(prev => [...prev, s.id]);
                                          }
                                        }
                                      }}
                                      style={{ width: '15px', height: '15px', cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                                    />
                                    <div>
                                      <span style={{ fontWeight: '600', fontSize: '12.5px', color: '#0f172a' }}>
                                        {s.name}
                                      </span>
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                        PRN: {s.prn || '—'} | Squad: {s.squad || '—'} | {s.email}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#1d4ed8', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px' }}>
                                      Selected
                                    </span>
                                  )}
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Single Student Selection Flow (Limit === 1)
                  return (
                    <>
                      {/* Clean Subtab Buttons */}
                      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '8px', gap: '16px' }}>
                        <button 
                          type="button"
                          onClick={() => {
                            setAllocMethod('list');
                            setSelectedStudent(null);
                            setStudentSearch('');
                            setManualIdentifier('');
                          }}
                          style={{ 
                            paddingBottom: '6px', 
                            borderBottom: allocMethod === 'list' ? '2px solid #224283' : 'none',
                            fontWeight: allocMethod === 'list' ? '600' : '500',
                            color: allocMethod === 'list' ? '#224283' : '#64748b',
                            fontSize: '12.5px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Select from Batch List
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setAllocMethod('manual');
                            setSelectedStudent(null);
                            setStudentSearch('');
                            setManualIdentifier('');
                          }}
                          style={{ 
                            paddingBottom: '6px',
                            borderBottom: allocMethod === 'manual' ? '2px solid #224283' : 'none',
                            fontWeight: allocMethod === 'manual' ? '600' : '500',
                            color: allocMethod === 'manual' ? '#224283' : '#64748b',
                            fontSize: '12.5px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Manual Input
                        </button>
                      </div>

                      {allocMethod === 'list' ? (
                        selectedSquad ? (
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Select Student *</label>
                            {selectedStudent ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', fontSize: '12.5px' }}>
                                <div>
                                  <span style={{ fontWeight: '600', color: '#1e40af' }}>{selectedStudent.name}</span>
                                  <span style={{ marginLeft: '6px', fontSize: '11px', color: '#3b82f6' }}>PRN: {selectedStudent.prn || '—'} | Squad: {selectedStudent.squad || '—'}</span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => { setSelectedStudent(null); }}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontSize: '11.5px' }}
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <select
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#ffffff', color: '#0f172a', outline: 'none' }}
                                value={selectedStudent ? selectedStudent.id : ''}
                                onChange={e => {
                                  const studentId = e.target.value;
                                  const studentObj = students.find(s => s.id === parseInt(studentId));
                                  setSelectedStudent(studentObj || null);
                                }}
                              >
                                <option value="">-- Choose Student from Squad --</option>
                                {students.filter(s => s.squad === selectedSquad).map(s => (
                                  <option key={s.id} value={s.id}>{s.name} (PRN: {s.prn || '—'})</option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Search Student *</label>
                            {selectedStudent ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #bfdbfe', borderRadius: '6px', background: '#eff6ff', fontSize: '12.5px' }}>
                                <div>
                                  <span style={{ fontWeight: '600', color: '#1e40af' }}>{selectedStudent.name}</span>
                                  <span style={{ marginLeft: '6px', fontSize: '11px', color: '#3b82f6' }}>PRN: {selectedStudent.prn || '—'} | Squad: {selectedStudent.squad || '—'}</span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '600', fontSize: '11.5px' }}
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <div style={{ position: 'relative' }}>
                                <input 
                                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#ffffff', color: '#0f172a', outline: 'none' }} 
                                  value={studentSearch} 
                                  onChange={e => setStudentSearch(e.target.value)} 
                                  placeholder="Type name, PRN or email to search..." 
                                />
                                {studentSearch && filteredStudents.length > 0 && (
                                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }}>
                                    {filteredStudents.map(s => (
                                      <div 
                                        key={s.id} 
                                        onClick={() => setSelectedStudent(s)}
                                        style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '12px', display: 'flex', flexDirection: 'column' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span style={{ fontWeight: '600', color: '#0f172a' }}>{s.name}</span>
                                          <span style={{ fontSize: '11px', color: '#64748b' }}>PRN: {s.prn || '—'}</span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>{s.email}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <div>
                          <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', color: '#475569' }}>Student ID, PRN or Email *</label>
                          <input 
                            required 
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', background: '#ffffff', color: '#0f172a', outline: 'none' }} 
                            value={manualIdentifier} 
                            onChange={e => setManualIdentifier(e.target.value)} 
                            placeholder="Enter Student ID, PRN or Email..." 
                          />
                        </div>
                      )}
                    </>
                  );
                })()
              )}

              {/* Submit Allocate Button */}
              {!effectiveReadOnly && (
                <button 
                  type="submit" 
                  disabled={
                    allocatingCategory || 
                    !selectedBatchId || 
                    !selectedCategory || 
                    (selectedCategory === 'best-squad' 
                      ? !selectedSquad 
                      : (CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.limit || 1) > 1 
                        ? selectedStudentIds.length !== (CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.limit || 1) 
                        : (allocMethod === 'list' ? !selectedStudent : !manualIdentifier))
                  } 
                  style={{
                    padding: '9px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: allocatingCategory ? '#cbd5e1' : '#224283',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: allocatingCategory ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}
                >
                  <Award size={15}/> 
                  {allocatingCategory 
                    ? 'Allocating...' 
                    : (selectedCategory === 'best-squad' 
                      ? 'Allocate Best Squad Certificate' 
                      : (CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.limit || 1) > 1 
                        ? `Allocate Certificates (${selectedStudentIds.length}/${CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.limit || 1} Selected)` 
                        : 'Allocate Certificate')}
                </button>
              )}
            </form>
          </div>

          {/* Assigned Custom Certificates List */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: isMobile ? '16px' : '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Assigned Custom Certificates</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Folder-based batch hierarchy for certificate management
                </p>
              </div>
              {selectedBatchFolder && (
                <button
                  type="button"
                  onClick={() => setSelectedBatchFolder(null)}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600', cursor: 'pointer' }}
                >
                  <ArrowLeft size={14} /> Back to Folders
                </button>
              )}
            </div>

            {loadingCerts ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12.5px' }}>
                Loading certificates...
              </div>
            ) : (
              !selectedBatchFolder ? (
                /* Folder Grid Overview */
                Object.keys(groupedCertificatesByBatch).length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                    No custom certificates assigned yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {Object.values(groupedCertificatesByBatch).map(folder => (
                      <div
                        key={folder.batchName}
                        onClick={() => setSelectedBatchFolder(folder.batchName)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#eff6ff';
                          e.currentTarget.style.borderColor = '#93c5fd';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <Folder size={28} style={{ color: '#2563eb', flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {folder.batchName}
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                            {folder.certs.length} Certificate{folder.certs.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <ChevronRight size={16} style={{ color: '#94a3b8' }} />
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Inside Folder View - Table */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '12.5px', fontWeight: '600', color: '#1e40af' }}>
                    <Folder size={16} />
                    <span>Folder: {selectedBatchFolder}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', background: '#dbeafe', padding: '2px 6px', borderRadius: '4px', color: '#1e40af' }}>
                      {groupedCertificatesByBatch[selectedBatchFolder]?.certs.length || 0} Records
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Student Name & PRN</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Role</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Certificate Title</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Assigned Date</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!groupedCertificatesByBatch[selectedBatchFolder] || groupedCertificatesByBatch[selectedBatchFolder].certs.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                              No certificates in this folder.
                            </td>
                          </tr>
                        ) : (
                          groupedCertificatesByBatch[selectedBatchFolder].certs.map((c, i) => (
                            <tr key={c.id} style={{ 
                              borderBottom: '1px solid #f1f5f9', 
                              background: i % 2 === 0 ? '#ffffff' : '#fafafa'
                            }}>
                              <td style={{ padding: '9px 12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '600', color: '#0f172a' }}>{c.student_name}</span>
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>PRN: {c.student_prn || '—'}</span>
                                </div>
                              </td>
                              <td style={{ padding: '9px 12px', textTransform: 'capitalize' }}>
                                <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '10.5px', fontWeight: '600', padding: '2px 6px', borderRadius: '4px' }}>
                                  {c.student_role}
                                </span>
                              </td>
                              <td style={{ padding: '9px 12px', fontWeight: '500', color: '#0f172a' }}>{c.data?.title || 'Certificate'}</td>
                              <td style={{ padding: '9px 12px', fontSize: '11.5px', color: '#64748b' }}>
                                {new Date(c.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={() => {
                                      const link = document.createElement('a')
                                      const rawUrl = c.data?.url
                                      const finalToken = (typeof token !== 'undefined' ? token : '') || localStorage.getItem('token') || ''
                                      let downloadUrl = rawUrl
                                      if (rawUrl && rawUrl.startsWith('/api/')) {
                                        downloadUrl = `${API}${rawUrl}?token=${finalToken}`
                                      } else if (rawUrl && rawUrl.startsWith('data:')) {
                                        downloadUrl = rawUrl
                                      } else if (rawUrl) {
                                        downloadUrl = rawUrl.includes('?') ? `${rawUrl}&token=${finalToken}` : `${rawUrl}?token=${finalToken}`
                                      }
                                      link.href = downloadUrl
                                      link.download = c.data?.title || 'Certificate'
                                      document.body.appendChild(link)
                                      link.click()
                                      document.body.removeChild(link)
                                    }}
                                    style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontWeight: '600', cursor: 'pointer' }}
                                  >
                                    Download
                                  </button>
                                  {!effectiveReadOnly && (
                                    <button 
                                      onClick={() => handleDeleteCertificate(c.id)}
                                      style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '4px', border: '1px solid #fecaca', background: '#ffffff', color: '#dc2626', fontWeight: '600', cursor: 'pointer' }}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
