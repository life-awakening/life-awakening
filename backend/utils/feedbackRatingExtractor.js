/**
 * Feedback Rating Extractor Utility
 *
 * Robustly parses and extracts quantitative ratings and qualitative metrics from feedback_text JSON
 * across Pre-LTC, Post-LTC, and Service-Trainers questionnaires.
 *
 * Requirements:
 * 1. Safely handle various JSON structures (nested, answers wrapper, raw objects, malformed strings).
 * 2. Strictly respect question scales (1–5).
 * 3. Never blindly convert arbitrary descriptive text to numbers.
 * 4. Never assign fake default ratings (such as 5) when ratings are missing.
 * 5. Handle non-rating answers (e.g., 'No Interaction', 'N/A', 'Not Applicable') as null.
 */

/**
 * Safely parse feedback_text string or object into an unwrapped answers/data dictionary.
 * Returns null if input is missing or malformed.
 */
function parseFeedbackJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    return raw.answers || raw.responses || raw;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed.answers || parsed.responses || parsed;
  } catch (_) {
    // Malformed JSON or legacy plain text comment
    return null;
  }
}

/**
 * Convert a single answer value into a 1.0–5.0 numeric rating.
 * Returns null if the value is not a valid rating.
 */
function parseSingleRating(val) {
  if (val === null || val === undefined) return null;

  // Direct number
  if (typeof val === 'number') {
    if (Number.isFinite(val) && val >= 1 && val <= 5) {
      return val;
    }
    return null;
  }

  const s = String(val).trim();
  if (!s) return null;

  // Non-rating options that must NOT be counted
  const nonRatingLower = s.toLowerCase();
  if (
    nonRatingLower === 'no interaction' ||
    nonRatingLower === 'not applicable' ||
    nonRatingLower === 'n/a' ||
    nonRatingLower === 'na' ||
    nonRatingLower === 'none' ||
    nonRatingLower === '—' ||
    nonRatingLower === '-'
  ) {
    return null;
  }

  // Exact numeric string (e.g., "5", "4", "3.5")
  if (/^[1-5](\.[0-9]+)?$/.test(s)) {
    const n = parseFloat(s);
    return (n >= 1 && n <= 5) ? n : null;
  }

  // Likert scale string with number prefix, e.g.:
  // "1 = Not at all typical of me", "5 = Very typical of me"
  // "(5) I completely agree", "(1) I never agree"
  // "4 = often", "1 = never", "3 - Average", "5/5"
  const prefixMatch = s.match(/^[\(\[]?([1-5](?:\.[0-9]+)?)[\)\]]?\s*([=:\/\-]|out of|\b)/i);
  if (prefixMatch && prefixMatch[1]) {
    const num = parseFloat(prefixMatch[1]);
    if (num >= 1 && num <= 5) return num;
  }

  // Standard qualitative rating words (case-insensitive)
  switch (nonRatingLower) {
    case 'excellent':
    case 'outstanding':
    case 'always':
    case 'completely agree':
    case 'strongly agree':
      return 5;
    case 'very good':
    case 'highly effective':
    case 'often':
    case 'usually agree':
    case 'agree':
      return 4;
    case 'good':
    case 'effective':
    case 'average':
    case 'sometimes':
    case 'partly agree':
    case 'somewhat typical':
    case 'neutral':
      return 3;
    case 'satisfactory':
    case 'fair':
    case 'developing':
    case 'rarely':
    case 'usually do not agree':
    case 'disagree':
    case 'not very typical':
      return 2;
    case 'needs improvement':
    case 'poor':
    case 'never':
    case 'never agree':
    case 'strongly disagree':
    case 'not at all typical':
      return 1;
    default:
      // Unrecognized descriptive string - do NOT convert
      return null;
  }
}

/**
 * Extract categorized ratings and averages from a single feedback record.
 *
 * @param {string|object} feedbackText - The raw feedback_text column value.
 * @param {string} [category] - Feedback category ('Pre-LTC', 'Post-LTC', 'Service-Trainers', etc.)
 * @returns {object} Extracted ratings: { overall_avg, faculty_avg, accommodation_avg, food_avg, travel_avg, total_ratings_count }
 */
function extractFeedbackRatings(feedbackText, category) {
  const data = parseFeedbackJson(feedbackText);

  const result = {
    overall_avg: null,
    faculty_avg: null,
    accommodation_avg: null,
    food_avg: null,
    travel_avg: null,
    total_ratings_count: 0
  };

  if (!data) return result;

  const allRatings = [];
  const facultyRatings = [];
  const accommodationRatings = [];
  const foodRatings = [];
  const travelRatings = [];

  const addRating = (val, targetArray) => {
    const r = parseSingleRating(val);
    if (r !== null) {
      allRatings.push(r);
      if (targetArray) targetArray.push(r);
    }
  };

  // 1. Traverse Self-Assessment / General ratings object (e.g. data.ratings = { statement: rating })
  if (data.ratings && typeof data.ratings === 'object') {
    Object.values(data.ratings).forEach(val => addRating(val));
  }

  // 2. Pre-LTC Specific Questions
  if (data.orientationRatings && typeof data.orientationRatings === 'object') {
    Object.values(data.orientationRatings).forEach(val => {
      addRating(val, travelRatings); // Orientation & arrival session
    });
  }
  if (data.excitedPillars && typeof data.excitedPillars === 'object') {
    Object.values(data.excitedPillars).forEach(val => addRating(val));
  }

  // 3. Post-LTC Specific Questions
  // 3a. Faculty member ratings (Q23–Q27)
  if (data.facultyRatings && typeof data.facultyRatings === 'object') {
    Object.values(data.facultyRatings).forEach(pillarFac => {
      if (pillarFac && typeof pillarFac === 'object') {
        Object.values(pillarFac).forEach(val => addRating(val, facultyRatings));
      } else {
        addRating(pillarFac, facultyRatings);
      }
    });
  }

  // 3b. Residential leaders (Q28)
  if (data.leadersRatings && typeof data.leadersRatings === 'object') {
    Object.values(data.leadersRatings).forEach(val => addRating(val, facultyRatings));
  }

  // 3c. Pillar activities liked (Q22)
  if (data.pillarActivitiesLiked && typeof data.pillarActivitiesLiked === 'object') {
    Object.values(data.pillarActivitiesLiked).forEach(val => addRating(val));
  }

  // 3d. Post-LTC Facilities ratings (Q29)
  if (data.facilitiesRatings && typeof data.facilitiesRatings === 'object') {
    Object.entries(data.facilitiesRatings).forEach(([key, val]) => {
      const k = key.toLowerCase();
      if (k.includes('accommodation') || k.includes('cleanliness') || k.includes('hygiene') || k.includes('lodging') || k.includes('room')) {
        addRating(val, accommodationRatings);
      } else if (k.includes('food') || k.includes('dining') || k.includes('meal') || k.includes('water')) {
        addRating(val, foodRatings);
      } else if (k.includes('transport') || k.includes('travel') || k.includes('bus') || k.includes('arrival')) {
        addRating(val, travelRatings);
      } else {
        addRating(val);
      }
    });
  }

  // 4. Service & Trainers Specific Questions
  // 4a. Trainers ratings (data.trainers or data.trainerRatings)
  const trainersObj = data.trainers || data.trainerRatings;
  if (trainersObj && typeof trainersObj === 'object') {
    Object.values(trainersObj).forEach(pillarTrainers => {
      if (pillarTrainers && typeof pillarTrainers === 'object') {
        Object.values(pillarTrainers).forEach(val => addRating(val, facultyRatings));
      } else {
        addRating(pillarTrainers, facultyRatings);
      }
    });
  }

  // 4b. Arrival and Orientation (data.arrival_orientation or data.arrivalRatings)
  const arrivalObj = data.arrival_orientation || data.arrivalRatings;
  if (arrivalObj && typeof arrivalObj === 'object') {
    Object.values(arrivalObj).forEach(val => addRating(val, travelRatings));
  }

  // 4c. Facilities and Administration (data.facilities_admin)
  const facAdminObj = data.facilities_admin;
  if (facAdminObj && typeof facAdminObj === 'object') {
    Object.entries(facAdminObj).forEach(([key, val]) => {
      const k = key.toLowerCase();
      if (k.includes('boarding') || k.includes('lodging') || k.includes('accommodation')) {
        addRating(val, accommodationRatings);
      } else if (k.includes('food') || k.includes('dining')) {
        addRating(val, foodRatings);
      } else if (k.includes('travel') || k.includes('transport')) {
        addRating(val, travelRatings);
      } else {
        addRating(val);
      }
    });
  }

  // 4d. Activity-based ratings (data.activity_based or data.activityRatings)
  const actObj = data.activity_based || data.activityRatings;
  if (actObj && typeof actObj === 'object') {
    Object.values(actObj).forEach(val => addRating(val));
  }

  // Helper to compute mean
  const avgOf = (arr) => {
    if (!arr || arr.length === 0) return null;
    const sum = arr.reduce((acc, n) => acc + n, 0);
    return parseFloat((sum / arr.length).toFixed(2));
  };

  result.overall_avg = avgOf(allRatings);
  result.faculty_avg = avgOf(facultyRatings);
  result.accommodation_avg = avgOf(accommodationRatings);
  result.food_avg = avgOf(foodRatings);
  result.travel_avg = avgOf(travelRatings);
  result.total_ratings_count = allRatings.length;

  return result;
}

/**
 * Aggregates feedback records into the complete analytics response expected by
 * TrendsAnalyticsModule and Admin dashboards.
 *
 * @param {Array<object>} feedbackRows - Array of { id, feedback_text, category, role, name, created_at, ... }
 * @returns {object} { summary, categoryRatings, comments, wordCloud }
 */
function computeAggregatedFeedbackAnalytics(feedbackRows) {
  const rows = Array.isArray(feedbackRows) ? feedbackRows : [];

  let overallSum = 0;
  let overallCount = 0;
  let facultySum = 0;
  let facultyCount = 0;
  let accommodationSum = 0;
  let accommodationCount = 0;
  let foodSum = 0;
  let foodCount = 0;
  let travelSum = 0;
  let travelCount = 0;

  const categoryMap = {}; // { [category]: { sum: 0, count: 0, total_submissions: 0 } }
  const comments = [];
  const textCorpus = [];

  rows.forEach(row => {
    const cat = String(row.category || 'General').trim() || 'General';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { sum: 0, count: 0, total_submissions: 0 };
    }
    categoryMap[cat].total_submissions++;

    const ratings = extractFeedbackRatings(row.feedback_text, row.category);

    if (ratings.overall_avg !== null) {
      overallSum += ratings.overall_avg;
      overallCount++;
      categoryMap[cat].sum += ratings.overall_avg;
      categoryMap[cat].count++;
    }
    if (ratings.faculty_avg !== null) {
      facultySum += ratings.faculty_avg;
      facultyCount++;
    }
    if (ratings.accommodation_avg !== null) {
      accommodationSum += ratings.accommodation_avg;
      accommodationCount++;
    }
    if (ratings.food_avg !== null) {
      foodSum += ratings.food_avg;
      foodCount++;
    }
    if (ratings.travel_avg !== null) {
      travelSum += ratings.travel_avg;
      travelCount++;
    }

    // Attach computed ratings to the comment row for frontend consumption
    comments.push({
      ...row,
      average_rating: ratings.overall_avg,
      faculty_rating: ratings.faculty_avg,
      accommodation_rating: ratings.accommodation_avg,
      food_rating: ratings.food_avg,
      travel_rating: ratings.travel_avg
    });

    if (row.feedback_text) {
      textCorpus.push(String(row.feedback_text));
    }
  });

  const calcAvg = (sum, count) => {
    if (count === 0) return null;
    return parseFloat((sum / count).toFixed(2));
  };

  const summary = {
    overall_avg: calcAvg(overallSum, overallCount),
    faculty_avg: calcAvg(facultySum, facultyCount),
    accommodation_avg: calcAvg(accommodationSum, accommodationCount),
    food_avg: calcAvg(foodSum, foodCount),
    travel_avg: calcAvg(travelSum, travelCount),
    total_submissions: rows.length,
    rated_submissions: overallCount
  };

  const categoryRatings = Object.entries(categoryMap).map(([category, stats]) => ({
    category,
    rating_avg: stats.count > 0 ? parseFloat((stats.sum / stats.count).toFixed(2)) : null,
    count: stats.total_submissions
  }));

  // Build Word Cloud list from qualitative feedback text
  const allText = textCorpus.join(' ');
  const stopwords = new Set([
    'the', 'and', 'a', 'of', 'to', 'in', 'is', 'that', 'it', 'was', 'for', 'on', 'with', 'as', 'at', 'by', 'an', 'be',
    'this', 'are', 'from', 'or', 'at', 'which', 'all', 'we', 'my', 'our', 'had', 'have', 'were', 'been', 'there', 'they',
    'ratings', 'answers', 'feedback', 'responses', 'firstname', 'middlename', 'surname', 'schoolname', 'departmentname'
  ]);
  const wordCounts = {};
  allText.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).forEach(word => {
    if (word.length > 3 && !stopwords.has(word) && !/^\d+$/.test(word)) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });
  const wordCloud = Object.keys(wordCounts)
    .map(word => ({ text: word, value: wordCounts[word] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 40);

  return {
    summary,
    categoryRatings,
    comments,
    wordCloud
  };
}

module.exports = {
  parseFeedbackJson,
  parseSingleRating,
  extractFeedbackRatings,
  computeAggregatedFeedbackAnalytics
};
