const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');

console.log('--- STARTING SQUAD UNSELECT RANK 1, 2, 3 UNIT TESTS ---');

// 1. Initial State: Rank 1 = Aditya, Rank 2 = Bhaskar, Rank 3 = Surya
const initialSelections = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: 'Aditya',
    second_squad: 'Bhaskar',
    third_squad: 'Surya',
    squad_name: 'Aditya',
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res1 = squadScoringEngine.calculateSquadPerformance(initialSelections).leaderboard;
const aditya1 = res1.find(s => s.squad === 'Aditya');
const bhaskar1 = res1.find(s => s.squad === 'Bhaskar');
const surya1 = res1.find(s => s.squad === 'Surya');

assert.strictEqual(aditya1.first_count, 1, 'Aditya must have 1 Gold');
assert.strictEqual(aditya1.points, 10, 'Aditya must have 10 points');
assert.strictEqual(bhaskar1.second_count, 1, 'Bhaskar must have 1 Silver');
assert.strictEqual(bhaskar1.points, 9, 'Bhaskar must have 9 points');
assert.strictEqual(surya1.third_count, 1, 'Surya must have 1 Bronze');
assert.strictEqual(surya1.points, 8, 'Surya must have 8 points');
console.log('✓ Test 1 Passed: Initial 1st, 2nd, 3rd selection computes medals and points correctly');

// 2. Unselect Rank 1 ONLY: first_squad = null, squad_name = '', second_squad = 'Bhaskar', third_squad = 'Surya'
// IMPORTANT: squad_name must be '' (NOT NULL constraint compliant)
const rank1Unselected = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: null,
    second_squad: 'Bhaskar',
    third_squad: 'Surya',
    squad_name: '', // Non-null empty string
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res2 = squadScoringEngine.calculateSquadPerformance(rank1Unselected).leaderboard;
const aditya2 = res2.find(s => s.squad === 'Aditya');
const bhaskar2 = res2.find(s => s.squad === 'Bhaskar');
const surya2 = res2.find(s => s.squad === 'Surya');

assert.strictEqual(aditya2.first_count, 0, 'Aditya must have 0 Gold after Rank 1 unselection');
assert.strictEqual(aditya2.points, 0, 'Aditya must have 0 points after Rank 1 unselection');
assert.strictEqual(bhaskar2.second_count, 1, 'Bhaskar must still have 1 Silver');
assert.strictEqual(bhaskar2.points, 9, 'Bhaskar must still have 9 points');
assert.strictEqual(surya2.third_count, 1, 'Surya must still have 1 Bronze');
assert.strictEqual(surya2.points, 8, 'Surya must still have 8 points');
console.log('✓ Test 2 Passed: Unselecting Rank 1 clears Gold and points for Rank 1 while preserving Rank 2 and Rank 3');

// 3. Re-assign Rank 1 to a new squad (Mitra): first_squad = 'Mitra', squad_name = 'Mitra'
const rank1Reassigned = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: 'Mitra',
    second_squad: 'Bhaskar',
    third_squad: 'Surya',
    squad_name: 'Mitra',
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res3 = squadScoringEngine.calculateSquadPerformance(rank1Reassigned).leaderboard;
const mitra3 = res3.find(s => s.squad === 'Mitra');
const bhaskar3 = res3.find(s => s.squad === 'Bhaskar');
const surya3 = res3.find(s => s.squad === 'Surya');

assert.strictEqual(mitra3.first_count, 1, 'Mitra must have 1 Gold');
assert.strictEqual(mitra3.points, 10, 'Mitra must have 10 points');
assert.strictEqual(bhaskar3.second_count, 1, 'Bhaskar must have 1 Silver');
assert.strictEqual(surya3.third_count, 1, 'Surya must have 1 Bronze');
console.log('✓ Test 3 Passed: Re-assigning Rank 1 works smoothly with new squad');

// 4. Unselect Rank 2 ONLY: first_squad = 'Mitra', second_squad = null, third_squad = 'Surya'
const rank2Unselected = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: 'Mitra',
    second_squad: null,
    third_squad: 'Surya',
    squad_name: 'Mitra',
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res4 = squadScoringEngine.calculateSquadPerformance(rank2Unselected).leaderboard;
const mitra4 = res4.find(s => s.squad === 'Mitra');
const bhaskar4 = res4.find(s => s.squad === 'Bhaskar');
const surya4 = res4.find(s => s.squad === 'Surya');

assert.strictEqual(mitra4.first_count, 1, 'Mitra must have 1 Gold');
assert.strictEqual(bhaskar4.second_count, 0, 'Bhaskar must have 0 Silver after unselecting Rank 2');
assert.strictEqual(bhaskar4.points, 0, 'Bhaskar must have 0 points');
assert.strictEqual(surya4.third_count, 1, 'Surya must have 1 Bronze');
console.log('✓ Test 4 Passed: Unselecting Rank 2 clears Silver correctly');

// 5. Unselect Rank 3 ONLY: first_squad = 'Mitra', second_squad = 'Bhaskar', third_squad = null
const rank3Unselected = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: 'Mitra',
    second_squad: 'Bhaskar',
    third_squad: null,
    squad_name: 'Mitra',
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res5 = squadScoringEngine.calculateSquadPerformance(rank3Unselected).leaderboard;
const surya5 = res5.find(s => s.squad === 'Surya');
assert.strictEqual(surya5.third_count, 0, 'Surya must have 0 Bronze after unselecting Rank 3');
assert.strictEqual(surya5.points, 0, 'Surya must have 0 points');
console.log('✓ Test 5 Passed: Unselecting Rank 3 clears Bronze correctly');

// 6. Unselect ALL ranks: empty row with first_squad = null, squad_name = '', second_squad = null, third_squad = null
const allUnselected = [
  {
    batch_id: 1,
    day: 'Day 2',
    activity_title: 'Volleyball',
    first_squad: null,
    second_squad: null,
    third_squad: null,
    squad_name: '',
    is_locked: false,
    selected_at: new Date().toISOString()
  }
];

const res6 = squadScoringEngine.calculateSquadPerformance(allUnselected).leaderboard;
res6.forEach(s => {
  assert.strictEqual(s.first_count, 0, `${s.squad} must have 0 Gold`);
  assert.strictEqual(s.second_count, 0, `${s.squad} must have 0 Silver`);
  assert.strictEqual(s.third_count, 0, `${s.squad} must have 0 Bronze`);
  assert.strictEqual(s.points, 0, `${s.squad} must have 0 points`);
});
console.log('✓ Test 6 Passed: Unselecting all ranks leaves leaderboard cleanly reset');

console.log('--- ALL UNSELECT RANK TESTS PASSED SUCCESSFULLY! ---');
