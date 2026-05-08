import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";

export default function TripHistoryScreen({ navigation }) {
  const { logout } = useAuth();
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const response = await api.get("/trips/history");
      setTrips(response.data);
    } catch (error) {
      console.error("Failed to fetch trips");
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip History</Text>
        <TouchableOpacity style={styles.headerButton} onPress={logout}>
          <Text style={styles.headerButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No trips yet</Text>
          </View>
        ) : (
          trips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.tripCard}
              onPress={() =>
                navigation.navigate("TripProgress", { tripId: trip.id })
              }
            >
              <View style={styles.tripHeader}>
                <Text style={styles.date}>{formatDate(trip.created_at)}</Text>
                <View style={[styles.statusBadge, styles[`status${trip.status}`]]}>
                  <Text style={styles.statusText}>{trip.status}</Text>
                </View>
              </View>
              <Text style={styles.detail}>
                <Text style={styles.bold}>From:</Text> {trip.pickup_address}
              </Text>
              <Text style={styles.detail}>
                <Text style={styles.bold}>To:</Text> {trip.dropoff_address}
              </Text>
              {trip.fare && (
                <Text style={styles.detail}>
                  <Text style={styles.bold}>Fare:</Text> ${trip.fare} |{" "}
                  <Text style={styles.bold}>Distance:</Text> {trip.distance} km
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    paddingTop: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 4,
  },
  backButton: {
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#276ef1",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
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
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  date: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statuspending: {
    backgroundColor: "#fff3cd",
  },
  statusaccepted: {
    backgroundColor: "#cce5ff",
  },
  statusin_progress: {
    backgroundColor: "#d4edda",
  },
  statuscompleted: {
    backgroundColor: "#d4edda",
  },
  statuscancelled: {
    backgroundColor: "#f8d7da",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  detail: {
    fontSize: 14,
    marginBottom: 4,
    color: "#333",
  },
  bold: {
    fontWeight: "600",
  },
});
