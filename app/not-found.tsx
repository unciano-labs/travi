import Link from 'next/link';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-coral/10 text-coral rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Compass className="w-10 h-10 animate-spin-slow" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Destination Not Found</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              We couldn&apos;t find the tour, vehicle, or page you were looking for. It may have been relocated or archived.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-coral hover:bg-coral/90 text-white font-bold text-sm rounded-xl shadow-md shadow-coral/20 hover:shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
