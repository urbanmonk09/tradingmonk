// src/components/HealthBar.tsx
import React from "react";

export default function HealthBar({ value, size = "sm" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const height = size === "sm" ? 6 : size === "md" ? 8 : 10;
  // color gradient from red -> yellow -> green
  const color = safe >= 70 ? "bg-green-500" : safe >= 40 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full bg-gray-200 rounded overflow-hidden" style={{ height }}>
      <div className={`${color} h-full transition-all`} style={{ width: `${safe}%` }} />
    </div>
  );
}
