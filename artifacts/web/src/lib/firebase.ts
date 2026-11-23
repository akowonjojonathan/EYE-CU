import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type FirestoreError,
} from "firebase/firestore";
import firebaseConfig from "../../../../firebase-applet-config.json";
import type { CampusPlace, PlaceCategory } from "@/constants/campus";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: "select_account" });

export const BOOTSTRAP_ADMIN_EMAIL = "akowonjonanayaw@gmail.com";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
    return false;
  }
}

void testConnection();

export function makeCampusPlaceId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug || "place"}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizePlacePayload(
  id: string,
  place: Omit<CampusPlace, "id"> & { id?: string },
  isSeedOverride: boolean,
  uid: string,
) {
  return {
    id,
    name: place.name.trim().slice(0, 100),
    category: place.category,
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    note: (place.note || "").trim().slice(0, 240),
    hours: (place.hours || "").trim().slice(0, 80),
    openDays: (place.openDays || "").trim().slice(0, 40),
    openHour:
      typeof place.openHour === "number" && Number.isFinite(place.openHour)
        ? place.openHour
        : -1,
    closeHour:
      typeof place.closeHour === "number" && Number.isFinite(place.closeHour)
        ? place.closeHour
        : -1,
    roomsOrDetails: (place.roomsOrDetails || "").trim().slice(0, 120),
    imageUrl: (place.imageUrl || "").trim().slice(0, 500),
    isSeedOverride,
    updatedBy: uid,
  };
}

function docToCampusPlace(id: string, data: Record<string, unknown>): CampusPlace | null {
  if (
    typeof data.name !== "string" ||
    typeof data.category !== "string" ||
    typeof data.latitude !== "number" ||
    typeof data.longitude !== "number"
  ) {
    return null;
  }
  return {
    id,
    name: data.name,
    category: data.category as PlaceCategory,
    latitude: data.latitude,
    longitude: data.longitude,
    note: typeof data.note === "string" ? data.note : "",
    hours: typeof data.hours === "string" && data.hours ? data.hours : undefined,
    openDays:
      typeof data.openDays === "string" && data.openDays ? data.openDays : undefined,
    openHour:
      typeof data.openHour === "number" && data.openHour >= 0
        ? data.openHour
        : undefined,
    closeHour:
      typeof data.closeHour === "number" && data.closeHour >= 0
        ? data.closeHour
        : undefined,
    roomsOrDetails:
      typeof data.roomsOrDetails === "string" && data.roomsOrDetails
        ? data.roomsOrDetails
        : undefined,
    imageUrl:
      typeof data.imageUrl === "string" && data.imageUrl
        ? data.imageUrl
        : undefined,
    isSeedOverride: Boolean(data.isSeedOverride),
  };
}

export function subscribeCampusPlaces(
  onData: (docs: CampusPlace[]) => void,
  onSyncError?: (message: string) => void,
): () => void {
  const path = "campus_places";
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: CampusPlace[] = [];
      snapshot.forEach((docSnap) => {
        const parsed = docToCampusPlace(
          docSnap.id,
          docSnap.data() as Record<string, unknown>,
        );
        if (parsed) items.push(parsed);
      });
      onData(items);
    },
    (error: FirestoreError) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onSyncError?.(
          wrapped instanceof Error ? wrapped.message : "Failed to sync campus places.",
        );
      }
    },
  );
}

export async function saveCampusPlaceToCloud(
  id: string,
  place: Omit<CampusPlace, "id">,
  isSeedOverride: boolean,
  user: User,
): Promise<CampusPlace> {
  const path = `campus_places/${id}`;
  const docRef = doc(db, "campus_places", id);
  const payload = normalizePlacePayload(id, place, isSeedOverride, user.uid);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        ...payload,
        createdAt: existingData.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...place,
      id,
      isSeedOverride,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCampusPlaceFromCloud(id: string): Promise<void> {
  const path = `campus_places/${id}`;
  try {
    await deleteDoc(doc(db, "campus_places", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importCampusPlacesToCloud(
  places: CampusPlace[],
  seedIds: Set<string>,
  user: User,
): Promise<number> {
  const path = "campus_places";
  try {
    const existingSnap = await getDocs(collection(db, path));
    const existingCreatedMap = new Map<string, unknown>();
    existingSnap.forEach((d) => {
      existingCreatedMap.set(d.id, d.data().createdAt);
    });

    let count = 0;
    const chunkSize = 400;
    for (let i = 0; i < places.length; i += chunkSize) {
      const batch = writeBatch(db);
      const slice = places.slice(i, i + chunkSize);
      for (const item of slice) {
        const cleanId = (item.id || makeCampusPlaceId(item.name)).replace(
          /[^a-zA-Z0-9_-]/g,
          "",
        );
        if (!cleanId) continue;
        const isOverride = seedIds.has(cleanId);
        const payload = normalizePlacePayload(cleanId, item, isOverride, user.uid);
        const existingCreated = existingCreatedMap.get(cleanId);
        batch.set(doc(db, path, cleanId), {
          ...payload,
          createdAt: existingCreated ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count += 1;
      }
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function checkIsCloudAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAP_ADMIN_EMAIL) return true;
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists() && snap.data()?.role === "admin";
  } catch {
    return false;
  }
}

export async function signInAdminWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleAuthProvider);
  return cred.user;
}

export async function signOutCloudAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribePublicSettings(
  onEndpoint: (endpoint: string) => void,
): () => void {
  const path = "app_settings/public";
  return onSnapshot(
    doc(db, "app_settings", "public"),
    (snap) => {
      if (snap.exists()) {
        const val = snap.data()?.formspreeEndpoint;
        onEndpoint(typeof val === "string" ? val : "");
      } else {
        onEndpoint("");
      }
    },
    (error) => {
      console.warn(`Settings read skipped (${path}):`, error.message);
    },
  );
}

export async function saveFormspreeEndpoint(
  endpoint: string,
  user: User,
): Promise<string> {
  const clean = endpoint.trim();
  if (
    clean !== "" &&
    !/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(clean)
  ) {
    throw new Error(
      "Enter a valid Formspree endpoint URL (e.g. https://formspree.io/f/yourFormId) or leave blank.",
    );
  }
  const path = "app_settings/public";
  try {
    await setDoc(doc(db, "app_settings", "public"), {
      formspreeEndpoint: clean,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
