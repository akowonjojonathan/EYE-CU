export type CampusAtmosphere = "morning" | "afternoon" | "evening" | "night";

export type AtmosphereInfo = {
  period: CampusAtmosphere;
  label: string;
  accentHex: string;
  glowRgba: string;
  isAfterDark: boolean;
};

export function getCampusAtmosphere(date = new Date()): AtmosphereInfo {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return {
      period: "morning",
      label: "Morning Lectures",
      accentHex: "#D97706",
      glowRgba: "rgba(217, 119, 6, 0.14)",
      isAfterDark: false,
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      period: "afternoon",
      label: "Afternoon Campus",
      accentHex: "#176B56",
      glowRgba: "rgba(23, 107, 86, 0.14)",
      isAfterDark: false,
    };
  }

  if (hour >= 17 && hour < 20) {
    return {
      period: "evening",
      label: "Evening Golden Hour",
      accentHex: "#6366F1",
      glowRgba: "rgba(99, 102, 241, 0.16)",
      isAfterDark: true,
    };
  }

  return {
    period: "night",
    label: "Night Study Hours",
    accentHex: "#10B981",
    glowRgba: "rgba(16, 185, 129, 0.18)",
    isAfterDark: true,
  };
}
