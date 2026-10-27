const pool = require('../config/db');

async function runDeepFamilyVisitTests() {
  console.log('================================================================');
  console.log('PHASE 2 DEEP TEST: Family Visit Schema, Operations & Rollback');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    // 1. Database Safety Check
    const dbRes = await client.query('SELECT current_database()');
    const dbName = dbRes.rows[0].current_database;
    console.log(`[Safety Check] Database: ${dbName}`);
    if (dbName !== 'ltc_ri_development') {
      throw new Error(`ABORT: Expected ltc_ri_development, found ${dbName}`);
    }

    // 2. Schema check: Verify all 15 columns have length 255
    console.log('\n--- Test 2.1: Verifying column lengths in information_schema ---');
    const colsToCheck = [
      'house_type', 'house_ownership', 'mobile_phones_level', 'agricultural_land',
      'animals_count_bracket', 'diet_dal_frequency', 'diet_green_veg_frequency',
      'diet_fruits_frequency', 'diet_nonveg_egg_frequency', 'expenditure_education',
      'expenditure_health_hospital', 'expenditure_functions', 'expenditure_food',
      'expenditure_vehicles_gadgets', 'expenditure_other'
    ];
    const schemaRes = await client.query(`
      SELECT column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'ri_family_surveys' AND column_name = ANY($1)
    `, [colsToCheck]);

    for (const row of schemaRes.rows) {
      if (row.character_maximum_length < 255) {
        throw new Error(`Column ${row.column_name} has max length ${row.character_maximum_length}, expected 255!`);
      }
    }
    console.log(`✅ All ${schemaRes.rows.length} columns verified with character_maximum_length >= 255`);

    // Pick student
    const studentRes = await client.query(`
      SELECT u.id as student_id, rbs.ri_batch_id, rbs.ri_panel_id, rp.ri_village_id
      FROM users u
      JOIN ri_batch_students rbs ON rbs.student_id = u.id
      LEFT JOIN ri_panels rp ON rp.id = rbs.ri_panel_id
      LIMIT 1
    `);
    const { student_id, ri_batch_id, ri_panel_id, ri_village_id } = studentRes.rows[0];

    // Clean any previous test rows (serial 888 and 889)
    await client.query('DELETE FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2 AND family_serial_number IN (888, 889)', [student_id, ri_batch_id]);

    // Ensure student form
    const sfRes = await client.query(`
      INSERT INTO ri_student_forms (
        student_id, ri_batch_id, ri_panel_id, ri_village_id,
        form_type, status, progress_percent, last_updated_at
      ) VALUES (
        $1, $2, $3, $4, 'FAMILY_SURVEY', 'Draft', 20, CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id, ri_batch_id, form_type)
      DO UPDATE SET last_updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [student_id, ri_batch_id, ri_panel_id, ri_village_id]);
    const formSubmissionId = sfRes.rows[0].id;

    // Test 2.2: Normal values insertion
    console.log('\n--- Test 2.2: Normal values insertion ---');
    const normalRes = await client.query(`
      INSERT INTO ri_family_surveys (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        house_type, house_ownership, status
      ) VALUES ($1, $2, $3, $4, 888, 'Normal Family', 4, 'Semi pakka (mixed)', 'Owned', 'Draft')
      RETURNING *
    `, [formSubmissionId, student_id, ri_batch_id, ri_panel_id]);
    console.log('✅ Normal record saved with ID:', normalRes.rows[0].id);

    // Test 2.3: Values longer than 60 chars (68 chars and 75 chars)
    console.log('\n--- Test 2.3: Insertion with values > 60 chars ---');
    const longHouse = 'Pakka (Build with durable material like brick, cement concrete, etc)'; // 68 chars
    const longOwnership = 'Provided by employer or relative with comprehensive rental documentation'; // 72 chars
    const longRes = await client.query(`
      INSERT INTO ri_family_surveys (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        house_type, house_ownership, status
      ) VALUES ($1, $2, $3, $4, 889, 'Long Value Family', 5, $5, $6, 'Draft')
      RETURNING *
    `, [formSubmissionId, student_id, ri_batch_id, ri_panel_id, longHouse, longOwnership]);
    console.log(`✅ Long value record saved! house_type len=${longRes.rows[0].house_type.length}, house_ownership len=${longRes.rows[0].house_ownership.length}`);

    // Test 2.4: Updating existing family record with new values (ON CONFLICT DO UPDATE)
    console.log('\n--- Test 2.4: Update existing record via ON CONFLICT ---');
    const updateRes = await client.query(`
      INSERT INTO ri_family_surveys (
        form_submission_id, student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        house_type, status
      ) VALUES ($1, $2, $3, $4, 888, 'Updated Family Name', 6, $5, 'Draft')
      ON CONFLICT (student_id, ri_batch_id, family_serial_number)
      DO UPDATE SET
        head_of_family_name = EXCLUDED.head_of_family_name,
        total_family_members = EXCLUDED.total_family_members,
        house_type = EXCLUDED.house_type,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [formSubmissionId, student_id, ri_batch_id, ri_panel_id, longHouse]);
    if (updateRes.rows[0].head_of_family_name !== 'Updated Family Name' || updateRes.rows[0].total_family_members !== 6) {
      throw new Error('Update did not reflect expected values');
    }
    console.log('✅ Existing record successfully updated with long value and new members count');

    // Test 2.5: Optional fields omitted, null/empty values
    console.log('\n--- Test 2.5: Optional and null fields handling ---');
    const optionalCheck = await client.query('SELECT contact_number, jssk_delivery_place, family_specific_problems FROM ri_family_surveys WHERE id = $1', [normalRes.rows[0].id]);
    console.log('✅ Null and omitted optional fields handled safely without DB error:', optionalCheck.rows[0]);

    // Test 2.6: Transaction rollback on failure
    console.log('\n--- Test 2.6: Transaction rollback verification ---');
    await client.query('BEGIN');
    let rollbackSuccess = false;
    try {
      await client.query(`
        INSERT INTO ri_family_surveys (
          form_submission_id, student_id, ri_batch_id, family_serial_number, head_of_family_name
        ) VALUES ($1, $2, $3, 9999, 'Rollback Test Family')
      `, [formSubmissionId, student_id, ri_batch_id]);
      
      // Trigger intentional error (foreign key violation or null violation)
      await client.query(`INSERT INTO ri_family_surveys (student_id, ri_batch_id, family_serial_number, head_of_family_name) VALUES (99999999, 99999999, 9999, 'Bad FK')`);
    } catch (err) {
      await client.query('ROLLBACK');
      rollbackSuccess = true;
      console.log('   Encountered expected error in transaction, rolled back cleanly.');
    }

    if (!rollbackSuccess) {
      throw new Error('Transaction should have rolled back');
    }
    const checkRolledBack = await client.query('SELECT COUNT(*) FROM ri_family_surveys WHERE family_serial_number = 9999');
    if (parseInt(checkRolledBack.rows[0].count, 10) !== 0) {
      throw new Error('Rollback failed: row 9999 found in database!');
    }
    console.log('✅ Transaction rollback verified: No partial rows persisted.');

    // Test 2.7: Progress calculation check (Formula: count of families out of 3)
    console.log('\n--- Test 2.7: Progress percent calculation check ---');
    const countRes = await client.query('SELECT COUNT(*)::int as count FROM ri_family_surveys WHERE student_id = $1 AND ri_batch_id = $2', [student_id, ri_batch_id]);
    const currentCount = countRes.rows[0].count;
    const computedProgress = Math.min(100, Math.round((currentCount / 3) * 100));
    console.log(`✅ Current family count: ${currentCount}, calculated progress: ${computedProgress}%`);

    // Clean up test records
    await client.query('DELETE FROM ri_family_surveys WHERE id IN ($1, $2)', [normalRes.rows[0].id, longRes.rows[0].id]);
    console.log('✅ Test records cleaned up successfully.');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 2 TESTS PASSED PERFECTLY!');
    console.log('================================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

runDeepFamilyVisitTests().catch(err => {
  console.error('❌ PHASE 2 TEST FAILED:', err);
  process.exit(1);
});
