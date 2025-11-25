"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  facebookProvider,
} from "@/firebase/firebase";
import { db } from "@/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // Save name into Firebase auth
      await updateProfile(userCred.user, { displayName: name });

      // Save extra fields in Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        name,
        mobile,
        email,
        createdAt: Date.now(),
      });

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function oauthSignup(provider: any) {
    setError("");
    try {
      const result = await signInWithPopup(auth, provider);

      // Store user OAuth record in Firestore
      await setDoc(
        doc(db, "users", result.user.uid),
        {
          name: result.user.displayName,
          mobile: "",
          email: result.user.email,
          createdAt: Date.now(),
        },
        { merge: true }
      );

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-xl w-full max-w-md shadow-lg border border-white/10">
        <h1 className="text-3xl font-bold mb-6 text-center">Create Account</h1>

        {error && (
          <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
        )}

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <input
            className="p-3 rounded-lg bg-black/40 border border-white/20"
            placeholder="Full Name"
            type="text"
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="p-3 rounded-lg bg-black/40 border border-white/20"
            placeholder="Mobile Number"
            type="tel"
            onChange={(e) => setMobile(e.target.value)}
          />

          <input
            className="p-3 rounded-lg bg-black/40 border border-white/20"
            placeholder="Email"
            type="email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="p-3 rounded-lg bg-black/40 border border-white/20"
            placeholder="Password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-semibold mt-2"
          >
            Sign Up
          </button>
        </form>

        {/* OAuth */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => oauthSignup(googleProvider)}
            className="w-full bg-white text-black py-3 rounded-lg font-semibold"
          >
            Continue with Google
          </button>

          <button
            onClick={() => oauthSignup(facebookProvider)}
            className="w-full bg-blue-600 py-3 rounded-lg font-semibold"
          >
            Continue with Facebook
          </button>
        </div>

        <p className="text-center mt-6 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
