import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, Filter, RefreshCw, Shield, Clock,
  FileText, User, Tag, Lock, AlertCircle
} from 'lucide-react';
import { api } from '../../api';

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (actionFilter !== 'all') params.action = actionFilter;
      if (targetFilter !== 'all') params.targetType = targetFilter;
      const data = await api.getAdminActivityLogs(params);
      setLogs(data);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, targetFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'agent_deactivated':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Agent Deactivated</span>;
      case 'agent_reactivated':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Agent Reactivated</span>;
      case 'agent_deleted':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Agent Deleted</span>;
      case 'ticket_assigned':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Ticket Assigned</span>;
      case 'priority_changed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Priority Changed</span>;
      case 'invitation_created':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Invitation Created</span>;
      case 'invitation_revoked':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Invitation Revoked</span>;
      case 'admin_login':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Admin Sign In</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Immutability Security Banner */}
      <div className="p-3 bg-purple-50 dark:bg-slate-800/70 border border-purple-200 dark:border-purple-900 rounded-xl text-xs text-purple-900 dark:text-purple-300 flex items-center gap-2.5">
        <Lock className="w-4 h-4 text-purple-600 shrink-0" />
        <div>
          <span className="font-bold">Cryptographically & Database Enforced Append-Only Audit Trail:</span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block sm:inline sm:ml-1">
            All administrator management actions are recorded immutably. PostgreSQL triggers prohibit UPDATE and DELETE operations on this table.
          </span>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs">
          
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <option value="all">All Actions</option>
              <option value="agent_deactivated">Agent Deactivated</option>
              <option value="agent_reactivated">Agent Reactivated</option>
              <option value="ticket_assigned">Ticket Assigned / Reassigned</option>
              <option value="priority_changed">Priority Changed</option>
              <option value="invitation_created">Invitation Created</option>
              <option value="invitation_revoked">Invitation Revoked</option>
              <option value="admin_login">Admin Sign In</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Target Type:</span>
            <select
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="p-1 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
            >
              <option value="all">All Targets</option>
              <option value="agent">Agent</option>
              <option value="ticket">Ticket</option>
              <option value="invitation">Invitation</option>
              <option value="auth">Auth</option>
            </select>
          </div>

        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search details or actor..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </form>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target</th>
                <th className="py-3 px-4">Action Details</th>
                <th className="py-3 px-4 text-right">Administrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    Loading activity logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    No activity logs recorded matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    
                    {/* Timestamp */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'medium'
                      })}
                    </td>

                    {/* Action Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Target */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {log.target_type}
                      </span>
                      {log.target_id && (
                        <span className="text-[11px] text-slate-400 font-mono ml-1.5">
                          #{log.target_id}
                        </span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {log.details}
                    </td>

                    {/* Admin */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {log.admin_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.admin_email}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}