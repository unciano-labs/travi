'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { getTourPublishReadiness } from '@/actions/tours';
import type { PublishCheck, PublishCheckKey } from '@/lib/services/tours';

interface Props {
  tourId?: string;
  /** Live values from the form, so the list updates while the organizer edits. */
  live: { price: number; hasCover: boolean; itineraryDays: number };
  onReadyChange?: (ready: boolean) => void;
}

const LABELS: Record<PublishCheckKey, string> = {
  approved: 'Your organizer account is approved',
  itinerary: 'At least one itinerary day with a title',
  schedule: 'At least one open schedule with a future start date',
  price: 'A price per person above ₱0',
  cover: 'A cover image',
};

/** BIZ-09: what a tour still needs before it can be published. The server enforces the same rules. */
export default function TourPublishChecklist({ tourId, live, onReadyChange }: Props) {
  const [server, setServer] = useState<PublishCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTourPublishReadiness(tourId ?? null).then((res) => {
      if (!active) return;
      if (res.success) setServer(res.readiness.checks);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [tourId]);

  const serverOk = (key: PublishCheckKey) => server?.find((c) => c.key === key)?.ok ?? false;
  const checks: { key: PublishCheckKey; ok: boolean }[] = [
    { key: 'approved', ok: serverOk('approved') },
    { key: 'itinerary', ok: live.itineraryDays > 0 },
    { key: 'schedule', ok: Boolean(tourId) && serverOk('schedule') },
    { key: 'price', ok: live.price > 0 },
    { key: 'cover', ok: live.hasCover },
  ];
  const ready = server !== null && checks.every((c) => c.ok);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4" aria-live="polite">
      <p className="mb-3 text-sm font-semibold text-foreground">Before you can publish</p>
      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : server === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.key} className={`flex items-start gap-2 ${c.ok ? 'text-successemphasis' : 'text-bodytext'}`}>
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span>
                <span className="sr-only">{c.ok ? 'Done: ' : 'Missing: '}</span>
                {LABELS[c.key]}
                {!c.ok && c.key === 'schedule' && (
                  tourId ? (
                    <>
                      {' '}
                      <Link href={`/dashboard/organizer/tours/${tourId}/edit?tab=schedules`} className="font-medium text-primary underline">
                        Add a schedule
                      </Link>
                    </>
                  ) : (
                    <span className="text-muted-foreground"> (save as a draft first, then add schedules)</span>
                  )
                )}
                {!c.ok && c.key === 'approved' && <span className="text-muted-foreground"> (pending admin review)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
