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
};

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

// The campus outline and roads are derived from OpenStreetMap. Places identified
// in the shared Google Maps screenshot use estimated coordinates from that view;
// confirm those pins with the university before relying on them.
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
    note: "Campus reference point from your shared map link",
    latitude: 5.769249,
    longitude: 0.083408,
  },
  {
    id: "block-b",
    name: "Block B - Central University",
    category: "Academic",
    note: "Approximate pin from your shared map image",
    latitude: 5.7703271,
    longitude: 0.0826945,
  },
  {
    id: "block-e",
    name: "Block E - Central University",
    category: "Academic",
    note: "Approximate pin from your shared map image",
    latitude: 5.770562,
    longitude: 0.0829842,
  },
  {
    id: "block-c",
    name: "Block C",
    category: "Academic",
    note: "OpenStreetMap location; confirm the building position",
    latitude: 5.7707712,
    longitude: 0.0819352,
  },
  {
    id: "block-f",
    name: "Block F",
    category: "Academic",
    note: "OpenStreetMap location; confirm the building position",
    latitude: 5.7712618,
    longitude: 0.0825377,
  },
  {
    id: "trinity-hall",
    name: "Trinity Hall",
    category: "Residence",
    note: "Approximate pin from your shared map image",
    latitude: 5.7698041,
    longitude: 0.0825175,
  },
  {
    id: "soccer-field",
    name: "Soccer Field",
    category: "Sports",
    note: "Approximate pin from your shared map image",
    latitude: 5.7696973,
    longitude: 0.0838103,
  },
  {
    id: "central-plaza",
    name: "Central Plaza",
    category: "Campus",
    note: "Mapped campus place",
    latitude: 5.7687906,
    longitude: 0.0838249,
  },
  {
    id: "food-court",
    name: "Food Court",
    category: "Food",
    note: "Approximate pin from your shared map image",
    latitude: 5.7689394,
    longitude: 0.0835743,
  },
  {
    id: "cafeteria",
    name: "Cafeteria",
    category: "Food",
    note: "Mapped food court",
    latitude: 5.7685136,
    longitude: 0.0837879,
  },
  {
    id: "champion-foods",
    name: "Champion Foods",
    category: "Food",
    note: "Mapped food court",
    latitude: 5.7683912,
    longitude: 0.0836416,
  },
  {
    id: "iklina-foods",
    name: "Iklina Foods",
    category: "Food",
    note: "Mapped food court",
    latitude: 5.7683912,
    longitude: 0.0839953,
  },
  {
    id: "cu-male-hall",
    name: "CU Male Hall",
    category: "Residence",
    note: "Approximate pin from your shared map image",
    latitude: 5.7682563,
    longitude: 0.0844916,
  },
  {
    id: "pronto",
    name: "Pronto",
    category: "Residence",
    note: "Approximate pin from your shared map image",
    latitude: 5.7689074,
    longitude: 0.0849369,
  },
  {
    id: "calbank",
    name: "CalBank",
    category: "Services",
    note: "Approximate pin from your shared map image",
    latitude: 5.7682563,
    longitude: 0.0846794,
  },
  {
    id: "lali-hostel",
    name: "Lali Hostel",
    category: "Residence",
    note: "Approximate pin from your shared map image",
    latitude: 5.7679094,
    longitude: 0.0848027,
  },
  {
    id: "post-office",
    name: "Central University Post Office",
    category: "Services",
    note: "Mapped campus service",
    latitude: 5.7689379,
    longitude: 0.0838203,
  },
];

// A small set of mapped campus paths supports the browser preview. Native
// devices use their platform map for the full interactive basemap.
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
