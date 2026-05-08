import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import DriverHomeScreen from "./screens/DriverHomeScreen";
import TripProgressScreen from "./screens/TripProgressScreen";
import TripHistoryScreen from "./screens/TripHistoryScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        user.role === "driver" ? (
          <>
            <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
            <Stack.Screen name="TripProgress" component={TripProgressScreen} />
            <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="TripProgress" component={TripProgressScreen} />
            <Stack.Screen name="TripHistory" component={TripHistoryScreen} />
          </>
        )
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
