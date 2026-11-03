export type Box = { x: number; y: number; w: number; h: number };

/**
 * Draw `src` into a canvas of size (cw, ch) the same way CSS `object-fit: cover`
 * would, so canvas pixels line up with what the user sees on screen.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  cw: number,
  ch: number,
) {
  const s = Math.max(cw / sw, ch / sh);
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/**
 * Find the most TV-like rectangle in the frame: a large, compact, roughly
 * rectangular region that is either very dark (screen off) or very bright
 * (screen on). Returns a box in container pixels, or null.
 */
export function detectTV(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  cw: number,
  ch: number,
): Box | null {
  const W = 160;
  const H = Math.max(40, Math.round((W * ch) / cw));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  drawCover(ctx, src, sw, sh, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const lum = new Uint8Array(W * H);
  const hist = new Uint32Array(256);
  for (let i = 0; i < W * H; i++) {
    const v = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    lum[i] = v;
    hist[lum[i]]++;
  }
  const pct = (p: number) => {
    let acc = 0;
    const target = W * H * p;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= target) return v;
    return 255;
  };

  // Several masks: absolute dark, relative dark, and bright (screen on).
  const masks: ((v: number) => boolean)[] = [];
  for (const t of [35, 55, Math.min(90, pct(0.25) + 8)]) masks.push((v) => v < t);
  const bright = Math.max(200, pct(0.85));
  masks.push((v) => v > bright);

  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let best: { box: Box; score: number } | null = null;

  for (const inMask of masks) {
    label.fill(0);
    let next = 1;
    for (let start = 0; start < W * H; start++) {
      if (label[start] || !inMask(lum[start])) continue;
      const id = next++;
      let sp = 0;
      stack[sp++] = start;
      label[start] = id;
      let count = 0;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      while (sp) {
        const p = stack[--sp];
        const x = p % W;
        const y = (p / W) | 0;
        count++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
        for (const q of nb) {
          if (q >= 0 && !label[q] && inMask(lum[q])) {
            label[q] = id;
            stack[sp++] = q;
          }
        }
      }
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      const bArea = bw * bh;
      if (count < W * H * 0.015 || bArea > W * H * 0.8) continue;
      const ratio = bw / bh;
      if (ratio < 1.15 || ratio > 2.6) continue;
      const fill = count / bArea;
      if (fill < 0.6) continue;
      const edges = +(x0 === 0) + +(y0 === 0) + +(x1 === W - 1) + +(y1 === H - 1);
      if (edges >= 2) continue;
      const cx = (x0 + x1) / 2 / W - 0.5;
      const cy = (y0 + y1) / 2 / H - 0.5;
      const centrality = 1 - Math.min(1, Math.hypot(cx, cy) * 1.4);
      const ratioFit = 1 - Math.min(1, Math.abs(ratio - 16 / 9) / 1.2);
      const score = Math.sqrt(count) * fill ** 3 * (0.4 + centrality) * (0.5 + ratioFit) * (edges ? 0.5 : 1);
      if (!best || score > best.score) {
        best = { score, box: { x: x0, y: y0, w: bw, h: bh } };
      }
    }
  }

  if (!best) return null;
  const k = cw / W;
  const ky = ch / H;
  const { x, y, w, h } = best.box;
  return { x: x * k, y: y * ky, w: w * k, h: h * ky };
}
