import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:3001/api";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    const { user: userData, token } = response.data;
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
    setUser(userData);
    return userData;
  };

  const logout = () => setUser(null);

  const value = { user, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export { api };
