import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
  Modal,
  TextInput,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import {
  joinTrip,
  onDriverPosition,
  onStatusUpdated,
  updateDriverLocation,
  sendTripStatusUpdate,
  onDriverCancelled,
} from "../services/socket";

export default function TripProgressScreen({ route, navigation }) {
  const { tripId } = route.params;
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [driverPos, setDriverPos] = useState(null);
  const [driverCancelled, setDriverCancelled] = useState(false);
  const locationWatchId = useRef(null);

  useEffect(() => {
    fetchTrip();
    joinTrip(tripId);

    const unsubscribePosition = onDriverPosition((data) => {
      if (data.tripId === tripId) {
        setDriverPos({ latitude: data.lat, longitude: data.lng });
      }
    });

    const unsubscribeStatus = onStatusUpdated((data) => {
      if (data.tripId === tripId) {
        fetchTrip();
        if (data.status === "completed") {
          Alert.alert("Viaje Completado", "El viaje ha sido completado exitosamente.");
        } else if (data.status === "cancelled") {
          setDriverCancelled(true);
        }
      }
    });

    const unsubscribeCancelled = onDriverCancelled((data) => {
      if (data.tripId === tripId) {
        setDriverCancelled(true);
      }
    });

    const backAction = () => {
      if (trip && ["pending", "accepted", "in_progress"].includes(trip.status)) {
        Alert.alert(
          "Viaje Activo",
          "Tienes un viaje activo. El viaje seguira activo.",
          [{ text: "OK" }]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    if (user?.role === "driver") {
      startLocationTracking();
    }

    return () => {
      unsubscribePosition();
      unsubscribeStatus();
      unsubscribeCancelled();
      backHandler.remove();
      stopLocationTracking();
    };
  }, [tripId]);

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        locationWatchId.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 3000,
          },
          (loc) => {
            updateDriverLocation({
              driverId: user.id,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              tripId,
            });
          }
        );
      }
    } catch (error) {
      console.error("Error tracking location:", error);
    }
  };

  const stopLocationTracking = () => {
    if (locationWatchId.current) {
      locationWatchId.current.remove();
      locationWatchId.current = null;
    }
  };

  const fetchTrip = async () => {
    try {
      const response = await api.get(`/trips/${tripId}`);
      setTrip(response.data);
    } catch (error) {
      Alert.alert("Error", "Error al cargar el viaje");
    }
  };

  const handleStartTrip = async () => {
    setLoading(true);
    try {
      await api.post(`/trips/start/${tripId}`);
      sendTripStatusUpdate({ tripId, status: "in_progress" });
      fetchTrip();
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Error al iniciar viaje");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    setLoading(true);
    try {
      await api.post(`/trips/complete/${tripId}`, {
        distance: trip.distance || 5,
        duration: trip.duration || 15,
        fare: trip.fare || trip.offered_fare,
      });
      sendTripStatusUpdate({ tripId, status: "completed" });
      fetchTrip();
      Alert.alert("Exito", "Viaje completado exitosamente");
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Error al completar viaje");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      "Cancelar Viaje",
      "Estas seguro de que quieres cancelar este viaje?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Si, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await api.post(`/trips/cancel/${tripId}`);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", error.response?.data?.error || "Error al cancelar viaje");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitRating = async () => {
    if (!rating) {
      Alert.alert("Error", "Por favor selecciona una calificacion");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/ratings`, {
        tripId,
        rating,
        comment,
        driverId: trip.driver_id,
      });
      Alert.alert("Exito", "Gracias por tu calificacion!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Error al enviar calificacion");
    } finally {
      setLoading(false);
    }
  };

  const formatCOP = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statusLabels = {
    pending: "Esperando conductor...",
    accepted: "Conductor en camino!",
    in_progress: "Viaje en curso",
    completed: "Viaje completado",
    cancelled: "Viaje cancelado",
  };

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ab67" />
        <Text style={styles.loadingText}>Cargando detalles del viaje...</Text>
      </View>
    );
  }

  if (driverCancelled) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Viaje</Text>
        </View>
        <View style={styles.cancelledContainer}>
          <Text style={styles.cancelledIcon}>🚗</Text>
          <Text style={styles.cancelledTitle}>Conductor Cancelo</Text>
          <Text style={styles.cancelledText}>Buscando otro conductor cercano...</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.primaryButtonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (trip && ["pending", "accepted", "in_progress"].includes(trip.status)) {
              Alert.alert(
                "Viaje Activo",
                "El viaje seguira activo.",
                [{ text: "OK" }]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.backButtonText}>← Atras</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Viaje</Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: trip.pickup_lat || 3.4516,
          longitude: trip.pickup_lng || -76.532,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <Marker
          coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }}
          title="Recogida"
          pinColor="#00ab67"
        />
        <Marker
          coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }}
          title="Destino"
          pinColor="#000"
        />
        {driverPos && (
          <Marker
            coordinate={driverPos}
            title="Conductor"
            pinColor="#276ef1"
          />
        )}
      </MapView>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.status}>{statusLabels[trip.status]}</Text>
          <View style={[styles.statusBadge, styles[`status${trip.status}`]]}>
            <Text style={styles.statusBadgeText}>{trip.status}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informacion del Viaje</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recogida:</Text>
            <Text style={styles.detailText}>{trip.pickup_address}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Destino:</Text>
            <Text style={styles.detailText}>{trip.dropoff_address}</Text>
          </View>
          {trip.distance && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Distancia:</Text>
              <Text style={styles.detailText}>{trip.distance?.toFixed(1)} km</Text>
            </View>
          )}
          {trip.duration && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Duracion:</Text>
              <Text style={styles.detailText}>~{trip.duration} min</Text>
            </View>
          )}
        </View>

        {trip.fare && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tarifa</Text>
            <Text style={styles.fareAmount}>{formatCOP(trip.fare)}</Text>
          </View>
        )}

        {trip.driver_name && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Conductor</Text>
            <Text style={styles.personName}>{trip.driver_name}</Text>
          </View>
        )}

        {trip.passenger_name && user?.role === "driver" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pasajero</Text>
            <Text style={styles.personName}>{trip.passenger_name}</Text>
          </View>
        )}

        {user?.role === "driver" && trip.status === "accepted" && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={handleStartTrip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Iniciar Viaje</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}

        {user?.role === "driver" && trip.status === "in_progress" && (
          <TouchableOpacity
            style={[styles.button, styles.completeButton]}
            onPress={handleCompleteTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Completar Viaje</Text>
            )}
          </TouchableOpacity>
        )}

        {(trip.status === "completed" || trip.status === "cancelled") && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {user?.role === "passenger" && trip.status === "completed" && (
        <View style={styles.ratingContainer}>
          <Text style={styles.cardTitle}>Califica a tu conductor</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[styles.star, star <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Agrega un comentario (opcional)"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity
            style={[styles.button, styles.ratingButton]}
            onPress={handleSubmitRating}
            disabled={!rating || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Enviar Calificacion</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {(trip.status === "completed" || trip.status === "cancelled") && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>Volver al Inicio</Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000",
    paddingTop: 50,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: "#fff",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  map: {
    height: 250,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  status: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  statusBadge: {
    alignSelf: "flex-start",
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
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    color: "#333",
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    fontWeight: "600",
    color: "#666",
    width: 80,
  },
  detailText: {
    flex: 1,
    color: "#333",
  },
  fareAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#00ab67",
  },
  offerInfo: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#00ab67",
  },
  completeButton: {
    backgroundColor: "#00ab67",
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: "#d93025",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  ratingButton: {
    backgroundColor: "#00ab67",
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  ratingContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  star: {
    fontSize: 36,
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
    minHeight: 80,
    textAlignVertical: "top",
  },
  secondaryButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  primaryButton: {
    backgroundColor: "#00ab67",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelledContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  cancelledIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  cancelledTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  cancelledText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
});
