import { Users, Bus, Map, CreditCard, Activity } from 'lucide-react';

const stats = [
  { name: 'Total Users', value: '1,234', change: '+12%', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  { name: 'Active Tours', value: '86', change: '+5%', icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { name: 'Total Bookings', value: '432', change: '+18%', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-100' },
  { name: 'Transporters', value: '42', change: '+2', icon: Bus, color: 'text-orange-600', bg: 'bg-orange-100' },
];

export default function AdminDashboard() {
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
              <div className="mt-4 flex items-center text-sm">
                <span className="text-emerald-600 font-medium">{stat.change}</span>
                <span className="text-slate-500 ml-2">from last month</span>
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
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center hover:bg-slate-50 transition-colors">
              <div className="w-2 h-2 rounded-full bg-brand-navy mr-4"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">New Booking: El Nido Island Hopping</p>
                <p className="text-xs text-slate-500 mt-1">Juan Dela Cruz booked for 4 pax • 2 hours ago</p>
              </div>
              <div className="text-sm font-medium text-slate-900">₱8,400</div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 text-center">
          <button className="text-sm font-medium text-brand-navy hover:text-brand-navy/80">
            View All Activity
          </button>
        </div>
      </div>
    </div>
  );
}
