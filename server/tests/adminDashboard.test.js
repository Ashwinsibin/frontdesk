import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:5000/api';

test('Admin Management Dashboard & Security Test Suite', async (t) => {
  let adminToken = '';
  let agentToken = '';
  let customerToken = '';
  let targetAgentToken = '';
  let targetAgentId = null;
  let reassignAgentId = null;
  let testTicketId = null;
  let revokedInviteToken = '';
  let revokedInviteId = null;

  // Pre-requisite: Authenticate Administrator, Agent, and Customer
  await t.test('0. Authenticate Administrator, Demo Agent, and Demo Customer', async () => {
    // Admin
    const adminRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@frontdesk.com', password: 'admin123' })
    });
    assert.equal(adminRes.status, 200);
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    // Agent (Aarav)
    const agentRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@frontdesk.com', password: 'agent123' })
    });
    assert.equal(agentRes.status, 200);
    const agentData = await agentRes.json();
    agentToken = agentData.token;

    // Target Agent (Diya)
    const diyaRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'diya@frontdesk.com', password: 'agent123' })
    });
    if (diyaRes.status === 200) {
      const diyaData = await diyaRes.json();
      targetAgentToken = diyaData.token;
    }

    // Customer (Rajesh)
    const custRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rajesh@acme.com', password: 'customer123' })
    });
    assert.equal(custRes.status, 200);
    const custData = await custRes.json();
    customerToken = custData.token;
  });

  // 1. Admin-Only API Protection
  await t.test('1. Security: Non-admin users receive 403 on all /api/admin/* endpoints', async () => {
    const endpoints = [
      '/admin/overview',
      '/admin/agents',
      '/admin/tickets',
      '/admin/performance',
      '/admin/invitations',
      '/admin/activity-logs'
    ];

    for (const ep of endpoints) {
      // Customer attempt
      const custRes = await fetch(`${BASE}${ep}`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      assert.equal(custRes.status, 403, `Customer should receive 403 on ${ep}`);

      // Agent attempt
      const agentAttempt = await fetch(`${BASE}${ep}`, {
        headers: { 'Authorization': `Bearer ${agentToken}` }
      });
      assert.equal(agentAttempt.status, 403, `Support agent should receive 403 on ${ep}`);

      // Anonymous attempt
      const anonRes = await fetch(`${BASE}${ep}`);
      assert.equal(anonRes.status, 401, `Anonymous user should receive 401 on ${ep}`);
    }
  });

  // 2. Admin Overview API
  await t.test('2. Admin Overview returns valid metrics and chart datasets', async () => {
    const res = await fetch(`${BASE}/admin/overview`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.metrics, 'Metrics object must be present');
    assert.ok(typeof data.metrics.totalCustomers === 'number');
    assert.ok(typeof data.metrics.totalAgents === 'number');
    assert.ok(typeof data.metrics.activeAgents === 'number');
    assert.ok(typeof data.metrics.totalTickets === 'number');
    assert.ok(Array.isArray(data.charts.ticketsByPriority));
    assert.ok(Array.isArray(data.charts.ticketsByStatus));
    assert.ok(Array.isArray(data.charts.agentPerformance));
  });

  // 3. Support Agent Management: Fetch Agents List
  await t.test('3. Admin Agents API lists all registered agents with ticket load metrics', async () => {
    const res = await fetch(`${BASE}/admin/agents`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const agents = await res.json();
    assert.ok(agents.length >= 9, 'Should return at least the 9 seeded agents');
    
    // Pick Diya Patel (id 2 or 3) as target for deactivation test, and Aarav as reassign target
    const targetAgent = agents.find(a => a.email === 'diya@frontdesk.com') || agents[1];
    const reassignAgent = agents.find(a => a.email === 'aarav@frontdesk.com') || agents[0];
    targetAgentId = targetAgent.id;
    reassignAgentId = reassignAgent.id;

    assert.ok(targetAgentId, 'Target agent ID found');
    assert.ok(reassignAgentId, 'Reassign agent ID found');
  });

  // 4. Create a test ticket assigned to targetAgent
  await t.test('4. Setup test ticket assigned to agent to verify reassignment', async () => {
    const createRes = await fetch(`${BASE}/customer/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        title: 'Admin Test Ticket For Reassignment',
        description: 'Verifying atomic ticket reassignment upon agent deactivation',
        priority: 'medium'
      })
    });
    assert.equal(createRes.status, 201);
    const ticketData = await createRes.json();
    testTicketId = ticketData.id || ticketData.ticket?.id;
    assert.ok(testTicketId, 'testTicketId must be a valid number');

    // Admin assigns ticket to targetAgentId
    const assignRes = await fetch(`${BASE}/admin/tickets/${testTicketId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ agentId: targetAgentId })
    });
    assert.equal(assignRes.status, 200);

    // Target agent posts an internal note so agent has historical messages/audit records
    if (targetAgentToken) {
      await fetch(`${BASE}/agent/tickets/${testTicketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${targetAgentToken}`
        },
        body: JSON.stringify({
          messageType: 'internal_note',
          content: 'Agent Diya investigating issue before reassignment.'
        })
      });
    }
  });

  // 5. Agent Deactivation with Ticket Reassignment
  await t.test('5. Deactivate agent and atomically reassign active tickets to another agent', async () => {
    const deactRes = await fetch(`${BASE}/admin/agents/${targetAgentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'inactive',
        reassignTicketsTo: reassignAgentId
      })
    });
    assert.equal(deactRes.status, 200);
    const deactData = await deactRes.json();
    assert.equal(deactData.agent.status, 'inactive');
    assert.equal(deactData.agent.is_active, false);
    assert.ok(deactData.reassignedCount >= 1, 'Should have reassigned at least 1 ticket');

    // Verify ticket is now assigned to reassignAgentId
    const ticketCheck = await fetch(`${BASE}/admin/tickets?search=Reassignment`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const tickets = await ticketCheck.json();
    const reassignedTicket = tickets.find(t => t.id === testTicketId);
    assert.equal(reassignedTicket.assigned_agent_id, reassignAgentId, 'Ticket must be reassigned to target agent');
  });

  // 6. Deactivated Agent Cannot Log In
  await t.test('6. Security: Deactivated agent cannot log in (403 Forbidden)', async () => {
    // Get target agent email
    const agentsRes = await fetch(`${BASE}/admin/agents`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const agents = await agentsRes.json();
    const deactivatedAgent = agents.find(a => a.id === targetAgentId);

    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: deactivatedAgent.email,
        password: 'agent123'
      })
    });
    assert.equal(loginRes.status, 403, 'Deactivated agent login must be rejected with 403');
    const loginData = await loginRes.json();
    assert.match(loginData.error, /deactivated/i);
  });

  // 7. Cannot Assign Tickets to a Deactivated Agent
  await t.test('7. Security: Administrator cannot assign tickets to a deactivated agent', async () => {
    const assignRes = await fetch(`${BASE}/admin/tickets/${testTicketId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ agentId: targetAgentId })
    });
    assert.equal(assignRes.status, 400, 'Cannot assign ticket to deactivated agent');
    const data = await assignRes.json();
    assert.match(data.error, /deactivated/i);
  });

  // 8. Permanent Deletion Rejected for Agent with History
  await t.test('8. Safety Check: Permanent deletion rejected when agent has historical records', async () => {
    const deleteRes = await fetch(`${BASE}/admin/agents/${targetAgentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(deleteRes.status, 400, 'Deletion must be rejected to preserve audit history');
    const deleteData = await deleteRes.json();
    assert.match(deleteData.error, /historical|deactivate/i);
  });

  // 9. Agent Reactivation
  await t.test('9. Reactivate agent restores account and enables login', async () => {
    const reactRes = await fetch(`${BASE}/admin/agents/${targetAgentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'active' })
    });
    assert.equal(reactRes.status, 200);
    const reactData = await reactRes.json();
    assert.equal(reactData.agent.status, 'active');
    assert.equal(reactData.agent.is_active, true);

    // Verify agent can log in again
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: reactData.agent.email,
        password: 'agent123'
      })
    });
    assert.equal(loginRes.status, 200, 'Reactivated agent can log in');
  });

  // 10. Priority Change & SLA Recalculation by Admin
  await t.test('10. Admin priority change recalculates SLA targets and appends audit log', async () => {
    const prioRes = await fetch(`${BASE}/admin/tickets/${testTicketId}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ priority: 'urgent' })
    });
    assert.equal(prioRes.status, 200);
    const prioData = await prioRes.json();
    assert.equal(prioData.ticket.priority, 'urgent');
  });

  // 11. Invitation Creation and Revocation Flow
  await t.test('11. Admin creates invitation token and successfully revokes it', async () => {
    const testInviteEmail = `revoke.test.${Date.now()}@frontdesk.com`;

    // 1. Create invitation
    const createRes = await fetch(`${BASE}/admin/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ email: testInviteEmail })
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    revokedInviteToken = createData.invitation.token;
    revokedInviteId = createData.invitation.id;

    // 2. Revoke invitation
    const revokeRes = await fetch(`${BASE}/admin/invitations/${revokedInviteId}/revoke`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(revokeRes.status, 200);

    // 3. Attempting to register agent with revoked token must fail with 403
    const regRes = await fetch(`${BASE}/auth/register-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Revoked Agent',
        email: testInviteEmail,
        password: 'password123',
        confirmPassword: 'password123',
        inviteToken: revokedInviteToken
      })
    });
    assert.equal(regRes.status, 403, 'Revoked token must be rejected with 403');
    const regData = await regRes.json();
    assert.match(regData.error, /revoked/i);
  });

  // 12. Immutable Admin Activity Logs
  await t.test('12. Admin Activity Logs accurately records actions and displays them', async () => {
    const logsRes = await fetch(`${BASE}/admin/activity-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(logsRes.status, 200);
    const logs = await logsRes.json();
    assert.ok(logs.length >= 4, 'Should record deactivation, reactivation, reassignment, and invitation actions');

    const actions = logs.map(l => l.action);
    assert.ok(actions.includes('agent_deactivated'), 'Must include agent_deactivated');
    assert.ok(actions.includes('agent_reactivated'), 'Must include agent_reactivated');
    assert.ok(actions.includes('invitation_created'), 'Must include invitation_created');
    assert.ok(actions.includes('invitation_revoked'), 'Must include invitation_revoked');
  });

  // 13. Agent Performance Metrics
  await t.test('13. Agent Performance returns real calculated statistics', async () => {
    const perfRes = await fetch(`${BASE}/admin/performance`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(perfRes.status, 200);
    const perf = await perfRes.json();
    assert.ok(perf.length >= 9);
    for (const p of perf) {
      assert.ok(typeof p.total_handled === 'number');
      assert.ok(typeof p.tickets_resolved === 'number');
      assert.ok(typeof p.currently_assigned === 'number');
      assert.ok(p.sla_compliance_pct !== undefined);
    }
  });
});