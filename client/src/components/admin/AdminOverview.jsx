import React from 'react';
import { 
  Users, UserCheck, Ticket, CheckCircle, Clock, AlertTriangle,
  Mail, TrendingUp, BarChart2, PieChart, ShieldAlert, ArrowRight
} from 'lucide-react';

export default function AdminOverview({ overviewData, onNavigate }) {
  if (!overviewData) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Loading overview metrics...
      </div>
    );
  }

  const { metrics, charts } = overviewData;

  // Format priority counts
  const priorityMap = { urgent: 0, medium: 0, small: 0 };
  charts.ticketsByPriority.forEach(p => {
    priorityMap[p.priority] = p.count;
  });

  const totalPriorityCount = Object.values(priorityMap).reduce((a, b) => a + b, 0) || 1;

  // Format status counts
  const statusColors = {
    new: 'bg-slate-400',
    open: 'bg-blue-500',
    pending_customer: 'bg-amber-500',
    resolved: 'bg-emerald-500',
    closed: 'bg-slate-600'
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Total Customers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Customers</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics.totalCustomers}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total registered customer accounts</div>
        </div>

        {/* Support Agents */}
        <div 
          onClick={() => onNavigate('agents')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-blue-600">Support Agents</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-baseline gap-2">
            <span>{metrics.totalAgents}</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics.activeAgents} Active
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.inactiveAgents > 0 ? `${metrics.inactiveAgents} deactivated agent(s)` : 'All agents active'}
          </div>
        </div>

        {/* Total Tickets */}
        <div 
          onClick={() => onNavigate('tickets')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-blue-600">Total Tickets</span>
            <Ticket className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {metrics.totalTickets}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {metrics.openTickets} open / in-progress
          </div>
        </div>

        {/* Overdue / SLA Risk */}
        <div 
          onClick={() => onNavigate('tickets')}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs hover:border-rose-400 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">SLA Overdue</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {metrics.overdueTickets}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Requires immediate attention</div>
        </div>

      </div>

      {/* Second Row Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-left">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Resolved Tickets</span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{metrics.resolvedTickets}</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-left">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Auto-Closed</span>
          <div className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-0.5">{metrics.closedTickets}</div>
        </div>
        <div 
          onClick={() => onNavigate('invitations')}
          className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-left hover:border-purple-300 cursor-pointer transition"
        >
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase">Pending Invitations</span>
          <div className="text-lg font-bold text-purple-700 dark:text-purple-300 mt-0.5">{metrics.pendingInvitations}</div>
        </div>
        <div 
          onClick={() => onNavigate('performance')}
          className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-left hover:border-blue-300 cursor-pointer transition"
        >
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase">Agent Roster</span>
          <div className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">{metrics.totalAgents} Agents</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Tickets Created Over Time */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Tickets Created Over Time
              </h3>
              <p className="text-xs text-slate-400">Daily creation trend across the last 14 days</p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              Last 14 Days
            </span>
          </div>

          {charts.ticketsOverTime.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              No recent ticket creation activity
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
                {charts.ticketsOverTime.map((item, idx) => {
                  const maxVal = Math.max(...charts.ticketsOverTime.map(t => t.count), 1);
                  const heightPct = Math.max(15, Math.round((item.count / maxVal) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition absolute -top-5">
                        {item.count}
                      </div>
                      <div 
                        style={{ height: `${heightPct}%` }}
                        className="w-full bg-blue-500 hover:bg-blue-600 rounded-t-sm transition-all"
                      />
                      <span className="text-[9px] text-slate-400 transform -rotate-45 origin-top-left mt-2 whitespace-nowrap">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 pt-3">
                <span>14 days ago</span>
                <span>Today</span>
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Ticket Distribution by Priority */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-500" />
                Ticket Distribution by Priority
              </h3>
              <p className="text-xs text-slate-400">Proportion of urgent, medium, and small tickets</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Urgent */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Urgent (Same-day 18:30 IST)
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {priorityMap.urgent} ({Math.round((priorityMap.urgent / totalPriorityCount) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${(priorityMap.urgent / totalPriorityCount) * 100}%` }}
                  className="h-full bg-rose-500 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Medium */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium (18 Working Hours)
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {priorityMap.medium} ({Math.round((priorityMap.medium / totalPriorityCount) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${(priorityMap.medium / totalPriorityCount) * 100}%` }}
                  className="h-full bg-amber-500 rounded-full transition-all"
                />
              </div>
            </div>

            {/* Small */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Small (36 Working Hours)
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {priorityMap.small} ({Math.round((priorityMap.small / totalPriorityCount) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${(priorityMap.small / totalPriorityCount) * 100}%` }}
                  className="h-full bg-blue-500 rounded-full transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Ticket Distribution by Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-500" />
                Ticket Distribution by Status
              </h3>
              <p className="text-xs text-slate-400">Current queue distribution across lifecycle stages</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {charts.ticketsByStatus.map(st => (
              <div key={st.status} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <span className={`w-2 h-2 rounded-full ${statusColors[st.status] || 'bg-slate-400'}`} />
                  {st.status.replace('_', ' ')}
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {st.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 4: Agent Performance Comparison */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-500" />
                Agent Workload & Performance
              </h3>
              <p className="text-xs text-slate-400">Assigned active tickets vs resolved tickets</p>
            </div>
            <button
              onClick={() => onNavigate('performance')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View Full Metrics <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {charts.agentPerformance.slice(0, 6).map(agent => (
              <div key={agent.id} className="text-xs flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{agent.name}</span>
                    {agent.status === 'inactive' && (
                      <span className="text-[9px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 px-1.5 py-0.2 rounded font-bold uppercase">
                        Inactive
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{agent.email}</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Active</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{agent.active_tickets}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Resolved</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{agent.resolved_tickets}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}