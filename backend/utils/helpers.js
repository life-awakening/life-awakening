const pool = require('../config/db');

const getLtcId = (prn) => {
  if (!prn) return null;
  const digits = String(prn).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : prn;
};

const isInternalEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return clean.endsWith('@lifeawakening.internal') || clean.includes('@lifeawakening.internal');
};

const sanitizeStudentEmail = (email, personalEmail = null) => {
  if (!email || isInternalEmail(email)) {
    if (personalEmail && !isInternalEmail(personalEmail)) {
      return personalEmail;
    }
    return null;
  }
  return email;
};

const withLtcId = async (rows) => {
  if (!rows || rows.length === 0) return [];
  try {
    const batchesRes = await pool.query(`
      SELECT id, start_date 
      FROM batches 
      WHERE (is_deleted = false OR is_deleted IS NULL) 
      ORDER BY id ASC
    `);
    
    const batchNoMap = {};
    const batchDateMap = {};
    batchesRes.rows.forEach((b, idx) => {
      batchNoMap[b.id] = String(idx + 1).padStart(2, '0');
      batchDateMap[b.id] = b.start_date;
    });

    const res = await pool.query(`
      SELECT
        bs.student_id,
        bs.batch_id,
        ROW_NUMBER() OVER (PARTITION BY bs.batch_id ORDER BY u.id) AS serial_no
      FROM batch_students bs
      JOIN users u ON bs.student_id = u.id
      JOIN batches b ON bs.batch_id = b.id
      WHERE (b.is_deleted = false OR b.is_deleted IS NULL)
    `);

    const ltcIdMap = {};
    res.rows.forEach(r => {
      const batchNoStr = batchNoMap[r.batch_id] || '01';
      const start_date = batchDateMap[r.batch_id];
      const serial = r.serial_no;

      let monthStr = '07';
      let yearStr = '26';
      if (start_date) {
        const d = new Date(start_date);
        monthStr = String(d.getMonth() + 1).padStart(2, '0');
        yearStr = String(d.getFullYear()).slice(-2);
      }
      const myStr = monthStr + yearStr;
      const serialStr = String(serial).padStart(3, '0');

      ltcIdMap[r.student_id] = `${batchNoStr}-${myStr}-${serialStr}`;
    });

    // Lookup parents from parent_students for student records in rows
    const studentIds = rows
      .map(r => r.id || r.student_id)
      .filter(id => id && Number.isInteger(Number(id)))
      .map(Number);

    const parentMap = {};
    if (studentIds.length > 0) {
      try {
        const psRes = await pool.query(`
          SELECT ps.student_id, ps.parent_id, ps.is_primary, ps.relationship,
                 p.name, p.email, p.phone
          FROM parent_students ps
          JOIN users p ON ps.parent_id = p.id
          WHERE ps.student_id = ANY($1::int[])
          ORDER BY ps.student_id, ps.is_primary DESC NULLS LAST, ps.created_at ASC NULLS LAST, p.id ASC
        `, [studentIds]);

        for (const pr of psRes.rows) {
          if (!parentMap[pr.student_id]) {
            parentMap[pr.student_id] = [];
          }
          parentMap[pr.student_id].push(pr);
        }
      } catch (parentLookupErr) {
        console.error('[withLtcId ParentLookup Error]', parentLookupErr.message);
      }
    }

    return rows.map(r => {
      const isRiDirect = r.source_program === 'RI_DIRECT' || r.batch_source === 'RI_DIRECT';
      const sId = r.id || r.student_id;
      const isStudent = r.role === 'student' || (!r.role && Boolean(sId)) || isInternalEmail(r.email);

      let cleanEmail = r.email;
      let internalEmail = r.internal_email || null;
      if (isInternalEmail(r.email)) {
        internalEmail = r.email;
        cleanEmail = sanitizeStudentEmail(r.email, r.personal_email);
      }

      // Check student_email field if present
      let cleanStudentEmail = r.student_email;
      if (isInternalEmail(r.student_email)) {
        cleanStudentEmail = null;
      }

      // Parent mapping
      const studentParents = parentMap[sId] || [];
      const p1 = studentParents[0] || null;
      const p2 = studentParents[1] || null;

      const parent1Email = p1?.email || r.parent1_email || (r.parent_email && !isInternalEmail(r.parent_email) ? r.parent_email : null);
      const parent2Email = p2?.email || r.parent2_email || null;
      const parent1Name = p1?.name || r.parent1_name || r.parent_name || null;
      const parent2Name = p2?.name || r.parent2_name || null;
      const parent1Phone = p1?.phone || r.parent1_phone || r.parent_mobile || null;
      const parent2Phone = p2?.phone || r.parent2_phone || null;
      const parent1Rel = p1?.relationship || r.parent1_relationship || r.parent_relationship || null;
      const parent2Rel = p2?.relationship || r.parent2_relationship || null;

      let cleanParentEmail = r.parent_email;
      if (isInternalEmail(cleanParentEmail)) {
        cleanParentEmail = parent1Email;
      } else if (!cleanParentEmail) {
        cleanParentEmail = parent1Email;
      }

      const parentsList = studentParents.length > 0
        ? studentParents.map(p => ({
            id: p.parent_id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            relationship: p.relationship,
            is_primary: p.is_primary
          }))
        : (Array.isArray(r.parents) ? r.parents : []);

      return {
        ...r,
        email: cleanEmail,
        ...(cleanStudentEmail !== undefined ? { student_email: cleanStudentEmail } : {}),
        internal_email: internalEmail,
        ltc_id: isRiDirect ? null : (ltcIdMap[sId] || getLtcId(r.prn)),
        parent1_name: parent1Name,
        parent1_email: parent1Email,
        parent1_phone: parent1Phone,
        parent1_relationship: parent1Rel,
        parent2_name: parent2Name,
        parent2_email: parent2Email,
        parent2_phone: parent2Phone,
        parent2_relationship: parent2Rel,
        parent_email: cleanParentEmail,
        parents: parentsList
      };
    });
  } catch (err) {
    console.error('[withLtcId Error]', err.message);
    return rows.map(r => {
      const isRiDirect = r.source_program === 'RI_DIRECT' || r.batch_source === 'RI_DIRECT';
      let cleanEmail = r.email;
      let internalEmail = r.internal_email || null;
      if (isInternalEmail(r.email)) {
        internalEmail = r.email;
        cleanEmail = sanitizeStudentEmail(r.email, r.personal_email);
      }
      return {
        ...r,
        email: cleanEmail,
        internal_email: internalEmail,
        ltc_id: isRiDirect ? null : getLtcId(r.prn)
      };
    });
  }
};

const writeAudit = (userId, userName, action, entityType, entityId, details) => {
  pool.query(
    `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId || null, userName || 'System', action, entityType || null, entityId || null, details ? JSON.stringify(details) : null]
  ).then(() => {
    pool.query(
      `DELETE FROM audit_logs 
       WHERE id NOT IN (
         SELECT id FROM audit_logs 
         ORDER BY created_at DESC, id DESC 
         LIMIT 100
       )`
    ).catch(err => console.error('[AuditLog Prune Error]', err.message));
  }).catch(err => console.error('[AuditLog Error]', err.message));
};

const createSystemNotification = async (userId, title, message, type = 'info', sentBy = null) => {
  try {
    const notifResult = await pool.query(
      `INSERT INTO notifications (title, message, type, channel, target_type, target_user_id, sent_by, recipient_count)
       VALUES ($1, $2, $3, 'in-app', 'individual', $4, $5, 1) RETURNING id`,
      [title, message, type, userId, sentBy]
    );
    const notifId = notifResult.rows[0].id;
    await pool.query(
      `INSERT INTO user_notifications (notification_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [notifId, userId]
    );
    return notifId;
  } catch (err) {
    console.error('[createSystemNotification Error]', err.message);
    return null;
  }
};

module.exports = {
  getLtcId,
  withLtcId,
  writeAudit,
  createSystemNotification,
  isInternalEmail,
  sanitizeStudentEmail
};

