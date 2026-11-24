'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { processPayment } from '@/actions/bookings';

export default function PaymentSelectionClient({
  bookingId,
  totalAmountLabel,
}: {
  bookingId: string;
  totalAmountLabel?: string;
}) {
  const [method, setMethod] = useState<'gcash' | 'paymaya'>('gcash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const methodLabel = method === 'gcash' ? 'GCash' : 'Maya';

  const handlePay = async () => {
    if (!acceptedTerms) {
      setError('Please agree to the Terms of Service and the Refund & Cancellation Policy before paying.');
      return;
    }
    setIsProcessing(true);
    setError(null);

    // The server builds the return URL to /tours/[slug]/booking/[bookingId]/success.
    const res = await processPayment(bookingId, method, acceptedTerms);

    if (res.success) {
      window.location.href = res.redirectUrl;
    } else {
      setError(res.error || 'Payment initialization failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">Select Payment Method</span>
          <span className="text-xs font-medium text-slate-500">Philippine Peso (PHP)</span>
        </div>

        <button
          type="button"
          aria-pressed={method === 'gcash'}
          onClick={() => setMethod('gcash')}
          className={`w-full flex items-center justify-between gap-3 p-4 rounded-xl border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            method === 'gcash'
              ? 'border-brand bg-sky-50/50 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#007DFE] text-white flex items-center justify-center font-extrabold text-sm tracking-tight shrink-0 shadow-xs">
              GCash
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">GCash E-Wallet</span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Instant
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Authorize directly in the GCash app or via OTP</p>
            </div>
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              method === 'gcash' ? 'border-brand bg-brand text-white' : 'border-slate-300'
            }`}
          >
            {method === 'gcash' && <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />}
          </div>
        </button>

        <button
          type="button"
          aria-pressed={method === 'paymaya'}
          onClick={() => setMethod('paymaya')}
          className={`w-full flex items-center justify-between gap-3 p-4 rounded-xl border-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            method === 'paymaya'
              ? 'border-brand bg-sky-50/50 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#00B14F] text-white flex items-center justify-center font-extrabold text-sm tracking-tight shrink-0 shadow-xs">
              Maya
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Maya Wallet</span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Instant
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Pay with Maya app, mobile number, or QR</p>
            </div>
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              method === 'paymaya' ? 'border-brand bg-brand text-white' : 'border-slate-300'
            }`}
          >
            {method === 'paymaya' && <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />}
          </div>
        </button>

        <div
          aria-disabled="true"
          className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/80 opacity-65 cursor-not-allowed"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Credit / Debit Card</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Coming soon
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Visa and Mastercard checkout is not yet enabled</p>
            </div>
          </div>
        </div>
      </div>

      {/* LEG-01/03: checkout acceptance, recorded with the booking by processPayment. */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <input
          id="checkout-accept-terms"
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-coral focus-visible:ring-2 focus-visible:ring-coral/40"
        />
        <label htmlFor="checkout-accept-terms" className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          I agree to the{' '}
          <Link href="/terms" target="_blank" className="font-semibold text-brand-dark underline-offset-2 hover:underline">
            Terms of Service
          </Link>{' '}
          and the{' '}
          <Link href="/refund-policy" target="_blank" className="font-semibold text-brand-dark underline-offset-2 hover:underline">
            Refund &amp; Cancellation Policy
          </Link>
          . A paid booking can be canceled for a full refund before the trip starts.
        </label>
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={isProcessing || !acceptedTerms}
        className="w-full py-4 px-6 bg-coral hover:bg-coral-dark text-white rounded-xl font-extrabold text-base shadow-card transition-all flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            Connecting to {methodLabel}...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" aria-hidden="true" />
            {totalAmountLabel ? `Pay ${totalAmountLabel} with ${methodLabel}` : `Pay via ${methodLabel}`}
          </>
        )}
      </button>

      <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-start gap-2.5 text-xs text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          Payments are processed securely by <strong className="text-slate-700">PayMongo</strong>. You will be redirected to{' '}
          {methodLabel} to authorize this payment and returned here once confirmed. Travi never stores your e-wallet PIN or credentials.
        </p>
      </div>
    </div>
  );
}
