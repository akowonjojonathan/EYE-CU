import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Compass, LocateFixed, Minus, Plus, Route } from "lucide-react";
import {
  CAMPUS_CENTER,
  CAMPUS_OUTLINE,
  CATEGORY_COLORS,
  isNightSafetyPlace,
  type CampusPlace,
  type Coordinate,
  type PlaceCategory,
} from "@/constants/campus";
import { WELL_LIT_CORRIDOR_POLYLINES } from "@/lib/walking-navigation";

export type TileMapStyle = "street" | "satellite";

export type LeafletCampusMapProps = {
  tileStyle: TileMapStyle;
  places: CampusPlace[];
  selectedPlaceId: string | null;
  savedIds: string[];
  routeStopIds?: string[];
  originCoordinate: Coordinate | null;
  isLiveGps: boolean;
  headingDegrees?: number | null;
  isNavigating?: boolean;
  followCamera?: boolean;
  isCardCollapsed?: boolean;
  routeFitKey?: number;
  darkMode: boolean;
  nightWalkMode?: boolean;
  radarRadiusMeters?: number | null;
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
  onUserPanMap?: () => void;
  onFollowCamera?: () => void;
  onFitRoute?: () => void;
};


function categoryGlyphSvg(category: PlaceCategory, size: number): string {
  switch (category) {
    case "Academic":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
    case "Food":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`;
    case "Residence":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    case "Sports":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    case "Services":
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
    default:
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
  }
}

function makeMarkerHtml(
  place: CampusPlace,
  color: string,
  selected: boolean,
  saved: boolean,
  stopNumber?: number,
  nightSafetyBeacon = false,
) {
  const size = selected ? 40 : 32;
  const glyphSize = selected ? 18 : 14;
  const ring = selected ? `<span class="leaflet-selected-ring"></span>` : "";
  const nightHalo =
    nightSafetyBeacon && !selected
      ? `<span class="leaflet-night-halo"></span>`
      : "";
  const stopBadge = stopNumber
    ? `<span class="leaflet-stop-badge">${stopNumber}</span>`
    : "";
  const starDot = saved && !selected ? `<span class="leaflet-saved-dot">★</span>` : "";

  return `<div class="leaflet-pin-wrap${selected ? " eyecu-pin-selected" : ""}${nightSafetyBeacon ? " eyecu-night-beacon" : ""}" style="width:${size}px;height:${size}px;background:${color};${selected ? "border-width:3px;box-shadow:0 0 0 5px rgba(44,168,134,0.3),0 6px 16px rgba(0,0,0,0.4);" : ""}">
    ${ring}
    ${nightHalo}
    <span class="leaflet-pin-glyph">${categoryGlyphSvg(place.category, glyphSize)}</span>
    ${stopBadge}
    ${starDot}
  </div>`;
}

function makeUserConeHtml(
  isLiveGps: boolean,
  headingDegrees: number | null | undefined,
  nightWalkMode = false,
) {
  const coreColor = nightWalkMode
    ? "#10B981"
    : isLiveGps
      ? "#1A73E8"
      : "#176B56";
  const coneHtml =
    typeof headingDegrees === "number" && Number.isFinite(headingDegrees)
      ? `<div class="eyecu-compass-cone${nightWalkMode ? " is-night" : ""}" style="transform: rotate(${headingDegrees}deg);"></div>`
      : "";
  const pulseHtml = isLiveGps
    ? `<div class="eyecu-user-pulse" style="border-color:${coreColor};"></div><div class="eyecu-user-pulse-outer" style="border-color:${coreColor};"></div>`
    : "";

  return `<div class="eyecu-user-marker-wrap">
    ${coneHtml}
    ${pulseHtml}
    <div class="eyecu-user-core" style="background:${coreColor};"></div>
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
  headingDegrees = null,
  isNavigating = false,
  followCamera = false,
  isCardCollapsed = false,
  routeFitKey = 0,
  darkMode,
  nightWalkMode = false,
  radarRadiusMeters = null,
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
  onUserPanMap,
  onFollowCamera,
  onFitRoute,
}: LeafletCampusMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const isDraggingPinRef = useRef(false);
  const [leafletZoom, setLeafletZoom] = useState(17);

  const callbacksRef = useRef({
    onSelectPlace,
    onPickCoordinate,
    onDragPinEnd,
    onUserPanMap,
  });
  callbacksRef.current = {
    onSelectPlace,
    onPickCoordinate,
    onDragPinEnd,
    onUserPanMap,
  };

  const pickModeRef = useRef(pickMode);
  pickModeRef.current = pickMode;

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;

    const map = L.map(hostRef.current, {
      center: [CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude],
      zoom: 17,
      minZoom: 15,
      maxZoom: 20,
      zoomSnap: 0.25,
      zoomControl: false,
      attributionControl: true,
    });

    const overlays = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);
    overlayLayerRef.current = overlays;
    userLayerRef.current = userLayer;
    mapRef.current = map;

    map.on("zoomend", () => {
      setLeafletZoom(map.getZoom());
    });

    map.on("dragstart", () => {
      callbacksRef.current.onUserPanMap?.();
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
      userLayerRef.current = null;
    };
  }, []);

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

  // Smooth eased cinematic flyTo when focusing a place
  useEffect(() => {
    const map = mapRef.current;
    if (focusKey === 0 || !selectedPlaceId || !map || followCamera) {
      return;
    }
    const target = places.find((p) => p.id === selectedPlaceId);
    if (!target) return;
    const nextZoom = Math.max(map.getZoom(), 18.25);
    const point = map.project([target.latitude, target.longitude], nextZoom);
    const shifted = map.unproject(
      L.point(point.x, point.y + (isCardCollapsed ? 42 : 95)),
      nextZoom,
    );
    map.flyTo(shifted, nextZoom, {
      duration: 0.78,
      easeLinearity: 0.22,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Close-up Follow-Me camera locked onto user dot above bottom card
  useEffect(() => {
    const map = mapRef.current;
    if (!followCamera || !originCoordinate || !map) return;

    const targetZoom = Math.max(map.getZoom(), 19);
    const point = map.project(
      [originCoordinate.latitude, originCoordinate.longitude],
      targetZoom,
    );
    const shiftedCenter = map.unproject(
      L.point(point.x, point.y + (isCardCollapsed ? 42 : 95)),
      targetZoom,
    );
    map.setView(shiftedCenter, targetZoom, {
      animate: true,
      duration: 0.48,
    });
  }, [
    followCamera,
    isCardCollapsed,
    originCoordinate?.latitude,
    originCoordinate?.longitude,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      routeFitKey === 0 ||
      !routeCoordinates ||
      routeCoordinates.length < 2 ||
      !map
    ) {
      return;
    }
    const bounds = L.latLngBounds(
      routeCoordinates.map((c) => [c.latitude, c.longitude] as [number, number]),
    );
    map.fitBounds(bounds, {
      paddingTopLeft: [44, 88],
      paddingBottomRight: [44, isCardCollapsed ? 155 : 290],
      maxZoom: 19,
      animate: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFitKey]);

  useEffect(() => {
    if (recenterKey === 0 || !mapRef.current) return;
    mapRef.current.flyTo([CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude], 17, {
      duration: 0.72,
      easeLinearity: 0.25,
    });
  }, [recenterKey]);

  // Render campus boundary, night-walk corridors, animated neon route, clusters, markers
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayLayerRef.current;
    if (!map || !group || isDraggingPinRef.current) return;

    group.clearLayers();

    // Campus outline
    L.polygon(
      CAMPUS_OUTLINE.map((c) => [c.latitude, c.longitude] as [number, number]),
      {
        color: nightWalkMode ? "#10B981" : darkMode ? "#2CA886" : "#176B56",
        weight: 2,
        opacity: 0.65,
        fillColor: nightWalkMode ? "#064E3B" : darkMode ? "#152B24" : "#176B56",
        fillOpacity: tileStyle === "satellite" ? 0.06 : 0.09,
        interactive: false,
      },
    ).addTo(group);

    // Night-Walk illuminated main walkways
    if (nightWalkMode) {
      for (const poly of WELL_LIT_CORRIDOR_POLYLINES) {
        const latlngs = poly.map((c) => [c.latitude, c.longitude] as [number, number]);
        L.polyline(latlngs, {
          color: "rgba(251, 191, 36, 0.28)",
          weight: 12,
          lineCap: "round",
          interactive: false,
        }).addTo(group);
        L.polyline(latlngs, {
          color: "#FBBF24",
          weight: 3.5,
          opacity: 0.85,
          lineCap: "round",
          interactive: false,
        }).addTo(group);
      }
    }

    // Animated Neon Path Beams
    if (routeCoordinates && routeCoordinates.length >= 2) {
      const latlngs = routeCoordinates.map(
        (c) => [c.latitude, c.longitude] as [number, number],
      );

      const coreRouteColor = nightWalkMode
        ? "#10B981"
        : isNavigating
          ? "#0EA5E9"
          : darkMode
            ? "#2CA886"
            : "#176B56";

      const neonOuterHalo = nightWalkMode
        ? "rgba(16, 185, 129, 0.32)"
        : "rgba(14, 165, 233, 0.32)";

      // Outer neon glow
      L.polyline(latlngs, {
        color: neonOuterHalo,
        weight: 16,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(group);

      // High-contrast casing
      L.polyline(latlngs, {
        color:
          tileStyle === "satellite" || nightWalkMode || darkMode
            ? "rgba(8, 25, 48, 0.88)"
            : "rgba(255, 255, 255, 0.94)",
        weight: 10,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(group);

      // Core walking beam
      L.polyline(latlngs, {
        color: coreRouteColor,
        weight: 5.8,
        dashArray: routeType === "mapped" ? undefined : "9 7",
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(group);

      // Animated traveling light pulses along path
      L.polyline(latlngs, {
        color: "#FFFFFF",
        weight: 2.8,
        opacity: isNavigating ? 0.96 : 0.72,
        dashArray: "6 16",
        lineCap: "round",
        className: "eyecu-route-flow",
        interactive: false,
      }).addTo(group);
    }

    const stopMap = new Map<string, number>();
    routeStopIds.forEach((id, i) => stopMap.set(id, i + 1));

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
          map.flyTo([avgLat, avgLon], 18, { duration: 0.55 });
        });
      }
    }

    // Individual custom SVG beacon markers
    for (const place of singles) {
      const selected = place.id === selectedPlaceId;
      const saved = savedIds.includes(place.id);
      const stopNumber = stopMap.get(place.id);
      const catColor = darkMode
        ? CATEGORY_COLORS[place.category].dark
        : CATEGORY_COLORS[place.category].light;
      const nightSafetyBeacon = nightWalkMode && isNightSafetyPlace(place);

      const size = selected ? 40 : 32;
      const icon = L.divIcon({
        className: "leaflet-eyecu-icon",
        html: makeMarkerHtml(
          place,
          catColor,
          selected,
          saved,
          stopNumber,
          nightSafetyBeacon,
        ),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon,
        draggable: adminDragMode,
        zIndexOffset: selected ? 500 : nightSafetyBeacon ? 250 : 100,
      }).addTo(group);

      marker.bindTooltip(place.name, {
        direction: "top",
        offset: [0, -18],
        permanent: selected,
        className: "leaflet-eyecu-tooltip",
      });

      marker.on("click", () => {
        callbacksRef.current.onSelectPlace(place);
      });

      if (adminDragMode) {
        marker.on("dragstart", () => {
          isDraggingPinRef.current = true;
        });
        marker.on("dragend", () => {
          isDraggingPinRef.current = false;
          const pos = marker.getLatLng();
          callbacksRef.current.onDragPinEnd?.(place, {
            latitude: Number(pos.lat.toFixed(6)),
            longitude: Number(pos.lng.toFixed(6)),
          });
        });
      }
    }

    // Picked coordinate preview marker
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
    isNavigating,
    leafletZoom,
    nightWalkMode,
    pickedCoordinate,
    places,
    routeCoordinates,
    routeStopIds,
    routeType,
    savedIds,
    selectedPlaceId,
    tileStyle,
  ]);

  // Separate layer for live user GPS puck, compass cone & proximity radar
  useEffect(() => {
    const userLayer = userLayerRef.current;
    if (!userLayer) return;

    userLayer.clearLayers();

    if (originCoordinate && radarRadiusMeters && radarRadiusMeters > 0) {
      L.circle([originCoordinate.latitude, originCoordinate.longitude], {
        radius: radarRadiusMeters,
        color: "#0EA5E9",
        weight: 1.8,
        dashArray: "6 6",
        fillColor: "#0EA5E9",
        fillOpacity: 0.09,
        interactive: false,
      }).addTo(userLayer);
    }

    if (originCoordinate) {
      const userIcon = L.divIcon({
        className: "leaflet-eyecu-icon",
        html: makeUserConeHtml(isLiveGps, headingDegrees, nightWalkMode),
        iconSize: [88, 88],
        iconAnchor: [44, 44],
      });
      L.marker([originCoordinate.latitude, originCoordinate.longitude], {
        icon: userIcon,
        interactive: false,
        zIndexOffset: 650,
      }).addTo(userLayer);
    }
  }, [
    headingDegrees,
    isLiveGps,
    nightWalkMode,
    originCoordinate,
    radarRadiusMeters,
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
        {isNavigating && onFollowCamera ? (
          <button
            type="button"
            aria-label="Follow my location close-up"
            onClick={onFollowCamera}
            className={`zoom-btn${followCamera ? " is-active" : ""}`}
            title="Close-up Follow Me (19x)"
            data-testid="follow-me-camera"
          >
            <Compass size={16} />
          </button>
        ) : null}
        {isNavigating && onFitRoute ? (
          <button
            type="button"
            aria-label="Frame full walking route"
            onClick={onFitRoute}
            className="zoom-btn"
            title="Show full pathway"
            data-testid="fit-route-camera"
          >
            <Route size={16} />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Recenter campus view"
          onClick={() => {
            onUserPanMap?.();
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

