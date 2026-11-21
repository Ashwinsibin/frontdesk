import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'frontdesk_super_secret_jwt_key_2026_inav_test';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status || 'active' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Authentication Middleware: Validates Bearer JWT Token
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists in DB and account is active
    const userRes = await query('SELECT id, name, email, role, status, is_active FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    const user = userRes.rows[0];
    if (user.status === 'inactive' || user.is_active === false) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Role-Based Access Control Middleware
 * @param  {...string} allowedRoles 
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Route requires one of [${allowedRoles.join(', ')}] role.` 
      });
    }
    next();
  };
}
