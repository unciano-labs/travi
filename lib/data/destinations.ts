import { unstable_rethrow } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';
import { manilaToday } from '@/lib/datetime';

export type DestinationRegion = 'Luzon' | 'Visayas' | 'Mindanao';
export type DestinationSeason = 'dry' | 'east_coast' | 'highlands';

export interface DestinationSummary {
  slug: string;
  name: string;
  subtitle: string;
  region: DestinationRegion;
  season: DestinationSeason;
  peakSeason: string;
  highlight: string;
  query: string;
  image: string;
  tourCount: number;
  lowestPrice: number | null;
  themes: string[];
}

interface DestinationSeed {
  slug: string;
  name: string;
  subtitle: string;
  region: DestinationRegion;
  season: DestinationSeason;
  peakSeason: string;
  highlight: string;
  query: string;
  image: string;
}

const DESTINATIONS: DestinationSeed[] = [
  {
    slug: 'palawan',
    name: 'Palawan',
    subtitle: 'El Nido · Coron · Port Barton · Balabac',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Dec – May',
    highlight: 'Limestone lagoons, WWII wreck snorkeling, hidden beaches, and untouched sandbars.',
    query: 'Palawan',
    image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'siargao',
    name: 'Siargao',
    subtitle: 'General Luna · Cloud 9 · Sohoton Cove',
    region: 'Mindanao',
    season: 'east_coast',
    peakSeason: 'Mar – Oct',
    highlight: 'World-class reef breaks, emerald lagoons, rock pools, and laid-back island hopping.',
    query: 'Siargao',
    image: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'cebu',
    name: 'Cebu',
    subtitle: 'Badian · Moalboal · Bantayan · Malapascua',
    region: 'Visayas',
    season: 'dry',
    peakSeason: 'Dec – May',
    highlight: 'Kawasan Falls canyoneering, Moalboal sardine run, diving, and Visayan heritage.',
    query: 'Cebu',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'bohol',
    name: 'Bohol',
    subtitle: 'Chocolate Hills · Panglao · Anda',
    region: 'Visayas',
    season: 'dry',
    peakSeason: 'Dec – May',
    highlight: 'Iconic karst hills, tarsier sanctuaries, dolphin watching, and Balicasag coral walls.',
    query: 'Bohol',
    image: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'boracay-aklan',
    name: 'Boracay & Aklan',
    subtitle: 'White Beach · Puka Shell · Buruanga',
    region: 'Visayas',
    season: 'dry',
    peakSeason: 'Nov – May',
    highlight: 'Powdery white sands, sunset paraw sailing, reef snorkeling, and mainland eco-treks.',
    query: 'Aklan',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'batanes',
    name: 'Batanes',
    subtitle: 'Basco · Sabtang · Rolling Hills',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Mar – Jun',
    highlight: 'Dramatic cliffside pastures, stone Ivatan heritage houses, and Pacific lighthouses.',
    query: 'Batanes',
    image: 'https://images.unsplash.com/photo-1620336655055-088d06e36bf0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'sagada',
    name: 'Sagada',
    subtitle: 'Mountain Province · Echo Valley · Marlboro Hills',
    region: 'Luzon',
    season: 'highlands',
    peakSeason: 'Nov – Feb',
    highlight: 'Sea-of-clouds sunrises, limestone cave treks, hanging coffins, and pine forests.',
    query: 'Sagada',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'baguio-benguet',
    name: 'Baguio & Benguet',
    subtitle: 'Mt. Pulag · Atok · Camp John Hay',
    region: 'Luzon',
    season: 'highlands',
    peakSeason: 'Nov – Feb',
    highlight: 'Luzon’s highest sunrise summit, highland blossom farms, and specialty coffee.',
    query: 'Benguet',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'banaue-ifugao',
    name: 'Banaue & Ifugao',
    subtitle: 'Batad Amphitheater · Tappiyah Falls',
    region: 'Luzon',
    season: 'highlands',
    peakSeason: 'Dec – May',
    highlight: '2,000-year-old UNESCO rice terraces, village treks, and living Cordillera culture.',
    query: 'Ifugao',
    image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'ilocos',
    name: 'Ilocos Region',
    subtitle: 'Vigan · Pagudpud · Paoay',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Nov – May',
    highlight: 'Cobblestone Spanish-era streets, sand dune 4x4 trails, windmills, and Ilocano food.',
    query: 'Ilocos',
    image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'bicol-albay',
    name: 'Albay & Mayon',
    subtitle: 'Legazpi · Cagsawa · Lava Trails',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Dec – May',
    highlight: 'ATV rides along volcanic lava fields beneath the iconic cone of Mayon Volcano.',
    query: 'Albay',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'caramoan',
    name: 'Caramoan',
    subtitle: 'Camarines Sur · Secret Lagoons',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Mar – Jun',
    highlight: 'Disappearing white sandbars, towering karst islets, and quiet turquoise coves.',
    query: 'Camarines Sur',
    image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'manila',
    name: 'Metro Manila',
    subtitle: 'Intramuros · Binondo Chinatown',
    region: 'Luzon',
    season: 'dry',
    peakSeason: 'Year-round',
    highlight: 'Bamboo bike heritage tours through Intramuros and culinary walks in historic Binondo.',
    query: 'Manila',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'siquijor',
    name: 'Siquijor',
    subtitle: 'Cambugahay Falls · San Juan Coast',
    region: 'Visayas',
    season: 'dry',
    peakSeason: 'Dec – May',
    highlight: 'Tiered jungle waterfalls, cliff diving, coral marine sanctuaries, and coastal sunsets.',
    query: 'Siquijor',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'camiguin',
    name: 'Camiguin',
    subtitle: 'White Island · Sunken Cemetery · Hot Springs',
    region: 'Mindanao',
    season: 'dry',
    peakSeason: 'Mar – Oct',
    highlight: 'Volcanic island paradise with shifting sandbars, icy springs, and reef dives.',
    query: 'Camiguin',
    image: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    slug: 'davao',
    name: 'Davao & Samal',
    subtitle: 'Malagos · Talikud Coral Garden',
    region: 'Mindanao',
    season: 'east_coast',
    peakSeason: 'Mar – Oct',
    highlight: 'Philippine Eagle sanctuary, single-origin cacao farms, and Samal Island reefs.',
    query: 'Davao',
    image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  },
];

interface TourRow {
  location: string;
  city: string | null;
  province: string | null;
  price_per_person: number | string;
  themes: string[] | null;
  schedules: {
    start_date: string;
    capacity: number;
    booked_count: number | null;
    price_per_person: number | string | null;
  }[];
}

function getPublicSupabase() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const getCachedDestinations = unstable_cache(
  async (): Promise<{ destinations: DestinationSummary[]; totalActiveTours: number }> => {
    try {
      const today = manilaToday();
      const supabase = getPublicSupabase();
      const { data, error } = await supabase
        .from('tours')
        .select(`
          location, city, province, price_per_person, themes,
          organizer:organizer_profiles!inner(status, deleted_at),
          schedules:tour_schedules!inner(start_date, capacity, booked_count, price_per_person)
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('organizer.status', 'approved')
        .is('organizer.deleted_at', null)
        .eq('schedules.status', 'open')
        .is('schedules.deleted_at', null)
        .gte('schedules.start_date', today)
        .limit(500);

      if (error) {
        captureException(error, { action: 'getCachedDestinations' });
        return {
          destinations: DESTINATIONS.map((d) => ({ ...d, tourCount: 0, lowestPrice: null, themes: [] })),
          totalActiveTours: 0,
        };
      }

      const activeTours = ((data ?? []) as unknown as TourRow[])
        .map((row) => {
          const validPrices = row.schedules
            .filter((s) => s.capacity - Math.max(s.booked_count ?? 0, 0) >= 1)
            .map((s) => Number(s.price_per_person ?? row.price_per_person));
          if (validPrices.length === 0) return null;
          return {
            haystack: [row.location, row.city ?? '', row.province ?? ''].join(' ').toLowerCase(),
            lowestPrice: Math.min(...validPrices),
            themes: row.themes ?? [],
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      const destinations: DestinationSummary[] = DESTINATIONS.map((dest) => {
        const needle = dest.query.toLowerCase();
        const matches = activeTours.filter((t) => t.haystack.includes(needle));
        const themeCounts = new Map<string, number>();
        for (const match of matches) {
          for (const th of match.themes) {
            themeCounts.set(th, (themeCounts.get(th) ?? 0) + 1);
          }
        }
        const topThemes = Array.from(themeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([th]) => th);

        return {
          ...dest,
          tourCount: matches.length,
          lowestPrice: matches.length > 0 ? Math.min(...matches.map((m) => m.lowestPrice)) : null,
          themes: topThemes,
        };
      });

      return { destinations, totalActiveTours: activeTours.length };
    } catch (err: unknown) {
      unstable_rethrow(err);
      captureException(err, { action: 'getCachedDestinations exception' });
      return {
        destinations: DESTINATIONS.map((d) => ({ ...d, tourCount: 0, lowestPrice: null, themes: [] })),
        totalActiveTours: 0,
      };
    }
  },
  ['public-destinations-v1'],
  { tags: ['tours'], revalidate: 300 }
);

