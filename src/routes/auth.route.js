import express from "express";
import { signup, login, logout, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload, uploadAndCompressFile } from "../middleware/upload.middleware.js";

const router = express.Router();

// AUTH
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

// UPDATE PROFILE PIC
// IMPORTANT: field must be "file"
router.put("/update-profile", protectRoute, uploadAndCompressFile, updateProfile);

// CHECK SESSION
router.get("/check", protectRoute, (req, res) => res.status(200).json(req.user));

export default router;