const assert = require('assert');
const { calculateRiEvaluation, RATING_MARKS } = require('../utils/riEvaluationCalculator');

console.log('====================================================');
console.log('TESTING NEW 100-MARK RI RUBRIC SCORING SYSTEM');
console.log('====================================================\n');

// 1. Attendance Tests
console.log('--- 1. Attendance Auto-Calculation Tests ---');
const att4 = calculateRiEvaluation({ activities_present_count: 4 });
assert.strictEqual(att4.attendance_marks, 15.00, '4/4 attendance must equal 15.00 marks');

const att3 = calculateRiEvaluation({ activities_present_count: 3 });
assert.strictEqual(att3.attendance_marks, 11.25, '3/4 attendance must equal 11.25 marks');

const att2 = calculateRiEvaluation({ activities_present_count: 2 });
assert.strictEqual(att2.attendance_marks, 7.50, '2/4 attendance must equal 7.50 marks');

const att1 = calculateRiEvaluation({ activities_present_count: 1 });
assert.strictEqual(att1.attendance_marks, 3.75, '1/4 attendance must equal 3.75 marks');

const att0 = calculateRiEvaluation({ activities_present_count: 0 });
assert.strictEqual(att0.attendance_marks, 0.00, '0/4 attendance must equal 0.00 marks');

// Activity status names test
const attFromStatus = calculateRiEvaluation({
  school_activity_status: 'Present',
  institutional_visit_status: 'Present',
  family_survey_status: 'Present',
  community_project_status: 'Absent'
});
assert.strictEqual(attFromStatus.attendance_marks, 11.25, '3 present statuses must equal 11.25 marks');
console.log('✅ Attendance auto-calculations verified (15% Weightage)');

// 2. Activities and Field Survey Tests (30% Weightage)
console.log('\n--- 2. Activities and Field Survey Tests ---');
const actRatings = calculateRiEvaluation({
  institutional_visit_rating: 'Excellent', // 10
  family_survey_rating: 'Good',            // 8
  community_project_rating: 'Satisfactory' // 6
});
assert.strictEqual(actRatings.institutional_visit_marks, 10);
assert.strictEqual(actRatings.family_survey_marks, 8);
assert.strictEqual(actRatings.community_project_marks, 6);
assert.strictEqual(actRatings.activities_survey_marks, 24);
console.log('✅ Activities and Field Survey ratings & marks verified (30% Weightage)');

// 3. Problem Statement Identification Tests (15% Weightage)
console.log('\n--- 3. Problem Statement Identification & SDGs Tests ---');
const probTest = calculateRiEvaluation({
  problem_statement_marks: 14.5
});
assert.strictEqual(probTest.problem_statement_marks, 14.5);

// Clamped max 15
const probClamped = calculateRiEvaluation({
  problem_statement_marks: 20
});
assert.strictEqual(probClamped.problem_statement_marks, 15);
console.log('✅ Problem Statement marks verified (15% Weightage)');

// 4. Proposed Smart Solution Tests (40% Weightage)
console.log('\n--- 4. Proposed Smart Solution Tests ---');
const smartTest = calculateRiEvaluation({
  smart_solution_marks: 37.5
});
assert.strictEqual(smartTest.smart_solution_marks, 37.5);

// Clamped max 40
const smartClamped = calculateRiEvaluation({
  smart_solution_marks: 50
});
assert.strictEqual(smartClamped.smart_solution_marks, 40);
console.log('✅ Proposed Smart Solution marks verified (40% Weightage)');

// 5. Complete Combination & User Example Verification
console.log('\n--- 5. Complete Rubric Calculation Verification ---');
// Prompt verification example:
// Attendance 11.25 + Activities 24 + Problem Statement 12 + Smart Solution 35 = 82.25 / 100
const userExample = calculateRiEvaluation({
  activities_present_count: 3,
  institutional_visit_rating: 'Good', // 8
  family_survey_rating: 'Good',       // 8
  community_project_rating: 'Good',   // 8
  problem_statement_marks: 12,
  smart_solution_marks: 35
});
assert.strictEqual(userExample.attendance_marks, 11.25);
assert.strictEqual(userExample.activities_survey_marks, 24);
assert.strictEqual(userExample.problem_statement_marks, 12);
assert.strictEqual(userExample.smart_solution_marks, 35);
assert.strictEqual(userExample.total_marks, 82.25);
assert.strictEqual(userExample.overall_grade, 'A+');
console.log(`✅ User verification formula: 11.25 + 24 + 12 + 35 = ${userExample.total_marks} / 100 (Grade: ${userExample.overall_grade})`);

// Full 100/100 test
const perfectScore = calculateRiEvaluation({
  activities_present_count: 4,
  institutional_visit_rating: 'Excellent', // 10
  family_survey_rating: 'Excellent',       // 10
  community_project_rating: 'Excellent',   // 10
  problem_statement_marks: 15,
  smart_solution_marks: 40
});
assert.strictEqual(perfectScore.total_marks, 100);
assert.strictEqual(perfectScore.overall_grade, 'O');
console.log(`✅ Perfect score formula: 15 + 30 + 15 + 40 = ${perfectScore.total_marks} / 100 (Grade: ${perfectScore.overall_grade})`);

console.log('\n====================================================');
console.log('🎉 ALL NEW 100-MARK EVALUATION SCHEME TESTS PASSED!');
console.log('====================================================');
