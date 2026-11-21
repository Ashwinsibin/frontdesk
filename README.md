# FRONTDESK — Customer Support Ticket Management System

**FRONTDESK** is a customer support management system developed for the fictional company **ARVO SYSTEMS** as part of the **iNav Technologies** Full Stack Developer hiring assessment. Tailored for a team of 9 support agents handling ~40 customer tickets daily, FRONTDESK enforces strict business-hour SLAs, atomic concurrency control, tamper-proof audit trails, and strict role-based access control.

---

## 🌐 Live Deployments & Repository

* **Live Web Application (Frontend)**: [https://frontdesk-frontend-skj1.onrender.com](https://frontdesk-frontend-skj1.onrender.com)
* **Live REST API (Backend)**: [https://frontdesk-84bz.onrender.com](https://frontdesk-84bz.onrender.com)
  * Health Check: [https://frontdesk-84bz.onrender.com/api/health](https://frontdesk-84bz.onrender.com/api/health)
* **GitHub Repository**: [https://github.com/Ashwinsibin/frontdesk](https://github.com/Ashwinsibin/frontdesk)

---

## 🚀 Key Application Features

### 1. Working Day & Calendar Indicator in Navbar
* Prominently displays the current day and date in **Asia/Kolkata (IST)** across all screens.
* Dynamically identifies **Working Day**, **Weekend**, or **Festival Holiday**.
* On weekends and holidays, displays the next working day and opening time (e.g., `Monday, 23 Nov at 9:30 AM IST`).
* Strictly conforms to company specifications: *displays calendar date and business status without an unnecessary live wall clock*.

### 2. Support Agent Ticket Creation
* Dedicated **`+ Create Ticket`** workstation button in the Support Agent Dashboard (`role: 'agent'`).
* Support Agents can raise tickets on behalf of existing customers (searchable dropdown) or auto-provision new customer accounts.
* Includes title, description, category, and priority (`urgent`, `medium`, `small`).
* Automatically assigns the ticket to the creating agent by default (`status = 'open'`), records creator metadata (`created_by_id`), and logs an immutable audit event (`ticket_created_by_agent`).

### 3. Automatic Working-Hours SLA Engine
* Automatically computes First Response and Resolution deadlines upon ticket creation based on priority:
  * **🔴 Urgent**: First reply within **2 working hours**. Resolution **by 18:30:00 IST on the same working day** (Close of Business). Off-hours or weekend creation snaps resolution to 18:30:00 IST on the next working day.
  * **🟡 Medium**: First reply within **half a working day** (4.5h / 270m). Resolution in **~3 working days** (27 working hours / 1,620m).
  * **🔵 Small**: First reply within **1 working day** (9h / 540m). Resolution in **~1 working week** (45 working hours / 2,700m).
* **Business Hours Schedule**: Monday to Friday, **09:30 AM to 06:30 PM IST** (9 working hours/day).
* Non-working hours (18:30–09:30), weekends (Saturday & Sunday), and festival holidays from the `holidays` database table are strictly excluded.

### 4. Dynamic Live SLA Counter & In-App Simulation Mode
* Second-by-second countdown during active working hours; safely held outside business hours and on weekends/holidays.
* Dynamic status chips: `Running`, `Paused`, `Overdue`, `Completed`, or `Outside Business Hours`.
* **In-App Simulation Mode (`⚡ Test Live Countdown`)**: Built-in toggle in the Ticket Detail Modal allowing testers to simulate active business hours (Monday 10:00 AM IST) on weekends and observe the live second-by-second countdown in real time.

### 5. SLA Pausing & Net-Remaining Working Budget
* Timers automatically pause when a ticket enters `pending_customer` status.
* When a customer responds, paused duration is calculated **strictly in working minutes** (e.g., pausing Friday 17:30 to Monday 10:30 counts exactly 120 working minutes, skipping nights and weekends).
* Priority recalculation preserves completed milestones and recalculates remaining active deadlines using the **Net-Remaining Working Budget** policy.

### 6. Atomic Single-Agent Claiming & Concurrency Protection
* Atomic claiming: `UPDATE tickets ... WHERE id = $id AND assigned_agent_id IS NULL RETURNING *`.
* Prevents double-assignment race conditions; simultaneous claims return `HTTP 409 Conflict`.

### 7. Strict Private Note Isolation
* Dual-tab agent composer: **Public Reply** (Customer visible) vs. **Internal Note** (Private agent communication).
* Private notes are filtered at both the database query and serialization layers; customers can never access internal notes.

### 8. Append-Only Tamper-Proof Audit History
* `ticket_audit_logs` is protected by a PostgreSQL database trigger raising `ERRCODE 28000` on any unauthorized `UPDATE` or `DELETE`.
* Foreign key constraints (`ON DELETE RESTRICT`) prevent deleting tickets that have associated audit records.

### 9. Cold-Start Resilient Auto-Close Sweeper
* Automatically closes tickets waiting for customer responses > 45 working hours.
* Triggered on server cold-start, periodically via background interval, and Just-In-Time (JIT) before ticket queries.

### 10. 7-Calendar-Day Reopening Window
* Customers can reopen resolved tickets within 7 calendar days (`resolved_at + INTERVAL '7 days'`). After 7 calendar days, reopening requests are rejected.

### 11. Admin Management Dashboard
* Team management, active agent load metrics, and one-click agent deactivation with atomic ticket reassignment.
* Agent invitation token generation and revocation.
* Complete system audit log and performance analytics.

### 12. Full Theme & Responsive Support
* Built-in Dark Mode and Light Mode support with seamless switching and mobile responsiveness.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite 6, Tailwind CSS 3, Lucide React Icons, Date-Fns |
| **Backend** | Node.js (ES Modules), Express 4, `pg` (node-postgres), JWT, bcryptjs, CORS |
| **Database** | PostgreSQL (Neon Serverless PostgreSQL or local PostgreSQL instance) |
| **Testing** | Node.js native test runner (`node --test`), `pg-mem` |
| **Timezone** | `Asia/Kolkata` (IST, UTC+05:30) |

---

## 📋 Prerequisites

* **Node.js**: Version 18.x or higher (Node 20+ recommended)
* **npm**: Version 9.x or higher
* **PostgreSQL Database**: Either a cloud [Neon](https://neon.tech) PostgreSQL database or a local PostgreSQL instance (v14+)

---

## ⚙️ Environment Configuration

### Backend Configuration (`server/.env`)

Create a `.env` file in the `server` directory (or copy from `.env.example` in root):

```env
# Server Port & Environment
PORT=5000
NODE_ENV=development

# PostgreSQL Connection String (Neon cloud or local PostgreSQL)
# Example Neon: postgresql://<user>:<password>@<neon-hostname>/frontdesk?sslmode=require
# Example Local: postgresql://postgres:<password>@localhost:5432/frontdesk
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=require

# JWT Secret for Session Tokens
JWT_SECRET=your_jwt_secret_key_change_in_production

# Timezone (Asia/Kolkata is required for Frontdesk SLA calculations)
TZ=Asia/Kolkata
```

> [!IMPORTANT]
> Never commit `.env` files containing actual passwords, tokens, or credentials to version control.

### Frontend Configuration (`client/.env.local` - Optional for local dev)

The frontend automatically defaults to `http://localhost:5000/api` for local development. If your backend runs on a custom URL or port, create `client/.env.local`:

```env
VITE_API_URL=http://localhost:5000/api
```

---

## 📦 Installation Instructions

You can install all dependencies from the root directory or inside each folder individually:

### Option A: Install from Root
```bash
npm run install:all
```
*This executes `npm run install:server` (`cd server && npm install`) followed by `npm run install:client` (`cd client && npm install`).*

### Option B: Install Separately
```bash
# Terminal 1 - Install Server Dependencies
cd server
npm install

# Terminal 2 - Install Client Dependencies
cd ../client
npm install
```

---

## 🗄️ Database Setup & Migrations

### 1. Run Migrations
To initialize or update the database schema:
```bash
cd server
npm run migrate
```
* **Script**: `node src/db/migrate.js`
* **Behavior**: Reads `server/src/db/schema.sql` and applies schema updates inside an atomic PostgreSQL transaction (`BEGIN ... COMMIT`).
* **Migration Safety**: Uses idempotent SQL statements (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION`) designed to preserve existing tables, columns, and rows without resetting or dropping existing data.

### 2. Seed Demo Data (Optional)
To populate the database with initial demo accounts, agents, and festival holidays:
```bash
cd server
npm run seed
```
* **Script**: `node src/db/seed.js`
* **Notice**: **[OPTIONAL]** This step is optional. It populates 1 System Administrator, 9 Support Agents, 3 Customers, and 2026 Indian national/festival holidays.
* **Safety**: All inserts use `ON CONFLICT (email) DO NOTHING` and `ON CONFLICT (holiday_date) DO NOTHING`. It will **never** overwrite or reset existing data.

---

## 🏃 Running the Application Locally

For local development, run the backend and frontend in two separate terminal windows:

### Terminal 1: Backend Server (Port 5000)
```bash
cd server
npm run dev
```
* Runs Express backend with live file watch (`node --watch src/server.js`).
* Server starts on: **`http://localhost:5000`**
* Health check: **`http://localhost:5000/api/health`**

*Alternative from root directory:*
```bash
npm run dev:server
```

---

### Terminal 2: Frontend Client (Port 3000)
```bash
cd client
npm run dev
```
* Starts the Vite React development server with Hot Module Replacement (HMR).
* Configured port in `client/vite.config.js`: **`http://localhost:3000`**

*Alternative from root directory:*
```bash
npm run dev:client
```

---

### Full-Stack Production Mode (Single Port 5000)
To build the frontend and serve it directly from Express:
```bash
# From root directory:
npm run build      # Compiles React app into client/dist
npm start          # Starts Express server serving client/dist on http://localhost:5000
```

---

## 🧪 Automated Testing

The project includes a comprehensive automated test suite covering authentication, role isolation, atomic concurrency, audit trail immutability, agent ticket creation, and SLA working-hours math.

### Run All Tests
```bash
# From root directory:
npm test

# Or inside the server directory:
cd server
npm test
```

### Current Test Count & Coverage
**78 automated tests across 8 test suites (78 passing, 0 failing):**

1. **Admin Management Dashboard & Security (`adminDashboard.test.js`)**: 15 tests
   * Role permissions (403 for non-admins), overview metrics, agent load balancing, agent deactivation & atomic ticket reassignment, deletion protection, invite token generation, priority overrides, and activity logs.
2. **Agent Ticket Creation & Automatic SLA Engine (`agentTicketAndSLA.test.js`)**: 14 tests
   * Agent customer listing, ticket creation on behalf of existing/new customers, role enforcement (403 for customers), auto-SLA assignment, off-hours snapping, weekend/holiday exclusions, and active vs. frozen countdown behavior.
3. **User Registration & Authentication (`authRegistration.test.js`)**: 8 tests
   * Field validation, password matching, length requirements, customer role assignment, agent registration, duplicate email rejection, and credential verification.
4. **Database & Critical Business Rules (`databaseAndIntegration.test.js`)**: 6 tests
   * Append-only audit trigger (`ERRCODE 28000` on UPDATE/DELETE), audit foreign key retention (`ON DELETE RESTRICT`), single-agent atomic claim concurrency, private note isolation, and auto-close sweep.
5. **Security & Role Permission Enforcement (`securityRoles.test.js`)**: 14 tests
   * Role tampering defense, invitation token replay protection, admin-only token generation, and customer vs. agent endpoint segregation.
6. **Server Startup & Port Resolution (`serverStartup.test.js`)**: 4 tests
   * Valid port parsing, fallback to 5000 on empty values, and `RangeError [ERR_SOCKET_BAD_PORT]` prevention.
7. **SLA Working-Hours Engine Unit Tests (`slaEngine.test.js`)**: 8 tests
   * Urgent same-day 18:30 IST resolution, off-hours next-day snapping, weekend and holiday exclusions, working-minutes-only pause calculation, and 7-day reopening window.
8. **SLA Working-Hours Engine Real-World Scenarios (`slaEngineScenarios.test.js`)**: 9 tests
   * 9 comprehensive end-to-end timeline scenarios (ticket raised Friday at 18:00, tickets raised over weekends, pause and resume, mid-lifecycle priority changes).

---

## 👥 Demo Login Credentials & Roles

The login page includes **1-Click Quick Demo Login** buttons at the bottom of the form for immediate testing:

### 1. System Administrator
* **Email**: `admin@frontdesk.com`
* **Password**: `admin123`
* **Role Capabilities**: Full access to the Admin Dashboard (`/admin`), agent workstation oversight, agent deactivation with ticket reassignment, invitation link creation, manual priority overrides with net-remaining SLA recalculation, full system audit trail, and team performance analytics.

### 2. Support Agents (9 Dedicated Agents)
* **Password for all agents**: `agent123`
* **Emails**:
  1. `aarav@frontdesk.com` (Aarav Sharma)
  2. `diya@frontdesk.com` (Diya Patel)
  3. `rohan@frontdesk.com` (Rohan Iyer)
  4. `ananya@frontdesk.com` (Ananya Reddy)
  5. `vikram@frontdesk.com` (Vikram Malhotra)
  6. `sneha@frontdesk.com` (Sneha Rao)
  7. `karan@frontdesk.com` (Karan Verma)
  8. `pooja@frontdesk.com` (Pooja Nair)
  9. `aditya@frontdesk.com` (Aditya Gupta)
* **Role Capabilities**: Access to Agent Workstation (`/agent`), atomic single-agent ticket claiming, creating tickets on behalf of customers (`+ Create Ticket`), dual-tab messaging (public replies vs. private internal notes), live working-hours SLA countdowns, priority recalculation, resolving tickets, and reassigning.

### 3. Customer Accounts
* **Password for all customers**: `customer123`
* **Emails**:
  1. `rajesh@acme.com` (Rajesh Kumar - Acme Corp)
  2. `priya@zenith.com` (Priya Sundaram - Zenith Labs)
  3. `amitabh@globalretail.com` (Amitabh Joshi - Global Retail)
* **Role Capabilities**: Customer Portal (`/customer`), raise support tickets, track ticket status and resolution progress, respond to public agent messages, resolve tickets, and reopen resolved tickets within the 7-calendar-day window.

---

## 📜 Complete npm Script Reference

All scripts documented below exist and have been verified in their respective `package.json` files:

### Root `package.json`
| Command | Description |
|---|---|
| `npm run install:all` | Installs dependencies for both server and client packages |
| `npm run install:server` | Runs `cd server && npm install` |
| `npm run install:client` | Runs `cd client && npm install` |
| `npm test` | Runs the server test suite via `cd server && npm test` |
| `npm run build` | Compiles the client production bundle via `cd client && npm run build` |
| `npm start` | Starts the production server via `cd server && node src/server.js` |
| `npm run dev:server` | Runs the development server via `cd server && npm run dev` |
| `npm run dev:client` | Runs the development client via `cd client && npm run dev` |

### Server `server/package.json`
| Command | Description |
|---|---|
| `npm start` | Starts the backend server with `node src/server.js` |
| `npm run dev` | Starts the backend in watch mode with `node --watch src/server.js` |
| `npm run migrate` | Executes database migrations with `node src/db/migrate.js` |
| `npm run seed` | Seeds demo users, agents, and holidays with `node src/db/seed.js` |
| `npm test` | Runs all 78 automated tests with `node --test tests/*.test.js` |

### Client `client/package.json`
| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite React development server with HMR on port 3000 |
| `npm run build` | Compiles the frontend into static assets in `client/dist` |
| `npm run preview` | Previews the compiled production build locally |

---

## 🔒 Security & Data Integrity Guarantees

* **Zero Password Exposure**: Passwords are securely hashed using `bcryptjs` (salt rounds: 10).
* **Database Trigger Protection**: Any unauthorized `UPDATE` or `DELETE` on `ticket_audit_logs` is rejected at the database engine level (`ERRCODE 28000`).
* **Private Note Masking**: Customer API responses filter out private internal notes at both SQL and JSON serialization levels.
* **Race Condition Prevention**: Atomic single-agent ticket claiming prevents dual-agent collisions (`HTTP 409 Conflict`).
* **SLA Integrity**: Countdown logic exclusively decrements working seconds during configured business hours (`09:30–18:30 IST`), completely protecting customers and agents during off-hours, weekends, and holidays.