'use client';

import { useState } from 'react';
import { X, Loader2, Bus, AlertCircle } from 'lucide-react';
import { createVehicle, updateVehicle } from '@/actions/vehicles';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/browser';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
    
    // Storage policy: each user may only upload inside a folder named after their user id.
    const { data: { user } } = await supabase.auth.getUser();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 space-y-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-lightprimary text-primary">
            <Bus className="size-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <DialogTitle>{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
            <DialogDescription className="text-xs">
              {isEditing ? 'Update vehicle fleet details' : 'List a new vehicle in your transport inventory'}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <Alert variant="lighterror">
              <AlertCircle />
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="vehicle-name">Vehicle Name / Model *</Label>
            <Input
              id="vehicle-name"
              type="text"
              name="name"
              required
              placeholder="e.g. Toyota Hiace Grandia GL"
              defaultValue={vehicleToEdit?.name || ''}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-type">Vehicle Type *</Label>
              <NativeSelect
                id="vehicle-type"
                name="vehicleType"
                defaultValue={vehicleToEdit?.vehicle_type || 'van'}
              >
                <option value="van">Van</option>
                <option value="minibus">Minibus</option>
                <option value="bus">Bus</option>
                <option value="suv">SUV</option>
                <option value="car">Sedan / Car</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-seats">Seat Capacity *</Label>
              <Input
                id="vehicle-seats"
                type="number"
                name="seatCapacity"
                required
                min={1}
                max={100}
                placeholder="12"
                defaultValue={vehicleToEdit?.seat_capacity || 12}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle-plate">Plate Number</Label>
              <Input
                id="vehicle-plate"
                type="text"
                name="plateNumber"
                placeholder="ABC 1234"
                defaultValue={vehicleToEdit?.plate_number || ''}
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle-rate">Daily Rate (PHP)</Label>
              <Input
                id="vehicle-rate"
                type="number"
                name="ratePerDay"
                step="50"
                placeholder="3500"
                defaultValue={vehicleToEdit?.rate_per_day || ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-photos">Vehicle Photos</Label>
            <div className="flex flex-col gap-4">
              <Input
                id="vehicle-photos"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploading}
                className="h-auto cursor-pointer py-2 text-muted-foreground file:rounded-md file:bg-lightprimary file:px-3 file:py-1.5 file:font-semibold file:text-primary hover:file:bg-primary hover:file:text-white"
              />

              {uploading && (
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Loader2 className="size-4 animate-spin" />
                  Uploading images...
                </div>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((url, idx) => (
                    <div key={idx} className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted">
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
                        aria-label={`Remove photo ${idx + 1}`}
                        className="absolute right-2 top-2 rounded-md bg-dark/50 p-1.5 text-white opacity-0 transition-all hover:bg-error focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle-description">Description / Inclusions</Label>
            <Textarea
              id="vehicle-description"
              name="description"
              rows={3}
              placeholder="Air-conditioned, comfortable reclining seats, includes experienced driver and fuel."
              defaultValue={vehicleToEdit?.description || ''}
            />
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="vehicle-status">Fleet Status</Label>
              <NativeSelect
                id="vehicle-status"
                name="status"
                defaultValue={vehicleToEdit?.status || 'active'}
              >
                <option value="active">Active (Available for booking requests)</option>
                <option value="inactive">Inactive (Temporarily offline)</option>
              </NativeSelect>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="neutral" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
