"use client";

import { useContext } from "react";
import AuthContext from "@/src/context/AuthContext"; // default import

export function useAuth() {
  const context = useContext(AuthContext as any); // context type is inferred
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
