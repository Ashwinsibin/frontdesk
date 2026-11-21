import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { signToken, authenticate, requireRole } from '../middleware/authMiddleware.js';
import { logAdminAction } from '../services/adminLogService.js';

const router = Router();

// Standard RFC-compliant email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * POST /api/auth/register
 * PUBLIC REGISTRATION: Always strictly assigns role = 'customer'.
 * Any role parameter supplied by the frontend or request payload is explicitly IGNORED.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email Address is required.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (!confirmPassword) {
      return res.status(400).json({ error: 'Please confirm your password.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Validate email format
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // 3. Check password and confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // 4. Enforce secure password requirements (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // 5. Check for duplicate email address
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // 6. Hash password securely using bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // 7. Store user in Neon PostgreSQL database.
    // CRITICAL SECURITY RULE: Public registration ALWAYS assigns 'customer' role.
    // Frontend payload role is completely disregarded.
    const insertRes = await query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'customer')
      RETURNING id, name, email, role, created_at
    `, [trimmedName, normalizedEmail, passwordHash]);

    const newUser = insertRes.rows[0];

    res.status(201).json({
      message: 'Customer account registered successfully. You can now sign in.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at
      }
    });
  } catch (err) {
    console.error('Public registration error:', err);
    res.status(500).json({ error: 'Server error during account registration. Please try again.' });
  }
});

/**
 * POST /api/auth/register-agent
 * SUPPORT AGENT REGISTRATION: Requires a valid, unexpired administrator invitation token.
 */
router.post('/register-agent', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, inviteToken } = req.body;

    if (!inviteToken || !inviteToken.trim()) {
      return res.status(403).json({ error: 'An administrator invitation token is required to register as a Support Agent.' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full Name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email Address is required.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (!confirmPassword) {
      return res.status(400).json({ error: 'Please confirm your password.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedToken = inviteToken.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // 1. Validate invitation token from database
    const inviteRes = await query(`
      SELECT * FROM agent_invitations
      WHERE token = $1
    `, [normalizedToken]);

    if (inviteRes.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid invitation token.' });
    }

    const invitation = inviteRes.rows[0];

    if (invitation.revoked_at) {
      return res.status(403).json({ error: 'This invitation token has been revoked by an administrator.' });
    }

    if (invitation.used_at) {
      return res.status(403).json({ error: 'This invitation token has already been used.' });
    }

    if (new Date() > new Date(invitation.expires_at)) {
      return res.status(403).json({ error: 'This invitation token has expired.' });
    }

    // Invitation token must match the designated invited email address
    if (invitation.email.toLowerCase() !== normalizedEmail) {
      return res.status(403).json({ 
        error: `Invitation token was issued for ${invitation.email}, but registration attempted for ${normalizedEmail}.` 
      });
    }

    // 2. Check for duplicate user
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Create Support Agent user and mark invitation used
    const insertRes = await query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'agent')
      RETURNING id, name, email, role, created_at
    `, [trimmedName, normalizedEmail, passwordHash]);

    await query(`
      UPDATE agent_invitations
      SET used_at = NOW()
      WHERE id = $1
    `, [invitation.id]);

    const newAgent = insertRes.rows[0];

    res.status(201).json({
      message: 'Support Agent account registered successfully. You can now sign in.',
      user: {
        id: newAgent.id,
        name: newAgent.name,
        email: newAgent.email,
        role: newAgent.role,
        created_at: newAgent.created_at
      }
    });
  } catch (err) {
    console.error('Agent registration error:', err);
    res.status(500).json({ error: 'Server error during agent registration.' });
  }
});

/**
 * POST /api/auth/invite-agent
 * PROTECTED: Only an authenticated Administrator can create an agent invitation token.
 */
router.post('/invite-agent', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Recipient agent email is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    // Check if user already exists
    const existing = await query('SELECT id, role FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `A user with email ${normalizedEmail} already exists (${existing.rows[0].role}).` });
    }

    // Generate secure random token
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration

    const insertRes = await query(`
      INSERT INTO agent_invitations (email, token, created_by, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, token, expires_at, created_at
    `, [normalizedEmail, token, req.user.id, expiresAt]);

    const invitation = insertRes.rows[0];

    // Log admin action in immutable audit log
    await logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'invitation_created',
      targetType: 'invitation',
      targetId: invitation.id,
      details: `Generated agent invitation token for ${normalizedEmail}`,
      metadata: { email: normalizedEmail, expires_at: invitation.expires_at }
    }).catch(err => console.error('Failed to log admin invitation action:', err));

    res.status(201).json({
      message: 'Agent invitation token generated successfully.',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        created_at: invitation.created_at
      }
    });
  } catch (err) {
    console.error('Invite agent error:', err);
    res.status(500).json({ error: 'Failed to create agent invitation.' });
  }
});

/**
 * POST /api/auth/create-admin
 * PROTECTED: Only an existing authorized Administrator can create new administrator accounts.
 */
router.post('/create-admin', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !name.trim() || !email || !email.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertRes = await query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'admin')
      RETURNING id, name, email, role, created_at
    `, [trimmedName, normalizedEmail, passwordHash]);

    res.status(201).json({
      message: 'Administrator account created successfully.',
      user: insertRes.rows[0]
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Failed to create administrator account.' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await query('SELECT * FROM users WHERE LOWER(email) = $1', [email.toLowerCase().trim()]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if account has been deactivated by administrator
    if (user.status === 'inactive' || user.is_active === false) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact an administrator.' });
    }

    // Log admin login to immutable audit log
    if (user.role === 'admin') {
      await logAdminAction({
        adminId: user.id,
        adminName: user.name,
        adminEmail: user.email,
        action: 'admin_login',
        targetType: 'auth',
        targetId: user.id,
        details: `Administrator ${user.name} logged into the system.`
      }).catch(err => console.error('Error logging admin login:', err));
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
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
    const result = await query('SELECT id, name, email, role, status, is_active FROM users ORDER BY role, id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
