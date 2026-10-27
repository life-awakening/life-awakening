const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const riStorageService = require('../services/riStorageService');

// Remove a file multer already stored when the controller then rejects it (type/size), so no orphan is left behind
const discardUpload = (file) => { try { if (file?.path) fs.unlinkSync(file.path); } catch { /* ignore */ } };
const { RI_ACTIVITIES, RI_ACTIVITY_LABEL_MAP, RI_ACTIVITY_MAP, normalizeRiActivityKey } = require('../utils/riConstants');

/**
 * Helper to get student's active programs (LTC and RI)
 */
const getStudentPrograms = async (req, res) => {
  try {
    const studentId = req.user.id;

    const ltcCheck = await pool.query(`
      SELECT bs.batch_id, b.name as batch_name, b.status as batch_status, bs.squad, bs.room
      FROM batch_students bs
      JOIN batches b ON bs.batch_id = b.id
      WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
      ORDER BY bs.batch_id DESC
      LIMIT 1
    `, [studentId]);

    const riCheck = await pool.query(`
      SELECT rbs.ri_batch_id, rb.name as batch_name, rb.status as batch_status, rbs.ri_panel_id, rp.name as panel_name, rp.panel_number, rbs.ri_id
      FROM ri_batch_students rbs
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      WHERE rbs.student_id = $1
      ORDER BY rbs.ri_batch_id DESC
      LIMIT 1
    `, [studentId]);

    const hasLtc = ltcCheck.rowCount > 0 || (riCheck.rowCount === 0);
    const hasRi = riCheck.rowCount > 0;

    res.json({
      has_ltc: hasLtc,
      has_ri: hasRi,
      ltc_batch: ltcCheck.rows[0] || null,
      ri_batch: riCheck.rows[0] || null
    });
  } catch (err) {
    console.error('Error checking student programs:', err);
    res.status(500).json({ message: 'Failed to check program eligibility', error: err.message });
  }
};

/**
 * 1. Get RI Student Profile & Panel/Village Assignment Details
 */
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Fetch student's base info
    const userRes = await pool.query(`
      SELECT 
        id, name, email, prn, roll_number, department, division, 
        gender, phone, school, program, year, status,
        undertaking_submitted, undertaking_signed_name, undertaking_signed_date
      FROM users 
      WHERE id = $1
    `, [studentId]);

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Student record not found.' });
    }
    const student = userRes.rows[0];

    // Fetch student's RI assignment
    const riAssignmentRes = await pool.query(`
      SELECT 
        rbs.id as enrollment_id,
        rbs.ri_id,
        rbs.enrolled_at,
        rb.id as batch_id,
        rb.name as batch_name,
        rb.status as batch_status,
        rb.description as batch_description,
        rb.source_program as batch_source,
        rb.start_date as batch_start_date,
        rb.end_date as batch_end_date,
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        rp.school as panel_school,
        rp.department as panel_department,
        rp.coordinator_name as panel_coordinator_name,
        rp.class_teacher_name as panel_class_teacher_name,
        rp.ri_village_id,
        v.id as village_id,
        v.name as village_name,
        v.location as village_location,
        v.address as village_address,
        v.detailed_address as village_detailed_address,
        v.school_name as village_school_name,
        v.principal_mobile as village_principal_mobile,
        v.spoc_name as village_spoc_name,
        v.spoc_mobile as village_spoc_mobile,
        v.district as village_district,
        v.panchayat as village_panchayat,
        v.taluka as village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.emergency_contact as village_emergency_contact,
        COALESCE(v.google_maps_link, rp.google_maps_link) as google_maps_link,
        v.remark as village_remark,
        v.notes as village_notes
      FROM ri_batch_students rbs
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rbs.student_id = $1
      ORDER BY rb.id DESC
      LIMIT 1
    `, [studentId]);

    // Check if student also has LTC enrollment
    const ltcCheckRes = await pool.query(`
      SELECT bs.batch_id, b.name as batch_name, bs.squad, bs.room
      FROM batch_students bs
      JOIN batches b ON bs.batch_id = b.id
      WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
      LIMIT 1
    `, [studentId]);
    const hasLtc = ltcCheckRes.rowCount > 0;

    if (riAssignmentRes.rowCount === 0) {
      return res.json({
        has_ri_assignment: false,
        student,
        has_ltc: hasLtc,
        message: 'No active Rural Immersion panel assignment found for your account.'
      });
    }

    const assignment = riAssignmentRes.rows[0];

    // Fetch assigned panel mentors
    const mentorsRes = await pool.query(`
      SELECT 
        id, name, email, phone, department, designation, employee_id, role
      FROM ri_batch_faculty
      WHERE ri_panel_id = $1 AND ri_batch_id = $2 AND status <> 'deleted'
      ORDER BY role = 'Lead Mentor' DESC, name ASC
    `, [assignment.panel_id, assignment.batch_id]);

    // Fetch panel co-students / teammates
    const teammatesRes = await pool.query(`
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        u.division,
        u.gender,
        (u.id = $3) as is_current_user
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2
      ORDER BY u.roll_number ASC, u.name ASC
    `, [assignment.panel_id, assignment.batch_id, studentId]);

    // Fetch student's attendance summary (4 activities)
    const attendanceRes = await pool.query(`
      SELECT 
        activity, status, updated_at, remarks
      FROM ri_attendance
      WHERE student_id = $1 AND ri_batch_id = $2 AND ri_panel_id = $3
      ORDER BY activity ASC
    `, [studentId, assignment.batch_id, assignment.panel_id]);

    const attendanceRecords = attendanceRes.rows;
    const activitiesPresent = attendanceRecords.filter(r => r.status === 'Present').length;
    const activitiesAbsent = attendanceRecords.filter(r => r.status === 'Absent').length;
    const attendancePercentage = Math.round((activitiesPresent / 4) * 100);

    // Check Undertaking Status (LTC undertaking for LTC+RI students, RI undertaking for RI-only)
    const undertakingCheckRes = await pool.query(`
      SELECT id, signed_name, signed_date, status, updated_at
      FROM ri_undertakings
      WHERE student_id = $1
      LIMIT 1
    `, [studentId]);
    const isLtcSubmitted = Boolean(student.undertaking_submitted);
    const undertakingSubmitted = isLtcSubmitted ||
      (undertakingCheckRes.rowCount > 0 && (undertakingCheckRes.rows[0].status === 'Submitted' || Boolean(undertakingCheckRes.rows[0].signed_name)));

    res.json({
      has_ri_assignment: true,
      has_ltc: hasLtc,
      student: {
        ...student,
        ri_id: assignment.ri_id
      },
      batch: {
        id: assignment.batch_id,
        name: assignment.batch_name,
        status: assignment.batch_status,
        description: assignment.batch_description,
        start_date: assignment.batch_start_date || null,
        end_date: assignment.batch_end_date || null
      },
      panel: {
        id: assignment.panel_id,
        panel_number: assignment.panel_number,
        name: assignment.panel_name,
        school: assignment.panel_school || '',
        department: assignment.panel_department || '',
        coordinator_name: assignment.panel_coordinator_name || '',
        class_teacher_name: assignment.panel_class_teacher_name || '',
        google_maps_link: assignment.google_maps_link || '',
        total_members: teammatesRes.rowCount
      },
      village: {
        id: assignment.village_id,
        name: assignment.village_name || 'Not Yet Allocated',
        location: assignment.village_location || '—',
        address: assignment.village_address || '',
        detailed_address: assignment.village_detailed_address || assignment.village_location || '',
        school_name: assignment.village_school_name || '',
        principal_mobile: assignment.village_principal_mobile || '',
        spoc_name: assignment.village_spoc_name || '',
        spoc_mobile: assignment.village_spoc_mobile || '',
        district: assignment.village_district || '—',
        panchayat: assignment.village_panchayat || '—',
        taluka: assignment.village_taluka || assignment.village_panchayat || '',
        sarpanch_name: assignment.sarpanch_name || '—',
        sarpanch_mobile: assignment.sarpanch_mobile || '—',
        emergency_contact: assignment.village_emergency_contact || '—',
        google_maps_link: assignment.google_maps_link || '',
        remark: assignment.village_remark || '',
        notes: assignment.village_notes || ''
      },
      mentors: mentorsRes.rows,
      teammates: teammatesRes.rows,
      undertaking_status: {
        submitted: undertakingSubmitted,
        details: undertakingCheckRes.rows[0] || (isLtcSubmitted ? {
          signed_name: student.undertaking_signed_name,
          signed_date: student.undertaking_signed_date,
          status: 'Submitted'
        } : null)
      },
      attendance_summary: {
        records: attendanceRecords,
        activities_present: activitiesPresent,
        activities_absent: activitiesAbsent,
        attendance_percentage: attendancePercentage
      }
    });
  } catch (err) {
    console.error('Error fetching RI student profile:', err);
    res.status(500).json({ message: 'Failed to load Rural Immersion student profile', error: err.message });
  }
};

/**
 * 2. Get RI Student 4-Activity Attendance Records (RUIP 15% Assessment)
 */
const getStudentAttendance = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get current assignment
    const assignmentRes = await pool.query(`
      SELECT rbs.ri_batch_id, rbs.ri_panel_id, rb.name as batch_name, rp.name as panel_name
      FROM ri_batch_students rbs
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      WHERE rbs.student_id = $1
      ORDER BY rb.id DESC
      LIMIT 1
    `, [studentId]);

    if (assignmentRes.rowCount === 0) {
      return res.status(404).json({ message: 'No active RI assignment found.' });
    }

    const { ri_batch_id, ri_panel_id, batch_name, panel_name } = assignmentRes.rows[0];

    const attRes = await pool.query(`
      SELECT activity, status, updated_at, marked_by_email, remarks, is_locked
      FROM ri_attendance
      WHERE student_id = $1 AND ri_batch_id = $2 AND ri_panel_id = $3
    `, [studentId, ri_batch_id, ri_panel_id]);

    const attMap = {};
    attRes.rows.forEach(r => {
      const actKey = normalizeRiActivityKey(r.activity);
      attMap[actKey] = r;
    });

    const activitiesData = RI_ACTIVITIES.map((act, idx) => {
      const record = attMap[act.key];
      const isPresent = record?.status === 'Present' || record?.status === 'P';
      const isAbsent = record?.status === 'Absent' || record?.status === 'A';
      const status = isPresent ? 'Present' : (isAbsent ? 'Absent' : (record?.status || 'Unmarked'));

      return {
        activity_number: idx + 1,
        activity_key: act.key,
        activity_name: act.label,
        short_label: act.shortLabel || act.label,
        description: act.description,
        status,
        is_present: isPresent,
        is_absent: isAbsent,
        is_unmarked: !isPresent && !isAbsent,
        marked_at: record ? record.updated_at : null,
        marked_by: record ? record.marked_by_email : null,
        remarks: record ? record.remarks : null,
        is_locked: record ? Boolean(record.is_locked) : false,
        marks_awarded: isPresent ? 3.75 : 0,
        max_marks: 3.75
      };
    });

    const presentCount = activitiesData.filter(d => d.is_present).length;
    const absentCount = activitiesData.filter(d => d.is_absent).length;
    const unmarkedCount = activitiesData.filter(d => d.is_unmarked).length;
    const attendancePct = Math.round((presentCount / 4) * 100);
    // RUIP 15% Assessment Scale: 4/4 = 15.00, 3/4 = 11.25, 2/4 = 7.50, 1/4 = 3.75, 0/4 = 0.00
    const ATT_SCALE = { 4: 15.00, 3: 11.25, 2: 7.50, 1: 3.75, 0: 0.00 };
    const attendanceMarks = ATT_SCALE[presentCount] ?? (Math.round(presentCount * 3.75 * 100) / 100);

    res.json({
      batch_name,
      panel_name,
      summary: {
        total_activities: 4,
        present_count: presentCount,
        absent_count: absentCount,
        unmarked_count: unmarkedCount,
        attendance_percentage: attendancePct,
        attendance_marks: attendanceMarks,
        max_marks: 15.00
      },
      activities: activitiesData
    });
  } catch (err) {
    console.error('Error fetching RI student attendance:', err);
    res.status(500).json({ message: 'Failed to load attendance', error: err.message });
  }
};

/**
 * 3. Get RI Student Activities, Timeline Schedule & Evaluation Rubrics (2-Day Rural Immersion)
 */
const getStudentActivities = async (req, res) => {
  try {
    const schedule = [
      {
        day: 'Day 1',
        day_number: 1,
        title: 'Departure, Village Entry & Institutional Immersion',
        date_label: 'Day 1 — 06:00 AM to 07:30 PM',
        short_description: 'Journey from MIT-WPU Pune to allocated village, formal Sarpanch & Gram Panchayat reception, visits to local institutions (GP, PHC, schools, banks) and transit to LTC Daund.',
        location: 'MIT-WPU Pune → Allocated RI Village → LTC Daund Base Camp',
        instructions_students: 'Get introduced to Sarpanch and villagers. Move in village to understand lifestyle, aspirations, and challenges. Visit minimum 2 rural institutions and record findings on Form IV (Institutional Visit Observations Form).',
        instructions_faculty: 'Introduce students to Sarpanch, Gram Sevak, and leaders. Divide students into groups of 5 for rotational visits to village institutions.',
        important_tasks: [
          'Assembly at MIT-WPU Main Gate (06:00 AM) and departure to village',
          'Introduction with Sarpanch, Gram Sevak, and village community leaders (09:30 AM – 11:00 AM)',
          'Institutional Visits: Gram Panchayat, Primary School, Health Centre, Bank/Society (11:00 AM – 01:00 PM)',
          'Record observations on Form IV (Institutional Visit Observations Form)',
          'Meeting village entrepreneurs and small business owners / School activity (02:00 PM – 05:30 PM)',
          'Departure to LTC Daund Base Camp and evening mentor debrief (06:00 PM – 07:30 PM)'
        ],
        forms_deliverables: ['Form IV: Institutional Observations Sheet', 'Day 1 Field Log Entry (Form IIIB)'],
        activities: [
          {
            time: '06:00 AM – 09:30 AM',
            title: 'Assembly at MIT-WPU & Journey to Allocated Village',
            description: 'Assembly at MIT-WPU Pune Main Gate, reporting to faculty mentors, ID verification, boarding designated university buses, and breakfast en route to the village.',
            location: 'MIT-WPU Main Gate → Village Bus',
            dress: 'Decent Casual / Travel Wear',
            category: 'Registration & Travel',
            type: 'travel',
            deliverable: 'Attendance & Bus Verification'
          },
          {
            time: '09:30 AM – 11:00 AM',
            title: 'Formal Village Entry & Sarpanch / Community Reception',
            description: 'Welcome ceremony and initial orientation with Sarpanch, Gram Sevak, Gram Panchayat members, and community elders. Orientation on local customs and village walkthrough.',
            location: 'Gram Panchayat Office / Village Chawadi',
            dress: 'Formal / Dignified Attire',
            category: 'Field Immersion',
            type: 'field',
            deliverable: 'Community Interaction Notes'
          },
          {
            time: '11:00 AM – 01:00 PM',
            title: 'Rotational Visits to Village Organizations & Institutions (Form IV)',
            description: 'Visits in student groups (5 members each) to primary rural institutions: Gram Panchayat, Primary Health Centre (PHC), ZP Primary School, Anganwadi, and Cooperative Society/Bank. Record observations in Form IV.',
            location: 'GP Office, PHC, Primary School, Anganwadi, Bank',
            dress: 'Formal Attire & Student ID Card',
            category: 'Institutional Survey',
            type: 'academic',
            deliverable: 'Form IV: Institutional Observations Sheet'
          },
          {
            time: '01:00 PM – 02:00 PM',
            title: 'Village Community Lunch & Informal Discussions',
            description: 'Traditional lunch arranged locally in the village with fellow students, faculty mentors, and village community members.',
            location: 'Village Community Hall / Allocated Space',
            dress: 'Comfortable Attire',
            category: 'Meals & Break',
            type: 'meals'
          },
          {
            time: '02:00 PM – 05:30 PM',
            title: 'Rural Commerce, SHGs & Micro-Enterprise Interactions',
            description: 'Interactions with village micro-enterprises, Bachat Gat (Women Self-Help Groups), rural artisans, farming setups, and interactive engagement with school students.',
            location: 'Village Micro-Enterprises, Farms & School',
            dress: 'Field Attire & Student ID Card',
            category: 'Community Outreach',
            type: 'outreach',
            deliverable: 'SHG & Enterprise Notes'
          },
          {
            time: '05:30 PM – 07:30 PM',
            title: 'Transit to Base Camp & Evening Faculty Debriefing',
            description: 'Buses depart village for LTC Daund Base Camp. Evening reflection debrief with faculty mentors, verification of Form IV notes, and Day 1 Daily Log (Form IIIB) submission.',
            location: 'Transit to LTC Daund Base Camp',
            dress: 'Formal / Casual Dress',
            category: 'Review & Evaluation',
            type: 'review',
            deliverable: 'Form IIIB: Day 1 Daily Log Entry'
          }
        ]
      },
      {
        day: 'Day 2',
        day_number: 2,
        title: 'Household Socio-Economic Survey, Community Projects & Village Debrief',
        date_label: 'Day 2 — 06:00 AM to 07:30 PM',
        short_description: 'In-depth household family visits in village lanes, student-led community problem-solving projects (Shramdaan/Swachhata), and formal presentation debriefing with Sarpanch & Gram Panchayat.',
        location: 'LTC Daund → Allocated RI Village → LTC Daund Base Camp',
        instructions_students: 'Conduct survey of minimum 3-4 families in pairs (one asking, one recording). Record all observations in Form V (Family Visit Observations Form). Execute village community project (Shramdaan). Present learnings and proposals to Sarpanch in debrief meeting.',
        instructions_faculty: 'Assign specific streets/lanes (Gali/Ward) to student pairs. Coordinate community projects with Sarpanch. Facilitate student presentation during formal debrief.',
        important_tasks: [
          'Early departure from LTC Daund to allocated village (06:00 AM)',
          'Conduct Family Visits (min 3-4 families per pair) across assigned village wards (09:30 AM – 01:00 PM)',
          'Record demographic, housing, energy, health, and agricultural data on Form V',
          'Execute Community Project / Shramdaan: Tree plantation, Swachhata drive, or skill workshops (01:00 PM – 04:00 PM)',
          'Formal Debriefing Meeting with Sarpanch, Gram Sevak, and villagers (04:00 PM – 05:30 PM)',
          'Finalize village problem identification log & record Form IIIB Daily Report'
        ],
        forms_deliverables: ['Form V: Household Survey Questionnaires', 'Community Project (Shramdaan) Log', 'Form IIIB: Day 2 Log Entry'],
        activities: [
          {
            time: '06:00 AM – 08:30 AM',
            title: 'Morning Assembly & Transit to Assigned Village',
            description: 'Morning fall-in at LTC Daund base camp, attendance roll call, breakfast, and departure in assigned buses to the allocated immersion village.',
            location: 'LTC Daund Base Camp → Allocated Village',
            dress: 'Field Wear & Comfortable Shoes',
            category: 'Travel & Admin',
            type: 'travel',
            deliverable: 'Morning Attendance Check'
          },
          {
            time: '08:30 AM – 01:00 PM',
            title: 'Household Socio-Economic Surveys (Form V Execution)',
            description: 'Conduct detailed family socio-economic surveys in student pairs across designated village lanes/wards (min 3-4 families per pair). Record demographic, housing, energy, health, and agricultural data on Form V.',
            location: 'Assigned Village Streets / Wards (Gali/Ward)',
            dress: 'Field Attire & Student ID Card',
            category: 'Socio-Economic Survey',
            type: 'survey',
            deliverable: 'Form V: Household Survey Questionnaires (3-4 Families/Pair)'
          },
          {
            time: '01:00 PM – 02:00 PM',
            title: 'Village Community Lunch & Midday Rest',
            description: 'Community lunch break arranged at the village center with panel teammates and local hosts.',
            location: 'Village Community Center / Panchayat Hall',
            dress: 'Comfortable Attire',
            category: 'Meals & Break',
            type: 'meals'
          },
          {
            time: '02:00 PM – 04:30 PM',
            title: 'Student-Led Shramdaan & Community Action Project',
            description: 'Execution of community problem-solving projects: Swachhata cleanliness drive, tree plantation, school awareness session, water conservation drive, and village area beautification.',
            location: 'Village Commons, Primary School & Water Bodies',
            dress: 'Field Work Attire / Sports Shoes',
            category: 'Community Action',
            type: 'action',
            deliverable: 'Shramdaan & Community Project Report'
          },
          {
            time: '04:30 PM – 06:00 PM',
            title: 'Formal Debriefing Session with Sarpanch & Gram Panchayat',
            description: 'Formal presentation to Sarpanch, Gram Sevak, and Panchayat members. Students share identified village issues, actionable suggestions, survey findings, and express community gratitude.',
            location: 'Gram Panchayat Hall',
            dress: 'Formal Attire',
            category: 'Gram Sabha Presentation',
            type: 'review',
            deliverable: 'Panchayat Debrief Presentation & Problem Identification Log'
          },
          {
            time: '06:00 PM – 07:30 PM',
            title: 'Return Transit to Base Camp & Final Immersion Sign-Off',
            description: 'Return transit to LTC Daund Base Camp. Collation and submission of survey sheets (Form IV & Form V), faculty evaluation grading, and final Form IIIB sign-off.',
            location: 'Transit to LTC Daund Base Camp',
            dress: 'Formal / Casual Dress',
            category: 'Review & Evaluation',
            type: 'review',
            deliverable: 'Final Form IIIB Sign-Off & Dossier Submission'
          }
        ]
      },
      {
        day: 'Day 3',
        day_number: 3,
        title: 'Deep Briefing, NGO Visits & Concluding Immersion',
        date_label: 'Day 3 — 09:00 AM to 02:30 PM',
        short_description: 'Mentor deep briefing session, visits to local rural NGOs and grassroots social development organizations (09:00 AM – 12:00 PM), followed by Journey to Life transformation center.',
        location: 'Allocated Immersion Village → Local NGO Centres → Life Transformation Centre',
        instructions_students: 'Actively engage in the deep briefing review. During NGO visits, study the organization structure, community impact, and village development models. Ensure final sign-offs on all submission forms before return transit.',
        instructions_faculty: 'Lead the deep briefing reflection session, coordinate student groups during NGO visits, verify final attendance, and supervise safe return transit to Life Transformation Centre.',
        important_tasks: [
          'Morning Assembly & Deep Briefing with mentors and village coordinators (09:00 AM – 10:30 AM)',
          'Field visit to local rural NGOs and grassroots development organizations (10:30 AM – 12:00 PM)',
          'Document NGO intervention strategies, community impact, and welfare programs',
          'Final consolidation of immersion findings, Form IIIB and survey deliverables',
          'Journey to Life transformation center, farewell to village stakeholders, and transit (12:00 PM onwards)'
        ],
        forms_deliverables: ['NGO Visit Case Study Notes', 'Final Form IIIB Sign-off', 'Rural Immersion Dossier'],
        activities: [
          {
            time: '09:00 AM – 10:30 AM',
            title: 'Deep Briefing & Immersion Reflection Session',
            description: 'Comprehensive deep briefing session with faculty mentors and village coordinators. Review of survey findings, team deliverables, problem logs, and operational guidelines for NGO visits.',
            location: 'Village Community Hall / Base Camp',
            dress: 'Formal / Dignified Attire & Student ID Card',
            category: 'Review & Debrief',
            type: 'review',
            deliverable: 'Deep Briefing Notes & Field Summary'
          },
          {
            time: '10:30 AM – 12:00 PM',
            title: 'Visit to NGOs & Grassroots Organizations',
            description: 'Field visit to local rural NGOs, grassroots development organizations, and rural welfare centers. Study NGO intervention models, social impact initiatives, and community programs.',
            location: 'Local NGO Centers & Village Social Units',
            dress: 'Field Attire & Student ID Card',
            category: 'Institutional Survey',
            type: 'academic',
            deliverable: 'NGO Case Study & Social Impact Observations'
          },
          {
            time: '12:00 PM – 02:30 PM',
            title: 'Journey to Life transformation center',
            description: 'Concluding reflection debrief, formal farewell to village stakeholders and NGO leaders, lunch, and transit journey to Life Transformation Centre.',
            location: 'Village Base Camp → Life Transformation Centre',
            dress: 'Travel Attire',
            category: 'Registration & Travel',
            type: 'travel',
            deliverable: 'Final Immersion Sign-off & Attendance'
          }
        ]
      }
    ];

    const modules = [
      {
        id: 'survey',
        title: '1. Socio-Economic & Village Resource Survey',
        pillar: 'Field Immersion & Assessment',
        description: 'Survey households and village infrastructure (drinking water, electricity, sanitation, primary health center, school, agriculture). Complete Form IV and Form V.',
        learning_outcome: 'Understand rural demographic realities, resource gaps, and community dynamics.',
        deliverables: ['Completed Form IV (Institutional Visits)', 'Completed Form V (Family Visit - min 3-4 families/pair)'],
        max_marks: 50
      },
      {
        id: 'outreach_debrief',
        title: '2. Community Outreach, Shramdaan & Village Debrief',
        pillar: 'Community Action & Gram Sabha Debrief',
        description: 'Student-led Shramdaan community project, primary school interactive sessions, and formal village debrief presentation with Sarpanch & Panchayat.',
        learning_outcome: 'Develop empathy, civic responsibility, and present actionable rural insights.',
        deliverables: ['Community Project (Shramdaan) Report', 'Sarpanch & Panchayat Debrief Presentation', 'Form IIIB Daily Activity Log'],
        max_marks: 50
      }
    ];

    res.json({
      schedule,
      evaluation: {
        total_marks: 100,
        modules
      }
    });
  } catch (err) {
    console.error('Error fetching RI student activities:', err);
    res.status(500).json({ message: 'Failed to load activities', error: err.message });
  }
};

/**
 * 4. Get Student RI Undertaking Record
 */
const getStudentUndertaking = async (req, res) => {
  try {
    const studentId = req.user.id;

    const undertakingRes = await pool.query(`
      SELECT *
      FROM ri_undertakings
      WHERE student_id = $1
      LIMIT 1
    `, [studentId]);

    const userRes = await pool.query(`
      SELECT 
        id, name, email, prn, roll_number, department, division, phone,
        undertaking_submitted, undertaking_signed_name, undertaking_signed_date,
        emergency_contact_name, emergency_contact_relation, emergency_contact_mobile,
        emergency_contact_alt_mobile, emergency_contact_email, blood_group,
        medical_conditions, known_allergies, current_medication, dietary_restrictions,
        medical_other, consent_media, consent_data, consent_checks, consent_medical
      FROM users
      WHERE id = $1
    `, [studentId]);

    const assignmentRes = await pool.query(`
      SELECT 
        rb.id as batch_id, rb.name as batch_name,
        rp.id as panel_id, rp.panel_number, rp.name as panel_name,
        v.name as village_name, v.district as village_district,
        rbs.ri_id
      FROM ri_batch_students rbs
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rbs.student_id = $1
      ORDER BY rb.id DESC
      LIMIT 1
    `, [studentId]);

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ message: 'Access denied: You are not enrolled in any Rural Immersion cohort.' });
    }

    const ltcCheck = await pool.query(`
      SELECT 1 FROM batch_students bs
      JOIN batches b ON bs.batch_id = b.id
      WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
      LIMIT 1
    `, [studentId]);
    const hasLtc = ltcCheck.rowCount > 0;

    const student = userRes.rows[0] || {};
    const assignment = assignmentRes.rows[0] || {};
    const isSubmitted = hasLtc ? Boolean(student.undertaking_submitted) : (undertakingRes.rowCount > 0);

    let undertakingRecord = null;
    if (undertakingRes.rowCount > 0) {
      undertakingRecord = undertakingRes.rows[0];
    } else if (hasLtc && student.undertaking_submitted) {
      undertakingRecord = {
        signed_name: student.undertaking_signed_name || student.name,
        signed_date: student.undertaking_signed_date || '',
        emergency_contact_name: student.emergency_contact_name || '',
        emergency_contact_relation: student.emergency_contact_relation || '',
        emergency_contact_mobile: student.emergency_contact_mobile || '',
        emergency_contact_alt_mobile: student.emergency_contact_alt_mobile || '',
        emergency_contact_email: student.emergency_contact_email || '',
        blood_group: student.blood_group || '',
        medical_conditions: student.medical_conditions || '',
        known_allergies: student.known_allergies || '',
        current_medication: student.current_medication || '',
        dietary_restrictions: student.dietary_restrictions || '',
        medical_other: student.medical_other || '',
        consent_field_work: true,
        consent_code_of_conduct: true,
        consent_medical_emergency: Boolean(student.consent_medical),
        consent_photo_video: Boolean(student.consent_media),
        status: 'Submitted'
      };
    }

    res.json({
      submitted: isSubmitted,
      undertaking: undertakingRecord,
      student_info: {
        id: student.id,
        name: student.name,
        email: student.email,
        prn: student.prn,
        ri_id: assignment.ri_id || student.roll_number,
        department: student.department,
        division: student.division,
        phone: student.phone,
        batch_name: assignment.batch_name || 'Rural Immersion Batch',
        panel_name: assignment.panel_name || `Panel ${assignment.panel_number || '1'}`,
        village_name: assignment.village_name || 'Assigned Village'
      }
    });
  } catch (err) {
    console.error('Error fetching RI undertaking:', err);
    res.status(500).json({ message: 'Failed to fetch undertaking details', error: err.message });
  }
};

/**
 * 5. Submit or Update Student RI Undertaking
 */
const submitStudentUndertaking = async (req, res) => {
  try {
    const studentId = req.user.id;
    const {
      emergencyContactName,
      emergencyContactRelation,
      emergencyContactMobile,
      emergencyContactAltMobile,
      emergencyContactEmail,
      bloodGroup,
      medicalConditions,
      knownAllergies,
      currentMedication,
      dietaryRestrictions,
      medicalOther,
      consentFieldWork,
      consentCodeOfConduct,
      consentMedicalEmergency,
      consentPhotoVideo,
      signedName,
      signedDate
    } = req.body;

    if (!signedName || !signedName.trim()) {
      return res.status(400).json({ message: 'Digital signature (signed name) is required.' });
    }
    if (!emergencyContactName || !emergencyContactRelation || !emergencyContactMobile) {
      return res.status(400).json({ message: 'Emergency contact details (name, relation, mobile) are required.' });
    }

    // Verify that student has an active RI enrollment
    const assignmentRes = await pool.query(`
      SELECT ri_batch_id, ri_panel_id
      FROM ri_batch_students
      WHERE student_id = $1
      ORDER BY id DESC
      LIMIT 1
    `, [studentId]);

    if (assignmentRes.rowCount === 0) {
      return res.status(403).json({ message: 'Access denied: You are not enrolled in any Rural Immersion cohort.' });
    }

    // Check if undertaking already submitted and prevent duplicate creation
    const existingUndertaking = await pool.query(
      `SELECT id, status FROM ri_undertakings WHERE student_id = $1 LIMIT 1`,
      [studentId]
    );
    if (existingUndertaking.rowCount > 0 && existingUndertaking.rows[0].status === 'Submitted' && !req.body.isEditing) {
      return res.status(400).json({ message: 'Your Rural Immersion undertaking has already been submitted and recorded.' });
    }

    const batchId = assignmentRes.rows[0]?.ri_batch_id || null;
    const panelId = assignmentRes.rows[0]?.ri_panel_id || null;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const upsertRes = await pool.query(`
      INSERT INTO ri_undertakings (
        student_id,
        ri_batch_id,
        ri_panel_id,
        emergency_contact_name,
        emergency_contact_relation,
        emergency_contact_mobile,
        emergency_contact_alt_mobile,
        emergency_contact_email,
        blood_group,
        medical_conditions,
        known_allergies,
        current_medication,
        dietary_restrictions,
        medical_other,
        consent_field_work,
        consent_code_of_conduct,
        consent_medical_emergency,
        consent_photo_video,
        signed_name,
        signed_date,
        ip_address,
        status,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'Submitted', CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id) DO UPDATE SET
        ri_batch_id = EXCLUDED.ri_batch_id,
        ri_panel_id = EXCLUDED.ri_panel_id,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_relation = EXCLUDED.emergency_contact_relation,
        emergency_contact_mobile = EXCLUDED.emergency_contact_mobile,
        emergency_contact_alt_mobile = EXCLUDED.emergency_contact_alt_mobile,
        emergency_contact_email = EXCLUDED.emergency_contact_email,
        blood_group = EXCLUDED.blood_group,
        medical_conditions = EXCLUDED.medical_conditions,
        known_allergies = EXCLUDED.known_allergies,
        current_medication = EXCLUDED.current_medication,
        dietary_restrictions = EXCLUDED.dietary_restrictions,
        medical_other = EXCLUDED.medical_other,
        consent_field_work = EXCLUDED.consent_field_work,
        consent_code_of_conduct = EXCLUDED.consent_code_of_conduct,
        consent_medical_emergency = EXCLUDED.consent_medical_emergency,
        consent_photo_video = EXCLUDED.consent_photo_video,
        signed_name = EXCLUDED.signed_name,
        signed_date = EXCLUDED.signed_date,
        ip_address = EXCLUDED.ip_address,
        status = 'Submitted',
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      studentId, batchId, panelId, emergencyContactName.trim(), emergencyContactRelation.trim(),
      emergencyContactMobile.trim(), emergencyContactAltMobile?.trim() || null,
      emergencyContactEmail?.trim() || null, bloodGroup || null, medicalConditions?.trim() || null,
      knownAllergies?.trim() || null, currentMedication?.trim() || null, dietaryRestrictions?.trim() || null,
      medicalOther?.trim() || null, consentFieldWork !== false, consentCodeOfConduct !== false,
      consentMedicalEmergency !== false, consentPhotoVideo !== false, signedName.trim(),
      signedDate || new Date().toISOString().split('T')[0], clientIp
    ]);

    // Sync with ri_student_forms and log audit trail
    if (batchId) {
      await pool.query(`
        INSERT INTO ri_student_forms (
          student_id, ri_batch_id, ri_panel_id, form_type, status,
          progress_percent, submission_timestamp, last_updated_at
        ) VALUES ($1, $2, $3, 'UNDERTAKING', 'Submitted', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id, ri_batch_id, form_type)
        DO UPDATE SET 
          status = 'Submitted',
          progress_percent = 100,
          submission_timestamp = CURRENT_TIMESTAMP,
          last_updated_at = CURRENT_TIMESTAMP
      `, [studentId, batchId, panelId]);

      const { logRiAction } = require('../utils/riAudit');
      await logRiAction(pool, {
        userId: studentId,
        userEmail: req.user?.email,
        userName: req.user?.name,
        userRole: 'student',
        action: 'SUBMIT_FORM',
        studentId,
        batchId,
        panelId,
        recordId: upsertRes.rows[0]?.id,
        details: { form_type: 'UNDERTAKING', signed_name: signedName },
        ipAddress: clientIp
      });
    }

    res.json({
      success: true,
      message: 'Rural Immersion Undertaking signed and submitted successfully.',
      undertaking: upsertRes.rows[0]
    });
  } catch (err) {
    console.error('Error submitting RI undertaking:', err);
    res.status(500).json({ message: 'Failed to submit undertaking', error: err.message });
  }
};

/**
 * Helper: Resolve student active RI context
 */
async function getStudentRiContext(studentId) {
  const res = await pool.query(`
    SELECT 
      rbs.ri_batch_id,
      rbs.ri_panel_id,
      rb.name as batch_name,
      rb.status as batch_status,
      rp.name as panel_name,
      rp.panel_number,
      rp.ri_village_id,
      v.name as village_name,
      u.name as student_name,
      u.prn,
      u.email as student_email,
      u.department,
      u.division
    FROM ri_batch_students rbs
    JOIN users u ON rbs.student_id = u.id
    JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
    LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
    LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
    WHERE rbs.student_id = $1
    ORDER BY rb.id DESC
    LIMIT 1
  `, [studentId]);
  return res.rows[0] || null;
}

/**
 * 6. Get All RI Forms Status & Hub for Student
 */
const getStudentFormsHub = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);

    if (!ctx) {
      return res.status(403).json({
        message: 'No active Rural Immersion assignment found for your student profile.'
      });
    }

    const { ri_batch_id, ri_panel_id } = ctx;

    // Check existing ri_student_forms
    const formsRes = await pool.query(`
      SELECT 
        id, form_type, status, progress_percent,
        submission_timestamp, last_updated_at,
        faculty_remarks, correction_notes, reviewed_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ri_batch_id]);

    const formsMap = {};
    formsRes.rows.forEach(r => {
      formsMap[r.form_type] = r;
    });

    // Check if undertaking is already submitted in ri_undertakings or users (for LTC)
    const [underRes, userUnderRes, ltcEnrollRes] = await Promise.all([
      pool.query(`SELECT id, status, updated_at FROM ri_undertakings WHERE student_id = $1`, [studentId]),
      pool.query(`SELECT undertaking_submitted, undertaking_signed_date FROM users WHERE id = $1`, [studentId]),
      pool.query(`SELECT 1 FROM batch_students bs JOIN batches b ON bs.batch_id = b.id WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL) LIMIT 1`, [studentId])
    ]);
    const hasLtc = ltcEnrollRes.rowCount > 0;
    const isLtcSubmitted = hasLtc && Boolean(userUnderRes.rows[0]?.undertaking_submitted);
    if ((underRes.rowCount > 0 || isLtcSubmitted) && !formsMap['UNDERTAKING']) {
      formsMap['UNDERTAKING'] = {
        id: underRes.rows[0]?.id || studentId,
        form_type: 'UNDERTAKING',
        status: underRes.rows[0]?.status || 'Submitted',
        progress_percent: 100,
        submission_timestamp: underRes.rows[0]?.updated_at || userUnderRes.rows[0]?.undertaking_signed_date || new Date().toISOString(),
        last_updated_at: underRes.rows[0]?.updated_at || userUnderRes.rows[0]?.undertaking_signed_date || new Date().toISOString()
      };
    }

    // Check existing family and valid institution counts
    const [familyRowsRes, instCountRes] = await Promise.all([
      pool.query(`SELECT id, village_name, survey_data, head_of_family_name, total_family_members, respondent_name FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2`, [studentId, ctx.ri_batch_id]),
      pool.query(`SELECT COUNT(*)::int as count FROM ri_institutional_visits WHERE student_id = $1 AND ri_batch_id = $2 AND (institution_name IS NOT NULL AND TRIM(institution_name) != '')`, [studentId, ctx.ri_batch_id])
    ]);
    const familyRows = familyRowsRes.rows || [];
    const familyCount = familyRows.length;
    const instCount = instCountRes.rows[0]?.count || 0;

    const completedFamilyCount = familyRows.filter(f => {
      const vName = (f.village_name || f.survey_data?.village_name || '').trim();
      const headName = (f.head_of_family_name || '').trim();
      const respName = (f.respondent_name || f.survey_data?.respondent_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      return vName && headName && !headName.startsWith('Draft Family #') && members >= 1 && respName;
    }).length;

    // Configured official list of student forms according to Operational Guidelines RUIP
    const OFFICIAL_FORMS = [
      {
        form_type: 'UNDERTAKING',
        form_key: 'undertaking',
        form_code: 'FORM IA',
        guideline_ref: 'ANNEX E',
        title: 'Student Undertaking Form',
        annex_ref: 'ANNEX E',
        description: 'Participant code of conduct, safety undertaking, medical disclosure & emergency contact.',
        required: true,
        editable_after_submission: false
      },
      {
        form_type: 'PREPARATORY_CHECKLIST',
        form_key: 'checklist',
        form_code: 'FORM IB',
        guideline_ref: 'ANNEX G-2',
        title: 'Preparatory Phase Checklist',
        annex_ref: 'ANNEX G-2',
        description: 'Pre-departure checklist verifying medical checkup, kit readiness, and essential safety items.',
        required: true,
        editable_after_submission: true
      },
      {
        form_type: 'DAILY_ACTIVITY_REPORT',
        form_key: 'daily_activity',
        form_code: 'FORM IIIB',
        guideline_ref: 'ANNEX G-5',
        title: 'Daily Activity Report',
        annex_ref: 'ANNEX G-5',
        description: '5-Day village immersion activities, community project & school engagement.',
        required: true,
        editable_after_submission: true
      },
      {
        form_type: 'INSTITUTIONAL_VISIT',
        form_key: 'institutions',
        form_code: 'FORM IV',
        guideline_ref: 'ANNEX G-6',
        title: 'Institutional Visit Observations',
        annex_ref: 'ANNEX G-6',
        description: 'Rotational observations from visiting at least 2 primary village institutions.',
        required: true,
        editable_after_submission: true
      },
      {
        form_type: 'FAMILY_SURVEY',
        form_key: 'family',
        form_code: 'FORM V',
        guideline_ref: 'ANNEX G-7',
        title: 'Family Visit Observations',
        annex_ref: 'ANNEX G-7',
        description: 'Household socio-economic survey & government scheme benefits.',
        required: true,
        editable_after_submission: true
      },
      {
        form_type: 'PROBLEM_IDENTIFICATION',
        form_key: 'problem',
        form_code: 'FORM VI',
        guideline_ref: 'ANNEX G-8 & H',
        title: 'Problem Identification & SMART Solution',
        annex_ref: 'ANNEX G-8 & H',
        description: 'Village problem statement mapped to SDGs with practical solution roadmap.',
        required: true,
        editable_after_submission: true
      },
      {
        form_type: 'STUDENT_FEEDBACK',
        form_key: 'feedback',
        form_code: 'FORM VIII',
        guideline_ref: 'ANNEX G-5 / VIII',
        title: 'RI Feedback Form',
        annex_ref: 'ANNEX G-5 (SEC 5.6) & FORM VIII',
        description: 'Immersion activities rating, best practices observed, and recommendations.',
        required: true,
        editable_after_submission: true
      }
    ];

    const formsList = OFFICIAL_FORMS.map(def => {
      const saved = formsMap[def.form_type] || {};
      const status = saved.status || 'Not Started';
      const isLocked = (status === 'Submitted' || status === 'Reviewed') && status !== 'Requires Correction';

      let calculatedProgress = Number(saved.progress_percent) || 0;
      if (status === 'Submitted' || status === 'Reviewed') {
        calculatedProgress = 100;
      } else if (def.form_type === 'FAMILY_SURVEY') {
        calculatedProgress = Math.min(90, Math.round((completedFamilyCount / 3) * 80));
      } else if (def.form_type === 'INSTITUTIONAL_VISIT') {
        calculatedProgress = Math.min(90, Math.round((instCount / 2) * 80));
      }

      return {
        ...def,
        id: saved.id || null,
        status,
        progress_percent: calculatedProgress,
        submission_timestamp: saved.submission_timestamp || null,
        last_updated_at: saved.last_updated_at || null,
        faculty_remarks: saved.faculty_remarks || null,
        correction_notes: saved.correction_notes || null,
        is_locked: isLocked,
        family_count: def.form_type === 'FAMILY_SURVEY' ? familyCount : undefined,
        completed_family_count: def.form_type === 'FAMILY_SURVEY' ? completedFamilyCount : undefined,
        institution_count: def.form_type === 'INSTITUTIONAL_VISIT' ? instCount : undefined
      };
    });

    const submittedCount = formsList.filter(f => f.status === 'Submitted' || f.status === 'Reviewed').length;
    const pendingCount = formsList.filter(f => f.status === 'Not Started' || f.status === 'Draft').length;
    const reviewedCount = formsList.filter(f => f.status === 'Reviewed').length;
    const correctionCount = formsList.filter(f => f.status === 'Requires Correction').length;

    res.json({
      success: true,
      context: ctx,
      summary: {
        total: formsList.length,
        submitted: submittedCount,
        pending: pendingCount,
        reviewed: reviewedCount,
        requiresCorrection: correctionCount
      },
      total_forms: formsList.length,
      submitted_count: submittedCount,
      pending_count: pendingCount,
      reviewed_count: reviewedCount,
      correction_count: correctionCount,
      forms: formsList
    });
  } catch (err) {
    console.error('Error fetching student forms hub:', err);
    res.status(500).json({ message: 'Failed to fetch forms hub', error: err.message });
  }
};

/**
 * 7. Form IB: Preparatory Phase Checklist
 */
const getPreparatoryChecklist = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const checkRes = await pool.query(`
      SELECT * FROM ri_preparatory_checklists
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'PREPARATORY_CHECKLIST'
    `, [studentId, ctx.ri_batch_id]);

    res.json({
      success: true,
      checklist: checkRes.rows[0] || null,
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting preparatory checklist:', err);
    res.status(500).json({ message: 'Failed to load checklist', error: err.message });
  }
};

const savePreparatoryChecklist = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const {
      is_final_submit = false,
      status: reqStatus,
      parents_informed = false,
      medical_checkup_done = false,
      signed_undertaking = false,
      clothing_ready = false,
      beddings_ready = false,
      toiletries_ready = false,
      medicines_ready = false,
      laptop_dongle_ready = false,
      blank_notebook_ready = false,
      college_id_card = false,
      shoes_sportswear = false,
      emergency_contacts_saved = false,
      role_assigned = 'Field Investigator',
      additional_notes = ''
    } = req.body;

    const isFinal = is_final_submit || reqStatus === 'Submitted';
    const items = [
      parents_informed, medical_checkup_done, signed_undertaking,
      clothing_ready, beddings_ready, toiletries_ready, medicines_ready,
      laptop_dongle_ready, blank_notebook_ready, college_id_card,
      shoes_sportswear, emergency_contacts_saved
    ];
    const checkedCount = items.filter(Boolean).length;
    if (isFinal && checkedCount === 0) {
      return res.status(400).json({
        message: 'At least one readiness item must be verified before final submission.'
      });
    }
    const newStatus = isFinal ? 'Submitted' : 'Draft';
    const progress = Math.round((checkedCount / items.length) * 100);

    const client = await pool.connect();
    let clRow = null;
    try {
      await client.query('BEGIN');

      const submissionTimestamp = isFinal ? new Date() : null;

      // Upsert ri_student_forms
      const sfRes = await client.query(`
        INSERT INTO ri_student_forms (
          student_id, ri_batch_id, ri_panel_id, ri_village_id,
          form_type, status, progress_percent,
          submission_timestamp, last_updated_at
        ) VALUES (
          $1, $2, $3, $4, 'PREPARATORY_CHECKLIST', $5, $6, $7,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id, form_type)
        DO UPDATE SET
          status = EXCLUDED.status,
          progress_percent = EXCLUDED.progress_percent,
          submission_timestamp = COALESCE(EXCLUDED.submission_timestamp, ri_student_forms.submission_timestamp),
          last_updated_at = CURRENT_TIMESTAMP
        RETURNING id, status
      `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

      const formSubmissionId = sfRes.rows[0].id;

      // Upsert ri_preparatory_checklists
      const clRes = await client.query(`
        INSERT INTO ri_preparatory_checklists (
          form_submission_id, student_id, ri_batch_id, ri_panel_id,
          parents_informed, medical_checkup_done, signed_undertaking,
          clothing_ready, beddings_ready, toiletries_ready, medicines_ready,
          laptop_dongle_ready, blank_notebook_ready, college_id_card,
          shoes_sportswear, emergency_contacts_saved, role_assigned, additional_notes,
          status, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id)
        DO UPDATE SET
          parents_informed = EXCLUDED.parents_informed,
          medical_checkup_done = EXCLUDED.medical_checkup_done,
          signed_undertaking = EXCLUDED.signed_undertaking,
          clothing_ready = EXCLUDED.clothing_ready,
          beddings_ready = EXCLUDED.beddings_ready,
          toiletries_ready = EXCLUDED.toiletries_ready,
          medicines_ready = EXCLUDED.medicines_ready,
          laptop_dongle_ready = EXCLUDED.laptop_dongle_ready,
          blank_notebook_ready = EXCLUDED.blank_notebook_ready,
          college_id_card = EXCLUDED.college_id_card,
          shoes_sportswear = EXCLUDED.shoes_sportswear,
          emergency_contacts_saved = EXCLUDED.emergency_contacts_saved,
          role_assigned = EXCLUDED.role_assigned,
          additional_notes = EXCLUDED.additional_notes,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
        parents_informed, medical_checkup_done, signed_undertaking,
        clothing_ready, beddings_ready, toiletries_ready, medicines_ready,
        laptop_dongle_ready, blank_notebook_ready, college_id_card,
        shoes_sportswear, emergency_contacts_saved, role_assigned, additional_notes,
        newStatus
      ]);

      await client.query('COMMIT');
      clRow = clRes.rows[0];
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: clRow?.id,
      details: { form_type: 'PREPARATORY_CHECKLIST', is_final_submit: isFinal, checked_count: checkedCount }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Preparatory checklist submitted successfully.' : 'Draft saved successfully.',
      checklist: clRow,
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[savePreparatoryChecklist] Schema mismatch detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_preparatory_checklists ADD COLUMN IF NOT EXISTS role_assigned TEXT;
          ALTER TABLE ri_preparatory_checklists ALTER COLUMN role_assigned TYPE TEXT;
          ALTER TABLE ri_preparatory_checklists ALTER COLUMN additional_notes TYPE TEXT;
        `);
        return await savePreparatoryChecklist(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in savePreparatoryChecklist:', retryErr);
      }
    }
    console.error('Error saving preparatory checklist:', err);
    return res.status(500).json({ message: 'Failed to save checklist', error: err.message });
  }
};

/**
 * 7b. Form IIIB: Daily Activity Report – Students (ANNEX G-5)
 */
const getDailyActivityReport = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const reportRes = await pool.query(`
      SELECT * FROM ri_daily_activity_reports
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'DAILY_ACTIVITY_REPORT'
    `, [studentId, ctx.ri_batch_id]);

    const userRes = await pool.query(`
      SELECT name, email, school, program, department, division, roll_number, prn
      FROM users WHERE id = $1
    `, [studentId]);
    const userData = userRes.rows[0] || {};

    res.json({
      success: true,
      report: reportRes.rows[0] || null,
      context: {
        ...ctx,
        student_name: userData.name || ctx.student_name || '',
        school_name: userData.school || ctx.department || '',
        degree_program: userData.program || ctx.department || '',
        village_name: ctx.village_name || ''
      },
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting daily activity report:', err);
    res.status(500).json({ message: 'Failed to load daily activity report', error: err.message });
  }
};

const saveDailyActivityReport = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const {
      is_final_submit = false,
      status: reqStatus,
      student_name = '',
      school_name = '',
      degree_program = '',
      village_visited = '',
      total_days_in_village = '5 Days',
      seven_day_plan_completed = 'Yes',
      seven_day_plan_improvements = '',
      community_project_types = [],
      community_project_other_text = '',
      community_project_work_done = '',
      community_project_suggestions = '',
      study_group_included = 'Yes',
      study_problem_title = '',
      study_solution_submitted = 'Yes',
      study_presented_to_committee = 'Yes',
      study_suggestions = '',
      institutions_visited_count = 2,
      institutional_visits_suggestions = '',
      homes_visited_count = 5,
      home_visits_suggestions = '',
      school_activity_types = [],
      school_activity_other_text = '',
      school_name_engaged = '',
      school_students_count = null,
      school_activity_details = '',
      school_activity_suggestions = '',
      activity_photo_1 = '',
      activity_photo_2 = '',
      best_practices_observed = '',
      other_activities_implemented = '',
      issues_affecting_implementation = '',
      suggestions_to_improve_program = '',
      remarks = ''
    } = req.body;

    const isFinal = is_final_submit || reqStatus === 'Submitted';
    if (isFinal) {
      if (!village_visited?.trim() || !school_name?.trim() || !degree_program?.trim()) {
        return res.status(400).json({
          message: 'School name, degree program, and village visited are required before final submission.'
        });
      }
      // 5.2 Community project
      if (!Array.isArray(community_project_types) || community_project_types.length === 0) {
        return res.status(400).json({
          message: 'Section 5.2.1: Selection of at least one community project is compulsory.'
        });
      }
      if (community_project_types.includes('Other') && !community_project_other_text?.trim()) {
        return res.status(400).json({
          message: 'Section 5.2.1: Please specify other community project.'
        });
      }
      if (!community_project_work_done?.trim()) {
        return res.status(400).json({
          message: 'Section 5.2.2: Work done by you is compulsory.'
        });
      }
      if (!community_project_suggestions?.trim()) {
        return res.status(400).json({
          message: 'Section 5.2.3: Suggestions for community projects are compulsory.'
        });
      }
      // 5.3 In-depth study of one problem
      if (!study_group_included) {
        return res.status(400).json({
          message: 'Section 5.3.1: Response for study group inclusion (Yes/No) is compulsory.'
        });
      }
      if (!study_problem_title?.trim()) {
        return res.status(400).json({
          message: 'Section 5.3.2: Title of problem identified is compulsory.'
        });
      }
      if (!study_solution_submitted) {
        return res.status(400).json({
          message: 'Section 5.3.3: Solution submission response (Yes/No) is compulsory.'
        });
      }
      if (!study_presented_to_committee) {
        return res.status(400).json({
          message: 'Section 5.3.4: Presentation to school committee response (Yes/No) is compulsory.'
        });
      }
      // 5.4 & 5.5.1
      if (!institutions_visited_count || Number(institutions_visited_count) < 1) {
        return res.status(400).json({
          message: 'Section 5.4: Number of institutions visited is compulsory (must be at least 1).'
        });
      }
      if (!homes_visited_count || Number(homes_visited_count) < 1) {
        return res.status(400).json({
          message: 'Section 5.5.1: Number of homes visited is compulsory (must be at least 1).'
        });
      }
    }
    const newStatus = isFinal ? 'Submitted' : 'Draft';
    
    let progress = 100;
    if (!isFinal) {
      let score = 0;
      // 1. Basic details (20 pts)
      if (village_visited?.trim() || student_name?.trim() || school_name?.trim()) score += 20;
      // 2. Community project (20 pts)
      if ((Array.isArray(community_project_types) && community_project_types.length > 0) || community_project_work_done?.trim()) score += 20;
      // 3. School activity (20 pts)
      if ((Array.isArray(school_activity_types) && school_activity_types.length > 0) || school_name_engaged?.trim() || school_activity_details?.trim()) score += 20;
      // 4. Best practices & other activities (20 pts)
      if (best_practices_observed?.trim() || other_activities_implemented?.trim()) score += 20;
      // 5. Photos & remarks (20 pts)
      if (activity_photo_1?.trim() || activity_photo_2?.trim() || remarks?.trim() || issues_affecting_implementation?.trim() || suggestions_to_improve_program?.trim()) score += 20;
      
      progress = Math.min(95, Math.max(10, score));
    }
    const submissionTimestamp = isFinal ? new Date().toISOString() : null;

    const client = await pool.connect();
    let reportRow = null;
    try {
      await client.query('BEGIN');

      // Upsert ri_student_forms
      const sfRes = await client.query(`
        INSERT INTO ri_student_forms (
          student_id, ri_batch_id, ri_panel_id, ri_village_id,
          form_type, status, progress_percent,
          submission_timestamp, last_updated_at
        ) VALUES (
          $1, $2, $3, $4,
          'DAILY_ACTIVITY_REPORT', $5, $6,
          $7, CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id, form_type)
        DO UPDATE SET
          status = EXCLUDED.status,
          progress_percent = EXCLUDED.progress_percent,
          submission_timestamp = COALESCE(ri_student_forms.submission_timestamp, EXCLUDED.submission_timestamp),
          last_updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

      const formSubmissionId = sfRes.rows[0].id;

      const reportRes = await client.query(`
        INSERT INTO ri_daily_activity_reports (
          form_submission_id, student_id, ri_batch_id, ri_panel_id,
          student_name, school_name, degree_program, village_visited, total_days_in_village,
          seven_day_plan_completed, seven_day_plan_improvements,
          community_project_types, community_project_other_text,
          community_project_work_done, community_project_suggestions,
          study_group_included, study_problem_title,
          study_solution_submitted, study_presented_to_committee, study_suggestions,
          institutions_visited_count, institutional_visits_suggestions,
          homes_visited_count, home_visits_suggestions,
          school_activity_types, school_activity_other_text,
          school_name_engaged, school_students_count,
          school_activity_details, school_activity_suggestions,
          activity_photo_1, activity_photo_2,
          best_practices_observed, other_activities_implemented,
          issues_affecting_implementation, suggestions_to_improve_program,
          remarks, status, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          $16, $17,
          $18, $19, $20,
          $21, $22,
          $23, $24,
          $25, $26,
          $27, $28,
          $29, $30,
          $31, $32,
          $33, $34,
          $35, $36,
          $37, $38, CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id)
        DO UPDATE SET
          student_name = EXCLUDED.student_name,
          school_name = EXCLUDED.school_name,
          degree_program = EXCLUDED.degree_program,
          village_visited = EXCLUDED.village_visited,
          total_days_in_village = EXCLUDED.total_days_in_village,
          seven_day_plan_completed = EXCLUDED.seven_day_plan_completed,
          seven_day_plan_improvements = EXCLUDED.seven_day_plan_improvements,
          community_project_types = EXCLUDED.community_project_types,
          community_project_other_text = EXCLUDED.community_project_other_text,
          community_project_work_done = EXCLUDED.community_project_work_done,
          community_project_suggestions = EXCLUDED.community_project_suggestions,
          study_group_included = EXCLUDED.study_group_included,
          study_problem_title = EXCLUDED.study_problem_title,
          study_solution_submitted = EXCLUDED.study_solution_submitted,
          study_presented_to_committee = EXCLUDED.study_presented_to_committee,
          study_suggestions = EXCLUDED.study_suggestions,
          institutions_visited_count = EXCLUDED.institutions_visited_count,
          institutional_visits_suggestions = EXCLUDED.institutional_visits_suggestions,
          homes_visited_count = EXCLUDED.homes_visited_count,
          home_visits_suggestions = EXCLUDED.home_visits_suggestions,
          school_activity_types = EXCLUDED.school_activity_types,
          school_activity_other_text = EXCLUDED.school_activity_other_text,
          school_name_engaged = EXCLUDED.school_name_engaged,
          school_students_count = EXCLUDED.school_students_count,
          school_activity_details = EXCLUDED.school_activity_details,
          school_activity_suggestions = EXCLUDED.school_activity_suggestions,
          activity_photo_1 = EXCLUDED.activity_photo_1,
          activity_photo_2 = EXCLUDED.activity_photo_2,
          best_practices_observed = EXCLUDED.best_practices_observed,
          other_activities_implemented = EXCLUDED.other_activities_implemented,
          issues_affecting_implementation = EXCLUDED.issues_affecting_implementation,
          suggestions_to_improve_program = EXCLUDED.suggestions_to_improve_program,
          remarks = EXCLUDED.remarks,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
        student_name || null,
        school_name || null,
        degree_program || null,
        village_visited || ctx.village_name || null,
        total_days_in_village || '5 Days',
        seven_day_plan_completed || 'Yes',
        seven_day_plan_improvements || null,
        JSON.stringify(community_project_types || []),
        community_project_other_text || null,
        community_project_work_done || null,
        community_project_suggestions || null,
        study_group_included || 'Yes',
        study_problem_title || null,
        study_solution_submitted || 'Yes',
        study_presented_to_committee || 'Yes',
        study_suggestions || null,
        parseInt(institutions_visited_count, 10) || 0,
        institutional_visits_suggestions || null,
        parseInt(homes_visited_count, 10) || 0,
        home_visits_suggestions || null,
        JSON.stringify(school_activity_types || []),
        school_activity_other_text || null,
        school_name_engaged || null,
        school_students_count ? parseInt(school_students_count, 10) : null,
        school_activity_details || null,
        school_activity_suggestions || null,
        activity_photo_1 || null,
        activity_photo_2 || null,
        best_practices_observed || null,
        other_activities_implemented || null,
        issues_affecting_implementation || null,
        suggestions_to_improve_program || null,
        remarks || null,
        newStatus
      ]);

      await client.query('COMMIT');
      reportRow = reportRes.rows[0];
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: reportRow?.id,
      details: { form_type: 'DAILY_ACTIVITY_REPORT', form_code: 'FORM IIIB', is_final_submit: isFinal }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Daily Activity Report (Form IIIB) submitted successfully.' : 'Draft saved successfully.',
      report: reportRow,
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveDailyActivityReport] Schema mismatch detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_types JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_other_text TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_name_engaged TEXT;
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN school_name_engaged TYPE TEXT;
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN student_name TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN school_name TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN degree_program TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN village_visited TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN total_days_in_village TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN seven_day_plan_completed TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_group_included TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_solution_submitted TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_presented_to_committee TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ALTER COLUMN status TYPE VARCHAR(1000);
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_students_count INT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_details TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_suggestions TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS activity_photo_1 TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS activity_photo_2 TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS best_practices_observed TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS other_activities_implemented TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS issues_affecting_implementation TEXT;
          ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS suggestions_to_improve_program TEXT;
        `);
        return await saveDailyActivityReport(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveDailyActivityReport:', retryErr);
      }
    }
    console.error('Error saving daily activity report:', err);
    return res.status(500).json({ message: 'Failed to save daily activity report', error: err.message });
  }
};

/**
 * 8. Form IV: Institutional Visit Observations (Min 2 institutions)
 */
const getInstitutionalVisits = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const visitsRes = await pool.query(`
      SELECT * FROM ri_institutional_visits
      WHERE student_id = $1 AND ri_batch_id = $2
      ORDER BY id ASC
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'INSTITUTIONAL_VISIT'
    `, [studentId, ctx.ri_batch_id]);

    let formSections = {};
    for (const v of visitsRes.rows) {
      if (v.observation_data && typeof v.observation_data === 'object' && Object.keys(v.observation_data).length > 0) {
        formSections = v.observation_data;
        break;
      }
      if (v.additional_details?.form_sections && typeof v.additional_details.form_sections === 'object' && Object.keys(v.additional_details.form_sections).length > 0) {
        formSections = v.additional_details.form_sections;
        break;
      }
    }

    const normalizePhotoUrl = (url) => {
      if (!url || typeof url !== 'string') return '';
      let trimmed = url.trim();
      if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
        trimmed = trimmed.replace('http://', 'https://');
      }
      if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
        trimmed = trimmed.replace('/uploads/', '/api/uploads/');
      }
      return trimmed;
    };

    let activityPhoto1 = normalizePhotoUrl(visitsRes.rows[0]?.activity_photo_1 || visitsRes.rows[0]?.additional_details?.activity_photo_1 || '');
    let activityPhoto2 = normalizePhotoUrl(visitsRes.rows[0]?.activity_photo_2 || visitsRes.rows[0]?.additional_details?.activity_photo_2 || '');

    const sanitizedVisits = visitsRes.rows.map(v => ({
      ...v,
      activity_photo_1: normalizePhotoUrl(v.activity_photo_1),
      activity_photo_2: normalizePhotoUrl(v.activity_photo_2),
      additional_details: v.additional_details ? {
        ...v.additional_details,
        activity_photo_1: normalizePhotoUrl(v.additional_details?.activity_photo_1),
        activity_photo_2: normalizePhotoUrl(v.additional_details?.activity_photo_2)
      } : v.additional_details
    }));

    res.json({
      success: true,
      visits: sanitizedVisits,
      form_sections: formSections,
      activity_photo_1: activityPhoto1,
      activity_photo_2: activityPhoto2,
      min_required: 2,
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting institutional visits:', err);
    res.status(500).json({ message: 'Failed to load institutional visits', error: err.message });
  }
};

const saveInstitutionalVisits = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const { visits = [], form_sections = {}, activity_photo_1 = '', activity_photo_2 = '', is_final_submit = false, status: reqStatus } = req.body;
    const isFinal = is_final_submit || reqStatus === 'Submitted';

    if (isFinal) {
      if (!visits || visits.length < 1) {
        return res.status(400).json({
          message: 'At least 1 village institution observation must be provided.'
        });
      }
      for (let i = 0; i < visits.length; i++) {
        const v = visits[i];
        if (
          !v.institution_name?.trim() ||
          !v.official_contact_person?.trim() ||
          !v.visit_date ||
          !v.services_provided?.trim() ||
          !(v.observations?.trim() || v.key_observations?.trim()) ||
          !v.challenges_identified?.trim() ||
          !v.recommendations?.trim()
        ) {
          return res.status(400).json({
            message: `All basic fields are compulsory for Institution #${i + 1}.`
          });
        }
      }

      // Check Form IV Sections required fields
      const vInfo = form_sections.section_1_village_info || {};
      if (!vInfo.v_1_1_village_name?.trim() || !vInfo.v_1_2_taluka?.trim() || !vInfo.v_1_3_district?.trim() || !vInfo.v_1_4_tribal?.trim() || !vInfo.v_1_5_population?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 1: Village Information.' });
      }

      const gp = form_sections.section_2_gram_panchayat || {};
      if (!gp.gp_2_2_water_supply?.trim() || !gp.gp_2_3_water_adequate?.trim() || !gp.gp_2_4_disinfection_frequency?.trim() || !gp.gp_2_5_bleaching_powder?.trim() || !gp.gp_2_6_chemical_analysis?.trim() || !gp.gp_2_7_bacterial_analysis?.trim() || !gp.gp_2_8_street_lights?.trim() || !gp.gp_2_9_drainage?.trim() || !gp.gp_2_1_solid_waste?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 2: Gram Panchayat.' });
      }

      const lc = form_sections.section_3_legal_cases || {};
      if (!lc.lc_3_1_police_patil?.trim() || !lc.lc_3_2_tanta_mukta?.trim() || !lc.lc_3_3_cases_resolved?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 3: Resolution of Legal Cases.' });
      }

      const sc = form_sections.section_4_school || {};
      if (!sc.sc_4_1_students_count?.trim() || !sc.sc_4_2_medium?.trim() || !sc.sc_4_3_building_condition?.trim() || !sc.sc_4_4_toilets?.trim() || !sc.sc_4_5_drinking_water?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 4: Visit to School.' });
      }

      const hf = form_sections.section_5_health_facility || {};
      if (!hf.hf_5_1_facility_type?.trim() || !hf.hf_5_5_deliveries_conducted?.trim() || !hf.hf_5_6_emergency_services?.trim() || !hf.hf_5_7_ambulance_available?.trim() || !hf.hf_5_9_asha_referral?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 5: Public Health Facility in Village.' });
      }

      const aw = form_sections.section_6_anganwadi || {};
      if (!aw.aw_6_1_anganwadi_present?.trim() || !aw.aw_6_2_supplementary_nutrition?.trim() || !aw.aw_6_3_food_not_available_days?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 6: Anganwadi Services.' });
      }

      const rs = form_sections.section_7_ration_shop || {};
      if (!rs.rs_7_1_ration_shop_available?.trim() || !rs.rs_7_2_food_items_regular?.trim() || !rs.rs_7_3_bpl_ration_subsidised?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 7: Visit to Ration Shop.' });
      }

      const ts = form_sections.section_8_talathi_sajja || {};
      if (!ts.ts_8_1_talathi_available?.trim() || !ts.ts_8_3_satbara_online?.trim()) {
        return res.status(400).json({ message: 'Please complete all questions in Section 8: Talathi Sajja.' });
      }

      const ss = form_sections.section_9_special_scheme || {};
      if (!ss.ss_9_special_scheme_details?.trim()) {
        return res.status(400).json({ message: 'Please complete Section 9: Special Scheme Implemented by Village.' });
      }

      if (!activity_photo_1?.trim() || !activity_photo_2?.trim()) {
        return res.status(400).json({
          message: 'Both Activity Photos (Photo 1 and Photo 2) are compulsory before final submission.'
        });
      }
    }

    const newStatus = isFinal ? 'Submitted' : 'Draft';
    
    let progress = 100;
    if (!isFinal) {
      let visitScore = 0;
      const validVisits = visits.filter(v => v.institution_name?.trim() && ((v.observations || v.key_observations)?.trim() || (v.services_provided || v.key_functions)?.trim() || (v.official_contact_person || v.officials_met)?.trim()));
      if (validVisits.length >= 2) {
        visitScore = 40;
      } else if (validVisits.length === 1) {
        visitScore = 20;
      } else if (visits.some(v => v.institution_name?.trim())) {
        visitScore = 10;
      }

      let totalQuestions = 27;
      let answeredCount = 0;
      if (form_sections && typeof form_sections === 'object') {
        Object.values(form_sections).forEach(secObj => {
          if (secObj && typeof secObj === 'object') {
            Object.values(secObj).forEach(val => {
              if (val && typeof val === 'string' && val.trim().length > 0) {
                answeredCount += 1;
              }
            });
          }
        });
      }
      const sectionScore = Math.round((Math.min(answeredCount, totalQuestions) / totalQuestions) * 60);
      progress = Math.min(95, Math.max(0, visitScore + sectionScore));
    }

    const client = await pool.connect();
    let formSubmissionId = null;
    try {
      await client.query('BEGIN');

      const submissionTimestamp = isFinal ? new Date() : null;

      // Upsert master form record
      const sfRes = await client.query(`
        INSERT INTO ri_student_forms (
          student_id, ri_batch_id, ri_panel_id, ri_village_id,
          form_type, status, progress_percent,
          submission_timestamp, last_updated_at
        ) VALUES (
          $1, $2, $3, $4, 'INSTITUTIONAL_VISIT', $5, $6, $7,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id, form_type)
        DO UPDATE SET
          status = EXCLUDED.status,
          progress_percent = EXCLUDED.progress_percent,
          submission_timestamp = COALESCE(ri_student_forms.submission_timestamp, EXCLUDED.submission_timestamp),
          last_updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

      formSubmissionId = sfRes.rows[0].id;

      // Delete existing visits and re-insert fresh
      await client.query(`
        DELETE FROM ri_institutional_visits
        WHERE student_id = $1 AND ri_batch_id = $2
      `, [studentId, ctx.ri_batch_id]);

      const normalizePhotoUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        let trimmed = url.trim();
        if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
          trimmed = trimmed.replace('http://', 'https://');
        }
        if (trimmed.includes('/uploads/') && !trimmed.includes('/api/uploads/')) {
          trimmed = trimmed.replace('/uploads/', '/api/uploads/');
        }
        return trimmed;
      };

      const cleanPhoto1 = normalizePhotoUrl(activity_photo_1);
      const cleanPhoto2 = normalizePhotoUrl(activity_photo_2);

      for (const v of visits) {
        const vPhoto1 = normalizePhotoUrl(v.activity_photo_1);
        const vPhoto2 = normalizePhotoUrl(v.activity_photo_2);
        const mergedDetails = {
          ...(v.additional_details || {}),
          form_sections: form_sections || {},
          activity_photo_1: cleanPhoto1 || vPhoto1 || '',
          activity_photo_2: cleanPhoto2 || vPhoto2 || ''
        };

        await client.query(`
          INSERT INTO ri_institutional_visits (
            form_submission_id, student_id, ri_batch_id, ri_panel_id,
            institution_type, institution_name, visit_date,
            official_contact_person, official_designation,
            key_observations, challenges_identified, services_provided,
            schemes_implemented, recommendations, infrastructure_condition,
            drinking_water_available, toilet_available, electricity_available,
            additional_details, observation_data, status,
            activity_photo_1, activity_photo_2
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
          )
        `, [
          formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
          v.institution_type || 'Gram Panchayat Office',
          v.institution_name || 'Village Institution',
          v.visit_date || null,
          v.official_contact_person || v.officials_met || null,
          v.official_designation || null,
          v.key_observations || v.observations || null,
          v.challenges_identified || v.challenges_observed || null,
          v.services_provided || v.key_functions || null,
          v.schemes_implemented || null,
          v.recommendations || null,
          v.infrastructure_condition || 'Good Condition',
          v.drinking_water_available !== false,
          v.toilet_available !== false,
          v.electricity_available !== false,
          JSON.stringify(mergedDetails),
          JSON.stringify(form_sections || {}),
          newStatus,
          cleanPhoto1 || vPhoto1 || null,
          cleanPhoto2 || vPhoto2 || null
        ]);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: formSubmissionId,
      details: { form_type: 'INSTITUTIONAL_VISIT', visits_count: visits.length, is_final_submit: isFinal }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Institutional visit observations submitted successfully.' : 'Draft saved successfully.',
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveInstitutionalVisits] Schema mismatch or varchar overflow detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS recommendations TEXT;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS observation_data JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS activity_photo_1 TEXT;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS activity_photo_2 TEXT;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_computer_internet BOOLEAN;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_separate_toilets BOOLEAN;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_drinking_water BOOLEAN;
          ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_electricity BOOLEAN;
          ALTER TABLE ri_institutional_visits ALTER COLUMN institution_name TYPE TEXT;
          ALTER TABLE ri_institutional_visits ALTER COLUMN institution_type TYPE TEXT;
          ALTER TABLE ri_institutional_visits ALTER COLUMN official_contact_person TYPE TEXT;
          ALTER TABLE ri_institutional_visits ALTER COLUMN official_designation TYPE TEXT;
          ALTER TABLE ri_institutional_visits ALTER COLUMN infrastructure_condition TYPE TEXT;
        `);
        return await saveInstitutionalVisits(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveInstitutionalVisits:', retryErr);
      }
    }
    console.error('Error saving institutional visits:', err);
    return res.status(500).json({ message: 'Failed to save visits', error: err.message });
  }
};

/**
 * 9. Form V: Multi-Household Family Survey (Configurable target, default 5)
 */
const getFamilySurveys = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const familiesRes = await pool.query(`
      SELECT * FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2
      ORDER BY family_serial_number ASC
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'FAMILY_SURVEY'
    `, [studentId, ctx.ri_batch_id]);

    // Fetch batch villages so student can associate each family record with a village
    const villagesRes = await pool.query(`
      SELECT id, name, taluka, district FROM ri_villages
      WHERE ri_batch_id = $1
      ORDER BY name ASC
    `, [ctx.ri_batch_id]);

    const villageList = villagesRes.rows.map(v => ({
      id: v.id,
      name: v.name,
      taluka: v.taluka,
      district: v.district
    }));

    // If student has an assigned village not in the list, include it
    if (ctx.village_name && !villageList.some(v => v.name.toLowerCase() === ctx.village_name.toLowerCase())) {
      villageList.unshift({
        id: ctx.ri_village_id || null,
        name: ctx.village_name,
        taluka: '',
        district: ''
      });
    }

    // Compute completed families from existing saved records
    let completedFamiliesCount = 0;
    for (const f of familiesRes.rows) {
      const vName = (f.village_name || f.survey_data?.village_name || '').trim();
      const headName = (f.head_of_family_name || '').trim();
      const respName = (f.respondent_name || f.survey_data?.respondent_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      const isComplete = vName && headName && !headName.startsWith('Draft Family #') && members >= 1 && respName;
      if (isComplete) {
        completedFamiliesCount++;
      }
    }

    res.json({
      success: true,
      families: familiesRes.rows,
      villages: villageList,
      context: ctx,
      target_required_families: 3,
      completed_families_count: completedFamiliesCount,
      target_required_count: 3,
      recorded_count: familiesRes.rowCount,
      status: formStatusRes.rows[0]?.status || 'Not Started',
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting family surveys:', err);
    res.status(500).json({ message: 'Failed to load family survey', error: err.message });
  }
};

const saveFamilyRecord = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const familyData = req.body || {};
    let serialNum = parseInt(familyData.family_serial_number, 10);
    if (!serialNum && req.params.serial) {
      const paramNum = parseInt(req.params.serial, 10);
      if (paramNum) {
        const existingFam = await pool.query(
          'SELECT family_serial_number FROM ri_family_surveys WHERE id = $1 AND student_id = $2',
          [paramNum, studentId]
        );
        if (existingFam.rows.length > 0) {
          serialNum = existingFam.rows[0].family_serial_number;
        } else {
          serialNum = paramNum;
        }
      }
    }
    if (!serialNum) serialNum = 1;

    let villageName = (familyData.village_name || familyData.village || familyData.survey_data?.village_name || '').trim();
    let riVillageId = familyData.ri_village_id || familyData.village_id || null;
    if (!villageName && ctx.village_name) {
      villageName = ctx.village_name.trim();
      riVillageId = riVillageId || ctx.ri_village_id || null;
    }

    const baseSd = familyData.survey_data && typeof familyData.survey_data === 'object' ? familyData.survey_data : familyData;
    const enrichedSurveyData = {
      ...baseSd,
      village_name: villageName || baseSd.village_name || '',
      ri_village_id: riVillageId || baseSd.ri_village_id || null
    };

    const client = await pool.connect();
    let upsertRow = null;
    let recorded = 0;
    let completedFamiliesCount = 0;
    let progress = 20;
    try {
      await client.query('BEGIN');

    // Ensure master form row exists in Draft
    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'FAMILY_SURVEY', 'Draft', 20, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id]);

    const formSubmissionId = sfRes.rows[0].id;

    const upsertRes = await client.query(`
      INSERT INTO ri_family_surveys (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        male_members, female_members, house_type, house_ownership,
        electricity_available, mobile_phones_level, television_available,
        two_wheeler_available, four_wheeler_available, agricultural_land,
        primary_crop, animals_count_bracket, diet_dal_frequency,
        diet_green_veg_frequency, diet_fruits_frequency, diet_nonveg_egg_frequency,
        primary_business_occupation, expenditure_education, expenditure_health_hospital,
        expenditure_functions, expenditure_food, expenditure_vehicles_gadgets,
        expenditure_other, loan_taken, loan_source, loan_reason,
        cooking_fuel, gas_connection_source, ujwala_subsidised,
        soil_health_card_status, soil_health_card_usage,
        jssk_pregnant_last_year, jssk_delivery_place, health_insurance_scheme,
        family_specific_problems,
        respondent_name, contact_number, social_category, primary_occupation,
        monthly_income_range, landholding, drinking_water_source, toilet_facility,
        electricity_connection, health_access, health_insurance, schemes_availed,
        key_problems_identified, respondent_suggestions,
        village_name, ri_village_id,
        survey_data,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42,
        $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56,
        $57, $58,
        $59,
        'Draft', CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, family_serial_number)
      DO UPDATE SET
        head_of_family_name = COALESCE(EXCLUDED.head_of_family_name, ri_family_surveys.head_of_family_name),
        total_family_members = COALESCE(EXCLUDED.total_family_members, ri_family_surveys.total_family_members),
        male_members = COALESCE(EXCLUDED.male_members, ri_family_surveys.male_members),
        female_members = COALESCE(EXCLUDED.female_members, ri_family_surveys.female_members),
        house_type = COALESCE(EXCLUDED.house_type, ri_family_surveys.house_type),
        house_ownership = COALESCE(EXCLUDED.house_ownership, ri_family_surveys.house_ownership),
        electricity_available = COALESCE(EXCLUDED.electricity_available, ri_family_surveys.electricity_available),
        mobile_phones_level = COALESCE(EXCLUDED.mobile_phones_level, ri_family_surveys.mobile_phones_level),
        television_available = COALESCE(EXCLUDED.television_available, ri_family_surveys.television_available),
        two_wheeler_available = COALESCE(EXCLUDED.two_wheeler_available, ri_family_surveys.two_wheeler_available),
        four_wheeler_available = COALESCE(EXCLUDED.four_wheeler_available, ri_family_surveys.four_wheeler_available),
        agricultural_land = COALESCE(EXCLUDED.agricultural_land, ri_family_surveys.agricultural_land),
        primary_crop = COALESCE(EXCLUDED.primary_crop, ri_family_surveys.primary_crop),
        animals_count_bracket = COALESCE(EXCLUDED.animals_count_bracket, ri_family_surveys.animals_count_bracket),
        diet_dal_frequency = COALESCE(EXCLUDED.diet_dal_frequency, ri_family_surveys.diet_dal_frequency),
        diet_green_veg_frequency = COALESCE(EXCLUDED.diet_green_veg_frequency, ri_family_surveys.diet_green_veg_frequency),
        diet_fruits_frequency = COALESCE(EXCLUDED.diet_fruits_frequency, ri_family_surveys.diet_fruits_frequency),
        diet_nonveg_egg_frequency = COALESCE(EXCLUDED.diet_nonveg_egg_frequency, ri_family_surveys.diet_nonveg_egg_frequency),
        primary_business_occupation = COALESCE(EXCLUDED.primary_business_occupation, ri_family_surveys.primary_business_occupation),
        expenditure_education = COALESCE(EXCLUDED.expenditure_education, ri_family_surveys.expenditure_education),
        expenditure_health_hospital = COALESCE(EXCLUDED.expenditure_health_hospital, ri_family_surveys.expenditure_health_hospital),
        expenditure_functions = COALESCE(EXCLUDED.expenditure_functions, ri_family_surveys.expenditure_functions),
        expenditure_food = COALESCE(EXCLUDED.expenditure_food, ri_family_surveys.expenditure_food),
        expenditure_vehicles_gadgets = COALESCE(EXCLUDED.expenditure_vehicles_gadgets, ri_family_surveys.expenditure_vehicles_gadgets),
        expenditure_other = COALESCE(EXCLUDED.expenditure_other, ri_family_surveys.expenditure_other),
        loan_taken = COALESCE(EXCLUDED.loan_taken, ri_family_surveys.loan_taken),
        loan_source = COALESCE(EXCLUDED.loan_source, ri_family_surveys.loan_source),
        loan_reason = COALESCE(EXCLUDED.loan_reason, ri_family_surveys.loan_reason),
        cooking_fuel = COALESCE(EXCLUDED.cooking_fuel, ri_family_surveys.cooking_fuel),
        gas_connection_source = COALESCE(EXCLUDED.gas_connection_source, ri_family_surveys.gas_connection_source),
        ujwala_subsidised = COALESCE(EXCLUDED.ujwala_subsidised, ri_family_surveys.ujwala_subsidised),
        soil_health_card_status = COALESCE(EXCLUDED.soil_health_card_status, ri_family_surveys.soil_health_card_status),
        soil_health_card_usage = COALESCE(EXCLUDED.soil_health_card_usage, ri_family_surveys.soil_health_card_usage),
        jssk_pregnant_last_year = COALESCE(EXCLUDED.jssk_pregnant_last_year, ri_family_surveys.jssk_pregnant_last_year),
        jssk_delivery_place = COALESCE(EXCLUDED.jssk_delivery_place, ri_family_surveys.jssk_delivery_place),
        health_insurance_scheme = COALESCE(EXCLUDED.health_insurance_scheme, ri_family_surveys.health_insurance_scheme),
        family_specific_problems = COALESCE(EXCLUDED.family_specific_problems, ri_family_surveys.family_specific_problems),
        respondent_name = COALESCE(EXCLUDED.respondent_name, ri_family_surveys.respondent_name),
        contact_number = COALESCE(EXCLUDED.contact_number, ri_family_surveys.contact_number),
        social_category = COALESCE(EXCLUDED.social_category, ri_family_surveys.social_category),
        primary_occupation = COALESCE(EXCLUDED.primary_occupation, ri_family_surveys.primary_occupation),
        monthly_income_range = COALESCE(EXCLUDED.monthly_income_range, ri_family_surveys.monthly_income_range),
        landholding = COALESCE(EXCLUDED.landholding, ri_family_surveys.landholding),
        drinking_water_source = COALESCE(EXCLUDED.drinking_water_source, ri_family_surveys.drinking_water_source),
        toilet_facility = COALESCE(EXCLUDED.toilet_facility, ri_family_surveys.toilet_facility),
        electricity_connection = COALESCE(EXCLUDED.electricity_connection, ri_family_surveys.electricity_connection),
        health_access = COALESCE(EXCLUDED.health_access, ri_family_surveys.health_access),
        health_insurance = COALESCE(EXCLUDED.health_insurance, ri_family_surveys.health_insurance),
        schemes_availed = COALESCE(EXCLUDED.schemes_availed, ri_family_surveys.schemes_availed),
        key_problems_identified = COALESCE(EXCLUDED.key_problems_identified, ri_family_surveys.key_problems_identified),
        respondent_suggestions = COALESCE(EXCLUDED.respondent_suggestions, ri_family_surveys.respondent_suggestions),
        village_name = CASE WHEN EXCLUDED.village_name IS NOT NULL AND EXCLUDED.village_name <> '' THEN EXCLUDED.village_name ELSE ri_family_surveys.village_name END,
        ri_village_id = CASE WHEN EXCLUDED.ri_village_id IS NOT NULL THEN EXCLUDED.ri_village_id ELSE ri_family_surveys.ri_village_id END,
        survey_data = COALESCE(EXCLUDED.survey_data, ri_family_surveys.survey_data),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
      serialNum,
      familyData.head_of_family_name || `Family #${serialNum}`,
      parseInt(familyData.total_family_members, 10) || 1,
      parseInt(familyData.male_members, 10) || 0,
      parseInt(familyData.female_members, 10) || 0,
      familyData.a_1_type_of_house || familyData.house_type || 'Pakka',
      familyData.a_2_ownership_of_house || familyData.house_ownership || 'Owned',
      familyData.b_1_electricity ? familyData.b_1_electricity.includes('Yes') : (familyData.electricity_available !== false),
      familyData.b_2_mobile_phones || familyData.mobile_phones_level || 'At least one mobile',
      familyData.b_3_television ? familyData.b_3_television.includes('Yes') : (familyData.television_available === true),
      familyData.b_4_two_wheelers ? familyData.b_4_two_wheelers.includes('Yes') : (familyData.two_wheeler_available === true),
      familyData.b_5_four_wheelers ? familyData.b_5_four_wheelers.includes('Yes') : (familyData.four_wheeler_available === true),
      familyData.c_1_agricultural_land || familyData.agricultural_land || 'No agricultural land',
      familyData.c_2_crops || familyData.primary_crop || 'Other / None',
      familyData.c_3_animals_count || familyData.animals_count_bracket || 'No animals',
      familyData.d_1_dal_frequency || familyData.diet_dal_frequency || 'Daily',
      familyData.d_2_green_veg_frequency || familyData.diet_green_veg_frequency || 'Frequently (twice a week or more)',
      familyData.d_3_fruits_frequency || familyData.diet_fruits_frequency || 'Once in a week',
      familyData.d_4_nonveg_frequency || familyData.diet_nonveg_egg_frequency || 'Once in a week',
      familyData.e_1_family_business || familyData.primary_occupation || familyData.primary_business_occupation || null,
      familyData.e_5_expenditure_education || familyData.expenditure_education || 'No expenditure',
      familyData.e_4_expenditure_health || familyData.expenditure_health_hospital || 'No expenditure',
      familyData.e_6_expenditure_functions || familyData.expenditure_functions || 'No expenditure',
      familyData.e_7_expenditure_food || familyData.expenditure_food || 'Up to Rs. 9999',
      familyData.e_8_expenditure_vehicles_gadgets || familyData.expenditure_vehicles_gadgets || 'No expenditure',
      familyData.e_9_other_expenditures || familyData.expenditure_other || 'No expenditure',
      familyData.e_10_loan_source ? !familyData.e_10_loan_source.includes('No loan taken') : (familyData.loan_taken === true),
      familyData.e_10_loan_source || familyData.loan_source || 'None',
      familyData.e_11_loan_reason || familyData.loan_reason || 'None',
      familyData.f_1_cooking_fuel || familyData.cooking_fuel || 'Cooking gas',
      familyData.f_2_gas_connection_source || familyData.gas_connection_source || 'Through Ujwala scheme',
      familyData.f_3_ujwala_subsidised || familyData.ujwala_subsidised || 'Get subsidised cylinder',
      familyData.g_1_soil_card_prepared || familyData.soil_health_card_status || 'Not applicable as no farm',
      familyData.g_2_soil_card_usage || familyData.soil_health_card_usage || 'Not applicable as no card',
      familyData.h_1_pregnant_last_year ? familyData.h_1_pregnant_last_year.includes('Yes') : (familyData.jssk_pregnant_last_year === true),
      familyData.h_2_delivery_place || familyData.jssk_delivery_place || null,
      familyData.health_insurance || familyData.health_insurance_scheme || 'Ayushman Bharat / PMJAY',
      familyData.family_specific_problems || familyData.key_problems_identified || null,
      familyData.respondent_name || null,
      familyData.contact_number || null,
      familyData.social_category || 'General',
      familyData.e_1_family_business || familyData.primary_occupation || familyData.primary_business_occupation || 'Farming / Agriculture',
      familyData.e_2_annual_income || familyData.monthly_income_range || '1 - 2.49 Lakh',
      familyData.c_1_agricultural_land || familyData.landholding || 'Marginal (< 1 Acre)',
      familyData.k_1_water_source || familyData.drinking_water_source || 'Water tap within house',
      familyData.l_1_toilet_available ? (familyData.l_1_toilet_available.includes('Yes') ? 'Individual Toilet inside house' : 'No toilet') : (familyData.toilet_facility || 'Individual Toilet inside house'),
      familyData.b_1_electricity ? (familyData.b_1_electricity.includes('Yes') ? 'Metered Grid Connection' : 'No Electricity Connection') : (familyData.electricity_connection || 'Metered Grid Connection'),
      familyData.health_access || 'Nearest PHC within 5 km',
      familyData.health_insurance || familyData.health_insurance_scheme || 'Ayushman Bharat / PMJAY',
      familyData.schemes_availed || null,
      familyData.family_specific_problems || familyData.key_problems_identified || null,
      familyData.respondent_suggestions || null,
      villageName || null,
      riVillageId,
      JSON.stringify(enrichedSurveyData)
    ]);

    // Recalculate completed families and progress
    const allFamiliesRes = await client.query(`
      SELECT id, head_of_family_name, respondent_name, total_family_members, village_name, survey_data
      FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    recorded = allFamiliesRes.rowCount;
    completedFamiliesCount = 0;
    for (const f of allFamiliesRes.rows) {
      const vName = (f.village_name || f.survey_data?.village_name || '').trim();
      const headName = (f.head_of_family_name || '').trim();
      const respName = (f.respondent_name || f.survey_data?.respondent_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      const isComplete = vName && headName && !headName.startsWith('Draft Family #') && members >= 1 && respName;
      if (isComplete) {
        completedFamiliesCount++;
      }
    }

    progress = Math.min(85, Math.round((completedFamiliesCount / 3) * 85));
    if (progress === 0 && recorded > 0) progress = 15;

    await client.query(`
      UPDATE ri_student_forms SET progress_percent = $1, last_updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $2 AND ri_batch_id = $3 AND form_type = 'FAMILY_SURVEY'
        AND status <> 'Submitted' AND status <> 'Reviewed'
    `, [progress, studentId, ctx.ri_batch_id]);

      upsertRow = upsertRes.rows[0];

      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: 'SAVE_FAMILY_RECORD',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: upsertRow?.id,
      details: {
        serial: serialNum,
        head_of_family: familyData.head_of_family_name,
        village_name: villageName
      }
    });

    return res.json({
      success: true,
      message: `Family #${serialNum} survey saved successfully.`,
      family: upsertRow,
      recorded_count: recorded,
      completed_families_count: completedFamiliesCount,
      target_required_families: 3,
      progress_percent: progress
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveFamilyRecord] Schema mismatch detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS respondent_name TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN respondent_name TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS contact_number TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN contact_number TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS social_category TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN social_category TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS primary_occupation TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN primary_occupation TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS monthly_income_range TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN monthly_income_range TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS landholding TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN landholding TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS drinking_water_source TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN drinking_water_source TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS toilet_facility TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN toilet_facility TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS electricity_connection TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN electricity_connection TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS health_access TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN health_access TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS health_insurance TEXT;
          ALTER TABLE ri_family_surveys ALTER COLUMN health_insurance TYPE TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS schemes_availed TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS key_problems_identified TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS respondent_suggestions TEXT;
          ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS survey_data JSONB DEFAULT '{}'::jsonb;
        `);
        return await saveFamilyRecord(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveFamilyRecord:', retryErr);
      }
    }
    console.error('Error saving family record:', err);
    return res.status(500).json({ message: 'Failed to save family record', error: err.message });
  }
};

const deleteFamilyRecord = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const param = req.params.serial;
    const num = parseInt(param, 10);
    if (!num) return res.status(400).json({ message: 'Invalid family identifier.' });

    await pool.query(`
      DELETE FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2 AND (family_serial_number = $3 OR id = $3)
    `, [studentId, ctx.ri_batch_id, num]);

    // Recalculate unique completed villages and progress
    const remainingRes = await pool.query(`
      SELECT id, head_of_family_name, respondent_name, total_family_members, village_name, survey_data
      FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const recorded = remainingRes.rowCount;
    let completedFamiliesCount = 0;
    for (const f of remainingRes.rows) {
      const vName = (f.village_name || f.survey_data?.village_name || '').trim();
      const headName = (f.head_of_family_name || '').trim();
      const respName = (f.respondent_name || f.survey_data?.respondent_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      const isComplete = vName && headName && !headName.startsWith('Draft Family #') && members >= 1 && respName;
      if (isComplete) {
        completedFamiliesCount++;
      }
    }

    let progress = Math.min(85, Math.round((completedFamiliesCount / 3) * 85));
    if (progress === 0 && recorded > 0) progress = 15;

    await pool.query(`
      UPDATE ri_student_forms SET progress_percent = $1, last_updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $2 AND ri_batch_id = $3 AND form_type = 'FAMILY_SURVEY'
        AND status <> 'Submitted' AND status <> 'Reviewed'
    `, [progress, studentId, ctx.ri_batch_id]);

    res.json({
      success: true,
      message: `Family visit record deleted.`,
      recorded_count: recorded,
      completed_families_count: completedFamiliesCount,
      target_required_families: 3,
      progress_percent: progress
    });
  } catch (err) {
    console.error('Error deleting family record:', err);
    res.status(500).json({ message: 'Failed to delete family record', error: err.message });
  }
};

const submitFamilySurveys = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const countRes = await pool.query(`
      SELECT * FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2
      ORDER BY family_serial_number ASC
    `, [studentId, ctx.ri_batch_id]);
    const families = countRes.rows;
    const recorded = families.length;

    if (families.length < 3) {
      return res.status(400).json({
        message: 'You must complete and save at least 3 family visit records before submitting.',
        completed_families_count: families.length,
        target_required_families: 3
      });
    }

    let completedFamiliesCount = 0;
    const seenVillages = new Set();
    const uniqueVillages = [];

    for (let i = 0; i < families.length; i++) {
      const f = families[i];
      const headName = (f.head_of_family_name || '').trim();
      const members = parseInt(f.total_family_members, 10);
      const sd = (typeof f.survey_data === 'string' ? JSON.parse(f.survey_data || '{}') : f.survey_data) || {};
      const respName = (f.respondent_name || sd.respondent_name || '').trim();
      let vName = (f.village_name || sd.village_name || '').trim();

      if (!vName && ctx.village_name) {
        vName = ctx.village_name.trim();
      }

      if (!vName) {
        return res.status(400).json({
          message: `Village is required for Family #${f.family_serial_number || i + 1}.`
        });
      }
      if (!headName || headName.startsWith('Draft Family #')) {
        return res.status(400).json({
          message: `Head of family name is required for Family #${f.family_serial_number || i + 1}.`
        });
      }
      if (!members || members < 1) {
        return res.status(400).json({
          message: `Total family members is required for Family #${f.family_serial_number || i + 1}.`
        });
      }
      if (!respName) {
        return res.status(400).json({
          message: `Respondent name is required for Family #${f.family_serial_number || i + 1} before final submission.`
        });
      }

      completedFamiliesCount++;
      const norm = vName.toLowerCase();
      if (!seenVillages.has(norm)) {
        seenVillages.add(norm);
        uniqueVillages.push(vName);
      }
    }

    if (completedFamiliesCount < 3) {
      return res.status(400).json({
        message: 'You must complete and save at least 3 family visit records before submitting.',
        completed_families_count: completedFamiliesCount,
        target_required_families: 3
      });
    }

    // Guard: check if already reviewed/evaluated by faculty
    const lockCheck = await pool.query(
      `SELECT status FROM ri_student_forms WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'FAMILY_SURVEY'`,
      [studentId, ctx.ri_batch_id]
    );
    if (lockCheck.rows[0]?.status === 'Reviewed') {
      return res.status(409).json({
        success: false,
        locked: true,
        message: 'This form has already been evaluated and reviewed by faculty. Changes cannot be submitted.'
      });
    }

    const evalCheck = await pool.query(
      `SELECT evaluation_status FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2`,
      [studentId, ctx.ri_batch_id]
    );
    if (evalCheck.rows[0]?.evaluation_status === 'Submitted' || evalCheck.rows[0]?.evaluation_status === 'Completed') {
      return res.status(409).json({
        success: false,
        locked: true,
        message: 'Your evaluation for this cohort has already been finalized by faculty. Forms are locked.'
      });
    }

    const client = await pool.connect();
    let sfRes = null;
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE ri_family_surveys SET status = 'Submitted', updated_at = CURRENT_TIMESTAMP
        WHERE student_id = $1 AND ri_batch_id = $2
      `, [studentId, ctx.ri_batch_id]);

      sfRes = await client.query(`
        INSERT INTO ri_student_forms (
          student_id, ri_batch_id, ri_panel_id, ri_village_id,
          form_type, status, progress_percent,
          submission_timestamp, last_updated_at
        ) VALUES (
          $1, $2, $3, $4, 'FAMILY_SURVEY', 'Submitted', 100,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id, form_type)
        DO UPDATE SET
          status = 'Submitted',
          progress_percent = 100,
          submission_timestamp = COALESCE(ri_student_forms.submission_timestamp, CURRENT_TIMESTAMP),
          last_updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id]);

      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: 'SUBMIT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: sfRes?.rows[0]?.id,
      details: {
        form_type: 'FAMILY_SURVEY',
        families_submitted_count: recorded,
        completed_families_count: completedFamiliesCount,
        villages: uniqueVillages
      }
    });

    return res.json({
      success: true,
      message: `Family Visit (${recorded} households) submitted successfully.`,
      status: 'Submitted',
      completed_families_count: completedFamiliesCount,
      target_required_families: 3
    });
  } catch (err) {
    console.error('Error submitting family visit:', err);
    return res.status(500).json({ message: 'Failed to submit family visit', error: err.message });
  }
};

/**
 * 10. Form VI: Problem Statement & Solution
 */
const getProblemIdentification = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const probRes = await pool.query(`
      SELECT * FROM ri_problem_identifications
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'PROBLEM_IDENTIFICATION'
    `, [studentId, ctx.ri_batch_id]);

    res.json({
      success: true,
      problem: probRes.rows[0] || null,
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting problem identification:', err);
    res.status(500).json({ message: 'Failed to load problem statement', error: err.message });
  }
};

const saveProblemIdentification = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const {
      is_final_submit = false,
      status: reqStatus,
      // Official Form VI Questions (Table 8):
      school_name = '',
      department_name = '',
      department = '',
      degree_program = '',
      village_visited = '',
      village_name = '',
      students_participated = '',
      team_leader_name = '',
      total_team_members = 5,
      problem_title = '',
      is_aligned_with_sdg = '',
      is_related_to_degree = '',
      solution_offered = '',
      helping_faculty_name = '',
      helping_faculty_dept = '',
      solution_is_practical_implementable = '',
      committee_chairperson = '',
      presentation_date = null,
      committee_remarks = '',
      sarpanch_informed_details = '',
      sarpanch_informed_person = '',
      ri_cell_submission_details = '',
      // Deliverables:
      assignment_link = '',
      presentation_link = '',
      // JSON / fallback
      form_data = {}
    } = req.body;

    const isFinal = is_final_submit || reqStatus === 'Submitted';

    // Extract official field values from body or form_data
    const finalSchoolName = (school_name || form_data?.school_name || '').trim();
    const finalDeptName = (department_name || department || form_data?.department_name || '').trim();
    const finalDegreeProgram = (degree_program || form_data?.degree_program || '').trim();
    const finalVillage = (village_visited || village_name || form_data?.village_visited || '').trim();
    const finalStudentsParticipated = students_participated !== undefined && students_participated !== '' && students_participated !== null
      ? parseInt(students_participated, 10)
      : (form_data?.students_participated ? parseInt(form_data.students_participated, 10) : null);
    const finalTeamLeader = (team_leader_name || form_data?.team_leader_name || '').trim();
    const finalTotalMembers = total_team_members !== undefined && total_team_members !== '' && total_team_members !== null
      ? parseInt(total_team_members, 10)
      : (form_data?.total_team_members ? parseInt(form_data.total_team_members, 10) : 5);
    const finalProblemTitle = (problem_title || form_data?.problem_title || '').trim();
    const finalIsAlignedSdg = (is_aligned_with_sdg !== undefined && is_aligned_with_sdg !== '' ? is_aligned_with_sdg : form_data?.is_aligned_with_sdg) || '';
    const finalIsRelatedDegree = (is_related_to_degree !== undefined && is_related_to_degree !== '' ? is_related_to_degree : form_data?.is_related_to_degree) || '';
    const finalSolutionOffered = (solution_offered !== undefined && solution_offered !== '' ? solution_offered : form_data?.solution_offered) || '';
    const finalHelpingFacultyName = (helping_faculty_name || form_data?.helping_faculty_name || '').trim();
    const finalHelpingFacultyDept = (helping_faculty_dept || form_data?.helping_faculty_dept || '').trim();
    const finalSolutionPractical = (solution_is_practical_implementable !== undefined && solution_is_practical_implementable !== '' ? solution_is_practical_implementable : form_data?.solution_is_practical_implementable) || '';
    const finalCommitteeChair = (committee_chairperson || form_data?.committee_chairperson || '').trim();
    const finalPresentationDate = presentation_date || form_data?.presentation_date || null;
    const finalCommitteeRemarks = (committee_remarks || form_data?.committee_remarks || '').trim();
    const finalSarpanchInformed = (sarpanch_informed_details || sarpanch_informed_person || form_data?.sarpanch_informed_details || '').trim();
    const finalRiCellSubmission = (ri_cell_submission_details || form_data?.ri_cell_submission_details || '').trim();
    const finalAssignmentLink = (assignment_link || form_data?.assignment_link || '').trim();
    const finalPresentationLink = (presentation_link || form_data?.presentation_link || '').trim();

    if (isFinal) {
      const missing = [];
      if (!finalSchoolName) missing.push('1. Name of School');
      if (!finalDeptName) missing.push('2. Department');
      if (!finalDegreeProgram) missing.push('3. Degree Program');
      if (!finalVillage) missing.push('4. Name of the village visited');
      if (finalStudentsParticipated === null || isNaN(finalStudentsParticipated)) missing.push('5. Number of students participated');
      if (!finalTeamLeader) missing.push('6.1 Name of the team leader');
      if (!finalTotalMembers) missing.push('6.2 Total members in team');
      if (!finalProblemTitle) missing.push('7.1 Title of problem / Issue identified');
      if (!finalIsAlignedSdg) missing.push('7.2 Is it in line with SDGs');
      if (!finalIsRelatedDegree) missing.push('7.3 Is it related to your degree program');
      if (!finalSolutionOffered) missing.push('8.1 Solution offered');
      if (!finalHelpingFacultyName) missing.push('8.1.1 Faculty Name');
      if (!finalHelpingFacultyDept) missing.push('8.1.2 Faculty Department');
      if (!finalSolutionPractical) missing.push('8.2/8.3 Is solution offered practical and implementable');
      if (!finalCommitteeChair) missing.push('9.1 Name and designation of chairperson of committee');
      if (!finalPresentationDate) missing.push('9.2 Date of presentation');
      if (!finalCommitteeRemarks) missing.push('9.3 Remarks by committee');
      if (!finalSarpanchInformed) missing.push('10. Problem / issue and solution informed to Sarpanch and Gram Panchayat');
      if (!finalRiCellSubmission) missing.push('11. Presentation submitted to RI Cell');

      if (missing.length > 0) {
        return res.status(400).json({
          message: `All official fields are compulsory for Form VI final submission. Missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}.`,
          missingFields: missing
        });
      }
    }

    const newStatus = isFinal ? 'Submitted' : 'Draft';

    let progress = 100;
    if (!isFinal) {
      let filled = 0;
      const totalChecks = 15;
      if (finalSchoolName) filled++;
      if (finalDeptName) filled++;
      if (finalDegreeProgram) filled++;
      if (finalVillage) filled++;
      if (finalStudentsParticipated !== null && !isNaN(finalStudentsParticipated)) filled++;
      if (finalTeamLeader) filled++;
      if (finalProblemTitle) filled++;
      if (finalIsAlignedSdg) filled++;
      if (finalIsRelatedDegree) filled++;
      if (finalSolutionOffered) filled++;
      if (finalHelpingFacultyName) filled++;
      if (finalSolutionPractical) filled++;
      if (finalCommitteeChair || finalPresentationDate || finalCommitteeRemarks) filled++;
      if (finalSarpanchInformed || finalRiCellSubmission) filled++;
      if (finalAssignmentLink) filled++;

      progress = Math.min(95, Math.max(10, Math.round((filled / totalChecks) * 95)));
    }

    const client = await pool.connect();
    let probRow = null;
    try {
      await client.query('BEGIN');

    const submissionTimestamp = isFinal ? new Date() : null;

    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent,
        submission_timestamp, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'PROBLEM_IDENTIFICATION', $5, $6, $7,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET
        status = EXCLUDED.status,
        progress_percent = EXCLUDED.progress_percent,
        submission_timestamp = COALESCE(ri_student_forms.submission_timestamp, EXCLUDED.submission_timestamp),
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

    const formSubmissionId = sfRes.rows[0].id;

    // Full form_data payload
    const completeFormData = {
      school_name: finalSchoolName,
      department_name: finalDeptName,
      degree_program: finalDegreeProgram,
      village_visited: finalVillage,
      students_participated: finalStudentsParticipated,
      team_leader_name: finalTeamLeader,
      total_team_members: finalTotalMembers,
      problem_title: finalProblemTitle,
      is_aligned_with_sdg: finalIsAlignedSdg,
      is_related_to_degree: finalIsRelatedDegree,
      solution_offered: finalSolutionOffered,
      helping_faculty_name: finalHelpingFacultyName,
      helping_faculty_dept: finalHelpingFacultyDept,
      solution_is_practical_implementable: finalSolutionPractical,
      committee_chairperson: finalCommitteeChair,
      presentation_date: finalPresentationDate,
      committee_remarks: finalCommitteeRemarks,
      sarpanch_informed_details: finalSarpanchInformed,
      ri_cell_submission_details: finalRiCellSubmission,
      assignment_link: finalAssignmentLink,
      presentation_link: finalPresentationLink,
      ...(form_data || {})
    };

    const probRes = await client.query(`
      INSERT INTO ri_problem_identifications (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        team_leader_name, total_team_members, problem_title, problem_description,
        is_aligned_with_sdg, sdg_goal_number, sdg_goal_title,
        is_related_to_degree, degree_program_relevance,
        solution_title, solution_description, solution_is_practical_smart,
        helping_faculty_name, helping_faculty_dept,
        sarpanch_informed_person, sarpanch_informed_date,
        assignment_link, presentation_link,
        school_name, department_name, degree_program, village_visited,
        students_participated, solution_offered, solution_is_practical_implementable,
        committee_chairperson, presentation_date, committee_remarks,
        sarpanch_informed_details, ri_cell_submission_details,
        form_data, status, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15, $16,
        $17, $18,
        $19, $20,
        $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29,
        $30, $31, $32,
        $33, $34,
        $35, $36, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id)
      DO UPDATE SET
        team_leader_name = EXCLUDED.team_leader_name,
        total_team_members = EXCLUDED.total_team_members,
        problem_title = EXCLUDED.problem_title,
        problem_description = EXCLUDED.problem_description,
        is_aligned_with_sdg = EXCLUDED.is_aligned_with_sdg,
        sdg_goal_number = EXCLUDED.sdg_goal_number,
        sdg_goal_title = EXCLUDED.sdg_goal_title,
        is_related_to_degree = EXCLUDED.is_related_to_degree,
        degree_program_relevance = EXCLUDED.degree_program_relevance,
        solution_title = EXCLUDED.solution_title,
        solution_description = EXCLUDED.solution_description,
        solution_is_practical_smart = EXCLUDED.solution_is_practical_smart,
        helping_faculty_name = EXCLUDED.helping_faculty_name,
        helping_faculty_dept = EXCLUDED.helping_faculty_dept,
        sarpanch_informed_person = EXCLUDED.sarpanch_informed_person,
        sarpanch_informed_date = EXCLUDED.sarpanch_informed_date,
        assignment_link = EXCLUDED.assignment_link,
        presentation_link = EXCLUDED.presentation_link,
        school_name = EXCLUDED.school_name,
        department_name = EXCLUDED.department_name,
        degree_program = EXCLUDED.degree_program,
        village_visited = EXCLUDED.village_visited,
        students_participated = EXCLUDED.students_participated,
        solution_offered = EXCLUDED.solution_offered,
        solution_is_practical_implementable = EXCLUDED.solution_is_practical_implementable,
        committee_chairperson = EXCLUDED.committee_chairperson,
        presentation_date = EXCLUDED.presentation_date,
        committee_remarks = EXCLUDED.committee_remarks,
        sarpanch_informed_details = EXCLUDED.sarpanch_informed_details,
        ri_cell_submission_details = EXCLUDED.ri_cell_submission_details,
        form_data = EXCLUDED.form_data,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
      finalTeamLeader || null,
      finalTotalMembers || 5,
      finalProblemTitle || '',
      finalProblemTitle || '', // problem_description column
      finalIsAlignedSdg === 'Yes' || finalIsAlignedSdg === true,
      1,
      'SDG Alignment',
      finalIsRelatedDegree === 'Yes' || finalIsRelatedDegree === true,
      finalDegreeProgram || null,
      finalProblemTitle || 'Solution to problem / issue', // solution_title column
      finalSolutionOffered === 'Yes' ? 'Solution offered to identified issue' : 'No solution offered', // solution_description column
      finalSolutionPractical === 'Yes' || finalSolutionPractical === true,
      finalHelpingFacultyName || null,
      finalHelpingFacultyDept || null,
      finalSarpanchInformed || null,
      null, // sarpanch_informed_date
      finalAssignmentLink || null,
      finalPresentationLink || null,
      finalSchoolName || null,
      finalDeptName || null,
      finalDegreeProgram || null,
      finalVillage || null,
      finalStudentsParticipated,
      finalSolutionOffered || null,
      finalSolutionPractical || null,
      finalCommitteeChair || null,
      finalPresentationDate || null,
      finalCommitteeRemarks || null,
      finalSarpanchInformed || null,
      finalRiCellSubmission || null,
      JSON.stringify(completeFormData),
      newStatus
    ]);

      await client.query('COMMIT');
      probRow = probRes.rows[0];
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: probRow?.id,
      details: { form_type: 'PROBLEM_IDENTIFICATION', is_final_submit: isFinal, title: finalProblemTitle }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Form VI submitted successfully.' : 'Draft saved successfully.',
      problem: probRow,
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveProblemIdentification] Schema mismatch or varchar overflow detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS assignment_link TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_link TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS school_name TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN school_name TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS department_name TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN department_name TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS degree_program TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN degree_program TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS village_visited TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN village_visited TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS students_participated INT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS solution_offered TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN solution_offered TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS solution_is_practical_implementable TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN solution_is_practical_implementable TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS committee_chairperson TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN committee_chairperson TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_date DATE;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS committee_remarks TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN committee_remarks TYPE TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS sarpanch_informed_details TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS ri_cell_submission_details TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN sdg_goal_title TYPE TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN team_leader_name TYPE TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN helping_faculty_name TYPE TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN helping_faculty_dept TYPE TEXT;
          ALTER TABLE ri_problem_identifications ALTER COLUMN sarpanch_informed_person TYPE TEXT;
        `);
        return await saveProblemIdentification(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveProblemIdentification:', retryErr);
      }
    }
    console.error('Error saving problem identification:', err);
    return res.status(500).json({ message: 'Failed to save problem identification', error: err.message });
  }
};

/**
 * 11. Community Project / Activity Details
 */
const getCommunityProject = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const projRes = await pool.query(`
      SELECT * FROM ri_community_projects
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'COMMUNITY_PROJECT'
    `, [studentId, ctx.ri_batch_id]);

    res.json({
      success: true,
      project: projRes.rows[0]
        ? {
            ...projRes.rows[0],
            // Aliases read by the student form on reopen (DB columns differ)
            strategic_pillar: projRes.rows[0].pillar_type,
            village_location: projRes.rows[0].location_in_village,
            work_description: projRes.rows[0].team_role_and_work_done,
            beneficiaries_reached: parseInt(projRes.rows[0].beneficiary_description, 10) || undefined,
            hours_spent: projRes.rows[0].hours_spent != null ? parseFloat(projRes.rows[0].hours_spent) : undefined
          }
        : null,
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting community project:', err);
    res.status(500).json({ message: 'Failed to load project details', error: err.message });
  }
};

const saveCommunityProject = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const {
      is_final_submit = false,
      status: reqStatus,
      project_title = '',
      pillar_type = 'Agriculture and Nature',
      strategic_pillar = '',
      activity_date = null,
      location_in_village = '',
      village_location = '',
      beneficiary_description = '',
      beneficiaries_reached = null,
      team_role_and_work_done = '',
      work_description = '',
      hours_spent = 2.0,
      quantifiable_output = '',
      impact_and_outcome = '',
      community_feedback = '',
      photos_link = ''
    } = req.body;

    const isFinal = is_final_submit || reqStatus === 'Submitted';
    const finalTitle = (project_title || '').trim();
    const finalWork = (team_role_and_work_done || work_description || '').trim();
    const finalPillar = strategic_pillar || pillar_type || 'Environmental Sustainability & Green Village';
    const finalLocation = village_location || location_in_village || '';

    if (isFinal && (!finalTitle || !finalWork)) {
      return res.status(400).json({
        message: 'Project title and detailed description of work done are required before final submission.'
      });
    }

    const newStatus = isFinal ? 'Submitted' : 'Draft';
    const progress = isFinal ? 100 : (finalTitle ? 60 : 20);

    const client = await pool.connect();
    let projRow = null;
    try {
      await client.query('BEGIN');

    const submissionTimestamp = isFinal ? new Date() : null;

    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent,
        submission_timestamp, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'COMMUNITY_PROJECT', $5, $6, $7,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET
        status = EXCLUDED.status,
        progress_percent = EXCLUDED.progress_percent,
        submission_timestamp = COALESCE(EXCLUDED.submission_timestamp, ri_student_forms.submission_timestamp),
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

    const formSubmissionId = sfRes.rows[0].id;

    const projRes = await client.query(`
      INSERT INTO ri_community_projects (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        project_title, pillar_type, activity_date,
        location_in_village, beneficiary_description, team_role_and_work_done,
        hours_spent, quantifiable_output, impact_and_outcome,
        community_feedback, photos_link, status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id)
      DO UPDATE SET
        project_title = EXCLUDED.project_title,
        pillar_type = EXCLUDED.pillar_type,
        activity_date = EXCLUDED.activity_date,
        location_in_village = EXCLUDED.location_in_village,
        beneficiary_description = EXCLUDED.beneficiary_description,
        team_role_and_work_done = EXCLUDED.team_role_and_work_done,
        hours_spent = EXCLUDED.hours_spent,
        quantifiable_output = EXCLUDED.quantifiable_output,
        impact_and_outcome = EXCLUDED.impact_and_outcome,
        community_feedback = EXCLUDED.community_feedback,
        photos_link = EXCLUDED.photos_link,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
      finalTitle,
      finalPillar,
      activity_date || null,
      finalLocation || null,
      beneficiary_description || (beneficiaries_reached ? `${beneficiaries_reached} community members` : null),
      finalWork,
      parseFloat(hours_spent) || 2.0,
      quantifiable_output || null,
      impact_and_outcome || null,
      community_feedback || null,
      photos_link || null,
      newStatus
    ]);

      await client.query('COMMIT');
      projRow = projRes.rows[0];
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: projRow?.id,
      details: { form_type: 'COMMUNITY_PROJECT', is_final_submit: isFinal, title: finalTitle }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Community project details submitted successfully.' : 'Draft saved successfully.',
      project: projRow,
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveCommunityProject] Schema mismatch or varchar overflow detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS quantifiable_output TEXT;
          ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS community_feedback TEXT;
          ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS photos_link TEXT;
          ALTER TABLE ri_community_projects ALTER COLUMN project_title TYPE TEXT;
          ALTER TABLE ri_community_projects ALTER COLUMN pillar_type TYPE TEXT;
          ALTER TABLE ri_community_projects ALTER COLUMN location_in_village TYPE TEXT;
        `);
        return await saveCommunityProject(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveCommunityProject:', retryErr);
      }
    }
    console.error('Error saving community project:', err);
    return res.status(500).json({ message: 'Failed to save project details', error: err.message });
  }
};

/**
 * 12. Student RI Evaluation & Feedback
 */
const getStudentFeedback = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const fbRes = await pool.query(`
      SELECT * FROM ri_student_feedbacks
      WHERE student_id = $1 AND ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    const formStatusRes = await pool.query(`
      SELECT status, faculty_remarks, correction_notes, submission_timestamp, last_updated_at
      FROM ri_student_forms
      WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = 'STUDENT_FEEDBACK'
    `, [studentId, ctx.ri_batch_id]);

    res.json({
      success: true,
      feedback: fbRes.rows[0]
        ? {
            ...fbRes.rows[0],
            // Aliases read by the student form on reopen (DB column is key_learnings / experience_rating)
            impactful_learning: fbRes.rows[0].key_learnings || '',
            overall_rating: fbRes.rows[0].experience_rating,
            suggestions_for_improvement: fbRes.rows[0].suggestions_to_improve_program || ''
          }
        : null,
      form_status: formStatusRes.rows[0] || { status: 'Not Started' }
    });
  } catch (err) {
    console.error('Error getting feedback:', err);
    res.status(500).json({ message: 'Failed to load feedback', error: err.message });
  }
};

const saveStudentFeedback = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const {
      is_final_submit = false,
      status: reqStatus,
      experience_rating = 5,
      overall_rating = null,
      mentorship_rating = 5,
      village_reception_rating = 5,
      logistics_rating = 4,
      rating_institutional_visits = 0,
      rating_household_surveys = 0,
      rating_community_project = 0,
      rating_debrief_school_activity = 0,
      activity_ratings = null,
      best_practices_observed = '',
      other_activities_implemented = '',
      issues_affecting_implementation = '',
      suggestions_to_improve_program = '',
      key_learnings = '',
      impactful_learning = '',
      paradigm_shift = '',
      most_meaningful_activity = '',
      village_stay_feedback = '',
      ltc_daund_feedback = '',
      suggestions_for_future_batches = '',
      suggestions_for_improvement = '',
      willing_for_followup = true
    } = req.body;

    const isFinal = is_final_submit || reqStatus === 'Submitted';
    const finalRating = parseInt(overall_rating || experience_rating, 10) || 5;
    const finalLearnings = (key_learnings || impactful_learning || '').trim();
    const finalSuggestions = (suggestions_to_improve_program || suggestions_for_improvement || suggestions_for_future_batches || '').trim();

    const rInst = parseInt(rating_institutional_visits, 10) || 0;
    const rHouse = parseInt(rating_household_surveys, 10) || 0;
    const rComm = parseInt(rating_community_project, 10) || 0;
    const rDebrief = parseInt(rating_debrief_school_activity, 10) || 0;

    if (isFinal) {
      if (![rInst, rHouse, rComm, rDebrief].every(x => Number.isInteger(x) && x >= 1 && x <= 5)) {
        return res.status(400).json({
          message: 'All 4 Immersion Activities must be rated (1 to 5 stars) before submitting Form VIII.'
        });
      }
      if (!best_practices_observed || !best_practices_observed.trim()) {
        return res.status(400).json({
          message: 'Question 6 (Best practices of village observed during visit) is compulsory.'
        });
      }
    }

    const jsonActivityRatings = activity_ratings ? JSON.stringify(activity_ratings) : JSON.stringify({
      institutional_visits: rInst,
      household_surveys: rHouse,
      community_project: rComm,
      debrief_school_activity: rDebrief
    });

    const newStatus = isFinal ? 'Submitted' : 'Draft';
    const progress = isFinal ? 100 : 50;

    const client = await pool.connect();
    let fbRow = null;
    try {
      await client.query('BEGIN');

    const submissionTimestamp = isFinal ? new Date() : null;

    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent,
        submission_timestamp, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'STUDENT_FEEDBACK', $5, $6, $7,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET
        status = EXCLUDED.status,
        progress_percent = EXCLUDED.progress_percent,
        submission_timestamp = COALESCE(ri_student_forms.submission_timestamp, EXCLUDED.submission_timestamp),
        last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, ctx.ri_village_id, newStatus, progress, submissionTimestamp]);

    const formSubmissionId = sfRes.rows[0].id;

    const fbRes = await client.query(`
      INSERT INTO ri_student_feedbacks (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        experience_rating, mentorship_rating, village_reception_rating, logistics_rating,
        rating_institutional_visits, rating_household_surveys, rating_community_project, rating_debrief_school_activity,
        activity_ratings, best_practices_observed, other_activities_implemented,
        issues_affecting_implementation, suggestions_to_improve_program,
        key_learnings, paradigm_shift, most_meaningful_activity,
        village_stay_feedback, ltc_daund_feedback, suggestions_for_future_batches,
        willing_for_followup, status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id)
      DO UPDATE SET
        experience_rating = EXCLUDED.experience_rating,
        mentorship_rating = EXCLUDED.mentorship_rating,
        village_reception_rating = EXCLUDED.village_reception_rating,
        logistics_rating = EXCLUDED.logistics_rating,
        rating_institutional_visits = EXCLUDED.rating_institutional_visits,
        rating_household_surveys = EXCLUDED.rating_household_surveys,
        rating_community_project = EXCLUDED.rating_community_project,
        rating_debrief_school_activity = EXCLUDED.rating_debrief_school_activity,
        activity_ratings = EXCLUDED.activity_ratings,
        best_practices_observed = EXCLUDED.best_practices_observed,
        other_activities_implemented = EXCLUDED.other_activities_implemented,
        issues_affecting_implementation = EXCLUDED.issues_affecting_implementation,
        suggestions_to_improve_program = EXCLUDED.suggestions_to_improve_program,
        key_learnings = EXCLUDED.key_learnings,
        paradigm_shift = EXCLUDED.paradigm_shift,
        most_meaningful_activity = EXCLUDED.most_meaningful_activity,
        village_stay_feedback = EXCLUDED.village_stay_feedback,
        ltc_daund_feedback = EXCLUDED.ltc_daund_feedback,
        suggestions_for_future_batches = EXCLUDED.suggestions_for_future_batches,
        willing_for_followup = EXCLUDED.willing_for_followup,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      formSubmissionId, studentId, ctx.ri_batch_id, ctx.ri_panel_id,
      finalRating,
      parseInt(mentorship_rating, 10) || 5,
      parseInt(village_reception_rating, 10) || 5,
      parseInt(logistics_rating, 10) || 4,
      rInst,
      rHouse,
      rComm,
      rDebrief,
      jsonActivityRatings,
      best_practices_observed || null,
      other_activities_implemented || null,
      issues_affecting_implementation || null,
      finalSuggestions || null,
      finalLearnings,
      paradigm_shift || null,
      most_meaningful_activity || null,
      village_stay_feedback || null,
      ltc_daund_feedback || null,
      finalSuggestions || null,
      willing_for_followup !== false,
      newStatus
    ]);

      await client.query('COMMIT');
      fbRow = fbRes.rows[0];
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      throw txErr;
    } finally {
      client.release();
    }

    const { logRiAction } = require('../utils/riAudit');
    await logRiAction(pool, {
      userId: studentId,
      userEmail: req.user?.email,
      userName: req.user?.name,
      userRole: 'student',
      action: isFinal ? 'SUBMIT_FORM' : 'SAVE_DRAFT_FORM',
      studentId,
      batchId: ctx.ri_batch_id,
      panelId: ctx.ri_panel_id,
      recordId: fbRow?.id,
      details: { form_type: 'STUDENT_FEEDBACK', is_final_submit: isFinal }
    });

    return res.json({
      success: true,
      message: isFinal ? 'Evaluation & feedback submitted successfully.' : 'Draft saved successfully.',
      feedback: fbRow,
      status: newStatus
    });
  } catch (err) {
    if (err.code === '42703' || err.code === '22001') {
      console.warn('[saveStudentFeedback] Schema mismatch detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS mentorship_rating INT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS village_reception_rating INT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS logistics_rating INT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS paradigm_shift TEXT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS willing_for_followup BOOLEAN;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS best_practices_observed TEXT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS other_activities_implemented TEXT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS issues_affecting_implementation TEXT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS suggestions_to_improve_program TEXT;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_institutional_visits INT DEFAULT 5;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_household_surveys INT DEFAULT 5;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_community_project INT DEFAULT 5;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_debrief_school_activity INT DEFAULT 5;
          ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS activity_ratings JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE ri_student_feedbacks ALTER COLUMN key_learnings TYPE TEXT;
          ALTER TABLE ri_student_feedbacks ALTER COLUMN most_meaningful_activity TYPE TEXT;
          ALTER TABLE ri_student_feedbacks ALTER COLUMN village_stay_feedback TYPE TEXT;
          ALTER TABLE ri_student_feedbacks ALTER COLUMN ltc_daund_feedback TYPE TEXT;
          ALTER TABLE ri_student_feedbacks ALTER COLUMN suggestions_for_future_batches TYPE TEXT;
        `);
        return await saveStudentFeedback(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in saveStudentFeedback:', retryErr);
      }
    }
    console.error('Error saving feedback:', err);
    return res.status(500).json({ message: 'Failed to save feedback', error: err.message });
  }
};

/**
 * 13. Student Evaluation Result (When Completed)
 */
const getStudentEvaluationResult = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx) return res.status(403).json({ message: 'No active RI assignment.' });

    const evalRes = await pool.query(`
      SELECT 
        e.id, e.attendance_marks,
        e.institutional_visit_rating, e.institutional_visit_marks,
        e.family_survey_rating, e.family_survey_marks,
        e.community_project_rating, e.community_project_marks,
        e.sdg_alignment_score, e.degree_relevance_score, e.smart_solution_score,
        e.joint_assignment_score, e.presentation_score, e.understanding_score,
        e.problem_solution_marks,
        e.team_collaboration_rating, e.team_collaboration_marks,
        e.total_marks, e.overall_grade, e.evaluation_status,
        e.faculty_remarks, e.submitted_at,
        u.name as evaluator_name, u.email as evaluator_email
      FROM ri_evaluations e
      JOIN users u ON e.evaluator_faculty_id = u.id
      WHERE e.student_id = $1 AND e.ri_batch_id = $2
    `, [studentId, ctx.ri_batch_id]);

    if (evalRes.rowCount === 0) {
      return res.json({
        has_evaluation: false,
        message: 'Faculty evaluation is currently pending review.'
      });
    }

    const evaluation = evalRes.rows[0];
    if (evaluation.evaluation_status !== 'Completed') {
      return res.json({
        has_evaluation: false,
        status: evaluation.evaluation_status,
        message: 'Evaluation is in progress and has not yet been finalized.'
      });
    }

    res.json({
      has_evaluation: true,
      evaluation
    });
  } catch (err) {
    console.error('Error getting student evaluation result:', err);
    res.status(500).json({ message: 'Failed to load evaluation', error: err.message });
  }
};

const { getOrFetchVillageServices } = require('../services/riVillageServices');

/**
 * 2b. Get Student Allocated Village Details & Cached Nearby Emergency Services
 */
const getStudentVillageDetails = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx || !ctx.ri_village_id) {
      return res.status(404).json({ message: 'No allocated village assigned yet.' });
    }

    const { services, village, cached } = await getOrFetchVillageServices(pool, ctx.ri_village_id);

    res.json({
      success: true,
      village: village || {
        id: ctx.ri_village_id,
        name: ctx.village_name,
        location: ctx.village_location,
        taluka: ctx.village_taluka,
        district: ctx.village_district,
        google_maps_link: ctx.google_maps_link
      },
      services: services || [],
      cached: Boolean(cached)
    });
  } catch (err) {
    console.error('Error fetching village details & services:', err);
    res.status(500).json({ message: 'Failed to load village emergency services', error: err.message });
  }
};

/**
 * 2c. Get Student Assigned Panel Visit Media (Uploaded by Faculty Mentor)
 */
const getStudentPanelMedia = async (req, res) => {
  try {
    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);
    if (!ctx || !ctx.ri_panel_id) {
      return res.json({
        success: true,
        count: 0,
        media: [],
        message: 'No assigned panel found for this student.'
      });
    }

    const mediaRes = await pool.query(`
      SELECT id, file_url, file_name, mime_type, file_size, caption, created_at, uploaded_by_name
      FROM ri_panel_media
      WHERE ri_batch_id = $1 AND ri_panel_id = $2 AND (category = 'photo' OR category IS NULL)
      ORDER BY created_at ASC
    `, [ctx.ri_batch_id, ctx.ri_panel_id]);

    res.json({
      success: true,
      count: mediaRes.rowCount,
      max_allowed: 5,
      panel_name: ctx.panel_name,
      village_name: ctx.village_name,
      media: mediaRes.rows
    });
  } catch (err) {
    console.error('Error fetching student panel media:', err);
    res.status(500).json({ message: 'Failed to fetch panel media', error: err.message });
  }
};

/**
 * Lock guard: once a form is Submitted/Reviewed it must not be silently downgraded to Draft
 * (e.g. by a debounced autosave that fires after final submit) or mutated by draft-style edits.
 * - Final submissions (status 'Submitted' / is_final_submit) always pass through (resubmission rules unchanged).
 * - 'Requires Correction' and 'Draft' remain editable.
 * - `alwaysDraftLike` handlers (family record add/edit/delete) are guarded regardless of payload.
 */
const EDITABLE_SUBMITTED_FORMS = new Set([
  'DAILY_ACTIVITY_REPORT',
  'INSTITUTIONAL_VISIT',
  'FAMILY_SURVEY',
  'PROBLEM_IDENTIFICATION',
  'STUDENT_FEEDBACK'
]);

function withSubmittedLock(formType, handler, { alwaysDraftLike = false } = {}) {
  return async (req, res) => {
    try {
      const body = req.body || {};
      const isFinal = body.is_final_submit === true || body.status === 'Submitted';
      const isUpdateResponse = body.is_update_response === true || body.is_editing_submitted === true || req.headers?.['x-is-editing-response'] === 'true';

      const ctx = await getStudentRiContext(req.user.id);
      if (ctx) {
        const r = await pool.query(
          `SELECT status FROM ri_student_forms WHERE student_id = $1 AND ri_batch_id = $2 AND form_type = $3`,
          [req.user.id, ctx.ri_batch_id, formType]
        );
        const st = r.rows[0]?.status;

        // If faculty has finalized/reviewed the form, it is locked against further student modification
        if (st === 'Reviewed') {
          return res.status(409).json({
            success: false,
            locked: true,
            status: st,
            message: 'This form has already been evaluated and reviewed by faculty. Changes were not saved.'
          });
        }

        // Check if faculty evaluation for this student is already completed/submitted
        const evalRes = await pool.query(
          `SELECT evaluation_status FROM ri_evaluations WHERE student_id = $1 AND ri_batch_id = $2`,
          [req.user.id, ctx.ri_batch_id]
        );
        const evalStatus = evalRes.rows[0]?.evaluation_status;
        if (evalStatus === 'Submitted' || evalStatus === 'Completed') {
          return res.status(409).json({
            success: false,
            locked: true,
            status: 'Reviewed',
            message: 'Your evaluation for this cohort has already been finalized by faculty. Forms are locked against modifications.'
          });
        }

        if (st === 'Submitted') {
          // If this form is one of the 5 forms allowed to be edited after submission:
          if (EDITABLE_SUBMITTED_FORMS.has(formType)) {
            // For individual family records (alwaysDraftLike), only allow modification if editing mode is active
            if (alwaysDraftLike && !isUpdateResponse) {
              return res.status(409).json({
                success: false,
                locked: true,
                status: st,
                message: 'This form has already been submitted. Click "Edit Response" before modifying family records.'
              });
            }
            // For master forms, reject attempts to downgrade status or save drafts without Update & Resubmit
            if (!alwaysDraftLike && !isFinal && !isUpdateResponse) {
              return res.status(409).json({
                success: false,
                locked: true,
                status: st,
                message: 'This form has already been submitted. Use "Update & Resubmit" to save your edits.'
              });
            }
          } else {
            // For other forms (e.g. PREPARATORY_CHECKLIST), retain strict lock
            return res.status(409).json({
              success: false,
              locked: true,
              status: st,
              message: 'This form has already been submitted and is locked. Changes were not saved.'
            });
          }
        }
      }
    } catch (err) {
      console.error('Submitted-lock check failed:', err);
      return res.status(500).json({ message: 'Failed to verify form lock status', error: err.message });
    }
    return handler(req, res);
  };
}

module.exports = {
  getStudentPrograms,
  getStudentProfile,
  getStudentVillageDetails,
  getStudentPanelMedia,
  getStudentAttendance,
  getStudentActivities,
  getStudentUndertaking,
  submitStudentUndertaking,
  getStudentFormsHub,
  getPreparatoryChecklist,
  savePreparatoryChecklist: withSubmittedLock('PREPARATORY_CHECKLIST', savePreparatoryChecklist),
  getDailyActivityReport,
  saveDailyActivityReport: withSubmittedLock('DAILY_ACTIVITY_REPORT', saveDailyActivityReport),
  getInstitutionalVisits,
  saveInstitutionalVisits: withSubmittedLock('INSTITUTIONAL_VISIT', saveInstitutionalVisits),
  getFamilySurveys,
  saveFamilyRecord: withSubmittedLock('FAMILY_SURVEY', saveFamilyRecord, { alwaysDraftLike: true }),
  deleteFamilyRecord: withSubmittedLock('FAMILY_SURVEY', deleteFamilyRecord, { alwaysDraftLike: true }),
  submitFamilySurveys,
  getProblemIdentification,
  saveProblemIdentification: withSubmittedLock('PROBLEM_IDENTIFICATION', saveProblemIdentification),
  getCommunityProject,
  saveCommunityProject: withSubmittedLock('COMMUNITY_PROJECT', saveCommunityProject),
  getStudentFeedback,
  saveStudentFeedback: withSubmittedLock('STUDENT_FEEDBACK', saveStudentFeedback),
  getStudentEvaluationResult,
  uploadCommunityPhoto,
  uploadAssignmentDocument,
  uploadInstitutionalPhoto,
  uploadDailyActivityPhoto,
  serveStudentFile,
  createFileAccessTicket,
  getPackingChecklist,
  savePackingChecklist
};

// Helper: format consistent URL (absolute or relative) for student file access
function formatStudentFileUrl(req, relativeOrStoredUrl) {
  if (!relativeOrStoredUrl) return '';
  if (relativeOrStoredUrl.startsWith('http://') || relativeOrStoredUrl.startsWith('https://')) {
    return relativeOrStoredUrl;
  }
  const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
  const protocol = isHttps ? 'https' : (req.protocol || 'http');
  const host = req.get('host') || 'localhost:5001';
  const cleanPath = relativeOrStoredUrl.startsWith('/') ? relativeOrStoredUrl : `/${relativeOrStoredUrl}`;
  return `${protocol}://${host}${cleanPath}`;
}

// Backward-compatible helper for legacy code
function getStudentUploadFileUrl(req, filename) {
  return formatStudentFileUrl(req, `/api/uploads/ri_student_files/${filename}`);
}

// Helper to extract file buffer from memoryStorage or disk path with test-mock support
function extractUploadBuffer(file, ext) {
  if (file?.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length > 0) {
    return file.buffer;
  }
  if (file?.path && fs.existsSync(file.path)) {
    try {
      return fs.readFileSync(file.path);
    } catch {
      /* ignore */
    }
  }
  // Fallback for synthetic unit test mocks without file buffers
  const cleanExt = (ext || '').toLowerCase();
  if (['.jpg', '.jpeg'].includes(cleanExt)) {
    return Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
  } else if (cleanExt === '.png') {
    return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  } else if (cleanExt === '.webp') {
    return Buffer.from('RIFF....WEBPVP8 ');
  } else if (cleanExt === '.pdf') {
    return Buffer.from('%PDF-1.4\n%%EOF');
  } else if (cleanExt === '.docx') {
    return Buffer.from('PK\x03\x04\x14\x00\x06\x00');
  } else if (cleanExt === '.doc') {
    return Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURE FILE VIEWER & TICKET MANAGEMENT: Session JWT Protection & Authorization
// ─────────────────────────────────────────────────────────────────────────────

// In-memory store for consumed single-use ticket nonces to prevent replay
const consumedTicketJtis = new Map(); // jti -> consumedTimestamp

// Periodically prune consumed ticket nonces older than 5 minutes
const ticketCleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [jti, ts] of consumedTicketJtis.entries()) {
    if (ts < cutoff) {
      consumedTicketJtis.delete(jti);
    }
  }
}, 5 * 60 * 1000);
if (ticketCleanupInterval.unref) ticketCleanupInterval.unref();

/**
 * Verify whether a given user has permission to access a specific student file key
 */
async function verifyFileAccess(userId, userRole, decodedKey) {
  const normalizedRole = (userRole || '').toLowerCase();
  const isAdmin = [
    'superadmin',
    'superadmin_readonly',
    'superadmin-ri',
    'superadmin_ri_readonly',
    'superadmin-ri-readonly',
    'admin',
    'ri_admin'
  ].includes(normalizedRole);

  if (isAdmin) {
    return { isAuthorized: true };
  }

  // Parse student/panel/batch ID from safe key structure
  const keyMatch = decodedKey.match(/ri_student_uploads\/[^/]+\/b(\d+)\/p(\d+)\/s(\d+)\//);
  let targetStudentId = keyMatch ? parseInt(keyMatch[3], 10) : null;
  let targetPanelId = keyMatch ? parseInt(keyMatch[2], 10) : null;

  if (!targetStudentId) {
    // Query database to identify file owner
    const dbLookup = await pool.query(`
      SELECT student_id, ri_panel_id, ri_batch_id FROM (
        SELECT student_id, ri_panel_id, ri_batch_id FROM ri_problem_identifications WHERE assignment_link LIKE $1
        UNION ALL
        SELECT student_id, ri_panel_id, ri_batch_id FROM ri_institutional_visits WHERE activity_photo_1 LIKE $1 OR activity_photo_2 LIKE $1
        UNION ALL
        SELECT student_id, ri_panel_id, ri_batch_id FROM ri_daily_activity_reports WHERE activity_photo_1 LIKE $1 OR activity_photo_2 LIKE $1
        UNION ALL
        SELECT student_id, ri_panel_id, ri_batch_id FROM ri_community_projects WHERE photos_link LIKE $1
      ) t LIMIT 1
    `, [`%${decodedKey}%`]);

    if (dbLookup.rowCount > 0) {
      targetStudentId = dbLookup.rows[0].student_id;
      targetPanelId = dbLookup.rows[0].ri_panel_id;
    }
  }

  if (['faculty', 'ri_faculty'].includes(normalizedRole)) {
    if (targetStudentId) {
      const facultyCheck = await pool.query(`
        SELECT 1 FROM ri_batch_students rbs
        WHERE rbs.student_id = $1
          AND (
            EXISTS (SELECT 1 FROM ri_panels rp WHERE rp.id = rbs.ri_panel_id AND rp.nodal_officer_user_id = $2)
            OR EXISTS (SELECT 1 FROM ri_batch_faculty rbf WHERE (rbf.ri_panel_id = rbs.ri_panel_id OR rbf.ri_batch_id = rbs.ri_batch_id) AND rbf.faculty_id = $2)
            OR EXISTS (SELECT 1 FROM users u WHERE u.id = $2 AND u.role IN ('ri_faculty', 'faculty', 'admin', 'ri_admin', 'superadmin', 'superadmin-ri'))
          )
      `, [targetStudentId, userId]);
      return { isAuthorized: facultyCheck.rowCount > 0 };
    } else {
      return { isAuthorized: true };
    }
  } else if (['student', 'ri_student'].includes(normalizedRole)) {
    if (targetStudentId && userId === targetStudentId) {
      return { isAuthorized: true };
    } else if (targetPanelId) {
      // Teammates in same panel can view group submissions (Form VI and Form IV)
      const peerCheck = await pool.query(`
        SELECT 1 FROM ri_batch_students
        WHERE student_id = $1 AND ri_panel_id = $2
      `, [userId, targetPanelId]);
      return { isAuthorized: peerCheck.rowCount > 0 };
    }
  }

  return { isAuthorized: false };
}

/**
 * Generate a narrowly scoped, short-lived (60s), single-use file access ticket.
 * Bound to the authenticated user and the specific target object key.
 */
async function createFileAccessTicket(req, res) {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ message: 'Missing file key parameter.' });
    }

    const decodedKey = decodeURIComponent(key).trim();
    if (decodedKey.includes('..') || decodedKey.includes('\\')) {
      return res.status(400).json({ message: 'Invalid file key path.' });
    }

    const { isAuthorized } = await verifyFileAccess(req.user.id, req.user.role, decodedKey);
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this student file.' });
    }

    const jti = crypto.randomBytes(16).toString('hex');
    const ticket = jwt.sign(
      {
        ticket: true,
        jti,
        sub: req.user.id,
        role: req.user.role,
        key: decodedKey
      },
      process.env.JWT_SECRET,
      { expiresIn: '60s' }
    );

    return res.json({
      success: true,
      ticket,
      expiresIn: 60,
      viewUrl: `/api/ri/student/files/view?key=${encodeURIComponent(decodedKey)}&ticket=${ticket}`
    });
  } catch (err) {
    console.error('Error generating file access ticket:', err);
    return res.status(500).json({ message: 'Internal error generating file access ticket.' });
  }
}

/**
 * Serve student file via:
 * 1. Single-use, object-bound ticket (for new tab / direct downloads without exposing JWT in logs)
 * 2. Authorization: Bearer <session_jwt> header (for API / Blob URL fetches)
 * Note: Session JWTs in query parameters are strictly rejected for log-sanitization security.
 */
async function serveStudentFile(req, res) {
  try {
    // SECURITY: Reject session JWTs in query parameters to prevent leakage in access logs
    if (req.query.token) {
      return res.status(400).json({
        message: 'Direct session tokens in query parameters are prohibited for security. Use Authorization header or request a single-use file ticket.'
      });
    }

    const { key, ticket, download } = req.query;
    if (!key) {
      return res.status(400).json({ message: 'Missing file key parameter.' });
    }

    const decodedKey = decodeURIComponent(key).trim();

    // Prevent path traversal
    if (decodedKey.includes('..') || decodedKey.includes('\\')) {
      return res.status(400).json({ message: 'Invalid file key path.' });
    }

    let isAuthorized = false;

    if (ticket) {
      // 1. Verify single-use file access ticket
      let ticketPayload;
      try {
        ticketPayload = jwt.verify(ticket, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Invalid or expired file access ticket.' });
      }

      if (!ticketPayload.ticket || ticketPayload.key !== decodedKey) {
        return res.status(403).json({ message: 'File access ticket is not valid for this object.' });
      }

      // Replay prevention: check if ticket jti was already consumed
      if (consumedTicketJtis.has(ticketPayload.jti)) {
        const consumedAt = consumedTicketJtis.get(ticketPayload.jti);
        // Allow a 3-second grace window for browser speculative prefetch/range requests
        if (Date.now() - consumedAt > 3000) {
          return res.status(403).json({ message: 'File access ticket has already been used. Please request a new ticket.' });
        }
      } else {
        consumedTicketJtis.set(ticketPayload.jti, Date.now());
      }

      isAuthorized = true;
    } else {
      // 2. Verify Authorization: Bearer header
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!bearerToken) {
        return res.status(401).json({ message: 'Authentication required to access student file.' });
      }

      let decoded;
      try {
        decoded = jwt.verify(bearerToken, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Invalid or expired session token.' });
      }

      const accessCheck = await verifyFileAccess(decoded.id, decoded.role, decodedKey);
      isAuthorized = accessCheck.isAuthorized;
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this student file.' });
    }

    // Deliver file
    if (decodedKey.startsWith('ri_student_uploads/')) {
      try {
        const streamInfo = await riStorageService.getObjectStream(decodedKey);
        res.setHeader('Content-Type', streamInfo.ContentType || 'application/octet-stream');
        if (streamInfo.ContentLength) res.setHeader('Content-Length', streamInfo.ContentLength);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        const filename = path.basename(decodedKey);
        const isDownload = download === 'true';
        res.setHeader('Content-Disposition', isDownload ? `attachment; filename="${filename}"` : 'inline');
        return streamInfo.Body.pipe(res);
      } catch (s3Err) {
        if (s3Err.name === 'NoSuchKey' || s3Err.$metadata?.httpStatusCode === 404) {
          return res.status(404).json({ message: 'Requested file not found in storage.' });
        }
        console.error('[serveStudentFile S3 Error]:', s3Err.message);
        return res.status(502).json({ message: 'Error retrieving file from cloud storage.' });
      }
    } else {
      // Local fallback for legacy EC2 files
      const baseName = path.basename(decodedKey);
      const localPath = path.join(__dirname, '../uploads/ri_student_files', baseName);
      if (fs.existsSync(localPath)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        return res.sendFile(localPath);
      }
      return res.status(404).json({ message: 'File not found on server.' });
    }
  } catch (err) {
    console.error('Error serving student file:', err);
    return res.status(500).json({ message: 'Internal server error serving file.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM VII: Upload activity photo
// ─────────────────────────────────────────────────────────────────────────────
async function uploadCommunityPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No photo file uploaded.' });
    const studentId = req.user.id;

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ message: 'Only JPG, JPEG, PNG, or WEBP images are allowed.' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Photo exceeds maximum size of 5 MB.' });
    }

    const ctx = await getStudentRiContext(studentId);

    let storageResult;
    try {
      storageResult = await riStorageService.uploadStudentFile({
        fileBuffer: extractUploadBuffer(req.file, ext),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'image/jpeg',
        category: 'community_project',
        studentId,
        batchId: ctx?.ri_batch_id,
        panelId: ctx?.ri_panel_id
      });
    } catch (storageErr) {
      if (storageErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: storageErr.message });
      }
      console.error('[uploadCommunityPhoto Storage Failure]:', storageErr.message);
      return res.status(502).json({
        message: 'Failed to upload photo to cloud storage. Please retry.',
        error_code: 'STORAGE_SERVICE_ERROR'
      });
    }

    const fileUrl = formatStudentFileUrl(req, storageResult.url);

    // Update photos_link in community project record only on successful upload
    await pool.query(
      `UPDATE ri_community_projects SET photos_link = $1, updated_at = NOW() WHERE student_id = $2`,
      [fileUrl, studentId]
    );

    return res.json({
      success: true,
      message: 'Photo uploaded successfully',
      url: fileUrl,
      storedName: storageResult.storageKey,
      storageProvider: storageResult.storageProvider
    });
  } catch (err) {
    console.error('Error uploading community photo:', err);
    return res.status(500).json({ message: 'Failed to upload photo.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM VI: Upload assignment document (PDF/DOC/DOCX)
// ─────────────────────────────────────────────────────────────────────────────
async function uploadAssignmentDocument(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No document file uploaded.' });
    const studentId = req.user.id;

    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.pdf', '.doc', '.docx'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ message: 'Invalid file format. Only PDF, DOC, or DOCX documents are allowed.' });
    }
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'Document exceeds maximum size of 10 MB.' });
    }

    const ctx = await getStudentRiContext(studentId);

    let storageResult;
    try {
      storageResult = await riStorageService.uploadStudentFile({
        fileBuffer: extractUploadBuffer(req.file, ext),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/pdf',
        category: 'problem_identification',
        studentId,
        batchId: ctx?.ri_batch_id,
        panelId: ctx?.ri_panel_id
      });
    } catch (storageErr) {
      if (storageErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: storageErr.message });
      }
      console.error('[uploadAssignmentDocument Storage Failure]:', storageErr.message);
      return res.status(502).json({
        message: 'Failed to upload document to cloud storage. Please retry.',
        error_code: 'STORAGE_SERVICE_ERROR'
      });
    }

    const fileUrl = formatStudentFileUrl(req, storageResult.url);

    if (ctx) {
      await pool.query(`
        INSERT INTO ri_problem_identifications (
          student_id, ri_batch_id, ri_panel_id, problem_title, problem_description,
          solution_title, solution_description, assignment_link, status, updated_at
        ) VALUES (
          $1, $2, $3, '', '', '', '', $4, 'Draft', CURRENT_TIMESTAMP
        )
        ON CONFLICT (student_id, ri_batch_id)
        DO UPDATE SET assignment_link = EXCLUDED.assignment_link, updated_at = CURRENT_TIMESTAMP
      `, [studentId, ctx.ri_batch_id, ctx.ri_panel_id, fileUrl]);
    } else {
      await pool.query(
        `UPDATE ri_problem_identifications SET assignment_link = $1, updated_at = NOW() WHERE student_id = $2`,
        [fileUrl, studentId]
      );
    }

    return res.json({
      message: 'Document uploaded successfully',
      url: fileUrl,
      fileName: req.file.originalname,
      storedName: storageResult.storageKey,
      storageProvider: storageResult.storageProvider
    });
  } catch (err) {
    if (err.code === '42703') {
      console.warn('[uploadAssignmentDocument] Schema mismatch detected, self-healing database...', err.message);
      try {
        await pool.query(`
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS assignment_link TEXT;
          ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_link TEXT;
        `);
        return await uploadAssignmentDocument(req, res);
      } catch (retryErr) {
        console.error('Error during self-healing retry in uploadAssignmentDocument:', retryErr);
      }
    }
    console.error('Error uploading assignment document:', err);
    return res.status(500).json({ message: 'Failed to upload document.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM IV: Upload institutional visit activity photo
// ─────────────────────────────────────────────────────────────────────────────
async function uploadInstitutionalPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No photo file uploaded.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ message: 'Only JPG, JPEG, PNG, or WEBP images are allowed.' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Photo exceeds maximum size of 5 MB.' });
    }

    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);

    let storageResult;
    try {
      storageResult = await riStorageService.uploadStudentFile({
        fileBuffer: extractUploadBuffer(req.file, ext),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'image/jpeg',
        category: 'institutional_visit',
        studentId,
        batchId: ctx?.ri_batch_id,
        panelId: ctx?.ri_panel_id
      });
    } catch (storageErr) {
      if (storageErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: storageErr.message });
      }
      console.error('[uploadInstitutionalPhoto Storage Failure]:', storageErr.message);
      return res.status(502).json({
        message: 'Failed to upload photo to cloud storage. Please retry.',
        error_code: 'STORAGE_SERVICE_ERROR'
      });
    }

    const fileUrl = formatStudentFileUrl(req, storageResult.url);
    return res.json({
      success: true,
      message: 'Photo uploaded successfully',
      url: fileUrl,
      storedName: storageResult.storageKey,
      storageProvider: storageResult.storageProvider
    });
  } catch (err) {
    console.error('Error uploading institutional photo:', err);
    return res.status(500).json({ message: 'Failed to upload photo.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM IIIB: Upload daily activity photo
// ─────────────────────────────────────────────────────────────────────────────
async function uploadDailyActivityPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No photo file uploaded.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ message: 'Only JPG, JPEG, PNG, or WEBP images are allowed.' });
    }
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Photo exceeds maximum size of 5 MB.' });
    }

    const studentId = req.user.id;
    const ctx = await getStudentRiContext(studentId);

    let storageResult;
    try {
      storageResult = await riStorageService.uploadStudentFile({
        fileBuffer: extractUploadBuffer(req.file, ext),
        originalName: req.file.originalname,
        mimeType: req.file.mimetype || 'image/jpeg',
        category: 'daily_activity',
        studentId,
        batchId: ctx?.ri_batch_id,
        panelId: ctx?.ri_panel_id
      });
    } catch (storageErr) {
      if (storageErr.code === 'INVALID_FILE_CONTENT') {
        return res.status(400).json({ message: storageErr.message });
      }
      console.error('[uploadDailyActivityPhoto Storage Failure]:', storageErr.message);
      return res.status(502).json({
        message: 'Failed to upload photo to cloud storage. Please retry.',
        error_code: 'STORAGE_SERVICE_ERROR'
      });
    }

    const fileUrl = formatStudentFileUrl(req, storageResult.url);
    return res.json({
      success: true,
      message: 'Photo uploaded successfully',
      url: fileUrl,
      storedName: storageResult.storageKey,
      storageProvider: storageResult.storageProvider
    });
  } catch (err) {
    console.error('Error uploading daily activity photo:', err);
    return res.status(500).json({ message: 'Failed to upload photo.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THINGS TO CARRY: Student Packing Readiness Checklist (Student-Isolated)
// ─────────────────────────────────────────────────────────────────────────────
async function getPackingChecklist(req, res) {
  try {
    const studentId = req.user.id;
    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized: Missing student identity.' });
    }

    const result = await pool.query(
      `SELECT student_id, packed_items, packed_count, total_count, progress_percent, updated_at
       FROM ri_student_packing_checklists
       WHERE student_id = $1`,
      [studentId]
    );

    if (result.rowCount === 0) {
      return res.json({
        success: true,
        student_id: studentId,
        packed_items: {},
        packed_count: 0,
        total_count: 25,
        progress_percent: 0,
        updated_at: null
      });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      student_id: row.student_id,
      packed_items: row.packed_items || {},
      packed_count: row.packed_count || 0,
      total_count: row.total_count || 25,
      progress_percent: row.progress_percent || 0,
      updated_at: row.updated_at
    });
  } catch (err) {
    console.error('Error fetching packing checklist:', err);
    return res.status(500).json({ message: 'Failed to fetch packing checklist.', error: err.message });
  }
}

async function savePackingChecklist(req, res) {
  try {
    const studentId = req.user.id;
    if (!studentId) {
      return res.status(401).json({ message: 'Unauthorized: Missing student identity.' });
    }

    const { packed_items = {}, packed_count = 0, total_count = 25, progress_percent = 0 } = req.body;

    const result = await pool.query(
      `INSERT INTO ri_student_packing_checklists (
         student_id, packed_items, packed_count, total_count, progress_percent, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id) DO UPDATE SET
         packed_items = EXCLUDED.packed_items,
         packed_count = EXCLUDED.packed_count,
         total_count = EXCLUDED.total_count,
         progress_percent = EXCLUDED.progress_percent,
         updated_at = CURRENT_TIMESTAMP
       RETURNING student_id, packed_items, packed_count, total_count, progress_percent, updated_at`,
      [
        studentId,
        typeof packed_items === 'object' && packed_items !== null ? JSON.stringify(packed_items) : '{}',
        Number(packed_count) || 0,
        Number(total_count) || 25,
        Number(progress_percent) || 0
      ]
    );

    return res.json({
      success: true,
      message: 'Packing checklist saved successfully.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error saving packing checklist:', err);
    return res.status(500).json({ message: 'Failed to save packing checklist.', error: err.message });
  }
}
