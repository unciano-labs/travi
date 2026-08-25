import { Bus, CalendarCheck, Map } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function TransporterDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  let profile = null;
  if (userProfile) {
    const { data } = await supabase
      .from('transporter_profiles')
      .select('company_name, display_name, description')
      .eq('user_profile_id', userProfile.id)
      .single();
    profile = data;
  }

  const title = profile?.company_name || profile?.display_name || 'Transporter Overview';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {profile?.description && (
          <p className="text-slate-500 mt-1 max-w-2xl">{profile.description}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-coral/10 text-coral rounded-lg">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Vehicles</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">5</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-brand-navy/10 text-brand-navy rounded-lg">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Upcoming Trips</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">12</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Map className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Service Areas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">3</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Recent Requests</h2>
          <button className="text-sm text-coral font-medium hover:text-coral/80">View All</button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Organizer</th>
              <th className="px-6 py-4">Vehicle Requested</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900">Palawan Island Hopping Co.</td>
              <td className="px-6 py-4 text-slate-600">12-Seater Van</td>
              <td className="px-6 py-4 text-slate-600">Oct 24, 2026</td>
              <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pending Approval</span></td>
            </tr>
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-900">Cebu Mountain Treks</td>
              <td className="px-6 py-4 text-slate-600">4-Seater Sedan</td>
              <td className="px-6 py-4 text-slate-600">Nov 02, 2026</td>
              <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Accepted</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
