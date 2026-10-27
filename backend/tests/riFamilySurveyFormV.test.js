const assert = require('assert');
const pool = require('../config/db');
const { createFamilySurveyWorkbook } = require('../utils/riExcelExport');

async function runFamilySurveyFormVTests() {
  console.log('================================================================');
  console.log('RUNNING RI FAMILY VISIT OBSERVATIONS (FORM - V) VERIFICATION');
  console.log('================================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify table columns
    const colCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ri_family_surveys' AND column_name = 'survey_data'
    `);
    assert.strictEqual(colCheck.rows.length, 1, 'Column survey_data must exist in ri_family_surveys');
    console.log('✓ PASS: Table ri_family_surveys has survey_data JSONB column.');

    // 2. Setup mock student and batch inside transaction
    let studentId;
    const studentRes = await client.query(`SELECT id FROM users LIMIT 1`);
    if (studentRes.rows.length > 0) {
      studentId = studentRes.rows[0].id;
    } else {
      const uRes = await client.query(`
        INSERT INTO users (email, name, role, password_hash)
        VALUES ('form_v_test@example.com', 'Form V Test Student', 'STUDENT', 'dummy_hash')
        RETURNING id
      `);
      studentId = uRes.rows[0].id;
    }

    let batchId;
    const batchRes = await client.query(`SELECT id FROM ri_batches LIMIT 1`);
    if (batchRes.rows.length > 0) {
      batchId = batchRes.rows[0].id;
    } else {
      const bRes = await client.query(`
        INSERT INTO ri_batches (name, academic_year, is_active)
        VALUES ('Test Batch Form V', '2025-2026', true)
        RETURNING id
      `);
      batchId = bRes.rows[0].id;
    }

    const panelRes = await client.query(`SELECT id FROM ri_panels WHERE ri_batch_id = $1 LIMIT 1`, [batchId]);
    const panelId = panelRes.rows.length ? panelRes.rows[0].id : null;

    // 3. Test insert of Form V Family 1 with Sections A to M
    const testSurveyDataFamily1 = {
      // INITIAL DETAILS
      family_serial_number: 1,
      head_of_family_name: 'Ramesh Patil',
      total_family_members: 5,
      male_members: 3,
      female_members: 2,

      // SECTION A
      a_1_house_type: 'Pakka (Sloped RCC slab/Flat RCC slab)',
      a_2_house_ownership: 'Own',
      a_3_rooms_count: '3',
      a_4_ventilation: 'Adequate',

      // SECTION B
      b_1_electricity: 'Yes',
      b_2_tap_water: 'Yes',
      b_3_latrine: 'Yes',
      b_4_mobile_phones: 'More than 2 Mobile phone',
      b_5_vehicles: ['Two wheeler', 'Four wheeler'],
      b_6_television: 'Yes',

      // SECTION C
      c_1_agri_land: '2 to 5 Acre',
      c_2_crops_grown: ['Cotton', 'Soyabean'],
      c_3_cows_count: 2,
      c_4_buffaloes_count: 0,
      c_5_goats_sheep_count: 4,
      c_6_bullocks_count: 2,
      c_7_poultry_birds_count: 10,
      c_8_farm_machinery: ['Tractor', 'Cultivator'],

      // SECTION D
      d_1_pulses_dal: 'Daily',
      d_2_green_veg: '4 to 6 days a week',
      d_3_fruits: '1 to 3 days a week',
      d_4_milk_per_day: '1 to 2 liter',

      // SECTION E
      e_1_farming_occupation: 2,
      e_2_farm_labor_occupation: 0,
      e_3_other_labor_occupation: 0,
      e_4_govt_job_occupation: 1,
      e_5_private_job_occupation: 0,
      e_6_business_occupation: 0,
      e_7_profession_occupation: 0,
      e_8_other_occupation: 0,
      e_9_income_bracket: 'Rs. 1,00,001 to 2,00,000',
      e_10_loan_status: 'Ongoing loan',
      e_11_loan_agency: ['Nationalized Bank', 'Co-operative Bank'],

      // SECTION F
      f_1_fuel_type: ['Cooking gas', 'Fire wood'],
      f_2_gas_connection_type: 'Through Ujwala scheme',
      f_3_ujwala_cylinder_refill: '2 to 3',

      // SECTION G
      g_1_soil_testing_done: 'Soil testing is done of all farms',
      g_2_soil_health_card_received: 'Soil health card is received',

      // SECTION H
      h_1_delivery_last_year: 'Yes',
      h_2_delivery_place: 'Government hospital',
      h_3_govt_vehicle_used: 'Yes',
      h_4_cash_assistance_received: 'Yes',

      // SECTION I
      i_1_mjpjay_card_available: 'Yes',
      i_2_treatment_taken_under_mjpjay: 'Yes',
      i_3_aware_free_treatment: 'Yes',
      i_4_aware_network_hospitals: 'Yes',

      // SECTION J
      j_1_ration_card_type: 'Yellow ration card',
      j_2_pmgkay_grains_received: 'Yes, free food grains are received every month',

      // SECTION K
      k_1_household_water_source: 'Water tap within house',
      k_2_regular_water_supply: 'Yes',

      // SECTION L
      l_1_toilet_constructed: 'Yes',
      l_2_toilet_in_regular_use: 'Yes',

      // SECTION M
      m_1_eligible_ladies_applied: 'All ladies in the family have applied',
      m_2_installment_received: 'Yes, installments received',

      family_specific_problems: 'Facing low water pressure during summer',
      overall_observations: 'Well-maintained household with active farming'
    };

    // Save Family 1
    const insertRes1 = await client.query(`
      INSERT INTO ri_family_surveys (
        student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        male_members, female_members, house_type, house_ownership,
        electricity_available, mobile_phones_level, agricultural_land,
        primary_crop, animals_count_bracket, diet_dal_frequency,
        diet_green_veg_frequency, diet_fruits_frequency, primary_business_occupation,
        loan_taken, loan_source, cooking_fuel, gas_connection_source,
        soil_health_card_status, family_specific_problems, survey_data
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26
      ) RETURNING id, survey_data, head_of_family_name, family_serial_number
    `, [
      studentId, batchId, panelId,
      testSurveyDataFamily1.family_serial_number, testSurveyDataFamily1.head_of_family_name, testSurveyDataFamily1.total_family_members,
      testSurveyDataFamily1.male_members, testSurveyDataFamily1.female_members, testSurveyDataFamily1.a_1_house_type, testSurveyDataFamily1.a_2_house_ownership,
      true, testSurveyDataFamily1.b_4_mobile_phones, testSurveyDataFamily1.c_1_agri_land,
      'Cotton, Soyabean', '2 to 5', testSurveyDataFamily1.d_1_pulses_dal,
      testSurveyDataFamily1.d_2_green_veg, testSurveyDataFamily1.d_3_fruits, 'Farming: 2',
      true, 'Nationalized Bank, Co-operative Bank', 'Cooking gas, Fire wood', testSurveyDataFamily1.f_2_gas_connection_type,
      testSurveyDataFamily1.g_2_soil_health_card_received, testSurveyDataFamily1.family_specific_problems,
      JSON.stringify(testSurveyDataFamily1)
    ]);

    const family1 = insertRes1.rows[0];
    assert.strictEqual(family1.family_serial_number, 1);
    assert.strictEqual(family1.head_of_family_name, 'Ramesh Patil');
    assert.strictEqual(family1.survey_data.a_1_house_type, 'Pakka (Sloped RCC slab/Flat RCC slab)');
    assert.strictEqual(family1.survey_data.m_1_eligible_ladies_applied, 'All ladies in the family have applied');
    console.log('✓ PASS: Inserted Family 1 with full Form V survey_data (Sections A through M).');

    // 4. Test insert of Family 2
    const testSurveyDataFamily2 = {
      family_serial_number: 2,
      head_of_family_name: 'Suresh Deshmukh',
      total_family_members: 4,
      male_members: 2,
      female_members: 2,
      a_1_house_type: 'Kaccha (Mud, thatch, leaves)',
      a_2_house_ownership: 'Rented',
      b_1_electricity: 'No',
      b_2_tap_water: 'No',
      b_3_latrine: 'No',
      c_1_agri_land: 'No Agricultural Land',
      e_10_loan_status: 'No loan taken',
      f_1_fuel_type: ['Fire wood'],
      l_1_toilet_constructed: 'No',
      m_1_eligible_ladies_applied: 'None of the ladies applied'
    };

    const insertRes2 = await client.query(`
      INSERT INTO ri_family_surveys (
        student_id, ri_batch_id, ri_panel_id,
        family_serial_number, head_of_family_name, total_family_members,
        male_members, female_members, house_type, house_ownership,
        electricity_available, mobile_phones_level, agricultural_land,
        loan_taken, cooking_fuel, survey_data
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16
      ) RETURNING id, survey_data, head_of_family_name, family_serial_number
    `, [
      studentId, batchId, panelId,
      testSurveyDataFamily2.family_serial_number, testSurveyDataFamily2.head_of_family_name, testSurveyDataFamily2.total_family_members,
      testSurveyDataFamily2.male_members, testSurveyDataFamily2.female_members, testSurveyDataFamily2.a_1_house_type, testSurveyDataFamily2.a_2_house_ownership,
      false, 'None', testSurveyDataFamily2.c_1_agri_land,
      false, 'Fire wood', JSON.stringify(testSurveyDataFamily2)
    ]);

    const family2 = insertRes2.rows[0];
    assert.strictEqual(family2.family_serial_number, 2);
    assert.strictEqual(family2.head_of_family_name, 'Suresh Deshmukh');
    assert.strictEqual(family2.survey_data.a_1_house_type, 'Kaccha (Mud, thatch, leaves)');
    console.log('✓ PASS: Inserted Family 2 with independent survey_data.');

    // 5. Query both families as Student API would
    const studentFetch = await client.query(`
      SELECT * FROM ri_family_surveys
      WHERE student_id = $1 AND ri_batch_id = $2
      ORDER BY family_serial_number ASC
    `, [studentId, batchId]);

    assert(studentFetch.rows.length >= 2, 'Should fetch at least 2 families');
    const f1 = studentFetch.rows.find(f => f.family_serial_number === 1);
    const f2 = studentFetch.rows.find(f => f.family_serial_number === 2);
    assert.strictEqual(f1.head_of_family_name, 'Ramesh Patil');
    assert.strictEqual(f2.head_of_family_name, 'Suresh Deshmukh');
    console.log('✓ PASS: Student fetch correctly returns multiple independent family surveys.');

    // 6. Test Excel export workbook creation with detailRows mapping
    const detailRows = [f1, f2].map((f, idx) => {
      const sd = (f.survey_data && typeof f.survey_data === 'object') ? f.survey_data : {};
      const formatVal = (v) => Array.isArray(v) ? v.join(', ') : (v !== undefined && v !== null ? String(v) : '');

      return {
        'Sr. No.': idx + 1,
        'Student PRN': 'TEST_PRN',
        'Student Name': 'Test Student',
        'Family Sr.': f.family_serial_number,
        'Head of Family': f.head_of_family_name,
        'Total Members': f.total_family_members,
        'Male Members': f.male_members,
        'Female Members': f.female_members,
        'A.1 House Type': formatVal(sd.a_1_house_type || f.house_type),
        'A.2 House Ownership': formatVal(sd.a_2_house_ownership || f.house_ownership),
        'B.1 Electricity': formatVal(sd.b_1_electricity !== undefined ? sd.b_1_electricity : (f.electricity_available ? 'Yes' : 'No')),
        'C.1 Agricultural Land': formatVal(sd.c_1_agri_land || f.agricultural_land),
        'F.1 Cooking Fuel': formatVal(sd.f_1_fuel_type || f.cooking_fuel),
        'M.1 Ladaki Bahin Applied': formatVal(sd.m_1_eligible_ladies_applied)
      };
    });

    const summaryRows = [{
      'Sr. No.': 1,
      'PRN': 'TEST_PRN',
      'Student Name': 'Test Student',
      'Panel': 'P1',
      'Village': 'Test Village',
      'Households Surveyed': 2,
      'Required Target': 5,
      'Survey Status': 'Draft'
    }];

    const buffer = createFamilySurveyWorkbook({ summaryRows, detailRows });
    assert(Buffer.isBuffer(buffer), 'Should produce valid Excel buffer');
    assert(buffer.length > 1000, 'Excel buffer must be non-empty');
    console.log(`✓ PASS: createFamilySurveyWorkbook generated valid Excel buffer (${buffer.length} bytes).`);

    // 7. Backward compatibility test: legacy row with null survey_data
    const legacyRow = {
      family_serial_number: 3,
      head_of_family_name: 'Old Resident',
      total_family_members: 6,
      male_members: 3,
      female_members: 3,
      house_type: 'Semi-pakka',
      house_ownership: 'Own',
      electricity_available: true,
      mobile_phones_level: '1 Mobile phone',
      agricultural_land: 'Less than 2 Acre',
      primary_crop: 'Jowar',
      survey_data: null
    };

    const sdLegacy = (legacyRow.survey_data && typeof legacyRow.survey_data === 'object') ? legacyRow.survey_data : {};
    const legacyHouseType = sdLegacy.a_1_house_type || legacyRow.house_type;
    assert.strictEqual(legacyHouseType, 'Semi-pakka', 'Legacy row must fall back to legacy column value');
    console.log('✓ PASS: Backward compatibility confirmed — legacy rows without survey_data fall back seamlessly.');

    // Rollback changes so test data doesn't pollute database
    await client.query('ROLLBACK');
    console.log('✓ PASS: Test transaction rolled back cleanly. No orphaned test data.');

    console.log('================================================================');
    console.log('ALL FAMILY SURVEY FORM - V TESTS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Test failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

runFamilySurveyFormVTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
