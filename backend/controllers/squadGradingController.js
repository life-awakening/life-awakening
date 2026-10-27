const pool = require('../config/db');
const {
  SQUAD_CANONICAL_NAMES,
  COMPETITION_DAYS,
  ACTIVITIES_CONFIG,
  FLAT_GRADING_ITEMS,
  validateGradingRanks,
  computeComprehensiveScores
} = require('../services/squadScoringService');

/**
 * Helper to fetch batches list
 */
const fetchAllBatches = async () => {
  const res = await pool.query(
    `SELECT id, name, location, year, start_date, end_date, status, batch_code 
     FROM batches 
     WHERE is_deleted IS NOT TRUE 
     ORDER BY id DESC`
  );
  return res.rows;
};

/**
 * GET /api/superadmin/squad-performance
 * Main data loader for Squad Performance Tab
 */
const getSquadPerformance = async (req, res) => {
  try {
    const allBatches = await fetchAllBatches();

    let targetBatch = null;
    if (req.query.batchId && req.query.batchId !== 'undefined' && req.query.batchId !== 'null') {
      targetBatch = allBatches.find(b => b.id === parseInt(req.query.batchId, 10)) || null;
    }

    // Default to active / immersion batch if no specific batch requested
    if (!targetBatch) {
      targetBatch = allBatches.find(b => ['active', 'immersion'].includes(String(b.status || '').toLowerCase())) || null;
    }

    // If still no active batch, pick the first available batch
    if (!targetBatch && allBatches.length > 0) {
      targetBatch = allBatches[0];
    }

    // If database has 0 batches, create or return clean state
    if (!targetBatch) {
      return res.json({
        success: true,
        batch: null,
        allBatches: [],
        days: COMPETITION_DAYS,
        activitiesConfig: ACTIVITIES_CONFIG,
        flatGradingItems: FLAT_GRADING_ITEMS,
        squads: SQUAD_CANONICAL_NAMES,
        results: [],
        progressMatrix: {},
        leaderboard: SQUAD_CANONICAL_NAMES.map((sq, idx) => ({
          rank: idx + 1,
          squad: sq,
          punctuality: 0,
          discipline: 0,
          food_serving: 0,
          obstacles: 0,
          khokho: 0,
          debate: 0,
          quiz: 0,
          agriculture: 0,
          sports: 0,
          team_building: 0,
          patriotism: 0,
          spirituality: 0,
          overallScore: 0,
          overallScoreFormatted: "0.00"
        })),
        squadSummaries: {},
        top3: { gold: null, silver: null, bronze: null },
        message: 'No batches found'
      });
    }

    const batchId = targetBatch.id;

    // Fetch all grading results for this batch
    const resultsRes = await pool.query(
      `SELECT r.*, 
              u1.name as created_by_name,
              u2.name as updated_by_name,
              u3.name as locked_by_name
       FROM squad_grading_results r
       LEFT JOIN users u1 ON r.created_by = u1.id
       LEFT JOIN users u2 ON r.updated_by = u2.id
       LEFT JOIN users u3 ON r.locked_by = u3.id
       WHERE r.batch_id = $1
       ORDER BY r.day ASC, r.activity_key ASC`,
      [batchId]
    );

    // Compute comprehensive scores
    const calculated = computeComprehensiveScores(resultsRes.rows, SQUAD_CANONICAL_NAMES);

    return res.json({
      success: true,
      batch: targetBatch,
      allBatches,
      days: COMPETITION_DAYS,
      activitiesConfig: calculated.activitiesConfig,
      flatGradingItems: calculated.flatGradingItems,
      squads: calculated.squads,
      results: resultsRes.rows,
      progressMatrix: calculated.progressMatrix,
      leaderboard: calculated.leaderboard,
      squadSummaries: calculated.squadSummaries,
      top3: calculated.top3
    });
  } catch (err) {
    console.error('Error in getSquadPerformance:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching squad performance data',
      error: err.message
    });
  }
};

/**
 * POST /api/superadmin/squad-performance/grade
 * Authoritative endpoint to record / update grading for an activity
 */
const recordSquadGrading = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (!['superadmin', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only Superadmin or Admin can record squad grading.'
      });
    }

    const { batchId, day, activityKey, subActivityKey, rank1Squad, rank2Squad, rank3Squad, status } = req.body;

    if (!batchId || !day || !activityKey) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: batchId, day, and activityKey are required.'
      });
    }

    if (!COMPETITION_DAYS.includes(day)) {
      return res.status(400).json({
        success: false,
        message: `Invalid day '${day}'. Must be one of: ${COMPETITION_DAYS.join(', ')}`
      });
    }

    // Validate activityKey & subActivityKey
    const parentAct = ACTIVITIES_CONFIG.find(a => a.key === activityKey);
    if (!parentAct) {
      return res.status(400).json({
        success: false,
        message: `Invalid activityKey '${activityKey}'.`
      });
    }

    const cleanSubKey = subActivityKey ? String(subActivityKey).trim().toLowerCase() : null;
    if (parentAct.isParent) {
      if (!cleanSubKey) {
        return res.status(400).json({
          success: false,
          message: `Activity '${parentAct.name}' requires a subActivityKey (fall_in, yoga, tb, agriculture).`
        });
      }
      const validSub = parentAct.subActivities.find(s => s.key === cleanSubKey);
      if (!validSub) {
        return res.status(400).json({
          success: false,
          message: `Invalid subActivityKey '${cleanSubKey}' for ${parentAct.name}.`
        });
      }
    }

    // Validation: duplicate squads across rank 1, 2, 3
    const rankValidation = validateGradingRanks(rank1Squad, rank2Squad, rank3Squad, SQUAD_CANONICAL_NAMES);
    if (!rankValidation.valid) {
      return res.status(400).json({
        success: false,
        message: rankValidation.error
      });
    }

    const parsedBatchId = parseInt(batchId, 10);
    const trimmedR1 = rank1Squad ? String(rank1Squad).trim() : null;
    const trimmedR2 = rank2Squad ? String(rank2Squad).trim() : null;
    const trimmedR3 = rank3Squad ? String(rank3Squad).trim() : null;
    const targetStatus = status === 'finalized' ? 'finalized' : 'draft';

    // Check existing record
    const existingRes = await pool.query(
      `SELECT * FROM squad_grading_results
       WHERE batch_id = $1 AND day = $2 AND activity_key = $3 AND COALESCE(sub_activity_key, '') = COALESCE($4, '')`,
      [parsedBatchId, day, activityKey, cleanSubKey]
    );

    const existing = existingRes.rows[0] || null;

    // If currently finalized and trying to update without reopening
    if (existing && existing.status === 'finalized' && targetStatus !== 'draft' && req.body.forceUnlock !== true) {
      return res.status(400).json({
        success: false,
        message: 'This activity result is FINALIZED and locked. Please reopen/unlock the result before editing.'
      });
    }

    let savedResult;
    const previousRanks = existing
      ? { rank1: existing.rank_1_squad, rank2: existing.rank_2_squad, rank3: existing.rank_3_squad, status: existing.status }
      : null;

    const newRanks = { rank1: trimmedR1, rank2: trimmedR2, rank3: trimmedR3, status: targetStatus };

    if (existing) {
      const updateRes = await pool.query(
        `UPDATE squad_grading_results
         SET rank_1_squad = $1,
             rank_2_squad = $2,
             rank_3_squad = $3,
             status = $4,
             updated_by = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [trimmedR1, trimmedR2, trimmedR3, targetStatus, req.user.id, existing.id]
      );
      savedResult = updateRes.rows[0];
    } else {
      const insertRes = await pool.query(
        `INSERT INTO squad_grading_results
         (batch_id, day, activity_key, sub_activity_key, rank_1_squad, rank_2_squad, rank_3_squad, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [parsedBatchId, day, activityKey, cleanSubKey, trimmedR1, trimmedR2, trimmedR3, targetStatus, req.user.id]
      );
      savedResult = insertRes.rows[0];
    }

    // Record audit log
    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const adminName = userRes.rows[0]?.name || req.user.email || 'Admin';

    await pool.query(
      `INSERT INTO squad_grading_audit_logs
       (batch_id, day, activity_key, sub_activity_key, action, previous_ranks, new_ranks, admin_id, admin_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        parsedBatchId,
        day,
        activityKey,
        cleanSubKey,
        existing ? 'update' : 'create',
        JSON.stringify(previousRanks),
        JSON.stringify(newRanks),
        req.user.id,
        adminName,
        `Grading saved for ${day} - ${activityKey}${cleanSubKey ? ` (${cleanSubKey})` : ''} by ${adminName}`
      ]
    );

    // Recalculate full scoring and leaderboard
    const allResultsRes = await pool.query(
      `SELECT r.*, 
              u1.name as created_by_name,
              u2.name as updated_by_name,
              u3.name as locked_by_name
       FROM squad_grading_results r
       LEFT JOIN users u1 ON r.created_by = u1.id
       LEFT JOIN users u2 ON r.updated_by = u2.id
       LEFT JOIN users u3 ON r.locked_by = u3.id
       WHERE r.batch_id = $1 
       ORDER BY r.day ASC, r.activity_key ASC`,
      [parsedBatchId]
    );
    const calculated = computeComprehensiveScores(allResultsRes.rows, SQUAD_CANONICAL_NAMES);

    return res.json({
      success: true,
      message: `Grading saved successfully for ${day} - ${activityKey}${cleanSubKey ? ` (${cleanSubKey})` : ''}.`,
      result: savedResult,
      results: allResultsRes.rows,
      leaderboard: calculated.leaderboard,
      squadSummaries: calculated.squadSummaries,
      progressMatrix: calculated.progressMatrix,
      top3: calculated.top3
    });
  } catch (err) {
    console.error('Error in recordSquadGrading:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error recording squad grading',
      error: err.message
    });
  }
};

/**
 * POST /api/superadmin/squad-performance/status
 * Toggle status between 'draft' and 'finalized'
 */
const toggleResultStatus = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (!['superadmin', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. Only Superadmin or Admin can lock/unlock grading results.'
      });
    }

    const { batchId, day, activityKey, subActivityKey, status } = req.body;
    const targetStatus = status === 'finalized' ? 'finalized' : 'draft';
    const cleanSubKey = subActivityKey ? String(subActivityKey).trim().toLowerCase() : null;
    const parsedBatchId = parseInt(batchId, 10);

    const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const adminName = userRes.rows[0]?.name || 'Admin';
    const isLocking = targetStatus === 'finalized';
    const lockedByVal = isLocking ? req.user.id : null;
    const lockedAtVal = isLocking ? new Date() : null;

    if (day && activityKey) {
      const existingRes = await pool.query(
        `SELECT * FROM squad_grading_results
         WHERE batch_id = $1 AND day = $2 AND activity_key = $3 AND COALESCE(sub_activity_key, '') = COALESCE($4, '')`,
        [parsedBatchId, day, activityKey, cleanSubKey]
      );

      if (existingRes.rowCount > 0) {
        await pool.query(
          `UPDATE squad_grading_results
           SET status = $1,
               locked_by = $2,
               locked_at = $3,
               updated_by = $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [targetStatus, lockedByVal, lockedAtVal, req.user.id, existingRes.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO squad_grading_results
           (batch_id, day, activity_key, sub_activity_key, status, locked_by, locked_at, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [parsedBatchId, day, activityKey, cleanSubKey, targetStatus, lockedByVal, lockedAtVal, req.user.id]
        );
      }

      await pool.query(
        `INSERT INTO squad_grading_audit_logs
         (batch_id, day, activity_key, sub_activity_key, action, admin_id, admin_name, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          parsedBatchId,
          day,
          activityKey,
          cleanSubKey,
          targetStatus === 'finalized' ? 'finalize' : 'reopen',
          req.user.id,
          adminName,
          `Status changed to ${targetStatus.toUpperCase()} for ${day} ${activityKey}${cleanSubKey ? ` (${cleanSubKey})` : ''}`
        ]
      );
    } else if (day) {
      // Lock/Unlock entire Day: Update all existing rows
      await pool.query(
        `UPDATE squad_grading_results
         SET status = $1,
             locked_by = $2,
             locked_at = $3,
             updated_by = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE batch_id = $5 AND day = $6`,
        [targetStatus, lockedByVal, lockedAtVal, req.user.id, parsedBatchId, day]
      );

      // Insert missing items for that day with targetStatus
      for (const item of FLAT_GRADING_ITEMS) {
        const itemSubKey = item.subActivityKey ? String(item.subActivityKey).trim().toLowerCase() : null;
        const existsCheck = await pool.query(
          `SELECT 1 FROM squad_grading_results
           WHERE batch_id = $1 AND day = $2 AND activity_key = $3 AND COALESCE(sub_activity_key, '') = COALESCE($4, '')`,
          [parsedBatchId, day, item.activityKey, itemSubKey]
        );
        if (existsCheck.rowCount === 0) {
          await pool.query(
            `INSERT INTO squad_grading_results
             (batch_id, day, activity_key, sub_activity_key, status, locked_by, locked_at, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [parsedBatchId, day, item.activityKey, itemSubKey, targetStatus, lockedByVal, lockedAtVal, req.user.id]
          );
        }
      }

      await pool.query(
        `INSERT INTO squad_grading_audit_logs
         (batch_id, day, activity_key, sub_activity_key, action, admin_id, admin_name, details)
         VALUES ($1, $2, 'all', null, $3, $4, $5, $6)`,
        [
          parsedBatchId,
          day,
          targetStatus === 'finalized' ? 'finalize_day' : 'reopen_day',
          req.user.id,
          adminName,
          `All activities for ${day} set to ${targetStatus.toUpperCase()}`
        ]
      );
    }

    const allResultsRes = await pool.query(
      `SELECT r.*, 
              u1.name as created_by_name,
              u2.name as updated_by_name,
              u3.name as locked_by_name
       FROM squad_grading_results r
       LEFT JOIN users u1 ON r.created_by = u1.id
       LEFT JOIN users u2 ON r.updated_by = u2.id
       LEFT JOIN users u3 ON r.locked_by = u3.id
       WHERE r.batch_id = $1 
       ORDER BY r.day ASC, r.activity_key ASC`,
      [parsedBatchId]
    );
    const calculated = computeComprehensiveScores(allResultsRes.rows, SQUAD_CANONICAL_NAMES);

    return res.json({
      success: true,
      message: `Status updated to ${targetStatus.toUpperCase()}.`,
      results: allResultsRes.rows,
      leaderboard: calculated.leaderboard,
      squadSummaries: calculated.squadSummaries,
      progressMatrix: calculated.progressMatrix,
      top3: calculated.top3
    });
  } catch (err) {
    console.error('Error in toggleResultStatus:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating grading status',
      error: err.message
    });
  }
};

/**
 * GET /api/superadmin/squad-performance/audit
 * Fetch audit logs
 */
const getSquadPerformanceAudit = async (req, res) => {
  try {
    const { batchId } = req.query;
    if (!batchId) {
      return res.status(400).json({ success: false, message: 'batchId is required' });
    }

    const logsRes = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM squad_grading_audit_logs a
       LEFT JOIN users u ON a.admin_id = u.id
       WHERE a.batch_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [parseInt(batchId, 10)]
    );

    return res.json({
      success: true,
      auditLogs: logsRes.rows
    });
  } catch (err) {
    console.error('Error in getSquadPerformanceAudit:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching audit logs',
      error: err.message
    });
  }
};

module.exports = {
  getSquadPerformance,
  recordSquadGrading,
  toggleResultStatus,
  getSquadPerformanceAudit
};
