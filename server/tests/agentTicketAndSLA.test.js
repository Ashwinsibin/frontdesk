import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  makeISTDate, 
  toIST,
  formatISTDate, 
  calculateInitialSLADeadlines, 
  calculateWorkingMinutes,
  calculateWorkingSeconds,
  getTicketSLAInfo,
  snapToNextWorkingWindow
} from '../src/services/slaEngine.js';

const BASE = 'http://localhost:5000/api';

test('Agent Ticket Creation & Automatic SLA Engine Test Suite', async (t) => {
  let agentToken = '';
  let customerToken = '';
  let customerId = null;
  let testCustomerEmail = '';

  // 1. Authenticate Demo Agent
  await t.test('1. Authenticate as Demo Support Agent (Aarav)', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@frontdesk.com', password: 'agent123' })
    });
    assert.equal(res.status, 200, 'Agent login should return 200');
    const data = await res.json();
    assert.equal(data.user.role, 'agent');
    agentToken = data.token;
  });

  // 2. Authenticate Customer
  await t.test('2. Authenticate as Demo Customer', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rajesh@acme.com', password: 'customer123' })
    });
    assert.equal(res.status, 200, 'Customer login should return 200');
    const data = await res.json();
    assert.equal(data.user.role, 'customer');
    customerToken = data.token;
    customerId = data.user.id;
    testCustomerEmail = data.user.email;
  });

  // 3. Security: Customer cannot create ticket via /api/agent/tickets
  await t.test('3. Security: Customer receives 403 Forbidden on POST /api/agent/tickets', async () => {
    const res = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Attempt',
        description: 'Should fail',
        customerId
      })
    });
    assert.equal(res.status, 403, 'Customer must be blocked with 403');
  });

  // 4. Agent lists customers
  await t.test('4. Agent successfully queries GET /api/agent/customers', async () => {
    const res = await fetch(`${BASE}/agent/customers`, {
      headers: { 'Authorization': `Bearer ${agentToken}` }
    });
    assert.equal(res.status, 200, 'Agent should access customer list');
    const customers = await res.json();
    assert.ok(Array.isArray(customers), 'Should return array of customers');
    assert.ok(customers.length > 0, 'Customer list should not be empty');
  });

  // 5. Agent creates ticket on behalf of existing customer (Urgent)
  let createdTicketId = null;
  await t.test('5. Agent creates Urgent ticket on behalf of existing customer with auto SLA', async () => {
    const res = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        title: 'Urgent Database Replication Latency',
        description: 'Customer reported replica lag exceeding 10 seconds.',
        category: 'Technical Support',
        priority: 'urgent',
        customerId,
        assignToSelf: true
      })
    });
    assert.equal(res.status, 201, 'Agent ticket creation should return 201');
    const ticket = await res.json();
    assert.ok(ticket.id, 'Should have ticket ID');
    assert.ok(ticket.ticket_number.startsWith('TCK-'), 'Should generate TCK- ticket number');
    assert.equal(ticket.priority, 'urgent');
    assert.equal(ticket.status, 'open', 'Assigned ticket should have status = open');
    assert.ok(ticket.assigned_agent_id, 'Should be assigned to creating agent');
    assert.ok(ticket.first_response_due_at, 'Should have first response SLA deadline');
    assert.ok(ticket.resolution_due_at, 'Should have resolution SLA deadline');
    assert.ok(ticket.sla_info, 'Should return enriched sla_info');
    assert.equal(ticket.sla_info.reply.is_completed, false);
    createdTicketId = ticket.id;
  });

  // 6. Agent creates unassigned ticket (Medium)
  await t.test('6. Agent creates unassigned Medium ticket with status = new', async () => {
    const res = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        title: 'Billing Invoice Discrepancy',
        description: 'Customer questioned tax calculation on monthly invoice.',
        category: 'Billing & Invoicing',
        priority: 'medium',
        customerId,
        assignToSelf: false
      })
    });
    assert.equal(res.status, 201);
    const ticket = await res.json();
    assert.equal(ticket.status, 'new', 'Unassigned ticket should have status = new');
    assert.equal(ticket.assigned_agent_id, null, 'assigned_agent_id should be null');
    assert.ok(ticket.first_response_due_at);
    assert.ok(ticket.resolution_due_at);
  });

  // 7. Agent creates ticket on behalf of a NEW customer
  await t.test('7. Agent creates ticket with new customer details (auto-provisions customer)', async () => {
    const newCustEmail = `new.cust.${Date.now()}@example.com`;
    const res = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        title: 'Onboarding Configuration Help',
        description: 'New enterprise user needs assistance configuring SSO.',
        category: 'Account Access',
        priority: 'small',
        customerName: 'Enterprise Client',
        customerEmail: newCustEmail,
        assignToSelf: true
      })
    });
    assert.equal(res.status, 201);
    const ticket = await res.json();
    assert.equal(ticket.customer_email, newCustEmail);
    assert.equal(ticket.priority, 'small');
    assert.ok(ticket.customer_id, 'Should link to newly provisioned customer user');
  });

  // 8. Rejects empty title or description
  await t.test('8. Rejects empty title or description with 400 Bad Request', async () => {
    const res1 = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        title: '',
        description: 'Valid description',
        customerId
      })
    });
    assert.equal(res1.status, 400, 'Empty title should fail');

    const res2 = await fetch(`${BASE}/agent/tickets`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        title: 'Valid title',
        description: '   ',
        customerId
      })
    });
    assert.equal(res2.status, 400, 'Empty description should fail');
  });

  // 9. SLA Engine Scenarios: Working Hours vs Non-Working Hours
  await t.test('9. SLA Engine: Ticket created during working hours (Mon 10:00 AM)', async () => {
    const createdAt = makeISTDate('2026-11-23', 10 * 60); // Monday 10:00 AM IST
    const holidays = new Set();
    const deadlines = calculateInitialSLADeadlines('urgent', createdAt, holidays);

    // Urgent first response = 2 working hours -> 12:00 PM IST
    const expectedReply = makeISTDate('2026-11-23', 12 * 60);
    assert.equal(deadlines.firstResponseDueAt.toISOString(), expectedReply.toISOString());

    // Urgent resolution = same working day 18:30 IST
    const expectedResolve = makeISTDate('2026-11-23', 18 * 60 + 30);
    assert.equal(deadlines.resolutionDueAt.toISOString(), expectedResolve.toISOString());
  });

  // 10. Ticket created after business hours snaps to next working day 09:30 AM
  await t.test('10. SLA Engine: Ticket created after hours (Friday 19:30 IST)', async () => {
    const createdAt = makeISTDate('2026-11-20', 19 * 60 + 30); // Friday 7:30 PM IST
    const holidays = new Set();
    const deadlines = calculateInitialSLADeadlines('urgent', createdAt, holidays);

    // Snaps to Monday 09:30 AM IST
    // Reply due = 2 working hours -> Monday 11:30 AM IST
    const expectedReply = makeISTDate('2026-11-23', 11 * 60 + 30);
    assert.equal(deadlines.firstResponseDueAt.toISOString(), expectedReply.toISOString());

    // Resolution due = Monday 18:30 IST
    const expectedResolve = makeISTDate('2026-11-23', 18 * 60 + 30);
    assert.equal(deadlines.resolutionDueAt.toISOString(), expectedResolve.toISOString());
  });

  // 11. Ticket created during weekend (Saturday)
  await t.test('11. SLA Engine: Ticket created on Saturday snaps to Monday 09:30 AM', async () => {
    const createdAt = makeISTDate('2026-11-21', 14 * 60); // Saturday 2:00 PM IST
    const holidays = new Set();
    const deadlines = calculateInitialSLADeadlines('medium', createdAt, holidays);

    // Effective start = Monday 09:30 AM IST
    // Medium first response = 4.5 working hours -> Monday 14:00 (2:00 PM) IST
    const expectedReply = makeISTDate('2026-11-23', 14 * 60);
    assert.equal(deadlines.firstResponseDueAt.toISOString(), expectedReply.toISOString());
  });

  // 12. Ticket created before festival holiday
  await t.test('12. SLA Engine: Excludes festival holidays in deadline calculations', async () => {
    // Wednesday 17:30 IST. Thursday 2026-10-22 is Diwali holiday.
    const createdAt = makeISTDate('2026-10-21', 17 * 60 + 30);
    const holidays = new Set(['2026-10-22']);
    const deadlines = calculateInitialSLADeadlines('urgent', createdAt, holidays);

    // 1 hour today (17:30 to 18:30). Remaining 1 hour on Friday (since Thursday is holiday).
    // Friday starts 09:30, 1h -> Friday 10:30 AM IST
    const expectedReply = makeISTDate('2026-10-23', 10 * 60 + 30);
    assert.equal(deadlines.firstResponseDueAt.toISOString(), expectedReply.toISOString());
  });

  // 13. Working countdown decreases during working hours and freezes outside working hours
  await t.test('13. Countdown decreases during working hours and freezes outside working hours', async () => {
    const target = makeISTDate('2026-11-23', 12 * 60); // Monday 12:00 PM IST
    const holidays = new Set();

    // T = Mon 10:00:00 -> exactly 7200 working seconds
    const t0 = makeISTDate('2026-11-23', 10 * 60);
    const sec0 = calculateWorkingSeconds(t0, target, holidays);
    assert.equal(sec0, 7200);

    // T + 60s = Mon 10:01:00 -> exactly 7140 working seconds (decreased by 60s)
    const t1 = new Date(t0.getTime() + 60000);
    const sec1 = calculateWorkingSeconds(t1, target, holidays);
    assert.equal(sec1, 7140);
    assert.equal(sec0 - sec1, 60, 'Working countdown must decrease by exact elapsed working seconds');

    // Outside working hours: Friday 19:30 vs Friday 20:30
    // Monday deadline
    const monTarget = makeISTDate('2026-11-23', 11 * 60 + 30);
    const fri1930 = makeISTDate('2026-11-20', 19 * 60 + 30);
    const fri2030 = makeISTDate('2026-11-20', 20 * 60 + 30);

    const secFri1 = calculateWorkingSeconds(fri1930, monTarget, holidays);
    const secFri2 = calculateWorkingSeconds(fri2030, monTarget, holidays);

    assert.equal(secFri1, 7200);
    assert.equal(secFri2, 7200);
    assert.equal(secFri1, secFri2, 'Countdown must remain completely frozen outside working hours');
  });
});
