const pool = require('../config/db');

function cleanPanelName(rawName) {
  if (!rawName) return '';
  return String(rawName)
    .replace(/^(Panel\s+\d+\s*[-—:]\s*|P\d+\s*[-—:]\s*)/i, '')
    .trim();
}

const CANONICAL_PANEL_DEFINITIONS = [
  { matchRegex: /sy\s*r&?a\s*div\s*(1|01|i\b)|mech\s*robotics\s*div\s*1/i, name: 'SY R&A Div 1', num: 1 },
  { matchRegex: /sy\s*ra\s*div\s*(2|02|ii\b)|syra\s*div\s*(2|02|ii\b)|mech\s*robotics\s*div\s*2/i, name: 'SYRA Div 02', num: 2 },
  { matchRegex: /pharmacy|b\s*pharm/i, name: 'B Pharmacy', num: 3 },
  { matchRegex: /media/i, name: 'Media', num: 4 },
  { matchRegex: /material/i, name: 'Materials Science and Engineering', num: 5 },
  { matchRegex: /film/i, name: 'Films', num: 6 },
  { matchRegex: /liberal/i, name: 'BA Liberal Arts', num: 7 },
  { matchRegex: /photo/i, name: 'Photography', num: 8 },
];

function resolveCanonicalPanel(rawPanel, rawDivision, rawDepartment) {
  // 1. If explicit panel is provided, match or clean it
  if (rawPanel && rawPanel.trim()) {
    const cleanP = cleanPanelName(rawPanel.trim());
    for (const p of CANONICAL_PANEL_DEFINITIONS) {
      if (p.matchRegex.test(cleanP)) {
        return p;
      }
    }
    return { name: cleanP, num: 99 };
  }

  // 2. Otherwise match against division and department text
  const text = ((rawDivision || '') + ' ' + (rawDepartment || '')).trim();
  for (const p of CANONICAL_PANEL_DEFINITIONS) {
    if (p.matchRegex.test(text)) {
      return p;
    }
  }

  const fallback = cleanPanelName(rawDivision || rawDepartment || 'General Panel');
  return { name: fallback, num: 99 };
}

/**
 * Live LTC -> RI Batch, Panel & Student Synchronization Engine
 * Ensures every LTC batch has exactly one corresponding RI Batch linked via stable source_batch_id.
 * Dynamically provisions division-wise panels, synchronizes student enrollments & faculty memberships.
 * Transactional, duplicate-safe, idempotent, and production-grade.
 * 
 * @param {number|string} ltcBatchId - LTC Batch primary key (batches.id)
 * @param {object} [providedClient] - Optional pg client if already inside a transaction
 * @param {object} [options] - Optional sync configuration options ({ isManual: boolean, force: boolean })
 * @returns {Promise<object>} Sync summary
 */
async function syncLtcBatchToRiCore(ltcBatchId, providedClient = null, options = {}) {
  const isManual = options && (options.isManual === true || options.force === true);
  const client = providedClient || await pool.connect();
  const shouldManageTransaction = !providedClient;

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    // 1. Fetch Source LTC Batch
    const batchRes = await client.query(
      `SELECT * FROM batches WHERE id = $1 AND (is_deleted IS NOT TRUE)`,
      [ltcBatchId]
    );

    if (batchRes.rowCount === 0) {
      // If the LTC batch was deleted or inactive, remove corresponding RI batch mapping
      await client.query(`DELETE FROM ri_batches WHERE source_batch_id = $1`, [ltcBatchId]);
      if (shouldManageTransaction) await client.query('COMMIT');
      return { success: true, message: 'Source batch was deleted or inactive. Removed RI batch mapping.' };
    }

    const ltcBatch = batchRes.rows[0];

    // Check if this batch is already synced to RI
    const existingRiBatchRes = await client.query(
      `SELECT * FROM ri_batches WHERE source_batch_id = $1`,
      [ltcBatch.id]
    );
    const isAlreadySynced = existingRiBatchRes.rowCount > 0;

    // Deployment Boundary Evaluation for Unsynced Historical Batches
    // Automatic sync is skipped ONLY if:
    // 1. It is NOT an explicit manual sync request (isManual is false)
    // 2. The batch does NOT already have an existing ri_batches record
    // 3. The batch was created BEFORE or AT the permanent ri_integration_deployed_at timestamp
    if (!isManual && !isAlreadySynced) {
      let boundaryRes = await client.query(
        `SELECT value FROM system_settings WHERE key = 'ri_integration_deployed_at' LIMIT 1`
      );
      
      // Safety Fallback: Ensure boundary timestamp exists
      if (boundaryRes.rowCount === 0 || !boundaryRes.rows[0].value) {
        await client.query(`
          INSERT INTO system_settings (key, value)
          VALUES ('ri_integration_deployed_at', CURRENT_TIMESTAMP::text)
          ON CONFLICT (key) DO NOTHING
        `);
        boundaryRes = await client.query(
          `SELECT value FROM system_settings WHERE key = 'ri_integration_deployed_at' LIMIT 1`
        );
      }

      if (boundaryRes.rowCount > 0 && boundaryRes.rows[0].value) {
        const deployedAtStr = boundaryRes.rows[0].value;
        const deployedAtTime = new Date(deployedAtStr).getTime();
        
        // Parse batch created_at timestamp safely: if null, empty, or invalid, fail-safe to 0 (historical)
        let batchCreatedTime = 0;
        if (ltcBatch.created_at) {
          const parsedTime = new Date(ltcBatch.created_at).getTime();
          batchCreatedTime = isNaN(parsedTime) ? 0 : parsedTime;
        }

        if (!isNaN(deployedAtTime) && batchCreatedTime <= deployedAtTime) {
          if (shouldManageTransaction) await client.query('COMMIT');
          return {
            success: true,
            skipped: true,
            reason: 'historical_batch_requires_manual_sync',
            message: `Batch "${ltcBatch.name}" was created prior to or at the RI integration deployment boundary. Automatic sync skipped. Use manual "Sync to RI" to synchronize this historical batch.`
          };
        }
      }
    }

    // 2. Fetch all active students currently enrolled in this LTC batch
    const studentsRes = await client.query(`
      SELECT u.id, u.name, u.prn, u.email, u.panel, u.division, u.department, u.school
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      WHERE bs.batch_id = $1 AND (bs.is_dnr IS NOT TRUE)
      ORDER BY u.name ASC, u.id ASC
    `, [ltcBatchId]);

    const currentStudents = studentsRes.rows;
    const currentStudentIds = new Set(currentStudents.map(s => s.id));

    // 3. Find or Create exactly one RI Batch linked to source_batch_id = ltcBatch.id
    let riBatch;
    if (existingRiBatchRes.rowCount > 0) {
      // Update existing RI batch metadata in place (never duplicate RI batches)
      const updateRiBatchRes = await client.query(`
        UPDATE ri_batches 
        SET name = $1, status = $2, start_date = $3, end_date = $4, batch_code = $5, source_program = 'LTC_SYNC', updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `, [ltcBatch.name, ltcBatch.status || 'active', ltcBatch.start_date, ltcBatch.end_date, ltcBatch.batch_code || null, existingRiBatchRes.rows[0].id]);
      riBatch = updateRiBatchRes.rows[0];
    } else {
      // Create new RI Batch representation linked via source_batch_id
      const insertRiBatchRes = await client.query(`
        INSERT INTO ri_batches (
          name, batch_code, source_program, source_batch_id, panel_capacity, status, start_date, end_date, description
        )
        VALUES ($1, $2, 'LTC_SYNC', $3, 60, $4, $5, $6, $7)
        RETURNING *
      `, [
        ltcBatch.name,
        ltcBatch.batch_code || null,
        ltcBatch.id,
        ltcBatch.status || 'active',
        ltcBatch.start_date,
        ltcBatch.end_date,
        `Synchronized from LTC Batch: ${ltcBatch.name}`
      ]);
      riBatch = insertRiBatchRes.rows[0];
    }

    // 4. Group current students batch/division-wise according to Master Sheet structure
    const panelGroupsMap = new Map();
    for (const s of currentStudents) {
      const pInfo = resolveCanonicalPanel(s.panel, s.division, s.department);
      if (!panelGroupsMap.has(pInfo.name)) {
        panelGroupsMap.set(pInfo.name, {
          name: pInfo.name,
          canonicalNum: pInfo.num,
          students: []
        });
      }
      panelGroupsMap.get(pInfo.name).students.push(s);
    }

    // Sort groups in canonical order
    const sortedGroups = Array.from(panelGroupsMap.values()).sort((a, b) => {
      if (a.canonicalNum !== b.canonicalNum) return a.canonicalNum - b.canonicalNum;
      return b.students.length - a.students.length;
    });

    // 5. Synchronize RI Panels for this RI Batch
    const existingPanelsRes = await client.query(
      `SELECT * FROM ri_panels WHERE ri_batch_id = $1 ORDER BY panel_number ASC`,
      [riBatch.id]
    );
    const existingPanels = existingPanelsRes.rows;

    // Temporarily invert panel_number on existing panels to eliminate unique constraint collisions during renumbering
    if (existingPanels.length > 0) {
      await client.query(`UPDATE ri_panels SET panel_number = -id WHERE ri_batch_id = $1`, [riBatch.id]);
    }

    const activePanelIds = [];
    const activePanelsList = [];

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i]; // Correctly assign group from array
      const panelNumber = i + 1;
      const panelDisplayName = cleanPanelName(group.name || `Panel ${panelNumber}`);
      const groupCapacity = Math.max(group.students.length, 60);

      let panel;
      // Match existing panel by clean name first to preserve village and faculty assignments
      let existingPanel = existingPanels.find(
        p => cleanPanelName(p.name).toLowerCase() === panelDisplayName.toLowerCase() && !activePanelIds.includes(p.id)
      );
      if (!existingPanel) {
        // Only reuse unconfigured placeholder panels without village or nodal mappings
        existingPanel = existingPanels.find(
          p => !activePanelIds.includes(p.id) && !p.ri_village_id && !p.nodal_officer_name && !p.nodal_officer_email
        );
      }

      if (existingPanel) {
        const updatePanelRes = await client.query(`
          UPDATE ri_panels 
          SET name = $1, capacity = $2, panel_number = $3
          WHERE id = $4
          RETURNING *
        `, [panelDisplayName, groupCapacity, panelNumber, existingPanel.id]);
        panel = updatePanelRes.rows[0];
      } else {
        const insertPanelRes = await client.query(`
          INSERT INTO ri_panels (ri_batch_id, panel_number, name, capacity)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [riBatch.id, panelNumber, panelDisplayName, groupCapacity]);
        panel = insertPanelRes.rows[0];
      }

      activePanelIds.push(panel.id);
      activePanelsList.push({ panel, students: group.students });
    }

    // Clean up any remaining panels with negative panel_number that were not matched
    // Never delete configured panels with villages, faculty, or nodal officers
    const unmatchedPanelsRes = await client.query(
      `SELECT id, ri_village_id, nodal_officer_name, nodal_officer_email FROM ri_panels WHERE ri_batch_id = $1 AND panel_number < 0`,
      [riBatch.id]
    );
    for (const unmatched of unmatchedPanelsRes.rows) {
      const studentCountCheck = await client.query(
        `SELECT COUNT(*)::int AS count FROM ri_batch_students WHERE ri_panel_id = $1`,
        [unmatched.id]
      );
      const facultyCountCheck = await client.query(
        `SELECT COUNT(*)::int AS count FROM ri_batch_faculty WHERE ri_panel_id = $1 AND status <> 'deleted'`,
        [unmatched.id]
      );
      const hasConfig = unmatched.ri_village_id || unmatched.nodal_officer_name || unmatched.nodal_officer_email || facultyCountCheck.rows[0].count > 0;
      
      if (studentCountCheck.rows[0].count === 0 && !hasConfig) {
        await client.query(`DELETE FROM ri_panels WHERE id = $1`, [unmatched.id]);
      } else {
        // Reset panel number to a safe positive number
        const maxNumRes = await client.query(
          `SELECT COALESCE(MAX(panel_number), 0) AS max_num FROM ri_panels WHERE ri_batch_id = $1 AND panel_number > 0`,
          [riBatch.id]
        );
        const nextNum = (maxNumRes.rows[0].max_num || 0) + 1;
        await client.query(`UPDATE ri_panels SET panel_number = $1 WHERE id = $2`, [nextNum, unmatched.id]);
      }
    }

    // 6. Synchronize Student Memberships in ri_batch_students
    // A) Remove students no longer in the LTC batch (e.g. removed, shifted, or unassigned)
    if (currentStudentIds.size > 0) {
      const currentIdsArray = Array.from(currentStudentIds);
      await client.query(`
        DELETE FROM ri_batch_students 
        WHERE ri_batch_id = $1 
          AND enrollment_type = 'LTC_SYNC' 
          AND student_id NOT IN (${currentIdsArray.map((_, i) => `$${i + 2}`).join(', ')})
      `, [riBatch.id, ...currentIdsArray]);
    } else {
      await client.query(`
        DELETE FROM ri_batch_students 
        WHERE ri_batch_id = $1 AND enrollment_type = 'LTC_SYNC'
      `, [riBatch.id]);
    }

    // B) Upsert all current students into their assigned RI panel
    for (const groupItem of activePanelsList) {
      const { panel, students } = groupItem;
      for (const student of students) {
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
            ri_id = COALESCE(ri_batch_students.ri_id, EXCLUDED.ri_id)
        `, [riBatch.id, student.id, panel.id, ltcBatch.id]);
      }
    }

    // 7. Synchronize Faculty Memberships in ri_batch_faculty
    const facultyRes = await client.query(`
      SELECT u.id, u.name, u.email, u.phone, u.department, u.designation, u.role
      FROM batch_faculty bf
      JOIN users u ON bf.faculty_id = u.id
      WHERE bf.batch_id = $1
    `, [ltcBatchId]);

    const currentFaculty = facultyRes.rows;
    for (const fac of currentFaculty) {
      const email = (fac.email || '').toLowerCase().trim();
      if (!email) continue;

      const existingFac = await client.query(
        `SELECT id, ri_panel_id FROM ri_batch_faculty WHERE ri_batch_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [riBatch.id, email]
      );

      if (existingFac.rowCount === 0) {
        await client.query(`
          INSERT INTO ri_batch_faculty (
            ri_batch_id, faculty_id, name, email, phone, department, designation, role, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
        `, [
          riBatch.id,
          fac.id,
          fac.name,
          fac.email,
          fac.phone || null,
          fac.department || null,
          fac.designation || 'Faculty Mentor',
          fac.role === 'evaluator' ? 'evaluator' : 'mentor'
        ]);
      } else {
        await client.query(`
          UPDATE ri_batch_faculty
          SET faculty_id = COALESCE(faculty_id, $1),
              name = COALESCE(name, $2),
              phone = COALESCE(phone, $3),
              department = COALESCE(department, $4),
              status = 'active'
          WHERE id = $5
        `, [fac.id, fac.name, fac.phone || null, fac.department || null, existingFac.rows[0].id]);
      }
    }

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }

    return {
      success: true,
      ri_batch: riBatch,
      panels_count: activePanelsList.length,
      students_count: currentStudents.length,
      faculty_count: currentFaculty.length
    };
  } catch (err) {
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }
    console.error(`[riSyncService] Error syncing LTC batch ${ltcBatchId} to RI:`, err);
    throw err;
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
  }
}

/**
 * Live sync all active LTC batches
 */
async function syncAllLtcBatchesToRi() {
  try {
    const batchesRes = await pool.query(
      `SELECT id FROM batches WHERE (is_deleted IS NOT TRUE) ORDER BY id ASC`
    );
    for (const row of batchesRes.rows) {
      await syncLtcBatchToRiCore(row.id);
    }
    return { success: true, count: batchesRes.rows.length };
  } catch (err) {
    console.error('[riSyncService] Error syncing all LTC batches:', err);
    throw err;
  }
}

module.exports = {
  cleanPanelName,
  syncLtcBatchToRiCore,
  syncAllLtcBatchesToRi,
  resolveCanonicalPanel
};
