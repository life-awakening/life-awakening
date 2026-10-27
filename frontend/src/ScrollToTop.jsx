import React, { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
import { useLocation } from 'react-router-dom'

// Determine mobile at module level using matchMedia (no resize listener needed)
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches

export default function ScrollToTop({ watchDeps = [] }) {
  const [visible, setVisible] = useState(false)
  const [mobile, setMobile] = useState(isMobile())
  const location = useLocation()

  // Centralized Navigation and Tab scroll reset
  useEffect(() => {
    // 1. Reset window scroll instantly
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (typeof document !== 'undefined') {
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    // 2. Reset main content scrollable containers (excluding sidebars)
    const scrollableContainers = document.querySelectorAll(
      '.main-content, .desktop-content, .overflow-y-auto, .overflow-y-scroll, [style*="overflow-y: auto"], [style*="overflow-y: scroll"]'
    )
    scrollableContainers.forEach(container => {
      if (container.closest('.sidebar') || container.closest('aside') || container.classList.contains('sidebar') || container.classList.contains('mobile-sidebar')) {
        return
      }
      container.scrollTop = 0
      container.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [location.pathname, location.search, ...watchDeps])

  useEffect(() => {
    const toggleVisible = () => {
      setVisible(document.documentElement.scrollTop > window.innerHeight)
    }

    const mql = window.matchMedia('(max-width: 768px)')
    const handleMediaChange = (e) => setMobile(e.matches)

    window.addEventListener('scroll', toggleVisible, { passive: true })
    mql.addEventListener('change', handleMediaChange)

    return () => {
      window.removeEventListener('scroll', toggleVisible)
      mql.removeEventListener('change', handleMediaChange)
    }
  }, [])

  if (!visible) return null

  return (
    <>
      <style>{`
        .scroll-to-top-btn {
          display: flex;
          position: fixed;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.4);
        }
        .scroll-to-top-btn:hover {
          transform: translateY(-5px) scale(1.05);
          box-shadow: 0 15px 30px rgba(37, 99, 235, 0.6);
        }
      `}</style>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="scroll-to-top-btn"
        style={{
          bottom: mobile ? '110px' : '40px',
          right: mobile ? '20px' : '40px',
          width: mobile ? '44px' : '50px',
          height: mobile ? '44px' : '50px',
        }}
        title="Scroll to Top"
      >
        <ArrowUp size={mobile ? 20 : 24} />
      </button>
    </>
  )
}
