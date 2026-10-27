import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  FileText,
  Award,
  Globe,
  Search,
  Layers,
  GraduationCap
} from 'lucide-react';

// ── SDG Color Palette & Meta (Official SDG Colors) ──────────────────────────
const SDG_COLORS = {
  1: { bg: '#e5243b', light: '#fde8ea', text: '#ffffff' },
  2: { bg: '#dda63a', light: '#fcf6e8', text: '#ffffff' },
  3: { bg: '#4c9f38', light: '#edf7eb', text: '#ffffff' },
  4: { bg: '#c5192d', light: '#fae8ea', text: '#ffffff' },
  5: { bg: '#ff3a21', light: '#ffebe8', text: '#ffffff' },
  6: { bg: '#26bde2', light: '#e9f8fc', text: '#ffffff' },
  7: { bg: '#fcc30b', light: '#fff9e6', text: '#000000' },
  8: { bg: '#a21942', light: '#f6e8ec', text: '#ffffff' },
  9: { bg: '#fd6925', light: '#ffefe9', text: '#ffffff' },
  10: { bg: '#dd1367', light: '#fce7f0', text: '#ffffff' },
  11: { bg: '#fd9d24', light: '#fff5e9', text: '#ffffff' },
  12: { bg: '#bf8b2e', light: '#f8f3ea', text: '#ffffff' },
  13: { bg: '#3f7e44', light: '#ecf2ed', text: '#ffffff' },
  14: { bg: '#0a97d9', light: '#e6f5fb', text: '#ffffff' },
  15: { bg: '#56c02b', light: '#eef9ea', text: '#ffffff' },
  16: { bg: '#00689d', light: '#e5f0f5', text: '#ffffff' },
  17: { bg: '#19486a', light: '#e8edf0', text: '#ffffff' }
};

// ── Master Data for Annexures ────────────────────────────────────────────────

export const ANNEXURE_I_CRITERIA = [
  {
    component: 'Attendance',
    subComponent: 'Attendance',
    marks: '20%'
  },
  {
    component: 'Involvement in activities',
    subComponent: 'Visit to institutions',
    marks: '10%'
  },
  {
    component: 'Involvement in activities',
    subComponent: 'Survey of 5 families',
    marks: '10%'
  },
  {
    component: 'Involvement in activities',
    subComponent: 'Community projects',
    marks: '10%'
  },
  {
    component: 'Identification of problem statement and solutions (Proportionate of marks given by expert committee for problem identification and solution )',
    subComponent: 'Identification of issue / problem',
    marks: '40%'
  },
  {
    component: 'Team Collaboration',
    subComponent: 'Team Collaboration',
    marks: '10%'
  }
];

export const ANNEXURE_K_SDGS = [
  {
    sr: 1,
    title: 'No Poverty',
    examples: [
      'Identifying causes of income disparity.',
      'Promoting livelihood opportunities like goat farming or fisheries.'
    ]
  },
  {
    sr: 2,
    title: 'Zero Hunger',
    examples: [
      'Addressing malnutrition in children through food security programs.',
      'Improving agricultural productivity.'
    ]
  },
  {
    sr: 3,
    title: 'Good Health and Well-being',
    examples: [
      'Lack of healthcare facilities or poor access to maternal care.',
      'Addressing prevalence of waterborne diseases.'
    ]
  },
  {
    sr: 4,
    title: 'Quality Education',
    examples: [
      'High dropout rates among girls due to inadequate facilities.',
      'Lack of access to digital education tools.'
    ]
  },
  {
    sr: 5,
    title: 'Gender Equality',
    examples: [
      'Issues of female participation in local governance.',
      'Addressing gender-based barriers in education or healthcare.'
    ]
  },
  {
    sr: 6,
    title: 'Clean Water and Sanitation',
    examples: [
      'Inconsistent or unsafe drinking water supply.',
      'Absence of proper waste management or drainage systems.'
    ]
  },
  {
    sr: 7,
    title: 'Affordable and Clean Energy',
    examples: [
      'Access to renewable energy solutions like solar lights.',
      'Dependence on firewood leading to deforestation.'
    ]
  },
  {
    sr: 8,
    title: 'Decent Work and Economic Growth',
    examples: [
      'Lack of access to credit for small businesses.',
      'Limited market linkages for agricultural products.'
    ]
  },
  {
    sr: 9,
    title: 'Industry, Innovation, and Infrastructure',
    examples: [
      'Poor road connectivity affecting market access.',
      'Promoting small-scale rural industries.'
    ]
  },
  {
    sr: 10,
    title: 'Reduced Inequalities',
    examples: [
      'Disparities in access to government welfare schemes.',
      'Inclusion of marginalized groups in village decision-making.'
    ]
  },
  {
    sr: 11,
    title: 'Sustainable Cities and Communities',
    examples: [
      'Developing eco-friendly village models.',
      'Promoting preservation of traditional architectural styles.'
    ]
  },
  {
    sr: 12,
    title: 'Responsible Consumption and Production',
    examples: [
      'Promoting organic farming techniques.',
      'Addressing food wastage during harvest and distribution.'
    ]
  },
  {
    sr: 13,
    title: 'Climate Action',
    examples: [
      'Impact of deforestation on rural livelihoods.',
      'Promoting sustainable agricultural practices.'
    ]
  },
  {
    sr: 14,
    title: 'Life Below Water',
    examples: [
      'Addressing pollution in local water bodies.',
      'Promoting sustainable fishing practices in villages near water resources.'
    ]
  },
  {
    sr: 15,
    title: 'Life on Land',
    examples: [
      'Preservation of biodiversity and local flora/fauna.',
      'Afforestation programs to combat soil erosion.'
    ]
  },
  {
    sr: 16,
    title: 'Peace, Justice, and Strong Institutions',
    examples: [
      'Strengthening local governance and dispute resolution mechanisms.',
      'Improving transparency in Panchayat operations.'
    ]
  },
  {
    sr: 17,
    title: 'Partnerships for the Goals',
    examples: [
      'Encouraging collaboration between NGOs, government bodies, and universities for sustainable rural development.'
    ]
  }
];

export const ANNEXURE_L_SCHOOL_STATEMENTS = [
  {
    school: 'School of Engineering and Technology',
    sdgFocus: 'SDG 7 (Affordable and Clean Energy)',
    problemStatement: 'Design a pedal-powered irrigation pump that reduces energy dependence and can be maintained by the local community.'
  },
  {
    school: 'School of Computer Science & Engineering',
    sdgFocus: 'SDG 10 (Reduced Inequalities)',
    problemStatement: 'Create a digital platform to map and share untapped skills in the village (e.g., artisans, weavers) for urban markets.'
  },
  {
    school: 'Ramcharan School of Leadership',
    sdgFocus: 'SDG 12 (Responsible Consumption and Production)',
    problemStatement: 'Build a community-owned organic fertilizer brand using biodegradable waste from the village.'
  },
  {
    school: 'School of Business',
    sdgFocus: 'SDG 12 (Responsible Consumption and Production)',
    problemStatement: 'Build a community-owned organic fertilizer brand using biodegradable waste from the village.'
  },
  {
    school: 'School of Economics & Commerce',
    sdgFocus: 'SDG 2 (Zero Hunger)',
    problemStatement: 'Conduct an economic viability study on vertical farming in small households to maximize food production.'
  },
  {
    school: 'School of Government',
    sdgFocus: 'SDG 17 (Partnerships for the Goals)',
    problemStatement: 'Develop a blueprint for how the village can partner with nearby urban areas for a “reverse supply chain” of organic goods.'
  },
  {
    school: 'School of Health Science & Technology',
    sdgFocus: 'SDG 3 (Good Health and Well-being)',
    problemStatement: 'Introduce a low-cost, AI-powered diagnostic tool for early detection of malnutrition in children under 5 years.'
  },
  {
    school: 'School of Science & Environmental Studies',
    sdgFocus: 'SDG 14 (Life Below Water)',
    problemStatement: 'Study the impact of fertilizers on nearby water bodies and create a low-tech solution to filter runoff before it enters rivers.'
  },
  {
    school: 'School of Design',
    sdgFocus: 'SDG 11 (Sustainable Cities and Communities)',
    problemStatement: 'Design public spaces in the village using reclaimed and recycled materials to promote community gatherings and festivals.'
  },
  {
    school: 'School of Liberal Arts',
    sdgFocus: 'SDG 5 (Gender Equality)',
    problemStatement: 'Develop creative storytelling workshops for village women to document their lives and challenges for local archives.'
  },
  {
    school: 'School of Law',
    sdgFocus: 'SDG 10 (Reduced Inequalities)',
    problemStatement: 'Create a simplified legal handbook for farmers on land rights and tenancy laws, using visuals and local dialects.'
  },
  {
    school: 'School of Consciousness',
    sdgFocus: 'SDG 15 (Life on Land)',
    problemStatement: 'Promote sustainable lifestyle practices by educating villagers on reducing waste and promoting organic farming.'
  }
];

export default function RiAnnexuresTab({ isMobile }) {
  const [activeSection, setActiveSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();

  // Filtered SDGs for Annexure K
  const filteredSdgs = useMemo(() => {
    if (!query) return ANNEXURE_K_SDGS;
    return ANNEXURE_K_SDGS.filter(item =>
      item.sr.toString().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      item.examples.some(ex => ex.toLowerCase().includes(query))
    );
  }, [query]);

  // Filtered Problem Statements for Annexure L
  const filteredSchoolStatements = useMemo(() => {
    if (!query) return ANNEXURE_L_SCHOOL_STATEMENTS;
    return ANNEXURE_L_SCHOOL_STATEMENTS.filter(item =>
      item.school.toLowerCase().includes(query) ||
      item.sdgFocus.toLowerCase().includes(query) ||
      item.problemStatement.toLowerCase().includes(query)
    );
  }, [query]);

  const matchesAnnexureH = useMemo(() => {
    if (!query) return true;
    const hText = `
      Pre-Immersion Preparation orientation workshop SDGs domain of work
      Rural Immersion specific problem statement actionable
      Post-Immersion 15 Days SMART solution government schemes
      Final Deliverables 1500-Word Joint Assignment 5-Slide Presentation 10 mins
      Guidelines for Problem Statement Identification Specificity Focus sanitation drainage
    `.toLowerCase();
    return hText.includes(query);
  }, [query]);

  const matchesAnnexureI = useMemo(() => {
    if (!query) return true;
    const iText = `
      award of credit point attendance 20% involvement in activities 
      visit to institutions 10% survey of 5 families 10% community projects 10%
      identification of problem statement and solutions 40% team collaboration 10%
    `.toLowerCase();
    return iText.includes(query);
  }, [query]);

  const tabs = [
    { id: 'all', label: 'All Annexures', icon: <Layers size={15} /> },
    { id: 'annexure_h', label: 'Annexure H', icon: <FileText size={15} /> },
    { id: 'annexure_i', label: 'Annexure I', icon: <Award size={15} /> },
    { id: 'annexure_k', label: 'Annexure K', icon: <Globe size={15} /> },
    { id: 'annexure_l', label: 'Annexure L', icon: <GraduationCap size={15} /> },
  ];

  return (
    <div className="ri-annexures-container" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Sub-Navigation Bar & Live Search ── */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '10px' : '12px',
        width: '100%'
      }}>
        {/* Annexure Pill Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '4px',
          gap: '4px',
          overflowX: 'auto',
          maxWidth: '100%',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box'
        }}>
          {tabs.map(tab => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '6px 12px' : '7px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: isMobile ? '12px' : '12.5px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#ffffff' : '#475569',
                  background: isActive ? '#047857' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Search Input */}
        <div style={{
          position: 'relative',
          width: isMobile ? '100%' : '270px',
          flexShrink: 0
        }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search keywords, SDGs, schools..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: '12.5px',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '11.5px',
                fontWeight: '600'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── ANNEXURE – H ────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'annexure_h') && matchesAnnexureH && (
        <div className="annexure-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '12px' : '14px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Card Header */}
          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '5px'
              }}>
                ANNEXURE – H
              </span>
            </div>
            <h3 style={{
              fontSize: isMobile ? '14.5px' : '16.5px',
              fontWeight: '800',
              color: '#0f172a',
              margin: '2px 0 0 0',
              lineHeight: 1.35
            }}>
              PROBLEM STATEMENT – SOLUTION DEVELOPMENT – IMPLEMENTATION PROCESS
            </h3>
          </div>

          {/* Text Content */}
          <div style={{ padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '14px', fontSize: isMobile ? '13px' : '13.5px', color: '#334155', lineHeight: '1.6' }}>

            {/* Step 1 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: isMobile ? '12px 14px' : '14px 18px'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }}>
                1. Pre-Immersion Preparation:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li>Students will form a group at the time of orientation workshop.</li>
                <li>Group will conduct preliminary research and review relevant SDGs to understand rural challenges and identify domain of work aligned to academic discipline.</li>
              </ul>
            </div>

            {/* Step 2 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: isMobile ? '12px 14px' : '14px 18px'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }}>
                2. Rural Immersion:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <li>Group must submit specific problem statement that is aligned to student’s course and specific village.</li>
                <li>Students should aim to generate actionable, specific problem statements rather than broad or vague issues.</li>
              </ul>
            </div>

            {/* Step 3 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: isMobile ? '12px 14px' : '14px 18px'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }}>
                3. Post-Immersion (15 Days):
              </h4>
              <p style={{ margin: 0 }}>
                At the end of 15 days, each group should be ready with a practical evidence-based SMART¹ solution for the identified problem. Solutions should be aligned to student’s course of study and incorporate ongoing government schemes or SDG-aligned initiatives for greater feasibility.
              </p>
            </div>

            {/* Step 4 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: isMobile ? '12px 14px' : '14px 18px'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }}>
                4. Final Deliverables:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <strong style={{ color: '#0f172a' }}>1500-Word Joint Assignment:</strong> Comprehensive report with problem identification, research findings along with citations, and solution proposal.
                </li>
                <li>
                  <strong style={{ color: '#0f172a' }}>5-Slide Presentation:</strong> Highlighting the problem, research insights, and proposed solution with a practical roadmap. Each group will get 10 mins to present.
                </li>
              </ul>
            </div>

            {/* Step 5 */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '9px',
              padding: isMobile ? '12px 14px' : '14px 18px'
            }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: '0 0 6px 0' }}>
                5. Guidelines for Problem Statement Identification:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>
                  <strong style={{ color: '#0f172a' }}>Specificity and Focus:</strong> Narrow down the problem to a unique, actionable issue relevant to the village and academic discipline of the students. Avoid broad terms like "sanitation issues" and instead focus on precise aspects, such as "absence of a regular garbage collection system leading to blocked drainage and mosquito breeding near the village school."
                </li>
                <li>
                  <strong style={{ color: '#0f172a' }}>SDG Alignment:</strong> Each team should link their problem to one or more SDGs and also try to link it to available government schemes (e.g., Clean Water and Sanitation, Affordable and Clean Energy). This connection will guide the research and solution planning process.
                </li>
              </ul>
            </div>

            {/* Footnote */}
            <div style={{
              fontSize: '11.5px',
              color: '#64748b',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: '8px',
              fontStyle: 'italic'
            }}>
              ¹ SMART goals stands for Specific, Measurable, Achievable, Relevant, and Time-Bound
            </div>

          </div>
        </div>
      )}

      {/* ── ANNEXURE – I ────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'annexure_i') && matchesAnnexureI && (
        <div className="annexure-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '12px' : '14px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Card Header */}
          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '5px'
              }}>
                ANNEXURE – I
              </span>
            </div>
            <h3 style={{
              fontSize: isMobile ? '14.5px' : '16.5px',
              fontWeight: '800',
              color: '#0f172a',
              margin: '2px 0 0 0',
              lineHeight: 1.35
            }}>
              AWARD OF CREDIT POINT
            </h3>
          </div>

          {/* Body Content */}
          <div style={{ padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: isMobile ? '13px' : '13.5px', color: '#334155', lineHeight: '1.6' }}>
            <p style={{ margin: 0 }}>
              One credit point is to be awarded to each student successfully completing the RI Program visit as per guidelines. Assessment criteria for award of credit point and detailed calculation of marks are mentioned:
            </p>

            {/* Assessment Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '13.5px', fontWeight: '750', color: '#0f172a', margin: 0 }}>
                Assessment Criteria
              </h4>

              <div style={{
                overflowX: 'auto',
                maxWidth: '100%',
                borderRadius: '9px',
                border: '1px solid #e2e8f0',
                WebkitOverflowScrolling: 'touch'
              }}>
                <table style={{
                  width: '100%',
                  minWidth: isMobile ? '520px' : 'auto',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  textAlign: 'left',
                  backgroundColor: '#ffffff'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '38%' }}>Component</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '37%' }}>Sub component</th>
                      <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '25%', textAlign: 'right' }}>Marks Distribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ANNEXURE_I_CRITERIA.map((row, idx) => (
                      <tr key={idx} style={{
                        borderBottom: idx === ANNEXURE_I_CRITERIA.length - 1 ? 'none' : '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}>
                        <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: '600', verticalAlign: 'top' }}>
                          {row.component}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#334155', verticalAlign: 'top' }}>
                          {row.subComponent}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#047857', fontWeight: '700', textAlign: 'right', verticalAlign: 'top' }}>
                          {row.marks}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#ecfdf5', borderTop: '2px solid #a7f3d0' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#065f46' }}>Total</td>
                      <td style={{ padding: '10px 14px' }}></td>
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#065f46', textAlign: 'right' }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ANNEXURE – K ────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'annexure_k') && (
        <div className="annexure-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '12px' : '14px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Card Header */}
          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '5px'
              }}>
                ANNEXURE – K
              </span>
            </div>
            <h3 style={{
              fontSize: isMobile ? '14.5px' : '16.5px',
              fontWeight: '800',
              color: '#0f172a',
              margin: '2px 0 0 0',
              lineHeight: 1.35
            }}>
              SUSTAINABLE DEVELOPMENT GOALS (SDGS)
            </h3>
          </div>

          {/* Table Container */}
          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            <div style={{
              overflowX: 'auto',
              maxWidth: '100%',
              borderRadius: '9px',
              border: '1px solid #e2e8f0',
              WebkitOverflowScrolling: 'touch'
            }}>
              <table style={{
                width: '100%',
                minWidth: isMobile ? '560px' : 'auto',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '64px', whiteSpace: 'nowrap' }}>Sr. No.</th>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '200px' }}>SDG</th>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Examples of Issues to Address in Rural Areas (Not an exhaustive list)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSdgs.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b', fontStyle: 'italic' }}>
                        No SDGs matched "{searchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredSdgs.map((sdg, idx) => {
                      const color = SDG_COLORS[sdg.sr] || { bg: '#047857', light: '#ecfdf5', text: '#ffffff' };
                      return (
                        <tr key={sdg.sr} style={{
                          borderBottom: idx === filteredSdgs.length - 1 ? 'none' : '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}>
                          {/* Number Badge */}
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '5px',
                              backgroundColor: color.bg,
                              color: color.text,
                              fontWeight: '800',
                              fontSize: '11.5px'
                            }}>
                              {sdg.sr}
                            </span>
                          </td>

                          {/* SDG Name */}
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>
                              {sdg.title}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                              SDG {sdg.sr}
                            </div>
                          </td>

                          {/* Issues List */}
                          <td style={{ padding: '10px 14px', verticalAlign: 'top' }}>
                            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px', color: '#334155', lineHeight: 1.45 }}>
                              {sdg.examples.map((ex, i) => (
                                <li key={i}>{ex}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── ANNEXURE – L ────────────────────────────────────────────────────────── */}
      {(activeSection === 'all' || activeSection === 'annexure_l') && (
        <div className="annexure-card" style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: isMobile ? '12px' : '14px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Card Header */}
          <div style={{
            padding: isMobile ? '14px 16px' : '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '3px 8px',
                borderRadius: '5px'
              }}>
                ANNEXURE – L
              </span>
            </div>
            <h3 style={{
              fontSize: isMobile ? '14.5px' : '16.5px',
              fontWeight: '800',
              color: '#0f172a',
              margin: '2px 0 0 0',
              lineHeight: 1.35
            }}>
              Examples of School/Course specific Problem Statements aligned with SDGs
            </h3>
          </div>

          {/* Table Container */}
          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            <div style={{
              overflowX: 'auto',
              maxWidth: '100%',
              borderRadius: '9px',
              border: '1px solid #e2e8f0',
              WebkitOverflowScrolling: 'touch'
            }}>
              <table style={{
                width: '100%',
                minWidth: isMobile ? '620px' : 'auto',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left',
                backgroundColor: '#ffffff'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '28%' }}>School/Course</th>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '26%' }}>SDG Focus (Example)</th>
                    <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', width: '46%' }}>Unique Problem Statement Specific to the Village</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchoolStatements.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b', fontStyle: 'italic' }}>
                        No school statements matched "{searchQuery}".
                      </td>
                    </tr>
                  ) : (
                    filteredSchoolStatements.map((item, idx) => (
                      <tr key={idx} style={{
                        borderBottom: idx === filteredSchoolStatements.length - 1 ? 'none' : '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}>
                        {/* School */}
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>
                            {item.school}
                          </div>
                        </td>

                        {/* SDG Focus (Clean solid typography, no glassmorphism) */}
                        <td style={{ padding: '11px 14px', verticalAlign: 'top' }}>
                          <div style={{
                            fontSize: '12.5px',
                            fontWeight: '700',
                            color: '#047857',
                            lineHeight: 1.35
                          }}>
                            {item.sdgFocus}
                          </div>
                        </td>

                        {/* Problem Statement */}
                        <td style={{ padding: '11px 14px', color: '#334155', verticalAlign: 'top', lineHeight: 1.5 }}>
                          {item.problemStatement}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
