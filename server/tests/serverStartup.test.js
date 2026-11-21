import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePort } from '../src/server.js';

test('1. resolvePort correctly parses valid integer ports', () => {
  assert.equal(resolvePort(10000), 10000);
  assert.equal(resolvePort('10000'), 10000);
  assert.equal(resolvePort('5000'), 5000);
  assert.equal(resolvePort(' 8080 '), 8080);
  assert.equal(resolvePort(3000), 3000);
});

test('2. resolvePort safely falls back to 5000 on missing or empty values', () => {
  assert.equal(resolvePort(undefined), 5000);
  assert.equal(resolvePort(null), 5000);
  assert.equal(resolvePort(''), 5000);
  assert.equal(resolvePort('   '), 5000);
});

test('3. resolvePort prevents RangeError (NaN) on invalid or non-numeric strings', () => {
  assert.equal(resolvePort('undefined'), 5000);
  assert.equal(resolvePort('null'), 5000);
  assert.equal(resolvePort('NaN'), 5000);
  assert.equal(resolvePort(NaN), 5000);
  assert.equal(resolvePort('abc'), 5000);
  assert.equal(resolvePort('$PORT'), 5000);
  assert.equal(resolvePort('PORT'), 5000);
});

test('4. resolvePort prevents RangeError on out-of-range ports (< 1 or >= 65536)', () => {
  assert.equal(resolvePort(-1), 5000);
  assert.equal(resolvePort('-5000'), 5000);
  assert.equal(resolvePort(0), 5000);
  assert.equal(resolvePort('0'), 5000);
  assert.equal(resolvePort(65536), 5000);
  assert.equal(resolvePort('70000'), 5000);
  assert.equal(resolvePort('99999'), 5000);
});
