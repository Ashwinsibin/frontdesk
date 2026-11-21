import { Router } from 'express';
import crypto from 'crypto';
import { pool, query } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';
import { logAuditEvent } from '../services/auditService.js';
import { logAdminAction, getAdminActivityLogs } from '../services/adminLogService.js';
import { recalculateSLAOnPriorityChange, getTicketSLAInfo } from '../services/slaEngine.js';
import { getHolidaySet } from '../services/sweeperService.js';

const router = Router();

// SECURITY RULE: Strictly require authentication and 'admin' role on all routes
router.use(authenticate, requireRole('admin'));

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * GET /api/admin/overview
 * KPI statistics cards and chart datasets
 */
router.get('/overview', async (req, res) => {
  try {
    // 1. KPI Counts
    const countsRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'agent') as total_agents,
        (SELECT COUNT(*) FROM users WHERE role = 'agent' AND (status = 'active' OR status IS NULL)) as active_agents,
        (SELECT COUNT(*) FROM users WHERE role = 'agent' AND status = 'inactive') as inactive_agents,
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status IN ('new', 'open', 'pending_customer')) as open_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'resolved') as resolved_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'closed') as closed_tickets,
        (SELECT COUNT(*) FROM tickets 
         WHERE status NOT IN ('resolved', 'closed', 'pending_customer') 
           AND (resolution_due_at < NOW() OR (first_responded_at IS NULL AND first_response_due_at < NOW()))) as overdue_tickets,
        (SELECT COUNT(*) FROM agent_invitations 
         WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()) as pending_invitations
    `);

    // 2. Tickets By Priority
    const priorityRes = await query(`
      SELECT priority, COUNT(*)::int as count 
      FROM tickets 
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END
    `);

    // 3. Tickets By Status
    const statusRes = await query(`
      SELECT status, COUNT(*)::int as count 
      FROM tickets 
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'new' THEN 1 
          WHEN 'open' THEN 2 
          WHEN 'pending_customer' THEN 3 
          WHEN 'resolved' THEN 4 
          ELSE 5 
        END
    `);

    // 4. Tickets Created Over Time (Daily distribution for last 14 days)
    const timeRes = await query(`
      SELECT 
        TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date,
        COUNT(*)::int as count
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY date
      ORDER BY date ASC
    `);

    // 5. Agent Performance Comparison (Assigned vs Resolved per agent)
    const agentPerfRes = await query(`
      SELECT 
        u.id, u.name, u.email, u.status,
        COUNT(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 END)::int as active_tickets,
        COUNT(CASE WHEN t.status = 'resolved' THEN 1 END)::int as resolved_tickets,
        COUNT(t.id)::int as total_tickets
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id
      WHERE u.role = 'agent'
      GROUP BY u.id, u.name, u.email, u.status
      ORDER BY resolved_tickets DESC, active_tickets DESC
    `);

    res.json({
      metrics: {
        totalCustomers: parseInt(countsRes.rows[0].total_customers, 10),
        totalAgents: parseInt(countsRes.rows[0].total_agents, 10),
        activeAgents: parseInt(countsRes.rows[0].active_agents, 10),
        inactiveAgents: parseInt(countsRes.rows[0].inactive_agents, 10),
        totalTickets: parseInt(countsRes.rows[0].total_tickets, 10),
        openTickets: parseInt(countsRes.rows[0].open_tickets, 10),
        resolvedTickets: parseInt(countsRes.rows[0].resolved_tickets, 10),
        closedTickets: parseInt(countsRes.rows[0].closed_tickets, 10),
        overdueTickets: parseInt(countsRes.rows[0].overdue_tickets, 10),
        pendingInvitations: parseInt(countsRes.rows[0].pending_invitations, 10)
      },
      charts: {
        ticketsByPriority: priorityRes.rows,
        ticketsByStatus: statusRes.rows,
        ticketsOverTime: timeRes.rows,
        agentPerformance: agentPerfRes.rows
      }
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin overview statistics.' });
  }
});

/**
 * GET /api/admin/agents
 * View all registered support agents with status and ticket loads
 */
router.get('/agents', async (req, res) => {
  try {
    const { search, status } = req.query;

    let sql = `
      SELECT 
        u.id, u.name, u.email, 
        COALESCE(u.status, 'active') as status,
        COALESCE(u.is_active, TRUE) as is_active,
        u.created_at,
        COUNT(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 END)::int as assigned_count,
        COUNT(CASE WHEN t.status = 'resolved' THEN 1 END)::int as resolved_count,
        COUNT(CASE WHEN t.status = 'pending_customer' THEN 1 END)::int as pending_count,
        COUNT(CASE WHEN t.status NOT IN ('resolved', 'closed', 'pending_customer') AND (t.resolution_due_at < NOW() OR (t.first_responded_at IS NULL AND t.first_response_due_at < NOW())) THEN 1 END)::int as overdue_count,
        COUNT(t.id)::int as total_handled
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id
      WHERE u.role = 'agent'
    `;
    const params = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND COALESCE(u.status, 'active') = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
    }

    sql += `
      GROUP BY u.id, u.name, u.email, u.status, u.is_active, u.created_at
      ORDER BY u.name ASC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching support agents:', err);
    res.status(500).json({ error: 'Failed to retrieve support agents.' });
  }
});

/**
 * PATCH /api/admin/agents/:id/status
 * Deactivate or Reactivate a support agent with ticket reassignment
 */
router.patch('/agents/:id/status', async (req, res) => {
  const agentId = parseInt(req.params.id, 10);
  const { status, reassignTicketsTo } = req.body;

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: "Status must be either 'active' or 'inactive'." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify agent exists
    const agentRes = await client.query(`
      SELECT id, name, email, role, status FROM users WHERE id = $1 AND role = 'agent'
    `, [agentId]);

    if (agentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Support agent not found.' });
    }

    const agent = agentRes.rows[0];

    // 2. If deactivating, handle active tickets reassignment if specified
    let reassignedCount = 0;
    let targetAgentName = null;

    if (status === 'inactive' && reassignTicketsTo) {
      const targetId = parseInt(reassignTicketsTo, 10);
      if (targetId === agentId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot reassign tickets to the agent being deactivated.' });
      }

      // Verify target agent is active
      const targetRes = await client.query(`
        SELECT id, name, email, status FROM users 
        WHERE id = $1 AND role = 'agent' AND (status = 'active' OR status IS NULL)
      `, [targetId]);

      if (targetRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Target agent for reassignment does not exist or is inactive.' });
      }

      targetAgentName = targetRes.rows[0].name;

      // Fetch active tickets belonging to deactivated agent
      const activeTicketsRes = await client.query(`
        SELECT id, ticket_number, title 
        FROM tickets 
        WHERE assigned_agent_id = $1 AND status NOT IN ('resolved', 'closed')
      `, [agentId]);

      // Reassign all active tickets
      const updateTicketsRes = await client.query(`
        UPDATE tickets
        SET assigned_agent_id = $1, updated_at = NOW()
        WHERE assigned_agent_id = $2 AND status NOT IN ('resolved', 'closed')
        RETURNING id, ticket_number
      `, [targetId, agentId]);

      reassignedCount = updateTicketsRes.rowCount;

      // Write immutable audit log for each reassigned ticket
      for (const t of activeTicketsRes.rows) {
        await logAuditEvent({
          client,
          ticketId: t.id,
          actorId: req.user.id,
          actorRole: 'admin',
          action: 'ticket_reassigned',
          oldValue: { assigned_agent_id: agentId, agent_name: agent.name },
          newValue: { assigned_agent_id: targetId, agent_name: targetAgentName },
          details: `Ticket reassigned from ${agent.name} to ${targetAgentName} by administrator ${req.user.name} due to agent deactivation.`
        });
      }
    }

    // 3. Update agent status in database
    const isActiveBool = status === 'active';
    const updateRes = await client.query(`
      UPDATE users
      SET status = $1, is_active = $2
      WHERE id = $3
      RETURNING id, name, email, role, status, is_active
    `, [status, isActiveBool, agentId]);

    const updatedAgent = updateRes.rows[0];

    // 4. Record action in immutable admin activity logs
    await logAdminAction({
      client,
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: status === 'inactive' ? 'agent_deactivated' : 'agent_reactivated',
      targetType: 'agent',
      targetId: agentId,
      details: status === 'inactive'
        ? `Deactivated support agent ${agent.name} (${agent.email}). ${reassignedCount > 0 ? `Reassigned ${reassignedCount} active tickets to ${targetAgentName}.` : 'No tickets were reassigned.'}`
        : `Reactivated support agent ${agent.name} (${agent.email}).`,
      metadata: {
        agentId,
        agentName: agent.name,
        previousStatus: agent.status,
        newStatus: status,
        reassignedCount,
        reassignedTo: targetAgentName
      }
    });

    await client.query('COMMIT');

    res.json({
      message: `Support agent ${agent.name} successfully ${status === 'active' ? 'reactivated' : 'deactivated'}.`,
      agent: updatedAgent,
      reassignedCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating agent status:', err);
    res.status(500).json({ error: 'Failed to update agent status.' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin/agents/:id
 * Permanently delete agent ONLY when safe (0 tickets/messages/audits).
 * Otherwise rejects with helpful instruction to deactivate instead.
 */
router.delete('/agents/:id', async (req, res) => {
  const agentId = parseInt(req.params.id, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify agent exists
    const agentRes = await client.query(`
      SELECT id, name, email, role FROM users WHERE id = $1 AND role = 'agent'
    `, [agentId]);

    if (agentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Support agent not found.' });
    }

    const agent = agentRes.rows[0];

    // 2. Check for historical records to guarantee integrity
    const [ticketsCountRes, messagesCountRes, auditCountRes] = await Promise.all([
      client.query('SELECT COUNT(*)::int as count FROM tickets WHERE assigned_agent_id = $1', [agentId]),
      client.query('SELECT COUNT(*)::int as count FROM ticket_messages WHERE sender_id = $1', [agentId]),
      client.query('SELECT COUNT(*)::int as count FROM ticket_audit_logs WHERE actor_id = $1', [agentId])
    ]);

    const ticketsCount = ticketsCountRes.rows[0].count;
    const messagesCount = messagesCountRes.rows[0].count;
    const auditCount = auditCountRes.rows[0].count;

    if (ticketsCount > 0 || messagesCount > 0 || auditCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot permanently delete agent: ${agent.name} has historical associations (${ticketsCount} tickets, ${messagesCount} messages, ${auditCount} audit entries). Deactivate the agent instead to preserve data integrity and performance history.`,
        references: { tickets: ticketsCount, messages: messagesCount, audits: auditCount }
      });
    }

    // 3. Safe to delete
    await client.query('DELETE FROM users WHERE id = $1', [agentId]);

    // 4. Log in admin activity logs
    await logAdminAction({
      client,
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'agent_deleted',
      targetType: 'agent',
      targetId: agentId,
      details: `Permanently deleted unused support agent ${agent.name} (${agent.email}).`
    });

    await client.query('COMMIT');
    res.json({ message: `Agent ${agent.name} permanently deleted.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete agent error:', err);
    res.status(500).json({ error: 'Failed to delete support agent.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/tickets
 * Query all tickets across all agents and customers with filtering
 */
router.get('/tickets', async (req, res) => {
  try {
    const { status, priority, agent_id, search, overdue } = req.query;

    let sql = `
      SELECT t.*, 
             c.name as customer_name, c.email as customer_email,
             a.name as agent_name, a.email as agent_email,
             COALESCE(a.status, 'active') as agent_status,
             CASE 
               WHEN t.status NOT IN ('resolved', 'closed', 'pending_customer') AND (
                 t.resolution_due_at < NOW() OR (t.first_responded_at IS NULL AND t.first_response_due_at < NOW())
               ) THEN TRUE 
               ELSE FALSE 
             END as is_overdue
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

    if (agent_id && agent_id !== 'all') {
      if (agent_id === 'unassigned') {
        sql += ` AND t.assigned_agent_id IS NULL`;
      } else {
        params.push(parseInt(agent_id, 10));
        sql += ` AND t.assigned_agent_id = $${params.length}`;
      }
    }

    if (overdue === 'true') {
      sql += ` AND t.status NOT IN ('resolved', 'closed', 'pending_customer') AND (
        t.resolution_due_at < NOW() OR (t.first_responded_at IS NULL AND t.first_response_due_at < NOW())
      )`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (
        LOWER(t.ticket_number) LIKE $${params.length} OR
        LOWER(t.title) LIKE $${params.length} OR
        LOWER(t.description) LIKE $${params.length} OR
        LOWER(c.name) LIKE $${params.length} OR
        LOWER(c.email) LIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY t.created_at DESC`;

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
    console.error('Error fetching admin tickets:', err);
    res.status(500).json({ error: 'Failed to retrieve ticket administration list.' });
  }
});

/**
 * PATCH /api/admin/tickets/:id/assign
 * Administrator assign or reassign ticket to an active agent (or unassign)
 */
router.patch('/tickets/:id/assign', async (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { agentId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify ticket exists
    const ticketRes = await client.query(`
      SELECT t.*, a.name as current_agent_name 
      FROM tickets t 
      LEFT JOIN users a ON t.assigned_agent_id = a.id 
      WHERE t.id = $1
    `, [ticketId]);

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = ticketRes.rows[0];
    let newAgentName = null;

    if (agentId !== null && agentId !== undefined) {
      const targetAgentId = parseInt(agentId, 10);

      // Verify agent exists, is an agent, and is ACTIVE
      const agentCheck = await client.query(`
        SELECT id, name, email, status FROM users 
        WHERE id = $1 AND role = 'agent'
      `, [targetAgentId]);

      if (agentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Selected user is not a valid support agent.' });
      }

      const targetAgent = agentCheck.rows[0];
      if (targetAgent.status === 'inactive') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cannot assign ticket to deactivated agent (${targetAgent.name}).` });
      }

      newAgentName = targetAgent.name;

      // Assign ticket
      await client.query(`
        UPDATE tickets
        SET assigned_agent_id = $1,
            status = CASE WHEN status = 'new' THEN 'open' ELSE status END,
            updated_at = NOW()
        WHERE id = $2
      `, [targetAgentId, ticketId]);
    } else {
      // Unassign ticket
      await client.query(`
        UPDATE tickets
        SET assigned_agent_id = NULL, updated_at = NOW()
        WHERE id = $1
      `, [ticketId]);
    }

    // Append to ticket audit log
    await logAuditEvent({
      client,
      ticketId,
      actorId: req.user.id,
      actorRole: 'admin',
      action: 'ticket_reassigned',
      oldValue: { assigned_agent_id: ticket.assigned_agent_id, agent_name: ticket.current_agent_name },
      newValue: { assigned_agent_id: agentId, agent_name: newAgentName },
      details: newAgentName 
        ? `Ticket assigned to agent ${newAgentName} by administrator ${req.user.name}`
        : `Ticket unassigned by administrator ${req.user.name}`
    });

    // Append to admin activity logs
    await logAdminAction({
      client,
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'ticket_assigned',
      targetType: 'ticket',
      targetId: ticketId,
      details: newAgentName 
        ? `Assigned ticket #${ticket.ticket_number} to agent ${newAgentName}`
        : `Unassigned ticket #${ticket.ticket_number}`
    });

    await client.query('COMMIT');

    const updatedRes = await query(`
      SELECT t.*, 
             c.name as customer_name, c.email as customer_email,
             a.name as agent_name, a.email as agent_email
      FROM tickets t
      JOIN users c ON t.customer_id = c.id
      LEFT JOIN users a ON t.assigned_agent_id = a.id
      WHERE t.id = $1
    `, [ticketId]);

    res.json({
      message: newAgentName ? `Ticket assigned to ${newAgentName}.` : 'Ticket unassigned.',
      ticket: updatedRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning ticket:', err);
    res.status(500).json({ error: 'Failed to assign ticket.' });
  } finally {
    client.release();
  }
});

/**
 * PATCH /api/admin/tickets/:id/priority
 * Administrator change ticket priority and recalculate SLAs
 */
router.patch('/tickets/:id/priority', async (req, res) => {
  const ticketId = parseInt(req.params.id, 10);
  const { priority } = req.body;

  if (!['urgent', 'medium', 'small'].includes(priority)) {
    return res.status(400).json({ error: "Invalid priority. Must be 'urgent', 'medium', or 'small'." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = ticketRes.rows[0];
    const oldPriority = ticket.priority;

    if (oldPriority === priority) {
      await client.query('ROLLBACK');
      return res.json({ message: 'Priority is already set to ' + priority, ticket });
    }

    const holidaySet = await getHolidaySet(client);
    const now = new Date();
    const recalculated = recalculateSLAOnPriorityChange(ticket, priority, now, holidaySet);

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
      priority,
      recalculated.firstResponseDueAt,
      recalculated.firstResponseBreached,
      recalculated.resolutionDueAt,
      recalculated.resolutionBreached,
      ticketId
    ]);

    const updatedTicket = updateRes.rows[0];

    // Log to ticket audit log
    await logAuditEvent({
      client,
      ticketId,
      actorId: req.user.id,
      actorRole: 'admin',
      action: 'priority_changed',
      oldValue: { priority: oldPriority },
      newValue: { priority },
      details: `Priority changed from ${oldPriority} to ${priority} by administrator ${req.user.name}. SLA targets recalculated.`
    });

    // Log to admin activity logs
    await logAdminAction({
      client,
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'priority_changed',
      targetType: 'ticket',
      targetId: ticketId,
      details: `Changed ticket #${ticket.ticket_number} priority from ${oldPriority} to ${priority}.`
    });

    await client.query('COMMIT');
    res.json({ message: `Priority updated to ${priority}.`, ticket: updatedTicket });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating ticket priority:', err);
    res.status(500).json({ error: 'Failed to update ticket priority.' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/performance
 * Individual Agent Performance Metrics calculated from live DB data
 */
router.get('/performance', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        u.id as agent_id,
        u.name as agent_name,
        u.email as agent_email,
        COALESCE(u.status, 'active') as status,
        u.created_at as joined_at,
        COUNT(t.id)::int as total_handled,
        COUNT(CASE WHEN t.status = 'resolved' THEN 1 END)::int as tickets_resolved,
        COUNT(CASE WHEN t.status NOT IN ('resolved', 'closed') THEN 1 END)::int as currently_assigned,
        COUNT(CASE WHEN t.status NOT IN ('resolved', 'closed', 'pending_customer') AND (t.resolution_due_at < NOW() OR (t.first_responded_at IS NULL AND t.first_response_due_at < NOW())) THEN 1 END)::int as overdue_tickets,
        COALESCE(
          ROUND(
            AVG(
              CASE WHEN t.first_responded_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (t.first_responded_at - t.created_at)) / 60 
                ELSE NULL 
              END
            )
          ), 0
        )::int as avg_first_response_minutes,
        COALESCE(
          ROUND(
            AVG(
              CASE WHEN t.resolved_at IS NOT NULL 
                THEN (EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60) - t.total_paused_working_minutes 
                ELSE NULL 
              END
            )
          ), 0
        )::int as avg_resolution_minutes,
        CASE 
          WHEN COUNT(t.id) = 0 THEN 100.0
          ELSE ROUND(
            (
              (COUNT(t.id) - COUNT(CASE WHEN t.resolution_breached OR t.first_response_breached THEN 1 END))::numeric 
              / COUNT(t.id)::numeric
            ) * 100.0, 1
          )
        END as sla_compliance_pct
      FROM users u
      LEFT JOIN tickets t ON u.id = t.assigned_agent_id
      WHERE u.role = 'agent'
      GROUP BY u.id, u.name, u.email, u.status, u.created_at
      ORDER BY tickets_resolved DESC, currently_assigned ASC, u.name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching agent performance:', err);
    res.status(500).json({ error: 'Failed to retrieve agent performance metrics.' });
  }
});

/**
 * GET /api/admin/invitations
 * View pending, accepted, expired and revoked invitations
 */
router.get('/invitations', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        i.id, i.email, i.token, i.expires_at, i.used_at, i.revoked_at, i.created_at,
        u.name as created_by_name, u.email as created_by_email,
        CASE 
          WHEN i.revoked_at IS NOT NULL THEN 'revoked'
          WHEN i.used_at IS NOT NULL THEN 'accepted'
          WHEN i.expires_at < NOW() THEN 'expired'
          ELSE 'pending'
        END as status
      FROM agent_invitations i
      LEFT JOIN users u ON i.created_by = u.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invitations:', err);
    res.status(500).json({ error: 'Failed to retrieve agent invitations.' });
  }
});

/**
 * POST /api/admin/invitations
 * Create agent invitation token
 */
router.post('/invitations', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Agent email address is required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const existing = await query('SELECT id, role FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `A user with email ${normalizedEmail} already exists (${existing.rows[0].role}).` });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const insertRes = await query(`
      INSERT INTO agent_invitations (email, token, created_by, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, token, expires_at, created_at
    `, [normalizedEmail, token, req.user.id, expiresAt]);

    const invitation = insertRes.rows[0];

    // Log admin action
    await logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'invitation_created',
      targetType: 'invitation',
      targetId: invitation.id,
      details: `Generated agent invitation token for ${normalizedEmail}`,
      metadata: { email: normalizedEmail, expiresAt: invitation.expires_at }
    });

    res.status(201).json({
      message: 'Agent invitation token generated successfully.',
      invitation: {
        ...invitation,
        status: 'pending'
      }
    });
  } catch (err) {
    console.error('Error creating invitation:', err);
    res.status(500).json({ error: 'Failed to create agent invitation.' });
  }
});

/**
 * POST /api/admin/invitations/:id/revoke
 * Revoke an unused invitation token
 */
router.post('/invitations/:id/revoke', async (req, res) => {
  const inviteId = parseInt(req.params.id, 10);
  try {
    const inviteRes = await query('SELECT * FROM agent_invitations WHERE id = $1', [inviteId]);
    if (inviteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found.' });
    }

    const invite = inviteRes.rows[0];
    if (invite.used_at) {
      return res.status(400).json({ error: 'Cannot revoke an invitation that has already been accepted.' });
    }
    if (invite.revoked_at) {
      return res.status(400).json({ error: 'This invitation has already been revoked.' });
    }

    const updateRes = await query(`
      UPDATE agent_invitations
      SET revoked_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [inviteId]);

    // Log action in admin activity logs
    await logAdminAction({
      adminId: req.user.id,
      adminName: req.user.name,
      adminEmail: req.user.email,
      action: 'invitation_revoked',
      targetType: 'invitation',
      targetId: inviteId,
      details: `Revoked agent invitation token for ${invite.email}`
    });

    res.json({
      message: `Invitation for ${invite.email} has been revoked.`,
      invitation: updateRes.rows[0]
    });
  } catch (err) {
    console.error('Error revoking invitation:', err);
    res.status(500).json({ error: 'Failed to revoke invitation.' });
  }
});

/**
 * GET /api/admin/activity-logs
 * View append-only admin activity logs
 */
router.get('/activity-logs', async (req, res) => {
  try {
    const { action, targetType, search } = req.query;
    const logs = await getAdminActivityLogs({ action, targetType, search, limit: 150 });
    res.json(logs);
  } catch (err) {
    console.error('Error fetching admin activity logs:', err);
    res.status(500).json({ error: 'Failed to retrieve admin activity logs.' });
  }
});

export default router;