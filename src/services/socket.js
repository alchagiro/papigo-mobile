import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001";

let socket = null;

export const initSocket = () => {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    autoConnect: true,
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) return initSocket();
  return socket;
};

export const joinTrip = (tripId) => {
  const socket = getSocket();
  socket.emit("join-trip", tripId);
};

export const updateDriverLocation = (data) => {
  const socket = getSocket();
  socket.emit("driver-location", data);
};

export const sendTripStatusUpdate = (data) => {
  const socket = getSocket();
  socket.emit("trip-status-update", data);
};

export const onDriverPosition = (callback) => {
  const socket = getSocket();
  socket.on("driver-position", callback);
  return () => socket.off("driver-position", callback);
};

export const onStatusUpdated = (callback) => {
  const socket = getSocket();
  socket.on("status-updated", callback);
  return () => socket.off("status-updated", callback);
};

export const joinDrivers = () => {
  const socket = getSocket();
  socket.emit("join-drivers");
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
