import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBq-W4Fr9z9BkIuW0w9I0NXmn-U4Nb3wVg",
  authDomain: "jibjoyvet.firebaseapp.com",
  projectId: "jibjoyvet",
  storageBucket: "jibjoyvet.firebasestorage.app",
  messagingSenderId: "782893625471",
  appId: "1:782893625471:web:ae3e988d6855ecdf04cf4a",
  measurementId: "G-J5KMP4DGPX"
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Analytics conditionally (only works on the client side)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, googleProvider, analytics };
