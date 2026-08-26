import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default async function BookingSuccessPage({ params }: { params: Promise<{ slug: string, bookingId: string }> }) {
  const { slug, bookingId } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 bg-white rounded-2xl shadow-sm text-center">
          <p className="text-slate-500 mb-4">Please log in to view this booking.</p>
          <Link href="/login" className="text-coral font-bold hover:underline">Go to Login</Link>
        </div>
      </div>
    );
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      tour_schedules (
        start_date,
        end_date,
        tours (
          title,
          location,
          slug
        )
      )
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    console.error("Error fetching booking:", error);
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-grow flex items-center justify-center py-20 px-4">
        <div className="max-w-xl w-full bg-white p-8 md:p-12 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 font-display">Booking Successful!</h1>
          <p className="text-slate-500 mb-8">Your tour has been booked. We've sent a confirmation email with all the details.</p>
          
          <div className="bg-slate-50 rounded-2xl p-6 text-left mb-8 border border-slate-100">
            <div className="font-bold text-slate-900 mb-4 pb-4 border-b border-slate-200 text-lg">
              {booking.tour_schedules.tours.title}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-slate-500 mb-1">Dates</span>
                <span className="font-semibold text-slate-900">
                  {new Date(booking.tour_schedules.start_date).toLocaleDateString()} - {new Date(booking.tour_schedules.end_date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Guests</span>
                <span className="font-semibold text-slate-900">{booking.seats}</span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                  {booking.status}
                </span>
              </div>
              <div>
                <span className="block text-slate-500 mb-1">Total Amount</span>
                <span className="font-bold text-coral text-lg">₱{booking.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href={`/tours/${booking.tour_schedules.tours.slug}`}
              className="px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
            >
              Back to Tour
            </Link>
            <Link 
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-coral text-white font-bold hover:bg-coral-dark transition-colors shadow-lg shadow-coral/30 flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
