'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Ban, Loader2, ArrowRight } from 'lucide-react';
import { markPayoutPaid } from '@/actions/admin';

export function PayoutsClient({ initialPayouts }: { initialPayouts: any[] }) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleMarkPaid = async (id: string, walletId: string) => {
    if (!confirm('Have you successfully transferred the funds via InstaPay/PESONet?')) return;
    
    setProcessingId(id);
    const res = await markPayoutPaid(id, walletId);
    if (res.success) {
      setPayouts(payouts.map(p => p.id === id ? { ...p, status: 'paid' } : p));
    } else {
      alert(res.error || 'Failed to update payout status.');
    }
    setProcessingId(null);
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'rejected': return <Ban className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
      {payouts.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No payout requests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Partner</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Method & Details</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payouts.map((p: any) => (
                <tr key={p.id} className="text-sm hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900">{p.user_wallets?.user_profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{p.user_wallets?.user_profiles?.email}</p>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-bold text-slate-900 uppercase">{p.payout_method?.method}</p>
                    <p className="font-mono text-xs text-slate-500">{p.payout_method?.account}</p>
                  </td>
                  <td className="py-4 px-4 text-right font-extrabold text-slate-900">
                    ₱{Number(p.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getStatusIcon(p.status)}
                      <span className="font-medium capitalize text-slate-700">{p.status}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {p.status === 'pending' && (
                      <button
                        onClick={() => handleMarkPaid(p.id, p.wallet_id)}
                        disabled={processingId === p.id}
                        className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {processingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
