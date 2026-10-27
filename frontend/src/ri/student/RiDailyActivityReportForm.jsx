import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Building2,
  Home,
  Lightbulb,
  MessageSquare,
  Download,
  Edit3,
  Send,
  X,
  Check
} from 'lucide-react';
import {
  COMMUNITY_PROJECT_OPTIONS,
  YES_NO_OPTIONS,
  FORM_IIIB_DEFAULT_VALUES
} from '../shared/riDailyActivitySchema';
import { downloadDailyActivityReportPdf } from '../utils/riFormHardCopyPdf';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

export default function RiDailyActivityReportForm({
  data,
  authHeaders,
  onClose,
  onNavigateToAnnexures,
  toast
}) {
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const formStatus = data?.form_status?.status || data?.status || 'Not Started';
  const isSubmitted = formStatus === 'Submitted' || formStatus === 'Reviewed';
  const isCorrection = formStatus === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = (!isSubmitted || isCorrection || isEditingResponse) && formStatus !== 'Reviewed';
  const existing = data?.report || {};
  const ctx = data?.context || {};

  const [form, setForm] = useState(() => ({
    ...FORM_IIIB_DEFAULT_VALUES,
    student_name: existing.student_name || ctx.student_name || '',
    school_name: existing.school_name || ctx.school_name || '',
    degree_program: existing.degree_program || ctx.degree_program || '',
    village_visited: existing.village_visited || ctx.village_name || '',
    total_days_in_village: existing.total_days_in_village || '5 Days',

    // 5.1 Seven-day visit plan
    seven_day_plan_completed: existing.seven_day_plan_completed || 'Yes',
    seven_day_plan_improvements: existing.seven_day_plan_improvements || '',

    // 5.2 Community project
    community_project_types: Array.isArray(existing.community_project_types)
      ? existing.community_project_types
      : (typeof existing.community_project_types === 'string'
        ? JSON.parse(existing.community_project_types || '[]')
        : []),
    community_project_other_text: existing.community_project_other_text || '',
    community_project_work_done: existing.community_project_work_done || '',
    community_project_suggestions: existing.community_project_suggestions || '',

    // 5.3 In depth study of one problem
    study_group_included: existing.study_group_included || 'Yes',
    study_problem_title: existing.study_problem_title || '',
    study_solution_submitted: existing.study_solution_submitted || 'Yes',
    study_presented_to_committee: existing.study_presented_to_committee || 'Yes',
    study_suggestions: existing.study_suggestions || '',

    // 5.4 Institutional visits
    institutions_visited_count: existing.institutions_visited_count ?? 2,
    institutional_visits_suggestions: existing.institutional_visits_suggestions || '',

    // 5.5 Home visits
    homes_visited_count: existing.homes_visited_count ?? 5,
    home_visits_suggestions: existing.home_visits_suggestions || '',

    // 6. Best practices
    best_practices_observed: existing.best_practices_observed || '',

    // 7. Other activities
    other_activities_implemented: existing.other_activities_implemented || '',

    // 8. Other issues / suggestions
    issues_affecting_implementation: existing.issues_affecting_implementation || '',
    suggestions_to_improve_program: existing.suggestions_to_improve_program || '',

    // 9. Remarks
    remarks: existing.remarks || '',

    // Activity Photos
    activity_photo_1: existing.activity_photo_1 || '',
    activity_photo_2: existing.activity_photo_2 || '',

    // Legacy fields preservation
    school_activity_types: existing.school_activity_types || [],
    school_activity_other_text: existing.school_activity_other_text || '',
    school_name_engaged: existing.school_name_engaged || '',
    school_students_count: existing.school_students_count || null,
    school_activity_details: existing.school_activity_details || '',
    school_activity_suggestions: existing.school_activity_suggestions || ''
  }));

  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const isDirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const handleDownloadHardCopy = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadDailyActivityReportPdf({ form, context: ctx });
      toast?.('Hard copy PDF downloaded successfully!', 'success');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast?.('Failed to generate hard copy PDF', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Auto-fill context helper if new
  useEffect(() => {
    if (ctx && !existing.id) {
      setForm(prev => ({
        ...prev,
        student_name: prev.student_name || ctx.student_name || '',
        school_name: prev.school_name || ctx.school_name || '',
        degree_program: prev.degree_program || ctx.degree_program || '',
        village_visited: prev.village_visited || ctx.village_name || ''
      }));
    }
  }, [ctx, existing.id]);

  const updateField = (field, value) => {
    if (!canEdit) return;
    isDirtyRef.current = true;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleProjectType = (type) => {
    if (!canEdit) return;
    isDirtyRef.current = true;
    setForm(prev => {
      const current = prev.community_project_types || [];
      const updated = current.includes(type)
        ? current.filter(t => t !== type)
        : [...current, type];
      return { ...prev, community_project_types: updated };
    });
  };

  // Quiet Draft Auto-Save
  const saveDraftQuietly = useCallback(async (currentForm) => {
    if (!canEdit || isSubmitted) return;
    setAutoSaveStatus('saving');
    try {
      const payload = {
        ...currentForm,
        status: 'Draft',
        is_final_submit: false
      };
      const res = await fetch(`${API}/api/ri/student/forms/daily-activity-report`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
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

  useEffect(() => {
    if (!isDirtyRef.current || !canEdit || isSubmitted) return;
    const timer = setTimeout(() => {
      saveDraftQuietly(form);
    }, 1200);
    return () => clearTimeout(timer);
  }, [form, canEdit, isSubmitted, saveDraftQuietly]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && canEdit && !isSubmitted) {
        saveDraftQuietly(formRef.current);
      }
    };
  }, [canEdit, isSubmitted, saveDraftQuietly]);

  // Submit Handler
  const handleSubmit = async (submitStatus) => {
    const isFinal = submitStatus === 'Submitted';
    if (isFinal) {
      if (!form.village_visited?.trim()) {
        toast?.('Please specify the village visited (Sr. 3)', 'error');
        return;
      }
      if (!form.school_name?.trim()) {
        toast?.('Please enter Name of School (Sr. 1)', 'error');
        return;
      }
      if (!form.degree_program?.trim()) {
        toast?.('Please enter Degree Program (Sr. 2)', 'error');
        return;
      }

      // Section 5.2 Community project (Compulsory)
      if (!form.community_project_types || form.community_project_types.length === 0) {
        toast?.('Section 5.2.1: Please select at least one community project (Compulsory)', 'error');
        return;
      }
      if (form.community_project_types.includes('Other') && !form.community_project_other_text?.trim()) {
        toast?.('Section 5.2.1: Please specify other community project', 'error');
        return;
      }
      if (!form.community_project_work_done?.trim()) {
        toast?.('Section 5.2.2: Work done by you in the project is compulsory', 'error');
        return;
      }
      if (!form.community_project_suggestions?.trim()) {
        toast?.('Section 5.2.3: Suggestions for community projects are compulsory', 'error');
        return;
      }

      // Section 5.3 In-depth study of one problem (Compulsory)
      if (!form.study_group_included) {
        toast?.('Section 5.3.1: Were you included in group of 5 students (Yes/No) is compulsory', 'error');
        return;
      }
      if (!form.study_problem_title?.trim()) {
        toast?.('Section 5.3.2: Title of problem identified by your group is compulsory', 'error');
        return;
      }
      if (!form.study_solution_submitted) {
        toast?.('Section 5.3.3: Did you submit the solution to problem identified (Yes/No) is compulsory', 'error');
        return;
      }
      if (!form.study_presented_to_committee) {
        toast?.('Section 5.3.4: Could you present the problem to school committee (Yes/No) is compulsory', 'error');
        return;
      }

      // Section 5.4 & 5.5 (Compulsory)
      if (form.institutions_visited_count === undefined || form.institutions_visited_count === null || Number(form.institutions_visited_count) < 1) {
        toast?.('Section 5.4.1: How many institutions you visited is compulsory (must be at least 1)', 'error');
        return;
      }
      if (form.homes_visited_count === undefined || form.homes_visited_count === null || Number(form.homes_visited_count) < 1) {
        toast?.('Section 5.5.1: How many homes you visited is compulsory (must be at least 1)', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        status: submitStatus,
        is_final_submit: isFinal,
        is_update_response: isEditingResponse
      };
      const res = await fetch(`${API}/api/ri/student/forms/daily-activity-report`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok) {
        toast?.(isEditingResponse ? 'Daily Activity Report updated and resubmitted successfully!' : (result.message || 'Daily Activity Report saved successfully'), 'success');
        isDirtyRef.current = false;
        setIsEditingResponse(false);
        onClose?.();
      } else {
        toast?.(result.message || 'Failed to save report', 'error');
      }
    } catch {
      toast?.('Network error saving report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ri-form-iiib-container" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', color: '#0f172a' }}>

      {/* ── TOP ACTION BAR (Autosave & Annexures Reference & Download Hard Copy) ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '16px'
      }}>
        <button
          type="button"
          onClick={handleDownloadHardCopy}
          disabled={isDownloadingPdf}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            color: '#065f46',
            border: '1.5px solid #10b981',
            padding: '6px 14px',
            borderRadius: '7px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease'
          }}
          title="Download printable A4 hard copy of this form"
        >
          {isDownloadingPdf ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Download size={13} />
          )}
          <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Hard Copy'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
      </div>

      {/* Mentor Correction Alert */}
      {isCorrection && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px',
          fontSize: '13px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Mentor Correction Request:</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
              {data?.faculty_remarks || 'Please review your daily activity report details, update as requested, and resubmit.'}
            </p>
          </div>
        </div>
      )}

      {/* Status Notice & Edit Response Banner */}
      {formStatus === 'Reviewed' ? (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '18px',
          fontSize: '12.5px',
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>Form IIIB has been officially evaluated and reviewed by faculty. Responses are finalized and read-only.</span>
        </div>
      ) : isSubmitted && !isCorrection ? (
        !isEditingResponse ? (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1.5px solid #bbf7d0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '18px',
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
                  Form IIIB Submitted
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '1px' }}>
                  Your responses have been recorded. You can edit your submitted answers anytime before faculty evaluation.
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
            marginBottom: '18px',
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
                  You are modifying your submitted response. Click "Update & Resubmit" to save your changes.
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

      {/* ── CONTINUOUS VERTICAL FORM SECTIONS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>

        {/* ── BASIC INFORMATION (Sr. 1 – 4 + Name of student) ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            Basic Information (Indicators 1 – 3)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* Name of student */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  Name of student *
                </label>
              </div>
              <input
                type="text"
                value={form.student_name}
                disabled={!canEdit}
                placeholder="Full student name"
                onChange={(e) => updateField('student_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* Sr. 1 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  1. Name of School *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="text"
                value={form.school_name}
                disabled={!canEdit}
                placeholder="Enter school name"
                onChange={(e) => updateField('school_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* Sr. 2 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  2. Degree Program *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="text"
                value={form.degree_program}
                disabled={!canEdit}
                placeholder="Enter degree program"
                onChange={(e) => updateField('degree_program', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* Sr. 3 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  3. Name of the village visited *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="text"
                value={form.village_visited}
                disabled={!canEdit}
                placeholder="Enter village visited"
                onChange={(e) => updateField('village_visited', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>
          </div>
        </div>

        {/* ── 5. VISIT INFORMATION ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>5. Visit information <span style={{ color: '#dc2626' }}>*</span></span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'none', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '4px' }}>Compulsory Section</span>
          </div>



          {/* ── 5.2 Community project ── */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={15} style={{ color: '#047857' }} /> 5.2 Community project <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '4px' }}>Compulsory</span>
            </div>

            {/* 5.2.1 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.2.1 Which Community project you were involved <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Select at least one (Compulsory)</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {COMMUNITY_PROJECT_OPTIONS.map((opt) => {
                  const isChecked = (form.community_project_types || []).includes(opt);
                  return (
                    <label
                      key={opt}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: isChecked ? '1px solid #047857' : '1px solid #cbd5e1',
                        backgroundColor: isChecked ? '#ecfdf5' : '#ffffff',
                        color: isChecked ? '#047857' : '#334155',
                        fontSize: '12.5px',
                        fontWeight: isChecked ? '700' : '500',
                        cursor: canEdit ? 'pointer' : 'default'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!canEdit}
                        onChange={() => toggleProjectType(opt)}
                        style={{ accentColor: '#047857' }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>

            {(form.community_project_types || []).includes('Other') && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Specify other community project: <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.community_project_other_text}
                  disabled={!canEdit}
                  onChange={(e) => updateField('community_project_other_text', e.target.value)}
                  placeholder="e.g. Village library setup, water drainage cleaning"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                  }}
                />
              </div>
            )}

            {/* 5.2.2 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.2.2 Work done by you <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Explain work done by you in the project</span>
              </div>
              <textarea
                rows={2}
                required
                value={form.community_project_work_done}
                disabled={!canEdit}
                onChange={(e) => updateField('community_project_work_done', e.target.value)}
                placeholder="Explain work done by you in the project..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'vertical',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* 5.2.3 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.2.3 Suggestions for new areas and / or improvement in community projects <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <textarea
                rows={2}
                required
                value={form.community_project_suggestions}
                disabled={!canEdit}
                onChange={(e) => updateField('community_project_suggestions', e.target.value)}
                placeholder="Suggestions for new areas and / or improvement in community projects..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'vertical',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>
          </div>

          {/* ── 5.3 In depth study of one problem ── */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lightbulb size={15} style={{ color: '#047857' }} /> 5.3 In depth study of one problem <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '4px' }}>Compulsory</span>
            </div>

            {/* 5.3.1 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.3.1 Were you included in group of 5 students to study on problem in village <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write appropriate response (Yes / No)</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {YES_NO_OPTIONS.map((opt) => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: canEdit ? 'pointer' : 'default', color: '#334155' }}>
                    <input
                      type="radio"
                      name="study_group_included"
                      value={opt}
                      checked={form.study_group_included === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('study_group_included', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* 5.3.2 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.3.2 Title of problem identified by your group <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write title of the identified problem</span>
              </div>
              <input
                type="text"
                required
                value={form.study_problem_title}
                disabled={!canEdit}
                onChange={(e) => updateField('study_problem_title', e.target.value)}
                placeholder="Write title of the identified problem"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* 5.3.3 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.3.3 Did you submit the solution to problem identified <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write appropriate response (Yes / No)</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {YES_NO_OPTIONS.map((opt) => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: canEdit ? 'pointer' : 'default', color: '#334155' }}>
                    <input
                      type="radio"
                      name="study_solution_submitted"
                      value={opt}
                      checked={form.study_solution_submitted === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('study_solution_submitted', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* 5.3.4 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.3.4 Could you present the problem and solution identified to school committee <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write appropriate response (Yes / No)</span>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                {YES_NO_OPTIONS.map((opt) => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: canEdit ? 'pointer' : 'default', color: '#334155' }}>
                    <input
                      type="radio"
                      name="study_presented_to_committee"
                      value={opt}
                      checked={form.study_presented_to_committee === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('study_presented_to_committee', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {/* 5.3.5 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.3.5 Suggestions for improvements regarding in-depth study activity
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <textarea
                rows={2}
                value={form.study_suggestions}
                disabled={!canEdit}
                onChange={(e) => updateField('study_suggestions', e.target.value)}
                placeholder="Suggestions for improvements regarding in-depth study activity..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'vertical',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>
          </div>

          {/* ── 5.4 Institutional visits ── */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={15} style={{ color: '#047857' }} /> 5.4 Institutional visits <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '1px 6px', borderRadius: '4px' }}>Compulsory</span>
            </div>

            {/* 5.4.1 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.4.1 How many institutions you visited during village visit <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write number of institutions visited (Min 1)</span>
              </div>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={form.institutions_visited_count}
                disabled={!canEdit}
                onChange={(e) => updateField('institutions_visited_count', parseInt(e.target.value, 10) || 0)}
                placeholder="e.g. 2"
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: (!form.institutions_visited_count || Number(form.institutions_visited_count) < 1) ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* 5.4.2 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.4.2 Suggestions for improvement in institutional visit
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <textarea
                rows={2}
                value={form.institutional_visits_suggestions}
                disabled={!canEdit}
                onChange={(e) => updateField('institutional_visits_suggestions', e.target.value)}
                placeholder="Suggestions for improvement in institutional visit..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'vertical',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>
          </div>

          {/* ── 5.5 Home visits ── */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Home size={15} style={{ color: '#047857' }} /> 5.5 Home visits
            </div>

            {/* 5.5.1 */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.5.1 How many homes you visited <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Write number of homes visited (Min 1)</span>
              </div>
              <input
                type="number"
                min="1"
                max="100"
                required
                value={form.homes_visited_count}
                disabled={!canEdit}
                onChange={(e) => updateField('homes_visited_count', parseInt(e.target.value, 10) || 0)}
                placeholder="e.g. 5"
                style={{
                  width: '100%',
                  maxWidth: '200px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: (!form.homes_visited_count || Number(form.homes_visited_count) < 1) ? '1.5px solid #f87171' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>

            {/* 5.5.2 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5.5.2 Suggestions for improvement in home visits
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <textarea
                rows={2}
                value={form.home_visits_suggestions}
                disabled={!canEdit}
                onChange={(e) => updateField('home_visits_suggestions', e.target.value)}
                placeholder="Suggestions for improvement in home visits..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  resize: 'vertical',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
            </div>
          </div>
        </div>

        {/* ── 6. BEST PRACTICES OF VILLAGE OBSERVED DURING VISIT ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
              6. Best practices of village observed during visit
            </label>
            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
          </div>
          <textarea
            rows={2}
            value={form.best_practices_observed}
            disabled={!canEdit}
            onChange={(e) => updateField('best_practices_observed', e.target.value)}
            placeholder="Highlight positive traditions, water management systems, cooperative societies, cleanliness habits, or local innovations..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              resize: 'vertical',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
            }}
          />
        </div>

        {/* ── 7. ANY OTHER IMPORTANT ACTIVITY IMPLEMENTED ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
              7. Any other important activity implemented
            </label>
            <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
          </div>
          <textarea
            rows={2}
            value={form.other_activities_implemented}
            disabled={!canEdit}
            onChange={(e) => updateField('other_activities_implemented', e.target.value)}
            placeholder="Record any other notable activity, camp, awareness session, or cultural interaction..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              resize: 'vertical',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
            }}
          />
        </div>

        {/* ── 8. OTHER ISSUES / SUGGESTIONS ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            8. Other issues / suggestions
          </div>

          {/* 8.1 */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                8.1 Any important issues affecting implementation of RI Program not mentioned before
              </label>
              <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
            </div>
            <textarea
              rows={2}
              value={form.issues_affecting_implementation}
              disabled={!canEdit}
              onChange={(e) => updateField('issues_affecting_implementation', e.target.value)}
              placeholder="Logistics, communication, local coordination issues..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                resize: 'vertical',
                backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
              }}
            />
          </div>

          {/* 8.2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                8.2 Suggestions by students to improve the RI program
              </label>
              <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
            </div>
            <textarea
              rows={2}
              value={form.suggestions_to_improve_program}
              disabled={!canEdit}
              onChange={(e) => updateField('suggestions_to_improve_program', e.target.value)}
              placeholder="Student suggestions on preparation, timing, mentorship, or resources..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                resize: 'vertical',
                backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
              }}
            />
          </div>
        </div>

        {/* ── 9. REMARKS ── */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
              9. Remarks
            </label>
          </div>
          <textarea
            rows={2}
            value={form.remarks}
            disabled={!canEdit}
            onChange={(e) => updateField('remarks', e.target.value)}
            placeholder="Overall remarks or closing observations..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              resize: 'vertical',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
            }}
          />
        </div>



      </div>

      {/* ── ACTION BUTTONS ── */}
      {isSubmitted && !isCorrection && !isEditingResponse && formStatus !== 'Reviewed' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '12.5px', color: '#15803d', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={15} />
            <span>Status: Form IIIB Submitted</span>
          </div>
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
      ) : isEditingResponse ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setIsEditingResponse(false);
              isDirtyRef.current = false;
            }}
            disabled={submitting}
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
            disabled={submitting}
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
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Update & Resubmit Form IIIB</span>
              </>
            )}
          </button>
        </div>
      ) : canEdit ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
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
            disabled={submitting}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#047857',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {submitting ? 'Submitting...' : isCorrection ? 'Update & Resubmit Form IIIB' : 'Final Submit Form IIIB'}
          </button>
        </div>
      ) : null}

    </div>
  );
}
