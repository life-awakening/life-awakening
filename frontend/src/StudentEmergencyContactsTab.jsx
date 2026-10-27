import React from 'react';

const IMPORTANT_CONTACTS = [
  { category: 'Medical Emergency', name: 'Dr. Tukaram Shinde', designation: 'Doctor', contact: '963744475' },
  { category: 'Medical Emergency', name: 'Nirmala Bhalekar', designation: 'Sister', contact: '8208938209' },
  { category: 'Medical Emergency', name: 'Devdatta Kolape', designation: 'Brother', contact: '9766172124' },
  { category: 'Accommodation', name: 'Wing Commander Gaurav Karandikar', designation: 'Director', contact: '9480283285' },
  { category: 'Academics', name: 'Nitin Sangale', designation: 'Academics Manager', contact: '9309177426' }
];

const PILLAR_HEADS = [
  { pillar: 'Patriotism & Nation Building', name: 'Mr. Ravindra Singh', designation: 'Sr. Instructor', contact: '9752914989' },
  { pillar: 'Physical Fitness & Sports', name: 'Mr. Sanjay Waghmode', designation: 'Sr. Instructor', contact: '7038929386' },
  { pillar: 'Spirituality & Peace', name: 'Miss. Divya Thorat', designation: 'Sr. Instructor', contact: '7972107785' },
  { pillar: 'Agriculture & Nature', name: 'Mr. Sangram Hande', designation: 'Agriculture Manager', contact: '9422514083' },
  { pillar: 'Team Building & Leadership', name: 'Mr. Shardool Shirolkar', designation: 'Associate Director', contact: '9879616220' }
];

export default function StudentEmergencyContactsTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px'
      }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.3px' }}>
          Emergency Contacts
        </h2>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
          Quick directory for campus emergencies, medical assistance, accommodation support, and pillar mentorship.
        </p>
      </div>

      {/* Section 1: Important Contacts */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
            Important Contacts
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Medical emergency officers, campus administration, and academic coordinators.
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Designation</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</th>
              </tr>
            </thead>
            <tbody>
              {IMPORTANT_CONTACTS.map((item, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: idx === IMPORTANT_CONTACTS.length - 1 ? 'none' : '1px solid #f1f5f9',
                    background: '#ffffff'
                  }}
                >
                  <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: item.category === 'Medical Emergency' ? '#fef2f2' : item.category === 'Accommodation' ? '#eff6ff' : '#f0fdf4',
                      color: item.category === 'Medical Emergency' ? '#991b1b' : item.category === 'Accommodation' ? '#1e40af' : '#166534',
                      border: `1px solid ${item.category === 'Medical Emergency' ? '#fecaca' : item.category === 'Accommodation' ? '#bfdbfe' : '#bbf7d0'}`
                    }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>{item.name}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{item.designation}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <a
                      href={`tel:${item.contact}`}
                      style={{
                        color: '#ea580c',
                        fontWeight: '700',
                        textDecoration: 'none',
                        letterSpacing: '0.3px'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {item.contact}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Pillar Heads */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
            Pillar Heads
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Instructors and managers responsible for LTC transformation pillars.
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pillar</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Designation</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</th>
              </tr>
            </thead>
            <tbody>
              {PILLAR_HEADS.map((item, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: idx === PILLAR_HEADS.length - 1 ? 'none' : '1px solid #f1f5f9',
                    background: '#ffffff'
                  }}
                >
                  <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: '#f8fafc',
                      color: '#334155',
                      border: '1px solid #e2e8f0'
                    }}>
                      {item.pillar}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600' }}>{item.name}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{item.designation}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <a
                      href={`tel:${item.contact}`}
                      style={{
                        color: '#ea580c',
                        fontWeight: '700',
                        textDecoration: 'none',
                        letterSpacing: '0.3px'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      {item.contact}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
