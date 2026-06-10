import React, { createContext, useState, useContext, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "../config";
import { disconnectSocket } from "../services/socket";

let secureStoreAvailable = true;

const storage = {
  getItem: async (key) => {
    try {
      if (secureStoreAvailable) {
        return await SecureStore.getItemAsync(key);
      }
    } catch (e) {
      secureStoreAvailable = false;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      if (secureStoreAvailable) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch (e) {
      secureStoreAvailable = false;
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error("Storage setItem error:", e);
    }
  },
  deleteItem: async (key) => {
    try {
      if (secureStoreAvailable) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      secureStoreAvailable = false;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error("Storage deleteItem error:", e);
    }
  },
};

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Error getting token:", error);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await storage.deleteItem("token");
      await storage.deleteItem("user");
    }
    if (error.response?.status === 403) {
      const data = error.response?.data;
      if (data?.suspended || data?.pendingApproval) {
        await storage.deleteItem("token");
        await storage.deleteItem("user");
      }
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await storage.getItem("token");
      const userData = await storage.getItem("user");
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const { user: userData, token } = response.data;
    await storage.setItem("token", token);
    await storage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (name, email, phone, password, role) => {
    const response = await api.post("/auth/register", {
      name,
      email,
      phone,
      password,
      role,
    });
    if (role === "driver") {
      return { ...response.data, pendingApproval: true };
    }
    const { user: userData, token } = response.data;
    await storage.setItem("token", token);
    await storage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    disconnectSocket();
    try {
      await storage.deleteItem("token");
      await storage.deleteItem("user");
    } catch (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
  };

  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export { api, storage };
