import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, Printer, AlertTriangle } from 'lucide-react';

export default function RiUndertakingForm({
  role = 'student', // 'student' | 'faculty'
  userInfo = {},
  undertakingData = null,
  isSubmitted = false,
  onSubmit = async () => {},
  isSubmitting = false,
  isMobile = false
}) {
  const [formData, setFormData] = useState({
    honorCodeConsent: false,
    rulesConsent: false,
    photoVideoConsent: true,
    tshirtConsent: true,
    dataConsent: true,
    bagCheckConsent: true,
    dosDontsConsent: true,
    tshirtSize: '',
    signedName: '',
    signedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  });

  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (undertakingData) {
      setFormData(prev => ({
        ...prev,
        signedName: undertakingData.signed_name || undertakingData.signedName || userInfo.name || '',
        signedDate: undertakingData.signed_date || undertakingData.signedDate || prev.signedDate,
        tshirtSize: undertakingData.tshirt_size || undertakingData.tshirtSize || ''
      }));
    } else if (userInfo.name && !formData.signedName) {
      setFormData(prev => ({ ...prev, signedName: userInfo.name }));
    }
  }, [undertakingData, userInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.honorCodeConsent || !formData.rulesConsent) {
      setFormError('Please review and accept both the Honor Code and Program Rules.');
      return;
    }
    if (role !== 'faculty' && !formData.tshirtSize) {
      setFormError('Please select your official T-Shirt size.');
      return;
    }
    if (!formData.signedName.trim()) {
      setFormError('Please enter your full name as digital signature.');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      setFormError(err.message || 'Failed to submit undertaking. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const submittedRecord = undertakingData || {};
  const signedDisplayName = submittedRecord.signed_name || submittedRecord.signedName || formData.signedName || userInfo.name || '—';
  const signedDisplayDate = submittedRecord.signed_date || submittedRecord.signedDate || formData.signedDate || 'Recorded';
  const displayTshirtSize = submittedRecord.tshirt_size || submittedRecord.tshirtSize || formData.tshirtSize || '—';

  const hasSubmitted = Boolean(
    isSubmitted ||
    undertakingData?.submitted ||
    undertakingData?.signed_name ||
    undertakingData?.signedName ||
    undertakingData?.status === 'Submitted'
  );

  return (
    <div
      className="glass-card animate-fade-in"
      style={{
        maxWidth: '780px',
        margin: isMobile ? '0 auto 80px auto' : '0 auto',
        padding: isMobile ? '20px' : '36px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      {/* ── HEADER BRANDING ────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '28px', borderBottom: '2px solid #064e3b', paddingBottom: '20px' }}>
        <img
          src="/ri11.png"
          alt="Rural Immersion Logo"
          onError={(e) => { e.currentTarget.src = '/ri-logo.png'; }}
          style={{ height: '56px', objectFit: 'contain', marginBottom: '12px' }}
        />
        <h2 style={{ fontSize: isMobile ? '20px' : '23px', fontWeight: '800', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {role === 'faculty' ? 'Rural Immersion Faculty Undertaking' : 'Rural Immersion Student Undertaking'}
        </h2>
        <p style={{ fontSize: '13px', color: '#047857', margin: '6px 0 0 0', fontWeight: '600', letterSpacing: '0.3px' }}>
          MIT World Peace University • Rural Immersion Program (RUIP) Official Declaration &amp; Code of Conduct
        </p>
      </div>

      {hasSubmitted ? (
        /* ── SUBMITTED STATE (NO EDIT BUTTON) ────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', padding: isMobile ? '12px 0' : '20px', textAlign: 'center' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: '#ecfdf5',
            color: '#047857',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(4, 120, 87, 0.18)'
          }}>
            <CheckCircle size={38} color="#047857" />
          </div>

          <div>
            <h3 style={{ fontSize: '21px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
              Undertaking Submitted Successfully
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', maxWidth: '520px', margin: '0 auto', lineHeight: '1.6' }}>
              You have digitally signed and recorded this undertaking on the Rural Immersion system. A permanent official copy has been logged with the RI Administration.
            </p>
          </div>

          {/* Dotted summary card matching RI reference */}
          <div style={{
            width: '100%',
            background: '#f8fafc',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '12px',
            padding: isMobile ? '16px' : '24px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '16px',
            textAlign: 'left',
            marginTop: '8px',
            boxSizing: 'border-box'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Digital Signature</span>
              <p style={{ fontSize: '15px', fontWeight: '800', color: '#047857', margin: '4px 0 0 0', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                {signedDisplayName}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Program &amp; Role</span>
              <p style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                Rural Immersion • {role === 'faculty' ? 'Faculty Mentor' : 'Student Participant'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Department</span>
              <p style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                {userInfo.department || 'MIT-WPU Academic Unit'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Submission Date</span>
              <p style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                {signedDisplayDate}
              </p>
            </div>

            {role !== 'faculty' && (
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>T-Shirt Size</span>
                <p style={{ fontSize: '15px', fontWeight: '800', color: '#047857', margin: '4px 0 0 0' }}>
                  {displayTshirtSize}
                </p>
              </div>
            )}

            <div>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Verification Status</span>
              <p style={{ fontSize: '14px', fontWeight: '800', color: '#047857', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ShieldCheck size={16} /> Verified Record
              </p>
            </div>

            {userInfo.panel_name && (
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Assigned Panel</span>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '4px 0 0 0' }}>
                  {userInfo.panel_name}
                </p>
              </div>
            )}

            {userInfo.village_name && (
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>Assigned Village</span>
                <p style={{ fontSize: '14px', fontWeight: '700', color: '#047857', margin: '4px 0 0 0' }}>
                  {userInfo.village_name}
                </p>
              </div>
            )}
          </div>

          {/* Action Button: Print Receipt ONLY */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(4, 120, 87, 0.25)',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#065f46'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#047857'; }}
            >
              <Printer size={16} />
              Print Official Receipt
            </button>
          </div>
        </div>
      ) : (
        /* ── FORM STATE ───────────────────────────────────────────────────── */
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {formError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{formError}</span>
            </div>
          )}

          {/* Policy Box (Scrollable) */}
          <div style={{
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '16px 18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#334155',
            lineHeight: '1.65',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <p style={{ margin: 0, fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
              Rural Immersion Program (RUIP) • Faculty Code of Conduct &amp; Responsibilities
            </p>
            <p style={{ margin: 0 }}>
              As an appointed Faculty Mentor for the MIT-WPU Rural Immersion Program, I solemnly declare, undertake, and agree that:
            </p>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {role === 'faculty' ? (
                <>
                  <li><strong>Field Mentorship &amp; Supervision:</strong> I will accompany, supervise, and mentor my assigned panel students throughout the rural immersion journey, including village transit, base camp stays, and all field activities.</li>
                  <li><strong>4 Core Immersion Activities:</strong> I will guide and monitor all 4 mandatory activities: (1) School Activity, (2) Institutional Visit (GP, PHC, Anganwadi, Banks), (3) Family Socio-Economic Visits, and (4) Community Problem-Solving Projects / Shramdaan.</li>
                  <li><strong>Attendance &amp; Rubric Evaluation:</strong> I will accurately mark activity-wise attendance on the portal and evaluate student deliverables strictly adhering to the 100-mark official RUIP evaluation rubric.</li>
                  <li><strong>Village Decorum &amp; Community Relations:</strong> I will ensure dignified, culturally respectful interactions with Sarpanch, Gram Sevak, Gram Panchayat members, and rural residents.</li>
                  <li><strong>Student Safety &amp; Discipline:</strong> I will enforce zero-tolerance for indiscipline, unauthorized departures from allocated village boundaries, or safety protocol violations, immediately escalating any emergency or incident to the Nodal Officer and RI Administration.</li>
                </>
              ) : (
                <>
                  <li><strong>Active Field Participation:</strong> I will actively participate in all 4 mandatory rural immersion activities: School Activity, Institutional Visit, Family Visit, and Community Project under mentor supervision.</li>
                  <li><strong>Safety &amp; Village Decorum:</strong> I will strictly follow university safety guidelines, designated bus transit, curfew hours, and treat all village residents with dignity and cultural sensitivity.</li>
                  <li><strong>Deliverables &amp; Surveys:</strong> I will complete Form IV (Institutional Visits), Form V (Family Visit data), and problem identification deliverables with academic honesty.</li>
                  <li><strong>Institutional Discipline:</strong> I understand that any unauthorized movement outside assigned village areas or breach of discipline will invite severe institutional disciplinary action.</li>
                </>
              )}
            </ol>
          </div>

          {/* Consent Checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Card 1: Read/Understand Honor Code */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.honorCodeConsent}
                onChange={e => setFormData({ ...formData, honorCodeConsent: e.target.checked })}
                required
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                I confirm that I have read and fully understand the <strong>Rural Immersion Faculty Code of Conduct and Mentorship Responsibilities</strong>.
              </div>
            </div>

            {/* Card 2: Rules */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.rulesConsent}
                onChange={e => setFormData({ ...formData, rulesConsent: e.target.checked })}
                required
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                I agree to adhere to the 4-activity curriculum, attendance marking, student safety protocols, and official rubric evaluation guidelines.
              </div>
            </div>

            {/* Card 3: Photo / Video Consent */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.photoVideoConsent}
                onChange={e => setFormData({ ...formData, photoVideoConsent: e.target.checked })}
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                <strong>Photo / Video Consent:</strong> I consent to university documentation, photographs, and video recordings taken during the Rural Immersion Program for academic reports, institutional publications, and educational media.
              </div>
            </div>

            {/* Card 4: T-Shirt Consent (Students Only) */}
            {role !== 'faculty' && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={formData.tshirtConsent}
                  onChange={e => setFormData({ ...formData, tshirtConsent: e.target.checked })}
                  style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
                />
                <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                  <strong>T-Shirt Size Consent:</strong> I consent to provide my T-shirt size information for arranging official Rural Immersion apparel. I confirm that the selected size is correct and understand that changes may not be possible after final submission.
                </div>
              </div>
            )}

            {/* Card 5: Health Data Consent */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.dataConsent}
                onChange={e => setFormData({ ...formData, dataConsent: e.target.checked })}
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                <strong>Personal / Health Data Consent:</strong> I consent to the organisers collecting and processing my emergency contact/health data solely for program delivery, safety, compliance, academic and administrative purposes.
              </div>
            </div>

            {/* Card 6: Bag Check Consent */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.bagCheckConsent}
                onChange={e => setFormData({ ...formData, bagCheckConsent: e.target.checked })}
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                <strong>Bag Checking Consent:</strong> I consent to bag checks by authorised university staff members if required for safety, security, and rural campus policy reasons.
              </div>
            </div>

            {/* Card 7: Do's & Don'ts Consent */}
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={formData.dosDontsConsent}
                onChange={e => setFormData({ ...formData, dosDontsConsent: e.target.checked })}
                style={{ marginTop: '3px', transform: 'scale(1.15)', cursor: 'pointer', accentColor: '#047857' }}
              />
              <div style={{ fontSize: '13px', color: '#064e3b', lineHeight: '1.5' }}>
                <strong>Do&apos;s &amp; Don&apos;ts Consent:</strong> I confirm that I have read the official Do&apos;s &amp; Don&apos;ts of the Rural Immersion program and agree to abide by them throughout the duration of the program.
              </div>
            </div>
          </div>

          {/* T-Shirt Size Selection (Students Only) */}
          {role !== 'faculty' && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Select Official T-Shirt Size <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={formData.tshirtSize}
                onChange={e => setFormData({ ...formData, tshirtSize: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Select Size --</option>
                {[
                  { value: '36 - S', label: '36 - S' },
                  { value: '38 - M', label: '38 - M' },
                  { value: '40 - L', label: '40 - L' },
                  { value: '42 - XL', label: '42 - XL' },
                  { value: '44 - XXL', label: '44 - XXL' },
                  { value: '46 - XXXL', label: '46 - XXXL' }
                ].map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Digital Signature & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Full Name (Digital Signature) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Type your full legal name to sign..."
                value={formData.signedName}
                onChange={e => setFormData({ ...formData, signedName: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Date of Signature
              </label>
              <input
                type="text"
                value={formData.signedDate}
                readOnly
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  fontSize: '14px',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ paddingTop: '10px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px 24px',
                backgroundColor: isSubmitting ? '#94a3b8' : '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14.5px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 3px 10px rgba(4, 120, 87, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#065f46'; }}
              onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#047857'; }}
            >
              <ShieldCheck size={18} />
              <span>{isSubmitting ? 'Recording Digital Signature...' : 'Sign & Submit RI Undertaking'}</span>
            </button>
            <p style={{ textAlign: 'center', fontSize: '11.5px', color: '#64748b', margin: '8px 0 0 0' }}>
              By submitting, you affirm under honor code that the details provided are true and complete.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
