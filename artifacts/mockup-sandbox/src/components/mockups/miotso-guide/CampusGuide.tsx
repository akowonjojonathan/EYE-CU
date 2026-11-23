import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Coffee,
  Crosshair,
  Home,
  Info,
  MapPin,
  Navigation,
  Plus,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";

type Place = {
  id: string;
  name: string;
  category: string;
  note: string;
  latitude: number;
  longitude: number;
};

const seedPlaces: Place[] = [
  { id: "central-university", name: "Central University", category: "Campus", note: "Campus reference point from your shared map link", latitude: 5.769249, longitude: 0.083408 },
  { id: "block-b", name: "Block B - Central University", category: "Academic", note: "Approximate pin from your shared map image", latitude: 5.7703271, longitude: 0.0826945 },
  { id: "block-e", name: "Block E - Central University", category: "Academic", note: "Approximate pin from your shared map image", latitude: 5.770562, longitude: 0.0829842 },
  { id: "block-c", name: "Block C", category: "Academic", note: "OpenStreetMap location; confirm the building position", latitude: 5.7707712, longitude: 0.0819352 },
  { id: "block-f", name: "Block F", category: "Academic", note: "OpenStreetMap location; confirm the building position", latitude: 5.7712618, longitude: 0.0825377 },
  { id: "trinity-hall", name: "Trinity Hall", category: "Residence", note: "Approximate pin from your shared map image", latitude: 5.7698041, longitude: 0.0825175 },
  { id: "soccer-field", name: "Soccer Field", category: "Sports", note: "Approximate pin from your shared map image", latitude: 5.7696973, longitude: 0.0838103 },
  { id: "central-plaza", name: "Central Plaza", category: "Campus", note: "Mapped campus place", latitude: 5.7687906, longitude: 0.0838249 },
  { id: "food-court", name: "Food Court", category: "Food", note: "Approximate pin from your shared map image", latitude: 5.7689394, longitude: 0.0835743 },
  { id: "cafeteria", name: "Cafeteria", category: "Food", note: "Mapped food court", latitude: 5.7685136, longitude: 0.0837879 },
  { id: "champion-foods", name: "Champion Foods", category: "Food", note: "Mapped food court", latitude: 5.7683912, longitude: 0.0836416 },
  { id: "iklina-foods", name: "Iklina Foods", category: "Food", note: "Mapped food court", latitude: 5.7683912, longitude: 0.0839953 },
  { id: "cu-male-hall", name: "CU Male Hall", category: "Residence", note: "Approximate pin from your shared map image", latitude: 5.7682563, longitude: 0.0844916 },
  { id: "pronto", name: "Pronto", category: "Residence", note: "Approximate pin from your shared map image", latitude: 5.7689074, longitude: 0.0849369 },
  { id: "calbank", name: "CalBank", category: "Services", note: "Approximate pin from your shared map image", latitude: 5.7682563, longitude: 0.0846794 },
  { id: "lali-hostel", name: "Lali Hostel", category: "Residence", note: "Approximate pin from your shared map image", latitude: 5.7679094, longitude: 0.0848027 },
  { id: "post-office", name: "Central University Post Office", category: "Services", note: "Mapped campus service", latitude: 5.7689379, longitude: 0.0838203 },
];

const mappedWays: Array<Array<[number, number]>> = [
  [[5.77202, 0.083369], [5.770338, 0.083248], [5.769254, 0.083016], [5.769217, 0.082996], [5.769195, 0.082469], [5.769205, 0.081016]],
  [[5.772389, 0.083851], [5.770058, 0.085679], [5.767419, 0.085428], [5.765665, 0.083824], [5.765873, 0.081956], [5.769205, 0.081016]],
  [[5.771862, 0.081483], [5.771618, 0.081251], [5.771101, 0.080965], [5.770722, 0.080902], [5.769379, 0.080995], [5.769205, 0.081016]],
  [[5.77202, 0.083369], [5.772119, 0.083397], [5.772224, 0.083405], [5.772382, 0.083397], [5.772481, 0.083386]],
  [[5.772494, 0.082957], [5.772487, 0.08308], [5.772489, 0.083185], [5.772483, 0.08326], [5.772492, 0.08332]],
  [[5.773083, 0.083348], [5.772967, 0.083332], [5.772879, 0.083328], [5.772701, 0.083336], [5.772568, 0.083324]],
  [[5.772555, 0.083314], [5.772547, 0.083238], [5.772528, 0.083151], [5.772515, 0.08306], [5.772494, 0.082957]],
  [[5.772565, 0.083399], [5.772686, 0.083396], [5.772851, 0.083389], [5.772964, 0.083381], [5.773083, 0.083348]],
  [[5.772487, 0.083395], [5.772474, 0.083515], [5.772448, 0.083603], [5.772426, 0.083695], [5.772389, 0.083851]],
  [[5.76863, 0.081048], [5.76861, 0.080644], [5.768603, 0.080521], [5.768598, 0.080402], [5.768591, 0.080265], [5.768582, 0.080091]],
  [[5.770402, 0.081695], [5.770381, 0.081896], [5.770352, 0.08192], [5.769776, 0.081901], [5.769743, 0.081882], [5.769739, 0.081697]],
  [[5.770397, 0.081123], [5.770352, 0.081105], [5.769799, 0.08111], [5.769756, 0.081126], [5.769722, 0.081182], [5.769739, 0.081697]],
  [[5.769205, 0.08115], [5.769703, 0.081675], [5.769786, 0.081712], [5.770066, 0.081704], [5.770416, 0.08115], [5.770397, 0.081123]],
  [[5.771438, 0.081772], [5.770632, 0.081762]],
];

const categories = ["All", "★ Saved", "Academic", "Food", "Residence", "Sports", "Services", "Campus"];
const bounds = { minLat: 5.7675, maxLat: 5.7717, minLon: 0.0815, maxLon: 0.0852 };
const initialLocation = { latitude: 5.77018, longitude: 0.08438 };

function project(latitude: number, longitude: number) {
  return {
    x: 16 + ((longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 358,
    y: 46 + ((bounds.maxLat - latitude) / (bounds.maxLat - bounds.minLat)) * 468,
  };
}

function placeIcon(category: string, size = 15) {
  const Icon = category === "Academic" ? BookOpen
    : category === "Food" ? Coffee
      : category === "Residence" ? Home
        : category === "Sports" ? Activity
          : category === "Services" ? BriefcaseBusiness : MapPin;
  return <Icon size={size} strokeWidth={2.2} />;
}

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function CampusGuide() {
  const [places, setPlaces] = useState(seedPlaces);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState("food-court");
  const [savedIds, setSavedIds] = useState<string[]>(["trinity-hall", "cafeteria", "central-plaza"]);
  const [origin, setOrigin] = useState(initialLocation);
  const [hasDeviceLocation, setHasDeviceLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [walking, setWalking] = useState(true);
  const [walkState, setWalkState] = useState<"no-route" | "off-route" | "arrived">("no-route");
  const [adminOpen, setAdminOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Academic");
  const [newLatitude, setNewLatitude] = useState("");
  const [newLongitude, setNewLongitude] = useState("");
  const [notice, setNotice] = useState("");

  const visiblePlaces = useMemo(() => places.filter((place) => {
    const matchesCategory = category === "All"
      || (category === "★ Saved" ? savedIds.includes(place.id) : place.category === category);
    const matchesQuery = `${place.name} ${place.category} ${place.note}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, places, query, savedIds]);

  const selected = places.find((place) => place.id === selectedId) ?? places[0]!;
  const distance = Math.round(metersBetween(origin, selected));
  const eta = Math.max(1, Math.ceil(distance / 75));

  useEffect(() => {
    if (!navigator.geolocation || !hasDeviceLocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("");
      },
      () => setLocationMessage("Location unavailable. Showing an approximate campus distance."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [hasDeviceLocation]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available here. Showing an approximate campus distance.");
      return;
    }
    setHasDeviceLocation(true);
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage("");
      },
      () => setLocationMessage("Location access is off. Showing an approximate campus distance."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  }

  function choosePlace(place: Place) {
    setSelectedId(place.id);
    setNotice("");
    setQuery("");
  }

  function toggleSaved(placeId: string) {
    setSavedIds((saved) => saved.includes(placeId) ? saved.filter((id) => id !== placeId) : [...saved, placeId]);
  }

  function addPlace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const latitude = Number(newLatitude);
    const longitude = Number(newLongitude);
    if (!newName.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setNotice("Enter a place name and valid latitude and longitude.");
      return;
    }
    const place: Place = {
      id: `admin-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      note: "Administrator-added campus place",
      latitude,
      longitude,
    };
    setPlaces((current) => [...current, place]);
    setSelectedId(place.id);
    setCategory("All");
    setNewName("");
    setNewLatitude("");
    setNewLongitude("");
    setNotice("Place added to this preview.");
    setAdminOpen(false);
  }

  const boundary = [[5.77441, 0.0790771], [5.7753138, 0.0811221], [5.7763152, 0.0833201], [5.7707078, 0.0876707], [5.7668636, 0.0905809], [5.7654572, 0.0869518], [5.764662, 0.0855973], [5.7628273, 0.0825262], [5.7626485, 0.0817725], [5.7633463, 0.0816022], [5.7645779, 0.0811167], [5.765562, 0.0803288], [5.7673293, 0.0784868], [5.7680298, 0.0774519], [5.769661, 0.0796308], [5.7721688, 0.0815164], [5.7725171, 0.0813366], [5.771563, 0.0790822], [5.7727733, 0.0785378], [5.7732429, 0.0795972], [5.77441, 0.0790771]];

  return (
    <main className="miotso-guide">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap');
        .miotso-guide{--ink:#173a37;--green:#176c59;--mint:#dcebdc;--paper:#f8f7ef;--gold:#cf9b43;--muted:#71827a;--line:#d6e0d6;position:relative;width:100%;height:100dvh;min-height:740px;overflow:hidden;color:var(--ink);background:#e5eddf;font-family:'DM Sans',sans-serif}
        .miotso-guide *{box-sizing:border-box}.miotso-guide button,.miotso-guide input,.miotso-guide select{font:inherit}.miotso-guide button{cursor:pointer}
        .mg-map{position:absolute;inset:0;background:#e4eddf}.mg-map svg{width:100%;height:100%;display:block}
        .mg-map-label{position:absolute;display:flex;align-items:center;gap:6px;padding:6px 9px;background:#f8f7efdd;border:1px solid #d5dfd4;border-radius:7px;color:#49675c;font:700 9px 'Space Mono',monospace;letter-spacing:.08em;box-shadow:0 3px 12px #22443712}
        .mg-label-north{top:43%;left:11%}.mg-label-field{top:52%;right:8%}.mg-map-marker{position:absolute;z-index:1;display:grid;width:29px;height:29px;place-items:center;border:2px solid #f8f7ef;border-radius:50%;background:#ce9a42;color:white;box-shadow:0 3px 10px #153c3436;transform:translate(-50%,-75%);transition:transform .2s,background .2s}
        .mg-map-marker.active{z-index:2;width:38px;height:38px;background:#176c59;box-shadow:0 0 0 5px #176c5930,0 4px 13px #153c3440}
        .mg-map-marker.saved:not(.active){background:#b47e2c}
        .mg-user-dot{position:absolute;width:23px;height:23px;border:3px solid #fff;border-radius:50%;background:#4778a1;box-shadow:0 0 0 8px #4778a128;transform:translate(-50%,-50%)}
        .mg-head{position:absolute;z-index:3;top:max(env(safe-area-inset-top),18px);left:16px;right:16px;display:grid;gap:10px}
        .mg-brand-row{display:flex;align-items:center;justify-content:space-between;padding:0 2px}
        .mg-brand{display:flex;align-items:center;gap:10px}.mg-seal{display:grid;width:37px;height:37px;place-items:center;border:1px solid #b4cabc;border-radius:12px;background:#f8f7ef;color:var(--green)}
        .mg-brand-copy{display:grid;gap:2px}.mg-kicker{font:700 9px 'Space Mono',monospace;letter-spacing:.11em;color:#53766a}.mg-brand-title{font:800 17px 'Syne',sans-serif;letter-spacing:-.045em}
        .mg-admin{display:flex;align-items:center;gap:6px;padding:9px 11px;border:1px solid #d3ded2;border-radius:12px;background:#f8f7ef;color:#395c50;font-size:11px;font-weight:700;box-shadow:0 3px 10px #23463610}
        .mg-search{display:flex;align-items:center;gap:10px;height:51px;padding:0 13px;border:1px solid #cfdbd0;border-radius:15px;background:#fffdf7;box-shadow:0 8px 24px #1b49341a;color:#6b8077}
        .mg-search input{width:100%;height:100%;border:0;outline:0;background:transparent;color:var(--ink);font-size:14px}.mg-search input::placeholder{color:#819087}
        .mg-cats{display:flex;gap:7px;overflow-x:auto;padding:1px 0 4px;scrollbar-width:none}.mg-cats::-webkit-scrollbar{display:none}
        .mg-chip{flex:0 0 auto;min-height:34px;padding:0 12px;border:1px solid #d2ddd1;border-radius:18px;background:#fffdf6eF;color:#38594f;font-size:11px;font-weight:700;box-shadow:0 2px 5px #203f3010}
        .mg-chip.active{border-color:var(--green);background:var(--green);color:#fffdf6}
        .mg-results{position:absolute;top:100%;left:0;right:0;max-height:330px;overflow:auto;border:1px solid var(--line);border-radius:15px;background:#fffdf7;box-shadow:0 14px 32px #1b493422}
        .mg-result{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-bottom:1px solid #edf0e8;background:transparent;text-align:left;color:var(--ink)}
        .mg-result:last-child{border-bottom:0}.mg-result-icon{display:grid;flex:0 0 34px;height:34px;place-items:center;border-radius:11px;background:#e7f0e6;color:var(--green)}
        .mg-result-copy{display:grid;flex:1;min-width:0;gap:2px}.mg-result-copy b{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.mg-result-copy small{color:var(--muted);font-size:10px}
        .mg-nearby{position:absolute;z-index:2;right:17px;bottom:295px;display:grid;gap:8px}
        .mg-round-action{display:grid;width:43px;height:43px;place-items:center;border:1px solid #d1ded2;border-radius:14px;background:#fffdf7;color:var(--green);box-shadow:0 5px 16px #173e311d}
        .mg-map-note{position:absolute;left:17px;bottom:294px;padding:6px 9px;border:1px solid #d3dfd2;border-radius:8px;background:#f8f7efdb;color:#597369;font:10px 'Space Mono',monospace}
        .mg-card{position:absolute;z-index:3;right:12px;bottom:max(env(safe-area-inset-bottom),12px);left:12px;padding:15px;border:1px solid #d4dfd4;border-radius:21px;background:#fffdf7;box-shadow:0 12px 38px #1b433526}
        .mg-card-top{display:flex;align-items:center;gap:10px}.mg-place-symbol{display:grid;flex:0 0 43px;height:43px;place-items:center;border-radius:14px;background:#e4efe4;color:var(--green)}
        .mg-place-copy{display:grid;flex:1;min-width:0;gap:3px}.mg-place-kind{font:700 9px 'Space Mono',monospace;letter-spacing:.1em;color:var(--green)}.mg-place-name{overflow:hidden;font:700 15px 'Syne',sans-serif;text-overflow:ellipsis;white-space:nowrap}.mg-place-note{overflow:hidden;color:#78867e;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
        .mg-bookmark{display:grid;width:35px;height:35px;place-items:center;border:1px solid #dce4da;border-radius:11px;background:#fffdf7;color:#577368}.mg-bookmark.is-saved{border-color:#e4d1a8;background:#fbf2dd;color:#a97929}
        .mg-walk{margin-top:13px;padding:12px;border:1px solid #cbdccf;border-radius:15px;background:#f0f5ec}
        .mg-walk-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.mg-walk-status{display:flex;align-items:center;gap:7px;color:#315e4f;font-size:11px;font-weight:700}
        .mg-status-dot{width:8px;height:8px;border-radius:50%;background:#c18d34;box-shadow:0 0 0 3px #c18d3425}.mg-status-dot.off{background:#be6a48;box-shadow:0 0 0 3px #be6a4823}.mg-status-dot.arrived{background:#398364;box-shadow:0 0 0 3px #39836422}
        .mg-live{display:flex;align-items:center;gap:4px;color:#728178;font:9px 'Space Mono',monospace}
        .mg-metrics{display:flex;align-items:baseline;gap:9px;margin-top:9px}.mg-distance{font:800 25px 'Syne',sans-serif;letter-spacing:-.05em;color:#183d36}.mg-eta{display:flex;align-items:center;gap:4px;color:#5f776c;font-size:11px;font-weight:600}
        .mg-route-truth{display:flex;align-items:flex-start;gap:6px;margin-top:5px;color:#758178;font-size:10px;line-height:1.4}
        .mg-route-truth svg{flex:0 0 auto;margin-top:1px}
        .mg-walk-controls{display:flex;gap:7px;margin-top:10px}.mg-state-button{display:flex;align-items:center;justify-content:center;gap:5px;flex:1;min-height:32px;padding:0 7px;border:1px solid #d4dfd4;border-radius:10px;background:#fffdf7;color:#4f6c61;font-size:10px;font-weight:700}
        .mg-state-button.selected{border-color:#7fa591;background:#e2eee4;color:#225943}.mg-stop{display:flex;align-items:center;justify-content:center;gap:6px;min-height:41px;margin-top:9px;border:0;border-radius:12px;background:#173f38;color:#fffdf7;font-size:12px;font-weight:700}
        .mg-bottom-line{display:flex;align-items:center;justify-content:space-between;margin-top:10px;color:#819087;font:9px 'Space Mono',monospace}
        .mg-empty{padding:18px;text-align:center;color:#718178;font-size:12px}.mg-empty strong{display:block;margin:8px 0 3px;color:#294e43}
        .mg-message{position:absolute;z-index:5;right:14px;bottom:285px;left:14px;padding:10px 12px;border:1px solid #d9e1d5;border-radius:12px;background:#fffdf7;color:#466459;font-size:11px;box-shadow:0 8px 18px #193c2e1c}
        .mg-admin-backdrop{position:absolute;z-index:10;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:12px;background:#102f29a8;backdrop-filter:blur(4px)}
        .mg-admin-panel{width:min(100%,500px);padding:20px;border:1px solid #d8e2d7;border-radius:23px 23px 18px 18px;background:#fffdf7;box-shadow:0 18px 60px #102f2940}
        .mg-admin-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.mg-admin-heading{display:grid;gap:5px}.mg-admin-heading small{font:700 9px 'Space Mono',monospace;letter-spacing:.12em;color:#6b8174}.mg-admin-heading h2{margin:0;font:800 23px 'Syne',sans-serif;letter-spacing:-.04em}
        .mg-close{display:grid;width:35px;height:35px;place-items:center;border:1px solid #dce4da;border-radius:11px;background:#fffdf7;color:#405e52}
        .mg-admin-intro{display:flex;gap:8px;margin-bottom:15px;padding:10px;border-radius:11px;background:#eef3e9;color:#62776b;font-size:11px;line-height:1.45}.mg-admin-intro svg{flex:0 0 auto;color:#49715f}
        .mg-form{display:grid;gap:11px}.mg-field{display:grid;gap:5px;color:#526b60;font-size:10px;font-weight:700}.mg-field input,.mg-field select{width:100%;height:42px;padding:0 11px;border:1px solid #d6dfd4;border-radius:10px;outline:none;background:#fff;color:#183a34;font-size:13px}.mg-field input:focus,.mg-field select:focus{border-color:#43816c;box-shadow:0 0 0 3px #43816c20}
        .mg-coord-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mg-submit{display:flex;align-items:center;justify-content:center;gap:7px;height:44px;margin-top:2px;border:0;border-radius:12px;background:#176c59;color:white;font-size:12px;font-weight:700}
        .mg-admin-note{margin:10px 0 0;color:#8a948b;font-size:10px;text-align:center}
        @media(min-width:700px){.miotso-guide{max-width:510px;margin:0 auto;border-right:1px solid #d3dfd2;border-left:1px solid #d3dfd2}.mg-head{left:22px;right:22px}.mg-card{left:18px;right:18px;bottom:18px}.mg-nearby{right:22px}.mg-map-note{left:22px}}
        @media(max-height:760px){.miotso-guide{min-height:640px}.mg-head{gap:7px;top:12px}.mg-brand-title{font-size:15px}.mg-search{height:46px}.mg-chip{min-height:31px}.mg-card{padding:12px}.mg-walk{margin-top:9px;padding:9px}.mg-distance{font-size:22px}.mg-nearby,.mg-map-note{bottom:270px}}
      `}</style>

      <div className="mg-map">
        <svg viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" aria-label="Schematic map of Central University Miotso">
          <defs>
            <pattern id="mg-grain" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="8" r=".7" fill="#769477" opacity=".18" />
              <circle cx="29" cy="31" r=".8" fill="#769477" opacity=".13" />
              <path d="M0 47L48 1" stroke="#8da18a" strokeWidth=".35" opacity=".11" />
            </pattern>
            <pattern id="mg-campus-grid" width="31" height="25" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
              <path d="M0 12.5H31M15.5 0V25" stroke="#b9cbb6" strokeWidth=".6" opacity=".4" />
            </pattern>
          </defs>
          <rect width="390" height="560" fill="#e4eddf" />
          <rect width="390" height="560" fill="url(#mg-campus-grid)" />
          <polygon points={boundary.map(([lat, lon]) => { const p = project(lat, lon); return `${p.x},${p.y}`; }).join(" ")} fill="#cfdfc7" stroke="#4c8067" strokeWidth="2.3" />
          <polygon points={boundary.map(([lat, lon]) => { const p = project(lat, lon); return `${p.x},${p.y}`; }).join(" ")} fill="url(#mg-grain)" />
          {mappedWays.map((way, index) => {
            const points = way.map(([lat, lon]) => { const p = project(lat, lon); return `${p.x},${p.y}`; }).join(" ");
            return <g key={index}><polyline points={points} fill="none" stroke="#b8c7b5" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /><polyline points={points} fill="none" stroke="#fffdf4" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round" /></g>;
          })}
          <path d="M254 146l18-11 22 7 6 20-16 11-23-4zM93 247l21-9 11 14-6 20-20 4-10-13zM235 365l18-7 16 13-4 17-22 6-12-13z" fill="#aac5a2" opacity=".75" />
          <text x="194" y="245" fill="#5c7d69" fontFamily="Space Mono, monospace" fontSize="7" letterSpacing="1.2">CENTRAL UNIVERSITY</text>
          <text x="302" y="309" fill="#688473" fontFamily="Space Mono, monospace" fontSize="6" letterSpacing="1">MIOTSO</text>
          <circle cx="355" cy="68" r="9" fill="#d6a64f" opacity=".85" /><path d="M351 68h8M355 64v8" stroke="#fff9e8" strokeWidth="1.2" />
        </svg>
        <div className="mg-map-label mg-label-north"><MapPin size={11} /> NORTH CAMPUS</div>
        <div className="mg-map-label mg-label-field">SPORTS GROUNDS</div>
        {visiblePlaces.map((place) => {
          const point = project(place.latitude, place.longitude);
          return <button key={place.id} className={`mg-map-marker${place.id === selected.id ? " active" : ""}${savedIds.includes(place.id) ? " saved" : ""}`} style={{ left: `${(point.x / 390) * 100}%`, top: `${(point.y / 560) * 100}%` }} aria-label={`Show ${place.name}`} onClick={() => choosePlace(place)}>{placeIcon(place.category, place.id === selected.id ? 17 : 13)}</button>;
        })}
        <div className="mg-user-dot" aria-label={hasDeviceLocation ? "Your current location" : "Approximate campus starting point"} style={{ left: `${(project(origin.latitude, origin.longitude).x / 390) * 100}%`, top: `${(project(origin.latitude, origin.longitude).y / 560) * 100}%` }} />
      </div>

      <header className="mg-head">
        <div className="mg-brand-row">
          <div className="mg-brand">
            <div className="mg-seal"><MapPin size={19} /></div>
            <div className="mg-brand-copy"><span className="mg-kicker">CENTRAL UNIVERSITY · MIOTSO</span><span className="mg-brand-title">Your campus, clearly.</span></div>
          </div>
          <button className="mg-admin" onClick={() => { setAdminOpen(true); setNotice(""); }}><ShieldCheck size={14} /> Admin entry</button>
        </div>
        <label className="mg-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocks, halls, food…" aria-label="Search blocks, halls, food" />
          {query ? <button aria-label="Clear search" onClick={() => setQuery("")} style={{ border: 0, padding: 2, background: "transparent", color: "inherit" }}><X size={16} /></button> : <span className="mg-kicker">17 PLACES</span>}
        </label>
        <nav className="mg-cats" aria-label="Filter places">
          {categories.map((item) => <button key={item} className={`mg-chip${category === item ? " active" : ""}`} onClick={() => { setCategory(item); const first = places.find((place) => item === "All" || (item === "★ Saved" ? savedIds.includes(place.id) : place.category === item)); if (first) setSelectedId(first.id); }}>{item}</button>)}
        </nav>
        {!!query.trim() && <div className="mg-results">
          {visiblePlaces.length ? visiblePlaces.slice(0, 7).map((place) => <button className="mg-result" key={place.id} onClick={() => choosePlace(place)}><span className="mg-result-icon">{placeIcon(place.category)}</span><span className="mg-result-copy"><b>{place.name}</b><small>{place.category} · {place.note}</small></span><ArrowDownLeft size={16} /></button>) : <div className="mg-empty"><Search size={19} /><strong>No place found</strong>Try another building, hall, or food spot.</div>}
        </div>}
      </header>

      <div className="mg-nearby">
        <button className="mg-round-action" aria-label="Use my location" title="Use my location" onClick={useMyLocation}><Crosshair size={18} /></button>
        <button className="mg-round-action" aria-label="Return to campus overview" title="Return to campus overview" onClick={() => { setCategory("All"); setSelectedId("central-university"); setQuery(""); }}><MapPin size={18} /></button>
      </div>
      <div className="mg-map-note">MAPPED CAMPUS WAYS · OSM</div>
      {locationMessage && <div className="mg-message" role="status">{locationMessage}</div>}
      {notice && !adminOpen && <button className="mg-message" onClick={() => setNotice("")}>{notice}</button>}

      <section className="mg-card" aria-label="Selected place and walking guidance">
        <div className="mg-card-top">
          <div className="mg-place-symbol">{placeIcon(selected.category, 20)}</div>
          <div className="mg-place-copy">
            <span className="mg-place-kind">{selected.category.toUpperCase()}</span>
            <strong className="mg-place-name">{selected.name}</strong>
            <span className="mg-place-note">{selected.note}</span>
          </div>
          <button className={`mg-bookmark${savedIds.includes(selected.id) ? " is-saved" : ""}`} aria-label={savedIds.includes(selected.id) ? "Remove from saved places" : "Save place"} onClick={() => toggleSaved(selected.id)}>{savedIds.includes(selected.id) ? <Star size={16} fill="currentColor" /> : <Bookmark size={16} />}</button>
        </div>

        {walking ? <div className="mg-walk">
          <div className="mg-walk-head">
            <div className="mg-walk-status"><span className={`mg-status-dot${walkState === "arrived" ? " arrived" : walkState === "off-route" ? " off" : ""}`} />
              {walkState === "arrived" ? "You have arrived" : walkState === "off-route" ? "Off-route check" : "No mapped route"}
            </div>
            <span className="mg-live"><span style={{ width: 6, height: 6, borderRadius: "50%", background: hasDeviceLocation ? "#4f9676" : "#be923f" }} />{hasDeviceLocation ? "LOCATION LIVE" : "APPROX. START"}</span>
          </div>
          {walkState !== "arrived" ? <div className="mg-metrics"><strong className="mg-distance">{distance} m</strong><span className="mg-eta"><Clock3 size={13} /> about {eta} min</span></div> : <div className="mg-metrics"><strong className="mg-distance" style={{ fontSize: 20 }}>Destination reached</strong><span className="mg-eta"><Check size={14} /> done</span></div>}
          <div className="mg-route-truth"><Info size={13} /><span>{walkState === "off-route" ? "No mapped footway connects this start and destination. Keep to marked campus ways." : walkState === "arrived" ? "Guidance is complete. Your destination is marked on the campus map." : "Straight-line estimate only. No mapped footway connects this start to the pin, so no route is drawn."}</span></div>
          {walkState !== "arrived" && <div className="mg-walk-controls">
            <button className={`mg-state-button${walkState === "no-route" ? " selected" : ""}`} onClick={() => setWalkState("no-route")}><CircleAlert size={12} /> No route</button>
            <button className={`mg-state-button${walkState === "off-route" ? " selected" : ""}`} onClick={() => setWalkState("off-route")}>Off route</button>
            <button className="mg-state-button" onClick={() => setWalkState("arrived")}><Check size={12} /> Arrived</button>
          </div>}
        </div> : <div className="mg-walk" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "#527164", fontSize: 11, fontWeight: 700 }}>Walking guidance stopped</span>
          <button className="mg-state-button" style={{ flex: "0 0 auto" }} onClick={() => { setWalking(true); setWalkState("no-route"); }}><Navigation size={12} /> Start again</button>
        </div>}

        <button className="mg-stop" onClick={() => { setWalking(false); setWalkState("no-route"); }}><X size={15} /> Stop guidance</button>
        <div className="mg-bottom-line"><span>OPENSTREETMAP CONTRIBUTORS</span><span>{visiblePlaces.length} PLACES <ChevronDown size={11} style={{ verticalAlign: "middle" }} /></span></div>
      </section>

      {adminOpen && <div className="mg-admin-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}>
        <section className="mg-admin-panel" aria-label="Administrator place entry">
          <div className="mg-admin-head">
            <div className="mg-admin-heading"><small>RESTRICTED AREA · ADMINISTRATORS</small><h2>Add a campus place</h2></div>
            <button className="mg-close" aria-label="Close place editor" onClick={() => setAdminOpen(false)}><X size={18} /></button>
          </div>
          <div className="mg-admin-intro"><ShieldCheck size={15} /><span>Place entry is for authorised campus administrators. No credentials are shown in this preview.</span></div>
          <form className="mg-form" onSubmit={addPlace}>
            <label className="mg-field">Place name<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="For example, Block A" required /></label>
            <label className="mg-field">Category<select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{["Campus", "Academic", "Food", "Residence", "Sports", "Services"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="mg-coord-row">
              <label className="mg-field">Latitude<input type="number" step="any" value={newLatitude} onChange={(event) => setNewLatitude(event.target.value)} placeholder="5.769249" required /></label>
              <label className="mg-field">Longitude<input type="number" step="any" value={newLongitude} onChange={(event) => setNewLongitude(event.target.value)} placeholder="0.083408" required /></label>
            </div>
            {notice && <div role="alert" style={{ color: "#a25b3e", fontSize: 11 }}>{notice}</div>}
            <button className="mg-submit" type="submit"><Plus size={15} /> Add place to directory</button>
          </form>
          <p className="mg-admin-note">This preview stores changes in this session only.</p>
        </section>
      </div>}
    </main>
  );
}
