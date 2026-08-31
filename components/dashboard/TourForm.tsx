'use client';

import { useState, useEffect } from 'react';
import { createTour, updateTour } from '@/actions/tours';
import { getAvailableVehicles } from '@/actions/vehicles';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, MapPin } from 'lucide-react';
import Link from 'next/link';
import { ItineraryBuilder, ItineraryDay } from './ItineraryBuilder';
import { createClient } from '@/lib/supabase/browser';
import dynamic from 'next/dynamic';
const LocationPicker = dynamic(() => import('./LocationPicker'), { ssr: false });

export interface TourFormData {
  id?: string;
  title?: string;
  description?: string;
  city?: string;
  province?: string;
  location?: string;
  price_per_person?: number;
  duration_days?: number;
  accommodation_details?: string;
  travel_time_info?: string;
  cover_image_url?: string;
  image_urls?: string[];
  latitude?: number;
  longitude?: number;
  status?: string;
  format?: 'joiner' | 'private' | 'solo';
  themes?: string[];
  tour_itineraries?: ItineraryDay[];
}

export default function TourForm({ initialData }: { initialData?: TourFormData }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [imageUrls, setImageUrls] = useState<string[]>(
    initialData?.image_urls && initialData.image_urls.length > 0 
      ? initialData.image_urls 
      : (initialData?.cover_image_url ? [initialData.cover_image_url] : [])
  );
  const [coverImageUrl, setCoverImageUrl] = useState<string>(initialData?.cover_image_url || '');
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null);
  const [status, setStatus] = useState<string>(initialData?.status || 'draft');
  const [format, setFormat] = useState<'joiner'|'private'|'solo'>(initialData?.format || 'joiner');
  
  const [themes, setThemes] = useState<string[]>(initialData?.themes || []);
  const availableThemes = [
    { id: 'island_hopping', label: 'Island Hopping' },
    { id: 'adventure_sports', label: 'Adventure & Sports' },
    { id: 'city_historical', label: 'City & Historical' },
    { id: 'nature_wildlife', label: 'Nature & Wildlife' },
    { id: 'wellness_retreat', label: 'Wellness & Retreat' },
    { id: 'culinary_food', label: 'Culinary & Food' }
  ];
  const toggleTheme = (themeId: string) => {
    setThemes(prev => prev.includes(themeId) ? prev.filter(t => t !== themeId) : (prev.length < 3 ? [...prev, themeId] : prev));
  };

  // Location state
  const [provinces, setProvinces] = useState<{code: string, name: string}[]>([]);
  const [cities, setCities] = useState<{code: string, name: string}[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<string>('');
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(initialData?.province || '');
  const [selectedCityName, setSelectedCityName] = useState<string>(initialData?.city || '');
  
  // Initialize locations
  useEffect(() => {
    fetch('https://psgc.gitlab.io/api/provinces/')
      .then(res => res.json())
      .then(data => {
         const provs = data.map((p: any) => ({ code: p.code, name: p.name }));
         provs.push({ code: 'NCR', name: 'Metro Manila' });
         provs.sort((a: any, b: any) => a.name.localeCompare(b.name));
         setProvinces(provs);
         
         // If editing, try to find the code for the initial province
         if (initialData?.province) {
           const match = provs.find((p: any) => p.name === initialData.province);
           if (match) setSelectedProvinceCode(match.code);
         }
      })
      .catch(console.error);
  }, [initialData?.province]);

  useEffect(() => {
    if (!selectedProvinceCode) {
      Promise.resolve().then(() => setCities([]));
      return;
    }
    
    const url = selectedProvinceCode === 'NCR' 
      ? 'https://psgc.gitlab.io/api/regions/130000000/cities-municipalities/'
      : `https://psgc.gitlab.io/api/provinces/${selectedProvinceCode}/cities-municipalities/`;
      
    fetch(url)
      .then(res => res.json())
      .then(data => setCities(data))
      .catch(console.error);
  }, [selectedProvinceCode]);
  
  const router = useRouter();
  const supabase = createClient();

  const isEdit = !!initialData?.id;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
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
        setError("Error uploading image: " + uploadError.message);
      } else {
        const { data } = supabase.storage.from('tour-images').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
    }
    
    if (uploadedUrls.length > 0) {
      setImageUrls(prev => [...prev, ...uploadedUrls]);
    }
    
    // Clear the input value so the same file(s) can be selected again if needed
    e.target.value = '';
    setUploading(false);
  };

  const removeImage = (indexToRemove: number) => {
    const urlToRemove = imageUrls[indexToRemove];
    setImageUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (urlToRemove === coverImageUrl) {
      setCoverImageUrl('');
    }
  };


  async function handleSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    
    let res;
    if (isEdit) {
      res = await updateTour(initialData.id!, formData);
    } else {
      res = await createTour(formData);
    }
    
    setLoading(false);
    
    if (res?.error) {
      setError(res.error);
    }
    // if successful, server action will redirect
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {!isEdit && (
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organizer/tours" className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-lg border border-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create New Tour</h1>
            <p className="text-slate-600">Draft a new tour package for travelers to book.</p>
          </div>
        </div>
      )}


      <form action={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">1. Basic Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tour Images</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="aspect-[4/3] bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative group">
                    <img src={url} alt={`Tour Image ${idx + 1}`} className="w-full h-full object-cover" />
                    {url === (coverImageUrl || imageUrls[0]) ? (
                      <div className="absolute top-2 left-2 bg-coral text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                        COVER
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCoverImageUrl(url)}
                        className="absolute top-2 left-2 bg-slate-900/70 hover:bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        SET COVER
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                    <input type="hidden" name="imageUrls" value={url} />
                  </div>
                ))}
                <div className="aspect-[4/3] bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden relative hover:bg-slate-100 transition-colors">
                  <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-xs text-slate-500 font-medium">Add Image</span>
                  {uploading && <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm font-medium">Uploading...</div>}
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleImageUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Recommended: 4:3 or 16:9 ratio, max 2MB. Hover an image to set it as cover.</p>
              <input type="hidden" name="coverImageUrl" value={coverImageUrl || (imageUrls.length > 0 ? imageUrls[0] : '')} />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Tour Title</label>
              <input type="text" name="title" defaultValue={initialData?.title} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. Ultimate El Nido Island Hopping" />
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <input type="hidden" name="status" value={status} />
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${status === 'draft' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('published')}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${status === 'published' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Published
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('archived')}
                  className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${status === 'archived' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Archived
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tour Format</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="hidden" name="format" value={format} />
                <button
                  type="button"
                  onClick={() => setFormat('joiner')}
                  className={`flex flex-col items-start p-3 border rounded-xl transition-all ${format === 'joiner' ? 'border-coral bg-coral/5 ring-1 ring-coral/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className={`font-bold text-sm ${format === 'joiner' ? 'text-coral' : 'text-slate-700'}`}>Public Joiner</span>
                  <span className="text-xs text-slate-500 text-left mt-1">Travelers share the tour. Multiple bookings until capacity is full.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('private')}
                  className={`flex flex-col items-start p-3 border rounded-xl transition-all ${format === 'private' ? 'border-coral bg-coral/5 ring-1 ring-coral/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className={`font-bold text-sm ${format === 'private' ? 'text-coral' : 'text-slate-700'}`}>Private Group</span>
                  <span className="text-xs text-slate-500 text-left mt-1">Exclusive. One booking blocks the entire schedule capacity.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('solo')}
                  className={`flex flex-col items-start p-3 border rounded-xl transition-all ${format === 'solo' ? 'border-coral bg-coral/5 ring-1 ring-coral/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <span className={`font-bold text-sm ${format === 'solo' ? 'text-coral' : 'text-slate-700'}`}>Solo / Couple</span>
                  <span className="text-xs text-slate-500 text-left mt-1">Fixed package specifically priced for 1-2 people.</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Themes (Select up to 3)</label>
              <div className="flex flex-wrap gap-2">
                {themes.map(t => <input key={t} type="hidden" name="themes" value={t} />)}
                {availableThemes.map(theme => {
                  const isSelected = themes.includes(theme.id);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => toggleTheme(theme.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
                        isSelected 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
              <select 
                name="province" 
                required 
                value={selectedProvinceName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedProvinceName(val);
                  const prov = provinces.find(p => p.name === val);
                  setSelectedProvinceCode(prov?.code || '');
                  setSelectedCityName('');
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white"
              >
                <option value="" disabled>Select Province</option>
                {provinces.map(p => (
                  <option key={p.code} value={p.name}>{p.name}</option>
                ))}
                {/* Fallback if editing and provinces not loaded yet */}
                {selectedProvinceName && provinces.length === 0 && (
                   <option value={selectedProvinceName}>{selectedProvinceName}</option>
                )}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">City / Municipality</label>
              <select 
                name="city" 
                required 
                value={selectedCityName}
                onChange={(e) => setSelectedCityName(e.target.value)}
                disabled={!selectedProvinceCode && !initialData?.city}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none bg-white disabled:opacity-50 disabled:bg-slate-50"
              >
                <option value="" disabled>Select City</option>
                {cities.map((c: any) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
                {/* Fallback if editing and cities not loaded yet */}
                {selectedCityName && cities.length === 0 && (
                   <option value={selectedCityName}>{selectedCityName}</option>
                )}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Specific Address / Meetup Point</label>
              <input type="text" name="location" defaultValue={initialData?.location} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none mb-3" placeholder="e.g. Lio Beach, El Nido" />
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2"><MapPin className="w-4 h-4"/> Pinpoint on Map (Optional)</label>
              <LocationPicker 
                initialLatitude={latitude} 
                initialLongitude={longitude} 
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} 
              />
              <input type="hidden" name="latitude" value={latitude || ''} />
              <input type="hidden" name="longitude" value={longitude || ''} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea name="description" defaultValue={initialData?.description} required rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="Describe what makes this tour special..." />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price per Person (₱)</label>
              <input type="number" name="pricePerPerson" defaultValue={initialData?.price_per_person} required min="1" step="0.01" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="1500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
              <input type="number" name="durationDays" defaultValue={initialData?.duration_days} required min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="1" />
            </div>
          </div>
        </div>


        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">4. Itinerary</h2>
          <ItineraryBuilder initialDays={initialData?.tour_itineraries || []} />
        </div>

        <div className="space-y-4 pt-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">5. Accommodation & Travel</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Travel Time Info</label>
              <input type="text" name="travelTimeInfo" defaultValue={initialData?.travel_time_info} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none" placeholder="e.g. 2 hours boat ride from town proper" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Accommodation Details (Optional)</label>
              <textarea name="accommodationDetails" defaultValue={initialData?.accommodation_details || ''} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-coral focus:border-coral outline-none resize-none"></textarea>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 flex justify-end gap-3">
          <Link href="/dashboard/organizer/tours" className="px-6 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="bg-coral hover:bg-coral/90 text-white px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Tour'}
          </button>
        </div>
      </form>
    </div>
  );
}
