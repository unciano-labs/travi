"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "./hero.css"; // We extracted the reference CSS here
import { MapPin, Calendar, Users, Search, Minus, Plus } from "lucide-react";
import { manilaToday } from "@/lib/datetime";

// Unsplash License (free commercial use). Served through next/image, so it is resized, optimized and
// delivered from this site's own /_next/image endpoint.
const HERO_IMAGE = "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1920&q=80";
const REEL_POSTER = "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=800&q=70";

const DESTS = [
  { name: "Palawan", tag: "El Nido, Coron & island hopping", type: "dest" },
  { name: "Siargao", tag: "Surf, lagoons & Naked Island", type: "dest" },
  { name: "Boracay", tag: "Sunset sails & white beach", type: "dest" },
  { name: "Cebu", tag: "Canyoneering & whale sharks", type: "dest" },
  { name: "Bohol", tag: "Chocolate Hills & tarsiers", type: "dest" },
  { name: "Sagada", tag: "Cloud seas & cave treks", type: "dest" },
  { name: "Batanes", tag: "Rolling hills & lighthouses", type: "dest" },
  { name: "Vigan", tag: "Heritage streets & calesa", type: "dest" },
  { name: "Island hopping", tag: "Activity · Palawan, Siargao & more", type: "act" },
  { name: "Canyoneering", tag: "Activity · Cebu (Kawasan)", type: "act" },
  { name: "Scuba diving", tag: "Activity · certified & discover", type: "act" },
  { name: "Sunset cruise", tag: "Activity · Boracay & Manila Bay", type: "act" }
];

export default function HeroSection() {
  const router = useRouter();
  const [destQuery, setDestQuery] = useState("");
  const [showDestList, setShowDestList] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // Set after mount so server and client markup match (the date depends on "now").
  const [today, setToday] = useState<string | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setTimeout(() => setToday(manilaToday()), 0);
    // Play video after mount
    if (videoRef.current) {
      videoRef.current.play().then(() => setIsPaused(false)).catch(() => setIsPaused(true));
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destQuery.trim()) params.set("q", destQuery.trim());
    if (startDate) params.set("from", startDate);
    if (endDate) params.set("to", endDate);
    params.set("guests", String(travelers));
    router.push(`/tours?${params.toString()}`);
  };

  const toggleVideo = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPaused(false);
      } else {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const filteredDests = destQuery.trim() === "" 
    ? DESTS.slice(0, 5) 
    : DESTS.filter(d => d.name.toLowerCase().includes(destQuery.toLowerCase()) || d.tag.toLowerCase().includes(destQuery.toLowerCase())).slice(0, 6);

  return (
    <section className="hero" aria-labelledby="heroTitle">
      <Image
        className="hero-bg"
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
      />
      <div className="hero-overlay" aria-hidden="true"></div>

      <div className="container hero-inner">
        <div className="hero-stack">
          <p className="eyebrow">🇵🇭 Philippines tour marketplace</p>
          <h1 id="heroTitle">
            The Philippines, <em>minus the planning stress.</em>
          </h1>
          <p className="sub">
            Compare and book tours run by local organizers — from Palawan island-hopping
            to Sagada treks. Pay securely with GCash or Maya.
          </p>

          <form className="bg-white rounded-xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 text-slate-800" id="bookingForm" role="search" aria-label="Search tours" onSubmit={handleSearch}>
            <div className="relative">
              <label htmlFor="destInput" className="flex items-center gap-1.5 text-sm font-bold text-brand mb-1.5">
                <MapPin size={16} /> Where do you want to go?
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-brand">
                  <MapPin size={18} />
                </div>
                <input
                  id="destInput"
                  role="combobox"
                  aria-expanded={showDestList}
                  aria-controls={showDestList ? "destList" : undefined}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="Type a destination or activity (e.g., Palawan, Island Hopping)"
                  className="w-full border border-slate-200 rounded-lg pl-10 pr-10 py-3 text-slate-700 font-medium focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  onFocus={() => setShowDestList(true)}
                  onBlur={() => setTimeout(() => setShowDestList(false), 200)}
                />
                {destQuery && (
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear destination" onClick={() => setDestQuery("")}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 font-medium">Try: Beach tours, Mountain trekking, or specific locations</p>

              {showDestList && (
                <ul id="destList" className="absolute left-0 right-0 top-full mt-2 z-50 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto p-2">
                  {filteredDests.length > 0 ? (
                    filteredDests.map((d, i) => (
                      <li key={i} role="option" aria-selected="false" className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer" onClick={() => setDestQuery(d.name)}>
                        <MapPin size={16} className="text-brand flex-shrink-0" />
                        <span className="font-bold text-slate-800">{d.name}</span>
                        <span className="text-xs text-slate-500 flex-1 truncate">{d.tag}</span>
                      </li>
                    ))
                  ) : (
                    <li className="p-3 text-sm text-slate-500 text-center">No suggestions found</li>
                  )}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-brand mb-1.5">
                  <Calendar size={16} /> Travel Dates
                </label>
                <div className="relative flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-colors">
                  <input
                    type="date"
                    className="w-full pl-3 py-3.5 text-slate-700 font-medium focus:outline-none text-sm bg-transparent"
                    aria-label="Earliest departure date"
                    value={startDate}
                    min={today}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                    }}
                  />
                  <span className="text-slate-400 font-bold px-1 text-sm">➔</span>
                  <input
                    type="date"
                    className="w-full pr-3 py-3.5 text-slate-700 font-medium focus:outline-none text-sm bg-transparent"
                    aria-label="Latest departure date"
                    value={endDate}
                    min={startDate || today}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-bold text-brand mb-1.5">
                  <Users size={16} /> Travelers
                </label>
                <div className="flex items-center justify-between border border-slate-200 rounded-lg p-1.5 h-[50px]">
                  <button type="button" aria-label="Fewer travelers" className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors" onClick={() => setTravelers(Math.max(1, travelers - 1))} disabled={travelers <= 1}>
                    <Minus size={14} />
                  </button>
                  <div className="font-bold text-slate-800">
                    <span className="text-lg">{travelers}</span> <span className="font-medium text-sm text-slate-600">travelers</span>
                  </div>
                  <button type="button" aria-label="More travelers" className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors" onClick={() => setTravelers(Math.min(12, travelers + 1))} disabled={travelers >= 12}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="group w-full bg-gradient-to-r from-brand to-brand-dark hover:from-brand-dark hover:to-sky-700 shadow-[0_8px_20px_rgba(14,165,233,0.3)] hover:shadow-[0_12px_28px_rgba(14,165,233,0.5)] transform hover:-translate-y-0.5 text-white font-bold text-lg py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 mt-2">
              <Search size={20} className="group-hover:scale-110 transition-transform duration-300" /> Find My Perfect Tour
            </button>

            <div className="flex flex-wrap items-center justify-between pt-6 border-t border-slate-100 gap-4">
              <div className="flex items-center gap-4 md:gap-6 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Free cancellation
                </span>
                <span className="flex items-center gap-1.5 hidden sm:flex">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-brand" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Instant confirmation
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="hidden md:inline">Secure Payment:</span>
                <div className="flex items-center gap-2">
                  <div className="bg-white px-2 py-1.5 rounded flex items-center justify-center border border-slate-200 h-7 w-11 shadow-sm">
                    <svg className="h-[10px] w-auto" viewBox="0 0 25.5 8.3" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 0l-1.7 8.3h2.6l1.7-8.3zm7-0.2c-1.3 0-2.3.4-2.8 1.1-.5.7-.6 1.3-.6 1.8 0 1 .8 1.5 1.5 1.8.7.3 1 .6 1 .9 0 .5-.6.7-1.1.7-.8 0-1.3-.1-1.8-.4l-.2-.1-.3 1.7c.5.2 1.3.4 2.1.4 2.3 0 3.8-1 3.8-2.6 0-.8-.4-1.5-1.5-2-.6-.3-1-.5-1-.8 0-.3.3-.6 1-.6.7 0 1.2.2 1.6.3l.2.1.3-1.7c-.5-.2-1.1-.4-1.9-.4zm-8.8 8.4h2.5L9.6 0H7.7c-.4 0-.7.2-.8.5l-3 7h-.1l-.1-.4-1.4-5.9c-.1-.4-.5-.6-.9-.6H0l.1.3c1 .2 2.1.6 2.8 1l.2.4 1.7 6h2.7l1.7-8.3zm15.1-8.3h-2c-.4 0-.7.1-.9.5L17.7 8.1h2.6l.5-1.4h3.1l.3 1.4h2.4L24.3-0.1h.1zM21 5.4l.7-1.9c0-.1.1-.2.1-.2.3.9 1 2.9 1 2.9H21z" fill="#1434CB"/>
                    </svg>
                  </div>
                  <div className="bg-white px-2 py-1 rounded flex items-center justify-center border border-slate-200 h-7 w-11 shadow-sm">
                    <svg className="h-[14px] w-auto" viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="12" fill="#EB001B"/>
                      <circle cx="24" cy="12" r="12" fill="#F79E1B" fillOpacity="0.85"/>
                    </svg>
                  </div>
                  <div className="bg-white px-1.5 py-1 rounded flex items-center justify-center border border-slate-200 h-7 shadow-sm">
                    <div className="flex items-center gap-1 font-bold text-[#0D3B66] text-[10px] tracking-tight">
                      <svg className="h-3.5 w-3.5 text-[#E63946]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                        <circle cx="6.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                        <circle cx="17.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
                        <circle cx="6.5" cy="17.5" r="1" fill="currentColor" stroke="none" />
                      </svg>
                      QRPh
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="below">
            <div className="popular">
              <span>Popular:</span>
              <button type="button" className="chip" onClick={() => setDestQuery("Palawan")}>Palawan</button>
              <button type="button" className="chip" onClick={() => setDestQuery("Siargao")}>Siargao</button>
              <button type="button" className="chip" onClick={() => setDestQuery("Batanes")}>Batanes</button>
              <button type="button" className="chip" onClick={() => setDestQuery("Sagada")}>Sagada</button>
              <button type="button" className="chip" onClick={() => setDestQuery("Boracay")}>Boracay</button>
            </div>
            <p className="urgency">
              <span className="dot" aria-hidden="true"></span>
              High demand today: 3 spots left on El Nido Island Hopping (small group).
            </p>
          </div>
        </div>

        <aside className="reel" aria-label="Destination video">
          <div className="reel-frame" data-mode="ambient">
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              poster={REEL_POSTER}
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
            ></video>
            <div className="reel-shade" aria-hidden="true"></div>
            <button className="reel-pause" onClick={toggleVideo} aria-pressed={isPaused} aria-label="Pause ambient video">
              {isPaused ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5 20 12 7 19.5z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                </svg>
              )}
            </button>
            <div className="reel-cap">
              <strong>Water that resets you</strong>
              <span>Palawan</span>
              <button className="cap-btn" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.6 3c.4 2.2 1.9 3.9 4.4 4.1v3c-1.7 0-3.2-.6-4.4-1.5v6.6a5.9 5.9 0 1 1-5.9-5.9c.3 0 .7 0 1 .1v3.1a2.9 2.9 0 1 0 2 2.8V3h2.9z" />
                </svg>
                Watch @travi.ph on TikTok
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
