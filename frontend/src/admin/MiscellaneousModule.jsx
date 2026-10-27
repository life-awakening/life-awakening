import React, { useState, useEffect } from 'react';
import { 
  Flag, AlertTriangle, ShieldAlert, HeartPulse, 
  Search, X 
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Local Modal helper
function Modal({ open, onClose, title, children, size = '' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`} style={{ maxWidth: size === 'xl' ? '960px' : size === 'lg' ? '720px' : '540px', borderRadius: '24px', overflow: 'hidden', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
        <div className="modal-header" style={{ background: '#154388', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: '850', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {title}
          </h3>
          <button className="btn-icon" onClick={onClose} style={{ border: 'none', padding: 6, background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export default function MiscellaneousModule({ token, toast }) {
  const { t } = useLanguage();

  // --- RED FLAGS STATE ---
  const [flags, setFlags] = useState([]);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [flagsSearch, setFlagsSearch] = useState('');
  const [selectedFlag, setSelectedFlag] = useState(null);

  // --- FETCH RED FLAGS ---
  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setLoadingFlags(true);
    try {
      const res = await fetch(`${API}/api/admin/red-flags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setFlags(data.flags || []);
      } else {
        toast(data.message || 'Failed to fetch red flags', 'error');
      }
    } catch (err) {
      toast('Network error fetching red flags', 'error');
    } finally {
      setLoadingFlags(false);
    }
  };

  const filteredFlags = flags.filter(f => 
    !flagsSearch || 
    f.student_name.toLowerCase().includes(flagsSearch.toLowerCase()) || 
    f.student_prn?.toLowerCase().includes(flagsSearch.toLowerCase()) ||
    f.category.toLowerCase().includes(flagsSearch.toLowerCase())
  );

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'Disturbance': return <ShieldAlert size={12} />;
      case 'Health Issue': return <HeartPulse size={12} />;
      default: return <AlertTriangle size={12} />;
    }
  };

  const getCategoryBadgeStyle = (category) => {
    switch(category) {
      case 'Disturbance': 
        return { bg: '#fee2e2', color: '#dc2626', border: '#fecaca' };
      case 'Health Issue': 
        return { bg: '#fff7ed', color: '#ea580c', border: '#ffedd5' };
      default: 
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '30px' }}>
      <style>{`
        .mod-input-field {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          background: #ffffff;
          outline: none;
          transition: all 0.2s ease;
        }
        .mod-input-field:focus {
          border-color: #154388;
          box-shadow: 0 0 0 3px rgba(21, 67, 136, 0.1);
        }

        .mod-table-row {
          border-bottom: 1px solid #f1f5f9;
          transition: all 0.15s ease;
        }
        .mod-table-row:hover {
          background-color: #f8fafc !important;
        }
      `}</style>

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-header-left">
          <h2 className="page-title" style={{ fontSize: '24px', fontWeight: '850', color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            {t("Miscellaneous & Flags")}
          </h2>
          <p className="page-subtitle" style={{ fontSize: '14px', color: '#64748b', margin: 0, fontWeight: '500' }}>
            {t("Monitor detailed red flag incidents reported by faculty members.")}
          </p>
        </div>
      </div>

      {/* RED FLAGS CONTENT */}
      <div 
        style={{ 
          background: '#ffffff', 
          border: '1.5px solid #e2e8f0', 
          borderRadius: '20px', 
          padding: '24px', 
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)'
        }}
        className="animate-fade-in"
      >
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input 
              type="text" 
              placeholder={t("Search student or category...")}
              className="mod-input-field" 
              value={flagsSearch} 
              onChange={e => setFlagsSearch(e.target.value)} 
              style={{ paddingLeft: '36px', height: '40px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '750', 
              color: '#1e40af', 
              background: '#eff6ff', 
              border: '1px solid #bfdbfe', 
              padding: '6px 14px', 
              borderRadius: '9999px' 
            }}>
              {filteredFlags.length} {filteredFlags.length === 1 ? t('Incident') : t('Incidents')}
            </span>
          </div>
        </div>

        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Student")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Reported By")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Category")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>{t("Notes / Details")}</th>
                  <th style={{ padding: '14px 18px', fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', textAlign: 'right', letterSpacing: '0.5px' }}>{t("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {loadingFlags ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                      {t("Loading red flags...")}
                    </td>
                  </tr>
                ) : filteredFlags.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '56px 0', color: '#94a3b8' }}>
                      <Flag size={32} style={{ display: 'block', margin: '0 auto 8px', color: '#cbd5e1' }} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{t("No red flags reported.")}</p>
                    </td>
                  </tr>
                ) : (
                  filteredFlags.map(f => {
                    const cBadge = getCategoryBadgeStyle(f.category);
                    return (
                      <tr key={f.id} className="mod-table-row">
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>{f.student_name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{f.student_prn} · {f.student_department}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>{f.faculty_name}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>{f.faculty_email}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '5px',
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              textTransform: 'uppercase',
                              background: cBadge.bg,
                              color: cBadge.color,
                              border: `1px solid ${cBadge.border}`,
                              letterSpacing: '0.5px'
                            }}
                          >
                            {getCategoryIcon(f.category)} {t(f.category)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#64748b', fontWeight: '500' }}>
                          {f.reason}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button 
                            className="btn btn-outline" 
                            onClick={() => setSelectedFlag(f)}
                            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                          >
                            {t("View Details")}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RED FLAG DETAILS MODAL */}
      <Modal open={!!selectedFlag} onClose={() => setSelectedFlag(null)} title={t("Red Flag Details")} size="md">
        {selectedFlag && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fce8e6', color: '#c5221f', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fad2cf' }}>
                <Flag size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{selectedFlag.student_name}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{t("PRN")}: {selectedFlag.student_prn} | {t("Dept")}: {selectedFlag.student_department}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("Reported By")}</span>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>{selectedFlag.faculty_name}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{t("Date Reported")}</span>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                  {new Date(selectedFlag.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{t("Category")}</span>
              <div>
                {(() => {
                  const cBadge = getCategoryBadgeStyle(selectedFlag.category);
                  return (
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: '800',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        textTransform: 'uppercase',
                        background: cBadge.bg,
                        color: cBadge.color,
                        border: `1px solid ${cBadge.border}`,
                        letterSpacing: '0.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {getCategoryIcon(selectedFlag.category)} {t(selectedFlag.category)}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{t("Reason / Detailed Notes")}</span>
              <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '16px', borderRadius: '12px', fontSize: '13.5px', color: '#334155', minHeight: '100px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {selectedFlag.reason}
              </div>
            </div>
            
            <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => setSelectedFlag(null)}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: '700', borderRadius: '10px', cursor: 'pointer' }}
              >
                {t("Close")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
