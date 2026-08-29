'use client';

import { useState, useRef, useEffect } from 'react';
import { createSchedule, updateSchedule, deleteSchedule } from '@/actions/schedules';
import { getAvailableVehicles, toggleFavoriteVehicle } from '@/actions/vehicles';
import { Plus, Edit2, X, Trash2, Search, Heart, MapPin } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function ScheduleForm({ tourId, basePrice, initialData }: { tourId: string, basePrice?: number, initialData?: any }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();
  
  const [range, setRange] = useState<DateRange | undefined>(
    initialData ? { 
      from: parseISO(initialData.start_date), 
      to: parseISO(initialData.end_date) 
    } : undefined
  );
  
  const isEdit = !!initialData;
  const formRef = useRef<HTMLFormElement>(null);
  const [transportType, setTransportType] = useState(initialData?.transport_type || 'none');
  
  // New States for Inline Vehicle Selection
  const [capacity, setCapacity] = useState<string>(initialData?.capacity?.toString() || '');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(initialData?.transport_booking?.vehicle_id || null);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(initialData?.transport_booking?.pickup_location || '');
  const [dropoffLocation, setDropoffLocation] = useState(initialData?.transport_booking?.dropoff_location || '');
  const [pickupTime, setPickupTime] = useState(initialData?.transport_booking?.pickup_datetime ? format(parseISO(initialData.transport_booking.pickup_datetime), 'HH:mm') : '08:00');
  const [returnTime, setReturnTime] = useState(initialData?.transport_booking?.return_datetime ? format(parseISO(initialData.transport_booking.return_datetime), 'HH:mm') : '');

  // Fetch Vehicles Effect
  useEffect(() => {
    if (transportType === 'external_transporter' && range?.from && range?.to && capacity && parseInt(capacity, 10) > 0) {
      const fetchVehicles = async () => {
        setLoadingVehicles(true);
        try {
          const data = await getAvailableVehicles(
            format(range.from!, 'yyyy-MM-dd'),
            format(range.to!, 'yyyy-MM-dd'),
            parseInt(capacity, 10)
          );
          
          let normalizedData = data.map((v: any) => ({
            ...v,
            transporter: Array.isArray(v.transporter) ? v.transporter[0] : v.transporter
          }));
          
          normalizedData.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1;
            if (!a.is_favorite && b.is_favorite) return 1;
            return 0;
          });
          
          setVehicles(normalizedData);
        } catch (e) {
          console.error(e);
        }
        setLoadingVehicles(false);
      };
      fetchVehicles();
    } else {
      setVehicles([]);
    }
  }, [transportType, range, capacity]);

  const handleToggleFavorite = async (e: React.MouseEvent, vehicleId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistic UI update
    setVehicles(prev => {
      const updated = prev.map(v => 
        v.id === vehicleId ? { ...v, is_favorite: !v.is_favorite } : v
      );
      return updated.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return 0;
      });
    });

    try {
      const res = await toggleFavoriteVehicle(vehicleId);
      if (res.error) throw new Error(res.error);
      
      setVehicles(prev => {
        const updated = prev.map(v => 
          v.id === vehicleId ? { ...v, is_favorite: res.is_favorite } : v
        );
        return updated.sort((a, b) => {
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return 0;
        });
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  async function handleSubmit(formData: FormData) {
    if (!range?.from || !range?.to) {
      setError("Please select a complete date range.");
      return;
    }
    
    if (transportType === 'external_transporter') {
      if (!selectedVehicle || !pickupLocation || !dropoffLocation) {
        setError("Please select a vehicle and fill in pickup/dropoff locations.");
        return;
      }
      formData.append('vehicleId', selectedVehicle);
      formData.append('pickupLocation', pickupLocation);
      formData.append('dropoffLocation', dropoffLocation);
      formData.append('pickupDatetime', `${format(range.from, 'yyyy-MM-dd')}T${pickupTime}:00`);
      if (returnTime) {
        formData.append('returnDatetime', `${format(range.to, 'yyyy-MM-dd')}T${returnTime}:00`);
      }
      
      const transporterId = vehicles.find(v => v.id === selectedVehicle)?.transporter_id;
      if (transporterId) formData.append('transporterId', transporterId);
    }
    
    setError(null);
    setLoading(true);
    
    // Override dates with the range picker
    formData.set('startDate', format(range.from, 'yyyy-MM-dd'));
    formData.set('endDate', format(range.to, 'yyyy-MM-dd'));
    
    let res;
    if (isEdit) {
      res = await updateSchedule(initialData.id, tourId, formData);
    } else {
      res = await createSchedule(tourId, formData);
    }
    
    if (res?.error) {
      setError(res.error);
    } else {
      // success
      if (isEdit) {
        // Clear edit state by removing search param
        router.push(`?tab=schedules`);
      } else {
        formRef.current?.reset();
        setRange(undefined);
      }
    }
    
    setLoading(false);
  }

  const cancelEdit = () => {
    router.push(`?tab=schedules`);
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setError(null);
    setShowDeleteModal(false);
    
    const res = await deleteSchedule(initialData.id, tourId);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    } else {
      router.push(`?tab=schedules`);
    }
  };

  const promptDelete = () => {
    setShowDeleteModal(true);
  };

  return (
    <>
    <form ref={formRef} action={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {isEdit ? <Edit2 className="w-5 h-5 text-coral-600" /> : <Plus className="w-5 h-5 text-coral-600" />} 
          {isEdit ? 'Edit Schedule' : 'Add New Schedule'}
        </h2>
        {isEdit && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={promptDelete} className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-medium">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <div className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col items-center">
        <label className="block text-sm font-medium text-slate-700 mb-2 w-full text-left">
          Date Range
          {range?.from && (
            <span className="ml-2 font-normal text-slate-500">
              ({format(range.from, 'MMM d, yyyy')} {range.to ? `- ${format(range.to, 'MMM d, yyyy')}` : ''})
            </span>
          )}
        </label>
        <DayPicker
          mode="range"
          defaultMonth={range?.from || new Date()}
          selected={range}
          onSelect={setRange}
          modifiersClassNames={{
            selected: 'bg-coral text-white',
            range_middle: 'bg-coral/10 text-coral',
            range_start: 'bg-coral text-white rounded-l-md',
            range_end: 'bg-coral text-white rounded-r-md'
          }}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
          <input type="number" name="capacity" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Seats e.g. 12" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Original Price (₱)</label>
          <input type="number" step="0.01" name="original_price" min="0" defaultValue={initialData?.original_price || ''} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Compare-at price" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₱)</label>
          <input type="number" step="0.01" name="price_per_person" min="0" defaultValue={initialData?.price_per_person || ''} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder={basePrice ? `Default: ₱${basePrice}` : "Optional override"} />
        </div>
      </div>
      
      <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
        <label className="block text-sm font-medium text-slate-700">Transport Requirement</label>
        <select name="transport_type" value={transportType} onChange={e => setTransportType(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white">
          <option value="none">None (Travelers meet at location)</option>
          <option value="self_provided">Self-provided (We will provide the transport)</option>
          <option value="external_transporter">External Transporter (Need to book a vehicle)</option>
        </select>
        {transportType === 'external_transporter' && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-6">
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Location</label>
                    <input type="text" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} disabled={initialData?.transport_booking?.status === 'accepted' || initialData?.transport_booking?.status === 'completed'} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none disabled:bg-slate-50 disabled:text-slate-500" placeholder="e.g., Airport Terminal 1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dropoff Location</label>
                    <input type="text" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} disabled={initialData?.transport_booking?.status === 'accepted' || initialData?.transport_booking?.status === 'completed'} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none disabled:bg-slate-50 disabled:text-slate-500" placeholder="e.g., Hotel Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Time</label>
                    <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} disabled={initialData?.transport_booking?.status === 'accepted' || initialData?.transport_booking?.status === 'completed'} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Return Time (Optional)</label>
                    <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} disabled={initialData?.transport_booking?.status === 'accepted' || initialData?.transport_booking?.status === 'completed'} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none disabled:bg-slate-50 disabled:text-slate-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Vehicle Selection</h3>
                    {(initialData?.transport_booking?.status !== 'accepted' && initialData?.transport_booking?.status !== 'completed') && (
                      <button 
                        type="button" 
                        onClick={() => setIsVehicleModalOpen(true)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        {selectedVehicle ? 'Change Vehicle' : 'Select Vehicle'}
                      </button>
                    )}
                  </div>
                  
                  {selectedVehicle ? (
                    (() => {
                      const v = vehicles.find(v => v.id === selectedVehicle) || (initialData?.transport_booking?.vehicle_id === selectedVehicle && initialData.transport_booking.vehicle ? {
                        ...initialData.transport_booking.vehicle,
                        transporter: initialData.transport_booking.transporter
                      } : null);
                      
                      if (!v) {
                        return (
                          <div className="p-4 rounded-xl border-2 border-coral-500 bg-coral-50 flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-slate-900">Selected Vehicle</h4>
                              <p className="text-sm text-slate-600">ID: {selectedVehicle}</p>
                            </div>
                            {(initialData?.transport_booking?.status !== 'accepted' && initialData?.transport_booking?.status !== 'completed') && (
                              <button type="button" onClick={() => setSelectedVehicle(null)} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full">
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      }

                      const bookingStatus = (initialData?.transport_booking?.vehicle_id === selectedVehicle) 
                        ? initialData.transport_booking.status 
                        : null;
                        
                      return (
                        <div className="p-4 rounded-xl border-2 border-coral-500 bg-coral-50 flex items-start justify-between relative">
                          <div className="flex items-center gap-4">
                            {v.photos && v.photos.length > 0 ? (
                              <div className="w-16 h-16 rounded-md bg-white overflow-hidden shrink-0 border border-coral-200 shadow-sm">
                                <img src={v.photos[0]} alt="Vehicle" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-md bg-white flex items-center justify-center shrink-0 border border-coral-200 shadow-sm">
                                <span className="text-2xl">🚐</span>
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="font-bold text-slate-900">{v.name}</h4>
                                {bookingStatus === 'accepted' ? <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold shadow-sm">✅ Accepted</span> :
                                 bookingStatus === 'declined' ? <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold shadow-sm">❌ Declined</span> :
                                 bookingStatus === 'pending' ? <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold shadow-sm">⏳ Pending</span> :
                                 <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold shadow-sm">Draft Selection</span>}
                              </div>
                              <p className="text-sm text-slate-600 font-medium">{v.transporter?.display_name || v.transporter?.company_name}</p>
                              <div className="flex gap-2 mt-1.5">
                                <span className="text-xs bg-white border border-coral-100 text-coral-700 px-2 py-0.5 rounded-full font-bold">{v.vehicle_type}</span>
                                <span className="text-xs bg-white border border-coral-100 text-coral-700 px-2 py-0.5 rounded-full font-bold">💺 {v.seat_capacity} Seats</span>
                              </div>
                            </div>
                          </div>
                          {(initialData?.transport_booking?.status !== 'accepted' && initialData?.transport_booking?.status !== 'completed') && (
                            <button 
                              type="button" 
                              onClick={() => setSelectedVehicle(null)} 
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-full shrink-0"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                      <p className="text-sm text-slate-500">No vehicle selected. Please select a vehicle for external transport.</p>
                    </div>
                  )}
                </div>

                {/* Vehicle Selection Modal */}
                {isVehicleModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">Select a Vehicle</h2>
                          <p className="text-sm text-slate-500 mt-1">Available vehicles for {capacity} passengers</p>
                        </div>
                        <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                        {!range?.from || !range?.to || !capacity ? (
                          <div className="text-center py-8">
                            <p className="text-slate-500">Please fill in the date range and capacity to see available vehicles.</p>
                          </div>
                        ) : loadingVehicles ? (
                          <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-500"></div>
                          </div>
                        ) : vehicles.length === 0 ? (
                          <div className="text-center py-12">
                            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-600 font-medium">No vehicles found</p>
                            <p className="text-sm text-slate-500 mt-1">There are no vehicles with enough capacity available for these dates.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehicles.map((v) => (
                              <div 
                                key={v.id} 
                                onClick={() => {
                                  setSelectedVehicle(v.id);
                                  setIsVehicleModalOpen(false);
                                }}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedVehicle === v.id ? 'border-coral-500 bg-coral-50 shadow-md' : 'border-slate-200 hover:border-coral-200 bg-white shadow-sm'}`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-3">
                                    {v.photos && v.photos.length > 0 ? (
                                      <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                        <img src={v.photos[0]} alt={v.name} className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                                        <span className="text-2xl">🚐</span>
                                      </div>
                                    )}
                                    <h4 className="font-bold text-slate-900 text-lg">{v.name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      type="button"
                                      onClick={(e) => handleToggleFavorite(e, v.id)} 
                                      className={`p-1.5 rounded-full transition-colors ${v.is_favorite ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                      title={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                    >
                                      <Heart className={`w-5 h-5 ${v.is_favorite ? 'fill-current' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-sm text-slate-600 space-y-2 mb-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                                      {v.vehicle_type}
                                    </span>
                                    <span>•</span>
                                    <span>💺 {v.seat_capacity} Seats</span>
                                  </div>
                                  <p className="flex items-center gap-2">🏢 {v.transporter.display_name || v.transporter.company_name}</p>
                                  {v.rate_per_day && <p className="font-medium text-slate-900">💰 ₱{v.rate_per_day}/day</p>}
                                </div>
                                
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                                  <span className={`text-sm font-bold ${selectedVehicle === v.id ? 'text-coral-600' : 'text-slate-500'}`}>
                                    {selectedVehicle === v.id ? 'Selected' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
          </div>
        )}
      </div>
      
      <button 
        type="submit" 
        disabled={loading || !range?.from || !range?.to}
        className="w-full bg-coral hover:bg-coral-dark text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-70"
      >
        {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Schedule' : 'Add Schedule')}
      </button>
    </form>
    
    <ConfirmModal 
      isOpen={showDeleteModal}
      title="Delete Schedule"
      message="Are you sure you want to delete this schedule? This action cannot be undone and any travelers who booked might be affected."
      confirmText="Yes, Delete it"
      cancelText="Cancel"
      onConfirm={handleDeleteConfirm}
      onCancel={() => setShowDeleteModal(false)}
      isDestructive={true}
    />
    </>
  );
}
