import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import {
  CAMPUS_INITIAL_REGION,
  CAMPUS_OUTLINE,
  type CampusPlace,
  type Coordinate,
} from "@/constants/campus";
import { useColors } from "@/hooks/useColors";

export type CampusMapProps = {
  mapRef: React.RefObject<MapView | null>;
  places: CampusPlace[];
  selectedPlaceId: string | null;
  userCoordinate: Coordinate | null;
  onSelectPlace: (place: CampusPlace) => void;
};

export function CampusMap({
  mapRef,
  places,
  selectedPlaceId,
  userCoordinate,
  onSelectPlace,
}: CampusMapProps) {
  const colors = useColors();

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={CAMPUS_INITIAL_REGION}
      mapType="hybrid"
      showsCompass={false}
      showsScale={false}
      showsBuildings
      showsUserLocation={userCoordinate !== null}
      showsMyLocationButton={false}
      loadingEnabled
      toolbarEnabled={false}
      accessibilityLabel="Map of Central University Miotso"
      testID="campus-map"
    >
      <Polygon
        coordinates={CAMPUS_OUTLINE}
        strokeColor={colors.primary}
        strokeWidth={2}
        fillColor={`${colors.primary}18`}
      />
      {places.map((place) => (
        <Marker
          key={place.id}
          coordinate={place}
          title={place.name}
          description={place.note}
          pinColor={place.id === selectedPlaceId ? colors.primary : colors.mapPin}
          onPress={() => onSelectPlace(place)}
          tracksViewChanges={false}
          testID={`map-marker-${place.id}`}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFill,
  },
});
