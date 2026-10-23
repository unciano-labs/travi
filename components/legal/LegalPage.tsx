import Link from 'next/link';
import type { Metadata } from 'next';
import { FileWarning } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { COMPANY, LEGAL_DOCUMENTS, LEGAL_REVIEW_COMPLETE, legalValue, registrationAuthorityLabel, type LegalDocumentKey } from '@/lib/legal/company';

// Shared shell for the public legal and trust pages (brand theme, LEG-01…04, LEG-11).

/** Visible on every policy page until LEGAL_REVIEW_COMPLETE is true (lib/legal/company.ts). */
export function DraftNotice() {
  if (LEGAL_REVIEW_COMPLETE) return null;
  return (
    <div role="note" className="mb-8 flex gap-3 rounded-xl border border-coral/30 bg-coral/5 p-4 text-sm text-slate-700">
      <FileWarning className="mt-0.5 size-5 shrink-0 text-coral" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-slate-900">Draft — pending review by Philippine counsel.</strong>{' '}
        This text describes how Travi works today but has not yet been reviewed by a lawyer. It may change before it takes
        effect. Business details shown as “(to be provided)” are still being completed.
      </p>
    </div>
  );
}

export function legalMetadata(title: string, description: string, path: string): Metadata {
  const fullTitle = `${title} | Travi`;
  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: path, type: 'website' },
  };
}

interface LegalPageProps {
  /** Versioned policy document, or null for About / FAQ / Contact. */
  doc: LegalDocumentKey | null;
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  /** Policy pages show the draft notice; the others only when they quote policy terms. */
  showDraftNotice?: boolean;
}

export default function LegalPage({ doc, eyebrow, title, intro, children, showDraftNotice = true }: LegalPageProps) {
  const meta = doc ? LEGAL_DOCUMENTS[doc] : null;
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-grow">
        <section className="bg-brand-navy pt-28 pb-10 lg:pt-32 lg:pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">{eyebrow}</p>
            <h1 className="text-3xl lg:text-5xl font-extrabold text-white font-display">{title}</h1>
            {meta && (
              <p className="mt-4 text-sm text-slate-300">
                Version {meta.version} · Last updated {meta.lastUpdated} ·{' '}
                {meta.effectiveDate ? `Effective ${meta.effectiveDate}` : 'Not yet in effect'}
              </p>
            )}
          </div>
        </section>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          {showDraftNotice && <DraftNotice />}
          <article className="rounded-2xl bg-white p-6 sm:p-10 shadow-card prose prose-slate max-w-none prose-headings:font-extrabold prose-headings:text-brand-navy prose-h2:text-xl prose-h2:mt-10 prose-h3:text-base prose-a:text-brand-dark prose-li:my-1">
            {intro && <div className="lead text-slate-600">{intro}</div>}
            {children}
          </article>
          <p className="mt-6 text-center text-xs text-slate-500">
            Questions? <Link href="/contact" className="text-brand-dark hover:underline">Contact us</Link> ·{' '}
            Operated by {legalValue(COMPANY.registeredName)}
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** "Who we are" block: the business identity from lib/legal/company.ts (LEG-04). */
export function BusinessIdentity() {
  const rows: [string, string][] = [
    ['Brand', COMPANY.brandName],
    ['Registered business name', legalValue(COMPANY.registeredName)],
    [`${registrationAuthorityLabel()} registration no.`, legalValue(COMPANY.registrationNumber)],
    ['TIN', legalValue(COMPANY.tin)],
    ['Registered address', legalValue(COMPANY.registeredAddress)],
    ['Support email', legalValue(COMPANY.supportEmail)],
    ['Support phone', legalValue(COMPANY.supportPhone)],
  ];
  return (
    <dl className="not-prose grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm sm:grid-cols-[max-content_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-slate-700">{label}</dt>
          <dd className="text-slate-600 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
