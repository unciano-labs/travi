'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';

interface TourGalleryProps {
  images: string[];
  tourTitle: string;
}

export default function TourGallery({ images, tourTitle }: TourGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isOpen = activeIndex !== null;
  const total = images.length;

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : (prev - 1 + total) % total));
  }, [total]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev === null ? null : (prev + 1) % total));
  }, [total]);

  useEffect(() => {
    if (!isOpen || total <= 1) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, total, goPrev, goNext]);

  const currentUrl = activeIndex !== null ? images[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`Open gallery image ${i + 1} of ${total} for ${tourTitle}`}
            className="aspect-[4/3] rounded-xl overflow-hidden shadow-sm relative group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            <Image
              src={url}
              alt={`${tourTitle} image ${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <span
              className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors duration-300 flex items-end justify-end p-2.5"
              aria-hidden="true"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/90 text-slate-800 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Expand className="w-4 h-4" />
              </span>
            </span>
          </button>
        ))}
      </div>

      <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && setActiveIndex(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-label={`${tourTitle} gallery`}
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-5xl flex flex-col items-center justify-center focus:outline-none"
          >
            <DialogPrimitive.Title className="sr-only">
              {tourTitle} — Photo {activeIndex !== null ? activeIndex + 1 : 1} of {total}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Use the previous and next buttons or arrow keys to browse tour gallery photos.
            </DialogPrimitive.Description>

            {/* Top bar: counter + close */}
            <div className="w-full max-w-5xl flex items-center justify-between text-white mb-3 px-1">
              <span className="text-sm font-semibold text-white/90" aria-live="polite">
                {activeIndex !== null ? `${activeIndex + 1} / ${total}` : ''}
              </span>
              <DialogPrimitive.Close
                aria-label="Close image modal"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </DialogPrimitive.Close>
            </div>

            {/* Main image + Prev/Next controls */}
            <div className="relative w-full max-w-5xl h-[62vh] sm:h-[72vh] flex items-center justify-center">
              {currentUrl && (
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900/60">
                  <Image
                    src={currentUrl}
                    alt={`${tourTitle} image ${(activeIndex ?? 0) + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-contain"
                    priority
                  />
                </div>
              )}

              {total > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous image"
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white border border-white/20 shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronLeft className="w-6 h-6" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next image"
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white border border-white/20 shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <ChevronRight className="w-6 h-6" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {total > 1 && (
              <div className="mt-4 flex items-center gap-2 overflow-x-auto max-w-full py-1 px-1">
                {images.map((url, i) => (
                  <button
                    key={`thumb-${url}-${i}`}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    aria-label={`View image ${i + 1}`}
                    aria-current={i === activeIndex ? 'true' : undefined}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      i === activeIndex
                        ? 'border-coral opacity-100 scale-105'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image
                      src={url}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
