import React, { useState, useEffect } from 'react';
import { 
  Inbox, AlertCircle, Clock, CheckCircle, Search, Filter, 
  UserCheck, ShieldCheck, ChevronRight, User, RefreshCw,
  UserPlus, Key, X
} from 'lucide-react';
import { api } from '../api';
import SLACounter from './SLACounter';
import TicketDetailModal from './TicketDetailModal';

export default function AgentDashboard({ currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unassigned', 'my_tickets'
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  // Admin Agent Invitation States
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    try {
      setInviteLoading(true);
      setInviteError('');
      const res = await api.inviteAgent(inviteEmail.trim());
      setGeneratedInvite(res.invitation);
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') params.filter = filter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (search.trim()) params.search = search.trim();

      const data = await api.getAgentTickets(params);
      setTickets(data);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [filter, statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTickets();
  };

  const handleClaim = async (ticketId, e) => {
    e.stopPropagation();
    try {
      setClaimingId(ticketId);
      await api.claimTicket(ticketId);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Urgent</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Small</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">New</span>;
      case 'open':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Open</span>;
      case 'pending_customer':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Waiting Customer</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200">
      
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Support Queue & Workstation</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operating Schedule: Mon–Fri, 9:30 AM – 6:30 PM IST • SLA Timers Exclude Non-Working Hours & Holidays
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                setShowInviteModal(true);
                setInviteError('');
                setGeneratedInvite(null);
                setInviteEmail('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Support Agent
            </button>
          )}

          <button
            onClick={fetchTickets}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-4 mb-6 space-y-4 transition-colors duration-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Main Segmented Filters */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'all' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-700 dark:text-blue-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setFilter('unassigned')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'unassigned' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-700 dark:text-blue-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              Unassigned Queue
            </button>
            <button
              onClick={() => setFilter('my_tickets')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'my_tickets' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-700 dark:text-blue-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              My Claimed Tickets
            </button>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket #, title, or customer..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
            />
          </form>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="pending_customer">Waiting on Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="medium">🟡 Medium</option>
              <option value="small">🔵 Small</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
        {loading && tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium">No tickets match the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Priority & Status</th>
                  <th className="py-3 px-4">SLA Timers (Asia/Kolkata)</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => {
                  const isUnassigned = !t.assigned_agent_id;
                  const isMine = t.assigned_agent_id === currentUser.id;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      {/* Ticket # & Title */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-blue-700 dark:text-blue-400">{t.ticket_number}</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1 max-w-xs">{t.title}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{t.customer_name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-400">{t.customer_email}</div>
                      </td>

                      {/* Priority & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getPriorityBadge(t.priority)}
                          {getStatusBadge(t.status)}
                        </div>
                      </td>

                      {/* SLA Timers */}
                      <td className="py-3.5 px-4">
                        <SLACounter ticket={t} compact />
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3.5 px-4">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 font-medium italic">
                            Unassigned
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{t.agent_name} {isMine && '(You)'}</span>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        {isUnassigned ? (
                          <button
                            onClick={(e) => handleClaim(t.id, e)}
                            disabled={claimingId === t.id}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition inline-flex items-center gap-1"
                          >
                            {claimingId === t.id ? 'Claiming...' : 'Claim Ticket'}
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-400 text-xs font-semibold inline-flex items-center gap-0.5">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={fetchTickets}
          currentUserId={currentUser.id}
        />
      )}

      {/* Admin Invite Agent Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative transition-colors duration-200">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
              <Key className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Generate Agent Invitation Token</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              As an Administrator, you can issue a single-use, 7-day cryptographically secure invitation token bound to a specific agent's email address.
            </p>

            {inviteError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg mb-4">
                {inviteError}
              </div>
            )}

            {generatedInvite ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                  ✅ Invitation token generated successfully for <strong>{generatedInvite.email}</strong>!
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Invitation Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.token}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg select-all text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.token);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 transition"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Expires: {new Date(generatedInvite.expiresAt).toLocaleString()}
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  Provide this token to the agent. When they register at the Create Account screen, they will enter their email and this token to gain Support Agent workstation access.
                </p>

                <button
                  onClick={() => { setGeneratedInvite(null); setInviteEmail(''); }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition mt-2"
                >
                  Invite Another Agent
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recipient Agent Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. agent.new@frontdesk.com"
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
                >
                  {inviteLoading ? 'Generating Token...' : 'Generate Invitation Token'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
