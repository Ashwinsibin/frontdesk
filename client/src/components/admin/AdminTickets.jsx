import React, { useState, useEffect } from 'react';
import { 
  Ticket, Search, Filter, RefreshCw, UserCheck, ShieldAlert,
  Clock, CheckCircle, ChevronRight, AlertTriangle, X, Check,
  User, ArrowUpDown
} from 'lucide-react';
import { api } from '../../api';
import SLACounter from '../SLACounter';
import TicketDetailModal from '../TicketDetailModal';

export default function AdminTickets({ currentUserId }) {
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Modals
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  
  // Assign Modal
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Priority Change Modal
  const [priorityTicket, setPriorityTicket] = useState(null);
  const [newPriority, setNewPriority] = useState('');
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityError, setPriorityError] = useState('');

  // Success Banner
  const [successBanner, setSuccessBanner] = useState('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (agentFilter !== 'all') params.agent_id = agentFilter;
      if (overdueOnly) params.overdue = 'true';

      const data = await api.getAdminTickets(params);
      setTickets(data);
    } catch (err) {
      console.error('Error fetching admin tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const data = await api.getAdminAgents();
      setAgents(data);
    } catch (err) {
      console.error('Error loading agents list:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, priorityFilter, agentFilter, overdueOnly]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTickets();
  };

  // Confirm Assignment
  const handleConfirmAssign = async () => {
    if (!assigningTicket) return;
    try {
      setAssignLoading(true);
      setAssignError('');
      const agentIdVal = selectedAgentId === '' ? null : parseInt(selectedAgentId, 10);
      const res = await api.adminAssignTicket(assigningTicket.id, agentIdVal);
      setSuccessBanner(res.message);
      setAssigningTicket(null);
      await fetchTickets();
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  // Confirm Priority Change
  const handleConfirmPriority = async () => {
    if (!priorityTicket || !newPriority) return;
    try {
      setPriorityLoading(true);
      setPriorityError('');
      const res = await api.adminUpdatePriority(priorityTicket.id, newPriority);
      setSuccessBanner(res.message);
      setPriorityTicket(null);
      await fetchTickets();
    } catch (err) {
      setPriorityError(err.message);
    } finally {
      setPriorityLoading(false);
    }
  };

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Urgent</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Medium</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Small</span>;
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'new':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">New</span>;
      case 'open':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Open</span>;
      case 'pending_customer':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Waiting Customer</span>;
      case 'resolved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Resolved</span>;
      case 'closed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      {successBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Bar: Filters & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        
        {/* Top Row: Search & Refresh */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket #, subject, customer..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </form>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
              />
              <span className="font-semibold text-rose-600 dark:text-rose-400">Overdue SLA Only</span>
            </label>

            <button
              onClick={fetchTickets}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Bottom Row: Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="pending_customer">Waiting Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="medium">Medium</option>
              <option value="small">Small</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Assigned Agent:</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium max-w-[200px]"
            >
              <option value="all">All Agents</option>
              <option value="unassigned">-- Unassigned Queue --</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.status === 'inactive' ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-slate-400 text-[11px]">
            Showing <strong>{tickets.length}</strong> ticket(s)
          </div>

        </div>

      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Assigned Agent</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">SLA Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && tickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Loading ticket administration queue...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                tickets.map(ticket => (
                  <tr 
                    key={ticket.id} 
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    
                    {/* Ticket ID & Subject */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        {ticket.ticket_number}
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white line-clamp-1 max-w-xs">
                        {ticket.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Created: {new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(ticket.status)}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getPriorityBadge(ticket.priority)}
                    </td>

                    {/* Assigned Agent */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {ticket.agent_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ticket.agent_name}
                          </span>
                          {ticket.agent_status === 'inactive' && (
                            <span className="text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1 rounded font-bold">
                              Inactive
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic font-medium">Unassigned</span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {ticket.customer_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ticket.customer_email}
                      </div>
                    </td>

                    {/* SLA Status / Countdown */}
                    <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <SLACounter ticket={ticket} compact />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setAssigningTicket(ticket);
                            setSelectedAgentId(ticket.assigned_agent_id ? String(ticket.assigned_agent_id) : '');
                            setAssignError('');
                          }}
                          className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition"
                          title="Assign or reassign ticket"
                        >
                          Assign
                        </button>

                        <button
                          onClick={() => {
                            setPriorityTicket(ticket);
                            setNewPriority(ticket.priority);
                            setPriorityError('');
                          }}
                          className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition"
                          title="Change Priority & Recalculate SLA"
                        >
                          Priority
                        </button>

                        <button
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 text-xs font-semibold"
                          title="View Details"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Detail Modal (Reused) */}
      {selectedTicketId && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={fetchTickets}
          currentUserId={currentUserId}
        />
      )}

      {/* MODAL: Assign / Reassign Agent */}
      {assigningTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative">
            <button
              onClick={() => setAssigningTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
              <UserCheck className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assign Ticket #{assigningTicket.ticket_number}
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium">
              "{assigningTicket.title}"
            </p>

            {assignError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {assignError}
              </div>
            )}

            <div className="space-y-3 mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Active Support Agent:
              </label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">-- Unassigned (Remove Current Assignment) --</option>
                {agents.filter(a => a.status === 'active').map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email}) - {a.assigned_count} active tickets
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                🛡️ Deactivated agents are filtered out and cannot receive ticket assignments.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssigningTicket(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assignLoading}
                onClick={handleConfirmAssign}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {assignLoading ? 'Assigning...' : 'Save Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Change Priority */}
      {priorityTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative">
            <button
              onClick={() => setPriorityTicket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Change Priority & Recalculate SLA
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Ticket <strong>#{priorityTicket.ticket_number}</strong>: "{priorityTicket.title}"
            </p>

            {priorityError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {priorityError}
              </div>
            )}

            <div className="space-y-3 mb-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Priority Level:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['urgent', 'medium', 'small'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={`py-2 px-3 text-xs font-bold uppercase rounded-lg border transition ${
                      newPriority === p
                        ? p === 'urgent'
                          ? 'bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : p === 'medium'
                          ? 'bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                Changing priority triggers immediate mathematical SLA deadline recalculation based on business working hours (9:30 AM – 6:30 PM IST), holidays, and elapsed pauses.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPriorityTicket(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={priorityLoading}
                onClick={handleConfirmPriority}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {priorityLoading ? 'Recalculating...' : 'Update & Recalculate'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}