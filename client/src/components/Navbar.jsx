import React, { useState, useEffect } from 'react';
import { Shield, User, LogOut, RefreshCw, Users, HelpCircle } from 'lucide-react';
import { api, getCurrentUser, setAuthToken, setCurrentUser } from '../api';

export default function Navbar({ currentUser, onUserSwitched, onOpenHolidays }) {
  const [demoUsers, setDemoUsers] = useState([]);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  useEffect(() => {
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const handleSwitchUser = async (user) => {
    try {
      const res = await api.login(user.email, user.role === 'agent' ? 'agent123' : 'customer123');
      setAuthToken(res.token);
      setCurrentUser(res.user);
      onUserSwitched(res.user);
      setShowSwitchMenu(false);
    } catch (err) {
      alert('Could not switch demo user: ' + err.message);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    onUserSwitched(null);
  };

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-lg shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">FRONTDESK</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                iNav Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400">9-Agent Ticket & Business Hours SLA System</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3">
            {/* Quick Demo Identity Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-md border border-slate-700 transition"
                title="Switch between the 9 support agents or test customers"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Switch Demo User</span>
                <span className="text-slate-400 text-[10px]">▼</span>
              </button>

              {showSwitchMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    Support Agents (9 Total)
                  </div>
                  {demoUsers.filter(u => u.role === 'agent').map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSwitchUser(u)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between ${currentUser.id === u.id ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-700'}`}
                    >
                      <span>{u.name}</span>
                      <span className="text-[10px] text-slate-400">{u.email}</span>
                    </button>
                  ))}

                  <div className="px-3 py-1.5 mt-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 border-t">
                    Customer Accounts
                  </div>
                  {demoUsers.filter(u => u.role === 'customer').map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSwitchUser(u)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between ${currentUser.id === u.id ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-slate-700'}`}
                    >
                      <span>{u.name}</span>
                      <span className="text-[10px] text-slate-400">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Current User Badge */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700">
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-medium text-white">{currentUser.name}</div>
                <div className="text-[10px] uppercase font-semibold text-slate-400">
                  {currentUser.role === 'agent' ? 'Support Agent' : 'Customer'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
