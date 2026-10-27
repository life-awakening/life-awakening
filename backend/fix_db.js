const pool = require('./config/db');

async function fix() {
  try {
    await pool.query("ALTER TABLE evaluations ADD COLUMN schedule_id INT");
    console.log("Column schedule_id added successfully!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fix();
