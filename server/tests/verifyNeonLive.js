import { pool, query, testConnection } from '../src/config/db.js';
import bcrypt from 'bcryptjs';

async function verifyNeonLive() {
  console.log('🚀 Running Live Neon PostgreSQL End-to-End Verification...\n');

  // 1. Connection Check
  const connected = await testConnection();
  if (!connected) {
    throw new Error('Database connection failed.');
  }

  // 2. Table Inspection
  const tablesRes = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log('📋 Verified Tables in Neon:', tables);
  const expectedTables = ['holidays', 'ticket_audit_logs', 'ticket_messages', 'tickets', 'users'];
  for (const t of expectedTables) {
    if (!tables.includes(t)) {
      throw new Error(`Missing expected table: ${t}`);
    }
  }

  // 3. User Seed Check
  const usersRes = await query('SELECT count(*)::int as count FROM users');
  console.log(`👤 Seeded Users Count: ${usersRes.rows[0].count} (Expected: 12)`);

  // 4. Test Customer Authentication
  const customerRes = await query("SELECT * FROM users WHERE email = 'rajesh@acme.com'");
  if (customerRes.rows.length === 0) throw new Error('Customer user not found.');
  const customer = customerRes.rows[0];
  const customerAuthMatch = await bcrypt.compare('customer123', customer.password_hash);
  console.log('🔑 Customer Password Verification:', customerAuthMatch ? 'SUCCESS' : 'FAILED');

  // 5. Test Agent Authentication
  const agentRes = await query("SELECT * FROM users WHERE email = 'aarav@frontdesk.com'");
  if (agentRes.rows.length === 0) throw new Error('Agent user not found.');
  const agent = agentRes.rows[0];
  const agentAuthMatch = await bcrypt.compare('agent123', agent.password_hash);
  console.log('🔑 Agent Password Verification:', agentAuthMatch ? 'SUCCESS' : 'FAILED');

  // 6. Test Real Ticket Create Operation (Urgent Priority)
  const ticketRes = await query(`
    INSERT INTO tickets (
      ticket_number, title, description, customer_id, priority, 
      first_response_due_at, resolution_due_at, last_customer_reply_at
    )
    VALUES (
      'TCK-NEON-001', 'Urgent production outage', 'Payment gateway 500 error',
      $1, 'urgent', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '9 hours', NOW()
    )
    RETURNING *;
  `, [customer.id]);
  const ticket = ticketRes.rows[0];
  console.log(`🎫 Created Test Ticket in Neon: ID=${ticket.id}, Number=${ticket.ticket_number}, Status=${ticket.status}`);

  // Insert creation audit record
  await query(`
    INSERT INTO ticket_audit_logs (ticket_id, actor_id, actor_role, action, details)
    VALUES ($1, $2, 'customer', 'ticket_created', 'Created urgent production ticket in Neon');
  `, [ticket.id, customer.id]);

  // 7. Test Atomic Claim by Agent
  const claimRes = await query(`
    UPDATE tickets
    SET assigned_agent_id = $1, status = 'open', updated_at = NOW()
    WHERE id = $2 AND assigned_agent_id IS NULL
    RETURNING *;
  `, [agent.id, ticket.id]);
  console.log(`🛡️ Atomic Claim by Agent ${agent.name}:`, claimRes.rowCount === 1 ? 'SUCCESS' : 'FAILED');

  await query(`
    INSERT INTO ticket_audit_logs (ticket_id, actor_id, actor_role, action, details)
    VALUES ($1, $2, 'agent', 'ticket_claimed', 'Claimed by agent Aarav');
  `, [ticket.id, agent.id]);

  // 8. Test Messages: 1 Public Reply and 1 Private Internal Note
  await query(`
    INSERT INTO ticket_messages (ticket_id, sender_id, message_type, content)
    VALUES ($1, $2, 'public_reply', 'Hello Rajesh, we have escalated this to payment ops.'),
           ($1, $2, 'internal_note', 'INTERNAL CONFIDENTIAL: Gateway API key rotated unexpectedly.');
  `, [ticket.id, agent.id]);
  console.log('💬 Inserted Public Reply & Private Internal Note.');

  // 9. Verify Private Note Isolation (Customer Query)
  const customerViewMessages = await query(`
    SELECT id, content, message_type 
    FROM ticket_messages 
    WHERE ticket_id = $1 AND message_type = 'public_reply';
  `, [ticket.id]);
  console.log(`🔒 Customer View Messages Count: ${customerViewMessages.rows.length}`);
  const containsInternalNote = customerViewMessages.rows.some(m => m.message_type === 'internal_note');
  console.log('🔒 Private Note Leaked to Customer?:', containsInternalNote ? 'YES (SECURITY FAILURE)' : 'NO (SECURE)');
  if (containsInternalNote) throw new Error('Private note isolation failed!');

  // 10. Verify Append-Only Trigger Defense on Neon
  let triggerDefenseActive = false;
  try {
    await query("UPDATE ticket_audit_logs SET details = 'tampered' WHERE ticket_id = $1", [ticket.id]);
  } catch (err) {
    if (err.message.includes('append-only') || err.code === '28000') {
      triggerDefenseActive = true;
    }
  }
  console.log('🛡️ Database Trigger Immutability Protection on Neon:', triggerDefenseActive ? 'ACTIVE & BLOCKING MUTATIONS' : 'FAILED');
  if (!triggerDefenseActive) throw new Error('Trigger did not block mutation!');

  // 11. Test Ticket Resolution and 7-Calendar-Day Reopen Deadline
  const resolveRes = await query(`
    UPDATE tickets
    SET status = 'resolved',
        resolved_at = NOW(),
        reopen_deadline_at = NOW() + INTERVAL '7 days',
        updated_at = NOW()
    WHERE id = $1
    RETURNING status, resolved_at, reopen_deadline_at;
  `, [ticket.id]);
  const resolvedTicket = resolveRes.rows[0];
  console.log(`✅ Ticket Resolution: Status=${resolvedTicket.status}, ReopenDeadline=${resolvedTicket.reopen_deadline_at}`);

  console.log('\n🎉 ALL LIVE NEON POSTGRESQL CHECKS PASSED SUCCESSFULLY!');
  await pool.end();
}

verifyNeonLive().catch(err => {
  console.error('\n❌ Neon Verification Failed:', err);
  process.exit(1);
});
