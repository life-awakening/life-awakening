const {
  parseFeedbackJson,
  parseSingleRating,
  extractFeedbackRatings,
  computeAggregatedFeedbackAnalytics
} = require('../utils/feedbackRatingExtractor');

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

function runTests() {
  console.log('====================================================');
  console.log('TESTING FEEDBACK RATING EXTRACTOR UTILITY');
  console.log('====================================================\n');

  // 1. parseSingleRating tests
  console.log('--- 1. Testing parseSingleRating ---');
  assert(parseSingleRating(5) === 5, 'Numeric 5 returns 5');
  assert(parseSingleRating(1) === 1, 'Numeric 1 returns 1');
  assert(parseSingleRating(3.5) === 3.5, 'Float 3.5 returns 3.5');
  assert(parseSingleRating(0) === null, 'Out of bounds 0 returns null');
  assert(parseSingleRating(6) === null, 'Out of bounds 6 returns null');
  assert(parseSingleRating("5") === 5, 'String "5" returns 5');
  assert(parseSingleRating("4.2") === 4.2, 'String "4.2" returns 4.2');

  // Likert with prefixes
  assert(parseSingleRating("1 = Not at all typical of me") === 1, 'Likert "1 = ..." returns 1');
  assert(parseSingleRating("5 = Very typical of me") === 5, 'Likert "5 = ..." returns 5');
  assert(parseSingleRating("(5) I completely agree") === 5, 'Likert "(5) ..." returns 5');
  assert(parseSingleRating("(1) I never agree") === 1, 'Likert "(1) ..." returns 1');
  assert(parseSingleRating("4 - Often") === 4, 'Likert "4 - Often" returns 4');
  assert(parseSingleRating("3/5") === 3, 'Likert "3/5" returns 3');

  // Descriptive scale words
  assert(parseSingleRating("Excellent") === 5, '"Excellent" returns 5');
  assert(parseSingleRating("Very Good") === 4, '"Very Good" returns 4');
  assert(parseSingleRating("Good") === 3, '"Good" returns 3');
  assert(parseSingleRating("Average") === 3, '"Average" returns 3');
  assert(parseSingleRating("Fair") === 2, '"Fair" returns 2');
  assert(parseSingleRating("Satisfactory") === 2, '"Satisfactory" returns 2');
  assert(parseSingleRating("Needs Improvement") === 1, '"Needs Improvement" returns 1');
  assert(parseSingleRating("Poor") === 1, '"Poor" returns 1');
  assert(parseSingleRating("Always") === 5, '"Always" returns 5');
  assert(parseSingleRating("Often") === 4, '"Often" returns 4');
  assert(parseSingleRating("Sometimes") === 3, '"Sometimes" returns 3');
  assert(parseSingleRating("Rarely") === 2, '"Rarely" returns 2');
  assert(parseSingleRating("Never") === 1, '"Never" returns 1');

  // Non-rating options MUST return null
  assert(parseSingleRating("No Interaction") === null, '"No Interaction" returns null');
  assert(parseSingleRating("Not Applicable") === null, '"Not Applicable" returns null');
  assert(parseSingleRating("N/A") === null, '"N/A" returns null');
  assert(parseSingleRating("na") === null, '"na" returns null');
  assert(parseSingleRating("—") === null, '"—" returns null');
  assert(parseSingleRating("") === null, 'Empty string returns null');
  assert(parseSingleRating(null) === null, 'null returns null');
  assert(parseSingleRating(undefined) === null, 'undefined returns null');

  // Free text must NOT be blindly converted
  assert(parseSingleRating("The instructors were very supportive and kind.") === null, 'Descriptive text returns null');
  assert(parseSingleRating("I learned to adapt to changes.") === null, 'Descriptive text returns null');

  // 2. parseFeedbackJson tests
  console.log('\n--- 2. Testing parseFeedbackJson ---');
  assert(parseFeedbackJson(null) === null, 'null input returns null');
  assert(parseFeedbackJson('') === null, 'empty string returns null');
  assert(parseFeedbackJson('{ invalid json') === null, 'invalid JSON returns null');
  assert(parseFeedbackJson('{"a": 1}').a === 1, 'valid JSON string parsed');
  assert(parseFeedbackJson({ answers: { a: 2 } }).a === 2, 'answers wrapper unpacked');
  assert(parseFeedbackJson({ responses: { b: 3 } }).b === 3, 'responses wrapper unpacked');

  // 3. extractFeedbackRatings tests
  console.log('\n--- 3. Testing extractFeedbackRatings ---');

  // Pre-LTC payload
  const prePayload = JSON.stringify({
    firstName: 'Aarav',
    ratings: {
      'I ask "why" when I don\'t understand something.': '4 = often',
      'I plan steps before starting a difficult task.': 5,
      'I calm myself down when I\'m upset.': '3 = sometimes'
    },
    orientationRatings: {
      'Arrival session': 4,
      'LTC briefing': 5
    }
  });
  const preRes = extractFeedbackRatings(prePayload, 'Pre-LTC');
  // 4 + 5 + 3 + 4 + 5 = 21 / 5 = 4.2
  assert(preRes.overall_avg === 4.2, `Pre-LTC overall_avg should be 4.2, got ${preRes.overall_avg}`);
  assert(preRes.travel_avg === 4.5, `Pre-LTC travel_avg should be 4.5, got ${preRes.travel_avg}`);
  assert(preRes.faculty_avg === null, `Pre-LTC faculty_avg should be null, got ${preRes.faculty_avg}`);

  // Post-LTC payload with specific facilities
  const postPayload = JSON.stringify({
    ratings: {
      'Goal management': 4,
      'Creative thinking': 4
    },
    facultyRatings: {
      sports: {
        'PT Instructor': 'Excellent', // 5
        'Pillar Head': 'Very Good'   // 4
      },
      patriotism: {
        'Coordinator': 'No Interaction' // null
      }
    },
    facilitiesRatings: {
      'Accommodation': 'Good', // 3
      'Food and Dining': 'Very Good', // 4
      'Transport': 5, // 5
      'Medical Support': 4
    }
  });
  const postRes = extractFeedbackRatings(postPayload, 'Post-LTC');
  // Faculty: 5, 4 -> 4.5
  assert(postRes.faculty_avg === 4.5, `Post-LTC faculty_avg should be 4.5, got ${postRes.faculty_avg}`);
  // Accommodation: 3
  assert(postRes.accommodation_avg === 3.0, `Post-LTC accommodation_avg should be 3, got ${postRes.accommodation_avg}`);
  // Food: 4
  assert(postRes.food_avg === 4.0, `Post-LTC food_avg should be 4, got ${postRes.food_avg}`);
  // Travel: 5
  assert(postRes.travel_avg === 5.0, `Post-LTC travel_avg should be 5, got ${postRes.travel_avg}`);
  // Overall: 4, 4, 5, 4, 3, 4, 5, 4 = 33 / 8 = 4.125 -> 4.13
  assert(postRes.overall_avg === 4.13, `Post-LTC overall_avg should be 4.13, got ${postRes.overall_avg}`);

  // Service-Trainers payload
  const servicePayload = JSON.stringify({
    arrival_orientation: {
      welcome_reception: 4,
      security_bag_checking: 5
    },
    facilities_admin: {
      boarding_lodging: 'Excellent', // 5
      food_dining: 'Good' // 3
    },
    trainers: {
      sports: {
        knowledge: 5,
        discipline: 5
      }
    },
    overall_suggestions: 'Great military discipline.'
  });
  const serviceRes = extractFeedbackRatings(servicePayload, 'Service-Trainers');
  assert(serviceRes.travel_avg === 4.5, `Service travel_avg should be 4.5, got ${serviceRes.travel_avg}`);
  assert(serviceRes.accommodation_avg === 5.0, `Service accommodation_avg should be 5.0, got ${serviceRes.accommodation_avg}`);
  assert(serviceRes.food_avg === 3.0, `Service food_avg should be 3.0, got ${serviceRes.food_avg}`);
  assert(serviceRes.faculty_avg === 5.0, `Service faculty_avg should be 5.0, got ${serviceRes.faculty_avg}`);

  // Missing ratings / plain text only payload
  const textOnlyPayload = JSON.stringify({
    comments: 'Just general feedback without ratings'
  });
  const emptyRes = extractFeedbackRatings(textOnlyPayload, 'General');
  assert(emptyRes.overall_avg === null, 'Empty ratings should return overall_avg=null, NOT 5');
  assert(emptyRes.faculty_avg === null, 'Empty ratings should return faculty_avg=null');
  assert(emptyRes.total_ratings_count === 0, 'Empty ratings should return total_ratings_count=0');

  // 4. computeAggregatedFeedbackAnalytics tests
  console.log('\n--- 4. Testing computeAggregatedFeedbackAnalytics ---');
  const rows = [
    { id: 1, category: 'Pre-LTC', role: 'student', name: 'Student 1', created_at: new Date(), feedback_text: prePayload },
    { id: 2, category: 'Post-LTC', role: 'student', name: 'Student 2', created_at: new Date(), feedback_text: postPayload },
    { id: 3, category: 'Service-Trainers', role: 'student', name: 'Student 3', created_at: new Date(), feedback_text: servicePayload },
    { id: 4, category: 'General', role: 'student', name: 'Student 4', created_at: new Date(), feedback_text: textOnlyPayload }
  ];

  const agg = computeAggregatedFeedbackAnalytics(rows);
  assert(agg.summary.total_submissions === 4, 'total_submissions should be 4');
  assert(agg.summary.rated_submissions === 3, 'rated_submissions should be 3 (excluding text-only)');
  assert(typeof agg.summary.overall_avg === 'number', 'overall_avg should be a number');
  assert(agg.summary.faculty_avg !== null, 'faculty_avg should be computed');
  assert(agg.summary.accommodation_avg !== null, 'accommodation_avg should be computed');
  assert(agg.summary.food_avg !== null, 'food_avg should be computed');
  assert(agg.summary.travel_avg !== null, 'travel_avg should be computed');
  assert(agg.categoryRatings.length === 4, 'categoryRatings should have 4 categories');

  // Comments should each have their individual computed ratings attached
  assert(agg.comments[0].average_rating === 4.2, 'Comment 1 should have average_rating 4.2');
  assert(agg.comments[1].average_rating === 4.13, 'Comment 2 should have average_rating 4.13');
  assert(agg.comments[3].average_rating === null, 'Comment 4 should have average_rating null');

  console.log('\n====================================================');
  console.log('🎉 ALL FEEDBACK RATING EXTRACTOR TESTS PASSED!');
  console.log('====================================================\n');
}

runTests();
