import React, { useState, useEffect } from 'react';
import { Shield, User, LogOut, RefreshCw, Users, Sun, Moon } from 'lucide-react';
import { api, setAuthToken, setCurrentUser } from '../api';

export default function Navbar({ currentUser, onUserSwitched, theme, onToggleTheme }) {
  const [demoUsers, setDemoUsers] = useState([]);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  useEffect(() => {
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const handleSwitchUser = async (user) => {
    try {
      const pwd = user.role === 'admin' ? 'admin123' : user.role === 'agent' ? 'agent123' : 'customer123';
      const res = await api.login(user.email, pwd);
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
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 border-b border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2 rounded-lg shadow-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-lg text-white">FRONTDESK</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 border border-blue-700">
                ARVO SYSTEMS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">9-Agent Support & SLA Management System</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          
          {/* Dark / Light Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 dark:text-blue-300 border border-slate-700 transition"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-200 hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-300" />
                <span className="text-xs text-slate-200 hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {currentUser && (
            <>
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
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 max-h-96 overflow-y-auto custom-scrollbar">
                    
                    {/* Administrator Section */}
                    {demoUsers.some(u => u.role === 'admin') && (
                      <>
                        <div className="px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                          <span>Administrator</span>
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.2 rounded font-mono">Role: admin</span>
                        </div>
                        {demoUsers.filter(u => u.role === 'admin').map(u => (
                          <button
                            key={u.id}
                            onClick={() => handleSwitchUser(u)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                              currentUser.id === u.id 
                                ? 'bg-purple-50 dark:bg-purple-900/40 font-bold text-purple-700 dark:text-purple-300' 
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>{u.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400">{u.email}</span>
                          </button>
                        ))}
                      </>
                    )}

                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 border-t">
                      Support Agents (9 Total)
                    </div>
                    {demoUsers.filter(u => u.role === 'agent').map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSwitchUser(u)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                          currentUser.id === u.id 
                            ? 'bg-blue-50 dark:bg-blue-900/40 font-bold text-blue-700 dark:text-blue-300' 
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{u.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400">{u.email}</span>
                      </button>
                    ))}

                    <div className="px-3 py-1.5 mt-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 border-t">
                      Customer Accounts
                    </div>
                    {demoUsers.filter(u => u.role === 'customer').map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSwitchUser(u)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center justify-between ${
                          currentUser.id === u.id 
                            ? 'bg-emerald-50 dark:bg-emerald-900/40 font-bold text-emerald-700 dark:text-emerald-300' 
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{u.name}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Current User Badge */}
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'agent' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}>
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-xs font-medium text-white">{currentUser.name}</div>
                  <div className={`text-[10px] uppercase font-semibold ${
                    currentUser.role === 'admin' ? 'text-purple-400' : currentUser.role === 'agent' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>
                    {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'agent' ? 'Support Agent' : 'Customer'}
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
