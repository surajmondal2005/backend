import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible paths
const possiblePaths = [
  // 1. Absolute path (MOST RELIABLE)
  '/root/Backend_ChatBox/firebase-service-account.json',
  // 2. Relative from this file
  path.join(__dirname, "../../firebase-service-account.json"),
  // 3. From current working directory
  path.join(process.cwd(), 'firebase-service-account.json'),
  // 4. Other possibilities
  './firebase-service-account.json',
  'firebase-service-account.json'
];

let adminApp = null;
let initializationError = null;
let isInitializing = false;

// Initialize Firebase
const initializeFirebase = async () => {
  if (isInitializing) return;
  isInitializing = true;
  
  try {
    console.log('🔧 Initializing Firebase...');
    
    // Find which path actually exists
    let serviceAccountPath = null;
    
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        serviceAccountPath = p;
        console.log(`✅ Found Firebase config at: ${p}`);
        break;
      }
    }
    
    if (!serviceAccountPath) {
      const errorMsg = `Firebase service account not found. Checked: ${possiblePaths.join(', ')}`;
      console.warn('❌', errorMsg);
      initializationError = new Error(errorMsg);
      return;
    }
    
    // Read and parse
    const data = await fs.readFile(serviceAccountPath, "utf8");
    const serviceAccount = JSON.parse(data);
    
    // Check if already initialized
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(`✅ Firebase admin initialized for project: ${serviceAccount.project_id}`);
    } else {
      adminApp = admin.app();
      console.log('ℹ️ Firebase already initialized');
    }
    
  } catch (err) {
    console.error("❌ Firebase admin init failed:", err.message);
    initializationError = err;
    
    // Create mock admin to prevent crashes
    adminApp = {
      apps: [],
      messaging: () => ({
        send: async () => {
          console.warn('⚠️ Firebase not initialized - notification skipped');
          return null;
        },
        sendToDevice: async (token, payload) => {
          console.warn('⚠️ Firebase not initialized - notification skipped');
          return { results: [{ messageId: null, error: 'Firebase not initialized' }] };
        }
      })
    };
  } finally {
    isInitializing = false;
  }
};

// Initialize immediately (but don't block)
initializeFirebase().catch(err => {
  console.error('Firebase initialization error:', err);
  initializationError = err;
});

// Export with helper methods
const firebaseModule = {
  get admin() {
    return adminApp || admin;
  },
  isInitialized: () => !initializationError,
  getError: () => initializationError?.message,
  
  // Helper for sending notifications
  sendNotification: async (token, title, body, data = {}) => {
    if (initializationError) {
      console.warn('⚠️ Firebase not initialized, skipping notification');
      return { success: false, error: 'Firebase not initialized' };
    }
    
    try {
      const message = {
        token,
        notification: { title, body },
        data
      };
      
      const response = await adminApp.messaging().send(message);
      console.log('✅ Notification sent successfully');
      return { success: true, response };
    } catch (error) {
      console.error('❌ Failed to send notification:', error.message);
      return { success: false, error: error.message };
    }
  }
};

export default firebaseModule;