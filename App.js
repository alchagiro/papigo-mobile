import React, { useRef, useEffect, createRef, useState } from "react";
import { View, ActivityIndicator, Alert, Platform, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import DriverHomeScreen from "./src/screens/DriverHomeScreen";
import TripProgressScreen from "./src/screens/TripProgressScreen";
import TripHistoryScreen from "./src/screens/TripHistoryScreen";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { API_URL, STATUS_BAR_HEIGHT } from "./src/config";

// Capturador global de errores no manejados
if (global.ErrorUtils) {
  const origHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error("GLOBAL_ERROR:", error?.message, error?.stack);
    if (isFatal) {
      try {
        const msg = `Error: ${error?.name}\n${error?.message}\nStack:\n${(error?.stack || "").split("\n").slice(0, 4).join("\n")}`;
        Alert.alert("ERROR FATAL", msg);
      } catch (_) {}
      setTimeout(() => origHandler(error, isFatal), 100);
    }
  });
}

// Capturar promesas rechazadas no manejadas
if (global.addEventListener) {
  global.addEventListener("unhandledrejection", (event) => {
    const err = event?.reason || event;
    console.error("UNHANDLED_PROMISE:", err?.message, err?.stack);
    try {
      Alert.alert("Error en promesa", `${err?.name || "Error"}: ${err?.message || "desconocido"}`);
    } catch (_) {}
  });
}

const Stack = createNativeStackNavigator();
const navigationRef = createRef();

function AppNavigator() {
  const { user, loading } = useAuth();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (loading) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!user) {
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } else {
      const home = user.role === "driver" ? "DriverHome" : "Home";
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: home }],
      });
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#00ab67" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={user ? (user.role === "driver" ? "DriverHome" : "Home") : "Login"}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      <Stack.Screen name="TripProgress" component={TripProgressScreen} />
      <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
    </Stack.Navigator>
  );
}

function NetworkBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        await fetch(API_URL, { method: "HEAD", signal: controller.signal });
        clearTimeout(id);
        if (mounted) setOnline(true);
      } catch {
        if (mounted) setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  if (online) return null;
  return (
    <View style={styles.networkBanner}>
      <Text style={styles.networkBannerText}>Sin conexion a internet</Text>
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
        <NetworkBanner />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  networkBanner: {
    position: "absolute",
    top: STATUS_BAR_HEIGHT,
    left: 0,
    right: 0,
    backgroundColor: "#ef4444",
    padding: 8,
    alignItems: "center",
    zIndex: 9999,
  },
  networkBannerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});
