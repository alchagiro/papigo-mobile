import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import {
  joinDrivers,
  onNewTripRequest,
  onTripCancelled,
  updateDriverLocation,
} from "../services/socket";
import { API_URL, SOCKET_URL, formatCOP, STATUS_BAR_HEIGHT } from "../config";

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [filter, setFilter] = useState("day");
  const [profile, setProfile] = useState(null);
  const [ratingInfo, setRatingInfo] = useState(null);
  const [debtInfo, setDebtInfo] = useState(null);
  const locationInterval = useRef(null);
  const locationWatcher = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const filterLabels = {
    day: "Hoy",
    week: "Semana",
    month: "Mes",
    all: "Todo",
  };

  useEffect(() => {
    getLocation();
    fetchProfile();
    fetchRating();
    fetchDebt();
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
      if (locationWatcher.current) {
        locationWatcher.current.remove();
        locationWatcher.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isActive && user?.id) {
      joinDrivers(user.id);
      fetchPendingTrips();
      fetchActiveTrip();
      fetchEarnings();

      const interval = setInterval(() => {
        fetchPendingTrips();
        fetchActiveTrip();
        fetchEarnings();
      }, 5000);

      locationInterval.current = interval;

      return () => clearInterval(interval);
    }
  }, [isActive, user?.id, filter]);

  useEffect(() => {
    if (isActive) {
      const unsubscribeNewTrip = onNewTripRequest((data) => {
        fetchPendingTrips();
      });

      const unsubscribeCancelled = onTripCancelled((data) => {
        if (!data || !data.tripId || data.tripId !== activeTrip?.id) return;
        setActiveTrip(null);
        fetchPendingTrips();
      });

      return () => {
        unsubscribeNewTrip();
        unsubscribeCancelled();
      };
    }
  }, [isActive, activeTrip?.id]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 3000,
          },
          (loc) => {
            setLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });

            if (isActive && user?.id) {
              updateDriverLocation({
                driverId: user.id,
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                tripId: activeTrip?.id,
              });
            }
          }
        );
        locationWatcher.current = watcher;
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLocation({ latitude: 3.4516, longitude: -76.532 });
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await api.get("/drivers/profile");
      setProfile(response.data);
    } catch (error) {
      console.error("Failed to fetch profile");
    }
  };

  const fetchRating = async () => {
    try {
      const response = await api.get("/drivers/rating");
      setRatingInfo(response.data);
    } catch (error) {
      console.error("Failed to fetch rating");
    }
  };

  const fetchDebt = async () => {
    try {
      const response = await api.get("/earnings/debt");
      setDebtInfo(response.data);
    } catch (error) {
      console.error("Failed to fetch debt");
    }
  };

  const fetchWithAuth = async (path) => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return null;
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        logout();
        return null;
      }
      return res.json();
    } catch (error) {
      console.error(`fetchWithAuth error ${path}:`, error.message);
      return null;
    }
  };

  const fetchActiveTrip = async () => {
    try {
      const data = await fetchWithAuth("/trips/history");
      const trips = Array.isArray(data) ? data : [];
      const active = trips.find(
        (t) => t.status === "accepted" || t.status === "in_progress"
      );
      setActiveTrip(active || null);
    } catch (error) {
      console.error("Failed to fetch active trip");
    }
  };

  const fetchPendingTrips = async () => {
    try {
      const data = await fetchWithAuth("/trips/pending");
      setPendingTrips(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch trips");
    }
  };

  const fetchEarnings = async () => {
    try {
      const data = await fetchWithAuth("/trips/earnings");
      setEarnings(data || null);
    } catch (error) {
      console.error("Failed to fetch earnings");
    }
  };

  const handleToggleActive = async () => {
    if (isActive && activeTrip) {
      Alert.alert(
        "Error",
        "No puedes desconectarte mientras tienes un viaje activo. Completa o cancela el viaje primero."
      );
      return;
    }

    try {
      setLoading(true);
      await api.patch("/drivers/status", { isActive: !isActive });
      setIsActive(!isActive);
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.error || "Error al cambiar estado");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTrip = async (tripId) => {
    if (activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled") {
      Alert.alert(
        "Error",
        "Ya tienes un viaje activo. Debes completar o cancelar el viaje actual."
      );
      return;
    }

    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        Alert.alert("Error", "Sesion expirada. Inicia sesion nuevamente.");
        logout();
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_URL}/trips/accept/${tripId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert("Error", data.error || "Error al aceptar el viaje");
        setLoading(false);
        return;
      }
      setLoading(false);
      navigation.replace("TripProgress", { tripId: data.id || tripId });
    } catch (error) {
      Alert.alert("Error", error.message || "Error al aceptar el viaje");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PapiGo - Conductor</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("TripHistory")}
          >
            <Text style={styles.headerButtonText}>Historial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.statusButton,
              isActive ? styles.statusOnline : styles.statusOffline,
            ]}
            onPress={handleToggleActive}
            disabled={loading || (isActive && activeTrip)}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.statusButtonText}>
                {isActive ? "Desconectar" : "Conectar"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={logout}>
            <Text style={styles.headerButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.statusCard, isActive ? styles.onlineCard : styles.offlineCard]}>
          <Text style={styles.statusText}>
            {isActive ? "Conectado - Aceptando viajes" : "Desconectado"}
          </Text>
        </View>

        {profile && (
          <View style={styles.profileCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {profile.photo_url && (
                <Image
                  source={{ uri: SOCKET_URL + profile.photo_url }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{profile.name || user?.name}</Text>
                {ratingInfo && (
                  <Text style={styles.profileRating}>
                    ★ {parseFloat(ratingInfo.average).toFixed(1)} ({ratingInfo.count} votos)
                  </Text>
                )}
                {profile.vehicle_type && (
                  <Text style={styles.profileVehicle}>
                    Vehiculo: {profile.vehicle_type === "motorcycle" ? "Moto" : "Carro"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.earningsHeader}>
          <Text style={styles.sectionTitle}>Mis Ganancias</Text>
          <TouchableOpacity
            style={styles.earningsModalButton}
            onPress={() => setShowEarnings(true)}
          >
            <Text style={styles.earningsModalButtonText}>Ver detalle</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterGroup}>
          {["day", "week", "month", "all"].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterButton, filter === f && styles.filterActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {filterLabels[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {earnings && earnings.total_earnings !== undefined && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: "#276ef1" }]}>
              <Text style={styles.statValue}>{formatCOP(earnings.total_earnings || 0)}</Text>
              <Text style={styles.statLabel}>Ganancia Total ({filterLabels[filter]})</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#00ab67" }]}>
              <Text style={[styles.statValue, { color: "#00ab67" }]}>{formatCOP(earnings.net_earnings || 0)}</Text>
              <Text style={styles.statLabel}>Ganancia Neta</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#ffc107" }]}>
              <Text style={styles.statValue}>{formatCOP(earnings.platform_commission || 0)}</Text>
              <Text style={styles.statLabel}>Comision Plataforma</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#000" }]}>
              <Text style={styles.statValue}>{earnings.total_trips || 0}</Text>
              <Text style={styles.statLabel}>Viajes Completados</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#d93025" }]}>
              <Text style={styles.statValue}>{parseFloat(earnings.total_distance || 0).toFixed(1)} km</Text>
              <Text style={styles.statLabel}>Distancia</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#666" }]}>
              <Text style={styles.statValue}>{formatCOP(earnings.total_bonuses || 0)}</Text>
              <Text style={styles.statLabel}>Bonos Usados</Text>
            </View>
          </View>
        )}

        {debtInfo && (
          <View style={styles.debtCard}>
            <Text style={styles.debtTitle}>Deuda con Plataforma</Text>
            <View style={styles.debtRow}>
              <Text style={styles.debtLabel}>Monto pendiente:</Text>
              <Text style={styles.debtValue}>{formatCOP(debtInfo.amount_owed || 0)}</Text>
            </View>
            <View style={styles.debtRow}>
              <Text style={styles.debtLabel}>Comision:</Text>
              <Text style={styles.debtValue}>{debtInfo.platform_percentage || 25}%</Text>
            </View>
            {debtInfo.last_payment && (
              <View style={styles.debtRow}>
                <Text style={styles.debtLabel}>Ultimo pago:</Text>
                <Text style={styles.debtValue}>
                  {new Date(debtInfo.last_payment).toLocaleDateString("es-CO")}
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled" && (
          <View style={[styles.tripCard, { borderLeftWidth: 4, borderLeftColor: "#00ab67" }]}>
            <Text style={styles.tripTitle}>Viaje Activo</Text>
            <Text style={styles.tripText}>
              Estado: {activeTrip.status === "accepted" ? "Conductor en camino" : "Viaje en curso"}
            </Text>
            <Text style={styles.tripText}>Recogida: {activeTrip.pickup_address}</Text>
            <Text style={styles.tripText}>Destino: {activeTrip.dropoff_address}</Text>
            <Text style={styles.tripText}>Tarifa: {formatCOP(activeTrip.fare)}</Text>

            <TouchableOpacity
              style={styles.viewTripButton}
              onPress={() => navigation.navigate("TripProgress", { tripId: activeTrip.id })}
            >
              <Text style={styles.viewTripButtonText}>Ver Viaje</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Solicitudes de Viaje ({pendingTrips.length})</Text>

        {pendingTrips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyText}>No hay viajes pendientes</Text>
          </View>
        ) : (
          pendingTrips.map((trip) => (
            <View key={trip.id} style={styles.tripCard}>
              <Text style={styles.tripTitle}>
                {trip.vehicle_type === "motorcycle" ? "Moto" : "Carro"}
              </Text>
              <Text style={styles.tripText}>Recogida: {trip.pickup_address}</Text>
              <Text style={styles.tripText}>Destino: {trip.dropoff_address}</Text>
              <Text style={styles.tripText}>Pasajero: {trip.passenger_name}</Text>
              {trip.fare && (
                <Text style={[styles.tripText, { fontWeight: "bold", color: "#00ab67" }]}>
                  Tarifa: {formatCOP(trip.fare)}
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled"
                    ? styles.disabledButton
                    : null,
                ]}
                onPress={() => handleAcceptTrip(trip.id)}
                disabled={loading || (activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled")}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.acceptButtonText}>
                    {activeTrip && activeTrip.status !== "completed" && activeTrip.status !== "cancelled"
                      ? "Ya tienes viaje activo"
                      : "Aceptar Viaje"}
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
            coordinate={location}
            title="Tu Ubicacion"
            pinColor="#00ab67"
          />
        </MapView>
      )}

      <Modal visible={showEarnings} animationType="slide" onRequestClose={() => setShowEarnings(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Mis Ganancias</Text>
            <TouchableOpacity onPress={() => setShowEarnings(false)}>
              <Text style={styles.closeButton}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {earnings && (
              <>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Ganancia Total</Text>
                  <Text style={styles.earningsValue}>{formatCOP(earnings.total_earnings)}</Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Ganancia Neta</Text>
                  <Text style={[styles.earningsValue, { color: "#00ab67" }]}>
                    {formatCOP(earnings.net_earnings)}
                  </Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Comision Plataforma</Text>
                  <Text style={styles.earningsValue}>{formatCOP(earnings.platform_commission)}</Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Viajes Completados</Text>
                  <Text style={styles.earningsValue}>{earnings.total_trips}</Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Distancia Total</Text>
                  <Text style={styles.earningsValue}>{parseFloat(earnings.total_distance || 0).toFixed(1)} km</Text>
                </View>
                <View style={styles.earningsCard}>
                  <Text style={styles.earningsLabel}>Bonos Usados</Text>
                  <Text style={styles.earningsValue}>{formatCOP(earnings.total_bonuses || 0)}</Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    backgroundColor: "#000",
    paddingTop: STATUS_BAR_HEIGHT + 8,
    flexWrap: "wrap",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerButtonText: {
    fontSize: 12,
    color: "#fff",
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusOnline: {
    backgroundColor: "#d93025",
  },
  statusOffline: {
    backgroundColor: "#00ab67",
  },
  statusButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  onlineCard: {
    backgroundColor: "#e8f5e9",
  },
  offlineCard: {
    backgroundColor: "#ffebee",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
  },
  profileCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  profileRating: {
    fontSize: 14,
    color: "#f9ab00",
    fontWeight: "600",
    marginTop: 4,
  },
  profileVehicle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  earningsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  earningsModalButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#276ef1",
  },
  earningsModalButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  filterGroup: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  filterActive: {
    backgroundColor: "#000",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "47%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  debtCard: {
    backgroundColor: "#fff3cd",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ffc107",
  },
  debtTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#856404",
    marginBottom: 8,
  },
  debtRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  debtLabel: {
    fontSize: 14,
    color: "#856404",
  },
  debtValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#856404",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 2,
  },
  tripTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  tripText: {
    fontSize: 14,
    marginBottom: 4,
    color: "#333",
  },
  acceptButton: {
    backgroundColor: "#00ab67",
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
    backgroundColor: "#ccc",
  },
  viewTripButton: {
    backgroundColor: "#276ef1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  viewTripButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  map: {
    height: 180,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    paddingTop: STATUS_BAR_HEIGHT + 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    color: "#fff",
    fontSize: 16,
  },
  modalContent: {
    padding: 16,
  },
  earningsCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  earningsLabel: {
    fontSize: 14,
    color: "#666",
  },
  earningsValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
});
