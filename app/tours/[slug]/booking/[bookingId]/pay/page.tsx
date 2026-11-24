import Image from 'next/image';
import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { formatDateRange, formatPHP, formatTimeOfInstant } from '@/lib/format';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import PaymentSelectionClient from '@/components/landing/PaymentSelectionClient';

// Pending bookings are canceled by pg_cron after this many minutes (expire_pending_bookings()).
const HOLD_MINUTES = 15;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

interface PaymentScheduleRow {
  start_date: string;
  end_date: string;
  price_per_person: number | string | null;
  tours: {
    title: string;
    slug: string;
    format: string;
    location: string | null;
    city: string | null;
    province: string | null;
    cover_image_url: string | null;
    duration_days: number | null;
    price_per_person: number | string | null;
    organizer: {
      display_name: string | null;
      company_name: string | null;
    } | null;
  } | null;
}

function NoticeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="bg-brand-navy h-16 lg:h-20 shrink-0" aria-hidden="true" />
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Notice({ title, message, href, cta }: { title: string; message: string; href: string; cta: string }) {
  return (
    <NoticeShell>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-2">{title}</h1>
      <p className="text-slate-600 text-sm mb-6 leading-relaxed">{message}</p>
      <Link
        href={href}
        className="block w-full py-3 px-4 bg-coral hover:bg-coral-dark text-white text-center rounded-xl font-bold transition-colors"
      >
        {cta}
      </Link>
    </NoticeShell>
  );
}

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;

  const session = await requireSession().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/tours/${slug}/booking/${bookingId}/pay`)}`);
  }

  // Service role: read the booking for the ownership check below (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const { data: booking, error } = await admin
    .from('bookings')
    .select(
      'id, booking_ref, total_amount, seats, status, traveler_id, created_at, tour_schedules ( start_date, end_date, price_per_person, tours ( title, slug, format, location, city, province, cover_image_url, duration_days, price_per_person, organizer:organizer_profiles ( display_name, company_name ) ) )'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error) captureException(error, { action: 'PaymentPage fetch', bookingId });
  if (!booking || booking.traveler_id !== session.profile.id) {
    return (
      <Notice
        title="Booking not found"
        message="We couldn't find this booking on your account."
        href="/dashboard/traveler/bookings"
        cta="Go to my bookings"
      />
    );
  }

  const schedule = booking.tour_schedules as unknown as PaymentScheduleRow | null;
  const tour = schedule?.tours ?? null;
  const tourTitle = tour?.title || 'Tour Booking';
  const tourSlug = tour?.slug || slug;
  const detailHref = `/dashboard/traveler/bookings/${booking.id}`;

  // BIZ-18: only pending bookings can be paid; say clearly why anything else can't.
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return (
      <Notice
        title="Already paid"
        message={`Booking ${booking.booking_ref} for ${tourTitle} is already paid and confirmed.`}
        href={detailHref}
        cta="View booking"
      />
    );
  }
  if (booking.status === 'refunded') {
    return (
      <Notice
        title="Booking refunded"
        message={`Booking ${booking.booking_ref} was refunded and can't be paid again.`}
        href={detailHref}
        cta="View booking"
      />
    );
  }
  if (booking.status !== 'pending') {
    return (
      <Notice
        title="This booking can no longer be paid"
        message={`Booking ${booking.booking_ref} was canceled. Unpaid bookings hold your seats for ${HOLD_MINUTES} minutes; please book again.`}
        href={`/tours/${tourSlug}`}
        cta="Book again"
      />
    );
  }

  const holdUntil = new Date(new Date(booking.created_at).getTime() + HOLD_MINUTES * 60_000);
  const holdLabel = formatTimeOfInstant(holdUntil);
  const isPrivate = tour?.format === 'private';
  const organizerName = tour?.organizer?.company_name || tour?.organizer?.display_name || 'Verified Organizer';
  const place = tour?.city && tour?.province ? `${tour.city}, ${tour.province}` : tour?.location || 'Philippines';
  const durationDays = tour?.duration_days ?? 1;
  const unitPrice = Number(schedule?.price_per_person ?? tour?.price_per_person ?? 0);
  const totalFormatted = formatPHP(booking.total_amount);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Top Navy Banner: gives the fixed Header proper contrast and separation above the checkout card */}
      <section className="bg-brand-navy pt-24 pb-10 lg:pt-28 lg:pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Link
              href={`/tours/${tourSlug}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-200 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to tour details
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Secure Checkout
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Complete Payment</h1>
          <p className="text-slate-300 text-sm mt-1.5">
            Booking <span className="font-mono font-semibold text-white">{booking.booking_ref}</span> · Confirm your{' '}
            {isPrivate ? 'private tour date' : `${booking.seats} seat${booking.seats === 1 ? '' : 's'}`} below.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* Left: Payment Selection */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 flex items-center gap-3 text-xs sm:text-sm text-amber-900">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>
                Your {isPrivate ? 'date is' : 'seats are'} held until <strong>{holdLabel}</strong> (Manila time). Complete payment to lock in your spot.
              </span>
            </div>

            <PaymentSelectionClient bookingId={booking.id} totalAmountLabel={totalFormatted} />
          </div>

          {/* Right: Order Summary & Trust Card */}
          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <h2 className="text-base font-extrabold text-slate-900 mb-4">Booking Summary</h2>

              <div className="flex gap-3.5 pb-4 border-b border-slate-100">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <Image
                    src={tour?.cover_image_url || FALLBACK_IMAGE}
                    alt={tourTitle}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">{tourTitle}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">{place}</span>
                  </p>
                  <p className="text-xs text-slate-700 font-semibold flex items-center gap-1 mt-1">
                    <span className="truncate">{organizerName}</span>
                    <BadgeCheck className="w-3.5 h-3.5 fill-sky-500 text-white shrink-0" aria-hidden="true" />
                    <span className="sr-only">Verified organizer</span>
                  </p>
                </div>
              </div>

              <dl className="py-4 space-y-3 text-sm border-b border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500">Booking ref</dt>
                  <dd className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md">
                    {booking.booking_ref}
                  </dd>
                </div>
                {schedule?.start_date && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      Dates
                    </dt>
                    <dd className="font-semibold text-slate-800 text-right">
                      {formatDateRange(schedule.start_date, schedule.end_date)}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    Duration
                  </dt>
                  <dd className="font-semibold text-slate-800">
                    {durationDays} day{durationDays > 1 ? 's' : ''}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" aria-hidden="true" />
                    {isPrivate ? 'Group' : 'Guests'}
                  </dt>
                  <dd className="font-semibold text-slate-800">
                    {isPrivate ? `Private (up to ${booking.seats} pax)` : `${booking.seats} guest${booking.seats === 1 ? '' : 's'}`}
                  </dd>
                </div>
              </dl>

              <div className="pt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    {unitPrice > 0
                      ? `${formatPHP(unitPrice, { cents: 'auto' })} × ${booking.seats} ${isPrivate ? 'pax capacity' : booking.seats === 1 ? 'guest' : 'guests'}`
                      : 'Tour package'}
                  </span>
                  <span className="font-semibold text-slate-800">{totalFormatted}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Travi booking fee</span>
                  <span className="font-semibold text-emerald-600">Free (₱0.00)</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="font-bold text-slate-900">Total Due</span>
                  <span className="text-2xl font-black text-brand-navy">{totalFormatted}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-brand" aria-hidden="true" />
                Travi Buyer Protection
              </h2>
              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-800">Escrow protection:</strong> Payment is held securely and released to the organizer only after your trip finishes.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-800">Free cancellation:</strong> Cancel before your departure date for a full refund.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-slate-800">Verified local partner:</strong> Screened and approved by Travi before listing.
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
