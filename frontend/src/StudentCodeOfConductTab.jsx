import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Clock, 
  Heart, 
  Smartphone, 
  AlertTriangle, 
  Sparkles, 
  Building2, 
  Compass, 
  Phone, 
  CheckCircle2, 
  FileCheck, 
  Home, 
  AlertCircle, 
  Search, 
  X, 
  Stethoscope,
  Bus,
  Lock,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

const CONDUCT_RULES = [
  {
    num: 1,
    title: 'Respect Others',
    points: [
      'Treat fellow students, instructors, coordinators, and support staff with courtesy and respect.',
      'Use appropriate, respectful language and maintain courteous behavior at all times.'
    ]
  },
  {
    num: 2,
    title: 'Follow Instructions',
    points: [
      'Listen carefully and comply with directions given by instructors and coordinators during activities, travel, and accommodation.',
      'Respect group coordinators and adhere strictly to session guidelines.'
    ]
  },
  {
    num: 3,
    title: 'Punctuality',
    points: [
      'Attend all sessions, activities, workshops, and meals strictly on time.',
      'Follow the daily schedule diligently and assemble at designated locations as instructed.'
    ]
  },
  {
    num: 4,
    title: 'Safety First',
    points: [
      'Participate only in authorized program activities under supervision.',
      'Follow all safety instructions and handle all campus/pillar equipment responsibly.',
      'Immediately report any injury, illness, or unsafe condition to the coordinators or medical team.'
    ]
  },
  {
    num: 5,
    title: 'Care for Facilities and Environment',
    points: [
      'Maintain utmost cleanliness and hygiene in residential rooms, dining halls, and activity spaces.',
      'Respect campus property, greenery, agriculture patches, and natural surroundings.',
      'Avoid damaging, defacing, or misusing any equipment, furniture, or infrastructure.'
    ]
  },
  {
    num: 6,
    title: 'Personal Responsibility',
    points: [
      'Take personal responsibility for personal belongings. LTC will not be responsible for loss of cash or valuables.',
      'Maintain personal hygiene and wear appropriate, modest program attire suitable for activities.'
    ]
  },
  {
    num: 7,
    title: 'Digital Discipline',
    points: [
      'Mobile phones or other electronic devices are strictly not allowed and must be submitted to coordinators at the start of the program.',
      'Instructor/faculty mobile phones, if permitted during emergencies, shall be used only during designated hours.'
    ]
  },
  {
    num: 8,
    title: 'Prohibited Activities',
    isWarning: true,
    points: [
      'Bullying, harassment, ragging, fighting, verbal abuse, or any form of discrimination is strictly prohibited.',
      'Possession or consumption of tobacco, alcohol, drugs, narcotics, vaping products, sharp objects, knives, fireworks, or hazardous material is strictly banned.',
      'Leaving the campus or assigned activity area without explicit authorization from coordinators.',
      'Any behavior that endangers the physical safety, mental well-being, or emotional comfort of others.',
      'Mobile phones, gaming consoles, smartwatches, or entertainment gadgets must be deposited upon arrival.'
    ]
  },
  {
    num: 9,
    title: 'Team Spirit and Participation',
    points: [
      'Actively participate in all learning sessions, physical workouts, yoga, reflection, and group exercises.',
      'Demonstrate mutual cooperation, empathy, proactive listening, and a positive mindset toward peers.'
    ]
  },
  {
    num: 10,
    title: 'Compliance & Values',
    points: [
      'Students are expected to uphold the core values of Integrity, Respect, Responsibility, and Compassion.',
      'Repeated violations may result in disciplinary action, parent notification, cancellation of certificate, and withdrawal from the program with return travel arranged at parent expense.'
    ]
  }
];

const SAFETY_PROTOCOLS = [
  {
    num: 1,
    title: 'Travel Safety',
    summary: 'Insured transport, verified headcounts, and designated faculty escorts.',
    details: [
      'Students shall travel to and from LTC only through authorized transportation arrangements with insured vehicles approved by LTC.',
      'Comprehensive insurance coverage shall be arranged for all registered participants, covering travel and program-related contingencies as applicable under policy terms.',
      'School faculty members and designated coordinators shall accompany students during transit and remain responsible for discipline, attendance, and welfare throughout the journey.',
      'Student attendance shall be verified and logged at departure, campus arrival, and return points.'
    ]
  },
  {
    num: 2,
    title: 'Medical Support & Emergency Response',
    summary: 'On-campus first-aid, on-call doctor & sister clinic, and hospital liaison.',
    details: [
      'LTC maintains access to well-equipped first-aid facilities and trained emergency responders on campus.',
      'A medical clinic facility with doctors and nursing support available on call remains accessible throughout the program duration.',
      'In the event of illness, injury, or medical emergency, LTC provides immediate first aid and appropriate medical assistance.',
      'Where necessary, students may be transported to the nearest suitable hospital, including Vishwaraj Hospital or other tertiary care centers based on medical severity.',
      'Parents/guardians must provide relevant medical history, allergies, regular prescriptions, or health conditions in advance.'
    ],
    contacts: [
      { role: 'Campus Doctor', name: 'Dr. Anwar Shaikh Sir', phone: '9823443537', tel: '+919823443537' },
      { role: 'Campus Medical Staff', name: 'Nirmala Bhalekar (Sister)', phone: '8208938209', tel: '+918208938209' }
    ]
  },
  {
    num: 3,
    title: 'Campus Safety & Security',
    summary: 'Gated access, CCTV monitoring, and dedicated campus security managers.',
    details: [
      'LTC is a secured, perimeter-monitored campus with controlled, guarded entry and exit points.',
      'CCTV surveillance systems are installed and active at multiple strategic locations across the campus 24/7.',
      'Students remain under the continuous supervision of designated faculty, pillar instructors, activity coordinators, and residential wardens.',
      'Restricted or designated campus zones may only be accessed under authorized supervision.'
    ],
    contacts: [
      { role: 'Campus Security & Admin', name: 'Mr. Harshavardhan Patil', phone: '77220 17372', tel: '+917722017372' },
      { role: 'Associate Director / Lead', name: 'Mr. Shardool Shirolkar', phone: '9879616220', tel: '+919879616220' }
    ]
  },
  {
    num: 4,
    title: 'Activity Safety & Pillar Briefings',
    summary: 'Qualified instructors, safety briefings, and physical readiness checks.',
    details: [
      'The Life Awakening Program includes physical, adventure, agricultural, and experiential learning activities.',
      'Qualified instructors and designated pillar heads conduct, demonstrate, and supervise all participant exercises.',
      'Mandatory safety briefings and instructional demos are conducted before the commencement of every activity.',
      'Participation in specific activities may be restricted where instructors determine that a student’s physical fitness, gear, or health condition compromises safety.'
    ]
  },
  {
    num: 5,
    title: 'Residential Supervision & Wardens',
    summary: 'Joint LTC warden & faculty supervision with an approximate 1:15 ratio.',
    details: [
      'Student accommodation is supervised jointly by LTC Residential Coordinators and accompanying school faculty members.',
      'As far as practicable, one designated school faculty member is assigned for approximately every fifteen students (1:15 ratio).',
      'Students must follow residential rules relating to curfews, attendance roll-calls, hygiene, safety, and mutual respect.',
      'Regular attendance checks, evening roll-calls, and room inspections are conducted daily.'
    ]
  },
  {
    num: 6,
    title: 'Code of Conduct Compliance & Prohibitions',
    summary: 'Zero tolerance for hazardous substances, violence, or unauthorized departure.',
    details: [
      'Students must respect peers, faculty members, instructors, and campus operational staff at all times.',
      'Follow all directives issued by LTC leadership and school authorities without exception.',
      'Strictly prohibited: alcohol, tobacco, vaping devices, narcotics, drugs, knives, weapons, or fireworks.',
      'Strictly prohibited: any activity that compromises safety, ragging, bullying, violence, vandalism, or intentional property destruction.'
    ]
  },
  {
    num: 7,
    title: 'Disciplinary Protocol & Safe Transfer',
    summary: 'Progressive warning protocol and parent coordination for safe transfer.',
    details: [
      'Minor misconduct: Students receive counseling and a formal warning; participation privileges in select activities may be temporarily restricted.',
      'Serious or repeated misconduct, possession of prohibited items, or threats to safety: LTC reserves the right to withdraw the student immediately.',
      'Parents/guardians and school authorities will be informed immediately upon any serious breach.',
      'Arrangements will be made for the student’s return home; any associated travel expenses will be borne by the parent/guardian.',
      'LTC takes all reasonable measures to ensure the student’s safe transfer to the designated parent, guardian, or authorized school representative.'
    ]
  }
];

const EMERGENCY_DIRECTORY = [
  {
    category: 'Medical Clinic & First Aid',
    contacts: [
      { role: 'Campus Doctor', name: 'Dr. Anwar Shaikh Sir', phone: '9823443537', tel: '+919823443537', note: 'On-call medical consultations & clinical triage' },
      { role: 'Campus Medical Staff', name: 'Nirmala Bhalekar (Sister)', phone: '8208938209', tel: '+918208938209', note: '24/7 First-aid clinic, medication & emergency support' },
      { role: 'Referral Tertiary Hospital', name: 'Vishwaraj Hospital, Loni Kalbhor', phone: '020-67521000', tel: '+912067521000', note: 'Designated hospital facility for emergencies' }
    ]
  },
  {
    category: 'Campus Administration & Safety',
    contacts: [
      { role: 'Campus Security & Admin', name: 'Mr. Harshavardhan Patil', phone: '77220 17372', tel: '+917722017372', note: 'Perimeter security, gates, and campus operations' },
      { role: 'Associate Director / Lead', name: 'Mr. Shardool Shirolkar', phone: '9879616220', tel: '+919879616220', note: 'Overall program lead & escalations' }
    ]
  }
];

export default function StudentCodeOfConductTab({ myData = {} }) {
  const [activeSection, setActiveSection] = useState('all'); // 'all', 'conduct', 'safety', 'contacts'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConduct = useMemo(() => {
    if (!searchQuery.trim()) return CONDUCT_RULES;
    const q = searchQuery.toLowerCase();
    return CONDUCT_RULES.filter(r => 
      r.title.toLowerCase().includes(q) ||
      r.points.some(p => p.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const filteredSafety = useMemo(() => {
    if (!searchQuery.trim()) return SAFETY_PROTOCOLS;
    const q = searchQuery.toLowerCase();
    return SAFETY_PROTOCOLS.filter(s => 
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.details.some(d => d.toLowerCase().includes(q)) ||
      (s.contacts && s.contacts.some(c => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

  const filteredDirectory = useMemo(() => {
    if (!searchQuery.trim()) return EMERGENCY_DIRECTORY;
    const q = searchQuery.toLowerCase();
    return EMERGENCY_DIRECTORY.map(group => ({
      ...group,
      contacts: group.contacts.filter(c => 
        c.role.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.note && c.note.toLowerCase().includes(q))
      )
    })).filter(group => group.contacts.length > 0);
  }, [searchQuery]);

  const showConduct = activeSection === 'all' || activeSection === 'conduct';
  const showSafety = activeSection === 'all' || activeSection === 'safety';
  const showContacts = activeSection === 'all' || activeSection === 'contacts';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1120px', margin: '0 auto', width: '100%', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.4px' }}>
          Student Code of Conduct &amp; Safety Protocols
        </h1>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
          Official code of conduct, residential accommodations, and safety guidelines for the Life Awakening Program.
        </p>
      </div>

      {/* ── Accommodation Cards (Sinhagad = Boys, Pratapgad = Girls) ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'none'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a', letterSpacing: '-0.2px' }}>
            Residential Accommodation Blocks
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Strictly segregated residential buildings dedicated separately for boys and girls with 24/7 supervision.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {/* Sinhagad Block: Boys' Accommodation */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a' }}>
                Sinhagad Block
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                background: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #ffedd5',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                Boys’ Accommodation
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
              Dedicated residential block strictly for male students. Under 24/7 supervision of male residential coordinators and accompanying male school faculty.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                Separate Entry
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                Male Wardens
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                1:15 Faculty Ratio
              </span>
            </div>
          </div>

          {/* Pratapgad Block: Girls' Accommodation */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '750', color: '#0f172a' }}>
                Pratapgad Block
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                background: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #ffedd5',
                padding: '3px 8px',
                borderRadius: '6px'
              }}>
                Girls’ Accommodation
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
              Secure residential block strictly reserved for female students. Supervised exclusively by female residential coordinators and accompanying lady school faculty.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                Controlled Access
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                Lady Wardens &amp; Sisters
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                Strict Curfew
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar & Search Bar ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Simple Tab Bar with subtle orange active indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Guidelines' },
            { id: 'conduct', label: '10 Code Rules' },
            { id: 'safety', label: 'Safety & Welfare Protocols' },
            { id: 'contacts', label: 'Emergency Contacts' }
          ].map(tab => {
            const isSel = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                style={{
                  background: isSel ? '#fff7ed' : '#ffffff',
                  color: isSel ? '#ea580c' : '#475569',
                  border: isSel ? '1px solid #ffedd5' : '1px solid transparent',
                  borderBottom: isSel ? '2px solid #ea580c' : '2px solid transparent',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isSel ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live Search */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1', maxWidth: '300px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search rules, protocols, contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 28px 7px 32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: '#94a3b8'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Section 1: 10 Code Rules ── */}
      {showConduct && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              10 Cardinal Rules of Conduct
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {filteredConduct.length} of {CONDUCT_RULES.length} rules
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px'
          }}>
            {filteredConduct.map(rule => {
              const numStr = String(rule.num).padStart(2, '0');
              return (
                <div
                  key={rule.num}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      fontFamily: 'monospace',
                      color: '#ea580c',
                      background: '#fff7ed',
                      padding: '2px 7px',
                      borderRadius: '4px'
                    }}>
                      {numStr}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '750', color: '#0f172a' }}>
                      {rule.title}
                    </h3>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rule.points.map((p, idx) => (
                      <li key={idx} style={{ fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 2: Safety & Welfare Protocols ── */}
      {showSafety && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: showConduct ? '12px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Safety &amp; Welfare Protocols
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {filteredSafety.length} of {SAFETY_PROTOCOLS.length} protocols
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSafety.map(protocol => {
              const numStr = String(protocol.num).padStart(2, '0');
              return (
                <div
                  key={protocol.num}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      fontFamily: 'monospace',
                      color: '#ea580c',
                      background: '#fff7ed',
                      padding: '2px 7px',
                      borderRadius: '4px'
                    }}>
                      {numStr}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '750', color: '#0f172a' }}>
                      {protocol.title}
                    </h3>
                  </div>

                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                    {protocol.summary}
                  </p>

                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {protocol.details.map((d, idx) => (
                      <li key={idx} style={{ fontSize: '13px', color: '#475569', lineHeight: 1.55 }}>
                        {d}
                      </li>
                    ))}
                  </ul>

                  {/* Associated Contacts */}
                  {protocol.contacts && protocol.contacts.length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      {protocol.contacts.map((c, cIdx) => (
                        <div key={cIdx} style={{ fontSize: '12.5px', color: '#334155' }}>
                          <span style={{ fontWeight: '600' }}>{c.role}: </span>
                          <span>{c.name} </span>
                          <a
                            href={`tel:${c.tel || c.phone.replace(/\s+/g, '')}`}
                            style={{ color: '#ea580c', fontWeight: '700', textDecoration: 'none', marginLeft: '4px' }}
                          >
                            ({c.phone})
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 3: Emergency Contacts Directory ── */}
      {showContacts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: (showConduct || showSafety) ? '12px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Emergency Contacts Directory
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Click phone numbers to dial directly
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px'
          }}>
            {filteredDirectory.map((group, gIdx) => (
              <div
                key={gIdx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ fontSize: '14.5px', fontWeight: '750', color: '#0f172a', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
                  {group.category}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {group.contacts.map((c, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{c.name}</span>
                        <a
                          href={`tel:${c.tel || c.phone.replace(/\s+/g, '')}`}
                          style={{
                            fontSize: '12.5px',
                            fontWeight: '700',
                            color: '#ea580c',
                            textDecoration: 'none',
                            fontFamily: 'monospace'
                          }}
                        >
                          {c.phone}
                        </a>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{c.role}</div>
                      {c.note && (
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{c.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
