import React, { useState, useEffect } from 'react'
import { Database, Download, AlertOctagon, RefreshCw, Cpu, Activity, Info, ShieldAlert, FileJson, Server, Terminal, HardDrive } from 'lucide-react'

export default function MaintenanceTab({ token, apiBase, showToast, readonly }) {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  
  // Diagnostics states
  const [diagnostics, setDiagnostics] = useState(null)
  const [loadingDiag, setLoadingDiag] = useState(false)
  
  // Selected feature description drawer state
  const [selectedFeature, setSelectedFeature] = useState({
    title: 'Maintenance Lockout (System Offline)',
    desc: 'Toggle lockout status to restrict portal access for all student, faculty, and coordinator accounts. When active, non-admin login requests are blocked. Only super admins and admins are allowed to log in.'
  })

  const fetchSettings = async () => {
    if (!token) return
    try {
      const res = await fetch(`${apiBase}/api/superadmin/config`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMaintenanceMode(data.settings?.maintenance_mode === 'true')
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  const fetchDiagnostics = async () => {
    if (!token) return
    try {
      setLoadingDiag(true)
      const res = await fetch(`${apiBase}/api/superadmin/diagnostics`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setDiagnostics(data.diagnostics)
        }
      }
    } catch (err) {
      console.error('Failed to load diagnostics:', err)
    } finally {
      setLoadingDiag(false)
    }
  }

  const handleToggleMaintenance = async () => {
    if (readonly) return showToast('Action forbidden: You have read-only access.', 'error')
    const nextVal = !maintenanceMode
    try {
      showToast(nextVal ? 'Enabling maintenance mode...' : 'Disabling maintenance mode...')
      const res = await fetch(`${apiBase}/api/superadmin/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          settings: { maintenance_mode: String(nextVal) }
        })
      })
      if (res.ok) {
        setMaintenanceMode(nextVal)
        showToast(nextVal ? 'Maintenance mode active. Non-admin logins restricted.' : 'Maintenance mode deactivated.', 'success')
        setSelectedFeature({
          title: 'System Maintenance Mode Status',
          desc: nextVal 
            ? 'Maintenance Mode is currently ACTIVE. Standard student, faculty, and LTC member users are locked out from logging in. Authenticated administrators can still manage operations.'
            : 'Maintenance Mode is currently INACTIVE. Standard portal registration, student logins, and evaluations operations are accessible normally.'
        })
      } else {
        throw new Error('Failed to update setting')
      }
    } catch (err) {
      showToast('Error updating maintenance mode.', 'error')
    }
  }

  const handleDownloadBackup = async () => {
    try {
      showToast('Generating system backup...')
      const res = await fetch(`${apiBase}/api/superadmin/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Backup failed')

      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ltc_system_backup_${new Date().toISOString().slice(0, 10)}.json`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      showToast('Database backup downloaded successfully.')
    } catch (err) {
      showToast('Failed to download system database backup.', 'error')
    }
  }

  const handleDownloadBinaryBackup = async () => {
    try {
      showToast('Generating binary database backup (.backup)...')
      const res = await fetch(`${apiBase}/api/superadmin/backup-binary`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Backup failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `ltc_database_backup_${new Date().toISOString().slice(0, 10)}.backup`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      showToast('Binary database backup downloaded successfully.')
    } catch (err) {
      showToast('Failed to download binary database backup.', 'error')
    }
  }



  useEffect(() => {
    fetchSettings()
    fetchDiagnostics()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: '"Poppins", sans-serif' }}>
      
      {/* 1. Maintenance Operations Panel Table (Stacked) */}
      <div className="glass-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #dbeafe', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ borderBottom: '2px solid #eff6ff', paddingBottom: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a' }}>
            <Activity size={16} style={{ color: '#2563eb' }} /> Maintenance Operations Panel
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>Configure lockout controls and database tasks.</p>
        </div>
        
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ background: '#eff6ff', color: '#1e3a8a', fontSize: '12px' }}>Operation Item</th>
                <th style={{ background: '#eff6ff', color: '#1e3a8a', fontSize: '12px' }}>Action Trigger / Control</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Maintenance Mode Toggle */}
              <tr 
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedFeature({
                  title: 'Option 1: System Maintenance Lockout Mode',
                  desc: 'Restricts frontend access for all student, faculty, and LTC coordinator accounts. When enabled, non-admin login requests are blocked with a HTTP 503 response. Useful during database schema migrations, software version deployments, or course roll-overs.'
                })}
              >
                <td>
                  <span style={{ fontWeight: '700', color: '#1e3a8a', display: 'block' }}>Maintenance Lockout</span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Restricts student/faculty login endpoints</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '3px 8px',
                      fontSize: '9.5px',
                      fontWeight: '700',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      background: maintenanceMode ? '#dbeafe' : '#f0f7ff',
                      color: maintenanceMode ? '#1e40af' : '#2563eb',
                      border: '1px solid #bfdbfe'
                    }}>
                      {maintenanceMode ? 'Active' : 'Inactive'}
                    </span>
                    {!readonly && (
                      <button 
                        onClick={handleToggleMaintenance}
                        className="btn btn-sm"
                        style={{ 
                          borderRadius: '4px', 
                          padding: '4px 12px', 
                          fontSize: '11px', 
                          height: 'auto',
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: '600'
                        }}
                      >
                        {maintenanceMode ? 'Disable Lockout' : 'Enable Lockout'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {/* Row 2: Database Backup Snapshot */}
              <tr 
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedFeature({
                  title: 'System Snapshot Database Backup',
                  desc: 'Generates structured JSON or binary database snapshot backup files on the fly containing all data tables. Directly downloads to the host browser folder.'
                })}
              >
                <td>
                  <span style={{ fontWeight: '700', color: '#1e3a8a', display: 'block' }}>System Snapshot & Backups</span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Download database in JSON or binary format</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={handleDownloadBackup} 
                      className="btn btn-sm"
                      style={{ 
                        borderRadius: '4px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        padding: '4px 12px', 
                        fontSize: '11px', 
                        height: 'auto',
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: '600'
                      }}
                    >
                      <Download size={11} /> JSON Backup
                    </button>
                    <button 
                      onClick={handleDownloadBinaryBackup} 
                      className="btn btn-sm"
                      style={{ 
                        borderRadius: '4px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        padding: '4px 12px', 
                        fontSize: '11px', 
                        height: 'auto',
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: '600'
                      }}
                    >
                      <Download size={11} /> SQL .backup File
                    </button>
                  </div>
                </td>
              </tr>

              {/* Row 3: Secure Database Reset Reference */}
              {!readonly && (
                <tr 
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedFeature({
                    title: 'Database Reset & Purge (Dual-OTP Protected)',
                    desc: 'For maximum security and safety, database reset requires dual-party verification codes sent to authorized administrators. Access this feature in Settings -> Danger Zone.'
                  })}
                >
                  <td>
                    <span style={{ fontWeight: '700', color: '#1e3a8a', display: 'block' }}>Database Reset & Data Purge</span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>Protected by dual-party OTP verification (temporarily bypassed for Super Admin)</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                      Managed securely via <strong>Settings &rarr; Danger Zone</strong>
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Server Diagnostics Table (Stacked underneath) */}
      <div className="glass-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #dbeafe', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #eff6ff', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e3a8a' }}>
              <Cpu size={16} style={{ color: '#2563eb' }} /> Server Diagnostics Inspector
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>Real-time backend runtime environment and database statistics.</p>
          </div>
          <button 
            onClick={fetchDiagnostics} 
            disabled={loadingDiag}
            className="btn btn-outline btn-sm"
            style={{ borderRadius: '4px', border: '1px solid #bfdbfe', background: '#ffffff', color: '#2563eb', padding: '4px 10px', height: 'auto', fontSize: '11px', fontWeight: '600' }}
          >
            <RefreshCw size={11} className={loadingDiag ? 'spin' : ''} /> Refresh Metrics
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ background: '#eff6ff', color: '#1e3a8a', fontSize: '12px' }}>Diagnostic Key</th>
                <th style={{ background: '#eff6ff', color: '#1e3a8a', fontSize: '12px' }}>System Value</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics ? (
                <>
                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Database Storage Size',
                      desc: 'Reflects the actual file storage footprint consumed by the "ltc_db" PostgreSQL database, including table schema heaps, primary indexes, evaluation logs, and user tables. Safe pg_database_size execution query.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>Database Size</td>
                    <td>
                      <span style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', border: '1px solid #bfdbfe' }}>
                        {diagnostics.databaseSize}
                      </span>
                    </td>
                  </tr>
                  
                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Active SQL Connections count',
                      desc: 'The number of active SQL backend queries and TCP connection sockets currently open with the database pool server. Keeps track of client concurrency footprints.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>Active DB Pools</td>
                    <td>
                      <span style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', border: '1px solid #bfdbfe' }}>
                        {diagnostics.activeConnections} connections
                      </span>
                    </td>
                  </tr>

                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Node.js Engine Environment',
                      desc: 'Specifies the Node version runtime version running the Express API backend instance on the host operating system platform.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>Node.js / Platform</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>
                      {diagnostics.nodeVersion} ({diagnostics.platform})
                    </td>
                  </tr>

                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Application Server RSS Memory Allocation',
                      desc: 'The size of Resident Set Size (RSS) RAM memory partition occupied in the computer RAM memory space. Monitored to inspect leak-free performance.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>RAM Footprint (RSS)</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1e3a8a', fontSize: '12px' }}>
                      {diagnostics.memoryUsage}
                    </td>
                  </tr>

                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Application Instance Uptime',
                      desc: 'Measures how many seconds have elapsed since the backend server node command process was started. Essential to check runtime stability.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>Server Uptime</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#475569' }}>
                      {diagnostics.uptime}
                    </td>
                  </tr>

                  <tr 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFeature({
                      title: 'Schema Table Storage Counters',
                      desc: 'Summarizes real-time entity registration footprints in the database: Total users, total active batches, evaluations log records, and attendance log rows.'
                    })}
                  >
                    <td style={{ fontWeight: '600', color: '#1e3a8a' }}>Entity Summary (Table Rows)</td>
                    <td style={{ fontSize: '11px', color: '#1e3a8a', lineHeight: '1.4' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '2px' }}>
                        <span>Users:</span> <strong>{diagnostics.tableCounts?.users_count}</strong>
                        <span>Batches:</span> <strong>{diagnostics.tableCounts?.batches_count}</strong>
                        <span>Evaluations:</span> <strong>{diagnostics.tableCounts?.evaluations_count}</strong>
                        <span>Attendance:</span> <strong>{diagnostics.tableCounts?.attendance_count}</strong>
                      </div>
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    {loadingDiag ? 'Inspecting diagnostics metrics...' : 'Diagnostics metrics unavailable.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Interactive Feature Explainer (Bottom) */}
      <div 
        className="glass-card" 
        style={{ 
          background: '#f0f7ff', 
          borderRadius: '12px', 
          border: '1px solid #bfdbfe', 
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
        }}
      >
        <div style={{ padding: '8px', background: '#dbeafe', color: '#2563eb', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Info size={16} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>
            {selectedFeature.title}
          </h4>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#2563eb', lineHeight: '1.5', fontWeight: '500' }}>
            {selectedFeature.desc}
          </p>
        </div>
      </div>

    </div>
  )
}
