'use client';

import { useState } from 'react';
import { CreditCard, Wallet, Plus, Star, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h5 className="card-title">Payout Methods</h5>
          <p className="text-sm text-muted-foreground">Manage where you want to receive your earnings.</p>
        </div>
        {!isAdding && (
          <Button type="button" size="sm" onClick={() => setIsAdding(true)}>
            <Plus />
            Add Method
          </Button>
        )}
      </div>

      <div className="p-6">
        {isAdding && (
          <form onSubmit={handleAdd} className="mb-6 space-y-4 rounded-lg border border-border bg-muted/50 p-5">
            <h6 className="font-semibold text-foreground">{otpStep ? 'Security Verification' : 'New Payout Method'}</h6>
            
            {otpStep ? (
              <div className="space-y-4">
                <p className="text-sm text-bodytext">
                  We've sent a 6-digit verification code to your email. Please enter it below to confirm adding this payout method.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="payout-otp">Verification Code</Label>
                  <Input 
                    id="payout-otp"
                    type="text" 
                    required 
                    maxLength={6}
                    placeholder="123456"
                    className="bg-white tracking-widest"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
                {otpError && (
                  <p className="text-xs font-medium text-error">{otpError}</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                <Label htmlFor="payout-type">Type</Label>
                <NativeSelect 
                  id="payout-type"
                  className="bg-white"
                  value={type} 
                  onChange={(e) => setType(e.target.value as 'bank' | 'gcash' | 'maya')}
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="gcash">GCash</option>
                  <option value="maya">Maya</option>
                </NativeSelect>
              </div>

              {type === 'bank' && (
                <div className="relative space-y-2">
                  <Label htmlFor="payout-bank">Bank</Label>
                  <button 
                    id="payout-bank"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={bankDropdownOpen}
                    onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                    className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
                  >
                    {bankName ? (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://logo.clearbit.com/${PH_BANKS.find(b => b.name === bankName)?.domain || 'bdo.com.ph'}`} 
                          alt={bankName} 
                          className="h-5 w-5 rounded-full bg-muted object-contain"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <span className="truncate">{bankName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a bank</span>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                  
                  {bankDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                      {PH_BANKS.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => {
                            setBankName(bank.name);
                            setBankDropdownOpen(false);
                          }}
                          className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition last:border-0 hover:bg-lightprimary/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={`https://logo.clearbit.com/${bank.domain}`} 
                            alt={bank.name} 
                            className="h-6 w-6 rounded-full border border-border bg-muted object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="truncate text-sm font-medium text-bodytext">{bank.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="payout-account-name">Account Name</Label>
                <Input 
                  id="payout-account-name"
                  type="text" 
                  required 
                  placeholder="John Doe"
                  className="bg-white"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payout-account-number">Account Number</Label>
                <Input 
                  id="payout-account-number"
                  type="text" 
                  required 
                  placeholder={type === 'bank' ? "0123456789" : "09123456789"}
                  className="bg-white"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
            </div>

            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setBankDropdownOpen(false);
                  setOtpStep(false);
                  setOtpCode('');
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={loading === 'add' || loading === 'otp'}
              >
                {(loading === 'add' || loading === 'otp') && <Loader2 className="animate-spin" />}
                {loading === 'add' ? 'Saving...' : loading === 'otp' ? 'Sending OTP...' : otpStep ? 'Verify & Save' : 'Next'}
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {methods.length === 0 && !isAdding ? (
            <EmptyState icon={CreditCard} title="No payout methods saved yet." className="py-8" />
          ) : (
            methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between rounded-lg border border-border bg-white p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border ${
                    method.type === 'bank' ? 'bg-white' :
                    method.type === 'gcash' ? 'bg-lightprimary text-primary' : 'bg-lightsuccess text-success'
                  }`}>
                    {method.type === 'bank' ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={`https://logo.clearbit.com/${PH_BANKS.find(b => b.name === method.details.bankName)?.domain || 'bank.com'}`}
                          alt={method.details.bankName}
                          className="h-full w-full object-contain p-1"
                          onError={(e) => { 
                             e.currentTarget.style.display = 'none'; 
                             e.currentTarget.parentElement!.innerHTML = '<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"></path></svg>';
                          }}
                        />
                      </>
                    ) : (
                      <Wallet className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {method.type === 'bank' ? method.details.bankName : method.type.toUpperCase()}
                      </p>
                      {method.isDefault && (
                        <Badge variant="lightPrimary" className="px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.details.accountName} • •••• {method.details.accountNumber.slice(-4)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <Button
                      type="button"
                      variant="ghostwarning"
                      size="iconsm"
                      onClick={() => handleSetDefault(method.id)}
                      disabled={loading === method.id}
                      title="Set as Default"
                      aria-label="Set as Default"
                    >
                      <Star />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghosterror"
                    size="iconsm"
                    onClick={() => handleDelete(method.id)}
                    disabled={loading === method.id}
                    title="Remove"
                    aria-label="Remove"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </CardBox>
  );
}
