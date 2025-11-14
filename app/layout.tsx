"use client"
import "./globals.css";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import Navbar from "../src/components/Navbar";
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convexClient";

import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { ConvexClientProvider } from "./ConvexClientProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
    <html lang="en">
      <body>
         <ConvexClientProvider>
          <AuthProvider>
          <Navbar />
          <main className="p-4">{children}</main>
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
    </ClerkProvider>
  );
}
