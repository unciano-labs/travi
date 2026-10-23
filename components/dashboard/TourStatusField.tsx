'use client';

import { useCallback, useState } from 'react';
import { Label } from '@/components/ui/label';
import TourPublishChecklist from './TourPublishChecklist';

type Status = string;

interface Props {
  isEdit: boolean;
  tourId?: string;
  initialStatus?: string;
  status: Status;
  onStatusChange: (status: Status) => void;
  live: { price: number; hasCover: boolean; itineraryDays: number };
}

const segClass = (active: boolean) =>
  `flex-1 text-sm font-medium py-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-primary text-white shadow-sm' : 'text-bodytext hover:bg-lightprimary hover:text-primary'}`;

/** Tour status switch + publish checklist (BIZ-09). New tours are always saved as drafts. */
export default function TourStatusField({ isEdit, tourId, initialStatus, status, onStatusChange, live }: Props) {
  const [publishReady, setPublishReady] = useState(false);
  const onReadyChange = useCallback((ready: boolean) => setPublishReady(ready), []);
  const publishLocked = !publishReady && initialStatus !== 'published';

  return (
    <>
      <div className="md:col-span-1 space-y-2">
        <Label>Status</Label>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg border border-border" role="group" aria-label="Status">
          <input type="hidden" name="status" value={status} />
          <button type="button" onClick={() => onStatusChange('draft')} aria-pressed={status === 'draft'} className={segClass(status === 'draft')}>
            Draft
          </button>
          {isEdit && (
            <>
              <button
                type="button"
                onClick={() => onStatusChange('published')}
                aria-pressed={status === 'published'}
                disabled={publishLocked}
                title={publishLocked ? 'Complete the checklist below to publish' : undefined}
                className={segClass(status === 'published')}
              >
                Published
              </button>
              <button type="button" onClick={() => onStatusChange('archived')} aria-pressed={status === 'archived'} className={segClass(status === 'archived')}>
                Archived
              </button>
            </>
          )}
        </div>
        {!isEdit && <p className="text-xs text-muted-foreground">New tours are saved as drafts. Add schedules, then publish.</p>}
        {status === 'archived' && initialStatus !== 'archived' && (
          <p className="text-xs text-muted-foreground">Tours with upcoming bookings can&apos;t be archived. Cancel their schedules first.</p>
        )}
      </div>

      <div className="md:col-span-2">
        <TourPublishChecklist tourId={tourId} live={live} onReadyChange={onReadyChange} />
      </div>
    </>
  );
}
