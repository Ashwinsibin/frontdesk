import { Router } from 'express';
import { pool, query } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { jitSweeperMiddleware } from '../middleware/jitSweeperMiddleware.js';
import { logAuditEvent } from '../services/auditService.js';
import { getHolidaySet } from '../services/sweeperService.js';
import { 
  calculateInitialSLADeadlines, 
  resumePausedSLA, 
  checkReopenEligibility,
  getTicketSLAInfo
} from '../services/slaEngine.js';

const router = Router();

// Enforce customer role for all routes in this file
router.use(authenticate, requireRole('customer'), jitSweeperMiddleware);

/**
 * POST /api/customer/tickets
 * Customer creates a new support ticket
 */
router.post('/tickets', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, priority = 'medium' } = req.body;
    const customerId = req.user.id;

    if (!title || !title.trim() || !description || !description.trim()) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    if (!['urgent', 'medium', 'small'].includes(priority)) {
      return res.status(400).json({ error: "Priority must be 'urgent', 'medium', or 'small'." });
    }

    // Generate human-readable ticket number (TCK-XXXX)
    const countRes = await client.query("SELECT nextval('tickets_id_seq') as next_id");
    const nextId = countRes.rows[0].next_id;
    const ticketNumber = `TCK-${String(nextId).padStart(4, '0')}`;

    const holidaySet = await getHolidaySet(client);
    const createdAt = new Date();

    // Calculate initial SLA deadlines using Asia/Kolkata business calendar
    const { firstResponseDueAt, resolutionDueAt } = calculateInitialSLADeadlines(
      priority,
      createdAt,
      holidaySet
    );

    const insertRes = await client.query(`
      INSERT INTO tickets (
        id, ticket_number, title, description, customer_id, 
        status, priority, first_response_due_at, resolution_due_at, 
        last_customer_reply_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'new', $6, $7, $8, $9, $9, $9)
      RETURNING *
    `, [
      nextId,
      ticketNumber,
      title.trim(),
      description.trim(),
      customerId,
      priority,
      firstResponseDueAt,
      resolutionDueAt,
      createdAt
    ]);

    const newTicket = insertRes.rows[0];

    // Append to immutable audit log
    await logAuditEvent({
      client,
      ticketId: newTicket.id,
      actorId: customerId,
      actorRole: 'customer',
      action: 'ticket_created',
      newValue: {
        ticket_number: ticketNumber,
        title: newTicket.title,
        priority: newTicket.priority,
        first_response_due_at: firstResponseDueAt,
        resolution_due_at: resolutionDueAt
      },
      details: `Ticket created by customer ${req.user.name}`
    });

    await client.query('COMMIT');
    res.status(201).json(newTicket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/customer/tickets
 * List tickets belonging exclusively to the authenticated customer
 */
router.get('/tickets', async (req, res) => {
  try {
    const customerId = req.user.id;
    const result = await query(`
      SELECT id, ticket_number, title, description, category, status, priority, 
             first_response_due_at, resolution_due_at, resolved_at, 
             reopen_deadline_at, closed_at, created_at, updated_at
      FROM tickets
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `, [customerId]);

    const holidaySet = await getHolidaySet();
    const now = new Date();
    const enriched = result.rows.map(row => {
      const slaInfo = getTicketSLAInfo(row, now, holidaySet);
      return {
        ...row,
        sla_info: slaInfo,
        is_overdue: slaInfo.is_overdue
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Error listing customer tickets:', err);
    res.status(500).json({ error: 'Failed to retrieve tickets.' });
  }
});

/**
 * GET /api/customer/tickets/:id
 * Customer ticket view: STRICT PRIVACY ISOLATION
 * Internal notes are NEVER returned to customers under any circumstances.
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const customerId = req.user.id;

    // Verify ticket ownership
    const ticketRes = await query(`
      SELECT id, ticket_number, title, description, category, status, priority,
             first_response_due_at, resolution_due_at, resolved_at,
             reopen_deadline_at, closed_at, created_at, updated_at
      FROM tickets
      WHERE id = $1 AND customer_id = $2
    `, [ticketId, customerId]);

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found or access denied.' });
    }

    const ticket = ticketRes.rows[0];
    const holidaySet = await getHolidaySet();
    const slaInfo = getTicketSLAInfo(ticket, new Date(), holidaySet);
    ticket.sla_info = slaInfo;
    ticket.is_overdue = slaInfo.is_overdue;

    // CRITICAL: Fetch ONLY messages with message_type = 'public_reply'
    // Internal notes are strictly excluded at both the query and application layer
    const messagesRes = await query(`
      SELECT m.id, m.content, m.created_at, m.message_type,
             u.name as sender_name, u.role as sender_role
      FROM ticket_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.ticket_id = $1 AND m.message_type = 'public_reply'
      ORDER BY m.created_at ASC
    `, [ticketId]);

    // Extra sanitization: enforce public_reply only in returned payload
    const safeMessages = messagesRes.rows
      .filter(m => m.message_type === 'public_reply')
      .map(({ id, content, created_at, sender_name, sender_role }) => ({
        id, content, created_at, sender_name, sender_role
      }));

    res.json({
      ticket,
      messages: safeMessages
    });
  } catch (err) {
    console.error('Error fetching customer ticket detail:', err);
    res.status(500).json({ error: 'Failed to load ticket details.' });
  }
});

/**
 * POST /api/customer/tickets/:id/reply
 * Customer sends a reply to an ongoing ticket
 */
router.post('/tickets/:id/reply', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;
    const { content } = req.body;
    const customerId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Reply content cannot be empty.' });
    }

    const ticketRes = await client.query(`
      SELECT * FROM tickets 
      WHERE id = $1 AND customer_id = $2
      FOR UPDATE
    `, [ticketId, customerId]);

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found or access denied.' });
    }
    const ticket = ticketRes.rows[0];

    if (ticket.status === 'closed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket is closed. Please create a new ticket.' });
    }

    if (ticket.status === 'resolved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Ticket is resolved. Please click "Reopen Ticket" if you need further help.' 
      });
    }

    // Insert public reply message
    const msgRes = await client.query(`
      INSERT INTO ticket_messages (ticket_id, sender_id, message_type, content)
      VALUES ($1, $2, 'public_reply', $3)
      RETURNING id, content, created_at
    `, [ticketId, customerId, content.trim()]);
    const message = msgRes.rows[0];

    const now = new Date();
    const holidaySet = await getHolidaySet(client);

    // If ticket was paused in 'pending_customer', resume SLA timers
    if (ticket.status === 'pending_customer') {
      const resumed = resumePausedSLA(ticket, now, holidaySet);

      await client.query(`
        UPDATE tickets
        SET status = 'open',
            first_response_due_at = $1,
            resolution_due_at = $2,
            total_paused_working_minutes = $3,
            sla_paused_at = NULL,
            waiting_customer_since = NULL,
            last_customer_reply_at = $4,
            updated_at = $4
        WHERE id = $5
      `, [
        resumed.firstResponseDueAt,
        resumed.resolutionDueAt,
        resumed.totalPausedWorkingMinutes,
        now,
        ticketId
      ]);

      await logAuditEvent({
        client,
        ticketId,
        actorId: customerId,
        actorRole: 'customer',
        action: 'customer_replied',
        oldValue: { status: 'pending_customer' },
        newValue: { 
          status: 'open', 
          paused_minutes_added: resumed.pausedWorkingMinutes,
          new_resolution_due: resumed.resolutionDueAt 
        },
        details: `Customer replied. SLA timers resumed (shifted forward by ${resumed.pausedWorkingMinutes} paused working minutes).`
      });
    } else {
      await client.query(`
        UPDATE tickets
        SET last_customer_reply_at = $1,
            updated_at = $1
        WHERE id = $2
      `, [now, ticketId]);

      await logAuditEvent({
        client,
        ticketId,
        actorId: customerId,
        actorRole: 'customer',
        action: 'customer_replied',
        details: 'Customer added a reply to active ticket'
      });
    }

    await client.query('COMMIT');
    res.status(201).json(message);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Customer reply error:', err);
    res.status(500).json({ error: 'Failed to send reply.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/customer/tickets/:id/reopen
 * Reopen a resolved ticket within the 7-calendar-day window
 */
router.post('/tickets/:id/reopen', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;
    const customerId = req.user.id;

    const ticketRes = await client.query(`
      SELECT * FROM tickets 
      WHERE id = $1 AND customer_id = $2 
      FOR UPDATE
    `, [ticketId, customerId]);

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found or access denied.' });
    }
    const ticket = ticketRes.rows[0];

    // Enforce 7-calendar-day window
    const eligibility = checkReopenEligibility(ticket, new Date());
    if (!eligibility.canReopen) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: eligibility.reason });
    }

    const now = new Date();

    const updateRes = await client.query(`
      UPDATE tickets
      SET status = 'open',
          reopened_at = $1,
          updated_at = $1
      WHERE id = $2
      RETURNING *
    `, [now, ticketId]);

    const updatedTicket = updateRes.rows[0];

    await logAuditEvent({
      client,
      ticketId,
      actorId: customerId,
      actorRole: 'customer',
      action: 'ticket_reopened',
      oldValue: { status: 'resolved' },
      newValue: { status: 'open', reopened_at: now },
      details: 'Customer reopened resolved ticket within the 7-calendar-day window.'
    });

    await client.query('COMMIT');
    res.json(updatedTicket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Ticket reopen error:', err);
    res.status(500).json({ error: 'Failed to reopen ticket.' });
  } finally {
    client.release();
  }
});

export default router;
