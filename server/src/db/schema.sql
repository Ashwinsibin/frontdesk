-- FRONTDESK Production PostgreSQL DDL Schema
-- Timezone Standard: Asia/Kolkata

SET timezone = 'Asia/Kolkata';

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'agent', 'admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created in earlier version
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Holidays Table (Excludes festival days from SLA calculations)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE UNIQUE NOT NULL,
    description VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new' 
        CHECK (status IN ('new', 'open', 'pending_customer', 'resolved', 'closed')),
    priority VARCHAR(20) NOT NULL 
        CHECK (priority IN ('urgent', 'medium', 'small')),
    
    -- First Response SLA Tracking
    first_response_due_at TIMESTAMPTZ NOT NULL,
    first_responded_at TIMESTAMPTZ,
    first_response_breached BOOLEAN NOT NULL DEFAULT FALSE,

    -- Resolution SLA Tracking
    resolution_due_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_breached BOOLEAN NOT NULL DEFAULT FALSE,

    -- Pause & Inactivity Tracking
    sla_paused_at TIMESTAMPTZ,
    total_paused_working_minutes INTEGER NOT NULL DEFAULT 0,
    waiting_customer_since TIMESTAMPTZ,
    
    -- Lifecycle Timestamps
    reopened_at TIMESTAMPTZ,
    reopen_deadline_at TIMESTAMPTZ, -- Set to resolved_at + INTERVAL '7 days'
    closed_at TIMESTAMPTZ,
    last_customer_reply_at TIMESTAMPTZ,
    last_agent_reply_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure category and created_by_id exist if table was already created in earlier version
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. Ticket Messages & Notes Table
CREATE TABLE IF NOT EXISTS ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('public_reply', 'internal_note')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Append-Only Audit Logs Table (Protected by ON DELETE RESTRICT)
CREATE TABLE IF NOT EXISTS ticket_audit_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    actor_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_ticket ON ticket_audit_logs(ticket_id);

-- 6. Agent Invitations Table (For administrator invitation & approval)
CREATE TABLE IF NOT EXISTS agent_invitations (
    id SERIAL PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    token VARCHAR(100) UNIQUE NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure revoked_at exists if table was previously created
ALTER TABLE agent_invitations ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invitations_token ON agent_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON agent_invitations(email);

-- 7. Admin Activity Logs (Append-Only Audit of Administrator Operations)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_name VARCHAR(100) NOT NULL,
    admin_email VARCHAR(150) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_activity_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_activity_logs(created_at);

-- Layer 1: Trigger-Based Immutability Guard on Audit Logs
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: ticket_audit_logs is append-only. UPDATE and DELETE operations are prohibited.'
        USING ERRCODE = '28000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_audit_logs ON ticket_audit_logs;
CREATE TRIGGER trg_protect_audit_logs
BEFORE UPDATE OR DELETE ON ticket_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Layer 2: Trigger-Based Immutability Guard on Admin Activity Logs
CREATE OR REPLACE FUNCTION prevent_admin_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: admin_activity_logs is append-only. UPDATE and DELETE operations are prohibited.'
        USING ERRCODE = '28000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_admin_activity_logs ON admin_activity_logs;
CREATE TRIGGER trg_protect_admin_activity_logs
BEFORE UPDATE OR DELETE ON admin_activity_logs
FOR EACH ROW EXECUTE FUNCTION prevent_admin_log_mutation();
