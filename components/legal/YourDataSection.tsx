import type { SupabaseClient } from '@supabase/supabase-js';
import YourDataCard from '@/components/dashboard/YourDataCard';
import { deletionRetentionNote, listOwnDataRequests } from '@/lib/legal/privacy';

// Server wrapper for the "Your data" card on the traveler/organizer/transporter profile pages.
export default async function YourDataSection({ supabase, userProfileId }: { supabase: SupabaseClient; userProfileId: string }) {
  const requests = await listOwnDataRequests(supabase, userProfileId);
  return <YourDataCard initialRequests={requests} retentionNote={deletionRetentionNote()} />;
}
