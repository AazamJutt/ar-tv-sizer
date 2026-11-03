"use client";

import { useEffect, useRef } from "react";
import { ASPECTS, clampDiag, fmtDiag, MAX_DIAG, MIN_DIAG, PRESETS, type Aspect, type Unit } from "@/lib/tv";

type Props = {
  value: number;
  onChange: (d: number) => void;
  unit: Unit;
  /** Highlight the user's current TV size among the presets. */
  refDiag?: number;
  min?: number;
  compact?: boolean;
};

export function SizePicker({ value, onChange, unit, refDiag, min = MIN_DIAG, compact }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const presets = PRESETS.filter((p) => p >= min);

  // Keep the selected chip in view.
  useEffect(() => {
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost !p-0 size-11 text-xl" onClick={() => onChange(clampDiag(value - 1))} aria-label="Smaller">
          −
        </button>
        <div className="flex-1 text-center">
          <div className={`font-bold tabular-nums tracking-tight ${compact ? "text-3xl" : "text-5xl"}`}>
            {fmtDiag(value, unit)}
          </div>
          {refDiag && value !== refDiag && (
            <div className="text-xs text-muted mt-0.5">
              {value > refDiag ? "+" : ""}
              {Math.round(((value / refDiag) ** 2 - 1) * 100)}% screen area vs your {fmtDiag(refDiag, unit)}
            </div>
          )}
        </div>
        <button className="btn btn-ghost !p-0 size-11 text-xl" onClick={() => onChange(clampDiag(value + 1))} aria-label="Bigger">
          +
        </button>
      </div>
      <input
        type="range"
        min={Math.max(MIN_DIAG, min)}
        max={MAX_DIAG}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Custom size"
      />
      <div ref={rowRef} className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {presets.map((p) => (
          <button
            key={p}
            className="chip"
            aria-pressed={p === value}
            data-ref={p === refDiag}
            onClick={() => onChange(p)}
          >
            {fmtDiag(p, unit)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AspectPicker({ value, onChange }: { value: Aspect; onChange: (a: Aspect) => void }) {
  return (
    <div className="flex gap-2">
      {(Object.keys(ASPECTS) as Aspect[]).map((a) => (
        <button key={a} className="chip" aria-pressed={a === value} onClick={() => onChange(a)}>
          {a}
        </button>
      ))}
    </div>
  );
}

export function UnitToggle({ value, onChange }: { value: Unit; onChange: (u: Unit) => void }) {
  return (
    <div className="flex rounded-full p-1 bg-white/5 border border-line text-sm font-semibold">
      {(["in", "cm"] as Unit[]).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`px-3 py-1 rounded-full transition ${value === u ? "bg-fg text-bg" : "text-muted"}`}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
