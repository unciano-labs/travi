'use client';

import { useState } from 'react';
import { createTransporterProfile } from '@/actions/transporter';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PartnerKycFields from './PartnerKycFields';
import PartnerDocumentUpload from './PartnerDocumentUpload';
import type { PartnerDocumentInput } from '@/lib/schemas/partner';
import PartnerTermsCheckbox from '@/components/legal/PartnerTermsCheckbox';

export default function TransporterOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [governmentId, setGovernmentId] = useState<PartnerDocumentInput | null>(null);
  const [franchiseDoc, setFranchiseDoc] = useState<PartnerDocumentInput | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<PartnerDocumentInput | null>(null);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!governmentId) {
      setError('Please upload a government-issued ID.');
      return;
    }
    setLoading(true);
    formData.set('documents', JSON.stringify([governmentId, franchiseDoc, registrationDoc].filter(Boolean)));

    const res = await createTransporterProfile(formData);

    setLoading(false);

    if (!res.success) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold text-foreground">Business identity</legend>
        <PartnerKycFields partner="transporter" idPrefix="onboard" />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold text-foreground">Service details</legend>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onboard-displayName">Display name *</Label>
            <Input id="onboard-displayName" type="text" name="displayName" required placeholder="What should organizers see?" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboard-phone">Phone number *</Label>
            <Input id="onboard-phone" type="tel" name="phone" required placeholder="0917 123 4567" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="onboard-serviceAreas">Service areas (comma separated)</Label>
            <Input id="onboard-serviceAreas" type="text" name="serviceAreas" placeholder="e.g. Cebu, Bohol, Palawan" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="onboard-description">About your fleet / service</Label>
            <Textarea id="onboard-description" name="description" rows={4} placeholder="Tell us about the vehicles you offer..." />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-foreground">Verification documents</legend>
        <p className="text-sm text-muted-foreground">
          Stored privately and only seen by the Travi review team. PDF, JPG, PNG or WebP, up to 10 MB each.
          You can add each vehicle&apos;s OR/CR when you list it.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PartnerDocumentUpload
            docType="government_id"
            label="Government-issued ID"
            required
            value={governmentId}
            onChange={setGovernmentId}
            onError={setError}
          />
          <PartnerDocumentUpload
            docType="ltfrb_franchise"
            label="LTFRB franchise / DOT accreditation"
            value={franchiseDoc}
            onChange={setFranchiseDoc}
            onError={setError}
          />
          <PartnerDocumentUpload
            docType="business_registration"
            label="DTI / SEC certificate"
            value={registrationDoc}
            onChange={setRegistrationDoc}
            onError={setError}
          />
        </div>
      </fieldset>

      <PartnerTermsCheckbox partner="transporter" />

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Submitting...' : 'Submit for review'}
        </Button>
      </div>
    </form>
  );
}
