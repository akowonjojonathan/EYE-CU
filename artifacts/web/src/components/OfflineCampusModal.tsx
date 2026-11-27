import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, DownloadCloud, HardDrive, WifiOff, X } from "lucide-react";
import type { CampusPlace } from "@/constants/campus";
import {
  downloadCampusOfflinePack,
  getOfflinePackSummary,
  type OfflinePackSummary,
} from "@/lib/offline-cache";
import { triggerHaptic } from "@/lib/haptics";

type OfflineCampusModalProps = {
  places: CampusPlace[];
  isOnline: boolean;
  offlinePreviewMode: boolean;
  onToggleOfflinePreview: (next: boolean) => void;
  onClose: () => void;
};

export function OfflineCampusModal({
  places,
  isOnline,
  offlinePreviewMode,
  onToggleOfflinePreview,
  onClose,
}: OfflineCampusModalProps) {
  const [summary, setSummary] = useState<OfflinePackSummary | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getOfflinePackSummary(places.length).then((res) => {
      if (active) setSummary(res);
    });
    return () => {
      active = false;
    };
  }, [places.length]);

  const handleDownloadPack = async () => {
    if (!isOnline) {
      setMessage("Connect to campus Wi-Fi or data once to download map tiles.");
      return;
    }
    triggerHaptic("step");
    setDownloading(true);
    setMessage(null);
    try {
      const next = await downloadCampusOfflinePack(places, (done, total) => {
        setProgress({ done, total });
      });
      setSummary(next);
      triggerHaptic("arrive");
      setMessage(
        `Saved ${next.placesCachedCount} campus places and ${next.cachedTilesCount} map tiles for zero-data campus walking.`,
      );
    } catch {
      setMessage("Could not finish caching all tiles. Try again when connected.");
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  };

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

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
        aria-label="Offline Campus Map Pack"
        style={{ maxWidth: 460 }}
      >
        <div className="admin-modal-head">
          <div>
            <p className="admin-modal-kicker">EYE-CU · Zero Data Mode</p>
            <h2 className="admin-modal-title">Offline Campus Map</h2>
          </div>
          <button
            type="button"
            aria-label="Close offline campus modal"
            onClick={onClose}
            className="close-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <p className="card-details-line" style={{ marginTop: 0, marginBottom: 12 }}>
          Schematic campus map, walking routes, search, and indoor steps already
          work offline. Download Street &amp; Satellite Miotso tiles below so you
          can explore every view with zero mobile data.
        </p>

        <div className="radar-controls-card" style={{ marginBottom: 12 }}>
          <div className="offline-summary-grid">
            <div className="offline-summary-item">
              <span className="offline-summary-label">Campus Places Saved</span>
              <strong className="offline-summary-value tabular-nums">
                {summary ? summary.placesCachedCount : places.length}
              </strong>
            </div>
            <div className="offline-summary-item">
              <span className="offline-summary-label">Map Tiles Cached</span>
              <strong className="offline-summary-value tabular-nums">
                {summary ? summary.cachedTilesCount : "…"}
              </strong>
            </div>
          </div>

          <div
            className="card-details-line"
            style={{ marginTop: 8, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}
          >
            <HardDrive size={13} />
            <span>
              {summary?.lastSavedAt
                ? `Last offline pack saved: ${new Date(summary.lastSavedAt).toLocaleString()}`
                : summary?.serviceWorkerActive
                  ? "Offline engine ready — tap Download to store Miotso map tiles."
                  : "Local campus storage ready for offline navigation."}
            </span>
          </div>

          {progress ? (
            <div style={{ marginTop: 10 }}>
              <div className="offline-progress-track">
                <div
                  className="offline-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div
                className="card-details-line tabular-nums"
                style={{ marginTop: 4, marginBottom: 0 }}
              >
                Caching campus map &amp; images… {progress.done}/{progress.total} (
                {progressPct}%)
              </div>
            </div>
          ) : null}
        </div>

        {message ? (
          <div className="admin-success-box" style={{ marginBottom: 12 }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{message}</span>
          </div>
        ) : null}

        <div className="offline-actions-stack">
          <button
            type="button"
            disabled={downloading}
            onClick={() => void handleDownloadPack()}
            className="primary-cta"
          >
            <DownloadCloud size={15} />
            <span>
              {downloading
                ? "Downloading Miotso Offline Pack…"
                : summary && summary.cachedTilesCount > 0
                  ? "Refresh Offline Campus Pack"
                  : "Download Campus for Offline Use"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic("tap");
              onToggleOfflinePreview(!offlinePreviewMode);
              onClose();
            }}
            className={`secondary-cta${offlinePreviewMode ? " is-active-outline" : ""}`}
            style={{ width: "100%", justifyContent: "center" }}
          >
            <WifiOff size={15} />
            <span>
              {offlinePreviewMode
                ? "Exit Offline Preview Mode"
                : "Test Offline Mode Now"}
            </span>
          </button>
        </div>
      </motion.section>
    </div>
  );
}
