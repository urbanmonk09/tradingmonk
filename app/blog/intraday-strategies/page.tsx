import React from "react";

export default function IntradayStrategies() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-orange-500 drop-shadow-md">
        5 Intraday Strategies That Work
      </h1>

      <p className="mt-6 text-gray-300 leading-relaxed text-lg">
        Intraday trading requires discipline, speed and a rule-based system.
        Here are five powerful strategies used by professional traders.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">1. Opening Range Breakout (ORB)</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        A breakout of first 15-minute high/low gives strong momentum trades.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">2. VWAP Pullback Strategy</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Price pulling back to VWAP and bouncing is a high-probability setup.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">3. Trendline Break</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        When price breaks a well-formed trendline with volume, trend reversal happens.
      </p>
    </div>
  );
}
