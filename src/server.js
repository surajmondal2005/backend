// src/server.js - COMPLETE FIXED VERSION
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import cors from "cors";
import fs from "fs";
import "dotenv/config";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import userRoutes from "./routes/user.route.js";
import pushRoutes from "./routes/push.route.js";

// 🔐 ADD THESE 2 LINES FOR ENCRYPTION
import keysRoutes from "./routes/keys.route.js";
import filesRoutes from "./routes/files.route.js";

import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = ENV.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// ========== GLOBAL MIDDLEWARE ==========
// Updated JSON limits with raw body capture
app.use(express.json({ 
  limit: "10mb", 
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: "10mb" 
}));

app.use(cookieParser());

// Serve uploaded files from the uploads folder (public)
app.use("/uploads", express.static(uploadsDir));

// CORS — allow mobile apps + web
const corsOptions = {
  origin: ENV.CLIENT_URL || "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Pre-flight requests

// Add JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parsing error:', err.message);
    return res.status(400).json({ 
      error: 'Invalid JSON format in request body' 
    });
  }
  next();
});

// ========== API ROUTES ==========
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/push", pushRoutes);

// 🔐 ADD THESE 2 LINES FOR ENCRYPTION
app.use("/api/keys", keysRoutes);
app.use("/api/files", filesRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "chatbox-backend"
  });
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ 
      error: 'File upload error', 
      message: err.message,
      code: err.code 
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error', 
      message: err.message 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: ENV.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found` 
  });
});

// ========== SERVE FRONTEND (PRODUCTION ONLY) ==========
if (ENV.NODE_ENV === "production") {
  const frontendDir = path.join(__dirname, "../frontend/dist");
  
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    app.get("*", (req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
    console.log("✅ Serving frontend from:", frontendDir);
  } else {
    console.log("⚠️ Frontend directory not found:", frontendDir);
  }
}

// ========== START SERVER ==========
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Environment: ${ENV.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS origin: ${ENV.CLIENT_URL || '*'}`);
  
  // Connect to database
  connectDB().catch(err => {
    console.error("❌ Failed to connect to database:", err);
    process.exit(1);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});