import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result when returning from Google login
    getRedirectResult(auth).catch(() => {
      // Redirect result errors are non-fatal (e.g. user cancelled)
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = () => signInWithRedirect(auth, googleProvider);
  const logout = () => signOut(auth);

  return { user, loading, login, logout };
}
