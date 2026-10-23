'use client';

import { useState } from 'react';
import { updateTransporterProfile } from '@/actions/transporter';
import { Loader2, CheckCircle2, AlertCircle, Star, Phone, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PartnerKycFields, { lockedKycFields } from './PartnerKycFields';

type TransporterProfile = {
  id: string;
  transporter_type: string;
  company_name: string | null;
  display_name: string;
  description: string | null;
  phone: string;
  service_areas: string[] | null;
  status: string;
  average_rating: number;
  review_count: number;
  legal_name: string | null;
  tin: string | null;
  business_registration_no: string | null;
  ltfrb_franchise_no: string | null;
  user_profiles: {
    email: string;
  } | { email: string; }[] | null;
};

export default function TransporterProfileForm({ profile }: { profile: TransporterProfile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const locked = lockedKycFields(profile.status, {
    type: profile.transporter_type,
    companyName: profile.company_name,
    legalName: profile.legal_name,
    tin: profile.tin,
    businessRegistrationNo: profile.business_registration_no,
    accreditationNo: profile.ltfrb_franchise_no,
  });

  // Handle edge cases if relation returned array
  const userProfile = Array.isArray(profile.user_profiles) 
    ? profile.user_profiles[0] 
    : profile.user_profiles;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    const res = await updateTransporterProfile(formData);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.resubmitted ? 'Profile saved and sent for review again.' : 'Transporter profile updated successfully.');
      router.refresh();
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(res.error);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Top Reputation & Status Bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h5 className="card-title">Business Details</h5>
          <p className="text-sm text-muted-foreground">Manage your public information and operational contact info.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs">
            <Star className="size-4 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{profile.review_count ? Number(profile.average_rating).toFixed(1) : 'New'}</span>
            <span className="text-muted-foreground">({profile.review_count || 0})</span>
          </div>

          <StatusBadge status={profile.status} label={profile.status === 'pending' ? 'Pending review' : profile.status} />
        </div>
      </div>

      {successMsg && (
        <Alert variant="lightsuccess">
          <CheckCircle2 />
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {profile.status === 'approved' && locked.length > 0 && (
        <p className="text-sm text-muted-foreground">Verified business details are locked. Contact support if they need to change.</p>
      )}
      {profile.status === 'rejected' && (
        <p className="text-sm text-muted-foreground">Changing your business details sends your application for review again.</p>
      )}

      <PartnerKycFields
        partner="transporter"
        idPrefix="tp"
        locked={locked}
        defaults={{
          type: profile.transporter_type,
          companyName: profile.company_name,
          legalName: profile.legal_name,
          tin: profile.tin,
          businessRegistrationNo: profile.business_registration_no,
          accreditationNo: profile.ltfrb_franchise_no,
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="tp-displayName">Public Display Name *</Label>
        <Input
          id="tp-displayName"
          type="text"
          name="displayName"
          required
          placeholder="e.g. Kuya John Van Rentals"
          defaultValue={profile.display_name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tp-description">Business Description & Overview</Label>
        <Textarea
          id="tp-description"
          name="description"
          rows={3}
          placeholder="Briefly describe your fleet, years of experience, and service safety standards..."
          defaultValue={profile.description || ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tp-serviceAreas">Service Areas & Coverage</Label>
        <Input
          id="tp-serviceAreas"
          type="text"
          name="serviceAreas"
          placeholder="Cebu City, Mactan, Oslob, Moalboal"
          defaultValue={(profile.service_areas || []).join(', ')}
          aria-describedby="tp-serviceAreas-hint"
        />
        <p id="tp-serviceAreas-hint" className="text-xs text-muted-foreground">Comma-separated cities or regions where you can accept trip bookings.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tp-email">Contact Email (Account)</Label>
          <div className="relative">
            <Input
              id="tp-email"
              type="email"
              defaultValue={userProfile?.email || ''}
              disabled
              className="bg-muted pl-10 text-muted-foreground"
            />
            <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tp-phone">Contact Phone Number *</Label>
          <div className="relative">
            <Input
              id="tp-phone"
              type="tel"
              name="phone"
              required
              placeholder="+63 912 345 6789"
              defaultValue={profile.phone}
              className="pl-10"
            />
            <Phone className="absolute left-3.5 top-3 size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Save Profile Changes
        </Button>
      </div>
    </form>
  );
}
