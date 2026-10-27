const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './backend/.env' });

const API = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function computeLoginTargetRoute(user, wsData, apiFailed = false) {
  const isPerfAdmin = user.is_performance_admin || (Array.isArray(user.performance_roles) && user.performance_roles.length > 0);
  const isPrePostAdmin = user.is_pre_post_admin;
  const isRiEligibleRole = ['ri_faculty', 'ri_nodal_officer', 'nodal_officer', 'faculty'].includes(user.role);

  let riTargetRoute = null;

  if (isRiEligibleRole) {
    if (apiFailed) {
      if (user.role === 'faculty') {
        riTargetRoute = '/faculty';
      } else {
        riTargetRoute = '/ri-workspaces';
      }
    } else {
      const facAssignments = wsData.faculty_assignments || [];
      const nodAssignments = wsData.nodal_assignments || [];
      const totalCount = wsData.total_count ?? (facAssignments.length + nodAssignments.length);

      if (totalCount > 1) {
        riTargetRoute = '/ri-workspaces';
      } else if (totalCount === 1) {
        const onlyFac = facAssignments[0];
        const onlyNod = nodAssignments[0];
        if (onlyFac) {
          riTargetRoute = `/ri-faculty?batch_id=${onlyFac.batch_id}&panel_id=${onlyFac.panel_id}`;
        } else if (onlyNod) {
          riTargetRoute = `/ri-nodal-officer?batch_id=${onlyNod.batch_id}&panel_id=${onlyNod.panel_id}`;
        } else {
          riTargetRoute = '/ri-workspaces';
        }
      } else {
        if (user.role === 'faculty') {
          riTargetRoute = '/faculty';
        } else {
          riTargetRoute = '/ri-workspaces';
        }
      }
    }
  }

  const targetRoute = isPerfAdmin
    ? '/performance-admin'
    : (user.role === 'superadmin' || user.role === 'superadmin_readonly' || isPrePostAdmin)
      ? '/superadmin'
      : (user.role === 'superadmin-ri' || user.role === 'superadmin_ri_readonly' || user.role === 'superadmin-ri-readonly')
        ? '/ri-superadmin'
        : (user.role === 'gallery')
          ? '/gallery'
          : (user.role === 'ri_admin')
            ? '/ri-admin'
            : isRiEligibleRole
              ? riTargetRoute
              : (user.role === 'student')
                ? '/student'
                : `/${user.role}`;

  return targetRoute;
}

async function runTests() {
  console.log('====================================================');
  console.log('Testing RI Post-Login Workspace Selection Scenarios');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, detail) {
    total++;
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} -> ${detail}`);
    }
  }

  // Real API Verification with test tokens against backend /api/ri/workspaces/my-assignments
  // Scenario 1: User with Faculty + Nodal Officer assignments (a1@gmail.com, id: 405021)
  const user1 = { id: 405021, email: 'a1@gmail.com', role: 'ri_nodal_officer' };
  const token1 = jwt.sign(user1, JWT_SECRET, { expiresIn: '1h' });
  const res1 = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const data1 = await res1.json();
  const route1 = computeLoginTargetRoute(user1, data1);
  assert(
    'Scenario 1: Faculty + Nodal Officer assignments -> /ri-workspaces',
    data1.faculty_assignments.length > 0 && data1.nodal_assignments.length > 0 && route1 === '/ri-workspaces',
    `Expected /ri-workspaces with dual assignments, got route: ${route1}, fac: ${data1.faculty_assignments?.length}, nod: ${data1.nodal_assignments?.length}`
  );

  // Scenario 2: User with Multiple Faculty assignments
  const user2 = { id: 99901, email: 'multy.fac@mitwpu.edu.in', role: 'ri_faculty' };
  const mockWsData2 = {
    faculty_assignments: [
      { id: 'faculty_1', batch_id: 131, panel_id: 296, panel_name: 'Panel 1' },
      { id: 'faculty_2', batch_id: 131, panel_id: 297, panel_name: 'Panel 2' }
    ],
    nodal_assignments: [],
    total_count: 2
  };
  const route2 = computeLoginTargetRoute(user2, mockWsData2);
  assert(
    'Scenario 2: Multiple Faculty assignments -> /ri-workspaces',
    route2 === '/ri-workspaces',
    `Expected /ri-workspaces, got: ${route2}`
  );

  // Scenario 3: User with Multiple Nodal Officer assignments
  const user3 = { id: 99902, email: 'multy.nodal@mitwpu.edu.in', role: 'ri_nodal_officer' };
  const mockWsData3 = {
    faculty_assignments: [],
    nodal_assignments: [
      { id: 'nodal_296', batch_id: 131, panel_id: 296, panel_name: 'Panel 1' },
      { id: 'nodal_297', batch_id: 131, panel_id: 297, panel_name: 'Panel 2' }
    ],
    total_count: 2
  };
  const route3 = computeLoginTargetRoute(user3, mockWsData3);
  assert(
    'Scenario 3: Multiple Nodal Officer assignments -> /ri-workspaces',
    route3 === '/ri-workspaces',
    `Expected /ri-workspaces, got: ${route3}`
  );

  // Scenario 4a: Exactly one RI assignment (Faculty: abc@gmail.com, id: 405023)
  const user4a = { id: 405023, email: 'abc@gmail.com', role: 'ri_faculty' };
  const token4a = jwt.sign(user4a, JWT_SECRET, { expiresIn: '1h' });
  const res4a = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
    headers: { Authorization: `Bearer ${token4a}` }
  });
  const data4a = await res4a.json();
  const route4a = computeLoginTargetRoute(user4a, data4a);
  assert(
    'Scenario 4a: Exactly one RI Faculty assignment -> direct /ri-faculty dashboard',
    data4a.faculty_assignments?.length === 1 && data4a.nodal_assignments?.length === 0 && route4a === `/ri-faculty?batch_id=${data4a.faculty_assignments[0].batch_id}&panel_id=${data4a.faculty_assignments[0].panel_id}`,
    `Expected /ri-faculty?batch_id=131&panel_id=296, got: ${route4a}`
  );

  // Scenario 4b: Exactly one RI assignment (Nodal: rajesh.sharma@mitwpu.edu.in, id: 405022)
  const user4b = { id: 405022, email: 'rajesh.sharma@mitwpu.edu.in', role: 'ri_nodal_officer' };
  const token4b = jwt.sign(user4b, JWT_SECRET, { expiresIn: '1h' });
  const res4b = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
    headers: { Authorization: `Bearer ${token4b}` }
  });
  const data4b = await res4b.json();
  const route4b = computeLoginTargetRoute(user4b, data4b);
  assert(
    'Scenario 4b: Exactly one RI Nodal assignment -> direct /ri-nodal-officer dashboard',
    data4b.nodal_assignments?.length === 1 && data4b.faculty_assignments?.length === 0 && route4b === `/ri-nodal-officer?batch_id=${data4b.nodal_assignments[0].batch_id}&panel_id=${data4b.nodal_assignments[0].panel_id}`,
    `Expected /ri-nodal-officer?batch_id=131&panel_id=296, got: ${route4b}`
  );

  // Scenario 5: Pure LTC Faculty (0 RI assignments)
  const user5 = { id: 99905, email: 'ltc.faculty@mitwpu.edu.in', role: 'faculty' };
  const token5 = jwt.sign(user5, JWT_SECRET, { expiresIn: '1h' });
  const res5 = await fetch(`${API}/api/ri/workspaces/my-assignments`, {
    headers: { Authorization: `Bearer ${token5}` }
  });
  const data5 = await res5.json();
  const route5 = computeLoginTargetRoute(user5, data5);
  assert(
    'Scenario 5: Pure LTC Faculty (0 RI assignments) -> /faculty dashboard unchanged',
    data5.total_count === 0 && route5 === '/faculty',
    `Expected /faculty, got: ${route5}, assignments count: ${data5.total_count}`
  );

  // Scenario 6: Robustness on API failure for Pure LTC Faculty
  const routeFailLtc = computeLoginTargetRoute(user5, null, true);
  assert(
    'Scenario 6: Pure LTC Faculty on RI API failure -> gracefully defaults to /faculty',
    routeFailLtc === '/faculty',
    `Expected /faculty, got: ${routeFailLtc}`
  );

  // Scenario 7: Robustness on API failure for RI User
  const routeFailRi = computeLoginTargetRoute(user1, null, true);
  assert(
    'Scenario 7: RI User on API failure -> safely falls back to /ri-workspaces without opening wrong dashboard',
    routeFailRi === '/ri-workspaces',
    `Expected /ri-workspaces, got: ${routeFailRi}`
  );

  // Scenario 8: Backend access control for dual-role user (a1@gmail.com has both faculty and nodal)
  // Verify access to /api/ri-nodal/panels with token1
  const nodalRes = await fetch(`${API}/api/ri-nodal/panels`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const nodalData = await nodalRes.json();
  assert(
    'Scenario 8: Nodal endpoints accessible by user holding nodal assignment',
    nodalRes.status === 200 && nodalData.success === true,
    `Status: ${nodalRes.status}, data: ${JSON.stringify(nodalData)}`
  );

  // Scenario 9: Faculty portal profile accessible by user holding faculty assignment
  const facProfileRes = await fetch(`${API}/api/ri/faculty-portal/profile`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const facProfileData = await facProfileRes.json();
  assert(
    'Scenario 9: Faculty portal profile accessible by user holding faculty assignment',
    facProfileRes.status === 200 && facProfileData.assigned_panels?.length > 0,
    `Status: ${facProfileRes.status}, data: ${JSON.stringify(facProfileData)}`
  );

  // Scenario 10: Strict Role Isolation: Nodal panels list must NEVER include panels assigned solely as Faculty
  const nodalPanelIds = (nodalData.panels || []).map(p => p.panel_id);
  assert(
    'Scenario 10: Nodal Officer panels list STRICTLY excludes faculty-only panel 296',
    !nodalPanelIds.includes(296) && nodalPanelIds.includes(297),
    `Nodal panels: ${JSON.stringify(nodalPanelIds)}`
  );

  // Scenario 11: Strict Role Isolation: Faculty profile must NEVER include panels assigned solely as Nodal Officer
  const facultyPanelIds = (facProfileData.assigned_panels || []).map(p => p.ri_panel_id);
  assert(
    'Scenario 11: Faculty profile panels list STRICTLY excludes nodal-only panel 297',
    facultyPanelIds.includes(296) && !facultyPanelIds.includes(297),
    `Faculty panels: ${JSON.stringify(facultyPanelIds)}`
  );

  // Scenario 12: Unauthorized Cross-Role Panel Access Rejection (Nodal accessing Faculty-only panel 296 -> 403)
  const crossNodalRes = await fetch(`${API}/api/ri-nodal/panels/296/details`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  assert(
    'Scenario 12: Nodal Officer access to faculty-only panel 296 is REJECTED with 403 Forbidden',
    crossNodalRes.status === 403,
    `Status: ${crossNodalRes.status}`
  );

  // Scenario 13: Unauthorized Cross-Role Panel Access Rejection (Faculty accessing Nodal-only panel 297 -> 403)
  const tokenFac = jwt.sign({ id: 405021, email: 'a1@gmail.com', role: 'faculty' }, JWT_SECRET, { expiresIn: '1h' });
  const crossFacRes = await fetch(`${API}/api/ri/faculty-portal/panel?batch_id=131&panel_id=297`, {
    headers: { Authorization: `Bearer ${tokenFac}` }
  });
  assert(
    'Scenario 13: Faculty access to nodal-only panel 297 is REJECTED with 403 Forbidden',
    crossFacRes.status === 403,
    `Status: ${crossFacRes.status}`
  );

  // Scenario 14: Context switching loads correct panel and village data for active workspace
  const facValidRes = await fetch(`${API}/api/ri/faculty-portal/panel?batch_id=131&panel_id=296`, {
    headers: { Authorization: `Bearer ${tokenFac}` }
  });
  const facValidData = await facValidRes.json();
  const nodValidRes = await fetch(`${API}/api/ri-nodal/panels/297/details`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const nodValidData = await nodValidRes.json();
  assert(
    'Scenario 14: Authorized panel queries correctly reflect active workspace context',
    facValidRes.status === 200 && facValidData.panel?.village_name === 'Rui' &&
    nodValidRes.status === 200 && nodValidData.panel?.village_name === 'Palasdev',
    `Fac village: ${facValidData.panel?.village_name}, Nod village: ${nodValidData.panel?.village_name}`
  );

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
