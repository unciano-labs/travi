import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { manilaToday } from '@/lib/datetime';
import { captureException } from '@/lib/logger';
import { dateRangeSchema, firstParam } from '@/lib/schemas/admin-tools';
import PageHeader from '@/components/ui/PageHeader';
import FinanceClient, { type FinanceSummary } from '@/components/admin/FinanceClient';
import PaymentsReviewClient, { type ReviewPayment } from '@/components/admin/PaymentsReviewClient';

type Embed<T> = T | T[] | null | undefined;
const one = <T,>(value: Embed<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

interface PaymentRow {
  id: string;
  provider_payment_id: string;
  payment_intent_id: string | null;
  amount_centavos: number;
  fee_centavos: number;
  review_reason: string | null;
  source: string;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  resolution_note: string | null;
  provider_refund_id: string | null;
  refund_started_at: string | null;
  resolver: Embed<{ full_name: string | null }>;
  bookings: Embed<{
    id: string;
    booking_ref: string | null;
    status: string;
    traveler: Embed<{ full_name: string | null }>;
    tour_schedules: Embed<{ start_date: string; tours: Embed<{ title: string }> }>;
  }>;
}

function firstOfMonth(today: string) {
  return `${today.slice(0, 7)}-01`;
}

const toReview = (p: PaymentRow): ReviewPayment => {
  const booking = one(p.bookings);
  const schedule = one(booking?.tour_schedules);
  return {
    id: p.id,
    providerPaymentId: p.provider_payment_id,
    amount: Number(p.amount_centavos) / 100,
    fee: Number(p.fee_centavos) / 100,
    reason: p.review_reason,
    source: p.source,
    createdAt: p.created_at,
    resolvedAt: p.resolved_at,
    resolution: p.resolution,
    resolutionNote: p.resolution_note,
    providerRefundId: p.provider_refund_id,
    refundInProgress: Boolean(p.refund_started_at && !p.resolved_at && Date.now() - new Date(p.refund_started_at).getTime() < 15 * 60_000),
    resolverName: one(p.resolver)?.full_name ?? null,
    bookingRef: booking?.booking_ref ?? null,
    bookingStatus: booking?.status ?? null,
    travelerName: one(booking?.traveler)?.full_name ?? null,
    tourTitle: one(schedule?.tours)?.title ?? null,
    startDate: schedule?.start_date ?? null,
  };
};

export default async function AdminFinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const params = await searchParams;
  const today = manilaToday();
  const parsed = dateRangeSchema.safeParse({ from: firstParam(params.from), to: firstParam(params.to) });
  const from = (parsed.success && parsed.data.from) || firstOfMonth(today);
  const to = (parsed.success && parsed.data.to) || today;

  // Service role: admin console read, authorized above (AGENTS.md §5.3). booking_payments is service-role only.
  const admin = createAdminClient({ admin: true });
  const paymentSelect = `
    id, provider_payment_id, payment_intent_id, amount_centavos, fee_centavos, review_reason, source, created_at,
    resolved_at, resolution, resolution_note, provider_refund_id, refund_started_at,
    resolver:user_profiles!resolved_by ( full_name ),
    bookings ( id, booking_ref, status, traveler:user_profiles!traveler_id ( full_name ), tour_schedules ( start_date, tours ( title ) ) )
  `;

  const [summaryRes, openRes, resolvedRes] = await Promise.all([
    admin.rpc('admin_finance_summary', { p_from: from, p_to: to }),
    admin
      .from('booking_payments')
      .select(paymentSelect)
      .eq('status', 'needs_review')
      .is('resolved_at', null)
      .order('created_at', { ascending: true })
      .limit(200),
    admin
      .from('booking_payments')
      .select(paymentSelect)
      .eq('status', 'needs_review')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(20),
  ]);
  if (summaryRes.error) captureException(summaryRes.error, { action: 'AdminFinancePage summary' });

  const raw = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as Record<string, number | string> | null;
  const n = (key: string) => Number(raw?.[key] ?? 0);
  const summary: FinanceSummary | null = raw
    ? {
        gmv: n('gmv'),
        paymentsCount: n('payments_count'),
        platformFees: n('platform_fees'),
        mdr: n('mdr'),
        refunds: n('refunds'),
        refundsCount: n('refunds_count'),
        escrowLiability: n('escrow_liability'),
        availableLiability: n('available_liability'),
        pendingPayouts: n('pending_payouts'),
        pendingPayoutsCount: n('pending_payouts_count'),
        needsReviewAmount: n('needs_review_amount'),
        needsReviewCount: n('needs_review_count'),
        ledgerDriftCount: n('ledger_drift_count'),
      }
    : null;

  return (
    <>
      <PageHeader
        title="Finance"
        description="Money in, money owed and payments that need attention. Amounts in PHP."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Finance' }]}
      />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12">
          <FinanceClient summary={summary} from={from} to={to} rangeError={parsed.success ? null : parsed.error.issues[0]?.message ?? null} />
        </div>
        <div className="col-span-12">
          <PaymentsReviewClient
            initialOpen={((openRes.data ?? []) as unknown as PaymentRow[]).map(toReview)}
            recentlyResolved={((resolvedRes.data ?? []) as unknown as PaymentRow[]).map(toReview)}
          />
        </div>
      </div>
    </>
  );
}
