import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, PauseCircle } from 'lucide-react';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const WORK_START_MIN = 9 * 60 + 30; // 09:30 AM = 570
const WORK_END_MIN = 18 * 60 + 30;  // 06:30 PM = 1110

function toIST(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS);
}

/**
 * Calculates remaining active working minutes between now and end date,
 * strictly excluding weekends and hours outside 09:30 - 18:30 IST.
 */
function calculateWorkingMinutesFrontend(start, end) {
  const dStart = new Date(start);
  const dEnd = new Date(end);
  if (dEnd <= dStart) return 0;

  let current = new Date(dStart);
  let totalMinutes = 0;

  while (current < dEnd) {
    const ist = toIST(current);
    const dayOfWeek = ist.getUTCDay(); // 0 is Sun, 6 is Sat
    const curHour = ist.getUTCHours();
    const curMin = ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
    const curTotalMin = curHour * 60 + curMin;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Advance to next midnight in IST
      const nextDayUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0) - IST_OFFSET_MS;
      current = new Date(nextDayUtc);
      continue;
    }

    if (curTotalMin < WORK_START_MIN) {
      // Advance to 09:30 IST
      const startTodayUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 9, 30, 0) - IST_OFFSET_MS;
      current = new Date(startTodayUtc);
      continue;
    }

    if (curTotalMin >= WORK_END_MIN) {
      // Advance to next midnight in IST
      const nextDayUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0) - IST_OFFSET_MS;
      current = new Date(nextDayUtc);
      continue;
    }

    // Inside working window: available until 18:30 IST today or dEnd
    const dayEndUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 18, 30, 0) - IST_OFFSET_MS;
    const dayEnd = new Date(dayEndUtc);

    if (dEnd <= dayEnd) {
      totalMinutes += (dEnd.getTime() - current.getTime()) / (60 * 1000);
      break;
    } else {
      totalMinutes += (dayEnd.getTime() - current.getTime()) / (60 * 1000);
      current = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0) - IST_OFFSET_MS);
    }
  }

  return Math.max(0, Math.round(totalMinutes));
}

/**
 * Formats working minutes into working days (9 hours/day = 540 min) and hours/minutes.
 */
function formatWorkingTime(workingMins) {
  if (workingMins <= 0) return '0m left';
  const days = Math.floor(workingMins / 540);
  const remMins = workingMins % 540;
  const hours = Math.floor(remMins / 60);
  const mins = Math.floor(remMins % 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
  }
  return `${mins}m left`;
}

/**
 * Single SLA Counter Badge
 */
export function SingleSLABadge({ 
  label, 
  dueDate, 
  isBreached, 
  isPaused, 
  completedAt, 
  remainingWorkingMinutes 
}) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgencyClass, setUrgencyClass] = useState('text-slate-600 dark:text-slate-400');

  useEffect(() => {
    if (completedAt) {
      setTimeLeft('Completed');
      setUrgencyClass(
        isBreached 
          ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' 
          : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
      );
      return;
    }

    if (isPaused) {
      if (typeof remainingWorkingMinutes === 'number' && remainingWorkingMinutes > 0) {
        setTimeLeft(`Paused (${formatWorkingTime(remainingWorkingMinutes)})`);
      } else {
        setTimeLeft('Paused (Waiting on Customer)');
      }
      setUrgencyClass('text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60');
      return;
    }

    if (isBreached) {
      setTimeLeft('SLA Breached');
      setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold');
      return;
    }

    const calculate = () => {
      // 1. If backend provided exact remaining working minutes, prioritize it
      let activeWorkingMins = remainingWorkingMinutes;

      // 2. Otherwise calculate working minutes between now and dueDate
      if (typeof activeWorkingMins !== 'number') {
        if (!dueDate) {
          setTimeLeft('N/A');
          return;
        }
        const now = new Date();
        const target = new Date(dueDate);

        if (now >= target) {
          setTimeLeft('SLA Breached');
          setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold');
          return;
        }

        activeWorkingMins = calculateWorkingMinutesFrontend(now, target);
      }

      if (activeWorkingMins <= 0) {
        setTimeLeft('SLA Breached');
        setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold');
        return;
      }

      setTimeLeft(formatWorkingTime(activeWorkingMins));

      // Urgency styling based on working minutes left
      if (activeWorkingMins <= 60) {
        setUrgencyClass('text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 font-semibold animate-pulse');
      } else if (activeWorkingMins <= 270) {
        setUrgencyClass('text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900');
      } else {
        setUrgencyClass('text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900');
      }
    };

    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [dueDate, isBreached, isPaused, completedAt, remainingWorkingMinutes]);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${urgencyClass} transition-colors duration-200`}>
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

/**
 * Unified SLACounter Component
 * Supports both:
 * 1. `<SLACounter ticket={ticket} />` -> Renders both Reply & Resolve SLA badges
 * 2. `<SLACounter label="..." dueDate="..." ... />` -> Renders single SLA badge
 */
export default function SLACounter(props) {
  if (props.ticket) {
    const t = props.ticket;
    const isPaused = t.status === 'pending_customer';
    const slaInfo = t.sla_info;
    const directionClass = props.horizontal ? 'flex flex-wrap items-center gap-3' : 'flex flex-col gap-1 items-start';

    return (
      <div className={directionClass}>
        <SingleSLABadge
          label={props.compact ? "Reply" : "First Response"}
          dueDate={slaInfo?.reply?.due_at || t.first_response_due_at}
          isBreached={slaInfo?.reply?.is_breached || t.first_response_breached}
          isPaused={isPaused}
          completedAt={slaInfo?.reply?.completed_at || t.first_responded_at}
          remainingWorkingMinutes={slaInfo?.reply?.remaining_working_minutes}
        />
        <SingleSLABadge
          label={props.compact ? "Resolve" : "Resolution"}
          dueDate={slaInfo?.resolution?.due_at || t.resolution_due_at}
          isBreached={slaInfo?.resolution?.is_breached || t.resolution_breached}
          isPaused={isPaused}
          completedAt={slaInfo?.resolution?.completed_at || t.resolved_at}
          remainingWorkingMinutes={slaInfo?.resolution?.remaining_working_minutes}
        />
      </div>
    );
  }

  return <SingleSLABadge {...props} />;
}
