import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AgentDashboard from './components/AgentDashboard';
import CustomerPortal from './components/CustomerPortal';
import LoginModal from './components/LoginModal';
import { getCurrentUser } from './api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        Initializing FRONTDESK...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar
        currentUser={currentUser}
        onUserSwitched={setCurrentUser}
      />

      <main className="flex-1">
        {!currentUser ? (
          <LoginModal onLoginSuccess={setCurrentUser} />
        ) : currentUser.role === 'agent' || currentUser.role === 'admin' ? (
          <AgentDashboard currentUser={currentUser} />
        ) : (
          <CustomerPortal currentUser={currentUser} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        FRONTDESK &copy; 2026 iNav Technologies Full Stack Developer Assessment • All Rights Reserved.
      </footer>
    </div>
  );
}
