const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error("CRITICAL: JWT_SECRET is not configured! Please configure it in your .env file.");
}

const authMiddleware = (roles = []) => (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const authHeader = req.headers.authorization || (req.query?.token ? `Bearer ${req.query.token}` : null);
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;

    const userRole = (decoded.role || '').toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    // 1. Superadmin has full unrestricted access
    if (userRole === 'superadmin') {
      return next();
    }

    // 2. Read-only superadmins (LTC and RI) have access to all GET routes across the app,
    // but are strictly blocked on mutations (POST/PUT/DELETE) unless explicitly allowed in the roles array.
    if (userRole === 'superadmin_readonly' || userRole === 'superadmin_ri_readonly' || userRole === 'superadmin-ri-readonly') {
      if (req.method === 'GET' || allowedRoles.includes(userRole)) {
        return next();
      }
      return res.status(403).json({ message: 'Unauthorized: Read-only super admins cannot perform modifications.' });
    }

    // 3. Delegated Pre/Post Admin has access to GET routes (batches, reports, feedback)
    if (decoded.is_pre_post_admin && req.method === 'GET') {
      return next();
    }

    if (allowedRoles.length && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Unauthorized role' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
