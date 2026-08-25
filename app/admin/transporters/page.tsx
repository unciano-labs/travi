import { Check, X, Star } from 'lucide-react';

const transporters = [
  { id: 1, name: 'V-Hire Cebu', areas: 'Cebu, Mandaue, Lapu-Lapu', rating: 4.8, status: 'approved' },
  { id: 2, name: 'Bohol Express Transit', areas: 'Tagbilaran, Panglao', rating: 0, status: 'pending' },
];

export default function TransportersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Transporters</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Transporter Name</th>
              <th className="px-6 py-4">Service Areas</th>
              <th className="px-6 py-4">Rating</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transporters.map((trp) => (
              <tr key={trp.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{trp.name}</td>
                <td className="px-6 py-4 text-slate-600">{trp.areas}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-slate-900 font-medium">
                    <Star className="w-4 h-4 text-amber-400 fill-current" />
                    {trp.rating > 0 ? trp.rating : 'New'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    trp.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {trp.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {trp.status === 'pending' && (
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
