import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useAuth } from "../context/AuthContext";
import { api } from "../context/AuthContext";
import { joinTrip, onStatusUpdated } from "../services/socket";

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupLocation, setPickupLocation] = useState({
    latitude: 40.7128,
    longitude: -74.006,
  });
  const [dropoffLocation, setDropoffLocation] = useState({
    latitude: 40.758,
    longitude: -73.9855,
  });
  const [fareEstimate, setFareEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setPickupLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  const handleEstimateFare = async () => {
    try {
      const response = await api.post("/trips/calculate-fare", {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
      });
      setFareEstimate(response.data);
    } catch (error) {
      Alert.alert("Error", "Failed to calculate fare");
    }
  };

  const handleRequestTrip = async () => {
    if (!pickupAddress || !dropoffAddress) {
      Alert.alert("Error", "Please enter pickup and dropoff addresses");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/trips/request", {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        pickupAddress,
        dropoffLat: dropoffLocation.latitude,
        dropoffLng: dropoffLocation.longitude,
        dropoffAddress,
        paymentMethod: "card",
      });

      joinTrip(response.data.id);
      onStatusUpdated((data) => {
        if (data.status === "accepted") {
          navigation.navigate("TripProgress", { tripId: response.data.id });
        }
      });

      navigation.navigate("TripProgress", { tripId: response.data.id });
    } catch (error) {
      Alert.alert("Error", "Failed to request trip");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Uber Clone</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("TripHistory")}
          >
            <Text style={styles.headerButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <Text style={styles.headerButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MapView
        style={styles.map}
        initialRegion={{
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker
          coordinate={pickupLocation}
          title="Pickup"
          pinColor="#276ef1"
        />
        <Marker
          coordinate={dropoffLocation}
          title="Dropoff"
          pinColor="#000000"
        />
      </MapView>

      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Request a Ride</Text>

        <TextInput
          style={styles.input}
          placeholder="Pickup address"
          value={pickupAddress}
          onChangeText={setPickupAddress}
        />

        <TextInput
          style={styles.input}
          placeholder="Dropoff address"
          value={dropoffAddress}
          onChangeText={setDropoffAddress}
        />

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleEstimateFare}
        >
          <Text style={styles.secondaryButtonText}>Estimate Fare</Text>
        </TouchableOpacity>

        {fareEstimate && (
          <View style={styles.fareContainer}>
            <Text style={styles.fareAmount}>${fareEstimate.fare}</Text>
            <Text style={styles.fareDetails}>
              {fareEstimate.distance} km • {fareEstimate.duration} min
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleRequestTrip}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryButtonText}>Request Ride</Text>
          )}
        </TouchableOpacity>
      </View>
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
  map: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  primaryButton: {
    backgroundColor: "#000",
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
    backgroundColor: "#666",
  },
  fareContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  fareDetails: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
});
