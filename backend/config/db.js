const { Pool } = require('pg');
require('dotenv').config();

const types = require('pg').types;
// Return DATE columns (OID 1082) as pure YYYY-MM-DD strings without JS Date timezone conversions
types.setTypeParser(1082, val => val);

let poolConfig;

// Support DATABASE_URL (used by Render, Railway, Supabase, Heroku, etc.)
if (process.env.DATABASE_URL) {
  const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
  const useSsl = process.env.DB_SSL === 'true' || (!isLocalhost && process.env.DB_SSL !== 'false');

  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  if (useSsl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  console.log(`[DB] Using DATABASE_URL connection string (${useSsl ? 'SSL enabled' : 'SSL disabled'})`);
} else {
  if (!process.env.DB_USER || !process.env.DB_HOST || !process.env.DB_DATABASE || !process.env.DB_PASSWORD) {
    throw new Error('CRITICAL: Missing database config. Set DATABASE_URL or DB_USER, DB_HOST, DB_DATABASE, DB_PASSWORD in .env');
  }
  poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  console.log(`[DB] Using individual DB vars: ${process.env.DB_HOST}/${process.env.DB_DATABASE}`);
}

const pool = new Pool(poolConfig);

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB] CRITICAL: Failed to connect to database:', err.message);
  } else {
    console.log('[DB] Successfully connected to PostgreSQL database');
    release();
  }
});

module.exports = pool;
