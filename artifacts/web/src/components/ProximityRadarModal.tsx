import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, Radar, X } from "lucide-react";
import type { CampusPlace, Coordinate, PlaceCategory } from "@/constants/campus";
import {
  distanceMeters,
  estimateWalkingMinutes,
  formatDistance,
} from "@/lib/walking-navigation";
import { triggerHaptic } from "@/lib/haptics";

type ProximityRadarModalProps = {
  places: CampusPlace[];
  originCoordinate: Coordinate;
  originLabel: string;
  radiusMeters: number;
  onChangeRadius: (radius: number) => void;
  onSelectAndWalk: (place: CampusPlace) => void;
  onSelectPlace: (place: CampusPlace) => void;
  onClose: () => void;
};

const RADAR_PRESETS = [100, 250, 500];
const FILTER_OPTIONS: Array<"All" | PlaceCategory> = [
  "All",
  "Academic",
  "Food",
  "Services",
  "Residence",
  "Sports",
];

export function ProximityRadarModal({
  places,
  originCoordinate,
  originLabel,
  radiusMeters,
  onChangeRadius,
  onSelectAndWalk,
  onSelectPlace,
  onClose,
}: ProximityRadarModalProps) {
  const [catFilter, setCatFilter] = useState<"All" | PlaceCategory>("All");

  const matches = useMemo(() => {
    return places
      .filter((p) => catFilter === "All" || p.category === catFilter)
      .map((p) => ({
        place: p,
        dist: distanceMeters(originCoordinate, p),
      }))
      .filter((item) => item.dist <= radiusMeters)
      .sort((a, b) => a.dist - b.dist);
  }, [catFilter, originCoordinate, places, radiusMeters]);

  return (
    <div
      className="admin-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className="admin-modal glass-modal"
        aria-label="Proximity Radar Around Me"
      >
        <div className="admin-modal-head">
          <div>
            <p className="admin-modal-kicker">EYE-CU · Proximity Radar</p>
            <h2 className="admin-modal-title">What&apos;s Around Me</h2>
          </div>
          <button
            type="button"
            aria-label="Close proximity radar"
            onClick={onClose}
            className="close-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="radar-controls-card">
          <div className="radar-header-row">
            <span className="radar-origin-label">
              <Radar size={14} /> Scanning from {originLabel}
            </span>
            <strong className="radar-radius-val tabular-nums">
              {radiusMeters} m
            </strong>
          </div>

          <input
            type="range"
            min={100}
            max={600}
            step={50}
            value={radiusMeters}
            onChange={(e) => {
              onChangeRadius(Number(e.target.value));
            }}
            aria-label="Proximity scan radius in meters"
            className="radar-slider"
          />

          <div className="radar-presets-row">
            {RADAR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  onChangeRadius(preset);
                }}
                className={`walk-camera-pill${radiusMeters === preset ? " is-active" : ""}`}
              >
                {preset}m
              </button>
            ))}
          </div>

          <div className="category-strip" style={{ marginTop: 8 }}>
            {FILTER_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  triggerHaptic("tap");
                  setCatFilter(c);
                }}
                className={`category-tab${catFilter === c ? " active" : ""}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="manage-list" style={{ maxHeight: "42dvh", marginTop: 12 }}>
          {matches.length === 0 ? (
            <div className="indoor-empty-hint">
              No {catFilter === "All" ? "places" : `${catFilter} places`} within{" "}
              {radiusMeters}m. Try expanding the radar slider.
            </div>
          ) : (
            matches.map(({ place, dist }) => (
              <div key={place.id} className="custom-place-item">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("tap");
                    onSelectPlace(place);
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "transparent",
                    border: 0,
                    textAlign: "left",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div className="custom-place-name">{place.name}</div>
                  <div className="custom-place-coords tabular-nums">
                    {place.category} · {formatDistance(dist)} ·{" "}
                    {estimateWalkingMinutes(dist)} min walk
                  </div>
                </button>
                <div className="manage-row-actions">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("tap");
                      onSelectPlace(place);
                      onClose();
                    }}
                    className="edit-place-btn"
                  >
                    <MapPin size={12} />
                    <span>View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("step");
                      onSelectAndWalk(place);
                      onClose();
                    }}
                    className="edit-place-btn"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-fg)",
                      borderColor: "var(--primary)",
                    }}
                  >
                    <Navigation size={12} />
                    <span>Walk</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>
    </div>
  );
}
