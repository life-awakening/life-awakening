import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import API_BASE_URL from '@/config/apiConfig';

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState('')
  const [visible, setVisible] = useState(false)
  const location = useLocation()

  // Load and check announcement
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setVisible(false)
      return
    }

    const apiBase = API_BASE_URL;
    fetch(`${apiBase}/api/announcement`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) return null
        return res.json()
      })
      .then(data => {
        if (data && data.announcement) {
          const dismissed = localStorage.getItem('dismissed_announcement')
          if (dismissed !== data.announcement) {
            setAnnouncement(data.announcement)
            setVisible(true)
          } else {
            setVisible(false)
          }
        } else {
          setVisible(false)
        }
      })
      .catch(() => {
        setVisible(false)
      })
  }, [location.pathname]) // Re-run check on page transition

  const handleDismiss = () => {
    localStorage.setItem('dismissed_announcement', announcement)
    setVisible(false)
  }

  // Only display after login on dashboard pages; suppress on login/verify pages
  const publicPaths = ['/login', '/verify']
  if (publicPaths.includes(location.pathname)) return null

  if (!visible || !announcement) return null

  return (
    <div style={{
      background: '#09090b',
      color: '#ffffff',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '13.5px',
      fontWeight: '600',
      borderBottom: '1px solid #27272a',
      position: 'relative',
      zIndex: 10000,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center' }}>
        <Bell size={16} style={{ color: '#ffffff', flexShrink: 0 }} />
        <span>{announcement}</span>
      </div>
      <button 
        onClick={handleDismiss} 
        style={{
          background: 'none',
          border: 'none',
          color: '#a1a1aa',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.color = '#ffffff'}
        onMouseLeave={(e) => e.target.style.color = '#a1a1aa'}
      >
        <X size={16} />
      </button>
    </div>
  )
}
