"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Polyline, Circle } from "react-leaflet";
import L from "leaflet";

let userIcon: any;
let disasterIcon: any;
let shelterIcon: any;
let requestIcon: any;

if (typeof window !== "undefined") {
  const createMarkup = (color: string) => `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="${color}">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;

  userIcon = L.divIcon({
    html: createMarkup("#3b82f6"),
    className: "custom-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  disasterIcon = L.divIcon({
    html: createMarkup("#ef4444"),
    className: "custom-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  shelterIcon = L.divIcon({
    html: createMarkup("#10b981"),
    className: "custom-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  requestIcon = L.divIcon({
    html: createMarkup("#f59e0b"),
    className: "custom-pin",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
}

type Point = { id: string; title?: string; name?: string; latitude: number; longitude: number; severity?: string; status?: string };

const nitJalandhar: [number, number] = [31.3959, 75.5350];

export function OperationsMap({ disasters, shelters, requests }: { disasters: Point[]; shelters: Point[]; requests: Point[] }) {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [routePositions, setRoutePositions] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number; targetName: string } | null>(null);
  const [routeWarning, setRouteWarning] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setCurrentLocation([position.coords.latitude, position.coords.longitude]),
      () => setCurrentLocation(null),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  }, []);

  const center: [number, number] = currentLocation ?? nitJalandhar;

  async function getEvacuationRoute(destLat: number, destLon: number, destName: string) {
    setLoadingRoute(true);
    setRouteWarning(null);
    setRoutePositions(null);
    setRouteInfo(null);

    const startLat = center[0];
    const startLon = center[1];

    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson`);
      if (!res.ok) throw new Error("Failed to fetch route");

      const data = await res.json();
      if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
        throw new Error("No route found");
      }

      const route = data.routes[0];
      const coords = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);

      // Check proximity to active disasters
      const activeDisasters = disasters.filter((d) => d.status === "ACTIVE");
      let nearDisaster = false;
      let dangerZoneName = "";

      for (const coord of coords) {
        for (const d of activeDisasters) {
          const dist = L.latLng(coord[0], coord[1]).distanceTo(L.latLng(d.latitude, d.longitude));
          if (dist < 600) { // 600 meters safety buffer
            nearDisaster = true;
            dangerZoneName = d.title || "Active Disaster Zone";
            break;
          }
        }
        if (nearDisaster) break;
      }

      if (nearDisaster) {
        setRouteWarning(`Route passes close to active hazard: "${dangerZoneName}"! Exercise caution.`);
      }

      setRoutePositions(coords);
      setRouteInfo({
        distance: route.distance, // meters
        duration: route.duration, // seconds
        targetName: destName
      });
    } catch (err) {
      console.error(err);
      alert("Could not calculate evacuation route. Please try again.");
    } finally {
      setLoadingRoute(false);
    }
  }

  function clearRoute() {
    setRoutePositions(null);
    setRouteInfo(null);
    setRouteWarning(null);
  }

  return (
    <div className="relative w-full">
      {/* Map */}
      <MapContainer center={center} zoom={11} scrollWheelZoom className="z-0">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* User Marker */}
        <Marker position={center} icon={userIcon}>
          <Popup><strong>{currentLocation ? "Your current location" : "NIT Jalandhar, Punjab"}</strong></Popup>
        </Marker>
 
        {/* Disaster Heatmap overlays (only for active/non-resolved disasters) */}
        {showHeatmap && disasters
          .filter((d) => d.status !== "RESOLVED")
          .map((d) => {
            const lat = d.latitude;
            const lng = d.longitude;
            const severity = d.severity || "MEDIUM";

            let rings: { radius: number; color: string; fillOpacity: number }[] = [];
            if (severity === "CRITICAL") {
              rings = [
                { radius: 1500, color: "#ef4444", fillOpacity: 0.65 },
                { radius: 4000, color: "#ef4444", fillOpacity: 0.40 },
                { radius: 8000, color: "#f97316", fillOpacity: 0.20 }
              ];
            } else if (severity === "HIGH") {
              rings = [
                { radius: 1000, color: "#f97316", fillOpacity: 0.60 },
                { radius: 3000, color: "#f97316", fillOpacity: 0.35 },
                { radius: 6000, color: "#eab308", fillOpacity: 0.15 }
              ];
            } else if (severity === "MEDIUM") {
              rings = [
                { radius: 800, color: "#eab308", fillOpacity: 0.55 },
                { radius: 3000, color: "#eab308", fillOpacity: 0.22 }
              ];
            } else { // LOW
              rings = [
                { radius: 1000, color: "#3b82f6", fillOpacity: 0.45 }
              ];
            }

            return rings.map((ring, idx) => (
              <Circle
                key={`d-heat-${d.id}-${idx}`}
                center={[lat, lng]}
                radius={ring.radius}
                pathOptions={{
                  color: ring.color,
                  fillColor: ring.color,
                  fillOpacity: ring.fillOpacity,
                  stroke: false
                }}
              />
            ));
          })}

        {/* Disaster Markers */}
        {disasters.map((d) => (
          <Marker key={`d-${d.id}`} position={[d.latitude, d.longitude]} icon={disasterIcon}>
            <Popup><strong>{d.title}</strong><br />{d.severity} · {d.status}</Popup>
          </Marker>
        ))}
 
        {/* Shelter Markers */}
        {shelters.map((s) => (
          <Marker key={`s-${s.id}`} position={[s.latitude, s.longitude]} icon={shelterIcon}>
            <Popup>
              <div className="space-y-2">
                <div>
                  <strong>{s.name}</strong>
                  <div className="text-xs text-foreground/75 mt-0.5">Shelter</div>
                </div>
                <button
                  onClick={() => getEvacuationRoute(s.latitude, s.longitude, s.name ?? "Shelter")}
                  disabled={loadingRoute}
                  className="w-full rounded bg-primary px-2 py-1 text-center text-xs font-semibold text-white transition hover:bg-primary/95 disabled:opacity-50"
                >
                  {loadingRoute ? "Calculating..." : "Get Evacuation Route"}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
 
        {/* Request Markers */}
        {requests.map((r) => (
          <Marker key={`r-${r.id}`} position={[r.latitude, r.longitude]} icon={requestIcon}>
            <Popup><strong>{r.title ?? "Emergency request"}</strong><br />{r.status}</Popup>
          </Marker>
        ))}

        {/* Route Polyline */}
        {routePositions && (
          <Polyline
            positions={routePositions}
            color={routeWarning ? "#ef4444" : "#0f9aa6"}
            weight={6}
            opacity={0.8}
          />
        )}
      </MapContainer>

      {/* Floating Route Information Card */}
      {routeInfo && (
        <div className="absolute top-4 right-4 z-[1000] w-64 rounded-lg border border-border bg-background/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
            <h4 className="font-bold text-xs tracking-wide text-foreground uppercase">Route to: {routeInfo.targetName}</h4>
            <button onClick={clearRoute} className="text-[10px] text-foreground/50 hover:text-foreground font-semibold uppercase tracking-wider">
              Clear
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-foreground/60">Distance:</span>
              <span className="font-semibold text-foreground">{(routeInfo.distance / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground/60">Est. Time:</span>
              <span className="font-semibold text-foreground">{Math.ceil(routeInfo.duration / 60)} mins</span>
            </div>
            {routeWarning ? (
              <div className="mt-2.5 rounded bg-red-500/15 border border-red-500/30 p-2 text-[11px] leading-relaxed text-red-500 font-medium flex flex-col gap-0.5">
                <span className="font-bold uppercase tracking-wider text-[9px]">⚠️ Hazard Alert</span>
                {routeWarning}
              </div>
            ) : (
              <div className="mt-2.5 rounded bg-green-500/15 border border-green-500/30 p-2 text-[11px] leading-relaxed text-green-600 font-medium flex flex-col gap-0.5">
                <span className="font-bold uppercase tracking-wider text-[9px]">✅ Safe Route</span>
                No active disasters detected along the route.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Map Layer & Legend Controls */}
      <div className="absolute bottom-4 right-4 z-[1000] w-48 rounded-lg border border-border bg-background/95 p-3.5 shadow-xl backdrop-blur-md space-y-2 text-xs">
        <div className="flex items-center justify-between border-b border-border pb-1.5 font-bold uppercase tracking-wider text-[10px] text-foreground/80">
          <span>Map Controls</span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer font-semibold text-foreground/80">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => setShowHeatmap(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 accent-primary"
          />
          Show Heatmap
        </label>
        {showHeatmap && (
          <div className="space-y-1 pt-1.5 border-t border-border/60 text-[11px]">
            <span className="text-[9px] font-bold text-foreground/50 uppercase tracking-wider block mb-1">Impact Radius</span>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 opacity-80" />
              <span>Critical (8km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 opacity-80" />
              <span>High (6km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 opacity-80" />
              <span>Medium (3km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 opacity-80" />
              <span>Low (1km)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
