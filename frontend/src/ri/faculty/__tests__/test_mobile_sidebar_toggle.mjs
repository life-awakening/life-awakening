import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================================================');
console.log('TEST SUITE: RI Faculty Mobile Sidebar Toggle Button & Navigation');
console.log('================================================================\n');

const facultyDashboardPath = path.resolve(__dirname, '../RiFacultyDashboard.jsx');
assert(fs.existsSync(facultyDashboardPath), `RiFacultyDashboard.jsx must exist at ${facultyDashboardPath}`);
const content = fs.readFileSync(facultyDashboardPath, 'utf-8');

console.log('[Test 1] Verifying Hamburger / Menu toggle button existence and styling...');
assert(content.includes('import {'), 'Import statement exists');
assert(/Menu,/.test(content) || /, Menu/.test(content), 'Menu icon must be imported from lucide-react');
assert(content.includes('aria-label={isMobileNavOpen ? \'Close Navigation Menu\' : \'Open Navigation Menu\'}'), 'Toggle button must have accessible aria-label');
assert(content.includes('aria-expanded={isMobileNavOpen}'), 'Toggle button must expose aria-expanded state');
assert(content.includes('className="md:hidden"'), 'Toggle button must have md:hidden class to hide on desktop');
assert(content.includes("display: isMobile ? 'inline-flex' : 'none'"), 'Toggle button must dynamically hide on desktop and show on mobile');
console.log('  ✔ Hamburger / Menu toggle button exists with proper accessibility and visibility rules');

console.log('\n[Test 2] Verifying Button Placement in Mobile Header...');
const headerStartIdx = content.indexOf('<header');
const headerEndIdx = content.indexOf('</header>', headerStartIdx);
assert(headerStartIdx !== -1 && headerEndIdx !== -1, 'Header element must exist');
const headerContent = content.slice(headerStartIdx, headerEndIdx);

const btnIdx = headerContent.indexOf('setIsMobileNavOpen(prev => !prev)');
const h1Idx = headerContent.indexOf('<h1');
assert(btnIdx !== -1, 'Toggle button click handler must be in header');
assert(h1Idx !== -1, 'Title <h1> must be in header');
assert(btnIdx < h1Idx, 'Hamburger toggle button must appear before the title (top-left) in the mobile header');
assert(headerContent.includes('flexShrink: 0'), 'Button or container must have flexShrink: 0 to prevent shrinking/overlapping');
assert(headerContent.includes("textOverflow: 'ellipsis'"), 'Page title must handle text overflow with ellipsis without overlapping');
console.log('  ✔ Hamburger toggle button is correctly placed at top-left of header without overlapping title');

console.log('\n[Test 3] Verifying Sidebar Mobile Drawer Behavior & Backdrop...');
assert(content.includes('/* ── MOBILE NAV BACKDROP ── */'), 'Backdrop comment or section must exist');
assert(content.includes('onClick={() => setIsMobileNavOpen(false)}'), 'Backdrop click must close mobile nav');
assert(content.includes('backdropFilter:') || content.includes('backgroundColor: \'rgba(0,0,0,0.5)\''), 'Backdrop must have overlay styling');
assert(content.includes('opacity: isMobileNavOpen ? 1 : 0'), 'Backdrop must smoothly fade in/out');
assert(content.includes('pointerEvents: isMobileNavOpen ? \'auto\' : \'none\''), 'Backdrop must disable pointer events when closed');

// Sidebar drawer assertions
assert(content.includes("transform: isMobileNavOpen ? 'translateX(0)' : (isMobile ? 'translateX(-100%)' : undefined)"), 'Sidebar drawer must translate smoothly offscreen when closed and on-screen when open');
assert(content.includes("isMobile ? 'min(280px, 85vw)' : (isSidebarCollapsed ? '72px' : '260px')"), 'Sidebar width on mobile must adapt to viewport');
console.log('  ✔ Backdrop and mobile drawer animation logic correctly implemented');

console.log('\n[Test 4] Verifying Close Behaviors and Accessibility...');
assert(content.includes('aria-label="Close sidebar navigation"'), 'Mobile close button inside drawer must have aria-label');
assert(content.includes("if (e.key === 'Escape') setIsMobileNavOpen(false)"), 'Escape key must close mobile nav drawer');
assert(content.includes("document.body.style.overflow = 'hidden'"), 'Body scroll must be locked when mobile drawer is open');
console.log('  ✔ Mobile close button, escape key listener, and body scroll lock verified');

console.log('\n[Test 5] Verifying Sidebar Navigation Items Accessibility on Mobile...');
const navStartIdx = content.indexOf('<nav');
const navEndIdx = content.indexOf('</nav>', navStartIdx);
assert(navStartIdx !== -1 && navEndIdx !== -1, 'Nav element must exist');
const navContent = content.slice(navStartIdx, navEndIdx);
assert(navContent.includes('setIsMobileNavOpen(false)'), 'Clicking navigation item must close the mobile drawer');
assert(navContent.includes('(isMobile || !isSidebarCollapsed)'), 'Navigation items must always display full labels on mobile');
console.log('  ✔ All navigation items display full labels and close drawer upon selection');

console.log('\n[Test 6] Verifying Desktop Layout Preservation...');
assert(content.includes('{!isMobile && ('), 'Desktop collapse button must only render when !isMobile');
assert(content.includes("className={isSidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'}"), 'Main content margin must preserve desktop sidebar offset');
console.log('  ✔ Desktop layout and collapse functionality preserved');

console.log('\n================================================================');
console.log('ALL RI FACULTY MOBILE SIDEBAR TESTS PASSED (6/6)');
console.log('================================================================\n');
