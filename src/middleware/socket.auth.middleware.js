import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ENV } from "../lib/env.js";

export const socketAuthMiddleware = async (socket, next) => {
  try {
    // Extract token from cookies in the socket handshake
    const cookieHeader = socket.handshake.headers?.cookie || "";
    const token = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("jwt="))
      ?.split("=")[1] || socket.handshake.auth?.token;

    if (!token) {
      console.log("Socket connection rejected: No token provided");
      return next(new Error("Unauthorized - No Token Provided"));
    }

    // Verify JWT
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    if (!decoded) {
      console.log("Socket connection rejected: Invalid token");
      return next(new Error("Unauthorized - Invalid Token"));
    }

    // Find the authenticated user
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.log("Socket connection rejected: User not found");
      return next(new Error("User not found"));
    }

    // Attach user data to socket
    socket.user = user;
    socket.userId = user._id.toString();

    console.log(`✅ Socket authenticated for user: ${user.fullName} (${user._id})`);

    next();
  } catch (error) {
    console.error("Error in socket authentication:", error.message);
    next(new Error("Unauthorized - Authentication failed"));
  }
};