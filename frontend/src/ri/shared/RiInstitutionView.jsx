import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  FileText,
  ImagePlus
} from 'lucide-react';
import { INSTITUTION_FORM_SECTIONS } from './riInstitutionSchema';
import SecureImage from './SecureImage';
import { resolveCleanFileUrl, openSecureFile } from '../utils/secureFileHelpers';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

// Clean URL resolver without token parameter leakage
const resolveImageUrl = (url) => resolveCleanFileUrl(url);

export default function RiInstitutionView({ visits = [], status = 'Submitted' }) {
  if (!visits || visits.length === 0) {
    return (
      <div style={{
        padding: '36px 20px',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
        color: '#64748b'
      }}>
        <Building2 size={32} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
          No Institutional Visit Records Found
        </h4>
        <p style={{ margin: 0, fontSize: '12.5px' }}>
          This student has not yet drafted or submitted any institutional visit observations.
        </p>
      </div>
    );
  }

  // Extract form_sections from the first visit having observation_data or additional_details.form_sections
  let formSections = {};
  for (const v of visits) {
    if (v.observation_data && typeof v.observation_data === 'object' && Object.keys(v.observation_data).length > 0) {
      formSections = v.observation_data;
      break;
    }
    if (v.additional_details?.form_sections && typeof v.additional_details.form_sections === 'object' && Object.keys(v.additional_details.form_sections).length > 0) {
      formSections = v.additional_details.form_sections;
      break;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── TOP HEADER BAR ── */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ANNEX G-6 • FORM IV
            </span>
            <span style={{
              fontSize: '11.5px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: status === 'Submitted' || status === 'Reviewed' ? '#ecfdf5' : '#fffbeb',
              color: status === 'Submitted' || status === 'Reviewed' ? '#047857' : '#b45309',
              border: status === 'Submitted' || status === 'Reviewed' ? '1px solid #a7f3d0' : '1px solid #fde68a'
            }}>
              {status}
            </span>
          </div>
          <h3 style={{ margin: '4px 0 2px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
            Institutional Visit Observations Recording Form
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            {visits.length} {visits.length === 1 ? 'Institution' : 'Institutions'} recorded & complete 9-section village survey observations.
          </p>
        </div>
      </div>

      {/* ── PART 1: VISITED INSTITUTIONS CARDS ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} style={{ color: '#047857' }} />
            Institutions Visited ({visits.length} Recorded)
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Field observations recorded by the student for each visited rural institution.
          </div>
        </div>

        {visits.map((inst, idx) => (
          <div
            key={inst.id || idx}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '12px',
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: '10px'
            }}>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
                  Institution #{idx + 1} • {inst.institution_type || 'Village Institution'}
                </div>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  {inst.institution_name || 'Unnamed Institution'}
                </h4>
              </div>
              {inst.visit_date && (
                <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Calendar size={13} style={{ color: '#047857' }} />
                  {new Date(inst.visit_date).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Contact and Utilities Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              fontSize: '12.5px',
              marginBottom: '14px',
              backgroundColor: '#f8fafc',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>OFFICIAL MET</span>
                <strong style={{ color: '#0f172a' }}>{inst.official_contact_person || inst.officials_met || '—'}</strong>
                {inst.official_designation && <span style={{ color: '#64748b' }}> ({inst.official_designation})</span>}
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>BUILDING INFRASTRUCTURE</span>
                <strong style={{ color: '#0f172a' }}>{inst.infrastructure_condition || 'Good Condition'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px', fontWeight: '600' }}>BASIC UTILITIES AVAILABLE</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{ color: inst.electricity_available !== false ? '#059669' : '#dc2626', fontWeight: '600' }}>
                    Power {inst.electricity_available !== false ? '✓' : '✗'}
                  </span>
                  <span style={{ color: inst.drinking_water_available !== false ? '#059669' : '#dc2626', fontWeight: '600' }}>
                    Water {inst.drinking_water_available !== false ? '✓' : '✗'}
                  </span>
                  <span style={{ color: inst.toilet_available !== false ? '#059669' : '#dc2626', fontWeight: '600' }}>
                    Toilets {inst.toilet_available !== false ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Observations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div>
                <strong style={{ color: '#0f172a', fontSize: '12px' }}>Key Functions & Services Provided:</strong>
                <p style={{ margin: '3px 0 0 0', color: '#334155', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {inst.services_provided || inst.key_functions || 'None recorded'}
                </p>
              </div>
              <div>
                <strong style={{ color: '#047857', fontSize: '12px' }}>Key Field Observations:</strong>
                <p style={{ margin: '3px 0 0 0', color: '#1e293b', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  {inst.key_observations || inst.observations || 'None recorded'}
                </p>
              </div>
              <div>
                <strong style={{ color: '#dc2626', fontSize: '12px' }}>Identified Challenges / Service Gaps:</strong>
                <p style={{ margin: '3px 0 0 0', color: '#7f1d1d', backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  {inst.challenges_identified || inst.challenges_observed || 'None stated'}
                </p>
              </div>
              <div>
                <strong style={{ color: '#15803d', fontSize: '12px' }}>Student Recommendations:</strong>
                <p style={{ margin: '3px 0 0 0', color: '#14532d', backgroundColor: '#f0fdf4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac' }}>
                  {inst.recommendations || 'None stated'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── PART 2: FORM IV 9-SECTION SURVEY RESPONSES ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Official survey questions and responses from ANNEX G-6, FORM IV.
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
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
                  Section {sec.sr}
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {sec.title}
                </h4>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{sec.subtitle}</div>
                {sec.note && (
                  <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', fontStyle: 'italic' }}>
                    Note: {sec.note}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {sec.questions.map((q) => {
                  const val = secData[q.id];
                  const displayVal = val && typeof val === 'string' && val.trim().length > 0 ? val : '—';
                  return (
                    <div
                      key={q.id}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '10px 12px'
                      }}
                    >
                      <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                        {q.label}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', wordBreak: 'break-word', whiteSpace: q.type === 'textarea' ? 'pre-wrap' : 'normal' }}>
                        {displayVal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── ACTIVITY PHOTOS ── */}
      {(visits[0]?.activity_photo_1 || visits[0]?.activity_photo_2 || visits[0]?.additional_details?.activity_photo_1 || visits[0]?.additional_details?.activity_photo_2) && (
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
            <span>Activity Photos (Add 2 Photos)</span>
          </div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '16px' }}>
            Photographic evidence of fieldwork, school engagement, or community activities in the village.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {(visits[0]?.activity_photo_1 || visits[0]?.additional_details?.activity_photo_1) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Activity Photo 1</span>
                <SecureImage
                  src={visits[0]?.activity_photo_1 || visits[0]?.additional_details?.activity_photo_1}
                  alt="Activity Photo 1"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  onClick={() => openSecureFile(visits[0]?.activity_photo_1 || visits[0]?.additional_details?.activity_photo_1)}
                  title="Click to view full image in new tab"
                />
              </div>
            )}
            {(visits[0]?.activity_photo_2 || visits[0]?.additional_details?.activity_photo_2) && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Activity Photo 2</span>
                <SecureImage
                  src={visits[0]?.activity_photo_2 || visits[0]?.additional_details?.activity_photo_2}
                  alt="Activity Photo 2"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  onClick={() => openSecureFile(visits[0]?.activity_photo_2 || visits[0]?.additional_details?.activity_photo_2)}
                  title="Click to view full image in new tab"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
