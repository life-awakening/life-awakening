const pool = require('../config/db');
const { resolveFacultyBatch } = require('../utils/batchResolver');

const getDashboard = async (req, res) => {
  try {
    const statsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'student') AS total_students,
        COUNT(DISTINCT squad) FILTER (WHERE role = 'student' AND squad IS NOT NULL) AS total_squads,
        COUNT(DISTINCT room) FILTER (WHERE role = 'student' AND room IS NOT NULL) AS total_rooms,
        COUNT(*) FILTER (WHERE role = 'student' AND nri = true) AS nri_count,
        COUNT(*) FILTER (WHERE role = 'student' AND red_flag = true) AS red_flag_count
      FROM users
    `);
    const s = statsRes.rows[0];
    const studentsRes = await pool.query(
      "SELECT id, name, email, semester, department, division, school, panel, squad, room, barcode, nri, red_flag, is_squad_leader, phone, prn, gender FROM users WHERE role = 'student' ORDER BY id ASC"
    );
    const docRes = await pool.query("SELECT * FROM documents WHERE target_role = 'all' OR target_role = 'faculty'");
    const squadLeadersRes = await pool.query("SELECT * FROM squad_leaders");

    // Resolve the currently-active batch for this LTC member
    const activeBatchRow = await resolveFacultyBatch(pool, req.user.id);
    const activeBatchId = activeBatchRow ? activeBatchRow.batch_id : null;
    const squadName    = activeBatchRow ? activeBatchRow.squad     : null;

    let allocatedSquadStudents = [];
    let batchFaculty = [];
    let coFaculty = null; // The MIT (normal) faculty co-assigned to same squad
    if (activeBatchId && squadName) {
      const studentsRes = await pool.query(
        `SELECT u.id, u.name, u.email, u.prn, u.phone, u.semester, u.department, u.division, u.school, u.panel, u.nri, u.red_flag, u.undertaking_submitted, bs.squad, bs.room, bs.barcode
         FROM users u
         JOIN batch_students bs ON u.id = bs.student_id
         WHERE u.role = 'student' AND bs.batch_id = $1 AND bs.squad = $2`,
        [activeBatchId, squadName]
      );
      allocatedSquadStudents = studentsRes.rows;

      // Fetch all faculty in this batch assigned to this squad (for display)
      const batchFacultyRes = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.department, u.school, u.panel, bf.squad, u.role
         FROM users u
         JOIN batch_faculty bf ON u.id = bf.faculty_id
         WHERE bf.batch_id = $1 AND bf.squad = $2`,
        [activeBatchId, squadName]
      );
      batchFaculty = batchFacultyRes.rows;

      // The co-faculty for an LTC member is the normal 'faculty' in same squad
      const coFacultyEntry = batchFaculty.find(f => f.role === 'faculty' && f.id !== req.user.id);
      coFaculty = coFacultyEntry || null;
    }

    const feedbackSubmittedRes = await pool.query(
      "SELECT DISTINCT user_id FROM feedback WHERE role = 'student'"
    );
    const feedbackSubmittedIds = feedbackSubmittedRes.rows.map(r => r.user_id);

    res.json({
      stats: {
        totalStudents: parseInt(s.total_students),
        totalSquads: parseInt(s.total_squads),
        totalRooms: parseInt(s.total_rooms),
        nriCount: parseInt(s.nri_count),
        redFlagCount: parseInt(s.red_flag_count),
      },
      students: studentsRes.rows,
      documents: docRes.rows,
      squadLeaders: squadLeadersRes.rows,
      allocatedSquad: squadName,
      allocatedSquadStudents: allocatedSquadStudents,
      batchFaculty,
      coFaculty, // MIT faculty co-assigned to same squad
      feedbackSubmittedIds
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updateSquadLeader = async (req, res) => {
  const { studentId } = req.body;
  try {
    if (!studentId) return res.status(400).json({ message: 'Student ID is required.' });

    // 1. Resolve the currently-active batch and squad of the logged-in LTC member
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

module.exports = {
  getDashboard,
  updateSquadLeader,
};
