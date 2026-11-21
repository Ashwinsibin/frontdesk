import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp,
  RefreshCw, Search, UserCheck, ShieldCheck, Award
} from 'lucide-react';
import { api } from '../../api';

export default function AdminPerformance() {
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminPerformance();
      setPerformance(data);
    } catch (err) {
      console.error('Error fetching agent performance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const formatMinutes = (minutes) => {
    if (!minutes || minutes === 0) return 'N/A';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remMins = minutes % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  };

  const filtered = performance.filter(p => 
    p.agent_name.toLowerCase().includes(search.toLowerCase()) ||
    p.agent_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Control Bar: Search & Refresh */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            Support Agent Performance Metrics
          </h2>
          <p className="text-xs text-slate-400">
            Computed in real-time from actual database ticket logs, response timestamps, and resolution metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agent name or email..."
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <button
            onClick={fetchPerformance}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Support Agent</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Total Handled</th>
                <th className="py-3 px-3 text-center">Resolved</th>
                <th className="py-3 px-3 text-center">Active Assigned</th>
                <th className="py-3 px-3 text-center">Avg First Response</th>
                <th className="py-3 px-3 text-center">Avg Resolution Time</th>
                <th className="py-3 px-3 text-center">Overdue</th>
                <th className="py-3 px-4 text-right">SLA Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && performance.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    Computing agent performance statistics...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-400">
                    No agent performance records found.
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const complianceNum = parseFloat(p.sla_compliance_pct);
                  return (
                    <tr key={p.agent_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      
                      {/* Agent Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {p.agent_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.agent_email}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {p.status === 'active' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                            Active
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Total Handled */}
                      <td className="py-3 px-3 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {p.total_handled}
                      </td>

                      {/* Resolved */}
                      <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.tickets_resolved}
                      </td>

                      {/* Active Assigned */}
                      <td className="py-3 px-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {p.currently_assigned}
                      </td>

                      {/* Avg First Response Time */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                        {formatMinutes(p.avg_first_response_minutes)}
                      </td>

                      {/* Avg Resolution Time */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                        {formatMinutes(p.avg_resolution_minutes)}
                      </td>

                      {/* Overdue */}
                      <td className="py-3 px-3 text-center">
                        {p.overdue_tickets > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                            {p.overdue_tickets}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      {/* SLA Compliance % */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden hidden sm:block">
                            <div 
                              style={{ width: `${complianceNum}%` }}
                              className={`h-full rounded-full ${
                                complianceNum >= 90 ? 'bg-emerald-500' : complianceNum >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <span className={`font-bold font-mono ${
                            complianceNum >= 90 
                              ? 'text-emerald-600 dark:text-emerald-400' 
                              : complianceNum >= 75 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {complianceNum}%
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}