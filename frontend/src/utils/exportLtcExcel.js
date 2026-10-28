import * as XLSX from 'xlsx';

export const exportLtcExcel = ({
  title,
  batchName,
  students,
  schedules,
  attendanceData,
  evaluationData,
  summaryData,
  filename,
  isLtcMember = false
}) => {
  // Sort batch schedules chronologically to get the first 4 day-wise schedules
  const sortedSchedules = [...schedules]
    .sort((a, b) => new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00')))
    .slice(0, 4);

  const rows = students.map((st, index) => {
    // Filter student records
    const studentAtt = attendanceData.filter(r => String(r.student_id) === String(st.id));
    const studentEvals = evaluationData.filter(e => String(e.student_id) === String(st.id));
    const summary = summaryData.find(s => String(s.student_id) === String(st.id));

    const row = {
      'Sr No': index + 1
    };

    row['Student ID'] = st.system_student_id || st.student_id || st.student_display_id || st.prn || '-';
    if (!isLtcMember) {
      row['PRN'] = st.prn || '-';
    }

    row['Student Name'] = st.name;
    row['School'] = st.school || '-';
    row['Program'] = st.program || st.department || '-';
    row['Batch'] = batchName || '-';
    row['Division'] = st.division || '-';
    row['Squad'] = st.squad || 'Unassigned';

    // 1. Day wise attendance (Day 1 to 4)
    for (let d = 1; d <= 4; d++) {
      const s = sortedSchedules[d - 1];
      let statusVal = '-';
      if (s) {
        const rec = studentAtt.find(r => String(r.schedule_id) === String(s.id));
        if (rec) {
          statusVal = rec.status || '-';
        }
      }
      row[`Day ${d} Attendance`] = statusVal;
    }

    // 2. Attendance summary
    let presentCount = 0;
    let absentCount = 0;
    let totalTracked = 0;

    sortedSchedules.forEach(s => {
      const rec = studentAtt.find(r => String(r.schedule_id) === String(s.id));
      if (rec && rec.status) {
        totalTracked++;
        const statusLower = rec.status.toLowerCase();
        if (statusLower === 'present' || statusLower === 'late') {
          presentCount++;
        } else if (statusLower === 'absent') {
          absentCount++;
        }
      }
    });

    row['Total Present Days'] = totalTracked > 0 ? `${presentCount}/4` : '-';
    row['Total Absent Days'] = totalTracked > 0 ? `${absentCount}/4` : '-';
    row['Attendance Percentage'] = totalTracked > 0 ? `${Math.round((presentCount / 4) * 100)}%` : '-';

    // 3. Evaluations completeness check
    // Evaluation is Completed if there is a summary AND all 25 records (5 pillars x 5 days) are locked
    const isCompleted = !!(summary && studentEvals.length === 25 && studentEvals.every(e => e.status === 'locked'));

    // Pillars definitions
    const pillars = [
      { key: 'agriculture', name: 'Agriculture & Nature', label: 'Agriculture' },
      { key: 'physical', name: 'Physical Fitness & Sports', label: 'Physical' },
      { key: 'leadership', name: 'Team Building & Leadership', label: 'Leadership' },
      { key: 'patriotism', name: 'Patriotism & Nation Building', label: 'Patriotism' },
      { key: 'spirituality', name: 'Spirituality & Peace', label: 'Spirituality' }
    ];

    pillars.forEach(p => {
      // Day 1 to Day 5 marks
      for (let d = 1; d <= 5; d++) {
        const ev = studentEvals.find(e => e.pillar === p.key && e.day === d);
        row[`${p.name} Day ${d} Total /20`] = (ev && ev.status === 'locked') ? Number(ev.daily_total) : '-';
      }
      // Pillar final average
      row[`${p.label} Final Average /20`] = isCompleted ? Number(summary[`${p.key}_marks`]) : '-';
    });

    // Final overview columns
    row['Agriculture Marks /20'] = isCompleted ? Number(summary.agriculture_marks) : '-';
    row['Physical Marks /20'] = isCompleted ? Number(summary.physical_marks) : '-';
    row['Leadership Marks /20'] = isCompleted ? Number(summary.leadership_marks) : '-';
    row['Patriotism Marks /20'] = isCompleted ? Number(summary.patriotism_marks) : '-';
    row['Spirituality Marks /20'] = isCompleted ? Number(summary.spirituality_marks) : '-';
    row['Final LTC Score /100'] = isCompleted ? Number(summary.final_score_out_of_100) : '-';
    row['Evaluation Status'] = isCompleted ? 'Completed' : 'Pending';

    return row;
  });

  // Create header arrays of arrays (aoa)
  const headerRows = [
    [title || 'Life Awakening Program (LTC) - Student Evaluation Report'],
    ['Batch:', batchName || '-'],
    ['Generated Date:', new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })],
    [] // Empty row spacer
  ];

  const ws = XLSX.utils.aoa_to_sheet(headerRows);

  // Merge the title across the first few columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }
  ];

  // Add the JSON records starting from row 5 (origin: 'A5')
  XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5', skipHeader: false });

  // Auto-calculate column widths
  if (rows.length > 0) {
    const colWidths = Object.keys(rows[0]).map(key => {
      let maxLen = key.length;
      rows.forEach(r => {
        const val = r[key] !== undefined && r[key] !== null ? String(r[key]) : '';
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.max(maxLen + 2, 10) };
    });
    ws['!cols'] = colWidths;
  }

  // Freeze the first 5 rows (Title + metadata + table headers) so scroll works nicely
  ws['!views'] = [
    { state: 'frozen', ySplit: 5 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "LTC Report");
  XLSX.writeFile(wb, filename || `${batchName || 'LTC'}_Evaluation_Report.xlsx`);
};
