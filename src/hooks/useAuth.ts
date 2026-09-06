"use client";
import { useState, useEffect } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDocs, setDoc, collection, query, where } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: "student" | "admin";
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. ลองดึงจาก localStorage ก่อนเพื่อให้ UI ตอบสนองทันที
    const cachedUser = localStorage.getItem("appUser");
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem("appUser");
        setLoading(false);
        return;
      }

      let role: "student" | "admin" = "student";

      try {
        const emailQuery = query(
          collection(db, "users"),
          where("email", "==", firebaseUser.email)
        );
        const emailSnap = await getDocs(emailQuery);

        if (!emailSnap.empty) {
          const userData = emailSnap.docs[0].data();
          role = userData.role === "admin" ? "admin" : "student";

          const docRef = doc(db, "users", emailSnap.docs[0].id);
          await setDoc(docRef, { ...userData, uid: firebaseUser.uid }, { merge: true });
        } else {
          const newUser = {
            name: firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "",
            role: "student",
            uid: firebaseUser.uid,
            createdAt: new Date().toLocaleString("th-TH"),
          };
          await setDoc(doc(db, "users", firebaseUser.uid), newUser);
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
      }

      const freshUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || "",
        photoURL: firebaseUser.photoURL || "",
        role,
      };

      setUser(freshUser);
      localStorage.setItem("appUser", JSON.stringify(freshUser));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return { user, loading, loginWithGoogle, logout };
}
