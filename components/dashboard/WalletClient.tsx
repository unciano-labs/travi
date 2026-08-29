'use client';

import { useState } from 'react';
import { ArrowRightLeft, Clock, CheckCircle2, AlertCircle, Ban, History, Banknote } from 'lucide-react';
import { requestPayout } from '@/actions/wallet';

export function WalletClient({ wallet, transactions, payouts }: { wallet: any, transactions: any[], payouts: any[] }) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('gcash');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState(wallet.available_balance);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await requestPayout(wallet.id, {
      amount: Number(payoutAmount),
      method: payoutMethod,
      accountDetails: payoutAccount
    });

    if (res.success) {
      setSuccessMsg('Payout requested successfully. An admin will process it shortly.');
      // Keep UI responsive: deduct locally just for immediate feedback (or rely on router.refresh)
      window.location.reload();
    } else {
      setErrorMsg(res.error || 'Failed to request payout.');
      setIsRequesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'paid': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'rejected': return <Ban className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Balances & Actions */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Banknote className="w-24 h-24" />
          </div>
          <p className="text-emerald-100 font-medium mb-1">Available Balance</p>
          <h2 className="text-4xl font-extrabold font-display relative z-10">
            ₱{Number(wallet.available_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
          <p className="text-xs text-emerald-100 mt-2 relative z-10">Ready for withdrawal</p>
        </div>

        {/* Escrow Balance Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-slate-500 font-medium text-sm">Escrow Balance</p>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            ₱{Number(wallet.escrow_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
          <p className="text-xs text-slate-400 mt-2">Funds held for upcoming tours. Released 24h after completion.</p>
        </div>

        {/* Payout Request Form */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Request Payout</h3>
          
          {wallet.available_balance <= 0 ? (
            <div className="text-sm text-slate-500 flex gap-2 items-start bg-slate-50 p-3 rounded-xl border border-slate-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              You have no available funds to withdraw at this time.
            </div>
          ) : (
            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Withdrawal Method</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                >
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                  <option value="bdo">BDO Unibank</option>
                  <option value="bpi">Bank of the Philippine Islands (BPI)</option>
                  <option value="unionbank">UnionBank</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Account Number / Details</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 09171234567"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (₱)</label>
                <input 
                  type="number" 
                  required
                  min="100"
                  max={wallet.available_balance}
                  step="0.01"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                />
              </div>

              {errorMsg && <p className="text-red-500 text-sm font-medium">{errorMsg}</p>}
              {successMsg && <p className="text-emerald-600 text-sm font-medium">{successMsg}</p>}

              <button 
                type="submit" 
                disabled={isRequesting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {isRequesting ? 'Processing...' : 'Withdraw Funds'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right Column: Ledger & History */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Pending Payouts */}
        {payouts.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-slate-400" />
              Recent Payout Requests
            </h3>
            <div className="divide-y divide-slate-100">
              {payouts.slice(0, 5).map((payout: any) => (
                <div key={payout.id} className="py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(payout.status)}
                    <div>
                      <p className="font-medium text-slate-900 capitalize">{payout.status}</p>
                      <p className="text-xs text-slate-500">
                        {payout.payout_method?.method.toUpperCase()} • {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">₱{Number(payout.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ledger Transactions */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            Ledger History
          </h3>
          
          {transactions.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="text-sm">
                      <td className="py-3 text-slate-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 font-medium text-slate-900">{tx.description}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          tx.type === 'payment_hold' ? 'bg-amber-100 text-amber-700' : 
                          tx.type === 'escrow_release' ? 'bg-emerald-100 text-emerald-700' :
                          tx.type === 'withdrawal_pending' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-bold whitespace-nowrap ${
                        (tx.type === 'withdrawal_pending' || tx.type === 'refund') ? 'text-red-500' : 'text-emerald-600'
                      }`}>
                        {(tx.type === 'withdrawal_pending' || tx.type === 'refund') ? '-' : '+'}₱{Number(tx.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
