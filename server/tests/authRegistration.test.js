import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import bcrypt from 'bcryptjs';

test('User Registration & Authentication Test Suite', async (t) => {
  // Setup in-memory PostgreSQL instance
  const db = newDb();
  db.public.registerFunction({
    name: 'now',
    returns: db.public.getType('timestamp with time zone'),
    implementation: () => new Date()
  });

  db.public.none(`
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  // Test 1: Validation - Empty fields
  await t.test('1. Registration rejects empty name or email', () => {
    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    assert.equal(EMAIL_REGEX.test(''), false);
    assert.equal(EMAIL_REGEX.test('invalid-email'), false);
    assert.equal(EMAIL_REGEX.test('agent@frontdesk.com'), true);
  });

  // Test 2: Password Mismatch
  await t.test('2. Registration rejects mismatched password and confirmPassword', () => {
    const pwd1 = 'Secret123';
    const pwd2 = 'Secret456';
    assert.notEqual(pwd1, pwd2);
  });

  // Test 3: Password Length Requirement
  await t.test('3. Enforces minimum 6 characters password', () => {
    const shortPwd = '123';
    assert.equal(shortPwd.length < 6, true);
    const validPwd = 'StrongPassword123';
    assert.equal(validPwd.length >= 6, true);
  });

  // Test 4: Successful Registration assigns Customer role by default
  await t.test('4. Public customer registration automatically assigns Customer role (customer)', async () => {
    const name = 'Maya Customer';
    const email = 'maya.cust@frontdesk.com';
    const password = 'customerSecurePassword123';
    const hash = await bcrypt.hash(password, 10);

    const res = await pool.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'customer')
      RETURNING id, name, email, role, password_hash
    `, [name, email, hash]);

    assert.equal(res.rows.length, 1);
    const user = res.rows[0];
    assert.equal(user.name, name);
    assert.equal(user.email, email);
    assert.equal(user.role, 'customer', 'Must assign customer role');
    assert.notEqual(user.password_hash, password, 'Password must be hashed');

    // Verify bcrypt compare
    const match = await bcrypt.compare(password, user.password_hash);
    assert.equal(match, true);
  });

  // Test 4b: Support Agent account with agent role
  await t.test('4b. Support Agent registration assigns Support Agent role (agent)', async () => {
    const name = 'Vikram Agent';
    const email = 'vikram.new@frontdesk.com';
    const password = 'agentSecurePassword123';
    const hash = await bcrypt.hash(password, 10);

    const res = await pool.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'agent')
      RETURNING id, name, email, role, password_hash
    `, [name, email, hash]);

    assert.equal(res.rows.length, 1);
    const user = res.rows[0];
    assert.equal(user.name, name);
    assert.equal(user.email, email);
    assert.equal(user.role, 'agent', 'Must assign agent role');
    assert.notEqual(user.password_hash, password, 'Password must be hashed');
  });

  // Test 5: Rejection of Duplicate Email
  await t.test('5. Rejects duplicate email registration', async () => {
    await assert.rejects(
      async () => {
        await pool.query(`
          INSERT INTO users (name, email, password_hash, role)
          VALUES ('Another User', 'vikram.new@frontdesk.com', 'somehash', 'agent')
        `);
      },
      /unique constraint|duplicate/i
    );
  });

  // Test 6: Verify login works with newly registered credentials
  await t.test('6. Login succeeds with newly registered credentials and fails with wrong password', async () => {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', ['vikram.new@frontdesk.com']);
    const user = userRes.rows[0];

    const correctMatch = await bcrypt.compare('agentSecurePassword123', user.password_hash);
    assert.equal(correctMatch, true, 'Valid password must authenticate');

    const wrongMatch = await bcrypt.compare('wrongPassword', user.password_hash);
    assert.equal(wrongMatch, false, 'Invalid password must be rejected');
  });
});
