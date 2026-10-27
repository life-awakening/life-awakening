/**
 * Centralized Squad Scoring Service
 * Authoritative source of scoring definitions, calculation formulas,
 * 5-day averages, tie-breaking rules, and validation.
 */

// 10 Canonical Squads in LTC
const SQUAD_CANONICAL_NAMES = [
  'Aditya',
  'Bhaskar',
  'Dinkar',
  'Divakar',
  'Mitra',
  'Martand',
  'Prabhakar',
  'Ravi',
  'Surya',
  'Tejonidhi'
];

// 5 Competition Days
const COMPETITION_DAYS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];

/**
 * 12 Main Activities Definition
 * Total weight = 100%
 *
 * NOTE: The following activities have been REMOVED per requirements:
 * ❌ Room Cleaning
 * ❌ Hygiene
 * ❌ Coordination & Courtesy / Maintain Discipline
 */
const ACTIVITIES_CONFIG = [
  {
    key: 'punctuality',
    name: 'Punctuality',
    weight: 50.0,
    isParent: true,
    subActivities: [
      { key: 'fall_in', name: 'Fall In', weight: 12.5 },
      { key: 'yoga', name: 'Yoga', weight: 12.5 },
      { key: 'tb', name: 'TB', weight: 12.5 },
      { key: 'agriculture', name: 'Agriculture', weight: 12.5 }
    ]
  },
  { key: 'discipline', name: 'Discipline', weight: 5.0 },
  { key: 'food_serving', name: 'Food Serving', weight: 5.0 },
  { key: 'obstacles', name: 'Obstacles', weight: 5.0 },
  { key: 'khokho', name: 'Khokho', weight: 2.5 },
  { key: 'debate', name: 'Debate', weight: 2.5 },
  { key: 'quiz', name: 'Quiz', weight: 5.0 },
  { key: 'agriculture', name: 'Agriculture', weight: 5.0 }, // Main Agriculture (separate from Punctuality Agriculture)
  { key: 'sports', name: 'Sports', weight: 5.0 },
  { key: 'team_building', name: 'Team Building', weight: 5.0 },
  { key: 'patriotism', name: 'Patriotism', weight: 5.0 },
  { key: 'spirituality', name: 'Spirituality', weight: 5.0 }
];

// Flat list of grading items for validation and matrix
const FLAT_GRADING_ITEMS = [];
ACTIVITIES_CONFIG.forEach(act => {
  if (act.isParent && act.subActivities) {
    act.subActivities.forEach(sub => {
      FLAT_GRADING_ITEMS.push({
        activityKey: act.key,
        activityName: act.name,
        subActivityKey: sub.key,
        subActivityName: sub.name,
        fullTitle: `Punctuality - ${sub.name}`,
        weight: sub.weight,
        isSubActivity: true
      });
    });
  } else {
    FLAT_GRADING_ITEMS.push({
      activityKey: act.key,
      activityName: act.name,
      subActivityKey: null,
      subActivityName: null,
      fullTitle: act.name,
      weight: act.weight,
      isSubActivity: false
    });
  }
});

/**
 * Universal Rank-to-Score calculation
 * For an activity with weight W:
 * Rank 1: W * 1 = W (100%)
 * Rank 2: W * (2 / 3) (66.67%)
 * Rank 3: W * (1 / 3) (33.33%)
 * Others / Unranked: 0
 */
function calculateRankScore(weight, rank) {
  if (!weight || isNaN(weight) || weight <= 0) return 0;
  const numRank = parseInt(rank, 10);
  if (numRank === 1) {
    return Number(weight);
  } else if (numRank === 2) {
    return Number(weight) * (2 / 3);
  } else if (numRank === 3) {
    return Number(weight) * (1 / 3);
  }
  return 0.0;
}

/**
 * Formats a score to 2 decimal places as a Number
 */
function roundScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return 0.0;
  return Math.round((score + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a score to 2 decimal places string (e.g. "82.40")
 */
function formatScore(score) {
  return roundScore(score).toFixed(2);
}

/**
 * Validates squad rank selections for a single activity/sub-activity on a given day.
 * - Same squad cannot occupy more than one rank.
 * - Ranks must be valid squads or empty.
 */
function validateGradingRanks(rank1Squad, rank2Squad, rank3Squad, allowedSquads = SQUAD_CANONICAL_NAMES) {
  const ranks = [
    { rank: 1, squad: rank1Squad ? String(rank1Squad).trim() : null },
    { rank: 2, squad: rank2Squad ? String(rank2Squad).trim() : null },
    { rank: 3, squad: rank3Squad ? String(rank3Squad).trim() : null }
  ];

  const selectedSquads = [];
  for (const r of ranks) {
    if (r.squad) {
      if (!allowedSquads.includes(r.squad)) {
        return {
          valid: false,
          error: `Invalid squad '${r.squad}' assigned to Rank ${r.rank}. Must be one of: ${allowedSquads.join(', ')}`
        };
      }
      if (selectedSquads.includes(r.squad)) {
        return {
          valid: false,
          error: `Invalid ranking: Squad '${r.squad}' cannot occupy more than one rank (assigned to multiple positions).`
        };
      }
      selectedSquads.push(r.squad);
    }
  }

  return { valid: true };
}

/**
 * Calculates full 5-day squad scores and leaderboard given raw grading records.
 *
 * @param {Array} gradingRecords - Rows from squad_grading_results
 * @param {Array} customSquads - Optional list of squads (defaults to canonical 10)
 * @returns {Object} { leaderboard, squadSummaries, progressMatrix, top3 }
 */
function computeComprehensiveScores(gradingRecords = [], customSquads = SQUAD_CANONICAL_NAMES) {
  const squads = customSquads && customSquads.length > 0 ? customSquads : SQUAD_CANONICAL_NAMES;
  const numDays = 5; // Fixed 5-day competition structure

  // Initialize data structures per squad
  const squadData = {};
  squads.forEach(sq => {
    squadData[sq] = {
      squad: sq,
      punctualityDaily: {
        fall_in: [0, 0, 0, 0, 0],
        yoga: [0, 0, 0, 0, 0],
        tb: [0, 0, 0, 0, 0],
        agriculture: [0, 0, 0, 0, 0]
      },
      punctualityDailyRanks: {
        fall_in: [null, null, null, null, null],
        yoga: [null, null, null, null, null],
        tb: [null, null, null, null, null],
        agriculture: [null, null, null, null, null]
      },
      activityDaily: {
        discipline: [0, 0, 0, 0, 0],
        food_serving: [0, 0, 0, 0, 0],
        obstacles: [0, 0, 0, 0, 0],
        khokho: [0, 0, 0, 0, 0],
        debate: [0, 0, 0, 0, 0],
        quiz: [0, 0, 0, 0, 0],
        agriculture: [0, 0, 0, 0, 0], // Main Agriculture
        sports: [0, 0, 0, 0, 0],
        team_building: [0, 0, 0, 0, 0],
        patriotism: [0, 0, 0, 0, 0],
        spirituality: [0, 0, 0, 0, 0]
      },
      activityDailyRanks: {
        discipline: [null, null, null, null, null],
        food_serving: [null, null, null, null, null],
        obstacles: [null, null, null, null, null],
        khokho: [null, null, null, null, null],
        debate: [null, null, null, null, null],
        quiz: [null, null, null, null, null],
        agriculture: [null, null, null, null, null],
        sports: [null, null, null, null, null],
        team_building: [null, null, null, null, null],
        patriotism: [null, null, null, null, null],
        spirituality: [null, null, null, null, null]
      }
    };
  });

  // Index grading records by key: `${day}_${activity_key}_${sub_activity_key || 'none'}`
  const recordsMap = {};
  const progressMatrix = {};
  COMPETITION_DAYS.forEach(day => {
    progressMatrix[day] = {};
    FLAT_GRADING_ITEMS.forEach(item => {
      const pKey = `${item.activityKey}_${item.subActivityKey || 'main'}`;
      progressMatrix[day][pKey] = {
        graded: false,
        status: 'pending',
        rank_1_squad: null,
        rank_2_squad: null,
        rank_3_squad: null,
        updated_at: null
      };
    });
  });

  (gradingRecords || []).forEach(record => {
    const dayStr = record.day;
    const actKey = record.activity_key;
    const subKey = record.sub_activity_key || null;
    const dayIdx = COMPETITION_DAYS.indexOf(dayStr);

    if (dayIdx === -1) return; // Invalid day

    const mapKey = `${dayStr}_${actKey}_${subKey || 'none'}`;
    recordsMap[mapKey] = record;

    // Update progress matrix
    const matrixItemKey = `${actKey}_${subKey || 'main'}`;
    if (progressMatrix[dayStr] && progressMatrix[dayStr][matrixItemKey]) {
      const isGraded = Boolean(record.rank_1_squad || record.rank_2_squad || record.rank_3_squad);
      progressMatrix[dayStr][matrixItemKey] = {
        graded: isGraded,
        status: record.status || (isGraded ? 'draft' : 'pending'),
        rank_1_squad: record.rank_1_squad,
        rank_2_squad: record.rank_2_squad,
        rank_3_squad: record.rank_3_squad,
        updated_at: record.updated_at
      };
    }

    // Process scoring for Rank 1, 2, 3
    if (actKey === 'punctuality' && subKey) {
      const subConfig = ACTIVITIES_CONFIG.find(a => a.key === 'punctuality')
        ?.subActivities.find(s => s.key === subKey);
      const subWeight = subConfig ? subConfig.weight : 12.5;

      const r1 = record.rank_1_squad;
      const r2 = record.rank_2_squad;
      const r3 = record.rank_3_squad;

      if (r1 && squadData[r1] && squadData[r1].punctualityDaily[subKey]) {
        squadData[r1].punctualityDaily[subKey][dayIdx] = calculateRankScore(subWeight, 1);
        squadData[r1].punctualityDailyRanks[subKey][dayIdx] = 1;
      }
      if (r2 && squadData[r2] && squadData[r2].punctualityDaily[subKey]) {
        squadData[r2].punctualityDaily[subKey][dayIdx] = calculateRankScore(subWeight, 2);
        squadData[r2].punctualityDailyRanks[subKey][dayIdx] = 2;
      }
      if (r3 && squadData[r3] && squadData[r3].punctualityDaily[subKey]) {
        squadData[r3].punctualityDaily[subKey][dayIdx] = calculateRankScore(subWeight, 3);
        squadData[r3].punctualityDailyRanks[subKey][dayIdx] = 3;
      }
    } else {
      const actConfig = ACTIVITIES_CONFIG.find(a => a.key === actKey && !a.isParent);
      const actWeight = actConfig ? actConfig.weight : 5.0;

      const r1 = record.rank_1_squad;
      const r2 = record.rank_2_squad;
      const r3 = record.rank_3_squad;

      if (r1 && squadData[r1] && squadData[r1].activityDaily[actKey]) {
        squadData[r1].activityDaily[actKey][dayIdx] = calculateRankScore(actWeight, 1);
        squadData[r1].activityDailyRanks[actKey][dayIdx] = 1;
      }
      if (r2 && squadData[r2] && squadData[r2].activityDaily[actKey]) {
        squadData[r2].activityDaily[actKey][dayIdx] = calculateRankScore(actWeight, 2);
        squadData[r2].activityDailyRanks[actKey][dayIdx] = 2;
      }
      if (r3 && squadData[r3] && squadData[r3].activityDaily[actKey]) {
        squadData[r3].activityDaily[actKey][dayIdx] = calculateRankScore(actWeight, 3);
        squadData[r3].activityDailyRanks[actKey][dayIdx] = 3;
      }
    }
  });

  // Calculate final aggregated scores for each squad
  const squadSummaries = {};
  const leaderboardEntries = [];

  squads.forEach(sq => {
    const data = squadData[sq];

    // Punctuality 4 sub-activities 5-day averages
    const fallInFinal = data.punctualityDaily.fall_in.reduce((a, b) => a + b, 0) / numDays;
    const yogaFinal = data.punctualityDaily.yoga.reduce((a, b) => a + b, 0) / numDays;
    const tbFinal = data.punctualityDaily.tb.reduce((a, b) => a + b, 0) / numDays;
    const punctAgriFinal = data.punctualityDaily.agriculture.reduce((a, b) => a + b, 0) / numDays;

    const punctualityTotal = fallInFinal + yogaFinal + tbFinal + punctAgriFinal;

    // Normal activities 5-day averages
    const disciplineFinal = data.activityDaily.discipline.reduce((a, b) => a + b, 0) / numDays;
    const foodServingFinal = data.activityDaily.food_serving.reduce((a, b) => a + b, 0) / numDays;
    const obstaclesFinal = data.activityDaily.obstacles.reduce((a, b) => a + b, 0) / numDays;
    const khokhoFinal = data.activityDaily.khokho.reduce((a, b) => a + b, 0) / numDays;
    const debateFinal = data.activityDaily.debate.reduce((a, b) => a + b, 0) / numDays;
    const quizFinal = data.activityDaily.quiz.reduce((a, b) => a + b, 0) / numDays;
    const mainAgriFinal = data.activityDaily.agriculture.reduce((a, b) => a + b, 0) / numDays; // 5% Main Agriculture
    const sportsFinal = data.activityDaily.sports.reduce((a, b) => a + b, 0) / numDays;
    const teamBuildingFinal = data.activityDaily.team_building.reduce((a, b) => a + b, 0) / numDays;
    const patriotismFinal = data.activityDaily.patriotism.reduce((a, b) => a + b, 0) / numDays;
    const spiritualityFinal = data.activityDaily.spirituality.reduce((a, b) => a + b, 0) / numDays;

    // Overall Score out of 100
    const overallScore =
      punctualityTotal +
      disciplineFinal +
      foodServingFinal +
      obstaclesFinal +
      khokhoFinal +
      debateFinal +
      quizFinal +
      mainAgriFinal +
      sportsFinal +
      teamBuildingFinal +
      patriotismFinal +
      spiritualityFinal;

    const summary = {
      squad: sq,
      punctuality: {
        fall_in: roundScore(fallInFinal),
        yoga: roundScore(yogaFinal),
        tb: roundScore(tbFinal),
        agriculture: roundScore(punctAgriFinal),
        total: roundScore(punctualityTotal),
        max: 50.0,
        daily: data.punctualityDaily,
        dailyRanks: data.punctualityDailyRanks
      },
      activities: {
        discipline: roundScore(disciplineFinal),
        food_serving: roundScore(foodServingFinal),
        obstacles: roundScore(obstaclesFinal),
        khokho: roundScore(khokhoFinal),
        debate: roundScore(debateFinal),
        quiz: roundScore(quizFinal),
        agriculture: roundScore(mainAgriFinal), // Main Agriculture (5%)
        sports: roundScore(sportsFinal),
        team_building: roundScore(teamBuildingFinal),
        patriotism: roundScore(patriotismFinal),
        spirituality: roundScore(spiritualityFinal)
      },
      activityDaily: data.activityDaily,
      activityDailyRanks: data.activityDailyRanks,
      overallScore: roundScore(overallScore),
      overallScoreFormatted: formatScore(overallScore)
    };

    squadSummaries[sq] = summary;

    leaderboardEntries.push({
      squad: sq,
      punctuality: roundScore(punctualityTotal),
      discipline: roundScore(disciplineFinal),
      food_serving: roundScore(foodServingFinal),
      obstacles: roundScore(obstaclesFinal),
      khokho: roundScore(khokhoFinal),
      debate: roundScore(debateFinal),
      quiz: roundScore(quizFinal),
      agriculture: roundScore(mainAgriFinal),
      sports: roundScore(sportsFinal),
      team_building: roundScore(teamBuildingFinal),
      patriotism: roundScore(patriotismFinal),
      spirituality: roundScore(spiritualityFinal),
      overallScore: roundScore(overallScore),
      overallScoreFormatted: formatScore(overallScore),
      _raw: {
        overall: overallScore,
        punctuality: punctualityTotal,
        discipline: disciplineFinal,
        food_serving: foodServingFinal,
        obstacles: obstaclesFinal,
        sports: sportsFinal,
        team_building: teamBuildingFinal,
        patriotism: patriotismFinal,
        spirituality: spiritualityFinal,
        quiz: quizFinal,
        agriculture: mainAgriFinal,
        khokho: khokhoFinal,
        debate: debateFinal
      }
    });
  });

  /**
   * Deterministic Tie-Breaking Order:
   * 1. Higher Overall Score
   * 2. If equal -> Higher Punctuality score
   * 3. If equal -> Higher Discipline score
   * 4. If equal -> Next configured priority: Food Serving, Obstacles, Sports, Team Building, Patriotism, Spirituality, Quiz, Agriculture, Khokho, Debate
   * 5. If still equal -> Canonical Squad Order
   */
  leaderboardEntries.sort((a, b) => {
    // 1. Overall Score
    if (Math.abs(b._raw.overall - a._raw.overall) > 0.00001) {
      return b._raw.overall - a._raw.overall;
    }
    // 2. Punctuality
    if (Math.abs(b._raw.punctuality - a._raw.punctuality) > 0.00001) {
      return b._raw.punctuality - a._raw.punctuality;
    }
    // 3. Discipline
    if (Math.abs(b._raw.discipline - a._raw.discipline) > 0.00001) {
      return b._raw.discipline - a._raw.discipline;
    }
    // 4. Configured priority sequence
    const priorityKeys = [
      'food_serving',
      'obstacles',
      'sports',
      'team_building',
      'patriotism',
      'spirituality',
      'quiz',
      'agriculture',
      'khokho',
      'debate'
    ];
    for (const key of priorityKeys) {
      if (Math.abs(b._raw[key] - a._raw[key]) > 0.00001) {
        return b._raw[key] - a._raw[key];
      }
    }
    // 5. Canonical Squad Order
    const idxA = SQUAD_CANONICAL_NAMES.indexOf(a.squad);
    const idxB = SQUAD_CANONICAL_NAMES.indexOf(b.squad);
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    return a.squad.localeCompare(b.squad);
  });

  // Assign ranks (1 to 10)
  leaderboardEntries.forEach((entry, idx) => {
    entry.rank = idx + 1;
    delete entry._raw; // Clean up internal comparison helper
  });

  const top3 = {
    gold: leaderboardEntries[0] || null,
    silver: leaderboardEntries[1] || null,
    bronze: leaderboardEntries[2] || null
  };

  return {
    leaderboard: leaderboardEntries,
    squadSummaries,
    progressMatrix,
    top3,
    activitiesConfig: ACTIVITIES_CONFIG,
    flatGradingItems: FLAT_GRADING_ITEMS,
    squads
  };
}

module.exports = {
  SQUAD_CANONICAL_NAMES,
  COMPETITION_DAYS,
  ACTIVITIES_CONFIG,
  FLAT_GRADING_ITEMS,
  calculateRankScore,
  roundScore,
  formatScore,
  validateGradingRanks,
  computeComprehensiveScores
};
