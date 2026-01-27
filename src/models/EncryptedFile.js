import mongoose from "mongoose";

const encryptedFileSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      required: true,
      unique: true,
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    encryptedFileUrl: {
      type: String,
      required: true, // URL to encrypted file on cloud storage
    },
    encryptedFileKey: {
      type: String,
      required: true, // Encrypted file decryption key
    },
    mac: {
      type: String,
      required: true, // Message authentication code
    },
    sha256: {
      type: String,
      required: true, // File hash for integrity verification
    },
    conversationId: {
      type: String,
      required: true, // Links file to conversation
    },
    expiresAt: {
      type: Date,
      default: null, // Optional expiration for temporary files
    },
  },
  { timestamps: true }
);

// Index for efficient file retrieval
encryptedFileSchema.index({ conversationId: 1, createdAt: -1 });

const EncryptedFile = mongoose.models.EncryptedFile || mongoose.model("EncryptedFile", encryptedFileSchema);
export default EncryptedFile;