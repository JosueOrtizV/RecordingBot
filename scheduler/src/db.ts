import pg from 'pg';
import { config } from './config';
import { logger } from './logger';

const { Pool } = pg;

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on PostgreSQL pool in scheduler:', err);
});

export async function query(text: string, params?: any[]) {
  return await pool.query(text, params);
}
