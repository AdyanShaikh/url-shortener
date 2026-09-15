'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

let schemaReady;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code VARCHAR(7) PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        clicks INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function rowFromDb(row) {
  if (!row) return undefined;
  return {
    code: row.code,
    url: row.url,
    clicks: Number(row.clicks),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

class PostgresLinkStore {
  async findByUrl(url) {
    await ensureSchema();
    const { rows } = await pool.query(
      'SELECT code, url, clicks, created_at FROM links WHERE url = $1 LIMIT 1',
      [url],
    );
    return rowFromDb(rows[0]);
  }

  async findByCode(code) {
    await ensureSchema();
    const { rows } = await pool.query(
      'SELECT code, url, clicks, created_at FROM links WHERE code = $1 LIMIT 1',
      [code],
    );
    return rowFromDb(rows[0]);
  }

  async hasCode(code) {
    await ensureSchema();
    const { rowCount } = await pool.query('SELECT 1 FROM links WHERE code = $1 LIMIT 1', [code]);
    return rowCount > 0;
  }

  async create(url, code) {
    await ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO links (code, url)
       VALUES ($1, $2)
       ON CONFLICT (url) DO UPDATE SET url = EXCLUDED.url
       RETURNING code, url, clicks, created_at`,
      [code, url],
    );
    return rowFromDb(rows[0]);
  }

  async recordClick(code) {
    await ensureSchema();
    const { rows } = await pool.query(
      `UPDATE links
       SET clicks = clicks + 1
       WHERE code = $1
       RETURNING code, url, clicks, created_at`,
      [code],
    );
    return rowFromDb(rows[0]);
  }

  async health() {
    await ensureSchema();
    await pool.query('SELECT 1');
  }
}

module.exports = { PostgresLinkStore, pool };
