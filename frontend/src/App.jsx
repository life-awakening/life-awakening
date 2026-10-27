import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AnnouncementBanner from './AnnouncementBanner'
import { LanguageProvider } from './context/LanguageContext'
import PwaStatusBarManager from './ri/shared/pwaThemeManager'
import { REQUIRE_STUDENT_PASSWORD_CHANGE } from './config/authConfig'

// Helper to handle chunk loading failures by reloading the page automatically
const lazyWithRetry = (componentImport) => lazy(async () => {
  try {
    return await componentImport();
  } catch (error) {
    console.error("Failed to load component chunk, reloading page...", error);
    window.location.reload();
    return { default: () => null };
  }
});

// Lazy loaded portal page components wrapped with reload retry logic
const Login = lazyWithRetry(() => import('./Login'))
const AdminDashboard = lazyWithRetry(() => import('./AdminDashboard'))
const FacultyDashboard = lazyWithRetry(() => import('./FacultyDashboard'))
const StudentDashboard = lazyWithRetry(() => import('./StudentDashboard'))
const LtcMemberDashboard = lazyWithRetry(() => import('./LtcMemberDashboard'))
const SuperadminDashboard = lazyWithRetry(() => import('./SuperadminDashboard'))
const PerformanceAdminDashboard = lazyWithRetry(() => import('./PerformanceAdminDashboard'))
const GalleryDashboard = lazyWithRetry(() => import('./GalleryDashboard'))
const RiAdminDashboard = lazyWithRetry(() => import('./ri/admin/RiAdminDashboard'))
const RiSuperAdminDashboard = lazyWithRetry(() => import('./ri/admin/RiSuperAdminDashboard'))
const RiFacultyDashboard = lazyWithRetry(() => import('./ri/faculty/RiFacultyDashboard'))
const RiStudentDashboard = lazyWithRetry(() => import('./ri/student/RiStudentDashboard'))
const RiNodalOfficerDashboard = lazyWithRetry(() => import('./ri/nodal/RiNodalOfficerDashboard'))
const RiWorkspaceSelector = lazyWithRetry(() => import('./ri/shared/RiWorkspaceSelector'))
const PortalSelector = lazyWithRetry(() => import('./PortalSelector'))
const ResetPasswordGate = lazyWithRetry(() => import('./ResetPasswordGate'))
const SupportDashboard = lazyWithRetry(() => import('./SupportDashboard'))
const JeetenDashboard = lazyWithRetry(() => import('./SupportDashboard'))
const VerifySlip = lazyWithRetry(() => import('./VerifySlip'))
const SelectChild = lazyWithRetry(() => import('./SelectChild'))

// Helper to verify JWT token expiration
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

// Protected route: redirect to /login if no token or expired in localStorage
function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem('token');
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  const location = useLocation();

  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const role = user.role;
      const isPerfAdmin = Boolean(user.is_performance_admin || (Array.isArray(user.performance_roles) && user.performance_roles.length > 0));
      const isPrePostAdmin = Boolean(user.is_pre_post_admin);

      let isAllowed = Boolean(role && allowedRoles.includes(role));

      // Delegated access check:
      // If the route allows superadmin and the user has pre/post admin access, grant entry
      if (!isAllowed && allowedRoles.includes('superadmin') && isPrePostAdmin) {
        isAllowed = true;
      }
      // If the route allows performance-admin and user is performance admin, grant entry
      if (!isAllowed && allowedRoles.includes('performance-admin') && isPerfAdmin) {
        isAllowed = true;
      }

      if (!isAllowed) {
        // Enforce strict URL protection: prevent unauthorized roles from accessing other modules
        if (role === 'gallery') {
          return <Navigate to="/gallery" replace />;
        }
        if (isPerfAdmin) {
          return <Navigate to="/performance-admin" replace />;
        }
        if (role === 'superadmin' || role === 'superadmin_readonly' || isPrePostAdmin) {
          return <Navigate to="/superadmin" replace />;
        }
        if (role === 'admin' || role === 'admin_readonly') {
          return <Navigate to="/admin" replace />;
        }
        if (role === 'faculty') {
          return <Navigate to="/faculty" replace />;
        }
        if (role === 'ltc_member') {
          return <Navigate to="/ltc_member" replace />;
        }
        if (role === 'superadmin-ri') {
          return <Navigate to="/ri-superadmin" replace />;
        }
        if (role === 'ri_nodal_officer' || role === 'nodal_officer') {
          return <Navigate to="/ri-nodal-officer" replace />;
        }
        if (role === 'ri_admin') {
          return <Navigate to="/ri-admin" replace />;
        }
        if (role === 'ri_faculty' || user.is_ri_faculty) {
          return <Navigate to="/ri-faculty" replace />;
        }
        if (role === 'ri_student' || user.is_ri_student || role === 'student') {
          if (REQUIRE_STUDENT_PASSWORD_CHANGE && !user.password_changed) {
            return <Navigate to="/reset-password" replace />;
          }
          return <Navigate to="/student" replace />;
        }
        if (role === 'parent') {
          try {
            const cachedChildren = JSON.parse(localStorage.getItem('parent_children') || '[]');
            if (Array.isArray(cachedChildren) && cachedChildren.length === 1) {
              localStorage.setItem('selectedStudentId', String(cachedChildren[0].id));
              localStorage.setItem('selectedStudent', JSON.stringify(cachedChildren[0]));
              return <Navigate to="/student" replace />;
            }
          } catch (e) {}
          return <Navigate to="/select-child" replace />;
        }
        return <Navigate to="/login" replace />;
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return <Navigate to="/login" replace />;
    }
  }

  // Parent Child Selection Gate:
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'parent') {
      if (location.pathname.startsWith('/student') && !localStorage.getItem('selectedStudentId')) {
        const cachedChildren = JSON.parse(localStorage.getItem('parent_children') || '[]');
        if (Array.isArray(cachedChildren) && cachedChildren.length === 1) {
          localStorage.setItem('selectedStudentId', String(cachedChildren[0].id));
          localStorage.setItem('selectedStudent', JSON.stringify(cachedChildren[0]));
        } else {
          return <Navigate to="/select-child" replace />;
        }
      }
    }
  } catch (e) {
    console.error("Error evaluating parent role in ProtectedRoute:", e);
  }

  // Student First-Time / Reset Password Gate:
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'student') {
      if (REQUIRE_STUDENT_PASSWORD_CHANGE && !user.password_changed) {
        if (location.pathname !== '/reset-password') {
          return <Navigate to="/reset-password" replace />;
        }
      } else {
        if (location.pathname === '/reset-password') {
          return <Navigate to="/student" replace />;
        }

        // Students in Life Awakening are strictly restricted to the LTC portal
        if (location.pathname.startsWith('/ri-') || location.pathname === '/select-portal') {
          return <Navigate to="/student" replace />;
        }
      }
    }
  } catch (e) {
    console.error("Error evaluating student programs in ProtectedRoute:", e);
  }

  return children;
}

// Error boundary to catch route loading issues (e.g., while offline)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>Unable to load page</h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>Please check your internet connection and try reloading the page.</p>
          <button className="btn" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Simple fallback loading indicator
function LoadingFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #2563eb',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>Loading...</p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <PwaStatusBarManager />
      <LanguageProvider>
        <div className="app-container">
          <AnnouncementBanner />
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Root → Login */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Public portal route */}
                <Route path="/login" element={<Login />} />
                <Route path="/verify" element={<VerifySlip />} />

                {/* Protected dashboard routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'admin_readonly', 'superadmin']}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/coordinator" element={<ProtectedRoute allowedRoles={['coordinator', 'faculty', 'ltc_member', 'admin', 'superadmin']}><FacultyDashboard /></ProtectedRoute>} />
                <Route path="/faculty" element={<ProtectedRoute allowedRoles={['faculty', 'coordinator', 'admin', 'superadmin']}><FacultyDashboard /></ProtectedRoute>} />
                <Route path="/select-child" element={<ProtectedRoute allowedRoles={['parent']}><SelectChild /></ProtectedRoute>} />
                <Route path="/student" element={<ProtectedRoute allowedRoles={['student', 'parent', 'admin', 'superadmin']}><StudentDashboard /></ProtectedRoute>} />
                <Route path="/ltc_member" element={<ProtectedRoute allowedRoles={['ltc_member', 'faculty', 'coordinator', 'admin', 'superadmin']}><LtcMemberDashboard /></ProtectedRoute>} />
                <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin', 'superadmin_readonly']}><SuperadminDashboard /></ProtectedRoute>} />
                <Route path="/performance-admin" element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'faculty', 'ltc_member']}><PerformanceAdminDashboard /></ProtectedRoute>} />
                <Route path="/gallery" element={<ProtectedRoute allowedRoles={['gallery', 'admin', 'superadmin']}><GalleryDashboard /></ProtectedRoute>} />
                <Route path="/ri-admin" element={<ProtectedRoute allowedRoles={['ri_admin', 'admin', 'superadmin', 'superadmin-ri']}><RiAdminDashboard /></ProtectedRoute>} />
                <Route path="/ri-superadmin" element={<ProtectedRoute allowedRoles={['superadmin-ri', 'superadmin_ri_readonly', 'superadmin-ri-readonly', 'superadmin']}><RiSuperAdminDashboard /></ProtectedRoute>} />
                <Route path="/ri-faculty" element={<ProtectedRoute allowedRoles={['ri_faculty', 'faculty', 'ri_nodal_officer', 'nodal_officer', 'admin', 'superadmin', 'superadmin-ri']}><RiFacultyDashboard /></ProtectedRoute>} />
                <Route path="/ri-student" element={<Navigate to="/student" replace />} />
                <Route path="/ri-nodal-officer" element={<ProtectedRoute allowedRoles={['ri_nodal_officer', 'nodal_officer', 'ri_faculty', 'faculty', 'ri_admin', 'superadmin-ri', 'superadmin']}><RiNodalOfficerDashboard /></ProtectedRoute>} />
                <Route path="/nodal-officer" element={<Navigate to="/ri-nodal-officer" replace />} />
                <Route path="/ri-workspaces" element={<ProtectedRoute allowedRoles={['ri_faculty', 'faculty', 'ri_nodal_officer', 'nodal_officer', 'ri_admin', 'superadmin-ri', 'superadmin']}><RiWorkspaceSelector /></ProtectedRoute>} />
                <Route path="/ri-workspace-select" element={<Navigate to="/ri-workspaces" replace />} />
                <Route path="/reset-password" element={<ProtectedRoute allowedRoles={['student', 'admin', 'superadmin']}><ResetPasswordGate /></ProtectedRoute>} />
                <Route path="/select-portal" element={<Navigate to="/student" replace />} />
                <Route path="/support" element={<ProtectedRoute allowedRoles={['support', 'admin', 'superadmin']}><SupportDashboard /></ProtectedRoute>} />
                <Route path="/jeeten" element={<Navigate to="/support" replace />} />

                {/* Catch-all → Login */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </LanguageProvider>
    </BrowserRouter>
  )
}
