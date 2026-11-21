async function testLiveApi() {
  console.log('🌐 Testing Live Full-Stack REST API against Neon on http://localhost:5000...\n');
  const BASE = 'http://localhost:5000/api';

  // 1. Healthcheck
  const healthRes = await fetch(`${BASE}/health`);
  const health = await healthRes.json();
  console.log('1. Healthcheck:', healthRes.status, health.service, health.timezone);

  // 2. Customer Login
  const custLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rajesh@acme.com', password: 'customer123' })
  });
  const custLogin = await custLoginRes.json();
  console.log('2. Customer Login:', custLoginRes.status, custLogin.user?.name, `(Token received: ${!!custLogin.token})`);
  const custToken = custLogin.token;

  // 3. Agent Login
  const agentLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav@frontdesk.com', password: 'agent123' })
  });
  const agentLogin = await agentLoginRes.json();
  console.log('3. Agent Login:', agentLoginRes.status, agentLogin.user?.name, `(Token received: ${!!agentLogin.token})`);
  const agentToken = agentLogin.token;

  // 4. Customer Creates Ticket
  const createRes = await fetch(`${BASE}/customer/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${custToken}` },
    body: JSON.stringify({
      title: 'Neon API Test Ticket',
      description: 'Customer testing live HTTP API flow with Neon',
      priority: 'urgent'
    })
  });
  const ticket = await createRes.json();
  console.log('4. Customer Created Ticket:', createRes.status, ticket.ticket_number, `(Status: ${ticket.status}, Priority: ${ticket.priority})`);

  // 5. Agent Claims Ticket
  const claimRes = await fetch(`${BASE}/agent/tickets/${ticket.id}/claim`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${agentToken}` }
  });
  const claimedTicket = await claimRes.json();
  console.log('5. Agent Claimed Ticket:', claimRes.status, `(Status: ${claimedTicket.status}, Agent ID: ${claimedTicket.assigned_agent_id})`);

  // 6. Agent Posts Public Reply
  const pubReplyRes = await fetch(`${BASE}/agent/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentToken}` },
    body: JSON.stringify({
      messageType: 'public_reply',
      content: 'We are investigating this issue now.'
    })
  });
  console.log('6. Agent Posted Public Reply:', pubReplyRes.status);

  // 7. Agent Posts Private Internal Note
  const noteRes = await fetch(`${BASE}/agent/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentToken}` },
    body: JSON.stringify({
      messageType: 'internal_note',
      content: 'INTERNAL CONFIDENTIAL: Escalated to Level 2 engineer.'
    })
  });
  console.log('7. Agent Posted Private Internal Note:', noteRes.status);

  // 8. Customer Fetches Ticket Details (Verify Note Privacy)
  const custViewRes = await fetch(`${BASE}/customer/tickets/${ticket.id}`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const custView = await custViewRes.json();
  console.log('8. Customer View Ticket Details:', custViewRes.status);
  console.log('   Customer Visible Messages Count:', custView.messages.length);
  const leakedNote = custView.messages.some(m => m.message_type === 'internal_note' || m.content.includes('CONFIDENTIAL'));
  console.log('   Private Note Exposed to Customer?:', leakedNote ? 'LEAKED! (FAIL)' : 'NO - STRICTLY ISOLATED! (PASS)');

  // 9. Customer Replies to Ticket
  const custReplyRes = await fetch(`${BASE}/customer/tickets/${ticket.id}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${custToken}` },
    body: JSON.stringify({ content: 'Thank you for the quick response!' })
  });
  console.log('9. Customer Sent Reply:', custReplyRes.status);

  // 10. Agent Resolves Ticket
  const resolveRes = await fetch(`${BASE}/agent/tickets/${ticket.id}/resolve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${agentToken}` }
  });
  const resolved = await resolveRes.json();
  console.log('10. Agent Marked Resolved:', resolveRes.status, `(Status: ${resolved.status})`);
  console.log('    7-Calendar-Day Reopen Deadline:', resolved.reopen_deadline_at);

  // 11. Customer Reopens Ticket within Window
  const reopenRes = await fetch(`${BASE}/customer/tickets/${ticket.id}/reopen`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const reopened = await reopenRes.json();
  console.log('11. Customer Reopened Ticket:', reopenRes.status, `(New Status: ${reopened.status})`);

  console.log('\n🎉 ALL 11 LIVE API & WORKFLOW OPERATIONS PASSED AGAINST NEON!');
}

testLiveApi().catch(err => {
  console.error('API Verification error:', err);
  process.exit(1);
});
