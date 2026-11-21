import { sweepDueAutoCloseTickets } from '../services/sweeperService.js';

let lastSweepTime = 0;
const JIT_THROTTLE_MS = 60 * 1000; // Run JIT at most once every 60 seconds

/**
 * JIT Sweeper Middleware: Ensures tickets waiting > 45 working hours are closed
 * before serving ticket listing or detailed views, even if server was sleeping.
 */
export async function jitSweeperMiddleware(req, res, next) {
  try {
    const now = Date.now();
    if (now - lastSweepTime > JIT_THROTTLE_MS) {
      lastSweepTime = now;
      // Run sweep asynchronously or synchronously
      await sweepDueAutoCloseTickets();
    }
  } catch (err) {
    console.error('JIT sweeper error:', err.message);
  }
  next();
}
