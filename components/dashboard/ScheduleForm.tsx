'use client';

import { useState, useRef, useEffect } from 'react';
import { createSchedule, updateSchedule, deleteSchedule } from '@/actions/schedules';
import { getAvailableVehicles, toggleFavoriteVehicle } from '@/actions/vehicles';
import { Plus, Edit2, X, Trash2, Search, Heart, AlertCircle, Loader2 } from 'lucide-react';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
          
          const normalizedData = data.map((v: any) => ({
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
      Promise.resolve().then(() => setVehicles([]));
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

  const transportLocked = initialData?.transport_booking?.status === 'accepted' || initialData?.transport_booking?.status === 'completed';

  return (
    <>
    <form ref={formRef} action={handleSubmit}>
    <CardBox>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="card-title flex items-center gap-2">
          {isEdit ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />} 
          {isEdit ? 'Edit Schedule' : 'Add New Schedule'}
        </h5>
        {isEdit && (
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghosterror" size="xs" onClick={promptDelete}>
              <Trash2 /> Delete
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={cancelEdit} className="text-muted-foreground">
              <X /> Cancel
            </Button>
          </div>
        )}
      </div>
      
      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div
        className="border border-border rounded-lg p-4 bg-white flex flex-col items-center overflow-x-auto"
        style={{ '--rdp-accent-color': 'var(--color-primary)', '--rdp-accent-background-color': 'var(--color-lightprimary)' } as React.CSSProperties}
      >
        <Label className="mb-2 w-full flex-wrap text-left">
          Date Range
          {range?.from && (
            <span className="font-normal text-muted-foreground">
              ({format(range.from, 'MMM d, yyyy')} {range.to ? `- ${format(range.to, 'MMM d, yyyy')}` : ''})
            </span>
          )}
        </Label>
        <DayPicker
          mode="range"
          defaultMonth={range?.from || new Date()}
          selected={range}
          onSelect={setRange}
          modifiersClassNames={{
            selected: 'bg-primary text-white',
            range_middle: 'bg-lightprimary text-primary',
            range_start: 'bg-primary text-white rounded-l-md',
            range_end: 'bg-primary text-white rounded-r-md'
          }}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-6">
        <div className="space-y-2">
          <Label htmlFor="schedule-capacity">Capacity</Label>
          <Input id="schedule-capacity" type="number" name="capacity" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1" placeholder="Seats e.g. 12" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-original-price">Original Price (₱)</Label>
          <Input id="schedule-original-price" type="number" step="0.01" name="original_price" min="0" defaultValue={initialData?.original_price || ''} placeholder="Compare-at price" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-price">Selling Price (₱)</Label>
          <Input id="schedule-price" type="number" step="0.01" name="price_per_person" min="0" defaultValue={initialData?.price_per_person || ''} placeholder={basePrice ? `Default: ₱${basePrice}` : "Optional override"} />
        </div>
      </div>
      
      <div className="border border-border rounded-lg p-4 bg-white space-y-3">
        <Label htmlFor="schedule-transport-type">Transport Requirement</Label>
        <NativeSelect id="schedule-transport-type" name="transport_type" value={transportType} onChange={e => setTransportType(e.target.value)}>
          <option value="none">None (Travelers meet at location)</option>
          <option value="self_provided">Self-provided (We will provide the transport)</option>
          <option value="external_transporter">External Transporter (Need to book a vehicle)</option>
        </NativeSelect>
        {transportType === 'external_transporter' && (
          <div className="mt-4 pt-4 border-t border-border space-y-6">
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-pickup-location">Pickup Location</Label>
                    <Input id="schedule-pickup-location" type="text" value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} disabled={transportLocked} placeholder="e.g., Airport Terminal 1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-dropoff-location">Dropoff Location</Label>
                    <Input id="schedule-dropoff-location" type="text" value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} disabled={transportLocked} placeholder="e.g., Hotel Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-pickup-time">Pickup Time</Label>
                    <Input id="schedule-pickup-time" type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} disabled={transportLocked} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-return-time">Return Time (Optional)</Label>
                    <Input id="schedule-return-time" type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} disabled={transportLocked} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Vehicle Selection</h3>
                    {!transportLocked && (
                      <Button type="button" variant="lightprimary" size="sm" onClick={() => setIsVehicleModalOpen(true)}>
                        {selectedVehicle ? 'Change Vehicle' : 'Select Vehicle'}
                      </Button>
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
                          <div className="p-4 rounded-lg border border-primary bg-lightprimary flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-foreground">Selected Vehicle</h4>
                              <p className="text-sm text-bodytext">ID: {selectedVehicle}</p>
                            </div>
                            {!transportLocked && (
                              <Button type="button" variant="ghosterror" size="iconsm" shape="pill" onClick={() => setSelectedVehicle(null)} aria-label="Remove selected vehicle">
                                <X />
                              </Button>
                            )}
                          </div>
                        );
                      }

                      const bookingStatus = (initialData?.transport_booking?.vehicle_id === selectedVehicle) 
                        ? initialData.transport_booking.status 
                        : null;
                        
                      return (
                        <div className="p-4 rounded-lg border border-primary bg-lightprimary flex items-start justify-between gap-2 relative">
                          <div className="flex items-center gap-4 min-w-0">
                            {v.photos && v.photos.length > 0 ? (
                              <div className="w-16 h-16 rounded-md bg-white overflow-hidden shrink-0 border border-border">
                                <img src={v.photos[0]} alt="Vehicle" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-md bg-white flex items-center justify-center shrink-0 border border-border">
                                <span className="text-2xl">🚐</span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold text-foreground">{v.name}</h4>
                                {bookingStatus === 'accepted' ? <StatusBadge status="accepted" label="✅ Accepted" /> :
                                 bookingStatus === 'declined' ? <StatusBadge status="declined" label="❌ Declined" /> :
                                 bookingStatus === 'pending' ? <StatusBadge status="pending" label="⏳ Pending" /> :
                                 <StatusBadge status="draft" label="Draft Selection" />}
                              </div>
                              <p className="text-sm text-bodytext font-medium">{v.transporter?.display_name || v.transporter?.company_name}</p>
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                <Badge variant="outline" className="bg-white">{v.vehicle_type}</Badge>
                                <Badge variant="outline" className="bg-white">💺 {v.seat_capacity} Seats</Badge>
                              </div>
                            </div>
                          </div>
                          {!transportLocked && (
                            <Button type="button" variant="ghosterror" size="iconsm" shape="pill" onClick={() => setSelectedVehicle(null)} className="shrink-0" aria-label="Remove selected vehicle">
                              <X />
                            </Button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center p-6 border-2 border-dashed border-border rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">No vehicle selected. Please select a vehicle for external transport.</p>
                    </div>
                  )}
                </div>

                {/* Vehicle Selection Modal */}
                <Dialog open={isVehicleModalOpen} onOpenChange={(o) => { if (!o) setIsVehicleModalOpen(false); }}>
                  <DialogContent className="max-w-3xl p-0 gap-0 flex flex-col">
                    <DialogHeader className="px-6 py-5 border-b border-border">
                      <DialogTitle className="text-xl">Select a Vehicle</DialogTitle>
                      <DialogDescription>Available vehicles for {capacity} passengers</DialogDescription>
                    </DialogHeader>

                    <div className="p-6 overflow-y-auto flex-1 bg-muted/30">
                        {!range?.from || !range?.to || !capacity ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">Please fill in the date range and capacity to see available vehicles.</p>
                          </div>
                        ) : loadingVehicles ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading vehicles" />
                          </div>
                        ) : vehicles.length === 0 ? (
                          <EmptyState
                            icon={Search}
                            title="No vehicles found"
                            description="There are no vehicles with enough capacity available for these dates."
                          />
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vehicles.map((v) => (
                              <div 
                                key={v.id} 
                                onClick={() => {
                                  setSelectedVehicle(v.id);
                                  setIsVehicleModalOpen(false);
                                }}
                                className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedVehicle === v.id ? 'border-primary bg-lightprimary ring-1 ring-primary/20' : 'border-border hover:border-primary/40 bg-white'}`}
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-3">
                                    {v.photos && v.photos.length > 0 ? (
                                      <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 border border-border">
                                        <img src={v.photos[0]} alt={v.name} className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                                        <span className="text-2xl">🚐</span>
                                      </div>
                                    )}
                                    <h4 className="font-semibold text-foreground text-lg">{v.name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      type="button"
                                      variant={v.is_favorite ? 'lighterror' : 'ghost'}
                                      size="iconsm"
                                      shape="pill"
                                      onClick={(e) => handleToggleFavorite(e, v.id)} 
                                      className={v.is_favorite ? '' : 'text-muted-foreground'}
                                      title={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                      aria-label={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                    >
                                      <Heart className={`size-5 ${v.is_favorite ? 'fill-current' : ''}`} />
                                    </Button>
                                  </div>
                                </div>
                                <div className="text-sm text-bodytext space-y-2 mb-4">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="gray" className="rounded-md uppercase tracking-wider">
                                      {v.vehicle_type}
                                    </Badge>
                                    <span>•</span>
                                    <span>💺 {v.seat_capacity} Seats</span>
                                  </div>
                                  <p className="flex items-center gap-2">🏢 {v.transporter.display_name || v.transporter.company_name}</p>
                                  {v.rate_per_day && <p className="font-medium text-foreground">💰 ₱{v.rate_per_day}/day</p>}
                                </div>
                                
                                <div className="pt-3 border-t border-border flex items-center justify-end">
                                  <span className={`text-sm font-semibold ${selectedVehicle === v.id ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {selectedVehicle === v.id ? 'Selected' : 'Select'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
          </div>
        )}
      </div>
      
      <Button 
        type="submit" 
        disabled={loading || !range?.from || !range?.to}
        className="w-full"
      >
        {loading && <Loader2 className="animate-spin" />}
        {loading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Schedule' : 'Add Schedule')}
      </Button>
    </CardBox>
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
