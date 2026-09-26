# MDS Pharmaceutical — Cheque Management

Cheque management system for M.D.S Pharmaceutical (Pvt) Ltd, covering both requirement documents:

- **Receivables** (SRS: *Cheque Management System*) — cheques received from customers:
  In Hand → Deposited → Credited, or Returned.
- **Payables** (SRS: *Creditors Outstanding Cheques & Monthly Payables*) — cheques issued to creditors:
  Pending → Cleared, or Cancelled; plus GRN purchases for the monthly payables report.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and Neon serverless Postgres.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — your Neon connection string
   - `SESSION_SECRET` — at least 32 random characters (`openssl rand -base64 32`)

3. **Create / update the database schema** — applies any pending files in `scripts/migrations/`:

   ```bash
   node --env-file=.env.local scripts/migrate.mjs
   ```

4. **Create the first administrator** (you'll be prompted for a password, min. 10 characters):

   ```bash
   node --env-file=.env.local scripts/create-user.mjs admin --admin
   ```

   After that, administrators add and manage users in the app under **Administration → Users**.

5. **Run the app**

   ```bash
   npm run dev
   ```

## Features

| Area | What it does |
| --- | --- |
| Dashboard | Receivables and payables totals, monthly cheque volume/value, credited and cleared trends, outstanding trend, creditor-wise outstanding |
| Customer Cheques / Creditor Cheques | Registers with instant search (name, cheque no., GRN, bank, amount), filters (status, customer/creditor, month, date range, bank), status checkboxes that record dates automatically, export/print |
| Add / edit cheque | GRN, cheque no., date, amount, bank, entry date, remarks; edit, reschedule and delete; duplicate cheque/GRN detection with administrator override |
| Customers / Creditors | Full profiles (address, contact, email, credit terms / opening balance, remarks), active/inactive, delete with safety checks, merge duplicates |
| Purchases (GRN) | Creditor purchases used by the monthly payables report |
| Reports | 14 reports from both SRS documents plus register exports — each previews on screen and exports to PDF / Excel with print preview and direct print |
| Administration | Users & roles, activity log, Excel import, backup & restore |

### Roles (SRS §10)

- **System administrator** — full access, delete records, approve duplicate entries, manage users, import, backup/restore.
- **Standard user** — add records, edit their own records, view and print reports.

### Audit trail (SRS §8, §12)

Every record stores created by/at and modified by/at, and every change, status update, import, export and
sign-in is written to the activity log (Administration → Activity Log; per-record history on each edit page).

## Importing existing Excel data

Administration → **Import Excel** reads the monthly *Credit* and *Debit Cheques Summary* workbooks directly
(one sheet per month; summary/dashboard sheets are skipped). Preview first, then import. Notes:

- "Returned" (customers) and "Cancelled" (creditors) are taken from the Remarks column; "Not Deposited" rows import as In Hand.
- The spreadsheets have no status dates, so the cheque date is used for deposited/credited/cleared dates.
- Dates whose year doesn't match the sheet name (e.g. 2025 on "OCTOBER - 2026") are corrected and listed in the preview.
- Names are matched ignoring case/spacing/punctuation; use **Merge** on a customer/creditor page to combine spelling variants.
- Re-importing the same file is safe: cheques already in the system are skipped.

## Backups (SRS §11)

- **Manual**: Administration → Backup & Restore → *Download backup* (JSON). *Restore* replaces customers,
  creditors, cheques and purchases from a backup file.
- **Automatic daily**: `.github/workflows/daily-backup.yml` runs `pg_dump` every night (01:00 Sri Lanka time) and
  keeps each dump for 30 days as a GitHub Actions artifact. Push the repo to GitHub and add the repository secret
  `DATABASE_URL` to enable it.
- Neon also keeps a short point-in-time restore history of the database.

## Notes

- Dates such as "this month" use Sri Lanka time (`Asia/Colombo`, see `lib/dates.ts`).
- Reports: "Payments made" in the payables report = cheques issued in the period (cancelled cheques excluded).
