const XLSX = require('xlsx');

// Canonical Squad Names in LTC
const SQUAD_CANONICAL_NAMES = [
  'Aditya', 'Bhaskar', 'Dinkar', 'Divakar', 'Mitra', 
  'Martand', 'Prabhakar', 'Ravi', 'Surya', 'Tejonidhi'
];

// 4 Immersion Days
const SQUAD_PERF_DAYS = ['Day 2', 'Day 3', 'Day 4', 'Day 5'];

// Helper to normalize squad name (e.g. Diwakar <-> Divakar)
const normalizeSquadName = (name) => {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (trimmed.toLowerCase() === 'diwakar') return 'Divakar';
  const found = SQUAD_CANONICAL_NAMES.find(s => s.toLowerCase() === trimmed.toLowerCase());
  return found || trimmed;
};

// Helper to parse Fall-In positions mapping from JSON, key-value, string, or array
const parseFallInPositions = (raw) => {
  const result = {};
  if (!raw) return result;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([sq, pos]) => {
      const canonical = normalizeSquadName(sq);
      const p = parseInt(pos, 10);
      if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p >= 1 && p <= 10) {
        result[canonical] = p;
      }
    });
    return result;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return result;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([sq, pos]) => {
            const canonical = normalizeSquadName(sq);
            const p = parseInt(pos, 10);
            if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p >= 1 && p <= 10) {
              result[canonical] = p;
            }
          });
          return result;
        }
      } catch (e) {
        // Fall through
      }
    }

    if (trimmed.includes(':')) {
      trimmed.split(',').forEach(part => {
        const [sqRaw, posRaw] = part.split(':');
        if (sqRaw && posRaw) {
          const canonical = normalizeSquadName(sqRaw.trim());
          const p = parseInt(posRaw.trim(), 10);
          if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p >= 1 && p <= 10) {
            result[canonical] = p;
          }
        }
      });
      return result;
    }

    // Legacy comma-separated format: "Bhaskar, Dinkar, Divakar"
    const items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    items.forEach((sqRaw, idx) => {
      const canonical = normalizeSquadName(sqRaw);
      const p = idx + 1;
      if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p <= 10) {
        result[canonical] = p;
      }
    });
    return result;
  }

  if (Array.isArray(raw)) {
    raw.forEach((item, idx) => {
      if (typeof item === 'object' && item !== null && item.squad) {
        const canonical = normalizeSquadName(item.squad);
        const p = parseInt(item.position || item.rank, 10);
        if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p >= 1 && p <= 10) {
          result[canonical] = p;
        }
      } else if (typeof item === 'string') {
        const canonical = normalizeSquadName(item);
        const p = idx + 1;
        if (canonical && SQUAD_CANONICAL_NAMES.includes(canonical) && p <= 10) {
          result[canonical] = p;
        }
      }
    });
    return result;
  }

  return result;
};

// Ranking Points System
// Rank 1 = 10, Rank 2 = 9, Rank 3 = 8, Rank 4 = 7, Rank 5 = 6,
// Rank 6 = 5, Rank 7 = 4, Rank 8 = 3, Rank 9 = 2, Rank 10 = 1
const RANK_POINTS = {
  1: 10,
  2: 9,
  3: 8,
  4: 7,
  5: 6,
  6: 5,
  7: 4,
  8: 3,
  9: 2,
  10: 1
};

const getRankPoints = (rank) => RANK_POINTS[rank] || 0;

// Special Activity Selection Rules
const ACTIVITY_SELECTION_RULES = {
  'Quiz': {
    requiredDay: 'Day 3',
    requiredCount: 2,
    pointsPerSquad: 5,
    maxPoints: 10,
    rank: 1,
    label: 'Select 2 Squads (5 pts each, max 10)',
    description: 'Select 2 squads out of 10 (5 pts each)'
  },
  'Debate': {
    requiredDay: 'Day 4',
    requiredCount: 5,
    pointsPerSquad: 2,
    maxPoints: 10,
    rank: 1,
    label: 'Select 5 Squads (2 pts each, max 10)',
    description: 'Select 5 squads out of 10 (2 pts each)'
  },
  'Kho Kho': {
    requiredDay: 'Day 4',
    requiredCount: 5,
    pointsPerSquad: 2,
    maxPoints: 10,
    rank: 1,
    label: 'Select 5 Squads (2 pts each, max 10)',
    description: 'Select 5 squads out of 10 (2 pts each)'
  },
  'KhoKho': {
    requiredDay: 'Day 4',
    requiredCount: 5,
    pointsPerSquad: 2,
    maxPoints: 10,
    rank: 1,
    label: 'Select 5 Squads (2 pts each, max 10)',
    description: 'Select 5 squads out of 10 (2 pts each)'
  },
  'Obstacle': {
    requiredDay: 'Day 5',
    requiredCount: 10,
    isRanked: true,
    rank: 10,
    label: 'Rank 1–10 Squads (10 to 1 pts)',
    description: 'Rank all 10 squads (Rank 1 to Rank 10)'
  },
  'Obstacles': {
    requiredDay: 'Day 5',
    requiredCount: 10,
    isRanked: true,
    rank: 10,
    label: 'Rank 1–10 Squads (10 to 1 pts)',
    description: 'Rank all 10 squads (Rank 1 to Rank 10)'
  },
  'Food Serving': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 10,
    maxPoints: 10,
    rank: 1,
    label: 'Select 1 Squad (Winner = 10 pts)',
    description: 'Select 1 squad (Winner = 10 pts)'
  },
  'FoodServing': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 10,
    maxPoints: 10,
    rank: 1,
    label: 'Select 1 Squad (Winner = 10 pts)',
    description: 'Select 1 squad (Winner = 10 pts)'
  },
  'Room Cleaning': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 10,
    maxPoints: 10,
    rank: 1,
    label: 'Select 1 Squad (Winner = 10 pts)',
    description: 'Select 1 squad (Winner = 10 pts)'
  },
  'Room Cleanliness': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 10,
    maxPoints: 10,
    rank: 1,
    label: 'Select 1 Squad (Winner = 10 pts)',
    description: 'Select 1 squad (Winner = 10 pts)'
  },
  'RoomCleaning': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 10,
    maxPoints: 10,
    rank: 1,
    label: 'Select 1 Squad (Winner = 10 pts)',
    description: 'Select 1 squad (Winner = 10 pts)'
  },
  'Agriculture': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 2,
    maxPoints: 2,
    rank: 1,
    label: 'Select 1 Squad (Winner = 2 pts)',
    description: 'Select 1 squad (Winner = 2 pts)'
  },
  'Sports': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 2,
    maxPoints: 2,
    rank: 1,
    label: 'Select 1 Squad (Winner = 2 pts)',
    description: 'Select 1 squad (Winner = 2 pts)'
  },
  'Team Building': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 2,
    maxPoints: 2,
    rank: 1,
    label: 'Select 1 Squad (Winner = 2 pts)',
    description: 'Select 1 squad (Winner = 2 pts)'
  },
  'Patriotism': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 2,
    maxPoints: 2,
    rank: 1,
    label: 'Select 1 Squad (Winner = 2 pts)',
    description: 'Select 1 squad (Winner = 2 pts)'
  },
  'Spirituality': {
    requiredDay: 'Day 5',
    requiredCount: 1,
    pointsPerSquad: 2,
    maxPoints: 2,
    rank: 1,
    label: 'Select 1 Squad (Winner = 2 pts)',
    description: 'Select 1 squad (Winner = 2 pts)'
  }
};

const getActivitySelectionRule = (dayOrTitle, maybeTitle) => {
  const title = maybeTitle !== undefined ? maybeTitle : dayOrTitle;
  const day = maybeTitle !== undefined ? dayOrTitle : null;
  if (!title) return null;
  const t = String(title).trim();
  let rule = ACTIVITY_SELECTION_RULES[t];
  if (!rule) {
    const lower = t.toLowerCase();
    for (const [key, r] of Object.entries(ACTIVITY_SELECTION_RULES)) {
      if (key.toLowerCase() === lower) {
        rule = r;
        break;
      }
    }
  }
  if (rule && day && rule.requiredDay && String(rule.requiredDay).toLowerCase() !== String(day).toLowerCase()) {
    return null;
  }
  return rule || null;
};

// All 14 Evaluated Categories with Exact Weights (Total = 100% / 1.00)
const SQUAD_CATEGORIES = [
  {
    key: 'punctuality',
    label: 'Punctuality',
    weight: 40.0, // 40%
    weightDecimal: 0.40,
    activities: [
      'Punctuality - Fall In', 'Punctuality - Yoga', 'Punctuality - TB 1',
      'Punctuality - Agri 1', 'Punctuality - Afternoon', 'Punctuality - TB 2',
      'Punctuality - Agri 2'
    ]
  },
  { key: 'discipline', label: 'Discipline', weight: 5.0, weightDecimal: 0.05, activities: ['Discipline'] },
  { key: 'room_cleaning', label: 'Room Cleaning', weight: 5.0, weightDecimal: 0.05, activities: ['Room Cleaning', 'Room Cleanliness'] },
  { key: 'food_serving', label: 'Food Serving', weight: 5.0, weightDecimal: 0.05, activities: ['Food Serving'] },
  { key: 'coordination', label: 'Coordination, Courtesy, Maintain Discipline, Hygiene', weight: 5.0, weightDecimal: 0.05, activities: ['Coordination, Courtesy, Maintain Discipline, Hygiene', 'Coordination, Courtesy, Maintain Discipline, Hygene', 'Coordination & Courtesy', 'Coordination', 'Courtesy'] },
  { key: 'obstacles', label: 'Obstacles', weight: 5.0, weightDecimal: 0.05, activities: ['Obstacle', 'Obstacles'] },
  { key: 'khokho', label: 'KhoKho', weight: 2.5, weightDecimal: 0.025, activities: ['Kho Kho', 'KhoKho', 'Kho-Kho', 'Khokho'] },
  { key: 'debate', label: 'Debate', weight: 2.5, weightDecimal: 0.025, activities: ['Debate'] },
  { key: 'quiz', label: 'Quiz', weight: 5.0, weightDecimal: 0.05, activities: ['Quiz'] },
  { key: 'agriculture', label: 'Agriculture', weight: 5.0, weightDecimal: 0.05, activities: ['Agriculture'] },
  { key: 'sports', label: 'Sports', weight: 5.0, weightDecimal: 0.05, activities: ['Sports'] },
  { key: 'team_building', label: 'Team Building', weight: 5.0, weightDecimal: 0.05, activities: ['Team Building'] },
  { key: 'patriotism', label: 'Patriotism', weight: 5.0, weightDecimal: 0.05, activities: ['Patriotism', 'Patrotism'] },
  { key: 'spirituality', label: 'Spirituality', weight: 5.0, weightDecimal: 0.05, activities: ['Spirituality'] }
];

// 7 Punctuality Sub-Activities (Day 2 to Day 4)
const PUNCTUALITY_SUB_ACTIVITIES = [
  { id: 'punc_fall_in', title: 'Punctuality - Fall In', displayName: 'Fall In', category: 'Punctuality', order: 1 },
  { id: 'punc_yoga', title: 'Punctuality - Yoga', displayName: 'Yoga', category: 'Punctuality', order: 2 },
  { id: 'punc_tb1', title: 'Punctuality - TB 1', displayName: 'TB (Morning)', category: 'Punctuality', order: 3 },
  { id: 'punc_agri1', title: 'Punctuality - Agri 1', displayName: 'Agri (Morning)', category: 'Punctuality', order: 4 },
  { id: 'punc_afternoon', title: 'Punctuality - Afternoon', displayName: 'Afternoon', category: 'Punctuality', order: 5 },
  { id: 'punc_tb2', title: 'Punctuality - TB 2', displayName: 'TB (Evening)', category: 'Punctuality', order: 6 },
  { id: 'punc_agri2', title: 'Punctuality - Agri 2', displayName: 'Agri (Evening)', category: 'Punctuality', order: 7 }
];

// Day 5 Punctuality (4 Sub-Activities: Fall In, Yoga, TB 1, Afternoon)
const DAY_5_PUNCTUALITY = [
  { id: 'punc_d5_fall_in', title: 'Punctuality - Fall In', displayName: 'Fall In', category: 'Punctuality', order: 1 },
  { id: 'punc_d5_yoga', title: 'Punctuality - Yoga', displayName: 'Yoga', category: 'Punctuality', order: 2 },
  { id: 'punc_d5_tb1', title: 'Punctuality - TB 1', displayName: 'TB (Morning)', category: 'Punctuality', order: 3 },
  { id: 'punc_d5_afternoon', title: 'Punctuality - Afternoon', displayName: 'Afternoon', category: 'Punctuality', order: 4 }
];

// Day 2 Activities: 7 Punctuality Activities
const DAY_2_ACTIVITIES = [
  ...PUNCTUALITY_SUB_ACTIVITIES
];

// Day 3 Activities: 7 Punctuality Activities + Quiz (Select 2 squads, 5 pts each, max 10)
const DAY_3_ACTIVITIES = [
  ...PUNCTUALITY_SUB_ACTIVITIES,
  {
    id: 'act_quiz',
    title: 'Quiz',
    displayName: 'Quiz',
    category: 'General',
    order: 8,
    selectionRule: ACTIVITY_SELECTION_RULES['Quiz']
  }
];

// Day 4 Activities: 7 Punctuality Activities + Debate (5 squads, 2 pts each) + Kho Kho (5 squads, 2 pts each)
const DAY_4_ACTIVITIES = [
  ...PUNCTUALITY_SUB_ACTIVITIES,
  {
    id: 'act_debate',
    title: 'Debate',
    displayName: 'Debate',
    category: 'General',
    order: 8,
    selectionRule: ACTIVITY_SELECTION_RULES['Debate']
  },
  {
    id: 'act_khokho',
    title: 'Kho Kho',
    displayName: 'Kho Kho',
    category: 'General',
    order: 9,
    selectionRule: ACTIVITY_SELECTION_RULES['Kho Kho']
  }
];

// Day 5 Activities:
// - 4 Punctuality
// - Obstacle (Rank 1-10)
// - Food Serving, Discipline, Room Cleaning, Coordination & Courtesy (1st/2nd/3rd = 10/9/8 pts)
// - Day 5 Five Pillars (1 winner each = 2 pts each): Agriculture, Sports, Team Building, Patriotism, Spirituality
const DAY_5_ACTIVITIES = [
  ...DAY_5_PUNCTUALITY,
  {
    id: 'act_obstacle',
    title: 'Obstacle',
    displayName: 'Obstacle',
    category: 'General',
    order: 5,
    selectionRule: ACTIVITY_SELECTION_RULES['Obstacle']
  },
  {
    id: 'act_food_serving',
    title: 'Food Serving',
    displayName: 'Food Serving',
    category: 'General',
    order: 6,
    selectionRule: ACTIVITY_SELECTION_RULES['Food Serving']
  },
  { id: 'act_discipline', title: 'Discipline', displayName: 'Discipline', category: 'General', order: 7 },
  {
    id: 'act_room_cleaning',
    title: 'Room Cleaning',
    displayName: 'Room Cleaning',
    category: 'General',
    order: 8,
    selectionRule: ACTIVITY_SELECTION_RULES['Room Cleaning']
  },
  { id: 'act_coordination', title: 'Coordination, Courtesy, Maintain Discipline, Hygiene', displayName: 'Coordination & Courtesy', category: 'General', order: 9 },
  { id: 'act_agriculture', title: 'Agriculture', displayName: 'Agriculture', category: 'General', order: 10, selectionRule: ACTIVITY_SELECTION_RULES['Agriculture'] },
  { id: 'act_sports', title: 'Sports', displayName: 'Sports', category: 'General', order: 11, selectionRule: ACTIVITY_SELECTION_RULES['Sports'] },
  { id: 'act_team_building', title: 'Team Building', displayName: 'Team Building', category: 'General', order: 12, selectionRule: ACTIVITY_SELECTION_RULES['Team Building'] },
  { id: 'act_patriotism', title: 'Patriotism', displayName: 'Patriotism', category: 'General', order: 13, selectionRule: ACTIVITY_SELECTION_RULES['Patriotism'] },
  { id: 'act_spirituality', title: 'Spirituality', displayName: 'Spirituality', category: 'General', order: 14, selectionRule: ACTIVITY_SELECTION_RULES['Spirituality'] }
];

const DAY_ACTIVITIES_MAP = {
  'Day 2': DAY_2_ACTIVITIES,
  'Day 3': DAY_3_ACTIVITIES,
  'Day 4': DAY_4_ACTIVITIES,
  'Day 5': DAY_5_ACTIVITIES
};

/**
 * Authoritative scoring engine for LTC Squad Performance.
 * 
 * Rules:
 * 1. Activity Scoring:
 *    - Quiz: Select 2 squads out of 10. Each = 5 pts. Max = 10 pts.
 *    - Debate: Select 5 squads out of 10. Each = 2 pts. Max = 10 pts.
 *    - Kho Kho: Select 5 squads out of 10. Each = 2 pts. Max = 10 pts.
 *    - Day 5 Five Pillars (Agriculture, Sports, Team Building, Patriotism, Spirituality):
 *      Exactly 1 squad selected for each pillar. Winner = 2 pts. Total 5 pillars = 10 raw pts.
 *    - Obstacles: Rank 1 to 10 (10 down to 1 pt).
 *    - Standard activities (Discipline, Room Cleaning, Food Serving, Coordination):
 *      1st = 10 pts, 2nd = 9 pts, 3rd = 8 pts.
 * 
 * 2. Punctuality (40%):
 *    - Medal/Rank based: Rank all 10 squads 1–10 by Gold > Silver > Bronze priority.
 *    - Rank 1 = 10 pts, Rank 2 = 9 pts, ..., Rank 10 = 1 pt.
 *    - Punctuality contributes 40% (0.40) to Overall Score.
 *    - Best Captain is determined ONLY by Punctuality ranking.
 * 
 * 3. Remaining 60% (Point-wise):
 *    - Discipline: 5%
 *    - Room Cleaning: 5%
 *    - Food Serving: 5%
 *    - Coordination, Courtesy, Maintain Discipline, Hygiene: 5%
 *    - Obstacles: 5%
 *    - Kho Kho: 2.5%
 *    - Debate: 2.5%
 *    - Quiz: 5%
 *    - Agriculture: 5%
 *    - Sports: 5%
 *    - Team Building: 5%
 *    - Patriotism: 5%
 *    - Spirituality: 5%
 * 
 * 4. Overall Score = Punctuality 40% + remaining 60% point-wise components.
 *    Highest Overall Score = Best Squad.
 * 
 * 5. Overall Standings:
 *    - Ranked by Overall Score (highest to lowest).
 *    - Displays Gold, Silver, Bronze medal counts.
 */
function calculateSquadPerformance(batchSelections, demographics = null, isDayOnly = false) {
  const squadData = {};
  SQUAD_CANONICAL_NAMES.forEach(sq => {
    squadData[sq] = {
      squad: sq,
      first_count: 0,  // Gold 🥇
      second_count: 0, // Silver 🥈
      third_count: 0,  // Bronze 🥉
      total_first: 0,
      total_second: 0,
      total_third: 0,
      count: 0,
      obstacle_rank: null,
      obstacle_points: 0,
      punctuality_rank: null,
      punctuality_points: 0,
      punc_gold: 0,
      punc_silver: 0,
      punc_bronze: 0,
      punc_total_points: 0,
      punc_fall_in_points: 0,
      punc_medal_points: 0,
      punc_last_win: null,
      medal_points: 0, // (Gold * 10) + (Silver * 9) + (Bronze * 8)
      points: 0,       // Alias for medal_points
      lastWinTimestamp: null,
      dayStats: {
        'Day 2': { gold: 0, silver: 0, bronze: 0 },
        'Day 3': { gold: 0, silver: 0, bronze: 0 },
        'Day 4': { gold: 0, silver: 0, bronze: 0 },
        'Day 5': { gold: 0, silver: 0, bronze: 0 }
      },
      rawCategoryScores: {},
      categoryScores: {},
      categoryContributions: {},
      categoryWeightedScores: {},
      overall_score: 0
    };

    SQUAD_CATEGORIES.forEach(cat => {
      squadData[sq].rawCategoryScores[cat.key] = 0;
      squadData[sq].categoryScores[cat.key] = 0;
      squadData[sq].categoryContributions[cat.key] = 0;
      squadData[sq].categoryWeightedScores[cat.key] = 0;
    });
  });

  // Demographics helper for weighted Fall-In
  const totalBoys = demographics?.totalBoys || 0;
  const totalGirls = demographics?.totalGirls || 0;
  const squadDemographics = demographics?.squads || {};

  // Track raw activity scores for each category
  const categoryActivityPoints = {};
  const categoryActivityCounts = {};
  SQUAD_CATEGORIES.forEach(cat => {
    categoryActivityPoints[cat.key] = {};
    categoryActivityCounts[cat.key] = 0;
    SQUAD_CANONICAL_NAMES.forEach(sq => {
      categoryActivityPoints[cat.key][sq] = [];
    });
  });

  const seenActivities = new Set();

  (batchSelections || []).forEach(sel => {
    const d = sel.day;
    const act = sel.activity_title || sel.activity_name || '';
    const key = `${d}_${act}`;

    const rule = getActivitySelectionRule(d, act);
    const isPunc = String(act).toLowerCase().includes('punctuality');
    const isFallIn = String(act).trim().toLowerCase() === 'punctuality - fall in' || String(act).trim().toLowerCase() === 'fall in';

    if (isFallIn) {
      // ─────────────────────────────────────────────────────────────────────────
      // FINAL FALL-IN WEIGHTED SCORING (INDEPENDENT POSITIONS 1–10 FOR BOYS & GIRLS)
      // Rank/Position is not unique: Multiple squads can have the same position
      // Position multipliers: 1st = 10, 2nd = 9, 3rd = 8, ..., 10th = 1 (11 - pos)
      // Medals: Pos 1 = Gold, Pos 2 = Silver, Pos 3 = Bronze (Pos 4-10 = points only)
      // ─────────────────────────────────────────────────────────────────────────
      const rawBoys = sel.first_squad !== undefined && sel.first_squad !== null ? sel.first_squad : (sel.squad_rank_1 || sel.squad_name);
      const boysPositions = parseFallInPositions(rawBoys);

      const rawGirls = sel.second_squad !== undefined && sel.second_squad !== null ? sel.second_squad : sel.squad_rank_2;
      const girlsPositions = parseFallInPositions(rawGirls);

      // Calculate squad-wise Fall-In scores for this activity
      // Internal Squad Gender Proportion Model:
      // Squad Total = Squad Boys + Squad Girls
      // Boys Share = Squad Boys / Squad Total
      // Girls Share = Squad Girls / Squad Total
      // Boys Score = Boys Share × Boys Rank Points (Rank 1=10 down to Rank 10=1)
      // Girls Score = Girls Share × Girls Rank Points (Rank 1=10 down to Rank 10=1)
      // Final Fall-In Score = Boys Score + Girls Score
      const activityScores = {};
      SQUAD_CANONICAL_NAMES.forEach(sq => {
        let sqScore = 0;
        const sqBoys = squadDemographics[sq]?.boys ?? 0;
        const sqGirls = squadDemographics[sq]?.girls ?? 0;
        const sqTotal = sqBoys + sqGirls;

        const boysShare = sqTotal > 0 ? (sqBoys / sqTotal) : 0.5;
        const girlsShare = sqTotal > 0 ? (sqGirls / sqTotal) : 0.5;

        const bPos = boysPositions[sq];
        if (bPos >= 1 && bPos <= 10) {
          const bMultiplier = 11 - bPos;
          sqScore += (boysShare * bMultiplier);
        }

        const gPos = girlsPositions[sq];
        if (gPos >= 1 && gPos <= 10) {
          const gMultiplier = 11 - gPos;
          sqScore += (girlsShare * gMultiplier);
        }

        activityScores[sq] = Number(sqScore.toFixed(4));
        squadData[sq].punc_fall_in_points += activityScores[sq];
      });

      // Rank participating squads by final Fall-In Total score for this specific Fall-In activity
      // Participating squads: squads that had boys/girls selection or earned points
      const participatingSquads = SQUAD_CANONICAL_NAMES.filter(sq => {
        const hasPos = (boysPositions[sq] !== undefined && boysPositions[sq] !== null) ||
                       (girlsPositions[sq] !== undefined && girlsPositions[sq] !== null);
        return hasPos || (activityScores[sq] > 0);
      });

      participatingSquads.sort((a, b) => {
        if (Math.abs(activityScores[b] - activityScores[a]) > 0.0001) {
          return activityScores[b] - activityScores[a];
        }
        return a.localeCompare(b);
      });

      const squadFallInRanks = {};
      participatingSquads.forEach((sq, idx) => {
        let rank = idx + 1;
        if (idx > 0) {
          const prevSq = participatingSquads[idx - 1];
          if (Math.abs(activityScores[sq] - activityScores[prevSq]) < 0.0001) {
            rank = squadFallInRanks[prevSq];
          }
        }
        squadFallInRanks[sq] = rank;

        if (!squadData[sq]) return;
        squadData[sq].count += 1;

        if (rank === 1) {
          squadData[sq].first_count += 1;
          squadData[sq].total_first += 1;
          squadData[sq].punc_gold += 1;
          squadData[sq].punc_last_win = sel.selected_at;
          squadData[sq].lastWinTimestamp = sel.selected_at;
          if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].gold += 1;
        } else if (rank === 2) {
          squadData[sq].second_count += 1;
          squadData[sq].total_second += 1;
          squadData[sq].punc_silver += 1;
          if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].silver += 1;
        } else if (rank === 3) {
          squadData[sq].third_count += 1;
          squadData[sq].total_third += 1;
          squadData[sq].punc_bronze += 1;
          if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].bronze += 1;
        }
      });

      // Record activity points for Punctuality
      if (!seenActivities.has(key)) {
        seenActivities.add(key);
        categoryActivityCounts['punctuality'] += 1;
      }
      SQUAD_CANONICAL_NAMES.forEach(sq => {
        categoryActivityPoints['punctuality'][sq].push(activityScores[sq]);
      });

    } else if (rule) {
      // Special rule: Quiz (2 squads), Debate (5 squads), Kho Kho (5 squads), Obstacle (Rank 1-10), Day 5 Pillars (1 squad)
      let squadsArr = [];
      if (typeof sel.first_squad === 'string') {
        squadsArr = sel.first_squad.split(',').map(s => normalizeSquadName(s.trim())).filter(Boolean);
      } else if (Array.isArray(sel.first_squad)) {
        squadsArr = sel.first_squad.map(s => normalizeSquadName(s)).filter(Boolean);
      } else if (sel.squad_name && String(sel.squad_name).trim()) {
        squadsArr = [normalizeSquadName(sel.squad_name)].filter(Boolean);
      }
      squadsArr = Array.from(new Set(squadsArr));
      if (squadsArr.length === 0) return;

      if (rule.isRanked) {
        // Obstacle Activity: Rank 1 to 10 with exact 10 down to 1 points
        squadsArr.forEach((sq, idx) => {
          const rank = idx + 1;
          const pts = RANK_POINTS[rank] || 0;
          if (squadData[sq]) {
            squadData[sq].obstacle_rank = rank;
            squadData[sq].obstacle_points = pts;
            squadData[sq].count += 1;
            squadData[sq].lastWinTimestamp = sel.selected_at;
            if (rank === 1) {
              squadData[sq].first_count += 1;
              squadData[sq].total_first += 1;
              if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].gold += 1;
            } else if (rank === 2) {
              squadData[sq].second_count += 1;
              squadData[sq].total_second += 1;
              if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].silver += 1;
            } else if (rank === 3) {
              squadData[sq].third_count += 1;
              squadData[sq].total_third += 1;
              if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].bronze += 1;
            }
          }
        });
      } else {
        // Winner squad(s) for multi-squad activity or 1-winner pillar
        squadsArr.forEach(sq => {
          if (squadData[sq]) {
            squadData[sq].first_count += 1;
            squadData[sq].total_first += 1;
            squadData[sq].count += 1;
            squadData[sq].lastWinTimestamp = sel.selected_at;
            if (squadData[sq].dayStats[d]) squadData[sq].dayStats[d].gold += 1;
          }
        });
      }
    } else {
      // Standard activity: 1st, 2nd, 3rd
      const s1 = (sel.first_squad !== undefined && sel.first_squad !== null && String(sel.first_squad).trim())
        ? normalizeSquadName(sel.first_squad)
        : (sel.squad_name && String(sel.squad_name).trim() ? normalizeSquadName(sel.squad_name) : '');
      const s2 = (sel.second_squad && String(sel.second_squad).trim()) ? normalizeSquadName(sel.second_squad) : '';
      const s3 = (sel.third_squad && String(sel.third_squad).trim()) ? normalizeSquadName(sel.third_squad) : '';

      if (!s1 && !s2 && !s3) return;

      if (s1 && squadData[s1]) {
        squadData[s1].first_count += 1;
        squadData[s1].total_first += 1;
        squadData[s1].count += 1;
        squadData[s1].lastWinTimestamp = sel.selected_at;
        if (squadData[s1].dayStats[d]) squadData[s1].dayStats[d].gold += 1;
        if (isPunc) {
          squadData[s1].punc_gold += 1;
          squadData[s1].punc_last_win = sel.selected_at;
        }
      }
      if (s2 && squadData[s2]) {
        squadData[s2].second_count += 1;
        squadData[s2].total_second += 1;
        if (squadData[s2].dayStats[d]) squadData[s2].dayStats[d].silver += 1;
        if (isPunc) {
          squadData[s2].punc_silver += 1;
        }
      }
      if (s3 && squadData[s3]) {
        squadData[s3].third_count += 1;
        squadData[s3].total_third += 1;
        if (squadData[s3].dayStats[d]) squadData[s3].dayStats[d].bronze += 1;
        if (isPunc) {
          squadData[s3].punc_bronze += 1;
        }
      }
    }

    // Match activity to Category (for non-Fall-In activities)
    if (!isFallIn) {
      let matchedCatKey = null;
      if (isPunc) {
        matchedCatKey = 'punctuality';
      } else {
        const matchedCat = SQUAD_CATEGORIES.find(c => 
          c.key !== 'punctuality' && c.activities.some(a => a.toLowerCase() === String(act).toLowerCase())
        );
        if (matchedCat) matchedCatKey = matchedCat.key;
      }

      if (matchedCatKey) {
        if (!seenActivities.has(key)) {
          seenActivities.add(key);
          categoryActivityCounts[matchedCatKey] += 1;
        }

        if (rule) {
          let squadsArr = [];
          if (typeof sel.first_squad === 'string') {
            squadsArr = sel.first_squad.split(',').map(s => normalizeSquadName(s.trim())).filter(Boolean);
          } else if (Array.isArray(sel.first_squad)) {
            squadsArr = sel.first_squad.map(s => normalizeSquadName(s)).filter(Boolean);
          } else if (sel.squad_name) {
            squadsArr = [normalizeSquadName(sel.squad_name)].filter(Boolean);
          }
          squadsArr = Array.from(new Set(squadsArr));

          if (rule.isRanked) {
            // Obstacle: Rank 1 = 10, Rank 2 = 9, Rank 3 = 8, ..., Rank 10 = 1
            SQUAD_CANONICAL_NAMES.forEach(sq => {
              const idx = squadsArr.indexOf(sq);
              if (idx >= 0) {
                const rank = idx + 1;
                const pts = RANK_POINTS[rank] || 0;
                categoryActivityPoints[matchedCatKey][sq].push(pts);
              } else {
                categoryActivityPoints[matchedCatKey][sq].push(0);
              }
            });
          } else {
            // Rule points: Quiz = 5, Debate = 2, Kho Kho = 2, Day 5 Pillars = 2
            const ptsPerSquad = rule.pointsPerSquad || 2;
            const set = new Set(squadsArr);
            SQUAD_CANONICAL_NAMES.forEach(sq => {
              if (set.has(sq)) categoryActivityPoints[matchedCatKey][sq].push(ptsPerSquad);
              else categoryActivityPoints[matchedCatKey][sq].push(0);
            });
          }
        } else {
          const s1 = (sel.first_squad !== undefined && sel.first_squad !== null && String(sel.first_squad).trim())
            ? normalizeSquadName(sel.first_squad)
            : (sel.squad_name && String(sel.squad_name).trim() ? normalizeSquadName(sel.squad_name) : '');
          const s2 = (sel.second_squad && String(sel.second_squad).trim()) ? normalizeSquadName(sel.second_squad) : '';
          const s3 = (sel.third_squad && String(sel.third_squad).trim()) ? normalizeSquadName(sel.third_squad) : '';

          SQUAD_CANONICAL_NAMES.forEach(sq => {
            if (s1 === sq) categoryActivityPoints[matchedCatKey][sq].push(RANK_POINTS[1]);      // 10 pts
            else if (s2 === sq) categoryActivityPoints[matchedCatKey][sq].push(RANK_POINTS[2]); // 9 pts
            else if (s3 === sq) categoryActivityPoints[matchedCatKey][sq].push(RANK_POINTS[3]); // 8 pts
            else categoryActivityPoints[matchedCatKey][sq].push(0);
          });
        }
      }
    }
  });

  // Calculate Punctuality Total Points and Medal Points
  SQUAD_CANONICAL_NAMES.forEach(sq => {
    const puncGold = squadData[sq].punc_gold;
    const puncSilver = squadData[sq].punc_silver;
    const puncBronze = squadData[sq].punc_bronze;
    squadData[sq].punc_medal_points = (puncGold * 10) + (puncSilver * 9) + (puncBronze * 8);

    const ptsList = categoryActivityPoints['punctuality'][sq] || [];
    const totalPuncPts = ptsList.reduce((sum, p) => sum + (Number(p) || 0), 0);
    squadData[sq].punc_total_points = Number(totalPuncPts.toFixed(4));
  });

  // Identify participating squads: ONLY squads that have actual saved punctuality selections/points
  const participatingPuncSquads = SQUAD_CANONICAL_NAMES.filter(sq => {
    return (
      squadData[sq].punc_gold > 0 ||
      squadData[sq].punc_silver > 0 ||
      squadData[sq].punc_bronze > 0 ||
      squadData[sq].punc_total_points > 0 ||
      squadData[sq].punc_fall_in_points > 0
    );
  });

  // Rank ONLY participating squads (Unselected squads receive NO rank and 0 contribution)
  // Priority 1: Punctuality Gold medals
  // Priority 2: Punctuality Silver medals
  // Priority 3: Punctuality Bronze medals
  // Priority 4: Total Punctuality Points (including decimal Fall-In points)
  // Priority 5: Total Punctuality Medal Points
  // Priority 6: Earliest Punctuality last win timestamp
  // Priority 7: Alphabetical (tie-breaker for consistent ordering)
  participatingPuncSquads.sort((a, b) => {
    // Priority 1: Punctuality Gold medals
    if (squadData[b].punc_gold !== squadData[a].punc_gold) {
      return squadData[b].punc_gold - squadData[a].punc_gold;
    }
    // Priority 2: Punctuality Silver medals
    if (squadData[b].punc_silver !== squadData[a].punc_silver) {
      return squadData[b].punc_silver - squadData[a].punc_silver;
    }
    // Priority 3: Punctuality Bronze medals
    if (squadData[b].punc_bronze !== squadData[a].punc_bronze) {
      return squadData[b].punc_bronze - squadData[a].punc_bronze;
    }
    // Priority 4: Total Punctuality Points
    if (Math.abs(squadData[b].punc_total_points - squadData[a].punc_total_points) > 0.0001) {
      return squadData[b].punc_total_points - squadData[a].punc_total_points;
    }
    // Priority 5: Total Punctuality Medal Points
    if (squadData[b].punc_medal_points !== squadData[a].punc_medal_points) {
      return squadData[b].punc_medal_points - squadData[a].punc_medal_points;
    }
    // Priority 6: Earliest Punctuality last win timestamp
    if (squadData[a].punc_last_win && squadData[b].punc_last_win) {
      const timeA = new Date(squadData[a].punc_last_win).getTime();
      const timeB = new Date(squadData[b].punc_last_win).getTime();
      if (timeA !== timeB) return timeA - timeB;
    }
    return a.localeCompare(b);
  });

  // Assign ranks and points to participating squads with tie handling
  participatingPuncSquads.forEach((sq, idx) => {
    let rank = idx + 1;
    if (idx > 0) {
      const prevSq = participatingPuncSquads[idx - 1];
      const prevData = squadData[prevSq];
      const curData = squadData[sq];
      const sameGold = curData.punc_gold === prevData.punc_gold;
      const sameSilver = curData.punc_silver === prevData.punc_silver;
      const sameBronze = curData.punc_bronze === prevData.punc_bronze;
      const sameTotalPts = Math.abs(curData.punc_total_points - prevData.punc_total_points) < 0.0001;
      const sameMedalPts = curData.punc_medal_points === prevData.punc_medal_points;
      let sameTimestamp = false;
      if (curData.punc_last_win && prevData.punc_last_win) {
        sameTimestamp = new Date(curData.punc_last_win).getTime() === new Date(prevData.punc_last_win).getTime();
      } else {
        sameTimestamp = (!curData.punc_last_win && !prevData.punc_last_win);
      }
      if (sameGold && sameSilver && sameBronze && sameTotalPts && sameMedalPts && sameTimestamp) {
        rank = prevData.punctuality_rank;
      }
    }

    squadData[sq].punctuality_rank = rank;
    // For Best Squad / Overall Standings scoring:
    // Use the squad's actual earned numerical points, NOT discrete rank points (10, 9, 8, 7...)
    const numPuncActs = categoryActivityCounts['punctuality'] || 1;
    const ptsList = categoryActivityPoints['punctuality'][sq] || [];
    const actualPuncPts = ptsList.length > 0 ? (ptsList.reduce((sum, p) => sum + (Number(p) || 0), 0) / (numPuncActs > 0 ? numPuncActs : 1)) : 0;

    squadData[sq].punctuality_points = Number(actualPuncPts.toFixed(4));
    squadData[sq].rawCategoryScores.punctuality = Number(actualPuncPts.toFixed(4));
    const puncWeight = isDayOnly ? 0.10 : 0.40;
    const weighted = Number((actualPuncPts * puncWeight).toFixed(4));
    squadData[sq].categoryScores.punctuality = weighted;
    squadData[sq].categoryContributions.punctuality = weighted;
    squadData[sq].categoryWeightedScores.punctuality = weighted;
  });

  // For unselected squads: Strictly 0 points, 0 contribution, and null rank
  SQUAD_CANONICAL_NAMES.forEach(sq => {
    if (!participatingPuncSquads.includes(sq)) {
      squadData[sq].punctuality_rank = null;
      squadData[sq].punctuality_points = 0;
      squadData[sq].rawCategoryScores.punctuality = 0;
      squadData[sq].categoryScores.punctuality = 0;
      squadData[sq].categoryContributions.punctuality = 0;
      squadData[sq].categoryWeightedScores.punctuality = 0;
    }
  });

  // Calculate Non-Punctuality Category Scores (Point-wise: 60%)
  SQUAD_CATEGORIES.forEach(cat => {
    if (cat.key === 'punctuality') return;

    SQUAD_CANONICAL_NAMES.forEach(sq => {
      const ptsList = categoryActivityPoints[cat.key][sq] || [];
      let rawCategoryScore = 0;
      if (ptsList.length > 0) {
        rawCategoryScore = Math.max(...ptsList, 0);
      }
      squadData[sq].rawCategoryScores[cat.key] = Number(rawCategoryScore.toFixed(2));
      const weightedScore = rawCategoryScore * cat.weightDecimal;
      squadData[sq].categoryScores[cat.key] = Number(weightedScore.toFixed(4));
      squadData[sq].categoryContributions[cat.key] = Number(weightedScore.toFixed(4));
      squadData[sq].categoryWeightedScores[cat.key] = Number(weightedScore.toFixed(4));
    });
  });

  // If in overall calculation mode (isDayOnly = false), calculate each day's independent performance
  // and synthesize Overall Score as the exact sum of daily contributions: Day 2 + Day 3 + Day 4 + Day 5
  let dayLeaderboards = {};
  if (!isDayOnly) {
    const dayResults = {};
    SQUAD_PERF_DAYS.forEach(d => {
      const daySelections = (batchSelections || []).filter(s => s.day === d);
      const dayRes = calculateSquadPerformance(daySelections, demographics, true);
      dayResults[d] = dayRes;
      dayLeaderboards[d] = dayRes.leaderboard;
    });

    // Synthesize each squad's Overall Punctuality from the 4 daily 10% contributions
    SQUAD_CANONICAL_NAMES.forEach(sq => {
      let overallPuncWeighted = 0;
      squadData[sq].dayScores = {};
      SQUAD_PERF_DAYS.forEach(d => {
        const dPunc = dayResults[d]?.squadData?.[sq]?.categoryScores?.punctuality || 0;
        overallPuncWeighted += dPunc;
        const dScore = dayResults[d]?.squadData?.[sq]?.overall_score || 0;
        squadData[sq].dayScores[d] = dScore;
        if (squadData[sq].dayStats[d]) {
          squadData[sq].dayStats[d].score = dScore;
        }
      });

      squadData[sq].categoryScores.punctuality = Number(overallPuncWeighted.toFixed(4));
      squadData[sq].categoryContributions.punctuality = Number(overallPuncWeighted.toFixed(4));
      squadData[sq].categoryWeightedScores.punctuality = Number(overallPuncWeighted.toFixed(4));
      squadData[sq].rawCategoryScores.punctuality = squadData[sq].punctuality_points || 0;
    });
  }

  // Calculate Overall Score = Sum of all 14 weighted category scores
  // In overall mode, categoryScores.punctuality is sum of 4 daily 10% punctuality scores,
  // making overall_score strictly equal to Day 2 + Day 3 + Day 4 + Day 5.
  SQUAD_CANONICAL_NAMES.forEach(sq => {
    let totalScore = 0;
    SQUAD_CATEGORIES.forEach(cat => {
      totalScore += squadData[sq].categoryScores[cat.key] || 0;
    });
    squadData[sq].overall_score = Number(totalScore.toFixed(2));
  });

  // Calculate Total Medal Points: (Gold * 10) + (Silver * 9) + (Bronze * 8)
  SQUAD_CANONICAL_NAMES.forEach(sq => {
    const gold = squadData[sq].first_count;
    const silver = squadData[sq].second_count;
    const bronze = squadData[sq].third_count;
    const medalPoints = (gold * RANK_POINTS[1]) + (silver * RANK_POINTS[2]) + (bronze * RANK_POINTS[3]);
    squadData[sq].medal_points = medalPoints;
    squadData[sq].points = medalPoints;
  });

  // SORT LEADERBOARD: Ranked by OVERALL SCORE (highest to lowest)
  // 1. Highest Overall Score
  // 2. Highest Punctuality Score (Rank 1 better than Rank 2)
  // 3. Highest Gold medals
  // 4. Highest Silver medals
  // 5. Highest Bronze medals
  // 6. Earliest last win timestamp
  // 7. Canonical squad alphabetical
  const leaderboard = Object.values(squadData).sort((a, b) => {
    // Priority 1: Overall Score
    if (Math.abs(b.overall_score - a.overall_score) > 0.0001) {
      return b.overall_score - a.overall_score;
    }
    // Priority 2: Punctuality rank
    if (a.punctuality_rank && b.punctuality_rank && a.punctuality_rank !== b.punctuality_rank) {
      return a.punctuality_rank - b.punctuality_rank;
    }
    // Priority 3: Gold medals
    if (b.first_count !== a.first_count) {
      return b.first_count - a.first_count;
    }
    // Priority 4: Silver medals
    if (b.second_count !== a.second_count) {
      return b.second_count - a.second_count;
    }
    // Priority 5: Bronze medals
    if (b.third_count !== a.third_count) {
      return b.third_count - a.third_count;
    }
    // Priority 6: Earliest last win timestamp
    if (a.lastWinTimestamp && b.lastWinTimestamp) {
      const timeA = new Date(a.lastWinTimestamp).getTime();
      const timeB = new Date(b.lastWinTimestamp).getTime();
      if (timeA !== timeB) return timeA - timeB;
    }
    return a.squad.localeCompare(b.squad);
  });

  const obstacleStandings = SQUAD_CANONICAL_NAMES
    .map(sq => ({
      squad: sq,
      rank: squadData[sq].obstacle_rank || null,
      points: squadData[sq].obstacle_points || 0,
      weightedScore: Number(((squadData[sq].obstacle_points || 0) * 0.05).toFixed(4))
    }))
    .sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      if (a.rank) return -1;
      if (b.rank) return 1;
      return a.squad.localeCompare(b.squad);
    });

  const result = {
    squadData,
    leaderboard,
    obstacleStandings,
    categories: SQUAD_CATEGORIES,
    days: SQUAD_PERF_DAYS,
    dayActivitiesMap: DAY_ACTIVITIES_MAP
  };

  if (!isDayOnly) {
    result.dayLeaderboards = dayLeaderboards;
  }

  return result;
}

/**
 * Builds the official clean detailed score sheet Excel Workbook:
 * - Sheet 1: "Squad Performance"
 *   Columns: Squad | Punctuality | Discipline | Room Cleaning | Food Serving | Coordination/Courtesy/Maintain Discipline/Hygiene | Obstacles | Kho Kho | Debate | Quiz | Agriculture | Sports | Team Building | Patriotism | Spirituality | Overall Score
 *   Shows ONLY actual earned points/numbers in activity columns.
 *   Shows final numeric calculated Overall Score in the final column.
 * - Sheet 2: "Scorecard" (Day 2 to Day 5 Activity Entries)
 * - Sheet 3: "Overall Standings" (Ranked by Overall Score)
 * - Sheet 4: "Obstacle Standings" (Rank 1 to 10 Results & Points)
 */
function generateSquadPerformanceExcelBuffer(batchInfo, scoreResult) {
  const wb = XLSX.utils.book_new();
  const { squadData, leaderboard } = scoreResult;

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 1: Squad Performance (Detailed Score Sheet)
  // ───────────────────────────────────────────────────────────────────────────
  const headers = [
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

  const scoreRows = [headers];

  SQUAD_CANONICAL_NAMES.forEach((sq) => {
    const item = leaderboard.find(l => l.squad === sq) || squadData[sq] || {};
    const row = [
      `Squad ${sq}`,
      item.rawCategoryScores?.punctuality || 0,
      item.rawCategoryScores?.discipline || 0,
      item.rawCategoryScores?.room_cleaning || 0,
      item.rawCategoryScores?.food_serving || 0,
      item.rawCategoryScores?.coordination || 0,
      item.rawCategoryScores?.obstacles || 0,
      item.rawCategoryScores?.khokho || 0,
      item.rawCategoryScores?.debate || 0,
      item.rawCategoryScores?.quiz || 0,
      item.rawCategoryScores?.agriculture || 0,
      item.rawCategoryScores?.sports || 0,
      item.rawCategoryScores?.team_building || 0,
      item.rawCategoryScores?.patriotism || 0,
      item.rawCategoryScores?.spirituality || 0,
      Number((item.overall_score || 0).toFixed(2))
    ];
    scoreRows.push(row);
  });

  const wsPerformance = XLSX.utils.aoa_to_sheet(scoreRows);
  XLSX.utils.book_append_sheet(wb, wsPerformance, 'Overall Score');

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 2: Scorecard (Day 2 to Day 5 Activity Entries)
  // ───────────────────────────────────────────────────────────────────────────
  const scRows = [
    ['Life Transformation Centre (LTC) - Squad Performance Scorecard'],
    [`Batch: ${batchInfo?.name || 'Active Batch'} | Year: ${batchInfo?.year || new Date().getFullYear()}`],
    ['Detailed Activity Scorecard (Punctuality 40%, Point-wise Activities 60%)'],
    []
  ];

  SQUAD_PERF_DAYS.forEach(d => {
    const acts = DAY_ACTIVITIES_MAP[d] || [];
    scRows.push([`=== ${d} (${acts.length} Activities) ===`]);
    scRows.push(['Squad Name', 'Gold (1st)', 'Silver (2nd)', 'Bronze (3rd)']);

    SQUAD_CANONICAL_NAMES.forEach(sq => {
      const stats = squadData[sq]?.dayStats[d] || { gold: 0, silver: 0, bronze: 0 };
      scRows.push([
        `Squad ${sq}`,
        stats.gold,
        stats.silver,
        stats.bronze
      ]);
    });
    if (d === 'Day 5' && scoreResult.obstacleStandings) {
      scRows.push([]);
      scRows.push(['--- Day 5 Obstacle Competition Official Standings (Rank 1 to 10) ---']);
      scRows.push(['Rank', 'Squad Name', 'Points', 'Category Weight', 'Weighted Score', 'Medal']);
      SQUAD_CANONICAL_NAMES.forEach(sq => {
        const item = (scoreResult.obstacleStandings || []).find(o => o.squad === sq) || { squad: sq, points: 0, weightedScore: 0, rank: null };
        const medal = item.rank === 1 ? '🥇 Gold' : (item.rank === 2 ? '🥈 Silver' : (item.rank === 3 ? '🥉 Bronze' : '-'));
        scRows.push([
          item.rank ? `Rank ${item.rank}` : 'Unranked',
          `Squad ${item.squad || sq}`,
          item.points || 0,
          '5%',
          item.weightedScore || 0,
          medal
        ]);
      });
    }
    scRows.push([]);
  });

  const wsScorecard = XLSX.utils.aoa_to_sheet(scRows);
  XLSX.utils.book_append_sheet(wb, wsScorecard, 'Scorecard');

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 3: Overall Standings (In Canonical Squad Order with Calculated Rank)
  // ───────────────────────────────────────────────────────────────────────────
  const lbRows = [
    ['LTC Squad Championship Standings'],
    [`Batch: ${batchInfo?.name || 'Active Batch'}`],
    [],
    ['Rank', 'Squad Name', '🥇 1st (Gold)', '🥈 2nd (Silver)', '🥉 3rd (Bronze)', 'Overall Score', 'Day 2 Gold', 'Day 3 Gold', 'Day 4 Gold', 'Day 5 Gold']
  ];

  SQUAD_CANONICAL_NAMES.forEach((sq) => {
    const item = leaderboard.find(l => l.squad === sq) || {};
    const rankIdx = leaderboard.findIndex(l => l.squad === sq);
    const hasActivity = (item.overall_score || 0) > 0 || (item.first_count || 0) > 0 || (item.count || 0) > 0;
    let rank = '-';
    if (hasActivity && rankIdx >= 0) {
      if (rankIdx === 0) {
        rank = 1;
      } else {
        const prev = leaderboard[rankIdx - 1];
        const scoreDiff = Math.abs((item.overall_score || 0) - (prev.overall_score || 0));
        const samePunc = (item.punctuality_rank ?? 99) === (prev.punctuality_rank ?? 99);
        const sameFirst = (item.first_count || 0) === (prev.first_count || 0);
        if (scoreDiff < 0.0001 && samePunc && sameFirst) {
          const firstMatch = leaderboard.findIndex(x =>
            Math.abs((x.overall_score || 0) - (item.overall_score || 0)) < 0.0001 &&
            (x.punctuality_rank ?? 99) === (item.punctuality_rank ?? 99) &&
            (x.first_count || 0) === (item.first_count || 0)
          );
          rank = firstMatch >= 0 ? firstMatch + 1 : 1;
        } else {
          rank = rankIdx + 1;
        }
      }
    }
    lbRows.push([
      rank,
      `Squad ${sq}`,
      item.first_count || 0,
      item.second_count || 0,
      item.third_count || 0,
      Number((item.overall_score || 0).toFixed(2)),
      item.dayStats?.['Day 2']?.gold || 0,
      item.dayStats?.['Day 3']?.gold || 0,
      item.dayStats?.['Day 4']?.gold || 0,
      item.dayStats?.['Day 5']?.gold || 0
    ]);
  });

  const wsLeaderboard = XLSX.utils.aoa_to_sheet(lbRows);
  XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Leaderboard');

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 4: Obstacle Standings (In Canonical Squad Order with Results & Points)
  // ───────────────────────────────────────────────────────────────────────────
  const obstRows = [
    ['Life Transformation Centre (LTC) - Day 5 Obstacle Competition Official Standings'],
    [`Batch: ${batchInfo?.name || 'Active Batch'} | Year: ${batchInfo?.year || new Date().getFullYear()}`],
    ['Obstacle Points System: Rank 1=10pts, Rank 2=9pts, Rank 3=8pts, Rank 4=7pts, Rank 5=6pts, Rank 6=5pts, Rank 7=4pts, Rank 8=3pts, Rank 9=2pts, Rank 10=1pt'],
    [],
    ['Rank', 'Squad Name', 'Points Awarded', 'Category Weight', 'Weighted Score (5%)', 'Medal Status']
  ];

  SQUAD_CANONICAL_NAMES.forEach(sq => {
    const item = (scoreResult.obstacleStandings || []).find(o => o.squad === sq) || { squad: sq, points: 0, weightedScore: 0, rank: null };
    const medal = item.rank === 1 ? '🥇 Gold (1st)' : (item.rank === 2 ? '🥈 Silver (2nd)' : (item.rank === 3 ? '🥉 Bronze (3rd)' : (item.rank ? `Rank ${item.rank}` : 'Participant')));
    obstRows.push([
      item.rank ? `Rank ${item.rank}` : 'Unranked',
      `Squad ${sq}`,
      item.points || 0,
      '5%',
      item.weightedScore || 0,
      medal
    ]);
  });

  const wsObstacle = XLSX.utils.aoa_to_sheet(obstRows);
  XLSX.utils.book_append_sheet(wb, wsObstacle, 'Obstacle Standings');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  SQUAD_CANONICAL_NAMES,
  SQUAD_PERF_DAYS,
  SQUAD_CATEGORIES,
  RANK_POINTS,
  getRankPoints,
  ACTIVITY_SELECTION_RULES,
  getActivitySelectionRule,
  PUNCTUALITY_SUB_ACTIVITIES,
  DAY_5_PUNCTUALITY,
  DAY_2_ACTIVITIES,
  DAY_3_ACTIVITIES,
  DAY_4_ACTIVITIES,
  DAY_5_ACTIVITIES,
  DAY_ACTIVITIES_MAP,
  parseFallInPositions,
  calculateSquadPerformance,
  generateSquadPerformanceExcelBuffer
};
