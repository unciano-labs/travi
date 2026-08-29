'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getPublicTours } from '@/actions/public';

interface TourListClientProps {
  initialTours: any[];
  initialHasMore: boolean;
}

export default function TourListClient({ initialTours, initialHasMore }: TourListClientProps) {
  const [tours, setTours] = useState(initialTours ?? []);
  const [hasMore, setHasMore] = useState(initialHasMore ?? false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState((initialTours ?? []).length);

  const defaultImage = "https://images.unsplash.com/photo-1544413155-44282362b7ff?auto=format&fit=crop&w=600&q=80";

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const { tours: newTours, hasMore: newHasMore } = await getPublicTours(offset, 100);
      setTours((prev) => [...prev, ...newTours]);
      setOffset((prev) => prev + newTours.length);
      setHasMore(newHasMore);
    } catch (error) {
      console.error("Failed to load more tours:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tours.map((tour: any) => {
          // Determine images for carousel
          const images = tour.image_urls && tour.image_urls.length > 0 
            ? tour.image_urls 
            : [tour.cover_image_url || defaultImage];

          return (
            <div key={tour.id} className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              {/* Image Carousel */}
              <div className="relative h-48 bg-slate-100">
                <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar h-full w-full">
                  {images.map((img: string, idx: number) => (
                    <div key={idx} className="shrink-0 w-full h-full snap-center relative">
                      <Image loading="lazy"
                        src={img} 
                        alt={`${tour.title} - Image ${idx + 1}`} 
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    </div>
                  ))}
                </div>
                
                <div className={`absolute top-3 left-3 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-md shadow-sm ${tour.format === 'private' ? 'bg-indigo-600/90 text-white' : tour.format === 'solo' ? 'bg-fuchsia-600/90 text-white' : 'bg-emerald-600/90 text-white'}`}>
                  {tour.format === 'private' ? 'Private Group' : tour.format === 'solo' ? 'Solo / Couple' : 'Joiner Tour'}
                </div>

                {tour.is_on_sale && (
                  <div className="absolute top-3 right-3 bg-coral text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm animate-pulse">
                    On Sale!
                  </div>
                )}
                
                {/* Dots indicator for carousel if multiple images */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                    {images.map((_: any, idx: number) => (
                      <div key={idx} className="w-1.5 h-1.5 rounded-full bg-white/60 shadow-sm" />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-extrabold text-lg text-slate-900 leading-tight group-hover:text-coral transition-colors">
                    <Link href={`/tours/${tour.slug}`}>{tour.title}</Link>
                  </h3>
                  <div className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold">
                    ★ 4.9
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mb-2 flex-wrap">
                  <span className="flex items-center gap-1">📍 {tour.location}</span>
                  <span className="flex items-center gap-1">⏱️ {tour.duration_days} Day{tour.duration_days > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">👥 Up to {tour.calculated_max_pax} pax</span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mb-4 mt-auto">
                  {(tour.themes || []).map((theme: string) => (
                    <span key={theme} className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 capitalize">
                      {theme.replace('_', ' ')}
                    </span>
                  ))}
                </div>
                
                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Starting at</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-black text-xl text-slate-900 tracking-tight">₱{tour.calculated_lowest_price.toLocaleString()}</span>
                      {tour.is_on_sale && (
                        <span className="text-xs text-slate-400 line-through font-medium">₱{tour.calculated_original_price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <Link 
                    href={`/tours/${tour.slug}`} 
                    className="flex items-center gap-1.5 bg-coral hover:bg-coral/90 text-white transition-all duration-300 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-[0_4px_14px_rgba(255,111,97,0.3)] hover:shadow-[0_6px_20px_rgba(255,111,97,0.4)] hover:-translate-y-0.5"
                  >
                    View Tour
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {tours.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No tours available right now. Check back soon!
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-12 text-center">
          <button 
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-coral text-slate-700 hover:text-coral transition-colors text-sm font-bold px-6 py-3 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Load More Tours'}
          </button>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </>
  );
}
