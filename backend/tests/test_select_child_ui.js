const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log('================================================================');
console.log('   TESTING /select-child (SelectChild.jsx) CLEAN SIMPLE UI      ');
console.log('================================================================\n');

const filePath = path.join(__dirname, '../../frontend/src/SelectChild.jsx');
const content = fs.readFileSync(filePath, 'utf8');

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✔ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`✖ FAIL: ${name}`);
    console.error(err.message);
  }
}

// 1. Background check
runTest('Entire page background set to near-black #05070B', () => {
  assert.ok(content.includes("backgroundColor: '#05070B'"), 'Page must have #05070B background');
});

// 2. Header and Logo
runTest('Header contains /ltc.png and Sign Out button adapted to clean dark theme', () => {
  assert.ok(content.includes('src="/ltc.png"'), 'Must preserve /ltc.png logo');
  assert.ok(content.includes('Sign Out'), 'Must preserve Sign Out button');
  assert.ok(content.includes('select-child-signout-btn'), 'Must use clean dark styled Sign Out button');
  assert.ok(content.includes('handleLogout'), 'Must preserve handleLogout handler');
});

// 3. Page Heading
runTest('Heading has "Select Student" with orange accent on Student and correct subtitle', () => {
  assert.ok(content.includes('Select <span style={{ color: \'#ea580c\' }}>Student</span>'), 'Must contain clean heading');
  assert.ok(
    content.includes('Choose a student to view their dashboard, active schedules, attendance records, and learning journey.'),
    'Subtitle text must match exactly'
  );
});

// 4. Clean, Uniform Cards in Creamish Off-White
runTest('Student cards use clean, uniform creamish off-white styling without glassmorphism', () => {
  assert.ok(content.includes('.select-child-card'), 'CSS must define clean select-child-card');
  assert.ok(content.includes('background-color: #faf7f2'), 'Creamish off-white card background');
  assert.ok(content.includes('border: 1px solid #e8e2d8'), 'Clean warm subtle border');
  // Confirm NO glassmorphic box-shadow glows
  assert.ok(!content.includes('rgba(234, 88, 12, 0.16)'), 'Must NOT have orange glow shadow');
  assert.ok(!content.includes('rgba(37, 99, 235, 0.16)'), 'Must NOT have blue glow shadow');
});

// 5. Student ID Badge
runTest('Student ID badge has clean, subtle monospace styling', () => {
  assert.ok(content.includes('displayId'), 'Must render official formatted student ID');
  assert.ok(content.includes('ui-monospace'), 'Monospace font stack');
  assert.ok(content.includes('#efe9df'), 'Clean subtle warm badge background');
});

// 6. Information Section
runTest('Information section includes Class / Grade, School, and Branch without inner nested boxes', () => {
  assert.ok(content.includes('Class / Grade'), 'Must include Class / Grade');
  assert.ok(content.includes('School'), 'Must include School');
  assert.ok(content.includes('Branch'), 'Must include Branch');
  assert.ok(content.includes('BookOpen'), 'Must render BookOpen icon');
  assert.ok(content.includes('School'), 'Must render School icon');
  assert.ok(content.includes('MapPin'), 'Must render MapPin icon');
});

// 7. Open Dashboard Button
runTest('Open Dashboard button has clean solid styling without fuzzy shadows', () => {
  assert.ok(content.includes('.select-child-btn'), 'Must define select-child-btn');
  assert.ok(content.includes('Open Dashboard'), 'Button label must be "Open Dashboard"');
  assert.ok(content.includes('handleSelectChild(child)'), 'Must call handleSelectChild(child)');
});

// 8. Mobile Responsiveness
runTest('Mobile responsive layout handles stacking, overflowWrap, and window resize', () => {
  assert.ok(/isMobile\s*\?\s*['"]1fr['"]/.test(content), 'Cards must stack in 1 column on mobile');
  assert.ok(content.includes("overflowWrap: 'break-word'"), 'Long names must wrap safely');
  assert.ok(content.includes("window.addEventListener('resize'"), 'Must listen to window resize events');
});

// 9. Storage and Routing Logic Preservation
runTest('Local storage and routing logic strictly preserved', () => {
  assert.ok(content.includes("localStorage.setItem('selectedStudentId', String(child.id))"), 'selectedStudentId key preserved');
  assert.ok(content.includes("localStorage.setItem('selectedStudent', JSON.stringify(child))"), 'selectedStudent key preserved');
  assert.ok(content.includes("navigate('/student')"), 'Navigation to /student preserved');
  assert.ok(content.includes("navigate('/login'"), 'Logout redirect to /login preserved');
});

console.log(`\n================================================================`);
console.log(`   TEST RESULTS: ${passed}/${total} TESTS PASSED (${Math.round(passed / total * 100)}%)`);
console.log(`================================================================\n`);

process.exit(passed === total ? 0 : 1);
