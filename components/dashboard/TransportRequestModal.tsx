'use client';

import { useState, useEffect } from 'react';
import { Truck, X, Search, CheckCircle, Clock, XCircle, MapPin, Heart } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Transport Request</h2>
            <p className="text-sm text-slate-500 mt-1">
              For schedule: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {existingRequest && existingRequest.status !== 'declined' && existingRequest.status !== 'canceled' ? (
            <div className="text-center py-12">
              {existingRequest.status === 'pending' && <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />}
              {existingRequest.status === 'accepted' && <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />}
              {existingRequest.status === 'completed' && <CheckCircle className="w-16 h-16 text-blue-500 mx-auto mb-4" />}
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">Request {existingRequest.status}</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                You have an active transport request for this schedule. 
                {existingRequest.status === 'pending' && ' Waiting for the transporter to accept.'}
                {existingRequest.status === 'accepted' && ' The transporter has accepted! Your vehicle is secured.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Logistics Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-coral-500" /> Logistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Location</label>
                    <input type="text" required value={pickupLocation} onChange={e => setPickupLocation(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-coral-500 outline-none" placeholder="e.g., Airport Terminal 1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dropoff Location</label>
                    <input type="text" required value={dropoffLocation} onChange={e => setDropoffLocation(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-coral-500 outline-none" placeholder="e.g., Hotel Name" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Time (on {new Date(startDate).toLocaleDateString()})</label>
                    <input type="time" required value={pickupTime} onChange={e => setPickupTime(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral-500 focus:border-coral-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* Vehicle Selection Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-coral-500" /> Available Vehicles
                </h3>
                
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-500"></div>
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600 font-medium">No vehicles found</p>
                    <p className="text-sm text-slate-500 mt-1">There are no vehicles with enough capacity available for these dates.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vehicles.map((v) => (
                      <div 
                        key={v.id} 
                        onClick={() => setSelectedVehicle(v.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedVehicle === v.id ? 'border-coral-500 bg-coral-50 shadow-md' : 'border-slate-200 hover:border-coral-200 bg-white'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-slate-900">{v.name}</h4>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => handleToggleFavorite(e, v.id)} 
                              className={`p-1.5 rounded-full transition-colors ${v.is_favorite ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                              title={v.is_favorite ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Heart className={`w-4 h-4 ${v.is_favorite ? 'fill-current' : ''}`} />
                            </button>
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">
                              {v.vehicle_type}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1 mb-3">
                          <p>💺 {v.seat_capacity} Seats</p>
                          <p>🏢 {v.transporter.company_name || v.transporter.display_name}</p>
                          {v.rate_per_day && <p>💰 ₱{v.rate_per_day}/day (Est.)</p>}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedVehicle === v.id ? 'border-coral-500 bg-coral-500 text-white' : 'border-slate-300'}`}>
                            {selectedVehicle === v.id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{selectedVehicle === v.id ? 'Selected' : 'Select'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting || !selectedVehicle || vehicles.length === 0} 
                  className="bg-coral-500 hover:bg-coral-600 text-white px-8 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Sending Request...' : 'Send Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
