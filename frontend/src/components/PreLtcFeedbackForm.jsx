import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import API_BASE_URL from '@/config/apiConfig';
import {
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Download,
  ClipboardList,
  Sparkles,
  RefreshCw,
  User,
  Heart,
  Compass,
  Award,
  ShieldCheck,
  Zap
} from 'lucide-react';
import {
  SELF_ASSESSMENT_SECTIONS,
  PRE_ORIENTATION_Q22,
  PRE_PILLARS_Q23,
  PRE_ADDITIONAL_Q24,
  parseFeedbackForDisplay
} from '../utils/feedbackQuestions';

// Simple Confetti particle effect
const ConfettiPopper = ({ trigger }) => {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!trigger) return;
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    const newParticles = Array.from({ length: 36 }).map((_, i) => ({
      id: `${trigger}-${i}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.7) * 350,
      r: Math.random() * 360,
      size: Math.random() * 7 + 4
    }));
    setParticles(newParticles);
    const t = setTimeout(() => setParticles([]), 1800);
    return () => clearTimeout(t);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: '40%', left: '50%', pointerEvents: 'none', zIndex: 99999 }}>
      {particles.map(p => (
        <span
          key={p.id}
          className="confetti-dot"
          style={{
            position: 'absolute',
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            backgroundColor: p.color,
            '--x': `${p.x}px`,
            '--y': `${p.y}px`,
            '--r': `${p.r}deg`
          }}
        />
      ))}
    </div>
  );
};

export default function PreLtcFeedbackForm({ token, role = 'student' }) {
  const { t } = useLanguage();
  const API = API_BASE_URL;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [step, setStep] = useState(1);
  const [validationError, setValidationError] = useState('');
  const [currentErrorId, setCurrentErrorId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [userId, setUserId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const formTopRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    surname: '',
    dob: '',
    gender: '',
    schoolName: '',
    departmentName: '',
    prn: '',
    classYear: '',
    cityState: '',
    ratings: {},
    orientationRatings: {},
    excitedPillars: {},
    additionalFeedback: ''
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToFormTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
    if (formTopRef.current) {
      try {
        formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        formTopRef.current.scrollIntoView(true);
      }
    }
  };

  const scrollToElement = (id) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const origOutline = el.style.outline;
      const origBorder = el.style.borderColor;
      el.style.outline = '2.5px solid #ef4444';
      el.style.borderColor = '#ef4444';
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        try { el.focus(); } catch {}
      }
      setTimeout(() => {
        el.style.outline = origOutline;
        el.style.borderColor = origBorder;
      }, 3500);
    }
  };

  // Profile prefetch
  const fetchProfile = useCallback(async () => {
    try {
      const endpoint = role === 'faculty' ? `${API}/api/faculty/profile` : `${API}/api/student/profile`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        const prof = d.profile || d.user;
        if (prof) {
          setUserId(prof.id);
          setFormData(prev => ({
            ...prev,
            firstName: prev.firstName || prof.first_name || '',
            middleName: prev.middleName || prof.middle_name || '',
            surname: prev.surname || prof.last_name || '',
            dob: prev.dob || (prof.dob ? prof.dob.split('T')[0] : ''),
            gender: prev.gender || prof.gender || '',
            schoolName: prev.schoolName || prof.school || '',
            departmentName: prev.departmentName || prof.department || '',
            prn: prev.prn || prof.prn || '',
            classYear: prev.classYear || prof.semester || prof.division || '',
            cityState: prev.cityState || prof.address || prof.nationality || ''
          }));
        }
      }
    } catch (e) {
      console.error('Error fetching profile', e);
    }
  }, [token, role, API]);

  // Existing submission check
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/feedback/my-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const preLtc = (data.submissions || []).find(s => s.category === 'Pre-LTC');
        if (preLtc) {
          try {
            setSubmittedData(JSON.parse(preLtc.feedback_text));
          } catch {
            setSubmittedData({ expectations: preLtc.feedback_text });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching submissions', e);
    } finally {
      setLoading(false);
    }
  }, [token, API]);

  // Load progress from localStorage
  useEffect(() => {
    if (userId) {
      const key = `ltc_${role}_pre_feedback_progress_${userId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.formData) {
            setFormData(prev => ({ ...prev, ...parsed.formData }));
          }
          if (parsed.step) {
            setStep(parsed.step);
          }
        } catch (e) {
          console.error('Error restoring pre-feedback progress', e);
        }
      }
      setIsLoaded(true);
    }
  }, [userId, role]);

  // Auto-save progress to localStorage
  useEffect(() => {
    if (isLoaded && userId) {
      const key = `ltc_${role}_pre_feedback_progress_${userId}`;
      localStorage.setItem(key, JSON.stringify({ formData, step }));
    }
  }, [formData, step, userId, isLoaded, role]);

  useEffect(() => {
    fetchSubmissions();
    fetchProfile();
  }, [fetchSubmissions, fetchProfile]);

  // Helper to get sections by step:
  // Step 2: Q8 - Q13 (Cognitive, Creative, Interpersonal)
  // Step 3: Q14 - Q17 (Leadership, Resilience, Optimism, Stress)
  // Step 4: Q18 - Q21 (Fitness, Exercise, Ethics, Spirituality)
  const getStepSections = (stepNum) => {
    if (stepNum === 2) return SELF_ASSESSMENT_SECTIONS.slice(0, 6); // Q8-Q13
    if (stepNum === 3) return SELF_ASSESSMENT_SECTIONS.slice(6, 10); // Q14-Q17
    if (stepNum === 4) return SELF_ASSESSMENT_SECTIONS.slice(10, 14); // Q18-Q21
    return [];
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!formData.firstName.trim()) return { message: t("First Name is required."), id: "firstName" };
      if (!formData.surname.trim()) return { message: t("Surname is required."), id: "surname" };
      if (!formData.dob) return { message: t("Date of Birth is required."), id: "dob" };
      if (!formData.gender) return { message: t("Gender is required."), id: "gender" };
      if (!formData.schoolName.trim()) return { message: t("School Name is required."), id: "schoolName" };
      if (!formData.departmentName.trim()) return { message: t("Department Name is required."), id: "departmentName" };
      if (!formData.prn.trim()) return { message: t("PRN is required."), id: "prn" };
      if (!formData.classYear) return { message: t("Class / Year is required."), id: "classYear" };
      return null;
    }

    if (currentStep >= 2 && currentStep <= 4) {
      const sections = getStepSections(currentStep);
      for (const sec of sections) {
        for (const stmt of sec.statements) {
          if (!formData.ratings[stmt]) {
            return {
              message: `${t("Please rate:")} "${stmt}"`,
              id: `rating-${stmt.replace(/[^\w]/g, '_')}`
            };
          }
        }
      }
      return null;
    }

    if (currentStep === 5) {
      // Validate Q22 (Orientation items)
      for (const item of PRE_ORIENTATION_Q22.items) {
        if (!formData.orientationRatings[item]) {
          return {
            message: `${t("Please rate Orientation on:")} ${item}`,
            id: `orient-${item.replace(/[^\w]/g, '_')}`
          };
        }
      }
      // Validate Q23 (5 Pillars excitement)
      for (const pillar of PRE_PILLARS_Q23.items) {
        if (!formData.excitedPillars[pillar]) {
          return {
            message: `${t("Please rate excitement for pillar:")} ${pillar}`,
            id: `pillar-${pillar.replace(/[^\w]/g, '_')}`
          };
        }
      }
      // Q24: Additional comments is optional or required? In Google form it has * so require at least 2 chars
      if (!formData.additionalFeedback || !formData.additionalFeedback.trim()) {
        return {
          message: t("Additional feedback/comment is required."),
          id: "additionalFeedback"
        };
      }
    }

    return null;
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setValidationError(err.message);
      setCurrentErrorId(err.id);
      scrollToElement(err.id);
      return;
    }
    setValidationError('');
    setCurrentErrorId('');
    setStep(prev => prev + 1);
    setConfettiTrigger(Date.now());
    scrollToFormTop();
  };

  const handleBack = () => {
    setValidationError('');
    setCurrentErrorId('');
    setStep(prev => prev - 1);
    scrollToFormTop();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const err = validateStep(5);
    if (err) {
      setValidationError(err.message);
      setCurrentErrorId(err.id);
      scrollToElement(err.id);
      return;
    }
    setValidationError('');
    setCurrentErrorId('');
    setSubmitting(true);

    try {
      const res = await fetch(`${API}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category: 'Pre-LTC',
          feedback_text: JSON.stringify(formData),
          additional_notes: 'Submitted via customized Pre-LTC Feedback Form'
        })
      });

      if (res.ok) {
        setShowSuccessModal(true);
        setConfettiTrigger(Date.now());
        if (userId) {
          localStorage.removeItem(`ltc_${role}_pre_feedback_progress_${userId}`);
        }
        fetchSubmissions();
      } else {
        const d = await res.json();
        alert(d.message || t("Failed to submit feedback."));
      }
    } catch (err) {
      console.error(err);
      alert(t("Server error while submitting feedback."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API}/api/student/feedback/pdf/${userId}/Pre-LTC`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Pre_LTC_Feedback_${formData.prn || userId}.pdf`;
      a.click();
    } catch (e) {
      alert("Error downloading feedback PDF: " + e.message);
    }
  };

  // Render a rating matrix question
  const renderLikertSection = (sec) => (
    <div
      key={sec.id}
      id={sec.id}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: isMobile ? '14px' : '20px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}
    >
      <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
            Q{sec.qNum}
          </span>
          <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '750', color: '#0f172a', margin: 0 }}>
            {sec.title}
          </h3>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
          {sec.prompt}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sec.statements.map((stmt, sIdx) => {
          const stmtKey = stmt;
          const currentVal = formData.ratings[stmtKey];
          const hasError = currentErrorId === `rating-${stmtKey.replace(/[^\w]/g, '_')}`;

          return (
            <div
              key={sIdx}
              id={`rating-${stmtKey.replace(/[^\w]/g, '_')}`}
              style={{
                background: hasError ? '#fef2f2' : '#f8fafc',
                border: hasError ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: isMobile ? '12px' : '14px 16px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '600', color: '#1e293b', marginBottom: '10px' }}>
                <span style={{ color: '#64748b', marginRight: '6px' }}>{sIdx + 1}.</span>
                {stmt}
              </div>

              {/* Likert Scale Options Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : `repeat(${sec.scale.length}, 1fr)`,
                  gap: '8px'
                }}
              >
                {sec.scale.map((opt, optIdx) => {
                  const isSelected = currentVal === opt;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          ratings: { ...prev.ratings, [stmtKey]: opt }
                        }));
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #154388' : '1px solid #cbd5e1',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        color: isSelected ? '#154388' : '#334155',
                        fontSize: '11.5px',
                        fontWeight: isSelected ? '700' : '500',
                        cursor: 'pointer',
                        textAlign: isMobile ? 'left' : 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isMobile ? 'flex-start' : 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: isSelected ? '4.5px solid #154388' : '1.5px solid #94a3b8',
                          flexShrink: 0
                        }}
                      />
                      <span style={{ lineHeight: 1.25 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Already Submitted View
  if (submittedData) {
    const pairs = parseFeedbackForDisplay(submittedData, 'Pre-LTC');

    return (
      <div
        ref={formTopRef}
        style={{
          padding: isMobile ? '16px' : '28px',
          maxWidth: '850px',
          margin: '0 auto',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{
          background: '#059669',
          padding: '22px 24px',
          borderRadius: '16px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                {t("Pre-LTC Feedback Already Submitted")}
              </h2>
              <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.9)', margin: '3px 0 0 0' }}>
                {t("Thank you! Your Pre-LTC Feedback has been recorded in our system.")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            style={{
              background: '#ffffff',
              color: '#059669',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={15} /> {t("Download PDF")}
          </button>
        </div>

        {/* Responses Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {pairs.map((p, idx) => (
            <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '750', color: '#154388', marginBottom: '6px' }}>
                {p.question}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {p.answer}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={formTopRef}
      style={{
        padding: isMobile ? '14px' : '24px',
        maxWidth: '850px',
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '20px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}
    >
      <ConfettiPopper trigger={confettiTrigger} />

      {/* Header Banner with Step Navigation */}
      <div style={{
        background: '#154388',
        padding: isMobile ? '16px 14px' : '24px 28px',
        margin: isMobile ? '-14px -14px 20px -14px' : '-24px -24px 24px -24px',
        borderTopLeftRadius: '19px',
        borderTopRightRadius: '19px',
        color: '#ffffff'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: '850', margin: 0 }}>
              {t("Life Awakening Program (LAP) — Pre-LTC Feedback")}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0 0' }}>
              {step === 1 ? t("Step 1 of 5: Personal Details") :
               step === 2 ? t("Step 2 of 5: Self Assessment (Part 1 — Problem-Solving & Social)") :
               step === 3 ? t("Step 3 of 5: Self Assessment (Part 2 — Leadership & Resilience)") :
               step === 4 ? t("Step 4 of 5: Self Assessment (Part 3 — Fitness & Spirituality)") :
               t("Step 5 of 5: Orientation & 5 Pillars Evaluation")}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(s => (
              <div
                key={s}
                style={{
                  width: s === step ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: s === step ? '#ffffff' : s < step ? '#10b981' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {validationError && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {validationError}
        </div>
      )}

      {/* STEP 1: Personal Details */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
            {t("You are required to take part in this study as you are commencing the Life Awakening Program at the Life Transformation Centre, MIT World Peace University. Please take time to read carefully and answer sincerely with what comes immediately to your mind.")}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>1. {t("First Name")} *</label>
              <input
                id="firstName"
                type="text"
                className="input-field"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="e.g. Rahul"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>{t("Middle Name")}</label>
              <input
                id="middleName"
                type="text"
                className="input-field"
                value={formData.middleName}
                onChange={e => setFormData({ ...formData, middleName: e.target.value })}
                placeholder="e.g. Ramesh"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>{t("Surname")} *</label>
              <input
                id="surname"
                type="text"
                className="input-field"
                value={formData.surname}
                onChange={e => setFormData({ ...formData, surname: e.target.value })}
                placeholder="e.g. Sharma"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>2. {t("Date of Birth")} *</label>
              <input
                id="dob"
                type="date"
                className="input-field"
                value={formData.dob}
                onChange={e => setFormData({ ...formData, dob: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>3. {t("Gender")} *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                {['Male', 'Female'].map(g => (
                  <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="gender"
                      checked={formData.gender === g}
                      onChange={() => setFormData({ ...formData, gender: g })}
                    />
                    {t(g)}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>4. {t("Name of School")} *</label>
              <input
                id="schoolName"
                type="text"
                className="input-field"
                value={formData.schoolName}
                onChange={e => setFormData({ ...formData, schoolName: e.target.value })}
                placeholder="e.g. School of Engineering"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>5. {t("Name of Department")} *</label>
              <input
                id="departmentName"
                type="text"
                className="input-field"
                value={formData.departmentName}
                onChange={e => setFormData({ ...formData, departmentName: e.target.value })}
                placeholder="e.g. Computer Science & Engineering"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>6. {t("PRN")} *</label>
              <input
                id="prn"
                type="text"
                className="input-field"
                value={formData.prn}
                onChange={e => setFormData({ ...formData, prn: e.target.value })}
                placeholder="e.g. 1032230000"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>7. {t("Class / Year")} *</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                {['2nd Year', '3rd Year', 'Other'].map(yr => (
                  <label key={yr} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="classYear"
                      checked={formData.classYear === yr}
                      onChange={() => setFormData({ ...formData, classYear: yr })}
                    />
                    {t(yr)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Self Assessment (Part 1 — Q8 to Q13) */}
      {step === 2 && (
        <div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '12.5px', color: '#475569' }}>
            <strong>{t("SELF ASSESSMENT")}:</strong> {t("Read each statement and choose the option that first comes to mind. Answer fast — don’t overthink.")}
          </div>
          {getStepSections(2).map(renderLikertSection)}
        </div>
      )}

      {/* STEP 3: Self Assessment (Part 2 — Q14 to Q17) */}
      {step === 3 && (
        <div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '12.5px', color: '#475569' }}>
            <strong>{t("SELF ASSESSMENT (CONTINUED)")}:</strong> {t("Leadership, Resilience & Stress Management.")}
          </div>
          {getStepSections(3).map(renderLikertSection)}
        </div>
      )}

      {/* STEP 4: Self Assessment (Part 3 — Q18 to Q21) */}
      {step === 4 && (
        <div>
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px', fontSize: '12.5px', color: '#475569' }}>
            <strong>{t("SELF ASSESSMENT (CONTINUED)")}:</strong> {t("Physical Fitness, Moral Values & Spirituality.")}
          </div>
          {getStepSections(4).map(renderLikertSection)}
        </div>
      )}

      {/* STEP 5: Orientation, 5 Pillars Excitement & Additional Comments (Q22, Q23, Q24) */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Q22: Orientation */}
          <div id="q22_orientation" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q22
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                {PRE_ORIENTATION_Q22.prompt} *
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {PRE_ORIENTATION_Q22.items.map(item => {
                const currentVal = formData.orientationRatings[item];
                return (
                  <div key={item} id={`orient-${item.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{item}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${PRE_ORIENTATION_Q22.scale.length}, 1fr)`, gap: '8px' }}>
                      {PRE_ORIENTATION_Q22.scale.map(opt => {
                        const isSelected = currentVal === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              orientationRatings: { ...prev.orientationRatings, [item]: opt }
                            }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isSelected ? '1.5px solid #154388' : '1px solid #cbd5e1',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              color: isSelected ? '#154388' : '#334155',
                              fontSize: '11.5px',
                              fontWeight: isSelected ? '700' : '500',
                              cursor: 'pointer'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Q23: 5 Pillars Excitement */}
          <div id="q23_pillars_excitement" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q23
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                {PRE_PILLARS_Q23.prompt} *
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {PRE_PILLARS_Q23.items.map(p => {
                const currentVal = formData.excitedPillars[p];
                return (
                  <div key={p} id={`pillar-${p.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{p}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${PRE_PILLARS_Q23.scale.length}, 1fr)`, gap: '8px' }}>
                      {PRE_PILLARS_Q23.scale.map(opt => {
                        const isSelected = currentVal === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              excitedPillars: { ...prev.excitedPillars, [p]: opt }
                            }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: isSelected ? '1.5px solid #154388' : '1px solid #cbd5e1',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              color: isSelected ? '#154388' : '#334155',
                              fontSize: '11.5px',
                              fontWeight: isSelected ? '700' : '500',
                              cursor: 'pointer'
                            }}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Q24: Additional Feedback */}
          <div id="additionalFeedback" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
              Q24
            </span>
            <label style={{ display: 'block', fontSize: '14.5px', fontWeight: '750', color: '#0f172a', margin: '6px 0 8px 0' }}>
              {PRE_ADDITIONAL_Q24.prompt} *
            </label>
            <textarea
              rows={4}
              value={formData.additionalFeedback}
              onChange={e => setFormData({ ...formData, additionalFeedback: e.target.value })}
              placeholder={t("Please share any specific thoughts, expectations, or comments before commencing LTC...")}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
            />
          </div>
        </div>
      )}

      {/* Step Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ChevronLeft size={16} /> {t("Back")}
          </button>
        ) : <div />}

        {step < 5 ? (
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: '#154388',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(21,67,136,0.3)'
            }}
          >
            {t("Next Step")} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{
              padding: '10px 28px',
              borderRadius: '8px',
              border: 'none',
              background: '#059669',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '800',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(5,150,105,0.3)'
            }}
          >
            {submitting ? <RefreshCw className="spinner-modern" size={16} /> : <Send size={16} />}
            {submitting ? t("Submitting...") : t("Submit Pre-LTC Feedback")}
          </button>
        )}
      </div>
    </div>
  );
}
