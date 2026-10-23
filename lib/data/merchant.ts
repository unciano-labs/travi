import { unstable_rethrow } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';

export interface OrganizerMerchantInfo {
  displayName: string;
  businessName: string | null; // registered company name (companies)
  legalName: string | null;    // registered/legal name of the merchant of record
  organizerType: 'individual' | 'company';
  contactEmail: string | null;
  dotAccreditationNo: string | null;
}

/**
 * LEG-06 (RA 11967 merchant transparency): the organizer's identity and customer contact for the
 * tour page, from the public-safe `public_organizer_profiles` view (approved organizers only).
 * Cached with the 'organizers' tag. Returns null when unavailable, so the page still renders.
 */
export const getCachedOrganizerMerchant = unstable_cache(
  async (organizerId: string): Promise<OrganizerMerchantInfo | null> => {
    try {
      const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase
        .from('public_organizer_profiles')
        .select('display_name, company_name, legal_name, organizer_type, public_contact_email, dot_accreditation_no')
        .eq('id', organizerId)
        .eq('status', 'approved')
        .maybeSingle();
      if (error) {
        captureException(error, { action: 'getCachedOrganizerMerchant', organizerId });
        return null;
      }
      if (!data) return null;
      return {
        displayName: data.display_name,
        businessName: data.organizer_type === 'company' ? data.company_name : null,
        legalName: data.legal_name,
        organizerType: data.organizer_type === 'company' ? 'company' : 'individual',
        contactEmail: data.public_contact_email,
        dotAccreditationNo: data.dot_accreditation_no,
      };
    } catch (err: unknown) {
      unstable_rethrow(err);
      captureException(err, { action: 'getCachedOrganizerMerchant', organizerId });
      return null;
    }
  },
  ['organizer-merchant-v1'],
  { tags: ['organizers'], revalidate: 3600 }
);
