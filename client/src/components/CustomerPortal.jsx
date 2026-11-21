import React, { useState, useEffect } from 'react';
import { 
  Plus, MessageSquare, Clock, CheckCircle, AlertCircle, 
  Send, RotateCcw, X, Inbox 
} from 'lucide-react';
import { api } from '../api';

export default function CustomerPortal({ currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // New Ticket Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomerTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    try {
      setLoadingDetail(true);
      const res = await api.getCustomerTicketDetail(ticket.id);
      setSelectedTicket(res.ticket);
      setMessages(res.messages);
    } catch (err) {
      alert('Failed to load conversation: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;

    try {
      setCreating(true);
      await api.createTicket({
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      await fetchTickets();
    } catch (err) {
      alert('Error creating ticket: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      setSendingReply(true);
      await api.postCustomerReply(selectedTicket.id, replyText);
      setReplyText('');
      await openTicket(selectedTicket);
      await fetchTickets();
    } catch (err) {
      alert('Error sending reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedTicket) return;
    if (!window.confirm('Do you want to reopen this ticket? (Allowed within 7 calendar days of resolution)')) return;

    try {
      await api.reopenTicket(selectedTicket.id);
      alert('Ticket successfully reopened!');
      await openTicket(selectedTicket);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  const getReopenStatus = (ticket) => {
    if (ticket.status !== 'resolved') return null;
    if (!ticket.resolved_at) return null;

    const resolvedTime = new Date(ticket.resolved_at).getTime();
    const deadlineTime = resolvedTime + 7 * 24 * 60 * 60 * 1000;
    const nowTime = Date.now();
    const diffHours = Math.floor((deadlineTime - nowTime) / (1000 * 60 * 60));

    if (diffHours <= 0) {
      return { allowed: false, text: 'Reopen window expired (> 7 days)' };
    }
    const days = Math.floor(diffHours / 24);
    return { allowed: true, text: `Can reopen (${days > 0 ? `${days}d ` : ''}${diffHours % 24}h remaining)` };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Customer Support Portal</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Welcome, {currentUser.name}. Submit support tickets and track your resolutions.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create New Ticket
        </button>
      </div>

      {/* Main Grid: Ticket List & Conversation View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List (Left Column) */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">My Tickets ({tickets.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading your tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium">You have not submitted any tickets yet.</p>
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => openTicket(t)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-600' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">{t.ticket_number}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">{t.title}</h3>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Priority: <strong className="text-slate-600 dark:text-slate-300 uppercase">{t.priority}</strong></span>
                      <span>{new Date(t.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation View (Right 2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col min-h-[500px] max-h-[600px] overflow-hidden transition-colors duration-200">
          {selectedTicket ? (
            <>
              {/* Ticket Details Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                      {selectedTicket.ticket_number}
                    </span>
                    <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {selectedTicket.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{selectedTicket.title}</h2>
                </div>

                {/* Reopen Action (7 Calendar Days Limit) */}
                {selectedTicket.status === 'resolved' && (() => {
                  const status = getReopenStatus(selectedTicket);
                  if (!status) return null;
                  return (
                    <div>
                      {status.allowed ? (
                        <button
                          onClick={handleReopen}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                          title="Customers can reopen resolved tickets within 7 calendar days"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reopen Ticket
                        </button>
                      ) : (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded border border-rose-200 dark:border-rose-800">
                          Reopen window expired (&gt; 7 days). Please create a new ticket.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Messages Stream (STRICT PRIVACY: ONLY PUBLIC REPLIES SHOWN) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/40">
                {/* Original Description */}
                <div className="bg-blue-50/60 dark:bg-slate-800/60 p-3.5 rounded-lg border border-blue-100 dark:border-slate-700 text-xs">
                  <div className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Your Problem Description:</div>
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line">{selectedTicket.description}</p>
                </div>

                {/* Reply Stream */}
                {messages.map((m) => {
                  const isCustomer = m.sender_role === 'customer';
                  return (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-lg border text-xs ${
                        isCustomer
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 ml-6 text-slate-800 dark:text-slate-200'
                          : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 mr-6 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {isCustomer ? 'You' : `Support Agent (${m.sender_name})`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </span>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed">{m.content}</p>
                    </div>
                  );
                })}
              </div>

              {/* Customer Reply Composer */}
              {selectedTicket.status !== 'closed' && (
                <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your response to support..."
                    className="flex-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !replyText.trim()}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-xs font-bold transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
              <MessageSquare className="w-12 h-12 text-slate-200 dark:text-slate-700 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a ticket from the left to view conversation.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 text-slate-900 dark:text-white transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Create New Support Ticket</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Problem Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Cannot access invoice billing portal"
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="urgent">🔴 Urgent (Reply $\le$ 2h, Resolve today by 18:30)</option>
                  <option value="medium">🟡 Medium (Reply $\le$ 4.5h, Resolve 3 working days)</option>
                  <option value="small">🔵 Small (Reply $\le$ 1 day, Resolve 1 working week)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Detailed Description</label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe what happened, error messages, and reproduction steps..."
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-xs font-bold"
                >
                  {creating ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
