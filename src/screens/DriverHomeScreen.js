import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import { joinDrivers } from "../services/socket";

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
      }
    })();
  }, []);

  useEffect(() => {
    if (isActive) {
      joinDrivers();
      fetchPendingTrips();
      fetchActiveTrip();
      const interval = setInterval(() => {
        fetchPendingTrips();
        fetchActiveTrip();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  const fetchActiveTrip = async () => {
    try {
      const response = await api.get("/trips/history");
      const active = response.data.find((t) => t.status === "accepted" || t.status === "in_progress");
      setActiveTrip(active || null);
    } catch (error) {
      console.error("Failed to fetch active trip");
    }
  };

  const fetchPendingTrips = async () => {
    try {
      const response = await api.get("/trips/pending");
      setPendingTrips(response.data);
    } catch (error) {
      console.error("Failed to fetch trips");
    }
  };

  const handleToggleActive = async () => {
    try {
      // Si intenta desconectarse, verificar que no tenga viaje activo
      if (isActive && activeTrip) {
        Alert.alert("Error", "No puedes desconectarte mientras tienes un viaje activo. Completa o cancela el viaje primero.");
        return;
      }
      await api.patch("/drivers/status", { isActive: !isActive });
      setIsActive(!isActive);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to update status");
    }
  };

  const handleAcceptTrip = async (tripId) => {
    // Verificar si ya tiene un viaje activo
    if (activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled") {
      Alert.alert("Error", "Ya tienes un viaje activo. Debes completar o cancelar el viaje actual antes de aceptar uno nuevo.");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/trips/accept/${tripId}`);
      navigation.navigate("TripProgress", { tripId });
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Failed to accept trip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Mode</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.statusButton,
              isActive ? styles.statusOnline : styles.statusOffline,
            ]}
            onPress={handleToggleActive}
            disabled={isActive && activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled"}
          >
            <Text style={styles.statusButtonText}>
              {isActive ? "Go Offline" : "Go Online"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={logout}>
            <Text style={styles.headerButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>
            {isActive ? "You are online - Accepting trips" : "You are offline"}
          </Text>
        </View>

        {/* Mostrar viaje activo si existe */}
        {activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled" && (
          <View style={[styles.tripCard, { borderLeftWidth: 4, borderLeftColor: "#276ef1" }]}>
            <Text style={styles.tripTitle}>🚗 Active Trip</Text>
            <Text style={styles.tripText}>
              <Text style={styles.bold}>Status:</Text> {activeTrip.status === "accepted" ? "Driver en route" : "Trip in progress"}
            </Text>
            <Text style={styles.tripText}>
              <Text style={styles.bold}>Pickup:</Text> {activeTrip.pickup_address}
            </Text>
            <Text style={styles.tripText}>
              <Text style={styles.bold}>Dropoff:</Text> {activeTrip.dropoff_address}
            </Text>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => navigation.navigate("TripProgress", { tripId: activeTrip.id })}
            >
              <Text style={styles.acceptButtonText}>View Trip</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          Trip Requests ({pendingTrips.length})
        </Text>

        {pendingTrips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>No pending trips</Text>
          </View>
        ) : (
          pendingTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <Text style={styles.tripTitle}>Trip Request</Text>
              <Text style={styles.tripText}>
                <Text style={styles.bold}>Pickup:</Text> {trip.pickup_address}
              </Text>
              <Text style={styles.tripText}>
                <Text style={styles.bold}>Dropoff:</Text> {trip.dropoff_address}
              </Text>
              {trip.fare && (
                <Text style={styles.tripText}>
                  <Text style={styles.bold}>Fare:</Text> ${trip.fare}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.acceptButton, (activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled") ? styles.disabledButton : null]}
                onPress={() => handleAcceptTrip(trip.id)}
                disabled={loading || (activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled")}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.acceptButtonText}>
                    {(activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled") ? "Already have active trip" : "Accept Trip"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Your Location"
            pinColor="#276ef1"
          />
        </MapView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    paddingTop: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusOnline: {
    backgroundColor: "#e2272b",
  },
  statusOffline: {
    backgroundColor: "#276ef1",
  },
  statusButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
  },
  headerButtonText: {
    fontSize: 14,
    color: "#333",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
  },
  tripCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  tripText: {
    fontSize: 14,
    marginBottom: 4,
    color: "#333",
  },
  bold: {
    fontWeight: "600",
  },
  acceptButton: {
    backgroundColor: "#276ef1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  acceptButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    backgroundColor: "#cccccc",
  },
  map: {
    height: 200,
  },
});
