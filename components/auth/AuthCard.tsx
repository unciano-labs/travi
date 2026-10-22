import Link from 'next/link';

// Shared brand-theme frame for /login, /signup and /auth/* pages.
export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <Link href="/" className="inline-block font-display font-bold text-3xl text-brand-navy">
          TRAVI <span className="text-coral">Marketplace</span>
        </Link>
        <h1 className="mt-6 text-center text-3xl font-extrabold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
}

export const AUTH_INPUT_CLASS =
  'w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all';

export const AUTH_BUTTON_CLASS =
  'w-full flex justify-center items-center gap-2 bg-coral hover:bg-coral/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40 focus-visible:ring-offset-2';

export function AuthNotice({ tone, children }: { tone: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    error: 'bg-red-50 border-red-100 text-red-600',
    info: 'bg-sky-50 border-sky-100 text-brand-dark',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-6 p-3 border rounded-lg text-sm text-center ${styles}`}>
      {children}
    </div>
  );
}
