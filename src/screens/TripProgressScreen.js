import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import {
  joinTrip,
  onDriverPosition,
  onStatusUpdated,
  updateDriverLocation,
  sendTripStatusUpdate,
} from "../services/socket";

export default function TripProgressScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [driverPos, setDriverPos] = useState(null);

  // Prevenir que el usuario regrese atras durante un viaje activo
  useEffect(() => {
    const backAction = () => {
      if (trip && ["pending", "accepted", "in_progress"].includes(trip.status)) {
        Alert.alert("Viaje Activo", "Tienes un viaje activo. ¿Estas seguro de que quieres salir? El viaje seguira activo.", [
          { text: "No", style: "cancel", onPress: () => {} },
          { text: "Si, salir", style: "destructive", onPress: () => navigation.goBack() },
        ]);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [trip, navigation]);

  useEffect(() => {
    fetchTrip();
    joinTrip(tripId);

    onDriverPosition((data) => {
      setDriverPos(data);
    });

    onStatusUpdated((data) => {
      if (data.tripId === tripId) {
        fetchTrip();
      }
    });
  }, [tripId]);

  useEffect(() => {
    if (user?.role === "driver" && trip?.status === "in_progress") {
      const interval = setInterval(() => {
        updateDriverLocation({
          driverId: user.id,
          lat: 40.7128 + Math.random() * 0.01,
          lng: -74.006 + Math.random() * 0.01,
          tripId,
        });
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [user?.role, trip?.status]);

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${tripId}`);
      setTrip(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to load trip");
    }
  };

  const handleStartTrip = async () => {
    setLoading(true);
    try {
      await api.post(`/trips/start/${tripId}`);
      sendTripStatusUpdate({ tripId, status: "in_progress" });
      fetchTrip();
    } catch (error) {
      Alert.alert("Error", "Failed to start trip");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    setLoading(true);
    try {
      await api.post(`/trips/complete/${tripId}`, {
        distance: trip.distance || 5.2,
        duration: trip.duration || 15,
        fare: trip.fare || 12.5,
      });
      fetchTrip();
    } catch (error) {
      Alert.alert("Error", "Failed to complete trip");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post(`/trips/cancel/${tripId}`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to cancel trip");
    }
  };

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Loading trip details...</Text>
      </View>
    );
  }

  const statusLabels = {
    pending: "Waiting for driver...",
    accepted: "Driver is on the way!",
    in_progress: "Trip in progress",
    completed: "Trip completed",
    cancelled: "Trip cancelled",
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (trip && ["pending", "accepted", "in_progress"].includes(trip.status)) {
              Alert.alert("Viaje Activo", "Tienes un viaje activo. ¿Estás seguro de que quieres salir? El viaje seguirá activo.", [
                { text: "No", style: "cancel" },
                { text: "Sí, salir", style: "destructive", onPress: () => navigation.goBack() },
              ]);
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip</Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: trip.pickup_lat,
          longitude: trip.pickup_lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker
          coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }}
          title="Pickup"
          pinColor="#276ef1"
        />
        <Marker
          coordinate={{
            latitude: trip.dropoff_lat,
            longitude: trip.dropoff_lng,
          }}
          title="Dropoff"
          pinColor="#000"
        />
        {driverPos && (
          <Marker
            coordinate={{ latitude: driverPos.lat, longitude: driverPos.lng }}
            title="Driver"
            pinColor="#00c853"
          />
        )}
      </MapView>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.status}>{statusLabels[trip.status]}</Text>
          <Text style={styles.detail}>
            <Text style={styles.bold}>Pickup:</Text> {trip.pickup_address}
          </Text>
          <Text style={styles.detail}>
            <Text style={styles.bold}>Dropoff:</Text> {trip.dropoff_address}
          </Text>
          {trip.fare && (
            <Text style={styles.detail}>
              <Text style={styles.bold}>Fare:</Text> ${trip.fare}
            </Text>
          )}
          <View style={[styles.statusBadge, styles[`status${trip.status}`]]}>
            <Text style={styles.statusText}>{trip.status}</Text>
          </View>
        </View>

        {user?.role === "driver" && trip.status === "accepted" && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.successButton}
              onPress={handleStartTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Start Trip</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={handleCancel}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {user?.role === "driver" && trip.status === "in_progress" && (
          <TouchableOpacity
            style={styles.successButton}
            onPress={handleCompleteTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Complete Trip</Text>
            )}
          </TouchableOpacity>
        )}

        {user?.role === "passenger" && trip.status === "completed" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rate your driver</Text>
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text
                    style={[styles.star, star <= rating && styles.starActive]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={!rating}
            >
              <Text style={styles.primaryButtonText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    paddingTop: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 4,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: "#276ef1",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  map: {
    height: 300,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  status: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  detail: {
    fontSize: 14,
    marginBottom: 4,
  },
  bold: {
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
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
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  successButton: {
    flex: 1,
    backgroundColor: "#276ef1",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  dangerButton: {
    flex: 1,
    backgroundColor: "#e2272b",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  star: {
    fontSize: 32,
    color: "#ddd",
  },
  starActive: {
    color: "#ffc107",
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
});
