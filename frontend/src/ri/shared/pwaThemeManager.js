/**
 * PWA Status Bar & Theme Color Manager
 * 
 * Manages mobile status bar colors, theme-color meta tags, and iOS PWA status bar styling
 * dynamically based on the current route:
 * 
 * - RI Shared Login Page (/login or /):
 *     theme-color: #eef5fc (matches login top gradient)
 *     apple-mobile-web-app-status-bar-style: default (black text/icons for light background)
 *     background-color: #eef5fc
 * 
 * - Superadmin-RI, Faculty-RI, Student-RI, Admin-RI (/ri-*):
 *     theme-color: #047857 (matches RI emerald header)
 *     apple-mobile-web-app-status-bar-style: black-translucent (white text/icons for dark header)
 *     background-color: #047857
 * 
 * - Other Portals (LTC):
 *     theme-color: #ffffff
 *     apple-mobile-web-app-status-bar-style: default
 *     background-color: #ECECF1
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function getThemeConfigForPath(pathname) {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
  const isRiWorkspace = path.startsWith('/ri-workspace');
  const isRi = path.startsWith('/ri-') && !isRiWorkspace;
  const isLogin = path === '/login' || path === '/' || !path;

  if (isRi) {
    return {
      themeColor: '#047857',
      appleStatusBar: 'black-translucent',
      bgColor: '#047857'
    };
  }

  if (isLogin) {
    return {
      themeColor: '#eef5fc',
      appleStatusBar: 'default',
      bgColor: '#eef5fc'
    };
  }

  return {
    themeColor: '#ffffff',
    appleStatusBar: 'default',
    bgColor: '#ffffff'
  };
}

export function applyPwaTheme(pathname) {
  if (typeof document === 'undefined') return;

  const { themeColor, appleStatusBar, bgColor } = getThemeConfigForPath(pathname);

  // 1. Update or create <meta name="theme-color">
  let themeMetas = document.querySelectorAll('meta[name="theme-color"]');
  if (themeMetas.length === 0) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', themeColor);
    document.head.appendChild(meta);
  } else {
    themeMetas.forEach(meta => {
      meta.setAttribute('content', themeColor);
      if (meta.hasAttribute('media')) {
        meta.removeAttribute('media');
      }
    });
  }

  // 2. Update or create <meta name="apple-mobile-web-app-status-bar-style">
  let appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (!appleStatusMeta) {
    appleStatusMeta = document.createElement('meta');
    appleStatusMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
    document.head.appendChild(appleStatusMeta);
  }
  appleStatusMeta.setAttribute('content', appleStatusBar);

  // 3. Update root document background color to prevent rubber-band/overscroll seams
  if (document.documentElement) {
    document.documentElement.style.backgroundColor = bgColor;
  }
  if (document.body) {
    document.body.style.backgroundColor = bgColor;
  }
}

/**
 * React Component mounted inside BrowserRouter that tracks route changes
 * and updates mobile status bar color immediately on navigation, refresh, and login/logout.
 */
export default function PwaStatusBarManager() {
  const location = useLocation();

  useEffect(() => {
    applyPwaTheme(location.pathname);
  }, [location.pathname]);

  return null;
}
