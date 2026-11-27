import React from "react";
import {
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  CornerUpLeft,
  CornerUpRight,
  DoorOpen,
} from "lucide-react";
import type { IndoorDirectionIcon } from "@/constants/campus";

export const INDOOR_DIRECTION_DETAILS: Record<
  IndoorDirectionIcon,
  { label: string; cue: string; color: string; bg: string }
> = {
  straight: {
    label: "Straight",
    cue: "Walk straight ahead",
    color: "#1A73E8",
    bg: "rgba(26, 115, 232, 0.14)",
  },
  left: {
    label: "Turn Left",
    cue: "Turn left",
    color: "#0284C7",
    bg: "rgba(2, 132, 199, 0.14)",
  },
  right: {
    label: "Turn Right",
    cue: "Turn right",
    color: "#0284C7",
    bg: "rgba(2, 132, 199, 0.14)",
  },
  "stairs-up": {
    label: "Stairs Up",
    cue: "Go upstairs",
    color: "#D97706",
    bg: "rgba(217, 119, 6, 0.15)",
  },
  "stairs-down": {
    label: "Stairs Down",
    cue: "Go downstairs",
    color: "#9333EA",
    bg: "rgba(147, 51, 234, 0.14)",
  },
  door: {
    label: "Room Door",
    cue: "Destination entrance",
    color: "#176B56",
    bg: "rgba(23, 107, 86, 0.15)",
  },
};

export function IndoorDirectionIconView({
  icon,
  size = 20,
}: {
  icon: IndoorDirectionIcon;
  size?: number;
}) {
  switch (icon) {
    case "left":
      return <CornerUpLeft size={size} strokeWidth={2.4} />;
    case "right":
      return <CornerUpRight size={size} strokeWidth={2.4} />;
    case "stairs-up":
      return <ChevronsUp size={size} strokeWidth={2.4} />;
    case "stairs-down":
      return <ChevronsDown size={size} strokeWidth={2.4} />;
    case "door":
      return <DoorOpen size={size} strokeWidth={2.3} />;
    case "straight":
    default:
      return <ArrowUp size={size} strokeWidth={2.4} />;
  }
}
