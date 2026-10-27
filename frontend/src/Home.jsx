import React, { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    window.location.replace('/lifetransformation.org.in/index.html');
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh', 
      background: '#0a082c', 
      color: '#ffffff',
      fontFamily: 'sans-serif' 
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#ffffff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', opacity: 0.8 }}>Loading Life Transformation Centre...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
