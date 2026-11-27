import { DEFAULT_CATEGORY_IMAGES, type CampusPlace } from "@/constants/campus";

export const TILE_CACHE_NAME = "campus-map-tiles";
export const LOCAL_ASSET_CACHE_NAME = "campus-local-assets";
export const OFFLINE_META_STORAGE_KEY = "eyecu_offline_pack_meta_v1";

export type OfflinePackSummary = {
  placesCachedCount: number;
  cachedTilesCount: number;
  cachedAssetsCount: number;
  serviceWorkerActive: boolean;
  lastSavedAt: string | null;
};

type OfflineStoredMeta = {
  lastSavedAt?: string;
  placesCount?: number;
};

// Covers Central University Miotso campus + hostels + clinic
const MIOTSO_BOUNDS = {
  minLat: 5.7645,
  maxLat: 5.7745,
  minLon: 0.079,
  maxLon: 0.0885,
};

function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, zoom),
  );
}

function buildCampusTileUrls(): string[] {
  const urls: string[] = [];
  for (const zoom of [16, 17, 18]) {
    const xMin = lonToTileX(MIOTSO_BOUNDS.minLon, zoom);
    const xMax = lonToTileX(MIOTSO_BOUNDS.maxLon, zoom);
    const yMin = latToTileY(MIOTSO_BOUNDS.maxLat, zoom);
    const yMax = latToTileY(MIOTSO_BOUNDS.minLat, zoom);

    for (let x = xMin; x <= xMax; x += 1) {
      for (let y = yMin; y <= yMax; y += 1) {
        urls.push(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
        urls.push(
          `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`,
        );
      }
    }
  }
  return urls;
}

function buildLocalAssetUrls(places: CampusPlace[]): string[] {
  const set = new Set<string>([
    "/",
    "/manifest.webmanifest",
    "/icon.svg",
    "/pwa-192x192.png",
    "/pwa-512x512.png",
    ...Object.values(DEFAULT_CATEGORY_IMAGES),
  ]);

  for (const p of places) {
    if (p.imageUrl && p.imageUrl.startsWith("/")) {
      set.add(p.imageUrl);
    }
  }
  return Array.from(set);
}

export async function getOfflinePackSummary(
  placesCountFallback: number,
  placesCacheKey = "eyecu_places_cache_v1",
): Promise<OfflinePackSummary> {
  let cachedTilesCount = 0;
  let cachedAssetsCount = 0;

  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const tileCache = await caches.open(TILE_CACHE_NAME);
      const tileKeys = await tileCache.keys();
      cachedTilesCount = tileKeys.length;
    } catch {
      // Ignore cache read error
    }
    try {
      const assetCache = await caches.open(LOCAL_ASSET_CACHE_NAME);
      const assetKeys = await assetCache.keys();
      cachedAssetsCount = assetKeys.length;
    } catch {
      // Ignore
    }
  }

  let savedPlacesCount = placesCountFallback;
  let lastSavedAt: string | null = null;
  try {
    const rawPlaces = globalThis.localStorage?.getItem(placesCacheKey);
    if (rawPlaces) {
      const parsed = JSON.parse(rawPlaces);
      if (Array.isArray(parsed) && parsed.length > 0) {
        savedPlacesCount = Math.max(savedPlacesCount, parsed.length);
      }
    }
    const rawMeta = globalThis.localStorage?.getItem(OFFLINE_META_STORAGE_KEY);
    if (rawMeta) {
      const meta = JSON.parse(rawMeta) as OfflineStoredMeta;
      if (typeof meta.lastSavedAt === "string") {
        lastSavedAt = meta.lastSavedAt;
      }
    }
  } catch {
    // Ignore storage read error
  }

  let serviceWorkerActive = false;
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      serviceWorkerActive = Boolean(
        navigator.serviceWorker.controller || reg?.active,
      );
    } catch {
      serviceWorkerActive = false;
    }
  }

  return {
    placesCachedCount: savedPlacesCount,
    cachedTilesCount,
    cachedAssetsCount,
    serviceWorkerActive,
    lastSavedAt,
  };
}

export async function downloadCampusOfflinePack(
  places: CampusPlace[],
  onProgress?: (done: number, total: number) => void,
  placesCacheKey = "eyecu_places_cache_v1",
): Promise<OfflinePackSummary> {
  // Always persist the merged places snapshot locally
  try {
    globalThis.localStorage?.setItem(placesCacheKey, JSON.stringify(places));
  } catch {
    // Ignore storage quota errors
  }

  const localUrls = buildLocalAssetUrls(places);
  const tileUrls = buildCampusTileUrls();
  const total = localUrls.length + tileUrls.length;
  let done = 0;

  onProgress?.(0, total);

  if (typeof window !== "undefined" && "caches" in window) {
    const assetCache = await caches.open(LOCAL_ASSET_CACHE_NAME);
    const tileCache = await caches.open(TILE_CACHE_NAME);

    // 1. Cache local app images, icons & manifest
    const assetBatchSize = 4;
    for (let i = 0; i < localUrls.length; i += assetBatchSize) {
      const slice = localUrls.slice(i, i + assetBatchSize);
      await Promise.allSettled(
        slice.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-cache" });
            if (res.ok) {
              await assetCache.put(url, res);
            }
          } catch {
            // Skip unreachable asset
          } finally {
            done += 1;
            onProgress?.(done, total);
          }
        }),
      );
    }

    // 2. Cache Miotso campus Street & Satellite map tiles
    const tileBatchSize = 6;
    for (let i = 0; i < tileUrls.length; i += tileBatchSize) {
      const slice = tileUrls.slice(i, i + tileBatchSize);
      await Promise.allSettled(
        slice.map(async (url) => {
          try {
            const existing = await tileCache.match(url);
            if (!existing) {
              const res = await fetch(url, { mode: "no-cors" });
              await tileCache.put(url, res);
            }
          } catch {
            // Skip unreachable tile
          } finally {
            done += 1;
            onProgress?.(done, total);
          }
        }),
      );
    }
  } else {
    done = total;
    onProgress?.(total, total);
  }

  const nowIso = new Date().toISOString();
  try {
    globalThis.localStorage?.setItem(
      OFFLINE_META_STORAGE_KEY,
      JSON.stringify({
        lastSavedAt: nowIso,
        placesCount: places.length,
      }),
    );
  } catch {
    // Ignore
  }

  return getOfflinePackSummary(places.length, placesCacheKey);
}
