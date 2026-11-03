export type Aspect = "16:9" | "21:9" | "4:3";
export type Unit = "in" | "cm";

export const ASPECTS: Record<Aspect, [number, number]> = {
  "16:9": [16, 9],
  "21:9": [21, 9],
  "4:3": [4, 3],
};

export const PRESETS = [32, 40, 43, 50, 55, 65, 75, 77, 83, 85, 98, 100, 115];
export const MIN_DIAG = 13;
export const MAX_DIAG = 150;

export const IN_TO_CM = 2.54;
export const IN_TO_M = 0.0254;

/** Screen width/height (inches) for a diagonal (inches) and aspect ratio. */
export function dims(diag: number, aspect: Aspect) {
  const [a, b] = ASPECTS[aspect];
  const k = diag / Math.hypot(a, b);
  return { w: a * k, h: b * k };
}

export function aspectRatio(aspect: Aspect) {
  const [a, b] = ASPECTS[aspect];
  return a / b;
}

export function area(diag: number, aspect: Aspect) {
  const { w, h } = dims(diag, aspect);
  return w * h;
}

export function fmtLen(inches: number, unit: Unit, digits = 1) {
  if (unit === "cm") return `${(inches * IN_TO_CM).toFixed(digits === 1 ? 0 : digits)} cm`;
  return `${inches.toFixed(digits)}″`;
}

export function fmtDiag(diag: number, unit: Unit) {
  if (unit === "cm") return `${Math.round(diag * IN_TO_CM)} cm`;
  return `${Number.isInteger(diag) ? diag : diag.toFixed(1)}″`;
}

export function clampDiag(d: number) {
  return Math.min(MAX_DIAG, Math.max(MIN_DIAG, Math.round(d * 2) / 2));
}

/**
 * Diagonal that fills `angleDeg` of horizontal field of view from `distanceIn`.
 * THX recommends ~40° for a cinematic feel, SMPTE ~30° as a comfortable minimum.
 */
export function diagForDistance(distanceIn: number, angleDeg: number, aspect: Aspect) {
  const w = 2 * distanceIn * Math.tan(((angleDeg / 2) * Math.PI) / 180);
  const [a, b] = ASPECTS[aspect];
  return (w * Math.hypot(a, b)) / a;
}

export function viewingAngle(diag: number, distanceIn: number, aspect: Aspect) {
  const { w } = dims(diag, aspect);
  return (2 * Math.atan(w / 2 / distanceIn) * 180) / Math.PI;
}

/** Closest standard size at or above `diag`. */
export function nearestPreset(diag: number) {
  return PRESETS.find((p) => p >= diag - 0.5) ?? PRESETS[PRESETS.length - 1];
}
