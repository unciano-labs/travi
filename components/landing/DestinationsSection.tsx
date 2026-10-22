

import Image from 'next/image';
import Link from 'next/link';

export default function DestinationsSection() {
  return (
    <section id="destinations" className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand mb-2">Explore</p>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900">Popular Destinations</h2>
          </div>
          <Link href="/tours" className="shrink-0 text-xs font-bold border border-slate-200 rounded-lg px-4 py-2 hover:border-brand hover:text-brand-dark transition-colors">View All →</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Link href="/tours?destination=Palawan" className="group relative rounded-2xl overflow-hidden lg:col-span-2 h-72 lg:h-96 shadow-card">
            <Image loading="lazy"
              src="https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80"
              alt="El Nido"
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
            <div className="relative z-10 h-full flex flex-col justify-end p-6">
              <span className="inline-block self-start text-[10px] font-bold uppercase tracking-widest bg-brand/90 text-white px-2.5 py-1 rounded-md mb-2">Featured</span>
              <h3 className="text-white font-extrabold text-xl lg:text-2xl">El Nido, Palawan</h3>
              <p className="text-sky-200 text-xs font-semibold mt-0.5">See Palawan tours →</p>
            </div>
          </Link>

          <div className="grid grid-rows-2 gap-5">
            <Link href="/tours?destination=Siargao" className="group relative rounded-2xl overflow-hidden h-44 shadow-card">
              <Image loading="lazy"
                src="https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=80"
                alt="Siargao"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 to-transparent"></div>
              <div className="relative z-10 h-full flex flex-col justify-end p-4">
                <h3 className="text-white font-bold">Siargao Island</h3>
                <p className="text-sky-200 text-xs font-semibold mt-0.5">See Siargao tours →</p>
              </div>
            </Link>
            <Link href="/tours?destination=Batanes" className="group relative rounded-2xl overflow-hidden h-44 shadow-card">
              <Image loading="lazy"
                src="https://images.unsplash.com/photo-1620336655055-088d06e36bf0?auto=format&fit=crop&w=800&q=80"
                alt="Batanes"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 to-transparent"></div>
              <div className="relative z-10 h-full flex flex-col justify-end p-4">
                <h3 className="text-white font-bold">Batanes Province</h3>
                <p className="text-sky-200 text-xs font-semibold mt-0.5">See Batanes tours →</p>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
