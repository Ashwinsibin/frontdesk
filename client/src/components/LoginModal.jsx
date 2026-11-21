import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { api, setAuthToken, setCurrentUser } from '../api';

export default function LoginModal({ onLoginSuccess }) {
  const [demoUsers, setDemoUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const res = await api.login(email, password);
      setAuthToken(res.token);
      setCurrentUser(res.user);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (user) => {
    try {
      setLoading(true);
      setError('');
      const pwd = user.role === 'agent' ? 'agent123' : 'customer123';
      const res = await api.login(user.email, pwd);
      setAuthToken(res.token);
      setCurrentUser(res.user);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-8 text-center">
        <div className="inline-flex p-3 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md mb-4">
          <Shield className="w-8 h-8" />
        </div>
        
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">FRONTDESK Login</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Support Ticket Management System for iNav Technologies Machine Test
        </p>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg mb-4 text-left font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3 text-left mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent or customer email"
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition shadow-xs mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Demo Logins for Evaluator */}
        <div className="pt-4 border-t border-slate-100 text-left">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            🚀 1-Click Demo Logins (Evaluator Shortcuts)
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {demoUsers.length === 0 ? (
              <p className="text-xs text-slate-400">Loading demo users from database...</p>
            ) : (
              demoUsers.slice(0, 5).map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleQuickDemoLogin(u)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-between transition group"
                >
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-blue-700">{u.name}</span>
                    <span className="text-[10px] text-slate-400 block">{u.role === 'agent' ? 'Support Agent' : 'Customer'}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
