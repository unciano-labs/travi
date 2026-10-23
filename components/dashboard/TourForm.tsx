'use client';

import { useState, useEffect } from 'react';
import { createTour, updateTour } from '@/actions/tours';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ItineraryBuilder, ItineraryDay } from './ItineraryBuilder';
import TourStatusField from './TourStatusField';
import { createClient } from '@/lib/supabase/browser';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  const [price, setPrice] = useState<number>(Number(initialData?.price_per_person) || 0);
  const [itineraryDays, setItineraryDays] = useState<number>(
    (initialData?.tour_itineraries || []).filter((d) => d.title?.trim()).length
  );

  // The itinerary builder keeps its days in a hidden JSON input; re-count titled days after edits.
  const syncItinerary = (form: HTMLFormElement) => {
    setTimeout(() => {
      const input = form.elements.namedItem('itineraries');
      if (!(input instanceof HTMLInputElement)) return;
      try {
        const days = JSON.parse(input.value) as { title?: string }[];
        setItineraryDays(days.filter((d) => d.title?.trim()).length);
      } catch {
        // keep the previous count
      }
    }, 0);
  };
  
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
      .catch(() => setProvinces([]));
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
      .catch(() => setCities([]));
  }, [selectedProvinceCode]);
  
  const router = useRouter();
  const supabase = createClient();

  const isEdit = !!initialData?.id;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
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
    
    if (res && !res.success) {
      setError(res.error);
    }
    // if successful, server action will redirect
  }

  const formatClass = (active: boolean) =>
    `flex flex-col items-start p-3 border rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? 'border-primary bg-lightprimary ring-1 ring-primary/20' : 'border-border hover:border-primary/40'}`;

  return (
    <>
      {!isEdit && (
        <PageHeader
          title="Create New Tour"
          description="Draft a new tour package for travelers to book."
          breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard/organizer' },
            { title: 'My Tours', href: '/dashboard/organizer/tours' },
            { title: 'New Tour' },
          ]}
          actions={
            <Button asChild variant="neutral">
              <Link href="/dashboard/organizer/tours">
                <ArrowLeft />
                Back to Tours
              </Link>
            </Button>
          }
        />
      )}

      <form
        action={handleSubmit}
        onInput={(e) => syncItinerary(e.currentTarget)}
        onClick={(e) => syncItinerary(e.currentTarget)}
        className="max-w-4xl mx-auto flex flex-col gap-6"
      >
        {error && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <CardBox>
          <h5 className="card-title">1. Basic Details</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
              <Label>Tour Images</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="aspect-[4/3] bg-muted rounded-lg border border-border overflow-hidden relative group">
                    <img src={url} alt={`Tour Image ${idx + 1}`} className="w-full h-full object-cover" />
                    {url === (coverImageUrl || imageUrls[0]) ? (
                      <Badge variant="primary" className="absolute top-2 left-2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase">
                        COVER
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCoverImageUrl(url)}
                        className="absolute top-2 left-2 bg-dark/70 hover:bg-dark text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        SET COVER
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      aria-label={`Remove image ${idx + 1}`}
                      className="absolute top-2 right-2 w-6 h-6 bg-error hover:bg-erroremphasis text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      &times;
                    </button>
                    <input type="hidden" name="imageUrls" value={url} />
                  </div>
                ))}
                <div className="aspect-[4/3] bg-muted/50 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden relative hover:bg-lightprimary hover:border-primary/40 transition-colors">
                  <ImageIcon className="w-6 h-6 text-primary mb-2" />
                  <span className="text-xs text-muted-foreground font-medium">Add Image</span>
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" /> Uploading...
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    aria-label="Add tour images"
                    onChange={handleImageUpload} 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Recommended: 4:3 or 16:9 ratio, max 2MB. Hover an image to set it as cover.</p>
              <input type="hidden" name="coverImageUrl" value={coverImageUrl || (imageUrls.length > 0 ? imageUrls[0] : '')} />
            </div>

            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="tour-title">Tour Title</Label>
              <Input id="tour-title" type="text" name="title" defaultValue={initialData?.title} required placeholder="e.g. Ultimate El Nido Island Hopping" />
            </div>

            <TourStatusField
              isEdit={isEdit}
              tourId={initialData?.id}
              initialStatus={initialData?.status}
              status={status}
              onStatusChange={setStatus}
              live={{ price, hasCover: Boolean(coverImageUrl || imageUrls[0]), itineraryDays }}
            />

            <div className="md:col-span-2 space-y-2">
              <Label>Tour Format</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="Tour Format">
                <input type="hidden" name="format" value={format} />
                <button type="button" onClick={() => setFormat('joiner')} aria-pressed={format === 'joiner'} className={formatClass(format === 'joiner')}>
                  <span className={`font-semibold text-sm ${format === 'joiner' ? 'text-primary' : 'text-foreground'}`}>Public Joiner</span>
                  <span className="text-xs text-muted-foreground text-left mt-1">Travelers share the tour. Multiple bookings until capacity is full.</span>
                </button>
                <button type="button" onClick={() => setFormat('private')} aria-pressed={format === 'private'} className={formatClass(format === 'private')}>
                  <span className={`font-semibold text-sm ${format === 'private' ? 'text-primary' : 'text-foreground'}`}>Private Group</span>
                  <span className="text-xs text-muted-foreground text-left mt-1">Exclusive. One booking blocks the entire schedule capacity.</span>
                </button>
                <button type="button" onClick={() => setFormat('solo')} aria-pressed={format === 'solo'} className={formatClass(format === 'solo')}>
                  <span className={`font-semibold text-sm ${format === 'solo' ? 'text-primary' : 'text-foreground'}`}>Solo / Couple</span>
                  <span className="text-xs text-muted-foreground text-left mt-1">Fixed package specifically priced for 1-2 people.</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Themes (Select up to 3)</Label>
              <div className="flex flex-wrap gap-2">
                {themes.map(t => <input key={t} type="hidden" name="themes" value={t} />)}
                {availableThemes.map(theme => {
                  const isSelected = themes.includes(theme.id);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => toggleTheme(theme.id)}
                      aria-pressed={isSelected}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        isSelected 
                          ? 'bg-lightsuccess text-successemphasis border-success/30' 
                          : 'bg-white text-bodytext border-border hover:bg-lightprimary hover:text-primary hover:border-primary/40'
                      }`}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="tour-province">Province</Label>
              <NativeSelect 
                id="tour-province"
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
              >
                <option value="" disabled>Select Province</option>
                {provinces.map(p => (
                  <option key={p.code} value={p.name}>{p.name}</option>
                ))}
                {/* Fallback if editing and provinces not loaded yet */}
                {selectedProvinceName && provinces.length === 0 && (
                   <option value={selectedProvinceName}>{selectedProvinceName}</option>
                )}
              </NativeSelect>
            </div>

            <div className="md:col-span-1 space-y-2">
              <Label htmlFor="tour-city">City / Municipality</Label>
              <NativeSelect 
                id="tour-city"
                name="city" 
                required 
                value={selectedCityName}
                onChange={(e) => setSelectedCityName(e.target.value)}
                disabled={!selectedProvinceCode && !initialData?.city}
              >
                <option value="" disabled>Select City</option>
                {cities.map((c: any) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
                {/* Fallback if editing and cities not loaded yet */}
                {selectedCityName && cities.length === 0 && (
                   <option value={selectedCityName}>{selectedCityName}</option>
                )}
              </NativeSelect>
            </div>
            
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="tour-location">Specific Address / Meetup Point</Label>
              <Input id="tour-location" type="text" name="location" defaultValue={initialData?.location} required className="mb-3" placeholder="e.g. Lio Beach, El Nido" />
              <Label><MapPin className="w-4 h-4 text-primary"/> Pinpoint on Map (Optional)</Label>
              <LocationPicker 
                initialLatitude={latitude} 
                initialLongitude={longitude} 
                onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }} 
              />
              <input type="hidden" name="latitude" value={latitude || ''} />
              <input type="hidden" name="longitude" value={longitude || ''} />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="tour-description">Description</Label>
              <Textarea id="tour-description" name="description" defaultValue={initialData?.description} required rows={4} placeholder="Describe what makes this tour special..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tour-price">Price per Person (₱)</Label>
              <Input id="tour-price" type="number" name="pricePerPerson" defaultValue={initialData?.price_per_person} onChange={(e) => setPrice(Number(e.target.value) || 0)} required min="1" step="0.01" placeholder="1500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tour-duration">Duration (Days)</Label>
              <Input id="tour-duration" type="number" name="durationDays" defaultValue={initialData?.duration_days} required min="1" placeholder="1" />
            </div>
          </div>
        </CardBox>

        <CardBox>
          <h5 className="card-title">4. Itinerary</h5>
          <ItineraryBuilder initialDays={initialData?.tour_itineraries || []} />
        </CardBox>

        <CardBox>
          <h5 className="card-title">5. Accommodation & Travel</h5>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tour-travel-time">Travel Time Info</Label>
              <Input id="tour-travel-time" type="text" name="travelTimeInfo" defaultValue={initialData?.travel_time_info} placeholder="e.g. 2 hours boat ride from town proper" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tour-accommodation">Accommodation Details (Optional)</Label>
              <Textarea id="tour-accommodation" name="accommodationDetails" defaultValue={initialData?.accommodation_details || ''} rows={3} className="resize-none"></Textarea>
            </div>
          </div>
        </CardBox>

        <div className="flex justify-end gap-3">
          <Button asChild variant="neutral" size="lg">
            <Link href="/dashboard/organizer/tours">
              Cancel
            </Link>
          </Button>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {loading ? 'Saving...' : 'Save Tour'}
          </Button>
        </div>
      </form>
    </>
  );
}
