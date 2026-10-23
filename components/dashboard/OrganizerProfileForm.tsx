'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { updateOrganizerProfile } from '@/actions/organizer';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PartnerKycFields, { lockedKycFields } from './PartnerKycFields';

export type OrganizerProfile = {
  id: string;
  organizer_type: string;
  company_name: string | null;
  display_name: string;
  description: string | null;
  phone: string;
  address: string | null;
  provides_transport: boolean;
  status: string;
  legal_name: string | null;
  tin: string | null;
  business_registration_no: string | null;
  dot_accreditation_no: string | null;
  public_contact_email: string | null;
  user_profiles: { email: string } | { email: string }[] | null;
};

export default function OrganizerProfileForm({ profile }: { profile: OrganizerProfile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const userProfile = Array.isArray(profile.user_profiles) ? profile.user_profiles[0] : profile.user_profiles;
  const locked = lockedKycFields(profile.status, {
    type: profile.organizer_type,
    companyName: profile.company_name,
    legalName: profile.legal_name,
    tin: profile.tin,
    businessRegistrationNo: profile.business_registration_no,
    accreditationNo: profile.dot_accreditation_no,
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await updateOrganizerProfile(new FormData(e.currentTarget));
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(res.resubmitted ? 'Profile saved and sent for review again.' : 'Profile saved.');
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h5 className="card-title">Business Details</h5>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <StatusBadge status={profile.status} label={profile.status === 'pending' ? 'Pending review' : undefined} />
        </div>
      </div>

      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="lightsuccess">
          <CheckCircle2 />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {profile.status === 'approved' && locked.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Verified business details are locked. Contact support if they need to change.
        </p>
      )}
      {profile.status === 'rejected' && (
        <p className="text-sm text-muted-foreground">Changing your business details sends your application for review again.</p>
      )}

      <PartnerKycFields
        partner="organizer"
        idPrefix="org"
        locked={locked}
        defaults={{
          type: profile.organizer_type,
          companyName: profile.company_name,
          legalName: profile.legal_name,
          tin: profile.tin,
          businessRegistrationNo: profile.business_registration_no,
          accreditationNo: profile.dot_accreditation_no,
        }}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-displayName">Display name *</Label>
          <Input id="org-displayName" type="text" name="displayName" required defaultValue={profile.display_name} />
        </div>

        <div className="flex items-center md:mt-7">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="providesTransport"
              defaultChecked={profile.provides_transport}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium text-foreground">We provide our own transportation</span>
          </label>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="org-description">Business description</Label>
          <Textarea id="org-description" name="description" rows={4} defaultValue={profile.description || ''} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="org-address">Address</Label>
          <Textarea id="org-address" name="address" rows={2} defaultValue={profile.address || ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-publicContactEmail">Customer contact email *</Label>
          <Input
            id="org-publicContactEmail"
            type="email"
            name="publicContactEmail"
            required
            defaultValue={profile.public_contact_email || userProfile?.email || ''}
            aria-describedby="org-publicContactEmail-hint"
          />
          <p id="org-publicContactEmail-hint" className="text-xs text-muted-foreground">Shown to travelers on your tour pages.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone">Contact phone *</Label>
          <Input id="org-phone" type="tel" name="phone" required defaultValue={profile.phone} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="org-email">Account email</Label>
          <Input
            id="org-email"
            type="email"
            defaultValue={userProfile?.email || ''}
            disabled
            className="bg-muted/50 text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
