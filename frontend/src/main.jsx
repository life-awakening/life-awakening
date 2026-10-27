import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ─── Legacy Service Worker & Stale Cache Recovery ─────────────────────────────
// Purges any orphaned /sw.js worker previously registered under the origin scope.
// If an active legacy worker was controlling the page session, performs a single,
// sessionStorage-guarded reload to immediately grant a clean, worker-free DOM.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let hasLegacyWorker = false;
    const unregisterPromises = [];

    for (const reg of registrations) {
      const worker = reg.active || reg.waiting || reg.installing;
      if (worker) {
        try {
          const scriptUrl = new URL(worker.scriptURL, window.location.origin);
          if (scriptUrl.pathname === '/sw.js') {
            hasLegacyWorker = true;
            unregisterPromises.push(reg.unregister());
          }
        } catch (_) {}
      }
    }

    if (hasLegacyWorker) {
      Promise.all(unregisterPromises).then(() => {
        if (navigator.serviceWorker.controller && !sessionStorage.getItem('ltc_sw_purged')) {
          sessionStorage.setItem('ltc_sw_purged', '1');
          window.location.reload();
        }
      });
    }
  }).catch(() => {});

  // Delete only verified obsolete LTC cache buckets
  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.startsWith('ltc-')) {
          caches.delete(key).catch(() => {});
        }
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


