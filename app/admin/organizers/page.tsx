import { Check, X, Building, User } from 'lucide-react';

const organizers = [
  { id: 1, name: 'Palawan Island Hopping Co.', type: 'company', email: 'hello@palawanco.ph', status: 'pending', date: '2026-08-23' },
  { id: 2, name: 'Juan Dela Cruz', type: 'individual', email: 'juan@gmail.com', status: 'approved', date: '2026-08-20' },
  { id: 3, name: 'Cebu Mountain Treks', type: 'company', email: 'info@cebutreks.com', status: 'approved', date: '2026-08-15' },
];

export default function OrganizersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Organizers</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Name / Company</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Applied</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {organizers.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{org.name}</div>
                  <div className="text-slate-500 text-xs">{org.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-slate-600">
                    {org.type === 'company' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    <span className="capitalize">{org.type}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    org.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">{org.date}</td>
                <td className="px-6 py-4 text-right">
                  {org.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <button className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
