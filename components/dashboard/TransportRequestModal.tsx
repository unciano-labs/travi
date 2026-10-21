'use client';

import { useState, useEffect } from 'react';
import { Truck, Search, CheckCircle, Clock, MapPin, Heart, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmptyState from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAvailableVehicles, toggleFavoriteVehicle } from '@/actions/vehicles';
import { sendTransportRequest } from '@/actions/transport-requests';
import { useRouter } from 'next/navigation';

interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  seat_capacity: number;
  rate_per_day: number;
  transporter_id: string;
  transporter: {
    company_name: string;
    display_name: string;
    phone: string;
  };
  is_favorite?: boolean;
}

interface TransportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  tourScheduleId: string;
  startDate: string;
  endDate: string;
  capacity: number;
  existingRequest?: any;
}

export default function TransportRequestModal({
  isOpen,
  onClose,
  tourScheduleId,
  startDate,
  endDate,
  capacity,
  existingRequest
}: TransportRequestModalProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('08:00');
  
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen && !existingRequest) {
      loadVehicles();
    }
  }, [isOpen, existingRequest, startDate, endDate, capacity]);

  async function loadVehicles() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAvailableVehicles(startDate, endDate, capacity);
      
      // Normalize transporter field from array to object if necessary
      const normalizedData = data.map((v: any) => ({
        ...v,
        transporter: Array.isArray(v.transporter) ? v.transporter[0] : v.transporter
      }));
      
      // Sort favorites first
      normalizedData.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return 0;
      });
      
      setVehicles(normalizedData as Vehicle[]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicles');
    }
    setLoading(false);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, vehicleId: string) => {
    e.stopPropagation();
    
    // Optimistic UI update
    setVehicles(prev => {
      const updated = prev.map(v => 
        v.id === vehicleId ? { ...v, is_favorite: !v.is_favorite } : v
      );
      // Re-sort
      return updated.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return 0;
      });
    });

    try {
      const res = await toggleFavoriteVehicle(vehicleId);
      if (res.error) throw new Error(res.error);
      
      // Sync back with server source of truth just in case
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
      setError(err.message || 'Failed to toggle favorite');
      // Revert if error
      loadVehicles();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !pickupLocation || !dropoffLocation) {
      setError('Please fill in all required fields and select a vehicle.');
      return;
    }

    setSubmitting(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('tourScheduleId', tourScheduleId);
    formData.append('vehicleId', selectedVehicle);
    formData.append('transporterId', vehicles.find(v => v.id === selectedVehicle)?.transporter_id || '');
    formData.append('pickupLocation', pickupLocation);
    formData.append('dropoffLocation', dropoffLocation);
    formData.append('pickupDatetime', `${startDate}T${pickupTime}:00`);
    formData.append('returnDatetime', `${endDate}T17:00:00`); // Default return time
    formData.append('seatsRequired', capacity.toString());

    const res = await sendTransportRequest(formData);
    
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
    } else {
      router.refresh();
      onClose();
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 gap-0 flex flex-col">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/50">
          <DialogTitle className="text-xl">Transport Request</DialogTitle>
          <DialogDescription>
            For schedule: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {existingRequest && existingRequest.status !== 'declined' && existingRequest.status !== 'canceled' ? (
            <div className="text-center py-12">
              {existingRequest.status === 'pending' && <Clock className="w-16 h-16 text-warning mx-auto mb-4" />}
              {existingRequest.status === 'accepted' && <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />}
              {existingRequest.status === 'completed' && <CheckCircle className="w-16 h-16 text-primary mx-auto mb-4" />}
              
              <h3 className="text-xl font-semibold text-foreground mb-2">Request {existingRequest.status}</h3>
              <p className="text-bodytext max-w-md mx-auto">
                You have an active transport request for this schedule. 
                {existingRequest.status === 'pending' && ' Waiting for the transporter to accept.'}
                {existingRequest.status === 'accepted' && ' The transporter has accepted! Your vehicle is secured.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <Alert variant="lighterror">
                  <AlertCircle />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {/* Logistics Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Logistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="transport-pickup-location">Pickup Location</Label>
                    <Input id="transport-pickup-location" type="text" required value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} placeholder="e.g., Airport Terminal 1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transport-dropoff-location">Dropoff Location</Label>
                    <Input id="transport-dropoff-location" type="text" required value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} placeholder="e.g., Hotel Name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transport-pickup-time">Pickup Time (on {new Date(startDate).toLocaleDateString()})</Label>
                    <Input id="transport-pickup-time" type="time" required value={pickupTime} onChange={e => setPickupTime(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Vehicle Selection Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" /> Available Vehicles
                </h3>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading vehicles" />
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="bg-muted/50 rounded-lg border border-border border-dashed">
                    <EmptyState
                      icon={Search}
                      title="No vehicles found"
                      description="There are no vehicles with enough capacity available for these dates."
                      className="py-8"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vehicles.map((v) => (
                      <div 
                        key={v.id} 
                        onClick={() => setSelectedVehicle(v.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedVehicle === v.id ? 'border-primary bg-lightprimary ring-1 ring-primary/20' : 'border-border hover:border-primary/40 bg-white'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-foreground">{v.name}</h4>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={(e) => handleToggleFavorite(e, v.id)} 
                              className={`p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${v.is_favorite ? 'bg-lighterror text-error hover:bg-error hover:text-white' : 'bg-muted text-muted-foreground hover:bg-lightprimary hover:text-primary'}`}
                              title={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                              aria-label={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Heart className={`w-4 h-4 ${v.is_favorite ? 'fill-current' : ''}`} />
                            </button>
                            <Badge variant="gray" className="rounded-md uppercase tracking-wider">
                              {v.vehicle_type}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-bodytext space-y-1 mb-3">
                          <p>💺 {v.seat_capacity} Seats</p>
                          <p>🏢 {v.transporter.company_name || v.transporter.display_name}</p>
                          {v.rate_per_day && <p>💰 ₱{v.rate_per_day}/day (Est.)</p>}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedVehicle === v.id ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                            {selectedVehicle === v.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span className="text-sm font-medium text-foreground">{selectedVehicle === v.id ? 'Selected' : 'Select'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border flex justify-end gap-3">
                <Button type="button" variant="neutral" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting || !selectedVehicle || vehicles.length === 0} 
                >
                  {submitting && <Loader2 className="animate-spin" />}
                  {submitting ? 'Sending Request...' : 'Send Request'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
