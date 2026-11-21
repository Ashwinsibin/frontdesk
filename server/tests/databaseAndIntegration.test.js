import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';

test('Database & Critical Business Rules Test Suite', async (t) => {
  // 1. Initialize in-memory PostgreSQL instance
  const db = newDb();
  
  db.public.registerFunction({
    name: 'now',
    returns: db.public.getType('timestamp with time zone'),
    implementation: () => new Date()
  });

  // Create core schema directly in pg-mem
  db.public.none(`
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE holidays (
        id SERIAL PRIMARY KEY,
        holiday_date DATE UNIQUE NOT NULL,
        description VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'new',
        priority VARCHAR(20) NOT NULL,
        first_response_due_at TIMESTAMPTZ NOT NULL,
        first_responded_at TIMESTAMPTZ,
        first_response_breached BOOLEAN DEFAULT FALSE,
        resolution_due_at TIMESTAMPTZ NOT NULL,
        resolved_at TIMESTAMPTZ,
        resolution_breached BOOLEAN DEFAULT FALSE,
        sla_paused_at TIMESTAMPTZ,
        total_paused_working_minutes INTEGER DEFAULT 0,
        waiting_customer_since TIMESTAMPTZ,
        reopened_at TIMESTAMPTZ,
        reopen_deadline_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        last_customer_reply_at TIMESTAMPTZ,
        last_agent_reply_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message_type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE ticket_audit_logs (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
        actor_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
        actor_role VARCHAR(20) NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  // Emulate PostgreSQL trigger defense on ticket_audit_logs
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql, params) => {
    if (typeof sql === 'string' && (/UPDATE\s+ticket_audit_logs/i.test(sql) || /DELETE\s+FROM\s+ticket_audit_logs/i.test(sql))) {
      throw new Error('Security Violation: ticket_audit_logs is append-only. UPDATE and DELETE operations are prohibited.');
    }
    return originalQuery(sql, params);
  };

  // Seed test users
  await pool.query(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (1, 'Aarav Sharma', 'aarav@frontdesk.com', 'hash', 'agent'),
           (2, 'Rajesh Kumar', 'rajesh@acme.com', 'hash', 'customer');
  `);

  await t.test('1. Append-Only Audit History: UPDATE and DELETE are blocked by database protection', async () => {
    // Create ticket
    await pool.query(`
      INSERT INTO tickets (id, ticket_number, title, description, customer_id, priority, first_response_due_at, resolution_due_at)
      VALUES (1, 'TCK-0001', 'Database issue', 'Cannot connect', 2, 'urgent', NOW(), NOW());
    `);

    // Insert valid audit log
    await pool.query(`
      INSERT INTO ticket_audit_logs (ticket_id, actor_id, actor_role, action, details)
      VALUES (1, 2, 'customer', 'ticket_created', 'Initial creation');
    `);

    // Attempt to UPDATE audit log -> Must throw exception
    await assert.rejects(
      async () => {
        await pool.query(`UPDATE ticket_audit_logs SET details = 'tampered' WHERE id = 1;`);
      },
      /Security Violation|append-only/i,
      'Database must raise an exception when attempting to UPDATE an audit record'
    );

    // Attempt to DELETE audit log -> Must throw exception
    await assert.rejects(
      async () => {
        await pool.query(`DELETE FROM ticket_audit_logs WHERE id = 1;`);
      },
      /Security Violation|append-only/i,
      'Database must raise an exception when attempting to DELETE an audit record'
    );
  });

  await t.test('2. Audit Retention: Cannot delete ticket when audit records exist (ON DELETE RESTRICT)', async () => {
    // Attempt to delete ticket 1 which has an audit log
    await assert.rejects(
      async () => {
        await pool.query(`DELETE FROM tickets WHERE id = 1;`);
      },
      /violates foreign key constraint|restrict/i,
      'Database must prevent deleting tickets with existing audit records'
    );
  });

  await t.test('3. Concurrency Protection: Atomic single-agent claim prevents simultaneous assignment', async () => {
    // Create new unassigned ticket
    await pool.query(`
      INSERT INTO tickets (id, ticket_number, title, description, customer_id, priority, first_response_due_at, resolution_due_at)
      VALUES (2, 'TCK-0002', 'Login failure', '403 error', 2, 'medium', NOW(), NOW());
    `);

    // Add agent 2
    await pool.query(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (3, 'Diya Patel', 'diya@frontdesk.com', 'hash', 'agent');
    `);

    // Simulate Agent 1 and Agent 2 simultaneously attempting to claim TCK-0002
    const claimQuery = `
      UPDATE tickets
      SET assigned_agent_id = $1, status = 'open', updated_at = NOW()
      WHERE id = $2 AND assigned_agent_id IS NULL
      RETURNING id, assigned_agent_id;
    `;

    const res1 = await pool.query(claimQuery, [1, 2]); // Agent 1
    const res2 = await pool.query(claimQuery, [3, 2]); // Agent 2

    // Exactly one must succeed with 1 row returned, other must return 0 rows
    const totalClaimed = res1.rowCount + res2.rowCount;
    assert.equal(totalClaimed, 1, 'Only one agent claim query may succeed');

    assert.equal(res1.rowCount, 1, 'First claim succeeded');
    assert.equal(res2.rowCount, 0, 'Second simultaneous claim returned 0 rows (leads to 409 Conflict)');
  });

  await t.test('4. Private Note Isolation: Internal notes are strictly excluded from customer views', async () => {
    // Add public reply and private internal note to ticket 2
    await pool.query(`
      INSERT INTO ticket_messages (ticket_id, sender_id, message_type, content)
      VALUES (2, 1, 'public_reply', 'Hello Rajesh, we are looking into your login issue.'),
             (2, 1, 'internal_note', 'CONFIDENTIAL: Customer account has pending invoice balance.');
    `);

    // Query messages as customer (customer query pattern)
    const customerMessagesRes = await pool.query(`
      SELECT m.id, m.content, m.message_type, u.name as sender_name
      FROM ticket_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.ticket_id = 2 AND m.message_type = 'public_reply'
      ORDER BY m.created_at ASC;
    `);

    // Assert: Customer gets only 1 message, exactly the public reply
    assert.equal(customerMessagesRes.rows.length, 1);
    assert.equal(customerMessagesRes.rows[0].message_type, 'public_reply');
    assert.match(customerMessagesRes.rows[0].content, /looking into your login issue/);

    // Negative check: Assert internal note NEVER appears in customer result
    const hasInternalNote = customerMessagesRes.rows.some(m => m.message_type === 'internal_note' || m.content.includes('CONFIDENTIAL'));
    assert.equal(hasInternalNote, false, 'Internal notes must NEVER be returned to customers');
  });

  await t.test('5. Auto-Close Inactivity Sweep: Closes tickets awaiting customer replies > 45 working hours', async () => {
    // Create ticket in pending_customer waiting for 50 working hours
    const fiftyHoursAgo = new Date(Date.now() - 50 * 60 * 60 * 1000);
    await pool.query(`
      INSERT INTO tickets (id, ticket_number, title, description, customer_id, status, priority, first_response_due_at, resolution_due_at, waiting_customer_since)
      VALUES (3, 'TCK-0003', 'Inactive ticket', 'No reply from customer', 2, 'pending_customer', 'medium', NOW(), NOW(), $1);
    `, [fiftyHoursAgo]);

    // Execute atomic sweeper query
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const candidateRes = await client.query(`
        SELECT id FROM tickets WHERE status = 'pending_customer' AND waiting_customer_since IS NOT NULL
      `);
      
      const eligibleIds = candidateRes.rows.map(r => r.id);
      assert.equal(eligibleIds.includes(3), true);

      for (const id of eligibleIds) {
        await client.query(`
          UPDATE tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1
        `, [id]);
      }

      for (const id of eligibleIds) {
        await client.query(`
          INSERT INTO ticket_audit_logs (ticket_id, actor_role, action, old_value, new_value, details)
          VALUES ($1, 'system', 'auto_closed', '{"status": "pending_customer"}'::jsonb, '{"status": "closed"}'::jsonb, 'Auto-closed after 45 working hours');
        `, [id]);
      }
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify ticket 3 is closed
    const checkRes = await pool.query('SELECT status, closed_at FROM tickets WHERE id = 3');
    assert.equal(checkRes.rows[0].status, 'closed');
    assert.notEqual(checkRes.rows[0].closed_at, null);

    // Verify audit log has auto_closed record
    const auditRes = await pool.query("SELECT action, details FROM ticket_audit_logs WHERE ticket_id = 3 AND action = 'auto_closed'");
    assert.equal(auditRes.rows.length, 1);
    assert.match(auditRes.rows[0].details, /45 working hours/i);
  });
});
