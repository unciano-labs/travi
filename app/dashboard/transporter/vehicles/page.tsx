import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function TransporterVehicles() {
  const vehicles = [
    { id: 1, model: 'Toyota Hiace', type: '12-Seater Van', plate: 'ABC 1234', location: 'Cebu City', status: 'active' },
    { id: 2, model: 'Toyota Vios', type: '4-Seater Sedan', plate: 'XYZ 9876', location: 'Mandaue City', status: 'active' },
    { id: 3, model: 'Nissan NV350', type: '14-Seater Van', plate: 'DEF 5678', location: 'Lapu-Lapu City', status: 'maintenance' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
        <button className="flex items-center gap-2 bg-coral text-white px-4 py-2 rounded-lg font-medium hover:bg-coral/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Vehicle Model</th>
              <th className="px-6 py-4">Type / Capacity</th>
              <th className="px-6 py-4">Plate No.</th>
              <th className="px-6 py-4">Base Location</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{v.model}</td>
                <td className="px-6 py-4 text-slate-600">{v.type}</td>
                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{v.plate}</td>
                <td className="px-6 py-4 text-slate-600">{v.location}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    v.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-1.5 text-slate-400 hover:text-brand-navy transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
