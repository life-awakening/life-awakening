const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');
const XLSX = require('xlsx');

console.log('===============================================================');
console.log('--- STARTING COMPREHENSIVE SQUAD PERFORMANCE SCORING TESTS ---');
console.log('===============================================================');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Activity Selection Rules (Quiz, Debate, Kho Kho, Food Serving, Room Cleaning, Day 5 Five Pillars, Obstacles)
// ─────────────────────────────────────────────────────────────────────────────
const quizRule = squadScoringEngine.getActivitySelectionRule('Quiz');
assert.ok(quizRule, 'Quiz rule must exist');
assert.strictEqual(quizRule.requiredCount, 2, 'Quiz must require 2 squads');
assert.strictEqual(quizRule.pointsPerSquad, 5, 'Quiz winner squad gets 5 points');
assert.strictEqual(quizRule.maxPoints, 10, 'Quiz max points = 10');

const debateRule = squadScoringEngine.getActivitySelectionRule('Debate');
assert.ok(debateRule, 'Debate rule must exist');
assert.strictEqual(debateRule.requiredCount, 5, 'Debate must require 5 squads');
assert.strictEqual(debateRule.pointsPerSquad, 2, 'Debate winner squad gets 2 points');
assert.strictEqual(debateRule.maxPoints, 10, 'Debate max points = 10');

const khokhoRule = squadScoringEngine.getActivitySelectionRule('Kho Kho');
assert.ok(khokhoRule, 'Kho Kho rule must exist');
assert.strictEqual(khokhoRule.requiredCount, 5, 'Kho Kho must require 5 squads');
assert.strictEqual(khokhoRule.pointsPerSquad, 2, 'Kho Kho winner squad gets 2 points');
assert.strictEqual(khokhoRule.maxPoints, 10, 'Kho Kho max points = 10');

// Food Serving (1 squad = 10 pts)
const foodServingRule = squadScoringEngine.getActivitySelectionRule('Day 5', 'Food Serving');
assert.ok(foodServingRule, 'Food Serving rule must exist');
assert.strictEqual(foodServingRule.requiredCount, 1, 'Food Serving must require exactly 1 squad');
assert.strictEqual(foodServingRule.pointsPerSquad, 10, 'Food Serving winner squad gets 10 points');
assert.strictEqual(foodServingRule.maxPoints, 10, 'Food Serving max points = 10');

// Room Cleaning (1 squad = 10 pts)
const roomCleaningRule = squadScoringEngine.getActivitySelectionRule('Day 5', 'Room Cleaning');
assert.ok(roomCleaningRule, 'Room Cleaning rule must exist');
assert.strictEqual(roomCleaningRule.requiredCount, 1, 'Room Cleaning must require exactly 1 squad');
assert.strictEqual(roomCleaningRule.pointsPerSquad, 10, 'Room Cleaning winner squad gets 10 points');
assert.strictEqual(roomCleaningRule.maxPoints, 10, 'Room Cleaning max points = 10');

const fivePillars = ['Agriculture', 'Sports', 'Team Building', 'Patriotism', 'Spirituality'];
let pillarTotalPoints = 0;
fivePillars.forEach(p => {
  const pRule = squadScoringEngine.getActivitySelectionRule('Day 5', p);
  assert.ok(pRule, `Rule for ${p} on Day 5 must exist`);
  assert.strictEqual(pRule.requiredCount, 1, `${p} must select exactly 1 squad`);
  assert.strictEqual(pRule.pointsPerSquad, 2, `${p} winner squad gets 2 points`);
  assert.strictEqual(pRule.maxPoints, 2, `${p} max points = 2`);
  pillarTotalPoints += pRule.maxPoints;
});
assert.strictEqual(pillarTotalPoints, 10, 'All 5 pillars together must equal 10 raw points');
console.log('✓ Test 1 Passed: Activity Selection Rules configured for Quiz, Debate, Kho Kho, Food Serving, Room Cleaning & Day 5 Five Pillars');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Category Weights (Total = 100% / 1.00)
// ─────────────────────────────────────────────────────────────────────────────
const expectedWeights = {
  punctuality: 0.40,
  discipline: 0.05,
  room_cleaning: 0.05,
  food_serving: 0.05,
  coordination: 0.05,
  obstacles: 0.05,
  khokho: 0.025,
  debate: 0.025,
  quiz: 0.05,
  agriculture: 0.05,
  sports: 0.05,
  team_building: 0.05,
  patriotism: 0.05,
  spirituality: 0.05
};

const totalWeight = squadScoringEngine.SQUAD_CATEGORIES.reduce((sum, c) => sum + c.weightDecimal, 0);
assert.strictEqual(Math.round(totalWeight * 1000) / 1000, 1.0, 'Category weights must sum to exactly 1.00 (100%)');

squadScoringEngine.SQUAD_CATEGORIES.forEach(c => {
  assert.strictEqual(c.weightDecimal, expectedWeights[c.key], `Weight for ${c.key} must be ${expectedWeights[c.key]}`);
});
console.log('✓ Test 2 Passed: All 14 Category Weights match requirements (Punctuality 40%, Point-wise 60%)');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Full Simulation of Selections & Point-wise vs Rank-based Punctuality
// ─────────────────────────────────────────────────────────────────────────────
const mockSelections = [
  // Day 2 Punctuality: Aditya wins 3 Gold, Bhaskar wins 2 Gold + 1 Silver, Surya wins 1 Gold + 2 Silver
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Fall In', first_squad: 'Aditya', second_squad: 'Bhaskar', third_squad: 'Surya' },
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Yoga', first_squad: 'Aditya', second_squad: 'Surya', third_squad: 'Bhaskar' },
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - TB 1', first_squad: 'Aditya', second_squad: 'Surya', third_squad: 'Mitra' },
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Agri 1', first_squad: 'Bhaskar', second_squad: 'Aditya', third_squad: 'Dinkar' },
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - Afternoon', first_squad: 'Bhaskar', second_squad: 'Aditya', third_squad: 'Tejonidhi' },
  { batch_id: 1, day: 'Day 2', activity_title: 'Punctuality - TB 2', first_squad: 'Surya', second_squad: 'Aditya', third_squad: 'Martand' },

  // Day 3 Quiz: Select 2 squads (Bhaskar, Surya) -> 5 pts each
  { batch_id: 1, day: 'Day 3', activity_title: 'Quiz', first_squad: 'Bhaskar, Surya' },

  // Day 4 Debate: Select 5 squads (Aditya, Bhaskar, Dinkar, Divakar, Mitra) -> 2 pts each
  { batch_id: 1, day: 'Day 4', activity_title: 'Debate', first_squad: 'Aditya, Bhaskar, Dinkar, Divakar, Mitra' },

  // Day 4 Kho Kho: Select 5 squads (Surya, Martand, Prabhakar, Ravi, Tejonidhi) -> 2 pts each
  { batch_id: 1, day: 'Day 4', activity_title: 'Kho Kho', first_squad: 'Surya, Martand, Prabhakar, Ravi, Tejonidhi' },

  // Day 5 Obstacle: Rank 1 to 10
  // Rank 1: Tejonidhi (10 pts), Rank 2: Ravi (9 pts), Rank 3: Prabhakar (8 pts)
  {
    batch_id: 1,
    day: 'Day 5',
    activity_title: 'Obstacle',
    first_squad: 'Tejonidhi, Ravi, Prabhakar, Martand, Mitra, Divakar, Dinkar, Surya, Bhaskar, Aditya'
  },

  // Day 5 Discipline (Standard 1st/2nd/3rd): 1st=Bhaskar (10 pts), 2nd=Aditya (9 pts), 3rd=Surya (8 pts)
  { batch_id: 1, day: 'Day 5', activity_title: 'Discipline', first_squad: 'Bhaskar', second_squad: 'Aditya', third_squad: 'Surya' },

  // Day 5 Room Cleaning (Single Winner = 10 pts): Surya = 10 pts, all others = 0 pts
  { batch_id: 1, day: 'Day 5', activity_title: 'Room Cleaning', first_squad: 'Surya' },

  // Day 5 Food Serving (Single Winner = 10 pts): Aditya = 10 pts, all others = 0 pts
  { batch_id: 1, day: 'Day 5', activity_title: 'Food Serving', first_squad: 'Aditya' },

  // Day 5 Coordination (Standard 1st/2nd/3rd): 1st=Mitra (10 pts), 2nd=Divakar (9 pts), 3rd=Dinkar (8 pts)
  { batch_id: 1, day: 'Day 5', activity_title: 'Coordination, Courtesy, Maintain Discipline, Hygiene', first_squad: 'Mitra', second_squad: 'Divakar', third_squad: 'Dinkar' },

  // Day 5 Five Pillars (1 winner each = 2 pts each)
  { batch_id: 1, day: 'Day 5', activity_title: 'Agriculture', first_squad: 'Bhaskar' },
  { batch_id: 1, day: 'Day 5', activity_title: 'Sports', first_squad: 'Surya' },
  { batch_id: 1, day: 'Day 5', activity_title: 'Team Building', first_squad: 'Aditya' },
  { batch_id: 1, day: 'Day 5', activity_title: 'Patriotism', first_squad: 'Mitra' },
  { batch_id: 1, day: 'Day 5', activity_title: 'Spirituality', first_squad: 'Tejonidhi' }
];

const result = squadScoringEngine.calculateSquadPerformance(mockSelections);
const { squadData, leaderboard } = result;

// Verify Punctuality Ranking:
// Aditya: 52 / 6 = 8.6667 pts -> Rank 1 (weighted 0.87)
// Bhaskar: 32.5 / 6 = 5.4167 pts -> Rank 2 (weighted 0.54)
// Surya: 32.0 / 6 = 5.3333 pts -> Rank 3 (weighted 0.53)
assert.strictEqual(squadData['Aditya'].punctuality_rank, 1, 'Aditya must have Punctuality Rank 1');
assert.strictEqual(squadData['Aditya'].punctuality_points, 8.6667, 'Aditya must have 8.6667 Punctuality points');
assert.strictEqual(squadData['Aditya'].categoryScores.punctuality, 0.8667, 'Aditya weighted punctuality must be 0.8667 (8.6667 * 0.10 for Day 2)');

assert.strictEqual(squadData['Bhaskar'].punctuality_rank, 2, 'Bhaskar must have Punctuality Rank 2');
assert.strictEqual(squadData['Bhaskar'].punctuality_points, 5.5, 'Bhaskar must have 5.5 Punctuality points');
assert.strictEqual(squadData['Bhaskar'].categoryScores.punctuality, 0.55, 'Bhaskar weighted punctuality must be 0.55 (5.5 * 0.10 for Day 2)');

assert.strictEqual(squadData['Surya'].punctuality_rank, 3, 'Surya must have Punctuality Rank 3');
assert.strictEqual(squadData['Surya'].punctuality_points, 4.6667, 'Surya must have 4.6667 Punctuality points');
assert.strictEqual(squadData['Surya'].categoryScores.punctuality, 0.4667, 'Surya weighted punctuality must be 0.4667 (4.6667 * 0.10 for Day 2)');
console.log('✓ Test 3 Passed: Punctuality additive ranking correctly evaluated (Day 2 Rank 1=0.8667, Rank 2=0.55, Rank 3=0.4667)');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Food Serving (10 pts), Room Cleaning (10 pts), Quiz (5 pts), Debate (2 pts), Kho Kho (2 pts), Day 5 Pillars (2 pts)
// ─────────────────────────────────────────────────────────────────────────────
// Food Serving (Aditya = 10 pts, others = 0)
assert.strictEqual(squadData['Aditya'].rawCategoryScores.food_serving, 10, 'Aditya Food Serving raw score must be 10');
assert.strictEqual(squadData['Aditya'].categoryScores.food_serving, 0.50, 'Aditya Food Serving weighted score must be 0.50 (10 * 0.05)');
assert.strictEqual(squadData['Bhaskar'].rawCategoryScores.food_serving, 0, 'Bhaskar Food Serving raw score must be 0 (unselected)');
assert.strictEqual(squadData['Bhaskar'].categoryScores.food_serving, 0, 'Bhaskar Food Serving weighted score must be 0');
assert.strictEqual(squadData['Surya'].rawCategoryScores.food_serving, 0, 'Surya Food Serving raw score must be 0 (unselected)');

// Room Cleaning (Surya = 10 pts, others = 0)
assert.strictEqual(squadData['Surya'].rawCategoryScores.room_cleaning, 10, 'Surya Room Cleaning raw score must be 10');
assert.strictEqual(squadData['Surya'].categoryScores.room_cleaning, 0.50, 'Surya Room Cleaning weighted score must be 0.50 (10 * 0.05)');
assert.strictEqual(squadData['Aditya'].rawCategoryScores.room_cleaning, 0, 'Aditya Room Cleaning raw score must be 0 (unselected)');
assert.strictEqual(squadData['Aditya'].categoryScores.room_cleaning, 0, 'Aditya Room Cleaning weighted score must be 0');
assert.strictEqual(squadData['Bhaskar'].rawCategoryScores.room_cleaning, 0, 'Bhaskar Room Cleaning raw score must be 0 (unselected)');

// Quiz (Bhaskar, Surya)
assert.strictEqual(squadData['Bhaskar'].rawCategoryScores.quiz, 5, 'Bhaskar Quiz raw score must be 5');
assert.strictEqual(squadData['Bhaskar'].categoryScores.quiz, 0.25, 'Bhaskar Quiz weighted score must be 0.25 (5 * 0.05)');
assert.strictEqual(squadData['Surya'].rawCategoryScores.quiz, 5, 'Surya Quiz raw score must be 5');
assert.strictEqual(squadData['Aditya'].rawCategoryScores.quiz, 0, 'Aditya Quiz raw score must be 0 (unselected)');

// Debate (Aditya, Bhaskar, Dinkar, Divakar, Mitra)
assert.strictEqual(squadData['Aditya'].rawCategoryScores.debate, 2, 'Aditya Debate raw score must be 2');
assert.strictEqual(squadData['Aditya'].categoryScores.debate, 0.05, 'Aditya Debate weighted score must be 0.05 (2 * 0.025)');
assert.strictEqual(squadData['Surya'].rawCategoryScores.debate, 0, 'Surya Debate raw score must be 0 (unselected)');

// Kho Kho (Surya, Martand, Prabhakar, Ravi, Tejonidhi)
assert.strictEqual(squadData['Surya'].rawCategoryScores.khokho, 2, 'Surya Kho Kho raw score must be 2');
assert.strictEqual(squadData['Surya'].categoryScores.khokho, 0.05, 'Surya Kho Kho weighted score must be 0.05 (2 * 0.025)');
assert.strictEqual(squadData['Aditya'].rawCategoryScores.khokho, 0, 'Aditya Kho Kho raw score must be 0 (unselected)');

// Day 5 Pillars:
// Bhaskar = Agriculture (2 pts * 0.05 = 0.10)
assert.strictEqual(squadData['Bhaskar'].rawCategoryScores.agriculture, 2, 'Bhaskar Agriculture raw score must be 2');
assert.strictEqual(squadData['Bhaskar'].categoryScores.agriculture, 0.10, 'Bhaskar Agriculture weighted score must be 0.10 (2 * 0.05)');

// Surya = Sports (2 pts * 0.05 = 0.10)
assert.strictEqual(squadData['Surya'].rawCategoryScores.sports, 2, 'Surya Sports raw score must be 2');
assert.strictEqual(squadData['Surya'].categoryScores.sports, 0.10, 'Surya Sports weighted score must be 0.10 (2 * 0.05)');

// Aditya = Team Building (2 pts * 0.05 = 0.10)
assert.strictEqual(squadData['Aditya'].rawCategoryScores.team_building, 2, 'Aditya Team Building raw score must be 2');
assert.strictEqual(squadData['Aditya'].categoryScores.team_building, 0.10, 'Aditya Team Building weighted score must be 0.10 (2 * 0.05)');
console.log('✓ Test 4 Passed: Food Serving (10 pts), Room Cleaning (10 pts), Quiz (5 pts), Debate (2 pts), Kho Kho (2 pts), Day 5 Pillars (2 pts) verified');

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Overall Score = Punctuality 40% + Remaining 60% Point-wise
// ─────────────────────────────────────────────────────────────────────────────
squadScoringEngine.SQUAD_CANONICAL_NAMES.forEach(sq => {
  let expectedSum = 0;
  squadScoringEngine.SQUAD_CATEGORIES.forEach(c => {
    expectedSum += squadData[sq].categoryScores[c.key] || 0;
  });
  expectedSum = Number(expectedSum.toFixed(2));
  assert.strictEqual(squadData[sq].overall_score, expectedSum, `${sq} overall score must equal sum of 14 categories`);
});

// Best Squad = Highest Overall Score (Rank 1 on Leaderboard)
assert.strictEqual(leaderboard[0].overall_score >= leaderboard[1].overall_score, true, 'Leaderboard must be sorted by Overall Score descending');
assert.strictEqual(leaderboard[1].overall_score >= leaderboard[2].overall_score, true);
console.log(`✓ Test 5 Passed: Overall score formula matches & Best Squad (${leaderboard[0].squad}: ${leaderboard[0].overall_score}) is highest score`);

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: Excel Export Verification (Exact 16 Columns & Raw Points in Activities)
// ─────────────────────────────────────────────────────────────────────────────
const wbBuffer = squadScoringEngine.generateSquadPerformanceExcelBuffer({ name: 'Test Batch', year: 2026 }, result);
assert.ok(wbBuffer && wbBuffer.length > 0, 'Excel buffer must be generated');

const wb = XLSX.read(wbBuffer, { type: 'buffer' });
const s1 = wb.Sheets['Overall Score'];
const sheetData = XLSX.utils.sheet_to_json(s1, { header: 1 });

const expectedColumns = [
  'Squad',
  'Punctuality',
  'Discipline',
  'Room Cleaning',
  'Food Serving',
  'Coordination/Courtesy/Maintain Discipline/Hygiene',
  'Obstacles',
  'Kho Kho',
  'Debate',
  'Quiz',
  'Agriculture',
  'Sports',
  'Team Building',
  'Patriotism',
  'Spirituality',
  'Overall Score'
];

assert.deepStrictEqual(sheetData[0], expectedColumns, 'Excel Header row must match exact 16 columns specified');

// Verify that data rows appear in canonical squad order (Aditya -> Tejonidhi) and contain raw points
squadScoringEngine.SQUAD_CANONICAL_NAMES.forEach((sq, idx) => {
  const item = leaderboard.find(l => l.squad === sq);
  const row = sheetData[idx + 1];
  assert.strictEqual(row[0], `Squad ${sq}`);
  assert.strictEqual(row[1], item.rawCategoryScores.punctuality);
  assert.strictEqual(row[2], item.rawCategoryScores.discipline);
  assert.strictEqual(row[3], item.rawCategoryScores.room_cleaning);
  assert.strictEqual(row[4], item.rawCategoryScores.food_serving);
  assert.strictEqual(row[5], item.rawCategoryScores.coordination);
  assert.strictEqual(row[6], item.rawCategoryScores.obstacles);
  assert.strictEqual(row[7], item.rawCategoryScores.khokho);
  assert.strictEqual(row[8], item.rawCategoryScores.debate);
  assert.strictEqual(row[9], item.rawCategoryScores.quiz);
  assert.strictEqual(row[10], item.rawCategoryScores.agriculture);
  assert.strictEqual(row[11], item.rawCategoryScores.sports);
  assert.strictEqual(row[12], item.rawCategoryScores.team_building);
  assert.strictEqual(row[13], item.rawCategoryScores.patriotism);
  assert.strictEqual(row[14], item.rawCategoryScores.spirituality);
  assert.strictEqual(row[15], Number(item.overall_score.toFixed(2)));
});

// Check specific values in Excel:
// Food Serving: Aditya is 10, Bhaskar is 0, Surya is 0
const adityaRow = sheetData.find(r => r[0] === 'Squad Aditya');
assert.strictEqual(adityaRow[4], 10, 'Aditya Food Serving in Excel must be 10');
assert.strictEqual(adityaRow[3], 0, 'Aditya Room Cleaning in Excel must be 0 (unselected)');

// Room Cleaning: Surya is 10, Aditya is 0, Bhaskar is 0
const suryaRow = sheetData.find(r => r[0] === 'Squad Surya');
assert.strictEqual(suryaRow[3], 10, 'Surya Room Cleaning in Excel must be 10');
assert.strictEqual(suryaRow[4], 0, 'Surya Food Serving in Excel must be 0 (unselected)');

const bhaskarRow = sheetData.find(r => r[0] === 'Squad Bhaskar');
assert.strictEqual(bhaskarRow[9], 5, 'Bhaskar Quiz in Excel must be 5 (not 0.25)');
assert.strictEqual(bhaskarRow[8], 2, 'Bhaskar Debate in Excel must be 2 (not 0.05)');
assert.strictEqual(bhaskarRow[10], 2, 'Bhaskar Agriculture in Excel must be 2 (not 0.10)');
assert.strictEqual(bhaskarRow[1], 5.5, 'Bhaskar Punctuality in Excel must be 5.5 (raw points)');
assert.strictEqual(bhaskarRow[3], 0, 'Bhaskar Room Cleaning in Excel must be 0');
assert.strictEqual(bhaskarRow[4], 0, 'Bhaskar Food Serving in Excel must be 0');

console.log('✓ Test 6 Passed: Excel Export contains exact 16 columns, raw numbers in activity columns (10 for single winners, 0 for others), and final Overall Score');

console.log('===============================================================');
console.log('ALL COMPREHENSIVE SQUAD PERFORMANCE TESTS PASSED SUCCESSFULLY!');
console.log('===============================================================');
