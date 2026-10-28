import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Home, 
  AlertCircle, 
  Phone, 
  FileText, 
  LogOut,
  Clock,
  Heart,
  Users
} from 'lucide-react';

export default function FirstTimeOnboardingModal({ 
  myData = {}, 
  token, 
  API_BASE_URL, 
  isMobile, 
  onComplete, 
  onLogout 
}) {
  const [step, setStep] = useState(myData.undertaking_submitted ? 3 : 1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State for Step 2 (School Undertaking Form)
  const [formData, setFormData] = useState({
    studentName: myData.name || '',
    studentAge: myData.age || '',
    studentSchool: myData.school || '',
    studentClassGrade: myData.class_grade || '',
    parentName: myData.parent_name || myData.nominee_name || '',
    parentRelationship: myData.parent_relationship || myData.nominee_relationship || 'Parent',
    parentMobile: myData.parent_mobile || myData.phone || '',
    parentEmail: myData.parent_email || '',
    parentAddress: myData.address || '',
    medAllergies: Boolean(myData.med_allergies),
    medAsthma: Boolean(myData.med_asthma),
    medEpilepsy: Boolean(myData.med_epilepsy),
    medMedication: Boolean(myData.med_medication),
    medPhysicalLimitation: Boolean(myData.med_physical_limitation),
    medDietaryRestriction: Boolean(myData.med_dietary_restriction),
    medOther: Boolean(myData.med_other),
    medDetails: myData.med_details || '',
    bloodGroup: myData.blood_group || '',
    tshirtSize: myData.tshirt_size || '',
    jainFood: myData.jain_food || 'No',
    mondayFast: myData.monday_fast || 'No',
    consentMedia: true,
    consentData: true,
    consentChecks: true,
    consentMedical: true,
    consentAgreed: Boolean(myData.undertaking_submitted),
    signedName: myData.undertaking_signed_name || myData.parent_name || myData.name || '',
    signedDate: myData.undertaking_signed_date || new Date().toISOString().split('T')[0]
  });

  const handleInputChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleUndertakingSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.signedName || !formData.signedName.trim()) {
      setErrorMsg('Please enter your full name as digital signature.');
      return;
    }
    if (!formData.consentAgreed) {
      setErrorMsg('Please confirm the declaration agreement checkbox.');
      return;
    }
    if (!formData.tshirtSize) {
      setErrorMsg('Please select a T-Shirt size.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/student/submit-undertaking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          name: formData.studentName || myData.name,
          age: formData.studentAge || myData.age,
          school: formData.studentSchool || myData.school,
          class_grade: formData.studentClassGrade || myData.class_grade
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit undertaking');
      }

      // Step completed! Move to guidelines review
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message || 'Network error submitting form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeOnboarding = async () => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/student/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ studentId: myData.id })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to mark onboarding completed');
      }

      onComplete({
        ...myData,
        onboarding_completed: true,
        undertaking_submitted: true,
        undertaking_signed_name: formData.signedName,
        undertaking_signed_date: formData.signedDate
      });
    } catch (err) {
      setErrorMsg(err.message || 'Error completing onboarding');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '16px 12px' : '32px 20px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '780px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
        padding: isMobile ? '22px 18px' : '36px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>

        {/* ── Header Bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '18px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #ffedd5',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: '700',
              marginBottom: '6px'
            }}>
              <Sparkles size={12} /> Life Awakening Program
            </div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
              Student Onboarding &amp; Verification
            </h1>
          </div>
          <button
            onClick={onLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <LogOut size={13} /> Logout
          </button>
        </div>

        {/* ── Stepper Indicator ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {[
            { num: 1, title: 'Orientation' },
            { num: 2, title: 'Undertaking Form' },
            { num: 3, title: 'Guidelines & Safety' }
          ].map(s => {
            const isCurrent = step === s.num;
            const isDone = step > s.num;
            return (
              <div 
                key={s.num} 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px',
                  opacity: (isCurrent || isDone) ? 1 : 0.45 
                }}
              >
                <div style={{
                  height: '4px',
                  borderRadius: '2px',
                  background: isDone ? '#16a34a' : (isCurrent ? '#ea580c' : '#e2e8f0'),
                  transition: 'background 0.2s'
                }} />
                <span style={{ fontSize: '11.5px', fontWeight: isCurrent ? '750' : '600', color: isCurrent ? '#0f172a' : '#64748b' }}>
                  {s.num}. {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Step 1: Welcome & Programme Orientation ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Welcome to the Life Awakening Immersion Program!
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
                You have been enrolled in the residential experiential camp at MIT-WPU Leadership Training Camp (LTC) in Loni Kalbhor, Pune. 
                Before entering your student portal, you must complete the official Parent/Guardian Consent &amp; Undertaking Form and review essential safety guidelines.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  5 Pillars of Life Awakening
                </h4>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
                  <li>Agriculture &amp; Nature Connect</li>
                  <li>Physical Fitness &amp; Discipline</li>
                  <li>Team Building &amp; Leadership</li>
                  <li>Patriotism &amp; Nation Building</li>
                  <li>Peace, Values &amp; Reflection</li>
                </ul>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Camp Essentials
                </h4>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
                  <li>Comfortable sports shoes &amp; track pants</li>
                  <li>Digital detox: No electronic gadgets</li>
                  <li>24/7 Medical &amp; nursing support on-site</li>
                  <li>Segregated boys &amp; girls residencies</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: '9px',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(234, 88, 12, 0.2)'
                }}
              >
                Proceed to Undertaking Form <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Parent/Guardian Consent & Undertaking Form ── */}
        {step === 2 && (
          <form onSubmit={handleUndertakingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '750', color: '#0f172a' }}>
                Parent / Guardian Consent &amp; Undertaking Form
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Please review and verify all participant information, medical disclosures, and guardian consent.
              </p>
            </div>

            {/* Student & Guardian Info */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Student Full Name</label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => handleInputChange('studentName', e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Class / Grade</label>
                <input
                  type="text"
                  value={formData.studentClassGrade}
                  onChange={(e) => handleInputChange('studentClassGrade', e.target.value)}
                  placeholder="e.g. 7th Grade"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>School Name</label>
                <input
                  type="text"
                  value={formData.studentSchool}
                  onChange={(e) => handleInputChange('studentSchool', e.target.value)}
                  placeholder="School name"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Student Age</label>
                <input
                  type="number"
                  value={formData.studentAge}
                  onChange={(e) => handleInputChange('studentAge', e.target.value)}
                  placeholder="Age"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Parent / Guardian Full Name</label>
                <input
                  type="text"
                  value={formData.parentName}
                  onChange={(e) => handleInputChange('parentName', e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Parent Mobile Number</label>
                <input
                  type="tel"
                  value={formData.parentMobile}
                  onChange={(e) => handleInputChange('parentMobile', e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Medical Disclosures */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Medical &amp; Dietary Disclosure
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#64748b' }}>
                Please check any conditions that apply so our medical team and kitchen staff can take proper care:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                {[
                  { field: 'medAllergies', label: 'Allergies (food/dust/medicine)' },
                  { field: 'medAsthma', label: 'Asthma / Respiratory condition' },
                  { field: 'medEpilepsy', label: 'Epilepsy / Seizures' },
                  { field: 'medMedication', label: 'Taking regular daily medication' },
                  { field: 'medPhysicalLimitation', label: 'Physical limitations / injury' },
                  { field: 'medDietaryRestriction', label: 'Special dietary restrictions' }
                ].map(item => (
                  <label key={item.field} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(formData[item.field])}
                      onChange={(e) => handleInputChange(item.field, e.target.checked)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Medical / Dietary Details (Optional)</label>
                <input
                  type="text"
                  value={formData.medDetails}
                  onChange={(e) => handleInputChange('medDetails', e.target.value)}
                  placeholder="Provide any specific medical or dietary notes..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* T-Shirt Size & Food Preferences */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>T-Shirt Size *</label>
                <select
                  value={formData.tshirtSize}
                  onChange={(e) => handleInputChange('tshirtSize', e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="">-- Select Size --</option>
                  <option value="36 - S">36 - S</option>
                  <option value="38 - M">38 - M</option>
                  <option value="40 - L">40 - L</option>
                  <option value="42 - XL">42 - XL</option>
                  <option value="44 - XXL">44 - XXL</option>
                  <option value="46 - XXXL">46 - XXXL</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Jain Food Required?</label>
                <select
                  value={formData.jainFood}
                  onChange={(e) => handleInputChange('jainFood', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>Monday Fast?</label>
                <select
                  value={formData.mondayFast}
                  onChange={(e) => handleInputChange('mondayFast', e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Declaration & Signature */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.consentAgreed}
                  onChange={(e) => handleInputChange('consentAgreed', e.target.checked)}
                  required
                  style={{ marginTop: '3px' }}
                />
                <span style={{ lineHeight: 1.5 }}>
                  <strong>Declaration:</strong> I/we confirm that all information provided is accurate. We grant permission for participation in Life Awakening activities, authorize immediate medical assistance in emergencies, and agree to uphold all safety and disciplinary standards.
                </span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '12px', marginTop: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Digital Signature (Full Name) *</label>
                  <input
                    type="text"
                    value={formData.signedName}
                    onChange={(e) => handleInputChange('signedName', e.target.value)}
                    placeholder="Enter full name as digital signature"
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Date</label>
                  <input
                    type="text"
                    value={formData.signedDate}
                    disabled
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#64748b', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: submitting ? '#94a3b8' : '#ea580c',
                  color: '#ffffff',
                  border: 'none',
                  padding: '11px 22px',
                  borderRadius: '9px',
                  fontWeight: '700',
                  fontSize: '13.5px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(234, 88, 12, 0.2)'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Undertaking & Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: Programme Guidelines & Safety Protocols Review ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '750', color: '#0f172a' }}>
                Key Conduct &amp; Accommodation Guidelines
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Review these essential guidelines before entering the student portal:
              </p>
            </div>

            {/* Accommodation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: '750', color: '#0f172a' }}>Sinhagad Block</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', background: '#fff7ed', color: '#c2410c', padding: '2px 7px', borderRadius: '4px' }}>
                    Boys’ Accommodation
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                  Dedicated residential block strictly for male students under 24/7 supervision of male residential coordinators and accompanying faculty.
                </p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: '750', color: '#0f172a' }}>Pratapgad Block</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', background: '#fff7ed', color: '#c2410c', padding: '2px 7px', borderRadius: '4px' }}>
                    Girls’ Accommodation
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                  Secure residential block strictly reserved for female students under exclusive supervision of female coordinators and lady faculty.
                </p>
              </div>
            </div>

            {/* Conduct & Emergency Highlights */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Key Safety Protocols
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#475569', lineHeight: 1.55 }}>
                <li><strong>Respect &amp; Punctuality:</strong> Attend all activities, reflections, and meals promptly on time.</li>
                <li><strong>No Electronic Gadgets:</strong> Mobile phones and entertainment devices remain deposited for digital mindfulness.</li>
                <li><strong>Campus Medical Staff:</strong> 24/7 First-aid clinic on campus (Dr. Anwar Shaikh Sir &middot; 9823443537, Sister Nirmala &middot; 8208938209).</li>
                <li><strong>Campus Security:</strong> Gated perimeter, 24/7 CCTV surveillance, and faculty escorts.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>

              <button
                onClick={handleFinalizeOnboarding}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: submitting ? '#94a3b8' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '9px',
                  fontWeight: '750',
                  fontSize: '14px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)'
                }}
              >
                <CheckCircle2 size={16} />
                {submitting ? 'Unlocking Portal...' : 'Acknowledge & Enter Student Portal'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
