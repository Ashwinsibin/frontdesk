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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
