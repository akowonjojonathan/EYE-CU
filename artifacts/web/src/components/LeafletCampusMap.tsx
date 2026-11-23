import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed, Minus, Plus } from "lucide-react";
import {
  CAMPUS_CENTER,
  CAMPUS_OUTLINE,
  CATEGORY_COLORS,
  type CampusPlace,
  type Coordinate,
} from "@/constants/campus";

export type TileMapStyle = "street" | "satellite";

export type LeafletCampusMapProps = {
  tileStyle: TileMapStyle;
  places: CampusPlace[];
  selectedPlaceId: string | null;
  savedIds: string[];
  routeStopIds?: string[];
  originCoordinate: Coordinate | null;
  isLiveGps: boolean;
  darkMode: boolean;
  focusKey?: number;
  recenterKey?: number;
  routeCoordinates?: Coordinate[] | null;
  routeType?: "mapped" | "direct";
  pickMode?: boolean;
  adminDragMode?: boolean;
  pickBannerText?: string;
  pickedCoordinate?: Coordinate | null;
  onSelectPlace: (place: CampusPlace) => void;
  onPickCoordinate?: (coordinate: Coordinate) => void;
  onDragPinEnd?: (place: CampusPlace, coordinate: Coordinate) => void;
  onCancelPick?: () => void;
  onRecenter?: () => void;
};

function makeMarkerHtml(
  place: CampusPlace,
  color: string,
  selected: boolean,
  saved: boolean,
  stopNumber?: number,
) {
  const size = selected ? 38 : 30;
  const ring = selected ? `<span class="leaflet-selected-ring"></span>` : "";
  const stopBadge = stopNumber
    ? `<span class="leaflet-stop-badge">${stopNumber}</span>`
    : "";
  const starDot = saved && !selected ? `<span class="leaflet-saved-dot">★</span>` : "";
  const letter = place.category.slice(0, 1);

  return `<div class="leaflet-pin-wrap" style="width:${size}px;height:${size}px;background:${color};${selected ? "border-width:3px;box-shadow:0 0 0 4px rgba(44,168,134,0.28),0 4px 12px rgba(0,0,0,0.35);" : ""}">
    ${ring}
    <span class="leaflet-pin-glyph">${letter}</span>
    ${stopBadge}
    ${starDot}
  </div>`;
}

export function LeafletCampusMap({
  tileStyle,
  places,
  selectedPlaceId,
  routeStopIds = [],
  savedIds,
  originCoordinate,
  isLiveGps,
  darkMode,
  focusKey = 0,
  recenterKey = 0,
  routeCoordinates,
  routeType = "mapped",
  pickMode = false,
  adminDragMode = false,
  pickBannerText,
  pickedCoordinate,
  onSelectPlace,
  onPickCoordinate,
  onDragPinEnd,
  onCancelPick,
  onRecenter,
}: LeafletCampusMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const [leafletZoom, setLeafletZoom] = useState(17);

  const callbacksRef = useRef({
    onSelectPlace,
    onPickCoordinate,
    onDragPinEnd,
  });
  callbacksRef.current = { onSelectPlace, onPickCoordinate, onDragPinEnd };

  const pickModeRef = useRef(pickMode);
  pickModeRef.current = pickMode;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      center: [CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude],
      zoom: 17,
      minZoom: 15,
      maxZoom: 20,
      zoomControl: false,
      attributionControl: true,
    });

    const overlays = L.layerGroup().addTo(map);
    overlayLayerRef.current = overlays;
    mapRef.current = map;

    map.on("zoomend", () => {
      setLeafletZoom(map.getZoom());
    });

    map.on("click", (evt: L.LeafletMouseEvent) => {
      if (pickModeRef.current && callbacksRef.current.onPickCoordinate) {
        callbacksRef.current.onPickCoordinate({
          latitude: Number(evt.latlng.lat.toFixed(6)),
          longitude: Number(evt.latlng.lng.toFixed(6)),
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, []);

  // Switch tile provider when tileStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url =
      tileStyle === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attribution =
      tileStyle === "satellite"
        ? "Tiles © Esri, Maxar, Earthstar Geographics"
        : "© OpenStreetMap contributors";

    const layer = L.tileLayer(url, {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution,
    }).addTo(map);

    tileLayerRef.current = layer;
  }, [tileStyle]);

  // Smooth flyTo when user focuses a place
  useEffect(() => {
    if (focusKey === 0 || !selectedPlaceId || !mapRef.current) return;
    const target = places.find((p) => p.id === selectedPlaceId);
    if (!target) return;
    const nextZoom = Math.max(mapRef.current.getZoom(), 18);
    mapRef.current.flyTo([target.latitude, target.longitude], nextZoom, {
      duration: 0.45,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Recenter campus
  useEffect(() => {
    if (recenterKey === 0 || !mapRef.current) return;
    mapRef.current.flyTo([CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude], 17, {
      duration: 0.45,
    });
  }, [recenterKey]);

  // Render campus boundary, walking route, clusters, markers, user GPS & picked pin
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Campus outline
    L.polygon(
      CAMPUS_OUTLINE.map((c) => [c.latitude, c.longitude] as [number, number]),
      {
        color: darkMode ? "#2CA886" : "#176B56",
        weight: 2,
        opacity: 0.7,
        fillColor: darkMode ? "#152B24" : "#176B56",
        fillOpacity: tileStyle === "satellite" ? 0.08 : 0.09,
        interactive: false,
      },
    ).addTo(group);

    // Route polyline
    if (routeCoordinates && routeCoordinates.length >= 2) {
      const latlngs = routeCoordinates.map(
        (c) => [c.latitude, c.longitude] as [number, number],
      );
      L.polyline(latlngs, {
        color: darkMode ? "rgba(44,168,134,0.35)" : "rgba(23,107,86,0.28)",
        weight: 9,
        lineCap: "round",
      }).addTo(group);

      L.polyline(latlngs, {
        color: darkMode ? "#2CA886" : "#176B56",
        weight: 4,
        dashArray: routeType === "mapped" ? undefined : "7 6",
        lineCap: "round",
      }).addTo(group);
    }

    const stopMap = new Map<string, number>();
    routeStopIds.forEach((id, i) => stopMap.set(id, i + 1));

    // Proximity clustering when zoomed out (< 17.2) unless dragging pins
    const shouldCluster = leafletZoom < 17 && !adminDragMode;
    const singles: CampusPlace[] = [];
    const candidates: CampusPlace[] = [];

    for (const p of places) {
      if (p.id === selectedPlaceId || stopMap.has(p.id) || !shouldCluster) {
        singles.push(p);
      } else {
        candidates.push(p);
      }
    }

    const used = new Set<string>();
    for (let i = 0; i < candidates.length; i += 1) {
      const anchor = candidates[i]!;
      if (used.has(anchor.id)) continue;

      const clusterItems = [anchor];
      used.add(anchor.id);

      for (let j = i + 1; j < candidates.length; j += 1) {
        const other = candidates[j]!;
        if (used.has(other.id)) continue;
        const dLat = anchor.latitude - other.latitude;
        const dLon = anchor.longitude - other.longitude;
        if (Math.hypot(dLat, dLon) < 0.00045) {
          clusterItems.push(other);
          used.add(other.id);
        }
      }

      if (clusterItems.length === 1) {
        singles.push(anchor);
      } else {
        const avgLat =
          clusterItems.reduce((s, x) => s + x.latitude, 0) / clusterItems.length;
        const avgLon =
          clusterItems.reduce((s, x) => s + x.longitude, 0) / clusterItems.length;

        const clusterIcon = L.divIcon({
          className: "leaflet-eyecu-icon",
          html: `<div class="leaflet-cluster-bubble">${clusterItems.length}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const cm = L.marker([avgLat, avgLon], { icon: clusterIcon }).addTo(group);
        cm.on("click", () => {
          map.flyTo([avgLat, avgLon], 18, { duration: 0.4 });
        });
      }
    }

    // Individual markers
    for (const place of singles) {
      const selected = place.id === selectedPlaceId;
      const saved = savedIds.includes(place.id);
      const stopNumber = stopMap.get(place.id);
      const catColor = darkMode
        ? CATEGORY_COLORS[place.category].dark
        : CATEGORY_COLORS[place.category].light;

      const size = selected ? 38 : 30;
      const icon = L.divIcon({
        className: "leaflet-eyecu-icon",
        html: makeMarkerHtml(place, catColor, selected, saved, stopNumber),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon,
        draggable: adminDragMode,
        zIndexOffset: selected ? 500 : 100,
      }).addTo(group);

      marker.bindTooltip(place.name, {
        direction: "top",
        offset: [0, -16],
        permanent: selected,
        className: "leaflet-eyecu-tooltip",
      });

      marker.on("click", () => {
        callbacksRef.current.onSelectPlace(place);
      });

      if (adminDragMode) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          callbacksRef.current.onDragPinEnd?.(place, {
            latitude: Number(pos.lat.toFixed(6)),
            longitude: Number(pos.lng.toFixed(6)),
          });
        });
      }
    }

    // Origin / GPS marker
    if (originCoordinate) {
      const userIcon = L.divIcon({
        className: "leaflet-eyecu-icon",
        html: `<div class="leaflet-user-dot" style="border-color:#fff;background:${isLiveGps ? "#2E6DA4" : "#176B56"}"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      L.marker([originCoordinate.latitude, originCoordinate.longitude], {
        icon: userIcon,
        interactive: false,
        zIndexOffset: 600,
      }).addTo(group);
    }

    // Picked coordinate marker
    if (pickedCoordinate) {
      const pickedIcon = L.divIcon({
        className: "leaflet-eyecu-icon",
        html: `<div class="leaflet-picked-dot">★</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([pickedCoordinate.latitude, pickedCoordinate.longitude], {
        icon: pickedIcon,
        interactive: false,
        zIndexOffset: 700,
      }).addTo(group);
    }
  }, [
    adminDragMode,
    darkMode,
    isLiveGps,
    leafletZoom,
    originCoordinate,
    pickedCoordinate,
    places,
    routeCoordinates,
    routeStopIds,
    routeType,
    savedIds,
    selectedPlaceId,
    tileStyle,
  ]);

  return (
    <div
      className={`campus-map-container leaflet-map-shell${pickMode ? " pick-mode" : ""}${darkMode && tileStyle === "street" ? " leaflet-dark-tiles" : ""}`}
    >
      <div ref={hostRef} style={{ width: "100%", height: "100%" }} />

      {pickMode ? (
        <div className="pick-banner" role="status">
          <span>
            {pickBannerText ||
              "Click anywhere on the map to set coordinates"}
          </span>
          {onCancelPick ? (
            <button
              type="button"
              onClick={onCancelPick}
              className="pick-cancel-btn"
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="map-zoom-controls" aria-label="Map zoom controls">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          className="zoom-btn"
          title="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
          className="zoom-btn"
          title="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          aria-label="Recenter campus view"
          onClick={() => {
            mapRef.current?.flyTo(
              [CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude],
              17,
              { duration: 0.45 },
            );
            onRecenter?.();
          }}
          className="zoom-btn"
          title="Recenter campus"
          data-testid="recenter-campus"
        >
          <LocateFixed size={15} />
        </button>
      </div>
    </div>
  );
}
