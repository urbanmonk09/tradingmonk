"use client";
import React from "react";
import Link from "next/link";

const blogPosts = [
  {
    id: "market-psychology",
    title: "Market Psychology: Why Traders Lose",
    desc: "Understand fear, greed, FOMO and how market emotions drive price action.",
    date: "Feb 2025",
  },
  {
    id: "price-action-basics",
    title: "Price Action Basics Explained",
    desc: "Learn how to read candlesticks, identify key zones and interpret price movement.",
    date: "Jan 2025",
  },
  {
    id: "risk-management",
    title: "Risk Management for Traders",
    desc: "The most important aspect of trading: sizing, stop-loss, position planning.",
    date: "Dec 2024",
  },
  {
    id: "intraday-strategies",
    title: "5 Intraday Strategies That Work",
    desc: "Simple and effective intraday setups suitable for beginners and pros.",
    date: "Nov 2024",
  },
];

export default function BlogPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* Page Heading */}
      <h1 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 drop-shadow-lg">
        Trading Blog & Insights
      </h1>

      {/* Blog Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.id}`}
            className="group bg-gray-900/80 border border-white/10 p-6 rounded-2xl shadow-md 
                       hover:shadow-xl hover:shadow-purple-500/20 
                       transition-all duration-300 block"
          >
            <h2 className="text-2xl font-semibold text-purple-300 group-hover:text-purple-400 transition">
              {post.title}
            </h2>

            <p className="text-gray-300 mt-3 text-sm leading-relaxed">
              {post.desc}
            </p>

            <div className="mt-5 text-sm text-indigo-300">
              {post.date}
            </div>

            <div className="mt-4 text-indigo-400 group-hover:text-indigo-300 underline text-sm">
              Read More →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
