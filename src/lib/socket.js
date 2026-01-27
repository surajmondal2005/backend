import express from "express";
import http from "http";
import { Server } from "socket.io";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";

export const app = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: ENV.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});

const onlineUsers = new Map();

// Use the separate auth middleware
io.use(socketAuthMiddleware);

export const getReceiverSocketId = (receiverId) => {
  return onlineUsers.get(receiverId);
};

io.on("connection", (socket) => {
  const userId = socket.userId;

  if (!userId) {
    console.error("Socket connected without userId");
    socket.disconnect();
    return;
  }

  onlineUsers.set(userId, socket.id);

  console.log("🟢 User connected:", userId);

  // Broadcast updated online users list
  io.emit("onlineUsers", Array.from(onlineUsers.keys()));

  socket.on("typing", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { from: userId });
    }
  });

  socket.on("stopTyping", ({ to }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { from: userId });
    }
  });

  socket.on("messageRead", ({ messageId, senderId }) => {
    const receiverSocketId = getReceiverSocketId(senderId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageRead", { messageId });
    }
  });

  // ========== NEW: MESSAGE MANAGEMENT EVENTS ==========

  // Handle message deletion events from frontend
  socket.on("requestDeleteMessage", async ({ messageId, deleteType }) => {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} requested delete ${deleteType} for message ${messageId}`);
      
      // This is just for logging/realtime coordination
      // Actual deletion happens via REST API
      
      // You can add additional validation or rate limiting here
      
    } catch (error) {
      console.error("Error in requestDeleteMessage socket event:", error);
      socket.emit("error", { message: "Failed to process delete request" });
    }
  });

  // Handle message edit events from frontend
  socket.on("requestEditMessage", async ({ messageId, newText }) => {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} requested edit for message ${messageId}`);
      
      // This is just for logging/realtime coordination
      // Actual editing happens via REST API
      
    } catch (error) {
      console.error("Error in requestEditMessage socket event:", error);
      socket.emit("error", { message: "Failed to process edit request" });
    }
  });

  // Handle reaction events from frontend
  socket.on("requestReaction", async ({ messageId, emoji }) => {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} reacted with ${emoji} to message ${messageId}`);
      
      // This is just for logging/realtime coordination
      // Actual reaction handling happens via REST API
      
    } catch (error) {
      console.error("Error in requestReaction socket event:", error);
      socket.emit("error", { message: "Failed to process reaction" });
    }
  });

  // ========== NEW: FORWARD MESSAGE EVENT ==========
  socket.on("requestForwardMessage", async ({ messageId, toUsers }) => {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} requested to forward message ${messageId} to ${toUsers.length} users`);
      
      // This is just for logging
      // Actual forwarding would need to be implemented
      
    } catch (error) {
      console.error("Error in requestForwardMessage socket event:", error);
      socket.emit("error", { message: "Failed to process forward request" });
    }
  });

  // ========== NEW: MESSAGE STAR/FAVORITE EVENT ==========
  socket.on("requestStarMessage", async ({ messageId, starred }) => {
    try {
      const userId = socket.userId;
      console.log(`User ${userId} ${starred ? 'starred' : 'unstarred'} message ${messageId}`);
      
      // This is just for logging
      // Actual starring would need message schema extension
      
    } catch (error) {
      console.error("Error in requestStarMessage socket event:", error);
      socket.emit("error", { message: "Failed to process star request" });
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    console.log("🔴 User disconnected:", userId);
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});