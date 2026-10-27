const pool = require('./config/db');

async function main() {
  try {
    const students = await pool.query("SELECT email, role, name FROM users WHERE role = 'student' LIMIT 2");
    const faculties = await pool.query("SELECT email, role, name FROM users WHERE role = 'faculty' LIMIT 2");
    console.log("Students:", students.rows);
    console.log("Faculties:", faculties.rows);
  } catch (err) {
    console.error("Error connecting to DB:", err);
  } finally {
    await pool.end();
  }
}
main();
