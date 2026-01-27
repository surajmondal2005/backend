// src/controllers/user.controller.js
import User from "../models/User.js";

export const blockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: blockId } = req.params;

    if (userId.toString() === blockId) {
      return res.status(400).json({ message: "You cannot block yourself." });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { blockedUsers: blockId },
    });

    res.status(200).json({ message: "User blocked successfully." });
  } catch (err) {
    console.error("Error blocking user:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: unblockId } = req.params;

    await User.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: unblockId },
    });

    res.status(200).json({ message: "User unblocked successfully." });
  } catch (err) {
    console.error("Error unblocking user:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .populate("blockedUsers", "-password")
      .select("blockedUsers");

    res.status(200).json(user.blockedUsers || []);
  } catch (err) {
    console.error("Error fetching blocked users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const pinUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: pinId } = req.params;

    if (userId.toString() === pinId) {
      return res.status(400).json({ message: "Cannot pin yourself." });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { pinnedChats: pinId },
    });

    res.status(200).json({ message: "Pinned successfully." });
  } catch (err) {
    console.error("Error pinning user:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const unpinUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: unpinId } = req.params;

    await User.findByIdAndUpdate(userId, {
      $pull: { pinnedChats: unpinId },
    });

    res.status(200).json({ message: "Unpinned successfully." });
  } catch (err) {
    console.error("Error unpinning user:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPinnedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId)
      .populate("pinnedChats", "-password")
      .select("pinnedChats");

    res.status(200).json(user?.pinnedChats || []);
  } catch (err) {
    console.error("Error fetching pinned users:", err);
    res.status(500).json({ message: "Server error" });
  }
};
