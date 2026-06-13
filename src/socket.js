let io;

export const setSocketIO = socketInstance => {
  io = socketInstance;
};

export const getSocketIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
