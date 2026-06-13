import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

import { app } from "./app.js";
import { connectDB } from "./db/index.js";

import http from "http";
import { Server } from "socket.io";
import { setSocketIO } from "./socket.js";

setSocketIO(io);

io.on("connection", socket => {
  console.log("User Connected:", socket.id);
  socket.on("join", userId => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 8500;
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log("Server is Running on PORT: ", PORT);
    });
  })
  .catch(error => {
    console.log("Database connection Failed: ", error);
  });
