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
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
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
  getHolidays: () => request('/holidays')
};
