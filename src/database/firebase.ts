import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC4s_h3BVaGx4HvjqEfGt5pdQNH_3UqdJE",
  authDomain: "lifepack-db33e.firebaseapp.com",
  databaseURL: "https://lifepack-db33e.firebaseio.com",
  projectId: "lifepack-db33e",
  storageBucket: "lifepack-db33e.appspot.com",
  messagingSenderId: "83270593343",
  appId: "1:83270593343:web:27807090749cdff0b8c18a",
  measurementId: "G-65Y9RWLB23"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const db = getDatabase(app);
export const auth = getAuth(app);

// Suppress Dynamic Links deprecation warning
// This is safe because we don't use email link auth or Cordova OAuth
if (typeof window !== "undefined") {
  // @ts-ignore
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}