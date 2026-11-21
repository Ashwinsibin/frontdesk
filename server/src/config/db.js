import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env.local (created by Neon CLI), root .env, and server/.env
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

// Neon PostgreSQL connection configuration
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in environment or .env. Please configure your Neon PostgreSQL connection string.');
}

export const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')) 
    ? { rejectUnauthorized: false } 
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    // console.log('executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
  }
  return res;
}

export async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW() as now, current_setting('TIMEZONE') as tz");
    console.log(`✅ PostgreSQL Connected successfully. Server time: ${res.rows[0].now}, Session TZ: ${res.rows[0].tz}`);
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL Connection Failed:', err.message);
    return false;
  }
}
