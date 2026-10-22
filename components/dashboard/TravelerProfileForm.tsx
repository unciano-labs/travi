'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { updateProfileName } from '@/actions/profile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
};

export default function TravelerProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  // Basic split for first/last name
  const names = profile.full_name ? profile.full_name.trim().split(/\s+/) : [];
  const defaultFirstName = names[0] || '';
  const defaultLastName = names.slice(1).join(' ');

  const handleSubmit = (formData: FormData) => {
    setStatus(null);
    const fullName = [formData.get('firstName'), formData.get('lastName')]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean)
      .join(' ');

    startTransition(async () => {
      const result = await updateProfileName(fullName);
      setStatus(
        result.success
          ? { tone: 'success', message: 'Profile saved.' }
          : { tone: 'error', message: result.error }
      );
    });
  };

  return (
    <form className="flex flex-col gap-6" action={handleSubmit}>
      {status && (
        <Alert variant={status.tone === 'success' ? 'lightsuccess' : 'lighterror'} role={status.tone === 'error' ? 'alert' : 'status'}>
          {status.tone === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="traveler-firstName">First Name</Label>
          <Input
            id="traveler-firstName"
            type="text"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
            defaultValue={defaultFirstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-lastName">Last Name</Label>
          <Input
            id="traveler-lastName"
            type="text"
            name="lastName"
            autoComplete="family-name"
            maxLength={100}
            defaultValue={defaultLastName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="traveler-email">Email Address</Label>
        <Input
          id="traveler-email"
          type="email"
          defaultValue={profile.email}
          disabled
          className="bg-muted/50"
        />
        <p className="text-xs text-muted-foreground">Change your email under Account Security below.</p>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
