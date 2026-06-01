"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

type Point = { id: string; title?: string; name?: string; latitude: number; longitude: number; severity?: string; status?: string };

const nitJalandhar: [number, number] = [31.3959, 75.5350];

export function OperationsMap({ disasters, shelters, requests }: { disasters: Point[]; shelters: Point[]; requests: Point[] }) {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setCurrentLocation([position.coords.latitude, position.coords.longitude]),
      () => setCurrentLocation(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  }, []);

  const center: [number, number] = currentLocation ?? nitJalandhar;

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom className="z-0">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={center} icon={icon}>
        <Popup><strong>{currentLocation ? "Your current location" : "NIT Jalandhar, Punjab"}</strong></Popup>
      </Marker>
      {disasters.map((d) => (
        <Marker key={`d-${d.id}`} position={[d.latitude, d.longitude]} icon={icon}>
          <Popup><strong>{d.title}</strong><br />{d.severity} · {d.status}</Popup>
        </Marker>
      ))}
      {shelters.map((s) => (
        <Marker key={`s-${s.id}`} position={[s.latitude, s.longitude]} icon={icon}>
          <Popup><strong>{s.name}</strong><br />Shelter</Popup>
        </Marker>
      ))}
      {requests.map((r) => (
        <Marker key={`r-${r.id}`} position={[r.latitude, r.longitude]} icon={icon}>
          <Popup><strong>{r.title ?? "Emergency request"}</strong><br />{r.status}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
