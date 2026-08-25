export default function BookingsPage() {
  const bookings = [
    { id: 'BK-1001', tour: 'Coron Ultimate Tour', pax: 4, total: '₱7,200', status: 'confirmed' },
    { id: 'BK-1002', tour: 'Kawasan Falls Canyoneering', pax: 2, total: '₱3,000', status: 'pending' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Booking ID</th>
              <th className="px-6 py-4">Tour</th>
              <th className="px-6 py-4">Pax</th>
              <th className="px-6 py-4">Total Amount</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500">{b.id}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{b.tour}</td>
                <td className="px-6 py-4 text-slate-600">{b.pax}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">{b.total}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
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
