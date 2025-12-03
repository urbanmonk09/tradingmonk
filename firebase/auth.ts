// src/firebase/auth.ts
// Re-usable client-side auth helper functions.
// Import these in pages/components to keep code consistent.

import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider, facebookProvider, appleProvider } from "./firebase";

export const emailSignup = async (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const setDisplayName = async (user: any, name: string) =>
  updateProfile(user, { displayName: name });

export const emailLogin = async (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const googleLogin = async () => signInWithPopup(auth, googleProvider);
export const facebookLogin = async () => signInWithPopup(auth, facebookProvider);
export const appleLogin = async () => signInWithPopup(auth, appleProvider);

export const logout = async () => signOut(auth);

export const sendPasswordReset = async (email: string) =>
  sendPasswordResetEmail(auth, email);
