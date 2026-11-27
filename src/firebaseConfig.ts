import { initializeApp, getApps, getApp } from "firebase/app";
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import configJson from "../firebase-applet-config.json";

// Support both environment variables (e.g., on Vercel deployment) and local config
const env: Record<string, string | undefined> = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || configJson.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || configJson.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || configJson.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || configJson.measurementId || undefined,
};

export const projectId = firebaseConfig.projectId;

// Initialize Firebase App singleton
export const app =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with persistent IndexedDB cache (multi-tab) and optional named databaseId.
// Falls back to getFirestore() if already initialized (e.g. during Vite HMR).
export const firestoreDatabaseId =
  configJson.firestoreDatabaseId || "(default)";

function createFirestoreInstance(): Firestore {
  const customDbId =
    configJson.firestoreDatabaseId &&
    configJson.firestoreDatabaseId !== "(default)"
      ? configJson.firestoreDatabaseId
      : undefined;

  const settings = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  };

  try {
    return customDbId
      ? initializeFirestore(app, settings, customDbId)
      : initializeFirestore(app, settings);
  } catch {
    return customDbId ? getFirestore(app, customDbId) : getFirestore(app);
  }
}

export const db = createFirestoreInstance();

// Initialize Authentication and Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

