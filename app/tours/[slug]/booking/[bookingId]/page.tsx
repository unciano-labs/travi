import { notFound, redirect, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Booking link used in emails (`/tours/<slug>/booking/<id>`). The booking detail, receipt and actions
 * live in the traveler dashboard, so the owner is sent there; pending bookings go to payment.
 */
export default async function BookingLinkPage({ params }: { params: Promise<{ slug: string; bookingId: string }> }) {
  const { slug, bookingId } = await params;
  if (!z.string().uuid().safeParse(bookingId).success) notFound();

  const session = await requireSession().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/tours/${slug}/booking/${bookingId}`)}`);
  }

  // Service role: ownership is checked right below (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const { data: booking } = await admin
    .from('bookings')
    .select('id, status, traveler_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking || booking.traveler_id !== session.profile.id) notFound();

  if (booking.status === 'pending') redirect(`/tours/${slug}/booking/${booking.id}/pay`);
  redirect(`/dashboard/traveler/bookings/${booking.id}`);
}
