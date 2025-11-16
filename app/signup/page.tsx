"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  auth,
  googleProvider,
  facebookProvider,
  appleProvider,
} from "@/firebase/firebase";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function oauthSignup(provider: any) {
    setError("");
    try {
      await signInWithPopup(auth, provider);
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

          <button
            onClick={() => oauthSignup(appleProvider)}
            className="w-full bg-white/20 py-3 rounded-lg font-semibold"
          >
            Continue with Apple
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
