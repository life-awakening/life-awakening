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
  Lock,
  RefreshCw,
  Sparkles,
  Award,
  ShieldCheck,
  Building,
  Users
} from 'lucide-react';
import {
  SELF_ASSESSMENT_SECTIONS,
  POST_PILLARS_Q22,
  POST_FACULTY_PILLARS,
  POST_LEADERS_Q28,
  POST_FACILITIES_Q29,
  POST_OPEN_ENDED,
  parseFeedbackForDisplay
} from '../utils/feedbackQuestions';

// Confetti Popper
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

export default function PostLtcFeedbackForm({ token, role = 'student', myData, onFeedbackSubmitted }) {
  const { t } = useLanguage();
  const API = API_BASE_URL;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [step, setStep] = useState(1);
  const [validationError, setValidationError] = useState('');
  const [currentErrorId, setCurrentErrorId] = useState('');
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [userId, setUserId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isLockedByBatchAdmin, setIsLockedByBatchAdmin] = useState(() => Boolean(myData?.post_service_feedback_locked));
  const formTopRef = useRef(null);

  useEffect(() => {
    if (typeof myData?.post_service_feedback_locked === 'boolean') {
      setIsLockedByBatchAdmin(myData.post_service_feedback_locked);
    }
  }, [myData?.post_service_feedback_locked]);

  // Unlock check for students
  const getUnlockInfo = () => {
    if (role !== 'student') return { isUnlocked: true, unlockDate: null };
    if (!myData || (!myData.batch_start_date && !myData.batch_end_date)) {
      return { isUnlocked: true, unlockDate: null };
    }
    const now = new Date();
    let unlockDate = null;
    if (myData.batch_end_date) {
      const endDate = new Date(myData.batch_end_date);
      unlockDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
    } else if (myData.batch_start_date) {
      const startDate = new Date(myData.batch_start_date);
      unlockDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 4, 0, 0, 0, 0);
    }
    if (!unlockDate) return { isUnlocked: true, unlockDate: null };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return {
      isUnlocked: today >= unlockDate,
      unlockDate
    };
  };

  const unlockInfo = getUnlockInfo();

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
    pillarActivitiesLiked: {},
    facultyRatings: {}, // { [pillarId]: { [memberName]: rating } }
    leadersRatings: {},
    facilitiesRatings: {},
    appreciated_arrangements: '',
    stay_difficulties: '',
    recommended_improvements: ''
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
          if (typeof prof.post_service_feedback_locked === 'boolean') {
            setIsLockedByBatchAdmin(prof.post_service_feedback_locked);
          }
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

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/feedback/my-submissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.post_service_feedback_locked === 'boolean') {
          setIsLockedByBatchAdmin(data.post_service_feedback_locked);
        }
        const postLtc = (data.submissions || []).find(s => s.category === 'Post-LTC');
        if (postLtc) {
          try {
            setSubmittedData(JSON.parse(postLtc.feedback_text));
          } catch {
            setSubmittedData({ expectations: postLtc.feedback_text });
          }
        }
      }
    } catch (e) {
      console.error('Error fetching submissions', e);
    } finally {
      setLoading(false);
    }
  }, [token, API]);

  // Load progress
  useEffect(() => {
    if (userId) {
      const key = `ltc_${role}_post_feedback_progress_${userId}`;
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
          console.error('Error restoring post-feedback progress', e);
        }
      }
      setIsLoaded(true);
    }
  }, [userId, role]);

  // Auto-save progress
  useEffect(() => {
    if (isLoaded && userId) {
      const key = `ltc_${role}_post_feedback_progress_${userId}`;
      localStorage.setItem(key, JSON.stringify({ formData, step }));
    }
  }, [formData, step, userId, isLoaded, role]);

  useEffect(() => {
    fetchSubmissions();
    fetchProfile();
  }, [fetchSubmissions, fetchProfile]);

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
      // Validate Q22 (Pillars liked)
      for (const p of POST_PILLARS_Q22.items) {
        if (!formData.pillarActivitiesLiked[p]) {
          return {
            message: `${t("Please rate activity for pillar:")} ${p}`,
            id: `post-pil-${p.replace(/[^\w]/g, '_')}`
          };
        }
      }

      // Validate Q23-Q27 (Faculty members)
      for (const fp of POST_FACULTY_PILLARS) {
        const pillarFac = formData.facultyRatings[fp.id] || {};
        for (const member of fp.members) {
          if (!pillarFac[member]) {
            return {
              message: `${t("Please rate faculty member:")} ${member} (${fp.pillarName})`,
              id: `fac-${member.replace(/[^\w]/g, '_')}`
            };
          }
        }
      }
      return null;
    }

    if (currentStep === 6) {
      // Validate Q28 (Leaders)
      for (const leader of POST_LEADERS_Q28.members) {
        if (!formData.leadersRatings[leader]) {
          return {
            message: `${t("Please rate residential leader:")} ${leader}`,
            id: `leader-${leader.replace(/[^\w]/g, '_')}`
          };
        }
      }

      // Validate Q29 (Facilities)
      for (const item of POST_FACILITIES_Q29.items) {
        if (!formData.facilitiesRatings[item]) {
          return {
            message: `${t("Please rate facility arrangement:")} ${item}`,
            id: `facil-${item.replace(/[^\w]/g, '_')}`
          };
        }
      }

      // Validate Q30, Q31, Q32 (Open-ended reflections)
      if (!formData.appreciated_arrangements.trim()) {
        return {
          message: t("What you appreciated most about residential arrangements is required."),
          id: "appreciated_arrangements"
        };
      }
      if (!formData.stay_difficulties.trim()) {
        return {
          message: t("Difficulties experienced during stay is required."),
          id: "stay_difficulties"
        };
      }
      if (!formData.recommended_improvements.trim()) {
        return {
          message: t("Recommendations for future programmes is required."),
          id: "recommended_improvements"
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
    if (isLockedByBatchAdmin || myData?.post_service_feedback_locked) {
      alert(t("Post-LTC Feedback Form is locked by the administrator for your batch. Submissions are no longer accepted."));
      return;
    }
    const err = validateStep(6);
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
          category: 'Post-LTC',
          feedback_text: JSON.stringify(formData),
          additional_notes: 'Submitted via customized Post-LTC Feedback Form'
        })
      });

      if (res.ok) {
        setConfettiTrigger(Date.now());
        if (userId) {
          localStorage.removeItem(`ltc_${role}_post_feedback_progress_${userId}`);
        }
        if (onFeedbackSubmitted) onFeedbackSubmitted();
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
      const res = await fetch(`${API}/api/student/feedback/pdf/${userId}/Post-LTC`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Post_LTC_Feedback_${formData.prn || userId}.pdf`;
      a.click();
    } catch (e) {
      alert("Error downloading feedback PDF: " + e.message);
    }
  };

  // Already Submitted View (always accessible for reviewing submissions)
  if (submittedData) {
    const pairs = parseFeedbackForDisplay(submittedData, 'Post-LTC');

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
                {t("Post-LTC Feedback Already Submitted")}
              </h2>
              <p style={{ fontSize: '12.5px', margin: '4px 0 0 0', opacity: 0.9 }}>
                {t("Thank you! Your Post-LTC Feedback has been recorded in our system.")}
              </p>
            </div>
          </div>

          <button
            onClick={downloadFeedbackPdf}
            style={{
              background: '#ffffff',
              color: '#059669',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Download size={16} /> {t("Download PDF Copy")}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {pairs.map((p, idx) => (
            <div key={idx} style={{ padding: '16px 18px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>{p.q}</div>
              <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600', whiteSpace: 'pre-wrap' }}>{p.a}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Locked by Administrator View
  if (isLockedByBatchAdmin || myData?.post_service_feedback_locked) {
    return (
      <div style={{
        padding: '36px 24px',
        maxWidth: '700px',
        margin: '20px auto',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1.5px solid #fecaca',
        textAlign: 'center',
        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.06)'
      }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px 0' }}>
          {t("Post-LTC Feedback Form is Locked")}
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 16px auto', maxWidth: '500px', lineHeight: 1.5 }}>
          {t("The Post-LTC Feedback and Service Trainer Feedback forms have been locked by the administrator for your batch. Submissions are no longer accepted.")}
        </p>
      </div>
    );
  }

  // Locked by Program Schedule View
  if (!unlockInfo.isUnlocked) {
    return (
      <div style={{
        padding: '36px 24px',
        maxWidth: '700px',
        margin: '20px auto',
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid #cbd5e1',
        textAlign: 'center',
        boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
      }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
          <Lock size={28} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
          {t("Post-LTC Feedback is Currently Locked")}
        </h2>
        <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 16px auto', maxWidth: '480px', lineHeight: 1.5 }}>
          {t("The Post-LTC feedback form unlocks upon conclusion of your Life Awakening Program on:")}{" "}
          <strong style={{ color: '#0f172a' }}>
            {unlockInfo.unlockDate ? unlockInfo.unlockDate.toLocaleDateString() : t("the final program day")}
          </strong>.
        </p>
      </div>
    );
  }

  // Render a rating matrix section
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
          {sec.qNum === 21 ? t("LTC Evaluation — Please indicate how accurately each statement describes you.") : sec.prompt}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sec.statements.map((stmt, sIdx) => {
          const currentVal = formData.ratings[stmt];
          const hasError = currentErrorId === `rating-${stmt.replace(/[^\w]/g, '_')}`;

          return (
            <div
              key={sIdx}
              id={`rating-${stmt.replace(/[^\w]/g, '_')}`}
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
                          ratings: { ...prev.ratings, [stmt]: opt }
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

      {/* Header Banner with Step Indicators */}
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
              {t("Life Awakening Program (LAP) — Post-LTC Feedback")}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', margin: '4px 0 0 0' }}>
              {step === 1 ? t("Step 1 of 6: Personal Details") :
               step === 2 ? t("Step 2 of 6: Self Assessment (Part 1 — Problem-Solving & Social)") :
               step === 3 ? t("Step 3 of 6: Self Assessment (Part 2 — Leadership & Resilience)") :
               step === 4 ? t("Step 4 of 6: Self Assessment (Part 3 — Fitness & Spirituality)") :
               step === 5 ? t("Step 5 of 6: LTC Pillars & Faculty Ratings") :
               t("Step 6 of 6: Residential Experience & Reflections")}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5, 6].map(s => (
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
            {t("Now that you have completed the LAP Program, please fill this again sincerely. Read each statement and choose the option that first comes to mind.")}
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
            <strong>{t("SELF ASSESSMENT")}:</strong> {t("Answer fast — don’t overthink.")}
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

      {/* STEP 5: LTC Pillars & Faculty Ratings (Q22 to Q27) */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Q22: Pillar Activities Liked */}
          <div id="q22_pillars_liked" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q22
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                {POST_PILLARS_Q22.prompt} *
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {POST_PILLARS_Q22.items.map(p => {
                const currentVal = formData.pillarActivitiesLiked[p];
                return (
                  <div key={p} id={`post-pil-${p.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{p}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${POST_PILLARS_Q22.scale.length}, 1fr)`, gap: '8px' }}>
                      {POST_PILLARS_Q22.scale.map(opt => {
                        const isSelected = currentVal === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              pillarActivitiesLiked: { ...prev.pillarActivitiesLiked, [p]: opt }
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

          {/* Q23 - Q27: Faculty Members for each pillar */}
          {POST_FACULTY_PILLARS.map(fp => {
            const pillarFac = formData.facultyRatings[fp.id] || {};
            return (
              <div key={fp.id} id={fp.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                    Q{fp.qNum}
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                    {fp.prompt} *
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {fp.members.map(member => {
                    const currentVal = pillarFac[member];
                    return (
                      <div key={member} id={`fac-${member.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{member}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${fp.scale.length}, 1fr)`, gap: '6px' }}>
                          {fp.scale.map(opt => {
                            const isSelected = currentVal === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  facultyRatings: {
                                    ...prev.facultyRatings,
                                    [fp.id]: { ...(prev.facultyRatings[fp.id] || {}), [member]: opt }
                                  }
                                }))}
                                style={{
                                  padding: '7px 8px',
                                  borderRadius: '8px',
                                  border: isSelected ? '1.5px solid #154388' : '1px solid #cbd5e1',
                                  background: isSelected ? '#eff6ff' : '#ffffff',
                                  color: isSelected ? '#154388' : '#334155',
                                  fontSize: '11px',
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
            );
          })}
        </div>
      )}

      {/* STEP 6: Leaders, Facilities & Open-Ended Reflections (Q28 - Q32) */}
      {step === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Q28: LTC Residential Leaders */}
          <div id="q28_residential_leaders" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q28
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                {POST_LEADERS_Q28.prompt} *
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {POST_LEADERS_Q28.members.map(leader => {
                const currentVal = formData.leadersRatings[leader];
                return (
                  <div key={leader} id={`leader-${leader.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{leader}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${POST_LEADERS_Q28.scale.length}, 1fr)`, gap: '6px' }}>
                      {POST_LEADERS_Q28.scale.map(opt => {
                        const isSelected = currentVal === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              leadersRatings: { ...prev.leadersRatings, [leader]: opt }
                            }))}
                            style={{
                              padding: '7px 8px',
                              borderRadius: '8px',
                              border: isSelected ? '1.5px solid #154388' : '1px solid #cbd5e1',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              color: isSelected ? '#154388' : '#334155',
                              fontSize: '11px',
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

          {/* Q29: LTC Facilities & Arrangements */}
          <div id="q29_ltc_facilities" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q29
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a', margin: '4px 0 0 0' }}>
                {POST_FACILITIES_Q29.prompt} *
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {POST_FACILITIES_Q29.items.map(item => {
                const currentVal = formData.facilitiesRatings[item];
                return (
                  <div key={item} id={`facil-${item.replace(/[^\w]/g, '_')}`} style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '650', color: '#1e293b', marginBottom: '8px' }}>{item}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${POST_FACILITIES_Q29.scale.length}, 1fr)`, gap: '8px' }}>
                      {POST_FACILITIES_Q29.scale.map(opt => {
                        const isSelected = currentVal === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              facilitiesRatings: { ...prev.facilitiesRatings, [item]: opt }
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

          {/* Q30 - Q32: Open-Ended Reflections */}
          {POST_OPEN_ENDED.map(oe => (
            <div key={oe.id} id={oe.key} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px' }}>
                Q{oe.qNum}
              </span>
              <label style={{ display: 'block', fontSize: '14.5px', fontWeight: '750', color: '#0f172a', margin: '6px 0 8px 0' }}>
                {oe.prompt} *
              </label>
              <textarea
                rows={4}
                value={formData[oe.key]}
                onChange={e => setFormData({ ...formData, [oe.key]: e.target.value })}
                placeholder={t("Write your sincere reflections here...")}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
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

        {step < 6 ? (
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
            {submitting ? t("Submitting...") : t("Submit Post-LTC Feedback")}
          </button>
        )}
      </div>
    </div>
  );
}
