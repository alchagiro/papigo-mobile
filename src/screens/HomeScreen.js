import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import { joinTrip, onStatusUpdated, onDriverCancelled } from "../services/socket";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectingPickup, setSelectingPickup] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [tripId, setTripId] = useState(null);
  const [driverCancelled, setDriverCancelled] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (tripId) {
      joinTrip(tripId);
      
      const unsubscribeStatus = onStatusUpdated((data) => {
        if (data.tripId === tripId) {
          if (data.status === "accepted") {
            navigation.navigate("TripProgress", { tripId });
          } else if (data.status === "cancelled") {
            setDriverCancelled(true);
          }
        }
      });

      return () => {
        unsubscribeStatus();
      };
    }
  }, [tripId]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const loc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setPickupLocation(loc);
        
        const address = await reverseGeocode(loc.latitude, loc.longitude);
        setPickupAddress(address);
        
        mapRef.current?.animateToRegion({
          ...loc,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 500);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      setPickupLocation({ latitude: 3.4516, longitude: -76.532 });
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (response[0]) {
        const addr = response[0];
        const formatted = [addr.streetNumber, addr.street, addr.city, addr.region]
          .filter(Boolean)
          .join(", ");
        return formatted || "Ubicacion seleccionada";
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    return "Ubicacion seleccionada";
  };

  const handleMapPress = async (e) => {
    const { coordinate } = e.nativeEvent;
    const address = await reverseGeocode(coordinate.latitude, coordinate.longitude);
    
    if (selectingPickup) {
      setPickupLocation(coordinate);
      setPickupAddress(address);
    } else {
      setDropoffLocation(coordinate);
      setDropoffAddress(address);
    }
    setShowMap(false);
  };

  const handleEstimateFare = async () => {
    if (!pickupLocation || !dropoffLocation) {
      Alert.alert("Error", "Por favor selecciona punto de recogida y destino");
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/trips/calculate-fare", {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
        pickupAddress,
        dropoffAddress,
      });
      setFareEstimate(response.data);
    } catch (error) {
      Alert.alert("Error", "Error al calcular tarifa");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTrip = async () => {
    if (!pickupAddress || !dropoffAddress || !pickupLocation || !dropoffLocation) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    setDriverCancelled(false);
    try {
      const response = await api.post("/trips/request", {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        pickupAddress,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
        dropoffAddress,
        fare: fareEstimate?.fare,
        paymentMethod: "card",
      });

      setTripId(response.data.id);
      navigation.navigate("TripProgress", { tripId: response.data.id });
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Error al solicitar viaje");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const formatCOP = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>UBER</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("TripHistory")}
          >
            <Text style={styles.headerButtonText}>Historial</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <Text style={styles.headerButtonText}>Cerrar Sesion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: pickupLocation?.latitude || 3.4516,
          longitude: pickupLocation?.longitude || -76.532,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {pickupLocation && (
          <Marker coordinate={pickupLocation} title="Recogida" pinColor="#00ab67" />
        )}
        {dropoffLocation && (
          <Marker coordinate={dropoffLocation} title="Destino" pinColor="#000" />
        )}
      </MapView>

      {driverCancelled && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>El conductor ha cancelado. Buscando otro conductor...</Text>
        </View>
      )}

      <View style={styles.formContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.formTitle}>Solicitar Viaje</Text>

          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              setSelectingPickup(true);
              setShowMap(true);
            }}
          >
            <Text style={styles.inputLabel}>Recogida</Text>
            <Text style={pickupAddress ? styles.inputText : styles.inputPlaceholder}>
              {pickupAddress || "Toca para seleccionar en mapa"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.input}
            onPress={() => {
              setSelectingPickup(false);
              setShowMap(true);
            }}
          >
            <Text style={styles.inputLabel}>Destino</Text>
            <Text style={dropoffAddress ? styles.inputText : styles.inputPlaceholder}>
              {dropoffAddress || "Toca para seleccionar en mapa"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleEstimateFare}
            disabled={loading || !pickupLocation || !dropoffLocation}
          >
            {loading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <Text style={styles.secondaryButtonText}>Calcular Tarifa</Text>
            )}
          </TouchableOpacity>

          {fareEstimate && (
            <View style={styles.fareContainer}>
              <Text style={styles.fareAmount}>{formatCOP(fareEstimate.fare)}</Text>
              <Text style={styles.fareDetails}>
                {fareEstimate.distance?.toFixed(1)} km - {fareEstimate.duration} min aprox
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRequestTrip}
            disabled={loading || !fareEstimate}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Solicitar Viaje</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectingPickup ? "Selecciona punto de recogida" : "Selecciona destino"}
            </Text>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Text style={styles.closeButton}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <MapView
            style={styles.fullMap}
            initialRegion={{
              latitude: pickupLocation?.latitude || 3.4516,
              longitude: pickupLocation?.longitude || -76.532,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onPress={handleMapPress}
            showsUserLocation={true}
          />
          <View style={styles.mapInstructions}>
            <Text style={styles.instructionText}>Toca en el mapa para seleccionar la ubicacion</Text>
          </View>
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerButtonText: {
    fontSize: 12,
    color: "#fff",
  },
  map: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "45%",
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    color: "#000",
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  inputText: {
    fontSize: 16,
    color: "#000",
  },
  inputPlaceholder: {
    fontSize: 16,
    color: "#999",
  },
  primaryButton: {
    backgroundColor: "#00ab67",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  fareContainer: {
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00ab67",
  },
  fareDetails: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  alertBanner: {
    backgroundColor: "#f8d7da",
    padding: 12,
    alignItems: "center",
  },
  alertText: {
    color: "#721c24",
    fontWeight: "600",
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
  fullMap: {
    flex: 1,
  },
  mapInstructions: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  instructionText: {
    color: "#666",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  negotiationModal: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  offerCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: "center",
  },
  offerLabel: {
    fontSize: 14,
    color: "#666",
  },
  offerAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#00ab67",
  },
  offerBy: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#00ab67",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  counterButton: {
    flex: 1,
    backgroundColor: "#276ef1",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
  },
});
