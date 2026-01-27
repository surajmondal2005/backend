import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  registerDevice,
  getPreKeyBundle,
  getIdentityKey,
  updateSignedPreKey,
  addOneTimePreKeys
} from "../controllers/keys.controller.js";

const router = express.Router();

// Register device with keys (Signal Protocol X3DH)
router.post("/register", protectRoute, registerDevice);

// Get pre-key bundle for user (X3DH initialization)
router.get("/:userId", protectRoute, getPreKeyBundle);

// Get identity key for user
router.get("/:userId/identity", protectRoute, getIdentityKey);

// Update signed pre-key
router.put("/signed-prekey", protectRoute, updateSignedPreKey);

// Add one-time pre-keys
router.post("/one-time", protectRoute, addOneTimePreKeys);

export default router;