import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

/** Helper: build base URL for uploaded files */
const getBaseUrl = () =>
  process.env.BASE_URL ||
  `http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000}`;

/** Normalize stored profilePic to full URL if needed */
const normalizeProfilePic = (profilePic) => {
  if (!profilePic) return null;
  // if already a full URL, return as-is
  if (profilePic.startsWith("http://") || profilePic.startsWith("https://")) {
    return profilePic;
  }
  // otherwise prefix with BASE_URL
  const baseUrl = getBaseUrl();
  // ensure there's no leading slash duplication
  return profilePic.startsWith("/")
    ? `${baseUrl}${profilePic}`
    : `${baseUrl}/${profilePic}`;
};

/** Validate uploaded image file */
const validateImageFile = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!file) {
    throw new Error('No file provided');
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, WebP allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File size too large. Max 5MB allowed.');
  }
  
  return true;
};

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    const savedUser = await newUser.save();

    const token = generateToken(savedUser._id, res);

    const profilePicFull = normalizeProfilePic(savedUser.profilePic);

    res.status(201).json({
      _id: savedUser._id,
      fullName: savedUser.fullName,
      email: savedUser.email,
      profilePic: profilePicFull,
      token,
    });
  } catch (error) {
    console.error("Error in signup controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = generateToken(user._id, res);

    const profilePicFull = normalizeProfilePic(user.profilePic);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: profilePicFull,
      token,
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (_, res) => {
  // If you use a cookie named 'jwt' or similar in generateToken, clear it here.
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const updateProfile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    // Validate the uploaded file
    try {
      validateImageFile(req.file);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    const userId = req.user._id;

    // Build full URL for the uploaded file
    const baseUrl = getBaseUrl();
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: fileUrl },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Normalize the profile picture URL in response
    const normalizedProfilePic = normalizeProfilePic(updatedUser.profilePic);

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: {
        ...updatedUser.toObject(),
        profilePic: normalizedProfilePic
      },
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    
    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: "Internal server error" });
  }
};