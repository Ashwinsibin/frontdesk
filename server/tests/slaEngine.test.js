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
  checkReopenEligibility,
  WORK_END_MIN,
  WORK_START_MIN
} from '../src/services/slaEngine.js';

test('1. Urgent Resolution SLA: Ticket created at 10:00 AM on a working day has same-day 18:30 IST deadline', () => {
  // 2026-11-25 is a Wednesday
  const wed10am = makeISTDate('2026-11-25', 10 * 60); // 10:00 AM IST
  const holidays = new Set();

  const deadlines = calculateInitialSLADeadlines('urgent', wed10am, holidays);

  // First response: 2 working hours = 12:00 PM IST
  const istReply = toIST(deadlines.firstResponseDueAt);
  assert.equal(formatISTDate(deadlines.firstResponseDueAt), '2026-11-25');
  assert.equal(istReply.getUTCHours(), 12);
  assert.equal(istReply.getUTCMinutes(), 0);

  // Resolution: SAME DAY by 18:30:00 IST
  const istResolve = toIST(deadlines.resolutionDueAt);
  assert.equal(formatISTDate(deadlines.resolutionDueAt), '2026-11-25');
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
  assert.equal(istResolve.getUTCSeconds(), 0);
});

test('2. Urgent Resolution SLA: Ticket created outside working hours (Friday 19:30 IST) snaps to next working day 18:30 IST', () => {
  // 2026-11-27 is a Friday; 19:30 is 1 hour after COB
  const friNight = makeISTDate('2026-11-27', 19 * 60 + 30);
  const holidays = new Set();

  const deadlines = calculateInitialSLADeadlines('urgent', friNight, holidays);

  // Snapped to Monday 2026-11-30 09:30 AM IST
  assert.equal(formatISTDate(deadlines.effectiveStart), '2026-11-30');
  const istStart = toIST(deadlines.effectiveStart);
  assert.equal(istStart.getUTCHours(), 9);
  assert.equal(istStart.getUTCMinutes(), 30);

  // First response: 2 hours from Monday 09:30 -> Monday 11:30 AM IST
  const istReply = toIST(deadlines.firstResponseDueAt);
  assert.equal(formatISTDate(deadlines.firstResponseDueAt), '2026-11-30');
  assert.equal(istReply.getUTCHours(), 11);
  assert.equal(istReply.getUTCMinutes(), 30);

  // Resolution: Monday by 18:30:00 IST (Same working day of effective start)
  const istResolve = toIST(deadlines.resolutionDueAt);
  assert.equal(formatISTDate(deadlines.resolutionDueAt), '2026-11-30');
  assert.equal(istResolve.getUTCHours(), 18);
  assert.equal(istResolve.getUTCMinutes(), 30);
});

test('3. Weekend exclusion in SLA calculations', () => {
  // Friday 17:30 IST + 120 working minutes:
  // Friday has 60 minutes remaining (17:30 -> 18:30)
  // Remaining 60 minutes rollovers to Monday 09:30 -> Monday 10:30 IST
  const fri530pm = makeISTDate('2026-11-27', 17 * 60 + 30);
  const holidays = new Set();

  const deadline = addWorkingMinutes(fri530pm, 120, holidays);
  const ist = toIST(deadline);

  assert.equal(formatISTDate(deadline), '2026-11-30'); // Monday
  assert.equal(ist.getUTCHours(), 10);
  assert.equal(ist.getUTCMinutes(), 30);
});

test('4. Festival Holiday exclusion', () => {
  // Wednesday 2026-11-25 17:30 IST + 120 working minutes.
  // Thursday 2026-11-26 is registered as a festival holiday.
  // Friday 60 minutes remaining -> Friday 10:30 AM IST.
  const wed530pm = makeISTDate('2026-11-25', 17 * 60 + 30);
  const holidays = new Set(['2026-11-26']); // Thursday is Holiday

  const deadline = addWorkingMinutes(wed530pm, 120, holidays);
  const ist = toIST(deadline);

  assert.equal(formatISTDate(deadline), '2026-11-27'); // Friday
  assert.equal(ist.getUTCHours(), 10);
  assert.equal(ist.getUTCMinutes(), 30);
});

test('5. SLA Pausing: Pausing Friday 17:30 to Monday 10:30 IST only counts 120 working minutes', () => {
  const pauseTime = makeISTDate('2026-11-27', 17 * 60 + 30); // Friday 17:30 IST
  const resumeTime = makeISTDate('2026-11-30', 10 * 60 + 30); // Monday 10:30 IST
  const holidays = new Set();

  const workingMinutesPaused = calculateWorkingMinutes(pauseTime, resumeTime, holidays);
  // Friday: 17:30 - 18:30 = 60 min. Sat/Sun = 0 min. Monday: 09:30 - 10:30 = 60 min. Total = 120 min.
  assert.equal(workingMinutesPaused, 120);

  // Resume SLA shifts resolution deadline by exactly 120 working minutes
  const mockTicket = {
    first_response_due_at: makeISTDate('2026-11-30', 11 * 60),
    first_responded_at: null,
    resolution_due_at: makeISTDate('2026-11-30', 18 * 60 + 30),
    sla_paused_at: pauseTime,
    total_paused_working_minutes: 0
  };

  const resumed = resumePausedSLA(mockTicket, resumeTime, holidays);
  assert.equal(resumed.pausedWorkingMinutes, 120);
  assert.equal(resumed.totalPausedWorkingMinutes, 120);

  // Check shifted resolution deadline: was Monday 18:30 + 120 working minutes -> Tuesday 11:30 AM IST
  const istNewResolve = toIST(resumed.resolutionDueAt);
  assert.equal(formatISTDate(resumed.resolutionDueAt), '2026-12-01'); // Tuesday
  assert.equal(istNewResolve.getUTCHours(), 11);
  assert.equal(istNewResolve.getUTCMinutes(), 30);
});

test('6. Independent Priority Recalculation: Pending first response accounts for previous pauses', () => {
  // Ticket created Wednesday 09:30 AM (Medium: 270m reply).
  // Ticket was paused for 60 working minutes.
  // Now priority changed to Small (540m reply).
  const createdAt = makeISTDate('2026-11-25', 9 * 60 + 30);
  const now = makeISTDate('2026-11-25', 12 * 60);

  const mockTicket = {
    created_at: createdAt,
    status: 'open',
    priority: 'medium',
    first_responded_at: null, // First response pending
    first_response_due_at: makeISTDate('2026-11-25', 14 * 60),
    first_response_breached: false,
    resolution_due_at: makeISTDate('2026-11-30', 18 * 60 + 30),
    resolution_breached: false,
    total_paused_working_minutes: 60, // 60 minutes previously paused
    sla_paused_at: null
  };

  const result = recalculateSLAOnPriorityChange(mockTicket, 'small', now, new Set());

  // Small reply budget is 540 working minutes (9h).
  // Start (09:30) + 60m paused + 540m budget = 09:30 + 600 working minutes
  // Today 09:30 to 18:30 is 540 minutes.
  // Remaining 60 minutes rollovers to Thursday 09:30 -> Thursday 10:30 AM IST!
  const istReply = toIST(result.firstResponseDueAt);
  assert.equal(formatISTDate(result.firstResponseDueAt), '2026-11-26'); // Thursday
  assert.equal(istReply.getUTCHours(), 10);
  assert.equal(istReply.getUTCMinutes(), 30);
  assert.equal(result.firstResponseBreached, false);
});

test('7. Independent Priority Recalculation: First response already made is untouched', () => {
  const createdAt = makeISTDate('2026-11-25', 9 * 60 + 30);
  const respondedAt = makeISTDate('2026-11-25', 10 * 60 + 30);
  const originalReplyDue = makeISTDate('2026-11-25', 11 * 60 + 30);
  const now = makeISTDate('2026-11-25', 13 * 60);

  const mockTicket = {
    created_at: createdAt,
    status: 'open',
    priority: 'urgent',
    first_responded_at: respondedAt, // Response already made!
    first_response_due_at: originalReplyDue,
    first_response_breached: false,
    resolution_due_at: makeISTDate('2026-11-25', 18 * 60 + 30),
    resolution_breached: false,
    total_paused_working_minutes: 0,
    sla_paused_at: null
  };

  // Downgrade from Urgent to Medium
  const result = recalculateSLAOnPriorityChange(mockTicket, 'medium', now, new Set());

  // First response SLA must be 100% UNTOUCHED
  assert.equal(result.firstResponseDueAt.getTime(), originalReplyDue.getTime());
  assert.equal(result.firstResponseBreached, false);

  // Resolution SLA recalculated via Net-Remaining Budget:
  // Medium total resolution budget = 1620 min (3 days = 27h)
  // Consumed so far: 09:30 to 13:00 = 3.5h = 210 min
  // Remaining budget = 1620 - 210 = 1410 min.
  // Due date = Now (13:00) + 1410 min.
  assert.equal(result.resolutionBreached, false);
  assert(result.resolutionDueAt > now);
});

test('8. Reopening Eligibility: 7 calendar days boundary check', () => {
  const resolvedAt = new Date('2026-11-20T10:00:00.000Z');
  const mockTicket = {
    status: 'resolved',
    resolved_at: resolvedAt
  };

  // Day 6 (Within 7 calendar days) -> ALLOWED
  const day6 = new Date(resolvedAt.getTime() + 6 * 24 * 60 * 60 * 1000);
  const checkDay6 = checkReopenEligibility(mockTicket, day6);
  assert.equal(checkDay6.canReopen, true);

  // Day 8 (After 7 calendar days) -> REJECTED
  const day8 = new Date(resolvedAt.getTime() + 8 * 24 * 60 * 60 * 1000);
  const checkDay8 = checkReopenEligibility(mockTicket, day8);
  assert.equal(checkDay8.canReopen, false);
  assert.match(checkDay8.reason, /expired/i);
});
