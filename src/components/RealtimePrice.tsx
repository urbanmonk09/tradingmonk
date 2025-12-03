"use client";
import React from "react";
import useRealtimeLTP from "@/src/hooks/useRealtimeLTP";


export default function RealtimePrice({ symbol }: { symbol: string }) {
const { ltp, loading, error } = useRealtimeLTP(symbol, 2000);


return (
<div>
<strong>{symbol}</strong>
{loading ? (
<span> loading…</span>
) : error ? (
<span> error: {error}</span>
) : (
<span> ₹ {ltp?.toFixed ? ltp.toFixed(2) : ltp}</span>
)}
</div>
);
}