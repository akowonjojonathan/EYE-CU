import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Polygon, Polyline, Rect } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import {
  CAMPUS_OUTLINE,
  CAMPUS_WEB_PATHS,
  type CampusPlace,
  type Coordinate,
} from "@/constants/campus";
import { useColors } from "@/hooks/useColors";
import type { CampusMapProps } from "./CampusMap.native";

const WEB_MAP = {
  width: 390,
  height: 560,
  left: 16,
  top: 46,
  mapWidth: 358,
  mapHeight: 468,
  minLatitude: 5.7625,
  maxLatitude: 5.7765,
  minLongitude: 0.0773,
  maxLongitude: 0.0908,
};

function projectToWebMap(coordinate: Coordinate) {
  const x =
    WEB_MAP.left +
    ((coordinate.longitude - WEB_MAP.minLongitude) /
      (WEB_MAP.maxLongitude - WEB_MAP.minLongitude)) *
      WEB_MAP.mapWidth;
  const y =
    WEB_MAP.top +
    ((WEB_MAP.maxLatitude - coordinate.latitude) /
      (WEB_MAP.maxLatitude - WEB_MAP.minLatitude)) *
      WEB_MAP.mapHeight;

  return { x, y };
}

export function CampusMap({
  places,
  selectedPlaceId,
  userCoordinate,
  onSelectPlace,
}: CampusMapProps) {
  const colors = useColors();
  const boundaryPoints = CAMPUS_OUTLINE.map((coordinate) => {
    const point = projectToWebMap(coordinate);
    return `${point.x},${point.y}`;
  }).join(" ");

  return (
    <View style={[styles.map, { backgroundColor: colors.mapCanvas }]}>
      <Svg
        accessible
        accessibilityLabel="Schematic map of Central University Miotso"
        width="100%"
        height="100%"
        viewBox={`0 0 ${WEB_MAP.width} ${WEB_MAP.height}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width={WEB_MAP.width} height={WEB_MAP.height} fill={colors.mapCanvas} />
        <Polygon
          points={boundaryPoints}
          fill={colors.mapPark}
          stroke={colors.primary}
          strokeWidth={2.4}
        />
        {CAMPUS_WEB_PATHS.map((path, index) => {
          const points = path
            .map((coordinate) => {
              const point = projectToWebMap(coordinate);
              return `${point.x},${point.y}`;
            })
            .join(" ");

          return (
            <React.Fragment key={`campus-path-${index}`}>
              <Polyline
                points={points}
                fill="none"
                stroke={colors.mapRoadEdge}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Polyline
                points={points}
                fill="none"
                stroke={colors.mapRoad}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </React.Fragment>
          );
        })}
        <Circle
          cx={WEB_MAP.left + WEB_MAP.mapWidth - 19}
          cy={WEB_MAP.top + 22}
          r={8}
          fill={colors.accent}
          opacity={0.8}
        />
      </Svg>

      {places.map((place: CampusPlace) => {
        const point = projectToWebMap(place);
        const selected = place.id === selectedPlaceId;

        return (
          <Pressable
            key={place.id}
            accessibilityRole="button"
            accessibilityLabel={`Show ${place.name}`}
            onPress={() => onSelectPlace(place)}
            style={[
              styles.webMarker,
              {
                left: `${(point.x / WEB_MAP.width) * 100}%`,
                top: `${(point.y / WEB_MAP.height) * 100}%`,
                backgroundColor: selected ? colors.primary : colors.mapPin,
                transform: [{ translateX: -17 }, { translateY: -31 }],
              },
              selected && styles.webMarkerSelected,
            ]}
            testID={`map-marker-${place.id}`}
          >
            <Feather
              name={place.category === "Food" ? "coffee" : "map-pin"}
              size={selected ? 17 : 15}
              color={colors.primaryForeground}
            />
          </Pressable>
        );
      })}

      {userCoordinate ? (
        <View
          accessible
          accessibilityLabel="Your current location"
          style={[
            styles.webUserMarker,
            (() => {
              const point = projectToWebMap(userCoordinate);
              return {
                left: `${(point.x / WEB_MAP.width) * 100}%`,
                top: `${(point.y / WEB_MAP.height) * 100}%`,
              };
            })(),
          ]}
        >
          <View style={[styles.webUserMarkerCore, { backgroundColor: colors.primary }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
  },
  webMarker: {
    position: "absolute",
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#122C25",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  webMarkerSelected: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
  },
  webUserMarker: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateX: -13 }, { translateY: -13 }],
    shadowColor: "#122C25",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.24,
    shadowRadius: 3,
  },
  webUserMarkerCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
