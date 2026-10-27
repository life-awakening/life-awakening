const pool = require('../config/db');

/**
 * Middleware to enforce strict server-side authorization for student-specific operations.
 *
 * Requirements:
 * 1. Authenticated parent can only access students linked via parent_students table.
 * 2. Authenticated student can only access their own records.
 * 3. Admins/Superadmins retain authorized administrative access.
 * 4. Changing student ID in header, URL, query, or body never grants access to another family's student.
 * 5. Parent identity (req.user) is preserved and never replaced by student identity.
 */
const authorizeStudentContext = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = (req.user.role || '').toLowerCase();

    // Resolve target student ID from all potential sources
    let rawStudentId =
      req.headers['x-student-id'] ||
      req.headers['x-selected-student-id'] ||
      req.params.studentId ||
      req.query.studentId ||
      req.body?.student_id ||
      req.body?.studentId;

    let targetStudentId = rawStudentId ? parseInt(rawStudentId, 10) : null;

    // 1. Role: student
    if (userRole === 'student') {
      if (targetStudentId && targetStudentId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied: You can only access your own student records.' });
      }
      req.studentId = req.user.id;
      return next();
    }

    // 2. Role: parent
    if (userRole === 'parent') {
      if (!targetStudentId || isNaN(targetStudentId)) {
        // Fallback: If parent has exactly 1 linked child and no header was passed, auto-resolve it
        const childrenRes = await pool.query(
          `SELECT student_id FROM parent_students WHERE parent_id = $1`,
          [req.user.id]
        );
        if (childrenRes.rowCount === 1) {
          targetStudentId = childrenRes.rows[0].student_id;
        } else if (childrenRes.rowCount === 0) {
          return res.status(403).json({ message: 'No registered children found for this parent account.' });
        } else {
          return res.status(400).json({ message: 'Selected child context is required. Please select a child.' });
        }
      }

      // Verify explicit authorization relationship in parent_students
      const authCheck = await pool.query(
        `SELECT ps.student_id, u.name, u.school, u.class_grade
         FROM parent_students ps
         JOIN users u ON ps.student_id = u.id
         WHERE ps.parent_id = $1 AND ps.student_id = $2`,
        [req.user.id, targetStudentId]
      );

      if (authCheck.rowCount === 0) {
        return res.status(403).json({
          message: 'Access denied: You are not authorized to access this student\'s records.'
        });
      }

      req.studentId = targetStudentId;
      req.student = authCheck.rows[0];
      return next();
    }

    // 3. Admin / Superadmin / Faculty roles
    if (['admin', 'superadmin', 'superadmin_readonly', 'faculty', 'ltc_member', 'coordinator'].includes(userRole)) {
      if (targetStudentId && !isNaN(targetStudentId)) {
        req.studentId = targetStudentId;
      }
      return next();
    }

    return res.status(403).json({ message: 'Unauthorized access for this role.' });
  } catch (err) {
    console.error('[authorizeStudentContext Error]:', err);
    return res.status(500).json({ message: 'Authorization error', error: err.message });
  }
};

authorizeStudentContext.authorizeStudentContext = authorizeStudentContext;
module.exports = authorizeStudentContext;
