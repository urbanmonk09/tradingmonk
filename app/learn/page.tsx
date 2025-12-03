"use client";
import React from "react";
import Link from "next/link";

const topics = [
  { id: "dow", title: "Dow Theory", price: "₹1999", desc: "Introduction to Dow Theory & market structure." },
  { id: "elliot", title: "Elliot Wave", price: "₹2499", desc: "Elliot Wave basics, counts and practice." },
  { id: "harmonic", title: "Harmonic Trading", price: "₹2999", desc: "Pattern identification and trade rules." },
  { id: "chart", title: "Chart Reading", price: "₹1499", desc: "Candles, trends, support/resistance." },
];

export default function LearnPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* Header */}
      <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 drop-shadow-lg">
        Learn Technical Analysis
      </h1>

      {/* Courses Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {topics.map((t) => (
          <div
            key={t.id}
            className="bg-gray-900/80 border border-white/10 rounded-2xl p-5 
                       hover:shadow-xl hover:shadow-indigo-500/20 
                       transition-all duration-300"
          >
            <h3 className="text-xl font-semibold text-indigo-300">{t.title}</h3>

            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              {t.desc}
            </p>

            <div className="mt-6 flex justify-between items-center">
              <span className="font-bold text-lg text-indigo-400">
                {t.price}
              </span>

              <Link
                href={`/learn/${t.id}`}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 
                           text-white text-sm transition shadow"
              >
                View
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
