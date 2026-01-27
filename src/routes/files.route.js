import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload, uploadAndCompressFile } from "../middleware/upload.middleware.js";
import {
  uploadEncryptedFile,
  getEncryptedFile,
  getConversationFiles,
  deleteEncryptedFile
} from "../controllers/files.controller.js";

const router = express.Router();

// Upload encrypted file
router.post("/upload", protectRoute, uploadAndCompressFile, uploadEncryptedFile);

// Get encrypted file metadata
router.get("/:fileId", protectRoute, getEncryptedFile);

// Get files for conversation
router.get("/conversation/:conversationId", protectRoute, getConversationFiles);

// Delete encrypted file
router.delete("/:fileId", protectRoute, deleteEncryptedFile);

export default router;