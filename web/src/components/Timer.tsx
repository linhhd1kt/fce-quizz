'use client';

import { useEffect, useRef } from 'react';

interface TimerProps {
  seconds: number;
  totalSeconds: number;
  onExpire: () => void;
}

export default function Timer({ seconds, totalSeconds, onExpire }: TimerProps) {
  const prevSeconds = useRef(seconds);

  useEffect(() => {
    if (seconds === 0 && prevSeconds.current > 0) {
      onExpire();
    }
    prevSeconds.current = seconds;
  }, [seconds, onExpire]);

  const pct = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  const color =
    pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-mono font-bold w-8 text-right ${pct <= 20 ? 'text-red-400' : 'text-slate-300'}`}>
        {seconds}s
      </span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
