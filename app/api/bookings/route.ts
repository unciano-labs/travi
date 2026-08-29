import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth, assertApiRole } from '@/lib/api-auth';
import { createBookingService } from '@/lib/services/bookings';
import { createBookingSchema } from '@/lib/schemas/booking';
import { captureException } from '@/lib/logger';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const { profile, supabase } = await verifyApiAuth(request);
    await assertApiRole(supabase, profile.id, 'traveler');

    const body = await request.json();
    const validated = createBookingSchema.parse(body);

    const bookingResult = await createBookingService(supabase, profile.id, validated);

    return NextResponse.json({ success: true, data: bookingResult }, { status: 201 });
  } catch (error: any) {
    captureException(error, { action: 'POST /api/bookings' });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: (error as any).errors[0].message }, { status: 400 });
    }

    const isConflict = error.message.includes('Not enough seats') || error.message.includes('not found');
    const status = isConflict ? 409 : (error.message.includes('Forbidden') || error.message.includes('Invalid') ? 401 : 500);

    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
