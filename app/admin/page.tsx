import { Users, Bus, Map, CreditCard, Activity } from 'lucide-react';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';

export default async function AdminDashboard() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  const [
    usersRes,
    toursRes,
    bookingsRes,
    transportersRes,
    recentActivityRes
  ] = await Promise.all([
    admin.from('user_profiles').select('*', { count: 'exact', head: true }),
    admin.from('tours').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    admin.from('transporter_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('bookings')
      .select('id, total_amount, created_at, seats, user_profiles(full_name), tour_schedules(tours(title))')
      .order('created_at', { ascending: false })
      .limit(5)
  ]);

  const stats = [
    { name: 'Total Users', value: (usersRes.count || 0).toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Active Tours', value: (toursRes.count || 0).toLocaleString(), icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { name: 'Total Bookings', value: (bookingsRes.count || 0).toLocaleString(), icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-100' },
    { name: 'Transporters', value: (transportersRes.count || 0).toLocaleString(), icon: Bus, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  const recentBookings = recentActivityRes.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <Activity className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-medium text-slate-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recentBookings.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">No recent activity found.</div>
          )}
          {recentBookings.map((b: any) => {
            const travelerName = b.user_profiles?.full_name || 'Anonymous';
            const tourTitle = b.tour_schedules?.tours?.title || 'Unknown Tour';
            const timeAgo = new Date(b.created_at).toLocaleDateString();

            return (
              <div key={b.id} className="px-6 py-4 flex items-center hover:bg-slate-50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-brand-navy mr-4"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">New Booking: {tourTitle}</p>
                  <p className="text-xs text-slate-500 mt-1">{travelerName} booked for {b.seats} pax • {timeAgo}</p>
                </div>
                <div className="text-sm font-medium text-slate-900">₱{(b.total_amount || 0).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center">
          <Link href="/admin/bookings" className="text-sm font-medium text-brand-navy hover:text-brand-navy/80">
            View All Activity
          </Link>
        </div>
      </div>
    </div>
  );
}
