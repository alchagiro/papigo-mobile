import Constants from "expo-constants";

const EXTRA = Constants.expoConfig?.extra || {};

export const API_URL = EXTRA.API_URL || "http://localhost:3001/api";
export const SOCKET_URL = EXTRA.SOCKET_URL || "http://localhost:3001";
