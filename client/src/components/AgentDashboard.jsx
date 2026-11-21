import React, { useState, useEffect } from 'react';
import { 
  Inbox, AlertCircle, Clock, CheckCircle, Search, Filter, 
  UserCheck, ShieldCheck, ChevronRight, User, RefreshCw
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
    const interval = setInterval(fetchTickets, 30000); // Polling every 30s
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">Urgent</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">Small</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-800">New</span>;
      case 'open':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-100 text-blue-800">Open</span>;
      case 'pending_customer':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-800">Waiting Customer</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 text-slate-700">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Support Queue & Workstation</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operating Schedule: Mon–Fri, 9:30 AM – 6:30 PM IST • SLA Timers Exclude Non-Working Hours & Holidays
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTickets}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Main Segmented Filters */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'all' ? 'bg-white shadow-xs text-blue-700' : 'hover:text-slate-900'}`}
            >
              All Tickets ({tickets.length})
            </button>
            <button
              onClick={() => setFilter('unassigned')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'unassigned' ? 'bg-white shadow-xs text-blue-700' : 'hover:text-slate-900'}`}
            >
              Unassigned Queue
            </button>
            <button
              onClick={() => setFilter('my_tickets')}
              className={`px-3 py-1.5 rounded-md transition ${filter === 'my_tickets' ? 'bg-white shadow-xs text-blue-700' : 'hover:text-slate-900'}`}
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
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
            />
          </form>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
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
            <span className="text-slate-500 font-medium">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
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
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading && tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium">No tickets match the selected criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Priority & Status</th>
                  <th className="py-3 px-4">SLA Timers (Asia/Kolkata)</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => {
                  const isUnassigned = !t.assigned_agent_id;
                  const isMine = t.assigned_agent_id === currentUser.id;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="hover:bg-blue-50/40 cursor-pointer transition"
                    >
                      {/* Ticket # & Title */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-blue-700">{t.ticket_number}</div>
                        <div className="font-medium text-slate-900 line-clamp-1 max-w-xs">{t.title}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{t.customer_name}</div>
                        <div className="text-[11px] text-slate-400">{t.customer_email}</div>
                      </td>

                      {/* Priority & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          {getPriorityBadge(t.priority)}
                          {getStatusBadge(t.status)}
                        </div>
                      </td>

                      {/* SLA Timers */}
                      <td className="py-3.5 px-4 space-y-1">
                        <SLACounter
                          label="Reply"
                          dueDate={t.first_response_due_at}
                          isBreached={t.first_response_breached}
                          isPaused={t.status === 'pending_customer'}
                          completedAt={t.first_responded_at}
                        />
                        <div>
                          <SLACounter
                            label="Resolve"
                            dueDate={t.resolution_due_at}
                            isBreached={t.resolution_breached}
                            isPaused={t.status === 'pending_customer'}
                            completedAt={t.resolved_at}
                          />
                        </div>
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3.5 px-4">
                        {isUnassigned ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium italic">
                            Unassigned
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
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
                          <span className="text-slate-400 text-xs font-semibold inline-flex items-center gap-0.5">
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
    </div>
  );
}
