"use client";

import { MapContainer, Marker, TileLayer, useMapEvents, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";

let pinIcon: any;
if (typeof window !== "undefined") {
  pinIcon = L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="#ef4444">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `,
    className: "custom-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
}

function MapClickEvents({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function LocationPickerMap({
  latitude,
  longitude,
  onChange
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const defaultCenter: [number, number] = [31.3959, 75.5350]; // NIT Jalandhar default center
  const center: [number, number] = latitude !== null && longitude !== null ? [latitude, longitude] : defaultCenter;

  return (
    <div className="h-60 w-full overflow-hidden rounded-lg border border-border relative">
      <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickEvents onClick={onChange} />
        {latitude !== null && longitude !== null && (
          <>
            <ChangeView center={[latitude, longitude]} />
            <Marker position={[latitude, longitude]} icon={pinIcon} />
          </>
        )}
      </MapContainer>
      <div className="absolute bottom-2 left-2 z-[1000] bg-background/90 px-2 py-1 rounded text-[10px] font-semibold shadow border border-border pointer-events-none">
        Click map to pick coordinates
      </div>
    </div>
  );
}
