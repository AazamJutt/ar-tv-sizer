"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setSettings, useSettings } from "@/lib/store";
import { clampDiag, dims, fmtDiag, fmtLen, aspectRatio } from "@/lib/tv";
import { detectTV, drawCover, type Box } from "@/lib/detect";
import { AspectPicker, SizePicker, UnitToggle } from "./SizePicker";
import { Icon } from "./Icon";

type Phase = "ask" | "calibrate" | "compare";
type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_PX = 36;

export function CameraAR({ onExit }: { onExit: () => void }) {
  const s = useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stillRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<Phase>("ask");
  // Reference box, normalized to the viewport (0..1) so rotation/resizes keep it.
  const [nbox, setNbox] = useState<Box | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [lockAspect, setLockAspect] = useState(true);
  const [solid, setSolid] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((t: string) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // Track viewport size.
  useEffect(() => {
    const el = rootRef.current!;
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start the rear camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamError("Camera needs a secure (HTTPS) connection. Open the app over HTTPS, or use a photo instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
      } catch (e) {
        setCamError(
          (e as Error)?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser settings, or use a photo instead."
            : "Couldn't start the camera. You can still use a photo of your TV.",
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toPx = useCallback((b: Box): Box => ({ x: b.x * view.w, y: b.y * view.h, w: b.w * view.w, h: b.h * view.h }), [view]);
  const toN = useCallback((b: Box): Box => ({ x: b.x / view.w, y: b.y / view.h, w: b.w / view.w, h: b.h / view.h }), [view]);

  /** Default frame: centered, 60% wide, at the TV's true aspect ratio. */
  const defaultBox = useCallback((): Box => {
    const w = view.w * 0.62;
    const h = w / aspectRatio(s.refAspect);
    return toN({ x: (view.w - w) / 2, y: view.h * 0.38 - h / 2, w, h });
  }, [view, s.refAspect, toN]);

  const freezeFrom = useCallback(
    (src: CanvasImageSource, sw: number, sh: number) => {
      const c = stillRef.current!;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = view.w * dpr;
      c.height = view.h * dpr;
      drawCover(c.getContext("2d")!, src, sw, sh, c.width, c.height);
      setFrozen(true);
    },
    [view],
  );

  const toggleFreeze = () => {
    if (frozen) return setFrozen(false);
    const v = videoRef.current!;
    if (!v.videoWidth) return;
    freezeFrom(v, v.videoWidth, v.videoHeight);
  };

  const onPhoto = (file?: File) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      freezeFrom(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(img.src);
      setCamError(null);
      if (phase === "ask") return;
      setTimeout(() => autoDetect(true), 50);
    };
    img.src = URL.createObjectURL(file);
  };

  const autoDetect = useCallback(
    (fromStill = frozen) => {
      const src: CanvasImageSource | null = fromStill ? stillRef.current : videoRef.current;
      if (!src) return;
      const sw = fromStill ? stillRef.current!.width : videoRef.current!.videoWidth;
      const sh = fromStill ? stillRef.current!.height : videoRef.current!.videoHeight;
      if (!sw || !sh) return showToast("Camera not ready yet");
      const found = detectTV(src, sw, sh, view.w, view.h);
      if (found) {
        setNbox(toN(found));
        showToast("Found it! Drag the corners to fine-tune.");
      } else {
        showToast("Couldn't spot the TV — drag the frame onto it.");
      }
    },
    [frozen, view, toN, showToast],
  );

  // Auto-run detection when we enter calibration.
  const detectedOnce = useRef(false);
  useEffect(() => {
    if (phase !== "calibrate" || detectedOnce.current) return;
    if (!camReady && !frozen) return;
    detectedOnce.current = true;
    const id = setTimeout(() => autoDetect(), 700);
    return () => clearTimeout(id);
  }, [phase, camReady, frozen, autoDetect]);

  // ---------- Gestures ----------
  const drag = useRef<{ mode: Handle; x0: number; y0: number; b0: Box } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; b0: Box; diag0: number } | null>(null);

  const onHandleDown = (e: React.PointerEvent<HTMLElement>) => {
    const mode = e.currentTarget.dataset.handle as Handle;
    if (!nbox || pointers.current.size > 0) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, x0: e.clientX, y0: e.clientY, b0: toPx(nbox) };
  };

  const onHandleMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    let { x, y, w, h } = d.b0;
    const m = d.mode;
    if (m === "move") {
      x += dx;
      y += dy;
    } else {
      if (m.includes("e")) w = d.b0.w + dx;
      if (m.includes("w")) w = d.b0.w - dx;
      if (m.includes("s")) h = d.b0.h + dy;
      if (m.includes("n")) h = d.b0.h - dy;
      w = Math.max(MIN_PX, w);
      h = Math.max(MIN_PX, h);
      if (lockAspect && m.length === 2) {
        // Corner drag: keep the frame's ratio, follow whichever axis moved more.
        const r = d.b0.w / d.b0.h;
        if (Math.abs(w - d.b0.w) >= Math.abs(h - d.b0.h) * r) h = w / r;
        else w = h * r;
      }
      if (m.includes("w")) x = d.b0.x + d.b0.w - w;
      if (m.includes("n")) y = d.b0.y + d.b0.h - h;
    }
    setNbox(toN({ x, y, w, h }));
  };

  const onHandleUp = () => {
    drag.current = null;
  };

  // Two-finger pinch anywhere: scales the frame (calibrate) or the TV size (compare).
  const onRootDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && nbox) {
      drag.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), b0: toPx(nbox), diag0: s.targetDiag };
    }
  };
  const onRootMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (!p || pointers.current.size < 2) return;
    const [a, b] = [...pointers.current.values()];
    const k = Math.hypot(a.x - b.x, a.y - b.y) / p.d0;
    if (phase === "calibrate") {
      const w = Math.max(MIN_PX, p.b0.w * k);
      const h = Math.max(MIN_PX, p.b0.h * k);
      const cx = p.b0.x + p.b0.w / 2;
      const cy = p.b0.y + p.b0.h / 2;
      setNbox(toN({ x: cx - w / 2, y: cy - h / 2, w, h }));
    } else if (phase === "compare") {
      setSettings({ targetDiag: clampDiag(p.diag0 * k) });
    }
  };
  const onRootUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // ---------- Geometry ----------
  const ref = nbox && view.w ? toPx(nbox) : null;
  const refIn = dims(s.refDiag, s.refAspect);
  const tgtIn = dims(s.targetDiag, s.targetAspect);
  let target: Box | null = null;
  if (ref) {
    // Separate horizontal/vertical scale preserves any perspective squash the user matched.
    const ppiX = ref.w / refIn.w;
    const ppiY = ref.h / refIn.h;
    const w = tgtIn.w * ppiX;
    const h = tgtIn.h * ppiY;
    const x = ref.x + ref.w / 2 - w / 2;
    const y = s.anchor === "bottom" ? ref.y + ref.h - h : ref.y + ref.h / 2 - h / 2;
    target = { x, y, w, h };
  }

  const startCalibrate = () => {
    if (!nbox) setNbox(defaultBox());
    setPhase("calibrate");
  };

  const savePhoto = async () => {
    if (!target || !ref) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement("canvas");
    c.width = view.w * dpr;
    c.height = view.h * dpr;
    const ctx = c.getContext("2d")!;
    if (frozen) ctx.drawImage(stillRef.current!, 0, 0, c.width, c.height);
    else {
      const v = videoRef.current!;
      drawCover(ctx, v, v.videoWidth, v.videoHeight, c.width, c.height);
    }
    ctx.scale(dpr, dpr);
    ctx.fillStyle = solid ? "rgba(8,9,14,0.92)" : "rgba(80,90,255,0.28)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.fillRect(target.x, target.y, target.w, target.h);
    ctx.strokeRect(target.x, target.y, target.w, target.h);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = "#2fd4ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ref.x, ref.y, ref.w, ref.h);
    ctx.setLineDash([]);
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`${fmtDiag(s.targetDiag, s.unit)} TV`, target.x + 12, target.y + 30);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return;
    const file = new File([blob], `tv-${s.targetDiag}in.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `${s.targetDiag}" TV preview` }).catch(() => {});
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  };

  const steps: Phase[] = ["ask", "calibrate", "compare"];

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden touch-none select-none"
      onPointerDown={onRootDown}
      onPointerMove={onRootMove}
      onPointerUp={onRootUp}
      onPointerCancel={onRootUp}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onLoadedData={() => setCamReady(true)}
        className="absolute inset-0 size-full object-cover"
        style={{ visibility: frozen ? "hidden" : "visible" }}
      />
      <canvas ref={stillRef} className="absolute inset-0 size-full" style={{ display: frozen ? "block" : "none" }} />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/50 via-transparent to-black/60" />

      {camError && !frozen && (
        <div className="absolute inset-x-6 top-24 card p-6 text-center fade-up">
          <Icon name="camera-off" className="size-8 mx-auto text-warn" />
          <p className="mt-3 text-sm text-muted">{camError}</p>
          <button className="btn btn-primary mt-4" onClick={() => fileRef.current?.click()}>
            <Icon name="image" className="size-4" /> Use a photo of my TV
          </button>
        </div>
      )}

      {/* Reference frame (calibration) */}
      {ref && phase === "calibrate" && (
        <div
          className="absolute rounded-[3px]"
          style={{
            left: ref.x,
            top: ref.y,
            width: ref.w,
            height: ref.h,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
            outline: "2px solid #2fd4ff",
          }}
        >
          <div
            className="absolute inset-0 cursor-move"
            data-handle="move"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
          />
          <div className="absolute -top-8 left-0 text-xs font-semibold px-2 py-1 rounded-full bg-accent-2 text-black pointer-events-none">
            Your {fmtDiag(s.refDiag, s.unit)} TV
          </div>
          {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as Handle[]).map((h) => {
            const left = h.includes("w") ? 0 : h.includes("e") ? "100%" : "50%";
            const top = h.includes("n") ? 0 : h.includes("s") ? "100%" : "50%";
            const corner = h.length === 2;
            return (
              <div
                key={h}
                data-handle={h}
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                className="absolute size-11 -translate-x-1/2 -translate-y-1/2 grid place-items-center"
                style={{ left, top, cursor: `${h}-resize` }}
              >
                <div
                  className={`${corner ? "size-5 handle" : "size-3.5"} rounded-full bg-white border-2 border-accent-2 shadow-lg`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison overlay */}
      {ref && target && phase === "compare" && (
        <>
          <div
            className="absolute rounded-[4px] transition-all duration-200 pointer-events-none"
            style={{
              left: target.x,
              top: target.y,
              width: target.w,
              height: target.h,
              background: solid
                ? "linear-gradient(135deg,#0b0c12,#141826 60%,#0b0c12)"
                : "linear-gradient(135deg,rgba(124,108,255,.32),rgba(58,99,255,.18) 55%,rgba(47,212,255,.28))",
              border: "max(3px, 0.6vmin) solid #0d0e13",
              outline: "1.5px solid rgba(255,255,255,.85)",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}
          >
          </div>
          {/* Size label, clamped so it stays visible when the TV overflows the screen */}
          <div
            className="absolute glass rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap pointer-events-none"
            style={{
              left: Math.min(Math.max(12, target.x + 10), view.w - 190),
              top: Math.min(Math.max(84, target.y + 10), view.h - 40),
            }}
          >
            {fmtDiag(s.targetDiag, s.unit)} · {fmtLen(tgtIn.w, s.unit)} × {fmtLen(tgtIn.h, s.unit)}
          </div>
          <div
            className="absolute pointer-events-none rounded-[3px]"
            style={{ left: ref.x, top: ref.y, width: ref.w, height: ref.h, outline: "2px dashed #2fd4ff" }}
          >
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-accent-2 whitespace-nowrap">
              current {fmtDiag(s.refDiag, s.unit)}
            </div>
          </div>
        </>
      )}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3">
        <button className="btn btn-ghost glass !p-0 size-11" onClick={onExit} aria-label="Close">
          <Icon name="x" className="size-5" />
        </button>
        <div className="flex-1 flex justify-center gap-1.5">
          {steps.map((p, i) => (
            <div
              key={p}
              className={`h-1.5 rounded-full transition-all ${
                steps.indexOf(phase) >= i ? "w-8 bg-white" : "w-4 bg-white/30"
              }`}
            />
          ))}
        </div>
        <UnitToggle value={s.unit} onChange={(unit) => setSettings({ unit })} />
      </div>

      {toast && (
        <div className="absolute top-20 inset-x-0 flex justify-center pointer-events-none">
          <div className="glass rounded-full px-4 py-2 text-sm font-medium fade-up">{toast}</div>
        </div>
      )}

      {/* Bottom sheet */}
      <div
        className="absolute bottom-0 inset-x-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="glass rounded-[28px] p-5 max-w-xl mx-auto fade-up" key={phase}>
          {phase === "ask" && (
            <>
              <div className="label">Step 1 · Your current TV</div>
              <h2 className="text-xl font-semibold mt-1">What size is the TV in front of you?</h2>
              <p className="text-sm text-muted mt-1 mb-4">
                We use it as a ruler, so every bigger size is drawn to true scale in your room.
              </p>
              <SizePicker value={s.refDiag} onChange={(refDiag) => setSettings({ refDiag })} unit={s.unit} compact />
              <div className="flex items-center justify-between mt-3">
                <AspectPicker value={s.refAspect} onChange={(refAspect) => setSettings({ refAspect, targetAspect: refAspect })} />
              </div>
              <button className="btn btn-primary w-full mt-4" onClick={startCalibrate}>
                Find my TV <Icon name="arrow-right" className="size-4" />
              </button>
            </>
          )}

          {phase === "calibrate" && (
            <>
              <div className="label">Step 2 · Calibrate</div>
              <h2 className="text-lg font-semibold mt-1">
                Fit the blue frame to your {fmtDiag(s.refDiag, s.unit)} screen
              </h2>
              <p className="text-sm text-muted mt-1">
                Drag corners or pinch to stretch. Freeze the image so you can adjust comfortably.
              </p>
              <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar">
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={() => autoDetect()}>
                  <Icon name="sparkles" className="size-4" /> Auto-fit
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" aria-pressed={frozen} onClick={toggleFreeze} disabled={!camReady}>
                  <Icon name={frozen && camReady ? "play" : "pause"} className="size-4" /> {frozen && camReady ? "Live" : "Freeze"}
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" aria-pressed={lockAspect} onClick={() => setLockAspect(!lockAspect)}>
                  <Icon name={lockAspect ? "lock" : "unlock"} className="size-4" /> Ratio
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={() => setNbox(defaultBox())}>
                  <Icon name="reset" className="size-4" /> Reset
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="image" className="size-4" /> Photo
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn btn-ghost" onClick={() => setPhase("ask")}>
                  {fmtDiag(s.refDiag, s.unit)}?
                </button>
                <button className="btn btn-primary flex-1" onClick={() => setPhase("compare")} disabled={!nbox}>
                  <Icon name="check" className="size-4" /> It matches
                </button>
              </div>
            </>
          )}

          {phase === "compare" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="label">Step 3 · Try bigger sizes</div>
                <div className="text-xs text-muted">Pinch to resize</div>
              </div>
              <SizePicker
                value={s.targetDiag}
                onChange={(targetDiag) => setSettings({ targetDiag })}
                unit={s.unit}
                refDiag={s.refDiag}
                compact
              />
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                <button
                  className="btn btn-ghost !py-2 !px-3.5 text-sm"
                  onClick={() => setSettings({ anchor: s.anchor === "bottom" ? "center" : "bottom" })}
                >
                  <Icon name={s.anchor === "bottom" ? "stand" : "wall"} className="size-4" />
                  {s.anchor === "bottom" ? "On stand" : "Wall center"}
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" aria-pressed={frozen} onClick={toggleFreeze} disabled={!camReady}>
                  <Icon name={frozen && camReady ? "play" : "pause"} className="size-4" /> {frozen && camReady ? "Live" : "Freeze"}
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" aria-pressed={solid} onClick={() => setSolid(!solid)}>
                  <Icon name="tv" className="size-4" /> {solid ? "Solid" : "Ghost"}
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={savePhoto}>
                  <Icon name="download" className="size-4" /> Save
                </button>
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={() => setPhase("calibrate")}>
                  <Icon name="ruler" className="size-4" /> Recalibrate
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPhoto(e.target.files?.[0])}
      />
    </div>
  );
}
