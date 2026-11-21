import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { api } from '../api';
import { 
  toIST, 
  formatISTDate, 
  advanceToNextWorkingDayStart 
} from './SLACounter';

function extractDateStr(val) {
  if (!val) return '';
  if (typeof val === 'string' && val.length >= 10) return val.slice(0, 10);
  try {
    return formatISTDate(new Date(val));
  } catch {
    return '';
  }
}

/**
 * Working Day Indicator Component
 * Displays current day and date in Asia/Kolkata (IST) timezone.
 * Explicitly does NOT display a live clock or current time.
 * Indicates Working Day, Weekend, or Festival Holiday.
 * If weekend or holiday, indicates the next working day and opening time (9:30 AM IST).
 */
export default function WorkingDayIndicator() {
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    let mounted = true;
    api.getHolidays()
      .then(data => {
        if (mounted && Array.isArray(data)) {
          setHolidays(data);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const now = new Date();
  const istNow = toIST(now);
  const holidaySet = new Set(
    holidays.map(h => extractDateStr(h.holiday_date)).filter(Boolean)
  );

  // 1. Day & Date in Asia/Kolkata (NO live clock / current time)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = dayNames[istNow.getUTCDay()];
  const dateNum = istNow.getUTCDate();
  const monthName = monthNames[istNow.getUTCMonth()];
  const year = istNow.getUTCFullYear();

  const fullDateDisplay = `${dayName}, ${dateNum} ${monthName} ${year}`;
  const mobileDateDisplay = `${dayName.slice(0, 3)}, ${dateNum} ${monthName}`;

  // 2. Status determination
  const dayOfWeek = istNow.getUTCDay(); // 0 is Sun, 6 is Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const todayStr = formatISTDate(now);
  const holidayMatch = holidays.find(h => extractDateStr(h.holiday_date) === todayStr);

  let statusText = 'Working Day';
  let badgeStyle = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  let dotStyle = 'bg-emerald-400';

  if (holidayMatch) {
    statusText = `Festival Holiday (${holidayMatch.description})`;
    badgeStyle = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    dotStyle = 'bg-rose-400';
  } else if (isWeekend) {
    statusText = 'Weekend';
    badgeStyle = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    dotStyle = 'bg-amber-400';
  }

  // 3. Next opening time calculation if weekend or holiday
  let nextOpeningText = '';
  if (isWeekend || holidayMatch) {
    const nextStart = advanceToNextWorkingDayStart(now, holidaySet);
    const nextIST = toIST(nextStart);
    const nextDayName = dayNames[nextIST.getUTCDay()];
    const nextDateNum = nextIST.getUTCDate();
    const nextMonthName = monthNames[nextIST.getUTCMonth()];
    nextOpeningText = `Next working day: ${nextDayName}, ${nextDateNum} ${nextMonthName} • 9:30 AM IST`;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 dark:bg-slate-800/90 border border-slate-700/80 text-xs shadow-xs transition">
      <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      
      {/* Day and Date formatted in IST */}
      <span className="font-semibold text-slate-100 hidden sm:inline">
        {fullDateDisplay}
      </span>
      <span className="font-semibold text-slate-100 sm:hidden">
        {mobileDateDisplay}
      </span>

      <span className="text-slate-600 hidden md:inline">•</span>

      {/* Working Day / Weekend / Festival Holiday badge */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium border text-[11px] ${badgeStyle}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`}></span>
        <span>{statusText}</span>
      </div>

      {/* Next working day opening information */}
      {nextOpeningText && (
        <span className="text-[11px] text-slate-400 font-normal hidden xl:inline">
          • {nextOpeningText}
        </span>
      )}
    </div>
  );
}
