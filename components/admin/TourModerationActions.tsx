'use client';

import { useState } from 'react';
import { EyeOff, Eye, Loader2 } from 'lucide-react';
import { adminRepublishTour, adminUnpublishTour } from '@/actions/admin';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/button';
import InputDialog from '@/components/admin/InputDialog';

export interface ModeratedTour {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  admin_hold_at?: string | null;
  admin_hold_reason?: string | null;
}

interface TourModerationActionsProps {
  tour: ModeratedTour;
  size?: 'xs' | 'sm';
  onChange: (id: string, changes: Partial<ModeratedTour>) => void;
  onError: (message: string) => void;
}

// Admin "Unpublish (with reason)" / "Re-publish" for a tour (OPS-06). Both are audited in the database.
export default function TourModerationActions({ tour, size = 'xs', onChange, onError }: TourModerationActionsProps) {
  const [unpublishing, setUnpublishing] = useState(false);
  const [confirmRepublish, setConfirmRepublish] = useState(false);
  const [pending, setPending] = useState(false);

  const republish = async () => {
    if (pending) return;
    setPending(true);
    const res = await adminRepublishTour(tour.id);
    setPending(false);
    setConfirmRepublish(false);
    if (res.success) onChange(tour.id, { status: 'published', admin_hold_at: null, admin_hold_reason: null });
    else onError(res.error);
  };

  return (
    <>
      {tour.status === 'published' && (
        <Button type="button" variant="lighterror" size={size} onClick={(e) => { e.stopPropagation(); setUnpublishing(true); }}>
          <EyeOff /> Unpublish
        </Button>
      )}
      {tour.status === 'draft' && tour.admin_hold_at && (
        <Button type="button" variant="lightsuccess" size={size} disabled={pending} onClick={(e) => { e.stopPropagation(); setConfirmRepublish(true); }}>
          {pending ? <Loader2 className="animate-spin" /> : <Eye />} Re-publish
        </Button>
      )}

      <InputDialog
        open={unpublishing}
        title={`Unpublish "${tour.title}"?`}
        description="Travelers will no longer see or book it. Existing bookings stay as they are. The organizer is notified with your reason and cannot re-publish until an admin does."
        label="Reason (sent to the organizer)"
        placeholder="e.g. Photos do not match the itinerary"
        multiline
        minLength={3}
        maxLength={1000}
        confirmText="Unpublish"
        destructive
        onClose={() => setUnpublishing(false)}
        onSubmit={async (reason) => {
          const res = await adminUnpublishTour({ tourId: tour.id, reason });
          if (!res.success) return res.error;
          onChange(tour.id, { status: 'draft', admin_hold_at: new Date().toISOString(), admin_hold_reason: reason });
          return null;
        }}
      />

      <ConfirmModal
        isOpen={confirmRepublish}
        title="Re-publish tour?"
        message={`"${tour.title}" will be visible and bookable again, and the organizer will be notified.`}
        confirmText={pending ? 'Re-publishing…' : 'Re-publish'}
        onConfirm={republish}
        onCancel={() => { if (!pending) setConfirmRepublish(false); }}
      />
    </>
  );
}
