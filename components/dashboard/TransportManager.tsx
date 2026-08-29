'use client';

import { useState } from 'react';
import TransportRequestModal from './TransportRequestModal';
import { Truck } from 'lucide-react';

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
      <button 
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border
          ${isAccepted || isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
          ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : ''}
          ${!existingRequest || existingRequest.status === 'declined' || existingRequest.status === 'canceled' ? 'bg-white text-coral-600 border-slate-200 hover:border-coral-300 hover:bg-coral-50' : ''}
        `}
      >
        <Truck className="w-4 h-4" />
        {isAccepted || isCompleted ? 'Transport Confirmed' : 
         isPending ? 'Transport Pending' : 
         'Request Transport'}
      </button>

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
