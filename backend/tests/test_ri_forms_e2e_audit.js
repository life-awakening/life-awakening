/**
 * RI Forms - Student -> Faculty end-to-end audit (API + DB level).
 *
 * SAFETY: creates its OWN fixtures (ISOAUDIT batch/village/panel, 4 students, 1 faculty assignment),
 * never touches existing students, and deletes only rows it created (by id) in `finally`.
 * Requires the local backend on :5001 and local DB (verified at start).
 *
 * Output: a PASS / FAIL line per check, and a final matrix. Exit code 1 if any FAIL.
 */
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const pool = require('../config/db');

const BASE = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET;
const TAG = `ISOAUDIT_${Date.now()}`;

const results = []; // {form, check, ok, detail}
const fixtures = { batchId: null, villageId: null, panelId: null, students: [], facultyRowId: null, facultyEmail: `${TAG.toLowerCase()}_fac@example.invalid` };
const uploadedFiles = [];

function rec(form, check, ok, detail = '') {
  results.push({ form, check, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${form}] ${check}${detail ? ' :: ' + detail : ''}`);
}
function info(form, note) { console.log(`INFO [${form}] ${note}`); infos.push({ form, note }); }
const infos = [];
// order-insensitive deep compare (jsonb does not preserve key order)
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));

async function api(method, p, token, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = {};
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

async function upload(p, token, field, filename, buf, mime) {
  const fd = new FormData();
  fd.append(field, new Blob([buf], { type: mime }), filename);
  const res = await fetch(BASE + p, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  let json = {};
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

const norm = v => (v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
const dateOnly = v => (v ? String(v).slice(0, 10) : '');
const sameVal = (e, a) => (norm(e) === norm(a)) || (e !== '' && e !== null && !isNaN(Number(e)) && !isNaN(Number(a)) && a !== '' && a !== null && Number(e) === Number(a));

function diffFields(expected, actual, keys) {
  const bad = [];
  for (const k of keys) {
    const e = expected[k];
    let a = actual?.[k];
    if (/_date$|^visit_date$/.test(k)) { if (dateOnly(e) !== dateOnly(a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`); continue; }
    if (Array.isArray(e)) { if (JSON.stringify(e) !== JSON.stringify(typeof a === 'string' ? JSON.parse(a) : a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`); continue; }
    if (!sameVal(e, a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`);
  }
  return bad;
}

// ────────────────────────── fixtures ──────────────────────────
async function setup() {
  const db = (await pool.query('select current_database() db')).rows[0].db;
  if (db !== 'ltc_ri_development') throw new Error(`Refusing to run on database "${db}"`);
  console.log(`Active DB verified: ${db}`);

  const b = await pool.query(`INSERT INTO ri_batches (name) VALUES ($1) RETURNING id`, [TAG]);
  fixtures.batchId = b.rows[0].id;
  const v = await pool.query(`INSERT INTO ri_villages (ri_batch_id, name) VALUES ($1,$2) RETURNING id`, [fixtures.batchId, `${TAG}_Village`]);
  fixtures.villageId = v.rows[0].id;
  const p = await pool.query(`INSERT INTO ri_panels (ri_batch_id, panel_number, name, ri_village_id) VALUES ($1, 1, $2, $3) RETURNING id`, [fixtures.batchId, `${TAG}_Panel`, fixtures.villageId]);
  fixtures.panelId = p.rows[0].id;

  for (const label of ['A', 'B', 'C', 'D']) {
    const email = `${TAG.toLowerCase()}_${label.toLowerCase()}@example.invalid`;
    const u = await pool.query(`INSERT INTO users (name, email, password, role) VALUES ($1,$2,'x','student') RETURNING id`, [`${TAG} Student ${label}`, email]);
    await pool.query(`INSERT INTO ri_batch_students (ri_batch_id, student_id, ri_panel_id) VALUES ($1,$2,$3)`, [fixtures.batchId, u.rows[0].id, fixtures.panelId]);
    fixtures.students.push({ label, id: u.rows[0].id, email, name: `${TAG} Student ${label}`, token: jwt.sign({ id: u.rows[0].id, email, name: `${TAG} Student ${label}`, role: 'student' }, JWT_SECRET, { expiresIn: '2h' }) });
  }
  const f = await pool.query(`INSERT INTO ri_batch_faculty (ri_batch_id, ri_panel_id, name, email, role, status) VALUES ($1,$2,$3,$4,'Lead Mentor','active') RETURNING id`, [fixtures.batchId, fixtures.panelId, `${TAG} Faculty`, fixtures.facultyEmail]);
  fixtures.facultyRowId = f.rows[0].id;
  fixtures.facultyToken = jwt.sign({ email: fixtures.facultyEmail, name: `${TAG} Faculty`, role: 'faculty' }, JWT_SECRET, { expiresIn: '2h' });
}

async function cleanup() {
  const ids = fixtures.students.map(s => s.id);
  try {
    if (ids.length) {
      for (const t of ['ri_preparatory_checklists', 'ri_daily_activity_reports', 'ri_institutional_visits', 'ri_family_surveys', 'ri_problem_identifications', 'ri_community_projects', 'ri_student_feedbacks', 'ri_undertakings', 'ri_student_forms', 'ri_audit_logs']) {
        await pool.query(`DELETE FROM ${t} WHERE student_id = ANY($1)`, [ids]).catch(e => console.log(`cleanup ${t}: ${e.message}`));
      }
      await pool.query(`DELETE FROM ri_batch_students WHERE student_id = ANY($1)`, [ids]);
      await pool.query(`DELETE FROM users WHERE id = ANY($1) AND email LIKE '%@example.invalid'`, [ids]);
    }
    if (fixtures.facultyRowId) await pool.query(`DELETE FROM ri_batch_faculty WHERE id=$1`, [fixtures.facultyRowId]);
    if (fixtures.panelId) await pool.query(`DELETE FROM ri_panels WHERE id=$1`, [fixtures.panelId]);
    if (fixtures.villageId) await pool.query(`DELETE FROM ri_villages WHERE id=$1`, [fixtures.villageId]);
    if (fixtures.batchId) await pool.query(`DELETE FROM ri_batches WHERE id=$1`, [fixtures.batchId]);
    for (const f of uploadedFiles) { try { fs.unlinkSync(f); } catch { /* ignore */ } }
    console.log('Cleanup done (only rows/files created by this audit).');
  } catch (e) { console.log('CLEANUP ERROR (manual check needed):', e.message); }
}

const facultyQ = `batch_id=${() => fixtures.batchId}`;
const fq = () => `batch_id=${fixtures.batchId}&panel_id=${fixtures.panelId}`;
const SF = '/api/ri/student/forms';
const facultyDetail = sid => api('GET', `/api/ri/faculty/students/${sid}/workspace?${fq()}`, fixtures.facultyToken);
const summaryOf = (detail, type) => (detail.body.forms_summary || []).find(f => f.form_type === type) || {};
const hubOf = async (s, type) => {
  const r = await api('GET', `${SF.replace('/forms', '')}/forms`, s.token);
  return (r.body.forms || []).find(f => f.form_type === type) || {};
};
const unique = (s, extra = '') => `${TAG}_${s.label}_${extra}`;

// ────────────────────────── per-form definitions ──────────────────────────
const FORMS = {
  PREPARATORY_CHECKLIST: {
    name: 'FORM IB Preparatory Checklist', ep: `${SF}/preparatory-checklist`, getKey: 'checklist', facKey: 'preparatory_checklist',
    draft: s => ({ parents_informed: true, medical_checkup_done: s.label === 'A', signed_undertaking: false, clothing_ready: true, role_assigned: unique(s, 'role'), additional_notes: unique(s, 'notes_draft'), status: 'Draft' }),
    final: s => ({ parents_informed: true, medical_checkup_done: true, signed_undertaking: true, clothing_ready: true, beddings_ready: true, toiletries_ready: true, medicines_ready: true, laptop_dongle_ready: true, blank_notebook_ready: true, college_id_card: true, shoes_sportswear: true, emergency_contacts_saved: true, role_assigned: unique(s, 'role'), additional_notes: unique(s, 'notes_final'), status: 'Submitted' }),
    keys: ['parents_informed', 'medical_checkup_done', 'signed_undertaking', 'clothing_ready', 'beddings_ready', 'toiletries_ready', 'role_assigned', 'additional_notes'],
    textKey: 'additional_notes',
    emptyFinal: { status: 'Submitted' }
  },
  DAILY_ACTIVITY_REPORT: {
    name: 'FORM IIIB Daily Activity Report', ep: `${SF}/daily-activity-report`, getKey: 'report', facKey: 'daily_activity',
    draft: s => ({ student_name: unique(s, 'nm'), village_visited: unique(s, 'vil'), community_project_types: ['Plantation'], community_project_work_done: unique(s, 'cp_draft'), status: 'Draft' }),
    final: s => ({
      student_name: unique(s, 'nm'), school_name: unique(s, 'sch'), degree_program: unique(s, 'deg'), village_visited: unique(s, 'vil'), total_days_in_village: '5 Days',
      seven_day_plan_completed: 'Yes', seven_day_plan_improvements: unique(s, 'imp'), community_project_types: ['Plantation', 'Cleanliness'], community_project_other_text: unique(s, 'oth'),
      community_project_work_done: unique(s, 'cp_final'), community_project_suggestions: unique(s, 'cpsug'), study_group_included: 'Yes', study_problem_title: unique(s, 'prob'),
      study_solution_submitted: 'Yes', study_presented_to_committee: 'Yes', study_suggestions: unique(s, 'ssug'), institutions_visited_count: 3, institutional_visits_suggestions: unique(s, 'isug'),
      homes_visited_count: 6, home_visits_suggestions: unique(s, 'hsug'), school_activity_types: ['Quiz'], school_activity_other_text: unique(s, 'sao'), school_name_engaged: unique(s, 'sne'),
      school_students_count: 42, school_activity_details: unique(s, 'sad'), school_activity_suggestions: unique(s, 'sas'), activity_photo_1: `http://x/${unique(s, 'p1')}.jpg`, activity_photo_2: `http://x/${unique(s, 'p2')}.jpg`,
      best_practices_observed: unique(s, 'bp'), other_activities_implemented: unique(s, 'oa'), issues_affecting_implementation: unique(s, 'iss'), suggestions_to_improve_program: unique(s, 'spi'), remarks: unique(s, 'rem'), status: 'Submitted'
    }),
    keys: ['student_name', 'school_name', 'degree_program', 'village_visited', 'total_days_in_village', 'seven_day_plan_completed', 'seven_day_plan_improvements', 'community_project_types', 'community_project_other_text', 'community_project_work_done', 'community_project_suggestions', 'study_group_included', 'study_problem_title', 'study_solution_submitted', 'study_presented_to_committee', 'study_suggestions', 'institutions_visited_count', 'institutional_visits_suggestions', 'homes_visited_count', 'home_visits_suggestions', 'school_activity_types', 'school_activity_other_text', 'school_name_engaged', 'school_students_count', 'school_activity_details', 'school_activity_suggestions', 'activity_photo_1', 'activity_photo_2', 'best_practices_observed', 'other_activities_implemented', 'issues_affecting_implementation', 'suggestions_to_improve_program', 'remarks'],
    textKey: 'community_project_work_done',
    emptyFinal: { status: 'Submitted' }
  },
  PROBLEM_IDENTIFICATION: {
    name: 'FORM VI Problem Identification & SMART Solution', ep: `${SF}/problem-identification`, getKey: 'problem', facKey: 'problem_identification',
    draft: s => ({ school_name: unique(s, 'sch'), problem_title: unique(s, 'title_draft'), status: 'Draft' }),
    final: s => ({
      school_name: unique(s, 'sch'), department_name: unique(s, 'dept'), degree_program: unique(s, 'deg'), village_visited: unique(s, 'vil'), students_participated: 7, team_leader_name: unique(s, 'lead'), total_team_members: 6,
      problem_title: unique(s, 'title_final'), is_aligned_with_sdg: 'Yes', is_related_to_degree: 'Yes', solution_offered: 'Yes', helping_faculty_name: unique(s, 'hf'), helping_faculty_dept: unique(s, 'hfd'),
      solution_is_practical_implementable: 'Yes', committee_chairperson: unique(s, 'chair'), presentation_date: '2026-10-10', committee_remarks: unique(s, 'crem'), sarpanch_informed_details: unique(s, 'sarp'),
      ri_cell_submission_details: unique(s, 'ricell'), assignment_link: `http://x/${unique(s, 'doc')}.pdf`, presentation_link: `http://x/${unique(s, 'ppt')}`, status: 'Submitted'
    }),
    keys: ['school_name', 'department_name', 'degree_program', 'village_visited', 'students_participated', 'team_leader_name', 'total_team_members', 'problem_title', 'solution_offered', 'helping_faculty_name', 'helping_faculty_dept', 'solution_is_practical_implementable', 'committee_chairperson', 'presentation_date', 'committee_remarks', 'sarpanch_informed_details', 'ri_cell_submission_details', 'assignment_link', 'presentation_link'],
    textKey: 'problem_title',
    emptyFinal: { status: 'Submitted' }
  },
  STUDENT_FEEDBACK: {
    name: 'FORM VIII RI Feedback Form', ep: `${SF}/feedback`, getKey: 'feedback', facKey: 'student_feedback',
    // Shape sent by RiFormsHub.jsx FeedbackForm (preparePayload)
    draft: s => ({ rating_institutional_visits: 0, rating_household_surveys: 3, rating_community_project: 0, rating_debrief_school_activity: 0, best_practices_observed: unique(s, 'bp_draft'), impactful_learning: unique(s, 'learn'), overall_rating: 5, mentorship_rating: 5, village_reception_rating: 5, logistics_rating: 4, willing_for_followup: true, status: 'Draft' }),
    final: s => ({ rating_institutional_visits: 4, rating_household_surveys: 3, rating_community_project: 5, rating_debrief_school_activity: 2, best_practices_observed: unique(s, 'bp_final'), other_activities_implemented: unique(s, 'oa'), issues_affecting_implementation: unique(s, 'iss'), suggestions_to_improve_program: unique(s, 'sug'), impactful_learning: unique(s, 'learn'), paradigm_shift: unique(s, 'shift'), overall_rating: 4, mentorship_rating: 3, village_reception_rating: 2, logistics_rating: 1, willing_for_followup: false, status: 'Submitted' }),
    keys: ['rating_institutional_visits', 'rating_household_surveys', 'rating_community_project', 'rating_debrief_school_activity', 'best_practices_observed', 'other_activities_implemented', 'issues_affecting_implementation', 'suggestions_to_improve_program', 'paradigm_shift', 'mentorship_rating', 'village_reception_rating', 'logistics_rating', 'willing_for_followup'],
    // frontend reads these keys from the GET response to restore the form
    restoreKeys: ['rating_institutional_visits', 'rating_household_surveys', 'rating_community_project', 'rating_debrief_school_activity', 'best_practices_observed', 'other_activities_implemented', 'issues_affecting_implementation', 'suggestions_to_improve_program', 'impactful_learning', 'paradigm_shift', 'mentorship_rating', 'village_reception_rating', 'logistics_rating', 'willing_for_followup'],
    textKey: 'best_practices_observed',
    emptyFinal: { status: 'Submitted' },
    // partial final (ratings omitted): backend must reject
    partialFinal: { best_practices_observed: 'only text', status: 'Submitted' }
  },
  COMMUNITY_PROJECT: {
    name: 'FORM VII Community Project', ep: `${SF}/community-project`, getKey: 'project', facKey: 'community_project',
    // Shape sent by RiFormsHub.jsx CommunityProjectForm
    draft: s => ({ project_title: unique(s, 'ptitle'), strategic_pillar: 'Environmental Sustainability & Green Village', hours_spent: 3, village_location: unique(s, 'loc'), beneficiaries_reached: 25, work_description: unique(s, 'work_draft'), status: 'Draft' }),
    final: s => ({ project_title: unique(s, 'ptitle'), strategic_pillar: 'Environmental Sustainability & Green Village', hours_spent: 5.5, village_location: unique(s, 'loc'), beneficiaries_reached: 80, work_description: unique(s, 'work_final'), quantifiable_output: unique(s, 'out'), community_feedback: unique(s, 'cfb'), photos_link: `http://x/${unique(s, 'ph')}.jpg`, status: 'Submitted' }),
    // compare against DB/faculty column names
    colMap: { project_title: 'project_title', strategic_pillar: 'pillar_type', hours_spent: 'hours_spent', village_location: 'location_in_village', work_description: 'team_role_and_work_done', quantifiable_output: 'quantifiable_output', community_feedback: 'community_feedback', photos_link: 'photos_link' },
    keys: ['project_title', 'strategic_pillar', 'hours_spent', 'village_location', 'work_description', 'quantifiable_output', 'community_feedback', 'photos_link'],
    restoreKeys: ['project_title', 'strategic_pillar', 'hours_spent', 'village_location', 'beneficiaries_reached', 'work_description', 'quantifiable_output', 'community_feedback', 'photos_link'],
    textKey: 'work_description',
    emptyFinal: { status: 'Submitted' }
  }
};

async function auditSimpleForm(type, def, [A, B, C, D]) {
  const F = def.name;
  const get = async s => (await api('GET', def.ep, s.token));
  const fieldsOf = (resp) => resp.body[def.getKey] || null;
  const mapped = (obj, k) => (def.colMap ? obj?.[def.colMap[k]] : obj?.[k]);
  const cmp = (sent, row, keys) => {
    const bad = [];
    for (const k of keys) {
      const e = sent[k]; const a = mapped(row, k);
      if (/_date$/.test(k)) { if (dateOnly(e) !== dateOnly(a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`); continue; }
      if (Array.isArray(e)) { if (JSON.stringify(e) !== JSON.stringify(typeof a === 'string' ? JSON.parse(a) : a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`); continue; }
      if (typeof e === 'number' || typeof e === 'boolean') { if (Number(e) !== Number(a) && norm(e) !== norm(a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`); continue; }
      if (!sameVal(e, a)) bad.push(`${k}: sent=${norm(e)} got=${norm(a)}`);
    }
    return bad;
  };

  // C / blank state (before anything is saved by anyone)
  let r = await get(C);
  rec(F, 'Student C blank/default state (Not Started)', r.status === 200 && !fieldsOf(r) && (r.body.form_status?.status === 'Not Started'), `status=${r.status} form_status=${r.body.form_status?.status}`);

  // A: draft save
  const dA = def.draft(A);
  r = await api('POST', def.ep, A.token, dA);
  rec(F, 'A draft save returns 200 + status Draft', r.status === 200 && r.body.status === 'Draft', `status=${r.status} body.status=${r.body.status} msg=${r.body.message}`);
  // restore
  r = await get(A);
  const rowA = fieldsOf(r);
  rec(F, 'A draft persisted in DB table and form_status=Draft (not Submitted)', !!rowA && r.body.form_status?.status === 'Draft', `form_status=${r.body.form_status?.status}`);
  // restore as the frontend reads it
  const restoreKeys = def.restoreKeys || def.keys;
  const missingRestore = restoreKeys.filter(k => {
    const sentVal = dA[k];
    if (sentVal === undefined || sentVal === '' || sentVal === 0) return false;
    return !sameVal(sentVal, rowA?.[k]);
  });
  rec(F, 'A draft restores correctly using the keys the student form reads on reopen', missingRestore.length === 0, missingRestore.length ? `NOT restored under frontend keys: ${missingRestore.join(', ')}` : '');
  const hubDraft = await hubOf(A, type);
  if (hubDraft.status !== undefined && type !== 'COMMUNITY_PROJECT') rec(F, 'Hub shows Draft with progress < 100', hubDraft.status === 'Draft' && Number(hubDraft.progress_percent) < 100, `hub=${hubDraft.status}/${hubDraft.progress_percent}`);
  let fd = await facultyDetail(A.id);
  const sumDraft = summaryOf(fd, type);
  if (type !== 'COMMUNITY_PROJECT') rec(F, 'Faculty sees Draft status + partial progress for A', sumDraft.status === 'Draft' && sumDraft.progress_percent < 100, `faculty=${sumDraft.status}/${sumDraft.progress_percent}`);
  else rec(F, 'Faculty forms_summary lists this form (status/progress)', !!sumDraft.status, 'NOT listed in forms_summary');

  // D: bypass probes (never counted for A/B/C)
  r = await api('POST', def.ep, D.token, def.emptyFinal);
  rec(F, 'Empty final submit is rejected (400) - mandatory validation', r.status === 400, `status=${r.status} body.status=${r.body.status}`);
  if (def.partialFinal) {
    const rp = await api('POST', def.ep, D.token, def.partialFinal);
    rec(F, 'Final submit with required fields omitted is rejected (400)', rp.status === 400, `status=${rp.status}`);
  }

  // A: final submit
  const fA = def.final(A);
  r = await api('POST', def.ep, A.token, fA);
  rec(F, 'A final submit returns 200 + status Submitted', r.status === 200 && r.body.status === 'Submitted', `status=${r.status} msg=${r.body.message}`);
  r = await get(A);
  rec(F, 'A status persists as Submitted after re-GET', r.body.form_status?.status === 'Submitted' && !!r.body.form_status?.submission_timestamp, `form_status=${r.body.form_status?.status}`);
  const hubFinal = await hubOf(A, type);
  if (type !== 'COMMUNITY_PROJECT') rec(F, 'Hub shows Submitted/100%/locked', hubFinal.status === 'Submitted' && Number(hubFinal.progress_percent) === 100, `hub=${hubFinal.status}/${hubFinal.progress_percent}/locked=${hubFinal.is_locked}`);

  // B: before saving sees nothing of A
  r = await get(B);
  rec(F, 'Student B sees no data of A before saving', !fieldsOf(r) && r.body.form_status?.status === 'Not Started', `status=${r.body.form_status?.status}`);
  const fB = def.final(B);
  r = await api('POST', def.ep, B.token, fB);
  rec(F, 'B final submit returns 200', r.status === 200 && r.body.status === 'Submitted', `status=${r.status}`);

  // Faculty accuracy: A and B each see their own, exactly
  const fdA = await facultyDetail(A.id); const fdB = await facultyDetail(B.id); const fdC = await facultyDetail(C.id);
  const badA = cmp(fA, fdA.body[def.facKey], def.keys);
  rec(F, 'Faculty view of A: every submitted field matches student entry', badA.length === 0, badA.join(' | '));
  const badB = cmp(fB, fdB.body[def.facKey], def.keys);
  rec(F, 'Faculty view of B: every submitted field matches student entry', badB.length === 0, badB.join(' | '));
  rec(F, 'Faculty view of C: form is Not Started / empty', !fdC.body[def.facKey] && summaryOf(fdC, type).status !== 'Submitted', `fac=${!!fdC.body[def.facKey]} status=${summaryOf(fdC, type).status}`);
  const sA = summaryOf(fdA, type);
  if (type !== 'COMMUNITY_PROJECT') rec(F, 'Faculty status/progress for A = Submitted/100 and equals student hub', sA.status === 'Submitted' && Number(sA.progress_percent) === 100 && sA.status === hubFinal.status, `faculty=${sA.status}/${sA.progress_percent} hub=${hubFinal.status}`);
  const gA = fieldsOf(await get(A)); const gB = fieldsOf(await get(B));
  rec(F, 'A and B each see only their own text after both submitted', norm(gA?.[def.colMap ? def.colMap[def.textKey] : def.textKey]) === norm(fA[def.textKey]) && norm(gB?.[def.colMap ? def.colMap[def.textKey] : def.textKey]) === norm(fB[def.textKey]));
  const listRes = await api('GET', `/api/ri/faculty/submissions?${fq()}&form_type=${type === 'DAILY_ACTIVITY_REPORT' ? 'DAILY_ACTIVITY' : type}`, fixtures.facultyToken);
  const listRow = (id) => (listRes.body.submissions || []).find(x => x.student_id === id);
  if (type !== 'COMMUNITY_PROJECT') {
    rec(F, 'Faculty submissions LIST: A Submitted, B Submitted, C Not Started', listRow(A.id)?.submission_status === 'Submitted' && listRow(B.id)?.submission_status === 'Submitted' && listRow(C.id)?.submission_status === 'Not Started', `A=${listRow(A.id)?.submission_status} B=${listRow(B.id)?.submission_status} C=${listRow(C.id)?.submission_status}`);
  } else {
    const all = await api('GET', `/api/ri/faculty/submissions?${fq()}`, fixtures.facultyToken);
    rec(F, 'Faculty submissions LIST contains this form type', (all.body.submissions || []).some(x => x.form_type === 'COMMUNITY_PROJECT'), 'COMMUNITY_PROJECT is absent from faculty submissions list');
  }

  // Post-submit edit behaviour (lock rule probe)
  const edit = await api('POST', def.ep, A.token, { ...def.draft(A), status: 'Draft' });
  const after = await get(A);
  const st = after.body.form_status?.status;
  rec(F, 'Lock rule: a Draft save after final submit does not silently downgrade Submitted', st === 'Submitted', `after draft-save status=${st} (edit response ${edit.status})`);
  // restore A to submitted state to keep later checks valid
  await api('POST', def.ep, A.token, fA);
}

// ────────────────────────── Institutional visits (Form IV) ──────────────────────────
function instPayload(s, final) {
  const visits = [
    { institution_type: 'Gram Panchayat Office', institution_name: unique(s, 'inst1'), official_contact_person: unique(s, 'off1'), visit_date: '2026-10-05', services_provided: unique(s, 'svc1'), observations: unique(s, 'obs1'), challenges_identified: unique(s, 'ch1'), recommendations: unique(s, 'rec1') },
    { institution_type: 'School', institution_name: unique(s, 'inst2'), official_contact_person: unique(s, 'off2'), visit_date: '2026-10-06', services_provided: unique(s, 'svc2'), observations: unique(s, 'obs2'), challenges_identified: unique(s, 'ch2'), recommendations: unique(s, 'rec2') }
  ];
  const form_sections = {
    section_1_village_info: { v_1_1_village_name: unique(s, 'vname'), v_1_2_taluka: 'T', v_1_3_district: 'D', v_1_4_tribal: 'No', v_1_5_population: '1200' },
    section_2_gram_panchayat: { gp_2_1_solid_waste: 'Yes', gp_2_2_water_supply: 'Yes', gp_2_3_water_adequate: 'Yes', gp_2_4_disinfection_frequency: 'Weekly', gp_2_5_bleaching_powder: 'Yes', gp_2_6_chemical_analysis: 'Yes', gp_2_7_bacterial_analysis: 'Yes', gp_2_8_street_lights: 'Yes', gp_2_9_drainage: 'Yes' },
    section_3_legal_cases: { lc_3_1_police_patil: 'Yes', lc_3_2_tanta_mukta: 'Yes', lc_3_3_cases_resolved: unique(s, 'cases') },
    section_4_school: { sc_4_1_students_count: '100', sc_4_2_medium: 'Marathi', sc_4_3_building_condition: 'Good', sc_4_4_toilets: 'Yes', sc_4_5_drinking_water: 'Yes' },
    section_5_health_facility: { hf_5_1_facility_type: 'PHC', hf_5_5_deliveries_conducted: 'Yes', hf_5_6_emergency_services: 'Yes', hf_5_7_ambulance_available: 'Yes', hf_5_9_asha_referral: 'Yes' },
    section_6_anganwadi: { aw_6_1_anganwadi_present: 'Yes', aw_6_2_supplementary_nutrition: 'Yes', aw_6_3_food_not_available_days: '0' },
    section_7_ration_shop: { rs_7_1_ration_shop_available: 'Yes', rs_7_2_food_items_regular: 'Yes', rs_7_3_bpl_ration_subsidised: 'Yes' },
    section_8_talathi_sajja: { ts_8_1_talathi_available: 'Yes', ts_8_3_satbara_online: 'Yes' },
    section_9_special_scheme: { ss_9_special_scheme_details: unique(s, 'special') }
  };
  return { visits, form_sections, activity_photo_1: `http://x/${unique(s, 'ip1')}.jpg`, activity_photo_2: '', status: final ? 'Submitted' : 'Draft' };
}

async function auditInstitutional([A, B, C, D]) {
  const F = 'FORM IV Institutional Visit Observations'; const ep = `${SF}/institutional-visits`; const type = 'INSTITUTIONAL_VISIT';
  let r = await api('GET', ep, C.token);
  rec(F, 'Student C blank/default state', r.body.visits?.length === 0 && r.body.form_status?.status === 'Not Started');
  const dA = instPayload(A, false); dA.visits = [dA.visits[0]];
  r = await api('POST', ep, A.token, dA);
  rec(F, 'A draft save returns 200 + Draft', r.status === 200 && r.body.status === 'Draft', `status=${r.status}`);
  r = await api('GET', ep, A.token);
  rec(F, 'A draft restores visits + form_sections; status Draft', r.body.visits?.length === 1 && r.body.visits[0].institution_name === dA.visits[0].institution_name && r.body.form_sections?.section_1_village_info?.v_1_1_village_name === dA.form_sections.section_1_village_info.v_1_1_village_name && r.body.form_status?.status === 'Draft');
  let hub = await hubOf(A, type);
  rec(F, 'Hub shows Draft < 100', hub.status === 'Draft' && Number(hub.progress_percent) < 100, `hub=${hub.status}/${hub.progress_percent}`);
  let fd = await facultyDetail(A.id);
  rec(F, 'Faculty sees Draft for A', summaryOf(fd, type).status === 'Draft', `faculty=${summaryOf(fd, type).status}/${summaryOf(fd, type).progress_percent}`);

  r = await api('POST', ep, D.token, { visits: [], form_sections: {}, status: 'Submitted' });
  rec(F, 'Empty final submit rejected (400)', r.status === 400, `status=${r.status}`);
  const incomplete = instPayload(D, true); delete incomplete.form_sections.section_9_special_scheme;
  r = await api('POST', ep, D.token, incomplete);
  rec(F, 'Final submit missing a mandatory section rejected (400)', r.status === 400, `status=${r.status}`);

  const fA = instPayload(A, true);
  r = await api('POST', ep, A.token, fA);
  rec(F, 'A final submit returns Submitted (2 institutions)', r.status === 200 && r.body.status === 'Submitted', `status=${r.status} msg=${r.body.message}`);
  r = await api('GET', ep, B.token);
  rec(F, 'Student B sees no data of A', r.body.visits?.length === 0);
  const fB = instPayload(B, true);
  r = await api('POST', ep, B.token, fB);
  rec(F, 'B final submit returns Submitted', r.status === 200 && r.body.status === 'Submitted');

  for (const [S, sent] of [[A, fA], [B, fB]]) {
    const d = await facultyDetail(S.id);
    const rows = d.body.institutional_visits || [];
    const bad = [];
    if (rows.length !== sent.visits.length) bad.push(`count sent=${sent.visits.length} got=${rows.length}`);
    sent.visits.forEach(v => {
      const row = rows.find(x => x.institution_name === v.institution_name);
      if (!row) { bad.push(`missing ${v.institution_name}`); return; }
      bad.push(...diffFields({ ...v, key_observations: v.observations }, row, ['institution_name', 'official_contact_person', 'visit_date', 'services_provided', 'key_observations', 'challenges_identified', 'recommendations']));
    });
    const od = rows[0]?.observation_data || {};
    if (canon(od) !== canon(sent.form_sections)) bad.push('form_sections (observation_data) differ from entered answers');
    if ((rows[0]?.activity_photo_1 || '') !== sent.activity_photo_1) bad.push('activity_photo_1 differs');
    rec(F, `Faculty view of ${S.label}: all visits + all 9 section answers + photo match`, bad.length === 0, bad.join(' | '));
  }
  const fdC = await facultyDetail(C.id);
  rec(F, 'Faculty view of C empty/Not Started', (fdC.body.institutional_visits || []).length === 0 && summaryOf(fdC, type).status === 'Not Started');
  const fdA = await facultyDetail(A.id); hub = await hubOf(A, type);
  rec(F, 'Faculty status/progress A = Submitted/100 and equals student hub', summaryOf(fdA, type).status === 'Submitted' && Number(summaryOf(fdA, type).progress_percent) === 100 && hub.status === 'Submitted', `faculty=${summaryOf(fdA, type).status} hub=${hub.status}`);
  const list = await api('GET', `/api/ri/faculty/submissions?${fq()}&form_type=${type}`, fixtures.facultyToken);
  const lr = id => (list.body.submissions || []).find(x => x.student_id === id)?.submission_status;
  rec(F, 'Faculty submissions LIST: A/B Submitted, C Not Started', lr(A.id) === 'Submitted' && lr(B.id) === 'Submitted' && lr(C.id) === 'Not Started', `A=${lr(A.id)} B=${lr(B.id)} C=${lr(C.id)}`);
  const edit = await api('POST', ep, A.token, { ...instPayload(A, false) });
  const st = (await api('GET', ep, A.token)).body.form_status?.status;
  rec(F, 'Lock rule: Draft save after final submit does not silently downgrade Submitted', st === 'Submitted', `after draft-save status=${st}`);
  await api('POST', ep, A.token, fA);
}

// ────────────────────────── Family (Form V) ──────────────────────────
const famRec = (s, n, extra = {}) => ({ family_serial_number: n, head_of_family_name: unique(s, `fam${n}`), total_family_members: 3 + n, male_members: 1 + n, female_members: 2, respondent_name: unique(s, `resp${n}`), contact_number: `98${n}0000000`, social_category: 'OBC', a_1_type_of_house: 'Kutcha', e_1_family_business: unique(s, `biz${n}`), family_specific_problems: unique(s, `prob${n}`), ...extra });

async function auditFamily([A, B, C, D]) {
  const F = 'FORM V Family Visit Observations'; const ep = `${SF}/family-surveys`; const type = 'FAMILY_SURVEY';
  let r = await api('GET', ep, C.token);
  rec(F, 'Student C blank/default state', r.body.families?.length === 0 && r.body.status === 'Not Started');
  const a1 = famRec(A, 1), a2 = famRec(A, 2);
  r = await api('POST', ep, A.token, a1); const ok1 = r.status === 200; const id1 = r.body.family?.id;
  r = await api('POST', ep, A.token, a2); const id2 = r.body.family?.id;
  rec(F, 'A saves 2 family records (draft)', ok1 && !!id1 && !!id2 && id1 !== id2);
  r = await api('GET', ep, A.token);
  rec(F, 'A reopen: both records restored with survey_data, form status Draft', r.body.families?.length === 2 && r.body.families.every(f => f.survey_data?.a_1_type_of_house === 'Kutcha') && r.body.form_status?.status === 'Draft', `status=${r.body.form_status?.status}`);
  let hub = await hubOf(A, type);
  rec(F, 'Hub shows Draft, progress < 100, family_count=2', hub.status === 'Draft' && Number(hub.progress_percent) < 100 && hub.family_count === 2, `hub=${hub.status}/${hub.progress_percent}/count=${hub.family_count}`);
  let fd = await facultyDetail(A.id);
  rec(F, 'Faculty sees Draft + 2 families for A', summaryOf(fd, type).status === 'Draft' && (fd.body.family_surveys || []).length === 2, `faculty=${summaryOf(fd, type).status}/${summaryOf(fd, type).progress_percent} n=${(fd.body.family_surveys || []).length}`);

  // update existing record via PUT (edit) and confirm no duplicate
  r = await api('PUT', `${ep}/${id1}`, A.token, { ...a1, head_of_family_name: unique(A, 'fam1_edited'), id: id1 });
  const after = (await api('GET', ep, A.token)).body.families || [];
  rec(F, 'Edit existing family (PUT) updates in place, no duplicate', after.length === 2 && after.find(f => f.family_serial_number === 1)?.head_of_family_name === unique(A, 'fam1_edited'), `n=${after.length}`);
  a1.head_of_family_name = unique(A, 'fam1_edited');

  // submit with incomplete record: head name blank is blocked? (record with minimal data)
  await api('POST', ep, D.token, { family_serial_number: 1, head_of_family_name: unique(D, 'fam1'), total_family_members: 1 });
  r = await api('POST', `${ep}/submit-all`, D.token);
  // D has a record with only name & members: backend accepts. Frontend validateFamilyRecord enforces the full set.
  rec(F, 'Backend final submit enforces the same mandatory answers as the frontend validator (not only name + members)', r.status === 400, `status=${r.status} (record with only head name/members was ${r.status === 200 ? 'ACCEPTED' : 'rejected'})`);
  r = await api('POST', `${ep}/submit-all`, C.token);
  rec(F, 'Final submit with zero records rejected (400)', r.status === 400, `status=${r.status}`);

  r = await api('POST', `${ep}/submit-all`, A.token);
  rec(F, 'A final submit returns Submitted', r.status === 200 && r.body.status === 'Submitted', `status=${r.status}`);
  r = await api('GET', ep, A.token);
  rec(F, 'A status persists Submitted; all rows Submitted', r.body.form_status?.status === 'Submitted' && r.body.families.every(f => f.status === 'Submitted'));
  r = await api('GET', ep, B.token);
  rec(F, 'Student B sees no data of A', r.body.families?.length === 0);
  const b1 = famRec(B, 1);
  await api('POST', ep, B.token, b1); await api('POST', `${ep}/submit-all`, B.token);

  for (const [S, sent] of [[A, [a1, a2]], [B, [b1]]]) {
    const d = await facultyDetail(S.id); const rows = d.body.family_surveys || [];
    const bad = [];
    if (rows.length !== sent.length) bad.push(`count sent=${sent.length} got=${rows.length}`);
    sent.forEach(f => {
      const row = rows.find(x => x.family_serial_number === f.family_serial_number);
      if (!row) { bad.push(`missing #${f.family_serial_number}`); return; }
      bad.push(...diffFields(f, row, ['head_of_family_name', 'total_family_members', 'male_members', 'female_members', 'respondent_name', 'contact_number', 'social_category']));
      ['a_1_type_of_house', 'e_1_family_business', 'family_specific_problems'].forEach(k => { if (norm(row.survey_data?.[k]) !== norm(f[k])) bad.push(`survey_data.${k}: sent=${f[k]} got=${row.survey_data?.[k]}`); });
    });
    rec(F, `Faculty view of ${S.label}: all family records + answers match`, bad.length === 0, bad.join(' | '));
  }
  const fdC = await facultyDetail(C.id);
  rec(F, 'Faculty view of C empty/Not Started', (fdC.body.family_surveys || []).length === 0 && summaryOf(fdC, type).status === 'Not Started');
  const fdA = await facultyDetail(A.id); hub = await hubOf(A, type);
  rec(F, 'Faculty status/progress A = Submitted/100 and equals hub', summaryOf(fdA, type).status === 'Submitted' && Number(summaryOf(fdA, type).progress_percent) === 100 && hub.status === 'Submitted', `faculty=${summaryOf(fdA, type).status} hub=${hub.status}`);
  const list = await api('GET', `/api/ri/faculty/submissions?${fq()}&form_type=${type}`, fixtures.facultyToken);
  const lr = id => (list.body.submissions || []).find(x => x.student_id === id)?.submission_status;
  rec(F, 'Faculty submissions LIST: A/B Submitted, C Not Started', lr(A.id) === 'Submitted' && lr(B.id) === 'Submitted' && lr(C.id) === 'Not Started', `A=${lr(A.id)} B=${lr(B.id)} C=${lr(C.id)}`);
  // post-submit: adding a new family after submission
  const add = await api('POST', ep, A.token, famRec(A, 3));
  const st = (await api('GET', ep, A.token)).body;
  rec(F, 'Lock rule: family added after final submit is not left in an inconsistent state (master Submitted but new row Draft)', st.families.every(f => f.status === st.form_status.status), `master=${st.form_status.status} rows=${st.families.map(f => f.status).join(',')}`);
}

// ────────────────────────── Undertaking (Form IA) ──────────────────────────
async function auditUndertaking([A, B, C, D]) {
  const F = 'FORM IA Student Undertaking'; const type = 'UNDERTAKING';
  const body = s => ({ signedName: unique(s, 'sig'), emergencyContactName: unique(s, 'ecn'), emergencyContactRelation: 'Father', emergencyContactMobile: '9000000001', emergencyContactAltMobile: '9000000002', emergencyContactEmail: `${s.label}@e.invalid`, bloodGroup: 'O+', medicalConditions: unique(s, 'med'), knownAllergies: unique(s, 'all'), consentPhotoVideo: false });
  let r = await api('GET', '/api/ri/student/undertaking', C.token);
  rec(F, 'Student C blank state (not submitted)', r.body.submitted === false && !r.body.undertaking, `submitted=${r.body.submitted}`);
  r = await api('POST', '/api/ri/student/undertaking', D.token, { signedName: '' });
  rec(F, 'Missing signature/emergency contact rejected (400)', r.status === 400, `status=${r.status}`);
  r = await api('POST', '/api/ri/student/undertaking', A.token, body(A));
  rec(F, 'A submit returns 200', r.status === 200 && r.body.success, `status=${r.status}`);
  r = await api('GET', '/api/ri/student/undertaking', B.token);
  rec(F, 'Student B sees no data of A', r.body.submitted === false && !r.body.undertaking);
  r = await api('POST', '/api/ri/student/undertaking', B.token, body(B));
  const dup = await api('POST', '/api/ri/student/undertaking', A.token, body(A));
  rec(F, 'Duplicate re-submit blocked (locked after submission)', dup.status === 400, `status=${dup.status}`);
  for (const [S] of [[A], [B]]) {
    const sent = body(S);
    const g = await api('GET', '/api/ri/student/undertaking', S.token);
    const d = await facultyDetail(S.id); const u = d.body.undertaking || {};
    const bad = diffFields({ signed_name: sent.signedName, emergency_contact_name: sent.emergencyContactName, emergency_contact_relation: sent.emergencyContactRelation, emergency_contact_mobile: sent.emergencyContactMobile, blood_group: sent.bloodGroup, medical_conditions: sent.medicalConditions, known_allergies: sent.knownAllergies, consent_photo_video: false }, u, ['signed_name', 'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_mobile', 'blood_group', 'medical_conditions', 'known_allergies', 'consent_photo_video']);
    rec(F, `Faculty view of ${S.label}: all undertaking answers match`, bad.length === 0 && g.body.submitted === true, bad.join(' | '));
  }
  const fdA = await facultyDetail(A.id); const hub = await hubOf(A, type);
  rec(F, 'Faculty status A = Submitted and equals student hub', summaryOf(fdA, type).status === 'Submitted' && hub.status === 'Submitted', `faculty=${summaryOf(fdA, type).status} hub=${hub.status}`);
  const fdC = await facultyDetail(C.id);
  rec(F, 'Faculty view of C Not Started', summaryOf(fdC, type).status === 'Not Started');
}

// ────────────────────────── Uploads ──────────────────────────
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
async function auditUploads([A, B]) {
  const F = 'File uploads (Daily/Institutional photo, Form VI document, Form VII photo)';
  const dir = path.join(__dirname, '../uploads/ri_student_files');
  const before = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  const track = () => { (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => !before.has(f)).forEach(f => { const p = path.join(dir, f); if (!uploadedFiles.includes(p)) uploadedFiles.push(p); before.add(f); }); };

  let r = await upload(`${SF}/daily-activity-report/upload-photo`, A.token, 'photo', 'ok.png', PNG, 'image/png'); track();
  const url1 = r.body.url;
  rec(F, 'Daily photo: valid PNG accepted and returned URL', r.status === 200 && !!url1, `status=${r.status}`);
  if (url1) { const g = await fetch(url1); rec(F, 'Daily photo URL is retrievable (faculty can open it)', g.status === 200, `GET ${g.status}`); }
  r = await upload(`${SF}/daily-activity-report/upload-photo`, A.token, 'photo', 'evil.exe', Buffer.from('MZ'), 'application/octet-stream'); track();
  rec(F, 'Daily photo: .exe rejected (400)', r.status === 400 || r.status === 500, `status=${r.status}`);
  r = await upload(`${SF}/daily-activity-report/upload-photo`, A.token, 'photo', 'doc.pdf', Buffer.from('%PDF-1.4'), 'application/pdf'); track();
  rec(F, 'Daily photo: .pdf rejected (images only) (400)', r.status === 400, `status=${r.status}`);
  const big = Buffer.alloc(6 * 1024 * 1024, 1);
  const beforeCount = uploadedFiles.length;
  r = await upload(`${SF}/daily-activity-report/upload-photo`, A.token, 'photo', 'big.png', big, 'image/png'); track();
  rec(F, 'Daily photo: >5MB rejected (400)', r.status === 400, `status=${r.status}`);
  rec(F, 'Rejected >5MB upload is NOT left orphaned on disk', uploadedFiles.length === beforeCount, `orphan files created=${uploadedFiles.length - beforeCount}`);
  r = await upload(`${SF}/institutional-visits/upload-photo`, A.token, 'photo', 'ok.png', PNG, 'image/png'); track();
  rec(F, 'Institutional photo: valid PNG accepted', r.status === 200 && !!r.body.url, `status=${r.status}`);

  // Form VI doc: pdf accepted; stored on student's own row; B unaffected
  r = await upload(`${SF}/problem-identification/upload-document`, B.token, 'document', 'rep.pdf', Buffer.from('%PDF-1.4 test'), 'application/pdf'); track();
  rec(F, 'Form VI document: valid PDF accepted', r.status === 200 && !!r.body.url, `status=${r.status}`);
  const bGet = (await api('GET', `${SF}/problem-identification`, B.token)).body.problem;
  const aGet = (await api('GET', `${SF}/problem-identification`, A.token)).body.problem;
  rec(F, 'Form VI document attached only to uploader (B), not A', !!bGet?.assignment_link && aGet?.assignment_link !== bGet?.assignment_link);
  r = await upload(`${SF}/problem-identification/upload-document`, B.token, 'document', 'img.png', PNG, 'image/png'); track();
  rec(F, 'Form VI document: image/png rejected (docs only) (400)', r.status === 400, `status=${r.status}`);
}

// ────────────────────────── main ──────────────────────────
(async () => {
  let exit = 0;
  try {
    await setup();
    const S = fixtures.students;
    await auditUndertaking(S);
    for (const [type, def] of Object.entries(FORMS)) await auditSimpleForm(type, def, S);
    await auditInstitutional(S);
    await auditFamily(S);
    await auditUploads(S);

    // Cross-form isolation: after all forms, A's data in each form is still A's
    const x = [];
    for (const [type, def] of Object.entries(FORMS)) {
      const g = (await api('GET', def.ep, S[0].token)).body[def.getKey];
      const col = def.colMap ? def.colMap[def.textKey] : def.textKey;
      if (!String(g?.[col] ?? '').includes(`_A_`)) x.push(type);
    }
    rec('CROSS-FORM', 'Saving other forms never overwrote another form\'s data (A, all forms still A\'s own)', x.length === 0, x.join(','));
    const hubA = (await api('GET', '/api/ri/student/forms', S[0].token)).body;
    const hubC = (await api('GET', '/api/ri/student/forms', S[2].token)).body;
    rec('CROSS-FORM', 'Student C hub: every form Not Started/0%', (hubC.forms || []).every(f => f.status === 'Not Started' && Number(f.progress_percent) === 0), (hubC.forms || []).map(f => `${f.form_type}:${f.status}/${f.progress_percent}`).join(' '));
    rec('CROSS-FORM', 'Student A hub counts: all 7 official forms Submitted', hubA.submitted_count === 7, `submitted_count=${hubA.submitted_count}`);
    // Student cannot reach faculty endpoints / other student workspace
    const forbid = await api('GET', `/api/ri/faculty/students/${S[1].id}/workspace?${fq()}`, S[0].token);
    rec('CROSS-FORM', 'Student token cannot read faculty workspace of another student', forbid.status === 401 || forbid.status === 403, `status=${forbid.status}`);
  } catch (e) {
    console.error('AUDIT HARNESS ERROR:', e);
    rec('HARNESS', 'harness completed without exception', false, e.message);
  } finally {
    await cleanup();
    const fails = results.filter(r => !r.ok);
    console.log(`\n===== SUMMARY: ${results.length - fails.length} PASS / ${fails.length} FAIL =====`);
    fails.forEach(f => console.log(`FAIL [${f.form}] ${f.check} :: ${f.detail}`));
    if (fails.length) exit = 1;
    fs.writeFileSync(path.join(__dirname, '.ri_forms_audit_last_run.json'), JSON.stringify(results, null, 2));
    await pool.end();
    process.exit(exit);
  }
})();
