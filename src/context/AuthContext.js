import React, { createContext, useState, useContext, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { API_URL } from "../config";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Error getting token:", error);
  }
  return config;
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync("token");
      const userData = await SecureStore.getItemAsync("user");
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
    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(userData));
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
    const { user: userData, token } = response.data;
    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync("token");
      await SecureStore.deleteItemAsync("user");
    } catch (error) {
      console.error("Error logging out:", error);
    }
    setUser(null);
  };

  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export { api };
