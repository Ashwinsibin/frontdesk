import React, { useState } from 'react';
import { 
  X, Lock, Send, AlertTriangle, CheckCircle, Clock, ShieldAlert,
  ArrowRight, MessageSquare, History, User, Check, Zap, Moon
} from 'lucide-react';
import { api } from '../api';
import SLACounter from './SLACounter';

export default function TicketDetailModal({ ticketId, onClose, onTicketUpdated, currentUserId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Message composer tabs: 'reply' (Public) vs 'note' (Internal)
  const [activeTab, setActiveTab] = useState('reply');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Priority change state
  const [changingPriority, setChangingPriority] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('');

  // Resolving state
  const [resolving, setResolving] = useState(false);

  // Working hours simulation state (allows testing live second-by-second countdown on weekends/off-hours)
  const [simulateWorkingHours, setSimulateWorkingHours] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getAgentTicketDetail(ticketId);
      setData(res);
      setSelectedPriority(res.ticket.priority);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDetail();
  }, [ticketId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      setSending(true);
      await api.postAgentMessage(ticketId, {
        messageType: activeTab === 'reply' ? 'public_reply' : 'internal_note',
        content: messageText
      });
      setMessageText('');
      await fetchDetail();
      onTicketUpdated();
    } catch (err) {
      alert('Failed to send message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePriorityChange = async () => {
    if (selectedPriority === data.ticket.priority) return;
    try {
      setChangingPriority(true);
      await api.updatePriority(ticketId, selectedPriority);
      await fetchDetail();
      onTicketUpdated();
    } catch (err) {
      alert('Failed to update priority: ' + err.message);
    } finally {
      setChangingPriority(false);
    }
  };

  const handleResolve = async () => {
    if (!window.confirm('Are you sure you want to mark this ticket as RESOLVED? This initiates the 7-calendar-day customer reopen window.')) return;
    try {
      setResolving(true);
      await api.resolveTicket(ticketId);
      await fetchDetail();
      onTicketUpdated();
    } catch (err) {
      alert('Failed to resolve ticket: ' + err.message);
    } finally {
      setResolving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl text-center border border-slate-200 dark:border-slate-800">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading ticket #{ticketId}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800">
          <p className="text-rose-600 dark:text-rose-400 font-semibold mb-3">Error loading ticket</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm">Close</button>
        </div>
      </div>
    );
  }

  const { ticket, messages, auditTrail } = data;
  const isAssignedToMe = ticket.assigned_agent_id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900">
              {ticket.ticket_number}
            </span>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {ticket.category || 'General'}
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-1">{ticket.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                {resolving ? 'Resolving...' : 'Mark Resolved'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SLA Status Bar & Ticket Creation Time */}
        <div className="bg-slate-100/80 dark:bg-slate-800/60 px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <SLACounter 
              ticket={ticket} 
              horizontal 
              simulatedServerTime={simulateWorkingHours ? '2026-11-23T04:30:00.000Z' : undefined} 
            />
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Created: <strong className="text-slate-700 dark:text-slate-300">{new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Working Hours Simulation Toggle */}
            <button
              type="button"
              onClick={() => setSimulateWorkingHours(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
                simulateWorkingHours
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Temporarily simulate active working hours (Mon 10:00 AM IST) to verify live countdown on weekends/off-hours"
            >
              <Zap className={`w-3.5 h-3.5 ${simulateWorkingHours ? 'text-amber-100 fill-amber-100 animate-bounce' : 'text-amber-500 dark:text-amber-400'}`} />
              {simulateWorkingHours ? 'Simulating Working Hours (Active)' : '⚡ Test Live Countdown'}
            </button>

            {/* Priority Recalculation Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Priority:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                <option value="urgent">🔴 Urgent (Same-day 18:30)</option>
                <option value="medium">🟡 Medium (3 days)</option>
                <option value="small">🔵 Small (1 week)</option>
              </select>
              {selectedPriority !== ticket.priority && (
                <button
                  onClick={handlePriorityChange}
                  disabled={changingPriority}
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                >
                  {changingPriority ? 'Updating...' : 'Apply & Recalculate'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Informational banner explaining weekend hold vs live countdown */}
        {simulateWorkingHours ? (
          <div className="bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-300/40 dark:border-amber-900/60 px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Simulation Active:</strong> Simulating Monday 10:00 AM IST (Business Hours). The timer is counting down second-by-second in real time.
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setSimulateWorkingHours(false)}
              className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100"
            >
              Exit Simulation
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                SLA countdown is currently on hold because today is <strong>Sunday (Weekend)</strong>. Timers only decay Mon–Fri 9:30 AM – 6:30 PM IST.
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setSimulateWorkingHours(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              Click here to simulate active working hours & test countdown
            </button>
          </div>
        )}

        {/* Main Content: 2-Column Split */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* Left Column: Messages & Activity (2 Cols) */}
          <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
            
            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              
              {/* Ticket Original Description */}
              <div className="bg-blue-50/50 dark:bg-slate-800/50 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {ticket.customer_name?.charAt(0) || 'C'}
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{ticket.customer_name}</span>
                    <span className="text-[10px] text-slate-400">({ticket.customer_email})</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{ticket.description}</p>
              </div>

              {/* Message List */}
              {messages.map((msg) => {
                const isInternal = msg.message_type === 'internal_note';
                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-4 border transition ${
                      isInternal
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {isInternal ? (
                          <span className="inline-flex items-center gap-1 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            <Lock className="w-3 h-3" /> Private Internal Note
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            <MessageSquare className="w-3 h-3" /> Public Reply
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{msg.sender_name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </div>
                    <p className={`text-xs whitespace-pre-line leading-relaxed ${isInternal ? 'text-amber-950 dark:text-amber-200 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
                      {msg.content}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Message Composer (Tabs: Public Reply vs Internal Note) */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('reply')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'reply'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Public Reply (Customer Visible)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('note')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'note'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Private Note (Internal Only)
                </button>
              </div>

              {activeTab === 'reply' ? (
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mb-2">
                  ℹ️ Sending a public reply moves the ticket to <strong>Pending Customer</strong> and <strong>pauses SLA timers</strong> until the customer responds.
                </p>
              ) : (
                <p className="text-[11px] text-amber-800 dark:text-amber-300 mb-2 font-medium">
                  🔒 Internal notes are stored with database-level isolation and <strong>NEVER</strong> exposed to customers.
                </p>
              )}

              <form onSubmit={handleSendMessage} className="space-y-2">
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    activeTab === 'reply'
                      ? 'Type customer-facing reply...'
                      : 'Write confidential internal team note...'
                  }
                  className={`w-full text-xs p-3 rounded-lg border focus:ring-2 focus:outline-none transition ${
                    activeTab === 'reply'
                      ? 'border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'border-amber-300 dark:border-amber-700 focus:ring-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200 font-medium'
                  }`}
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition ${
                      activeTab === 'reply'
                        ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700'
                        : 'bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-slate-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Saving...' : activeTab === 'reply' ? 'Send Public Reply' : 'Save Internal Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Ticket Info & Append-Only Audit Trail (1 Col) */}
          <div className="flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/60">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">Ticket Metadata</h3>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-400">Status</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{ticket.status.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Assigned Agent</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">{ticket.agent_name || 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Category</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">{ticket.category || 'General'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Created By</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {ticket.creator_name ? `${ticket.creator_name} (${ticket.creator_role || 'agent'})` : (ticket.customer_name || 'Customer')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Created At</dt>
                  <dd className="text-slate-700 dark:text-slate-300">
                    {new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Paused Working Time</dt>
                  <dd className="font-semibold text-slate-700 dark:text-slate-300">{ticket.total_paused_working_minutes || 0} mins</dd>
                </div>
              </dl>
            </div>

            {/* Append-Only Audit Trail */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
                <History className="w-4 h-4 text-slate-500" />
                Append-Only Audit History
              </div>
              <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-2 space-y-4 text-xs">
                {auditTrail.map((log) => (
                  <div key={log.id} className="relative pl-4">
                    <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900"></div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      {log.action.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      By: <span className="font-medium text-slate-700 dark:text-slate-300">{log.actor_name || log.actor_role}</span> •{' '}
                      {new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700 shadow-2xs mt-1">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
