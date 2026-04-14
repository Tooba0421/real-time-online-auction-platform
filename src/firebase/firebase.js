// Import Firebase
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQyB4rOB_PvXBaQ0SMACW_KGiP6rxmxV0",
  authDomain: "real-time-auction-platform.firebaseapp.com",
  projectId: "real-time-auction-platform",
  storageBucket: "real-time-auction-platform.firebasestorage.app",
  messagingSenderId: "973995411359",
  appId: "1:973995411359:web:7f4e64430f0a6ab0505faa",
  measurementId: "G-7K2HJYCRJX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);