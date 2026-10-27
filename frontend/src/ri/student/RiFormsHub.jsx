import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  Edit3,
  Eye,
  ArrowLeft,
  Save,
  Send,
  ExternalLink,
  RefreshCw,
  Star,
  Info,
  ShieldCheck,
  Building2,
  Home,
  Lightbulb,
  Users,
  ThumbsUp,
  Heart,
  X,
  Upload,
  FileUp,
  ImagePlus,
  GraduationCap,
  Download
} from 'lucide-react';
import RiFamilySurveyForm from './RiFamilySurveyForm';
import RiInstitutionalVisitsForm from './RiInstitutionalVisitsForm';
import RiProblemIdentificationForm from './RiProblemIdentificationForm';
import RiDailyActivityReportForm from './RiDailyActivityReportForm';
import { downloadFeedbackFormPdf } from '../utils/riFormHardCopyPdf';
import SecureImage from '../shared/SecureImage';
import { resolveCleanFileUrl, openSecureFile } from '../utils/secureFileHelpers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Clean URL resolver without token parameter leakage
const resolveImageUrl = (url) => resolveCleanFileUrl(url);

const SDG_LIST = [
  'SDG 1: No Poverty',
  'SDG 2: Zero Hunger',
  'SDG 3: Good Health & Well-being',
  'SDG 4: Quality Education',
  'SDG 5: Gender Equality',
  'SDG 6: Clean Water & Sanitation',
  'SDG 7: Affordable & Clean Energy',
  'SDG 8: Decent Work & Economic Growth',
  'SDG 9: Industry, Innovation & Infrastructure',
  'SDG 10: Reduced Inequalities',
  'SDG 11: Sustainable Cities & Communities',
  'SDG 12: Responsible Consumption & Production',
  'SDG 13: Climate Action',
  'SDG 14: Life Below Water',
  'SDG 15: Life on Land',
  'SDG 16: Peace, Justice & Strong Institutions',
  'SDG 17: Partnerships for the Goals'
];

const INSTITUTION_TYPES = [
  'Gram Panchayat Office',
  'Primary Health Centre (PHC) / Sub-Centre',
  'Zilla Parishad Primary / High School',
  'Anganwadi Centre',
  'Primary Agricultural Credit Society (PACS) / Cooperative Bank',
  'Water Filtration / RO / Supply Station',
  'Veterinary Dispensary',
  'Women Self-Help Group (SHG) Federation / Bachat Gat',
  'Post Office / E-Seva Kendra',
  'Other Local Institution'
];

// Helper to reliably map any form identifier to our canonical key
const getFormKey = (form) => {
  if (!form) return '';
  if (form.form_key) return form.form_key;
  const t = (form.form_type || '').toLowerCase();
  if (t.includes('undertaking') || t === 'form_ia') return 'undertaking';
  if (t.includes('checklist') || t === 'form_ib') return 'checklist';
  if (t.includes('daily') || t.includes('activity') || t === 'form_iiib' || t === 'form iiib') return 'daily_activity';
  if (t.includes('institution') || t === 'form_iv') return 'institutions';
  if (t.includes('family') || t === 'form_v') return 'family';
  if (t.includes('problem') || t === 'form_vi') return 'problem';
  if (t.includes('community') || t === 'form_vii') return 'community';
  if (t.includes('feedback') || t === 'form_viii') return 'feedback';
  return form.form_type || '';
};

export default function RiFormsHub({ profileData, onNavigateToUndertaking, onNavigateToAnnexures, addToast }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formsSummary, setFormsSummary] = useState(null);
  const [activeFormModal, setActiveFormModal] = useState(null); // 'checklist' | 'daily_activity' | 'institutions' | 'family' | 'problem' | 'community' | 'feedback'
  const [formLoading, setFormLoading] = useState(false);
  const [activeFormData, setActiveFormData] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth Headers helper
  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  const toast = useCallback((msg, type = 'info') => {
    if (addToast) addToast(msg, type);
    else alert(msg);
  }, [addToast]);

  // Fetch summary of all forms
  const fetchFormsSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ri/student/forms`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setFormsSummary(data);
      } else {
        console.error('Failed to fetch RI forms summary');
      }
    } catch (err) {
      console.error('Error fetching forms summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchFormsSummary();
  }, [fetchFormsSummary]);

  // Load specific form details
  const openForm = async (rawIdentifier) => {
    const formType = getFormKey({ form_key: rawIdentifier, form_type: rawIdentifier });
    if (!formType) return;

    if (formType === 'undertaking') {
      if (onNavigateToUndertaking) {
        onNavigateToUndertaking();
      }
      return;
    }

    setActiveFormModal(formType);
    setFormLoading(true);
    try {
      let endpoint = '';
      if (formType === 'checklist') endpoint = '/api/ri/student/forms/preparatory-checklist';
      else if (formType === 'daily_activity') endpoint = '/api/ri/student/forms/daily-activity-report';
      else if (formType === 'institutions') endpoint = '/api/ri/student/forms/institutional-visits';
      else if (formType === 'family') endpoint = '/api/ri/student/forms/family-surveys';
      else if (formType === 'problem') endpoint = '/api/ri/student/forms/problem-identification';
      else if (formType === 'community') endpoint = '/api/ri/student/forms/community-project';
      else if (formType === 'feedback') endpoint = '/api/ri/student/forms/feedback';

      if (endpoint) {
        const res = await fetch(`${API}${endpoint}`, { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          setActiveFormData(data);
        } else {
          toast('Failed to load form details from database', 'error');
        }
      }
    } catch (err) {
      console.error('Error loading form:', err);
      toast('Network error loading form details', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const closeFormModal = () => {
    setActiveFormModal(null);
    setActiveFormData(null);
    fetchFormsSummary();
  };

  // Status badge helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Submitted':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <Check size={12} strokeWidth={2.5} /> Submitted
          </span>
        );
      case 'Reviewed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <CheckCircle2 size={12} strokeWidth={2.5} /> Reviewed
          </span>
        );
      case 'Requires Correction':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            <AlertTriangle size={12} /> Correction Needed
          </span>
        );
      case 'Draft':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            <Edit3 size={12} /> In Draft
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Not Started
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#047857' }} />
        <p style={{ fontSize: '14px', color: '#64748b', fontWeight: '600' }}>Loading official RI forms & submissions...</p>
      </div>
    );
  }

  // ── FULL PAGE FORM VIEW (NO POPUP MODAL) ──
  if (activeFormModal) {
    const FORM_CLEAN_TITLES = {
      checklist: 'Preparatory Checklist',
      daily_activity: 'Daily Activity Report',
      institutions: 'Institutional Visit Observations',
      family: 'Family Visit Observations',
      problem: 'Form VI: Problem / Issue Identification & Developing Solution',
      community: 'Community Project & Shramdaan',
      feedback: 'RI Feedback Form'
    };

    return (
      <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
        {/* Clean Form Navigation Header */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: isMobile ? '8px' : '10px',
            border: '1px solid #e2e8f0',
            marginBottom: isMobile ? '8px' : '16px',
            padding: isMobile ? '8px 10px' : '12px 18px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'sticky',
            top: '8px',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <button
            onClick={closeFormModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: isMobile ? '5px 10px' : '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: isMobile ? '12px' : '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
          >
            <ArrowLeft size={isMobile ? 14 : 15} />
            <span>Back to Forms</span>
          </button>

          <h2 style={{
            fontSize: isMobile ? '13px' : '15px',
            fontWeight: '700',
            color: '#0f172a',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {FORM_CLEAN_TITLES[activeFormModal] || 'Rural Immersion Form'}
          </h2>
        </div>

        {/* Form Body Container */}
        <div
          style={{
            backgroundColor: isMobile ? 'transparent' : '#ffffff',
            borderRadius: isMobile ? '0' : '14px',
            border: isMobile ? 'none' : '1px solid #e2e8f0',
            padding: isMobile ? '0' : '28px',
            boxShadow: isMobile ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.04)',
            overflowX: 'hidden'
          }}
        >
          {formLoading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#047857' }} />
              <p style={{ fontSize: '13.5px', color: '#64748b', fontWeight: '600' }}>Loading form details...</p>
            </div>
          ) : (
            <>
              {activeFormModal === 'checklist' && (
                <ChecklistForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  toast={toast}
                />
              )}
              {activeFormModal === 'daily_activity' && (
                <DailyActivityReportForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  onNavigateToAnnexures={onNavigateToAnnexures}
                  toast={toast}
                />
              )}
              {activeFormModal === 'institutions' && (
                <InstitutionsForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  onNavigateToAnnexures={onNavigateToAnnexures}
                  toast={toast}
                />
              )}
              {activeFormModal === 'family' && (
                <FamilySurveyForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  toast={toast}
                />
              )}
              {activeFormModal === 'problem' && (
                <ProblemIdentificationForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  onNavigateToAnnexures={onNavigateToAnnexures}
                  toast={toast}
                />
              )}
              {activeFormModal === 'community' && (
                <CommunityProjectForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  toast={toast}
                />
              )}
              {activeFormModal === 'feedback' && (
                <FeedbackForm
                  data={activeFormData}
                  authHeaders={authHeaders}
                  onClose={closeFormModal}
                  onNavigateToAnnexures={onNavigateToAnnexures}
                  toast={toast}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const rawFormsList = formsSummary?.forms || [];
  const formsList = rawFormsList.filter(f => getFormKey(f) !== 'checklist');
  const completedCount = formsList.filter(f => f.status === 'Submitted' || f.status === 'Reviewed').length;
  const totalCount = formsList.length || 5;
  const pendingCount = formsList.filter(f => f.status !== 'Submitted' && f.status !== 'Reviewed').length;
  const correctionCount = formsList.filter(f => f.status === 'Requires Correction').length;
  const metrics = {
    total: totalCount,
    submitted: completedCount,
    reviewed: formsList.filter(f => f.status === 'Reviewed').length,
    pending: pendingCount,
    requiresCorrection: correctionCount
  };
  const overallPct = Math.round((completedCount / (totalCount || 5)) * 100);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* ── CORRECTION REQUIRED ALERT (IF ANY) ── */}
      {metrics.requiresCorrection > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>
              Action Required: Faculty Requested Corrections
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c' }}>
              One or more submitted forms require correction as indicated by your faculty mentor. Please review the feedback and resubmit.
            </p>
          </div>
        </div>
      )}

      {/* ── STATUS & METRICS SUMMARY AREA ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Forms Status</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>({completedCount} of {metrics.total} submitted)</span>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchFormsSummary(); }}
          disabled={refreshing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: isMobile ? '10px' : '14px',
        marginBottom: '20px'
      }}>
        {/* Total Forms */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px 14px' : '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL FORMS</div>
          <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{metrics.total}</div>
        </div>

        {/* Submitted / Completed */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px 14px' : '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ fontSize: '11px', color: '#047857', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SUBMITTED / COMPLETED</div>
          <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#047857', marginTop: '4px' }}>{completedCount}</div>
        </div>

        {/* Pending Completion */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px 14px' : '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PENDING COMPLETION</div>
          <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: '#b45309', marginTop: '4px' }}>{metrics.pending}</div>
        </div>

        {/* Corrections Requested */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px 14px' : '16px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{ fontSize: '11px', color: metrics.requiresCorrection > 0 ? '#b91c1c' : '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CORRECTIONS REQUESTED</div>
          <div style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: '800', color: metrics.requiresCorrection > 0 ? '#b91c1c' : '#0f172a', marginTop: '4px' }}>{metrics.requiresCorrection}</div>
        </div>
      </div>

      {/* ── FORMS LIST / GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
        {formsList.map((f) => {
          const formKey = getFormKey(f);
          const isSubmitted = f.status === 'Submitted' || f.status === 'Reviewed';
          const isCorrection = f.status === 'Requires Correction';
          const isDraft = f.status === 'Draft';

          const CARD_CLEAN_META = {
            undertaking: {
              title: 'Student Undertaking',
              desc: 'Participant safety undertaking & code of conduct.'
            },
            checklist: {
              title: 'Preparatory Checklist',
              desc: 'Pre-departure readiness & safety verification.'
            },
            daily_activity: {
              title: 'Daily Activity Report',
              desc: 'Daily immersion activities, community project & school engagement.'
            },
            institutions: {
              title: 'Institutional Visits',
              desc: 'Rotational observations from visiting village institutions.'
            },
            family: {
              title: 'Family Visits',
              desc: 'Household socio-economic survey & government scheme records.'
            },
            problem: {
              title: 'Problem / Issue Identification & Solution (Form VI)',
              desc: 'ANNEX G-8: Record village problem, team solution & 1500-word report.'
            },
            community: {
              title: 'Community Project',
              desc: 'Student-led community action project & Shramdaan.'
            },
            feedback: {
              title: 'RI Feedback Form',
              desc: 'Immersion activities rating, best practices & feedback.'
            }
          };

          const cardMeta = CARD_CLEAN_META[formKey] || {
            title: f.title || 'Rural Immersion Form',
            desc: f.description || 'Complete required details.'
          };

          let icon = <FileText size={17} color="#047857" />;
          if (formKey === 'undertaking') icon = <ShieldCheck size={17} color="#047857" />;
          else if (formKey === 'checklist') icon = <CheckCircle2 size={17} color="#047857" />;
          else if (formKey === 'institutions') icon = <Building2 size={17} color="#047857" />;
          else if (formKey === 'family') icon = <Home size={17} color="#047857" />;
          else if (formKey === 'problem') icon = <Lightbulb size={17} color="#047857" />;
          else if (formKey === 'community') icon = <Users size={17} color="#047857" />;
          else if (formKey === 'feedback') icon = <Heart size={17} color="#047857" />;

          return (
            <div
              key={f.form_type}
              style={{
                backgroundColor: '#ffffff',
                border: isCorrection
                  ? '1.5px solid #ef4444'
                  : isSubmitted
                  ? '1.5px solid #10b981'
                  : isDraft
                  ? '1.5px solid #f59e0b'
                  : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '145px',
                boxSizing: 'border-box',
                boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                {/* Form Top Row: Icon + Code + Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: isSubmitted ? '#f0fdf4' : '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {f.form_code}
                    </span>
                  </div>

                  {isSubmitted ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #bbf7d0'
                    }}>
                      <Check size={11} strokeWidth={2.5} />
                      <span>{f.status === 'Reviewed' ? 'Reviewed' : 'Submitted'}</span>
                    </span>
                  ) : (
                    renderStatusBadge(f.status)
                  )}
                </div>

                {/* Just the Form Name */}
                <h3 style={{
                  fontSize: '14.5px',
                  fontWeight: '800',
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {cardMeta.title}
                </h3>
              </div>

              {/* Card Action Button */}
              {(() => {
                const isEditableAfterSubmit = ['daily_activity', 'institutions', 'family', 'problem', 'feedback'].includes(formKey);
                return (
                  <button
                    onClick={() => openForm(formKey || f.form_type)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      border: isSubmitted ? (isEditableAfterSubmit && f.status !== 'Reviewed' ? '1px solid #a7f3d0' : '1px solid #cbd5e1') : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                      backgroundColor: isCorrection
                        ? '#dc2626'
                        : isSubmitted
                        ? (isEditableAfterSubmit && f.status !== 'Reviewed' ? '#f0fdf4' : '#f8fafc')
                        : isDraft
                        ? '#d97706'
                        : '#047857',
                      color: isSubmitted ? (isEditableAfterSubmit && f.status !== 'Reviewed' ? '#047857' : '#334155') : '#ffffff'
                    }}
                  >
                    {isCorrection ? (
                      <>
                        <Edit3 size={13} /> Update & Resubmit
                      </>
                    ) : isSubmitted ? (
                      isEditableAfterSubmit && f.status !== 'Reviewed' ? (
                        <>
                          <Edit3 size={13} /> Edit Response
                        </>
                      ) : (
                        <>
                          <Eye size={13} /> View Form
                        </>
                      )
                    ) : isDraft ? (
                      <>
                        <Edit3 size={13} /> Continue Draft
                      </>
                    ) : (
                      <>
                        <Plus size={13} /> Open Form
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PREPARATORY CHECKLIST FORM (FORM IB - 12 OFFICIAL ITEMS)
// ─────────────────────────────────────────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { key: 'parents_informed', label: '1. Parents / Guardians duly informed regarding rural immersion dates, itinerary & stay' },
  { key: 'signed_undertaking', label: '2. Medical & Parent Undertaking Form (Form IA) digitally signed and on record' },
  { key: 'medical_checkup_done', label: '3. Medical fitness confirmed & essential prescription medications in possession' },
  { key: 'college_id_card', label: '4. Valid MIT-WPU Student ID Card ready and in possession' },
  { key: 'clothing_ready', label: '5. Culturally appropriate, modest clothing packed (comfortable cotton attire)' },
  { key: 'shoes_sportswear', label: '6. Sturdy walking shoes / sportswear suitable for rural village terrain' },
  { key: 'beddings_ready', label: '7. Travel bedsheet, light blanket & sleeping accessories packed' },
  { key: 'toiletries_ready', label: '8. Personal hygiene kit, mosquito repellent & sun protection packed' },
  { key: 'medicines_ready', label: '9. Essential first-aid supplies & personal emergency medications packed' },
  { key: 'blank_notebook_ready', label: '10. Hardbound field survey notebook, pens & clipboard ready' },
  { key: 'laptop_dongle_ready', label: '11. Laptop, mobile hotspot/dongle & power bank fully charged (if assigned)' },
  { key: 'emergency_contacts_saved', label: '12. Emergency contact numbers of Faculty Mentor, Sarpanch & PHC saved' }
];

function ChecklistForm({ data, authHeaders, onClose, toast }) {
  const existing = data?.checklist || {};
  const isSubmitted = existing.status === 'Submitted' || existing.status === 'Reviewed';
  const isCorrection = existing.status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = !isSubmitted || isCorrection;

  const [form, setForm] = useState({
    parents_informed: Boolean(existing.parents_informed),
    signed_undertaking: Boolean(existing.signed_undertaking),
    medical_checkup_done: Boolean(existing.medical_checkup_done),
    college_id_card: Boolean(existing.college_id_card),
    clothing_ready: Boolean(existing.clothing_ready),
    shoes_sportswear: Boolean(existing.shoes_sportswear),
    beddings_ready: Boolean(existing.beddings_ready),
    toiletries_ready: Boolean(existing.toiletries_ready),
    medicines_ready: Boolean(existing.medicines_ready),
    blank_notebook_ready: Boolean(existing.blank_notebook_ready),
    laptop_dongle_ready: Boolean(existing.laptop_dongle_ready),
    emergency_contacts_saved: Boolean(existing.emergency_contacts_saved),
    role_assigned: existing.role_assigned || 'Field Investigator',
    additional_notes: existing.additional_notes || existing.student_notes || ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
  }, [data]);

  const handleSubmit = async (submitStatus) => {
    if (submitStatus === 'Submitted') {
      const allChecked = CHECKLIST_ITEMS.every(i => form[i.key]);
      if (!allChecked) {
        if (!confirm('Some readiness items are not checked. Are you sure you wish to submit Form IB?')) {
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/preparatory-checklist`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...form, status: submitStatus })
      });
      const result = await res.json();
      if (res.ok) {
        toast(result.message || 'Checklist saved successfully', 'success');
        onClose();
      } else {
        toast(result.message || 'Failed to save checklist', 'error');
      }
    } catch (err) {
      toast('Network error saving checklist', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle2 size={16} style={{ color: '#475569' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>Preparatory Phase Checklist</div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>Verify student readiness prior to village departure across consent, medical fitness, kits, and essential safety items.</div>
        </div>
      </div>

      {isCorrection && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#991b1b' }}>
          <strong>⚠️ Mentor Correction Request:</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>{data?.faculty_remarks || 'Please review your checklist entries, update where necessary, and resubmit.'}</p>
        </div>
      )}

      {!canEdit && (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '12.5px', color: '#1e40af' }}>
          ✓ This form is officially submitted and locked.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: canEdit ? 'pointer' : 'default'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(form[item.key])}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: '#047857' }}
            />
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{item.label}</span>
          </label>
        ))}

        <div style={{ marginTop: '10px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
            Designated Team Role within Student Panel
          </label>
          <select
            value={form.role_assigned}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, role_assigned: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          >
            <option value="Team Leader">Team Leader</option>
            <option value="Field Investigator">Field Investigator</option>
            <option value="Documentation & Survey Lead">Documentation & Survey Lead</option>
            <option value="Community Liaison">Community Liaison</option>
            <option value="Logistics & Resource Manager">Logistics & Resource Manager</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
            Preparatory Remarks / Specific Preparedness Notes
          </label>
          <textarea
            rows={3}
            value={form.additional_notes}
            disabled={!canEdit}
            placeholder="Any specific preparations, special dietary/medical notes, or team coordination..."
            onChange={(e) => setForm({ ...form, additional_notes: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit('Submitted')}
            disabled={submitting}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            {submitting ? 'Submitting...' : isCorrection ? 'Update & Resubmit Form IB' : 'Final Submit Form IB'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. FORM IIIB: DAILY ACTIVITY REPORT – STUDENTS (ANNEX G-5)
// ─────────────────────────────────────────────────────────────────────────────
const DailyActivityReportForm = RiDailyActivityReportForm;


// ─────────────────────────────────────────────────────────────────────────────
// 2. INSTITUTIONAL VISITS FORM (FORM IV - MIN 2 INSTITUTIONS)
// ─────────────────────────────────────────────────────────────────────────────
const InstitutionsForm = RiInstitutionalVisitsForm;

// ─────────────────────────────────────────────────────────────────────────────
// 3. FAMILY SURVEY FORM (FORM V - MULTI-HOUSEHOLD RECORDS - ANNEX G-7)
// ─────────────────────────────────────────────────────────────────────────────
const FamilySurveyForm = RiFamilySurveyForm;

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROBLEM IDENTIFICATION & SOLUTION FORM (FORM VI - ANNEX G-8)
// ─────────────────────────────────────────────────────────────────────────────
const ProblemIdentificationForm = RiProblemIdentificationForm;

// ─────────────────────────────────────────────────────────────────────────────
// 5. COMMUNITY PROJECT / SHRAMDAAN DETAILS FORM (FORM VII)
// ─────────────────────────────────────────────────────────────────────────────
function CommunityProjectForm({ data, authHeaders, onClose, toast }) {
  const existing = data?.project || {};
  const isSubmitted = existing.status === 'Submitted' || existing.status === 'Reviewed';
  const isCorrection = existing.status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = !isSubmitted || isCorrection;

  const [form, setForm] = useState({
    project_title: existing.project_title || '',
    strategic_pillar: existing.strategic_pillar || 'Environmental Sustainability & Green Village',
    hours_spent: existing.hours_spent || 4.0,
    village_location: existing.village_location || '',
    beneficiaries_reached: existing.beneficiaries_reached || 50,
    work_description: existing.work_description || '',
    quantifiable_output: existing.quantifiable_output || '',
    community_feedback: existing.community_feedback || '',
    photos_link: existing.photos_link || ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const isDirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const saveDraftQuietly = useCallback(async (currentForm) => {
    if (!canEdit) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`${API}/api/ri/student/forms/community-project`, {
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
    } catch {
      setAutoSaveStatus('idle');
    }
  }, [authHeaders, canEdit]);

  useEffect(() => {
    if (!isDirtyRef.current || !canEdit) return;
    const timer = setTimeout(() => {
      saveDraftQuietly(form);
    }, 1200);
    return () => clearTimeout(timer);
  }, [form, canEdit, saveDraftQuietly]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current && canEdit) {
        saveDraftQuietly(formRef.current);
      }
    };
  }, [canEdit, saveDraftQuietly]);

  useEffect(() => {
    if (data?.project) {
      const pr = data.project;
      setForm({
        project_title: pr.project_title || '',
        strategic_pillar: pr.strategic_pillar || 'Environmental Sustainability & Green Village',
        hours_spent: pr.hours_spent || 4.0,
        village_location: pr.village_location || '',
        beneficiaries_reached: pr.beneficiaries_reached || 50,
        work_description: pr.work_description || '',
        quantifiable_output: pr.quantifiable_output || '',
        community_feedback: pr.community_feedback || '',
        photos_link: pr.photos_link || ''
      });
    }
  }, [data]);

  const handleSubmit = async (submitStatus) => {
    if (submitStatus === 'Submitted') {
      if (!form.project_title.trim() || !form.work_description.trim()) {
        toast('Please enter the project title and work description', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/ri/student/forms/community-project`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...form, status: submitStatus })
      });
      const result = await res.json();
      if (res.ok) {
        toast(result.message || 'Project saved successfully', 'success');
        isDirtyRef.current = false;
        onClose();
      } else {
        toast(result.message || 'Failed to save', 'error');
      }
    } catch (err) {
      toast('Network error saving community project', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={16} style={{ color: '#475569' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>Community Project & Shramdaan Activity</div>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>Document your group's hands-on civic action in the village (e.g. school session, plantation, cleanliness drive, SHG interaction).</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
        </div>
      </div>

      {isCorrection && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#991b1b' }}>
          <strong>⚠️ Mentor Correction Request:</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>{data?.faculty_remarks || 'Please update your community project details as directed and resubmit.'}</p>
        </div>
      )}

      {!canEdit && (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '12.5px', color: '#1e40af' }}>
          ✓ Form VII is officially submitted and locked.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Project / Activity Title *</label>
          <input
            type="text"
            placeholder="e.g. ZP Primary School Cleanliness Drive & Tree Plantation"
            value={form.project_title}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, project_title: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Strategic Pillar</label>
            <select
              value={form.strategic_pillar}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, strategic_pillar: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
            >
              <option value="Environmental Sustainability & Green Village">Environmental Sustainability & Green Village</option>
              <option value="Education & School Interactive Sessions">Education & School Interactive Sessions</option>
              <option value="Water Conservation & Shramdaan">Water Conservation & Shramdaan</option>
              <option value="Health, Hygiene & Sanitation Drive">Health, Hygiene & Sanitation Drive</option>
              <option value="Women SHG Digital / Financial Literacy">Women SHG Digital / Financial Literacy</option>
              <option value="Rural Artisans & Livelihood Support">Rural Artisans & Livelihood Support</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Duration (Hours Spent)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={form.hours_spent}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, hours_spent: parseFloat(e.target.value) || 1 })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Beneficiaries Reached (Count)</label>
            <input
              type="number"
              min="1"
              value={form.beneficiaries_reached}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, beneficiaries_reached: parseInt(e.target.value) || 1 })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Village Location / Venue</label>
          <input
            type="text"
            placeholder="e.g. ZP Primary School Premises & Gram Chawadi"
            value={form.village_location}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, village_location: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Detailed Description of Community Work *</label>
          <textarea
            rows={3}
            placeholder="Detailed narrative of what was executed by the team, tools used, involvement of locals..."
            value={form.work_description}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, work_description: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Quantifiable Outputs & Tangible Results</label>
          <input
            type="text"
            placeholder="e.g. 40 saplings planted, 3 classrooms painted, 60 school kids engaged"
            value={form.quantifiable_output}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, quantifiable_output: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>Community / Sarpanch Reaction & Feedback</label>
          <textarea
            rows={2}
            placeholder="Feedback from villagers, school teachers, or Gram Panchayat leaders..."
            value={form.community_feedback}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, community_feedback: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        <ActivityPhotoUpload
          canEdit={canEdit}
          currentUrl={form.photos_link}
          authHeaders={authHeaders}
          toast={toast}
          onUploaded={(url) => setForm(prev => ({ ...prev, photos_link: url }))}
        />
      </div>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button
            onClick={() => handleSubmit('Draft')}
            disabled={submitting}
            style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit('Submitted')}
            disabled={submitting}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            {submitting ? 'Submitting...' : isCorrection ? 'Update & Resubmit Form VII' : 'Final Submit Community Project'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. STUDENT FEEDBACK & REFLECTION FORM (FORM VIII)
// ─────────────────────────────────────────────────────────────────────────────
function FeedbackForm({ data, authHeaders, onClose, onNavigateToAnnexures, toast }) {
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const existing = data?.feedback || {};
  const isSubmitted = existing.status === 'Submitted' || existing.status === 'Reviewed';
  const isCorrection = existing.status === 'Requires Correction' || data?.is_correction_requested;
  const canEdit = (!isSubmitted || isCorrection || isEditingResponse) && existing.status !== 'Reviewed';

  const [form, setForm] = useState({
    rating_institutional_visits: existing.rating_institutional_visits || existing.activity_ratings?.institutional_visits || 0,
    rating_household_surveys: existing.rating_household_surveys || existing.activity_ratings?.household_surveys || 0,
    rating_community_project: existing.rating_community_project || existing.activity_ratings?.community_project || 0,
    rating_debrief_school_activity: existing.rating_debrief_school_activity || existing.activity_ratings?.debrief_school_activity || 0,
    best_practices_observed: existing.best_practices_observed || '',
    other_activities_implemented: existing.other_activities_implemented || '',
    issues_affecting_implementation: existing.issues_affecting_implementation || '',
    suggestions_to_improve_program: existing.suggestions_to_improve_program || existing.suggestions_for_improvement || '',
    overall_rating: existing.overall_rating || existing.experience_rating || 5,
    mentorship_rating: existing.mentorship_rating || 5,
    village_reception_rating: existing.village_reception_rating || 5,
    logistics_rating: existing.logistics_rating || 4,
    impactful_learning: existing.impactful_learning || '',
    paradigm_shift: existing.paradigm_shift || '',
    willing_for_followup: existing.willing_for_followup ?? true
  });

  const [submitting, setSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle');
  const isDirtyRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadHardCopy = async () => {
    try {
      setIsDownloadingPdf(true);
      await downloadFeedbackFormPdf({
        form,
        context: data?.context
      });
      toast?.('RI Feedback Form (Form VIII) PDF downloaded!', 'success');
    } catch (err) {
      console.error('Failed to generate Feedback Form PDF:', err);
      toast?.('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const preparePayload = (currentForm, statusVal) => ({
    ...currentForm,
    status: statusVal,
    suggestions_for_improvement: currentForm.suggestions_to_improve_program,
    suggestions_to_improve_program: currentForm.suggestions_to_improve_program,
    activity_ratings: {
      institutional_visits: currentForm.rating_institutional_visits,
      household_surveys: currentForm.rating_household_surveys,
      community_project: currentForm.rating_community_project,
      debrief_school_activity: currentForm.rating_debrief_school_activity
    }
  });

  const saveDraftQuietly = useCallback(async (currentForm) => {
    if (!canEdit || isSubmitted) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`${API}/api/ri/student/forms/feedback`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(preparePayload(currentForm, 'Draft'))
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

  useEffect(() => {
    if (data?.feedback) {
      const fb = data.feedback;
      setForm({
        rating_institutional_visits: fb.rating_institutional_visits || fb.activity_ratings?.institutional_visits || 0,
        rating_household_surveys: fb.rating_household_surveys || fb.activity_ratings?.household_surveys || 0,
        rating_community_project: fb.rating_community_project || fb.activity_ratings?.community_project || 0,
        rating_debrief_school_activity: fb.rating_debrief_school_activity || fb.activity_ratings?.debrief_school_activity || 0,
        best_practices_observed: fb.best_practices_observed || '',
        other_activities_implemented: fb.other_activities_implemented || '',
        issues_affecting_implementation: fb.issues_affecting_implementation || '',
        suggestions_to_improve_program: fb.suggestions_to_improve_program || fb.suggestions_for_improvement || '',
        overall_rating: fb.overall_rating || fb.experience_rating || 5,
        mentorship_rating: fb.mentorship_rating || 5,
        village_reception_rating: fb.village_reception_rating || 5,
        logistics_rating: fb.logistics_rating || 4,
        impactful_learning: fb.impactful_learning || '',
        paradigm_shift: fb.paradigm_shift || '',
        willing_for_followup: fb.willing_for_followup ?? true
      });
    }
  }, [data]);

  const handleSubmit = async (submitStatus) => {
    if (submitStatus === 'Submitted') {
      const r1 = parseInt(form.rating_institutional_visits, 10) || 0;
      const r2 = parseInt(form.rating_household_surveys, 10) || 0;
      const r3 = parseInt(form.rating_community_project, 10) || 0;
      const r4 = parseInt(form.rating_debrief_school_activity, 10) || 0;

      if (!r1 || !r2 || !r3 || !r4) {
        toast('Immersion Activities Rating (Rate 4 Activities) is compulsory. Please rate all 4 activities before submitting.', 'error');
        return;
      }

      if (!form.best_practices_observed?.trim()) {
        toast('Question 6: "Best practices of village observed during visit" is compulsory. Please enter your observations before submitting.', 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...preparePayload(form, submitStatus),
        is_update_response: isEditingResponse
      };
      const res = await fetch(`${API}/api/ri/student/forms/feedback`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok) {
        toast(result.message || (isEditingResponse ? 'RI Feedback Form updated and resubmitted successfully!' : 'RI Feedback Form submitted successfully'), 'success');
        isDirtyRef.current = false;
        setIsEditingResponse(false);
        onClose();
      } else {
        toast(result.message || 'Failed to submit feedback form', 'error');
      }
    } catch (err) {
      toast('Network error submitting feedback form', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderActivityRatingCard = (key, title, subtitle) => {
    const val = parseInt(form[key], 10) || 0;
    const isRated = val >= 1 && val <= 5;
    const ratingLabels = {
      1: '1 Star • Poor',
      2: '2 Stars • Fair',
      3: '3 Stars • Good',
      4: '4 Stars • Very Good',
      5: '5 Stars • Excellent'
    };

    return (
      <div style={{
        backgroundColor: '#ffffff',
        border: isRated ? '1px solid #e2e8f0' : '1.5px solid #fca5a5',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>{title} <span style={{ color: '#dc2626' }}>*</span></span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
            {subtitle}
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingTop: '10px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', gap: '3px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  isDirtyRef.current = true;
                  setForm(prev => ({ ...prev, [key]: star }));
                }}
                title={`${star} Star${star > 1 ? 's' : ''}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: canEdit ? 'pointer' : 'default',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.transform = 'scale(1.18)'; }}
                onMouseLeave={(e) => { if (canEdit) e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Star
                  size={22}
                  fill={star <= val ? '#f59e0b' : 'none'}
                  color={star <= val ? '#f59e0b' : '#cbd5e1'}
                />
              </button>
            ))}
          </div>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            color: !isRated ? '#dc2626' : val >= 4 ? '#047857' : val === 3 ? '#d97706' : '#dc2626',
            backgroundColor: !isRated ? '#fef2f2' : val >= 4 ? '#ecfdf5' : val === 3 ? '#fffbeb' : '#fef2f2',
            padding: '3px 9px',
            borderRadius: '6px',
            border: !isRated ? '1px solid #fecaca' : val >= 4 ? '1px solid #a7f3d0' : val === 3 ? '1px solid #fde68a' : '1px solid #fecaca'
          }}>
            {isRated ? ratingLabels[val] : 'Rating Required *'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div>
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

      {isCorrection && (
        <div style={{ backgroundColor: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#991b1b' }}>
          <strong>⚠️ Mentor Correction Request:</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>{data?.faculty_remarks || 'Please update your feedback form entries and resubmit.'}</p>
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
                  : 'RI Feedback Form (Form VIII) Submitted'}
              </div>
              <div style={{ fontSize: '12px', color: isEditingResponse ? '#b45309' : '#15803d' }}>
                {isEditingResponse
                  ? 'Modify any answers below. Click "Update & Resubmit RI Feedback Form" to save changes to your submission.'
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
          <span>Form VIII (RI Feedback Form) has been reviewed and finalized by your faculty mentor and is locked against further edits.</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>

        {/* ── SECTION: 4-ACTIVITY STAR RATING ── */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Star size={16} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
              Immersion Activities Rating (Rate 4 Activities) <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: '700' }}>* Compulsory</span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>
            Compulsory: All 4 activities must be rated (1 to 5 stars) before this form can be submitted.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {renderActivityRatingCard(
              'rating_institutional_visits',
              'Activity 1: Institutional Visits & Governance Interaction',
              'Visits to Gram Panchayat, Anganwadi, Primary Health Centre (PHC), and Village School.'
            )}
            {renderActivityRatingCard(
              'rating_household_surveys',
              'Activity 2: Household Socio-Economic Surveys & Family Visits',
              'Field interviews with families, housing, livelihood, agriculture, and government scheme awareness.'
            )}
            {renderActivityRatingCard(
              'rating_community_project',
              'Activity 3: Community Action Project & Shramdaan Activity',
              'Village cleanliness drives, tree plantation, soak-pit digging, wall painting, or social initiatives.'
            )}
            {renderActivityRatingCard(
              'rating_debrief_school_activity',
              'Activity 4: Debriefing, School / Youth Activity & Immersion',
              'Youth interactions, sports, street plays (nukkad natak), daily mentor briefings, and village assembly.'
            )}
          </div>
        </div>

        {/* ── 6. BEST PRACTICES OF VILLAGE OBSERVED DURING VISIT ── */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lightbulb size={15} style={{ color: '#047857' }} /> 6. Best practices of village observed during visit <span style={{ color: '#ef4444' }}>*</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', lineHeight: 1.45 }}>
            Highlight positive traditions, water management systems, cooperative societies, cleanliness habits, or local innovations.
          </div>
          <textarea
            rows={3}
            value={form.best_practices_observed}
            disabled={!canEdit}
            onChange={(e) => {
              isDirtyRef.current = true;
              setForm({ ...form, best_practices_observed: e.target.value });
            }}
            placeholder="Highlight positive traditions, water management systems, cooperative societies, cleanliness habits, or local innovations..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        {/* ── 7. ANY OTHER IMPORTANT ACTIVITY IMPLEMENTED ── */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
            7. Any other important activity implemented
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', lineHeight: 1.45 }}>
            Mention any cultural exchange, sports tournaments, street plays (nukkad natak), or medical awareness drives conducted.
          </div>
          <textarea
            rows={3}
            value={form.other_activities_implemented}
            disabled={!canEdit}
            onChange={(e) => {
              isDirtyRef.current = true;
              setForm({ ...form, other_activities_implemented: e.target.value });
            }}
            placeholder="Mention any cultural exchange, sports tournaments, street plays (nukkad natak), or medical awareness drives conducted..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
          />
        </div>

        {/* ── 8. OTHER ISSUES / SUGGESTIONS ── */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', marginBottom: '14px' }}>
            8. Other issues / suggestions
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
              Issues that affected implementation of the program:
            </label>
            <textarea
              rows={3}
              value={form.issues_affecting_implementation}
              disabled={!canEdit}
              onChange={(e) => {
                isDirtyRef.current = true;
                setForm({ ...form, issues_affecting_implementation: e.target.value });
              }}
              placeholder="e.g. Transportation delays, weather conditions, language barriers, need for additional time in village..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
              Suggestions to improve the Rural Immersion Program:
            </label>
            <textarea
              rows={3}
              value={form.suggestions_to_improve_program}
              disabled={!canEdit}
              onChange={(e) => {
                isDirtyRef.current = true;
                setForm({ ...form, suggestions_to_improve_program: e.target.value });
              }}
              placeholder="Recommendations for future batches, schedule pacing, preparatory activities, village interactions..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', backgroundColor: canEdit ? '#ffffff' : '#f8fafc' }}
            />
          </div>
        </div>

        {/* ── VOLUNTARY FOLLOW-UP ── */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: canEdit ? 'pointer' : 'default', backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <input
            type="checkbox"
            checked={Boolean(form.willing_for_followup)}
            disabled={!canEdit}
            onChange={(e) => {
              isDirtyRef.current = true;
              setForm({ ...form, willing_for_followup: e.target.checked });
            }}
            style={{ width: '18px', height: '18px', accentColor: '#047857' }}
          />
          <span style={{ fontWeight: '600', color: '#1e293b' }}>
            I am willing to participate in follow-up village adoption, research, or rural development initiatives with MIT-WPU.
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', flexWrap: 'wrap' }}>
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
                  <span>Update & Resubmit RI Feedback Form</span>
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
              style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('Submitted')}
              disabled={submitting}
              style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              {submitting ? 'Submitting...' : 'Submit RI Feedback Form'}
            </button>
          </>
        )}

        {isCorrection && canEdit && !isEditingResponse && (
          <button
            type="button"
            onClick={() => handleSubmit('Submitted')}
            disabled={submitting}
            style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#047857', color: '#ffffff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            {submitting ? 'Submitting...' : 'Update & Resubmit RI Feedback Form'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY PHOTO UPLOAD WIDGET (Form VII)
// ─────────────────────────────────────────────────────────────────────────────
function ActivityPhotoUpload({ canEdit, currentUrl, authHeaders, toast, onUploaded, label = 'Activity Photo (1 photo per student) *' }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast('Only JPG, PNG, or WEBP images are allowed.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Photo must be under 5 MB.', 'error');
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const token = authHeaders['Authorization']?.replace('Bearer ', '') || localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/student/forms/community-project/upload-photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        toast('Activity photo uploaded successfully!', 'success');
        onUploaded(data.url);
      } else {
        toast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      toast('Network error uploading photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const rawUrl = preview || currentUrl;
  const displayUrl = resolveImageUrl(rawUrl);

  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>{label}</label>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
        {rawUrl && (
          <div style={{ marginBottom: '12px' }}>
            <SecureImage
              src={rawUrl}
              alt="Activity preview"
              style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              onClick={() => openSecureFile(rawUrl)}
              title="Click to view full image in new tab"
            />
            {currentUrl && !preview && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} style={{ color: '#16a34a' }} /> Photo uploaded
              </div>
            )}
          </div>
        )}
        {canEdit && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#334155' }}>
            <ImagePlus size={15} />
            {uploading ? 'Uploading...' : displayUrl ? 'Replace Photo' : 'Upload Activity Photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Accepted: JPG, PNG, WEBP — Max 5 MB</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENT DOCUMENT UPLOAD WIDGET (Form VI)
// ─────────────────────────────────────────────────────────────────────────────
function AssignmentDocUpload({ canEdit, currentUrl, authHeaders, toast, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !['pdf', 'doc', 'docx'].includes(ext)) {
      toast('Only PDF, DOC, or DOCX documents are allowed.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Document must be under 10 MB.', 'error');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      const token = authHeaders['Authorization']?.replace('Bearer ', '') || localStorage.getItem('token');
      const res = await fetch(`${API}/api/ri/student/forms/problem-identification/upload-document`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        toast('Assignment document uploaded successfully!', 'success');
        onUploaded(data.url);
      } else {
        toast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      toast('Network error uploading document', 'error');
    } finally {
      setUploading(false);
    }
  };

  const getCleanDocName = (url) => {
    if (!url) return null;
    try {
      if (url.includes('key=')) {
        const keyVal = decodeURIComponent(url.split('key=')[1].split('&')[0]);
        const cleanBase = keyVal.split('/').pop() || '';
        const match = cleanBase.match(/^ri_\d+_[a-f0-9]+_(.+)$/);
        return match ? match[1] : cleanBase;
      }
      return url.split('/').pop()?.split('?')[0] || 'Report_Document';
    } catch {
      return 'Report_Document';
    }
  };

  const fileName = getCleanDocName(currentUrl);

  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>1500-Word Report Document (PDF / DOC / DOCX) <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>(Optional — Group Leader Only)</span></label>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', backgroundColor: '#f8fafc' }}>
        {fileName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '10px' }}>
            <FileUp size={16} style={{ color: '#475569', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
            <button
              type="button"
              onClick={() => openSecureFile(currentUrl)}
              style={{
                fontSize: '12px',
                color: '#047857',
                fontWeight: '600',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px'
              }}
            >
              <ExternalLink size={13} /> View
            </button>
          </div>
        )}
        {canEdit && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#334155' }}>
            <FileUp size={15} />
            {uploading ? 'Uploading...' : fileName ? 'Replace Document' : 'Upload Report Document'}
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
        )}
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>Accepted: PDF, DOC, DOCX — Max 10 MB</div>
      </div>
    </div>
  );
}
