import React from "react";

export default function RiskManagement() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 drop-shadow-md">
        Risk Management for Traders
      </h1>

      <p className="mt-6 text-gray-300 leading-relaxed text-lg">
        Risk management is the backbone of trading. Even with a 40% win rate,
        you can stay profitable if your risk is controlled. Without it, even a
        70% win rate will blow your account.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">Position Sizing</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Determine how much you should risk per trade, usually 1–2% of your
        account. This keeps you alive even during losing streaks.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">Stop-Loss Discipline</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        A stop-loss protects your capital. Never place trades without a
        predefined exit level.
      </p>
    </div>
  );
}
