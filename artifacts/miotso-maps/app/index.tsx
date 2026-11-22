import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import type MapView from "react-native-maps";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CampusMap } from "@/components/CampusMap";
import {
  CAMPUS_CENTER,
  CAMPUS_PLACES,
  OSM_ATTRIBUTION,
  type CampusPlace,
  type Coordinate,
  type PlaceCategory,
} from "@/constants/campus";
import { useColors } from "@/hooks/useColors";

const CATEGORIES: Array<"All" | PlaceCategory> = [
  "All",
  "Campus",
  "Academic",
  "Food",
  "Services",
];

function placesFor(category: "All" | PlaceCategory, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return CAMPUS_PLACES.filter((place) => {
    const matchesCategory = category === "All" || place.category === category;
    const matchesQuery =
      normalizedQuery.length === 0 ||
      `${place.name} ${place.category} ${place.note}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);

    return matchesCategory && matchesQuery;
  });
}

export default function CampusHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | PlaceCategory>("All");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    CAMPUS_PLACES[0]?.id ?? null,
  );
  const [userCoordinate, setUserCoordinate] = useState<Coordinate | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationNeedsSettings, setLocationNeedsSettings] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOpeningDirections, setIsOpeningDirections] = useState(false);
  const [permission, requestPermission] = Location.useForegroundPermissions();

  const visiblePlaces = useMemo(
    () => placesFor(category, query),
    [category, query],
  );
  const selectedPlace = useMemo(
    () =>
      visiblePlaces.find((place) => place.id === selectedPlaceId) ??
      (query.trim().length > 0
        ? (visiblePlaces[0] ?? null)
        : (CAMPUS_PLACES.find((place) => place.id === selectedPlaceId) ?? null)),
    [query, selectedPlaceId, visiblePlaces],
  );
  const topInset = insets.top + (Platform.OS === "web" ? 67 : 8);
  const bottomInset = insets.bottom + (Platform.OS === "web" ? 34 : 12);

  const selectPlace = (place: CampusPlace) => {
    setSelectedPlaceId(place.id);
    setLocationMessage(null);
    Keyboard.dismiss();
    void Haptics.selectionAsync();
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      450,
    );
  };

  const showUserLocation = async () => {
    setIsLocating(true);
    setLocationMessage(null);
    setLocationNeedsSettings(false);

    try {
      let coordinate: Coordinate;

      if (Platform.OS === "web") {
        if (!globalThis.navigator?.geolocation) {
          throw new Error("Location is not available in this browser.");
        }

        coordinate = await new Promise<Coordinate>((resolve, reject) => {
          globalThis.navigator.geolocation.getCurrentPosition(
            (position) =>
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            (error) => {
              reject(
                new Error(
                  error.code === 1
                    ? "Location access was denied."
                    : "Could not find your location. Check your device settings.",
                ),
              );
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
          );
        });
      } else {
        const currentPermission = permission?.granted
          ? permission
          : await requestPermission();

        if (!currentPermission.granted) {
          setLocationNeedsSettings(!currentPermission.canAskAgain);
          throw new Error("Allow location access to show where you are.");
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coordinate = {
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        };
      }

      setUserCoordinate(coordinate);
      mapRef.current?.animateToRegion(
        {
          ...coordinate,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        550,
      );
      void Haptics.selectionAsync();
    } catch (error) {
      setLocationMessage(
        error instanceof Error
          ? error.message
          : "Could not get your location. Try again.",
      );
    } finally {
      setIsLocating(false);
    }
  };

  const openLocationSettings = async () => {
    try {
      if (Platform.OS !== "web") {
        await Linking.openSettings();
      }
    } catch {
      setLocationMessage("Open your device settings to allow location access.");
    }
  };

  const openDirections = async (place: CampusPlace) => {
    setIsOpeningDirections(true);
    setLocationMessage(null);
    const origin = userCoordinate
      ? `&origin=${userCoordinate.latitude},${userCoordinate.longitude}`
      : "";
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=walking${origin}`;

    try {
      await Linking.openURL(url);
    } catch {
      setLocationMessage("Could not open walking directions. Try again.");
    } finally {
      setIsOpeningDirections(false);
    }
  };

  const chooseCategory = (nextCategory: "All" | PlaceCategory) => {
    setCategory(nextCategory);
    const nextPlace = placesFor(nextCategory, query)[0];
    setSelectedPlaceId(nextPlace?.id ?? null);
    Keyboard.dismiss();
  };

  const setSearchText = (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) {
      const nextPlace = placesFor(category, "")[0];
      setSelectedPlaceId(nextPlace?.id ?? null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.mapCanvas }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <StatusBar style="dark" />
      <CampusMap
        mapRef={mapRef}
        places={visiblePlaces}
        selectedPlaceId={selectedPlace?.id ?? null}
        userCoordinate={userCoordinate}
        onSelectPlace={selectPlace}
      />

      <View style={[styles.topOverlay, { paddingTop: topInset }]}>
        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              CENTRAL UNIVERSITY · MIOTSO
            </Text>
            <Text style={[styles.heading, { color: colors.foreground }]}>
              Find your way around.
            </Text>
          </View>
          <View
            accessible
            accessibilityLabel={`${CAMPUS_PLACES.length} mapped places`}
            style={[styles.placeCount, { backgroundColor: colors.card }]}
          >
            <Feather name="map-pin" size={13} color={colors.primary} />
            <Text style={[styles.placeCountText, { color: colors.foreground }]}>
              {CAMPUS_PLACES.length}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={19} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Search campus places"
            testID="place-search"
            value={query}
            onChangeText={setSearchText}
            placeholder="Search places on campus"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              testID="clear-search"
              hitSlop={10}
              onPress={() => setSearchText("")}
              style={styles.clearButton}
            >
              <Feather name="x" size={17} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Feather name="sliders" size={17} color={colors.mutedForeground} />
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((item) => {
            const active = category === item;

            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`category-${item.toLowerCase()}`}
                onPress={() => chooseCategory(item)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {query.trim().length > 0 ? (
          <View
            style={[
              styles.resultsCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {visiblePlaces.length > 0 ? (
              visiblePlaces.slice(0, 5).map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  testID={`search-result-${place.id}`}
                  onPress={() => selectPlace(place)}
                  style={({ pressed }) => [
                    styles.resultRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.resultIcon,
                      { backgroundColor: colors.secondary },
                    ]}
                  >
                    <Feather
                      name={
                        place.category === "Food"
                          ? "coffee"
                          : place.category === "Academic"
                            ? "book-open"
                            : place.category === "Services"
                              ? "briefcase"
                              : "map"
                      }
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.resultCopy}>
                    <Text style={[styles.resultName, { color: colors.foreground }]}>
                      {place.name}
                    </Text>
                    <Text
                      style={[
                        styles.resultDescription,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {place.category} · {place.note}
                    </Text>
                  </View>
                  <Feather
                    name="arrow-up-left"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              ))
            ) : (
              <View style={styles.noResults}>
                <Feather name="search" size={18} color={colors.mutedForeground} />
                <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                  No mapped places match “{query.trim()}”.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {locationMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.locationMessage,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.locationMessageText, { color: colors.foreground }]}>
              {locationMessage}
            </Text>
            {locationNeedsSettings ? (
              <Pressable
                accessibilityRole="button"
                testID="open-location-settings"
                onPress={openLocationSettings}
              >
                <Text style={[styles.settingsLink, { color: colors.primary }]}>
                  Settings
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              onPress={() => setLocationMessage(null)}
              hitSlop={8}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.mapActions, { bottom: bottomInset + 214 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          testID="show-my-location"
          disabled={isLocating}
          onPress={showUserLocation}
          style={({ pressed }) => [
            styles.locationButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && !isLocating && styles.pressed,
          ]}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="crosshair" size={18} color={colors.primary} />
          )}
          <Text style={[styles.locationButtonText, { color: colors.foreground }]}>
            My location
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to Central University"
          testID="recenter-campus"
          onPress={() => {
            mapRef.current?.animateToRegion(
              {
                ...CAMPUS_CENTER,
                latitudeDelta: 0.018,
                longitudeDelta: 0.018,
              },
              450,
            );
            setSelectedPlaceId(CAMPUS_PLACES[0]?.id ?? null);
          }}
          style={({ pressed }) => [
            styles.recenterButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="map" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View
        style={[
          styles.placeCard,
          {
            bottom: bottomInset,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {selectedPlace ? (
          <>
            <View style={styles.cardTopRow}>
              <View
                style={[
                  styles.cardIcon,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Feather
                  name={
                    selectedPlace.category === "Food"
                      ? "coffee"
                      : selectedPlace.category === "Academic"
                        ? "book-open"
                        : selectedPlace.category === "Services"
                          ? "briefcase"
                          : "map-pin"
                  }
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.cardCopy}>
                <Text
                  style={[styles.cardCategory, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {selectedPlace.category.toUpperCase()}
                </Text>
                <Text
                  style={[styles.cardTitle, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {selectedPlace.name}
                </Text>
                <Text
                  style={[styles.cardSubtitle, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {selectedPlace.note}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Directions to ${selectedPlace.name}`}
                testID="open-directions"
                onPress={() => void openDirections(selectedPlace)}
                disabled={isOpeningDirections}
                style={({ pressed }) => [
                  styles.directionsButton,
                  { backgroundColor: colors.primary },
                  pressed && !isOpeningDirections && styles.pressed,
                ]}
              >
                {isOpeningDirections ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather
                    name="navigation"
                    size={16}
                    color={colors.primaryForeground}
                  />
                )}
                <Text
                  style={[
                    styles.directionsText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Directions
                </Text>
              </Pressable>
            </View>
            <View
              style={[
                styles.dataNotice,
                { borderTopColor: colors.border },
              ]}
            >
              <Feather name="info" size={13} color={colors.mutedForeground} />
              <Text
                style={[styles.dataNoticeText, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                Community map points may need confirmation with the university.
              </Text>
            </View>
            <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
              {OSM_ATTRIBUTION}
            </Text>
          </>
        ) : (
          <View style={styles.emptyPlaceCard}>
            <View style={[styles.cardIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="map-pin" size={19} color={colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                No mapped places found
              </Text>
              <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
                Try another search or category.
              </Text>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 11,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: 4,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.45,
  },
  placeCount: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  placeCountText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  searchBar: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 3,
  },
  categoryList: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderRadius: 18,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  categoryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  resultsCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  resultRow: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 11,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  resultCopy: {
    flex: 1,
    gap: 3,
  },
  resultName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  resultDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  noResults: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
  },
  noResultsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flexShrink: 1,
  },
  locationMessage: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  locationMessageText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  settingsLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  mapActions: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  locationButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  locationButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  recenterButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  placeCard: {
    position: "absolute",
    left: 14,
    right: 14,
    paddingTop: 15,
    paddingHorizontal: 15,
    paddingBottom: 11,
    borderWidth: 1,
    borderRadius: 21,
    shadowColor: "#153A2F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    gap: 3,
  },
  cardCategory: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  directionsButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  directionsText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  dataNotice: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  dataNoticeText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  attribution: {
    marginTop: 7,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    textAlign: "right",
  },
  emptyPlaceCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: {
    opacity: 0.78,
  },
});
