import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
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
    registrationId: {
      type: Number,
      required: true,
    },
    identityKey: {
      type: String,
      required: true, // Public identity key
    },
    signedPreKey: {
      keyId: { type: Number, required: true },
      publicKey: { type: String, required: true },
      signature: { type: String, required: true },
    },
    oneTimePreKeys: [{
      keyId: { type: Number, required: true },
      publicKey: { type: String, required: true },
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure unique device per user
deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

const Device = mongoose.models.Device || mongoose.model("Device", deviceSchema);
export default Device;