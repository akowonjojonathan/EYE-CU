import { useCallback, useEffect, useRef, useState } from "react";

type OrientationPermissionApi = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type WebkitDeviceOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

export function useCompassHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const smoothedRef = useRef<number | null>(null);

  const requestCompassPermission = useCallback(async () => {
    try {
      const api =
        typeof DeviceOrientationEvent !== "undefined"
          ? (DeviceOrientationEvent as unknown as OrientationPermissionApi)
          : null;
      if (api?.requestPermission) {
        await api.requestPermission();
      }
    } catch {
      // Ignore permission errors on unsupported or blocked devices
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      smoothedRef.current = null;
      setHeading(null);
      return;
    }

    const handleOrientation = (evt: Event) => {
      const e = evt as WebkitDeviceOrientationEvent;
      let raw: number | null = null;

      if (
        typeof e.webkitCompassHeading === "number" &&
        Number.isFinite(e.webkitCompassHeading)
      ) {
        raw = e.webkitCompassHeading;
      } else if (
        typeof e.alpha === "number" &&
        Number.isFinite(e.alpha) &&
        (e.absolute || evt.type === "deviceorientationabsolute")
      ) {
        raw = (360 - e.alpha) % 360;
      }

      if (raw === null) return;
      const normalized = ((raw % 360) + 360) % 360;

      if (smoothedRef.current === null) {
        smoothedRef.current = normalized;
        setHeading(Math.round(normalized));
        return;
      }

      const delta = shortestAngleDelta(smoothedRef.current, normalized);
      if (Math.abs(delta) < 2) return;

      const next = ((smoothedRef.current + delta * 0.35) % 360 + 360) % 360;
      smoothedRef.current = next;
      setHeading(Math.round(next));
    };

    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true,
      );
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [enabled]);

  return { heading, requestCompassPermission };
}
