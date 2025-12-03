"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { auth } from "@/firebase/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// -------------------- Types --------------------
export type AuthContextType = {
  user: User | null;
  loading: boolean;
  allowedToViewPublicContent: boolean;
  markFirstVisitNow: () => void;
};

// -------------------- Context --------------------
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// -------------------- Constants --------------------
const FIRST_VISIT_KEY = "kt_first_visit_ts";
const TRIAL_DAYS = 3;

// -------------------- Provider --------------------
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowedToViewPublicContent, setAllowedToViewPublicContent] = useState(true);

  // Listen for Firebase auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setAllowedToViewPublicContent(true); // logged-in users always allowed
    });

    return () => unsub();
  }, []);

  // Evaluate trial window
  useEffect(() => {
    if (typeof window === "undefined") return; // Skip SSR

    const evaluateTrialWindow = () => {
      try {
        const first = localStorage.getItem(FIRST_VISIT_KEY);
        const now = Date.now();

        if (!first) {
          localStorage.setItem(FIRST_VISIT_KEY, String(now));
          setAllowedToViewPublicContent(true);
          return;
        }

        const firstTs = parseInt(first, 10);
        if (isNaN(firstTs)) {
          localStorage.setItem(FIRST_VISIT_KEY, String(now));
          setAllowedToViewPublicContent(true);
          return;
        }

        const diffDays = (now - firstTs) / (1000 * 60 * 60 * 24);
        if (!user) setAllowedToViewPublicContent(diffDays <= TRIAL_DAYS);
      } catch {
        setAllowedToViewPublicContent(true);
      }
    };

    evaluateTrialWindow();

    const id = setInterval(evaluateTrialWindow, 1000 * 60 * 30);
    return () => clearInterval(id);
  }, [user]);

  const markFirstVisitNow = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
    setAllowedToViewPublicContent(true);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, allowedToViewPublicContent, markFirstVisitNow }}
    >
      {children}
    </AuthContext.Provider>
  );
}
