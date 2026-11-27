export type HapticKind = "tap" | "step" | "arrive" | "alert";

export function triggerHaptic(kind: HapticKind = "tap"): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }
    switch (kind) {
      case "tap":
        navigator.vibrate(12);
        break;
      case "step":
        navigator.vibrate([16, 28, 16]);
        break;
      case "arrive":
        navigator.vibrate([24, 40, 32, 40, 56]);
        break;
      case "alert":
        navigator.vibrate([35, 35, 35]);
        break;
    }
  } catch {
    // Ignore vibration permission/environment errors
  }
}
