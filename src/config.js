import Constants from "expo-constants";
import { Platform } from "react-native";

const EXTRA = Constants.expoConfig?.extra || {};

export const API_URL = EXTRA.API_URL || "http://localhost:3001/api";
export const SOCKET_URL = EXTRA.SOCKET_URL || "http://localhost:3001";

export const STATUS_BAR_HEIGHT = Constants.statusBarHeight || (Platform.OS === "android" ? 24 : 44);

export const formatCOP = (amount) => {
  if (amount === null || amount === undefined || amount === "") return "N/A";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    try {
      return `$${Number(amount).toLocaleString("es-CO")}`;
    } catch {
      return `$${amount}`;
    }
  }
};

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
