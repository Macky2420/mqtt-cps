import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

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

const app = initializeApp(firebaseConfig);

// 🔥 THIS IS WHAT YOU MISSED
export const db = getDatabase(app);