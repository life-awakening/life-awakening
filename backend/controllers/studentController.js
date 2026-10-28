const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const storageService = require('../services/storageService');
const { withLtcId } = require('../utils/helpers');
const { getAvailableRoomsForBatch, validateRoomAssignment } = require('../utils/roomHelper');


const getDashboard = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const myData = await pool.query(
      `SELECT u.id, u.system_student_id, u.name, u.email, u.semester, u.department, u.prn, u.red_flag, u.password_changed,
              u.in_current_batch, u.onboarding_completed, u.onboarding_completed_at,
              u.undertaking_submitted, u.undertaking_signed_name, u.undertaking_signed_date, u.tshirt_size,
              u.jain_food, u.monday_fast,
              u.is_squad_leader,
              u.parent_name, u.parent_relationship, u.parent_mobile, u.parent_email, u.address, u.age, u.class_grade,
              u.med_allergies, u.med_asthma, u.med_epilepsy, u.med_medication, u.med_physical_limitation, u.med_dietary_restriction, u.med_other, u.med_details,
              (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Pre-LTC')) AS pre_ltc_submitted,
              u.blood_group, u.known_allergies, u.medical_conditions, u.current_medication, u.dietary_restrictions, u.medical_other,
              u.emergency_contact_name, u.emergency_contact_relation, u.emergency_contact_mobile, u.emergency_contact_alt_mobile, u.emergency_contact_email,
              u.consent_media, u.consent_data, u.consent_checks, u.consent_medical,
              (i.prn IS NOT NULL) as insured, i.policy_number, i.provider,
              bs.batch_id, bs.squad, bs.room, bs.room_designation, bs.squad_designation,
              b.start_date as batch_start_date,
              b.end_date as batch_end_date,
              b.name as batch_name,
              b.status as batch_status,
              u.phone, u.school,
              (SELECT EXISTS(SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Post-LTC')) as post_feedback_submitted,
              (SELECT EXISTS(SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Service-Trainers')) as service_feedback_submitted,
              COALESCE((SELECT value = 'true' FROM system_settings WHERE key = 'batch_' || bs.batch_id || '_post_service_feedback_locked'), false) as post_service_feedback_locked
       FROM users u
       LEFT JOIN insurance i ON u.prn = i.prn
       LEFT JOIN batch_students bs ON u.id = bs.student_id AND bs.batch_id = (
         SELECT bs2.batch_id FROM batch_students bs2
         JOIN batches b2 ON bs2.batch_id = b2.id
         WHERE bs2.student_id = u.id AND (b2.is_deleted = false OR b2.is_deleted IS NULL)
         ORDER BY bs2.batch_id DESC LIMIT 1
       )
       LEFT JOIN batches b ON bs.batch_id = b.id
       WHERE u.id = $1`,
      [studentId]
    );
    const studentObj = myData.rows[0];
    if (!studentObj || !studentObj.batch_id) {
      return res.status(403).json({
        message: 'Access denied: You are not enrolled in an active LTC cohort.',
        has_ltc: false
      });
    }
    let squadFaculty = [];
    let squadLeader = null;
    if (studentObj && studentObj.batch_id && studentObj.squad) {
      const facultyRes = await pool.query(
        `SELECT u.name, u.email, u.phone, u.role, u.designation, u.personal_email, u.department
         FROM batch_faculty bf
         JOIN users u ON bf.faculty_id = u.id
         WHERE bf.batch_id = $1 AND bf.squad = $2`,
        [studentObj.batch_id, studentObj.squad]
      );
      squadFaculty = facultyRes.rows;

      // Fetch squad leader
      const leaderRes = await pool.query(
        `SELECT u.name, 
                CASE WHEN u.email LIKE '%@lifeawakening.internal' THEN NULL ELSE u.email END AS email,
                u.prn, u.phone
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         WHERE bs.batch_id = $1 AND bs.squad = $2 AND bs.is_squad_leader = true
         LIMIT 1`,
        [studentObj.batch_id, studentObj.squad]
      );
      if (leaderRes.rowCount > 0) {
        squadLeader = leaderRes.rows[0];
      }
      // NOTE: The legacy squad_leaders fallback is intentionally removed because
      // that table has no batch_id column and causes cross-batch squad leader
      // leakage when multiple batches share the same squad name.
    }
    const [studentWithLtcId] = studentObj ? await withLtcId([studentObj]) : [null];
    res.json({ message: 'Welcome Student', data: studentWithLtcId, squadFaculty, squadLeader });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getSchedules = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const activeBatchRes = await pool.query(
      `SELECT bs.batch_id FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       ORDER BY bs.batch_id DESC LIMIT 1`,
      [studentId]
    );
    const activeBatchId = activeBatchRes.rowCount > 0 ? activeBatchRes.rows[0].batch_id : null;

    const userRes = await pool.query("SELECT panel FROM users WHERE id = $1", [studentId]);
    const panelStr = userRes.rowCount > 0 ? userRes.rows[0].panel : '';
    const panels = (panelStr || '').split(',').map(p => p.trim()).filter(Boolean);

    let schedules;
    if (activeBatchId) {
      if (panels.length > 0) {
        schedules = await pool.query(
          "SELECT * FROM schedules WHERE (batch_id = $1) AND (panel = 'ALL' OR panel = ANY($2)) ORDER BY id ASC",
          [activeBatchId, panels]
        );
      } else {
        schedules = await pool.query(
          "SELECT * FROM schedules WHERE (batch_id = $1) AND (panel = 'ALL' OR panel = $2) ORDER BY id ASC",
          [activeBatchId, req.user.panel || 'Unassigned']
        );
      }
    } else {
      if (panels.length > 0) {
        schedules = await pool.query(
          "SELECT * FROM schedules WHERE (batch_id IS NULL) AND (panel = 'ALL' OR panel = ANY($1)) ORDER BY id ASC",
          [panels]
        );
      } else {
        schedules = await pool.query(
          "SELECT * FROM schedules WHERE (batch_id IS NULL) AND (panel = 'ALL' OR panel = $1) ORDER BY id ASC",
          [req.user.panel || 'Unassigned']
        );
      }
    }
    res.json({ schedules: schedules.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const att = await pool.query(
      `SELECT a.status, a.pillar, a.day, a.is_locked,
              COALESCE(s.title, 'Pillar: ' || a.pillar || ' - Day ' || a.day) as title,
              COALESCE(s.date, 'Day ' || a.day) as date
       FROM attendance a 
       LEFT JOIN schedules s ON a.schedule_id = s.id 
       WHERE a.student_id = $1 AND (a.day IS NULL OR a.day <= 4)`,
      [studentId]
    );
    res.json({ attendance: att.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getEvaluations = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const evals = await pool.query(
      `SELECT * FROM student_evaluations WHERE student_id = $1 ORDER BY pillar, day`,
      [studentId]
    );
    const summaries = await pool.query(
      `SELECT * FROM final_evaluation_summary WHERE student_id = $1 ORDER BY id DESC`,
      [studentId]
    );
    res.json({ evaluations: evals.rows, summaries: summaries.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const submitInsurance = async (req, res) => {
  const { policy_number, provider } = req.body;
  const studentId = req.studentId || req.user.id;
  try {
    const userRes = await pool.query("SELECT prn FROM users WHERE id = $1", [studentId]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    let prn = userRes.rows[0].prn;
    if (!prn) {
      prn = 'PRN-STU-' + studentId;
      await pool.query("UPDATE users SET prn = $1 WHERE id = $2", [prn, studentId]);
    }
    await pool.query(
      "INSERT INTO insurance (prn, policy_number, provider) VALUES ($1, $2, $3) ON CONFLICT (prn) DO UPDATE SET policy_number = EXCLUDED.policy_number, provider = EXCLUDED.provider",
      [prn, policy_number || 'POLICY-' + studentId, provider || 'Student Submitted']
    );
    res.json({ message: 'Insurance submitted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const submitUndertaking = async (req, res) => {
  const studentId = req.studentId || req.body?.student_id || req.body?.studentId || req.user.id;
  // 1. Program-level authorization: ensure student is enrolled in active LTC batch or exists in users table
  try {
    const ltcCheck = await pool.query(
      `SELECT 1 FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       LIMIT 1`,
      [studentId]
    );
    if (ltcCheck.rowCount === 0) {
      const studentExists = await pool.query(`SELECT 1 FROM users WHERE id = $1`, [studentId]);
      if (studentExists.rowCount === 0) {
        return res.status(403).json({ message: 'Access denied: Student record not found.' });
      }
    }
  } catch (authErr) {
    return res.status(500).json({ message: 'Authorization check failed', error: authErr.message });
  }

  const { 
    signedName, 
    signedDate, 
    tshirtSize,
    jainFood,
    mondayFast,
    bloodGroup,
    knownAllergies,
    medicalConditions,
    currentMedication,
    dietaryRestrictions,
    medicalOther,
    emergencyContactName,
    emergencyContactRelation,
    emergencyContactMobile,
    emergencyContactAltMobile,
    emergencyContactEmail,
    consentMedia,
    consentData,
    consentChecks,
    consentMedical,
    // School Education Undertaking Form fields
    studentName,
    studentAge,
    studentSchool,
    studentClassGrade,
    name,
    age,
    school,
    class_grade,
    parentName,
    parentRelationship,
    parentMobile,
    parentEmail,
    parentAddress,
    medAllergies,
    medAsthma,
    medEpilepsy,
    medMedication,
    medPhysicalLimitation,
    medDietaryRestriction,
    medOther,
    medDetails
  } = req.body;

  try {
    const isMedAllergies = medAllergies === true || medAllergies === 'true';
    const isMedAsthma = medAsthma === true || medAsthma === 'true';
    const isMedEpilepsy = medEpilepsy === true || medEpilepsy === 'true';
    const isMedMedication = medMedication === true || medMedication === 'true';
    const isMedPhysicalLimitation = medPhysicalLimitation === true || medPhysicalLimitation === 'true';
    const isMedDietaryRestriction = medDietaryRestriction === true || medDietaryRestriction === 'true';
    const isMedOther = medOther === true || medOther === 'true';

    // Compile legacy text summary if not explicitly provided
    const medSummary = [];
    if (isMedAllergies) medSummary.push('Allergies');
    if (isMedAsthma) medSummary.push('Asthma');
    if (isMedEpilepsy) medSummary.push('Epilepsy');
    if (isMedMedication) medSummary.push('Medication Requirement');
    if (isMedPhysicalLimitation) medSummary.push('Physical Limitation');
    if (isMedDietaryRestriction) medSummary.push('Dietary Restriction');
    if (isMedOther) medSummary.push('Other Medical Condition');

    const finalKnownAllergies = knownAllergies || (isMedAllergies ? 'Yes' : 'No');
    const finalMedConditions = medicalConditions || (medSummary.length > 0 ? medSummary.join(', ') : 'None');
    const finalMedOther = medDetails || medicalOther || null;

    await pool.query(
      `UPDATE users SET 
        undertaking_submitted = true, 
        undertaking_signed_name = $1, 
        undertaking_signed_date = $2, 
        tshirt_size = $3,
        jain_food = $4,
        monday_fast = $5,
        blood_group = $6,
        known_allergies = $7,
        medical_conditions = $8,
        current_medication = $9,
        dietary_restrictions = $10,
        medical_other = $11,
        emergency_contact_name = $12,
        emergency_contact_relation = $13,
        emergency_contact_mobile = $14,
        emergency_contact_alt_mobile = $15,
        emergency_contact_email = $16,
        consent_media = $17,
        consent_data = $18,
        consent_checks = $19,
        consent_medical = $20,
        photo_video_consent = $21,
        data_consent = $22,
        bag_check_consent = $23,
        tshirt_consent = $24,
        med_allergies = $25,
        med_asthma = $26,
        med_epilepsy = $27,
        med_medication = $28,
        med_physical_limitation = $29,
        med_dietary_restriction = $30,
        med_other = $31,
        med_details = $32,
        parent_name = COALESCE($33, parent_name),
        parent_relationship = COALESCE($34, parent_relationship),
        parent_mobile = COALESCE($35, parent_mobile),
        parent_email = COALESCE($36, parent_email),
        address = COALESCE($37, address),
        nominee_name = COALESCE($33, nominee_name),
        nominee_relationship = COALESCE($34, nominee_relationship),
        parent_consent_confirmed = true,
        onboarding_completed = true,
        onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
        name = COALESCE($38, name),
        age = COALESCE($39, age),
        school = COALESCE($40, school),
        class_grade = COALESCE($41, class_grade)
       WHERE id = $42`,
      [
        signedName, 
        signedDate || new Date().toISOString().split('T')[0], 
        tshirtSize || null,
        jainFood || 'No',
        mondayFast || 'No',
        bloodGroup || null,
        finalKnownAllergies,
        finalMedConditions,
        currentMedication || null,
        dietaryRestrictions || null,
        finalMedOther,
        emergencyContactName || parentName || null,
        emergencyContactRelation || parentRelationship || null,
        emergencyContactMobile || parentMobile || null,
        emergencyContactAltMobile || null,
        emergencyContactEmail || parentEmail || null,
        consentMedia !== undefined ? !!consentMedia : true,
        consentData !== undefined ? !!consentData : true,
        consentChecks !== undefined ? !!consentChecks : true,
        consentMedical !== undefined ? !!consentMedical : true,
        consentMedia !== undefined ? !!consentMedia : true,
        consentData !== undefined ? !!consentData : true,
        consentChecks !== undefined ? !!consentChecks : true,
        true, // tshirt_consent
        isMedAllergies,
        isMedAsthma,
        isMedEpilepsy,
        isMedMedication,
        isMedPhysicalLimitation,
        isMedDietaryRestriction,
        isMedOther,
        medDetails || null,
        parentName || null,
        parentRelationship || null,
        parentMobile || null,
        parentEmail || null,
        parentAddress || null,
        studentName || name || null,
        studentAge || age || null,
        studentSchool || school || null,
        studentClassGrade || class_grade || null,
        studentId
      ]
    );
    res.json({ message: 'Undertaking submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.department, u.school, u.division, u.faculty,
              u.prn, u.roll_number, u.salutation, u.first_name, u.middle_name, u.last_name, u.dob, u.gender,
              u.nationality, u.aadhar_no, u.lateral_entry, u.address, u.panel, u.semester, u.age,
              u.parent_mobile, u.parent_email, u.nominee_name, u.nominee_relationship, u.nominee_email,
              u.parent_name, u.parent_relationship,
              u.med_allergies, u.med_asthma, u.med_epilepsy, u.med_medication, u.med_physical_limitation,
              u.med_dietary_restriction, u.med_other, u.med_details,
              u.undertaking_submitted, u.undertaking_signed_name, u.undertaking_signed_date, u.tshirt_size,
              u.jain_food, u.monday_fast,
              (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Pre-LTC')) AS pre_ltc_submitted,
              (SELECT EXISTS(SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Service-Trainers')) as service_feedback_submitted,
              COALESCE((SELECT value = 'true' FROM system_settings WHERE key = 'batch_' || bs.batch_id || '_post_service_feedback_locked'), false) as post_service_feedback_locked,
              u.blood_group, u.known_allergies, u.medical_conditions, u.current_medication, u.dietary_restrictions, u.medical_other,
              u.emergency_contact_name, u.emergency_contact_relation, u.emergency_contact_mobile, u.emergency_contact_alt_mobile, u.emergency_contact_email,
              u.consent_media, u.consent_data, u.consent_checks, u.consent_medical,
              u.is_squad_leader, bs.squad, bs.room, bs.room_designation, bs.squad_designation,
              b.name as batch_name,
              u.school_branch, u.class_grade, u.has_medical_condition, u.payment_screenshot_url, u.payment_status,
              u.digital_signature_url, u.parent_consent_confirmed
       FROM users u
       LEFT JOIN batch_students bs ON u.id = bs.student_id AND bs.batch_id = (
         SELECT bs2.batch_id FROM batch_students bs2
         JOIN batches b2 ON bs2.batch_id = b2.id
         WHERE bs2.student_id = u.id AND (b2.is_deleted = false OR b2.is_deleted IS NULL)
         ORDER BY bs2.batch_id DESC LIMIT 1
       )
       LEFT JOIN batches b ON bs.batch_id = b.id
       WHERE u.id = $1`,
      [studentId]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    const [profileWithLtcId] = await withLtcId([result.rows[0]]);
    res.json({ profile: profileWithLtcId });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both current and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  try {
    const userRes = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getCertificateData = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    // Check if student has filled service trainee feedback
    const feedbackCheck = await pool.query(
      "SELECT 1 FROM feedback WHERE user_id = $1 AND category = 'Service-Trainers' LIMIT 1",
      [studentId]
    );
    if (feedbackCheck.rowCount === 0) {
      return res.status(403).json({
        message: 'Service & Trainee feedback must be completed to view/download certificates.'
      });
    }

    // Fetch student's name and identity fields
    const userRes = await pool.query(
      `SELECT id, first_name, middle_name, last_name, name, prn, system_student_id FROM users WHERE id = $1`,
      [studentId]
    );
    if (userRes.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    const user = userRes.rows[0];

    // Build full name: first + middle + last, fallback to name (Strip salutations)
    const rawFullName = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(' ') || user.name || 'Student';
    const fullName = rawFullName.replace(/^(mr\.|ms\.|mrs\.|dr\.|prof\.|shri\.|smt\.|mr|ms|mrs|dr|prof|shri|smt)\s+/i, '').trim();

    // Use official canonical Student ID (LAP-BB-MMyy-SS)
    let ltcId = user.system_student_id;
    if (!ltcId) {
      const [userWithLtcId] = await withLtcId([user]);
      ltcId = userWithLtcId ? (userWithLtcId.system_student_id || userWithLtcId.ltc_id) : null;
    }

    // Fetch the student's most recent active batch with start/end dates
    const batchRes = await pool.query(
      `SELECT b.id, b.name, b.start_date, b.end_date
       FROM batches b
       JOIN batch_students bs ON b.id = bs.batch_id
       WHERE bs.student_id = $1
         AND (b.is_deleted = false OR b.is_deleted IS NULL)
       ORDER BY bs.batch_id DESC
       LIMIT 1`,
      [studentId]
    );

    if (batchRes.rowCount === 0) {
      return res.status(404).json({
        message: 'Certificate cannot be generated because your batch information is incomplete.'
      });
    }

    const batch = batchRes.rows[0];

    if (!batch.start_date || !batch.end_date) {
      return res.status(404).json({
        message: 'Certificate cannot be generated because your batch information is incomplete.'
      });
    }

    res.json({
      fullName,
      ltcId,
      studentId: ltcId,
      system_student_id: ltcId,
      batchName: batch.name,
      startDate: batch.start_date,
      endDate: batch.end_date
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getJourneyMedia = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const studentInfoRes = await pool.query(
      `SELECT bs.batch_id, bs.squad
       FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       ORDER BY bs.batch_id DESC LIMIT 1`,
      [studentId]
    );

    if (studentInfoRes.rowCount === 0 || !studentInfoRes.rows[0].batch_id) {
      return res.json({ media: [], data: [], pagination: { page: 1, limit: 20, totalPages: 0, totalCount: 0 } });
    }

    const { batch_id, squad } = studentInfoRes.rows[0];

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM journey_media
       WHERE batch_id = $1 
         AND (squad = $2 OR is_group_photo = TRUE OR squad = 'Batch Group' OR squad = 'All Squads' OR squad = 'ALL' OR squad IS NULL OR squad = '')`,
      [batch_id, squad]
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(totalCount / limit);

    const mediaRes = await pool.query(
      `SELECT jm.*, u.name as uploader_name, u.role as uploader_role, b.name as batch_name
       FROM journey_media jm
       LEFT JOIN users u ON jm.uploaded_by = u.id
       LEFT JOIN batches b ON jm.batch_id = b.id
       WHERE jm.batch_id = $1 
         AND (jm.squad = $2 OR jm.is_group_photo = TRUE OR jm.squad = 'Batch Group' OR jm.squad = 'All Squads' OR jm.squad = 'ALL' OR jm.squad IS NULL OR jm.squad = '')
       ORDER BY COALESCE(jm.is_group_photo, FALSE) DESC, jm.created_at DESC
       LIMIT $3 OFFSET $4`,
      [batch_id, squad, limit, offset]
    );

    const data = mediaRes.rows.map(row => ({
      id: row.id,
      imageUrl: storageService.getFileUrl(row.storage_key || row.media_url, row.storage_type),
      media_type: row.media_type,
      caption: row.caption || '',
      isGroupPhoto: !!row.is_group_photo || row.squad === 'Batch Group',
      originalFileName: row.original_file_name || (row.is_group_photo ? 'batch_group_photo' : 'squad_memory'),
      mimeType: row.mime_type || (row.media_type === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileSize: row.file_size || 0,
      uploadedAt: row.created_at,
      uploaderName: row.uploader_name,
      uploaderRole: row.uploader_role,
      uploadedBy: row.uploaded_by,
      batchId: row.batch_id,
      batch_id: row.batch_id,
      batch_name: row.batch_name || `Batch ${row.batch_id}`,
      batchName: row.batch_name || `Batch ${row.batch_id}`,
      squad: row.squad,
      squadName: row.squad,
      squad_name: row.squad,
      is_group_photo: !!row.is_group_photo || row.squad === 'Batch Group'
    }));

    res.json({
      media: data,
      data,
      batch_id,
      batchId: batch_id,
      squad,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getAvailableRooms = async (req, res) => {
  try {
    const studentId = req.studentId || req.user.id;
    const batchRes = await pool.query(
      `SELECT bs.batch_id, u.gender
       FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       JOIN users u ON bs.student_id = u.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       ORDER BY
         CASE WHEN b.status IN ('active', 'Immersion') THEN 1 ELSE 2 END ASC,
         bs.batch_id DESC
       LIMIT 1`,
      [studentId]
    );

    if (batchRes.rowCount === 0) {
      return res.status(400).json({ message: 'No active batch allocation found for you.' });
    }

    const { batch_id, gender } = batchRes.rows[0];
    const rooms = await getAvailableRoomsForBatch(batch_id, gender);
    res.json({ message: 'Available rooms retrieved successfully.', rooms, batch_id });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve available rooms', error: err.message });
  }
};

const updateMyRoom = async (req, res) => {
  const studentId = req.studentId || req.user.id;
  const { room } = req.body;


  try {
    if (!room || typeof room !== 'string' || !room.trim()) {
      return res.status(400).json({ message: 'Room number is required.' });
    }

    const cleanRoom = room.trim();
    if (cleanRoom.toLowerCase().includes('overfilled')) {
      return res.status(400).json({ message: 'Please select a valid room.' });
    }

    // Resolve student active batch and current room
    const batchRes = await pool.query(
      `SELECT bs.batch_id, bs.room, u.gender
       FROM batch_students bs
       JOIN batches b ON bs.batch_id = b.id
       JOIN users u ON bs.student_id = u.id
       WHERE bs.student_id = $1 AND (b.is_deleted = false OR b.is_deleted IS NULL)
       ORDER BY
         CASE WHEN b.status IN ('active', 'Immersion') THEN 1 ELSE 2 END ASC,
         bs.batch_id DESC
       LIMIT 1`,
      [studentId]
    );

    if (batchRes.rowCount === 0) {
      return res.status(400).json({ message: 'No active batch allocation found for you.' });
    }

    const { batch_id, room: currentRoom } = batchRes.rows[0];

    // Strict Validation: Students can ONLY edit their room if current room is Overfilled
    const isOverfilled = currentRoom && String(currentRoom).toLowerCase().includes('overfilled');
    if (!isOverfilled) {
      return res.status(403).json({ message: 'Room editing is only permitted when your assigned room is Overfilled.' });
    }

    // Validate target room choice
    const valResult = await validateRoomAssignment(batch_id, cleanRoom);
    if (!valResult.valid) {
      return res.status(400).json({ message: valResult.error });
    }

    const newRoom = valResult.room;

    // Update room in batch_students
    await pool.query(
      "UPDATE batch_students SET room = $1 WHERE batch_id = $2 AND student_id = $3",
      [newRoom, batch_id, studentId]
    );

    res.json({ message: `Room updated to ${newRoom} successfully.`, room: newRoom });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const completeOnboarding = async (req, res) => {
  const studentId = req.studentId || req.body?.student_id || req.body?.studentId || req.user.id;
  try {
    const result = await pool.query(
      `UPDATE users
       SET onboarding_completed = true,
           onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
       WHERE id = $1
       RETURNING id, onboarding_completed, onboarding_completed_at`,
      [studentId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Student account not found' });
    }
    return res.json({
      success: true,
      message: 'Onboarding completed successfully',
      onboarding_completed: true,
      onboarding_completed_at: result.rows[0].onboarding_completed_at
    });
  } catch (err) {
    console.error('Error completing onboarding:', err);
    return res.status(500).json({ message: 'Failed to complete onboarding', error: err.message });
  }
};

module.exports = {
  getDashboard,
  getSchedules,
  getAttendance,
  getEvaluations,
  submitInsurance,
  submitUndertaking,
  completeOnboarding,
  getProfile,
  changePassword,
  getCertificateData,
  getJourneyMedia,
  getAvailableRooms,
  updateMyRoom,
};

