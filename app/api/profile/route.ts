import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth } from '@/lib/api-auth';
import { captureException } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { profile, supabase } = await verifyApiAuth(request);

    // Fetch the full profile details
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('*, organizer_profiles(*), transporter_profiles(*)')
      .eq('id', profile.id)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: userProfile }, { status: 200 });
  } catch (error: any) {
    captureException(error, { action: 'GET /api/profile' });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('Invalid') || error.message.includes('Missing') ? 401 : 500 }
    );
  }
}
