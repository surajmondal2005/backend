import Device from "../models/Device.js";
import PreKey from "../models/PreKey.js";
import User from "../models/User.js";

// Register a new device with identity key and pre-keys
export const registerDevice = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      deviceId,
      registrationId,
      identityKey,
      signedPreKey,
      oneTimePreKeys
    } = req.body;

    // Validate required fields
    if (!deviceId || !registrationId || !identityKey || !signedPreKey) {
      return res.status(400).json({
        message: "Missing required fields: deviceId, registrationId, identityKey, signedPreKey"
      });
    }

    // Check if device already exists
    const existingDevice = await Device.findOne({ userId, deviceId });
    if (existingDevice) {
      return res.status(409).json({
        message: "Device already registered for this user"
      });
    }

    // Create device record
    const device = new Device({
      userId,
      deviceId,
      registrationId,
      identityKey,
      signedPreKey,
      oneTimePreKeys: oneTimePreKeys || []
    });

    await device.save();

    // Store pre-keys
    const preKeyDocs = [];

    // Store signed pre-key
    preKeyDocs.push({
      userId,
      deviceId,
      keyId: signedPreKey.keyId,
      publicKey: signedPreKey.publicKey,
      keyType: "signedPreKey",
      signature: signedPreKey.signature
    });

    // Store one-time pre-keys
    if (oneTimePreKeys && oneTimePreKeys.length > 0) {
      oneTimePreKeys.forEach(preKey => {
        preKeyDocs.push({
          userId,
          deviceId,
          keyId: preKey.keyId,
          publicKey: preKey.publicKey,
          keyType: "oneTimePreKey"
        });
      });
    }

    await PreKey.insertMany(preKeyDocs);

    res.status(201).json({
      message: "Device registered successfully",
      deviceId: device.deviceId
    });

  } catch (error) {
    console.error("Error registering device:", error);
    if (error.code === 11000) {
      return res.status(409).json({ message: "Device ID already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};

// Get pre-key bundle for a user (used for initiating conversations)
export const getPreKeyBundle = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user._id;

    // Can't get keys for yourself
    if (requestingUserId.toString() === userId) {
      return res.status(400).json({ message: "Cannot get pre-key bundle for yourself" });
    }

    // Get user's active devices
    const devices = await Device.find({ userId, isActive: true });

    if (devices.length === 0) {
      return res.status(404).json({ message: "No active devices found for user" });
    }

    const preKeyBundles = [];

    for (const device of devices) {
      // Get signed pre-key
      const signedPreKey = await PreKey.findOne({
        userId,
        deviceId: device.deviceId,
        keyType: "signedPreKey",
        used: false
      });

      if (!signedPreKey) {
        continue; // Skip device if no signed pre-key
      }

      // Get one-time pre-key (if available)
      const oneTimePreKey = await PreKey.findOne({
        userId,
        deviceId: device.deviceId,
        keyType: "oneTimePreKey",
        used: false
      }).sort({ createdAt: 1 }); // Get oldest available

      const bundle = {
        deviceId: device.deviceId,
        registrationId: device.registrationId,
        identityKey: device.identityKey,
        signedPreKey: {
          keyId: signedPreKey.keyId,
          publicKey: signedPreKey.publicKey,
          signature: signedPreKey.signature
        }
      };

      if (oneTimePreKey) {
        bundle.preKey = {
          keyId: oneTimePreKey.keyId,
          publicKey: oneTimePreKey.publicKey
        };
        // Mark one-time pre-key as used
        oneTimePreKey.used = true;
        await oneTimePreKey.save();
      }

      preKeyBundles.push(bundle);
    }

    if (preKeyBundles.length === 0) {
      return res.status(404).json({ message: "No valid pre-key bundles available" });
    }

    res.status(200).json({
      userId,
      devices: preKeyBundles
    });

  } catch (error) {
    console.error("Error getting pre-key bundle:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get identity key for a user
export const getIdentityKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const devices = await Device.find({ userId, isActive: true })
      .select("deviceId identityKey");

    if (devices.length === 0) {
      return res.status(404).json({ message: "No active devices found" });
    }

    res.status(200).json({
      userId,
      identityKeys: devices.map(d => ({
        deviceId: d.deviceId,
        identityKey: d.identityKey
      }))
    });

  } catch (error) {
    console.error("Error getting identity key:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update signed pre-key (should be done periodically)
export const updateSignedPreKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { deviceId, signedPreKey } = req.body;

    if (!deviceId || !signedPreKey) {
      return res.status(400).json({ message: "deviceId and signedPreKey required" });
    }

    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    // Update device signed pre-key
    device.signedPreKey = signedPreKey;
    await device.save();

    // Mark old signed pre-key as used
    await PreKey.updateMany(
      { userId, deviceId, keyType: "signedPreKey", used: false },
      { used: true }
    );

    // Store new signed pre-key
    const newPreKey = new PreKey({
      userId,
      deviceId,
      keyId: signedPreKey.keyId,
      publicKey: signedPreKey.publicKey,
      keyType: "signedPreKey",
      signature: signedPreKey.signature
    });

    await newPreKey.save();

    res.status(200).json({ message: "Signed pre-key updated successfully" });

  } catch (error) {
    console.error("Error updating signed pre-key:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add one-time pre-keys
export const addOneTimePreKeys = async (req, res) => {
  try {
    const userId = req.user._id;
    const { deviceId, oneTimePreKeys } = req.body;

    if (!deviceId || !oneTimePreKeys || !Array.isArray(oneTimePreKeys)) {
      return res.status(400).json({ message: "deviceId and oneTimePreKeys array required" });
    }

    const device = await Device.findOne({ userId, deviceId });
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    // Add to device record
    device.oneTimePreKeys.push(...oneTimePreKeys);
    await device.save();

    // Store in pre-keys collection
    const preKeyDocs = oneTimePreKeys.map(preKey => ({
      userId,
      deviceId,
      keyId: preKey.keyId,
      publicKey: preKey.publicKey,
      keyType: "oneTimePreKey"
    }));

    await PreKey.insertMany(preKeyDocs);

    res.status(200).json({
      message: "One-time pre-keys added successfully",
      count: oneTimePreKeys.length
    });

  } catch (error) {
    console.error("Error adding one-time pre-keys:", error);
    res.status(500).json({ message: "Server error" });
  }
};