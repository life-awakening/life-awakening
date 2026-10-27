import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Check,
  ImagePlus,
  Download,
  Edit3,
  Send,
  X
} from 'lucide-react';
import {
  INSTITUTION_FORM_SECTIONS,
  INSTITUTION_TYPES_OPTIONS,
  getInitialInstitutionSections,
  validateInstitutionVisit,
  validateFormIVSections,
  calculateFormIVProgress
} from '../shared/riInstitutionSchema';
import { downloadInstitutionalVisitsPdf } from '../utils/riFormHardCopyPdf';
import SecureImage from '../shared/SecureImage';
import { resolveCleanFileUrl, openSecureFile } from '../utils/secureFileHelpers';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

// Clean URL resolver without token parameter leakage
const resolveImageUrl = (url) => resolveCleanFileUrl(url);

export default function RiInstitutionalVisitsForm({ data, authHeaders, onClose, onNavigateToAnnexures, toast }) {
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const existingVisits = data?.visits || [];
  const status = data?.form_status?.status || data?.status || (existingVisits.length > 0 ? existingVisits[0].status : 'Not Started');
  const isSubmitted = status === 'Submitted' || status === 'Reviewed';
  const isCorrection = status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = (!isSubmitted || isCorrection || isEditingResponse) && status !== 'Reviewed';

  // Initialize Visited Institutions (Minimum 2 required by RUIP guidelines)
  const [visits, setVisits] = useState(() => {
    if (existingVisits.length > 0) {
      return existingVisits.map(v => ({
        ...v,
        official_contact_person: v.official_contact_person || v.officials_met || '',
        official_designation: v.official_designation || '',
        services_provided: v.services_provided || v.key_functions || '',
        observations: v.key_observations || v.observations || '',
        challenges_identified: v.challenges_identified || v.challenges_observed || '',
        recommendations: v.recommendations || '',
        has_electricity: v.electricity_available !== false && Boolean(v.has_electricity ?? true),
        has_drinking_water: v.drinking_water_available !== false && Boolean(v.has_drinking_water ?? true),
        has_computer_internet: Boolean(v.has_computer_internet),
        has_separate_toilets: v.toilet_available !== false && Boolean(v.has_separate_toilets ?? true),
        visit_date: v.visit_date ? v.visit_date.split('T')[0] : new Date().toISOString().split('T')[0]
      }));
    }
    return [
      {
        institution_type: 'Gram Panchayat Office',
        institution_name: '',
        official_contact_person: '',
        official_designation: '',
        services_provided: '',
        observations: '',
        challenges_identified: '',
        recommendations: '',
        has_electricity: true,
        has_drinking_water: true,
        has_computer_internet: false,
        has_separate_toilets: true,
        visit_date: new Date().toISOString().split('T')[0]
      },
      {
        institution_type: 'Zilla Parishad Primary / High School',
        institution_name: '',
        official_contact_person: '',
        official_designation: '',
        services_provided: '',
        observations: '',
        challenges_identified: '',
        recommendations: '',
        has_electricity: true,
        has_drinking_water: true,
        has_computer_internet: false,
        has_separate_toilets: true,
        visit_date: new Date().toISOString().split('T')[0]
      }
    ];
  });

  // Initialize Form IV 9 Sections
  const [formSections, setFormSections] = useState(() => {
    const initial = getInitialInstitutionSections();
    let saved = data?.form_sections || {};
    if (!saved || Object.keys(saved).length === 0) {
      for (const v of existingVisits) {
        if (v.observation_data && typeof v.observation_data === 'object' && Object.keys(v.observation_data).length > 0) {
          saved = v.observation_data;
          break;
        }
        if (v.additional_details?.form_sections && typeof v.additional_details.form_sections === 'object' && Object.keys(v.additional_details.form_sections).length > 0) {
          saved = v.additional_details.form_sections;
          break;
        }
      }
    }

    if (saved && typeof saved === 'object') {
      INSTITUTION_FORM_SECTIONS.forEach(sec => {
        if (saved[sec.key]) {
          initial[sec.key] = { ...initial[sec.key], ...saved[sec.key] };
        }
      });
    }
    return initial;
  });

  const [activityPhotos, setActivityPhotos] = useState(() => ({
    activity_photo_1: data?.activity_photo_1 || existingVisits[0]?.activity_photo_1 || existingVisits[0]?.additional_details?.activity_photo_1 || '',
    activity_photo_2: data?.activity_photo_2 || existingVisits[0]?.activity_photo_2 || existingVisits[0]?.additional_details?.activity_photo_2 || ''
  }));
  const [uploadingPhoto1, setUploadingPhoto1] = useState(false);
  const [uploadingPhoto2, setUploadingPhoto2] = useState(false);

  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const isDirtyRef = useRef(false);
  const stateRef = useRef({ visits, formSections, activityPhotos });
  stateRef.current = { visits, formSections, activityPhotos };

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadHardCopy = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadInstitutionalVisitsPdf({
        visits,
        formSections,
        context: data?.context
      });
      toast?.('Institutional Visits (Form IV) PDF downloaded!', 'success');
    } catch (err) {
      console.error('Failed to generate Institutional Visits PDF:', err);
      toast?.('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Auto-save draft handler
  const saveDraftQuietly = useCallback(async (currentVisits, currentSections, currentPhotos) => {
    if (!canEdit || isSubmitted) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`${API}/api/ri/student/forms/institutional-visits`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          visits: currentVisits,
          form_sections: currentSections,
          activity_photo_1: currentPhotos.activity_photo_1,
          activity_photo_2: currentPhotos.activity_photo_2,
          status: 'Draft'
        })
      });
      if (res.ok) {
        setAutoSaveStatus('saved');
        isDirtyRef.current = false;
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } else {
        setAutoSaveStatus('idle');
      }
    } catch {
      setAutoSaveStatus('idle');
    }
  }, [authHeaders, canEdit, isSubmitted]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirtyRef.current || !canEdit || isSubmitted) return;
    const timer = setTimeout(() => {
      saveDraftQuietly(visits, formSections, activityPhotos);
    }, 1200);
    return () => clearTimeout(timer);
  }, [visits, formSections, activityPhotos, canEdit, isSubmitted, saveDraftQuietly]);

  // Save draft on unmount
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && canEdit && !isSubmitted) {
        saveDraftQuietly(stateRef.current.visits, stateRef.current.formSections, stateRef.current.activityPhotos);
      }
    };
  }, [canEdit, isSubmitted, saveDraftQuietly]);

  // Visits manipulation
  const addInstitution = () => {
    isDirtyRef.current = true;
    setVisits([
      ...visits,
      {
        institution_type: 'Primary Health Centre (PHC) / Sub-Centre',
        institution_name: '',
        official_contact_person: '',
        official_designation: '',
        services_provided: '',
        observations: '',
        challenges_identified: '',
        recommendations: '',
        has_electricity: true,
        has_drinking_water: true,
        has_computer_internet: false,
        has_separate_toilets: true,
        visit_date: new Date().toISOString().split('T')[0]
      }
    ]);
  };

  const removeInstitution = (idx) => {
    if (visits.length <= 1) {
      toast('At least one village institution observation is required.', 'warning');
      return;
    }
    isDirtyRef.current = true;
    setVisits(visits.filter((_, i) => i !== idx));
  };

  const updateVisit = (idx, field, val) => {
    isDirtyRef.current = true;
    const updated = [...visits];
    updated[idx][field] = val;
    setVisits(updated);
  };

  // Form IV sections manipulation
  const updateSectionField = (sectionKey, questionId, val) => {
    isDirtyRef.current = true;
    setFormSections(prev => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        [questionId]: val
      }
    }));
  };

  // Photo Upload Handler
  const handlePhotoUpload = async (photoSlot, file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      toast?.('Only JPG, PNG, or WEBP images are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast?.('Photo must be under 5 MB.', 'error');
      return;
    }

    if (photoSlot === 1) setUploadingPhoto1(true);
    else setUploadingPhoto2(true);

    try {
      const fd = new FormData();
      fd.append('photo', file);
      const token = authHeaders['Authorization']?.replace('Bearer ', '') || localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/student/forms/institutional-visits/upload-photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const resData = await res.json();
      if (res.ok && resData.url) {
        toast?.(`Activity Photo ${photoSlot} uploaded successfully!`, 'success');
        isDirtyRef.current = true;
        setActivityPhotos(prev => ({
          ...prev,
          [photoSlot === 1 ? 'activity_photo_1' : 'activity_photo_2']: resData.url
        }));
      } else {
        toast?.(resData.message || 'Upload failed', 'error');
      }
    } catch {
      toast?.('Network error uploading photo', 'error');
    } finally {
      if (photoSlot === 1) setUploadingPhoto1(false);
      else setUploadingPhoto2(false);
    }
  };

  // Submission handler
  const handleSubmit = async (submitStatus) => {
    if (submitStatus === 'Submitted') {
      if (visits.length < 1) {
        toast('Please record at least 1 institution observation.', 'error');
        return;
      }
      for (let i = 0; i < visits.length; i++) {
        const err = validateInstitutionVisit(visits[i], i);
        if (err) {
          toast(err, 'error');
          return;
        }
      }

      const secErr = validateFormIVSections(formSections);
      if (secErr) {
        toast(secErr, 'error');
        return;
      }

      if (!activityPhotos.activity_photo_1?.trim() || !activityPhotos.activity_photo_2?.trim()) {
        toast('Both Activity Photos (Photo 1 and Photo 2) are compulsory before final submission.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/institutional-visits`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          visits,
          form_sections: formSections,
          activity_photo_1: activityPhotos.activity_photo_1,
          activity_photo_2: activityPhotos.activity_photo_2,
          status: submitStatus,
          is_final_submit: submitStatus === 'Submitted',
          is_update_response: isEditingResponse
        })
      });
      const result = await res.json();
      if (res.ok) {
        toast(isEditingResponse ? 'Institutional Visit Observations updated and resubmitted successfully!' : (result.message || (submitStatus === 'Submitted' ? 'Form IV officially submitted!' : 'Draft saved successfully')), 'success');
        isDirtyRef.current = false;
        setIsEditingResponse(false);
        onClose();
      } else {
        toast(result.message || 'Failed to save form', 'error');
      }
    } catch {
      toast('Network error saving form', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── TOP ACTION BAR (Autosave & Annexures Reference) ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px',
        flexWrap: 'wrap'
      }}>
        {autoSaveStatus === 'saving' && (
          <span style={{ fontSize: '12px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <RefreshCw size={12} className="animate-spin" /> Saving draft...
          </span>
        )}
        {autoSaveStatus === 'saved' && (
          <span style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <CheckCircle2 size={13} /> Auto-saved ✓
          </span>
        )}
        <button
          type="button"
          onClick={handleDownloadHardCopy}
          disabled={isDownloadingPdf}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            color: '#065f46',
            border: '1.5px solid #a7f3d0',
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: isDownloadingPdf ? 'wait' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
          title="Download printable A4 blank/filled hard copy PDF"
        >
          {isDownloadingPdf ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <Download size={13} />
              <span>Download Hard Copy</span>
            </>
          )}
        </button>
        {onNavigateToAnnexures && (
          <button
            type="button"
            onClick={() => {
              onClose?.();
              onNavigateToAnnexures();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#f0fdf4',
              color: '#047857',
              border: '1px solid #bbf7d0',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <span>Annexures Reference →</span>
          </button>
        )}
      </div>

      {/* Mentor Correction Alert */}
      {isCorrection && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#991b1b' }}>
          <strong>⚠️ Mentor Correction Request:</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
            {data?.form_status?.faculty_remarks || data?.faculty_remarks || 'Please update your institutional visit observations as requested by your mentor and resubmit.'}
          </p>
        </div>
      )}

      {/* Status Notice & Edit Response Banner */}
      {status === 'Reviewed' ? (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', fontSize: '12.5px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>Form IV has been officially evaluated and reviewed by faculty. Responses are finalized and read-only.</span>
        </div>
      ) : isSubmitted && !isCorrection ? (
        !isEditingResponse ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={19} style={{ color: '#16a34a', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d' }}>
                  Form IV Officially Submitted
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '1px' }}>
                  Your observations have been recorded. You can edit your responses anytime before faculty evaluation.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingResponse(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(4,120,87,0.25)'
              }}
            >
              <Edit3 size={14} />
              <span>Edit Response</span>
            </button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit3 size={19} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#b45309' }}>
                  Editing Submitted Response
                </div>
                <div style={{ fontSize: '12px', color: '#92400e', marginTop: '1px' }}>
                  You are modifying your institutional visit observations. Click "Update & Resubmit" to save changes.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditingResponse(false);
                isDirtyRef.current = false;
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '6px 14px',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <X size={13} />
              <span>Cancel Editing</span>
            </button>
          </div>
        )
      ) : null}

      {/* ── PART 1: VISITED INSTITUTIONS (MINIMUM 2 INSTITUTIONS) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building2 size={16} style={{ color: '#047857' }} />
              Institutions Visited ({visits.length} Recorded — Minimum 2 Required)
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Record details of the primary institutions visited by your student group (e.g. Gram Panchayat, School, PHC, Anganwadi, Ration Shop).
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={addInstitution}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '6px',
                border: '1px solid #047857',
                backgroundColor: '#f0fdf4',
                color: '#047857',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Add Institution
            </button>
          )}
        </div>

        {visits.map((v, idx) => (
          <div
            key={idx}
            style={{
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '8px'
            }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} /> Institution #{idx + 1}
              </div>
              {canEdit && visits.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInstitution(idx)}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Institution Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={v.institution_type}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'institution_type', e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                >
                  {INSTITUTION_TYPES_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Institution Name & Village <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Z.P. Primary School, Kasurdi"
                  value={v.institution_name}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'institution_name', e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Official / Contact Person Met <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shri Patil (Gram Sevak), Dr. Kulkarni (MO)"
                  value={v.official_contact_person}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'official_contact_person', e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Date of Visit <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={v.visit_date ? v.visit_date.split('T')[0] : ''}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'visit_date', e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>
            </div>

            {/* Infrastructure Utilities */}
            <div style={{ marginBottom: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                Key Infrastructure Available on Site:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '12.5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(v.has_electricity)}
                    disabled={!canEdit}
                    onChange={(e) => updateVisit(idx, 'has_electricity', e.target.checked)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>Grid Electricity</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(v.has_drinking_water)}
                    disabled={!canEdit}
                    onChange={(e) => updateVisit(idx, 'has_drinking_water', e.target.checked)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>Drinking Water</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(v.has_computer_internet)}
                    disabled={!canEdit}
                    onChange={(e) => updateVisit(idx, 'has_computer_internet', e.target.checked)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>Computer & Internet</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(v.has_separate_toilets)}
                    disabled={!canEdit}
                    onChange={(e) => updateVisit(idx, 'has_separate_toilets', e.target.checked)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>Separate Toilets</span>
                </label>
              </div>
            </div>

            {/* Qualitative Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Key Functions & Services Provided <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Primary services delivered to village residents..."
                  value={v.services_provided}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'services_provided', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Key Field Observations & Physical Infrastructure <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Observations regarding staff presence, equipment, citizen access, condition..."
                  value={v.observations}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'observations', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Identified Challenges / Service Gaps <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Bottlenecks, fund shortages, staff vacancies, public grievances..."
                  value={v.challenges_identified}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'challenges_identified', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  Student Recommendations <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Actionable ideas to improve institutional delivery..."
                  value={v.recommendations}
                  disabled={!canEdit}
                  onChange={(e) => updateVisit(idx, 'recommendations', e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f1f5f9' }}
                />
              </div>
            </div>
          </div>
        ))}

        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={addInstitution}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1.5px dashed #047857',
                backgroundColor: '#f0fdf4',
                color: '#047857',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} /> Add Another Institution
            </button>
          </div>
        )}
      </div>

      {/* ── PART 2: FORM IV OFFICIAL QUESTIONNAIRE (SECTIONS 1 TO 9 SEQUENTIALLY ON THE SAME PAGE) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} style={{ color: '#047857' }} />
            Official Form IV Questionnaire (Sections 1–9)
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.45 }}>
            Instructions: Read each question and instructions carefully, inquire from village leaders (Sarpanch, Gram Sevak, Police Patil, Headmaster, ASHA, Talathi), and select/enter the observation for each section below.
          </div>
        </div>

        {INSTITUTION_FORM_SECTIONS.map((sec) => {
          const secData = formSections[sec.key] || {};

          return (
            <div
              key={sec.key}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              {/* Section Header */}
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Section {sec.sr}
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {sec.title}
                </h4>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{sec.subtitle}</div>
                {sec.note && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', fontStyle: 'italic', borderLeft: '3px solid #047857' }}>
                    Note: {sec.note}
                  </div>
                )}
              </div>

              {/* Section Questions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {sec.questions.map((q) => {
                  const val = secData[q.id] || '';

                  return (
                    <div
                      key={q.id}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                          {q.label} {q.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </label>

                        {q.instruction && (
                          <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                            ℹ️ {q.instruction}
                          </p>
                        )}
                      </div>

                      {q.type === 'select' && (
                        <select
                          value={val}
                          disabled={!canEdit}
                          onChange={(e) => updateSectionField(sec.key, q.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '9px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            backgroundColor: canEdit ? '#ffffff' : '#f1f5f9',
                            color: val ? '#0f172a' : '#64748b'
                          }}
                        >
                          <option value="">-- Select option --</option>
                          {q.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {q.type === 'text' && (
                        <input
                          type="text"
                          placeholder={q.placeholder || ''}
                          value={val}
                          disabled={!canEdit}
                          onChange={(e) => updateSectionField(sec.key, q.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '9px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            backgroundColor: canEdit ? '#ffffff' : '#f1f5f9'
                          }}
                        />
                      )}

                      {q.type === 'textarea' && (
                        <textarea
                          rows={3}
                          placeholder={q.placeholder || ''}
                          value={val}
                          disabled={!canEdit}
                          onChange={(e) => updateSectionField(sec.key, q.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '9px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            resize: 'vertical',
                            backgroundColor: canEdit ? '#ffffff' : '#f1f5f9'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ACTIVITY PHOTOS (ADD 2 PHOTOS) ── */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '18px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '800',
          color: '#0f172a',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ImagePlus size={18} style={{ color: '#047857' }} />
          <span>Activity Photos (Add 2 Photos) <span style={{ color: '#dc2626' }}>*</span></span>
          <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            Compulsory
          </span>
        </div>
        <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '16px', lineHeight: 1.45 }}>
          Upload high quality photographic evidence of your fieldwork, school engagement, or community activities in the village. <strong>Both photos are compulsory for submission.</strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {/* Photo 1 */}
          <div style={{ border: activityPhotos.activity_photo_1 ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: activityPhotos.activity_photo_1 ? '#f0fdf4' : '#f8fafc' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
              Activity Photo 1 <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {activityPhotos.activity_photo_1 && (
              <div style={{ marginBottom: '12px' }}>
                <SecureImage
                  src={activityPhotos.activity_photo_1}
                  alt="Activity Photo 1"
                  style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  onClick={() => openSecureFile(activityPhotos.activity_photo_1)}
                  title="Click to view full image in new tab"
                />
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Photo uploaded
                </div>
              </div>
            )}
            {canEdit && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', color: '#334155' }}>
                <ImagePlus size={15} />
                {uploadingPhoto1 ? 'Uploading...' : activityPhotos.activity_photo_1 ? 'Replace Photo 1' : 'Upload Activity Photo 1 *'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  disabled={uploadingPhoto1}
                  onChange={(e) => handlePhotoUpload(1, e.target.files?.[0])}
                />
              </label>
            )}
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Accepted: JPG, PNG, WEBP — Max 5 MB</div>
          </div>

          {/* Photo 2 */}
          <div style={{ border: activityPhotos.activity_photo_2 ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: activityPhotos.activity_photo_2 ? '#f0fdf4' : '#f8fafc' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
              Activity Photo 2 <span style={{ color: '#dc2626' }}>*</span>
            </label>
            {activityPhotos.activity_photo_2 && (
              <div style={{ marginBottom: '12px' }}>
                <SecureImage
                  src={activityPhotos.activity_photo_2}
                  alt="Activity Photo 2"
                  style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  onClick={() => openSecureFile(activityPhotos.activity_photo_2)}
                  title="Click to view full image in new tab"
                />
                <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Photo uploaded
                </div>
              </div>
            )}
            {canEdit && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', color: '#334155' }}>
                <ImagePlus size={15} />
                {uploadingPhoto2 ? 'Uploading...' : activityPhotos.activity_photo_2 ? 'Replace Photo 2' : 'Upload Activity Photo 2 *'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  disabled={uploadingPhoto2}
                  onChange={(e) => handlePhotoUpload(2, e.target.files?.[0])}
                />
              </label>
            )}
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Accepted: JPG, PNG, WEBP — Max 5 MB</div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTIONS & STATUS ── */}
      {isSubmitted && !isCorrection && !isEditingResponse && status !== 'Reviewed' ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '12.5px', color: '#15803d', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} />
            <span>Status: Form IV Officially Submitted</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDownloadHardCopy}
              disabled={isDownloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
                backgroundColor: '#f0fdf4',
                color: '#065f46',
                fontSize: '13px',
                fontWeight: '700',
                cursor: isDownloadingPdf ? 'wait' : 'pointer'
              }}
            >
              <Download size={14} />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download Hard Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingResponse(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(4, 120, 87, 0.25)'
              }}
            >
              <Edit3 size={15} />
              <span>Edit Response</span>
            </button>
          </div>
        </div>
      ) : isEditingResponse ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Progress: <strong>{calculateFormIVProgress(visits, formSections)}%</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setIsEditingResponse(false);
                isDirtyRef.current = false;
              }}
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel Editing
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('Submitted')}
              disabled={saving}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(4, 120, 87, 0.25)'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Update & Resubmit Form IV</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : canEdit ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          borderTop: '1px solid #e2e8f0',
          paddingTop: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Progress: <strong>{calculateFormIVProgress(visits, formSections)}%</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleDownloadHardCopy}
              disabled={isDownloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
                backgroundColor: '#f0fdf4',
                color: '#065f46',
                fontSize: '13px',
                fontWeight: '700',
                cursor: isDownloadingPdf ? 'wait' : 'pointer'
              }}
            >
              <Download size={14} />
              <span>{isDownloadingPdf ? 'Generating...' : 'Download Hard Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('Draft')}
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('Submitted')}
              disabled={saving}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#047857',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {saving ? 'Submitting...' : isCorrection ? 'Update & Resubmit Form IV' : 'Final Submit Form IV'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
