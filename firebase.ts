// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD55mFH-VBWTh2yukZSqTtWoEKrYkO6704",
  authDomain: "student-ad4c5.firebaseapp.com",
  projectId: "student-ad4c5",
  storageBucket: "student-ad4c5.firebasestorage.app",
  messagingSenderId: "882579023460",
  appId: "1:882579023460:web:2d421abe18cc797bf7a171",
  measurementId: "G-J7B53P7CMZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);