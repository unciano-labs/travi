import { requireSession, assertRole } from '@/lib/auth-helpers';
import { PlatformSettingsForm } from '@/components/admin/PlatformSettingsForm';

export default async function SettingsPage() {
  const { user, supabase } = await requireSession();
  await assertRole(user.id, 'admin');

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .single();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
      </div>

      <PlatformSettingsForm initialSettings={settings || {}} />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mt-8">
        <h2 className="text-lg font-medium text-slate-900 mb-4">Admin Profile</h2>
        <form className="space-y-5" action={async () => {
          'use server';
          // Stub for password update
        }}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              defaultValue={user.email}
              disabled
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input 
              type="password" 
              name="password"
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <button className="bg-brand-navy text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-navy/90 transition-colors">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
