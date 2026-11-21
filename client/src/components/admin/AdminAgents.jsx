import React, { useState, useEffect } from 'react';
import { 
  Users, UserCheck, UserX, Search, Filter, RefreshCw, 
  Trash2, AlertTriangle, ArrowRight, CheckCircle, ShieldAlert,
  Clock, Shield, X
} from 'lucide-react';
import { api } from '../../api';

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Deactivation Modal State
  const [deactivatingAgent, setDeactivatingAgent] = useState(null);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Reactivation Modal State
  const [reactivatingAgent, setReactivatingAgent] = useState(null);

  // Deletion Modal State
  const [deletingAgent, setDeletingAgent] = useState(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.getAdminAgents(params);
      setAgents(data);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAgents();
  };

  // Execute Deactivation
  const handleConfirmDeactivate = async () => {
    if (!deactivatingAgent) return;
    try {
      setActionLoading(true);
      setModalError('');
      const res = await api.updateAgentStatus(deactivatingAgent.id, {
        status: 'inactive',
        reassignTicketsTo: reassignTargetId ? parseInt(reassignTargetId, 10) : undefined
      });
      setSuccessBanner(res.message);
      setDeactivatingAgent(null);
      setReassignTargetId('');
      await fetchAgents();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Reactivation
  const handleConfirmReactivate = async () => {
    if (!reactivatingAgent) return;
    try {
      setActionLoading(true);
      setModalError('');
      const res = await api.updateAgentStatus(reactivatingAgent.id, {
        status: 'active'
      });
      setSuccessBanner(res.message);
      setReactivatingAgent(null);
      await fetchAgents();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Permanent Delete
  const handleConfirmDelete = async () => {
    if (!deletingAgent) return;
    try {
      setActionLoading(true);
      setModalError('');
      const res = await api.deleteAgent(deletingAgent.id);
      setSuccessBanner(res.message);
      setDeletingAgent(null);
      await fetchAgents();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Active agents eligible for ticket reassignment
  const eligibleReassignAgents = agents.filter(
    a => a.id !== deactivatingAgent?.id && a.status === 'active'
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Alerts */}
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

      {/* Control Bar: Search & Status Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Status Filter Tabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'all' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-700 dark:text-blue-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            All Agents ({agents.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'active' ? 'bg-white dark:bg-slate-700 shadow-xs text-emerald-700 dark:text-emerald-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Active ({agents.filter(a => a.status === 'active').length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'inactive' ? 'bg-white dark:bg-slate-700 shadow-xs text-rose-700 dark:text-rose-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Deactivated ({agents.filter(a => a.status === 'inactive').length})
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </form>

          <button
            onClick={fetchAgents}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

      </div>

      {/* Agents Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Agent Name & Email</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-center">Assigned</th>
                <th className="py-3 px-3 text-center">Resolved</th>
                <th className="py-3 px-3 text-center">Waiting Cust</th>
                <th className="py-3 px-3 text-center">Overdue</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && agents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    Loading support agents...
                  </td>
                </tr>
              ) : agents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">
                    No support agents found matching criteria.
                  </td>
                </tr>
              ) : (
                agents.map(agent => (
                  <tr key={agent.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    
                    {/* Name & Email */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          agent.status === 'inactive' ? 'bg-slate-400' : 'bg-blue-600'
                        }`}>
                          {agent.name.charAt(0)}
                        </div>
                        <div>
                          <div>{agent.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{agent.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      {agent.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Deactivated
                        </span>
                      )}
                    </td>

                    {/* Assigned */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {agent.assigned_count}
                      </span>
                    </td>

                    {/* Resolved */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {agent.resolved_count}
                      </span>
                    </td>

                    {/* Pending Customer */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {agent.pending_count}
                      </span>
                    </td>

                    {/* Overdue */}
                    <td className="py-3 px-3 text-center">
                      {agent.overdue_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px]">
                          {agent.overdue_count}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(agent.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {agent.status === 'active' ? (
                          <button
                            onClick={() => {
                              setDeactivatingAgent(agent);
                              setModalError('');
                              setReassignTargetId('');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition"
                            title="Deactivate agent and optionally reassign active tickets"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReactivatingAgent(agent);
                              setModalError('');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition"
                            title="Reactivate agent account"
                          >
                            Reactivate
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setDeletingAgent(agent);
                            setModalError('');
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition"
                          title="Permanently Delete (Safety check enforced)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL 1: Deactivate Agent */}
      {deactivatingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative transition-colors duration-200">
            <button
              onClick={() => setDeactivatingAgent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400">
              <UserX className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Deactivate Agent: {deactivatingAgent.name}
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Deactivating this agent will prevent them from signing in and block all new ticket assignments. Their historical performance, messages, and audit trail will remain completely preserved.
            </p>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                {modalError}
              </div>
            )}

            {/* Active Tickets Reassignment Selector */}
            {deactivatingAgent.assigned_count > 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-amber-900 rounded-lg space-y-2 mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Agent has {deactivatingAgent.assigned_count} active assigned ticket(s)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Select an active agent to automatically reassign all open tickets, or leave unselected to keep current assignments:
                </p>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">-- Do not reassign (leave assigned) --</option>
                  {eligibleReassignAgents.map(a => (
                    <option key={a.id} value={a.id}>
                      Reassign to: {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-500 dark:text-slate-400 mb-4">
                This agent currently has 0 active tickets.
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeactivatingAgent(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDeactivate}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {actionLoading ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reactivate Agent */}
      {reactivatingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 text-left relative">
            <button
              onClick={() => setReactivatingAgent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Reactivate Agent
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Reactivate <strong>{reactivatingAgent.name}</strong> ({reactivatingAgent.email})? This agent will immediately regain workstation login access and will be eligible for ticket assignments.
            </p>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReactivatingAgent(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmReactivate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {actionLoading ? 'Reactivating...' : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Agent Safety Check */}
      {deletingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative">
            <button
              onClick={() => setDeletingAgent(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Agent Safety Check
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Permanent deletion completely removes the user row for <strong>{deletingAgent.name}</strong>.
            </p>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-300 mb-4 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Data Integrity Protection Rule:
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                If this agent has any associated tickets, messages, or audit log entries, the backend will strictly reject permanent deletion. Deactivation is always recommended to preserve full ticket audit trails.
              </p>
            </div>

            {modalError && (
              <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgent(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {actionLoading ? 'Deleting...' : 'Attempt Permanent Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}