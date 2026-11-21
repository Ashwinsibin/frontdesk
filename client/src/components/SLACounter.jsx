import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, PauseCircle, Moon } from 'lucide-react';

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const WORK_START_MIN = 9 * 60 + 30; // 09:30 AM = 570 mins
export const WORK_END_MIN = 18 * 60 + 30;  // 06:30 PM = 1110 mins

export function toIST(date) {
  const d = new Date(date);
  return new Date(d.getTime() + IST_OFFSET_MS);
}

export function formatISTDate(date) {
  const ist = toIST(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function makeISTDate(dateStr, minuteOfDay) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const hours = Math.floor(minuteOfDay / 60);
  const mins = Math.floor(minuteOfDay % 60);
  const secs = Math.round((minuteOfDay % 1) * 60);
  const utcMs = Date.UTC(y, m - 1, d, hours, mins, secs) - IST_OFFSET_MS;
  return new Date(utcMs);
}

export function isNonWorkingDay(date, holidaySet) {
  const ist = toIST(date);
  const dayOfWeek = ist.getUTCDay(); // 0 is Sun, 6 is Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  if (!holidaySet) return false;
  const dateStr = formatISTDate(date);
  return holidaySet instanceof Set ? holidaySet.has(dateStr) : Array.isArray(holidaySet) ? holidaySet.includes(dateStr) : false;
}

export function advanceToNextWorkingDayStart(date, holidaySet) {
  let probe = toIST(date);
  while (true) {
    const nextDayUtc = Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate() + 1, 0, 0, 0);
    probe = new Date(nextDayUtc);
    const dayOfWeek = probe.getUTCDay();
    const dateStr = `${probe.getUTCFullYear()}-${String(probe.getUTCMonth() + 1).padStart(2, '0')}-${String(probe.getUTCDate()).padStart(2, '0')}`;
    const isHoliday = holidaySet instanceof Set ? holidaySet.has(dateStr) : Array.isArray(holidaySet) ? holidaySet.includes(dateStr) : false;
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
      return makeISTDate(dateStr, WORK_START_MIN);
    }
  }
}

export function snapToNextWorkingWindow(date, holidaySet) {
  const ist = toIST(date);
  const curDateStr = formatISTDate(date);
  const curMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;

  if (isNonWorkingDay(date, holidaySet)) {
    return advanceToNextWorkingDayStart(date, holidaySet);
  }

  if (curMinutes < WORK_START_MIN) {
    return makeISTDate(curDateStr, WORK_START_MIN);
  }

  if (curMinutes >= WORK_END_MIN) {
    return advanceToNextWorkingDayStart(date, holidaySet);
  }

  return new Date(date);
}

/**
 * Checks whether a given timestamp falls strictly within Monday–Friday 09:30 to 18:30 IST
 * and is not a festival holiday.
 */
export function isWithinWorkingHours(date, holidaySet) {
  if (isNonWorkingDay(date, holidaySet)) return false;
  const ist = toIST(date);
  const curMin = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;
  return curMin >= WORK_START_MIN && curMin < WORK_END_MIN;
}

/**
 * Formats the next opening/resumption time when currently outside working hours.
 */
export function formatNextWorkingTime(date, holidaySet) {
  const nextStart = advanceToNextWorkingDayStart(date, holidaySet);
  const istDate = toIST(date);
  const istNext = toIST(nextStart);

  // If today before 09:30 IST on a normal working day
  if (!isNonWorkingDay(date, holidaySet)) {
    const curMin = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
    if (curMin < WORK_START_MIN) {
      return 'Today at 9:30 AM IST';
    }
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[istNext.getUTCDay()]}, ${istNext.getUTCDate()} ${monthNames[istNext.getUTCMonth()]} at 9:30 AM IST`;
}

/**
 * Calculates remaining active working seconds between start and end,
 * strictly excluding weekends, hours outside 09:30 - 18:30 IST, and holidays.
 */
export function calculateWorkingSecondsFrontend(start, end, holidaySet) {
  const dStart = new Date(start);
  const dEnd = new Date(end);
  if (dEnd <= dStart) return 0;

  let current = snapToNextWorkingWindow(dStart, holidaySet);
  if (current >= dEnd) return 0;

  let totalSeconds = 0;

  while (current < dEnd) {
    const curDateStr = formatISTDate(current);
    const dayEnd = makeISTDate(curDateStr, WORK_END_MIN);

    if (dEnd <= dayEnd) {
      totalSeconds += Math.max(0, (dEnd.getTime() - current.getTime()) / 1000);
      break;
    } else {
      totalSeconds += Math.max(0, (dayEnd.getTime() - current.getTime()) / 1000);
      current = advanceToNextWorkingDayStart(current, holidaySet);
    }
  }

  return Math.max(0, Math.round(totalSeconds));
}

/**
 * Calculates remaining active working minutes.
 */
export function calculateWorkingMinutesFrontend(start, end, holidaySet) {
  return Math.round(calculateWorkingSecondsFrontend(start, end, holidaySet) / 60);
}

/**
 * Formats working seconds into clean, human-readable display strings.
 * 1 working day = 9 working hours = 540 working minutes = 32,400 working seconds.
 */
export function formatWorkingSeconds(workingSeconds, compact = false) {
  if (workingSeconds <= 0) return '0s left';
  const totalMins = Math.floor(workingSeconds / 60);
  const secs = workingSeconds % 60;
  
  const days = Math.floor(totalMins / 540);
  const remMins = totalMins % 540;
  const hours = Math.floor(remMins / 60);
  const mins = remMins % 60;

  if (compact) {
    if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m ${secs}s left`;
  }

  // Non-compact (TicketDetailModal):
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m ${secs}s left`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s left`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s left`;
  }
  return `${secs}s left`;
}

/**
 * Backward compatibility helper for working minutes
 */
export function formatWorkingTime(workingMins, compact = false) {
  return formatWorkingSeconds(Math.round(workingMins * 60), compact);
}

/**
 * Single SLA Counter Badge with Live Auto-Updating Countdown & Working Hours Awareness
 */
export function SingleSLABadge({ 
  label, 
  dueDate, 
  isBreached, 
  isPaused, 
  completedAt, 
  remainingWorkingMinutes,
  holidays = [],
  serverTime = null,
  compact = false
}) {
  const [timeLeft, setTimeLeft] = useState('');
  const [timerState, setTimerState] = useState('Running'); // 'Running' | 'Paused' | 'Overdue' | 'Completed' | 'Outside Business Hours'
  const [nextResumesText, setNextResumesText] = useState('');
  const [urgencyClass, setUrgencyClass] = useState('text-slate-600 dark:text-slate-400');

  useEffect(() => {
    // 1. Completed state
    if (completedAt) {
      setTimeLeft('Completed');
      setTimerState('Completed');
      setUrgencyClass(
        isBreached 
          ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' 
          : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60'
      );
      return;
    }

    // 2. Paused state (e.g. pending_customer)
    if (isPaused) {
      setTimerState('Paused');
      if (typeof remainingWorkingMinutes === 'number' && remainingWorkingMinutes > 0) {
        setTimeLeft(`Paused (${formatWorkingTime(remainingWorkingMinutes, true)})`);
      } else {
        setTimeLeft('Paused (Waiting on Customer)');
      }
      setUrgencyClass('text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 font-medium');
      return;
    }

    // 3. Explicitly breached
    if (isBreached) {
      setTimeLeft('SLA Breached');
      setTimerState('Overdue');
      setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold');
      return;
    }

    // 4. Missing dueDate
    if (!dueDate) {
      if (typeof remainingWorkingMinutes === 'number' && remainingWorkingMinutes > 0) {
        setTimeLeft(formatWorkingTime(remainingWorkingMinutes, compact));
      } else {
        setTimeLeft('N/A');
      }
      setTimerState('N/A');
      setUrgencyClass('text-slate-600 dark:text-slate-400');
      return;
    }

    const holidaySet = new Set(Array.isArray(holidays) ? holidays : []);
    const clockOffset = serverTime ? (Date.now() - new Date(serverTime).getTime()) : 0;
    const target = new Date(dueDate);

    const calculate = () => {
      const now = new Date(Date.now() - clockOffset);

      if (now >= target) {
        setTimeLeft('SLA Breached');
        setTimerState('Overdue');
        setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold animate-pulse');
        return;
      }

      const workingSecs = calculateWorkingSecondsFrontend(now, target, holidaySet);

      if (workingSecs <= 0) {
        setTimeLeft('SLA Breached');
        setTimerState('Overdue');
        setUrgencyClass('text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 font-bold animate-pulse');
        return;
      }

      const inWorkWindow = isWithinWorkingHours(now, holidaySet);

      if (inWorkWindow) {
        setTimerState('Running');
        setTimeLeft(formatWorkingSeconds(workingSecs, compact));
      } else {
        setTimerState('Outside Business Hours');
        const resumes = formatNextWorkingTime(now, holidaySet);
        setNextResumesText(resumes);
        setTimeLeft(formatWorkingSeconds(workingSecs, compact));
      }

      const workingMins = workingSecs / 60;
      if (!inWorkWindow) {
        setUrgencyClass('text-slate-700 dark:text-slate-300 bg-slate-100/90 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700');
      } else if (workingMins <= 60) {
        setUrgencyClass('text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 font-semibold animate-pulse');
      } else if (workingMins <= 270) {
        setUrgencyClass('text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 font-medium');
      } else {
        setUrgencyClass('text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900');
      }
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [dueDate, isBreached, isPaused, completedAt, remainingWorkingMinutes, holidays, serverTime, compact]);

  const isOverdueState = isBreached || timerState === 'Overdue' || timeLeft === 'SLA Breached';

  // Status chip badge helper
  const renderStatusChip = () => {
    switch (timerState) {
      case 'Completed':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Completed
          </span>
        );
      case 'Paused':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Paused
          </span>
        );
      case 'Overdue':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
            Overdue
          </span>
        );
      case 'Running':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Running
          </span>
        );
      case 'Outside Business Hours':
        return (
          <span 
            className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
            title={`Resumes ${nextResumesText}`}
          >
            {compact ? 'Off-Hours' : `Resumes ${nextResumesText.split(' at ')[0]}`}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${urgencyClass} transition-colors duration-200`}>
      {completedAt ? (
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : isPaused ? (
        <PauseCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      ) : isOverdueState ? (
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
      ) : timerState === 'Outside Business Hours' ? (
        <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      ) : (
        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
      )}
      <span className="font-medium">{label}:</span>
      <span className="font-mono font-semibold">{timeLeft}</span>
      {renderStatusChip()}
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
    const holidays = slaInfo?.holidays || t.holidays || [];
    const serverTime = props.simulatedServerTime || slaInfo?.server_time;

    return (
      <div className={directionClass}>
        <SingleSLABadge
          label={props.compact ? "Reply" : "First Response"}
          dueDate={slaInfo?.reply?.due_at || t.first_response_due_at}
          isBreached={slaInfo?.reply?.is_breached || t.first_response_breached}
          isPaused={isPaused}
          completedAt={slaInfo?.reply?.completed_at || t.first_responded_at}
          remainingWorkingMinutes={slaInfo?.reply?.remaining_working_minutes}
          holidays={holidays}
          serverTime={serverTime}
          compact={props.compact}
        />
        <SingleSLABadge
          label={props.compact ? "Resolve" : "Resolution"}
          dueDate={slaInfo?.resolution?.due_at || t.resolution_due_at}
          isBreached={slaInfo?.resolution?.is_breached || t.resolution_breached}
          isPaused={isPaused}
          completedAt={slaInfo?.resolution?.completed_at || t.resolved_at}
          remainingWorkingMinutes={slaInfo?.resolution?.remaining_working_minutes}
          holidays={holidays}
          serverTime={serverTime}
          compact={props.compact}
        />
      </div>
    );
  }

  return <SingleSLABadge {...props} />;
}
