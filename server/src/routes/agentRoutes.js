import { Router } from 'express';
import { pool, query } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { jitSweeperMiddleware } from '../middleware/jitSweeperMiddleware.js';
import { logAuditEvent, getTicketAuditTrail } from '../services/auditService.js';
import { getHolidaySet } from '../services/sweeperService.js';
import { 
  recalculateSLAOnPriorityChange, 
  resumePausedSLA, 
  addWorkingMinutes, 
  toIST,
  formatISTDate,
  makeISTDate,
  WORK_END_MIN,
  getTicketSLAInfo
} from '../services/slaEngine.js';

const router = Router();

// Enforce agent role for all routes in this file
router.use(authenticate, requireRole('agent', 'admin'), jitSweeperMiddleware);

/**
 * GET /api/agent/tickets
 * Query ticket queue with rich filtering, search, and SLA health indicators
 */
router.get('/tickets', async (req, res) => {
  try {
    const { status, priority, filter, search } = req.query;
    const currentAgentId = req.user.id;

    let sql = `
      SELECT t.*, 
             c.name as customer_name, c.email as customer_email,
             a.name as agent_name, a.email as agent_email
      FROM tickets t
      JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_agent_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND t.status = $${params.length}`;
    }

    if (priority && priority !== 'all') {
      params.push(priority);
      sql += ` AND t.priority = $${params.length}`;
    }

    if (filter === 'unassigned') {
      sql += ' AND t.assigned_agent_id IS NULL';
    } else if (filter === 'my_tickets') {
      params.push(currentAgentId);
      sql += ` AND t.assigned_agent_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (t.ticket_number ILIKE $${params.length} OR t.title ILIKE $${params.length} OR t.description ILIKE $${params.length} OR c.name ILIKE $${params.length})`;
    }

    sql += `
      ORDER BY 
        CASE 
          WHEN t.status = 'closed' THEN 4
          WHEN t.status = 'resolved' THEN 3
          WHEN t.priority = 'urgent' THEN 1
          WHEN t.priority = 'medium' THEN 2
          ELSE 3
        END,
        t.first_response_due_at ASC,
        t.created_at DESC
    `;

    const result = await query(sql, params);
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
    console.error('Error fetching agent tickets:', err);
    res.status(500).json({ error: 'Failed to retrieve ticket queue.' });
  }
});

/**
 * GET /api/agent/tickets/:id
 * Full ticket details, public replies, internal notes, and audit history
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;

    const ticketRes = await query(`
      SELECT t.*, 
             c.name as customer_name, c.email as customer_email,
             a.name as agent_name, a.email as agent_email
      FROM tickets t
      JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_agent_id = a.id
      WHERE t.id = $1
    `, [ticketId]);

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = ticketRes.rows[0];
    const holidaySet = await getHolidaySet();
    const slaInfo = getTicketSLAInfo(ticket, new Date(), holidaySet);
    ticket.sla_info = slaInfo;
    ticket.is_overdue = slaInfo.is_overdue;

    // Fetch messages (Agent sees both public_reply and internal_note)
    const messagesRes = await query(`
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM ticket_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC
    `, [ticketId]);

    // Fetch full audit trail
    const auditTrail = await getTicketAuditTrail(ticketId);

    res.json({
      ticket,
      messages: messagesRes.rows,
      auditTrail
    });
  } catch (err) {
    console.error('Error loading ticket details:', err);
    res.status(500).json({ error: 'Failed to retrieve ticket details.' });
  }
});

/**
 * POST /api/agent/tickets/:id/claim
 * ATOMIC SINGLE-AGENT CLAIM with Concurrency Protection
 */
router.post('/tickets/:id/claim', async (req, res) => {
  // Prevent deactivated agents from claiming tickets
  if (req.user.status === 'inactive' || req.user.is_active === false) {
    return res.status(403).json({ error: 'Deactivated agents cannot claim tickets.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;
    const agentId = req.user.id;

    // Concurrency Guard: Atomic update succeeds only if assigned_agent_id IS NULL
    const claimRes = await client.query(`
      UPDATE tickets
      SET assigned_agent_id = $1,
          status = CASE WHEN status = 'new' THEN 'open' ELSE status END,
          updated_at = NOW()
      WHERE id = $2 AND assigned_agent_id IS NULL
      RETURNING *
    `, [agentId, ticketId]);

    if (claimRes.rowCount === 0) {
      await client.query('ROLLBACK');
      // Fetch who owns it to give clear, informative conflict feedback
      const currentRes = await query(`
        SELECT a.name as current_agent_name 
        FROM tickets t 
        JOIN users a ON t.assigned_agent_id = a.id 
        WHERE t.id = $1
      `, [ticketId]);
      const owner = currentRes.rows[0]?.current_agent_name || 'another agent';
      return res.status(409).json({ 
        error: `Conflict: Ticket has already been claimed by ${owner}. Only one agent can take a ticket.` 
      });
    }

    const updatedTicket = claimRes.rows[0];

    // Append to immutable audit log
    await logAuditEvent({
      client,
      ticketId,
      actorId: agentId,
      actorRole: req.user.role,
      action: 'ticket_claimed',
      oldValue: { assigned_agent_id: null },
      newValue: { assigned_agent_id: agentId, agent_name: req.user.name },
      details: `Ticket claimed exclusively by agent ${req.user.name}`
    });

    await client.query('COMMIT');
    res.json(updatedTicket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Failed to claim ticket.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/agent/tickets/:id/messages
 * Post public customer-visible reply OR private internal note
 */
router.post('/tickets/:id/messages', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;
    const { messageType, content } = req.body;
    const agentId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    if (!['public_reply', 'internal_note'].includes(messageType)) {
      return res.status(400).json({ error: "messageType must be either 'public_reply' or 'internal_note'." });
    }

    const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = ticketRes.rows[0];

    // Insert message record
    const msgRes = await client.query(`
      INSERT INTO ticket_messages (ticket_id, sender_id, message_type, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [ticketId, agentId, messageType, content.trim()]);
    const message = msgRes.rows[0];

    if (messageType === 'internal_note') {
      // Internal note: does NOT affect customer SLA or customer visibility
      await logAuditEvent({
        client,
        ticketId,
        actorId: agentId,
        actorRole: req.user.role,
        action: 'internal_note_added',
        details: 'Private internal note recorded by agent'
      });
    } else {
      // Public reply: records first response if pending, and transitions status
      const now = new Date();
      let firstRespondedAt = ticket.first_responded_at;
      let firstResponseBreached = ticket.first_response_breached;

      if (!firstRespondedAt) {
        firstRespondedAt = now;
        firstResponseBreached = now > new Date(ticket.first_response_due_at);
      }

      // Public reply from agent puts ticket into 'pending_customer' and pauses SLA timers
      await client.query(`
        UPDATE tickets
        SET status = 'pending_customer',
            first_responded_at = COALESCE(first_responded_at, $1),
            first_response_breached = $2,
            sla_paused_at = COALESCE(sla_paused_at, $3),
            waiting_customer_since = COALESCE(waiting_customer_since, $3),
            last_agent_reply_at = $3,
            updated_at = $3
        WHERE id = $4
      `, [firstRespondedAt, firstResponseBreached, now, ticketId]);

      await logAuditEvent({
        client,
        ticketId,
        actorId: agentId,
        actorRole: req.user.role,
        action: 'public_reply_sent',
        oldValue: { status: ticket.status },
        newValue: { status: 'pending_customer', sla_paused_at: now },
        details: 'Public customer reply sent. SLA timers paused awaiting customer response.'
      });
    }

    await client.query('COMMIT');
    res.status(201).json(message);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error posting agent message:', err);
    res.status(500).json({ error: 'Failed to post message.' });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/agent/tickets/:id/priority
 * Recalculates SLA targets using independent priority policy & logs audit trail
 */
router.patch('/tickets/:id/priority', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;
    const { priority: newPriority } = req.body;

    if (!['urgent', 'medium', 'small'].includes(newPriority)) {
      return res.status(400).json({ error: "Invalid priority. Must be 'urgent', 'medium', or 'small'." });
    }

    const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = ticketRes.rows[0];
    const oldPriority = ticket.priority;

    if (oldPriority === newPriority) {
      await client.query('ROLLBACK');
      return res.json(ticket);
    }

    const holidaySet = await getHolidaySet(client);
    const now = new Date();

    // Calculate recalculated SLA targets
    const recalculated = recalculateSLAOnPriorityChange(ticket, newPriority, now, holidaySet);

    // Update ticket
    const updateRes = await client.query(`
      UPDATE tickets
      SET priority = $1,
          first_response_due_at = $2,
          first_response_breached = $3,
          resolution_due_at = $4,
          resolution_breached = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      newPriority,
      recalculated.firstResponseDueAt,
      recalculated.firstResponseBreached,
      recalculated.resolutionDueAt,
      recalculated.resolutionBreached,
      ticketId
    ]);

    const updatedTicket = updateRes.rows[0];

    // Audit log entry
    await logAuditEvent({
      client,
      ticketId,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'priority_changed',
      oldValue: { 
        priority: oldPriority, 
        resolution_due_at: ticket.resolution_due_at,
        first_response_due_at: ticket.first_response_due_at 
      },
      newValue: { 
        priority: newPriority, 
        resolution_due_at: recalculated.resolutionDueAt,
        first_response_due_at: recalculated.firstResponseDueAt 
      },
      details: `Priority changed from ${oldPriority} to ${newPriority}. SLA deadlines recalculated.`
    });

    await client.query('COMMIT');
    res.json(updatedTicket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Priority change error:', err);
    res.status(500).json({ error: 'Failed to update ticket priority.' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/agent/tickets/:id/resolve
 * Mark ticket resolved; starts 7-calendar-day customer reopen window
 */
router.post('/tickets/:id/resolve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticketId = req.params.id;

    const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }
    const ticket = ticketRes.rows[0];

    const now = new Date();
    // 7 calendar days from now
    const reopenDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const resolutionBreached = now > new Date(ticket.resolution_due_at);

    const updateRes = await client.query(`
      UPDATE tickets
      SET status = 'resolved',
          resolved_at = $1,
          reopen_deadline_at = $2,
          resolution_breached = $3,
          sla_paused_at = NULL,
          updated_at = $1
      WHERE id = $4
      RETURNING *
    `, [now, reopenDeadline, resolutionBreached, ticketId]);

    const updatedTicket = updateRes.rows[0];

    await logAuditEvent({
      client,
      ticketId,
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ticket_resolved',
      oldValue: { status: ticket.status },
      newValue: { status: 'resolved', resolved_at: now, reopen_deadline_at: reopenDeadline },
      details: `Ticket marked resolved by agent ${req.user.name}. Customer 7-calendar-day reopen window initiated.`
    });

    await client.query('COMMIT');
    res.json(updatedTicket);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve ticket.' });
  } finally {
    client.release();
  }
});

export default router;
