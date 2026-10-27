/**
 * Life Awakening — School-Student Admin Controller
 *
 * Dedicated endpoints for the Life Awakening Student Directory and the
 * mixed-class / mixed-school batch assignment workflow.
 *
 * Data model (reused, nothing duplicated):
 *  - users (role = 'student')           → the student; users.id is the permanent internal Student ID
 *  - parent_students (parent_id, student_id, is_primary, relationship)
 *  - users (role = 'parent')            → parent / guardian login accounts
 *  - batches / batch_students           → batch membership (PK batch_id + student_id)
 *
 * Security:
 *  - Routes are protected with authMiddleware(['admin']) (superadmin passes; read-only
 *    superadmins are GET-only by middleware design).
 *  - No password hashes, tokens or secrets are ever selected.
 *  - The student's internal system login email is NEVER returned as a parent email.
 */
const pool = require('../config/db');
const { writeAudit, createSystemNotification } = require('../utils/helpers');
const { normalizeClassGrade } = require('../utils/classNormalizer');

const STUDENT_ID_PREFIX = 'LA-';
const PARENT_PLACEHOLDER_NAMES = new Set(['parent / guardian', 'parent', 'guardian']);
const MAX_ASSIGN_PER_REQUEST = 2000;

/** Deterministic, readable display ID derived from the permanent users.id */
const formatStudentId = (id) => `${STUDENT_ID_PREFIX}${String(id).padStart(5, '0')}`;

/** Derive a single payment state from stored fields */
const derivePaymentState = (row) => {
  const s = String(row.payment_status || '').toLowerCase().trim();
  if (s === 'verified') return 'verified';
  if (s === 'rejected') return 'rejected';
  if (s === 'submitted' || row.payment_screenshot_url) return 'submitted';
  return 'pending';
};

/**
 * Shared SQL: one row per student with linked parents aggregated in a stable order
 * (primary first, then link creation order, then parent id) and batch memberships.
 * Only safe, non-secret columns are selected.
 */
const buildStudentQuery = ({ batchId = null } = {}) => {
  const params = [];
  let batchJoin = '';
  if (batchId !== null) {
    params.push(batchId);
    batchJoin = `JOIN batch_students target_bs ON target_bs.student_id = u.id AND target_bs.batch_id = $${params.length}`;
  }
  const sql = `
    SELECT
      u.id, u.name, u.class_grade, u.school, u.school_branch, u.roll_number, u.division,
      u.phone, u.parent_mobile, u.emergency_contact_alt_mobile, u.parent_email AS profile_parent_email,
      u.nominee_name, u.nominee_relationship, u.gender, u.dob, u.status,
      u.payment_status, u.payment_screenshot_url, u.payment_verified_at,
      u.parent_consent_confirmed, u.digital_signature_url, u.created_at,
      ${batchId !== null ? 'target_bs.added_at AS batch_added_at,' : ''}
      COALESCE((
        SELECT json_agg(json_build_object(
                 'id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone,
                 'relationship', ps.relationship, 'is_primary', ps.is_primary
               ) ORDER BY ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC)
        FROM parent_students ps
        JOIN users p ON p.id = ps.parent_id
        WHERE ps.student_id = u.id
      ), '[]'::json) AS parents,
      COALESCE((
        SELECT json_agg(json_build_object('id', b.id, 'name', b.name, 'status', b.status) ORDER BY b.id)
        FROM batch_students bs2
        JOIN batches b ON b.id = bs2.batch_id AND b.is_deleted IS NOT TRUE
        WHERE bs2.student_id = u.id
      ), '[]'::json) AS batches
    FROM users u
    ${batchJoin}
    WHERE u.role = 'student'
      AND NOT EXISTS (
        SELECT 1 FROM ri_batch_students rbs
        WHERE rbs.student_id = u.id AND rbs.source_program = 'RI_DIRECT'
      )
    ORDER BY u.id ASC`;
  return { sql, params };
};

/** Shape a DB row into the Life Awakening directory record */
const shapeStudent = (row) => {
  const parents = Array.isArray(row.parents) ? row.parents : [];
  const parent1 = parents[0] || null;
  const parent2 = parents[1] || null;

  // Guardian name: real parent account name, otherwise the nominee captured at registration.
  let guardianName = null;
  if (parent1 && parent1.name && !PARENT_PLACEHOLDER_NAMES.has(String(parent1.name).toLowerCase().trim())) {
    guardianName = parent1.name;
  } else if (row.nominee_name) {
    guardianName = row.nominee_name;
  }

  return {
    id: row.id,
    student_id: formatStudentId(row.id),
    name: row.name,
    class_grade: normalizeClassGrade(row.class_grade) || row.class_grade || null,
    school: row.school || null,
    school_branch: row.school_branch || null,
    roll_number: row.roll_number || null,
    division: row.division || null,
    guardian_name: guardianName,
    guardian_relationship: (parent1 && parent1.relationship) || row.nominee_relationship || null,
    parent1_email: parent1 ? parent1.email : null,
    parent2_email: parent2 ? parent2.email : null,
    parent_1_email: parent1 ? parent1.email : null,
    parent_2_email: parent2 ? parent2.email : null,
    parents_linked: parents.length,
    parents,
    // Stored on the student profile; shown only as a hint when no parent account is linked.
    profile_parent_email: parents.length === 0 ? (row.profile_parent_email || null) : null,
    contact_number: row.parent_mobile || row.phone || (parent1 && parent1.phone) || null,
    alt_contact_number: row.emergency_contact_alt_mobile || null,
    gender: row.gender || null,
    dob: row.dob || null,
    status: row.status || null,
    payment_status: derivePaymentState(row),
    payment_status_raw: row.payment_status || null,
    payment_screenshot_url: row.payment_screenshot_url || null,
    payment_verified_at: row.payment_verified_at || null,
    consent_status: row.parent_consent_confirmed ? 'confirmed' : 'pending',
    digital_signature_url: row.digital_signature_url || null,
    batches: Array.isArray(row.batches) ? row.batches : [],
    batch_added_at: row.batch_added_at || null,
    created_at: row.created_at
  };
};

/**
 * GET /api/admin/la/students
 * Full Life Awakening student directory with both parent emails and batch memberships.
 */
const getLaStudents = async (req, res) => {
  try {
    const { sql, params } = buildStudentQuery();
    const result = await pool.query(sql, params);
    res.json({ students: result.rows.map(shapeStudent) });
  } catch (err) {
    console.error('[LA] getLaStudents error:', err);
    res.status(500).json({ message: 'Server error fetching students' });
  }
};

/**
 * GET /api/admin/la/batches/:id/students
 * Students assigned to one batch (with parent contact information).
 */
const getLaBatchStudents = async (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }
  try {
    const bRes = await pool.query(
      `SELECT id, name, status, description, year, capacity, start_date, end_date
       FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE`,
      [batchId]
    );
    if (bRes.rowCount === 0) return res.status(404).json({ message: 'Batch not found' });

    const { sql, params } = buildStudentQuery({ batchId });
    const result = await pool.query(sql, params);
    res.json({ batch: bRes.rows[0], students: result.rows.map(shapeStudent) });
  } catch (err) {
    console.error('[LA] getLaBatchStudents error:', err);
    res.status(500).json({ message: 'Server error fetching batch students' });
  }
};

/**
 * POST /api/admin/la/batches/:id/assign   body: { student_ids: number[] }
 *
 * Assigns selected students to a batch. Students from ANY class (6th–10th), school
 * or branch may share the same batch — class / school are never eligibility rules.
 * Duplicate membership in the same batch is prevented (PK + explicit pre-check).
 */
const assignLaStudentsToBatch = async (req, res) => {
  const batchId = parseInt(req.params.id, 10);
  if (!Number.isInteger(batchId) || batchId <= 0) {
    return res.status(400).json({ message: 'Invalid batch id' });
  }

  const raw = req.body && req.body.student_ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ message: 'student_ids must be a non-empty array' });
  }
  const requestedIds = [...new Set(raw.map(v => parseInt(v, 10)).filter(n => Number.isInteger(n) && n > 0))];
  if (requestedIds.length === 0) {
    return res.status(400).json({ message: 'No valid student ids supplied' });
  }
  if (requestedIds.length > MAX_ASSIGN_PER_REQUEST) {
    return res.status(400).json({ message: `Too many students in one request (max ${MAX_ASSIGN_PER_REQUEST}).` });
  }

  const client = await pool.connect();
  let batch;
  const addedIds = [];
  let alreadyInBatch = 0;
  let capacitySkipped = 0;
  let notFound = 0;
  try {
    await client.query('BEGIN');

    // Lock the batch row so concurrent assignments cannot exceed capacity.
    const bRes = await client.query(
      `SELECT id, name, capacity FROM batches WHERE id = $1 AND is_deleted IS NOT TRUE FOR UPDATE`,
      [batchId]
    );
    if (bRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Batch not found' });
    }
    batch = bRes.rows[0];

    // Only genuine Life Awakening student records are eligible (no class/school restriction).
    const validRes = await client.query(
      `SELECT u.id FROM users u
       WHERE u.id = ANY($1::int[]) AND u.role = 'student'
         AND NOT EXISTS (SELECT 1 FROM ri_batch_students rbs WHERE rbs.student_id = u.id AND rbs.source_program = 'RI_DIRECT')`,
      [requestedIds]
    );
    const validIds = validRes.rows.map(r => r.id);
    notFound = requestedIds.length - validIds.length;

    // Enforce: A student can belong to only one batch
    const conflictRes = await client.query(
      `SELECT u.id AS student_id, u.name AS student_name, b.id AS existing_batch_id, b.name AS existing_batch_name
       FROM batch_students bs
       JOIN batches b ON b.id = bs.batch_id AND (b.is_deleted = false OR b.is_deleted IS NULL)
       JOIN users u ON u.id = bs.student_id
       WHERE bs.student_id = ANY($1::int[]) AND bs.batch_id != $2`,
      [validIds, batchId]
    );

    if (conflictRes.rowCount > 0) {
      await client.query('ROLLBACK');
      const conflicts = conflictRes.rows;
      const conflictNames = conflicts.map(c => `"${c.student_name}" (in ${c.existing_batch_name} #${c.existing_batch_id})`).join(', ');
      return res.status(409).json({
        message: `Cannot assign: ${conflicts.length} student(s) already belong to another batch. A student can belong to only one batch: ${conflictNames}`,
        conflicts: conflicts.map(c => ({
          student_id: c.student_id,
          student_name: c.student_name,
          existing_batch_id: c.existing_batch_id,
          existing_batch_name: c.existing_batch_name
        }))
      });
    }

    const existingRes = await client.query(
      `SELECT student_id FROM batch_students WHERE batch_id = $1 AND student_id = ANY($2::int[])`,
      [batchId, validIds]
    );
    const existing = new Set(existingRes.rows.map(r => r.student_id));
    alreadyInBatch = existing.size;
    const toInsert = validIds.filter(id => !existing.has(id));

    if (toInsert.length === 0) {
      await client.query('ROLLBACK');
      return res.json({
        message: 'All selected students are already enrolled in this batch.',
        batch_id: batchId,
        requested: requestedIds.length,
        added: 0,
        alreadyInBatch: existing.size,
        capacitySkipped: 0,
        notFound
      });
    }

    const countRes = await client.query(`SELECT COUNT(*)::int AS c FROM batch_students WHERE batch_id = $1`, [batchId]);
    const limit = batch.capacity || 350;
    const slots = Math.max(0, limit - countRes.rows[0].c);
    const accepted = toInsert.slice(0, slots);
    capacitySkipped = toInsert.length - accepted.length;

    for (const sid of accepted) {
      const barcode = `LA-${batchId}-${sid}-${Math.floor(Math.random() * 10000)}`;
      const ins = await client.query(
        `INSERT INTO batch_students (batch_id, student_id, barcode)
         VALUES ($1, $2, $3)
         ON CONFLICT (batch_id, student_id) DO NOTHING`,
        [batchId, sid, barcode]
      );
      if (ins.rowCount > 0) addedIds.push(sid); else alreadyInBatch++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[LA] assignLaStudentsToBatch error:', err);
    return res.status(500).json({ message: 'Server error assigning students' });
  } finally {
    client.release();
  }

  // Post-commit side effects (non-blocking for the response contract)
  try {
    writeAudit(req.user.id, req.user.name || 'Admin', 'LA_BATCH_ASSIGN_STUDENTS', 'batch', batchId, {
      requested: requestedIds.length, added: addedIds.length, alreadyInBatch, capacitySkipped, notFound
    });
  } catch (_) { /* audit failures must not break assignment */ }

  for (const sid of addedIds) {
    // createSystemNotification is async and swallows its own errors
    createSystemNotification(sid, 'Enrolled in Batch', `You have been enrolled in batch "${batch.name}".`, 'info', req.user.id);
  }

  if (addedIds.length > 0) {
    try {
      const { syncLtcBatchToRiCore } = require('../services/riSyncService');
      await syncLtcBatchToRiCore(batchId);
    } catch (syncErr) {
      console.error(`[LA] riSync after assign failed for batch ${batchId}:`, syncErr.message);
    }
  }

  const parts = [`${addedIds.length} added`];
  if (alreadyInBatch) parts.push(`${alreadyInBatch} already in batch`);
  if (capacitySkipped) parts.push(`${capacitySkipped} skipped (capacity reached)`);
  if (notFound) parts.push(`${notFound} not found`);

  res.json({
    message: parts.join(' · '),
    batch_id: batchId,
    requested: requestedIds.length,
    added: addedIds.length,
    assignedCount: addedIds.length,
    added_ids: addedIds,
    alreadyInBatch,
    alreadyInBatchCount: alreadyInBatch,
    capacitySkipped,
    notFound
  });
};

/**
 * GET /api/admin/la/batch-conflicts
 * Returns any students currently assigned to multiple batches so admin can review.
 */
const getLaBatchConflicts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id AS student_id, u.name AS student_name, u.class_grade, u.school,
             json_agg(json_build_object('batch_id', b.id, 'batch_name', b.name, 'status', b.status)) as batches,
             COUNT(bs.batch_id)::int as batch_count
      FROM batch_students bs
      JOIN users u ON u.id = bs.student_id
      JOIN batches b ON b.id = bs.batch_id AND (b.is_deleted = false OR b.is_deleted IS NULL)
      GROUP BY u.id, u.name, u.class_grade, u.school
      HAVING COUNT(bs.batch_id) > 1
      ORDER BY u.id ASC
    `);
    res.json({ conflicts: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[LA] getLaBatchConflicts error:', err);
    res.status(500).json({ message: 'Server error checking batch conflicts' });
  }
};

module.exports = {
  getLaStudents,
  getLaBatchStudents,
  assignLaStudentsToBatch,
  getLaBatchConflicts,
  // exported for tests
  formatStudentId,
  shapeStudent,
  buildStudentQuery
};
