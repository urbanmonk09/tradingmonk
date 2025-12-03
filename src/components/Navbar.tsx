"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/firebase/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  return (
    <nav className="backdrop-blur-xl bg-black/40 border-b border-white/10 sticky top-0 z-50 shadow-[0_0_20px_rgba(0,0,0,0.4)]">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">

        {/* Logo */}
<Link href="/" className="flex items-center gap-2">
  <img 
    src="/1764646334737.jpg" 
    alt="KlickTrading Logo" 
    className="h-10 w-auto object-contain"
  />
</Link>


        {/* Desktop Nav */}
        <div className="hidden sm:flex gap-10 text-lg font-semibold">
          <Link href="/blog" className="relative group text-xl tracking-wide transition">
            <span className="group-hover:text-indigo-400 transition">Blog</span>
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-gradient-to-r from-indigo-400 to-purple-500 group-hover:w-full transition-all duration-300 rounded-full"></span>
          </Link>

          <Link href="/learn" className="relative group text-xl tracking-wide transition">
            <span className="group-hover:text-indigo-400 transition">Learn</span>
            <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-gradient-to-r from-indigo-400 to-purple-500 group-hover:w-full transition-all duration-300 rounded-full"></span>
          </Link>
        </div>

        {/* Right actions */}
        <div className="hidden sm:flex gap-4 items-center">

          {!user && (
            <>
              <Link href="/login" className="px-4 py-2 rounded-full text-sm font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition">
                Login
              </Link>

              <Link href="/signup" className="px-6 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md transition">
                Sign Up
              </Link>
            </>
          )}

          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">{user.email}</span>

              <button onClick={() => signOut(auth)} className="px-4 py-2 rounded-full text-sm font-semibold bg-red-600/80 hover:bg-red-700 transition">
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button onClick={() => setOpen(!open)} className="sm:hidden p-2 text-white">
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {open && (
        <div className="sm:hidden px-6 py-4 bg-black/60 backdrop-blur-xl border-t border-white/10">
          <div className="flex flex-col gap-4">

            <Link href="/blog" onClick={() => setOpen(false)} className="text-lg font-semibold text-white/90 hover:text-indigo-400 transition">Blog</Link>

            <Link href="/learn" onClick={() => setOpen(false)} className="text-lg font-semibold text-white/90 hover:text-indigo-400 transition">Learn</Link>

            {!user && (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="text-white bg-white/10 border border-white/20 px-4 py-2 rounded-lg text-base text-center">Login</Link>

                <Link href="/signup" onClick={() => setOpen(false)} className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 rounded-lg text-base text-center">Sign Up</Link>
              </>
            )}

            {user && (
              <button onClick={() => { signOut(auth); setOpen(false); }} className="bg-red-600/80 text-white px-4 py-2 rounded-lg text-base">
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
