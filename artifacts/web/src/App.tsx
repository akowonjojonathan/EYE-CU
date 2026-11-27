import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coffee,
  Compass,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  Globe,
  Headphones,
  Home,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Moon,
  Move,
  Navigation,
  Pencil,
  Plus,
  Radar,
  RotateCcw,
  Route,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import { CampusMap } from "@/components/CampusMap";
import { IndoorGuideOverlay } from "@/components/IndoorGuideOverlay";
import { IndoorStepBuilder } from "@/components/IndoorStepBuilder";
import { LeafletCampusMap } from "@/components/LeafletCampusMap";
import { OfflineCampusModal } from "@/components/OfflineCampusModal";
import { OfflineIndicator, useOnlineStatus } from "@/components/OfflineIndicator";
import { ProximityRadarModal } from "@/components/ProximityRadarModal";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import {
  CAMPUS_CENTER,
  CAMPUS_PLACES,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_IMAGES,
  findClinicPlace,
  getPlaceImageUrl,
  getPlaceOpenStatus,
  OSM_ATTRIBUTION,
  parseIndoorSteps,
  type CampusPlace,
  type Coordinate,
  type IndoorStep,
  type PlaceCategory,
} from "@/constants/campus";
import {
  auth,
  checkIsCloudAdmin,
  deleteCampusPlaceFromCloud,
  importCampusPlacesToCloud,
  makeCampusPlaceId,
  saveCampusPlaceToCloud,
  saveFormspreeEndpoint,
  signInAdminWithGoogle,
  signOutCloudAdmin,
  subscribeCampusPlaces,
  subscribePublicSettings,
} from "@/lib/firebase";
import { triggerHaptic } from "@/lib/haptics";
import { getCampusAtmosphere } from "@/lib/time-atmosphere";
import {
  bearingDegrees,
  buildMultiStopRoute,
  distanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from "@/lib/walking-navigation";

type CategoryFilter = "All" | "Saved" | PlaceCategory;
type AdminFormMode = "add" | "edit";
type MapStyleMode = "schematic" | "street" | "satellite";

const CATEGORIES: CategoryFilter[] = [
  "All",
  "Saved",
  "Academic",
  "Food",
  "Residence",
  "Sports",
  "Services",
  "Campus",
];

const PLACE_CATEGORY_OPTIONS: PlaceCategory[] = [
  "Campus",
  "Academic",
  "Food",
  "Residence",
  "Sports",
  "Services",
];

const SAVED_STORAGE_KEY = "eyecu_saved_place_ids";
const RECENT_STORAGE_KEY = "eyecu_recent_place_ids";
const THEME_STORAGE_KEY = "eyecu_theme";
const MAP_STYLE_STORAGE_KEY = "eyecu_map_style";
const PLACES_CACHE_STORAGE_KEY = "eyecu_places_cache_v1";
const ARRIVAL_THRESHOLD_METERS = 20;

const SEED_ID_SET = new Set(CAMPUS_PLACES.map((p) => p.id));

function CategoryIcon({
  category,
  size = 16,
}: {
  category: PlaceCategory;
  size?: number;
}) {
  switch (category) {
    case "Academic":
      return <BookOpen size={size} />;
    case "Food":
      return <Coffee size={size} />;
    case "Residence":
      return <Home size={size} />;
    case "Sports":
      return <Activity size={size} />;
    case "Services":
      return <Briefcase size={size} />;
    default:
      return <MapPin size={size} />;
  }
}

function readInitialUrlParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const place = params.get("place");
    const from = params.get("from");
    const stopsRaw = params.get("stops");
    const stops = stopsRaw
      ? stopsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];
    return { place, from, stops };
  } catch {
    return {
      place: null,
      from: null,
      stops: [] as string[],
    };
  }
}

export function App() {
  const initialUrl = useMemo(() => readInitialUrlParams(), []);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [atmosphere, setAtmosphere] = useState(() => getCampusAtmosphere());

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return Boolean(
        globalThis.window?.matchMedia?.("(prefers-color-scheme: dark)").matches,
      );
    } catch {
      return false;
    }
  });

  const [mapStyle, setMapStyle] = useState<MapStyleMode>(() => {
    try {
      const saved = globalThis.localStorage?.getItem(MAP_STYLE_STORAGE_KEY);
      if (saved === "street" || saved === "satellite" || saved === "schematic") {
        return saved;
      }
    } catch {
      // Ignore
    }
    return "schematic";
  });

  // Live Firestore places hydrated from instant offline snapshot cache
  const [cloudDocs, setCloudDocs] = useState<CampusPlace[]>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(PLACES_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as CampusPlace[];
      }
    } catch {
      // Ignore cache error
    }
    return [];
  });
  const [cloudSyncing, setCloudSyncing] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [sortByNearest, setSortByNearest] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(
    initialUrl.place || CAMPUS_PLACES[0]?.id || "central-university",
  );
  const [focusKey, setFocusKey] = useState(initialUrl.place ? 1 : 0);
  const [recenterKey, setRecenterKey] = useState(0);

  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(SAVED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((v) => typeof v === "string");
        }
      }
    } catch {
      // Ignore
    }
    return ["trinity-hall", "cafeteria", "central-plaza"];
  });

  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      const raw = globalThis.localStorage?.getItem(RECENT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((v) => typeof v === "string").slice(0, 3);
        }
      }
    } catch {
      // Ignore
    }
    return [];
  });

  // Start point, Night Walk, & Multi-stop navigation
  const [startSourceId, setStartSourceId] = useState<string>(
    initialUrl.from || "central-university",
  );
  const [routeStopIds, setRouteStopIds] = useState<string[]>(initialUrl.stops);
  const [nightWalkMode, setNightWalkMode] = useState(false);
  const [gpsCoordinate, setGpsCoordinate] = useState<Coordinate | null>(null);
  const [gpsHeading, setGpsHeading] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isFollowingGps, setIsFollowingGps] = useState(false);
  const [followCamera, setFollowCamera] = useState(false);
  const [routeFitKey, setRouteFitKey] = useState(0);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [arrivalBanner, setArrivalBanner] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(
    initialUrl.stops.length > 0,
  );
  const [arrived, setArrived] = useState(false);
  const { heading: compassHeading, requestCompassPermission } = useCompassHeading(
    isNavigating && !arrived,
  );
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);

  // Proximity Radar, Offline Campus Mode, Card 3D Tilt & Admin GPS Pin states
  const isOnline = useOnlineStatus();
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlinePreviewMode, setOfflinePreviewMode] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [radarRadiusMeters, setRadarRadiusMeters] = useState(250);
  const [cardTilt, setCardTilt] = useState({ rx: 0, ry: 0 });
  const [locatingAdminGps, setLocatingAdminGps] = useState(false);

  // Firebase Auth Admin state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isCloudAdmin, setIsCloudAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminDragMode, setAdminDragMode] = useState(false);

  // Admin Add / Edit form state
  const [adminFormMode, setAdminFormMode] = useState<AdminFormMode>("add");
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<PlaceCategory>("Academic");
  const [formLat, setFormLat] = useState("");
  const [formLon, setFormLon] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formHours, setFormHours] = useState("");
  const [formOpenDays, setFormOpenDays] = useState("Daily");
  const [formDetails, setFormDetails] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsIndoor, setFormIsIndoor] = useState(false);
  const [formParentBuilding, setFormParentBuilding] = useState("");
  const [formIndoorSteps, setFormIndoorSteps] = useState<IndoorStep[]>([]);
  const [placeFormError, setPlaceFormError] = useState<string | null>(null);
  const [placeFormSuccess, setPlaceFormSuccess] = useState<string | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [manageQuery, setManageQuery] = useState("");
  const [pickOnMapMode, setPickOnMapMode] = useState(false);

  // Indoor Step-by-Step Guide Overlay state
  const [indoorGuidePlace, setIndoorGuidePlace] = useState<CampusPlace | null>(
    null,
  );
  const [indoorStepIndex, setIndoorStepIndex] = useState(0);
  const autoTriggeredIndoorRef = useRef<string | null>(null);

  // Place photo lightbox, Report modal, Contact Us modal & Formspree settings
  const [photoLightboxOpen, setPhotoLightboxOpen] = useState(false);
  const [cloudFormspreeEndpoint, setCloudFormspreeEndpoint] = useState("");
  const [formspreeDraft, setFormspreeDraft] = useState("");
  const [savingFormspree, setSavingFormspree] = useState(false);
  const [formspreeStatus, setFormspreeStatus] = useState<string | null>(null);
  const [formspreeError, setFormspreeError] = useState<string | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportIssueType, setReportIssueType] = useState(
    "Pin Location Is Inaccurate",
  );
  const [reportEmail, setReportEmail] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTopic, setContactTopic] = useState("General Question");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const activeFormspreeUrl = useMemo(() => {
    const cloudVal = cloudFormspreeEndpoint.trim();
    if (cloudVal) return cloudVal;
    const envVal = (
      (import.meta.env?.VITE_FORMSPREE_ENDPOINT as string | undefined) || ""
    ).trim();
    return envVal;
  }, [cloudFormspreeEndpoint]);

  // Sync theme & map style
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    try {
      globalThis.localStorage?.setItem(
        THEME_STORAGE_KEY,
        darkMode ? "dark" : "light",
      );
    } catch {
      // Ignore
    }
  }, [darkMode]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(MAP_STYLE_STORAGE_KEY, mapStyle);
    } catch {
      // Ignore
    }
  }, [mapStyle]);

  // Refresh dynamic Time-of-Day atmosphere every 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      setAtmosphere(getCampusAtmosphere());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Subscribe to real-time Firestore campus_places & public settings
  useEffect(() => {
    const syncTimer = window.setTimeout(() => setCloudSyncing(false), 900);
    const unsubPlaces = subscribeCampusPlaces(
      (docs) => {
        setCloudDocs(docs);
        setCloudSyncing(false);
        try {
          globalThis.localStorage?.setItem(
            PLACES_CACHE_STORAGE_KEY,
            JSON.stringify(docs),
          );
        } catch {
          // Ignore cache write errors
        }
      },
      (errMsg) => {
        setCloudSyncing(false);
        setLocationMessage(errMsg);
      },
    );
    const unsubSettings = subscribePublicSettings((endpoint) => {
      setCloudFormspreeEndpoint(endpoint);
      setFormspreeDraft(endpoint);
    });
    return () => {
      window.clearTimeout(syncTimer);
      unsubPlaces();
      unsubSettings();
    };
  }, []);

  // Automatically check user's live GPS location on startup so distances & routes use real position
  useEffect(() => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) return;

    let cancelled = false;
    geo.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const coord: Coordinate = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setGpsCoordinate(coord);
        if (!initialUrl.from) {
          setStartSourceId("gps");
          setIsFollowingGps(true);
        }
      },
      (err) => {
        if (cancelled) return;
        const msgLower = (err.message || "").toLowerCase();
        const blockedByFrame =
          msgLower.includes("permissions policy") ||
          (window.self !== window.top && err.code === 1);
        if (err.code === 1 && !initialUrl.from && !blockedByFrame) {
          setLocationMessage(
            "Location permission is blocked in your browser — using Central University Gate. Allow Location in browser site settings & tap GPS.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );

    return () => {
      cancelled = true;
    };
  }, [initialUrl.from]);

  // Listen to Firebase Auth state & check Cloud Admin role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const ok = await checkIsCloudAdmin(user);
        setIsCloudAdmin(ok);
        if (!ok) {
          setAdminDragMode(false);
        }
      } else {
        setIsCloudAdmin(false);
        setAdminDragMode(false);
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcuts: "/" focuses search, "Escape" cancels map pick / drag / closes modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        if (photoLightboxOpen) {
          setPhotoLightboxOpen(false);
        } else if (reportModalOpen) {
          setReportModalOpen(false);
        } else if (contactModalOpen) {
          setContactModalOpen(false);
        } else if (pickOnMapMode) {
          setPickOnMapMode(false);
          setAdminOpen(true);
        } else if (adminDragMode) {
          setAdminDragMode(false);
        } else if (adminOpen) {
          setAdminOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    adminDragMode,
    adminOpen,
    contactModalOpen,
    photoLightboxOpen,
    pickOnMapMode,
    reportModalOpen,
  ]);

  // Merge built-in seeds + live Firestore overrides + custom Firestore places
  const { overrideMap, customPlaces, allPlaces } = useMemo(() => {
    const overrides = new Map<string, CampusPlace>();
    const customs: CampusPlace[] = [];

    for (const docItem of cloudDocs) {
      if (SEED_ID_SET.has(docItem.id)) {
        overrides.set(docItem.id, docItem);
      } else {
        customs.push(docItem);
      }
    }

    const mergedSeeds = CAMPUS_PLACES.map(
      (seed) => overrides.get(seed.id) ?? seed,
    );
    customs.sort((a, b) => a.name.localeCompare(b.name));

    return {
      overrideMap: overrides,
      customPlaces: customs,
      allPlaces: [...mergedSeeds, ...customs],
    };
  }, [cloudDocs]);

  const customPlaceIdSet = useMemo(
    () => new Set(customPlaces.map((p) => p.id)),
    [customPlaces],
  );

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(
        SAVED_STORAGE_KEY,
        JSON.stringify(savedIds),
      );
    } catch {
      // Ignore
    }
  }, [savedIds]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(recentIds),
      );
    } catch {
      // Ignore
    }
  }, [recentIds]);

  const originCoordinate = useMemo<Coordinate>(() => {
    if (startSourceId === "gps" && gpsCoordinate) {
      return gpsCoordinate;
    }
    const startPlace = allPlaces.find((p) => p.id === startSourceId);
    return startPlace ?? CAMPUS_CENTER;
  }, [allPlaces, gpsCoordinate, startSourceId]);

  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const filtered = allPlaces.filter((place) => {
      const matchesCat =
        category === "All" ||
        (category === "Saved"
          ? savedIds.includes(place.id)
          : place.category === category);
      const matchesQuery =
        q.length === 0 ||
        `${place.name} ${place.category} ${place.note} ${place.roomsOrDetails ?? ""} ${place.parentBuildingName ?? ""}`
          .toLocaleLowerCase()
          .includes(q);
      return matchesCat && matchesQuery;
    });

    if (sortByNearest) {
      return [...filtered].sort(
        (a, b) =>
          distanceMeters(originCoordinate, a) -
          distanceMeters(originCoordinate, b),
      );
    }

    return filtered;
  }, [allPlaces, category, originCoordinate, query, savedIds, sortByNearest]);

  const selectedPlace = useMemo(
    () =>
      allPlaces.find((p) => p.id === selectedPlaceId) ??
      visiblePlaces[0] ??
      allPlaces[0]!,
    [allPlaces, selectedPlaceId, visiblePlaces],
  );

  // Sync URL query params for deep-link sharing
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (selectedPlace?.id) {
        url.searchParams.set("place", selectedPlace.id);
      }
      if (startSourceId && startSourceId !== "gps") {
        url.searchParams.set("from", startSourceId);
      } else {
        url.searchParams.delete("from");
      }
      if (routeStopIds.length > 0) {
        url.searchParams.set("stops", routeStopIds.join(","));
      } else {
        url.searchParams.delete("stops");
      }
      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore history errors in restricted contexts
    }
  }, [routeStopIds, selectedPlace?.id, startSourceId]);

  const routeStops = useMemo(() => {
    const resolved = routeStopIds
      .map((id) => allPlaces.find((p) => p.id === id))
      .filter((p): p is CampusPlace => Boolean(p));
    if (resolved.length > 0) return resolved;
    return selectedPlace ? [selectedPlace] : [];
  }, [allPlaces, routeStopIds, selectedPlace]);

  const activeRoute = useMemo(() => {
    return buildMultiStopRoute(originCoordinate, routeStops);
  }, [originCoordinate, routeStops]);

  const effectiveHeading = useMemo(() => {
    if (compassHeading !== null) return compassHeading;
    if (gpsHeading !== null) return gpsHeading;
    if (isNavigating && activeRoute && activeRoute.coordinates.length >= 2) {
      return bearingDegrees(
        activeRoute.coordinates[0]!,
        activeRoute.coordinates[1]!,
      );
    }
    return null;
  }, [activeRoute, compassHeading, gpsHeading, isNavigating]);

  // Live GPS watchPosition when walking with GPS Follow-Me active
  useEffect(() => {
    if (
      (!isFollowingGps && !followCamera) ||
      !isNavigating ||
      startSourceId !== "gps"
    ) {
      return;
    }
    if (!globalThis.navigator?.geolocation) return;

    const watchId = globalThis.navigator.geolocation.watchPosition(
      (pos) => {
        const nextCoord: Coordinate = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setGpsCoordinate(nextCoord);

        if (
          typeof pos.coords.heading === "number" &&
          Number.isFinite(pos.coords.heading) &&
          (pos.coords.speed === null || pos.coords.speed > 0.35)
        ) {
          setGpsHeading(Math.round(pos.coords.heading));
        }

        const currentTarget = routeStops[0];
        if (currentTarget) {
          const dist = distanceMeters(nextCoord, currentTarget);
          if (dist <= ARRIVAL_THRESHOLD_METERS) {
            const hasIndoorGuide =
              Boolean(currentTarget.isIndoor) &&
              Boolean(currentTarget.indoorSteps?.length);

            if (hasIndoorGuide && autoTriggeredIndoorRef.current !== currentTarget.id) {
              autoTriggeredIndoorRef.current = currentTarget.id;
              setIndoorStepIndex(0);
              setIndoorGuidePlace(currentTarget);
            }

            if (routeStopIds.length > 1) {
              setArrivalBanner(
                hasIndoorGuide
                  ? `Reached ${currentTarget.parentBuildingName || currentTarget.name}! Follow the indoor guide, then continue.`
                  : `Reached ${currentTarget.name}! Heading to next stop.`,
              );
              setRouteStopIds((prev) => prev.slice(1));
            } else {
              setArrived(true);
              setIsFollowingGps(false);
              setFollowCamera(false);
              setArrivalBanner(
                hasIndoorGuide
                  ? `You reached ${currentTarget.parentBuildingName || currentTarget.name}! Indoor guide opened.`
                  : `You have arrived at ${currentTarget.name}!`,
              );
            }
          }
        }
      },
      () => {
        // Keep last known GPS coordinate silently on transient read error
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => {
      globalThis.navigator.geolocation.clearWatch(watchId);
    };
  }, [
    followCamera,
    isFollowingGps,
    isNavigating,
    routeStopIds.length,
    routeStops,
    startSourceId,
  ]);

  const toggleSaved = (id: string) => {
    setSavedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const openIndoorGuide = (place: CampusPlace) => {
    if (!place.indoorSteps || place.indoorSteps.length === 0) return;
    setIndoorStepIndex(0);
    setIndoorGuidePlace(place);
  };

  const selectPlace = (place: CampusPlace, shouldFocus = true) => {
    triggerHaptic("tap");
    setSelectedPlaceId(place.id);
    setArrived(false);
    setFollowCamera(false);
    autoTriggeredIndoorRef.current = null;
    setArrivalBanner(null);
    setCopiedCoords(false);
    setLocationMessage(null);
    setMobileDirectoryOpen(false);
    if (shouldFocus) {
      setFocusKey((k) => k + 1);
    }
    setRecentIds((prev) =>
      [place.id, ...prev.filter((id) => id !== place.id)].slice(0, 3),
    );
  };

  const jumpToNearestMatching = (
    label: string,
    predicate: (p: CampusPlace) => boolean,
  ) => {
    const matches = allPlaces.filter(predicate);
    if (matches.length === 0) return;
    const nearest = [...matches].sort(
      (a, b) =>
        distanceMeters(originCoordinate, a) -
        distanceMeters(originCoordinate, b),
    )[0]!;
    setQuery("");
    setCategory("All");
    selectPlace(nearest, true);
    setLocationMessage(`Nearest ${label}: ${nearest.name}`);
  };

  const toggleStopInRoute = (placeId: string) => {
    setRouteStopIds((prev) => {
      if (prev.includes(placeId)) {
        return prev.filter((id) => id !== placeId);
      }
      if (prev.length >= 4) {
        setLocationMessage("Multi-stop planner supports up to 4 stops.");
        return prev;
      }
      const next = [...prev, placeId];
      setIsNavigating(true);
      setArrived(false);
      return next;
    });
  };

  const openAdminForAdd = () => {
    setAdminFormMode("add");
    setEditingPlaceId(null);
    setConfirmDeleteId(null);
    setFormName("");
    setFormCategory("Academic");
    setFormLat("");
    setFormLon("");
    setFormNote("");
    setFormHours("7:30 AM – 6:00 PM");
    setFormOpenDays("Mon–Sat");
    setFormDetails("");
    setFormImageUrl("");
    setFormIsIndoor(false);
    setFormParentBuilding("");
    setFormIndoorSteps([]);
    setPlaceFormError(null);
    setPlaceFormSuccess(null);
    setAuthError(null);
    setAdminOpen(true);
  };

  const openAdminForEdit = (place: CampusPlace) => {
    setAdminFormMode("edit");
    setEditingPlaceId(place.id);
    setConfirmDeleteId(null);
    setFormName(place.name);
    setFormCategory(place.category);
    setFormLat(String(place.latitude));
    setFormLon(String(place.longitude));
    setFormNote(place.note);
    setFormHours(place.hours || "");
    setFormOpenDays(place.openDays || "Daily");
    setFormDetails(place.roomsOrDetails || "");
    setFormImageUrl(place.imageUrl || "");
    setFormIsIndoor(Boolean(place.isIndoor));
    setFormParentBuilding(place.parentBuildingName || "");
    setFormIndoorSteps(place.indoorSteps ? [...place.indoorSteps] : []);
    setPlaceFormError(null);
    setPlaceFormSuccess(null);
    setAuthError(null);
    setAdminOpen(true);
  };

  const openReportModal = () => {
    setReportIssueType("Pin Location Is Inaccurate");
    setReportDetails("");
    setReportSuccess(null);
    setReportError(null);
    setReportModalOpen(true);
  };

  const openContactModal = () => {
    setContactSuccess(null);
    setContactError(null);
    setContactModalOpen(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlace) return;
    setReportError(null);
    setReportSuccess(null);

    if (!activeFormspreeUrl) {
      setReportError(
        "Formspree is not configured yet. Sign in to Admin and paste your Formspree endpoint URL (https://formspree.io/f/...) to receive place reports.",
      );
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setReportError(
        "You are currently offline. Connect to Wi-Fi or mobile data to submit your report.",
      );
      return;
    }

    setReportSubmitting(true);
    try {
      const res = await fetch(activeFormspreeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `[EYE-CU Pin Report] ${selectedPlace.name} (${reportIssueType})`,
          formType: "Place Issue Report",
          placeId: selectedPlace.id,
          placeName: selectedPlace.name,
          category: selectedPlace.category,
          coordinates: `${selectedPlace.latitude.toFixed(6)}, ${selectedPlace.longitude.toFixed(6)}`,
          issueType: reportIssueType,
          reporterEmail: reportEmail.trim() || "Anonymous student/visitor",
          details: reportDetails.trim() || "(No extra notes provided)",
          userGps: gpsCoordinate
            ? `${gpsCoordinate.latitude.toFixed(6)}, ${gpsCoordinate.longitude.toFixed(6)}`
            : "Not shared",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          errors?: Array<{ message?: string }>;
        } | null;
        const formspreeMsg =
          data?.errors?.map((item) => item.message).filter(Boolean).join(" ") ||
          data?.error;
        throw new Error(
          formspreeMsg || "Could not deliver report through Formspree.",
        );
      }
      setReportSuccess(
        `Report sent for "${selectedPlace.name}". Thank you for helping keep EYE-CU accurate!`,
      );
      setReportDetails("");
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : "Failed to submit report.",
      );
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSuccess(null);

    if (!activeFormspreeUrl) {
      setContactError(
        "Formspree is not configured yet. Sign in to Admin and paste your Formspree endpoint URL (https://formspree.io/f/...) to receive Contact Us messages.",
      );
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setContactError(
        "You are currently offline. Connect to Wi-Fi or mobile data to send your message.",
      );
      return;
    }

    if (!contactMessage.trim()) {
      setContactError("Please enter a short message before sending.");
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await fetch(activeFormspreeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          _subject: `[EYE-CU Support] ${contactTopic} — ${contactName.trim() || "Campus User"}`,
          formType: "Customer Support Contact",
          senderName: contactName.trim() || "Campus User",
          senderEmail: contactEmail.trim() || "Not provided",
          topic: contactTopic,
          details: contactMessage.trim(),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          errors?: Array<{ message?: string }>;
        } | null;
        const formspreeMsg =
          data?.errors?.map((item) => item.message).filter(Boolean).join(" ") ||
          data?.error;
        throw new Error(
          formspreeMsg || "Could not deliver message through Formspree.",
        );
      }
      setContactSuccess(
        "Message sent to EYE-CU support! We'll get back to you soon.",
      );
      setContactMessage("");
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : "Failed to send message.",
      );
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleSaveFormspreeSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !isCloudAdmin) return;
    setFormspreeError(null);
    setFormspreeStatus(null);
    setSavingFormspree(true);
    try {
      const saved = await saveFormspreeEndpoint(formspreeDraft, authUser);
      setCloudFormspreeEndpoint(saved);
      setFormspreeDraft(saved);
      setFormspreeStatus(
        saved
          ? "Saved Formspree endpoint live! Contact Us & ⚠️ Reports will deliver straight to your inbox."
          : "Cleared cloud Formspree endpoint.",
      );
    } catch (err) {
      setFormspreeError(
        err instanceof Error ? err.message : "Failed to save Formspree endpoint.",
      );
    } finally {
      setSavingFormspree(false);
    }
  };

  const startWalkingNavigation = () => {
    void requestCompassPermission();
    autoTriggeredIndoorRef.current = null;
    setIsNavigating(true);
    setCardCollapsed(true);
    setArrived(false);
    setArrivalBanner(null);
    setMapStyle("satellite");
    if (startSourceId === "gps" && gpsCoordinate) {
      const target = routeStops[0];
      if (
        target &&
        target.isIndoor &&
        target.indoorSteps?.length &&
        distanceMeters(gpsCoordinate, target) <= ARRIVAL_THRESHOLD_METERS
      ) {
        autoTriggeredIndoorRef.current = target.id;
        setArrived(true);
        setIsFollowingGps(false);
        setFollowCamera(false);
        openIndoorGuide(target);
        setArrivalBanner(
          `You are right outside ${target.parentBuildingName || target.name}! Indoor guide opened.`,
        );
        return;
      }
      setIsFollowingGps(true);
      setFollowCamera(true);
    } else {
      setFollowCamera(false);
      setRouteFitKey((k) => k + 1);
    }
  };

  const requestUserGps = async () => {
    setIsLocating(true);
    setLocationMessage(null);
    void requestCompassPermission();

    try {
      if (!globalThis.navigator?.geolocation) {
        throw new Error("Location is not available in this browser.");
      }

      const result = await new Promise<{
        coord: Coordinate;
        heading: number | null;
      }>((resolve, reject) => {
        globalThis.navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              coord: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              },
              heading:
                typeof pos.coords.heading === "number" &&
                Number.isFinite(pos.coords.heading) &&
                (pos.coords.speed === null || pos.coords.speed > 0.35)
                  ? Math.round(pos.coords.heading)
                  : null,
            }),
          (err) => {
            if (err.code === 1) {
              const msgLower = (err.message || "").toLowerCase();
              const isEmbeddedFrame = window.self !== window.top;
              if (msgLower.includes("permissions policy")) {
                reject(
                  new Error(
                    "GPS is disabled inside this preview frame. Open the app directly in a full browser tab to use live GPS.",
                  ),
                );
              } else if (isEmbeddedFrame) {
                reject(
                  new Error(
                    "Location was blocked by your browser or preview frame. Open the Shared App URL in a new tab and allow Location access.",
                  ),
                );
              } else {
                reject(
                  new Error(
                    "Location permission is blocked on your device/browser. Enable Location in your device settings and allow Location in the address bar.",
                  ),
                );
              }
            } else {
              reject(
                new Error(
                  "Could not read GPS signal right now. Using selected campus start point.",
                ),
              );
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
      });

      setGpsCoordinate(result.coord);
      if (result.heading !== null) {
        setGpsHeading(result.heading);
      }
      setStartSourceId("gps");
      setIsNavigating(true);
      setCardCollapsed(true);
      setIsFollowingGps(true);
      setFollowCamera(true);
      setMapStyle("satellite");
      setArrived(false);
      setLocationMessage("Live Satellite Follow-Me active.");
    } catch (err) {
      setLocationMessage(
        err instanceof Error ? err.message : "Could not get GPS location.",
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleCopyCoordinates = async (place: CampusPlace) => {
    const text = `${place.name} (${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)})`;
    try {
      await globalThis.navigator?.clipboard?.writeText(text);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 1800);
    } catch {
      setLocationMessage(`Coordinates: ${text}`);
    }
  };

  const handleShareNightWalk = async () => {
    triggerHaptic("tap");
    const targetCoord = gpsCoordinate ?? originCoordinate;
    const coordsText = `${targetCoord.latitude.toFixed(6)}, ${targetCoord.longitude.toFixed(6)}`;
    const summaryText = `EYE-CU Night-Walk Safety Check-In: I am walking at Central University Miotso${selectedPlace ? ` toward ${selectedPlace.name}` : ""}. Current coordinates: ${coordsText} (https://www.google.com/maps?q=${targetCoord.latitude.toFixed(6)},${targetCoord.longitude.toFixed(6)})`;

    try {
      if (globalThis.navigator?.share) {
        await globalThis.navigator.share({
          title: "EYE-CU · Live Night Walk",
          text: summaryText,
        });
      } else if (globalThis.navigator?.clipboard) {
        await globalThis.navigator.clipboard.writeText(summaryText);
        setLocationMessage("Night-Walk live safety coordinates copied to clipboard!");
      }
    } catch {
      // Ignore cancelled native share
    }
  };

  const handlePinAdminCurrentGps = () => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) {
      setPlaceFormError("Geolocation is unavailable in this browser.");
      return;
    }
    triggerHaptic("tap");
    setLocatingAdminGps(true);
    setPlaceFormError(null);
    geo.getCurrentPosition(
      (pos) => {
        setLocatingAdminGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        setFormLat(String(lat));
        setFormLon(String(lon));
        setGpsCoordinate({ latitude: lat, longitude: lon });
        setPlaceFormSuccess(
          `Pinned your live GPS (${lat}, ${lon})! Tap Save below to publish.`,
        );
        triggerHaptic("step");
      },
      () => {
        setLocatingAdminGps(false);
        setPlaceFormError(
          "Could not read GPS signal. Enable Location access or use Pick on Map.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  };

  const handleGoogleAdminSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const user = await signInAdminWithGoogle();
      const ok = await checkIsCloudAdmin(user);
      setIsCloudAdmin(ok);
      if (!ok) {
        setAuthError(
          `Signed in as ${user.email || "this account"}, which is not authorized as a campus admin.`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setAuthError(
          "You are currently offline. Connect to Wi-Fi or mobile data to sign in as Admin.",
        );
      } else if (msg.includes("auth/network-request-failed")) {
        setAuthError(
          "Could not reach Firebase Auth (auth/network-request-failed). Check your internet connection, disable ad-blockers/Brave Shields for this site, or verify your Firebase API key restrictions allow this domain.",
        );
      } else if (msg.includes("auth/unauthorized-domain")) {
        setAuthError(
          "This domain is not listed under Firebase Console → Authentication → Settings → Authorized domains.",
        );
      } else {
        setAuthError(msg || "Google Sign-In failed. Try again.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmitPlaceForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !isCloudAdmin) return;

    setPlaceFormError(null);
    setPlaceFormSuccess(null);

    const latitude = Number(formLat);
    const longitude = Number(formLon);
    if (
      !formName.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setPlaceFormError("Enter a valid place name, latitude, and longitude.");
      return;
    }

    if (
      formIsIndoor &&
      formIndoorSteps.some((step) => step.instructionText.trim().length === 0)
    ) {
      setPlaceFormError(
        "Fill in or delete any blank indoor step instructions before saving.",
      );
      return;
    }

    const cleanIndoorSteps = formIsIndoor
      ? parseIndoorSteps(formIndoorSteps)
      : [];

    setSavingPlace(true);
    const targetId =
      adminFormMode === "edit" && editingPlaceId
        ? editingPlaceId
        : makeCampusPlaceId(formName);

    const isSeedOverride = SEED_ID_SET.has(targetId);
    const existingPlace = allPlaces.find((p) => p.id === targetId);
    const nextPlacePayload: Omit<CampusPlace, "id"> = {
      name: formName.trim(),
      category: formCategory,
      latitude,
      longitude,
      note:
        formNote.trim() ||
        existingPlace?.note ||
        "Campus directory location",
      hours: formHours.trim() || existingPlace?.hours || "",
      openDays: formOpenDays.trim() || existingPlace?.openDays || "Daily",
      openHour: existingPlace?.openHour ?? -1,
      closeHour: existingPlace?.closeHour ?? -1,
      roomsOrDetails:
        formDetails.trim() || existingPlace?.roomsOrDetails || "",
      imageUrl: formImageUrl.trim(),
      isIndoor: formIsIndoor,
      parentBuildingName: formIsIndoor ? formParentBuilding.trim() : "",
      indoorSteps: cleanIndoorSteps,
    };
    const optimisticPlace: CampusPlace = {
      ...nextPlacePayload,
      id: targetId,
      isSeedOverride,
    };
    const previousCloudDocs = cloudDocs;

    setCloudDocs((prev) => {
      const idx = prev.findIndex((p) => p.id === targetId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = optimisticPlace;
        return next;
      }
      return [...prev, optimisticPlace];
    });
    setSelectedPlaceId(targetId);
    setFocusKey((k) => k + 1);

    try {
      const saved = await saveCampusPlaceToCloud(
        targetId,
        nextPlacePayload,
        isSeedOverride,
        authUser,
      );

      setSelectedPlaceId(saved.id);

      if (adminFormMode === "edit") {
        setPlaceFormSuccess(`Saved "${saved.name}" live to Cloud Firestore.`);
      } else {
        setCategory("All");
        setFormName("");
        setFormLat("");
        setFormLon("");
        setFormNote("");
        setFormDetails("");
        setFormImageUrl("");
        setFormIsIndoor(false);
        setFormParentBuilding("");
        setFormIndoorSteps([]);
        setPlaceFormSuccess(`Added "${saved.name}" live to Cloud Firestore.`);
      }
    } catch (err) {
      setCloudDocs(previousCloudDocs);
      setPlaceFormError(
        err instanceof Error ? err.message : "Could not save place to cloud.",
      );
    } finally {
      setSavingPlace(false);
    }
  };

  const handleDragPinEnd = async (place: CampusPlace, coord: Coordinate) => {
    if (!authUser || !isCloudAdmin) return;
    const isSeedOverride = SEED_ID_SET.has(place.id);
    const updatedPlace: CampusPlace = {
      ...place,
      latitude: coord.latitude,
      longitude: coord.longitude,
      isSeedOverride,
    };
    const previousCloudDocs = cloudDocs;

    setCloudDocs((prev) => {
      const idx = prev.findIndex((p) => p.id === place.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedPlace;
        return next;
      }
      return [...prev, updatedPlace];
    });
    setSelectedPlaceId(place.id);
    if (editingPlaceId === place.id) {
      setFormLat(String(coord.latitude));
      setFormLon(String(coord.longitude));
    }

    try {
      const saved = await saveCampusPlaceToCloud(
        place.id,
        {
          ...place,
          latitude: coord.latitude,
          longitude: coord.longitude,
        },
        isSeedOverride,
        authUser,
      );
      setSelectedPlaceId(saved.id);
      setLocationMessage(
        `Saved "${saved.name}" pin at ${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
      );
    } catch (err) {
      setCloudDocs(previousCloudDocs);
      if (editingPlaceId === place.id) {
        setFormLat(String(place.latitude));
        setFormLon(String(place.longitude));
      }
      setLocationMessage(
        err instanceof Error ? err.message : "Failed to save dragged pin.",
      );
    }
  };

  const handleDeleteOrResetPlace = async (id: string) => {
    if (!authUser || !isCloudAdmin) return;
    const targetPlace = allPlaces.find((p) => p.id === id);
    const previousCloudDocs = cloudDocs;
    setDeletingPlaceId(id);
    setPlaceFormError(null);
    setPlaceFormSuccess(null);
    setCloudDocs((prev) => prev.filter((p) => p.id !== id));

    try {
      await deleteCampusPlaceFromCloud(id);
      if (SEED_ID_SET.has(id)) {
        const seed = CAMPUS_PLACES.find((p) => p.id === id);
        if (seed && editingPlaceId === id) {
          openAdminForEdit(seed);
        }
        const msg = `Reset "${seed?.name ?? "pin"}" to original campus coordinates.`;
        setPlaceFormSuccess(msg);
        setLocationMessage(msg);
      } else {
        setRouteStopIds((prev) => prev.filter((stopId) => stopId !== id));
        setSavedIds((prev) => prev.filter((savedId) => savedId !== id));
        setRecentIds((prev) => prev.filter((recentId) => recentId !== id));
        if (startSourceId === id) {
          setStartSourceId("central-university");
        }
        if (indoorGuidePlace?.id === id) {
          setIndoorGuidePlace(null);
        }
        if (selectedPlaceId === id) {
          setSelectedPlaceId(CAMPUS_PLACES[0]?.id ?? "central-university");
        }
        if (editingPlaceId === id) {
          openAdminForAdd();
        }
        const msg = `Deleted "${targetPlace?.name ?? "custom place"}" from Cloud Firestore.`;
        setPlaceFormSuccess(msg);
        setLocationMessage(msg);
      }
    } catch (err) {
      setCloudDocs(previousCloudDocs);
      setPlaceFormError(
        err instanceof Error ? err.message : "Could not remove place.",
      );
    } finally {
      setDeletingPlaceId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleExportJson = () => {
    const payload = {
      app: "EYE-CU",
      exportedAt: new Date().toISOString(),
      places: allPlaces,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eyecu-campus-places.json";
    a.click();
    URL.revokeObjectURL(url);
    setPlaceFormSuccess(`Exported ${allPlaces.length} places to JSON.`);
  };

  const handleImportJsonFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !authUser || !isCloudAdmin) return;

    setPlaceFormError(null);
    setPlaceFormSuccess(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const rawList = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === "object" &&
            Array.isArray((parsed as { places?: unknown }).places)
          ? (parsed as { places: unknown[] }).places
          : [];

      const validPlaces: CampusPlace[] = [];
      for (const item of rawList) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const name = typeof obj.name === "string" ? obj.name.trim() : "";
        const cat = obj.category as PlaceCategory;
        const lat = Number(obj.latitude);
        const lon = Number(obj.longitude);
        if (
          name.length >= 2 &&
          PLACE_CATEGORY_OPTIONS.includes(cat) &&
          Number.isFinite(lat) &&
          lat >= -90 &&
          lat <= 90 &&
          Number.isFinite(lon) &&
          lon >= -180 &&
          lon <= 180
        ) {
          validPlaces.push({
            id:
              typeof obj.id === "string" && obj.id.trim()
                ? obj.id.trim()
                : makeCampusPlaceId(name),
            name,
            category: cat,
            latitude: lat,
            longitude: lon,
            note: typeof obj.note === "string" ? obj.note : "",
            hours: typeof obj.hours === "string" ? obj.hours : undefined,
            openDays: typeof obj.openDays === "string" ? obj.openDays : undefined,
            openHour:
              typeof obj.openHour === "number" ? obj.openHour : undefined,
            closeHour:
              typeof obj.closeHour === "number" ? obj.closeHour : undefined,
            roomsOrDetails:
              typeof obj.roomsOrDetails === "string"
                ? obj.roomsOrDetails
                : undefined,
            imageUrl:
              typeof obj.imageUrl === "string" ? obj.imageUrl : undefined,
            isIndoor: Boolean(obj.isIndoor),
            parentBuildingName:
              typeof obj.parentBuildingName === "string"
                ? obj.parentBuildingName
                : undefined,
            indoorSteps: parseIndoorSteps(obj.indoorSteps),
          });
        }
      }

      if (validPlaces.length === 0) {
        setPlaceFormError("No valid campus places found in that JSON file.");
        return;
      }

      setSavingPlace(true);
      const count = await importCampusPlacesToCloud(
        validPlaces,
        SEED_ID_SET,
        authUser,
      );
      setPlaceFormSuccess(
        `Imported ${count} place${count === 1 ? "" : "s"} live to Cloud Firestore.`,
      );
    } catch (err) {
      setPlaceFormError(
        err instanceof Error ? err.message : "Invalid JSON file.",
      );
    } finally {
      setSavingPlace(false);
    }
  };

  const handlePickCoordinate = (coord: Coordinate) => {
    setFormLat(String(coord.latitude));
    setFormLon(String(coord.longitude));
    setPickOnMapMode(false);
    setAdminOpen(true);
  };

  const googleDirectionsUrl = selectedPlace
    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.latitude},${selectedPlace.longitude}&travelmode=walking&origin=${originCoordinate.latitude},${originCoordinate.longitude}`
    : "#";

  const pickedPreviewCoord = useMemo<Coordinate | null>(() => {
    const lat = Number(formLat);
    const lon = Number(formLon);
    if (
      formLat.trim() !== "" &&
      formLon.trim() !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lon)
    ) {
      return { latitude: lat, longitude: lon };
    }
    return null;
  }, [formLat, formLon]);

  const recentPlaces = useMemo(
    () =>
      recentIds
        .map((id) => allPlaces.find((p) => p.id === id))
        .filter((p): p is CampusPlace => Boolean(p)),
    [allPlaces, recentIds],
  );

  const selectedOpenStatus = selectedPlace
    ? getPlaceOpenStatus(selectedPlace)
    : null;
  const selectedColor = selectedPlace
    ? darkMode
      ? CATEGORY_COLORS[selectedPlace.category].dark
      : CATEGORY_COLORS[selectedPlace.category].light
    : "var(--primary)";
  const selectedBg = selectedPlace
    ? darkMode
      ? CATEGORY_COLORS[selectedPlace.category].bgDark
      : CATEGORY_COLORS[selectedPlace.category].bgLight
    : "var(--secondary)";

  return (
    <div
      className={`app-shell${nightWalkMode ? " night-walk-active" : ""}`}
      data-atmosphere={atmosphere.period}
    >
      {/* Left Directory Sidebar (Desktop) / Slide-up Sheet (Mobile) */}
      <aside
        className={`directory-panel${mobileDirectoryOpen ? " is-mobile-open" : ""}`}
        aria-label="Campus places directory"
      >
        <div className="brand-header">
          <div className="brand-copy">
            <p className="brand-kicker">Central University · Miotso</p>
            <h1 className="brand-title">EYE-CU</h1>
          </div>
          <div className="header-actions">
            <PWAInstallButton />
            <button
              type="button"
              aria-label="Contact EYE-CU customer support"
              title="Contact Us"
              onClick={openContactModal}
              className="theme-toggle-btn"
              data-testid="contact-us-btn"
            >
              <Headphones size={17} />
            </button>
            <button
              type="button"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Light mode" : "Dark mode"}
              onClick={() => setDarkMode((prev) => !prev)}
              className="theme-toggle-btn"
              data-testid="theme-toggle"
            >
              {darkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCloudAdmin && selectedPlace) {
                  setAuthError(null);
                  setPlaceFormError(null);
                  setPlaceFormSuccess(null);
                  setAdminOpen(true);
                } else {
                  openAdminForAdd();
                }
              }}
              className={`admin-trigger${isCloudAdmin ? " is-signed-in" : ""}`}
            >
              <ShieldCheck size={15} />
              <span>Admin</span>
            </button>
          </div>
        </div>

        <div className="directory-controls">
          <div className="search-box">
            <Search size={17} color="var(--muted-fg)" />
            <input
              ref={searchInputRef}
              aria-label="Search blocks, halls, food"
              data-testid="place-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks, halls, food…"
              autoComplete="off"
              className="search-input"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="clear-btn"
              >
                <X size={16} />
              </button>
            ) : (
              <span className="search-kbd" aria-hidden="true">
                /
              </span>
            )}
          </div>

          <nav className="category-strip" aria-label="Filter campus places">
            {CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(item)}
                  className={`category-tab${active ? " active" : ""}`}
                >
                  {item === "Saved" ? "★ Saved" : item}
                </button>
              );
            })}
          </nav>

          {/* Campus Essentials Quick-Find Strip */}
          <div className="essentials-row" aria-label="Campus essentials shortcuts">
            <span className="essentials-label">Quick:</span>
            <button
              type="button"
              onClick={() =>
                jumpToNearestMatching("Food", (p) => p.category === "Food")
              }
              className="essential-btn"
            >
              <Coffee size={12} />
              <span>Nearest Food</span>
            </button>
            <button
              type="button"
              onClick={() =>
                jumpToNearestMatching(
                  "ATM / Bank",
                  (p) =>
                    p.id === "calbank" ||
                    p.name.toLowerCase().includes("bank") ||
                    p.category === "Services",
                )
              }
              className="essential-btn"
            >
              <Briefcase size={12} />
              <span>ATM / Bank</span>
            </button>
            <button
              type="button"
              onClick={() =>
                jumpToNearestMatching("Block", (p) => p.category === "Academic")
              }
              className="essential-btn"
            >
              <BookOpen size={12} />
              <span>Lectures</span>
            </button>
            <button
              type="button"
              onClick={() =>
                jumpToNearestMatching("Hostel", (p) => p.category === "Residence")
              }
              className="essential-btn"
            >
              <Home size={12} />
              <span>Hostels</span>
            </button>
          </div>

          {recentPlaces.length > 0 && query === "" ? (
            <div className="essentials-row" aria-label="Recent destinations">
              <span className="essentials-label">Recent:</span>
              {recentPlaces.map((rp) => (
                <button
                  key={`recent-${rp.id}`}
                  type="button"
                  onClick={() => selectPlace(rp, true)}
                  className="essential-btn"
                >
                  <span>{rp.name.replace(" - Central University", "")}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="campus-tools-row" aria-label="Smart campus tools">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setRadarOpen(true);
              }}
              className={`campus-tool-btn${radarOpen ? " is-active" : ""}`}
            >
              <Radar size={13} />
              <span>Around Me</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("step");
                setNightWalkMode((prev) => !prev);
              }}
              className={`campus-tool-btn${nightWalkMode ? " is-night-active" : ""}`}
            >
              <ShieldAlert size={13} />
              <span>Night Walk</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setOfflineModalOpen(true);
              }}
              className={`campus-tool-btn${offlinePreviewMode || !isOnline ? " is-active" : ""}`}
            >
              <WifiOff size={13} />
              <span>Offline Map</span>
            </button>
          </div>

          <div className="start-point-row">
            <label className="start-select-wrap">
              <span className="start-select-label">From</span>
              <select
                aria-label="Walking start location"
                value={startSourceId}
                onChange={(e) => {
                  setStartSourceId(e.target.value);
                  setIsFollowingGps(e.target.value === "gps");
                  setArrived(false);
                }}
                className="start-select"
              >
                {gpsCoordinate ? (
                  <option value="gps">My Live GPS Location</option>
                ) : null}
                {allPlaces.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={requestUserGps}
              disabled={isLocating}
              className={`gps-mini-btn${isFollowingGps ? " is-active" : ""}`}
              title="Follow my live GPS location"
            >
              {isLocating ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <Crosshair size={15} />
              )}
              <span>{isFollowingGps ? "Live" : "GPS"}</span>
            </button>
          </div>
        </div>

        <div className="directory-meta-bar">
          <span>
            {category === "All"
              ? "All mapped places"
              : category === "Saved"
                ? "Saved places"
                : `${category} places`}{" "}
            ·{" "}
            <span className="tabular-nums">
              {visiblePlaces.length}/{allPlaces.length}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setSortByNearest((prev) => !prev)}
            className="sort-toggle-btn"
          >
            <ArrowUpDown size={12} />
            <span>{sortByNearest ? "Nearest" : "Default"}</span>
          </button>
        </div>

        <div className="directory-list">
          {cloudSyncing && visiblePlaces.length === 0 ? (
            <div className="directory-skeleton-list" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div key={`skel-${idx}`} className="skeleton-place-row">
                  <div className="skeleton-box" />
                  <div className="skeleton-lines">
                    <div className="shimmer-line is-wide" />
                    <div className="shimmer-line is-mid" />
                  </div>
                </div>
              ))}
            </div>
          ) : visiblePlaces.length > 0 ? (
            visiblePlaces.map((place, rowIndex) => {
              const isSelected = selectedPlace?.id === place.id;
              const isSaved = savedIds.includes(place.id);
              const dist = distanceMeters(originCoordinate, place);
              const mins = estimateWalkingMinutes(dist);
              const openInfo = getPlaceOpenStatus(place);
              const catColor = darkMode
                ? CATEGORY_COLORS[place.category].dark
                : CATEGORY_COLORS[place.category].light;
              const catBg = darkMode
                ? CATEGORY_COLORS[place.category].bgDark
                : CATEGORY_COLORS[place.category].bgLight;

              return (
                <div
                  key={place.id}
                  className="place-row-wrap row-stagger"
                  style={{ "--row-delay": `${Math.min(rowIndex, 10) * 24}ms` } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => selectPlace(place, true)}
                    className={`place-row${isSelected ? " selected" : ""}`}
                  >
                    <span
                      className="place-row-icon"
                      style={{
                        backgroundColor: isSelected ? catColor : catBg,
                        color: isSelected ? "#FFFFFF" : catColor,
                        borderColor: isSelected ? catColor : "var(--border)",
                      }}
                    >
                      <CategoryIcon category={place.category} size={17} />
                    </span>
                    <span className="place-row-copy">
                      <span className="place-row-title-line">
                        <span className="place-row-title">{place.name}</span>
                        {openInfo.tone !== "neutral" ? (
                          <span
                            className={`status-dot is-${openInfo.tone}`}
                            title={openInfo.label}
                          />
                        ) : null}
                      </span>
                      <span className="place-row-meta">
                        {place.category} ·{" "}
                        <span className="tabular-nums">
                          {place.id === startSourceId
                            ? "Start point"
                            : `${formatDistance(dist)} · ${mins} min`}
                        </span>
                        {place.isIndoor && place.indoorSteps?.length
                          ? ` · Indoor (${place.indoorSteps.length})`
                          : ""}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={
                      isSaved
                        ? `Remove ${place.name} from saved`
                        : `Save ${place.name}`
                    }
                    onClick={() => {
                      triggerHaptic("tap");
                      toggleSaved(place.id);
                    }}
                    className={`row-star-btn${isSaved ? " is-saved" : ""}`}
                  >
                    <Star
                      size={16}
                      fill={isSaved ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="empty-directory">
              <strong>No matching places</strong>
              <p>Try clearing your search or switching category filters.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Right Interactive Map Viewport */}
      <main className="map-pane">
        {mapStyle === "schematic" ? (
          <CampusMap
            places={visiblePlaces}
            selectedPlaceId={selectedPlace?.id ?? null}
            savedIds={savedIds}
            routeStopIds={routeStopIds}
            originCoordinate={originCoordinate}
            isLiveGps={startSourceId === "gps" && gpsCoordinate !== null}
            headingDegrees={effectiveHeading}
            isNavigating={isNavigating && !arrived}
            darkMode={darkMode || nightWalkMode}
            nightWalkMode={nightWalkMode}
            radarRadiusMeters={radarOpen ? radarRadiusMeters : null}
            focusKey={focusKey}
            recenterKey={recenterKey}
            routeCoordinates={
              isNavigating && activeRoute ? activeRoute.coordinates : null
            }
            routeType={activeRoute?.routeType ?? "mapped"}
            pickMode={pickOnMapMode}
            adminDragMode={isCloudAdmin && adminDragMode}
            pickBannerText={
              adminFormMode === "edit" && formName
                ? `Click map to move "${formName}"`
                : "Click anywhere on the campus map to set coordinates"
            }
            pickedCoordinate={pickedPreviewCoord}
            onSelectPlace={(p) => selectPlace(p, true)}
            onPickCoordinate={handlePickCoordinate}
            onDragPinEnd={(place, coord) => void handleDragPinEnd(place, coord)}
            onCancelPick={() => {
              setPickOnMapMode(false);
              setAdminOpen(true);
            }}
            onRecenter={() => setRecenterKey((k) => k + 1)}
          />
        ) : (
          <LeafletCampusMap
            tileStyle={mapStyle}
            places={visiblePlaces}
            selectedPlaceId={selectedPlace?.id ?? null}
            savedIds={savedIds}
            routeStopIds={routeStopIds}
            originCoordinate={originCoordinate}
            isLiveGps={startSourceId === "gps" && gpsCoordinate !== null}
            headingDegrees={effectiveHeading}
            isNavigating={isNavigating && !arrived}
            followCamera={followCamera}
            isCardCollapsed={cardCollapsed}
            routeFitKey={routeFitKey}
            darkMode={darkMode || nightWalkMode}
            nightWalkMode={nightWalkMode}
            radarRadiusMeters={radarOpen ? radarRadiusMeters : null}
            focusKey={focusKey}
            recenterKey={recenterKey}
            routeCoordinates={
              isNavigating && activeRoute ? activeRoute.coordinates : null
            }
            routeType={activeRoute?.routeType ?? "mapped"}
            pickMode={pickOnMapMode}
            adminDragMode={isCloudAdmin && adminDragMode}
            pickBannerText={
              adminFormMode === "edit" && formName
                ? `Click map to move "${formName}"`
                : "Click anywhere on the map to set coordinates"
            }
            pickedCoordinate={pickedPreviewCoord}
            onSelectPlace={(p) => selectPlace(p, true)}
            onPickCoordinate={handlePickCoordinate}
            onDragPinEnd={(place, coord) => void handleDragPinEnd(place, coord)}
            onCancelPick={() => {
              setPickOnMapMode(false);
              setAdminOpen(true);
            }}
            onRecenter={() => {
              setFollowCamera(false);
              setRecenterKey((k) => k + 1);
            }}
            onUserPanMap={() => setFollowCamera(false)}
            onFollowCamera={() => {
              void requestCompassPermission();
              setMapStyle("satellite");
              if (startSourceId === "gps") {
                setIsFollowingGps(true);
              }
              setFollowCamera(true);
            }}
            onFitRoute={() => {
              setFollowCamera(false);
              setRouteFitKey((k) => k + 1);
            }}
          />
        )}

        {/* Map Style Switcher, Mobile Tools & Admin Drag Pin Toggle */}
        <div className="map-toolbar-top">
          <div className="map-style-switch" role="group" aria-label="Map layer style">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setMapStyle("schematic");
              }}
              className={`map-style-btn${mapStyle === "schematic" ? " active" : ""}`}
            >
              <Layers size={13} />
              <span>Schematic</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setMapStyle("street");
              }}
              className={`map-style-btn${mapStyle === "street" ? " active" : ""}`}
            >
              <MapIcon size={13} />
              <span>Street</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setMapStyle("satellite");
              }}
              className={`map-style-btn${mapStyle === "satellite" ? " active" : ""}`}
            >
              <Globe size={13} />
              <span>Satellite</span>
            </button>
          </div>

          <div className="mobile-map-tools" aria-label="Quick campus tools">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setRadarOpen(true);
              }}
              className={`campus-tool-btn${radarOpen ? " is-active" : ""}`}
            >
              <Radar size={13} />
              <span>Near</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("step");
                setNightWalkMode((prev) => !prev);
              }}
              className={`campus-tool-btn${nightWalkMode ? " is-night-active" : ""}`}
            >
              <ShieldAlert size={13} />
              <span>Night</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("tap");
                setOfflineModalOpen(true);
              }}
              className={`campus-tool-btn${offlinePreviewMode || !isOnline ? " is-active" : ""}`}
            >
              <WifiOff size={13} />
              <span>Offline</span>
            </button>
          </div>

          {isCloudAdmin && !pickOnMapMode ? (
            <button
              type="button"
              onClick={() => setAdminDragMode((prev) => !prev)}
              className={`drag-mode-toggle${adminDragMode ? " is-active" : ""}`}
              title="Drag any pin directly on the map to save new coordinates"
            >
              <Move size={14} />
              <span>{adminDragMode ? "Done Dragging Pins" : "Drag Pins"}</span>
            </button>
          ) : null}
        </div>

        {/* Mobile Compact Top Header */}
        <div className="mobile-top-overlay">
          <div className="mobile-bar">
            <span className="mobile-brand">EYE-CU</span>
            <div className="mobile-bar-actions">
              <PWAInstallButton compact />
              <button
                type="button"
                aria-label="Contact EYE-CU customer support"
                title="Contact Us"
                onClick={openContactModal}
                className="theme-toggle-btn"
              >
                <Headphones size={16} />
              </button>
              <button
                type="button"
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                onClick={() => setDarkMode((prev) => !prev)}
                className="theme-toggle-btn"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                type="button"
                onClick={() => setMobileDirectoryOpen((v) => !v)}
                className="mobile-places-btn"
              >
                <List size={15} />
                <span>
                  {mobileDirectoryOpen
                    ? "Show Map"
                    : `Places (${visiblePlaces.length})`}
                </span>
              </button>
              <button
                type="button"
                aria-label="Open admin section"
                onClick={() => setAdminOpen(true)}
                className={`admin-trigger mobile-admin-trigger${isCloudAdmin ? " is-signed-in" : ""}`}
              >
                <ShieldCheck size={15} />
                <span className="mobile-admin-label">Admin</span>
              </button>
            </div>
          </div>
        </div>

        {arrivalBanner || locationMessage ? (
          <div
            className={`map-top-toast${arrivalBanner ? " is-arrival" : ""}`}
            role="status"
          >
            <span style={{ flex: 1 }}>
              {arrivalBanner || locationMessage}
            </span>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => {
                setArrivalBanner(null);
                setLocationMessage(null);
              }}
              className="clear-btn"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {/* Smart Floating HUD Banner (Night-Walk Safety Mode) */}
        {nightWalkMode ? (
          <div className="map-hud-banners">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="hud-alert-banner is-night"
            >
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <div className="hud-alert-copy">
                <strong>Night-Walk Safety Active</strong>
                <span>Lit walkways, Clinic & Security Gate highlighted</span>
              </div>
              <button
                type="button"
                onClick={() => void handleShareNightWalk()}
                className="hud-alert-cta"
              >
                Share Live Walk
              </button>
              <button
                type="button"
                onClick={() => {
                  const clinic = findClinicPlace(allPlaces);
                  if (clinic) {
                    setQuery("");
                    setCategory("All");
                    setRouteStopIds([]);
                    selectPlace(clinic, true);
                    setIsNavigating(true);
                    setCardCollapsed(true);
                    setLocationMessage(`Night-Walk clinic route: ${clinic.name}`);
                  } else {
                    setLocationMessage(
                      "No clinic location found yet. Add a Clinic pin in Admin.",
                    );
                  }
                }}
                className="hud-alert-cta is-subtle"
              >
                Clinic
              </button>
            </motion.div>
          </div>
        ) : null}

        {/* Floating Place & In-App Walking Guidance Card */}
        {selectedPlace && !pickOnMapMode ? (
          <motion.section
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`place-card glass-hud${cardCollapsed ? " is-collapsed" : ""}`}
            aria-label="Selected place and walking guidance"
            style={
              !cardCollapsed && (cardTilt.rx !== 0 || cardTilt.ry !== 0)
                ? {
                    transform: `perspective(1000px) rotateX(${cardTilt.rx}deg) rotateY(${cardTilt.ry}deg)`,
                  }
                : undefined
            }
          >
            {cardCollapsed ? (
              <>
                <div className="collapsed-card-top">
                  <div className="collapsed-card-main">
                    <div
                      className="collapsed-card-icon"
                      style={{ backgroundColor: selectedBg, color: selectedColor }}
                    >
                      <CategoryIcon category={selectedPlace.category} size={17} />
                    </div>
                    <div className="collapsed-card-copy">
                      <h2 className="collapsed-card-title">{selectedPlace.name}</h2>
                      <p className="collapsed-card-sub tabular-nums">
                        {isNavigating && activeRoute
                          ? arrived
                            ? "Arrived at destination"
                            : `${formatDistance(activeRoute.distanceMeters)} · ${estimateWalkingMinutes(activeRoute.distanceMeters)} min walk`
                          : `${selectedPlace.category}${selectedPlace.isIndoor ? ` · ${selectedPlace.parentBuildingName || "Indoor"}` : ""}${selectedOpenStatus ? ` · ${selectedOpenStatus.label}` : ""}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Expand place details"
                    title="Expand full details & steps"
                    onClick={() => setCardCollapsed(false)}
                    className="card-collapse-pill"
                    data-testid="toggle-place-card"
                  >
                    <ChevronUp size={15} />
                    <span>Expand</span>
                  </button>
                </div>

                {isNavigating && activeRoute && !arrived && activeRoute.steps[0] ? (
                  <div className="collapsed-next-strip">
                    <span className="collapsed-next-text">
                      <Navigation size={12} color="#1A73E8" style={{ flexShrink: 0 }} />
                      <span>Next: {activeRoute.steps[0].instruction}</span>
                    </span>
                    {activeRoute.steps[0].distanceMeters > 0 ? (
                      <span className="walk-next-dist tabular-nums">
                        {formatDistance(activeRoute.steps[0].distanceMeters)}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="collapsed-actions-bar">
                  {!isNavigating ? (
                    <button
                      type="button"
                      onClick={startWalkingNavigation}
                      className="collapsed-action-btn is-primary"
                    >
                      <Navigation size={14} />
                      <span>Walk Here</span>
                    </button>
                  ) : (
                    <>
                      {!arrived ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void requestCompassPermission();
                              setMapStyle("satellite");
                              if (startSourceId === "gps") {
                                setIsFollowingGps(true);
                              }
                              setFollowCamera(true);
                            }}
                            className={`collapsed-action-btn${followCamera && mapStyle === "satellite" ? " is-active" : ""}`}
                          >
                            <Compass size={13} />
                            <span>Follow Me</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFollowCamera(false);
                              if (mapStyle === "schematic") {
                                setMapStyle("satellite");
                              }
                              setRouteFitKey((k) => k + 1);
                            }}
                            className="collapsed-action-btn"
                          >
                            <Route size={13} />
                            <span>Full Route</span>
                          </button>
                        </>
                      ) : null}

                      {selectedPlace.isIndoor &&
                      selectedPlace.indoorSteps &&
                      selectedPlace.indoorSteps.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => openIndoorGuide(selectedPlace)}
                          className="collapsed-action-btn indoor-cta"
                          data-testid="start-indoor-guide"
                        >
                          <Building2 size={14} />
                          <span>Indoor Guide</span>
                        </button>
                      ) : null}

                      {!arrived ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArrived(true);
                            setIsFollowingGps(false);
                            setFollowCamera(false);
                            if (
                              selectedPlace.isIndoor &&
                              selectedPlace.indoorSteps?.length
                            ) {
                              autoTriggeredIndoorRef.current = selectedPlace.id;
                              openIndoorGuide(selectedPlace);
                              setArrivalBanner(
                                `Reached ${selectedPlace.parentBuildingName || selectedPlace.name}! Indoor guide opened.`,
                              );
                            } else {
                              setArrivalBanner(
                                `You have arrived at ${selectedPlace.name}!`,
                              );
                            }
                          }}
                          className="collapsed-action-btn is-primary"
                        >
                          <CheckCircle2 size={14} />
                          <span>Arrived</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          setIsNavigating(false);
                          setIsFollowingGps(false);
                          setFollowCamera(false);
                          setCardCollapsed(false);
                          autoTriggeredIndoorRef.current = null;
                          setArrived(false);
                          setArrivalBanner(null);
                        }}
                        className="collapsed-action-btn is-stop"
                      >
                        <X size={14} />
                        <span>Stop</span>
                      </button>
                    </>
                  )}

                  {!isNavigating &&
                  selectedPlace.isIndoor &&
                  selectedPlace.indoorSteps &&
                  selectedPlace.indoorSteps.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openIndoorGuide(selectedPlace)}
                      className="collapsed-action-btn indoor-cta"
                      data-testid="start-indoor-guide"
                    >
                      <Building2 size={14} />
                      <span>Indoor Guide</span>
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="card-photo-banner"
                  onClick={() => {
                    triggerHaptic("tap");
                    setPhotoLightboxOpen(true);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width - 0.5;
                    const y = (e.clientY - rect.top) / rect.height - 0.5;
                    setCardTilt({
                      rx: Number((-y * 4.5).toFixed(2)),
                      ry: Number((x * 5.5).toFixed(2)),
                    });
                  }}
                  onMouseLeave={() => setCardTilt({ rx: 0, ry: 0 })}
                  aria-label={`View full photo of ${selectedPlace.name}`}
                >
                  <img
                    src={getPlaceImageUrl(selectedPlace)}
                    alt={selectedPlace.name}
                    className="card-photo-img"
                    loading="lazy"
                    onError={(e) => {
                      const fallback = DEFAULT_CATEGORY_IMAGES[selectedPlace.category];
                      if (!e.currentTarget.src.endsWith(fallback)) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <div className="card-photo-caption">
                    <span className="card-photo-tag">
                      <ImageIcon size={12} />
                      <span>
                        {selectedPlace.imageUrl
                          ? "Place Photo"
                          : `${selectedPlace.category} Preview`}
                      </span>
                    </span>
                    <span className="card-photo-tag">
                      <Maximize2 size={12} />
                    </span>
                  </div>
                </button>

                <div className="place-card-header">
                  <div
                    className="card-icon"
                    style={{ backgroundColor: selectedBg, color: selectedColor }}
                  >
                    <CategoryIcon category={selectedPlace.category} size={20} />
                  </div>
                  <div className="card-copy">
                    <div className="card-meta-line">
                      <span style={{ color: selectedColor }}>
                        {selectedPlace.category}
                      </span>
                      {selectedOpenStatus ? (
                        <span
                          className={`card-open-status is-${selectedOpenStatus.tone}`}
                        >
                          {selectedOpenStatus.label}
                        </span>
                      ) : null}
                      {selectedPlace.isIndoor ? (
                        <span className="card-indoor-tag">
                          <Building2 size={11} />
                          <span>
                            {selectedPlace.parentBuildingName
                              ? `Inside ${selectedPlace.parentBuildingName}`
                              : "Indoor Location"}
                            {selectedPlace.indoorSteps?.length
                              ? ` · ${selectedPlace.indoorSteps.length} steps`
                              : ""}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <h2 className="card-title">{selectedPlace.name}</h2>
                    <p className="card-subtitle">{selectedPlace.note}</p>
                    {selectedPlace.roomsOrDetails ? (
                      <p className="card-details-line">
                        {selectedPlace.roomsOrDetails}
                      </p>
                    ) : null}
                  </div>
                  <div className="card-icon-actions">
                    <button
                      type="button"
                      aria-label="Collapse place details"
                      title="Collapse card to view more map"
                      onClick={() => {
                        triggerHaptic("tap");
                        setCardCollapsed(true);
                      }}
                      className="card-action-icon-btn"
                      data-testid="toggle-place-card"
                    >
                      <ChevronDown size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Copy place coordinates"
                      title="Copy coordinates"
                      onClick={() => void handleCopyCoordinates(selectedPlace)}
                      className="card-action-icon-btn"
                    >
                      {copiedCoords ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      type="button"
                      aria-label={
                        savedIds.includes(selectedPlace.id)
                          ? "Remove from saved places"
                          : "Save place"
                      }
                      onClick={() => {
                        triggerHaptic("tap");
                        toggleSaved(selectedPlace.id);
                      }}
                      className={`card-action-icon-btn${savedIds.includes(selectedPlace.id) ? " is-saved" : ""}`}
                    >
                      <Star
                        size={17}
                        fill={
                          savedIds.includes(selectedPlace.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Report an issue with ${selectedPlace.name}`}
                      title="Report wrong pin or place issue"
                      onClick={openReportModal}
                      className="card-report-btn"
                      data-testid="report-place-btn"
                    >
                      <AlertTriangle size={17} />
                    </button>
                  </div>
                </div>

                {routeStopIds.length > 0 ? (
                  <div className="multi-stop-strip" aria-label="Multi-stop route itinerary">
                    <div className="multi-stop-header">
                      <span>
                        <Route
                          size={12}
                          style={{ verticalAlign: "middle", marginRight: 4 }}
                        />
                        Multi-Stop Route ({routeStopIds.length}/4)
                      </span>
                      <button
                        type="button"
                        onClick={() => setRouteStopIds([])}
                        className="multi-stop-clear"
                      >
                        Clear stops
                      </button>
                    </div>
                    <div className="multi-stop-list">
                      {routeStopIds.map((stopId, idx) => {
                        const stopPlace = allPlaces.find((p) => p.id === stopId);
                        if (!stopPlace) return null;
                        return (
                          <span key={`stop-${stopId}`} className="stop-chip">
                            <strong className="tabular-nums">{idx + 1}.</strong>
                            <span>{stopPlace.name}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${stopPlace.name} stop`}
                              onClick={() => toggleStopInRoute(stopId)}
                              className="stop-chip-remove"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {isNavigating && activeRoute ? (
                  <div className="walk-guidance-box">
                    <div className="walk-guidance-top">
                      <div className="walk-metrics">
                        <span className="walk-distance tabular-nums">
                          {arrived
                            ? "Arrived"
                            : formatDistance(activeRoute.distanceMeters)}
                        </span>
                        {!arrived ? (
                          <span className="walk-eta tabular-nums">
                            {estimateWalkingMinutes(activeRoute.distanceMeters)} min
                            walk
                          </span>
                        ) : null}
                      </div>
                      <span className="walk-status-text">
                        {arrived
                          ? "Destination reached"
                          : activeRoute.routeType === "mapped"
                            ? "Mapped walkway route"
                            : "Direct campus estimate"}
                      </span>
                    </div>

                    {!arrived && activeRoute.steps[0] ? (
                      <div className="walk-next-banner">
                        <span className="walk-next-label">
                          <Navigation size={13} color="#1A73E8" />
                          <span>Next: {activeRoute.steps[0].instruction}</span>
                        </span>
                        {activeRoute.steps[0].distanceMeters > 0 ? (
                          <span className="walk-next-dist tabular-nums">
                            {formatDistance(activeRoute.steps[0].distanceMeters)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {!arrived ? (
                      <div className="walk-camera-pills">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("tap");
                            void requestCompassPermission();
                            setMapStyle("satellite");
                            if (startSourceId === "gps") {
                              setIsFollowingGps(true);
                            }
                            setFollowCamera(true);
                          }}
                          className={`walk-camera-pill${followCamera && mapStyle === "satellite" ? " is-active" : ""}`}
                        >
                          <Compass size={13} />
                          <span>Follow Me (19x)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("tap");
                            setFollowCamera(false);
                            if (mapStyle === "schematic") {
                              setMapStyle("satellite");
                            }
                            setRouteFitKey((k) => k + 1);
                          }}
                          className="walk-camera-pill"
                        >
                          <Route size={13} />
                          <span>Full Route</span>
                        </button>
                      </div>
                    ) : null}

                    {!arrived && activeRoute.steps.length > 0 ? (
                      <ol className="walk-steps-list">
                        {activeRoute.steps.map((step, index) => (
                          <li key={index} className="walk-step-item">
                            <span>
                              {index + 1}. {step.instruction}
                            </span>
                            {step.distanceMeters > 0 ? (
                              <span className="walk-step-dist tabular-nums">
                                {formatDistance(step.distanceMeters)}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}

                    <div className="gps-origin-row">
                      <span>
                        From:{" "}
                        <strong>
                          {startSourceId === "gps" && gpsCoordinate
                            ? "My Live GPS Location"
                            : allPlaces.find((p) => p.id === startSourceId)?.name ||
                              "Central University Gate"}
                        </strong>
                      </span>
                      {startSourceId !== "gps" || !gpsCoordinate ? (
                        <button
                          type="button"
                          onClick={() => void requestUserGps()}
                          disabled={isLocating}
                          className="gps-enable-inline"
                        >
                          {isLocating ? "Locating…" : "Use my current location"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="card-actions-row">
                  {!isNavigating ? (
                    <button
                      type="button"
                      onClick={startWalkingNavigation}
                      className="primary-cta"
                    >
                      <Navigation size={15} />
                      <span>Walk Here</span>
                    </button>
                  ) : (
                    <>
                      {!arrived ? (
                        <button
                          type="button"
                          onClick={() => {
                            setArrived(true);
                            setIsFollowingGps(false);
                            setFollowCamera(false);
                            if (
                              selectedPlace.isIndoor &&
                              selectedPlace.indoorSteps?.length
                            ) {
                              autoTriggeredIndoorRef.current = selectedPlace.id;
                              openIndoorGuide(selectedPlace);
                              setArrivalBanner(
                                `Reached ${selectedPlace.parentBuildingName || selectedPlace.name}! Indoor guide opened.`,
                              );
                            } else {
                              setArrivalBanner(
                                `You have arrived at ${selectedPlace.name}!`,
                              );
                            }
                          }}
                          className="primary-cta"
                        >
                          <CheckCircle2 size={15} />
                          <span>Mark Arrived</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setIsNavigating(false);
                          setIsFollowingGps(false);
                          setFollowCamera(false);
                          setCardCollapsed(false);
                          autoTriggeredIndoorRef.current = null;
                          setArrived(false);
                          setArrivalBanner(null);
                        }}
                        className="primary-cta is-stop"
                      >
                        <X size={15} />
                        <span>Stop Walk</span>
                      </button>
                    </>
                  )}

                  {selectedPlace.isIndoor &&
                  selectedPlace.indoorSteps &&
                  selectedPlace.indoorSteps.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openIndoorGuide(selectedPlace)}
                      className="secondary-cta indoor-cta"
                      data-testid="start-indoor-guide"
                    >
                      <Building2 size={15} />
                      <span>Start Indoor Guide</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => toggleStopInRoute(selectedPlace.id)}
                    className="secondary-cta"
                    title="Add or remove this place from a multi-stop campus walk"
                  >
                    <Route size={14} />
                    <span>
                      {routeStopIds.includes(selectedPlace.id)
                        ? "Remove Stop"
                        : "+ Add Stop"}
                    </span>
                  </button>

                  {isCloudAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openAdminForEdit(selectedPlace)}
                        className="secondary-cta"
                        data-testid="edit-selected-pin"
                      >
                        <Pencil size={14} />
                        <span>Edit Pin</span>
                      </button>
                      {customPlaceIdSet.has(selectedPlace.id) ? (
                        <button
                          type="button"
                          onClick={() => {
                            openAdminForEdit(selectedPlace);
                            setConfirmDeleteId(selectedPlace.id);
                          }}
                          className="secondary-cta is-danger-outline"
                          data-testid="delete-selected-pin"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      ) : null}
                    </>
                  ) : null}

                  <a
                    href={googleDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="secondary-cta"
                  >
                    <ExternalLink size={15} />
                    <span>Google Maps</span>
                  </a>
                </div>

                <div className="card-footer-meta">
                  <span>{OSM_ATTRIBUTION}</span>
                  <span className="tabular-nums">
                    {selectedPlace.latitude.toFixed(5)},{" "}
                    {selectedPlace.longitude.toFixed(5)}
                  </span>
                </div>
              </>
            )}
          </motion.section>
        ) : null}
      </main>

      {/* Protected Cloud Admin Modal */}
      {adminOpen ? (
        <div
          className="admin-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdminOpen(false);
          }}
        >
          <section className="admin-modal" aria-label="EYE-CU Place Administration">
            <div className="admin-modal-head">
              <div>
                <p className="admin-modal-kicker">
                  EYE-CU · Live Cloud Administration
                </p>
                <h2 className="admin-modal-title">
                  {isCloudAdmin
                    ? adminFormMode === "edit"
                      ? "Edit Campus Pin"
                      : "Add Campus Place"
                    : "Admin Sign In"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close admin panel"
                onClick={() => setAdminOpen(false)}
                className="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            {authChecking ? (
              <div className="admin-info-box">
                <Loader2 size={16} className="spin" />
                <span>Checking administrator session…</span>
              </div>
            ) : !isCloudAdmin ? (
              <>
                <div className="admin-info-box">
                  <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Sign in with Google to add new campus places, reposition
                    pins on the map, or update building hours live in Cloud
                    Firestore.
                  </span>
                </div>

                {authError ? <div className="form-error">{authError}</div> : null}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={() => void handleGoogleAdminSignIn()}
                    className="primary-cta"
                  >
                    {authLoading ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    <span>Sign In with Google (Cloud Admin)</span>
                  </button>
                  {authUser ? (
                    <button
                      type="button"
                      onClick={() => void signOutCloudAdmin()}
                      className="signout-btn"
                    >
                      Switch Account
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="admin-mode-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminFormMode === "add"}
                    onClick={openAdminForAdd}
                    className={`admin-mode-tab${adminFormMode === "add" ? " active" : ""}`}
                  >
                    + Add New Place
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={adminFormMode === "edit"}
                    onClick={() => openAdminForEdit(selectedPlace)}
                    className={`admin-mode-tab${adminFormMode === "edit" ? " active" : ""}`}
                  >
                    Edit Existing Pin
                  </button>
                </div>

                <div className="admin-info-box">
                  <MapIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Signed in as <strong>{authUser?.email}</strong>. Changes save
                    live to Cloud Firestore for all EYE-CU users.
                  </span>
                </div>

                {adminFormMode === "edit" ? (
                  <div className="field-group" style={{ marginBottom: 12 }}>
                    <label htmlFor="edit-target-select" className="field-label">
                      Select Place to Edit
                    </label>
                    <select
                      id="edit-target-select"
                      value={editingPlaceId ?? selectedPlace.id}
                      onChange={(e) => {
                        const target = allPlaces.find(
                          (p) => p.id === e.target.value,
                        );
                        if (target) openAdminForEdit(target);
                      }}
                      className="field-select"
                    >
                      {allPlaces.map((place) => (
                        <option key={place.id} value={place.id}>
                          {place.name} ({place.category})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <form className="admin-form" onSubmit={handleSubmitPlaceForm}>
                  <div className="field-group">
                    <label htmlFor="place-name" className="field-label">
                      Place Name
                    </label>
                    <input
                      id="place-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Block A - Central University"
                      required
                      className="field-input"
                    />
                  </div>

                  <div className="coord-grid">
                    <div className="field-group">
                      <label htmlFor="place-category" className="field-label">
                        Category
                      </label>
                      <select
                        id="place-category"
                        value={formCategory}
                        onChange={(e) =>
                          setFormCategory(e.target.value as PlaceCategory)
                        }
                        className="field-select"
                      >
                        {PLACE_CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-group">
                      <label htmlFor="place-hours" className="field-label">
                        Opening Hours
                      </label>
                      <input
                        id="place-hours"
                        type="text"
                        value={formHours}
                        onChange={(e) => setFormHours(e.target.value)}
                        placeholder="7:30 AM – 6:00 PM"
                        className="field-input"
                      />
                    </div>
                  </div>

                  <div className="coord-grid">
                    <div className="field-group">
                      <label htmlFor="place-lat" className="field-label">
                        Latitude
                      </label>
                      <input
                        id="place-lat"
                        type="number"
                        step="any"
                        value={formLat}
                        onChange={(e) => setFormLat(e.target.value)}
                        placeholder="5.769249"
                        required
                        className="field-input tabular-nums"
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="place-lon" className="field-label">
                        Longitude
                      </label>
                      <input
                        id="place-lon"
                        type="number"
                        step="any"
                        value={formLon}
                        onChange={(e) => setFormLon(e.target.value)}
                        placeholder="0.083408"
                        required
                        className="field-input tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="admin-tools-grid is-three">
                    <button
                      type="button"
                      onClick={handlePinAdminCurrentGps}
                      disabled={locatingAdminGps}
                      className="pick-map-btn is-gps-pin"
                      data-testid="admin-pin-gps-btn"
                    >
                      {locatingAdminGps ? (
                        <Loader2 size={15} className="spin" />
                      ) : (
                        <Crosshair size={15} />
                      )}
                      <span>
                        {locatingAdminGps ? "Locating…" : "Pin My GPS"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickOnMapMode(true);
                        setAdminOpen(false);
                      }}
                      className="pick-map-btn"
                    >
                      <MapPin size={15} />
                      <span>
                        {adminFormMode === "edit"
                          ? "Click Map"
                          : "Pick on Map"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminDragMode(true);
                        setAdminOpen(false);
                        setLocationMessage(
                          "Drag any marker on Schematic or Satellite map to reposition & save live.",
                        );
                      }}
                      className="pick-map-btn"
                    >
                      <Move size={15} />
                      <span>Drag Pins</span>
                    </button>
                  </div>

                  <div className="coord-grid">
                    <div className="field-group">
                      <label htmlFor="place-days" className="field-label">
                        Operating Days
                      </label>
                      <input
                        id="place-days"
                        type="text"
                        value={formOpenDays}
                        onChange={(e) => setFormOpenDays(e.target.value)}
                        placeholder="Mon–Sat, Daily, 24/7"
                        className="field-input"
                      />
                    </div>
                    <div className="field-group">
                      <label htmlFor="place-details" className="field-label">
                        Rooms / Access Details
                      </label>
                      <input
                        id="place-details"
                        type="text"
                        value={formDetails}
                        onChange={(e) => setFormDetails(e.target.value)}
                        placeholder="Rooms A1–A10 · Ramp"
                        className="field-input"
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="place-image-url" className="field-label">
                      Place Photo URL (optional)
                    </label>
                    <input
                      id="place-image-url"
                      type="url"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://... (leave blank to use category photo)"
                      className="field-input"
                    />
                  </div>

                  <div className="field-group">
                    <label htmlFor="place-note" className="field-label">
                      Note (optional)
                    </label>
                    <input
                      id="place-note"
                      type="text"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="e.g. Verified main entrance pin"
                      className="field-input"
                    />
                  </div>

                  <IndoorStepBuilder
                    isIndoor={formIsIndoor}
                    onToggleIndoor={setFormIsIndoor}
                    parentBuildingName={formParentBuilding}
                    onChangeParentBuildingName={setFormParentBuilding}
                    steps={formIndoorSteps}
                    onChangeSteps={setFormIndoorSteps}
                    buildingSuggestions={allPlaces
                      .filter((p) => !p.isIndoor)
                      .map((p) => p.name)}
                  />

                  {placeFormError ? (
                    <div className="form-error">{placeFormError}</div>
                  ) : null}
                  {placeFormSuccess ? (
                    <div className="form-success">{placeFormSuccess}</div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={savingPlace || deletingPlaceId !== null}
                    className="primary-cta"
                  >
                    {savingPlace ? (
                      <Loader2 size={16} className="spin" />
                    ) : adminFormMode === "edit" ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>
                      {adminFormMode === "edit"
                        ? "Save Updated Pin Live"
                        : "Add Place Live"}
                    </span>
                  </button>

                  {adminFormMode === "edit" && editingPlaceId ? (
                    !SEED_ID_SET.has(editingPlaceId) ? (
                      confirmDeleteId === editingPlaceId ? (
                        <div className="delete-confirm-box" role="alert">
                          <span>
                            Delete <strong>{formName || "this location"}</strong> permanently?
                          </span>
                          <div className="delete-confirm-actions">
                            <button
                              type="button"
                              disabled={deletingPlaceId === editingPlaceId}
                              onClick={() =>
                                void handleDeleteOrResetPlace(editingPlaceId)
                              }
                              className="danger-cta is-compact"
                              data-testid="confirm-delete-place-btn"
                            >
                              {deletingPlaceId === editingPlaceId ? (
                                <Loader2 size={14} className="spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                              <span>Confirm Delete</span>
                            </button>
                            <button
                              type="button"
                              disabled={deletingPlaceId === editingPlaceId}
                              onClick={() => setConfirmDeleteId(null)}
                              className="json-mini-btn"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={savingPlace || deletingPlaceId !== null}
                          onClick={() => setConfirmDeleteId(editingPlaceId)}
                          className="danger-cta"
                          data-testid="delete-place-form-btn"
                        >
                          <Trash2 size={15} />
                          <span>Delete This Place</span>
                        </button>
                      )
                    ) : overrideMap.has(editingPlaceId) ? (
                      <button
                        type="button"
                        disabled={savingPlace || deletingPlaceId !== null}
                        onClick={() =>
                          void handleDeleteOrResetPlace(editingPlaceId)
                        }
                        className="secondary-cta"
                        data-testid="reset-seed-form-btn"
                      >
                        <RotateCcw size={15} />
                        <span>Reset Pin to Default Coordinates</span>
                      </button>
                    ) : null
                  ) : null}
                </form>

                <div className="custom-places-section">
                  <div className="custom-places-header">
                    <h3 className="custom-places-title">
                      All Campus Places ({allPlaces.length})
                    </h3>
                    <div className="json-actions-row">
                      <button
                        type="button"
                        onClick={handleExportJson}
                        className="json-mini-btn"
                      >
                        <Download size={12} />
                        <span>Export JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => importInputRef.current?.click()}
                        className="json-mini-btn"
                      >
                        <Upload size={12} />
                        <span>Import JSON</span>
                      </button>
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => void handleImportJsonFile(e)}
                        style={{ display: "none" }}
                      />
                    </div>
                  </div>

                  <input
                    type="search"
                    value={manageQuery}
                    onChange={(e) => setManageQuery(e.target.value)}
                    placeholder="Filter places to edit or delete…"
                    aria-label="Filter campus places in admin list"
                    className="field-input manage-search-input"
                  />

                  <div className="manage-list">
                    {[...allPlaces]
                      .sort((a, b) => {
                        const aCustom = customPlaceIdSet.has(a.id) ? 0 : overrideMap.has(a.id) ? 1 : 2;
                        const bCustom = customPlaceIdSet.has(b.id) ? 0 : overrideMap.has(b.id) ? 1 : 2;
                        if (aCustom !== bCustom) return aCustom - bCustom;
                        return a.name.localeCompare(b.name);
                      })
                      .filter((place) => {
                        const mq = manageQuery.trim().toLowerCase();
                        if (!mq) return true;
                        return `${place.name} ${place.category}`.toLowerCase().includes(mq);
                      })
                      .map((place) => {
                        const isCustom = customPlaceIdSet.has(place.id);
                        const isOverridden = overrideMap.has(place.id);
                        const isConfirming = confirmDeleteId === place.id;
                        const isDeleting = deletingPlaceId === place.id;

                        return (
                          <div key={place.id} className="custom-place-item">
                            <div className="custom-place-info">
                              <div className="custom-place-name">
                                {place.name}
                                {isCustom ? (
                                  <span className="custom-place-badge">Added</span>
                                ) : isOverridden ? (
                                  <span className="custom-place-badge is-edited">Edited</span>
                                ) : null}
                              </div>
                              <div className="custom-place-coords tabular-nums">
                                {place.category} · {place.latitude.toFixed(5)},{" "}
                                {place.longitude.toFixed(5)}
                              </div>
                            </div>
                            <div className="manage-row-actions">
                              {isConfirming ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() =>
                                      void handleDeleteOrResetPlace(place.id)
                                    }
                                    className="delete-place-btn has-label is-confirming"
                                  >
                                    {isDeleting ? (
                                      <Loader2 size={12} className="spin" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                    <span>Confirm</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="json-mini-btn"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openAdminForEdit(place)}
                                    className="edit-place-btn"
                                  >
                                    <Pencil size={12} />
                                    <span>Edit</span>
                                  </button>
                                  {isCustom ? (
                                    <button
                                      type="button"
                                      aria-label={`Delete ${place.name}`}
                                      title="Delete added place"
                                      onClick={() => setConfirmDeleteId(place.id)}
                                      className="delete-place-btn has-label"
                                    >
                                      <Trash2 size={13} />
                                      <span>Delete</span>
                                    </button>
                                  ) : isOverridden ? (
                                    <button
                                      type="button"
                                      aria-label={`Reset ${place.name} pin`}
                                      title="Reset to default coordinates"
                                      onClick={() =>
                                        void handleDeleteOrResetPlace(place.id)
                                      }
                                      className="delete-place-btn has-label"
                                    >
                                      <RotateCcw size={13} />
                                      <span>Reset</span>
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="custom-places-section">
                  <div className="custom-places-header">
                    <h3 className="custom-places-title">
                      Formspree Inbox (Contact Us & ⚠️ Reports)
                    </h3>
                  </div>
                  <form
                    className="admin-form"
                    onSubmit={(e) => void handleSaveFormspreeSetting(e)}
                  >
                    <div className="field-group">
                      <label htmlFor="formspree-endpoint" className="field-label">
                        Formspree Form Endpoint URL
                      </label>
                      <input
                        id="formspree-endpoint"
                        type="url"
                        value={formspreeDraft}
                        onChange={(e) => setFormspreeDraft(e.target.value)}
                        placeholder="https://formspree.io/f/yourFormId"
                        className="field-input"
                      />
                    </div>
                    {formspreeError ? (
                      <div className="form-error">{formspreeError}</div>
                    ) : null}
                    {formspreeStatus ? (
                      <div className="form-success">{formspreeStatus}</div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={savingFormspree}
                      className="secondary-cta"
                    >
                      {savingFormspree ? (
                        <Loader2 size={14} className="spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Save Formspree Endpoint</span>
                    </button>
                  </form>
                </div>

                <div className="admin-footer-row">
                  <span style={{ fontSize: 12, color: "var(--muted-fg)" }}>
                    {customPlaceIdSet.size} added · {overrideMap.size} edited in
                    cloud
                  </span>
                  <button
                    type="button"
                    onClick={() => void signOutCloudAdmin()}
                    className="signout-btn"
                  >
                    <LogOut
                      size={13}
                      style={{ verticalAlign: "middle", marginRight: 5 }}
                    />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {/* Full Place Photo Lightbox Modal */}
      {photoLightboxOpen && selectedPlace ? (
        <div
          className="admin-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPhotoLightboxOpen(false);
          }}
        >
          <section
            className="photo-lightbox-modal"
            aria-label={`${selectedPlace.name} photo preview`}
          >
            <img
              src={getPlaceImageUrl(selectedPlace)}
              alt={selectedPlace.name}
              className="photo-lightbox-img"
              onError={(e) => {
                const fallback = DEFAULT_CATEGORY_IMAGES[selectedPlace.category];
                if (!e.currentTarget.src.endsWith(fallback)) {
                  e.currentTarget.src = fallback;
                }
              }}
            />
            <div className="photo-lightbox-footer">
              <div>
                <p className="admin-modal-kicker" style={{ marginBottom: 2 }}>
                  {selectedPlace.category} · Central University Miotso
                </p>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {selectedPlace.name}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-fg)" }}>
                  {selectedPlace.note}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close photo preview"
                onClick={() => setPhotoLightboxOpen(false)}
                className="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* Red Warning Report Place Issue Modal */}
      {reportModalOpen && selectedPlace ? (
        <div
          className="admin-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportModalOpen(false);
          }}
        >
          <section
            className="admin-modal"
            aria-label={`Report an issue with ${selectedPlace.name}`}
          >
            <div className="admin-modal-head">
              <div>
                <p
                  className="admin-modal-kicker"
                  style={{ color: "var(--danger)" }}
                >
                  EYE-CU · Campus Map Feedback
                </p>
                <h2 className="admin-modal-title">Report Place Issue</h2>
              </div>
              <button
                type="button"
                aria-label="Close report form"
                onClick={() => setReportModalOpen(false)}
                className="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-info-box">
              <AlertTriangle
                size={16}
                color="var(--danger)"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                Reporting <strong>{selectedPlace.name}</strong> (
                <span className="tabular-nums">
                  {selectedPlace.latitude.toFixed(5)},{" "}
                  {selectedPlace.longitude.toFixed(5)}
                </span>
                )
              </span>
            </div>

            <form
              className="admin-form"
              onSubmit={(e) => void handleSubmitReport(e)}
            >
              <div className="field-group">
                <label htmlFor="report-issue-type" className="field-label">
                  What needs fixing?
                </label>
                <select
                  id="report-issue-type"
                  value={reportIssueType}
                  onChange={(e) => setReportIssueType(e.target.value)}
                  className="field-select"
                >
                  <option value="Pin Location Is Inaccurate">
                    Pin Location Is Inaccurate
                  </option>
                  <option value="Wrong Opening Hours / Details">
                    Wrong Opening Hours / Details
                  </option>
                  <option value="Photo Does Not Match">
                    Photo Does Not Match
                  </option>
                  <option value="Place Closed or Moved">
                    Place Closed or Moved
                  </option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="report-email" className="field-label">
                  Your Email (optional)
                </label>
                <input
                  id="report-email"
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="student@central.edu.gh"
                  className="field-input"
                />
              </div>

              <div className="field-group">
                <label htmlFor="report-details" className="field-label">
                  Details
                </label>
                <textarea
                  id="report-details"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe where the real entrance is or what should be updated…"
                  className="field-textarea"
                />
              </div>

              {reportError ? (
                <div className="form-error">
                  {reportError}
                  {!activeFormspreeUrl && isCloudAdmin ? (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setReportModalOpen(false);
                          setAdminOpen(true);
                        }}
                        className="gps-enable-inline"
                      >
                        Open Admin to paste Formspree URL
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {reportSuccess ? (
                <div className="form-success">{reportSuccess}</div>
              ) : null}

              <button
                type="submit"
                disabled={reportSubmitting}
                className="primary-cta"
                style={{ backgroundColor: "var(--danger)", color: "#FFFFFF" }}
              >
                {reportSubmitting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Send size={15} />
                )}
                <span>Send Issue Report</span>
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {/* Customer Service Contact Us Modal (Formspree) */}
      {contactModalOpen ? (
        <div
          className="admin-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContactModalOpen(false);
          }}
        >
          <section className="admin-modal" aria-label="Contact EYE-CU support">
            <div className="admin-modal-head">
              <div>
                <p className="admin-modal-kicker">
                  EYE-CU · Customer Support
                </p>
                <h2 className="admin-modal-title">Contact Us</h2>
              </div>
              <button
                type="button"
                aria-label="Close contact form"
                onClick={() => setContactModalOpen(false)}
                className="close-modal-btn"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-info-box">
              <Headphones size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Need help finding a hall, want to suggest a missing spot on
                Central University Miotso campus, or have feedback on EYE-CU?
                Send us a message below.
              </span>
            </div>

            <form
              className="admin-form"
              onSubmit={(e) => void handleSubmitContact(e)}
            >
              <div className="coord-grid">
                <div className="field-group">
                  <label htmlFor="contact-name" className="field-label">
                    Your Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Kwame / Ama"
                    className="field-input"
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="contact-email" className="field-label">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@central.edu.gh"
                    required
                    className="field-input"
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="contact-topic" className="field-label">
                  Topic
                </label>
                <select
                  id="contact-topic"
                  value={contactTopic}
                  onChange={(e) => setContactTopic(e.target.value)}
                  className="field-select"
                >
                  <option value="General Question">General Question</option>
                  <option value="Suggest a New Campus Place">
                    Suggest a New Campus Place
                  </option>
                  <option value="Final Year Project / School Partnership">
                    Final Year Project / School Partnership
                  </option>
                  <option value="App Feedback or Bug">
                    App Feedback or Bug
                  </option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="contact-message" className="field-label">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Write your message for the EYE-CU team…"
                  required
                  className="field-textarea"
                />
              </div>

              {contactError ? (
                <div className="form-error">
                  {contactError}
                  {!activeFormspreeUrl && isCloudAdmin ? (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setContactModalOpen(false);
                          setAdminOpen(true);
                        }}
                        className="gps-enable-inline"
                      >
                        Open Admin to paste Formspree URL
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {contactSuccess ? (
                <div className="form-success">{contactSuccess}</div>
              ) : null}

              <button
                type="submit"
                disabled={contactSubmitting}
                className="primary-cta"
              >
                {contactSubmitting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Send size={15} />
                )}
                <span>Send Message</span>
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <AnimatePresence>
        {radarOpen ? (
          <ProximityRadarModal
            places={allPlaces}
            originCoordinate={originCoordinate}
            originLabel={
              startSourceId === "gps" && gpsCoordinate
                ? "Your Live GPS"
                : allPlaces.find((p) => p.id === startSourceId)?.name ||
                  "Campus Gate"
            }
            radiusMeters={radarRadiusMeters}
            onChangeRadius={setRadarRadiusMeters}
            onSelectPlace={(p) => selectPlace(p, true)}
            onSelectAndWalk={(p) => {
              selectPlace(p, true);
              setIsNavigating(true);
              setCardCollapsed(true);
              setMapStyle("satellite");
              setRouteFitKey((k) => k + 1);
            }}
            onClose={() => setRadarOpen(false)}
          />
        ) : null}

        {offlineModalOpen ? (
          <OfflineCampusModal
            places={allPlaces}
            isOnline={isOnline}
            offlinePreviewMode={offlinePreviewMode}
            onToggleOfflinePreview={setOfflinePreviewMode}
            onClose={() => setOfflineModalOpen(false)}
          />
        ) : null}

        {indoorGuidePlace ? (
          <IndoorGuideOverlay
            place={indoorGuidePlace}
            stepIndex={indoorStepIndex}
            onChangeStep={setIndoorStepIndex}
            onComplete={() => {
              const finishedName = indoorGuidePlace.name;
              setIndoorGuidePlace(null);
              setArrived(true);
              setIsFollowingGps(false);
              setFollowCamera(false);
              setArrivalBanner(`You have arrived inside ${finishedName}!`);
            }}
            onClose={() => setIndoorGuidePlace(null)}
          />
        ) : null}
      </AnimatePresence>

      <OfflineIndicator
        forcedOffline={offlinePreviewMode}
        onExitPreview={() => setOfflinePreviewMode(false)}
      />
    </div>
  );
}

export default App;
