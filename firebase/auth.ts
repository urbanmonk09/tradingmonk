// /firebase/auth.ts
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

export const emailSignup = (email: string, pass: string) =>
  createUserWithEmailAndPassword(auth, email, pass);

export const emailLogin = (email: string, pass: string) =>
  signInWithEmailAndPassword(auth, email, pass);

export const googleLogin = () =>
  signInWithPopup(auth, new GoogleAuthProvider());

export const facebookLogin = () =>
  signInWithPopup(auth, new FacebookAuthProvider());

export const appleLogin = () =>
  signInWithPopup(auth, new OAuthProvider("apple.com"));

export const logout = () => signOut(auth);
