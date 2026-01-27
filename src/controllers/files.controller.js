import EncryptedFile from "../models/EncryptedFile.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js"; // Assuming you have cloudinary setup
import { v4 as uuidv4 } from "uuid";

// Upload encrypted file
export const uploadEncryptedFile = async (req, res) => {
  try {
    const uploaderId = req.user._id;
    const {
      fileName,
      fileSize,
      mimeType,
      encryptedFileKey,
      mac,
      sha256,
      conversationId
    } = req.body;

    const file = req.file;

    // E2EE: Backend never decrypts - only stores encrypted file and metadata
    if (!file) {
      return res.status(400).json({ message: "Encrypted file is required" });
    }

    if (!encryptedFileKey || !mac || !sha256 || !conversationId) {
      return res.status(400).json({
        message: "Missing required encrypted file metadata (encryptedFileKey, mac, sha256, conversationId)"
      });
    }

    // Upload encrypted file to cloud storage (e.g., Cloudinary)
    let encryptedFileUrl = null;
    if (cloudinary && cloudinary.uploader) {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: "raw",
        public_id: `encrypted_${uuidv4()}`,
        folder: "encrypted_files"
      });
      encryptedFileUrl = uploadResult.secure_url;
    } else {
      // Fallback: store locally (not recommended for production)
      const fs = await import("fs");
      const path = await import("path");
      const crypto = await import("crypto");

      const fileId = uuidv4();
      const fileName = `encrypted_${fileId}`;
      const filePath = path.join(process.cwd(), "uploads", fileName);

      // Ensure uploads directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

      // Move file to uploads directory
      await fs.promises.rename(file.path, filePath);
      encryptedFileUrl = `/uploads/${fileName}`;
    }

    // Create encrypted file record
    const encryptedFile = new EncryptedFile({
      fileId: uuidv4(),
      uploaderId,
      fileName: fileName || file.originalname,
      fileSize: fileSize || file.size,
      mimeType: mimeType || file.mimetype,
      encryptedFileUrl,
      encryptedFileKey,
      mac,
      sha256,
      conversationId
    });

    await encryptedFile.save();

    // Notify conversation participants about new file
    // You might want to get all participants of the conversation
    // For now, we'll emit to the uploader's socket
    const uploaderSocketId = getReceiverSocketId(uploaderId);
    if (uploaderSocketId) {
      io.to(uploaderSocketId).emit("fileUploaded", {
        fileId: encryptedFile.fileId,
        fileName: encryptedFile.fileName,
        fileSize: encryptedFile.fileSize,
        mimeType: encryptedFile.mimeType,
        conversationId: encryptedFile.conversationId,
        uploadedAt: encryptedFile.createdAt
      });
    }

    res.status(201).json({
      message: "Encrypted file uploaded successfully",
      fileId: encryptedFile.fileId,
      encryptedFileUrl: encryptedFile.encryptedFileUrl,
      metadata: {
        fileName: encryptedFile.fileName,
        fileSize: encryptedFile.fileSize,
        mimeType: encryptedFile.mimeType,
        sha256: encryptedFile.sha256
      }
    });

  } catch (error) {
    console.error("Error uploading encrypted file:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get encrypted file metadata
export const getEncryptedFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    const encryptedFile = await EncryptedFile.findOne({ fileId });

    if (!encryptedFile) {
      return res.status(404).json({ message: "Encrypted file not found" });
    }

    // Check if user has access to this file (basic check - you might want to implement conversation membership check)
    if (encryptedFile.uploaderId.toString() !== userId.toString()) {
      // TODO: Check if user is part of the conversation
      // For now, allow access - implement proper conversation membership check
    }

    res.status(200).json({
      fileId: encryptedFile.fileId,
      fileName: encryptedFile.fileName,
      fileSize: encryptedFile.fileSize,
      mimeType: encryptedFile.mimeType,
      encryptedFileUrl: encryptedFile.encryptedFileUrl,
      encryptedFileKey: encryptedFile.encryptedFileKey,
      mac: encryptedFile.mac,
      sha256: encryptedFile.sha256,
      conversationId: encryptedFile.conversationId,
      uploadedAt: encryptedFile.createdAt
    });

  } catch (error) {
    console.error("Error getting encrypted file:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get files for a conversation
export const getConversationFiles = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // TODO: Check if user is part of the conversation
    // For now, return all files for the conversation

    const files = await EncryptedFile.find({ conversationId })
      .populate("uploaderId", "fullName")
      .sort({ createdAt: -1 });

    const fileList = files.map(file => ({
      fileId: file.fileId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      uploader: file.uploaderId.fullName,
      uploadedAt: file.createdAt,
      sha256: file.sha256
    }));

    res.status(200).json({
      conversationId,
      files: fileList
    });

  } catch (error) {
    console.error("Error getting conversation files:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete encrypted file
export const deleteEncryptedFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user._id;

    const encryptedFile = await EncryptedFile.findOne({ fileId });

    if (!encryptedFile) {
      return res.status(404).json({ message: "Encrypted file not found" });
    }

    // Only uploader can delete the file
    if (encryptedFile.uploaderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only uploader can delete this file" });
    }

    // Delete from cloud storage if using cloudinary
    if (cloudinary && cloudinary.uploader && encryptedFile.encryptedFileUrl.includes("cloudinary")) {
      const publicId = encryptedFile.encryptedFileUrl.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    } else if (encryptedFile.encryptedFileUrl.startsWith("/uploads/")) {
      // Delete local file
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), encryptedFile.encryptedFileUrl);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.warn("Could not delete local file:", err.message);
      }
    }

    await EncryptedFile.findByIdAndDelete(encryptedFile._id);

    res.status(200).json({ message: "Encrypted file deleted successfully" });

  } catch (error) {
    console.error("Error deleting encrypted file:", error);
    res.status(500).json({ message: "Server error" });
  }
};