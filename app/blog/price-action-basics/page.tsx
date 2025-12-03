import React from "react";

export default function PriceActionBasics() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 drop-shadow-md">
        Price Action Basics Explained
      </h1>

      <p className="mt-6 text-gray-300 leading-relaxed text-lg">
        Price action is the cleanest form of technical analysis. It focuses on
        reading market structure, candlestick behaviour and support-resistance
        without relying on indicators.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">
        Candlestick Psychology
      </h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Every candle represents a battle between buyers and sellers. Wick
        rejections show absorption, big bodies show momentum, and dojis indicate
        hesitation.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">Support & Resistance</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Price reacts to zones where heavy volume existed in the past. These
        areas act like magnets and barriers for future price movement.
      </p>
    </div>
  );
}
