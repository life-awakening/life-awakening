/**
 * Family Visit Observations (Form V) - cross-student isolation test.
 * Uses 3 enrolled students that currently have NO family rows, writes ISOTEST records via the
 * real API, verifies isolation at API + DB level, then deletes ONLY the rows it created.
 * Requires backend running on :5001.
 */
const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_ltc_secure_jwt_secret_key_2026_dev_prod';

function api({ method = 'GET', path, token, body }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost', port: 5001, path, method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(buf || '{}') }); } catch { resolve({ status: res.statusCode, raw: buf }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const tokenFor = s => jwt.sign({ id: s.id, email: s.email, name: s.name, role: 'student' }, JWT_SECRET, { expiresIn: '1h' });
const names = r => (r.body.families || []).map(f => f.head_of_family_name).sort();

async function run() {
  const picked = (await pool.query(`
    SELECT u.id, u.email, u.name, rbs.ri_batch_id
    FROM ri_batch_students rbs JOIN users u ON u.id = rbs.student_id
    WHERE rbs.ri_panel_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ri_family_surveys f WHERE f.student_id = u.id)
    ORDER BY rbs.ri_batch_id DESC, u.id LIMIT 3`)).rows;
  assert.strictEqual(picked.length, 3, 'need 3 enrolled students without family rows');
  const [A, B, C] = picked;
  const [tA, tB, tC] = picked.map(tokenFor);
  const createdFamilyIds = [];
  const baselineForms = new Set((await pool.query(`SELECT student_id FROM ri_student_forms WHERE form_type='FAMILY_SURVEY'`)).rows.map(r => r.student_id));
  const P = '/api/ri/student/forms/family-surveys';

  try {
    // Baseline: untouched students see blank
    for (const [s, t] of [[A, tA], [B, tB], [C, tC]]) {
      const r = await api({ path: P, token: t });
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.body.families.length, 0, `${s.id} must start blank`);
    }
    console.log('PASS baseline: A,B,C all start blank');

    // A. Student A saves two families
    for (const [n, name] of [[1, 'ISOTEST_A_One'], [2, 'ISOTEST_A_Two']]) {
      const r = await api({ method: 'POST', path: P, token: tA, body: { family_serial_number: n, head_of_family_name: name, total_family_members: 4 } });
      assert.ok(r.status === 200 || r.status === 201, `A save ${n}: ${r.status} ${JSON.stringify(r.body)}`);
      createdFamilyIds.push(r.body.family?.id);
    }
    // B. B sees nothing of A's
    let rb = await api({ path: P, token: tB });
    assert.deepStrictEqual(names(rb), [], 'B must not see A records');
    console.log('PASS B: sees no records of A');
    // C. B saves different record (same serial 1 as A -> must not collide)
    const sb = await api({ method: 'POST', path: P, token: tB, body: { family_serial_number: 1, head_of_family_name: 'ISOTEST_B_One', total_family_members: 3 } });
    assert.ok(sb.status === 200 || sb.status === 201, `B save: ${sb.status}`);
    createdFamilyIds.push(sb.body.family?.id);
    // D. A reopens: only own two
    let ra = await api({ path: P, token: tA });
    assert.deepStrictEqual(names(ra), ['ISOTEST_A_One', 'ISOTEST_A_Two'], 'A sees only own two');
    assert.strictEqual(ra.body.recorded_count, 2);
    console.log('PASS A: sees only own 2 records, count=2');
    rb = await api({ path: P, token: tB });
    assert.deepStrictEqual(names(rb), ['ISOTEST_B_One']);
    assert.strictEqual(rb.body.recorded_count, 1);
    console.log('PASS B: sees only own 1 record, count=1 (serial #1 independent of A)');
    // E. C blank
    const rc = await api({ path: P, token: tC });
    assert.deepStrictEqual(names(rc), [], 'C blank');
    assert.strictEqual(rc.body.status, 'Not Started');
    console.log('PASS C: blank, status Not Started');

    // Cross-student write/delete attempts via PUT/DELETE using A's row id as B
    const aRow = ra.body.families.find(f => f.family_serial_number === 1);
    const hijack = await api({ method: 'PUT', path: `${P}/${aRow.id}`, token: tB, body: { family_serial_number: 1, head_of_family_name: 'ISOTEST_HIJACK' } });
    await api({ method: 'DELETE', path: `${P}/${aRow.id}`, token: tC });
    ra = await api({ path: P, token: tA });
    assert.deepStrictEqual(names(ra), ['ISOTEST_A_One', 'ISOTEST_A_Two'], "A's records untouched by B PUT / C DELETE");
    console.log(`PASS cross-student PUT(status ${hijack.status}) / DELETE by others do not alter A's rows`);

    // DB ownership
    const own = (await pool.query(`SELECT student_id, count(*)::int c FROM ri_family_surveys WHERE head_of_family_name LIKE 'ISOTEST%' GROUP BY student_id ORDER BY student_id`)).rows;
    const m = Object.fromEntries(own.map(r => [String(r.student_id), r.c]));
    assert.strictEqual(m[String(A.id)], 2); assert.strictEqual(m[String(B.id)], 1); assert.strictEqual(m[String(C.id)], undefined);
    console.log('PASS DB ownership: A=2, B=1, C=0 rows', m);

    // F. Re-login (fresh token) persistence
    ra = await api({ path: P, token: tokenFor(A) });
    assert.deepStrictEqual(names(ra), ['ISOTEST_A_One', 'ISOTEST_A_Two']);
    console.log('PASS re-login persistence for A');
    console.log('\nALL ISOLATION CHECKS PASSED');
  } finally {
    // Cleanup only what this test created
    await pool.query(`DELETE FROM ri_family_surveys WHERE head_of_family_name LIKE 'ISOTEST%'`);
    for (const s of picked) {
      if (!baselineForms.has(s.id)) await pool.query(`DELETE FROM ri_student_forms WHERE student_id=$1 AND form_type='FAMILY_SURVEY'`, [s.id]);
    }
    console.log('Cleanup done (test rows only).');
    await pool.end();
  }
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
