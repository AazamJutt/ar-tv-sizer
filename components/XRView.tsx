"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { setSettings, useSettings } from "@/lib/store";
import { buildTV, disposeGroup } from "@/lib/tvModel";
import { fmtDiag } from "@/lib/tv";
import { SizePicker } from "./SizePicker";
import { Icon } from "./Icon";

type Hit = { p: THREE.Vector3; n: THREE.Vector3; wall: boolean; cam: THREE.Vector3 };
type Status = "idle" | "scanning" | "aim" | "placed";

const STAND_H = 0.092;

/** True-scale WebXR AR (Android Chrome): tap a floor, table or wall to drop a real-size TV. */
export default function XRView({ onExit, calibrate: startCalibrating = false }: { onExit: () => void; calibrate?: boolean }) {
  const s = useSettings();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [calibrating, setCalibrating] = useState(startCalibrating);
  const [lift, setLift] = useState(0);
  const [onWall, setOnWall] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const xr = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    session: XRSession;
    reticle: THREE.Mesh;
    holder: THREE.Group;
    tv: { group: THREE.Group; H: number; bezel: number } | null;
    hit: Hit | null;
    lastHit: Hit | null;
    placed: boolean;
  } | null>(null);

  const diag = calibrating ? s.refDiag : s.targetDiag;
  const aspect = calibrating ? s.refAspect : s.targetAspect;

  /** Position the TV from the stored hit, using its current height. */
  const layout = () => {
    const c = xr.current;
    if (!c?.tv || !c.hit) return;
    const { holder } = c;
    const { p, n, wall, cam } = c.hit;
    const halfH = (c.tv.H / 2 + c.tv.bezel) * s.xrScale;
    if (wall) {
      holder.position.copy(p).addScaledVector(n, 0.04);
      holder.lookAt(holder.position.clone().add(n));
    } else {
      holder.position.set(p.x, p.y + STAND_H * s.xrScale + halfH + lift, p.z);
      holder.lookAt(cam.x, holder.position.y, cam.z);
    }
    holder.scale.setScalar(s.xrScale);
    c.tv.group.children.forEach((m) => {
      // Hide the stand on walls.
      if (m.userData.stand) m.visible = !wall;
    });
    holder.visible = c.placed;
  };

  // Rebuild the model whenever the size changes.
  useEffect(() => {
    const c = xr.current;
    if (!c) return;
    if (c.tv) {
      c.holder.remove(c.tv.group);
      disposeGroup(c.tv.group);
    }
    const tv = buildTV(diag, aspect, 1, { stand: true });
    tv.group.children.slice(2).forEach((m) => (m.userData.stand = true));
    c.holder.add(tv.group);
    c.tv = tv;
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diag, aspect, status === "idle"]);

  useEffect(() => {
    layout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.xrScale, lift, status]);

  // Keep UI taps from also triggering an XR "select" (placement).
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener("beforexrselect", stop);
    return () => el.removeEventListener("beforexrselect", stop);
  }, [status]);

  useEffect(() => () => void xr.current?.session.end().catch(() => {}), []);

  const start = async () => {
    setError(null);
    try {
      const session = await navigator.xr!.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "light-estimation"],
        domOverlay: { root: overlayRef.current! },
      });
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");
      await renderer.xr.setSession(session);

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(1, 3, 2);
      scene.add(sun);

      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x2fd4ff }),
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      const holder = new THREE.Group();
      holder.visible = false;
      scene.add(holder);

      xr.current = { renderer, scene, session, reticle, holder, tv: null, hit: null, lastHit: null, placed: false };
      setStatus("scanning");

      const viewer = await session.requestReferenceSpace("viewer");
      const hitSource = await session.requestHitTestSource!({ space: viewer });
      const camPos = new THREE.Vector3();
      const q = new THREE.Quaternion();

      renderer.setAnimationLoop((_t, frame) => {
        const c = xr.current;
        if (!c || !frame) return;
        const space = renderer.xr.getReferenceSpace()!;
        const vp = frame.getViewerPose(space);
        if (vp) camPos.set(vp.transform.position.x, vp.transform.position.y, vp.transform.position.z);
        const hits = hitSource ? frame.getHitTestResults(hitSource) : [];
        const pose = hits[0]?.getPose(space);
        if (pose && !c.placed) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
          const o = pose.transform.orientation;
          q.set(o.x, o.y, o.z, o.w);
          const n = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
          const pp = pose.transform.position;
          c.lastHit = { p: new THREE.Vector3(pp.x, pp.y, pp.z), n, wall: Math.abs(n.y) < 0.5, cam: camPos.clone() };
          setStatus((st) => (st === "scanning" ? "aim" : st));
        } else if (!c.placed) {
          reticle.visible = false;
        }
        renderer.render(scene, renderer.xr.getCamera());
      });

      session.addEventListener("select", () => {
        const c = xr.current;
        if (!c || c.placed || !c.lastHit) return;
        c.hit = c.lastHit;
        c.placed = true;
        c.reticle.visible = false;
        setLift(0);
        setOnWall(c.hit.wall);
        setStatus("placed"); // layout effect positions it with fresh settings
      });

      session.addEventListener("end", () => {
        const c = xr.current;
        if (c) {
          c.renderer.setAnimationLoop(null);
          disposeGroup(c.scene);
          c.renderer.dispose();
        }
        xr.current = null;
        setStatus("idle");
      });
    } catch (e) {
      setError((e as Error)?.message || "Couldn't start AR on this device.");
    }
  };

  const move = () => {
    const c = xr.current;
    if (!c) return;
    c.placed = false;
    c.holder.visible = false;
    setStatus("aim");
  };

  // Pinch on the AR view while calibrating = stretch the virtual TV to match the real one.
  const pinch = useRef<{ d0: number; k0: number } | null>(null);
  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (calibrating && e.touches.length === 2) pinch.current = { d0: dist(e.touches), k0: s.xrScale };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pinch.current || e.touches.length < 2) return;
    const k = pinch.current.k0 * (dist(e.touches) / pinch.current.d0);
    setSettings({ xrScale: Math.min(1.5, Math.max(0.6, k)) });
  };
  const onTouchEnd = () => (pinch.current = null);

  const pct = Math.round((s.xrScale - 1) * 1000) / 10;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 select-none"
      style={{ background: status === "idle" ? "var(--bg)" : "transparent" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-0 inset-x-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3">
        <button
          className="btn btn-ghost glass !p-0 size-11"
          onClick={() => (xr.current ? xr.current.session.end() : onExit())}
          aria-label="Close"
        >
          <Icon name="x" className="size-5" />
        </button>
        {status !== "idle" && (
          <div className="glass rounded-full px-4 py-2 text-sm font-medium">
            {status === "scanning" && "Move your phone slowly to find surfaces…"}
            {status === "aim" && "Aim at the floor, a table or a wall — then tap"}
            {status === "placed" && (calibrating ? "Pinch until it matches your real TV" : `${fmtDiag(diag, s.unit)} at true scale`)}
          </div>
        )}
      </div>

      {status === "idle" && (
        <div className="h-full flex flex-col items-center justify-center text-center px-8 fade-up">
          <div className="size-20 rounded-3xl grid place-items-center bg-gradient-to-br from-accent to-accent-2 shadow-2xl">
            <Icon name="cube" className="size-10 text-white" />
          </div>
          <h2 className="text-2xl font-semibold mt-6">{calibrating ? "Calibrate true-scale AR" : "True-scale AR"}</h2>
          <p className="text-muted mt-2 max-w-sm">
            {calibrating
              ? `We'll drop a virtual ${fmtDiag(s.refDiag, s.unit)} TV. Place it on your real one and pinch until the edges line up — every size after that uses the same correction.`
              : "Uses your phone's depth tracking to place a real-size TV. Tap a floor or table to stand it up, or a wall to mount it."}
          </p>
          {error && <p className="text-warn text-sm mt-4">{error}</p>}
          <button className="btn btn-primary mt-8 px-8" onClick={start}>
            Start AR <Icon name="arrow-right" className="size-4" />
          </button>
        </div>
      )}

      {status !== "idle" && (
        <div ref={panelRef} className="absolute bottom-0 inset-x-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="glass rounded-[28px] p-5 max-w-xl mx-auto">
            <div className="flex gap-2 mb-4">
              <button className="chip" aria-pressed={!calibrating} onClick={() => setCalibrating(false)}>
                Preview sizes
              </button>
              <button className="chip" aria-pressed={calibrating} onClick={() => setCalibrating(true)}>
                Calibrate
              </button>
            </div>

            {calibrating ? (
              <>
                <p className="text-sm text-muted">
                  Showing your {fmtDiag(s.refDiag, s.unit)} TV. Overlay it on the real one, then pinch or slide to match.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-sm tabular-nums w-16 font-semibold">
                    {pct > 0 ? "+" : ""}
                    {pct}%
                  </span>
                  <input
                    type="range"
                    min={0.6}
                    max={1.5}
                    step={0.002}
                    value={s.xrScale}
                    onChange={(e) => setSettings({ xrScale: Number(e.target.value) })}
                    aria-label="Scale correction"
                  />
                  <button className="btn btn-ghost !py-1.5 !px-3 text-xs" onClick={() => setSettings({ xrScale: 1 })}>
                    Reset
                  </button>
                </div>
                <button className="btn btn-primary w-full mt-3" onClick={() => setCalibrating(false)}>
                  <Icon name="check" className="size-4" /> Matches — show bigger sizes
                </button>
              </>
            ) : (
              <SizePicker
                value={s.targetDiag}
                onChange={(targetDiag) => setSettings({ targetDiag })}
                unit={s.unit}
                refDiag={s.refDiag}
                compact
              />
            )}

            {status === "placed" && (
              <div className="flex gap-2 mt-3">
                <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={move}>
                  <Icon name="move" className="size-4" /> Move
                </button>
                {!onWall && (
                  <>
                    <button className="btn btn-ghost !py-2 !px-3.5 text-sm" onClick={() => setLift((l) => l + 0.05)}>
                      <Icon name="up" className="size-4" /> Raise
                    </button>
                    <button
                      className="btn btn-ghost !py-2 !px-3.5 text-sm"
                      onClick={() => setLift((l) => Math.max(0, l - 0.05))}
                    >
                      <Icon name="down" className="size-4" /> Lower
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
