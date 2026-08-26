'use client';

import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

// Fix Leaflet's default icon issue with Next.js/Webpack
const fixLeafletIcon = () => {
  if (typeof window !== 'undefined') {
    const L = require('leaflet');
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }
};

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  // @ts-ignore
  useMapEvents({
    click(e: any) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export default function LocationPicker({ 
  initialLatitude, 
  initialLongitude,
  onChange
}: { 
  initialLatitude?: number | null, 
  initialLongitude?: number | null,
  onChange: (lat: number, lng: number) => void 
}) {
  const [position, setPosition] = useState<[number, number] | null>(
    initialLatitude && initialLongitude ? [initialLatitude, initialLongitude] : null
  );

  useEffect(() => {
    fixLeafletIcon();
  }, []);

  const defaultCenter: [number, number] = [51.505, -0.09]; // Default to London, could be based on user location

  const handleSetPosition = (pos: [number, number]) => {
    setPosition(pos);
    onChange(pos[0], pos[1]);
  };

  return (
    <div className="h-64 w-full rounded-md overflow-hidden border border-gray-300 relative z-0">
      <MapContainer 
        center={position || defaultCenter} 
        zoom={position ? 13 : 2} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={handleSetPosition} />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[1000] bg-white px-2 py-1 text-xs rounded shadow-sm border border-gray-200 pointer-events-none">
        Click map to set location
      </div>
    </div>
  );
}
