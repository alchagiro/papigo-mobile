import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";

export default function TripHistoryScreen({ navigation }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get("/trips/history");
      setTrips(response.data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const formatCOP = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Fecha no disponible";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabels = {
    pending: "Pendiente",
    accepted: "Aceptado",
    in_progress: "En curso",
    completed: "Completado",
    cancelled: "Cancelado",
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return { bg: "#d4edda", color: "#155724" };
      case "cancelled":
        return { bg: "#f8d7da", color: "#721c24" };
      case "in_progress":
        return { bg: "#cce5ff", color: "#004085" };
      case "accepted":
        return { bg: "#fff3cd", color: "#856404" };
      default:
        return { bg: "#f8f9fa", color: "#333" };
    }
  };

  const activeTrips = trips.filter(
    (t) => t.status === "pending" || t.status === "accepted" || t.status === "in_progress"
  );
  const pastTrips = trips.filter(
    (t) => t.status === "completed" || t.status === "cancelled"
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Atras</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ab67" />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {trips.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No hay viajes</Text>
              <Text style={styles.emptyText}>
                {user?.role === "driver"
                  ? "Aun no has completado viajes como conductor."
                  : "Aun no has solicitado viajes."}
              </Text>
            </View>
          ) : (
            <>
              {activeTrips.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Viajes Activos</Text>
                  {activeTrips.map((trip) => {
                    const statusColors = getStatusColor(trip.status);
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        style={styles.tripCard}
                        onPress={() => navigation.navigate("TripProgress", { tripId: trip.id })}
                      >
                        <View style={styles.tripHeader}>
                          <Text style={styles.tripDate}>{formatDate(trip.created_at)}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                            <Text style={[styles.statusText, { color: statusColors.color }]}>
                              {statusLabels[trip.status]}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.tripRoute}>
                          <View style={styles.routePoint}>
                            <View style={[styles.routeDot, { backgroundColor: "#00ab67" }]} />
                            <Text style={styles.routeText}>{trip.pickup_address}</Text>
                          </View>
                          <View style={styles.routePoint}>
                            <View style={[styles.routeDot, { backgroundColor: "#000" }]} />
                            <Text style={styles.routeText}>{trip.dropoff_address}</Text>
                          </View>
                        </View>
                        <View style={styles.tripFooter}>
                          {trip.driver_name && (
                            <Text style={styles.personText}>
                              Conductor: {trip.driver_name}
                            </Text>
                          )}
                          {trip.passenger_name && user?.role === "driver" && (
                            <Text style={styles.personText}>
                              Pasajero: {trip.passenger_name}
                            </Text>
                          )}
                          {trip.fare && (
                            <Text style={styles.fareText}>{formatCOP(trip.fare)}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {pastTrips.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Viajes Pasados</Text>
                  {pastTrips.map((trip) => {
                    const statusColors = getStatusColor(trip.status);
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        style={styles.tripCard}
                        onPress={() => navigation.navigate("TripProgress", { tripId: trip.id })}
                      >
                        <View style={styles.tripHeader}>
                          <Text style={styles.tripDate}>{formatDate(trip.created_at)}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                            <Text style={[styles.statusText, { color: statusColors.color }]}>
                              {statusLabels[trip.status]}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.tripRoute}>
                          <View style={styles.routePoint}>
                            <View style={[styles.routeDot, { backgroundColor: "#00ab67" }]} />
                            <Text style={styles.routeText}>{trip.pickup_address}</Text>
                          </View>
                          <View style={styles.routePoint}>
                            <View style={[styles.routeDot, { backgroundColor: "#000" }]} />
                            <Text style={styles.routeText}>{trip.dropoff_address}</Text>
                          </View>
                        </View>
                        <View style={styles.tripFooter}>
                          {trip.driver_name && (
                            <Text style={styles.personText}>
                              Conductor: {trip.driver_name}
                            </Text>
                          )}
                          {trip.passenger_name && user?.role === "driver" && (
                            <Text style={styles.personText}>
                              Pasajero: {trip.passenger_name}
                            </Text>
                          )}
                          {trip.fare && (
                            <Text style={styles.fareText}>{formatCOP(trip.fare)}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
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
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    paddingTop: 50,
  },
  backButton: {
    fontSize: 16,
    color: "#fff",
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
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
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tripDate: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  tripRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  routeText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  personText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  fareText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00ab67",
  },
});
