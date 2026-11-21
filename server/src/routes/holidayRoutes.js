import { Router } from 'express';
import { query } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * GET /api/holidays
 * Public listing of company / festival holidays
 */
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM holidays ORDER BY holiday_date ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve holidays.' });
  }
});

/**
 * POST /api/holidays
 * Add new festival holiday (Agent / Admin only)
 */
router.post('/', authenticate, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { holidayDate, description } = req.body;
    if (!holidayDate || !description) {
      return res.status(400).json({ error: 'holidayDate (YYYY-MM-DD) and description are required.' });
    }

    const insertRes = await query(`
      INSERT INTO holidays (holiday_date, description)
      VALUES ($1, $2)
      ON CONFLICT (holiday_date) DO UPDATE SET description = EXCLUDED.description
      RETURNING *
    `, [holidayDate, description.trim()]);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add holiday.' });
  }
});

export default router;
