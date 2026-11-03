"use client";

import { useSyncExternalStore } from "react";
import type { Aspect, Unit } from "./tv";

export type Settings = {
  /** Size of the TV the user owns today (inches). */
  refDiag: number;
  refAspect: Aspect;
  /** Size the user wants to preview (inches). */
  targetDiag: number;
  targetAspect: Aspect;
  unit: Unit;
  /** Seating distance in inches. */
  distance: number;
  /** Correction factor for true-scale AR, found by matching a real TV. */
  xrScale: number;
  /** Where the bigger TV grows from: sitting on a stand, or centered on a wall. */
  anchor: "bottom" | "center";
};

const KEY = "tv-sizer:v1";

export const DEFAULTS: Settings = {
  refDiag: 40,
  refAspect: "16:9",
  targetDiag: 55,
  targetAspect: "16:9",
  unit: "in",
  distance: 96,
  xrScale: 1,
  anchor: "bottom",
};

let state: Settings | null = null;
const listeners = new Set<() => void>();

function load(): Settings {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    state = DEFAULTS;
  }
  return state!;
}

export function setSettings(patch: Partial<Settings>) {
  state = { ...load(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings() {
  return useSyncExternalStore(subscribe, load, () => DEFAULTS);
}
