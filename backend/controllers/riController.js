const pool = require('../config/db');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { mapOfficialHeaders, parseExcelSheetSmart, parseExcelDate } = require('./adminController');
const { withLtcId } = require('../utils/helpers');
const { logRiAction } = require('../utils/riAudit');

const writeAuditLog = async (userId, action, description, details = {}) => {
  try {
    let userEmail = details.user_email || null;
    let userName = details.user_name || 'RI Admin';
    let userRole = details.user_role || 'admin-ri';

    if (userId && (!userEmail || !userName || userName === 'RI Admin')) {
      try {
        const uRes = await pool.query('SELECT name, email, role FROM users WHERE id = $1', [userId]);
        if (uRes.rows.length > 0) {
          userEmail = uRes.rows[0].email || userEmail;
          userName = uRes.rows[0].name || userName;
          userRole = uRes.rows[0].role || userRole;
        } else {
          userId = null;
        }
      } catch (_) {
        userId = null;
      }
    }

    const studentId = details.student_id ? parseInt(details.student_id, 10) : null;
    const batchId = details.batch_id ? parseInt(details.batch_id, 10) : null;
    const panelId = details.panel_id ? parseInt(details.panel_id, 10) : null;

    await logRiAction(pool, {
      userId: userId || null,
      userEmail,
      userName,
      userRole,
      action,
      studentId: isNaN(studentId) ? null : studentId,
      batchId: isNaN(batchId) ? null : batchId,
      panelId: isNaN(panelId) ? null : panelId,
      recordId: details.record_id ? String(details.record_id) : null,
      details: { description, ...details },
      ipAddress: details.ip_address || null
    });
  } catch (e) {
    console.error('[RI writeAuditLog Error]', e.message);
  }
};

/**
 * RI Controller - Rural Immersion Module (Isolated)
 * Handles RI Dashboards, LTC Batch Synchronization, RI Panels, and RI Students
 */

// ─── 1. Get Dashboard Statistics ─────────────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const statsQuery = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM ri_batches) AS total_ri_batches,
        (SELECT COUNT(*)::int FROM ri_batch_students) AS total_ri_students,
        (SELECT COUNT(*)::int FROM ri_panels) AS total_ri_panels,
        (SELECT COUNT(*)::int FROM ri_villages WHERE status <> 'deleted') AS total_ri_villages,
        (SELECT COUNT(*)::int FROM ri_batch_students WHERE source_program IN ('LTC', 'LTC_SYNC') OR enrollment_type = 'LTC_SYNC') AS ltc_ri_students,
        (SELECT COUNT(*)::int FROM ri_batch_students WHERE source_program IN ('RI', 'RI_DIRECT') OR enrollment_type IN ('RI_DIRECT', 'DIRECT_UPLOAD', 'RI_BULK_UPLOAD')) AS ri_only_students
    `);

    const recentBatchesQuery = await pool.query(`
      SELECT 
        rb.id, rb.name,
        COALESCE(rb.batch_code, b.batch_code) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        rb.source_batch_id, rb.status,
        rb.panel_capacity, rb.start_date, rb.end_date, rb.created_at,
        COUNT(DISTINCT rp.id)::int AS panel_count,
        COUNT(DISTINCT rbs.student_id)::int AS student_count
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      LEFT JOIN ri_panels rp ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_batch_id = rb.id
      GROUP BY rb.id, b.batch_code
      ORDER BY rb.created_at DESC
      LIMIT 5
    `);

    const activeBatchesQuery = await pool.query(`
      SELECT 
        rb.id, rb.name,
        COALESCE(rb.batch_code, b.batch_code) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        rb.status,
        COUNT(DISTINCT rp.id)::int AS panel_count,
        COUNT(DISTINCT rbs.student_id)::int AS student_count
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      LEFT JOIN ri_panels rp ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_batch_id = rb.id
      WHERE rb.status = 'active'
      GROUP BY rb.id, b.batch_code
      ORDER BY rb.id ASC
    `);

    const panelDistributionQuery = await pool.query(`
      SELECT 
        rp.id, rp.name AS panel_name, rp.panel_number, rp.capacity,
        rb.id AS batch_id, rb.name AS batch_name,
        COUNT(rbs.id)::int AS student_count
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      GROUP BY rp.id, rb.id
      ORDER BY rb.id ASC, rp.panel_number ASC
    `);

    res.json({
      stats: statsQuery.rows[0],
      recent_batches: recentBatchesQuery.rows,
      active_batches: activeBatchesQuery.rows,
      panel_distribution: panelDistributionQuery.rows
    });
  } catch (err) {
    console.error('Error fetching RI dashboard stats:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics', error: err.message });
  }
};

// ─── 2. Get LTC Batches (Available for RI Sync) ──────────────────────────────
const getLtcBatches = async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id,
        b.name,
        b.batch_code,
        b.start_date,
        b.end_date,
        b.status,
        b.capacity AS ltc_capacity,
        COUNT(DISTINCT bs.student_id)::int AS ltc_student_count,
        CASE WHEN rb.id IS NOT NULL THEN true ELSE false END AS is_synced_to_ri,
        rb.id AS ri_batch_id,
        rb.panel_capacity AS ri_panel_capacity,
        rb.created_at AS ri_synced_at,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS ri_panel_count,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS ri_student_count
      FROM batches b
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      LEFT JOIN ri_batches rb ON rb.source_batch_id = b.id
      WHERE (b.is_deleted IS NOT TRUE)
      GROUP BY b.id, rb.id
      ORDER BY b.id ASC
    `;

    const result = await pool.query(query);
    res.json({ batches: result.rows });
  } catch (err) {
    console.error('Error fetching LTC batches for RI:', err);
    res.status(500).json({ message: 'Failed to fetch LTC batches', error: err.message });
  }
};

// ─── 3. Get All RI Batches ───────────────────────────────────────────────────
const getRiBatches = async (req, res) => {
  try {
    const query = `
      SELECT 
        rb.id,
        rb.name,
        COALESCE(rb.batch_code, b.batch_code) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        rb.source_batch_id,
        rb.panel_capacity,
        rb.status,
        rb.start_date,
        rb.end_date,
        rb.description,
        rb.created_at,
        b.name AS source_batch_name,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS total_panels,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS total_students,
        (SELECT COUNT(*)::int FROM ri_villages rv WHERE rv.ri_batch_id = rb.id AND rv.status <> 'deleted') AS total_villages,
        (SELECT COUNT(*)::int FROM ri_batch_faculty rbf WHERE rbf.ri_batch_id = rb.id AND rbf.status <> 'deleted') AS total_faculty
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      ORDER BY rb.id ASC
    `;

    const result = await pool.query(query);
    res.json({ batches: result.rows });
  } catch (err) {
    console.error('Error fetching RI batches:', err);
    res.status(500).json({ message: 'Failed to fetch RI batches', error: err.message });
  }
};

// ─── 4. Get RI Batch Details by ID ──────────────────────────────────────────
const getRiBatchById = async (req, res) => {
  const { id } = req.params;
  try {
    // Resolve batch and live-sync source LTC batch if applicable
    const batchCheck = await pool.query(
      `SELECT id, source_batch_id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );

    let resolvedRiBatchId;
    let sourceBatchId;

    if (batchCheck.rowCount > 0) {
      resolvedRiBatchId = batchCheck.rows[0].id;
      sourceBatchId = batchCheck.rows[0].source_batch_id;
    } else {
      const fallbackBatchRes = await pool.query(
        `SELECT id, source_batch_id FROM ri_batches ORDER BY id DESC LIMIT 1`
      );
      if (fallbackBatchRes.rowCount > 0) {
        resolvedRiBatchId = fallbackBatchRes.rows[0].id;
        sourceBatchId = fallbackBatchRes.rows[0].source_batch_id;
      } else {
        return res.status(404).json({ message: 'RI Batch not found' });
      }
    }

    const batchQuery = await pool.query(`
      SELECT 
        rb.*,
        COALESCE(rb.batch_code, b.batch_code) AS batch_code,
        CASE 
          WHEN rb.source_batch_id IS NOT NULL OR rb.source_program IN ('LTC', 'LTC_SYNC') THEN 'LTC_SYNC'
          ELSE 'RI_DIRECT'
        END AS source_program,
        b.name AS source_batch_name,
        (SELECT COUNT(*)::int FROM ri_panels rp WHERE rp.ri_batch_id = rb.id) AS total_panels,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_batch_id = rb.id) AS total_students,
        (SELECT COUNT(*)::int FROM ri_villages rv WHERE rv.ri_batch_id = rb.id AND rv.status <> 'deleted') AS total_villages,
        (SELECT COUNT(*)::int FROM ri_batch_faculty rbf WHERE rbf.ri_batch_id = rb.id AND rbf.status <> 'deleted') AS total_faculty
      FROM ri_batches rb
      LEFT JOIN batches b ON rb.source_batch_id = b.id
      WHERE rb.id = $1
    `, [resolvedRiBatchId]);

    const panelsQuery = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.capacity,
        rp.school,
        rp.department,
        rp.student_count AS panel_student_count,
        rp.boys_count,
        rp.girls_count,
        rp.google_maps_link,
        rp.coordinator_name,
        rp.class_teacher_name,
        rp.nodal_officer_name,
        rp.nodal_officer_email,
        rp.nodal_officer_user_id,
        rp.ri_village_id,
        v.name AS village_name,
        v.location AS village_location,
        v.detailed_address AS village_detailed_address,
        v.school_name AS village_school_name,
        v.principal_mobile AS village_principal_mobile,
        v.spoc_name,
        v.spoc_mobile,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.district AS village_district,
        v.panchayat AS village_panchayat,
        v.taluka AS village_taluka,
        v.google_maps_link AS village_google_maps_link,
        COALESCE(NULLIF(COUNT(DISTINCT rbs.id)::int, 0), rp.student_count, 0) AS student_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', rbf.id,
                'name', rbf.name,
                'email', rbf.email,
                'phone', rbf.phone,
                'department', rbf.department,
                'designation', rbf.designation,
                'role', rbf.role,
                'ri_panel_id', rbf.ri_panel_id
              ) ORDER BY rbf.id ASC
            )
            FROM ri_batch_faculty rbf
            WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
          ),
          '[]'::json
        ) AS assigned_faculty,
        (
          SELECT COUNT(*)::int
          FROM ri_batch_faculty rbf
          WHERE rbf.ri_panel_id = rp.id AND rbf.status <> 'deleted'
        ) AS faculty_count
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id, v.id
      ORDER BY rp.panel_number ASC
    `, [resolvedRiBatchId]);

    const villagesQuery = await pool.query(`
      SELECT 
        v.*,
        COUNT(DISTINCT rp.id)::int AS assigned_panels_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'panel_number', p.panel_number,
                'student_count', (SELECT COUNT(*)::int FROM ri_batch_students sub_rbs WHERE sub_rbs.ri_panel_id = p.id)
              ) ORDER BY p.panel_number ASC
            )
            FROM ri_panels p
            WHERE p.ri_village_id = v.id
          ),
          '[]'::json
        ) AS assigned_panels,
        (
          SELECT COUNT(*)::int
          FROM ri_batch_students rbs
          JOIN ri_panels p ON rbs.ri_panel_id = p.id
          WHERE p.ri_village_id = v.id
        ) AS assigned_students_count
      FROM ri_villages v
      LEFT JOIN ri_panels rp ON rp.ri_village_id = v.id
      WHERE v.ri_batch_id = $1 AND v.status <> 'deleted'
      GROUP BY v.id
      ORDER BY v.name ASC
    `, [resolvedRiBatchId]);

    res.json({
      batch: batchQuery.rows[0],
      panels: panelsQuery.rows,
      villages: villagesQuery.rows
    });
  } catch (err) {
    console.error('Error fetching RI batch details:', err);
    res.status(500).json({ message: 'Failed to fetch batch details', error: err.message });
  }
};

// ─── Helper: Generate Safe Sequential RI Batch Code (RI-[2-digit seq]-[MMYY]) ──
const generateRiBatchCode = async (client, startDate) => {
  let targetDate = new Date();
  if (startDate) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const year = String(targetDate.getFullYear()).slice(-2);
  const mmyy = `${month}${year}`;

  // Acquire PostgreSQL transaction advisory lock to guarantee collision-free sequence across concurrent requests
  await client.query("SELECT pg_advisory_xact_lock(hashtext('ri_batch_code_lock'))");

  // Query all existing batch codes in ri_batches matching RI-%-MMYY
  const existingRes = await client.query(
    "SELECT batch_code FROM ri_batches WHERE batch_code LIKE $1",
    [`RI-%-${mmyy}`]
  );

  let maxSeq = 0;
  for (const row of existingRes.rows) {
    if (row.batch_code) {
      const parts = row.batch_code.split('-');
      if (parts.length >= 3) {
        const seq = parseInt(parts[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  const nextSeq = maxSeq + 1;
  const seqStr = String(nextSeq).padStart(2, '0');
  return `RI-${seqStr}-${mmyy}`;
};

// ─── 4b. Create RI Direct Batch (Automatic Batch Code) ────────────────────────
const createRiBatch = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { name, start_date, end_date, description, panel_capacity } = req.body;

    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Batch Name is required.' });
    }
    if (!start_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Start Date is required.' });
    }
    if (!end_date) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'End Date is required.' });
    }

    const trimmedName = name.trim();

    // Check for duplicate name in ri_batches
    const existingCheck = await client.query(
      `SELECT id, name FROM ri_batches WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [trimmedName]
    );

    if (existingCheck.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `An RI batch with name "${trimmedName}" already exists.` });
    }

    // Automatically generate safe, collision-free RI Batch Code (e.g. RI-01-0926)
    const autoBatchCode = await generateRiBatchCode(client, start_date);

    const capacity = parseInt(panel_capacity, 10) || 60;

    // Explicitly create an RI_DIRECT batch with source_batch_id = NULL
    const insertRes = await client.query(`
      INSERT INTO ri_batches (
        name, batch_code, source_program, source_batch_id, panel_capacity, status, start_date, end_date, description
      )
      VALUES ($1, $2, 'RI_DIRECT', NULL, $3, 'active', $4, $5, $6)
      RETURNING *
    `, [
      trimmedName,
      autoBatchCode,
      capacity,
      start_date,
      end_date,
      description ? description.trim() : `Rural Immersion Direct Cohort: ${trimmedName}`
    ]);

    const createdBatch = insertRes.rows[0];

    await client.query('COMMIT');

    writeAuditLog(req.user.id, 'RI_BATCH_CREATED', `Created RI Direct batch ${autoBatchCode} (${trimmedName})`, {
      batch_id: createdBatch.id,
      batch_code: autoBatchCode,
      name: trimmedName
    });

    res.status(201).json({
      success: true,
      message: `RI Direct Batch created successfully with batch code ${autoBatchCode}.`,
      batch: {
        ...createdBatch,
        source_program: 'RI_DIRECT',
        source_batch_name: null,
        total_panels: 0,
        total_students: 0,
        total_villages: 0,
        total_faculty: 0
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RI batch:', err);
    res.status(500).json({ message: 'Failed to create RI batch', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 4c. Update RI Direct Batch (Protected from LTC Sync modification) ────────
const updateRiBatch = async (req, res) => {
  const { id } = req.params;
  const { name, start_date, end_date, description, status, panel_capacity } = req.body;

  try {
    const batchRes = await pool.query('SELECT * FROM ri_batches WHERE id = $1', [id]);
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'RI Batch not found.' });
    }
    const batch = batchRes.rows[0];

    // Enforce backend restriction: Only RI_DIRECT batches can be edited from RI Admin
    if (batch.source_program === 'LTC_SYNC' || batch.source_batch_id) {
      return res.status(403).json({
        success: false,
        message: 'LTC-synced batches cannot be edited from RI Admin. They are synchronized from the LTC module.'
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Batch name is required.' });
    }

    // Check name collision with another batch
    const nameCollision = await pool.query(
      'SELECT id FROM ri_batches WHERE LOWER(name) = LOWER($1) AND id <> $2',
      [name.trim(), id]
    );
    if (nameCollision.rowCount > 0) {
      return res.status(400).json({ success: false, message: `Another batch with name "${name.trim()}" already exists.` });
    }

    const updateRes = await pool.query(`
      UPDATE ri_batches
      SET
        name = $1,
        start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        description = $4,
        status = COALESCE($5, status),
        panel_capacity = COALESCE($6, panel_capacity),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [
      name.trim(),
      start_date || null,
      end_date || null,
      description !== undefined ? description : batch.description,
      status || batch.status,
      panel_capacity ? parseInt(panel_capacity, 10) : batch.panel_capacity,
      id
    ]);

    writeAuditLog(req.user.id, 'RI_BATCH_UPDATED', `Updated RI Direct batch ${batch.batch_code} (${name.trim()})`, {
      batch_id: id,
      previous_name: batch.name,
      new_name: name.trim()
    });

    return res.json({
      success: true,
      message: 'RI Batch updated successfully.',
      batch: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating RI batch:', err);
    return res.status(500).json({ success: false, message: 'Failed to update RI batch.', error: err.message });
  }
};

// ─── 4d. Delete RI Direct Batch (Protected from LTC Sync deletion) ────────────
const deleteRiBatch = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query('SELECT * FROM ri_batches WHERE id = $1 FOR UPDATE', [id]);
    if (batchRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'RI Batch not found.' });
    }
    const batch = batchRes.rows[0];

    // Enforce backend restriction: Only RI_DIRECT batches can be deleted
    if (batch.source_program === 'LTC_SYNC' || batch.source_batch_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'LTC-synced batches cannot be deleted from RI Admin. LTC batch and data must never be deleted.'
      });
    }

    // Cascade deletion removes ri_panels, ri_batch_students, ri_villages, ri_batch_faculty, ri_attendance, ri_evaluations
    await client.query('DELETE FROM ri_attendance WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_attendance_locks WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_evaluations WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_student_forms WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_institutional_visits WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_family_surveys WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_community_projects WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_problem_identifications WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_student_feedbacks WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_red_flags WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_batch_students WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_batch_faculty WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_panels WHERE ri_batch_id = $1', [id]);
    await client.query('DELETE FROM ri_villages WHERE ri_batch_id = $1', [id]);
    
    const delRes = await client.query('DELETE FROM ri_batches WHERE id = $1', [id]);
    if (delRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Failed to delete RI batch.' });
    }

    await client.query('COMMIT');

    writeAuditLog(req.user.id, 'RI_BATCH_DELETED', `Deleted RI Direct batch ${batch.batch_code} (${batch.name})`, {
      batch_id: id,
      batch_code: batch.batch_code,
      name: batch.name
    });

    return res.json({
      success: true,
      message: `RI Direct batch "${batch.name}" (${batch.batch_code}) deleted successfully.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting RI batch:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete RI batch.', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 4d. Create & Enroll Single Student in RI-Only Batch ─────────────────────
const createRiStudent = async (req, res) => {
  const { id } = req.params; // ri_batch_id
  const {
    name, email, prn, roll_number, gender,
    division, faculty, school, department, semester, program, year, panel,
    phone, personal_email, dob, age, nationality, aadhar_no, lateral_entry,
    parent_mobile, parent_email, nominee_name, nominee_relationship, nominee_email,
    address
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify target batch exists and is strictly RI_DIRECT
    const batchRes = await client.query(
      `SELECT id, name, batch_code, source_program, source_batch_id FROM ri_batches WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (batchRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'RI Batch not found.' });
    }

    const batch = batchRes.rows[0];
    if (batch.source_program !== 'RI_DIRECT') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Individual student creation is strictly available for RI-only batches.' });
    }

    // 2. Validate required fields
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPrn = typeof prn === 'string' ? prn.trim() : '';
    const cleanGender = typeof gender === 'string' ? gender.trim() : '';
    const cleanSemester = typeof semester === 'string' ? semester.trim() : (semester ? String(semester).trim() : '');

    if (!cleanName) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Full Name is required.' });
    }
    if (!cleanEmail) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Official Email is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Please provide a valid official email address.' });
    }
    if (!cleanPrn) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'PRN (LTC ID) is required.' });
    }
    if (!cleanGender) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Gender is required.' });
    }
    if (!cleanSemester) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Semester is required.' });
    }

    // 3. Prevent duplicate email or PRN, reject existing LTC students, and prevent identity conflicts
    const existingCheck = await client.query(`
      SELECT 
        u.id, u.name, TRIM(u.prn) as prn, LOWER(TRIM(u.email)) as email,
        (
          EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = u.id)
          OR EXISTS (
            SELECT 1 FROM ri_batch_students rbs 
            WHERE rbs.student_id = u.id 
              AND (rbs.source_program IN ('LTC', 'LTC_SYNC') OR rbs.enrollment_type = 'LTC_SYNC')
          )
        ) AS is_ltc_student
      FROM users u
      WHERE LOWER(TRIM(u.prn)) = LOWER($1) OR LOWER(TRIM(u.email)) = LOWER($2)
    `, [cleanPrn, cleanEmail]);

    if (existingCheck.rowCount > 0) {
      const matchByPrn = existingCheck.rows.find(r => r.prn && r.prn.toLowerCase() === cleanPrn.toLowerCase());
      const matchByEmail = existingCheck.rows.find(r => r.email && r.email.toLowerCase() === cleanEmail.toLowerCase());

      if (matchByPrn && matchByPrn.is_ltc_student) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Student with PRN "${cleanPrn}" (${matchByPrn.name}) is already registered in LTC (cannot be added to an RI Direct cohort).`
        });
      }
      if (matchByEmail && matchByEmail.is_ltc_student) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Email "${cleanEmail}" belongs to an existing LTC student (${matchByEmail.name}, PRN: ${matchByEmail.prn || 'N/A'}). Existing LTC students cannot be added to an RI Direct cohort.`
        });
      }
      if (matchByPrn && matchByEmail && matchByPrn.id !== matchByEmail.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Identity conflict: PRN "${cleanPrn}" belongs to "${matchByPrn.name}" while email "${cleanEmail}" belongs to "${matchByEmail.name}". Requires administrator review.`
        });
      }
      if (matchByPrn && matchByPrn.email && matchByPrn.email !== cleanEmail) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Identity conflict: PRN "${cleanPrn}" belongs to "${matchByPrn.name}" with registered email "${matchByPrn.email}", but provided email is "${cleanEmail}". Requires administrator review.`
        });
      }
      if (!matchByPrn && matchByEmail) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Identity conflict: Email "${cleanEmail}" is registered to student "${matchByEmail.name}" with PRN "${matchByEmail.prn || 'N/A'}", but provided PRN is "${cleanPrn}". Requires administrator review.`
        });
      }
      if (matchByPrn) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Student with PRN "${cleanPrn}" already exists.` });
      }
      if (matchByEmail) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `A user with email "${cleanEmail}" already exists.` });
      }
    }

    // 4. Resolve panel if specified
    let targetPanelId = null;
    if (panel) {
      const panelIdInt = parseInt(panel, 10);
      const panelRes = await client.query(
        `SELECT id, name FROM ri_panels WHERE ri_batch_id = $1 AND (id = $2 OR LOWER(name) = LOWER($3)) LIMIT 1`,
        [batch.id, isNaN(panelIdInt) ? -1 : panelIdInt, String(panel).trim()]
      );
      if (panelRes.rowCount > 0) {
        targetPanelId = panelRes.rows[0].id;
      }
    }

    // 5. Generate sequential RI ID: RI-XX-MMYY-01
    const currentBatchCode = batch.batch_code || `RI-01-${batch.id}`;
    const existingRiIdsRes = await client.query(
      'SELECT ri_id FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_id IS NOT NULL',
      [batch.id]
    );
    let currentStudentSeq = 0;
    for (const r of existingRiIdsRes.rows) {
      if (r.ri_id) {
        const lastDash = r.ri_id.lastIndexOf('-');
        if (lastDash !== -1) {
          const seq = parseInt(r.ri_id.slice(lastDash + 1), 10);
          if (!isNaN(seq) && seq > currentStudentSeq) {
            currentStudentSeq = seq;
          }
        }
      }
    }
    currentStudentSeq += 1;
    const studentRiId = `${currentBatchCode}-${String(currentStudentSeq).padStart(2, '0')}`;

    // 6. Create user in users table
    const hashedPassword = await bcrypt.hash('student123', 10);
    const parsedAge = age ? parseInt(age, 10) : null;
    const isLateral = lateral_entry === true || lateral_entry === 'true';

    const insertUserRes = await client.query(`
      INSERT INTO users (
        name, email, password, role, semester, department, division, school, panel, prn, gender, faculty,
        phone, dob, roll_number, program, year, lateral_entry, personal_email, parent_email,
        parent_mobile, address, age, nationality, aadhar_no, nominee_name, nominee_relationship, nominee_email,
        status, password_changed, created_at
      ) VALUES (
        $1, $2, $3, 'student', $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27,
        'active', false, NOW()
      )
      RETURNING id, name, email, prn, role, department, school, division, semester
    `, [
      cleanName,
      cleanEmail,
      hashedPassword,
      cleanSemester,
      department ? String(department).trim() : null,
      division ? String(division).trim() : null,
      school ? String(school).trim() : null,
      panel ? String(panel).trim() : null,
      cleanPrn,
      cleanGender,
      faculty ? String(faculty).trim() : null,
      phone ? String(phone).trim() : null,
      dob || null,
      roll_number ? String(roll_number).trim() : null,
      program ? String(program).trim() : null,
      year ? String(year).trim() : null,
      isLateral,
      personal_email ? String(personal_email).trim().toLowerCase() : null,
      parent_email ? String(parent_email).trim().toLowerCase() : null,
      parent_mobile ? String(parent_mobile).trim() : null,
      address ? String(address).trim() : null,
      isNaN(parsedAge) ? null : parsedAge,
      nationality ? String(nationality).trim() : 'Indian',
      aadhar_no ? String(aadhar_no).trim() : null,
      nominee_name ? String(nominee_name).trim() : null,
      nominee_relationship ? String(nominee_relationship).trim() : null,
      nominee_email ? String(nominee_email).trim().toLowerCase() : null
    ]);

    const createdUser = insertUserRes.rows[0];

    // 7. Enroll student in ri_batch_students
    await client.query(`
      INSERT INTO ri_batch_students (
        ri_batch_id, student_id, ri_panel_id, source_program, source_ltc_batch_id, enrollment_type, ri_id, enrolled_at
      ) VALUES ($1, $2, $3, 'RI_DIRECT', NULL, 'RI_DIRECT', $4, NOW())
    `, [batch.id, createdUser.id, targetPanelId, studentRiId]);

    // 8. Update panel student count if panel assigned
    if (targetPanelId) {
      await client.query(`
        UPDATE ri_panels
        SET student_count = (SELECT COUNT(*)::int FROM ri_batch_students WHERE ri_panel_id = $1)
        WHERE id = $1
      `, [targetPanelId]);
    }

    await client.query('COMMIT');

    // 9. Write audit log
    writeAuditLog(req.user?.id || null, 'CREATE_RI_STUDENT', `Created student "${cleanName}" with RI ID ${studentRiId}`, {
      batch_id: batch.id,
      student_id: createdUser.id,
      ri_id: studentRiId
    });

    res.status(201).json({
      message: `Student "${cleanName}" added successfully with RI ID: ${studentRiId}.`,
      student: {
        ...createdUser,
        ri_id: studentRiId,
        source_program: 'RI_DIRECT'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating RI student:', err);
    if (err.code === '23505') {
      return res.status(400).json({ message: 'A student with this email or PRN already exists.' });
    }
    res.status(500).json({ message: 'Failed to create student', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 4e. Update RI Student Details (Email update, panel, and identity) ───────
const updateRiStudent = async (req, res) => {
  const { id } = req.params; // student_id (users.id)
  const {
    name,
    email,
    phone,
    mobile,
    gender,
    school,
    department,
    division,
    prn,
    ri_panel_id,
    batch_id,
    ri_id
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch user record
    const userRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (userRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student user not found.' });
    }
    const currentUser = userRes.rows[0];

    // 2. Fetch enrollment record in ri_batch_students
    let enrollmentRes;
    if (batch_id) {
      enrollmentRes = await client.query(
        'SELECT rbs.*, rb.source_program as batch_source FROM ri_batch_students rbs JOIN ri_batches rb ON rbs.ri_batch_id = rb.id WHERE rbs.student_id = $1 AND rbs.ri_batch_id = $2 FOR UPDATE',
        [id, batch_id]
      );
    } else {
      enrollmentRes = await client.query(
        'SELECT rbs.*, rb.source_program as batch_source FROM ri_batch_students rbs JOIN ri_batches rb ON rbs.ri_batch_id = rb.id WHERE rbs.student_id = $1 ORDER BY rbs.id DESC LIMIT 1 FOR UPDATE',
        [id]
      );
    }
    const enrollment = enrollmentRes.rowCount > 0 ? enrollmentRes.rows[0] : null;

    // 3. Handle Email Update & Login Identity Change
    const trimmedEmail = email ? email.trim().toLowerCase() : currentUser.email.toLowerCase();
    const emailChanged = trimmedEmail !== currentUser.email.toLowerCase();

    if (emailChanged) {
      // Check for email collision with other accounts
      const collisionCheck = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [trimmedEmail, id]
      );
      if (collisionCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `The email address "${trimmedEmail}" is already in use by another account.`
        });
      }
    }

    // 4. Update the user account in users table
    const finalPhone = phone !== undefined ? phone : (mobile !== undefined ? mobile : currentUser.phone);
    const finalName = name ? name.trim() : currentUser.name;
    const finalGender = gender !== undefined ? gender : currentUser.gender;
    const finalSchool = school !== undefined ? school : currentUser.school;
    const finalDepartment = department !== undefined ? department : currentUser.department;
    const finalDivision = division !== undefined ? division : currentUser.division;
    const finalPrn = prn !== undefined ? prn : currentUser.prn;

    const updatedUserRes = await client.query(`
      UPDATE users
      SET
        name = $1,
        email = $2,
        phone = $3,
        gender = $4,
        school = $5,
        department = $6,
        division = $7,
        prn = $8
      WHERE id = $9
      RETURNING id, name, email, phone, gender, school, department, division, prn, role
    `, [
      finalName,
      trimmedEmail,
      finalPhone,
      finalGender,
      finalSchool,
      finalDepartment,
      finalDivision,
      finalPrn,
      id
    ]);

    // 5. Update panel or RI ID in ri_batch_students if applicable
    let updatedEnrollment = enrollment;
    if (enrollment) {
      let targetPanelId = enrollment.ri_panel_id;
      if (ri_panel_id !== undefined && ri_panel_id !== null && ri_panel_id !== '') {
        const panelVal = await client.query(
          'SELECT id FROM ri_panels WHERE id = $1 AND ri_batch_id = $2',
          [ri_panel_id, enrollment.ri_batch_id]
        );
        if (panelVal.rowCount > 0) {
          targetPanelId = parseInt(ri_panel_id, 10);
        }
      }

      // If RI_DIRECT, allow updating or keeping ri_id; for LTC_SYNC, keep NULL
      const isDirect = enrollment.source_program === 'RI_DIRECT' || enrollment.enrollment_type === 'RI_DIRECT';
      const finalRiId = isDirect ? (ri_id !== undefined ? ri_id : enrollment.ri_id) : null;

      const updateRbsRes = await client.query(`
        UPDATE ri_batch_students
        SET
          ri_panel_id = $1,
          ri_id = $2
        WHERE id = $3
        RETURNING *
      `, [targetPanelId, finalRiId, enrollment.id]);
      updatedEnrollment = updateRbsRes.rows[0];
    }

    await client.query('COMMIT');

    writeAuditLog(req.user.id, 'RI_STUDENT_UPDATED', `Updated RI student ${finalName} (${trimmedEmail})`, {
      student_id: id,
      old_email: currentUser.email,
      new_email: trimmedEmail,
      name: finalName
    });

    return res.json({
      success: true,
      message: 'Student details updated successfully.',
      student: {
        ...updatedUserRes.rows[0],
        ri_batch_id: updatedEnrollment?.ri_batch_id,
        ri_panel_id: updatedEnrollment?.ri_panel_id,
        ri_id: updatedEnrollment?.ri_id,
        source_program: updatedEnrollment?.source_program,
        enrollment_type: updatedEnrollment?.enrollment_type
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating RI student:', err);
    return res.status(500).json({ success: false, message: 'Failed to update student.', error: err.message });
  } finally {
    client.release();
  }
};

const { syncLtcBatchToRiCore, resolveCanonicalPanel } = require('../services/riSyncService');

// ─── 5. Sync LTC Batch to RI (Master Sheet Division-Wise Grouping) ───────────
const syncLtcBatchToRi = async (req, res) => {
  const { id } = req.params; // LTC Batch ID
  try {
    const result = await syncLtcBatchToRiCore(id, null, { isManual: true });
    res.status(200).json({
      message: `Batch "${result.ri_batch.name}" successfully synchronized to RI with ${result.panels_count} division-wise panels.`,
      ri_batch: result.ri_batch,
      total_panels: result.panels_count,
      total_students_synced: result.students_count
    });
  } catch (err) {
    console.error('Error syncing LTC batch to RI:', err);
    res.status(500).json({ message: 'Failed to synchronize batch to RI', error: err.message });
  }
};

// ─── 6. Get Panels for an RI Batch ───────────────────────────────────────────
const getBatchPanels = async (req, res) => {
  const { id } = req.params;
  try {
    // Resolve ri_batch_id if passed as LTC batch id
    const batchRes = await pool.query(
      `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    let riBatchId;
    if (batchRes.rowCount > 0) {
      riBatchId = batchRes.rows[0].id;
    } else {
      const fallbackRes = await pool.query(`SELECT id FROM ri_batches ORDER BY id DESC LIMIT 1`);
      if (fallbackRes.rowCount > 0) {
        riBatchId = fallbackRes.rows[0].id;
      } else {
        return res.status(404).json({ message: 'RI Batch not found' });
      }
    }

    const panelsQuery = await pool.query(`
      SELECT 
        rp.id,
        rp.panel_number,
        rp.name,
        rp.capacity,
        rp.school,
        rp.department,
        rp.google_maps_link,
        rp.ri_batch_id,
        rb.source_program,
        COALESCE(rp.nodal_officer_name, '') AS nodal_officer_name,
        COALESCE(rp.nodal_officer_email, '') AS nodal_officer_email,
        rp.coordinator_name,
        rp.class_teacher_name,
        rp.ri_village_id,
        rp.created_at,
        v.name AS village_name,
        v.location AS village_location,
        v.detailed_address AS village_detailed_address,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.district AS village_district,
        v.panchayat AS village_panchayat,
        v.taluka AS village_taluka,
        v.emergency_contact AS village_emergency_contact,
        COALESCE(NULLIF(COUNT(rbs.id)::int, 0), rp.student_count, 0) AS student_count
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id, rb.source_program, v.id
      ORDER BY rp.panel_number ASC
    `, [riBatchId]);

    res.json({ panels: panelsQuery.rows });
  } catch (err) {
    console.error('Error fetching batch panels:', err);
    res.status(500).json({ message: 'Failed to fetch panels', error: err.message });
  }
};

// ─── Village Management: Get Villages for a Batch ────────────────────────────
const getBatchVillages = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query(
      `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    let riBatchId;
    if (batchRes.rowCount > 0) {
      riBatchId = batchRes.rows[0].id;
    } else {
      const fallbackRes = await pool.query(`SELECT id FROM ri_batches ORDER BY id DESC LIMIT 1`);
      if (fallbackRes.rowCount > 0) {
        riBatchId = fallbackRes.rows[0].id;
      } else {
        return res.status(404).json({ message: 'RI Batch not found' });
      }
    }

    const villagesRes = await pool.query(`
      SELECT 
        v.*,
        COUNT(DISTINCT rp.id)::int AS assigned_panels_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'panel_number', p.panel_number,
                'student_count', (SELECT COUNT(*)::int FROM ri_batch_students sub_rbs WHERE sub_rbs.ri_panel_id = p.id)
              ) ORDER BY p.panel_number ASC
            )
            FROM ri_panels p
            WHERE p.ri_village_id = v.id
          ),
          '[]'::json
        ) AS assigned_panels,
        (
          SELECT COUNT(*)::int
          FROM ri_batch_students rbs
          JOIN ri_panels p ON rbs.ri_panel_id = p.id
          WHERE p.ri_village_id = v.id
        ) AS assigned_students_count
      FROM ri_villages v
      LEFT JOIN ri_panels rp ON rp.ri_village_id = v.id
      WHERE v.ri_batch_id = $1 AND v.status <> 'deleted'
      GROUP BY v.id
      ORDER BY v.name ASC
    `, [riBatchId]);

    res.json({ villages: villagesRes.rows });
  } catch (err) {
    console.error('Error fetching batch villages:', err);
    res.status(500).json({ message: 'Failed to fetch villages', error: err.message });
  }
};

// ─── Village Management: Create Village for a Batch ──────────────────────────
const createBatchVillage = async (req, res) => {
  const { id } = req.params;
  const { name, location, sarpanch_name, sarpanch_mobile, panchayat, taluka, district, emergency_contact, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Village Name is required' });
  }

  try {
    const batchRes = await pool.query(
      `SELECT id, name FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;

    const dupCheck = await pool.query(
      `SELECT id FROM ri_villages WHERE ri_batch_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND status <> 'deleted'`,
      [riBatchId, name.trim()]
    );
    if (dupCheck.rowCount > 0) {
      return res.status(400).json({ message: `A village named "${name.trim()}" already exists in this batch.` });
    }

    const insertRes = await pool.query(`
      INSERT INTO ri_villages (
        ri_batch_id, name, location, sarpanch_name, sarpanch_mobile, panchayat, taluka, district, emergency_contact, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *
    `, [
      riBatchId,
      name.trim(),
      location?.trim() || null,
      sarpanch_name?.trim() || null,
      sarpanch_mobile?.trim() || null,
      panchayat?.trim() || null,
      taluka?.trim() || panchayat?.trim() || null,
      district?.trim() || null,
      emergency_contact?.trim() || null,
      notes?.trim() || null
    ]);

    res.status(201).json({
      message: 'Village created successfully',
      village: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Error creating village:', err);
    res.status(500).json({ message: 'Failed to create village', error: err.message });
  }
};

// ─── Village Management: Update Village ──────────────────────────────────────
const updateVillage = async (req, res) => {
  const { villageId } = req.params;
  const { name, location, sarpanch_name, sarpanch_mobile, panchayat, taluka, district, emergency_contact, notes, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Village Name is required' });
  }

  try {
    const villageRes = await pool.query(`SELECT * FROM ri_villages WHERE id = $1`, [villageId]);
    if (villageRes.rowCount === 0) {
      return res.status(404).json({ message: 'Village not found' });
    }
    const village = villageRes.rows[0];

    if (name.trim().toLowerCase() !== village.name.toLowerCase()) {
      const dupCheck = await pool.query(
        `SELECT id FROM ri_villages WHERE ri_batch_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id <> $3 AND status <> 'deleted'`,
        [village.ri_batch_id, name.trim(), villageId]
      );
      if (dupCheck.rowCount > 0) {
        return res.status(400).json({ message: `Another village named "${name.trim()}" already exists in this batch.` });
      }
    }

    const updateRes = await pool.query(`
      UPDATE ri_villages
      SET name = $1, location = $2, sarpanch_name = $3, sarpanch_mobile = $4,
          panchayat = $5, taluka = COALESCE(NULLIF($6, ''), taluka), district = $7, emergency_contact = $8, notes = $9,
          status = COALESCE($10, status), updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      name.trim(),
      location?.trim() || null,
      sarpanch_name?.trim() || null,
      sarpanch_mobile?.trim() || null,
      panchayat?.trim() || null,
      taluka?.trim() || panchayat?.trim() || '',
      district?.trim() || null,
      emergency_contact?.trim() || null,
      notes?.trim() || null,
      status || 'active',
      villageId
    ]);

    res.json({
      message: 'Village updated successfully',
      village: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error updating village:', err);
    res.status(500).json({ message: 'Failed to update village', error: err.message });
  }
};

// ─── Village Management: Delete Village ──────────────────────────────────────
const deleteVillage = async (req, res) => {
  const { villageId } = req.params;
  const { force } = req.query;

  try {
    const villageRes = await pool.query(`SELECT * FROM ri_villages WHERE id = $1`, [villageId]);
    if (villageRes.rowCount === 0) {
      return res.status(404).json({ message: 'Village not found' });
    }
    const village = villageRes.rows[0];

    const assignedPanelsRes = await pool.query(`
      SELECT 
        rp.id, 
        rp.panel_number, 
        rp.name,
        COUNT(rbs.id)::int AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id AND rbs.ri_batch_id = rp.ri_batch_id
      WHERE rp.ri_village_id = $1
      GROUP BY rp.id
      ORDER BY rp.panel_number ASC
    `, [villageId]);

    if (assignedPanelsRes.rowCount > 0 && force !== 'true') {
      return res.status(400).json({
        message: `Cannot delete village "${village.name}" because ${assignedPanelsRes.rowCount} panel(s) are currently assigned to it. Please reassign the panels first or confirm force deletion.`,
        has_assigned_panels: true,
        assigned_panels_count: assignedPanelsRes.rowCount,
        assigned_panels: assignedPanelsRes.rows
      });
    }

    await pool.query(`UPDATE ri_panels SET ri_village_id = NULL WHERE ri_village_id = $1`, [villageId]);
    await pool.query(`DELETE FROM ri_villages WHERE id = $1`, [villageId]);

    res.json({
      message: `Village "${village.name}" deleted successfully. Linked panels have been unassigned.`
    });
  } catch (err) {
    console.error('Error deleting village:', err);
    res.status(500).json({ message: 'Failed to delete village', error: err.message });
  }
};

// ─── Panel Allocation: Assign Single Panel to Village ────────────────────────
const assignPanelVillage = async (req, res) => {
  const { panelId } = req.params;
  const { ri_village_id } = req.body;

  try {
    const panelRes = await pool.query(`SELECT id, ri_batch_id, name FROM ri_panels WHERE id = $1`, [panelId]);
    if (panelRes.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found' });
    }
    const panel = panelRes.rows[0];

    if (ri_village_id !== null && ri_village_id !== undefined && ri_village_id !== '') {
      const villageRes = await pool.query(
        `SELECT id, name, ri_batch_id FROM ri_villages WHERE id = $1 AND status <> 'deleted'`,
        [ri_village_id]
      );
      if (villageRes.rowCount === 0) {
        return res.status(404).json({ message: 'Village not found' });
      }
      if (villageRes.rows[0].ri_batch_id !== panel.ri_batch_id) {
        return res.status(400).json({ message: 'Cannot assign a village belonging to another batch.' });
      }

      await pool.query(`UPDATE ri_panels SET ri_village_id = $1 WHERE id = $2`, [ri_village_id, panelId]);

      return res.json({
        message: `Panel "${panel.name}" assigned to village "${villageRes.rows[0].name}" successfully.`,
        panel_id: panel.id,
        ri_village_id,
        village_name: villageRes.rows[0].name
      });
    } else {
      await pool.query(`UPDATE ri_panels SET ri_village_id = NULL WHERE id = $1`, [panelId]);
      return res.json({
        message: `Village unassigned from Panel "${panel.name}".`,
        panel_id: panel.id,
        ri_village_id: null,
        village_name: null
      });
    }
  } catch (err) {
    console.error('Error assigning village to panel:', err);
    res.status(500).json({ message: 'Failed to assign village to panel', error: err.message });
  }
};

// ─── Panel Allocation: Update Single Panel Nodal Officer ──────────────────────
const updatePanelNodalOfficer = async (req, res) => {
  const { panelId } = req.params;
  const { nodal_officer_name, nodal_officer_email, department, coordinator_name } = req.body;

  try {
    const panelRes = await pool.query(
      `SELECT id, ri_batch_id, panel_number, name, department, school FROM ri_panels WHERE id = $1`,
      [panelId]
    );
    if (panelRes.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found' });
    }
    const panel = panelRes.rows[0];

    const cleanName = typeof nodal_officer_name === 'string' ? nodal_officer_name.trim() : '';
    const cleanEmail = typeof nodal_officer_email === 'string' ? nodal_officer_email.trim().toLowerCase() : '';
    const cleanDept = typeof department === 'string' ? department.trim() : (panel.department || '');

    let nodalUserId = null;

    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }

      // Check if user exists
      const existingUser = await pool.query(
        `SELECT id, role, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [cleanEmail]
      );

      if (existingUser.rowCount > 0) {
        nodalUserId = existingUser.rows[0].id;
        // If name provided and differs, update name
        if (cleanName && cleanName !== existingUser.rows[0].name) {
          await pool.query(
            `UPDATE users SET name = $1 WHERE id = $2`,
            [cleanName, nodalUserId]
          );
        }
        // Ensure user has nodal officer role if currently regular faculty or student
        const currentRole = existingUser.rows[0].role;
        if (!['superadmin', 'admin', 'ri_admin', 'superadmin-ri', 'ri_nodal_officer'].includes(currentRole)) {
          await pool.query(
            `UPDATE users SET role = 'ri_nodal_officer' WHERE id = $1`,
            [nodalUserId]
          );
        }
      } else {
        // Create user with default password 'nodal@123'
        const defaultPasswordHash = await bcrypt.hash('nodal@123', 10);
        const newUser = await pool.query(`
          INSERT INTO users (name, email, password, role, department, school, status, password_changed, created_at)
          VALUES ($1, $2, $3, 'ri_nodal_officer', $4, $5, 'active', false, NOW())
          RETURNING id
        `, [
          cleanName || 'Nodal Officer',
          cleanEmail,
          defaultPasswordHash,
          cleanDept || 'Academic Department',
          panel.school || 'MIT-WPU'
        ]);
        nodalUserId = newUser.rows[0].id;
      }
    }

    // Update the panel record
    const updatedPanelRes = await pool.query(`
      UPDATE ri_panels SET
        nodal_officer_name = NULLIF($1, ''),
        coordinator_name = COALESCE(NULLIF($2, ''), coordinator_name, NULLIF($1, '')),
        nodal_officer_email = NULLIF($3, ''),
        nodal_officer_user_id = $4,
        department = COALESCE(NULLIF($5, ''), department)
      WHERE id = $6
      RETURNING id, panel_number, name AS panel_name, nodal_officer_name, nodal_officer_email, nodal_officer_user_id, department, school
    `, [
      cleanName,
      coordinator_name || cleanName,
      cleanEmail,
      nodalUserId,
      cleanDept,
      panelId
    ]);

    const updatedPanel = updatedPanelRes.rows[0];

    writeAuditLog(req.user?.id || 1, 'UPDATE_NODAL_OFFICER', `Updated Nodal Officer for panel ${panel.name || panel.panel_number}`, {
      panel_id: panelId,
      nodal_officer_name: cleanName,
      nodal_officer_email: cleanEmail
    });

    return res.json({
      success: true,
      message: `Nodal Officer details updated successfully for ${panel.name || 'Panel ' + panel.panel_number}.`,
      panel: updatedPanel
    });
  } catch (err) {
    console.error('Error updating panel nodal officer:', err);
    res.status(500).json({ message: 'Failed to update Nodal Officer details', error: err.message });
  }
};

// ─── Panel Allocation: Bulk Assign Panels to Villages ────────────────────────
const bulkAssignPanelsVillages = async (req, res) => {
  const { id } = req.params; // Batch ID
  const { allocations } = req.body; // Array of { panel_id, ri_village_id }

  if (!Array.isArray(allocations)) {
    return res.status(400).json({ message: 'allocations must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query(
      `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;

    const validVillagesRes = await client.query(
      `SELECT id FROM ri_villages WHERE ri_batch_id = $1`,
      [riBatchId]
    );
    const validVillageSet = new Set(validVillagesRes.rows.map(r => r.id));

    const validPanelsRes = await client.query(
      `SELECT id FROM ri_panels WHERE ri_batch_id = $1`,
      [riBatchId]
    );
    const validPanelSet = new Set(validPanelsRes.rows.map(r => r.id));

    for (const alloc of allocations) {
      if (!validPanelSet.has(alloc.panel_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Panel ID ${alloc.panel_id} does not belong to this batch.` });
      }
      if (alloc.ri_village_id && !validVillageSet.has(alloc.ri_village_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: `Village ID ${alloc.ri_village_id} does not belong to this batch.` });
      }

      await client.query(
        `UPDATE ri_panels SET ri_village_id = $1 WHERE id = $2`,
        [alloc.ri_village_id || null, alloc.panel_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Panel village allocations saved successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error bulk assigning panels to villages:', err);
    res.status(500).json({ message: 'Failed to save panel village allocations', error: err.message });
  } finally {
    client.release();
  }
};

// ─── Delete RI Panel (With Safe Dependency Inspection) ──────────────────────
const deletePanel = async (req, res) => {
  const panelId = req.params.panelId || req.params.id;

  // 1. Role-based permission check: Disallow read-only superadmins
  if (req.user?.role === 'superadmin_ri_readonly' || req.user?.role === 'superadmin-ri-readonly') {
    return res.status(403).json({
      success: false,
      message: 'Read-only administrators are not permitted to delete panels.'
    });
  }

  const client = await pool.connect();
  try {
    // 2. Locate panel and batch
    const panelRes = await client.query(`
      SELECT 
        rp.id,
        rp.ri_batch_id,
        rp.panel_number,
        rp.name,
        rp.ri_village_id,
        rp.nodal_officer_name,
        rb.name AS batch_name,
        rb.batch_code,
        rb.source_program,
        rv.name AS village_name
      FROM ri_panels rp
      LEFT JOIN ri_batches rb ON rb.id = rp.ri_batch_id
      LEFT JOIN ri_villages rv ON rv.id = rp.ri_village_id
      WHERE rp.id = $1
    `, [panelId]);

    if (panelRes.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Panel not found.'
      });
    }

    const panel = panelRes.rows[0];

    // 3. Inspect student count: ONLY condition that determines whether deletion is allowed
    const studentCountRes = await client.query(`
      SELECT COUNT(*)::int AS count 
      FROM ri_batch_students 
      WHERE ri_panel_id = $1
    `, [panelId]);
    const studentCount = studentCountRes.rows[0].count;

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this panel because students are assigned to it. Please reassign the students before deleting.',
        has_students: true,
        student_count: studentCount
      });
    }

    // 4. Panel has 0 students: Deletion is ALLOWED even if faculty mentors or non-student assignments exist.
    // Safely remove only the relevant panel assignments while preserving all faculty accounts and unrelated data.
    await client.query('BEGIN');

    // a. Safely unassign faculty mentors assigned to this panel (does NOT delete faculty accounts or ri_batch_faculty rows)
    await client.query(`
      UPDATE ri_batch_faculty 
      SET ri_panel_id = NULL 
      WHERE ri_panel_id = $1
    `, [panelId]);

    // b. Clean up locks, undertakings, or media tied to this empty panel
    await client.query('DELETE FROM ri_evaluation_locks WHERE ri_panel_id = $1', [panelId]);
    await client.query('DELETE FROM ri_attendance_locks WHERE ri_panel_id = $1', [panelId]);
    await client.query('DELETE FROM ri_panel_media WHERE ri_panel_id = $1', [panelId]);

    // c. Delete the panel record itself (automatically clears panel village allocation without touching ri_villages)
    const deleteRes = await client.query('DELETE FROM ri_panels WHERE id = $1 RETURNING *', [panelId]);
    if (deleteRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Failed to delete panel.' });
    }

    await client.query('COMMIT');

    writeAuditLog(req.user?.id || null, 'RI_PANEL_DELETED', `Deleted panel "${panel.name}" (ID ${panel.id}) from batch ${panel.batch_name || panel.ri_batch_id}`, {
      panel_id: panel.id,
      panel_number: panel.panel_number,
      panel_name: panel.name,
      batch_id: panel.ri_batch_id,
      batch_name: panel.batch_name
    });

    return res.json({
      success: true,
      message: `Panel "${panel.name}" deleted successfully.`
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting panel:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete panel due to an internal server error.',
      error: err.message
    });
  } finally {
    client.release();
  }
};

// ─── 7. Get Students in a Specific Panel ─────────────────────────────────────
const getPanelStudents = async (req, res) => {
  const { id } = req.params; // Panel ID
  const { search, page = 1, limit = 50 } = req.query;
  const isExport = req.query.export === 'true' || req.query.all === 'true';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // 1. Get panel and batch info
    const panelInfoQuery = await pool.query(`
      SELECT 
        rp.id, rp.name AS panel_name, rp.panel_number, rp.capacity,
        rb.id AS batch_id, rb.name AS batch_name, rb.source_program
      FROM ri_panels rp
      JOIN ri_batches rb ON rp.ri_batch_id = rb.id
      WHERE rp.id = $1
    `, [id]);

    if (panelInfoQuery.rowCount === 0) {
      return res.status(404).json({ message: 'Panel not found' });
    }

    const panelInfo = panelInfoQuery.rows[0];

    // 2. Build search filter - ensure student belongs to both this panel and its batch
    let whereClause = `WHERE rbs.ri_panel_id = $1 AND rbs.ri_batch_id = $2`;
    const params = [id, panelInfo.batch_id];

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClause += ` AND (
        LOWER(u.name) LIKE $${params.length} OR 
        LOWER(u.email) LIKE $${params.length} OR 
        LOWER(COALESCE(u.prn, '')) LIKE $${params.length} OR
        LOWER(COALESCE(rbs.ri_id, '')) LIKE $${params.length}
      )`;
    }

    // 3. Count total students in this panel matching filter
    const countQuery = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      ${whereClause}
    `, params);

    const totalStudents = countQuery.rows[0].total;

    // 4. Fetch students (paginated or full list for export)
    let studentsQueryStr = `
      SELECT 
        u.id,
        u.id AS student_id,
        u.prn,
        u.name,
        u.email,
        u.school,
        u.department,
        u.division,
        u.semester,
        u.year,
        u.phone,
        u.gender,
        rbs.ri_id,
        rbs.source_program,
        rbs.enrollment_type,
        rbs.enrolled_at,
        rp.name AS panel_name,
        rp.panel_number
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      ${whereClause}
      ORDER BY u.name ASC, u.id ASC
    `;

    if (!isExport) {
      params.push(parseInt(limit));
      params.push(offset);
      studentsQueryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const studentsQuery = await pool.query(studentsQueryStr, params);
    let students = studentsQuery.rows;

    // Attach official LTC ID for LTC_SYNC batches
    if (panelInfo.source_program === 'LTC_SYNC') {
      students = await withLtcId(students);
    }

    res.json({
      panel: panelInfo,
      total: totalStudents,
      page: isExport ? 1 : parseInt(page),
      limit: isExport ? totalStudents : parseInt(limit),
      total_pages: isExport ? 1 : Math.max(1, Math.ceil(totalStudents / parseInt(limit))),
      students
    });
  } catch (err) {
    console.error('Error fetching panel students:', err);
    res.status(500).json({ message: 'Failed to fetch panel students', error: err.message });
  }
};

// ─── 8. Get All Enrolled RI Students ─────────────────────────────────────────
const getAllRiStudents = async (req, res) => {
  const { search, batch_id, panel_id, source, page = 1, limit = 50 } = req.query;
  const isExport = req.query.export === 'true' || req.query.all === 'true';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const conditions = [];
    const params = [];

    if (batch_id) {
      const bRes = await pool.query(
        `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
        [parseInt(batch_id, 10)]
      );
      const resolvedBId = bRes.rowCount > 0 ? bRes.rows[0].id : parseInt(batch_id, 10);
      params.push(resolvedBId);
      conditions.push(`rbs.ri_batch_id = $${params.length}`);
    }

    if (panel_id) {
      params.push(parseInt(panel_id));
      conditions.push(`rbs.ri_panel_id = $${params.length}`);
    }

    if (source) {
      const srcUpper = source.toUpperCase();
      if (srcUpper === 'LTC' || srcUpper === 'LTC_SYNC') {
        conditions.push(`(rbs.source_program IN ('LTC', 'LTC_SYNC') OR rbs.enrollment_type = 'LTC_SYNC')`);
      } else if (srcUpper === 'RI' || srcUpper === 'RI_DIRECT') {
        conditions.push(`(rbs.source_program IN ('RI', 'RI_DIRECT') OR rbs.enrollment_type IN ('RI_DIRECT', 'DIRECT_UPLOAD', 'RI_BULK_UPLOAD'))`);
      } else {
        params.push(srcUpper);
        conditions.push(`rbs.source_program = $${params.length}`);
      }
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(
        LOWER(u.name) LIKE $${params.length} OR 
        LOWER(u.email) LIKE $${params.length} OR 
        LOWER(COALESCE(u.prn, '')) LIKE $${params.length} OR
        LOWER(COALESCE(rbs.ri_id, '')) LIKE $${params.length}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countQuery = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      ${whereClause}
    `, params);

    const totalStudents = countQuery.rows[0].total;

    let studentsQueryStr = `
      SELECT 
        u.id,
        u.id AS student_id,
        rbs.id AS enrollment_id,
        rbs.id AS ri_batch_student_id,
        u.prn,
        u.name,
        u.email,
        u.school,
        u.department,
        u.division,
        u.semester,
        u.year,
        u.phone,
        u.gender,
        rbs.ri_id,
        rbs.source_program,
        rbs.enrollment_type,
        rbs.enrolled_at,
        rb.id AS batch_id,
        rb.name AS batch_name,
        COALESCE(rb.batch_code, '') AS batch_code,
        COALESCE(rb.source_program, rbs.source_program) AS batch_source,
        rp.id AS panel_id,
        rp.name AS panel_name,
        rp.panel_number
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      LEFT JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      ${whereClause}
      ORDER BY rb.name ASC, rp.panel_number ASC NULLS LAST, u.name ASC
    `;

    // Fetch paginated unless export requested
    if (!isExport) {
      params.push(parseInt(limit));
      params.push(offset);
      studentsQueryStr += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const studentsQuery = await pool.query(studentsQueryStr, params);
    const students = await withLtcId(studentsQuery.rows);

    res.json({
      total: totalStudents,
      page: isExport ? 1 : parseInt(page),
      limit: isExport ? totalStudents : parseInt(limit),
      total_pages: isExport ? 1 : Math.max(1, Math.ceil(totalStudents / parseInt(limit))),
      students
    });
  } catch (err) {
    console.error('Error fetching all RI students:', err);
    res.status(500).json({ message: 'Failed to fetch RI students', error: err.message });
  }
};

// ─── 8. Faculty / Mentor Management: Get Faculty for a Batch ─────────────────
const getBatchFaculty = async (req, res) => {
  const { id } = req.params;
  const { panel_id, search } = req.query;
  try {
    const batchRes = await pool.query(
      `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    let riBatchId;
    if (batchRes.rowCount > 0) {
      riBatchId = batchRes.rows[0].id;
    } else {
      const fallbackRes = await pool.query(`SELECT id FROM ri_batches ORDER BY id DESC LIMIT 1`);
      if (fallbackRes.rowCount > 0) {
        riBatchId = fallbackRes.rows[0].id;
      } else {
        return res.status(404).json({ message: 'RI Batch not found' });
      }
    }

    let query = `
      SELECT 
        rbf.*,
        rp.panel_number,
        rp.name AS panel_name,
        v.name AS village_name,
        COALESCE(rfu.id IS NOT NULL OR u.ri_undertaking_submitted = TRUE, false) AS undertaking_submitted,
        rfu.id AS undertaking_id,
        COALESCE(rfu.signed_name, u.ri_undertaking_signed_name, rbf.name) AS undertaking_signed_name,
        COALESCE(rfu.signed_date, u.ri_undertaking_signed_date) AS undertaking_signed_date,
        COALESCE(rfu.tshirt_size, u.ri_tshirt_size) AS undertaking_tshirt_size,
        COALESCE(rfu.photo_video_consent, true) AS photo_video_consent,
        COALESCE(rfu.data_consent, true) AS data_consent,
        COALESCE(rfu.rules_consent, true) AS rules_consent,
        COALESCE(rfu.dos_donts_consent, true) AS dos_donts_consent,
        COALESCE(rfu.honor_code_consent, true) AS honor_code_consent,
        rfu.created_at AS undertaking_created_at
      FROM ri_batch_faculty rbf
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN users u ON u.id = COALESCE(rbf.faculty_id, (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email) LIMIT 1))
      LEFT JOIN LATERAL (
        SELECT * FROM ri_faculty_undertakings fu
        WHERE (u.id IS NOT NULL AND fu.faculty_id = u.id)
           OR (rbf.faculty_id IS NOT NULL AND fu.faculty_id = rbf.faculty_id)
        ORDER BY fu.id DESC LIMIT 1
      ) rfu ON true
      WHERE rbf.ri_batch_id = $1 AND rbf.status <> 'deleted'
    `;
    const params = [riBatchId];
    let paramIndex = 2;

    if (panel_id) {
      query += ` AND rbf.ri_panel_id = $${paramIndex++}`;
      params.push(panel_id);
    }

    if (search && search.trim()) {
      query += ` AND (
        rbf.name ILIKE $${paramIndex} OR 
        rbf.email ILIKE $${paramIndex} OR 
        rbf.department ILIKE $${paramIndex} OR 
        rbf.employee_id ILIKE $${paramIndex} OR 
        rp.name ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    query += ` ORDER BY rp.panel_number ASC NULLS LAST, rbf.name ASC`;

    const result = await pool.query(query, params);
    res.json({ faculty: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Error fetching batch faculty:', err);
    res.status(500).json({ message: 'Failed to fetch batch faculty', error: err.message });
  }
};

// Helper: Safe string trimmer
const cleanStr = (val, maxLen = 250) => {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str) return null;
  return str.length > maxLen ? str.substring(0, maxLen) : str;
};

// Helper: Parse uploaded Excel (.xlsx, .xls) or CSV buffer into row objects using smart header scanner
const parseSpreadsheetBuffer = (buffer, filename = '') => {
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  } catch (xlsxErr) {
    if (filename && filename.toLowerCase().endsWith('.csv')) {
      const csvStr = buffer.toString('utf-8');
      workbook = XLSX.read(csvStr, { type: 'string' });
    } else {
      throw new Error(`Unable to read spreadsheet: ${xlsxErr.message}`);
    }
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The spreadsheet contains no readable sheets.');
  }

  const worksheet = workbook.Sheets[sheetName];
  // Use LTC's smart header scanning parser which accurately finds the header row
  return parseExcelSheetSmart(worksheet);
};

// Helper: Normalize raw row object keys from various template column variations
const normalizeFacultyRow = (rawRow) => {
  const findVal = (possibleKeys) => {
    for (const key of Object.keys(rawRow)) {
      const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const pk of possibleKeys) {
        if (normalizedKey === pk.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const val = rawRow[key];
          return val != null ? String(val).trim() : '';
        }
      }
    }
    return '';
  };

  return {
    name: findVal(['name', 'fullname', 'facultyname', 'mentorname', 'faculty', 'mentor']),
    email: findVal(['email', 'emailaddress', 'mail', 'facultyemail', 'mentoremail']),
    panel_input: findVal(['panel', 'panelnumber', 'panelno', 'panelname', 'assignedpanel', 'division', 'panelidentifier']),
    phone: findVal(['mobilenumber', 'mobile', 'phone', 'phonenumber', 'contact', 'contactnumber']),
    department: findVal(['department', 'dept', 'branch', 'school']),
    designation: findVal(['designation', 'title', 'position', 'post']),
    employee_id: findVal(['employeeid', 'empid', 'facultyid', 'code', 'id']),
    role: findVal(['role', 'type', 'facultyrole']) || 'Mentor'
  };
};

// Helper: Clean panel name to strictly display only the panel name without any "Panel X —" or "PX:" prefix
const cleanPanelName = (name) => {
  if (!name) return 'Unassigned';
  const str = String(name).trim();
  if (str === '—' || str === '-' || str.toLowerCase() === 'unassigned') return 'Unassigned';
  const cleaned = str.replace(/^(Panel\s+\d+\s*[-—:]\s*|P\d+\s*[-—:]\s*)/i, '').trim();
  return cleaned || str;
};

// Helper: Normalize raw row object keys for Student bulk upload using LTC's exact mapOfficialHeaders logic
const normalizeStudentRow = (rawRow) => {
  const normalized = mapOfficialHeaders(rawRow);

  // 1. Reconstruct Name exactly like LTC bulk upload
  let nameVal = normalized.name || normalized.full_name || normalized.student_name;
  if (!nameVal) {
    const parts = [
      String(normalized.first_name || '').trim(),
      String(normalized.middle_name || '').trim(),
      String(normalized.last_name || '').trim(),
    ].filter(Boolean);
    if (parts.length > 0) {
      const sal = String(normalized.salutation || '').trim();
      nameVal = sal ? `${sal} ${parts.join(' ')}` : parts.join(' ');
    }
  } else if (normalized.last_name && !nameVal.includes(normalized.last_name)) {
    nameVal = `${nameVal} ${normalized.last_name}`.trim();
  }

  // 2. PRN Resolution exactly like LTC
  const prn = String(
    normalized._prn_raw || normalized.prn || normalized['student id'] || normalized.student_id || ''
  ).trim();

  // 3. Email resolution: read exact email value directly from Excel, do NOT generate missing values from PRN
  const email = String(normalized.email || '').trim().toLowerCase();

  // 4. Panel resolution input
  const panelInput = String(
    normalized.panel || normalized.panel_input || normalized.panel_name || ''
  ).trim();

  // 5. Phone / mobile
  const phone = String(
    normalized.phone || normalized.mobile || normalized.mobile_no || normalized.contact || ''
  ).trim();

  // 6. Department, School, Division, Roll Number, Gender
  const department = String(normalized.department || '').trim();
  const school = String(normalized.school || '').trim();
  const division = String(normalized.division || '').trim();
  const rollNumber = String(normalized.roll_number || normalized.roll_no || normalized.roll || '').trim();
  const gender = String(normalized.gender || '').trim();

  // 7. Other supported Master Sheet fields
  const dob = normalized.dob ? (parseExcelDate(normalized.dob) || String(normalized.dob).trim()) : null;
  const age = (normalized.age !== undefined && normalized.age !== null && normalized.age !== '') ? parseInt(normalized.age, 10) || null : null;
  const address = String(normalized.address || '').trim();
  const parentMobile = String(normalized.parent_mobile || '').trim();
  const parentEmail = String(normalized.parent_email || '').trim();
  const nationality = String(normalized.nationality || '').trim();
  const aadharNo = String(normalized.aadhar_no || '').trim();
  const nomineeName = String(normalized.nominee_name || '').trim();
  const nomineeRelationship = String(normalized.nominee_relationship || '').trim();
  const nomineeEmail = String(normalized.nominee_email || '').trim();
  const faculty = String(normalized.faculty || '').trim();
  const salutation = String(normalized.salutation || '').trim();
  const firstName = String(normalized.first_name || '').trim();
  const middleName = String(normalized.middle_name || '').trim();
  const lastName = String(normalized.last_name || '').trim();

  return {
    ...normalized,
    prn,
    name: nameVal || '',
    email,
    panel_input: panelInput,
    phone,
    mobile: phone,
    department,
    school,
    division,
    roll_number: rollNumber,
    gender,
    dob,
    age,
    address,
    parent_mobile: parentMobile,
    parent_email: parentEmail,
    nationality,
    aadhar_no: aadharNo,
    nominee_name: nomineeName,
    nominee_relationship: nomineeRelationship,
    nominee_email: nomineeEmail,
    faculty,
    salutation,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName
  };
};

// Helper: Match panel input to existing batch panels
const matchPanel = (panelInput, batchPanels) => {
  if (!panelInput || !Array.isArray(batchPanels)) return null;
  const cleanInput = String(panelInput).trim().toLowerCase();
  if (!cleanInput) return null;

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const inputNorm = norm(cleanInput);

  // 1. Try matching by panel_number directly (e.g. "1", "01", "p1", "panel 1", "panel 01", "panel - 1", "panel-1", "panel#1")
  const numMatch = cleanInput.match(/^(?:p(?:anel)?[\s\-#]*)0*(\d+)$/i) || cleanInput.match(/^0*(\d+)$/);
  if (numMatch) {
    const pNum = parseInt(numMatch[1], 10);
    const found = batchPanels.find(p => p.panel_number === pNum);
    if (found) return found;
  }

  // 2. Try exact panel name match
  const exactName = batchPanels.find(p => p.name && p.name.trim().toLowerCase() === cleanInput);
  if (exactName) return exactName;

  // 3. Try matching "Panel X — Name" against just "Name" or vice-versa
  const cleanedExact = batchPanels.find(p => {
    if (!p.name) return false;
    const rawPName = p.name.trim().toLowerCase();
    const withoutPrefix = rawPName.replace(/^panel\s*\d+\s*[-—–:]\s*/i, '').trim();
    const cleanWithoutPrefix = cleanInput.replace(/^panel\s*\d+\s*[-—–:]\s*/i, '').trim();
    return withoutPrefix === cleanInput || rawPName === cleanWithoutPrefix || withoutPrefix === cleanWithoutPrefix;
  });
  if (cleanedExact) return cleanedExact;

  // 4. Try exact alphanumeric match (ignoring spaces, hyphens, underscores)
  const normMatch = batchPanels.find(p => {
    if (!p.name) return false;
    const pNorm = norm(p.name);
    const pNormWithoutPrefix = norm(p.name.replace(/^panel\s*\d+\s*[-—–:]\s*/i, ''));
    const inNormWithoutPrefix = norm(cleanInput.replace(/^panel\s*\d+\s*[-—–:]\s*/i, ''));
    return pNorm === inputNorm || pNormWithoutPrefix === inputNorm || pNorm === inNormWithoutPrefix || pNormWithoutPrefix === inNormWithoutPrefix;
  });
  if (normMatch) return normMatch;

  return null;
};

// ─── 9. Validate Faculty/Mentor Bulk Upload ──────────────────────────────────
const validateFacultyUpload = async (req, res) => {
  const { id } = req.params;
  const mode = req.body?.mode || req.body?.upload_mode || 'batch_wise';
  const ri_panel_id = req.body?.ri_panel_id;

  let rawRows = [];
  if (req.file && req.file.buffer) {
    try {
      rawRows = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }
  } else if (req.body?.rows) {
    if (typeof req.body.rows === 'string') {
      try {
        rawRows = JSON.parse(req.body.rows);
      } catch (e) {
        rawRows = [];
      }
    } else if (Array.isArray(req.body.rows)) {
      rawRows = req.body.rows;
    }
  }

  if (!rawRows || rawRows.length === 0) {
    return res.status(400).json({ message: 'No rows found in the uploaded file.' });
  }

  try {
    const batchRes = await pool.query(
      `SELECT id, name FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;

    // Fetch batch panels
    const panelsRes = await pool.query(
      `SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`,
      [riBatchId]
    );
    const batchPanels = panelsRes.rows;

    let targetPanel = null;
    if (mode === 'panel_wise') {
      if (!ri_panel_id) {
        return res.status(400).json({ message: 'Target panel is required for Panel-wise upload.' });
      }
      targetPanel = batchPanels.find(p => p.id === Number(ri_panel_id));
      if (!targetPanel) {
        return res.status(400).json({ message: 'Selected panel does not belong to this batch.' });
      }
    }

    // Fetch existing active faculty in this batch
    const existingFacultyRes = await pool.query(
      `SELECT id, email, name, ri_panel_id FROM ri_batch_faculty WHERE ri_batch_id = $1 AND status <> 'deleted'`,
      [riBatchId]
    );
    const existingFacultyMap = new Map();
    existingFacultyRes.rows.forEach(f => {
      existingFacultyMap.set(f.email.toLowerCase(), f);
    });

    // Fetch all user emails to match existing users
    const usersRes = await pool.query(`SELECT id, email FROM users`);
    const existingUserMap = new Map();
    usersRes.rows.forEach(u => {
      existingUserMap.set(u.email.toLowerCase(), u.id);
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seenEmailsInFile = new Map();
    const validatedRows = [];
    let validCount = 0;
    let invalidCount = 0;
    let matchedUsersCount = 0;

    const availablePanelsListStr = batchPanels.map(p => `P${p.panel_number}: ${p.name}`).join(', ');

    rawRows.forEach((rawRow, idx) => {
      const rowNum = idx + 1;
      const normalized = normalizeFacultyRow(rawRow);
      const errors = [];
      const warnings = [];

      // 1. Validate Name
      if (!normalized.name || normalized.name.length < 2) {
        errors.push('Faculty/Mentor Name is required (minimum 2 characters)');
      }

      // 2. Validate Email
      if (!normalized.email) {
        errors.push('Email is required');
      } else if (!emailRegex.test(normalized.email)) {
        errors.push(`Invalid email format: "${normalized.email}"`);
      } else {
        const lowerEmail = normalized.email.toLowerCase();
        if (seenEmailsInFile.has(lowerEmail)) {
          errors.push(`Duplicate email in file (first seen at row ${seenEmailsInFile.get(lowerEmail)})`);
        } else {
          seenEmailsInFile.set(lowerEmail, rowNum);
        }
      }

      // 3. Validate Panel
      let resolvedPanelId = null;
      let resolvedPanelName = '';
      let resolvedPanelNumber = null;

      if (mode === 'panel_wise') {
        resolvedPanelId = targetPanel.id;
        resolvedPanelName = targetPanel.name;
        resolvedPanelNumber = targetPanel.panel_number;
      } else {
        // batch_wise
        if (!normalized.panel_input) {
          errors.push(`Panel column is required. Available panels: ${availablePanelsListStr}`);
        } else {
          const matched = matchPanel(normalized.panel_input, batchPanels);
          if (!matched) {
            errors.push(`Panel "${normalized.panel_input}" could not be found in this RI batch. Valid panels: ${availablePanelsListStr}`);
          } else {
            resolvedPanelId = matched.id;
            resolvedPanelName = matched.name;
            resolvedPanelNumber = matched.panel_number;
          }
        }
      }

      // 4. Check existing database record and user matches
      let matchedUserId = null;
      if (normalized.email && emailRegex.test(normalized.email)) {
        const lowerEmail = normalized.email.toLowerCase();
        if (existingUserMap.has(lowerEmail)) {
          matchedUserId = existingUserMap.get(lowerEmail);
          matchedUsersCount++;
        }

        const existing = existingFacultyMap.get(lowerEmail);
        if (existing) {
          if (existing.ri_panel_id === resolvedPanelId) {
            warnings.push(`Already registered in this panel (details will be updated on import).`);
          } else {
            const currentP = batchPanels.find(p => p.id === existing.ri_panel_id);
            const currentPName = currentP ? `P${currentP.panel_number}` : 'another panel';
            warnings.push(`Currently assigned to ${currentPName}; will be reassigned to ${resolvedPanelName || 'selected panel'}.`);
          }
        }
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      validatedRows.push({
        row_index: rowNum,
        row_number: rowNum,
        name: normalized.name,
        email: normalized.email,
        raw_panel_input: normalized.panel_input,
        panel_input: normalized.panel_input || (resolvedPanelName ? `P${resolvedPanelNumber}` : ''),
        resolved_panel_id: resolvedPanelId,
        resolved_panel_name: resolvedPanelName,
        resolved_panel_number: resolvedPanelNumber,
        phone: normalized.phone,
        mobile: normalized.phone,
        department: normalized.department,
        designation: normalized.designation,
        employee_id: normalized.employee_id,
        role: normalized.role || 'Mentor',
        matched_user_id: matchedUserId,
        is_valid: isValid,
        errors,
        warnings
      });
    });

    res.json({
      message: 'Validation completed successfully',
      mode,
      summary: {
        total_rows: rawRows.length,
        valid_rows: validCount,
        invalid_rows: invalidCount,
        existing_users_matched: matchedUsersCount
      },
      total_rows: rawRows.length,
      valid_rows_count: validCount,
      invalid_rows_count: invalidCount,
      target_panel: targetPanel,
      available_panels: batchPanels,
      validated_rows: validatedRows,
      rows: validatedRows
    });
  } catch (err) {
    console.error('Error validating faculty upload:', err);
    res.status(500).json({ message: 'Validation failed', error: err.message });
  }
};

// ─── 10. Execute Faculty/Mentor Bulk Upload ─────────────────────────────────
const bulkUploadFaculty = async (req, res) => {
  const { id } = req.params;
  const mode = req.body?.mode || req.body?.upload_mode || 'batch_wise';
  const ri_panel_id = req.body?.ri_panel_id;

  let inputRows = [];
  if (req.file && req.file.buffer) {
    try {
      inputRows = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }
  } else if (req.body?.rows) {
    if (typeof req.body.rows === 'string') {
      try {
        inputRows = JSON.parse(req.body.rows);
      } catch (e) {
        inputRows = [];
      }
    } else if (Array.isArray(req.body.rows)) {
      inputRows = req.body.rows;
    }
  }

  if (!inputRows || inputRows.length === 0) {
    return res.status(400).json({ message: 'No faculty rows provided for upload.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query(
      `SELECT id, name FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;
    const batchName = batchRes.rows[0].name;

    // Fetch batch panels
    const panelsRes = await client.query(
      `SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1`,
      [riBatchId]
    );
    const batchPanels = panelsRes.rows;

    let importedCount = 0;
    let updatedCount = 0;
    let accountsCreated = 0;
    let accountsExisted = 0;
    let accountsFailed = 0;

    for (const rawRow of inputRows) {
      // If row has validation errors already attached, skip
      if (rawRow.is_valid === false && rawRow.errors && rawRow.errors.length > 0) {
        accountsFailed++;
        continue;
      }

      const normalized = normalizeFacultyRow(rawRow);
      const name = String(rawRow.name || normalized.name || '').trim();
      const email = String(rawRow.email || normalized.email || '').trim().toLowerCase();

      if (!name || !email || !email.includes('@')) {
        accountsFailed++;
        continue;
      }

      let targetPanelId = rawRow.resolved_panel_id;
      if (!targetPanelId && mode === 'panel_wise') {
        targetPanelId = ri_panel_id;
      }
      if (!targetPanelId) {
        const panelInput = rawRow.panel_input || normalized.panel_input || rawRow.raw_panel_input;
        if (panelInput) {
          const matched = matchPanel(panelInput, batchPanels);
          if (matched) targetPanelId = matched.id;
        }
      }

      if (!targetPanelId) {
        accountsFailed++;
        continue;
      }

      const phone = rawRow.phone || rawRow.mobile || normalized.phone || null;
      const department = rawRow.department || normalized.department || null;
      const designation = rawRow.designation || normalized.designation || null;
      const employee_id = rawRow.employee_id || normalized.employee_id || null;
      const role = rawRow.role || normalized.role || 'Mentor';

      // Check if user exists in shared users table
      const userRes = await client.query(
        `SELECT id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      let facultyUserId = null;

      if (userRes.rowCount > 0) {
        facultyUserId = userRes.rows[0].id;
        accountsExisted++;
      } else {
        // Automatically create RI Faculty user account with default password "faculty123"
        const defaultPasswordHash = await bcrypt.hash('faculty123', 10);
        const newUserRes = await client.query(`
          INSERT INTO users (name, email, password, role, department, designation, phone, status)
          VALUES ($1, $2, $3, 'ri_faculty', $4, $5, $6, 'active')
          ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
          RETURNING id
        `, [name, email, defaultPasswordHash, department, designation, phone]);
        facultyUserId = newUserRes.rows[0]?.id || null;
        accountsCreated++;
      }

      // Upsert into ri_batch_faculty
      const upsertRes = await client.query(`
        INSERT INTO ri_batch_faculty (
          ri_batch_id, ri_panel_id, faculty_id, name, email, phone, department, designation, employee_id, role, status, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (ri_batch_id, ri_panel_id, email)
        DO UPDATE SET
          faculty_id = COALESCE(EXCLUDED.faculty_id, ri_batch_faculty.faculty_id),
          name = EXCLUDED.name,
          phone = COALESCE(EXCLUDED.phone, ri_batch_faculty.phone),
          department = COALESCE(EXCLUDED.department, ri_batch_faculty.department),
          designation = COALESCE(EXCLUDED.designation, ri_batch_faculty.designation),
          employee_id = COALESCE(EXCLUDED.employee_id, ri_batch_faculty.employee_id),
          role = COALESCE(EXCLUDED.role, ri_batch_faculty.role),
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS is_insert
      `, [
        riBatchId,
        targetPanelId,
        facultyUserId,
        name,
        email,
        phone,
        department,
        designation,
        employee_id,
        role
      ]);

      if (upsertRes.rows[0]?.is_insert) {
        importedCount++;
      } else {
        updatedCount++;
      }
    }

    await client.query('COMMIT');
    res.json({
      message: `Faculty import completed: ${accountsCreated} user accounts created (default password: faculty123), ${accountsExisted} already existed, ${updatedCount} assignments updated.`,
      imported_count: importedCount + updatedCount,
      accounts_created: accountsCreated,
      accounts_existed: accountsExisted,
      assignments_updated: updatedCount,
      accounts_failed: accountsFailed,
      total_processed: importedCount + updatedCount + accountsFailed
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in faculty bulk upload:', err);
    res.status(500).json({ message: 'Failed to import faculty', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 10B. Village & Faculty Integrated Excel Upload & Preview ───────────────

const normalizeVillageFacultyHeader = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[._\-/\(\):,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const mapVillageFacultyColumns = (rawHeaders) => {
  const mapping = {};
  const accompanyEmailRegex = /(?:email|mail|e mail|id).*(?:accompany|faculty)\s*(\d+)|(?:accompany|faculty)\s*(\d+).*(?:email|mail|e mail|id)/i;
  const accompanyNameRegex = /(?:accompany(?:\w*)\s*faculty|accompany(?:\w*))\s*(\d+)/i;

  rawHeaders.forEach((rawH, idx) => {
    if (!rawH) return;
    const h = normalizeVillageFacultyHeader(rawH);
    if (!h) return;

    if (h === 'sr' || h === 'sr no' || h === 's no' || h === 'serial' || h === 'serial no' || h === 'sr.') {
      mapping.sr = idx;
    } else if (h.includes('principal') || h.includes('head master') || h.includes('headmaster')) {
      mapping.principal_mobile = idx;
    } else if (h.includes('village school') || (h.includes('school') && h.includes('name') && !h.includes('head master') && !h.includes('principal'))) {
      mapping.school_name = idx;
    } else if (h.includes('school') && !h.includes('village')) {
      mapping.school = idx;
    } else if (h === 'c' || h === 'dept' || h === 'department' || h === 'programme' || h === 'program' || h === 'branch') {
      mapping.department = idx;
    } else if (h === 'panel' || h === 'panel name' || h === 'panel no' || h === 'division' || h === 'panel division' || h === 'squad') {
      mapping.panel = idx;
    } else if ((h.includes('nodal') || h.includes('coordinator')) && (h.includes('email') || h.includes('mail') || h.includes('id'))) {
      mapping.nodal_officer_email = idx;
    } else if (h.includes('nodal') || (h.includes('department') && h.includes('coordinator')) || (h.includes('dept') && h.includes('coordinator'))) {
      mapping.nodal_officer_name = idx;
    } else if ((h.includes('class teacher') || h.includes('advance taken') || h.includes('advance faculty')) && (h.includes('email') || h.includes('mail') || h.includes('id'))) {
      mapping.class_teacher_email = idx;
    } else if (h.includes('class teacher') || h.includes('advance taken') || h.includes('advance faculty')) {
      mapping.class_teacher_name = idx;
    } else if (accompanyEmailRegex.test(h)) {
      const match = h.match(accompanyEmailRegex);
      const num = match ? (match[1] || match[2] || '1') : '1';
      mapping[`accompany_faculty_email_${num}`] = idx;
    } else if (accompanyNameRegex.test(h)) {
      const match = h.match(accompanyNameRegex);
      const num = match ? match[1] : '1';
      mapping[`accompany_faculty_name_${num}`] = idx;
    } else if (h.includes('staff') || h.includes('non teaching')) {
      mapping.staff_non_teaching = idx;
    } else if (h.includes('student count') || h.includes('total student') || h === 'students' || h === 'total count') {
      mapping.student_count = idx;
    } else if (h.includes('boys')) {
      mapping.boys_count = idx;
    } else if (h.includes('girls')) {
      mapping.girls_count = idx;
    } else if (h === 'village' || h === 'village name' || h.includes('village name') || h === 'assigned village') {
      mapping.village_name = idx;
    } else if (h.includes('detailed address') || h.includes('location')) {
      mapping.detailed_address = idx;
    } else if (h === 'address' || h === 'village address' || h === 'street') {
      mapping.address = idx;
    } else if (h.includes('spoc') && (h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('number'))) {
      mapping.spoc_mobile = idx;
    } else if (h.includes('spoc')) {
      mapping.spoc_name = idx;
    } else if ((h.includes('sarpanch') || h.includes('srapanch')) && (h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('number'))) {
      mapping.sarpanch_mobile = idx;
    } else if (h.includes('sarpanch') || h.includes('srapanch')) {
      mapping.sarpanch_name = idx;
    } else if (h.includes('district') || h === 'dist') {
      mapping.district = idx;
    } else if (h.includes('panchayat') && (h.includes('taluka') || h.includes('tehsil') || h.includes('block'))) {
      mapping.panchayat = idx;
      mapping.taluka = idx;
    } else if (h.includes('panchayat')) {
      mapping.panchayat = idx;
    } else if (h.includes('taluka') || h.includes('tehsil') || h.includes('block')) {
      mapping.taluka = idx;
    } else if (h.includes('google map') || h.includes('map link') || h.includes('maps link') || h.includes('gmap')) {
      mapping.google_maps_link = idx;
    } else if (h.includes('remark') || h.includes('note') || h.includes('comment')) {
      mapping.remark = idx;
    }
  });

  return mapping;
};

const parseVillageFacultySpreadsheet = (bufferOrPath) => {
  let wb;
  if (Buffer.isBuffer(bufferOrPath)) {
    wb = XLSX.read(bufferOrPath, { type: 'buffer' });
  } else if (typeof bufferOrPath === 'string') {
    wb = XLSX.readFile(bufferOrPath);
  } else {
    wb = XLSX.read(bufferOrPath, { type: 'buffer' });
  }

  let targetSheetName = wb.SheetNames[0];
  const matchSheet = wb.SheetNames.find(s => /panel|village|faculty/i.test(s));
  if (matchSheet) targetSheetName = matchSheet;
  const sheet = wb.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });
  if (!rawRows || rawRows.length < 2) {
    throw new Error('Spreadsheet appears to be empty or missing data rows.');
  }

  const rawHeaders = rawRows[0] || [];
  const mapping = mapVillageFacultyColumns(rawHeaders);

  // Validate required columns
  if (mapping.panel === undefined && mapping.village_name === undefined) {
    const headerList = rawHeaders.filter(Boolean).slice(0, 10).join(', ');
    throw new Error(`Could not identify required columns ("Panel" and "Village Name") in spreadsheet headers. Found headers: [${headerList}...]`);
  }

  // Find all accompany faculty name keys (accompany_faculty_name_1, accompany_faculty_name_2, etc.)
  const accompanyNameKeys = Object.keys(mapping)
    .filter(k => k.startsWith('accompany_faculty_name_'))
    .sort((a, b) => {
      const numA = parseInt(a.replace('accompany_faculty_name_', ''), 10);
      const numB = parseInt(b.replace('accompany_faculty_name_', ''), 10);
      return numA - numB;
    });

  const parsedData = [];
  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;

    const panel = mapping.panel !== undefined ? String(row[mapping.panel] || '').trim() : '';
    const villageName = mapping.village_name !== undefined ? String(row[mapping.village_name] || '').trim() : '';
    if (!panel && !villageName) continue;

    const accompanyFaculty = [];
    accompanyNameKeys.forEach(k => {
      const match = k.match(/_(\d+)$/);
      const num = match ? match[1] : '1';
      const name = String(row[mapping[k]] || '').trim();
      const emailKey = `accompany_faculty_email_${num}`;
      const email = mapping[emailKey] !== undefined ? String(row[mapping[emailKey]] || '').trim().toLowerCase() : '';

      if (name && name !== '-' && name !== '—' && name !== 'N/A' && name !== 'NA') {
        accompanyFaculty.push({
          role: `Accompany Faculty ${num}`,
          name: name,
          email: email
        });
      }
    });

    const ctName = mapping.class_teacher_name !== undefined ? String(row[mapping.class_teacher_name] || '').trim() : '';
    let ctEmail = mapping.class_teacher_email !== undefined ? String(row[mapping.class_teacher_email] || '').trim().toLowerCase() : '';

    // If Class Teacher email wasn't explicitly provided, check if the same person is listed in accompanyFaculty with an email
    if (!ctEmail && ctName && ctName !== '-' && ctName !== '—') {
      const sameFaculty = accompanyFaculty.find(af => {
        if (!af.email || !af.email.includes('@')) return false;
        return normalizeFacultyName(af.name) === normalizeFacultyName(ctName);
      });
      if (sameFaculty) {
        ctEmail = sameFaculty.email;
      }
    }

    parsedData.push({
      row_index: r + 1,
      panel,
      village_name: villageName,
      school: mapping.school !== undefined ? String(row[mapping.school] || '').trim() : '',
      department: mapping.department !== undefined ? String(row[mapping.department] || '').trim() : '',
      coordinator_name: mapping.coordinator_name !== undefined ? String(row[mapping.coordinator_name] || '').trim() : '',
      nodal_officer_name: mapping.nodal_officer_name !== undefined ? String(row[mapping.nodal_officer_name] || '').trim() : '',
      nodal_officer_email: mapping.nodal_officer_email !== undefined ? String(row[mapping.nodal_officer_email] || '').trim().toLowerCase() : '',
      class_teacher_name: ctName,
      class_teacher_email: ctEmail,
      student_count: mapping.student_count !== undefined ? parseInt(row[mapping.student_count], 10) || null : null,
      boys_count: mapping.boys_count !== undefined ? parseInt(row[mapping.boys_count], 10) || null : null,
      girls_count: mapping.girls_count !== undefined ? parseInt(row[mapping.girls_count], 10) || null : null,
      address: mapping.address !== undefined ? String(row[mapping.address] || '').trim() : '',
      detailed_address: mapping.detailed_address !== undefined ? String(row[mapping.detailed_address] || '').trim() : '',
      school_name: mapping.school_name !== undefined ? String(row[mapping.school_name] || '').trim() : '',
      principal_mobile: mapping.principal_mobile !== undefined ? String(row[mapping.principal_mobile] || '').trim() : '',
      spoc_name: mapping.spoc_name !== undefined ? String(row[mapping.spoc_name] || '').trim() : '',
      spoc_mobile: mapping.spoc_mobile !== undefined ? String(row[mapping.spoc_mobile] || '').trim() : '',
      sarpanch_name: mapping.sarpanch_name !== undefined ? String(row[mapping.sarpanch_name] || '').trim() : '',
      sarpanch_mobile: mapping.sarpanch_mobile !== undefined ? String(row[mapping.sarpanch_mobile] || '').trim() : '',
      district: mapping.district !== undefined ? String(row[mapping.district] || '').trim() : '',
      panchayat: mapping.panchayat !== undefined ? String(row[mapping.panchayat] || '').trim() : (mapping.taluka !== undefined ? String(row[mapping.taluka] || '').trim() : ''),
      taluka: mapping.taluka !== undefined ? String(row[mapping.taluka] || '').trim() : (mapping.panchayat !== undefined ? String(row[mapping.panchayat] || '').trim() : ''),
      google_maps_link: mapping.google_maps_link !== undefined ? String(row[mapping.google_maps_link] || '').trim() : '',
      remark: mapping.remark !== undefined ? String(row[mapping.remark] || '').trim() : '',
      accompany_faculty: accompanyFaculty
    });
  }

  return parsedData;
};

const normalizeFacultyName = (name) => {
  if (!name) return '';
  return String(name)
    .replace(/\u00A0/g, ' ')
    // Strip leading academic and honorific titles with or without dot and with or without space
    .replace(/^(?:dr|prof|mr|mrs|ms|er|smt|shri|asst\s*prof|assoc\s*prof)\.?\s*/i, '')
    // Also strip bracketed or embedded titles like (Dr.) or Prof.
    .replace(/\b(?:dr|prof|mr|mrs|ms|er|smt|shri)\b\.?/gi, '')
    .replace(/[._\-–—\/\(\):,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const getFacultyTokens = (str) => {
  return normalizeFacultyName(str).split(' ').filter(Boolean);
};

const matchFacultyUser = (facName, facEmail, userList) => {
  if (!userList || userList.length === 0) return null;

  // Tier 1: Exact Email Match (case-insensitive)
  if (facEmail) {
    const cleanEmail = String(facEmail).trim().toLowerCase();
    if (cleanEmail) {
      const match = userList.find(u => u.email && u.email.trim().toLowerCase() === cleanEmail);
      if (match) return match;
    }
  }

  if (!facName) return null;
  const targetNorm = normalizeFacultyName(facName);
  if (!targetNorm) return null;

  const targetTokens = getFacultyTokens(facName);

  // Prioritize faculty and staff accounts over general/student accounts
  const sortedUsers = [...userList].sort((a, b) => {
    const isStaffA = (a.role && a.role !== 'student') ? 0 : 1;
    const isStaffB = (b.role && b.role !== 'student') ? 0 : 1;
    return isStaffA - isStaffB;
  });

  // Tier 2: Exact Normalized Name Match
  for (const u of sortedUsers) {
    const uNorm = normalizeFacultyName(u.name || '');
    if (uNorm && uNorm === targetNorm) {
      return u;
    }
    if (u.first_name || u.last_name) {
      const uFullName = normalizeFacultyName([u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' '));
      if (uFullName && uFullName === targetNorm) {
        return u;
      }
      const uFirstLast = normalizeFacultyName([u.first_name, u.last_name].filter(Boolean).join(' '));
      if (uFirstLast && uFirstLast === targetNorm) {
        return u;
      }
    }
  }

  // Tier 3: First Name + Last Name match with middle initial/name tolerance
  // e.g. 'Ravi Nikam' matches 'Ravi D. Nikam' or 'Ravi Dashrath Nikam'
  // or 'Vilas S Kanthale' matches 'Vilas Kanthale'
  if (targetTokens.length >= 2) {
    const targetFirst = targetTokens[0];
    const targetLast = targetTokens[targetTokens.length - 1];

    for (const u of sortedUsers) {
      const fullName = u.name || [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
      const uTokens = getFacultyTokens(fullName);
      if (uTokens.length >= 2) {
        const uFirst = uTokens[0];
        const uLast = uTokens[uTokens.length - 1];

        if (targetFirst === uFirst && targetLast === uLast) {
          return u;
        }

        // Reversed Last Name First: 'Nikam Ravi'
        if (targetFirst === uLast && targetLast === uFirst) {
          return u;
        }
      }
    }
  }

  // Tier 4: Initial + Last Name match
  // e.g. 'Dr. A. M. Elgandelwar' matches 'Amol Elgandelwar' or 'Dr. B. Sahoo' matches 'Bishnu Sahoo'
  if (targetTokens.length >= 2) {
    const targetFirst = targetTokens[0];
    const targetLast = targetTokens[targetTokens.length - 1];

    for (const u of sortedUsers) {
      const fullName = u.name || [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
      const uTokens = getFacultyTokens(fullName);
      if (uTokens.length >= 2) {
        const uFirst = uTokens[0];
        const uLast = uTokens[uTokens.length - 1];

        if (targetLast === uLast) {
          if (
            (targetFirst.length === 1 && uFirst.startsWith(targetFirst)) ||
            (uFirst.length === 1 && targetFirst.startsWith(uFirst))
          ) {
            return u;
          }
        }
      }
    }
  }

  return null;
};

/**
 * Reconcile unlinked RI faculty records that have emails with valid users accounts.
 * If user does not exist, provision an active ri_faculty account with default password 'faculty123'.
 */
const reconcileUnlinkedRiFaculty = async (clientOrPool = pool) => {
  try {
    const unlinkedRes = await clientOrPool.query(`
      SELECT rbf.id, rbf.name, rbf.email, rbf.department, rp.school
      FROM ri_batch_faculty rbf
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      WHERE rbf.faculty_id IS NULL 
        AND rbf.email IS NOT NULL 
        AND rbf.email LIKE '%@%'
        AND rbf.status <> 'deleted'
    `);
    if (unlinkedRes.rowCount === 0) return 0;

    let linkedCount = 0;
    for (const row of unlinkedRes.rows) {
      const cleanEmail = row.email.trim().toLowerCase();
      const existingUser = await clientOrPool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [cleanEmail]
      );
      let userId;
      if (existingUser.rowCount > 0) {
        userId = existingUser.rows[0].id;
      } else {
        const defaultHash = await bcrypt.hash('faculty123', 10);
        const newUser = await clientOrPool.query(`
          INSERT INTO users (name, email, password, role, department, school, status, password_changed, created_at)
          VALUES ($1, $2, $3, 'ri_faculty', $4, $5, 'active', false, NOW())
          ON CONFLICT (email) DO UPDATE SET role = users.role
          RETURNING id
        `, [
          row.name || 'Faculty Member',
          cleanEmail,
          defaultHash,
          row.department || 'Academic Department',
          row.school || 'MIT-WPU'
        ]);
        userId = newUser.rows[0].id;
      }
      await clientOrPool.query(`UPDATE ri_batch_faculty SET faculty_id = $1 WHERE id = $2`, [userId, row.id]);
      linkedCount++;
    }
    return linkedCount;
  } catch (err) {
    console.error('[reconcileUnlinkedRiFaculty Error]', err.message);
    return 0;
  }
};

// Background invocation to self-heal any unlinked records on boot
reconcileUnlinkedRiFaculty().catch(() => {});

const validateVillageFacultyUpload = async (req, res) => {
  const { id } = req.params;

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: 'Please upload an Excel spreadsheet (.xlsx, .xls) to validate.' });
  }

  try {
    const batchRes = await pool.query(
      `SELECT id, name, batch_code FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'RI Batch cohort not found' });
    }
    const batch = batchRes.rows[0];
    const riBatchId = batch.id;

    // Parse Excel
    let parsedRows;
    try {
      parsedRows = parseVillageFacultySpreadsheet(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: parseErr.message });
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid panel or village rows found in the uploaded file.' });
    }

    // Existing batch panels
    const panelsRes = await pool.query(
      `SELECT id, panel_number, name, ri_village_id FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`,
      [riBatchId]
    );
    const existingPanels = panelsRes.rows;

    // Existing batch villages
    const villagesRes = await pool.query(
      `SELECT id, name, district, taluka FROM ri_villages WHERE ri_batch_id = $1 AND status <> 'deleted'`,
      [riBatchId]
    );
    const existingVillages = villagesRes.rows;

    // Existing users for matching faculty
    const usersRes = await pool.query(
      `SELECT id, name, first_name, middle_name, last_name, email, department, designation, role FROM users`
    );
    const candidateUsers = usersRes.rows;

    const uniquePanels = new Set();
    const uniqueVillages = new Set();
    const unmatchedFacultySet = new Set();
    const missingPanels = new Set();
    const villageConflicts = [];
    const missingFacultyEmails = [];
    let totalFacultyMappings = 0;

    const validatedRows = parsedRows.map(row => {
      const warnings = [];
      const errors = [];

      if (row.panel) uniquePanels.add(row.panel.trim());
      if (row.village_name) uniqueVillages.add(row.village_name.trim());

      // Strict panel matching: must exist in this batch
      const matchedPanel = matchPanel(row.panel, existingPanels);
      if (!matchedPanel && row.panel) {
        errors.push(`Panel "${row.panel}" not found in ${batch.name}. All uploaded panels must match existing batch panels.`);
        missingPanels.add(row.panel.trim());
      }

      // Village match & conflict check
      let matchedVillage = null;
      if (row.village_name) {
        matchedVillage = existingVillages.find(v => v.name.toLowerCase().trim() === row.village_name.toLowerCase().trim());
      }

      if (matchedPanel && matchedPanel.ri_village_id && row.village_name) {
        const currentVillage = existingVillages.find(v => v.id === matchedPanel.ri_village_id);
        if (currentVillage && currentVillage.name.toLowerCase().trim() !== row.village_name.toLowerCase().trim()) {
          errors.push(`Panel "${matchedPanel.name}" is already allocated to village "${currentVillage.name}". Cannot overwrite with "${row.village_name}".`);
          villageConflicts.push({
            panel: matchedPanel.name,
            current_village: currentVillage.name,
            new_village: row.village_name
          });
        }
      }

      // Check Faculty mappings (Class Teacher + Accompany Faculty, match by email if provided, otherwise by normalized name)
      const allRowFaculty = [];
      const ctName = String(row.class_teacher_name || '').trim();
      let ctEmail = String(row.class_teacher_email || '').trim().toLowerCase();

      // If Class Teacher email wasn't explicitly provided, check if the same person is listed in accompanyFaculty with an email
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—' && Array.isArray(row.accompany_faculty)) {
        const sameFaculty = row.accompany_faculty.find(af => {
          if (!af.email || !af.email.includes('@')) return false;
          return normalizeFacultyName(af.name) === normalizeFacultyName(ctName);
        });
        if (sameFaculty) {
          ctEmail = sameFaculty.email;
        }
      }

      // If still no email, check if Class Teacher matches an existing user account to obtain their email
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—') {
        const matchedCt = matchFacultyUser(ctName, null, candidateUsers);
        if (matchedCt && matchedCt.email) {
          ctEmail = matchedCt.email.toLowerCase().trim();
        }
      }

      if (ctName && ctName !== '-' && ctName !== '—') {
        allRowFaculty.push({
          role: 'Class Teacher',
          name: ctName,
          email: ctEmail
        });
      }
      if (Array.isArray(row.accompany_faculty)) {
        for (const f of row.accompany_faculty) {
          allRowFaculty.push(f);
        }
      }

      const validatedFaculty = allRowFaculty.map(f => {
        totalFacultyMappings++;
        const rawEmail = f.email ? String(f.email).trim().toLowerCase() : '';
        const hasValidEmail = Boolean(rawEmail && rawEmail.includes('@') && rawEmail.includes('.'));
        let matchedUser = null;
        if (hasValidEmail) {
          matchedUser = candidateUsers.find(u => u.email && u.email.toLowerCase().trim() === rawEmail);
          if (!matchedUser) {
            matchedUser = matchFacultyUser(f.name, rawEmail, candidateUsers);
          }
        } else {
          matchedUser = matchFacultyUser(f.name, null, candidateUsers);
        }

        if (matchedUser) {
          return {
            ...f,
            is_matched: true,
            will_create: false,
            matched_user_id: matchedUser.id,
            matched_email: matchedUser.email,
            status: 'Matched User'
          };
        }

        // Unmatched faculty with a valid email in Excel (Allowed! Preserved without requiring existing user account)
        if (hasValidEmail) {
          return {
            ...f,
            is_matched: false,
            will_create: true,
            matched_user_id: null,
            matched_email: rawEmail,
            status: 'New Account (Will be created on import)'
          };
        }

        // For Class Teacher: Email is NOT mandatory.
        // If no email is available and no user account matched, allow the class teacher name
        // to be parsed and displayed in the preview without treating as a validation error.
        if (f.role === 'Class Teacher') {
          return {
            ...f,
            is_matched: false,
            will_create: false,
            matched_user_id: null,
            matched_email: null,
            status: 'Panel Class Teacher (No Email)'
          };
        }

        // Email is genuinely missing and no matching user account exists (Accompany Faculty)
        unmatchedFacultySet.add(f.name);
        const panelDisplayName = row.panel || (matchedPanel ? matchedPanel.name : 'Unknown Panel');
        const missingErrMsg = `Row ${row.row_index} (Panel "${panelDisplayName}"): Faculty "${f.name}" (${f.role}) is missing a valid email address and does not match an existing user account. A non-null email is required.`;
        errors.push(missingErrMsg);
        missingFacultyEmails.push({
          row_index: row.row_index,
          panel: panelDisplayName,
          name: f.name,
          role: f.role,
          error: missingErrMsg
        });

        return {
          ...f,
          is_matched: false,
          will_create: false,
          matched_user_id: null,
          matched_email: null,
          status: 'Missing Email (Required)',
          error: missingErrMsg
        };
      });

      if (validatedFaculty.length === 0) {
        warnings.push('No faculty members found in this row.');
      }

      return {
        ...row,
        resolved_panel_id: matchedPanel ? matchedPanel.id : null,
        resolved_panel_name: matchedPanel ? matchedPanel.name : row.panel,
        resolved_village_id: matchedVillage ? matchedVillage.id : null,
        accompany_faculty: validatedFaculty,
        warnings,
        errors,
        is_valid: errors.length === 0
      };
    });

    // Build unmatched_faculty list as objects {name, role, panel_name, has_email, email} for the UI
    const unmatchedFacultyObjects = [];
    const seenUnmatchedKeys = new Set();
    const uniqueUnmatchedFaculty = [];
    validatedRows.forEach(row => {
      row.accompany_faculty.forEach(f => {
        if (!f.is_matched) {
          const item = {
            name: f.name,
            role: f.role,
            panel_name: row.panel || row.resolved_panel_name || '',
            has_email: Boolean(f.email || f.matched_email),
            email: f.email || f.matched_email || null,
            will_create: f.will_create || false,
            status: f.status
          };
          unmatchedFacultyObjects.push(item);
          const uKey = `${normalizeFacultyName(f.name)}|${row.panel || row.resolved_panel_name || ''}`;
          if (!seenUnmatchedKeys.has(uKey)) {
            seenUnmatchedKeys.add(uKey);
            uniqueUnmatchedFaculty.push(item);
          }
        }
      });
    });

    // Build preview.panels (panel-centric) for the preview table in the UI
    const previewPanels = validatedRows.map(row => ({
      panel_name: row.resolved_panel_name || row.panel,
      department: row.department,
      school: row.school,
      nodal_officer_name: row.nodal_officer_name || '',
      nodal_officer_email: row.nodal_officer_email || '',
      coordinator_name: row.coordinator_name || '',
      class_teacher_name: row.class_teacher_name || '',
      village_name: row.village_name,
      address: row.address,
      detailed_address: row.detailed_address,
      school_name: row.school_name,
      principal_mobile: row.principal_mobile,
      spoc_name: row.spoc_name,
      spoc_mobile: row.spoc_mobile,
      sarpanch_name: row.sarpanch_name,
      sarpanch_mobile: row.sarpanch_mobile,
      district: row.district,
      panchayat: row.panchayat,
      taluka: row.taluka,
      google_maps_link: row.google_maps_link,
      student_count: row.student_count,
      boys_count: row.boys_count,
      girls_count: row.girls_count,
      faculty: row.accompany_faculty.map(f => ({
        name: f.name,
        email: f.email || null,
        role: f.role,
        matched: f.is_matched,
        will_create: f.will_create || false,
        matched_email: f.matched_email || null
      }))
    }));

    const matchedFacultyCount = totalFacultyMappings - unmatchedFacultyObjects.length;
    const hasMissingEmails = missingFacultyEmails.length > 0;

    // Strict validation rejection if panels missing, village conflicts, or missing faculty emails
    if (missingPanels.size > 0 || villageConflicts.length > 0 || hasMissingEmails) {
      const errorList = [];
      if (missingPanels.size > 0) {
        const missingList = Array.from(missingPanels).join(', ');
        errorList.push(`Panels not found in ${batch.name}: ${missingList}`);
      }
      if (villageConflicts.length > 0) {
        const conflictMsg = villageConflicts.map(c => `Panel "${c.panel}" already allocated to "${c.current_village}" (Excel has "${c.new_village}")`).join('; ');
        errorList.push(`Village conflict: ${conflictMsg}`);
      }
      if (hasMissingEmails) {
        errorList.push(`Missing Faculty Email: ${missingFacultyEmails.length} faculty assignment(s) are missing a non-null email address: ${missingFacultyEmails.map(m => `Row ${m.row_index} [${m.panel}]: ${m.name} (${m.role})`).join('; ')}`);
      }

      return res.status(400).json({
        success: false,
        message: errorList.join(' | '),
        missing_panels: Array.from(missingPanels),
        conflicts: villageConflicts,
        missing_faculty_emails: missingFacultyEmails,
        preview: {
          total_panels: uniquePanels.size,
          total_villages: uniqueVillages.size,
          total_faculty_mappings: totalFacultyMappings,
          matched_faculty_count: matchedFacultyCount,
          unmatched_faculty_count: unmatchedFacultyObjects.length,
          unmatched_faculty: unmatchedFacultyObjects,
          unique_unmatched_faculty: uniqueUnmatchedFaculty,
          missing_faculty_emails: missingFacultyEmails,
          panels: previewPanels,
          has_errors: true,
          errors: errorList
        },
        rows: validatedRows
      });
    }

    res.json({
      success: true,
      message: 'Excel parsed and validated successfully',
      batch: {
        id: batch.id,
        name: batch.name,
        batch_code: batch.batch_code
      },
      summary: {
        total_rows: parsedRows.length,
        panels_count: uniquePanels.size,
        villages_count: uniqueVillages.size,
        faculty_mappings_count: totalFacultyMappings,
        unmatched_faculty_count: unmatchedFacultyObjects.length,
        unmatched_faculty: unmatchedFacultyObjects,
        unique_unmatched_faculty: uniqueUnmatchedFaculty,
        missing_faculty_emails: []
      },
      preview: {
        total_panels: uniquePanels.size,
        total_villages: uniqueVillages.size,
        total_faculty_mappings: totalFacultyMappings,
        matched_faculty_count: matchedFacultyCount,
        unmatched_faculty_count: unmatchedFacultyObjects.length,
        unmatched_faculty: unmatchedFacultyObjects,
        unique_unmatched_faculty: uniqueUnmatchedFaculty,
        missing_faculty_emails: [],
        panels: previewPanels,
        has_errors: false,
        errors: []
      },
      rows: validatedRows
    });
  } catch (err) {
    console.error('Error validating village & faculty upload:', err);
    res.status(500).json({ success: false, message: 'Validation failed', error: err.message });
  }
};

const importVillageFacultyUpload = async (req, res) => {
  const { id } = req.params;

  let inputRows = [];
  if (req.file && req.file.buffer) {
    try {
      inputRows = parseVillageFacultySpreadsheet(req.file.buffer);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: parseErr.message });
    }
  } else if (req.body?.rows) {
    if (typeof req.body.rows === 'string') {
      try {
        inputRows = JSON.parse(req.body.rows);
      } catch (e) {
        inputRows = [];
      }
    } else if (Array.isArray(req.body.rows)) {
      inputRows = req.body.rows;
    }
  }

  if (!inputRows || inputRows.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid village or faculty data provided for import.' });
  }

  const client = await pool.connect();
  try {
    const batchRes = await client.query(
      `SELECT id, name, batch_code FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'RI Batch cohort not found' });
    }
    const batch = batchRes.rows[0];
    const riBatchId = batch.id;

    // Existing batch panels
    const panelsRes = await client.query(
      `SELECT id, panel_number, name, ri_village_id FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`,
      [riBatchId]
    );
    const batchPanels = panelsRes.rows;

    // Existing batch villages
    const villagesRes = await client.query(
      `SELECT id, name, district, taluka FROM ri_villages WHERE ri_batch_id = $1 AND status <> 'deleted'`,
      [riBatchId]
    );
    const existingVillages = villagesRes.rows;

    // ── Pre-Validation Pass: Strict Panel Existence & Village Conflict Checks ──
    const missingPanels = new Set();
    const villageConflicts = [];

    for (const row of inputRows) {
      const panelName = String(row.panel || '').trim();
      const villageName = String(row.village_name || '').trim();
      if (!panelName && !villageName) continue;

      if (panelName) {
        const matched = matchPanel(panelName, batchPanels);
        if (!matched) {
          missingPanels.add(panelName);
        } else if (matched.ri_village_id && villageName) {
          const currentVillage = existingVillages.find(v => v.id === matched.ri_village_id);
          if (currentVillage && currentVillage.name.toLowerCase().trim() !== villageName.toLowerCase().trim()) {
            villageConflicts.push({
              panel: matched.name,
              current_village: currentVillage.name,
              new_village: villageName
            });
          }
        }
      }
    }

    if (missingPanels.size > 0) {
      return res.status(400).json({
        success: false,
        message: `Panels not found in ${batch.name}: ${Array.from(missingPanels).join(', ')}`
      });
    }

    if (villageConflicts.length > 0) {
      const conflictMsg = villageConflicts.map(c => `Panel "${c.panel}" already allocated to "${c.current_village}" (Excel has "${c.new_village}")`).join('; ');
      return res.status(400).json({
        success: false,
        message: `Village conflict: ${conflictMsg}`,
        conflicts: villageConflicts
      });
    }

    // Existing users for matching
    const usersRes = await client.query(`SELECT id, name, first_name, middle_name, last_name, email, department, designation, role FROM users`);
    const candidateUsers = usersRes.rows;

    // Check for missing faculty emails across all inputRows before beginning transaction
    const missingFacultyEmails = [];
    for (const row of inputRows) {
      const panelName = String(row.panel || '').trim();
      const villageName = String(row.village_name || '').trim();
      if (!panelName && !villageName) continue;

      const facultyList = [];
      const ctName = String(row.class_teacher_name || '').trim();
      let ctEmail = String(row.class_teacher_email || '').trim().toLowerCase();
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—' && Array.isArray(row.accompany_faculty)) {
        const sameFaculty = row.accompany_faculty.find(af => {
          if (!af.email || !af.email.includes('@')) return false;
          return normalizeFacultyName(af.name) === normalizeFacultyName(ctName);
        });
        if (sameFaculty) {
          ctEmail = sameFaculty.email;
        }
      }
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—') {
        const matchedCt = matchFacultyUser(ctName, null, candidateUsers);
        if (matchedCt && matchedCt.email) {
          ctEmail = matchedCt.email.toLowerCase().trim();
        }
      }
      if (ctName && ctName !== '-' && ctName !== '—') {
        facultyList.push({ role: 'Class Teacher', name: ctName, email: ctEmail });
      }
      if (Array.isArray(row.accompany_faculty)) {
        for (const f of row.accompany_faculty) {
          facultyList.push(f);
        }
      }

      for (const f of facultyList) {
        const facName = String(f.name || '').trim();
        if (!facName || facName === '-' || facName === '—' || facName === 'N/A' || facName === 'NA') continue;

        const rawEmail = f.email ? String(f.email).trim().toLowerCase() : '';
        const hasValidEmail = Boolean(rawEmail && rawEmail.includes('@') && rawEmail.includes('.'));
        if (hasValidEmail) continue;

        const matched = candidateUsers.find(u => u.email && u.email.toLowerCase().trim() === rawEmail) ||
                        matchFacultyUser(facName, null, candidateUsers);
        if (!matched) {
          // Class Teacher email is optional and not required to prevent import because Class Teacher
          // name is saved to ri_panels.class_teacher_name and does not require ri_batch_faculty entry.
          if (f.role === 'Class Teacher') {
            continue;
          }
          missingFacultyEmails.push({
            row_index: row.row_index,
            panel: panelName,
            name: facName,
            role: f.role
          });
        }
      }
    }

    if (missingFacultyEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Import blocked: ${missingFacultyEmails.length} faculty assignment(s) are missing a non-null email address: ${missingFacultyEmails.map(m => `${m.name} (${m.role} on ${m.panel || 'Panel'})`).join(', ')}. A valid non-null email is required by database constraints.`,
        missing_faculty_emails: missingFacultyEmails
      });
    }

    // ── Atomic Database Import Transaction ──
    await client.query('BEGIN');

    const villageMap = new Map();
    existingVillages.forEach(v => {
      villageMap.set(v.name.toLowerCase().trim(), v.id);
    });

    let panelsUpserted = 0;
    let villagesUpserted = 0;
    let facultyAssigned = 0;
    let accountsCreated = 0;
    let accountsExisted = 0;
    const unmatchedFacultySet = new Set();

    for (const row of inputRows) {
      const panelName = String(row.panel || '').trim();
      const villageName = String(row.village_name || '').trim();
      if (!panelName && !villageName) continue;

      // 1. Safe batch-scoped upsert Village (No duplicates across re-uploads)
      let targetVillageId = null;
      if (villageName) {
        const lowerVillage = villageName.toLowerCase().trim();
        if (villageMap.has(lowerVillage)) {
          targetVillageId = villageMap.get(lowerVillage);
          await client.query(`
            UPDATE ri_villages SET
              address = COALESCE(NULLIF($1, ''), address),
              detailed_address = COALESCE(NULLIF($2, ''), detailed_address),
              location = COALESCE(NULLIF($2, ''), location),
              school_name = COALESCE(NULLIF($3, ''), school_name),
              principal_mobile = COALESCE(NULLIF($4, ''), principal_mobile),
              spoc_name = COALESCE(NULLIF($5, ''), spoc_name),
              spoc_mobile = COALESCE(NULLIF($6, ''), spoc_mobile),
              sarpanch_name = COALESCE(NULLIF($7, ''), sarpanch_name),
              sarpanch_mobile = COALESCE(NULLIF($8, ''), sarpanch_mobile),
              district = COALESCE(NULLIF($9, ''), district),
              panchayat = COALESCE(NULLIF($10, ''), panchayat),
              taluka = COALESCE(NULLIF($11, ''), taluka),
              google_maps_link = COALESCE(NULLIF($12, ''), google_maps_link),
              remark = COALESCE(NULLIF($13, ''), remark),
              updated_at = NOW()
            WHERE id = $14 AND ri_batch_id = $15
          `, [
            row.address || '',
            row.detailed_address || '',
            row.school_name || '',
            row.principal_mobile || '',
            row.spoc_name || '',
            row.spoc_mobile || '',
            row.sarpanch_name || '',
            row.sarpanch_mobile || '',
            row.district || '',
            row.panchayat || '',
            row.taluka || '',
            row.google_maps_link || '',
            row.remark || '',
            targetVillageId,
            riBatchId
          ]);
          villagesUpserted++;
        } else {
          const insertV = await client.query(`
            INSERT INTO ri_villages (
              ri_batch_id, name, address, detailed_address, location,
              school_name, principal_mobile, spoc_name, spoc_mobile,
              sarpanch_name, sarpanch_mobile, district, panchayat, taluka,
              google_maps_link, remark, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', NOW(), NOW())
            RETURNING id
          `, [
            riBatchId,
            villageName,
            row.address || '',
            row.detailed_address || '',
            row.school_name || '',
            row.principal_mobile || '',
            row.spoc_name || '',
            row.spoc_mobile || '',
            row.sarpanch_name || '',
            row.sarpanch_mobile || '',
            row.district || '',
            row.panchayat || '',
            row.taluka || '',
            row.google_maps_link || '',
            row.remark || ''
          ]);
          targetVillageId = insertV.rows[0].id;
          villageMap.set(lowerVillage, targetVillageId);
          villagesUpserted++;
        }
      }

      // 2. Safe Nodal Officer User Lookup / Creation (No duplicates)
      let nodalUserId = null;
      const nodalName = String(row.nodal_officer_name || '').trim();
      const nodalEmail = String(row.nodal_officer_email || '').trim().toLowerCase();

      if (nodalEmail && nodalEmail.includes('@')) {
        let matchedNodal = candidateUsers.find(u => u.email && u.email.toLowerCase().trim() === nodalEmail);
        if (!matchedNodal) {
          const existingNodalUser = await client.query(
            `SELECT id, role, name, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [nodalEmail]
          );
          if (existingNodalUser.rowCount > 0) {
            matchedNodal = existingNodalUser.rows[0];
            candidateUsers.push(matchedNodal);
          }
        }

        if (matchedNodal) {
          nodalUserId = matchedNodal.id;
          accountsExisted++;
        } else {
          const defaultPasswordHash = await bcrypt.hash('nodal@123', 10);
          const cleanNodalName = nodalName || 'Nodal Officer';
          const newNodalUser = await client.query(`
            INSERT INTO users (name, email, password, role, department, school, status, password_changed, created_at)
            VALUES ($1, $2, $3, 'ri_nodal_officer', $4, $5, 'active', false, NOW())
            ON CONFLICT (email) DO UPDATE SET role = users.role
            RETURNING id, name, email, role
          `, [
            cleanNodalName,
            nodalEmail,
            defaultPasswordHash,
            row.department || 'Academic Department',
            row.school || 'MIT-WPU'
          ]);
          const newNodal = newNodalUser.rows[0];
          nodalUserId = newNodal.id;
          candidateUsers.push(newNodal);
          accountsCreated++;
        }
      }

      // 3. Update Existing Panel in ri_panels (Never create new panels)
      const matched = matchPanel(panelName, batchPanels);
      if (!matched) continue;
      const targetPanelId = matched.id;

      await client.query(`
        UPDATE ri_panels SET
          ri_village_id = COALESCE($1, ri_village_id),
          school = COALESCE(NULLIF($2, ''), school),
          department = COALESCE(NULLIF($3, ''), department),
          student_count = COALESCE($4, student_count),
          boys_count = COALESCE($5, boys_count),
          girls_count = COALESCE($6, girls_count),
          google_maps_link = COALESCE(NULLIF($7, ''), google_maps_link),
          coordinator_name = COALESCE(NULLIF($8, ''), coordinator_name),
          class_teacher_name = COALESCE(NULLIF($9, ''), class_teacher_name),
          nodal_officer_name = NULLIF($10, ''),
          nodal_officer_email = NULLIF($11, ''),
          nodal_officer_user_id = COALESCE($12, nodal_officer_user_id)
        WHERE id = $13 AND ri_batch_id = $14
      `, [
        targetVillageId,
        row.school || '',
        row.department || '',
        row.student_count || null,
        row.boys_count || null,
        row.girls_count || null,
        row.google_maps_link || '',
        nodalName,
        row.class_teacher_name || '',
        nodalName,
        nodalEmail,
        nodalUserId,
        targetPanelId,
        riBatchId
      ]);
      panelsUpserted++;

      // 4. Map Panel Faculty (Class Teacher + Accompany Faculty) directly to targetPanelId without duplicates
      const facultyList = [];
      const ctName = String(row.class_teacher_name || '').trim();
      let ctEmail = String(row.class_teacher_email || '').trim().toLowerCase();

      // If Class Teacher email wasn't explicitly provided, check if the same person is listed in accompanyFaculty with an email
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—' && Array.isArray(row.accompany_faculty)) {
        const sameFaculty = row.accompany_faculty.find(af => {
          if (!af.email || !af.email.includes('@')) return false;
          return normalizeFacultyName(af.name) === normalizeFacultyName(ctName);
        });
        if (sameFaculty) {
          ctEmail = sameFaculty.email;
        }
      }
      if (!ctEmail && ctName && ctName !== '-' && ctName !== '—') {
        const matchedCt = matchFacultyUser(ctName, null, candidateUsers);
        if (matchedCt && matchedCt.email) {
          ctEmail = matchedCt.email.toLowerCase().trim();
        }
      }

      if (ctName && ctName !== '-' && ctName !== '—') {
        facultyList.push({
          role: 'Class Teacher',
          name: ctName,
          email: ctEmail
        });
      }
      if (Array.isArray(row.accompany_faculty)) {
        for (const f of row.accompany_faculty) {
          facultyList.push(f);
        }
      }

      for (const f of facultyList) {
        const facName = String(f.name || '').trim();
        if (!facName || facName === '-' || facName === '—' || facName === 'N/A' || facName === 'NA') continue;

        const rawEmail = f.email ? String(f.email).trim().toLowerCase() : '';
        const facultyEmail = (rawEmail && rawEmail.includes('@') && rawEmail.includes('.')) ? rawEmail : null;

        let matchedUser = null;
        let facultyUserId = null;

        // Tier 1: Exact email match in candidateUsers or DB
        if (facultyEmail) {
          matchedUser = candidateUsers.find(u => u.email && u.email.toLowerCase().trim() === facultyEmail);
          if (!matchedUser) {
            const existingUserRes = await client.query(
              `SELECT id, name, email, role, department FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
              [facultyEmail]
            );
            if (existingUserRes.rowCount > 0) {
              matchedUser = existingUserRes.rows[0];
              candidateUsers.push(matchedUser);
            }
          }
        } else {
          // Tier 2: Match by name against candidateUsers only if no explicit email was provided
          matchedUser = matchFacultyUser(facName, null, candidateUsers);
        }

        if (matchedUser) {
          facultyUserId = matchedUser.id;
          accountsExisted++;
        } else if (facultyEmail) {
          // Auto-provision usable login account for faculty member using role 'ri_faculty' and default password 'faculty123'
          try {
            const defaultPasswordHash = await bcrypt.hash('faculty123', 10);
            const cleanFacultyName = facName || 'Faculty Member';
            const newUserRes = await client.query(`
              INSERT INTO users (name, email, password, role, department, designation, status, password_changed, created_at)
              VALUES ($1, $2, $3, 'ri_faculty', $4, $5, 'active', false, NOW())
              ON CONFLICT (email) DO UPDATE SET role = users.role
              RETURNING id, name, email, role, department
            `, [
              cleanFacultyName,
              facultyEmail,
              defaultPasswordHash,
              row.department || 'Academic Department',
              f.designation || null
            ]);
            matchedUser = newUserRes.rows[0];
            facultyUserId = matchedUser.id;
            candidateUsers.push(matchedUser);
            accountsCreated++;
          } catch (provErr) {
            console.warn('[importVillageFacultyUpload] Could not auto-provision user account, preserving allocation with faculty_id=null:', provErr.message);
            facultyUserId = null;
          }
        } else {
          unmatchedFacultySet.add(facName);
        }

        const finalEmail = (matchedUser && matchedUser.email) ? matchedUser.email.toLowerCase().trim() : facultyEmail;

        if (!finalEmail) {
          if (f.role === 'Class Teacher') {
            // Class Teacher does not have an email and no matching user account was found.
            // Their name is already recorded on ri_panels.class_teacher_name.
            // Do not insert NULL or invent a placeholder email into ri_batch_faculty.
            continue;
          }
          throw new Error(`Email is missing for faculty "${facName}" (${f.role}) on panel "${panelName}". Database constraint requires a non-null email.`);
        }

        // Match existing faculty row in (ri_batch_id, ri_panel_id) by faculty_id, email, or normalized name
        const existingFacultyRes = await client.query(`
          SELECT id, faculty_id FROM ri_batch_faculty
          WHERE ri_batch_id = $1 AND ri_panel_id = $2 
            AND (
              (faculty_id IS NOT NULL AND $3::int IS NOT NULL AND faculty_id = $3::int) OR
              (email IS NOT NULL AND $4::text IS NOT NULL AND LOWER(email) = LOWER($4::text)) OR
              LOWER(TRIM(name)) = LOWER(TRIM($5))
            )
          LIMIT 1
        `, [riBatchId, targetPanelId, facultyUserId, finalEmail, facName]);

        if (existingFacultyRes.rowCount > 0) {
          const facId = existingFacultyRes.rows[0].id;
          await client.query(`
            UPDATE ri_batch_faculty SET
              role = $1,
              department = COALESCE(NULLIF($2, ''), department),
              faculty_id = COALESCE($3, faculty_id),
              email = COALESCE(NULLIF($4, ''), email),
              name = $5,
              status = 'active',
              updated_at = NOW()
            WHERE id = $6 AND ri_batch_id = $7
          `, [
            f.role || 'Accompanying Faculty',
            row.department || '',
            facultyUserId,
            finalEmail,
            facName,
            facId,
            riBatchId
          ]);
          facultyAssigned++;
        } else {
          await client.query(`
            INSERT INTO ri_batch_faculty (
              ri_batch_id, ri_panel_id, faculty_id, name, email,
              role, department, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
          `, [
            riBatchId,
            targetPanelId,
            facultyUserId,
            facName,
            finalEmail,
            f.role || 'Accompanying Faculty',
            row.department || ''
          ]);
          facultyAssigned++;
        }
      }
    }

    await client.query('COMMIT');

    writeAuditLog(req.user?.id || 1, 'IMPORT_VILLAGE_FACULTY', `Imported village and faculty data for batch ${batch.name}`, {
      batch_id: riBatchId,
      panels_upserted: panelsUpserted,
      villages_upserted: villagesUpserted,
      faculty_assigned: facultyAssigned,
      accounts_created: accountsCreated,
      accounts_existed: accountsExisted
    });

    res.json({
      success: true,
      message: `Successfully imported Village & Faculty data: ${panelsUpserted} panels updated, ${villagesUpserted} villages mapped, ${facultyAssigned} faculty members assigned to their panels (${accountsCreated} new user accounts created, ${accountsExisted} accounts reused).`,
      summary: {
        panels_upserted: panelsUpserted,
        villages_upserted: villagesUpserted,
        faculty_assigned: facultyAssigned,
        accounts_created: accountsCreated,
        accounts_existed: accountsExisted,
        unmatched_faculty: Array.from(unmatchedFacultySet)
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error importing village & faculty data:', err);
    res.status(500).json({ success: false, message: 'Failed to import Village & Faculty data: ' + err.message, error: err.message });
  } finally {
    client.release();
  }
};

// ─── 10C. Download Excel Template for Village & Faculty Bulk Upload ─────────
const downloadVillageFacultyTemplate = async (req, res) => {
  const { id } = req.params;

  try {
    const batchRes = await pool.query(
      `SELECT id, name, batch_code FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;
    const batchName = batchRes.rows[0].name;

    // Fetch existing panels in this batch
    const panelsRes = await pool.query(`
      SELECT 
        rp.panel_number,
        rp.name,
        rp.school,
        rp.department,
        rp.nodal_officer_name,
        rp.nodal_officer_email,
        rp.class_teacher_name,
        v.name AS village_name,
        v.district,
        v.taluka,
        v.location,
        v.detailed_address,
        v.school_name,
        v.principal_mobile,
        v.spoc_name,
        v.spoc_mobile,
        v.sarpanch_name,
        v.sarpanch_mobile,
        v.google_maps_link,
        COALESCE(NULLIF(rp.student_count, 0), (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id), 50) AS student_count,
        COALESCE(rp.boys_count, 25) AS boys_count,
        COALESCE(rp.girls_count, 25) AS girls_count
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [riBatchId]);
    const panels = panelsRes.rows;

    const wb = XLSX.utils.book_new();

    // Exact headers matching batch 9 -village.xlsx with explicit email columns (30 columns)
    const headers = [
      'Sr.',
      'School',
      'Department',
      'Panel',
      'Department Coordinators / Nodal Officer Name',
      'Department Coordinators / Nodal Officer Email',
      'Class Teachers (Advance taken Faculty Name)',
      'Class Teacher Email',
      'Accompany Faculty 1',
      'Accompany Faculty 1 Email',
      'Accompany Faculty 2',
      'Accompany Faculty 2 Email',
      'Accompany Faculty 3',
      'Accompany Faculty 3 Email',
      'Panel Wise Student Count',
      'Boys Count',
      'Girls Count',
      'Village Name',
      'Address',
      'Location/Detailed Address ',
      'Village School Name ',
      'Head Master / Principal of School Mobile Number',
      'SPOC Name',
      'SPOC Mobile Number ',
      'Srapanch name ',
      'Srapanch Mobile Number',
      'District ',
      'Panchayat/Taluka',
      'Google map link',
      'Remark '
    ];

    let dataRows = [];
    if (panels.length > 0) {
      dataRows = panels.map((p, idx) => [
        idx + 1,
        p.school || 'School of Design',
        p.department || 'Department of Design',
        cleanPanelName(p.name),
        p.nodal_officer_name || 'Radhika Dixit',
        p.nodal_officer_email || 'radhika.dixit@mitwpu.edu.in',
        p.class_teacher_name || 'Dr. Shanu Gupta',
        'shanu.gupta@mitwpu.edu.in',
        'SUMEET PRASAD',
        'sumeet.prasad@mitwpu.edu.in',
        'ANUPAM TIWARI',
        'anupam.tiwari@mitwpu.edu.in',
        '',
        '',
        p.student_count || 50,
        p.boys_count || 25,
        p.girls_count || 25,
        p.village_name || 'Lenyadri',
        '',
        p.detailed_address || p.location || 'Tal. Junnar Dist. Pune',
        p.school_name || 'Z.P. Primary School',
        p.principal_mobile || '9876543210',
        p.spoc_name || 'Dr. Ranjit Gadhave',
        p.spoc_mobile || '9763444689',
        p.sarpanch_name || 'Shri. Patil',
        p.sarpanch_mobile || '9876543211',
        p.district || 'Pune',
        p.taluka || 'Junnar',
        p.google_maps_link || 'https://maps.google.com/?q=Lenyadri+Pune',
        ''
      ]);
    } else {
      dataRows.push([
        1,
        'School of Design',
        'Department of Design',
        'PRODUCT DESIGN PD-A',
        'Radhika Dixit',
        'radhika.dixit@mitwpu.edu.in',
        'Dr. Shanu Gupta',
        'shanu.gupta@mitwpu.edu.in',
        'SUMEET PRASAD',
        'sumeet.prasad@mitwpu.edu.in',
        'ANUPAM TIWARI',
        'anupam.tiwari@mitwpu.edu.in',
        '',
        '',
        52,
        26,
        26,
        'Lenyadri',
        '',
        'Tal. Junnar Dist. Pune',
        'Z.P. Primary School',
        '9876543210',
        'Dr. Ranjit Gadhave',
        '9763444689',
        'Shri. Patil',
        '9876543211',
        'Pune',
        'Junnar',
        'https://maps.google.com/?q=Lenyadri+Pune',
        ''
      ]);
    }

    const wsData = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 25 },
      { wch: 24 },
      { wch: 34 },
      { wch: 38 },
      { wch: 34 },
      { wch: 25 },
      { wch: 32 },
      { wch: 25 },
      { wch: 32 },
      { wch: 25 },
      { wch: 24 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 18 },
      { wch: 35 },
      { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Panel Data');

    const notesData = [
      ['RURAL IMMERSION — VILLAGE & FACULTY EXCEL UPLOAD INSTRUCTIONS'],
      [''],
      ['1. Required Columns: "Panel" and "Village Name" must be present for every row.'],
      ['2. Panel Names: Must match existing panels created in the batch (e.g. ECE-A, PRODUCT DESIGN PD-A, etc.).'],
      ['3. Faculty Email Columns: "Department Coordinators / Nodal Officer Email", "Accompany Faculty 1 Email", and "Accompany Faculty 2 Email" are directly saved and linked to faculty accounts.'],
      ['4. Faculty Name Matching: Faculty names automatically match user accounts with or without titles (Dr., Prof., Mr., Mrs., etc.).'],
      ['5. Village Allocations: Automatically creates or updates village records and links them to the panel.'],
      ['6. Supported File Formats: .xlsx, .xls']
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
    XLSX.utils.book_append_sheet(wb, wsNotes, 'Notes');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanBatchName = (batchName || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `RI_Village_Faculty_Template_${cleanBatchName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Error generating village faculty template:', err);
    res.status(500).json({ message: 'Failed to generate Excel template: ' + err.message });
  }
};

// ─── 11. Download Excel Template for Faculty/Mentors ────────────────────────
const downloadFacultyTemplate = async (req, res) => {
  const { id } = req.params;
  const { mode = 'batch_wise', ri_panel_id } = req.query;

  try {
    const batchRes = await pool.query(
      `SELECT id, name FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;
    const batchName = batchRes.rows[0].name;

    const panelsRes = await pool.query(`
      SELECT 
        rp.panel_number,
        rp.name,
        v.name AS village_name,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id) AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [riBatchId]);
    const panels = panelsRes.rows;

    const wb = XLSX.utils.book_new();

    if (mode === 'batch_wise') {
      // Main template sheet
      const sampleRows = panels.slice(0, 3).map((p, i) => ({
        'Name': i === 0 ? 'Dr. Ramesh Sharma' : i === 1 ? 'Prof. Sunita Patil' : 'Dr. Anil Deshmukh',
        'Email': i === 0 ? 'ramesh.sharma@college.edu' : i === 1 ? 'sunita.patil@college.edu' : 'anil.deshmukh@college.edu',
        'Panel': cleanPanelName(p.name),
        'Mobile Number': `+91 987654321${i}`,
        'Department': 'Engineering & Technology',
        'Designation': i === 0 ? 'Associate Professor' : 'Assistant Professor',
        'Employee ID': `FAC${101 + i}`,
        'Role': i === 0 ? 'Lead Mentor' : 'Mentor'
      }));

      if (sampleRows.length === 0) {
        sampleRows.push({
          'Name': 'Dr. Sample Faculty',
          'Email': 'faculty@college.edu',
          'Panel': 'SY R&A Div 1',
          'Mobile Number': '+91 9876543210',
          'Department': 'School of Technology',
          'Designation': 'Assistant Professor',
          'Employee ID': 'FAC101',
          'Role': 'Mentor'
        });
      }

      const wsUpload = XLSX.utils.json_to_sheet(sampleRows);
      XLSX.utils.book_append_sheet(wb, wsUpload, 'Faculty Mentors Upload');

      // Reference Sheet with actual panels in this batch
      const referenceRows = panels.map(p => ({
        'Panel Name': cleanPanelName(p.name),
        'Assigned Village': p.village_name || 'Not Assigned',
        'Student Count': p.student_count || 0
      }));

      const wsRef = XLSX.utils.json_to_sheet(referenceRows);
      XLSX.utils.book_append_sheet(wb, wsRef, 'Available Panels Reference');
    } else {
      // panel_wise
      const targetP = panels.find(p => p.id === Number(ri_panel_id)) || panels[0];
      const sampleRows = [
        {
          'Name': 'Dr. Ramesh Sharma',
          'Email': 'ramesh.sharma@college.edu',
          'Mobile Number': '+91 9876543210',
          'Department': targetP ? cleanPanelName(targetP.name) : 'Engineering',
          'Designation': 'Associate Professor',
          'Employee ID': 'FAC101',
          'Role': 'Lead Mentor'
        },
        {
          'Name': 'Prof. Sunita Patil',
          'Email': 'sunita.patil@college.edu',
          'Mobile Number': '+91 9876543211',
          'Department': targetP ? cleanPanelName(targetP.name) : 'Engineering',
          'Designation': 'Assistant Professor',
          'Employee ID': 'FAC102',
          'Role': 'Mentor'
        }
      ];

      const wsUpload = XLSX.utils.json_to_sheet(sampleRows);
      XLSX.utils.book_append_sheet(wb, wsUpload, 'Panel Mentors Upload');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanBatchName = (batchName || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `RI_Faculty_Template_${mode}_${cleanBatchName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating faculty template:', err);
    res.status(500).json({ message: 'Failed to generate template', error: err.message });
  }
};

// ─── 12. Validate Student Bulk Upload ─────────────────────────────────────────
const validateStudentUpload = async (req, res) => {
  const { id } = req.params;
  const mode = req.body?.mode || 'batch_wise';
  const ri_panel_id = req.body?.ri_panel_id;

  let rawRows = [];
  if (req.file && req.file.buffer) {
    try {
      rawRows = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }
  } else if (req.body?.rows || req.body?.students) {
    const rawInput = req.body.rows !== undefined ? req.body.rows : req.body.students;
    if (typeof rawInput === 'string') {
      try {
        rawRows = JSON.parse(rawInput);
      } catch (e) {
        rawRows = [];
      }
    } else if (Array.isArray(rawInput)) {
      rawRows = rawInput;
    }
  }

  if (!rawRows || rawRows.length === 0) {
    return res.status(400).json({ message: 'No rows found in the uploaded file or spreadsheet is empty.' });
  }

  try {
    const batchRes = await pool.query(
      `SELECT id, name, status, source_program, source_batch_id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found.' });
    }
    const targetBatch = batchRes.rows[0];
    const riBatchId = targetBatch.id;
    const isRiDirect = !targetBatch.source_batch_id || targetBatch.source_program === 'RI_DIRECT';

    // Fetch batch panels
    const panelsRes = await pool.query(`
      SELECT rp.id, rp.panel_number, rp.name, rp.capacity, v.name AS village_name
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [riBatchId]);
    const batchPanels = panelsRes.rows;

    // Fetch existing student identities and LTC enrollment markers
    const existingUsersRes = await pool.query(`
      SELECT 
        u.id, 
        TRIM(u.prn) AS prn, 
        LOWER(TRIM(u.email)) AS email, 
        u.name,
        (
          EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = u.id)
          OR EXISTS (
            SELECT 1 FROM ri_batch_students rbs 
            WHERE rbs.student_id = u.id 
              AND (rbs.source_program IN ('LTC', 'LTC_SYNC') OR rbs.enrollment_type = 'LTC_SYNC')
          )
        ) AS is_ltc_student,
        COALESCE(
          (SELECT json_agg(json_build_object('ri_batch_id', rbs.ri_batch_id, 'ri_id', rbs.ri_id)) FROM ri_batch_students rbs WHERE rbs.student_id = u.id),
          '[]'::json
        ) AS ri_enrollments
      FROM users u
      WHERE u.role = 'student' OR u.role IS NULL
    `);

    const userByPrn = new Map();
    const userByEmail = new Map();
    for (const u of existingUsersRes.rows) {
      if (u.prn) userByPrn.set(String(u.prn).trim().toLowerCase(), u);
      if (u.email) userByEmail.set(String(u.email).trim().toLowerCase(), u);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const seenPrnsInFile = new Map();
    const seenEmailsInFile = new Map();

    const validatedRows = [];
    let validCount = 0;
    let invalidCount = 0;
    let ltcBlockedCount = 0;
    let duplicateConflictCount = 0;

    rawRows.forEach((rawRow, index) => {
      const rowNum = index + 2; // header is row 1
      const normalized = normalizeStudentRow(rawRow);
      const errors = [];
      const warnings = [];

      const cleanPrn = String(normalized.prn || '').trim();
      const prnKey = cleanPrn.toLowerCase();
      const cleanEmail = normalized.email ? String(normalized.email).trim().toLowerCase() : '';
      const isLeftOrEmptyPRN = !cleanPrn || prnKey.includes('left') || prnKey.includes('cancelled') || prnKey.includes('n/a');

      // Silently skip completely empty / withdrawn placeholder rows
      if ((!normalized.name || String(normalized.name).trim() === '') && (!cleanEmail && isLeftOrEmptyPRN)) {
        return;
      }

      // 1. Validate PRN format and in-file uniqueness
      if (!cleanPrn) {
        errors.push('PRN / Student ID is required');
      } else if (seenPrnsInFile.has(prnKey)) {
        errors.push(`Duplicate PRN within file: "${cleanPrn}" (first seen at row ${seenPrnsInFile.get(prnKey)})`);
        duplicateConflictCount++;
      } else {
        seenPrnsInFile.set(prnKey, rowNum);
      }

      // 2. Validate Name
      if (!normalized.name || normalized.name.trim().length === 0) {
        errors.push('Student Name is required');
      }

      // 3. Validate Email format and in-file uniqueness
      if (cleanEmail) {
        if (!emailRegex.test(cleanEmail)) {
          errors.push(`Invalid email format: "${normalized.email}"`);
        } else if (seenEmailsInFile.has(cleanEmail)) {
          errors.push(`Duplicate Email within file: "${cleanEmail}" (first seen at row ${seenEmailsInFile.get(cleanEmail)})`);
          duplicateConflictCount++;
        } else {
          seenEmailsInFile.set(cleanEmail, rowNum);
        }
      } else {
        errors.push('Email is required for student enrollment');
      }

      // 4. Strict LTC Isolation & Identity Verification for RI_DIRECT Batches
      if (isRiDirect && cleanPrn && errors.length === 0) {
        const matchedByPrn = userByPrn.get(prnKey);
        const matchedByEmail = cleanEmail ? userByEmail.get(cleanEmail) : null;

        // Condition A & B: Reject if PRN belongs to an existing LTC student
        if (matchedByPrn && matchedByPrn.is_ltc_student) {
          errors.push(`Student with PRN "${cleanPrn}" (${matchedByPrn.name}) is already registered in LTC. Existing LTC students cannot be imported into an RI Direct cohort.`);
          ltcBlockedCount++;
        }
        // Condition C: Secondary conflict check - Reject if Email belongs to an existing LTC student
        else if (matchedByEmail && matchedByEmail.is_ltc_student) {
          errors.push(`Email "${cleanEmail}" belongs to an existing LTC student (${matchedByEmail.name}, PRN: ${matchedByEmail.prn || 'N/A'}). Existing LTC students cannot be imported into an RI Direct cohort.`);
          ltcBlockedCount++;
        }
        // Condition C: Identity Conflict between PRN and Email
        else if (matchedByPrn && matchedByEmail && matchedByPrn.id !== matchedByEmail.id) {
          errors.push(`Identity conflict: PRN "${cleanPrn}" belongs to "${matchedByPrn.name}" (${matchedByPrn.email}) while email "${cleanEmail}" belongs to "${matchedByEmail.name}" (PRN: ${matchedByEmail.prn || 'N/A'}). Requires administrator review.`);
          duplicateConflictCount++;
        }
        else if (matchedByPrn && matchedByPrn.email && matchedByPrn.email !== cleanEmail) {
          errors.push(`Identity conflict: PRN "${cleanPrn}" belongs to "${matchedByPrn.name}" with registered email "${matchedByPrn.email}", but uploaded email is "${cleanEmail}". Requires administrator review.`);
          duplicateConflictCount++;
        }
        else if (!matchedByPrn && matchedByEmail) {
          errors.push(`Identity conflict: Email "${cleanEmail}" is registered to student "${matchedByEmail.name}" with PRN "${matchedByEmail.prn || 'N/A'}", but uploaded PRN is "${cleanPrn}". Requires administrator review.`);
          duplicateConflictCount++;
        }
        // Condition 7: Existing RI student duplicate rejection
        else if (matchedByPrn) {
          const isEnrolledInBatch = Array.isArray(matchedByPrn.ri_enrollments) && matchedByPrn.ri_enrollments.some(e => e.ri_batch_id === riBatchId);
          if (isEnrolledInBatch) {
            errors.push(`Student with PRN "${cleanPrn}" is already enrolled in this RI batch.`);
          } else {
            errors.push(`Student with PRN "${cleanPrn}" is already enrolled in another RI cohort. Duplicate RI enrollment is not permitted.`);
          }
          duplicateConflictCount++;
        }
      }

      // 5. Panel Resolution
      let resolvedPanelId = null;
      let resolvedPanelName = '';
      let resolvedPanelNumber = null;

      if (mode === 'panel_wise' && ri_panel_id) {
        const p = batchPanels.find(x => x.id === parseInt(ri_panel_id));
        if (p) {
          resolvedPanelId = p.id;
          resolvedPanelName = cleanPanelName(p.name);
          resolvedPanelNumber = p.panel_number;
        }
      } else if (normalized.panel_input) {
        const matched = matchPanel(normalized.panel_input, batchPanels);
        if (matched) {
          resolvedPanelId = matched.id;
          resolvedPanelName = cleanPanelName(matched.name);
          resolvedPanelNumber = matched.panel_number;
        } else {
          resolvedPanelName = cleanPanelName(normalized.panel_input);
          warnings.push(`Panel "${resolvedPanelName}" will be newly created in this batch on upload.`);
        }
      } else if (batchPanels.length > 0) {
        resolvedPanelId = batchPanels[0].id;
        resolvedPanelName = cleanPanelName(batchPanels[0].name);
        resolvedPanelNumber = batchPanels[0].panel_number;
        warnings.push(`No panel specified; defaulted to "${resolvedPanelName}".`);
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      validatedRows.push({
        row_number: rowNum,
        prn: cleanPrn,
        name: normalized.name,
        email: cleanEmail,
        phone: normalized.phone,
        department: normalized.department,
        school: normalized.school,
        division: normalized.division,
        roll_number: normalized.roll_number,
        gender: normalized.gender,
        dob: normalized.dob,
        age: normalized.age,
        address: normalized.address,
        parent_mobile: normalized.parent_mobile,
        parent_email: normalized.parent_email,
        nationality: normalized.nationality,
        aadhar_no: normalized.aadhar_no,
        nominee_name: normalized.nominee_name,
        nominee_relationship: normalized.nominee_relationship,
        nominee_email: normalized.nominee_email,
        faculty: normalized.faculty,
        salutation: normalized.salutation,
        first_name: normalized.first_name,
        middle_name: normalized.middle_name,
        last_name: normalized.last_name,
        panel: normalized.panel_input,
        raw_panel_input: normalized.panel_input,
        resolved_panel_id: resolvedPanelId,
        resolved_panel_name: resolvedPanelName,
        resolved_panel_number: resolvedPanelNumber,
        is_valid: isValid,
        errors,
        warnings,
        ...normalized
      });
    });

    res.json({
      message: 'Validation completed successfully',
      batch_id: riBatchId,
      summary: {
        total_rows: rawRows.length,
        valid_rows: validCount,
        invalid_rows: invalidCount,
        ltc_blocked_count: ltcBlockedCount,
        duplicate_conflict_count: duplicateConflictCount,
        available_panels_count: batchPanels.length
      },
      validated_rows: validatedRows,
      rows: validatedRows
    });
  } catch (err) {
    console.error('Error validating student upload:', err);
    res.status(500).json({ message: 'Validation failed', error: err.message });
  }
};

// ─── 13. Execute Student Bulk Upload ──────────────────────────────────────────
const bulkUploadStudents = async (req, res) => {
  const { id } = req.params;
  const mode = req.body?.mode || 'batch_wise';
  const ri_panel_id = req.body?.ri_panel_id;

  let inputRows = [];
  if (req.file && req.file.buffer) {
    try {
      inputRows = parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ message: parseErr.message });
    }
  } else if (req.body?.rows || req.body?.students) {
    const rawInput = req.body.rows !== undefined ? req.body.rows : req.body.students;
    if (typeof rawInput === 'string') {
      try {
        inputRows = JSON.parse(rawInput);
      } catch (e) {
        inputRows = [];
      }
    } else if (Array.isArray(rawInput)) {
      inputRows = rawInput;
    }
  }

  if (!inputRows || inputRows.length === 0) {
    return res.status(400).json({ message: 'No student rows provided for upload.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchRes = await client.query(
      `SELECT id, name, batch_code, source_program, source_batch_id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'RI Batch not found.' });
    }
    const targetRiBatch = batchRes.rows[0];
    const riBatchId = targetRiBatch.id;
    const isRiDirect = !targetRiBatch.source_batch_id || targetRiBatch.source_program === 'RI_DIRECT';
    const sourceBatchId = targetRiBatch.source_batch_id || null;
    const currentBatchCode = targetRiBatch.batch_code || `RI-01-${riBatchId}`;

    let currentStudentSeq = 0;
    if (isRiDirect) {
      const existingRiIdsRes = await client.query(
        'SELECT ri_id FROM ri_batch_students WHERE ri_batch_id = $1 AND ri_id IS NOT NULL',
        [riBatchId]
      );
      for (const r of existingRiIdsRes.rows) {
        if (r.ri_id) {
          const lastDash = r.ri_id.lastIndexOf('-');
          if (lastDash !== -1) {
            const seq = parseInt(r.ri_id.slice(lastDash + 1), 10);
            if (!isNaN(seq) && seq > currentStudentSeq) {
              currentStudentSeq = seq;
            }
          }
        }
      }
    }

    // Fetch existing batch panels
    const panelsRes = await client.query(
      `SELECT id, panel_number, name FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`,
      [riBatchId]
    );
    const batchPanels = [...panelsRes.rows];

    // Fetch existing student identities and LTC enrollment markers
    const existingUsersRes = await client.query(`
      SELECT 
        u.id, 
        TRIM(u.prn) AS prn, 
        LOWER(TRIM(u.email)) AS email, 
        u.name,
        (
          EXISTS (SELECT 1 FROM batch_students bs WHERE bs.student_id = u.id)
          OR EXISTS (
            SELECT 1 FROM ri_batch_students rbs 
            WHERE rbs.student_id = u.id 
              AND (rbs.source_program IN ('LTC', 'LTC_SYNC') OR rbs.enrollment_type = 'LTC_SYNC')
          )
        ) AS is_ltc_student,
        COALESCE(
          (SELECT json_agg(json_build_object('ri_batch_id', rbs.ri_batch_id, 'ri_id', rbs.ri_id)) FROM ri_batch_students rbs WHERE rbs.student_id = u.id),
          '[]'::json
        ) AS ri_enrollments
      FROM users u
      WHERE u.role = 'student' OR u.role IS NULL
    `);

    const userByPrn = new Map();
    const userByEmail = new Map();
    for (const u of existingUsersRes.rows) {
      if (u.prn) userByPrn.set(String(u.prn).trim().toLowerCase(), u);
      if (u.email) userByEmail.set(String(u.email).trim().toLowerCase(), u);
    }

    const defaultHashedPassword = await bcrypt.hash('student123', 10);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const seenPrnsInUpload = new Map();
    const seenEmailsInUpload = new Map();
    const rejectedRows = [];

    let importedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < inputRows.length; i++) {
      const row = inputRows[i];
      const rowNum = row.row_number || (i + 2);

      const normalized = normalizeStudentRow(row);

      const cleanPrn = cleanStr(normalized.prn, 100);
      const prnKey = cleanPrn ? cleanPrn.toLowerCase() : '';
      const name = cleanStr(normalized.name, 255);
      const cleanEmail = cleanStr(normalized.email ? normalized.email.toLowerCase() : null, 255);
      const phone = cleanStr(normalized.phone || normalized.mobile, 255);
      const department = cleanStr(normalized.department, 255);
      const school = cleanStr(normalized.school, 255);
      const division = cleanStr(normalized.division, 255);
      const rollNumber = cleanStr(normalized.roll_number, 100);
      const gender = cleanStr(normalized.gender, 100);
      const panel = cleanStr(normalized.panel_input || normalized.panel, 100);
      const dob = cleanStr(normalized.dob, 50);
      const age = normalized.age ? parseInt(normalized.age, 10) || null : null;
      const address = cleanStr(normalized.address, 1000);
      const parentMobile = cleanStr(normalized.parent_mobile, 255);
      const parentEmail = cleanStr(normalized.parent_email, 255);
      const nationality = cleanStr(normalized.nationality, 100);
      const aadharNo = cleanStr(normalized.aadhar_no, 100);
      const nomineeName = cleanStr(normalized.nominee_name, 255);
      const nomineeRelationship = cleanStr(normalized.nominee_relationship, 100);
      const nomineeEmail = cleanStr(normalized.nominee_email, 255);
      const faculty = cleanStr(normalized.faculty, 255);
      const salutation = cleanStr(normalized.salutation, 100);
      const firstName = cleanStr(normalized.first_name, 100);
      const middleName = cleanStr(normalized.middle_name, 100);
      const lastName = cleanStr(normalized.last_name, 100);

      // Check validation status or evaluate rules
      let rejectionReason = null;
      let isDuplicate = false;

      if (row.is_valid === false && row.errors && row.errors.length > 0) {
        rejectionReason = row.errors.join('; ');
        if (rejectionReason.toLowerCase().includes('duplicate') || rejectionReason.toLowerCase().includes('already')) {
          isDuplicate = true;
        }
      } else if (!cleanPrn) {
        rejectionReason = 'PRN / Student ID is required';
      } else if (!name) {
        rejectionReason = 'Student Name is required';
      } else if (!cleanEmail) {
        rejectionReason = 'Email is required for student enrollment';
      } else if (!emailRegex.test(cleanEmail)) {
        rejectionReason = `Invalid email format: "${normalized.email}"`;
      } else if (seenPrnsInUpload.has(prnKey)) {
        rejectionReason = `Duplicate PRN within file: "${cleanPrn}" (first seen at row ${seenPrnsInUpload.get(prnKey)})`;
        isDuplicate = true;
      } else if (seenEmailsInUpload.has(cleanEmail)) {
        rejectionReason = `Duplicate Email within file: "${cleanEmail}" (first seen at row ${seenEmailsInUpload.get(cleanEmail)})`;
        isDuplicate = true;
      } else {
        seenPrnsInUpload.set(prnKey, rowNum);
        seenEmailsInUpload.set(cleanEmail, rowNum);

        if (isRiDirect) {
          const matchedByPrn = userByPrn.get(prnKey);
          const matchedByEmail = userByEmail.get(cleanEmail);

          // Condition A & B: Reject if PRN belongs to an existing LTC student
          if (matchedByPrn && matchedByPrn.is_ltc_student) {
            rejectionReason = `Student with PRN "${cleanPrn}" (${matchedByPrn.name}) is already registered in LTC. Existing LTC students cannot be imported into an RI Direct cohort.`;
            isDuplicate = true;
          }
          // Condition C: Reject if Email belongs to an existing LTC student
          else if (matchedByEmail && matchedByEmail.is_ltc_student) {
            rejectionReason = `Email "${cleanEmail}" belongs to an existing LTC student (${matchedByEmail.name}, PRN: ${matchedByEmail.prn || 'N/A'}). Existing LTC students cannot be imported into an RI Direct cohort.`;
            isDuplicate = true;
          }
          // Condition C: Identity Conflict between PRN and Email
          else if (matchedByPrn && matchedByEmail && matchedByPrn.id !== matchedByEmail.id) {
            rejectionReason = `Identity conflict: PRN "${cleanPrn}" belongs to "${matchedByPrn.name}" (${matchedByPrn.email}) while email "${cleanEmail}" belongs to "${matchedByEmail.name}" (PRN: ${matchedByEmail.prn || 'N/A'}). Requires administrator review.`;
          }
          else if (matchedByPrn && matchedByPrn.email && matchedByPrn.email !== cleanEmail) {
            rejectionReason = `Identity conflict: PRN "${cleanPrn}" belongs to "${matchedByPrn.name}" with registered email "${matchedByPrn.email}", but uploaded email is "${cleanEmail}". Requires administrator review.`;
          }
          else if (!matchedByPrn && matchedByEmail) {
            rejectionReason = `Identity conflict: Email "${cleanEmail}" is registered to student "${matchedByEmail.name}" with PRN "${matchedByEmail.prn || 'N/A'}", but uploaded PRN is "${cleanPrn}". Requires administrator review.`;
          }
          // Condition 7: Existing RI student duplicate rejection
          else if (matchedByPrn) {
            const isEnrolledInBatch = Array.isArray(matchedByPrn.ri_enrollments) && matchedByPrn.ri_enrollments.some(e => e.ri_batch_id === riBatchId);
            if (isEnrolledInBatch) {
              rejectionReason = `Student with PRN "${cleanPrn}" is already enrolled in this RI batch.`;
            } else {
              rejectionReason = `Student with PRN "${cleanPrn}" is already enrolled in another RI cohort. Duplicate RI enrollment is not permitted.`;
            }
            isDuplicate = true;
          }
        }
      }

      if (rejectionReason) {
        rejectedCount++;
        if (isDuplicate) duplicateCount++;
        rejectedRows.push({
          row_number: rowNum,
          prn: cleanPrn || null,
          email: cleanEmail || null,
          name: name || 'Unknown',
          reason: rejectionReason
        });
        continue;
      }

      // 1. Find or create user
      let userId;
      if (isRiDirect) {
        // RI_DIRECT creates a brand-new user (since existing LTC students & conflicts were rejected above)
        const userInsert = await client.query(`
          INSERT INTO users (
            name, email, password, role, prn, phone, department, school, division, roll_number, gender,
            panel, dob, age, address, parent_mobile, parent_email, nationality, aadhar_no,
            nominee_name, nominee_relationship, nominee_email, faculty,
            salutation, first_name, middle_name, last_name
          )
          VALUES (
            $1, $2, $3, 'student', $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22,
            $23, $24, $25, $26
          )
          RETURNING id
        `, [
          name, cleanEmail, defaultHashedPassword, cleanPrn, phone, department, school, division, rollNumber, gender,
          panel, dob, age, address, parentMobile, parentEmail, nationality, aadharNo,
          nomineeName, nomineeRelationship, nomineeEmail, faculty,
          salutation, firstName, middleName, lastName
        ]);
        userId = userInsert.rows[0].id;
        createdCount++;
      } else {
        // LTC_SYNC batch handling
        const userLookup = await client.query(
          `SELECT id, role, email, prn FROM users WHERE prn = $1 OR LOWER(email) = LOWER($2) LIMIT 1`,
          [cleanPrn, cleanEmail]
        );
        if (userLookup.rowCount > 0) {
          userId = userLookup.rows[0].id;
          await client.query(`
            UPDATE users SET
              name = COALESCE(NULLIF($1, ''), name),
              phone = COALESCE(NULLIF($2, ''), phone),
              department = COALESCE(NULLIF($3, ''), department),
              school = COALESCE(NULLIF($4, ''), school),
              division = COALESCE(NULLIF($5, ''), division),
              roll_number = COALESCE(NULLIF($6, ''), roll_number),
              gender = COALESCE(NULLIF($7, ''), gender),
              panel = COALESCE(NULLIF($8, ''), panel),
              dob = COALESCE(NULLIF($9, ''), dob),
              age = COALESCE($10, age),
              address = COALESCE(NULLIF($11, ''), address),
              parent_mobile = COALESCE(NULLIF($12, ''), parent_mobile),
              parent_email = COALESCE(NULLIF($13, ''), parent_email),
              nationality = COALESCE(NULLIF($14, ''), nationality),
              aadhar_no = COALESCE(NULLIF($15, ''), aadhar_no),
              nominee_name = COALESCE(NULLIF($16, ''), nominee_name),
              nominee_relationship = COALESCE(NULLIF($17, ''), nominee_relationship),
              nominee_email = COALESCE(NULLIF($18, ''), nominee_email),
              faculty = COALESCE(NULLIF($19, ''), faculty),
              salutation = COALESCE(NULLIF($20, ''), salutation),
              first_name = COALESCE(NULLIF($21, ''), first_name),
              middle_name = COALESCE(NULLIF($22, ''), middle_name),
              last_name = COALESCE(NULLIF($23, ''), last_name),
              email = COALESCE(NULLIF($24, ''), email),
              prn = COALESCE(NULLIF($25, ''), prn)
            WHERE id = $26
          `, [
            name, phone, department, school, division, rollNumber, gender,
            panel, dob, age, address, parentMobile, parentEmail, nationality, aadharNo,
            nomineeName, nomineeRelationship, nomineeEmail, faculty,
            salutation, firstName, middleName, lastName, cleanEmail, cleanPrn, userId
          ]);
          updatedCount++;
        } else {
          const userInsert = await client.query(`
            INSERT INTO users (
              name, email, password, role, prn, phone, department, school, division, roll_number, gender,
              panel, dob, age, address, parent_mobile, parent_email, nationality, aadhar_no,
              nominee_name, nominee_relationship, nominee_email, faculty,
              salutation, first_name, middle_name, last_name
            )
            VALUES (
              $1, $2, $3, 'student', $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18,
              $19, $20, $21, $22,
              $23, $24, $25, $26
            )
            RETURNING id
          `, [
            name, cleanEmail, defaultHashedPassword, cleanPrn, phone, department, school, division, rollNumber, gender,
            panel, dob, age, address, parentMobile, parentEmail, nationality, aadharNo,
            nomineeName, nomineeRelationship, nomineeEmail, faculty,
            salutation, firstName, middleName, lastName
          ]);
          userId = userInsert.rows[0].id;
          createdCount++;
        }
      }

      // 2. Resolve panel
      let targetPanelId = row.resolved_panel_id || normalized.resolved_panel_id;
      if (!targetPanelId && mode === 'panel_wise' && ri_panel_id) {
        targetPanelId = parseInt(ri_panel_id);
      }
      if (!targetPanelId && (normalized.panel_input || normalized.raw_panel_input || normalized.panel)) {
        const pInput = normalized.panel_input || normalized.raw_panel_input || normalized.panel;
        const matched = matchPanel(pInput, batchPanels);
        if (matched) {
          targetPanelId = matched.id;
        } else {
          // Auto create panel with clean name
          const cleanName = cleanPanelName(pInput);
          const maxNumRes = await client.query(
            `SELECT COALESCE(MAX(panel_number), 0) + 1 AS next_num FROM ri_panels WHERE ri_batch_id = $1`,
            [riBatchId]
          );
          const nextNum = maxNumRes.rows[0].next_num;
          const newPanelRes = await client.query(`
            INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
            VALUES ($1, $2, $3, 60)
            RETURNING *
          `, [riBatchId, nextNum, cleanName]);
          const newPanel = newPanelRes.rows[0];
          batchPanels.push(newPanel);
          targetPanelId = newPanel.id;
        }
      }
      if (!targetPanelId && batchPanels.length > 0) {
        targetPanelId = batchPanels[0].id;
      }
      if (!targetPanelId) {
        const newPanelRes = await client.query(`
          INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
          VALUES ($1, 1, 'General Immersion', 60)
          RETURNING *
        `, [riBatchId]);
        const newPanel = newPanelRes.rows[0];
        batchPanels.push(newPanel);
        targetPanelId = newPanel.id;
      }

      // 3. Upsert into ri_batch_students with sequential RI-only student ID
      if (isRiDirect) {
        currentStudentSeq += 1;
        const studentRiId = `${currentBatchCode}-${String(currentStudentSeq).padStart(2, '0')}`;

        // RI_DIRECT cohort: strictly isolated from LTC (no LTC enrollment created or modified)
        await client.query(`
          INSERT INTO ri_batch_students (
            ri_batch_id, student_id, ri_panel_id, source_program, source_ltc_batch_id, enrollment_type, ri_id
          )
          VALUES ($1, $2, $3, 'RI_DIRECT', NULL, 'RI_DIRECT', $4)
        `, [riBatchId, userId, targetPanelId, studentRiId]);

        // Cache new user identity in in-memory maps for subsequent row checks in same file
        const newUserCached = {
          id: userId,
          prn: cleanPrn,
          email: cleanEmail,
          name,
          is_ltc_student: false,
          ri_enrollments: [{ ri_batch_id: riBatchId, ri_id: studentRiId }]
        };
        userByPrn.set(prnKey, newUserCached);
        userByEmail.set(cleanEmail, newUserCached);
      } else {
        // LTC_SYNC cohort: maintains LTC linkage, do NOT generate RI student ID (ri_id = NULL)
        await client.query(`
          INSERT INTO ri_batch_students (
            ri_batch_id, student_id, ri_panel_id, source_program, source_ltc_batch_id, enrollment_type, ri_id
          )
          VALUES ($1, $2, $3, 'LTC_SYNC', $4, 'LTC_SYNC', NULL)
          ON CONFLICT (ri_batch_id, student_id)
          DO UPDATE SET
            ri_panel_id = EXCLUDED.ri_panel_id,
            source_program = 'LTC_SYNC',
            source_ltc_batch_id = EXCLUDED.source_ltc_batch_id,
            enrollment_type = 'LTC_SYNC',
            ri_id = NULL
        `, [riBatchId, userId, targetPanelId, sourceBatchId]);

        // Ensure LTC batch_students has this student as well
        if (sourceBatchId) {
          await client.query(`
            INSERT INTO batch_students (batch_id, student_id)
            VALUES ($1, $2)
            ON CONFLICT (batch_id, student_id) DO NOTHING
          `, [sourceBatchId, userId]);
        }
      }

      importedCount++;
    }

    await client.query('COMMIT');
    res.json({
      message: `Bulk student import completed: ${importedCount} students enrolled, ${rejectedCount} rejected (${createdCount} new accounts created).`,
      imported_count: importedCount,
      rejected_count: rejectedCount,
      duplicate_count: duplicateCount,
      accounts_created: createdCount,
      accounts_updated: updatedCount,
      failed_count: rejectedCount,
      total_processed: inputRows.length,
      rejected_rows: rejectedRows
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in student bulk upload:', err);
    res.status(500).json({ message: 'Failed to import students', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 14. Download Excel Template for Students ─────────────────────────────────
const downloadStudentTemplate = async (req, res) => {
  const { id } = req.params;

  try {
    const batchRes = await pool.query(
      `SELECT id, name FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;
    const batchName = batchRes.rows[0].name;

    const panelsRes = await pool.query(`
      SELECT 
        rp.panel_number,
        rp.name,
        v.name AS village_name,
        (SELECT COUNT(*)::int FROM ri_batch_students rbs WHERE rbs.ri_panel_id = rp.id) AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rp.ri_batch_id = $1
      ORDER BY rp.panel_number ASC
    `, [riBatchId]);
    const panels = panelsRes.rows;

    const wb = XLSX.utils.book_new();

    const samplePanel = panels[0]?.name ? cleanPanelName(panels[0].name) : 'SY R&A Div 1';
    const samplePanel2 = panels[1]?.name ? cleanPanelName(panels[1].name) : 'SYRA Div 02';

    // Exact Master Sheet columns and sample rows matching LTC Master Sheet
    const masterSheetRows = [
      {
        'Master Sr No': 1,
        'Source Sheet': 'Sheet1',
        'Sr No (Original)': 1,
        'PRN No': '1032230001',
        'Salutation': 'Mr',
        'First Name': 'Aarav',
        'Middle Name': 'Kumar',
        'Last Name': 'Sharma',
        'Mobile No': '9876543210',
        'Date of Birth': '2004-05-15',
        'Gender': 'Male',
        'Age': 20,
        'Nationality': 'Indian',
        'Aadhar Card No': '123456789012',
        'Nominee Name': 'Ramesh Sharma',
        'Nominee Relationship': 'Father',
        'Nominee Email ID': 'ramesh.sharma@example.com',
        'Student Email Address': 'aarav.sharma@mitwpu.edu.in',
        'Complete Address with pincode': 'Flat 101, Green Acres, Pune 411038',
        'Division': 'I',
        'Faculty': 'Faculty of Engineering',
        'School': 'School of Engineering & Technology',
        'Department': 'Department of Mechanical Engineering',
        'Panel': samplePanel,
        'Roll Number': '101',
        'Parent / Guardian Mobile': '9876543219',
        'Parent Email ID': 'parent.sharma@example.com'
      },
      {
        'Master Sr No': 2,
        'Source Sheet': 'Sheet1',
        'Sr No (Original)': 2,
        'PRN No': '1032230002',
        'Salutation': 'Ms',
        'First Name': 'Ananya',
        'Middle Name': 'Suresh',
        'Last Name': 'Kulkarni',
        'Mobile No': '9876543211',
        'Date of Birth': '2004-08-22',
        'Gender': 'Female',
        'Age': 20,
        'Nationality': 'Indian',
        'Aadhar Card No': '234567890123',
        'Nominee Name': 'Suresh Kulkarni',
        'Nominee Relationship': 'Father',
        'Nominee Email ID': 'suresh.kulkarni@example.com',
        'Student Email Address': 'ananya.kulkarni@mitwpu.edu.in',
        'Complete Address with pincode': 'B-402, Sunshine Heights, Pune 411052',
        'Division': 'I',
        'Faculty': 'Faculty of Engineering',
        'School': 'School of Engineering & Technology',
        'Department': 'Department of Mechanical Engineering',
        'Panel': samplePanel,
        'Roll Number': '102',
        'Parent / Guardian Mobile': '9876543220',
        'Parent Email ID': 'parent.kulkarni@example.com'
      },
      {
        'Master Sr No': 3,
        'Source Sheet': 'Sheet1',
        'Sr No (Original)': 3,
        'PRN No': '1032230003',
        'Salutation': 'Mr',
        'First Name': 'Rohan',
        'Middle Name': 'Vikas',
        'Last Name': 'Deshmukh',
        'Mobile No': '9876543212',
        'Date of Birth': '2003-12-10',
        'Gender': 'Male',
        'Age': 21,
        'Nationality': 'Indian',
        'Aadhar Card No': '345678901234',
        'Nominee Name': 'Vikas Deshmukh',
        'Nominee Relationship': 'Father',
        'Nominee Email ID': 'vikas.deshmukh@example.com',
        'Student Email Address': 'rohan.deshmukh@mitwpu.edu.in',
        'Complete Address with pincode': 'Row House 5, Lotus Park, Pune 411014',
        'Division': 'II',
        'Faculty': 'Faculty of Pharmacy',
        'School': 'School of Pharmacy',
        'Department': 'Department of Pharmaceutical Chemistry',
        'Panel': samplePanel2,
        'Roll Number': '201',
        'Parent / Guardian Mobile': '9876543221',
        'Parent Email ID': 'parent.deshmukh@example.com'
      }
    ];

    const wsUpload = XLSX.utils.json_to_sheet(masterSheetRows);
    XLSX.utils.book_append_sheet(wb, wsUpload, 'Master Sheet');

    // Reference sheet listing available panels with clean names
    const refRows = panels.map(p => ({
      'Panel Name': cleanPanelName(p.name),
      'Assigned Village': p.village_name || 'Unassigned',
      'Current Student Count': p.student_count || 0
    }));
    const wsRef = XLSX.utils.json_to_sheet(refRows);
    XLSX.utils.book_append_sheet(wb, wsRef, 'Available Panels Reference');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const cleanBatchName = (batchName || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `RI_Students_Bulk_Upload_Template_${cleanBatchName}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error generating student upload template:', err);
    res.status(500).json({ message: 'Failed to download template', error: err.message });
  }
};

// ─── 12. Create Single Faculty Mentor ───────────────────────────────────────
const createBatchFaculty = async (req, res) => {
  const { id } = req.params;
  const {
    ri_panel_id,
    panel_id,
    panelId,
    target_panel_id,
    targetPanelId: bodyTargetPanelId,
    name,
    email,
    phone,
    mobile,
    department,
    designation,
    employee_id,
    role
  } = req.body;
  const contactPhone = phone || mobile;
  const rawTargetPanel = ri_panel_id ?? panel_id ?? panelId ?? target_panel_id ?? bodyTargetPanelId;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Faculty name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Email address is required.' });
  }
  if (!rawTargetPanel) {
    return res.status(400).json({ message: 'Panel assignment is required.' });
  }
  const targetPanelId = parseInt(rawTargetPanel, 10);
  if (isNaN(targetPanelId) || targetPanelId <= 0) {
    return res.status(400).json({ message: 'Invalid panel assignment ID.' });
  }

  try {
    const batchRes = await pool.query(
      `SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const riBatchId = batchRes.rows[0].id;

    // Verify panel belongs to batch
    const panelCheck = await pool.query(`
      SELECT id, ri_batch_id FROM ri_panels 
      WHERE id = $1 
        AND (ri_batch_id = $2 OR ri_batch_id IN (SELECT id FROM ri_batches WHERE id = $2 OR source_batch_id = $2))
    `, [targetPanelId, riBatchId]);
    if (panelCheck.rowCount === 0) {
      return res.status(400).json({ message: 'Selected panel does not belong to this batch.' });
    }
    const verifiedBatchId = panelCheck.rows[0].ri_batch_id;

    const lowerEmail = email.trim().toLowerCase();

    // 1. Resolve canonical faculty user account
    let facultyUserId = null;
    const userRes = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [lowerEmail]);
    if (userRes.rowCount > 0) {
      facultyUserId = userRes.rows[0].id;
      await pool.query(`
        UPDATE users SET
          name = COALESCE(NULLIF($1, ''), name),
          phone = COALESCE(NULLIF($2, ''), phone),
          department = COALESCE(NULLIF($3, ''), department),
          designation = COALESCE(NULLIF($4, ''), designation)
        WHERE id = $5
      `, [
        name.trim(),
        contactPhone ? contactPhone.trim() : null,
        department ? department.trim() : null,
        designation ? designation.trim() : null,
        facultyUserId
      ]);
    } else {
      const defaultPasswordHash = await bcrypt.hash('faculty123', 10);
      const newUserRes = await pool.query(`
        INSERT INTO users (name, email, password, role, department, designation, phone, status)
        VALUES ($1, $2, $3, 'ri_faculty', $4, $5, $6, 'active')
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
          phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
          department = COALESCE(NULLIF(EXCLUDED.department, ''), users.department),
          designation = COALESCE(NULLIF(EXCLUDED.designation, ''), users.designation)
        RETURNING id
      `, [
        name.trim(),
        lowerEmail,
        defaultPasswordHash,
        department?.trim() || null,
        designation?.trim() || null,
        contactPhone?.trim() || null
      ]);
      facultyUserId = newUserRes.rows[0]?.id || null;
      if (!facultyUserId) {
        const fetchUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [lowerEmail]);
        facultyUserId = fetchUser.rows[0]?.id || null;
      }
    }

    // 2. Prevent duplicate assignments for the same faculty, batch, and panel combination
    const dupCheck = await pool.query(
      `SELECT id FROM ri_batch_faculty 
       WHERE ri_batch_id = $1 
         AND ri_panel_id = $2 
         AND (
           (faculty_id IS NOT NULL AND faculty_id = $3)
           OR (email IS NOT NULL AND LOWER(email) = $4)
         ) 
         AND status <> 'deleted'`,
      [verifiedBatchId, targetPanelId, facultyUserId, lowerEmail]
    );
    if (dupCheck.rowCount > 0) {
      return res.status(400).json({ message: `Faculty with email "${lowerEmail}" is already assigned to this panel in this batch.` });
    }

    // 3. Insert assignment into ri_batch_faculty
    const insertRes = await pool.query(`
      INSERT INTO ri_batch_faculty (
        ri_batch_id, ri_panel_id, faculty_id, name, email, phone, department, designation, employee_id, role, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *
    `, [
      verifiedBatchId,
      targetPanelId,
      facultyUserId,
      name.trim(),
      lowerEmail,
      contactPhone?.trim() || null,
      department?.trim() || null,
      designation?.trim() || null,
      employee_id?.trim() || null,
      role?.trim() || 'Mentor'
    ]);

    res.status(201).json({
      message: 'Faculty mentor assigned successfully.',
      faculty: insertRes.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'This faculty member is already assigned to this panel in this batch.' });
    }
    console.error('Error creating faculty mentor:', err);
    res.status(500).json({ message: 'Failed to create faculty mentor', error: err.message });
  }
};

// ─── 13. Update Single Faculty Mentor ───────────────────────────────────────
const updateBatchFaculty = async (req, res) => {
  const { facultyId } = req.params;
  const {
    ri_panel_id,
    panel_id,
    panelId,
    target_panel_id,
    targetPanelId: bodyTargetPanelId,
    name,
    email,
    phone,
    mobile,
    department,
    designation,
    employee_id,
    role,
    status
  } = req.body;
  const contactPhone = phone || mobile;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(`SELECT * FROM ri_batch_faculty WHERE id = $1`, [facultyId]);
    if (existingRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Faculty record not found' });
    }
    const existing = existingRes.rows[0];

    // Read target panel: support all common property names (ri_panel_id, panel_id, panelId, target_panel_id)
    const rawTargetPanel = ri_panel_id ?? panel_id ?? panelId ?? target_panel_id ?? bodyTargetPanelId;
    let targetPanelId = existing.ri_panel_id;
    if (rawTargetPanel !== undefined && rawTargetPanel !== null && rawTargetPanel !== '') {
      const parsed = parseInt(rawTargetPanel, 10);
      if (!isNaN(parsed) && parsed > 0) {
        targetPanelId = parsed;
      }
    }

    // Resolve target batch
    let targetBatchId = existing.ri_batch_id;
    const rawBatchId = req.body.ri_batch_id ?? req.body.batch_id ?? req.body.batchId;
    if (rawBatchId) {
      const bRes = await client.query(
        'SELECT id FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1',
        [rawBatchId]
      );
      if (bRes.rowCount > 0) {
        targetBatchId = bRes.rows[0].id;
      }
    }

    const oldEmail = existing.email ? existing.email.toLowerCase().trim() : '';
    const lowerEmail = email ? email.trim().toLowerCase() : oldEmail;

    if (!lowerEmail) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Faculty email address is required.' });
    }

    // Verify target panel belongs to this batch
    if (targetPanelId) {
      const panelCheck = await client.query(`
        SELECT id, ri_batch_id FROM ri_panels 
        WHERE id = $1 
          AND (ri_batch_id = $2 OR ri_batch_id IN (SELECT id FROM ri_batches WHERE id = $2 OR source_batch_id = $2))
      `, [targetPanelId, targetBatchId]);
      if (panelCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected panel does not belong to this batch.' });
      }
      targetBatchId = panelCheck.rows[0].ri_batch_id;
    }

    // 1. Locate / resolve canonical faculty user account in users table
    let facultyUserId = null;
    const userRes = await client.query(`SELECT id, name, email FROM users WHERE LOWER(email) = $1 LIMIT 1`, [lowerEmail]);
    if (userRes.rowCount > 0) {
      facultyUserId = userRes.rows[0].id;
      await client.query(`
        UPDATE users SET
          name = COALESCE(NULLIF($1, ''), name),
          phone = COALESCE(NULLIF($2, ''), phone),
          department = COALESCE(NULLIF($3, ''), department),
          designation = COALESCE(NULLIF($4, ''), designation)
        WHERE id = $5
      `, [
        name ? name.trim() : null,
        contactPhone ? contactPhone.trim() : null,
        department ? department.trim() : null,
        designation ? designation.trim() : null,
        facultyUserId
      ]);
    } else {
      const defaultPasswordHash = await bcrypt.hash('faculty123', 10);
      const newUserRes = await client.query(`
        INSERT INTO users (name, email, password, role, department, designation, phone, status)
        VALUES ($1, $2, $3, 'ri_faculty', $4, $5, $6, 'active')
        ON CONFLICT (email) DO UPDATE SET
          name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
          phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
          department = COALESCE(NULLIF(EXCLUDED.department, ''), users.department),
          designation = COALESCE(NULLIF(EXCLUDED.designation, ''), users.designation)
        RETURNING id
      `, [
        name ? name.trim() : (existing.name || 'Faculty Mentor'),
        lowerEmail,
        defaultPasswordHash,
        department?.trim() || existing.department || null,
        designation?.trim() || existing.designation || null,
        contactPhone?.trim() || existing.phone || null
      ]);
      facultyUserId = newUserRes.rows[0]?.id || null;
      if (!facultyUserId) {
        const fetchUser = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [lowerEmail]);
        facultyUserId = fetchUser.rows[0]?.id || null;
      }
    }

    // 2. Prevent duplicate assignments for the same faculty, batch, and panel combination
    if (targetPanelId) {
      const dupCheck = await client.query(`
        SELECT id, name FROM ri_batch_faculty
        WHERE ri_batch_id = $1
          AND ri_panel_id = $2
          AND id <> $3
          AND (
            (faculty_id IS NOT NULL AND faculty_id = $4)
            OR (email IS NOT NULL AND LOWER(email) = $5)
          )
          AND status <> 'deleted'
        LIMIT 1
      `, [targetBatchId, targetPanelId, facultyId, facultyUserId, lowerEmail]);

      if (dupCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Faculty member with email "${lowerEmail}" is already assigned to this panel in this batch.`
        });
      }
    }

    // 3. Update the specific ri_batch_faculty record
    const updateRes = await client.query(`
      UPDATE ri_batch_faculty SET
        ri_panel_id = $1,
        faculty_id = $2,
        name = COALESCE($3, name),
        email = $4,
        phone = COALESCE($5, phone),
        department = COALESCE($6, department),
        designation = COALESCE($7, designation),
        employee_id = COALESCE($8, employee_id),
        role = COALESCE($9, role),
        status = COALESCE($10, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [
      targetPanelId,
      facultyUserId,
      name ? name.trim() : existing.name,
      lowerEmail,
      contactPhone !== undefined ? (contactPhone ? contactPhone.trim() : null) : existing.phone,
      department !== undefined ? (department ? department.trim() : null) : existing.department,
      designation !== undefined ? (designation ? designation.trim() : null) : existing.designation,
      employee_id !== undefined ? (employee_id ? employee_id.trim() : null) : existing.employee_id,
      role !== undefined ? role : existing.role,
      status !== undefined ? status : existing.status,
      facultyId
    ]);

    // 4. If the SAME faculty member's canonical email was updated (renamed), propagate to their other panel assignments
    const isSameFacultyRenamed = existing.faculty_id && existing.faculty_id === facultyUserId && lowerEmail !== oldEmail;
    if (isSameFacultyRenamed) {
      await client.query(`
        UPDATE ri_batch_faculty SET
          email = $1
        WHERE faculty_id = $2 AND id <> $3
      `, [lowerEmail, facultyUserId, facultyId]);

      await client.query(`
        UPDATE ri_evaluations SET
          evaluator_faculty_email = $1
        WHERE evaluator_faculty_id = $2
      `, [lowerEmail, facultyUserId]);

      await client.query(`
        UPDATE ri_attendance SET
          marked_by_email = $1
        WHERE marked_by_email = $2
      `, [lowerEmail, oldEmail]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Faculty mentor updated successfully.',
      faculty: updateRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(400).json({
        message: 'This faculty member is already assigned to this panel in this batch.'
      });
    }
    console.error('Error updating faculty mentor:', err);
    res.status(500).json({ message: 'Failed to update faculty mentor', error: err.message });
  } finally {
    client.release();
  }
};

// ─── 14. Delete Single Faculty Mentor ───────────────────────────────────────
const deleteBatchFaculty = async (req, res) => {
  const { facultyId } = req.params;
  try {
    const delRes = await pool.query(
      `DELETE FROM ri_batch_faculty WHERE id = $1 RETURNING *`,
      [facultyId]
    );
    if (delRes.rowCount === 0) {
      return res.status(404).json({ message: 'Faculty record not found' });
    }
    res.json({ message: 'Faculty mentor removed from panel successfully.' });
  } catch (err) {
    console.error('Error deleting faculty mentor:', err);
    res.status(500).json({ message: 'Failed to delete faculty mentor', error: err.message });
  }
};

// ─── 15. RI Admin / Super Admin Reporting Endpoints ─────────────────────────

const getAdminAttendanceReport = async (req, res) => {
  try {
    const { batch_id, panel_id, village_id, search, format } = req.query;
    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        u.division,
        rb.id as batch_id,
        rb.name as batch_name,
        rp.id as panel_id,
        rp.panel_number,
        rp.name as panel_name,
        v.id as village_id,
        v.name as village_name,
        (SELECT name FROM ri_batch_faculty rbf WHERE rbf.ri_panel_id = rp.id AND rbf.ri_batch_id = rb.id AND rbf.status <> 'deleted' LIMIT 1) as faculty_mentor,
        a1.status as school_activity_status,
        a1.date as school_activity_date,
        a1.created_at as school_activity_time,
        a1.marked_by_email as school_activity_marked_by,
        a2.status as institutional_visit_status,
        a2.date as institutional_visit_date,
        a2.created_at as institutional_visit_time,
        a2.marked_by_email as institutional_visit_marked_by,
        a3.status as family_survey_status,
        a3.date as family_survey_date,
        a3.created_at as family_survey_time,
        a3.marked_by_email as family_survey_marked_by,
        a4.status as community_project_status,
        a4.date as community_project_date,
        a4.created_at as community_project_time,
        a4.marked_by_email as community_project_marked_by
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_batch_id = rb.id AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_batch_id = rb.id AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_batch_id = rb.id AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_batch_id = rb.id AND a4.activity = 'COMMUNITY_PROJECT'
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }
    if (panel_id) {
      params.push(parseInt(panel_id, 10));
      query += ` AND rp.id = $${params.length}`;
    }
    if (village_id) {
      params.push(parseInt(village_id, 10));
      query += ` AND (rp.ri_village_id = $${params.length} OR v.id = $${params.length})`;
    }
    if (search) {
      params.push(`%${search.toLowerCase().trim()}%`);
      query += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.prn) LIKE $${params.length})`;
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC, u.roll_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    if (format === 'excel') {
      const { createAttendanceWorkbook } = require('../utils/riExcelExport');
      const summaryRows = result.rows.map((s, idx) => {
        const a1 = s.school_activity_status || 'Unmarked';
        const a2 = s.institutional_visit_status || 'Unmarked';
        const a3 = s.family_survey_status || 'Unmarked';
        const a4 = s.community_project_status || 'Unmarked';
        const pDays = (a1 === 'Present' ? 1 : 0) + (a2 === 'Present' ? 1 : 0) + (a3 === 'Present' ? 1 : 0) + (a4 === 'Present' ? 1 : 0);
        return {
          'Sr. No.': idx + 1,
          'PRN': String(s.prn || ''),
          'Roll / RI ID': s.ri_id || '',
          'Student Name': s.student_name,
          'Department': s.department || '',
          'Division': s.division || '',
          'Batch': s.batch_name,
          'Panel': `P${s.panel_number}: ${s.panel_name}`,
          'Village': s.village_name || 'Not Allocated',
          'Faculty Mentor': s.faculty_mentor || 'Unassigned',
          'School Activity': a1,
          'Institutional Visit': a2,
          'Family Visit': a3,
          'Community Project': a4,
          'Total Present': pDays,
          'Attendance %': `${Math.round((pDays / 4) * 100)}%`,
          'Status': pDays === 4 ? 'Complete (100%)' : (pDays > 0 ? `Partial (${Math.round((pDays / 4) * 100)}%)` : 'Absent (0%)')
        };
      });

      const formatDateTime = (dateVal, tsVal) => {
        if (!dateVal && !tsVal) return '-';
        const dStr = dateVal ? String(dateVal).split('T')[0] : '';
        const tStr = tsVal ? new Date(tsVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        if (dStr && tStr) return `${dStr} ${tStr}`;
        if (dStr) return dStr;
        return tsVal ? new Date(tsVal).toLocaleString() : '-';
      };

      const createActivitySheetRows = (statusKey, dateKey, timeKey, markedByKey, actLabel) => {
        return result.rows.map((s, idx) => ({
          'Sr. No.': idx + 1,
          'PRN': String(s.prn || ''),
          'Roll / RI ID': s.ri_id || '',
          'Student Name': s.student_name,
          'Department': s.department || '',
          'Division': s.division || '',
          'Batch': s.batch_name,
          'Panel': `P${s.panel_number}: ${s.panel_name}`,
          'Village': s.village_name || 'Not Allocated',
          [`${actLabel} Status`]: s[statusKey] || 'Unmarked',
          'Date / Time': formatDateTime(s[dateKey], s[timeKey]),
          'Marked By': s[markedByKey] || '-'
        }));
      };

      const schoolActivityRows = createActivitySheetRows('school_activity_status', 'school_activity_date', 'school_activity_time', 'school_activity_marked_by', 'School Activity');
      const institutionalVisitRows = createActivitySheetRows('institutional_visit_status', 'institutional_visit_date', 'institutional_visit_time', 'institutional_visit_marked_by', 'Institutional Visit');
      const familySurveyRows = createActivitySheetRows('family_survey_status', 'family_survey_date', 'family_survey_time', 'family_survey_marked_by', 'Family Visit');
      const communityProjectRows = createActivitySheetRows('community_project_status', 'community_project_date', 'community_project_time', 'community_project_marked_by', 'Community Project');

      const cleanName = (val) => String(val || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      let filename = 'RI_Attendance_Report.xlsx';
      if (result.rows.length > 0) {
        const first = result.rows[0];
        if (panel_id) {
          filename = `RI_Attendance_${cleanName(first.batch_name)}_Panel_${first.panel_number || panel_id}.xlsx`;
        } else if (village_id) {
          filename = `RI_Attendance_${cleanName(first.batch_name)}_Village_${cleanName(first.village_name || village_id)}.xlsx`;
        } else if (batch_id) {
          filename = `RI_Attendance_${cleanName(first.batch_name)}_Complete.xlsx`;
        }
      }

      const buffer = createAttendanceWorkbook({
        batchName: result.rows[0]?.batch_name || 'RI_Batch',
        panelName: panel_id ? (result.rows[0]?.panel_name || 'Panel') : 'All_Panels',
        summaryRows,
        schoolActivityRows,
        institutionalVisitRows,
        familySurveyRows,
        communityProjectRows
      });

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({
      success: true,
      total_records: result.rowCount,
      records: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin attendance report:', err);
    res.status(500).json({ message: 'Failed to fetch attendance report', error: err.message });
  }
};

const getAdminStudentFormsReport = async (req, res) => {
  try {
    const { batch_id, panel_id, form_type, status, format } = req.query;
    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        u.department,
        rb.name as batch_name,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name,
        sf.form_type,
        sf.status,
        sf.submission_timestamp,
        sf.last_updated_at,
        sf.reviewed_at,
        sf.faculty_remarks,
        sf.correction_notes,
        fac.name as reviewed_by_name
      FROM ri_student_forms sf
      JOIN users u ON sf.student_id = u.id
      JOIN ri_batches rb ON sf.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON sf.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON sf.ri_village_id = v.id
      LEFT JOIN users fac ON sf.reviewed_by_faculty_id = fac.id
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }
    if (panel_id) {
      params.push(parseInt(panel_id, 10));
      query += ` AND rp.id = $${params.length}`;
    }
    if (form_type) {
      params.push(form_type);
      query += ` AND sf.form_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND sf.status = $${params.length}`;
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC, u.name ASC, sf.submission_timestamp DESC NULLS LAST`;

    const result = await pool.query(query, params);

    if (format === 'excel') {
      const { createFormsWorkbook } = require('../utils/riExcelExport');
      const responsesRows = result.rows.map((r, idx) => ({
        'Sr. No.': idx + 1,
        'PRN': String(r.prn || ''),
        'Student Name': r.student_name,
        'Batch': r.batch_name,
        'Panel': `P${r.panel_number || ''}: ${r.panel_name || ''}`,
        'Village': r.village_name || '',
        'Form Type': r.form_type,
        'Status': r.status,
        'Submitted Date': r.submission_timestamp ? String(r.submission_timestamp).split('T')[0] : '-',
        'Reviewed Date': r.reviewed_at ? String(r.reviewed_at).split('T')[0] : '-',
        'Reviewer': r.reviewed_by_name || '-',
        'Faculty Remarks': r.faculty_remarks || '-',
        'Correction Notes': r.correction_notes || '-'
      }));

      const summaryRows = responsesRows;
      const pendingRows = responsesRows.filter(r => r.Status !== 'Submitted' && r.Status !== 'Reviewed');

      const buffer = createFormsWorkbook({ summaryRows, responsesRows, pendingRows });
      res.setHeader('Content-Disposition', 'attachment; filename="RI_Master_Student_Forms_Report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({
      success: true,
      total_records: result.rowCount,
      records: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin forms report:', err);
    res.status(500).json({ message: 'Failed to fetch forms report', error: err.message });
  }
};

const getAdminEvaluationReport = async (req, res) => {
  try {
    const { batch_id, panel_id, evaluation_status, format } = req.query;
    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        u.department,
        rb.name as batch_name,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name,
        fac.name as evaluator_name,
        e.*
      FROM ri_evaluations e
      JOIN users u ON e.student_id = u.id
      JOIN ri_batches rb ON e.ri_batch_id = rb.id
      JOIN ri_panels rp ON e.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN users fac ON e.evaluator_faculty_id = fac.id
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }
    if (panel_id) {
      params.push(parseInt(panel_id, 10));
      query += ` AND rp.id = $${params.length}`;
    }
    if (evaluation_status) {
      params.push(evaluation_status);
      query += ` AND e.evaluation_status = $${params.length}`;
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    if (format === 'excel') {
      const { createEvaluationWorkbook } = require('../utils/riExcelExport');
      const summaryRows = result.rows.map((s, idx) => ({
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Batch': s.batch_name,
        'Panel': `P${s.panel_number}: ${s.panel_name}`,
        'Village': s.village_name || '',
        'Evaluator': s.evaluator_name || 'Pending',
        'Attendance (15%)': Number(s.attendance_marks || 0).toFixed(2),
        'Institutional Visits (10%)': Number(s.institutional_visit_marks || 0).toFixed(2),
        'Family Visit (10%)': Number(s.family_survey_marks || 0).toFixed(2),
        'Community Projects (10%)': Number(s.community_project_marks || 0).toFixed(2),
        'Problem Statement & SDGs (15%)': Number(s.problem_statement_marks || 0).toFixed(2),
        'Proposed Smart Solution (40%)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
        'Total Marks (100)': Number(s.total_marks || 0).toFixed(2),
        'Overall Grade': s.overall_grade || 'Pending',
        'Status': s.evaluation_status || 'Pending'
      }));

      const criterionRows = result.rows.map((s, idx) => ({
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Attendance (15 Marks)': Number(s.attendance_marks || 0).toFixed(2),
        'Institutional Visit (10 Marks)': Number(s.institutional_visit_marks || 0).toFixed(2),
        'Family Visit (10 Marks)': Number(s.family_survey_marks || 0).toFixed(2),
        'Community Project (10 Marks)': Number(s.community_project_marks || 0).toFixed(2),
        'Problem Statement Identification & SDGs (15 Marks)': Number(s.problem_statement_marks || 0).toFixed(2),
        'Proposed SMART Solution (40 Marks)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
        'Total Marks (100)': Number(s.total_marks || 0).toFixed(2)
      }));

      const remarksRows = result.rows.map((s, idx) => ({
        'Sr. No.': idx + 1,
        'PRN': String(s.prn || ''),
        'Student Name': s.student_name,
        'Evaluator': s.evaluator_name || '-',
        'Status': s.evaluation_status || 'Pending',
        'Faculty Remarks': s.faculty_remarks || 'None',
        'Correction Notes': s.correction_request_message || 'None'
      }));

      const buffer = createEvaluationWorkbook({ summaryRows, criterionRows, remarksRows });
      res.setHeader('Content-Disposition', 'attachment; filename="RI_Master_Evaluation_Report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({
      success: true,
      total_records: result.rowCount,
      records: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin evaluation report:', err);
    res.status(500).json({ message: 'Failed to fetch evaluation report', error: err.message });
  }
};

const getAdminFamilySurveyReport = async (req, res) => {
  try {
    const { batch_id, panel_id, format } = req.query;
    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        u.department,
        rb.name as batch_name,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name,
        f.*
      FROM ri_family_surveys f
      JOIN users u ON f.student_id = u.id
      JOIN ri_batches rb ON f.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON f.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }
    if (panel_id) {
      params.push(parseInt(panel_id, 10));
      query += ` AND rp.id = $${params.length}`;
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC, u.name ASC, f.family_serial_number ASC`;

    const result = await pool.query(query, params);

    if (format === 'excel') {
      const { createFamilySurveyWorkbook } = require('../utils/riExcelExport');
      const detailRows = result.rows.map((f, idx) => ({
        'Sr. No.': idx + 1,
        'Student PRN': String(f.prn || ''),
        'Student Name': f.student_name,
        'Batch': f.batch_name,
        'Panel': cleanPanelName(f.panel_name),
        'Village': f.village_name || '',
        'Family Sr.': f.family_serial_number,
        'Head of Family': f.head_of_family_name,
        'Total Members': f.total_family_members,
        'Male': f.male_members,
        'Female': f.female_members,
        'House Type': f.house_type,
        'Ownership': f.house_ownership,
        'Electricity': f.electricity_available ? 'Yes' : 'No',
        'Mobile Level': f.mobile_phones_level,
        'Agricultural Land': f.agricultural_land,
        'Primary Crop': f.primary_crop,
        'Animals Count': f.animals_count_bracket,
        'Dal Frequency': f.diet_dal_frequency,
        'Green Veg Frequency': f.diet_green_veg_frequency,
        'Fruits Frequency': f.diet_fruits_frequency,
        'Occupation': f.primary_business_occupation || 'None',
        'Loan Taken': f.loan_taken ? 'Yes' : 'No',
        'Loan Source': f.loan_source,
        'Cooking Fuel': f.cooking_fuel,
        'Ujjwala Gas': f.gas_connection_source,
        'Soil Health Card': f.soil_health_card_status,
        'Problems Identified': f.family_specific_problems || 'None'
      }));

      const summaryRows = detailRows;
      const buffer = createFamilySurveyWorkbook({ summaryRows, detailRows });
      res.setHeader('Content-Disposition', 'attachment; filename="RI_Master_Family_Survey_Report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({
      success: true,
      total_records: result.rowCount,
      records: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin family survey report:', err);
    res.status(500).json({ message: 'Failed to fetch family survey report', error: err.message });
  }
};

const getAdminOverallAssessmentReport = async (req, res) => {
  try {
    const { batch_id, panel_id, format } = req.query;
    let query = `
      SELECT 
        u.id as student_id,
        u.name as student_name,
        u.prn,
        COALESCE(rbs.ri_id, u.roll_number, '') as ri_id,
        u.department,
        rb.name as batch_name,
        rp.panel_number,
        rp.name as panel_name,
        v.name as village_name,
        a1.status as school_activity_status,
        a2.status as institutional_visit_status,
        a3.status as family_survey_status,
        a4.status as community_project_status,
        e.attendance_marks,
        e.institutional_visit_marks,
        e.family_survey_marks,
        e.community_project_marks,
        e.problem_solution_marks,
        e.team_collaboration_marks,
        e.total_marks,
        e.overall_grade,
        e.evaluation_status
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_attendance a1 ON a1.student_id = u.id AND a1.ri_batch_id = rb.id AND a1.activity = 'SCHOOL_ACTIVITY'
      LEFT JOIN ri_attendance a2 ON a2.student_id = u.id AND a2.ri_batch_id = rb.id AND a2.activity = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_attendance a3 ON a3.student_id = u.id AND a3.ri_batch_id = rb.id AND a3.activity = 'FAMILY_SURVEY'
      LEFT JOIN ri_attendance a4 ON a4.student_id = u.id AND a4.ri_batch_id = rb.id AND a4.activity = 'COMMUNITY_PROJECT'
      LEFT JOIN ri_evaluations e ON e.student_id = u.id AND e.ri_batch_id = rb.id
      WHERE rb.status <> 'deleted'
    `;

    const params = [];
    if (batch_id) {
      params.push(parseInt(batch_id, 10));
      query += ` AND rb.id = $${params.length}`;
    }
    if (panel_id) {
      params.push(parseInt(panel_id, 10));
      query += ` AND rp.id = $${params.length}`;
    }

    query += ` ORDER BY rb.id DESC, rp.panel_number ASC, u.roll_number ASC, u.name ASC`;

    const result = await pool.query(query, params);

    if (format === 'excel') {
      const { createOverallAssessmentWorkbook } = require('../utils/riExcelExport');
      const rows = result.rows.map((s, idx) => {
        const tot = Number(s.total_marks || 0);
        const isPass = tot >= 40;
        return {
          'Sr. No.': idx + 1,
          'PRN': String(s.prn || ''),
          'Student Name': s.student_name,
          'Roll / RI ID': s.ri_id,
          'Department': s.department || '',
          'Batch': s.batch_name,
          'Panel': cleanPanelName(s.panel_name),
          'Village': s.village_name || 'Not Allocated',
          'School Activity Attendance': s.school_activity_status || 'Absent',
          'Institutional Visit Attendance': s.institutional_visit_status || 'Absent',
          'Family Visit Attendance': s.family_survey_status || 'Absent',
          'Community Project Attendance': s.community_project_status || 'Absent',
          'Attendance Marks (15%)': Number(s.attendance_marks || 0).toFixed(2),
          'Institutional Visits (10%)': Number(s.institutional_visit_marks || 0).toFixed(2),
          'Family Visit (10%)': Number(s.family_survey_marks || 0).toFixed(2),
          'Community Projects (10%)': Number(s.community_project_marks || 0).toFixed(2),
          'Problem Statement & SDGs (15%)': Number(s.problem_statement_marks || 0).toFixed(2),
          'Proposed Smart Solution (40%)': Number(s.smart_solution_marks || s.problem_solution_marks || 0).toFixed(2),
          'Total Marks (100)': tot.toFixed(2),
          'Overall Grade': s.overall_grade || 'Pending',
          'Result': tot > 0 ? (isPass ? 'PASS' : 'FAIL') : 'Pending',
          'Credit Recommendation': tot >= 40 ? 'Recommended for 1 Credit Point' : 'Not Recommended',
          'Evaluation Status': s.evaluation_status || 'Pending'
        };
      });

      const buffer = createOverallAssessmentWorkbook({ rows });
      res.setHeader('Content-Disposition', 'attachment; filename="RI_Master_Overall_Assessment_Report.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    res.json({
      success: true,
      total_records: result.rowCount,
      records: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin overall assessment report:', err);
    res.status(500).json({ message: 'Failed to fetch assessment report', error: err.message });
  }
};

const getAdminAuditLogs = async (req, res) => {
  try {
    // Keep ri_audit_logs strictly pruned to latest 100 entries
    await pool.query(`
      DELETE FROM ri_audit_logs 
      WHERE id NOT IN (
        SELECT id FROM ri_audit_logs 
        ORDER BY created_at DESC, id DESC 
        LIMIT 100
      )
    `).catch(err => console.error('[RI Audit Prune Error]', err.message));

    const { action, student_id, batch_id, panel_id, user_role, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE 1=1";
    const params = [];
    let paramIdx = 1;

    if (action) {
      whereClause += ` AND l.action = $${paramIdx}`;
      params.push(action);
      paramIdx++;
    }
    if (student_id) {
      whereClause += ` AND l.student_id = $${paramIdx}`;
      params.push(parseInt(student_id, 10));
      paramIdx++;
    }
    if (batch_id) {
      whereClause += ` AND l.ri_batch_id = $${paramIdx}`;
      params.push(parseInt(batch_id, 10));
      paramIdx++;
    }
    if (panel_id) {
      whereClause += ` AND l.ri_panel_id = $${paramIdx}`;
      params.push(parseInt(panel_id, 10));
      paramIdx++;
    }
    if (user_role) {
      const ur = user_role.toLowerCase();
      if (ur === 'faculty' || ur === 'ri_faculty') {
        whereClause += ` AND (l.user_role = 'faculty' OR l.user_role = 'ri_faculty')`;
      } else if (ur === 'student' || ur === 'ri_student') {
        whereClause += ` AND (l.user_role = 'student' OR l.user_role = 'ri_student')`;
      } else if (ur === 'ri_admin' || ur === 'admin') {
        whereClause += ` AND (l.user_role = 'ri_admin' OR l.user_role = 'admin')`;
      } else if (ur === 'superadmin-ri' || ur === 'superadmin') {
        whereClause += ` AND (l.user_role = 'superadmin-ri' OR l.user_role = 'superadmin_ri_readonly' OR l.user_role = 'superadmin-ri-readonly' OR l.user_role = 'superadmin')`;
      } else if (ur.includes('nodal')) {
        whereClause += ` AND (l.user_role = 'nodal_officer' OR l.user_role = 'ri_nodal_officer')`;
      } else {
        whereClause += ` AND l.user_role = $${paramIdx}`;
        params.push(user_role);
        paramIdx++;
      }
    }
    if (search) {
      whereClause += ` AND (
        l.user_name ILIKE $${paramIdx} OR 
        l.user_email ILIKE $${paramIdx} OR 
        l.action ILIKE $${paramIdx} OR 
        l.details::text ILIKE $${paramIdx} OR
        rb.name ILIKE $${paramIdx} OR
        rb.batch_code ILIKE $${paramIdx} OR
        rp.name ILIKE $${paramIdx} OR
        rp.panel_number ILIKE $${paramIdx}
      )`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Total count
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM ri_audit_logs l
      LEFT JOIN ri_batches rb ON l.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON l.ri_panel_id = rp.id
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    // Data query with batch and panel labels
    const dataQuery = `
      SELECT 
        l.id,
        l.user_id,
        l.user_email,
        l.user_name,
        l.user_role,
        l.action,
        l.student_id,
        l.ri_batch_id,
        l.ri_panel_id,
        l.record_id,
        l.details,
        l.ip_address,
        l.created_at,
        rb.name AS batch_name,
        rb.batch_code,
        rp.name AS panel_name,
        rp.panel_number
      FROM ri_audit_logs l
      LEFT JOIN ri_batches rb ON l.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON l.ri_panel_id = rp.id
      ${whereClause}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    const logsRes = await pool.query(dataQuery, [...params, limitNum, offset]);

    res.json({
      success: true,
      logs: logsRes.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ message: 'Failed to fetch audit logs', error: err.message });
  }
};

const getBatchNodalOfficers = async (req, res) => {
  const { id } = req.params;
  try {
    const batchRes = await pool.query(
      `SELECT id, name, batch_code FROM ri_batches WHERE id = $1 OR source_batch_id = $1 LIMIT 1`,
      [id]
    );
    if (batchRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Batch not found' });
    }
    const batch = batchRes.rows[0];

    const result = await pool.query(`
      SELECT 
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        rp.school,
        rp.department,
        COALESCE(rp.nodal_officer_name, '') AS nodal_officer_name,
        COALESCE(rp.nodal_officer_email, '') AS nodal_officer_email,
        rp.coordinator_name,
        rp.class_teacher_name,
        COALESCE(rp.google_maps_link, v.google_maps_link, '') AS google_maps_link,
        v.id AS village_id,
        v.name AS village_name,
        v.district AS village_district,
        v.taluka AS village_taluka,
        v.district AS district,
        v.taluka AS taluka,
        v.location AS village_location,
        COALESCE(NULLIF(COUNT(rbs.id)::int, 0), rp.student_count, 0) AS student_count
      FROM ri_panels rp
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_batch_students rbs ON rbs.ri_panel_id = rp.id
      WHERE rp.ri_batch_id = $1
      GROUP BY rp.id, v.id
      ORDER BY rp.panel_number ASC
    `, [batch.id]);

    res.json({
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
        batch_code: batch.batch_code
      },
      nodal_officers: result.rows
    });
  } catch (err) {
    console.error('Error fetching batch nodal officers:', err);
    res.status(500).json({ message: 'Failed to fetch nodal officers', error: err.message });
  }
};

/**
 * 23. Get Admin Student Submissions (Student-wise RI Form Submissions & Undertaking Status)
 * Read-only tracking endpoint for RI Admin Submissions page.
 * Reuses canonical LTC undertaking data from users table.
 */
const getAdminSubmissions = async (req, res) => {
  try {
    const { batch_id, panel_id, search, status } = req.query;

    // Resolve target RI batch ID
    let batchId = batch_id ? parseInt(batch_id, 10) : null;
    if (!batchId) {
      const bRes = await pool.query(
        `SELECT id FROM ri_batches WHERE status <> 'deleted' ORDER BY status = 'active' DESC, id DESC LIMIT 1`
      );
      if (bRes.rowCount > 0) {
        batchId = bRes.rows[0].id;
      }
    }

    if (!batchId) {
      return res.json({
        success: true,
        summary: {
          total_students: 0,
          undertakings_submitted: 0,
          undertakings_pending: 0,
          total_forms_possible: 0,
          total_forms_submitted: 0,
          total_forms_pending: 0,
          all_submitted_students: 0,
          pending_students: 0
        },
        students: []
      });
    }

    const conditions = ['rb.status <> \'deleted\'', 'rbs.ri_batch_id = $1'];
    const params = [batchId];

    if (panel_id && panel_id !== 'All' && panel_id !== 'all') {
      params.push(parseInt(panel_id, 10));
      conditions.push(`rbs.ri_panel_id = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(
        LOWER(u.name) LIKE $${params.length} OR 
        LOWER(u.email) LIKE $${params.length} OR 
        LOWER(COALESCE(u.prn, '')) LIKE $${params.length} OR
        LOWER(COALESCE(rbs.ri_id, '')) LIKE $${params.length}
      )`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        COALESCE(u.prn, '') AS prn,
        u.email,
        rbs.ri_id,
        rb.id AS batch_id,
        rb.name AS batch_name,
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        COALESCE(v.name, 'Not Assigned') AS village_name,
        
        -- Form IA / Annex E: Student Undertaking (canonical LTC undertaking from users / ri_undertakings)
        (u.undertaking_submitted = true OR ru.id IS NOT NULL) AS undertaking_submitted,
        u.undertaking_signed_name,
        u.undertaking_signed_date,

        -- Form IIIB: Daily Activity Report (Annex G-5)
        COALESCE(
          sf_iiib.status,
          (SELECT status FROM ri_daily_activity_reports WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id ORDER BY id DESC LIMIT 1),
          'Not Started'
        ) AS form_iiib_status,
        sf_iiib.submission_timestamp AS form_iiib_submitted_at,

        -- Form IV: Institutional Visit (Annex G-6)
        COALESCE(
          sf_iv.status,
          (SELECT status FROM ri_institutional_visits WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id ORDER BY id DESC LIMIT 1),
          CASE WHEN EXISTS (SELECT 1 FROM ri_institutional_visits WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id) THEN 'Submitted' ELSE 'Not Started' END
        ) AS form_iv_status,
        sf_iv.submission_timestamp AS form_iv_submitted_at,

        -- Form V: Family Visit (Annex G-7)
        COALESCE(
          sf_v.status,
          (SELECT status FROM ri_family_surveys WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id ORDER BY id DESC LIMIT 1),
          CASE WHEN EXISTS (SELECT 1 FROM ri_family_surveys WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id) THEN 'Submitted' ELSE 'Not Started' END
        ) AS form_v_status,
        sf_v.submission_timestamp AS form_v_submitted_at,

        -- Form VI: Problem Statement & Solution (Annex G-8 & H)
        COALESCE(
          sf_vi.status,
          (SELECT status FROM ri_problem_identifications WHERE student_id = u.id AND ri_batch_id = rbs.ri_batch_id ORDER BY id DESC LIMIT 1),
          'Not Started'
        ) AS form_vi_status,
        sf_vi.submission_timestamp AS form_vi_submitted_at

      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_undertakings ru ON ru.student_id = u.id AND (ru.status = 'Submitted' OR ru.id IS NOT NULL)
      LEFT JOIN ri_student_forms sf_iiib ON sf_iiib.student_id = u.id AND sf_iiib.ri_batch_id = rbs.ri_batch_id AND sf_iiib.form_type = 'DAILY_ACTIVITY_REPORT'
      LEFT JOIN ri_student_forms sf_iv ON sf_iv.student_id = u.id AND sf_iv.ri_batch_id = rbs.ri_batch_id AND sf_iv.form_type = 'INSTITUTIONAL_VISIT'
      LEFT JOIN ri_student_forms sf_v ON sf_v.student_id = u.id AND sf_v.ri_batch_id = rbs.ri_batch_id AND sf_v.form_type = 'FAMILY_SURVEY'
      LEFT JOIN ri_student_forms sf_vi ON sf_vi.student_id = u.id AND sf_vi.ri_batch_id = rbs.ri_batch_id AND sf_vi.form_type = 'PROBLEM_IDENTIFICATION'
      ${whereClause}
      ORDER BY rp.panel_number ASC NULLS LAST, u.name ASC
    `;

    const result = await pool.query(query, params);

    // Process students & calculate statuses
    const allStudents = result.rows.map(row => {
      const undertakingSubmitted = Boolean(row.undertaking_submitted);
      
      const isFormSubmitted = (st) => st === 'Submitted' || st === 'Reviewed';
      const isFormDraft = (st) => st === 'Draft';

      const iiibSubmitted = isFormSubmitted(row.form_iiib_status);
      const formIVSubmitted = isFormSubmitted(row.form_iv_status);
      const formVSubmitted = isFormSubmitted(row.form_v_status);
      const formVISubmitted = isFormSubmitted(row.form_vi_status);

      // Total forms count out of 5:
      // 1. Undertaking (Annex E)
      // 2. Form IIIB (Daily Activity & School Activity)
      // 3. Form IV (Institutional Visit)
      // 4. Form V (Family Visit)
      // 5. Form VI (Problem Identification & Solution)
      let submittedCount = 0;
      if (undertakingSubmitted) submittedCount++;
      if (iiibSubmitted) submittedCount++;
      if (formIVSubmitted) submittedCount++;
      if (formVSubmitted) submittedCount++;
      if (formVISubmitted) submittedCount++;

      const hasAnySubmitted = submittedCount > 0;
      const hasAnyPending = submittedCount < 5;
      const allSubmitted = submittedCount === 5;

      return {
        student_id: row.student_id,
        student_name: row.student_name,
        prn: row.prn,
        email: row.email,
        ri_id: row.ri_id,
        batch_id: row.batch_id,
        batch_name: row.batch_name,
        panel_id: row.panel_id,
        panel_number: row.panel_number,
        panel_name: row.panel_name ? `Panel ${row.panel_number || ''}: ${row.panel_name}` : `Panel ${row.panel_number || '—'}`,
        village_name: row.village_name,
        submission_status: {
          undertakingSubmitted,
          iiibSubmitted,
          formIVSubmitted,
          formVSubmitted,
          formVISubmitted,
          submittedFormsCount: submittedCount,
          hasAnySubmitted,
          hasAnyPending,
          allSubmitted
        },
        forms: {
          undertaking: {
            title: 'FORM IA / ANNEX E – Student Undertaking',
            status: undertakingSubmitted ? 'Submitted' : 'Not Submitted',
            is_submitted: undertakingSubmitted,
            signed_name: row.undertaking_signed_name || (undertakingSubmitted ? row.student_name : null),
            signed_date: row.undertaking_signed_date
          },
          daily_activity: {
            title: 'FORM – IIIB: DAILY ACTIVITY REPORT and SCHOOL ACTIVITY',
            status: iiibSubmitted ? 'Submitted' : (isFormDraft(row.form_iiib_status) ? 'In Draft' : 'Not Submitted'),
            is_submitted: iiibSubmitted,
            is_draft: isFormDraft(row.form_iiib_status),
            submitted_at: row.form_iiib_submitted_at
          },
          institutional: {
            title: 'Institutional Visit Observations Recording Form (Form IV)',
            status: formIVSubmitted ? 'Submitted' : (isFormDraft(row.form_iv_status) ? 'In Draft' : 'Not Submitted'),
            is_submitted: formIVSubmitted,
            is_draft: isFormDraft(row.form_iv_status),
            submitted_at: row.form_iv_submitted_at
          },
          family: {
            title: 'Family Visit Observations Recording Form (Form V)',
            status: formVSubmitted ? 'Submitted' : (isFormDraft(row.form_v_status) ? 'In Draft' : 'Not Submitted'),
            is_submitted: formVSubmitted,
            is_draft: isFormDraft(row.form_v_status),
            submitted_at: row.form_v_submitted_at
          },
          problem: {
            title: 'Problem / Issue Identification and Developing Solution (Form VI)',
            status: formVISubmitted ? 'Submitted' : (isFormDraft(row.form_vi_status) ? 'In Draft' : 'Not Submitted'),
            is_submitted: formVISubmitted,
            is_draft: isFormDraft(row.form_vi_status),
            submitted_at: row.form_vi_submitted_at
          }
        },
        submitted_forms_count: submittedCount,
        total_forms_count: 5,
        overall_status: allSubmitted ? 'Submitted' : (hasAnySubmitted ? 'Pending' : 'Not Submitted')
      };
    });

    // Summary calculation across all students in the selected batch/panel scope
    const totalStudents = allStudents.length;

    // 1. Undertaking (Annex E / Form IA)
    const undertakingSubmitted = allStudents.filter(s => s.submission_status.undertakingSubmitted).length;
    const undertakingPending = totalStudents - undertakingSubmitted;

    // 2. Form IIIB (Daily Activity & School Activity)
    const dailyActivitySubmitted = allStudents.filter(s => s.submission_status.iiibSubmitted).length;
    const dailyActivityPending = totalStudents - dailyActivitySubmitted;

    // 3. Form IV (Institutional Visit)
    const institutionalSubmitted = allStudents.filter(s => s.submission_status.formIVSubmitted).length;
    const institutionalPending = totalStudents - institutionalSubmitted;

    // 4. Form V (Family Visit)
    const familySubmitted = allStudents.filter(s => s.submission_status.formVSubmitted).length;
    const familyPending = totalStudents - familySubmitted;

    // 5. Form VI (Problem Identification & Solution)
    const problemSubmitted = allStudents.filter(s => s.submission_status.formVISubmitted).length;
    const problemPending = totalStudents - problemSubmitted;

    const anySubmittedStudentsCount = allStudents.filter(s => s.submission_status.hasAnySubmitted).length;
    const anyPendingStudentsCount = allStudents.filter(s => s.submission_status.hasAnyPending).length;
    const allSubmittedStudents = allStudents.filter(s => s.submission_status.allSubmitted).length;
    const pendingStudents = totalStudents - allSubmittedStudents;

    // Apply optional status filter:
    // - 'all': all students in scope
    // - 'submitted': students who have at least ONE of the 5 forms submitted
    // - 'pending': students who have at least ONE of the 5 forms not submitted
    let filteredStudents = allStudents;
    if (status) {
      const st = status.toLowerCase();
      if (st === 'submitted') {
        filteredStudents = allStudents.filter(s => s.submission_status.hasAnySubmitted);
      } else if (st === 'pending') {
        filteredStudents = allStudents.filter(s => s.submission_status.hasAnyPending);
      }
    }

    res.json({
      success: true,
      batch_id: batchId,
      summary: {
        total_students: totalStudents,
        undertaking: {
          submitted: undertakingSubmitted,
          pending: undertakingPending
        },
        daily_activity: {
          submitted: dailyActivitySubmitted,
          pending: dailyActivityPending
        },
        institutional: {
          submitted: institutionalSubmitted,
          pending: institutionalPending
        },
        family: {
          submitted: familySubmitted,
          pending: familyPending
        },
        problem: {
          submitted: problemSubmitted,
          pending: problemPending
        },
        undertakings_submitted: undertakingSubmitted,
        undertakings_pending: undertakingPending,
        all_submitted_students: allSubmittedStudents,
        pending_students: pendingStudents
      },
      students: filteredStudents
    });
  } catch (err) {
    console.error('Error fetching admin student submissions:', err);
    res.status(500).json({ message: 'Failed to fetch student submissions', error: err.message });
  }
};

/**
 * 24. Get Full Submission Detail for a Student
 * Read-only modal viewer for RI Admin Submissions page.
 */
const getAdminStudentSubmissionDetail = async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const { batch_id } = req.query || {};

    if (!studentId) {
      return res.status(400).json({ message: 'Invalid Student ID provided.' });
    }

    let batchCondition = '';
    const studentParams = [studentId];
    if (batch_id) {
      studentParams.push(parseInt(batch_id, 10));
      batchCondition = 'AND rbs.ri_batch_id = $2';
    }

    const studentRes = await pool.query(`
      SELECT 
        u.id AS student_id,
        u.name AS student_name,
        u.prn,
        u.email,
        u.phone,
        u.department,
        u.division,
        u.gender,
        u.roll_number,
        rbs.ri_id,
        rb.id AS batch_id,
        rb.name AS batch_name,
        rp.id AS panel_id,
        rp.panel_number,
        rp.name AS panel_name,
        v.id AS village_id,
        v.name AS village_name,
        v.location AS village_location,
        v.district AS village_district,
        v.taluka AS village_taluka,
        v.sarpanch_name,
        v.sarpanch_mobile,
        -- Undertaking fields on users table
        u.undertaking_submitted,
        u.undertaking_signed_name,
        u.undertaking_signed_date,
        u.emergency_contact_name,
        u.emergency_contact_relation,
        u.emergency_contact_mobile,
        u.emergency_contact_alt_mobile,
        u.emergency_contact_email,
        u.blood_group,
        u.medical_conditions,
        u.known_allergies,
        u.current_medication,
        u.dietary_restrictions,
        u.medical_other,
        u.consent_media,
        u.consent_data,
        u.consent_checks,
        u.consent_medical,
        u.age,
        u.school,
        u.school_branch,
        u.class_grade,
        u.address,
        u.parent_name,
        u.parent_relationship,
        u.parent_mobile,
        u.parent_email,
        u.med_allergies,
        u.med_asthma,
        u.med_epilepsy,
        u.med_medication,
        u.med_physical_limitation,
        u.med_dietary_restriction,
        u.med_other,
        u.med_details
      FROM ri_batch_students rbs
      JOIN users u ON rbs.student_id = u.id
      JOIN ri_batches rb ON rbs.ri_batch_id = rb.id
      LEFT JOIN ri_panels rp ON rbs.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      WHERE rbs.student_id = $1 ${batchCondition}
      ORDER BY rb.id DESC
      LIMIT 1
    `, studentParams);

    if (studentRes.rowCount === 0) {
      return res.status(404).json({ message: 'RI Student record not found.' });
    }

    const studentInfo = studentRes.rows[0];
    const targetBatchId = studentInfo.batch_id;

    // 1. Undertaking record (if ri_undertakings has a row)
    const ruRes = await pool.query(
      `SELECT * FROM ri_undertakings WHERE student_id = $1 LIMIT 1`,
      [studentId]
    );

    // 2. Form IIIB: Daily Activity Report
    const darRes = await pool.query(
      `SELECT * FROM ri_daily_activity_reports WHERE student_id = $1 AND ri_batch_id = $2 LIMIT 1`,
      [studentId, targetBatchId]
    );

    // 3. Form IV: Institutional Visits
    const ivRes = await pool.query(
      `SELECT * FROM ri_institutional_visits WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY id ASC`,
      [studentId, targetBatchId]
    );

    // 4. Form V: Family Surveys
    const famRes = await pool.query(
      `SELECT * FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2 ORDER BY family_serial_number ASC`,
      [studentId, targetBatchId]
    );

    // 5. Form VI: Problem Identification & Solution
    const piRes = await pool.query(
      `SELECT * FROM ri_problem_identifications WHERE student_id = $1 AND ri_batch_id = $2 LIMIT 1`,
      [studentId, targetBatchId]
    );

    // Forms tracking records
    const sfRes = await pool.query(
      `SELECT form_type, status, progress_percent, submission_timestamp, last_updated_at, faculty_remarks, correction_notes 
       FROM ri_student_forms 
       WHERE student_id = $1 AND ri_batch_id = $2`,
      [studentId, targetBatchId]
    );

    const isUndertaking = Boolean(studentInfo.undertaking_submitted || ruRes.rowCount > 0);

    return res.json({
      success: true,
      student: studentInfo,
      undertaking: {
        submitted: isUndertaking,
        record: ruRes.rows[0] || null,
        user_undertaking: {
          signed_name: studentInfo.undertaking_signed_name || (isUndertaking ? studentInfo.student_name : ''),
          signed_date: studentInfo.undertaking_signed_date,
          emergency_contact_name: studentInfo.emergency_contact_name,
          emergency_contact_relation: studentInfo.emergency_contact_relation,
          emergency_contact_mobile: studentInfo.emergency_contact_mobile,
          emergency_contact_alt_mobile: studentInfo.emergency_contact_alt_mobile,
          emergency_contact_email: studentInfo.emergency_contact_email,
          blood_group: studentInfo.blood_group,
          medical_conditions: studentInfo.medical_conditions,
          known_allergies: studentInfo.known_allergies,
          current_medication: studentInfo.current_medication,
          dietary_restrictions: studentInfo.dietary_restrictions,
          medical_other: studentInfo.medical_other,
          consent_media: studentInfo.consent_media,
          consent_data: studentInfo.consent_data,
          consent_checks: studentInfo.consent_checks,
          consent_medical: studentInfo.consent_medical,
          age: studentInfo.age,
          school: studentInfo.school,
          school_branch: studentInfo.school_branch,
          class_grade: studentInfo.class_grade,
          address: studentInfo.address,
          parent_name: studentInfo.parent_name || studentInfo.emergency_contact_name,
          parent_relationship: studentInfo.parent_relationship || studentInfo.emergency_contact_relation,
          parent_mobile: studentInfo.parent_mobile || studentInfo.emergency_contact_mobile,
          parent_email: studentInfo.parent_email || studentInfo.emergency_contact_email,
          med_allergies: Boolean(studentInfo.med_allergies || (studentInfo.known_allergies && studentInfo.known_allergies !== 'No' && studentInfo.known_allergies !== 'None')),
          med_asthma: Boolean(studentInfo.med_asthma || (studentInfo.medical_conditions && studentInfo.medical_conditions.toLowerCase().includes('asthma'))),
          med_epilepsy: Boolean(studentInfo.med_epilepsy || (studentInfo.medical_conditions && studentInfo.medical_conditions.toLowerCase().includes('epilepsy'))),
          med_medication: Boolean(studentInfo.med_medication || Boolean(studentInfo.current_medication)),
          med_physical_limitation: Boolean(studentInfo.med_physical_limitation || (studentInfo.medical_conditions && studentInfo.medical_conditions.toLowerCase().includes('physical'))),
          med_dietary_restriction: Boolean(studentInfo.med_dietary_restriction || Boolean(studentInfo.dietary_restrictions)),
          med_other: Boolean(studentInfo.med_other || (studentInfo.medical_other && studentInfo.medical_other !== 'NA' && studentInfo.medical_other !== 'None')),
          med_details: studentInfo.med_details || studentInfo.medical_other || studentInfo.medical_conditions || ''
        }
      },
      forms_tracking: sfRes.rows,
      daily_activity_report: darRes.rows[0] || null,
      institutional_visits: ivRes.rows,
      family_surveys: famRes.rows,
      problem_identification: piRes.rows[0] || null
    });
  } catch (err) {
    console.error('Error fetching admin student submission detail:', err);
    res.status(500).json({ message: 'Failed to fetch student submission detail', error: err.message });
  }
};

// ─── Download RI Faculty Undertaking PDF ────────────────────────────────────
const downloadFacultyUndertakingPdf = async (req, res) => {
  const { facultyId } = req.params;
  try {
    // 1. Find faculty member from ri_batch_faculty or users
    const facRes = await pool.query(`
      SELECT 
        rbf.*,
        rp.name AS panel_name,
        v.name AS village_name,
        COALESCE(rb.name, rb.batch_code) AS batch_name,
        u.id AS user_id,
        u.ri_undertaking_submitted,
        u.ri_undertaking_signed_name,
        u.ri_undertaking_signed_date,
        u.ri_tshirt_size
      FROM ri_batch_faculty rbf
      LEFT JOIN ri_panels rp ON rbf.ri_panel_id = rp.id
      LEFT JOIN ri_villages v ON rp.ri_village_id = v.id
      LEFT JOIN ri_batches rb ON rbf.ri_batch_id = rb.id
      LEFT JOIN users u ON u.id = COALESCE(rbf.faculty_id, (SELECT id FROM users WHERE LOWER(email) = LOWER(rbf.email) LIMIT 1))
      WHERE rbf.id = $1 OR rbf.faculty_id = $1 OR (u.id IS NOT NULL AND u.id = $1)
      LIMIT 1
    `, [facultyId]);

    if (facRes.rowCount === 0) {
      return res.status(404).json({ message: 'Faculty record not found' });
    }

    const fac = facRes.rows[0];

    // 2. Fetch undertaking record
    const underRes = await pool.query(`
      SELECT * FROM ri_faculty_undertakings
      WHERE ($1::int > 0 AND faculty_id = $1)
         OR ($2::int > 0 AND faculty_id = $2)
         OR faculty_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER($3))
      ORDER BY id DESC LIMIT 1
    `, [fac.faculty_id || -1, fac.user_id || -1, fac.email]);

    const under = underRes.rows[0] || null;
    const isSubmitted = Boolean(fac.ri_undertaking_submitted || under);

    if (!isSubmitted) {
      return res.status(400).json({ message: 'Undertaking has not been submitted by this faculty member yet.' });
    }

    const signedName = under?.signed_name || fac.ri_undertaking_signed_name || fac.name || 'Faculty Member';
    const signedDate = under?.signed_date || fac.ri_undertaking_signed_date || (under?.created_at ? new Date(under.created_at).toLocaleDateString('en-GB') : 'Recorded');
    const tshirtSize = under?.tshirt_size || fac.ri_tshirt_size || '—';

    // Fetch logo for header
    const logoPath = path.join(__dirname, '../../frontend/public/ri-logo.png');
    let logoSrc = '';
    try {
      if (fs.existsSync(logoPath)) {
        logoSrc = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
      } else {
        const fallbackLogo = path.join(__dirname, '../../frontend/public/lg.png');
        if (fs.existsSync(fallbackLogo)) {
          logoSrc = `data:image/png;base64,${fs.readFileSync(fallbackLogo).toString('base64')}`;
        }
      }
    } catch { }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Faculty Undertaking - ${signedName}</title>
  <style>
    @page { size: A4; margin: 12mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.5; margin: 0; padding: 0; background: #ffffff; }
    .border-container { border: 2px solid #047857; border-radius: 10px; padding: 20px; box-sizing: border-box; }
    .header { text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { max-height: 48px; margin-bottom: 6px; }
    .university-title { font-size: 15px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
    .sub-title { font-size: 11px; font-weight: 700; color: #334155; margin-top: 2px; }
    .form-title { font-size: 13px; font-weight: 800; color: #064e3b; margin-top: 8px; text-transform: uppercase; background: #ecfdf5; padding: 4px 12px; display: inline-block; border-radius: 4px; border: 1px solid #a7f3d0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; }
    .info-item { font-size: 11px; }
    .info-label { font-weight: 700; color: #475569; }
    .info-value { font-weight: 600; color: #0f172a; }
    .section-title { font-size: 12px; font-weight: 800; color: #064e3b; margin: 12px 0 6px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; text-transform: uppercase; }
    .terms-box { font-size: 10.5px; color: #334155; line-height: 1.6; margin-bottom: 14px; text-align: justify; }
    .terms-box p { margin: 4px 0; }
    .consent-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10.5px; }
    .consent-table td { padding: 6px 10px; border: 1px solid #cbd5e1; }
    .consent-status { font-weight: 700; color: #047857; text-align: center; }
    .sign-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 24px; padding-top: 14px; border-top: 1.5px dashed #94a3b8; }
    .sign-box { text-align: center; width: 45%; }
    .sign-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; padding-bottom: 4px; font-family: cursive, 'Segoe Script', sans-serif; font-size: 14px; font-weight: bold; color: #064e3b; min-height: 22px; }
    .sign-label { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; }
    .verification-seal { text-align: center; margin-top: 16px; font-size: 9.5px; color: #64748b; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="border-container">
    <div class="header">
      ${logoSrc ? `<img src="${logoSrc}" class="logo" alt="Logo" /><br/>` : ''}
      <div class="university-title">Dr. Vishwanath Karad MIT World Peace University, Pune</div>
      <div class="sub-title">Faculty of Engineering, Science & Technology — Rural Immersion Program (RUIP)</div>
      <div class="form-title">Annexure E-2: Faculty & Mentor Undertaking of Commitment & Safety</div>
    </div>

    <div class="info-grid">
      <div class="info-item"><span class="info-label">Faculty / Mentor Name:</span> <span class="info-value">${fac.name || signedName}</span></div>
      <div class="info-item"><span class="info-label">Employee ID:</span> <span class="info-value">${fac.employee_id || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">Department:</span> <span class="info-value">${fac.department || 'General'}</span></div>
      <div class="info-item"><span class="info-label">Designation / Role:</span> <span class="info-value">${fac.designation || fac.role || 'Faculty Mentor'}</span></div>
      <div class="info-item"><span class="info-label">Official Email:</span> <span class="info-value">${fac.email}</span></div>
      <div class="info-item"><span class="info-label">Contact Mobile:</span> <span class="info-value">${fac.phone || fac.mobile || 'On Record'}</span></div>
      <div class="info-item"><span class="info-label">Assigned Batch:</span> <span class="info-value">${fac.batch_name || 'RI Batch'}</span></div>
      <div class="info-item"><span class="info-label">Assigned Panel & Village:</span> <span class="info-value">${fac.panel_name || 'Panel N/A'} (${fac.village_name || 'Village N/A'})</span></div>
    </div>

    <div class="section-title">Terms of Engagement & Code of Conduct</div>
    <div class="terms-box">
      <p>1. <strong>Academic Supervision & Student Safety:</strong> As a nominated Faculty Mentor for the Rural Immersion Program, I hereby confirm my duty of care, leadership, and supervisory responsibility towards student squads assigned to my panel during village fieldwork, survey activities, and overnight accommodation.</p>
      <p>2. <strong>Institutional Honor Code:</strong> I agree to uphold the highest ethical standards of MIT World Peace University, maintaining exemplary professional decorum, respect for village leadership (Gram Panchayat, Sarpanch, Anganwadi, and school staff), and cultural sensitivities of the rural community.</p>
      <p>3. <strong>Attendance & Daily Reporting:</strong> I confirm that I will monitor and verify student daily attendance across mandatory activities (School Activity, Institutional Visits, Household Family Visits, Problem Identification) and evaluate submissions strictly in accordance with official grading rubrics.</p>
      <p>4. <strong>Zero-Tolerance Directives:</strong> I acknowledge strict adherence to campus safety, zero possession or consumption of alcohol/narcotics/tobacco, adherence to curfew guidelines, and prompt reporting of any medical or behavioral incidents to the Nodal Officer and Central Command.</p>
    </div>

    <div class="section-title">Official Acknowledgements & Consents</div>
    <table class="consent-table">
      <tr>
        <td><strong>Institutional Honor Code & Field Safety Protocols</strong></td>
        <td class="consent-status">✓ Agreed & Accepted</td>
      </tr>
      <tr>
        <td><strong>Operational Guidelines & Rubrics Compliance</strong></td>
        <td class="consent-status">✓ Agreed & Accepted</td>
      </tr>
      <tr>
        <td><strong>Photo / Video Media Consent for Educational & Reporting Records</strong></td>
        <td class="consent-status">✓ Consented</td>
      </tr>
      <tr>
        <td><strong>Data Confidentiality & Ethical Research Standards</strong></td>
        <td class="consent-status">✓ Consented</td>
      </tr>
      ${tshirtSize && tshirtSize !== '—' ? `
      <tr>
        <td><strong>Official RI Kit / T-Shirt Allocation</strong></td>
        <td class="consent-status">Size: ${tshirtSize}</td>
      </tr>` : ''}
    </table>

    <div class="sign-section">
      <div class="sign-box">
        <div class="sign-line">${signedName}</div>
        <div class="sign-label">Digitally Signed by Faculty Mentor</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">Date: ${signedDate}</div>
      </div>
      <div class="sign-box">
        <div class="sign-line" style="font-family: inherit; font-size: 11px; font-weight: 700; color: #047857;">Verified Digital Record</div>
        <div class="sign-label">RI Central Administration • MIT-WPU</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">System Ref: RIFAC-${fac.id || facultyId}</div>
      </div>
    </div>

    <div class="verification-seal">
      ✓ This is an officially submitted, digitally authenticated undertaking recorded in the MIT-WPU Rural Immersion Portal. Verified electronically under IT Act digital signature compliance.
    </div>
  </div>
</body>
</html>
    `;

    const puppeteer = require('puppeteer');
    let browser;
    let pdfBytes;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
      });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.error('[downloadFacultyUndertakingPdf Close Error]', closeErr);
        }
      }
    }

    const safeName = `RI_Faculty_Undertaking_${(fac.name || 'Mentor').trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error generating faculty undertaking PDF:', err);
    res.status(500).json({ message: 'Failed to generate undertaking PDF', error: err.message });
  }
};

// ─── RI Admin / SuperAdmin Panel Media ───────────────────────────────────────
const getPanelMediaAdmin = async (req, res) => {
  try {
    const panelId = parseInt(req.params.panelId || req.query.panel_id, 10);
    if (!panelId || isNaN(panelId)) {
      return res.status(400).json({ message: 'Valid panel ID is required.' });
    }

    const mediaRes = await pool.query(`
      SELECT m.*, p.name AS panel_name, b.name AS batch_name, v.name AS village_name
      FROM ri_panel_media m
      JOIN ri_panels p ON p.id = m.ri_panel_id
      JOIN ri_batches b ON b.id = m.ri_batch_id
      LEFT JOIN ri_villages v ON v.id = p.ri_village_id
      WHERE m.ri_panel_id = $1
      ORDER BY m.created_at ASC
    `, [panelId]);

    res.json({
      success: true,
      count: mediaRes.rowCount,
      max_allowed: 5,
      media: mediaRes.rows
    });
  } catch (err) {
    console.error('Error fetching admin panel media:', err);
    res.status(500).json({ message: 'Failed to fetch panel media', error: err.message });
  }
};

const deletePanelMediaAdmin = async (req, res) => {
  try {
    const mediaId = parseInt(req.params.id, 10);
    if (!mediaId || isNaN(mediaId)) {
      return res.status(400).json({ message: 'Valid media ID is required.' });
    }

    const mediaRes = await pool.query(`SELECT * FROM ri_panel_media WHERE id = $1`, [mediaId]);
    if (mediaRes.rowCount === 0) {
      return res.status(404).json({ message: 'Media not found.' });
    }

    const item = mediaRes.rows[0];
    await pool.query(`DELETE FROM ri_panel_media WHERE id = $1`, [mediaId]);

    if (item.file_url) {
      const riStorageService = require('../services/riStorageService');
      if (riStorageService.isS3FacultyReference(item.file_url)) {
        // S3 object deletion (never pass to fs.unlinkSync)
        await riStorageService.deleteFacultyFile(item.file_url);
      } else if (riStorageService.isLegacyLocalFacultyReference(item.file_url)) {
        // Legacy local file deletion (never pass to S3 deletion service)
        const fs = require('fs');
        const path = require('path');
        const filename = path.basename(item.file_url);
        const filePath = path.join(__dirname, '../uploads/ri_media', filename);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch {}
        }
      }
    }

    res.json({ success: true, message: 'Media deleted successfully.' });
  } catch (err) {
    console.error('Error deleting admin panel media:', err);
    res.status(500).json({ message: 'Failed to delete media', error: err.message });
  }
};

// ─── RI Admin / SuperAdmin Faculty Uploads (Batch-wise & Village-wise) ────────
const getAllVillages = async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name, taluka, district, location FROM ri_villages ORDER BY name ASC`);
    res.json({ success: true, villages: result.rows });
  } catch (err) {
    console.error('Error fetching all villages:', err);
    res.status(500).json({ message: 'Failed to fetch villages', error: err.message });
  }
};

const getFacultyUploadsAdmin = async (req, res) => {
  try {
    const { batch_id, village_id, panel_id, category, search } = req.query;

    let query = `
      SELECT 
        m.id,
        m.ri_batch_id,
        m.ri_panel_id,
        m.uploaded_by_id,
        m.uploaded_by_name,
        m.file_url,
        m.file_name,
        m.mime_type,
        m.file_size,
        m.caption,
        COALESCE(m.category, 'photo') AS category,
        m.created_at,
        b.name AS batch_name,
        EXTRACT(YEAR FROM b.start_date)::int AS batch_academic_year,
        p.name AS panel_name,
        p.panel_number,
        v.id AS village_id,
        v.name AS village_name,
        v.taluka AS village_taluka,
        v.district AS village_district
      FROM ri_panel_media m
      JOIN ri_batches b ON b.id = m.ri_batch_id
      JOIN ri_panels p ON p.id = m.ri_panel_id
      LEFT JOIN ri_villages v ON v.id = p.ri_village_id
      WHERE 1=1
    `;
    const params = [];

    if (batch_id && batch_id !== 'all' && batch_id !== '') {
      params.push(parseInt(batch_id, 10));
      query += ` AND m.ri_batch_id = $${params.length}`;
    }

    if (village_id && village_id !== 'all' && village_id !== '') {
      params.push(parseInt(village_id, 10));
      query += ` AND p.ri_village_id = $${params.length}`;
    }

    if (panel_id && panel_id !== 'all' && panel_id !== '') {
      params.push(parseInt(panel_id, 10));
      query += ` AND m.ri_panel_id = $${params.length}`;
    }

    if (category && category !== 'all' && category !== '') {
      params.push(category);
      query += ` AND COALESCE(m.category, 'photo') = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (
        LOWER(m.file_name) LIKE $${params.length} OR
        LOWER(COALESCE(m.caption, '')) LIKE $${params.length} OR
        LOWER(COALESCE(m.uploaded_by_name, '')) LIKE $${params.length} OR
        LOWER(p.name) LIKE $${params.length} OR
        LOWER(COALESCE(v.name, '')) LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY m.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rowCount,
      uploads: result.rows
    });
  } catch (err) {
    console.error('Error fetching admin faculty uploads:', err);
    res.status(500).json({ message: 'Failed to fetch faculty uploads', error: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getLtcBatches,
  getRiBatches,
  getRiBatchById,
  createRiBatch,
  updateRiBatch,
  deleteRiBatch,
  updateRiStudent,
  syncLtcBatchToRi,
  getBatchPanels,
  getBatchNodalOfficers,
  getBatchVillages,
  createBatchVillage,
  updateVillage,
  deleteVillage,
  assignPanelVillage,
  updatePanelNodalOfficer,
  bulkAssignPanelsVillages,
  deletePanel,
  getPanelStudents,
  getAllRiStudents,
  getBatchFaculty,
  validateFacultyUpload,
  bulkUploadFaculty,
  downloadFacultyTemplate,
  createBatchFaculty,
  updateBatchFaculty,
  deleteBatchFaculty,
  validateStudentUpload,
  bulkUploadStudents,
  createRiStudent,
  downloadStudentTemplate,
  cleanPanelName,
  matchPanel,
  parseSpreadsheetBuffer,
  normalizeStudentRow,
  getAdminAttendanceReport,
  getAdminStudentFormsReport,
  getAdminEvaluationReport,
  getAdminFamilySurveyReport,
  getAdminOverallAssessmentReport,
  getAdminAuditLogs,
  validateVillageFacultyUpload,
  importVillageFacultyUpload,
  downloadVillageFacultyTemplate,
  parseVillageFacultySpreadsheet,
  mapVillageFacultyColumns,
  getAdminSubmissions,
  getAdminStudentSubmissionDetail,
  downloadFacultyUndertakingPdf,
  getPanelMediaAdmin,
  deletePanelMediaAdmin,
  getFacultyUploadsAdmin,
  getAllVillages
};

