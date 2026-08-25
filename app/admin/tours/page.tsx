export default function ToursPage() {
  const tours = [
    { id: 1, title: 'Coron Ultimate Tour', org: 'Palawan Island Hopping Co.', price: '₱1,800', status: 'published' },
    { id: 2, title: 'Mt. Pulag Sea of Clouds', org: 'Juan Dela Cruz', price: '₱3,500', status: 'draft' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tours</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Tour Title</th>
              <th className="px-6 py-4">Organizer</th>
              <th className="px-6 py-4">Price (per pax)</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tours.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{t.title}</td>
                <td className="px-6 py-4 text-slate-600">{t.org}</td>
                <td className="px-6 py-4 text-slate-900 font-medium">{t.price}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    t.status === 'published' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {t.status}
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
