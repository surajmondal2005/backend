// src/models/Message.js - UPDATED VERSION
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    image: { type: String, default: null },
    file: { type: String, default: null },

    // ENCRYPTION SUPPORT
    ciphertext: {
      type: String,
      default: "",
    },
    messageType: {
      type: String,
      enum: ["PreKeySignalMessage", "SignalMessage", "SenderKeyMessage", "plaintext", "image"],
      default: "plaintext",
    },
    senderDeviceId: {
      type: Number,
      default: 1,
    },
    conversationId: {
      type: String,
      index: true,
    },
    sequenceNumber: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },

    // DELETION FIELDS
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      deleteType: { type: String, enum: ["forMe", "forEveryone"] },
      deletedAt: { type: Date, default: Date.now }
    }],

    // EDITION FIELDS
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: { 
      type: Date, 
      default: null 
    },
    editHistory: [{
      text: String,
      editedAt: Date
    }],

    // REACTIONS
    reactions: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      emoji: String,
      createdAt: { type: Date, default: Date.now }
    }],
  },
  { timestamps: true }
);

// Indexes for performance
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, sequenceNumber: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ "deletedBy.userId": 1 });

// Guard against model overwrite in watch / hot-reload environments
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;