// src/components/RightSignupPanel.tsx
"use client";

import React, { useState } from "react";
import { auth, googleProvider } from "@/firebase/firebase";
import { signInWithPopup } from "firebase/auth";

export default function RightSignupPanel() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function quickGoogle() {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // redirect to home - firebase onAuth will set user
      window.location.href = "/";
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed");
    }
  }

  function handleLocalSignupStub(e: React.FormEvent) {
    e.preventDefault();
    setInfo("Please use the Signup page for full sign-up. Quick Google is recommended.");
  }

  return (
    <div className="w-full max-w-sm bg-gray-900 p-6 rounded-lg border border-white/10">
      <h3 className="text-xl font-semibold mb-4">Create an account</h3>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {info && <p className="text-green-400 text-sm mb-2">{info}</p>}

      <form onSubmit={handleLocalSignupStub} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="p-2 rounded bg-black/40 border border-white/10"
        />
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="Mobile"
          className="p-2 rounded bg-black/40 border border-white/10"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="p-2 rounded bg-black/40 border border-white/10"
        />

        <button className="py-2 rounded bg-indigo-600 font-semibold" type="submit">
          Sign up
        </button>
      </form>

      <div className="mt-4">
        <button onClick={quickGoogle} className="w-full py-2 rounded bg-white text-black font-semibold">
          Continue with Google
        </button>
      </div>
    </div>
  );
}
