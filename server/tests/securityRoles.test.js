import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:5000/api';

test('Security & Role Permission Enforcement Suite', async (t) => {
  let adminToken = '';
  let agentToken = '';
  let customerToken = '';
  let validInviteToken = '';
  const agentInviteEmail = `invited.agent.${Date.now()}@frontdesk.com`;

  // Pre-requisite: Authenticate as existing Admin
  await t.test('0. Authenticate as Default Administrator', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@frontdesk.com', password: 'admin123' })
    });
    assert.equal(res.status, 200, 'Admin login must succeed');
    const data = await res.json();
    assert.equal(data.user.role, 'admin', 'User role must be admin');
    assert.ok(data.token, 'Must return JWT token');
    adminToken = data.token;
  });

  // Pre-requisite: Authenticate as existing Demo Agent (Aarav)
  await t.test('0b. Authenticate as Demo Support Agent (Aarav)', async () => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aarav@frontdesk.com', password: 'agent123' })
    });
    assert.equal(res.status, 200, 'Demo agent login must succeed');
    const data = await res.json();
    assert.equal(data.user.role, 'agent');
    agentToken = data.token;
  });

  // Requirement 1: Public registration without role must succeed as customer
  await t.test('1. Public registration without role assigns customer role', async () => {
    const uniqueEmail = `cust.norole.${Date.now()}@example.com`;
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Customer',
        email: uniqueEmail,
        password: 'customerPassword123',
        confirmPassword: 'customerPassword123'
      })
    });
    assert.equal(res.status, 201, 'Public registration should succeed');
    const data = await res.json();
    assert.equal(data.user.role, 'customer', 'Default role must strictly be customer');
  });

  // Requirement 2: Try sending role: 'agent' on public registration -> must not create agent
  await t.test('2. Public registration with role: "agent" payload is ignored and assigns customer', async () => {
    const uniqueEmail = `spoof.agent.${Date.now()}@example.com`;
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Agent Wannabe',
        email: uniqueEmail,
        password: 'password123',
        confirmPassword: 'password123',
        role: 'agent' // Spoofed role from client
      })
    });
    assert.equal(res.status, 201, 'Registration completes');
    const data = await res.json();
    assert.equal(data.user.role, 'customer', 'Backend must ignore spoofed agent role and assign customer');
  });

  // Requirement 3: Try sending role: 'admin' on public registration -> must not create admin
  await t.test('3. Public registration with role: "admin" payload is ignored and assigns customer', async () => {
    const uniqueEmail = `spoof.admin.${Date.now()}@example.com`;
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin Attacker',
        email: uniqueEmail,
        password: 'password123',
        confirmPassword: 'password123',
        role: 'admin' // Spoofed role from client
      })
    });
    assert.equal(res.status, 201, 'Registration completes');
    const data = await res.json();
    assert.equal(data.user.role, 'customer', 'Backend must ignore spoofed admin role and assign customer');

    // Verify login confirms customer role
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'password123' })
    });
    const loginData = await loginRes.json();
    assert.equal(loginData.user.role, 'customer');
    customerToken = loginData.token;
  });

  // Requirement 4: Try registering agent with missing or invalid invitation
  await t.test('4. Agent registration fails without invite token or with invalid token', async () => {
    // Missing token
    const missingRes = await fetch(`${BASE}/auth/register-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Agent',
        email: 'unauth@frontdesk.com',
        password: 'password123',
        confirmPassword: 'password123',
        inviteToken: ''
      })
    });
    assert.equal(missingRes.status, 403, 'Missing token must be rejected with 403');

    // Invalid token
    const invalidRes = await fetch(`${BASE}/auth/register-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Agent',
        email: 'unauth@frontdesk.com',
        password: 'password123',
        confirmPassword: 'password123',
        inviteToken: 'invalid-token-12345'
      })
    });
    assert.equal(invalidRes.status, 403, 'Invalid token must be rejected with 403');
  });

  // Requirement 5: Non-admin users cannot generate agent invitations
  await t.test('5. Non-admin users (customer & agent) cannot generate agent invitations', async () => {
    // Customer attempt
    const custInviteRes = await fetch(`${BASE}/auth/invite-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerToken}`
      },
      body: JSON.stringify({ email: 'newguy@frontdesk.com' })
    });
    assert.equal(custInviteRes.status, 403, 'Customer must be forbidden from inviting agents');

    // Agent attempt
    const agentInviteRes = await fetch(`${BASE}/auth/invite-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({ email: 'newguy@frontdesk.com' })
    });
    assert.equal(agentInviteRes.status, 403, 'Support Agent must be forbidden from inviting agents');
  });

  // Requirement 6: Authorized admin generates an agent invitation
  await t.test('6. Authorized Administrator successfully creates agent invitation token', async () => {
    const res = await fetch(`${BASE}/auth/invite-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ email: agentInviteEmail })
    });
    assert.equal(res.status, 201, 'Admin should successfully generate invite');
    const data = await res.json();
    assert.ok(data.invitation.token, 'Must return invite token');
    assert.equal(data.invitation.email, agentInviteEmail);
    validInviteToken = data.invitation.token;
  });

  // Requirement 7: Register agent with valid invitation token and matching email
  await t.test('7. Agent registers successfully using valid invitation token and assigned role = agent', async () => {
    const res = await fetch(`${BASE}/auth/register-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Legitimate New Agent',
        email: agentInviteEmail,
        password: 'secureAgentPassword123',
        confirmPassword: 'secureAgentPassword123',
        inviteToken: validInviteToken
      })
    });
    assert.equal(res.status, 201, 'Agent registration with valid token must succeed');
    const data = await res.json();
    assert.equal(data.user.role, 'agent', 'Role must strictly be agent');

    // Verify new agent can log in
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentInviteEmail, password: 'secureAgentPassword123' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.role, 'agent');
  });

  // Requirement 8: Single-use token prevention (replay attack protection)
  await t.test('8. Replay attack prevented: Already-used invitation token is rejected', async () => {
    const res = await fetch(`${BASE}/auth/register-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Replay Attacker',
        email: `another.${Date.now()}@frontdesk.com`,
        password: 'password123',
        confirmPassword: 'password123',
        inviteToken: validInviteToken // Same token already used in test 7
      })
    });
    assert.equal(res.status, 403, 'Reused invitation token must be rejected with 403');
    const data = await res.json();
    assert.match(data.error, /already been used/i);
  });

  // Requirement 9: Verify permission separation: Customer rejected from agent endpoints
  await t.test('9. Customer token is rejected from /api/agent/tickets with 403 Forbidden', async () => {
    const res = await fetch(`${BASE}/agent/tickets`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert.equal(res.status, 403, 'Customer cannot access agent ticket workstation');
  });

  // Requirement 10: Verify permission separation: Agent authorized for agent endpoints
  await t.test('10. Agent token succeeds accessing /api/agent/tickets with 200 OK', async () => {
    const res = await fetch(`${BASE}/agent/tickets`, {
      headers: { 'Authorization': `Bearer ${agentToken}` }
    });
    assert.equal(res.status, 200, 'Agent can access workstation tickets queue');
  });

  // Requirement 11: Verify customer authorized for customer endpoints
  await t.test('11. Customer token succeeds accessing /api/customer/tickets with 200 OK', async () => {
    const res = await fetch(`${BASE}/customer/tickets`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert.equal(res.status, 200, 'Customer can access their own tickets');
  });
});