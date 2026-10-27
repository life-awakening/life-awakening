import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  ShieldCheck,
  AlertTriangle,
  Save,
  Send,
  RefreshCw,
  FileCheck,
  UserCheck,
  Sparkles,
  Info,
  Clock,
  ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const CHECKLIST_ITEMS = [
  { key: 'parents_informed', label: '1. Parents / Guardians duly informed regarding rural immersion dates, itinerary & stay', category: 'Consent & Medical' },
  { key: 'signed_undertaking', label: '2. Medical & Parent Undertaking Form (Form IA) digitally signed and on record', category: 'Consent & Medical' },
  { key: 'medical_checkup_done', label: '3. Medical fitness confirmed & essential prescription medications in possession', category: 'Consent & Medical' },
  { key: 'college_id_card', label: '4. Valid MIT-WPU Student ID Card ready and in possession', category: 'Identity & Field Gear' },
  { key: 'clothing_ready', label: '5. Culturally appropriate, modest clothing packed (comfortable cotton attire)', category: 'Identity & Field Gear' },
  { key: 'shoes_sportswear', label: '6. Sturdy walking shoes / sportswear suitable for rural village terrain', category: 'Identity & Field Gear' },
  { key: 'beddings_ready', label: '7. Travel bedsheet, light blanket & sleeping accessories packed', category: 'Supplies & Logistics' },
  { key: 'toiletries_ready', label: '8. Personal hygiene kit, mosquito repellent & sun protection packed', category: 'Supplies & Logistics' },
  { key: 'medicines_ready', label: '9. Essential first-aid supplies & personal emergency medications packed', category: 'Supplies & Logistics' },
  { key: 'blank_notebook_ready', label: '10. Hardbound field survey notebook, pens & clipboard ready', category: 'Academic & Safety' },
  { key: 'laptop_dongle_ready', label: '11. Laptop, mobile hotspot/dongle & power bank fully charged (if assigned)', category: 'Academic & Safety' },
  { key: 'emergency_contacts_saved', label: '12. Emergency contact numbers of Faculty Mentor, Sarpanch & PHC saved', category: 'Academic & Safety' }
];

export default function RiPreparatoryChecklistTab({ authHeaders, addToast, student, isMobile: propIsMobile }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = propIsMobile !== undefined ? propIsMobile : windowWidth <= 768;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [checklistData, setChecklistData] = useState(null);

  const [form, setForm] = useState({
    parents_informed: false,
    signed_undertaking: false,
    medical_checkup_done: false,
    college_id_card: false,
    clothing_ready: false,
    shoes_sportswear: false,
    beddings_ready: false,
    toiletries_ready: false,
    medicines_ready: false,
    blank_notebook_ready: false,
    laptop_dongle_ready: false,
    emergency_contacts_saved: false,
    role_assigned: 'Field Investigator',
    additional_notes: ''
  });

  const isDirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const toast = useCallback((msg, type = 'info') => {
    if (addToast) addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  // Load Checklist from server
  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/preparatory-checklist`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setChecklistData(data);
        if (data?.checklist) {
          const ex = data.checklist;
          setForm({
            parents_informed: Boolean(ex.parents_informed),
            signed_undertaking: Boolean(ex.signed_undertaking),
            medical_checkup_done: Boolean(ex.medical_checkup_done),
            college_id_card: Boolean(ex.college_id_card),
            clothing_ready: Boolean(ex.clothing_ready),
            shoes_sportswear: Boolean(ex.shoes_sportswear),
            beddings_ready: Boolean(ex.beddings_ready),
            toiletries_ready: Boolean(ex.toiletries_ready),
            medicines_ready: Boolean(ex.medicines_ready),
            blank_notebook_ready: Boolean(ex.blank_notebook_ready),
            laptop_dongle_ready: Boolean(ex.laptop_dongle_ready),
            emergency_contacts_saved: Boolean(ex.emergency_contacts_saved),
            role_assigned: ex.role_assigned || 'Field Investigator',
            additional_notes: ex.additional_notes || ex.student_notes || ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching preparatory checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const existing = checklistData?.checklist || {};
  const isSubmitted = existing.status === 'Submitted' || existing.status === 'Reviewed';
  const isCorrection = existing.status === 'Requires Correction' || checklistData?.is_correction_requested;
  const canEdit = !isSubmitted || isCorrection;

  // Quiet background auto-save for drafts
  const saveDraftQuietly = useCallback(async (currentForm) => {
    if (!canEdit) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`${API}/api/ri/student/forms/preparatory-checklist`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...currentForm, status: 'Draft' })
      });
      if (res.ok) {
        setAutoSaveStatus('saved');
        isDirtyRef.current = false;
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } else {
        setAutoSaveStatus('idle');
      }
    } catch (e) {
      setAutoSaveStatus('idle');
    }
  }, [authHeaders, canEdit]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirtyRef.current || !canEdit) return;
    const timer = setTimeout(() => {
      saveDraftQuietly(form);
    }, 1200);
    return () => clearTimeout(timer);
  }, [form, canEdit, saveDraftQuietly]);

  const handleFieldChange = (key, val) => {
    isDirtyRef.current = true;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSelectAll = () => {
    if (!canEdit) return;
    isDirtyRef.current = true;
    setForm(prev => {
      const next = { ...prev };
      CHECKLIST_ITEMS.forEach(item => {
        next[item.key] = true;
      });
      return next;
    });
  };

  const handleSubmit = async (submitStatus) => {
    if (submitStatus === 'Submitted') {
      const allChecked = CHECKLIST_ITEMS.every(i => form[i.key]);
      if (!allChecked) {
        if (!confirm('Some readiness items are not checked yet. Are you sure you want to submit your Preparatory Checklist?')) {
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/preparatory-checklist`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...form, status: submitStatus })
      });
      const result = await res.json();
      if (res.ok) {
        toast(result.message || (submitStatus === 'Submitted' ? 'Preparatory Checklist submitted successfully!' : 'Draft saved successfully!'), 'success');
        isDirtyRef.current = false;
        fetchChecklist();
      } else {
        toast(result.message || 'Failed to save checklist', 'error');
      }
    } catch (err) {
      toast('Network error saving checklist', 'error');
    } finally {
      setSaving(false);
    }
  };

  const checkedCount = CHECKLIST_ITEMS.filter(i => form[i.key]).length;

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#047857' }} />
        <p style={{ fontSize: '13.5px', color: '#64748b', fontWeight: '600' }}>Loading Preparatory Checklist...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: isMobile ? '0 12px 60px 12px' : '0 16px 50px 16px',
      boxSizing: 'border-box',
      width: '100%'
    }}>
      
      {/* ── HEADER BANNER ── */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: isMobile ? '12px' : '16px',
        padding: isMobile ? '14px 16px' : '20px 24px',
        marginBottom: isMobile ? '14px' : '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px' }}>
          <div style={{
            width: isMobile ? '38px' : '44px',
            height: isMobile ? '38px' : '44px',
            borderRadius: '10px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <FileCheck size={isMobile ? 20 : 22} style={{ color: '#047857' }} />
          </div>
          <div>
            <h1 style={{
              fontSize: isMobile ? '19px' : '22px',
              fontWeight: '800',
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}>
              Preparatory Checklist
            </h1>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              Form IB • Pre-departure readiness and verification
            </p>
          </div>
        </div>

        {/* Right actions: Mark All Ready & Auto-save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canEdit && checkedCount < CHECKLIST_ITEMS.length && (
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                color: '#047857',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '6px 13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#d1fae5'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
            >
              <Sparkles size={13} /> Mark All 12 Ready
            </button>
          )}

          {/* Quiet auto-save status indicator */}
          {autoSaveStatus !== 'idle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {autoSaveStatus === 'saving' && (
                <span style={{ fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                  <RefreshCw size={13} className="animate-spin" /> Saving draft...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                  <CheckCircle2 size={13} /> Auto-saved ✓
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CORRECTION ALERT (IF ANY) ── */}
      {isCorrection && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: isMobile ? '12px' : '14px',
          padding: isMobile ? '14px 16px' : '16px 20px',
          marginBottom: isMobile ? '14px' : '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <AlertTriangle size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b' }}>Mentor Correction Request</div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#7f1d1d', lineHeight: 1.5 }}>
              {checklistData?.faculty_remarks || 'Please review your checklist entries, update where necessary, and resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* ── 12 CHECKLIST ITEMS ── */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: isMobile ? '12px' : '14px',
        padding: isMobile ? '16px 14px' : '20px',
        marginBottom: isMobile ? '14px' : '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <h3 style={{ margin: 0, fontSize: isMobile ? '13.5px' : '14px', fontWeight: '800', color: '#0f172a' }}>
            Pre-Departure Readiness Verifications (12 Items)
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
            {checkedCount} / {CHECKLIST_ITEMS.length} completed
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = Boolean(form[item.key]);
            return (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isMobile ? '10px' : '12px',
                  padding: isMobile ? '12px 14px' : '14px 18px',
                  backgroundColor: '#ffffff',
                  border: isChecked ? '1.5px solid #047857' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '13px',
                  cursor: canEdit ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  boxShadow: isChecked ? '0 1px 3px rgba(0,0,0,0.04)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canEdit}
                    onChange={(e) => handleFieldChange(item.key, e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#047857',
                      cursor: canEdit ? 'pointer' : 'default'
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isMobile ? '12.5px' : '13px',
                    fontWeight: isChecked ? '750' : '500',
                    color: isChecked ? '#0f172a' : '#334155',
                    lineHeight: 1.45,
                    marginBottom: '3px'
                  }}>
                    {item.label}
                  </div>
                  <span style={{
                    fontSize: '10.5px',
                    color: '#64748b',
                    backgroundColor: '#f1f5f9',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: '700'
                  }}>
                    {item.category}
                  </span>
                </div>
                {isChecked && (
                  <CheckCircle2 size={16} style={{ color: '#047857', flexShrink: 0, marginTop: '2px' }} />
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* ── DESIGNATED TEAM ROLE & REMARKS ── */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: isMobile ? '12px' : '14px',
        padding: isMobile ? '16px 14px' : '20px',
        marginBottom: isMobile ? '16px' : '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: isMobile ? '13.5px' : '14px', fontWeight: '800', color: '#0f172a' }}>
          Team Assignment & Preparedness Notes
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: isMobile ? '12px' : '16px',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Designated Team Role within Student Panel
            </label>
            <select
              value={form.role_assigned}
              disabled={!canEdit}
              onChange={(e) => handleFieldChange('role_assigned', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                backgroundColor: canEdit ? '#ffffff' : '#f8fafc',
                color: '#1e293b',
                fontWeight: '600',
                minHeight: '42px',
                boxSizing: 'border-box'
              }}
            >
              <option value="Team Leader">Team Leader</option>
              <option value="Field Investigator">Field Investigator</option>
              <option value="Documentation & Survey Lead">Documentation & Survey Lead</option>
              <option value="Community Liaison">Community Liaison</option>
              <option value="Logistics & Resource Manager">Logistics & Resource Manager</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Village & Panel Assignment
            </label>
            <input
              type="text"
              value={student?.village_name ? `${student.village_name} (${student.panel_name || 'Assigned Panel'})` : 'Assigned Immersion Cluster'}
              disabled
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13.5px',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                minHeight: '42px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
            Preparatory Remarks / Specific Preparedness Notes
          </label>
          <textarea
            rows={3}
            value={form.additional_notes}
            disabled={!canEdit}
            onChange={(e) => handleFieldChange('additional_notes', e.target.value)}
            placeholder="Mention any specific roles, medical alerts, special travel requirements, or prep briefing takeaways..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13.5px',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc',
              resize: 'vertical',
              boxSizing: 'border-box',
              minHeight: '84px',
              lineHeight: 1.5
            }}
          />
        </div>
      </div>

      {/* ── ACTION FOOTER ── */}
      {canEdit ? (
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '12px' : '14px',
          padding: isMobile ? '14px 16px' : '16px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          gap: '12px'
        }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', textAlign: isMobile ? 'center' : 'left' }}>
            {autoSaveStatus === 'saved' ? 'All changes automatically saved to draft.' : 'Draft is auto-saved as you type.'}
          </div>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? '10px' : '12px'
          }}>
            <button
              onClick={() => handleSubmit('Draft')}
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '42px',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              <Save size={15} /> Save Draft
            </button>
            <button
              onClick={() => handleSubmit('Submitted')}
              disabled={saving}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minHeight: '42px',
                width: isMobile ? '100%' : 'auto',
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.25)'
              }}
            >
              <Send size={15} /> {saving ? 'Submitting...' : isCorrection ? 'Update & Resubmit Checklist' : 'Submit Preparatory Checklist'}
            </button>
          </div>
        </div>
      ) : (
        isSubmitted && !isCorrection && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: isMobile ? '12px' : '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <CheckCircle2 size={22} style={{ color: '#059669', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#065f46' }}>Checklist Submitted & Locked</div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#047857' }}>
                All readiness verifications have been recorded. If updates are needed, your mentor will unlock it for revision.
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
