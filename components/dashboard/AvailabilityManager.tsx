'use client';

import { useState } from 'react';
import { Calendar, Plus, Trash2, Ban, Clock, Bus, Loader2 } from 'lucide-react';
import { blockVehicleDates, removeAvailabilityBlock } from '@/actions/availability';
import { useRouter } from 'next/navigation';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface AvailabilityManagerProps {
  vehicles: any[];
  initialAvailability: any[];
}

export default function AvailabilityManager({
  vehicles,
  initialAvailability,
}: AvailabilityManagerProps) {
  const router = useRouter();
  const [availabilityList, setAvailabilityList] = useState(initialAvailability);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const filteredAvailability = availabilityList.filter((item) => {
    if (selectedVehicleId === 'all') return true;
    return item.vehicle_id === selectedVehicleId;
  });

  const events = filteredAvailability.map((item) => {
    // Parse dates and ensure they cover the full day for 'allDay' events
    const start = new Date(item.start_date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(item.end_date);
    end.setHours(23, 59, 59, 999);

    const isBooked = item.status === 'booked';
    let title = isBooked ? 'Booked' : 'Blocked';
    if (item.vehicle?.name) {
      title += `: ${item.vehicle.name}`;
      if (item.vehicle?.plate_number) title += ` (${item.vehicle.plate_number})`;
    }

    return {
      id: item.id,
      title,
      start,
      end,
      allDay: true,
      resource: item
    };
  });

  const eventStyleGetter = (event: any) => {
    const isBooked = event.resource.status === 'booked';
    const backgroundColor = isBooked ? '#3b82f6' : '#f59e0b'; // blue-500 : amber-500
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: 'white',
        border: 'none',
        fontSize: '11px',
        padding: '3px 8px',
        fontWeight: 'bold',
        textShadow: '0 1px 1px rgba(0,0,0,0.1)'
      }
    };
  };

  const handleCreateBlock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const form = e.currentTarget;
    const formData = new FormData(form);
    const vehicleId = formData.get('vehicleId') as string;
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const notes = formData.get('notes') as string;

    const res = await blockVehicleDates(vehicleId, startDate, endDate, notes);
    setLoading(false);

    if (res.success) {
      setShowBlockModal(false);
      router.refresh();
    } else {
      setErrorMsg(res.error || 'Failed to block dates.');
    }
  };

  const handleRemoveBlock = async (id: string) => {
    setActionLoading(id);
    const res = await removeAvailabilityBlock(id);
    setActionLoading(null);

    if (res.success) {
      setAvailabilityList((prev) => prev.filter((item) => item.id !== id));
      router.refresh();
    } else {
      alert(res.error || 'Failed to remove block.');
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<any>('month');

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Availability Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Control vehicle availability windows, schedule maintenance blocks, and prevent conflicting bookings.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all flex-1 sm:flex-none"
          >
            <option value="all">All Vehicles ({vehicles.length})</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.vehicle_type})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowBlockModal(true)}
            disabled={vehicles.length === 0}
            className="flex items-center gap-2 bg-coral hover:bg-coral/90 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-coral/20 hover:shadow-lg transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Block Dates
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span>Booked / Reserved (Locked by confirmed trip)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span>Blocked (Maintenance / Private use)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          <span>Open / Available for new requests</span>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm mb-6 calendar-container">
        <style dangerouslySetInnerHTML={{ __html: `
          /* Custom Tailwind Overrides for Big Calendar */
          .rbc-calendar { 
            font-family: inherit; 
            font-size: 0.85rem;
          }
          .rbc-event {
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }
          .rbc-today {
            background-color: #f8fafc;
          }
          .rbc-toolbar button {
            border-radius: 8px;
            border-color: #e2e8f0;
            color: #475569;
            font-weight: 500;
          }
          .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
            background-color: #f1f5f9;
            box-shadow: none;
            border-color: #cbd5e1;
            color: #334155;
          }
        `}} />
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-coral" /> Availability Overview
        </h2>
        <div className="h-[500px]">
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            date={currentDate}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            view={currentView}
            onView={(newView) => setCurrentView(newView)}
            views={['month', 'week', 'agenda']}
            eventPropGetter={eventStyleGetter}
            tooltipAccessor={(event: any) => `${event.title}${event.resource.notes ? `\nNotes: ${event.resource.notes}` : ''}`}
          />
        </div>
      </div>

      {/* Availability List Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Detailed Schedule</h2>
        {filteredAvailability.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No scheduled blocks or bookings</h3>
            <p className="text-sm text-slate-500 mt-1">
              Your vehicles are currently available for all dates. You can manually block dates for servicing or personal use anytime.
            </p>
          </div>
          {vehicles.length > 0 && (
            <button
              onClick={() => setShowBlockModal(true)}
              className="inline-flex items-center gap-2 bg-coral hover:bg-coral/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Block Date Range
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">End Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Details / Notes</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAvailability.map((item) => {
                const isBooked = item.status === 'booked';
                const isRemoving = actionLoading === item.id;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Bus className="w-4 h-4 text-slate-400" />
                        <span>{item.vehicle?.name || 'Unknown Vehicle'}</span>
                      </div>
                      {item.vehicle?.plate_number && (
                        <span className="font-mono text-xs text-slate-400 font-normal">
                          {item.vehicle.plate_number}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {new Date(item.start_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {new Date(item.end_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isBooked
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isBooked ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : (
                          <Ban className="w-3.5 h-3.5" />
                        )}
                        {isBooked ? 'Trip Booked' : 'Maintenance / Blocked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {isBooked && item.booking ? (
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.booking.organizer?.company_name || item.booking.organizer?.display_name || 'Organizer Booking'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.booking.pickup_location} → {item.booking.dropoff_location}
                          </div>
                        </div>
                      ) : (
                        <span>{item.notes || 'No description provided'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isBooked && (
                        <button
                          onClick={() => handleRemoveBlock(item.id)}
                          disabled={isRemoving}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove Block"
                        >
                          {isRemoving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Block Dates Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Ban className="w-5 h-5 text-amber-500" /> Block Vehicle Dates
              </h2>
              <button
                onClick={() => setShowBlockModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Vehicle *
                </label>
                <select
                  name="vehicleId"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.plate_number || v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  name="notes"
                  placeholder="e.g. Scheduled PMS / Maintenance"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-coral hover:bg-coral/90 text-white text-sm font-bold rounded-xl shadow-md shadow-coral/20 transition-all disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
