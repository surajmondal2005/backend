// src/routes/push.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/User.js";

const router = express.Router();

// Register device token
router.post("/register-fcm", protectRoute, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { fcmTokens: token } });
    res.json({ success: true });
  } catch (err) {
    console.error("register-fcm error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Unregister device token
router.post("/unregister-fcm", protectRoute, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token required" });

    await User.findByIdAndUpdate(req.user._id, { $pull: { fcmTokens: token } });
    res.json({ success: true });
  } catch (err) {
    console.error("unregister-fcm error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;