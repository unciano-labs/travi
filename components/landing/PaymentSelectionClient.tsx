'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Wallet, Loader2 } from 'lucide-react';
import { processPayment } from '@/actions/bookings';

export default function PaymentSelectionClient({ bookingId, slug }: { bookingId: string, slug: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<'gcash' | 'paymaya' | 'card'>('gcash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);
    
    // We only built E-Wallets for now since raw Card UI needs PCI compliance / PayMongo.js
    if (method === 'card') {
      setError('Direct card payments are disabled. Please use an E-Wallet or contact support.');
      setIsProcessing(false);
      return;
    }

    const host = window.location.origin;
    const returnUrl = `${host}/tours/${slug}/booking/${bookingId}/success`;

    const res = await processPayment(bookingId, method, returnUrl);

    if (res.success && res.redirectUrl) {
      window.location.href = res.redirectUrl;
    } else {
      setError(res.error || 'Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-900 block">Select Payment Method</label>
        
        <button
          onClick={() => setMethod('gcash')}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${method === 'gcash' ? 'border-brand-navy bg-slate-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs">GC</div>
            <span className="font-semibold text-slate-800">GCash</span>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'gcash' ? 'border-brand-navy' : 'border-slate-300'}`}>
            {method === 'gcash' && <div className="w-2.5 h-2.5 bg-brand-navy rounded-full" />}
          </div>
        </button>

        <button
          onClick={() => setMethod('paymaya')}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${method === 'paymaya' ? 'border-brand-navy bg-slate-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-xs">PM</div>
            <span className="font-semibold text-slate-800">Maya</span>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'paymaya' ? 'border-brand-navy' : 'border-slate-300'}`}>
            {method === 'paymaya' && <div className="w-2.5 h-2.5 bg-brand-navy rounded-full" />}
          </div>
        </button>

        <button
          onClick={() => setMethod('card')}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${method === 'card' ? 'border-brand-navy bg-slate-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-800">Credit / Debit Card</span>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'card' ? 'border-brand-navy' : 'border-slate-300'}`}>
            {method === 'card' && <div className="w-2.5 h-2.5 bg-brand-navy rounded-full" />}
          </div>
        </button>
      </div>

      <button
        onClick={handlePay}
        disabled={isProcessing}
        className="w-full py-4 px-6 bg-brand-navy text-white rounded-xl font-bold hover:bg-brand-navy/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          `Pay via ${method === 'gcash' ? 'GCash' : method === 'paymaya' ? 'Maya' : 'Card'}`
        )}
      </button>
      
      <p className="text-center text-xs text-slate-400 mt-4">
        By proceeding, you agree to our terms of service and payment provider's terms. You will be securely redirected to {method === 'gcash' ? 'GCash' : method === 'paymaya' ? 'Maya' : 'your bank'} to authorize the transaction.
      </p>
    </div>
  );
}
