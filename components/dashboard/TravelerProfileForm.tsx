'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
};

export default function TravelerProfileForm({ profile }: { profile: Profile }) {
  const [loading, setLoading] = useState(false);

  // Basic split for first/last name
  const names = profile.full_name ? profile.full_name.split(' ') : ['', ''];
  const defaultFirstName = names[0] || '';
  const defaultLastName = names.slice(1).join(' ') || '';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement save profile action
    setTimeout(() => setLoading(false), 1000);
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="traveler-firstName">First Name</Label>
          <Input
            id="traveler-firstName"
            type="text"
            name="firstName"
            defaultValue={defaultFirstName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="traveler-lastName">Last Name</Label>
          <Input
            id="traveler-lastName"
            type="text"
            name="lastName"
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
