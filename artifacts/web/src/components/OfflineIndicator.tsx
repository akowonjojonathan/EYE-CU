import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

type OfflineIndicatorProps = {
  forcedOffline?: boolean;
  onExitPreview?: () => void;
};

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  forcedOffline = false,
  onExitPreview,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && !forcedOffline) return null;

  const isPreviewOnly = isOnline && forcedOffline;

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <WifiOff size={14} style={{ flexShrink: 0 }} />
      <span>
        {isPreviewOnly
          ? "Offline Preview · Using cached map & campus places"
          : "Offline Mode · Cached map & campus places ready"}
      </span>
      {isPreviewOnly && onExitPreview ? (
        <button
          type="button"
          onClick={onExitPreview}
          className="offline-exit-btn"
        >
          Go Online
        </button>
      ) : null}
    </div>
  );
};
