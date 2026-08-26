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
      const { tours: newTours, hasMore: newHasMore } = await getPublicTours(offset, 6);
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
                      <Image 
                        src={img} 
                        alt={`${tour.title} - Image ${idx + 1}`} 
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    </div>
                  ))}
                </div>
                
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
                  Tour
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
                
                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mb-4 flex-wrap">
                  <span className="flex items-center gap-1">📍 {tour.location}</span>
                  <span className="flex items-center gap-1">⏱️ {tour.duration_days} Day{tour.duration_days > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">👥 Up to {tour.calculated_max_pax} pax</span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Starting at</p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-extrabold text-lg text-slate-900">₱ {tour.calculated_lowest_price.toLocaleString()}</p>
                      {tour.is_on_sale && (
                        <p className="text-xs text-slate-400 line-through">₱ {tour.calculated_original_price.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <Link href={`/tours/${tour.slug}`} className="bg-coral/10 hover:bg-coral text-coral hover:text-white transition-all duration-300 text-xs font-extrabold px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5">
                    View & Book
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
