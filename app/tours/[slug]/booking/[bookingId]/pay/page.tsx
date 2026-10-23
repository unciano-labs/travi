import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import PaymentSelectionClient from '@/components/landing/PaymentSelectionClient';

// Pending bookings are canceled by pg_cron after this many minutes (expire_pending_bookings()).
const HOLD_MINUTES = 15;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function Notice({ title, message, href, cta }: { title: string; message: string; href: string; cta: string }) {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">{title}</h1>
      <p className="text-slate-500 mb-6">{message}</p>
      <Link href={href} className="block w-full py-3 px-4 bg-coral hover:bg-coral/90 text-white text-center rounded-xl font-bold transition-colors">
        {cta}
      </Link>
    </Shell>
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
    .select('id, booking_ref, total_amount, seats, status, traveler_id, created_at, tour_schedules ( start_date, end_date, tours ( title, slug, format ) )')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) captureException(error, { action: 'PaymentPage fetch', bookingId });
  if (!booking || booking.traveler_id !== session.profile.id) {
    return <Notice title="Booking not found" message="We couldn't find this booking on your account." href="/dashboard/traveler/bookings" cta="Go to my bookings" />;
  }

  const schedule = booking.tour_schedules as unknown as { start_date: string; end_date: string; tours: { title: string; slug: string; format: string } } | null;
  const tourTitle = schedule?.tours?.title || 'Tour Booking';
  const tourSlug = schedule?.tours?.slug || slug;
  const detailHref = `/dashboard/traveler/bookings/${booking.id}`;

  // BIZ-18: only pending bookings can be paid; say clearly why anything else can't.
  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return <Notice title="Already paid" message={`Booking ${booking.booking_ref} for ${tourTitle} is already paid and confirmed.`} href={detailHref} cta="View booking" />;
  }
  if (booking.status === 'refunded') {
    return <Notice title="Booking refunded" message={`Booking ${booking.booking_ref} was refunded and can't be paid again.`} href={detailHref} cta="View booking" />;
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
  const holdLabel = holdUntil.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
  const isPrivate = schedule?.tours?.format === 'private';

  return (
    <Shell>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">Complete Payment</h1>
      <p className="text-slate-500 text-sm mb-2">
        You are booking{' '}
        <strong>{isPrivate ? `a private group of up to ${booking.seats}` : `${booking.seats} seat${booking.seats === 1 ? '' : 's'}`}</strong>{' '}
        for <strong>{tourTitle}</strong>.
      </p>
      <p className="text-slate-500 text-xs mb-6">
        Booking {booking.booking_ref}. Your {isPrivate ? 'date is' : 'seats are'} held until {holdLabel} (Manila time).
      </p>

      <div className="mb-8 p-4 bg-slate-50 rounded-xl flex justify-between items-center">
        <span className="text-slate-600 font-medium">Total Amount</span>
        <span className="text-2xl font-black text-brand-navy">
          ₱{Number(booking.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>

      <PaymentSelectionClient bookingId={booking.id} />
    </Shell>
  );
}
