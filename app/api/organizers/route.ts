import { NextRequest, NextResponse } from 'next/server';
import { verifyApiAuth, assertApiRole } from '@/lib/api-auth';
import { captureException } from '@/lib/logger';
import { z } from 'zod';

const createOrganizerSchema = z.object({
  companyName: z.string().optional(),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  phone: z.string().optional(),
  type: z.enum(['individual', 'company']).default('individual'),
  providesTransportation: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const { profile, supabase } = await verifyApiAuth(request);
    await assertApiRole(supabase, profile.id, 'organizer');

    const body = await request.json();
    const validated = createOrganizerSchema.parse(body);

    if (validated.type === 'company' && !validated.companyName) {
      return NextResponse.json({ success: false, error: 'Company name is required for company type' }, { status: 400 });
    }

    const { data: organizer, error } = await supabase
      .from('organizer_profiles')
      .insert({
        user_profile_id: profile.id,
        company_name: validated.companyName || null,
        display_name: validated.displayName,
        description: validated.description,
        phone_number: validated.phone,
        type: validated.type,
        provides_transportation: validated.providesTransportation,
        status: 'pending' // Requires admin approval
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: organizer }, { status: 201 });
  } catch (error: any) {
    captureException(error, { action: 'POST /api/organizers' });
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: (error as any).errors[0].message }, { status: 400 });
    }
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('Forbidden') || error.message.includes('Invalid') ? 401 : 500 }
    );
  }
}
