import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth, assertApiRole } from '@/lib/api-auth';
import { createTourService } from '@/lib/services/tours';
import { tourSchema } from '@/lib/schemas/tour';
import { captureException } from '@/lib/logger';
import { z } from 'zod';
import { getCachedPublicTours } from '@/lib/data/tours';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Call our existing optimized data fetcher for public tours
    const data = await getCachedPublicTours(offset, limit);
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: any) {
    captureException(error, { action: 'GET /api/tours' });
    return NextResponse.json({ success: false, error: 'Failed to fetch tours' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile, supabase } = await verifyApiAuth(request);
    await assertApiRole(supabase, profile.id, 'organizer');

    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id, status')
      .eq('user_profile_id', profile.id)
      .single();

    if (!organizerProfile) {
      return NextResponse.json({ success: false, error: 'Organizer profile required' }, { status: 403 });
    }
    
    if (organizerProfile.status !== 'approved') {
      return NextResponse.json({ success: false, error: 'Organizer application must be approved first' }, { status: 403 });
    }

    const body = await request.json();
    const validated = tourSchema.parse(body);

    const tourData = await createTourService(supabase, organizerProfile.id, validated);

    return NextResponse.json({ success: true, data: tourData }, { status: 201 });
  } catch (error: any) {
    captureException(error, { action: 'POST /api/tours' });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: (error as any).errors[0].message }, { status: 400 });
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('Forbidden') || error.message.includes('Invalid') ? 401 : 500 }
    );
  }
}
