const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { withLtcId } = require('../utils/helpers');
const storageService = require('../services/storageService');
const { resolveFacultyBatch } = require('../utils/batchResolver');
const performanceRoleService = require('../services/performanceRoleService');
const squadScoringEngine = require('../services/squadScoringEngine');
const superadminController = require('./superadminController');

const submitUndertaking = async (req, res) => {
  const { 
    signedName, 
    signedDate, 
    tshirtSize, 
    photoVideoConsent, 
    tshirtConsent, 
    dataConsent, 
    bagCheckConsent 
  } = req.body;

  if (!signedName || !signedDate || !tshirtSize || tshirtSize === '-- Select Size --' || 
      !photoVideoConsent || !tshirtConsent || !dataConsent || !bagCheckConsent) {
    return res.status(400).json({ message: 'All consent options, T-shirt size selection, and signature name/date are required.' });
  }

  try {
    await pool.query(
      `UPDATE users 
       SET undertaking_submitted = true, 
           undertaking_signed_name = $1, 
           undertaking_signed_date = $2, 
           tshirt_size = $3,
           photo_video_consent = $4,
           tshirt_consent = $5,
           data_consent = $6,
           bag_check_consent = $7
       WHERE id = $8 AND (role = 'faculty' OR role = 'ltc_member')`,
      [
        signedName, 
        signedDate, 
        tshirtSize, 
        !!photoVideoConsent, 
        !!tshirtConsent, 
        !!dataConsent, 
        !!bagCheckConsent, 
        req.user.id
      ]
    );
    res.json({ message: 'Undertaking submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getDashboard = async (req, res) => {
  try {
    // Resolve the currently-active batch for this faculty / LTC member
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
    const activeBatchId = activeBatchRow ? activeBatchRow.batch_id : null;
    const squadName    = activeBatchRow ? activeBatchRow.squad     : null;

    const facultyUser = await pool.query(
      "SELECT id, name, email, role, designation, department, division, school, panel, undertaking_submitted, undertaking_signed_name, undertaking_signed_date, tshirt_size, photo_video_consent, tshirt_consent, data_consent, bag_check_consent, password_changed FROM users WHERE id = $1",
      [req.user.id]
    );
    const facultyInfo = facultyUser.rows[0];
    if (facultyInfo) {
      facultyInfo.squad = squadName || null;
    }

    let squadLeader = null;
    let squadStudents = [];
    let myStudentsRows = [];

    if (activeBatchId && squadName) {
      // Fetch squad students from the active batch
      const squadStudentsRes = await pool.query(
        `SELECT u.id, u.name, u.email, u.semester, u.department, u.panel, u.nri, u.red_flag, u.gender, u.prn, u.phone,
                u.undertaking_submitted, u.tshirt_size,
                bs.squad, bs.room, bs.barcode, bs.room_designation, bs.squad_designation,
                bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason,
                (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Pre-LTC')) AS pre_ltc_submitted,
                (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Post-LTC')) AS post_ltc_submitted
         FROM users u
         JOIN batch_students bs ON u.id = bs.student_id
         WHERE u.role = 'student' AND bs.batch_id = $1 AND bs.squad = $2`,
        [activeBatchId, squadName]
      );
      squadStudents = squadStudentsRes.rows;
      myStudentsRows = squadStudents;

      // Fetch squad leader
      const leaderRes = await pool.query(
        `SELECT u.name, u.email, u.prn, u.phone
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         WHERE bs.batch_id = $1 AND bs.squad = $2 AND bs.is_squad_leader = true
         LIMIT 1`,
        [activeBatchId, squadName]
      );
      if (leaderRes.rowCount > 0) {
        squadLeader = leaderRes.rows[0];
      }
      // NOTE: The legacy squad_leaders table fallback is intentionally removed
      // because that table has no batch_id column and would cause cross-batch
      // squad leader leakage when multiple batches share the same squad name.
    } else {
      // Fallback behavior if not allocated to a squad in the active batch
      const panels = (req.user.panel || '').split(',').map(p => p.trim()).filter(Boolean);
      let myStudents;
      if (activeBatchId) {
        if (panels.length > 0) {
          myStudents = await pool.query(
            `SELECT u.id, u.name, u.email, u.semester, u.department, u.panel, u.nri, u.red_flag, u.gender, u.prn, u.phone,
                    u.undertaking_submitted, u.tshirt_size, bs.squad, bs.room, bs.barcode, bs.room_designation, bs.squad_designation,
                    bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason,
                    (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Pre-LTC')) AS pre_ltc_submitted,
                    (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Post-LTC')) AS post_ltc_submitted
             FROM users u
             JOIN batch_students bs ON u.id = bs.student_id
             WHERE u.role = 'student' AND bs.batch_id = $1 AND u.panel = ANY($2)`,
            [activeBatchId, panels]
          );
        } else {
          myStudents = await pool.query(
            `SELECT u.id, u.name, u.email, u.semester, u.department, u.panel, u.nri, u.red_flag, u.gender, u.prn, u.phone,
                    u.undertaking_submitted, u.tshirt_size, bs.squad, bs.room, bs.barcode, bs.room_designation, bs.squad_designation,
                    bs.is_dnr, bs.dnr_marked_at, bs.dnr_marked_by_name, bs.dnr_reason,
                    (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Pre-LTC')) AS pre_ltc_submitted,
                    (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = u.id AND category = 'Post-LTC')) AS post_ltc_submitted
             FROM users u
             JOIN batch_students bs ON u.id = bs.student_id
             WHERE u.role = 'student' AND bs.batch_id = $1 AND u.department = $2`,
            [activeBatchId, req.user.department]
          );
        }
      } else {
        if (panels.length > 0) {
          myStudents = await pool.query(
            "SELECT id, name, email, semester, department, panel, nri, red_flag, gender, prn, undertaking_submitted, tshirt_size, (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = id AND category = 'Pre-LTC')) AS pre_ltc_submitted, (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = id AND category = 'Post-LTC')) AS post_ltc_submitted FROM users WHERE role = 'student' AND panel = ANY($1)",
            [panels]
          );
        } else {
          myStudents = await pool.query(
            "SELECT id, name, email, semester, department, panel, nri, red_flag, gender, prn, undertaking_submitted, tshirt_size, (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = id AND category = 'Pre-LTC')) AS pre_ltc_submitted, (SELECT EXISTS (SELECT 1 FROM feedback WHERE user_id = id AND category = 'Post-LTC')) AS post_ltc_submitted FROM users WHERE role = 'student' AND department = $1",
            [req.user.department]
          );
        }
      }
      myStudentsRows = myStudents.rows;
    }

    let batchFaculty = [];
    let coFaculty = null; // The LTC member co-assigned to same squad
    if (activeBatchId && squadName) {
      const batchFacultyRes = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.department, u.school, u.panel, bf.squad, u.role
         FROM users u
         JOIN batch_faculty bf ON u.id = bf.faculty_id
         WHERE bf.batch_id = $1 AND bf.squad = $2`,
        [activeBatchId, squadName]
      );
      batchFaculty = batchFacultyRes.rows;
      // The co-faculty for a MIT faculty is the LTC member in same squad (and vice-versa)
      const coFacultyEntry = batchFaculty.find(f => 
        (req.user.role === 'faculty' ? f.role === 'ltc_member' : f.role === 'faculty') && f.id !== req.user.id
      );
      coFaculty = coFacultyEntry || null;
    }

    res.json({
      message: 'Welcome Faculty',
      data: await withLtcId(myStudentsRows),
      facultyInfo,
      squadLeader,
      squadStudents: await withLtcId(squadStudents),
      batchFaculty,
      coFaculty, // LTC member co-assigned to same squad
      batchDetails: activeBatchRow ? {
        batch_id:     activeBatchRow.batch_id,
        batch_name:   activeBatchRow.batch_name,
        batch_status: activeBatchRow.batch_status,
        start_date:   activeBatchRow.start_date,
        end_date:     activeBatchRow.end_date
      } : null
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const addRedFlag = async (req, res) => {
  const { student_id, category, reason } = req.body;
  try {
    await pool.query(
      "INSERT INTO red_flags (student_id, faculty_id, category, reason) VALUES ($1, $2, $3, $4)",
      [student_id, req.user.id, category, reason]
    );
    await pool.query(
      "UPDATE users SET red_flag = true WHERE id = $1",
      [student_id]
    );
    res.json({ success: true, message: 'Red flag added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add red flag', error: err.message });
  }
};


const createSchedule = async (req, res) => {
  const { title, date, time, panel } = req.body;
  try {
    // Resolve active batch for schedule creation
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
    const activeBatchId  = activeBatchRow ? activeBatchRow.batch_id : null;

    await pool.query(
      "INSERT INTO schedules (batch_id, title, date, time, faculty_id, panel) VALUES ($1, $2, $3, $4, $5, $6)",
      [activeBatchId, title, date, time, req.user.id, panel]
    );
    res.json({ message: 'Schedule created' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query("SELECT * FROM schedules WHERE id = $1 AND faculty_id = $2", [id, req.user.id]);
    if (check.rowCount === 0) return res.status(403).json({ message: 'Unauthorized' });
    await pool.query("DELETE FROM attendance WHERE schedule_id = $1", [id]);
    await pool.query("DELETE FROM evaluations WHERE schedule_id = $1", [id]);
    await pool.query("DELETE FROM schedules WHERE id = $1", [id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateStudentSummary = async (client, studentId, batchId) => {
  const pillars = ['agriculture', 'physical', 'leadership', 'patriotism', 'spirituality'];
  const pMarks = {};
  
  for (const pillar of pillars) {
    const res = await client.query(
      `SELECT SUM(daily_total) as pillar_sum 
       FROM student_evaluations 
       WHERE student_id = $1 AND batch_id = $2 AND pillar = $3`,
      [studentId, batchId, pillar]
    );
    const sumVal = Number(res.rows[0]?.pillar_sum || 0);
    const parsedSum = isNaN(sumVal) ? 0 : sumVal;
    pMarks[pillar] = parsedSum / 5.0; // Max daily_total is 20, sum for 5 days is 100, average out of 20 is sum / 5
  }

  const finalScore = pMarks.agriculture + pMarks.physical + pMarks.leadership + pMarks.patriotism + pMarks.spirituality;

  await client.query(
    `INSERT INTO final_evaluation_summary (
       student_id, batch_id, agriculture_marks, physical_marks, leadership_marks, 
       patriotism_marks, spirituality_marks, final_score_out_of_100, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (student_id, batch_id) 
     DO UPDATE SET 
       agriculture_marks = EXCLUDED.agriculture_marks,
       physical_marks = EXCLUDED.physical_marks,
       leadership_marks = EXCLUDED.leadership_marks,
       patriotism_marks = EXCLUDED.patriotism_marks,
       spirituality_marks = EXCLUDED.spirituality_marks,
       final_score_out_of_100 = EXCLUDED.final_score_out_of_100,
       updated_at = NOW()`,
    [
      studentId,
      batchId,
      pMarks.agriculture,
      pMarks.physical,
      pMarks.leadership,
      pMarks.patriotism,
      pMarks.spirituality,
      finalScore
    ]
  );
};

const submitEvaluation = async (req, res) => {
  const { pillar, day, evaluations } = req.body;
  if (!pillar || !day || !Array.isArray(evaluations)) {
    return res.status(400).json({ message: 'Invalid payload. pillar, day, and evaluations are required.' });
  }

  const dayNum = parseInt(day, 10);
  if (isNaN(dayNum)) {
    return res.status(400).json({ message: 'Invalid day value. Day must be an integer.' });
  }

  const parseMark = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve active batch for the faculty/LTC member submitting evaluations
    const activeBatchRow = await resolveFacultyBatch(client, req.user.id);
    const activeBatchRes = activeBatchRow
      ? { rowCount: 1, rows: [activeBatchRow] }
      : { rowCount: 0, rows: [] };

    let userName = null;
    const hasAnyLocking = evaluations.some(ev => ev.status === 'locked');
    if (hasAnyLocking) {
      const userRes = await client.query("SELECT name FROM users WHERE id = $1", [req.user.id]);
      userName = userRes.rows[0]?.name || 'Unknown';
    }

    for (const ev of evaluations) {
      const {
        student_id,
        attendance_marks,
        participation_marks,
        effort_marks,
        learning_marks,
        discipline_marks,
        reflection_marks,
        remarks,
        status // 'draft' or 'locked'
      } = ev;

      const studentIdNum = parseInt(student_id, 10);
      if (isNaN(studentIdNum)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Invalid student ID: ${student_id}` });
      }

      // Resolve student's active batch details and snapshots
      const studentDetails = await client.query(
        `SELECT bs.batch_id, bs.squad, u.division, u.panel, u.department
         FROM batch_students bs
         JOIN users u ON bs.student_id = u.id
         WHERE bs.student_id = $1 
         ORDER BY bs.batch_id DESC LIMIT 1`,
        [studentIdNum]
      );

      if (studentDetails.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Student ID ${studentIdNum} is not enrolled in any batch.` });
      }

      const { batch_id, squad, division, panel, department } = studentDetails.rows[0];

      // Authorization Check (Skip for Admin role)
      if (req.user.role !== 'admin') {
        let isAllowed = false;
        if (activeBatchRes.rowCount > 0) {
          const { batch_id: facBatchId, squad: facSquad } = activeBatchRes.rows[0];
          if (Number(facBatchId) === Number(batch_id)) {
            if (facSquad) {
              if (facSquad === squad) {
                isAllowed = true;
              }
            } else {
              // Fallback check matching dashboard logic: check panels list or department
              const panels = (req.user.panel || '').split(',').map(p => p.trim()).filter(Boolean);
              if (panels.length > 0) {
                if (panels.includes(panel)) {
                  isAllowed = true;
                }
              } else if (req.user.department && req.user.department === department) {
                isAllowed = true;
              }
            }
          }
        }

        if (!isAllowed) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: `Unauthorized: Student ID ${studentIdNum} is not in your assigned squad or panel.` });
        }
      }

      // Check if existing evaluation is already locked
      const existing = await client.query(
        "SELECT id, status, attendance_marks, participation_marks, effort_marks, learning_marks, discipline_marks, reflection_marks, daily_total, remarks FROM student_evaluations WHERE student_id = $1 AND batch_id = $2 AND pillar = $3 AND day = $4",
        [studentIdNum, batch_id, pillar, dayNum]
      );

      if (existing.rowCount > 0 && existing.rows[0].status === 'locked') {
        continue;
      }

      // Clamp marks values according to rubric limits
      const attVal = Math.min(Math.max(parseMark(attendance_marks), 0), 4);
      const partVal = Math.min(Math.max(parseMark(participation_marks), 0), 4);
      const effVal = Math.min(Math.max(parseMark(effort_marks), 0), 4);
      const lrVal = Math.min(Math.max(parseMark(learning_marks), 0), 3);
      const discVal = Math.min(Math.max(parseMark(discipline_marks), 0), 3);
      const refVal = Math.min(Math.max(parseMark(reflection_marks), 0), 2);
      const dailyTotal = attVal + partVal + effVal + lrVal + discVal + refVal;

      let evalId;
      const isLocking = status === 'locked';

      if (existing.rowCount > 0) {
        evalId = existing.rows[0].id;
        
        // Log changes if marks differ
        const oldRow = existing.rows[0];
        const hasChanged = Number(oldRow.attendance_marks) !== attVal ||
                           Number(oldRow.participation_marks) !== partVal ||
                           Number(oldRow.effort_marks) !== effVal ||
                           Number(oldRow.learning_marks) !== lrVal ||
                           Number(oldRow.discipline_marks) !== discVal ||
                           Number(oldRow.reflection_marks) !== refVal ||
                           oldRow.remarks !== (remarks || null);

        if (hasChanged) {
          const oldValues = {
            attendance_marks: Number(oldRow.attendance_marks),
            participation_marks: Number(oldRow.participation_marks),
            effort_marks: Number(oldRow.effort_marks),
            learning_marks: Number(oldRow.learning_marks),
            discipline_marks: Number(oldRow.discipline_marks),
            reflection_marks: Number(oldRow.reflection_marks),
            daily_total: Number(oldRow.daily_total),
            remarks: oldRow.remarks
          };
          const newValues = {
            attendance_marks: attVal,
            participation_marks: partVal,
            effort_marks: effVal,
            learning_marks: lrVal,
            discipline_marks: discVal,
            reflection_marks: refVal,
            daily_total: dailyTotal,
            remarks: remarks || null
          };

          await client.query(
            `INSERT INTO evaluation_logs (evaluation_id, student_id, old_values, new_values, changed_by, change_reason)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [evalId, studentIdNum, JSON.stringify(oldValues), JSON.stringify(newValues), req.user.id, isLocking ? 'Locked Marks Submit' : 'Draft Update']
          );
        }

        // Update record
        await client.query(
          `UPDATE student_evaluations 
           SET squad = $1, division = $2, attendance_marks = $3, participation_marks = $4, 
               effort_marks = $5, learning_marks = $6, discipline_marks = $7, reflection_marks = $8, 
               daily_total = $9, remarks = $10, evaluated_by = $11, status = $12,
               locked_by = CASE WHEN $13::boolean THEN $11::integer ELSE locked_by END,
               locked_at = CASE WHEN $13::boolean THEN NOW() ELSE locked_at END,
               locked_by_name = CASE WHEN $13::boolean THEN $14::varchar ELSE locked_by_name END,
               updated_at = NOW()
           WHERE id = $15`,
          [
            squad, division, attVal, partVal, effVal, lrVal, discVal, refVal, 
            dailyTotal, remarks || null, req.user.id, status || 'draft', isLocking, userName, evalId
          ]
        );
      } else {
        // Insert record
        const insertRes = await client.query(
          `INSERT INTO student_evaluations (
             student_id, batch_id, squad, division, pillar, day, attendance_marks, participation_marks, 
             effort_marks, learning_marks, discipline_marks, reflection_marks, daily_total, remarks, 
             evaluated_by, status, locked_by, locked_at, locked_by_name, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             CASE WHEN $17::boolean THEN $15::integer ELSE NULL END,
             CASE WHEN $17::boolean THEN NOW() ELSE NULL END,
             CASE WHEN $17::boolean THEN $18::varchar ELSE NULL END,
             NOW()
           ) RETURNING id`,
          [
            studentIdNum, batch_id, squad, division, pillar, dayNum, attVal, partVal, 
            effVal, lrVal, discVal, refVal, dailyTotal, remarks || null, req.user.id, 
            status || 'draft', isLocking, userName
          ]
        );
        evalId = insertRes.rows[0].id;

        const newValues = {
          attendance_marks: attVal,
          participation_marks: partVal,
          effort_marks: effVal,
          learning_marks: lrVal,
          discipline_marks: discVal,
          reflection_marks: refVal,
          daily_total: dailyTotal,
          remarks: remarks || null
        };
        await client.query(
          `INSERT INTO evaluation_logs (evaluation_id, student_id, old_values, new_values, changed_by, change_reason)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [evalId, studentIdNum, null, JSON.stringify(newValues), req.user.id, isLocking ? 'Locked Marks Creation' : 'Draft Creation']
        );
      }

      // Update Student Summary
      await updateStudentSummary(client, studentIdNum, batch_id);
    }

    await client.query('COMMIT');
    res.json({ message: 'Evaluations saved successfully' });
  } catch (err) {
    console.error('Error in submitEvaluation:', err);
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Server error during evaluation save', error: err.message });
  } finally {
    client.release();
  }
};

const getEvaluations = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const evals = await pool.query("SELECT * FROM student_evaluations");
      const summaries = await pool.query("SELECT * FROM final_evaluation_summary");
      return res.json({ evaluations: evals.rows, summaries: summaries.rows });
    }

    // Resolve active batch for evaluation retrieval
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);

    let queryStudents;
    if (activeBatchRow) {
      const { batch_id, squad } = activeBatchRow;
      if (squad) {
        queryStudents = await pool.query(
          `SELECT student_id FROM batch_students WHERE batch_id = $1 AND squad = $2`,
          [batch_id, squad]
        );
      } else {
        const facultyUser = await pool.query("SELECT department, panel FROM users WHERE id = $1", [req.user.id]);
        const { department, panel } = facultyUser.rows[0];
        const panels = (panel || '').split(',').map(p => p.trim()).filter(Boolean);
        if (panels.length > 0) {
          queryStudents = await pool.query(
            `SELECT student_id FROM batch_students bs JOIN users u ON bs.student_id = u.id WHERE bs.batch_id = $1 AND u.panel = ANY($2)`,
            [batch_id, panels]
          );
        } else {
          queryStudents = await pool.query(
            `SELECT student_id FROM batch_students bs JOIN users u ON bs.student_id = u.id WHERE bs.batch_id = $1 AND u.department = $2`,
            [batch_id, department]
          );
        }
      }
    } else {
      const facultyUser = await pool.query("SELECT department, panel FROM users WHERE id = $1", [req.user.id]);
      if (facultyUser.rowCount > 0) {
        const { department, panel } = facultyUser.rows[0];
        const panels = (panel || '').split(',').map(p => p.trim()).filter(Boolean);
        if (panels.length > 0) {
          queryStudents = await pool.query(`SELECT id as student_id FROM users WHERE role = 'student' AND panel = ANY($1)`, [panels]);
        } else {
          queryStudents = await pool.query(`SELECT id as student_id FROM users WHERE role = 'student' AND department = $1`, [department]);
        }
      }
    }

    if (queryStudents && queryStudents.rowCount > 0) {
      const studentIds = queryStudents.rows.map(r => r.student_id);
      const evals = await pool.query(
        `SELECT * FROM student_evaluations WHERE student_id = ANY($1)`,
        [studentIds]
      );
      const summaries = await pool.query(
        `SELECT * FROM final_evaluation_summary WHERE student_id = ANY($1)`,
        [studentIds]
      );
      res.json({ evaluations: evals.rows, summaries: summaries.rows });
    } else {
      res.json({ evaluations: [], summaries: [] });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const unlockEvaluation = async (req, res) => {
  const { student_id, pillar, day } = req.body;
  if (!student_id) {
    return res.status(400).json({ message: 'student_id is required' });
  }

  try {
    let query = `
      UPDATE student_evaluations 
      SET status = 'draft',
          unlocked_by = $1,
          unlocked_at = NOW(),
          locked_by = NULL,
          locked_at = NULL,
          locked_by_name = NULL
      WHERE student_id = $2`;
    
    const params = [req.user.id, student_id];

    if (pillar) {
      query += " AND pillar = $3";
      params.push(pillar);
      if (day) {
        query += " AND day = $4";
        params.push(day);
      }
    }

    await pool.query(query, params);

    // Re-calculate the student summary
    const studentDetails = await pool.query(
      `SELECT bs.batch_id FROM batch_students bs WHERE bs.student_id = $1 ORDER BY bs.batch_id DESC LIMIT 1`,
      [student_id]
    );
    if (studentDetails.rowCount > 0) {
      const batchId = studentDetails.rows[0].batch_id;
      const client = await pool.connect();
      try {
        await updateStudentSummary(client, student_id, batchId);
      } finally {
        client.release();
      }
    }

    res.json({ message: 'Evaluation unlocked successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error unlocking evaluation', error: err.message });
  }
};

const getAttendanceRecords = async (req, res) => {
  try {
    let att;
    if (req.user.role === 'admin') {
      const { batch_id, batchId, day, pillar, squad, student_id, all, page, limit } = req.query;
      const targetBatchId = batch_id || batchId;

      const whereClauses = [];
      const params = [];

      if (targetBatchId) {
        whereClauses.push(`(a.batch_id = $${params.length + 1} OR a.schedule_id IN (SELECT id FROM schedules WHERE batch_id = $${params.length + 1}))`);
        params.push(parseInt(targetBatchId, 10));
      } else if (all !== 'true' && !student_id) {
        // Default to active/latest batch when no batch or student filter is passed,
        // avoiding an accidental full table scan across 30,000+ historical rows
        const activeBatchRes = await pool.query(
          `SELECT id FROM batches 
           WHERE (status IN ('active', 'Immersion') AND is_deleted IS NOT TRUE)
           ORDER BY id DESC LIMIT 1`
        );
        const resolvedBatchId = activeBatchRes.rows[0]?.id;
        if (resolvedBatchId) {
          whereClauses.push(`(a.batch_id = $${params.length + 1} OR a.schedule_id IN (SELECT id FROM schedules WHERE batch_id = $${params.length + 1}))`);
          params.push(resolvedBatchId);
        }
      }

      if (day) {
        whereClauses.push(`a.day = $${params.length + 1}`);
        params.push(parseInt(day, 10));
      }
      if (pillar) {
        whereClauses.push(`a.pillar = $${params.length + 1}`);
        params.push(pillar);
      }
      if (student_id) {
        whereClauses.push(`a.student_id = $${params.length + 1}`);
        params.push(parseInt(student_id, 10));
      }
      if (squad) {
        whereClauses.push(`a.student_id IN (SELECT student_id FROM batch_students WHERE ($${params.length + 1}::int IS NULL OR batch_id = $${params.length + 1}) AND squad = $${params.length + 2})`);
        params.push(targetBatchId ? parseInt(targetBatchId, 10) : null);
        params.push(squad);
      }

      whereClauses.push(`(a.day IS NULL OR a.day <= 4)`);

      let query = `SELECT a.* FROM attendance a`;
      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }
      query += ` ORDER BY a.id ASC`;

      if (page || limit) {
        const p = Math.max(1, parseInt(page) || 1);
        const l = Math.min(1000, Math.max(1, parseInt(limit) || 100));
        const offset = (p - 1) * l;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(l, offset);
      }

      att = await pool.query(query, params);
    } else {
      // Resolve active batch for attendance record retrieval
      const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
      if (activeBatchRow) {
        const { batch_id, squad } = activeBatchRow;
        att = await pool.query(
          `SELECT a.* FROM attendance a
           WHERE (a.batch_id = $1 OR a.schedule_id IN (SELECT id FROM schedules WHERE batch_id = $1))
             AND (a.day IS NULL OR a.day <= 4)
             AND a.student_id IN (
               SELECT student_id FROM batch_students
               WHERE batch_id = $1 AND ($2::text IS NULL OR squad = $2)
             )`,
          [batch_id, squad || null]
        );
      } else {
        // Fallback: any attendance for students the faculty has access to
        att = await pool.query(
          `SELECT a.* FROM attendance a
           WHERE (a.day IS NULL OR a.day <= 4)
             AND a.student_id IN (
             SELECT bs.student_id FROM batch_students bs
             JOIN batch_faculty bf ON bs.batch_id = bf.batch_id AND bs.squad = bf.squad
             WHERE bf.faculty_id = $1
           )`,
          [req.user.id]
        );
      }
    }
    res.json({ records: att.rows });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const markAttendance = async (req, res) => {
  const { schedule_id, student_id, status, is_locked, pillar, day, batch_id } = req.body;
  try {
    const parsedStudentId = student_id ? parseInt(student_id, 10) : null;
    const parsedBatchId = batch_id ? parseInt(batch_id, 10) : null;
    const parsedDay = day ? parseInt(day, 10) : null;
    const parsedScheduleId = schedule_id ? parseInt(schedule_id, 10) : null;
    const statusVal = status === undefined ? null : status;

    if (parsedDay && (parsedDay < 1 || parsedDay > 4)) {
      return res.status(400).json({ message: 'Invalid attendance day. Life Awakening attendance only supports Days 1 to 4.' });
    }

    if (req.user.role === 'faculty' || req.user.role === 'ltc_member') {
      // Resolve active batch for attendance write authorization
      const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);

      let isAllowed = false;
      if (activeBatchRow) {
        const { batch_id: activeBatchId, squad } = activeBatchRow;
        if (squad) {
          const studentSquadCheck = await pool.query(
            `SELECT 1 FROM batch_students 
             WHERE student_id = $1 AND batch_id = $2 AND squad = $3`,
            [parsedStudentId, activeBatchId, squad]
          );
          if (studentSquadCheck.rowCount > 0) {
            isAllowed = true;
          }
        }
      }
      
      if (!isAllowed) {
        // Fallback checks (panel or department)
        const facultyUser = await pool.query(
          "SELECT department, panel FROM users WHERE id = $1",
          [req.user.id]
        );
        if (facultyUser.rowCount > 0) {
          const { department, panel } = facultyUser.rows[0];
          const panels = (panel || '').split(',').map(p => p.trim()).filter(Boolean);
          if (panels.length > 0) {
            const check = await pool.query(
              "SELECT 1 FROM users WHERE id = $1 AND role = 'student' AND panel = ANY($2)",
              [parsedStudentId, panels]
            );
            if (check.rowCount > 0) isAllowed = true;
          } else {
            const check = await pool.query(
              "SELECT 1 FROM users WHERE id = $1 AND role = 'student' AND department = $2",
              [parsedStudentId, department]
            );
            if (check.rowCount > 0) isAllowed = true;
          }
        }
      }
      
      if (!isAllowed) {
        return res.status(403).json({ message: 'Unauthorized: This student is not allocated to you.' });
      }
    }

    // Check if attendance is already locked
    let existing;
    if (pillar && parsedDay && parsedBatchId) {
      existing = await pool.query(
        "SELECT is_locked FROM attendance WHERE student_id = $1 AND batch_id = $2 AND pillar = $3 AND day = $4",
        [parsedStudentId, parsedBatchId, pillar, parsedDay]
      );
    } else {
      existing = await pool.query(
        "SELECT is_locked FROM attendance WHERE schedule_id = $1 AND student_id = $2",
        [parsedScheduleId, parsedStudentId]
      );
    }
    if (existing.rowCount > 0 && existing.rows[0].is_locked) {
      return res.status(400).json({ message: 'This attendance record is locked and cannot be edited.' });
    }

    let userName = null;
    let lockedAt = null;
    if (is_locked) {
      const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [req.user.id]);
      userName = userRes.rows[0]?.name || 'Unknown';
      lockedAt = new Date();
    }

    if (pillar && parsedDay && parsedBatchId) {
      const exist = await pool.query(
        "SELECT id FROM attendance WHERE student_id = $1 AND batch_id = $2 AND pillar = $3 AND day = $4",
        [parsedStudentId, parsedBatchId, pillar, parsedDay]
      );
      if (exist.rowCount > 0) {
        await pool.query(
          "UPDATE attendance SET status = $1, is_locked = $2, locked_by_name = $3, locked_at = $4 WHERE student_id = $5 AND batch_id = $6 AND pillar = $7 AND day = $8",
          [statusVal, is_locked || false, userName, lockedAt, parsedStudentId, parsedBatchId, pillar, parsedDay]
        );
      } else {
        await pool.query(
          "INSERT INTO attendance (student_id, batch_id, pillar, day, status, is_locked, locked_by_name, locked_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [parsedStudentId, parsedBatchId, pillar, parsedDay, statusVal, is_locked || false, userName, lockedAt]
        );
      }
    } else {
      const exist = await pool.query(
        "SELECT id FROM attendance WHERE schedule_id = $1 AND student_id = $2",
        [parsedScheduleId, parsedStudentId]
      );
      if (exist.rowCount > 0) {
        await pool.query(
          "UPDATE attendance SET status = $1, is_locked = $2, locked_by_name = $3, locked_at = $4 WHERE schedule_id = $5 AND student_id = $6",
          [statusVal, is_locked || false, userName, lockedAt, parsedScheduleId, parsedStudentId]
        );
      } else {
        await pool.query(
          "INSERT INTO attendance (schedule_id, student_id, status, is_locked, locked_by_name, locked_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [parsedScheduleId, parsedStudentId, statusVal, is_locked || false, userName, lockedAt]
        );
      }
    }
    res.json({ message: 'Attendance marked successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const toggleStudentDnr = async (req, res) => {
  const { studentId } = req.params;
  const { batch_id, is_dnr, reason } = req.body;

  try {
    const parsedStudentId = parseInt(studentId, 10);
    if (!parsedStudentId) {
      return res.status(400).json({ message: 'Valid studentId is required.' });
    }

    let targetBatchId = batch_id ? parseInt(batch_id, 10) : null;
    let coordinatorSquad = null;

    // Authorization: if faculty or ltc_member, enforce squad coordinator restriction
    if (req.user.role === 'faculty' || req.user.role === 'ltc_member') {
      const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
      if (!activeBatchRow || !activeBatchRow.batch_id || !activeBatchRow.squad) {
        return res.status(403).json({ message: 'Access denied: You are not currently assigned to any active batch squad.' });
      }
      targetBatchId = activeBatchRow.batch_id;
      coordinatorSquad = activeBatchRow.squad;

      // Verify that this student is assigned to this squad coordinator's squad
      const studentCheck = await pool.query(
        `SELECT bs.batch_id, bs.squad, u.name 
         FROM batch_students bs 
         JOIN users u ON bs.student_id = u.id 
         WHERE bs.student_id = $1 AND bs.batch_id = $2`,
        [parsedStudentId, targetBatchId]
      );

      if (studentCheck.rowCount === 0) {
        return res.status(404).json({ message: 'Student not found in this batch.' });
      }

      const studentSquad = studentCheck.rows[0].squad;
      if (String(studentSquad || '').trim().toLowerCase() !== String(coordinatorSquad).trim().toLowerCase()) {
        return res.status(403).json({ 
          message: `Access denied: You can only mark DNR for students in your assigned squad (${coordinatorSquad}). This student belongs to ${studentSquad || 'another squad'}.` 
        });
      }
    } else if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      if (!targetBatchId) {
        const bRes = await pool.query("SELECT id FROM batches WHERE status = 'active' ORDER BY id DESC LIMIT 1");
        targetBatchId = bRes.rows[0]?.id;
      }
      if (!targetBatchId) {
        return res.status(400).json({ message: 'batch_id is required for admin/superadmin.' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    const isDnrBool = Boolean(is_dnr);
    const dnrMarkedByName = isDnrBool ? (req.user.name || req.user.email || 'Squad Coordinator') : null;
    const dnrReason = isDnrBool ? (reason || 'Did Not Report on Day 1') : null;

    const updateRes = await pool.query(
      `UPDATE batch_students 
       SET is_dnr = $1, 
           dnr_marked_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
           dnr_marked_by = CASE WHEN $1 = true THEN $2::int ELSE NULL END,
           dnr_marked_by_name = CASE WHEN $1 = true THEN $3::varchar ELSE NULL END,
           dnr_reason = CASE WHEN $1 = true THEN $4::text ELSE NULL END
       WHERE student_id = $5 AND batch_id = $6
       RETURNING *`,
      [isDnrBool, req.user.id, dnrMarkedByName, dnrReason, parsedStudentId, targetBatchId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ message: 'Student enrollment not found in this batch.' });
    }

    // When marking DNR = true, also mark Day 1 attendance (and all 5 pillars) as absent
    if (isDnrBool) {
      const pillars = ['agriculture', 'physical', 'leadership', 'patriotism', 'spirituality', 'bag_checking'];
      for (const p of pillars) {
        const exist = await pool.query(
          "SELECT id, is_locked FROM attendance WHERE student_id = $1 AND batch_id = $2 AND pillar = $3 AND day = 1",
          [parsedStudentId, targetBatchId, p]
        );
        if (exist.rowCount > 0) {
          await pool.query(
            `UPDATE attendance 
             SET status = 'absent', is_locked = true, locked_by_name = $1, locked_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [`DNR: ${dnrMarkedByName}`, exist.rows[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO attendance (student_id, batch_id, pillar, day, status, is_locked, locked_by_name, locked_at)
             VALUES ($1, $2, $3, 1, 'absent', true, $4, CURRENT_TIMESTAMP)`,
            [parsedStudentId, targetBatchId, p, `DNR: ${dnrMarkedByName}`]
          );
        }
      }
    } else {
      // If DNR is removed, clear the locked DNR attendance marks
      await pool.query(
        `UPDATE attendance 
         SET is_locked = false, locked_by_name = NULL, locked_at = NULL
         WHERE student_id = $1 AND batch_id = $2 AND day = 1 AND locked_by_name LIKE 'DNR:%'`,
        [parsedStudentId, targetBatchId]
      );
    }

    res.json({
      success: true,
      message: isDnrBool ? 'Student successfully marked as DNR (Did Not Report).' : 'DNR status successfully removed.',
      student: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error in toggleStudentDnr:', err);
    res.status(500).json({ message: 'Server error updating DNR status', error: err.message });
  }
};

const assignPanel = async (req, res) => {
  const { student_id, panel } = req.body;
  try {
    await pool.query("UPDATE users SET panel = $1 WHERE id = $2 AND role = 'student'", [panel, student_id]);
    res.json({ message: 'Panel updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateSquadLeader = async (req, res) => {
  const { studentId } = req.body;
  try {
    if (!studentId) return res.status(400).json({ message: 'Student ID is required.' });

    // Resolve active batch for squad leader update
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);

    if (!activeBatchRow) {
      return res.status(400).json({ message: 'No active batch or squad found for you.' });
    }

    const { batch_id, squad } = activeBatchRow;
    if (!squad) {
      return res.status(400).json({ message: 'You are not assigned to any squad.' });
    }

    // 2. Verify the student belongs to the same batch and squad
    const studentSquadCheck = await pool.query(
      `SELECT u.name, u.email, u.prn, u.phone
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.student_id = $1 AND bs.batch_id = $2 AND bs.squad = $3`,
      [studentId, batch_id, squad]
    );

    if (studentSquadCheck.rowCount === 0) {
      return res.status(400).json({ message: 'Selected student is not in your allocated squad.' });
    }

    const studentInfo = studentSquadCheck.rows[0];

    // 3. Clear existing squad leader in batch_students for this batch and squad (batch-scoped)
    await pool.query(
      `UPDATE batch_students
       SET is_squad_leader = false
       WHERE batch_id = $1 AND squad = $2`,
      [batch_id, squad]
    );

    // 4. Set the new squad leader in batch_students (batch-scoped)
    await pool.query(
      `UPDATE batch_students
       SET is_squad_leader = true
       WHERE batch_id = $1 AND student_id = $2 AND squad = $3`,
      [batch_id, studentId, squad]
    );

    // NOTE: Steps 5 & 6 (writing users.is_squad_leader) and Step 7 (squad_leaders legacy table)
    // are intentionally removed. The users.is_squad_leader column has no batch scope and
    // would cause the same student to appear as squad leader in every batch sharing the
    // same squad name. The squad_leaders table has no batch_id column and cannot distinguish
    // between batches. The authoritative source is batch_students.is_squad_leader which is
    // correctly scoped by (batch_id, squad).

    res.json({ message: 'Squad leader updated successfully.', squadLeader: studentInfo });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateSquadDesignation = async (req, res) => {
  const { studentId, batchId, squad_designation } = req.body;
  try {
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required.' });
    }

    // 1. Resolve batch_id
    let targetBatchId = batchId ? parseInt(batchId) : null;
    if (!targetBatchId) {
      const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
      if (activeBatchRow) targetBatchId = activeBatchRow.batch_id;
    }

    if (!targetBatchId) {
      return res.status(400).json({ message: 'Active batch is required.' });
    }

    // 2. Fetch student record in batch_students and gender from users
    const studentRes = await pool.query(
      `SELECT bs.student_id, bs.batch_id, bs.squad, bs.squad_designation, u.name, u.gender
       FROM batch_students bs
       JOIN users u ON bs.student_id = u.id
       WHERE bs.student_id = $1 AND bs.batch_id = $2`,
      [studentId, targetBatchId]
    );

    if (studentRes.rowCount === 0) {
      return res.status(400).json({ message: 'Student is not enrolled in this batch.' });
    }

    const studentRecord = studentRes.rows[0];
    const studentSquad = studentRecord.squad;

    if (!studentSquad || studentSquad.trim() === '' || studentSquad === '—') {
      return res.status(400).json({ message: 'Student must be assigned to a squad before assigning a designation.' });
    }

    // 3. Authorization check: If faculty/ltc_member and limited to a squad, verify student is in their squad
    if (req.user.role === 'faculty' || req.user.role === 'ltc_member') {
      const facultyBatchRow = await resolveFacultyBatch(pool, req.user.id);
      if (facultyBatchRow && facultyBatchRow.squad && facultyBatchRow.squad !== studentSquad && req.user.role === 'faculty') {
        return res.status(403).json({ message: 'You can only manage designations for students in your allocated squad.' });
      }
    }

    // 4. Normalize designation
    let finalDesignation = squad_designation ? String(squad_designation).trim() : null;
    if (finalDesignation === '' || finalDesignation === '—' || finalDesignation === 'None' || finalDesignation === 'Member' || finalDesignation === 'null') {
      finalDesignation = null;
    }

    const validDesignations = ['Captain', 'Vice Captain (Boy)', 'Vice Captain (Girl)', null];
    if (!validDesignations.includes(finalDesignation)) {
      return res.status(400).json({ message: 'Invalid squad designation specified.' });
    }

    // 5. Gender Validation for Vice Captains
    const gender = studentRecord.gender ? studentRecord.gender.trim().toLowerCase() : '';
    const isMale = (gender === 'male' || gender === 'm');
    const isFemale = (gender === 'female' || gender === 'f');

    if (finalDesignation === 'Vice Captain (Boy)') {
      if (!isMale) {
        return res.status(400).json({ message: 'Vice Captain (Boy) must be assigned to a male student.' });
      }
    } else if (finalDesignation === 'Vice Captain (Girl)') {
      if (!isFemale) {
        return res.status(400).json({ message: 'Vice Captain (Girl) must be assigned to a female student.' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 6. Uniqueness Enforcement per Squad per Batch:
      // If setting Captain, VC Boy, or VC Girl, clear that role from any previous student in the SAME squad & batch
      if (finalDesignation) {
        await client.query(
          `UPDATE batch_students
           SET squad_designation = NULL,
               is_squad_leader = false
           WHERE batch_id = $1 AND squad = $2 AND squad_designation = $3 AND student_id != $4`,
          [targetBatchId, studentSquad, finalDesignation, studentId]
        );
      }

      // 7. Update target student
      const isLeader = (finalDesignation === 'Captain');
      await client.query(
        `UPDATE batch_students
         SET squad_designation = $1,
             is_squad_leader = $2
         WHERE batch_id = $3 AND student_id = $4`,
        [finalDesignation, isLeader, targetBatchId, studentId]
      );

      await client.query('COMMIT');

      res.json({
        message: finalDesignation ? `Assigned ${finalDesignation} to ${studentRecord.name}.` : `Cleared role for ${studentRecord.name}.`,
        studentId,
        squad: studentSquad,
        squad_designation: finalDesignation,
        is_squad_leader: isLeader
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, status, department, school, division, faculty,
              faculty_id, designation, salutation, first_name, middle_name, last_name, dob, gender,
              nationality, aadhar_no, address, panel,
              parent_mobile, parent_email, nominee_name, nominee_relationship, nominee_email,
              undertaking_submitted, undertaking_signed_name, undertaking_signed_date, created_at, password_changed
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ profile: result.rows[0] });
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

// Helper to check and enforce upload quota for Coordinators (minimum 20 photos required for photo submission; max 2 videos per batch)
const checkCoordinatorUploadLimit = async (clientOrPool, userId, activeBatchId, isVideo, batchPhotosCount) => {
  const userRes = await clientOrPool.query("SELECT id, role, designation FROM users WHERE id = $1", [userId]);
  const user = userRes.rows[0];
  const isSquadCoordinator = (user?.designation && (user.designation.toLowerCase().includes('coordinator') || user.designation.toLowerCase().includes('squad coordinator'))) || 
    user?.role === 'squad_coordinator' || user?.role === 'coordinator' || user?.role === 'ltc_coordinator';

  if (!isSquadCoordinator) {
    return { isSquadCoordinator: false, isCoordinator: false };
  }

  const MIN_PHOTO_REQUIREMENT = 20;
  const VIDEO_LIMIT = 2;

  let photoCount = 0;
  let videoCount = 0;

  if (activeBatchId) {
    const countRes = await clientOrPool.query(
      `SELECT media_type, COUNT(*) as count 
       FROM journey_media 
       WHERE batch_id = $1 AND uploaded_by = $2 
       GROUP BY media_type`,
      [activeBatchId, userId]
    );

    countRes.rows.forEach(r => {
      const type = (r.media_type || '').toLowerCase();
      if (type === 'video') videoCount += parseInt(r.count, 10);
      else photoCount += parseInt(r.count, 10);
    });
  }

  if (isVideo !== undefined) {
    if (isVideo && videoCount >= VIDEO_LIMIT) {
      const err = new Error(`Upload limit reached: Coordinators can upload a maximum of ${VIDEO_LIMIT} videos for this batch.`);
      err.statusCode = 403;
      throw err;
    }
  }

  return {
    isSquadCoordinator: true,
    isCoordinator: true,
    minPhotosRequired: MIN_PHOTO_REQUIREMENT,
    minPhotoRequirement: MIN_PHOTO_REQUIREMENT,
    photoCount,
    videoCount,
    videoLimit: VIDEO_LIMIT,
    remainingVideos: Math.max(0, VIDEO_LIMIT - videoCount)
  };
};

const getJourneyMedia = async (req, res) => {
  try {
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
    const activeBatchId = activeBatchRow?.batch_id || null;

    const mediaRes = await pool.query(
      `SELECT jm.*, u.name as uploader_name, u.role as uploader_role, b.name as batch_name
       FROM journey_media jm
       LEFT JOIN users u ON jm.uploaded_by = u.id
       LEFT JOIN batches b ON jm.batch_id = b.id
       WHERE (
         (jm.batch_id, jm.squad) IN (
           SELECT bf.batch_id, bf.squad FROM batch_faculty bf WHERE bf.faculty_id = $1
         )
         OR (
           (jm.batch_id IN (SELECT bf.batch_id FROM batch_faculty bf WHERE bf.faculty_id = $1)
            OR ($2::int IS NOT NULL AND jm.batch_id = $2::int))
           AND (jm.is_group_photo = TRUE OR jm.squad = 'Batch Group')
         )
         OR jm.uploaded_by = $1
       )
       ORDER BY COALESCE(jm.is_group_photo, FALSE) DESC, jm.created_at DESC`,
      [req.user.id, activeBatchId]
    );

    const data = mediaRes.rows.map(row => ({
      id: row.id,
      imageUrl: storageService.getFileUrl(row.storage_key || row.media_url, row.storage_type),
      media_type: row.media_type,
      caption: row.caption || '',
      isGroupPhoto: !!row.is_group_photo || row.squad === 'Batch Group',
      is_group_photo: !!row.is_group_photo || row.squad === 'Batch Group',
      originalFileName: row.original_file_name || (row.is_group_photo ? 'batch_group_photo' : 'squad_memory'),
      mimeType: row.mime_type || (row.media_type === 'video' ? 'video/mp4' : 'image/jpeg'),
      fileSize: row.file_size || 0,
      uploadedAt: row.created_at,
      uploaderName: row.uploader_name,
      uploaderRole: row.uploader_role,
      uploadedBy: row.uploaded_by,
      batchId: row.batch_id,
      batch_id: row.batch_id,
      batchName: row.batch_name || 'Unassigned Batch',
      batch_name: row.batch_name || 'Unassigned Batch',
      squad: row.squad || 'Unassigned Squad',
      squadName: row.squad || 'Unassigned Squad'
    }));

    // Resolve upload quota metadata for squad coordinators
    const quota = await checkCoordinatorUploadLimit(pool, req.user.id, activeBatchRow?.batch_id);
    if (quota.isSquadCoordinator) {
      quota.batchId = activeBatchRow ? activeBatchRow.batch_id : null;
      quota.batchName = activeBatchRow ? activeBatchRow.batch_name : null;
      quota.squad = activeBatchRow ? activeBatchRow.squad : null;
    }

    res.json({
      media: data,
      data,
      uploadQuota: quota,
      batch_id: activeBatchRow?.batch_id,
      batchId: activeBatchRow?.batch_id,
      batch_name: activeBatchRow?.batch_name,
      batchName: activeBatchRow?.batch_name
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


function parseBase64(base64Data, originalFileName) {
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid file format: Not a valid base64 string.');
  }
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  let ext = 'bin';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = 'jpg';
  else if (mimeType === 'image/png') ext = 'png';
  else if (mimeType === 'image/webp') ext = 'webp';
  else if (mimeType === 'video/mp4') ext = 'mp4';
  else {
    if (originalFileName && originalFileName.includes('.')) {
      ext = originalFileName.split('.').pop();
    }
  }

  const cleanBaseName = originalFileName
    ? originalFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_")
    : "upload";
  const uniqueName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  return {
    buffer,
    mimeType,
    fileName: uniqueName,
    fileSize: buffer.length
  };
}

const getJourneyPresignedUrl = async (req, res) => {
  const { fileName, mimeType, fileSize, media_type } = req.body;
  if (!fileName || !mimeType) {
    return res.status(400).json({ message: 'fileName and mimeType are required.' });
  }

  try {
    // Resolve active batch for presigned URL generation
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);

    if (!activeBatchRow || !activeBatchRow.batch_id || !activeBatchRow.squad) {
      return res.status(400).json({ message: 'You must be assigned to a batch and squad to upload media.' });
    }

    const isVideo = (mimeType && mimeType.startsWith('video/')) || media_type === 'video';
    const maxSize = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    const numSize = parseInt(fileSize || 0, 10);

    if (numSize > maxSize) {
      return res.status(400).json({ message: `File size exceeds the limit. Max size for images is 50MB, and for videos is 500MB.` });
    }

    // Check Coordinator upload quota (minimum 20 photos required, max 2 videos per batch)
    const rawBatchPhotos = req.body.batch_photos_count || req.headers['x-batch-photos-count'] || req.body.photo_count;
    const batchPhotosCount = rawBatchPhotos !== undefined ? parseInt(rawBatchPhotos, 10) : undefined;
    await checkCoordinatorUploadLimit(pool, req.user.id, activeBatchRow.batch_id, isVideo, batchPhotosCount);

    const storageType = process.env.STORAGE_TYPE || 'local';

    if (storageType === 's3') {
      if (isVideo && numSize > 100 * 1024 * 1024) {
        const result = await storageService.initiateMultipartUpload(fileName, mimeType);
        return res.json({
          uploadType: 'multipart',
          uploadId: result.uploadId,
          storageKey: result.storageKey,
          fileUrl: result.fileUrl,
          partSize: 10 * 1024 * 1024
        });
      } else {
        const result = await storageService.getPresignedUploadUrl(fileName, mimeType);
        return res.json({
          uploadType: 'presigned',
          uploadUrl: result.uploadUrl,
          storageKey: result.storageKey,
          fileUrl: result.fileUrl
        });
      }
    } else {
      return res.json({
        uploadType: 'local',
        storageKey: fileName
      });
    }
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error generating upload URL', error: err.message });
  }
};

const getJourneyMultipartPartUrl = async (req, res) => {
  const { key, uploadId, partNumber } = req.body;
  if (!key || !uploadId || !partNumber) {
    return res.status(400).json({ message: 'key, uploadId, and partNumber are required.' });
  }
  try {
    const result = await storageService.getPresignedPartUrl(key, uploadId, parseInt(partNumber, 10));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error generating part upload URL', error: err.message });
  }
};

const completeJourneyMultipartUpload = async (req, res) => {
  const { key, uploadId, parts } = req.body;
  if (!key || !uploadId || !Array.isArray(parts)) {
    return res.status(400).json({ message: 'key, uploadId, and parts array are required.' });
  }
  try {
    const result = await storageService.completeMultipartUpload(key, uploadId, parts);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ message: 'Error completing multipart upload', error: err.message });
  }
};

const abortJourneyMultipartUpload = async (req, res) => {
  const { key, uploadId } = req.body;
  if (!key || !uploadId) {
    return res.status(400).json({ message: 'key and uploadId are required.' });
  }
  try {
    await storageService.abortMultipartUpload(key, uploadId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Error aborting multipart upload', error: err.message });
  }
};

const uploadJourneyMedia = async (req, res) => {
  const { media_type, media_url, storage_key, mime_type, file_size, original_file_name, caption } = req.body;
  if (!media_type || (!media_url && !storage_key)) {
    return res.status(400).json({ message: 'Media type and media URL/key are required.' });
  }

  const client = await pool.connect();
  try {
    // Resolve active batch for journey media upload
    const activeBatchRow = await resolveFacultyBatch(client, req.user.id);

    if (!activeBatchRow || !activeBatchRow.batch_id || !activeBatchRow.squad) {
      client.release();
      return res.status(400).json({ message: 'You must be assigned to a batch and squad to upload media.' });
    }

    const { batch_id, squad } = activeBatchRow;

    let finalStorageKey = storage_key;
    let finalMediaUrl = media_url;
    let finalMimeType = mime_type || (media_type === 'video' ? 'video/mp4' : 'image/jpeg');
    let finalFileSize = parseInt(file_size || 0, 10);
    let storageType = process.env.STORAGE_TYPE || 'local';

    if (storage_key) {
      finalMediaUrl = storageService.getFileUrl(storage_key, storageType);
    } else if (media_url && media_url.startsWith('data:')) {
      let parsed;
      try {
        parsed = parseBase64(media_url, original_file_name);
      } catch (e) {
        client.release();
        return res.status(400).json({ message: e.message });
      }

      const { buffer, mimeType: parsedMime, fileName, fileSize: parsedSize } = parsed;

      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4'];
      if (!allowedMimeTypes.includes(parsedMime)) {
        client.release();
        return res.status(400).json({ message: 'Invalid file format. Only JPEG, PNG, WEBP images and MP4 videos are allowed.' });
      }

      const isVideo = parsedMime === 'video/mp4';
      const maxSize = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
      if (parsedSize > maxSize) {
        client.release();
        return res.status(400).json({ message: `File size exceeds the limit. Max size for images is 50MB, and for videos is 500MB.` });
      }

      const storageResult = await storageService.uploadFile(buffer, fileName, parsedMime);
      finalStorageKey = storageResult.storageKey;
      finalMediaUrl = storageResult.fileUrl;
      finalMimeType = parsedMime;
      finalFileSize = parsedSize;
    }

    await client.query('BEGIN');
    // Lock user row to serialize simultaneous uploads and ensure quota accuracy
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);

    const isVideoItem = media_type === 'video' || (finalMimeType && finalMimeType.startsWith('video/'));
    const rawBatchPhotos = req.body.batch_photos_count || req.headers['x-batch-photos-count'] || req.body.photo_count;
    const batchPhotosCount = rawBatchPhotos !== undefined ? parseInt(rawBatchPhotos, 10) : undefined;
    await checkCoordinatorUploadLimit(client, req.user.id, batch_id, isVideoItem, batchPhotosCount);

    const insertRes = await client.query(
      `INSERT INTO journey_media (
         batch_id, squad, uploaded_by, media_type, media_url, caption,
         original_file_name, storage_type, storage_key, mime_type, file_size
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        batch_id, 
        squad, 
        req.user.id, 
        media_type, 
        finalMediaUrl, 
        caption || '',
        original_file_name || 'squad_memory',
        storageType,
        finalStorageKey,
        finalMimeType,
        finalFileSize
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Journey media uploaded successfully.', media: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
};

const uploadJourneyMediaBatch = async (req, res) => {
  const { items, media_type, batch_photos_count } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Items array is required and must not be empty.' });
  }

  const client = await pool.connect();
  try {
    const activeBatchRow = await resolveFacultyBatch(client, req.user.id);
    if (!activeBatchRow || !activeBatchRow.batch_id || !activeBatchRow.squad) {
      client.release();
      return res.status(400).json({ message: 'You must be assigned to a batch and squad to upload media.' });
    }

    const { batch_id, squad } = activeBatchRow;
    const quota = await checkCoordinatorUploadLimit(client, req.user.id, batch_id);

    const isCoordinator = quota.isSquadCoordinator;
    const videoItems = items.filter(i => (i.media_type || media_type) === 'video');

    if (isCoordinator && videoItems.length > 0) {
      if (quota.videoCount + videoItems.length > quota.videoLimit) {
        client.release();
        return res.status(403).json({
          message: `Upload limit reached: Coordinators can upload a maximum of ${quota.videoLimit} videos for this batch.`
        });
      }
    }

    await client.query('BEGIN');
    const inserted = [];
    for (const item of items) {
      const mType = item.media_type || media_type || 'photo';
      const storageType = item.storage_type || process.env.STORAGE_TYPE || 'local';
      const fileUrl = item.media_url || (item.storage_key ? storageService.getFileUrl(item.storage_key, storageType) : '');

      const insertRes = await client.query(
        `INSERT INTO journey_media (
           batch_id, squad, uploaded_by, media_type, media_url, caption,
           original_file_name, storage_type, storage_key, mime_type, file_size
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          batch_id,
          squad,
          req.user.id,
          mType,
          fileUrl,
          item.caption || '',
          item.original_file_name || 'squad_memory',
          storageType,
          item.storage_key || null,
          item.mime_type || (mType === 'video' ? 'video/mp4' : 'image/jpeg'),
          parseInt(item.file_size || 0, 10)
        ]
      );
      inserted.push(insertRes.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({
      message: `${inserted.length} media items uploaded successfully.`,
      media: inserted
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
};

const deleteJourneyMedia = async (req, res) => {
  const { id } = req.params;
  try {
    const mediaRes = await pool.query("SELECT * FROM journey_media WHERE id = $1", [id]);
    if (mediaRes.rowCount === 0) {
      return res.status(404).json({ message: 'Media not found.' });
    }
    const media = mediaRes.rows[0];

    if (media.uploaded_by !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only delete media you uploaded.' });
    }

    if (media.storage_key) {
      await storageService.deleteFile(media.storage_key);
    }

    await pool.query("DELETE FROM journey_media WHERE id = $1", [id]);
    res.json({ message: 'Media deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const uploadJourneyBinaryMedia = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const { media_type, caption } = req.body;
  const mimeType = req.file.mimetype || (media_type === 'video' ? 'video/mp4' : 'image/jpeg');
  const originalFileName = req.file.originalname || 'squad_memory';
  const fileSize = req.file.size;

  const client = await pool.connect();
  try {
    // Resolve active batch for binary media upload
    const activeBatchRow = await resolveFacultyBatch(client, req.user.id);

    if (!activeBatchRow || !activeBatchRow.batch_id || !activeBatchRow.squad) {
      client.release();
      return res.status(400).json({ message: 'You must be assigned to a batch and squad to upload media.' });
    }

    const { batch_id, squad } = activeBatchRow;
    const isVideoItem = media_type === 'video' || (mimeType && mimeType.startsWith('video/'));

    await client.query('BEGIN');
    // Lock user row to serialize simultaneous uploads and ensure quota accuracy
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const rawBatchPhotos = req.body.batch_photos_count || req.headers['x-batch-photos-count'] || req.body.photo_count;
    const batchPhotosCount = rawBatchPhotos !== undefined ? parseInt(rawBatchPhotos, 10) : undefined;
    await checkCoordinatorUploadLimit(client, req.user.id, batch_id, isVideoItem, batchPhotosCount);

    const storageResult = await storageService.uploadFile(req.file.buffer, originalFileName, mimeType);

    const insertRes = await client.query(
      `INSERT INTO journey_media (
         batch_id, squad, uploaded_by, media_type, media_url, caption,
         original_file_name, storage_type, storage_key, mime_type, file_size
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        batch_id, 
        squad, 
        req.user.id, 
        media_type || (mimeType.startsWith('video/') ? 'video' : 'photo'), 
        storageResult.fileUrl, 
        caption || '',
        originalFileName,
        process.env.STORAGE_TYPE || 'local',
        storageResult.storageKey,
        mimeType,
        fileSize
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Journey media uploaded successfully.', media: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error', error: err.message });
  } finally {
    client.release();
  }
};

const getMyPerformanceRoles = async (req, res) => {
  try {
    const roles = await performanceRoleService.getUserPerformanceRoles(req.user.id);
    res.json({ success: true, roles });
  } catch (err) {
    console.error('Error in getMyPerformanceRoles:', err);
    res.status(500).json({ message: 'Failed to fetch assigned performance roles', error: err.message });
  }
};

const getPerformanceAdminActivities = async (req, res) => {
  try {
    const userRoles = await performanceRoleService.getUserPerformanceRoles(req.user.id);
    if (!userRoles || userRoles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have any Performance Admin roles assigned.'
      });
    }

    // Fetch target batch (if specified in query) or active batch
    let activeBatch = null;
    const reqBatchId = req.query.batchId ? parseInt(req.query.batchId, 10) : null;

    if (reqBatchId && !isNaN(reqBatchId)) {
      const targetBatchRes = await pool.query(
        "SELECT id, name, location, start_date, end_date, status, batch_code, year, capacity FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE",
        [reqBatchId]
      );
      if (targetBatchRes.rowCount > 0) {
        activeBatch = targetBatchRes.rows[0];
      }
    }

    if (!activeBatch) {
      const activeBatchRes = await pool.query(
        "SELECT id, name, location, start_date, end_date, status, batch_code, year, capacity FROM batches WHERE LOWER(status) IN ('active', 'immersion') AND is_deleted IS NOT TRUE ORDER BY id DESC LIMIT 1"
      );
      if (activeBatchRes.rowCount > 0) {
        activeBatch = activeBatchRes.rows[0];
      } else {
        const latestBatchRes = await pool.query(
          "SELECT id, name, location, start_date, end_date, status, batch_code, year, capacity FROM batches WHERE is_deleted IS NOT TRUE ORDER BY id DESC LIMIT 1"
        );
        if (latestBatchRes.rowCount > 0) {
          activeBatch = latestBatchRes.rows[0];
        }
      }
    }

    // Fetch all available batches for dropdown
    const allBatchesRes = await pool.query(
      "SELECT id, name, location, start_date, end_date, status, batch_code, year, capacity FROM batches WHERE is_deleted IS NOT TRUE ORDER BY id DESC"
    );
    const batches = allBatchesRes.rows;

    if (!activeBatch) {
      return res.json({
        success: true,
        batch: null,
        batches,
        userRoles,
        allowedActivities: [],
        dayActivities: {},
        selections: [],
        squads: squadScoringEngine.SQUAD_CANONICAL_NAMES
      });
    }

    // Get allowed activity titles based on assigned roles
    const allowedTitles = performanceRoleService.getActivitiesForRoles(userRoles);

    // Build dayActivities map filtered strictly to allowed activities
    const dayActivities = {};
    const rawDaysMap = squadScoringEngine.DAY_ACTIVITIES_MAP || {};
    for (const [dayKey, acts] of Object.entries(rawDaysMap)) {
      dayActivities[dayKey] = (acts || []).filter(a => allowedTitles.includes(a.title));
    }

    // Fetch current squad performance selections and demographics for target batch
    const [selRes, demographics] = await Promise.all([
      pool.query(
        `SELECT s.*, u.name as selected_by_name, lu.name as locked_by_name
         FROM squad_performance_selections s
         LEFT JOIN users u ON s.selected_by = u.id
         LEFT JOIN users lu ON s.locked_by = lu.id
         WHERE s.batch_id = $1 AND s.activity_title = ANY($2)
         ORDER BY s.selected_at ASC`,
        [activeBatch.id, allowedTitles]
      ),
      superadminController.getBatchGenderDemographics(activeBatch.id)
    ]);

    res.json({
      success: true,
      batch: activeBatch,
      batches,
      userRoles,
      allowedActivities: allowedTitles,
      dayActivities,
      selections: selRes.rows,
      demographics,
      squads: squadScoringEngine.SQUAD_CANONICAL_NAMES
    });
  } catch (err) {
    console.error('Error in getPerformanceAdminActivities:', err);
    res.status(500).json({ message: 'Failed to fetch performance admin activities', error: err.message });
  }
};

module.exports = {
  submitUndertaking,
  getDashboard,
  addRedFlag,
  createSchedule,
  deleteSchedule,
  submitEvaluation,
  getEvaluations,
  unlockEvaluation,
  getAttendanceRecords,
  markAttendance,
  toggleStudentDnr,
  assignPanel,
  updateSquadLeader,
  updateSquadDesignation,
  getProfile,
  changePassword,
  getJourneyMedia,
  uploadJourneyMedia,
  uploadJourneyMediaBatch,
  deleteJourneyMedia,
  getJourneyPresignedUrl,
  getJourneyMultipartPartUrl,
  completeJourneyMultipartUpload,
  abortJourneyMultipartUpload,
  uploadJourneyBinaryMedia,
  getMyPerformanceRoles,
  getPerformanceAdminActivities
};
