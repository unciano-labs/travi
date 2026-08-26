'use client';

import { useState } from 'react';
import { X, Loader2, Bus } from 'lucide-react';
import { createVehicle, updateVehicle } from '@/actions/vehicles';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/browser';

interface VehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleToEdit?: any | null;
  onSuccess: () => void;
}

export default function VehicleModal({
  isOpen,
  onClose,
  vehicleToEdit,
  onSuccess,
}: VehicleModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [photos, setPhotos] = useState<string[]>(vehicleToEdit?.photos || []);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  if (!isOpen) return null;

  const isEditing = Boolean(vehicleToEdit);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setErrorMsg('');
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(filePath, file);

      if (uploadError) {
        setErrorMsg("Error uploading image: " + uploadError.message);
      } else {
        const { data } = supabase.storage.from('tour-images').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
    }
    
    if (uploadedUrls.length > 0) {
      setPhotos(prev => [...prev, ...uploadedUrls]);
    }
    
    e.target.value = '';
    setUploading(false);
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const formData = new FormData(e.currentTarget);
    formData.set('photos', JSON.stringify(photos));

    let res;
    if (isEditing) {
      res = await updateVehicle(vehicleToEdit.id, formData);
    } else {
      res = await createVehicle(formData);
    }

    setLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setErrorMsg(res.error || 'Operation failed. Please check your inputs.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
              </h2>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update vehicle fleet details' : 'List a new vehicle in your transport inventory'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Vehicle Name / Model *
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Toyota Hiace Grandia GL"
              defaultValue={vehicleToEdit?.name || ''}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Vehicle Type *
              </label>
              <select
                name="vehicleType"
                defaultValue={vehicleToEdit?.vehicle_type || 'van'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              >
                <option value="van">Van</option>
                <option value="minibus">Minibus</option>
                <option value="bus">Bus</option>
                <option value="suv">SUV</option>
                <option value="car">Sedan / Car</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Seat Capacity *
              </label>
              <input
                type="number"
                name="seatCapacity"
                required
                min={1}
                max={100}
                placeholder="12"
                defaultValue={vehicleToEdit?.seat_capacity || 12}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Plate Number
              </label>
              <input
                type="text"
                name="plateNumber"
                placeholder="ABC 1234"
                defaultValue={vehicleToEdit?.plate_number || ''}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Daily Rate (PHP)
              </label>
              <input
                type="number"
                name="ratePerDay"
                step="50"
                placeholder="3500"
                defaultValue={vehicleToEdit?.rate_per_day || ''}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Vehicle Photos
            </label>
            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                className="w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-xl file:border-0
                  file:text-sm file:font-semibold
                  file:bg-coral/10 file:text-coral
                  hover:file:bg-coral/20 cursor-pointer transition-all"
              />
              
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-coral font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading images...
                </div>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((url, idx) => (
                    <div key={idx} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 group bg-slate-100">
                      <Image
                        src={url}
                        alt={`Vehicle photo ${idx + 1}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-slate-900/50 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description / Inclusions
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Air-conditioned, comfortable reclining seats, includes experienced driver and fuel."
              defaultValue={vehicleToEdit?.description || ''}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
            />
          </div>

          {isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Fleet Status
              </label>
              <select
                name="status"
                defaultValue={vehicleToEdit?.status || 'active'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all"
              >
                <option value="active">Active (Available for booking requests)</option>
                <option value="inactive">Inactive (Temporarily offline)</option>
              </select>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-coral hover:bg-coral/90 text-white text-sm font-bold rounded-xl shadow-md shadow-coral/20 hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
