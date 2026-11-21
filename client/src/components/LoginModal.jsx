import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User, ArrowRight, Eye, EyeOff, CheckCircle, Sun, Moon, Key } from 'lucide-react';
import { api, setAuthToken, setCurrentUser } from '../api';

export default function LoginModal({ onLoginSuccess, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [demoUsers, setDemoUsers] = useState([]);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isAgentInvite, setIsAgentInvite] = useState(false);

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const resetForm = () => {
    setName('');
    setPassword('');
    setConfirmPassword('');
    setInviteToken('');
    setIsAgentInvite(false);
    setError('');
  };

  const switchToRegister = () => {
    resetForm();
    setSuccessMessage('');
    setMode('register');
  };

  const switchToLogin = () => {
    resetForm();
    setMode('login');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    // Client-side validation checks
    if (!name.trim()) {
      return setError('Full Name is required.');
    }
    if (!email.trim()) {
      return setError('Email Address is required.');
    }
    if (!password) {
      return setError('Password is required.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters long.');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (isAgentInvite && !inviteToken.trim()) {
      return setError('An Administrator invitation token is required to register as a Support Agent.');
    }

    try {
      setLoading(true);

      if (isAgentInvite) {
        // Agent Registration via invitation token
        await api.registerAgent({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          inviteToken: inviteToken.trim()
        });
        setSuccessMessage('Support Agent account registered successfully! You can now sign in.');
      } else {
        // Public Customer Registration
        await api.register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword
        });
        setSuccessMessage('Customer account created successfully! You can now sign in.');
      }

      setPassword('');
      setConfirmPassword('');
      setInviteToken('');
      setIsAgentInvite(false);
      setMode('login');
      // Refresh demo users list to include newly created user
      api.getDemoUsers().then(setDemoUsers).catch(() => {});
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
      setSuccessMessage('');
      const pwd = user.role === 'admin' ? 'admin123' : user.role === 'agent' ? 'agent123' : 'customer123';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-8 text-center transition-colors duration-200 relative">
        
        {/* Top-Right Theme Toggle */}
        <button
          onClick={onToggleTheme}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </button>

        {/* Brand Icon */}
        <div className="inline-flex p-3 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md mb-4">
          <Shield className="w-8 h-8" />
        </div>
        
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {mode === 'login' 
            ? 'FRONTDESK Login' 
            : isAgentInvite 
              ? 'Support Agent Registration' 
              : 'Create Customer Account'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
          {mode === 'login' 
            ? 'Support Ticket Management System for Arvo Systems' 
            : isAgentInvite
              ? 'Enter your Administrator invitation token to register as a Support Agent'
              : 'Register to submit, track, and monitor customer support tickets'}
        </p>

        {/* Success Message Banner */}
        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs p-3 rounded-lg mb-4 text-left font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Message Banner */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-lg mb-4 text-left font-medium">
            {error}
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5 text-left mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent or customer email"
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-10 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition shadow-xs mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>

            {/* Switch to Registration Link */}
            <div className="text-center pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Don't have an account? </span>
              <button
                type="button"
                onClick={switchToRegister}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create Account
              </button>
            </div>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-left mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maya Deshmukh"
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAgentInvite ? "agent.name@frontdesk.com" : "customer@company.com"}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full text-xs pl-9 pr-10 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full text-xs pl-9 pr-10 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Optional Agent Invitation Token Input */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsAgentInvite(!isAgentInvite)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                {isAgentInvite ? '← Register as Customer instead' : 'Have a Support Agent Invitation Token? Click here'}
              </button>

              {isAgentInvite && (
                <div className="mt-2.5 p-3 bg-blue-50 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900 rounded-lg space-y-1.5 animate-fadeIn">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Agent Invitation Token <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required={isAgentInvite}
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value)}
                    placeholder="Enter invitation token"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    🛡️ Security Rule: Public registration default is Customer. Agent accounts require an invitation token issued by an Administrator.
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-bold rounded-lg transition shadow-xs mt-2"
            >
              {loading ? 'Creating Account...' : isAgentInvite ? 'Register as Support Agent' : 'Create Customer Account'}
            </button>

            {/* Switch to Login Link */}
            <div className="text-center pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Already have an account? </span>
              <button
                type="button"
                onClick={switchToLogin}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* 1-Click Demo Logins for Evaluator (Preserved) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            🚀 1-Click Demo Logins (Evaluator Shortcuts)
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
            {demoUsers.length === 0 ? (
              <p className="text-xs text-slate-400">Loading demo users from database...</p>
            ) : (
              // Display Administrator, sample agents, and customers
              [
                ...demoUsers.filter(u => u.role === 'admin'),
                ...demoUsers.filter(u => u.role === 'agent').slice(0, 3),
                ...demoUsers.filter(u => u.role === 'customer').slice(0, 2)
              ].map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleQuickDemoLogin(u)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 flex items-center justify-between transition group"
                >
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                      {u.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {u.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      u.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        : u.role === 'agent'
                        ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : u.role === 'agent' ? 'Agent' : 'Customer'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}