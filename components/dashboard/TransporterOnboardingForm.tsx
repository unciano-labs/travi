'use client';

import { useState } from 'react';
import { createTransporterProfile } from '@/actions/transporter';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TransporterOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    
    const res = await createTransporterProfile(formData);
    
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="onboard-transporterType">Transporter Type</Label>
          <NativeSelect id="onboard-transporterType" name="transporterType" required>
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
            placeholder="e.g. Island Rides Inc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboard-displayName">Display Name</Label>
          <Input
            id="onboard-displayName"
            type="text"
            name="displayName"
            required
            placeholder="What should organizers see?"
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
          <Label htmlFor="onboard-serviceAreas">Service Areas (comma separated)</Label>
          <Input
            id="onboard-serviceAreas"
            type="text"
            name="serviceAreas"
            placeholder="e.g. Cebu, Bohol, Palawan"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="onboard-description">About Your Fleet / Service</Label>
          <Textarea
            id="onboard-description"
            name="description"
            rows={4}
            placeholder="Tell us about the vehicles you offer..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
