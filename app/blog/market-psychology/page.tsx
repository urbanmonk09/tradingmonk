import React from "react";

export default function MarketPsychology() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 drop-shadow-md">
        Market Psychology: Why Traders Lose
      </h1>

      <p className="mt-6 text-gray-300 leading-relaxed text-lg">
        Most traders lose not because their strategy is bad, but because their
        mind is not prepared to handle uncertainty. Market psychology is the
        driving force behind fear, greed, FOMO and emotional decision-making.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">Fear & Panic</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Fear causes traders to exit winning trades early and hold losing trades
        too long. This behaviour often comes from lack of confidence and
        improper risk management.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">
        Greed & Overconfidence
      </h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Greed pushes traders to take unnecessary risks, increase lot sizes and
        ignore signals. Overconfidence usually comes after a winning streak,
        making the trader forget risk management rules.
      </p>

      <h2 className="mt-8 text-2xl font-bold text-indigo-300">FOMO</h2>
      <p className="mt-2 text-gray-300 leading-relaxed">
        Fear of missing out makes traders enter trades late, usually near tops
        or bottoms. FOMO destroys discipline and leads to revenge trading.
      </p>
    </div>
  );
}
