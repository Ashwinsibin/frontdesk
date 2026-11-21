import { query } from '../config/db.js';

/**
 * Appends an immutable audit entry to ticket_audit_logs.
 * The database trigger trg_protect_audit_logs strictly enforces that
 * records in this table can NEVER be mutated or deleted.
 * 
 * @param {Object} params
 * @param {import('pg').PoolClient} [params.client] Optional client for running within an existing transaction
 * @param {number} params.ticketId
 * @param {number|null} params.actorId
 * @param {string} params.actorRole 'agent' | 'customer' | 'system' | 'admin'
 * @param {string} params.action 
 * @param {Object|null} [params.oldValue]
 * @param {Object|null} [params.newValue]
 * @param {string|null} [params.details]
 */
export async function logAuditEvent({
  client,
  ticketId,
  actorId = null,
  actorRole,
  action,
  oldValue = null,
  newValue = null,
  details = null
}) {
  const sql = `
    INSERT INTO ticket_audit_logs 
      (ticket_id, actor_id, actor_role, action, old_value, new_value, details)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const params = [
    ticketId,
    actorId,
    actorRole,
    action,
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    details
  ];

  if (client) {
    const res = await client.query(sql, params);
    return res.rows[0];
  } else {
    const res = await query(sql, params);
    return res.rows[0];
  }
}

/**
 * Retrieves the full audit trail for a ticket.
 */
export async function getTicketAuditTrail(ticketId) {
  const sql = `
    SELECT a.*, u.name as actor_name, u.email as actor_email
    FROM ticket_audit_logs a
    LEFT JOIN users u ON a.actor_id = u.id
    WHERE a.ticket_id = $1
    ORDER BY a.created_at ASC;
  `;
  const res = await query(sql, [ticketId]);
  return res.rows;
}
