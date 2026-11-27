import { CAMPUS_MAPPED_WAYS } from "../constants/campus-walkways";
import type { Coordinate } from "../constants/campus";

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_ROUTE_SNAP_METERS = 150;
const WALKING_SPEED_METERS_PER_MINUTE = 75;
const START_NODE = "__route_start__";
const END_NODE = "__route_end__";

const WELL_LIT_WAY_IDS = new Set([
  "202252644",
  "205113332",
  "955602268",
  "955602271",
  "955606644",
  "1171054668",
  "1171054670",
]);

export const WELL_LIT_CORRIDOR_POLYLINES: Coordinate[][] = CAMPUS_MAPPED_WAYS.filter(
  (way) => WELL_LIT_WAY_IDS.has(way.id),
).map((way) => way.coordinates);

type Edge = {
  node: string;
  distance: number;
};

type Segment = {
  a: Coordinate;
  b: Coordinate;
  aKey: string;
  bKey: string;
  length: number;
};

type Snap = {
  coordinate: Coordinate;
  segment: Segment;
  progress: number;
  gapMeters: number;
};

export type WalkingStep = {
  instruction: string;
  distanceMeters: number;
  direction: string;
};

export type WalkingRoute = {
  coordinates: Coordinate[];
  distanceMeters: number;
  startGapMeters: number;
  destinationGapMeters: number;
  routeType: "mapped" | "direct";
  steps: WalkingStep[];
};

function coordinateKey(point: Coordinate): string {
  return `${point.latitude.toFixed(7)},${point.longitude.toFixed(7)}`;
}

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const latitudeDelta = ((b.latitude - a.latitude) * Math.PI) / 180;
  const longitudeDelta = ((b.longitude - a.longitude) * Math.PI) / 180;
  const latitudeA = (a.latitude * Math.PI) / 180;
  const latitudeB = (b.latitude * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function compassDirection(from: Coordinate, to: Coordinate): string {
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const dirs = [
    "North",
    "North-East",
    "East",
    "South-East",
    "South",
    "South-West",
    "West",
    "North-West",
  ];
  return dirs[Math.round(bearing / 45) % 8] ?? "North";
}

export function bearingDegrees(from: Coordinate, to: Coordinate): number {
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function buildSteps(
  points: Coordinate[],
  destinationName?: string,
): WalkingStep[] {
  if (points.length < 2) return [];
  const legs: Array<{ start: Coordinate; end: Coordinate; dist: number; bearing: number }> = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (!start || !end) continue;
    const dist = distanceMeters(start, end);
    if (dist < 1) continue;
    const bearing = bearingDegrees(start, end);

    const prev = legs[legs.length - 1];
    if (prev) {
      let diff = Math.abs(bearing - prev.bearing);
      if (diff > 180) diff = 360 - diff;
      if (diff < 28) {
        prev.end = end;
        prev.dist += dist;
        prev.bearing = bearingDegrees(prev.start, end);
        continue;
      }
    }
    legs.push({ start, end, dist, bearing });
  }

  const steps: WalkingStep[] = [];
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    if (!leg) continue;
    const dir = compassDirection(leg.start, leg.end);
    if (i === 0) {
      steps.push({
        instruction: `Head ${dir} along campus walkway`,
        distanceMeters: leg.dist,
        direction: dir,
      });
    } else {
      const prev = legs[i - 1]!;
      let delta = leg.bearing - prev.bearing;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const turn =
        delta > 35
          ? "Turn right"
          : delta < -35
            ? "Turn left"
            : "Continue slightly";
      steps.push({
        instruction: `${turn} (${dir})`,
        distanceMeters: leg.dist,
        direction: dir,
      });
    }
  }

  if (destinationName) {
    steps.push({
      instruction: `Arrive at ${destinationName}`,
      distanceMeters: 0,
      direction: "Arrived",
    });
  }

  return steps;
}

const mappedSegments: Segment[] = CAMPUS_MAPPED_WAYS.flatMap((way) => {
  const segments: Segment[] = [];

  for (let index = 0; index < way.coordinates.length - 1; index += 1) {
    const a = way.coordinates[index];
    const b = way.coordinates[index + 1];
    if (!a || !b) continue;

    const length = distanceMeters(a, b);
    if (length < 0.2) continue;

    segments.push({
      a,
      b,
      aKey: coordinateKey(a),
      bKey: coordinateKey(b),
      length,
    });
  }

  return segments;
});

function buildGraph(): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();

  const addEdge = (from: string, to: string, segment: Segment) => {
    const edges = graph.get(from) ?? [];
    edges.push({
      node: to,
      distance: segment.length,
    });
    graph.set(from, edges);
  };

  for (const segment of mappedSegments) {
    addEdge(segment.aKey, segment.bKey, segment);
    addEdge(segment.bKey, segment.aKey, segment);
  }

  return graph;
}

const baseGraph = buildGraph();
const baseCoordinates = new Map<string, Coordinate>();
for (const way of CAMPUS_MAPPED_WAYS) {
  for (const point of way.coordinates) {
    baseCoordinates.set(coordinateKey(point), point);
  }
}

function projectToSegment(point: Coordinate, segment: Segment): Snap {
  const latitudeScale = (EARTH_RADIUS_METERS * Math.PI) / 180;
  const longitudeScale =
    latitudeScale * Math.cos((point.latitude * Math.PI) / 180);
  const toLocal = (coordinate: Coordinate) => ({
    x: (coordinate.longitude - point.longitude) * longitudeScale,
    y: (coordinate.latitude - point.latitude) * latitudeScale,
  });

  const a = toLocal(segment.a);
  const b = toLocal(segment.b);
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const rawProgress =
    lengthSquared === 0
      ? 0
      : (-(a.x * (b.x - a.x) + a.y * (b.y - a.y))) / lengthSquared;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const projected = {
    latitude:
      segment.a.latitude +
      (segment.b.latitude - segment.a.latitude) * progress,
    longitude:
      segment.a.longitude +
      (segment.b.longitude - segment.a.longitude) * progress,
  };

  return {
    coordinate: projected,
    segment,
    progress,
    gapMeters: distanceMeters(point, projected),
  };
}

function nearestMappedSegment(point: Coordinate): Snap | null {
  let nearest: Snap | null = null;

  for (const segment of mappedSegments) {
    const projected = projectToSegment(point, segment);
    if (!nearest || projected.gapMeters < nearest.gapMeters) {
      nearest = projected;
    }
  }

  return nearest;
}

export function distanceToMappedPath(point: Coordinate): number | null {
  return nearestMappedSegment(point)?.gapMeters ?? null;
}

function addSnapEdges(graph: Map<string, Edge[]>, node: string, snap: Snap) {
  const firstDistance = snap.segment.length * snap.progress;
  const secondDistance = snap.segment.length * (1 - snap.progress);

  graph.set(node, []);

  const addBidirectionalEdge = (target: string, distance: number) => {
    graph.get(node)?.push({
      node: target,
      distance,
    });
    const targetEdges = graph.get(target) ?? [];
    targetEdges.push({
      node,
      distance,
    });
    graph.set(target, targetEdges);
  };

  addBidirectionalEdge(snap.segment.aKey, firstDistance);
  addBidirectionalEdge(snap.segment.bKey, secondDistance);
}

function shortestPath(
  graph: Map<string, Edge[]>,
  start: string,
  finish: string,
): string[] | null {
  const distances = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  const unvisited = new Set(graph.keys());

  while (unvisited.size > 0) {
    let current: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const node of unvisited) {
      const candidate = distances.get(node) ?? Number.POSITIVE_INFINITY;
      if (candidate < currentDistance) {
        current = node;
        currentDistance = candidate;
      }
    }

    if (current === null || !Number.isFinite(currentDistance)) return null;
    if (current === finish) {
      const route = [finish];
      let step = finish;
      while (step !== start) {
        const parent = previous.get(step);
        if (!parent) return null;
        route.push(parent);
        step = parent;
      }
      return route.reverse();
    }

    unvisited.delete(current);
    for (const edge of graph.get(current) ?? []) {
      if (!unvisited.has(edge.node)) continue;

      const nextDistance = currentDistance + edge.distance;
      if (
        nextDistance < (distances.get(edge.node) ?? Number.POSITIVE_INFINITY)
      ) {
        distances.set(edge.node, nextDistance);
        previous.set(edge.node, current);
      }
    }
  }

  return null;
}

export function findWalkingRoute(
  origin: Coordinate,
  destination: Coordinate,
  destinationName?: string,
  maxSnapMeters = MAX_ROUTE_SNAP_METERS,
): WalkingRoute {
  const directDistance = distanceMeters(origin, destination);
  const startSnap = nearestMappedSegment(origin);
  const endSnap = nearestMappedSegment(destination);

  if (
    startSnap &&
    endSnap &&
    startSnap.gapMeters <= maxSnapMeters &&
    endSnap.gapMeters <= maxSnapMeters
  ) {
    const graph = new Map(
      Array.from(baseGraph, ([node, edges]) => [
        node,
        edges.map((edge) => ({ ...edge })),
      ]),
    );
    addSnapEdges(graph, START_NODE, startSnap);
    addSnapEdges(graph, END_NODE, endSnap);

    const sameSegment =
      startSnap.segment.aKey === endSnap.segment.aKey &&
      startSnap.segment.bKey === endSnap.segment.bKey;
    if (sameSegment) {
      const directSegmentDistance =
        Math.abs(startSnap.progress - endSnap.progress) *
        startSnap.segment.length;
      graph.get(START_NODE)?.push({
        node: END_NODE,
        distance: directSegmentDistance,
      });
      graph.get(END_NODE)?.push({
        node: START_NODE,
        distance: directSegmentDistance,
      });
    }

    const routeKeys = shortestPath(graph, START_NODE, END_NODE);
    if (routeKeys) {
      const snappedPoints = routeKeys
        .map((key) => {
          if (key === START_NODE) return startSnap.coordinate;
          if (key === END_NODE) return endSnap.coordinate;
          return baseCoordinates.get(key);
        })
        .filter((point): point is Coordinate => point !== undefined);

      if (snappedPoints.length >= 2) {
        const fullCoordinates: Coordinate[] = [
          origin,
          ...snappedPoints,
          destination,
        ];
        const totalDistance = fullCoordinates.reduce((total, point, index) => {
          const next = fullCoordinates[index + 1];
          return next ? total + distanceMeters(point, next) : total;
        }, 0);

        return {
          coordinates: fullCoordinates,
          distanceMeters: totalDistance,
          startGapMeters: startSnap.gapMeters,
          destinationGapMeters: endSnap.gapMeters,
          routeType: "mapped",
          steps: buildSteps(fullCoordinates, destinationName),
        };
      }
    }
  }

  const directCoords = [origin, destination];
  return {
    coordinates: directCoords,
    distanceMeters: directDistance,
    startGapMeters: startSnap?.gapMeters ?? directDistance,
    destinationGapMeters: endSnap?.gapMeters ?? directDistance,
    routeType: "direct",
    steps: buildSteps(directCoords, destinationName),
  };
}

export function estimateWalkingMinutes(distance: number): number {
  return Math.max(1, Math.ceil(distance / WALKING_SPEED_METERS_PER_MINUTE));
}

export function formatDistance(distance: number): string {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export type MultiStopLeg = {
  stopIndex: number;
  stopName: string;
  route: WalkingRoute;
};

export type MultiStopRoute = {
  coordinates: Coordinate[];
  distanceMeters: number;
  routeType: "mapped" | "direct";
  legs: MultiStopLeg[];
  steps: WalkingStep[];
};

export function buildMultiStopRoute(
  origin: Coordinate,
  stops: Array<{ name: string; latitude: number; longitude: number }>,
): MultiStopRoute | null {
  if (stops.length === 0) return null;

  let cursor = origin;
  const allCoords: Coordinate[] = [];
  const legs: MultiStopLeg[] = [];
  const allSteps: WalkingStep[] = [];
  let totalDist = 0;
  let routeType: "mapped" | "direct" = "mapped";

  stops.forEach((stop, index) => {
    const legRoute = findWalkingRoute(
      cursor,
      stop,
      stop.name,
      MAX_ROUTE_SNAP_METERS,
    );
    if (legRoute.routeType === "direct") {
      routeType = "direct";
    }
    if (index === 0) {
      allCoords.push(...legRoute.coordinates);
    } else {
      allCoords.push(...legRoute.coordinates.slice(1));
    }
    totalDist += legRoute.distanceMeters;
    legs.push({
      stopIndex: index + 1,
      stopName: stop.name,
      route: legRoute,
    });
    for (const step of legRoute.steps) {
      allSteps.push({
        ...step,
        instruction:
          stops.length > 1
            ? `[Stop ${index + 1}] ${step.instruction}`
            : step.instruction,
      });
    }
    cursor = stop;
  });

  return {
    coordinates: allCoords,
    distanceMeters: totalDist,
    routeType,
    legs,
    steps: allSteps,
  };
}

