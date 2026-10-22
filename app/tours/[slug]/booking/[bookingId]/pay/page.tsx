import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import PaymentSelectionClient from '@/components/landing/PaymentSelectionClient';

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/tours/${slug}`);
  }

  const { requireSession } = await import('@/lib/auth-helpers');
  const { profile } = await requireSession();

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient({ admin: true });

  // Fetch the booking details
  const { data: booking, error } = await admin
    .from('bookings')
    .select(`
      id, total_amount, seats, traveler_id,
      tour_schedules (
        tours ( title )
      )
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking || booking.traveler_id !== profile.id) {
    if (error) console.error('Booking fetch error:', error);
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-slate-500">
            Booking not found or unavailable. {error?.message}
          </div>
        </main>
      </div>
    );
  }

  const tourTitle = (booking.tour_schedules as any)?.tours?.title || 'Tour Booking';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl">
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">Complete Payment</h1>
          <p className="text-slate-500 text-sm mb-6">
            You are booking <strong>{booking.seats} seats</strong> for <strong>{tourTitle}</strong>.
          </p>

          <div className="mb-8 p-4 bg-slate-50 rounded-xl flex justify-between items-center">
            <span className="text-slate-600 font-medium">Total Amount</span>
            <span className="text-2xl font-black text-brand-navy">
              ₱{Number(booking.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <PaymentSelectionClient bookingId={booking.id} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
