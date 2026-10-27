import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
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
  ChevronRight,
  Flame,
  Stethoscope,
  Bus,
  Eye,
  Lock,
  Printer
} from 'lucide-react';

const CONDUCT_RULES = [
  {
    num: 1,
    title: 'Respect Others',
    icon: Users,
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    badge: 'Core Value',
    points: [
      'Treat fellow students, instructors, coordinators, and support staff with courtesy and respect.',
      'Use appropriate, respectful language and maintain courteous behavior at all times.'
    ]
  },
  {
    num: 2,
    title: 'Follow Instructions',
    icon: FileCheck,
    color: '#0891b2',
    bg: '#ecfeff',
    border: '#a5f3fc',
    badge: 'Discipline',
    points: [
      'Listen carefully and comply with directions given by instructors and coordinators during activities, travel, and accommodation.',
      'Respect group coordinators and adhere strictly to session guidelines.'
    ]
  },
  {
    num: 3,
    title: 'Punctuality',
    icon: Clock,
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    badge: 'Time Management',
    points: [
      'Attend all sessions, activities, workshops, and meals strictly on time.',
      'Follow the daily schedule diligently and assemble at designated locations as instructed.'
    ]
  },
  {
    num: 4,
    title: 'Safety First',
    icon: ShieldAlert,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    badge: 'Critical Priority',
    points: [
      'Participate only in authorized program activities under supervision.',
      'Follow all safety instructions and handle all campus/pillar equipment responsibly.',
      'Immediately report any injury, illness, or unsafe condition to the coordinators or medical team.'
    ]
  },
  {
    num: 5,
    title: 'Care for Facilities and Environment',
    icon: Building2,
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    badge: 'Campus Care',
    points: [
      'Maintain utmost cleanliness and hygiene in residential rooms, dining halls, and activity spaces.',
      'Respect campus property, greenery, agriculture patches, and natural surroundings.',
      'Avoid damaging, defacing, or misusing any equipment, furniture, or infrastructure.'
    ]
  },
  {
    num: 6,
    title: 'Personal Responsibility',
    icon: Heart,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    badge: 'Self Reliance',
    points: [
      'Take personal responsibility for personal belongings. LTC will not be responsible for loss of cash or valuables.',
      'Maintain personal hygiene and wear appropriate, modest program attire suitable for activities.'
    ]
  },
  {
    num: 7,
    title: 'Digital Discipline',
    icon: Smartphone,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    badge: 'Mindful Presence',
    points: [
      'Mobile phones or other electronic devices are strictly not allowed and must be submitted to coordinators at the start of the program.',
      'Instructor/faculty mobile phones, if permitted during emergencies, shall be used only during designated hours.'
    ]
  },
  {
    num: 8,
    title: 'Prohibited Activities',
    icon: AlertTriangle,
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fca5a5',
    badge: 'Strict Zero-Tolerance',
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
    icon: Sparkles,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    badge: 'Transformation',
    points: [
      'Actively participate in all learning sessions, physical workouts, yoga, reflection, and group exercises.',
      'Demonstrate mutual cooperation, empathy, proactive listening, and a positive mindset toward peers.'
    ]
  },
  {
    num: 10,
    title: 'Compliance & Values',
    icon: ShieldCheck,
    color: '#4338ca',
    bg: '#eef2ff',
    border: '#c7d2fe',
    badge: 'Integrity',
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
    icon: Bus,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
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
    icon: Stethoscope,
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
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
    icon: Lock,
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
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
    icon: Compass,
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    summary: 'Expert pillar heads, safety briefings, and physical readiness checks.',
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
    icon: Home,
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
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
    icon: ShieldAlert,
    color: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
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
    icon: AlertCircle,
    color: '#b91c1c',
    bg: '#fef2f2',
    border: '#fca5a5',
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

export default function StudentCodeOfConductTab({ myData = {} }) {
  const [activeSection, setActiveSection] = useState('all'); // 'all', 'conduct', 'safety', 'accommodation', 'contacts'
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered lists based on search
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
      s.details.some(d => d.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Page Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: '20px',
        padding: '28px 24px',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* Subtle orange accent gradient bar at top */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                background: 'rgba(234, 88, 12, 0.2)',
                color: '#fb923c',
                padding: '3px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(234, 88, 12, 0.4)'
              }}>
                LIFE AWAKENING PROGRAM • SCHOOL EDUCATION
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#94a3b8'
              }}>
                MIT World Peace University
              </span>
            </div>

            <h1 style={{
              margin: '0 0 10px 0',
              fontSize: '24px',
              fontWeight: '850',
              color: '#ffffff',
              letterSpacing: '-0.4px',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              Student Code of Conduct &amp; Safety Protocols
            </h1>

            <p style={{
              margin: 0,
              fontSize: '13.5px',
              color: '#cbd5e1',
              lineHeight: 1.6,
              maxWidth: '680px'
            }}>
              To ensure a safe, disciplined, and transformative residential experience for all school participants, 
              every student is expected to uphold these cardinal standards and safety regulations throughout their journey at LTC.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              className="hover:bg-white/20 active:scale-95"
              title="Print Code of Conduct Document"
            >
              <Printer size={15} />
              Print Guidelines
            </button>
          </div>
        </div>
      </div>

      {/* Boys and Girls Accommodation Highlight Banner (Pratapgad & Sinhagad) */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #fed7aa',
        borderRadius: '18px',
        padding: '22px 24px',
        boxShadow: '0 4px 14px rgba(234, 88, 12, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#fff7ed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ea580c',
            border: '1px solid #ffedd5'
          }}>
            <Building2 size={18} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '850', color: '#0f172a' }}>
              Segregated Accommodation Arrangements: Pratapgad &amp; Sinhagad
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Strictly segregated, secure residential buildings dedicated separately for boys and girls.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px'
        }}>
          {/* Pratapgad (Boys) */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderLeft: '4px solid #2563eb',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14.5px', fontWeight: '850', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Home size={16} color="#2563eb" />
                Pratapgad Residency
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: '800', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px' }}>
                Boys Accommodation
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              Dedicated residential block strictly for male students. Under 24/7 supervision of male residential coordinators and accompanying male school faculty.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', background: '#eff6ff', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ Separate Entry
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', background: '#eff6ff', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ Male Wardens
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#1e40af', background: '#eff6ff', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ 1:15 Faculty Ratio
              </span>
            </div>
          </div>

          {/* Sinhagad (Girls) */}
          <div style={{
            background: '#fffafb',
            border: '1px solid #fbcfe8',
            borderLeft: '4px solid #db2777',
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14.5px', fontWeight: '850', color: '#831843', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Home size={16} color="#db2777" />
                Sinhagad Residency
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: '800', background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: '12px' }}>
                Girls Accommodation
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              Secure residential block strictly reserved for female students. Supervised exclusively by female residential coordinators and accompanying lady school faculty.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#9d174d', background: '#fdf2f8', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ Controlled Access
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#9d174d', background: '#fdf2f8', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ Lady Wardens &amp; Sisters
              </span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#9d174d', background: '#fdf2f8', padding: '2px 7px', borderRadius: '4px' }}>
                ✓ Strict Curfew
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Navigation & Quick Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: '#ffffff',
        padding: '14px 18px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12.5px',
                  fontWeight: isSel ? '750' : '600',
                  background: isSel ? '#ea580c' : '#f8fafc',
                  color: isSel ? '#ffffff' : '#475569',
                  border: isSel ? '1px solid #ea580c' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSel ? '0 2px 6px rgba(234, 88, 12, 0.2)' : 'none'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: '1', maxWidth: '340px' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search rules, medical, safety..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '10px',
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
                color: '#94a3b8',
                padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: STUDENT CODE OF CONDUCT (10 GUIDELINES) */}
      {(activeSection === 'all' || activeSection === 'conduct') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #f1f5f9',
            paddingBottom: '10px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck color="#ea580c" size={20} />
                Student Code of Conduct
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                10 Core behavioral expectations during sessions, travel, activities, and dining.
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', padding: '3px 10px', borderRadius: '12px' }}>
              {filteredConduct.length} Guidelines
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px'
          }}>
            {filteredConduct.map(rule => {
              const IconComp = rule.icon;
              return (
                <div
                  key={rule.num}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${rule.border || '#e2e8f0'}`,
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s'
                  }}
                  className="hover:shadow-md"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: rule.bg,
                        color: rule.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: '850',
                        border: `1px solid ${rule.border}`
                      }}>
                        {rule.num}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        {rule.title}
                      </h3>
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      background: rule.bg,
                      color: rule.color,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: `1px solid ${rule.border}`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px'
                    }}>
                      {rule.badge}
                    </span>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {rule.points.map((pt, pIdx) => (
                      <li key={pIdx} style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, fontWeight: '500' }}>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: STUDENT SAFETY, SECURITY & WELFARE PROTOCOLS */}
      {(activeSection === 'all' || activeSection === 'safety') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #f1f5f9',
            paddingBottom: '10px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert color="#dc2626" size={20} />
                Student Safety, Security &amp; Welfare Protocols
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Paramount health, medical, transit, and residential supervision measures instituted at LTC.
              </p>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '12px' }}>
              7 Key Protocols
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredSafety.map(protocol => {
              const IconComp = protocol.icon;
              return (
                <div
                  key={protocol.num}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${protocol.color}`,
                    borderRadius: '16px',
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: protocol.bg,
                        color: protocol.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${protocol.border}`
                      }}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a' }}>
                          {protocol.num}. {protocol.title}
                        </h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                          {protocol.summary}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {protocol.details.map((dt, dIdx) => (
                      <li key={dIdx} style={{ fontSize: '13px', color: '#334155', lineHeight: 1.55, fontWeight: '500' }}>
                        {dt}
                      </li>
                    ))}
                  </ul>

                  {/* Dedicated Direct Contacts for Medical & Security */}
                  {protocol.contacts && protocol.contacts.length > 0 && (
                    <div style={{
                      marginTop: '6px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
                        Direct Emergency Contacts:
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                        {protocol.contacts.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '8px 12px',
                              borderRadius: '8px'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: '750', color: '#0f172a' }}>
                                {c.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {c.role}
                              </div>
                            </div>
                            <a
                              href={`tel:${c.tel}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#ea580c',
                                color: '#ffffff',
                                padding: '5px 10px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '700',
                                textDecoration: 'none'
                              }}
                              className="hover:opacity-90 active:scale-95"
                            >
                              <Phone size={12} />
                              {c.phone}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: PARENT CONSENT & MANDATORY SUBMISSIONS */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '18px',
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileCheck color="#ea580c" size={20} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '850', color: '#0f172a' }}>
              Mandatory Student Information &amp; Parent Consent
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Required submissions verified prior to boarding and campus induction.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {[
            { title: 'Parent Consent Form', desc: 'Signed digital undertaking form submitted through student portal.', done: !!myData.undertaking_submitted },
            { title: 'Emergency Contact Numbers', desc: 'Active primary and secondary guardian contact coordinates.', done: true },
            { title: 'Medical History & Needs', desc: 'Pre-existing medical conditions and doctor prescriptions disclosed.', done: true },
            { title: 'Allergies & Dietary Needs', desc: 'Specific food, drug, or environmental sensitivities documented.', done: true }
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span style={{ fontSize: '13px', fontWeight: '750', color: '#0f172a' }}>
                  {item.title}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Contact Directory Quick Card */}
      {(activeSection === 'all' || activeSection === 'contacts') && (
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          border: '1px solid #fed7aa',
          borderRadius: '18px',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone color="#ea580c" size={20} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '850', color: '#9a3412' }}>
                Emergency Contacts Directory
              </h3>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: '#ffffff', color: '#ea580c', padding: '3px 9px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
              24/7 Helpline
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Campus Doctor</div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', margin: '2px 0 6px 0' }}>Dr. Anwar Shaikh Sir</div>
              <a href="tel:+919823443537" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ea580c', fontWeight: '750', fontSize: '12.5px', textDecoration: 'none' }}>
                <Phone size={13} /> 9823443537
              </a>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Medical Sister</div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', margin: '2px 0 6px 0' }}>Nirmala Bhalekar (Sister)</div>
              <a href="tel:+918208938209" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ea580c', fontWeight: '750', fontSize: '12.5px', textDecoration: 'none' }}>
                <Phone size={13} /> 8208938209
              </a>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Campus Security</div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', margin: '2px 0 6px 0' }}>Mr. Harshavardhan Patil</div>
              <a href="tel:+917722017372" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ea580c', fontWeight: '750', fontSize: '12.5px', textDecoration: 'none' }}>
                <Phone size={13} /> 77220 17372
              </a>
            </div>

            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Associate Director</div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0f172a', margin: '2px 0 6px 0' }}>Mr. Shardool Shirolkar</div>
              <a href="tel:+919879616220" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ea580c', fontWeight: '750', fontSize: '12.5px', textDecoration: 'none' }}>
                <Phone size={13} /> 9879616220
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
