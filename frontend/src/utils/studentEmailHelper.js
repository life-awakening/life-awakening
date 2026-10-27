/**
 * Shared Student Email Formatting and Sanitization Helpers
 *
 * Life Awakening students often do not have personal email addresses.
 * The system generates placeholder addresses ending in '@lifeawakening.internal'
 * for internal database uniqueness and authentication.
 *
 * These helpers guarantee that:
 * 1. Internal placeholder addresses ending in '@lifeawakening.internal' are NEVER displayed in UI.
 * 2. Only genuine email addresses are displayed.
 * 3. When no genuine email is available, a clean fallback (default: 'Not provided') is shown.
 * 4. Parent emails are distinguished and never masqueraded as student emails.
 */

export const isInternalStudentEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return clean.endsWith('@lifeawakening.internal') || clean.includes('@lifeawakening.internal');
};

export const formatStudentEmail = (email, fallback = 'Not provided') => {
  if (!email || typeof email !== 'string') return fallback;
  const clean = email.trim();
  if (isInternalStudentEmail(clean)) return fallback;
  return clean || fallback;
};

export default {
  isInternalStudentEmail,
  formatStudentEmail,
};
