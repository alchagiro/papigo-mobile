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
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import { 
  joinDrivers, 
  onNewTripRequest, 
  onTripCancelled,
  updateDriverLocation,
} from "../services/socket";

export default function DriverHomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [pendingTrips, setPendingTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const locationInterval = useRef(null);

  useEffect(() => {
    getLocation();
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
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
  }, [isActive, user?.id]);

  useEffect(() => {
    if (isActive) {
      const unsubscribeNewTrip = onNewTripRequest((data) => {
        fetchPendingTrips();
      });

      const unsubscribeCancelled = onTripCancelled((data) => {
        if (data.tripId === activeTrip?.id) {
          setActiveTrip(null);
          fetchPendingTrips();
        }
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

        Location.watchPositionAsync(
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
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setLocation({ latitude: 3.4516, longitude: -76.532 });
    }
  };

  const fetchActiveTrip = async () => {
    try {
      const response = await api.get("/trips/history");
      const active = response.data.find(
        (t) => t.status === "accepted" || t.status === "in_progress"
      );
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

  const fetchEarnings = async () => {
    try {
      const response = await api.get("/trips/earnings");
      setEarnings(response.data);
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
      Alert.alert("Error", error.response?.data?.error || "Error al cambiar estado");
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

    setLoading(true);
    try {
      await api.post(`/trips/accept/${tripId}`);
      fetchPendingTrips();
      fetchActiveTrip();
      navigation.navigate("TripProgress", { tripId });
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Error al aceptar viaje");
    } finally {
      setLoading(false);
    }
  };

  const formatCOP = (amount) => {
    if (!amount && amount !== 0) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UBER - Conductor</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowEarnings(true)}
          >
            <Text style={styles.headerButtonText}>Ganancias</Text>
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
                {trip.vehicle_type === "motorcycle" ? "🏍️ Moto" : "🚗 Carro"}
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
    paddingTop: 50,
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
    paddingTop: 50,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
