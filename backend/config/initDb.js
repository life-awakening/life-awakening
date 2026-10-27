const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const seedImmersionSchedulesForBatch = async (pool, batchId) => {
  const activities = [];
  const pillars = [
    { name: 'Agriculture & Nature' },
    { name: 'Physical Fitness & Sports' },
    { name: 'Team Building & Leadership' },
    { name: 'Patriotism & Nation Building' },
    { name: 'Spirituality & Peace' }
  ];
  for (let day = 1; day <= 5; day++) {
    for (const p of pillars) {
      activities.push({
        title: `Day ${day}: ${p.name}`,
        date: `Day ${day}`,
        time: "09:00 AM",
        panel: "ALL"
      });
    }
  }

  try {
    for (const act of activities) {
      await pool.query(
        "INSERT INTO schedules (batch_id, title, date, time, panel) VALUES ($1, $2, $3, $4, $5)",
        [batchId, act.title, act.date, act.time, act.panel]
      );
    }
    console.log(`LAP Immersion Schedule seeding complete for batch ${batchId}.`);
  } catch (err) {
    console.error(`Failed to seed LAP immersion schedules for batch ${batchId}:`, err);
  }
};

const seedImmersionSchedules = async (pool) => {
  // Automatic global schedule seeding and destructive purges are disabled
  // to ensure existing LTC batches and attendance/evaluation records are never modified.
  // Legitimate schedule creation is handled per-batch via seedImmersionSchedulesForBatch.
};

const defaultPool = require('./db');

const initDB = async (passedPool) => {
  const pool = passedPool || defaultPool;
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(100),
        semester VARCHAR(50),
        division VARCHAR(100),
        school VARCHAR(100),
        panel VARCHAR(100),
        is_primary BOOLEAN DEFAULT false,
        prn VARCHAR(100) UNIQUE,
        faculty_id VARCHAR(100) UNIQUE,
        phone VARCHAR(255),
        dob VARCHAR(50),
        gender VARCHAR(100),
        program VARCHAR(255),
        year VARCHAR(100),
        designation VARCHAR(255),
        status VARCHAR(100) DEFAULT 'active',
        nri BOOLEAN DEFAULT false,
        red_flag BOOLEAN DEFAULT false,
        squad VARCHAR(100),
        room VARCHAR(100),
        barcode VARCHAR(255),
        in_current_batch BOOLEAN DEFAULT false,
        is_locked BOOLEAN DEFAULT false,
        permissions JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Legacy columns (for backward compat)
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS in_current_batch BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS undertaking_submitted BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS undertaking_signed_name VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS undertaking_signed_date VARCHAR(50);");

    // Red Flags Detailed Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS red_flags (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        faculty_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(255),
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_squad_leader BOOLEAN DEFAULT false;");

    // ── Official Template Extended Fields (additive, non-breaking) ──
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS salutation VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS age INT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_no VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nominee_name VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nominee_relationship VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS nominee_email VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS lateral_entry BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_mobile VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255);")
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS faculty VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_size VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_video_consent BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS tshirt_consent BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS data_consent BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bag_check_consent BOOLEAN DEFAULT false;");

    // Alter column types to non-restrictive lengths for existing deployments
    const alterQueries = [
      "ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(255);",
      "ALTER TABLE users ALTER COLUMN gender TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN year TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN salutation TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN aadhar_no TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN parent_mobile TYPE VARCHAR(255);",
      "ALTER TABLE users ALTER COLUMN tshirt_size TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN jain_food TYPE VARCHAR(20);",
      "ALTER TABLE users ALTER COLUMN monday_fast TYPE VARCHAR(20);",
      "ALTER TABLE users ALTER COLUMN blood_group TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN emergency_contact_mobile TYPE VARCHAR(255);",
      "ALTER TABLE users ALTER COLUMN emergency_contact_alt_mobile TYPE VARCHAR(255);",
      "ALTER TABLE users ALTER COLUMN roll_number TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN semester TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN panel TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN squad TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN room TYPE VARCHAR(100);",
      "ALTER TABLE users ALTER COLUMN status TYPE VARCHAR(100);"
    ];
    for (const aq of alterQueries) {
      try { await pool.query(aq); } catch (_) { }
    }

    // ── Emergency Contact & Medical Undertaking Fields ──
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS known_allergies TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_conditions TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS current_medication TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_other TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_mobile VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_alt_mobile VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_email VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS jain_food VARCHAR(20) DEFAULT 'No';");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS monday_fast VARCHAR(20) DEFAULT 'No';");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_media BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_data BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_checks BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_medical BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS base_role VARCHAR(50);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS undertaking_submitted BOOLEAN DEFAULT false;");

    // ── Life Awakening School Registration Fields ──
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS school_branch VARCHAR(255);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS class_grade VARCHAR(100);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_medical_condition VARCHAR(50);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'submitted';");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_verified_by INT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_signature_url TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_consent_text TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_consent_confirmed BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_allergies BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_asthma BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_epilepsy BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_medication BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_physical_limitation BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_dietary_restriction BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_other BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS med_details TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_name TEXT;");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_relationship TEXT;");

    // ── Batches table ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        start_date DATE,
        end_date DATE,
        status VARCHAR(50) DEFAULT 'upcoming',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Enterprise upgrade: new batch columns (additive, safe)
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_code VARCHAR(50);");
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS year VARCHAR(10);");
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS capacity INT;");
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;");
    await pool.query("ALTER TABLE batches ADD COLUMN IF NOT EXISTS unavailable_rooms TEXT[] DEFAULT '{}';");

    // ── Batch-Student relationship ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batch_students (
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        squad VARCHAR(50),
        room VARCHAR(50),
        barcode VARCHAR(255),
        is_squad_leader BOOLEAN DEFAULT false,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (batch_id, student_id)
      );
    `);

    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS room_designation VARCHAR(100);");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS squad_designation VARCHAR(100);");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS is_dnr BOOLEAN DEFAULT false;");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS dnr_marked_at TIMESTAMP;");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS dnr_marked_by INT;");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS dnr_marked_by_name VARCHAR(255);");
    await pool.query("ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS dnr_reason TEXT;");

    // ── Batch-Faculty relationship ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batch_faculty (
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        faculty_id INT REFERENCES users(id) ON DELETE CASCADE,
        squad VARCHAR(50),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (batch_id, faculty_id)
      );
    `);
    await pool.query("ALTER TABLE batch_faculty ADD COLUMN IF NOT EXISTS room VARCHAR(50);");
    await pool.query("ALTER TABLE batch_faculty ADD COLUMN IF NOT EXISTS room_designation VARCHAR(100);");
    await pool.query("ALTER TABLE batch_faculty ADD COLUMN IF NOT EXISTS squad_designation VARCHAR(100);");

    // ── Batch Absentees Snapshots (Permanent & Historical) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batch_absentees_snapshots (
        id SERIAL PRIMARY KEY,
        batch_id INT NOT NULL UNIQUE,
        batch_name VARCHAR(255),
        created_by INT,
        created_by_name VARCHAR(255),
        total_students INT DEFAULT 0,
        total_absentees INT DEFAULT 0,
        students JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Schedules
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        title VARCHAR(255),
        date VARCHAR(50),
        time VARCHAR(50),
        faculty_id INT,
        panel VARCHAR(50)
      );
    `);
    await pool.query("ALTER TABLE schedules ADD COLUMN IF NOT EXISTS batch_id INT REFERENCES batches(id) ON DELETE CASCADE;");

    // Squad leaders
    await pool.query(`
      CREATE TABLE IF NOT EXISTS squad_leaders (
        squad_name VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        prn VARCHAR(255),
        phone VARCHAR(255)
      );
    `);

    // Legacy attendance (keep for backward compat)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        schedule_id INT,
        student_id INT,
        status VARCHAR(50)
      );
    `);

    await pool.query(`
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS locked_by_name VARCHAR(255);
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS batch_id INT REFERENCES batches(id) ON DELETE CASCADE;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS pillar VARCHAR(50);
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS day INT;
    `);

    try {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_batch_pillar_day 
        ON attendance (student_id, batch_id, pillar, day) 
        WHERE pillar IS NOT NULL;
      `);
    } catch (err) {
      // Ignore if index creation fails
    }

    // ── NEW: Attendance sessions (batch-level, ready architecture) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_sessions (
        id SERIAL PRIMARY KEY,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        session_date DATE,
        session_type VARCHAR(50) DEFAULT 'general',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── NEW: Attendance records v2 (batch-level) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_records_v2 (
        id SERIAL PRIMARY KEY,
        session_id INT REFERENCES attendance_sessions(id) ON DELETE CASCADE,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'absent',
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, student_id)
      );
    `);

    // Evaluations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id SERIAL PRIMARY KEY,
        student_id INT,
        faculty_id INT,
        schedule_id INT,
        marks INT,
        remarks TEXT,
        report_url TEXT,
        photo_url TEXT,
        marking_scheme VARCHAR(50)
      );
    `);

    await pool.query(`
      ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
    `);

    // --- LTC Rubrics 2026-2027 Assessment Model Tables ---
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_evaluations (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        squad VARCHAR(100),
        squad_id INT,
        division VARCHAR(100),
        division_id INT,
        pillar VARCHAR(50) NOT NULL,
        day INT NOT NULL,
        activity_name VARCHAR(255),
        attendance_marks NUMERIC(5,2) DEFAULT 0,
        participation_marks NUMERIC(5,2) DEFAULT 0,
        effort_marks NUMERIC(5,2) DEFAULT 0,
        learning_marks NUMERIC(5,2) DEFAULT 0,
        discipline_marks NUMERIC(5,2) DEFAULT 0,
        reflection_marks NUMERIC(5,2) DEFAULT 0,
        daily_total NUMERIC(5,2) DEFAULT 0,
        remarks TEXT,
        evaluated_by INT REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'draft',
        locked_by INT REFERENCES users(id) ON DELETE SET NULL,
        locked_at TIMESTAMP,
        unlocked_by INT REFERENCES users(id) ON DELETE SET NULL,
        unlocked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, batch_id, pillar, day)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS final_evaluation_summary (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        agriculture_marks NUMERIC(5,2) DEFAULT 0,
        physical_marks NUMERIC(5,2) DEFAULT 0,
        leadership_marks NUMERIC(5,2) DEFAULT 0,
        patriotism_marks NUMERIC(5,2) DEFAULT 0,
        spirituality_marks NUMERIC(5,2) DEFAULT 0,
        final_score_out_of_100 NUMERIC(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, batch_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluation_logs (
        id SERIAL PRIMARY KEY,
        evaluation_id INT REFERENCES student_evaluations(id) ON DELETE SET NULL,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        old_values JSONB,
        new_values JSONB,
        changed_by INT REFERENCES users(id) ON DELETE SET NULL,
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Performance Indexes
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_student ON student_evaluations(student_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_batch ON student_evaluations(batch_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_pillar_day ON student_evaluations(pillar, day);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_squad ON student_evaluations(squad);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_squad_id ON student_evaluations(squad_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_eval_status ON student_evaluations(status);");

    // Ensure unique constraints exist for conflict resolution
    try {
      await pool.query(`
        ALTER TABLE final_evaluation_summary 
        ADD CONSTRAINT final_evaluation_summary_student_id_batch_id_key UNIQUE (student_id, batch_id);
      `);
    } catch (err) {
      // Ignore if constraint already exists
    }

    try {
      await pool.query(`
        ALTER TABLE student_evaluations 
        ADD CONSTRAINT student_evaluations_student_id_batch_id_pillar_day_key UNIQUE (student_id, batch_id, pillar, day);
      `);
    } catch (err) {
      // Ignore if constraint already exists
    }
    try {
      await pool.query(`
        ALTER TABLE student_evaluations ADD COLUMN IF NOT EXISTS locked_by_name VARCHAR(255);
      `);
    } catch (err) {
      // Ignore
    }
    // Documents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        url TEXT,
        uploaded_by INT,
        target_role VARCHAR(50),
        batch_id INT,
        file_type VARCHAR(100) DEFAULT 'Document',
        description TEXT,
        current_version INT DEFAULT 1
      );
    `);
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS batch_id INT;");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(100) DEFAULT 'Document';");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;");
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;");

    // Document Versions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_versions (
        id SERIAL PRIMARY KEY,
        document_id INT REFERENCES documents(id) ON DELETE CASCADE,
        version INT NOT NULL,
        url VARCHAR(500) NOT NULL,
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insurance
    await pool.query(`
      CREATE TABLE IF NOT EXISTS insurance (
        id SERIAL PRIMARY KEY,
        prn VARCHAR(100) UNIQUE,
        policy_number VARCHAR(255),
        provider VARCHAR(255)
      );
    `);

    // Feedback
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id INT,
        role VARCHAR(50),
        feedback_text TEXT,
        category VARCHAR(100),
        additional_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tickets
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        resolution TEXT,
        resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Problem';");
    await pool.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'Medium';");
    await pool.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS on_behalf_of VARCHAR(255);");
    await pool.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS screenshot TEXT;");

    // Journey Media
    await pool.query(`
      CREATE TABLE IF NOT EXISTS journey_media (
        id SERIAL PRIMARY KEY,
        batch_id INT,
        squad VARCHAR(100),
        uploaded_by INT REFERENCES users(id) ON DELETE CASCADE,
        media_type VARCHAR(10) NOT NULL,
        media_url TEXT NOT NULL,
        caption TEXT,
        is_group_photo BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Journey Media table columns for S3 migration support
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS storage_type VARCHAR(50) DEFAULT 'local';");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS storage_key VARCHAR(255);");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS file_size BIGINT;");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS is_group_photo BOOLEAN DEFAULT FALSE;");
    await pool.query("ALTER TABLE journey_media ADD COLUMN IF NOT EXISTS slot_number INT;");

    // System settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value VARCHAR(255)
      );
    `);

    await pool.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('squads_locked', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Record permanent RI Integration Deployment Boundary timestamp on first deploy
    await pool.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('ri_integration_deployed_at', CURRENT_TIMESTAMP::text)
      ON CONFLICT (key) DO NOTHING;
    `);

    // Life Awakening: Enforce single active batch per student at the database level
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_student_single_batch()
      RETURNS TRIGGER AS $$
      DECLARE
        existing_batch_name TEXT;
        existing_batch_id INT;
      BEGIN
        SELECT b.id, b.name INTO existing_batch_id, existing_batch_name
        FROM batch_students bs
        JOIN batches b ON b.id = bs.batch_id AND b.is_deleted IS NOT TRUE
        WHERE bs.student_id = NEW.student_id
          AND bs.batch_id != NEW.batch_id
        LIMIT 1;

        IF FOUND THEN
          RAISE EXCEPTION 'Student #% is already assigned to batch "%" (ID: %). A student can belong to only one batch.',
            NEW.student_id, existing_batch_name, existing_batch_id
            USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_check_student_single_batch ON batch_students;
      CREATE TRIGGER trg_check_student_single_batch
      BEFORE INSERT ON batch_students
      FOR EACH ROW
      EXECUTE FUNCTION check_student_single_batch();
    `);

    // Dynamic Translations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS translations (
        key TEXT PRIMARY KEY,
        hi TEXT,
        mr TEXT
      );
    `);

    // Seed translations table from frontend static translations if empty
    const transCount = await pool.query("SELECT COUNT(*) FROM translations;");
    if (parseInt(transCount.rows[0].count) === 0) {
      console.log("Seeding translations table from frontend static file...");
      const fs = require('fs');
      const path = require('path');
      const staticTransPath = path.join(__dirname, '../../frontend/src/utils/translations.js');
      if (fs.existsSync(staticTransPath)) {
        try {
          const content = fs.readFileSync(staticTransPath, 'utf8');
          const tempPath = path.join(__dirname, 'temp_translations.js');
          const commonJsContent = content.replace('export const translations =', 'module.exports =');
          fs.writeFileSync(tempPath, commonJsContent, 'utf8');

          const translations = require(tempPath);
          const hiDict = translations.hi || {};
          const mrDict = translations.mr || {};

          const keys = Array.from(new Set([...Object.keys(hiDict), ...Object.keys(mrDict)]));
          for (const key of keys) {
            const hiVal = hiDict[key] || '';
            const mrVal = mrDict[key] || '';
            await pool.query(
              "INSERT INTO translations (key, hi, mr) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING;",
              [key, hiVal, mrVal]
            );
          }
          console.log(`Seeded ${keys.length} translations successfully.`);
        } catch (seedErr) {
          console.error("Error seeding translations table:", seedErr);
        } finally {
          const tempPath = path.join(__dirname, 'temp_translations.js');
          if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (_) { }
          }
        }
      } else {
        console.warn("Frontend static translations file not found at:", staticTransPath);
      }
    }

    // ── NEW: Audit Logs ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        user_name VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── NEW: Certificates (ready architecture) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id SERIAL PRIMARY KEY,
        student_id INT REFERENCES users(id) ON DELETE CASCADE,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        type VARCHAR(50) DEFAULT 'completion',
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data JSONB,
        UNIQUE(student_id, batch_id, type)
      );
    `);

    // ── NEW: Completion Reports (ready architecture) ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS completion_reports (
        id SERIAL PRIMARY KEY,
        batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        generated_by INT REFERENCES users(id),
        data JSONB
      );
    `);

    // ── NEW: Upload Jobs table for background processing ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_jobs (
        id SERIAL PRIMARY KEY,
        batch_id INT REFERENCES batches(id) ON DELETE SET NULL,
        filename VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        total_records INT DEFAULT 0,
        processed_records INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        errors JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── NEW: Email Queue table for background worker ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        html TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        error_message TEXT,
        resend_id VARCHAR(255),
        delivery_status VARCHAR(50),
        bounce_reason TEXT,
        smtp_response TEXT,
        provider_status VARCHAR(50),
        last_status_update TIMESTAMP,
        cc TEXT,
        bcc TEXT,
        attachments JSONB,
        next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── Email Templates table & seeding ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        template_key VARCHAR(100) UNIQUE,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        subject VARCHAR(255) NOT NULL,
        body_html TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_key VARCHAR(100);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key) WHERE template_key IS NOT NULL;
    `);

    const parentTmplCheck = await pool.query("SELECT id FROM email_templates WHERE name = 'Parent Communication'");
    if (parentTmplCheck.rowCount === 0) {
      await pool.query(
        `INSERT INTO email_templates (name, category, subject, body_html, variables)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          'Parent Communication',
          'Parent Communication',
          'Life Awakening Program (LAP) – Parent Communication – LTC {{batch_name}}',
          `Dear Parents/Guardians,<br/><br/>Greetings from MIT World Peace University!<br/><br/>It gives us immense pleasure to welcome you and your ward to the Life Transformation Centre (LTC) for the Life Awakening Program (LAP) – {{batch_name}}, to be held from {{start_date}} to {{end_date}}, Academic Year 2026–27.<br/><br/>The Life Awakening Program is a unique experiential learning initiative designed to provide students with meaningful opportunities for self-discovery, personal growth, leadership, teamwork, discipline, social responsibility, and connection with nature and community life.<br/><br/>The Life Transformation Centre follows the philosophy of "Connecting the Soul to the Soil" and integrates five important dimensions of holistic development:<br/><ul><li>Agriculture &amp; Nature</li><li>Physical Fitness &amp; Sports</li><li>Team Building &amp; Leadership</li><li>Patriotism &amp; Nation Building</li><li>Spirituality &amp; Peace</li></ul><br/>The programme is intended to take students beyond conventional classroom learning and provide them with experiences that encourage confidence, responsibility, resilience, empathy, and a deeper understanding of life and society. The official LTC website provides further information about the programme, its vision, activities, and student experiences.<br/><br/>Official LTC Website: <a href="https://lifetransformation.org.in/">https://lifetransformation.org.in/</a><br/><br/>Student Experiences – LTC Batch 1<br/><br/>Parents are encouraged to watch the following video to understand the experiences and reflections of students who participated in the Life Awakening Program:<br/><a href="https://www.youtube.com/watch?v=5bXD_Y22UJE">LTC Batch No. 1 | Academic Year 2026–27 | Life Awakening Program | Student's Experiences & Reviews</a><br/><br/>{{batch_name}} Parent Communication – WhatsApp Channel<br/><br/>For regular updates and important communication related to LTC {{batch_name}}, parents are requested to join the official WhatsApp Channel through the link below:<br/><a href="https://whatsapp.com/channel/0029Vb8MNBmFsn0p4z2Asd08">https://whatsapp.com/channel/0029Vb8MNBmFsn0p4z2Asd08</a><br/><br/>Emergency &amp; Important Contact Numbers<br/><br/><table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif; font-size:14px;"><tr style="background-color:#f2f2f2;"><th>Sr. No.</th><th>Name</th><th>Designation</th><th>Contact Number</th></tr><tr><td>1</td><td>Gaurav Karandikar</td><td>Director</td><td>9100735408</td></tr><tr><td>2</td><td>Kamal Dubey</td><td>Operation Head</td><td>9922891243</td></tr><tr><td>3</td><td>Nitin Sangale</td><td>Academics Manager</td><td>9309177426</td></tr><tr><td>4</td><td>Shardool Shirolkor</td><td>Associate Director</td><td>9879616220</td></tr></table><br/><br/>A Note to Parents<br/><br/>We understand that sending your ward for a residential experiential programme may naturally bring questions and concerns. Please be assured that the programme is planned and coordinated with due attention to student safety, discipline, wellbeing, accommodation, food, transportation, and overall supervision.<br/><br/>We request parents to encourage their wards to participate in all activities with an open mind, positive attitude, discipline, and enthusiasm. This programme is an opportunity for students to step outside their comfort zones, build meaningful relationships, discover their strengths, and create memories that will remain with them for years to come.<br/><br/>We sincerely appreciate your trust, cooperation, and support in making this transformative journey meaningful for your ward.<br/><br/>We look forward to welcoming LTC {{batch_name}} and wish all our students a safe, enriching, joyful, and transformative experience.<br/><br/>Warm Regards,<br/>LTC Team<br/>MIT World Peace University, Pune`,
          JSON.stringify(["name", "batch_name", "start_date", "end_date"])
        ]
      );
    }

    const facultyTmplCheck = await pool.query("SELECT id FROM email_templates WHERE name = 'Faculty Data Collection'");
    if (facultyTmplCheck.rowCount === 0) {
      await pool.query(
        `INSERT INTO email_templates (name, category, subject, body_html, variables)
         VALUES ($1, $2, $3, $4, $5);`,
        [
          'Faculty Data Collection',
          'Faculty Communication',
          'Minutes of the Meeting (MoM) & Student Data Collection Instructions – LTC',
          `<p>Dear Faculty Members,</p>
<p>Please find attached the Minutes of the Meeting (MoM) for your reference, along with the Google Form link for student data collection and the necessary instructions.</p>
<div style="margin: 18px 0; padding: 14px 18px; background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px;">
  <strong style="color: #166534;">Google Form Link:</strong><br/>
  <a href="{{google_form_link}}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline; word-break: break-all;">{{google_form_link}}</a>
</div>
<p>You are requested to kindly go through the MoM and the instructions carefully and complete the assigned data collection within the stipulated timeline.</p>
<h3 style="color: #0f172a; margin: 24px 0 10px 0; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
  IMPORTANT INSTRUCTIONS FOR DATA COLLECTION AND CONSOLIDATION
</h3>
<p>Kindly follow the below-mentioned process carefully:</p>
<ol style="padding-left: 20px; margin: 14px 0;">
  <li style="margin-bottom: 14px;">
    <strong style="color: #0f172a;">Create a Copy of the Google Form</strong><br/>
    Please create a copy of the shared Google Form and clearly mention your respective Panel Name in the title of the copied form.
  </li>
  <li style="margin-bottom: 14px;">
    <strong style="color: #0f172a;">Publish and Share the Form</strong><br/>
    After creating the copy, kindly publish the form and share the generated link with all concerned students of your respective class/panel. Please ensure that the form link is circulated promptly and that all students submit their responses within the stipulated timeline.
  </li>
  <li style="margin-bottom: 14px;">
    <strong style="color: #0f172a;">Verify the Response Count</strong><br/>
    Once the responses are received, kindly verify the total response count against the expected student strength of your respective class/panel. Please ensure that all expected students have submitted their responses before downloading the response sheet.
  </li>
  <li style="margin-bottom: 14px;">
    <strong style="color: #0f172a;">Download and Update the Master Sheet</strong><br/>
    After verifying the response count, download the response sheet and update the complete and verified data in the Master Sheet shared by the LTC Management System Portal Team.<br/><br/>
    The consolidated data will subsequently be used for uploading the required student information into the LTC Management System Portal.
  </li>
  <li style="margin-bottom: 14px;">
    <strong style="color: #0f172a;">Data Verification – Mandatory Checks</strong><br/>
    Before submitting the final data, kindly ensure that:
    <ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">
      <li>The response count is verified against the actual/expected student strength.</li>
      <li>All expected students have submitted the Google Form.</li>
      <li>The data is complete, accurate, and properly verified.</li>
      <li>The prescribed format and column names of the Master Sheet are not altered.</li>
      <li>Any missing, incomplete, duplicate, or incorrect information is identified and rectified promptly.</li>
      <li>The final data is thoroughly checked before submission to avoid errors during portal uploading.</li>
    </ul>
  </li>
</ol>
<h4 style="color: #0f172a; margin: 24px 0 8px 0; font-size: 14.5px;">Timeline for Completion</h4>
<div style="margin: 12px 0 16px 0; padding: 12px 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
  All concerned faculty members are requested to complete the required data collection and update the Master Sheet by <strong>{{date}}</strong>.
</div>
<p>The Master Sheet will be shared with the Nodal Officers or Department Coordinators only for the consolidation of the final data. Kindly ensure that the assigned task is completed by the Nodal Officers accurately and within the stipulated timeline.</p>
<div style="margin: 22px 0; padding: 16px 18px; background-color: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 8px; color: #9f1239;">
  <p style="margin: 0 0 10px 0; font-weight: bold;">
    Important: Separate Google Forms must be created for each individual panel. Although this document/template contains details of multiple panels, each Google Form should contain data for only one panel.
  </p>
  <p style="margin: 0 0 10px 0;">
    For example, SYBBA-A should have one dedicated Google Form with a unique link, and the same process should be followed for every other panel. Separate links must be created for each panel to avoid the merging or mixing of data between different panels and to ensure accurate data consolidation.
  </p>
  <p style="margin: 0 0 10px 0;">
    The Nodal Officers are requested to use this document as a template/reference and create separate Google Forms and links for their respective panels.
  </p>
  <p style="margin: 0; font-weight: bold;">
    Your cooperation and timely completion of the above process are essential to ensure accurate data consolidation and smooth, error-free uploading of student information into the LTC Management System Portal.
  </p>
</div>
<p>Thank you for your continued support and cooperation.</p>
<p style="margin-bottom: 0;">
  Regards,<br/>
  <strong>LTC TEAM</strong><br/>
  MIT World Peace University, Pune
</p>`,
          JSON.stringify(["date", "google_form_link"])
        ]
      );
    }

    // ── NEW: WhatsApp Queue table for background worker ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_queue (
        id SERIAL PRIMARY KEY,
        to_phone VARCHAR(50) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        attempts INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        error_message TEXT,
        next_run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);


    // ── Notifications tables ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, -- nullable column (original field kept for compatibility but nullable)
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type VARCHAR(50) DEFAULT 'announcement',
        channel VARCHAR(50) DEFAULT 'in-app',
        target_type VARCHAR(50) DEFAULT 'individual',
        target_batch_id INTEGER,
        target_squad VARCHAR(50),
        target_role VARCHAR(50),
        target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        recipient_count INTEGER DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id SERIAL PRIMARY KEY,
        notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(notification_id, user_id)
      );
    `);

    // ── Password Reset OTPs Table ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        otp_hash VARCHAR(255) NOT NULL,
        pending_password_hash VARCHAR(255),
        reset_token_hash VARCHAR(255),
        attempts_left INTEGER DEFAULT 5,
        used BOOLEAN DEFAULT FALSE,
        reset_used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        token_expires_at TIMESTAMP,
        resend_available_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE password_reset_otps
      ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS reset_used BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP;
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_password_otps_user ON password_reset_otps(user_id);");

    // ── Performance Indexes ──
    await pool.query("CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_prn ON users(prn);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_email_queue_next_run ON email_queue(next_run_at);");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS resend_id VARCHAR(255);");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50);");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS bounce_reason TEXT;");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS smtp_response TEXT;");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMP;");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50);");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS cc TEXT;");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS bcc TEXT;");
    await pool.query("ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS attachments JSONB;");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_email_queue_resend_id ON email_queue(resend_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_email_queue_provider_status ON email_queue(provider_status);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_queue(status);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_next_run ON whatsapp_queue(next_run_at);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_in_batch ON users(in_current_batch);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_batch_students_batch ON batch_students(batch_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_batch_students_student ON batch_students(student_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_batch_students_squad ON batch_students(squad);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_batch_faculty_batch ON batch_faculty(batch_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch ON attendance_sessions(batch_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_attendance_records_v2_session ON attendance_records_v2(session_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_attendance_records_v2_batch ON attendance_records_v2(batch_id);");

    // Additional indexes for bulk upload scaling
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_faculty_id ON users(faculty_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_batch_faculty_faculty ON batch_faculty(faculty_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_division ON users(division);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_faculty ON users(faculty);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);");
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users(LOWER(email));");

    // Journey media optimization index
    await pool.query("CREATE INDEX IF NOT EXISTS idx_journey_media_batch_squad ON journey_media(batch_id, squad);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_journey_media_batch_group ON journey_media(batch_id, is_group_photo);");

    // Backfill hierarchy for existing users
    console.log("Starting hierarchy backfill for existing users...");
    const { findHierarchyPathByDepartment, findHierarchyPathBySchool } = require('../utils/hierarchy');
    const unmappedUsers = await pool.query(
      "SELECT id, department, school, division, faculty FROM users WHERE (role = 'student' OR role = 'faculty') AND (faculty IS NULL OR division IS NULL OR school IS NULL OR department IS NULL)"
    );
    console.log(`Found ${unmappedUsers.rowCount} users with incomplete hierarchy data. Mapping...`);
    for (const user of unmappedUsers.rows) {
      let hierPath = null;
      if (user.department) {
        hierPath = findHierarchyPathByDepartment(user.department);
      }
      if (!hierPath && user.school) {
        hierPath = findHierarchyPathBySchool(user.school);
      }
      if (hierPath) {
        await pool.query(
          "UPDATE users SET division = COALESCE(division, $1), faculty = COALESCE(faculty, $2), school = COALESCE(school, $3), department = COALESCE(department, $4) WHERE id = $5",
          [hierPath.division, hierPath.faculty, hierPath.school, hierPath.department || user.department, user.id]
        );
      }
    }
    console.log("Hierarchy backfill complete.");

    // Admin User
    const adminQuery = await pool.query("SELECT * FROM users WHERE role = 'admin'");
    if (adminQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['Admin User', 'admin@ltc.edu', hashedPassword, 'admin']
      );
      console.log('Admin User initialized: admin@ltc.edu');
    } else {
      console.log('PostgreSQL database ready. Admin already exists.');
    }

    // Ensure admin@ltc.edu.in exists as an alias for LTC Admin
    const ltcInAdminQuery = await pool.query("SELECT * FROM users WHERE email = 'admin@ltc.edu.in'");
    if (ltcInAdminQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['LTC Admin', 'admin@ltc.edu.in', hashedPassword, 'admin']
      );
      console.log('LTC Admin User initialized: admin@ltc.edu.in');
    }

    // RI Admin User (Rural Immersion Module Administrator)
    const riAdminQuery = await pool.query("SELECT * FROM users WHERE email = 'admin@ri.edu.in'");
    if (riAdminQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['RI Admin', 'admin@ri.edu.in', hashedPassword, 'ri_admin']
      );
      console.log('RI Admin User initialized: admin@ri.edu.in');
    } else {
      console.log('PostgreSQL database ready. RI Admin already exists.');
    }

    // Super Admin User (LTC)
    const superadminQuery = await pool.query("SELECT * FROM users WHERE role = 'superadmin'");
    if (superadminQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
        ['Super Admin', 'superadmin@ltc.edu', hashedPassword, 'superadmin']
      );
      console.log('Superadmin User initialized: superadmin@ltc.edu');
    } else {
      console.log('PostgreSQL database ready. Super Admin already exists.');
    }

    // RI Super Admin User (Rural Immersion Module Super Administrator)
    const riSuperadminQuery = await pool.query("SELECT * FROM users WHERE LOWER(email) = 'superadmin@ri.edu'");
    if (riSuperadminQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, 'active')",
        ['RI Super Admin', 'superadmin@ri.edu', hashedPassword, 'superadmin-ri']
      );
      console.log('RI Super Admin User initialized: superadmin@ri.edu');
    } else {
      console.log('PostgreSQL database ready. RI Super Admin already exists.');
    }

    // Ensure superadmin_readonly role setup ready
    console.log('PostgreSQL database ready. Super Admin & Role Management active.');

    // Dedicated Gallery User
    const galleryQuery = await pool.query("SELECT * FROM users WHERE LOWER(email) = 'gallery@ltc.edu'");
    if (galleryQuery.rowCount === 0) {
      const hashedPassword = await bcrypt.hash('Pppp0000@', 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, $5)",
        ['LAP Gallery', 'gallery@ltc.edu', hashedPassword, 'gallery', 'active']
      );
      console.log('Gallery User initialized: gallery@ltc.edu');
    } else {
      console.log('PostgreSQL database ready. Gallery User already exists.');
    }

    // Support User initialization (replacing legacy Jeeten Sir)
    const defaultSupportPassword = process.env.SUPPORT_DEFAULT_PASSWORD || 'Support@123';
    const supportQuery = await pool.query("SELECT * FROM users WHERE role = 'support' OR email = 'support@mitwpu.edu.in'");
    if (supportQuery.rowCount === 0) {
      const supportHashed = await bcrypt.hash(defaultSupportPassword, 10);
      await pool.query(
        "INSERT INTO users (name, email, password, role, status) VALUES ($1, $2, $3, $4, 'active')",
        ['LTC Support', 'support@mitwpu.edu.in', supportHashed, 'support']
      );
      console.log('Support User initialized: support@mitwpu.edu.in');
    } else {
      // Ensure role and active status are preserved without overwriting existing password
      await pool.query(
        "UPDATE users SET role = 'support', status = 'active' WHERE email = 'support@mitwpu.edu.in' OR role = 'support'"
      );
      console.log('PostgreSQL database ready. Support user active.');
    }

    // Also update legacy jeeten account role if present
    await pool.query(
      "UPDATE users SET role = 'support' WHERE email = 'jeeten@mitwpu.edu.in'"
    );

    // ── LTC Batch Reports Table ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ltc_batch_reports (
        id SERIAL PRIMARY KEY,
        batch_id INT UNIQUE REFERENCES batches(id) ON DELETE CASCADE,
        university_name VARCHAR(255) DEFAULT 'MIT-WPU',
        department_name VARCHAR(255) DEFAULT 'Design/ Engineering/ ...',
        batch_number VARCHAR(100) DEFAULT '(AY-2025-2026) 01',
        batch_dates VARCHAR(100) DEFAULT '',
        page1_data JSONB DEFAULT '{}'::jsonb,
        page2_data JSONB DEFAULT '{}'::jsonb,
        page3_data JSONB DEFAULT '{}'::jsonb,
        page4_data JSONB DEFAULT '{}'::jsonb,
        page5_data JSONB DEFAULT '{}'::jsonb,
        page6_data JSONB DEFAULT '{}'::jsonb,
        updated_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE ltc_batch_reports 
        ADD COLUMN IF NOT EXISTS page_locks JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS locked_data JSONB DEFAULT '{}'::jsonb;
    `);
    // ── WhatsApp Campaigns & Logs Migrations ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
        id VARCHAR(100) PRIMARY KEY,
        batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
        template_name VARCHAR(100) NOT NULL,
        media_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        total_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_campaign_logs (
        id SERIAL PRIMARY KEY,
        campaign_id VARCHAR(100) NOT NULL,
        student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        meta_message_id VARCHAR(255),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Alter batches to add schedule dates and updated_at
    await pool.query(`
      ALTER TABLE batches
      ADD COLUMN IF NOT EXISTS ri_start VARCHAR(100),
      ADD COLUMN IF NOT EXISTS ri_end VARCHAR(100),
      ADD COLUMN IF NOT EXISTS lrp_start VARCHAR(100),
      ADD COLUMN IF NOT EXISTS lrp_end VARCHAR(100),
      ADD COLUMN IF NOT EXISTS report_date VARCHAR(100),
      ADD COLUMN IF NOT EXISTS report_time VARCHAR(100),
      ADD COLUMN IF NOT EXISTS collect_date VARCHAR(100),
      ADD COLUMN IF NOT EXISTS return_date VARCHAR(100),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    // Alter whatsapp_queue to support templates and campaigns
    await pool.query(`
      ALTER TABLE whatsapp_queue
      ALTER COLUMN body DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS template_variables JSONB,
      ADD COLUMN IF NOT EXISTS media_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS meta_message_id VARCHAR(255);
    `);

    // Add indexes and columns for whatsapp campaigns
    await pool.query(`
      ALTER TABLE whatsapp_campaign_logs
      ADD COLUMN IF NOT EXISTS template_name VARCHAR(100);
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_campaign ON whatsapp_queue(campaign_id);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_logs_campaign ON whatsapp_campaign_logs(campaign_id);");

    // ── Squad Performance Isolated Table ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS squad_performance_selections (
        id SERIAL PRIMARY KEY,
        batch_id INT NOT NULL,
        day VARCHAR(50) NOT NULL,
        schedule_id INT,
        activity_title VARCHAR(255) NOT NULL,
        squad_name TEXT,
        first_squad TEXT,
        second_squad TEXT,
        third_squad TEXT,
        is_locked BOOLEAN DEFAULT FALSE,
        locked_by INT,
        locked_at TIMESTAMP WITH TIME ZONE,
        selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        selected_by INT,
        history JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_squad_perf_batch_day_act UNIQUE (batch_id, day, activity_title)
      );
      ALTER TABLE squad_performance_selections 
        ADD COLUMN IF NOT EXISTS first_squad TEXT,
        ADD COLUMN IF NOT EXISTS second_squad TEXT,
        ADD COLUMN IF NOT EXISTS third_squad TEXT,
        ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS locked_by INT,
        ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE squad_performance_selections 
        ALTER COLUMN squad_name TYPE TEXT,
        ALTER COLUMN first_squad TYPE TEXT,
        ALTER COLUMN second_squad TYPE TEXT,
        ALTER COLUMN third_squad TYPE TEXT;
      CREATE INDEX IF NOT EXISTS idx_squad_perf_batch ON squad_performance_selections(batch_id);
    `);

    // ── Official 5-Day Squad Grading & Scoring System Tables ──
    await pool.query(`
      CREATE TABLE IF NOT EXISTS squad_grading_results (
        id SERIAL PRIMARY KEY,
        batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        day VARCHAR(50) NOT NULL,
        activity_key VARCHAR(100) NOT NULL,
        sub_activity_key VARCHAR(100),
        rank_1_squad TEXT,
        rank_2_squad TEXT,
        rank_3_squad TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        locked_by INT REFERENCES users(id) ON DELETE SET NULL,
        locked_at TIMESTAMP WITH TIME ZONE,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        updated_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE squad_grading_results
        ALTER COLUMN rank_1_squad TYPE TEXT,
        ALTER COLUMN rank_2_squad TYPE TEXT,
        ALTER COLUMN rank_3_squad TYPE TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_squad_grading_result 
      ON squad_grading_results (batch_id, day, activity_key, COALESCE(sub_activity_key, ''));
      CREATE INDEX IF NOT EXISTS idx_squad_grading_batch ON squad_grading_results(batch_id);

      CREATE TABLE IF NOT EXISTS squad_grading_audit_logs (
        id SERIAL PRIMARY KEY,
        batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        day VARCHAR(50) NOT NULL,
        activity_key VARCHAR(100) NOT NULL,
        sub_activity_key VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        previous_ranks JSONB,
        new_ranks JSONB,
        admin_id INT REFERENCES users(id) ON DELETE SET NULL,
        admin_name VARCHAR(255),
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_squad_grading_audit_batch ON squad_grading_audit_logs(batch_id);

      CREATE TABLE IF NOT EXISTS database_reset_otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        email_1 VARCHAR(255) NOT NULL,
        otp_1_hash VARCHAR(255) NOT NULL,
        email_2 VARCHAR(255) NOT NULL,
        otp_2_hash VARCHAR(255) NOT NULL,
        otp_1_verified BOOLEAN DEFAULT FALSE,
        otp_2_verified BOOLEAN DEFAULT FALSE,
        attempts_left INTEGER DEFAULT 5,
        expires_at TIMESTAMP NOT NULL,
        resend_available_at TIMESTAMP NOT NULL,
        reset_session_token_hash VARCHAR(255),
        reset_session_expires_at TIMESTAMP,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_reset_otps_user ON database_reset_otps(user_id);
      CREATE INDEX IF NOT EXISTS idx_reset_otps_token ON database_reset_otps(reset_session_token_hash);

      CREATE TABLE IF NOT EXISTS performance_admin_roles (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_name VARCHAR(50) NOT NULL,
        assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_performance_role UNIQUE (user_id, role_name)
      );
      CREATE INDEX IF NOT EXISTS idx_perf_admin_user ON performance_admin_roles(user_id);

      -- ==========================================
      -- RI (Realization Internship) Isolated Schema
      -- ==========================================
      CREATE TABLE IF NOT EXISTS ri_batches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        source_program VARCHAR(50) DEFAULT 'LTC',
        source_batch_id INT REFERENCES batches(id) ON DELETE SET NULL,
        panel_capacity INT DEFAULT 60,
        status VARCHAR(50) DEFAULT 'active',
        start_date DATE,
        end_date DATE,
        batch_code VARCHAR(100),
        location VARCHAR(255),
        year VARCHAR(50),
        is_locked BOOLEAN DEFAULT FALSE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS batch_code VARCHAR(100);
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS location VARCHAR(255);
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS year VARCHAR(50);
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS panel_capacity INT DEFAULT 60;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS source_program VARCHAR(50) DEFAULT 'LTC';
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS source_batch_id INT REFERENCES batches(id) ON DELETE SET NULL;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS start_date DATE;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS end_date DATE;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE ri_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      CREATE TABLE IF NOT EXISTS ri_villages (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        location TEXT,
        sarpanch_name VARCHAR(255),
        sarpanch_mobile VARCHAR(50),
        panchayat VARCHAR(255),
        district VARCHAR(255),
        emergency_contact VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ri_batch_id, name)
      );

      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS detailed_address TEXT;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS principal_mobile VARCHAR(50);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS spoc_name VARCHAR(255);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS spoc_mobile VARCHAR(50);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS taluka VARCHAR(255);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS remark TEXT;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS nearby_services JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS nearby_services_fetched_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
      ALTER TABLE ri_villages ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

      CREATE TABLE IF NOT EXISTS ri_panels (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        panel_number INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        capacity INT DEFAULT 60,
        ri_village_id INT REFERENCES ri_villages(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ri_batch_id, panel_number)
      );

      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS ri_village_id INT REFERENCES ri_villages(id) ON DELETE SET NULL;
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS school VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS department VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS student_count INT;
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS boys_count INT;
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS girls_count INT;
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS coordinator_name VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS class_teacher_name VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS nodal_officer_name VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS nodal_officer_email VARCHAR(255);
      ALTER TABLE ri_panels ADD COLUMN IF NOT EXISTS nodal_officer_user_id INT REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS ri_batch_students (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        source_program VARCHAR(50) DEFAULT 'LTC',
        source_ltc_batch_id INT REFERENCES batches(id) ON DELETE SET NULL,
        enrollment_type VARCHAR(50) DEFAULT 'LTC_SYNC',
        ri_id VARCHAR(100) UNIQUE,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ri_batch_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS ri_batch_faculty (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        faculty_id INT REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        department VARCHAR(255),
        designation VARCHAR(255),
        employee_id VARCHAR(100),
        role VARCHAR(50) DEFAULT 'Mentor',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ri_batch_id, ri_panel_id, email)
      );

      ALTER TABLE ri_batch_faculty ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

      CREATE INDEX IF NOT EXISTS idx_ri_batches_source_batch_id ON ri_batches(source_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_villages_ri_batch_id ON ri_villages(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_panels_ri_batch_id ON ri_panels(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_panels_ri_village_id ON ri_panels(ri_village_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_students_ri_batch_id ON ri_batch_students(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_students_student_id ON ri_batch_students(student_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_students_ri_panel_id ON ri_batch_students(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_faculty_batch ON ri_batch_faculty(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_faculty_panel ON ri_batch_faculty(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_batch_faculty_email ON ri_batch_faculty(email);

      -- ── RI Attendance Table (Panel-scoped & Activity-wise) ──
      CREATE TABLE IF NOT EXISTS ri_attendance (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity VARCHAR(100) NOT NULL DEFAULT 'SCHOOL_ACTIVITY',
        day VARCHAR(20),
        date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'Present',
        marked_by_email VARCHAR(255),
        marked_by_id INT REFERENCES users(id) ON DELETE SET NULL,
        is_locked BOOLEAN DEFAULT false,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure activity column exists for existing tables
      ALTER TABLE ri_attendance ADD COLUMN IF NOT EXISTS activity VARCHAR(100) DEFAULT 'SCHOOL_ACTIVITY';
      UPDATE ri_attendance SET activity = 'SCHOOL_ACTIVITY' WHERE activity IS NULL;
      DO $$ BEGIN
        ALTER TABLE ri_attendance ALTER COLUMN day DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
      DO $$ BEGIN
        ALTER TABLE ri_attendance DROP CONSTRAINT IF EXISTS ri_attendance_ri_batch_id_ri_panel_id_student_id_day_key;
        ALTER TABLE ri_attendance DROP CONSTRAINT IF EXISTS ri_attendance_student_id_day_ri_batch_id_key;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      -- Create unique index on (ri_batch_id, ri_panel_id, student_id, activity)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ri_attendance_unique ON ri_attendance(ri_batch_id, ri_panel_id, student_id, activity);
      CREATE INDEX IF NOT EXISTS idx_ri_attendance_lookup ON ri_attendance(ri_batch_id, ri_panel_id, activity);
      CREATE INDEX IF NOT EXISTS idx_ri_attendance_student ON ri_attendance(student_id);

      -- ── RI Attendance Locks Table (Enforces Panel & Activity-wise Faculty Lockout) ──
      CREATE TABLE IF NOT EXISTS ri_attendance_locks (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        activity VARCHAR(100) NOT NULL DEFAULT 'SCHOOL_ACTIVITY',
        day VARCHAR(50),
        is_locked BOOLEAN DEFAULT false,
        locked_at TIMESTAMP,
        locked_by_email VARCHAR(255),
        locked_by_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS activity VARCHAR(100) DEFAULT 'SCHOOL_ACTIVITY';
      UPDATE ri_attendance_locks SET activity = 'SCHOOL_ACTIVITY' WHERE activity IS NULL;
      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS unlocked_until TIMESTAMP;
      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP;
      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS unlocked_by_email VARCHAR(255);
      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS unlocked_by_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ri_attendance_locks ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(255);
      DO $$ BEGIN
        ALTER TABLE ri_attendance_locks ALTER COLUMN day DROP NOT NULL;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
      DO $$ BEGIN
        ALTER TABLE ri_attendance_locks DROP CONSTRAINT IF EXISTS ri_attendance_locks_ri_batch_id_ri_panel_id_day_key;
        ALTER TABLE ri_attendance_locks DROP CONSTRAINT IF EXISTS ri_attendance_locks_ri_batch_id_ri_panel_id_day_idx;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_ri_attendance_locks_unique ON ri_attendance_locks(ri_batch_id, ri_panel_id, activity);
      CREATE INDEX IF NOT EXISTS idx_ri_attendance_locks_lookup ON ri_attendance_locks(ri_batch_id, ri_panel_id, activity);

      -- ── RI Undertakings Table (Separate from LTC Undertaking) ──
      CREATE TABLE IF NOT EXISTS ri_undertakings (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT REFERENCES ri_batches(id) ON DELETE SET NULL,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        emergency_contact_name VARCHAR(255) NOT NULL,
        emergency_contact_relation VARCHAR(100) NOT NULL,
        emergency_contact_mobile VARCHAR(50) NOT NULL,
        emergency_contact_alt_mobile VARCHAR(50),
        emergency_contact_email VARCHAR(255),
        blood_group VARCHAR(10),
        medical_conditions TEXT,
        known_allergies TEXT,
        current_medication TEXT,
        dietary_restrictions TEXT,
        medical_other TEXT,
        consent_field_work BOOLEAN DEFAULT TRUE,
        consent_code_of_conduct BOOLEAN DEFAULT TRUE,
        consent_medical_emergency BOOLEAN DEFAULT TRUE,
        consent_photo_video BOOLEAN DEFAULT TRUE,
        signed_name VARCHAR(255) NOT NULL,
        signed_date VARCHAR(100) NOT NULL,
        ip_address VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Submitted',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ri_undertakings_student ON ri_undertakings(student_id);
      CREATE INDEX IF NOT EXISTS idx_ri_undertakings_batch_panel ON ri_undertakings(ri_batch_id, ri_panel_id);

      -- ── RI Faculty Undertakings Table ──
      CREATE TABLE IF NOT EXISTS ri_faculty_undertakings (
        id SERIAL PRIMARY KEY,
        faculty_id INT REFERENCES users(id) ON DELETE CASCADE,
        signed_name VARCHAR(255) NOT NULL,
        signed_date VARCHAR(100) NOT NULL,
        tshirt_size VARCHAR(50),
        photo_video_consent BOOLEAN DEFAULT TRUE,
        data_consent BOOLEAN DEFAULT TRUE,
        rules_consent BOOLEAN DEFAULT TRUE,
        dos_donts_consent BOOLEAN DEFAULT TRUE,
        honor_code_consent BOOLEAN DEFAULT TRUE,
        ip_address VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Submitted',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(faculty_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_faculty_undertakings_faculty ON ri_faculty_undertakings(faculty_id);
      ALTER TABLE ri_faculty_undertakings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE ri_faculty_undertakings ADD COLUMN IF NOT EXISTS honor_code_consent BOOLEAN DEFAULT TRUE;
      ALTER TABLE ri_faculty_undertakings ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Submitted';

      ALTER TABLE users ADD COLUMN IF NOT EXISTS ri_undertaking_submitted BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ri_undertaking_signed_name VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ri_undertaking_signed_date VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ri_tshirt_size VARCHAR(50);

      -- ── RI Master Student Forms Tracking Table ──
      CREATE TABLE IF NOT EXISTS ri_student_forms (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        ri_village_id INT REFERENCES ri_villages(id) ON DELETE SET NULL,
        form_type VARCHAR(60) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Not Started',
        progress_percent INT DEFAULT 0,
        submission_timestamp TIMESTAMP WITH TIME ZONE,
        last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        faculty_remarks TEXT,
        correction_notes TEXT,
        reviewed_by_faculty_id INT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(student_id, ri_batch_id, form_type)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_sf_student_batch ON ri_student_forms(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_sf_batch_panel ON ri_student_forms(ri_batch_id, ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_sf_type_status ON ri_student_forms(form_type, status);

      -- ── Form IB: Preparatory Phase Checklist ──
      CREATE TABLE IF NOT EXISTS ri_preparatory_checklists (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        parents_informed BOOLEAN DEFAULT FALSE,
        medical_checkup_done BOOLEAN DEFAULT FALSE,
        signed_undertaking BOOLEAN DEFAULT FALSE,
        clothing_ready BOOLEAN DEFAULT FALSE,
        beddings_ready BOOLEAN DEFAULT FALSE,
        toiletries_ready BOOLEAN DEFAULT FALSE,
        medicines_ready BOOLEAN DEFAULT FALSE,
        laptop_dongle_ready BOOLEAN DEFAULT FALSE,
        blank_notebook_ready BOOLEAN DEFAULT FALSE,
        college_id_card BOOLEAN DEFAULT FALSE,
        shoes_sportswear BOOLEAN DEFAULT FALSE,
        emergency_contacts_saved BOOLEAN DEFAULT FALSE,
        role_assigned VARCHAR(255),
        additional_notes TEXT,
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_prep_student ON ri_preparatory_checklists(student_id, ri_batch_id);
      ALTER TABLE ri_preparatory_checklists ADD COLUMN IF NOT EXISTS role_assigned VARCHAR(255);

      -- ── RI Student Things to Carry (Packing Readiness Checklist) ──
      CREATE TABLE IF NOT EXISTS ri_student_packing_checklists (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        packed_items JSONB NOT NULL DEFAULT '{}'::jsonb,
        packed_count INT DEFAULT 0,
        total_count INT DEFAULT 0,
        progress_percent INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_packing_student ON ri_student_packing_checklists(student_id);

      -- ── Form IV: Institutional Visit Observations ──
      CREATE TABLE IF NOT EXISTS ri_institutional_visits (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        institution_type VARCHAR(100) NOT NULL,
        institution_name VARCHAR(255) NOT NULL,
        visit_date DATE,
        official_contact_person VARCHAR(255),
        official_designation VARCHAR(100),
        key_observations TEXT,
        challenges_identified TEXT,
        services_provided TEXT,
        schemes_implemented TEXT,
        recommendations TEXT,
        infrastructure_condition VARCHAR(100) DEFAULT 'Good Condition',
        drinking_water_available BOOLEAN DEFAULT TRUE,
        toilet_available BOOLEAN DEFAULT TRUE,
        electricity_available BOOLEAN DEFAULT TRUE,
        additional_details JSONB DEFAULT '{}',
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_inst_student ON ri_institutional_visits(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_inst_panel ON ri_institutional_visits(ri_panel_id);

      -- ── Form V: Family Visit Observations Recording Form (Multi-Family) ──
      CREATE TABLE IF NOT EXISTS ri_family_surveys (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        family_serial_number INT NOT NULL,
        head_of_family_name VARCHAR(255) NOT NULL,
        total_family_members INT NOT NULL DEFAULT 1,
        male_members INT DEFAULT 0,
        female_members INT DEFAULT 0,
        house_type VARCHAR(255) DEFAULT 'Pakka',
        house_ownership VARCHAR(255) DEFAULT 'Owned',
        electricity_available BOOLEAN DEFAULT TRUE,
        mobile_phones_level VARCHAR(255) DEFAULT 'At least one mobile',
        television_available BOOLEAN DEFAULT FALSE,
        two_wheeler_available BOOLEAN DEFAULT FALSE,
        four_wheeler_available BOOLEAN DEFAULT FALSE,
        agricultural_land VARCHAR(255) DEFAULT 'No agricultural land',
        primary_crop VARCHAR(100) DEFAULT 'Other / None',
        animals_count_bracket VARCHAR(255) DEFAULT 'No animals',
        diet_dal_frequency VARCHAR(255) DEFAULT 'Daily',
        diet_green_veg_frequency VARCHAR(255) DEFAULT 'Frequently (twice a week or more)',
        diet_fruits_frequency VARCHAR(255) DEFAULT 'Once in a week',
        diet_nonveg_egg_frequency VARCHAR(255) DEFAULT 'Once in a week',
        primary_business_occupation VARCHAR(255),
        expenditure_education VARCHAR(255) DEFAULT 'No expenditure',
        expenditure_health_hospital VARCHAR(255) DEFAULT 'No expenditure',
        expenditure_functions VARCHAR(255) DEFAULT 'No expenditure',
        expenditure_food VARCHAR(255) DEFAULT 'Up to Rs. 9999',
        expenditure_vehicles_gadgets VARCHAR(255) DEFAULT 'No expenditure',
        expenditure_other VARCHAR(255) DEFAULT 'No expenditure',
        loan_taken BOOLEAN DEFAULT FALSE,
        loan_source VARCHAR(100) DEFAULT 'None',
        loan_reason VARCHAR(150) DEFAULT 'None',
        cooking_fuel VARCHAR(100) DEFAULT 'Cooking gas',
        gas_connection_source VARCHAR(100) DEFAULT 'Through Ujwala scheme',
        ujwala_subsidised VARCHAR(100) DEFAULT 'Get subsidised cylinder',
        soil_health_card_status VARCHAR(100) DEFAULT 'Not applicable as no farm',
        soil_health_card_usage VARCHAR(100) DEFAULT 'Not applicable as no card',
        jssk_pregnant_last_year BOOLEAN DEFAULT FALSE,
        jssk_delivery_place VARCHAR(150),
        health_insurance_scheme VARCHAR(150) DEFAULT 'Ayushman Bharat',
        family_specific_problems TEXT,
        respondent_name VARCHAR(255),
        contact_number VARCHAR(50),
        social_category VARCHAR(100),
        primary_occupation VARCHAR(255),
        monthly_income_range VARCHAR(100),
        landholding VARCHAR(100),
        drinking_water_source VARCHAR(150),
        toilet_facility VARCHAR(150),
        electricity_connection VARCHAR(100),
        health_access VARCHAR(150),
        health_insurance VARCHAR(150),
        schemes_availed TEXT,
        key_problems_identified TEXT,
        respondent_suggestions TEXT,
        survey_data JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id, family_serial_number)
      );
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS survey_data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS village_name VARCHAR(255);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS ri_village_id INT REFERENCES ri_villages(id) ON DELETE SET NULL;
      ALTER TABLE ri_family_surveys ALTER COLUMN house_type TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN house_ownership TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN mobile_phones_level TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN agricultural_land TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN animals_count_bracket TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN diet_dal_frequency TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN diet_green_veg_frequency TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN diet_fruits_frequency TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN diet_nonveg_egg_frequency TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_education TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_health_hospital TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_functions TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_food TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_vehicles_gadgets TYPE VARCHAR(255);
      ALTER TABLE ri_family_surveys ALTER COLUMN expenditure_other TYPE VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_ri_fam_student ON ri_family_surveys(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_fam_panel ON ri_family_surveys(ri_panel_id);

      -- ── Form VI: Problem Identification and Developing Solution ──
      CREATE TABLE IF NOT EXISTS ri_problem_identifications (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        team_leader_name VARCHAR(255),
        total_team_members INT DEFAULT 5,
        problem_title TEXT NOT NULL,
        problem_description TEXT NOT NULL,
        is_aligned_with_sdg BOOLEAN DEFAULT TRUE,
        sdg_goal_number INT DEFAULT 1,
        sdg_goal_title VARCHAR(255),
        is_related_to_degree BOOLEAN DEFAULT TRUE,
        degree_program_relevance TEXT,
        solution_title TEXT NOT NULL,
        solution_description TEXT NOT NULL,
        solution_is_practical_smart BOOLEAN DEFAULT TRUE,
        helping_faculty_name VARCHAR(255),
        helping_faculty_dept VARCHAR(255),
        sarpanch_informed_person VARCHAR(255),
        sarpanch_informed_date DATE,
        assignment_link TEXT,
        presentation_link TEXT,
        joint_assignment_summary TEXT,
        presentation_summary TEXT,
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_prob_student ON ri_problem_identifications(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_prob_panel ON ri_problem_identifications(ri_panel_id);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS school_name VARCHAR(255);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS department_name VARCHAR(255);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS degree_program VARCHAR(255);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS village_visited VARCHAR(255);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS students_participated INT;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS solution_offered VARCHAR(10);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS solution_is_practical_implementable VARCHAR(10);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS committee_chairperson VARCHAR(255);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_date DATE;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS committee_remarks VARCHAR(50);
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS sarpanch_informed_details TEXT;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS ri_cell_submission_details TEXT;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS assignment_link TEXT;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_link TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN problem_title DROP NOT NULL;
      ALTER TABLE ri_problem_identifications ALTER COLUMN problem_description DROP NOT NULL;
      ALTER TABLE ri_problem_identifications ALTER COLUMN solution_title DROP NOT NULL;
      ALTER TABLE ri_problem_identifications ALTER COLUMN solution_description DROP NOT NULL;

      -- ── Community Project / Activity Details ──
      CREATE TABLE IF NOT EXISTS ri_community_projects (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        project_title VARCHAR(255) NOT NULL,
        pillar_type VARCHAR(100) DEFAULT 'Agriculture and Nature',
        activity_date DATE,
        location_in_village VARCHAR(255),
        beneficiary_description TEXT,
        team_role_and_work_done TEXT,
        hours_spent NUMERIC(4, 1) DEFAULT 2.0,
        impact_and_outcome TEXT,
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_proj_student ON ri_community_projects(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_proj_panel ON ri_community_projects(ri_panel_id);

      -- ── Student RI Evaluation / Feedback ──
      CREATE TABLE IF NOT EXISTS ri_student_feedbacks (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        experience_rating INT DEFAULT 5,
        key_learnings TEXT,
        most_meaningful_activity TEXT,
        village_stay_feedback TEXT,
        ltc_daund_feedback TEXT,
        suggestions_for_future_batches TEXT,
        status VARCHAR(40) DEFAULT 'Draft',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_fb_student ON ri_student_feedbacks(student_id, ri_batch_id);

      -- ── FORM IIIB: Daily Activity Report - Students (ANNEX G-5) ──
      CREATE TABLE IF NOT EXISTS ri_daily_activity_reports (
        id SERIAL PRIMARY KEY,
        form_submission_id INT REFERENCES ri_student_forms(id) ON DELETE CASCADE,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        student_name VARCHAR(1000),
        school_name VARCHAR(1000),
        degree_program VARCHAR(1000),
        village_visited VARCHAR(1000),
        total_days_in_village VARCHAR(1000) DEFAULT '5 Days',
        seven_day_plan_completed VARCHAR(1000) DEFAULT 'Yes',
        seven_day_plan_improvements TEXT,
        community_project_types JSONB DEFAULT '[]'::jsonb,
        community_project_other_text TEXT,
        community_project_work_done TEXT,
        community_project_suggestions TEXT,
        study_group_included VARCHAR(1000) DEFAULT 'Yes',
        study_problem_title TEXT,
        study_solution_submitted VARCHAR(1000) DEFAULT 'Yes',
        study_presented_to_committee VARCHAR(1000) DEFAULT 'Yes',
        study_suggestions TEXT,
        institutions_visited_count INT DEFAULT 2,
        institutional_visits_suggestions TEXT,
        homes_visited_count INT DEFAULT 5,
        home_visits_suggestions TEXT,
        best_practices_observed TEXT,
        other_activities_implemented TEXT,
        issues_affecting_implementation TEXT,
        suggestions_to_improve_program TEXT,
        remarks TEXT,
        status VARCHAR(1000) DEFAULT 'Draft',
        school_activity_types JSONB DEFAULT '[]'::jsonb,
        school_activity_other_text TEXT,
        school_name_engaged TEXT,
        school_students_count INT,
        school_activity_details TEXT,
        school_activity_suggestions TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ri_dar_student ON ri_daily_activity_reports(student_id, ri_batch_id);

      ALTER TABLE ri_daily_activity_reports ALTER COLUMN student_name TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN school_name TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN degree_program TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN village_visited TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN total_days_in_village TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN seven_day_plan_completed TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_group_included TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_solution_submitted TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN study_presented_to_committee TYPE VARCHAR(1000);
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN status TYPE VARCHAR(1000);

      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_types JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_other_text TEXT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_name_engaged TEXT;
      ALTER TABLE ri_daily_activity_reports ALTER COLUMN school_name_engaged TYPE TEXT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_students_count INT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_details TEXT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS school_activity_suggestions TEXT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS activity_photo_1 TEXT;
      ALTER TABLE ri_daily_activity_reports ADD COLUMN IF NOT EXISTS activity_photo_2 TEXT;

      -- ── RI Faculty Evaluations Table (Strictly official marks & criteria) ──
      CREATE TABLE IF NOT EXISTS ri_evaluations (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        evaluator_faculty_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        evaluator_faculty_email VARCHAR(255) NOT NULL,
        attendance_marks NUMERIC(5, 2) DEFAULT 0.00,
        institutional_visit_rating VARCHAR(50) DEFAULT 'Good',
        institutional_visit_marks NUMERIC(5, 2) DEFAULT 0.00,
        family_survey_rating VARCHAR(50) DEFAULT 'Good',
        family_survey_marks NUMERIC(5, 2) DEFAULT 0.00,
        community_project_rating VARCHAR(50) DEFAULT 'Good',
        community_project_marks NUMERIC(5, 2) DEFAULT 0.00,
        problem_statement_marks NUMERIC(5, 2) DEFAULT 0.00,
        smart_solution_marks NUMERIC(5, 2) DEFAULT 0.00,
        sdg_alignment_score NUMERIC(5, 2) DEFAULT 0.00,
        degree_relevance_score NUMERIC(5, 2) DEFAULT 0.00,
        smart_solution_score NUMERIC(5, 2) DEFAULT 0.00,
        joint_assignment_score NUMERIC(5, 2) DEFAULT 0.00,
        presentation_score NUMERIC(5, 2) DEFAULT 0.00,
        understanding_score NUMERIC(5, 2) DEFAULT 0.00,
        problem_solution_marks NUMERIC(5, 2) DEFAULT 0.00,
        team_collaboration_rating VARCHAR(50) DEFAULT 'Good',
        team_collaboration_marks NUMERIC(5, 2) DEFAULT 0.00,
        total_marks NUMERIC(5, 2) DEFAULT 0.00,
        overall_grade VARCHAR(10) DEFAULT 'A',
        evaluation_status VARCHAR(50) DEFAULT 'Draft',
        faculty_remarks TEXT,
        correction_request_message TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, ri_batch_id)
      );
      ALTER TABLE ri_evaluations ADD COLUMN IF NOT EXISTS evaluation_status VARCHAR(50) DEFAULT 'Draft';
      ALTER TABLE ri_evaluations ADD COLUMN IF NOT EXISTS problem_statement_marks NUMERIC(5, 2) DEFAULT 0.00;
      ALTER TABLE ri_evaluations ADD COLUMN IF NOT EXISTS smart_solution_marks NUMERIC(5, 2) DEFAULT 0.00;
      CREATE INDEX IF NOT EXISTS idx_ri_eval_student ON ri_evaluations(student_id, ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_eval_panel ON ri_evaluations(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_eval_faculty ON ri_evaluations(evaluator_faculty_id);

      -- ── RI Evaluation Locks Table (Panel-level Administrative Lock/Unlock) ──
      CREATE TABLE IF NOT EXISTS ri_evaluation_locks (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        is_locked BOOLEAN NOT NULL DEFAULT false,
        locked_at TIMESTAMP,
        locked_by_email VARCHAR(255),
        locked_by_id INT REFERENCES users(id) ON DELETE SET NULL,
        unlocked_at TIMESTAMP,
        unlocked_by_email VARCHAR(255),
        unlocked_by_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_ri_evaluation_locks UNIQUE (ri_batch_id, ri_panel_id)
      );

      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
      UPDATE ri_evaluation_locks SET is_locked = false WHERE is_locked IS NULL;
      ALTER TABLE ri_evaluation_locks ALTER COLUMN is_locked SET DEFAULT false;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS locked_by_email VARCHAR(255);
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS locked_by_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMP;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS unlocked_by_email VARCHAR(255);
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS unlocked_by_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE ri_evaluation_locks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_ri_evaluation_locks'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'uq_ri_evaluation_locks'
        ) THEN
          ALTER TABLE ri_evaluation_locks ADD CONSTRAINT uq_ri_evaluation_locks UNIQUE (ri_batch_id, ri_panel_id);
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_ri_eval_locks_panel ON ri_evaluation_locks(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_eval_locks_batch ON ri_evaluation_locks(ri_batch_id);

      -- ── RI Audit Logs ──
      CREATE TABLE IF NOT EXISTS ri_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        user_name VARCHAR(255),
        user_role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        student_id INT REFERENCES users(id) ON DELETE SET NULL,
        ri_batch_id INT REFERENCES ri_batches(id) ON DELETE SET NULL,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        record_id VARCHAR(100),
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_audit_user ON ri_audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_ri_audit_action ON ri_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_ri_audit_student ON ri_audit_logs(student_id);
      CREATE INDEX IF NOT EXISTS idx_ri_audit_created ON ri_audit_logs(created_at DESC);

      -- ── RI Support Tickets ──
      CREATE TABLE IF NOT EXISTS ri_tickets (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_role VARCHAR(50) NOT NULL DEFAULT 'student',
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        user_prn VARCHAR(100),
        user_phone VARCHAR(50),
        ri_batch_id INT REFERENCES ri_batches(id) ON DELETE SET NULL,
        ri_panel_id INT REFERENCES ri_panels(id) ON DELETE SET NULL,
        batch_name VARCHAR(255),
        panel_name VARCHAR(255),
        category VARCHAR(100) DEFAULT 'Problem',
        priority VARCHAR(50) DEFAULT 'Medium',
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        screenshot TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        admin_reply TEXT,
        resolution TEXT,
        resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
        resolved_by_name VARCHAR(255),
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_tickets_user ON ri_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_ri_tickets_status ON ri_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_ri_tickets_role ON ri_tickets(user_role);
      CREATE INDEX IF NOT EXISTS idx_ri_tickets_batch ON ri_tickets(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_tickets_created ON ri_tickets(created_at DESC);

      -- ── RI Notifications (for RI Admin & System) ──
      CREATE TABLE IF NOT EXISTS ri_notifications (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'ticket',
        target_role VARCHAR(50) DEFAULT 'admin',
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_notif_target ON ri_notifications(target_role, is_read, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ri_notif_user ON ri_notifications(user_id, is_read);

      -- ── RI Red Flags ──
      CREATE TABLE IF NOT EXISTS ri_red_flags (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_name VARCHAR(255),
        student_email VARCHAR(255),
        student_prn VARCHAR(100),
        department VARCHAR(255),
        school VARCHAR(255),
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        batch_name VARCHAR(255),
        panel_name VARCHAR(255),
        village_name VARCHAR(255),
        faculty_id INT REFERENCES users(id) ON DELETE SET NULL,
        faculty_name VARCHAR(255),
        faculty_email VARCHAR(255),
        reason VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        admin_notes TEXT,
        reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by_name VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_student ON ri_red_flags(student_id);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_faculty ON ri_red_flags(faculty_id);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_batch ON ri_red_flags(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_panel ON ri_red_flags(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_reason ON ri_red_flags(reason);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_status ON ri_red_flags(status);
      CREATE INDEX IF NOT EXISTS idx_ri_red_flags_created ON ri_red_flags(created_at DESC);

      -- ── RI Panel Media & Uploads (Max 5 photos + Gram Panchayat Certificate) ──
      CREATE TABLE IF NOT EXISTS ri_panel_media (
        id SERIAL PRIMARY KEY,
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        uploaded_by_id INT REFERENCES users(id) ON DELETE SET NULL,
        uploaded_by_name VARCHAR(255),
        file_url VARCHAR(500) NOT NULL,
        file_name VARCHAR(255),
        mime_type VARCHAR(100),
        file_size INT,
        caption VARCHAR(500),
        category VARCHAR(50) DEFAULT 'photo',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_panel_media_panel ON ri_panel_media(ri_batch_id, ri_panel_id);
      ALTER TABLE ri_panel_media ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'photo';

      -- ── RI Orange Flags (Non-critical incidents requiring follow-up/monitoring) ──
      CREATE TABLE IF NOT EXISTS ri_orange_flags (
        id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_name VARCHAR(255),
        student_email VARCHAR(255),
        student_prn VARCHAR(100),
        department VARCHAR(255),
        school VARCHAR(255),
        ri_batch_id INT NOT NULL REFERENCES ri_batches(id) ON DELETE CASCADE,
        ri_panel_id INT NOT NULL REFERENCES ri_panels(id) ON DELETE CASCADE,
        batch_name VARCHAR(255),
        panel_name VARCHAR(255),
        village_name VARCHAR(255),
        faculty_id INT REFERENCES users(id) ON DELETE SET NULL,
        faculty_name VARCHAR(255),
        faculty_email VARCHAR(255),
        category VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        incident_date_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        action_taken TEXT,
        follow_up_required BOOLEAN DEFAULT true,
        additional_info TEXT,
        medical_report_url TEXT,
        medical_report_name VARCHAR(255),
        medical_report_size INT,
        status VARCHAR(50) DEFAULT 'open',
        resolution_notes TEXT,
        resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
        resolved_by_name VARCHAR(255),
        resolved_at TIMESTAMP WITH TIME ZONE,
        last_updated_by INT REFERENCES users(id) ON DELETE SET NULL,
        last_updated_by_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE ri_orange_flags ADD COLUMN IF NOT EXISTS medical_report_url TEXT;
      ALTER TABLE ri_orange_flags ADD COLUMN IF NOT EXISTS medical_report_name VARCHAR(255);
      ALTER TABLE ri_orange_flags ADD COLUMN IF NOT EXISTS medical_report_size INT;
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_student ON ri_orange_flags(student_id);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_faculty ON ri_orange_flags(faculty_id);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_batch ON ri_orange_flags(ri_batch_id);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_panel ON ri_orange_flags(ri_panel_id);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_category ON ri_orange_flags(category);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_status ON ri_orange_flags(status);
      CREATE INDEX IF NOT EXISTS idx_ri_orange_flags_created ON ri_orange_flags(created_at DESC);

      CREATE TABLE IF NOT EXISTS ri_orange_flag_history (
        id SERIAL PRIMARY KEY,
        flag_id INT NOT NULL REFERENCES ri_orange_flags(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        user_role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ri_orange_history_flag ON ri_orange_flag_history(flag_id, created_at ASC);

      ALTER TABLE ri_attendance ADD COLUMN IF NOT EXISTS marked_by_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS best_practices_observed TEXT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS other_activities_implemented TEXT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS issues_affecting_implementation TEXT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS suggestions_to_improve_program TEXT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_institutional_visits INT DEFAULT 5;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_household_surveys INT DEFAULT 5;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_community_project INT DEFAULT 5;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS rating_debrief_school_activity INT DEFAULT 5;
      -- Form IV migrations
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS recommendations TEXT;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS observation_data JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS activity_photo_1 TEXT;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS activity_photo_2 TEXT;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_computer_internet BOOLEAN;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_separate_toilets BOOLEAN;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_drinking_water BOOLEAN;
      ALTER TABLE ri_institutional_visits ADD COLUMN IF NOT EXISTS has_electricity BOOLEAN;

      -- Form V migrations
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS respondent_name VARCHAR(255);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS social_category VARCHAR(100);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS primary_occupation VARCHAR(255);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS monthly_income_range VARCHAR(100);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS landholding VARCHAR(100);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS drinking_water_source VARCHAR(150);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS toilet_facility VARCHAR(150);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS electricity_connection VARCHAR(100);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS health_access VARCHAR(150);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS health_insurance VARCHAR(150);
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS schemes_availed TEXT;
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS key_problems_identified TEXT;
      ALTER TABLE ri_family_surveys ADD COLUMN IF NOT EXISTS respondent_suggestions TEXT;

      -- Form VI migrations
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS presentation_link TEXT;
      ALTER TABLE ri_problem_identifications ADD COLUMN IF NOT EXISTS assignment_link TEXT;

      -- Form VII migrations
      ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS quantifiable_output TEXT;
      ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS community_feedback TEXT;
      ALTER TABLE ri_community_projects ADD COLUMN IF NOT EXISTS photos_link TEXT;

      -- Form VIII migrations
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS mentorship_rating INT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS village_reception_rating INT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS logistics_rating INT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS paradigm_shift TEXT;
      ALTER TABLE ri_student_feedbacks ADD COLUMN IF NOT EXISTS willing_for_followup BOOLEAN;

      -- Alter string columns to TEXT to permanently avoid 'value too long for type character varying' errors
      ALTER TABLE ri_institutional_visits ALTER COLUMN institution_name TYPE TEXT;
      ALTER TABLE ri_institutional_visits ALTER COLUMN institution_type TYPE TEXT;
      ALTER TABLE ri_institutional_visits ALTER COLUMN official_contact_person TYPE TEXT;
      ALTER TABLE ri_institutional_visits ALTER COLUMN official_designation TYPE TEXT;
      ALTER TABLE ri_institutional_visits ALTER COLUMN infrastructure_condition TYPE TEXT;

      ALTER TABLE ri_problem_identifications ALTER COLUMN committee_remarks TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN solution_offered TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN solution_is_practical_implementable TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN committee_chairperson TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN sdg_goal_title TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN school_name TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN department_name TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN degree_program TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN village_visited TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN team_leader_name TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN helping_faculty_name TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN helping_faculty_dept TYPE TEXT;
      ALTER TABLE ri_problem_identifications ALTER COLUMN sarpanch_informed_person TYPE TEXT;

      ALTER TABLE ri_community_projects ALTER COLUMN project_title TYPE TEXT;
      ALTER TABLE ri_community_projects ALTER COLUMN pillar_type TYPE TEXT;
      ALTER TABLE ri_community_projects ALTER COLUMN location_in_village TYPE TEXT;

      ALTER TABLE ri_preparatory_checklists ALTER COLUMN role_assigned TYPE TEXT;
      ALTER TABLE ri_preparatory_checklists ALTER COLUMN additional_notes TYPE TEXT;
    `);

    // Life Awakening Parent-Child and Class Hierarchy support
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parent_students (
        parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relationship VARCHAR(100),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (parent_id, student_id)
      );
      CREATE INDEX IF NOT EXISTS idx_parent_students_parent_id ON parent_students(parent_id);
      CREATE INDEX IF NOT EXISTS idx_parent_students_student_id ON parent_students(student_id);
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS class_grade VARCHAR(50);

      -- Normalize multi-parent records so exactly one is primary (Parent 1) and others secondary (Parent 2)
      WITH ranked_parents AS (
        SELECT parent_id, student_id,
               ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY is_primary DESC, created_at ASC, parent_id ASC) as rn
        FROM parent_students
      )
      UPDATE parent_students ps
      SET is_primary = (rp.rn = 1)
      FROM ranked_parents rp
      WHERE ps.parent_id = rp.parent_id AND ps.student_id = rp.student_id;
    `);
  } catch (err) {
    console.error('Database Initialization Error:', err);
  }
};

module.exports = {
  initDB,
  seedImmersionSchedulesForBatch,
  seedImmersionSchedules,
};
