'use client';

import { useState } from 'react';
import TransportRequestModal from './TransportRequestModal';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TransportManager({ 
  tourScheduleId, 
  startDate, 
  endDate, 
  capacity,
  existingRequest,
  transportType
}: { 
  tourScheduleId: string;
  startDate: string;
  endDate: string;
  capacity: number;
  existingRequest?: any;
  transportType: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (transportType !== 'external_transporter') return null;

  const isPending = existingRequest?.status === 'pending';
  const isAccepted = existingRequest?.status === 'accepted';
  const isCompleted = existingRequest?.status === 'completed';

  return (
    <>
      <Button 
        type="button"
        size="sm"
        variant={isAccepted || isCompleted ? 'lightsuccess' : isPending ? 'lightwarning' : 'outline'}
        onClick={() => setIsModalOpen(true)}
      >
        <Truck />
        {isAccepted || isCompleted ? 'Transport Confirmed' : 
         isPending ? 'Transport Pending' : 
         'Request Transport'}
      </Button>

      {isModalOpen && (
        <TransportRequestModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          tourScheduleId={tourScheduleId}
          startDate={startDate}
          endDate={endDate}
          capacity={capacity}
          existingRequest={existingRequest}
        />
      )}
    </>
  );
}
