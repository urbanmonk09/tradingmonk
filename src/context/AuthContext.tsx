"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useUser } from "@clerk/nextjs";

interface AuthContextType {
  user: ReturnType<typeof useUser>["user"] | null;
  isLoaded: boolean;
  isPro: boolean;
  userEmail: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: false,
  isPro: false,
  userEmail: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoaded } = useUser();

  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    
    null;

  const isPro = Boolean(user?.publicMetadata?.isPro);

  return (
    <AuthContext.Provider value={{ user, isLoaded, isPro, userEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
