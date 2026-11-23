import { CAMPUS_MAPPED_WAYS } from "../constants/campus-walkways";
import type { Coordinate } from "../constants/campus";

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_ROUTE_SNAP_METERS = 35;
const WALKING_SPEED_METERS_PER_MINUTE = 75;
const START_NODE = "__route_start__";
const END_NODE = "__route_end__";

type Edge = { node: string; distance: number };

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

export type WalkingRoute = {
  coordinates: Coordinate[];
  distanceMeters: number;
  startGapMeters: number;
  destinationGapMeters: number;
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

  const addEdge = (from: string, to: string, distance: number) => {
    const edges = graph.get(from) ?? [];
    edges.push({ node: to, distance });
    graph.set(from, edges);
  };

  for (const segment of mappedSegments) {
    addEdge(segment.aKey, segment.bKey, segment.length);
    addEdge(segment.bKey, segment.aKey, segment.length);
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
  const latitudeScale =
    (EARTH_RADIUS_METERS * Math.PI) / 180;
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
    graph.get(node)?.push({ node: target, distance });
    const targetEdges = graph.get(target) ?? [];
    targetEdges.push({ node, distance });
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
      if (nextDistance < (distances.get(edge.node) ?? Number.POSITIVE_INFINITY)) {
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
  maxSnapMeters = MAX_ROUTE_SNAP_METERS,
): WalkingRoute | null {
  const startSnap = nearestMappedSegment(origin);
  const endSnap = nearestMappedSegment(destination);

  if (
    !startSnap ||
    !endSnap ||
    startSnap.gapMeters > maxSnapMeters ||
    endSnap.gapMeters > maxSnapMeters
  ) {
    return null;
  }

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
    const directDistance =
      Math.abs(startSnap.progress - endSnap.progress) *
      startSnap.segment.length;
    graph.get(START_NODE)?.push({ node: END_NODE, distance: directDistance });
    graph.get(END_NODE)?.push({ node: START_NODE, distance: directDistance });
  }

  const routeKeys = shortestPath(graph, START_NODE, END_NODE);
  if (!routeKeys) return null;

  const coordinates = routeKeys.map((key) => {
    if (key === START_NODE) return startSnap.coordinate;
    if (key === END_NODE) return endSnap.coordinate;
    return baseCoordinates.get(key);
  });

  if (coordinates.some((point) => !point)) return null;
  const routeCoordinates = coordinates.filter(
    (point): point is Coordinate => point !== undefined,
  );
  if (routeCoordinates.length < 2) return null;

  const distance = routeCoordinates.reduce((total, point, index) => {
    const next = routeCoordinates[index + 1];
    return next ? total + distanceMeters(point, next) : total;
  }, 0);

  return {
    coordinates: routeCoordinates,
    distanceMeters: distance,
    startGapMeters: startSnap.gapMeters,
    destinationGapMeters: endSnap.gapMeters,
  };
}

export function estimateWalkingMinutes(distance: number): number {
  return Math.max(1, Math.ceil(distance / WALKING_SPEED_METERS_PER_MINUTE));
}

export function formatDistance(distance: number): string {
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}
