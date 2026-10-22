import { requireSession, assertRole } from '@/lib/auth-helpers';
import { PlatformSettingsForm } from '@/components/admin/PlatformSettingsForm';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default async function SettingsPage() {
  const { user, supabase } = await requireSession();
  await assertRole(user.id, 'admin');

  // Single-row table with a uuid id: read the latest row (never .eq('id', 1)).
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="Platform Settings"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Settings' }]}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <PlatformSettingsForm initialSettings={settings || {}} />
        </div>

        <div className="col-span-12 lg:col-span-5">
          <CardBox className="h-full">
            <div>
              <h5 className="card-title">Admin Profile</h5>
              <p className="text-sm text-muted-foreground">Your sign-in details.</p>
            </div>
            <form className="space-y-5" action={async () => {
              'use server';
              // Stub for password update
            }}>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email Address</Label>
                <Input
                  id="admin-email"
                  type="email"
                  defaultValue={user.email}
                  disabled
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">New Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </CardBox>
        </div>
      </div>
    </>
  );
}
