async function verifyRegistrationAndAuth() {
  console.log('🧪 Verifying Registration & Authentication Features Live...\n');
  const BASE = 'http://localhost:5000/api';

  // 1. Test empty fields
  console.log('1. Testing missing fields validation...');
  const emptyRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', email: '', password: '', confirmPassword: '' })
  });
  console.log('   Status:', emptyRes.status, '(Expected: 400)');
  const emptyData = await emptyRes.json();
  console.log('   Error message:', emptyData.error);
  if (emptyRes.status !== 400) throw new Error('Empty fields check failed');

  // 2. Test invalid email format
  console.log('\n2. Testing invalid email format validation...');
  const invalidEmailRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'notanemail', password: 'password123', confirmPassword: 'password123' })
  });
  console.log('   Status:', invalidEmailRes.status, '(Expected: 400)');
  const invalidEmailData = await invalidEmailRes.json();
  console.log('   Error message:', invalidEmailData.error);
  if (invalidEmailRes.status !== 400) throw new Error('Email format check failed');

  // 3. Test password mismatch
  console.log('\n3. Testing password mismatch validation...');
  const mismatchRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@frontdesk.com', password: 'password123', confirmPassword: 'differentPassword' })
  });
  console.log('   Status:', mismatchRes.status, '(Expected: 400)');
  const mismatchData = await mismatchRes.json();
  console.log('   Error message:', mismatchData.error);
  if (mismatchRes.status !== 400) throw new Error('Password mismatch check failed');

  // 4. Test short password
  console.log('\n4. Testing short password (<6 chars) validation...');
  const shortPwdRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@frontdesk.com', password: '123', confirmPassword: '123' })
  });
  console.log('   Status:', shortPwdRes.status, '(Expected: 400)');
  const shortPwdData = await shortPwdRes.json();
  console.log('   Error message:', shortPwdData.error);
  if (shortPwdRes.status !== 400) throw new Error('Short password check failed');

  // 5. Successful public customer registration
  const uniqueEmail = `cust.${Date.now()}@frontdesk.com`;
  console.log(`\n5. Testing public registration for ${uniqueEmail}...`);
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Maya Customer',
      email: uniqueEmail,
      password: 'customerSecurePassword123',
      confirmPassword: 'customerSecurePassword123'
    })
  });
  console.log('   Status:', regRes.status, '(Expected: 201)');
  const regData = await regRes.json();
  console.log('   Response message:', regData.message);
  console.log('   Registered user role:', regData.user?.role, '(Expected: customer)');
  if (regRes.status !== 201 || regData.user?.role !== 'customer') {
    throw new Error('Registration failed or did not assign customer role');
  }

  // 5b. Verify role spoofing is defeated
  console.log(`\n5b. Testing role spoofing rejection (trying to send role: "admin" and role: "agent")...`);
  const spoofAdminEmail = `spoof.admin.${Date.now()}@frontdesk.com`;
  const spoofRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Hacker',
      email: spoofAdminEmail,
      password: 'password123',
      confirmPassword: 'password123',
      role: 'admin' // Attempted privilege escalation
    })
  });
  const spoofData = await spoofRes.json();
  console.log('   Status:', spoofRes.status, '(Expected: 201)');
  console.log('   Assigned role:', spoofData.user?.role, '(Expected: customer - spoof ignored)');
  if (spoofData.user?.role !== 'customer') {
    throw new Error('Role spoofing was not ignored!');
  }

  // 6. Test duplicate email registration
  console.log(`\n6. Testing duplicate email rejection for ${uniqueEmail}...`);
  const dupRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate Maya',
      email: uniqueEmail,
      password: 'anotherPassword123',
      confirmPassword: 'anotherPassword123'
    })
  });
  console.log('   Status:', dupRes.status, '(Expected: 409)');
  const dupData = await dupRes.json();
  console.log('   Error message:', dupData.error);
  if (dupRes.status !== 409) throw new Error('Duplicate email check failed');

  // 7. Test login with newly registered customer credentials
  console.log(`\n7. Testing login with newly registered customer credentials...`);
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: uniqueEmail,
      password: 'customerSecurePassword123'
    })
  });
  console.log('   Status:', loginRes.status, '(Expected: 200)');
  const loginData = await loginRes.json();
  console.log('   Authenticated user:', loginData.user?.name, 'Role:', loginData.user?.role);
  console.log('   JWT Token received:', !!loginData.token);
  if (!loginData.token || loginData.user?.role !== 'customer') {
    throw new Error('Login with new credentials failed');
  }

  // 8. Test wrong password login rejection
  console.log(`\n8. Testing login failure with incorrect password...`);
  const wrongLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: uniqueEmail,
      password: 'incorrectPassword'
    })
  });
  console.log('   Status:', wrongLoginRes.status, '(Expected: 401)');
  if (wrongLoginRes.status !== 401) throw new Error('Wrong password check failed');

  // 9. Verify customer is rejected from agent ticket queue (Role separation)
  console.log(`\n9. Verifying customer is denied access to GET /api/agent/tickets (403)...`);
  const queueRes = await fetch(`${BASE}/agent/tickets`, {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  console.log('   Queue status:', queueRes.status, '(Expected: 403 Forbidden)');
  if (queueRes.status !== 403) throw new Error('Customer was not denied agent route access');

  // 10. Administrator Invitation & Support Agent Registration Flow
  console.log(`\n10. Testing Admin Invitation & Agent Registration Flow...`);
  const adminLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@frontdesk.com', password: 'admin123' })
  });
  const adminLoginData = await adminLoginRes.json();
  console.log('   Admin logged in:', adminLoginData.user?.email, 'Role:', adminLoginData.user?.role);

  const newAgentEmail = `invited.agent.${Date.now()}@frontdesk.com`;
  const inviteRes = await fetch(`${BASE}/auth/invite-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminLoginData.token}`
    },
    body: JSON.stringify({ email: newAgentEmail })
  });
  console.log('   Invite generated status:', inviteRes.status, '(Expected: 201)');
  const inviteData = await inviteRes.json();
  console.log('   Generated token:', inviteData.invitation?.token?.substring(0, 16) + '...');

  // Register the agent using the invitation token
  const agentRegRes = await fetch(`${BASE}/auth/register-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Invited Support Agent',
      email: newAgentEmail,
      password: 'agentSecurePassword123',
      confirmPassword: 'agentSecurePassword123',
      inviteToken: inviteData.invitation.token
    })
  });
  console.log('   Agent register status:', agentRegRes.status, '(Expected: 201)');
  const agentRegData = await agentRegRes.json();
  console.log('   Registered agent role:', agentRegData.user?.role, '(Expected: agent)');
  if (agentRegRes.status !== 201 || agentRegData.user?.role !== 'agent') {
    throw new Error('Agent registration with invite token failed');
  }

  // 11. Verify existing demo accounts still work
  console.log(`\n11. Verifying existing demo accounts (Aarav & Rajesh)...`);
  const demoAgentRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav@frontdesk.com', password: 'agent123' })
  });
  console.log('   Demo Agent (Aarav):', demoAgentRes.status, '(Expected: 200)');
  
  const demoCustRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh@acme.com', password: 'customer123' })
  });
  console.log('   Demo Customer (Rajesh):', demoCustRes.status, '(Expected: 200)');
  if (demoAgentRes.status !== 200 || demoCustRes.status !== 200) {
    throw new Error('Existing demo accounts check failed');
  }

  console.log('\n🎉 ALL LIVE SECURITY, REGISTRATION, AND ROLE SEPARATION CHECKS PASSED!');
}

verifyRegistrationAndAuth().catch(err => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});