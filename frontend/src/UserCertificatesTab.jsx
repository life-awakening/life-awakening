import React, { useState, useEffect } from 'react'
import { Award, Download, RefreshCw, Lock, Sparkles, ChevronRight } from 'lucide-react'
import { useLanguage } from './context/LanguageContext'
import { generateCertificate } from './utils/generateCertificate'
import API_BASE_URL from '@/config/apiConfig';

export default function UserCertificatesTab({ token, myData, canAccessCertificates, onOpenFeedback }) {
  const { t } = useLanguage()
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [certLoading, setCertLoading] = useState(false)
  const API = API_BASE_URL;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchMyCerts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/certificates/my-certificates`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setCerts(data.certificates || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMyCerts()
  }, [])

  const handleDownloadCertificate = async () => {
    if (certLoading) return
    setCertLoading(true)
    try {
      const res = await fetch(
        `${API}/api/student/certificate-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) {
        alert(data.message || 'Certificate cannot be generated because your batch information is incomplete.')
        return
      }
      await generateCertificate(
        { fullName: data.fullName, ltcId: data.ltcId },
        { startDate: data.startDate, endDate: data.endDate },
        'Certificate_-_Life_Awakening_Program_signed_final.pdf'
      )
      if (typeof window !== 'undefined' && (myData?.id || data?.ltcId)) {
        localStorage.setItem(`cert_downloaded_${myData?.id || data?.ltcId}`, 'true')
      }
    } catch (err) {
      console.error(err)
      alert('Error: ' + err.message)
    } finally {
      setCertLoading(false)
    }
  }

  const completionCerts = certs.filter(c => c.type === 'completion')
  const specialCerts = certs.filter(c => c.type !== 'completion')
  
  // The certificate is available only after the Service Trainer Feedback form is completed
  const hasFeedbackSubmitted = Boolean(myData?.service_feedback_submitted)
  const hasCommonCert = canAccessCertificates !== undefined ? canAccessCertificates : hasFeedbackSubmitted

  const renderCertCard = (c) => {
    return (
      <div key={c.id} style={{ border: '1.5px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '750', color: '#0f172a' }}>{c.data?.title || 'Certificate'}</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
            {t("Issued on")}: {new Date(c.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => {
            const link = document.createElement('a')
            const rawUrl = c.data?.url
            let downloadUrl = rawUrl
            if (rawUrl && rawUrl.startsWith('/api/')) {
              downloadUrl = `${API}${rawUrl}?token=${token}`
            } else if (rawUrl && rawUrl.startsWith('data:')) {
              downloadUrl = rawUrl
            } else if (rawUrl) {
              downloadUrl = rawUrl.includes('?') ? `${rawUrl}&token=${token}` : `${rawUrl}?token=${token}`
            }
            link.href = downloadUrl
            link.download = c.data?.title || 'Certificate'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }}
          className="btn btn-primary"
          style={{ borderRadius: '50px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: 'auto' }}
        >
          <Download size={13} /> {t("Download")}
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card animate-fade-in" style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid var(--border)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} style={{ color: 'var(--primary)' }} /> {t("My Certificates")}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>{t("View and download completion and excellence certificates issued to you.")}</p>
        </div>
        <button onClick={fetchMyCerts} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12.5px', borderRadius: '50px' }}>
          <RefreshCw size={13} /> {t("Refresh")}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}><div className="spinner spinner-sm" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Completion Certificate Category */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', marginBottom: '14px', paddingLeft: '8px', borderLeft: '4px solid #ea580c', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {t("Completion Certificate")}
            </h3>
            
            {!hasCommonCert ? (
              <div style={{
                padding: '20px 22px',
                background: '#faf5ff',
                borderRadius: '14px',
                border: '1.5px dashed #d8b4fe',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e9d5ff' }}>
                    <Lock size={20} strokeWidth={2.2} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '14.5px', fontWeight: '800', color: '#581c87' }}>
                      {t("Certificate of Participation Locked")}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#7e22ce', lineHeight: '1.4' }}>
                      {t("Please complete and submit the Service & Trainer Feedback form to unlock and download your official Life Awakening Program certificate.")}
                    </p>
                  </div>
                </div>
                {onOpenFeedback && (
                  <button
                    type="button"
                    onClick={onOpenFeedback}
                    className="btn btn-primary"
                    style={{
                      borderRadius: '50px',
                      padding: '8px 18px',
                      fontSize: '12.5px',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#7e22ce',
                      borderColor: '#7e22ce'
                    }}
                  >
                    <Sparkles size={14} /> {t("Complete Feedback")} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1.5px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '750', color: '#0f172a' }}>{t("Certificate of Participation")}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                      {t("Life Awakening Program (LAP)")}
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadCertificate}
                    disabled={certLoading}
                    className="btn btn-primary"
                    style={{ borderRadius: '50px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', height: 'auto' }}
                  >
                    {certLoading ? (
                      <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t("Generating...")}</>
                    ) : (
                      <><Download size={13} /> {t("Download")}</>
                    )}
                  </button>
                </div>
                {completionCerts.map(c => renderCertCard(c))}
              </div>
            )}
          </div>

          {/* Special Category Certificate Category */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '850', color: '#0f172a', marginBottom: '14px', paddingLeft: '8px', borderLeft: '4px solid #10b981', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {t("Special Category Certificates")}
            </h3>
            {specialCerts.length === 0 ? (
              <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                {t("No special category certificates issued yet.")}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {specialCerts.map(c => renderCertCard(c))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
