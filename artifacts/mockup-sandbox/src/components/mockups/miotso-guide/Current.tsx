import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpLeft,
  BriefcaseBusiness,
  BookOpen,
  Coffee,
  Crosshair,
  Home,
  Info,
  Map,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "./_group.css";

type Place = {
  id: string;
  name: string;
  category: string;
  note: string;
  latitude: number;
  longitude: number;
};

const places: Place[] = [
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

const paths: Array<Array<[number, number]>> = [
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

const categories = ["All", "Campus", "Academic", "Food", "Residence", "Sports", "Services"];
const mapBounds = { minLat: 5.7675, maxLat: 5.7717, minLon: 0.0815, maxLon: 0.0852 };

function project(latitude: number, longitude: number) {
  return {
    x: 16 + ((longitude - mapBounds.minLon) / (mapBounds.maxLon - mapBounds.minLon)) * 358,
    y: 46 + ((mapBounds.maxLat - latitude) / (mapBounds.maxLat - mapBounds.minLat)) * 468,
  };
}

function PlaceIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon =
    category === "Academic" ? BookOpen :
    category === "Food" ? Coffee :
    category === "Residence" ? Home :
    category === "Sports" ? Activity :
    category === "Services" ? BriefcaseBusiness : MapPin;
  return <Icon size={size} />;
}

export function Current() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState("central-university");
  const visiblePlaces = useMemo(() => places.filter((place) => {
    const matchesCategory = category === "All" || place.category === category;
    const matchesQuery = `${place.name} ${place.category} ${place.note}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, query]);
  const selected = places.find((place) => place.id === selectedId) ?? places[0]!;
  const boundary = [[5.77441, 0.0790771], [5.7753138, 0.0811221], [5.7763152, 0.0833201], [5.7707078, 0.0876707], [5.7668636, 0.0905809], [5.7654572, 0.0869518], [5.764662, 0.0855973], [5.7628273, 0.0825262], [5.7626485, 0.0817725], [5.7633463, 0.0816022], [5.7645779, 0.0811167], [5.765562, 0.0803288], [5.7673293, 0.0784868], [5.7680298, 0.0774519], [5.769661, 0.0796308], [5.7721688, 0.0815164], [5.7725171, 0.0813366], [5.771563, 0.0790822], [5.7727733, 0.0785378], [5.7732429, 0.0795972], [5.77441, 0.0790771]];

  return (
    <main className="miotso-current">
      <div className="current-map">
        <svg viewBox="0 0 390 560" aria-label="Schematic campus map">
          <rect width="390" height="560" fill="var(--miotso-map)" />
          <polygon points={boundary.map(([lat, lon]) => { const p = project(lat, lon); return `${p.x},${p.y}`; }).join(" ")} fill="var(--miotso-park)" stroke="var(--miotso-primary)" strokeWidth="2.4" />
          {paths.map((path, index) => {
            const points = path.map(([lat, lon]) => { const p = project(lat, lon); return `${p.x},${p.y}`; }).join(" ");
            return <g key={index}><polyline points={points} fill="none" stroke="var(--miotso-road-edge)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><polyline points={points} fill="none" stroke="var(--miotso-road)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>;
          })}
          <circle cx="355" cy="68" r="8" fill="#8faf8d" />
        </svg>
        {visiblePlaces.map((place) => {
          const point = project(place.latitude, place.longitude);
          const active = place.id === selected.id;
          return <button key={place.id} className={`current-pin${active ? " is-selected" : ""}`} style={{ left: `${(point.x / 390) * 100}%`, top: `${(point.y / 560) * 100}%` }} onClick={() => setSelectedId(place.id)} aria-label={`Show ${place.name}`}><PlaceIcon category={place.category} size={active ? 17 : 15} /></button>;
        })}
      </div>

      <header className="current-top">
        <div className="current-heading">
          <div><p className="current-eyebrow">CENTRAL UNIVERSITY · MIOTSO</p><h1>Find your way around.</h1></div>
          <div className="current-count"><MapPin size={13} />{places.length}</div>
        </div>
        <label className="current-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places on campus" aria-label="Search campus places" />{query ? <X size={17} onClick={() => setQuery("")} /> : <SlidersHorizontal size={17} />}</label>
        <nav className="current-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); const match = places.find((place) => item === "All" || place.category === item); if (match) setSelectedId(match.id); }}>{item}</button>)}</nav>
        {query.trim() && <section className="current-results">{visiblePlaces.slice(0, 5).map((place) => <button key={place.id} onClick={() => setSelectedId(place.id)}><span className="current-result-icon"><PlaceIcon category={place.category} /></span><span><b>{place.name}</b><small>{place.category} · {place.note}</small></span><ArrowUpLeft size={16} /></button>)}</section>}
      </header>

      <div className="current-map-actions"><button><Crosshair size={17} /> My location</button><button aria-label="Return to campus"><Map size={17} /></button></div>
      <section className="current-place-card">
        <div className="current-place-row"><span className="current-place-icon"><PlaceIcon category={selected.category} size={20} /></span><div className="current-place-copy"><small>{selected.category.toUpperCase()}</small><b>{selected.name}</b><span>{selected.note}</span></div><button className="current-directions"><Navigation size={15} /> Directions</button></div>
        <div className="current-data-notice"><Info size={13} /><span>Some pins are estimated from your shared map image; confirm exact positions with the university.</span></div>
        <p className="current-attribution">Map data © OpenStreetMap contributors</p>
      </section>
    </main>
  );
}
