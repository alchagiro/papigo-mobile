import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Image } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { onStatusUpdated, onDriverCancelled, onDriverPosition, joinTrip, leaveTrip, updateDriverLocation } from "../services/socket";
import { API_URL, SOCKET_URL, formatCOP, STATUS_BAR_HEIGHT } from "../config";
import { useAuth } from "../context/AuthContext";

const fetchWithAuth = async (path, options = {}) => {
  const token = await SecureStore.getItemAsync("token");
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

export default function TripProgressScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { user } = useAuth();
  const isDriver = user?.role === "driver";
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const driverLocationWatcher = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loadTrip = async () => {
    try {
      const data = await fetchWithAuth(`/trips/${tripId}`);
      if (mountedRef.current) setTrip(data);
    } catch (error) {
      if (mountedRef.current) Alert.alert("Error", "Error al cargar viaje: " + error.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
    joinTrip(tripId);

    const unsubStatus = onStatusUpdated((data) => {
      try {
        if (data.tripId === tripId && mountedRef.current) {
          setTrip((prev) => prev ? { ...prev, status: data.status } : prev);
        }
      } catch (e) { console.error("status-updated callback error:", e); }
    });

    const unsubCancelled = onDriverCancelled((data) => {
      try {
        if (data.tripId === tripId && mountedRef.current) {
          Alert.alert("Viaje cancelado", data.message || "El viaje fue cancelado");
          navigation.replace(isDriver ? "DriverHome" : "Home");
        }
      } catch (e) { console.error("driver-cancelled callback error:", e); }
    });

    const unsubDriverPos = onDriverPosition((data) => {
      try {
        if (mountedRef.current && data.lat && data.lng) {
          setDriverLocation({ latitude: data.lat, longitude: data.lng });
        }
      } catch (e) { console.error("driver-position callback error:", e); }
    });

    const pollInterval = setInterval(() => {
      loadTrip();
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      try { leaveTrip(tripId); } catch (e) { console.error("leaveTrip error:", e); }
      try { unsubStatus(); } catch (e) { console.error("unsubStatus error:", e); }
      try { unsubCancelled(); } catch (e) { console.error("unsubCancelled error:", e); }
      try { unsubDriverPos(); } catch (e) { console.error("unsubDriverPos error:", e); }
    };
  }, [tripId]);

  useEffect(() => {
    if (!isDriver || !trip || !user?.id) return;
    const activeStatuses = ["accepted", "in_progress"];
    if (!activeStatuses.includes(trip.status)) return;

    if (driverLocationWatcher.current) {
      driverLocationWatcher.current.remove();
      driverLocationWatcher.current = null;
    }

    const startWatching = async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return;
        const watcher = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            setDriverLocation({ latitude, longitude });
            updateDriverLocation({ driverId: user.id, lat: latitude, lng: longitude, tripId });
          }
        );
        if (mountedRef.current) driverLocationWatcher.current = watcher;
      } catch (e) {
        console.error("driver location watch error:", e);
      }
    };
    startWatching();

    return () => {
      if (driverLocationWatcher.current) {
        driverLocationWatcher.current.remove();
        driverLocationWatcher.current = null;
      }
    };
  }, [isDriver, trip?.status, user?.id]);

  const handleStartTrip = async () => {
    try {
      setActionLoading(true);
      await fetchWithAuth(`/trips/start/${tripId}`, { method: "POST" });
      if (mountedRef.current) loadTrip();
    } catch (error) {
      if (mountedRef.current) Alert.alert("Error", error.message);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    try {
      setActionLoading(true);
      const distance = trip?.distance ? parseFloat(trip.distance) : null;
      const duration = trip?.duration ? parseFloat(trip.duration) : null;
      await fetchWithAuth(`/trips/complete/${tripId}`, {
        method: "POST",
        body: JSON.stringify({
          distance: distance || 0,
          duration: duration || 0,
        }),
      });
      if (mountedRef.current) {
        Alert.alert("Viaje completado", "El viaje ha finalizado");
        loadTrip();
      }
    } catch (error) {
      if (mountedRef.current) Alert.alert("Error", error.message);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const handleCancelTrip = async () => {
    try {
      setActionLoading(true);
      const reason = isDriver ? "El conductor cancelo el viaje" : "El pasajero cancelo el viaje";
      await fetchWithAuth(`/trips/cancel/${tripId}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (mountedRef.current) {
        Alert.alert("Viaje cancelado", "Has cancelado el viaje");
        loadTrip();
      }
    } catch (error) {
      if (mountedRef.current) Alert.alert("Error", error.message);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ab67" />
        <Text style={styles.loadingText}>Cargando viaje...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se pudo cargar el viaje</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace(isDriver ? "DriverHome" : "Home")}>
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColors = {
    accepted: "#f59e0b",
    in_progress: "#3b82f6",
    completed: "#00ab67",
    cancelled: "#ef4444",
  };

  const statusLabels = {
    accepted: "Aceptado",
    in_progress: "En curso",
    completed: "Completado",
    cancelled: "Cancelado",
  };

  const pickupLat = trip.pickup_lat ? parseFloat(trip.pickup_lat) : null;
  const pickupLng = trip.pickup_lng ? parseFloat(trip.pickup_lng) : null;
  const dropoffLat = trip.dropoff_lat ? parseFloat(trip.dropoff_lat) : null;
  const dropoffLng = trip.dropoff_lng ? parseFloat(trip.dropoff_lng) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Viaje</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[trip.status] || "#666" }]}>
          <Text style={styles.statusText}>{statusLabels[trip.status] || trip.status}</Text>
        </View>
      </View>

      {(pickupLat && pickupLng) ? (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: pickupLat,
              longitude: pickupLng,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Marker
              coordinate={{ latitude: pickupLat, longitude: pickupLng }}
              title="Recogida"
              description={trip.pickup_address || ""}
              pinColor="#00ab67"
            />
            {(dropoffLat && dropoffLng) && (
              <Marker
                coordinate={{ latitude: dropoffLat, longitude: dropoffLng }}
                title="Destino"
                description={trip.dropoff_address || ""}
                pinColor="#ef4444"
              />
            )}
            {(pickupLat && pickupLng && dropoffLat && dropoffLng) && (
              <Polyline
                coordinates={[
                  { latitude: pickupLat, longitude: pickupLng },
                  { latitude: dropoffLat, longitude: dropoffLng },
                ]}
                strokeColor="#00ab67"
                strokeWidth={3}
              />
            )}
            {driverLocation && ["accepted", "in_progress"].includes(trip.status) && (
              <Marker
                coordinate={driverLocation}
                title={isDriver ? "Tu ubicacion" : "Conductor"}
                description={isDriver ? "" : "Ubicacion en tiempo real"}
                pinColor="#276ef1"
              />
            )}
          </MapView>
        </View>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>Ubicación no disponible</Text>
        </View>
      )}

      <ScrollView style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dirección de recogida</Text>
          <Text style={styles.infoValue}>{trip.pickup_address || "N/A"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Destino</Text>
          <Text style={styles.infoValue}>{trip.dropoff_address || "N/A"}</Text>
        </View>
          {trip.fare && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tarifa</Text>
              <Text style={styles.infoValue}>{formatCOP(trip.fare)}</Text>
            </View>
          )}
          {trip.offered_fare && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tarifa ofrecida</Text>
              <Text style={styles.infoValue}>{formatCOP(trip.offered_fare)}</Text>
            </View>
          )}
        {trip.distance && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distancia</Text>
            <Text style={styles.infoValue}>{parseFloat(trip.distance).toFixed(1)} km</Text>
          </View>
        )}
        {trip.duration && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duración</Text>
            <Text style={styles.infoValue}>{Math.round(parseFloat(trip.duration))} min</Text>
          </View>
        )}
        {trip.driver_name && (
          <View style={[styles.infoRow, styles.driverSection]}>
            <Text style={styles.infoLabel}>Conductor</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
              {trip.driver_photo_url && (
                <Image
                  source={{ uri: SOCKET_URL + trip.driver_photo_url }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.infoValue}>{trip.driver_name}</Text>
                {trip.driver_vehicle && (
                  <Text style={styles.infoSubValue}>
                    Vehiculo: {trip.driver_vehicle}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        {isDriver ? (
          <>
            {trip.status === "accepted" && (
              <TouchableOpacity style={styles.actionButton} onPress={handleStartTrip} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Iniciar viaje</Text>}
              </TouchableOpacity>
            )}
            {trip.status === "in_progress" && (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#00ab67" }]} onPress={handleCompleteTrip} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Completar viaje</Text>}
              </TouchableOpacity>
            )}
            {(trip.status === "accepted" || trip.status === "in_progress") && (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#ef4444", marginTop: 8 }]} onPress={handleCancelTrip} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Cancelar viaje</Text>}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {(trip.status === "pending" || trip.status === "accepted") && (
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#ef4444" }]} onPress={handleCancelTrip} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Cancelar viaje</Text>}
              </TouchableOpacity>
            )}
          </>
        )}
        {(trip.status === "completed" || trip.status === "cancelled") && (
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.replace(isDriver ? "DriverHome" : "Home")}>
            <Text style={styles.actionButtonText}>Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  errorText: { fontSize: 16, color: "#ef4444", marginBottom: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_HEIGHT + 4,
    paddingBottom: 12,
    backgroundColor: "#00ab67",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  mapContainer: { height: 220 },
  map: { flex: 1 },
  mapPlaceholder: { height: 220, justifyContent: "center", alignItems: "center", backgroundColor: "#f3f4f6" },
  mapPlaceholderText: { fontSize: 14, color: "#9ca3af" },
  infoSection: { flex: 1, padding: 16 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 12, color: "#9ca3af", marginBottom: 2 },
  infoValue: { fontSize: 16, color: "#1f2937", fontWeight: "500" },
  infoSubValue: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  driverSection: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 12, marginTop: 4 },
  actions: { padding: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  actionButton: {
    backgroundColor: "#00ab67",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
