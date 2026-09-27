import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';

// ── Resilience to flaky networks ─────────────────────────────────────────────
// Errors raised while *opening* the connection mean the request never reached the
// database, so retrying is always safe (even for writes). Anything that fails after
// the connection is open is not retried.
const CONNECT_ERRORS = new Set(['UND_ERR_CONNECT_TIMEOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']);
const RETRIES = 2;

function isConnectError(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return error instanceof TypeError && !!cause?.code && CONNECT_ERRORS.has(cause.code);
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (attempt >= RETRIES || !isConnectError(error)) throw error;
      console.warn(`[db] connection failed (${(error as { cause: { code: string } }).cause.code}), retrying (${attempt + 1}/${RETRIES})`);
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
}

neonConfig.fetchFunction = fetchWithRetry;

// Lazy singleton — resolved at first query call, not at module evaluation.
// This keeps `next build` from throwing when DATABASE_URL is absent locally.
let _sql: ReturnType<typeof neon> | null = null;

function getInstance(): ReturnType<typeof neon> {
  if (_sql) return _sql;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example → .env.local and add your Neon connection string.'
    );
  }
  _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

/**
 * Tagged-template wrapper around the Neon SQL client.
 * Returns rows as a plain array so TypeScript can use .length and index access.
 *
 * Usage: const rows = await sql`SELECT * FROM table WHERE id = ${id}`
 *
 * Note: calling `sql` executes the query immediately — results cannot be nested
 * inside another `sql` template. For dynamic clauses use `query()` below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<any[]> {
  const result = await getInstance()(strings, ...values);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Parameterised query with a plain SQL string ($1, $2, ... placeholders).
 * Use this when the WHERE clause is assembled dynamically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query(text: string, params: unknown[] = []): Promise<any[]> {
  const result = await getInstance().query(text, params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Run several parameterised statements atomically (all succeed or none do).
 * Uses Neon's HTTP transaction support, so it works in serverless functions.
 */
export async function transaction(statements: { text: string; params: unknown[] }[]): Promise<void> {
  if (statements.length === 0) return;
  const db = getInstance();
  await db.transaction(statements.map((s) => db.query(s.text, s.params)));
}
