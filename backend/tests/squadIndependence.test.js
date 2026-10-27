const assert = require('assert');
const squadScoringEngine = require('../services/squadScoringEngine');

console.log('======================================================================');
console.log('--- TEST: BEST CAPTAIN & BEST SQUAD INDEPENDENCE CONTROLLED SUITE ---');
console.log('======================================================================\n');

// Controlled mock selections (in-memory only, no DB modification)
const mockSelections = [
  // ── Punctuality Activities: Dinkar wins Gold in all 7 sessions (Rank #1) ──
  // Bhaskar gets Silver in all 7 sessions (Rank #2)
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - Fall In', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - Yoga', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - TB 1', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - Agri 1', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - Afternoon', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - TB 2', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },
  { batch_id: 999, day: 'Day 2', activity_title: 'Punctuality - Agri 2', first_squad: 'Dinkar', second_squad: 'Bhaskar', third_squad: 'Aditya' },

  // ── Non-Punctuality Activities: Bhaskar wins across multiple categories ──
  // Day 3 Quiz (Bhaskar, Aditya) -> 5 pts each
  { batch_id: 999, day: 'Day 3', activity_title: 'Quiz', first_squad: 'Bhaskar, Aditya' },

  // Day 4 Debate (Bhaskar, Aditya, Divakar, Mitra, Martand) -> 2 pts each
  { batch_id: 999, day: 'Day 4', activity_title: 'Debate', first_squad: 'Bhaskar, Aditya, Divakar, Mitra, Martand' },

  // Day 4 Kho Kho (Bhaskar, Aditya, Divakar, Mitra, Martand) -> 2 pts each
  { batch_id: 999, day: 'Day 4', activity_title: 'Kho Kho', first_squad: 'Bhaskar, Aditya, Divakar, Mitra, Martand' },

  // Day 5 Obstacle: Bhaskar Rank 1 (10 pts), Dinkar Rank 2 (9 pts)
  { batch_id: 999, day: 'Day 5', activity_title: 'Obstacle', first_squad: 'Bhaskar, Dinkar, Aditya, Divakar, Mitra, Martand, Prabhakar, Ravi, Surya, Tejonidhi' },

  // Day 5 Activities
  { batch_id: 999, day: 'Day 5', activity_title: 'Discipline', first_squad: 'Bhaskar', second_squad: 'Aditya', third_squad: 'Dinkar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Room Cleaning', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Food Serving', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Coordination, Courtesy, Maintain Discipline, Hygiene', first_squad: 'Bhaskar', second_squad: 'Aditya', third_squad: 'Dinkar' },

  // Day 5 Five Pillars (1 winner = 2 pts each)
  { batch_id: 999, day: 'Day 5', activity_title: 'Agriculture', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Sports', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Team Building', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Patriotism', first_squad: 'Bhaskar' },
  { batch_id: 999, day: 'Day 5', activity_title: 'Spirituality', first_squad: 'Bhaskar' }
];

// Run calculation
const result = squadScoringEngine.calculateSquadPerformance(mockSelections);
const { squadData, leaderboard } = result;

// Determine Best Captain: Sorted strictly by punctuality_rank
const bestCaptainLeaderboard = [...leaderboard].sort((a, b) => {
  const rankA = a.punctuality_rank ?? 99;
  const rankB = b.punctuality_rank ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  return (a.squad || '').localeCompare(b.squad || '');
});

const bestCaptain = bestCaptainLeaderboard[0];
const bestSquad = leaderboard[0];

console.log('--- INDEPENDENCE SIMULATION RESULTS ---\n');

console.log('1. Punctuality Rankings (Punctuality 40% weight):');
bestCaptainLeaderboard.forEach((s, idx) => {
  console.log(`   Rank #${idx + 1}: Squad ${s.squad} | Punctuality Rank: ${s.punctuality_rank} | Punctuality Points: ${s.punctuality_points} | Weighted Punc Score: ${s.categoryScores.punctuality}`);
});

console.log('\n2. Overall Championship Standings (Highest Overall Score):');
leaderboard.forEach((s, idx) => {
  console.log(`   Rank #${idx + 1}: Squad ${s.squad} | Overall Score: ${s.overall_score.toFixed(2)} | Punc Rank: ${s.punctuality_rank} | Gold: ${s.first_count}`);
});

console.log('\n-------------------------------------------------------------');
console.log(`BEST CAPTAIN: Squad ${bestCaptain.squad} (Punctuality Rank #${bestCaptain.punctuality_rank})`);
console.log(`BEST SQUAD:   Squad ${bestSquad.squad} (Overall Score: ${bestSquad.overall_score.toFixed(2)})`);
console.log('-------------------------------------------------------------\n');

// Assertions for verification
assert.strictEqual(squadData['Dinkar'].punctuality_rank, 1, 'Squad Dinkar MUST be Punctuality Rank #1');
assert.strictEqual(squadData['Bhaskar'].punctuality_rank, 2, 'Squad Bhaskar MUST be Punctuality Rank #2');

assert.strictEqual(bestCaptain.squad, 'Dinkar', 'Best Captain MUST be Dinkar');
assert.strictEqual(bestSquad.squad, 'Bhaskar', 'Best Squad MUST be Bhaskar');

assert.notStrictEqual(bestCaptain.squad, bestSquad.squad, 'Best Captain and Best Squad MUST be different squads in this scenario');
assert.ok(squadData['Bhaskar'].overall_score > squadData['Dinkar'].overall_score, 'Bhaskar Overall Score must be strictly higher than Dinkar');

console.log('✓ All Independence Assertions Passed Successfully!');
