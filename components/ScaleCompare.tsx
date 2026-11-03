"use client";

import { dims, fmtLen, type Aspect, type Unit } from "@/lib/tv";

const CONSOLE_H = 20;
const PERSON_H = 69;

/** Side view of both TVs on a console, to scale, next to a 5′9″ person. */
export function ScaleCompare({
  refDiag,
  refAspect,
  targetDiag,
  targetAspect,
  unit,
}: {
  refDiag: number;
  refAspect: Aspect;
  targetDiag: number;
  targetAspect: Aspect;
  unit: Unit;
}) {
  const r = dims(refDiag, refAspect);
  const t = dims(targetDiag, targetAspect);
  const tvW = Math.max(r.w, t.w);
  const pad = 8;
  const personX = pad + tvW + 18;
  const W = personX + 20 + pad;
  const H = Math.max(CONSOLE_H + Math.max(r.h, t.h) + 6, PERSON_H) + pad * 2 + 6;
  const floor = H - pad;
  const cx = pad + tvW / 2;
  const top = floor - CONSOLE_H - 3;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Size comparison">
      <defs>
        <linearGradient id="scr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c6cff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#3a63ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2fd4ff" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={floor} y2={floor} stroke="rgba(255,255,255,0.12)" strokeWidth={0.6} />
      {/* console */}
      <rect x={cx - tvW / 2 - 4} y={floor - CONSOLE_H} width={tvW + 8} height={CONSOLE_H} rx={1.5} fill="#1c2030" />
      {/* target */}
      <g style={{ transition: "all .3s" }}>
        <rect
          x={cx - t.w / 2}
          y={top - t.h}
          width={t.w}
          height={t.h}
          rx={0.8}
          fill="url(#scr)"
          stroke="#c9c2ff"
          strokeWidth={0.7}
        />
        <rect x={cx - 4} y={top} width={8} height={3} fill="#2a2f42" />
      </g>
      {/* current */}
      <rect
        x={cx - r.w / 2}
        y={top - r.h}
        width={r.w}
        height={r.h}
        rx={0.6}
        fill="none"
        stroke="#2fd4ff"
        strokeWidth={0.7}
        strokeDasharray="2 1.4"
      />
      {/* dimension labels */}
      <text x={cx} y={top - t.h - 2.5} textAnchor="middle" fontSize={4} fill="#c9c2ff" fontWeight={600}>
        {fmtLen(t.w, unit)} × {fmtLen(t.h, unit)}
      </text>
      {/* person */}
      <g fill="#3a4058">
        <circle cx={personX + 10} cy={floor - PERSON_H + 4.5} r={4.5} />
        <rect x={personX + 4} y={floor - PERSON_H + 10} width={12} height={28} rx={5} />
        <rect x={personX + 5} y={floor - 32} width={4.5} height={32} rx={2} />
        <rect x={personX + 10.5} y={floor - 32} width={4.5} height={32} rx={2} />
      </g>
      <text x={personX + 10} y={floor - PERSON_H - 2} textAnchor="middle" fontSize={3.2} fill="#8a90a3">
        5′9″
      </text>
    </svg>
  );
}
