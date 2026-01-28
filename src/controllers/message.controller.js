import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import firebase from "../lib/firebase.js";

/** Helper: build base URL for uploaded files */
const getBaseUrl = () =>
  process.env.BASE_URL ||
  `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`;

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const users = await User.find({ 
      _id: { $ne: loggedInUserId },
      blockedUsers: { $ne: loggedInUserId }
    }).select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    // Check if either user has blocked the other
    const [currentUser, otherUser] = await Promise.all([
      User.findById(myId).select("blockedUsers"),
      User.findById(userToChatId).select("blockedUsers")
    ]);

    if (currentUser?.blockedUsers?.includes(userToChatId) || 
        otherUser?.blockedUsers?.includes(myId)) {
      return res.status(403).json({ message: "Cannot access messages with blocked user" });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      // Filter out messages deleted for current user
      "deletedBy.userId": { $ne: myId }
    }).sort("createdAt");

    // Process messages to hide content if deleted
    const processedMessages = messages.map(msg => {
      const msgObj = msg.toObject();
      
      // Check if deleted for everyone
      const deletedForEveryone = msg.deletedBy.some(
        record => record.deleteType === "forEveryone"
      );
      
      if (deletedForEveryone) {
        msgObj.text = "[This message was deleted]";
        msgObj.image = null;
        msgObj.file = null;
        msgObj.ciphertext = "[This message was deleted]";
        msgObj.isDeleted = true;
      }
      
      // Check if deleted for me (but not for everyone)
      const deletedForMe = msg.deletedBy.some(
        record => record.userId.toString() === myId.toString() && record.deleteType === "forMe"
      );
      
      if (deletedForMe) {
        msgObj.isDeletedForMe = true;
      }
      
      return msgObj;
    });

    res.status(200).json(processedMessages);
  } catch (error) {
    console.error("Error in getMessagesByUserId:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    console.log("🔍 [ENCRYPTION DEBUG] sendMessage called with body:", req.body);
    
    const senderId = req.user._id;
    const { id: receiverId } = req.params;
    const { 
      text, 
      ciphertext, 
      messageType, 
      senderDeviceId, 
      conversationId, 
      sequenceNumber 
    } = req.body;
    const imageFile = req.file;

    // ACCEPT: text OR image OR ciphertext (encrypted)
    if (!text && !imageFile && !ciphertext) {
      return res.status(400).json({ 
        message: "Text, image, or ciphertext is required." 
      });
    }

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ 
        message: "Cannot send messages to yourself." 
      });
    }

    const [receiver, sender] = await Promise.all([
      User.findById(receiverId).select("blockedUsers fcmTokens fullName"),
      User.findById(senderId).select("blockedUsers fullName")
    ]);

    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    if (receiver.blockedUsers?.includes(senderId)) {
      return res.status(403).json({ 
        message: "You are blocked by this user" 
      });
    }

    if (sender.blockedUsers?.includes(receiverId)) {
      return res.status(403).json({ 
        message: "You have blocked this user" 
      });
    }

    let imagePath = null;
    if (imageFile) {
      const baseUrl = getBaseUrl();
      imagePath = `${baseUrl}/uploads/${imageFile.filename}`;
    }

    // PREPARE MESSAGE DATA
    const messageData = {
      senderId,
      receiverId,
      status: "sent",
    };

    // HANDLE ENCRYPTED MESSAGES
    if (ciphertext && messageType) {
      console.log("🔐 [ENCRYPTION DEBUG] Creating ENCRYPTED message");
      
      // Validate Signal Protocol message types
      const validTypes = ["PreKeySignalMessage", "SignalMessage", "SenderKeyMessage"];
      if (!validTypes.includes(messageType)) {
        return res.status(400).json({
          message: `Invalid messageType. Must be: ${validTypes.join(", ")}`
        });
      }

      // Encrypted message fields
      messageData.ciphertext = ciphertext;
      messageData.messageType = messageType;
      messageData.senderDeviceId = senderDeviceId || 1;
      messageData.conversationId = conversationId || `${senderId}_${receiverId}`;
      messageData.sequenceNumber = sequenceNumber || 0;
      messageData.text = ""; // Empty for encrypted messages
      messageData.image = ""; // Empty for encrypted messages
      
    } else {
      // PLAINTEXT MESSAGE (existing behavior)
      console.log("📝 [ENCRYPTION DEBUG] Creating PLAINTEXT message");
      messageData.text = text || "";
      messageData.image = imagePath;
      messageData.messageType = imagePath ? "image" : "plaintext";
      messageData.conversationId = `${senderId}_${receiverId}`;
    }

    console.log("🔍 [ENCRYPTION DEBUG] Creating message with data:", messageData);
    
    let newMessage = await Message.create(messageData);

    console.log("✅ [ENCRYPTION DEBUG] Message saved with ID:", newMessage._id);

    const receiverSocketId = getReceiverSocketId(receiverId);

    if (receiverSocketId) {
      newMessage.status = "delivered";
      newMessage.deliveredAt = new Date();
      await newMessage.save();

      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    // Send push notification if Firebase is initialized and receiver has tokens
    if (receiver.fcmTokens && receiver.fcmTokens.length > 0 && firebase.admin?.messaging) {
      const messageText = ciphertext ? "🔐 Encrypted message" : 
                         (text || (imageFile ? "📷 Image" : "New message"));
      
      console.log(`🔔 Sending push to ${receiver.fcmTokens.length} device(s)`);
      
      const sendPromises = receiver.fcmTokens.map(async (token) => {
        try {
          const message = {
            token: token,
            notification: {
              title: `New message from ${sender.fullName}`,
              body: messageText,
            },
            data: {
              type: "MESSAGE",
              senderId: senderId.toString(),
              messageId: newMessage._id.toString(),
              chatId: receiverId.toString(),
              click_action: "FLUTTER_NOTIFICATION_CLICK"
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "chat_messages",
                sound: "default"
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                  contentAvailable: true
                }
              }
            }
          };
          
          const response = await firebase.admin.messaging().send(message);
          console.log(`✅ Push sent to ${token.substring(0, 10)}...`);
          return response;
          
        } catch (error) {
          console.error(`❌ Failed to send to token ${token.substring(0, 10)}...:`, error.message || error.code);
          
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            console.log(`🗑️ Removing invalid token: ${token.substring(0, 10)}...`);
            await User.findByIdAndUpdate(receiverId, {
              $pull: { fcmTokens: token }
            });
          }
          return null;
        }
      });
      
      await Promise.all(sendPromises).catch(err => 
        console.error('Batch notification error:', err)
      );
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage
    });
  } catch (error) {
    console.error("❌ [ENCRYPTION DEBUG] Error in sendMessage:", error);
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message 
    });
  }
};

export const markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.receiverId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    message.status = "read";
    message.readAt = new Date();
    await message.save();

    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", {
        messageId,
        readAt: message.readAt,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error in markMessageAsRead:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const myId = req.user._id;

    // Get messages where current user is sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: myId }, { receiverId: myId }],
      "deletedBy.userId": { $ne: myId } // Exclude messages deleted for me
    }).sort({ createdAt: -1 });

    const chatMap = new Map();

    for (let msg of messages) {
      const partnerId =
        msg.senderId.toString() === myId.toString()
          ? msg.receiverId.toString()
          : msg.senderId.toString();

      if (!chatMap.has(partnerId)) {
        let lastMessageText = "";
        
        if (msg.deletedBy.some(record => record.deleteType === "forEveryone")) {
          lastMessageText = "[This message was deleted]";
        } else if (msg.deletedBy.some(record => record.userId.toString() === myId.toString())) {
          lastMessageText = "[Message deleted]";
        } else if (msg.ciphertext) {
          lastMessageText = "🔐 Encrypted message";
        } else if (msg.text) {
          lastMessageText = msg.text.length > 30 ? msg.text.substring(0, 30) + "..." : msg.text;
        } else if (msg.image) {
          lastMessageText = "📷 Image";
        } else {
          lastMessageText = "Message";
        }

        chatMap.set(partnerId, {
          partnerId,
          lastMessage: msg,
          lastMessageAt: msg.createdAt,
          lastMessageText: lastMessageText,
          unreadCount: 0,
        });
      }

      // Count unread messages
      if (msg.receiverId.toString() === myId.toString() && msg.status !== "read") {
        const entry = chatMap.get(partnerId);
        if (entry) {
          entry.unreadCount = (entry.unreadCount || 0) + 1;
        }
      }
    }

    const partnerIds = Array.from(chatMap.keys());

    if (partnerIds.length === 0) {
      return res.status(200).json([]);
    }

    const users = await User.find({ 
      _id: { $in: partnerIds },
      blockedUsers: { $ne: myId }
    }).select("-password");

    // Build result with proper fallbacks
    const result = users.map((user) => {
      const userObj = user.toObject();
      const partnerId = user._id.toString();
      const chatData = chatMap.get(partnerId) || {
        lastMessage: null,
        lastMessageAt: null,
        lastMessageText: "",
        unreadCount: 0,
      };

      return {
        ...userObj,
        lastMessage: chatData.lastMessage,
        lastMessageAt: chatData.lastMessageAt,
        lastMessageText: chatData.lastMessageText || "",
        unreadCount: chatData.unreadCount || 0,
      };
    });

    // Sort by last message time (most recent first)
    result.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getChatPartners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const { q } = req.query;
    const myId = req.user._id;

    if (!q || q.trim() === "") return res.json([]);

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userId },
        { senderId: userId, receiverId: myId },
      ],
      text: { $regex: q.trim(), $options: "i" },
      "deletedBy.userId": { $ne: myId } // Exclude deleted messages
    }).sort({ createdAt: -1 });

    res.json(messages);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========== NEW FUNCTIONS: MESSAGE DELETION & EDITING ==========

// Delete message for me only
export const deleteMessageForMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is part of conversation
    const isParticipant = 
      message.senderId.toString() === userId.toString() ||
      message.receiverId.toString() === userId.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to delete this message" });
    }

    // Check if already deleted for this user
    const alreadyDeleted = message.deletedBy.some(
      record => record.userId.toString() === userId.toString()
    );

    if (alreadyDeleted) {
      return res.status(400).json({ message: "Message already deleted for you" });
    }

    // Add deletion record
    message.deletedBy.push({
      userId,
      deleteType: "forMe",
      deletedAt: new Date()
    });

    // Mark as deleted if both parties deleted it
    const senderDeleted = message.deletedBy.some(
      record => record.userId.toString() === message.senderId.toString()
    );
    const receiverDeleted = message.deletedBy.some(
      record => record.userId.toString() === message.receiverId.toString()
    );

    if (senderDeleted && receiverDeleted) {
      message.isDeleted = true;
    }

    await message.save();

    // Notify the other participant in real-time
    const otherUserId = 
      message.senderId.toString() === userId.toString() 
        ? message.receiverId 
        : message.senderId;

    const receiverSocketId = getReceiverSocketId(otherUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeletedForUser", {
        messageId,
        deletedBy: userId,
        deleteType: "forMe"
      });
    }

    res.status(200).json({
      success: true,
      message: "Message deleted for you",
      messageId,
      deleteType: "forMe"
    });

  } catch (error) {
    console.error("Error in deleteMessageForMe:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete message for everyone
export const deleteMessageForEveryone = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only sender can delete for everyone
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: "Only the sender can delete message for everyone" 
      });
    }

    // Check if already deleted for everyone
    const alreadyDeletedForEveryone = message.deletedBy.some(
      record => record.deleteType === "forEveryone"
    );

    if (alreadyDeletedForEveryone) {
      return res.status(400).json({ message: "Message already deleted for everyone" });
    }

    // Mark as deleted for everyone
    message.isDeleted = true;
    
    // Clear sensitive content
    if (message.ciphertext) {
      // For encrypted messages, we keep the ciphertext but mark as deleted
      message.ciphertext = "[This message was deleted]";
    } else {
      // For plaintext messages, clear the content
      message.text = "[This message was deleted]";
      message.image = null;
      message.file = null;
    }
    
    message.deletedBy.push({
      userId,
      deleteType: "forEveryone",
      deletedAt: new Date()
    });

    await message.save();

    // Notify the receiver in real-time
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeletedForEveryone", {
        messageId,
        deletedBy: userId,
        newContent: "[This message was deleted]"
      });
    }

    res.status(200).json({
      success: true,
      message: "Message deleted for everyone",
      messageId,
      deleteType: "forEveryone"
    });

  } catch (error) {
    console.error("Error in deleteMessageForEveryone:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit message
export const editMessage = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Text is required" });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only sender can edit message
    if (message.senderId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the sender can edit this message" });
    }

    // Check if message is deleted
    if (message.isDeleted || message.deletedBy.some(record => record.deleteType === "forEveryone")) {
      return res.status(400).json({ message: "Cannot edit deleted message" });
    }

    // Check if message is encrypted
    if (message.ciphertext && message.ciphertext !== "") {
      return res.status(400).json({ message: "Cannot edit encrypted messages" });
    }

    // Save original text to edit history
    if (!message.editHistory.length) {
      message.editHistory.push({
        text: message.text,
        editedAt: message.createdAt
      });
    }

    // Update message
    message.text = text.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    message.editHistory.push({
      text: text.trim(),
      editedAt: new Date()
    });

    await message.save();

    // Notify the receiver in real-time
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageEdited", {
        messageId,
        newText: message.text,
        editedAt: message.editedAt,
        editedBy: userId
      });
    }

    res.status(200).json({
      success: true,
      message: "Message edited successfully",
      messageId,
      editedAt: message.editedAt
    });

  } catch (error) {
    console.error("Error in editMessage:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get message edit history
export const getMessageEditHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId).select("editHistory senderId receiverId");
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is part of conversation
    const isParticipant = 
      message.senderId.toString() === userId.toString() ||
      message.receiverId.toString() === userId.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.status(200).json({
      success: true,
      editHistory: message.editHistory || []
    });

  } catch (error) {
    console.error("Error in getMessageEditHistory:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add reaction to message
export const addReaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is part of conversation
    const isParticipant = 
      message.senderId.toString() === userId.toString() ||
      message.receiverId.toString() === userId.toString();

    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot react to deleted message" });
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(
      reaction => reaction.userId.toString() !== userId.toString()
    );

    // Add new reaction
    message.reactions.push({
      userId,
      emoji,
      createdAt: new Date()
    });

    await message.save();

    // Notify the other participant in real-time
    const otherUserId = 
      message.senderId.toString() === userId.toString() 
        ? message.receiverId 
        : message.senderId;

    const receiverSocketId = getReceiverSocketId(otherUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReacted", {
        messageId,
        userId,
        emoji,
        reactions: message.reactions
      });
    }

    res.status(200).json({
      success: true,
      message: "Reaction added",
      reactions: message.reactions
    });

  } catch (error) {
    console.error("Error in addReaction:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Remove reaction from message
export const removeReaction = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Remove user's reaction
    const initialLength = message.reactions.length;
    message.reactions = message.reactions.filter(
      reaction => reaction.userId.toString() !== userId.toString()
    );

    if (initialLength === message.reactions.length) {
      return res.status(400).json({ message: "No reaction to remove" });
    }

    await message.save();

    // Notify the other participant in real-time
    const otherUserId = 
      message.senderId.toString() === userId.toString() 
        ? message.receiverId 
        : message.senderId;

    const receiverSocketId = getReceiverSocketId(otherUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionRemoved", {
        messageId,
        userId,
        reactions: message.reactions
      });
    }

    res.status(200).json({
      success: true,
      message: "Reaction removed",
      reactions: message.reactions
    });

  } catch (error) {
    console.error("Error in removeReaction:", error);
    res.status(500).json({ message: "Server error" });
  }
};


//Api for clear chat
export const clearChatForMe = async (req, res) => {
  const myId = req.user._id;
  const userId = req.params.userId;

  const messages = await Message.find({
    $or: [
      { senderId: myId, receiverId: userId },
      { senderId: userId, receiverId: myId }
    ]
  });

  for (let message of messages) {
    const alreadyDeleted = message.deletedBy.some(
      record => record.userId.toString() === myId.toString()
    );

    if (!alreadyDeleted) {
      message.deletedBy.push({
        userId: myId,
        deleteType: "forMe",
        deletedAt: new Date()
      });

      await message.save();
    }
  }

  res.status(200).json({
    success: true,
    message: "Chat cleared for you"
  });
};