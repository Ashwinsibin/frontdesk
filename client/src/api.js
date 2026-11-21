const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('frontdesk_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('frontdesk_token', token);
  } else {
    localStorage.removeItem('frontdesk_token');
  }
}

export function getCurrentUser() {
  const user = localStorage.getItem('frontdesk_user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('frontdesk_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('frontdesk_user');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: ({ name, email, password, confirmPassword }) => 
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword }) }),
  registerAgent: ({ name, email, password, confirmPassword, inviteToken }) =>
    request('/auth/register-agent', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword, inviteToken }) }),
  inviteAgent: (email) =>
    request('/auth/invite-agent', { method: 'POST', body: JSON.stringify({ email }) }),
  createAdmin: ({ name, email, password }) =>
    request('/auth/create-admin', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  getMe: () => request('/auth/me'),
  getDemoUsers: () => request('/auth/demo-users'),

  // Agent Endpoints
  getAgentTickets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/agent/tickets${qs ? `?${qs}` : ''}`);
  },
  getAgentTicketDetail: (id) => request(`/agent/tickets/${id}`),
  claimTicket: (id) => request(`/agent/tickets/${id}/claim`, { method: 'POST' }),
  postAgentMessage: (id, { messageType, content }) => request(`/agent/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ messageType, content }) }),
  updatePriority: (id, priority) => request(`/agent/tickets/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) }),
  resolveTicket: (id) => request(`/agent/tickets/${id}/resolve`, { method: 'POST' }),

  // Customer Endpoints
  createTicket: ({ title, description, priority }) => request('/customer/tickets', { method: 'POST', body: JSON.stringify({ title, description, priority }) }),
  getCustomerTickets: () => request('/customer/tickets'),
  getCustomerTicketDetail: (id) => request(`/customer/tickets/${id}`),
  postCustomerReply: (id, content) => request(`/customer/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),
  reopenTicket: (id) => request(`/customer/tickets/${id}/reopen`, { method: 'POST' }),

  // Holidays
  getHolidays: () => request('/holidays'),

  // Admin Management Endpoints
  getAdminOverview: () => request('/admin/overview'),
  getAdminAgents: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/agents${qs ? `?${qs}` : ''}`);
  },
  updateAgentStatus: (id, { status, reassignTicketsTo }) =>
    request(`/admin/agents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reassignTicketsTo })
    }),
  deleteAgent: (id) => request(`/admin/agents/${id}`, { method: 'DELETE' }),
  getAdminTickets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/tickets${qs ? `?${qs}` : ''}`);
  },
  adminAssignTicket: (id, agentId) =>
    request(`/admin/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ agentId })
    }),
  adminUpdatePriority: (id, priority) =>
    request(`/admin/tickets/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority })
    }),
  getAdminPerformance: () => request('/admin/performance'),
  getAdminInvitations: () => request('/admin/invitations'),
  createAdminInvitation: (email) =>
    request('/admin/invitations', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  revokeInvitation: (id) =>
    request(`/admin/invitations/${id}/revoke`, {
      method: 'POST'
    }),
  getAdminActivityLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/activity-logs${qs ? `?${qs}` : ''}`);
  }
};
