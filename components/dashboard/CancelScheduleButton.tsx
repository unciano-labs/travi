'use client';

import { useState } from 'react';
import { CalendarX2 } from 'lucide-react';
import CancelScheduleDialog from '@/components/dashboard/CancelScheduleDialog';
import { Button } from '@/components/ui/button';

/** "Cancel schedule" trigger for server-rendered pages (BIZ-04). */
export default function CancelScheduleButton({ scheduleId, tourId }: { scheduleId: string; tourId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="lighterror" onClick={() => setOpen(true)}>
        <CalendarX2 />
        Cancel schedule
      </Button>
      <CancelScheduleDialog open={open} onOpenChange={setOpen} scheduleId={scheduleId} tourId={tourId} />
    </>
  );
}
