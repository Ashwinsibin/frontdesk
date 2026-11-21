import { query } from '../config/db.js';

/**
 * Log an Administrator activity to the append-only admin_activity_logs table
 * @param {Object} params
 * @param {import('pg').PoolClient} [params.client] - Optional transactional client
 * @param {number} [params.adminId]
 * @param {string} [params.adminName]
 * @param {string} [params.adminEmail]
 * @param {string} params.action - e.g. 'agent_deactivated', 'ticket_reassigned', 'priority_changed'
 * @param {string} params.targetType - 'agent' | 'ticket' | 'invitation' | 'auth' | 'system'
 * @param {string|number} [params.targetId]
 * @param {string} [params.details]
 * @param {Object} [params.metadata]
 */
export async function logAdminAction({
  client,
  adminId,
  adminName,
  adminEmail,
  action,
  targetType,
  targetId,
  details,
  metadata = {}
}) {
  const sql = `
    INSERT INTO admin_activity_logs (
      admin_id, admin_name, admin_email, action, target_type, target_id, details, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const params = [
    adminId || null,
    adminName || 'System Administrator',
    adminEmail || 'admin@frontdesk.com',
    action,
    targetType,
    targetId ? String(targetId) : null,
    details || '',
    JSON.stringify(metadata)
  ];

  if (client) {
    const res = await client.query(sql, params);
    return res.rows[0];
  }
  const res = await query(sql, params);
  return res.rows[0];
}

/**
 * Retrieve admin activity logs with filtering and search
 */
export async function getAdminActivityLogs({ action, targetType, search, limit = 100, offset = 0 } = {}) {
  let sql = `
    SELECT *
    FROM admin_activity_logs
    WHERE 1=1
  `;
  const params = [];

  if (action && action !== 'all') {
    params.push(action);
    sql += ` AND action = $${params.length}`;
  }

  if (targetType && targetType !== 'all') {
    params.push(targetType);
    sql += ` AND target_type = $${params.length}`;
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    sql += ` AND (
      LOWER(admin_name) LIKE $${params.length} OR 
      LOWER(admin_email) LIKE $${params.length} OR 
      LOWER(action) LIKE $${params.length} OR 
      LOWER(details) LIKE $${params.length} OR
      LOWER(target_id) LIKE $${params.length}
    )`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const res = await query(sql, params);
  return res.rows;
}