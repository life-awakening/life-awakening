import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getThemeConfigForPath, applyPwaTheme } from '../pwaThemeManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('TEST SUITE: PWA Mobile Status Bar Theme Configuration');
console.log('================================================================\n');

// ── Test 1: Route Theme Config Mapping ──────────────────────────────────────────
console.log('[Test 1] Verifying getThemeConfigForPath across required routes...');

// 1. Shared RI Login Page
const loginConfig = getThemeConfigForPath('/login');
assert.strictEqual(loginConfig.themeColor, '#eef5fc', 'Login page theme-color must be #eef5fc');
assert.strictEqual(loginConfig.appleStatusBar, 'default', 'Login page apple status bar must be default (dark icons)');
assert.strictEqual(loginConfig.bgColor, '#eef5fc', 'Login page background color must be #eef5fc');

const rootConfig = getThemeConfigForPath('/');
assert.strictEqual(rootConfig.themeColor, '#eef5fc', 'Root path should map to login theme color');

// 2. Superadmin-RI Panel
const superadminConfig = getThemeConfigForPath('/ri-superadmin');
assert.strictEqual(superadminConfig.themeColor, '#047857', 'Superadmin-RI theme-color must be #047857');
assert.strictEqual(superadminConfig.appleStatusBar, 'black-translucent', 'Superadmin-RI status bar must be black-translucent (light icons)');
assert.strictEqual(superadminConfig.bgColor, '#047857', 'Superadmin-RI background color must be #047857');

// 3. Faculty-RI Panel
const facultyConfig = getThemeConfigForPath('/ri-faculty');
assert.strictEqual(facultyConfig.themeColor, '#047857', 'Faculty-RI theme-color must be #047857');
assert.strictEqual(facultyConfig.appleStatusBar, 'black-translucent', 'Faculty-RI status bar must be black-translucent');
assert.strictEqual(facultyConfig.bgColor, '#047857', 'Faculty-RI background color must be #047857');

// 4. Student-RI Panel
const studentConfig = getThemeConfigForPath('/ri-student');
assert.strictEqual(studentConfig.themeColor, '#047857', 'Student-RI theme-color must be #047857');
assert.strictEqual(studentConfig.appleStatusBar, 'black-translucent', 'Student-RI status bar must be black-translucent');
assert.strictEqual(studentConfig.bgColor, '#047857', 'Student-RI background color must be #047857');

// 5. Admin-RI and other RI routes
const adminConfig = getThemeConfigForPath('/ri-admin');
assert.strictEqual(adminConfig.themeColor, '#047857', 'Admin-RI theme-color must be #047857');
const nodalConfig = getThemeConfigForPath('/ri-nodal-officer');
assert.strictEqual(nodalConfig.themeColor, '#047857', 'Nodal-RI theme-color must be #047857');

// 6. LTC routes (must not be disturbed)
const ltcAdminConfig = getThemeConfigForPath('/admin');
assert.strictEqual(ltcAdminConfig.themeColor, '#ffffff', 'LTC Admin should retain #ffffff');
const ltcStudentConfig = getThemeConfigForPath('/student');
assert.strictEqual(ltcStudentConfig.themeColor, '#ffffff', 'LTC Student should retain #ffffff');

console.log('  ✔ All route mappings match exact portal theme requirements');


// ── Test 2: Simulated DOM updates ──────────────────────────────────────────────
console.log('\n[Test 2] Testing applyPwaTheme DOM manipulation in simulated environment...');

const mockElements = {
  themeMetas: [],
  appleMeta: null,
  htmlStyle: {},
  bodyStyle: {}
};

// Simple DOM Mock
global.document = {
  head: {
    appendChild: (elem) => {
      if (elem.name === 'theme-color') mockElements.themeMetas.push(elem);
      if (elem.name === 'apple-mobile-web-app-status-bar-style') mockElements.appleMeta = elem;
    }
  },
  createElement: (tag) => {
    return {
      attributes: {},
      setAttribute(k, v) { this[k] = v; this.attributes[k] = v; },
      getAttribute(k) { return this[k] || this.attributes[k]; },
      hasAttribute(k) { return Boolean(this[k] || this.attributes[k]); },
      removeAttribute(k) { delete this[k]; delete this.attributes[k]; }
    };
  },
  querySelectorAll: (selector) => {
    if (selector === 'meta[name="theme-color"]') return mockElements.themeMetas;
    return [];
  },
  querySelector: (selector) => {
    if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') return mockElements.appleMeta;
    return null;
  },
  documentElement: { style: mockElements.htmlStyle },
  body: { style: mockElements.bodyStyle }
};

// 1. Simulate visiting /login
applyPwaTheme('/login');
assert.strictEqual(mockElements.themeMetas[0].content, '#eef5fc', 'DOM theme-color must be #eef5fc on login');
assert.strictEqual(mockElements.appleMeta.content, 'default', 'DOM apple status bar must be default on login');
assert.strictEqual(mockElements.htmlStyle.backgroundColor, '#eef5fc', 'html background must match login color');

// 2. Simulate navigating to /ri-faculty
applyPwaTheme('/ri-faculty');
assert.strictEqual(mockElements.themeMetas[0].content, '#047857', 'DOM theme-color must be #047857 on /ri-faculty');
assert.strictEqual(mockElements.appleMeta.content, 'black-translucent', 'DOM apple status bar must be black-translucent on /ri-faculty');
assert.strictEqual(mockElements.htmlStyle.backgroundColor, '#047857', 'html background must match #047857');

// 3. Simulate navigating to /ri-student
applyPwaTheme('/ri-student');
assert.strictEqual(mockElements.themeMetas[0].content, '#047857', 'DOM theme-color must be #047857 on /ri-student');

// 4. Simulate logout -> redirect to /login
applyPwaTheme('/login');
assert.strictEqual(mockElements.themeMetas[0].content, '#eef5fc', 'DOM theme-color must restore to #eef5fc on logout');
assert.strictEqual(mockElements.appleMeta.content, 'default', 'DOM apple status bar must restore to default on logout');

console.log('  ✔ DOM theme-color and apple status bar correctly update dynamically on navigation and logout');


// ── Test 3: Static File Auditing ──────────────────────────────────────────────
console.log('\n[Test 3] Auditing manifest.json, index.html, App.jsx, and headers...');

// 1. manifest.json
const manifestPath = path.resolve(__dirname, '../../../../public/manifest.json');
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
assert.strictEqual(manifestContent.background_color, '#ffffff', 'manifest.json background_color must be #ffffff (not pitch black #0F172A)');
assert.strictEqual(manifestContent.theme_color, '#047857', 'manifest.json theme_color must be #047857');
console.log('  ✔ manifest.json background_color is #ffffff and theme_color is #047857');

// 2. index.html
const indexPath = path.resolve(__dirname, '../../../../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');
assert(indexContent.includes('viewport-fit=cover'), 'index.html must include viewport-fit=cover');
assert(indexContent.includes('meta name="theme-color"'), 'index.html must include theme-color meta tag');
assert(indexContent.includes('apple-mobile-web-app-status-bar-style'), 'index.html must include status-bar-style meta tag');
assert(indexContent.includes('#047857') && indexContent.includes('#eef5fc'), 'index.html must include synchronous pre-boot theme script');
console.log('  ✔ index.html contains pre-boot script with viewport-fit=cover');

// 3. App.jsx
const appPath = path.resolve(__dirname, '../../../App.jsx');
const appContent = fs.readFileSync(appPath, 'utf-8');
assert(appContent.includes('PwaStatusBarManager'), 'App.jsx must import and mount PwaStatusBarManager');
console.log('  ✔ App.jsx mounts PwaStatusBarManager');

// 4. RiSuperAdminDashboard header
const superAdminPath = path.resolve(__dirname, '../../admin/RiSuperAdminDashboard.jsx');
const superAdminContent = fs.readFileSync(superAdminPath, 'utf-8');
assert(superAdminContent.includes('env(safe-area-inset-top'), 'RiSuperAdminDashboard header must handle env(safe-area-inset-top)');
console.log('  ✔ RiSuperAdminDashboard header handles safe-area insets');

// 5. RiFacultyDashboard header
const facultyPath = path.resolve(__dirname, '../../faculty/RiFacultyDashboard.jsx');
const facultyContent = fs.readFileSync(facultyPath, 'utf-8');
assert(facultyContent.includes('env(safe-area-inset-top'), 'RiFacultyDashboard header must handle env(safe-area-inset-top)');
console.log('  ✔ RiFacultyDashboard header handles safe-area insets');

// 6. RiStudentDashboard header
const studentPath = path.resolve(__dirname, '../../student/RiStudentDashboard.jsx');
const studentContent = fs.readFileSync(studentPath, 'utf-8');
assert(studentContent.includes('env(safe-area-inset-top'), 'RiStudentDashboard header must handle env(safe-area-inset-top)');
console.log('  ✔ RiStudentDashboard header handles safe-area insets');

console.log('\n================================================================');
console.log('ALL PWA STATUS BAR TESTS PASSED (3/3)');
console.log('================================================================\n');
