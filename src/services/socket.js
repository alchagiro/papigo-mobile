import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";

let socket = null;

const activeRooms = {
  trip: null,
  driver: null,
  callbacks: [],
};

export const initSocket = () => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    console.log("Socket connected");
    if (activeRooms.trip) {
      socket.emit("join-trip", activeRooms.trip);
    }
    if (activeRooms.driver) {
      socket.emit("join-drivers", { driverId: activeRooms.driver });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error.message);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) return initSocket();
  return socket;
};

export const joinTrip = (tripId) => {
  activeRooms.trip = tripId;
  const s = getSocket();
  s.emit("join-trip", tripId);
};

export const leaveTrip = (tripId) => {
  if (activeRooms.trip === tripId) {
    activeRooms.trip = null;
  }
};

export const joinDrivers = (driverId) => {
  activeRooms.driver = driverId;
  const s = getSocket();
  s.emit("join-drivers", { driverId });
};

export const updateDriverLocation = (data) => {
  const s = getSocket();
  s.emit("driver-location", data);
};

export const sendTripStatusUpdate = (data) => {
  const s = getSocket();
  s.emit("trip-status-update", data);
};

export const onDriverPosition = (callback) => {
  const s = getSocket();
  s.on("driver-position", callback);
  return () => s.off("driver-position", callback);
};

export const onStatusUpdated = (callback) => {
  const s = getSocket();
  s.on("status-updated", callback);
  return () => s.off("status-updated", callback);
};

export const onNewTripRequest = (callback) => {
  const s = getSocket();
  s.on("new-trip-request", callback);
  return () => s.off("new-trip-request", callback);
};

export const onDriverCancelled = (callback) => {
  const s = getSocket();
  s.on("driver-cancelled", callback);
  return () => s.off("driver-cancelled", callback);
};

export const onTripCancelled = (callback) => {
  const s = getSocket();
  s.on("trip-cancelled", callback);
  return () => s.off("trip-cancelled", callback);
};

export const disconnectSocket = () => {
  activeRooms.trip = null;
  activeRooms.driver = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
