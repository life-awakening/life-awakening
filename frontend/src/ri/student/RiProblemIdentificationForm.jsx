import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  ExternalLink,
  Download,
  FileUp,
  Info,
  Calendar,
  Users,
  Award,
  Layers,
  ArrowRight,
  Edit3,
  Send,
  X
} from 'lucide-react';
import { openSecureFile, resolveCleanFileUrl } from '../utils/secureFileHelpers';
import {
  FORM_VI_DEFAULT_VALUES,
  SDG_OPTIONS,
  DEGREE_PROGRAM_OPTIONS,
  SOLUTION_OFFERED_OPTIONS,
  SOLUTION_PRACTICAL_OPTIONS,
  COMMITTEE_REMARKS_OPTIONS
} from '../shared/riProblemIdentificationSchema';
import { downloadProblemIdentificationPdf } from '../utils/riFormHardCopyPdf';

const API = import.meta.env.VITE_API_URL || '';

export default function RiProblemIdentificationForm({
  data,
  authHeaders,
  onClose,
  onNavigateToAnnexures,
  toast
}) {
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [showLeaderPopup, setShowLeaderPopup] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowLeaderPopup(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const existing = data?.problem || {};
  const isSubmitted = existing.status === 'Submitted' || existing.status === 'Reviewed';
  const isCorrection = existing.status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = (!isSubmitted || isCorrection || isEditingResponse) && existing.status !== 'Reviewed';

  // Initialize form values from existing record, supporting both top-level columns and form_data
  const initialData = existing.form_data && typeof existing.form_data === 'object'
    ? { ...FORM_VI_DEFAULT_VALUES, ...existing, ...existing.form_data }
    : { ...FORM_VI_DEFAULT_VALUES, ...existing };

  const [form, setForm] = useState({
    // 1 to 5
    school_name: initialData.school_name || '',
    department_name: initialData.department_name || initialData.department || '',
    degree_program: initialData.degree_program || '',
    village_visited: initialData.village_visited || initialData.village_name || '',
    students_participated: initialData.students_participated !== undefined && initialData.students_participated !== null && initialData.students_participated !== ''
      ? initialData.students_participated
      : '',

    // 6. Team information
    team_leader_name: initialData.team_leader_name || '',
    total_team_members: initialData.total_team_members !== undefined && initialData.total_team_members !== null
      ? initialData.total_team_members
      : 5,

    // 7. Problem / Issue identified
    problem_title: initialData.problem_title || '',
    is_aligned_with_sdg: initialData.is_aligned_with_sdg === true ? 'Yes' : initialData.is_aligned_with_sdg === false ? 'No' : (initialData.is_aligned_with_sdg || ''),
    is_related_to_degree: initialData.is_related_to_degree === true ? 'Yes' : initialData.is_related_to_degree === false ? 'No' : (initialData.is_related_to_degree || ''),

    // 8. Solution to problem / issue
    solution_offered: initialData.solution_offered || '',
    helping_faculty_name: initialData.helping_faculty_name || '',
    helping_faculty_dept: initialData.helping_faculty_dept || '',
    solution_is_practical_implementable: initialData.solution_is_practical_implementable || (initialData.solution_is_practical_smart === true ? 'Yes' : initialData.solution_is_practical_smart === false ? 'No' : ''),

    // 9. Presentation to committee
    committee_chairperson: initialData.committee_chairperson || '',
    presentation_date: initialData.presentation_date ? initialData.presentation_date.split('T')[0] : '',
    committee_remarks: initialData.committee_remarks || '',

    // 10 & 11
    sarpanch_informed_details: initialData.sarpanch_informed_details || initialData.sarpanch_informed_person || '',
    ri_cell_submission_details: initialData.ri_cell_submission_details || '',

    // Documents
    assignment_link: initialData.assignment_link || '',
    assignment_file_name: initialData.assignment_file_name || (initialData.assignment_link ? initialData.assignment_link.split('/').pop() : ''),
    presentation_link: initialData.presentation_link || ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const isDirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadHardCopy = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadProblemIdentificationPdf({
        form,
        context: data?.context
      });
      toast?.('Problem Identification (Form VI) PDF downloaded!', 'success');
    } catch (err) {
      console.error('Failed to generate Problem Identification PDF:', err);
      toast?.('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Auto-fill context helper if new and fields are empty
  useEffect(() => {
    if (data?.context && !existing.id) {
      setForm(prev => ({
        ...prev,
        department_name: prev.department_name || data.context.department || '',
        village_visited: prev.village_visited || data.context.village_name || ''
      }));
    }
  }, [data, existing.id]);

  const updateField = (field, value) => {
    if (!canEdit) return;
    isDirtyRef.current = true;
    setForm(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Quiet Draft Auto-Save
  const saveDraftQuietly = useCallback(async (currentForm) => {
    if (!canEdit || isSubmitted) return;
    setAutoSaveStatus('saving');
    try {
      const payload = {
        ...currentForm,
        form_data: { ...currentForm },
        status: 'Draft',
        is_final_submit: false
      };
      const res = await fetch(`${API}/api/ri/student/forms/problem-identification`, {
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
    }, 1500);
    return () => clearTimeout(timer);
  }, [form, canEdit, isSubmitted, saveDraftQuietly]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && canEdit && !isSubmitted) {
        saveDraftQuietly(formRef.current);
      }
    };
  }, [canEdit, isSubmitted, saveDraftQuietly]);

  // Handle Document Upload (1500-Word Report)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !['pdf', 'doc', 'docx'].includes(ext)) {
      toast?.('Only PDF, DOC, or DOCX documents are allowed.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast?.('Document must be under 10 MB.', 'error');
      return;
    }

    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      const token = authHeaders['Authorization']?.replace('Bearer ', '') || localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/student/forms/problem-identification/upload-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const resData = await res.json();
      if (res.ok) {
        toast?.('1500-Word Report Document uploaded successfully!', 'success');
        updateField('assignment_link', resData.url);
        updateField('assignment_file_name', resData.fileName || file.name);
      } else {
        toast?.(resData.message || 'Upload failed', 'error');
      }
    } catch (err) {
      toast?.('Network error uploading document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (submitStatus) => {
    const isFinal = submitStatus === 'Submitted';

    if (isFinal) {
      const errors = {};
      if (!form.school_name?.trim()) errors.school_name = 'Name of School is required';
      if (!form.department_name?.trim()) errors.department_name = 'Department is required';
      if (!form.degree_program?.trim()) errors.degree_program = 'Degree Program is required';
      if (!form.village_visited?.trim()) errors.village_visited = 'Name of the village visited is required';
      if (form.students_participated === '' || form.students_participated === null) {
        errors.students_participated = 'Number of students participated is required';
      }
      if (!form.team_leader_name?.trim()) errors.team_leader_name = 'Name of the team leader is required';
      if (!form.total_team_members) errors.total_team_members = 'Total members in team is required';
      if (!form.problem_title?.trim()) errors.problem_title = 'Title of problem / Issue identified is required';
      if (!form.is_aligned_with_sdg) errors.is_aligned_with_sdg = 'Please select if in line with SDGs (Yes / No)';
      if (!form.is_related_to_degree) errors.is_related_to_degree = 'Please select if related to degree program (Yes / No)';
      if (!form.solution_offered) errors.solution_offered = 'Please select if solution offered (Yes / No)';
      if (!form.helping_faculty_name?.trim()) errors.helping_faculty_name = 'Faculty Name is required';
      if (!form.helping_faculty_dept?.trim()) errors.helping_faculty_dept = 'Faculty Department is required';
      if (!form.solution_is_practical_implementable) errors.solution_is_practical_implementable = 'Please select if solution is practical and implementable (Yes / No)';
      if (!form.committee_chairperson?.trim()) errors.committee_chairperson = 'Name and designation of chairperson is required';
      if (!form.presentation_date) errors.presentation_date = 'Date of presentation is required';
      if (!form.committee_remarks) errors.committee_remarks = 'Remarks by committee is required';
      if (!form.sarpanch_informed_details?.trim()) errors.sarpanch_informed_details = 'Details of informing Sarpanch & Gram Panchayat are required';
      if (!form.ri_cell_submission_details?.trim()) errors.ri_cell_submission_details = 'Presentation submission details to RI Cell are required';

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        toast?.('Please fill all official required fields.', 'error');
        // Scroll to the first error
        const firstErrorKey = Object.keys(errors)[0];
        const el = document.getElementById(`field-${firstErrorKey}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        form_data: { ...form },
        status: submitStatus,
        is_final_submit: isFinal,
        is_update_response: isEditingResponse
      };
      const res = await fetch(`${API}/api/ri/student/forms/problem-identification`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok) {
        toast?.(isEditingResponse ? 'Problem Statement & SMART Solution updated and resubmitted successfully!' : (result.message || 'Form saved successfully'), 'success');
        isDirtyRef.current = false;
        setIsEditingResponse(false);
        onClose?.();
      } else {
        toast?.(result.message || 'Failed to save form', 'error');
      }
    } catch (err) {
      toast?.('Network error saving form', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getCleanFileName = (url, storedName) => {
    if (storedName) return storedName;
    if (!url) return '';
    try {
      if (url.includes('key=')) {
        const keyVal = decodeURIComponent(url.split('key=')[1].split('&')[0]);
        const cleanBase = keyVal.split('/').pop() || '';
        const match = cleanBase.match(/^ri_\d+_[a-f0-9]+_(.+)$/);
        return match ? match[1] : (cleanBase || '1500_Word_Report_Document');
      }
      return url.split('/').pop()?.split('?')[0] || '1500_Word_Report_Document';
    } catch {
      return '1500_Word_Report_Document';
    }
  };

  const getSecuredUrl = (url) => {
    if (!url) return '';
    return resolveCleanFileUrl(url);
  };

  const reportFileName = getCleanFileName(form.assignment_link, form.assignment_file_name);

  return (
    <div className="ri-form-vi-container" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', color: '#0f172a' }}>
      
      {/* ── GROUP LEADER NOTICE POPUP ── */}
      {showLeaderPopup && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowLeaderPopup(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              padding: '24px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowLeaderPopup(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={16} />
            </button>

            {/* Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#047857',
                flexShrink: 0
              }}>
                <Users size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Group Leader Notice
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                  Form VI: Problem / Issue Identification
                </p>
              </div>
            </div>

            {/* Prompt description */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '18px'
            }}>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#1e293b', lineHeight: 1.55 }}>
                The <strong style={{ color: '#047857' }}>1500-Word Report Document (PDF / DOC / DOCX)</strong> should only be uploaded by the <strong style={{ color: '#0f172a' }}>Group Leader</strong>.
              </p>
            </div>

            {/* Action button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowLeaderPopup(false)}
                style={{
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 22px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(4, 120, 87, 0.3)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#065f46'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#047857'; }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP ACTION BAR (Autosave & Annexures Reference) ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
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
              {data?.faculty_remarks || 'Please refine the Form VI problem identification, solution, or report according to mentor feedback.'}
            </p>
          </div>
        </div>
      )}

      {/* Top Status Banner for Submitted / Editing Response */}
      {isSubmitted && !isCorrection && existing.status !== 'Reviewed' && (
        <div style={{
          backgroundColor: isEditingResponse ? '#fffbeb' : '#f0fdf4',
          border: isEditingResponse ? '1.5px solid #fde68a' : '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isEditingResponse ? (
              <Edit3 size={18} style={{ color: '#b45309', flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: isEditingResponse ? '#92400e' : '#166534' }}>
                {isEditingResponse
                  ? 'Editing Submitted Response Mode'
                  : 'Form VI Response Submitted'}
              </div>
              <div style={{ fontSize: '12px', color: isEditingResponse ? '#b45309' : '#15803d' }}>
                {isEditingResponse
                  ? 'Modify any answers below. Click "Update & Resubmit Form VI" to save changes to your submission.'
                  : 'Your response has been recorded. You can review your submission below or make edits at any time.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isEditingResponse ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingResponse(false);
                  isDirtyRef.current = false;
                }}
                disabled={submitting}
                style={{
                  padding: '7px 14px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel Editing
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingResponse(true)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(4, 120, 87, 0.25)'
                }}
              >
                <Edit3 size={14} />
                <span>Edit Response</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Evaluated / Fully Reviewed Notice */}
      {existing.status === 'Reviewed' && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '18px',
          fontSize: '12.5px',
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>Form VI has been reviewed and finalized by your faculty mentor and is locked against further edits.</span>
        </div>
      )}

      {/* ── CONTINUOUS VERTICAL FORM TABLE / SECTIONS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        
        {/* SECTION 1 - 5: General Immersion Information */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            Basic Information (Indicators 1 – 5)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* Sr. 1 */}
            <div id="field-school_name">
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
                  border: validationErrors.school_name ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.school_name && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.school_name}</span>}
            </div>

            {/* Sr. 2 */}
            <div id="field-department_name">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  2. Department *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="text"
                value={form.department_name}
                disabled={!canEdit}
                placeholder="Enter department name"
                onChange={(e) => updateField('department_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.department_name ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.department_name && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.department_name}</span>}
            </div>

            {/* Sr. 3 */}
            <div id="field-degree_program">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  3. Degree Program *
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
                  border: validationErrors.degree_program ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.degree_program && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.degree_program}</span>}
            </div>

            {/* Sr. 4 */}
            <div id="field-village_visited">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  4. Name of the village visited *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="text"
                value={form.village_visited}
                disabled={!canEdit}
                placeholder="Enter village name"
                onChange={(e) => updateField('village_visited', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.village_visited ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.village_visited && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.village_visited}</span>}
            </div>

            {/* Sr. 5 */}
            <div id="field-students_participated">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>
                  5. Number of students participated *
                </label>
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>Self-explanatory</span>
              </div>
              <input
                type="number"
                min="1"
                value={form.students_participated}
                disabled={!canEdit}
                placeholder="e.g. 5"
                onChange={(e) => updateField('students_participated', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.students_participated ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.students_participated && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.students_participated}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 6: Team Information */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            6. Team information (5-member team)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* 6.1 */}
            <div id="field-team_leader_name">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                6.1 Name of the team leader *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', lineHeight: 1.4 }}>
                As per guidelines, teams of 5 students each are to be formed at the time of Orientation Workshop to identify problem and suggest solution. Write name of the team leader
              </div>
              <input
                type="text"
                value={form.team_leader_name}
                disabled={!canEdit}
                placeholder="Enter team leader's full name"
                onChange={(e) => updateField('team_leader_name', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.team_leader_name ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.team_leader_name && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.team_leader_name}</span>}
            </div>

            {/* 6.2 */}
            <div id="field-total_team_members">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                6.2 Total members in team *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', lineHeight: 1.4 }}>
                Write total members in the team. Normally there should be 5 members.
              </div>
              <input
                type="number"
                min="1"
                value={form.total_team_members}
                disabled={!canEdit}
                placeholder="5"
                onChange={(e) => updateField('total_team_members', parseInt(e.target.value, 10) || '')}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.total_team_members ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.total_team_members && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.total_team_members}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 7: Problem / Issue Identified */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            7. Problem / Issue identified
          </div>

          {/* 7.1 */}
          <div id="field-problem_title" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
              7.1 Title of problem / Issue identified *
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', lineHeight: 1.4 }}>
              Each team is expected to identify one problem / issue from village in line with SDGs and degree program. Team leader is expected to record title of the problem identified.
            </div>
            <textarea
              rows={3}
              value={form.problem_title}
              disabled={!canEdit}
              placeholder="Record title and specific description of the identified problem / issue"
              onChange={(e) => updateField('problem_title', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '7px',
                border: validationErrors.problem_title ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
              }}
            />
            {validationErrors.problem_title && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.problem_title}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* 7.2 */}
            <div id="field-is_aligned_with_sdg">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                7.2 Is it in line with SDGs *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Write appropriate option (Yes / No)
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                {SDG_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', fontWeight: form.is_aligned_with_sdg === opt ? '700' : '400' }}>
                    <input
                      type="radio"
                      name="is_aligned_with_sdg"
                      value={opt}
                      checked={form.is_aligned_with_sdg === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('is_aligned_with_sdg', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              {validationErrors.is_aligned_with_sdg && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.is_aligned_with_sdg}</span>}
            </div>

            {/* 7.3 */}
            <div id="field-is_related_to_degree">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                7.3 Is it related to your degree program *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Write appropriate option (Yes / No)
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                {DEGREE_PROGRAM_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', fontWeight: form.is_related_to_degree === opt ? '700' : '400' }}>
                    <input
                      type="radio"
                      name="is_related_to_degree"
                      value={opt}
                      checked={form.is_related_to_degree === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('is_related_to_degree', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              {validationErrors.is_related_to_degree && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.is_related_to_degree}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 8: Solution to Problem / Issue */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            8. Solution to problem / issue
          </div>

          {/* 8.1 */}
          <div id="field-solution_offered" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
              8.1 Solution offered *
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', lineHeight: 1.4 }}>
              Solution should be practical and doable considering the expertise and resources available at village level. If the solution is doable then select option ‘Yes’ otherwise ‘No’ option is to be selected. Option - Yes / No
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              {SOLUTION_OFFERED_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', fontWeight: form.solution_offered === opt ? '700' : '400' }}>
                  <input
                    type="radio"
                    name="solution_offered"
                    value={opt}
                    checked={form.solution_offered === opt}
                    disabled={!canEdit}
                    onChange={() => updateField('solution_offered', opt)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {validationErrors.solution_offered && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.solution_offered}</span>}
          </div>

          {/* 8.2 Sub-header: Which faculty helped students to prepare solution */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              8.2 Which faculty helped students to prepare solution
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {/* 8.1.1 (8.2.1) */}
              <div id="field-helping_faculty_name">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    8.1.1 Name *
                  </label>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic' }}>Write name of faculty</span>
                </div>
                <input
                  type="text"
                  value={form.helping_faculty_name}
                  disabled={!canEdit}
                  placeholder="Enter name of faculty"
                  onChange={(e) => updateField('helping_faculty_name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 11px',
                    borderRadius: '6px',
                    border: validationErrors.helping_faculty_name ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                  }}
                />
                {validationErrors.helping_faculty_name && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.helping_faculty_name}</span>}
              </div>

              {/* 8.1.2 (8.2.2) */}
              <div id="field-helping_faculty_dept">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    8.1.2 Department *
                  </label>
                  <span style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic' }}>Write department of faculty</span>
                </div>
                <input
                  type="text"
                  value={form.helping_faculty_dept}
                  disabled={!canEdit}
                  placeholder="Enter department of faculty"
                  onChange={(e) => updateField('helping_faculty_dept', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 11px',
                    borderRadius: '6px',
                    border: validationErrors.helping_faculty_dept ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                  }}
                />
                {validationErrors.helping_faculty_dept && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.helping_faculty_dept}</span>}
              </div>
            </div>
          </div>

          {/* 8.2 (8.3 in sequence) */}
          <div id="field-solution_is_practical_implementable">
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
              8.2 Is solution offered practical and implementable *
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
              Write appropriate option (Yes / No)
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
              {SOLUTION_PRACTICAL_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', fontWeight: form.solution_is_practical_implementable === opt ? '700' : '400' }}>
                  <input
                    type="radio"
                    name="solution_is_practical_implementable"
                    value={opt}
                    checked={form.solution_is_practical_implementable === opt}
                    disabled={!canEdit}
                    onChange={() => updateField('solution_is_practical_implementable', opt)}
                    style={{ accentColor: '#047857' }}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {validationErrors.solution_is_practical_implementable && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.solution_is_practical_implementable}</span>}
          </div>
        </div>

        {/* SECTION 9: Presentation to Committee */}
        <div className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            9. Presentation to committee
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {/* 9.1 */}
            <div id="field-committee_chairperson">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                9.1 Name and designation of chairperson of committee *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Write name and designation of Chairperson
              </div>
              <input
                type="text"
                value={form.committee_chairperson}
                disabled={!canEdit}
                placeholder="e.g. Dr. A. Sharma, Dean / Panel Chairperson"
                onChange={(e) => updateField('committee_chairperson', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.committee_chairperson ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.committee_chairperson && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.committee_chairperson}</span>}
            </div>

            {/* 9.2 */}
            <div id="field-presentation_date">
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                9.2 Date of presentation *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Self-explanatory
              </div>
              <input
                type="date"
                value={form.presentation_date}
                disabled={!canEdit}
                onChange={(e) => updateField('presentation_date', e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  border: validationErrors.presentation_date ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
                }}
              />
              {validationErrors.presentation_date && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.presentation_date}</span>}
            </div>

            {/* 9.3 */}
            <div id="field-committee_remarks" style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }}>
                9.3 Remarks by committee *
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Record appropriate option (Excellent, Good, Satisfactory, Un-satisfactory)
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '6px' }}>
                {COMMITTEE_REMARKS_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', fontWeight: form.committee_remarks === opt ? '700' : '400' }}>
                    <input
                      type="radio"
                      name="committee_remarks"
                      value={opt}
                      checked={form.committee_remarks === opt}
                      disabled={!canEdit}
                      onChange={() => updateField('committee_remarks', opt)}
                      style={{ accentColor: '#047857' }}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              {validationErrors.committee_remarks && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.committee_remarks}</span>}
            </div>
          </div>
        </div>

        {/* SECTION 10: Informed to Sarpanch and Gram Panchayat */}
        <div id="field-sarpanch_informed_details" className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            10. Problem / issue and solution informed to Sarpanch and Gram Panchayat *
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '8px' }}>
            Write date and name of the person to whom problem / issue is informed
          </div>
          <textarea
            rows={2}
            value={form.sarpanch_informed_details}
            disabled={!canEdit}
            placeholder="e.g. Informed on 15/02/2026 to Mr. Ramesh Patil (Sarpanch) during Gram Panchayat consultation meeting"
            onChange={(e) => updateField('sarpanch_informed_details', e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '7px',
              border: validationErrors.sarpanch_informed_details ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
            }}
          />
          {validationErrors.sarpanch_informed_details && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.sarpanch_informed_details}</span>}
        </div>

        {/* SECTION 11: Presentation Submitted to RI Cell */}
        <div id="field-ri_cell_submission_details" className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            11. Presentation submitted to RI Cell *
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '8px' }}>
            Write date and name of the person to whom the presentation is submitted
          </div>
          <textarea
            rows={2}
            value={form.ri_cell_submission_details}
            disabled={!canEdit}
            placeholder="e.g. Submitted on 18/02/2026 to Dr. K. Deshmukh (Rural Immersion Cell Coordinator)"
            onChange={(e) => updateField('ri_cell_submission_details', e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '7px',
              border: validationErrors.ri_cell_submission_details ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: canEdit ? '#ffffff' : '#f8fafc'
            }}
          />
          {validationErrors.ri_cell_submission_details && <span style={{ fontSize: '11px', color: '#ef4444' }}>{validationErrors.ri_cell_submission_details}</span>}
        </div>

        {/* ── DELIVERABLE: 1500-WORD REPORT DOCUMENT ── */}
        <div id="field-assignment_link" className="ri-card-responsive" style={{
          backgroundColor: '#ffffff',
          border: validationErrors.assignment_link ? '1.5px solid #ef4444' : '1.5px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#047857' }} />
              <label style={{ fontSize: '13.5px', fontWeight: '800', color: '#064e3b' }}>
                1500-Word Report Document (PDF / DOC / DOCX)
              </label>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0'
            }}>
              Optional • Group Leader Only
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginBottom: '12px', lineHeight: 1.5 }}>
            <strong>Note:</strong> This report should only be uploaded by the group leader. Other group members do not need to upload this document.
          </div>

          {/* Current file display card */}
          {form.assignment_link ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              marginBottom: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileUp size={18} style={{ color: '#047857' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reportFileName || '1500_Word_Report_Document'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                    Document attached to Form VI submission
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => openSecureFile(form.assignment_link)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #86efac',
                    color: '#047857',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={13} /> View / Download
                </button>

                {canEdit && (
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#047857',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}>
                    <Upload size={13} />
                    <span>{uploadingDoc ? 'Uploading...' : 'Replace Document'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      style={{ display: 'none' }}
                      disabled={uploadingDoc}
                      onChange={handleFileUpload}
                    />
                  </label>
                )}
              </div>
            </div>
          ) : (
            canEdit && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#047857',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <Upload size={16} />
                  <span>{uploadingDoc ? 'Uploading document...' : 'Upload 1500-Word Report (PDF / DOC / DOCX)'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    disabled={uploadingDoc}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )
          )}

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Accepted file formats: <strong>PDF, DOC, DOCX</strong> • Maximum file size: <strong>10 MB</strong>
          </div>
          {validationErrors.assignment_link && (
            <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#ef4444', fontWeight: '600' }}>
              {validationErrors.assignment_link}
            </div>
          )}
        </div>

      </div>

      {/* ── FOOTER ACTIONS ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        borderTop: '1px solid #e2e8f0',
        paddingTop: '16px',
        marginTop: '8px'
      }}>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '13px',
            fontWeight: '600',
            color: '#475569',
            cursor: 'pointer'
          }}
        >
          Close
        </button>

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

          {isSubmitted && !isCorrection && existing.status !== 'Reviewed' && !isEditingResponse && (
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
          )}

          {isEditingResponse && (
            <>
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
                    <span>Update & Resubmit Form VI</span>
                  </>
                )}
              </button>
            </>
          )}

          {!isSubmitted && canEdit && (
            <>
              <button
                type="button"
                onClick={() => handleSubmit('Draft')}
                disabled={submitting}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#1e293b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit('Submitted')}
                disabled={submitting}
                style={{
                  padding: '9px 20px',
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
                  boxShadow: '0 1px 3px rgba(4, 120, 87, 0.3)'
                }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Final Submit Form VI</span>
                  </>
                )}
              </button>
            </>
          )}

          {isCorrection && canEdit && !isEditingResponse && (
            <button
              type="button"
              onClick={() => handleSubmit('Submitted')}
              disabled={submitting}
              style={{
                padding: '9px 20px',
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
                boxShadow: '0 1px 3px rgba(4, 120, 87, 0.3)'
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" /> Submitting...
                </>
              ) : (
                <span>Update & Resubmit Form VI</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
