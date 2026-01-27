// src/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    fullName: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    profilePic: {
      type: String,
      default: "",
    },

    fcmTokens: {
      type: [String],
      default: [],
    },

    // BLOCK / PIN FEATURES
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pinnedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;