'use client';

import { useState } from 'react';
import { ArrowRightLeft, Clock, CheckCircle2, AlertCircle, Ban, History, Banknote, X, Info, Download } from 'lucide-react';
import { requestPayout, SavedPayoutMethod } from '@/actions/wallet';
import PayoutMethodsManager from '@/components/wallet/PayoutMethodsManager';

export function WalletClient({ wallet, transactions, payouts }: { wallet: any, transactions: any[], payouts: any[] }) {
  const savedMethods: SavedPayoutMethod[] = wallet.saved_payout_methods || [];
  const defaultMethod = savedMethods.find(m => m.isDefault) || savedMethods[0];

  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod?.id || '');
  const [payoutAmount, setPayoutAmount] = useState(wallet.available_balance);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const MIN_WITHDRAWAL = 500;

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const method = savedMethods.find(m => m.id === selectedMethodId);
    if (!method) {
      setErrorMsg('Please select a valid payout method.');
      return;
    }
    
    if (payoutAmount < MIN_WITHDRAWAL) {
      setErrorMsg(`Minimum withdrawal amount is ₱${MIN_WITHDRAWAL.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
      return;
    }

    setShowConfirmModal(true);
  };

  const confirmPayout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!confirmPassword) {
      setErrorMsg('Please enter your password to confirm.');
      setShowConfirmModal(false);
      return;
    }

    setIsRequesting(true);
    setShowConfirmModal(false);

    const method = savedMethods.find(m => m.id === selectedMethodId);
    if (!method) return;

    const res = await requestPayout(wallet.id, {
      amount: Number(payoutAmount),
      method: method.type,
      accountDetails: `${method.details.accountName} (${method.details.accountNumber})`,
      password: confirmPassword
    });

    setConfirmPassword('');

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

  const exportLedgerToCSV = () => {
    if (!transactions || transactions.length === 0) return;

    const headers = ['Date', 'Description', 'Type', 'Amount'];
    const csvRows = transactions.map(tx => {
      // Escape quotes in description to avoid breaking CSV format
      const description = `"${(tx.description || '').replace(/"/g, '""')}"`;
      const date = `"${new Date(tx.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}"`;
      return `${date},${description},${tx.type},${tx.amount}`;
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `ledger_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Balances & Actions */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Available Balance Card */}
        <div className="bg-gradient-to-br from-brand-navy to-brand-deep rounded-3xl p-6 text-white shadow-xl shadow-brand-navy/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Banknote className="w-24 h-24" />
          </div>
          <p className="text-white/80 font-medium mb-1">Available Balance</p>
          <h2 className="text-4xl font-extrabold font-display relative z-10">
            ₱{Number(wallet.available_balance).toLocaleString(undefined, {minimumFractionDigits: 2})}
          </h2>
          <p className="text-xs text-white/70 mt-2 relative z-10">Ready for withdrawal</p>
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
              {savedMethods.length === 0 ? (
                <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  Please add a payout method first to withdraw funds.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Withdrawal Method</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                      value={selectedMethodId}
                      onChange={(e) => setSelectedMethodId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select a saved method</option>
                      {savedMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.type === 'bank' ? m.details.bankName : m.type.toUpperCase()} - {m.details.accountName} (•••• {m.details.accountNumber.slice(-4)})
                        </option>
                      ))}
                    </select>
                  </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (₱)</label>
                <input 
                  type="number" 
                  required
                  min={MIN_WITHDRAWAL}
                  max={wallet.available_balance}
                  step="0.01"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1 ml-1">Min: ₱{MIN_WITHDRAWAL.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>

              {errorMsg && <p className="text-red-500 text-sm font-medium">{errorMsg}</p>}
              {successMsg && <p className="text-emerald-600 text-sm font-medium">{successMsg}</p>}

              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 flex gap-2 text-xs">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Payouts are processed within 24-48 hours. Standard bank transfer fees may apply depending on your selected method.</p>
              </div>

              <button 
                type="submit" 
                disabled={isRequesting || savedMethods.length === 0 || wallet.available_balance < MIN_WITHDRAWAL}
                className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
              >
                {isRequesting ? 'Processing...' : 'Withdraw Funds'}
              </button>
              </>
              )}
            </form>
          )}
        </div>

        <PayoutMethodsManager walletId={wallet.id} methods={savedMethods} />
      </div>

      {/* Right Column: Ledger & History */}
      <div className="lg:col-span-7 space-y-6">
        
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
                      <p className="text-xs text-slate-500 mt-0.5">
                        {payout.payout_method?.method.toUpperCase()} • {new Date(payout.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Ledger History
            </h3>
            {transactions.length > 0 && (
              <button 
                onClick={exportLedgerToCSV}
                className="flex items-center gap-2 text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 py-2 px-3 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
          
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
                        {new Date(tx.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold font-display text-slate-900 mb-2">Confirm Withdrawal</h3>
            <p className="text-slate-500 text-sm mb-6">Please review the details of your payout request before proceeding.</p>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 mb-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Amount</span>
                <span className="text-xl font-black text-slate-900">₱{Number(payoutAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Method</span>
                <span className="text-sm font-bold text-slate-900 uppercase">
                  {savedMethods.find(m => m.id === selectedMethodId)?.type === 'bank' 
                    ? savedMethods.find(m => m.id === selectedMethodId)?.details.bankName 
                    : savedMethods.find(m => m.id === selectedMethodId)?.type}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Account</span>
                <span className="text-sm font-bold text-slate-900 font-mono text-right max-w-[150px] truncate">
                  {savedMethods.find(m => m.id === selectedMethodId)?.details.accountNumber}
                </span>
              </div>
            </div>

            <form onSubmit={confirmPayout}>
              <div className="mb-6 space-y-2">
                <label className="text-sm font-bold text-slate-700">Security Verification</label>
                <input 
                  type="password"
                  required
                  placeholder="Enter your account password"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="flex-1 bg-brand hover:bg-brand-dark text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Confirm Payout
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
