import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AgentDashboard from './components/AgentDashboard';
import AdminDashboard from './components/AdminDashboard';
import CustomerPortal from './components/CustomerPortal';
import LoginModal from './components/LoginModal';
import { getCurrentUser } from './api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Theme state: 'light' by default for first-time visitors
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('frontdesk_theme') || 'light';
  });

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  // Sync theme with DOM and localStorage
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('frontdesk_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        Initializing FRONTDESK...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <Navbar
        currentUser={currentUser}
        onUserSwitched={setCurrentUser}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1">
        {!currentUser ? (
          <LoginModal 
            onLoginSuccess={setCurrentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : currentUser.role === 'admin' ? (
          <AdminDashboard currentUser={currentUser} />
        ) : currentUser.role === 'agent' ? (
          <AgentDashboard currentUser={currentUser} />
        ) : (
          <CustomerPortal currentUser={currentUser} />
        )}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
        FRONTDESK &copy; 2026 Arvo Systems • All Rights Reserved.
      </footer>
    </div>
  );
}
