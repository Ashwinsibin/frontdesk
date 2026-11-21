import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { signToken, authenticate } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * POST /api/auth/register (Customer self-registration)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertRes = await query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'customer')
      RETURNING id, name, email, role, created_at
    `, [name.trim(), email.toLowerCase().trim(), hash]);

    const newUser = insertRes.rows[0];
    const token = signToken(newUser);

    res.status(201).json({
      token,
      user: newUser
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/demo-users
 * Convenient helper to switch identities during testing & machine test demo
 */
router.get('/demo-users', async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role FROM users ORDER BY role, id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
