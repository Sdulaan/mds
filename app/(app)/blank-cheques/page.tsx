import Link from 'next/link';
import type { Metadata } from 'next';
import { Printer, Undo2 } from 'lucide-react';
import { releaseBlankCheque } from '@/actions/chequeNumberActions';
import { requireUser } from '@/lib/auth';
import { getBankNames } from '@/lib/data/cheques';
import { getBlankCheques, getAvailableNumbers, getCancelledNumbers, toBooks } from '@/lib/data/chequeNumbers';
import { getEntityOptions } from '@/lib/data/entities';
import { formatDate } from '@/lib/dates';
import { btnPrimary, btnSecondary, btnSmall, card, td, th } from '@/lib/ui';
import ConfirmButton from '@/components/ConfirmButton';
import PageHeader from '@/components/PageHeader';
import { GenerateNumbers, RecordBlankCheque } from '@/components/cheques/BlankChequeForms';
import { CancelledList, CancelNumberButton, ChequeBookList } from '@/components/cheques/ChequeBookList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Blank Cheques' };

export default async function BlankChequesPage() {
  await requireUser();
  const [blanks, available, cancelled, creditors, banks] = await Promise.all([
    getBlankCheques(),
    getAvailableNumbers(),
    getCancelledNumbers(),
    getEntityOptions('VENDOR'),
    getBankNames('DEBIT'),
  ]);
  const stock = available.filter((n) => !n.entity_id);
  const books = toBooks(stock).map((b) => ({
    start: b.start,
    size: b.size,
    left: b.left,
    rangeLabels: b.ranges.map((x) => (x.count > 1 ? `${x.from} – ${x.to}` : x.from)),
    numbers: b.numbers.map((n) => ({ id: n.id, number: n.cheque_number, bank: n.bank_name })),
  }));

  return (
    <div>
      <PageHeader
        title="Blank Cheques"
        description="Cheques given to creditors before the date and amount are known, plus bulk cheque number generation. A cheque leaves this register once it is added under Creditor Cheques."
        actions={<Link href="/reports/blank-cheques" className={btnSecondary}><Printer className="h-4 w-4" /> Print / Export</Link>}
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <RecordBlankCheque creditors={creditors} freeNumbers={stock.map((n) => n.cheque_number)} banks={banks} />
        <GenerateNumbers banks={banks} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-fg">
          Blank cheque register <span className="text-sm font-normal text-muted">· {blanks.length} not yet assigned</span>
        </h2>
        {blanks.length === 0 ? (
          <p className={`${card} py-12 text-center text-sm text-subtle`}>No blank cheques waiting for a date and amount.</p>
        ) : (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-left">
                    <th className={th}>Creditor</th>
                    <th className={th}>Cheque No.</th>
                    <th className={th}>Bank</th>
                    <th className={th}>Given on</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {blanks.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-2/60">
                      <td className={`${td} font-medium text-fg`}>{b.entity_name}</td>
                      <td className={`${td} tabular-nums`}>{b.cheque_number}</td>
                      <td className={`${td} text-muted`}>{b.bank_name ?? '—'}</td>
                      <td className={`${td} text-muted`}>{b.issued_date ? formatDate(b.issued_date) : '—'}</td>
                      <td className={`${td} text-right`}>
                        <div className="flex items-start justify-end gap-2">
                          <Link
                            href={`/cheques/new?type=DEBIT&number=${encodeURIComponent(b.cheque_number)}&creditor=${encodeURIComponent(b.entity_name ?? '')}`}
                            className={btnPrimary + ' !px-3 !py-1.5 !text-xs'}
                          >
                            Add date &amp; amount
                          </Link>
                          <ConfirmButton
                              action={releaseBlankCheque.bind(null, b.id)}
                              confirm={`Remove blank cheque ${b.cheque_number} (${b.entity_name}) from the register?`}
                              className={btnSmall}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Remove
                          </ConfirmButton>
                          <CancelNumberButton id={b.id} number={b.cheque_number} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-fg">
          Available cheque numbers <span className="text-sm font-normal text-muted">· {stock.length.toLocaleString()} in stock</span>
        </h2>
        {books.length === 0 ? (
          <p className={`${card} py-12 text-center text-sm text-subtle`}>No unused generated cheque numbers.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">Each cheque book holds 50 cheques. Open a book to edit or cancel a number.</p>
            <ChequeBookList books={books} />
          </>
        )}
      </section>

      {cancelled.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-fg">
            Cancelled cheque numbers <span className="text-sm font-normal text-muted">· {cancelled.length.toLocaleString()}</span>
          </h2>
          <CancelledList
            rows={cancelled.map((c) => ({ id: c.id, number: c.cheque_number, bank: c.bank_name, reason: c.cancel_reason, cancelledOn: c.cancelled_at ? formatDate(c.cancelled_at.slice(0, 10)) : '' }))}
          />
        </section>
      )}
    </div>
  );
}
