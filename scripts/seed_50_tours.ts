import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import writeGuard from './lib/write-guard.cjs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
writeGuard.assertWriteTarget('seed_50_tours.ts');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type TourFormat = 'joiner' | 'private' | 'solo';
type TourTheme =
  | 'island_hopping'
  | 'adventure_sports'
  | 'city_historical'
  | 'nature_wildlife'
  | 'wellness_retreat'
  | 'culinary_food';

interface DummyTourSpec {
  title: string;
  city: string;
  province: string;
  location: string;
  price: number;
  originalPrice?: number;
  durationDays: number;
  capacity: number;
  format: TourFormat;
  themes: TourTheme[];
  lat: number;
  lng: number;
  accommodation: string;
  travelTime: string;
  description: string;
  images: string[];
}

// Verified HTTP 200 Unsplash travel/Philippines/nature/food/wellness images (allowed in next.config.ts).
const IMG = {
  elNidoLagoon: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=80',
  tropicalShore: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1200&q=80',
  rollingHills: 'https://images.unsplash.com/photo-1620336655055-088d06e36bf0?auto=format&fit=crop&w=1200&q=80',
  whiteBeach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  islandPalm: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
  azureCove: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80',
  mountainPeak: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
  alpineDawn: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80',
  reefDive: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
  limestoneBay: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=80',
  campUnderStars: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=80',
  boatLake: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80',
  resortPool: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80',
  marketStreet: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  localFeast: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  heritageCoast: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80',
  valleyView: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
  roadTrip: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
  coastalDrive: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  mistyForest: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
};

const DUMMY_TOURS: DummyTourSpec[] = [
  // Palawan (8)
  {
    title: 'El Nido Big Lagoon & Secret Beach Island Hopping',
    city: 'El Nido',
    province: 'Palawan',
    location: 'El Nido Town Pier, Palawan',
    price: 1850,
    originalPrice: 2200,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 11.1795,
    lng: 119.3899,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '7 hours by motorized outrigger boat',
    description:
      'Paddle through the emerald walls of Big Lagoon, swim into Secret Lagoon, snorkel Shimizu Island reefs, and enjoy a freshly grilled seaside lunch on Seven Commandos Beach.',
    images: [IMG.elNidoLagoon, IMG.limestoneBay, IMG.azureCove],
  },
  {
    title: 'El Nido Tour C Hidden Beaches & Snorkeling Escape',
    city: 'El Nido',
    province: 'Palawan',
    location: 'Corong-Corong Beach, El Nido, Palawan',
    price: 2100,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['island_hopping', 'adventure_sports'],
    lat: 11.1682,
    lng: 119.3931,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '8 hours including island stops',
    description:
      'Discover Helicopter Island, Matinloc Shrine, Secret Beach, and Star Beach with licensed boat crew, snorkeling gear, and tropical picnic buffet.',
    images: [IMG.limestoneBay, IMG.reefDive, IMG.whiteBeach],
  },
  {
    title: 'Coron Kayangan Lake & WWII Wreck Snorkeling',
    city: 'Coron',
    province: 'Palawan',
    location: 'Coron Harbor Square, Palawan',
    price: 2350,
    originalPrice: 2800,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['island_hopping', 'adventure_sports'],
    lat: 11.9986,
    lng: 120.2043,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '8 hours by island boat',
    description:
      'Swim in the crystal freshwater of Kayangan Lake, drift above the Skeleton Wreck and Coral Garden, and glide into Twin Lagoon.',
    images: [IMG.azureCove, IMG.reefDive, IMG.elNidoLagoon],
  },
  {
    title: 'Coron 3-Day Ultimate Lagoon & Reef Expedition',
    city: 'Coron',
    province: 'Palawan',
    location: 'Coron Town Proper, Palawan',
    price: 8900,
    originalPrice: 10200,
    durationDays: 3,
    capacity: 10,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife', 'wellness_retreat'],
    lat: 12.0021,
    lng: 120.2067,
    accommodation: '2 nights boutique inn in Coron Town with daily breakfast',
    travelTime: '3 days, 2 nights',
    description:
      'A curated 3-day Palawan getaway pairing Coron Island lagoons, Malcapuya white sandbar, and Maquinit hot springs with sunset views from Mt. Tapyas.',
    images: [IMG.tropicalShore, IMG.elNidoLagoon, IMG.resortPool],
  },
  {
    title: 'Puerto Princesa Underground River & Mangrove Paddle',
    city: 'Puerto Princesa',
    province: 'Palawan',
    location: 'Sabang Wharf, Puerto Princesa, Palawan',
    price: 2450,
    durationDays: 1,
    capacity: 15,
    format: 'joiner',
    themes: ['nature_wildlife', 'city_historical'],
    lat: 10.1947,
    lng: 118.9261,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '9 hours round-trip from Puerto Princesa',
    description:
      'Cruise inside the UNESCO World Heritage Subterranean River followed by a peaceful mangrove paddle and local buffet lunch by Sabang Bay.',
    images: [IMG.boatLake, IMG.mistyForest, IMG.limestoneBay],
  },
  {
    title: 'Port Barton Laid-Back Turtle Reef & Sandbar Hop',
    city: 'San Vicente',
    province: 'Palawan',
    location: 'Port Barton Beachfront, San Vicente, Palawan',
    price: 1650,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 10.4534,
    lng: 119.1627,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '6.5 hours by outrigger',
    description:
      'Snorkel with sea turtles at Turtle Sanctuary, relax on Starfish Sandbar, and swim at Exotic and Maxima Islands far from the crowds.',
    images: [IMG.whiteBeach, IMG.reefDive, IMG.tropicalShore],
  },
  {
    title: 'Balabac 4-Day Untouched Sandbars & Pink Beach Safari',
    city: 'Balabac',
    province: 'Palawan',
    location: 'Rio Tuba Port, Bataraza, Palawan',
    price: 14800,
    durationDays: 4,
    capacity: 10,
    format: 'joiner',
    themes: ['island_hopping', 'adventure_sports', 'nature_wildlife'],
    lat: 7.9776,
    lng: 117.0652,
    accommodation: '3 nights island eco-cottages and beach glamping tents',
    travelTime: '4 days, 3 nights',
    description:
      'Explore Onuk Island, Candaraman Sandbar, Punta Sebaring, and Comiran Pink Beach on an expedition to Palawan’s southernmost islands.',
    images: [IMG.azureCove, IMG.campUnderStars, IMG.whiteBeach],
  },
  {
    title: 'El Nido Private Catamaran Sunset & Wellness Sail',
    city: 'El Nido',
    province: 'Palawan',
    location: 'Lio Beach Jetty, El Nido, Palawan',
    price: 11500,
    durationDays: 1,
    capacity: 8,
    format: 'private',
    themes: ['wellness_retreat', 'island_hopping', 'culinary_food'],
    lat: 11.2012,
    lng: 119.4139,
    accommodation: 'Day charter — no overnight stay required',
    travelTime: '5 hours private sail',
    description:
      'Private sunset charter through Bacuit Bay with stand-up paddleboards, chef-prepared seafood platters, and guided breathwork on deck.',
    images: [IMG.resortPool, IMG.elNidoLagoon, IMG.localFeast],
  },

  // Siargao (5)
  {
    title: 'Siargao Cloud 9 Surf Coaching & Sunset Session',
    city: 'General Luna',
    province: 'Surigao del Norte',
    location: 'Cloud 9 Boardwalk, General Luna, Siargao',
    price: 1450,
    durationDays: 1,
    capacity: 6,
    format: 'solo',
    themes: ['adventure_sports', 'wellness_retreat'],
    lat: 9.8141,
    lng: 126.1657,
    accommodation: 'Day experience — surfboards & rashguards included',
    travelTime: '3 hours coastal coaching',
    description:
      'Beginner or intermediate surf coaching at Cloud 9 and Jacking Horse with certified local instructors, board rental, and reef-safe sun protection.',
    images: [IMG.tropicalShore, IMG.islandPalm, IMG.whiteBeach],
  },
  {
    title: 'Siargao Tri-Island Hopping: Naked, Daku & Guyam',
    city: 'General Luna',
    province: 'Surigao del Norte',
    location: 'General Luna Boulevard Pier, Siargao',
    price: 1600,
    originalPrice: 1950,
    durationDays: 1,
    capacity: 15,
    format: 'joiner',
    themes: ['island_hopping', 'culinary_food'],
    lat: 9.7845,
    lng: 126.1563,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '6 hours by island boat',
    description:
      'Island-hop across Siargao’s iconic trio with boodle-fight seafood lunch on Daku Island and fresh coconut refreshments under Guyam palms.',
    images: [IMG.islandPalm, IMG.localFeast, IMG.whiteBeach],
  },
  {
    title: 'Sohoton Cove Jellyfish Lagoon & Bucas Grande Tour',
    city: 'Socorro',
    province: 'Surigao del Norte',
    location: 'Dapa Port, Siargao Island',
    price: 2750,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['nature_wildlife', 'island_hopping', 'adventure_sports'],
    lat: 9.6079,
    lng: 125.9513,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '9 hours sea & lagoon excursion',
    description:
      'Enter Hagukan bioluminescent cave, cliff-jump into Magkukuob Cave, and paddle over stingless jellyfish in calm emerald coves.',
    images: [IMG.limestoneBay, IMG.boatLake, IMG.azureCove],
  },
  {
    title: 'Siargao 4-Day Surf, Lagoon & Coconut Road Retreat',
    city: 'General Luna',
    province: 'Surigao del Norte',
    location: 'Tourism Road, General Luna, Siargao',
    price: 12900,
    originalPrice: 14500,
    durationDays: 4,
    capacity: 10,
    format: 'joiner',
    themes: ['wellness_retreat', 'adventure_sports', 'island_hopping'],
    lat: 9.7912,
    lng: 126.1591,
    accommodation: '3 nights tropical surf villa with breakfast',
    travelTime: '4 days, 3 nights',
    description:
      'Combine morning surf lessons, Sugba Lagoon paddleboarding, Magpupungko rock pools, Maasin river rope swing, and restorative beach yoga.',
    images: [IMG.resortPool, IMG.islandPalm, IMG.tropicalShore],
  },
  {
    title: 'Siargao North Island Secret Beaches & Rock Pools',
    city: 'Burgos',
    province: 'Surigao del Norte',
    location: 'Pacifico Beach, San Isidro, Siargao',
    price: 3800,
    durationDays: 1,
    capacity: 6,
    format: 'private',
    themes: ['nature_wildlife', 'adventure_sports'],
    lat: 9.9562,
    lng: 126.0853,
    accommodation: 'Day tour with private multicab & driver',
    travelTime: '7 hours north island loop',
    description:
      'Private north Siargao exploration to Alegria Beach, TakTak Falls, Coconut Mountain Viewpoint, and Pacifico surf cafés.',
    images: [IMG.coastalDrive, IMG.tropicalShore, IMG.mistyForest],
  },

  // Boracay & Aklan (4)
  {
    title: 'Boracay Crystal Kayak, Reef Snorkel & Puka Beach',
    city: 'Malay',
    province: 'Aklan',
    location: 'Station 1 White Beach, Boracay',
    price: 1550,
    durationDays: 1,
    capacity: 16,
    format: 'joiner',
    themes: ['island_hopping', 'adventure_sports'],
    lat: 11.9674,
    lng: 121.9248,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '5 hours island loop',
    description:
      'Cruise around Boracay with stops at Coral Garden, Crocodile Island, Crystal Cove, and tranquil Puka Shell Beach.',
    images: [IMG.whiteBeach, IMG.azureCove, IMG.reefDive],
  },
  {
    title: 'Boracay Paraw Sailing & Sunset Spa Reset',
    city: 'Malay',
    province: 'Aklan',
    location: 'Station 2 Beachfront, Boracay',
    price: 2950,
    durationDays: 1,
    capacity: 4,
    format: 'solo',
    themes: ['wellness_retreat', 'island_hopping'],
    lat: 11.9612,
    lng: 121.9261,
    accommodation: 'Day wellness experience',
    travelTime: '4 hours sail & hilot massage',
    description:
      'Glide across Sibuyan Sea aboard a traditional outrigger paraw at golden hour followed by a 75-minute Filipino hilot wellness massage.',
    images: [IMG.resortPool, IMG.tropicalShore, IMG.whiteBeach],
  },
  {
    title: 'Boracay 3-Day Family White Beach & Ariel’s Point',
    city: 'Malay',
    province: 'Aklan',
    location: 'Caticlan Jetty Port, Malay, Aklan',
    price: 9400,
    originalPrice: 10800,
    durationDays: 3,
    capacity: 10,
    format: 'private',
    themes: ['island_hopping', 'wellness_retreat', 'culinary_food'],
    lat: 11.9332,
    lng: 121.9511,
    accommodation: '2 nights beachfront resort near Station 1',
    travelTime: '3 days, 2 nights',
    description:
      'Hassle-free private family package with airport transfers, cliff-diving excursion at Ariel’s Point, paraw sunset sail, and beachfront dining.',
    images: [IMG.whiteBeach, IMG.resortPool, IMG.localFeast],
  },
  {
    title: 'Buruanga & Antique Mountain-to-Sea Eco Trek',
    city: 'Buruanga',
    province: 'Aklan',
    location: 'Hinugtan Beach, Buruanga, Aklan',
    price: 2200,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['nature_wildlife', 'adventure_sports'],
    lat: 11.8421,
    lng: 121.8832,
    accommodation: 'Day tour — no overnight stay required',
    travelTime: '7 hours from Boracay/Caticlan',
    description:
      'Escape mainland Aklan’s lush coastline with kawa hot bath soaking, river tubing in Tibiao, and hidden coves in Buruanga.',
    images: [IMG.mistyForest, IMG.valleyView, IMG.azureCove],
  },

  // Cebu & Bohol (8)
  {
    title: 'Badian Kawasan Falls Canyoneering Thrill',
    city: 'Badian',
    province: 'Cebu',
    location: 'Matutinao Basecamp, Badian, Cebu',
    price: 2250,
    originalPrice: 2600,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'nature_wildlife'],
    lat: 9.8024,
    lng: 123.3741,
    accommodation: 'Day tour — safety gear & lunch included',
    travelTime: '5 hours canyon trek',
    description:
      'Scramble, rappel, and leap into turquoise pools down the Matutinao gorge ending at multi-tiered Kawasan Falls with certified DOT guides.',
    images: [IMG.mistyForest, IMG.valleyView, IMG.boatLake],
  },
  {
    title: 'Moalboal Sardine Run & Pescador Island Reef Dive',
    city: 'Moalboal',
    province: 'Cebu',
    location: 'Panagsama Beach, Moalboal, Cebu',
    price: 1850,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 9.9471,
    lng: 123.3662,
    accommodation: 'Day tour — mask, fins & lifevest included',
    travelTime: '5 hours marine tour',
    description:
      'Swim amidst millions of shimmering sardines just off Panagsama, spot green sea turtles at Talisay Point, and snorkel Pescador Island drop-off.',
    images: [IMG.reefDive, IMG.azureCove, IMG.tropicalShore],
  },
  {
    title: 'Cebu City Heritage Walk & Lechon Culinary Crawl',
    city: 'Cebu City',
    province: 'Cebu',
    location: 'Plaza Independencia, Cebu City',
    price: 1750,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['city_historical', 'culinary_food'],
    lat: 10.2926,
    lng: 123.9052,
    accommodation: 'Day city tour with tastings',
    travelTime: '5 hours walking & van transfer',
    description:
      'Trace Cebu’s centuries-old roots at Fort San Pedro, Magellan’s Cross, and Yap-San Diego House, then feast on crispy Carcar lechon and Puso.',
    images: [IMG.heritageCoast, IMG.localFeast, IMG.marketStreet],
  },
  {
    title: 'Bantayan Island 2-Day Virgin Sandbar & Sunset Bike',
    city: 'Santa Fe',
    province: 'Cebu',
    location: 'Santa Fe Port, Bantayan Island, Cebu',
    price: 5400,
    durationDays: 2,
    capacity: 12,
    format: 'joiner',
    themes: ['island_hopping', 'wellness_retreat'],
    lat: 11.1583,
    lng: 123.8065,
    accommodation: '1 night beachfront cottage in Santa Fe',
    travelTime: '2 days, 1 night',
    description:
      'Cross to northern Cebu for powdery Kota Beach, Virgin Island snorkeling, Ogtong Cave, and cycling through peaceful mangrove boardwalks.',
    images: [IMG.whiteBeach, IMG.islandPalm, IMG.coastalDrive],
  },
  {
    title: 'Malapascua Thresher Shark & Kalanggaman Sandbar 3D2N',
    city: 'Daanbantayan',
    province: 'Cebu',
    location: 'Maya Port, Daanbantayan, Cebu',
    price: 11800,
    durationDays: 3,
    capacity: 8,
    format: 'joiner',
    themes: ['adventure_sports', 'island_hopping', 'nature_wildlife'],
    lat: 11.3347,
    lng: 124.1158,
    accommodation: '2 nights dive lodge on Bounty Beach',
    travelTime: '3 days, 2 nights',
    description:
      'Dawn dive at Monad Shoal with pelagic thresher sharks plus a full-day speedboat excursion to Kalanggaman’s famous sweeping sandbar.',
    images: [IMG.reefDive, IMG.elNidoLagoon, IMG.azureCove],
  },
  {
    title: 'Bohol Chocolate Hills, Tarsier & Loboc River Cruise',
    city: 'Tagbilaran',
    province: 'Bohol',
    location: 'Tagbilaran City Port, Bohol',
    price: 1950,
    originalPrice: 2300,
    durationDays: 1,
    capacity: 15,
    format: 'joiner',
    themes: ['nature_wildlife', 'city_historical', 'culinary_food'],
    lat: 9.8299,
    lng: 124.1397,
    accommodation: 'Day countryside tour',
    travelTime: '8 hours air-conditioned van tour',
    description:
      'Visit Baclayon Church, Bilar Man-Made Forest, Philippine Tarsier Sanctuary, Chocolate Hills deck, and dine aboard the Loboc floating restaurant.',
    images: [IMG.rollingHills, IMG.boatLake, IMG.localFeast],
  },
  {
    title: 'Panglao Balicasag Dolphin Watch & Turtle Sanctuary',
    city: 'Panglao',
    province: 'Bohol',
    location: 'Alona Beach, Panglao, Bohol',
    price: 1700,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 9.5484,
    lng: 123.7717,
    accommodation: 'Day marine tour',
    travelTime: '6 hours morning departure',
    description:
      'Set sail at sunrise for playful spinner dolphins, snorkel Balicasag Marine Sanctuary’s coral wall, and wade across Isola de Francesco sandbar.',
    images: [IMG.azureCove, IMG.reefDive, IMG.whiteBeach],
  },
  {
    title: 'Anda Bohol Hidden Caves & Quiet Beach Retreat 3D2N',
    city: 'Anda',
    province: 'Bohol',
    location: 'Quinale Beach, Anda, Bohol',
    price: 8400,
    durationDays: 3,
    capacity: 6,
    format: 'private',
    themes: ['wellness_retreat', 'nature_wildlife'],
    lat: 9.7443,
    lng: 124.5756,
    accommodation: '2 nights boutique cliffside resort in Anda',
    travelTime: '3 days, 2 nights',
    description:
      'Discover Bohol’s quiet eastern peninsula: swim in Cabagnow Cave Pool, walk the Lamanok Mystic Island boardwalk, and unwind on Quinale Beach.',
    images: [IMG.resortPool, IMG.limestoneBay, IMG.tropicalShore],
  },

  // Cordillera & Northern Luzon (7)
  {
    title: 'Sagada Sea of Clouds, Hanging Coffins & Cave Trek',
    city: 'Sagada',
    province: 'Mountain Province',
    location: 'Sagada Municipal Tourist Center, Mountain Province',
    price: 4950,
    originalPrice: 5600,
    durationDays: 3,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'city_historical', 'nature_wildlife'],
    lat: 17.0844,
    lng: 120.9022,
    accommodation: '2 nights pinewood homestay in Sagada',
    travelTime: '3 days, 2 nights (overnight van from Manila)',
    description:
      'Watch sunrise above Marlboro Hills sea of clouds, explore Sumaguing Cave formations, visit Echo Valley hanging coffins, and hike Bomod-ok Falls.',
    images: [IMG.mountainPeak, IMG.alpineDawn, IMG.mistyForest],
  },
  {
    title: 'Banaue & Batad UNESCO Rice Terraces 3D2N Immersion',
    city: 'Banaue',
    province: 'Ifugao',
    location: 'Banaue Trade Center, Ifugao',
    price: 5800,
    durationDays: 3,
    capacity: 10,
    format: 'joiner',
    themes: ['city_historical', 'nature_wildlife', 'adventure_sports'],
    lat: 16.9247,
    lng: 121.0579,
    accommodation: '2 nights native Ifugao-view inn in Batad & Banaue',
    travelTime: '3 days, 2 nights',
    description:
      'Trek the 2,000-year-old amphitheater terraces of Batad down to Tappiyah Waterfall with local Ifugao guides and hearth-cooked heirloom rice meals.',
    images: [IMG.valleyView, IMG.rollingHills, IMG.mountainPeak],
  },
  {
    title: 'Mt. Pulag Ambangeg Sunrise Sea of Clouds Climb',
    city: 'Kabayan',
    province: 'Benguet',
    location: 'DENR Ambangeg Ranger Station, Kabayan, Benguet',
    price: 4200,
    durationDays: 2,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'nature_wildlife'],
    lat: 16.5978,
    lng: 120.8992,
    accommodation: '1 night homestay near Babadak Ranger Station',
    travelTime: '2 days, 1 night',
    description:
      'Hike Luzon’s highest peak through mossy dwarf-bamboo cloud forest to witness golden sunrise over the Cordillera sea of clouds.',
    images: [IMG.alpineDawn, IMG.mountainPeak, IMG.campUnderStars],
  },
  {
    title: 'Baguio & Atok Northern Blossom Highland Weekend',
    city: 'Baguio City',
    province: 'Benguet',
    location: 'Burnham Park Rose Garden, Baguio City',
    price: 5200,
    durationDays: 3,
    capacity: 12,
    format: 'joiner',
    themes: ['wellness_retreat', 'culinary_food', 'nature_wildlife'],
    lat: 16.4122,
    lng: 120.5931,
    accommodation: '2 nights pine-view cabin near Camp John Hay',
    travelTime: '3 days, 2 nights',
    description:
      'Stroll terraced highland flower farms in Atok, taste freshly roasted Cordillera Benguet coffee, visit BenCab Museum, and pick La Trinidad strawberries.',
    images: [IMG.mistyForest, IMG.valleyView, IMG.localFeast],
  },
  {
    title: 'Batanes 4-Day Basco, Sabtang & Rolling Hills Discovery',
    city: 'Basco',
    province: 'Batanes',
    location: 'Basco Airport Arrival Hall, Batanes',
    price: 16900,
    originalPrice: 18500,
    durationDays: 4,
    capacity: 10,
    format: 'joiner',
    themes: ['city_historical', 'nature_wildlife', 'culinary_food'],
    lat: 20.4485,
    lng: 121.9708,
    accommodation: '3 nights stone-house boutique lodge in Basco',
    travelTime: '4 days, 3 nights (land & boat in Batanes)',
    description:
      'Cycle past Basco Lighthouse, Marlboro Country, and Vayang Rolling Hills, then sail to Sabtang Island to see traditional Ivatan stone houses.',
    images: [IMG.rollingHills, IMG.heritageCoast, IMG.coastalDrive],
  },
  {
    title: 'Vigan Heritage Village, Kalesa & Ilocano Food Walk',
    city: 'Vigan City',
    province: 'Ilocos Sur',
    location: 'Calle Crisologo Arch, Vigan City, Ilocos Sur',
    price: 1350,
    durationDays: 1,
    capacity: 15,
    format: 'joiner',
    themes: ['city_historical', 'culinary_food'],
    lat: 17.5746,
    lng: 120.3869,
    accommodation: 'Day heritage & food tour',
    travelTime: '4.5 hours guided walk & kalesa ride',
    description:
      'Walk cobblestone Calle Crisologo at twilight, try traditional burnay pottery making, and sample crispy Vigan empanada, bagnet, and okoy.',
    images: [IMG.heritageCoast, IMG.marketStreet, IMG.localFeast],
  },
  {
    title: 'Ilocos Norte Sand Dunes, Windmills & Pagudpud Loop 3D2N',
    city: 'Pagudpud',
    province: 'Ilocos Norte',
    location: 'Paoay Church Plaza, Ilocos Norte',
    price: 6800,
    durationDays: 3,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'city_historical', 'island_hopping'],
    lat: 18.5621,
    lng: 120.7889,
    accommodation: '2 nights beachfront resort in Saud, Pagudpud',
    travelTime: '3 days, 2 nights',
    description:
      '4x4 dune bashing and sandboarding in La Paz, UNESCO Paoay Church, Bangui Windmills, Kapurpurawan Rock Formation, and Saud Blue Lagoon.',
    images: [IMG.coastalDrive, IMG.roadTrip, IMG.whiteBeach],
  },

  // Bicol & Southern Luzon (6)
  {
    title: 'Albay Mayon Volcano ATV & Cagsawa Ruins Adventure',
    city: 'Legazpi City',
    province: 'Albay',
    location: 'Cagsawa Ruins Park, Daraga, Albay',
    price: 2150,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['adventure_sports', 'city_historical'],
    lat: 13.1681,
    lng: 123.7007,
    accommodation: 'Day tour — ATV & helmet included',
    travelTime: '6 hours lava trail & heritage stops',
    description:
      'Ride an ATV across black volcanic lava trails to Mayon’s Green Lava Wall, visit Cagsawa Ruins, and savor spicy Bicol Express and sili ice cream.',
    images: [IMG.mountainPeak, IMG.roadTrip, IMG.localFeast],
  },
  {
    title: 'Donsol Ethical Whale Shark Snorkel & Firefly River',
    city: 'Donsol',
    province: 'Sorsogon',
    location: 'Donsol Visitor Center, Sorsogon',
    price: 2650,
    durationDays: 1,
    capacity: 10,
    format: 'joiner',
    themes: ['nature_wildlife', 'island_hopping'],
    lat: 12.9083,
    lng: 123.5978,
    accommodation: 'Day eco-tour',
    travelTime: '6 hours marine & river cruise',
    description:
      'Join trained BIO spotters for ethical, non-feeding snorkeling alongside gentle butanding (whale sharks), capped with a firefly mangrove cruise.',
    images: [IMG.reefDive, IMG.boatLake, IMG.mistyForest],
  },
  {
    title: 'Caramoan 3-Day Secret Lagoons & Limestone Beaches',
    city: 'Caramoan',
    province: 'Camarines Sur',
    location: 'Guijalo Port, Caramoan, Camarines Sur',
    price: 7500,
    originalPrice: 8400,
    durationDays: 3,
    capacity: 14,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 13.7676,
    lng: 123.8619,
    accommodation: '2 nights Paniman beach resort',
    travelTime: '3 days, 2 nights',
    description:
      'Island-hop across Matukad, Lahos disappearing sandbar, Cagbalinad, and Tayak Lagoon in Bicol’s pristine limestone archipelago.',
    images: [IMG.limestoneBay, IMG.elNidoLagoon, IMG.whiteBeach],
  },
  {
    title: 'Batangas Anilao Macro Reef Dive & Sunset Deck',
    city: 'Mabini',
    province: 'Batangas',
    location: 'Anilao Pier, Mabini, Batangas',
    price: 3400,
    durationDays: 1,
    capacity: 8,
    format: 'solo',
    themes: ['adventure_sports', 'nature_wildlife'],
    lat: 13.7586,
    lng: 120.9163,
    accommodation: 'Day dive resort pass & lunch included',
    travelTime: '2.5 hours south of Manila',
    description:
      'Two guided reef dives or discover-scuba sessions in the Coral Triangle’s macro photography capital, complete with dive master and beach lunch.',
    images: [IMG.reefDive, IMG.azureCove, IMG.resortPool],
  },
  {
    title: 'Tagaytay Ridge Wellness Farm & Taal Lake Heritage',
    city: 'Tagaytay City',
    province: 'Cavite',
    location: 'Tagaytay Rotonda, Cavite',
    price: 2900,
    durationDays: 1,
    capacity: 10,
    format: 'private',
    themes: ['wellness_retreat', 'culinary_food'],
    lat: 14.1153,
    lng: 120.9621,
    accommodation: 'Day wellness & culinary escape',
    travelTime: '7 hours private ridge loop',
    description:
      'Organic farm-to-table tasting in Alfonso, artisanal Barako coffee workshop overlooking Taal Lake, and quiet afternoon spa thermal soak.',
    images: [IMG.resortPool, IMG.localFeast, IMG.valleyView],
  },
  {
    title: 'Zambales Anawangin & Nagsasa Cove 2D1N Pine Camp',
    city: 'San Antonio',
    province: 'Zambales',
    location: 'Pundaquit Beach, San Antonio, Zambales',
    price: 3250,
    durationDays: 2,
    capacity: 16,
    format: 'joiner',
    themes: ['nature_wildlife', 'adventure_sports', 'island_hopping'],
    lat: 14.8722,
    lng: 120.0641,
    accommodation: '1 night beach tent camping under agoho pines',
    travelTime: '2 days, 1 night',
    description:
      'Boat from Pundaquit to volcanic-ash beaches framed by pine trees, hike Mt. Pundaquit viewpoint, stargaze by a bonfire, and snorkel Capones Island.',
    images: [IMG.campUnderStars, IMG.tropicalShore, IMG.boatLake],
  },

  // Metro Manila & Nearby Luzon (5)
  {
    title: 'Intramuros Bamboo Bike & Fort Santiago Twilight Tour',
    city: 'Manila',
    province: 'Metro Manila',
    location: 'Plaza San Luis Complex, Intramuros, Manila',
    price: 1150,
    durationDays: 1,
    capacity: 14,
    format: 'joiner',
    themes: ['city_historical', 'adventure_sports'],
    lat: 14.5896,
    lng: 120.9754,
    accommodation: 'Day city tour — Bambike & helmet included',
    travelTime: '3 hours guided ride',
    description:
      'Cycle handcrafted bamboo bikes across Spanish-era ramparts, Baluarte de San Diego, Manila Cathedral, and Fort Santiago with local historians.',
    images: [IMG.heritageCoast, IMG.marketStreet, IMG.roadTrip],
  },
  {
    title: 'Binondo Chinatown Heritage & Street Food Crawl',
    city: 'Manila',
    province: 'Metro Manila',
    location: 'Binondo Church Plaza, Manila',
    price: 1250,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['culinary_food', 'city_historical'],
    lat: 14.6001,
    lng: 120.9746,
    accommodation: 'Day food crawl — 7 tasting stops included',
    travelTime: '3.5 hours walking food tour',
    description:
      'Taste your way through the world’s oldest Chinatown: handmade lumpia, beef mami, fried siopao, hopia, and hidden heritage apothecaries.',
    images: [IMG.marketStreet, IMG.localFeast, IMG.heritageCoast],
  },
  {
    title: 'La Union Surf, Pottery & Sunset Café Weekend',
    city: 'San Juan',
    province: 'La Union',
    location: 'Urbiztondo Beach, San Juan, La Union',
    price: 4900,
    originalPrice: 5500,
    durationDays: 2,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'culinary_food', 'wellness_retreat'],
    lat: 16.6596,
    lng: 120.3211,
    accommodation: '1 night surf hostel near Urbiztondo',
    travelTime: '2 days, 1 night',
    description:
      'Learn to ride mellow Urbiztondo waves, hand-throw clay at Red Clay Pagdalagan, visit Tangadan Falls, and enjoy craft coffee by the sea.',
    images: [IMG.tropicalShore, IMG.localFeast, IMG.coastalDrive],
  },
  {
    title: 'Baler Surfing, Balete Park & Ditumabo Falls 2D1N',
    city: 'Baler',
    province: 'Aurora',
    location: 'Sabang Beach, Baler, Aurora',
    price: 4600,
    durationDays: 2,
    capacity: 14,
    format: 'joiner',
    themes: ['adventure_sports', 'nature_wildlife'],
    lat: 15.7586,
    lng: 121.5612,
    accommodation: '1 night surf lodge in Sabang, Baler',
    travelTime: '2 days, 1 night',
    description:
      'Catch Pacific swells at Sabang Beach, trek to towering Mother Falls in San Luis, climb the Millennium Balete Tree, and visit Museo de Baler.',
    images: [IMG.tropicalShore, IMG.mistyForest, IMG.coastalDrive],
  },
  {
    title: 'Masungi Georeserve & Rizal Highland Discovery Walk',
    city: 'Baras',
    province: 'Rizal',
    location: 'KM 47 Marcos Highway, Baras, Rizal',
    price: 2300,
    durationDays: 1,
    capacity: 10,
    format: 'joiner',
    themes: ['nature_wildlife', 'adventure_sports', 'wellness_retreat'],
    lat: 14.5919,
    lng: 121.3189,
    accommodation: 'Day conservation trail',
    travelTime: '4 hours guided limestone trail',
    description:
      'Cross suspended rope bridges, spider-web viewing nets, and karst limestone spires in a protected reforestation sanctuary 90 minutes from Manila.',
    images: [IMG.mountainPeak, IMG.mistyForest, IMG.valleyView],
  },

  // Visayas & Mindanao Gems (7)
  {
    title: 'Siquijor Mystic Waterfalls, Cliff Jump & Sunset Tour',
    city: 'San Juan',
    province: 'Siquijor',
    location: 'Siquijor Port, Siquijor',
    price: 1750,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['nature_wildlife', 'wellness_retreat', 'adventure_sports'],
    lat: 9.1563,
    lng: 123.5161,
    accommodation: 'Day island circuit',
    travelTime: '7 hours coastal loop',
    description:
      'Swing into turquoise Cambugahay Falls, relax under the 400-year-old Enchanted Balete Tree fish spa, and cliff-dive at Salagdoong Beach.',
    images: [IMG.islandPalm, IMG.mistyForest, IMG.azureCove],
  },
  {
    title: 'Dumaguete Apo Island Sea Turtle Snorkel & Sandbar',
    city: 'Dauin',
    province: 'Negros Oriental',
    location: 'Malatapay Wharf, Zamboanguita, Negros Oriental',
    price: 1950,
    durationDays: 1,
    capacity: 12,
    format: 'joiner',
    themes: ['island_hopping', 'nature_wildlife'],
    lat: 9.0793,
    lng: 123.2711,
    accommodation: 'Day marine sanctuary tour',
    travelTime: '6 hours round-trip boat',
    description:
      'Swim alongside giant green sea turtles just meters from Apo Island’s volcanic cobble shore and enjoy home-cooked island lunch overlooking Negros.',
    images: [IMG.reefDive, IMG.azureCove, IMG.tropicalShore],
  },
  {
    title: 'Camiguin White Island Sandbar, Volcano & Springs 3D2N',
    city: 'Mambajao',
    province: 'Camiguin',
    location: 'Benoni Port, Mahinog, Camiguin',
    price: 8200,
    originalPrice: 9200,
    durationDays: 3,
    capacity: 10,
    format: 'joiner',
    themes: ['island_hopping', 'wellness_retreat', 'nature_wildlife'],
    lat: 9.2512,
    lng: 124.7145,
    accommodation: '2 nights boutique resort in Mambajao',
    travelTime: '3 days, 2 nights',
    description:
      'Walk White Island Sandbar facing Mt. Hibok-Hibok, snorkel the Sunken Cemetery, dip in icy Sto. Niño Cold Spring and warm Ardent Hot Spring.',
    images: [IMG.whiteBeach, IMG.mountainPeak, IMG.resortPool],
  },
  {
    title: 'Bukidnon Dahilayan Pine Ridge & Cedar Falls Weekend',
    city: 'Manolo Fortich',
    province: 'Bukidnon',
    location: 'Dahilayan Adventure Park, Bukidnon',
    price: 5600,
    durationDays: 2,
    capacity: 12,
    format: 'joiner',
    themes: ['adventure_sports', 'nature_wildlife'],
    lat: 8.2094,
    lng: 124.8594,
    accommodation: '1 night mountain pine lodge in Dahilayan',
    travelTime: '2 days, 1 night',
    description:
      'Ride Asia’s longest dual zipline over misty pine ridges, trek to three cascading falls in Impasug-ong, and take in the Communal Ranch vistas.',
    images: [IMG.valleyView, IMG.alpineDawn, IMG.mountainPeak],
  },
  {
    title: 'Davao Samal Island Hopping & Philippine Eagle Trail',
    city: 'Davao City',
    province: 'Davao del Sur',
    location: 'Sta. Ana Wharf, Davao City',
    price: 3900,
    durationDays: 2,
    capacity: 12,
    format: 'joiner',
    themes: ['nature_wildlife', 'island_hopping', 'culinary_food'],
    lat: 7.0731,
    lng: 125.6128,
    accommodation: '1 night Samal beachfront resort',
    travelTime: '2 days, 1 night',
    description:
      'Meet the critically endangered Philippine Eagle in Malagos, taste single-origin Davao cacao, then boat across Talikud Coral Garden and Hagimit Falls.',
    images: [IMG.mistyForest, IMG.islandPalm, IMG.localFeast],
  },
  {
    title: 'Iloilo Heritage Mansions & Guimaras Mango Island Hop',
    city: 'Iloilo City',
    province: 'Iloilo',
    location: 'Ortiz Wharf, Iloilo City',
    price: 3450,
    durationDays: 2,
    capacity: 14,
    format: 'joiner',
    themes: ['culinary_food', 'city_historical', 'island_hopping'],
    lat: 10.6928,
    lng: 122.5721,
    accommodation: '1 night heritage hotel in Iloilo City',
    travelTime: '2 days, 1 night',
    description:
      'Savor authentic La Paz Batchoy and Pancit Molo, tour UNESCO Miag-ao Church, then hop across Guimaras’ Alubihod cove and sweet mango orchards.',
    images: [IMG.localFeast, IMG.heritageCoast, IMG.whiteBeach],
  },
  {
    title: 'Siargao Culinary Farm-to-Table & Island Bakehouse',
    city: 'General Luna',
    province: 'Surigao del Norte',
    location: 'Catangnan Bridge, General Luna, Siargao',
    price: 1950,
    durationDays: 1,
    capacity: 8,
    format: 'solo',
    themes: ['culinary_food', 'wellness_retreat'],
    lat: 9.8056,
    lng: 126.1619,
    accommodation: 'Day culinary workshop & tasting',
    travelTime: '4 hours afternoon coastal tasting',
    description:
      'Visit an organic coconut & cacao farm, cook Kinilaw na Tanigue with local chefs, and finish with tropical pastries at Catangnan sunset.',
    images: [IMG.localFeast, IMG.marketStreet, IMG.islandPalm],
  },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

async function main() {
  if (DUMMY_TOURS.length !== 50) {
    throw new Error(`Expected 50 dummy tours, got ${DUMMY_TOURS.length}`);
  }

  const { data: organizers, error: orgError } = await supabase
    .from('organizer_profiles')
    .select('id, display_name, company_name, status')
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (orgError || !organizers || organizers.length === 0) {
    throw new Error(`No approved organizer_profiles found: ${orgError?.message ?? 'empty'}`);
  }

  console.log(`Found ${organizers.length} approved organizer(s): ${organizers.map((o) => o.display_name || o.company_name).join(', ')}`);

  // Base dates starting from 2026-12-03 onwards so every schedule is strictly in the future.
  const baseDates = ['2026-12-05', '2026-12-19', '2027-01-10', '2027-01-24', '2027-02-07', '2027-02-21'];

  let inserted = 0;
  let skipped = 0;

  for (let idx = 0; idx < DUMMY_TOURS.length; idx++) {
    const spec = DUMMY_TOURS[idx];
    const code = String(idx + 1).padStart(2, '0');
    const slug = `${slugify(spec.title)}-travi-seed-${code}`;
    const organizer = organizers[idx % organizers.length];

    const { data: existing } = await supabase
      .from('tours')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { data: tour, error: tourErr } = await supabase
      .from('tours')
      .insert({
        organizer_id: organizer.id,
        title: spec.title,
        slug,
        description: spec.description,
        location: spec.location,
        city: spec.city,
        province: spec.province,
        price_per_person: spec.price,
        duration_days: spec.durationDays,
        accommodation_details: spec.accommodation,
        travel_time_info: spec.travelTime,
        status: 'published',
        format: spec.format,
        themes: spec.themes,
        cover_image_url: spec.images[0],
        image_urls: spec.images,
        latitude: spec.lat,
        longitude: spec.lng,
      })
      .select('id')
      .single();

    if (tourErr || !tour) {
      console.error(`Failed to insert tour #${code} (${spec.title}):`, tourErr);
      continue;
    }

    // Insert itinerary days (1..durationDays)
    const itineraries = Array.from({ length: spec.durationDays }, (_, dayIdx) => {
      const dayNumber = dayIdx + 1;
      const dayLabel =
        spec.durationDays === 1
          ? 'Full-Day Guided Experience'
          : dayNumber === 1
            ? `Arrival & ${spec.city} Highlights`
            : dayNumber === spec.durationDays
              ? `Morning Excursion & Departure`
              : `Full-Day ${spec.city} Exploration`;
      return {
        tour_id: tour.id,
        day_number: dayNumber,
        title: dayLabel,
        description:
          dayNumber === 1
            ? `Meet your local organizer at ${spec.location}. ${spec.description}`
            : `Guided activities in and around ${spec.city}, ${spec.province}, including local meals and scenic stops.`,
      };
    });

    const { error: itinErr } = await supabase.from('tour_itineraries').insert(itineraries);
    if (itinErr) {
      console.error(`Failed itineraries for ${spec.title}:`, itinErr);
    }

    // Insert 2-3 upcoming open schedules staggered across Dec 2026 - Mar 2027
    const dateOffset = idx % 10;
    const scheduleStarts = [
      addDays(baseDates[idx % 3], dateOffset),
      addDays(baseDates[(idx % 3) + 2], dateOffset + 3),
      addDays(baseDates[(idx % 3) + 3], dateOffset + 7),
    ];

    const schedules = scheduleStarts.map((startDate, sIdx) => ({
      tour_id: tour.id,
      start_date: startDate,
      end_date: addDays(startDate, spec.durationDays - 1),
      capacity: spec.capacity,
      booked_count: sIdx === 0 && spec.format !== 'private' ? Math.min(2, spec.capacity - 2) : 0,
      price_per_person: spec.price,
      original_price: spec.originalPrice ?? null,
      status: 'open',
      transport_type: sIdx % 2 === 0 ? 'self_provided' : 'none',
      transport_status: sIdx % 2 === 0 ? 'self_provided' : 'not_required',
    }));

    const { error: schedErr } = await supabase.from('tour_schedules').insert(schedules);
    if (schedErr) {
      console.error(`Failed schedules for ${spec.title}:`, schedErr);
    }

    inserted++;
  }

  console.log(`Seed complete! Inserted: ${inserted}, Skipped (already existed): ${skipped}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
