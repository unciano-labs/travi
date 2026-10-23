'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createOrganizerProfile } from '@/actions/organizer';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PartnerKycFields from './PartnerKycFields';
import PartnerDocumentUpload from './PartnerDocumentUpload';
import type { PartnerDocumentInput } from '@/lib/schemas/partner';
import PartnerTermsCheckbox from '@/components/legal/PartnerTermsCheckbox';

export default function OrganizerOnboardingForm({ defaultContactEmail = '' }: { defaultContactEmail?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [governmentId, setGovernmentId] = useState<PartnerDocumentInput | null>(null);
  const [registrationDoc, setRegistrationDoc] = useState<PartnerDocumentInput | null>(null);
  const [type, setType] = useState<'individual' | 'company'>('individual');
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (!governmentId) {
      setError('Please upload a government-issued ID.');
      return;
    }
    setLoading(true);
    formData.set('documents', JSON.stringify([governmentId, registrationDoc].filter(Boolean)));

    const res = await createOrganizerProfile(formData);

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
        <PartnerKycFields partner="organizer" idPrefix="onboard" onTypeChange={setType} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-base font-semibold text-foreground">Public profile and contact</legend>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onboard-displayName">Display name *</Label>
            <Input id="onboard-displayName" type="text" name="displayName" required placeholder="What should travelers see?" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboard-phone">Phone number *</Label>
            <Input id="onboard-phone" type="tel" name="phone" required placeholder="0917 123 4567" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="onboard-publicContactEmail">Customer contact email *</Label>
            <Input
              id="onboard-publicContactEmail"
              type="email"
              name="publicContactEmail"
              required
              defaultValue={defaultContactEmail}
              aria-describedby="onboard-publicContactEmail-hint"
            />
            <p id="onboard-publicContactEmail-hint" className="text-xs text-muted-foreground">
              Shown on your tour pages so travelers can reach you about their booking.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="onboard-address">Business address</Label>
            <Textarea id="onboard-address" name="address" rows={2} placeholder="Main office or operational base..." />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="onboard-description">About your business</Label>
            <Textarea id="onboard-description" name="description" rows={4} placeholder="Tell us about the kinds of tours you offer..." />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 md:col-span-2">
            <input type="checkbox" id="providesTransport" name="providesTransport" className="mt-0.5 size-4 accent-primary" />
            <div>
              <label htmlFor="providesTransport" className="block text-sm font-medium text-foreground">
                We provide our own transportation
              </label>
              <p className="text-sm text-muted-foreground">
                Check this if you have your own vehicles (vans, boats, etc.) and don&apos;t need to hire external transporters.
              </p>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-base font-semibold text-foreground">Verification documents</legend>
        <p className="text-sm text-muted-foreground">
          Stored privately and only seen by the Travi review team. PDF, JPG, PNG or WebP, up to 10 MB each.
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
            docType="business_registration"
            label="DTI / SEC certificate"
            required={false}
            hint={type === 'company' ? 'Recommended for registered companies.' : undefined}
            value={registrationDoc}
            onChange={setRegistrationDoc}
            onError={setError}
          />
        </div>
      </fieldset>

      <PartnerTermsCheckbox partner="organizer" />

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Submitting...' : 'Submit for review'}
        </Button>
      </div>
    </form>
  );
}
