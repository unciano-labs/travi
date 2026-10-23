import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { requireSession } from '@/lib/auth-helpers';
import { verifyBookingPayment } from '@/lib/services/payments';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;

  // Only the traveler who owns the booking may trigger its payment verification.
  const session = await requireSession().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/tours/${slug}/booking/${bookingId}/success`)}`);
  }

  const result = await verifyBookingPayment(bookingId, session.profile.id);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-100 shadow-xl text-center">
          {result.success && result.status === 'confirmed' ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">Payment Successful!</h1>
              <p className="text-slate-500 mb-8">Your booking has been confirmed. You will receive an email confirmation shortly.</p>
              
              <Link 
                href={`/dashboard/traveler/bookings/${bookingId}`}
                className="block w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                View Booking &amp; Receipt
              </Link>
            </>
          ) : result.success && result.status === 'pending' ? (
            <>
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">Processing Payment</h1>
              <p className="text-slate-500 mb-8">We are still verifying your payment with our provider. Please check your bookings dashboard in a few minutes.</p>
              
              <Link 
                href="/dashboard/traveler/bookings"
                className="block w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mb-2 font-display">Verification Failed</h1>
              <p className="text-slate-500 mb-8">{!result.success ? result.error : 'There was an issue verifying your payment.'}</p>
              
              <Link 
                href={`/tours/${slug}`}
                className="block w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Return to Tour
              </Link>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
