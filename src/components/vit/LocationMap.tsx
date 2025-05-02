import { useMemo } from 'react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

interface LocationMapProps {
  coordinates: string;
  assetName?: string;
}

export function LocationMap({ coordinates, assetName }: LocationMapProps) {
  // Parse coordinates string (format: "latitude, longitude")
  const [lat, lng] = coordinates.split(',').map(coord => parseFloat(coord.trim()));

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return <div className="text-muted-foreground">Invalid coordinates</div>;
  }

  return (
    <div className="relative h-[300px] w-full rounded-md overflow-hidden border border-border">
      <div className="absolute top-2 left-2 right-2 z-10 bg-background/60 backdrop-blur-sm p-2 text-xs text-foreground rounded-md flex justify-between items-center">
        <div>
          <span className="font-medium">Lat:</span> {lat.toFixed(6)}
          <span className="mx-2">|</span>
          <span className="font-medium">Long:</span> {lng.toFixed(6)}
        </div>
      </div>
      <iframe
        title={assetName || 'VIT Asset Location'}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyD0wtdbrHjW9GIOstkj8GIBnwXI5BKYetM&q=${lat},${lng}&zoom=15`}
      />
    </div>
  );
} 