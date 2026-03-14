const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    console.log('[DB MIGRATION] Starting database migrations...');

    // Channels Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        username VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subscribers VARCHAR(50),
        description TEXT,
        avatar_url TEXT,
        ownership VARCHAR(100) DEFAULT 'Competitor Channel',
        status VARCHAR(50) DEFAULT 'Active',
        added_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB MIGRATION] Evaluated "channels" table.');

    // Analytics Dashboard View requires analytics_history but let's see. Wait, what does analytics endpoint hit? 
    // They hit /api/analytics
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_history (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        details JSONB
      );
    `);
    console.log('[DB MIGRATION] Evaluated "analytics_history" table.');

    console.log('[DB MIGRATION] All migrations completed successfully.');
  } catch (err) {
    console.error('[DB MIGRATION Error]', err.stack);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = runMigrations;
