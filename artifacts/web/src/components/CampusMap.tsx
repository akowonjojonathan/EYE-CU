import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Briefcase,
  Coffee,
  Home,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import {
  CAMPUS_OUTLINE,
  CAMPUS_WEB_PATHS,
  CATEGORY_COLORS,
  isNightSafetyPlace,
  type CampusPlace,
  type Coordinate,
  type PlaceCategory,
} from "@/constants/campus";
import { WELL_LIT_CORRIDOR_POLYLINES } from "@/lib/walking-navigation";

const WEB_MAP = {
  width: 390,
  height: 560,
  left: 16,
  top: 46,
  mapWidth: 358,
  mapHeight: 468,
  minLatitude: 5.7652,
  maxLatitude: 5.7725,
  minLongitude: 0.0798,
  maxLongitude: 0.0872,
};

export function projectToWebMap(coordinate: Coordinate) {
  const x =
    WEB_MAP.left +
    ((coordinate.longitude - WEB_MAP.minLongitude) /
      (WEB_MAP.maxLongitude - WEB_MAP.minLongitude)) *
      WEB_MAP.mapWidth;
  const y =
    WEB_MAP.top +
    ((WEB_MAP.maxLatitude - coordinate.latitude) /
      (WEB_MAP.maxLatitude - WEB_MAP.minLatitude)) *
      WEB_MAP.mapHeight;

  return { x, y };
}

function unprojectFromWebMap(x: number, y: number): Coordinate {
  const longitude =
    WEB_MAP.minLongitude +
    ((x - WEB_MAP.left) / WEB_MAP.mapWidth) *
      (WEB_MAP.maxLongitude - WEB_MAP.minLongitude);
  const latitude =
    WEB_MAP.maxLatitude -
    ((y - WEB_MAP.top) / WEB_MAP.mapHeight) *
      (WEB_MAP.maxLatitude - WEB_MAP.minLatitude);
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

function PinIcon({
  category,
  size,
}: {
  category: PlaceCategory;
  size: number;
}) {
  switch (category) {
    case "Food":
      return <Coffee size={size} strokeWidth={2.2} />;
    case "Residence":
      return <Home size={size} strokeWidth={2.2} />;
    case "Sports":
      return <Activity size={size} strokeWidth={2.2} />;
    case "Academic":
      return <BookOpen size={size} strokeWidth={2.2} />;
    case "Services":
      return <Briefcase size={size} strokeWidth={2.2} />;
    default:
      return <MapPin size={size} strokeWidth={2.2} />;
  }
}

type MarkerCluster = {
  id: string;
  x: number;
  y: number;
  places: CampusPlace[];
};

export type CampusMapProps = {
  places: CampusPlace[];
  selectedPlaceId: string | null;
  savedIds: string[];
  routeStopIds?: string[];
  originCoordinate: Coordinate | null;
  isLiveGps: boolean;
  headingDegrees?: number | null;
  isNavigating?: boolean;
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
};

export function CampusMap({
  places,
  selectedPlaceId,
  savedIds,
  routeStopIds = [],
  originCoordinate,
  isLiveGps,
  headingDegrees = null,
  isNavigating = false,
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
}: CampusMapProps) {
  const mapTheme = darkMode
    ? {
        canvas: "#0E1B18",
        grid: "#1F362F",
        park: "#152B24",
        parkStroke: "#2CA886",
        building: "#1F3D34",
        roadEdge: "#0B1412",
        road: "#2D4B42",
        label: "#8DB3A4",
        compassBg: "#152722",
        compassBorder: "#29463D",
        compassFg: "#E7EFEA",
        primary: "#2CA886",
        routeGlow: "rgba(44, 168, 134, 0.28)",
        pinText: "#FFFFFF",
      }
    : {
        canvas: "#E8EFE6",
        grid: "#B9CBB6",
        park: "#D3E5CC",
        parkStroke: "#176B56",
        building: "#B5CEAE",
        roadEdge: "#C8D2C6",
        road: "#FFFFFF",
        label: "#4C6D5D",
        compassBg: "#FFFFFF",
        compassBorder: "#DCE4DA",
        compassFg: "#18342E",
        primary: "#176B56",
        routeGlow: "rgba(23, 107, 86, 0.22)",
        pinText: "#FFFFFF",
      };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingPin, setDraggingPin] = useState<{
    place: CampusPlace;
    coord: Coordinate;
  } | null>(null);

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originPanX: 0,
    originPanY: 0,
  });

  const pinDragRef = useRef<{
    place: CampusPlace | null;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    place: null,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const clientToSvgCoord = (clientX: number, clientY: number): Coordinate | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const localX = (clientX - rect.left - cx - pan.x) / zoom + cx;
    const localY = (clientY - rect.top - cy - pan.y) / zoom + cy;

    const scale = Math.max(rect.width / WEB_MAP.width, rect.height / WEB_MAP.height);
    const renderedW = WEB_MAP.width * scale;
    const renderedH = WEB_MAP.height * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;

    const svgX = (localX - offsetX) / scale;
    const svgY = (localY - offsetY) / scale;
    return unprojectFromWebMap(svgX, svgY);
  };

  const focusOnSvgPoint = (svgX: number, svgY: number, targetZoom = 1.55) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.max(rect.width / WEB_MAP.width, rect.height / WEB_MAP.height);
    const renderedW = WEB_MAP.width * scale;
    const renderedH = WEB_MAP.height * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;

    const px = offsetX + svgX * scale;
    const py = offsetY + svgY * scale;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const nextZoom = Math.max(zoom, targetZoom);
    const maxOffset = Math.max(rect.width, rect.height, 420) * (nextZoom - 1) * 0.65;
    const rawPanX = (cx - px) * nextZoom;
    const rawPanY = (cy - 36 - py) * nextZoom;

    setZoom(nextZoom);
    setPan({
      x: Math.max(-maxOffset, Math.min(maxOffset, rawPanX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, rawPanY)),
    });
  };

  // Auto-focus selected place smoothly when focusKey increments
  useEffect(() => {
    if (focusKey === 0 || !selectedPlaceId) return;
    const target = places.find((p) => p.id === selectedPlaceId);
    if (!target) return;
    const pt = projectToWebMap(target);
    focusOnSvgPoint(pt.x, pt.y, 1.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Recenter campus view when recenterKey increments
  useEffect(() => {
    if (recenterKey === 0) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [recenterKey]);

  const stopOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    routeStopIds.forEach((id, idx) => {
      map.set(id, idx + 1);
    });
    return map;
  }, [routeStopIds]);

  const { singles, clusters } = useMemo(() => {
    // Only cluster when zoomed out and not dragging pins
    if (zoom >= 1.38 || adminDragMode) {
      return { singles: places, clusters: [] as MarkerCluster[] };
    }

    const threshold = 22; // SVG units
    const individual: CampusPlace[] = [];
    const candidates: Array<{ place: CampusPlace; x: number; y: number }> = [];

    for (const p of places) {
      const pt = projectToWebMap(p);
      if (p.id === selectedPlaceId || stopOrderMap.has(p.id)) {
        individual.push(p);
      } else {
        candidates.push({ place: p, x: pt.x, y: pt.y });
      }
    }

    const used = new Set<string>();
    const clusterList: MarkerCluster[] = [];

    for (let i = 0; i < candidates.length; i += 1) {
      const anchor = candidates[i]!;
      if (used.has(anchor.place.id)) continue;

      const group = [anchor];
      used.add(anchor.place.id);

      for (let j = i + 1; j < candidates.length; j += 1) {
        const other = candidates[j]!;
        if (used.has(other.place.id)) continue;
        const dist = Math.hypot(anchor.x - other.x, anchor.y - other.y);
        if (dist <= threshold) {
          group.push(other);
          used.add(other.place.id);
        }
      }

      if (group.length === 1) {
        individual.push(anchor.place);
      } else {
        const avgX = group.reduce((s, item) => s + item.x, 0) / group.length;
        const avgY = group.reduce((s, item) => s + item.y, 0) / group.length;
        clusterList.push({
          id: `cluster-${group.map((g) => g.place.id).join("-")}`,
          x: avgX,
          y: avgY,
          places: group.map((g) => g.place),
        });
      }
    }

    return { singles: individual, clusters: clusterList };
  }, [adminDragMode, places, selectedPlaceId, stopOrderMap, zoom]);

  const boundaryPoints = CAMPUS_OUTLINE.map((coordinate) => {
    const point = projectToWebMap(coordinate);
    return `${point.x},${point.y}`;
  }).join(" ");

  const routePoints =
    routeCoordinates && routeCoordinates.length >= 2
      ? routeCoordinates
          .map((coordinate) => {
            const point = projectToWebMap(coordinate);
            return `${point.x},${point.y}`;
          })
          .join(" ")
      : null;

  const updateZoom = (delta: number) => {
    setZoom((prev) => {
      const next = Math.max(1, Math.min(3.4, Number((prev + delta).toFixed(2))));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onRecenter?.();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originPanX: pan.x,
      originPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinDragRef.current.place) {
      const distMoved = Math.hypot(
        e.clientX - pinDragRef.current.startX,
        e.clientY - pinDragRef.current.startY,
      );
      if (distMoved > 3) {
        pinDragRef.current.moved = true;
      }
      const nextCoord = clientToSvgCoord(e.clientX, e.clientY);
      if (nextCoord) {
        setDraggingPin({ place: pinDragRef.current.place, coord: nextCoord });
      }
      return;
    }

    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    if (zoom > 1) {
      const maxOffset = (zoom - 1) * 220;
      setPan({
        x: Math.max(-maxOffset, Math.min(maxOffset, dragRef.current.originPanX + dx)),
        y: Math.max(-maxOffset, Math.min(maxOffset, dragRef.current.originPanY + dy)),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture errors
    }
    if (pinDragRef.current.place) {
      const targetPlace = pinDragRef.current.place;
      const wasMoved = pinDragRef.current.moved;
      pinDragRef.current = { place: null, startX: 0, startY: 0, moved: false };
      if (wasMoved && onDragPinEnd) {
        const finalCoord = clientToSvgCoord(e.clientX, e.clientY);
        if (finalCoord) {
          onDragPinEnd(targetPlace, finalCoord);
        }
      } else {
        onSelectPlace(targetPlace);
      }
      setDraggingPin(null);
      return;
    }

    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;

    if (!wasMoved && pickMode && onPickCoordinate) {
      if (
        (e.target as HTMLElement).closest(".map-zoom-controls") ||
        (e.target as HTMLElement).closest(".pick-banner")
      ) {
        return;
      }
      const picked = clientToSvgCoord(e.clientX, e.clientY);
      if (picked) onPickCoordinate(picked);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    pinDragRef.current = { place: null, startX: 0, startY: 0, moved: false };
    dragRef.current.active = false;
    setDraggingPin(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 2) return;
    updateZoom(e.deltaY < 0 ? 0.25 : -0.25);
  };

  return (
    <div
      ref={containerRef}
      className={`campus-map-container${pickMode ? " pick-mode" : ""}${adminDragMode ? " drag-pin-mode" : ""}`}
      style={{ backgroundColor: mapTheme.canvas }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
    >
      <div
        className="campus-map-stage"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <svg
          aria-label="Interactive schematic map of Central University Miotso"
          width="100%"
          height="100%"
          viewBox={`0 0 ${WEB_MAP.width} ${WEB_MAP.height}`}
          preserveAspectRatio="xMidYMid slice"
          className="campus-map-svg"
        >
          <defs>
            <pattern
              id="cu-campus-grid"
              width="30"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-8)"
            >
              <path
                d="M0 12H30M15 0V24"
                stroke={mapTheme.grid}
                strokeWidth="0.55"
                opacity="0.38"
              />
            </pattern>
          </defs>

          <rect
            width={WEB_MAP.width}
            height={WEB_MAP.height}
            fill={mapTheme.canvas}
          />
          <rect
            width={WEB_MAP.width}
            height={WEB_MAP.height}
            fill="url(#cu-campus-grid)"
          />
          <polygon
            points={boundaryPoints}
            fill={mapTheme.park}
            stroke={mapTheme.parkStroke}
            strokeWidth={2.2}
          />
          <path
            d="M114 234l20-8 10 14-6 18-19 4-9-12zM236 168l16-10 20 6 5 18-14 10-21-4zM222 356l16-6 14 11-4 15-19 5-10-12z"
            fill={mapTheme.building}
            opacity={0.75}
          />

          {CAMPUS_WEB_PATHS.map((path, index) => {
            const points = path
              .map((coordinate) => {
                const point = projectToWebMap(coordinate);
                return `${point.x},${point.y}`;
              })
              .join(" ");

            return (
              <React.Fragment key={`campus-path-${index}`}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={mapTheme.roadEdge}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke={mapTheme.road}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </React.Fragment>
            );
          })}

          {nightWalkMode
            ? WELL_LIT_CORRIDOR_POLYLINES.map((poly, idx) => {
                const pts = poly
                  .map((c) => {
                    const pt = projectToWebMap(c);
                    return `${pt.x},${pt.y}`;
                  })
                  .join(" ");
                return (
                  <React.Fragment key={`lit-${idx}`}>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="rgba(251, 191, 36, 0.25)"
                      strokeWidth={10}
                      strokeLinecap="round"
                    />
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="#FBBF24"
                      strokeWidth={2.8}
                      strokeLinecap="round"
                    />
                  </React.Fragment>
                );
              })
            : null}

          {originCoordinate && radarRadiusMeters && radarRadiusMeters > 0 ? (() => {
            const center = projectToWebMap(originCoordinate);
            // ~467m height spans WEB_MAP.mapHeight (468px) -> ~1 SVG unit/meter
            const svgRadius = Math.max(18, radarRadiusMeters * 0.88);
            return (
              <circle
                cx={center.x}
                cy={center.y}
                r={svgRadius}
                fill="rgba(14, 165, 233, 0.1)"
                stroke="#0EA5E9"
                strokeWidth={1.6}
                strokeDasharray="5 5"
              />
            );
          })() : null}

          {routePoints ? (() => {
            const coreColor = nightWalkMode
              ? "#10B981"
              : isNavigating
                ? "#0EA5E9"
                : mapTheme.primary;
            const haloColor = nightWalkMode
              ? "rgba(16, 185, 129, 0.34)"
              : mapTheme.routeGlow;

            return (
              <>
                <polyline
                  points={routePoints}
                  fill="none"
                  stroke={haloColor}
                  strokeWidth={11}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={routePoints}
                  fill="none"
                  stroke={coreColor}
                  strokeWidth={4.4}
                  strokeDasharray={routeType === "mapped" ? "none" : "6 5"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={routePoints}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeOpacity={isNavigating ? 0.94 : 0.7}
                  strokeWidth={2}
                  strokeDasharray="5 11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="eyecu-svg-route-flow"
                />
              </>
            );
          })() : null}

          {(() => {
            const northPt = projectToWebMap({ latitude: 5.7711, longitude: 0.0827 });
            const plazaPt = projectToWebMap({ latitude: 5.7691, longitude: 0.0834 });
            const fieldPt = projectToWebMap({ latitude: 5.76985, longitude: 0.08445 });
            return (
              <>
                <text
                  x={northPt.x}
                  y={northPt.y}
                  fill={mapTheme.label}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="6"
                  fontWeight="600"
                  letterSpacing="1"
                >
                  NORTH CAMPUS
                </text>
                <text
                  x={plazaPt.x}
                  y={plazaPt.y}
                  fill={mapTheme.label}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="6"
                  fontWeight="600"
                  letterSpacing="1"
                >
                  CENTRAL PLAZA
                </text>
                <text
                  x={fieldPt.x}
                  y={fieldPt.y}
                  fill={mapTheme.label}
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="5.5"
                  fontWeight="600"
                  letterSpacing="0.9"
                >
                  SPORTS FIELD
                </text>
              </>
            );
          })()}

          <g
            transform={`translate(${WEB_MAP.left + WEB_MAP.mapWidth - 20}, ${WEB_MAP.top + 22})`}
          >
            <circle
              r={11}
              fill={mapTheme.compassBg}
              stroke={mapTheme.compassBorder}
              strokeWidth={1.2}
            />
            <path d="M0 -6 L2.6 2 L0 0.5 L-2.6 2 Z" fill={mapTheme.primary} />
            <text
              x="0"
              y="7.5"
              textAnchor="middle"
              fill={mapTheme.compassFg}
              fontFamily="JetBrains Mono, monospace"
              fontSize="4.5"
              fontWeight="700"
            >
              N
            </text>
          </g>
        </svg>

        {clusters.map((cluster) => (
          <button
            key={cluster.id}
            type="button"
            title={`${cluster.places.length} places nearby — click to expand`}
            aria-label={`Cluster of ${cluster.places.length} campus places`}
            onClick={(e) => {
              e.stopPropagation();
              focusOnSvgPoint(cluster.x, cluster.y, 1.85);
            }}
            className="web-cluster-marker"
            style={{
              left: `${(cluster.x / WEB_MAP.width) * 100}%`,
              top: `${(cluster.y / WEB_MAP.height) * 100}%`,
            }}
          >
            <span className="tabular-nums">{cluster.places.length}</span>
          </button>
        ))}

        {singles.map((place) => {
          const activeCoord =
            draggingPin && draggingPin.place.id === place.id
              ? draggingPin.coord
              : place;
          const point = projectToWebMap(activeCoord);
          const selected = place.id === selectedPlaceId;
          const saved = savedIds.includes(place.id);
          const stopNumber = stopOrderMap.get(place.id);
          const nightSafetyBeacon = nightWalkMode && isNightSafetyPlace(place);
          const catColor = darkMode
            ? CATEGORY_COLORS[place.category].dark
            : CATEGORY_COLORS[place.category].light;

          return (
            <button
              key={place.id}
              type="button"
              aria-label={`Show ${place.name}`}
              title={
                adminDragMode
                  ? `Drag to reposition ${place.name}`
                  : place.name
              }
              onPointerDown={(e) => {
                if (!adminDragMode) return;
                e.stopPropagation();
                try {
                  containerRef.current?.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore if pointer capture is unavailable
                }
                pinDragRef.current = {
                  place,
                  startX: e.clientX,
                  startY: e.clientY,
                  moved: false,
                };
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!adminDragMode) {
                  onSelectPlace(place);
                }
              }}
              className={`web-marker${selected ? " web-marker-selected" : ""}${saved && !selected ? " web-marker-saved" : ""}${nightSafetyBeacon && !selected ? " is-night-beacon" : ""}${adminDragMode ? " web-marker-draggable" : ""}`}
              style={{
                left: `${(point.x / WEB_MAP.width) * 100}%`,
                top: `${(point.y / WEB_MAP.height) * 100}%`,
                backgroundColor: catColor,
                color: mapTheme.pinText,
              }}
              data-testid={`map-marker-${place.id}`}
            >
              {selected ? <span className="web-marker-selected-ring" /> : null}
              {nightSafetyBeacon && !selected ? (
                <span className="leaflet-night-halo" />
              ) : null}
              <PinIcon category={place.category} size={selected ? 17 : 14} />
              {stopNumber ? (
                <span className="marker-stop-badge tabular-nums">
                  {stopNumber}
                </span>
              ) : null}
              {selected ? (
                <span className="marker-label">{place.name}</span>
              ) : null}
            </button>
          );
        })}

        {originCoordinate ? (
          <div
            aria-label={
              isLiveGps ? "Your live GPS location" : "Selected start point"
            }
            className="web-user-marker"
            style={(() => {
              const point = projectToWebMap(originCoordinate);
              return {
                left: `${(point.x / WEB_MAP.width) * 100}%`,
                top: `${(point.y / WEB_MAP.height) * 100}%`,
              };
            })()}
          >
            {isLiveGps ? (
              <>
                <span className="eyecu-user-pulse" />
                <span className="eyecu-user-pulse-outer" />
              </>
            ) : null}
            {typeof headingDegrees === "number" &&
            Number.isFinite(headingDegrees) ? (
              <div
                className={`eyecu-compass-cone is-schematic${nightWalkMode ? " is-night" : ""}`}
                style={{ transform: `rotate(${headingDegrees}deg)` }}
              />
            ) : null}
            <div
              className="web-user-marker-core"
              style={{
                backgroundColor: nightWalkMode
                  ? "#10B981"
                  : isLiveGps
                    ? "#1A73E8"
                    : mapTheme.primary,
              }}
            />
          </div>
        ) : null}

        {pickedCoordinate ? (
          <div
            aria-label="Pin coordinate preview"
            className="web-picked-marker"
            style={(() => {
              const point = projectToWebMap(pickedCoordinate);
              return {
                left: `${(point.x / WEB_MAP.width) * 100}%`,
                top: `${(point.y / WEB_MAP.height) * 100}%`,
              };
            })()}
          >
            <MapPin size={16} />
          </div>
        ) : null}
      </div>

      {pickMode ? (
        <div className="pick-banner" role="status">
          <span>
            {pickBannerText ||
              "Click anywhere on the campus map to set coordinates"}
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
          onClick={() => updateZoom(0.35)}
          className="zoom-btn"
          title="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => updateZoom(-0.35)}
          className="zoom-btn"
          title="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button
          type="button"
          aria-label="Recenter campus view"
          onClick={resetView}
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
