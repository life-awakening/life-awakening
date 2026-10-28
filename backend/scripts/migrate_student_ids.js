const pool = require('../config/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check batch 35
    const bRes = await client.query('SELECT id, name, batch_code, start_date FROM batches WHERE id = 35');
    console.log('Batch 35:', bRes.rows[0]);
    
    const stRes = await client.query(
      `SELECT u.id, u.system_student_id, u.undertaking_submitted
       FROM batch_students bs
       JOIN users u ON u.id = bs.student_id
       WHERE bs.batch_id = 35
       ORDER BY u.id ASC`
    );
    console.log('Batch 35 enrolled students:', stRes.rows.length);

    let seq = 1;
    for (const s of stRes.rows) {
      const serialStr = String(seq).padStart(2, '0');
      const genId = `LAP-01-1026-${serialStr}`;
      await client.query('UPDATE users SET system_student_id = $1 WHERE id = $2', [genId, s.id]);
      if (s.undertaking_submitted) {
        await client.query('UPDATE users SET onboarding_completed = true, onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()) WHERE id = $1', [s.id]);
      }
      seq++;
    }

    await client.query('COMMIT');
    console.log(`Successfully assigned sequential LAP-01-1026-XX IDs to ${seq - 1} students.`);

    const checkRes = await client.query(
      `SELECT id, name, system_student_id, onboarding_completed, undertaking_submitted
       FROM users
       WHERE system_student_id IS NOT NULL
       ORDER BY system_student_id ASC`
    );
    console.log('Sample updated students:');
    console.log(checkRes.rows.slice(0, 3));
    console.log(checkRes.rows.slice(-3));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
