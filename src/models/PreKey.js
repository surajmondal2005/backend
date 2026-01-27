import mongoose from "mongoose";

const preKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: Number,
      required: true,
    },
    keyId: {
      type: Number,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    keyType: {
      type: String,
      enum: ["signedPreKey", "oneTimePreKey"],
      required: true,
    },
    signature: {
      type: String,
      default: null, // Only for signed pre-keys
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Ensure unique key IDs per device
preKeySchema.index({ userId: 1, deviceId: 1, keyId: 1 }, { unique: true });

const PreKey = mongoose.models.PreKey || mongoose.model("PreKey", preKeySchema);
export default PreKey;