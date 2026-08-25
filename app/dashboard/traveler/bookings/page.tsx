export default function TravelerBookings() {
  const bookings = [
    { id: 'BK-1001', tour: 'Coron Ultimate Tour', date: '2026-10-24', pax: 2, total: '₱3,600', status: 'confirmed' },
    { id: 'BK-0942', tour: 'Kawasan Falls Canyoneering', date: '2026-11-05', pax: 4, total: '₱6,000', status: 'pending' },
    { id: 'BK-0811', tour: 'Bohol Countryside Tour', date: '2025-12-10', pax: 2, total: '₱2,500', status: 'completed' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Booking ID</th>
              <th className="px-6 py-4">Tour Package</th>
              <th className="px-6 py-4">Travel Date</th>
              <th className="px-6 py-4">Total Amount</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">{b.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900">
                  {b.tour}
                  <div className="text-xs text-slate-500 font-normal mt-1">{b.pax} Pax</div>
                </td>
                <td className="px-6 py-4 text-slate-600">{b.date}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">{b.total}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                    b.status === 'completed' ? 'bg-slate-100 text-slate-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
