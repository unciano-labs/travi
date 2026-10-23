import Link from 'next/link';
import { COMPANY, LEGAL_REVIEW_COMPLETE, isPlaceholder, legalValue, registrationAuthorityLabel } from '@/lib/legal/company';

// Business identity comes from lib/legal/company.ts (LEG-04); placeholders show as "(to be provided)".
const COLUMNS = [
  {
    title: 'Travelers',
    links: [
      { label: 'Browse Tours', href: '/tours' },
      { label: 'Popular Destinations', href: '/#destinations' },
      { label: 'About Travi', href: '/about' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact & Support', href: '/contact' },
    ],
  },
  {
    title: 'Partners',
    links: [
      { label: 'Become an Organizer', href: '/signup?role=organizer' },
      { label: 'Register as Transport', href: '/signup?role=transporter' },
      { label: 'Partner Dashboard', href: '/dashboard' },
      { label: 'Partner Terms', href: '/partner-terms' },
      { label: 'Partner Support', href: '/contact?topic=partner' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Notice', href: '/privacy' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Refund & Cancellation', href: '/refund-policy' },
      { label: 'File a Complaint', href: '/contact?topic=complaint_organizer' },
    ],
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-deep text-slate-400 py-12 lg:py-16 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-12">

          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" aria-hidden="true">
                <circle cx="16" cy="16" r="15" fill="#0EA5E9" opacity=".2"/>
                <path d="M16 4C10 4 6 8.5 6 14c0 6 5 11 10 14 5-3 10-8 10-14C26 8.5 22 4 16 4z" fill="#0EA5E9"/>
              </svg>
              <span className="text-lg font-extrabold text-white tracking-tight">Travi</span>
            </Link>
            <p className="text-xs mb-6 max-w-xs leading-relaxed">A marketplace for local tours and transport in the Philippines. Discover your next adventure.</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={`${column.title} links`}>
              <h4 className="text-white font-bold text-sm mb-4">{column.title}</h4>
              <ul className="space-y-2.5 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

        </div>

        <address className="not-italic pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2 text-xs mb-6">
          <p><span className="text-slate-300 font-semibold">Operated by:</span> {legalValue(COMPANY.registeredName)}</p>
          <p><span className="text-slate-300 font-semibold">{registrationAuthorityLabel()} reg. no.:</span> {legalValue(COMPANY.registrationNumber)}</p>
          <p><span className="text-slate-300 font-semibold">Address:</span> {legalValue(COMPANY.registeredAddress)}</p>
          <p><span className="text-slate-300 font-semibold">Support:</span> {legalValue(COMPANY.supportEmail)}</p>
        </address>

        <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} {isPlaceholder(COMPANY.registeredName) ? COMPANY.brandName : COMPANY.registeredName}. All rights reserved.{!LEGAL_REVIEW_COMPLETE && ' Policies are drafts pending legal review.'}</p>
          <div className="flex items-center gap-4">
            <span>Made in PH 🇵🇭</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
