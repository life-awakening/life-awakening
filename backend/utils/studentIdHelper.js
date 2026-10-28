/**
 * studentIdHelper.js
 *
 * Provides batch-based sequential System Student ID generation in the format:
 *   LAP-{BATCH_NUMBER}-{BATCH_CODE}-{SERIAL_NUMBER}
 *
 * Examples for Batch 01, October 2026:
 *   LAP-01-1026-01
 *   LAP-01-1026-02
 *   ...
 *   LAP-01-1026-99
 *   LAP-01-1026-100
 */

/**
 * Derives batch number (2 digits), batch code (MMYY), and prefix 'LAP-{BATCH_NUMBER}-{BATCH_CODE}'
 * from a batch record or batch start date.
 */
function deriveBatchInfo(batch) {
  if (!batch) {
    return {
      batchNumber: '01',
      batchCode: '1026',
      prefix: 'LAP-01-1026'
    };
  }

  let batchNumber = null;
  let batchCode = null;

  // 1. Try matching batch_code (e.g. '01-1026' or 'LAP-01-1026')
  if (batch.batch_code) {
    const m = String(batch.batch_code).match(/^(?:LAP-)?(\d+)[-_](\d{3,4})$/i);
    if (m) {
      batchNumber = m[1].padStart(2, '0');
      batchCode = m[2];
    }
  }

  // 2. Try matching batch name (e.g. 'LAP-01-1026' or 'Batch 01' or 'Batch 1')
  if ((!batchNumber || !batchCode) && batch.name) {
    const m = String(batch.name).match(/LAP-(\d+)-(\d{3,4})/i);
    if (m) {
      batchNumber = batchNumber || m[1].padStart(2, '0');
      batchCode = batchCode || m[2];
    } else {
      const mb = String(batch.name).match(/(?:Batch|LAP)\s*#?\s*(\d+)/i);
      if (mb) {
        batchNumber = batchNumber || mb[1].padStart(2, '0');
      }
    }
  }

  // 3. Fallback for batchNumber
  if (!batchNumber) {
    if (batch.batch_number != null) {
      batchNumber = String(batch.batch_number).padStart(2, '0');
    } else if (batch.id != null) {
      batchNumber = String(batch.id).padStart(2, '0');
    } else {
      batchNumber = '01';
    }
  }

  // 4. Derive batchCode from start_date if not parsed
  if (!batchCode && batch.start_date) {
    try {
      const d = new Date(batch.start_date);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yy = String(d.getUTCFullYear()).slice(-2);
        batchCode = `${mm}${yy}`;
      }
    } catch (_) {}
  }

  if (!batchCode) {
    batchCode = '1026';
  }

  return {
    batchNumber,
    batchCode,
    prefix: `LAP-${batchNumber}-${batchCode}`
  };
}

/**
 * Format sequential number with leading zeros (at least 2 digits).
 * 1 -> '01', 2 -> '02', 99 -> '99', 100 -> '100', 101 -> '101'
 */
function formatSerial(num) {
  return num < 100 ? String(num).padStart(2, '0') : String(num);
}

/**
 * Transaction-safely generates the next sequential System Student ID for a given batch.
 * Acquires a row-level lock on the batch to prevent concurrent race conditions.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} client - Database connection/client
 * @param {number|string} batchId - Batch ID
 * @returns {Promise<string>} Next unique System Student ID
 */
async function generateNextSystemStudentId(client, batchId) {
  const ids = await generateNextSystemStudentIds(client, batchId, 1);
  return ids[0];
}

/**
 * Generates an array of N consecutive sequential System Student IDs for a batch.
 * Useful for bulk uploads and multi-student batch assignments.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} client - Database connection/client
 * @param {number|string} batchId - Batch ID
 * @param {number} count - How many IDs to generate
 * @returns {Promise<string[]>} Array of unique sequential System Student IDs
 */
async function generateNextSystemStudentIds(client, batchId, count = 1) {
  if (count <= 0) return [];

  // Lock the batch record to ensure atomicity across concurrent transactions
  let batchRow = null;
  if (batchId) {
    const bRes = await client.query(
      `SELECT id, name, batch_code, start_date FROM batches WHERE id = $1 FOR UPDATE`,
      [batchId]
    );
    if (bRes.rows.length > 0) {
      batchRow = bRes.rows[0];
    }
  }

  const { prefix } = deriveBatchInfo(batchRow);

  // Find highest serial currently assigned for this prefix in users table
  const maxRes = await client.query(
    `SELECT substring(system_student_id from '[0-9]+$')::int AS max_serial
     FROM users
     WHERE system_student_id LIKE $1 || '-%'
     ORDER BY max_serial DESC
     LIMIT 1`,
    [prefix]
  );

  let currentSerial = 0;
  if (maxRes.rows.length > 0 && maxRes.rows[0].max_serial != null) {
    currentSerial = Number(maxRes.rows[0].max_serial);
  }

  const generated = [];
  for (let i = 1; i <= count; i++) {
    const nextSerial = currentSerial + i;
    generated.push(`${prefix}-${formatSerial(nextSerial)}`);
  }

  return generated;
}

module.exports = {
  deriveBatchInfo,
  formatSerial,
  generateNextSystemStudentId,
  generateNextSystemStudentIds
};
