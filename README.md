# MDS Pharmacy — Cheque Management

Internal app for tracking credit (received) and debit (paid) cheques against customers and vendors,
with a dashboard, a filterable ledger, and downloadable Excel/PDF reports.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and Neon serverless Postgres.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — your Neon connection string
   - `SESSION_SECRET` — at least 32 random characters (`openssl rand -base64 32`)

3. **Create the database schema** — in the Neon SQL editor run:
   - a **new** database: `scripts/init-db.sql`
   - an **existing** database from before login was added: `scripts/migrations/001_auth_and_cleared_at.sql`

4. **Create a login user** (you'll be prompted for a password, min. 10 characters). Re-running with an
   existing username resets that user's password.

   ```bash
   node --env-file=.env.local scripts/create-user.mjs admin
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and sign in.

## Features

| Page | What it does |
| --- | --- |
| `/` Dashboard | Pending credits/debits, cleared this month, total outstanding, recent activity |
| `/ledger` | All cheques, filter by type / status / month, change status, export Excel or PDF |
| `/add-cheque` | Record a new cheque (credits → customers, debits → vendors) |
| `/reports` | Preview a summary for any month/filter and download it as Excel or PDF |
| `/entities` | Add and remove vendors and customers |

Reports are generated on the server at `/api/reports/excel` and `/api/reports/pdf`, and accept the same
`type`, `status` and `month` (`YYYY-MM`) query parameters as the ledger. The Excel workbook has a
*Summary* sheet (by status and by entity) and a *Transactions* sheet with auto-filter and a running total.

## Authentication

- Username/password accounts live in the `users` table (passwords hashed with scrypt).
- Sessions are signed, HTTP-only cookies valid for 12 hours.
- `proxy.ts` redirects signed-out visitors to `/login`; every page, data query, server action and report
  route also checks the session on the server.

## Notes

- Dates such as "this month" and the dashboard greeting use Sri Lanka time (`Asia/Colombo`, see `lib/dates.ts`).
- "Cleared This Month" is based on when a cheque was marked cleared (`cleared_at`), not the cheque date.
