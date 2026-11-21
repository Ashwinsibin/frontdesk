/**
 * FRONTDESK Core SLA & Business Hours Calculation Engine
 * 
 * Operating Rules:
 * - Timezone: Asia/Kolkata (IST: UTC+05:30)
 * - Working Days: Monday to Friday
 * - Working Hours: 09:30:00 to 18:30:00 IST (9.0 hours / 540 working minutes/day)
 * - Excluded: Nights (18:30 - 09:30), Weekends (Sat-Sun), and Festival Holidays
 * 
 * SLA Matrix:
 * - Urgent:
 *   - First Response: 2 working hours (120 minutes)
 *   - Resolution: Same working day by 18:30:00 IST (COB). If created outside working hours, snaps to next working day 18:30:00 IST.
 * - Medium:
 *   - First Response: 4.5 working hours (270 minutes)
 *   - Resolution: 3 working days (27 working hours / 1620 minutes)
 * - Small:
 *   - First Response: 9 working hours (540 minutes / 1 full working day)
 *   - Resolution: 1 working week (45 working hours / 2700 minutes)
 */

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // Exactly +05:30 (19,800,000 ms)
export const WORK_START_MIN = 9 * 60 + 30; // 09:30 AM = 570 minutes from midnight
export const WORK_END_MIN = 18 * 60 + 30;  // 06:30 PM = 1110 minutes from midnight
export const WORK_MINS_PER_DAY = WORK_END_MIN - WORK_START_MIN; // 540 minutes (9 hours)

export const SLA_MINUTES = {
  urgent: { reply: 120, resolveDays: 0 },
  medium: { reply: 270, resolveMinutes: 1620 }, // 3 working days = 27h
  small: { reply: 540, resolveMinutes: 2700 }   // 5 working days = 45h
};

export const AUTO_CLOSE_INACTIVITY_MINUTES = 2700; // 45 working hours (1 working week)
export const REOPEN_WINDOW_DAYS = 7; // 7 calendar days

/**
 * Returns a Date object shifted by +05:30 so that UTC methods (getUTCHours, getUTCDate, etc.)
 * directly reflect IST time fields deterministically on any host machine.
 */
export function toIST(date) {
  const d = new Date(date);
  return new Date(d.getTime() + IST_OFFSET_MS);
}

/**
 * Formats a Date to 'YYYY-MM-DD' in IST
 */
export function formatISTDate(date) {
  const ist = toIST(date);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Creates a real Date instance from an IST date string ('YYYY-MM-DD') and minute of day.
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {number} minuteOfDay minutes from 00:00 (e.g. 570 for 09:30)
 * @returns {Date}
 */
export function makeISTDate(dateStr, minuteOfDay) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const hours = Math.floor(minuteOfDay / 60);
  const mins = Math.floor(minuteOfDay % 60);
  const secs = Math.round((minuteOfDay % 1) * 60);
  const utcMs = Date.UTC(y, m - 1, d, hours, mins, secs) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Checks whether a given Date is a non-working day (weekend or holiday) in IST.
 * @param {Date} date 
 * @param {Set<string>} holidaySet Set of 'YYYY-MM-DD' strings
 * @returns {boolean}
 */
export function isNonWorkingDay(date, holidaySet = new Set()) {
  const ist = toIST(date);
  const dayOfWeek = ist.getUTCDay(); // 0 is Sunday, 6 is Saturday
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  
  const dateStr = formatISTDate(date);
  return holidaySet.has(dateStr);
}

/**
 * Advance to 09:30:00 IST on the next working day strictly after date's calendar day.
 */
function advanceToNextWorkingDayStart(date, holidaySet) {
  let probe = toIST(date);
  while (true) {
    // Add 1 calendar day to IST
    const nextDayUtc = Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate() + 1, 0, 0, 0);
    probe = new Date(nextDayUtc); // shifted IST representation of midnight of next day
    
    // Check if weekend or holiday
    const dayOfWeek = probe.getUTCDay();
    const dateStr = `${probe.getUTCFullYear()}-${String(probe.getUTCMonth() + 1).padStart(2, '0')}-${String(probe.getUTCDate()).padStart(2, '0')}`;
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
      return makeISTDate(dateStr, WORK_START_MIN);
    }
  }
}

/**
 * Snaps a date forward to 09:30:00 IST of the next working day if outside working hours,
 * weekend, or holiday.
 * @param {Date} date 
 * @param {Set<string>} holidaySet 
 * @returns {Date}
 */
export function snapToNextWorkingWindow(date, holidaySet = new Set()) {
  const ist = toIST(date);
  const curDateStr = formatISTDate(date);
  const curMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;

  // Weekend or holiday
  if (isNonWorkingDay(date, holidaySet)) {
    return advanceToNextWorkingDayStart(date, holidaySet);
  }

  // Before 09:30 IST today
  if (curMinutes < WORK_START_MIN) {
    return makeISTDate(curDateStr, WORK_START_MIN);
  }

  // After 18:30 IST today
  if (curMinutes >= WORK_END_MIN) {
    return advanceToNextWorkingDayStart(date, holidaySet);
  }

  // Inside working hours
  return new Date(date);
}

/**
 * Adds N working minutes to a start date, strictly respecting 09:30 - 18:30 IST,
 * skipping weekends and festival holidays.
 * @param {Date} startDate 
 * @param {number} minutesToAdd 
 * @param {Set<string>} holidaySet 
 * @returns {Date}
 */
export function addWorkingMinutes(startDate, minutesToAdd, holidaySet = new Set()) {
  if (minutesToAdd <= 0) return new Date(startDate);

  let current = snapToNextWorkingWindow(startDate, holidaySet);
  let remainingMinutes = minutesToAdd;

  while (remainingMinutes > 0) {
    const ist = toIST(current);
    const curDateStr = formatISTDate(current);
    const curMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes() + ist.getUTCSeconds() / 60;

    const availableToday = WORK_END_MIN - curMinutes;

    if (remainingMinutes <= availableToday) {
      return makeISTDate(curDateStr, curMinutes + remainingMinutes);
    }

    remainingMinutes -= availableToday;
    current = advanceToNextWorkingDayStart(current, holidaySet);
  }

  return current;
}

/**
 * Calculates total active working minutes elapsed between start and end.
 * @param {Date} start 
 * @param {Date} end 
 * @param {Set<string>} holidaySet 
 * @returns {number}
 */
export function calculateWorkingMinutes(start, end, holidaySet = new Set()) {
  const dStart = new Date(start);
  const dEnd = new Date(end);
  if (dEnd <= dStart) return 0;

  let current = snapToNextWorkingWindow(dStart, holidaySet);
  if (current >= dEnd) return 0;

  let totalMinutes = 0;

  while (current < dEnd) {
    const curDateStr = formatISTDate(current);
    const istCurrent = toIST(current);
    const curMin = istCurrent.getUTCHours() * 60 + istCurrent.getUTCMinutes() + istCurrent.getUTCSeconds() / 60;
    
    const dayEnd = makeISTDate(curDateStr, WORK_END_MIN);

    if (dEnd <= dayEnd) {
      const istEnd = toIST(dEnd);
      const endMin = Math.min(WORK_END_MIN, Math.max(WORK_START_MIN, istEnd.getUTCHours() * 60 + istEnd.getUTCMinutes() + istEnd.getUTCSeconds() / 60));
      totalMinutes += Math.max(0, endMin - curMin);
      break;
    } else {
      totalMinutes += Math.max(0, WORK_END_MIN - curMin);
      current = advanceToNextWorkingDayStart(current, holidaySet);
    }
  }

  return Math.round(totalMinutes);
}

/**
 * Calculates initial SLA deadlines for a newly created ticket.
 * @param {string} priority 'urgent' | 'medium' | 'small'
 * @param {Date} createdAt 
 * @param {Set<string>} holidaySet 
 * @returns {{ firstResponseDueAt: Date, resolutionDueAt: Date, effectiveStart: Date }}
 */
export function calculateInitialSLADeadlines(priority, createdAt, holidaySet = new Set()) {
  const effectiveStart = snapToNextWorkingWindow(createdAt, holidaySet);
  const effectiveDateStr = formatISTDate(effectiveStart);

  // 1. First Response SLA
  const replyMinutes = SLA_MINUTES[priority].reply;
  const firstResponseDueAt = addWorkingMinutes(effectiveStart, replyMinutes, holidaySet);

  // 2. Resolution SLA
  let resolutionDueAt;
  if (priority === 'urgent') {
    // URGENT POLICY: Same working day by 18:30:00 IST of effective start day
    resolutionDueAt = makeISTDate(effectiveDateStr, WORK_END_MIN);
  } else {
    const resolveMinutes = SLA_MINUTES[priority].resolveMinutes;
    resolutionDueAt = addWorkingMinutes(effectiveStart, resolveMinutes, holidaySet);
  }

  return {
    effectiveStart,
    firstResponseDueAt,
    resolutionDueAt
  };
}

/**
 * Recalculates SLA targets when an active ticket's priority is changed.
 * Strictly respects:
 * - If first response already happened: preserved and never modified.
 * - If first response is pending: recalculates budget accounting for previously accumulated total_paused_working_minutes.
 * - Resolution SLA: applies Net-Remaining Working Budget policy.
 * - Urgent resolution: Same-day 18:30 policy.
 * 
 * @param {Object} ticket
 * @param {string} newPriority
 * @param {Date} now
 * @param {Set<string>} holidaySet
 */
export function recalculateSLAOnPriorityChange(ticket, newPriority, now = new Date(), holidaySet = new Set()) {
  const effectiveStart = snapToNextWorkingWindow(ticket.created_at, holidaySet);
  const totalPausedMinutes = ticket.total_paused_working_minutes || 0;
  const isCurrentlyPaused = ticket.status === 'pending_customer';
  
  const referenceTime = isCurrentlyPaused && ticket.sla_paused_at ? new Date(ticket.sla_paused_at) : new Date(now);

  // 1. FIRST RESPONSE SLA
  let firstResponseDueAt = new Date(ticket.first_response_due_at);
  let firstResponseBreached = ticket.first_response_breached;

  if (!ticket.first_responded_at) {
    const newReplyBudget = SLA_MINUTES[newPriority].reply;
    const startWithPauses = addWorkingMinutes(effectiveStart, totalPausedMinutes, holidaySet);
    firstResponseDueAt = addWorkingMinutes(startWithPauses, newReplyBudget, holidaySet);

    if (!isCurrentlyPaused && firstResponseDueAt <= now) {
      firstResponseBreached = true;
    }
  }

  // 2. RESOLUTION SLA
  let resolutionDueAt;
  let resolutionBreached = ticket.resolution_breached;

  if (newPriority === 'urgent') {
    const effectiveDay = snapToNextWorkingWindow(referenceTime, holidaySet);
    const dayStr = formatISTDate(effectiveDay);
    resolutionDueAt = makeISTDate(dayStr, WORK_END_MIN);
    
    if (!isCurrentlyPaused && resolutionDueAt <= now) {
      resolutionBreached = true;
    }
  } else {
    const totalWorkingMinutesElapsed = calculateWorkingMinutes(effectiveStart, referenceTime, holidaySet);
    const activeWorkingMinutesConsumed = Math.max(0, totalWorkingMinutesElapsed - totalPausedMinutes);
    const newTotalLimit = SLA_MINUTES[newPriority].resolveMinutes;
    const remainingBudget = newTotalLimit - activeWorkingMinutesConsumed;

    if (remainingBudget <= 0) {
      resolutionBreached = true;
      resolutionDueAt = new Date(referenceTime);
    } else {
      resolutionDueAt = addWorkingMinutes(referenceTime, remainingBudget, holidaySet);
    }
  }

  return {
    firstResponseDueAt,
    firstResponseBreached,
    resolutionDueAt,
    resolutionBreached
  };
}

/**
 * Handles SLA resumption when a customer replies to a paused ticket.
 * @param {Object} ticket 
 * @param {Date} resumeTime 
 * @param {Set<string>} holidaySet 
 */
export function resumePausedSLA(ticket, resumeTime = new Date(), holidaySet = new Set()) {
  const pauseTime = new Date(ticket.sla_paused_at || ticket.waiting_customer_since || resumeTime);
  const pausedWorkingMinutes = calculateWorkingMinutes(pauseTime, resumeTime, holidaySet);

  const updatedTotalPaused = (ticket.total_paused_working_minutes || 0) + pausedWorkingMinutes;

  let updatedFirstResponseDue = new Date(ticket.first_response_due_at);
  if (!ticket.first_responded_at && pausedWorkingMinutes > 0) {
    updatedFirstResponseDue = addWorkingMinutes(ticket.first_response_due_at, pausedWorkingMinutes, holidaySet);
  }

  let updatedResolutionDue = new Date(ticket.resolution_due_at);
  if (pausedWorkingMinutes > 0) {
    updatedResolutionDue = addWorkingMinutes(ticket.resolution_due_at, pausedWorkingMinutes, holidaySet);
  }

  return {
    pausedWorkingMinutes,
    totalPausedWorkingMinutes: updatedTotalPaused,
    firstResponseDueAt: updatedFirstResponseDue,
    resolutionDueAt: updatedResolutionDue
  };
}

/**
 * Verifies if a resolved ticket can be reopened by the customer.
 * Strict 7-calendar-day window from resolved_at.
 * @param {Object} ticket 
 * @param {Date} now 
 * @returns {{ canReopen: boolean, reason?: string }}
 */
export function checkReopenEligibility(ticket, now = new Date()) {
  if (ticket.status !== 'resolved') {
    return { canReopen: false, reason: "Only resolved tickets can be reopened." };
  }
  
  if (!ticket.resolved_at) {
    return { canReopen: false, reason: "Ticket has no resolution timestamp." };
  }

  const resolvedAt = new Date(ticket.resolved_at);
  const deadline = new Date(resolvedAt.getTime() + REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  if (now > deadline) {
    return { 
      canReopen: false, 
      reason: "The 7-calendar-day reopening window has expired. Please create a new ticket." 
    };
  }

  return { canReopen: true, deadline };
}
