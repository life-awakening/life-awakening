import React from 'react'
import { Plus, Trash2, FileText, Globe, GraduationCap, BookOpen, Shield } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function DocumentsModule({
  documents,
  docForm,
  setDocForm,
  handleUploadDocument,
  handleDeleteDocument,
  Label
}) {
  const { t } = useLanguage()

  const getRoleBadge = (role) => {
    switch (role) {
      case 'student':
        return {
          label: t('Students Only'),
          bg: '#e6f4ea',
          color: '#137333',
          border: '#c2e7c9',
          icon: <GraduationCap size={11} />
        }
      case 'faculty':
        return {
          label: t('Faculty Only'),
          bg: '#e8f0fe',
          color: '#1a73e8',
          border: '#d2e3fc',
          icon: <BookOpen size={11} />
        }
      case 'ltc_member':
        return {
          label: t('LTC Members'),
          bg: '#f3e8ff',
          color: '#7e22ce',
          border: '#e9d5ff',
          icon: <Shield size={11} />
        }
      default:
        return {
          label: t('Visible to All'),
          bg: '#f1f5f9',
          color: '#475569',
          border: '#e2e8f0',
          icon: <Globe size={11} />
        }
    }
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '30px' }}>
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-header-left">
          <h2 className="page-title" style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
            {t("Documents & SOPs")}
          </h2>
          <p className="page-subtitle" style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            {t("Upload reference documents, templates, and guidelines for students, faculty, or LTC members")}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Create/Add form */}
        <div 
          style={{ 
            background: '#ffffff', 
            borderRadius: '16px', 
            padding: '24px', 
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02), 0 1px 3px rgba(0, 0, 0, 0.01)'
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} style={{ color: '#154388' }} /> {t("Add Document / Link")}
          </h3>
          <form onSubmit={handleUploadDocument} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                {t("Document Name")}
              </label>
              <input
                className="input-field"
                placeholder="e.g. LTC Guidelines 2025"
                required
                value={docForm.name}
                onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                style={{ marginBottom: 0, width: '100%', padding: '10px 14px', fontSize: '13.5px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                {t("URL / Google Drive Link")}
              </label>
              <input
                type="url"
                className="input-field"
                placeholder="https://drive.google.com/..."
                required
                value={docForm.url}
                onChange={e => setDocForm(f => ({ ...f, url: e.target.value }))}
                style={{ marginBottom: 0, width: '100%', padding: '10px 14px', fontSize: '13.5px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                {t("Visible To")}
              </label>
              <select
                className="input-field"
                value={docForm.target_role}
                onChange={e => setDocForm(f => ({ ...f, target_role: e.target.value }))}
                style={{ marginBottom: 0, width: '100%', padding: '10px 14px', fontSize: '13.5px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', backgroundColor: '#f8fafc', color: '#0f172a', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                <option value="all">{t("All Users")}</option>
                <option value="student">{t("Students Only")}</option>
                <option value="faculty">{t("Faculty Only")}</option>
                <option value="ltc_member">{t("LTC Members Only")}</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="btn" 
              style={{ 
                alignSelf: 'flex-start', 
                background: '#154388', 
                color: '#ffffff', 
                borderRadius: '10px', 
                fontWeight: '700', 
                padding: '10px 20px', 
                border: 'none', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                fontSize: '13.5px',
                boxShadow: '0 4px 12px rgba(21, 67, 136, 0.15)',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={15} /> {t("Add Document")}
            </button>
          </form>
        </div>

        {/* Right Side: List of documents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              {t("Uploaded Documents")}
            </h3>
            <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: '50px', padding: '3px 12px', fontSize: '12px', fontWeight: '700', border: '1px solid #e2e8f0' }}>
              {documents.length}
            </span>
          </div>
          
          {documents.length === 0 ? (
            <div 
              style={{ 
                background: '#ffffff', 
                borderRadius: '16px', 
                padding: '48px 24px', 
                textAlign: 'center', 
                border: '1.5px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#f8fafc', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e2e8f0' }}>
                <FileText size={24} />
              </div>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, fontWeight: '500' }}>
                {t("No reference documents uploaded yet.")}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {documents.map(d => {
                const badge = getRoleBadge(d.target_role)
                return (
                  <div 
                    key={d.id} 
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '18px',
                      border: '1.5px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.01), 0 1px 2px rgba(0, 0, 0, 0.01)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      transition: 'transform 0.2s, border-color 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.borderColor = '#cbd5e1'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${badge.bg}40` || '#f1f5f9', color: badge.color || '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 
                          style={{ 
                            fontSize: '14px', 
                            fontWeight: '750', 
                            color: '#0f172a', 
                            margin: '0 0 6px 0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }} 
                          title={d.name}
                        >
                          {d.name}
                        </h4>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '20px',
                          textTransform: 'uppercase',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          letterSpacing: '0.4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: 'auto', alignItems: 'center' }}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          background: '#f8fafc',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '10px',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: '750',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc' }}
                      >
                        {t("Open Link ↗")}
                      </a>
                      
                      <button
                        onClick={() => handleDeleteDocument(d.id)}
                        title={t("Delete Document")}
                        style={{
                          width: '32px',
                          height: '32px',
                          background: '#fff5f5',
                          border: '1.5px solid #fee2e2',
                          color: '#ef4444',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          flexShrink: 0
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
