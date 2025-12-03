import { useEffect, useState, useRef } from "react";


type LTPState = {
ltp: number | null;
raw?: any;
loading: boolean;
error?: string | null;
};


export default function useRealtimeLTP(symbol: string, pollMs = 1500) {
const [state, setState] = useState<LTPState>({ ltp: null, loading: true, error: null });
const mounted = useRef(true);


useEffect(() => {
mounted.current = true;
let timer: any;


async function fetchLTP() {
try {
const res = await fetch(`/api/ltp/${encodeURIComponent(symbol)}`);
if (!res.ok) throw new Error("Network error");
const json = await res.json();
if (!mounted.current) return;
setState({ ltp: json.ltp ?? null, raw: json.raw ?? null, loading: false, error: null });
} catch (err: any) {
if (!mounted.current) return;
setState(prev => ({ ...prev, loading: false, error: String(err) }));
}
}


fetchLTP();
timer = setInterval(fetchLTP, pollMs);


return () => {
mounted.current = false;
clearInterval(timer);
};
}, [symbol, pollMs]);


return state;
}