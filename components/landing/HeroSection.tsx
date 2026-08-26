"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Search, Calendar, MapPin, Plus, Minus } from "lucide-react";

export default function HeroSection() {
  const [pax, setPax] = useState(2);
  const [location, setLocation] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleQuickSearch = (loc: string) => {
    setLocation(loc);
  };

  return (
    <section id="home" className="relative bg-brand-navy overflow-hidden min-h-screen flex items-center">
      <Image 
        src="https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=2000&q=80" 
        alt="El Nido Palawan" 
        fill
        priority
        sizes="100vw"
        className="object-cover" 
      />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/75 via-brand-navy/60 to-brand-navy/85" />
      
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 lg:pt-32 pb-16">
        <div className={`max-w-2xl transition-all duration-700 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-sky-300 text-sm font-bold uppercase tracking-widest mb-3">🇵🇭 Philippines Tour Marketplace</p>
          <h1 className="font-display font-extrabold leading-tight text-4xl sm:text-5xl lg:text-6xl">
            <span className="text-shimmer">Discover the</span><br/>
            <span className="text-white">Philippines</span><br/>
            <em className="text-coral not-italic font-display">Your Way</em>
          </h1>
          <p className="text-slate-300 mt-5 max-w-lg text-sm sm:text-base leading-relaxed">
            Browse curated local tour packages from trusted organizers. From island hopping in Palawan to mountain treks in Benguet — find your perfect adventure.
          </p>
        </div>

        <div className={`mt-10 max-w-3xl transition-all duration-700 delay-100 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 shadow-lift">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] divide-y sm:divide-y-0 sm:divide-x divide-white/15">
                
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300"><MapPin size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sky-200/80 mb-0.5">Where</label>
                    <input type="text" placeholder="Palawan, Siargao..." value={location} onChange={e => setLocation(e.target.value)} className="w-full bg-transparent text-white placeholder:text-slate-400 font-semibold focus:outline-none text-sm" required />
                  </div>
                </div>

                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300"><Calendar size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sky-200/80 mb-0.5">Start Date</label>
                    <input type="date" className="w-full bg-transparent text-white font-semibold focus:outline-none text-sm [color-scheme:dark]" required />
                  </div>
                </div>

                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="shrink-0 grid place-items-center w-9 h-9 rounded-lg bg-sky-500/20 text-sky-300"><Calendar size={20} /></div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sky-200/80 mb-0.5">End Date</label>
                    <input type="date" className="w-full bg-transparent text-white font-semibold focus:outline-none text-sm [color-scheme:dark]" required />
                  </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sky-200/80 mb-0.5">Travelers</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setPax(Math.max(1, pax - 1))} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors"><Minus size={14}/></button>
                      <input type="number" value={pax} readOnly className="w-8 bg-transparent text-white font-semibold text-center text-sm focus:outline-none" />
                      <button type="button" onClick={() => setPax(pax + 1)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors"><Plus size={14}/></button>
                    </div>
                  </div>
                  <button type="submit" className="shrink-0 bg-brand hover:bg-brand-dark hover:-translate-y-0.5 active:scale-95 transition-all text-white text-sm font-extrabold px-6 py-3.5 rounded-xl shadow-lg shadow-brand/20 flex items-center gap-2 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <span className="relative flex items-center gap-2"><Search size={16} /> Find My Adventure</span>
                  </button>
                </div>

              </div>
            </form>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-slate-300 font-medium">Popular:</span>
            {['Palawan', 'Siargao', 'Batanes', 'Sagada', 'Boracay'].map(dest => (
              <button key={dest} onClick={() => handleQuickSearch(dest)} className="text-xs bg-white/10 hover:bg-white/20 text-white font-semibold px-3 py-1.5 rounded-full transition-colors border border-white/20">
                {dest}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
