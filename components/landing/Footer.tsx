import Link from 'next/link';

// /about, /contact, /terms, /privacy, /cookies and /refund-policy are built in Phase 4.
const COLUMNS = [
  {
    title: 'Travelers',
    links: [
      { label: 'Browse Tours', href: '/tours' },
      { label: 'Popular Destinations', href: '/#destinations' },
      { label: 'About Travi', href: '/about' },
      { label: 'Contact & Support', href: '/contact' },
    ],
  },
  {
    title: 'Partners',
    links: [
      { label: 'Become an Organizer', href: '/signup?role=organizer' },
      { label: 'Register as Transport', href: '/signup?role=transporter' },
      { label: 'Partner Dashboard', href: '/dashboard' },
      { label: 'Partner Support', href: '/contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Refund Policy', href: '/refund-policy' },
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
            <p className="text-xs mb-6 max-w-xs leading-relaxed">The premier marketplace for local tours and transport in the Philippines. Discover your next adventure.</p>
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

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>&copy; {new Date().getFullYear()} Travi Philippines. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Made in PH 🇵🇭</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
