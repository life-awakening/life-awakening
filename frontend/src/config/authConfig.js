/**
 * Life Awakening Authentication & Security Configuration
 *
 * REQUIRE_STUDENT_PASSWORD_CHANGE:
 * Set to false to temporarily disable the compulsory first-time password change
 * requirement for students logging into the Life Awakening Student Panel.
 *
 * When false:
 * - Students access their dashboard immediately after successful login without redirection to /reset-password.
 * - Route guards allow access to /student regardless of whether password_changed is false.
 * - Voluntary password changes inside account settings or via OTP remain fully functional.
 *
 * To re-enable mandatory first-time password updates in the future, change this flag back to true.
 */
export const REQUIRE_STUDENT_PASSWORD_CHANGE = false;
