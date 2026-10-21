'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createOrganizerProfile } from '@/actions/organizer';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function OrganizerOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);

    const res = await createOrganizerProfile(formData);

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="onboard-organizerType">Organizer Type</Label>
          <NativeSelect id="onboard-organizerType" name="organizerType" required>
            <option value="individual">Individual / Freelancer</option>
            <option value="company">Registered Company</option>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboard-companyName">Company Name (Optional if Individual)</Label>
          <Input
            id="onboard-companyName"
            type="text"
            name="companyName"
            placeholder="e.g. Island Hoppers Inc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboard-displayName">Display Name</Label>
          <Input
            id="onboard-displayName"
            type="text"
            name="displayName"
            required
            placeholder="What should travelers see?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboard-phone">Phone Number</Label>
          <Input
            id="onboard-phone"
            type="tel"
            name="phone"
            required
            placeholder="+63 912 345 6789"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="onboard-address">Business Address</Label>
          <Textarea
            id="onboard-address"
            name="address"
            rows={2}
            placeholder="Main office or operational base..."
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="onboard-description">About Your Business</Label>
          <Textarea
            id="onboard-description"
            name="description"
            rows={4}
            placeholder="Tell us about the kinds of tours you offer..."
          />
        </div>

        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border md:col-span-2">
          <input
            type="checkbox"
            id="providesTransport"
            name="providesTransport"
            className="size-4 accent-primary mt-0.5"
          />
          <div>
            <label htmlFor="providesTransport" className="font-medium text-foreground block text-sm">
              We provide our own transportation
            </label>
            <p className="text-sm text-muted-foreground">
              Check this if you have your own vehicles (vans, boats, etc.) and don't need to hire external transporters.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
