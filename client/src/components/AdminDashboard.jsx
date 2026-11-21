import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Ticket, BarChart3, Mail, Activity, 
  RefreshCw, Shield, ChevronRight, Inbox, Menu, X
} from 'lucide-react';
import { api } from '../api';
import AdminOverview from './admin/AdminOverview';
import AdminAgents from './admin/AdminAgents';
import AdminTickets from './admin/AdminTickets';
import AdminPerformance from './admin/AdminPerformance';
import AdminInvitations from './admin/AdminInvitations';
import AdminActivityLogs from './admin/AdminActivityLogs';
import AgentDashboard from './AgentDashboard';

export default function AdminDashboard({ currentUser }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminOverview();
      setOverviewData(data);
    } catch (err) {
      console.error('Error loading admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'agents', label: 'Support Agents', icon: Users },
    { id: 'tickets', label: 'All Tickets', icon: Ticket },
    { id: 'performance', label: 'Agent Performance', icon: BarChart3 },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'activity_logs', label: 'Activity Logs', icon: Activity },
    { id: 'workstation', label: 'Agent Workstation', icon: Inbox }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-colors duration-200">
      
      {/* Top Admin Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Admin Management Console
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Administrator
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Full system oversight: manage agents, ticket assignments, SLAs, invitations, and immutable activity logs.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <button
            onClick={fetchOverview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Overview
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar & Content Area */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Navigation Sidebar */}
        <aside className={`w-full md:w-60 shrink-0 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-xs space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
              Admin Navigation
            </div>

            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition ${
                    isActive
                      ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                </button>
              );
            })}
          </div>

          {/* Quick System Status Card */}
          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-left hidden md:block">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Live System Status
            </span>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Neon PostgreSQL Active</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Operating Schedule: Mon-Fri 9:30 AM – 6:30 PM IST
            </p>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 w-full min-w-0">
          {activeTab === 'overview' && (
            <AdminOverview 
              overviewData={overviewData}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'agents' && (
            <AdminAgents />
          )}

          {activeTab === 'tickets' && (
            <AdminTickets currentUserId={currentUser.id} />
          )}

          {activeTab === 'performance' && (
            <AdminPerformance />
          )}

          {activeTab === 'invitations' && (
            <AdminInvitations />
          )}

          {activeTab === 'activity_logs' && (
            <AdminActivityLogs />
          )}

          {activeTab === 'workstation' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-300">
                ℹ️ <strong>Workstation View:</strong> As an Administrator, you can view the agent ticket queue exactly as support agents see it.
              </div>
              <AgentDashboard currentUser={currentUser} />
            </div>
          )}
        </main>

      </div>

    </div>
  );
}