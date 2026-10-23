import Link from 'next/link';
import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ArrowLeft, CalendarDays, MapPin, Receipt, Route, Users } from 'lucide-react';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { manilaToday } from '@/lib/datetime';
import BookingDetailActions from '@/components/traveler/BookingDetailActions';
import { bookingFlags, formatDate, formatPeso } from '@/components/traveler/bookingRules';
import CardBox from '@/components/ui/CardBox';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Itinerary = { day_number: number; title: string | null; description: string | null; deleted_at: string | null };
type Tour = {
  title: string;
  slug: string;
  location: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  travel_time_info: string | null;
  accommodation_details: string | null;
  format: string | null;
  duration_days: number | null;
  organizer: { display_name: string | null; company_name: string | null } | null;
  tour_itineraries: Itinerary[] | null;
};
type Schedule = { start_date: string; end_date: string; status: string; tours: Tour | null };
type Payment = { amount_centavos: number; status: string; created_at: string; provider_payment_id: string };
type Refund = { amount: number; status: string; reason: string; created_at: string };

const REFUND_REASONS: Record<string, string> = {
  traveler_cancel: 'You canceled the booking',
  organizer_cancel: 'The organizer canceled this date',
  dispute_refund: 'Dispute resolved in your favor',
  admin_refund: 'Refund issued by Travi support',
};

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default async function TravelerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const session = await requireSession().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!session) redirect(`/login?next=${encodeURIComponent(`/dashboard/traveler/bookings/${id}`)}`);

  // Service role: booking_payments / booking_refunds are service-role only. Every read below is
  // scoped to a booking the signed-in traveler owns (checked first). AGENTS.md §5.3.
  const admin = createAdminClient({ admin: true });
  const { data: row, error } = await admin
    .from('bookings')
    .select(`
      id, booking_ref, traveler_id, seats, total_amount, status, dispute_status, dispute_reason, dispute_opened_at, created_at,
      tour_schedules (
        start_date, end_date, status,
        tours (
          title, slug, location, city, province, latitude, longitude, travel_time_info, accommodation_details, format, duration_days,
          organizer:organizer_profiles ( display_name, company_name ),
          tour_itineraries ( day_number, title, description, deleted_at )
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) captureException(error, { action: 'TravelerBookingDetailPage', bookingId: id });
  if (!row || row.traveler_id !== session.profile.id) notFound();

  const [{ data: payments }, { data: refunds }, { data: settings }] = await Promise.all([
    admin.from('booking_payments').select('amount_centavos, status, created_at, provider_payment_id').eq('booking_id', id).order('created_at'),
    admin.from('booking_refunds').select('amount, status, reason, created_at').eq('booking_id', id).order('created_at'),
    admin.from('platform_settings').select('escrow_holding_days').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const schedule = one(row.tour_schedules as unknown as Schedule | Schedule[] | null);
  const tour = one(schedule?.tours ?? null);
  const organizer = one(tour?.organizer ?? null);
  const itinerary = (tour?.tour_itineraries ?? []).filter((d) => !d.deleted_at).sort((a, b) => a.day_number - b.day_number);
  const appliedPayments = ((payments as Payment[] | null) ?? []).filter((p) => p.status === 'applied');
  const refundRows = (refunds as Refund[] | null) ?? [];
  const label = row.booking_ref ?? row.id.slice(0, 8).toUpperCase();
  const isPrivate = tour?.format === 'private';
  const place = [tour?.location, tour?.city, tour?.province].filter(Boolean).join(', ');
  const mapUrl = tour?.latitude != null && tour?.longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${tour.latitude},${tour.longitude}`
    : null;

  const flags = bookingFlags(
    { status: row.status, dispute_status: row.dispute_status, start_date: schedule?.start_date ?? null, end_date: schedule?.end_date ?? null },
    manilaToday(),
    Number(settings?.escrow_holding_days ?? 3)
  );

  return (
    <>
      <PageHeader
        title={`Booking ${label}`}
        description={tour?.title}
        breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard/traveler' },
          { title: 'My Bookings', href: '/dashboard/traveler/bookings' },
          { title: label },
        ]}
        actions={
          <Button asChild variant="neutral" className="print:hidden">
            <Link href="/dashboard/traveler/bookings">
              <ArrowLeft />
              All bookings
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 lg:col-span-8">
          <CardBox>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status} />
              {row.dispute_status !== 'none' && (
                <StatusBadge
                  status={row.dispute_status === 'open' ? 'pending' : row.dispute_status}
                  label={`Dispute: ${String(row.dispute_status).replaceAll('_', ' ')}`}
                />
              )}
              {schedule?.status === 'cancelled' && <StatusBadge status="cancelled" label="Date cancelled by organizer" />}
            </div>

            {row.status === 'pending' && flags.canPay && (
              <Alert variant="lightwarning">
                <AlertTitle>Awaiting payment</AlertTitle>
                <AlertDescription>Unpaid bookings are held for 15 minutes. Pay now to confirm your {isPrivate ? 'date' : 'seats'}.</AlertDescription>
              </Alert>
            )}

            <BookingDetailActions
              booking={{ id: row.id, label, status: row.status, totalAmount: Number(row.total_amount) }}
              canPay={flags.canPay}
              canCancel={flags.canCancel}
              canDispute={flags.canDispute}
              payHref={`/tours/${tour?.slug}/booking/${row.id}/pay`}
            />
          </CardBox>

          <CardBox>
            <h2 className="card-title">Trip</h2>
            <dl className="divide-y divide-border">
              <Row label="Tour">
                {tour ? <Link href={`/tours/${tour.slug}`} className="text-primary hover:underline">{tour.title}</Link> : 'Unknown tour'}
              </Row>
              <Row label="Organizer">{organizer?.company_name || organizer?.display_name || 'Local organizer'}</Row>
              <Row label="Dates">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                  {formatDate(schedule?.start_date)} – {formatDate(schedule?.end_date)}
                </span>
              </Row>
              <Row label={isPrivate ? 'Group' : 'Guests'}>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                  {isPrivate ? `Private group of up to ${row.seats}` : `${row.seats} ${row.seats === 1 ? 'guest' : 'guests'}`}
                </span>
              </Row>
              <Row label="Meeting point / location">
                <span className="inline-flex flex-col items-end gap-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                    {place || 'Shared by the organizer before the trip'}
                  </span>
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline print:hidden">
                      Open in Google Maps
                    </a>
                  )}
                </span>
              </Row>
              {tour?.travel_time_info && <Row label="Getting there">{tour.travel_time_info}</Row>}
              {tour?.accommodation_details && <Row label="Accommodation">{tour.accommodation_details}</Row>}
            </dl>
          </CardBox>

          <CardBox>
            <h2 className="card-title flex items-center gap-2">
              <Route className="size-5 text-primary" aria-hidden="true" /> Itinerary
            </h2>
            {itinerary.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">The organizer hasn&apos;t published a day-by-day itinerary.</p>
            ) : (
              <ol className="space-y-4">
                {itinerary.map((day) => (
                  <li key={day.day_number} className="border-l-2 border-primary pl-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">Day {day.day_number}</div>
                    <div className="font-semibold text-foreground">{day.title}</div>
                    {day.description && <p className="mt-1 whitespace-pre-line text-sm text-bodytext">{day.description}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardBox>

          {row.dispute_status !== 'none' && (
            <CardBox>
              <h2 className="card-title">Your dispute</h2>
              <p className="text-sm text-muted-foreground">
                Opened {row.dispute_opened_at ? new Date(row.dispute_opened_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : ''}
              </p>
              {row.dispute_reason && <p className="whitespace-pre-line text-sm text-bodytext">{row.dispute_reason}</p>}
            </CardBox>
          )}
        </div>

        <div className="col-span-12 lg:col-span-4">
          <CardBox>
            <h2 className="card-title flex items-center gap-2">
              <Receipt className="size-5 text-primary" aria-hidden="true" /> Receipt
            </h2>
            <dl className="divide-y divide-border">
              <Row label="Booking reference"><span className="font-mono">{label}</span></Row>
              <Row label="Booked on">{new Date(row.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })}</Row>
              <Row label={isPrivate ? 'Private group' : `${row.seats} × per person`}>{formatPeso(row.total_amount)}</Row>
              <Row label="Service fee">{formatPeso(0)}</Row>
              <Row label="Total">{formatPeso(row.total_amount)}</Row>
            </dl>

            <h3 className="mt-2 text-sm font-semibold text-foreground">Payments</h3>
            {appliedPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{row.status === 'pending' ? 'Not paid yet.' : 'No payment recorded.'}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {appliedPayments.map((p) => (
                  <li key={p.provider_payment_id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      Paid {new Date(p.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })}
                    </span>
                    <span className="font-medium text-foreground">{formatPeso(p.amount_centavos / 100)}</span>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-2 text-sm font-semibold text-foreground">Refunds</h3>
            {refundRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No refunds.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {refundRows.map((r, i) => (
                  <li key={`${r.created_at}-${i}`} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block text-foreground">{REFUND_REASONS[r.reason] ?? 'Refund'}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' })} ·{' '}
                        {r.status === 'succeeded' ? 'refunded' : r.status === 'pending' ? 'processing' : 'failed, our team will retry'}
                      </span>
                    </span>
                    <span className="font-medium text-foreground">{formatPeso(r.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Payments are processed by PayMongo (GCash / Maya). Refunds go back to the original payment method and can take a few
              business days to appear.
            </p>
          </CardBox>
        </div>
      </div>
    </>
  );
}
