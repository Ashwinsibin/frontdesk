import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeISTDate,
  toIST,
  formatISTDate,
  snapToNextWorkingWindow,
  addWorkingMinutes,
  calculateWorkingMinutes,
  calculateInitialSLADeadlines,
  recalculateSLAOnPriorityChange,
  resumePausedSLA,
  getTicketSLAInfo,
  WORK_END_MIN,
  WORK_START_MIN
} from '../src/services/slaEngine.js';

// Calendar Helper: 2026-11-23 is Monday, 2026-11-27 is Friday, 2026-11-28 is Saturday, 2026-11-29 is Sunday, 2026-11-30 is Monday

test('Scenario 1: Ticket created Monday at 10 AM (Urgent, Medium, Small)', () => {
  const mon10am = makeISTDate('2026-11-23', 10 * 60); // Monday 10:00 AM IST
  const holidays = new Set();

  // A. URGENT (2 working hours reply, same working day resolution)
  const urgent = calculateInitialSLADeadlines('urgent', mon10am, holidays);
  const istUrgentReply = toIST(urgent.firstResponseDueAt);
  assert.equal(formatISTDate(urgent.firstResponseDueAt), '2026-11-23');
  assert.equal(istUrgentReply.getUTCHours(), 12);
  assert.equal(istUrgentReply.getUTCMinutes(), 0);

  const istUrgentResolve = toIST(urgent.resolutionDueAt);
  assert.equal(formatISTDate(urgent.resolutionDueAt), '2026-11-23');
  assert.equal(istUrgentResolve.getUTCHours(), 18);
  assert.equal(istUrgentResolve.getUTCMinutes(), 30);

  // B. MEDIUM (4.5 working hours reply, 27 working hours / 3 working days resolution)
  const medium = calculateInitialSLADeadlines('medium', mon10am, holidays);
  const istMediumReply = toIST(medium.firstResponseDueAt);
  assert.equal(formatISTDate(medium.firstResponseDueAt), '2026-11-23');
  assert.equal(istMediumReply.getUTCHours(), 14); // 10:00 + 4h30m = 14:30
  assert.equal(istMediumReply.getUTCMinutes(), 30);

  // Resolution: Mon 10:00 -> Thu 10:00 (Mon: 510m, Tue: 540m, Wed: 540m, Thu: 30m = 1620m / 27h)
  const istMediumResolve = toIST(medium.resolutionDueAt);
  assert.equal(formatISTDate(medium.resolutionDueAt), '2026-11-26'); // Thursday
  assert.equal(istMediumResolve.getUTCHours(), 10);
  assert.equal(istMediumResolve.getUTCMinutes(), 0);

  // C. SMALL (9 working hours / 1 day reply, 45 working hours / 1 week resolution)
  const small = calculateInitialSLADeadlines('small', mon10am, holidays);
  const istSmallReply = toIST(small.firstResponseDueAt);
  assert.equal(formatISTDate(small.firstResponseDueAt), '2026-11-24'); // Tuesday
  assert.equal(istSmallReply.getUTCHours(), 10);
  assert.equal(istSmallReply.getUTCMinutes(), 0);

  // Resolution: Exactly 1 working week later -> Next Monday 10:00 AM
  const istSmallResolve = toIST(small.resolutionDueAt);
  assert.equal(formatISTDate(small.resolutionDueAt), '2026-11-30'); // Next Monday
  assert.equal(istSmallResolve.getUTCHours(), 10);
  assert.equal(istSmallResolve.getUTCMinutes(), 0);
});

test('Scenario 2: Ticket created Friday at 6 PM (Urgent reply rolls to Monday, resolution same working day)', () => {
  // 2026-11-27 is Friday; 18:00 IST leaves only 30 working minutes before 18:30 COB
  const fri6pm = makeISTDate('2026-11-27', 18 * 60);
  const holidays = new Set();

  const urgent = calculateInitialSLADeadlines('urgent', fri6pm, holidays);

  // First response budget: 120 minutes.
  // 30 min on Friday (18:00 - 18:30) + 90 min on Monday morning (09:30 - 11:00)
  // Due: Monday 2026-11-30 at 11:00 AM IST
  const istReply = toIST(urgent.firstResponseDueAt);
  assert.equal(formatISTDate(urgent.firstResponseDueAt), '2026-11-30');
  assert.equal(istReply.getUTCHours(), 11);
  assert.equal(istReply.getUTCMinutes(), 0);

  // Resolution: Must be SAME WORKING DAY as the active ticket work (Monday 18:30 IST)
  // CRITICAL FIX: Must NEVER be Friday 18:30 IST (which was earlier than the reply deadline)
  const istResolve = toIST(urgent.resolutionDueAt);
  assert.equal(formatISTDate(urgent.resolutionDueAt), '2026-11-30');
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);

  // Ensure resolution due date is strictly after or equal to first response due date
  assert(urgent.resolutionDueAt >= urgent.firstResponseDueAt, 'Resolution deadline must not be before first response deadline');
});

test('Scenario 3: Ticket created after working hours (Friday 19:30 IST snaps to Monday 09:30)', () => {
  const fri730pm = makeISTDate('2026-11-27', 19 * 60 + 30);
  const holidays = new Set();

  const urgent = calculateInitialSLADeadlines('urgent', fri730pm, holidays);

  // Snaps to Monday 2026-11-30 09:30 AM IST
  assert.equal(formatISTDate(urgent.effectiveStart), '2026-11-30');
  const istStart = toIST(urgent.effectiveStart);
  assert.equal(istStart.getUTCHours(), 9);
  assert.equal(istStart.getUTCMinutes(), 30);

  // First response: 2 hours -> Monday 11:30 AM IST
  const istReply = toIST(urgent.firstResponseDueAt);
  assert.equal(formatISTDate(urgent.firstResponseDueAt), '2026-11-30');
  assert.equal(istReply.getUTCHours(), 11);
  assert.equal(istReply.getUTCMinutes(), 30);

  // Resolution: Monday 18:30 IST
  const istResolve = toIST(urgent.resolutionDueAt);
  assert.equal(formatISTDate(urgent.resolutionDueAt), '2026-11-30');
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
});

test('Scenario 4: Ticket created during weekends (Saturday & Sunday snap to Monday 09:30)', () => {
  const satAfternoon = makeISTDate('2026-11-28', 14 * 60); // Saturday 2:00 PM IST
  const sunMorning = makeISTDate('2026-11-29', 10 * 60);   // Sunday 10:00 AM IST
  const holidays = new Set();

  const urgentSat = calculateInitialSLADeadlines('urgent', satAfternoon, holidays);
  const urgentSun = calculateInitialSLADeadlines('urgent', sunMorning, holidays);

  for (const res of [urgentSat, urgentSun]) {
    assert.equal(formatISTDate(res.effectiveStart), '2026-11-30');
    assert.equal(toIST(res.effectiveStart).getUTCHours(), 9);
    assert.equal(toIST(res.effectiveStart).getUTCMinutes(), 30);

    assert.equal(formatISTDate(res.firstResponseDueAt), '2026-11-30');
    assert.equal(toIST(res.firstResponseDueAt).getUTCHours(), 11);
    assert.equal(toIST(res.firstResponseDueAt).getUTCMinutes(), 30);

    assert.equal(formatISTDate(res.resolutionDueAt), '2026-11-30');
    assert.equal(toIST(res.resolutionDueAt).getUTCHours(), 18);
    assert.equal(toIST(res.resolutionDueAt).getUTCMinutes(), 30);
  }
});

test('Scenario 5: Ticket created before a festival holiday', () => {
  // Monday 2026-11-23 at 17:00 IST (5:00 PM). Tuesday 2026-11-24 is a festival holiday.
  const mon5pm = makeISTDate('2026-11-23', 17 * 60);
  const holidays = new Set(['2026-11-24']); // Tuesday is holiday

  const urgent = calculateInitialSLADeadlines('urgent', mon5pm, holidays);

  // Monday has 90 min (17:00 to 18:30).
  // Remaining 30 min skips Tuesday holiday and lands on Wednesday 09:30 + 30m = Wednesday 10:00 AM IST!
  const istReply = toIST(urgent.firstResponseDueAt);
  assert.equal(formatISTDate(urgent.firstResponseDueAt), '2026-11-25'); // Wednesday
  assert.equal(istReply.getUTCHours(), 10);
  assert.equal(istReply.getUTCMinutes(), 0);

  // Resolution: Wednesday 18:30 IST
  const istResolve = toIST(urgent.resolutionDueAt);
  assert.equal(formatISTDate(urgent.resolutionDueAt), '2026-11-25'); // Wednesday
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
});

test('Scenario 6: Ticket waiting for customer response (paused in pending_customer)', () => {
  const createdAt = makeISTDate('2026-11-23', 10 * 60); // Monday 10:00 AM
  const pauseTime = makeISTDate('2026-11-23', 11 * 60); // Paused Monday 11:00 AM
  const now = makeISTDate('2026-11-25', 14 * 60);       // Wednesday 2:00 PM (2 days later)

  const ticket = {
    created_at: createdAt,
    status: 'pending_customer',
    priority: 'urgent',
    first_response_due_at: makeISTDate('2026-11-23', 12 * 60), // Monday 12:00
    first_responded_at: pauseTime,
    first_response_breached: false,
    resolution_due_at: makeISTDate('2026-11-23', 18 * 60 + 30), // Monday 18:30
    resolution_breached: false,
    sla_paused_at: pauseTime,
    total_paused_working_minutes: 0
  };

  const slaInfo = getTicketSLAInfo(ticket, now, new Set());

  // Ticket must be flagged as paused, NOT overdue, even though now (Wednesday) > resolution_due_at (Monday)
  assert.equal(slaInfo.is_paused, true);
  assert.equal(slaInfo.is_overdue, false);
  assert.equal(slaInfo.resolution.is_breached, false);

  // Remaining budget at pause time was Monday 11:00 to Monday 18:30 = 7.5 hours = 450 working minutes
  assert.equal(slaInfo.resolution.remaining_working_minutes, 450);
});

test('Scenario 7: Customer responds after several working days (shifts deadlines by exact working minutes)', () => {
  const pauseTime = makeISTDate('2026-11-23', 11 * 60);  // Monday 11:00 AM
  const resumeTime = makeISTDate('2026-11-26', 11 * 60); // Thursday 11:00 AM (3 full working days later)
  const holidays = new Set();

  const workingMins = calculateWorkingMinutes(pauseTime, resumeTime, holidays);
  // Exactly 3 working days = 3 * 540 = 1620 working minutes. Nights are 100% excluded!
  assert.equal(workingMins, 1620);

  const mockTicket = {
    first_response_due_at: makeISTDate('2026-11-23', 12 * 60),
    first_responded_at: pauseTime,
    resolution_due_at: makeISTDate('2026-11-23', 18 * 60 + 30),
    sla_paused_at: pauseTime,
    total_paused_working_minutes: 0
  };

  const resumed = resumePausedSLA(mockTicket, resumeTime, holidays);
  assert.equal(resumed.pausedWorkingMinutes, 1620);
  assert.equal(resumed.totalPausedWorkingMinutes, 1620);

  // Original resolution due was Monday 18:30. Shifted by 3 working days -> Thursday 18:30!
  const istResolve = toIST(resumed.resolutionDueAt);
  assert.equal(formatISTDate(resumed.resolutionDueAt), '2026-11-26'); // Thursday
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
});

test('Scenario 8: Mid-ticket priority change (Net-Remaining Working Budget)', () => {
  // Ticket created Monday 09:30 AM as Medium (1620 min resolution = 3 working days).
  // At Monday 12:30 PM (3 working hours / 180 min consumed), priority escalated to Urgent.
  const createdAt = makeISTDate('2026-11-23', 9 * 60 + 30);
  const respondedAt = makeISTDate('2026-11-23', 11 * 60); // Responded at 11:00 AM
  const escalateTime = makeISTDate('2026-11-23', 12 * 60 + 30);

  const mockTicket = {
    created_at: createdAt,
    status: 'open',
    priority: 'medium',
    first_responded_at: respondedAt,
    first_response_due_at: makeISTDate('2026-11-23', 14 * 60),
    first_response_breached: false,
    resolution_due_at: makeISTDate('2026-11-26', 9 * 60 + 30),
    resolution_breached: false,
    total_paused_working_minutes: 0,
    sla_paused_at: null
  };

  const result = recalculateSLAOnPriorityChange(mockTicket, 'urgent', escalateTime, new Set());

  // First response already completed -> preserved
  assert.equal(result.firstResponseDueAt.getTime(), mockTicket.first_response_due_at.getTime());
  assert.equal(result.firstResponseBreached, false);

  // Urgent resolution -> Same working day by 18:30 IST of reference day (Monday)
  const istResolve = toIST(result.resolutionDueAt);
  assert.equal(formatISTDate(result.resolutionDueAt), '2026-11-23');
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
  assert.equal(result.resolutionBreached, false);
});

test('Scenario 9: Timer never counts non-working hours, weekends or holidays', () => {
  const friCOB = makeISTDate('2026-11-27', 18 * 60 + 30); // Friday 18:30 (COB)
  const sat2pm = makeISTDate('2026-11-28', 14 * 60);       // Saturday 14:00
  const sun3pm = makeISTDate('2026-11-29', 15 * 60);       // Sunday 15:00
  const monStart = makeISTDate('2026-11-30', 9 * 60 + 30); // Monday 09:30
  const targetDeadline = makeISTDate('2026-11-30', 11 * 60); // Monday 11:00 AM (90 working minutes)

  const holidays = new Set();

  // Working minutes between Friday COB and Monday 11:00 AM:
  // Friday 18:30 to Monday 09:30 has 0 working minutes.
  // Monday 09:30 to 11:00 has exactly 90 working minutes.
  const minsFromFri = calculateWorkingMinutes(friCOB, targetDeadline, holidays);
  const minsFromSat = calculateWorkingMinutes(sat2pm, targetDeadline, holidays);
  const minsFromSun = calculateWorkingMinutes(sun3pm, targetDeadline, holidays);
  const minsFromMon = calculateWorkingMinutes(monStart, targetDeadline, holidays);

  assert.equal(minsFromFri, 90, 'Friday COB must show exactly 90 working minutes left');
  assert.equal(minsFromSat, 90, 'Saturday must NOT decrease working minutes budget (still 90 min)');
  assert.equal(minsFromSun, 90, 'Sunday must NOT decrease working minutes budget (still 90 min)');
  assert.equal(minsFromMon, 90, 'Monday 09:30 must show exactly 90 working minutes left');

  // Verify getTicketSLAInfo during the weekend:
  const activeTicket = {
    created_at: makeISTDate('2026-11-27', 18 * 60),
    status: 'open',
    priority: 'urgent',
    first_response_due_at: targetDeadline,
    first_responded_at: null,
    first_response_breached: false,
    resolution_due_at: makeISTDate('2026-11-30', 18 * 60 + 30),
    resolution_breached: false,
    sla_paused_at: null,
    total_paused_working_minutes: 0
  };

  const saturdaySLA = getTicketSLAInfo(activeTicket, sat2pm, holidays);
  assert.equal(saturdaySLA.reply.remaining_working_minutes, 90);
  assert.equal(saturdaySLA.is_overdue, false, 'Ticket must NOT be marked overdue on Saturday');
  assert.equal(saturdaySLA.reply.is_breached, false);

  const sundaySLA = getTicketSLAInfo(activeTicket, sun3pm, holidays);
  assert.equal(sundaySLA.reply.remaining_working_minutes, 90);
  assert.equal(sundaySLA.is_overdue, false, 'Ticket must NOT be marked overdue on Sunday');
  assert.equal(sundaySLA.reply.is_breached, false);
});
