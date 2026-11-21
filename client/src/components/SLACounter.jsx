import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, PauseCircle } from 'lucide-react';

export default function SLACounter({ label, dueDate, isBreached, isPaused, completedAt }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgencyClass, setUrgencyClass] = useState('text-slate-600');

  useEffect(() => {
    if (completedAt) {
      setTimeLeft('Completed');
      setUrgencyClass(isBreached ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200');
      return;
    }

    if (isPaused) {
      setTimeLeft('Paused (Waiting on Customer)');
      setUrgencyClass('text-amber-700 bg-amber-50 border-amber-200');
      return;
    }

    const calculate = () => {
      const now = new Date();
      const target = new Date(dueDate);
      const diffMs = target.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('SLA Breached');
        setUrgencyClass('text-rose-700 bg-rose-50 border-rose-300 font-bold');
        return;
      }

      const totalMins = Math.floor(diffMs / (60 * 1000));
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;

      if (hours < 1) {
        setTimeLeft(`${mins}m left`);
        setUrgencyClass('text-rose-600 bg-rose-50 border-rose-200 font-semibold animate-pulse');
      } else if (hours < 4) {
        setTimeLeft(`${hours}h ${mins}m left`);
        setUrgencyClass('text-amber-600 bg-amber-50 border-amber-200');
      } else {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setTimeLeft(days > 0 ? `${days}d ${remHours}h left` : `${hours}h ${mins}m left`);
        setUrgencyClass('text-emerald-700 bg-emerald-50 border-emerald-200');
      }
    };

    calculate();
    const interval = setInterval(calculate, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [dueDate, isBreached, isPaused, completedAt]);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${urgencyClass}`}>
      {completedAt ? (
        <CheckCircle className="w-3.5 h-3.5" />
      ) : isPaused ? (
        <PauseCircle className="w-3.5 h-3.5" />
      ) : isBreached ? (
        <AlertTriangle className="w-3.5 h-3.5" />
      ) : (
        <Clock className="w-3.5 h-3.5" />
      )}
      <span className="font-medium">{label}:</span>
      <span>{timeLeft}</span>
    </div>
  );
}
