export default function OrganizerBookings() {
  const bookings = [
    { id: 'BK-1001', traveler: 'Juan Dela Cruz', tour: 'Coron Ultimate Tour', date: '2026-10-24', pax: 2, total: '₱3,600', status: 'confirmed' },
    { id: 'BK-0988', traveler: 'Maria Santos', tour: 'El Nido Tour A', date: '2026-11-02', pax: 4, total: '₱4,800', status: 'pending' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Booking ID</th>
              <th className="px-6 py-4">Traveler</th>
              <th className="px-6 py-4">Tour & Date</th>
              <th className="px-6 py-4">Total Amount</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">{b.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{b.traveler}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{b.tour}</div>
                  <div className="text-xs text-slate-500">{b.date} ({b.pax} Pax)</div>
                </td>
                <td className="px-6 py-4 text-slate-900 font-medium">{b.total}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {b.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {b.status === 'pending' && (
                    <div className="flex justify-end gap-2 text-xs font-medium">
                      <button className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors">
                        Confirm
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
