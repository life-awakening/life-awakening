(function() {
  const suppressWarnings = (method) => {
    const original = console[method];
    if (!original) return;
    console[method] = function(...args) {
      if (args && args.length > 0) {
        const str = String(args[0] || '');
        if (
          str.includes('cdn.tailwindcss.com') ||
          str.includes('Layout was forced before the page was fully loaded') ||
          str.includes('flash of unstyled content')
        ) {
          return;
        }
      }
      original.apply(console, args);
    };
  };
  suppressWarnings('warn');
  suppressWarnings('log');
  suppressWarnings('info');
  suppressWarnings('error');
})();

window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        surface: '#ECECF1',
        'surface-dim': '#cbdbf5',
        'surface-bright': '#ECECF1',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e3ebf8',
        'surface-container-high': '#d6e2f1',
        'surface-container-highest': '#c9d9ea',
        'on-surface': '#1b1b1b',
        'on-surface-variant': '#474747',
        outline: '#767676',
        'outline-variant': '#c6c6c6',
        primary: '#2563eb',
        'on-primary': '#ffffff',
        'primary-container': '#dbeafe',
        'on-primary-container': '#1e3a8a',
        secondary: '#475569',
        'on-secondary': '#ffffff',
        'secondary-container': '#f1f5f9',
        'on-secondary-container': '#0f172a',
        tertiary: '#0ea5e9',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#e0f2fe',
        'on-tertiary-container': '#075985',
        error: '#dc2626',
        'on-error': '#ffffff',
        'error-container': '#fee2e2',
        'on-error-container': '#991b1b',
      },
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        DEFAULT: '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'full': '9999px',
      }
    }
  }
};

(function() {
  const ignoreViteLog = (args) => {
    if (args && args.length > 0 && typeof args[0] === 'string' && args[0].includes('[vite]')) {
      return true;
    }
    return false;
  };
  const originalLog = console.log;
  console.log = function(...args) {
    if (ignoreViteLog(args)) return;
    originalLog.apply(console, args);
  };
  const originalInfo = console.info;
  console.info = function(...args) {
    if (ignoreViteLog(args)) return;
    originalInfo.apply(console, args);
  };
  const originalDebug = console.debug;
  console.debug = function(...args) {
    if (ignoreViteLog(args)) return;
    originalDebug.apply(console, args);
  };
  const originalWarn = console.warn;
  console.warn = function(...args) {
    if (ignoreViteLog(args)) return;
    originalWarn.apply(console, args);
  };
})();
