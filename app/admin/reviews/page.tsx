import { Star, EyeOff } from 'lucide-react';

export default function ReviewsPage() {
  const reviews = [
    { id: 1, reviewer: 'Maria Santos', target: 'V-Hire Cebu', rating: 5, comment: 'Driver was very punctual and the van was clean!', status: 'published' },
    { id: 2, reviewer: 'John Doe', target: 'Bohol Express Transit', rating: 2, comment: 'AC was not working properly.', status: 'published' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Reviews & Moderation</h1>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
            <tr>
              <th className="px-6 py-4">Reviewer</th>
              <th className="px-6 py-4">Transporter/Tour</th>
              <th className="px-6 py-4">Rating</th>
              <th className="px-6 py-4 w-1/3">Comment</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{r.reviewer}</td>
                <td className="px-6 py-4 text-slate-600">{r.target}</td>
                <td className="px-6 py-4">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < r.rating ? 'text-amber-400 fill-current' : 'text-slate-200'}`} />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600 italic">&quot;{r.comment}&quot;</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-red-500 transition-colors" title="Hide Review">
                    <EyeOff className="w-5 h-5 ml-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
