// src/routes/user.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  pinUser,
  unpinUser,
  getPinnedUsers,
} from "../controllers/user.controller.js";

const router = express.Router();

// Protect all user routes
router.use(protectRoute);

// Block/Unblock
router.post("/block/:id", blockUser);
router.post("/unblock/:id", unblockUser);
router.get("/blocked", getBlockedUsers);

// Pin / Unpin
router.post("/pin/:id", pinUser);
router.post("/unpin/:id", unpinUser);
router.get("/pinned", getPinnedUsers);

export default router;