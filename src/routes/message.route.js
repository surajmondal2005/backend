// src/routes/message.route.js - UPDATED VERSION
import express from "express";
import {
  getAllContacts,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
  markMessageAsRead,
  searchMessages,
  clearChatForMe,
  deleteMessageForMe,
  deleteMessageForEveryone,
  editMessage,
  getMessageEditHistory,
  addReaction,
  removeReaction,
} from "../controllers/message.controller.js";

import { protectRoute } from "../middleware/auth.middleware.js";
import { uploadSingle, uploadAndCompressFile, debugUpload } from "../middleware/upload.middleware.js";

const router = express.Router();

// Debug route for testing uploads
router.post("/debug-upload", debugUpload, (req, res) => {
  res.json({ 
    message: "Debug endpoint",
    headers: req.headers,
    body: req.body 
  });
});

// ALL MESSAGE ROUTES REQUIRE AUTH
router.use(protectRoute);

// GET CONTACTS
router.get("/contacts", getAllContacts);

// GET CHAT PARTNERS LIST
router.get("/chats", getChatPartners);

// GET ALL MESSAGES WITH A USER
router.get("/:id", getMessagesByUserId);

// SEND MESSAGE (TEXT OR IMAGE)
router.post("/send/:id", uploadAndCompressFile, sendMessage);

// MARK AS READ (BLUE TICKS)
router.put("/read/:messageId", markMessageAsRead);

// SEARCH MESSAGES
router.get("/search/:userId", searchMessages);

// ========== MESSAGE DELETION ROUTES ==========
router.delete("/delete-for-me/:messageId", deleteMessageForMe);
router.delete("/delete-for-everyone/:messageId", deleteMessageForEveryone);
router.delete("/clear-chat/:userId", clearChatForMe);

// ========== MESSAGE EDITING ROUTES ==========
router.put("/edit/:messageId", editMessage);
router.get("/edit-history/:messageId", getMessageEditHistory);

// ========== MESSAGE REACTIONS ROUTES ==========
router.post("/react/:messageId", addReaction);
router.delete("/react/:messageId", removeReaction);

export default router;