import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import API_BASE_URL from '@/config/apiConfig';

const API = API_BASE_URL;

export default function BatchStudentsBreakdownTab({ batchId, batchName, token, toast }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('all'); // 'all', 'classes', 'rooms', 'unallocated'

  const fetchBreakdown = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/admin/batches/${batchId}/students-breakdown`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setData(d);
      } else {
        setError(d.message || 'Failed to load students breakdown.');
      }
    } catch (err) {
      console.error('Error fetching students breakdown:', err);
      setError('Network error loading students breakdown.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchBreakdown();
    }
  }, [batchId]);

  const handleExportExcel = () => {
    if (!data) return;
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 1: Class-Wise Summary
      const classRows = (data.classBreakdown || []).map(r => ({
        'Standard / Class': r.standard,
        'Total Boys': r.boysCount,
        'Total Girls': r.girlsCount,
        'Total Students': r.totalStudents,
        "Boys' Rooms": (r.boysRooms || []).join(', ') || 'None',
        "Girls' Rooms": (r.girlsRooms || []).join(', ') || 'None',
        'Allocated Students': r.totalAllocated,
        'Unallocated Students': r.totalUnallocated
      }));

      // Add Total Row
      if (data.summary) {
        classRows.push({
          'Standard / Class': 'TOTAL',
          'Total Boys': data.summary.totalBoys,
          'Total Girls': data.summary.totalGirls,
          'Total Students': data.summary.totalStudents,
          "Boys' Rooms": `${data.summary.boysRoomsUsed} Rooms`,
          "Girls' Rooms": `${data.summary.girlsRoomsUsed} Rooms`,
          'Allocated Students': data.summary.totalAllocated,
          'Unallocated Students': data.summary.totalUnallocated
        });
      }

      const classSheet = XLSX.utils.json_to_sheet(classRows);
      XLSX.utils.book_append_sheet(workbook, classSheet, 'Class Summary');

      // Sheet 2: Room-Wise Occupancy
      const roomRows = (data.roomBreakdown || []).map(r => ({
        'Room Number': r.room,
        'Building': r.building,
        'Gender': r.gender,
        'Student Count': r.totalStudents,
        'Classes in Room': r.classesSummary,
        'Occupants': (r.students || []).map(s => `${s.name} (${s.standard || '—'}, ${s.squad || '—'})`).join('; ')
      }));
      const roomSheet = XLSX.utils.json_to_sheet(roomRows);
      XLSX.utils.book_append_sheet(workbook, roomSheet, 'Room Occupancy');

      // Sheet 3: Unallocated Students (if any)
      if (data.unallocatedStudents && data.unallocatedStudents.length > 0) {
        const unallocRows = data.unallocatedStudents.map(s => ({
          'PRN': s.prn || '—',
          'Name': s.name,
          'Gender': s.gender,
          'Standard': s.standard,
          'Squad': s.squad || '—'
        }));
        const unallocSheet = XLSX.utils.json_to_sheet(unallocRows);
        XLSX.utils.book_append_sheet(workbook, unallocSheet, 'Unallocated');
      }

      XLSX.writeFile(workbook, `Batch_${batchName || batchId}_Students_Breakdown.xlsx`);
      if (toast) toast('Breakdown report exported to Excel!', 'success');
    } catch (e) {
      console.error('Export error:', e);
      if (toast) toast('Failed to export Excel report.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '36px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '14px'
      }}>
        Loading complete students breakdown...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#dc2626', fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>
          {error || 'Unable to load breakdown data.'}
        </p>
        <button
          onClick={fetchBreakdown}
          style={{
            background: '#0f172a',
            color: '#ffffff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, classBreakdown = [], roomBreakdown = [], unallocatedStudents = [] } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header & Actions */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
            Students & Room Allocation Breakdown
          </h3>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Batch: <strong style={{ color: '#0f172a' }}>{batchName || batchId}</strong> &bull; Complete class-wise student statistics and room assignments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={fetchBreakdown}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          <button
            onClick={handleExportExcel}
            style={{
              background: '#154388',
              border: '1px solid #154388',
              color: '#ffffff',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Export to Excel
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '12px'
      }}>
        {/* Total Students */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Students
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {summary.totalStudents}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Enrolled in batch
          </div>
        </div>

        {/* Boys */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Boys
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8', marginTop: '4px' }}>
            {summary.totalBoys}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            {summary.boysRoomsUsed} rooms occupied
          </div>
        </div>

        {/* Girls */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Girls
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#be185d', marginTop: '4px' }}>
            {summary.totalGirls}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            {summary.girlsRoomsUsed} rooms occupied
          </div>
        </div>

        {/* Total Rooms Used */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Rooms
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#166534', marginTop: '4px' }}>
            {summary.totalRoomsUsed}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Sinhgad & Pratapgad
          </div>
        </div>

        {/* Allocation Status */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', fontWeight: '750', color: summary.totalUnallocated > 0 ? '#b45309' : '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Allocated Status
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: summary.totalUnallocated > 0 ? '#b45309' : '#047857', marginTop: '4px' }}>
            {summary.totalAllocated} / {summary.totalStudents}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            {summary.totalUnallocated > 0 ? `${summary.totalUnallocated} unallocated` : '100% allocated'}
          </div>
        </div>
      </div>

      {/* Section 1: Complete Class-Wise Breakdown */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
            Class-Wise Student & Room Summary
          </h4>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Total boys and girls per standard, alongside their allocated room numbers.
          </p>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '14%' }}>Standard / Class</th>
                <th style={{ padding: '12px 14px', fontWeight: '750', color: '#1d4ed8', width: '10%', textAlign: 'center' }}>Total Boys</th>
                <th style={{ padding: '12px 14px', fontWeight: '750', color: '#be185d', width: '10%', textAlign: 'center' }}>Total Girls</th>
                <th style={{ padding: '12px 14px', fontWeight: '750', color: '#0f172a', width: '10%', textAlign: 'center' }}>Total Students</th>
                <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '25%' }}>Boys' Room Numbers</th>
                <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '21%' }}>Girls' Room Numbers</th>
                <th style={{ padding: '12px 14px', fontWeight: '750', color: '#475569', width: '10%', textAlign: 'center' }}>Unallocated</th>
              </tr>
            </thead>
            <tbody>
              {classBreakdown.map((row, idx) => (
                <tr 
                  key={row.standard}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '750', color: '#0f172a' }}>
                    Standard {row.standard}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#1d4ed8' }}>
                    {row.boysCount}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#be185d' }}>
                    {row.girlsCount}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>
                    {row.totalStudents}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.boysRooms && row.boysRooms.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {row.boysRooms.map(rm => (
                          <span
                            key={rm}
                            style={{
                              padding: '2px 7px',
                              background: '#eff6ff',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '600'
                            }}
                          >
                            {rm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {row.girlsRooms && row.girlsRooms.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {row.girlsRooms.map(rm => (
                          <span
                            key={rm}
                            style={{
                              padding: '2px 7px',
                              background: '#fdf2f8',
                              color: '#9d174d',
                              border: '1px solid #fbcfe8',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '600'
                            }}
                          >
                            {rm}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    {row.totalUnallocated > 0 ? (
                      <span style={{
                        padding: '2px 7px',
                        background: '#fef3c7',
                        color: '#b45309',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }}>
                        {row.totalUnallocated}
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '12px' }}>0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: '800' }}>
                <td style={{ padding: '12px 16px', color: '#0f172a' }}>TOTAL</td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#1d4ed8' }}>{summary.totalBoys}</td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#be185d' }}>{summary.totalGirls}</td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#0f172a' }}>{summary.totalStudents}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                  {summary.boysRoomsUsed} Boys Rooms Used
                </td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                  {summary.girlsRoomsUsed} Girls Rooms Used
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: summary.totalUnallocated > 0 ? '#b45309' : '#16a34a' }}>
                  {summary.totalUnallocated}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 2: Room-Wise Distribution */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
            Room-Wise Occupancy & Class Distribution
          </h4>
          <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
            Individual room assignments showing gender, total student count, and class breakdown per room.
          </p>
        </div>

        {roomBreakdown.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
            fontSize: '13px'
          }}>
            No rooms have been allocated yet for this batch. Run room allocation from the Squad Allocation tab.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '15%' }}>Room Number</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#334155', width: '13%' }}>Building</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#334155', width: '10%' }}>Gender</th>
                  <th style={{ padding: '12px 14px', fontWeight: '750', color: '#334155', width: '12%', textAlign: 'center' }}>Student Count</th>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '20%' }}>Classes in Room</th>
                  <th style={{ padding: '12px 16px', fontWeight: '750', color: '#334155', width: '30%' }}>Occupants</th>
                </tr>
              </thead>
              <tbody>
                {roomBreakdown.map((r, idx) => (
                  <tr 
                    key={r.room}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '750', color: '#0f172a' }}>
                      {r.room}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '550' }}>
                      {r.building}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: r.gender === 'Female' ? '#fdf2f8' : '#eff6ff',
                        color: r.gender === 'Female' ? '#be185d' : '#1d4ed8',
                        border: `1px solid ${r.gender === 'Female' ? '#fce7f3' : '#dbeafe'}`
                      }}>
                        {r.gender === 'Female' ? 'Girls' : 'Boys'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '750', color: '#0f172a' }}>
                      {r.totalStudents}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '650', color: '#334155' }}>
                      {r.classesSummary || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45 }}>
                        {(r.students || []).map((st, sIdx) => (
                          <span key={st.id}>
                            <strong style={{ color: '#0f172a' }}>{st.name}</strong> ({st.standard})
                            {sIdx < r.students.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Unallocated Students */}
      {unallocatedStudents.length > 0 && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#9a3412' }}>
              Unallocated Students ({unallocatedStudents.length})
            </h4>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#7c2d12' }}>
              The following students do not currently have a room assigned in this batch.
            </p>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #fed7aa', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                  <th style={{ padding: '10px 14px', fontWeight: '750', color: '#9a3412' }}>PRN</th>
                  <th style={{ padding: '10px 14px', fontWeight: '750', color: '#9a3412' }}>Student Name</th>
                  <th style={{ padding: '10px 14px', fontWeight: '750', color: '#9a3412' }}>Standard</th>
                  <th style={{ padding: '10px 14px', fontWeight: '750', color: '#9a3412' }}>Gender</th>
                  <th style={{ padding: '10px 14px', fontWeight: '750', color: '#9a3412' }}>Squad</th>
                </tr>
              </thead>
              <tbody>
                {unallocatedStudents.map((st, idx) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid #ffedd5', background: idx % 2 === 0 ? '#ffffff' : '#fffaf5' }}>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{st.prn || '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{st.name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: '#334155' }}>Standard {st.standard}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{st.gender}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{st.squad || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
