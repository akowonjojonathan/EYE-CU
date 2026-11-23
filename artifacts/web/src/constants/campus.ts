export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type PlaceCategory =
  | "Campus"
  | "Academic"
  | "Food"
  | "Residence"
  | "Sports"
  | "Services";

export type CampusPlace = Coordinate & {
  id: string;
  name: string;
  category: PlaceCategory;
  note: string;
  hours?: string;
  openDays?: string;
  openHour?: number;
  closeHour?: number;
  roomsOrDetails?: string;
  imageUrl?: string;
  isSeedOverride?: boolean;
};

export const DEFAULT_CATEGORY_IMAGES: Record<PlaceCategory, string> = {
  Academic: "/images/academic.jpg",
  Campus: "/images/plaza.jpg",
  Food: "/images/food.jpg",
  Residence: "/images/residence.jpg",
  Sports: "/images/sports.jpg",
  Services: "/images/services.jpg",
};

export function getPlaceImageUrl(place: CampusPlace): string {
  return place.imageUrl?.trim() || DEFAULT_CATEGORY_IMAGES[place.category];
}

export const CATEGORY_COLORS: Record<
  PlaceCategory,
  { light: string; dark: string; bgLight: string; bgDark: string }
> = {
  Academic: {
    light: "#2B59C3",
    dark: "#6B95FF",
    bgLight: "#EBF1FC",
    bgDark: "#1B2945",
  },
  Food: {
    light: "#D97706",
    dark: "#F59E0B",
    bgLight: "#FEF3C7",
    bgDark: "#382810",
  },
  Residence: {
    light: "#9333EA",
    dark: "#C084FC",
    bgLight: "#F5EBFE",
    bgDark: "#2E1C42",
  },
  Sports: {
    light: "#059669",
    dark: "#34D399",
    bgLight: "#E7F7F0",
    bgDark: "#123428",
  },
  Services: {
    light: "#0284C7",
    dark: "#38BDF8",
    bgLight: "#E6F4FB",
    bgDark: "#132E3F",
  },
  Campus: {
    light: "#176B56",
    dark: "#2CA886",
    bgLight: "#E9F1EA",
    bgDark: "#1B332C",
  },
};

export type OpenStatusInfo = {
  label: string;
  tone: "open" | "closed" | "always" | "neutral";
};

export function getPlaceOpenStatus(
  place: CampusPlace,
  now = new Date(),
): OpenStatusInfo {
  const openH = place.openHour ?? -1;
  const closeH = place.closeHour ?? -1;

  if (place.openDays === "24/7" || (openH === 0 && closeH === 24)) {
    return {
      label: place.hours || "Open 24 Hours",
      tone: "always",
    };
  }

  if (openH < 0 || closeH < 0) {
    return {
      label: place.hours || "Campus access",
      tone: "neutral",
    };
  }

  // Use Ghana (Africa/Accra) local time for Central University Miotso
  let hourDecimal = now.getHours() + now.getMinutes() / 60;
  let dayShort = "";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Accra",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? now.getHours());
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? now.getMinutes());
    dayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
    if (Number.isFinite(h) && Number.isFinite(m)) {
      hourDecimal = h + m / 60;
    }
  } catch {
    // Fallback to device local clock
  }

  const isWeekend = dayShort === "Sat" || dayShort === "Sun";
  if (place.openDays === "Mon–Fri" && isWeekend) {
    return {
      label: `Closed · ${place.openDays} ${place.hours ?? ""}`.trim(),
      tone: "closed",
    };
  }

  const isOpen = hourDecimal >= openH && hourDecimal < closeH;
  return {
    label: `${isOpen ? "Open Now" : "Closed"} · ${place.hours ?? ""}`.trim(),
    tone: isOpen ? "open" : "closed",
  };
}

export const CAMPUS_CENTER: Coordinate = {
  latitude: 5.769249,
  longitude: 0.083408,
};

export const CAMPUS_INITIAL_REGION = {
  ...CAMPUS_CENTER,
  latitudeDelta: 0.0047,
  longitudeDelta: 0.0022,
};

export const PLACE_FOCUS_DELTA = {
  latitudeDelta: 0.002,
  longitudeDelta: 0.001,
};

export const CAMPUS_OUTLINE: Coordinate[] = [
  { latitude: 5.77441, longitude: 0.0790771 },
  { latitude: 5.7753138, longitude: 0.0811221 },
  { latitude: 5.7763152, longitude: 0.0833201 },
  { latitude: 5.7707078, longitude: 0.0876707 },
  { latitude: 5.7668636, longitude: 0.0905809 },
  { latitude: 5.7654572, longitude: 0.0869518 },
  { latitude: 5.764662, longitude: 0.0855973 },
  { latitude: 5.7628273, longitude: 0.0825262 },
  { latitude: 5.7626485, longitude: 0.0817725 },
  { latitude: 5.7633463, longitude: 0.0816022 },
  { latitude: 5.7645779, longitude: 0.0811167 },
  { latitude: 5.765562, longitude: 0.0803288 },
  { latitude: 5.7673293, longitude: 0.0784868 },
  { latitude: 5.7680298, longitude: 0.0774519 },
  { latitude: 5.769661, longitude: 0.0796308 },
  { latitude: 5.7721688, longitude: 0.0815164 },
  { latitude: 5.7725171, longitude: 0.0813366 },
  { latitude: 5.771563, longitude: 0.0790822 },
  { latitude: 5.7727733, longitude: 0.0785378 },
  { latitude: 5.7732429, longitude: 0.0795972 },
  { latitude: 5.77441, longitude: 0.0790771 },
];

export const CAMPUS_PLACES: CampusPlace[] = [
  {
    id: "central-university",
    name: "Central University",
    category: "Campus",
    note: "Main Miotso campus hub and central reference gateway",
    hours: "Open 24 Hours",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Main Walkway Hub · Visitor Arrival",
    latitude: 5.769249,
    longitude: 0.083408,
  },
  {
    id: "block-b",
    name: "Block B - Central University",
    category: "Academic",
    note: "Lecture halls, faculty offices, and computer science labs",
    hours: "7:00 AM – 8:00 PM",
    openDays: "Mon–Sat",
    openHour: 7,
    closeHour: 20,
    roomsOrDetails: "Rooms B1–B16 · Accessible Courtyard",
    latitude: 5.7703271,
    longitude: 0.0826945,
  },
  {
    id: "block-e",
    name: "Block E - Central University",
    category: "Academic",
    note: "Engineering, seminar rooms, and upper-level study studios",
    hours: "7:00 AM – 8:00 PM",
    openDays: "Mon–Sat",
    openHour: 7,
    closeHour: 20,
    roomsOrDetails: "Rooms E1–E12 · North Academic Wing",
    latitude: 5.770562,
    longitude: 0.0829842,
  },
  {
    id: "block-c",
    name: "Block C",
    category: "Academic",
    note: "Business, law, and humanities lecture theaters",
    hours: "7:00 AM – 7:30 PM",
    openDays: "Mon–Sat",
    openHour: 7,
    closeHour: 19.5,
    roomsOrDetails: "Rooms C1–C14 · West Academic Quadrant",
    latitude: 5.7707712,
    longitude: 0.0819352,
  },
  {
    id: "block-f",
    name: "Block F",
    category: "Academic",
    note: "Science laboratories and faculty consultation rooms",
    hours: "7:30 AM – 7:00 PM",
    openDays: "Mon–Fri",
    openHour: 7.5,
    closeHour: 19,
    roomsOrDetails: "Labs F1–F8 · North Campus Precinct",
    latitude: 5.7712618,
    longitude: 0.0825377,
  },
  {
    id: "trinity-hall",
    name: "Trinity Hall",
    category: "Residence",
    note: "On-campus student residence hall near academic blocks",
    hours: "24h Resident Access",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Student Hostel · Ground Courtyard",
    latitude: 5.7698041,
    longitude: 0.0825175,
  },
  {
    id: "soccer-field",
    name: "Soccer Field",
    category: "Sports",
    note: "University football pitch and athletics recreation grounds",
    hours: "6:00 AM – 7:00 PM",
    openDays: "Daily",
    openHour: 6,
    closeHour: 19,
    roomsOrDetails: "Main Turf Pitch · East Recreation Zone",
    latitude: 5.7696973,
    longitude: 0.0838103,
  },
  {
    id: "central-plaza",
    name: "Central Plaza",
    category: "Campus",
    note: "Open student square connecting dining, services, and walkways",
    hours: "Open 24 Hours",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Outdoor Commons · Seating & Events",
    latitude: 5.7687906,
    longitude: 0.0838249,
  },
  {
    id: "food-court",
    name: "Food Court",
    category: "Food",
    note: "Covered dining pavilion with local and fast-food stalls",
    hours: "7:30 AM – 9:00 PM",
    openDays: "Daily",
    openHour: 7.5,
    closeHour: 21,
    roomsOrDetails: "Multiple Vendors · Covered Seating",
    latitude: 5.7689394,
    longitude: 0.0835743,
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    category: "Food",
    note: "Main campus cafeteria serving hot meals and beverages",
    hours: "7:00 AM – 8:30 PM",
    openDays: "Daily",
    openHour: 7,
    closeHour: 20.5,
    roomsOrDetails: "Hot Meals · Student Dining Hall",
    latitude: 5.7685136,
    longitude: 0.0837879,
  },
  {
    id: "champion-foods",
    name: "Champion Foods",
    category: "Food",
    note: "Popular student eatery for rice dishes, grill, and snacks",
    hours: "8:00 AM – 9:00 PM",
    openDays: "Daily",
    openHour: 8,
    closeHour: 21,
    roomsOrDetails: "Quick Takeout · Plaza Dining Row",
    latitude: 5.7683912,
    longitude: 0.0836416,
  },
  {
    id: "iklina-foods",
    name: "Iklina Foods",
    category: "Food",
    note: "Campus restaurant offering breakfast, lunch, and refreshments",
    hours: "8:00 AM – 8:30 PM",
    openDays: "Daily",
    openHour: 8,
    closeHour: 20.5,
    roomsOrDetails: "Fresh Meals & Cold Drinks",
    latitude: 5.7683912,
    longitude: 0.0839953,
  },
  {
    id: "cu-male-hall",
    name: "CU Male Hall",
    category: "Residence",
    note: "Male student residence complex on the south-east side",
    hours: "24h Resident Access",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Student Hostel · Security Desk",
    latitude: 5.7682563,
    longitude: 0.0844916,
  },
  {
    id: "pronto",
    name: "Pronto",
    category: "Residence",
    note: "Student residence & off-plaza hostel accommodation",
    hours: "24h Resident Access",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Residence Block · East Walkway",
    latitude: 5.7689074,
    longitude: 0.0849369,
  },
  {
    id: "calbank",
    name: "CalBank",
    category: "Services",
    note: "On-campus CalBank branch and 24-hour ATM point",
    hours: "8:30 AM – 4:00 PM",
    openDays: "Mon–Fri",
    openHour: 8.5,
    closeHour: 16,
    roomsOrDetails: "24/7 ATM · Student Fee & Teller Desk",
    latitude: 5.7682563,
    longitude: 0.0846794,
  },
  {
    id: "lali-hostel",
    name: "Lali Hostel",
    category: "Residence",
    note: "South-east student hostel near banking and plaza services",
    hours: "24h Resident Access",
    openDays: "24/7",
    openHour: 0,
    closeHour: 24,
    roomsOrDetails: "Student Hostel · South-East Gate",
    latitude: 5.7679094,
    longitude: 0.0848027,
  },
  {
    id: "post-office",
    name: "Central University Post Office",
    category: "Services",
    note: "Campus mailroom, parcel pickup, and student courier desk",
    hours: "8:00 AM – 4:30 PM",
    openDays: "Mon–Fri",
    openHour: 8,
    closeHour: 16.5,
    roomsOrDetails: "Mail & Parcel Dispatch · Plaza Edge",
    latitude: 5.7689379,
    longitude: 0.0838203,
  },
];

export const CAMPUS_WEB_PATHS: Coordinate[][] = [
  [
    { latitude: 5.77202, longitude: 0.083369 },
    { latitude: 5.770338, longitude: 0.083248 },
    { latitude: 5.769254, longitude: 0.083016 },
    { latitude: 5.769217, longitude: 0.082996 },
    { latitude: 5.769195, longitude: 0.082469 },
    { latitude: 5.769205, longitude: 0.081016 },
  ],
  [
    { latitude: 5.772389, longitude: 0.083851 },
    { latitude: 5.770058, longitude: 0.085679 },
    { latitude: 5.767419, longitude: 0.085428 },
    { latitude: 5.765665, longitude: 0.083824 },
    { latitude: 5.765873, longitude: 0.081956 },
    { latitude: 5.769205, longitude: 0.081016 },
  ],
  [
    { latitude: 5.771862, longitude: 0.081483 },
    { latitude: 5.771618, longitude: 0.081251 },
    { latitude: 5.771101, longitude: 0.080965 },
    { latitude: 5.770722, longitude: 0.080902 },
    { latitude: 5.769379, longitude: 0.080995 },
    { latitude: 5.769205, longitude: 0.081016 },
  ],
  [
    { latitude: 5.77202, longitude: 0.083369 },
    { latitude: 5.772119, longitude: 0.083397 },
    { latitude: 5.772224, longitude: 0.083405 },
    { latitude: 5.772382, longitude: 0.083397 },
    { latitude: 5.772481, longitude: 0.083386 },
  ],
  [
    { latitude: 5.772494, longitude: 0.082957 },
    { latitude: 5.772487, longitude: 0.08308 },
    { latitude: 5.772489, longitude: 0.083185 },
    { latitude: 5.772483, longitude: 0.08326 },
    { latitude: 5.772492, longitude: 0.08332 },
  ],
  [
    { latitude: 5.773083, longitude: 0.083348 },
    { latitude: 5.772967, longitude: 0.083332 },
    { latitude: 5.772879, longitude: 0.083328 },
    { latitude: 5.772701, longitude: 0.083336 },
    { latitude: 5.772568, longitude: 0.083324 },
  ],
  [
    { latitude: 5.772555, longitude: 0.083314 },
    { latitude: 5.772547, longitude: 0.083238 },
    { latitude: 5.772528, longitude: 0.083151 },
    { latitude: 5.772515, longitude: 0.08306 },
    { latitude: 5.772494, longitude: 0.082957 },
  ],
  [
    { latitude: 5.772565, longitude: 0.083399 },
    { latitude: 5.772686, longitude: 0.083396 },
    { latitude: 5.772851, longitude: 0.083389 },
    { latitude: 5.772964, longitude: 0.083381 },
    { latitude: 5.773083, longitude: 0.083348 },
  ],
  [
    { latitude: 5.772487, longitude: 0.083395 },
    { latitude: 5.772474, longitude: 0.083515 },
    { latitude: 5.772448, longitude: 0.083603 },
    { latitude: 5.772426, longitude: 0.083695 },
    { latitude: 5.772389, longitude: 0.083851 },
  ],
  [
    { latitude: 5.76863, longitude: 0.081048 },
    { latitude: 5.76861, longitude: 0.080644 },
    { latitude: 5.768603, longitude: 0.080521 },
    { latitude: 5.768598, longitude: 0.080402 },
    { latitude: 5.768591, longitude: 0.080265 },
    { latitude: 5.768582, longitude: 0.080091 },
  ],
  [
    { latitude: 5.770402, longitude: 0.081695 },
    { latitude: 5.770381, longitude: 0.081896 },
    { latitude: 5.770352, longitude: 0.08192 },
    { latitude: 5.769776, longitude: 0.081901 },
    { latitude: 5.769743, longitude: 0.081882 },
    { latitude: 5.769739, longitude: 0.081697 },
  ],
  [
    { latitude: 5.770397, longitude: 0.081123 },
    { latitude: 5.770352, longitude: 0.081105 },
    { latitude: 5.769799, longitude: 0.08111 },
    { latitude: 5.769756, longitude: 0.081126 },
    { latitude: 5.769722, longitude: 0.081182 },
    { latitude: 5.769739, longitude: 0.081697 },
  ],
  [
    { latitude: 5.769205, longitude: 0.08115 },
    { latitude: 5.769703, longitude: 0.081675 },
    { latitude: 5.769786, longitude: 0.081712 },
    { latitude: 5.770066, longitude: 0.081704 },
    { latitude: 5.770416, longitude: 0.08115 },
    { latitude: 5.770397, longitude: 0.081123 },
  ],
  [
    { latitude: 5.771438, longitude: 0.081772 },
    { latitude: 5.770632, longitude: 0.081762 },
  ],
];

export const OSM_ATTRIBUTION = "Map data © OpenStreetMap contributors";
