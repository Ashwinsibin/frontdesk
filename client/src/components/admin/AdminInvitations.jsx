import React, { useState, useEffect } from 'react';
import { 
  Mail, Key, Plus, RefreshCw, X, Check, Copy, AlertTriangle, 
  CheckCircle, Clock, ShieldAlert, Filter, Calendar
} from 'lucide-react';
import { api } from '../../api';

export default function AdminInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'accepted', 'expired', 'revoked'

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdInvite, setCreatedInvite] = useState(null);

  // Revoke Modal
  const [revokingInvite, setRevokingInvite] = useState(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  // Clipboard Copied State
  const [copiedToken, setCopiedToken] = useState(null);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState('');

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminInvitations();
      setInvitations(data);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleCopy = (token) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setCreateLoading(true);
      setCreateError('');
      const res = await api.createAdminInvitation(inviteEmail.trim());
      setCreatedInvite(res.invitation);
      setSuccessBanner(res.message);
      await fetchInvitations();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokingInvite) return;

    try {
      setRevokeLoading(true);
      setRevokeError('');
      const res = await api.revokeInvitation(revokingInvite.id);
      setSuccessBanner(res.message);
      setRevokingInvite(null);
      await fetchInvitations();
    } catch (err) {
      setRevokeError(err.message);
    } finally {
      setRevokeLoading(false);
    }
  };

  const filtered = invitations.filter(inv => {
    if (statusFilter === 'all') return true;
    return inv.status === statusFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-3 h-3 text-emerald-600" /> Accepted
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            <X className="w-3 h-3 text-slate-500" /> Revoked
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <Clock className="w-3 h-3 text-rose-600" /> Expired
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      {successBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Filter Tabs */}
        <div className="inline-flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'all' ? 'bg-white dark:bg-slate-700 shadow-xs text-blue-700 dark:text-blue-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            All ({invitations.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'pending' ? 'bg-white dark:bg-slate-700 shadow-xs text-amber-700 dark:text-amber-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Pending ({invitations.filter(i => i.status === 'pending').length})
          </button>
          <button
            onClick={() => setStatusFilter('accepted')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'accepted' ? 'bg-white dark:bg-slate-700 shadow-xs text-emerald-700 dark:text-emerald-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Accepted ({invitations.filter(i => i.status === 'accepted').length})
          </button>
          <button
            onClick={() => setStatusFilter('revoked')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'revoked' ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-700 dark:text-slate-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Revoked ({invitations.filter(i => i.status === 'revoked').length})
          </button>
          <button
            onClick={() => setStatusFilter('expired')}
            className={`px-3 py-1.5 rounded-md transition ${statusFilter === 'expired' ? 'bg-white dark:bg-slate-700 shadow-xs text-rose-700 dark:text-rose-300 font-bold' : 'hover:text-slate-900 dark:hover:text-white'}`}
          >
            Expired ({invitations.filter(i => i.status === 'expired').length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreatedInvite(null);
              setInviteEmail('');
              setCreateError('');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Agent Invitation
          </button>

          <button
            onClick={fetchInvitations}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

      </div>

      {/* Invitations Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Invited Email</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Invitation Token</th>
                <th className="py-3 px-3">Created By</th>
                <th className="py-3 px-3">Created Date</th>
                <th className="py-3 px-3">Expires Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading && invitations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    Loading agent invitations...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No invitations found.
                  </td>
                </tr>
              ) : (
                filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    
                    {/* Email */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {inv.email}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(inv.status)}
                    </td>

                    {/* Token */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <span>{inv.token.substring(0, 14)}...</span>
                        <button
                          onClick={() => handleCopy(inv.token)}
                          className="p-1 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                          title="Copy Full Token"
                        >
                          {copiedToken === inv.token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Created By */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {inv.created_by_name || 'System Admin'}
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>

                    {/* Expires Date */}
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(inv.expires_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {inv.status === 'pending' && (
                        <button
                          onClick={() => {
                            setRevokingInvite(inv);
                            setRevokeError('');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition"
                          title="Revoke this unused token"
                        >
                          Revoke
                        </button>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVITATION MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 text-left relative transition-colors duration-200">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
              <Key className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create Support Agent Invitation
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Issues a 7-day cryptographically secure invitation token bound to the agent's email address. The agent will enter this token during registration.
            </p>

            {createError && (
              <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs">
                {createError}
              </div>
            )}

            {createdInvite ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300">
                  ✅ Invitation token generated successfully for <strong>{createdInvite.email}</strong>!
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Invitation Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdInvite.token}
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg select-all text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={() => handleCopy(createdInvite.token)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 transition"
                    >
                      {copiedToken === createdInvite.token ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Expires: {new Date(createdInvite.expires_at || createdInvite.expiresAt).toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => { setCreatedInvite(null); setInviteEmail(''); }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition mt-2"
                >
                  Invite Another Agent
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agent Recipient Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. agent.name@frontdesk.com"
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
                  >
                    {createLoading ? 'Generating...' : 'Generate Invitation Token'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REVOKE INVITATION MODAL */}
      {revokingInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 text-left relative">
            <button
              onClick={() => setRevokingInvite(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Revoke Invitation
              </h2>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Revoke the unused invitation token for <strong>{revokingInvite.email}</strong>? The token will immediately become invalid and cannot be used for agent registration.
            </p>

            {revokeError && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {revokeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRevokingInvite(null)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revokeLoading}
                onClick={handleConfirmRevoke}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-xs transition"
              >
                {revokeLoading ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}