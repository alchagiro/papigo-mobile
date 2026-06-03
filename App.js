import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import DriverHomeScreen from "./screens/DriverHomeScreen";
import TripProgressScreen from "./screens/TripProgressScreen";
import TripHistoryScreen from "./screens/TripHistoryScreen";
import { AuthProvider } from "./context/AuthContext";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
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
      </NavigationContainer>
    </AuthProvider>
  );
}
