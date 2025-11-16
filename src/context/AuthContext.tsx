// context/AuthContext.tsx
"use client";

import React, { createContext, useEffect, useState } from "react";
import { auth } from "@/firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

export const AuthContext = createContext<any>(null);

export default function AuthProvider({ children }: any) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}
