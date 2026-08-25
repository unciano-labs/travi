export default function TransporterRequests() {
  const requests = [
    { id: 'REQ-5021', organizer: 'Palawan Island Hopping Co.', vehicle: '12-Seater Van', date: '2026-10-24', rate: '₱3,000', status: 'pending' },
    { id: 'REQ-5020', organizer: 'Cebu Mountain Treks', vehicle: '4-Seater Sedan', date: '2026-11-02', rate: '₱1,500', status: 'accepted' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Transport Requests</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Request ID</th>
              <th className="px-6 py-4">Organizer</th>
              <th className="px-6 py-4">Vehicle Needed</th>
              <th className="px-6 py-4">Required Date</th>
              <th className="px-6 py-4">Proposed Rate</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">{r.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{r.organizer}</td>
                <td className="px-6 py-4 text-slate-600">{r.vehicle}</td>
                <td className="px-6 py-4 text-slate-600">{r.date}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">{r.rate}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    r.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {r.status === 'pending' && (
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      <button className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors">
                        Accept
                      </button>
                      <button className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                        Decline
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
