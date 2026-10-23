'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { submitSupportMessage } from '@/actions/support';
import { SUPPORT_TOPICS, SUPPORT_TOPIC_LABELS, type SupportTopic } from '@/lib/schemas/legal';

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:border-brand';

// /contact form (brand theme). Client component: shows pending/sent states. LEG-06, OPS-05.
export default function ContactForm({ defaultTopic }: { defaultTopic?: SupportTopic }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const res = await submitSupportMessage(formData);
      if (res.success) setSent(true);
      else setError(res.error);
    });
  };

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-5" aria-hidden="true" /> Message sent</p>
        <p className="mt-2">Thank you. Our team will reply to the email address you gave us.</p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5" noValidate={false}>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Honeypot for bots: hidden from people and assistive technology. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
          <input id="contact-name" name="name" type="text" required maxLength={120} autoComplete="name" className={INPUT} />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
          <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-topic" className="mb-1 block text-sm font-medium text-slate-700">Topic</label>
          <select id="contact-topic" name="topic" required defaultValue={defaultTopic ?? ''} className={INPUT}>
            <option value="" disabled>Choose a topic…</option>
            {SUPPORT_TOPICS.map((t) => <option key={t} value={t}>{SUPPORT_TOPIC_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="contact-booking" className="mb-1 block text-sm font-medium text-slate-700">
            Booking reference <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="contact-booking"
            name="bookingRef"
            type="text"
            maxLength={9}
            placeholder="BK-1A2B3C"
            pattern="[Bb][Kk]-[0-9A-Fa-f]{6}"
            title="Booking references look like BK-1A2B3C"
            className={`${INPUT} uppercase`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-slate-700">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          aria-describedby="contact-message-hint"
          className={INPUT}
        />
        <p id="contact-message-hint" className="mt-1 text-xs text-slate-500">
          For a complaint, tell us what happened, when, and what you would like us to do. Please do not include payment
          PINs or passwords.
        </p>
      </div>

      <p className="text-xs text-slate-500">
        We use your message and contact details only to answer you and to handle your complaint, as described in our{' '}
        <Link href="/privacy" className="text-brand-dark hover:underline">Privacy Notice</Link>.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-coral px-6 py-3 font-bold text-white transition-colors hover:bg-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 disabled:opacity-70 sm:w-auto"
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
