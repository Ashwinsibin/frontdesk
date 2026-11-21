# FRONTDESK — Customer Support Ticket Management System

**FRONTDESK** is an enterprise-grade full-stack customer support ticket management system built for **iNav Technologies** Full Stack Developer Machine Test. It is tailored for a team of 9 support agents handling ~40 customer problems daily.

---

## 🚀 Key Architectural & Business Features

1. **3 Ticket Priorities & Strict Business-Hour SLAs**:
   - **🔴 Urgent**: First reply within 2 working hours. Resolution **by 18:30:00 IST on the same working day** received (Close of Business). If received outside working hours/weekends/holidays, snaps to 18:30:00 IST on the next working day.
   - **🟡 Medium**: First reply within half a working day (4.5h / 270m). Resolution in ~3 working days (27 working hours / 1,620m).
   - **🔵 Small**: First reply within 1 working day (9h / 540m). Resolution in ~1 working week (45 working hours / 2,700m).
2. **Business Calendar Engine (Asia/Kolkata IST)**:
   - Schedule: Monday to Friday, **09:30 AM to 06:30 PM IST** (9 working hours/day).
   - Strict exclusions: Non-working hours (18:30–09:30), weekends (Sat–Sun), and festival holidays from `holidays` table.
3. **Working-Minutes-Only SLA Pausing**:
   - Timers pause in `pending_customer` status.
   - When customer replies, paused duration is calculated **strictly in working minutes** (e.g., pausing Friday 17:30 to Monday 10:30 counts exactly 120 working minutes, skipping nights and weekends).
4. **Independent Priority Recalculation**:
   - Completed first responses are preserved and never recalculated.
   - Active resolution timers apply the **Net-Remaining Working Budget** policy, accounting for accumulated paused working time.
5. **Atomic Single-Agent Claiming**:
   - Concurrency protection: `UPDATE tickets ... WHERE id = $id AND assigned_agent_id IS NULL RETURNING *`. Prevents double-assignment; simultaneous claims return `HTTP 409 Conflict`.
6. **Strict Private Note Isolation**:
   - Dual-tab agent composer: **Public Reply** (Green, customer visible) vs. **Internal Note** (Yellow, private).
   - Private notes are protected at both database and serialization layers; customers can never see internal notes.
7. **Append-Only Audit History**:
   - `ticket_audit_logs` protected by a PostgreSQL trigger raising `ERRCODE 28000` on any `UPDATE` or `DELETE`.
   - `ON DELETE RESTRICT` foreign key prevents deleting tickets that have audit entries.
8. **Cold-Start Resilient Auto-Close**:
   - Automatically closes tickets waiting for customer responses $> 45$ working hours.
   - Executes on server boot, Just-In-Time (JIT) before ticket queries, and via 5-minute interval.
9. **7-Calendar-Day Reopening Window**:
   - Reopening resolved tickets is enforced within 7 calendar days (`resolved_at + INTERVAL '7 days'`). After 7 days, reopening is rejected.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Date-Fns
- **Backend**: Node.js, Express, `pg` (node-postgres), JWT, bcryptjs
- **Database**: PostgreSQL (Neon Hosted Serverless PostgreSQL)
- **Timezone**: `Asia/Kolkata` (IST, UTC+05:30)

---

## 🏃 Getting Started

### 1. Configure Database Connection
Copy `.env.example` to `server/.env` and add your Neon PostgreSQL connection string:
```bash
# In server/.env:
DATABASE_URL=postgresql://<user>:<password>@<neon-host>/frontdesk?sslmode=require
PORT=5000
JWT_SECRET=frontdesk_super_secret_jwt_key_2026_inav_test
TZ=Asia/Kolkata
```

### 2. Run Database Migrations & Seeds
When the server starts with a valid `DATABASE_URL`, migrations (`schema.sql`) and seed data (`seed.js`) run automatically.
You can also run them manually:
```bash
cd server
npm run migrate
npm run seed
```

### 3. Run Automated Tests
Execute the full test suite (14 unit & integration tests):
```bash
cd server
npm test
```

### 4. Start Full-Stack Application
```bash
# From root directory:
npm start
```
Access the application at: **http://localhost:5000**

For frontend development with Vite HMR:
```bash
cd client
npm run dev
# Vite runs at http://localhost:3000
```

---

## 👥 Seed Demo Users (1-Click Switcher Available in UI)

### Support Agents (Password: `agent123`)
1. `aarav@frontdesk.com` (Aarav Sharma)
2. `diya@frontdesk.com` (Diya Patel)
3. `rohan@frontdesk.com` (Rohan Iyer)
4. `ananya@frontdesk.com` (Ananya Reddy)
5. `vikram@frontdesk.com` (Vikram Malhotra)
6. `sneha@frontdesk.com` (Sneha Rao)
7. `karan@frontdesk.com` (Karan Verma)
8. `pooja@frontdesk.com` (Pooja Nair)
9. `aditya@frontdesk.com` (Aditya Gupta)

### Customer Accounts (Password: `customer123`)
1. `rajesh@acme.com` (Rajesh Kumar - Acme Corp)
2. `priya@zenith.com` (Priya Sundaram - Zenith Labs)
3. `amitabh@globalretail.com` (Amitabh Joshi - Global Retail)
