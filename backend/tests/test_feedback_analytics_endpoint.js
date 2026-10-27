const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/db');
const adminController = require('../controllers/adminController');
const superadminController = require('../controllers/superadminController');

function assert(condition, msg) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(msg);
  } else {
    console.log(`✅ PASSED: ${msg}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('TESTING FEEDBACK ANALYTICS ENDPOINTS (ADMIN & SUPERADMIN)');
  console.log('====================================================\n');

  // Create mock res object
  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.body = data;
        return this;
      }
    };
  }

  // 1. Test Admin getFeedbackAnalytics
  console.log('--- 1. Testing adminController.getFeedbackAnalytics ---');
  const mockReqAdmin = {};
  const mockResAdmin = createMockRes();

  await adminController.getFeedbackAnalytics(mockReqAdmin, mockResAdmin);
  assert(mockResAdmin.statusCode === 200, `Admin response status must be 200, got ${mockResAdmin.statusCode}`);
  assert(mockResAdmin.body !== null, 'Admin response body must not be null');
  assert(typeof mockResAdmin.body === 'object', 'Admin response body is an object');
  assert(mockResAdmin.body.summary !== undefined, 'Admin response has summary');
  assert(Array.isArray(mockResAdmin.body.categoryRatings), 'Admin response has categoryRatings array');
  assert(Array.isArray(mockResAdmin.body.comments), 'Admin response has comments array');
  assert(Array.isArray(mockResAdmin.body.wordCloud), 'Admin response has wordCloud array');

  console.log('Admin summary returned:', mockResAdmin.body.summary);
  console.log('Category ratings count:', mockResAdmin.body.categoryRatings.length);
  console.log('Comments count:', mockResAdmin.body.comments.length);

  // 2. Test Superadmin getFeedbackAnalytics
  console.log('\n--- 2. Testing superadminController.getFeedbackAnalytics ---');
  const mockReqSuper = {};
  const mockResSuper = createMockRes();

  await superadminController.getFeedbackAnalytics(mockReqSuper, mockResSuper);
  assert(mockResSuper.statusCode === 200, `Superadmin response status must be 200, got ${mockResSuper.statusCode}`);
  assert(mockResSuper.body !== null, 'Superadmin response body must not be null');
  assert(mockResSuper.body.summary !== undefined, 'Superadmin response has summary');
  assert(Array.isArray(mockResSuper.body.categoryRatings), 'Superadmin response has categoryRatings array');
  assert(Array.isArray(mockResSuper.body.comments), 'Superadmin response has comments array');
  assert(Array.isArray(mockResSuper.body.wordCloud), 'Superadmin response has wordCloud array');

  console.log('Superadmin summary returned:', mockResSuper.body.summary);

  // 3. Test with synthetic feedback rows in memory to verify calculation
  console.log('\n--- 3. Testing with synthetic feedback data calculation ---');
  const { computeAggregatedFeedbackAnalytics } = require('../utils/feedbackRatingExtractor');

  const syntheticRows = [
    {
      id: 101,
      category: 'Pre-LTC',
      role: 'student',
      name: 'Aditya Sharma',
      created_at: new Date('2026-03-24'),
      feedback_text: JSON.stringify({
        ratings: {
          'Problem solving': 4,
          'Goal management': 5
        },
        orientationRatings: {
          'Welcome session': 4
        }
      })
    },
    {
      id: 102,
      category: 'Post-LTC',
      role: 'student',
      name: 'Ananya Deshmukh',
      created_at: new Date('2026-03-28'),
      feedback_text: JSON.stringify({
        ratings: {
          'Self-regulation': 5,
          'Team building': 5
        },
        facultyRatings: {
          sports: {
            'Instructor 1': 'Excellent', // 5
            'Coordinator': 'Very Good'   // 4
          }
        },
        facilitiesRatings: {
          'Accommodation': 4,
          'Food and Dining': 5,
          'Transport': 4
        }
      })
    },
    {
      id: 103,
      category: 'Service-Trainers',
      role: 'student',
      name: 'Rohan Joshi',
      created_at: new Date('2026-03-28'),
      feedback_text: JSON.stringify({
        arrival_orientation: {
          security_bag_checking: 4
        },
        facilities_admin: {
          boarding_lodging: 4,
          food_dining: 3
        },
        trainers: {
          sports: {
            expertise: 5,
            punctuality: 5
          }
        },
        overall_suggestions: 'Punctual military training, excellent instructors.'
      })
    }
  ];

  const calculated = computeAggregatedFeedbackAnalytics(syntheticRows);
  console.log('Synthetic aggregated summary:', calculated.summary);
  assert(calculated.summary.overall_avg > 4.0, 'overall_avg computed accurately (> 4.0)');
  assert(calculated.summary.faculty_avg >= 4.5, 'faculty_avg computed accurately (>= 4.5)');
  assert(calculated.summary.accommodation_avg === 4.0, `accommodation_avg should be 4.0, got ${calculated.summary.accommodation_avg}`);
  assert(calculated.summary.food_avg === 4.0, `food_avg should be 4.0 (avg of 5 and 3), got ${calculated.summary.food_avg}`);
  assert(calculated.summary.travel_avg === 4.0, `travel_avg should be 4.0 (avg of 4, 4, 4), got ${calculated.summary.travel_avg}`);
  assert(calculated.summary.total_submissions === 3, 'total_submissions is 3');
  assert(calculated.summary.rated_submissions === 3, 'rated_submissions is 3');

  console.log('\n====================================================');
  console.log('🎉 ALL FEEDBACK ANALYTICS INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');
}

runTests()
  .then(async () => {
    await pool.end();
  })
  .catch(async err => {
    console.error('Test error:', err);
    await pool.end();
    process.exit(1);
  });
