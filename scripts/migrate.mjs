// Apply pending database migrations (scripts/migrations/*.sql, in filename order).
//
//   node --env-file=.env.local scripts/migrate.mjs
//
// Each file runs inside a transaction and is recorded in schema_migrations,
// so re-running only applies new files.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run with --env-file=.env.local');
  process.exit(1);
}

const dir = join(import.meta.dirname, 'migrations');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    process.stdout.write(`Applying ${file} ... `);
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log('done');
      count++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('FAILED');
      throw error;
    }
  }
  console.log(count ? `Applied ${count} migration(s).` : 'Database is up to date.');
} finally {
  client.release();
  await pool.end();
}
