// Admin CSV exports for finance (FIN-11): bookings, payments, refunds, payouts, ledger.
// Admin-only (cookie session + role check), streamed in pages of 1000 rows, capped at MAX_ROWS.
// Only the data finance needs: no traveler emails/phones; payout account numbers masked to the last 4.
import { NextResponse, type NextRequest } from 'next/server';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { captureException } from '@/lib/logger';
import { manilaToday } from '@/lib/datetime';
import { csvLine, type CsvValue } from '@/lib/csv';
import { maskAccountNumber } from '@/lib/finance-format';
import { dateRangeSchema, exportKindSchema, type ExportKind } from '@/lib/schemas/admin-tools';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;
const MAX_ROWS = 50_000;

type Row = Record<string, unknown>;

interface Source {
  table: string;
  select: string;
  /** Column the date range applies to (also the sort key). */
  dateColumn: string;
  /** Extra equality filter [column, value]. */
  eq?: [string, string];
  map: (row: Row) => CsvValue[];
}

const one = (value: unknown): Row | null =>
  (Array.isArray(value) ? (value[0] as Row | undefined) ?? null : (value as Row | null)) ?? null;
const str = (value: unknown) => (value === null || value === undefined ? null : String(value));
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const centavos = (value: unknown) => (value === null || value === undefined ? null : Number(value) / 100);

function partnerName(profile: Row | null) {
  const org = one(profile?.organizer_profiles);
  const trans = one(profile?.transporter_profiles);
  return str(org?.company_name ?? trans?.company_name ?? org?.display_name ?? trans?.display_name ?? profile?.full_name);
}

const EXPORTS: Record<ExportKind, { header: string[]; sources: Source[] }> = {
  bookings: {
    header: ['booking_ref', 'created_at', 'status', 'dispute_status', 'seats', 'total_amount_php', 'organizer_fee_percent',
      'tour', 'organizer', 'start_date', 'end_date'],
    sources: [{
      table: 'bookings',
      dateColumn: 'created_at',
      select: `id, booking_ref, created_at, status, dispute_status, seats, total_amount, organizer_fee_percent,
        tour_schedules ( start_date, end_date, tours ( title, organizer_profiles ( display_name, company_name ) ) )`,
      map: (r) => {
        const s = one(r.tour_schedules);
        const t = one(s?.tours);
        const o = one(t?.organizer_profiles);
        return [str(r.booking_ref), str(r.created_at), str(r.status), str(r.dispute_status), num(r.seats), num(r.total_amount),
          num(r.organizer_fee_percent), str(t?.title), str(o?.company_name ?? o?.display_name), str(s?.start_date), str(s?.end_date)];
      },
    }],
  },
  payments: {
    header: ['provider_payment_id', 'payment_intent_id', 'booking_ref', 'status', 'review_reason', 'source', 'amount_php',
      'mdr_php', 'net_php', 'currency', 'created_at', 'resolved_at', 'resolution', 'provider_refund_id'],
    sources: [{
      table: 'booking_payments',
      dateColumn: 'created_at',
      select: `id, provider_payment_id, payment_intent_id, status, review_reason, source, amount_centavos, fee_centavos, currency,
        created_at, resolved_at, resolution, provider_refund_id, bookings ( booking_ref )`,
      map: (r) => [str(r.provider_payment_id), str(r.payment_intent_id), str(one(r.bookings)?.booking_ref), str(r.status),
        str(r.review_reason), str(r.source), centavos(r.amount_centavos), centavos(r.fee_centavos),
        (Number(r.amount_centavos) - Number(r.fee_centavos ?? 0)) / 100, str(r.currency), str(r.created_at), str(r.resolved_at),
        str(r.resolution), str(r.provider_refund_id)],
    }],
  },
  refunds: {
    header: ['refund_type', 'id', 'booking_ref', 'amount_php', 'reason', 'initiated_role', 'status', 'provider_refund_id',
      'created_at', 'completed_at'],
    sources: [
      {
        table: 'booking_refunds',
        dateColumn: 'created_at',
        select: 'id, amount, reason, initiated_role, status, provider_refund_id, created_at, updated_at, bookings ( booking_ref )',
        map: (r) => ['booking_refund', str(r.id), str(one(r.bookings)?.booking_ref), num(r.amount), str(r.reason),
          str(r.initiated_role), str(r.status), str(r.provider_refund_id), str(r.created_at),
          r.status === 'succeeded' ? str(r.updated_at) : null],
      },
      {
        table: 'booking_payments',
        dateColumn: 'resolved_at',
        eq: ['resolution', 'refunded'],
        select: 'id, amount_centavos, review_reason, provider_refund_id, created_at, resolved_at, bookings ( booking_ref )',
        map: (r) => ['payment_review_refund', str(r.id), str(one(r.bookings)?.booking_ref), centavos(r.amount_centavos),
          str(r.review_reason), 'admin', 'succeeded', str(r.provider_refund_id), str(r.created_at), str(r.resolved_at)],
      },
    ],
  },
  payouts: {
    header: ['payout_id', 'created_at', 'updated_at', 'status', 'amount_php', 'partner', 'method', 'bank_name', 'account_name',
      'account_number_masked', 'approved_at', 'approved_by', 'admin_notes'],
    sources: [{
      table: 'payout_requests',
      dateColumn: 'created_at',
      select: `id, created_at, updated_at, status, amount, payout_method, approved_at, admin_notes,
        approver:user_profiles!approved_by ( full_name ),
        user_wallets ( user_profiles ( full_name, organizer_profiles ( company_name, display_name ), transporter_profiles ( company_name, display_name ) ) )`,
      map: (r) => {
        const method = (r.payout_method ?? {}) as Row;
        const owner = one(one(r.user_wallets)?.user_profiles);
        return [str(r.id), str(r.created_at), str(r.updated_at), str(r.status), num(r.amount), partnerName(owner),
          str(method.method), str(method.bank_name), str(method.account_name),
          maskAccountNumber(str(method.account_number ?? method.account)), str(r.approved_at),
          str(one(r.approver)?.full_name), str(r.admin_notes)];
      },
    }],
  },
  ledger: {
    header: ['id', 'created_at', 'wallet_id', 'wallet_owner', 'type', 'balance_affected', 'amount_php', 'fee_amount_php',
      'reference_type', 'reference_id', 'description'],
    sources: [{
      table: 'wallet_transactions',
      dateColumn: 'created_at',
      select: `id, created_at, wallet_id, type, balance_affected, amount, fee_amount, reference_type, reference_id, description,
        user_wallets ( user_profiles ( full_name, organizer_profiles ( company_name, display_name ), transporter_profiles ( company_name, display_name ) ) )`,
      map: (r) => [str(r.id), str(r.created_at), str(r.wallet_id), partnerName(one(one(r.user_wallets)?.user_profiles)), str(r.type),
        str(r.balance_affected), num(r.amount), num(r.fee_amount), str(r.reference_type), str(r.reference_id), str(r.description)],
    }],
  },
};

function manilaBounds(from: string, to: string) {
  const end = new Date(`${to}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: new Date(`${from}T00:00:00+08:00`).toISOString(), end: end.toISOString() };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  let adminProfileId: string;
  try {
    const { user, profile } = await requireSession();
    try {
      await assertRole(user.id, 'admin');
    } catch {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    try {
      await assertRateLimit(profile.id, 'mutation');
    } catch (error: unknown) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Too many requests' }, { status: 429 });
    }
    adminProfileId = profile.id as string;
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const kindResult = exportKindSchema.safeParse((await params).kind);
  if (!kindResult.success) {
    return NextResponse.json({ success: false, error: 'Unknown export' }, { status: 404 });
  }
  const today = manilaToday();
  const range = dateRangeSchema.safeParse({
    from: request.nextUrl.searchParams.get('from') ?? undefined,
    to: request.nextUrl.searchParams.get('to') ?? undefined,
  });
  if (!range.success) {
    return NextResponse.json({ success: false, error: range.error.issues[0]?.message ?? 'Invalid range' }, { status: 400 });
  }
  const kind = kindResult.data;
  const from = range.data.from ?? `${today.slice(0, 7)}-01`;
  const to = range.data.to ?? today;
  const { start, end } = manilaBounds(from, to);
  const spec = EXPORTS[kind];

  await logMutation({
    adminProfileId,
    entityType: 'export',
    entityId: adminProfileId,
    action: `export_${kind}`,
    notes: `CSV export ${kind} ${from}..${to}`,
  });

  // Service role: admin finance export, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const encoder = new TextEncoder();
  let sourceIndex = 0;
  let offset = 0;
  let written = 0;
  let headerSent = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(encoder.encode(`﻿${csvLine(spec.header)}`));
          return;
        }
        const source = spec.sources[sourceIndex];
        if (!source || written >= MAX_ROWS) {
          if (written >= MAX_ROWS) controller.enqueue(encoder.encode(csvLine([`# truncated at ${MAX_ROWS} rows; narrow the date range`])));
          controller.close();
          return;
        }
        let query = admin
          .from(source.table)
          .select(source.select)
          .gte(source.dateColumn, start)
          .lt(source.dateColumn, end);
        if (source.eq) query = query.eq(source.eq[0], source.eq[1]);
        const size = Math.min(PAGE_SIZE, MAX_ROWS - written);
        const { data, error } = await query
          .order(source.dateColumn, { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + size - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as Row[];
        if (rows.length > 0) {
          controller.enqueue(encoder.encode(rows.map((row) => csvLine(source.map(row))).join('')));
          written += rows.length;
        }
        if (rows.length < size) {
          sourceIndex += 1;
          offset = 0;
        } else {
          offset += rows.length;
        }
      } catch (error: unknown) {
        captureException(error, { action: 'adminExport', kind });
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="travi-${kind}-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
