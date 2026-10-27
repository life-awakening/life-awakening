const pool = require('../config/db');

async function inspectExcludedStudents() {
  const res = await pool.query(`
    SELECT 
      bs.student_id,
      bs.squad,
      bs.is_dnr,
      u.name,
      u.email,
      u.gender,
      u.prn,
      u.roll_number
    FROM batch_students bs
    LEFT JOIN users u ON bs.student_id = u.id
    WHERE bs.batch_id = 73
      AND bs.is_dnr IS NOT TRUE
      AND (
        u.gender IS NULL 
        OR LOWER(TRIM(u.gender)) NOT IN ('male', 'm', 'boy', 'female', 'f', 'girl')
      )
  `);

  console.log('The exact non-DNR students not categorized into Boys or Girls:');
  console.table(res.rows);

  const dnrRes = await pool.query(`
    SELECT 
      bs.student_id,
      bs.squad,
      bs.is_dnr,
      u.name,
      u.email,
      u.gender
    FROM batch_students bs
    LEFT JOIN users u ON bs.student_id = u.id
    WHERE bs.batch_id = 73 AND bs.is_dnr IS TRUE
  `);
  console.log('\nThe 3 DNR students:');
  console.table(dnrRes.rows);

  await pool.end();
}

inspectExcludedStudents().catch(e => {
  console.error(e);
  process.exit(1);
});
