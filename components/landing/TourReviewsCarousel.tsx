'use client';

import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

type Review = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  } | {
    id?: string;
    full_name?: string | null;
    avatar_url?: string | null;
  }[];
  user_profiles?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

interface TourReviewsCarouselProps {
  reviews: Review[];
}

export default function TourReviewsCarousel({ reviews }: TourReviewsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1); // -1 for pixel rounding issues
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [reviews]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth : clientWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!reviews || reviews.length === 0) {
    return <p className="text-slate-500">No reviews yet.</p>;
  }

  const avgRating = (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <div className="pt-8 border-t border-slate-100 mt-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Reviews</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
            <Star className="w-5 h-5 fill-coral text-coral" />
            <span className="font-bold text-slate-900 text-lg">{avgRating}</span>
            <span className="text-slate-500">({reviews.length} review{reviews.length === 1 ? '' : 's'})</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-2 rounded-full border border-slate-200 transition-colors ${
                canScrollLeft ? 'hover:bg-slate-50 hover:border-slate-300 text-slate-700' : 'opacity-50 cursor-not-allowed text-slate-300'
              }`}
              aria-label="Previous reviews"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-2 rounded-full border border-slate-200 transition-colors ${
                canScrollRight ? 'hover:bg-slate-50 hover:border-slate-300 text-slate-700' : 'opacity-50 cursor-not-allowed text-slate-300'
              }`}
              aria-label="Next reviews"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-6 pb-6 px-4 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {reviews.map((review) => {
            const reviewerObj = Array.isArray(review.reviewer) ? review.reviewer[0] : review.reviewer;
            const fullName = reviewerObj?.full_name || review.user_profiles?.full_name || 'Anonymous User';
            const avatarUrl = reviewerObj?.avatar_url || review.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0EA5E9&color=fff`;

            return (
              <div
                key={review.id}
                className="flex-none w-[85vw] sm:w-[calc(50%-12px)] snap-center sm:snap-start bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 mb-4">
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-50"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      {fullName}
                    </div>
                    <div className="text-xs font-medium text-slate-400">
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < review.rating ? 'fill-coral text-coral' : 'fill-slate-100 text-slate-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                &ldquo;{review.comment}&rdquo;
              </p>
            </div>
          );
        })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      ` }} />
    </div>
  );
}
