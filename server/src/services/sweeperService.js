import { pool, query } from '../config/db.js';
import { calculateWorkingMinutes, AUTO_CLOSE_INACTIVITY_MINUTES } from './slaEngine.js';

/**
 * Fetches all registered holiday dates as a Set of 'YYYY-MM-DD' strings.
 */
export async function getHolidaySet(client = null) {
  const sql = 'SELECT holiday_date FROM holidays';
  const res = client ? await client.query(sql) : await query(sql);
  const set = new Set();
  for (const row of res.rows) {
    const d = new Date(row.holiday_date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    set.add(`${y}-${m}-${day}`);
  }
  return set;
}

/**
 * Atomically sweeps tickets waiting for customer responses > 45 working hours (2700 minutes).
 * Performs status transitions AND audit log additions inside a single PostgreSQL transaction.
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions across server workers.
 */
export async function sweepDueAutoCloseTickets() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const holidaySet = await getHolidaySet(client);

    // 1. Lock eligible candidate tickets currently in pending_customer
    const candidateRes = await client.query(`
      SELECT id, ticket_number, waiting_customer_since, priority
      FROM tickets
      WHERE status = 'pending_customer'
        AND waiting_customer_since IS NOT NULL
      FOR UPDATE SKIP LOCKED
    `);

    const now = new Date();
    const eligibleTicketIds = [];

    for (const ticket of candidateRes.rows) {
      const workingMinutesWaiting = calculateWorkingMinutes(
        ticket.waiting_customer_since,
        now,
        holidaySet
      );

      if (workingMinutesWaiting >= AUTO_CLOSE_INACTIVITY_MINUTES) {
        eligibleTicketIds.push(ticket.id);
      }
    }

    if (eligibleTicketIds.length > 0) {
      // 2. Batch update tickets to closed
      for (const id of eligibleTicketIds) {
        await client.query(`
          UPDATE tickets
          SET status = 'closed',
              closed_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [id]);
      }

      // 3. Atomically insert corresponding audit records in the SAME transaction
      for (const ticketId of eligibleTicketIds) {
        await client.query(`
          INSERT INTO ticket_audit_logs 
            (ticket_id, actor_id, actor_role, action, old_value, new_value, details)
          VALUES ($1, NULL, 'system', 'auto_closed', 
                  '{"status": "pending_customer"}'::jsonb, 
                  '{"status": "closed"}'::jsonb, 
                  'Automatically closed after 45 working hours without customer reply')
        `, [ticketId]);
      }

      console.log(`🧹 Auto-close sweeper closed ${eligibleTicketIds.length} inactive tickets.`);
    }

    await client.query('COMMIT');
    return eligibleTicketIds.length;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error executing auto-close sweeper:', err.message);
    return 0;
  } finally {
    client.release();
  }
}
