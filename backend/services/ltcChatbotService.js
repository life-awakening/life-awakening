'use strict';

const pool = require('../config/db');

// ─── GEMINI MODEL CONFIGURATION ──────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-3.6-flash';

// ─── DOMAIN KNOWLEDGE: MIT-WPU LIFE TRANSFORMATION CENTRE (LTC) ───────────────
const LTC_DOMAIN_KNOWLEDGE = `
MIT-WPU Life Transformation Centre (LTC) Official Knowledge & Philosophy:
- What is LTC: The Life Transformation Centre (LTC) is the flagship residential experiential learning and character-building initiative of MIT World Peace University (MIT-WPU), Pune, located at the scenic Boribel campus, Daund.
- Purpose & Vision: To foster holistic human transformation, inner peace, self-discipline, resilience, empathy, social consciousness, and leadership in students through rural immersion, ethical grounding, and wellness routines.
- The 5 Core Pillars of LTC:
  1. Yoga, Meditation & Physical Wellness: Daily morning fitness, yogasanas, pranayama, and mindfulness practices for mental clarity and physical vitality.
  2. Agriculture & Rural Immersion: Hands-on agricultural tasks, soil cultivation, understanding rural ecosystems, and organic farming sustainability.
  3. Universal Human Values & Ethics: Engaging sessions on peace, moral values, ethics, empathy, and integrity in personal and professional life.
  4. Social Service & Community Engagement (Shramdaan): Voluntary labor, community hygiene, village development initiatives, and civic responsibility.
  5. Life Skills, Team Dynamics & Leadership: Squad-based collaborative activities, communication, problem-solving, and overcoming real-world challenges.
- Organizational Structure & Roles:
  - Batches: Cohorts of students assigned to specific multi-day residential schedules at the LTC campus.
  - Squads: Peer groups within a batch led by designated student Squad Leaders and guided by Faculty Mentors and LTC Members.
  - Room Accommodations: Designated hostel buildings (e.g., Sinhgad, Pratapgad, etc.).
- Essential Protocols & Forms:
  - Undertaking Form: Mandatory consent and medical disclosure declaration submitted by students before attending.
  - Attendance Tracking: Pillar-wise and day-wise attendance tracked daily across all sessions and locked by authorized coordinators.
  - Feedback Forms:
    * Pre-LTC Feedback: Baseline assessment of student expectations and state before the camp.
    * Post-LTC Feedback: Comprehensive evaluation of learning, transformation, and campus experience post-camp.
    * Service-Trainers Feedback: Specific ratings and qualitative evaluation of instructors and service trainers.
  - Certificates: Official digital completion certificates issued to students upon successful attendance and completion.
`;

// ─── STRUCTURAL DATABASE SCHEMA (Structure Only — Zero Hardcoded Data) ───────
const DB_SCHEMA = `
PostgreSQL Database Schema for MIT-WPU Life Transformation Centre (LTC) Portal:

TABLE: batches
  id SERIAL PK
  name VARCHAR (batch title e.g. 'BATCH 1', 'Batch 2024', etc.)
  status VARCHAR ('active', 'upcoming', 'completed', 'archived')
  location VARCHAR
  start_date DATE
  end_date DATE
  description TEXT
  batch_code VARCHAR
  year VARCHAR
  capacity INT
  is_deleted BOOLEAN

TABLE: batch_students (Enrolled students in batches)
  batch_id INT FK -> batches.id
  student_id INT FK -> users.id
  squad VARCHAR (squad/group name)
  room VARCHAR (room/accommodation identifier)
  barcode VARCHAR
  is_squad_leader BOOLEAN
  room_designation VARCHAR
  squad_designation VARCHAR
  added_at TIMESTAMP

TABLE: batch_faculty (Faculty and coordinators assigned to batches)
  batch_id INT FK -> batches.id
  faculty_id INT FK -> users.id
  squad VARCHAR
  added_at TIMESTAMP

TABLE: users (User accounts: students, faculty, admins, LTC members)
  id SERIAL PK
  name VARCHAR
  email VARCHAR
  role VARCHAR ('student', 'faculty', 'admin', 'superadmin', 'ltc_member', 'dean_ltc', 'superadmin_readonly')
  department VARCHAR
  semester VARCHAR
  division VARCHAR
  school VARCHAR
  panel VARCHAR
  prn VARCHAR (Student PRN number)
  faculty_id VARCHAR
  phone VARCHAR
  dob DATE
  gender VARCHAR
  program VARCHAR
  year VARCHAR
  designation VARCHAR
  status VARCHAR ('active', 'inactive')
  nri BOOLEAN
  red_flag BOOLEAN
  squad VARCHAR
  room VARCHAR
  barcode VARCHAR
  blood_group VARCHAR
  known_allergies TEXT
  medical_conditions TEXT
  current_medication TEXT
  dietary_restrictions TEXT
  emergency_contact_name VARCHAR
  emergency_contact_mobile VARCHAR
  undertaking_submitted BOOLEAN
  is_squad_leader BOOLEAN
  roll_number VARCHAR
  created_at TIMESTAMP

TABLE: feedback (Feedback submissions by students/trainers)
  id SERIAL PK
  user_id INT FK -> users.id
  batch_id INT FK -> batches.id (or linked via batch_students on user_id)
  category VARCHAR ('Pre-LTC', 'Post-LTC', 'Service-Trainers')
  role VARCHAR
  feedback_text TEXT
  additional_notes TEXT
  rating INT
  faculty_id INT
  created_at TIMESTAMP

TABLE: attendance (Session attendance tracking)
  id SERIAL PK
  student_id INT FK -> users.id
  batch_id INT FK -> batches.id
  schedule_id INT FK -> schedules.id
  status VARCHAR ('present', 'absent', 'late', 'excused')
  pillar VARCHAR (pillar/activity name e.g. 'agriculture', 'bag_checking')
  day INT (day number e.g. 1, 2, 3, 4, 5)
  is_locked BOOLEAN
  locked_by_name VARCHAR
  locked_at TIMESTAMP

TABLE: schedules (Batch schedules and timetable)
  id SERIAL PK
  batch_id INT FK -> batches.id
  title VARCHAR
  date VARCHAR
  time VARCHAR
  faculty_id INT
  panel VARCHAR

TABLE: squad_leaders (Squad leadership registry)
  squad_name VARCHAR PK
  name VARCHAR
  email VARCHAR
  prn VARCHAR
  phone VARCHAR

TABLE: red_flags (Student alerts and concerns)
  id SERIAL PK
  student_id INT FK -> users.id
  faculty_id INT
  category VARCHAR
  reason TEXT
  created_at TIMESTAMP

TABLE: certificates (Issued completion certificates)
  id SERIAL PK
  student_id INT FK -> users.id
  batch_id INT FK -> batches.id
  type VARCHAR
  issued_at TIMESTAMP
`;

// ─── READ-ONLY SQL VALIDATION GUARD ──────────────────────────────────────────
const MUTATION_RE = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE|COPY|MERGE|CALL|VACUUM|REINDEX|LOCK|COMMENT)\b/i;

function validateReadOnlySql(sql) {
  if (!sql || typeof sql !== 'string') return { valid: false };
  let s = sql.trim()
    .replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    .replace(/;+$/, '').trim();

  // Block multi-statement execution
  if (s.split(';').filter(p => p.trim()).length > 1) return { valid: false };

  // Must begin with SELECT or WITH
  if (!/^(SELECT|WITH)\b/i.test(s)) return { valid: false };

  // Block any mutation keywords
  if (MUTATION_RE.test(s)) return { valid: false };

  // Block SQL injection comments
  if (/--/.test(s) || /\/\*/.test(s)) return { valid: false };

  // Block INTO clauses
  if (/\bINTO\b/i.test(s)) return { valid: false };

  // Apply safety limit for non-aggregates
  const isAggOnly = /^SELECT\s+(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(s) && !/GROUP\s+BY/i.test(s);
  if (!isAggOnly && !/\bLIMIT\s+\d+/i.test(s)) {
    s = `${s} LIMIT 100`;
  }

  return { valid: true, sql: s };
}

// ─── READ-ONLY TRANSACTION EXECUTOR ─────────────────────────────────────────
async function executeReadOnlyQuery(sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const result = await client.query(sql);
    await client.query('COMMIT');
    return { success: true, rows: result.rows, rowCount: result.rowCount };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// ─── GEMINI API CALLER ───────────────────────────────────────────────────────
async function callGemini(promptText, wantJson = true, maxTokens = 1500) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: {
      parts: [{ text: "You are the official LTC AI Assistant for Super Admins at MIT-WPU. Output ONLY the direct user response in clean markdown. Never include thought processes, checklists, internal constraint checks, or meta-commentary." }]
    },
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      maxOutputTokens: maxTokens,
      ...(wantJson ? { responseMimeType: 'application/json' } : {})
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty Gemini response');

  if (!wantJson) return rawText.trim();

  let clean = rawText.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  else if (clean.startsWith('```')) clean = clean.slice(3);
  const fenceEnd = clean.lastIndexOf('```');
  if (fenceEnd !== -1) clean = clean.slice(0, fenceEnd);
  clean = clean.trim();

  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.slice(start, end + 1);
  }

  return JSON.parse(clean);
}

// ─── LANGUAGE DETECTION ──────────────────────────────────────────────────────
function detectLanguage(text) {
  const t = String(text || '');
  const devCount = (t.match(/[\u0900-\u097F]/g) || []).length;
  if (devCount > 2) {
    if (/आहे|किती|सांगा|मध्ये|विद्यार्थी|बॅच|केले|आहेत|त्यांची|त्यांचे|त्यांचा|भरले|झाले|नाही|कशी|काय/.test(t)) return 'Marathi';
    return 'Hindi';
  }
  if (/\b(kitne|kya|batao|kaun|hai|hain|batch me|kitna|karo|mujhe|bhara|nahi|chhatro|vidyarthi|kyu|kyon)\b/i.test(t)) return 'Hindi';
  if (/\b(kiti|aahe|saanga|madhe|konte|ahet|sangaa|bharle|nahi|vidyarthi|kashasathi)\b/i.test(t)) return 'Marathi';
  return 'English';
}

// ─── DYNAMIC ENTITY EXTRACTORS (Zero Hardcoded Data) ──────────────────────────
function parseBatchRef(text) {
  if (!text) return null;
  const m = text.match(/(?:batch\s*#?\s*|बॅच\s*|बैच\s*)([०-९\d]+|[A-Za-z0-9_-]+)/i);
  if (m) {
    let raw = m[1].trim()
      .replace(/०/g,'0').replace(/१/g,'1').replace(/२/g,'2').replace(/३/g,'3')
      .replace(/४/g,'4').replace(/५/g,'5').replace(/६/g,'6').replace(/७/g,'7')
      .replace(/८/g,'8').replace(/९/g,'9');
    if (!/^(the|all|list|details?|highest|lowest|max|min|count|size|name|info|status|wise|records?|average|summary|madhye|mein|me)$/i.test(raw)) {
      return raw;
    }
  }
  return null;
}

function extractSquadName(text) {
  if (!text) return null;
  const m = text.match(/(?:in\s+squad\s+|squad\s*[:\-]?\s*|squad\s+)([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+)\s+squad/i);
  if (m) {
    const val = (m[1] || m[2]).trim();
    if (!/^(the|all|leaders?|members?|details?|list|names?|each|every|any|count|total|students?)$/i.test(val)) {
      return val;
    }
  }
  return null;
}

function buildBatchWhere(alias, ref) {
  if (!ref) return null;
  const n = parseInt(ref, 10);
  const safeRef = String(ref).replace(/'/g, "''");
  if (!isNaN(n)) {
    return `(${alias}.id = ${n} OR ${alias}.name ILIKE '%${n}%' OR ${alias}.batch_code ILIKE '%${n}%')`;
  }
  return `(${alias}.name ILIKE '%${safeRef}%' OR ${alias}.batch_code ILIKE '%${safeRef}%')`;
}

// ─── CONTEXT EXTRACTOR (Extracts dynamic references from conversation history) ─
function resolveContextFromHistory(history, currentQuery = '') {
  if (!Array.isArray(history)) return {};
  const ctx = {};
  
  for (let i = history.length - 1; i >= 0; i--) {
    const msgText = String(history[i].text || history[i].query || history[i].content || '');
    if (!ctx.batchRef) {
      const b = parseBatchRef(msgText);
      if (b) { ctx.batchRef = b; ctx.batchSource = 'history'; }
    }
    if (!ctx.squad) {
      const sq = extractSquadName(msgText);
      if (sq) ctx.squad = sq;
    }
    if (!ctx.lastIntent && history[i].role === 'user') {
      const pastIntent = classifyIntent(msgText, {});
      if (pastIntent !== 'UNKNOWN' && pastIntent !== 'GREETING' && pastIntent !== 'HELP' && pastIntent !== 'LTC_DOMAIN_KNOWLEDGE') {
        ctx.lastIntent = pastIntent;
      }
    }
  }

  const isShortFollowUp = /^(what about|and for|how about|what of|tell me about|आणि|अन्|और|कशाबद्दल)\s+(?:batch|बॅच|बैच)\s*([०-९\d]+|[A-Za-z0-9_-]+)/i.test(currentQuery.trim());
  if (isShortFollowUp && ctx.lastIntent) {
    ctx.inheritedIntent = ctx.lastIntent;
  }

  return ctx;
}

// ─── INTENT CLASSIFIER ────────────────────────────────────────────────────────
function classifyIntent(q, ctx) {
  const lq = q.toLowerCase();

  // Greeting
  if (/^(hi|hello|hey|namaste|नमस्ते|नमस्कार|helo|good morning|good afternoon)\b/i.test(lq.trim()) || /^(नमस्ते|नमस्कार)$/.test(lq.trim())) return 'GREETING';

  // Domain / Conceptual / Policy Questions
  if ((/(what is ltc|what is the purpose of ltc|why is ltc conducted|objectives of ltc|explain ltc|about ltc|5 pillars|five pillars|pillars of ltc|attendance rules|feedback rules|what happens in ltc|life transformation centre|explain the ltc journey)/i.test(lq) ||
       /(ltc काय आहे|ltc चा उद्देश काय|५ स्तंभ|पाच स्तंभ|ltc बद्दल माहिती|ltc क्या है|ltc का उद्देश्य|५ पिलर्स|पांच स्तंभ)/.test(lq)) &&
      !parseBatchRef(q) && !/\b(students?|attendance records?|feedback submissions?)\b/i.test(lq)) {
    return 'LTC_DOMAIN_KNOWLEDGE';
  }

  // Help
  if (/\b(what can you|help|commands|capabilities|features|kya kar sakte)\b/i.test(lq) || /(मदत|काय करू शकता|कशी मदत)/.test(lq)) return 'HELP';

  // Overview / System Summary
  if (/\b(overview|database overview|system status|dashboard)\b/i.test(lq) && !ctx.batchRef && !parseBatchRef(q)) return 'OVERVIEW';

  // Batch ranking / comparisons (highest, lowest, maximum, minimum, most students, compare batches)
  if ((/\b(highest|lowest|most|least|maximum|minimum|compare|versus|vs\.?|rank|ranking|largest|smallest)\b/i.test(lq) || /(जास्त|कमी|सर्वात|अधिक|रँकिंग|तुलना)/.test(lq)) &&
      (/\b(batch|batches|students?|attendance|feedback)\b/i.test(lq) || /(विद्यार्थी|छात्र|बॅच|बैच|हजेरी|फीडबॅक|फीडबैक)/.test(lq))) {
    return 'BATCH_RANKING';
  }

  // Batches listing / active batches count
  if (/\b(all batches|list batches|how many batches|total batches|show batches|active batches|active batch)\b/i.test(lq) ||
      /(सर्व बॅच|सर्व बैच|किती बॅच|सक्रिय बॅच|कितने बैच|कुल बैच)/.test(lq)) {
    return 'BATCH_LIST';
  }

  // Feedback submissions & status (English, Hindi, Marathi)
  if (/\b(feedback|pre.?ltc|post.?ltc|service.?train)\b/i.test(lq) ||
      /(फीडबैक|फीडबॅक|प्रतिसाद|प्री|पोस्ट)/.test(lq) ||
      ((/(प्री|पोस्ट|सर्व्हिस|सर्विस)/.test(lq) || /\b(pre|post|service)\b/i.test(lq)) && (/\b(submit|submitted|pending)\b/i.test(lq) || /(भरले|नाही भरले|न भरलेले|नही भरा|नहीं भरा)/.test(lq))) ||
      ((/\b(submitted|not submitted|pending submission|feedback status)\b/i.test(lq) || /(भरले|नाही भरले|न भरलेले|नहीं भरा)/.test(lq)) && !/\b(undertaking|attendance)\b/i.test(lq) && !/(हजेरी|उपस्थिति|हमीपत्र)/.test(lq))) {
    return 'FEEDBACK';
  }

  // Undertaking status
  if (/\b(undertaking|consent|undrtaking)\b/i.test(lq) || /(हमीपत्र|हमी|अंडरटेकिंग)/.test(lq)) return 'UNDERTAKING';

  // Specific student lookup by PRN
  if (/\b\d{8,12}\b/.test(q)) return 'STUDENT_LOOKUP_PRN';

  // Student search by name
  if (/\b(find|search|look up|info|profile|details?) (student|about|for|of)\b/i.test(lq)) return 'STUDENT_SEARCH';

  // Squad leaders
  if (/\b(squad\s*leaders?|leader|leaders)\b/i.test(lq) || /(पथक\s*प्रमुख|लीडर|प्रमुख)/.test(lq)) return 'SQUAD_LEADER';

  // Squads breakdown / list
  if (/\b(squad|squads)\b/i.test(lq) || /(पथक|टीम|सगळे पथक|सर्व पथके|स्क्वाड)/.test(lq)) return 'SQUAD';

  // Attendance
  if (/\b(attendance|present|absent|absentees|pillar|day\s*[1-5])\b/i.test(lq) || /(उपस्थिति|हजेरी|गैरहजर|उपस्थित|अनुपस्थित)/.test(lq)) return 'ATTENDANCE';

  // Faculty assignments
  if (/\b(faculty|ltc member|trainer|teacher|coordinator|assigned)\b/i.test(lq) || /(फॅकल्टी|शिक्षक|मार्गदर्शक|समन्वयक)/.test(lq)) return 'FACULTY';

  // Medical / Red flags
  if (/\b(red\s*flag|medical|allerg|blood\s*group|emergency|medical\s*condition)\b/i.test(lq) || /(रेड\s*फ्लॅग|रक्तगट|एलर्जी|वैद्यकीय)/.test(lq)) return 'RED_FLAGS';

  // Certificates
  if (/\b(certificate|certificates|issued)\b/i.test(lq) || /(प्रमाणपत्र|सर्टिफिकेट)/.test(lq)) return 'CERTIFICATES';

  // Room assignments
  if (/\b(room|rooms|accomm|hostel|roommate)\b/i.test(lq) || /(कक्ष|खोली|रूम)/.test(lq)) return 'ROOM';

  // NRI students
  if (/\b(nri|international|foreign)\b/i.test(lq) || /(अनिवासी|परदेशी)/.test(lq)) return 'NRI';

  // Schedules
  if (/\b(schedule|timetable|program|session)\b/i.test(lq) || /(वेळापत्रक|कार्यक्रम)/.test(lq)) return 'SCHEDULE';

  // Student count (or inherited intent from follow-up)
  if (((/\b(how many|count|total|number of|kitne|students in)\b/i.test(lq) || /(किती|कुल|एकूण|संख्या|कितने)/.test(lq)) &&
       (/\b(students?|enrolled|registered)\b/i.test(lq) || /(विद्यार्थी|छात्र|मुले|मुलं)/.test(lq))) ||
      (ctx.inheritedIntent === 'STUDENT_COUNT' && parseBatchRef(q))) {
    return 'STUDENT_COUNT';
  }

  // Student list (when user explicitly asks to show/list/names)
  if ((/\b(list|show|names|who are|give me|all students|name of students)\b/i.test(lq) || /(सर्व विद्यार्थी|सभी छात्र|यादी|नाव)/.test(lq)) &&
      (/\b(students?)\b/i.test(lq) || /(विद्यार्थी|छात्र)/.test(lq))) {
    return 'STUDENT_LIST';
  }

  // Specific batch info ("Tell me about Batch 1", "Batch 1 details")
  if (ctx.batchRef || parseBatchRef(q)) return 'BATCH_INFO';

  // Notifications
  if (/\b(notification|alert|message)\b/i.test(lq) || /(सूचना|संदेश)/.test(lq)) return 'NOTIFICATIONS';

  return 'UNKNOWN';
}

// ─── DYNAMIC SQL GENERATOR (Generates Safe Parameterized SQL) ─────────────────
function buildDynamicSql(intent, q, ctx) {
  const lq = q.toLowerCase();
  const batchRef = ctx.batchRef || parseBatchRef(q);
  const bw = batchRef ? buildBatchWhere('b', batchRef) : null;
  const sqName = extractSquadName(q) || ctx.squad;

  switch (intent) {
    case 'OVERVIEW':
      return {
        sql: `SELECT
          (SELECT COUNT(*) FROM batches WHERE is_deleted IS NOT TRUE) AS total_batches,
          (SELECT COUNT(*) FROM users WHERE role='student') AS total_students,
          (SELECT COUNT(*) FROM users WHERE role IN ('faculty','ltc_member','dean_ltc')) AS total_faculty_ltc,
          (SELECT COUNT(*) FROM batch_students WHERE batch_id IN (SELECT id FROM batches WHERE status='active' AND is_deleted IS NOT TRUE)) AS students_in_active_batches,
          (SELECT COUNT(*) FROM feedback) AS total_feedback_submissions,
          (SELECT COUNT(*) FROM attendance) AS total_attendance_records,
          (SELECT COUNT(*) FROM certificates) AS total_certificates_issued,
          (SELECT COUNT(*) FROM red_flags) AS total_red_flags`
      };

    case 'BATCH_LIST': {
      const onlyActive = /\b(active|सक्रिय|चालू)\b/i.test(lq);
      return {
        sql: `SELECT b.id, b.name AS batch_name, b.status, b.start_date, b.end_date, b.location,
            COUNT(DISTINCT bs.student_id) AS enrolled_students,
            COUNT(DISTINCT bf.faculty_id) AS assigned_faculty
          FROM batches b
          LEFT JOIN batch_students bs ON bs.batch_id = b.id
          LEFT JOIN batch_faculty bf ON bf.batch_id = b.id
          WHERE b.is_deleted IS NOT TRUE ${onlyActive ? "AND b.status = 'active'" : ''}
          GROUP BY b.id, b.name, b.status, b.start_date, b.end_date, b.location
          ORDER BY b.id`
      };
    }

    case 'BATCH_RANKING':
      return {
        sql: `SELECT b.name AS batch_name, b.status,
            COUNT(DISTINCT bs.student_id) AS student_count,
            COUNT(DISTINCT a.id) AS attendance_records,
            COUNT(DISTINCT f.id) AS feedback_records
          FROM batches b
          LEFT JOIN batch_students bs ON bs.batch_id = b.id
          LEFT JOIN attendance a ON a.batch_id = b.id
          LEFT JOIN feedback f ON f.batch_id = b.id OR f.user_id = bs.student_id
          WHERE b.is_deleted IS NOT TRUE
          GROUP BY b.id, b.name, b.status
          ORDER BY student_count DESC`
      };

    case 'STUDENT_COUNT': {
      if (bw) {
        if (sqName) {
          const safeSq = sqName.replace(/'/g, "''");
          return {
            sql: `SELECT b.name AS batch_name, bs.squad, COUNT(bs.student_id) AS student_count
              FROM batches b
              JOIN batch_students bs ON bs.batch_id = b.id
              WHERE ${bw} AND bs.squad ILIKE '%${safeSq}%'
              GROUP BY b.name, bs.squad`
          };
        }
        return {
          sql: `SELECT b.name AS batch_name, b.status, b.location,
              COUNT(DISTINCT bs.student_id) AS total_students,
              COUNT(DISTINCT bs.squad) AS total_squads,
              COUNT(DISTINCT bf.faculty_id) AS assigned_faculty
            FROM batches b
            LEFT JOIN batch_students bs ON bs.batch_id = b.id
            LEFT JOIN batch_faculty bf ON bf.batch_id = b.id
            WHERE ${bw}
            GROUP BY b.name, b.status, b.location`
        };
      }
      return {
        sql: `SELECT
            COUNT(DISTINCT bs.student_id) AS total_students,
            COUNT(DISTINCT bs.batch_id) AS total_batches,
            STRING_AGG(DISTINCT b.name, ', ') AS batch_names
          FROM batch_students bs
          JOIN batches b ON b.id = bs.batch_id
          WHERE b.is_deleted IS NOT TRUE`
      };
    }

    case 'STUDENT_LIST': {
      let extra = '';
      if (sqName) extra += ` AND bs.squad ILIKE '%${sqName.replace(/'/g, "''")}%'`;
      return {
        sql: `SELECT u.name, u.prn, u.division, bs.squad, bs.room, b.name AS batch_name
          FROM batch_students bs
          JOIN users u ON u.id = bs.student_id
          JOIN batches b ON b.id = bs.batch_id
          WHERE b.is_deleted IS NOT TRUE
          ${bw ? 'AND ' + bw : ''}
          ${extra}
          ORDER BY b.name, bs.squad, u.name LIMIT 50`
      };
    }

    case 'STUDENT_LOOKUP_PRN': {
      const prnMatch = q.match(/\b(\d{6,12})\b/);
      if (!prnMatch) return null;
      const prn = prnMatch[1];
      return {
        sql: `SELECT u.name, u.prn, u.email, u.phone, u.division, u.department,
            u.blood_group, u.known_allergies, u.medical_conditions,
            u.emergency_contact_name, u.emergency_contact_mobile,
            u.undertaking_submitted, u.nri, bs.squad, bs.room, bs.is_squad_leader, b.name AS batch_name
          FROM users u
          LEFT JOIN batch_students bs ON bs.student_id = u.id
          LEFT JOIN batches b ON b.id = bs.batch_id
          WHERE u.prn = '${prn}' OR u.roll_number = '${prn}'
          LIMIT 5`
      };
    }

    case 'STUDENT_SEARCH': {
      const nm = q.match(/(?:student named?|find|search for|about|info on|profile of|details? of|details? for|info for)\s+([A-Za-z][A-Za-z\s]{1,40})/i);
      if (nm) {
        const name = nm[1].trim().replace(/'/g, "''");
        return {
          sql: `SELECT u.name, u.prn, u.email, u.phone, u.division, u.department,
              u.blood_group, u.emergency_contact_name, u.emergency_contact_mobile,
              u.undertaking_submitted, bs.squad, bs.room, b.name AS batch_name
            FROM users u
            LEFT JOIN batch_students bs ON bs.student_id = u.id
            LEFT JOIN batches b ON b.id = bs.batch_id
            WHERE u.name ILIKE '%${name}%' AND u.role = 'student'
            LIMIT 10`
        };
      }
      return null;
    }

    case 'SQUAD': {
      if (sqName) {
        const safeSq = sqName.replace(/'/g, "''");
        return {
          sql: `SELECT bs.squad, COUNT(bs.student_id) AS student_count,
              STRING_AGG(u.name, ', ' ORDER BY u.name) FILTER (WHERE bs.is_squad_leader = true) AS squad_leaders,
              b.name AS batch_name
            FROM batch_students bs
            JOIN users u ON u.id = bs.student_id
            JOIN batches b ON b.id = bs.batch_id
            WHERE bs.squad ILIKE '%${safeSq}%'
            ${bw ? 'AND ' + bw : ''}
            GROUP BY bs.squad, b.name`
        };
      }
      return {
        sql: `SELECT b.name AS batch_name, bs.squad,
            COUNT(bs.student_id) AS total_students,
            COUNT(CASE WHEN bs.is_squad_leader THEN 1 END) AS squad_leaders_count
          FROM batch_students bs
          JOIN batches b ON b.id = bs.batch_id
          WHERE b.is_deleted IS NOT TRUE
          ${bw ? 'AND ' + bw : ''}
          GROUP BY b.name, bs.squad
          ORDER BY b.name, bs.squad`
      };
    }

    case 'SQUAD_LEADER':
      return {
        sql: `SELECT bs.squad, u.name AS leader_name, u.prn, u.email, u.phone, b.name AS batch_name
          FROM batch_students bs
          JOIN users u ON u.id = bs.student_id
          JOIN batches b ON b.id = bs.batch_id
          WHERE bs.is_squad_leader = true
          ${bw ? 'AND ' + bw : ''}
          ORDER BY b.name, bs.squad, u.name`
      };

    case 'ATTENDANCE': {
      const isAbsent = /\b(absent|absentees|missing|not present|who is absent)\b/i.test(lq) || /(गैरहजर|अनुपस्थित)/.test(lq);
      const isPresent = /\b(present|who (came|attended))\b/i.test(lq) || /(उपस्थित)/.test(lq);
      const dayMatch = lq.match(/\bday\s*([1-5])\b/i);

      if (isAbsent || isPresent) {
        const statusFilter = isAbsent ? "a.status = 'absent'" : "a.status = 'present'";
        let where = statusFilter;
        if (bw) where += ` AND ${bw.replace(/\bb\./g, 'bat.')}`;
        if (dayMatch) where += ` AND a.day = ${dayMatch[1]}`;
        if (sqName) where += ` AND bs.squad ILIKE '%${sqName.replace(/'/g, "''")}%'`;
        return {
          sql: `SELECT u.name, u.prn, bs.squad, a.pillar, a.day, a.status, bat.name AS batch_name
            FROM attendance a
            JOIN users u ON u.id = a.student_id
            JOIN batch_students bs ON bs.student_id = a.student_id AND bs.batch_id = a.batch_id
            JOIN batches bat ON bat.id = a.batch_id
            WHERE ${where}
            ORDER BY bat.name, a.day, a.pillar, bs.squad, u.name LIMIT 100`
        };
      }

      let where = bw ? bw.replace(/\bb\./g, 'bat.') : '1=1';
      if (dayMatch) where += ` AND a.day = ${dayMatch[1]}`;
      if (sqName) where += ` AND bs.squad ILIKE '%${sqName.replace(/'/g, "''")}%'`;

      return {
        sql: `SELECT bat.name AS batch_name, a.pillar, a.day,
            COUNT(CASE WHEN a.status='present' THEN 1 END) AS present_count,
            COUNT(CASE WHEN a.status='absent' THEN 1 END) AS absent_count,
            COUNT(*) AS total_marked,
            ROUND(COUNT(CASE WHEN a.status='present' THEN 1 END)::NUMERIC / NULLIF(COUNT(*),0) * 100, 1) AS attendance_pct
          FROM attendance a
          JOIN batches bat ON bat.id = a.batch_id
          ${sqName ? 'JOIN batch_students bs ON bs.student_id = a.student_id AND bs.batch_id = a.batch_id' : ''}
          WHERE ${where}
          GROUP BY bat.name, a.pillar, a.day
          ORDER BY bat.name, a.day, a.pillar`
      };
    }

    case 'FEEDBACK': {
      const isPre = /\b(pre[-\s]?(?:ltc|feedback|form)?|preltc)\b/i.test(lq) || /(प्री|प्रि)/.test(lq);
      const isPost = /\b(post[-\s]?(?:ltc|feedback|form)?|postltc)\b/i.test(lq) || /(पोस्ट)/.test(lq);
      const isService = /\b(service[-\s]?(?:trainers?|feedback|form)?)\b/i.test(lq) || /(सर्व्हिस|सर्विस)/.test(lq);
      const catFilter = isPre ? "'Pre-LTC'" : isPost ? "'Post-LTC'" : isService ? "'Service-Trainers'" : null;

      const isNotSubmitted = /\b(not submitted|pending|haven'?t|did not|missing)\b/i.test(lq) || /(नाही भरले|न भरलेले|नही भरा|नहीं भरा|बाकी)/.test(lq);
      const isListRequested = /\b(show|list|names|who)\b/i.test(lq) || /(कोण|कोणी|नाम|यादी|दाखवा|दिखाओ)/.test(lq);

      // 1. List of students who haven't submitted
      if (isNotSubmitted && isListRequested && catFilter) {
        return {
          sql: `SELECT u.name, u.prn, u.division, bs.squad, b.name AS batch_name
            FROM batch_students bs
            JOIN users u ON u.id = bs.student_id
            JOIN batches b ON b.id = bs.batch_id
            WHERE b.is_deleted IS NOT TRUE
              ${bw ? 'AND ' + bw : ''}
              AND bs.student_id NOT IN (
                SELECT DISTINCT f.user_id FROM feedback f
                WHERE f.category = ${catFilter}
              )
            ORDER BY b.name, bs.squad, u.name LIMIT 50`
        };
      }

      // 2. Specific feedback category count (Pre-LTC / Post-LTC / Service-Trainers)
      if (catFilter) {
        return {
          sql: `WITH enrolled AS (
              SELECT COUNT(DISTINCT student_id) AS cnt FROM batch_students bs
              JOIN batches b ON b.id = bs.batch_id
              WHERE b.is_deleted IS NOT TRUE ${bw ? 'AND ' + bw : ''}
            ),
            submitted AS (
              SELECT COUNT(DISTINCT f.user_id) AS cnt FROM feedback f
              JOIN batch_students bs ON bs.student_id = f.user_id
              JOIN batches b ON b.id = bs.batch_id
              WHERE b.is_deleted IS NOT TRUE ${bw ? 'AND ' + bw : ''} AND f.category = ${catFilter}
            )
            SELECT
              ${catFilter} AS category,
              COALESCE((SELECT cnt FROM enrolled), 0) AS total_enrolled,
              COALESCE((SELECT cnt FROM submitted), 0) AS submitted_count,
              (COALESCE((SELECT cnt FROM enrolled), 0) - COALESCE((SELECT cnt FROM submitted), 0)) AS pending_count`
        };
      }

      // 3. Batch-specific comprehensive feedback summary
      if (bw) {
        return {
          sql: `WITH tb AS (SELECT id, name FROM batches b WHERE ${bw} LIMIT 1),
            enrolled AS (SELECT COUNT(DISTINCT student_id) AS cnt FROM batch_students bs WHERE bs.batch_id = (SELECT id FROM tb)),
            pre_sub AS (
              SELECT COUNT(DISTINCT f.user_id) AS cnt FROM feedback f
              JOIN batch_students bs ON bs.student_id = f.user_id
              WHERE bs.batch_id = (SELECT id FROM tb) AND f.category = 'Pre-LTC'
            ),
            post_sub AS (
              SELECT COUNT(DISTINCT f.user_id) AS cnt FROM feedback f
              JOIN batch_students bs ON bs.student_id = f.user_id
              WHERE bs.batch_id = (SELECT id FROM tb) AND f.category = 'Post-LTC'
            ),
            svc_sub AS (
              SELECT COUNT(DISTINCT f.user_id) AS cnt FROM feedback f
              JOIN batch_students bs ON bs.student_id = f.user_id
              WHERE bs.batch_id = (SELECT id FROM tb) AND f.category = 'Service-Trainers'
            )
            SELECT
              (SELECT name FROM tb) AS batch_name,
              COALESCE((SELECT cnt FROM enrolled), 0) AS total_enrolled,
              COALESCE((SELECT cnt FROM pre_sub), 0) AS pre_ltc_submitted,
              (COALESCE((SELECT cnt FROM enrolled), 0) - COALESCE((SELECT cnt FROM pre_sub), 0)) AS pre_ltc_pending,
              COALESCE((SELECT cnt FROM post_sub), 0) AS post_ltc_submitted,
              (COALESCE((SELECT cnt FROM enrolled), 0) - COALESCE((SELECT cnt FROM post_sub), 0)) AS post_ltc_pending,
              COALESCE((SELECT cnt FROM svc_sub), 0) AS service_trainers_submitted`
        };
      }

      // 4. Overall pending / submitted breakdown across all categories
      return {
        sql: `WITH enrolled AS (
            SELECT COUNT(DISTINCT student_id) AS total_students FROM batch_students bs
            JOIN batches b ON b.id = bs.batch_id WHERE b.is_deleted IS NOT TRUE
          ),
          cat_counts AS (
            SELECT f.category, COUNT(DISTINCT f.user_id) AS submitted_count
            FROM feedback f
            JOIN batch_students bs ON bs.student_id = f.user_id
            JOIN batches b ON b.id = bs.batch_id
            WHERE b.is_deleted IS NOT TRUE
            GROUP BY f.category
          )
          SELECT
            c.cat_name AS category,
            (SELECT total_students FROM enrolled) AS total_enrolled,
            COALESCE(cc.submitted_count, 0) AS submitted_count,
            ((SELECT total_students FROM enrolled) - COALESCE(cc.submitted_count, 0)) AS pending_count
          FROM (VALUES ('Pre-LTC'), ('Post-LTC'), ('Service-Trainers')) AS c(cat_name)
          LEFT JOIN cat_counts cc ON cc.category = c.cat_name
          ORDER BY c.cat_name`
      };
    }

    case 'FACULTY': {
      if (bw) {
        return {
          sql: `SELECT u.name AS faculty_name, u.email, u.role, u.department, u.phone, bf.squad AS assigned_squad, b.name AS batch_name
            FROM batch_faculty bf
            JOIN users u ON u.id = bf.faculty_id
            JOIN batches b ON b.id = bf.batch_id
            WHERE ${bw}
            ORDER BY u.name`
        };
      }
      return {
        sql: `SELECT u.name AS faculty_name, u.email, u.role, u.department, u.designation,
            COUNT(DISTINCT bf.batch_id) AS batches_assigned
          FROM users u
          LEFT JOIN batch_faculty bf ON bf.faculty_id = u.id
          WHERE u.role IN ('faculty', 'ltc_member', 'dean_ltc')
          GROUP BY u.name, u.email, u.role, u.department, u.designation
          ORDER BY u.role, u.name LIMIT 80`
      };
    }

    case 'UNDERTAKING': {
      const notSubmitted = /\b(not submitted|pending|haven'?t|missing|did not|नाही|न भरलेले)\b/i.test(lq);
      if (bw) {
        if (notSubmitted) {
          return {
            sql: `SELECT u.name, u.prn, u.division, bs.squad, b.name AS batch_name
              FROM batch_students bs
              JOIN users u ON u.id = bs.student_id
              JOIN batches b ON b.id = bs.batch_id
              WHERE ${bw} AND (u.undertaking_submitted IS NOT TRUE)
              ORDER BY bs.squad, u.name LIMIT 100`
          };
        }
        return {
          sql: `SELECT b.name AS batch_name,
              COUNT(CASE WHEN u.undertaking_submitted = true THEN 1 END) AS undertaking_submitted_count,
              COUNT(CASE WHEN u.undertaking_submitted IS NOT TRUE THEN 1 END) AS undertaking_pending_count,
              COUNT(*) AS total_students
            FROM batch_students bs
            JOIN users u ON u.id = bs.student_id
            JOIN batches b ON b.id = bs.batch_id
            WHERE ${bw}
            GROUP BY b.name`
        };
      }
      return {
        sql: `SELECT
            COUNT(CASE WHEN u.undertaking_submitted = true THEN 1 END) AS submitted,
            COUNT(CASE WHEN u.undertaking_submitted IS NOT TRUE THEN 1 END) AS pending,
            COUNT(*) AS total
          FROM users u WHERE u.role = 'student'`
      };
    }

    case 'RED_FLAGS': {
      if (/\b(blood\s*group|blood\s*type|रक्तगट)\b/i.test(lq)) {
        return {
          sql: `SELECT u.blood_group, COUNT(*) AS student_count
            FROM users u
            ${bw ? 'JOIN batch_students bs ON bs.student_id = u.id JOIN batches b ON b.id = bs.batch_id' : ''}
            WHERE u.role = 'student' AND u.blood_group IS NOT NULL
            ${bw ? 'AND ' + bw : ''}
            GROUP BY u.blood_group ORDER BY student_count DESC`
        };
      }
      if (/\b(allerg|medical|medication|dietary)\b/i.test(lq)) {
        return {
          sql: `SELECT u.name, u.prn, bs.squad,
              u.known_allergies, u.medical_conditions, u.current_medication, u.dietary_restrictions, b.name AS batch_name
            FROM users u
            JOIN batch_students bs ON bs.student_id = u.id
            JOIN batches b ON b.id = bs.batch_id
            WHERE u.role = 'student'
              AND (u.known_allergies IS NOT NULL OR u.medical_conditions IS NOT NULL OR u.current_medication IS NOT NULL)
              ${bw ? 'AND ' + bw : ''}
            ORDER BY bs.squad, u.name LIMIT 100`
        };
      }
      return {
        sql: `SELECT u.name AS student_name, u.prn, bs.squad, rf.category, rf.reason, rf.created_at
          FROM red_flags rf
          JOIN users u ON u.id = rf.student_id
          LEFT JOIN batch_students bs ON bs.student_id = rf.student_id
          ORDER BY rf.created_at DESC LIMIT 50`
      };
    }

    case 'CERTIFICATES':
      return {
        sql: `SELECT b.name AS batch_name, c.type, COUNT(*) AS issued_count
          FROM certificates c
          JOIN batches b ON b.id = c.batch_id
          ${bw ? 'WHERE ' + bw : ''}
          GROUP BY b.name, c.type ORDER BY b.name, c.type`
      };

    case 'ROOM':
      return {
        sql: `SELECT u.name, u.prn, bs.squad, bs.room, bs.room_designation, b.name AS batch_name
          FROM batch_students bs
          JOIN users u ON u.id = bs.student_id
          JOIN batches b ON b.id = bs.batch_id
          WHERE bs.room IS NOT NULL
          ${bw ? 'AND ' + bw : ''}
          ${sqName ? "AND bs.squad ILIKE '%" + sqName.replace(/'/g, "''") + "%'" : ''}
          ORDER BY bs.room, bs.squad, u.name LIMIT 100`
      };

    case 'NRI':
      return {
        sql: `SELECT u.name, u.prn, bs.squad, b.name AS batch_name
          FROM users u
          JOIN batch_students bs ON bs.student_id = u.id
          JOIN batches b ON b.id = bs.batch_id
          WHERE u.nri = true
          ${bw ? 'AND ' + bw : ''}
          ORDER BY b.name, u.name LIMIT 50`
      };

    case 'SCHEDULE':
      return {
        sql: `SELECT s.title, s.date, s.time, s.panel, b.name AS batch_name
          FROM schedules s
          JOIN batches b ON b.id = s.batch_id
          WHERE b.is_deleted IS NOT TRUE
          ${bw ? 'AND ' + bw : ''}
          ORDER BY s.batch_id, s.date, s.time LIMIT 50`
      };

    case 'BATCH_INFO': {
      if (bw) {
        return {
          sql: `SELECT b.name AS batch_name, b.status, b.location, b.start_date, b.end_date, b.capacity,
              COUNT(DISTINCT bs.student_id) AS enrolled_students,
              COUNT(DISTINCT bf.faculty_id) AS assigned_faculty,
              COUNT(DISTINCT bs.squad) AS total_squads
            FROM batches b
            LEFT JOIN batch_students bs ON bs.batch_id = b.id
            LEFT JOIN batch_faculty bf ON bf.batch_id = b.id
            WHERE ${bw}
            GROUP BY b.name, b.status, b.location, b.start_date, b.end_date, b.capacity`
        };
      }
      return {
        sql: `SELECT b.name AS batch_name, b.status, b.location, b.start_date, b.end_date,
            COUNT(DISTINCT bs.student_id) AS enrolled_students,
            COUNT(DISTINCT bf.faculty_id) AS assigned_faculty
          FROM batches b
          LEFT JOIN batch_students bs ON bs.batch_id = b.id
          LEFT JOIN batch_faculty bf ON bf.batch_id = b.id
          WHERE b.is_deleted IS NOT TRUE
          GROUP BY b.name, b.status, b.location, b.start_date, b.end_date
          ORDER BY b.id`
      };
    }

    case 'NOTIFICATIONS':
      return {
        sql: `SELECT title, COUNT(*) AS notification_count,
            COUNT(CASE WHEN is_read THEN 1 END) AS read_count,
            COUNT(CASE WHEN NOT is_read THEN 1 END) AS unread_count
          FROM notifications GROUP BY title ORDER BY notification_count DESC LIMIT 20`
      };

    default:
      return null;
  }
}

// ─── AI RESPONSE SYNTHESIZER (Always Formulates Natural AI Answers) ───────────
async function synthesizeNaturalAnswer({ query, rows, rowCount, history = [], userLang = 'English', ctx = {} }) {
  // If no rows were returned from the live database
  if (!rows || rows.length === 0) {
    if (ctx && ctx.batchRef) {
      if (userLang === 'Marathi') return `डेटाबेसमध्ये **Batch ${ctx.batchRef}** चा कोणताही रेकॉर्ड सापडला नाही.`;
      if (userLang === 'Hindi') return `डेटाबेस में **Batch ${ctx.batchRef}** का कोई रिकॉर्ड नहीं मिला।`;
      return `Batch **${ctx.batchRef}** was not found in the current LTC database.`;
    }
    if (userLang === 'Hindi') return 'इस प्रश्न से संबंधित कोई रिकॉर्ड LTC डेटाबेस में नहीं मिला।';
    if (userLang === 'Marathi') return 'या प्रश्नाशी संबंधित कोणताही रेकॉर्ड LTC डेटाबेसमध्ये सापडला नाही.';
    return 'No matching records were found in the LTC database for this query.';
  }

  // Use Gemini to synthesize live database rows into a fluid, conversational explanation
  try {
    const recentHistory = (history || []).slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');
    const rowDataSample = JSON.stringify(rows.slice(0, 40));

    const prompt = `Context: ${recentHistory || 'None'}
Question: ${query}
Language: ${userLang}
Database Records: ${rowDataSample}

Write a natural, direct conversational response to the question based solely on the database records above. Use bold text for numbers and clean markdown tables for rosters. Do not include any introductory thoughts, checklists, or meta commentary.`;

    const answer = await callGemini(prompt, false, 750);
    if (answer && answer.trim().length > 5) {
      let clean = answer.trim();
      // Strip any accidental self-checklists or meta commentary
      clean = clean.replace(/^(?:\s*[-*•]?\s*[^?\n]+\?\s*(?:Yes|No)\.?\s*)+/gmi, '').trim();
      clean = clean.replace(/^(?:Check\s+Constraints|Thought|Analysis|Checklist|Guidelines|Instructions|Strictly based on DB records)[\s\S]*?(?=\n\n|\n[A-Z#*])/i, '').trim();
      if (clean.length > 5) return clean;
    }
  } catch (err) {
    console.warn('[LTC Chatbot] AI synthesis fallback:', err.message);
  }

  // Graceful fallback for single summary record in case of network timeout
  if (rows.length === 1) {
    const r = rows[0];
    const bName = r.batch_name ? `**${r.batch_name}**` : 'The database';
    if ('total_students' in r || 'enrolled_students' in r) {
      const cnt = r.total_students ?? r.enrolled_students;
      return `${bName} currently has **${cnt}** enrolled students${r.total_squads ? ` across **${r.total_squads}** squads` : ''}${r.assigned_faculty ? ` with **${r.assigned_faculty}** assigned faculty members` : ''}.`;
    }
    let out = '';
    for (const [k, v] of Object.entries(r)) {
      out += `* **${k.replace(/_/g, ' ')}**: ${v ?? '—'}\n`;
    }
    return out.trim();
  }

  // Graceful table fallback for list queries in case of network timeout
  const headers = Object.keys(rows[0]);
  const headerLine = `| ${headers.map(h => h.replace(/_/g,' ').toUpperCase()).join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataLines = rows.slice(0, 50).map(r =>
    `| ${headers.map(h => String(r[h] ?? '—').replace(/\|/g, '-')).join(' | ')} |`
  );
  return `Found **${rowCount}** records:\n\n${headerLine}\n${separator}\n${dataLines.join('\n')}`;
}

// ─── DOMAIN KNOWLEDGE ANSWER GENERATOR ───────────────────────────────────────
async function answerDomainQuestion(query, userLang) {
  try {
    const domainPrompt = `Official Information:
${LTC_DOMAIN_KNOWLEDGE}

Question: ${query}
Language: ${userLang}

Write a direct, professional answer explaining the question based on the official LTC information above. Use bold text and bullet points where helpful. Do not include introductory notes, meta commentary, or preambles.`;

    const answer = await callGemini(domainPrompt, false, 650);
    if (answer && answer.trim().length > 10) {
      let clean = answer.trim();
      clean = clean.replace(/^(?:\s*[-*•]?\s*[^?\n]+\?\s*(?:Yes|No)\.?\s*)+/gmi, '').trim();
      clean = clean.replace(/^(?:Tone|Check\s+adherence|Check\s+Constraints|Thought|Analysis|Checklist|Guidelines|Instructions):[\s\S]*?(?=\n\n|\n[A-Z#*])/i, '').trim();
      if (clean.length > 10) return clean;
    }
  } catch (err) {
    console.warn('[LTC Chatbot] Domain question AI error:', err.message);
  }

  if (userLang === 'Marathi') {
    return 'LTC (Life Transformation Centre) हा MIT-WPU चा विद्यार्थ्यांच्या सर्वांगीण विकासासाठी आणि मूल्यशिक्षणासाठी आयोजित केलेला निवासी उपक्रम आहे. यात ५ मुख्य स्तंभ आहेत: १. योग व ध्यान, २. कृषी व ग्रामीण अनुभव, ३. सार्वत्रिक मानवी मूल्ये, ४. श्रमदान व समाजसेवा, ५. नेतृत्व व जीवन कौशल्ये.';
  }
  if (userLang === 'Hindi') {
    return 'LTC (Life Transformation Centre) MIT-WPU का एक आवासीय अनुभवात्मक शिक्षण कार्यक्रम है जो छात्रों में अनुशासन, योग, कृषि, सामाजिक सेवा और मानवीय मूल्यों के विकास के लिए आयोजित किया जाता है।';
  }
  return 'The Life Transformation Centre (LTC) is a flagship residential experiential learning program by MIT World Peace University (MIT-WPU), Pune. Held at the Boribel campus, it fosters holistic transformation through 5 Core Pillars: (1) Yoga & Meditation, (2) Agriculture & Rural Immersion, (3) Universal Human Values & Ethics, (4) Social Service & Shramdaan, and (5) Life Skills & Leadership.';
}

// ─── MAIN CHAT PIPELINE ──────────────────────────────────────────────────────
async function processChatbotQuery({ query, history = [], activeBatchId = null }) {
  const userLang = detectLanguage(query);
  const q = String(query || '').trim();

  // Step 1: Extract dynamic context from history & current query
  const histCtx = resolveContextFromHistory(history, q);
  const explicitBatch = parseBatchRef(q);
  const effectiveBatchRef = explicitBatch || histCtx.batchRef || (activeBatchId && activeBatchId !== 'ALL' ? String(activeBatchId) : null);
  const ctx = { ...histCtx, batchRef: effectiveBatchRef };

  // Step 2: Classify intent
  const intent = classifyIntent(q, ctx);

  // Handle Greetings
  if (intent === 'GREETING') {
    const greet = userLang === 'Marathi'
      ? 'नमस्कार! मी LTC डेटाबेस AI सहाय्यक आहे. विद्यार्थी, बॅचेस, हजेरी, फीडबॅक, फॅकल्टी, पथक किंवा LTC संदर्भातील कोणत्याही माहितीबद्दल विचारा.'
      : userLang === 'Hindi'
        ? 'नमस्ते! मैं LTC डेटाबेस AI सहायक हूँ। छात्रों, बैच, उपस्थिति, फीडबैक, फैकल्टी, स्क्वाड या LTC से संबंधित किसी भी जानकारी के बारे में पूछें।'
        : 'Hello! I am your LTC Database Assistant. Ask me anything about students, batches, attendance, feedback submissions, faculty assignments, squads, or general LTC programs.';
    return { success: true, answer: greet };
  }

  // Handle Help
  if (intent === 'HELP') {
    const help = `Here is what I can query, explain, and calculate for you:\n\n` +
      `* **LTC Concepts & Programs:** LTC purpose, 5 Pillars, procedures, attendance rules, feedback categories\n` +
      `* **Batches:** active batches, total batch list, dates, location, enrollment rankings\n` +
      `* **Students:** student counts, rosters, PRN lookup, division/squad/room assignments\n` +
      `* **Attendance:** pillar-wise & day-wise attendance percentages, present & absentee rosters\n` +
      `* **Feedback:** Pre-LTC, Post-LTC, and Service-Trainers submission numbers and pending lists\n` +
      `* **Faculty & Mentors:** assigned faculty, squad assignments, department distribution\n` +
      `* **Squads & Leaders:** squad student counts, designated squad leaders, room allocations\n` +
      `* **Medical & Consent:** blood groups, known allergies, medical conditions, undertaking forms\n\n` +
      `_Ask any question in English, Hindi, or Marathi._`;
    return { success: true, answer: help };
  }

  // Handle General LTC Domain / Conceptual Questions without SQL
  if (intent === 'LTC_DOMAIN_KNOWLEDGE') {
    const domainAnswer = await answerDomainQuestion(q, userLang);
    return { success: true, answer: domainAnswer, rowCount: 0, language: userLang };
  }

  // Step 3: Determine safe Read-Only SQL query
  let targetSql = null;

  const deterministicIntents = new Set([
    'OVERVIEW', 'BATCH_LIST', 'BATCH_RANKING', 'STUDENT_COUNT', 'STUDENT_LIST',
    'STUDENT_LOOKUP_PRN', 'STUDENT_SEARCH', 'SQUAD', 'SQUAD_LEADER',
    'ATTENDANCE', 'FEEDBACK', 'FACULTY', 'UNDERTAKING', 'RED_FLAGS',
    'CERTIFICATES', 'ROOM', 'NRI', 'SCHEDULE', 'BATCH_INFO', 'NOTIFICATIONS'
  ]);

  if (deterministicIntents.has(intent)) {
    const det = buildDynamicSql(intent, q, ctx);
    if (det && det.sql) {
      const validation = validateReadOnlySql(det.sql);
      if (validation.valid) {
        targetSql = validation.sql;
      }
    }
  }

  // Fallback to Gemini NL->SQL for complex, unanticipated, or custom analytical queries
  if (!targetSql) {
    try {
      const recentHistory = (history || []).slice(-6).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

      const nl2sqlPrompt = `${DB_SCHEMA}

${LTC_DOMAIN_KNOWLEDGE}

You are an expert PostgreSQL SQL generator for the LTC database.
Translate the user's natural language question into ONE safe, read-only SELECT query.

RULES:
1. Output ONLY SELECT or WITH ... SELECT statements. NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, or write operations.
2. NEVER use INTO, EXEC, EXECUTE, COPY, MERGE, CALL, GRANT, REVOKE.
3. Add LIMIT (max 100 for lists; no limit needed for aggregate queries).
4. Discover data dynamically: NEVER assume specific batch IDs, batch names, student counts, squad names, or database contents.
5. If a batch is mentioned or in context, filter dynamically by name or ID (e.g. b.name ILIKE '%...' or b.id = ...). If no batch is specified, query across all relevant batches.
6. When calculating rankings, comparisons, or totals (e.g., 'highest number of students', 'lowest attendance', 'most feedback'), use SQL GROUP BY, ORDER BY, and aggregates dynamically.
7. To link feedback to batches reliably, join feedback on batch_id OR via batch_students (f.user_id = bs.student_id).
8. If the user is asking a general conceptual question about LTC (e.g., what is LTC, explain 5 pillars), return {"is_domain_question": true}.
9. If the question cannot be answered from the database schema or LTC domain, return {"sql": null, "unanswerable": true}.

CONVERSATION HISTORY (for context):
${recentHistory || 'None'}

USER QUESTION: ${q}
ACTIVE BATCH FILTER: ${effectiveBatchRef ? effectiveBatchRef : 'None (search all batches)'}

Respond ONLY with this exact JSON format:
{"sql": "SELECT ...", "is_domain_question": false, "explanation": "brief"}`;

      const llmResult = await callGemini(nl2sqlPrompt, true, 600);

      if (llmResult && llmResult.is_domain_question) {
        const domainAnswer = await answerDomainQuestion(q, userLang);
        return { success: true, answer: domainAnswer, rowCount: 0, language: userLang };
      }

      if (llmResult && llmResult.sql && !llmResult.unanswerable) {
        const validation = validateReadOnlySql(llmResult.sql);
        if (validation.valid) {
          targetSql = validation.sql;
        }
      } else if (llmResult && llmResult.unanswerable) {
        const unanswerable = userLang === 'Marathi'
          ? 'हे प्रश्न LTC डेटाबेसमधून उत्तर देणे शक्य नाही. कृपया उपलब्ध बॅचेस, विद्यार्थी, हजेरी, किंवा फीडबॅक डेटाशी संबंधित प्रश्न विचारा.'
          : userLang === 'Hindi'
            ? 'इस प्रश्न का उत्तर LTC डेटाबेस से देना संभव नहीं है। कृपया उपलब्ध बैच, छात्र, उपस्थिति या फीडबैक से संबंधित प्रश्न पूछें।'
            : 'This question cannot be answered from the LTC database. Please ask something related to batches, students, attendance, feedback, or faculty.';
        return { success: true, answer: unanswerable };
      }
    } catch (geminiErr) {
      console.warn('[LTC Chatbot] Gemini NL→SQL error, trying generic resolver:', geminiErr.message);
    }
  }

  // Fallback if no valid query could be formulated
  if (!targetSql) {
    const fallback = userLang === 'Marathi'
      ? 'मला हे प्रश्न समजले नाही. बॅचेस, विद्यार्थी, हजेरी, किंवा फीडबॅकबद्दल विचारा.'
      : userLang === 'Hindi'
        ? 'मैं यह प्रश्न समझ नहीं पाया। बैच, छात्र, उपस्थिति, या फीडबैक के बारे में पूछें।'
        : 'I couldn\'t understand that question. Try asking about batches, students, attendance, feedback, faculty, or squads.';
    return { success: true, answer: fallback };
  }

  // Step 4: Execute query in strictly enforced READ-ONLY transaction
  const execResult = await executeReadOnlyQuery(targetSql);

  if (!execResult.success) {
    const errMsg = userLang === 'Marathi'
      ? 'माहिती मिळवताना अडचण आली. कृपया प्रश्न पुन्हा विचारा.'
      : userLang === 'Hindi'
        ? 'डेटाबेस से जानकारी प्राप्त करने में समस्या आई। कृपया प्रश्न दोबारा पूछें।'
        : 'I encountered an issue retrieving data for that question. Please try rephrasing.';
    return { success: true, answer: errMsg };
  }

  // Step 5: Always synthesize final response with AI for natural, conversational clarity
  const finalAnswer = await synthesizeNaturalAnswer({
    query: q,
    rows: execResult.rows,
    rowCount: execResult.rowCount,
    history,
    userLang,
    ctx
  });

  return {
    success: true,
    answer: finalAnswer,
    rowCount: execResult.rowCount,
    language: userLang
  };
}

module.exports = {
  processChatbotQuery,
  validateReadOnlySql,
  executeReadOnlyQuery
};
