import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { fileURLToPath } from 'url';

export async function seedDatabase() {
  console.log('🌱 Seeding initial database data...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Administrator Account
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('System Administrator', 'admin@frontdesk.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [adminPasswordHash]);

    // 2. Seed 9 Support Agents
    const agentPasswordHash = await bcrypt.hash('agent123', 10);
    const customerPasswordHash = await bcrypt.hash('customer123', 10);

    const agents = [
      { name: 'Aarav Sharma', email: 'aarav@frontdesk.com' },
      { name: 'Diya Patel', email: 'diya@frontdesk.com' },
      { name: 'Rohan Iyer', email: 'rohan@frontdesk.com' },
      { name: 'Ananya Reddy', email: 'ananya@frontdesk.com' },
      { name: 'Vikram Malhotra', email: 'vikram@frontdesk.com' },
      { name: 'Sneha Rao', email: 'sneha@frontdesk.com' },
      { name: 'Karan Verma', email: 'karan@frontdesk.com' },
      { name: 'Pooja Nair', email: 'pooja@frontdesk.com' },
      { name: 'Aditya Gupta', email: 'aditya@frontdesk.com' }
    ];

    for (const agent of agents) {
      await client.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, 'agent')
        ON CONFLICT (email) DO NOTHING
      `, [agent.name, agent.email, agentPasswordHash]);
    }

    // 2. Seed Customer Accounts
    const customers = [
      { name: 'Rajesh Kumar (Acme Corp)', email: 'rajesh@acme.com' },
      { name: 'Priya Sundaram (Zenith Labs)', email: 'priya@zenith.com' },
      { name: 'Amitabh Joshi (Global Retail)', email: 'amitabh@globalretail.com' }
    ];

    for (const cust of customers) {
      await client.query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, 'customer')
        ON CONFLICT (email) DO NOTHING
      `, [cust.name, cust.email, customerPasswordHash]);
    }

    // 3. Seed Festival Holidays
    const holidays = [
      { date: '2026-01-26', description: 'Republic Day' },
      { date: '2026-03-03', description: 'Holi' },
      { date: '2026-08-15', description: 'Independence Day' },
      { date: '2026-10-02', description: 'Gandhi Jayanti' },
      { date: '2026-10-20', description: 'Dussehra' },
      { date: '2026-11-08', description: 'Diwali' }
    ];

    for (const h of holidays) {
      await client.query(`
        INSERT INTO holidays (holiday_date, description)
        VALUES ($1, $2)
        ON CONFLICT (holiday_date) DO NOTHING
      `, [h.date, h.description]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed completed: 9 support agents, 3 customers, and standard holidays initialized.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
