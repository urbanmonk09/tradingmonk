"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  emailLogin,
  googleLogin,
  facebookLogin,
  appleLogin,
} from "@/firebase/auth";
import { auth } from "@/firebase/firebase";
import { sendPasswordResetEmail } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await emailLogin(email, password);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function oauthLogin(method: "google" | "facebook" | "apple") {
    try {
      setError("");

      if (method === "google") await googleLogin();
      if (method === "facebook") await facebookLogin();
      if (method === "apple") await appleLogin();

      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleForgotPassword() {
    if (!email) return setError("Enter your email first.");

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent!");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="bg-gray-900 p-8 rounded-xl w-full max-w-md border border-white/10">
        <h1 className="text-3xl font-bold mb-6 text-center">Login</h1>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
            className="bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg font-semibold"
          >
            Login
          </button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="text-indigo-400 text-sm mt-3 underline"
        >
          Forgot Password?
        </button>

        {/* OAuth */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => oauthLogin("google")}
            className="w-full bg-white text-black py-3 rounded-lg font-semibold"
          >
            Continue with Google
          </button>

          <button
            onClick={() => oauthLogin("facebook")}
            className="w-full bg-blue-600 py-3 rounded-lg font-semibold"
          >
            Continue with Facebook
          </button>

          <button
            onClick={() => oauthLogin("apple")}
            className="w-full bg-white/20 py-3 rounded-lg font-semibold"
          >
            Continue with Apple
          </button>
        </div>

        <p className="text-center mt-6 text-sm">
          New user?{" "}
          <Link href="/signup" className="text-indigo-400 underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
