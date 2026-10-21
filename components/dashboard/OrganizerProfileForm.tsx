'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type OrganizerProfile = {
  id: string;
  organizer_type: string;
  company_name: string | null;
  display_name: string;
  description: string | null;
  phone: string;
  address: string | null;
  provides_transport: boolean;
  status: string;
  user_profiles: {
    email: string;
  } | { email: string; }[] | null;
};

export default function OrganizerProfileForm({ profile }: { profile: OrganizerProfile }) {
  const [loading, setLoading] = useState(false);
  
  // Handle edge cases if relation returned array
  const userProfile = Array.isArray(profile.user_profiles) 
    ? profile.user_profiles[0] 
    : profile.user_profiles;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement save profile action
    setTimeout(() => setLoading(false), 1000);
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
        <h5 className="card-title">Business Details</h5>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <StatusBadge status={profile.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="org-companyName">Company / Legal Name</Label>
          <Input
            id="org-companyName"
            type="text"
            name="companyName"
            defaultValue={profile.company_name || ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-displayName">Display Name</Label>
          <Input
            id="org-displayName"
            type="text"
            name="displayName"
            defaultValue={profile.display_name}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-organizerType">Organizer Type</Label>
          <NativeSelect
            id="org-organizerType"
            name="organizerType"
            defaultValue={profile.organizer_type}
          >
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </NativeSelect>
        </div>

        <div className="flex items-center md:mt-7">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="providesTransport"
              defaultChecked={profile.provides_transport}
              className="size-4 accent-primary"
            />
            <span className="text-sm font-medium text-foreground">Provides Transport?</span>
          </label>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="org-description">Business Description</Label>
          <Textarea
            id="org-description"
            name="description"
            rows={4}
            defaultValue={profile.description || ''}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="org-address">Address</Label>
          <Textarea
            id="org-address"
            name="address"
            rows={2}
            defaultValue={profile.address || ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-email">Contact Email</Label>
          <Input
            id="org-email"
            type="email"
            defaultValue={userProfile?.email || ''}
            disabled
            className="bg-muted/50 text-muted-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone">Contact Phone</Label>
          <Input
            id="org-phone"
            type="tel"
            name="phone"
            defaultValue={profile.phone}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  );
}
