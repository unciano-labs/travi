'use client';

import { useState } from 'react';
import { CreditCard, Wallet, Plus, Star, Trash2 } from 'lucide-react';
import { SavedPayoutMethod, savePayoutMethod, deletePayoutMethod, setDefaultPayoutMethod } from '@/actions/wallet';
import { sendPayoutOtp, verifyPayoutOtp } from '@/actions/otp';

export default function PayoutMethodsManager({ walletId, methods }: { walletId: string, methods: SavedPayoutMethod[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'bank' | 'gcash' | 'maya'>('bank');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('BDO Unibank');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  // OTP State
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  const PH_BANKS = [
    { name: 'BDO Unibank', code: 'BDO', domain: 'bdo.com.ph' },
    { name: 'Bank of the Philippine Islands (BPI)', code: 'BPI', domain: 'bpi.com.ph' },
    { name: 'Metrobank', code: 'MBT', domain: 'metrobank.com.ph' },
    { name: 'UnionBank of the Philippines', code: 'UBP', domain: 'unionbankph.com' },
    { name: 'Security Bank', code: 'SECB', domain: 'securitybank.com' },
    { name: 'Land Bank of the Philippines', code: 'LBP', domain: 'landbank.com' },
    { name: 'Philippine National Bank (PNB)', code: 'PNB', domain: 'pnb.com.ph' },
    { name: 'RCBC', code: 'RCBC', domain: 'rcbc.com' },
    { name: 'Chinabank', code: 'CHIB', domain: 'chinabank.ph' },
  ];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !accountNumber || (type === 'bank' && !bankName)) return;

    if (!otpStep) {
      setLoading('otp');
      setOtpError('');
      try {
        const res = await sendPayoutOtp();
        if (!res.success) throw new Error(res.error);
        setOtpStep(true);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to send OTP');
      } finally {
        setLoading(null);
      }
      return;
    }

    // If OTP step is active
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Please enter a 6-digit code');
      return;
    }

    setLoading('add');
    setOtpError('');
    try {
      // 1. Verify OTP
      const verifyRes = await verifyPayoutOtp(otpCode);
      if (!verifyRes.success) throw new Error(verifyRes.error);

      // 2. Save Method
      const res = await savePayoutMethod(walletId, {
        type,
        details: { accountName, accountNumber, bankName: type === 'bank' ? bankName : undefined }
      });
      if (!res.success) throw new Error(res.error);
      
      setIsAdding(false);
      setOtpStep(false);
      setOtpCode('');
      setAccountName('');
      setAccountNumber('');
      setBankName('');
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this payout method?')) return;
    setLoading(id);
    try {
      const res = await deletePayoutMethod(walletId, id);
      if (!res.success) throw new Error(res.error);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete method');
    } finally {
      setLoading(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setLoading(id);
    try {
      const res = await setDefaultPayoutMethod(walletId, id);
      if (!res.success) throw new Error(res.error);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to set default method');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Payout Methods</h3>
          <p className="text-sm text-slate-500">Manage where you want to receive your earnings.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition"
          >
            <Plus className="w-4 h-4" />
            Add Method
          </button>
        )}
      </div>

      <div className="p-6">
        {isAdding && (
          <form onSubmit={handleAdd} className="bg-slate-50 rounded-lg p-5 border border-slate-200 mb-6 space-y-4">
            <h4 className="font-semibold text-brand-navy">{otpStep ? 'Security Verification' : 'New Payout Method'}</h4>
            
            {otpStep ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  We've sent a 6-digit verification code to your email. Please enter it below to confirm adding this payout method.
                </p>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Verification Code</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={6}
                    placeholder="123456"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 tracking-widest"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
                {otpError && (
                  <p className="text-xs text-red-500 font-medium">{otpError}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Type</label>
                <select 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
                  value={type} 
                  onChange={(e) => setType(e.target.value as 'bank' | 'gcash' | 'maya')}
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                </select>
              </div>

              {type === 'bank' && (
                <div className="space-y-1 relative">
                  <label className="text-sm font-medium text-slate-700">Bank</label>
                  <button 
                    type="button"
                    onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                    className="w-full flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none bg-white focus:border-brand focus:ring-1 focus:ring-brand/20"
                  >
                    {bankName ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://logo.clearbit.com/${PH_BANKS.find(b => b.name === bankName)?.domain || 'bdo.com.ph'}`} 
                          alt={bankName} 
                          className="w-5 h-5 rounded-full object-contain bg-slate-100"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="truncate">{bankName}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Select a bank</span>
                    )}
                    <span className="text-slate-400">▼</span>
                  </button>
                  
                  {bankDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                      {PH_BANKS.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => {
                            setBankName(bank.name);
                            setBankDropdownOpen(false);
                          }}
                          className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-slate-50 transition border-b border-slate-50 last:border-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={`https://logo.clearbit.com/${bank.domain}`} 
                            alt={bank.name} 
                            className="w-6 h-6 rounded-full object-contain bg-slate-100 border border-slate-200"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="text-sm font-medium text-slate-700 truncate">{bank.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Account Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Account Number</label>
                <input 
                  type="text" 
                  required 
                  placeholder={type === 'bank' ? "0123456789" : "09123456789"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
            </div>

            )}

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => {
                  setIsAdding(false);
                  setBankDropdownOpen(false);
                  setOtpStep(false);
                  setOtpCode('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading === 'add' || loading === 'otp'}
                className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition disabled:opacity-50"
              >
                {loading === 'add' ? 'Saving...' : loading === 'otp' ? 'Sending OTP...' : otpStep ? 'Verify & Save' : 'Next'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {methods.length === 0 && !isAdding ? (
            <div className="text-center py-8 text-slate-500">
              <CreditCard className="w-8 h-8 mx-auto mb-3 text-slate-300" />
              <p>No payout methods saved yet.</p>
            </div>
          ) : (
            methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-white">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-slate-100 ${
                    method.type === 'bank' ? 'bg-white' :
                    method.type === 'gcash' ? 'bg-blue-50 text-blue-500' : 'bg-green-100 text-green-600'
                  }`}>
                    {method.type === 'bank' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://logo.clearbit.com/${PH_BANKS.find(b => b.name === method.details.bankName)?.domain || 'bank.com'}`}
                          alt={method.details.bankName}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { 
                             e.currentTarget.style.display = 'none'; 
                             e.currentTarget.parentElement!.innerHTML = '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>';
                          }}
                        />
                      </>
                    ) : (
                      <Wallet className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">
                        {method.type === 'bank' ? method.details.bankName : method.type.toUpperCase()}
                      </p>
                      {method.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 uppercase tracking-wide">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">
                      {method.details.accountName} • •••• {method.details.accountNumber.slice(-4)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      disabled={loading === method.id}
                      className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition tooltip-trigger"
                      title="Set as Default"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(method.id)}
                    disabled={loading === method.id}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
