import React, { useState } from 'react';
import { Home, ChevronDown, ChevronUp, AlertCircle, FileText, CheckCircle2, User, Phone, Users } from 'lucide-react';
import {
  FAMILY_SURVEY_SECTIONS,
  getFamilyFieldValue
} from './riFamilySurveySchema';

export default function RiFamilySurveyView({ families = [], status = 'Submitted' }) {
  const [selectedFamilyIdx, setSelectedFamilyIdx] = useState(0);
  const [collapsedSections, setCollapsedSections] = useState({});

  if (!families || families.length === 0) {
    return (
      <div style={{
        padding: '36px 20px',
        textAlign: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px dashed #cbd5e1',
        color: '#64748b'
      }}>
        <Home size={32} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
        <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
          No Family Visit Records Found
        </h4>
        <p style={{ margin: 0, fontSize: '12.5px' }}>
          This student has not yet drafted or submitted any household surveys.
        </p>
      </div>
    );
  }

  const activeFamily = families[selectedFamilyIdx] || families[0];

  const toggleSection = (secKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [secKey]: !prev[secKey]
    }));
  };

  const expandAll = () => setCollapsedSections({});
  const collapseAll = () => {
    const all = {};
    FAMILY_SURVEY_SECTIONS.forEach(s => { all[s.key] = true; });
    setCollapsedSections(all);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Summary Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
            Family Visits Survey ({families.length} {families.length === 1 ? 'Family' : 'Families'} Recorded)
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Observations recorded by student for Sections A–M.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: '12px',
            backgroundColor: status === 'Submitted' || status === 'Reviewed' ? '#ecfdf5' : '#fffbeb',
            color: status === 'Submitted' || status === 'Reviewed' ? '#047857' : '#b45309',
            border: status === 'Submitted' || status === 'Reviewed' ? '1px solid #a7f3d0' : '1px solid #fde68a'
          }}>
            Status: {status}
          </span>
          <button
            type="button"
            onClick={expandAll}
            style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Family Switcher Tabs / Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {families.map((fam, idx) => {
          const isSelected = idx === selectedFamilyIdx;
          const rawHead = (fam.head_of_family_name || '').trim();
          const isEmail = rawHead.includes('@') || /^[^\s@]+@[^\s@]+\.[^\s@]+/.test(rawHead);
          const isDraft = !rawHead || rawHead.toLowerCase().startsWith('draft') || rawHead.startsWith('Family #');
          const headName = (!isEmail && !isDraft) ? rawHead.split(' ')[0] : '';
          return (
            <button
              key={fam.id || fam.family_serial_number || idx}
              type="button"
              onClick={() => setSelectedFamilyIdx(idx)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: isSelected ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                color: isSelected ? '#047857' : '#334155',
                fontWeight: isSelected ? '800' : '600',
                fontSize: '12.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Home size={14} style={{ color: isSelected ? '#047857' : '#64748b' }} />
              Family #{fam.family_serial_number || idx + 1}{headName ? `: ${headName}` : ''}
            </button>
          );
        })}
      </div>

      {/* Active Family Full Record Container */}
      {activeFamily && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px'
        }}>
          {/* Family Heading */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            borderBottom: '1.5px solid #f1f5f9',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#047857', textTransform: 'uppercase' }}>
                Family #{activeFamily.family_serial_number || selectedFamilyIdx + 1} Responses
              </span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                {activeFamily.head_of_family_name || 'Head of Family'}
              </h3>
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Total Members: <strong style={{ color: '#0f172a' }}>{activeFamily.total_family_members || '—'}</strong>
              {activeFamily.male_members !== undefined && (
                <span> ({activeFamily.male_members || 0} Male / {activeFamily.female_members || 0} Female)</span>
              )}
            </div>
          </div>

          {/* Section by Section Full Questions & Answers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FAMILY_SURVEY_SECTIONS.map((sec) => {
              const isCollapsed = Boolean(collapsedSections[sec.key]);

              return (
                <div
                  key={sec.key}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {/* Section Title Bar */}
                  <div
                    onClick={() => toggleSection(sec.key)}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      userSelect: 'none',
                      borderBottom: isCollapsed ? 'none' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: '#047857',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {sec.code}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {sec.title}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isCollapsed ? <ChevronDown size={15} color="#64748b" /> : <ChevronUp size={15} color="#64748b" />}
                    </div>
                  </div>

                  {/* Section Questions */}
                  {!isCollapsed && (
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sec.schemeNote && (
                        <div style={{
                          fontSize: '11.5px',
                          color: '#166534',
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          lineHeight: 1.4
                        }}>
                          <strong>Scheme Summary:</strong> {sec.schemeNote}
                        </div>
                      )}

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '12px'
                      }}>
                        {sec.questions.map((q) => {
                          const answer = getFamilyFieldValue(activeFamily, q.id);
                          const hasAnswer = answer !== '' && answer !== null && answer !== undefined;

                          return (
                            <div
                              key={q.id}
                              style={{
                                backgroundColor: '#fcfcfd',
                                border: '1px solid #f1f5f9',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: '6px'
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '750', color: '#334155' }}>
                                  {q.label}
                                </div>
                                {q.instruction && (
                                  <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic', marginTop: '1px' }}>
                                    {q.instruction}
                                  </div>
                                )}
                              </div>

                              <div style={{ marginTop: '4px' }}>
                                {hasAnswer ? (
                                  <div style={{
                                    fontSize: '12.5px',
                                    fontWeight: '700',
                                    color: '#064e3b',
                                    backgroundColor: '#ecfdf5',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    border: '1px solid #a7f3d0',
                                    display: 'inline-block',
                                    maxWidth: '100%',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.35
                                  }}>
                                    {String(answer)}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    Not specified / Not applicable
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
